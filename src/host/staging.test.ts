import assert from "node:assert/strict";
import { existsSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { WireFailure } from "../protocol.ts";
import { Workspace } from "./staging.ts";

test("a tree materializes as ordinary files inside the workspace and the workspace is removed", () => {
  const workspace = Workspace.create();
  const source = workspace.materialize("source", [{ path: "main.a", size: 1 }, { path: "lib/x.a", size: 2 }], [Buffer.from("m"), Buffer.from("xx")]);
  assert.equal(readFileSync(join(source, "lib", "x.a"), "utf8"), "xx");
  const out = workspace.directory("out");
  assert.ok(existsSync(out));
  workspace.remove();
  assert.equal(existsSync(workspace.root), false);
});

test("a path that leaves the workspace or reuses a file is refused", { skip: process.platform === "win32" ? "planting a symbolic link needs extra rights on Windows" : false }, () => {
  const workspace = Workspace.create();
  try {
    assert.throws(() => workspace.path("../x"), WireFailure);
    assert.throws(() => workspace.path("/etc/passwd"), WireFailure);
    workspace.materialize("source", [{ path: "a.a", size: 1 }], [Buffer.from("a")]);
    // A link planted in the workspace is not written through.
    symlinkSync("/tmp", join(workspace.root, "source", "b.a"));
    assert.throws(() => workspace.materialize("source", [{ path: "b.a", size: 1 }], [Buffer.from("b")]), /EEXIST/);
  } finally {
    workspace.remove();
  }
});
