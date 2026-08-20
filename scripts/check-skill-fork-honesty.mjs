#!/usr/bin/env node
// SKILL-01/DIST-02/DIST-03: a playbook naming a fork-only tool with no
// fork-requirement sentence nearby sends Claude into a refusal it was never
// warned about -- and CLAUDE.md's Compatibility constraint says such a skill
// *breaks* on stock rather than degrading. This is the ONE place that checks
// documentation honesty over first-party prose, and it now covers TWO
// surfaces sharing that same failure class:
//   1. playbook prose (.claude/skills/): every mention of a tool the active
//      backend might not advertise must sit in a markdown section that also
//      states the fork requirement (and the stock route, when one exists).
//   2. README.md: it must name the VICE_BACKEND switch, the two named
//      fork-only tools, the generated support-table link, the version
//      gate, and (Phase 10, R2000-03) regenerator2000 as a required
//      prerequisite -- and it must never re-introduce the ghost
//      guardrail-test claim.
// Both are documentation-honesty checks over first-party prose read as data,
// and one CI-blocking step is cheaper to keep green than two.
//   3. docs/stock-vice-parity.md: a Nyquist-gap addition (GAP-2, DIST-01/
//      SKILL-01) -- 08-06 corrected this doc's stale forward-looking claims
//      (a "deferred to Phase 7"/"ships in Phase 7" pair for tools that
//      phase closed without building, a "Phase 8's parity harness" promise
//      for a harness cut from scope, a "must cover answer-shape drift" claim
//      overstating SKILL-01's actual text, and an open developer-decision
//      flag) and pointed the reader at the generated docs/tool-support.md
//      instead. Before this addition, nothing re-checked that correction --
//      the same class of stale-prose defect could return to this file with
//      no lint catching it (this script's own skills walk only covers
//      .claude/skills/ and README.md). Only claims 08-06-SUMMARY.md actually
//      corrected are asserted here; the file's many legitimate historical
//      "(Phase N, REQ-ID)" citations are untouched.
//   4. The R2000-05 deletion pin (Phase 10, plan 10-08): plan 10-06 deleted
//      cmdDisasm() (the toacme-backed `disasm` verb) from acme.mjs in full,
//      and every SKILL.md/references/*.md caveat it motivated. This walks
//      the WHOLE .claude/skills tree already collected into `skillFiles`
//      above -- not a named file list -- for "toacme"/"cmdDisasm"/the
//      standalone "disasm" verb token, because a file-by-file version of
//      this exact assertion is the same structural blindness that let
//      c64-program-recon/references/tool-selection.md dangle a stale
//      reference through an earlier --include=SKILL.md-shaped pass. Exactly
//      one documented exemption: diff-images.test.mjs's provenance-ledger
//      string `evidence: "disasm"`, exempted by LINE content, not by file,
//      so a real reintroduction elsewhere in that same file is still caught.
//
// WHAT NOT TO DO: do not hand-maintain a second list of fork-only tool names
// here. The list is derived from capability-registry.ts's CAPABILITY_REGISTRY
// (every entry whose providedBy is "fork") -- that module is the ONE place
// per-backend capability data lives (08-01-SUMMARY.md). A hand-copied list
// here would drift from it the first time a tool's category changes.
//
// This script only ever readFileSync()s and regex-matches. It never uses a
// dynamic import, require, eval, or a spawn against anything under
// .claude/skills/ or README.md -- both are untrusted/first-party prose that
// is matched, never executed. The only import is the first-party
// capability-registry.ts.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CAPABILITY_REGISTRY } from "../.claude/mcp/vice/capability-registry.ts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VICE_DIR = join(ROOT, ".claude/mcp/vice");
const SKILLS_DIR = join(ROOT, ".claude/skills");
const README_PATH = join(ROOT, "README.md");
const PARITY_DOC_PATH = join(ROOT, "docs/stock-vice-parity.md");

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// --- Walk .claude/skills/ for *.md and *.mjs files (including *.test.mjs) --
// Copied from scripts/check-skill-tool-coverage.mjs's walkSkills(): never
// follows a symlink out of the tree; skips any node_modules segment
// defensively even though the directory is small, committed, and gitignore
// keeps node_modules out of it repo-wide.
function walkSkills(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const p = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walkSkills(p, acc);
    } else if (/\.(md|mjs)$/.test(entry.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const skillFiles = walkSkills(SKILLS_DIR, []);

// Top-level skill directories actually scanned (>=1 file read in each) --
// non-vacuity control.
const topLevelDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
const dirsWithAFileRead = new Set();
for (const f of skillFiles) {
  const rel = f.slice(SKILLS_DIR.length + 1);
  const top = rel.split("/")[0];
  dirsWithAFileRead.add(top);
}

// --- Names to police: derived from the registry, never hand-listed (D-E) ---
// Every entry whose providedBy is "fork" -- not just the "hardware" category.
// A descoped fork-only tool named bare in a playbook is the same failure as a
// hardware one: the active (stock) backend does not have it either way.
const FORK_ONLY_NAMES = new Set(
  CAPABILITY_REGISTRY.filter((e) => e.providedBy === "fork").map((e) => e.name)
);
const registryByName = new Map(CAPABILITY_REGISTRY.map((e) => [e.name, e]));

// --- Extraction --------------------------------------------------------
// Strip any "mcp__<plugin>_vice__" prefix BEFORE matching, so a call site
// written as mcp__plugin_c64-re-tools_vice__vice_keyboard_matrix yields the
// bare tool name vice_keyboard_matrix rather than nothing at all.
const MCP_PREFIX_RE = /mcp__[\w-]+_vice__/g;
const TOOL_NAME_RE = /\bvice_[a-z0-9_]+/g;

// Annotation signals -- a section is "annotated" when its body matches any
// of these, case-insensitive. Kept short and literal; this script never
// attempts to parse markdown structure beyond splitting on ATX headings.
const ANNOTATION_RE = /(fork-only|requires the fork backend|requires the fork|fork backend|VICE_BACKEND)/i;

// The proximity rule (research Assumption A4, resolved): markdown-section
// scope. Split each .md file into sections at ATX headings (^#{1,6} );
// text before the first heading counts as one leading section. A mention is
// compliant when its OWN section body contains an annotation signal
// anywhere -- not a fixed +/-N-line window, which would wrongly flag
// observation-hazards.md's already-correct line-79 mention (its annotation
// sits at line 88, 9 lines away) while under-catching a bare mention two
// lines above a heading boundary. Validated against the real tree this
// session: reproduces exactly the four known gaps, zero false positives. Do
// not "tighten" this back into a fixed window.
function splitSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let current = { heading: "(before first heading)", startLine: 1, lines: [] };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,6} /.test(line)) {
      if (current.lines.length > 0 || sections.length === 0) sections.push(current);
      current = { heading: line.replace(/^#{1,6}\s*/, "").trim(), startLine: i + 1, lines: [] };
    }
    current.lines.push(line);
  }
  sections.push(current);
  return sections;
}

