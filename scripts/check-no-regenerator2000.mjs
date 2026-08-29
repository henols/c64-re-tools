#!/usr/bin/env node
// ===========================================================================
// THE REMOVAL GATE  (CUT-02 / CUT-03, phase 29 plan 29-02)
// ===========================================================================
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: the permanent absence of the
// rented static-analysis integration -- named here only as SUBJECT_NEEDLE,
// never as a contiguous literal in this file's own source -- from every file
// this repository TRACKS or SHIPS. "Tracks or ships" is two sets, not one,
// and the union of them is this gate's scope:
//
//     scope = ( git ls-files , minus the ".planning/" PREFIX )
//             UNION
//             packFiles("installer").files , mapped back onto disk
//
// The second half is not optional and not defensive. `git ls-files
// installer/skills` returns ZERO -- the directory is gitignored at
// .gitignore:43 -- while eight files under it mentioning the subject ARE
// shipped inside `@henols/c64-re-tools`. A tracked-files predicate is
// structurally blind to exactly what users receive. `packFiles()` is reused
// from check-npm-packages.mjs rather than re-implemented because `npm pack
// --dry-run` runs the installer's `prepack` hook, which runs sync-skills.mjs:
// the list is post-sync BY CONSTRUCTION, and a "remember to sync first"
// predicate can forget.
//
// The ".planning/" exclusion is a PREFIX exclusion, never a substring one, so
// `docs/planning-notes.md` stays in scope.
//
// STATED TRADEOFF, recorded rather than discovered: an untracked, not-yet
// `git add`ed file is invisible to a `--cached` predicate. CI runs
// post-commit, so the window is local-only. This is accepted.
//
// WHY IT EXISTS: commit 4f048bb closed a milestone with a structural guard
// already red and nothing forced anyone to notice. This gate is a
// PRECONDITION of the deletion commit, not a follow-up to it -- it is landed,
// observed biting on four planted routes, and observed green over its own
// exemption set BEFORE a single file is deleted. CUT-02 requires the absence;
// CUT-03 requires that the attribution and licence prose which legitimately
// keeps the subject's name forever is NOT what pays for that absence.
//
// WHAT NOT TO DO:
//
//   1. Do NOT consult an exemption before the unconditional scan has run.
//      WR-03 (check-skill-fork-honesty.mjs:430-449) was a line whose
//      exemption substring short-circuited all three checks around it,
//      hiding a live reintroduction behind the one line that is supposed to
//      be inert. Here, `subjectHits()` NEVER looks at an exemption: it
//      reports every occurrence unconditionally, and only afterwards is each
//      reported occurrence classified.
//
//   2. Do NOT widen an exemption to silence a real reintroduction. Every
//      exemption is PATH-scoped or BLOCK-scoped and shape-matched -- never a
//      substring anywhere on a line -- and every one carries an EXACT hit
//      count. A count that has grown is the shape of "an exemption used to
//      hide a reintroduction" and fails the gate.
//
//   3. Do NOT "fix" a false fire by deleting the attribution header. CUT-03
//      exists because that is the cheapest way to silence one. The notices
//      exemption is deliberately bidirectional: deleting an attribution
//      block drops the file's pinned hit count and its pinned qualifying-
//      block count, and the gate TRIPS. An exemption nothing can violate is
//      not an exemption.
//
//   4. Do NOT shell out to `grep`, and do NOT skip a file because it looks
//      binary. `src/mcp/vice/r2000-memmap-render.ts` carries a literal NUL
//      byte at offset 12862 (line 291 -- the "\0" field separator in its
//      sidecar hash canonicalisation), so GNU grep classifies the whole file
//      as binary, prints "binary file matches" instead of a count, and skips
//      it under `grep -c` / `grep -o`. The tree-wide occurrence total is 399
//      with `-a` and 398 without; that one-hit difference is the provenance
//      comment at :79, which a grep-backed gate would let survive its own
//      removal check. This gate reads every file's bytes in-process with
//      readFileSync() and decodes them as UTF-8, which is binary-safe by
//      construction. removal-gate.test.ts proves this behaviourally.
//
// THE STALENESS CONTRACT FOR EVERY PATH THIS PHASE RENAMES.
// Every path-scoped entry below -- permanent exemption AND temporary
// allow-list alike -- names the path that exists NOW, at wave 1. Plan 29-05
// `git mv`s nine capability modules, the CLI, its verb parser and four
// unpaired guard tests in wave 3. The moment they move, an entry naming the
// old path names a file that is not on disk, and this gate's own existence
// assertion turns that into a RED CI script for every plan in waves 3, 4 and
// 5 -- including plan 29-09, whose <automated> invokes this gate directly, so
// the failure would surface three waves late and be attributed to the wrong
// plan. Do not pre-empt that by authoring post-rename `anno-*` paths: they do
// not exist at wave 1, their hit counts would be zero, and the count
// assertions would fail immediately. Do not weaken the existence assertion
// either: it is the thing that makes a stale entry visible at all.
//
//   >> AN ENTRY NAMING A PATH THAT PLAN 29-05 RENAMES IS RE-POINTED BY PLAN
//   >> 29-05 ITSELF, IN THE SAME COMMIT AS THE `git mv`, TOGETHER WITH ANY
//   >> HIT COUNT THAT MOVED WITH IT.
//
// Two PERMANENT exemption classes are subject to that obligation, and both
// are re-pointed rather than discharged -- no plan in this phase removes
// either mention:
//   - `upstream-audit-manifest-provenance`: the manifest-provenance
//     constants in the upstream-audit test, which 29-05 renames to
//     `anno-derivation.test.ts`. They name an UPSTREAM PROJECT that is not
//     deleted, rather than an integration that is.
//   - `memmap-measurement-provenance`: the measurement-provenance comment in
//     the memmap renderer, which 29-05 renames to `anno-memmap-render.ts`.
//     It records that three query result shapes were measured live against a
//     real pinned-version child rather than transcribed from a document --
//     the same class as the constants one file over, and true in the past
//     tense after the integration is deleted.
// The executor of 29-05 therefore finds the obligation in the file it is
// editing rather than having to infer it.
//
// This script only ever readFileSync()s and matches. It never imports,
// evaluates or spawns anything it scanned. Its one import is first-party.
// ===========================================================================

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { packFiles } from "./check-npm-packages.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// ---------------------------------------------------------------------------
// The needle
// ---------------------------------------------------------------------------

