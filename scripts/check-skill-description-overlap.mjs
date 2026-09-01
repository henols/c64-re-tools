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
//   6. fewer skills scanned than the floor;
//   7. a hand-maintained VERBATIM copy of a description disagreeing with
//      its SKILL.md (19-RESEARCH.md section 4.6 -- CLAUDE.md's
//      project-skills table is the one place a description is duplicated
//      byte-for-byte; README paraphrases and the plugin manifest points at
//      the tree, so neither can drift this way).
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
  copyDisagreements,
  descriptionCollisions,
  expectedPairCount,
  pairScores,
  parseSkillFrontmatter,
  skillTableDescriptions,
  skillsWithNoComparableClauses,
} from "./lib/skill-descriptions.mjs";
import { parseRootArg, resolveContainedRoot } from "./lib/audit-root.mjs";

const DEFAULT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Every path this gate reads, derived from ONE root, plus the subset that must
 * EXIST for the run to mean anything.
 *
 * WHY THIS FUNCTION EXISTS (phase 32, D-07): the phase-32 audit has to observe
 * this gate FAILING against a planted violation, and the only safe way to
 * arrange that for some rows is to point the whole gate at a synthetic tree
 * via `--root`. That is only sound if EVERY path comes from the one root.
 *
 * WHAT NOT TO DO: do not re-derive a path from `DEFAULT_ROOT` anywhere below.
 * A root threaded through only SOME of the paths reads the synthetic tree for
 * one input and the real repository for another, and a planted violation in
 * the synthetic tree then goes silently unobserved -- a false green, which is
 * the exact failure mode this whole phase exists to rule out.
 */
function paths(root) {
  const skillsDir = join(root, "src/skills");
  return {
    root,
    skillsDir,
    // CLAUDE.md lives HERE, in paths(), and not beside the check that reads it
    // (where it used to be declared, far from the other path constants). Under
    // `--root` a CLAUDE.md resolved from DEFAULT_ROOT would compare the REAL
    // repository's project-skills table against the SYNTHETIC tree's skills --
    // a split-root read in which a planted table disagreement is invisible
    // because the planted table is never the one read.
    claudeMd: join(root, "CLAUDE.md"),
    required: [skillsDir],
  };
}

// `--root <dir>` is the ONLY new surface, and it is this gate's only
// testability seam: there is deliberately no environment-variable override, no
// skip flag and no waiver file anywhere in it (the no-relaxation-hatch rule
// recorded in `scripts/audit-gate.mjs`'s header). A root that cannot be
// honoured REFUSES; it never degrades into a silent read of the default root.
//
// THIS FILE HAS NO ARGV READER OF ITS OWN, BY DESIGN. It had one, and the
// comment that stood here claimed it was the "same argv shape as
// `scripts/audit-gate.mjs`'s own `parseArgs()`". That claim was accurate, and
// that was precisely the defect: the same nine lines were copy-pasted verbatim
// into six scripts, so ONE bug shipped six times (`IN-06`) -- the loop matched
// only the exact token `--root` and took `argv[i + 1]`, so `--root=<dir>`, a
// valueless `--root` and every typo were SILENTLY DISCARDED and the run fell
// through to the default root while reporting success. `parseRootArg()` in
// `lib/audit-root.mjs` is now the single argv seam, as `resolveContainedRoot()`
// is the single containment seam.
//
// CORRECTION (2026-09-01, phase 32 gap-closure round 2, plan 32-16).
// `scripts/audit-gate.mjs` IS now on the shared strict parser: it reads its
// arguments through `parseRootArg()` too, declaring `--json` and `--hook` as
// `booleanFlags`, and its own hand-rolled reader is gone. The note that stood
// here SAID that file had deliberately not been migrated (`WR-13`), and gave
// as its reason that the file carried five further flags with their own
// exactly-one-selector rule. That reason was FALSE when it was written.
// Measured: `audit-gate.mjs` accepts three flags in total -- `--root`,
// `--json` and `--hook` -- and has no selector rule at all. The description
// belonged to `scripts/audit-mutation-harness.mjs` (RETIRED), which does carry five
// flags (`--root`, `--row`, `--rows`, `--all`, `--out`) and does enforce an
// exactly-one-of-`--row`/`--rows`/`--all` rule. A justification written about
// one file was copied into six, which is `IN-06` one layer up: the same
// copy-a-claim-without-checking-it failure, in the comments rather than in the
// code. It is corrected here rather than deleted, because a note recording how
// a wrong claim spread is the cheapest protection against it spreading again.
//
// `audit-gate.mjs` is on the argv seam but deliberately NOT on the containment
// seam. The measurement behind that asymmetry, and its named reversal trigger,
// are recorded in that file's own header -- once, there, rather than restated
// in each of the six files this correction touches.

