// Pointer candidates: code that builds an address from immediates. The
// byte of each immediate is the low or high byte of the address, so a rebuild
// that moves the address needs an operand expression there. They are only
// reported, never written: the LLM records the expressions with c64-knowledge.
//
// The scan reads short straight runs of instructions: LDA/LDX/LDY #imm and
// STA/STX/STY to zero page or absolute, plus SEI, CLI, CLC, SEC and NOP. Any
// other instruction ends the run, so no register value is guessed across it.

import { instructionLength } from "#src/c64.ts";
import type { ImageByte } from "./coverage.ts";

const LOADS: Record<number, "a" | "x" | "y"> = { 0xa9: "a", 0xa2: "x", 0xa0: "y" };
const STORES: Record<number, "a" | "x" | "y"> = { 0x85: "a", 0x8d: "a", 0x86: "x", 0x8e: "x", 0x84: "y", 0x8c: "y" };
const NEUTRAL = new Set([0x78, 0x58, 0x18, 0x38, 0xea]);
/** The instructions of one run: enough for two loads, two stores and a few neutral ones. */
const MAX_RUN = 8;
/** The vectors that the KERNAL and the CPU read: IRQ, BRK, NMI, and the hardware vectors. */
const VECTORS = new Set([0x0314, 0x0316, 0x0318, 0xfffa, 0xfffc, 0xfffe]);
/** (zp),y: ORA AND EOR ADC STA LDA CMP SBC. */
const INDIRECT_Y = new Set([0x11, 0x31, 0x51, 0x71, 0x91, 0xb1, 0xd1, 0xf1]);
/** The sprite pointers of the default screen at $0400 in VIC bank 0. */
const SPRITE_POINTERS = { start: 0x07f8, end: 0x07ff };

export type PointerCandidate =
  | {
      kind: "vector" | "zero-page pointer";
      /** The vector or zero-page pair that gets the address. */
      to: number;
      /** The address that the two immediates make. */
      target: number;
      /** The instructions with the low and the high byte as immediate. */
      low: number;
      high: number;
    }
  | {
      kind: "sprite pointer";
      to: number;
      /** value × 64: the sprite data, in VIC bank 0. */
      target: number;
      /** The instruction with the pointer as immediate. */
      at: number;
      value: number;
    };

interface Store {
  /** The address of the load of the immediate. */
  load: number;
  value: number;
  to: number;
}

/** The stores of immediates in the straight run that starts at `start`. */
function storesFrom(byteAt: ImageByte, start: number, range: { start: number; end: number }): Store[] {
  const last: Partial<Record<"a" | "x" | "y", { load: number; value: number }>> = {};
  const stores: Store[] = [];
  let at = start;
  for (let count = 0; count < MAX_RUN; count++) {
    const opcode = byteAt(at);
    if (opcode === undefined) break;
    const length = instructionLength(opcode);
    if (at + length - 1 > range.end) break;
    const operand = length === 2 ? byteAt(at + 1)! : length === 3 ? byteAt(at + 1)! | (byteAt(at + 2)! << 8) : 0;
    if (LOADS[opcode] !== undefined) last[LOADS[opcode]] = { load: at, value: operand };
    else if (STORES[opcode] !== undefined) {
      const loaded = last[STORES[opcode]];
      if (loaded === undefined) break;
      stores.push({ ...loaded, to: operand });
    } else if (!NEUTRAL.has(opcode)) break;
    at += length;
  }
  return stores;
}

/**
 * Finds the pointer candidates in the image: an immediate pair stored to a
 * vector or to a zero-page pair that (zp),y uses, where the pair makes an
 * address in the image or a platform name; and an immediate stored to a sprite
 * pointer of the default screen whose sprite data is in a sprite region.
 */
export function findPointers(
  byteAt: ImageByte,
  range: { start: number; end: number },
  known: { platform: (address: number) => boolean; sprites: ReadonlyArray<{ start: number; end: number }> },
): PointerCandidate[] {
  const indirect = new Set<number>();
  for (let at = range.start; at < range.end; at++) if (INDIRECT_Y.has(byteAt(at)!)) indirect.add(byteAt(at + 1)!);
  const inImage = (address: number) => address >= range.start && address <= range.end && byteAt(address) !== undefined;
  const found = new Map<string, PointerCandidate>();
  for (let at = range.start; at <= range.end; at++) {
    if (LOADS[byteAt(at)!] === undefined) continue;
    const stores = storesFrom(byteAt, at, range);
    for (const low of stores) {
      const high = stores.find((store) => store.to === low.to + 1);
      const target = high === undefined ? undefined : low.value | (high.value << 8);
      const kind = VECTORS.has(low.to) ? "vector" : low.to < 0xff && indirect.has(low.to) ? "zero-page pointer" : undefined;
      if (high !== undefined && target !== undefined && kind !== undefined && (inImage(target) || known.platform(target))) {
        found.set(`${low.load}|${high.load}`, { kind, to: low.to, target, low: low.load, high: high.load });
      }
      const sprite = low.value * 64;
      if (low.to >= SPRITE_POINTERS.start && low.to <= SPRITE_POINTERS.end && known.sprites.some((region) => sprite >= region.start && sprite <= region.end)) {
        found.set(`${low.load}`, { kind: "sprite pointer", to: low.to, target: sprite, at: low.load, value: low.value });
      }
    }
  }
  const first = (candidate: PointerCandidate) => (candidate.kind === "sprite pointer" ? candidate.at : Math.min(candidate.low, candidate.high));
  return [...found.values()].sort((a, b) => first(a) - first(b));
}
