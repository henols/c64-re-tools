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
// WHAT THIS GUARD SCANS, AS OF THIS WIDENING. It now unions FOUR sources
// through `shippedScanSurface()` (defined once in `shipped-modules.ts` and
// shared with `comment-phase-pointers.test.ts`'s own scan): the
// `src/mcp/vice/` package's `files[]` (directory entries walked recursively,
// file entries taken directly); the host-bound `.mts` sources behind the
// generated `resources/` artifacts (`HOST_BOUND_ARTIFACTS`, imported from
// `build.ts`, never hand-listed); the installer package's `files[]`, with its
// generated `installer/skills/` mirror skipped -- that directory is
// regenerated from source 4 below by `installer/scripts/sync-skills.mjs` on
// every pack, is gitignored and absent on a fresh clone, and every byte it
// would contain is already scanned at its origin, so no content escapes the
// scan; and `src/skills/`, this guard's original surface, preserved rather
// than replaced. `src/mcp/vice/**` was a large legacy population of this
// same vocabulary in its comments (1659 occurrences across 95 of the 103
// shipped modules, MEASURED 2026-09-11) that would have made a naive
// widening red on arrival. The RATCHET below is the mechanism that let this
// widening land green anyway: every currently-dirty file is pinned at its
// EXACT measured count rather than exempted, and the pin must fall to zero
// -- never rise -- as later plans clean each one. It is temporary scaffolding
// the phase drives to empty, not a permanent carve-out.
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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { repoRoot } from "./repo-root.ts";
import { commentByteTotal, extractCommentSpans, shippedScanSurface } from "./shipped-modules.ts";
import { HOST_BOUND_ARTIFACTS } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

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
    name: "phase evidence document path",
    // `docs/phase45-wave0-measurements.md`, `docs/phase45-planted-control-
    // evidence.md` -- a phase-numbered evidence document dangles for every
    // install just like a bare `.planning/` path: that directory is packed
    // into the plugin zip (by `git archive HEAD`) but sits in NEITHER npm
    // tarball, and it smuggles a phase number into a shipped file inside
    // what reads as a working cross-reference rather than an internal token.
    pattern: /\bdocs\/phase\d+[a-z0-9-]*(?:\.md)?/gi,
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

/** One module-family partition a RATCHET entry belongs to -- the same seven
 * names this phase's sweep plans partition by (module family, never by
 * file and never by citation category; see D-06). */
type RatchetFamily =
  | "annotation store / CLI"
  | "protocol / transport"
  | "broker"
  | "host tools"
  | "other"
  | "proxy / tool surface"
  | "installer";

export interface RatchetEntry {
  readonly file: string;
  readonly family: RatchetFamily;
  readonly count: number;
}

/**
 * TEMPORARY SCAFFOLDING -- must reach EMPTY. One entry per file that carried
 * planning vocabulary the moment this guard's scan surface widened past
 * `src/skills/**`, measured through the guard's own predicate
 * (`scanForPlanningVocabulary()` over `shippedScanSurface()`), never by a
 * hand-rolled grep and never copied from a planning document.
 *
 * THIS IS NOT AN EXEMPTION LIST. Every entry's live hit count is asserted
 * EQUAL to its pinned count below (see the ratchet test), so an entry here
 * can neither absorb a NEW citation as collateral (a rise reds) nor keep a
 * stale allowance after a citation is removed (a fall reds too, unless the
 * entry is edited in the SAME commit that lowered the file).
 *
 * THE ONE RULE FOR EDITING THIS ARRAY: lower a count only together with the
 * commit that lowered the file; delete the entry the moment its count
 * reaches zero; never raise one. A path exemption was tried once for a
 * different guard in this file and withdrawn after it silently covered five
 * unrelated citations as collateral (ENGINEERING_RULES.md § 21.1) -- pinning
 * an exact COUNT per file is what a by-path exemption cannot do: it cannot
 * be satisfied by leaving the file otherwise untouched.
 *
 * `family` is one of the seven module-family partitions this phase's sweep
 * plans work through, never a citation category and never a lone file.
 */
