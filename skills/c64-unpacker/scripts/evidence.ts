// Local evidence of packing for the c64-unpacker script: where BASIC hands
// over and how compressed the bytes look. It never names a packer.

import { formatC64Address } from "#src/c64.ts";

export class PackingError extends Error {}

/** A 256-byte block above this many bits per byte looks compressed. */
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

/** The local packing evidence of one PRG. */
export interface PackingEvidence {
  loadRange: { start: string; end: string };
  bytes: number;
  /** The first BASIC line and its constant SYS address, or null when the program has none. */
  basicStart: { line: number; sys: string } | null;
  entropy: { blocks: number; highBlocks: number; median: number | null };
  packing: "likely" | "unlikely" | "unclear";
  evidence: string;
}

export function inspect(program: Uint8Array): PackingEvidence {
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
          ? `Only ${high} of ${blocks.length} blocks look compressed; the bytes look like code and data. A simple cruncher can look the same: run trace to see if the program writes code and then executes it.`
          : "The entropy does not show clearly if the program is packed. Run it and look at what it writes to memory.",
  };
}

/** One range of the emulator's memory map: what the program did with these addresses. */
export interface AccessRange {
  start: number;
  end: number;
  read: boolean;
  write: boolean;
  execute: boolean;
}

/** The addresses that one memory map read covers before it is split. */
const MEMMAP_WINDOW = 0x1000;

/**
 * Reads the memory map of $0000-$ffff in windows, in address order. `read`
 * gives at most `maxRanges` ranges for one window; a window that gives that
 * many can have more, so it is read again as two halves.
 */
export async function readMemoryMap(read: (start: number, end: number) => Promise<AccessRange[]>, maxRanges: number): Promise<AccessRange[]> {
  const ranges: AccessRange[] = [];
  const window = async (start: number, end: number): Promise<void> => {
    const found = await read(start, end);
    if (found.length < maxRanges || start === end) {
      ranges.push(...found);
      return;
    }
    const middle = Math.floor((start + end) / 2);
    await window(start, middle);
    await window(middle + 1, end);
  };
  for (let start = 0; start <= 0xffff; start += MEMMAP_WINDOW) await window(start, start + MEMMAP_WINDOW - 1);
  return ranges;
}

/** ROM areas: an address here can be written (RAM below) and executed (ROM) without one being the other. */
export const underRom = (address: number) => (address >= 0xa000 && address <= 0xbfff) || address >= 0xe000;

/**
 * The memory that the program wrote and then executed, in pieces of code.
 * `bytes` and `running` count only RAM outside the ROM areas: a write under
 * a ROM and code that runs in that ROM are not one piece of code.
 */
export function writtenThenExecuted(ranges: AccessRange[], pc: number): { written: Array<{ start: number; end: number }>; bytes: number; running?: { start: number; end: number } } {
  // VICE marks only opcode bytes as executed; a gap of at most two operand bytes stays inside one piece of code.
  const written: Array<{ start: number; end: number }> = [];
  for (const range of ranges.filter((candidate) => candidate.write && candidate.execute)) {
    const last = written.at(-1);
    if (last !== undefined && range.start - last.end <= 3 && underRom(range.start) === underRom(last.start)) last.end = range.end;
    else written.push({ start: range.start, end: range.end });
  }
  const counted = written.filter((range) => !underRom(range.start));
  const bytes = counted.reduce((sum, range) => sum + range.end - range.start + 1, 0);
  const running = counted.find((range) => pc >= range.start && pc <= range.end);
  return { written, bytes, ...(running === undefined ? {} : { running }) };
}
