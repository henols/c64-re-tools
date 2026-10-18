// The machines that the analysis knows: the CPU and the Ghidra language of each.

import type { Cpu } from "./cpu.ts";
import { MOS6502 } from "./cpu/mos6502.ts";
import { Z80 } from "./cpu/z80.ts";

export interface Machine {
  id: "c64" | "zx48";
  name: string;
  cpu: Cpu;
  /** The Ghidra language ID of the CPU. */
  ghidraLanguage: string;
}

export const C64: Machine = { id: "c64", name: "Commodore 64", cpu: MOS6502, ghidraLanguage: "C64RT_6510:LE:16:nmos" };

/** Ghidra's own Z80 language: nothing to install. */
export const ZX48: Machine = { id: "zx48", name: "ZX Spectrum 48K", cpu: Z80, ghidraLanguage: "z80:LE:16:default" };
