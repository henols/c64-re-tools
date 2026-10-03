// A PRG that runs from BASIC: 10 SYS2061, then a loop that keeps changing the
// border colour. Bytes are spelled out so no assembler is needed.

export const BORDER_LOOP_START = 0x080d;
export const BORDER_LOOP_END = 0x0812;

export const borderLoopPrg = Uint8Array.from([
  0x01, 0x08, // load address $0801
  0x0b, 0x08, // next BASIC line at $080b
  0x0a, 0x00, // line 10
  0x9e, 0x32, 0x30, 0x36, 0x31, // SYS 2061
  0x00, // end of line
  0x00, 0x00, // end of program
  0xee, 0x20, 0xd0, // $080d: INC $D020
  0x4c, 0x0d, 0x08, // $0810: JMP $080D
]);
