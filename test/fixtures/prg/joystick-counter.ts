// A frame-synced loop for deterministic scenarios. It needs no KERNAL, so it
// runs straight after a hard reset. Each frame, at raster line 128:
//   $c100 += 1                       (frames seen)
//   if joystick 2 is held left:
//     $c101 += 1 and the border goes red ($d020 = 2)
//
// $c000  SEI
// $c001  LDA #$00 ; STA $c100 ; STA $c101
// $c009  LDA #$ff ; STA $dc00
// $c00e  wait: LDA $d012 ; CMP #$80 ; BNE wait
// $c015  INC $c100
// $c018  LDA $dc00 ; AND #$04 ; BNE skip
// $c01f  INC $c101            <- LEFT_SEEN
// $c022  LDA #$02 ; STA $d020
// $c027  skip: LDA $d012 ; CMP #$80 ; BEQ skip
// $c02e  JMP wait

export const COUNTER_START = 0xc000;
export const LEFT_SEEN = 0xc01f;
export const FRAMES_SEEN = 0xc100;
export const LEFT_FRAMES = 0xc101;

export const joystickCounterPrg = Uint8Array.from([
  0x00, 0xc0, // load address $c000
  0x78,
  0xa9, 0x00, 0x8d, 0x00, 0xc1, 0x8d, 0x01, 0xc1,
  0xa9, 0xff, 0x8d, 0x00, 0xdc,
  0xad, 0x12, 0xd0, 0xc9, 0x80, 0xd0, 0xf9,
  0xee, 0x00, 0xc1,
  0xad, 0x00, 0xdc, 0x29, 0x04, 0xd0, 0x08,
  0xee, 0x01, 0xc1,
  0xa9, 0x02, 0x8d, 0x20, 0xd0,
  0xad, 0x12, 0xd0, 0xc9, 0x80, 0xf0, 0xf9,
  0x4c, 0x0e, 0xc0,
]);
