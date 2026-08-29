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
// The surface-derivation half at the foot of this file (plan 29-08). The
// upstream-integrity half above uses neither.
import { ANNO_TOOL_DEFINITIONS } from "./anno-tools.ts";
import { annoRegisterEntryFor } from "./anno-register.ts";

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

// ===========================================================================
// THE SURFACE-DERIVATION HALF (MCP-01, D-08, D-09) -- added by plan 29-08.
//
// Everything above this line is the UPSTREAM-INTEGRITY half and is unchanged:
// it audits the manifest as a snapshot record (an immutable pin, a justified
// and cited disposition for every non-curated call, named re-sync triggers with
// mechanisms, and a live-gated re-hash that hard-fails rather than skipping
// under its opt-in environment variable). This half audits the OTHER direction:
// whether THIS PROJECT'S tool surface is actually derived from that record.
//
// WHY BOTH HALVES LIVE IN ONE FILE. They share the manifest read, and more
// importantly they share a failure mode: a manifest that cannot be read makes
// BOTH halves pass by finding nothing to check. Keeping them together means the
// non-vacuity counters below sit in the same file as the pin they depend on.
//
// MCP-01's claim is that the surface is DERIVED rather than CHOSEN. That is a
// claim about two directions, and only both together mean anything:
//   FORWARD  -- every verb the manifest disposes `curated` or
//               `adapt-to-address-input` has a route; every verb it disposes
//               `omit` is absent; an unrecognised disposition FAILS rather than
//               being skipped.
//   BACKWARD -- every verb on the surface is either manifest-classified or
//               carries an entry in the committed register citing at least one
//               requirement id. Without this direction the surface could grow
//               without limit and still satisfy the forward one.
// ===========================================================================

/**
 * THE ONE MAPPING from an upstream verb name to this surface's name. Total over
 * every upstream name, with EXACTLY TWO documented departures; everything else
 * is the same suffix under this project's own family prefix.
 *
 * This is the only place the correspondence is written down. `anno-register.test.ts`
 * deliberately does NOT copy it -- its shadowing check uses a broader
 * suffix-equality relation and says so at the point of use, because a shadowing
 * check must over-approximate while this mapping must be exact.
 */
function annoNameFor(upstream: string): string {
  // DEPARTURE 1 (D-09): the cursor verb is folded into the disassemble verb's
  // explicit `address` argument, which is what its "adapt-to-address-input"
  // disposition resolved to. Upstream's own absorbed text forbids the cursor
  // route in exactly the situation this project's procedures describe, and this
  // project has no editor cursor at all -- the caller always supplies an address.
  if (upstream === "r2000_get_disassembly_cursor") return "anno_disassemble";
  // DEPARTURE 2: the search verb's shortened name. Upstream named the corpus in
  // the verb; this surface names the three corpora in the ARGUMENTS
  // (search_labels / search_comments / search_instructions), so carrying one
  // corpus in the verb name would have contradicted the other two.
  if (upstream === "r2000_search_disassembly") return "anno_search";
  return "anno_" + upstream.slice(upstream.indexOf("_") + 1);
}

/** The four omit names, spelled BOTH ways -- the mapped surface name and the
 * bare suffix -- so "absent under any spelling" is checked rather than asserted
 * for the one spelling that happened to be convenient. */
function omitSpellings(upstream: string): string[] {
  return [annoNameFor(upstream), upstream.slice(upstream.indexOf("_") + 1)];
}

interface DerivationVerdict {
  /** Upstream names disposed curated or adapt-to-address-input, deduplicated. */
  routed: string[];
  /** Upstream names disposed omit, deduplicated. */
  omitted: string[];
  /** Every offence, each naming the upstream verb and its disposition. */
  problems: string[];
}

/**
 * THE FORWARD DIRECTION, as one order-independent verdict.
 *
 * `procedures` and `definitions` are both parameters so the ordering test can
 * drive this same code path over reversed copies of each -- the verdict must not
 * depend on the order either side is walked.
 */
function derivationVerdict(
  procedures: readonly { path: string; tools: Record<string, string> }[],
  definitions: readonly { name: string }[],
): DerivationVerdict {
  const names = new Set(definitions.map((definition) => definition.name));
  const routed = new Set<string>();
  const omitted = new Set<string>();
  const problems: string[] = [];
  for (const procedure of procedures) {
    for (const [upstream, disposition] of Object.entries(procedure.tools)) {
      const anno = annoNameFor(upstream);
      if (disposition === "curated" || disposition === "adapt-to-address-input") {
        routed.add(upstream);
        if (!names.has(anno)) {
          problems.push(
            `${upstream} is disposed "${disposition}" in ${procedure.path} but ${anno} has NO ROUTE on the ` +
              "surface -- the surface is not derived from the manifest it claims to be derived from",
          );
        }
      } else if (disposition === "omit") {
        omitted.add(upstream);
        for (const spelling of omitSpellings(upstream)) {
          if (names.has(spelling)) {
            problems.push(
              `${upstream} is disposed "omit" in ${procedure.path} but ${spelling} IS on the surface -- ` +
                "an omission the manifest justified and cited has been quietly reversed",
            );
          }
        }
      } else {
        // NEVER SKIPPED. A manifest edit introducing a fourth disposition must
        // fail outright: a value this check does not understand is a value it
        // cannot claim to have enforced.
        problems.push(
          `${upstream} in ${procedure.path} carries unknown disposition "${disposition}" -- a disposition this ` +
            "check does not recognise must FAIL, never be passed over",
        );
      }
    }
  }
  return { routed: [...routed].sort(), omitted: [...omitted].sort(), problems: problems.sort() };
}

