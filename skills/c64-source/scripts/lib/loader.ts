// The loader of a generated source: a PRG that copies each segment and
// the entry state's pages $0002-$03ff into place, sets the display registers
// of the VIC-II and the VIC bank, waits for the entry's raster line,
// sets the CIA timers and interrupt masks, sets $00/$01, the stack
// pointer, A, X, Y and the flags, and jumps to the entry. The copies run
// from a free page with SEI and all RAM visible, in an order where no copy
// overwrites the packed bytes of a copy that has not run yet. The plan is
// simulated here before the emulator runs it. An image too large for one
// loader file gets the packed form: Exomizer unpacks the program and the
// copier, and the copier writes only pages $0002-$03ff. With a start
// screen in the knowledge, the copier shows it after the copies and waits for
// a key or a fire button: the code is start-screen.asm, the same for each program.
// The loader loads the segments without the leftovers: the ranges of the
// source that nothing uses are not in loader.prg.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type AddressRange, formatC64Address, formatC64Byte, prgRange } from "#src/c64.ts";
import { compareBuild, mergedPrograms } from "#src/compare.ts";
import { Refusal } from "#src/errors.ts";
import { parseEntryState } from "#src/host-client/entry-state.ts";
import { isRomFont, startScreenRanges, type StartScreenRow } from "#src/knowledge/read.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { pack } from "#src/native/exomizer.ts";
import type { ToolContext } from "#src/native/run.ts";

export interface EntryState {
  pc: number;
  a: number;
  x: number;
  y: number;
  sp: number;
  /** The status register as PLP reads it. */
  flags: number;
  port: [number, number];
  /** $0000-$03ff at the entry. */
  pages: Uint8Array;
  /** The VIC-II at the entry: $d000-$d02e, and the VIC bank (bits 0-1 of $dd00). */
  vic?: { registers: Uint8Array; bank: number };
  /** CIA 1 and CIA 2 at the entry. */
  cia?: [EntryCia, EntryCia];
}

/** A CIA at the entry: $xx00-$xx0f as a read without side effects gives them, and what no read gives. */
export interface EntryCia {
  registers: Uint8Array;
  latchA: number;
  latchB: number;
  interruptMask: number;
}

/**
 * The VIC-II registers that the loader sets, each with the bits that a
 * read gives back: not the raster, the light pen, the interrupt registers or
 * the collisions. The raster line comes from a wait instead.
 */
export const VIC_DISPLAY_REGISTERS: ReadonlyArray<{ register: number; mask: number }> = [
  ...Array.from({ length: 0x11 }, (_, register) => ({ register, mask: 0xff })),
  { register: 0x11, mask: 0x7f },
  { register: 0x15, mask: 0xff },
  { register: 0x16, mask: 0x3f },
  { register: 0x17, mask: 0xff },
  { register: 0x18, mask: 0xfe },
  { register: 0x1b, mask: 0xff },
  { register: 0x1c, mask: 0xff },
  { register: 0x1d, mask: 0xff },
  ...Array.from({ length: 0x0f }, (_, index) => ({ register: 0x20 + index, mask: 0x0f })),
];

/** The raster line of the entry, from $d011 bit 7 and $d012 as the capture read them. */
export function rasterLine(registers: Uint8Array): number {
  return ((registers[0x11]! & 0x80) << 1) | registers[0x12]!;
}

const FLAG_BITS = { n: 0x80, v: 0x40, d: 0x08, i: 0x04, z: 0x02, c: 0x01 } as const;

/**
 * The entry state that the loader recreates: the shared entry state of the
 * program capture, with the flags as PLP reads them, the VIC-II and the CIAs.
 */
export function loaderState(value: unknown, where: string): EntryState {
  const state = parseEntryState(value, where);
  const fail = (what: string): never => {
    throw new Refusal("invalid-input", `${where} is not an entry state of a program capture: ${what}. Capture the program again at its entry point.`);
  };
  let flags = 0x20;
  for (const [name, bit] of Object.entries(FLAG_BITS)) if (state.flags[name as keyof typeof FLAG_BITS]) flags |= bit;
  return { pc: state.pc, a: state.a, x: state.x, y: state.y, sp: state.sp, flags, port: state.port, pages: state.pages, ...readVic(state.raw.io as Record<string, any> | undefined, fail), ...readCia(state.raw, fail) };
}

export interface Copy {
  /** What the copy writes: a segment or a part of pages 0-3. */
  what: string;
  target: AddressRange;
  source: AddressRange;
  /** True when the copy runs from the last byte down: its target is above an overlapping source. */
  backward: boolean;
}

/** What the loader holds, in its order: a segment or a part of pages 0-3, packed at an address of the loader. */
export interface PackedBlock {
  what: string;
  range: AddressRange;
  packedAt: number;
  bytes: (address: number) => number;
}

export interface LoaderPlan {
  /** The ranges that the loader puts in place: the segments without the leftovers. */
  loaded: AddressRange[];
  blocks: PackedBlock[];
  copies: Copy[];
  /** The first of the two free pages where the copier runs. */
  copier: number;
  /** The address of the free stack byte below the stack pointer, which the flags pass through. */
  stackByte: number;
  end: number;
  text: string;
  /** The CIA timers and masks that the loader sets, when the entry state has them. */
  cia?: CiaPlan;
  /** The packed form: loader.asm holds only the copier and pages 0-3 from `start` to `end`, and Exomizer packs it with the build of main.asm. */
  packed?: { start: number };
  /** The VIC-II values that the start screen sets, when the knowledge has one. */
  startScreen?: StartScreenPlan;
}

/**
 * What the loader cannot set as it was at the entry. An entry state
 * without CIA values (from a capture of an older version) gives no timers at all.
 */
export function loaderLimits(plan: { cia?: CiaPlan }): string[] {
  if (plan.cia === undefined) {
    return ["The entry state has no CIA values, so the loader does not set the CIA timers. Capture the program again at its entry point to get them."];
  }
  return plan.cia.limits;
}

/** The label of the loader's jump to the entry, in ACME's symbol list. */
export const LOADER_JUMP = "c64_source_loader_jump";
/** The labels of the start screen: its wait for a key or a fire button, and the code after the wait. */
export const START_SCREEN_WAIT = "loader_start_screen_wait";
export const START_SCREEN_CONTINUE = "loader_start_screen_continue";
/** The file of the start screen in the generated source. */
export const START_SCREEN_FILE = "start_screen.asm";
/** The code of the start screen: the same for each program. loader.asm sets its values. */
export const START_SCREEN_CODE = readFileSync(fileURLToPath(new URL("./start-screen.asm", import.meta.url)), "utf8");
/** The bytes of the start screen code for each colour mode: none, one colour, a copy of 1000 bytes. */
export const START_SCREEN_SIZES = [197, 216, 226] as const;

