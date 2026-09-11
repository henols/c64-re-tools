// skills-planning-vocabulary.test.ts
//
// WHY THIS FILE EXISTS: `src/skills/**` is read by someone who installed a
// plugin or ran `npx @henols/c64-re-tools`. That reader has no `.planning/`
// tree, has never run GSD, and cannot act on a single token of this project's
// planning bookkeeping. Five shipped `SKILL.md` files nonetheless carried a
// footer telling them to "file findings in `.planning/RE-FINDINGS.md`" and to
// enter file-changing work "through a GSD command (`/gsd-quick`)", and two
// told them incident records land under `.planning/incidents/` -- a location
// abandoned on 2026-09-08 when that output moved to `.c64-re-tools/incidents/`
// precisely because writing into a consumer's planning tree was wrong.
//
// `.planning/RE-FINDINGS.md`, the single most-cited target in that footer, has
// NEVER EXISTED in this repository at any commit. It arrived on 2026-08-09
// with source extracted from another GSD-managed project and was never
// repointed. A guard is the only thing that keeps it from coming back: the
// convention that produced it was written down in a file
// (`.planning/codebase/CONVENTIONS.md`) that `/gsd-map-codebase` REGENERATES
// from whatever the tree currently looks like, so a prose repeal alone decays.
// See `.planning/ENGINEERING_RULES.md` § 21.
//
// WHAT THIS GUARD IS NOT. It does not scan `src/mcp/vice/**`. That tree still
// holds a large legacy population of the same vocabulary in its comments
// (1659 occurrences across 95 of the 103 shipped modules, MEASURED
// 2026-09-11). Those are a known, recorded backlog; widening this guard to
// cover them today would make it red on arrival, and a guard that is red on
// arrival gets switched off rather than obeyed. It is scoped to the surface
// where the reference is unresolvable FOR THE READER and where the population
// is already at zero, so it can hold that line from the first commit.
//
// WHY NOT REUSE docs-dangling-refs.test.ts's FLOW-02 CHECK: that guard is
// deliberately, permanently scoped to shipped STRING and TEMPLATE LITERALS,
// because a comment legitimately quotes old wording in a "what NOT to do"
// note. That scoping is correct for the MCP server and is not reopened here.
// It is the wrong line for a skill: a skill is PROSE, addressed to the reader,
// and there is no maintainer-only region of it. So this guard reads whole
// files -- comments, prose and literals alike -- and instead earns its
// precision from two narrow, named exemptions rather than from a syntactic
// scope.
//
// THE ONE EXEMPTION, AND WHY IT IS SAFE.
//
//   A SKILL'S OWN NUMBERED WORKFLOW STEPS. `routine-queue-walker/SKILL.md`
//   runs "Phase 0" through "Phase 5" as its own procedure; 23 of its lines
//   mention a phase and not one of them refers to a GSD phase. A blanket ban
//   would put 23 false positives on the largest apparent offender on day one.
//   The exemption is NOT "ignore this file": it reads the `## Phase N`
//   headings the file itself declares and exempts ONLY those exact numbers.
//   `routine-queue-walker` declares 0-5, so `Phase 3` is fine there and `Phase
//   40` is still a violation there. A file that declares no such heading gets
//   no exemption at all. Note the shape of it: the exemption is derived from
//   the file's own content, so it cannot be granted by hand and cannot spread.
//
// THERE IS NO BY-PATH EXEMPTION, DELIBERATELY. There was one until 2026-09-11:
// `c64-disk-access/scripts/c1541.test.mjs` read a genuine release image from
// `.planning/phases/23-*/evidence/corpus/` as the only independent oracle for
// a parser whose every other fixture the tool under test had built itself.
// Exempting it BY PATH whitelisted the whole FILE, and so covered five
// unrelated citations in it as collateral -- which is how a by-path exemption
// always fails. The fix was to remove the need for it rather than document it:
// the image is operator-supplied and committed nowhere (it is not this
// project's to redistribute, and a committed copy would stop being
// independently produced), so it is now named by `C64_RE_CORPUS_IMAGE` like
// every other operator-supplied resource in this repo. No path, no exemption,
// same oracle, same skip. If a future case seems to need a by-path entry, ask
// first whether the resource is really operator-supplied.
//
// A DECISION ID IS A VIOLATION IN EVERY FORM, including one that names the
// document defining it. Until 2026-09-11 `` `docs/stock-vice-parity.md` D-03 ``
// was allowed, on the reasoning that a reader with `docs/` can resolve it.
// MEASURED: that reader is a minority. `docs/` is packed into the plugin zip
// by `git archive HEAD`, but it is in NEITHER npm tarball -- `@henols/vice-mcp`
// lists 90 individual modules and `@henols/c64-re-tools` lists `bin/`,
// `skills/`, `README.md`, `THIRD-PARTY-NOTICES.md`. So the qualified form
// dangles for every `npx` install, and the id was never the useful half of the
// sentence anyway: state the reasoning inline and the reader needs no lookup
// at all. Same for a requirement id, where the escape was weaker still --
// `docs/` does not define requirement ids in the first place.
//
// NON-VACUITY: the two planted-control cases at the bottom run the SAME
// `scanForPlanningVocabulary()` the real scan runs, over synthetic content, and
// assert that a dirty file is caught and a clean file is not. Without them a
// passing suite could mean "the predicate matches nothing at all".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const SKILLS_DIR = join(ROOT, "src", "skills");