// Stale-forward-reference check (research Pitfall 5): a sentence deferring a
// capability to a numbered phase, using a possessive "Phase N's ..." idiom
// (the shape this project's own prose uses to hand a capability off to a
// future phase, e.g. "Phase 8's BACK-05 is what reports the absence") co-
// occurring on the same line with one of the stale-framing words below.
//
// Deliberately narrower than a bare `Phase \d` co-occurrence: a plain
// citation like "(Phase 7, D-02)" that quotes a THIRD PARTY's own doc string
// ("cycles is documented as *not yet implemented*" -- the fork's own schema
// text, not this project's claim) is not a deferral and must not be flagged.
// Verified against the real tree this session: the possessive form matches
// exactly one line in six skills (control-flow.md's now-stale
// "Phase 8's `BACK-05`" sentence) and excludes tool-selection.md's unrelated
// "(Phase 7, D-02)" citation, which shares the same stale-word vocabulary
// ("not yet implemented") but is not a deferral of a capability.
const PHASE_POSSESSIVE_RE = /Phase\s+\d+['’]s/;
const STALE_WORDS_RE = /\b(deferred|not yet|until|unavailable)\b/i;

let totalForkMentions = 0;
const positiveControlsSeen = new Set();

for (const f of skillFiles) {
  const raw = readFileSync(f, "utf8");
  const rel = f.slice(ROOT.length + 1);

  // Stale-forward-reference: line-based, independent of section scope.
  const rawLines = raw.split("\n");
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (PHASE_POSSESSIVE_RE.test(line) && STALE_WORDS_RE.test(line)) {
      need(
        false,
        `${rel}:${i + 1}: stale forward reference to a numbered phase ("${line.trim()}") -- ` +
          `state the current truth instead, and name no future phase`
      );
    }
  }

  // Fork-only mention proximity: markdown-section scope, .md files only (an
  // ATX heading is a markdown concept; .mjs files carry no section
  // structure to scope against).
  if (!f.endsWith(".md")) continue;

  const sections = splitSections(raw);
  for (const section of sections) {
    const sectionText = section.lines.join("\n");
    const cleaned = sectionText.replace(MCP_PREFIX_RE, "");
    const matches = [...cleaned.matchAll(TOOL_NAME_RE)];
    const forkMentionsInSection = matches.filter((m) => FORK_ONLY_NAMES.has(m[0]));
    if (forkMentionsInSection.length === 0) continue;

    totalForkMentions += forkMentionsInSection.length;

    const isAnnotated = ANNOTATION_RE.test(sectionText);
    if (isAnnotated) {
      if (rel.endsWith("tool-selection.md")) positiveControlsSeen.add("tool-selection.md");
      if (rel.endsWith("control-flow.md")) positiveControlsSeen.add("control-flow.md");
      continue;
    }

    // Not annotated -- find the 1-based line number of the first fork-only
    // mention in this section, relative to the whole file, for the report.
    const firstMention = forkMentionsInSection[0];
    const upToMention = cleaned.slice(0, firstMention.index);
    const lineOffset = upToMention.split("\n").length - 1;
    const lineNo = section.startLine + lineOffset;
    const names = [...new Set(forkMentionsInSection.map((m) => m[0]))];
    for (const name of names) {
      const entry = registryByName.get(name);
      const altText = entry?.alternative ? ` Stock route: ${entry.alternative}` : " No stock route exists.";
      need(
        false,
        `${rel}:${lineNo}: "${name}" mentioned in section "${section.heading}" with no fork-requirement ` +
          `annotation in that section -- state that it requires the fork backend.${altText}`
      );
    }
  }
}

