// The c64-provenance script: compares two or more releases byte by byte at
// their addresses and reports where they differ and which releases agree. A
// release is a PRG or an unpacker image.json. With --run, each release
// runs in its own emulator, and each listed difference gets its first access
// and whether the run changed it. The separate command gives evidence from
// the program in the knowledge, and the leftovers command lists what its
// unused bytes hold: text, BASIC lines, fills and copies. The routine and match commands keep
// routines that several programs share in a library folder and find them in the
// program (D71).

import { basename, relative } from "node:path";
import { parseArgs } from "node:util";

import { type AddressRange, c64AddressOf, formatC64Address, parseC64Address } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";
import { parseEntryState, type EntryState } from "#src/host-client/entry-state.ts";
import { readImage } from "#src/host-client/image.ts";
import { checkActionSteps, type ActionStep } from "#src/host-client/steps.ts";
import { MAX_EXECUTION_COUNT, WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { programCoverage, requireProgram } from "#src/knowledge/program.ts";
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
import { CODE_REGION_TYPES, SEMANTIC_ORIGINS } from "#src/knowledge/schema.ts";
import { platformNames } from "#src/platform.ts";
import { projectRoot } from "#src/project.ts";
import { runBody, UsageError } from "#src/script.ts";
import { compareReleases, shiftSuggestion, suggestShifts, type Release } from "./lib/compare.ts";
import { findRoutine, libraryFolder, LibraryError, readLibrary, routineFrom, saveRoutine, suggest } from "./lib/library.ts";
import { watchRelease, type Start } from "./lib/runtime.ts";
import { findLeftovers } from "./lib/leftovers.ts";
import { separate } from "./lib/separate.ts";

const USAGE = `provenance.ts <release> <release> [<release> ...] [options]
provenance.ts separate [--out <file>] [--max-listed <n>]
provenance.ts leftovers [--out <file>] [--min-text <n>] [--max-listed <n>]
provenance.ts routine --library <folder> (--module <address> | --start <address> --end <address>)
                      [--name <name>] [--title <text>] [--replace]
provenance.ts match --library <folder> [--out <file>] [--max-listed <n>]

  --shift <n>:<bytes>   move release n (1 = the first) by a number of bytes, for example 2:-256
  --from <address>      compare from this address
  --to <address>        compare up to this address
  --run <frames>        run each release in its own emulator for this many frames, and
                        give each listed difference its first access and whether it changed
  --steps <file>        with --run: action steps (JSON) to run before the frames

separate gives evidence from the program in the knowledge: the unpack stage
that wrote each range, its access in the coverage of the knowledge, whether call
and jump references in knowledge reach each code region from the entry, and what
the program reads or executes outside its segments. --out writes all ranges to a file;
the result lists at most --max-listed of each list (default 50) and its count.

leftovers lists what the program in the knowledge holds besides its working
code: text in PETSCII, screen codes, ASCII or with bit 7 set (Apple II) and
assembler source (at least --min-text characters, default 8), BASIC lines away
from the BASIC start, fills, untouched bytes outside code, exact copies of
earlier bytes, and code regions that no call or jump reaches and no run executed. Each finding has the stages and the accesses of
its bytes. --out writes all findings to a file.

routine saves a routine of the program in the knowledge to a library: a plain folder of routine
files, beside the projects (--library, relative to the working directory, as
--project). It takes a module of the knowledge, or --start and --end. Its
code regions give the instructions; the user and LLM names, regions, comments,
references and operand expressions go into the file at offsets. --name defaults
to the user or LLM name at the start, --title to the module title.

match finds each routine of the library in the program of the knowledge: the opcodes and other
fixed bytes equal, and the addresses into the routine moved by one shift.
Operands that address something outside the routine may differ; the result
lists them. --out writes the names of the routines at the found addresses as a
batch for knowledge.ts apply, and the result lists what it left out.

A release to compare is a PRG, placed at its load address, or an image.json of
the c64-unpacker skill, compared inside its segments. Paths are relative to the
project folder. The result is one JSON object.`;

function address(text: string, option: string): number {
  try {
    return parseC64Address(text);
  } catch {
    throw new UsageError(`${option} must be $ followed by four hex digits, not ${text}`);
  }
}

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
 * entry state and stages), a PRG at its load address, or an image.json of the
 * c64-unpacker skill with the entry_state.json beside it.
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
    noState = "The knowledge has no entry state: put a c64-unpacker capture in with knowledge.ts image <image.json>.";
  } else {
    image = readImage(name);
    noState = `It has no entry_state.json beside it; capture it with c64-unpacker.`;
  }
  const segments = image.segments.map(moved);
  if (!segments.every(inside)) throw new UsageError(`the shift moves ${name} outside $0000-$ffff`);
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

