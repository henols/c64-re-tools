// The c64-provenance script: compares two or more releases byte by byte at
// their addresses and reports where they differ and which releases agree. A
// release is a PRG or an unpacker image.json (D50). With --run, each release
// runs in its own emulator, and each listed difference gets its first access
// and whether the run changed it. The separate command gives evidence from
// one release (D51). The routine and match commands keep routines that several
// programs share in a library folder and find them in a program (D71).

import { basename, posix, relative } from "node:path";
import { parseArgs } from "node:util";

import { formatC64Address, parseC64Address } from "#src/c64.ts";
import { readCoverageFiles } from "#src/host-client/coverage.ts";
import { ImageError, readImage, type Image } from "#src/host-client/image.ts";
import { checkActionSteps, type ActionStep } from "#src/host-client/steps.ts";
import { MAX_EXECUTION_COUNT, WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile, writeProjectFile } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { KnowledgeError, openForRead } from "#src/knowledge/database.ts";
import {
  commentsAt,
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
import { CODE_REGION_TYPES, type Origin } from "#src/knowledge/schema.ts";
import { platformNames } from "#src/platform.ts";
import { projectRoot } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { compareReleases, shiftSuggestion, suggestShifts, type Range, type Release } from "./compare.ts";
import { findRoutine, libraryFolder, LibraryError, readLibrary, routineFrom, saveRoutine, suggest } from "./library.ts";
import { watchRelease, type ImageState, type Start } from "./runtime.ts";
import { separate } from "./separate.ts";

const USAGE = `provenance.ts <release> <release> [<release> ...] [options]
provenance.ts separate <release> [--coverage <file> ...] [--out <file>] [--max-listed <n>]
provenance.ts routine <image> --library <folder> (--module <address> | --start <address> --end <address>)
                      [--name <name>] [--title <text>] [--replace]
provenance.ts match <image> --library <folder> [--out <file>] [--max-listed <n>]

  --shift <n>:<bytes>   move release n (1 = the first) by a number of bytes, for example 2:-256
  --from <address>      compare from this address
  --to <address>        compare up to this address
  --run <frames>        run each release in its own emulator for this many frames, and
                        give each listed difference its first access and whether it changed
  --steps <file>        with --run: action steps (JSON) to run before the frames

separate gives evidence from one release: the unpack stage that wrote each range,
its access in the --coverage files (64 KiB each, repeatable), whether call and
jump references in knowledge reach each code region from the entry, and what the
program reads or executes outside the image. --out writes all ranges to a file;
the result lists at most --max-listed of each list (default 50) and its count.

routine saves a routine of the project to a library: a plain folder of routine
files, beside the projects (--library, relative to the working directory, as
--project). It takes a module (D48) of the knowledge, or --start and --end. Its
code regions give the instructions; the user and LLM names, regions, comments,
references and operand expressions go into the file at offsets. --name defaults
to the user or LLM name at the start, --title to the module title.

match finds each routine of the library in an image: the opcodes and other
fixed bytes equal, and the addresses into the routine moved by one shift.
Operands that address something outside the routine may differ; the result
lists them. --out writes the names of the routines at the found addresses as a
batch for knowledge.ts apply, and the result lists what it left out.

A release is a PRG, placed at its load address, or an image.json of the
c64-unpacker skill, compared inside its segments. Paths are relative to the
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
  stages?: Array<{ entry: number; wrote: Range[] }>;
}

/** Reads entry_state.json of the c64-unpacker skill for a start by writes. */
function entryState(path: string): ImageState | string {
  let value: Record<string, any>;
  try {
    value = JSON.parse(readProjectFile(path).bytes.toString("utf8")) as Record<string, any>;
  } catch (error) {
    if (error instanceof WireFailure && error.code === "not-found") return `It has no ${path}; capture it with c64-unpacker.`;
    if (error instanceof WireFailure) throw error;
    return `${path} is not JSON: ${(error as Error).message}`;
  }
  const registers = value.registers ?? {};
  const byte = (item: unknown) => Number.isInteger(item) && (item as number) >= 0 && (item as number) <= 0xff;
  const pages = ["$0000", "$0100", "$0200", "$0300"].map((page) => value.pages?.[page]);
  const ok =
    typeof registers.pc === "string" &&
    /^\$[0-9a-f]{4}$/i.test(registers.pc) &&
    ["a", "x", "y", "sp"].every((name) => byte(registers[name])) &&
    typeof registers.flags === "object" &&
    byte(value.cpuPort?.$00) &&
    byte(value.cpuPort?.$01) &&
    pages.every((page) => typeof page === "string" && /^[0-9a-f]{512}$/i.test(page));
  if (!ok) return `${path} is not an entry_state.json of the c64-unpacker skill.`;
  const flag = (name: string) => registers.flags[name] === true;
  return {
    pc: Number.parseInt(registers.pc.slice(1), 16),
    a: registers.a,
    x: registers.x,
    y: registers.y,
    sp: registers.sp,
    flags: { n: flag("n"), v: flag("v"), d: flag("d"), i: flag("i"), z: flag("z"), c: flag("c") },
    port: [value.cpuPort.$00, value.cpuPort.$01],
    pages: Buffer.from(pages.join(""), "hex"),
  };
}

function readRelease(path: string, shift: number): LoadedRelease {
  const { bytes } = readProjectFile(path);
  const moved = (range: Range) => ({ start: range.start + shift, end: range.end + shift });
  const inside = (range: Range) => range.start >= 0 && range.end <= 0xffff;
  if (!path.endsWith(".json")) {
    if (bytes.length < 3) throw new UsageError(`${path} is too short for a PRG`);
    const load = bytes.readUInt16LE(0);
    const segment = moved({ start: load, end: load + bytes.length - 3 });
    if (!inside(segment)) throw new UsageError(`the shift moves ${path} outside $0000-$ffff`);
    const memory = new Uint8Array(0x10000);
    memory.set(bytes.subarray(2), load);
    return { release: { name: path, segments: [segment], byteAt: (at) => bytes[2 + at - segment.start]! }, shift, start: { kind: "program", path }, memory };
  }
  const fail = (what: string): never => {
    throw new UsageError(`${path} is not an image.json of the c64-unpacker skill: ${what}`);
  };
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  } catch (error) {
    return fail((error as Error).message);
  }
  const parse = (value: unknown) => (typeof value === "string" && /^\$[0-9a-f]{4}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fail("a segment needs start and end as $ addresses"));
  if (typeof manifest.image !== "string" || !Array.isArray(manifest.segments) || manifest.segments.length === 0) fail("it needs image and segments");
  const own = (manifest.segments as Array<Record<string, unknown>>).map((segment) => ({ start: parse(segment.start), end: parse(segment.end) })).sort((a, b) => a.start - b.start);
  const directory = posix.dirname(path);
  const memory = readProjectFile(posix.join(directory, manifest.image as string)).bytes;
  if (memory.length !== 0x10000) fail(`its image has ${memory.length} bytes, not 65536`);
  const segments = own.map(moved);
  if (!segments.every(inside)) throw new UsageError(`the shift moves ${path} outside $0000-$ffff`);
  const state = entryState(posix.join(directory, "entry_state.json"));
  const stages = Array.isArray(manifest.stages)
    ? (manifest.stages as Array<Record<string, unknown>>).map((stage) => ({
        entry: parse(stage.entry),
        wrote: (Array.isArray(stage.wrote) ? (stage.wrote as Array<Record<string, unknown>>) : []).map((range) => ({ start: parse(range.start), end: parse(range.end) })),
      }))
    : undefined;
  return {
    release: { name: path, segments, byteAt: (at) => memory[at - shift]! },
    shift,
    start: typeof state === "string" ? { kind: "none", reason: state } : { kind: "image", segments: own, byteAt: (at) => memory[at]!, state },
    memory,
    ...(manifest.entry === undefined ? {} : { entry: parse(manifest.entry) }),
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
      coverage: { type: "string", multiple: true },
      out: { type: "string" },
      "max-listed": { type: "string" },
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
    only("separate", ["coverage", "out", "max-listed"]);
    if (positionals.length !== 2) throw new UsageError("separate needs one release");
    return separateCommand(positionals[1]!, values.coverage ?? [], values.out, values["max-listed"]);
  }
  if (positionals[0] === "routine") {
    only("routine", ["library", "module", "start", "end", "name", "title", "replace"]);
    if (positionals.length !== 2) throw new UsageError("routine needs one image");
    return routineCommand(positionals[1]!, values);
  }
  if (positionals[0] === "match") {
    only("match", ["library", "out", "max-listed"]);
    if (positionals.length !== 2) throw new UsageError("match needs one image");
    return matchCommand(positionals[1]!, values.library, values.out, values["max-listed"]);
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
  // Each release gets its best shifts: data that stayed can outvote code that moved, so one is not enough (b2/04).
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
  const runtime = new Map<string, Array<Range & { first: string; changed: boolean }>>();
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
      // runtime gives the release's own addresses: with a shift, they are not the addresses of the difference (F-24).
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

/** separate: evidence from one release (D51), with all ranges in --out and the first ones in the result. */
function separateCommand(path: string, coveragePaths: string[], out: string | undefined, maxListed: string | undefined): unknown {
  const max = maxListed ?? "50";
  if (!/^\d{1,5}$/.test(max)) throw new UsageError(`--max-listed must be a whole number, not ${max}`);
  const loaded = readRelease(path, 0);
  const coverage = readCoverageFiles(coveragePaths, (message) => {
    throw new UsageError(message);
  });
  const db = openForRead();
  let regions: ReturnType<typeof listRegions>;
  let references: ReturnType<typeof listReferences>;
  try {
    regions = listRegions(db).filter((region) => CODE_REGION_TYPES.includes(region.type));
    references = listReferences(db);
  } finally {
    db?.close();
  }
  const found = separate({
    segments: loaded.release.segments,
    memory: loaded.memory,
    ...(loaded.entry === undefined ? {} : { entry: loaded.entry }),
    ...(loaded.stages === undefined ? {} : { stages: loaded.stages }),
    ...(coverage === undefined ? {} : { coverage }),
    codeRegions: regions,
    references,
  });
  const show = (range: Range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) });
  const ranges = found.ranges.map((range) => ({ ...show(range), ...(range.stage === undefined ? {} : { stage: range.stage }), ...(range.access === undefined ? {} : { access: range.access }) }));
  const codeRegions = found.codeRegions.map((region) => ({ ...show(region), type: region.type, ...(region.reachable === undefined ? {} : { reachable: region.reachable }), ...(region.executed === undefined ? {} : { executed: region.executed }) }));
  const outside = { read: found.outside.read.map(show), executed: found.outside.executed.map(show), generated: found.outside.generated.map(show) };
  const listed = <T>(items: T[]) => ({ count: items.length, listed: items.slice(0, Number(max)) });
  if (out !== undefined) writeProjectFile(out, Buffer.from(`${JSON.stringify({ release: path, ranges, codeRegions, outside }, null, 1)}\n`), { what: "--out" });
  const bytes = (filter: (range: (typeof found.ranges)[number]) => boolean) => found.ranges.filter(filter).reduce((sum, range) => sum + range.end - range.start + 1, 0);
  const lastStage = loaded.stages === undefined ? undefined : loaded.stages.length - 1;
  return {
    release: path,
    ...(loaded.entry === undefined ? {} : { entry: formatC64Address(loaded.entry) }),
    ...(lastStage === undefined
      ? { noStages: "image.json has no stage log. Only a capture of c64-unpacker writes one. A capture of loads holds one part of a program and has none." }
      : {
          stages: lastStage + 1,
          bytesByStage: Object.fromEntries([...[...Array(lastStage + 1).keys()].map((stage): [string, number] => [String(stage), bytes((range) => range.stage === stage)]), ["none", bytes((range) => range.stage === undefined)]]),
        }),
    ...(coverage === undefined ? {} : { bytesByAccess: Object.fromEntries((["executed", "read", "written", "read-written", "untouched"] as const).map((access) => [access, bytes((range) => range.access === access)])) }),
    ranges: listed(ranges),
    // total counts every code region; unreachable is a list like the others (b2/08).
    codeRegions: {
      total: codeRegions.length,
      ...(loaded.entry === undefined ? {} : { unreachable: listed(codeRegions.filter((region) => region.reachable === false)) }),
    },
    ...(coverage === undefined ? {} : { outside: { read: listed(outside.read), executed: listed(outside.executed), generated: listed(outside.generated) } }),
    ...(out === undefined ? {} : { out }),
  };
}

const SEMANTIC: readonly Origin[] = ["user", "llm"];

function imageOf(path: string): Image {
  try {
    return readImage(path);
  } catch (error) {
    if (error instanceof ImageError) throw new UsageError(error.message);
    throw error;
  }
}

const platform = () => new Map(platformNames().map((entry) => [entry.name, entry.address]));

/** routine: saves a module or a range of the project, with its knowledge, as a routine of the library (D71). */
function routineCommand(path: string, values: { library?: string; module?: string; start?: string; end?: string; name?: string; title?: string; replace?: boolean }): unknown {
  if (values.library === undefined) throw new UsageError("routine needs --library <folder>");
  if (values.module !== undefined && (values.start !== undefined || values.end !== undefined)) throw new UsageError("routine takes --module, or --start and --end, not both");
  if (values.module === undefined && values.start === undefined && values.end === undefined) throw new UsageError("routine needs --module <address>, or --start and --end");
  if (values.module === undefined && (values.start === undefined || values.end === undefined)) throw new UsageError("routine needs both --start and --end");
  const image = imageOf(path);
  const segmentOf = (at: number) => image.segments.find((segment) => at >= segment.start && at <= segment.end);
  const db = openForRead();
  try {
    let start: number;
    let end: number;
    let title = values.title;
    if (values.module !== undefined) {
      start = address(values.module, "--module");
      const modules = listModules(db);
      const module = modules.find((item) => item.start === start);
      if (module === undefined) throw new LibraryError("not-found", `No module starts at ${formatC64Address(start)}. List the modules with knowledge.ts modules, or give --start and --end.`);
      const segment = segmentOf(start);
      if (segment === undefined) throw new UsageError(`The module at ${formatC64Address(start)} is outside the segments of ${path}.`);
      end = (modules.find((item) => item.start > start && item.start <= segment.end)?.start ?? segment.end + 1) - 1;
      title ??= module.title;
    } else {
      start = address(values.start!, "--start");
      end = address(values.end!, "--end");
      if (end < start) throw new UsageError("--end is before --start");
      if (segmentOf(start) === undefined || segmentOf(start) !== segmentOf(end)) throw new UsageError(`${formatC64Address(start)}-${formatC64Address(end)} is not inside one segment of ${path}.`);
    }
    const range = { start, end };
    const name = values.name ?? listSymbols(db, { start, end: start }, undefined, SEMANTIC)[0]?.name;
    if (name === undefined) throw new UsageError(`The knowledge has no user or LLM name at ${formatC64Address(start)}: give --name.`);
    const { routine, leftOut } = routineFrom({
      name,
      ...(title === undefined ? {} : { title }),
      program: basename(projectRoot()),
      image: path,
      start,
      end,
      byteAt: image.byteAt,
      analyzed: listRegions(db, range),
      symbols: listSymbols(db, range, undefined, SEMANTIC),
      regions: listRegions(db, range, undefined, SEMANTIC),
      comments: listComments(db, range, SEMANTIC),
      references: listReferences(db, range, undefined, SEMANTIC),
      operands: listOperands(db, range, SEMANTIC),
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

/** match: finds the routines of the library in an image, and with --out writes their names there as an apply batch (D71). */
function matchCommand(path: string, library: string | undefined, out: string | undefined, maxListed: string | undefined): unknown {
  if (library === undefined) throw new UsageError("match needs --library <folder>");
  const max = maxListed ?? "50";
  if (!/^\d{1,5}$/.test(max)) throw new UsageError(`--max-listed must be a whole number, not ${max}`);
  const listed = <T>(items: T[]) => ({ count: items.length, listed: items.slice(0, Number(max)) });
  const routines = readLibrary(libraryFolder(library, { create: false }));
  if (routines.length === 0) throw new LibraryError("not-found", `The library ${library} has no routine files. Save a routine with routine first.`);
  const image = imageOf(path);
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
  const operands = batch.some((write) => write.op === "operand");
  return {
    ...result,
    batch: { out, writes: batch.length, known, leftOut: listed(leftOut) },
    ...(batch.length === 0 ? {} : { apply: `knowledge.ts apply ${out}${operands ? ` --image ${path}` : ""} --reason "names of library routines"` }),
  };
}

await runScript((argv) => run(argv), { usage: USAGE, refusals: [KnowledgeError, LibraryError] });
