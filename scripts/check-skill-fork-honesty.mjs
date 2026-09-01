#!/usr/bin/env node
// SKILL-01/DIST-02/DIST-03: a playbook naming a fork-only tool with no
// fork-requirement sentence nearby sends Claude into a refusal it was never
// warned about -- and CLAUDE.md's Compatibility constraint says such a skill
// *breaks* on stock rather than degrading. This is the ONE place that checks
// documentation honesty over first-party prose, and it now covers TWO
// surfaces sharing that same failure class:
//   1. playbook prose (src/skills/): every mention of a tool the active
//      backend might not advertise must sit in a markdown section that also
//      states the fork requirement (and the stock route, when one exists).
//   2. README.md: it must name the VICE_BACKEND switch, the two named
//      fork-only tools, the generated support-table link, the version
//      gate, and the ATTRIBUTION for the upstream analysis procedures the
//      skill playbooks adapt -- and it must never re-introduce the ghost
//      guardrail-test claim.
//
//      THE SIXTH REQUIRED STRING WAS RE-POINTED, NOT DROPPED (2026-08-29,
//      phase 29 plan 29-09). It used to assert that README named
//      the external analyser as a REQUIRED PREREQUISITE (Phase 10, ANNO-03) --
//      true when the plugin shelled out to that analyser, and false the
//      moment the integration was cut. Deleting the assertion outright was
//      the wrong repair: the obligation that survives the cut is CUT-03's,
//      the attribution for prose the skill playbooks still incorporate under
//      `MIT OR Apache-2.0`. So the string stays and its REASON moves. What a
//      reader loses if it goes is no longer an install step; it is the
//      attribution being findable from the README at all, instead of only
//      from a notices file nobody opens.
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
//      src/skills/ and README.md). Only claims 08-06-SUMMARY.md actually
//      corrected are asserted here; the file's many legitimate historical
//      "(Phase N, REQ-ID)" citations are untouched.
//   4. The ANNO-05 deletion pin (Phase 10, plan 10-08): plan 10-06 deleted
//      cmdDisasm() (the toacme-backed `disasm` verb) from acme.mjs in full,
//      and every SKILL.md/references/*.md caveat it motivated. This walks
//      the WHOLE src/skills tree already collected into `skillFiles`
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
// src/skills/ or README.md -- both are untrusted/first-party prose that
// is matched, never executed. The only import is the first-party
// capability-registry.ts.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CAPABILITY_REGISTRY } from "../src/mcp/vice/capability-registry.ts";
import { fileClaimViolations, isStandaloneDisasmToken } from "./lib/skill-honesty-checks.mjs";
import { walkSkills, MCP_PREFIX_RE, TOOL_NAME_RE, topLevelSkillDirs } from "./lib/skill-corpus.mjs";
import {
  parseRootArg,
  resolveContainedRoot,
  splitReadRefusalReason,
} from "./lib/audit-root.mjs";

const DEFAULT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The identifier this gate binds STATICALLY, named here so the split-read
 *  refusal below can print it. A static specifier resolves against this file's
 *  own location and cannot follow `--root`; keeping the list beside the import
 *  is what makes a future second import impossible to add without noticing that
 *  it belongs here too. */
const STATICALLY_BOUND = [
  { name: "CAPABILITY_REGISTRY", from: "../src/mcp/vice/capability-registry.ts" },
];