const RATCHET: readonly RatchetEntry[] = Object.freeze([
  { file: "src/mcp/vice/THIRD-PARTY-NOTICES.md", family: "other", count: 11 },
  { file: "src/mcp/vice/anno-bank.ts", family: "annotation store / CLI", count: 16 },
  { file: "src/mcp/vice/anno-cli.ts", family: "annotation store / CLI", count: 164 },
  { file: "src/mcp/vice/anno-confidence.ts", family: "annotation store / CLI", count: 2 },
  { file: "src/mcp/vice/anno-coverage.ts", family: "annotation store / CLI", count: 51 },
  { file: "src/mcp/vice/anno-derive.ts", family: "annotation store / CLI", count: 6 },
  { file: "src/mcp/vice/anno-details.ts", family: "annotation store / CLI", count: 3 },
  { file: "src/mcp/vice/anno-enum-gen.ts", family: "annotation store / CLI", count: 66 },
  { file: "src/mcp/vice/anno-export-asm.ts", family: "annotation store / CLI", count: 146 },
  { file: "src/mcp/vice/anno-graphics.ts", family: "annotation store / CLI", count: 18 },
  { file: "src/mcp/vice/anno-hazard-report.ts", family: "annotation store / CLI", count: 2 },
  { file: "src/mcp/vice/anno-import.ts", family: "annotation store / CLI", count: 21 },
  { file: "src/mcp/vice/anno-index.ts", family: "annotation store / CLI", count: 6 },
  { file: "src/mcp/vice/anno-join.ts", family: "annotation store / CLI", count: 50 },
  { file: "src/mcp/vice/anno-memmap-render.ts", family: "annotation store / CLI", count: 25 },
  { file: "src/mcp/vice/anno-provenance-ledger.ts", family: "annotation store / CLI", count: 4 },
  { file: "src/mcp/vice/anno-regbits-gen.ts", family: "annotation store / CLI", count: 13 },
  { file: "src/mcp/vice/anno-register.ts", family: "annotation store / CLI", count: 63 },
  { file: "src/mcp/vice/anno-store-export.ts", family: "annotation store / CLI", count: 12 },
  { file: "src/mcp/vice/anno-store.ts", family: "annotation store / CLI", count: 126 },
  { file: "src/mcp/vice/anno-symbols.ts", family: "annotation store / CLI", count: 11 },
  { file: "src/mcp/vice/anno-tools.ts", family: "annotation store / CLI", count: 85 },
  { file: "src/mcp/vice/anno-types.ts", family: "annotation store / CLI", count: 50 },
  { file: "src/mcp/vice/backend-detect.mts", family: "broker", count: 28 },
  { file: "src/mcp/vice/block-class.ts", family: "other", count: 3 },
  { file: "src/mcp/vice/broker-kill.mts", family: "broker", count: 31 },
  { file: "src/mcp/vice/broker-state.mts", family: "broker", count: 43 },
  { file: "src/mcp/vice/build.ts", family: "other", count: 2 },
  { file: "src/mcp/vice/capture-predicate.ts", family: "other", count: 14 },
  { file: "src/mcp/vice/channel-lock.ts", family: "protocol / transport", count: 3 },
  { file: "src/mcp/vice/container-guard.mts", family: "broker", count: 3 },
  { file: "src/mcp/vice/containerpath.ts", family: "other", count: 7 },
  { file: "src/mcp/vice/disasm-decoder.ts", family: "other", count: 21 },
  { file: "src/mcp/vice/disasm-opcodes.ts", family: "other", count: 20 },
  { file: "src/mcp/vice/disasm-renderer.ts", family: "other", count: 22 },
  { file: "src/mcp/vice/evid-ingest.ts", family: "annotation store / CLI", count: 9 },
  { file: "src/mcp/vice/evid-reconcile.ts", family: "annotation store / CLI", count: 14 },
  { file: "src/mcp/vice/ghidra-project.mts", family: "host tools", count: 64 },
  { file: "src/mcp/vice/host-tool-client.ts", family: "host tools", count: 11 },
  { file: "src/mcp/vice/hostpath.ts", family: "other", count: 2 },
  { file: "src/mcp/vice/incident-record.ts", family: "other", count: 12 },
  { file: "src/mcp/vice/install-resources.ts", family: "other", count: 22 },
  { file: "src/mcp/vice/memmap-lookup.ts", family: "other", count: 21 },
  { file: "src/mcp/vice/prg-image.ts", family: "other", count: 7 },
  { file: "src/mcp/vice/repo-root.ts", family: "other", count: 12 },
  { file: "src/mcp/vice/resources/backend-detect.mjs", family: "broker", count: 16 },
  { file: "src/mcp/vice/resources/broker-kill.mjs", family: "broker", count: 30 },
  { file: "src/mcp/vice/resources/broker-state.mjs", family: "broker", count: 8 },
  { file: "src/mcp/vice/resources/container-guard.mjs", family: "broker", count: 3 },
  { file: "src/mcp/vice/resources/ghidra-project.mjs", family: "host tools", count: 59 },
  { file: "src/mcp/vice/resources/vice-broker.mjs", family: "broker", count: 126 },
  { file: "src/mcp/vice/stock-address.ts", family: "other", count: 20 },
  { file: "src/mcp/vice/stock-checkpoints.ts", family: "other", count: 28 },
  { file: "src/mcp/vice/stock-cia.ts", family: "other", count: 26 },
  { file: "src/mcp/vice/stock-condition.ts", family: "other", count: 13 },
  { file: "src/mcp/vice/stock-connect.ts", family: "protocol / transport", count: 42 },
  { file: "src/mcp/vice/stock-derived.ts", family: "other", count: 59 },
  { file: "src/mcp/vice/stock-diagnose.ts", family: "other", count: 49 },
  { file: "src/mcp/vice/stock-disassemble.ts", family: "other", count: 21 },
  { file: "src/mcp/vice/stock-dispatch.ts", family: "proxy / tool surface", count: 101 },
  { file: "src/mcp/vice/stock-execution.ts", family: "other", count: 24 },
  { file: "src/mcp/vice/stock-handler.ts", family: "proxy / tool surface", count: 12 },
  { file: "src/mcp/vice/stock-input.ts", family: "other", count: 8 },
  { file: "src/mcp/vice/stock-machine.ts", family: "other", count: 19 },
  { file: "src/mcp/vice/stock-memory-search.ts", family: "other", count: 24 },
  { file: "src/mcp/vice/stock-memory.ts", family: "other", count: 20 },
  { file: "src/mcp/vice/stock-paths.ts", family: "other", count: 12 },
  { file: "src/mcp/vice/stock-petscii.ts", family: "other", count: 2 },
  { file: "src/mcp/vice/stock-protocol.ts", family: "protocol / transport", count: 102 },
  { file: "src/mcp/vice/stock-recycle.ts", family: "other", count: 15 },
  { file: "src/mcp/vice/stock-registers.ts", family: "other", count: 11 },
  { file: "src/mcp/vice/stock-reproducible-run.ts", family: "other", count: 9 },
  { file: "src/mcp/vice/stock-run-until.ts", family: "other", count: 23 },
  { file: "src/mcp/vice/stock-runstate.ts", family: "other", count: 13 },
  { file: "src/mcp/vice/stock-sprites.ts", family: "other", count: 20 },
  { file: "src/mcp/vice/stock-symbols.ts", family: "other", count: 16 },
  { file: "src/mcp/vice/stock-timing.ts", family: "other", count: 23 },
  { file: "src/mcp/vice/stock-vicii.ts", family: "other", count: 7 },
  { file: "src/mcp/vice/stop-oracle.ts", family: "other", count: 5 },
  { file: "src/mcp/vice/text-capability-probe.ts", family: "protocol / transport", count: 23 },
  { file: "src/mcp/vice/text-connect.ts", family: "protocol / transport", count: 13 },
  { file: "src/mcp/vice/text-protocol.ts", family: "protocol / transport", count: 43 },
  { file: "src/mcp/vice/text-tools.ts", family: "protocol / transport", count: 31 },
  { file: "src/mcp/vice/textmon-backtrace.ts", family: "protocol / transport", count: 10 },
  { file: "src/mcp/vice/textmon-cpuhistory.ts", family: "protocol / transport", count: 10 },
  { file: "src/mcp/vice/textmon-memmap.ts", family: "protocol / transport", count: 9 },
  { file: "src/mcp/vice/textmon-profile.ts", family: "protocol / transport", count: 14 },
  { file: "src/mcp/vice/textmon-registers.ts", family: "protocol / transport", count: 26 },
  { file: "src/mcp/vice/tools-manifest.stock.json", family: "proxy / tool surface", count: 34 },
  { file: "src/mcp/vice/version.ts", family: "other", count: 10 },
  { file: "src/mcp/vice/vice-proxy.ts", family: "proxy / tool surface", count: 107 },
  { file: "src/mcp/vice/vsf-slice.ts", family: "other", count: 4 },
]);

