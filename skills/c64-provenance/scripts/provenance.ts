// The c64-provenance script: compares two or more releases byte by byte at
// their addresses and reports where they differ and which releases agree. A
// release is a PRG or an unpacker image.json. With --run, each release
// runs in its own emulator, and each listed difference gets its first access
// and whether the run changed it. The separate command gives evidence from
// the program in the knowledge, and the leftovers command lists what its
// unused bytes hold: text, BASIC lines, fills and copies. The routine and match commands keep
// routines that several programs share in a library folder and find them in the
// program (D71).

import { basename } from "node:path";

import { type AddressRange, c64AddressOf, formatC64Address, parseC64Address } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";
import { parseEntryState, type EntryState } from "#src/host-client/entry-state.ts";
import { readImage } from "#src/host-client/image.ts";
import { readActionSteps, type ActionStep } from "#src/host-client/steps.ts";
import { MAX_EXECUTION_COUNT } from "#src/host-client/tools.ts";
import { writeReported } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { openForRead, withWrite } from "#src/knowledge/database.ts";
import { operandImages, programCoverage, requireProgram } from "#src/knowledge/program.ts";
import { applyBatch, type BatchOperation } from "#src/knowledge/write.ts";
import {
  commentsAt,
  currentRevision,
  listComments,
  listModules,
  listOperands,
  listReferences,
  listRegions,
  listSymbols,
  operandAt,
  referencesFrom,
  referenceSuppressed,
  regionsOverlapping,
  suppressionsOverlapping,
  symbolAt,
  symbolNamed,
  symbolSuppressed,
} from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, DEFAULT_SPACE, SEMANTIC_ORIGINS } from "#src/knowledge/schema.ts";
import { platformNames } from "#src/platform.ts";
import { projectRoot } from "#src/project.ts";
import { knowledgeAt, knowledgeNames } from "#src/knowledge/names.ts";
import { listed, OPTIONS, reply, runScript, UsageError, type Call, type CommandSpec } from "#src/script.ts";
import { align, compareReleases, identicalShare, shiftSuggestion, suggestShifts, type Release } from "./lib/compare.ts";
import { findRoutine, libraryFolder, readLibrary, routineFrom, saveRoutine, suggest, type BatchWrite } from "./lib/library.ts";
import { watchRelease, type Start } from "./lib/runtime.ts";
import { findLeftovers } from "./lib/leftovers.ts";
import { separate, type Root } from "#src/knowledge/separate.ts";

const hexBytes = (bytes: number[]) => Buffer.from(bytes).toString("hex").replace(/(..)(?!$)/g, "$1 ");

interface LoadedRelease {
  release: Release;
  shift: number;
  start: Start | { kind: "none"; reason: string };
  /** 64 KiB with the release bytes at their own addresses. */
  memory: Uint8Array;
  entry?: number;
  stages?: Array<{ entry: number; wrote: AddressRange[] }>;
}

/**
 * A release to compare: "knowledge" (the program of the knowledge, with its
 * entry state and stages), a PRG at its load address, or an image.json of an
 * unpacked program (a capture) with the entry_state.json beside it.
 */
function readRelease(name: string, shift: number): LoadedRelease {
  const moved = (range: AddressRange) => ({ start: range.start + shift, end: range.end + shift });
  const inside = (range: AddressRange) => range.start >= 0 && range.end <= 0xffff;
  let image: { segments: AddressRange[]; byteAt: (address: number) => number; memory?: Uint8Array; entry?: number; stages?: Array<Record<string, unknown>>; state?: EntryState };
  let noState: string;
  if (name === "knowledge") {
    const db = openForRead();
    try {
      const program = requireProgram(db);
      image = { ...program, ...(program.state === undefined ? {} : { state: parseEntryState(program.state, "the entry state of the knowledge") }) } as typeof image;
    } finally {
      db?.close();
    }
    noState = "The knowledge has no entry state. Put a capture of the unpacked program, with its entry state, into the project knowledge.";
  } else {
    image = readImage(name);
    noState = "It has no entry_state.json beside it. Capture the unpacked program again, with its entry state.";
  }
  const segments = image.segments.map(moved);
  if (!segments.every(inside)) throw new UsageError(`The shift moves ${name} outside $0000-$ffff.`, { hint: "Give a shift that keeps each segment of the release in $0000-$ffff." });
  const memory = image.memory ?? new Uint8Array(0x10000);
  if (image.memory === undefined) for (const segment of image.segments) for (let at = segment.start; at <= segment.end; at++) memory[at] = image.byteAt(at);
  const prg = name !== "knowledge" && !name.endsWith(".json");
  const stages = stagesOf(image.stages, name);
  return {
    release: { name, segments, byteAt: (at) => memory[at - shift]! },
    shift,
    start: prg ? { kind: "program", path: name } : image.state === undefined ? { kind: "none", reason: noState } : { kind: "image", segments: image.segments, byteAt: (at) => memory[at]!, state: image.state },
    memory,
    ...(image.entry === undefined ? {} : { entry: image.entry }),
    ...(stages === undefined ? {} : { stages }),
  };
}

