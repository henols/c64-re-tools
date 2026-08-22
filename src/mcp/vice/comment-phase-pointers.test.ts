// comment-phase-pointers.test.ts
//
// WHY THIS EXISTS (PKG-03, promoted from
// .planning/todos/pending/2026-08-21-stale-phase-pointers-in-stock-cia-and-
// stock-dispatch-comments.md): docs-dangling-refs.test.ts's FLOW-02 check
// already fails the build if a shipped STRING or TEMPLATE literal names a
// phase number -- but it is deliberately, permanently scoped to literals
// only. Its own header explains why: a comment legitimately wants to quote
// old wording in a "what NOT to do" note, and a comment-scanning version of
// THAT guard would fail on the very commit that fixes the violation it
// exists to prevent. That scoping decision is correct and is NOT reopened
// here.
//
// What FLOW-02 cannot see is a COMMENT that hands pending or future work to
// a numbered phase -- exactly the defect class the promoted todo named at
// two sites (`stock-cia.ts`, `stock-dispatch.ts`), and which the plan-time
// census found at thirteen more, across nine shipped modules total. A
// blanket "no comment mentions Phase N" rule is not viable here: this
// repo's shipped modules carry ~124 legitimate historical `Phase N`
// mentions in comments (narrating when something was decided, built, or
// found), against a mere handful of real violations. So this guard detects
// the ASSIGNMENT SHAPE specifically -- narration stays legal, hand-off does
// not -- plus a second, unrelated check: any comment naming a phase the
// roadmap records as CUT, narration included, since a pointer at a phase
// that no longer exists is orphaned regardless of how it is phrased.
//
// EXTRACTOR: the character-state-machine literal extractor
// docs-dangling-refs.test.ts already proved out (chosen over a regex
// extractor after one was MEASURED to miss a real violation sitting inside
// a template literal -- see that file's own header), INVERTED: it captures
// comment spans instead of skipping them, and skips string/template
// literal BODIES instead of capturing them. A phase number that happens to
// sit inside a string literal is FLOW-02's surface, never this guard's --
// skipping literal bodies here is what keeps the two guards from double-
// counting the same site.
//
// PER-LINE MATCHING, NOT PER-SPAN, NOT PER-SENTENCE: a block comment can
// run to twenty physical lines. Matching the whole span (or a naively
// newline-collapsed "sentence" spanning a JSDoc bullet list) was MEASURED
// at plan time to both mis-attribute the failure to the wrong line and to
// let an unrelated word two lines away complete an unintended match (a
// heading literally titled "FOURTH MOVE" satisfied the verb-first pattern
// together with an unrelated phase mention 80 characters later in the same
// synthetic "sentence"; `Phase 7's Route A stopwatch` satisfied the
// possessive-plus-noun pattern purely because "Route" is a substring of the
// tuned noun "route"). Splitting each captured span into PHYSICAL LINES
// first, then matching each line independently, both fixes the
// mis-attribution and removes the cross-line false positives -- the
// remaining false-positive risk is a bare noun collision, closed instead by
// scoping the noun list to exact phrases actually seen in real violations
// (see PATTERN FAMILIES below) rather than by re-widening the match window.
//
// MODULE SET: shippedTsModules() is copied verbatim from
// docs-dangling-refs.test.ts (package.json's files[] filtered to
// .ts/.mts, with an existence assertion so the scanned set cannot shrink
// silently). Kept as a second, independent copy rather than an import --
// this file and docs-dangling-refs.test.ts each own their own scan
// end-to-end, matching this codebase's established "no import between
// sibling guard tests" convention.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

// ---------------------------------------------------------------------------
// The comment extractor -- inverted from docs-dangling-refs.test.ts's
// extractStringLiterals(). Captures `//` and `/* */` spans (with their
// starting character offset, for line-number attribution below); still
// walks single/double-quoted strings and template literals (including
// nested `${ ... }` interpolation) character-by-character to SKIP their
// bodies correctly, so a `//` or `/*` sequence inside a string is never
// mistaken for the start of a real comment.
// ---------------------------------------------------------------------------

interface CommentSpan {
  text: string;
  startIndex: number;
}