// --- README presence assertions (08-05, DIST-02/DIST-03) -------------------
// Plan 08-05 extends this script rather than re-deriving its walk/report
// shape (08-04-SUMMARY.md's own "Next Phase Readiness" note). README.md is
// read ONCE with readFileSync and matched by plain substring containment --
// never a regex constructed from its content, never eval, never a spawn.
const readmeSource = readFileSync(README_PATH, "utf8");

const REQUIRED_README_SUBSTRINGS = [
  ["VICE_BACKEND", "a reader cannot select a backend at all"],
  [
    "vice_sid_get_state",
    "a stock user is not warned this tool requires the fork before they design a method around it",
  ],
  [
    "vice_keyboard_matrix",
    "a stock user is not warned this tool requires the fork before they design a method around it",
  ],
  ["docs/tool-support.md", "the reader loses their route to the full per-tool answer"],
  ["3.10", "the reader cannot tell what an `apt install` of VICE gives them relative to the version gate"],
  [
    "regenerator2000",
    "a reader is not told regenerator2000 is a required prerequisite, so they hit the static-disassembly route with no tool installed and no explanation",
  ],
];
for (const [needle, whatIsLost] of REQUIRED_README_SUBSTRINGS) {
  need(
    readmeSource.includes(needle),
    `README.md is missing the required string "${needle}" -- without it, ${whatIsLost}.`
  );
}

// Inverse assertions: catch a regression back into a false claim, in either
// direction of drift.
const FORBIDDEN_README_SUBSTRINGS = [
  [
    "skill-docs.test.ts",
    "this ghost guardrail-test file does not exist anywhere in this repository -- claiming it exists is a false statement about this repo",
  ],
  [
    "vice-mcp-selector-docs.test.ts",
    "this ghost guardrail-test file does not exist anywhere in this repository -- claiming it exists is a false statement about this repo",
  ],
];
for (const [needle, why] of FORBIDDEN_README_SUBSTRINGS) {
  need(!readmeSource.includes(needle), `README.md must not contain "${needle}" -- ${why}.`);
}