/**
 * Every path this gate reads, derived from ONE root, plus the subset that must
 * EXIST for the run to mean anything.
 *
 * WHY THIS FUNCTION EXISTS (phase 32, D-07): the phase-32 audit has to observe
 * this gate FAILING against a planted violation, and the only safe way to
 * arrange that for some rows is to point the whole gate at a synthetic tree
 * via `--root`. That is only sound if EVERY path comes from the one root.
 *
 * WHAT THIS GATE ACTUALLY DOES WITH `--root`, AND WHY (`CR-03`): every PATH
 * below comes from the one root, but not every INPUT to this gate is a path.
 * `CAPABILITY_REGISTRY` -- the table whose fork-only names this gate polices
 * the corpus against -- arrives through a static import at the top of this
 * file, and a static specifier is resolved against this file's own location, so
 * no argument can move it. This gate therefore does NOT support an arbitrary
 * `--root`: a resolved root that is not `DEFAULT_ROOT` is REFUSED outright,
 * below, rather than half-honoured.
 *
 * A sentence forbidding a re-derived `DEFAULT_ROOT` path stood here until
 * 2026-09-01. It was deleted because this file contradicted it sixteen lines
 * above itself: the phase-32 verifier reproduced this gate reading a synthetic
 * corpus and reporting `OK -- ... 24 fork-only names policed from
 * CAPABILITY_REGISTRY` at exit 0, where the corpus was synthetic and the
 * registry was real. A rule a file breaks in its own text is worse than no
 * rule, because a reader trusts it. The remedy chosen -- of the two the
 * verifier named -- is refusal rather than root-parameterised dynamic imports;
 * the reasoning is recorded in `scripts/lib/audit-root.mjs`'s "THE SPLIT-READ
 * SEAM" block and in plan 32-12's objective.
 *
 * `scripts/check-skill-description-overlap.mjs` still carries that sentence,
 * and correctly: it binds no such import, so it honours an arbitrary contained
 * root for BOTH halves of its comparison.
 */
function paths(root) {
  const skillsDir = join(root, "src/skills");
  const readmePath = join(root, "README.md");
  const parityDocPath = join(root, "docs/stock-vice-parity.md");
  const acmeBuildSkillPath = join(skillsDir, "acme-build", "SKILL.md");
  return {
    root,
    viceDir: join(root, "src/mcp/vice"),
    skillsDir,
    readmePath,
    parityDocPath,
    acmeBuildSkillPath,
    // Every file this gate readFileSync()s at a FIXED path with no existsSync()
    // of its own. (SKILL_FILE_CLAIMS entries are deliberately NOT here: each is
    // already existence-asserted as a first-class check, so a missing one must
    // stay a reported claim failure rather than becoming a --root diagnostic.)
    required: [skillsDir, readmePath, parityDocPath, acmeBuildSkillPath],
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
    script: "check-skill-fork-honesty",
  }));
} catch (err) {
  console.error(`check-skill-fork-honesty: ${err?.message ?? String(err)}`);
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
  console.error(`check-skill-fork-honesty: REFUSED -- ${err?.message ?? String(err)}`);
  process.exit(1);
}

// A SPLIT-READ REFUSAL (`CR-03`). Third failure class, same exit status as the
// other two, separated by its message prefix. Checked here -- before paths(),
// before the existence sweep and before the first read -- so a refused root
// causes no I/O at all.
//
// Measured at 7206f99, before this landed: `--root <in-repo synthetic tree>`
// exited 0 and printed a full green report ("11 fork-only mentions ... 24
// fork-only names policed from CAPABILITY_REGISTRY") in which the MENTIONS came
// from the synthetic corpus and the NAMES they were policed against came from
// the real repository. A planted violation in that corpus would have been
// measured against data the plant never touched.
if (RESOLVED_ROOT !== DEFAULT_ROOT) {
  console.error(
    `check-skill-fork-honesty: SPLIT READ REFUSED -- ${splitReadRefusalReason({
      resolvedRoot: RESOLVED_ROOT,
      defaultRoot: DEFAULT_ROOT,
      imports: STATICALLY_BOUND,
    })}`,
  );
  process.exit(1);
}

const P = paths(RESOLVED_ROOT);

// The ONE try/catch around every call below that can throw on a bad root.
// `P.required` enumerates them: topLevelSkillDirs() throws on a missing skills
// directory, and README.md / docs/stock-vice-parity.md / acme-build's SKILL.md
// are readFileSync()d with no existence check of their own.
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
  console.error(`check-skill-fork-honesty: FAIL (--root) -- ${err?.message ?? String(err)}`);
  process.exit(1);
}

