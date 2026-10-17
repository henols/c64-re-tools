// The c64-testing replay script: replays a recording in the replay core
// (c64run). First on the original program, which must end with the recorded
// state hash. Then, with --rebuild, on the rebuild: it compares the state at
// each checkpoint with the original's. --checkpoint and --state choose the
// comparison, else the record file gave it.
// Exit status: 0 PASS, 1 FAIL, 3 INCONCLUSIVE, 2 a bad call.

import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { C64RunSession } from "#src/native/c64run.ts";
import { localToolContext } from "#src/native/local.ts";
import { Workspace } from "#src/native/staging.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { codeLabels, firstDifference, parseStateItem, pinLines, readRecording, replaySide, siteMap, type Comparison, type ReplayResult, type ReplaySubject } from "./lib/recording.ts";
import { ScenarioError } from "./lib/scenario.ts";

const USAGE = `replay.ts <recording folder> [--checkpoint <routine> --state <item> ... [--pin <item> ...]] [--rebuild <prg> [--symbols <file>]] [--out <dir>]

<recording folder> is a folder that record.ts wrote, relative to the project
folder. --checkpoint is the name or $ address of a routine; each entry is a
checkpoint. --state is a name or $ address with :size, one for each item.
--pin is random state in RAM in the same form: at each checkpoint the rebuild
gets the original's values there.
Without them, the replay uses the comparison of the record file. --symbols
gives the names of the rebuild: the c64-assembler output (default: the
symbols of the recording). A recording without names takes the names of the
knowledge for the original. A $ address is an address of the original: on the
rebuild it moves with the name before it. With --out, a FAIL writes the RAM
of both sides at the first different checkpoint into <dir>. The result is one
JSON object.`;

const EXIT = { PASS: 0, FAIL: 1, INCONCLUSIVE: 3 } as const;
const MAX_STATE_ITEMS = 16;

