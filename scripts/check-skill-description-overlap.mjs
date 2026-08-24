#!/usr/bin/env node
// ABS-03: no two skills in the inventory may contend for the same trigger.
//
// A skill's `description:` frontmatter IS Claude Code's dispatch input. Two
// descriptions asking for the same job is therefore not a cosmetic
// duplication -- it is a dispatch failure in which the wrong playbook fires
// and the right one never does, silently, with no error anywhere. Nothing
// else in this repository looks for it: `check-skill-tool-coverage.mjs`
// asks whether a named tool exists, `check-skill-fork-honesty.mjs` asks
// whether a fork requirement is stated near a mention, and neither has any
// opinion about whether two skills are competing for the same caller.
//
// This is the top-level CI runner. Every PREDICATE it checks with lives in
// `./lib/skill-descriptions.mjs`, and `src/mcp/vice/skill-description-
// overlap.test.ts` imports that SAME module -- see its header for why a
// predicate module has to exist at all for a check that runs at import
// time. The corpus walk comes from `./lib/skill-corpus.mjs`; this file
// derives no second walker (the WR-12 lesson: two copies of one seam agree
// only until one of them changes).
//
// This script only ever reads files and matches text. Skill content is
// untrusted/first-party prose that is parsed, never executed.
//
// FAILURE MODES, all accumulated into `errors` and reported together --
// this script never throws:
//   1. a live collision no allowlist entry covers;
//   2. an allowlist entry covering no live collision (STALE -- delete it);
//   3. a malformed allowlist entry (missing a name, the verbatim clause,
//      a reason or an ISO date);
//   4. a skill whose description yields zero comparable clauses -- an
//      unmeasured description is not a clean one;
//   5. pairs compared not equal to n*(n-1)/2 -- proof the traversal
//      actually happened;
//   6. fewer skills scanned than the floor.
//
// WHY (6) IS A FLOOR AND NEVER AN EQUALITY: a census assertion pinned to an
// exact count goes red on a correct tree the day a skill is added, and this
// project has already paid for that once (the installer skill-count pin,
// fixed in 19-01 by making it a relation plus a floor rather than a 6->7
// bump). 19-05-PLAN.md carries a source-level acceptance criterion that no
// exact-length equality appears in this file.
//
// HOW A COLLISION IS RESOLVED: by SHARPENING a description -- naming the
// distinguishing input the caller has in hand or the output they get back.
// NEVER by removing a skill from the scanned inventory, never by adding a
// permanent exemption, and never by raising the threshold. That is a
// prohibition in this requirement's own plan, and the threshold constant
// carries the measurement that fixes its value.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { topLevelSkillDirs } from "./lib/skill-corpus.mjs";
import {
  COLLISION_ALLOWLIST,
  DESCRIPTION_OVERLAP_THRESHOLD,
  allowlistAudit,
  descriptionCollisions,
  expectedPairCount,
  pairScores,
  parseSkillFrontmatter,
  skillsWithNoComparableClauses,
} from "./lib/skill-descriptions.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SKILLS_DIR = join(ROOT, "src/skills");

/** Floor, not an equality -- see the header. Seven skills exist today
 * (19-01 added the seventh); six is the floor every other gate in this
 * repository already uses for the same corpus, kept identical so the three
 * gates cannot disagree about what "suspiciously few skills" means. */
const MIN_SKILLS_SCANNED = 6;

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// --- Build the corpus: one description per top-level skill directory -------
// Only directories carrying their own SKILL.md participate; a directory of
// shared references with no playbook has no description and no trigger.
const dirs = topLevelSkillDirs(SKILLS_DIR);
const descriptions = {};
const dirForName = new Map();
for (const dir of dirs) {
  const skillPath = join(SKILLS_DIR, dir, "SKILL.md");
  if (!existsSync(skillPath)) continue;
  const { name, description } = parseSkillFrontmatter(readFileSync(skillPath, "utf8"));
  const key = name || dir;
  need(
    name !== "",
    `${dir}/SKILL.md: frontmatter carries no name: field -- the description cannot be attributed to a skill`
  );
  need(
    description !== "",
    `${dir}/SKILL.md: frontmatter carries no description: field -- a skill with no description can never be dispatched, and cannot be checked for contention`
  );
  need(
    !dirForName.has(key),
    `duplicate skill name "${key}": declared by both ${dirForName.get(key)}/SKILL.md and ${dir}/SKILL.md`
  );
  dirForName.set(key, dir);
  descriptions[key] = description;
}