/** The VIC-II values of a start screen, as the start screen code sets them. */
export interface StartScreenPlan {
  d011: number;
  d016: number;
  d018: number;
  /** The VIC bank: 0 for $0000-$3fff to 3 for $c000-$ffff. */
  bank: number;
  border: number;
  background: number;
  /** 0: no colour RAM (hires), 1: one colour, 2: a copy of 1000 bytes. */
  colourMode: 0 | 1 | 2;
}

/** The VIC-II values that show a start screen of the knowledge. */
export function startScreenPlan(row: StartScreenRow): StartScreenPlan {
  const bank = row.screen >> 14;
  const base = (row.bitmap === undefined ? ((row.charset! & 0x3fff) >> 11) << 1 : ((row.bitmap & 0x3fff) >> 13) << 3) | 0x01;
  return {
    d011: row.mode === "text" ? 0x1b : 0x3b,
    d016: row.mode === "multicolour" ? 0x18 : 0x08,
    d018: (((row.screen & 0x3fff) >> 10) << 4) | base,
    bank,
    border: row.border,
    background: row.background,
    colourMode: row.colours !== undefined ? 2 : row.colour !== undefined ? 1 : 0,
  };
}

/** The lines of loader.asm that give the start screen code its values. */
export function startScreenValues(row: StartScreenRow, plan: StartScreenPlan): string[] {
  const value = (name: string, number: number, comment?: string) => `c64_source_ss_${name} = ${formatC64Byte(number)}${comment === undefined ? "" : ` ; ${comment}`}`;
  const font = row.charset !== undefined && isRomFont(row.charset) ? " (the character ROM)" : "";
  const what = [`screen ${formatC64Address(row.screen)}`, ...(row.bitmap === undefined ? [] : [`bitmap ${formatC64Address(row.bitmap)}`]), ...(row.charset === undefined ? [] : [`charset ${formatC64Address(row.charset)}${font}`])];
  return [
    `; The start screen: ${row.mode}, ${what.join(", ")}.${row.comment === undefined ? "" : ` ${row.comment.replace(/\s*\r?\n\s*/g, " ")}`}`,
    value("d011", plan.d011),
    value("d016", plan.d016),
    value("d018", plan.d018),
    value("bank", 3 - plan.bank, `VIC bank ${formatC64Address(plan.bank << 14)}-${formatC64Address((plan.bank << 14) + 0x3fff)}`),
    value("border", plan.border),
    value("background", plan.background),
    value("colour_mode", plan.colourMode),
    value("colour", row.colour ?? 0),
    `c64_source_ss_colours = ${formatC64Address(row.colours ?? 0)}`,
  ];
}

/** The copier lines that include the start screen code, in a zone of its own. */
const START_SCREEN_LINES = ["!zone c64_source_start_screen {", `!source "${START_SCREEN_FILE}"`, "}"];

const LOAD = 0x0801;
const STUB = 0x080d;
/** sei, all RAM, ldx, the 2-page move loop and jmp. */
const STUB_SIZE = 25;
/** The copier code and its three variables, without the table. */
const COPIER_CODE_SIZE = 167;
/** The VIC-II code of the copier, without its two tables of one byte per register. */
const VIC_CODE_SIZE = 44;
const VIC_SIZE = VIC_CODE_SIZE + 2 * VIC_DISPLAY_REGISTERS.length;
/** The copier and the stub's move of it: two pages, or three with a start screen. */
const COPIER_LIMIT = 0x200;
/** The bytes that the stub adds for each more page of the copier: lda and sta. */
const STUB_PAGE_SIZE = 6;
const COPY_ENTRY = 7;
/** X indexes the table, so the table holds at most this many copies in 256 bytes. */
const TABLE_COPIES = Math.floor((256 - 2) / COPY_ENTRY);
/** A loader that loads into $d000 or higher would write the I/O area. */
const LOAD_LIMIT = 0xcfff;
const COPIER_PAGES = [...Array.from({ length: 15 }, (_, index) => 0xc000 + index * 0x100), ...Array.from({ length: 0x9b }, (_, index) => 0x9e00 - index * 0x100)];
/** The areas where the copier can run: RAM that no ROM and no I/O hides when $01 is $34 or $35, above the screen at $0400. */
const COPIER_AREAS: readonly AddressRange[] = [
  { start: 0x0400, end: 0x9fff },
  { start: 0xc000, end: 0xcfff },
];

const overlaps = (a: AddressRange, b: AddressRange) => a.start <= b.end && b.start <= a.end;
const show = (range: AddressRange) => `${formatC64Address(range.start)}-${formatC64Address(range.end)}`;

/** Parts of `range` that no range in `holes` covers. */
export function subtract(range: AddressRange, holes: AddressRange[]): AddressRange[] {
  let pieces = [range];
  for (const hole of holes) {
    pieces = pieces.flatMap((piece) => {
      if (!overlaps(piece, hole)) return [piece];
      return [...(hole.start > piece.start ? [{ start: piece.start, end: hole.start - 1 }] : []), ...(hole.end < piece.end ? [{ start: hole.end + 1, end: piece.end }] : [])];
    });
  }
  return pieces;
}

/** Orders the copies so that no copy writes over the source of a later one; undefined when they form a cycle. */
export function copyOrder(copies: Array<Omit<Copy, "backward">>): number[] | undefined {
  const order: number[] = [];
  const done = new Set<number>();
  while (order.length < copies.length) {
    const next = copies.findIndex((copy, index) => !done.has(index) && copies.every((other, at) => at === index || done.has(at) || !overlaps(copy.target, other.source)));
    if (next < 0) return undefined;
    order.push(next);
    done.add(next);
  }
  return order;
}

/** Runs the copies on a memory model as the copier does, byte by byte; returns the first wrong target byte. */
export function simulate(memory: Int16Array, copies: Copy[], expected: (address: number) => number): number | undefined {
  for (const copy of copies) {
    const length = copy.target.end - copy.target.start + 1;
    for (let step = 0; step < length; step++) {
      const offset = copy.backward ? length - 1 - step : step;
      memory[copy.target.start + offset] = memory[copy.source.start + offset]!;
    }
  }
  for (const copy of copies) for (let address = copy.target.start; address <= copy.target.end; address++) if (memory[address] !== expected(address)) return address;
  return undefined;
}

/** True when a read of the address with $01 = $37, as RUN leaves it, gives a ROM byte. */
const underRom = (address: number) => (address >= 0xa000 && address <= 0xbfff) || address >= 0xe000;

/**
 * Why a loader stopped before its jump, from the RAM after the stop: the first
 * byte of the moved copier that is not the byte of the loader file, else, when
 * the copier ran, the first byte that a copy did not write as planned. In the
 * packed form the unpack puts the copier in place, and `fileByte` gives the
 * build of loader.asm.
 */