/** Sum of every RATCHET entry's pinned count -- reported alongside the
 * entry count in the failure message below, so a reader sees both how many
 * files are still dirty and how many citations remain across all of them. */
const RATCHET_TOTAL = RATCHET.reduce((sum, r) => sum + r.count, 0);

export interface CommentBudgetEntry {
  readonly file: string;
  readonly charsInCitations: number;
  readonly commentBytes: number;
}

/**
 * Frozen ONCE, at the moment this guard's scan surface widened -- one entry
 * per RATCHET file whose extension is `.ts`, `.mts`, `.mjs` or `.js` (the
 * extensions `extractCommentSpans()` finds real spans in). `resources/*.mjs`
 * is excluded: those files are rewritten wholesale by the build, so a byte
 * delta there measures the compiler, not an author. Non-source extensions
 * (`.md`, `.json`) are excluded too -- the extractor finds no spans there and
 * the check would be vacuous.
 *
 * `charsInCitations` is the sum of `hit.match.length` over that file's scan
 * AT FREEZE TIME; `commentBytes` is `commentByteTotal(content)`, also at
 * freeze time. Both stay fixed for the file's remaining time in this array --
 * they are the BASELINE a later diff is measured against, not a live
 * re-scan. A file's entry here OUTLIVES its own RATCHET entry once the
 * ratchet count reaches zero (Task 3 of this plan is the first
 * demonstration): the budget keeps checking the file exactly when the check
 * matters most, the moment after its citations are gone and nothing but
 * discipline stops the NEXT edit from cutting the explanation along with
 * them. This array is NOT an exemption list either -- it grants no
 * allowance to anything it names; it is the yardstick a later diff is held
 * to.
 */
