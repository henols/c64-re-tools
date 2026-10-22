// An image.json of the c64-unpacker skill (a 64 KiB memory and its segments),
// a PRG, or a ZX Spectrum snapshot, read from the project to put it into the knowledge.

import { posix } from "node:path";

import type { Machine } from "../machine.ts";

import { isRefusal, Refusal } from "../errors.ts";
import { prgRange } from "../c64.ts";
import { formatAddress, formatByte } from "../address.ts";
import { cpuRam, pagedBank, readSna, readZ80, type SpectrumSnapshot, type Z80Registers } from "../spectrum.ts";
import { readEntryState, type EntryState } from "./entry-state.ts";
import { readProjectFile } from "./transfer.ts";

export interface Image {
  segments: Array<{ start: number; end: number }>;
  /** The byte at an address inside a segment. */
  byteAt: (address: number) => number;
  /** image.json only: the 64 KiB memory of the capture, also outside the segments. */
  memory?: Uint8Array;
  entry?: number;
  /** The entry state in entry_state.json next to image.json, when the capture wrote one. */
  state?: EntryState;
  /** The stages of the capture in image.json, as the unpacker wrote them. */
  stages?: Array<Record<string, unknown>>;
}

/** The kinds of media files that are no PRG, by extension. */
const MEDIA_KINDS: Record<string, string> = {
  d64: "a disk image",
  d71: "a disk image",
  d81: "a disk image",
  g64: "a disk image",
  x64: "a disk image",
  t64: "a tape file",
  tap: "a tape file",
  crt: "a cartridge file",
};

/** The remedy for a disk, tape or cartridge file where a PRG must be: get the PRG out of it. */
export const MEDIA_REMEDY = "Get the PRG out of it, and give the path of that PRG";

/**
 * Refuses a file that is no PRG by its extension (`type`, lowercase, without
 * the dot): invalid-input. A disk, tape or cartridge file gets `remedy`. A PRG
 * ends in .prg in any letter case, or has no extension, as c1541 writes the
 * names of the files that it reads from a disk; every other extension is
 * refused. `accepted` names what the reader takes, for the message.
 */
export function refuseNotPrg(path: string, type: string, remedy = MEDIA_REMEDY, accepted = "a PRG"): void {
  const media = MEDIA_KINDS[type];
  if (media !== undefined) throw new Refusal("invalid-input", `${path} is ${media} (.${type}), not a PRG. ${remedy}.`);
  if (type !== "prg" && type !== "") {
    throw new Refusal("invalid-input", `${path} is not ${accepted}: a PRG has the extension .prg or no extension, not .${type}. Give the PRG of the program, or rename the file to .prg when it is a PRG.`);
  }
}

/**
 * Reads a PRG of the project: a 2-byte load address, and bytes that end at
 * $ffff or before. Refuses with invalid-input a file that is no PRG by its
 * extension (refuseNotPrg) or by its bytes; `remedy` tells what to do in place
 * of a disk, tape or cartridge file. A file of fewer than 3 bytes is refused
 * as too short: no remedy applies.
 */
export function readPrg(path: string, remedy = MEDIA_REMEDY, accepted = "a PRG"): { bytes: Buffer; start: number; end: number; body: Uint8Array } {
  const { bytes, type } = readProjectFile(path);
  refuseNotPrg(path, type, remedy, accepted);
  if (bytes.length < 3) {
    throw new Refusal("invalid-input", `${path} is too short for a PRG: it has ${bytes.length} ${bytes.length === 1 ? "byte" : "bytes"}, and a PRG has a 2-byte load address and at least one byte. Give the complete PRG file.`);
  }
  try {
    return { bytes, ...prgRange(bytes) };
  } catch (error) {
    if (isRefusal(error)) throw new Refusal("invalid-input", `${path} is not a PRG: ${error.message} ${remedy}.`);
    throw error;
  }
}

