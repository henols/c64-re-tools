// anno-seam.test.ts -- two surviving checks. Phase 56 removed this file's
// structural confinement scan (`node:sqlite` named by exactly one shipped
// module, all four planted access routes caught by the real scan, the
// negative control, the seam-private-export scan, and the commit-site and
// idempotency checks); that scan is no longer test-enforced.
//
// What remains: package.json's files[] lists exactly the shipped anno-*
// production modules and no test file or test-only helper, and WR-25's
// behavioural refusal -- openStore refuses when neither a workspaceRoot nor
// the escape is supplied, proven through the real entry point.
//
// Nothing here asserts that stderr is empty, and nothing may: `node:sqlite`
// emits an `ExperimentalWarning` unconditionally on first load (via
// anno-store.mts, the module both surviving tests import).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { AnnoStorePathError } from "./anno-types.mts";
import { closeStore, openStore } from "./anno-store.mts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 2. WR-25 -- `openStore`'s unconfined ESCAPE HATCH, pinned to its enumerated
// sites in the SEAM_PRIVATE_EXPORTS style.
//
// Confinement became `openStore`'s default in 28-21, and the escape is what
// keeps the module's own derived-path opens working. An escape that spreads
// silently is the old unsafe default returning by another name, which is why
// this pin exists at all and why it asserts a POSITIVE count rather than only
// an absence.
// ---------------------------------------------------------------------------

test("WR-25: the guard itself exists -- openStore refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied", () => {
  // ASSERTED THROUGH THE ENTRY POINT, NOT AGAINST SOURCE TEXT, and that is
  // deliberate: prohibition 28-18 P1 forbids a structural invariant from
  // constraining the wording of a user-facing message, and a source-text match
  // on the refusal is one edit away from doing exactly that. The pin above is
  // structural because it counts CALL SITES; this one is behavioural because it
  // is about what the function DOES.
  const dir = mkdtempSync(join(tmpdir(), "anno-seam-"));
  try {
    const path = join(dir, "proj.annostore");

    let caught: unknown;
    try {
      openStore(path);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof AnnoStorePathError, `an unconfined open with no escape must be refused by name; got ${caught}`);
    assert.equal(existsSync(path), false, "and the refusal must precede creation -- nothing exists at the refused path");

    // AND THE ESCAPE STILL WORKS, so the guard is a gate and not a wall.
    const handle = openStore(path, { unconfinedModuleDerivedPath: true });
    closeStore(handle);
    assert.equal(existsSync(path), true, "the escape opens the same path and creates the store");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