const COMMENT_BUDGET_BASELINE: readonly CommentBudgetEntry[] = Object.freeze([
  { file: "installer/bin/cli.mjs", charsInCitations: 38, commentBytes: 3505 },
  { file: "src/mcp/vice/anno-bank.ts", charsInCitations: 103, commentBytes: 6620 },
  { file: "src/mcp/vice/anno-cli.ts", charsInCitations: 1101, commentBytes: 63447 },
  { file: "src/mcp/vice/anno-confidence.ts", charsInCitations: 8, commentBytes: 6885 },
  { file: "src/mcp/vice/anno-coverage.ts", charsInCitations: 302, commentBytes: 50526 },
  { file: "src/mcp/vice/anno-derive.ts", charsInCitations: 40, commentBytes: 14928 },
  { file: "src/mcp/vice/anno-details.ts", charsInCitations: 18, commentBytes: 4621 },
  { file: "src/mcp/vice/anno-enum-gen.ts", charsInCitations: 396, commentBytes: 28796 },
  { file: "src/mcp/vice/anno-export-asm.ts", charsInCitations: 1108, commentBytes: 89492 },
  { file: "src/mcp/vice/anno-graphics.ts", charsInCitations: 107, commentBytes: 10296 },
  { file: "src/mcp/vice/anno-hazard-report.ts", charsInCitations: 20, commentBytes: 29241 },
  { file: "src/mcp/vice/anno-import.ts", charsInCitations: 133, commentBytes: 13799 },
  { file: "src/mcp/vice/anno-index.ts", charsInCitations: 45, commentBytes: 5123 },
  { file: "src/mcp/vice/anno-join.ts", charsInCitations: 305, commentBytes: 13158 },
  { file: "src/mcp/vice/anno-memmap-render.ts", charsInCitations: 148, commentBytes: 17683 },
  { file: "src/mcp/vice/anno-provenance-ledger.ts", charsInCitations: 34, commentBytes: 15842 },
  { file: "src/mcp/vice/anno-regbits-gen.ts", charsInCitations: 76, commentBytes: 11096 },
  { file: "src/mcp/vice/anno-register.ts", charsInCitations: 497, commentBytes: 6737 },
  { file: "src/mcp/vice/anno-store-export.ts", charsInCitations: 63, commentBytes: 15255 },
  { file: "src/mcp/vice/anno-store.ts", charsInCitations: 834, commentBytes: 143111 },
  { file: "src/mcp/vice/anno-symbols.ts", charsInCitations: 82, commentBytes: 10095 },
  { file: "src/mcp/vice/anno-tools.ts", charsInCitations: 533, commentBytes: 53988 },
  { file: "src/mcp/vice/anno-types.ts", charsInCitations: 432, commentBytes: 67082 },
  { file: "src/mcp/vice/backend-detect.mts", charsInCitations: 207, commentBytes: 14206 },
  { file: "src/mcp/vice/block-class.ts", charsInCitations: 20, commentBytes: 9802 },
  { file: "src/mcp/vice/broker-control.mts", charsInCitations: 586, commentBytes: 29679 },
  { file: "src/mcp/vice/broker-epoch.mts", charsInCitations: 8, commentBytes: 4750 },
  { file: "src/mcp/vice/broker-kill.mts", charsInCitations: 177, commentBytes: 20920 },
  { file: "src/mcp/vice/broker-launch.mts", charsInCitations: 1430, commentBytes: 67489 },
  { file: "src/mcp/vice/broker-state.mts", charsInCitations: 307, commentBytes: 24756 },
  { file: "src/mcp/vice/build.ts", charsInCitations: 32, commentBytes: 6770 },
  { file: "src/mcp/vice/capture-predicate.ts", charsInCitations: 75, commentBytes: 17142 },
  { file: "src/mcp/vice/channel-lock.ts", charsInCitations: 22, commentBytes: 10725 },
  { file: "src/mcp/vice/container-guard.mts", charsInCitations: 19, commentBytes: 4993 },
  { file: "src/mcp/vice/containerpath.ts", charsInCitations: 34, commentBytes: 7346 },
  { file: "src/mcp/vice/disasm-decoder.ts", charsInCitations: 157, commentBytes: 6507 },
  { file: "src/mcp/vice/disasm-opcodes.ts", charsInCitations: 144, commentBytes: 12588 },
  { file: "src/mcp/vice/disasm-renderer.ts", charsInCitations: 109, commentBytes: 7824 },
  { file: "src/mcp/vice/evid-ingest.ts", charsInCitations: 112, commentBytes: 7588 },
  { file: "src/mcp/vice/evid-reconcile.ts", charsInCitations: 111, commentBytes: 11963 },
  { file: "src/mcp/vice/ghidra-project.mts", charsInCitations: 480, commentBytes: 27319 },
  { file: "src/mcp/vice/host-tool-client.ts", charsInCitations: 81, commentBytes: 10538 },
  { file: "src/mcp/vice/host-tool.mts", charsInCitations: 2478, commentBytes: 88550 },
  { file: "src/mcp/vice/hostpath.ts", charsInCitations: 34, commentBytes: 7058 },
  { file: "src/mcp/vice/incident-record.ts", charsInCitations: 102, commentBytes: 4060 },
  { file: "src/mcp/vice/install-resources.ts", charsInCitations: 109, commentBytes: 16792 },
  { file: "src/mcp/vice/memmap-lookup.ts", charsInCitations: 152, commentBytes: 8071 },
  { file: "src/mcp/vice/prg-image.ts", charsInCitations: 42, commentBytes: 5755 },
  { file: "src/mcp/vice/repo-root.ts", charsInCitations: 92, commentBytes: 13809 },
  { file: "src/mcp/vice/stock-address.ts", charsInCitations: 133, commentBytes: 4789 },
  { file: "src/mcp/vice/stock-checkpoints.ts", charsInCitations: 187, commentBytes: 13224 },
  { file: "src/mcp/vice/stock-cia.ts", charsInCitations: 139, commentBytes: 12057 },
  { file: "src/mcp/vice/stock-condition.ts", charsInCitations: 58, commentBytes: 11059 },
  { file: "src/mcp/vice/stock-connect.ts", charsInCitations: 341, commentBytes: 20739 },
  { file: "src/mcp/vice/stock-derived.ts", charsInCitations: 422, commentBytes: 8172 },
  { file: "src/mcp/vice/stock-diagnose.ts", charsInCitations: 314, commentBytes: 29314 },
  { file: "src/mcp/vice/stock-disassemble.ts", charsInCitations: 112, commentBytes: 4900 },
  { file: "src/mcp/vice/stock-dispatch.ts", charsInCitations: 724, commentBytes: 33858 },
  { file: "src/mcp/vice/stock-execution.ts", charsInCitations: 159, commentBytes: 7806 },
  { file: "src/mcp/vice/stock-handler.ts", charsInCitations: 65, commentBytes: 7412 },
  { file: "src/mcp/vice/stock-input.ts", charsInCitations: 42, commentBytes: 5529 },
  { file: "src/mcp/vice/stock-machine.ts", charsInCitations: 99, commentBytes: 6510 },
  { file: "src/mcp/vice/stock-memory-search.ts", charsInCitations: 142, commentBytes: 7153 },
  { file: "src/mcp/vice/stock-memory.ts", charsInCitations: 115, commentBytes: 8818 },
  { file: "src/mcp/vice/stock-paths.ts", charsInCitations: 64, commentBytes: 7263 },
  { file: "src/mcp/vice/stock-petscii.ts", charsInCitations: 28, commentBytes: 3933 },
  { file: "src/mcp/vice/stock-protocol.ts", charsInCitations: 1123, commentBytes: 50548 },
  { file: "src/mcp/vice/stock-recycle.ts", charsInCitations: 103, commentBytes: 17611 },
  { file: "src/mcp/vice/stock-registers.ts", charsInCitations: 92, commentBytes: 9156 },
  { file: "src/mcp/vice/stock-reproducible-run.ts", charsInCitations: 53, commentBytes: 25175 },
  { file: "src/mcp/vice/stock-run-until.ts", charsInCitations: 143, commentBytes: 13870 },
  { file: "src/mcp/vice/stock-runstate.ts", charsInCitations: 56, commentBytes: 5542 },
  { file: "src/mcp/vice/stock-sprites.ts", charsInCitations: 107, commentBytes: 12542 },
  { file: "src/mcp/vice/stock-symbols.ts", charsInCitations: 92, commentBytes: 10553 },
  { file: "src/mcp/vice/stock-timing.ts", charsInCitations: 182, commentBytes: 14343 },
  { file: "src/mcp/vice/stock-vicii.ts", charsInCitations: 39, commentBytes: 5617 },
  { file: "src/mcp/vice/stop-oracle.ts", charsInCitations: 28, commentBytes: 6302 },
  { file: "src/mcp/vice/text-capability-probe.ts", charsInCitations: 127, commentBytes: 21964 },
  { file: "src/mcp/vice/text-connect.ts", charsInCitations: 81, commentBytes: 4505 },
  { file: "src/mcp/vice/text-protocol.ts", charsInCitations: 253, commentBytes: 24836 },
  { file: "src/mcp/vice/text-tools.ts", charsInCitations: 212, commentBytes: 19773 },
  { file: "src/mcp/vice/textmon-backtrace.ts", charsInCitations: 60, commentBytes: 7187 },
  { file: "src/mcp/vice/textmon-cpuhistory.ts", charsInCitations: 58, commentBytes: 6936 },
  { file: "src/mcp/vice/textmon-memmap.ts", charsInCitations: 52, commentBytes: 10064 },
  { file: "src/mcp/vice/textmon-profile.ts", charsInCitations: 129, commentBytes: 10584 },
  { file: "src/mcp/vice/textmon-registers.ts", charsInCitations: 167, commentBytes: 15010 },
  { file: "src/mcp/vice/version.ts", charsInCitations: 30, commentBytes: 7681 },
  { file: "src/mcp/vice/vice-broker-client.ts", charsInCitations: 749, commentBytes: 36869 },
  { file: "src/mcp/vice/vice-broker.mts", charsInCitations: 1069, commentBytes: 53275 },
  { file: "src/mcp/vice/vice-proxy.ts", charsInCitations: 861, commentBytes: 68226 },
  { file: "src/mcp/vice/vsf-slice.ts", charsInCitations: 27, commentBytes: 17182 },
]);

