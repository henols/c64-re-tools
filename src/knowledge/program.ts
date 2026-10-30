// The program in the knowledge: its bytes, its entry with the machine
// state and the stages of its unpacker, and the coverage of the runs. A
// capture and the coverage maps are imported one time; every later step reads
// them here, so a project needs no image or coverage files to be made again.

import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { Refusal } from "../errors.ts";
import { type AddressRange, COVERAGE, formatC64Address, formatC64Byte } from "../c64.ts";

import { COVERAGE_KINDS, DEFAULT_SPACE, MEMORY_ROW, type CoverageKind, type Space } from "./schema.ts";
import { coverageRuns } from "./read.ts";
import { checkSpace, write, type Evidence, type OperandImage, type WriteContext } from "./write.ts";

/** The 64 KiB of one space: offset n is address n. */
const SIZE = 0x10000;

/** The coverage map flag of each kind; wx has its own map. */
const KIND_BITS: Record<Exclude<CoverageKind, "wx">, number> = {
  r: COVERAGE.ramRead,
  w: COVERAGE.ramWrite,
  x: COVERAGE.ramExecute,
  "rom-r": COVERAGE.romRead,
  "rom-x": COVERAGE.romExecute,
  "io-r": COVERAGE.ioRead,
  "io-w": COVERAGE.ioWrite,
  "io-x": COVERAGE.ioExecute,
};

/** The program of one space as the knowledge holds it. */
export interface ProgramImage {
  space: Space;
  /** The address ranges that hold bytes, in address order, without overlap. */
  segments: AddressRange[];
  /** 64 KiB; an address outside the segments holds 0. */
  memory: Uint8Array;
  /** The byte at an address inside a segment. */
  byteAt: (address: number) => number;
  entry?: number;
  /** The machine state at the entry: the content of the entry_state.json of a capture. */
  state?: Record<string, unknown>;
  /** The stages of the unpacker capture, in order: the last one is the program. */
  stages?: Array<Record<string, unknown>>;
}

/** What `setImage` writes: the bytes of the segments, and the entry when the program has one. */
export interface ImageRequest {
  space?: Space;
  segments: AddressRange[];
  byteAt: (address: number) => number;
  entry?: number;
  state?: Record<string, unknown>;
  stages?: Array<Record<string, unknown>>;
}

/** One coverage map to import, with the project path that names it as evidence. */
export interface CoverageMap {
  name: string;
  bytes: Uint8Array;
}

/** The address ranges where `has` is true, in address order. */
function rangesWhere(has: (address: number) => boolean): AddressRange[] {
  const ranges: AddressRange[] = [];
  for (let address = 0; address < SIZE; address++) {
    if (!has(address)) continue;
    const start = address;
    while (address + 1 < SIZE && has(address + 1)) address++;
    ranges.push({ start, end: address });
  }
  return ranges;
}

/** The memory rows of the segments: at most MEMORY_ROW bytes, never across a multiple of MEMORY_ROW. */
export function memoryRows(segments: readonly AddressRange[], byteAt: (address: number) => number): Map<number, string> {
  const rows = new Map<number, string>();
  for (const segment of segments) {
    for (let at = segment.start; at <= segment.end; ) {
      const end = Math.min(segment.end, (at | (MEMORY_ROW - 1)));
      rows.set(at, Buffer.from(Array.from({ length: end - at + 1 }, (_, index) => byteAt(at + index))).toString("hex"));
      at = end + 1;
    }
  }
  return rows;
}

function checkSegments(segments: readonly AddressRange[]): void {
  if (segments.length === 0) throw new Refusal("invalid-input", "An image has at least one segment.");
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  sorted.forEach((segment, index) => {
    if (!Number.isInteger(segment.start) || !Number.isInteger(segment.end) || segment.start < 0 || segment.end > 0xffff || segment.end < segment.start) {
      throw new Refusal("invalid-input", `The segment ${formatC64Address(segment.start)}-${formatC64Address(segment.end)} is not a range from $0000 to $ffff.`);
    }
    if (index > 0 && segment.start <= sorted[index - 1]!.end) throw new Refusal("invalid-input", `The segments at ${formatC64Address(sorted[index - 1]!.start)} and ${formatC64Address(segment.start)} overlap.`);
  });
}

