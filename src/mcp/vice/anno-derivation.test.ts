// anno-derivation.test.ts -- the mechanical half of ABS-01 and ABS-04.
//
// RENAMED from `r2000-upstream-audit.test.ts` by phase 29 plan 29-05. Renamed
// ONLY -- plan 29-08 adds this file's surface-derivation half.
//
// `R2000_UPSTREAM_CLONE` and `VICE_REQUIRE_R2000_UPSTREAM` are DELIBERATELY
// LEFT BYTE-IDENTICAL, and the reason is the same one that keeps `ACME_BIN`
// and `VICE_REQUIRE_ACME` byte-identical: an environment variable is a name
// CI binds by, so renaming one silently turns a hard-gated check into a
// skipped one in whatever binds the old spelling. The subject-matter reason
// is one level up and is the whole distinction this phase turns on -- both
// names name an UPSTREAM PROJECT, which is not being deleted, rather than
// this repository's integration of it, which is. The manifest-provenance
// constants below are permanently exempt from the removal gate for exactly
// that reason, under the class `upstream-audit-manifest-provenance`.
//
// WHY THIS EXISTS: `upstream-procedure-manifest.json` is the dated snapshot
// record for five third-party procedures absorbed into `src/skills/` at one
// pinned upstream commit. A snapshot record is only worth anything if the
// three things that make it re-checkable cannot rot:
//   1. The PIN must be an immutable object. An abbreviated SHA is ambiguous
//      (git resolves it against whatever the local object database happens to
//      hold) and a branch or tag name is not a pin at all -- upstream can move
//      either one under this repository's feet. Hence exactly 40 lowercase hex.
//   2. Every upstream call the absorbed prose touched but this project does
//      NOT expose must carry a JUSTIFICATION and a CITATION, not just a
//      three-letter disposition. "omit" with no reason is indistinguishable
//      from an oversight a year later; "omit because upstream's own text at
//      <file>:<line> says it is destructive" is a decision.
//   3. ABS-04's re-sync trade must name TRIGGERS with MECHANISMS. "Review the
//      diff sometime" is not checkable; "the digests are in this file, compare
//      them" is.
//
// WHAT NOT TO DO, named concretely:
//   - Do not loosen the commit regex back to /^[0-9a-f]{7,40}$/. Plan 19-01
//      demonstrated the abbreviation failure deliberately (replace the commit
//      with its 7-character form, watch this file go red, restore) -- that
//      demonstration is the whole point of the tightened pattern.
//   - Do not let an ABSENT upstream clone read as agreement. The live-gated
//      re-hash check below SKIPs by default (the clone is not present in CI,
//      by design, exactly like regenerator2000 itself under D-11) and
//      hard-FAILs under the opt-in `VICE_REQUIRE_R2000_UPSTREAM` env var. A
//      silent pass on a missing oracle is the defect class D-11 exists to
//      close; do not reintroduce it here.
//   - Do not import `hostpath.ts` or `containerpath.ts`. Every path here is
//      repo-side or an operator-supplied clone path; `hostpath-consumers.test.ts`
//      asserts the r2000-side modules stay out of that consumer set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { CURATED_R2000_TOOLS } from "./r2000-tools.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = resolve(
  HERE,
  "../../../.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json"
);
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

/** The three dispositions ABS-01 recognises. A fourth value appearing in a
 * `tools` map means someone invented a category without recording what it
 * means -- that must FAIL, not be tolerated. */
const KNOWN_DISPOSITIONS: readonly string[] = ["curated", "omit", "adapt-to-address-input"];

/** The two options regenerator2000's own dual licence offers. `elected_licence`
 * must be one of them: electing something upstream never offered would be a
 * licence claim this project has no right to make. */
const DUAL_LICENCE_OPTIONS: readonly string[] = ["MIT", "Apache-2.0"];

