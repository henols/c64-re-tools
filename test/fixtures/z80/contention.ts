// Programs that touch contended memory in the screen lines of each frame, for
// the replay core zxrun and the live emulator. Each one waits for the frame
// interrupt (HALT), runs a delay loop of about 15600 cycles in uncontended
// memory, then a snippet, and then the mark: the frame cycle at which the CPU
// reaches the mark in the first frame shows the delays that the ULA gave the
// snippet. (A later frame can start a few cycles later: the CPU leaves HALT at
// a step of 4 cycles, so the end of the frame before moves it.)
//
// The cycles are those that ZEsarUX 13.0 gives at the mark: zxrun gives the
// same. Each mark is in uncontended memory, so the fetch at the mark has no
// delay of its own: a breakpoint in ZEsarUX stops before that delay, the
// replay core after it.

import { writeZ80 } from "../../../src/spectrum.ts";
import { z80Snapshot } from "./keyboard-counter.ts";

export interface ContentionCase {
  model: "48k" | "128k";
  /** The paged bank at $c000 on the 128K. */
  bank?: number;
  /** Where the program sits: $9000 (uncontended) or $6000 (contended) on the 48K, $8000 on the 128K. */
  base: number;
  snippet: number[];
  /** The frame cycle at the mark, as ZEsarUX 13.0 gives it. */
  cycle: number;
}

const times = (bytes: number[], count: number) => Array.from({ length: count }, () => bytes).flat();
const HL_4000 = [0x21, 0x00, 0x40];
const HL_C000 = [0x21, 0x00, 0xc0];

export const CONTENTION_CASES: Record<string, ContentionCase> = {
  none: { model: "48k", base: 0x9000, snippet: HL_4000, cycle: 16570 },
  // 64 NOPs in contended memory: the opcode fetch; a JP leaves for the mark.
  fetch: { model: "48k", base: 0x6000, snippet: [...times([0x00], 64), 0xc3, 0x00, 0x90], cycle: 17911 },
  read: { model: "48k", base: 0x9000, snippet: [...HL_4000, ...times([0x7e], 32)], cycle: 16816 },
  write: { model: "48k", base: 0x9000, snippet: [...HL_4000, ...times([0x77], 32)], cycle: 16816 },
  // INC (HL): the read, one internal cycle with HL on the bus, the write.
  incHl: { model: "48k", base: 0x9000, snippet: [...HL_4000, ...times([0x34], 32)], cycle: 17006 },
  // OUT ($FE),A with A = 7: the ULA port, high byte not contended.
  outUla: { model: "48k", base: 0x9000, snippet: [...HL_4000, 0x3e, 0x07, ...times([0xd3, 0xfe], 32)], cycle: 17008 },
  // IN A,($FE) with A = $40: the ULA port, high byte contended.
  inUlaHigh: { model: "48k", base: 0x9000, snippet: [...HL_4000, ...times([0x3e, 0x40, 0xdb, 0xfe], 16)], cycle: 16913 },
  // IN A,($FF) with A = $40: not the ULA, high byte contended.
  inHigh: { model: "48k", base: 0x9000, snippet: [...HL_4000, ...times([0x3e, 0x40, 0xdb, 0xff], 16)], cycle: 16929 },
  // LDIR of 32 bytes from $4000 to $4800: the repeat cycles have DE on the bus.
  ldir: { model: "48k", base: 0x9000, snippet: [...HL_4000, 0x11, 0x00, 0x48, 0x01, 0x20, 0x00, 0xed, 0xb0], cycle: 17616 },
  // LD A,(IX+5): five internal cycles with the operand address on the bus.
  indexed: { model: "48k", base: 0x9000, snippet: [...HL_4000, 0xdd, 0x21, 0x00, 0x40, ...times([0xdd, 0x7e, 0x05], 16)], cycle: 16939 },
  // EX (SP),HL with the stack in contended memory.
  exSp: { model: "48k", base: 0x9000, snippet: [...HL_4000, 0x31, 0x00, 0x60, ...times([0xe3], 16), 0x31, 0xf0, 0x8f], cycle: 17026 },
  c000odd: { model: "128k", bank: 1, base: 0x8000, snippet: [...HL_C000, ...times([0x7e], 32)], cycle: 16902 },
  c000even: { model: "128k", bank: 0, base: 0x8000, snippet: [...HL_C000, ...times([0x7e], 32)], cycle: 16882 },
  // IN A,(C) with BC = $FFFD: the high byte is in $C000-$FFFF, contended with an odd bank paged in.
  inFffd: { model: "128k", bank: 3, base: 0x8000, snippet: [0x01, 0xfd, 0xff, ...times([0xed, 0x78], 16)], cycle: 16933 },
};

/** The program of a case as a .z80 snapshot (version 1 for the 48K, version 3 for the 128K), and the address of its mark. */
export function contentionSnapshot(item: ContentionCase): { bytes: Uint8Array; mark: number } {
  const { base } = item;
  // DI ; LD SP,$8FF0 ; LD IY,$5C3A ; IM 1 ; EI ; loop: HALT ; LD BC,600 ; d: DEC BC ; LD A,B ; OR C ; JR NZ,d
  const code = [0xf3, 0x31, 0xf0, 0x8f, 0xfd, 0x21, 0x3a, 0x5c, 0xed, 0x56, 0xfb, 0x76, 0x01, 0x58, 0x02, 0x0b, 0x78, 0xb1, 0x20, 0xfb, ...item.snippet];
  const loop = base + 11;
  // The mark: NOP ; JP loop. A snippet that leaves contended memory jumps to $9000.
  const mark = base === 0x6000 ? 0x9000 : base + code.length;
  const tail = [0x00, 0xc3, loop & 0xff, loop >> 8];
  if (item.model === "48k") {
    const ram = new Uint8Array(0xc000);
    ram.set(code, base - 0x4000);
    ram.set(tail, mark - 0x4000);
    return { bytes: z80Snapshot(ram, { pc: base, sp: 0x8ff0, iy: 0x5c3a, im: 1, border: 7 }), mark };
  }
  const banks = Array.from({ length: 8 }, () => new Uint8Array(0x4000));
  banks[2]!.set([...code, ...tail], base - 0x8000);
  const bytes = writeZ80({
    model: "128k",
    registers: { af: 0, bc: 0, de: 0, hl: 0, af2: 0, bc2: 0, de2: 0, hl2: 0, ix: 0, iy: 0x5c3a, sp: 0x8ff0, pc: base, i: 0x3f, r: 0, iff1: false, iff2: false, im: 1 },
    border: 7,
    port7ffd: 0x10 | (item.bank ?? 0),
    banks,
  });
  return { bytes, mark };
}
