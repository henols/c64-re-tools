#!/usr/bin/env node
// SKILL-01/DIST-02/DIST-03: a playbook naming a permanently-unavailable tool
// with no permanent-limitation sentence nearby sends Claude into a refusal it
// was never warned about -- and CLAUDE.md's Compatibility constraint says such
// a skill *breaks* on stock rather than degrading. This is the ONE place that
// checks documentation honesty over first-party prose, and it covers THREE
// surfaces sharing that same failure class.
//
// INVERTED AND RENAMED (2026-09-12, phase 52 plan 52-09): this file was
// `check-skill-fork-honesty.mjs`. Phase 52 removed the `barryw/vice-mcp` fork
// backend entirely; this project now drives only stock upstream VICE. Every
// assertion this file used to make was ABOUT the fork -- a `VICE_BACKEND`
// switch, a per-backend tool-list trim, a `FORK_ONLY_NAMES` set derived from
// the deleted per-backend capability table that shipped in an earlier phase
// (see 52-07-SUMMARY.md) -- and every one of those subjects is gone. The
// obligation that survives the removal is
// STRONGER, not weaker: shipped prose must not claim a capability route that
// does not exist. That is true whether the false route is "ask the fork" or
// "there is no fork to ask" left unstated. This file's own header already
// carried the precedent for how to handle a required string whose subject
// changes shape: RE-POINT IT, do not drop it (see the 2026-08-29 note
// preserved below). This inversion follows that precedent for every assertion
// in the file, not only one string: a registry-derived set becomes a literal
// one; a "requires the fork" annotation becomes "permanently unavailable, see
// docs/stock-hard-losses.md"; a `VICE_BACKEND`/`docs/tool-support.md`
// requirement on README.md becomes a `docs/stock-hard-losses.md` requirement
// and a `VICE_BACKEND` prohibition. Every non-vacuity floor the fork-era
// version carried is replaced by an equivalent floor against the new subject,
// never dropped -- a lint that finds nothing passes everything, which is worse
// than the stale assertions it replaced.
//
// WHAT NOT TO DO, reaffirmed rather than restated from scratch: do not delete
// an assertion whose SUBJECT changed instead of re-pointing it at the subject
// that replaced it. That is the mistake this file exists to prevent one layer
// up (stale prose in README.md, docs/stock-vice-parity.md and the skill
// playbooks) and it applies equally to this file's own assertions about
// itself.
//
//   1. playbook prose (src/skills/): every mention of one of the six
//      permanently-unavailable tool names must sit in a markdown section that
//      also states the limitation is permanent and cites
//      `docs/stock-hard-losses.md` somewhere in the skills tree (the
//      per-mention proximity rule requires the "permanently unavailable"
//      phrasing; the citation is verified as a tree-wide floor, since a
//      playbook may correctly point at a sibling reference file that itself
//      carries the citation rather than repeating it locally).
//   2. README.md: it must name the two best-known permanently-unavailable
//      tools (so a reader designing a method around them is warned), the
//      `docs/stock-hard-losses.md` acceptance record, the version gate, and
//      the ATTRIBUTION for the upstream analysis procedures the skill
//      playbooks adapt -- and it must never re-introduce the ghost
//      guardrail-test claim or the retired `VICE_BACKEND` switch.
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
// All three are documentation-honesty checks over first-party prose read as
// data, and one CI-blocking step is cheaper to keep green than three.
//   3. docs/stock-vice-parity.md: a Nyquist-gap addition (GAP-2, DIST-01/
//      SKILL-01) -- 08-06 corrected this doc's stale forward-looking claims
//      (a "deferred to Phase 7"/"ships in Phase 7" pair for tools that
//      phase closed without building, a "Phase 8's parity harness" promise
//      for a harness cut from scope, a "must cover answer-shape drift" claim
//      overstating SKILL-01's actual text, and an open developer-decision
//      flag). Only claims 08-06-SUMMARY.md actually corrected are asserted
//      here; the file's many legitimate historical "(Phase N, REQ-ID)"
//      citations are untouched. Phase 52 plan 52-09 adds one more: the
//      document must carry a dated note recording that the fork backend was
//      removed, since a "parity" document with nothing left to compare
//      against needs to say why it still exists.
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
//      Unrelated to the fork removal; kept unchanged by this inversion.
//
// WHAT NOT TO DO: do not hand-maintain a second list of permanently-unavailable
// tool names anywhere else in this repository. `docs/stock-hard-losses.md` is
// the ONE narrative record of these six hardware-level facts
// (`scripts/check-skill-tool-coverage.mjs` carries its own byte-identical
// literal for a different purpose -- coverage classification, not honesty
// proximity -- and both are pinned to stay consistent with that document by
// their own non-vacuity floors, not by importing one from the other).
//
// This script only ever readFileSync()s and regex-matches. It never uses a
// dynamic import, require, eval, or a spawn against anything under
// src/skills/ or README.md -- both are untrusted/first-party prose that
// is matched, never executed. Unlike its fork-era predecessor, this file binds
// NO data through a static `../src/` import: the six-name set below is a
// literal declared in this file, so there is no comparison data that could
// fail to follow a `--root` override, and no split-read hazard to refuse (see
// `paths()` below for what that means for `--root`).
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fileClaimViolations, isStandaloneDisasmToken } from "./lib/skill-honesty-checks.mjs";
import { walkSkills, MCP_PREFIX_RE, TOOL_NAME_RE, topLevelSkillDirs } from "./lib/skill-corpus.mjs";
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
 * WHAT THIS GATE DOES WITH `--root`, CORRECTED BY THE INVERSION (phase 52 plan
 * 52-09): the fork-era version of this file bound its policed name set through
 * a static `../src/` import of the now-deleted per-backend capability table,
 * which could not follow a `--root` override, and REFUSED any resolved root that was not
 * `DEFAULT_ROOT` outright rather than half-honour it (`CR-03`). That import is
 * gone: the six permanently-unavailable tool names below are a literal
 * declared in this file, so every input this gate reads -- the policed name
 * set included -- now comes from the SAME resolved root. There is therefore no
 * split-read hazard left to refuse, and this gate honours an arbitrary
 * contained root for its whole comparison, the same as
 * `scripts/check-skill-description-overlap.mjs` already does and for the same
 * reason: it binds no `../src/` specifier statically. An out-of-repository
 * root is still refused by `resolveContainedRoot()` below -- that containment
 * rule is unrelated to the split-read hazard and did not change.
 */
