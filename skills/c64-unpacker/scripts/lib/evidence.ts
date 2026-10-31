// Local evidence of packing for the c64-unpacker script: where BASIC hands
// over and how compressed the bytes look. It never names a packer.

import { basicLineText, COVERAGE, findHandoffs, formatC64Address, instructionLength, parseTokenized, prgRange } from "#src/c64.ts";
import { IO_RAM } from "#src/host-client/coverage.ts";

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

/** A BASIC program at $0801, which RUN starts. */
export interface BasicStart {
  /** The first address after the BASIC text. */
  basicEnd: number;
  /** The first SYS: its line, and its address when the argument is a constant. */
  sys?: { line: number; address?: number; expression?: string };
}

/** The BASIC program of a PRG at $0801 and its first SYS, or undefined when the file is no BASIC program there. */
export function basicStart(program: Uint8Array): BasicStart | undefined {
  const tokenized = parseTokenized(program);
  if ("reason" in tokenized || tokenized.loadAddress !== 0x0801 || tokenized.lines.length === 0) return undefined;
  const sys = findHandoffs(tokenized.lines).find((handoff) => handoff.kind === "sys");
  if (sys === undefined) return { basicEnd: tokenized.basicEnd };
  return { basicEnd: tokenized.basicEnd, sys: "address" in sys ? { line: sys.line, address: sys.address } : { line: sys.line, expression: "expression" in sys ? sys.expression : "" } };
}

/** The local packing evidence of one PRG. */
export interface PackingEvidence {
  loadRange: { start: string; end: string };
  bytes: number;
  /** The first SYS line and its address (null when the argument needs run-time values, with the argument), or null when the program has no SYS. */
  basicStart: { line: number; sys: string | null; expression?: string } | null;
  entropy: { blocks: number; highBlocks: number; median: number | null };
  /** The BASIC lines as text: a packer or a crack often puts its banner there. */
  basicText: string[];
  /** Runs of readable PETSCII near the start of the code, raw. */
  strings: string[];
  /** What the code at the SYS address does in its first bytes. */
  start: { at: string; jumpsOutside?: string; writesOutside?: string } | null;
  /** EOR loops that store with an index near the start: decryption or decoding. */
  decodeLoops: string[];
  packing: "likely" | "unlikely" | "unclear";
  evidence: string;
}

/** How far the start-code signals look from the SYS address. */
const START_BYTES = 256;
const MIN_STRING = 8;
const MAX_STRINGS = 10;
const EOR_OPCODES = new Set([0x41, 0x45, 0x49, 0x4d, 0x51, 0x55, 0x59, 0x5d]);
const INDEXED_STORES = new Set([0x81, 0x91, 0x95, 0x99, 0x9d]);
const BRANCHES = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);

/** Readable PETSCII runs of at least MIN_STRING characters, the first MAX_STRINGS of them. */
function readableStrings(bytes: Uint8Array): string[] {
  const found: string[] = [];
  let run = "";
  for (const byte of [...bytes, 0]) {
    if (byte >= 0x20 && byte <= 0x5d) run += String.fromCharCode(byte);
    else {
      if (run.trim().length >= MIN_STRING && found.length < MAX_STRINGS) found.push(run.trim().slice(0, 40));
      run = "";
    }
  }
  return found;
}

/**
 * The start-code signals: the first JMP to an address outside the loaded
 * range, the first indexed store outside it, and EOR loops that store with
 * an index and branch back.
 */
function startSignals(program: Uint8Array, load: number, end: number, sys: number): { start: PackingEvidence["start"]; decodeLoops: string[] } {
  if (sys < load || sys > end) return { start: null, decodeLoops: [] };
  const byteAt = (address: number) => (address >= load && address <= end ? program[address - load + 2]! : undefined);
  const outside = (address: number) => address < load || address > end;
  const instructions: Array<{ at: number; opcode: number; operand: number; length: number }> = [];
  for (let at = sys; at <= Math.min(end, sys + START_BYTES - 1); ) {
    const opcode = byteAt(at)!;
    const length = instructionLength(opcode);
    const operand = length === 3 ? (byteAt(at + 1) ?? 0) | ((byteAt(at + 2) ?? 0) << 8) : length === 2 ? (byteAt(at + 1) ?? 0) : 0;
    instructions.push({ at, opcode, operand, length });
    at += length;
  }
  const jump = instructions.find((instruction) => instruction.opcode === 0x4c && outside(instruction.operand));
  const store = instructions.find((instruction) => (instruction.opcode === 0x9d || instruction.opcode === 0x99) && outside(instruction.operand));
  const decodeLoops = instructions
    .filter((instruction, index) => {
      if (!EOR_OPCODES.has(instruction.opcode)) return false;
      const after = instructions.slice(index + 1, index + 9);
      return after.some((next) => INDEXED_STORES.has(next.opcode)) && after.some((next) => BRANCHES.has(next.opcode) && next.operand >= 0x80);
    })
    .map((instruction) => formatC64Address(instruction.at));
  return {
    start: { at: formatC64Address(sys), ...(jump === undefined ? {} : { jumpsOutside: formatC64Address(jump.operand) }), ...(store === undefined ? {} : { writesOutside: formatC64Address(store.operand) }) },
    decodeLoops,
  };
}