/** Shipped tests that reach an OPERATOR-SUPPLIED external resource, named by
 * environment variable rather than by a repository path. They are listed here
 * not to exempt them -- nothing here is exempt from the scan -- but so the
 * test below can assert each one still degrades to a skip when the resource
 * is absent. That is the property that made the old hard-coded path tolerable;
 * it must survive the path's removal.
 *
 * There is deliberately NO by-path exemption in this guard. The single entry
 * that used to have one (`c1541.test.mjs`, for a `.planning/` evidence-corpus
 * path) whitelisted the whole FILE, and so silently covered five unrelated
 * citations in the same file as collateral. Naming the resource through an env
 * var removed the need for the exemption instead of documenting it. */
const OPERATOR_SUPPLIED_RESOURCE_READERS = Object.freeze([
  {
    file: "src/skills/c64-disk-access/scripts/c1541.test.mjs",
    envVar: "C64_RE_CORPUS_IMAGE",
    // A real, independently-produced release image. Committed nowhere: not
    // this project's to redistribute, and a committed copy would no longer be
    // independent, which is the property the cross-validation rests on.
    why: "an independently-produced .d64 the project did not create",
  },
]);

/** Extensions worth reading. Everything a human or an agent reads as text. */
const TEXT_EXTENSIONS = Object.freeze([".md", ".mjs", ".js", ".ts", ".mts", ".json", ".a", ".asm", ".txt"]);

/** One detected violation. */
export interface PlanningVocabularyHit {
  readonly line: number;
  readonly category: string;
  readonly match: string;
  readonly text: string;
}

/** A category of planning vocabulary: how to spot it, and when an occurrence
 * is nonetheless legitimate. `exempt` receives the whole physical line plus
 * the set of step numbers the file declares as its own workflow headings. */
interface Category {
  readonly name: string;
  readonly pattern: RegExp;
  readonly exempt?: (match: RegExpExecArray, line: string, ownSteps: ReadonlySet<string>) => boolean;
}

const CATEGORIES: readonly Category[] = Object.freeze([
  {
    name: ".planning path",
    pattern: /\.planning\b/g,
  },
  {
    name: "gsd command or product name",
    pattern: /\/gsd-[a-z-]+|\bGSD\b/g,
  },
  {
    name: "phase citation",
    // `Phase 12`, `phase 8.1`, `Phase 01.6.3`.
    pattern: /\b[Pp]hase\s+(\d+(?:\.\d+)*)/g,
    exempt: (m, _line, ownSteps) => ownSteps.has(m[1]) || ownSteps.has(m[1].split(".")[0]),
  },
  {
    name: "plan citation",
    // `plan 40-02`, `plans 01.6.3-01..04`, `plan 45-01 task 2`,
    // `quick-260818-nh5`. The keyword is matched in BOTH cases: the first
    // version of this guard spelled it `\bplans?` while its immediate
    // neighbour above already spelled the equivalent `[Pp]hase`, and that one
    // inconsistency let a sentence-initial "Plan 29-18 removed that cause by"
    // through a scan that reported the tree clean. Two adjacent categories
    // must not disagree about case.
    pattern: /\b[Pp]lans?\s+\d+(?:\.\d+)*-\d+|\bquick-\d{6}-[a-z0-9]+/g,
  },
  {
    name: "decision or gap id",
    // `D-03`, `G-40-1` -- in ANY form, including one that names the document
    // defining it. An earlier version of this guard allowed `` `docs/
    // stock-vice-parity.md` D-03 `` on the reasoning that the reference
    // resolves for a reader who has `docs/`. Measured 2026-09-11, that reader
    // is a minority of consumers: `docs/` is in the plugin zip (packed by `git
    // archive HEAD`) but in NEITHER npm tarball -- `@henols/vice-mcp` lists 90
    // individual modules and `@henols/c64-re-tools` lists `bin/`, `skills/`,
    // `README.md`, `THIRD-PARTY-NOTICES.md`. So the qualified form dangles for
    // every `npx` install. A skill states the reasoning inline instead; the id
    // adds nothing a consumer can use.
    pattern: /\bD-\d{1,2}\b|\bG-\d+-\d+\b/g,
  },
  {
    name: "requirement id",
    // `SEAM-02`, `PREP-01`, `CAP-02`, `BACK-05` -- ids declared only in
    // `.planning/REQUIREMENTS.md`, which no consumer has in any distribution.
    // The document-qualified escape is gone here for the same reason it is
    // gone above, and it was weaker still: naming a `docs/` page next to a
    // requirement id never made the id resolvable, because `docs/` does not
    // define requirement ids at all.
    pattern: /\b[A-Z]{2,8}-\d{2}\b/g,
  },
  {
    name: "planning artifact filename",
    // `40-CONTEXT.md`, `19-RESEARCH.md`, `40-REVIEW.md`, `17-UAT.md`.
    pattern: /\b\d+(?:\.\d+)*-(?:CONTEXT|RESEARCH|PLAN|REVIEW|UAT|VERIFICATION|SUMMARY|PATTERNS)\.md\b/g,
  },
  {
    name: "planning document cross-reference",
    pattern: /\bRE-FINDINGS\b|\bROADMAP\b|\bREQUIREMENTS\.md\b|\bSTATE\.md\b|\bMILESTONES\.md\b/g,
  },
]);

