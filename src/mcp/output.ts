// Tool results written to a project file instead of the context. The
// MCP server runs on the agent's machine, so it writes the file itself; the
// host never sees the path. The path is absolute, and the project is the one
// that the project rules find at or above the file.

import { z } from "zod";

import { writeReported, type ToolFile, type Written } from "../host-client/transfer.ts";

export const OutInput = z
  .string()
  .min(1)
  .describe("write the data to this file: the absolute path of a file in a project folder. An existing file is overwritten. The result then gives the absolute path of the file (out), the number of bytes (bytes) and a SHA-256 (sha256) in place of the data");

/** The fields of a result with out, optional in an output schema that also has the inline form. */
export const WrittenOutput = {
  out: z.string().optional().describe("with out: the absolute path of the file that the tool wrote"),
  bytes: z.number().int().min(0).optional().describe("with out: the number of bytes in the file"),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional().describe("with out: the SHA-256 of the file"),
};

/** Lines as file text: each line ends with a newline, and no lines give an empty file. */
export function linesText(lines: readonly string[]): string {
  return lines.map((line) => `${line}\n`).join("");
}

/**
 * Writes `data` to the file of out, that the server checked before the tool
 * ran (checkOut), and gives what the result shows in its place: the absolute
 * path, the size and the SHA-256.
 */
export function writeOut(target: ToolFile | undefined, data: Uint8Array | string): Written {
  if (target === undefined) throw new Error("out has no file that the server checked before the tool ran");
  return writeReported(target.file, data, { what: "out", root: target.root });
}
