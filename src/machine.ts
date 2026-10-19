// The machines that c64-re-tools knows. A machine gives the CPU, the address
// spaces of the knowledge and the Ghidra language. Its family names the MCP
// server that drives it: one server for each family, from the one bin.

import type { AddressRange } from "./address.ts";
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

export const MACHINES: Record<MachineId, Machine> = {
  c64: { id: "c64", family: "c64", name: "Commodore 64", cpu: MOS6502, spaces: C64_SPACES, ghidraLanguage: "C64RT_6510:LE:16:nmos" },
  // Ghidra's own Z80 language: nothing to install.
  spectrum48: { id: "spectrum48", family: "spectrum", name: "ZX Spectrum 48K", cpu: Z80, spaces: SPECTRUM48_SPACES, ghidraLanguage: "z80:LE:16:default" },
  spectrum128: { id: "spectrum128", family: "spectrum", name: "ZX Spectrum 128K", cpu: Z80, spaces: SPECTRUM128_SPACES, ghidraLanguage: "z80:LE:16:default" },
};

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
