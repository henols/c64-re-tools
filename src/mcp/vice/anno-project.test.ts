// anno-project.test.ts -- the workspace's project id in .c64-re-tools/project.json.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { AnnoProjectFileError, mintProjectId, persistProjectId, projectFilePath, readProjectId } from "./anno-project.ts";

function inWorkspace(body: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "anno-project-"));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("an absent project.json is a normal answer, and reading creates nothing", () => {
  inWorkspace((root) => {
    const read = readProjectId(root);
    assert.equal(read.present, false);
    assert.throws(() => statSync(projectFilePath(root)), /ENOENT/, "a read must not create the file");
  });
});

test("persisting writes the id owner-only and reads back the same id", () => {
  inWorkspace((root) => {
    const id = mintProjectId();
    assert.equal(persistProjectId(root, id), id);
    assert.deepEqual(readProjectId(root), { present: true, projectId: id });
    assert.equal(statSync(projectFilePath(root)).mode & 0o777, 0o600);
    assert.deepEqual(
      readdirSync(dirname(projectFilePath(root))).filter((n) => n.startsWith(".project.json.tmp")),
      [],
      "no temp file is left behind",
    );
  });
});

test("a second first write keeps the id already there, so two concurrent first writes agree on one project", () => {
  inWorkspace((root) => {
    const first = mintProjectId();
    const second = mintProjectId();
    persistProjectId(root, first);
    assert.equal(persistProjectId(root, second), first, "the loser adopts the winner's id");
    assert.deepEqual(readProjectId(root), { present: true, projectId: first }, "and the file is not overwritten");
  });
});

test("a malformed or non-UUID project.json is refused by name, never regenerated", () => {
  inWorkspace((root) => {
    const path = projectFilePath(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "{not json");
    assert.throws(() => readProjectId(root), (e: unknown) => e instanceof AnnoProjectFileError && /not valid JSON/.test(e.message));
    writeFileSync(path, JSON.stringify({ project_id: "my-project" }));
    assert.throws(() => readProjectId(root), (e: unknown) => e instanceof AnnoProjectFileError && /no valid project_id/.test(e.message));
    assert.throws(() => persistProjectId(root, mintProjectId()), AnnoProjectFileError, "a first write does not paper over a damaged file");
    assert.equal(readFileSync(path, "utf8"), JSON.stringify({ project_id: "my-project" }), "the damaged file is left exactly as it was");
  });
});
