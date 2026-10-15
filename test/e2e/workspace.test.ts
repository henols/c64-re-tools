// M19.5: one repository with a folder for each program, and the skill scripts
// run from its root as the agent runs them (D67, D68, D70). The MCP side of
// the same rules is in src/mcp/server.test.ts.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

const skills = resolve(import.meta.dirname, "../../skills");
const workspace = realpathSync(mkdtempSync(join(tmpdir(), "c64-re-tools-workspace-")));
after(() => rmSync(workspace, { recursive: true, force: true }));
for (const name of ["hover-bovver", "boulder-dash"]) mkdirSync(join(workspace, name));

/** Runs a skill script in `cwd` (the workspace root by default) and gives its exit status and its one JSON line. */
function script(skill: string, file: string, args: readonly string[], options: { cwd?: string; input?: string } = {}): { status: number | null; json: Record<string, unknown> } {
  const run = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", file), ...args], {
    cwd: options.cwd ?? workspace,
    encoding: "utf8",
    ...(options.input === undefined ? {} : { input: options.input }),
  });
  assert.equal(run.stderr, "", run.stderr);
  return { status: run.status, json: JSON.parse(run.stdout) as Record<string, unknown> };
}

const knowledge = (args: readonly string[], options: { cwd?: string; input?: string } = {}) => script("c64-knowledge", "knowledge.ts", args, options);

test("from the workspace root, scripts write into the project that --project names, and never at the root", () => {
  assert.equal(knowledge(["rename", "$c000", "start", "--project", "hover-bovver"]).status, 0);
  assert.equal(knowledge(["--project=boulder-dash", "rename", "$1000", "init"]).status, 0);
  for (const name of ["hover-bovver", "boulder-dash"]) {
    assert.ok(existsSync(join(workspace, name, ".c64-re-tools", "knowledge", "symbols.jsonl")), name);
    assert.match(readFileSync(join(workspace, name, ".c64-re-tools", "local", ".gitignore"), "utf8"), /^\*$/m, `${name}: local/ ignores itself`);
  }

  const batch = JSON.stringify([{ op: "comment", address: "$c000", placement: "line", text: "Entry." }]);
  assert.equal(knowledge(["apply", "-", "--project", "hover-bovver"], { input: batch }).status, 0);
  assert.equal(script("c64-memory-map", "memmap.ts", ["export", "--out", "src/hw.asm", "--project", "boulder-dash"]).status, 0);
  assert.ok(existsSync(join(workspace, "boulder-dash", "src", "hw.asm")));

  assert.equal(knowledge(["export", "--out", "exports/knowledge.json", "--project", "hover-bovver"]).status, 0);
  const exported = readFileSync(join(workspace, "hover-bovver", "exports", "knowledge.json"), "utf8");
  assert.ok(!exported.includes(workspace) && !exported.includes("hover-bovver/"), "no path with the folder name inside the project");

  assert.deepEqual(readdirSync(workspace).sort(), ["boulder-dash", "hover-bovver"], "nothing is written at the workspace root");
});

test("without --project, the root refuses and lists the projects, and a folder in a project finds it", () => {
  const refused = knowledge(["symbols"]);
  assert.equal(refused.status, 1);
  const { error } = refused.json as { error: { code: string; message: string } };
  assert.equal(error.code, "invalid-input");
  assert.match(error.message, /These folders below it are projects: boulder-dash, hover-bovver\. Give --project <folder> with one of them\./);

  const inside = join(workspace, "hover-bovver", "src", "parts");
  mkdirSync(inside, { recursive: true });
  const found = knowledge(["symbols"], { cwd: inside });
  assert.equal(found.status, 0);
  assert.deepEqual((found.json.symbols as Array<{ name: string }>).map((symbol) => symbol.name), ["start"]);

  const nested = knowledge(["symbols", "--project", join("hover-bovver", "src")]);
  assert.equal(nested.status, 1);
  assert.match((nested.json.error as { message: string }).message, /inside the project hover-bovver\. Give that project folder\./);
  assert.ok(!existsSync(join(workspace, "hover-bovver", "src", ".c64-re-tools")));
});