export function stopCause(ram: Uint8Array, plan: LoaderPlan, copierSource: number, fileByte: (address: number) => number, copied: boolean, expected: (address: number) => number): string | undefined {
  for (let offset = 0; offset <= plan.end - copierSource; offset++) {
    const got = ram[plan.copier + offset]!;
    const wanted = fileByte(copierSource + offset);
    if (got === wanted) continue;
    const at = formatC64Address(plan.copier + offset);
    if (plan.packed !== undefined) return `The copier at ${at} holds ${formatC64Byte(got)}, not ${formatC64Byte(wanted)} of the build of loader.asm: the unpack did not write it.`;
    const rom = underRom(copierSource + offset) ? `; ${formatC64Address(copierSource + offset)} is under a ROM, so the move read the ROM` : "";
    return `The copier at ${at} holds ${formatC64Byte(got)}, not ${formatC64Byte(wanted)} from ${formatC64Address(copierSource + offset)} of the loader file${rom}.`;
  }
  if (!copied) return undefined;
  for (const copy of plan.copies) {
    for (let address = copy.target.start; address <= copy.target.end; address++) {
      if (ram[address] !== expected(address)) return `The copy of ${copy.what} wrote ${formatC64Byte(ram[address]!)} at ${formatC64Address(address)}, not ${formatC64Byte(expected(address))}.`;
    }
  }
  return undefined;
}

/** The VIC-II and its bank from the io part of an entry state, when it has them. */
function readVic(io: Record<string, any> | undefined, fail: (what: string) => never): { vic: NonNullable<EntryState["vic"]> } | Record<string, never> {
  if (io?.vic === undefined) return {};
  const vic = io.vic.bytes;
  const cia2 = io.cia2?.bytes;
  if (typeof vic !== "string" || !/^[0-9a-f]{94}$/i.test(vic)) return fail("io.vic.bytes is not 47 bytes of hex");
  if (typeof cia2 !== "string" || !/^[0-9a-f]{2}/i.test(cia2)) return fail("io.cia2.bytes is missing");
  return { vic: { registers: Buffer.from(vic, "hex"), bank: Number.parseInt(cia2.slice(0, 2), 16) & 0x03 } };
}

function readCia(value: Record<string, any>, fail: (what: string) => never): { cia: [EntryCia, EntryCia] } | Record<string, never> {
  if (value.cia === undefined) return {};
  const chip = (name: "cia1" | "cia2"): EntryCia => {
    const bytes = value.io?.[name]?.bytes;
    if (typeof bytes !== "string" || !/^[0-9a-f]{32}$/i.test(bytes)) return fail(`io.${name}.bytes is not 16 bytes of hex`);
    const hidden = value.cia[name];
    const number = (item: unknown, what: string, max: number) => (Number.isInteger(item) && (item as number) >= 0 && (item as number) <= max ? (item as number) : fail(`cia.${name}.${what} is not a number from 0 to ${max}`));
    return { registers: Buffer.from(bytes, "hex"), latchA: number(hidden?.latchA, "latchA", 0xffff), latchB: number(hidden?.latchB, "latchB", 0xffff), interruptMask: number(hidden?.interruptMask, "interruptMask", 0x1f) };
  };
  return { cia: [chip("cia1"), chip("cia2")] };
}

/** One CIA timer that the loader sets, and what the check of the loader expects of it at the jump. */
export interface CiaTimerPlan {
  cia: 1 | 2;
  timer: "A" | "B";
  /** The control register as a read gives it: without bit 4, the force load. */
  control: number;
  latch: number;
  /** The counter at the jump, 3 cycles before the entry; undefined when the loader cannot set it. */
  counterAtJump?: number;
}

export interface CiaPlan {
  timers: CiaTimerPlan[];
  masks: [number, number];
  /** What the loader cannot set as it was at the entry. */
  limits: string[];
}

/**
 * The CIA timers as the KERNAL leaves them when RUN starts the loader, on a
 * PAL C64: only CIA 1 timer A runs, for the 60 Hz interrupt. A timer that the
 * entry has in this state is not written. The loader check reads every timer.
 */
const KERNAL_TIMERS: ReadonlyArray<{ control: number; latch: number; counter?: number }> = [
  { control: 0x01, latch: 0x4025 },
  { control: 0x08, latch: 0xffff, counter: 0xffff },
  { control: 0x08, latch: 0xffff, counter: 0xffff },
  { control: 0x08, latch: 0xffff, counter: 0xffff },
];
const KERNAL_MASKS: readonly [number, number] = [0x01, 0x00];
/** Cycles from the end of the CIA part to the entry: $00, $01, the stack pointer, the flags, A, X, Y, PLP and JMP. */
const TAIL_CYCLES = 33;
/** Cycles after the write that starts a CIA timer in which it does not count yet, measured in VICE. */
const CIA_START_DELAY = 1;
/** Cycles of one raster line of a PAL C64. */
const LINE_CYCLES = 63;
const PAL_LINES = 312;

interface Op {
  text: string;
  bytes: number;
  cycles: number;
}

/**
 * The copier's CIA part, after the raster wait: the timers and
 * interrupt masks of the entry state. A running timer is stopped, loaded
 * with its counter at the entry plus the cycles to the entry, started, and
 * given its latch, so it counts to the entry's value just at the entry.
 * Then the interrupt flags that the copy left are read away.
 */
