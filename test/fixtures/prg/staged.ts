// A release in stages, as a cracked one-file program is:
//   stage 0 at $080d: an XOR decoder puts stage 1 at $c000 and jumps there
//   stage 1 at $c000: an intro waits for a key, copies the program to $4000
//                     and jumps there
//   the program at $4000: counts frames into $4100 for ever
// Stage 1 and the program are 128 bytes each, NOP-padded, so each is one
// written block that a stage guard of 64 bytes counts.

const KEY = 0x5a;
const BLOCK = 128;
const pad = (code: number[]) => [...code, ...new Array<number>(BLOCK - code.length).fill(0xea)];

export const STAGE_1 = 0xc000;
export const PROGRAM = 0x4000;
export const STAGE_0 = 0x080d;

const stage1Source = 0x081f; // in the file, right after stage 0
const programSource = stage1Source + BLOCK;

// The program: INC $4100 ; JMP $4000.
const program = pad([0xee, 0x00, 0x41, 0x4c, 0x00, 0x40]);

// Stage 1: wait: JSR $FFE4 ; BEQ wait ; LDX #0 ; loop: LDA src,X ; STA $4000,X ; INX ; CPX #128 ; BNE loop ; JMP $4000.
const stage1 = pad([
  0x20, 0xe4, 0xff,
  0xf0, 0xfb,
  0xa2, 0x00,
  0xbd, programSource & 0xff, programSource >> 8,
  0x9d, 0x00, 0x40,
  0xe8,
  0xe0, BLOCK,
  0xd0, 0xf5,
  0x4c, 0x00, 0x40,
]);

export const stagedPrg = Uint8Array.from([
  0x01, 0x08, // load address $0801
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, // 10 SYS2061
  // Stage 0 at $080d: LDX #0 ; loop: LDA src,X ; EOR #KEY ; STA $C000,X ; INX ; CPX #128 ; BNE loop ; JMP $C000.
  0xa2, 0x00,
  0xbd, stage1Source & 0xff, stage1Source >> 8,
  0x49, KEY,
  0x9d, 0x00, 0xc0,
  0xe8,
  0xe0, BLOCK,
  0xd0, 0xf3,
  0x4c, 0x00, 0xc0,
  ...stage1.map((byte) => byte ^ KEY),
  ...program,
]);
