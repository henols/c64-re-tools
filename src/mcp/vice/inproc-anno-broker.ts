// inproc-anno-broker.ts -- TEST SUPPORT, not shipped (absent from package.json
// files[] on purpose, its name matches neither the *.test.* glob nor the anno-*
// prefix anno-seam.test.ts derives the shipped set from).
//
// An in-process stand-in for the broker's annotation route: a temp database
// outside the workspace, one project registered in it and named by the
// workspace's .c64-re-tools/project.json, and a runner that answers every call
// through the SAME `answerAnnoRequest()` the broker's worker runs. Only the
// transport is replaced: arguments go through JSON exactly as the staged
// args.json does, and each input file arrives as its basename and bytes.
//
// A test populates the project through `handle` with the store functions,
// then drives the client (`runAnnoTool`, `runAnnoCli`) with `runRemote`.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { closeAnnoDatabase, openAnnoDatabase, projectStore, type AnnoDatabase, type AnnoStoreHandle } from "./anno-store.mts";
import { answerAnnoRequest } from "./anno-worker.mts";
import { brokerAnnoDbPath } from "./broker-home.mts";
import { mintProjectId, persistProjectId } from "./anno-project.ts";
import type { AnnoRemoteCall, AnnoRemoteResult } from "./anno-remote.ts";

export interface TestAnnoBroker {
  /** The temp database, outside the workspace. */
  adb: AnnoDatabase;
  /** The workspace's project, registered and persisted. */
  projectId: string;
  /** A handle on that project, for populating it directly. */
  handle: AnnoStoreHandle;
  /** Answers a call the way the broker would. */
  runRemote: (call: AnnoRemoteCall) => Promise<AnnoRemoteResult>;
  close(): void;
}

let nextId = 1;

/** Answers `call` against `adb` through the worker's own answering code. */
export async function answerInProcess(adb: AnnoDatabase, call: AnnoRemoteCall): Promise<AnnoRemoteResult> {
  const inputs = Object.entries(call.files).map(([slot, path]) => [slot, { name: basename(path), bytes: new Uint8Array(readFileSync(path)) }] as [string, { name: string; bytes: Uint8Array }]);
  const reply = await answerAnnoRequest(adb, {
    id: nextId++,
    projectId: call.projectId,
    create: call.kind === "register",
    kind: call.kind,
    name: call.name,
    args: JSON.parse(JSON.stringify(call.args)) as unknown,
    inputs,
  });
  if (!reply.ok) return { ok: false, code: reply.code, message: reply.message };
  if (reply.kind === "register") return { ok: true, type: "register" };
  if (reply.kind === "tool") return { ok: true, type: "tool", result: reply.result };
  return { ok: true, type: "report", json: JSON.parse(JSON.stringify(reply.json)) as unknown, files: reply.files };
}

export interface TestAnnoBrokerOptions {
  /** Leave the workspace without a project.json -- the state a first write
   * starts from. */
  register?: boolean;
  /** Put the database here instead of a temp directory. With `projectId`
   * set to `FILE_STORE_PROJECT_ID`, `openStore(dbPath)` then opens the very
   * project the client annotates, so a test can inspect it directly. */
  dbPath?: string;
  /** The project id; minted when omitted. */
  projectId?: string;
}

/**
 * Seeds a project in a REAL broker's own annotation database -- the one under
 * `brokerHomeDir`, e.g. a harness broker's `home` -- and persists its id into
 * `workspace`'s .c64-re-tools/project.json, for a test whose client is a
 * spawned CLI that dials that broker. `seed` populates the project through
 * the store functions; the database is closed before this returns, so the
 * broker's worker is the only connection left.
 */
export function seedBrokerProject(brokerHomeDir: string, workspace: string, seed: (handle: AnnoStoreHandle) => void): string {
  const dbPath = brokerAnnoDbPath({ env: { VICE_BROKER_HOME: brokerHomeDir } });
  mkdirSync(dirname(dbPath), { recursive: true });
  const adb = openAnnoDatabase(dbPath, { unconfinedModuleDerivedPath: true });
  try {
    const projectId = mintProjectId();
    seed(projectStore(adb, projectId, { create: true }));
    persistProjectId(workspace, projectId);
    return projectId;
  } finally {
    closeAnnoDatabase(adb);
  }
}

/**
 * Opens an annotation database, registers a project in it and persists that
 * project's id into `workspace`'s .c64-re-tools/project.json -- unless
 * `register: false`.
 */
export function openTestAnnoBroker(workspace: string, options: TestAnnoBrokerOptions = {}): TestAnnoBroker {
  const dbDir = options.dbPath === undefined ? mkdtempSync(join(tmpdir(), "inproc-anno-broker-")) : undefined;
  const adb = openAnnoDatabase(options.dbPath ?? join(dbDir!, "annotations.db"), { unconfinedModuleDerivedPath: true });
  const projectId = options.projectId ?? mintProjectId();
  const handle = projectStore(adb, projectId, { create: true });
  if (options.register !== false) persistProjectId(workspace, projectId);
  return {
    adb,
    projectId,
    handle,
    runRemote: (call) => answerInProcess(adb, call),
    close: () => {
      closeAnnoDatabase(adb);
      if (dbDir !== undefined) rmSync(dbDir, { recursive: true, force: true });
    },
  };
}