/** Most blocks and ranges that a list of --align shows. */
const MAX_ALIGNED = 64;

/** compare: the releases byte by byte, with --align a map of two releases in blocks, and with --frames the first access of each difference in each release. */
async function compare(call: Call): Promise<unknown> {
  const positionals = call.subjects;
  if (positionals.length < 2) throw new UsageError("compare needs two or more releases.", { hint: "Give the paths of two or more releases, or knowledge for the program in the knowledge." });
  const shifts = new Map<number, number>();
  for (const text of call.strings("shift")) {
    const match = /^(\d+):([+-]?\d+)$/.exec(text);
    if (match === null) throw new UsageError(`--shift must be <release>:<bytes>, for example 2:-256, not ${text}.`);
    if (Number(match[1]) < 1 || Number(match[1]) > positionals.length) {
      throw new UsageError(`--shift ${text}: there is no release ${match[1]}. This compare has ${positionals.length} releases: give a release number from 1 to ${positionals.length}.`);
    }
    if (shifts.has(Number(match[1]))) throw new UsageError(`--shift gives release ${match[1]} more than one shift (${shifts.get(Number(match[1]))} and ${match[2]}). Give one --shift for each release.`);
    shifts.set(Number(match[1]), Number(match[2]));
  }
  const frames = call.count("frames");
  const stepsFile = call.string("steps");
  if (stepsFile !== undefined && frames === undefined) throw new UsageError("--steps works only with --frames.", { hint: "Add --frames <n>, or remove --steps." });
  const aligned = call.flag("align");
  const minBlock = call.count("min-block");
  if (minBlock !== undefined && !aligned) throw new UsageError("--min-block works only with --align.", { hint: "Add --align, or remove --min-block." });
  if (aligned) {
    if (shifts.size > 0) throw new UsageError("--align does not work with --shift: --align finds the shift of each block itself.", { hint: "Remove --shift." });
    if (frames !== undefined) throw new UsageError("--align does not work with --frames: --align gives no differences to run.", { hint: "Run --frames without --align." });
    if (positionals.length !== 2) throw new UsageError(`--align maps two releases, not ${positionals.length}.`, { hint: "Give two releases." });
  }
  const steps: ActionStep[] = stepsFile === undefined ? [] : readActionSteps(stepsFile, "--steps", knowledgeAt());
  const loaded = positionals.map((path, index) => readRelease(path, shifts.get(index + 1) ?? 0));
  const releases = loaded.map((item) => item.release);
  const range = call.range("range");
  const comparison = compareReleases(releases, range === undefined ? {} : { from: range.start, to: range.end });
  const share = identicalShare(comparison.identicalBytes, comparison.differingBytes);
  const show = (range: AddressRange) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) });
  const compared = {
    releases: loaded.map((item) => ({ name: item.release.name, shift: item.shift, segments: item.release.segments.map(show) })),
    common: comparison.common.map(show),
    identicalBytes: comparison.identicalBytes,
    differingBytes: comparison.differingBytes,
    identicalShare: share,
  };
  if (aligned) {
    // Code added and data moved: one shift for the release cannot fit, so each block of equal bytes gets its own.
    const alignment = align(releases[0]!, releases[1]!, range ?? { start: 0x0000, end: 0xffff }, minBlock ?? 16);
    const capped = <T>(name: string, items: T[]) => ({ [name]: items.slice(0, MAX_ALIGNED), ...(items.length > MAX_ALIGNED ? { [`more${name[0]!.toUpperCase()}${name.slice(1)}`]: items.length - MAX_ALIGNED } : {}) });
    const mapped = {
      ...compared,
      alignedShare: alignment.alignedShare,
      ...capped("blocks", alignment.blocks.map((block) => ({ a: show(block.a), b: show(block.b), shift: block.shift, bytes: block.bytes }))),
      ...capped("onlyInA", alignment.onlyInA.map(show)),
      ...capped("onlyInB", alignment.onlyInB.map(show)),
    };
    const cut = alignment.blocks.length > MAX_ALIGNED || alignment.onlyInA.length > MAX_ALIGNED || alignment.onlyInB.length > MAX_ALIGNED;
    return cut ? reply(mapped, { hint: `A list holds only its first ${MAX_ALIGNED} items: moreBlocks, moreOnlyInA and moreOnlyInB count the others. Give --range to map a part of the releases.` }) : mapped;
  }
  // A poor match at the load addresses can mean that the releases are placed differently.
  // Each release gets its best shifts: data that stayed can outvote code that moved, so one is not enough.
  const applied = loaded.map((item) => item.shift);
  const suggestions =
    share < 0.5
      ? releases.slice(1).flatMap((release, index) =>
          suggestShifts(releases[0]!, release).map((found) => {
            const suggestion = shiftSuggestion(releases, applied, index + 1, found);
            // The shift that the run already has: its votes tell how good the present alignment is.
            return "shift" in suggestion && suggestion.shift === applied[suggestion.release - 1] ? { ...suggestion, current: true } : suggestion;
          }),
        )
      : [];
  const suggested = suggestions.filter((suggestion) => "shift" in suggestion);
  const notSuggested = suggestions.filter((suggestion) => "reason" in suggestion);

  // The runtime evidence: one emulator for each release, the differences at the release's own addresses.
  const runtime = new Map<string, Array<AddressRange & { first: string; changed: boolean }>>();
  const runs: Record<string, unknown> = {};
  if (frames !== undefined && comparison.differences.length > 0) {
    for (const item of loaded) {
      const name = item.release.name;
      if (item.start.kind === "none") {
        runs[name] = { started: false, reason: item.start.reason };
        continue;
      }
      const ranges = comparison.differences.map((difference) => ({ start: difference.start - item.shift, end: difference.end - item.shift }));
      const client = await ViceSessionClient.open({ videoStandard: "pal" });
      try {
        const watched = await watchRelease(client, item.start, ranges, (at) => item.release.byteAt(at + item.shift), { frames, steps });
        if (!watched.started) runs[name] = { started: false, reason: watched.reason };
        else {
          runs[name] = { started: true };
          runtime.set(name, watched.accesses.map((access, index) => ({ ...ranges[index]!, ...access })));
        }
      } finally {
        await client.close();
      }
    }
  }

  // The next compare: the best suggested shift that the run does not have yet, else --align for two releases.
  const rangeArgs = range === undefined ? [] : ["--range", `${formatC64Address(range.start)}-${formatC64Address(range.end)}`];
  const runArgs = frames === undefined ? [] : ["--frames", String(frames), ...(stepsFile === undefined ? [] : ["--steps", stepsFile])];
  const best = suggested.find((suggestion) => !("current" in suggestion));
  const hints: string[] = [];
  let nextAction: string | undefined;
  if (best !== undefined && "shift" in best) {
    const next = [...applied];
    next[best.release - 1] = best.shift;
    const shiftArgs = next.flatMap((shift, index) => (shift === 0 ? [] : ["--shift", `${index + 1}:${shift}`]));
    hints.push("identicalShare is low: the releases can be at different addresses. nextAction runs compare with the first suggested shift. Try each shift in suggestedShifts. If no shift gives a high identicalShare, run compare with --align.");
    nextAction = call.next("compare", ...positionals, ...shiftArgs, ...rangeArgs, ...runArgs);
  } else if (share < 0.5 && positionals.length === 2 && shifts.size === 0 && frames === undefined) {
    hints.push("identicalShare is low, and no suggested shift is better. The code and the data can be at other addresses in each release. Map the releases in blocks with --align.");
    nextAction = call.next("compare", ...positionals, "--align", ...rangeArgs);
  }
  if (comparison.moreDifferences) hints.push("differences holds only the first differences. Give --range to compare a part of the releases.");
  const body = {
    ...compared,
    differences: comparison.differences.map((difference, index) => ({
      start: formatC64Address(difference.start),
      end: formatC64Address(difference.end),
      values: Object.fromEntries(Object.entries(difference.values).map(([name, bytes]) => [name, hexBytes(bytes.slice(0, 32)) + (bytes.length > 32 ? " ..." : "")])),
      groups: difference.groups,
      // runtime gives the release's own addresses: with a shift, they are not the addresses of the difference.
      ...(runtime.size === 0
        ? {}
        : {
            runtime: Object.fromEntries(
              [...runtime].map(([name, accesses]) => {
                const { start, end, first, changed } = accesses[index]!;
                return [name, { start: formatC64Address(start), end: formatC64Address(end), first, changed }];
              }),
            ),
          }),
    })),
    ...(comparison.moreDifferences ? { moreDifferences: true } : {}),
    ...(suggested.length > 0 ? { suggestedShifts: suggested } : {}),
    ...(notSuggested.length > 0 ? { shiftsNotSuggested: notSuggested } : {}),
    ...(frames === undefined
      ? {}
      : { run: { frames, steps: steps.length, releases: runs, ...(comparison.differences.length === 0 ? { skipped: "The releases have no differences, so no release ran." } : {}) } }),
  };
  return hints.length === 0 && nextAction === undefined ? body : reply(body, { ...(hints.length === 0 ? {} : { hint: hints.join(" ") }), nextAction });
}