/** The step numbers a file declares as its OWN workflow headings, e.g. a
 * `## Phase 2 -- the routine queue` line yields "2". Sub-steps written in
 * prose as `Phase 2.2` are covered by the caller matching on the integer part
 * too, so a skill need not give every sub-step its own heading. */
export function ownWorkflowSteps(content: string): ReadonlySet<string> {
  const steps = new Set<string>();
  for (const m of content.matchAll(/^#{2,}\s+Phase\s+(\d+(?:\.\d+)*)/gm)) steps.add(m[1]);
  return steps;
}

/** Every planning-vocabulary occurrence in `content`, minus the occurrences
 * the file's own declared workflow steps or a document-qualified citation
 * make legitimate. Pure: no filesystem access, so the planted controls below
 * exercise exactly this. */
export function scanForPlanningVocabulary(content: string): PlanningVocabularyHit[] {
  const ownSteps = ownWorkflowSteps(content);
  const lines = content.split("\n");
  const hits: PlanningVocabularyHit[] = [];
  lines.forEach((text, i) => {
    for (const category of CATEGORIES) {
      const re = new RegExp(category.pattern.source, category.pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (category.exempt?.(m, text, ownSteps)) continue;
        hits.push({ line: i + 1, category: category.name, match: m[0], text: text.trim().slice(0, 160) });
      }
    }
  });
  return hits;
}

/** Every readable text file under `src/skills/`, repo-relative with POSIX
 * separators. Throws rather than returning empty if the tree is missing -- a
 * silently empty scan is a guard that passes by scanning nothing. */
function shippedSkillFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // Scratch directories are written by other tests running concurrently
        // against the real tree; they are not shipped content.
        if (entry.startsWith("zz-scratch") || entry === "node_modules") continue;
        walk(full);
        continue;
      }
      if (TEXT_EXTENSIONS.some((e) => entry.endsWith(e))) out.push(relative(ROOT, full).split(sep).join("/"));
    }
  };
  walk(SKILLS_DIR);
  return out.sort();
}

test("the shipped skills tree is non-empty and every SKILL.md is scanned", () => {
  const files = shippedSkillFiles();
  assert.ok(files.length >= 40, `expected the skills tree to hold at least 40 text files, found ${files.length} -- a shrunken scan set means this guard is checking less than it reports`);
  const skillDocs = files.filter((f) => f.endsWith("/SKILL.md"));
  assert.ok(skillDocs.length >= 9, `expected at least 9 SKILL.md files, found ${skillDocs.length}`);
});

