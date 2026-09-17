// phase58-citation-ledger.test.ts -- the citation-ledger audit for
// docs/phase58-declaration-provenance.md.
//
// WHY THIS FILE EXISTS: two file:line citations in that provenance document
// pointed at the wrong lines -- one landed on an unrelated row of
// .planning/REQUIREMENTS.md, the other landed inside an unrelated bash
// function in .github/workflows/ci.yml -- and both passed every automated
// verify that had run against the document, because those verifies only
// checked that the cited PATH existed on disk, never that the cited LINE
// said what the prose claimed. Both wrong citations were caught only by a
// human code review pass, after already shipping. A path existing on disk
// is not evidence a claim is true, and must never again be the entire
// check: every citation in that document now carries a ledger entry
// recording an ANCHOR -- a literal substring the cited line range must
// contain -- re-verified against the live file on every run, so a citation
// cannot silently drift the way these two did.
//
// WHAT NOT TO DO: do not let the anchor become a second source of truth
// that is trusted without re-checking. It is redundant by design -- it is
// re-asserted against the cited file's live text on every run, never cached
// or believed on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The plain `.git`-marker walk, mirrored from phase50-findings-contract.test.ts. */
function findRepoRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`findRepoRoot: no .git ancestor found above ${from}`);
    dir = parent;
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = findRepoRoot(HERE);
const DOC_PATH = join(REPO_ROOT, "docs", "phase58-declaration-provenance.md");

/** One ledger entry: the citation string as it appears in the document body,
 * and the literal substring the cited line range must contain. */
export interface CitationLedgerEntry {
  citation: string;
  anchor: string;
}

/** Options for auditProvenanceCitations(): a document path and the
 * repository root every citation's path part is resolved against. Both
 * strings, so a planted fixture tree can be fed to the same code as the
 * committed one. */
export interface CitationAuditOptions {
  docPath: string;
  repoRoot: string;
}

/** The ledger region is everything from the line matching this level-2
 * heading through the end of the file -- deliberately the document's FINAL
 * section, so any section added later is automatically inside the body
 * `extractCitations()` (Task 2) scans. */
const LEDGER_HEADING_RE = /^## Citation ledger\s*$/m;

/** Parses `docText`'s Citation ledger section: the single fenced ```json
 * block after the `## Citation ledger` heading, as a JSON array of
 * `{ citation, anchor }` objects. Returns the valid entries plus a string
 * array of parse errors -- never throws, never coerces a type, never drops
 * an unexpected key silently (the same refuse-unknown-keys discipline
 * `normaliseHostToolRequest()` applies on the host-tool seam). */
export function parseCitationLedger(docText: string): { entries: CitationLedgerEntry[]; errors: string[] } {
  const headingMatch = LEDGER_HEADING_RE.exec(docText);
  if (!headingMatch) {
    return {
      entries: [],
      errors: ["Citation ledger region not found: no line matches a level-2 'Citation ledger' heading"],
    };
  }
  const ledgerRegion = docText.slice(headingMatch.index);
  const blockMatch = /```json\s*\n([\s\S]*?)```/.exec(ledgerRegion);
  if (!blockMatch) {
    return { entries: [], errors: ["Citation ledger region found but contains no fenced ```json block"] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(blockMatch[1]!);
  } catch (err) {
    return { entries: [], errors: [`Citation ledger json block does not parse as JSON: ${(err as Error).message}`] };
  }
  if (!Array.isArray(parsed)) {
    return { entries: [], errors: ["Citation ledger json block must be a JSON array of {citation, anchor} objects"] };
  }

  const entries: CitationLedgerEntry[] = [];
  const errors: string[] = [];
  parsed.forEach((raw: unknown, i: number) => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`ledger entry ${i}: expected an object with "citation" and "anchor" string fields, got ${JSON.stringify(raw)}`);
      return;
    }
    const keys = Object.keys(raw as Record<string, unknown>).sort();
    if (keys.length !== 2 || keys[0] !== "anchor" || keys[1] !== "citation") {
      errors.push(`ledger entry ${i}: must carry exactly the two keys "citation" and "anchor", got [${keys.join(", ")}]`);
      return;
    }
    const { citation, anchor } = raw as { citation: unknown; anchor: unknown };
    if (typeof citation !== "string" || typeof anchor !== "string") {
      errors.push(`ledger entry ${i}: "citation" and "anchor" must both be strings`);
      return;
    }
    entries.push({ citation, anchor });
  });
  return { entries, errors };
}

