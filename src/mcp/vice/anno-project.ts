#!/usr/bin/env node
// anno-project.ts
//
// WHY THIS FILE EXISTS: the one place a project's id is read from and written
// to \`<project>/.c64-re-tools/project.json\`. The id is minted once, persisted,
// and sent on every annotation call; the broker binds it into every read and
// write, so it is the only thing that names a project's rows.
//
// WHAT NOT TO DO:
//   - Never derive the id from a path or a git remote. A persisted random
//     UUID survives moves and never collides.
//   - Never regenerate a malformed file. A damaged id is refused by name: a
//     new one would silently name a different, empty project.
//   - Never create the file on a read.
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assertProjectId } from "./anno-types.mts";
import { toolsDirUnder } from "./repo-root.ts";

/** A project.json that exists but cannot be used. */
export class AnnoProjectFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnoProjectFileError";
  }
}

/** Where a workspace's project id lives. */
export function projectFilePath(workspaceRoot: string): string {
  return join(toolsDirUnder(workspaceRoot), "project.json");
}

export type ProjectIdRead = { present: true; projectId: string } | { present: false; path: string };

/** Reads the workspace's project id. An absent file is a normal answer; a
 * present one that does not hold a project id is refused by name. */
export function readProjectId(workspaceRoot: string): ProjectIdRead {
  const path = projectFilePath(workspaceRoot);
  if (!existsSync(path)) return { present: false, path };
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new AnnoProjectFileError(
      `${path} is not valid JSON -- refusing to guess this project's id. Restore the file, or delete it to start a new, empty project.`,
    );
  }
  const id = typeof doc === "object" && doc !== null ? (doc as Record<string, unknown>).project_id : undefined;
  try {
    return { present: true, projectId: assertProjectId(id) };
  } catch {
    throw new AnnoProjectFileError(
      `${path} holds no valid project_id (${JSON.stringify(id)}) -- refusing to guess this project's id. Restore the file, or delete it ` +
        "to start a new, empty project.",
    );
  }
}

/** A fresh project id. */
export function mintProjectId(): string {
  return randomUUID();
}

/**
 * Persists \`projectId\` as the workspace's id unless one is already there,
 * and returns the id the file holds afterwards. Created atomically and
 * owner-only: the content lands in a temp file first, and a hard link puts it
 * in place only if no file exists yet -- so two concurrent first writes agree
 * on one id instead of the second overwriting the first.
 */
export function persistProjectId(workspaceRoot: string, projectId: string): string {
  const path = projectFilePath(workspaceRoot);
  const dir = toolsDirUnder(workspaceRoot);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.project.json.tmp-${process.pid}-${randomUUID()}`);
  writeFileSync(tmp, "");
  chmodSync(tmp, 0o600);
  writeFileSync(tmp, `${JSON.stringify({ project_id: assertProjectId(projectId) }, null, 2)}\n`);
  try {
    linkSync(tmp, path);
    return projectId;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    const winner = readProjectId(workspaceRoot);
    if (!winner.present) throw new AnnoProjectFileError(`${path} vanished while this call was creating it -- nothing was written, retry the call.`);
    return winner.projectId;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // the temp name is unique to this call; a leftover is harmless
    }
  }
}
