---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
reviewed: 2026-09-15T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/mcp/vice/anno-coverage.test.ts
  - src/mcp/vice/anno-derive.test.ts
  - src/mcp/vice/anno-export-asm.test.ts
  - src/mcp/vice/anno-graphics.test.ts
  - src/mcp/vice/anno-index.test.ts
  - src/mcp/vice/anno-join.test.ts
  - src/mcp/vice/anno-overlap.test.ts
  - src/mcp/vice/anno-seam.test.ts
  - src/mcp/vice/anno-store.test.ts
  - src/mcp/vice/anno-store.ts
  - src/mcp/vice/anno-types.test.ts
  - src/mcp/vice/block-class.test.ts
  - src/mcp/vice/capture-predicate.test.ts
  - src/mcp/vice/capture-predicate.ts
  - src/mcp/vice/dxa-blocks.ts
  - src/mcp/vice/evid-ingest.ts
  - src/mcp/vice/evid-report-keys.test.ts
  - src/mcp/vice/memmap-lookup.ts
  - src/mcp/vice/prg-image.test.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/vsf-slice.test.ts
findings:
  critical: 0
  warning: 8
  info: 0
  total: 8
status: issues_found
---

# Phase 56: Code Review Report

**Reviewed:** 2026-09-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 56 removed `shipped-modules.ts` and 116 test cases whose subject was the TEXT of a
source file rather than its runtime behaviour. I read the full diff for all 21 files against
the phase's start (`5334e21c^`) and the end (`dac616d6`), cross-checked every removed test's
own doc comment against its assertions, and scanned the surviving files for leftover
structural damage.

