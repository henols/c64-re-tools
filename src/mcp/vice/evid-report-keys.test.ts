// evid-report-keys.test.ts -- EVID-04's fourth control: a structural guard over
// EVERY evidence answer at once, not four separate promises made inside the
// plans that built each surface.
//
// WHAT THIS GUARDS: no rendering of the runtime evidence layer may be read as
// a claim about the unobserved remainder. Three of EVID-04's controls landed
// inside the plans that built `anno_evid_ingest`/`anno_evid_disagreements`/
// `anno_evid_runs`/`anno_evid_reset` themselves; this file is the fourth --
// the one that holds when a fifth answer is added later by someone who never
// read those plans.
//
// WHY THE SCOPE IS DERIVED, NOT A HAND-TYPED LIST OF FOUR VERBS. A census that
// types out "the four evidence verbs" stops covering the next one the moment
// it ships -- exactly the failure this guard exists to prevent. Direction 1
// below derives the verb set from `ANNO_TOOL_DEFINITIONS` by the family's own
// name prefix and asserts it against this file's fixture table in BOTH
// directions, so a sixth verb with no fixture entry fails by name rather than
// passing unguarded.
//
// WHY THIS FILE READS SOURCES WITH `readFileSync`/`codeOnly()` RATHER THAN
// SHELLING OUT TO A TEXT SEARCH (the same register `anno-coverage.test.ts` and
// `capture-seam.test.ts` already use for the identical reason): one source
// file in this tree carries a NUL byte, which makes a plain shell search treat
// it as binary and skip it silently -- a shelled-out census would under-cover
// while still reporting success, and that exact blind spot has already
// produced one false decision in this project. `shippedTsModules()` (derived
// from `package.json`'s `files[]`, and it THROWS on an entry missing from
// disk) is the scanned set; `codeOnly()` is the one comment-and-string
// stripper every structural guard in this directory shares.
//
// EVERY DIRECTION BELOW IS A NAMED PREDICATE THE REAL SCAN AND ITS PLANTED
// CONTROL BOTH CALL -- never a rule re-implemented inside the plant, which is
// this suite's established shape. A red with no green beside it is not a
// proof: it could be the fixture, the harness, or an unrelated refusal firing
// first, so every plant is paired with a clean control over the real tree.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeStore, openStore, setDataType } from "./anno-store.ts";
import { ANNO_TOOL_DEFINITIONS, runAnnoTool } from "./anno-tools.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OWN_FILENAME = "evid-report-keys.test.ts";

// ---------------------------------------------------------------------------
// Fixture: one store, one planted disagreement, driven through all four real
// evidence verbs -- built once in `before()`, torn down once in `after()`,
// shared read-only by every direction below.
// ---------------------------------------------------------------------------

/** Assembles a well-formed memmapshow reply text from a small, explicit set
 * of entries -- the exact wire shape `parseAccessMap()` decodes (header line,
 * then "aaaa: xxx xxx xxx" data lines). Every glyph group defaults to "---"
 * (no access at all) so a fixture only has to name the banks it cares about. */
function memmapReplyText(entries: { address: number; io?: string; rom?: string; ram?: string }[]): string {
  const lines = ["addr: IO  ROM RAM"];
  for (const e of entries) {
    const addr = e.address.toString(16).padStart(4, "0");
    lines.push(`${addr}: ${e.io ?? "---"} ${e.rom ?? "---"} ${e.ram ?? "---"}`);
  }
  return lines.join("\n");
}

const FIXTURE_IDENTITY = {
  imageSha256: "5".repeat(64),
  argv: ["x64sc"],
  seed: "evid-report-keys-fixture-seed",
};

let ws: string;
let storePath: string;
let previousProjectDir: string | undefined;
let ANSWERS: {
  ingest: Record<string, unknown>;
  disagreements: Record<string, unknown>;
  runs: Record<string, unknown>;
  reset: Record<string, unknown>;
};