function extractCommentSpans(src: string): CommentSpan[] {
  const spans: CommentSpan[] = [];
  const n = src.length;
  let i = 0;

  interface TemplateFrame {
    inInterp: boolean;
    interpBraceDepth: number;
  }
  const templateStack: TemplateFrame[] = [];

  while (i < n) {
    const c = src[i];
    const top = templateStack.length > 0 ? templateStack[templateStack.length - 1] : undefined;

    if (top && !top.inInterp) {
      // Inside a template literal's own text (not `${ }`) -- these
      // characters are literal content, never comment syntax, so just walk
      // through them watching for escapes, the closing backtick, and the
      // start of an interpolation.
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        templateStack.pop();
        i++;
        continue;
      }
      if (c === "$" && src[i + 1] === "{") {
        top.inInterp = true;
        top.interpBraceDepth = 1;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // Top-level code, OR inside a template literal's `${ ... }`
    // interpolation (both scan for comments/strings/nested templates the
    // same way; only the brace-depth tracking below differs).
    if (c === "/" && src[i + 1] === "/") {
      const start = i;
      while (i < n && src[i] !== "\n") i++;
      spans.push({ text: src.slice(start, i), startIndex: start });
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      spans.push({ text: src.slice(start, Math.min(i, n)), startIndex: start });
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        i++;
      }
      i++; // skip closing quote
      continue;
    }
    if (c === "`") {
      templateStack.push({ inInterp: false, interpBraceDepth: 0 });
      i++;
      continue;
    }
    if (top && top.inInterp) {
      if (c === "{") {
        top.interpBraceDepth++;
        i++;
        continue;
      }
      if (c === "}") {
        top.interpBraceDepth--;
        i++;
        if (top.interpBraceDepth === 0) top.inInterp = false;
        continue;
      }
    }
    i++;
  }
  return spans;
}

/** Cumulative newline offsets, for mapping a character index back to a
 * 1-based physical line number without re-scanning the whole file per
 * lookup. */
