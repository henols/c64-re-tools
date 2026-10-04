// The AP SDK plugin: every bundled skill with its scripts and references,
// and the VICE MCP declaration. Needs the build (pnpm test builds first).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import plugin, { MCP_COMMAND } from "../../distribution/plugin.ts";

const root = resolve(import.meta.dirname, "../..");

test("the plugin holds every skill with its bundled scripts and references", () => {
  assert.equal(plugin.id, "c64-re-tools");
  const names = plugin.skills!.map((skill) => skill.name);
  assert.deepEqual(names, readdirSync(resolve(root, "skills")).sort());
  const testing = plugin.skills!.find((skill) => skill.name === "c64-testing")!;
  assert.deepEqual(testing.resources!.map((resource) => [resource.path, resource.executable === true]), [
    ["scripts/checklist.js", true],
    ["scripts/test.js", true],
    ["references/scenario-format.md", false],
  ]);
  for (const skill of plugin.skills!) {
    assert.ok(skill.description.length > 40, skill.name);
    assert.doesNotMatch(skill.instructions, /^---/, `${skill.name}: the body has no frontmatter`);
    assert.doesNotMatch(skill.instructions, /scripts\/[a-z-]+\.ts/, `${skill.name}: the body runs the bundled .js scripts`);
  }
});

test("the MCP server is the installed binary, never npx", () => {
  assert.deepEqual(plugin.mcpServers, { "c64-re-tools": { command: MCP_COMMAND } });
  assert.equal(MCP_COMMAND, "c64-re-tools-mcp");
});

test("AP SDK accepts the built plugin module", () => {
  // The CLI module itself, through node: the .bin shim is a shell script that Windows cannot run.
  const cli = resolve(dirname(fileURLToPath(import.meta.resolve("@jalco/ap-sdk"))), "cli.js");
  const check = spawnSync(process.execPath, [cli, "check", "dist/plugin.js"], { cwd: root, encoding: "utf8" });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.match(check.stdout, /is valid \(\d+ skill\(s\)/);
});
