// The replay of c64-testing: replays a recording in the replay core
// (c64run). First on the reference program, which must end with the recorded
// state hash. Then, with --rebuild, on the rebuild: it compares the state at
// each checkpoint with the reference's. --checkpoint and --state choose the
// comparison, else the record file gave it.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import { symbolsPath } from "#src/build-name.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { readPrg } from "#src/host-client/image.ts";
import { readProjectFile, writeReported, type Written } from "#src/host-client/transfer.ts";
import { formatC64Address } from "#src/c64.ts";
import { encodePng } from "#src/graphics.ts";
import { LOADER_JUMP } from "#src/knowledge/start-screen.ts";
import { C64RunSession } from "#src/native/c64run.ts";
import { localToolContext } from "#src/native/local.ts";
import { Workspace } from "#src/native/staging.ts";
import { resolveProjectPath } from "#src/project.ts";
import { UsageError } from "#src/script.ts";
import { firstDifference, loaderEntry, mover, parseStateItem, pinLines, readRecording, replaySide, siteMap, type Comparison, type ReplayResult, type ReplaySubject } from "./recording.ts";
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
  /** A PNG file for the screen of the reference at the end of the session. */
  screen?: string;
}

/**
 * The names of the rebuild: the given symbol file, else the symbol file of its build when the build wrote one,
 * else the names of the reference. The labels of a loader and of a start screen are only in the build's own file.
 */
export function rebuildNames(rebuild: string, symbols: string | undefined, reference: string): string {
  if (symbols !== undefined) return symbols;
  const own = symbolsPath(rebuild);
  return existsSync(resolveProjectPath(own)) ? own : reference;
}