/**
 * Makes the program of a space equal to the image: closes the memory rows
 * that changed or are gone, adds the new ones, and replaces the entry when it
 * changed. An image that is already in the knowledge writes nothing.
 */
export function setImage(db: DatabaseSync, context: WriteContext, request: ImageRequest): { revision: string | null; current: { space: Space; bytes: number; rowsAdded: number; rowsClosed: number; entry: boolean } } {
  checkSpace(request);
  checkSegments(request.segments);
  if (request.entry !== undefined && (!Number.isInteger(request.entry) || request.entry < 0 || request.entry > 0xffff)) throw new Refusal("invalid-input", "The entry must be from $0000 to $ffff.");
  if (request.entry === undefined && (request.state !== undefined || request.stages !== undefined)) throw new Refusal("invalid-input", "A machine state or stages need an entry.");
  const space = request.space ?? DEFAULT_SPACE;
  const wanted = memoryRows(request.segments, request.byteAt);
  return write(db, context, "image", (change) => {
    const current = db.prepare("SELECT id, address, bytes FROM current_memory WHERE space = ?").all(space) as Array<{ id: string; address: number; bytes: string }>;
    const kept = new Set<number>();
    let rowsClosed = 0;
    for (const row of current) {
      if (wanted.get(row.address) === row.bytes) kept.add(row.address);
      else {
        change.close("memory", "id = ?", row.id);
        rowsClosed++;
      }
    }
    let rowsAdded = 0;
    for (const [address, bytes] of [...wanted].sort(([a], [b]) => a - b)) {
      if (kept.has(address)) continue;
      change.insertMemory({ space, address, bytes, origin: context.origin });
      rowsAdded++;
    }
    const entryRow = db.prepare("SELECT id, address, state, stages FROM current_entries WHERE space = ?").get(space) as { id: string; address: number; state: string | null; stages: string | null } | undefined;
    const state = request.state === undefined ? null : JSON.stringify(request.state);
    const stages = request.stages === undefined ? null : JSON.stringify(request.stages);
    const same = entryRow !== undefined && entryRow.address === request.entry && entryRow.state === state && entryRow.stages === stages;
    const entryChanged = !same && (entryRow !== undefined || request.entry !== undefined);
    if (entryChanged) {
      if (entryRow !== undefined) change.close("entries", "id = ?", entryRow.id);
      if (request.entry !== undefined) change.insertEntry({ space, address: request.entry, state, stages, origin: context.origin });
    }
    const bytes = request.segments.reduce((sum, segment) => sum + segment.end - segment.start + 1, 0);
    return { space, bytes, rowsAdded, rowsClosed, entry: entryChanged };
  });
}

/** Address ranges as the knowledge text keeps them: "$1000-$1002 $1005". */
function rangesText(ranges: readonly AddressRange[]): string {
  const at = (address: number) => `$${address.toString(16).padStart(4, "0")}`;
  return ranges.map((range) => (range.start === range.end ? at(range.start) : `${at(range.start)}-${at(range.end)}`)).join(" ");
}

/** Calls `each` with the start and the end of each range of ranges as text. */
function forRanges(text: string, each: (start: number, end: number) => void): void {
  for (const item of text.split(" ")) {
    const [start, end] = item.split("-");
    each(Number.parseInt(start!.slice(1), 16), Number.parseInt((end ?? start)!.slice(1), 16));
  }
}

/** Sets 1 in `map` at each address of ranges as text. */
function fillRanges(map: Uint8Array, text: string): void {
  forRanges(text, (start, end) => map.fill(1, start, end + 1));
}

/** The union of the coverage of one space: a map of each kind, 1 at each address that a map of the space has. */
function currentCoverage(db: DatabaseSync, space: Space): Map<CoverageKind, Uint8Array> {
  const maps = new Map<CoverageKind, Uint8Array>(COVERAGE_KINDS.map((kind) => [kind, new Uint8Array(SIZE)]));
  for (const row of db.prepare("SELECT kind, ranges FROM current_coverage WHERE space = ?").all(space) as Array<{ kind: CoverageKind; ranges: string }>) fillRanges(maps.get(row.kind)!, row.ranges);
  return maps;
}

