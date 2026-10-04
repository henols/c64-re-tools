// The c64-re-tools CLI from the build: install and uninstall the skills and
// the MCP declaration in a project through AP SDK, and report status.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

const cli = resolve(import.meta.dirname, "../../dist/cli/main.js");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-cli-"));
after(() => rmSync(project, { recursive: true, force: true }));

const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });

test("install puts the skills and the MCP declaration into the project; uninstall removes them", () => {
  const installed = run("install", "--target", "claude");
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  assert.ok(existsSync(join(project, ".claude", "skills", "c64-emulator", "SKILL.md")));
  assert.ok(existsSync(join(project, ".claude", "skills", "c64-disk", "scripts", "disk.js")));
  assert.deepEqual(JSON.parse(readFileSync(join(project, ".mcp.json"), "utf8")), { mcpServers: { "c64-re-tools": { command: "c64-re-tools-mcp" } } });

  assert.equal(run("update", "--target", "claude").status, 0, "an update installs again over the old files");

  const removed = run("uninstall", "--target", "claude");
  assert.equal(removed.status, 0, removed.stdout + removed.stderr);
  assert.equal(existsSync(join(project, ".claude", "skills", "c64-emulator")), false);
});

test("status reports the version, the tools here and a Host Runtime that does not answer", () => {
  const status = run("status");
  assert.equal(status.status, 0);
  assert.match(status.stdout, /^c64-re-tools \S+/);
  // Found or missing, each tool that skill scripts run here has a line.
  assert.match(status.stdout, /Tools here:\n {2}ACME: .+\n {2}dxa: .+\n {2}Ghidra: .+\n/);
  assert.match(status.stdout, /Host Runtime: not reachable/);
});

test("an unknown command or option exits 2 with the help", () => {
  assert.equal(run("doctor").status, 2);
  assert.equal(run("install", "--force").status, 2);
});