test("no shipped skill file contains GSD planning vocabulary (ENGINEERING_RULES § 21.1)", () => {
  const offenders: string[] = [];
  for (const file of shippedSkillFiles()) {
    const hits = scanForPlanningVocabulary(readFileSync(join(ROOT, file), "utf8"));
    for (const h of hits) offenders.push(`${file}:${h.line}: [${h.category}] "${h.match}" -- ${h.text}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `shipped skills must not reference this project's GSD planning artifacts -- the installing reader has no .planning/ tree and cannot act on any of it.\n` +
      `Rewrite the fact into plain prose, or drop it. See .planning/ENGINEERING_RULES.md § 21.\n\n` +
      offenders.join("\n"),
  );
});

test("every shipped test reaching an operator-supplied resource names it by env var and still degrades to a skip", () => {
  for (const { file, envVar, why } of OPERATOR_SUPPLIED_RESOURCE_READERS) {
    const content = readFileSync(join(ROOT, file), "utf8");
    assert.ok(
      content.includes(`process.env.${envVar}`),
      `${file} is recorded as reaching ${why} through ${envVar}, but no longer reads that variable -- if the resource is gone, drop the entry; if it moved to a repository path, that path is a planning-vocabulary violation waiting to happen and this entry is now lying about how it is reached`,
    );
    assert.ok(
      !/\.planning\b/.test(content),
      `${file} must not name a .planning/ path: the operator supplies ${why} through ${envVar} precisely so no repository path is baked into a shipped file`,
    );
    assert.match(
      content,
      /skip/i,
      `${file} reaches ${why}, which no consumer and no fresh clone has, so it MUST degrade to a skip when ${envVar} is unset -- never a failure`,
    );
  }
});

// ============================================================================
// PLANTED CONTROLS -- proof the predicate distinguishes dirty from clean
// ============================================================================

test("PLANTED CONTROL 1: a synthetic skill page carrying each category is caught, one hit per category", () => {
  const dirty = [
    "# A skill page",
    "Findings go in `.planning/RE-FINDINGS.md` at the moment you find them.",
    "File-changing work enters through a GSD command (`/gsd-quick`).",
    "This was withdrawn in Phase 34, plan 34-08.",
    "Per D-05 the bytes are never edited, and G-40-1 reopened it.",
    "The seam contract is SEAM-02.",
    "Rationale is recorded in 40-CONTEXT.md.",
    "Tracked against ROADMAP.md.",
  ].join("\n");

  const found = new Set(scanForPlanningVocabulary(dirty).map((h) => h.category));
  for (const category of CATEGORIES) {
    assert.ok(found.has(category.name), `category "${category.name}" matched nothing in the planted dirty page -- it is vacuous and would never fail on a real violation`);
  }
});

test("PLANTED CONTROL 2 (the negative control): a clean skill page, and a skill's own workflow steps, are reported by NOTHING -- while every citation form is", () => {
  const clean = [
    "# A skill page",
    "Record what you learn in the project's own notes as you go.",
    "Whole-program static disassembly was withdrawn on 2026-08-29 because it",
    "could not distinguish code from data on a packed image.",
    "The fork answers `restarted`; stock cannot, because stock's binary monitor",
    "services exactly one client and has no non-pausing liveness probe.",
    "Incident records land under `.c64-re-tools/incidents/` before anything is killed.",
  ].join("\n");
  assert.deepEqual(scanForPlanningVocabulary(clean), [], "a clean page must produce no hits");

  // The one exemption: a skill's own numbered workflow, and ONLY the numbers it declares.
  const ownWorkflow = [
    "## Phase 0 — context",
    "Come back and start again at Phase 0.",
    "## Phase 2 — the routine queue",
    "Keep the answer; Phase 2.2 reuses it.",
  ].join("\n");
  assert.deepEqual(scanForPlanningVocabulary(ownWorkflow), [], "a skill's own declared workflow steps must not be reported");

  const foreignPhase = ["## Phase 0 — context", "Deleted in Phase 40 plan 40-06."].join("\n");
  const foreign = scanForPlanningVocabulary(foreignPhase);
  assert.ok(
    foreign.some((h) => h.match === "Phase 40"),
    "a phase number the file does NOT declare as its own step must still be reported, even in a file that declares others -- otherwise one workflow heading whitelists the whole page",
  );

  // A decision id is a violation in EVERY form -- bare, and qualified by the
  // document that defines it. The qualified form was allowed until 2026-09-11
  // on the reasoning that `docs/` resolves for the reader; it does not for the
  // npm reader, who gets neither `docs/` nor `.planning/`.
  assert.ok(
    scanForPlanningVocabulary("this is bounded per D-02").some((h) => h.match === "D-02"),
    "a bare decision id resolves nowhere for a consumer and must be reported",
  );
  assert.ok(
    scanForPlanningVocabulary("see `docs/stock-vice-parity.md` D-03 for the reasoning").some((h) => h.match === "D-03"),
    "naming the defining document does NOT rescue a decision id: `docs/` ships in the plugin zip but in neither npm tarball, so the citation still dangles for an `npx` install. State the reasoning inline instead.",
  );
  assert.ok(
    scanForPlanningVocabulary("the seam contract is documented in `docs/stock-vice-parity.md` as SEAM-02").some((h) => h.match === "SEAM-02"),
    "a requirement id is not rescued by a nearby docs/ reference either -- docs/ does not define requirement ids at all",
  );

  // A sentence-initial `Plan` must be caught, not just a lowercase `plan`:
  // the first version of this guard matched only the lowercase spelling and
  // let exactly one line through while reporting the tree clean.
  assert.ok(
    scanForPlanningVocabulary("Plan 29-18 removed that cause by recording relative locations.").some((h) => h.match === "Plan 29-18"),
    "a sentence-initial `Plan NN-NN` must be reported -- matching only the lowercase spelling is what let this exact line survive a scan that reported zero",
  );
});
