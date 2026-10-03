// Reads project files on the client side for transfer to the Host Runtime.
// The host never sees a client path: only bytes and the file's type.

import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

import { projectRoot, resolveProjectFile } from "../project.ts";
import { MAX_ATTACHMENT_BYTES, WireFailure } from "../protocol.ts";

export interface ProjectFile {
  bytes: Buffer;
  /** Lowercase extension without the dot; empty when the file has none. */
  type: string;
}

/**
 * Reads one project file. Throws WireFailure: invalid-input for a path the
 * project rules refuse, not-found when nothing is there, limit-exceeded when
 * the file is too large to transfer.
 */
export function readProjectFile(path: string, options: { root?: string; maxBytes?: number } = {}): ProjectFile {
  const root = options.root ?? projectRoot();
  const maxBytes = options.maxBytes ?? MAX_ATTACHMENT_BYTES;
  let real: string;
  try {
    real = resolveProjectFile(path, root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WireFailure("not-found", `There is no file at ${path} in the project directory.`);
    }
    if (error instanceof TypeError) {
      throw new WireFailure("invalid-input", `${path}: give a path relative to the project directory that stays inside it.`);
    }
    throw error;
  }
  const stat = statSync(real);
  if (!stat.isFile()) throw new WireFailure("invalid-input", `${path} is not a file.`);
  if (stat.size > maxBytes) {
    throw new WireFailure("limit-exceeded", `${path} has ${stat.size} bytes; the limit is ${maxBytes} bytes.`);
  }
  return { bytes: readFileSync(real), type: extname(real).slice(1).toLowerCase() };
}
