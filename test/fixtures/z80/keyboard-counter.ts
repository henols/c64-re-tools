// A frame-synced ZX Spectrum 48K loop for the Z80 replay core, the Ghidra Z80
// language and the live emulator. It runs from a .z80 snapshot. Each frame
// (IM 1, the ROM interrupt handler runs once per HALT):
//   $9002 += 1                          (frames seen)
//   if CAPS SHIFT (port $FEFE bit 0) or SPACE (port $7FFE bit 0) is down:
//     call COUNT: $9000 += 1, the border shows the count, $9001 += 1
//
// $8000  DI ; LD SP,$8FF0 ; LD IY,$5C3A ; IM 1 ; EI
// $800b  loop: LD A,$FE ; IN A,($FE)        <- CAPS_SITE (port $FEFE)
// $800f  RRA ; JR C,+3 ; CALL COUNT
// $8015  LD BC,$7FFE ; IN A,(C)             <- SPACE_SITE (port $7FFE)
// $801a  AND 1 ; CALL Z,COUNT
// $801f  LD HL,$9002 ; INC (HL) ; HALT ; JP loop
// $8030  COUNT: LD HL,$9000 ; INC (HL) ; LD A,(HL) ; AND 7 ; OUT ($FE),A
// $8039  LD IX,$9000 ; INC (IX+1) ; BIT 0,(IX+1) ; RET

export const COUNTER_START = 0x8000;
export const LOOP = 0x800b;
export const CAPS_SITE = 0x800d;
export const SPACE_SITE = 0x8018;
export const HALT_AT = 0x8023;
export const COUNT = 0x8030;
export const PRESSES = 0x9000;
export const PRESSES_IX = 0x9001;
export const FRAMES_SEEN = 0x9002;

export const keyboardCounterCode = Uint8Array.from([
  0xf3, // $8000 DI
  0x31, 0xf0, 0x8f, // $8001 LD SP,$8FF0
  0xfd, 0x21, 0x3a, 0x5c, // $8004 LD IY,$5C3A
  0xed, 0x56, // $8008 IM 1
  0xfb, // $800a EI
  0x3e, 0xfe, // $800b LD A,$FE
  0xdb, 0xfe, // $800d IN A,($FE)
  0x1f, // $800f RRA
  0x38, 0x03, // $8010 JR C,$8015
  0xcd, 0x30, 0x80, // $8012 CALL $8030
  0x01, 0xfe, 0x7f, // $8015 LD BC,$7FFE
  0xed, 0x78, // $8018 IN A,(C)
  0xe6, 0x01, // $801a AND 1
  0xcc, 0x30, 0x80, // $801c CALL Z,$8030
  0x21, 0x02, 0x90, // $801f LD HL,$9002
  0x34, // $8022 INC (HL)
  0x76, // $8023 HALT
  0xc3, 0x0b, 0x80, // $8024 JP $800B
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // $8027-$802f
  0x21, 0x00, 0x90, // $8030 LD HL,$9000
  0x34, // $8033 INC (HL)
  0x7e, // $8034 LD A,(HL)
  0xe6, 0x07, // $8035 AND 7
  0xd3, 0xfe, // $8037 OUT ($FE),A
  0xdd, 0x21, 0x00, 0x90, // $8039 LD IX,$9000
  0xdd, 0x34, 0x01, // $803d INC (IX+1)
  0xdd, 0xcb, 0x01, 0x46, // $8040 BIT 0,(IX+1)
  0xc9, // $8044 RET
]);

/** The 48 KiB of RAM ($4000-$FFFF) with the code at COUNTER_START. */
export function keyboardCounterRam(): Uint8Array {
  const ram = new Uint8Array(0xc000);
  ram.set(keyboardCounterCode, COUNTER_START - 0x4000);
  return ram;
}

/**
 * A version 1 .z80 snapshot of a 48K Spectrum: the 30-byte header, then the
 * RAM in the compressed form (chips reads every version 1 file as compressed).
 */
export function z80Snapshot(ram: Uint8Array, registers: { pc: number; sp: number; iy: number; im: number; border: number }): Uint8Array {
  const header = new Uint8Array(30);
  header[6] = registers.pc & 0xff;
  header[7] = registers.pc >> 8;
  header[8] = registers.sp & 0xff;
  header[9] = registers.sp >> 8;
  header[12] = ((registers.border & 7) << 1) | (1 << 5);
  header[23] = registers.iy & 0xff;
  header[24] = registers.iy >> 8;
  header[29] = registers.im & 3;
  return Uint8Array.from([...header, ...compressZ80(ram), 0x00, 0xed, 0xed, 0x00]);
}

// A run of 5 or more equal bytes, or of 2 or more $ED, is "ED ED count byte".
// The byte after a single $ED is never the start of a run.
function compressZ80(data: Uint8Array): number[] {
  const out: number[] = [];
  let at = 0;
  while (at < data.length) {
    const value = data[at]!;
    let run = 1;
    while (at + run < data.length && data[at + run] === value && run < 255) run++;
    if (run >= 5 || (value === 0xed && run >= 2)) {
      out.push(0xed, 0xed, run, value);
      at += run;
    } else if (value === 0xed) {
      out.push(0xed);
      at++;
      if (at < data.length) out.push(data[at++]!);
    } else {
      out.push(value);
      at++;
    }
  }
  return out;
}

export function keyboardCounterSnapshot(): Uint8Array {
  return z80Snapshot(keyboardCounterRam(), { pc: COUNTER_START, sp: 0xff00, iy: 0x5c3a, im: 1, border: 7 });
}
