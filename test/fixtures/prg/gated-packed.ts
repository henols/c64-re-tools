// A packed program behind an intro that waits for a key, as a cracktro does:
// a BASIC SYS line, a KERNAL key wait, then the XOR decoder of xor-packed.ts
// that puts the counter program at $C000 and jumps there. Without a key the
// program never gets to $C000.

import { ORIGINAL } from "./counter-variants.ts";

const KEY = 0x5a;
const body = ORIGINAL.prg.subarray(2);
const payloadAddress = 0x0824;

export const gatedPackedPrg = Uint8Array.from([
  0x01, 0x08, // load address $0801
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00, // 10 SYS2061
  0x20, 0xe4, 0xff, // $080d: wait: JSR $FFE4 (GETIN)
  0xf0, 0xfb, // BEQ wait
  0xa2, 0x00, // $0812: LDX #$00
  0xbd, payloadAddress & 0xff, payloadAddress >> 8, // $0814: LDA payload,X
  0x49, KEY, // EOR #KEY
  0x9d, 0x00, 0xc0, // STA $C000,X
  0xe8, // INX
  0xe0, body.length, // CPX #length
  0xd0, 0xf3, // BNE $0814
  0x4c, 0x00, 0xc0, // JMP $C000
  ...[...body].map((byte) => byte ^ KEY), // $0824: payload
]);
