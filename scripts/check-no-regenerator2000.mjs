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
//      binary. `src/mcp/vice/anno-memmap-render.ts` carries a literal NUL
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
/** Its ambient type declaration, so the colocated test typechecks. */
const GATE_TYPES_PATH = `scripts/check-no-${SUBJECT_NEEDLE}.d.mts`;
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
 * The SAME idea for the `src/skills/` tree, opened 2026-08-29 by plan 29-09.
 *
 * A skill playbook's ABS-02 attribution header is the CUT-03 class exactly:
 * prose that legitimately keeps the upstream project's name forever, naming an
 * UPSTREAM PROJECT rather than this repository's integration of it, and which
 * ROADMAP Phase 31 criterion 4 requires to survive the re-pointing with its
 * two naming lines byte-identical. It is not a route and no plan discharges
 * it, so it is a permanent exemption rather than an allow-list entry a later
 * plan would have to discharge by deleting an attribution.
 *
 * ANCHORED ON THE SAME MARKER `skill-attribution.test.ts` USES -- the
 * `ATTRIBUTION (ABS-02)` opener up to that HTML comment's own `-->` close --
 * so the guard that ENFORCES the attribution obligation and the exemption that
 * PROTECTS it agree on where a block begins and ends by construction. A
 * mention one line outside a block is NOT exempt, which is what keeps a live
 * reintroduction from hiding under a header.
 *
 * Returns 1-based inclusive line ranges, like `noticesBlocks` above.
 */
export function skillAttributionBlocks(text) {
  const lines = String(text ?? "").split("\n");
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    if (open === null) {
      if (lines[i].includes("ATTRIBUTION (ABS-02)")) open = i;
      continue;
    }
    if (lines[i].includes("-->")) {
      blocks.push({ firstLine: open + 1, lastLine: i + 1 });
      open = null;
    }
  }
  return blocks;
}

/** True when the 1-based `line` falls inside a skill ABS-02 attribution
 *  block. Exported for the same reason the notices predicate is. */
