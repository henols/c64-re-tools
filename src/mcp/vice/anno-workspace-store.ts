// anno-workspace-store.ts
//
// WHY THIS FILE EXISTS: the one place an annotation call reaches the
// project's database. A project's annotations are an artifact of that
// project: one SQLite file, <project>/.c64-re-tools/annotations.db, committed
// with the rest of the project. This module opens it in-process for one call,
// runs the tool or report against its one project, and closes it.
//
// WHAT NOT TO DO:
//   - Never create the file on a read. A read with no annotations.db is
//     refused by name, so "nothing annotated yet" never reads as an empty
//     answer.
//   - Never take the database path from a caller argument. It derives from
//     the workspace root; only a test passes `dbPath`.
//   - Never pick one of several projects in a file. `soleProjectStore()`
//     refuses a file that holds more than one.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { closeAnnoDatabase, openAnnoDatabase, soleProjectStore } from "./anno-store.mts";
import { runAnnoToolOnHandle, type AnnoInputFile, type AnnoInputs, type ToolCallResult } from "./anno-tools.mts";
import { AnnoReportRefusal, runAnnoReportOnHandle } from "./anno-reports.mts";
import { repoRoot, toolsDirUnder } from "./repo-root.ts";

/** One annotation call. `args` names each input file by slot (`{ $file }`);
 * `files` maps each slot to the local path it reads, already confined. A
 * `read` never creates the project; a `write` creates it on first use. */
export interface AnnoCall {
  mode: "read" | "write";
  kind: "tool" | "report";
  name: string;
  args: Record<string, unknown>;
  files: Record<string, string>;
}

/** The call's answer, with the project it answered for. `code` on a refusal:
 * `no_project` (read with no annotations.db), `refused` (a complete
 * message), `failed` (a message to name after the verb) or `internal`. */
export type AnnoCallResult =
  | { ok: true; type: "tool"; projectId: string; result: ToolCallResult }
  | { ok: true; type: "report"; projectId: string; json: unknown; files: AnnoInputFile[] }
  | { ok: false; code: "no_project" | "refused" | "failed" | "internal"; message: string };

/** Runs one annotation call. Tests replace it, or point it at another file. */
export type RunAnno = (call: AnnoCall) => Promise<AnnoCallResult>;

/** Where a workspace's annotations live. */
export function annoDbPath(workspaceRoot: string): string {
  return join(toolsDirUnder(workspaceRoot), "annotations.db");
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The runner over a workspace's annotations.db -- `workspaceRoot` defaults to
 * `repoRoot()`, read at call time. `dbPath` points it at another file, for a
 * test that builds its database elsewhere.
 */
export function workspaceStoreRunner(opts: { workspaceRoot?: string; dbPath?: string } = {}): RunAnno {
  return async (call) => {
    const root = opts.workspaceRoot ?? repoRoot();
    const path = opts.dbPath ?? annoDbPath(root);
    if (!existsSync(path)) {
      if (call.mode === "read") {
        return {
          ok: false,
          code: "no_project",
          message:
            `this workspace has no annotation project yet (${path} does not exist) -- nothing has been annotated here, so there is ` +
            "nothing to read. The first write creates it.",
        };
      }
      mkdirSync(dirname(path), { recursive: true });
    }

    let inputs: AnnoInputs;
    try {
      inputs = new Map(Object.entries(call.files).map(([slot, file]) => [slot, { name: basename(file), bytes: new Uint8Array(readFileSync(file)) }]));
    } catch (err) {
      return { ok: false, code: "failed", message: errMsg(err) };
    }

    let adb: ReturnType<typeof openAnnoDatabase>;
    try {
      adb =
        opts.dbPath === undefined
          ? openAnnoDatabase(path, { workspaceRoot: root })
          : // A test's own database, which it derived itself.
            openAnnoDatabase(path, { unconfinedModuleDerivedPath: true });
    } catch (err) {
      return { ok: false, code: "failed", message: errMsg(err) };
    }
    try {
      const handle = soleProjectStore(adb, { create: call.mode === "write" });
      if (call.kind === "tool") {
        return { ok: true, type: "tool", projectId: handle.projectId, result: await runAnnoToolOnHandle(handle, call.name, call.args, inputs) };
      }
      try {
        const report = await runAnnoReportOnHandle(handle, call.name, call.args, inputs);
        return { ok: true, type: "report", projectId: handle.projectId, json: report.json, files: report.files };
      } catch (err) {
        return { ok: false, code: err instanceof AnnoReportRefusal ? "refused" : "failed", message: errMsg(err) };
      }
    } catch (err) {
      return { ok: false, code: "failed", message: errMsg(err) };
    } finally {
      closeAnnoDatabase(adb);
    }
  };
}