/**
 * The subject this gate polices, JOINED FROM TWO FRAGMENTS at module scope so
 * that this file's own source never carries the literal contiguously. Without
 * that, the gate would need a content exemption for itself, and a gate that
 * exempts its own body is one edit away from exempting anything.
 *
 * The only path-shaped strings below that would otherwise carry the literal
 * are likewise composed from this constant.
 */
export const SUBJECT_NEEDLE = "regenerator" + "2000";

/** This gate's own repository-relative path, composed, never typed. */
const GATE_PATH = `scripts/check-no-${SUBJECT_NEEDLE}.mjs`;
/** The dated phase-9 findings document, whose FILENAME carries the subject. */
const PHASE9_FINDINGS_PATH = `docs/phase9-${SUBJECT_NEEDLE}-probe-findings.md`;

/**
 * THE SCAN PREDICATE -- the one the real scan runs and the one
 * `removal-gate.test.ts` drives its planted violations through. A planted
 * violation proved against a re-implementation of the rule proves nothing
 * about the rule the real scan applies.
 *
 * Scans BOTH the file's path and its text, case-insensitively, and returns
 * ONE ENTRY PER OCCURRENCE (not per line), so a line carrying the subject
 * twice is reported twice and `hits.length` is directly comparable with
 * `grep -aoi ... | wc -l`. The returned value is a list of 1-based LINE
 * NUMBERS; the sentinel `0` means "the occurrence is in the path itself, not
 * in the content".
 *
 * It NEVER consults an exemption. Classification happens afterwards, to the
 * hits this returns. That ordering is rule 1 of this file's header.
 */
