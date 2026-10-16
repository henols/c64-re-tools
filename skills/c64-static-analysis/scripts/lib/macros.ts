// Macro candidates (D73): runs of instructions that are a known 6502 idiom,
// such as a 16-bit increment, and that a macro can write as one line. They
// are only reported, never written: the LLM applies them as macro uses with
// c64-knowledge, and c64-source writes a use only when it gives the bytes of
// the image.
//
// The catalogue is fixed, so each candidate has a name and a body that is
// known to be correct. A search for any repeated sequence was weighed and not
// chosen: it gives many candidates without a name (D73).

import { instructionLength } from "#src/c64.ts";
import type { ImageByte } from "./coverage.ts";

/** A macro of the catalogue: its params and its ACME body, which names a param with a dot. */
export interface MacroIdiom {
  name: string;
  params: string[];
  body: string;
  comment: string;
}

export const CATALOGUE: readonly MacroIdiom[] = [
  { name: "inc16", params: ["dst"], body: ["        inc .dst", "        bne +", "        inc .dst+1", "+"].join("\n"), comment: "Adds 1 to the 16-bit value at dst." },
  { name: "dec16", params: ["dst"], body: ["        lda .dst", "        bne +", "        dec .dst+1", "+       dec .dst"].join("\n"), comment: "Subtracts 1 from the 16-bit value at dst. It changes A." },
  {
    name: "add16_8",
    params: ["dst", "value"],
    body: ["        clc", "        lda .dst", "        adc #.value", "        sta .dst", "        bcc +", "        inc .dst+1", "+"].join("\n"),
    comment: "Adds the 8-bit value to the 16-bit value at dst. It changes A.",
  },
  {
    name: "add16",
    params: ["dst", "value"],
    body: ["        clc", "        lda .dst", "        adc #<.value", "        sta .dst", "        lda .dst+1", "        adc #>.value", "        sta .dst+1"].join("\n"),
    comment: "Adds the 16-bit value to the 16-bit value at dst. It changes A.",
  },
  {
    name: "sub16",
    params: ["dst", "value"],
    body: ["        sec", "        lda .dst", "        sbc #<.value", "        sta .dst", "        lda .dst+1", "        sbc #>.value", "        sta .dst+1"].join("\n"),
    comment: "Subtracts the 16-bit value from the 16-bit value at dst. It changes A.",
  },
  {
    name: "set16",
    params: ["dst", "value"],
    body: ["        lda #<.value", "        sta .dst", "        lda #>.value", "        sta .dst+1"].join("\n"),
    comment: "Puts the 16-bit value at dst. It changes A.",
  },
  {
    name: "mov16",
    params: ["dst", "src"],
    body: ["        lda .src", "        sta .dst", "        lda .src+1", "        sta .dst+1"].join("\n"),
    comment: "Copies the 16-bit value at src to dst. It changes A.",
  },
  { name: "wait_line", params: ["line"], body: ["        lda #.line", "-       cmp $d012", "        bne -"].join("\n"), comment: "Waits until the raster line (bits 0-7) is line. It changes A." },
];

/** A run of instructions that one macro of the catalogue can write, with its args as ACME expressions. */
export interface MacroCandidate {
  macro: string;
  start: number;
  end: number;
  args: string[];
}

/** One instruction: its opcode, its length and its operand value. */
export interface Instruction {
  opcode: number;
  length: number;
  value: number;
}

/** An address operand: zero page or absolute, of the same memory in one idiom. */
interface Operand {
  value: number;
  absolute: boolean;
}

/** Opcodes by mnemonic, zero page first, then absolute. */
const MEMORY = {
  lda: [0xa5, 0xad],
  sta: [0x85, 0x8d],
  inc: [0xe6, 0xee],
  dec: [0xc6, 0xce],
} as const;
const IMMEDIATE = { lda: 0xa9, adc: 0x69, sbc: 0xe9 } as const;
const CLC = 0x18;
const SEC = 0x38;
const BNE = 0xd0;
const BCC = 0x90;
const CMP_ABSOLUTE = 0xcd;

/**
 * Names the args of a candidate: `address` gives the name of an address in
 * the knowledge, or undefined. An absolute operand below $0100 keeps four
 * digits, so ACME writes the absolute form again.
 */
export type Namer = (address: number) => string | undefined;

const hex2 = (value: number) => `$${value.toString(16).padStart(2, "0")}`;
const hex4 = (value: number) => `$${value.toString(16).padStart(4, "0")}`;

function addressArg(operand: Operand, name: Namer): string {
  const named = name(operand.value);
  // A name of a zero-page address gives the zero-page form: an absolute operand there keeps its number.
  if (named !== undefined && (operand.value >= 0x100 || !operand.absolute)) return named;
  return operand.absolute ? hex4(operand.value) : hex2(operand.value);
}

/** The memory operand of `instruction` when it is one of the opcodes of the mnemonic. */
function memory(instruction: Instruction | undefined, mnemonic: keyof typeof MEMORY): Operand | undefined {
  if (instruction === undefined) return undefined;
  const index = (MEMORY[mnemonic] as readonly number[]).indexOf(instruction.opcode);
  return index < 0 ? undefined : { value: instruction.value, absolute: index === 1 };
}

const same = (a: Operand | undefined, b: Operand | undefined, offset = 0): boolean => a !== undefined && b !== undefined && a.absolute === b.absolute && b.value === a.value + offset;
const immediate = (instruction: Instruction | undefined, opcode: number) => (instruction?.opcode === opcode ? instruction.value : undefined);
/** A branch past the next instruction only: its distance is the length of that instruction. */
const skips = (branch: Instruction | undefined, opcode: number, next: Instruction | undefined) => branch?.opcode === opcode && next !== undefined && branch.value === next.length;

