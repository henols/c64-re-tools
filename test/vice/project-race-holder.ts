// project-race-holder.ts -- TEST SUPPORT, not shipped. A worker thread for
// anno-workspace-store.test.ts, in one of two modes:
//
//   "hold"        takes the database's write lock, inserts a project WITHOUT
//                 committing, reports "held", and commits HOLD_MS later -- the
//                 one interleaving two racing first writes can produce.
//   "first-open"  reports "ready", waits on a shared flag, then opens the
//                 database and its one project with create, and reports the
//                 project id or the error message. Several of these released
//                 together race on a file that does not exist yet.
import { parentPort, workerData } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";

import { closeAnnoDatabase, openAnnoDatabase, soleProjectStore } from "../../src/mcp/vice/anno-store.mts";

type HolderData = { mode?: "hold"; dbPath: string; projectId: string; holdMs: number };
type FirstOpenData = { mode: "first-open"; dbPath: string; flag: SharedArrayBuffer };

const data = workerData as HolderData | FirstOpenData;

if (data.mode === "first-open") {
  const flag = new Int32Array(data.flag);
  parentPort!.postMessage("ready");
  Atomics.wait(flag, 0, 0);
  try {
    const adb = openAnnoDatabase(data.dbPath, { unconfinedModuleDerivedPath: true });
    try {
      parentPort!.postMessage({ ok: true, projectId: soleProjectStore(adb, { create: true }).projectId });
    } finally {
      closeAnnoDatabase(adb);
    }
  } catch (err) {
    parentPort!.postMessage({ ok: false, message: err instanceof Error ? err.message : String(err) });
  }
} else {
  const db = new DatabaseSync(data.dbPath, { timeout: 5_000 });
  db.exec("begin immediate");
  db.prepare("insert into anno_project(project_id, revision) values (?, 0)").run(data.projectId);
  parentPort!.postMessage("held");
  setTimeout(() => {
    db.exec("commit");
    db.close();
    parentPort!.postMessage("committed");
  }, data.holdMs);
}
