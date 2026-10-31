// 6502 idioms that hide code from a disassembler: RTS dispatch tables,
// JMP tables and BIT skips are found by their exact instruction patterns and
// become heuristic findings and entry points; DOP padding and self-modified
// opcodes are only reported. The CBM80 header of a cartridge bank at $8000
// gives its two start vectors as entry points. A self-modified opcode is one that one run wrote
// and executed, in either order, since a coverage file holds no order:
// a copier's writes in one run and their execution in another do not count. A table's length is not known statically: entries
// count while each target is a plausible instruction in the program.
// The knowledge of the user and the LLM wins: an idiom gives no region, no
// reference and no entry point where their region has another type or a
// removal holds the bytes, and a table ends where their region ends. A $2c in
// an instruction that a run executed is an operand, not a BIT.

import { COVERAGE, instructionLength } from "#src/c64.ts";
import type { NormalizedFindings } from "#src/knowledge/import.ts";
import { CODE_REGION_TYPES, type ReferenceKind, type RegionType } from "#src/knowledge/schema.ts";
import type { ImageByte } from "./coverage.ts";

const MAX_TABLE = 64;
const MIN_JUMPS = 3;
const LDA_INDEXED = new Set([0xbd, 0xb9]);
const JAMS = new Set([0x02, 0x12, 0x22, 0x32, 0x42, 0x52, 0x62, 0x72, 0x92, 0xb2, 0xd2, 0xf2]);
/** Undocumented NOPs with an operand byte (DOP): padding between instructions hides the real ones. */
const DOPS = new Set([0x04, 0x14, 0x34, 0x44, 0x54, 0x64, 0x74, 0x80, 0x82, 0x89, 0xc2, 0xd4, 0xe2, 0xf4]);
/** "CBM80" in PETSCII at $8004: the KERNAL then starts the cartridge through the vectors at $8000 (cold) and $8002 (warm). */
const CBM80 = [0xc3, 0xc2, 0xcd, 0x38, 0x30];

/** An idiom that the pass found but could not record: its bytes leave the program, or an idiom found before holds some of them. */
export interface LeftOutIdiom {
  start: number;
  end: number;
  kind: "cartridge-header" | "rts-table" | "jump-table" | "bit-skip";
  reason: "leaves-program" | "overlaps-idiom";
}

/** What the user and the LLM decided: their regions, the ranges where they removed a region, and the references that they removed. */
export interface Decided {
  regions: ReadonlyArray<{ start: number; end: number; type: RegionType }>;
  removedRegions: ReadonlyArray<{ start: number; end: number }>;
  removedReference: (reference: { from: number; to: number; kind: ReferenceKind }) => boolean;
}

const NOTHING_DECIDED: Decided = { regions: [], removedRegions: [], removedReference: () => false };

/** A decided range: a region of the user or the LLM, or a range where they removed a region (no type). */
type DecidedRange = { start: number; end: number; type?: RegionType };

/**
 * True when an idiom can claim bytes of the type `claim` in a decided range:
 * the same type, or code against code and data against data. A removal never
 * agrees. dual-use bytes are code and data, so a claim of code or data agrees
 * with them, but only dual-use agrees with a claim of dual-use.
 */
function agrees(claim: RegionType, decided: DecidedRange): boolean {
  if (decided.type === undefined) return false;
  if (decided.type === claim) return true;
  if (claim === "dual-use") return false;
  if (decided.type === "dual-use") return true;
  return CODE_REGION_TYPES.includes(claim) === CODE_REGION_TYPES.includes(decided.type);
}

export interface Idioms {
  findings: NormalizedFindings;
  /** Entry points for the same analysis run: analyzer facts are never seeds. */
  entryPoints: number[];
  /** Table ranges for the same run: they are data. */
  dataRanges: Array<{ start: number; end: number }>;
  counts: { cartridgeHeaders: number; rtsTables: number; jumpTables: number; bitSkips: number };
  /** The idioms that were found but not recorded, with the reason. */
  leftOut: LeftOutIdiom[];
  /** Seen in the coverage, not written: the LLM decides. All of them: the result lists the first ones. */
  candidates: { dop: number[]; selfModified: number[] };
}

/** True when an instruction can start at the address: inside the range and the program (`byteAt` gives a byte), and no JAM. */
function plausible(byteAt: ImageByte, address: number, range: { start: number; end: number }): boolean {
  const opcode = byteAt(address);
  return address >= range.start && address <= range.end && opcode !== undefined && !JAMS.has(opcode);
}

const word = (byteAt: ImageByte, address: number) => {
  const low = byteAt(address);
  const high = byteAt(address + 1);
  return low === undefined || high === undefined ? undefined : low | (high << 8);
};

/**
 * `byteAt` gives the bytes of the program and undefined outside it, so a
 * table and its targets stay inside the program. `covered` is the coverage of
 * the knowledge: the joined map, and the addresses that one run wrote and executed.
 * `decided` is the knowledge of the user and the LLM.
 */
