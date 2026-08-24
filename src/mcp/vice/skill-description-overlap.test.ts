// skill-description-overlap.test.ts -- the non-vacuity/planted-violation
// proof for `scripts/lib/skill-descriptions.mjs`, the predicate module
// `scripts/check-skill-description-overlap.mjs` (ABS-03) checks with.
//
// `check-skill-description-overlap.mjs` runs its whole check at import time
// (a plain top-level script, not a callable function), so its predicates
// could otherwise be proven non-vacuous only by re-running the live script
// and reading its exit code -- which says nothing about whether the
// PREDICATE itself distinguishes a colliding pair from a clean one. This
// file imports the SAME module the CI script imports (never a second copy
// of any predicate), so proving them here proves the predicates the CI
// script runs in production. The live script gets exactly one assertion
// at the bottom: it exits 0 and prints its OK line.
//
// The two controls that make the threshold mean something both live here:
//   - the POSITIVE control (an exact-duplicate clause scores 1.0 and is
//     reported), without which the check could be measuring nothing;
//   - the FALSE-POSITIVE control (the two real 0.200 pairs 19-RESEARCH.md
//     section 4.3 measured must NOT be reported against the real corpus),
//     without which the threshold could be set low enough to fire on a
//     clean tree and would then be "fixed" by exempting real skills.
//
// NOT SHIPPED: this file verifies repository wiring, not runtime
// behaviour, and is deliberately absent from package.json's files[].
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { topLevelSkillDirs } from "../../../scripts/lib/skill-corpus.mjs";
import {
  COLLISION_ALLOWLIST,
  DESCRIPTION_OVERLAP_THRESHOLD,
  allowlistAudit,
  clauseTokens,
  descriptionCollisions,
  entryCoversCollision,
  expectedPairCount,
  jaccard,
  normaliseClause,
  pairScores,
  parseSkillFrontmatter,
  skillsWithNoComparableClauses,
  splitTriggerClauses,
} from "../../../scripts/lib/skill-descriptions.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = join(HERE, "..", "..", ".."); // <root>
const SKILLS_DIR = join(ROOT, "src", "skills");
const CI_SCRIPT = join(ROOT, "scripts", "check-skill-description-overlap.mjs");

