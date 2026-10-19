// The NMOS 6502/6510 as a Cpu: the lengths, the flow and the operand of each
// opcode, and the text of src/opcodes.ts.

import type { Cpu, Instruction } from "../cpu.ts";
import { instructionText, MNEMONICS } from "../opcodes.ts";

/**
 * The length in bytes of the NMOS 6502/6510 instruction with this opcode, for
 * all 256 opcodes with the undocumented ones. The opcode is aaabbbcc: bbb
 * selects the addressing mode within a group cc. JAM (KIL) and BRK count one byte.
 */
export function instructionLength(opcode: number): 1 | 2 | 3 {
  const group = opcode & 0b11;
  const mode = (opcode >> 2) & 0b111;
  if (group === 0b00) {
    if (mode === 0b000) return opcode === 0x20 ? 3 : opcode === 0x00 || opcode === 0x40 || opcode === 0x60 ? 1 : 2;
    return ([2, 2, 1, 3, 2, 2, 1, 3] as const)[mode]!;
  }
  if (group === 0b10) {
    if (mode === 0b000) return opcode === 0x02 || opcode === 0x22 || opcode === 0x42 || opcode === 0x62 ? 1 : 2;
    return ([2, 2, 1, 3, 1, 2, 1, 3] as const)[mode]!;
  }
  // Groups 01 and 11 share their addressing modes.
  return ([2, 2, 2, 3, 2, 2, 3, 3] as const)[mode]!;
}

const BRANCHES = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);

/** Instructions that never fall through to the next one: BRK, RTI, JMP, RTS, JMP (ind). */
const NO_FALL = new Set([0x00, 0x40, 0x4c, 0x60, 0x6c]);

/** The JAM opcodes: the CPU stops. */
const JAMS = new Set([0x02, 0x12, 0x22, 0x32, 0x42, 0x52, 0x62, 0x72, 0x92, 0xb2, 0xd2, 0xf2]);

export const MOS6502: Cpu = {
  id: "6502",
  maxInstructionLength: 3,
  reserved: MNEMONICS,
  reservedReason: "the name of a 6502 instruction, which ACME cannot read as a label",
  /** The hardware vectors of the 6510: the CPU reads them from $fffa-$ffff, the RAM when the KERNAL is banked out. */
  vectors: [
    { at: 0xfffa, from: "NMI vector $fffa" },
    { at: 0xfffc, from: "RESET vector $fffc" },
    { at: 0xfffe, from: "IRQ vector $fffe" },
  ],
  decode(byteAt, address) {
    const opcode = byteAt(address);
    if (opcode === undefined) return undefined;
    const length = instructionLength(opcode);
    const low = byteAt(address + 1);
    const high = byteAt(address + 2);
    const instruction: Instruction = { length, fallsThrough: !NO_FALL.has(opcode), call: opcode === 0x20 };
    if (JAMS.has(opcode)) instruction.halts = true;
    if (length > 1) instruction.operand = BRANCHES.has(opcode) ? { offset: 1, size: 1, relative: true } : { offset: 1, size: length === 2 ? 1 : 2 };
    if (BRANCHES.has(opcode) && low !== undefined) instruction.branch = (address + 2 + (low < 0x80 ? low : low - 0x100)) & 0xffff;
    if ((opcode === 0x4c || opcode === 0x20) && low !== undefined && high !== undefined) {
      if (opcode === 0x4c) instruction.jump = low | (high << 8);
      else instruction.callTarget = low | (high << 8);
    }
    const bytes = [opcode, low, high].slice(0, length);
    if (bytes.every((byte) => byte !== undefined)) instruction.text = instructionText(bytes as number[], address);
    return instruction;
  },
};
