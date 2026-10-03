import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

// Runs the built executables, so `pnpm build` must come first.
const root = resolve(import.meta.dirname, "../..");

for (const [name, entry] of [
  ["c64-re-tools", "dist/cli/main.js"],
  ["c64-re-tools-mcp", "dist/mcp/main.js"],
  ["c64-re-tools-host", "dist/host/main.js"],
] as const) {
  test(`${name} --help exits 0 and names the executable`, () => {
    const run = spawnSync(process.execPath, [entry, "--help"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(name));
  });
}