const names = Object.keys(descriptions);

// --- 6. Floor on the scanned count -----------------------------------------
need(
  names.length >= MIN_SKILLS_SCANNED,
  `non-vacuity: expected at least ${MIN_SKILLS_SCANNED} skill directories carrying a SKILL.md, scanned ${names.length} (${names.join(", ")}) -- the corpus walk or the frontmatter parse may be broken`
);

// --- 4. Every description must yield something comparable ------------------
for (const name of skillsWithNoComparableClauses(descriptions)) {
  need(
    false,
    `${name}: its description yields ZERO comparable clauses (every clause normalises to fewer than two surviving tokens). ` +
      `An unmeasured description is not a clean one -- it is invisible to this check. Resolve by writing a description in the ` +
      `established shape: a capability sentence, then "Use when asked to ..." trigger clauses naming the distinguishing input or output.`
  );
}

// --- 5. The traversal actually happened ------------------------------------
const scored = pairScores(descriptions);
const pairsCompared = scored.length;
need(
  pairsCompared === expectedPairCount(names.length),
  `non-vacuity: compared ${pairsCompared} pairs but ${names.length} skills have ${expectedPairCount(names.length)} unordered pairs -- ` +
    `the pair traversal is not covering the corpus, so a collision could sit in an uncompared pair and never be reported`
);

// --- 1/2/3. Collisions and the allowlist audit -----------------------------
const collisions = descriptionCollisions(descriptions);
const { uncovered, stale, malformed } = allowlistAudit(collisions, COLLISION_ALLOWLIST);

for (const c of uncovered) {
  need(
    false,
    `trigger contention: ${c.a} :: ${c.b} score ${c.score.toFixed(3)} ` +
      `(threshold ${DESCRIPTION_OVERLAP_THRESHOLD}${c.identical ? ", IDENTICAL normalised clause -- contends regardless of the threshold" : ""})\n` +
      `      ${c.a}: "${c.clauseA}"\n` +
      `      ${c.b}: "${c.clauseB}"\n` +
      `      Resolve by SHARPENING one of the two descriptions -- name the distinguishing input the caller has in hand, or the ` +
      `output they get back. Do NOT remove a skill from the inventory, do NOT raise the threshold, and add a COLLISION_ALLOWLIST ` +
      `entry only if this contention is genuinely correct behaviour.`
  );
}

for (const e of stale) {
  need(
    false,
    `STALE allowlist entry: {${e.a} :: ${e.b}, clause "${e.clause}"} covers no live collision. ` +
      `DELETE it. This allowlist is designed to SHRINK BY FAILING -- an allowlist that can only ever grow is how a check rots ` +
      `into a permanent exemption.`
  );
}

for (const e of malformed) {
  need(
    false,
    `malformed allowlist entry ${JSON.stringify(e)}: every entry must carry both skill names (a, b), the colliding clause verbatim ` +
      `(clause), a reason (reason) and an ISO date (decidedOn, YYYY-MM-DD).`
  );
}

// --- Report ----------------------------------------------------------------
if (errors.length) {
  console.error("check-skill-description-overlap: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const top = scored[0] || { a: "-", b: "-", score: 0 };
console.log(
  `check-skill-description-overlap: OK -- ${names.length} skills scanned (${names.join(", ")}); ` +
    `${pairsCompared} pairs compared (n*(n-1)/2 for n=${names.length}); ` +
    `observed maximum score ${top.score.toFixed(3)} from ${top.a} :: ${top.b}; ` +
    `threshold ${DESCRIPTION_OVERLAP_THRESHOLD} (inclusive); ` +
    `allowlist size ${COLLISION_ALLOWLIST.length}.`
);