/** The stages of a capture as ranges; a stage that is not a capture stage is refused. `where` names the capture. */
function stagesOf(stages: Array<Record<string, unknown>> | undefined, where = "the program in the knowledge"): Array<{ entry: number; wrote: AddressRange[] }> | undefined {
  if (stages === undefined) return undefined;
  const parse = (value: unknown) => {
    const at = typeof value === "string" ? c64AddressOf(value) : undefined;
    if (at !== undefined) return at;
    throw new Refusal("invalid-input", `The stages of ${where} are not the stages of a capture.`, { hint: "Capture the unpacked program again, with its stages, and put the capture into the project knowledge." });
  };
  return stages.map((stage) => ({
    entry: parse(stage.entry),
    wrote: (Array.isArray(stage.wrote) ? (stage.wrote as Array<Record<string, unknown>>) : []).map((range) => ({ start: parse(range.start), end: parse(range.end) })),
  }));
}

/** The program in the knowledge with its stages and coverage, and the separation of its bytes. */
function programEvidence() {
  const db = openForRead();
  let program: ReturnType<typeof requireProgram>;
  let coverage: Uint8Array | undefined;
  let regions: ReturnType<typeof listRegions>;
  let references: ReturnType<typeof listReferences>;
  try {
    program = requireProgram(db);
    coverage = programCoverage(db)?.map;
    regions = listRegions(db).filter((region) => CODE_REGION_TYPES.includes(region.type));
    references = listReferences(db);
  } finally {
    db?.close();
  }
  const stages = stagesOf(program.stages);
  const found = separate({
    segments: program.segments,
    memory: program.memory,
    ...(program.entry === undefined ? {} : { entry: program.entry }),
    ...(stages === undefined ? {} : { stages }),
    ...(coverage === undefined ? {} : { coverage }),
    codeRegions: regions,
    references,
  });
  return { program, stages, coverage, found };
}

