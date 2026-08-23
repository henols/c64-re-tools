// hop-chain-comments.test.ts
//
// WHY THIS EXISTS (PKG-03, promoted from
// .planning/todos/pending/2026-08-21-stale-phase-pointers-in-stock-cia-and-
// stock-dispatch-comments.md's path-reference half -- see 16-09-PLAN.md's
// "Flagged Assumptions" section): `16-REVIEW.md`'s WR-02 found that
// `r2000-symbol-roundtrip.test.ts:55` and `:467` both describe the directory
// chain from this module directory to the repository root using the NEW
// starting segment (`src/mcp/vice`, since phase 16-04's relocation) spliced
// onto the OLD intermediate segments (`.claude/mcp`, `.claude`) -- a chain
// that exists on disk in NEITHER the pre-move nor the post-move tree. The
// three `".."` hops in the code directly below each comment were correct the
// whole time (both shapes are three segments below the repository root), so
// nothing but a comment-reading human or agent was ever harmed by this, and
// no test could see it. `repo-root.ts`'s own header carries paragraph-length
// warnings about exactly this failure mode -- a wrong hop-count comment
// sending a reader to a directory that is not there -- which is why this
// class of defect is treated as a real regression here, not a nitpick.
//
// CALIBRATION (a measurement, not a claim): across every `*.ts`/`*.mts` file
// in this module directory, exactly THREE comment lines contain both a chain
// arrow (`->`) and the phrase naming the repository root ("repo root"). ONE
// of them, `r2000-answer-key.test.ts:34`, is legitimate -- it routes
// `src/mcp/vice -> repo root -> ...` with no pre-move segment at all -- and
// is this guard's in-tree negative control. The other TWO are the
// violations this file exists to catch and this plan fixes.
//
// WHAT THIS GUARD DELIBERATELY DOES NOT DO: it does not flag historical
// narration. A comment describing a PAST move ("what phase 16-04 did:
// `.claude/mcp/vice/` -> `src/mcp/vice/`") is accurate history and is
// load-bearing in this codebase (see `repo-root.test.ts:107-119`'s own
// deliberate pre-move-shape test and its narration). PER-LINE matching (not
// per-comment-span) is what keeps that narration green without an
// exemption: `repo-root.test.ts:114` carries the chain arrow but not the
// "repo root" phrase on that physical line, and `repo-root.test.ts:113`
// carries the phrase but not the arrow -- so neither line alone satisfies
// this guard's two-part pattern. This guard has no per-file exemption list
// by design; a comment that legitimately needs both an arrow and the phrase
// on the same physical line must be phrased to avoid the pre-relocation
// segment, not carved out.
//
// EXTRACTOR: `extractCommentSpans`/`buildLineIndex`/`lineNumberFor` below are
// copied VERBATIM from `comment-phase-pointers.test.ts` (itself following
// `docs-dangling-refs.test.ts`'s character-state-machine precedent, chosen
// over a regex extractor after one was MEASURED to miss a real violation
// sitting inside a template literal). Kept as a second, independent copy
// rather than an import -- this codebase's established convention is that
// each guard test owns its own scan end-to-end (`comment-phase-pointers
// .test.ts`'s own header records that same decision for the same helpers).
// Keep the copy verbatim so a future reader can diff the two.
//
// SCAN SET: every `*.ts`/`*.mts` file in this module directory, enumerated
// with `readdirSync(HERE)` -- NOT `package.json`'s `files[]`, because BOTH
// real violations live in test files that are deliberately unshipped
// (`vice-proxy.test.ts`'s own `readdirSync(HERE)`-derived structural guards
// are the precedent for this). A missing/shrunk scan set FAILS a floor
// assertion below rather than silently passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The comment extractor -- copied verbatim from comment-phase-pointers.test.ts.
// See that file's own header for why: a character-state-machine walk that
// correctly skips string/template literal BODIES (so a `//` or `/*`
// sequence inside a string is never mistaken for the start of a real
// comment) while capturing `//` and `/* */` spans with their starting
// character offset, for line-number attribution below.
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

// ---------------------------------------------------------------------------
// Detection. Frozen constants -- the ONE place a future editor changes
// either half of this pattern.
// ---------------------------------------------------------------------------

