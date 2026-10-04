// A PRG with a known structure for static-analysis tests: a BASIC loader,
// a main loop that calls a routine, the routine (with ADC), and a data table.
// Bytes are spelled out so no assembler is needed.

export const MAIN = 0x080d;
export const MAIN_LOOP = 0x0810;
export const ROUTINE = 0x0818;
export const TABLE_START = 0x0824;
export const TABLE_END = 0x0827;
export const RESULT = 0xc100;

export const analysisSubjectPrg = Uint8Array.from([
  0x01, 0x08, // load address $0801
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, // 10 SYS2061
  0x20, 0x18, 0x08, // $080d: JSR $0818
  0xee, 0x20, 0xd0, // $0810: INC $D020
  0x4c, 0x10, 0x08, // $0813: JMP $0810
  0x00, 0x00, // $0816: not used
  0xa9, 0x01, // $0818: LDA #$01
  0x8d, 0x00, 0xc1, // $081a: STA $C100
  0xad, 0x24, 0x08, // $081d: LDA $0824
  0x18, // $0820: CLC
  0x69, 0x05, // $0821: ADC #$05
  0x60, // $0823: RTS
  0x10, 0x20, 0x30, 0x40, // $0824: table
]);
