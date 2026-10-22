// The structured instruction list: Ghidra's decoded instructions with
// the addressing mode, the operand in 6502 syntax, the flow target and,
// with a coverage file, whether the instruction ran.

import { Z80 } from "#src/cpu/z80.ts";
import { COVERAGE } from "#src/cpu/coverage.ts";
import { formatAddress } from "#src/address.ts";
import { OPCODES, type Mode as OpcodeMode } from "#src/opcodes.ts";
import type { GhidraInstruction } from "#src/native/types.ts";

export type Mode =
  | "implied"
  | "accumulator"
  | "immediate"
  | "zeropage"
  | "zeropage,x"
  | "zeropage,y"
  | "absolute"
  | "absolute,x"
  | "absolute,y"
  | "(indirect)"
  | "(indirect,x)"
  | "(indirect),y"
  | "relative";

/** ASL, ROL, LSR and ROR of the accumulator: the implied forms that work on A. */
const ACCUMULATOR = new Set([0x0a, 0x2a, 0x4a, 0x6a]);

const MODES: Record<OpcodeMode, Mode> = {
  imp: "implied",
  imm: "immediate",
  zp: "zeropage",
  zpx: "zeropage,x",
  zpy: "zeropage,y",
  abs: "absolute",
  abx: "absolute,x",
  aby: "absolute,y",
  ind: "(indirect)",
  izx: "(indirect,x)",
  izy: "(indirect),y",
  rel: "relative",
};

/** The addressing mode of an opcode. */
export function modeOf(opcode: number): Mode {
  return ACCUMULATOR.has(opcode) ? "accumulator" : MODES[OPCODES[opcode]!.mode];
}

/** The operand in 6502 syntax, from the instruction bytes; empty for implied. */
export function operandText(mode: Mode, bytes: Uint8Array, target: number | undefined): string {
  const byte = `$${(bytes[1] ?? 0).toString(16).padStart(2, "0")}`;
  const word = formatAddress((bytes[1] ?? 0) | ((bytes[2] ?? 0) << 8));
  switch (mode) {
    case "implied":
      return "";
    case "accumulator":
      return "a";
    case "immediate":
      return `#${byte}`;
    case "zeropage":
      return byte;
    case "zeropage,x":
      return `${byte},x`;
    case "zeropage,y":
      return `${byte},y`;
    case "absolute":
      return word;
    case "absolute,x":
      return `${word},x`;
    case "absolute,y":
      return `${word},y`;
    case "(indirect)":
      return `(${word})`;
    case "(indirect,x)":
      return `(${byte},x)`;
    case "(indirect),y":
      return `(${byte}),y`;
    case "relative":
      return target === undefined ? byte : formatAddress(target);
  }
}

export interface ListedInstruction {
  address: string;
  bytes: string;
  mnemonic: string;
  mode: Mode;
  operand: string;
  target?: string;
  executed?: boolean;
}

/** A Z80 instruction of the list: the text of the Z80 decoder (Zilog syntax, as sjasmplus reads it) in place of the 6502 mode and operand. */
export interface ListedZ80Instruction {
  address: string;
  bytes: string;
  text: string;
  target?: string;
  executed?: boolean;
}

/** Ghidra's Z80 instructions as the list that --out-instructions writes. */
export function z80InstructionList(instructions: GhidraInstruction[], coverage?: Uint8Array): ListedZ80Instruction[] {
  return instructions.map((instruction) => {
    const bytes = Buffer.from(instruction.bytes, "hex");
    const decoded = Z80.decode((address) => bytes[address - instruction.address], instruction.address);
    const [target] = instruction.flows;
    return {
      address: formatAddress(instruction.address),
      bytes: (instruction.bytes.match(/../g) ?? []).join(" "),
      text: decoded?.text ?? `${instruction.mnemonic} ${instruction.operands}`.trim(),
      ...(target === undefined ? {} : { target: formatAddress(target) }),
      ...(coverage === undefined ? {} : { executed: (coverage[instruction.address]! & COVERAGE.ramExecute) !== 0 }),
    };
  });
}

/** Ghidra's instructions as the list that --out-instructions writes. */
export function instructionList(instructions: GhidraInstruction[], coverage?: Uint8Array): ListedInstruction[] {
  return instructions.map((instruction) => {
    const bytes = Buffer.from(instruction.bytes, "hex");
    const mode = modeOf(bytes[0]!);
    const [target] = instruction.flows;
    return {
      address: formatAddress(instruction.address),
      bytes: (instruction.bytes.match(/../g) ?? []).join(" "),
      mnemonic: instruction.mnemonic,
      mode,
      operand: operandText(mode, bytes, target),
      ...(target === undefined ? {} : { target: formatAddress(target) }),
      ...(coverage === undefined ? {} : { executed: (coverage[instruction.address]! & COVERAGE.ramExecute) !== 0 }),
    };
  });
}