/** The chain-arrow token a hop-count comment uses to narrate a directory
 * resolution ("`a` -> `b` -> repo root"). */
const CHAIN_ARROW = "->";

/** The phrase naming the destination of the chain. Case-insensitive so
 * "Repo root"/"repo root" are both caught. */
const REPO_ROOT_PHRASE = /repo root/i;

/** This project's pre-relocation module-tree root segment. Phase 16-04
 * moved the vice-mcp package from `.claude/mcp/vice/` to `src/mcp/vice/`;
 * `.claude` is the OLD root segment a half-swept chain comment leaves
 * behind when only its starting segment gets updated. This is the ONE
 * frozen place a future editor reads or changes if this project's
 * pre-relocation root is ever renamed, or if this same defect class
 * recurs against a different root -- never add a per-file exemption
 * instead of updating or generalizing this constant. */
const PRE_RELOCATION_ROOT_SEGMENT = ".claude";

/** A line is "chain-shaped" when it carries both halves of the pattern this
 * guard is calibrated against (arrow + repo-root phrase) -- this is the
 * broader, non-vacuity-floor set that includes the legitimate in-tree
 * negative control. */
function isRepoRootChainLine(text: string): boolean {
  return text.includes(CHAIN_ARROW) && REPO_ROOT_PHRASE.test(text);
}

/** A chain-shaped line is a VIOLATION only when it also still carries the
 * pre-relocation root segment -- i.e. it is half-swept: someone updated the
 * chain's starting point but left an old intermediate segment behind. */
function isHopChainViolation(text: string): boolean {
  return isRepoRootChainLine(text) && text.includes(PRE_RELOCATION_ROOT_SEGMENT);
}

interface LineHit {
  file: string;
  line: number;
  text: string;
}

/** Every physical line, from every captured comment span in `src`, with its
 * 1-based line number -- unfiltered (the phase-pointer guard's sibling
 * helper filters to lines mentioning a phase number; this one does not
 * filter at all, since the caller applies its own predicate). */
function commentLinesForSource(src: string): { line: number; text: string }[] {
  const hits: { line: number; text: string }[] = [];
  const starts = buildLineIndex(src);
  for (const span of extractCommentSpans(src)) {
    const spanStartLine = lineNumberFor(starts, span.startIndex);
    const spanLines = span.text.split("\n");
    for (let offset = 0; offset < spanLines.length; offset++) {
      hits.push({ line: spanStartLine + offset, text: spanLines[offset] });
    }
  }
  return hits;
}

/** Every `*.ts`/`*.mts` file directly in this module directory -- see this
 * file's header for why this is `readdirSync(HERE)`-derived rather than
 * `package.json`'s `files[]`. */
function enumeratedModuleFiles(): string[] {
  return readdirSync(HERE)
    .filter((f) => /\.(ts|mts)$/.test(f))
    .sort();
}

function repoRootChainLinesInCorpus(): LineHit[] {
  const hits: LineHit[] = [];
  for (const file of enumeratedModuleFiles()) {
    const src = readFileSync(join(HERE, file), "utf8");
    for (const { line, text } of commentLinesForSource(src)) {
      if (isRepoRootChainLine(text)) hits.push({ file, line, text });
    }
  }
  return hits;
}

function hopChainViolationsInCorpus(): LineHit[] {
  return repoRootChainLinesInCorpus().filter((h) => isHopChainViolation(h.text));
}

// ---------------------------------------------------------------------------
// Non-vacuity floors -- each its own named test, per this codebase's
// established convention (comment-phase-pointers.test.ts, docs-dangling-
// refs.test.ts) that "a missing one FAILS rather than silently shrinking
// the scanned set".
// ---------------------------------------------------------------------------

test("non-vacuity: the scan enumerated at least fifty files", () => {
  const files = enumeratedModuleFiles();
  assert.ok(
    files.length >= 50,
    `expected at least 50 *.ts/*.mts files directly in the module directory, got ${files.length} -- ` +
      "the scan may have silently shrunk (wrong directory, filter regression, or files moved elsewhere)",
  );
});

