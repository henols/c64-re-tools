// project-local.test.ts -- a project's .c64-re-tools/ splits into committed
// artifacts at its root and a never-committed local/ that ignores itself.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ensureLocalDir, LOCAL_GITIGNORE, localDirUnder } from "../../src/mcp/vice/project-local.mts";
import { annoDbPath } from "../../src/mcp/vice/anno-workspace-store.ts";
import { toolsJsonPath } from "../../src/mcp/vice/tool-location.mts";
import { snapshotPathFor } from "../../src/mcp/vice/transfer-paths.ts";

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

test("every tool-written location is under local/, and the annotation store is not", () => {
  withDir((dir) => {
    const toolsDir = join(dir, ".c64-re-tools");
    const local = localDirUnder(toolsDir);
    assert.ok(toolsJsonPath(toolsDir).startsWith(local + "/"), "tools.json is this machine's");
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
      assert.ok(existsSync(join(local, ".gitignore")));
    } finally {
      if (previous === undefined) delete process.env.CLAUDE_PROJECT_DIR;
      else process.env.CLAUDE_PROJECT_DIR = previous;
    }
  });
});
