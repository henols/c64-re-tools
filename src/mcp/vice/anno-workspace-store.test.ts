// anno-workspace-store.test.ts -- the project's own annotations.db: where it
// is, when it is created, and what is refused rather than guessed.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import { runAnnoTool } from "./anno-call-client.ts";
import { runAnnoCli } from "./anno-cli.ts";
import { annoDbPath, workspaceStoreRunner } from "./anno-workspace-store.ts";
import { closeAnnoDatabase, listLabels, openAnnoDatabase, projectStore, soleProjectStore } from "./anno-store.mts";

const HERE = dirname(fileURLToPath(import.meta.url));

async function withWorkspace<T>(fn: (ws: string) => Promise<T>): Promise<T> {
  const ws = mkdtempSync(join(tmpdir(), "anno-workspace-store-"));
  try {
    return await fn(ws);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}

async function withCapturedConsole<T>(fn: () => Promise<T>): Promise<{ result: T; stdout: string; stderr: string }> {
  const origLog = console.log;
  const origError = console.error;
  const out: string[] = [];
  const err: string[] = [];
  console.log = (...args: unknown[]) => void out.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => void err.push(args.map(String).join(" "));
  try {
    const result = await fn();
    return { result, stdout: out.join("\n"), stderr: err.join("\n") };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

/** Every project id the file holds. */
function projectIds(path: string): string[] {
  const adb = openAnnoDatabase(path, { unconfinedModuleDerivedPath: true });
  try {
    return (adb.db.prepare("select project_id from anno_project order by project_id").all() as { project_id: string }[]).map((r) => r.project_id);
  } finally {
    closeAnnoDatabase(adb);
  }
}

const deps = (ws: string) => ({ runAnno: workspaceStoreRunner({ workspaceRoot: ws }), workspaceRoot: ws });

test("the database is the workspace's .c64-re-tools/annotations.db", () => {
  assert.equal(annoDbPath("/work/game"), join("/work/game", ".c64-re-tools", "annotations.db"));
});

test("a read with no annotations.db is refused naming the file, and creates nothing -- a tool and a report alike", async () => {
  await withWorkspace(async (ws) => {
    const tool = await runAnnoTool("anno_get_symbols", { max_results: 10 }, deps(ws));
    assert.equal(tool.isError, true);
    assert.match(tool.content[0]!.text, /anno_get_symbols failed: \[AnnoProjectError\] anno_get_symbols refused: this workspace has no annotation project yet/);
    assert.ok(tool.content[0]!.text.includes(annoDbPath(ws)), "the refusal names the file it looked for");

    const report = await withCapturedConsole(() => runAnnoCli(["evid-disagreements"], deps(ws)));
    assert.notEqual(report.result, 0);
    assert.match(report.stderr, /^evid-disagreements refused: this workspace has no annotation project yet/);

    assert.equal(existsSync(join(ws, ".c64-re-tools")), false, "a read must create neither the file nor its directory");
  });
});

test("the first write creates annotations.db with ONE project, and later writes land in that same project", async () => {
  await withWorkspace(async (ws) => {
    const first = await runAnnoTool("anno_set_label_name", { address: 0xc000, name: "first" }, deps(ws));
    assert.equal(first.isError, false, first.content[0]!.text);
    const ids = projectIds(annoDbPath(ws));
    assert.equal(ids.length, 1);

    const second = await runAnnoTool("anno_set_label_name", { address: 0xc001, name: "second" }, deps(ws));
    assert.equal(second.isError, false, second.content[0]!.text);
    assert.deepEqual(projectIds(annoDbPath(ws)), ids, "a later write must not mint another project");

    const adb = openAnnoDatabase(annoDbPath(ws), { unconfinedModuleDerivedPath: true });
    try {
      assert.deepEqual(listLabels(soleProjectStore(adb)).map((l) => l.name).sort(), ["first", "second"]);
    } finally {
      closeAnnoDatabase(adb);
    }
  });
});

test("a file that holds more than one project is refused by name, never picked from, and left unchanged", async () => {
  await withWorkspace(async (ws) => {
    mkdirSync(join(ws, ".c64-re-tools"));
    const adb = openAnnoDatabase(annoDbPath(ws), { unconfinedModuleDerivedPath: true });
    projectStore(adb, "11111111-1111-4111-8111-111111111111", { create: true });
    projectStore(adb, "22222222-2222-4222-8222-222222222222", { create: true });
    closeAnnoDatabase(adb);
    const before = readFileSync(annoDbPath(ws));

    for (const [name, args] of [
      ["anno_get_symbols", { max_results: 10 }],
      ["anno_set_label_name", { address: 0xc000, name: "x" }],
    ] as const) {
      const result = await runAnnoTool(name, args, deps(ws));
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /holds 2 projects/);
      assert.match(result.content[0]!.text, /refuses to pick one/);
    }
    assert.deepEqual(readFileSync(annoDbPath(ws)), before);
  });
});

test("a file that is not an annotation database is refused, and never overwritten", async () => {
  await withWorkspace(async (ws) => {
    mkdirSync(join(ws, ".c64-re-tools"));
    writeFileSync(annoDbPath(ws), "not a database at all, just text that happens to sit here\n");
    const before = readFileSync(annoDbPath(ws));
    const result = await runAnnoTool("anno_set_label_name", { address: 0xc000, name: "x" }, deps(ws));
    assert.equal(result.isError, true);
    assert.deepEqual(readFileSync(annoDbPath(ws)), before, "a refused open must leave the file as it was");
  });
});

test("a .c64-re-tools that is a symlink out of the workspace is refused by the confinement seam, and nothing is written there", async () => {
  await withWorkspace(async (ws) => {
    await withWorkspace(async (outside) => {
      symlinkSync(outside, join(ws, ".c64-re-tools"));
      const result = await runAnnoTool("anno_set_label_name", { address: 0xc000, name: "x" }, deps(ws));
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /outside the workspace root/);
      assert.equal(existsSync(join(outside, "annotations.db")), false);
    });
  });
});

test("a first write racing another agrees on ONE project: the check is repeated under the write lock", async () => {
  await withWorkspace(async (ws) => {
    const path = annoDbPath(ws);
    mkdirSync(dirname(path), { recursive: true });
    closeAnnoDatabase(openAnnoDatabase(path, { unconfinedModuleDerivedPath: true }));

    // The other writer: it has inserted its project under the write lock but
    // not committed, so a plain read here still sees no project at all.
    const rival = "33333333-3333-4333-8333-333333333333";
    const holder = new Worker(new URL("./project-race-holder.ts", import.meta.url), { workerData: { dbPath: path, projectId: rival, holdMs: 1_000 } });
    const committed = new Promise<void>((resolveCommit, rejectCommit) => {
      holder.on("message", (m) => m === "committed" && resolveCommit());
      holder.on("error", rejectCommit);
    });
    await new Promise<void>((resolveHeld) => holder.on("message", (m) => m === "held" && resolveHeld()));

    const adb = openAnnoDatabase(path, { unconfinedModuleDerivedPath: true });
    try {
      assert.equal(projectIds(path).length, 0, "precondition: the rival's project is not visible yet");
      const handle = soleProjectStore(adb, { create: true });
      assert.equal(handle.projectId, rival, "the second writer must adopt the project the first one committed");
    } finally {
      closeAnnoDatabase(adb);
    }
    await committed;
    await holder.terminate();
    assert.deepEqual(projectIds(path), [rival], "exactly one project");
  });
});
