// project-local.test.ts -- a project's .c64-re-tools/ splits into committed
// artifacts at its root and a never-committed local/ that ignores itself.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ensureLocalDir, LOCAL_GITIGNORE, localDirUnder } from "./project-local.mts";
import { annoDbPath } from "./anno-workspace-store.ts";
import { toolsJsonPath } from "./tool-location.mts";
import { installTargetDir } from "./install-resources.ts";
import { snapshotPathFor, transferKindDir } from "./transfer-paths.ts";

function withDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "project-local-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("ensureLocalDir creates local/ with a .gitignore of everything, and leaves an existing .gitignore alone", () => {
  withDir((dir) => {
    const toolsDir = join(dir, ".c64-re-tools");
    const local = ensureLocalDir(toolsDir);
    assert.equal(local, localDirUnder(toolsDir));
    assert.equal(readFileSync(join(local, ".gitignore"), "utf8"), LOCAL_GITIGNORE);

    writeFileSync(join(local, ".gitignore"), "# mine\n*\n");
    ensureLocalDir(toolsDir);
    assert.equal(readFileSync(join(local, ".gitignore"), "utf8"), "# mine\n*\n", "a second call must not rewrite it");
  });
});

test("committing .c64-re-tools/ wholesale takes the artifacts and leaves local/ out -- measured with real git", () => {
  withDir((dir) => {
    const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" as const });
    const init = git("init", "-q");
    if (init.error !== undefined) return; // no git on PATH: nothing to measure
    const toolsDir = join(dir, ".c64-re-tools");
    mkdirSync(toolsDir, { recursive: true });
    writeFileSync(annoDbPath(dir), "db");
    const local = ensureLocalDir(toolsDir);
    mkdirSync(join(local, "bin"), { recursive: true });
    writeFileSync(join(local, "bin", "vice-launcher.sh"), "#!/bin/sh\n");
    writeFileSync(join(local, "tools.json"), "{}");

    const added = git("add", "--dry-run", ".c64-re-tools");
    assert.equal(added.status, 0, added.stderr);
    const paths = added.stdout.trim().split("\n").map((l) => l.replace(/^add '(.*)'$/, "$1"));
    assert.deepEqual(paths, [".c64-re-tools/annotations.db"], "only the artifact may be staged");
  });
});

test("every tool-written location is under local/, and the annotation store is not", () => {
  withDir((dir) => {
    const toolsDir = join(dir, ".c64-re-tools");
    const local = localDirUnder(toolsDir);
    assert.ok(toolsJsonPath(toolsDir).startsWith(local + "/"), "tools.json is this machine's");
    assert.ok(installTargetDir(dir).startsWith(local + "/"), "deployed launchers are this machine's");
    assert.ok(!annoDbPath(dir).startsWith(local + "/"), "the annotation store is a project artifact");
    assert.equal(existsSync(local), false, "computing the paths creates nothing");
  });
});

test("snapshot and host-tool result directories resolve under the project's local/ and create it with its .gitignore", () => {
  withDir((dir) => {
    const previous = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = dir;
    try {
      const local = localDirUnder(join(dir, ".c64-re-tools"));
      assert.equal(snapshotPathFor("s1"), join(local, "snapshots", "s1.vsf"));
      assert.equal(transferKindDir("dxa"), join(local, "dxa"));
      assert.ok(existsSync(join(local, ".gitignore")));
    } finally {
      if (previous === undefined) delete process.env.CLAUDE_PROJECT_DIR;
      else process.env.CLAUDE_PROJECT_DIR = previous;
    }
  });
});
