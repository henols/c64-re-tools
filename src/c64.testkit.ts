// PRG bytes for tests.

/** The BASIC line 10 SYS2061 at $0801, with the end of the program: the machine code starts at $080d. */
export const SYS_2061 = [0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00] as const;

/** A PRG: the load address, then the parts one after the other. */
export function prg(load: number, ...parts: ArrayLike<number>[]): Buffer {
  return Buffer.concat([Buffer.from([load & 0xff, load >> 8]), ...parts.map((part) => Buffer.from(Array.from(part)))]);
}
