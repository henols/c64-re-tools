// Three PRGs for equivalence tests: an original counter program, a rebuild
// that does the same with a different memory layout, and a rebuild that
// stops one count early. Each counts to its limit, sets the border, and
// loops at "done". Bytes are spelled out so no assembler is needed.

function counter(base: number, counterAddress: number, limit: number): Uint8Array {
  const lo = (value: number) => value & 0xff;
  const hi = (value: number) => value >> 8;
  const done = base + 0x14;
  return Uint8Array.from([
    lo(base), hi(base),
    0xa9, 0x00, // start: LDA #$00
    0x8d, lo(counterAddress), hi(counterAddress), // STA counter
    0xee, lo(counterAddress), hi(counterAddress), // loop: INC counter
    0xad, lo(counterAddress), hi(counterAddress), // LDA counter
    0xc9, limit, // CMP #limit
    0xd0, 0xf6, // BNE loop
    0xa9, 0x05, // LDA #$05
    0x8d, 0x20, 0xd0, // STA $D020
    0x4c, lo(done), hi(done), // done: JMP done
  ]);
}

/** Symbols of a variant, as c64-assembler would report them. */
function symbols(base: number, counterAddress: number): Record<string, number> {
  return { start: base, loop: base + 5, done: base + 0x14, never: base + 0xf0, counter: counterAddress };
}

export const ORIGINAL = { prg: counter(0xc000, 0xc100, 10), symbols: symbols(0xc000, 0xc100) };
export const EQUIVALENT = { prg: counter(0xc800, 0xc200, 10), symbols: symbols(0xc800, 0xc200) };
export const BROKEN = { prg: counter(0xc800, 0xc200, 9), symbols: symbols(0xc800, 0xc200) };
