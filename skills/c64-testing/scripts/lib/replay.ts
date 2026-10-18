// The replay of c64-testing: replays a recording in the replay core
// (c64run). First on the original program, which must end with the recorded
// state hash. Then, with --rebuild, on the rebuild: it compares the state at
// each checkpoint with the original's. --checkpoint and --state choose the
// comparison, else the record file gave it.

import { createHash } from "node:crypto";

import { isRefusal, Refusal } from "#src/errors.ts";
import { readPrg } from "#src/host-client/image.ts";
import { readProjectFile, writeReported, type Written } from "#src/host-client/transfer.ts";
import { C64RunSession } from "#src/native/c64run.ts";
import { localToolContext } from "#src/native/local.ts";
import { Workspace } from "#src/native/staging.ts";
import { UsageError } from "#src/script.ts";
import { firstDifference, parseStateItem, pinLines, readRecording, replaySide, siteMap, type Comparison, type ReplayResult, type ReplaySubject } from "./recording.ts";
import { namesOf } from "./scenario.ts";

const MAX_STATE_ITEMS = 16;

export interface ReplayOptions {
  folder: string;
  checkpoint?: string;
  state: string[];
  pin: string[];
  rebuild?: string;
  symbols?: string;
  out?: string;
}

/** Replays the recording on the original, and with `rebuild` on the rebuild: PASS, FAIL or INCONCLUSIVE. */
export async function replay(values: ReplayOptions): Promise<ReplayResult> {
  if (values.symbols !== undefined && values.rebuild === undefined) throw new UsageError("--symbols is for the rebuild: give --rebuild too");
  if ((values.checkpoint === undefined) !== (values.state.length === 0)) throw new UsageError("give --checkpoint and --state together");
  if (values.state.length + values.pin.length > MAX_STATE_ITEMS) throw new UsageError(`give at most ${MAX_STATE_ITEMS} --state and --pin items`);
  if (values.pin.length > 0 && values.checkpoint === undefined) throw new UsageError("--pin needs --checkpoint and --state");
  const folder = values.folder.replace(/\/+$/, "").replace(/\/recording\.json$/, "");
  const recording = readRecording(folder);
  const given: Comparison | undefined =
    values.checkpoint === undefined ? undefined : { checkpoint: values.checkpoint, state: values.state.map((item) => parseStateItem(item, "--state")), ...(values.pin.length === 0 ? {} : { pin: values.pin.map((item) => parseStateItem(item, "--pin")) }) };
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
  // The files of the rebuild are checked before the replay core starts.
  for (const [option, check] of [["--rebuild", () => values.rebuild !== undefined && readPrg(values.rebuild)], ["--symbols", () => values.symbols !== undefined && namesOf(values.symbols)]] as const) {
    try {
      check();
    } catch (error) {
      if (isRefusal(error)) throw new Refusal(error.code, `${option}: ${error.message}`);
      throw error;
    }
  }
  const sha256 = createHash("sha256").update(readProjectFile(recording.program).bytes).digest("hex");
  if (sha256 !== recording.sha256) return result("INCONCLUSIVE", "original", { reason: `${recording.program} is not the program of the recording (its SHA-256 changed); record the session again` });

  const context = localToolContext();
  const core = await C64RunSession.open(context);
  const workspace = Workspace.create(context.supervisor, "c64-re-tools-replay-");
  try {
    // A recording made without names takes the names that the knowledge has now.
    const originalSymbols = recording.symbols === "none" ? "knowledge" : recording.symbols;
    const original: ReplaySubject = { side: "original", program: recording.program, symbols: originalSymbols };
    const side = (subject: ReplaySubject, options: Parameters<typeof replaySide>[5]) => replaySide(core, recording, folder, subject, workspace, options);
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
      movedSites = siteMap(recording.sites, namesOf(originalSymbols, "code"), namesOf(rebuild.symbols, "code")).length;
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
      const files: Written[] = [];
      for (const subject of [original, rebuild]) {
        const dumped = await side(subject, { compare: compare!, dump: difference.checkpoint, ...(subject.side === "rebuild" ? { pins } : {}) });
        files.push(writeReported(`${values.out}/${subject.side}-${difference.checkpoint}.bin`, dumped.ram!, { what: "--out" }));
      }
      failed.files = files;
    }
    return failed;
  } finally {
    await core.close();
    workspace.remove();
  }
}
