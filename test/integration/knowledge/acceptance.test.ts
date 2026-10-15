// From a clean C64 project folder, a read needs no knowledge, the first
// write creates .c64-re-tools/knowledge/, and several semantic changes give
// a correct current view with the full history.
// Only the c64-knowledge script runs: no Host Runtime is involved.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";
import { nthIn } from "../../../src/knowledge/revisions.testkit.ts";

const script = resolve(import.meta.dirname, "../../../skills/c64-knowledge/scripts/knowledge.ts");
const root = mkdtempSync(join(tmpdir(), "c64-re-tools-m4-"));
after(() => rmSync(root, { recursive: true, force: true }));

function knowledge(...args: string[]): Record<string, unknown> {
  // An unreachable host: the knowledge path must never try to use it.
  const run = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  return JSON.parse(run.stdout) as Record<string, unknown>;
}

test("from a clean project: a read, the first write, several changes, the current view and the full history", () => {
  // A C64 project with its original program and no toolkit state.
  writeFileSync(join(root, "game.prg"), Buffer.from([0x01, 0x08, 0x00]));

  assert.deepEqual(knowledge("at", "$2100"), { address: "$2100", comments: [], referencesFrom: [], referencesTo: [], revision: "0" });
  assert.deepEqual(readdirSync(root), ["game.prg"], "a read creates nothing");

  knowledge("rename", "$2100", "FUN_2100", "--kind", "routine", "--reason", "entry found by tracing");
  assert.deepEqual(readdirSync(join(root, ".c64-re-tools")).sort(), ["knowledge", "local"], "the first write creates the knowledge");

  knowledge("classify", "$2000", "$2fff", "code", "--expect-revision", nthIn(root, 1));
  knowledge("classify", "$2800", "$283f", "sprite", "--reason", "drawn as the player sprite");
  knowledge("rename", "$2100", "update_player", "--reason", "reads joystick 2 and moves the player", "--origin", "user");
  knowledge("comment", "$2100", "line", "Reads joystick 2 and moves the player.");
  knowledge("reference", "$2100", "$dc00", "read");
  knowledge("rename", "$2800", "player_sprite", "--kind", "data");

  const current = knowledge("at", "$2100") as { symbol: { name: string; origin: string }; region: { start: string; end: string }; comments: unknown[]; referencesFrom: unknown[]; revision: string };
  assert.equal(current.symbol.name, "update_player");
  assert.equal(current.symbol.origin, "user");
  assert.deepEqual([current.region.start, current.region.end], ["$2000", "$27ff"], "the sprite split the code region");
  assert.equal(current.comments.length, 1);
  assert.equal(current.referencesFrom.length, 1);
  assert.equal(current.revision, nthIn(root, 7));
  assert.deepEqual(
    (knowledge("regions") as { regions: Array<{ start: string; end: string; type: string }> }).regions.map((region) => `${region.start}-${region.end} ${region.type}`),
    ["$2000-$27ff code", "$2800-$283f sprite", "$2840-$2fff code"],
  );

  const history = (knowledge("history", "$2100") as { history: Array<{ entity: string; name?: string; fromRevision: string; toRevision?: string }> }).history;
  assert.deepEqual(
    history.filter((entry) => entry.entity === "symbol").map((entry) => [entry.name, entry.fromRevision, entry.toRevision]),
    [
      ["FUN_2100", nthIn(root, 1), nthIn(root, 4)],
      ["update_player", nthIn(root, 4), undefined],
    ],
  );
  const revisions = (knowledge("revisions") as { revisions: Array<{ id: string; operation: string }> }).revisions;
  assert.deepEqual(revisions.map((revision) => revision.id), [7, 6, 5, 4, 3, 2, 1].map((n) => nthIn(root, n)));

  // A revert restores revision 3 as revision 8, and every revision stays reviewable.
  knowledge("revert", nthIn(root, 3), "--reason", "re-examine the routine");
  assert.equal((knowledge("at", "$2100") as { symbol: { name: string } }).symbol.name, "FUN_2100");
  assert.equal((knowledge("revisions", "--limit", "100") as { revisions: unknown[] }).revisions.length, 8);
  assert.equal(((knowledge("revision", nthIn(root, 4)) as { added: unknown[] }).added).length, 1);

  // Text files, ready for version control; the index stays in local/.
  assert.deepEqual(readdirSync(join(root, ".c64-re-tools", "knowledge")).sort(), [".gitattributes", "comments.jsonl", "references.jsonl", "regions.jsonl", "revisions.jsonl", "symbols.jsonl"]);
  assert.equal(existsSync(join(root, ".c64-re-tools", "local", "knowledge.db-journal")), false);
});
