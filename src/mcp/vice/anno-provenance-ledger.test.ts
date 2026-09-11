// anno-provenance-ledger.test.ts -- phase 46 plan 02 (BUILD-05 criterion 4).
//
// Every `<behavior>` bullet below was written FIRST and observed to fail
// before plan 46-02's implementation in `anno-provenance-ledger.ts` existed,
// in the `anno-bank.test.ts:1-5` shape this directory's suites declare that
// discipline in.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// `anno-provenance-ledger.ts` is the one new parser this phase adds, and its
// whole contract is refusal behaviour: BUILD-05 criterion 4 requires that,
// with the ledger asked for and absent or malformed, the exporter declines
// BY NAME rather than inventing a verdict. A refusal contract is only worth
// something when every way of being absent or malformed has a named message
// and a test that observed it -- this file is that observation.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// Whether `readProvenanceLedger()` accepts EXACTLY the files `renderLedger()`
// can produce and refuses everything else by name, whether every refusal
// message carries the permitted fact vocabulary and nothing else (never a
// cell's own text), and whether `provenanceForRange()`'s address-only join
// behaves correctly at every adjacency boundary.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never hand-write a `| Start | End | ... |`-shaped table row anywhere in
//     this file. Every positive AND malformed fixture is built from
//     `renderLedger()`'s own output -- a hand-typed table would test a format
//     this repository does not produce.
//   - Never assert a malformed fixture's refusal without first asserting the
//     mutation that produced it actually changed the text. A substitution
//     that silently matched nothing would pass for the wrong reason.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PROVENANCE_LEDGER_HEADER_CELLS,
  ProvenanceLedgerError,
  provenanceForRange,
  readProvenanceLedger,
  type ProvenanceLedger,
} from "./anno-provenance-ledger.ts";

// `renderLedger()` is the ONE writer this reader is matched against -- the
// same import precedent `anno-export-asm.test.ts` and
// `skill-memory-mapping-cli.test.ts` already establish for a test importing
// the skill tree. Tests are not in `package.json`'s `files[]`, so the
// shipped-closure rule is untouched.
// @ts-expect-error -- diff-images.mjs (a plain skill script, left unmodified) has no .d.mts
import { renderLedger } from "../../skills/c64-provenance-diff/scripts/diff-images.mjs";

// ---------------------------------------------------------------------------
// One temp directory for the whole file, removed in `after()` -- this host's
// `/tmp` is RAM-backed, so a leaked directory is leaked memory (T-30-07,
// `anno-export-asm.test.ts`'s own convention).
// ---------------------------------------------------------------------------
import { after } from "node:test";

let workDir: string | undefined;
let dirCounter = 0;

