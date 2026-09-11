---
phase: 46-the-lossless-export-invariant-and-the-provenance-carry
reviewed: 2026-09-11T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - scripts/lib/anno-cli-invocations.mjs
  - src/mcp/vice/anno-cli-path-consumers.test.ts
  - src/mcp/vice/anno-cli.test.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-derive.test.ts
  - src/mcp/vice/anno-durability.test.ts
  - src/mcp/vice/anno-export-asm.test.ts
  - src/mcp/vice/anno-export-asm.ts
  - src/mcp/vice/anno-provenance-ledger.test.ts
  - src/mcp/vice/anno-provenance-ledger.ts
  - src/mcp/vice/anno-register.ts
  - src/mcp/vice/anno-store.test.ts
  - src/mcp/vice/anno-store.ts
  - src/mcp/vice/anno-tools.test.ts
  - src/mcp/vice/anno-tools.ts
  - src/mcp/vice/anno-types.test.ts
  - src/mcp/vice/anno-types.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/skills/c64-provenance-diff/SKILL.md
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 46: Code Review Report

**Reviewed:** 2026-09-11
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

This phase adds a provenance-ledger reader (`anno-provenance-ledger.ts`), wires
it into `exportAsm()` behind an optional `--ledger` flag (BUILD-05), and adds a
durable user-requested-exclusion table plus its `anno_exclude_range` /
`anno_include_range` MCP verbs, with exclusion markers emitted by the exporter
(BUILD-07).

I traced the two invariants named as the review's hardest checks — no
omission and no invention — directly through the code rather than trusting the
prose:

- **No omission**: the block-construction stretch in `anno-export-asm.ts`
  (`sortedRanges.map(...)` → `blocks`) is an unconditional 1:1 map with no
  `.filter()` before or after it, and no code in that stretch reads
  `verdict`/`confidence`/`kind`. The per-block loop that emits provenance and
  exclusion marker comments runs strictly *after* every block's bytes are
  already sliced, decoded/dumped and pushed into `content`; the marker lines
  are `unshift()`ed onto already-complete content, never substituted for it.
  `expectedBytes` is built from the image across every block with no gaps
  introduced by either the ledger or the exclusion table. This matches the
  committed structural guard test (`STRUCTURAL GUARD (BUILD-07)`), which reads
  the same stretch through `codeOnly()` and is itself proven non-vacuous
  against synthetic mutations.
- **No invention**: `anno-provenance-ledger.ts` never normalises, defaults, or
  validates a Verdict/Confidence/Kind value's *content* — it only asserts
  address-shaped invariants (cell count, `$XXXX` shape, ascending/disjoint,
  full `$0000..$FFFF` tiling). An unrecognised Verdict string round-trips
  verbatim (tested). `addExcludedRange`/`removeExcludedRange` carry no
  judgement column at all (`ExcludedRangeRow` has no confidence/verdict
  field), and the exporter never reads a ledger value to decide whether to
  exclude anything — the only route to an exclusion is the user calling
  `anno_exclude_range` directly.
- **No evidence leakage into refusals**: every `ProvenanceLedgerError` message
  is built only from the path, a 1-based line number, a column name, a cell
  count, or a `hex4()`-formatted address the module derived itself — never a
  cell's raw text. The test suite plants a `DISCLOSURE_TOKEN` in a row's
  Evidence cell and asserts it never reaches any of the eight refusal
  messages, including the multi-row overlap and gap refusals.
- **No recommendation**: neither `anno_exclude_range` nor `anno_include_range`
  computes or reports a score, threshold, or suggested exclusion set; both
  simply record/remove what the caller stated, matching `anno-register.ts`'s
  own stated rationale for why the verb exists.

