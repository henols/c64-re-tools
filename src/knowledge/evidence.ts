// The files that the knowledge gives as evidence, against the project as it
// is now. A revision keeps the SHA-256 of each file that it rests on, so a
// file that is gone or that changed since then shows here.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

import { LOCAL_DIRECTORY, PROJECT_DIRECTORY, resolveProjectFile } from "../project.ts";
import { coverageRuns } from "./read.ts";

/** A file of the evidence that is not as the knowledge gives it: missing, or with other bytes. */
export interface EvidenceChange {
  /** The project path of the file. */
  file: string;
  state: "missing" | "changed";
  /** The revisions that give the file with the SHA-256 that the file no longer has, oldest first. */
  revisions: string[];
}

/** The SHA-256 of a project file, or undefined when it is not there. */
function fileHash(root: string, path: string): string | undefined {
  try {
    return createHash("sha256").update(readFileSync(resolveProjectFile(path, root))).digest("hex");
  } catch {
    return undefined;
  }
}

/**
 * The evidence files that are missing or changed. A file counts with its
 * latest SHA-256 in the knowledge: for a coverage map, its latest import
 * into each space; for another file, the latest revision that gives it. An
 * earlier SHA-256 of the same file is history. A file in
 * .c64-re-tools/local/ does not count: git does not keep it, and the
 * knowledge keeps what it needs of it. `only` limits the check to some files.
 */
export function changedEvidence(db: DatabaseSync | undefined, root: string, only?: (file: string) => boolean): EvidenceChange[] {
  if (db === undefined) return [];
  const rows = db.prepare("SELECT revision, kind, ref, sha256 FROM evidence WHERE sha256 IS NOT NULL ORDER BY revision, id").all() as Array<{ revision: string; kind: string; ref: string; sha256: string }>;
  const local = `${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/`;
  const wanted = (file: string) => !file.startsWith(local) && (only === undefined || only(file));
  // The SHA-256 values that each file must have now.
  const expected = new Map<string, Set<string>>();
  const expect = (file: string, sha256: string) => {
    if (!wanted(file)) return;
    if (!expected.has(file)) expected.set(file, new Set());
    expected.get(file)!.add(sha256);
  };
  const latest = new Map<string, string>();
  for (const row of rows) if (row.kind !== "coverage") latest.set(row.ref, row.sha256);
  for (const [file, sha256] of latest) expect(file, sha256);
  // The runs of a name are oldest first: the last run in each space is the map that the knowledge has.
  const maps = new Map(coverageRuns(db).map((run) => [`${run.space}\n${run.name}`, run]));
  for (const run of maps.values()) expect(run.name, run.sha256);
  const changes: EvidenceChange[] = [];
  for (const [file, hashes] of [...expected].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const now = fileHash(root, file);
    for (const sha256 of hashes) {
      if (now === sha256) continue;
      const revisions = [...new Set(rows.filter((row) => row.ref === file && row.sha256 === sha256).map((row) => row.revision))];
      changes.push({ file, state: now === undefined ? "missing" : "changed", revisions });
    }
  }
  return changes;
}
