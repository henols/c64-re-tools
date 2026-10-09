// The DXA adapter. DXA prints an assembler listing only; with
// "-a dump" each line starts with its address and bytes, so the adapter can
// tell code from data line by line. The whole listing is checked before the
// script imports anything: lines in address order from the load address to
// the end, each line as long as its bytes or data items, so a truncated or
// changed listing is refused instead of half imported.

import { writeFileSync } from "node:fs";

import { SYMBOL_NAME } from "../c64.ts";
import { WireFailure } from "../protocol.ts";
import { checkDxaResult, checkRequestBounds, imageRange, seedsInside, type DxaParams, type DxaResult } from "./types.ts";
import { Workspace } from "./staging.ts";
import { DXA, findTool } from "./discover.ts";
import { outputTail, runToolOrFail, type ToolContext } from "./run.ts";

const TIMEOUT_MS = 120_000;
/** The listing is returned as an attachment; larger output is refused. */
const MAX_LISTING = 8 * 1024 * 1024;

const hex = (value: number) => value.toString(16).padStart(4, "0");

/**
 * The options for one run; every value comes from the validated request. A
 * seed file is passed only when it has lines: dxa refuses an empty one.
 */
export function dxaArguments(executable: string, params: DxaParams, files: { image: string; routines?: string; blocks?: string; labels?: string }): string[] {
  const argv = [executable, "-a", "dump", "-p", "all-nmos6502", "-d", "skip-scanning"];
  if (files.routines !== undefined) argv.push("-R", files.routines);
  if (files.blocks !== undefined) argv.push("-B", files.blocks);
  if (files.labels !== undefined) argv.push("-l", files.labels);
  // A PRG gives its load address and may start with BASIC (-U finds its SYS);
  // 64 KiB of memory starts at $0000 and has no load address.
  if (params.imageKind === "prg") argv.push("-U");
  else argv.push("-g", "0000", "-q");
  argv.push(files.image);
  return argv;
}

/** Number of data bytes in a .byt or .word line, or undefined for an instruction. */
function dataSize(operation: string): number | undefined {
  const match = /^\.(byt|word)\s+(.+)$/.exec(operation.trim());
  if (match === null) return undefined;
  const items = match[2]!.split(",").length;
  return match[1] === "word" ? items * 2 : items;
}

/**
 * Parses a "-a dump" listing into regions and labels for [start, end].
 * Throws an Error when the listing is not a complete, consistent listing of
 * exactly that range.
 */
export function parseListing(listing: string, start: number, end: number): Pick<DxaResult, "regions" | "labels"> {
  const statements: Array<{ address: number; dumped: number; data: number | undefined }> = [];
  const labels: DxaResult["labels"] = [];
  for (const line of listing.split(/\r?\n/)) {
    // dxa prints a seed label as it is, also a local name that starts with a dot.
    const label = /^([0-9a-f]{4})\s+(\.?[A-Za-z_]\w*):\s*$/.exec(line);
    if (label !== null) {
      const address = Number.parseInt(label[1]!, 16);
      if (address < start || address > end || !SYMBOL_NAME.test(label[2]!)) throw new Error(`label ${label[2]} at $${label[1]} is not usable`);
      labels.push({ address, name: label[2]! });
      continue;
    }
    // dxa pads the bytes column with a tab, but a two-byte .word line with spaces only.
    const statement = /^([0-9a-f]{4}) ((?:[0-9a-f]{2} ?){1,3})\s+(\S.*)$/.exec(line);
    if (statement === null) continue;
    statements.push({ address: Number.parseInt(statement[1]!, 16), dumped: statement[2]!.trim().split(/\s+/).length, data: dataSize(statement[3]!) });
  }
  if (statements.length === 0) throw new Error("the listing has no statements");
  if (statements[0]!.address !== start) throw new Error(`the listing starts at $${hex(statements[0]!.address)}, not at $${hex(start)}`);
  const regions: DxaResult["regions"] = [];
  statements.forEach((statement, index) => {
    const next = statements[index + 1]?.address ?? end + 1;
    const size = next - statement.address;
    if (size <= 0) throw new Error(`the listing goes back at $${hex(next)}`);
    // Data lines count their items; an instruction line dumps exactly its bytes.
    const expected = statement.data ?? statement.dumped;
    if (expected !== size) throw new Error(`the line at $${hex(statement.address)} holds ${expected} bytes, but the next line is ${size} bytes later`);
    const classification = statement.data === undefined ? "code" : "data";
    const last = regions.at(-1);
    if (last?.classification === classification) last.end = next - 1;
    else regions.push({ start: statement.address, end: next - 1, classification });
  });
  if (statements.at(-1)!.address > end) throw new Error("the listing runs past the end of the program");
  return { regions, labels };
}

