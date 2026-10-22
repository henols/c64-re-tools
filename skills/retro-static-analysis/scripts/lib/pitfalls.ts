// Platform pitfalls in code regions: code that a C64 runs in another
// way than it reads. A fixed catalogue, reported as candidates only.
//
// raster-bit-8: a read of $D011 gives bit 8 of the current raster line in
// bit 7. Code that writes the value back without clearing bit 7 sets bit 8 of
// the raster compare: the next raster interrupt then comes at line 256 or
// later, or never on a PAL machine past line 311 (the Bruce Lee freeze).

import type { ImageByte } from "./coverage.ts";
import { instructionAt, type Instruction } from "./macros.ts";

export interface Pitfall {
  kind: "raster-bit-8";
  /** The instruction that reads $D011. */
  at: number;
  /** The instruction that writes the value back to $D011. */
  store: number;
}

const D011 = 0xd011;
/** LDA, LDX and LDY absolute, and the stores of the same register. */
const LOADS: Record<number, "a" | "x" | "y"> = { 0xad: "a", 0xae: "x", 0xac: "y" };
const STORES: Record<number, "a" | "x" | "y"> = { 0x8d: "a", 0x8e: "x", 0x8c: "y" };
/** INC, DEC, ASL, ROL and ROR absolute: they read the register and write it back. LSR shifts a 0 into bit 7. */
const READ_MODIFY_WRITE = new Set([0xee, 0xce, 0x0e, 0x2e, 0x6e]);
/** Instructions after which the next one is not the next in the flow: a jump, a return, a call or a branch. */
const FLOW = new Set([0x4c, 0x6c, 0x20, 0x60, 0x40, 0x00, 0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);
/** Instructions that load A, X or Y with a new value, which ends what the load of $D011 gave. */
const NEW_VALUE: Record<"a" | "x" | "y", Set<number>> = {
  a: new Set([0xa9, 0xa5, 0xb5, 0xad, 0xbd, 0xb9, 0xa1, 0xb1, 0x8a, 0x98, 0x68]),
  x: new Set([0xa2, 0xa6, 0xb6, 0xae, 0xbe, 0xaa, 0xba]),
  y: new Set([0xa0, 0xa4, 0xb4, 0xac, 0xbc, 0xa8]),
};
/** The most instructions between the load and the store. */
const WINDOW = 8;

/** The raster-bit-8 pitfalls in the code regions, in address order. */
export function findPitfalls(byteAt: ImageByte, regions: ReadonlyArray<{ start: number; end: number }>): Pitfall[] {
  const found: Pitfall[] = [];
  for (const region of [...regions].sort((a, b) => a.start - b.start)) {
    const run: Array<Instruction & { at: number }> = [];
    for (let at = region.start; at <= region.end; ) {
      const instruction = instructionAt(byteAt, at, region.end);
      if (instruction === undefined) break;
      run.push({ ...instruction, at });
      at += instruction.length;
    }
    run.forEach((instruction, index) => {
      if (instruction.length !== 3 || instruction.value !== D011) return;
      if (READ_MODIFY_WRITE.has(instruction.opcode)) {
        found.push({ kind: "raster-bit-8", at: instruction.at, store: instruction.at });
        return;
      }
      const register = LOADS[instruction.opcode];
      if (register === undefined) return;
      for (const next of run.slice(index + 1, index + 1 + WINDOW)) {
        // AND #imm without bit 7 clears raster bit 8: the code knows about it.
        if (register === "a" && next.opcode === 0x29 && (next.value & 0x80) === 0) return;
        if (STORES[next.opcode] === register && next.length === 3 && next.value === D011) {
          found.push({ kind: "raster-bit-8", at: instruction.at, store: next.at });
          return;
        }
        if (FLOW.has(next.opcode) || NEW_VALUE[register].has(next.opcode)) return;
      }
    });
  }
  return found;
}