/** The real corpus, built exactly the way the CI runner builds it. */
function realCorpus(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const dir of topLevelSkillDirs(SKILLS_DIR)) {
    const p = join(SKILLS_DIR, dir, "SKILL.md");
    if (!existsSync(p)) continue;
    const { name, description } = parseSkillFrontmatter(readFileSync(p, "utf8"));
    map[name || dir] = description;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Frontmatter and clause splitting
// ---------------------------------------------------------------------------

test("parseSkillFrontmatter(): reads name and description out of a real SKILL.md", () => {
  const src = readFileSync(join(SKILLS_DIR, "acme-build", "SKILL.md"), "utf8");
  const fm = parseSkillFrontmatter(src);
  assert.equal(fm.name, "acme-build");
  assert.match(fm.description, /ACME cross assembler/);
});

test("parseSkillFrontmatter(): a file with no frontmatter yields two empty strings, never a throw", () => {
  assert.deepEqual(parseSkillFrontmatter("# Just a heading\n"), { name: "", description: "" });
});

test("splitTriggerClauses(): cuts at the first trigger phrase, keeps the capability sentence whole, splits the tail", () => {
  const clauses = splitTriggerClauses(
    "Do one clear thing, with a comma in it. Use when asked to alpha, beta or gamma; delta."
  );
  assert.equal(clauses[0], "Do one clear thing, with a comma in it.");
  assert.ok(clauses.includes("beta"));
  assert.ok(clauses.includes("gamma"));
  assert.ok(clauses.includes("delta"));
});

test("splitTriggerClauses(): a description with no trigger phrase yields the capability sentence alone", () => {
  assert.deepEqual(splitTriggerClauses("Just a capability sentence"), ["Just a capability sentence"]);
});

// ---------------------------------------------------------------------------
// Normalisation -- every step pinned individually, so a silent change to
// any ONE of them fails here rather than quietly moving every score.
// ---------------------------------------------------------------------------

test("normalisation step 1+2: lowercasing, backticks and emphasis markers are stripped", () => {
  assert.deepEqual(normaliseClause("`Sprite` *Charset* _Raster_"), ["sprite", "charset", "raster"]);
});

test("normalisation step 3: both dash forms become a plain hyphen and split the token", () => {
  assert.deepEqual(normaliseClause("read—write check"), ["read", "write", "check"]);
  assert.deepEqual(normaliseClause("read–write check"), ["read", "write", "check"]);
});

test("normalisation step 4: characters outside the safe set are dropped, and $ survives so $d020 stays one token", () => {
  assert.deepEqual(normaliseClause("look up $D020!! (please)"), ["look", "up", "$d020", "please"]);
});

test("normalisation step 5: whitespace AND hyphens both split", () => {
  assert.deepEqual(normaliseClause("multi-caller dispatch"), ["multi", "caller", "dispatch"]);
});

test("normalisation step 6: the crude stemmer fires only above four characters", () => {
  // "uses" is four characters -- below the gate, untouched.
  assert.deepEqual(normaliseClause("uses"), ["uses"]);
  // Above the gate: ies->y, then ing, ed, es, s in that order.
  assert.deepEqual(normaliseClause("entries running patched releases labels"), [
    "entry",
    "runn",
    "patch",
    "releas",
    "label",
  ]);
});

test("normalisation step 7: both stop-lists are dropped, and the domain list is dropped in its STEMMED form too", () => {
  // Function words and domain words alike vanish; "bytes" stems to the same
  // form as the stop-list's own "bytes" entry, so the plural drops as well.
  assert.deepEqual(normaliseClause("the C64 program bytes at any memory address"), []);
});

test("clauseTokens(): collapses duplicates into a set", () => {
  assert.deepEqual([...clauseTokens("sprite sprite sprite charset")].sort(), ["charset", "sprite"]);
});

// ---------------------------------------------------------------------------
// Jaccard
// ---------------------------------------------------------------------------

test("jaccard(): identical sets score 1, disjoint sets score 0, and two empty sets score 0 rather than 1", () => {
  assert.equal(jaccard(new Set(["a", "b"]), new Set(["a", "b"])), 1);
  assert.equal(jaccard(new Set(["a"]), new Set(["b"])), 0);
  assert.equal(jaccard(new Set(), new Set()), 0);
});

// ---------------------------------------------------------------------------
// Positive control -- the check is measuring something
// ---------------------------------------------------------------------------

test("planted violation: an exact-duplicate description scores the maximum and IS reported", () => {
  const shared = "Do a specific thing. Use when asked to walk a dispatch table, or resolve a jump vector.";
  const collisions = descriptionCollisions({ "skill-one": shared, "skill-two": shared });
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].score, 1);
  assert.equal(collisions[0].identical, true);
  assert.equal(collisions[0].a, "skill-one");
  assert.equal(collisions[0].b, "skill-two");
  assert.equal(collisions[0].clauseA, collisions[0].clauseB);
});

test("identical normalised clauses collide REGARDLESS of the threshold, even at an absurd one", () => {
  const shared = "Cap. Use when asked to walk a dispatch table.";
  const collisions = descriptionCollisions(
    { "skill-one": shared, "skill-two": shared },
    { threshold: 99 }
  );
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].identical, true);
});

test("negative control: a pair sharing ONLY stop-list vocabulary is not reported", () => {
  const collisions = descriptionCollisions({
    "skill-one": "Cap one. Use when asked to look at the C64 program memory bytes for a sprite.",
    "skill-two": "Cap two. Use when asked to look at the C64 program memory bytes for a raster.",
  });
  // "look" survives on both, but so do "sprite"/"raster" -- the shared
  // material is exactly the vocabulary the stop-lists exist to discard.
  assert.deepEqual(collisions, []);
});

// ---------------------------------------------------------------------------
// The inclusive comparison, and the one-token rule
// ---------------------------------------------------------------------------

