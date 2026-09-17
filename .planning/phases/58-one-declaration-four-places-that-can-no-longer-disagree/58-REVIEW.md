---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
reviewed: 2026-09-17T19:26:18Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - docs/phase58-declaration-provenance.md
  - src/mcp/vice/phase58-citation-ledger.test.ts
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-09-17T19:26:18Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

`docs/phase58-declaration-provenance.md`'s Citation ledger and
`src/mcp/vice/phase58-citation-ledger.test.ts`'s audit function were read in
full, the suite was run (10/10 green), and `extractCitations()` /
`parseCitationLedger()` were exercised directly against the committed
document: all 25 body citations have exactly one matching, resolving ledger
entry today, so the shipped document is currently self-consistent. The
problems found are all in the audit function's edge-case handling rather than
in today's document content — each was confirmed with a standalone repro
against the real `auditProvenanceCitations()` export, not inferred from
reading. Two let the guard silently confirm something it never actually
checked (an empty anchor, or a path that has walked out of the repository via
a symlink); one crashes the run outright with a raw filesystem exception
instead of the graceful failure string the module's own comments promise.
None of the three requires anything more than a single future ledger-JSON
edit to trigger, and none is currently present in the committed ledger.

## Critical Issues

### CR-01: Symlink under the repo root defeats the containment check, letting the audit "verify" content that lives outside the repository

**File:** `src/mcp/vice/phase58-citation-ledger.test.ts:205-222`
**Issue:** The path-escape guard (`resolvedPath !== repoRoot && !resolvedPath.startsWith(repoRootWithSep)`, line 206) operates on the *lexical* result of `resolve(repoRoot, filePart)` only. It never resolves symlinks before comparing against `repoRoot`. If a citation's `filePart` names a path inside the repo that is (or contains) a symlink pointing outside the repo, `resolve()` still returns a path that lexically starts with `repoRootWithSep`, so the containment check passes, and the subsequent `readFileSync(resolvedPath, ...)` (line 216) transparently follows the symlink and reads whatever is at the real target — which can be anywhere on the filesystem the process can read.

Confirmed with a standalone repro against the real export:
```
symlink: <tmproot>/link.md -> <outside-tmp>/secret.md  (content: "TOP SECRET CONTENT HERE")
citation: { "citation": "link.md:1", "anchor": "TOP SECRET" }
auditProvenanceCitations({ docPath: <tmproot>/doc.md, repoRoot: <tmproot> })
=> []   // zero failures: the audit reports the citation as VERIFIED
```
The "escape" test at line 286 only exercises a lexical `..` escape and explicitly asserts the file is "never read" for that case; it does not cover the symlink-indirection variant, so this gap has no regression coverage. This is exactly the class of bug the review brief flagged ("whether its path handling can read outside the repository root") and it reproduces cleanly against the shipped code, not a hypothetical.
**Fix:**
```ts
import { realpathSync } from "node:fs";
// ... after existsSync(resolvedPath) succeeds:
const realPath = realpathSync(resolvedPath);
const realRoot = realpathSync(repoRoot);
const realRootWithSep = realRoot.endsWith(sep) ? realRoot : realRoot + sep;
if (realPath !== realRoot && !realPath.startsWith(realRootWithSep)) {
  failures.push(`${entry.citation}: resolves outside the repository root via a symlink (${realPath}) -- refused, file not read`);
  continue;
}
```
Add a test mirroring the existing `..`-escape case but using `symlinkSync()` to point a same-directory file outside `repoRoot`.

### CR-02: A ledger citation resolving to a directory crashes the run with an uncaught `EISDIR` instead of the promised graceful failure

**File:** `src/mcp/vice/phase58-citation-ledger.test.ts:211-222`
**Issue:** `existsSync(resolvedPath)` (line 211) is true for directories as well as files, so the directory case falls through to `readFileSync(resolvedPath, "utf8")` (line 216), which throws `EISDIR: illegal operation on a directory, read`. `auditProvenanceCitations` has no try/catch around this read, so the exception propagates out of the function uncaught, crashing the `node --test` run rather than appearing as an entry in the returned failures array. This directly contradicts the module's own stated contract — the header comment for `parseCitationLedger` says "never throws", and the escape-test's own comment (line 292) states the design intent explicitly: an audit failure must be "a graceful failure string", not a thrown exception (mirroring exactly the ENOENT case that test already guards).