/** The roots of the reachability as a person reads them. */
const showRoots = (roots: readonly Root[]) => roots.map((root) => ({ address: formatC64Address(root.address), from: root.from }));

const NO_ROOTS = "none: the program in the knowledge has no entry, and the image does not hold the hardware vectors at $fffa-$ffff, so no code region is reachable or unreachable.";

const NO_STAGES = "The program in the knowledge has no stage log. Only a capture of the unpack stages gives one. A capture of the loads of a loader holds one part of a program and has none.";

/** separate: evidence from the program in the knowledge, with all ranges in --out and the first ones in the result. */
function separateCommand(call: Call): unknown {
  const out = call.string("out");
  const max = call.count("max-listed")!;
  const { program, stages, coverage, found } = programEvidence();
  const loaded = { entry: program.entry, stages };
  const show = (range: AddressRange) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) });
  const ranges = found.ranges.map((range) => ({ ...show(range), ...(range.stage === undefined ? {} : { stage: range.stage }), ...(range.access === undefined ? {} : { access: range.access }) }));
  const codeRegions = found.codeRegions.map((region) => ({ ...show(region), type: region.type, ...(region.reachable === undefined ? {} : { reachable: region.reachable }), ...(region.executed === undefined ? {} : { executed: region.executed }) }));
  const outside = { read: found.outside.read.map(show), executed: found.outside.executed.map(show), generated: found.outside.generated.map(show) };
  const roots = showRoots(found.roots);
  const written = out === undefined ? undefined : writeReported(out, `${JSON.stringify({ roots, ranges, codeRegions, outside }, null, 1)}\n`, { what: "--out" });
  const list = <T>(items: T[]) => listed(items, max, undefined, out ?? "a larger --max-listed, or --out <file>");
  const bytes = (filter: (range: (typeof found.ranges)[number]) => boolean) => found.ranges.filter(filter).reduce((sum, range) => sum + range.end - range.start + 1, 0);
  const lastStage = loaded.stages === undefined ? undefined : loaded.stages.length - 1;
  const body = {
    ...(loaded.entry === undefined ? {} : { entry: formatC64Address(loaded.entry) }),
    ...(lastStage === undefined
      ? { noStages: NO_STAGES }
      : {
          stages: lastStage + 1,
          bytesByStage: Object.fromEntries([...[...Array(lastStage + 1).keys()].map((stage): [string, number] => [String(stage), bytes((range) => range.stage === stage)]), ["none", bytes((range) => range.stage === undefined)]]),
        }),
    ...(coverage === undefined ? {} : { bytesByAccess: Object.fromEntries((["executed", "read", "written", "read-written", "untouched"] as const).map((access) => [access, bytes((range) => range.access === access)])) }),
    ranges: list(ranges),
    // The roots of the reachability: the entry and the hardware vectors in the image.
    roots: roots.length === 0 ? NO_ROOTS : roots,
    // total counts every code region; unreachable is a list like the others.
    codeRegions: {
      total: codeRegions.length,
      ...(roots.length === 0 ? {} : { unreachable: list(codeRegions.filter((region) => region.reachable === false)) }),
    },
    ...(coverage === undefined ? {} : { outside: { read: list(outside.read), executed: list(outside.executed), generated: list(outside.generated) } }),
    ...(written === undefined ? {} : written),
  };
  return withFile(body, out);
}