async function run(argv: string[]): Promise<unknown> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: {
      shift: { type: "string", multiple: true },
      from: { type: "string" },
      to: { type: "string" },
      run: { type: "string" },
      steps: { type: "string" },
      out: { type: "string" },
      "max-listed": { type: "string" },
      "min-text": { type: "string" },
      library: { type: "string" },
      module: { type: "string" },
      start: { type: "string" },
      end: { type: "string" },
      name: { type: "string" },
      title: { type: "string" },
      replace: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) throw new UsageError("");
  /** Refuses the options that `command` does not take. */
  const only = (command: string, allowed: readonly string[]) => {
    const used = Object.keys(values).filter((option) => option !== "help" && !allowed.includes(option));
    if (used.length > 0) throw new UsageError(`${command} does not take --${used.join(", --")}`);
  };
  if (positionals[0] === "separate") {
    only("separate", ["out", "max-listed"]);
    if (positionals.length !== 1) throw new UsageError("separate takes no release: it reads the program from the knowledge");
    return separateCommand(values.out, values["max-listed"]);
  }
  if (positionals[0] === "leftovers") {
    only("leftovers", ["out", "min-text", "max-listed"]);
    if (positionals.length !== 1) throw new UsageError("leftovers takes no release: it reads the program from the knowledge");
    return leftoversCommand(values.out, values["min-text"], values["max-listed"]);
  }
  if (positionals[0] === "routine") {
    only("routine", ["library", "module", "start", "end", "name", "title", "replace"]);
    if (positionals.length !== 1) throw new UsageError("routine takes no image: it reads the program from the knowledge");
    return routineCommand(values);
  }
  if (positionals[0] === "match") {
    only("match", ["library", "out", "max-listed"]);
    if (positionals.length !== 1) throw new UsageError("match takes no image: it reads the program from the knowledge");
    return matchCommand(values.library, values.out, values["max-listed"]);
  }
  only("a comparison", ["shift", "from", "to", "run", "steps"]);
  if (positionals.length < 2) throw new UsageError("give two or more releases");
  const shifts = new Map<number, number>();
  for (const text of values.shift ?? []) {
    const match = /^(\d+):([+-]?\d+)$/.exec(text);
    if (match === null || Number(match[1]) < 1 || Number(match[1]) > positionals.length) throw new UsageError(`--shift must be <release number>:<bytes>, not ${text}`);
    shifts.set(Number(match[1]), Number(match[2]));
  }
  if (values.steps !== undefined && values.run === undefined) throw new UsageError("--steps works only with --run");
  let frames: number | undefined;
  if (values.run !== undefined) {
    if (!/^\d{1,6}$/.test(values.run) || Number(values.run) < 1 || Number(values.run) > MAX_EXECUTION_COUNT) throw new UsageError(`--run needs a frame count from 1 to ${MAX_EXECUTION_COUNT}, not ${values.run}`);
    frames = Number(values.run);
  }
  let steps: ActionStep[] = [];
  if (values.steps !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readProjectFile(values.steps).bytes.toString("utf8"));
    } catch (error) {
      if (error instanceof WireFailure) throw error;
      throw new UsageError(`the steps file ${values.steps} is not JSON: ${(error as Error).message}`);
    }
    steps = checkActionSteps(parsed, (message) => {
      throw new UsageError(`steps file ${values.steps}: ${message}`);
    });
  }
  const loaded = positionals.map((path, index) => readRelease(path, shifts.get(index + 1) ?? 0));
  const releases = loaded.map((item) => item.release);
  const comparison = compareReleases(releases, {
    ...(values.from === undefined ? {} : { from: address(values.from, "--from") }),
    ...(values.to === undefined ? {} : { to: address(values.to, "--to") }),
  });
  const compared = comparison.identicalBytes + comparison.differingBytes;
  const identicalShare = compared === 0 ? 0 : comparison.identicalBytes / compared;
  // A poor match at the load addresses can mean that the releases are placed differently.
  // Each release gets its best shifts: data that stayed can outvote code that moved, so one is not enough.
  const applied = loaded.map((item) => item.shift);
  const suggestions =
    identicalShare < 0.5
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

  return {
    releases: loaded.map((item) => ({ name: item.release.name, shift: item.shift, segments: item.release.segments.map((segment) => ({ start: formatC64Address(segment.start), end: formatC64Address(segment.end) })) })),
    common: comparison.common.map((range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) })),
    identicalBytes: comparison.identicalBytes,
    differingBytes: comparison.differingBytes,
    identicalShare: Number(identicalShare.toFixed(3)),
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
}

