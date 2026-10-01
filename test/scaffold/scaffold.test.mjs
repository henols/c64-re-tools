import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

import { formatC64Address, parseC64Address } from "../../dist/c64.js";
import { resolveProjectPath } from "../../dist/project.js";
import { HOST_PROTOCOL_ID } from "../../dist/protocol.js";

const root = process.cwd();

test("C64 address primitives use canonical four-digit hexadecimal", () => {
  assert.equal(parseC64Address("$d020"), 0xd020);
  assert.equal(parseC64Address("$D020"), 0xd020);
  assert.equal(formatC64Address(0x2a), "$002a");
  assert.throws(() => parseC64Address("d020"));
  assert.throws(() => formatC64Address(0x10000));
});

test("project paths stay under the harness working directory", () => {
  assert.equal(resolveProjectPath("src/main.a", root), resolve(root, "src/main.a"));
  assert.throws(() => resolveProjectPath("../outside", root), /escapes/);
  assert.throws(() => resolveProjectPath(resolve(root, "absolute"), root), /relative/);
});

test("private protocol has a stable internal identity", () => {
  assert.equal(HOST_PROTOCOL_ID, "c64-re-tools-host");
});

for (const [name, entry] of [
  ["c64-re-tools", "dist/cli/main.js"],
  ["c64-re-tools-mcp", "dist/mcp/main.js"],
  ["c64-re-tools-host", "dist/host/main.js"],
]) {
  test(`${name} exposes scaffold help`, () => {
    const run = spawnSync(process.execPath, [entry, "--help"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(name));
  });
}
