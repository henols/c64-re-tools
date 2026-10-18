import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { zipFiles } from "./zip.ts";
import { readZip } from "./zip.testkit.ts";

const files = [
  { path: "game/src/main.asm", bytes: Buffer.from("; main\n".repeat(200)) },
  { path: "game/README.md", bytes: Buffer.from("# Game\n") },
  { path: "game/baseline/game.prg", bytes: Uint8Array.from([0x01, 0x08, 0xa9]) },
  { path: "game/tests/räksmörgås.json", bytes: Buffer.from("{}\n") },
];

test("the archive holds every file in path order, and reads back to the same bytes", () => {
  const entries = readZip(zipFiles(files));
  assert.deepEqual(entries.map((entry) => entry.path), ["game/README.md", "game/baseline/game.prg", "game/src/main.asm", "game/tests/räksmörgås.json"]);
  for (const file of files) assert.deepEqual(entries.find((entry) => entry.path === file.path)!.bytes, Buffer.from(file.bytes));
  // Text that repeats is deflated; three bytes are stored, because deflate makes them longer.
  assert.equal(entries.find((entry) => entry.path === "game/src/main.asm")!.method, 8);
  assert.equal(entries.find((entry) => entry.path === "game/baseline/game.prg")!.method, 0);
});

test("the same files give the same bytes, in any order", () => {
  assert.deepEqual(zipFiles(files), zipFiles([...files].reverse()));
});

test("a duplicate path and an unsafe path are refused", () => {
  assert.throws(() => zipFiles([files[0]!, files[0]!]), /two times/);
  for (const path of ["/abs", "a/../b", "a\\b", "a//b", ""]) assert.throws(() => zipFiles([{ path, bytes: Buffer.alloc(1) }]), /not a relative path/);
});

test("unzip reads the archive", { skip: spawnSync("unzip", ["-v"]).status !== 0 ? "no unzip on this machine" : false }, () => {
  const folder = mkdtempSync(join(tmpdir(), "zip-test-"));
  try {
    const path = join(folder, "game.zip");
    writeFileSync(path, zipFiles(files));
    const checked = spawnSync("unzip", ["-t", path], { encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
