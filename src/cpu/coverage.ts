// Execution coverage: the byte format of a coverage map (VICE marks only the
// opcode byte of an executed instruction as executed), the executed code it
// gives, and the seeds that it gives a static analysis, for any CPU (the 6502
// when none is given).

import { type AddressRange } from "../address.ts";
import type { Cpu } from "../cpu.ts";
import { MOS6502 } from "./mos6502.ts";

/** One byte per address: the access flags as VICE reports them, RAM, ROM and I/O apart. */
export const COVERAGE = {
  ramRead: 1 << 0,
  ramWrite: 1 << 1,
  ramExecute: 1 << 2,
  romRead: 1 << 3,
  romExecute: 1 << 4,
  ioRead: 1 << 5,
  ioWrite: 1 << 6,
  ioExecute: 1 << 7,
} as const;

export const EXECUTE = COVERAGE.ramExecute | COVERAGE.romExecute | COVERAGE.ioExecute;
export const READ = COVERAGE.ramRead | COVERAGE.romRead | COVERAGE.ioRead;
export const WRITE = COVERAGE.ramWrite | COVERAGE.ioWrite;

export interface CodeRange {
  start: number;
  end: number;
}

/**
 * The executed code in RAM as ranges: each RAM instruction start in `map`
 * with its operand bytes, by the opcode in `memory` (64 KiB from $0000).
 * `map` starts at `base`. Adjacent and overlapping instructions merge.
 */
export function executedRamCode(map: Uint8Array, base: number, memory: Uint8Array, cpu: Cpu = MOS6502): CodeRange[] {
  const ranges: CodeRange[] = [];
  for (let offset = 0; offset < map.length; offset++) {
    if ((map[offset]! & COVERAGE.ramExecute) === 0) continue;
    const start = base + offset;
    const end = Math.min(0xffff, start + (cpu.decode((address) => memory[address], start)?.length ?? 1) - 1);
    const last = ranges.at(-1);
    if (last !== undefined && start <= last.end + 1) last.end = Math.max(last.end, end);
    else ranges.push({ start, end });
  }
  return ranges;
}

/**
 * The executed instruction starts in RAM that begin a flow: the first after
 * a gap, or the first after an instruction that does not fall through or is a
 * call (JSR), because an analyzer that takes the called routine for one that
 * does not return stops there (the Bruce Lee run). The analyzers follow the
 * rest of a flow themselves.
 */
export function coverageEntries(map: Uint8Array, image: (address: number) => number | undefined, cpu: Cpu = MOS6502): number[] {
  const entries: number[] = [];
  let falls: number | undefined;
  for (let address = 0; address < 0x10000; address++) {
    if ((map[address]! & COVERAGE.ramExecute) === 0) continue;
    const instruction = cpu.decode(image, address);
    if (instruction === undefined) continue;
    if (falls !== address) entries.push(address);
    falls = !instruction.fallsThrough || instruction.call ? undefined : address + instruction.length;
  }
  return entries;
}

const ROM_ACCESS = COVERAGE.romRead | COVERAGE.romExecute;
const RAM_USE = COVERAGE.ramRead | COVERAGE.ramExecute;

/**
 * The image bytes under ROM that the runs never used: the CPU read or ran the
 * ROM there, and never read or ran the RAM. A JSR $FFE4 or an IRQ
 * vector at $FFFE then leads into ROM, not into the leftover RAM bytes of a
 * flat image, so the ranges are data for an analysis run.
 */
export function romOnlyRanges(map: Uint8Array, image: (address: number) => number | undefined): AddressRange[] {
  const ranges: AddressRange[] = [];
  for (let address = 0; address < 0x10000; address++) {
    if ((map[address]! & ROM_ACCESS) === 0 || (map[address]! & RAM_USE) !== 0 || image(address) === undefined) continue;
    const last = ranges.at(-1);
    if (last !== undefined && last.end === address - 1) last.end = address;
    else ranges.push({ start: address, end: address });
  }
  return ranges;
}

/** Every executed instruction start in RAM inside the image: VICE marks the opcode byte of an instruction as executed, not its operand. */
export function executedStarts(map: Uint8Array, image: (address: number) => number | undefined): number[] {
  const starts: number[] = [];
  for (let address = 0; address < 0x10000; address++) if ((map[address]! & COVERAGE.ramExecute) !== 0 && image(address) !== undefined) starts.push(address);
  return starts;
}

/**
 * The coverage flow starts split for Ghidra. A start is a code start, a
 * place in a routine, when it follows an executed call (JSR), or when an
 * executed branch or jump from outside its own flow reaches it (the loop of a
 * routine that jumps back to its own start does not count). Any other start,
 * for example a vector or table target, is a routine entry.
 */
export function coverageSeedKinds(map: Uint8Array, image: (address: number) => number | undefined, cpu: Cpu = MOS6502): { routines: number[]; codeStarts: number[] } {
  const entries = coverageEntries(map, image, cpu);
  const flowOf = new Map<number, number>();
  for (const entry of entries) {
    // A flow runs over the executed instructions that fall through, also over a call.
    for (let at = entry; ; ) {
      const instruction = cpu.decode(image, at);
      if (instruction === undefined || (map[at]! & COVERAGE.ramExecute) === 0 || flowOf.has(at)) break;
      flowOf.set(at, entry);
      if (!instruction.fallsThrough) break;
      at += instruction.length;
    }
  }
  const inside = new Set<number>();
  for (const address of executedStarts(map, image)) {
    const instruction = cpu.decode(image, address)!;
    const reach = (target: number) => flowOf.get(address) !== target && inside.add(target);
    if (instruction.branch !== undefined) reach(instruction.branch);
    if (instruction.jump !== undefined) reach(instruction.jump);
    if (instruction.call) inside.add(address + instruction.length);
  }
  return { routines: entries.filter((entry) => !inside.has(entry)), codeStarts: entries.filter((entry) => inside.has(entry)) };
}