export function ciaSection(state: EntryState): { ops: Op[]; plan: CiaPlan } | undefined {
  if (state.cia === undefined) return undefined;
  const lda = (value: number): Op => ({ text: `lda #${formatC64Byte(value)}`, bytes: 2, cycles: 2 });
  const sta = (address: number): Op => ({ text: `sta ${formatC64Address(address)}`, bytes: 3, cycles: 4 });
  const limits: string[] = [];
  const timers: CiaTimerPlan[] = [];
  const disable: Op[] = [];
  const loads: Array<Op | ((cycles: number[]) => Op)> = [];
  const starts: Op[] = [];
  const latches: Op[] = [];
  const acks: Op[] = [];
  const masks: Op[] = [];
  /** For each running timer: its index in starts, and how its load value follows from the cycles after its start. */
  const running: Array<{ start: number; counter: number; latch: number; system: boolean; name: string; plan: CiaTimerPlan }> = [];
  state.cia.forEach((chip, index) => {
    const id = (index + 1) as 1 | 2;
    const base = index === 0 ? 0xdc00 : 0xdd00;
    let touched = false;
    for (const timer of ["A", "B"] as const) {
      const at = timer === "A" ? 0x04 : 0x06;
      const controlAt = base + (timer === "A" ? 0x0e : 0x0f);
      const control = chip.registers[timer === "A" ? 0x0e : 0x0f]! & 0xef;
      const counter = chip.registers[at]! | (chip.registers[at + 1]! << 8);
      const latch = timer === "A" ? chip.latchA : chip.latchB;
      const name = `CIA ${id} timer ${timer}`;
      const plan: CiaTimerPlan = { cia: id, timer, control, latch, counterAtJump: counter };
      timers.push(plan);
      const kernal = KERNAL_TIMERS[index * 2 + (timer === "A" ? 0 : 1)]!;
      const runs = (control & 0x01) !== 0;
      if (!runs && control === kernal.control && latch === kernal.latch && counter === kernal.counter) continue;
      touched = true;
      // Stopped, a write of the high latch byte also loads the counter.
      loads.push(lda(control & 0xee), sta(controlAt));
      if (runs) {
        // Timer A counts system cycles without bit 5, timer B without bits 5 and 6; other inputs do not count in the loader.
        const system = timer === "A" ? (control & 0x20) === 0 : (control & 0x60) === 0;
        const slot = running.length;
        running.push({ start: starts.length, counter, latch, system, name, plan });
        loads.push((values) => lda(values[slot]! & 0xff), sta(base + at), (values) => lda(values[slot]! >> 8), sta(base + at + 1));
        starts.push(lda(control), sta(controlAt));
        latches.push(lda(latch & 0xff), sta(base + at), lda(latch >> 8), sta(base + at + 1));
        if (system) plan.counterAtJump = counter + 3;
        continue;
      }
      loads.push(lda(counter & 0xff), sta(base + at), lda(counter >> 8), sta(base + at + 1));
      if (latch === counter) continue;
      if (latch >> 8 === counter >> 8) {
        loads.push(lda(latch & 0xff), sta(base + at));
        continue;
      }
      // The high byte loads the counter of a stopped timer too.
      loads.push(lda(latch & 0xff), sta(base + at), lda(latch >> 8), sta(base + at + 1));
      plan.counterAtJump = latch;
      limits.push(`${name} is stopped with the counter $${counter.toString(16).padStart(4, "0")} and the latch $${latch.toString(16).padStart(4, "0")}: a stopped CIA timer loads its latch, so the counter is the latch.`);
    }
    const mask = chip.interruptMask;
    if (mask !== KERNAL_MASKS[index]) {
      disable.push(lda(0x7f), sta(base + 0x0d));
      if (mask !== 0) masks.push(lda(0x80 | mask), sta(base + 0x0d));
      touched = true;
    }
    if (touched) acks.push({ text: `lda ${formatC64Address(base + 0x0d)}`, bytes: 3, cycles: 4 });
    const flags = chip.registers[0x0d]! & 0x1f;
    if (flags !== 0) limits.push(`CIA ${id} has the interrupt flags $${flags.toString(16).padStart(2, "0")} at the entry: only an event sets a flag, so the loader cannot.`);
  });
  if (loads.length === 0 && disable.length === 0) return { ops: [], plan: { timers, masks: [state.cia[0].interruptMask, state.cia[1].interruptMask], limits } };
  // The cycles from each start write to the entry: what follows it here, and the tail.
  const after = [...starts, ...latches, ...acks, ...masks];
  const values = running.map((item) => {
    const followers = after.slice(item.start + 2).reduce((sum, op) => sum + op.cycles, 0);
    if (!item.system) return item.counter;
    const load = item.counter + followers + TAIL_CYCLES - CIA_START_DELAY;
    if (load <= 0xffff) return load;
    limits.push(`${item.name} counts from $${item.counter.toString(16).padStart(4, "0")} at the entry: the loader cannot start it so near $ffff without an underflow, so the counter differs.`);
    delete item.plan.counterAtJump;
    return item.counter;
  });
  const pre: Op[] = state.vic === undefined ? [lda(0x35), { text: "sta $01", bytes: 2, cycles: 3 }] : [];
  const ops = [...pre, ...disable, ...loads.map((op) => (typeof op === "function" ? op(values) : op)), ...after];
  return { ops, plan: { timers, masks: [state.cia[0].interruptMask, state.cia[1].interruptMask], limits } };
}

export interface LoaderInput {
  /** The ranges to load, each with the files that hold it, in address order: the segments without the leftovers. */
  segments: Array<AddressRange & { files: string[] }>;
  byteAt: (address: number) => number;
  state: EntryState;
  entry: number;
  /** The label of the entry in the source: the loader jumps to it, so the jump follows the code when it moves. */
  entryName?: string;
  header: string[];
  /** The source has switches.asm: the loader includes it before the constants. */
  switches?: boolean;
  /** The source has macros.asm: the loader includes it after the constants. */
  macros?: boolean;
  /** The source has config.asm but no switches.asm: the loader includes config.asm for START_SCREEN. */
  config?: boolean;
  /** The start screen of the knowledge: the copier shows it after the copies. */
  startScreen?: StartScreenRow;
}

/** The checks of a start screen against the program and the entry state. Refuses by name. */
function checkStartScreen(input: LoaderInput): StartScreenPlan | undefined {
  const row = input.startScreen;
  if (row === undefined) return undefined;
  if (input.state.vic === undefined) {
    throw new WireFailure("invalid-input", "The entry state has no VIC-II values, so the loader cannot set the display of the program after the start screen. Capture the program again at its entry point, or remove the start screen (unstart-screen).");
  }
  for (const { what, range } of startScreenRanges(row)) {
    const inside = input.segments.some((segment) => range.start >= segment.start && range.end <= segment.end);
    if (!inside) throw new WireFailure("invalid-input", `The start screen part ${what} (${show(range)}) is not in one segment of the program. The start screen must be in memory at the entry: capture it with the program, or correct the start screen in the knowledge.`);
  }
  return startScreenPlan(row);
}

/** The settings that loader.asm includes: switches.asm, else config.asm for a start screen, else none. */
function settingsLines(input: LoaderInput): string[] {
  if (input.switches === true) return ['!source "switches.asm"'];
  return input.config === true ? ['!source "config.asm"'] : [];
}

/** The label of a block: its first byte and the byte after it in the loader file, and its first address where it runs. */
const blockLabel = (start: number, part: "from" | "end" | "to") => `loader_${part}_${start.toString(16).padStart(4, "0")}`;
const plus = (label: string, offset: number) => (offset === 0 ? label : `${label}+${offset}`);
/** The label of the copier in the loader file, which the stub moves to its two pages. */
export const COPIER_SOURCE = "loader_copier_src";

/** A block of the loader: a segment with its files, or bytes of pages 0-3. */
interface Block {
  what: string;
  range: AddressRange;
  files?: string[];
  pseudo: number;
  bytes: (address: number) => number;
}

