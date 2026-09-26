#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from anno-worker.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
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
import { openAnnoDatabase, projectStore } from "./anno-store.mjs";
import { AnnoProjectError } from "./anno-types.mjs";
import { runAnnoToolOnHandle } from "./anno-tools.mjs";
import { AnnoReportRefusal, runAnnoReportOnHandle } from "./anno-reports.mjs";
function errMsg(err) {
    return err instanceof Error ? err.message : String(err);
}
/** What replaces the database's path in anything this worker posts. */
export const ANNO_DB_PATH_TOKEN = "<annotation database>";
/** Answers one request against `adb`. Never throws, and never posts the
 * database's path. */
export async function answerAnnoRequest(adb, req) {
    const reply = await answer(adb, req);
    const redact = (text) => text.split(adb.path).join(ANNO_DB_PATH_TOKEN);
    if (!reply.ok)
        return { ...reply, message: redact(reply.message) };
    if (reply.kind === "tool") {
        return { ...reply, result: { ...reply.result, content: reply.result.content.map((c) => ({ ...c, text: redact(c.text) })) } };
    }
    return reply;
}
async function answer(adb, req) {
    const id = req.id;
    let handle;
    try {
        handle = projectStore(adb, req.projectId, { create: req.kind === "register" && req.create });
    }
    catch (err) {
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
    if (req.kind === "register")
        return { id, ok: true, kind: "register" };
    const inputs = new Map(req.inputs);
    if (req.kind === "tool") {
        return { id, ok: true, kind: "tool", result: await runAnnoToolOnHandle(handle, req.name, req.args, inputs) };
    }
    try {
        const report = await runAnnoReportOnHandle(handle, req.name, req.args, inputs);
        return { id, ok: true, kind: "report", json: report.json, files: report.files };
    }
    catch (err) {
        return { id, ok: false, code: err instanceof AnnoReportRefusal ? "refused" : "failed", message: errMsg(err) };
    }
}
function isWorkerData(value) {
    return typeof value === "object" && value !== null && typeof value.annoDbPath === "string";
}
if (!isMainThread && parentPort !== null && isWorkerData(workerData)) {
    const port = parentPort;
    const dbPath = workerData.annoDbPath;
    mkdirSync(dirname(dbPath), { recursive: true });
    // The path comes from the broker's own home, never from a caller.
    const adb = openAnnoDatabase(dbPath, { unconfinedModuleDerivedPath: true });
    let chain = Promise.resolve();
    port.on("message", (req) => {
        chain = chain.then(async () => {
            port.postMessage(await answerAnnoRequest(adb, req));
        });
    });
}
