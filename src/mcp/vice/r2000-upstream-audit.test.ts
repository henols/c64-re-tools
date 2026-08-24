import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json"), "utf8"));

test("Phase 19 pins and classifies all five upstream analysis procedures", () => {
  assert.equal(manifest.repository, "https://github.com/ricardoquesada/regenerator2000");
  assert.match(manifest.commit, /^[0-9a-f]{7,40}$/);
  assert.equal(manifest.procedures.length, 5);
  for (const procedure of manifest.procedures) {
    assert.match(procedure.path, /^\.agent\/skills\/r2000-analyze-/);
    assert.match(procedure.sha256, /^[0-9a-f]{64}$/);
    assert.ok(!procedure.destination.includes(".agent/skills"));
    for (const disposition of Object.values(procedure.tools) as string[]) {
      assert.ok(["curated", "omit", "adapt-to-address-input"].includes(disposition));
    }
  }
});