// ROOT and the derived paths below are the RESOLVED root's, never
// DEFAULT_ROOT's. Any new path this gate needs goes inside paths() above.
const {
  root: ROOT,
  viceDir: VICE_DIR,
  skillsDir: SKILLS_DIR,
  readmePath: README_PATH,
  parityDocPath: PARITY_DOC_PATH,
} = P;

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// walkSkills(), MCP_PREFIX_RE, TOOL_NAME_RE and topLevelSkillDirs() now
// live in ./lib/skill-corpus.mjs (WR-12, 08-REVIEW.md) -- this script no
// longer carries its own copy; see that module's header for why.
const skillFiles = walkSkills(SKILLS_DIR);

// Top-level skill directories actually scanned (>=1 file read in each) --
// non-vacuity control. This assertion is about THIS run's traversal, not
// a corpus primitive, so it stays local rather than moving into the shared
// module.
const topLevelDirs = topLevelSkillDirs(SKILLS_DIR);
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
// MCP_PREFIX_RE/TOOL_NAME_RE now live in ./lib/skill-corpus.mjs (WR-12) --
// imported above, not re-derived here.

// Annotation signals. WR-10 (08-REVIEW.md): "fork backend" and "VICE_BACKEND"
// are strict superstrings of the two precise phrases below, so they only
// ever WEAKENED the rule -- incidental prose like "the fork backend is
// faster here" or an unrelated VICE_BACKEND mention used to silence a
// whole section. Dropped; only the two precise phrases remain. This
// pattern is now used ONLY as the single-fork-only-name fallback below
// (`names.length === 1`); a section naming two or more fork-only tools
// must satisfy the per-tool windowed match (`nearName`) instead.
const ANNOTATION_RE = /(fork-only|requires the fork\b)/i;

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
// capability to a numbered phase co-occurring, ANYWHERE in the same
// paragraph, with one of the stale-framing words below.
//
// WR-09 (08-REVIEW.md): this used to require both signals on the SAME
// PHYSICAL LINE, so whether a two-clause sentence tripped it was an
// accident of the author's hard wrap -- the one defect it was written to
// catch (control-flow.md's now-fixed "Phase 8's `BACK-05`" sentence) shared
// a line by luck; wrapped one word earlier, the identical defect would have
// passed. Now scoped to a blank-line-delimited paragraph instead (via
// splitParagraphs(), whitespace-normalised to a single line before
// testing), so a hard-wrap can never hide the same defect again.
//
// The phase-reference pattern is also widened from possessive-only
// ("Phase N's") to optional-possessive, so "deferred to Phase 9",
// "Phase 9 will report the absence" and "not yet built (Phase 9)" are all
// caught -- all three were previously invisible.
//
// A widened, paragraph-scoped, non-possessive pattern would otherwise
// false-positive on tool-selection.md's own "(Phase 7, D-02)" citation --
// a THIRD PARTY's own doc string ("cycles is documented as *not yet
// implemented*", the fork's own schema text) quoted alongside a real
// identifier citation, not a deferral, but sharing both the stale-word
// vocabulary AND (once bare "Phase N" counts) the phase-reference
// vocabulary. PHASE_CITATION_RE strips exactly that "(Phase N, ID-NN)"
// citation shape before testing PHASE_REF_RE, so a real citation can sit in
// the same paragraph as a stale word without tripping this check, while a
// genuine bare "Phase N" deferral elsewhere in the same paragraph is still
// caught (the strip only removes the citation's own text, nothing else).
const PHASE_REF_RE = /Phase\s+\d+(['’]s)?/;
const PHASE_CITATION_RE = /\(Phase\s+\d+,\s*[^)]+\)/g;
const STALE_WORDS_RE = /\b(deferred|not yet|until|unavailable)\b/i;

// Blank-line-delimited paragraph splitter. Each paragraph carries the
// 1-based line number of its FIRST line, for the report -- a paragraph, not
// a physical line, is now the unit of scope, but the failure message must
// still point somewhere useful in the file.
function splitParagraphs(text) {
  const lines = text.split("\n");
  const paragraphs = [];
  let current = [];
  let startLine = 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      if (current.length > 0) {
        paragraphs.push({ text: current.join("\n"), startLine });
        current = [];
      }
      continue;
    }
    if (current.length === 0) startLine = i + 1;
    current.push(line);
  }
  if (current.length > 0) paragraphs.push({ text: current.join("\n"), startLine });
  return paragraphs;
}