/** The number of address ranges of each kind in the coverage of a space: the ranges of the union of its maps. */
export function coverageRangeCounts(db: DatabaseSync | undefined, space: Space = DEFAULT_SPACE): Partial<Record<CoverageKind, number>> {
  if (db === undefined) return {};
  const counts: Partial<Record<CoverageKind, number>> = {};
  for (const [kind, map] of currentCoverage(db, space)) {
    const count = rangesWhere((address) => map[address] === 1).length;
    if (count > 0) counts[kind] = count;
  }
  return counts;
}

/** The ranges of each kind of one coverage map as text, for each kind that it has. wx is each address that the run both wrote and executed. */
function mapRanges(bytes: Uint8Array): Map<CoverageKind, string> {
  const ranges = new Map<CoverageKind, string>();
  for (const kind of COVERAGE_KINDS) {
    const has = kind === "wx" ? (address: number) => (bytes[address]! & (COVERAGE.ramWrite | COVERAGE.ramExecute)) === (COVERAGE.ramWrite | COVERAGE.ramExecute) : (address: number) => (bytes[address]! & KIND_BITS[kind]) !== 0;
    const found = rangesWhere(has);
    if (found.length > 0) ranges.set(kind, rangesText(found));
  }
  return ranges;
}

/** The number of ranges of each kind that are in `after` and not in `before`. */
function gained(before: Map<CoverageKind, Uint8Array>, after: Map<CoverageKind, Uint8Array>): number {
  let count = 0;
  for (const kind of COVERAGE_KINDS) count += rangesWhere((address) => after.get(kind)![address] === 1 && before.get(kind)![address] === 0).length;
  return count;
}

/**
 * Puts coverage maps into the coverage of a space. The knowledge keeps the
 * ranges of each map by its project path; the coverage of the space is the
 * union of the maps. A map for a path that the space has already replaces
 * the earlier map of that path: a run that is recorded again counts only
 * with its new map. wx is each address that one run both wrote and
 * executed. Each new map is evidence of the revision, with its space. A map
 * that is the latest map of its path in the space is not imported again.
 */
export function addCoverage(
  db: DatabaseSync,
  context: WriteContext,
  request: { space?: Space; maps: CoverageMap[] },
): { revision: string | null; current: { space: Space; imported: string[]; replaced: string[]; known: string[]; added: number; removed: number } } {
  checkSpace(request);
  const space = request.space ?? DEFAULT_SPACE;
  for (const map of request.maps) {
    if (map.bytes.length !== SIZE) throw new Refusal("invalid-input", `${map.name} has ${map.bytes.length} bytes; a coverage map has 65536, one for each address.`);
  }
  // A path given twice is one map: the last one.
  const byName = new Map(request.maps.map((map) => [map.name, map]));
  const hashed = [...byName.values()].map((map) => ({ ...map, sha256: createHash("sha256").update(map.bytes).digest("hex") }));
  // The runs of a name are oldest first: the last one is the latest map of the path.
  const latest = new Map(coverageRuns(db).filter((run) => run.space === space).map((run) => [run.name, run.sha256]));
  const withRows = new Set((db.prepare("SELECT DISTINCT map FROM current_coverage WHERE space = ?").all(space) as Array<{ map: string }>).map((row) => row.map));
  // A map that has no access has no rows: it is known by its SHA-256 alone.
  const isKnown = (map: (typeof hashed)[number]) => latest.get(map.name) === map.sha256 && (withRows.has(map.name) || map.bytes.every((byte) => byte === 0));
  const fresh = hashed.filter((map) => !isKnown(map));
  const evidence: Evidence[] = [...(context.evidence ?? []), ...fresh.map((map): Evidence => ({ kind: "coverage", ref: map.name, sha256: map.sha256, ...(space === DEFAULT_SPACE ? {} : { space }) }))];
  return write(db, { ...context, evidence }, "coverage", (change) => {
    const result = { space, imported: fresh.map((map) => map.name), replaced: fresh.filter((map) => latest.has(map.name) && latest.get(map.name) !== map.sha256).map((map) => map.name), known: hashed.filter((map) => !fresh.includes(map)).map((map) => map.name), added: 0, removed: 0 };
    if (fresh.length === 0) return result;
    // A revision for each import, also when the coverage does not change: the maps are its evidence.
    change.id();
    const before = currentCoverage(db, space);
    for (const map of fresh) {
      // Only a kind whose ranges differ from the earlier map of the path changes.
      const wanted = mapRanges(map.bytes);
      const rows = db.prepare("SELECT id, kind, ranges FROM current_coverage WHERE space = ? AND map = ?").all(space, map.name) as Array<{ id: string; kind: CoverageKind; ranges: string }>;
      for (const row of rows) {
        if (wanted.get(row.kind) === row.ranges) wanted.delete(row.kind);
        else change.close("coverage", "id = ?", row.id);
      }
      for (const [kind, ranges] of wanted) change.insertCoverage({ space, map: map.name, kind, ranges, origin: context.origin });
    }
    const after = currentCoverage(db, space);
    result.added = gained(before, after);
    result.removed = gained(after, before);
    return result;
  });
}