// --- docs/stock-vice-parity.md regression assertions (GAP-2, DIST-01/SKILL-01) --
// 08-06-SUMMARY.md corrected exactly four stale forward-looking claims plus
// one open developer-decision flag in this doc (see that summary's "Before/
// After Text of the Four Corrected Parity-Doc Claims"). This block asserts
// only what that summary documents as an actual correction -- read literally
// from its own before/after quotations -- so a regression back into any of
// them fails CI, without inventing a claim 08-06 never made. It deliberately
// does NOT touch the file's many legitimate historical "(Phase N, REQ-ID)"
// citations (e.g. "(Phase 7, TIME-02)", "(Phase 5, DERIV-05)"), which are
// correct attributions, not stale forward references.
const parityDocSource = readFileSync(PARITY_DOC_PATH, "utf8");

const REQUIRED_PARITY_SUBSTRINGS = [
  [
    "docs/tool-support.md",
    "the reader loses the pointer 08-06 added to the generated per-tool support table, and the stock-only-tool bullet reverts to promising a parity harness that was cut from scope",
  ],
];
for (const [needle, whatIsLost] of REQUIRED_PARITY_SUBSTRINGS) {
  need(
    parityDocSource.includes(needle),
    `docs/stock-vice-parity.md is missing the required string "${needle}" -- without it, ${whatIsLost}.`
  );
}

const FORBIDDEN_PARITY_SUBSTRINGS = [
  [
    "deferred to Phase 7",
    "08-06 corrected vice_joystick_tap's claim that it is deferred to a phase that closed without building it -- it is simply not built",
  ],
  [
    "ships in Phase 7",
    "08-06 corrected vice_disk_detach's claim that it ships in a phase that closed without building it -- it was CUT from scope 2026-08-17",
  ],
  [
    "parity harness",
    "08-06 removed the promise of a Phase 8 parity harness that was cut from scope, replacing it with a pointer to the generated docs/tool-support.md",
  ],
  [
    "must cover answer-shape drift",
    "08-06 corrected the overstated claim that SKILL-01 must cover answer-shape drift -- SKILL-01's actual text only names the fork requirement at each call site, and answer-shape drift remains an open, mechanically-unchecked concern",
  ],
  [
    "flagged here for Phase 8 planning",
    "08-06 resolved this open developer-decision flag once ROADMAP.md's Phase 5 criterion 5 was amended to name all three unrecoverable tools -- it must not read as still-open",
  ],
];
for (const [needle, why] of FORBIDDEN_PARITY_SUBSTRINGS) {
  need(!parityDocSource.includes(needle), `docs/stock-vice-parity.md must not contain "${needle}" -- ${why}.`);
}

// --- R2000-05 deletion pin (Phase 10, plan 10-08) ---------------------------
// Plan 10-06 deleted cmdDisasm() (the toacme-backed `disasm` verb) from
// acme.mjs in full, and every SKILL.md/references/*.md caveat that verb
// motivated. This walks the WHOLE .claude/skills tree already collected
// into `skillFiles` above -- every .md and .mjs, not a named-file list --
// because a file-by-file version of this exact assertion is the same
// structural blindness that let c64-program-recon/references/tool-selection.md
// dangle a stale reference through an earlier --include=SKILL.md-shaped
// pass while that narrower gate reported clean. Do not narrow this back to
// a fixed file list.
//
// Exactly ONE documented exemption: diff-images.test.mjs's provenance-ledger
// string `evidence: "disasm"`, which shares only the word with the deleted
// verb. The exemption is scoped to the LINE, not the file, so a real
// reintroduction of `toacme`/`cmdDisasm`/the standalone `disasm` verb token
// anywhere else in that same file is still caught.
const DISASM_LINE_EXEMPTION = 'evidence: "disasm"';