test("a pair scoring EXACTLY at the threshold IS reported -- the comparison is inclusive, not strict", () => {
  // Two clauses of two tokens each sharing exactly one: 1 shared / 3 union = 1/3.
  const map = {
    "skill-one": "Cap one. Use when asked to sprite charset.",
    "skill-two": "Cap two. Use when asked to sprite raster.",
  };
  const exact = pairScores(map)[0].score;
  assert.ok(exact > 0, "the synthetic pair must score above zero for this test to mean anything");
  assert.equal(descriptionCollisions(map, { threshold: exact }).length, 1);
  // One notch above the observed score and it must NOT be reported -- proving
  // the assertion above is about the boundary and not about everything.
  assert.equal(descriptionCollisions(map, { threshold: exact + 1e-9 }).length, 0);
});

test("a clause with fewer than two surviving tokens is ignored entirely", () => {
  // "sprite" alone survives on both sides; if one-token clauses counted, this
  // pair would score 1.0 and be reported.
  const map = {
    // Capability sentences deliberately share nothing, so the ONLY thing
    // that could make this pair collide is the one-token trigger clause.
    "skill-one": "Assemble source into a loadable image.",
    "skill-two": "Diff two releases at an anchor.",
  };
  assert.equal(clauseTokens("sprite").size, 1);
  assert.ok(pairScores(map)[0].score < DESCRIPTION_OVERLAP_THRESHOLD);
  const withOneTokenClause = {
    "skill-one": map["skill-one"] + " Use when asked to sprite.",
    "skill-two": map["skill-two"] + " Use when asked to sprite.",
  };
  assert.deepEqual(descriptionCollisions(withOneTokenClause), []);
});

test("a description with no trigger phrase and nothing comparable is REPORTED as a failure, not passed", () => {
  const bad = skillsWithNoComparableClauses({
    "empty-skill": "the C64 program",
    "fine-skill": "Cap. Use when asked to walk a dispatch table.",
  });
  assert.deepEqual(bad, ["empty-skill"]);
});

// ---------------------------------------------------------------------------
// Ordering and pair accounting
// ---------------------------------------------------------------------------

test("the returned order is stable under input reordering, and each unordered pair appears exactly once", () => {
  const a = { alpha: "Cap a. Use when asked to walk a dispatch table.", beta: "Cap b. Use when asked to walk a dispatch table.", gamma: "Cap g. Use when asked to render a sprite overlay." };
  const b = { gamma: a.gamma, beta: a.beta, alpha: a.alpha };
  assert.deepEqual(pairScores(a), pairScores(b));
  assert.equal(pairScores(a).length, expectedPairCount(3));
  const seen = new Set(pairScores(a).map((p) => [p.a, p.b].sort().join("::")));
  assert.equal(seen.size, expectedPairCount(3));
});

test("ties break on the two skill names alphabetically, so the report cannot reorder between runs", () => {
  const shared = "Cap. Use when asked to walk a dispatch table.";
  const collisions = descriptionCollisions({ zulu: shared, alpha: shared, mike: shared });
  assert.equal(collisions.length, expectedPairCount(3));
  assert.deepEqual(
    collisions.map((c) => `${c.a}::${c.b}`),
    ["alpha::mike", "alpha::zulu", "mike::zulu"]
  );
});

test("the pairs-compared equality bites on a corpus that lost a SKILL.md", () => {
  // Demonstrated on a SYNTHETIC map, never on the real tree: dropping one
  // entry moves the true pair count, so an assertion pinned to the previous
  // count fails exactly as the runner's does.
  const full = { one: "a", two: "b", three: "c", four: "d" };
  const short: Record<string, string> = { ...full };
  delete short.four;
  assert.equal(expectedPairCount(Object.keys(full).length), 6);
  assert.notEqual(pairScores(short).length, expectedPairCount(Object.keys(full).length));
  assert.equal(pairScores(short).length, expectedPairCount(Object.keys(short).length));
});

// ---------------------------------------------------------------------------
// Allowlist audit -- the shrink-by-failing half
// ---------------------------------------------------------------------------