/** True when a list of the body ({count, listed}) holds fewer items than its count. */
function hasCutList(value: unknown, depth = 0): boolean {
  if (typeof value !== "object" || value === null || depth > 3) return false;
  const { count, listed: items } = value as { count?: unknown; listed?: unknown };
  if (typeof count === "number" && Array.isArray(items)) return items.length < count;
  return Object.values(value).some((item) => hasCutList(item, depth + 1));
}

/** The note for a cut list: with --out, the file holds all items; without it, a larger --max-listed or --out gives them. */
function cutNote(body: unknown, out: string | undefined): string | undefined {
  if (!hasCutList(body)) return undefined;
  return out === undefined ? "A list in the body is cut: count gives its full size. To get the rest, give a larger --max-listed." : `A list in the body is cut: count gives its full size. ${out} holds all items.`;
}

/** A body with the note for a cut list when --out holds all items. Without --out, the envelope gives the note itself. */
function withFile(body: unknown, out: string | undefined): unknown {
  const note = out === undefined ? undefined : cutNote(body, out);
  return note === undefined ? body : reply(body, { hint: note });
}

/** The longest text that the result shows; --out has all of it. */
const SHOWN_TEXT = 120;

/** leftovers: what the program in the knowledge holds besides its working code, with all findings in --out and the first ones in the result. */
function leftoversCommand(call: Call): unknown {
  const out = call.string("out");
  const max = call.count("max-listed")!;
  const min = call.count("min-text")!;
  const { program, stages, coverage, found } = programEvidence();
  const leftovers = findLeftovers({
    segments: program.segments,
    memory: program.memory,
    separation: found,
    ...(program.segments.some((segment) => segment.start === 0x0801) ? { basicStart: 0x0801 } : {}),
    minText: min,
  });
  const show = <T extends AddressRange & { stages?: number[]; access?: string[] }>({ start, end, stages: wrote, access, ...rest }: T) => ({
    start: formatC64Address(start),
    end: formatC64Address(end),
    ...rest,
    ...(wrote === undefined ? {} : { stages: wrote }),
    ...(access === undefined ? {} : { access }),
  });
  const all = {
    text: leftovers.text.map(show),
    basic: leftovers.basic.map(({ linkedAt, ...rest }) => ({ ...show(rest), linkedAt: formatC64Address(linkedAt) })),
    fill: leftovers.fill.map(({ pattern, ...rest }) => ({ ...show(rest), pattern: hexBytes(pattern) })),
    residue: leftovers.residue.map((range) => ({ ...show(range), bytes: hexBytes([...program.memory.subarray(range.start, Math.min(range.end, range.start + 15) + 1)]) + (range.end - range.start >= 16 ? " ..." : "") })),
    copies: leftovers.copies.map(({ copyOf, ...rest }) => ({ ...show(rest), copyOf: formatC64Address(copyOf) })),
    deadCode: leftovers.deadCode.map(show),
  };
  const written = out === undefined ? undefined : writeReported(out, `${JSON.stringify(all, null, 1)}\n`, { what: "--out" });
  const list = <T>(items: T[]) => listed(items, max, undefined, out ?? "a larger --max-listed, or --out <file>");
  const body = {
    ...(program.entry === undefined ? {} : { entry: formatC64Address(program.entry) }),
    roots: found.roots.length === 0 ? NO_ROOTS : showRoots(found.roots),
    ...(stages === undefined ? { noStages: NO_STAGES } : { stages: stages.length }),
    ...(coverage === undefined ? { noCoverage: "The knowledge has no coverage, so residue is empty and no finding has access. Put the coverage of runs into the project knowledge." } : {}),
    text: list(all.text.map((item) => (item.text.length > SHOWN_TEXT ? { ...item, text: `${item.text.slice(0, SHOWN_TEXT)} ...`, length: item.text.length } : item))),
    basic: list(all.basic),
    fill: list(all.fill),
    residue: list(all.residue),
    copies: list(all.copies),
    deadCode: list(all.deadCode),
    ...(written === undefined ? {} : written),
  };
  return withFile(body, out);
}