export async function analyze(
  params: DxaParams,
  image: Buffer,
  context: ToolContext,
): Promise<{ result: DxaResult; attachments: Buffer[] }> {
  checkRequestBounds(params);
  const executable = findTool(DXA, context.env);
  const { start, end } = imageRange(params.imageKind, image);
  const { entryPoints, dataRanges } = seedsInside(params, start, end);

  const workspace = Workspace.create(context.supervisor);
  try {
    workspace.materialize("input", [{ path: "image.bin", size: image.length }], [image]);
    const files: Parameters<typeof dxaArguments>[2] = { image: "input/image.bin" };
    const seed = (name: "routines" | "blocks" | "labels", lines: string[]) => {
      if (lines.length === 0) return;
      writeFileSync(workspace.path(`${name}.txt`), lines.join(""));
      files[name] = `${name}.txt`;
    };
    seed("routines", entryPoints.map((address) => `${hex(address)}\n`));
    seed("blocks", dataRanges.map((range) => `${hex(range.start)}-${hex(range.end)}\n`));
    // The xa label file format: name, address, flags. dxa reads the name up to the first blank, so a leading dot stays.
    seed("labels", params.labels.filter((label) => SYMBOL_NAME.test(label.name)).map((label) => `${label.name}, 0x${hex(label.address)}, 0x0000\n`));
    const run = await runToolOrFail(
      "dxa",
      "The DXA analysis",
      {
        argv: dxaArguments(executable, params, files),
        cwd: workspace.root,
        timeoutMs: TIMEOUT_MS,
        outputLimit: MAX_LISTING,
        truncated: `dxa printed a listing that is larger than ${MAX_LISTING / 1024 / 1024} MiB. Nothing was imported.`,
      },
      context,
    );
    if (run.code !== 0) {
      context.log?.(`dxa exited ${run.code}: ${run.stderr}`);
      const tail = outputTail("dxa", run, workspace.root);
      throw new WireFailure("operation-failed", `dxa could not analyze the program${tail === "" ? ` (exit ${run.code}).` : `.${tail}`}`);
    }
    const listing = Buffer.from(run.stdout, "utf8");
    let result: DxaResult;
    try {
      const parsed = parseListing(run.stdout, start, end);
      // DXA classifies every byte, so its regions are complete; it names only referenced addresses.
      result = checkDxaResult({ coverage: [{ start, end }], ...parsed, listingBytes: listing.length, completeness: { regions: true, labels: false } }, [listing]);
    } catch (error) {
      context.log?.(`dxa listing rejected: ${(error as Error).message}`);
      // The listing is on stdout: only dxa's messages on stderr are quoted.
      const tail = outputTail("dxa", { stdout: "", stderr: run.stderr }, workspace.root);
      throw new WireFailure("operation-failed", `dxa returned an incomplete or inconsistent listing. Nothing was imported. The check found: ${(error as Error).message}.${tail}`);
    }
    return { result, attachments: [listing] };
  } finally {
    workspace.remove();
  }
}