function buildLineIndex(src: string): number[] {
  const starts = [0];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineNumberFor(starts: number[], index: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Every physical line, from every captured comment span in `src`, that
 * itself mentions a numbered phase -- split from the span BEFORE matching
 * (this section's header explains why: a naive whole-span or joined-
 * sentence match both mis-attributes the offending line and lets unrelated
 * text elsewhere in a long block comment complete a match). */
interface PhaseLine {
  line: number;
  text: string;
}

function commentPhaseLines(src: string): PhaseLine[] {
  const hits: PhaseLine[] = [];
  const starts = buildLineIndex(src);
  for (const span of extractCommentSpans(src)) {
    const spanStartLine = lineNumberFor(starts, span.startIndex);
    const spanLines = span.text.split("\n");
    for (let offset = 0; offset < spanLines.length; offset++) {
      const line = spanLines[offset];
      if (/\bPhase\s+\d+(?:\.\d+)?\b/i.test(line)) {
        hits.push({ line: spanStartLine + offset, text: line.trim() });
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// CHECK 1: the assignment-shape family. Seven named patterns, each firing
// independently so a failure message can say which one triggered. Every
// pattern operates on a SINGLE physical line (see commentPhaseLines()
// above) -- never a multi-line join -- which is what keeps the match
// window meaningful instead of accidentally spanning unrelated prose.
//
// Two calibration details, both MEASURED against the real corpus (58
// shipped modules, 124 comment lines naming a phase) before being locked
// in here:
//
//   - The responsibility-noun list (used by "possessive-plus-noun" below)
//     is deliberately narrow: `extension|home|scope|deliverable|remit|
//     business|timing route`. A bare `route` was measured to false-positive
//     on `stock-protocol.ts`'s "Phase 7's Route A stopwatch" (Route A is a
//     proper noun, not this codebase's `route` sense) -- only the exact
//     two-word phrase `timing route` is included, which is what the real
//     `vice_joystick_tap` violation actually says.
//   - "until Phase N" needs a past-tense exclusion, or it flags real
//     narration: `containerpath.ts`'s "This direction did not exist until
//     Phase 01.2's on-demand VICE broker" is accurate history, not a
//     pending hand-off. A preceding did/didn't/had/hadn't/was/were/never/
//     has on the SAME line means the sentence narrates something that
//     already happened, not something still pending -- measured to exclude
//     exactly that one narration line and no others, while still flagging
//     both of this repo's real present-tense "until Phase N" violations
//     (`stock-input.ts` twice, `stock-address.ts` once).
// ---------------------------------------------------------------------------

const PAST_TENSE_EXCLUSION = /\b(?:did|didn't|had|hadn't|was|were|never|has)\b/i;

interface PatternFamily {
  name: string;
  re: RegExp;
  excludeIf?: RegExp;
}

const ASSIGNMENT_FAMILIES: readonly PatternFamily[] = Object.freeze([
  {
    name: "verb-first-handoff",
    re: /\b(?:moved|deferred|defers?|belongs?|lands?|pushed|punted|reassigned|handed)\b[^.;]{0,80}?\bPhase\s+\d+(?:\.\d+)?/i,
  },
  {
    name: "possessive-plus-noun",
    re: /\bPhase\s+\d+(?:\.\d+)?(?:'s|s')\s+[^.;]{0,60}?\b(?:extension|home|scope|deliverable|remit|business|timing route)\b/i,
  },
  {
    name: "owner-home",
    re: /\b(?:home|owner|owned by|covered by|claimed by|lives in)\b[^.;]{0,40}?\bPhase\s+\d+(?:\.\d+)?/i,
  },
  {
    name: "is-was-possessive",
    re: /\b(?:is|are|was|were|remains?|becomes?|will\s+be)\s+Phase\s+\d+(?:\.\d+)?(?:'s|s')/i,
  },
  {
    name: "comma-appositive",
    re: /\bPhase\s+\d+(?:\.\d+)?\s*,\s*(?:via|through|using|by[\s-]way[\s-]of)\b/i,
  },
  {
    name: "needs-requires",
    re: /\b(?:needs?|needed|requires?|awaits?|pending[\s-]on|blocked[\s-]on)\b[^.;]{0,80}?\bPhase\s+\d+(?:\.\d+)?/i,
  },
  {
    name: "until-phase-present-tense",
    re: /\buntil\s+Phase\s+\d+(?:\.\d+)?/i,
    excludeIf: PAST_TENSE_EXCLUSION,
  },
]);

interface AssignmentHit {
  file: string;
  line: number;
  family: string;
  text: string;
}

/** Applies the seven ASSIGNMENT_FAMILIES to a list of phase-naming comment
 * lines already extracted from one source (a real file or the fixture).
 * `sourceLabel` is the file/fixture name reported in each hit. */
function assignmentHitsFor(phaseLines: PhaseLine[], sourceLabel: string): AssignmentHit[] {
  const hits: AssignmentHit[] = [];
  for (const { line, text } of phaseLines) {
    for (const family of ASSIGNMENT_FAMILIES) {
      if (!family.re.test(text)) continue;
      if (family.excludeIf && family.excludeIf.test(text)) continue;
      hits.push({ file: sourceLabel, line, family: family.name, text });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// CHECK 2: the cut-phase reference. Any comment naming a phase the roadmap
// records as cut is orphaned by definition -- narration included, since
// narrating a plan that was cut is still a pointer at nothing. The cut set
// is PARSED from ROADMAP.md's own Progress table, never hand-typed, so a
// future cut phase is picked up automatically and this check cannot drift
// out of sync with the roadmap the way a hand-maintained list could.
// ---------------------------------------------------------------------------

/** Parses ROADMAP.md's `## Progress` table for rows whose Status column
 * records a cut or dissolved phase, returning the phase-number strings
 * (e.g. "6"). Asserts the result is non-empty with a message naming the
 * PARSE as the suspect, not "no phase was ever cut" -- an empty result
 * here means the table shape drifted under this parser, not that this
 * project's history is clean; this project HAS a recorded cut phase
 * (Phase 6, Stock-Only Gains, 2026-08-17), so a silent zero is a bug in
 * this function, never a fact about the roadmap. */
function parseCutPhasesFromRoadmap(): string[] {
  const path = join(ROOT, ".planning/ROADMAP.md");
  const content = readFileSync(path, "utf8");
  const progressSection = content.split(/^## Progress$/m)[1];
  assert.ok(
    progressSection,
    "ROADMAP.md's '## Progress' heading was not found -- the table this check parses moved or was renamed; update parseCutPhasesFromRoadmap()'s section anchor",
  );
  const cutPhases: string[] = [];
  for (const rawLine of progressSection.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1); // drop the empty leading/trailing cells a `| a | b |` split produces
    if (cells.length < 4) continue; // not a data row (e.g. the header separator `|---|---|`)
    const phaseCell = cells[0];
    const statusCell = cells[3];
    const phaseMatch = /^(\d+(?:\.\d+)?)\./.exec(phaseCell);
    if (!phaseMatch) continue; // header row ("Phase") or malformed cell
    if (/\b(?:cut|dissolved)\b/i.test(statusCell)) {
      cutPhases.push(phaseMatch[1]);
    }
  }
  assert.ok(
    cutPhases.length > 0,
    "parseCutPhasesFromRoadmap() found ZERO cut/dissolved phases in ROADMAP.md's Progress table -- " +
      "this project has a recorded cut phase (Phase 6, 2026-08-17), so an empty result means this " +
      "parser's table-shape assumption broke, not that nothing was ever cut. Fix the parser before " +
      "trusting the cut-phase check below.",
  );
  return cutPhases;
}

interface CutHit {
  file: string;
  line: number;
  phase: string;
  text: string;
}

function cutPhaseHitsFor(phaseLines: PhaseLine[], sourceLabel: string, cutPhases: readonly string[]): CutHit[] {
  const hits: CutHit[] = [];
  const cutSet = new Set(cutPhases);
  for (const { line, text } of phaseLines) {
    const matches = text.matchAll(/\bPhase\s+(\d+(?:\.\d+)?)\b/gi);
    const reportedLines = new Set<number>();
    for (const m of matches) {
      if (cutSet.has(m[1]) && !reportedLines.has(line)) {
        hits.push({ file: sourceLabel, line, phase: m[1], text });
        reportedLines.add(line);
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Module set: identical seam to docs-dangling-refs.test.ts's
// shippedTsModules() -- derived from package.json's files[], never hand-
// enumerated, with an existence assertion so a files[] entry that no
// longer exists on disk fails loudly instead of silently shrinking the
// scanned set.
// ---------------------------------------------------------------------------

function shippedTsModules(): string[] {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files?: string[] };
  const entries = (pkg.files ?? []).filter((f) => /\.(ts|mts)$/.test(f));
  for (const entry of entries) {
    assert.ok(
      existsSync(join(HERE, entry)),
      `package.json files[] names ${entry} but it does not exist on disk -- update files[] rather than letting the scanned set shrink silently`,
    );
  }
  return entries;
}

function danglingPhaseCommentAssignments(): AssignmentHit[] {
  const hits: AssignmentHit[] = [];
  for (const file of shippedTsModules()) {
    const src = readFileSync(join(HERE, file), "utf8");
    hits.push(...assignmentHitsFor(commentPhaseLines(src), file));
  }
  return hits;
}

function cutPhaseCommentReferences(): CutHit[] {
  const cutPhases = parseCutPhasesFromRoadmap();
  const hits: CutHit[] = [];
  for (const file of shippedTsModules()) {
    const src = readFileSync(join(HERE, file), "utf8");
    hits.push(...cutPhaseHitsFor(commentPhaseLines(src), file, cutPhases));
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("cut-phase set: ROADMAP.md's Progress table parses to a non-empty cut/dissolved set", () => {
  const cutPhases = parseCutPhasesFromRoadmap();
  assert.ok(cutPhases.length > 0, "expected at least one cut phase (Phase 6 is recorded cut 2026-08-17)");
  assert.ok(cutPhases.includes("6"), `expected Phase 6 (Stock-Only Gains, cut 2026-08-17) in the parsed cut set, got: ${JSON.stringify(cutPhases)}`);
});

test("non-vacuity: the scanned module set and comment-line volume are real", () => {
  // Floors set below what was actually measured on 2026-08-22/23 (58
  // modules, 7500+ comment spans, 124 comment lines naming a phase) --
  // never a floor equal to a number that was never measured
  // (ENGINEERING_RULES.md §6).
  const modules = shippedTsModules();
  assert.ok(modules.length >= 40, `expected at least 40 shipped .ts/.mts modules, got ${modules.length}`);

  let spanCount = 0;
  let phaseLineCount = 0;
  for (const file of modules) {
    const src = readFileSync(join(HERE, file), "utf8");
    spanCount += extractCommentSpans(src).length;
    phaseLineCount += commentPhaseLines(src).length;
  }
  assert.ok(spanCount >= 5000, `expected at least 5000 comment spans across the shipped set, got ${spanCount}`);
  assert.ok(phaseLineCount >= 80, `expected at least 80 comment lines naming a phase across the shipped set, got ${phaseLineCount}`);
});

test("positive control: the extractor captures comments and skips string/template literal bodies", () => {
  const sample =
    'const a = "Phase 99 inside a string, not a comment";\n' +
    "// Phase 99 inside a real line comment\n" +
    "const b = `template with Phase 99 inside a string too, plus ${1 + 1} interpolation`;\n" +
    "/* Phase 99 inside a real block comment */\n";
  const spans = extractCommentSpans(sample);
  const commentTexts = spans.map((s) => s.text).join("\n");
  assert.match(commentTexts, /Phase 99 inside a real line comment/, "the extractor must capture the line comment");
  assert.match(commentTexts, /Phase 99 inside a real block comment/, "the extractor must capture the block comment");
  assert.doesNotMatch(commentTexts, /inside a string, not a comment/, "the extractor must not capture string-literal bodies");
  assert.doesNotMatch(commentTexts, /template with Phase 99 inside a string too/, "the extractor must not capture template-literal bodies");
});

test("no shipped src/mcp/vice/ source comment assigns pending/future work to a numbered phase (PKG-03)", () => {
  // Task 1 committed this corpus scan without asserting emptiness -- the
  // real tree still carried 7 assignment-shape sites. Task 2 fixed all of
  // them (repointing each at an already-recorded permanent reason) and
  // enables this assertion in the same commit, so no red guard ever lands.
  const hits = danglingPhaseCommentAssignments();
  assert.deepEqual(hits, [],
    "orphaned assignment-shape phase pointer(s) found in shipped source comments -- repoint each at " +
      "an existing permanent record (a parity-doc cut entry, a module's own exclusion header) rather " +
      "than a phase number:\n" +
      hits.map((h) => `  [${h.family}] ${h.file}:${h.line}: ${h.text}`).join("\n"),
  );
});

test("no shipped source comment names a phase the roadmap records as cut or dissolved (PKG-03)", () => {
  // Task 1 committed this corpus scan without asserting emptiness -- the
  // real tree still carried 9 cut-phase reference sites (all naming Phase
  // 6, cut 2026-08-17). Task 2 fixed all of them, and enables this
  // assertion in the same commit.
  const hits = cutPhaseCommentReferences();
  assert.deepEqual(hits, [],
    "shipped source comment(s) name a phase the roadmap records as cut -- a reference to a cut phase " +
      "is orphaned by definition, narration included. Repoint at the phase's NAME rather than its " +
      "number where citing history (e.g. \"Stock-Only Gains\" rather than \"Phase 6\"), since the " +
      "cut-phase check matches any numbered mention, or at the permanent record the cut left behind:\n" +
      hits.map((h) => `  [cut-phase:${h.phase}] ${h.file}:${h.line}: ${h.text}`).join("\n"),
  );
});

// ---------------------------------------------------------------------------
// Fixture-driven tests: every planted violation shape and every negative
// control from fixtures/planted-phase-pointer-fixture.ts.txt is asserted
// individually. The fixture's own `[bracket-label]` prefixes are parsed
// here rather than duplicated as a second hand-written expectation list --
// one file, read two ways (by the scanner as raw text, and by this test as
// a label-to-assertion map), so the fixture and its expectations cannot
// drift apart silently.
// ---------------------------------------------------------------------------

const FIXTURE_PATH = join(HERE, "fixtures", "planted-phase-pointer-fixture.ts.txt");

function readFixture(): string {
  assert.ok(existsSync(FIXTURE_PATH), `${FIXTURE_PATH} is missing -- the planted-violation fixture must be committed`);
  return readFileSync(FIXTURE_PATH, "utf8");
}

/** Parses the fixture's own `// [label] rest of comment text...` lines into
 * `{ label, text }` pairs, using the SAME comment extractor and per-line
 * split the real scan uses -- so this parse exercises the identical code
 * path being tested, not a second hand-rolled reader. */
function fixtureLabelledLines(): { label: string; text: string }[] {
  const src = readFixture();
  const out: { label: string; text: string }[] = [];
  for (const { text } of commentPhaseLinesOrLabelled(src)) {
    const m = /^\[([a-z][a-z\- ]*(?:,\s*[a-z][a-z\- ]*)?)\]\s*(.*)$/i.exec(text);
    if (m) out.push({ label: m[1], text: m[2] });
  }
  return out;
}

/** Like commentPhaseLines(), but without the "must mention a phase number"
 * filter -- the fixture's bracket-labelled lines are the unit of interest
 * here, and some (e.g. the cut-phase narration control) mention a phase
 * number while the label text itself does not repeat it verbatim before
 * the number appears later in the sentence. Reuses extractCommentSpans()
 * and the same per-line split. */
function commentPhaseLinesOrLabelled(src: string): PhaseLine[] {
  const hits: PhaseLine[] = [];
  const starts = buildLineIndex(src);
  for (const span of extractCommentSpans(src)) {
    const spanStartLine = lineNumberFor(starts, span.startIndex);
    const spanLines = span.text.split("\n");
    for (let offset = 0; offset < spanLines.length; offset++) {
      const raw = spanLines[offset].replace(/^\/\/\s?|^\*\s?/, "").trim();
      if (/^\[/.test(raw)) hits.push({ line: spanStartLine + offset, text: raw });
    }
  }
  return hits;
}

for (const family of ASSIGNMENT_FAMILIES) {
  test(`fixture-driven [${family.name}]: the planted line for this family is flagged`, () => {
    const labelled = fixtureLabelledLines();
    const row = labelled.find((r) => r.label === family.name);
    assert.ok(row, `no fixture line labelled [${family.name}] was found -- the fixture must carry one planted line per pattern family`);
    assert.ok(family.re.test(row!.text), `family "${family.name}"'s own pattern did not match its own planted fixture line: ${JSON.stringify(row!.text)}`);
    if (family.excludeIf) {
      assert.ok(!family.excludeIf.test(row!.text), `the planted [${family.name}] line must not trip its own past-tense exclusion`);
    }
  });
}

test("fixture-driven: the cut-phase narration control is flagged by the cut-phase check", () => {
  const labelled = fixtureLabelledLines();
  const row = labelled.find((r) => r.label === "cut-phase-narration");
  assert.ok(row, "no fixture line labelled [cut-phase-narration] was found");
  const cutPhases = parseCutPhasesFromRoadmap();
  const matches = [...row!.text.matchAll(/\bPhase\s+(\d+(?:\.\d+)?)\b/gi)];
  assert.ok(matches.length > 0, "the [cut-phase-narration] fixture line must itself name a phase number");
  assert.ok(
    matches.some((m) => cutPhases.includes(m[1])),
    `the [cut-phase-narration] fixture line must name a phase in the parsed cut set (${JSON.stringify(cutPhases)}), got: ${JSON.stringify(row!.text)}`,
  );
});

test("fixture-driven: past-tense until-phase narration is NOT flagged (the tense filter's own negative control)", () => {
  const labelled = fixtureLabelledLines();
  const row = labelled.find((r) => r.label === "narration, past tense");
  assert.ok(row, 'no fixture line labelled [narration, past tense] was found');
  const untilFamily = ASSIGNMENT_FAMILIES.find((f) => f.name === "until-phase-present-tense")!;
  const rawMatches = untilFamily.re.test(row!.text);
  assert.ok(rawMatches, "sanity check: the raw until-phase pattern should match before the past-tense exclusion is applied");
  assert.ok(untilFamily.excludeIf!.test(row!.text), "the planted past-tense narration line must trip the past-tense exclusion");
});

test("fixture-driven: legitimate historical narration lines are never flagged by either check", () => {
  const labelled = fixtureLabelledLines();
  const narrationLabels = ["narration, past tense", "narration, completed", "narration, decision citation", "narration, cross-reference"];
  const cutPhases = parseCutPhasesFromRoadmap();
  for (const label of narrationLabels) {
    const row = labelled.find((r) => r.label === label);
    assert.ok(row, `no fixture line labelled [${label}] was found`);
    const assignmentMatch = ASSIGNMENT_FAMILIES.some((f) => f.re.test(row!.text) && !(f.excludeIf && f.excludeIf.test(row!.text)));
    assert.equal(assignmentMatch, false, `narration line [${label}] must not be flagged by any assignment-shape family: ${JSON.stringify(row!.text)}`);
    const phaseNums = [...row!.text.matchAll(/\bPhase\s+(\d+(?:\.\d+)?)\b/gi)].map((m) => m[1]);
    const cutMatch = phaseNums.some((p) => cutPhases.includes(p));
    assert.equal(cutMatch, false, `narration line [${label}] must not name a cut phase: ${JSON.stringify(row!.text)}`);
  }
});

test("fixture is outside the shipped scan: not in package.json files[], and typechecking the package is unaffected", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files?: string[] };
  const files = pkg.files ?? [];
  assert.ok(
    !files.some((f) => f.includes("planted-phase-pointer")),
    "the fixture must not appear in package.json's files[] -- it exists specifically to sit outside the scanned/shipped set",
  );
  assert.ok(!FIXTURE_PATH.endsWith(".ts"), "the fixture's extension must not be .ts/.mts, or shippedTsModules()'s files[]-derived filter could pick it up if ever added there by mistake");
});
