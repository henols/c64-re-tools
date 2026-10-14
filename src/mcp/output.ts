// Tool results written to a project file instead of the context (D39). The
// MCP server runs on the agent's machine with the project as its working
// directory, so it writes the file itself; the host never sees the path.

import { createHash } from "node:crypto";

import { z } from "zod";

import { writeProjectFile } from "../host-client/transfer.ts";

export const OutInput = z.string().min(1).describe("write the result to this file, relative to the project directory, in place of returning it. An existing file is overwritten");

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

/** Writes `data` to the project file `path` and gives what the result shows in its place. */
export function writeOut(path: string, data: Uint8Array | string, root?: string): Written {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  writeProjectFile(path, bytes, { what: "out", ...(root === undefined ? {} : { root }) });
  return { out: path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}