/** Replays the recording on the reference, and with `rebuild` on the rebuild: PASS, FAIL or INCONCLUSIVE. */
export async function replay(values: ReplayOptions): Promise<ReplayResult> {
  if (values.symbols !== undefined && values.rebuild === undefined) throw new UsageError("--symbols gives the names of the rebuild, and --rebuild is missing. Give --rebuild too, or leave out --symbols.");
  if ((values.checkpoint === undefined) !== (values.state.length === 0)) throw new UsageError("--checkpoint and --state go together. Give both of them, or neither.");
  if (values.state.length + values.pin.length > MAX_STATE_ITEMS) throw new UsageError(`There are more than ${MAX_STATE_ITEMS} --state and --pin items. Give at most ${MAX_STATE_ITEMS} of them.`);
  if (values.pin.length > 0 && values.checkpoint === undefined) throw new UsageError("--pin needs --checkpoint and --state. Give them too, or leave out --pin.");
  const folder = values.folder.replace(/\/+$/, "").replace(/\/recording\.json$/, "");
  const recording = readRecording(folder);
  const given: Comparison | undefined =
    values.checkpoint === undefined ? undefined : { checkpoint: values.checkpoint, state: values.state.map((item) => parseStateItem(item, "--state")), ...(values.pin.length === 0 ? {} : { pin: values.pin.map((item) => parseStateItem(item, "--pin")) }) };
  const compare = given ?? recording.compare;
  let screen: Written | undefined;
  if (values.rebuild !== undefined && compare === undefined) throw new UsageError("The recording has no checkpoint and state for --rebuild. Give --checkpoint and --state.");
  const result = (outcome: ReplayResult["result"], side: ReplayResult["side"], fields: Partial<ReplayResult> = {}): ReplayResult => ({
    result: outcome,
    recording: folder,
    side,
    ...(compare === undefined ? {} : { checkpoint: compare.checkpoint }),
    checkpoints: 0,
    compared: 0,
    ...(screen === undefined ? {} : { screen }),
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
  if (sha256 !== recording.sha256) return result("INCONCLUSIVE", "reference", { reason: `${recording.program} is not the program of the recording (its SHA-256 changed); record the session again` });

  const context = localToolContext();
  const core = await C64RunSession.open(context);
  const workspace = Workspace.create(context.supervisor, "c64-re-tools-replay-");
  try {
    // A recording made without names takes the names that the knowledge has now.
    const referenceSymbols = recording.symbols === "none" ? "knowledge" : recording.symbols;
    const reference: ReplaySubject = { side: "reference", program: recording.program, symbols: referenceSymbols };
    const side = (subject: ReplaySubject, options: Parameters<typeof replaySide>[5]) => replaySide(core, recording, folder, subject, workspace, options);
    const rebuildSymbols = values.rebuild === undefined ? referenceSymbols : rebuildNames(values.rebuild, values.symbols, referenceSymbols);
    const named = { symbols: rebuildSymbols };
    // A rebuild with a generated loader starts the program where its loader jumps to. The reference comes to that entry by the same name.
    // The checkpoints of both sides count from that entry, and at the entry the rebuild gets the raster position, the CIA timers and
    // the interrupt state of the reference, which the loader cannot set as the reference has them. A runUntil to an address counts
    // neither the code of the loader nor the code of the reference before the entry; another event before the entry has no point in
    // the rebuild, and the result is INCONCLUSIVE.
    let loader: { entry: number; reference: number } | undefined;
    if (values.rebuild !== undefined && !recording.load && namesOf(rebuildSymbols).has(LOADER_JUMP)) {
      const entry = await loaderEntry(core, recording, { side: "rebuild", program: values.rebuild, symbols: rebuildSymbols });
      if (typeof entry === "string") return result("FAIL", "rebuild", { ...named, reason: entry });
      loader = { entry, reference: mover(namesOf(rebuildSymbols, "code"), namesOf(referenceSymbols, "code"))(entry) };
    }
    // The self-check: the reference ends the session with the recorded state, to the cycle.
    const self = await side(reference, { ...(compare === undefined ? {} : { compare }), ...(loader === undefined ? {} : { entry: loader.reference }) });
    if (self.problem !== undefined) return result("INCONCLUSIVE", "reference", { reason: `the recording does not reproduce on the reference: ${self.problem}` });
    if (self.unknown > 0 || self.misses > 0) {
      return result("INCONCLUSIVE", "reference", { reason: `the recording does not reproduce on the reference: ${self.unknown + self.misses} input reads had no recorded value; record the session again with this version of the toolkit` });
    }
    if (self.end.tick !== recording.ticks || self.end.hash !== recording.hash) {
      return result("INCONCLUSIVE", "reference", { reason: "the recording does not reproduce on the reference: the state at its end is different; record the session again with this version of the toolkit" });
    }
    // The core is still at the end of the session: the rebuild side starts it again.
    if (values.screen !== undefined) {
      const shot = await core.screen();
      screen = writeReported(values.screen, encodePng(shot.frame, shot.palette), { what: "--screen" });
    }
    const expected = self.samples;
    if (compare !== undefined && expected.length === 0) return result("INCONCLUSIVE", "reference", { reason: `the reference never came to the checkpoint ${compare.checkpoint} in the session` });
    if (values.rebuild === undefined) return result("PASS", "reference", { checkpoints: expected.length });
    let handover: { entry: number; reference: NonNullable<typeof self.entryPoint> } | undefined;
    if (loader !== undefined) {
      const entered = self.entryPoint;
      const at = formatC64Address(loader.reference);
      if (entered === undefined) return result("INCONCLUSIVE", "reference", { reason: `the reference never came to ${at}, where the loader of the rebuild jumps` });
      // An event before the entry has no point in a rebuild with a loader. A runUntil to an address there does nothing, and the rebuild leaves it out.
      const early = recording.events.slice(0, entered.eventsBefore).find((event) => !("pc" in event.key));
      if (early !== undefined) {
        const what = early.step === undefined ? "the RESTORE of the play" : `step ${early.step}`;
        return result("INCONCLUSIVE", "reference", { reason: `${what} ran before the program came to its entry ${at}. A rebuild with a loader has no point for it. Make the steps of the record file start after the entry` });
      }
      handover = { entry: loader.entry, reference: entered };
    }

    const rebuild: ReplaySubject = { side: "rebuild", program: values.rebuild, symbols: rebuildSymbols };
    let movedSites: number;
    try {
      movedSites = siteMap(recording.sites, namesOf(referenceSymbols, "code"), namesOf(rebuild.symbols, "code")).length;
    } catch (error) {
      throw new UsageError(`--symbols ${rebuild.symbols}: ${(error as Error).message}`);
    }
    const pins = pinLines(expected, compare!.state);
    const replayed = await side(rebuild, { compare: compare!, stop: expected.length, pins, ...(handover === undefined ? {} : { handover }) });
    const difference = firstDifference(expected, replayed.samples, compare!.state);
    // A read that the recording has no value for gets the idle value: it is in the result, never silent.
    const base = { checkpoints: expected.length, ...named, movedSites, ...(replayed.startScreenSkipped === true ? { startScreen: "skipped" } : {}), ...(replayed.unknown > 0 ? { idleReads: replayed.unknown } : {}) };
    if (difference === undefined && replayed.samples.length >= expected.length) return result("PASS", "rebuild", { ...base, compared: expected.length });
    const reason =
      difference !== undefined
        ? `the state differs at checkpoint ${difference.checkpoint} of ${expected.length}${replayed.unknown > 0 ? `; the rebuild read input ${replayed.unknown} times at sites that the recording does not have` : ""}`
        : `the rebuild came to ${replayed.samples.length} of ${expected.length} checkpoints${replayed.problem === undefined ? "" : `: ${replayed.problem}`}`;
    const failed = result("FAIL", "rebuild", { ...base, compared: (difference?.checkpoint ?? replayed.samples.length + 1) - 1, reason, ...(difference === undefined ? {} : { firstDifference: difference }) });
    if (values.out !== undefined && difference !== undefined) {
      const files: Written[] = [];
      for (const subject of [reference, rebuild]) {
        // The reference also stops at the checkpoints before its entry, which its samples leave out.
        const dump = difference.checkpoint + (subject.side === "reference" ? (handover?.reference.samplesBefore ?? 0) : 0);
        const dumped = await side(subject, { compare: compare!, dump, ...(subject.side === "rebuild" ? { pins, ...(handover === undefined ? {} : { handover }) } : {}) });
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

