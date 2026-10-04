// Local evidence of packing for the c64-unpacker script: where BASIC hands
// over and how compressed the bytes look. It never names a packer.

import { formatC64Address } from "#src/c64.ts";

export class PackingError extends Error {}

/** A 256-byte block above this many bits per byte looks compressed (measured: code at most 6.95, compressed data at least 6.92). */
const HIGH_ENTROPY = 6.9;
const BLOCK = 256;

function entropy(bytes: Uint8Array): number {
  const counts = new Array<number>(256).fill(0);
  for (const byte of bytes) counts[byte]!++;
  let bits = 0;
  for (const count of counts) {
    if (count === 0) continue;
    const p = count / bytes.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/** The constant SYS address of the first BASIC line, when the program starts with one. */
function basicSys(program: Uint8Array): { line: number; address: number; end: number } | undefined {
  if (program.length < 8 || program[0] !== 0x01 || program[1] !== 0x08) return undefined;
  const number = program[4]! | (program[5]! << 8);
  const end = program.indexOf(0, 6);
  if (end < 0) return undefined;
  const sys = program.subarray(6, end).indexOf(0x9e);
  if (sys < 0) return undefined;
  const digits = Buffer.from(program.subarray(6 + sys + 1, end)).toString("latin1").replace(/[ (]/g, "");
  const match = /^(\d{1,5})/.exec(digits);
  if (match === null || Number(match[1]) > 0xffff) return undefined;
  return { line: number, address: Number(match[1]), end: 0x0801 + end - 2 };
}

export function inspect(program: Uint8Array): Record<string, unknown> {
  if (program.length < 3) throw new PackingError("the file is too short for a PRG");
  const load = program[0]! | (program[1]! << 8);
  const end = load + program.length - 3;
  const stub = basicSys(program);
  // Without a BASIC start, all bytes count; with one, only the bytes after the BASIC line.
  const from = stub === undefined ? 2 : Math.min(program.length, stub.end - load + 2 + 3);
  const body = program.subarray(from);
  const blocks: number[] = [];
  for (let at = 0; at + BLOCK <= body.length; at += BLOCK) blocks.push(entropy(body.subarray(at, at + BLOCK)));
  const high = blocks.filter((value) => value > HIGH_ENTROPY).length;
  const share = blocks.length === 0 ? 0 : high / blocks.length;
  const packing = blocks.length < 2 ? "unclear" : share >= 0.75 ? "likely" : share <= 0.1 ? "unlikely" : "unclear";
  const sorted = [...blocks].sort((a, b) => a - b);
  return {
    loadRange: { start: formatC64Address(load), end: formatC64Address(Math.min(end, 0xffff)) },
    bytes: program.length - 2,
    basicStart: stub === undefined ? null : { line: stub.line, sys: formatC64Address(stub.address) },
    entropy: {
      blocks: blocks.length,
      highBlocks: high,
      median: sorted.length === 0 ? null : Number(sorted[sorted.length >> 1]!.toFixed(2)),
    },
    packing,
    evidence:
      packing === "likely"
        ? `${high} of ${blocks.length} blocks of 256 bytes look compressed (above ${HIGH_ENTROPY} bits per byte); code and data are usually below.`
        : packing === "unlikely"
          ? `Only ${high} of ${blocks.length} blocks look compressed; the bytes look like code and data.`
          : "The entropy does not show clearly if the program is packed. Run it and look at what it writes to memory.",
  };
}
