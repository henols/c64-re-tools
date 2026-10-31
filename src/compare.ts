// The byte check of a program: a PRG against a reference program, for example
// the program in the knowledge, segment by segment.

import { type AddressRange, formatC64Address, formatC64Byte, prgRange } from "./c64.ts";

export interface SegmentCheck {
  start: string;
  end: string;
  result: "identical" | "different" | "not covered";
  /** Bytes of the segment that the build does not hold. */
  uncovered?: number;
  differences?: number;
  /** The first address that differs and is in no left-out leftover, with its byte in the build and in the knowledge, each as $ and two hex digits. */
  firstDifference?: { address: string; built: string; reference: string };
  /** The left-out leftovers in the segment where the build is not the reference: differences counts the bytes there that differ or that the build does not hold. */
  leftovers?: Array<{ start: string; end: string; file: string; differences: number }>;
}

/** A leftover that the build leaves out: the range of a leftover file of a generated source that the build skips (LEFTOVERS = 0), with the file. */
export interface LeftOutLeftover extends AddressRange {
  file: string;
}

/** The program that the build is checked against: its segments and its bytes in them. */
export interface Reference {
  segments: ReadonlyArray<{ start: number; end: number }>;
  byteAt: (address: number) => number;
}

/**
 * Compares the assembled PRG with the reference, segment by segment. A byte of
 * a left-out leftover that differs or that the build does not hold still
 * counts, but the segment names that leftover in leftovers, and
 * firstDifference is the first different byte outside the leftovers.
 */
export function compareBuild(prg: Uint8Array, program: Reference, leftOut: readonly LeftOutLeftover[] = []): { identical: boolean; segments: SegmentCheck[] } {
  const built = prgRange(prg);
  const holds = (address: number) => address >= built.start && address <= built.end;
  /** The left-out leftovers of a segment where a byte differs or is not in the build. */
  const leftOutOf = (segment: AddressRange) =>
    leftOut.flatMap((range) => {
      let differences = 0;
      for (let address = Math.max(range.start, segment.start); address <= Math.min(range.end, segment.end); address++) {
        if (!holds(address) || built.body[address - built.start] !== program.byteAt(address)) differences++;
      }
      return differences === 0 ? [] : [{ start: formatC64Address(range.start), end: formatC64Address(range.end), file: range.file, differences }];
    });
  const isLeftOut = (address: number) => leftOut.some((range) => address >= range.start && address <= range.end);
  const checks = program.segments.map((segment): SegmentCheck => {
    const from = Math.max(segment.start, built.start);
    const to = Math.min(segment.end, built.end);
    const shown = { start: formatC64Address(segment.start), end: formatC64Address(segment.end) };
    const left = leftOutOf(segment);
    const named = left.length === 0 ? {} : { leftovers: left };
    if (from > to) return { ...shown, result: "not covered", uncovered: segment.end - segment.start + 1, ...named };
    let differences = 0;
    let first: SegmentCheck["firstDifference"];
    for (let address = from; address <= to; address++) {
      const builtByte = built.body[address - built.start]!;
      const referenceByte = program.byteAt(address);
      if (builtByte === referenceByte) continue;
      differences++;
      if (!isLeftOut(address)) first ??= { address: formatC64Address(address), built: formatC64Byte(builtByte), reference: formatC64Byte(referenceByte) };
    }
    const uncovered = segment.end - segment.start + 1 - (to - from + 1);
    return {
      ...shown,
      result: differences > 0 ? "different" : uncovered > 0 ? "not covered" : "identical",
      ...(uncovered > 0 ? { uncovered } : {}),
      ...(differences > 0 ? { differences } : {}),
      ...(first === undefined ? {} : { firstDifference: first }),
      ...named,
    };
  });
  return { identical: checks.every((check) => check.result === "identical"), segments: checks };
}

/** PRG files merged in load order, as the reference of a check: a later file wins where two overlap. */
export function mergedPrograms(programs: ReadonlyArray<{ start: number; body: Uint8Array }>): Reference {
  const memory = new Uint8Array(0x10000);
  const loaded = new Uint8Array(0x10000);
  for (const { start, body } of programs) {
    memory.set(body, start);
    loaded.fill(1, start, start + body.length);
  }
  const segments: Array<{ start: number; end: number }> = [];
  for (let address = 0; address < 0x10000; address++) {
    if (loaded[address] === 0) continue;
    const last = segments.at(-1);
    if (last !== undefined && last.end === address - 1) last.end = address;
    else segments.push({ start: address, end: address });
  }
  return { segments, byteAt: (address) => memory[address]! };
}
