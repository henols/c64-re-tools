// The machines that c64-re-tools knows. A machine gives the CPU, the address
// spaces of the knowledge and the Ghidra language. Its family names the MCP
// server that drives it: one server for each family, from the one bin.

import type { AddressRange } from "./address.ts";
import type { AssemblerDialect } from "./assembler.ts";
import { ACME } from "./assembler/acme.ts";
import { SJASMPLUS } from "./assembler/sjasmplus.ts";
import type { Cpu } from "./cpu.ts";
import { MOS6502 } from "./cpu/mos6502.ts";
import { Z80 } from "./cpu/z80.ts";

export const MACHINE_IDS = ["c64", "spectrum48", "spectrum128"] as const;
export type MachineId = (typeof MACHINE_IDS)[number];
export const FAMILIES = ["c64", "spectrum"] as const;
export type Family = (typeof FAMILIES)[number];

/** The address space of a knowledge row. Which names a project can use comes from its machine. */
export type Space = string;

export interface Spaces {
  /** The space of the CPU's own view: the default of every command that takes a space. */
  main: Space;
  /** The space names of the machine. */
  pattern: RegExp;
  /** The names for a message, for example "c64, drive8 or bank0 to bank255". */
  names: string;
  /** The addresses that a space can hold. */
  range(space: Space): AddressRange;
}

export interface Machine {
  id: MachineId;
  family: Family;
  name: string;
  cpu: Cpu;
  spaces: Spaces;
  /** The Ghidra language ID of the CPU. */
  ghidraLanguage: string;
  /** The assembler of the generated source, whose syntax patch code and macro bodies use. */
  assembler: AssemblerDialect;
  /** The ROM that the CPU always sees in its main space: no program code or data of the knowledge is there. Empty when the ROM can be switched out. */
  rom: readonly AddressRange[];
  /** The files that put a program into the knowledge, for a message: "Put the program into the project knowledge with image: <programFiles>." */
  programFiles: string;
  /** The generated source writes macros and their uses. */
  macros: boolean;
  /** The generated source has a loader that can show a start screen. */
  startScreen: boolean;
}

const FULL: AddressRange = { start: 0, end: 0xffff };

const C64_SPACES: Spaces = {
  main: "c64",
  pattern: /^(c64|drive8|loading|bank(0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5]))$/,
  names: "c64, drive8, loading, or bank0 to bank255",
  range: () => FULL,
};

/** The 48K has one space. */
const SPECTRUM48_SPACES: Spaces = { main: "spectrum", pattern: /^spectrum$/, names: "spectrum", range: () => FULL };

/** The 128K: the CPU view with the paging at entry, and each RAM bank at $c000-$ffff. */
const SPECTRUM128_SPACES: Spaces = {
  main: "spectrum",
  pattern: /^(spectrum|ram[0-7])$/,
  names: "spectrum, or ram0 to ram7",
  range: (space) => (space === "spectrum" ? FULL : { start: 0xc000, end: 0xffff }),
};

/** The C64 banks its ROMs out: a program can use all of the RAM. */
const C64_MACHINE = { rom: [], programFiles: "a PRG, or the image.json of a capture", macros: true, startScreen: true };

/** The ZX Spectrum: the ROM is always at $0000-$3fff, and a program comes in as a snapshot at its entry. */
const SPECTRUM_MACHINE = {
  rom: [{ start: 0x0000, end: 0x3fff }],
  programFiles: "a .z80 or .sna snapshot that the emulator exported at the entry of the program",
  macros: false,
  startScreen: false,
};

export const MACHINES: Record<MachineId, Machine> = {
  c64: { id: "c64", family: "c64", name: "Commodore 64", cpu: MOS6502, spaces: C64_SPACES, ghidraLanguage: "C64RT_6510:LE:16:nmos", assembler: ACME, ...C64_MACHINE },
  // Ghidra's own Z80 language: nothing to install.
  spectrum48: { id: "spectrum48", family: "spectrum", name: "ZX Spectrum 48K", cpu: Z80, spaces: SPECTRUM48_SPACES, ghidraLanguage: "z80:LE:16:default", assembler: SJASMPLUS, ...SPECTRUM_MACHINE },
  spectrum128: { id: "spectrum128", family: "spectrum", name: "ZX Spectrum 128K", cpu: Z80, spaces: SPECTRUM128_SPACES, ghidraLanguage: "z80:LE:16:default", assembler: SJASMPLUS, ...SPECTRUM_MACHINE },
};

/** The ROM of the machine that holds an address of its main space, or undefined. */
export function romAt(machine: Machine, address: number): AddressRange | undefined {
  return machine.rom.find((range) => address >= range.start && address <= range.end);
}

/**
 * The model that the entry state of a program names: a ZX Spectrum snapshot
 * gives Z80 registers, and port $7ffd only on the 128K. Undefined for an entry
 * state of another machine.
 */
export function modelOfEntryState(state: Record<string, unknown> | undefined): MachineId | undefined {
  const registers = state?.registers;
  if (typeof registers !== "object" || registers === null || !("pc" in registers) || !("af" in registers)) return undefined;
  return typeof state!.port7ffd === "string" ? "spectrum128" : "spectrum48";
}

export const C64 = MACHINES.c64;

/** The machine of a project whose knowledge names none. */
export const DEFAULT_MACHINE: Machine = C64;

export function isMachineId(value: unknown): value is MachineId {
  return typeof value === "string" && (MACHINE_IDS as readonly string[]).includes(value);
}

/** Every space name of every machine: the check of the knowledge index. Each row is also checked against the project machine. */
export const ANY_SPACE = new RegExp(`^(?:${MACHINE_IDS.map((id) => MACHINES[id].spaces.pattern.source.slice(1, -1)).join("|")})$`);

/** The sort order of the spaces in the knowledge files: each CPU view first, then the other spaces by number. */
export function spaceOrder(space: Space): number {
  if (space === "c64" || space === "spectrum") return -3;
  if (space === "drive8") return -2;
  if (space === "loading") return -1;
  const number = /^(?:bank|ram)(\d+)$/.exec(space);
  return number === null ? 1_000 : Number(number[1]);
}