export function subjectHits(relPath, text) {
  const hits = [];
  const inPath = new RegExp(SUBJECT_NEEDLE, "gi");
  while (inPath.exec(String(relPath ?? "")) !== null) hits.push(0);
  const lines = String(text ?? "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const inLine = new RegExp(SUBJECT_NEEDLE, "gi");
    while (inLine.exec(lines[i]) !== null) hits.push(i + 1);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// The scope predicate
// ---------------------------------------------------------------------------

/** PREFIX, never a substring: `docs/planning-notes.md` stays in scope. */
const PLANNING_PREFIX = ".planning/";

/**
 * Floor measured against this tree at authoring time (390 paths: 360 tracked
 * outside `.planning/`, plus 30 shipped-but-untracked installer paths). A
 * walk that returns fewer than this has broken, and a broken walk must fail
 * LOUDLY rather than find nothing and report success.
 */
const SCANNED_FILE_FLOOR = 350;

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return out.split("\0").filter(Boolean).filter((p) => !p.startsWith(PLANNING_PREFIX));
}

function shippedInstallerFiles() {
  return packFiles(join(ROOT, "installer")).files.map((f) => `installer/${f}`);
}

function scopeSet() {
  const tracked = trackedFiles();
  const shipped = shippedInstallerFiles();
  const all = new Set([...tracked, ...shipped]);
  return {
    paths: [...all].sort(),
    trackedCount: tracked.length,
    shippedCount: shipped.length,
    shippedOnlyCount: shipped.filter((p) => !tracked.includes(p)).length,
  };
}

// ---------------------------------------------------------------------------
// PERMANENT EXEMPTIONS -- path-scoped or block-scoped, shape-matched, each
// with an EXACT hit count measured against THIS tree (never copied out of a
// research document). Every count is asserted with `===`: a count that has
// grown means the exemption is being used to hide a reintroduction.
// ---------------------------------------------------------------------------

const NOTICES_FILES = [
  "THIRD-PARTY-NOTICES.md",
  "src/mcp/vice/THIRD-PARTY-NOTICES.md",
  "installer/THIRD-PARTY-NOTICES.md",
];

/**
 * The SHAPES that make a block in a notices file an attribution block. Each
 * is anchored on a heading or on a licence-scope claim -- never on the bare
 * presence of the subject's name, which is what would make the exemption a
 * substring match. Composed from SUBJECT_NEEDLE for the same reason as the
 * paths above.
 */
const ATTRIBUTION_BLOCK_SHAPES = [
  {
    id: "incorporated-analysis-procedures",
    re: new RegExp(`${SUBJECT_NEEDLE}(?:'s)?(?: own)? analysis procedures`, "i"),
  },
  {
    id: "upstream-mit-permission-notice",
    re: new RegExp(`^## Upstream MIT permission notice \\(${SUBJECT_NEEDLE}\\)\\s*$`, "im"),
  },
  {
    id: "binary-itself-not-incorporated",
    re: /^## Build\/CI tools .* binary itself is not incorporated\s*$/im,
  },
  {
    id: "not-incorporated-scope-notes",
    re: /not-incorporated scope notes/i,
  },
];

/**
 * Split a notices document into blocks: the licence-scope preamble (before
 * the first `## ` heading) and then one block per `## ` section. Returns
 * 1-based inclusive line ranges. This is the structural half; the shape match
 * above is what decides whether a block is an ATTRIBUTION block.
 */
function noticesBlocks(text) {
  const lines = text.split("\n");
  const starts = [0];
  for (let i = 0; i < lines.length; i++) if (/^## /.test(lines[i])) starts.push(i);
  const uniqueStarts = [...new Set(starts)].sort((a, b) => a - b);
  return uniqueStarts.map((start, idx) => {
    const end = idx + 1 < uniqueStarts.length ? uniqueStarts[idx + 1] - 1 : lines.length - 1;
    return { firstLine: start + 1, lastLine: end + 1, text: lines.slice(start, end + 1).join("\n") };
  });
}

export function attributionBlocks(text) {
  return noticesBlocks(text).filter((b) => ATTRIBUTION_BLOCK_SHAPES.some((s) => s.re.test(b.text)));
}

/**
 * THE BLOCK-SCOPED EXEMPTION PREDICATE -- exported for the same reason
 * `subjectHits` is: the real scan and `removal-gate.test.ts`'s false-positive
 * control must be the SAME predicate. True when the 1-based `line` falls
 * inside a shape-matched attribution block of `text`.
 */
export function isInsideAttributionBlock(text, line) {
  return attributionBlocks(text).some((b) => line >= b.firstLine && line <= b.lastLine);
}

/**
 * Pinned per notices file: how many attribution blocks it must carry AND how
 * many occurrences those blocks must account for. BOTH are asserted, because
 * they fail on different mutilations -- deleting a whole section moves both,
 * while rewording one line inside a section moves only the second.
 */
const NOTICES_PINS = {
  "THIRD-PARTY-NOTICES.md": { blocks: 2, hits: 3 },
  "src/mcp/vice/THIRD-PARTY-NOTICES.md": { blocks: 4, hits: 17 },
  "installer/THIRD-PARTY-NOTICES.md": { blocks: 3, hits: 7 },
};

const EXEMPTION_CLASSES = [
  {
    id: "gate-self",
    why:
      "this gate and the CI job that invokes it -- both of which carry the subject ONLY as part of THIS FILE'S " +
      "OWN NAME, never as a live reference to the deleted integration. Task 3 of plan 29-02 adds three more " +
      "members to this class in the same commit as the files themselves: the gate's ambient type declaration, " +
      "the test that imports its predicates, and the fixtures README that names it.",
    paths: {
      [GATE_PATH]: 1,
      ".github/workflows/ci.yml": 1,
    },
  },
  {
    id: "findings-docs",
    why:
      "dated documents recording a past investigation OF the subject. They are history: their claims were true " +
      "when measured and stay true in the past tense after the integration is gone.",
    paths: {
      [PHASE9_FINDINGS_PATH]: 44,
      "docs/phase23-real-release-gate-findings.md": 3,
    },
  },
  {
    id: "attribution-guard-test",
    why:
      "the guard that enforces the attribution obligation itself. It must name the subject to police prose about " +
      "the subject; deleting its mentions would delete the enforcement.",
    paths: { "src/mcp/vice/skill-attribution.test.ts": 12 },
  },
  {
    id: "upstream-audit-manifest-provenance",
    why:
      "manifest-provenance constants naming an UPSTREAM PROJECT that is not deleted, rather than an integration " +
      "that is. PERMANENT, and re-pointed to anno-derivation.test.ts by plan 29-05 (see the staleness contract).",
    paths: { "src/mcp/vice/r2000-upstream-audit.test.ts": 3 },
  },
  {
    id: "memmap-measurement-provenance",
    why:
      "the one comment recording that this module's three declared query result shapes were measured LIVE against " +
      "a real pinned-version child rather than transcribed from a document. Pinned at exactly 1, at line 79, in a " +
      "file GNU grep refuses to read. PERMANENT, and re-pointed to anno-memmap-render.ts by plan 29-05.",
    paths: { "src/mcp/vice/r2000-memmap-render.ts": 1 },
    /** Extra pin: the ONE occurrence must be at this line. This is what makes
     *  the binary-safety criterion checkable rather than asserted -- a
     *  grep-backed implementation reports nothing here. */
    lines: { "src/mcp/vice/r2000-memmap-render.ts": [79] },
  },
  {
    id: "surviving-provenance",
    why:
      "past-tense provenance records, and references to the upstream PROJECT rather than to this repository's " +
      "integration of it, inside modules, tests, scripts and docs that survive the deletion. No plan in this " +
      "phase removes any of these, which is why they are exemptions and not allow-list entries.",
    paths: {
      "docs/stock-vice-parity.md": 1,
      "scripts/check-npm-packages.mjs": 1,
      "scripts/lib/skill-descriptions.mjs": 1,
      "src/mcp/vice/acme-gate.ts": 4,
      "src/mcp/vice/disasm-roundtrip.test.ts": 2,
      "src/mcp/vice/docs-dangling-refs.test.ts": 3,
      "src/mcp/vice/prg-image.ts": 1,
      "src/mcp/vice/shipped-modules.ts": 1,
      "src/mcp/vice/skill-acme-build-cli.test.ts": 1,
      "src/mcp/vice/stock-symbols.ts": 6,
    },
  },
  {
    id: "planted-fixtures",
    why:
      "fixture bodies that exist to be scanned by removal-gate.test.ts rather than by this gate. They are the " +
      "planted violations themselves, committed with a `.txt` suffix so no runner and no typechecker loads them.",
    prefixes: ["src/mcp/vice/fixtures/planted-"],
    prefixHits: 0,
  },
  {
    id: "notices-attribution-blocks",
    why:
      "the licence and attribution prose CUT-03 exists to protect. BLOCK-scoped: an occurrence inside a " +
      "shape-matched attribution block is exempt; the same occurrence one line outside one is not.",
    blockScoped: NOTICES_FILES,
  },
];

// ---------------------------------------------------------------------------
// TEMPORARY ALLOW-LIST -- opened 2026-08-29 by phase 29 plan 29-02.
//
// Every entry names a file whose reference to the subject is DISCHARGED later
// in this same phase, and names the plan that discharges it. Each entry is
// removed -- or, for a path plan 29-05 renames, RE-POINTED -- by the plan that
// names it, in that plan's own commit. THIS BLOCK MUST BE EMPTY AT THE PHASE'S
// CLOSE; plan 29-11 asserts exactly that.
//
// Three assertions run over every entry, and each catches a different way an
// allow-list rots:
//   - the path must EXIST on disk       -> an entry left behind after its file
//                                          is gone fails, rather than sitting
//                                          inert.
//   - the plan must be one of THIS PHASE'S -> an entry with no owner fails.
//   - the count must match EXACTLY      -> a mention count that moved without
//                                          its pin moving fails, so a plan
//                                          cannot half-discharge an entry
//                                          silently.
// ---------------------------------------------------------------------------

const ALLOW_LIST_OPENED = "2026-08-29";

const TEMPORARY_ALLOW_LIST = [
  // -- plan 29-05: the capability modules, the CLI, its verb parser, and the
  //    four unpaired guard tests. 29-05 `git mv`s these and re-points their
  //    prose; each entry moves to its `anno-*` path in the same commit.
  { path: "src/mcp/vice/r2000-acme-ident.ts", count: 1, plan: "29-05" },
  { path: "src/mcp/vice/r2000-coverage.ts", count: 4, plan: "29-05" },
  { path: "src/mcp/vice/r2000-coverage.test.ts", count: 1, plan: "29-05" },
  { path: "src/mcp/vice/r2000-enum-gen.ts", count: 4, plan: "29-05" },
  { path: "src/mcp/vice/r2000-enum-gen.test.ts", count: 4, plan: "29-05" },
  { path: "src/mcp/vice/r2000-memmap-render.test.ts", count: 4, plan: "29-05" },
  { path: "src/mcp/vice/r2000-symbols.ts", count: 7, plan: "29-05" },
  { path: "src/mcp/vice/r2000-cli.ts", count: 13, plan: "29-05" },
  { path: "src/mcp/vice/r2000-cli.test.ts", count: 14, plan: "29-05" },
  { path: "src/mcp/vice/r2000-spawn-seam.test.ts", count: 39, plan: "29-05" },
  { path: "src/mcp/vice/r2000-answer-key.test.ts", count: 2, plan: "29-05" },
  { path: "src/mcp/vice/docs-r2000-decisions.test.ts", count: 2, plan: "29-05" },
  { path: "src/mcp/vice/module-classification.ts", count: 1, plan: "29-05" },
  { path: "src/mcp/vice/hostpath-consumers.test.ts", count: 1, plan: "29-05" },

  // -- plan 29-09: the skill playbooks and the installation prose. Each
  //    src/skills/ entry has a shipped mirror under installer/skills/, which
  //    is regenerated by sync-skills.mjs and is in scope only because of the
  //    packFiles() half of the scope predicate.
  { path: "README.md", count: 8, plan: "29-09" },
  { path: "scripts/check-skill-fork-honesty.mjs", count: 3, plan: "29-09" },
  { path: "src/skills/acme-build/SKILL.md", count: 1, plan: "29-09" },
  { path: "src/skills/c64-memory-mapping/SKILL.md", count: 6, plan: "29-09" },
  { path: "src/skills/c64-program-recon/SKILL.md", count: 7, plan: "29-09" },
  { path: "src/skills/c64-program-recon/references/reconstruction.md", count: 1, plan: "29-09" },
  { path: "src/skills/c64-program-recon/references/tool-selection.md", count: 2, plan: "29-09" },
  { path: "src/skills/c64-program-recon/scripts/packer-finding.mjs", count: 3, plan: "29-09" },
  { path: "src/skills/routine-queue-walker/SKILL.md", count: 5, plan: "29-09" },
  { path: "src/skills/vice-wedge-triage/SKILL.md", count: 2, plan: "29-09" },
  { path: "installer/skills/acme-build/SKILL.md", count: 1, plan: "29-09" },
  { path: "installer/skills/c64-memory-mapping/SKILL.md", count: 6, plan: "29-09" },
  { path: "installer/skills/c64-program-recon/SKILL.md", count: 7, plan: "29-09" },
  { path: "installer/skills/c64-program-recon/references/reconstruction.md", count: 1, plan: "29-09" },
  { path: "installer/skills/c64-program-recon/references/tool-selection.md", count: 2, plan: "29-09" },
  { path: "installer/skills/c64-program-recon/scripts/packer-finding.mjs", count: 3, plan: "29-09" },
  { path: "installer/skills/routine-queue-walker/SKILL.md", count: 5, plan: "29-09" },
  { path: "installer/skills/vice-wedge-triage/SKILL.md", count: 2, plan: "29-09" },

  // -- plan 29-10: the deletion set, plus the survivors whose mentions exist
  //    only to describe what 29-10 deletes.
  { path: "src/mcp/vice/r2000-launch.ts", count: 20, plan: "29-10" },
  { path: "src/mcp/vice/r2000-launch.test.ts", count: 3, plan: "29-10" },
  { path: "src/mcp/vice/r2000-mcp-client.ts", count: 19, plan: "29-10" },
  { path: "src/mcp/vice/r2000-mcp-client.test.ts", count: 7, plan: "29-10" },
  { path: "src/mcp/vice/r2000-project.ts", count: 9, plan: "29-10" },
  { path: "src/mcp/vice/r2000-project.test.ts", count: 12, plan: "29-10" },
  { path: "src/mcp/vice/r2000-session.ts", count: 8, plan: "29-10" },
  { path: "src/mcp/vice/r2000-session.test.ts", count: 5, plan: "29-10" },
  { path: "src/mcp/vice/r2000-tools.ts", count: 19, plan: "29-10" },
  { path: "src/mcp/vice/r2000-tools.test.ts", count: 10, plan: "29-10" },
  { path: "src/mcp/vice/r2000-test-gate.ts", count: 16, plan: "29-10" },
  { path: "src/mcp/vice/r2000-verify.ts", count: 5, plan: "29-10" },
  { path: "src/mcp/vice/r2000-verify.test.ts", count: 4, plan: "29-10" },
  { path: "src/mcp/vice/r2000-symbol-roundtrip.test.ts", count: 7, plan: "29-10" },
  { path: "src/mcp/vice/vice-proxy.ts", count: 4, plan: "29-10" },
  { path: "src/mcp/vice/vice-proxy.test.ts", count: 1, plan: "29-10" },
  { path: "CLAUDE.md", count: 1, plan: "29-10" },
];

/**
 * The plan ids this phase actually has, DERIVED from disk rather than typed,
 * so `29-05` is accepted for exactly the same reason `29-09`, `29-10` and
 * `29-11` are: because a plan file with that number exists. A hand-typed list
 * is how one discharging plan silently stops being accepted.
 */
const PHASE_DIR = join(ROOT, ".planning/phases/29-the-mcp-surface");

function phasePlanIds() {
  if (!existsSync(PHASE_DIR)) return null;
  return new Set(
    readdirSync(PHASE_DIR)
      .filter((n) => /^29-\d{2}-PLAN\.md$/.test(n))
      .map((n) => n.slice(0, 5))
  );
}

// ===========================================================================
// THE SCAN
//
// Everything from here down is this gate's own DRIVER and runs only when this
// file is the process entry point. `removal-gate.test.ts` IMPORTS the two
// exported predicates above; without this guard that import would run the
// whole scan -- packing the installer, walking 391 files and, on any failure,
// calling process.exit(1) from inside an `import` statement, which no test can
// catch. `node scripts/check-no-<subject>.mjs` is unaffected: it IS the entry
// point.
// ===========================================================================

const IS_ENTRY_POINT =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (IS_ENTRY_POINT) {
const scope = scopeSet();
const scanned = [];
const perClassHits = new Map(EXEMPTION_CLASSES.map((c) => [c.id, 0]));
const perClassPathHits = new Map(EXEMPTION_CLASSES.map((c) => [c.id, new Map()]));
const perClassLines = new Map(EXEMPTION_CLASSES.map((c) => [c.id, new Map()]));
const allowListHits = new Map(TEMPORARY_ALLOW_LIST.map((e) => [e.path, 0]));
const noticesBlockCounts = new Map();

function exemptionFor(rel, line, text) {
  for (const cls of EXEMPTION_CLASSES) {
    if (cls.paths && Object.prototype.hasOwnProperty.call(cls.paths, rel)) return cls;
    if (cls.prefixes && cls.prefixes.some((p) => rel.startsWith(p))) return cls;
    if (cls.blockScoped && cls.blockScoped.includes(rel)) {
      if (isInsideAttributionBlock(text, line)) return cls;
      return null; // in a notices file, but OUTSIDE every attribution block
    }
  }
  return null;
}

for (const rel of scope.paths) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    need(false, `scope: ${rel} is in the scope set but is not on disk -- the walk or the pack list is stale`);
    continue;
  }
  // Bytes in, decoded here. Never `grep`, never a binary-file skip: see rule 4
  // of this file's header and the NUL byte at r2000-memmap-render.ts:12862.
  const text = readFileSync(abs).toString("utf8");
  scanned.push(rel);

  // UNCONDITIONAL scan first. `subjectHits` does not know exemptions exist.
  const hits = subjectHits(rel, text);
  if (hits.length === 0) continue;

  if (NOTICES_FILES.includes(rel)) noticesBlockCounts.set(rel, attributionBlocks(text).length);

  const allowEntry = TEMPORARY_ALLOW_LIST.find((e) => e.path === rel);

  for (const line of hits) {
    const cls = exemptionFor(rel, line, text);
    if (cls) {
      if (allowEntry) {
        need(
          false,
          `${rel}: is BOTH permanently exempt (class "${cls.id}") and on the temporary allow-list (plan ` +
            `${allowEntry.plan}) -- one file cannot be both "keeps the name forever" and "loses it this phase"`
        );
      }
      perClassHits.set(cls.id, perClassHits.get(cls.id) + 1);
      const byPath = perClassPathHits.get(cls.id);
      byPath.set(rel, (byPath.get(rel) ?? 0) + 1);
      const byLine = perClassLines.get(cls.id);
      if (!byLine.has(rel)) byLine.set(rel, []);
      byLine.get(rel).push(line);
      continue;
    }
    if (allowEntry) {
      allowListHits.set(rel, allowListHits.get(rel) + 1);
      continue;
    }
    need(
      false,
      `${rel}:${line === 0 ? "<path>" : line}: the removed static-analysis integration is named here. It is ` +
        `neither covered by a permanent exemption nor by the dated temporary allow-list, so this is a ` +
        `reintroduction (CUT-02). If this mention is legitimate and permanent, add a path- or block-scoped ` +
        `exemption WITH an exact hit count; if it is discharged later in this phase, add a dated allow-list ` +
        `entry naming the plan that discharges it. Do not widen an existing exemption to cover it.`
    );
  }
}

// ===========================================================================
// NON-VACUITY AND PIN ASSERTIONS
// ===========================================================================

need(
  scanned.length >= SCANNED_FILE_FLOOR,
  `non-vacuity: scanned ${scanned.length} files, expected at least ${SCANNED_FILE_FLOOR} -- a walk that finds ` +
    `nothing passes everything. Either git ls-files or the installer pack list is broken.`
);
need(
  scanned.length === scope.paths.length,
  `non-vacuity: the scope set holds ${scope.paths.length} paths but only ${scanned.length} were read -- a file ` +
    `was dropped. No file may be skipped for looking binary; that is exactly the blindness rule 4 forbids.`
);
need(
  scope.shippedOnlyCount > 0,
  `non-vacuity: the installer pack list contributed ${scope.shippedOnlyCount} paths that git ls-files does not ` +
    `carry -- expected the gitignored-but-shipped installer/skills/ tree. The packFiles() half of the scope ` +
    `predicate is not doing anything, which is the exact blind spot it exists to close.`
);

// --- per-exemption-class exact counts --------------------------------------
for (const cls of EXEMPTION_CLASSES) {
  const byPath = perClassPathHits.get(cls.id);
  if (cls.paths) {
    for (const [p, expected] of Object.entries(cls.paths)) {
      const actual = byPath.get(p) ?? 0;
      need(
        actual === expected,
        `exemption "${cls.id}" non-vacuity: expected exactly ${expected} exempted occurrence(s) in ${p}, got ` +
          `${actual}. A HIGHER count means the exemption is being used to hide a reintroduction rather than ` +
          `covering the mentions it was measured against; a LOWER count means the prose it protects has been ` +
          `deleted or the path is stale (see the staleness contract in this file's header).`
      );
    }
    for (const p of byPath.keys()) {
      if (cls.prefixes && cls.prefixes.some((x) => p.startsWith(x))) continue;
      need(
        Object.prototype.hasOwnProperty.call(cls.paths, p),
        `exemption "${cls.id}": ${p} was exempted but is not one of its pinned paths`
      );
    }
  }
  if (cls.lines) {
    for (const [p, expectedLines] of Object.entries(cls.lines)) {
      const actual = (perClassLines.get(cls.id).get(p) ?? []).slice().sort((a, b) => a - b);
      need(
        JSON.stringify(actual) === JSON.stringify(expectedLines),
        `exemption "${cls.id}" line pin: expected ${p} to carry the exempted occurrence(s) at line(s) ` +
          `${expectedLines.join(", ")}, got [${actual.join(", ")}]. This pin is what a grep-backed ` +
          `implementation cannot satisfy on a NUL-carrying file.`
      );
    }
  }
  if (cls.prefixes) {
    const total = [...byPath.entries()]
      .filter(([p]) => cls.prefixes.some((x) => p.startsWith(x)))
      .reduce((n, [, v]) => n + v, 0);
    need(
      total === cls.prefixHits,
      `exemption "${cls.id}" non-vacuity: expected exactly ${cls.prefixHits} exempted occurrence(s) under ` +
        `${cls.prefixes.join(", ")}, got ${total} -- update the pin in the same commit that changes the fixtures.`
    );
  }
}

// --- the notices exemption, both directions (CUT-03) -----------------------
for (const [rel, pin] of Object.entries(NOTICES_PINS)) {
  const blocks = noticesBlockCounts.get(rel) ?? (existsSync(join(ROOT, rel)) ? attributionBlocks(readFileSync(join(ROOT, rel)).toString("utf8")).length : -1);
  need(
    blocks === pin.blocks,
    `CUT-03: ${rel} carries ${blocks} shape-matched attribution block(s), expected exactly ${pin.blocks}. A ` +
      `LOWER count means an attribution block was deleted -- which is the cheapest way to silence a false fire ` +
      `and is exactly what this gate exists to make impossible. A HIGHER count means the exemption just widened.`
  );
  const actual = perClassPathHits.get("notices-attribution-blocks").get(rel) ?? 0;
  need(
    actual === pin.hits,
    `CUT-03: ${rel} accounts for ${actual} exempted occurrence(s) inside its attribution blocks, expected ` +
      `exactly ${pin.hits}.`
  );
}

// --- the temporary allow-list ----------------------------------------------
const planIds = phasePlanIds();
need(
  TEMPORARY_ALLOW_LIST.length === 0 || (planIds !== null && planIds.size >= 10),
  `temporary allow-list: the phase directory ${PHASE_DIR.slice(ROOT.length + 1)} must exist and hold at least 10 ` +
    `plan files while the allow-list is non-empty -- otherwise the "names a plan that is one of this phase's" ` +
    `assertion is vacuous.`
);
for (const entry of TEMPORARY_ALLOW_LIST) {
  need(
    existsSync(join(ROOT, entry.path)),
    `temporary allow-list (opened ${ALLOW_LIST_OPENED}): ${entry.path} is allow-listed for plan ${entry.plan} but ` +
      `is NOT on disk. Either the file was renamed -- in which case the plan that renamed it must re-point this ` +
      `entry in the same commit as the \`git mv\` -- or it was deleted and this entry must go with it.`
  );
  need(
    planIds === null || planIds.has(entry.plan),
    `temporary allow-list: ${entry.path} names discharging plan "${entry.plan}", which is not one of this ` +
      `phase's plans (${planIds === null ? "phase directory missing" : [...planIds].sort().join(", ")}). Every ` +
      `temporary entry must have an owner.`
  );
  const actual = allowListHits.get(entry.path) ?? 0;
  need(
    actual === entry.count,
    `temporary allow-list: ${entry.path} is pinned at ${entry.count} occurrence(s) for plan ${entry.plan}, got ` +
      `${actual}. A count that moved without its pin moving is a half-discharged entry; move both in the same ` +
      `commit, or remove the entry entirely once the plan has discharged it.`
  );
}

// ===========================================================================
// REPORT
// ===========================================================================

if (errors.length) {
  console.error("check-no-<subject>: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const exemptTotal = [...perClassHits.values()].reduce((a, b) => a + b, 0);
const allowTotal = [...allowListHits.values()].reduce((a, b) => a + b, 0);
const byPlan = new Map();
for (const e of TEMPORARY_ALLOW_LIST) {
  byPlan.set(e.plan, (byPlan.get(e.plan) ?? 0) + (allowListHits.get(e.path) ?? 0));
}

console.log(
  `check-no-<subject>: OK -- scanned ${scanned.length} files ` +
    `(${scope.trackedCount} tracked outside "${PLANNING_PREFIX}" + ${scope.shippedOnlyCount} shipped-but-untracked ` +
    `installer paths, floor ${SCANNED_FILE_FLOOR}); ${exemptTotal} occurrence(s) permanently exempt, ` +
    `${allowTotal} temporarily allow-listed across ${TEMPORARY_ALLOW_LIST.length} entries.\n` +
    `  permanent exemptions (exact pins):\n` +
    EXEMPTION_CLASSES.map((c) => `    ${c.id.padEnd(36)} ${perClassHits.get(c.id)}`).join("\n") +
    `\n  temporary allow-list by discharging plan (opened ${ALLOW_LIST_OPENED}, must be EMPTY at phase close):\n` +
    [...byPlan.entries()]
      .sort()
      .map(([p, n]) => `    ${p.padEnd(36)} ${n}`)
      .join("\n")
);
}