function freshDir(tag: string): string {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "anno-provenance-ledger-"));
  const dir = join(workDir, `${tag}-${dirCounter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

/**
 * THE ONE HELPER that builds a ledger file from a `generatedRanges` literal:
 * renders it through `renderLedger()`'s own pure API, writes the markdown to
 * `dir/PROVENANCE.md`, and returns both the path and the markdown text. The
 * markdown is returned (not only the path) because the malformed fixtures
 * below apply ONE documented string mutation to a real writer's output --
 * they never hand-write a table.
 */
function writeLedgerFile(dir: string, generatedRanges: readonly unknown[]): { path: string; markdown: string } {
  const markdown: string = renderLedger({
    generatedRanges,
    gapTolerance: 16,
    prose: "anno-provenance-ledger.test.ts fixture",
  });
  const path = join(dir, "PROVENANCE.md");
  writeFileSync(path, markdown, "utf8");
  return { path, markdown };
}

/** Writes `markdown` (already mutated by the caller) to a fresh path in
 * `dir`, distinct from `writeLedgerFile()`'s own `PROVENANCE.md` so a test
 * building both a well-formed and a mutated ledger in the same directory
 * never collides. */
function writeMutated(dir: string, markdown: string): string {
  const path = join(dir, "PROVENANCE-mutated.md");
  writeFileSync(path, markdown, "utf8");
  return path;
}

/** The line in `markdown` beginning with `| ${startHex} |` -- the one row a
 * mutation targets. Throws (via assert) if no such line exists, so a typo in
 * a fixture's own address surfaces as a fixture bug, not a false pass. */
function findRowLine(markdown: string, startHex: string): { index: number; lines: string[] } {
  const lines = markdown.split("\n");
  const index = lines.findIndex((l) => l.startsWith(`| ${startHex} |`));
  assert.ok(index >= 0, `expected a row starting with "${startHex}" in the rendered markdown:\n${markdown}`);
  return { index, lines };
}

/** Asserts `mutated !== original`, so every malformed-fixture test proves its
 * own substitution actually changed something before relying on it. */
function assertMutated(original: string, mutated: string, what: string): void {
  assert.notEqual(mutated, original, `the ${what} mutation must actually change the text, or the refusal below tests nothing`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Three rows tiling exactly $0000-$FFFF, with clean round-number boundaries
 * so a mutation can target one row's cells unambiguously. Row B carries an
 * UNRECOGNISED verdict string (verbatim-carry) and a distinctive
 * information-disclosure token in its Evidence cell -- reused by every
 * malformed-fixture test below, since the SAME fixture proves the token
 * never leaks regardless of which refusal fires.
 */
const DISCLOSURE_TOKEN = "DISCLOSURE-CONTROL-TOKEN-9f3e7a";
const THREE_ROW_RANGES = [
  {
    start: 0x0000,
    end: 0x0fff,
    kind: "unused",
    verdict: "ORIGINAL",
    agreeing_releases: 2,
    evidence: "row A: padding before the middle range",
  },
  {
    start: 0x1000,
    end: 0x1fff,
    kind: "game",
    verdict: "NOVEL-VERDICT-XYZZY",
    agreeing_releases: 0,
    evidence: `row B: an unrecognised verdict, carried verbatim -- ${DISCLOSURE_TOKEN} must never leak into a refusal message`,
  },
  {
    start: 0x2000,
    end: 0xffff,
    kind: "unused",
    verdict: "ORIGINAL",
    agreeing_releases: 2,
    evidence: "row C: padding after the middle range",
  },
];

/** A row set with a literal pipe in its Evidence cell, escaped by
 * `renderLedger()`'s own writer -- the escaped-text round-trip case. */
const PIPE_RANGES = [
  { start: 0x0000, end: 0x7fff, kind: "unused", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "before the pipe row" },
  { start: 0x8000, end: 0xffff, kind: "game", verdict: "UNKNOWN", agreeing_releases: 0, reason: "contains a literal pipe: a|b" },
];

/** One row tiling all of $0000-$FFFF -- the empty edge's non-degenerate
 * neighbour. */
const SINGLE_ROW_RANGES = [
  { start: 0x0000, end: 0xffff, kind: "unused", verdict: "ORIGINAL", agreeing_releases: 2, evidence: "one row tiling everything" },
];

test("PRECONDITION: the fixture really carries an unrecognised verdict and the disclosure token (non-vacuity, anno-coverage.test.ts:918-923 shape)", () => {
  const row = THREE_ROW_RANGES[1]!;
  assert.equal(row.verdict, "NOVEL-VERDICT-XYZZY", "row B must carry a verdict this module has never heard of");
  assert.ok(row.evidence.includes(DISCLOSURE_TOKEN), "row B's evidence must actually carry the disclosure token, or the control below measures nothing");
});

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test("round trip: a renderLedger()-built three-row ledger returns three rows whose cells are byte-identical to the writer's own literals", () => {
  const dir = freshDir("roundtrip");
  const { path } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const ledger = readProvenanceLedger(path);

  assert.equal(ledger.path, path);
  assert.equal(ledger.rows.length, 3, "the fixture carries exactly three rows");

  const [a, b, c] = ledger.rows;
  assert.equal(a!.start, 0x0000);
  assert.equal(a!.endInclusive, 0x0fff);
  assert.equal(a!.kind, "unused");
  assert.equal(a!.verdict, "ORIGINAL");
  assert.equal(a!.confidence, "MEDIUM-HIGH", "agreeing_releases=2 is below renderLedger()'s own HIGH threshold of 3");
  assert.equal(a!.agreeingReleases, "2");
  assert.equal(a!.evidence, "row A: padding before the middle range");

  assert.equal(b!.start, 0x1000);
  assert.equal(b!.endInclusive, 0x1fff);
  assert.equal(b!.kind, "game");
  assert.equal(b!.agreeingReleases, "0");

  assert.equal(c!.start, 0x2000);
  assert.equal(c!.endInclusive, 0xffff);
});

test("verbatim carry: a row whose Verdict cell holds a string the reader has never heard of is returned unchanged", () => {
  const dir = freshDir("verbatim-verdict");
  const { path } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const ledger = readProvenanceLedger(path);

  assert.equal(ledger.rows[1]!.verdict, "NOVEL-VERDICT-XYZZY", "an unrecognised Verdict string must be carried through, never classified or defaulted");
});

test("escaped text: a row whose Evidence contains a literal pipe (escaped by the writer as \\|) round-trips with the single unescaped pipe restored", () => {
  const dir = freshDir("escaped-pipe");
  const { markdown, path } = writeLedgerFile(dir, PIPE_RANGES);

  assert.ok(markdown.includes("a\\|b"), "the writer must actually have escaped the pipe, or this test measures nothing");

  const ledger = readProvenanceLedger(path);

  assert.equal(ledger.rows[1]!.evidence, "contains a literal pipe: a|b", "the reader must restore the single unescaped pipe, not leave the backslash or double it");
});

test("single row: a one-row ledger tiling all of $0000..$FFFF is accepted and returns exactly one row", () => {
  const dir = freshDir("single-row");
  const { path } = writeLedgerFile(dir, SINGLE_ROW_RANGES);

  const ledger = readProvenanceLedger(path);

  assert.equal(ledger.rows.length, 1, "the empty edge's non-degenerate neighbour: one row, not zero and not two");
  assert.equal(ledger.rows[0]!.start, 0x0000);
  assert.equal(ledger.rows[0]!.endInclusive, 0xffff);
});

// ---------------------------------------------------------------------------
// Refusals -- one test per Task 1 behaviour bullet, asserting on message
// CONTENT (the path is present, the line number is present where
// applicable), never merely that something threw.
// ---------------------------------------------------------------------------

test("refusal: the named file does not exist", () => {
  const dir = freshDir("absent");
  const missingPath = join(dir, "PROVENANCE.md"); // never written

  assert.throws(
    () => readProvenanceLedger(missingPath),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.equal(e.path, missingPath);
      assert.equal(e.lineNumber, undefined, "a whole-file problem carries no lineNumber");
      assert.ok(e.message.includes(missingPath), `must name the path: ${e.message}`);
      assert.match(e.message, /omit/, "must name the option-omission remedy");
      return true;
    },
  );
});

test("refusal: the file exists but no line splits into the seven expected header cells", () => {
  const dir = freshDir("no-header");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const mutated = markdown.replace("| Evidence / Reason |", "| Evidence/Reason |");
  assertMutated(markdown, mutated, "header-cell-spelling");
  const path = writeMutated(dir, mutated);

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.equal(e.lineNumber, undefined, "a whole-file problem carries no lineNumber");
      assert.ok(e.message.includes(path), `must name the path: ${e.message}`);
      for (const cell of PROVENANCE_LEDGER_HEADER_CELLS) {
        assert.ok(e.message.includes(cell), `must name the expected column "${cell}": ${e.message}`);
      }
      return true;
    },
  );
});

test("refusal: the header and separator are present but zero data rows follow", () => {
  const dir = freshDir("zero-rows");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const mutated = markdown
    .split("\n")
    .filter((line) => !line.startsWith("| $"))
    .join("\n");
  assertMutated(markdown, mutated, "drop-all-data-rows");
  const path = writeMutated(dir, mutated);

  const absentPath = join(dir, "never-written.md");
  let absentMessage = "";
  try {
    readProvenanceLedger(absentPath);
  } catch (e) {
    absentMessage = e instanceof Error ? e.message : String(e);
  }

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.equal(e.lineNumber, undefined, "a whole-file problem carries no lineNumber");
      assert.ok(e.message.includes(path), `must name the path: ${e.message}`);
      assert.notEqual(e.message, absentMessage, '"the table parsed to no rows" must not read the same as "no ledger was asked for"');
      return true;
    },
  );
});

test("refusal: a data row splits into other than seven cells", () => {
  const dir = freshDir("bad-shape");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const { index, lines } = findRowLine(markdown, "$1000");
  const original = lines[index]!;
  const mutated = original.replace(" | NOVEL-VERDICT-XYZZY |", " NOVEL-VERDICT-XYZZY |"); // merges Kind+Verdict, 7 cells -> 6
  assertMutated(original, mutated, "merge-two-cells");
  lines[index] = mutated;
  const path = writeMutated(dir, lines.join("\n"));

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.equal(e.lineNumber, index + 1, "must cite the 1-based line number of the malformed row");
      assert.ok(e.message.includes(path), `must name the path: ${e.message}`);
      assert.ok(e.message.includes(String(index + 1)), `must cite the line number in the message text: ${e.message}`);
      assert.ok(e.message.includes("6"), `must name the found cell count: ${e.message}`);
      assert.ok(e.message.includes("7"), `must name the expected cell count: ${e.message}`);
      assert.ok(!e.message.includes(DISCLOSURE_TOKEN), `must never quote the row's own cell text: ${e.message}`);
      return true;
    },
  );
});