test("a synthetic STALE allowlist entry is reported as stale", () => {
  const audit = allowlistAudit([], [
    { a: "skill-one", b: "skill-two", clause: "walk a dispatch table", reason: "synthetic", decidedOn: "2026-08-24" },
  ]);
  assert.equal(audit.stale.length, 1);
  assert.equal(audit.uncovered.length, 0);
  assert.equal(audit.malformed.length, 0);
});

test("a live collision with a matching entry is covered; without one it is uncovered", () => {
  const shared = "Cap. Use when asked to walk a dispatch table.";
  const collisions = descriptionCollisions({ "skill-one": shared, "skill-two": shared });
  const entry = {
    a: "skill-two",
    b: "skill-one", // reversed on purpose: coverage is order-insensitive
    clause: collisions[0].clauseA,
    reason: "synthetic",
    decidedOn: "2026-08-24",
  };
  assert.equal(entryCoversCollision(entry, collisions[0]), true);
  assert.equal(allowlistAudit(collisions, [entry]).uncovered.length, 0);
  assert.equal(allowlistAudit(collisions, []).uncovered.length, 1);
});

test("an entry missing its date, its reason or its verbatim clause is reported malformed", () => {
  const audit = allowlistAudit([], [
    { a: "x", b: "y", clause: "c", reason: "r", decidedOn: "not-a-date" },
  ] as never);
  assert.equal(audit.malformed.length, 1);
});

// ---------------------------------------------------------------------------
// The real corpus: the FALSE-POSITIVE control
// ---------------------------------------------------------------------------

test("the real inventory is clean at the threshold, with no allowlist entry of any kind", () => {
  const corpus = realCorpus();
  assert.ok(
    Object.keys(corpus).length >= 6,
    `expected at least 6 skills with a SKILL.md, found ${Object.keys(corpus).length}`
  );
  assert.deepEqual(descriptionCollisions(corpus), []);
  assert.deepEqual(COLLISION_ALLOWLIST, []);
});

test("false-positive control: the real pairs 19-RESEARCH.md section 4.3 measured just below T are NOT reported", () => {
  // Without this control the threshold could be set low enough to be useless
  // and then "fixed" by exempting real skills -- the exact rot the allowlist
  // doctrine exists to prevent. These two pairs are real, correct, and must
  // stay green; their measured scores are recorded beside the threshold in
  // scripts/lib/skill-descriptions.mjs.
  const corpus = realCorpus();
  const scores = new Map(pairScores(corpus).map((p) => [`${p.a}::${p.b}`, p.score]));
  for (const key of ["acme-build::c64-memory-mapping", "c64-ram-capture::vice-wedge-triage"]) {
    const score = scores.get(key);
    assert.ok(score !== undefined, `expected pair ${key} to be compared against the real corpus`);
    assert.ok(
      (score as number) < DESCRIPTION_OVERLAP_THRESHOLD,
      `${key} scored ${score}, at or above the threshold ${DESCRIPTION_OVERLAP_THRESHOLD} -- it must remain a non-collision`
    );
  }
});

test("the observed maximum over the real corpus sits strictly below the threshold, with headroom", () => {
  const top = pairScores(realCorpus())[0];
  assert.ok(
    top.score < DESCRIPTION_OVERLAP_THRESHOLD,
    `observed maximum ${top.score.toFixed(3)} (${top.a} :: ${top.b}) is not below the threshold ${DESCRIPTION_OVERLAP_THRESHOLD}`
  );
});

// ---------------------------------------------------------------------------
// Live-execution control
// ---------------------------------------------------------------------------

test("live-execution control: check-skill-description-overlap.mjs exits 0 with its OK line", () => {
  const result = spawnSync(process.execPath, [CI_SCRIPT], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /check-skill-description-overlap: OK/);
  assert.match(result.stdout, /pairs compared/);
  assert.match(result.stdout, /observed maximum score/);
  assert.match(result.stdout, /threshold/);
  assert.match(result.stdout, /allowlist size/);
});