**What the phase got right, confirmed by direct inspection:** all five production-file comment edits
(`anno-store.ts`, `capture-predicate.ts`, `dxa-blocks.ts`, `evid-ingest.ts`,
`memmap-lookup.ts`) are comment-only — no executable line changed in any of them. I sampled
every removed test whose name sounded ambiguous (behavioural vs. structural) and confirmed
each one's own comment states it is reading source text, not exercising a function. None of
the sampled removals took real behavioural coverage with it. Where a single test mixed a
behavioural half with a structural half (`anno-store.test.ts`'s "the reserved bank field is
never INTERPRETED" case), the phase correctly split it: kept and renamed the behavioural half,
cut only the structural half. `stock-dispatch.test.ts`'s large `vice-proxy.ts`
structural-assertion block was removed as a clean, self-contained tail with no helper left
dangling.

**What is wrong:** a systemic pattern of stale file-header comments that still describe a
structural check as present after the phase deleted it outright, in five separate files. One
dead, self-referential constant. One dead import. Two of the five stale-header files still
carry orphaned numbered section markers ("4. Import purity", "9-12. Properties of the one seam
module itself") with nothing under them.

## Warnings

### WR-01: File header for `anno-seam.test.ts` describes structural content the phase deleted in full

**File:** `src/mcp/vice/anno-seam.test.ts:1-13`
**Issue:** The file's own opening comment says: "the structural assertion that STORE-07's
confinement is REAL rather than promised: `node:sqlite` is named by exactly ONE module of the
shipped module set, **all four of its working access routes are proven catchable** by the one
predicate the real scan uses, and a comment-only mention is proven not to count... diverging
from it in exactly TWO places -- **both stated below**." Every test this paragraph describes —
the real assertion, all four planted-violation routes, the negative control, the non-vacuity
controls, the seam-private-export scan, the idempotency and CAS-integrity checks, the two
"DIVERGENCE" explanations "stated below" — was deleted by this phase. The file now contains
exactly two tests (`package.json files[] ships every anno-*...` and the `WR-25` behavioural
refusal check), neither of which is what the header describes. A reader trusting this header
would believe `node:sqlite` confinement is still test-enforced. It is not.
**Fix:** Rewrite the header to describe only the two surviving tests, or add a note stating the
confinement scan was removed in phase 56 and is no longer test-enforced (matching the "keep the
constraint, drop the credit" treatment already applied to `anno-store.ts`'s comments).

### WR-02: Orphaned numbered section markers left in `anno-seam.test.ts`

**File:** `src/mcp/vice/anno-seam.test.ts:29-41, 100-104`
**Issue:** Section headers "1. The real assertion" (line 29-31), "2-5. The four planted access
routes, all through the same predicate" (33-35), "6. The negative control" (37-39), "9-12.
Properties of the one seam module itself" (100-104) each introduce zero code — the next thing
after each is either another section header or an unrelated later test. These are dead
scaffolding left behind when the content under them was deleted.
**Fix:** Delete the orphaned section-header comment blocks, or renumber the remaining two
sections ("7-8" and the `WR-25` test) so the numbering is contiguous and accurate.

### WR-03: File header for `block-class.test.ts` names a load-bearing test that no longer exists

**File:** `src/mcp/vice/block-class.test.ts:1-19`
**Issue:** The header states: "Two of these are structural rather than behavioural and are the
**load-bearing ones**: — the IMPORT-PURITY assertion. `block-class.ts`'s header trap 1
records that giving the classifier the census, the raw bytes, a decoder or a confidence grade
would collapse the bytes-versus-store independence axis QUIETLY... A prohibition that only a
header states is a prohibition a future edit does not see, so **it is asserted here** from the
module's own source." The import-purity test (`block-class.ts imports nothing census-side...`)
and the module-level-mutable-binding test were both deleted (diff shows them removed at what is
now line 327 in the current file). The exact hazard this header describes — a future edit
importing `anno-`, `disasm-`, `stock-`, etc. into `block-class.ts` and nothing noticing — is now
real again: nothing in the test suite catches it, and the header falsely claims otherwise.
**Fix:** Update the header to drop the "asserted here" claim, or restore a minimal import-purity
regression test if the invariant is still meant to be test-enforced.

### WR-04: Orphaned section header "4. Import purity" left empty in `block-class.test.ts`

**File:** `src/mcp/vice/block-class.test.ts:324-327`
**Issue:** Section header "4. Import purity -- see this file's header for why this is a test
and not a comment" is immediately followed by section "5. Shipped, not test-only" with no test
between them. Both tests that constituted section 4 were deleted, and the header text pointing
back at the file's own docstring (see WR-03) is now describing nothing.
**Fix:** Delete the empty section-4 header block, or renumber section 5 down to 4.

### WR-05: File header for `prg-image.test.ts` describes a structural check that was deleted whole

**File:** `src/mcp/vice/prg-image.test.ts:1-28`
**Issue:** The header states this file contains "the committed regression for `prg-image.ts`'s
two input validators, plus the payload round trip its own doc comment says it exists to allow,
**plus a structural check that the module really is the pure, I/O-free thing its header
claims**," followed by a full paragraph titled "WHY THE NO-I/O CHECK IS STRUCTURAL AND NOT A
CLAIM IN A COMMENT" that argues at length for why that check matters ("A header sentence cannot
notice when a later edit falsifies it. Asserting the module's own import set from its source
can."). Both tests that made up that check (`prg-image.ts imports exactly one module...` and
`prg-image.ts performs no filesystem, subprocess or network I/O`) were deleted along with their
supporting `HERE`/`MODULE_PATH`/`codeOnly` imports. The file now contains only the four
behavioural tests. The "structural check" the header spends a full paragraph justifying does
not exist.
**Fix:** Remove the "plus a structural check..." clause and the "WHY THE NO-I/O CHECK IS
STRUCTURAL" paragraph from the header, or reinstate a minimal purity check.

### WR-06: File header for `evid-report-keys.test.ts` describes a scanning technique the file no longer uses

**File:** `src/mcp/vice/evid-report-keys.test.ts:1-29`
**Issue:** The header has a dedicated paragraph, "WHY THIS FILE READS SOURCES WITH
`readFileSync`/`codeOnly()` RATHER THAN SHELLING OUT TO A TEXT SEARCH... `shippedTsModules()`
... is the scanned set; `codeOnly()` is the one comment-and-string stripper every structural
guard in this directory shares." This describes "Direction 4" (`no runtime data branch`), which
was deleted along with its `codeOnly`/`shippedTsModules` import. The file now has three
directions (scope completeness, banned keys, denominator adjacency) plus the ships-nothing
check. None of them uses `readFileSync`/`codeOnly()` the way the header describes (the surviving
`readFileSync` calls only read `package.json`, not other shipped modules). The paragraph now
explains a design decision for code that is not in the file.
**Fix:** Remove the "WHY THIS FILE READS SOURCES..." paragraph, or restate it as history ("this
file used to read sources with codeOnly(). That direction was removed in phase 56").

### WR-07: File header for `anno-derive.test.ts` claims a "structural" half that was removed in full

**File:** `src/mcp/vice/anno-derive.test.ts:11-15`
**Issue:** "THE NEVER-CACHED CONTROL has two halves and **both are here**: behavioural (six
observations of the store file, the snapshot ring and the revision, all unchanged across
repeated derived queries) and **structural** (the derivation modules' stripped source, plus a
directory-wide census of SQL write sites against a NAMED expected set)." All five structural-half
tests ("...stripped source carries no SQL write verb", "...name no filesystem write call...",
"MCP-02: the derivation modules import none of the three host-path seam modules", "...the
tree's SQL write sites are exactly the named expected set", "...the census can actually SEE a
planted write site") were deleted along with the `codeOnly`/`shippedTsModules` import and the
`HERE` constant. Only the behavioural half remains. The header's claim "both are here" is false.
**Fix:** Update the sentence to describe only the behavioural half, or note that the structural
half was removed in phase 56.

### WR-08: Vestigial constant and dangling forward-reference in `anno-coverage.test.ts`

**File:** `src/mcp/vice/anno-coverage.test.ts:688-706, 759`
**Issue:** `CENSUS_FORBIDDEN_BLOCK_LITERALS` (line 704) carries a 16-line doc comment explaining
that it exists to scope "the absence supplement below" — i.e. the deleted test `SUPPLEMENT (not
the proof): the census module's source carries no production block-type literal`, which was the
constant's only real consumer (it iterated `CENSUS_FORBIDDEN_BLOCK_LITERALS` to scan
`anno-coverage.ts`'s own source for forbidden literals). That test was removed by this phase and
the constant was not removed with it. Its only remaining reference (line 762, inside a
surviving, unrelated test) is a self-check that the constant's own derivation subtracted
exactly `["code", "undefined"]` — i.e. the constant is now kept alive purely to test a property
of itself, with no consumer left that uses it for its stated purpose. The comment at line 759,
"The absence supplement's own non-vacuity," and the doc comment at lines 698-699, "The absence
supplement below therefore cannot speak about those two," both still reference a test that no
longer exists in this file.
**Fix:** Either delete `CENSUS_FORBIDDEN_BLOCK_LITERALS` and its self-check assertion entirely
(if the absence supplement is not coming back), or restore a minimal absence check that actually
consumes it. At minimum, fix the dangling "absence supplement below"/"absence supplement's
own" references.

### WR-09: Dead import left behind in `anno-overlap.test.ts`

**File:** `src/mcp/vice/anno-overlap.test.ts:82`
**Issue:** `import { mkdtempSync, readFileSync, rmSync } from "node:fs";` — `readFileSync` has
zero call sites anywhere in this file. Its only use was inside the deleted test `adjacency,
STRUCTURAL: no coalescing, merging or splitter identifier exists anywhere in the store's code`,
which read `anno-store.ts` via `readFileSync(join(HERE, "anno-store.ts"), "utf8")`. `noUnusedLocals`
is not enabled in this project's `tsconfig.json`, so this does not fail typecheck, but it is dead
code left by this phase's own removal.
**Fix:**
```diff
-import { mkdtempSync, readFileSync, rmSync } from "node:fs";
+import { mkdtempSync, rmSync } from "node:fs";
```

---

_Reviewed: 2026-09-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