/**
 * Slack allowance for the comment-byte-budget inequality below, in
 * characters. FINAL, fixed by this phase's densest real diff:
 * `src/mcp/vice/host-tool.mts` (325 citations swept to zero, the single
 * largest real rewrite this phase produces) lost 4073 comment characters
 * while removing 2478 citation characters -- a deficit of 1595, which is
 * NOT lost reasoning. It is packaging removed ALONGSIDE each citation
 * (`"Phase 36, plan 36-02 (D-36-07): "`'s own parentheses, commas and the
 * literal words "Phase"/"plan" are comment bytes the guard's own
 * `charsInCitations` tally never counts, because only the regex-matched
 * token substrings count as "citation characters" -- the surrounding
 * scaffolding is real comment volume this budget must still absorb even
 * though removing it loses no explanation). Two earlier, far smaller real
 * diffs (the `routine-queue-walker` sweep and `installer/bin/cli.mjs`,
 * both from an earlier plan in this phase) needed no slack at all -- one
 * even GREW its comment total. 1650 is 1595 rounded up with a 55-character
 * margin: enough to absorb this file's own measured packaging overhead
 * with a small buffer, not large enough to default-approve a genuine
 * paragraph loss (Task 3 of the plan that set this value proved that by
 * deleting a real explanatory paragraph from this same file and observing
 * the assertion still red).
 */