/** What the runs did at an address: executed (x wins), read and written (rw), read, written, or nothing (-). */
export type Access = "x" | "rw" | "r" | "w" | "-";

/** The bit of each coverage kind in a mask of kinds. */
const kindBit = (kind: CoverageKind) => 1 << COVERAGE_KINDS.indexOf(kind);
const maskOf = (kinds: readonly CoverageKind[]) => kinds.reduce((mask, kind) => mask | kindBit(kind), 0);

/** The kinds of coverage ranges that count as an execute, a read and a write: RAM, ROM and the I/O area. */
const EXECUTES = maskOf(["x", "rom-x", "io-x"]);
const READS = maskOf(["r", "rom-r", "io-r"]);
const WRITES = maskOf(["w", "io-w"]);

/** The access of a mask of coverage kinds: an execute wins, then a read and a write together. */
function accessOf(kinds: number): Access {
  if ((kinds & EXECUTES) !== 0) return "x";
  if ((kinds & READS) !== 0) return (kinds & WRITES) !== 0 ? "rw" : "r";
  return (kinds & WRITES) !== 0 ? "w" : "-";
}

/**
 * The access of the runs at an address in a space: the access of each coverage
 * map that the space has (by its path, also a map without accesses), and the
 * joined access of all maps. Undefined when the space has no coverage map.
 */
export function coverageAccess(db: DatabaseSync | undefined, space: Space = DEFAULT_SPACE): ((address: number) => { maps: Array<{ map: string; access: Access }>; access: Access }) | undefined {
  if (db === undefined) return undefined;
  const maps = [...new Set(coverageRuns(db).filter((run) => run.space === space).map((run) => run.name))];
  if (maps.length === 0) return undefined;
  // The kinds of each map at each address, as a mask: each lookup then reads one value for each map.
  const masks = new Map(maps.map((map) => [map, new Uint16Array(SIZE)]));
  for (const row of db.prepare("SELECT map, kind, ranges FROM current_coverage WHERE space = ?").all(space) as Array<{ map: string; kind: CoverageKind; ranges: string }>) {
    const mask = masks.get(row.map);
    if (mask === undefined) continue;
    const bit = kindBit(row.kind);
    forRanges(row.ranges, (start, end) => {
      for (let address = start; address <= end; address++) mask[address]! |= bit;
    });
  }
  return (address) => {
    let all = 0;
    const each = maps.map((map) => {
      const kinds = masks.get(map)![address]!;
      all |= kinds;
      return { map, access: accessOf(kinds) };
    });
    return { maps: each, access: accessOf(all) };
  };
}

