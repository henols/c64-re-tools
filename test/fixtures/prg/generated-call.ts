// A program that writes a routine and calls it, as a relocated game does
// with its generated playfield code: no stage starts there.
//   $080d: copies 128 bytes to $9e00, then loops: JSR $0823 ; INC $4100 ; JMP $081a
//   $0823: JMP $9e00 (a tail call: the routine returns to the loop)
//   $9e00: INC $4101 ; RTS, NOP-padded to 128 bytes

const BLOCK = 128;
export const ROUTINE = 0x9e00;
const source = 0x0826;

const routine = [0xee, 0x01, 0x41, 0x60, ...new Array<number>(BLOCK - 4).fill(0xea)];

export const generatedCallPrg = Uint8Array.from([
  0x01, 0x08, // load address $0801
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, // 10 SYS2061
  0xa2, 0x00, // $080d: LDX #0
  0xbd, source & 0xff, source >> 8, // $080f: LDA source,X
  0x9d, 0x00, 0x9e, // $0812: STA $9e00,X
  0xe8, // $0815: INX
  0xe0, BLOCK, // $0816: CPX #128
  0xd0, 0xf5, // $0818: BNE $080f
  0x20, 0x23, 0x08, // $081a: JSR $0823
  0xee, 0x00, 0x41, // $081d: INC $4100
  0x4c, 0x1a, 0x08, // $0820: JMP $081a
  0x4c, 0x00, 0x9e, // $0823: JMP $9e00
  ...routine, // $0826
]);
