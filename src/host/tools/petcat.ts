// The petcat adapter (16 §13). petcat makes the C64 BASIC V2 listing; the
// adapter parses the tokenized program itself to check that listing and to
// find the machine-code handoffs, because petcat's exit status proves nothing
// (it prints any bytes as text).

import { existsSync, readFileSync } from "node:fs";

import { findHandoffs, parseTokenized } from "../../c64.ts";
import { WireFailure, type PetcatResult } from "../../protocol.ts";
import { Workspace } from "../../native/staging.ts";
import { findTool, PETCAT } from "../../native/discover.ts";
import { requireMinimumVersion } from "./version.ts";
import { runToolOrFail, type ToolContext } from "../../native/run.ts";

const TIMEOUT_MS = 30_000;
const LISTING = "listing.txt";
/** petcat's listing lines ("   10 sys2061"), as number and text. */
export function parseListing(listing: string): Array<{ number: number; text: string }> {
  const lines: Array<{ number: number; text: string }> = [];
  for (const line of listing.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const match = /^\s*(\d+) ?(.*)$/.exec(line);
    if (match === null) throw new WireFailure("operation-failed", "petcat printed a listing line without a line number.");
    lines.push({ number: Number(match[1]), text: match[2]! });
  }
  return lines;
}

export async function decode(
  program: Buffer,
  context: ToolContext,
): Promise<{ result: PetcatResult }> {
  const tokenized = parseTokenized(program);
  if ("reason" in tokenized) return { result: { decoded: false, reason: tokenized.reason } };
  const executable = findTool(PETCAT, context.env);
  await requireMinimumVersion(PETCAT, executable, context);
  const workspace = Workspace.create(context.supervisor);
  try {
    workspace.materialize("input", [{ path: "program.prg", size: program.length }], [program]);
    const output = workspace.directory("out");
    const run = await runToolOrFail(
      "petcat",
      "The BASIC decode",
      // -2: C64 BASIC V2 keywords. -nh: no header. The input is never read as an option.
      { argv: [executable, "-2", "-nh", "-o", `${output}/${LISTING}`, "--", "input/program.prg"], cwd: workspace.root, timeoutMs: TIMEOUT_MS },
      context,
    );
    const listingPath = `${output}/${LISTING}`;
    if (run.code !== 0 || !existsSync(listingPath)) {
      context.log?.(`petcat exited ${run.code}:\n${run.stdout}\n${run.stderr}`);
      throw new WireFailure("operation-failed", "petcat could not decode the program.");
    }
    const lines = parseListing(readFileSync(listingPath, "latin1"));
    const agrees = lines.length === tokenized.lines.length && lines.every((line, index) => line.number === tokenized.lines[index]!.number);
    if (!agrees) throw new WireFailure("operation-failed", "petcat's listing does not match the lines of the program.");
    return {
      result: {
        decoded: true,
        loadAddress: tokenized.loadAddress,
        basicEnd: tokenized.basicEnd,
        listing: lines.map((line) => `${line.number} ${line.text}`).join("\n"),
        lines,
        handoffs: findHandoffs(tokenized.lines),
      },
    };
  } finally {
    workspace.remove();
  }
}
