// Revision ids for tests that count revisions: the first, second, ... revision.

import type { DatabaseSync } from "node:sqlite";

import { openForRead } from "./database.ts";

/** The id of the n-th revision of the knowledge, oldest first; 0 gives "0", the knowledge before every revision. */
export function nth(db: DatabaseSync, n: number): string {
  if (n === 0) return "0";
  const row = db.prepare("SELECT id FROM revisions ORDER BY id LIMIT 1 OFFSET ?").get(n - 1) as { id: string } | undefined;
  if (row === undefined) throw new Error(`The knowledge has no revision ${n}.`);
  return row.id;
}

/** The id of the n-th revision of the knowledge of a project folder, oldest first. */
export function nthIn(root: string, n: number): string {
  const db = openForRead(root);
  if (db === undefined) {
    if (n === 0) return "0";
    throw new Error(`The project ${root} has no knowledge.`);
  }
  try {
    return nth(db, n);
  } finally {
    db.close();
  }
}
