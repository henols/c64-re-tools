---
phase: 38-proof-01-03-on-real-cracked-code
reviewed: 2026-09-05T19:27:32Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/mcp/vice/dxa-proof01-compare.ts
  - src/mcp/vice/dxa-proof01-compare.test.ts
  - src/mcp/vice/hostpath-consumers.test.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-09-05T19:27:32Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed `dxa-proof01-compare.ts` (new pure comparator), its colocated hermetic test, and the one-line floor bump in `hostpath-consumers.test.ts`.

The comparator itself is correct and matches its stated contract: `compareByteDerivedRecovery()` computes a fixed `denominator = certainCode.size + certainData.size`, buckets every `certainData` address into exactly one of `recoveredAddresses`/`missedAddresses`/`overlapAddresses` (verified: `dxa-listing.ts`'s own `DumpListingMap.unclassified` doc guarantees an address is never simultaneously in `data`, so the unclassified-checked-first ordering cannot silently misclassify a real input), sorts every address array ascending after collecting it (so output is independent of `Set` iteration order — confirmed live by running the test suite), and `renderProof01Report()` guards the zero-denominator case before calling `formatPercent()` (which itself throws on a zero denominator), so the documented "never 0.00/NaN/100.00" refusal guarantee holds. Ran `node --test dxa-proof01-compare.test.ts` and `node --test hostpath-consumers.test.ts` (all 6 and all 22 cases pass respectively) and `tsc --noEmit` (clean). Verified the `HOST_TOOL_FAMILY_FLOOR` arithmetic (`2+1+2+2+1+1=9`) against a live directory listing of `^(host-tool|ghidra|dxa)(-[A-Za-z0-9-]*)?\.(ts|mts)$` matches — the raise is correct and non-vacuous, and the companion "pinned-equals-measured" test still asserts equality rather than a trivially-true inequality.

Three findings below are test-robustness and documentation-accuracy gaps rather than functional defects in the shipped comparator's happy-path behavior.

## Warnings

### WR-01: Stale line citation baked into a printed evidence string

**File:** `src/mcp/vice/dxa-proof01-compare.ts:16-22,60-61`
**Issue:** The module header quotes a block from `dxa-partition.ts` and cites it as `dxa-partition.ts:462-464`. The actual quoted JSDoc block (`/** The byte-derived ground-truth partition. ... source-derived tier's. */`) sits at `dxa-partition.ts:463-467`, confirmed by `grep -n`:
```
463:/** The byte-derived ground-truth partition. `certainCode` is ALWAYS empty
464: * (A-09: this tier decides exactly two facts, and neither is ever code) --
465: * it exists as a field purely so the denominator discipline (`certainCode
466: * .size + certainData.size`, never the image size) reads identically to the
467: * source-derived tier's. */
```
Line 462 is blank; the cited range `462-464` covers only the first two lines of the five-line quote and misses the closing `*/`. This is not the CLAUDE.md-tracked `rewriteArguments()` citation (a different, already-known-to-drift reference) — it is this module's own citation, wrong since the commit that introduced it (`dxa-partition.ts`'s `ByteDerivedPartition` doc block has not moved since Phase 35; git history shows no intervening edit). The same wrong range is also baked into the exported, printed constant:
```ts
export const PROOF01_FALSE_POSITIVES_REFUSAL =
  "structurally-uncomputable (certainCode.size is 0 on the byte-derived tier -- see dxa-partition.ts:462-464)";
```
so the inaccurate citation ships into every PROOF-01 evidence artifact this string is printed into, undermining the "checked against the source" traceability this module's own header otherwise insists on.
**Fix:** Correct both citations to `dxa-partition.ts:463-467`.
```ts
export const PROOF01_FALSE_POSITIVES_REFUSAL =
  "structurally-uncomputable (certainCode.size is 0 on the byte-derived tier -- see dxa-partition.ts:463-467)";
```

### WR-02: The filesystem/process-spawn structural guard uses narrow regexes that miss bare-specifier and dynamic-import forms

**File:** `src/mcp/vice/dxa-proof01-compare.test.ts:220-226`
**Issue:** Behavior 6 asserts the module never imports `node:fs` or `node:child_process`, using exactly five patterns:
```ts
const bannedImportPatterns = [
  /from\s+["']node:child_process["']/,
  /require\(\s*["']child_process["']\s*\)/,
  /from\s+["']node:fs["']/,
  /from\s+["']node:fs\/promises["']/,
  /require\(\s*["']fs["']\s*\)/,
];
```
Node accepts both the `node:`-prefixed and bare forms of these built-ins (`import { readFileSync } from "fs"` and `import { spawnSync } from "child_process"` both work without the `node:` prefix). None of the five patterns catch: a bare `from "fs"` or `from "fs/promises"` static import, a bare `from "child_process"` static import, a `require("node:fs")` / `require("node:child_process")` call, or any dynamic `import("fs")` / `import("child_process")` / `import("node:fs")` form. A future edit to this module that reintroduces filesystem or process access through any of these unguarded forms would pass this test silently, defeating the very guarantee ("no filesystem read, no process spawn" — the module's own header, restated as SEAM-05 discipline) this test exists to enforce structurally. The sibling test `dxa-listing.test.ts` uses a strictly broader, simpler check for the same property (`/child_process/.test(source)`, a bare substring match with no prefix or call-shape assumption at all), which this test's own five-pattern list is a step backward from.
**Fix:** Broaden the guard to a substring/bare-name check per module, mirroring `dxa-listing.test.ts`'s pattern, e.g.:
```ts
for (const banned of ["child_process", "node:fs", '"fs"', "'fs'"]) {
  assert.equal(source.includes(banned), false, `must never reference ${banned}`);
}
```
or at minimum add the missing bare-specifier and dynamic-import variants to the existing pattern list.

### WR-03: No test exercises a non-empty `certainCode`, so the denominator formula's second term is unverified

**File:** `src/mcp/vice/dxa-proof01-compare.test.ts:38-50` (via `makeGroundTruth`), `dxa-proof01-compare.ts:122`
**Issue:** `compareByteDerivedRecovery()` computes `denominator = groundTruth.certainCode.size + groundTruth.certainData.size`, and the module's own header stresses this sum (mirroring `dxa-partition.ts`'s own denominator discipline) as load-bearing. Every test in the suite calls `makeGroundTruth(certainData, certainCode = [])` and never passes a non-empty `certainCode` array — so `certainCode.size` is `0` in all six test cases, and the denominator is, in every test, indistinguishable from `certainData.size` alone. A regression that dropped `groundTruth.certainCode.size` from the sum (e.g. `denominator = groundTruth.certainData.size`) would still pass all six existing tests unchanged. This matters specifically because the design intent (`certainCode` "ALWAYS empty" on this tier) is an *upstream* invariant this module does not itself enforce or assert — the comparator's own correctness under a hypothetical non-empty `certainCode` (e.g. a future ground-truth tier, or a caller bug) is asserted only in prose, never in a test.
**Fix:** Add a case that passes a non-empty `certainCode`, e.g.:
```ts
test("denominator sums certainCode.size and certainData.size, not certainData.size alone", () => {
  const groundTruth = makeGroundTruth([0x0801], [0x0900, 0x0901]);
  const listing = makeListing({ data: [0x0801] });
  const comparison = compareByteDerivedRecovery({ listing, groundTruth });
  assert.equal(comparison.denominator, 3, "denominator must include certainCode.size (2) plus certainData.size (1)");
});
```

---

_Reviewed: 2026-09-05T19:27:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