function paths(root) {
  const skillsDir = join(root, "src/skills");
  const readmePath = join(root, "README.md");
  const parityDocPath = join(root, "docs/stock-vice-parity.md");
  const acmeBuildSkillPath = join(skillsDir, "acme-build", "SKILL.md");
  const hardLossesDocPath = join(root, "docs/stock-hard-losses.md");
  return {
    root,
    viceDir: join(root, "src/mcp/vice"),
    skillsDir,
    readmePath,
    parityDocPath,
    acmeBuildSkillPath,
    hardLossesDocPath,
    // Every file this gate readFileSync()s at a FIXED path with no existsSync()
    // of its own. (SKILL_FILE_CLAIMS entries are deliberately NOT here: each is
    // already existence-asserted as a first-class check, so a missing one must
    // stay a reported claim failure rather than becoming a --root diagnostic.)
    // `hardLossesDocPath` is asserted to EXIST -- it is the citation target
    // both README.md and the skills tree are required to reach -- but is
    // never itself read by this gate; docs/stock-hard-losses.md's own content
    // was verified against the per-backend capability table before that table
    // was deleted (52-07-SUMMARY.md), and re-verifying it here would be
    // exactly the "re-derive a cross-cutting seam locally" anti-pattern.
    required: [skillsDir, readmePath, parityDocPath, acmeBuildSkillPath, hardLossesDocPath],
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
    script: "check-skill-capability-honesty",
  }));
} catch (err) {
  console.error(`check-skill-capability-honesty: ${err?.message ?? String(err)}`);
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
  console.error(`check-skill-capability-honesty: REFUSED -- ${err?.message ?? String(err)}`);
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
  console.error(`check-skill-capability-honesty: FAIL (--root) -- ${err?.message ?? String(err)}`);
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
  hardLossesDocPath: HARD_LOSSES_DOC_PATH,
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

// --- Names to police: a LITERAL, non-empty set, not derived (INVERTED,
// 52-09) ---
// The fork-era version derived this set from the per-backend capability
// table's entries (every one whose providedBy was "fork"). That table
// is deleted (52-07) along with the whole per-backend concept it modeled.
// What survives is the six hardware-level facts docs/stock-hard-losses.md
// records: these tool names have NO route on stock at all, permanently,
// regardless of build or version. The list below is intentionally NOT
// imported from anywhere -- see this file's own header ("WHAT NOT TO DO") for
// why a second hand-copied list is normally the wrong move, and why this one
// is the exception: `docs/stock-hard-losses.md` is prose, not an importable
// module, so this literal and `scripts/check-skill-tool-coverage.mjs`'s own
// `FORK_ONLY_UNRECOVERABLE` literal are the two places this fact lives in
// checkable form, and each is independently pinned against that document by
// its own non-vacuity floor.
const PERMANENTLY_UNAVAILABLE = [
  [
    "vice_sid_get_state",
    "None for reads -- SID $D400-$D418 is write-only in hardware and the binary monitor has no SID command. Writes still work over the memory-set primitive.",
  ],
  [
    "vice_keyboard_matrix",
    "vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input.",
  ],
  [
    "vice_keyboard_chord",
    "vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input.",
  ],
  [
    "vice_keyboard_key_press",
    "vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input.",
  ],
  [
    "vice_keyboard_key_release",
    "vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input.",
  ],
  [
    "vice_keyboard_restore",
    "vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but neither substitutes for an NMI pulse.",
  ],
];
const FORK_ONLY_NAMES = new Set(PERMANENTLY_UNAVAILABLE.map(([name]) => name));
const registryByName = new Map(PERMANENTLY_UNAVAILABLE.map(([name, alternative]) => [name, { alternative }]));

// --- Extraction --------------------------------------------------------
// MCP_PREFIX_RE/TOOL_NAME_RE now live in ./lib/skill-corpus.mjs (WR-12) --
// imported above, not re-derived here.

// Annotation signal (INVERTED, 52-09). The fork-era phrasing ("fork-only",
// "requires the fork") named a backend that no longer exists. The surviving
// concern is unchanged in shape -- a bare mention with no nearby warning sends
// an agent into an unwarned refusal -- so the phrase it looks for is the one
// docs/stock-hard-losses.md and the rewritten skill playbooks (plan 52-08)
// actually use: "permanently unavailable". This pattern is used ONLY as the
// single-name fallback below (`names.length === 1`); a section naming two or
// more of these tools must satisfy the per-tool windowed match (`nearName`)
// instead.
const ANNOTATION_RE = /permanently unavailable/i;

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

let totalPermanentLimitationMentions = 0;
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

  // Permanent-limitation mention proximity: markdown-section scope, .md files
  // only (an ATX heading is a markdown concept; .mjs files carry no section
  // structure to scope against).
  if (!f.endsWith(".md")) continue;

  const sections = splitSections(raw);
  for (const section of sections) {
    const sectionText = section.lines.join("\n");
    const cleaned = sectionText.replace(MCP_PREFIX_RE, "");
    const matches = [...cleaned.matchAll(TOOL_NAME_RE)];
    const flaggedMentionsInSection = matches.filter((m) => FORK_ONLY_NAMES.has(m[0]));
    if (flaggedMentionsInSection.length === 0) continue;

    totalPermanentLimitationMentions += flaggedMentionsInSection.length;

    const names = [...new Set(flaggedMentionsInSection.map((m) => m[0]))];

    // WR-10: compliance is decided PER TOOL, not per section. An
    // annotation about tool A must not license a bare mention of tool B in
    // the same section -- the old rule matched ANYWHERE in the section
    // body with no association between the annotation and the name it was
    // meant to annotate. `nearName` requires the annotation phrase to sit
    // within a bounded window (200 chars, never crossing a newline) on
    // either side of THIS name specifically. The `names.length === 1`
    // fallback keeps every currently-compliant single-flagged-tool section
    // compliant without requiring the annotation to sit inside the
    // 200-char window of that lone name -- there is no ambiguity about
    // which tool a section-wide annotation refers to when only one is
    // named. Measured against the corpus plan 52-08 produced (2026-09-12):
    // 7 flagged sections across 5 files, every one carrying exactly one
    // distinct permanently-unavailable name.
    for (const name of names) {
      const nearName = new RegExp(
        `${name}[^\\n]{0,200}(permanently unavailable)|` +
          `(permanently unavailable)[^\\n]{0,200}${name}`,
        "i"
      );
      const compliant = nearName.test(cleaned) || (ANNOTATION_RE.test(sectionText) && names.length === 1);
      if (compliant) {
        if (rel.endsWith("tool-selection.md")) positiveControlsSeen.add("tool-selection.md");
        if (rel.endsWith("control-flow.md")) positiveControlsSeen.add("control-flow.md");
        continue;
      }

      // WR-11: the line offset is computed from THIS name's OWN first
      // mention in the section, not the section's first flagged mention
      // of ANY name -- previously every message after the first cited a
      // line where its own name never appeared.
      const ownFirstMention = flaggedMentionsInSection.find((m) => m[0] === name);
      const upToMention = cleaned.slice(0, ownFirstMention.index);
      const lineOffset = upToMention.split("\n").length - 1;
      const lineNo = section.startLine + lineOffset;
      const entry = registryByName.get(name);
      const altText = entry?.alternative ? ` Alternative: ${entry.alternative}` : " No alternative exists.";
      need(
        false,
        `${rel}:${lineNo}: "${name}" mentioned in section "${section.heading}" with no permanent-` +
          `limitation annotation in that section -- state that it is permanently unavailable and see ` +
          `docs/stock-hard-losses.md.${altText}`
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
  [
    "vice_sid_get_state",
    "a user is not warned this tool is permanently unavailable before they design a method around it",
  ],
  [
    "vice_keyboard_matrix",
    "a user is not warned this tool is permanently unavailable before they design a method around it",
  ],
  [
    "docs/stock-hard-losses.md",
    "the reader loses the acceptance record naming which capabilities have no route on stock and why",
  ],
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
  [
    "VICE_BACKEND",
    "phase 52 removed the fork backend and the env var this project ever read to select between two of them -- reintroducing this string would tell a reader to configure a switch that does nothing",
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

// The `docs/tool-support.md` required string DIES here (INVERTED, 52-09):
// plan 52-07 retired that generated document along with the per-backend
// capability table it was generated from, so requiring the parity doc to
// point at it would pin a dead link. It is
// REPLACED, not merely dropped, by a required string proving the parity doc
// carries the dated removal note plan 52-09 adds -- a "parity" document with
// no second backend left to compare against must say why it still exists,
// and this is the mechanical proof that it does.
const REQUIRED_PARITY_SUBSTRINGS = [
  [
    "the fork backend was removed",
    "the reader has no way to tell, from this document alone, why a \"parity\" comparison survives with only one backend left to describe -- the dated removal note plan 52-09 added is missing",
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
    "08-06 removed the promise of a Phase 8 parity harness that was cut from scope; no replacement harness is promised in its place",
  ],
  [
    "must cover answer-shape drift",
    "08-06 corrected the overstated claim that SKILL-01 must cover answer-shape drift -- SKILL-01's actual text only names the permanent limitation at each affected call site, and answer-shape drift remains an open, mechanically-unchecked concern",
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
// comments. Every floor below that policed the now-deleted per-backend
// capability table or its fork-only mention count is REPLACED against the new
// subject (INVERTED, 52-09), never simply dropped -- see this file's own header.
need(
  topLevelDirs.length >= 6 && topLevelDirs.every((d) => dirsWithAFileRead.has(d)),
  `non-vacuity: expected at least 6 skill directories scanned with at least one file read in each, got ${topLevelDirs.length} directories (${[...dirsWithAFileRead].length} with a file read)`
);
// Was "at least 8 fork-only tool mentions" (fork-era floor). Measured against
// the corpus plan 52-08 actually produced (2026-09-12): 9 mentions across 7
// sections in 5 files, all compliant. Floor set at 8, one below the measured
// value, so a genuine regression (a rewritten section losing its annotation,
// or the walk/extraction regex breaking) still trips it.
need(
  totalPermanentLimitationMentions >= 8,
  `non-vacuity: expected at least 8 permanently-unavailable tool mentions across src/skills/, got ${totalPermanentLimitationMentions} -- the skills walk or extraction regex may be broken, or plan 52-08's permanent-limitation annotations regressed`
);
need(
  positiveControlsSeen.has("tool-selection.md"),
  `non-vacuity: positive control references/tool-selection.md must be classified compliant (inline annotation on the same line as the mention) -- if this fails, the annotation-signal match or the walk is broken`
);
need(
  positiveControlsSeen.has("control-flow.md"),
  `non-vacuity: positive control references/control-flow.md must be classified compliant (annotation in the same section as the mention) -- if this fails, the section-scoped proximity rule or the walk is broken`
);
// Was "at least 20 fork-only names derived from" the per-backend capability
// table (fork-era floor, sized to that whole table). The table is
// gone; the surviving set is the six permanent hardware losses
// docs/stock-hard-losses.md records -- a literal, not a derivation, so the
// floor is sized to that literal's actual length rather than guessed.
need(
  FORK_ONLY_NAMES.size >= 6,
  `non-vacuity: expected at least 6 permanently-unavailable tool names, got ${FORK_ONLY_NAMES.size} -- the literal PERMANENTLY_UNAVAILABLE list may have been emptied`
);
need(
  parityDocSource.length > 5000,
  `non-vacuity: docs/stock-vice-parity.md is suspiciously short (${parityDocSource.length} bytes) -- the file may have been truncated or this script may be reading the wrong path`
);
// NEW (52-09): the acceptance record must actually be reachable from the
// skills tree, not merely from README.md -- a playbook that points a reader
// at "the reason" without naming the document is not a citation. Measured
// against plan 52-08's corpus: 6 occurrences across 5 files. Floor set at 5.
const hardLossesCitationCount = skillFiles
  .filter((f) => f.endsWith(".md"))
  .reduce((sum, f) => sum + (readFileSync(f, "utf8").match(/docs\/stock-hard-losses\.md/g) || []).length, 0);
need(
  hardLossesCitationCount >= 5,
  `non-vacuity: expected at least 5 citations of docs/stock-hard-losses.md across src/skills/, got ${hardLossesCitationCount} -- the acceptance record plan 52-08 pointed the skills tree at may have been silently unlinked`
);

// --- Report ------------------------------------------------------------
if (errors.length) {
  console.error("check-skill-capability-honesty: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

console.log(
  `check-skill-capability-honesty: OK -- ${totalPermanentLimitationMentions} permanent-limitation mentions across ` +
    `${skillFiles.length} files in ${topLevelDirs.length} skill directories, all section-scoped-compliant; ` +
    `${FORK_ONLY_NAMES.size} permanently-unavailable names policed (docs/stock-hard-losses.md), cited ` +
    `${hardLossesCitationCount} times across the skills tree; no stale phase-deferral prose found; README.md ` +
    `carries all ${REQUIRED_README_SUBSTRINGS.length} required strings and none of the ` +
    `${FORBIDDEN_README_SUBSTRINGS.length} forbidden ones; docs/stock-vice-parity.md carries all ` +
    `${REQUIRED_PARITY_SUBSTRINGS.length} required strings and none of the ${FORBIDDEN_PARITY_SUBSTRINGS.length} ` +
    `forbidden ones.`
);