/** Reads an image.json or a PRG, relative to the project folder. Refuses every other file as readPrg does. */
export function readImage(path: string): Image {
  if (!path.endsWith(".json")) {
    const range = readPrg(path, MEDIA_REMEDY, "an image.json of an unpacked program or a PRG");
    return { segments: [{ start: range.start, end: range.end }], byteAt: (address) => range.body[address - range.start]! };
  }
  const { bytes } = readProjectFile(path);
  const fail = (what: string): never => {
    throw new Refusal("invalid-input", `${path} is not an image.json of an unpacked program: ${what}`);
  };
  const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    return fail((error as Error).message);
  }
  const manifest = isObject(parsed) ? parsed : fail("it is not a JSON object");
  const address = (value: unknown, what: string) => (typeof value === "string" && /^\$[0-9a-f]{4}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fail(`${what} is not a $ address`));
  if (typeof manifest.image !== "string") fail("it has no image");
  if (!Array.isArray(manifest.segments) || manifest.segments.length === 0) fail("it has no segments");
  const segments = (manifest.segments as unknown[])
    .map((segment, index) => (isObject(segment) ? segment : fail(`segment ${index + 1} is not an object`)))
    .map((segment, index) => ({ start: address(segment.start, `segment ${index + 1} start`), end: address(segment.end, `segment ${index + 1} end`) }))
    .sort((a, b) => a.start - b.start);
  segments.forEach((segment, index) => {
    if (segment.end < segment.start) fail(`the segment at ${formatAddress(segment.start)} ends before it starts`);
    if (index > 0 && segment.start <= segments[index - 1]!.end) fail(`the segments at ${formatAddress(segments[index - 1]!.start)} and ${formatAddress(segment.start)} overlap`);
  });
  const directory = posix.dirname(path);
  const memory = readProjectFile(posix.join(directory, manifest.image as string)).bytes;
  if (memory.length !== 0x10000) fail(`its image has ${memory.length} bytes, not 65536`);
  const image: Image = { segments, byteAt: (at) => memory[at]!, memory };
  const state = entryStateNextTo(posix.join(directory, "entry_state.json"));
  if (state !== undefined) image.state = state;
  if (manifest.entry !== undefined) image.entry = address(manifest.entry, "entry");
  if (Array.isArray(manifest.stages)) image.stages = manifest.stages.map((stage, index) => (isObject(stage) ? stage : fail(`stage ${index + 1} is not an object`)));
  return image;
}

/** The entry state of a capture, or undefined when the capture has no entry_state.json. */
function entryStateNextTo(path: string): EntryState | undefined {
  try {
    return readEntryState(path);
  } catch (error) {
    if (isRefusal(error) && error.code === "not-found") return undefined;
    throw error;
  }
}

/** A ZX Spectrum snapshot as the program of a project: the machine, the CPU view at the entry, and the other RAM banks of a 128K. */
export interface SnapshotImage {
  machine: "spectrum48" | "spectrum128";
  /** $4000-$FFFF as the CPU sees it at the entry (banks 5 and 2 and the paged bank), the PC as the entry, and the Z80 state. */
  main: { segments: Array<{ start: number; end: number }>; byteAt: (address: number) => number; entry: number; state: Record<string, unknown> };
  /** The 128K: each RAM bank that is not in the CPU view and holds a byte that is not 0, at $C000-$FFFF. */
  banks: Array<{ bank: number; byteAt: (address: number) => number }>;
}

/** The entry state of a Spectrum snapshot: the Z80 registers, the interrupt state, the border and, on the 128K, port $7ffd. */
export function z80EntryState(snapshot: SpectrumSnapshot): Record<string, unknown> {
  const r = snapshot.registers;
  const word = (value: number) => formatAddress(value);
  return {
    registers: {
      pc: word(r.pc), sp: word(r.sp), af: word(r.af), bc: word(r.bc), de: word(r.de), hl: word(r.hl), ix: word(r.ix), iy: word(r.iy),
      af2: word(r.af2), bc2: word(r.bc2), de2: word(r.de2), hl2: word(r.hl2), i: formatByte(r.i), r: formatByte(r.r), im: r.im, iff1: r.iff1, iff2: r.iff2,
    },
    border: snapshot.border,
    ...(snapshot.model === "128k" ? { port7ffd: formatByte(snapshot.port7ffd) } : {}),
  };
}

/** The Z80 state of a Spectrum entry state: the registers, the border and, on the 128K, port $7ffd. */
export interface Z80EntryState {
  registers: Z80Registers;
  border: number;
  port7ffd?: number;
}

/**
 * Reads an entry state that z80EntryState wrote. `where` names it in a
 * refusal, for example "the entry state of the knowledge".
 */
export function parseZ80EntryState(value: unknown, where: string): Z80EntryState {
  const fail = (what: string): never => {
    throw new Refusal("invalid-input", `${where} is not the entry state of a ZX Spectrum snapshot: ${what}. Put the snapshot of the program into the project knowledge again.`);
  };
  const isObject = (item: unknown): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item);
  if (!isObject(value)) return fail("it is not a JSON object");
  const registers = isObject(value.registers) ? value.registers : fail("it has no registers");
  const number = (item: unknown, what: string, max: number) => {
    const parsed = typeof item === "string" && /^\$[0-9a-f]{1,4}$/i.test(item) ? Number.parseInt(item.slice(1), 16) : undefined;
    return parsed !== undefined && parsed <= max ? parsed : fail(`${what} is not a $ value up to ${formatAddress(max)}`);
  };
  const word = (name: string) => number(registers[name], `registers.${name}`, 0xffff);
  const flag = (name: string) => (typeof registers[name] === "boolean" ? (registers[name] as boolean) : fail(`registers.${name} is not true or false`));
  const im = registers.im === 0 || registers.im === 1 || registers.im === 2 ? registers.im : fail("registers.im is not 0, 1 or 2");
  const border = Number.isInteger(value.border) && (value.border as number) >= 0 && (value.border as number) <= 7 ? (value.border as number) : fail("border is not 0 to 7");
  return {
    registers: {
      pc: word("pc"), sp: word("sp"), af: word("af"), bc: word("bc"), de: word("de"), hl: word("hl"), ix: word("ix"), iy: word("iy"),
      af2: word("af2"), bc2: word("bc2"), de2: word("de2"), hl2: word("hl2"), i: number(registers.i, "registers.i", 0xff), r: number(registers.r, "registers.r", 0xff), im, iff1: flag("iff1"), iff2: flag("iff2"),
    },
    border,
    ...(value.port7ffd === undefined ? {} : { port7ffd: number(value.port7ffd, "port7ffd", 0xff) }),
  };
}

