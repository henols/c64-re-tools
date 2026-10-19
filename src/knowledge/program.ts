// The program in the knowledge: its bytes, its entry with the machine
// state and the stages of its unpacker, and the coverage of the runs. A
// capture and the coverage maps are imported one time; every later step reads
// them here, so a project needs no image or coverage files to be made again.

import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { Refusal } from "../errors.ts";
import { COVERAGE } from "../cpu/coverage.ts";
import { type AddressRange, formatAddress } from "../address.ts";

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
      throw new Refusal("invalid-input", `The segment ${formatAddress(segment.start)}-${formatAddress(segment.end)} is not a range from $0000 to $ffff.`);
    }
    if (index > 0 && segment.start <= sorted[index - 1]!.end) throw new Refusal("invalid-input", `The segments at ${formatAddress(sorted[index - 1]!.start)} and ${formatAddress(segment.start)} overlap.`);
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

/** The coverage of one space as ranges of each kind. */
function currentCoverage(db: DatabaseSync, space: Space): Map<CoverageKind, Uint8Array> {
  const maps = new Map<CoverageKind, Uint8Array>(COVERAGE_KINDS.map((kind) => [kind, new Uint8Array(SIZE)]));
  for (const row of db.prepare("SELECT kind, start_address, end_address FROM current_coverage WHERE space = ?").all(space) as Array<{ kind: CoverageKind; start_address: number; end_address: number }>) {
    maps.get(row.kind)!.fill(1, row.start_address, row.end_address + 1);
  }
  return maps;
}

/**
 * Joins coverage maps into the coverage of a space: adds the ranges of
 * the flags that no imported run set before, and as wx the addresses that one
 * run both wrote and executed. Each new map is evidence of the revision, with
 * its space. A map that the space has with the same name and bytes is not
 * imported again.
 */
export function addCoverage(
  db: DatabaseSync,
  context: WriteContext,
  request: { space?: Space; maps: CoverageMap[] },
): { revision: string | null; current: { space: Space; imported: string[]; known: string[]; ranges: number } } {
  checkSpace(request);
  const space = request.space ?? DEFAULT_SPACE;
  for (const map of request.maps) {
    if (map.bytes.length !== SIZE) throw new Refusal("invalid-input", `${map.name} has ${map.bytes.length} bytes; a coverage map has 65536, one for each address.`);
  }
  const hashed = request.maps.map((map) => ({ ...map, sha256: createHash("sha256").update(map.bytes).digest("hex") }));
  const known = new Set(coverageRuns(db).filter((run) => run.space === space).map((run) => `${run.name}\n${run.sha256}`));
  const fresh = hashed.filter((map) => !known.has(`${map.name}\n${map.sha256}`));
  const evidence: Evidence[] = [...(context.evidence ?? []), ...fresh.map((map): Evidence => ({ kind: "coverage", ref: map.name, sha256: map.sha256, ...(space === DEFAULT_SPACE ? {} : { space }) }))];
  return write(db, { ...context, evidence }, "coverage", (change) => {
    const result = { space, imported: fresh.map((map) => map.name), known: hashed.filter((map) => !fresh.includes(map)).map((map) => map.name), ranges: 0 };
    if (fresh.length === 0) return result;
    // A revision for each import, also when no flag is new: the maps are its evidence.
    change.id();
    const union = currentCoverage(db, space);
    for (const map of fresh) {
      for (const kind of COVERAGE_KINDS) {
        const has = kind === "wx" ? (address: number) => (map.bytes[address]! & (COVERAGE.ramWrite | COVERAGE.ramExecute)) === (COVERAGE.ramWrite | COVERAGE.ramExecute) : (address: number) => (map.bytes[address]! & KIND_BITS[kind]) !== 0;
        const known = union.get(kind)!;
        for (const range of rangesWhere((address) => known[address] === 0 && has(address))) {
          change.insertCoverage({ space, kind, start: range.start, end: range.end, origin: context.origin });
          known.fill(1, range.start, range.end + 1);
          result.ranges++;
        }
      }
    }
    return result;
  });
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
 * else the 64 KiB with the entry-state pages (entryMemory). DXA, Ghidra and
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
  const rows = db.prepare("SELECT kind, start_address, end_address FROM current_coverage WHERE space = ?").all(space) as Array<{ kind: CoverageKind; start_address: number; end_address: number }>;
  if (rows.length === 0) return undefined;
  const map = new Uint8Array(SIZE);
  const selfModified = new Uint8Array(SIZE);
  for (const row of rows) {
    if (row.kind === "wx") selfModified.fill(1, row.start_address, row.end_address + 1);
    else for (let address = row.start_address; address <= row.end_address; address++) map[address]! |= KIND_BITS[row.kind];
  }
  return { map, selfModified };
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
