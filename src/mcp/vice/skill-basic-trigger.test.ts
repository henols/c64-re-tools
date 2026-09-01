// skill-basic-trigger.test.ts
//
// WHY THIS FILE EXISTS: FUT-01 DEFERS BASIC-token decoding. A skill's
// `description:` is literally its trigger mechanism (ABS-03), so the deferral
// only holds if none of the BASIC-token trigger vocabulary reaches one --
// otherwise the deferred capability fires and a skill claims a capability
// this project does not deliver.
//
// PROVENANCE: extracted verbatim from a retired attribution guard whose
// remaining content policed a third-party provenance chain this repository no
// longer carries. These two checks never depended on that chain -- they are
// about THIS project's own descriptions -- so they are kept under their own
// name rather than deleted alongside it.
//
// Matched case-insensitively against every `description:` frontmatter value
// under `src/skills/`, and ONLY against those: a reference-only section's
// BODY is allowed -- required, even -- to use these words, because a reader
// consulting it needs them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

import { repoRoot } from "./repo-root.ts";
import { walkSkills } from "../../../scripts/lib/skill-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const SKILLS_DIR = join(ROOT, "src/skills");

/** The BASIC-token trigger vocabulary. The set's own length is asserted
 * non-zero so an emptied set cannot make the check vacuous. */
const DEFERRED_BASIC_TRIGGER_PHRASES: readonly string[] = [
  "basic token",
  "basic command",
  "basic line",
  "basic code",
  "basic pointer",
  "decode basic",
  "tokenised basic",
  "tokenized basic",
  "detokenise",
  "detokenize",
];

/** Pulls the `description:` value out of a SKILL.md's YAML frontmatter. The
 * frontmatter is the first `---`-delimited block and `description:` is a
 * single logical line in this repository's skills (asserted below by the
 * non-vacuity floor on how many descriptions were found at all). */
function skillDescription(text: string): string | null {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const m = fm[1].match(/^description:[ \t]*(.*)$/m);
  return m ? m[1].trim() : null;
}

test("the deferred BASIC capability cannot fire -- no description carries its trigger vocabulary", () => {
  // Non-vacuity for the phrase set itself: an emptied set must FAIL rather
  // than make the loop below check nothing.
  assert.ok(
    DEFERRED_BASIC_TRIGGER_PHRASES.length > 0,
    "DEFERRED_BASIC_TRIGGER_PHRASES is empty -- an emptied phrase set cannot be allowed to pass"
  );
  const skillMds = walkSkills(SKILLS_DIR).filter((f) => f.endsWith("SKILL.md"));
  // Non-vacuity for the corpus walk: a broken traversal must not read as a
  // clean inventory. A floor, never an equality -- the skill count grows.
  assert.ok(skillMds.length >= 6, `expected at least 6 SKILL.md files, found ${skillMds.length}`);
  const offenders: string[] = [];
  let described = 0;
  for (const file of skillMds) {
    const description = skillDescription(readFileSync(file, "utf8"));
    assert.ok(description, `${relative(ROOT, file)}: no description: value found in frontmatter`);
    described += 1;
    const lower = description.toLowerCase();
    for (const phrase of DEFERRED_BASIC_TRIGGER_PHRASES) {
      if (lower.includes(phrase)) offenders.push(`${relative(ROOT, file)}: "${phrase}"`);
    }
  }
  assert.equal(described, skillMds.length, "not every SKILL.md yielded a description to check");
  assert.deepEqual(
    offenders,
    [],
    `these descriptions carry BASIC-token trigger vocabulary for a capability FUT-01 defers, so the ` +
      `deferred capability would fire as a trigger: ${offenders.join(", ")}`
  );
});

test("the BASIC trigger-phrase predicate bites on a planted description", () => {
  // Rot guard: the check above passes on a clean corpus either because the
  // corpus is clean or because the predicate is broken. Plant the phrase in a
  // real description, IN MEMORY, and confirm it is caught. Nothing is written
  // under src/skills/ -- the working tree is never left dirty by this test.
  const reconPath = join(ROOT, "src/skills/c64-program-recon/SKILL.md");
  const clean = skillDescription(readFileSync(reconPath, "utf8"));
  assert.ok(clean, "c64-program-recon has no description to plant into");
  const planted = `${clean} Use when asked to decode basic commands from memory.`;
  const hits = DEFERRED_BASIC_TRIGGER_PHRASES.filter((p) => planted.toLowerCase().includes(p));
  assert.ok(hits.length > 0, "the planted BASIC trigger phrase was NOT reported -- this proof is vacuous");
  assert.equal(
    DEFERRED_BASIC_TRIGGER_PHRASES.filter((p) => clean.toLowerCase().includes(p)).length,
    0,
    "the real c64-program-recon description already carries BASIC trigger vocabulary"
  );
});
