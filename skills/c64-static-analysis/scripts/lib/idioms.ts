// 6502 idioms that hide code from a disassembler: RTS dispatch tables,
// JMP tables and BIT skips are found by their exact instruction patterns and
// become heuristic findings and entry points; DOP padding and self-modified
// opcodes are only reported. The CBM80 header of a cartridge bank at $8000
// gives its two start vectors as entry points. A self-modified opcode is one that one run wrote
// and executed, in either order, since a coverage file holds no order:
// a copier's writes in one run and their execution in another do not count. A table's length is not known statically: entries
// count while each target is a plausible instruction in the program.

import { COVERAGE } from "#src/c64.ts";
import type { NormalizedFindings } from "#src/knowledge/import.ts";
import type { ImageByte } from "./coverage.ts";

const MAX_TABLE = 64;
const MIN_JUMPS = 3;
const LDA_INDEXED = new Set([0xbd, 0xb9]);
const JAMS = new Set([0x02, 0x12, 0x22, 0x32, 0x42, 0x52, 0x62, 0x72, 0x92, 0xb2, 0xd2, 0xf2]);
/** Undocumented NOPs with an operand byte (DOP): padding between instructions hides the real ones. */
const DOPS = new Set([0x04, 0x14, 0x34, 0x44, 0x54, 0x64, 0x74, 0x80, 0x82, 0x89, 0xc2, 0xd4, 0xe2, 0xf4]);
/** "CBM80" in PETSCII at $8004: the KERNAL then starts the cartridge through the vectors at $8000 (cold) and $8002 (warm). */
const CBM80 = [0xc3, 0xc2, 0xcd, 0x38, 0x30];

export interface Idioms {
  findings: NormalizedFindings;
  /** Entry points for the same analysis run: analyzer facts are never seeds. */
  entryPoints: number[];
  /** Table ranges for the same run: they are data. */
  dataRanges: Array<{ start: number; end: number }>;
  counts: { cartridgeHeaders: number; rtsTables: number; jumpTables: number; bitSkips: number };
  /** Seen in the coverage, not written: the LLM decides. All of them: the result lists the first ones. */
  candidates: { dop: number[]; selfModified: number[] };
}

/** True when an instruction can start at the address: inside the program, and no JAM. */
function plausible(byteAt: ImageByte, address: number, range: { start: number; end: number }): boolean {
  const opcode = byteAt(address);
  return address >= range.start && address <= range.end && opcode !== undefined && !JAMS.has(opcode);
}

const word = (byteAt: ImageByte, address: number) => {
  const low = byteAt(address);
  const high = byteAt(address + 1);
  return low === undefined || high === undefined ? undefined : low | (high << 8);
};

/** `covered` is the coverage of the knowledge: the joined map, and the addresses that one run wrote and executed. */
export function findIdioms(byteAt: ImageByte, range: { start: number; end: number }, covered?: { map: Uint8Array; selfModified: Uint8Array }): Idioms {
  const coverage = covered?.map;
  const regions: NormalizedFindings["regions"] = [];
  const references: NormalizedFindings["references"] = [];
  const entryPoints = new Set<number>();
  const counts = { cartridgeHeaders: 0, rtsTables: 0, jumpTables: 0, bitSkips: 0 };
  const taken = (start: number, end: number) => regions.some((region) => start <= region.end && end >= region.start);
  const addRegion = (start: number, end: number, type: NormalizedFindings["regions"][number]["type"]) => {
    if (start < range.start || end > range.end || taken(start, end)) return false;
    regions.push({ start, end, type });
    return true;
  };

  if (range.start <= 0x8000 && range.end >= 0x8008 && CBM80.every((byte, index) => byteAt(0x8004 + index) === byte)) {
    const vectors = [word(byteAt, 0x8000)!, word(byteAt, 0x8002)!].filter((target) => plausible(byteAt, target, range));
    if (addRegion(0x8000, 0x8003, "addresses") && addRegion(0x8004, 0x8008, "petscii")) {
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
      const targets: number[] = [];
      for (let index = 0; index < MAX_TABLE; index++) {
        const lowByte = byteAt(low + index * step);
        const highByte = byteAt(high + index * step);
        if (lowByte === undefined || highByte === undefined) break;
        const target = ((highByte << 8) | lowByte) + 1;
        if (!plausible(byteAt, target, range)) break;
        targets.push(target);
      }
      if (targets.length === 0) continue;
      const n = targets.length;
      const written = interleaved
        ? addRegion(low, low + 2 * n - 1, "rts-addresses")
        : low + n === high
          ? addRegion(low, high + n - 1, "rts-addresses-split")
          : addRegion(low, low + n - 1, "bytes") && addRegion(high, high + n - 1, "bytes");
      if (!written) continue;
      counts.rtsTables++;
      for (const target of targets) {
        references.push({ from: at + 8, to: target, kind: "jump" });
        entryPoints.add(target);
      }
    }
  }

  // JMP tables: at least three JMP abs in a row.
  for (let at = range.start; at + 3 * MIN_JUMPS - 1 <= range.end; at++) {
    let n = 0;
    while (at + 3 * n + 2 <= range.end && byteAt(at + 3 * n) === 0x4c) n++;
    if (n < MIN_JUMPS || !addRegion(at, at + 3 * n - 1, "jumps")) continue;
    counts.jumpTables++;
    for (let index = 0; index < n; index++) {
      entryPoints.add(at + 3 * index);
      const target = word(byteAt, at + 3 * index + 1)!;
      if (plausible(byteAt, target, range)) entryPoints.add(target);
    }
    at += 3 * n - 1;
  }

  // BIT skips: BIT abs ($2c) whose operand bytes are an instruction that a JMP, a JSR or the coverage enters.
  const entered = new Set<number>();
  for (let at = range.start; at + 2 <= range.end; at++) {
    if (byteAt(at) === 0x4c || byteAt(at) === 0x20) entered.add(word(byteAt, at + 1)!);
  }
  if (coverage !== undefined) for (let address = range.start; address <= range.end; address++) if ((coverage[address]! & COVERAGE.ramExecute) !== 0) entered.add(address);
  for (let at = range.start; at + 2 <= range.end; at++) {
    if (byteAt(at) !== 0x2c || !entered.has(at + 1) || !plausible(byteAt, at + 1, range)) continue;
    if (!addRegion(at + 1, at + 2, "dual-use")) continue;
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
    candidates,
  };
}