/** Splits a `path:line` or `path:start-end` citation string into its parts.
 * Returns null if the string does not match that shape. */
function parseCitationString(citation: string): { filePart: string; start: number; end: number } | null {
  const m = /^(.+):(\d+)(?:-(\d+))?$/.exec(citation);
  if (!m) return null;
  const start = Number(m[2]);
  const end = m[3] !== undefined ? Number(m[3]) : start;
  return { filePart: m[1]!, start, end };
}

/** The whole resolution-relation audit (Task 1 scope): every ledger entry's
 * citation must parse, its path must resolve inside `repoRoot`, its range
 * must be well-formed and in-bounds, and its anchor must be found -- as a
 * raw substring, no normalisation -- inside the cited line range's live
 * text. Returns a string array of failures; empty means pass. Task 2 adds
 * the completeness, no-orphans and non-vacuity relations on top of this. */
export function auditProvenanceCitations(options: CitationAuditOptions): string[] {
  const failures: string[] = [];
  const docText = readFileSync(options.docPath, "utf8");
  const { entries, errors } = parseCitationLedger(docText);
  failures.push(...errors);

  const repoRoot = options.repoRoot;
  const repoRootWithSep = repoRoot.endsWith(sep) ? repoRoot : repoRoot + sep;

  for (const entry of entries) {
    const parsedCitation = parseCitationString(entry.citation);
    if (!parsedCitation) {
      failures.push(`${entry.citation}: not a valid "path:line" or "path:start-end" citation string`);
      continue;
    }
    const { filePart, start, end } = parsedCitation;

    if (start > end) {
      failures.push(`${entry.citation}: malformed range -- start (${start}) is greater than end (${end})`);
      continue;
    }

    const resolvedPath = resolve(repoRoot, filePart);
    if (resolvedPath !== repoRoot && !resolvedPath.startsWith(repoRootWithSep)) {
      failures.push(`${entry.citation}: resolves outside the repository root (${repoRoot}) -- refused, file not read`);
      continue;
    }

    if (!existsSync(resolvedPath)) {
      failures.push(`${entry.citation}: cited file does not exist at ${resolvedPath}`);
      continue;
    }

    const fileLines = readFileSync(resolvedPath, "utf8").split("\n");
    if (start < 1 || end > fileLines.length) {
      failures.push(`${entry.citation}: range out of bounds -- cited file has ${fileLines.length} lines`);
      continue;
    }

    const citedText = fileLines.slice(start - 1, end).join("\n");
    // Raw substring match: no normalize(), no trim(), no case folding. The
    // document quotes real source text containing multi-byte characters,
    // and any normalisation would make the check accept text the cited
    // file does not literally carry (Task 2's encoding case proves this).
    if (!citedText.includes(entry.anchor)) {
      failures.push(`${entry.citation}: anchor ${JSON.stringify(entry.anchor)} not found in cited range; actual text: ${JSON.stringify(citedText)}`);
    }
  }

  return failures;
}

// ===========================================================================
// Task 1 cases -- the resolution relation only. Completeness, no-orphans and
// non-vacuity are added in Task 2, once extractCitations exists.
// ===========================================================================

test("the committed provenance document's citation ledger is complete and every anchor resolves", () => {
  assert.deepEqual(auditProvenanceCitations({ docPath: DOC_PATH, repoRoot: REPO_ROOT }), []);
});