/**
 * The snapshot of a program at its entry: the inverse of snapshotImage. The
 * CPU view gives banks 5 and 2 and the paged bank; each other RAM bank of the
 * 128K comes from `banks`, and a bank that is not there holds 0.
 */
export function snapshotOfImage(image: Pick<SnapshotImage, "machine" | "main" | "banks">, where: string): SpectrumSnapshot {
  const state = parseZ80EntryState(image.main.state, where);
  const model = image.machine === "spectrum128" ? "128k" : "48k";
  const port7ffd = model === "128k" ? (state.port7ffd ?? 0) : 0;
  const banks = Array.from({ length: 8 }, () => new Uint8Array(0x4000));
  for (const bank of image.banks) banks[bank.bank] = Uint8Array.from({ length: 0x4000 }, (_, offset) => bank.byteAt(0xc000 + offset));
  const view = (start: number) => Uint8Array.from({ length: 0x4000 }, (_, offset) => image.main.byteAt(start + offset));
  banks[model === "128k" ? port7ffd & 7 : 0] = view(0xc000);
  banks[5] = view(0x4000);
  banks[2] = view(0x8000);
  return { model, registers: state.registers, border: state.border, port7ffd, banks };
}

/** The program in a file: a snapshot of the ZX Spectrum, or an image.json or a PRG of the C64. */
export type ProgramFile = { snapshot: SnapshotImage } | { image: Image };

/**
 * Reads the program in a project file for the project machine: a .z80 or
 * .sna snapshot, else an image.json or a PRG (readImage). A tape of the ZX
 * Spectrum (a .tzx, or a .tap in a Spectrum project) is refused with the way
 * to get a snapshot from it. A Spectrum project takes only a snapshot.
 */
export function readProgramFile(path: string, machine: Machine): ProgramFile {
  const type = posix.extname(path).slice(1).toLowerCase();
  if (type === "z80" || type === "sna") return { snapshot: readSnapshotImage(path) };
  if (type === "tzx" || (type === "tap" && machine.family === "spectrum")) {
    throw new Refusal("invalid-input", `${path} is a ZX Spectrum tape (.${type}), and the knowledge takes the program in memory, not a tape. Load the tape in the emulator with its own loader, stop at the entry of the machine code, and export the machine state as a .z80 snapshot. Then give that snapshot.`);
  }
  if (machine.family === "spectrum") throw new Refusal("invalid-input", `${path} is no snapshot. A program of the ${machine.name} comes into the knowledge as ${machine.programFiles}.`);
  return { image: readImage(path) };
}

/** Reads a .z80 or .sna snapshot of the project as the program at its PC. */
export function readSnapshotImage(path: string): SnapshotImage {
  const file = readProjectFile(path, { what: "<file>" });
  const snapshot = file.type === "z80" ? readZ80(file.bytes) : file.type === "sna" ? readSna(file.bytes) : undefined;
  if (snapshot === undefined) throw new Refusal("invalid-input", `${path} is no ZX Spectrum snapshot: give a .z80 or a .sna file.`);
  return snapshotImage(snapshot);
}

/** A snapshot as the program at its PC: the CPU view, and on the 128K each other RAM bank that holds a byte that is not 0. */
export function snapshotImage(snapshot: SpectrumSnapshot): SnapshotImage {
  const ram = cpuRam(snapshot);
  const inView = new Set([5, 2, pagedBank(snapshot)]);
  const banks = snapshot.model === "128k" ? [0, 1, 3, 4, 6, 7].filter((bank) => !inView.has(bank) && snapshot.banks[bank]!.some((byte) => byte !== 0)) : [];
  return {
    machine: snapshot.model === "128k" ? "spectrum128" : "spectrum48",
    main: { segments: [{ start: 0x4000, end: 0xffff }], byteAt: (address) => ram[address - 0x4000]!, entry: snapshot.registers.pc, state: z80EntryState(snapshot) },
    banks: banks.map((bank) => ({ bank, byteAt: (address: number) => snapshot.banks[bank]![address - 0xc000]! })),
  };
}