/** The program of a space, or undefined when the knowledge has no bytes for it. */
export function programImage(db: DatabaseSync | undefined, space: Space = DEFAULT_SPACE): ProgramImage | undefined {
  if (db === undefined) return undefined;
  const rows = db.prepare("SELECT address, bytes FROM current_memory WHERE space = ? ORDER BY address").all(space) as Array<{ address: number; bytes: string }>;
  if (rows.length === 0) return undefined;
  const memory = new Uint8Array(SIZE);
  const segments: AddressRange[] = [];
  for (const row of rows) {
    const bytes = Buffer.from(row.bytes, "hex");
    memory.set(bytes, row.address);
    const end = row.address + bytes.length - 1;
    const last = segments.at(-1);
    if (last !== undefined && last.end + 1 === row.address) last.end = end;
    else segments.push({ start: row.address, end });
  }
  const image: ProgramImage = { space, segments, memory, byteAt: (address) => memory[address]! };
  const entry = db.prepare("SELECT address, state, stages FROM current_entries WHERE space = ?").get(space) as { address: number; state: string | null; stages: string | null } | undefined;
  if (entry !== undefined) {
    image.entry = entry.address;
    if (entry.state !== null) image.state = JSON.parse(entry.state) as Record<string, unknown>;
    if (entry.stages !== null) image.stages = JSON.parse(entry.stages) as Array<Record<string, unknown>>;
  }
  return image;
}

/** The program of a space for a tool; refused with the way to put it in when the knowledge has none. */
export function requireProgram(db: DatabaseSync | undefined, space: Space = DEFAULT_SPACE): ProgramImage {
  const image = programImage(db, space);
  if (image !== undefined) return image;
  const where = space === DEFAULT_SPACE ? "" : ` in ${space}`;
  throw new Refusal("not-found", `The knowledge has no program${where}. Put the program into the project knowledge${where}: a PRG, or the image.json of a capture.`);
}

/** The pages of an entry state: $0000-$03ff as the capture wrote them, 256 bytes as hex for each page. */
const STATE_PAGES = ["$0000", "$0100", "$0200", "$0300"] as const;

/**
 * The memory that the program has at its entry: the segments, and below them
 * $0002-$03ff of the entry state (the zero page, the stack and the system
 * pages hold code and data that the loader left). $0000 and $0001 are the
 * CPU port, not memory. A segment byte wins over a state byte.
 */
export function entryMemory(image: ProgramImage): Uint8Array {
  const memory = new Uint8Array(image.memory);
  const pages = image.state?.pages;
  if (typeof pages !== "object" || pages === null) return memory;
  const inSegment = (address: number) => image.segments.some((segment) => address >= segment.start && address <= segment.end);
  STATE_PAGES.forEach((page, index) => {
    const hex = (pages as Record<string, unknown>)[page];
    if (typeof hex !== "string" || !/^(?:[0-9a-fA-F]{2}){1,256}$/.test(hex)) return;
    Buffer.from(hex, "hex").forEach((byte, offset) => {
      const address = index * 0x100 + offset;
      if (address >= 2 && !inSegment(address)) memory[address] = byte;
    });
  });
  return memory;
}

/**
 * The bytes for an analyzer: a PRG for one segment without an entry state,
 * else the 64 KiB with the entry-state pages (entryMemory). DXA, the decompiler and
 * c64-source get the same bytes.
 */
export function analyzedBytes(image: ProgramImage): { bytes: Buffer; kind: "prg" | "flat64k" } {
  if (image.segments.length === 1 && image.state === undefined) {
    const [segment] = image.segments;
    return { bytes: Buffer.concat([Buffer.from([segment!.start & 0xff, segment!.start >> 8]), Buffer.from(image.memory.subarray(segment!.start, segment!.end + 1))]), kind: "prg" };
  }
  return { bytes: Buffer.from(entryMemory(image)), kind: "flat64k" };
}

/**
 * The coverage of a space as a joined coverage map (the bits of COVERAGE in
 * c64.ts), and the addresses that one run both wrote and executed; undefined
 * when the knowledge has no coverage for the space.
 */
export function programCoverage(db: DatabaseSync | undefined, space: Space = DEFAULT_SPACE): { map: Uint8Array; selfModified: Uint8Array } | undefined {
  if (db === undefined) return undefined;
  const has = db.prepare("SELECT 1 FROM current_coverage WHERE space = ? LIMIT 1").get(space);
  if (has === undefined) return undefined;
  const union = currentCoverage(db, space);
  const map = new Uint8Array(SIZE);
  for (const [kind, marks] of union) if (kind !== "wx") for (let address = 0; address < SIZE; address++) if (marks[address] === 1) map[address]! |= KIND_BITS[kind];
  return { map, selfModified: union.get("wx")! };
}