async function run(argv: string[]): Promise<ReplayResult> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: {
      checkpoint: { type: "string" },
      state: { type: "string", multiple: true },
      pin: { type: "string", multiple: true },
      rebuild: { type: "string" },
      symbols: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 1) throw new UsageError("give one recording folder");
  if (values.symbols !== undefined && values.rebuild === undefined) throw new UsageError("--symbols is for the rebuild: give --rebuild too");
  if ((values.checkpoint === undefined) !== (values.state === undefined)) throw new UsageError("give --checkpoint and --state together");
  if ((values.state?.length ?? 0) + (values.pin?.length ?? 0) > MAX_STATE_ITEMS) throw new UsageError(`give at most ${MAX_STATE_ITEMS} --state and --pin items`);
  if (values.pin !== undefined && values.checkpoint === undefined) throw new UsageError("--pin needs --checkpoint and --state");
  if (values.out !== undefined) {
    try {
      resolveProjectPath(values.out);
    } catch {
      throw new UsageError(`--out must be a path relative to the project folder that stays inside it, not ${values.out}`);
    }
  }
  const folder = positionals[0]!.replace(/\/+$/, "").replace(/\/recording\.json$/, "");
  let recording;
  let given: Comparison | undefined;
  try {
    recording = readRecording(folder);
    given =
      values.checkpoint === undefined
        ? undefined
        : { checkpoint: values.checkpoint, state: values.state!.map(parseStateItem), ...(values.pin === undefined ? {} : { pin: values.pin.map(parseStateItem) }) };
  } catch (error) {
    if (error instanceof ScenarioError) throw new UsageError(error.message);
    throw error;
  }
  const compare = given ?? recording.compare;
  if (values.rebuild !== undefined && compare === undefined) throw new UsageError("the recording has no checkpoint and state: give --checkpoint and --state");
  const result = (outcome: ReplayResult["result"], side: ReplayResult["side"], fields: Partial<ReplayResult> = {}): ReplayResult => ({
    result: outcome,
    recording: folder,
    side,
    ...(compare === undefined ? {} : { checkpoint: compare.checkpoint }),
    checkpoints: 0,
    compared: 0,
    ...fields,
  });
  const sha256 = createHash("sha256").update(readProjectFile(recording.program).bytes).digest("hex");
  if (sha256 !== recording.sha256) return result("INCONCLUSIVE", "original", { reason: `${recording.program} is not the program of the recording (its SHA-256 changed); record the session again` });

  const context = localToolContext();
  const core = await C64RunSession.open(context);
  const workspace = Workspace.create(context.supervisor, "c64-re-tools-replay-");
  try {
    // A recording made without names takes the names that the knowledge has now.
    const originalSymbols = recording.symbols === "none" ? "knowledge" : recording.symbols;
    const original: ReplaySubject = { side: "original", program: recording.program, symbols: originalSymbols };
    const side = async (subject: ReplaySubject, options: Parameters<typeof replaySide>[5]) => {
      try {
        return await replaySide(core, recording, folder, subject, workspace, options);
      } catch (error) {
        if (error instanceof ScenarioError) throw new UsageError(error.message);
        throw error;
      }
    };
    // The self-check: the original ends the session with the recorded state, to the cycle.
    const self = await side(original, { ...(compare === undefined ? {} : { compare }) });
    if (self.problem !== undefined) return result("INCONCLUSIVE", "original", { reason: `the recording does not reproduce on the original: ${self.problem}` });
    if (self.unknown > 0 || self.misses > 0) {
      return result("INCONCLUSIVE", "original", { reason: `the recording does not reproduce on the original: ${self.unknown + self.misses} input reads had no recorded value; record the session again with this c64run` });
    }
    if (self.end.tick !== recording.ticks || self.end.hash !== recording.hash) {
      return result("INCONCLUSIVE", "original", { reason: "the recording does not reproduce on the original: the state at its end is different; record the session again with this c64run" });
    }
    const expected = self.samples;
    if (compare !== undefined && expected.length === 0) return result("INCONCLUSIVE", "original", { reason: `the original never came to the checkpoint ${compare.checkpoint} in the session` });
    if (values.rebuild === undefined) return result("PASS", "original", { checkpoints: expected.length });

    const rebuild: ReplaySubject = { side: "rebuild", program: values.rebuild, symbols: values.symbols ?? originalSymbols };
    let movedSites: number;
    try {
      movedSites = siteMap(recording.sites, codeLabels(originalSymbols), codeLabels(rebuild.symbols)).length;
    } catch (error) {
      throw new UsageError(`--symbols ${rebuild.symbols}: ${(error as Error).message}`);
    }
    const pins = pinLines(expected, compare!.state);
    const replayed = await side(rebuild, { compare: compare!, stop: expected.length, pins });
    const difference = firstDifference(expected, replayed.samples, compare!.state);
    // A read that the recording has no value for gets the idle value: it is in the result, never silent.
    const base = { checkpoints: expected.length, movedSites, ...(replayed.unknown > 0 ? { idleReads: replayed.unknown } : {}) };
    if (difference === undefined && replayed.samples.length >= expected.length) return result("PASS", "rebuild", { ...base, compared: expected.length });
    const reason =
      difference !== undefined
        ? `the state differs at checkpoint ${difference.checkpoint} of ${expected.length}${replayed.unknown > 0 ? `; the rebuild read input ${replayed.unknown} times at sites that the recording does not have` : ""}`
        : `the rebuild came to ${replayed.samples.length} of ${expected.length} checkpoints${replayed.problem === undefined ? "" : `: ${replayed.problem}`}`;
    const failed = result("FAIL", "rebuild", { ...base, compared: (difference?.checkpoint ?? replayed.samples.length + 1) - 1, reason, ...(difference === undefined ? {} : { firstDifference: difference }) });
    if (values.out !== undefined && difference !== undefined) {
      const files: string[] = [];
      for (const subject of [original, rebuild]) {
        const dumped = await side(subject, { compare: compare!, dump: difference.checkpoint, ...(subject.side === "rebuild" ? { pins } : {}) });
        const name = `${subject.side}-${difference.checkpoint}.bin`;
        writeProjectFile(`${values.out}/${name}`, dumped.ram!, { what: "--out" });
        files.push(name);
      }
      failed.files = files;
    }
    return failed;
  } finally {
    await core.close();
    workspace.remove();
  }
}

await runScript(
  async (argv) => {
    const result = await run(argv);
    process.exitCode = EXIT[result.result];
    return result;
  },
  { usage: USAGE },
);