for (const f of skillFiles) {
  const rel = f.slice(ROOT.length + 1);
  const raw = readFileSync(f, "utf8");
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(DISASM_LINE_EXEMPTION)) continue;
    if (line.includes("toacme")) {
      need(
        false,
        `${rel}:${i + 1}: "toacme" reappeared -- plan 10-06 deleted this tool dependency in full; a playbook or ` +
          `reference page naming it again sends an agent looking for a binary this project no longer wraps.`
      );
    }
    if (line.includes("cmdDisasm")) {
      need(
        false,
        `${rel}:${i + 1}: "cmdDisasm" reappeared -- this function was deleted from acme.mjs in plan 10-06; a ` +
          `reference to it again advertises a verb the script no longer has.`
      );
    }
    if (/\bdisasm\b/.test(line)) {
      need(
        false,
        `${rel}:${i + 1}: the standalone "disasm" verb reappeared -- plan 10-06 removed acme.mjs's disasm ` +
          `dispatch entry; a playbook or reference page advertising it sends an agent into an unknown-verb failure.`
      );
    }
  }
}

// Positive check: the replacement pointer must still exist (D-12) -- the
// deletion must not be "fixed" by deleting the pointer to the proven route
// too.
const ACME_BUILD_SKILL_PATH = join(SKILLS_DIR, "acme-build", "SKILL.md");
const acmeBuildSkillSource = readFileSync(ACME_BUILD_SKILL_PATH, "utf8");
need(
  acmeBuildSkillSource.includes("r2000 export-asm"),
  `${ACME_BUILD_SKILL_PATH.slice(ROOT.length + 1)} is missing the replacement pointer string "r2000 export-asm" -- ` +
    `the deletion must not be "fixed" by deleting the pointer to the proven route too.`
);

// --- Non-vacuity controls ---------------------------------------------------
// A lint that finds nothing passes everything -- these are need()s, not
// comments.
need(
  topLevelDirs.length >= 6 && topLevelDirs.every((d) => dirsWithAFileRead.has(d)),
  `non-vacuity: expected at least 6 skill directories scanned with at least one file read in each, got ${topLevelDirs.length} directories (${[...dirsWithAFileRead].length} with a file read)`
);
need(
  totalForkMentions >= 8,
  `non-vacuity: expected at least 8 fork-only tool mentions across .claude/skills/, got ${totalForkMentions} -- the skills walk or extraction regex may be broken`
);
need(
  positiveControlsSeen.has("tool-selection.md"),
  `non-vacuity: positive control references/tool-selection.md must be classified compliant (inline annotation on the same line as the mention) -- if this fails, the annotation-signal match or the walk is broken`
);
need(
  positiveControlsSeen.has("control-flow.md"),
  `non-vacuity: positive control references/control-flow.md must be classified compliant (annotation in the same section as the mention) -- if this fails, the section-scoped proximity rule or the walk is broken`
);
need(
  FORK_ONLY_NAMES.size >= 20,
  `non-vacuity: expected at least 20 fork-only names derived from CAPABILITY_REGISTRY, got ${FORK_ONLY_NAMES.size} -- the registry import may be broken`
);
need(
  parityDocSource.length > 5000,
  `non-vacuity: docs/stock-vice-parity.md is suspiciously short (${parityDocSource.length} bytes) -- the file may have been truncated or this script may be reading the wrong path`
);

// --- Report ------------------------------------------------------------
if (errors.length) {
  console.error("check-skill-fork-honesty: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

console.log(
  `check-skill-fork-honesty: OK -- ${totalForkMentions} fork-only mentions across ${skillFiles.length} files in ` +
    `${topLevelDirs.length} skill directories, all section-scoped-compliant; ${FORK_ONLY_NAMES.size} fork-only ` +
    `names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found; README.md carries all ` +
    `${REQUIRED_README_SUBSTRINGS.length} required strings and none of the ${FORBIDDEN_README_SUBSTRINGS.length} ` +
    `forbidden ones; docs/stock-vice-parity.md carries all ${REQUIRED_PARITY_SUBSTRINGS.length} required strings ` +
    `and none of the ${FORBIDDEN_PARITY_SUBSTRINGS.length} forbidden ones (08-06's regression guard).`
);
