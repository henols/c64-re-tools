// The CPU of a machine as the analysis sees it: how long an instruction is, how
// the flow goes on after it, and its text. The 6502 (src/cpu/mos6502.ts) and the
// Z80 (src/cpu/z80.ts) implement it.

/** A byte of the image, or undefined outside it. */
export type ByteAt = (address: number) => number | undefined;

export interface Instruction {
  /** The length in bytes, prefixes and operands included. */
  length: number;
  /** False when the next instruction never follows this one: a jump, a return. */
  fallsThrough: boolean;
  /** A subroutine call: the next instruction follows when the routine returns. */
  call: boolean;
  /** The target of a direct conditional branch. */
  branch?: number;
  /** The target of a direct unconditional jump. */
  jump?: number;
  /** The target of a direct call. */
  callTarget?: number;
  /** The text, when every byte of the instruction is in the image. */
  text?: string;
}

export interface Cpu {
  id: "6502" | "z80";
  /** The most bytes that one instruction has. */
  maxInstructionLength: number;
  /** The instruction at `address`, or undefined when its first byte is not in the image. */
  decode(byteAt: ByteAt, address: number): Instruction | undefined;
}