/** The block's bytes as !byte lines of 16. */
function byteLines(range: AddressRange, bytes: (address: number) => number): string[] {
  const lines: string[] = [];
  for (let address = range.start; address <= range.end; address += 16) {
    const last = Math.min(range.end, address + 15);
    lines.push(`        !byte ${Array.from({ length: last - address + 1 }, (_, offset) => formatC64Byte(bytes(address + offset))).join(",")}`);
  }
  return lines;
}

/**
 * Plans the loader: the packed layout, the copy order and the copier page, and writes loader.asm.
 * An image too large for one loader file gets the packed form (see planPacked). Refuses by name when no plan exists.
 */
export function planLoader(input: LoaderInput): LoaderPlan {
  const { state } = input;
  const screen = checkStartScreen(input);
  const copierBytes = screen === undefined ? COPIER_LIMIT : COPIER_LIMIT + 0x100;
  const copierPages = copierBytes >> 8;
  // What the copies write: each segment without $00/$01, which the loader sets last, and pages $0002-$03ff where no segment is.
  const blocks: Block[] = [];
  for (const segment of input.segments) blocks.push({ what: `segment ${show(segment)}`, range: segment, files: segment.files, pseudo: segment.start, bytes: input.byteAt });
  for (const part of subtract({ start: 0x0002, end: 0x03ff }, input.segments)) {
    blocks.push({ what: `entry state ${show(part)}`, range: part, pseudo: part.start, bytes: (address) => state.pages[address]! });
  }
  blocks.sort((a, b) => a.range.start - b.range.start);

  let at = STUB + STUB_SIZE + (copierPages - 2) * STUB_PAGE_SIZE;
  const plain: Array<Omit<Copy, "backward">> = [];
  const packedAt: number[] = [];
  /** The block start of each copy in `plain`, which names its labels. */
  const blockOf: number[] = [];
  for (const block of blocks) {
    packedAt.push(at);
    const target = { start: Math.max(block.range.start, 0x0002), end: block.range.end };
    if (target.start <= target.end) {
      const source = { start: at + (target.start - block.range.start), end: at + (target.end - block.range.start) };
      plain.push({ what: block.what, target, source });
      blockOf.push(block.range.start);
    }
    at += block.range.end - block.range.start + 1;
  }
  const cia = ciaSection(state);
  const ciaSize = cia === undefined ? 0 : cia.ops.reduce((sum, op) => sum + op.bytes, 0);
  const codeSize = COPIER_CODE_SIZE + (state.vic === undefined ? 0 : VIC_SIZE) + ciaSize + (screen === undefined ? 0 : START_SCREEN_SIZES[screen.colourMode]);
  const copierImage = at;
  const end = copierImage + codeSize + COPY_ENTRY * plain.length + 2 - 1;
  // The end can be past $ffff, which is no address.
  if (end > LOAD_LIMIT) return planPacked(input, blocks, cia, codeSize, screen, `The plain loader would end ${end > 0xffff ? "past $ffff" : `at ${formatC64Address(end)}`}, after ${formatC64Address(LOAD_LIMIT)}: loading it would write the I/O area.`);
  // The CIA part and the start screen take room from the copy table in the copier's pages.
  const maxCopies = Math.max(0, Math.min(TABLE_COPIES, Math.floor((copierBytes - codeSize - 2) / COPY_ENTRY)));
  if (plain.length > maxCopies) return planPacked(input, blocks, cia, codeSize, screen, `The plain loader needs ${plain.length} copies, and its copier can do at most ${maxCopies}.`);

  const order = copyOrder(plain);
  if (order === undefined) {
    const clashing = plain.filter((copy) => plain.some((other) => other !== copy && overlaps(copy.target, other.source))).map((copy) => `${copy.what} (packed at ${show(copy.source)})`);
    throw new WireFailure("invalid-input", `No copy order exists: each of these copies writes over the packed bytes of another one: ${clashing.join(", ")}. Write the loader by hand.`);
  }
  const loaded = { start: LOAD, end };
  const copier = COPIER_PAGES.find((page) => {
    const pages = { start: page, end: page + copierBytes - 1 };
    return COPIER_AREAS.some((area) => pages.start >= area.start && pages.end <= area.end) && !overlaps(pages, loaded) && plain.every((copy) => !overlaps(pages, copy.target));
  });
  if (copier === undefined) {
    const count = copierPages === 2 ? "two" : "three";
    throw new WireFailure("invalid-input", `No ${count} free pages exist for the copier in $0400-$9fff or $c000-$cfff outside the loader (${show(loaded)}) and the targets: ${plain.map((copy) => show(copy.target)).join(", ")}.`);
  }
  const copies: Copy[] = order.map((index) => {
    const copy = plain[index]!;
    return { ...copy, backward: copy.target.start > copy.source.start && overlaps(copy.target, copy.source) };
  });
  const copyBlocks = order.map((index) => blockOf[index]!);

  const stackByte = 0x0100 + state.sp;
  const lines: string[] = [
    ...input.header.map((line) => `; ${line}`),
    "",
    "!cpu 6510",
    ...settingsLines(input),
    '!source "constants.asm"',
    ...(input.macros ? ['!source "macros.asm"'] : []),
    ...(screen === undefined ? [] : ["", ...startScreenValues(input.startScreen!, screen)]),
    "",
    `* = ${formatC64Address(LOAD)}`,
  ];
  lines.push(`        !byte $0b,$08,$0a,$00,$9e,${[...String(STUB)].map((digit) => formatC64Byte(digit.charCodeAt(0))).join(",")},$00,$00,$00 ; 10 SYS ${STUB}`);
  lines.push(
    "!zone loader_stub {",
    "        sei",
    // The copier lies at the end of the loader file, which can be at $a000 or higher, under the BASIC ROM.
    "        lda #$34",
    "        sta $01",
    "        ldx #0",
    `-       lda ${COPIER_SOURCE},x`,
    `        sta ${formatC64Address(copier)},x`,
    ...Array.from({ length: copierPages - 1 }, (_, index) => [`        lda ${COPIER_SOURCE}+$${((index + 1) * 0x100).toString(16)},x`, `        sta ${formatC64Address(copier + (index + 1) * 0x100)},x`]).flat(),
    "        inx",
    "        bne -",
    `        jmp ${formatC64Address(copier)}`,
    "}",
  );
  // The labels around each block give the copy table its numbers, so a block can change its length.
  for (const block of blocks) {
    lines.push("", `; ${block.what}`, blockLabel(block.range.start, "from"), `!pseudopc ${formatC64Address(block.pseudo)} {`, blockLabel(block.range.start, "to"));
    if (block.files !== undefined) for (const file of block.files) lines.push(`!source "${file}"`);
    else lines.push(...byteLines(block.range, block.bytes));
    lines.push("}", blockLabel(block.range.start, "end"));
  }
  lines.push("", `; The copier runs at ${formatC64Address(copier)}. The flags pass through ${formatC64Address(stackByte)}, the free stack byte below the stack pointer.`, COPIER_SOURCE, `!pseudopc ${formatC64Address(copier)} {`);
  lines.push(...copierLines(state, cia, stackByte, input.entryName ?? formatC64Address(input.entry), screen !== undefined));
  copies.forEach((copy, index) => {
    // A block that starts at $0000 skips $00/$01, which the loader sets last.
    const start = copyBlocks[index]!;
    const skip = copy.target.start - start;
    const [from, end, to] = [blockLabel(start, "from"), blockLabel(start, "end"), blockLabel(start, "to")];
    const length = skip === 0 ? `${end} - ${from}` : `${end} - ${from} - ${skip}`;
    const read = copy.backward ? `${end} - 1` : plus(from, skip);
    const write = copy.backward ? `${to} + ${end} - ${from} - 1` : plus(to, skip);
    lines.push(`        !word ${length}, ${read}, ${write} : !byte ${copy.backward ? 1 : 0} ; ${copy.what}`);
  });
  lines.push("        !word 0", "}", "}");

  return {
    loaded: input.segments.map(({ start, end }) => ({ start, end })),
    blocks: blocks.map((block, index) => ({ what: block.what, range: block.range, packedAt: packedAt[index]!, bytes: block.bytes })),
    copies,
    copier,
    stackByte,
    end,
    text: `${lines.join("\n")}\n`,
    ...(cia === undefined ? {} : { cia: cia.plan }),
    ...(screen === undefined ? {} : { startScreen: screen }),
  };
}

