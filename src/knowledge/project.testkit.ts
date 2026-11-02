// Scratch projects, knowledge and findings for the knowledge tests.

import { mkdtempSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";

import { openForRead, openForWrite } from "./database.ts";
import type { NormalizedFindings } from "./import.ts";
import type { Analyzer } from "./schema.ts";

/** Removes a scratch folder; Windows keeps a file that a test left open locked until the process ends. */
function remove(root: string): void {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch (error) {
    if (process.platform !== "win32") throw error;
  }
}

/** A new project folder, removed after the test that calls this, or after the tests of the file when the module calls it. */
export function scratchProject(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-knowledge-"));
  after(() => remove(root));
  return root;
}

/** A new scratch project and its knowledge, open for writes; closed and removed as scratchProject is. */
export function scratchKnowledge(): { root: string; db: DatabaseSync } {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-knowledge-"));
  const db = openForWrite(root);
  after(() => {
    db.close();
    remove(root);
  });
  return { root, db };
}

/** The knowledge of a new scratch project, open for writes. */
export const fresh = (): DatabaseSync => scratchKnowledge().db;

/** The result of `work` on the knowledge of a project, open for reads and closed after. */
export function withRead<T>(root: string, work: (db: DatabaseSync) => T): T {
  using db = openForRead(root)!;
  return work(db);
}

/** The `n` of a query that gives one row with an `n`. */
export const count = (db: DatabaseSync, sql: string): number => (db.prepare(sql).get() as { n: number }).n;

/** One analyzer run over $start-$end: authoritative in each category that `parts` does not set, with the facts of `parts`. */
export function findings(
  analyzer: Analyzer,
  start: number,
  end: number,
  parts: Omit<Partial<NormalizedFindings>, "authoritative"> & { authoritative?: Partial<NormalizedFindings["authoritative"]> } = {},
): NormalizedFindings {
  const { authoritative, ...facts } = parts;
  return {
    analyzer,
    coverage: [{ start, end }],
    symbols: [],
    regions: [],
    references: [],
    ...facts,
    authoritative: { symbols: true, regions: true, references: true, ...authoritative },
  };
}