// An ARGUMENT REJECTION. Reported before anything is resolved or read, and
// kept at exit 1 like the refusal below: the two are separated by their
// message (`BAD ARGUMENTS --` versus `REFUSED --`), never by their status.
let ROOT_ARG;
try {
  ({ root: ROOT_ARG } = parseRootArg(process.argv.slice(2), {
    script: "check-skill-description-overlap",
  }));
} catch (err) {
  console.error(`check-skill-description-overlap: ${err?.message ?? String(err)}`);
  process.exit(1);
}

// A REFUSAL (an out-of-repository --root) and a TYPO (a --root inside the
// repository that does not exist, or a tree missing this gate's inputs) exit
// with the SAME code, so they are separated by their message -- the WR-03
// contract behind audit-gate.mjs's own try/catch, where a mistyped root used
// to surface as an uncaught ENOENT indistinguishable from a refusal.
let RESOLVED_ROOT;
try {
  RESOLVED_ROOT = resolveContainedRoot(ROOT_ARG, {
    repoRoot: DEFAULT_ROOT,
  });
} catch (err) {
  console.error(`check-skill-description-overlap: REFUSED -- ${err?.message ?? String(err)}`);
  process.exit(1);
}

const P = paths(RESOLVED_ROOT);

// The ONE try/catch around every call below that can throw on a bad root.
// `P.required` enumerates it: topLevelSkillDirs() throws on a missing skills
// directory. `P.claudeMd` is deliberately NOT required -- check 7 is live-gated
// (a checkout with no project-skills table is a visible SKIP, by design).
try {
  for (const required of [P.root, ...P.required]) {
    if (!existsSync(required)) {
      throw new Error(
        `--root resolves to ${P.root}, but ${required} does not exist. This is a TYPO or an ` +
          "incomplete synthetic tree, NOT a containment refusal: the path is inside the " +
          "repository root. Reported here rather than left to surface as an uncaught ENOENT (or, " +
          "worse, as one of this gate's own non-vacuity failures pointing at the corpus).",
      );
    }
  }
} catch (err) {
  console.error(`check-skill-description-overlap: FAIL (--root) -- ${err?.message ?? String(err)}`);
  process.exit(1);
}

// SKILLS_DIR below is the RESOLVED root's, never DEFAULT_ROOT's. Any new path
// this gate needs goes inside paths() above.
const { skillsDir: SKILLS_DIR } = P;

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

// --- 7. The one hand-maintained VERBATIM copy ------------------------------
// Live-gated in the D-11 style: a checkout without the table (a consumer
// repository, or a CLAUDE.md that never carried one) is a clean SKIP with a
// visible reason, never a silent pass and never a failure. What is NOT
// tolerated is a table that exists and disagrees.
// From paths(), so it resolves from the SAME root as SKILLS_DIR above -- see
// that function's comment for why a split-root read here would be a false green.
const CLAUDE_MD = P.claudeMd;
let copyStatus = "SKIPPED (no CLAUDE.md project-skills table found)";
if (existsSync(CLAUDE_MD)) {
  const table = skillTableDescriptions(readFileSync(CLAUDE_MD, "utf8"));
  if (Object.keys(table).length > 0) {
    const disagreements = copyDisagreements(descriptions, table);
    for (const d of disagreements) {
      need(
        false,
        `CLAUDE.md project-skills table disagrees with src/skills/ for "${d.name}" (${d.kind}):\n` +
          `      SKILL.md:  "${d.canonical}"\n` +
          `      CLAUDE.md: "${d.copy}"\n` +
          `      A verbatim copy that drifts is a description a reader trusts and the dispatcher never sees. ` +
          `Update the table row to match the SKILL.md frontmatter byte-for-byte.`
      );
    }
    copyStatus = `${Object.keys(table).length} rows, all byte-identical to their SKILL.md`;
  }
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
    `allowlist size ${COLLISION_ALLOWLIST.length}; ` +
    `CLAUDE.md project-skills table: ${copyStatus}.`
);