/** Where the packed form puts its copier with the bytes of pages 0-3: the copier sets $01 to $35 and to the entry's value, so it is not under a ROM or the I/O area. */
const PACKED_AREAS: readonly AddressRange[] = [
  { start: 0x0400, end: 0x9fff },
  { start: 0xc000, end: 0xcfff },
];
/** The free ranges that a refusal of the packed form names. */
const SHOWN_FREE = 8;

/**
 * The packed form of the loader, for an image too large for one loader file:
 * Exomizer packs the build of main.asm (from $0400) and the build of
 * loader.asm into loader.prg, which starts at the copier with all RAM
 * visible ($01 = $34). loader.asm holds only the copier, in one free range,
 * and the bytes of pages $0002-$03ff, in pieces in the free ranges: the
 * unpacker of Exomizer uses the zero page and $0334-$03ff, so the copier
 * writes them after the unpack. Between its ranges, loader.asm holds the
 * bytes of the image, so its build does not change a segment.
 */
function planPacked(input: LoaderInput, blocks: Block[], cia: ReturnType<typeof ciaSection>, codeSize: number, screen: StartScreenPlan | undefined, tooLarge: string): LoaderPlan {
  const { state } = input;
  // The parts below $0400 without $00/$01, which the loader sets last.
  const low = blocks.flatMap((block) => {
    const range = { start: Math.max(block.range.start, 0x0002), end: Math.min(block.range.end, 0x03ff) };
    if (range.start > range.end) return [];
    const cut = range.start !== block.range.start || range.end !== block.range.end;
    return [{ what: cut ? `${block.what}, part ${show(range)}` : block.what, range, bytes: block.bytes }];
  });
  const lowBytes = low.reduce((sum, block) => sum + block.range.end - block.range.start + 1, 0);
  const free = PACKED_AREAS.flatMap((area) => subtract(area, input.segments));
  const placed = placePacked(free, low, codeSize);
  if ("refusal" in placed) {
    const largest = [...free].sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, SHOWN_FREE);
    const ranges = largest.length === 0 ? "none" : largest.map((range) => `${show(range)} (${range.end - range.start + 1} bytes)`).join(", ");
    const why =
      placed.refusal === "copies"
        ? `A packed loader needs more than ${MAX_PACKED_COPIES} copies for the ${lowBytes} bytes of pages 0-3 in the free ranges.`
        : `A packed loader needs one free range of ${codeSize + COPY_ENTRY * Math.max(low.length, 1) + 2} bytes or more for its copier, and ${lowBytes} more free bytes for pages 0-3, in $0400-$9fff or $c000-$cfff outside the segments.${screen === undefined ? "" : ` The start screen takes ${START_SCREEN_SIZES[screen.colourMode]} bytes of the copier: without it (unstart-screen), the copier is smaller.`}`;
    throw new WireFailure("invalid-input", `${tooLarge} ${why} The largest free ranges there: ${ranges}. Write the loader by hand.`);
  }
  const { copier, pieces } = placed;
  const copierEnd = copier + codeSize + COPY_ENTRY * pieces.length + 2 - 1;
  // The sources are at $0400 or higher and the targets below: any order works.
  const copies: Copy[] = pieces.map((piece) => ({ what: piece.what, target: piece.target, source: { start: piece.at, end: piece.at + piece.target.end - piece.target.start }, backward: false }));
  const start = Math.min(copier, ...pieces.map((piece) => piece.at));
  const end = Math.max(copierEnd, ...copies.map((copy) => copy.source.end));
  const stackByte = 0x0100 + state.sp;
  const lines: string[] = [
    ...input.header.map((line) => `; ${line}`),
    "; The image is too large for one loader file, so this is the packed form. Exomizer packs the",
    `; build of main.asm and the build of this file into loader.prg, with --entry '${formatC64Address(copier)}' and --exit-memory '$34'.`,
    "; The unpacker of Exomizer uses the zero page and $0334-$03ff, so the copier writes pages $0002-$03ff after the unpack.",
    "",
    "!cpu 6510",
    ...settingsLines(input),
    ...(screen === undefined ? [] : ["", ...startScreenValues(input.startScreen!, screen)]),
  ];
  // The parts in address order: the copier, the pieces of pages 0-3, and the bytes of the image between them.
  const parts: Array<{ range: AddressRange; text: string[] }> = [];
  const copierText = [
    `; The copier runs at ${formatC64Address(copier)}. The flags pass through ${formatC64Address(stackByte)}, the free stack byte below the stack pointer.`,
    `* = ${formatC64Address(copier)}`,
    COPIER_SOURCE,
    // The entry by its address: main.asm, which has its label, is not in this build.
    ...copierLines(state, cia, stackByte, `${formatC64Address(input.entry)}${input.entryName === undefined ? "" : ` ; ${input.entryName} in main.asm`}`, screen !== undefined),
  ];
  for (const copy of copies) {
    const [from, to] = [blockLabel(copy.target.start, "from"), blockLabel(copy.target.start, "end")];
    copierText.push(`        !word ${to} - ${from}, ${from}, ${formatC64Address(copy.target.start)} : !byte 0 ; ${copy.what}`);
  }
  copierText.push("        !word 0", "}");
  parts.push({ range: { start: copier, end: copierEnd }, text: copierText });
  for (const piece of pieces) {
    const range = { start: piece.at, end: piece.at + piece.target.end - piece.target.start };
    const text = [`; ${piece.what}`, `* = ${formatC64Address(piece.at)}`, blockLabel(piece.target.start, "from"), ...byteLines(piece.target, piece.bytes), blockLabel(piece.target.start, "end")];
    parts.push({ range, text });
  }
  const used = parts.map((part) => part.range);
  for (const segment of input.segments) {
    const within = { start: Math.max(segment.start, start), end: Math.min(segment.end, end) };
    if (within.start > within.end) continue;
    for (const range of subtract(within, used)) {
      parts.push({ range, text: [`; The bytes of the image at ${show(range)}, so the build of this file does not change them`, `* = ${formatC64Address(range.start)}`, ...byteLines(range, input.byteAt)] });
    }
  }
  parts.sort((a, b) => a.range.start - b.range.start);
  for (const part of parts) lines.push("", ...part.text);
  return {
    loaded: input.segments.map(({ start, end }) => ({ start, end })),
    blocks: pieces.map((piece) => ({ what: piece.what, range: piece.target, packedAt: piece.at, bytes: piece.bytes })),
    copies,
    copier,
    stackByte,
    end,
    text: `${lines.join("\n")}\n`,
    ...(cia === undefined ? {} : { cia: cia.plan }),
    ...(screen === undefined ? {} : { startScreen: screen }),
    packed: { start },
  };
}

