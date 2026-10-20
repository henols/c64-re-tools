// The Exomizer adapter: packs PRG files into one C64 program that unpacks
// itself (exomizer sfx), then unpacks that program again in the 6502
// emulator of Exomizer (exomizer desfx), so the caller can check the bytes
// and the entry of the result before anyone runs it.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { formatC64Address } from "../c64.ts";
import { WireFailure } from "../protocol/messages.ts";
import { EXOMIZER, findTool } from "./discover.ts";
import { outputTail, runToolOrFail, type ToolContext } from "./run.ts";
import { Workspace } from "./staging.ts";

/** A full 64 KiB program with all optimization passes can take minutes. */
const TIMEOUT_MS = 600_000;
const PACKED = "packed.prg";
const UNPACKED = "unpacked.prg";

/** The unpacker of Exomizer runs below $0400; the emulator of desfx stops when the program counter leaves that area. */
export const MIN_ENTRY = 0x0400;

export interface PackParams {
  /** The PRG files in load order: where two overlap, the later one wins. */
  programs: readonly Uint8Array[];
  /** Where the unpacked program starts, at MIN_ENTRY or above. */
  entry: number;
  /** The value of $01 when the program starts, $34 to $37. Without it, the value at the start of the packed program ($37). */
  exitMemory?: number;
}

export interface Packed {
  /** The packed PRG: a BASIC SYS line at $0801 with the unpacker, then the packed data. */
  program: Buffer;
  /** What the emulator of Exomizer unpacked: a PRG of the largest range that the unpacker wrote. */
  unpacked: Buffer;
  /** Where the unpacker jumped when it was done. */
  entry: number;
  /** The CPU cycles of the unpacking, when Exomizer gives them. */
  cycles?: number;
}

/** The argv of the pack: the entry comes first, then the options, then the input files in load order. */
export function sfxArguments(executable: string, params: Omit<PackParams, "programs">, inputs: readonly string[], output: string): string[] {
  const argv = [executable, "sfx", String(params.entry), "-t64", "-n", "-o", output];
  if (params.exitMemory !== undefined) argv.push(`-Di_ram_exit=${params.exitMemory}`);
  argv.push(...inputs);
  return argv;
}

/** The entry and the cycles in the output of desfx: ' Decrunch took 1.234567 Mcycles, ...' and ' Writing "x" as prg, saving from $0801 to $9000, entry at $0810.' */
export function parseDesfx(output: string): { entry: number; cycles?: number } | undefined {
  const entry = /entry at \$([0-9a-fA-F]{4})\./.exec(output)?.[1];
  if (entry === undefined) return undefined;
  const mcycles = /Decrunch took ([0-9.]+) Mcycles/.exec(output)?.[1];
  return { entry: Number.parseInt(entry, 16), ...(mcycles === undefined ? {} : { cycles: Math.round(Number(mcycles) * 1_000_000) }) };
}

/** Lines of Exomizer output that tell why it stopped. */
const PROBLEM = /error|warning|can't|cannot|overlap/i;

export async function pack(params: PackParams, context: ToolContext): Promise<Packed> {
  if (params.programs.length === 0) throw new WireFailure("invalid-input", "Give at least one PRG to pack.");
  if (params.entry < MIN_ENTRY) throw new WireFailure("invalid-input", `The entry ${formatC64Address(params.entry)} is below $0400. The unpacker of Exomizer runs there. Give an entry at $0400 or above.`);
  const executable = findTool(EXOMIZER, context.env);
  const workspace = Workspace.create(context.supervisor);
  try {
    // Plain names: Exomizer reads "name,address" as a file with a new load address.
    const input = workspace.directory("in");
    const inputs = params.programs.map((program, index) => {
      const path = join(input, `${index}.prg`);
      writeFileSync(path, program, { flag: "wx" });
      return path;
    });
    const output = workspace.directory("out");
    const packedPath = join(output, PACKED);
    const packing = await runToolOrFail("Exomizer", "The pack", { argv: sfxArguments(executable, params, inputs, packedPath), cwd: workspace.root, timeoutMs: TIMEOUT_MS }, context);
    if (packing.code !== 0) throw new WireFailure("operation-failed", `Exomizer could not pack the program (exit ${packing.code}).${outputTail("Exomizer", packing, workspace.root, PROBLEM)} Correct the call as this output tells, or give this message to the user.`);
    if (!existsSync(packedPath)) throw new WireFailure("operation-failed", "Exomizer reported success but wrote no program.");
    const unpackedPath = join(output, UNPACKED);
    const unpacking = await runToolOrFail("Exomizer", "The unpack check", { argv: [executable, "desfx", "-o", unpackedPath, packedPath], cwd: workspace.root, timeoutMs: TIMEOUT_MS }, context);
    const found = parseDesfx(`${unpacking.stdout}\n${unpacking.stderr}`);
    if (unpacking.code !== 0 || found === undefined || !existsSync(unpackedPath)) {
      throw new WireFailure("operation-failed", `Exomizer could not unpack the packed program in its emulator (exit ${unpacking.code}).${outputTail("Exomizer", unpacking, workspace.root)} Give this message to the user.`);
    }
    return { program: readFileSync(packedPath), unpacked: readFileSync(unpackedPath), ...found };
  } finally {
    workspace.remove();
  }
}