test("refusal: a data row's Start cell is not a parseable $XXXX address, naming Start and never the cell's own text", () => {
  const dir = freshDir("bad-start");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const { index, lines } = findRowLine(markdown, "$1000");
  const original = lines[index]!;
  const mutated = original.replace("| $1000 |", "| 1000-BOGUS |");
  assertMutated(original, mutated, "strip-dollar-from-start");
  lines[index] = mutated;
  const path = writeMutated(dir, lines.join("\n"));

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.equal(e.lineNumber, index + 1);
      assert.ok(e.message.includes(path), `must name the path: ${e.message}`);
      assert.ok(e.message.includes("Start"), `must name the Start column: ${e.message}`);
      assert.ok(!e.message.includes("1000-BOGUS"), `must never quote the malformed cell's own text: ${e.message}`);
      return true;
    },
  );
});

test("refusal: a data row's End cell is not a parseable $XXXX address, naming End and never the cell's own text", () => {
  const dir = freshDir("bad-end");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const { index, lines } = findRowLine(markdown, "$1000");
  const original = lines[index]!;
  const mutated = original.replace("| $1FFF |", "| ZZZZ-BOGUS |");
  assertMutated(original, mutated, "corrupt-end-cell");
  lines[index] = mutated;
  const path = writeMutated(dir, lines.join("\n"));

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.equal(e.lineNumber, index + 1);
      assert.ok(e.message.includes(path), `must name the path: ${e.message}`);
      assert.ok(e.message.includes("End"), `must name the End column: ${e.message}`);
      assert.ok(!e.message.includes("ZZZZ-BOGUS"), `must never quote the malformed cell's own text: ${e.message}`);
      return true;
    },
  );
});

