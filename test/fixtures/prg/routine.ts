// A routine that the library finds in another program at another address.

/**
 * The routine at `base`: a loop that copies a table of the routine to the SID,
 * a call inside the routine, a zero-page read, and a pointer to the table as
 * two immediates. `sid` and `zp` are the outside addresses.
 */
export function routineBytes(base: number, sid = 0xd400, zp = 0xfb): number[] {
  const lo = (value: number) => value & 0xff;
  const hi = (value: number) => value >> 8;
  const table = base + 0x20;
  const pointer = base + 0x14;
  return [
    0xa2, 0x00, // LDX #$00
    0xbd, lo(table), hi(table), // LDA table,X
    0x9d, lo(sid), hi(sid), // STA sid,X
    0xe8, // INX
    0xe0, 0x07, // CPX #$07
    0xd0, 0xf5, // BNE base+2
    0x20, lo(pointer), hi(pointer), // JSR set_pointer
    0xa5, zp, // LDA zp
    0x60, // RTS
    0xea, // NOP
    0xa9, lo(table), // set_pointer: LDA #<table
    0xa0, hi(table), // LDY #>table
    0x60, // RTS
    0xea, 0xea, 0xea, 0xea, 0xea, 0xea, 0xea, // fill to base+$20
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, // table
  ];
}
