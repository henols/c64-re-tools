// A program that waits for one key through the KERNAL and keeps it. A BASIC
// line starts it, so autostart runs it with RUN:
//   10 SYS2061
//   $080d  wait: JSR $ffe4 (GETIN) ; BEQ wait
//   $0812  STA $c000                  <- the key, as PETSCII
//   $0815  done: JMP done

export const KEY_SEEN = 0xc000;

export const keyWaitPrg = Uint8Array.from([
  0x01, 0x08, // load address $0801
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, // 10 SYS2061
  0x00, 0x00, // end of the BASIC program
  0x20, 0xe4, 0xff, 0xf0, 0xfb,
  0x8d, 0x00, 0xc0,
  0x4c, 0x15, 0x08,
]);
