import assert from "node:assert/strict";
import { chmodSync, existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
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

test("a file of the tree without bytes is refused by name", () => {
  const workspace = Workspace.create();
  try {
    assert.throws(
      () => workspace.materialize("source", [{ path: "main.a", size: 1 }, { path: "lib/x.a", size: 2 }], [Buffer.from("m")]),
      (error: unknown) => error instanceof WireFailure && error.code === "invalid-input" && error.message === "The request gives no bytes for lib/x.a.",
    );
  } finally {
    workspace.remove();
  }
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

test("an owned workspace that cannot be removed stays owned and the removal does not throw", { skip: process.platform === "win32" ? "a directory without write permission is POSIX" : process.getuid?.() === 0 ? "root may remove any file" : false }, () => {
  const owned = new Set<string>();
  const owner = { ownPath: (path: string) => (owned.add(path), () => owned.delete(path)) };
  const workspace = Workspace.create(owner);
  const locked = workspace.directory("locked");
  writeFileSync(join(locked, "file"), "x");
  chmodSync(locked, 0o500);
  try {
    workspace.remove();
    assert.ok(owned.has(workspace.root), "the workspace stays owned");
  } finally {
    chmodSync(locked, 0o700);
    workspace.remove();
  }
  assert.equal(existsSync(workspace.root), false);
  assert.equal(owned.size, 0);
});
