// skill-basic-trigger.test.ts
//
// WHY THIS FILE EXISTS: FUT-01 DEFERRED BASIC-token decoding -- a skill's
// `description:` is literally its trigger mechanism (ABS-03), so the
// deferral only held while none of the BASIC-token trigger vocabulary
// reached one, otherwise the deferred capability would fire and a skill
// would claim a capability this project did not yet deliver.
//
// Phase 40, plan 40-03 (PREP-02) LIFTS FUT-01 for exactly one skill:
// `c64-petcat` genuinely detokenizes BASIC and resolves its SYS handover
// point, via the real `petcat` host tool (never a hand-written decoder --
// the specific thing FUT-01 deferred, per c64-program-recon's own
// REFERENCE-ONLY section, which states "if a future milestone lifts FUT-01,
// this section is the starting point"). `LIFTED_FOR_SKILLS` below names the
// one skill this applies to, BY NAME, so this remains a guard against a
// FALSE claim everywhere else -- c64-program-recon's own description must
// still never carry this vocabulary, since ITS reference section stays
// deferred and unclaimed.
//
// PROVENANCE: extracted verbatim from a retired attribution guard whose
// remaining content policed a third-party provenance chain this repository no
// longer carries. These two checks never depended on that chain -- they are
// about THIS project's own descriptions -- so they are kept under their own
// name rather than deleted alongside it.
//
// Matched case-insensitively against every `description:` frontmatter value
// under `src/skills/` OTHER than the one named in `LIFTED_FOR_SKILLS`, and
// ONLY against those: a reference-only section's BODY is allowed --
// required, even -- to use these words, because a reader consulting it
// needs them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, relative } from "node:path";

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

/** Phase 40, plan 40-03 (PREP-02): the ONE skill FUT-01 is lifted for --
 * named explicitly, never a substring/pattern match, so a future skill
 * cannot accidentally exempt itself by choosing a similar directory name.
 * `c64-petcat` genuinely detokenizes BASIC via the real `petcat` host tool
 * (never a hand-written decoder, the specific thing FUT-01 deferred) and
 * resolves its SYS handover point -- exactly PREP-02's own requirement text.
 * Every OTHER skill's description is still policed below, in particular
 * c64-program-recon's own REFERENCE-ONLY section, which stays deferred and
 * unclaimed. */
const LIFTED_FOR_SKILLS: ReadonlySet<string> = new Set(["c64-petcat"]);

/** True iff `file` (an absolute SKILL.md path) belongs to a skill named in
 * `LIFTED_FOR_SKILLS` -- matched on the skill's own directory name, the
 * SAME "one level up from SKILL.md" convention `walkSkills()`'s own callers
 * use elsewhere in this codebase. */
function isLiftedSkill(file: string): boolean {
  return LIFTED_FOR_SKILLS.has(basename(dirname(file)));
}

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
  let liftedSkillsSeen = 0;
  for (const file of skillMds) {
    const description = skillDescription(readFileSync(file, "utf8"));
    assert.ok(description, `${relative(ROOT, file)}: no description: value found in frontmatter`);
    described += 1;
    // FUT-01 is lifted for exactly the skill(s) named in LIFTED_FOR_SKILLS
    // (Phase 40, plan 40-03) -- skipped here, never silently, so this
    // remains a guard against a FALSE claim everywhere else.
    if (isLiftedSkill(file)) {
      liftedSkillsSeen += 1;
      continue;
    }
    const lower = description.toLowerCase();
    for (const phrase of DEFERRED_BASIC_TRIGGER_PHRASES) {
      if (lower.includes(phrase)) offenders.push(`${relative(ROOT, file)}: "${phrase}"`);
    }
  }
  assert.equal(described, skillMds.length, "not every SKILL.md yielded a description to check");
  assert.equal(
    liftedSkillsSeen,
    LIFTED_FOR_SKILLS.size,
    "every skill named in LIFTED_FOR_SKILLS must actually exist in the corpus -- an exemption for a skill that was renamed or removed must not silently keep exempting nothing",
  );
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

test("the FUT-01 lift is real, not vacuous: c64-petcat's own description genuinely carries the trigger vocabulary the exemption above skips", () => {
  const petcatPath = join(ROOT, "src/skills/c64-petcat/SKILL.md");
  assert.ok(isLiftedSkill(petcatPath), "c64-petcat must be recognised as a lifted skill by isLiftedSkill()");
  const description = skillDescription(readFileSync(petcatPath, "utf8"));
  assert.ok(description, "c64-petcat has no description to check");
  const hits = DEFERRED_BASIC_TRIGGER_PHRASES.filter((p) => description.toLowerCase().includes(p));
  assert.ok(
    hits.length > 0,
    "c64-petcat's description carries none of the BASIC-token trigger vocabulary -- the exemption in the test above is currently a no-op",
  );
});