const platform = () => new Map(platformNames().map((entry) => [entry.name, entry.address]));

/** routine: saves a module or a range of the program in the knowledge, with its knowledge, as a routine of the library (D71). */
function routineCommand(call: Call): unknown {
  const given = call.subject(0);
  const library = call.string("library")!;
  const db = openForRead();
  try {
    const image = requireProgram(db);
    const segmentOf = (at: number) => image.segments.find((segment) => at >= segment.start && at <= segment.end);
    let start: number;
    let end: number;
    let title = call.string("title");
    if (!given.includes("-")) {
      start = call.parseAddress(given, "<module>");
      const modules = listModules(db);
      const module = modules.find((item) => item.start === start);
      if (module === undefined) throw new Refusal("not-found", `No module starts at ${formatC64Address(start)}. List the modules of the project knowledge, or give a range <start>-<end>.`);
      const segment = segmentOf(start);
      if (segment === undefined) throw new UsageError(`The module at ${formatC64Address(start)} is outside the segments of the program.`, { hint: "Give a range <start>-<end> in one segment of the program." });
      end = (modules.find((item) => item.start > start && item.start <= segment.end)?.start ?? segment.end + 1) - 1;
      title ??= module.title;
    } else {
      ({ start, end } = call.parseRange(given, "<range>"));
      if (segmentOf(start) === undefined || segmentOf(start) !== segmentOf(end)) throw new UsageError(`${formatC64Address(start)}-${formatC64Address(end)} is not inside one segment of the program.`, { hint: "Give a range in one segment of the program." });
    }
    const range = { start, end };
    const name = call.string("name") ?? listSymbols(db, { start, end: start }, undefined, SEMANTIC_ORIGINS)[0]?.name;
    if (name === undefined) throw new UsageError(`The knowledge has no user or LLM name at ${formatC64Address(start)}.`, { hint: "Give --name <name>, or name the start of the routine in the project knowledge first." });
    const { routine, leftOut } = routineFrom({
      name,
      ...(title === undefined ? {} : { title }),
      program: basename(projectRoot()),
      image: `knowledge revision ${currentRevision(db)}`,
      start,
      end,
      byteAt: image.byteAt,
      analyzed: listRegions(db, range),
      symbols: listSymbols(db, range, undefined, SEMANTIC_ORIGINS),
      regions: listRegions(db, range, undefined, SEMANTIC_ORIGINS),
      comments: listComments(db, range, SEMANTIC_ORIGINS),
      references: listReferences(db, range, undefined, SEMANTIC_ORIGINS),
      operands: listOperands(db, range, SEMANTIC_ORIGINS),
      platform: platform(),
    });
    const written = saveRoutine(libraryFolder(library, { create: true, cwd: projectRoot() }), routine, call.flag("replace"), projectRoot());
    return {
      routine: routine.name,
      ...written,
      start: formatC64Address(start),
      end: formatC64Address(end),
      length: routine.bytes.length,
      instructions: routine.instructions.length,
      relocations: routine.relocations.length,
      variable: routine.variable.length,
      counts: { symbols: routine.symbols.length, regions: routine.regions.length, comments: routine.comments.length, references: routine.references.length, operands: routine.operands.length },
      ...(leftOut.length === 0 ? {} : { leftOut }),
    };
  } finally {
    db?.close();
  }
}