I also checked project-specific census/floor bumps this phase should have
touched (`ANNO_MODULE_FLOOR`, `CLI_PATH_ARGUMENT_FLOOR`, `package.json`
`files[]`, `module-classification.ts`'s line-number citation) against the
actual file layout and line numbers on disk — all are correct and
non-inflated (verified `ANNO_MODULE_FLOOR = 22` against the real 22 `anno-*.ts`
production modules on disk, and `anno-cli.ts:409` against the real location of
`checkAcceptedOptions`).

No BLOCKER-level defect was found. Two WARNING-level robustness/completeness
gaps and two INFO-level observations are recorded below.

## Warnings

### WR-01: `splitTableRow()` silently converts a genuine NUL byte in the ledger file into a literal pipe

**File:** `src/mcp/vice/anno-provenance-ledger.ts:217-228`
**Issue:** `splitTableRow()` uses `String.fromCharCode(0)` as an internal
placeholder to protect `\|` (escaped pipe) sequences across the `split("|")`
call, then restores every placeholder occurrence back to `|` in each cell:
`cell.trim().split(PLACEHOLDER).join("|")`. This restoration is unconditional
— it does not distinguish "a placeholder this function itself inserted for an
escaped pipe" from "a raw NUL byte that was already present in the cell text
before this function ran." The module's own header argues NUL is safe as a
sentinel because "ordinary ledger text... cannot contain it," but that
argument only covers `renderLedger()`'s own well-formed output; a hand-edited
or corrupted ledger file (exactly the class of input this module's eight
named refusals exist to defend against) *can* contain a raw NUL byte in a
cell — e.g., in the Evidence/Reason free-text column. When it does, that NUL
is silently turned into an extra, unescaped `|` character in the returned
cell text, without changing the cell count (the split already happened) and
without being detected or refused anywhere in `readProvenanceLedger()`. The
result is a `ProvenanceLedgerRow.evidence` (or another cell) string carrying a
pipe character that was never actually delimiting anything in the source
file — a small but real content-integrity gap in a module whose entire stated
purpose is "reject rather than repair a malformed row." No test in
`anno-provenance-ledger.test.ts` exercises a cell containing a literal NUL
byte, so this path is untested as well as unguarded.
**Fix:** Refuse a row (or the whole file) outright when a raw NUL byte is
detected in the raw line before the placeholder substitution runs, e.g.:
```ts
function splitTableRow(line: string): string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return undefined;
  const PLACEHOLDER = String.fromCharCode(0);
  if (trimmed.includes(PLACEHOLDER)) {
    throw new ProvenanceLedgerError(/* name the line, never the byte */);
  }
  const protectedLine = trimmed.replace(/\\\|/g, PLACEHOLDER);
  ...
```

### WR-02: `export-asm`'s CLI summary line never surfaces `excludedRangeCount`

**File:** `src/mcp/vice/anno-cli.ts:1527-1531`
**Issue:** `ExportAsmResult.excludedRangeCount` is computed carefully (with a
dedicated doc comment explaining it counts records, not marker lines, and the
30-REVIEW WR-01 lesson about a count's name matching what it counts) but the
CLI's success summary line prints `blocks.length`, `symbolCount`,
`autoNamedSymbolCount`, `unexpressibleCount`, `midInstructionLabelCount`, and
`enumSubstitutionCount` — never `excludedRangeCount`. A user who runs `anno
export-asm` against a store carrying recorded exclusions gets no indication
from the command's own stdout that any exclusion marker was emitted; they
would have to open and grep the generated `.a` file to discover it. This
doesn't violate BUILD-07 (the marker is genuinely in the exported text, which
is the requirement), but it is an inconsistency with the pattern the same
line already establishes for every other "how many of X did this export
touch" figure the result carries, and it is the kind of asymmetry the
project's own commit history (30-REVIEW WR-01/WR-02) has previously had to
correct after the fact once a caller needed the number and found it silently
absent from output.
**Fix:** Add `${result.excludedRangeCount} exclusion(s) marked` (or similar)
to the summary line printed at `anno-cli.ts:1527-1531`.

## Info

### IN-01: No test exercises a version-4 store being refused under `SCHEMA_VERSION` 5

**File:** `src/mcp/vice/anno-durability.test.ts:588-631`
**Issue:** The re-recorded pin test asserts a version-3 store is refused
under `SCHEMA_VERSION` 5, naming both versions in the message
(`schema_version 3` / `expected 5`). The `reaffirm-refusal` doc comment for
version 5 in `anno-types.ts:262-334` explicitly states "a version-4 store
does not open under this `SCHEMA_VERSION`" as part of the decision basis, but
no committed test constructs a version-4 store and asserts it is refused the
same way version-3 is refused (the general `openStore()` schema mismatch
branch is exercised only via the version-3 fixture). This is a coverage gap
for a claim the phase's own commit message makes explicitly, not a defect in
the shipped behavior (the mismatch check in `openStore()` is a plain
`!==` comparison that clearly also refuses a version-4 store).
**Fix:** Add (or extend the existing parametrized-style test) a case
constructing a store with `anno_meta.schema_version = 4` and asserting the
same `AnnoStoreCorruptError` shape as the version-3 case.

### IN-02: `PROVENANCE_MARKER_PREFIX` line format embeds free-text Evidence after several `key=value` fields with no delimiter guarding against `=`/space collisions

**File:** `src/mcp/vice/anno-export-asm.ts:1512-1515`
**Issue:** The emitted line is:
```
  ; PROVENANCE LEDGER: $XXXX..$YYYY verdict=<verdict> confidence=<confidence> kind=<kind> agreeing=<agreeingReleases> evidence=<evidence>
```
`verdict`, `confidence`, `kind` and `agreeingReleases` are all carried
*verbatim* per the module's "no invention" contract, meaning a value
containing a space (e.g., an operator hand-editing `recovery/PROVENANCE.md`
to add a two-word Verdict) would make the line visually ambiguous — a human
skimming the comment cannot always tell where `verdict=` ends and the next
`confidence=` field name begins, since there is no quoting or escaping
applied to any of these four fields (only `evidence` goes through
`assertExportableCommentText`, which forbids embedded line breaks but not
spaces or the literal substring ` confidence=`). This is a purely cosmetic/
readability concern — it does not affect assembled bytes, the export never
re-parses its own output, and a `PROVENANCE LEDGER AMBIGUITY` marker still
correctly reports the true row count regardless — so it is recorded as
informational rather than a functional defect.
**Fix:** None required for correctness; consider documenting that
Verdict/Confidence/Kind are expected to be single space-free tokens by
convention (as `renderLedger()`'s own vocabulary currently produces), or
quote each field if a future ledger vocabulary ever grows a value containing
a space.

---

_Reviewed: 2026-09-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