test("refusal: a data row's End is below its Start", () => {
  const dir = freshDir("inverted-span");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const { index, lines } = findRowLine(markdown, "$1000");
  const original = lines[index]!;
  const mutated = original.replace("| $1FFF |", "| $0500 |"); // End $0500 is below Start $1000
  assertMutated(original, mutated, "invert-span");
  lines[index] = mutated;
  const path = writeMutated(dir, lines.join("\n"));

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.equal(e.lineNumber, index + 1, "must cite the 1-based line number");
      assert.ok(e.message.includes(path), `must name the path: ${e.message}`);
      return true;
    },
  );
});

test("refusal: two data rows overlap", () => {
  const dir = freshDir("overlap");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const { index: bIndex } = findRowLine(markdown, "$1000");
  const { index: cIndex, lines } = findRowLine(markdown, "$2000");
  const original = lines[cIndex]!;
  const mutated = original.replace("| $2000 |", "| $1500 |"); // $1500 is inside row B's $1000..$1fff span
  assertMutated(original, mutated, "overlap-start");
  lines[cIndex] = mutated;
  const path = writeMutated(dir, lines.join("\n"));

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.ok(e.message.includes(path), `must name the path: ${e.message}`);
      assert.ok(e.message.includes(String(bIndex + 1)), `must name row B's line number: ${e.message}`);
      assert.ok(e.message.includes(String(cIndex + 1)), `must name row C's line number: ${e.message}`);
      assert.ok(e.message.includes("$1000") && e.message.includes("$1500"), `must name both spans: ${e.message}`);
      assert.ok(!e.message.includes(DISCLOSURE_TOKEN), `must never quote a row's own cell text: ${e.message}`);
      return true;
    },
  );
});

test("refusal: two data rows are not strictly ascending by Start (reordered)", () => {
  const dir = freshDir("reordered");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const { index: bIndex, lines } = findRowLine(markdown, "$1000");
  const { index: cIndex } = findRowLine(markdown, "$2000");
  const original = lines.join("\n");
  const bLine = lines[bIndex]!;
  const cLine = lines[cIndex]!;
  lines[bIndex] = cLine;
  lines[cIndex] = bLine;
  const mutated = lines.join("\n");
  assertMutated(original, mutated, "swap-row-order");
  const path = writeMutated(dir, mutated);

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.ok(e.message.includes(path), `must name the path: ${e.message}`);
      assert.ok(e.message.includes("not") && e.message.includes("ascending"), `must state the ordering violation: ${e.message}`);
      return true;
    },
  );
});

