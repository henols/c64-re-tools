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

/** STUB (RED phase): not yet implemented. */
export function parseCitationLedger(_docText: string): { entries: CitationLedgerEntry[]; errors: string[] } {
  return { entries: [], errors: ["not implemented"] };
}

/** STUB (RED phase): not yet implemented. */
export function auditProvenanceCitations(_options: CitationAuditOptions): string[] {
  return ["not implemented"];
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
