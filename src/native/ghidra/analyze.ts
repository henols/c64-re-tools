// The Ghidra analysis: the Ghidra SLEIGH decoder and decompiler with the
// language of the machine (the NMOS 6510 or the Z80), in this process as a WebAssembly module. Knowledge seeds go
// in, the structural result comes out, and the result is checked completely
// before the script imports it.

import { C64, type Machine } from "../../machine.ts";
import { describeError, WireFailure } from "../../protocol/messages.ts";
import { checkGhidraResult, checkRequestBounds, GHIDRA_LIMITS, imageRange, seedsInside, type GhidraParams, type GhidraResult } from "../types.ts";
import type { ToolContext } from "../run.ts";
import { walk } from "./walk.ts";
import { decompile, loadImage, setName, SLEIGH_VERSION } from "./wasm.ts";

/** The longest reason that the result check accepts. */
const MAX_REASON = 1000;

export async function analyze(
  params: GhidraParams,
  image: Buffer,
  context: ToolContext,
  machine: Machine = C64,
): Promise<{ result: GhidraResult }> {
  checkRequestBounds(params);
  const { start, end, body } = imageRange(params.imageKind, image);

  // The decoder sees only the loaded bytes; labels may name any address.
  const { entryPoints, codeStarts, dataRanges } = seedsInside(params, start, end);
  if (entryPoints.length === 0) {
    throw new WireFailure("invalid-input", `Give at least one entry point inside the program, for example the ${machine.cpu.id === "z80" ? "USR address of its BASIC loader" : "SYS address of its BASIC loader"}.`);
  }
  context.signal.throwIfAborted();

  let walked: ReturnType<typeof walk>;
  try {
    loadImage(body, start, machine.ghidraLanguage);
    walked = walk(body, start, end, { entryPoints, codeStarts, dataRanges, labels: params.labels }, machine.cpu.id);
  } catch (error) {
    context.log?.(`The Ghidra decoder failed: ${describeError(error)}`);
    throw new WireFailure("operation-failed", `The Ghidra decoder failed: ${describeError(error)}. Nothing was imported.`);
  }
  const { decompilations, notDecompiled } = decompileRoutines(params, walked.functions, body, start, context, machine.ghidraLanguage);

  let result: GhidraResult;
  try {
    result = checkGhidraResult({ ...walked, decompilations, notDecompiled, completeness: { functions: true, regions: true, references: true }, toolVersion: SLEIGH_VERSION }, machine.cpu.maxInstructionLength);
  } catch (error) {
    context.log?.(`Ghidra result rejected: ${describeError(error)}`);
    throw new WireFailure("operation-failed", `Ghidra returned an incomplete or inconsistent result. Nothing was imported. The check found: ${describeError(error)}.`);
  }
  return { result };
}

/** The requested routines as C text, within the character bounds; the labels name routines and data. */
function decompileRoutines(params: GhidraParams, functions: GhidraResult["functions"], body: Uint8Array, start: number, context: ToolContext, language: string): Pick<GhidraResult, "decompilations" | "notDecompiled"> {
  const decompilations: GhidraResult["decompilations"] = [];
  const notDecompiled: NonNullable<GhidraResult["notDecompiled"]> = [];
  if (params.decompile.length === 0) return { decompilations, notDecompiled };
  const entries = new Set(functions.map((fn) => fn.entry));
  // A trap in the decompiler drops its image: the next routine loads it again.
  let prepared = false;
  const prepare = () => {
    if (prepared) return;
    loadImage(body, start, language);
    for (const label of params.labels) {
      try {
        setName(label.address, label.name, entries.has(label.address) ? "function" : "data");
      } catch (error) {
        // The decompiler then prints its own name for the address.
        context.log?.(`The Ghidra decompiler refused the name ${label.name}: ${describeError(error)}`);
      }
    }
    prepared = true;
  };
  let remaining = GHIDRA_LIMITS.decompiledTotalChars;
  for (const entry of params.decompile) {
    if (!entries.has(entry)) {
      notDecompiled.push({ entry, reason: "no function starts at this address" });
      continue;
    }
    if (remaining <= 0) {
      notDecompiled.push({ entry, reason: "the decompiled text of the other routines used the whole limit" });
      continue;
    }
    let text: string;
    try {
      prepare();
      text = decompile(entry);
    } catch (error) {
      prepared = false;
      context.log?.(`The Ghidra decompiler failed at ${entry}: ${describeError(error)}`);
      notDecompiled.push({ entry, reason: describeError(error).slice(0, MAX_REASON) || "the decompiler gave no reason" });
      continue;
    }
    const limit = Math.min(GHIDRA_LIMITS.decompiledChars, remaining);
    const truncated = text.length > limit;
    if (truncated) text = text.slice(0, limit);
    remaining -= text.length;
    decompilations.push({ entry, text, truncated });
  }
  return { decompilations, notDecompiled };
}