test("refusal: the accepted rows leave a gap (a middle row deleted) -- names the first uncovered address", () => {
  const dir = freshDir("gap");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  const mutated = markdown
    .split("\n")
    .filter((line) => !line.startsWith("| $1000 |"))
    .join("\n");
  assertMutated(markdown, mutated, "delete-middle-row");
  const path = writeMutated(dir, mutated);

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.equal(e.lineNumber, undefined, "a whole-table coverage problem carries no single lineNumber");
      assert.ok(e.message.includes(path), `must name the path: ${e.message}`);
      assert.ok(e.message.includes("$1000"), `must name the first uncovered address: ${e.message}`);
      assert.ok(!e.message.includes(DISCLOSURE_TOKEN), `must never quote a row's own cell text: ${e.message}`);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// The information-disclosure control (T-46-02): a distinctive token planted
// in a malformed row's Evidence cell must never leak into a refusal message,
// while the path and the line number ARE present -- proving the absence is
// not merely "the message was empty".
// ---------------------------------------------------------------------------

test("information-disclosure control: a distinctive token in the offending row's Evidence cell never reaches the refusal message, while the path and line number do", () => {
  const dir = freshDir("disclosure");
  const { markdown } = writeLedgerFile(dir, THREE_ROW_RANGES);

  assert.ok(markdown.includes(DISCLOSURE_TOKEN), "the token must actually be present in the fixture file's bytes, or the absence assertion below measures nothing");

  const { index, lines } = findRowLine(markdown, "$1000");
  const original = lines[index]!;
  const mutated = original.replace("| $1FFF |", "| BOGUS |"); // makes the token-carrying row refusable
  assertMutated(original, mutated, "corrupt-token-row");
  lines[index] = mutated;
  const path = writeMutated(dir, lines.join("\n"));

  assert.throws(
    () => readProvenanceLedger(path),
    (e: unknown) => {
      assert.ok(e instanceof ProvenanceLedgerError);
      assert.ok(!e.message.includes(DISCLOSURE_TOKEN), `the thrown message must NOT contain the disclosure token: ${e.message}`);
      assert.ok(e.message.includes(path), `the thrown message MUST contain the path: ${e.message}`);
      assert.ok(e.message.includes(String(index + 1)), `the thrown message MUST contain the line number: ${e.message}`);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// provenanceForRange() -- the five join boundary cases.
// ---------------------------------------------------------------------------

function row(start: number, endInclusive: number, tag: string): ProvenanceLedger["rows"][number] {
  return { start, endInclusive, kind: "game", verdict: "ORIGINAL", confidence: "HIGH", agreeingReleases: "3", evidence: tag };
}

test("provenanceForRange: a row ending exactly one below the query start returns zero rows", () => {
  const ledger: ProvenanceLedger = { path: "synthetic", rows: [row(0x1000, 0x1fff, "A")] };
  const result = provenanceForRange(ledger, 0x2000, 0x20ff);
  assert.deepEqual(result, [], "touching, not overlapping");
});

test("provenanceForRange: a row starting exactly one above the query end returns zero rows", () => {
  const ledger: ProvenanceLedger = { path: "synthetic", rows: [row(0x2000, 0x2fff, "A")] };
  const result = provenanceForRange(ledger, 0x1f00, 0x1fff);
  assert.deepEqual(result, [], "touching, not overlapping");
});

test("provenanceForRange: a one-byte overlap at either end returns one row", () => {
  const leftLedger: ProvenanceLedger = { path: "synthetic", rows: [row(0x1000, 0x1fff, "A")] };
  const leftResult = provenanceForRange(leftLedger, 0x1fff, 0x20ff);
  assert.equal(leftResult.length, 1, "a one-byte overlap at the row's own end is an overlap");
  assert.equal(leftResult[0]!.start, 0x1000);

  const rightLedger: ProvenanceLedger = { path: "synthetic", rows: [row(0x2000, 0x2fff, "B")] };
  const rightResult = provenanceForRange(rightLedger, 0x1f00, 0x2000);
  assert.equal(rightResult.length, 1, "a one-byte overlap at the row's own start is an overlap");
  assert.equal(rightResult[0]!.start, 0x2000);
});

test("provenanceForRange: a query fully inside one row returns that row", () => {
  const ledger: ProvenanceLedger = { path: "synthetic", rows: [row(0x1000, 0x2fff, "A")] };
  const result = provenanceForRange(ledger, 0x1500, 0x1600);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.start, 0x1000);
  assert.equal(result[0]!.endInclusive, 0x2fff);
});

test("provenanceForRange: a query spanning a row boundary returns both rows in ascending start order", () => {
  const ledger: ProvenanceLedger = {
    path: "synthetic",
    rows: [row(0x2000, 0x2fff, "second"), row(0x1000, 0x1fff, "first")], // deliberately stored out of order
  };
  const result = provenanceForRange(ledger, 0x1500, 0x2500);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.start, 0x1000, "ascending start order, regardless of the ledger's own internal array order");
  assert.equal(result[1]!.start, 0x2000);
});
