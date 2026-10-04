// A small "packed" program: a BASIC SYS line starts a decoder that XORs a
// payload into place at $C000 and jumps there. The payload is the original
// counter program, so a capture after the jump must give it back exactly.

import { ORIGINAL } from "./counter-variants.ts";

export const PAYLOAD_START = 0xc000;
export const DECODER = 0x080d;
const KEY = 0x5a;

const body = ORIGINAL.prg.subarray(2);
const payloadAddress = 0x081f;

export const xorPackedPrg = Uint8Array.from([
  0x01, 0x08, // load address $0801
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, // 10 SYS2061
  0xa2, 0x00, // $080d: LDX #$00
  0xbd, payloadAddress & 0xff, payloadAddress >> 8, // $080f: LDA payload,X
  0x49, KEY, // EOR #KEY
  0x9d, 0x00, 0xc0, // STA $C000,X
  0xe8, // INX
  0xe0, body.length, // CPX #length
  0xd0, 0xf3, // BNE $080f
  0x4c, 0x00, 0xc0, // JMP $C000
  ...[...body].map((byte) => byte ^ KEY), // $081f: payload
]);
