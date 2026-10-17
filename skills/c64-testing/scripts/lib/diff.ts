// The differences between two machine states: changed ranges of RAM and
// colour RAM, and changed chip registers and CPU registers. The states come
// from snapshots that VICE restores, from memory files, or from the
// observations of runs; this file only compares.

import { Refusal } from "#src/errors.ts";

export interface MachineState {
  /** Bytes from `base`: all 64 KiB of RAM, or the bytes of one memory file. */
  memory?: { base: number; bytes: Uint8Array };
  /** Colour RAM $D800-$DBFF, the low 4 bits of each byte. */
  colorRam?: Uint8Array;
  /** Named single values: VIC-II, CIA and SID registers and the CPU registers, as "vic.$d011", "cia1.timerA", "cpu.pc", and each CPU flag as "cpu.flags.c". */
  values?: Record<string, number | boolean>;
  /** The memory items of an observation of a run: the address or name, and its bytes as hex. */
  observed?: Record<string, string>;
}

export interface ChangedRange {
  start: number;
  end: number;
  /** The bytes of both states, as hex, when the range has at most 16 bytes. */
  a?: string;
  b?: string;
}

export interface StateDiff {
  memory?: { changedBytes: number; ranges: ChangedRange[] };
  colorRam?: { changedBytes: number; ranges: ChangedRange[] };
  values?: Array<{ name: string; a: number | boolean; b: number | boolean }>;
  observed?: Array<{ address: string; a: string; b: string }>;
}

/** Changed ranges of two byte arrays of one length, joined across gaps of at most `gap` equal bytes. */
export function changedRanges(a: Uint8Array, b: Uint8Array, base: number, gap = 0): { changedBytes: number; ranges: ChangedRange[] } {
  const ranges: ChangedRange[] = [];
  let changedBytes = 0;
  for (let offset = 0; offset < a.length; offset++) {
    if (a[offset] === b[offset]) continue;
    changedBytes++;
    const last = ranges.at(-1);
    if (last !== undefined && base + offset - last.end - 1 <= gap) last.end = base + offset;
    else ranges.push({ start: base + offset, end: base + offset });
  }
  for (const range of ranges) {
    if (range.end - range.start + 1 > 16) continue;
    range.a = Buffer.from(a.subarray(range.start - base, range.end - base + 1)).toString("hex");
    range.b = Buffer.from(b.subarray(range.start - base, range.end - base + 1)).toString("hex");
  }
  return { changedBytes, ranges };
}

/** What differs between two states, for each part that both have. */
export function diffStates(a: MachineState, b: MachineState, gap = 0): StateDiff {
  const result: StateDiff = {};
  if (a.memory !== undefined && b.memory !== undefined) {
    if (a.memory.base !== b.memory.base || a.memory.bytes.length !== b.memory.bytes.length) throw new Refusal("operation-failed", "the two memory parts do not cover the same addresses");
    result.memory = changedRanges(a.memory.bytes, b.memory.bytes, a.memory.base, gap);
  }
  if (a.colorRam !== undefined && b.colorRam !== undefined) result.colorRam = changedRanges(a.colorRam, b.colorRam, 0xd800, gap);
  if (a.values !== undefined && b.values !== undefined) {
    result.values = Object.keys(a.values)
      .filter((name) => b.values![name] !== undefined && a.values![name] !== b.values![name])
      .map((name) => ({ name, a: a.values![name]!, b: b.values![name]! }));
  }
  if (a.observed !== undefined && b.observed !== undefined) {
    result.observed = Object.keys(a.observed)
      .filter((at) => b.observed![at] !== undefined && a.observed![at] !== b.observed![at])
      .map((at) => ({ address: at, a: a.observed![at]!, b: b.observed![at]! }));
  }
  return result;
}