export function findIdioms(byteAt: ImageByte, range: { start: number; end: number }, covered?: { map: Uint8Array; selfModified: Uint8Array }, decided: Decided = NOTHING_DECIDED): Idioms {
  const coverage = covered?.map;
  // The decided range at each address: its index in `ranges`, or -1.
  const ranges: DecidedRange[] = [...decided.regions, ...decided.removedRegions.map(({ start, end }) => ({ start, end }))];
  const holder = new Int32Array(0x10000).fill(-1);
  ranges.forEach((item, index) => holder.fill(index, Math.max(0, item.start), Math.min(0xffff, item.end) + 1));
  const decidedAt = (address: number) => (address >= 0 && address <= 0xffff ? holder[address]! : -1);
  /** True when the bytes of one part of an idiom are all in one decided range that agrees with the claim, or in none. */
  const fits = (start: number, end: number, claim: RegionType) => {
    const first = decidedAt(start);
    for (let address = start + 1; address <= end; address++) if (decidedAt(address) !== first) return false;
    return first === -1 || agrees(claim, ranges[first]!);
  };
  /** True when no region of the user or the LLM holds the address with a type that is not code. */
  const mayBeCode = (address: number) => {
    const index = decidedAt(address);
    return index === -1 || ranges[index]!.type === undefined || agrees("code", ranges[index]!);
  };
  /** True when a run executed an instruction that holds the address as an operand byte, and no run executed an instruction at the address. */
  const inExecutedOperand = (address: number) => {
    if (coverage === undefined || (coverage[address]! & COVERAGE.ramExecute) !== 0) return false;
    for (let back = 1; back <= 2; back++) {
      const start = address - back;
      const opcode = byteAt(start);
      if (opcode !== undefined && (coverage[start]! & COVERAGE.ramExecute) !== 0 && instructionLength(opcode) > back) return true;
    }
    return false;
  };
  const regions: NormalizedFindings["regions"] = [];
  const references: NormalizedFindings["references"] = [];
  const entryPoints = new Set<number>();
  const counts = { cartridgeHeaders: 0, rtsTables: 0, jumpTables: 0, bitSkips: 0 };
  const leftOut: LeftOutIdiom[] = [];
  const taken = (start: number, end: number) => regions.some((region) => start <= region.end && end >= region.start);
  const blocked = (start: number, end: number): LeftOutIdiom["reason"] | undefined => (start < range.start || end > range.end ? "leaves-program" : taken(start, end) ? "overlaps-idiom" : undefined);
  /** Records the region of an idiom when all of its parts fit; else records why the idiom is left out. */
  const addRegions = (kind: LeftOutIdiom["kind"], parts: ReadonlyArray<{ start: number; end: number; type: NormalizedFindings["regions"][number]["type"] }>) => {
    for (const part of parts) {
      const reason = blocked(part.start, part.end) ?? (parts.some((other) => other !== part && part.start <= other.end && part.end >= other.start) ? "overlaps-idiom" : undefined);
      if (reason === undefined) continue;
      leftOut.push({ start: Math.min(...parts.map((item) => item.start)), end: Math.max(...parts.map((item) => item.end)), kind, reason });
      return false;
    }
    regions.push(...parts);
    return true;
  };

  if (range.start <= 0x8000 && range.end >= 0x8008 && CBM80.every((byte, index) => byteAt(0x8004 + index) === byte)) {
    const vectors = [word(byteAt, 0x8000)!, word(byteAt, 0x8002)!].filter((target) => plausible(byteAt, target, range) && mayBeCode(target));
    if (fits(0x8000, 0x8003, "addresses") && fits(0x8004, 0x8008, "petscii") && addRegions("cartridge-header", [{ start: 0x8000, end: 0x8003, type: "addresses" }, { start: 0x8004, end: 0x8008, type: "petscii" }])) {
      counts.cartridgeHeaders++;
      for (const target of vectors) entryPoints.add(target);
    }
  }

  for (let at = range.start; at + 8 <= range.end; at++) {
    // RTS dispatch: LDA high,X / PHA / LDA low,X / PHA / RTS.
    if (LDA_INDEXED.has(byteAt(at)!) && byteAt(at + 3) === 0x48 && LDA_INDEXED.has(byteAt(at + 4)!) && byteAt(at + 7) === 0x48 && byteAt(at + 8) === 0x60) {
      const high = word(byteAt, at + 1)!;
      const low = word(byteAt, at + 5)!;
      const interleaved = high === low + 1;
      const step = interleaved ? 2 : 1;
      // A table is data: it ends where the decided range at its start ends.
      if (!fits(low, low, "bytes") || !fits(high, high, "bytes")) continue;
      const lowRange = decidedAt(low);
      const highRange = decidedAt(high);
      const targets: number[] = [];
      for (let index = 0; index < MAX_TABLE; index++) {
        if (decidedAt(low + index * step) !== lowRange || decidedAt(high + index * step) !== highRange) break;
        const lowByte = byteAt(low + index * step);
        const highByte = byteAt(high + index * step);
        if (lowByte === undefined || highByte === undefined) break;
        const target = ((highByte << 8) | lowByte) + 1;
        if (!plausible(byteAt, target, range)) break;
        targets.push(target);
      }
      if (targets.length === 0) continue;
      const n = targets.length;
      const parts: Parameters<typeof addRegions>[1] = interleaved
        ? [{ start: low, end: low + 2 * n - 1, type: "rts-addresses" }]
        : low + n === high
          ? [{ start: low, end: high + n - 1, type: "rts-addresses-split" }]
          : [{ start: low, end: low + n - 1, type: "bytes" }, { start: high, end: high + n - 1, type: "bytes" }];
      // Another dispatch through the same table: the table is recorded, and this RTS goes to its targets too.
      const known = parts.every((part) => regions.some((region) => region.start === part.start && region.end === part.end && region.type === part.type));
      if (!known) {
        if (!addRegions("rts-table", parts)) continue;
        counts.rtsTables++;
      }
      // A target in data of the user or the LLM, or a reference that they removed, gives no reference and no entry point.
      for (const target of targets) {
        const reference = { from: at + 8, to: target, kind: "jump" as const };
        if (!mayBeCode(target) || decided.removedReference(reference)) continue;
        references.push(reference);
        entryPoints.add(target);
      }
    }
  }

  // JMP tables: at least three JMP abs in a row.
  for (let at = range.start; at + 3 * MIN_JUMPS - 1 <= range.end; at++) {
    let n = 0;
    while (at + 3 * n + 2 <= range.end && byteAt(at + 3 * n) === 0x4c) n++;
    if (n < MIN_JUMPS) continue;
    // The JMPs inside the run are the same table: a run that is left out is left out once.
    const run = n;
    // A JMP table is code: it ends where the decided range at its start ends.
    if (fits(at, at, "jumps")) while (n > 0 && !fits(at, at + 3 * n - 1, "jumps")) n--;
    else n = 0;
    if (n >= MIN_JUMPS && addRegions("jump-table", [{ start: at, end: at + 3 * n - 1, type: "jumps" }])) {
      counts.jumpTables++;
      for (let index = 0; index < n; index++) {
        entryPoints.add(at + 3 * index);
        const target = word(byteAt, at + 3 * index + 1)!;
        if (plausible(byteAt, target, range) && mayBeCode(target)) entryPoints.add(target);
      }
    }
    at += 3 * run - 1;
  }

  // BIT skips: BIT abs ($2c) whose operand bytes are an instruction that a JMP, a JSR or the coverage enters.
  // A $2c in an executed instruction is its operand; the BIT is code and its operand bytes are dual-use.
  const entered = new Set<number>();
  for (let at = range.start; at + 2 <= range.end; at++) {
    if (byteAt(at) === 0x4c || byteAt(at) === 0x20) entered.add(word(byteAt, at + 1)!);
  }
  if (coverage !== undefined) for (let address = range.start; address <= range.end; address++) if ((coverage[address]! & COVERAGE.ramExecute) !== 0) entered.add(address);
  for (let at = range.start; at + 2 <= range.end; at++) {
    if (byteAt(at) !== 0x2c || !entered.has(at + 1) || !plausible(byteAt, at + 1, range) || inExecutedOperand(at)) continue;
    if (!fits(at, at, "code") || !fits(at + 1, at + 2, "dual-use")) continue;
    if (!addRegions("bit-skip", [{ start: at + 1, end: at + 2, type: "dual-use" }])) continue;
    counts.bitSkips++;
    entryPoints.add(at);
    entryPoints.add(at + 1);
    for (let from = range.start; from + 2 <= range.end; from++) {
      if ((byteAt(from) === 0x4c || byteAt(from) === 0x20) && word(byteAt, from + 1) === at + 1) references.push({ from, to: at + 1, kind: byteAt(from) === 0x20 ? "call" : "jump" });
    }
  }

  // Candidates from the coverage: DOP padding that ran, and opcodes that one run wrote and executed.
  const candidates = { dop: [] as number[], selfModified: [] as number[] };
  if (coverage !== undefined) {
    for (let address = range.start; address <= range.end; address++) {
      if ((coverage[address]! & COVERAGE.ramExecute) === 0) continue;
      if (DOPS.has(byteAt(address)!)) candidates.dop.push(address);
      if (covered!.selfModified[address] === 1) candidates.selfModified.push(address);
    }
  }

  regions.sort((a, b) => a.start - b.start);
  const dataRanges = regions.filter((region) => region.type !== "jumps" && region.type !== "dual-use").map(({ start, end }) => ({ start, end }));
  return {
    findings: {
      analyzer: "heuristic",
      coverage: [range],
      authoritative: { symbols: true, regions: true, references: true },
      symbols: [],
      regions,
      // Each reference once: the importer keys them by from, to and kind.
      references: [...new Map(references.map((reference) => [`${reference.from}|${reference.to}|${reference.kind}`, reference])).values()],
    },
    entryPoints: [...entryPoints].sort((a, b) => a - b),
    dataRanges,
    counts,
    leftOut,
    candidates,
  };
}