const COMMENT_BUDGET_SLACK = 1650;

/** Every planning-vocabulary offender across the widened scan surface,
 * formatted one line per hit -- the single assertion body BOTH the real
 * scan test and the planted control below call, so that control proves the
 * real code path rather than a parallel one. Unfiltered by RATCHET: this is
 * every hit `scanForPlanningVocabulary()` reports, not the mismatches
 * against the ledger (see `ratchetMismatches()` below for that). */
export function planningVocabularyOffenders(root: string): string[] {
  const offenders: string[] = [];
  for (const file of shippedScanSurface(root)) {
    const hits = scanForPlanningVocabulary(readFileSync(join(root, file), "utf8"));
    for (const h of hits) offenders.push(`${file}:${h.line}: [${h.category}] "${h.match}" -- ${h.text}`);
  }
  return offenders;
}

/** One file whose live planning-vocabulary hit count disagrees with its
 * RATCHET pin (or, for a file with no entry, is non-zero). `correction` is a
 * ready-to-paste `RATCHET` entry line carrying the file's CURRENT measured
 * values -- printed so a sweep plan's executor pastes a number the guard
 * itself reported, never one guessed or copied from a planning document. */
interface RatchetMismatch {
  readonly file: string;
  readonly pinned: number;
  readonly live: number;
  readonly family: RatchetFamily;
  readonly correction: string;
}

/** Computes every RATCHET disagreement for `root`, against `ratchet` --
 * `ratchet` is a parameter (not always the module-level `RATCHET`) so the
 * exactness test below can drive this against a synthetic ledger without
 * touching the real frozen array. For every file `shippedScanSurface(root)`
 * returns: a RATCHET entry's live count must EQUAL its pin; a file with NO
 * entry must scan at zero. Both directions are checked by the same equality,
 * which is the point -- a pin can neither absorb a new citation (equality
 * fails when live > pinned) nor carry stale slack after a site clears
 * (equality fails when live < pinned too). */
function ratchetMismatches(root: string, ratchet: readonly RatchetEntry[]): RatchetMismatch[] {
  const byFile = new Map(ratchet.map((r) => [r.file, r]));
  const mismatches: RatchetMismatch[] = [];
  for (const file of shippedScanSurface(root)) {
    const hits = scanForPlanningVocabulary(readFileSync(join(root, file), "utf8"));
    const entry = byFile.get(file);
    const pinned = entry?.count ?? 0;
    if (hits.length === pinned) continue;
    const family = entry?.family ?? "other";
    mismatches.push({
      file,
      pinned,
      live: hits.length,
      family,
      correction: `  { file: ${JSON.stringify(file)}, family: ${JSON.stringify(family)}, count: ${hits.length} },`,
    });
  }
  return mismatches;
}

/** One file whose live comment-byte total lost more than the citation
 * characters removed from it (plus slack), against its COMMENT_BUDGET_BASELINE
 * entry. `correction` is a ready-to-paste `COMMENT_BUDGET_BASELINE` line
 * carrying the file's CURRENT measured values. */
interface BudgetViolation {
  readonly file: string;
  readonly baselineCitationChars: number;
  readonly baselineCommentBytes: number;
  readonly liveCitationChars: number;
  readonly liveCommentBytes: number;
  readonly commentBytesLost: number;
  readonly citationCharsRemoved: number;
  readonly correction: string;
}