/** The copy table of the packed form: X indexes it, so it fits in 256 bytes. */
const MAX_PACKED_COPIES = Math.floor((256 - 2) / COPY_ENTRY);

/** A piece of pages 0-3 in the packed form: its target and where the copier reads it. */
export interface Piece {
  what: string;
  target: AddressRange;
  at: number;
  bytes: (address: number) => number;
}

/**
 * Puts the parts of pages 0-3 into the free ranges, in their order: each time
 * into the nearest range that holds the rest, else into the largest range.
 * A part that does not fit in one range is split, and each piece is a copy.
 * Undefined when the ranges are too small.
 */
export function placePieces(ranges: AddressRange[], low: ReadonlyArray<{ what: string; range: AddressRange; bytes: (address: number) => number }>, distance: (range: AddressRange) => number): Piece[] | undefined {
  const left = ranges.map((range) => ({ ...range }));
  const pieces: Piece[] = [];
  let rest = low.reduce((sum, block) => sum + block.range.end - block.range.start + 1, 0);
  const length = (range: AddressRange) => range.end - range.start + 1;
  let target: AddressRange | undefined;
  for (const block of low) {
    let next = block.range.start;
    while (next <= block.range.end) {
      if (target === undefined || target.start > target.end) {
        const open = left.filter((range) => range.start <= range.end);
        if (open.length === 0) return undefined;
        const holding = open.filter((range) => length(range) >= rest).sort((a, b) => distance(a) - distance(b));
        target = holding[0] ?? open.sort((a, b) => length(b) - length(a))[0]!;
      }
      const count = Math.min(block.range.end - next + 1, length(target));
      const part = { start: next, end: next + count - 1 };
      const cut = part.start !== block.range.start || part.end !== block.range.end;
      pieces.push({ what: cut ? `${block.what}, bytes ${show(part)}` : block.what, target: part, at: target.start, bytes: block.bytes });
      target.start += count;
      next += count;
      rest -= count;
    }
  }
  return pieces;
}

/**
 * Where the packed form puts its copier and the pieces of pages 0-3: the copier
 * in one free range, a free page of the plain copier first, else the start of a
 * free range. The placement with the fewest pieces wins, then the one with the
 * shortest build of loader.asm.
 */
function placePacked(free: AddressRange[], low: Parameters<typeof placePieces>[1], codeSize: number): { copier: number; pieces: Piece[] } | { refusal: "room" | "copies" } {
  const candidates = [...COPIER_PAGES, ...free.map((range) => range.start)];
  // The table has one entry per piece: a split can make the copier larger, so the room for the table grows until it holds every piece.
  for (let copies = Math.max(low.length, 1); copies <= MAX_PACKED_COPIES; ) {
    const size = codeSize + COPY_ENTRY * copies + 2;
    let best: { copier: number; pieces: Piece[]; span: number } | undefined;
    for (const copier of candidates) {
      const range = { start: copier, end: copier + size - 1 };
      if (!free.some((area) => range.start >= area.start && range.end <= area.end)) continue;
      // A piece goes to the start of its range: a range below the copier adds its whole length to the build.
      const distance = (other: AddressRange) => (other.end < range.start ? range.start - other.start : other.start - range.end);
      const pieces = placePieces(free.flatMap((area) => subtract(area, [range])), low, distance);
      if (pieces === undefined) continue;
      const span = Math.max(range.end, ...pieces.map((piece) => piece.at + piece.target.end - piece.target.start)) - Math.min(copier, ...pieces.map((piece) => piece.at));
      if (best === undefined || pieces.length < best.pieces.length || (pieces.length === best.pieces.length && span < best.span)) best = { copier, pieces, span };
    }
    if (best === undefined) return { refusal: "room" };
    if (best.pieces.length <= copies) return best;
    copies = best.pieces.length;
  }
  return { refusal: "copies" };
}

/** What Exomizer makes of a packed loader. */
export interface PackedLoader {
  /** loader.prg: it loads at $0801 and starts with RUN. */
  program: Buffer;
  packedBytes: number;
  unpackedBytes: number;
  /** The CPU cycles of the unpack, when Exomizer gives them. */
  cycles?: number;
}

/**
 * Packs the loaded ranges of the build of main.asm from $0400 and the build of
 * loader.asm (the copier wins where they overlap) with the entry at the copier
 * and $01 = $34, and checks the unpack in the emulator of Exomizer: every byte
 * of the two builds, and the jump to the copier. Refuses by name when it does
 * not hold.
 */
export async function packLoader(main: Uint8Array, copier: Uint8Array, plan: LoaderPlan, context: ToolContext): Promise<PackedLoader> {
  return packParts(packedParts(main, copier, plan), plan.copier, 0x34, "main.asm and loader.asm", "the copier", context);
}

/** What Exomizer packs in the packed form: the loaded ranges of the build of main.asm from $0400, and the build of loader.asm. */
export function packedParts(main: Uint8Array, copier: Uint8Array, plan: Pick<LoaderPlan, "loaded">): Array<{ start: number; body: Uint8Array }> {
  // The unpacker uses pages 0-3; the copier writes them. The leftovers between the loaded ranges are not packed.
  const program = prgRange(main);
  const ranges = plan.loaded.flatMap((range) => {
    const start = Math.max(range.start, 0x0400, program.start);
    const end = Math.min(range.end, program.start + program.body.length - 1);
    return start <= end ? [{ start, body: program.body.subarray(start - program.start, end - program.start + 1) }] : [];
  });
  return [...ranges, prgRange(copier)];
}