/** Each idiom: how many instructions it takes, and its args when the instructions match. */
const MATCHERS: Record<string, { count: number; match: (run: Instruction[], name: Namer) => string[] | undefined }> = {
  inc16: {
    count: 3,
    match: ([low, branch, high], name) => {
      const dst = memory(low, "inc");
      return same(dst, memory(high, "inc"), 1) && skips(branch, BNE, high) ? [addressArg(dst!, name)] : undefined;
    },
  },
  dec16: {
    count: 4,
    match: ([load, branch, high, low], name) => {
      const dst = memory(load, "lda");
      return same(dst, memory(low, "dec")) && same(dst, memory(high, "dec"), 1) && skips(branch, BNE, high) ? [addressArg(dst!, name)] : undefined;
    },
  },
  add16_8: {
    count: 6,
    match: ([clc, load, add, store, branch, high], name) => {
      const dst = memory(load, "lda");
      const value = immediate(add, IMMEDIATE.adc);
      const ok = clc?.opcode === CLC && value !== undefined && same(dst, memory(store, "sta")) && same(dst, memory(high, "inc"), 1) && skips(branch, BCC, high);
      return ok ? [addressArg(dst!, name), hex2(value)] : undefined;
    },
  },
  add16: { count: 7, match: (run, name) => wide(run, name, CLC, IMMEDIATE.adc) },
  sub16: { count: 7, match: (run, name) => wide(run, name, SEC, IMMEDIATE.sbc) },
  set16: {
    count: 4,
    match: ([loadLow, storeLow, loadHigh, storeHigh], name) => {
      const low = immediate(loadLow, IMMEDIATE.lda);
      const high = immediate(loadHigh, IMMEDIATE.lda);
      const dst = memory(storeLow, "sta");
      if (low === undefined || high === undefined || !same(dst, memory(storeHigh, "sta"), 1)) return undefined;
      const value = low | (high << 8);
      return [addressArg(dst!, name), name(value) ?? hex4(value)];
    },
  },
  mov16: {
    count: 4,
    match: ([loadLow, storeLow, loadHigh, storeHigh], name) => {
      const src = memory(loadLow, "lda");
      const dst = memory(storeLow, "sta");
      if (!same(src, memory(loadHigh, "lda"), 1) || !same(dst, memory(storeHigh, "sta"), 1)) return undefined;
      return [addressArg(dst!, name), addressArg(src!, name)];
    },
  },
  wait_line: {
    count: 3,
    match: ([load, compare, branch]) => {
      const line = immediate(load, IMMEDIATE.lda);
      // BNE back to the CMP: 5 bytes back from the end of the BNE.
      return line !== undefined && compare?.opcode === CMP_ABSOLUTE && compare.value === 0xd012 && branch?.opcode === BNE && branch.value === 0xfb ? [hex2(line)] : undefined;
    },
  },
};

/** add16 and sub16: the carry, then the low and the high byte, each with an immediate of the 16-bit value. */
function wide([carry, loadLow, low, storeLow, loadHigh, high, storeHigh]: Instruction[], name: Namer, carryOpcode: number, opcode: number): string[] | undefined {
  const dst = memory(loadLow, "lda");
  const lowValue = immediate(low, opcode);
  const highValue = immediate(high, opcode);
  const ok =
    carry?.opcode === carryOpcode && lowValue !== undefined && highValue !== undefined && same(dst, memory(storeLow, "sta")) && same(dst, memory(loadHigh, "lda"), 1) && same(dst, memory(storeHigh, "sta"), 1);
  return ok ? [addressArg(dst!, name), hex4(lowValue | (highValue << 8))] : undefined;
}

/** The instruction at `at`, or undefined when a byte of it is outside the range or the image. */
export function instructionAt(byteAt: ImageByte, at: number, end: number): Instruction | undefined {
  const opcode = byteAt(at);
  if (opcode === undefined) return undefined;
  const length = instructionLength(opcode);
  if (at + length - 1 > end) return undefined;
  const bytes = Array.from({ length: length - 1 }, (_, offset) => byteAt(at + 1 + offset));
  if (bytes.some((byte) => byte === undefined)) return undefined;
  return { opcode, length, value: length === 1 ? 0 : length === 2 ? bytes[0]! : bytes[0]! | (bytes[1]! << 8) };
}

/**
 * Finds the macro candidates in code regions. Each region is read as
 * instructions from its start; at each instruction the idioms of the
 * catalogue are tried in order, and a match is a candidate. Candidates do not
 * overlap: the scan goes on after the end of a match.
 */
export function findMacroUses(byteAt: ImageByte, regions: ReadonlyArray<{ start: number; end: number }>, name: Namer): MacroCandidate[] {
  const candidates: MacroCandidate[] = [];
  for (const region of [...regions].sort((a, b) => a.start - b.start)) {
    const run: Array<Instruction & { at: number }> = [];
    for (let at = region.start; at <= region.end; ) {
      const instruction = instructionAt(byteAt, at, region.end);
      if (instruction === undefined) break;
      run.push({ ...instruction, at });
      at += instruction.length;
    }
    for (let index = 0; index < run.length; ) {
      const found = CATALOGUE.flatMap((idiom) => {
        const matcher = MATCHERS[idiom.name]!;
        const part = run.slice(index, index + matcher.count);
        const args = part.length === matcher.count ? matcher.match(part, name) : undefined;
        return args === undefined ? [] : [{ idiom, count: matcher.count, args }];
      })[0];
      if (found === undefined) {
        index++;
        continue;
      }
      const last = run[index + found.count - 1]!;
      candidates.push({ macro: found.idiom.name, start: run[index]!.at, end: last.at + last.length - 1, args: found.args });
      index += found.count;
    }
  }
  return candidates;
}
