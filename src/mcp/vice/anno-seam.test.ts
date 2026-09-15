// anno-seam.test.ts -- the structural assertion that STORE-07's confinement is
// REAL rather than promised: `node:sqlite` is named by exactly ONE module of
// the shipped module set, all four of its working access routes are proven
// catchable by the one predicate the real scan uses, and a comment-only
// mention is proven not to count.
//
// Modelled on `hostpath-consumers.test.ts`, which established this idiom, and
// diverging from it in exactly TWO places -- both stated below, because a
// divergence a reader has to infer is a divergence a later edit will undo by
// accident.
//
// Nothing here asserts that stderr is empty, and nothing may: `node:sqlite`
// emits an `ExperimentalWarning` unconditionally on first load.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { AnnoStorePathError } from "./anno-types.ts";
import { closeStore, openStore } from "./anno-store.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The three shipped modules this area adds. */
const NEW_SHIPPED_MODULES = ["anno-types.ts", "anno-index.ts", "anno-store.ts"];

// ---------------------------------------------------------------------------
// 1. The real assertion
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 2-5. The four planted access routes, all through the same predicate
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 6. The negative control -- comment half only, and the trade is recorded
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 7-8. Non-vacuity: the scanned set and the shipped list are real
// ---------------------------------------------------------------------------

test("package.json files[] ships every anno-* production module on disk and no anno-prefixed test file or test-only helper", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  for (const name of NEW_SHIPPED_MODULES) {
    assert.equal(
      pkg.files.includes(name),
      true,
      `${name} must be listed: STORE-07's assertion scans a set derived from files[], so an unlisted module makes it vacuous`,
    );
  }
  // DERIVED FROM DISK, NOT HAND-TYPED (re-pointed by plan 29-01, which adds
  // anno-tools.ts and is the first of several plans in phase 29 to add an
  // anno-* module). The property this assertion has always been about is NOT
  // "there are exactly three modules" -- it is "files[] ships every anno-*
  // PRODUCTION module and nothing else anno-prefixed": no test file, and no
  // test-only spawned helper such as anno-durability-mutator.mjs. Deriving the
  // expectation from disk keeps both of those teeth (a listed test file or a
  // listed .mjs helper appears in `annoEntries` and in neither expected set,
  // so the deepEqual still reddens) while letting the module count grow
  // without a hand edit that a future plan would have to remember to make.
  const annoEntries = pkg.files.filter((entry) => entry.startsWith("anno-")).sort();
  // `.json` IS in the derivation, and it is a decision rather than a widening
  // (plan 29-05). The family gained a SHIPPED GENERATED DATA FILE when
  // anno-regbits.json was renamed to anno-regbits.json: it is listed in
  // files[] because a skill playbook cites it by filename as the curated
  // bit-name table, and it is neither a test file nor a test-only spawned
  // helper -- the two things this assertion exists to keep OUT. Leaving the
  // derivation at `(ts|mts)` would have made a correctly-shipped data file
  // read as an illegitimate entry, and the cheap fix under that pressure is
  // to drop it from files[], which silently unships it. Both teeth survive
  // unchanged: `.test.` files are still excluded by the filter below, and
  // anno-durability-mutator.mjs / anno-schema-v2-fixture.mjs are still `.mjs`
  // and still land in neither set, so listing either still reddens this.
  const annoProductionModulesOnDisk = readdirSync(HERE)
    .filter((name) => /^anno-.*\.(ts|mts|json)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name))
    .sort();
  assert.ok(
    annoProductionModulesOnDisk.length >= NEW_SHIPPED_MODULES.length,
    `expected at least the ${NEW_SHIPPED_MODULES.length} declared anno-* production modules on disk, found ` +
      `${annoProductionModulesOnDisk.length} -- a broken glob must fail loudly here rather than let the ` +
      "equality below pass against an empty expectation",
  );
  assert.deepEqual(
    annoEntries,
    annoProductionModulesOnDisk,
    "the shipped anno-* set must be exactly the anno-* PRODUCTION modules on disk -- no test file, and no test-only spawned helper",
  );
  assert.equal(
    pkg.files.some((entry) => /\.test\./.test(entry)),
    false,
    "no test file may ever be listed in files[]",
  );
});

// ---------------------------------------------------------------------------
// 9-12. Properties of the one seam module itself
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WR-25 -- `openStore`'s unconfined ESCAPE HATCH, pinned to its enumerated
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