Confirmed with a standalone repro against the real export:
```
mkdir <tmproot>/adir.md
citation: { "citation": "adir.md:1", "anchor": "x" }
auditProvenanceCitations({ docPath: ..., repoRoot: <tmproot> })
=> throws "EISDIR: illegal operation on a directory, read"
```
A single bad ledger entry (e.g. a citation accidentally pointed at a directory rather than a file, plausible during hand-authoring since the CITATION_RE format doesn't distinguish them) takes down the whole test file's run with a low-level OS error instead of a readable, single-entry failure message.
**Fix:**
```ts
import { statSync } from "node:fs";
// ... replace the existsSync + readFileSync sequence with:
let stat;
try {
  stat = statSync(resolvedPath);
} catch {
  failures.push(`${entry.citation}: cited file does not exist at ${resolvedPath}`);
  continue;
}
if (!stat.isFile()) {
  failures.push(`${entry.citation}: cited path is not a regular file: ${resolvedPath}`);
  continue;
}
```

## Warnings

### WR-01: Empty-string `anchor` trivially satisfies the substring check, letting a ledger entry "verify" any cited range with no actual assertion

**File:** `src/mcp/vice/phase58-citation-ledger.test.ts:110-116` and `:227`
**Issue:** `parseCitationLedger` validates that `anchor` is a `string` (line 111) but never that it is non-empty. `String.prototype.includes("")` is always `true` in JavaScript for any string, including the empty string itself, so `citedText.includes(entry.anchor)` (line 227) passes unconditionally whenever `entry.anchor === ""`, regardless of what the cited line range actually contains.

Confirmed with a standalone repro against the real export:
```
cited.md: "totally unrelated content"
ledger entry: { "citation": "cited.md:1", "anchor": "" }
auditProvenanceCitations(...) => []   // reported as verified
```
This reopens, for a single entry, exactly the silent-drift failure mode this whole file exists to close (per its own header: "a citation cannot silently drift ... and must never again be the entire check"). Nothing in the committed ledger currently uses an empty anchor, but nothing stops a future edit from doing so, accidentally or otherwise, and the entry would pass every case in this suite.
**Fix:** Reject empty (or whitespace-only) anchors as a ledger-format error in `parseCitationLedger`:
```ts
if (typeof citation !== "string" || typeof anchor !== "string" || anchor.length === 0) {
  errors.push(`ledger entry ${i}: "citation" and "anchor" must both be non-empty strings`);
  return;
}
```

### WR-02: Out-of-bounds check admits one phantom trailing "line" for files ending in a newline

**File:** `src/mcp/vice/phase58-citation-ledger.test.ts:216-217`
**Issue:** `readFileSync(...).split("\n")` produces a trailing empty-string element for any file ending in `\n` (e.g. `"a\nb\n".split("\n")` → `["a", "b", ""]`, length 3 for a 2-line file). The bounds check `end > fileLines.length` (line 217) therefore accepts `end` one past the file's real last line, and the "cited" text for that phantom line is `""`. On its own this doesn't let a *meaningful* anchor match (an empty slice can't contain non-empty text), but combined with WR-01 it means a citation one line past end-of-file with an empty anchor passes silently — confirmed: citing line 3 of a 2-line, newline-terminated file with `anchor: ""` returns `[]`. Independent of WR-01, it's a genuine off-by-one against the file's real line count.
**Fix:** Drop a single trailing empty element produced by a final newline before computing `fileLines.length`:
```ts
const rawContent = readFileSync(resolvedPath, "utf8");
const fileLines = rawContent.split("\n");
if (rawContent.endsWith("\n")) fileLines.pop();
```

## Info

### IN-01: Extension whitelist in `CITATION_RE` will fail closed (loudly, not silently) for any future citation using an unlisted extension

**File:** `src/mcp/vice/phase58-citation-ledger.test.ts:134`
**Issue:** `CITATION_RE` only recognizes `md|mts|ts|mjs|json|yml|sh|a` extensions immediately before the `:line` suffix. A future citation to, say, a `.mjs.map` or `.cjs` file would not be extracted by `extractCitations()`, so a correctly-authored ledger entry for it would be reported as an "orphan" (has a ledger entry but does not occur in the document body) even though it's genuinely cited in prose. This fails the build rather than passing silently, so it's self-correcting, but it's a maintenance trap worth a one-line comment note near the regex for the next person who adds a citation to an unlisted extension and gets a confusing "orphan" failure instead of an "unrecognized extension" one.
**Fix:** Either widen the whitelist preemptively for extensions already used elsewhere in the repo (`.cjs`, `.yaml`), or add a comment above `CITATION_RE` stating explicitly that a new extension must be added here first, before it can be cited.

---

_Reviewed: 2026-09-17T19:26:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