test("non-vacuity: the extractor found at least three chain-shaped comment lines across the corpus", () => {
  const chainLines = repoRootChainLinesInCorpus();
  assert.ok(
    chainLines.length >= 3,
    `expected at least 3 chain-shaped (arrow + "repo root" phrase) comment lines across the corpus, got ` +
      `${chainLines.length} -- the arrow-or-phrase pattern may have stopped matching and this guard has ` +
      "quietly gone blind",
  );
});

test("in-tree negative control: r2000-answer-key.test.ts's legitimate chain line is seen but never flagged", () => {
  const chainLines = repoRootChainLinesInCorpus();
  const controlLine = chainLines.find((h) => h.file === "r2000-answer-key.test.ts");
  assert.ok(
    controlLine,
    "expected r2000-answer-key.test.ts to contain a chain-shaped comment line (arrow + repo-root phrase) -- " +
      "if this assertion itself fails, the extractor stopped matching on the real in-tree negative control",
  );
  assert.equal(
    controlLine!.line,
    34,
    `expected the legitimate chain line at r2000-answer-key.test.ts:34, found at line ${controlLine!.line}`,
  );
  const violations = hopChainViolationsInCorpus();
  assert.ok(
    !violations.some((v) => v.file === "r2000-answer-key.test.ts"),
    "r2000-answer-key.test.ts's legitimate chain line (routes through the repo root with no pre-move " +
      "segment) must never be flagged as a violation",
  );
});

// ---------------------------------------------------------------------------
// Committed positive fixture -- so the detector's teeth are asserted on
// every run, not just captured once at plan time. Mirrors
// fixtures/planted-phase-pointer-fixture.ts.txt's established shape for the
// sibling comment-phase-pointers.test.ts guard.
// ---------------------------------------------------------------------------

const FIXTURE_PATH = join(HERE, "fixtures", "planted-hop-chain-fixture.ts.txt");

function readFixture(): string {
  assert.ok(existsSync(FIXTURE_PATH), `${FIXTURE_PATH} is missing -- the planted-violation fixture must be committed`);
  return readFileSync(FIXTURE_PATH, "utf8");
}

test("fixture: the committed fixture exists and its extension is neither .ts nor .mts", () => {
  readFixture();
  assert.ok(
    !/\.(ts|mts)$/.test(FIXTURE_PATH),
    "the fixture's extension must not be .ts/.mts, or enumeratedModuleFiles()'s readdirSync-derived scan " +
      "could pick it up if ever renamed by mistake",
  );
});

test("fixture-driven positive control: the fixture's planted half-swept chain line is flagged", () => {
  const lines = commentLinesForSource(readFixture());
  const violationLine = lines.find((h) => h.text.includes("[violation]"));
  assert.ok(violationLine, "expected a fixture line labelled [violation]");
  assert.equal(
    isHopChainViolation(violationLine!.text),
    true,
    `the fixture's planted [violation] line must be flagged: ${JSON.stringify(violationLine!.text)}`,
  );
});

test("fixture-driven negative control: the fixture's legitimate-narration line reports zero violations", () => {
  const lines = commentLinesForSource(readFixture());
  const narrationLine = lines.find((h) => h.text.includes("[legitimate-narration]"));
  assert.ok(narrationLine, "expected a fixture line labelled [legitimate-narration]");
  assert.equal(
    isHopChainViolation(narrationLine!.text),
    false,
    `the fixture's legitimate-narration line must NOT be flagged: ${JSON.stringify(narrationLine!.text)}`,
  );
});

// ---------------------------------------------------------------------------
// The real assertion.
// ---------------------------------------------------------------------------

test("no shipped src/mcp/vice source comment describes a half-swept repo-root chain (PKG-03)", () => {
  const violations = hopChainViolationsInCorpus();
  assert.deepEqual(
    violations,
    [],
    "half-swept repo-root chain comment(s) found -- correct the segment names so the chain names only real " +
      "ancestors of the module directory, ending at the repository root; do not add a per-file exemption " +
      "instead:\n" +
      violations.map((v) => `  ${v.file}:${v.line}: ${v.text}`).join("\n"),
  );
});
