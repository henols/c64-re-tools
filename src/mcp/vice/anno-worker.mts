#!/usr/bin/env node
// anno-worker.mts
//
// WHY THIS FILE EXISTS: the broker's annotation worker thread. It opens the
// machine's one annotation database, holds the only connection to it, and
// answers one request at a time: bind the request's project, run the tool or
// report against that project's rows, and post the answer back. SQLite's
// calls are synchronous, so running them here keeps a long import or report
// off the broker's event loop, and one connection serialises every writer on
// the machine.
//
// WHAT NOT TO DO:
//   - Never answer two requests at once. They are chained, so one request's
//     writes never interleave with another's.
//   - Never open a second connection, and never let a request name the
//     database: its path comes from the broker, once, at start.
//   - Never create a project on a read. Only a request that says `create`
//     (the client's registration step) may add one.
//   - Never let the database's path out. Store refusals name it, so every
//     message and answer this worker posts has it replaced first.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";

import { openAnnoDatabase, projectStore, type AnnoDatabase } from "./anno-store.mts";
import { AnnoProjectError } from "./anno-types.mts";
import { runAnnoToolOnHandle, type AnnoInputFile, type ToolCallResult } from "./anno-tools.mts";
import { AnnoReportRefusal, runAnnoReportOnHandle } from "./anno-reports.mts";

/** One request, as the broker posts it. */
export interface AnnoWorkerRequest {
  id: number;
  projectId: string;
  /** Register the project when it is unknown. Only the `register` kind sets it. */
  create: boolean;
  kind: "register" | "tool" | "report";
  name: string;
  args: unknown;
  inputs: [string, AnnoInputFile][];
}

/** One answer. `refused` carries a complete message; `failed` a message the
 * client names after the verb; `unknown_project` means the id is not in this
 * database. */
export type AnnoWorkerReply =
  | { id: number; ok: true; kind: "register" }
  | { id: number; ok: true; kind: "tool"; result: ToolCallResult }
  | { id: number; ok: true; kind: "report"; json: unknown; files: AnnoInputFile[] }
  | { id: number; ok: false; code: "unknown_project" | "refused" | "failed" | "internal"; message: string };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** What replaces the database's path in anything this worker posts. */
export const ANNO_DB_PATH_TOKEN = "<annotation database>";

/** Answers one request against `adb`. Never throws, and never posts the
 * database's path. */
export async function answerAnnoRequest(adb: AnnoDatabase, req: AnnoWorkerRequest): Promise<AnnoWorkerReply> {
  const reply = await answer(adb, req);
  const redact = (text: string): string => text.split(adb.path).join(ANNO_DB_PATH_TOKEN);
  if (!reply.ok) return { ...reply, message: redact(reply.message) };
  if (reply.kind === "tool") {
    return { ...reply, result: { ...reply.result, content: reply.result.content.map((c) => ({ ...c, text: redact(c.text) })) } };
  }
  return reply;
}

async function answer(adb: AnnoDatabase, req: AnnoWorkerRequest): Promise<AnnoWorkerReply> {
  const id = req.id;
  let handle: ReturnType<typeof projectStore>;
  try {
    handle = projectStore(adb, req.projectId, { create: req.kind === "register" && req.create });
  } catch (err) {
    if (err instanceof AnnoProjectError) {
      return {
        id,
        ok: false,
        code: "unknown_project",
        message: `project ${JSON.stringify(req.projectId)} is not in the broker's annotation database -- refusing to read it as an empty project`,
      };
    }
    return { id, ok: false, code: "internal", message: errMsg(err) };
  }
  if (req.kind === "register") return { id, ok: true, kind: "register" };

  const inputs = new Map(req.inputs);
  if (req.kind === "tool") {
    return { id, ok: true, kind: "tool", result: await runAnnoToolOnHandle(handle, req.name, req.args, inputs) };
  }
  try {
    const report = await runAnnoReportOnHandle(handle, req.name, req.args, inputs);
    return { id, ok: true, kind: "report", json: report.json, files: report.files };
  } catch (err) {
    return { id, ok: false, code: err instanceof AnnoReportRefusal ? "refused" : "failed", message: errMsg(err) };
  }
}

/** What the broker passes the worker at start. */
export interface AnnoWorkerData {
  annoDbPath: string;
}

function isWorkerData(value: unknown): value is AnnoWorkerData {
  return typeof value === "object" && value !== null && typeof (value as AnnoWorkerData).annoDbPath === "string";
}

if (!isMainThread && parentPort !== null && isWorkerData(workerData)) {
  const port = parentPort;
  const dbPath = workerData.annoDbPath;
  mkdirSync(dirname(dbPath), { recursive: true });
  // The path comes from the broker's own home, never from a caller.
  const adb = openAnnoDatabase(dbPath, { unconfinedModuleDerivedPath: true });
  let chain: Promise<void> = Promise.resolve();
  port.on("message", (req: AnnoWorkerRequest) => {
    chain = chain.then(async () => {
      port.postMessage(await answerAnnoRequest(adb, req));
    });
  });
}
