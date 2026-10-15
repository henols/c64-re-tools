// Tool results written to a project file instead of the context (D39). The
// MCP server runs on the agent's machine, so it writes the file itself; the
// host never sees the path. The project is the folder that `project` names,
// or the one that the D67 rules find from the folder the agent started in (D68).

import { createHash } from "node:crypto";

import { z } from "zod";

import { projectFolder, writeProjectFile } from "../host-client/transfer.ts";

export const OutInput = z.string().min(1).describe("write the result to this file, relative to the project folder, in place of returning it. An existing file is overwritten");

/** The project of a tool with a path (D67, D68). */
export const ProjectInput = z
  .string()
  .min(1)
  .describe("the project folder, relative to the folder where the agent started. Give it when that folder is not in a project and has projects below it. The paths of this call are relative to the project folder");

/** What a result says in place of the bytes it wrote. */
export interface Written {
  out: string;
  bytes: number;
  sha256: string;
}

/** The fields of a result with out, optional in an output schema that also has the inline form. */
export const WrittenOutput = {
  out: z.string().optional(),
  bytes: z.number().int().min(0).optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
};

/** Writes `data` to the file `path` of the project that `project` names (or the D67 lookup finds), and gives what the result shows in its place. */
export function writeOut(path: string, data: Uint8Array | string, project: string | undefined): Written {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  writeProjectFile(path, bytes, { what: "out", root: projectFolder(project) });
  return { out: path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}
