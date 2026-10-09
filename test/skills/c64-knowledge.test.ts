// The c64-knowledge script, run as the LLM runs it: in a project directory,
// with arguments, reading one JSON object from stdout.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

const script = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
const projects: string[] = [];
after(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
});

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-skill-"));
  projects.push(root);
  return root;
}

function knowledge(root: string, ...args: string[]): { status: number | null; json: Record<string, unknown> } {
  const run = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(run.stderr, "", run.stderr);
  return { status: run.status, json: JSON.parse(run.stdout) as Record<string, unknown> };
}

test("reads in a project without knowledge answer empty and create nothing", () => {
  const root = project();
  assert.deepEqual(knowledge(root, "at", "$2100").json, { address: "$2100", comments: [], referencesFrom: [], referencesTo: [], revision: 0 });
  assert.deepEqual(knowledge(root, "symbols").json, { symbols: [] });
  assert.deepEqual(knowledge(root, "revisions").json, { revisions: [] });
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
});

test("writes report their revision and the current value", () => {
  const root = project();
  assert.deepEqual(knowledge(root, "rename", "$2100", "update_player", "--kind", "routine", "--reason", "reads joystick 2").json, {
    revision: 1,
    symbol: { address: "$2100", name: "update_player", kind: "routine", origin: "llm", revision: 1 },
  });
  assert.deepEqual(knowledge(root, "classify", "$3000", "$303f", "sprite", "--origin", "user").json, {
    revision: 2,
    regions: [{ start: "$3000", end: "$303f", type: "sprite", origin: "user", revision: 2 }],
  });
  assert.equal(knowledge(root, "comment", "$2100", "side", "joystick", "2").json.revision, 3);
  assert.equal(knowledge(root, "reference", "$2000", "$2100", "call").json.revision, 4);
  assert.deepEqual(knowledge(root, "rename", "$2100", "update_player").json.revision, null, "no change, no revision");
  const revision = knowledge(root, "revision", "1").json as { revision: { description: string }; added: unknown[] };
  assert.equal(revision.revision.description, "reads joystick 2");
  assert.equal(revision.added.length, 1);
});

test("errors are JSON with a stable code and a non-zero exit", () => {
  const root = project();
  knowledge(root, "rename", "$2100", "loop");
  const conflict = knowledge(root, "rename", "$2200", "loop");
  assert.equal(conflict.status, 1);
  assert.equal((conflict.json.error as { code: string }).code, "conflict");
  const stale = knowledge(root, "rename", "$2300", "other", "--expect-revision", "0");
  assert.equal((stale.json.error as { code: string }).code, "stale-revision");
  for (const args of [["at", "2100"], ["classify", "$1000", "$2000", "music"], ["rename", "$1000", "x", "--origin", "ghidra"], ["bogus"], ["at", "$1000", "--nope"]]) {
    const result = knowledge(root, ...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal((result.json.error as { code: string }).code, "invalid-input");
  }
  assert.equal((knowledge(root, "remove-symbol", "$9999").json.error as { code: string }).code, "not-found");
});

test("a refused write in a project without knowledge creates no knowledge database", () => {
  const root = project();
  for (const args of [["rename", "2100", "loop"], ["classify", "$1000", "$2000", "music"], ["comment", "$2100", "middle", "text"], ["reference", "$2000", "$2100", "jump-to"]]) {
    const result = knowledge(root, ...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal((result.json.error as { code: string }).code, "invalid-input");
    assert.equal(existsSync(join(root, ".c64-re-tools")), false, args.join(" "));
  }
});

test("refused writes of every kind create nothing, and the first accepted write creates the database", () => {
  const root = project();
  for (const args of [
    ["classify", "$1000", "$2000", "music"],
    ["rename", "$2100", "main", "--kind", "loop"],
    ["comment", "$2100"],
    ["rename", "$2100", "9lives"],
    ["remove-symbol", "$2100"],
    ["uncomment", "$2100", "line"],
    ["rename", "$2100", "main", "--expect-revision", "3"],
    ["revert", "7"],
  ]) {
    const result = knowledge(root, ...args);
    assert.notEqual(result.status, 0, args.join(" "));
    assert.ok(result.json.error !== undefined, args.join(" "));
  }
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
  assert.equal(knowledge(root, "rename", "$2100", "main").json.revision, 1);
  assert.equal(existsSync(join(root, ".c64-re-tools", "knowledge.db")), true);
});
