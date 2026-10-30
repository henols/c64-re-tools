// The files of a recording folder: the record of a session writes them, and the
// knowledge takes the coverage map of the folder. They are here, so the
// script that records and the script that keeps the knowledge share one list.

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { Refusal } from "../errors.ts";
import { projectRoot, resolveReadFile } from "../project.ts";

export const RECORDING_FILES = { recording: "recording.json", reads: "reads.txt", coverage: "coverage.bin" } as const;

/**
 * The coverage map that a path names: the path itself, or for a recording
 * folder the coverage map in it (<folder>/coverage.bin). The knowledge names a
 * map by this path, so a new recording into the same folder replaces the map.
 * A path that is no folder, or that does not exist, is given back as it is:
 * the read of the map refuses it.
 */
export function coverageMapOf(path: string, root = projectRoot()): string {
  let real: string;
  try {
    real = resolveReadFile(path, root);
  } catch {
    return path;
  }
  if (!statSync(real).isDirectory()) return path;
  if (!existsSync(join(real, RECORDING_FILES.coverage)) || !existsSync(join(real, RECORDING_FILES.recording))) {
    throw new Refusal("not-found", `${path} is a folder that holds no recording. Give a coverage map, or a folder that a record of a session wrote.`);
  }
  return `${path.replace(/\/+$/, "")}/${RECORDING_FILES.coverage}`;
}