test("structural (non-vacuity): a citation whose line number is shifted off its anchor is reported, and the corrected twin is not", () => {
  const root = mkdtempSync(join(tmpdir(), "phase58-citation-ledger-"));
  try {
    writeFileSync(join(root, "cited.md"), "alpha\nbravo\ncharlie\n");

    const shiftedDoc = `# fixture

Body text citing \`cited.md:1\`.

## Citation ledger

\`\`\`json
[
  { "citation": "cited.md:1", "anchor": "bravo" }
]
\`\`\`
`;
    writeFileSync(join(root, "shifted.md"), shiftedDoc);
    const shiftedFailures = auditProvenanceCitations({ docPath: join(root, "shifted.md"), repoRoot: root });
    assert.equal(shiftedFailures.length, 1, `expected exactly one failure, got ${JSON.stringify(shiftedFailures)}`);
    assert.match(shiftedFailures[0]!, /cited\.md:1/);

    const correctedDoc = `# fixture

Body text citing \`cited.md:2\`.

## Citation ledger

\`\`\`json
[
  { "citation": "cited.md:2", "anchor": "bravo" }
]
\`\`\`
`;
    writeFileSync(join(root, "corrected.md"), correctedDoc);
    const correctedFailures = auditProvenanceCitations({ docPath: join(root, "corrected.md"), repoRoot: root });
    assert.deepEqual(correctedFailures, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a ledger citation whose path escapes the repository root is reported and its file is never read", () => {
  const root = mkdtempSync(join(tmpdir(), "phase58-citation-ledger-escape-"));
  try {
    mkdirSync(join(root, "inner"));
    // No file is ever created outside `root` -- if the audit attempted to
    // read the escaping path, it would throw ENOENT rather than returning a
    // graceful failure string, which is exactly the distinction this case
    // is asserting.
    const doc = `# fixture

Body text citing \`../outside.md:1\`.

## Citation ledger

\`\`\`json
[
  { "citation": "../outside.md:1", "anchor": "anything" }
]
\`\`\`
`;
    writeFileSync(join(root, "inner", "doc.md"), doc);
    const failures = auditProvenanceCitations({ docPath: join(root, "inner", "doc.md"), repoRoot: join(root, "inner") });
    assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
    assert.match(failures[0]!, /outside the repository root|escapes/);
    assert.doesNotMatch(failures[0]!, /ENOENT/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("range semantics: start equal to end is one line, both ends inclusive, start greater than end rejected", () => {
  // start === end: exactly one line, valid.
  {
    const root = mkdtempSync(join(tmpdir(), "phase58-citation-ledger-range-"));
    try {
      writeFileSync(join(root, "cited.md"), "one\ntwo\nthree\n");
      const doc = `# fixture

Cites \`cited.md:2\`.

## Citation ledger

\`\`\`json
[
  { "citation": "cited.md:2", "anchor": "two" }
]
\`\`\`
`;
      writeFileSync(join(root, "doc.md"), doc);
      assert.deepEqual(auditProvenanceCitations({ docPath: join(root, "doc.md"), repoRoot: root }), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  // start > end: malformed range, rejected without reading the cited file.
  {
    const root = mkdtempSync(join(tmpdir(), "phase58-citation-ledger-range-"));
    try {
      // Deliberately no cited.md at all -- a read would throw, proving the
      // malformed-range check short-circuits before any file access.
      const doc = `# fixture

Cites \`cited.md:5-3\`.

## Citation ledger

\`\`\`json
[
  { "citation": "cited.md:5-3", "anchor": "anything" }
]
\`\`\`
`;
      writeFileSync(join(root, "doc.md"), doc);
      const failures = auditProvenanceCitations({ docPath: join(root, "doc.md"), repoRoot: root });
      assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
      assert.match(failures[0]!, /malformed range/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  // end past the cited file's last line: out-of-range, not a throw.
  {
    const root = mkdtempSync(join(tmpdir(), "phase58-citation-ledger-range-"));
    try {
      writeFileSync(join(root, "cited.md"), "one\ntwo\nthree\n");
      const doc = `# fixture

Cites \`cited.md:1-99\`.

## Citation ledger

\`\`\`json
[
  { "citation": "cited.md:1-99", "anchor": "one" }
]
\`\`\`
`;
      writeFileSync(join(root, "doc.md"), doc);
      const failures = auditProvenanceCitations({ docPath: join(root, "doc.md"), repoRoot: root });
      assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
      assert.match(failures[0]!, /out of bounds|out-of-range/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  // no parseable ledger region at all: a single failure naming the missing region.
  {
    const root = mkdtempSync(join(tmpdir(), "phase58-citation-ledger-range-"));
    try {
      const doc = `# fixture

No ledger section at all in this document.
`;
      writeFileSync(join(root, "doc.md"), doc);
      const failures = auditProvenanceCitations({ docPath: join(root, "doc.md"), repoRoot: root });
      assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
      assert.match(failures[0]!, /Citation ledger/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});
