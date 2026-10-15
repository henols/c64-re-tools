// M20.6: the knowledge of one project in git on two computers (D69). Two
// clones write, git merges the knowledge text without a stop, the reads show
// the conflicts, merge decides them in one revision, and after a pull both
// clones have the same knowledge and generate the same source.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME, findTool } from "../../src/native/discover.ts";
import { findGhidra } from "../../src/native/ghidra/index.ts";

let generateSkip: string | false = false;
try {
  findTool(ACME);
  findGhidra();
} catch {
  generateSkip = "ACME or Ghidra is not installed: the clones are compared without generated source";
}

const skills = resolve(import.meta.dirname, "../../skills");
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "c64-re-tools-merge-")));
after(() => rmSync(scratch, { recursive: true, force: true }));

function git(cwd: string, ...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const run = spawnSync("git", ["-c", "user.name=Tester", "-c", "user.email=tester@example.com", "-c", "pull.rebase=false", ...args], { cwd, encoding: "utf8" });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

function gitOk(cwd: string, ...args: string[]): string {
  const run = git(cwd, ...args);
  assert.equal(run.status, 0, `git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout;
}

/** Runs a skill script in the project folder of a clone and gives its exit status and its JSON line. */
function script(clone: string, skill: string, file: string, ...args: string[]): { status: number | null; json: Record<string, unknown> } {
  const run = spawnSync(process.execPath, [...process.execArgv, join(skills, skill, "scripts", file), ...args], { cwd: join(clone, "game"), encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  return { status: run.status, json: JSON.parse(run.stdout) as Record<string, unknown> };
}

const knowledge = (clone: string, ...args: string[]) => script(clone, "c64-knowledge", "knowledge.ts", ...args);

function write(clone: string, ...args: string[]): void {
  const run = knowledge(clone, ...args);
  assert.equal(run.status, 0, `${args.join(" ")}: ${JSON.stringify(run.json)}`);
}

/** Waits until the clock moves on, so the work of the second computer is newer by its time. */
function later(): void {
  const start = Date.now();
  while (Date.now() < start + 2);
}

/** Every file of a folder and its text, for a comparison of two clones. */
function files(folder: string): Record<string, string> {
  return Object.fromEntries(readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const path = join(entry.parentPath, entry.name);
    return [path.slice(folder.length + 1), readFileSync(path, "utf8")];
  }));
}

test("two clones write, git merges the knowledge, merge decides the conflicts, and both clones end with the same knowledge", { timeout: 600_000 }, (t) => {
  // The repository: one project with a program and its first knowledge.
  const origin = join(scratch, "origin.git");
  gitOk(scratch, "init", "-q", "--bare", "-b", "main", origin);
  const seed = join(scratch, "seed");
  gitOk(scratch, "clone", "-q", origin, seed);
  mkdirSync(join(seed, "game"));
  // $1000: LDX #0 / LDA $1010,X / STA $0400,X / INX / BNE $1002 / RTS, then 16 bytes of data.
  writeFileSync(join(seed, "game", "game.prg"), Uint8Array.from([0x00, 0x10, 0xa2, 0x00, 0xbd, 0x10, 0x10, 0x9d, 0x00, 0x04, 0xe8, 0xd0, 0xf7, 0x60, 0xea, 0xea, ...Array.from({ length: 16 }, (_, index) => index)]));
  write(seed, "rename", "$1000", "start", "--kind", "routine", "--reason", "the entry");
  gitOk(seed, "add", "-A");
  assert.deepEqual(gitOk(seed, "status", "--porcelain").trim().split("\n").sort(), [
    "A  game/.c64-re-tools/knowledge/.gitattributes",
    "A  game/.c64-re-tools/knowledge/revisions.jsonl",
    "A  game/.c64-re-tools/knowledge/symbols.jsonl",
    "A  game/game.prg",
  ], "git sees the knowledge text, and not the index in local/");
  gitOk(seed, "commit", "-q", "-m", "first knowledge");
  gitOk(seed, "push", "-q", "origin", "main");

  // Two computers: each names $1002 and classifies the data in its own way.
  const [first, second] = [join(scratch, "first"), join(scratch, "second")];
  for (const clone of [first, second]) gitOk(scratch, "clone", "-q", origin, clone);
  write(first, "rename", "$1002", "copy_loop");
  write(first, "classify", "$1010", "$101f", "bytes", "--element", "4");
  write(first, "comment", "$1000", "line", "Copies the table to the screen.");
  write(first, "rename", "$1020", "after_table");
  gitOk(first, "add", "-A");
  gitOk(first, "commit", "-q", "-m", "first computer");
  gitOk(first, "push", "-q", "origin", "main");
  later();
  write(second, "rename", "$1002", "fill_screen");
  write(second, "classify", "$1008", "$1017", "code");
  write(second, "comment", "$100e", "side", "Padding.");
  gitOk(second, "add", "-A");
  gitOk(second, "commit", "-q", "-m", "second computer");

  // git keeps the lines of both sides and does not stop.
  const pulled = git(second, "pull", "-q", "--no-edit", "origin", "main");
  assert.equal(pulled.status, 0, pulled.stderr);
  assert.doesNotMatch(readFileSync(join(second, "game", ".c64-re-tools", "knowledge", "symbols.jsonl"), "utf8"), /^(<<<<<<<|=======|>>>>>>>)/m);

  // The reads show the conflicts, and the writes wait for merge.
  const conflicts = knowledge(second, "at", "$1002").json.conflicts as Array<{ conflict: string; rows: Array<{ name?: string; start?: string }> }>;
  assert.deepEqual(conflicts.map((conflict) => conflict.conflict), ["two symbols at one address", "regions that overlap"]);
  assert.deepEqual(conflicts[0]!.rows.map((row) => row.name), ["copy_loop", "fill_screen"]);
  const refused = knowledge(second, "rename", "$1001", "x");
  assert.equal(refused.status, 1);
  assert.equal((refused.json.error as { code: string }).code, "conflict");
  assert.match((refused.json.error as { message: string }).message, /knowledge\.ts merge/);

  const merged = knowledge(second, "merge", "--reason", "merge of two computers", "--origin", "user");
  assert.equal(merged.status, 0, JSON.stringify(merged.json));
  const choices = merged.json.choices as Array<{ conflict: string; kept: { name?: string; type?: string }; closed: Array<{ name?: string; type?: string }> }>;
  assert.deepEqual(
    choices.map((choice) => [choice.conflict, choice.kept.name ?? choice.kept.type, choice.closed.map((row) => row.name ?? row.type)]),
    [
      ["two symbols at one address", "fill_screen", ["copy_loop"]],
      ["regions that overlap", "code", ["bytes"]],
    ],
  );
  assert.equal(knowledge(second, "at", "$1002").json.conflicts, undefined);
  assert.deepEqual(
    (knowledge(second, "regions").json.regions as Array<Record<string, unknown>>).map((region) => [region.start, region.end, region.type, region.element]),
    [
      ["$1008", "$1017", "code", undefined],
      ["$1018", "$101f", "bytes", 4],
    ],
    "the older region keeps its part outside the newer one",
  );
  gitOk(second, "add", "-A");
  gitOk(second, "commit", "-q", "-m", "merge the knowledge");
  gitOk(second, "push", "-q", "origin", "main");
  gitOk(first, "pull", "-q", "--no-edit", "origin", "main");

  // Both computers have the same knowledge, and git sees no change in either.
  const text = (clone: string) => files(join(clone, "game", ".c64-re-tools", "knowledge"));
  assert.deepEqual(text(first), text(second));
  for (const clone of [first, second]) assert.equal(gitOk(clone, "status", "--porcelain"), "", clone);
  for (const address of ["$1000", "$1002", "$1010", "$1020"]) assert.deepEqual(knowledge(first, "at", address).json, knowledge(second, "at", address).json, address);
  for (const clone of [first, second]) write(clone, "export", "--out", ".c64-re-tools/local/export.json");
  const exported = (clone: string) => readFileSync(join(clone, "game", ".c64-re-tools", "local", "export.json"), "utf8");
  assert.equal(exported(first), exported(second));
  assert.match(exported(first), /"name": "fill_screen"/);

  if (generateSkip === false) {
    for (const clone of [first, second]) {
      const generated = script(clone, "c64-source", "generate.ts", "game.prg", "--out", ".c64-re-tools/local/src");
      assert.equal(generated.status, 0, JSON.stringify(generated.json));
    }
    const source = (clone: string) => files(join(clone, "game", ".c64-re-tools", "local", "src"));
    assert.deepEqual(source(first), source(second));
    assert.match(Object.values(source(first)).join("\n"), /^fill_screen$/m);
  } else {
    t.diagnostic(generateSkip);
  }
});