/**
 * The program of each space in the knowledge that operand, patch and macro
 * use writes in that space are checked against, with the platform names. A
 * byte outside the segments of the program is not in it. Each program is
 * read once, when a write in its space needs it.
 */
export function operandImages(db: DatabaseSync, platform: ReadonlyMap<string, number>): (space: string) => OperandImage {
  const images = new Map<string, OperandImage>();
  return (space) => {
    const known = images.get(space);
    if (known !== undefined) return known;
    const image = requireProgram(db, space);
    const inside = (at: number) => image.segments.some((segment) => at >= segment.start && at <= segment.end);
    const made: OperandImage = { byteAt: (at) => (inside(at) ? image.byteAt(at) : undefined), platform };
    images.set(space, made);
    return made;
  };
}

/**
 * The bytes of a release: the program for the base release, else the bytes
 * that the knowledge keeps for the release. Undefined when the space has no
 * release with this label.
 */
export function releaseImage(db: DatabaseSync | undefined, label: string, space: Space = DEFAULT_SPACE): Pick<ProgramImage, "segments" | "byteAt"> | undefined {
  if (db === undefined) return undefined;
  const release = db.prepare("SELECT base FROM current_releases WHERE space = ? AND label = ?").get(space, label) as { base: number } | undefined;
  if (release === undefined) return undefined;
  if (release.base === 1) return programImage(db, space);
  const rows = db.prepare("SELECT address, bytes FROM current_release_memory WHERE space = ? AND label = ? ORDER BY address").all(space, label) as Array<{ address: number; bytes: string }>;
  const memory = new Uint8Array(SIZE);
  const segments: AddressRange[] = [];
  for (const row of rows) {
    const bytes = Buffer.from(row.bytes, "hex");
    memory.set(bytes, row.address);
    const end = row.address + bytes.length - 1;
    const last = segments.at(-1);
    if (last !== undefined && last.end + 1 === row.address) last.end = end;
    else segments.push({ start: row.address, end });
  }
  return { segments, byteAt: (address) => memory[address]! };
}

/** The bytes of one !byte line of patch code. */
const PATCH_LINE_BYTES = 8;

/**
 * The bytes of a release in [start, end] as patch code: !byte lines. The base
 * release is refused: its bytes are the program, and a patch holds the other
 * state. A release without a byte at each address of the range is refused.
 */
export function releaseCode(db: DatabaseSync | undefined, label: string, start: number, end: number, space: Space = DEFAULT_SPACE): string {
  const range = `${formatC64Address(start)}-${formatC64Address(end)}`;
  const release = db?.prepare("SELECT base FROM current_releases WHERE space = ? AND label = ?").get(space, label) as { base: number } | undefined;
  if (release === undefined) throw new Refusal("not-found", `There is no release ${label}${space === DEFAULT_SPACE ? "" : ` in ${space}`}. Record it first with its file.`);
  if (release.base === 1) throw new Refusal("invalid-input", `${label} is the base release: its bytes are the program, and a patch holds the bytes of the other state. Give the release that has the other bytes in ${range}.`);
  const image = releaseImage(db, label, space)!;
  const inside = (address: number) => image.segments.some((segment) => address >= segment.start && address <= segment.end);
  for (let address = start; address <= end; address++) {
    if (!inside(address)) throw new Refusal("invalid-input", `The release ${label} has no byte at ${formatC64Address(address)}, in the range ${range}. Give a range inside the bytes of the release.`);
  }
  const lines: string[] = [];
  for (let at = start; at <= end; at += PATCH_LINE_BYTES) {
    const bytes = Array.from({ length: Math.min(PATCH_LINE_BYTES, end - at + 1) }, (_, offset) => formatC64Byte(image.byteAt(at + offset)));
    lines.push(`!byte ${bytes.join(",")}`);
  }
  return lines.join("\n");
}
