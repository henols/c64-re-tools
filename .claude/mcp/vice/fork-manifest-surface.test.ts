// Fork-surface regression gate (D-16 / Phase 3 plan 03-05 Task 1).
//
// BACK-02 says the fork backend's advertised list is unchanged from v0.1.x --
// a tool present on the fork today must still be present tomorrow, in the
// same shape, unless a decision record says otherwise. Before this file
// there was NO hard-coded tool-count assertion anywhere in the repo
// (`grep -rn '\b63\b' *.test.ts` finds nothing; every existing parity test
// -- `stock-dispatch.test.ts`, `vice-proxy.test.ts` -- computes expected
// names/counts dynamically FROM tools-manifest.json, never against a
// literal number). So this file does not "move an assertion from 63 to
// 62"; there was no prior assertion to move. It CREATES the count gate,
// directly at 62, because D-16 deleted `vice_snapshot_list` (no consumer
// anywhere in the repo -- verified: no skill, no script, no source called
// it, the only reference was `vice_snapshot_load`'s own description) as a
// deliberate, single documented exception to BACK-02, reconciled in
// ROADMAP.md.
//
// A contributor who changes the number below without a decision record is
// regressing BACK-02. If you are looking at a failing count assertion and
// wondering whether to just update the number: don't, until you have a
// decision record the way D-16 has one.
//
// Separately: `refresh-manifest.ts` is the ONLY writer of
// tools-manifest.json, and it always writes the tool list *EXACTLY* as the
// live fork host's tools/list answers. If anyone ever points that script at
// a live fork server that still (or once again) advertises
// `vice_snapshot_list`, the refresh will silently re-add it and this file's
// count/name assertions are what will catch that on the next test run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FORK_MANIFEST_PATH = join(HERE, "tools-manifest.json");

interface ManifestToolEntry {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface Manifest {
  generated_at: string;
  endpoint: string;
  tools: ManifestToolEntry[];
}

function readManifest(): Manifest {
  return JSON.parse(readFileSync(FORK_MANIFEST_PATH, "utf8"));
}

const rawManifestText = readFileSync(FORK_MANIFEST_PATH, "utf8");

test("fork-manifest-surface: tools-manifest.json parses and its tools array has length exactly 62 (D-16)", () => {
  const manifest = readManifest();
  assert.ok(Array.isArray(manifest.tools), "manifest.tools must be an array");
  assert.equal(
    manifest.tools.length,
    62,
    "fork manifest tool count changed -- BACK-02 says the fork's advertised list is unchanged from v0.1.x; " +
      "62 is the count D-16 established after deleting vice_snapshot_list. Do not edit this number without a decision record."
  );
});

test("fork-manifest-surface: no entry is named vice_snapshot_list (D-16)", () => {
  const manifest = readManifest();
  assert.ok(
    !manifest.tools.some((t) => t.name === "vice_snapshot_list"),
    "vice_snapshot_list was deleted from the fork manifest by D-16 -- it must never reappear (no consumer anywhere in the repo)"
  );
});

test("fork-manifest-surface: the manifest file text contains zero occurrences of vice_snapshot_list or snapshot.list", () => {
  assert.equal(
    (rawManifestText.match(/vice_snapshot_list/g) ?? []).length,
    0,
    "the raw manifest text must not mention vice_snapshot_list anywhere"
  );
  assert.equal(
    (rawManifestText.match(/snapshot\.list/g) ?? []).length,
    0,
    "vice_snapshot_load's description used to say 'Use snapshot.list to see available snapshots' -- " +
      "that stale cross-reference must not reappear"
  );
});

test("fork-manifest-surface: vice_snapshot_save and vice_snapshot_load are both still present (exactly one tool was deleted)", () => {
  const manifest = readManifest();
  const names = new Set(manifest.tools.map((t) => t.name));
  assert.ok(names.has("vice_snapshot_save"), "vice_snapshot_save must still be present");
  assert.ok(names.has("vice_snapshot_load"), "vice_snapshot_load must still be present");
});

test("fork-manifest-surface: every entry has a unique name and a non-empty description", () => {
  const manifest = readManifest();
  const seen = new Set<string>();
  for (const tool of manifest.tools) {
    assert.ok(typeof tool.name === "string" && tool.name.length > 0, "every tool must have a non-empty name");
    assert.ok(!seen.has(tool.name), `duplicate tool name found: "${tool.name}"`);
    seen.add(tool.name);
    assert.ok(
      typeof tool.description === "string" && tool.description.length > 0,
      `tool "${tool.name}" must have a non-empty description`
    );
  }
});
