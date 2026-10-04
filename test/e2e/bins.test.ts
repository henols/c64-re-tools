import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

// The three programs are TypeScript entry points (D17). Installed through npx
// they sit under node_modules, where Node does not strip types, so their
// shebang runs them with tsx; here Node runs them directly.
const root = resolve(import.meta.dirname, "../..");
const metadata = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { bin: Record<string, string>; dependencies: Record<string, string> };

test("package.json names the three programs, each a TypeScript entry point run by tsx", () => {
  assert.deepEqual(Object.keys(metadata.bin).sort(), ["c64-re-tools", "c64-re-tools-host", "c64-re-tools-mcp"]);
  assert.ok(metadata.dependencies.tsx !== undefined, "tsx is a runtime dependency");
  for (const entry of Object.values(metadata.bin)) {
    assert.match(entry, /^\.\/src\/[a-z-]+\/main\.ts$/);
    assert.match(readFileSync(resolve(root, entry), "utf8"), /^#!\/usr\/bin\/env tsx\n/);
    if (process.platform !== "win32") assert.ok((statSync(resolve(root, entry)).mode & 0o111) !== 0, `${entry} is executable`);
  }
});

for (const [name, entry] of Object.entries(metadata.bin)) {
  test(`${name} --help exits 0 and names the program`, () => {
    const run = spawnSync(process.execPath, [entry, "--help"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(name));
  });
}
