// driver.test.ts -- the lookup CLI and its refusal shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skills", "c64-memory-map", "scripts", "driver.ts");

function run(...argv: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...argv], { encoding: "utf8", timeout: 30_000 });
  return { status: r.status, stdout: r.stdout };
}

test("lookup prints the prose for a register", () => {
  const r = run("lookup", "$D020");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /=== \$D020 ===/);
});

test("a bad address is a JSON refusal with exit code 1, not a stack trace", () => {
  const r = run("lookup", "$ZZ");
  assert.equal(r.status, 1);
  const result = JSON.parse(r.stdout.trim().split("\n").pop() ?? "");
  assert.equal(result.ok, false);
  assert.match(result.message, /bad address/);
});

test("an unknown command is a JSON refusal, and no command prints the usage", () => {
  const unknown = run("frobnicate");
  assert.equal(unknown.status, 1);
  assert.equal(JSON.parse(unknown.stdout.trim().split("\n").pop() ?? "").ok, false);
  const none = run();
  assert.equal(none.status, 0);
  assert.match(none.stdout, /usage: node driver\.ts/);
});