/** The stages of a capture as ranges; a stage that is not a capture stage is refused. `where` names the capture. */
function stagesOf(stages: Array<Record<string, unknown>> | undefined, where = "the program in the knowledge"): Array<{ entry: number; wrote: AddressRange[] }> | undefined {
  if (stages === undefined) return undefined;
  const parse = (value: unknown) => {
    const at = typeof value === "string" ? c64AddressOf(value) : undefined;
    if (at !== undefined) return at;
    throw new Refusal("invalid-input", `the stages of ${where} are not the stages of a c64-unpacker capture; capture it again with c64-unpacker`);
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

const NO_STAGES = "The program in the knowledge has no stage log. Only a capture of c64-unpacker gives one. A capture of loads holds one part of a program and has none.";

/** separate: evidence from the program in the knowledge, with all ranges in --out and the first ones in the result. */
function separateCommand(out: string | undefined, maxListed: string | undefined): unknown {
  const max = maxListed ?? "50";
  if (!/^\d{1,5}$/.test(max)) throw new UsageError(`--max-listed must be a whole number, not ${max}`);
  const { program, stages, coverage, found } = programEvidence();
  const loaded = { entry: program.entry, stages };
  const show = (range: AddressRange) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) });
  const ranges = found.ranges.map((range) => ({ ...show(range), ...(range.stage === undefined ? {} : { stage: range.stage }), ...(range.access === undefined ? {} : { access: range.access }) }));
  const codeRegions = found.codeRegions.map((region) => ({ ...show(region), type: region.type, ...(region.reachable === undefined ? {} : { reachable: region.reachable }), ...(region.executed === undefined ? {} : { executed: region.executed }) }));
  const outside = { read: found.outside.read.map(show), executed: found.outside.executed.map(show), generated: found.outside.generated.map(show) };
  const listed = <T>(items: T[]) => ({ count: items.length, listed: items.slice(0, Number(max)) });
  if (out !== undefined) writeProjectFile(out, Buffer.from(`${JSON.stringify({ ranges, codeRegions, outside }, null, 1)}\n`), { what: "--out" });
  const bytes = (filter: (range: (typeof found.ranges)[number]) => boolean) => found.ranges.filter(filter).reduce((sum, range) => sum + range.end - range.start + 1, 0);
  const lastStage = loaded.stages === undefined ? undefined : loaded.stages.length - 1;
  return {
    ...(loaded.entry === undefined ? {} : { entry: formatC64Address(loaded.entry) }),
    ...(lastStage === undefined
      ? { noStages: NO_STAGES }
      : {
          stages: lastStage + 1,
          bytesByStage: Object.fromEntries([...[...Array(lastStage + 1).keys()].map((stage): [string, number] => [String(stage), bytes((range) => range.stage === stage)]), ["none", bytes((range) => range.stage === undefined)]]),
        }),
    ...(coverage === undefined ? {} : { bytesByAccess: Object.fromEntries((["executed", "read", "written", "read-written", "untouched"] as const).map((access) => [access, bytes((range) => range.access === access)])) }),
    ranges: listed(ranges),
    // total counts every code region; unreachable is a list like the others.
    codeRegions: {
      total: codeRegions.length,
      ...(loaded.entry === undefined ? {} : { unreachable: listed(codeRegions.filter((region) => region.reachable === false)) }),
    },
    ...(coverage === undefined ? {} : { outside: { read: listed(outside.read), executed: listed(outside.executed), generated: listed(outside.generated) } }),
    ...(out === undefined ? {} : { out }),
  };
}

/** The longest text that the result shows; --out has all of it. */
const SHOWN_TEXT = 120;