/** Computes every comment-budget violation for `root`, against `baseline` --
 * a parameter for the same reason `ratchetMismatches()` takes one. For every
 * baseline entry: `entry.commentBytes - commentByteTotal(now)` (comment
 * characters LOST) must be `<=` `entry.charsInCitations - charsInCitations(now)
 * + slack` (citation characters REMOVED, plus slack). One-directional by
 * construction: a file whose comments GREW trivially satisfies this; only a
 * file that lost MORE comment volume than the citations it shed is a
 * violation. */
function commentBudgetViolations(
  root: string,
  baseline: readonly CommentBudgetEntry[],
  slack: number,
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];
  for (const entry of baseline) {
    const content = readFileSync(join(root, entry.file), "utf8");
    const liveCommentBytes = commentByteTotal(content);
    const liveHits = scanForPlanningVocabulary(content);
    const liveCitationChars = liveHits.reduce((sum, h) => sum + h.match.length, 0);
    const commentBytesLost = entry.commentBytes - liveCommentBytes;
    const citationCharsRemoved = entry.charsInCitations - liveCitationChars;
    if (commentBytesLost <= citationCharsRemoved + slack) continue;
    violations.push({
      file: entry.file,
      baselineCitationChars: entry.charsInCitations,
      baselineCommentBytes: entry.commentBytes,
      liveCitationChars,
      liveCommentBytes,
      commentBytesLost,
      citationCharsRemoved,
      correction: `  { file: ${JSON.stringify(entry.file)}, charsInCitations: ${liveCitationChars}, commentBytes: ${liveCommentBytes} },`,
    });
  }
  return violations;
}

test("the widened scan surface is non-empty across all four contributing sources", () => {
  const surface = shippedScanSurface(ROOT);
  // Floor set BELOW what this task actually measured (158 paths) -- never a
  // floor equal to a number nobody measured (ENGINEERING_RULES.md § 6).
  assert.ok(surface.length >= 150, `expected at least 150 paths in the widened surface, got ${surface.length}`);
  assert.ok(surface.some((f) => f.startsWith("src/skills/")), "the skills-tree source must be represented");
  assert.ok(surface.some((f) => f.startsWith("installer/")), "the installer source must be represented");
  assert.ok(
    surface.includes("src/mcp/vice/vice-broker.mts"),
    "a host-bound .mts source that is NOT in vice/package.json's files[] must be unioned in from HOST_BOUND_ARTIFACTS",
  );
  assert.ok(
    surface.includes("src/mcp/vice/README.md"),
    "a non-.ts files[] entry (shippedTsModules() would drop this) must be present",
  );
});

test("no shipped file carries planning vocabulary beyond its pinned ratchet allowance", () => {
  const mismatches = ratchetMismatches(ROOT, RATCHET);
  assert.deepEqual(
    mismatches,
    [],
    `shipped files must not carry planning vocabulary beyond their pinned RATCHET allowance ` +
      `(pinned total: ${RATCHET_TOTAL} across ${RATCHET.length} files). A file below disagrees with its ` +
      `pin -- paste its "correction" line into RATCHET verbatim (never guess or copy a number from a ` +
      `planning document):\n\n` +
      mismatches
        .map((m) => `  ${m.file}: pinned ${m.pinned}, live ${m.live}\n${m.correction}`)
        .join("\n"),
  );
});

test("the ratchet pin is exact: a cleared site must be recorded, not left as slack", () => {
  // Drives ratchetMismatches() -- the SAME function the real assertion above
  // calls -- against a synthetic tree, never against the real frozen RATCHET
  // (mutating that array here would be exactly the kind of hand-guessed edit
  // this whole ledger exists to prevent). One planted citation, pinned at
  // its correct count first (clean), then pinned one too HIGH and one too
  // LOW, proving the equality reds in both directions.
  withSyntheticShippedTree(
    {
      skillFiles: {
        "some-skill/SKILL.md": ["# A skill page", "Findings tracked via ROADMAP.md.", ""].join("\n"),
      },
    },
    (root) => {
      const correctlyPinned: RatchetEntry[] = [
        { file: "src/skills/some-skill/SKILL.md", family: "other", count: 1 },
      ];
      assert.deepEqual(
        ratchetMismatches(root, correctlyPinned),
        [],
        "a pin exactly matching the live count must produce no mismatch",
      );

      const pinnedTooHigh: RatchetEntry[] = [
        { file: "src/skills/some-skill/SKILL.md", family: "other", count: 2 },
      ];
      const highMismatches = ratchetMismatches(root, pinnedTooHigh);
      assert.equal(highMismatches.length, 1, "a pin one HIGHER than the live count must still mismatch");
      assert.equal(highMismatches[0]!.live, 1);
      assert.equal(highMismatches[0]!.pinned, 2);

      const pinnedTooLow: RatchetEntry[] = [
        { file: "src/skills/some-skill/SKILL.md", family: "other", count: 0 },
      ];
      const lowMismatches = ratchetMismatches(root, pinnedTooLow);
      assert.equal(lowMismatches.length, 1, "a pin one LOWER than the live count -- a cleared site left unrecorded -- must still mismatch");
      assert.equal(lowMismatches[0]!.live, 1);
      assert.equal(lowMismatches[0]!.pinned, 0);
    },
  );
});