/** Env var naming a local clone of the upstream repository checked out at the
 * pinned commit. Absent by default (CI never clones it); when set, the five
 * source digests are re-computed from the real bytes and compared. */
const UPSTREAM_CLONE = process.env.R2000_UPSTREAM_CLONE ?? "";

/** Opt-in hard-fail switch, the `VICE_REQUIRE_R2000` precedent (D-11): a
 * maintainer who sets this is asking for a missing clone to FAIL rather than
 * SKIP. Deliberately NOT set in `.github/workflows/ci.yml`. */
const REQUIRE_UPSTREAM = process.env.VICE_REQUIRE_R2000_UPSTREAM === "1";

function cloneSkipReason(): string | false {
  if (UPSTREAM_CLONE && existsSync(UPSTREAM_CLONE)) return false;
  return (
    `the upstream re-hash check is skipped -- no clone of ${manifest.repository} at ` +
    `${manifest.commit} was found. Set R2000_UPSTREAM_CLONE to the checkout root to run it. ` +
    `Set VICE_REQUIRE_R2000_UPSTREAM=1 to make its absence a FAILURE instead of a SKIP.`
  );
}

test("Phase 19 pins and classifies all five upstream analysis procedures", () => {
  assert.equal(manifest.repository, "https://github.com/ricardoquesada/regenerator2000");
  // Exactly 40 lowercase hex: an abbreviated SHA or a branch/tag-shaped ref
  // is NOT a pin (see this file's header, rule 1).
  assert.match(manifest.commit, /^[0-9a-f]{40}$/);
  assert.equal(manifest.procedures.length, 5);
  for (const procedure of manifest.procedures) {
    assert.match(procedure.path, /^\.agent\/skills\/r2000-analyze-/);
    assert.match(procedure.sha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isInteger(procedure.bytes) && procedure.bytes > 0, `${procedure.path}: bytes must be a positive integer`);
    assert.ok(!procedure.destination.includes(".agent/skills"));
    for (const disposition of Object.values(procedure.tools) as string[]) {
      assert.ok(KNOWN_DISPOSITIONS.includes(disposition), `${procedure.path}: unknown disposition "${disposition}"`);
    }
  }
});

test("every non-curated upstream call carries a justification and a citation", () => {
  const nonCurated = new Set<string>();
  for (const procedure of manifest.procedures) {
    for (const [name, disposition] of Object.entries(procedure.tools) as [string, string][]) {
      const curated = CURATED_R2000_TOOLS.includes(name);
      // The manifest's own bookkeeping must agree with r2000-tools.ts: a name
      // marked "curated" here that is absent from CURATED_R2000_TOOLS (or the
      // reverse) means the two records have drifted.
      assert.equal(
        disposition === "curated",
        curated,
        `${procedure.path}: ${name} is disposed "${disposition}" but CURATED_R2000_TOOLS ${curated ? "does" : "does not"} contain it`
      );
      if (!curated) nonCurated.add(name);
    }
  }

  // Non-vacuity: five non-curated names were enumerated in 19-RESEARCH.md
  // section 1.2. An empty set here would make every assertion below pass by
  // finding nothing to check.
  assert.ok(nonCurated.size >= 5, `expected at least 5 non-curated upstream calls, found ${nonCurated.size}`);

  const rationale = manifest.disposition_rationale;
  assert.ok(rationale && typeof rationale === "object", "manifest has no disposition_rationale object");

  for (const name of nonCurated) {
    const entry = rationale[name];
    assert.ok(entry, `${name}: appears in a procedure's tools map but has no disposition_rationale entry`);
    assert.ok(
      KNOWN_DISPOSITIONS.includes(entry.disposition),
      `${name}: disposition_rationale disposition "${entry.disposition}" is not one of ${KNOWN_DISPOSITIONS.join(", ")}`
    );
    assert.notEqual(entry.disposition, "curated", `${name}: is not curated, so its rationale must not claim it is`);
    assert.ok(
      typeof entry.justification === "string" && entry.justification.trim().length > 0,
      `${name}: disposition_rationale justification is empty`
    );
    assert.ok(
      typeof entry.upstream_citation === "string" && entry.upstream_citation.trim().length > 0,
      `${name}: disposition_rationale upstream_citation is empty`
    );
    // A citation must actually name a source location, not gesture at one.
    assert.match(entry.upstream_citation, /:\d+/, `${name}: upstream_citation names no file line`);
    if (entry.requirement_id !== undefined) {
      assert.match(
        entry.requirement_id,
        /^[A-Z][A-Z0-9]*-\d+$/,
        `${name}: requirement_id "${entry.requirement_id}" is not a requirement ID`
      );
    }
  }

  // Every rationale entry must correspond to a real non-curated call: a
  // stale entry for a name no procedure references any more is exactly the
  // "allowlist that only grows" rot this repo's own doctrine forbids.
  for (const name of Object.keys(rationale)) {
    assert.ok(nonCurated.has(name), `${name}: has a disposition_rationale entry but no procedure's tools map references it`);
  }
});

