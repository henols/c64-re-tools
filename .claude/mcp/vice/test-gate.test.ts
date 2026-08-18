// Drift guard for the automated/manual test-file split (test-gate.mjs). See
// that file's header for why the split exists and what must never happen (a
// second, competing list). Test names are chosen so
// `--test-name-pattern="gate"` matches every assertion here, matching this
// phase's per-task verification convention.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MANUAL_ONLY_TESTS, automatedTestFiles } from "./test-gate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

test("gate: MANUAL_ONLY_TESTS contains exactly the six dispositioned files", () => {
  assert.deepEqual(
    [...MANUAL_ONLY_TESTS].sort(),
    [
      "broker-e2e.test.ts",
      "stock-live.test.ts",
      "stock-live-triage.test.ts",
      "stock-live-broker-monitor.test.ts",
      "vice-broker-launch.test.ts",
      "vice-proxy.test.ts",
    ].sort(),
  );
});

test("gate: automated set + manual set equals the on-disk *.test.* set, with no overlap", () => {
  const onDisk = readdirSync(HERE)
    .filter((f) => /\.test\.[a-zA-Z0-9]+$/.test(f))
    .sort();
  const automated = automatedTestFiles(HERE);

  const overlap = automated.filter((f) => MANUAL_ONLY_TESTS.includes(f));
  assert.deepEqual(overlap, [], "no file may appear in both the automated and manual sets");

  const combined = [...automated, ...MANUAL_ONLY_TESTS].sort();
  assert.deepEqual(
    combined,
    onDisk,
    "every on-disk *.test.* file must land in exactly one of automatedTestFiles()/MANUAL_ONLY_TESTS -- " +
      "a new test file that appears in neither (or both) has escaped the gate",
  );
});

test("gate: every MANUAL_ONLY_TESTS entry actually exists on disk", () => {
  for (const f of MANUAL_ONLY_TESTS) {
    assert.ok(existsSync(join(HERE, f)), `${f} is listed as manual-only but does not exist on disk`);
  }
});
