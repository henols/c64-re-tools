// The structured instruction list: Ghidra's decoded instructions with
// the addressing mode, the operand in 6502 syntax, the flow target and,
// with a coverage file, whether the instruction ran.

import { COVERAGE, formatC64Address } from "#src/c64.ts";
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

const BRANCHES = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);
const JMP_INDIRECT = 0x6c;

/**
 * The addressing mode from Ghidra's operand text and the instruction length.
 * Ghidra prints zero page and absolute alike, and JMP (indirect) as an
 * address, so the length and the opcode decide those.
 */
export function modeOf(opcode: number, length: number, operands: string): Mode {
  const text = operands.toUpperCase();
  if (text === "") return "implied";
  if (text === "A") return "accumulator";
  if (text.startsWith("#")) return "immediate";
  if (text.startsWith("(") && text.endsWith(",X)")) return "(indirect,x)";
  if (text.startsWith("(") && text.endsWith("),Y")) return "(indirect),y";
  if (text.endsWith(",X")) return length === 2 ? "zeropage,x" : "absolute,x";
  if (text.endsWith(",Y")) return length === 2 ? "zeropage,y" : "absolute,y";
  if (BRANCHES.has(opcode)) return "relative";
  if (opcode === JMP_INDIRECT) return "(indirect)";
  return length === 2 ? "zeropage" : "absolute";
}

/** The operand in 6502 syntax, from the instruction bytes; empty for implied. */
export function operandText(mode: Mode, bytes: Uint8Array, target: number | undefined): string {
  const byte = `$${(bytes[1] ?? 0).toString(16).padStart(2, "0")}`;
  const word = formatC64Address((bytes[1] ?? 0) | ((bytes[2] ?? 0) << 8));
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
      return target === undefined ? byte : formatC64Address(target);
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

/** Ghidra's instructions as the list that --out-instructions writes. */
export function instructionList(instructions: GhidraInstruction[], coverage?: Uint8Array): ListedInstruction[] {
  return instructions.map((instruction) => {
    const bytes = Buffer.from(instruction.bytes, "hex");
    const mode = modeOf(bytes[0]!, bytes.length, instruction.operands);
    const [target] = instruction.flows;
    return {
      address: formatC64Address(instruction.address),
      bytes: (instruction.bytes.match(/../g) ?? []).join(" "),
      mnemonic: instruction.mnemonic,
      mode,
      operand: operandText(mode, bytes, target),
      ...(target === undefined ? {} : { target: formatC64Address(target) }),
      ...(coverage === undefined ? {} : { executed: (coverage[instruction.address]! & COVERAGE.ramExecute) !== 0 }),
    };
  });
}
