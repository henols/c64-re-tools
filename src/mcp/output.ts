// Tool results written to a project file instead of the context. The
// MCP server runs on the agent's machine, so it writes the file itself; the
// host never sees the path. The project is the folder that `project` names,
// or the one that the project rules find from the folder the agent started in.

import { z } from "zod";

import { projectFolder, writeReported, type Written } from "../host-client/transfer.ts";

export const OutInput = z.string().min(1).describe("write the data to this file, relative to the project folder. An existing file is overwritten. The tool description tells what the result then gives");

/** The project of a tool with a path. */
export const ProjectInput = z
  .string()
  .min(1)
  .describe("the project folder, relative to the folder where the agent started. Give it when that folder is not in a project and has projects below it. The paths of this call are relative to the project folder");

/** The fields of a result with out, optional in an output schema that also has the inline form. */
export const WrittenOutput = {
  out: z.string().optional(),
  bytes: z.number().int().min(0).optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
};

/** Lines as file text: each line ends with a newline, and no lines give an empty file. */
export function linesText(lines: readonly string[]): string {
  return lines.map((line) => `${line}\n`).join("");
}

/** Writes `data` to the file `path` of the project that `project` names (or the project lookup finds), and gives what the result shows in its place. */
export function writeOut(path: string, data: Uint8Array | string, project: string | undefined): Written {
  return writeReported(path, data, { what: "out", root: projectFolder(project) });
}