test("ABS-04's re-sync triggers are named and each carries a mechanism", () => {
  // The original single-string trigger is deliberately preserved: anything
  // already reading it must keep working.
  assert.ok(
    typeof manifest.resync_trigger === "string" && manifest.resync_trigger.length > 0,
    "the original resync_trigger string must be preserved"
  );
  assert.ok(Array.isArray(manifest.resync_triggers), "resync_triggers must be an array");
  assert.ok(manifest.resync_triggers.length >= 2, `expected at least 2 resync_triggers, found ${manifest.resync_triggers.length}`);
  for (const entry of manifest.resync_triggers) {
    assert.ok(
      typeof entry.trigger === "string" && entry.trigger.trim().length > 0,
      `resync_triggers entry has an empty trigger: ${JSON.stringify(entry)}`
    );
    assert.ok(
      typeof entry.mechanism === "string" && entry.mechanism.trim().length > 0,
      `resync_triggers entry "${entry.trigger}" has an empty mechanism -- a trigger with no way to check it is not checkable`
    );
  }
});

test("the elected licence is one of the two the upstream dual licence offers", () => {
  assert.equal(manifest.licence, "MIT OR Apache-2.0");
  assert.ok(
    DUAL_LICENCE_OPTIONS.includes(manifest.elected_licence),
    `elected_licence "${manifest.elected_licence}" is not one of ${DUAL_LICENCE_OPTIONS.join(" OR ")}`
  );
  assert.match(manifest.licence_copyright, /Ricardo Quesada/);
  assert.equal(manifest.upstream_version, "0.9.20");
});

test(
  "live: the five source digests re-hash to the manifest's values",
  { skip: REQUIRE_UPSTREAM ? false : cloneSkipReason() },
  () => {
    // Under VICE_REQUIRE_R2000_UPSTREAM the absence of the clone is the
    // failure -- never a silent pass.
    assert.ok(
      UPSTREAM_CLONE && existsSync(UPSTREAM_CLONE),
      `VICE_REQUIRE_R2000_UPSTREAM=1 but R2000_UPSTREAM_CLONE ("${UPSTREAM_CLONE}") does not exist -- ` +
        `a missing upstream clone must FAIL here, never read as agreement`
    );
    for (const procedure of manifest.procedures) {
      const filePath = join(UPSTREAM_CLONE, procedure.path);
      assert.ok(existsSync(filePath), `${procedure.path}: absent from the clone at ${UPSTREAM_CLONE}`);
      const bytes = readFileSync(filePath);
      assert.equal(bytes.length, procedure.bytes, `${procedure.path}: byte count differs from the manifest`);
      const digest = createHash("sha256").update(bytes).digest("hex");
      assert.equal(digest, procedure.sha256, `${procedure.path}: sha256 differs from the manifest -- upstream drifted, or the clone is at the wrong commit`);
    }
  }
);
