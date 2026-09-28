// workspace-store-fixture.ts -- TEST SUPPORT, not shipped (absent from
// package.json files[] on purpose; its name matches neither the *.test.* glob
// nor the anno-* prefix anno-seam.test.ts derives the shipped set from).
//
// A workspace's annotation project for a test: the database opened for
// populating and inspecting through `handle`, and the REAL runner the client
// uses, pointed at the same file. The file is the workspace's own
// .c64-re-tools/annotations.db unless the test names another with `dbPath`.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { closeAnnoDatabase, openAnnoDatabase, projectStore, soleProjectStore, type AnnoDatabase, type AnnoStoreHandle } from "../../src/mcp/vice/anno-store.mts";
import { annoDbPath, workspaceStoreRunner, type RunAnno } from "../../src/mcp/vice/anno-workspace-store.ts";

export interface TestProject {
  adb: AnnoDatabase;
  projectId: string;
  /** The project, for populating and inspecting it directly. */
  handle: AnnoStoreHandle;
  /** The client's own runner over the same file. */
  runAnno: RunAnno;
  close(): void;
}

export interface TestProjectOptions {
  /** Use this database file instead of the workspace's annotations.db. With
   * `projectId: FILE_STORE_PROJECT_ID`, a file `openStore(dbPath)` built is
   * served as it is. */
  dbPath?: string;
  /** Bind this project id instead of the file's sole (or a new) project. */
  projectId?: string;
}

/** Opens -- creating it when absent -- `workspace`'s annotation project. */
export function openTestProject(workspace: string, options: TestProjectOptions = {}): TestProject {
  const path = options.dbPath ?? annoDbPath(workspace);
  mkdirSync(dirname(path), { recursive: true });
  const adb = openAnnoDatabase(path, { unconfinedModuleDerivedPath: true });
  const handle = options.projectId === undefined ? soleProjectStore(adb, { create: true }) : projectStore(adb, options.projectId, { create: true });
  return {
    adb,
    projectId: handle.projectId,
    handle,
    runAnno: workspaceStoreRunner({ workspaceRoot: workspace, dbPath: options.dbPath }),
    close: () => closeAnnoDatabase(adb),
  };
}

/** Seeds `workspace`'s own annotations.db through `seed`, then closes it --
 * for a test whose client is a spawned CLI reading that workspace. */
export function seedWorkspaceProject(workspace: string, seed: (handle: AnnoStoreHandle) => void): string {
  const project = openTestProject(workspace);
  try {
    seed(project.handle);
    return project.projectId;
  } finally {
    project.close();
  }
}
