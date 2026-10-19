// The CPU of a machine as the analysis sees it: how long an instruction is, how
// the flow goes on after it, where its operand is, and its text. The 6502
// (src/cpu/mos6502.ts) and the Z80 (src/cpu/z80.ts) implement it.

import { SYMBOL_NAME } from "./address.ts";

/** A byte of the image, or undefined outside it. */
export type ByteAt = (address: number) => number | undefined;

export interface Instruction {
  /** The length in bytes, prefixes and operands included. */
  length: number;
  /** False when the next instruction never follows this one: a jump, a return. */
  fallsThrough: boolean;
  /** The CPU stops at it (the JAM opcodes of the 6502): nothing after it runs. */
  halts?: boolean;
  /** A subroutine call: the next instruction follows when the routine returns. */
  call: boolean;
  /** The target of a direct conditional branch. */
  branch?: number;
  /** The target of a direct unconditional jump. */
  jump?: number;
  /** The target of a direct call. */
  callTarget?: number;
  /**
   * The operand that an expression of the knowledge can name: its offset in
   * the instruction and its size. A relative operand is a distance to a
   * target, not a value.
   */
  operand?: { offset: number; size: 1 | 2; relative?: boolean };
  /** The text, when every byte of the instruction is in the image. */
  text?: string;
}

export interface Cpu {
  id: "6502" | "z80";
  /** The most bytes that one instruction has. */
  maxInstructionLength: number;
  /** The instruction at `address`, or undefined when its first byte is not in the image. */
  decode(byteAt: ByteAt, address: number): Instruction | undefined;
  /** The words that cannot be a label, in lower case: the mnemonics, and for the Z80 the register and condition names too. */
  reserved: ReadonlySet<string>;
  /** Why a reserved word cannot be a label, after "<name> is". */
  reservedReason: string;
  /** The addresses that hold the address of an interrupt or reset handler, when the image holds them. */
  vectors: ReadonlyArray<{ at: number; from: string }>;
}

/** The syntax of a symbol name in words. */
export const SYMBOL_SYNTAX = "A symbol name is a letter or underscore, then letters, digits or underscores (at most 64), with an optional leading dot.";

/** Why `name` cannot be a symbol of a program for this CPU, or undefined when it can. The one rule for a symbol of the knowledge and a label of the source. */
export function labelProblem(name: string, cpu: Cpu): string | undefined {
  if (!SYMBOL_NAME.test(name)) return SYMBOL_SYNTAX;
  if (cpu.reserved.has(name.toLowerCase())) return `${name} is ${cpu.reservedReason}. Give another name.`;
  return undefined;
}