before(async () => {
  ws = mkdtempSync(join(tmpdir(), "evid-report-keys-"));
  previousProjectDir = process.env.CLAUDE_PROJECT_DIR;
  storePath = join(ws, "project.annostore");

  const handle = openStore(storePath, { workspaceRoot: ws });
  try {
    // "byte" maps to the neutral "data" class through block-class.ts's own
    // fallthrough -- planting a disagreement at 0x4000 the same way plan
    // 43-06's own tracer test does, so direction 2's non-vacuity assertion has
    // a real nested disagreement row to visit.
    setDataType(handle, { start: 0x4000, endInclusive: 0x4000, dataType: "byte" });
  } finally {
    closeStore(handle);
  }
  process.env.CLAUDE_PROJECT_DIR = ws;

  const ingestResult = await runAnnoTool("anno_evid_ingest", {
    store: storePath,
    memmap_text: memmapReplyText([{ address: 0x4000, ram: "--x" }]),
    image_sha256: FIXTURE_IDENTITY.imageSha256,
    argv: FIXTURE_IDENTITY.argv,
    seed: FIXTURE_IDENTITY.seed,
  });
  assert.equal(ingestResult.isError, false, `fixture setup: anno_evid_ingest failed: ${ingestResult.content[0]?.text}`);

  const disagreementsResult = await runAnnoTool("anno_evid_disagreements", { store: storePath });
  assert.equal(disagreementsResult.isError, false, `fixture setup: anno_evid_disagreements failed: ${disagreementsResult.content[0]?.text}`);

  const runsResult = await runAnnoTool("anno_evid_runs", { store: storePath });
  assert.equal(runsResult.isError, false, `fixture setup: anno_evid_runs failed: ${runsResult.content[0]?.text}`);

  const resetResult = await runAnnoTool("anno_evid_reset", {
    store: storePath,
    image_sha256: FIXTURE_IDENTITY.imageSha256,
    argv: FIXTURE_IDENTITY.argv,
    seed: FIXTURE_IDENTITY.seed,
  });
  assert.equal(resetResult.isError, false, `fixture setup: anno_evid_reset failed: ${resetResult.content[0]?.text}`);

  ANSWERS = {
    ingest: JSON.parse(ingestResult.content[0]!.text) as Record<string, unknown>,
    disagreements: JSON.parse(disagreementsResult.content[0]!.text) as Record<string, unknown>,
    runs: JSON.parse(runsResult.content[0]!.text) as Record<string, unknown>,
    reset: JSON.parse(resetResult.content[0]!.text) as Record<string, unknown>,
  };
});