export function isInsideSkillAttributionBlock(text, line) {
  return skillAttributionBlocks(text).some((b) => line >= b.firstLine && line <= b.lastLine);
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

/**
 * The same two-number pin for each skill file carrying an ABS-02 attribution
 * header that names the subject, measured against THIS tree on 2026-08-29
 * after plan 29-09's re-pointing. BOTH numbers are asserted for the same
 * reason the notices pins assert both: deleting a whole header moves the block
 * count AND the hit count, while rewording one line inside a header moves only
 * the hits. Every entry has a shipped twin under `installer/skills/`,
 * regenerated by sync-skills.mjs and in scope only because of the packFiles()
 * half of the scope predicate -- the twin's numbers are identical BY
 * CONSTRUCTION, and a divergence means the sync did not run.
 */
const SKILL_ATTRIBUTION_PINS = {
  "src/skills/c64-memory-mapping/SKILL.md": { blocks: 2, hits: 5 },
  "src/skills/c64-program-recon/SKILL.md": { blocks: 2, hits: 4 },
  "src/skills/routine-queue-walker/SKILL.md": { blocks: 1, hits: 3 },
  "installer/skills/c64-memory-mapping/SKILL.md": { blocks: 2, hits: 5 },
  "installer/skills/c64-program-recon/SKILL.md": { blocks: 2, hits: 4 },
  "installer/skills/routine-queue-walker/SKILL.md": { blocks: 1, hits: 3 },
};

const EXEMPTION_CLASSES = [
  {
    id: "gate-self",
    why:
      "this gate, its ambient type declaration, the CI job that invokes it, the test that imports its predicates, " +
      "and the fixtures README that names it -- every one of which carries the subject ONLY as part of THIS " +
      "FILE'S OWN NAME, never as a live reference to the deleted integration.",
    paths: {
      [GATE_PATH]: 1,
      [GATE_TYPES_PATH]: 1,
      "src/mcp/vice/removal-gate.test.ts": 1,
      "src/mcp/vice/fixtures/README.md": 1,
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
      "the guards that enforce the attribution obligation itself. They must name the subject to police prose " +
      "about the subject; deleting their mentions would delete the enforcement. " +
      "check-skill-fork-honesty.mjs joined this class on 2026-08-29 (plan 29-09) when its sixth required README " +
      "string was RE-POINTED rather than dropped: the string used to assert that README named the analyser as an " +
      "install PREREQUISITE -- true while the plugin shelled out to it, false the moment the integration was cut " +
      "-- and it now asserts the CUT-03 ATTRIBUTION for prose the shipped playbooks still adapt. Its two " +
      "occurrences are the required-string entry and the header note recording that re-pointing; both are " +
      "enforcement, not a route.",
    paths: {
      "src/mcp/vice/skill-attribution.test.ts": 12,
      "scripts/check-skill-fork-honesty.mjs": 2,
    },
  },
  {
    id: "upstream-audit-manifest-provenance",
    why:
      "manifest-provenance constants naming an UPSTREAM PROJECT that is not deleted, rather than an integration " +
      "that is. PERMANENT, and re-pointed to anno-derivation.test.ts by plan 29-05 (see the staleness contract).",
    paths: { "src/mcp/vice/anno-derivation.test.ts": 3 },
  },
  {
    id: "memmap-measurement-provenance",
    why:
      "the one comment recording that this module's three declared query result shapes were measured LIVE against " +
      "a real pinned-version child rather than transcribed from a document. Pinned at exactly 1, at line 79, in a " +
      "file GNU grep refuses to read. PERMANENT, and re-pointed to anno-memmap-render.ts by plan 29-05.",
    paths: { "src/mcp/vice/anno-memmap-render.ts": 1 },
    /** Extra pin: the ONE occurrence must be at this line. This is what makes
     *  the binary-safety criterion checkable rather than asserted -- a
     *  grep-backed implementation reports nothing here. */
    lines: { "src/mcp/vice/anno-memmap-render.ts": [79] },
  },
  {
    id: "enum-name-threat-history",
    why:
      "T-11-ENUM-NAME's recorded threat history, with its pinned UPSTREAM source citations " +
      "(`app_state.rs:443`, `formatter_acme.rs:367-369`). It states what an upstream project's own validation " +
      "did and did NOT do, which is why assertLegalAcmeIdentifier() exists at all; it is true in the past tense " +
      "once the integration is gone and deleting it would delete the reason for the function. LINE-SCOPED, so a " +
      "second mention anywhere else in this module is a reintroduction rather than a covered occurrence. Path " +
      "re-pointed from the pre-rename name by plan 29-05.",
    atLines: { "src/mcp/vice/anno-acme-ident.ts": [68] },
  },
  {
    id: "census-design-and-incident-records",
    why:
      "the census's own rejected-design record and the WR-13 defect reproduction. `:9` records the route this " +
      "module REFUSES -- asking the analyser what it classified as `Code` is circular, provably so at upstream's " +
      "`analyzer.rs:445-540` -- which is the reason the module has the shape it has and stays true once the " +
      "rejected producer is gone. `:1752` and the test's `:1549` are one verbatim incident reproduction from " +
      "19-REVIEW.md; renaming the producer inside a past defect's reproduced inputs falsifies the record. " +
      "LINE-SCOPED because anno-coverage.ts is the one SPLIT file in this phase: its other two mentions describe " +
      "a live route and are temporarily allow-listed to 29-10 instead. Opened by plan 29-05.",
    atLines: {
      "src/mcp/vice/anno-coverage.ts": [9, 1752],
      "src/mcp/vice/anno-coverage.test.ts": [1549],
    },
  },
  {
    id: "renamed-guard-disciplines",
    why:
      "the three unpaired guard tests plan 29-05 renamed out from under the retired prefix, whose mentions are " +
      "each the guard's own description of what it enforces. " +
      "THE SPAWN-SEAM GUARD'S COUNT WAS RE-MEASURED 39 -> 1 ON 2026-08-30 (plan 29-10), and the reason is the " +
      "opposite of a weakening. Its 39 were its statement of a discipline expressed in terms of a SUBJECT THAT " +
      "NO LONGER EXISTS -- it enumerated the retired analyser's own spawn sites, named its binary constant, and " +
      "quoted its module names in planted-source literals. Plan 29-10 deleted both of the sites it was measured " +
      "against, so the guard was RE-POINTED onto the emulator spawn seam: the same discovery machinery, the " +
      "same comment-and-literal traps, the same pinned-site-set-in-both-directions shape, now asserting that " +
      "every shipped module spawning the emulator does it in the argv-array form with no shell command string. " +
      "The re-point was proven, not asserted -- a plant was added to the real backend-detect.mts, observed red " +
      "by name, and reverted. The ONE surviving occurrence is the founding incident the file exists to record: " +
      "that a module's header once CLAIMED to be the only spawn site and was wrong, which is the whole reason a " +
      "prose promise about where spawns live was replaced with a discovery pass. That sentence stays true in " +
      "the past tense and is unsayable without naming what was measured, so it remains PERMANENT rather than " +
      "becoming a temporary entry a later plan would have to discharge by deleting history. " +
      "The answer-key guard's 2 are a founding incident: it reads " +
      ".planning/phases/11-*/evidence/ with no existence guard and is the second leg of the do-not-archive-phase-" +
      "directories decision, so deleting it would silently discharge that constraint (D-11). The docs-decisions " +
      "guard's 2 are an ISSUE-TRACKER CITATION -- upstream issue #42, D-36's named reversal trigger -- not a " +
      "route. All three are re-pointed onto their new paths with their exact counts carried across unchanged; " +
      "none is converted into a temporary entry a later plan would have to discharge by deleting history.",
    paths: {
      "src/mcp/vice/spawn-seam.test.ts": 1,
      "src/mcp/vice/absorbed-answer-key.test.ts": 2,
      "src/mcp/vice/docs-absorbed-decisions.test.ts": 2,
    },
  },
  {
    id: "surviving-provenance",
    why:
      "past-tense provenance records, and references to the upstream PROJECT rather than to this repository's " +
      "integration of it, inside modules, tests, scripts and docs that survive the deletion. No plan in this " +
      "phase removes any of these, which is why they are exemptions and not allow-list entries. " +
      "README.md joined this class on 2026-08-29 (plan 29-09), and its two occurrences are ONE LINE: the " +
      "attribution paragraph's link to the upstream repository, whose URL and link text each carry the name. " +
      "Everything else the README said about the subject was INSTALL PROSE -- a `cargo install` line, a rustc " +
      "floor, container costs and a network-namespace caveat belonging to an HTTP route this project never used " +
      "-- and every one of those sentences was CORRECTED away, because a document telling a user to install " +
      "something the tool no longer uses is worse than saying nothing. The attribution is the part that outlives " +
      "the integration, so it is the part that stayed. " +
      "packer-finding.mjs joined this class on 2026-08-29 (plan 29-09): its remaining mention is a DATED " +
      "past-tense provenance paragraph recording that the retired analyser computed a packer identity and threw " +
      "it away before any machine-readable surface -- established four independent ways at the pin. That is the " +
      "whole reason the file exists, and deleting it invites the next reader to go looking for the packer-name " +
      "call that was already proven not to be there. Its tool-name-shaped literal was RETIRED in the same " +
      "commit, so what is left is a fact and not a route. The shipped twin under installer/skills/ carries the " +
      "same one occurrence by construction.",
    paths: {
      "README.md": 2,
      "docs/stock-vice-parity.md": 1,
      "src/skills/c64-program-recon/scripts/packer-finding.mjs": 1,
      "installer/skills/c64-program-recon/scripts/packer-finding.mjs": 1,
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
    id: "skill-attribution-headers",
    why:
      "the ABS-02 attribution headers in the absorbed skill playbooks -- the CUT-03 class, naming an UPSTREAM " +
      "PROJECT rather than this repository's integration of it, required by ROADMAP Phase 31 criterion 4 to " +
      "survive the re-pointing with their two naming lines byte-identical. BLOCK-scoped on the same " +
      "`ATTRIBUTION (ABS-02)` marker skill-attribution.test.ts anchors on: an occurrence inside a header is " +
      "exempt, the same occurrence one line outside one is not. Opened 2026-08-29 by plan 29-09, which removed " +
      "every LIVE mention from these files and left only the headers -- so these entries replace temporary " +
      "allow-list entries rather than widening anything.",
    skillBlocks: Object.fromEntries(
      Object.entries(SKILL_ATTRIBUTION_PINS).map(([p, pin]) => [p, pin.hits])
    ),
  },
  {
    id: "planted-fixtures",
    why:
      "fixture bodies that exist to be scanned by removal-gate.test.ts rather than by this gate. They are the " +
      "planted violations themselves, committed with a `.txt` suffix so no runner and no typechecker loads them.",
    prefixes: ["src/mcp/vice/fixtures/planted-"],
    prefixHits: 2,
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
  // -- THE RENAME SET, RE-POINTED BY PLAN 29-05 IN THE SAME COMMIT AS THE
  //    `git mv` (the staleness contract in this file's header).
  //
  //    29-05 RE-BUCKETED these entries as well as re-pointing them, because a
  //    bucket is a property of a MENTION and wave 1 could only see files. Six
  //    of the fourteen entries that stood here left this block entirely:
  //      - anno-acme-ident.ts (1) and anno-coverage.test.ts (1) are PERMANENT
  //        -- see `enum-name-threat-history` and
  //        `census-design-and-incident-records` above.
  //      - anno-coverage.ts SPLIT 2/2: two mentions are permanent (line-scoped
  //        above), two describe a live route and stay here, citing 29-10.
  //      - module-classification.ts (1) and hostpath-consumers.test.ts (1)
  //        were DISCHARGED by 29-05 itself: both are files 29-05 edits in
  //        place rather than renames, so scrubbing them there costs no
  //        pure-move reviewability, and neither statement stays true.
  //
  //    Everything left here cites the plan that ENDS it, and every citing plan
  //    carries BOTH this gate AND the named file in its own `files_modified`
  //    -- the reachability rule. An entry citing a plan that cannot touch its
  //    file is an orphan that makes 29-11's emptiness assertion unreachable.
  // -- ALL FIVE 29-10 SURVIVOR ENTRIES THAT STOOD HERE ARE DISCHARGED
  //    (2026-08-30, plan 29-10 task 2), and every one re-measured at exactly
  //    ZERO, so all five are DELETED rather than re-pinned -- an entry pinning
  //    a count of zero is an exemption with room in it, which this file's own
  //    header forbids. What each one described, and where it went:
  //
  //      - anno-coverage.ts (was 2). THE SPLIT FILE. Its two temporary
  //        mentions described a LIVE route: a doc comment saying label names
  //        arrive from the retired analyser's project file, and DIVERGENCE_NOTE
  //        -- a RUNTIME, USER-FACING string, not comment prose. Both were
  //        REWRITTEN, not deleted: the first now names the annotation store,
  //        the second states the same over-merge bias without naming a
  //        producer that is gone or a tool surface that no longer exists. Both
  //        edits were line-count-NEUTRAL on purpose, because this file's other
  //        two mentions are covered by a LINE-SCOPED permanent exemption
  //        (`census-design-and-incident-records`, at :9 and :1752) that a shift
  //        would have silently invalidated. Verified after the edit: exactly
  //        two occurrences remain, still at :9 and :1752. That permanent
  //        exemption is UNTOUCHED and must stay -- lowering it to zero because
  //        a temporary entry on the same file was discharged is exactly the
  //        widening this phase's standing prohibition forbids, one file at a
  //        time.
  //      - anno-enum-gen.ts (was 4) and anno-enum-gen.test.ts (was 4). All
  //        eight described the analyser child the enum route drove. The route
  //        is deleted and the HEURISTICS were extracted out of it as live code
  //        rather than deleted with it, so what is left names no producer.
  //      - anno-memmap-render.test.ts (was 2). Both belonged to the
  //        "<subject> availability gate (D-11)" test -- spelled with the
  //        placeholder here on purpose, because this file's own source must
  //        never carry the literal. That test was UNGATED and ran on every
  //        suite invocation; plan 29-10 deleted it under D-01 together with the
  //        gate module it called. Its three gated render tests were NOT
  //        deleted -- plan 29-12 had already converted them at wave 6 to
  //        ungated store-backed tests (D-17), which is why this entry fell to
  //        4 -> 2 there and 2 -> 0 here.
  //      - anno-symbols.ts (was 7). Every one described the export or import
  //        leg's own child invocation. The routes went; the pre-spawn
  //        validation gate stayed, and it names no producer.
  // DISCHARGED BY PLAN 29-07, 2026-08-29, and therefore DELETED rather than
  // re-cited. `anno-cli.ts` stood at 13 occurrences and `anno-cli.test.ts` at
  // 14; almost every one of the 27 described one of the six verbs D-14
  // removed, or a test of one. With the verbs gone and the file header and
  // USAGE rewritten to the two-verb surface, BOTH files re-measure at exactly
  // ZERO -- so neither has a subject left to exempt, and an entry pinning a
  // count of zero would be an exemption with room in it, which this file's own
  // header forbids. The fallback this plan carried (lower the count and
  // re-cite to 29-10, the next plan owning both this gate and that pair) was
  // therefore not needed.
  // The four unpaired guard tests LEFT this block in 29-05's own third task,
  // for the permanent exemption `renamed-guard-disciplines` -- each records a
  // discipline, a provenance constant or a founding incident that stays true
  // after the deletion, so converting them into temporary entries would have
  // obliged a later plan to discharge them by deleting history.
  // anno-derivation.test.ts was already permanently exempt as
  // `upstream-audit-manifest-provenance`; only its path moved.
  //
  // NOTHING CITES 29-05 ANY LONGER. That is the shape of a plan that finished
  // its own allow-list work rather than deferring it: an entry naming a plan
  // that has already run is unreachable, and unreachable is what makes
  // 29-11's emptiness assertion unreachable too.

  // -- plan 29-09: the installation prose and the documentation-honesty guard.
  //
  //    THE SIXTEEN SKILL ENTRIES THAT STOOD HERE ARE DISCHARGED (2026-08-29,
  //    plan 29-09 task 1), and they left this block in two different ways
  //    because they were two different kinds of mention:
  //
  //      - FIVE files re-measured at exactly ZERO and their entries are
  //        DELETED: acme-build/SKILL.md (was 1 -- the live export-asm route,
  //        replaced by a dated withdrawal notice), references/reconstruction.md
  //        (was 1), references/tool-selection.md (was 2) and
  //        vice-wedge-triage/SKILL.md (was 2), plus each one's shipped twin.
  //        Every one of those named a LIVE route into the retired analyser;
  //        with the route gone there is nothing left to exempt, and an entry
  //        pinning a count of zero would be an exemption with room in it.
  //
  //      - FOUR files kept a residual mention that is PERMANENT, and their
  //        entries moved to a permanent exemption rather than being
  //        discharged by deleting history. c64-memory-mapping/SKILL.md
  //        (6 -> 5), c64-program-recon/SKILL.md (7 -> 4) and
  //        routine-queue-walker/SKILL.md (5 -> 3) keep only their ABS-02
  //        attribution headers -- see `skill-attribution-headers`, which is
  //        BLOCK-scoped so a mention one line outside a header is still a
  //        reintroduction. packer-finding.mjs (3 -> 1) keeps one dated
  //        past-tense provenance paragraph -- see `surviving-provenance`.
  //        Both trees, in both classes, with exact pins.
  //
  //    What remains here is the pair task 2 discharges. Each has a mirror
  //    obligation NOWHERE ELSE: README.md's mentions are install prose plus
  //    attribution, and the honesty guard's three are the assertion that
  //    README carries the install prose. They move together or not at all.
  //    BOTH 29-09 ENTRIES ARE NOW DISCHARGED TOO (2026-08-29, task 2), and
  //    neither by deleting an obligation. README.md fell 8 -> 2 and
  //    check-skill-fork-honesty.mjs 3 -> 2; both residuals are PERMANENT and
  //    moved to a permanent exemption -- `surviving-provenance` for README's
  //    attribution link, `attribution-guard-test` for the guard that now
  //    asserts it. NOTHING CITES 29-09 ANY LONGER.

  // -- plan 29-10: THE DELETION SET IS DISCHARGED (2026-08-30).
  //
  //    The fourteen entries that stood here named the fourteen files plan
  //    29-10 deleted -- 134 occurrences between them, every one of which went
  //    with its file. Their entries are DELETED rather than re-pinned, and
  //    this gate proved it: with the files gone and the entries still present
  //    it reported all fourteen twice over, once for "allow-listed but NOT on
  //    disk" and once for "pinned at N, got 0". That is the staleness contract
  //    in this file's header working exactly as written, not a nuisance --
  //    an entry left behind after its file is gone FAILS rather than sitting
  //    inert.
  //
  //    vice-proxy.ts (was 4) is discharged too, and also re-measured at zero.
  //    Two of its four described the deleted session-close import and the
  //    comment block above its call site, and went with them. The other two
  //    were STALE rather than live -- the drain barrier's "reachable trigger"
  //    named a CLI verb plan 29-07 had already withdrawn, and the test hatch's
  //    provenance named the producer it was measured against -- and were
  //    CORRECTED to say what is still true rather than deleted, because the
  //    drain barrier and the hatch both outlive the routes they were measured
  //    against.
  //
  //    ONE ENTRY SURVIVES THIS PLAN, AND IT IS AN ORPHAN. See the block below.
  // The 29-10 orphan entry that stood here is DISCHARGED (2026-08-30): the
  // file's single counted mention was historical prose, rewritten in place
  // to keep the measurement and drop the subject's name. No assertion in
  // that file was touched and no skip was added -- the reserved decision
  // about its three stale tool-name failures remains reserved.
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
    // LINE-SCOPED (`atLines`): the exemption covers ONLY the enumerated lines
    // of the named path. Every other occurrence in the same file falls
    // through -- to the allow-list if the file has an entry, and to the
    // reintroduction error if it does not. This is the mechanism that makes a
    // SPLIT file expressible without widening anything: see the split note
    // above TEMPORARY_ALLOW_LIST.
    if (cls.atLines && Object.prototype.hasOwnProperty.call(cls.atLines, rel)) {
      if (cls.atLines[rel].includes(line)) return cls;
      continue; // not this class's line -- keep looking, never a whole-file pass
    }
    if (cls.prefixes && cls.prefixes.some((p) => rel.startsWith(p))) return cls;
    if (cls.blockScoped && cls.blockScoped.includes(rel)) {
      if (isInsideAttributionBlock(text, line)) return cls;
      return null; // in a notices file, but OUTSIDE every attribution block
    }
    if (cls.skillBlocks && Object.prototype.hasOwnProperty.call(cls.skillBlocks, rel)) {
      if (isInsideSkillAttributionBlock(text, line)) return cls;
      return null; // in a skill file, but OUTSIDE every ABS-02 header
    }
  }
  return null;
}

/** True when `rel` is exempted by a LINE-SCOPED class -- i.e. the file is
 *  deliberately SPLIT across the two blocks and its coexistence in both is the
 *  recorded decision, not the accident the conflict assertion below catches. */
function isLineScopedSplit(rel) {
  return EXEMPTION_CLASSES.some(
    (cls) => cls.atLines && Object.prototype.hasOwnProperty.call(cls.atLines, rel)
  );
}

for (const rel of scope.paths) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    need(false, `scope: ${rel} is in the scope set but is not on disk -- the walk or the pack list is stale`);
    continue;
  }
  // Bytes in, decoded here. Never `grep`, never a binary-file skip: see rule 4
  // of this file's header and the NUL byte at anno-memmap-render.ts:12862.
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
      if (allowEntry && !isLineScopedSplit(rel)) {
        need(
          false,
          `${rel}: is BOTH permanently exempt (class "${cls.id}") and on the temporary allow-list (plan ` +
            `${allowEntry.plan}) -- one file cannot be both "keeps the name forever" and "loses it this phase" ` +
            `unless the split is RECORDED line by line in an \`atLines\` class, which this one is not`
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
  if (cls.atLines) {
    for (const [p, expectedLines] of Object.entries(cls.atLines)) {
      const actual = (perClassLines.get(cls.id).get(p) ?? []).slice().sort((a, b) => a - b);
      const expected = [...expectedLines].sort((a, b) => a - b);
      need(
        JSON.stringify(actual) === JSON.stringify(expected),
        `exemption "${cls.id}" line scope: expected ${p} to carry exempted occurrence(s) at line(s) ` +
          `${expected.join(", ")}, got [${actual.join(", ")}]. A line-scoped exemption pins BOTH how many and ` +
          `WHICH; a mention that moved must move its pin in the same commit, and a mention that multiplied is a ` +
          `reintroduction rather than a drift.`
      );
    }
    for (const p of byPath.keys()) {
      need(
        Object.prototype.hasOwnProperty.call(cls.atLines, p),
        `exemption "${cls.id}": ${p} was exempted but is not one of its line-scoped paths`
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
  if (cls.skillBlocks) {
    for (const [p, expected] of Object.entries(cls.skillBlocks)) {
      const actual = byPath.get(p) ?? 0;
      need(
        actual === expected,
        `exemption "${cls.id}" non-vacuity: expected exactly ${expected} exempted occurrence(s) inside ` +
          `${p}'s ABS-02 attribution header(s), got ${actual}. A HIGHER count means the header is being used ` +
          `to hide a reintroduction; a LOWER count means the attribution prose CUT-03 exists to protect has ` +
          `been deleted or reworded away.`
      );
    }
    for (const p of byPath.keys()) {
      need(
        Object.prototype.hasOwnProperty.call(cls.skillBlocks, p),
        `exemption "${cls.id}": ${p} was exempted but is not one of its pinned skill paths`
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

// --- the skill ABS-02 headers, both directions (CUT-03) --------------------
// Same two-number shape as the notices pins above, and same reason: the block
// count fails when a whole header is deleted, the hit count fails when a line
// inside one is reworded away. The hit half is already asserted by the
// skillBlocks loop above; what is added here is the BLOCK count, which is the
// half that catches a header removed wholesale.
for (const [rel, pin] of Object.entries(SKILL_ATTRIBUTION_PINS)) {
  const abs = join(ROOT, rel);
  const blocks = existsSync(abs) ? skillAttributionBlocks(readFileSync(abs).toString("utf8")).length : -1;
  need(
    blocks === pin.blocks,
    `CUT-03: ${rel} carries ${blocks} ABS-02 attribution header(s), expected exactly ${pin.blocks}. A LOWER ` +
      `count means an attribution header was deleted -- the cheapest way to silence a false fire, and exactly ` +
      `what this gate exists to make impossible. A HIGHER count means the exemption just widened.`
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