export function inspect(program: Uint8Array): PackingEvidence {
  // A PRG ends at $ffff or before: a longer file (a disk image) is refused.
  const { start: load, end } = prgRange(program);
  const basic = basicStart(program);
  const stub = basic?.sys;
  // Without BASIC, all bytes count; with it, only the bytes after the BASIC text.
  const from = basic === undefined ? 2 : Math.min(program.length, basic.basicEnd - load + 2);
  const body = program.subarray(from);
  const blocks: number[] = [];
  for (let at = 0; at + BLOCK <= body.length; at += BLOCK) blocks.push(entropy(body.subarray(at, at + BLOCK)));
  const high = blocks.filter((value) => value > HIGH_ENTROPY).length;
  const share = blocks.length === 0 ? 0 : high / blocks.length;
  const byEntropy = blocks.length < 2 ? "unclear" : share >= 0.75 ? "likely" : share <= 0.1 ? "unlikely" : "unclear";
  const tokenized = parseTokenized(program);
  const basicText = "lines" in tokenized && load === 0x0801 ? tokenized.lines.map(basicLineText) : [];
  const signals = stub?.address === undefined ? { start: null, decodeLoops: [] } : startSignals(program, load, end, stub.address);
  const startMoves = signals.start?.jumpsOutside !== undefined || signals.start?.writesOutside !== undefined || signals.decodeLoops.length > 0;
  // Code that decodes or moves itself is a reason to run it, also when the bytes look plain.
  const packing = byEntropy === "unlikely" && startMoves ? "unclear" : byEntropy;
  const sorted = [...blocks].sort((a, b) => a - b);
  return {
    loadRange: { start: formatC64Address(load), end: formatC64Address(end) },
    bytes: program.length - 2,
    basicStart: stub === undefined ? null : stub.address === undefined ? { line: stub.line, sys: null, expression: stub.expression! } : { line: stub.line, sys: formatC64Address(stub.address) },
    entropy: {
      blocks: blocks.length,
      highBlocks: high,
      median: sorted.length === 0 ? null : Number(sorted[sorted.length >> 1]!.toFixed(2)),
    },
    basicText,
    strings: readableStrings(body.subarray(0, 1024)),
    start: signals.start,
    decodeLoops: signals.decodeLoops,
    packing,
    evidence:
      packing === "likely"
        ? `${high} of ${blocks.length} blocks of 256 bytes look compressed (above ${HIGH_ENTROPY} bits per byte); code and data are usually below.`
        : packing === "unlikely"
          ? `Only ${high} of ${blocks.length} blocks look compressed; the bytes look like code and data. A simple cruncher can look the same: run trace to see if the program writes code and then executes it.`
          : startMoves && byEntropy === "unlikely"
            ? "The bytes look like code and data, but the code at the SYS address decodes or moves bytes outside the program. Run trace or stages to see what it writes and runs."
            : "The entropy does not show clearly if the program is packed. Run it and look at what it writes to memory.",
  };
}

/** The memory map gives each access in the I/O area as an I/O access, also one with the RAM banked in. */
const inIoArea = (address: number) => address >= IO_RAM.start && address <= IO_RAM.end;

/**
 * True when the CPU executed RAM at the address that the program wrote. The
 * map keeps RAM and ROM apart, so code that runs in a ROM over written RAM
 * is no written code. In the I/O area, where the map does not show the
 * banking, an executed and written address is RAM code: the CPU does not
 * run code in the chip registers.
 */
function ranWritten(flags: number, address: number): boolean {
  if (inIoArea(address)) return (flags & (COVERAGE.ramExecute | COVERAGE.ioExecute)) !== 0 && (flags & (COVERAGE.ramWrite | COVERAGE.ioWrite)) !== 0;
  return (flags & COVERAGE.ramExecute) !== 0 && (flags & COVERAGE.ramWrite) !== 0;
}

/**
 * The RAM that the program wrote and then executed, in pieces of code, from
 * a coverage map of $0000-$ffff. `bytes` counts the executed opcode bytes
 * with the operand bytes between them; `running` is the piece that holds `pc`.
 */
export function writtenThenExecuted(map: Uint8Array, pc: number): { written: Array<{ start: number; end: number }>; bytes: number; running?: { start: number; end: number } } {
  // VICE marks only opcode bytes as executed; a gap of at most two operand bytes stays inside one piece of code.
  const written: Array<{ start: number; end: number }> = [];
  for (let address = 0; address < map.length; address++) {
    if (!ranWritten(map[address]!, address)) continue;
    const last = written.at(-1);
    if (last !== undefined && address - last.end <= 3) last.end = address;
    else written.push({ start: address, end: address });
  }
  const bytes = written.reduce((sum, range) => sum + range.end - range.start + 1, 0);
  const running = written.find((range) => pc >= range.start && pc <= range.end);
  return { written, bytes, ...(running === undefined ? {} : { running }) };
}