/** leftovers: what the program in the knowledge holds besides its working code, with all findings in --out and the first ones in the result. */
function leftoversCommand(out: string | undefined, minText: string | undefined, maxListed: string | undefined): unknown {
  const max = maxListed ?? "50";
  if (!/^\d{1,5}$/.test(max)) throw new UsageError(`--max-listed must be a whole number, not ${max}`);
  const min = minText ?? "8";
  if (!/^\d{1,3}$/.test(min) || Number(min) < 4) throw new UsageError(`--min-text must be a whole number of 4 or more, not ${min}`);
  const { program, stages, coverage, found } = programEvidence();
  const leftovers = findLeftovers({
    segments: program.segments,
    memory: program.memory,
    separation: found,
    ...(program.segments.some((segment) => segment.start === 0x0801) ? { basicStart: 0x0801 } : {}),
    minText: Number(min),
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
  const listed = <T>(items: T[]) => ({ count: items.length, listed: items.slice(0, Number(max)) });
  if (out !== undefined) writeProjectFile(out, Buffer.from(`${JSON.stringify(all, null, 1)}\n`), { what: "--out" });
  return {
    ...(program.entry === undefined ? { noEntry: "The program in the knowledge has no entry, so deadCode is empty." } : { entry: formatC64Address(program.entry) }),
    ...(stages === undefined ? { noStages: NO_STAGES } : { stages: stages.length }),
    ...(coverage === undefined ? { noCoverage: "The knowledge has no coverage, so residue is empty and no finding has access. Add coverage with coverage of the c64-knowledge skill." } : {}),
    text: listed(all.text.map((item) => (item.text.length > SHOWN_TEXT ? { ...item, text: `${item.text.slice(0, SHOWN_TEXT)} ...`, length: item.text.length } : item))),
    basic: listed(all.basic),
    fill: listed(all.fill),
    residue: listed(all.residue),
    copies: listed(all.copies),
    deadCode: listed(all.deadCode),
    ...(out === undefined ? {} : { out }),
  };
}


const platform = () => new Map(platformNames().map((entry) => [entry.name, entry.address]));

/** routine: saves a module or a range of the program in the knowledge, with its knowledge, as a routine of the library (D71). */
function routineCommand(values: { library?: string; module?: string; start?: string; end?: string; name?: string; title?: string; replace?: boolean }): unknown {
  if (values.library === undefined) throw new UsageError("routine needs --library <folder>");
  if (values.module !== undefined && (values.start !== undefined || values.end !== undefined)) throw new UsageError("routine takes --module, or --start and --end, not both");
  if (values.module === undefined && values.start === undefined && values.end === undefined) throw new UsageError("routine needs --module <address>, or --start and --end");
  if (values.module === undefined && (values.start === undefined || values.end === undefined)) throw new UsageError("routine needs both --start and --end");
  const db = openForRead();
  try {
    const image = requireProgram(db);
    const segmentOf = (at: number) => image.segments.find((segment) => at >= segment.start && at <= segment.end);
    let start: number;
    let end: number;
    let title = values.title;
    if (values.module !== undefined) {
      start = address(values.module, "--module");
      const modules = listModules(db);
      const module = modules.find((item) => item.start === start);
      if (module === undefined) throw new LibraryError("not-found", `No module starts at ${formatC64Address(start)}. List the modules with knowledge.ts modules, or give --start and --end.`);
      const segment = segmentOf(start);
      if (segment === undefined) throw new UsageError(`The module at ${formatC64Address(start)} is outside the segments of the program.`);
      end = (modules.find((item) => item.start > start && item.start <= segment.end)?.start ?? segment.end + 1) - 1;
      title ??= module.title;
    } else {
      start = address(values.start!, "--start");
      end = address(values.end!, "--end");
      if (end < start) throw new UsageError("--end is before --start");
      if (segmentOf(start) === undefined || segmentOf(start) !== segmentOf(end)) throw new UsageError(`${formatC64Address(start)}-${formatC64Address(end)} is not inside one segment of the program.`);
    }
    const range = { start, end };
    const name = values.name ?? listSymbols(db, { start, end: start }, undefined, SEMANTIC_ORIGINS)[0]?.name;
    if (name === undefined) throw new UsageError(`The knowledge has no user or LLM name at ${formatC64Address(start)}: give --name.`);
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
    const file = saveRoutine(libraryFolder(values.library, { create: true }), routine, values.replace === true);
    return {
      routine: routine.name,
      file: relative(process.cwd(), file),
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

/** match: finds the routines of the library in the program of the knowledge, and with --out writes their names there as an apply batch (D71). */
function matchCommand(library: string | undefined, out: string | undefined, maxListed: string | undefined): unknown {
  if (library === undefined) throw new UsageError("match needs --library <folder>");
  const max = maxListed ?? "50";
  if (!/^\d{1,5}$/.test(max)) throw new UsageError(`--max-listed must be a whole number, not ${max}`);
  const listed = <T>(items: T[]) => ({ count: items.length, listed: items.slice(0, Number(max)) });
  const routines = readLibrary(libraryFolder(library, { create: false }));
  if (routines.length === 0) throw new LibraryError("not-found", `The library ${library} has no routine files. Save a routine with routine first.`);
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
  const result: Record<string, unknown> = { library, routines: routines.length, matches: listed(matches) };
  if (out === undefined) return result;
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
  const { batch, known, leftOut } = suggestions;
  writeProjectFile(out, Buffer.from(batch.length === 0 ? "[]\n" : `[\n${batch.map((write) => ` ${JSON.stringify(write)}`).join(",\n")}\n]\n`), { what: "--out" });
  return {
    ...result,
    batch: { out, writes: batch.length, known, leftOut: listed(leftOut) },
    ...(batch.length === 0 ? {} : { apply: `knowledge.ts apply ${out} --reason "names of library routines"` }),
  };
}

await runBody((argv) => run(argv), { usage: USAGE });