test("comment volume lost per file stays inside the citation characters removed", () => {
  const violations = commentBudgetViolations(ROOT, COMMENT_BUDGET_BASELINE, COMMENT_BUDGET_SLACK);
  assert.deepEqual(
    violations,
    [],
    `a file lost more comment volume than the citation characters removed from it (slack ${COMMENT_BUDGET_SLACK}). ` +
      `The reason must survive; only the citation goes. Paste the "correction" line into ` +
      `COMMENT_BUDGET_BASELINE verbatim:\n\n` +
      violations
        .map(
          (v) =>
            `  ${v.file}: baseline(citations=${v.baselineCitationChars}, comments=${v.baselineCommentBytes}) ` +
            `live(citations=${v.liveCitationChars}, comments=${v.liveCommentBytes}) ` +
            `commentBytesLost=${v.commentBytesLost} citationCharsRemoved=${v.citationCharsRemoved}\n${v.correction}`,
        )
        .join("\n"),
  );
});

/** Builds a throwaway root shaped like `shippedScanSurface()` expects --
 * `src/mcp/vice/` with a minimal real `package.json` `files[]`, every real
 * `HOST_BOUND_ARTIFACTS` `.mts` stubbed so source 2 never throws,
 * `installer/` with a minimal `files[]`, and `src/skills/` populated from
 * `spec.skillFiles` (a map of repo-relative-to-`src/skills/` path to
 * content). This is the ONE synthetic-root idiom this guard uses to prove
 * itself against a real file rather than a string -- the planted control below and
 * the ratchet-exactness test above both drive through it. `mkdtempSync` +
 * `try/finally rmSync`, matching this repository's own synthetic-tree
 * convention (`shipped-modules.test.ts`'s `withSyntheticShippedRoot()`). */
function withSyntheticShippedTree<T>(
  spec: { skillFiles: Record<string, string> },
  fn: (root: string) => T,
): T {
  const root = mkdtempSync(join(tmpdir(), "planning-vocab-synthetic-"));
  try {
    const viceDir = join(root, "src", "mcp", "vice");
    mkdirSync(viceDir, { recursive: true });
    writeFileSync(join(viceDir, "package.json"), JSON.stringify({ files: ["alpha.ts"] }), "utf8");
    writeFileSync(join(viceDir, "alpha.ts"), "// synthetic\n", "utf8");
    for (const mjsName of HOST_BOUND_ARTIFACTS) {
      const mtsAbs = join(viceDir, mjsName.replace(/\.mjs$/, ".mts"));
      mkdirSync(dirname(mtsAbs), { recursive: true });
      writeFileSync(mtsAbs, "// synthetic host-bound source\n", "utf8");
    }

    const installerDir = join(root, "installer");
    mkdirSync(installerDir, { recursive: true });
    writeFileSync(join(installerDir, "package.json"), JSON.stringify({ files: ["README.md"] }), "utf8");
    writeFileSync(join(installerDir, "README.md"), "synthetic installer readme\n", "utf8");

    const skillsDir = join(root, "src", "skills");
    mkdirSync(skillsDir, { recursive: true });
    for (const [rel, text] of Object.entries(spec.skillFiles)) {
      const abs = join(skillsDir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text, "utf8");
    }

    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("PLANTED CONTROL 3: a citation in a shipped-module-shaped file at a synthetic root reds the real assertion", () => {
  withSyntheticShippedTree(
    {
      skillFiles: {
        "some-skill/SKILL.md": [
          "# A skill page",
          "",
          "This routine's home is documented in `.planning/RE-FINDINGS.md` -- a",
          "realistic WHY-header sentence a maintainer could plausibly write, planted",
          "inside a file named and shaped exactly like a real shipped module.",
          "",
        ].join("\n"),
      },
    },
    (root) => {
      const offenders = planningVocabularyOffenders(root);
      assert.ok(
        offenders.some((o) => o.includes("some-skill/SKILL.md") && o.includes(".planning")),
        `the planted control found nothing -- the widened guard is vacuous on its own scan surface: ${JSON.stringify(offenders)}`,
      );
    },
  );
});

test("PLANTED CONTROL 3 (negative): the same synthetic tree, clean, reds nothing", () => {
  withSyntheticShippedTree(
    {
      skillFiles: {
        "some-skill/SKILL.md": [
          "# A skill page",
          "",
          "This routine's home is documented in the project's own notes, kept",
          "alongside the code that implements it.",
          "",
        ].join("\n"),
      },
    },
    (root) => {
      assert.deepEqual(
        planningVocabularyOffenders(root),
        [],
        "the negative control must report zero offenders -- otherwise the guard is finding something in every synthetic tree regardless of content",
      );
    },
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
    "See docs/phase45-wave0-measurements.md for the measurement this rests on.",
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