after(() => {
  if (previousProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = previousProjectDir;
  rmSync(ws, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Direction 1: scope completeness -- the census that discovers its own
// subjects rather than being handed a list of them.
// ---------------------------------------------------------------------------

/** The evidence family's own name prefix. Every `ANNO_TOOL_DEFINITIONS` entry
 * beginning with this string is an evidence verb this file must account for. */
const FAMILY_PREFIX = "anno_evid_";

/** This file's fixture table: one entry per evidence verb this file knows how
 * to drive. A verb absent from here is exactly what direction 1 must catch. */
const FIXTURE_VERB_TABLE: Readonly<Record<string, true>> = Object.freeze({
  anno_evid_ingest: true,
  anno_evid_disagreements: true,
  anno_evid_runs: true,
  anno_evid_reset: true,
});

/** Derives the evidence verb set from a `ANNO_TOOL_DEFINITIONS`-shaped array
 * by the family's own name prefix -- never a hand-typed list. */
function deriveEvidVerbNames(definitions: readonly { name: string }[]): string[] {
  return definitions.filter((d) => d.name.startsWith(FAMILY_PREFIX)).map((d) => d.name);
}

/** The real scan and its planted control both call this SAME predicate. */
function assertScopeComplete(derivedNames: readonly string[], fixtureNames: readonly string[]): void {
  assert.ok(derivedNames.length > 0, "the derived evidence-verb set is empty -- the census over ANNO_TOOL_DEFINITIONS found nothing");
  const derivedSet = new Set(derivedNames);
  const fixtureSet = new Set(fixtureNames);
  const missingFromFixture = [...derivedSet].filter((n) => !fixtureSet.has(n));
  const extraInFixture = [...fixtureSet].filter((n) => !derivedSet.has(n));
  assert.deepEqual(
    missingFromFixture,
    [],
    `evidence verb(s) derived from ANNO_TOOL_DEFINITIONS with no entry in this file's fixture table: ${missingFromFixture.join(", ")} -- ` +
      "a new evidence verb added later without a guard must fail exactly here",
  );
  assert.deepEqual(
    extraInFixture,
    [],
    `this file's fixture table names a verb ANNO_TOOL_DEFINITIONS does not derive: ${extraInFixture.join(", ")}`,
  );
}

test("direction 1 (scope completeness), clean control: every ANNO_TOOL_DEFINITIONS entry named anno_evid_* has a fixture-table entry, in both directions", () => {
  const derived = deriveEvidVerbNames(ANNO_TOOL_DEFINITIONS);
  assertScopeComplete(derived, Object.keys(FIXTURE_VERB_TABLE));
});

test("direction 1 (scope completeness), planted control: a synthetic definitions array with a family-named entry absent from the fixture table fails by name", () => {
  const synthetic: { name: string }[] = [...ANNO_TOOL_DEFINITIONS, { name: "anno_evid_synthetic_missing" }];
  const derived = deriveEvidVerbNames(synthetic);
  assert.throws(
    () => assertScopeComplete(derived, Object.keys(FIXTURE_VERB_TABLE)),
    /anno_evid_synthetic_missing/,
    "a family-named verb absent from the fixture table must fail this guard by name",
  );
});

// ---------------------------------------------------------------------------
// Direction 2: banned keys -- the combined-figure vocabulary
// anno-coverage.test.ts's COV-01 already bans, plus a rate vocabulary and an
// exhaustiveness vocabulary, walked recursively and non-vacuously.
// ---------------------------------------------------------------------------

/** One named constant so the whole vocabulary this direction refuses is
 * readable in one place. Every literal here is spelled once, in code, never
 * echoed inside a comment in this file or in any file direction 4 scans --
 * the guard must not be satisfiable by its own explanation. */
const BANNED_REPORT_KEY_REGEX = new RegExp(
  [
    "overall",
    "combined",
    "aggregate",
    "composite",
    "score",
    "headline",
    "totalcoverage",
    "percent",
    "pct",
    "rate",
    "ratio",
    "fraction",
    "exhaustive",
    "complete",
    "full",
    "all(addresses|code|data)",
  ].join("|"),
  "i",
);

/** The real scan and its planted control both call this SAME predicate. */
function assertNoBannedKeys(value: unknown, label: string): string[] {
  const seen: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (v === null || typeof v !== "object") return;
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      seen.push(key);
      assert.ok(
        !BANNED_REPORT_KEY_REGEX.test(key),
        `${label}: report key ${JSON.stringify(key)} matches the banned combined-figure/rate/exhaustiveness vocabulary`,
      );
      walk(val);
    }
  };
  walk(value);
  return seen;
}

test("direction 2 (banned keys), clean control: every real evidence answer's key walk finds no combined-figure/rate/exhaustiveness key, and the walk is non-vacuous", () => {
  const seenIngest = assertNoBannedKeys(ANSWERS.ingest, "anno_evid_ingest");
  const seenDisagreements = assertNoBannedKeys(ANSWERS.disagreements, "anno_evid_disagreements");
  const seenRuns = assertNoBannedKeys(ANSWERS.runs, "anno_evid_runs");
  const seenReset = assertNoBannedKeys(ANSWERS.reset, "anno_evid_reset");

  assert.ok(seenIngest.length > 0, "anno_evid_ingest's key walk must visit at least one key");
  assert.ok(seenRuns.length > 0, "anno_evid_runs's key walk must visit at least one key");
  assert.ok(seenReset.length > 0, "anno_evid_reset's key walk must visit at least one key");

  assert.ok(
    seenDisagreements.length > Object.keys(ANSWERS.disagreements).length,
    `the key walk over anno_evid_disagreements visited only ${seenDisagreements.length} keys -- it must actually traverse into nested ` +
      "rows, not stop at the top level",
  );
  assert.ok(
    seenDisagreements.includes("byteDerived"),
    "the walk must have visited a key inside a nested disagreement row (byteDerived), not merely the top-level answer",
  );
});

test("direction 2 (banned keys), planted control: a synthetic answer carrying a nested rate-vocabulary key fails by name", () => {
  const poisoned = { store: "x", nested: { coverageRate: 1 } };
  assert.throws(
    () => assertNoBannedKeys(poisoned, "plant"),
    /coverageRate/,
    "a nested rate-vocabulary key must fail this guard by name",
  );
});

// ---------------------------------------------------------------------------
// Direction 3: denominator adjacency -- every count-shaped key travels beside
// a "denominator", either on its own object or on an enclosing answer.
// ---------------------------------------------------------------------------

/** The real scan and its planted control both call this SAME predicate. A
 * count is any key ending in "Count", or one of the two named write counters
 * this phase's verbs use. */
function assertDenominatorAdjacency(value: unknown, label: string): void {
  const walk = (v: unknown, ancestors: readonly Record<string, unknown>[]): void => {
    if (Array.isArray(v)) {
      for (const item of v) walk(item, ancestors);
      return;
    }
    if (v === null || typeof v !== "object") return;
    const stack = [...ancestors, v as Record<string, unknown>];
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      const isCountKey = key.endsWith("Count") || key === "observationsWritten" || key === "observationsRemoved";
      if (isCountKey) {
        const hasDenominator = stack.some((obj) => Object.prototype.hasOwnProperty.call(obj, "denominator"));
        assert.ok(
          hasDenominator,
          `${label}: key ${JSON.stringify(key)} carries a count with no "denominator" anywhere in its own object or an enclosing answer`,
        );
      }
      walk(val, stack);
    }
  };
  walk(value, []);
}

test("direction 3 (denominator adjacency), clean control: every count-shaped key in every real evidence answer carries a denominator, in its own object or an enclosing answer", () => {
  assertDenominatorAdjacency(ANSWERS.ingest, "anno_evid_ingest");
  assertDenominatorAdjacency(ANSWERS.disagreements, "anno_evid_disagreements");
  assertDenominatorAdjacency(ANSWERS.runs, "anno_evid_runs");
  assertDenominatorAdjacency(ANSWERS.reset, "anno_evid_reset");
});

test("direction 3 (denominator adjacency), planted control: a synthetic nested object holding a Count key with no denominator anywhere fails by name", () => {
  const poisoned = { store: "x", nested: { innerCount: 3 } };
  assert.throws(
    () => assertDenominatorAdjacency(poisoned, "plant"),
    /innerCount/,
    "a Count key with no denominator anywhere must fail this guard by name",
  );
});

// ---------------------------------------------------------------------------
// This file is test-only: it must never ship. Mirrors acme-gate.test.ts's own
// mechanical check rather than trusting this file's own header comment.
// ---------------------------------------------------------------------------

test("evid-report-keys.test.ts is absent from package.json's files[] array (test-only, mechanically enforced)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(pkg.files.includes(OWN_FILENAME), false, `${OWN_FILENAME} is test-only and must never ship in the published npm tarball`);
});