/** MEASURED against the committed manifest on 2026-08-29, not copied from a
 * planning document: 16 DISTINCT upstream verbs disposed curated (15) or
 * adapt-to-address-input (1), and 4 DISTINCT verbs disposed omit, across the
 * five procedures -- several verbs appear in more than one procedure, so these
 * are counts of NAMES and not of mentions. They exist so an empty or unreadable
 * manifest read fails HERE rather than making every assertion above pass
 * trivially by finding nothing to walk. */
const MEASURED_ROUTED_MINIMUM = 16;
const MEASURED_OMITTED_MINIMUM = 4;

test("MCP-01 (forward): every curated or adapt-to-address-input verb has a route, every omit verb is absent under any spelling, and an unknown disposition fails outright", () => {
  const verdict = derivationVerdict(manifest.procedures, ANNO_TOOL_DEFINITIONS);
  assert.deepEqual(
    verdict.problems,
    [],
    `derivation problems:\n  ${verdict.problems.join("\n  ")}\n\nMCP-01's whole claim is that this surface is ` +
      "DERIVED rather than chosen. Each line above is a place where the surface and the manifest disagree.",
  );
  // NON-VACUITY. These two counters are the reason an empty or unreadable
  // manifest cannot make the assertion above pass by walking nothing.
  assert.ok(
    verdict.routed.length >= MEASURED_ROUTED_MINIMUM,
    `walked only ${verdict.routed.length} curated-or-adapt verbs, expected at least ${MEASURED_ROUTED_MINIMUM} -- ` +
      "an empty or unreadable manifest read must fail here, not pass every assertion above it trivially",
  );
  assert.ok(
    verdict.omitted.length >= MEASURED_OMITTED_MINIMUM,
    `walked only ${verdict.omitted.length} omit verbs, expected at least ${MEASURED_OMITTED_MINIMUM} -- ` +
      "the absence half would otherwise be asserted over an empty set",
  );
});

test("MCP-01: the one verb with zero callers anywhere is not carried", () => {
  const names = new Set(ANNO_TOOL_DEFINITIONS.map((definition) => definition.name));
  // Named directly rather than derived, because it is derived from NOTHING: the
  // manifest never mentions it, so no walk over the manifest can reach it. It is
  // on the surface's exclusion list because a measured caller census found zero
  // callers anywhere, and MCP-01 names it explicitly for that reason.
  assert.equal(names.has("anno_delete_project_enum"), false, "the verb with zero callers anywhere must not be carried");
  assert.equal(names.has("delete_project_enum"), false, "nor under its bare spelling");
  // Non-vacuity for this assertion specifically: an empty surface would pass it.
  assert.ok(names.size > 0, "the surface is empty -- the absence assertions above would pass trivially");
});

test("MCP-01 (ordering): the verdict is identical over reversed copies of BOTH the definition table and the procedure list", () => {
  const forward = derivationVerdict(manifest.procedures, ANNO_TOOL_DEFINITIONS);
  const reversed = derivationVerdict([...manifest.procedures].reverse(), [...ANNO_TOOL_DEFINITIONS].reverse());
  assert.deepEqual(
    reversed,
    forward,
    "the derivation verdict changed when the procedure list and the definition table were reversed -- a check " +
      "whose result depends on walk order is a check whose result depends on where someone pasted an entry",
  );
  assert.ok(forward.routed.length > 0, "the reversed comparison ran over an empty walk");
});

test("MCP-01 (backward, D-08): every surface verb is either manifest-classified or carries a register entry citing at least one requirement id", () => {
  const classified = new Set(
    manifest.procedures.flatMap((procedure: { tools: Record<string, string> }) => Object.keys(procedure.tools)).map(annoNameFor),
  );
  // Non-vacuity: an empty classified set would push every verb into the register
  // branch and turn this into a test of the register alone.
  assert.ok(classified.size >= MEASURED_ROUTED_MINIMUM - 1, `only ${classified.size} classified surface names were derived from the manifest`);
  const unjustified: string[] = [];
  for (const definition of ANNO_TOOL_DEFINITIONS) {
    if (classified.has(definition.name)) continue;
    const entry = annoRegisterEntryFor(definition.name);
    if (entry === undefined) {
      unjustified.push(`${definition.name}: classified by NEITHER the manifest NOR the register`);
      continue;
    }
    if (entry.requirements.length === 0) {
      unjustified.push(`${definition.name}: has a register entry but it cites no requirement id`);
    }
  }
  assert.deepEqual(
    unjustified,
    [],
    `${unjustified.join("\n  ")}\n\nD-08 is literal about what happens next: a verb added with no named consumer ` +
      "FAILS rather than being reviewed. Either derive it from the manifest, or give it a committed register entry " +
      "citing a requirement id and a consumer.",
  );
  assert.ok(ANNO_TOOL_DEFINITIONS.length > 0, "the surface is empty -- this direction would pass over nothing");
});
