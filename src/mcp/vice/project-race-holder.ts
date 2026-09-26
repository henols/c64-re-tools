// project-race-holder.ts -- TEST SUPPORT, not shipped. A worker thread for
// anno-workspace-store.test.ts: it takes the database's write lock, inserts a
// project WITHOUT committing, reports "held", and commits HOLD_MS later -- the
// one interleaving that two racing first writes can produce.
import { parentPort, workerData } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";

const { dbPath, projectId, holdMs } = workerData as { dbPath: string; projectId: string; holdMs: number };
const db = new DatabaseSync(dbPath, { timeout: 5_000 });
db.exec("begin immediate");
db.prepare("insert into anno_project(project_id, revision) values (?, 0)").run(projectId);
parentPort!.postMessage("held");
setTimeout(() => {
  db.exec("commit");
  db.close();
  parentPort!.postMessage("committed");
}, holdMs);
