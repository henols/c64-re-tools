// ghidra.analyze (16 §10, §11): one disposable headless run with the NMOS
// 6510 language, knowledge seeds before analysis, and the structural export
// after it. The result is checked completely before it leaves the host.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { checkGhidraResult, GHIDRA_LIMITS, WireFailure, type GhidraParams, type GhidraResult } from "../../../protocol.ts";
import type { ProcessSupervisor } from "../../processes.ts";
import { Workspace } from "../../staging.ts";
import { findGhidra, runHeadless, SCRIPT_DIRECTORY } from "./index.ts";

const TIMEOUT_MS = 600_000;

export async function analyze(
  params: GhidraParams,
  image: Buffer,
  context: { supervisor: ProcessSupervisor; signal: AbortSignal; env?: NodeJS.ProcessEnv; log?: (line: string) => void },
): Promise<{ result: GhidraResult }> {
  const ghidra = findGhidra(context.env);
  const base = params.imageKind === "prg" ? image.readUInt16LE(0) : 0;
  const body = params.imageKind === "prg" ? image.subarray(2) : image;
  const start = base;
  const end = base + body.length - 1;
  const inside = (address: number) => address >= start && address <= end;

  // Ghidra disassembles and defines data only in the loaded bytes; labels may name any address.
  const entryPoints = params.entryPoints.filter(inside);
  if (entryPoints.length === 0) {
    throw new WireFailure("invalid-input", "Give at least one entry point inside the program, for example the SYS address of its BASIC loader.");
  }
  const dataRanges = params.dataRanges
    .filter((range) => range.end >= start && range.start <= end)
    .map((range) => ({ start: Math.max(range.start, start), end: Math.min(range.end, end) }))
    .filter((range) => !entryPoints.some((entry) => entry >= range.start && entry <= range.end));

  const workspace = Workspace.create();
  try {
    workspace.materialize("input", [{ path: "image.bin", size: body.length }], [body]);
    writeFileSync(workspace.path("seeds.json"), JSON.stringify({ start, end, entryPoints, dataRanges, labels: params.labels }));
    writeFileSync(
      workspace.path("request.json"),
      JSON.stringify({ start, end, decompile: params.decompile, maxChars: GHIDRA_LIMITS.decompiledChars, maxTotalChars: GHIDRA_LIMITS.decompiledTotalChars }),
    );
    const run = await runHeadless({
      ghidra,
      workspace,
      file: "input/image.bin",
      baseAddress: base,
      scriptDirectories: [SCRIPT_DIRECTORY],
      preScripts: [{ name: "C64Prepare.java", args: [workspace.path("seeds.json")] }],
      postScripts: [{ name: "C64Export.java", args: [workspace.path("request.json"), workspace.path("out.json")] }],
      analyze: true,
      timeoutMs: TIMEOUT_MS,
      supervisor: context.supervisor,
      signal: context.signal,
      ...(context.env === undefined ? {} : { env: context.env }),
    }).catch((error: unknown) => {
      context.log?.(`Ghidra failed: ${(error as Error).message}`);
      throw error;
    });
    const outPath = workspace.path("out.json");
    if (!existsSync(outPath)) {
      context.log?.(`Ghidra wrote no result:\n${run.stdout.slice(-4000)}\n${run.stderr.slice(-4000)}`);
      throw new WireFailure("operation-failed", "Ghidra finished without a result.");
    }
    let result: GhidraResult;
    try {
      result = checkGhidraResult(JSON.parse(readFileSync(outPath, "utf8")));
      if (result.coverage.length !== 1 || result.coverage[0]!.start !== start || result.coverage[0]!.end !== end) throw new Error("the coverage is not the loaded program");
    } catch (error) {
      context.log?.(`Ghidra result rejected: ${(error as Error).message}`);
      throw new WireFailure("operation-failed", "Ghidra returned an incomplete or inconsistent result. Nothing was imported.");
    }
    return { result };
  } finally {
    workspace.remove();
  }
}
