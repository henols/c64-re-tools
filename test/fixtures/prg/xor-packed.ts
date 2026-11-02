// A small "packed" program: a BASIC SYS line starts a decoder that XORs a
// payload into place at $C000 and jumps there. The payload is the original
// counter program, so a capture after the jump must give it back exactly.

import { REFERENCE } from "./counter-variants.ts";

const KEY = 0x5a;

/** The XOR decoder: copies `length` bytes from `source` to $C000, each one XOR the key. */
export function xorDecoder(source: number, length: number): number[] {
  return [
    0xa2, 0x00, // LDX #$00
    0xbd, source & 0xff, source >> 8, // loop: LDA source,X
    0x49, KEY, // EOR #KEY
    0x9d, 0x00, 0xc0, // STA $C000,X
    0xe8, // INX
    0xe0, length, // CPX #length
    0xd0, 0xf3, // BNE loop
  ];
}

/** The bytes as the decoder reads them: each one XOR the key. */
export const xorPacked = (bytes: ArrayLike<number>): number[] => Array.from(bytes, (byte) => byte ^ KEY);

const body = REFERENCE.prg.subarray(2);

export const xorPackedPrg = Uint8Array.from([
  0x01, 0x08, // load address $0801
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, // 10 SYS2061
  ...xorDecoder(0x081f, body.length), // $080d
  0x4c, 0x00, 0xc0, // JMP $C000
  ...xorPacked(body), // $081f: payload
]);