/**
 * Packs parts (a later one wins where they overlap) into one program that
 * unpacks itself, starts at `entry` with $01 = `exitMemory`, and checks the
 * unpack in the emulator of Exomizer: every byte of the parts, and the jump
 * to the entry. Refuses by name when it does not hold.
 */
export async function packParts(parts: ReadonlyArray<{ start: number; body: Uint8Array }>, entry: number, exitMemory: number, what: string, entryName: string, context: ToolContext): Promise<PackedLoader> {
  const prg = (part: { start: number; body: Uint8Array }) => Buffer.concat([Buffer.from([part.start & 0xff, part.start >> 8]), part.body]);
  const packed = await pack({ programs: parts.map(prg), entry, exitMemory }, context);
  if (packed.entry !== entry) throw new WireFailure("operation-failed", `The unpack in the emulator of Exomizer jumps to ${formatC64Address(packed.entry)}, not to ${entryName} at ${formatC64Address(entry)}.`);
  const reference = mergedPrograms(parts);
  const wrong = compareBuild(packed.unpacked, reference).segments.find((segment) => segment.result !== "identical");
  if (wrong !== undefined) {
    const first = wrong.firstDifference === undefined ? "" : `: the first is ${wrong.firstDifference.address}, ${wrong.firstDifference.built} and not ${wrong.firstDifference.reference}`;
    throw new WireFailure("operation-failed", `The unpack in the emulator of Exomizer does not give ${wrong.start}-${wrong.end} of ${what} (${wrong.result}${first}).`);
  }
  const unpackedBytes = reference.segments.reduce((sum, segment) => sum + segment.end - segment.start + 1, 0);
  return { program: packed.program, packedBytes: packed.program.length, unpackedBytes, ...(packed.cycles === undefined ? {} : { cycles: packed.cycles }) };
}

/**
 * The copier: its copies by the table, the VIC-II and CIA parts, then $00/$01,
 * the stack pointer, the flags and A/X/Y, and the jump to the entry. It ends
 * with the label of the table; the caller writes the table and closes the zone.
 * A start screen comes after the copies, which put its bytes in place, and
 * before the VIC-II part, which sets the display of the entry again.
 */
function copierLines(state: EntryState, cia: ReturnType<typeof ciaSection>, stackByte: number, jumpTarget: string, startScreen: boolean): string[] {
  const [port0, port1] = state.port;
  return [
    "!zone loader_copier {",
    "        lda #$34",
    "        sta $01",
    "        ldx #0",
    ".next   lda .table,x",
    "        sta .count",
    "        lda .table+1,x",
    "        sta .count+1",
    "        ora .count",
    "        beq .done",
    "        lda .table+2,x",
    "        sta .read+1",
    "        lda .table+3,x",
    "        sta .read+2",
    "        lda .table+4,x",
    "        sta .write+1",
    "        lda .table+5,x",
    "        sta .write+2",
    "        lda .table+6,x",
    "        sta .back",
    "        stx .index",
    ".read   lda $ffff",
    ".write  sta $ffff",
    "        lda .back",
    "        bne .down",
    "        inc .read+1",
    "        bne +",
    "        inc .read+2",
    "+       inc .write+1",
    "        bne +",
    "        inc .write+2",
    "+       jmp .counted",
    ".down   lda .read+1",
    "        bne +",
    "        dec .read+2",
    "+       dec .read+1",
    "        lda .write+1",
    "        bne +",
    "        dec .write+2",
    "+       dec .write+1",
    ".counted",
    "        lda .count",
    "        bne +",
    "        dec .count+1",
    "+       dec .count",
    "        lda .count",
    "        ora .count+1",
    "        bne .read",
    "        lda .index",
    "        clc",
    "        adc #7",
    "        tax",
    "        jmp .next",
    ".done",
    ...(startScreen ? START_SCREEN_LINES : []),
    // The CIA part runs after the raster wait: the wait ends its whole lines earlier, so the entry comes in its line.
    ...vicLines(state, Math.floor((cia?.ops.reduce((sum, op) => sum + op.cycles, 0) ?? 0) / LINE_CYCLES)),
    ...(cia === undefined ? [] : cia.ops.map((op) => `        ${op.text}`)),
    `        lda #${formatC64Byte(port0)}`,
    "        sta $00",
    `        lda #${formatC64Byte(port1)}`,
    "        sta $01",
    `        ldx #${formatC64Byte((state.sp - 1) & 0xff)}`,
    "        txs",
    `        lda #${formatC64Byte(state.flags)}`,
    `        sta ${formatC64Address(stackByte)}`,
    `        lda #${formatC64Byte(state.a)}`,
    `        ldx #${formatC64Byte(state.x)}`,
    `        ldy #${formatC64Byte(state.y)}`,
    "        plp",
    // A global label: the check of the loader stops here, before an interrupt can run.
    `${LOADER_JUMP} jmp ${jumpTarget}`,
    ".count  !word 0",
    ".index  !byte 0",
    ".back   !byte 0",
    ...(state.vic === undefined
      ? []
      : [
          `.vicreg !byte ${VIC_DISPLAY_REGISTERS.map((item) => formatC64Byte(item.register)).join(",")}`,
          `.vicval !byte ${VIC_DISPLAY_REGISTERS.map((item) => formatC64Byte(state.vic!.registers[item.register]!)).join(",")}`,
        ]),
    ".table",
  ];
}

/**
 * The copier's VIC-II part: with the I/O area visible it sets the
 * display registers and the VIC bank of the entry state, then waits for the
 * entry's raster line, so the program starts in the same phase of the frame.
 */
function vicLines(state: EntryState, earlier: number): string[] {
  if (state.vic === undefined) return [];
  const line = (rasterLine(state.vic.registers) - earlier + PAL_LINES) % PAL_LINES;
  return [
    "        lda #$35",
    "        sta $01",
    `        ldx #${formatC64Byte(VIC_DISPLAY_REGISTERS.length - 1)}`,
    ".vic    ldy .vicreg,x",
    "        lda .vicval,x",
    "        sta $d000,y",
    "        dex",
    "        bpl .vic",
    "        lda $dd00",
    "        and #$fc",
    `        ora #${formatC64Byte(state.vic.bank)}`,
    "        sta $dd00",
    `.raster lda $d012`,
    `        cmp #${formatC64Byte(line & 0xff)}`,
    "        bne .raster",
    "        lda $d011",
    "        and #$80",
    `        cmp #${formatC64Byte((line >> 1) & 0x80)}`,
    "        bne .raster",
  ];
}
