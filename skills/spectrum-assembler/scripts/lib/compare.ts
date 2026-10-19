// The byte check of a ZX Spectrum build: the assembled memory against the
// program in the knowledge, segment by segment.

import { formatAddress, formatByte } from "#src/address.ts";

export interface SegmentCheck {
  start: string;
  end: string;
  result: "identical" | "different" | "not covered";
  /** Bytes of the segment that the build does not fill. */
  uncovered?: number;
  differences?: number;
  /** The first address that differs, with its byte in the build and in the knowledge. */
  firstDifference?: { address: string; built: string; reference: string };
}

/**
 * Compares the built memory (`filled` tells the addresses that the build
 * fills) with the program of the knowledge. A snapshot gives the program all of
 * the RAM, and a source often holds only its code and data: `matches` is true
 * when each byte of the build is the byte of the knowledge, `identical` when the
 * build also fills each byte of the program.
 */
export function compareMemory(
  memory: Uint8Array,
  filled: ReadonlyArray<{ start: number; end: number }>,
  program: { segments: ReadonlyArray<{ start: number; end: number }>; byteAt: (address: number) => number },
): { identical: boolean; matches: boolean; segments: SegmentCheck[] } {
  const inBuild = (address: number) => filled.some((segment) => address >= segment.start && address <= segment.end);
  const checks = program.segments.map((segment): SegmentCheck => {
    let differences = 0;
    let uncovered = 0;
    let first: SegmentCheck["firstDifference"];
    for (let address = segment.start; address <= segment.end; address++) {
      if (!inBuild(address)) {
        uncovered++;
        continue;
      }
      if (memory[address] === program.byteAt(address)) continue;
      differences++;
      first ??= { address: formatAddress(address), built: formatByte(memory[address]!), reference: formatByte(program.byteAt(address)) };
    }
    return {
      start: formatAddress(segment.start),
      end: formatAddress(segment.end),
      result: differences > 0 ? "different" : uncovered > 0 ? "not covered" : "identical",
      ...(uncovered > 0 ? { uncovered } : {}),
      ...(differences > 0 ? { differences, firstDifference: first! } : {}),
    };
  });
  return { identical: checks.every((check) => check.result === "identical"), matches: checks.every((check) => check.differences === undefined), segments: checks };
}
