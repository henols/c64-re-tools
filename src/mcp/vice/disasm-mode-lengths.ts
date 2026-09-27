// disasm-mode-lengths.ts
//
// WHY THIS FILE EXISTS: the tests check every opcode entry's length against
// an independent table of lengths per addressing mode. The decoder itself
// reads each entry's own length and never this table.
//
// WHAT NOT TO DO:
//   - Never import this table into production code. It is the oracle the
//     opcode table is checked against, not a second source for it.
import type { AddressingMode } from "./disasm-opcodes.mts";

/**
 * The canonical instruction length, in bytes, for each addressing mode.
 * Every `OpcodeEntry.length` in disasm-opcodes.mts must equal `LENGTH_FOR_MODE[entry.mode]`
 * -- `disasm-opcodes.test.ts`'s shape suite asserts this for all 256
 * entries.
 */
export const LENGTH_FOR_MODE: Readonly<Record<AddressingMode, 1 | 2 | 3>> = {
  implicit: 1,
  accumulator: 1,
  immediate: 2,
  zeropage: 2,
  zeropage_x: 2,
  zeropage_y: 2,
  indirect_x: 2,
  indirect_y: 2,
  relative: 2,
  absolute: 3,
  absolute_x: 3,
  absolute_y: 3,
  indirect: 3,
};