let totalForkMentions = 0;
const positiveControlsSeen = new Set();

for (const f of skillFiles) {
  const raw = readFileSync(f, "utf8");
  const rel = f.slice(ROOT.length + 1);

  // Stale-forward-reference: paragraph-scoped, independent of section scope
  // and of where the author happened to hard-wrap a line.
  for (const para of splitParagraphs(raw)) {
    const flat = para.text.replace(/\s+/g, " ");
    const flatForPhaseCheck = flat.replace(PHASE_CITATION_RE, "");
    if (PHASE_REF_RE.test(flatForPhaseCheck) && STALE_WORDS_RE.test(flat)) {
      need(
        false,
        `${rel}:${para.startLine}: stale forward reference to a numbered phase -- ` +
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

    const names = [...new Set(forkMentionsInSection.map((m) => m[0]))];

    // WR-10: compliance is decided PER TOOL, not per section. An
    // annotation about tool A must not license a bare mention of tool B in
    // the same section -- the old rule matched ANYWHERE in the section
    // body with no association between the annotation and the name it was
    // meant to annotate. `nearName` requires the annotation phrase to sit
    // within a bounded window (200 chars, never crossing a newline) on
    // either side of THIS name specifically. The `names.length === 1`
    // fallback keeps every currently-compliant single-fork-only-tool
    // section (all 7 flagged sections in the committed corpus, confirmed
    // by 08-REVIEW.md, have exactly one distinct fork-only name each)
    // compliant without requiring the annotation to sit inside the
    // 200-char window of that lone name -- there is no ambiguity about
    // which tool a section-wide annotation refers to when only one is
    // named.
    for (const name of names) {
      const nearName = new RegExp(
        `${name}[^\\n]{0,200}(fork-only|requires the fork)|` +
          `(fork-only|requires the fork)[^\\n]{0,200}${name}`,
        "i"
      );
      const compliant = nearName.test(cleaned) || (ANNOTATION_RE.test(sectionText) && names.length === 1);
      if (compliant) {
        if (rel.endsWith("tool-selection.md")) positiveControlsSeen.add("tool-selection.md");
        if (rel.endsWith("control-flow.md")) positiveControlsSeen.add("control-flow.md");
        continue;
      }

      // WR-11: the line offset is computed from THIS name's OWN first
      // mention in the section, not the section's first fork-only mention
      // of ANY name -- previously every message after the first cited a
      // line where its own name never appeared.
      const ownFirstMention = forkMentionsInSection.find((m) => m[0] === name);
      const upToMention = cleaned.slice(0, ownFirstMention.index);
      const lineOffset = upToMention.split("\n").length - 1;
      const lineNo = section.startLine + lineOffset;
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
    "the external analyser",
    "the README stops naming the upstream project whose analysis procedures the shipped skill playbooks adapt, so the CUT-03 attribution is reachable only from a notices file -- see the re-pointing note in this file's header, and note that the README must NOT claim it as an install prerequisite, which it no longer is",
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

// --- Per-file claim pins (WR-11, 10-REVIEW.md / 11.1-CONTEXT.md D-11.1-04) --
// A frozen array of { file, forbidden, required, why } entries, each checked
// in BOTH directions by the shared `fileClaimViolations()` predicate
// (scripts/lib/skill-honesty-checks.mjs): the file must not contain any
// `forbidden` string, and must contain every `required` string. A one-
// directional pin (only "forbidden absent") is how WR-11 survived in the
// first place -- `acme.mjs:238`'s stale "+ libs" claim sat unpinned for a
// whole phase. Each `file` is asserted to exist BEFORE it is read, so a
// rename fails loudly instead of silently skipping the check -- the same
// reason `NORMATIVE_DOCS` in docs-dangling-refs.test.ts asserts existence.
// An array, not a fourth hand-rolled `need()` idiom in this file, so the
// next honesty pin extends a list instead of adding new machinery.
const SKILL_FILE_CLAIMS = [
  {
    file: join(SKILLS_DIR, "acme-build", "scripts", "acme.mjs"),
    forbidden: ["+ libs"],
    required: ["no libraries needed"],
    why:
      "WR-11: acme.mjs's own --help claimed the `new` scaffold needs libraries, but plan 10-07 " +
      "deliberately made the scaffold library-free (local !address/= constants, no !source " +
      "<cbm/c64/...>) -- the first surface a reader sees about the scaffold must match what it is.",
  },
];
for (const claim of SKILL_FILE_CLAIMS) {
  const relClaim = claim.file.slice(ROOT.length + 1);
  need(existsSync(claim.file), `${relClaim} does not exist -- SKILL_FILE_CLAIMS references a renamed or deleted file (${claim.why})`);
  if (!existsSync(claim.file)) continue;
  const claimSource = readFileSync(claim.file, "utf8");
  for (const violation of fileClaimViolations(claimSource, claim)) {
    need(false, `${relClaim}: ${violation} -- ${claim.why}`);
  }
}

// --- ANNO-05 deletion pin (Phase 10, plan 10-08) ---------------------------
// Plan 10-06 deleted cmdDisasm() (the toacme-backed `disasm` verb) from
// acme.mjs in full, and every SKILL.md/references/*.md caveat that verb
// motivated. This walks the WHOLE src/skills tree already collected
// into `skillFiles` above -- every .md and .mjs, not a named-file list --
// because a file-by-file version of this exact assertion is the same
// structural blindness that let c64-program-recon/references/tool-selection.md
// dangle a stale reference through an earlier --include=SKILL.md-shaped
// pass while that narrower gate reported clean. Do not narrow this back to
// a fixed file list.
//
// Exactly ONE documented exemption: diff-images.test.mjs's provenance-ledger
// string `evidence: "disasm"`, which shares only the word with the deleted
// verb. The exemption is scoped to the LINE, not the file -- but ALSO to the
// standalone-disasm-token check alone, not to the whole line. Scoping to the
// line was true per-line (a real reintroduction of `toacme`/`cmdDisasm`/the
// standalone `disasm` verb token elsewhere in the same file is still caught)
// but silent about a reintroduction ON THE SAME LINE as the exemption string
// -- WR-03's finding was that a line reading `// see acme.mjs cmdDisasm /
// toacme, evidence: "disasm"` short-circuited all three checks the moment the
// exemption substring appeared anywhere on it, hiding a live "cmdDisasm"/
// "toacme" reintroduction behind the one line that is supposed to be inert.
// The `toacme`/`cmdDisasm` checks below therefore run BEFORE the exemption is
// even consulted; only the standalone-disasm-token check itself is exempted,
// and only for the one pinned occurrence. `exemptionHits` counts every line
// the exemption actually fired on; the non-vacuity assertion after the walk
// requires exactly one -- a second occurrence would mean the exemption is
// being reused to hide a second reintroduction rather than covering the one
// documented provenance-ledger string.
//
// IN-03: the standalone-disasm-token test used to be a plain word-boundary
// regex tested directly against the line, which false-positived on Phase 4's
// protected `disasm-*.ts` module names -- a hyphen is a non-word character,
// so that boundary was satisfied on both sides of "disasm-decoder.ts" too.
// It is now `isStandaloneDisasmToken()`, imported from scripts/lib/skill-
// honesty-checks.mjs, which excludes any hyphen-adjacent-letter shape on
// either side. See that module's own header for the excluded/still-caught
// examples. Do not reintroduce a bare word-boundary regex here.
const DISASM_LINE_EXEMPTION = 'evidence: "disasm"';
let exemptionHits = 0;

for (const f of skillFiles) {
  const rel = f.slice(ROOT.length + 1);
  const raw = readFileSync(f, "utf8");
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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
    if (isStandaloneDisasmToken(line)) {
      if (line.includes(DISASM_LINE_EXEMPTION)) {
        exemptionHits++;
        continue;
      }
      need(
        false,
        `${rel}:${i + 1}: a bare "disasm" verb token reappeared -- plan 10-06 removed acme.mjs's disasm dispatch ` +
          `entry; a playbook or reference page advertising it sends an agent into an unknown-verb failure. ` +
          `(IN-03: naming Phase 4's protected disasm-*.ts modules -- e.g. disasm-decoder.ts -- is deliberately ` +
          `permitted and does not trip this check; only the standalone verb token does.)`
      );
    }
  }
}

need(
  exemptionHits === 1,
  `WR-03 non-vacuity: expected the "${DISASM_LINE_EXEMPTION}" exemption to fire exactly once (the one documented ` +
    `diff-images.test.mjs provenance-ledger string), got ${exemptionHits} -- a second occurrence means the ` +
    `exemption is being used to hide a reintroduction rather than covering the one pinned, harmless string.`
);

// Positive check: the replacement pointer must still exist (D-12) -- the
// deletion must not be "fixed" by deleting the pointer to the proven route
// too.
//
// RE-POINTED 2026-08-29 (phase 29 plan 29-09, D-10/CUT-05), and the ONE thing
// to understand before touching it again is WHICH SIDE MOVED. This assertion
// used to pin the live invocation `anno export-asm`. Phase 29 removes that
// verb, so the assertion and the cut contradicted each other outright:
// cleansing the skill failed this check, while keeping the string to satisfy
// it fired the removal gate. THE SKILL IS THE SIDE THAT MOVED. Its live
// instruction is gone -- a playbook must not point at a verb that does not
// exist -- and in its place stands a dated withdrawal notice naming the route
// under the name it will carry when it returns, the phase that returns it, and
// the oracle it returns behind.
//
// The literal below was that FUTURE name when it was pinned, on purpose, and
// THE PREDICTION HELD. The route came back on 2026-08-31 as a live instruction
// under exactly that name, and this assertion survived the restoration with no
// edit at all -- the pointer that was a dated withdrawal notice is now a live
// invocation, and the same string satisfies the check in both states. That is
// the whole reason it was pinned to the returning name rather than the removed
// one, and it is recorded here in the past tense because it has happened. What
// the comment above says is unchanged in force: deleting the notice fails this
// check, so the cut still cannot be "fixed" by deleting the pointer to the
// route.
const ACME_BUILD_SKILL_PATH = P.acmeBuildSkillPath;
const acmeBuildSkillSource = readFileSync(ACME_BUILD_SKILL_PATH, "utf8");
need(
  acmeBuildSkillSource.includes("anno export-asm"),
  `${ACME_BUILD_SKILL_PATH.slice(ROOT.length + 1)} is missing the replacement pointer string "anno export-asm" -- ` +
    `the deletion must not be "fixed" by deleting the pointer to the route too. While the route was withdrawn ` +
    `that pointer was the dated withdrawal notice naming it; since the route returned on 2026-08-31 the same ` +
    `string is the live invocation, which is why this assertion never had to move.`
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
  `non-vacuity: expected at least 8 fork-only tool mentions across src/skills/, got ${totalForkMentions} -- the skills walk or extraction regex may be broken`
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