/**
 * match: finds the routines of the library in the program of the knowledge,
 * and shows the changes that give the program their names. With --apply it
 * writes the changes to the knowledge as one revision.
 */
function matchCommand(call: Call): unknown {
  const library = call.string("library")!;
  const apply = call.flag("apply");
  const max = call.count("max-listed")!;
  const list = <T>(items: T[]) => listed(items, max);
  const routines = readLibrary(libraryFolder(library, { create: false, cwd: projectRoot() }));
  if (routines.length === 0) throw new Refusal("not-found", `The library ${library} has no routine files. Save a routine with routine first.`);
  const programDb = openForRead();
  let image: ReturnType<typeof requireProgram>;
  try {
    image = requireProgram(programDb);
  } finally {
    programDb?.close();
  }
  const found = routines.map((routine) => ({ routine, matches: findRoutine(routine, image) }));
  const show = (value: number, size: 1 | 2) => `$${value.toString(16).padStart(2 * size, "0")}`;
  const matches = found
    .flatMap(({ routine, matches: each }) =>
      each.map((match) => ({
        routine: match.routine,
        start: formatC64Address(match.start),
        end: formatC64Address(match.start + routine.bytes.length - 1),
        shift: match.shift,
        differing: match.differing.map((operand) => ({ address: formatC64Address(operand.address), library: show(operand.library, operand.size), program: show(operand.program, operand.size) })),
      })),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const result: Record<string, unknown> = { library, routines: routines.length, matches: list(matches) };
  const noMatch = "No routine of the library is in the program. A packed program can hold a routine in a packed form. Unpack the program, put the unpacked program into the project knowledge, and run match again.";
  const withNote = (shown: unknown, hint: string) => [cutNote(shown, undefined), hint].filter((part) => part !== undefined).join(" ");
  if (matches.length === 0) return reply(result, { hint: noMatch });
  const db = openForRead();
  let suggestions: ReturnType<typeof suggest>;
  try {
    suggestions = suggest(
      found,
      {
        symbolAt: (at) => symbolAt(db, at),
        symbolNamed: (name) => symbolNamed(db, name),
        regionsOverlapping: (start, end) => regionsOverlapping(db, start, end),
        commentsAt: (at) => commentsAt(db, at),
        referencesFrom: (at) => referencesFrom(db, at),
        operandAt: (at) => operandAt(db, at),
        symbolSuppressed: (at) => symbolSuppressed(db, at),
        regionSuppressed: (start, end) => suppressionsOverlapping(db, "region", start, end).length > 0,
        referenceSuppressed: (reference) => referenceSuppressed(db, reference),
      },
      image,
      platform(),
    );
  } finally {
    db?.close();
  }
  const { writes, known, leftOut, check } = suggestions;
  const changes: Record<string, unknown> = { writes: list(writes), known, leftOut: list(leftOut), check: list(check) };
  const body = { ...result, changes };
  if (writes.length === 0) return reply(body, { hint: withNote(body, "There are no changes. The project knowledge has the names of the found routines already, or changes.leftOut tells why the script left out a write.") });
  const review = check.length === 0 ? "" : " Then examine changes.check: each comment there gives an address outside its routine, which can be different in this program. Correct such a comment in the project knowledge.";
  if (!apply) {
    return reply(body, { hint: withNote(body, `Examine differing of each match, and changes.writes and changes.leftOut. Then nextAction writes the changes to the project knowledge.${review}`), nextAction: call.next("match", "--library", library, "--apply") });
  }
  const platformNamed = new Map(platformNames().map((entry) => [entry.name, entry.address]));
  const applied = withWrite((write) => applyBatch(write, { origin: "llm", description: `Names of the routines of the library ${library}`, image: operandImages(write, platformNamed) }, writes.map(toOperation)));
  changes.revision = applied.revision;
  return reply(body, { hint: withNote(body, `The project knowledge has the changes in revision ${applied.revision}.${review}`) });
}

/** A change of match as a write of the knowledge: its addresses as numbers, in the C64 space. */
function toOperation(write: BatchWrite): BatchOperation {
  const parsed: Record<string, unknown> = { ...write, space: DEFAULT_SPACE };
  for (const key of ["address", "start", "end", "from", "to"]) if (typeof write[key] === "string") parsed[key] = parseC64Address(write[key]);
  return parsed as unknown as BatchOperation;
}

const LIBRARY = { kind: "text", value: "<folder>", required: true, help: "the library: a plain folder of routine files beside the projects, relative to the project folder, for example ../library" } as const;

const COMMANDS: CommandSpec[] = [
  {
    name: "compare",
    summary: "Compares releases byte by byte, in their common ranges, and suggests shifts when they are placed differently. With --align, maps two releases with moved code in blocks of equal bytes, each with its own shift.",
    subjects: [{ name: "<release>", help: "knowledge (the program in the knowledge), a PRG at its load address, or the image.json of a capture of the unpacked program with the entry_state.json beside it. Two or more", list: true }],
    options: {
      shift: {
        kind: "text",
        value: "<release>:<bytes>",
        multiple: true,
        help: "move a release (1 is the first) by a number of bytes, for example 2:-256",
        // A bare number is the bytes: the example puts it after a release.
        example: (given) => `2:${given !== undefined && /^-\d+$/.test(given) ? given : "-256"}`,
      },
      range: { ...OPTIONS.range, help: "compare only the addresses from start to end" },
      align: { kind: "flag", help: "map the first release to the second in blocks of equal bytes, each with its own shift, for releases with added code and moved data. Two releases; not with --shift or --frames" },
      "min-block": { kind: "count", value: "<n>", min: 8, max: 0x10000, help: "with --align: the fewest bytes in a block (default 16)" },
      frames: { ...OPTIONS.frames, max: MAX_EXECUTION_COUNT, help: "run each release in its own emulator for n frames, and give each listed difference its first access and whether it changed" },
      steps: { ...OPTIONS.steps, help: "with --frames: action steps (JSON) to run before the frames" },
    },
    run: compare,
  },
  {
    name: "separate",
    summary: "Evidence from the program in the knowledge: the unpack stage that wrote each range, its access in the coverage, whether call and jump references, or the run on from the code before it, reach each code region from the entry, and what the program reads or executes outside its segments.",
    options: { out: { ...OPTIONS.out, output: "file", value: "<file>", help: "write all ranges to this file" }, "max-listed": OPTIONS["max-listed"] },
    run: separateCommand,
  },
  {
    name: "leftovers",
    summary: "What the program in the knowledge holds besides its working code: texts in PETSCII, screen codes, ASCII or with bit 7 set (Apple II), assembler source, BASIC lines away from the BASIC start, fills, untouched bytes outside code, copies of earlier bytes, and code regions that nothing reaches and no run executed.",
    options: {
      out: { ...OPTIONS.out, output: "file", value: "<file>", help: "write all findings to this file" },
      "min-text": { kind: "count", value: "<n>", min: 4, max: 999, default: 8, help: "the shortest text to find (default 8)" },
      "max-listed": OPTIONS["max-listed"],
    },
    run: leftoversCommand,
  },
  {
    name: "routine",
    summary: "Saves a routine of the program in the knowledge to a library, with its user and LLM names, regions, comments, references and operand expressions at offsets.",
    subjects: [{ name: "<module|range>", help: "the start address of a module of the knowledge, or a range <start>-<end>" }],
    options: {
      library: LIBRARY,
      name: { kind: "text", value: "<name>", help: "the routine name. The default is the user or LLM name at the start" },
      title: { kind: "text", value: "<text>", help: "the title. The default is the module title" },
      replace: { kind: "flag", help: "replace a routine file of the same name" },
    },
    run: routineCommand,
  },
  {
    name: "match",
    summary: "Finds each routine of the library in the program of the knowledge: the opcodes and other fixed bytes equal, and the addresses into the routine moved by one shift.",
    options: {
      library: { ...LIBRARY, help: "the library folder, relative to the project folder, for example ../library" },
      apply: { kind: "flag", help: "write the changes to the project knowledge as one revision of the LLM. Without it, the result only shows the changes" },
      "max-listed": OPTIONS["max-listed"],
    },
    run: matchCommand,
  },
];

await runScript({
  name: "provenance",
  summary: "Where the parts of a program come from: a comparison of releases, the separation of the program in the knowledge, its leftovers, and a library of known routines.",
  names: knowledgeNames,
  commands: COMMANDS,
});
