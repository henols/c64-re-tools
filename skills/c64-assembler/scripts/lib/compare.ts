// The byte check of a build: the assembled program against the program
// in the knowledge, segment by segment.

import { formatC64Address, formatC64Byte, prgRange } from "#src/c64.ts";

export interface SegmentCheck {
  start: string;
  end: string;
  result: "identical" | "different" | "not covered";
  /** Bytes of the segment that the build does not hold. */
  uncovered?: number;
  differences?: number;
  /** The first address that differs, with its byte in the build and in the knowledge, each as $ and two hex digits. */
  firstDifference?: { address: string; built: string; reference: string };
}

/** The program that the build is checked against: its segments and its bytes in them. */
export interface Reference {
  segments: ReadonlyArray<{ start: number; end: number }>;
  byteAt: (address: number) => number;
}

/** Compares the assembled PRG with the reference, segment by segment. */
export function compareBuild(prg: Uint8Array, program: Reference): { identical: boolean; segments: SegmentCheck[] } {
  const built = prgRange(prg);
  const checks = program.segments.map((segment): SegmentCheck => {
    const from = Math.max(segment.start, built.start);
    const to = Math.min(segment.end, built.end);
    const shown = { start: formatC64Address(segment.start), end: formatC64Address(segment.end) };
    if (from > to) return { ...shown, result: "not covered", uncovered: segment.end - segment.start + 1 };
    let differences = 0;
    let first: SegmentCheck["firstDifference"];
    for (let address = from; address <= to; address++) {
      const builtByte = built.body[address - built.start]!;
      const referenceByte = program.byteAt(address);
      if (builtByte === referenceByte) continue;
      differences++;
      first ??= { address: formatC64Address(address), built: formatC64Byte(builtByte), reference: formatC64Byte(referenceByte) };
    }
    const uncovered = segment.end - segment.start + 1 - (to - from + 1);
    return {
      ...shown,
      result: differences > 0 ? "different" : uncovered > 0 ? "not covered" : "identical",
      ...(uncovered > 0 ? { uncovered } : {}),
      ...(differences > 0 ? { differences, firstDifference: first! } : {}),
    };
  });
  return { identical: checks.every((check) => check.result === "identical"), segments: checks };
}
