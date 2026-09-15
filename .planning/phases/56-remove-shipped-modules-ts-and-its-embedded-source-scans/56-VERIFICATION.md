---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
verified: 2026-09-15T00:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 56: Remove `shipped-modules.ts` and Its Embedded Source Scans Verification Report

**Phase Goal:** `src/mcp/vice/shipped-modules.ts` is removed. Every remaining test assertion
that reads a production module's own source and asserts on that text is removed with it.
**Verified:** 2026-09-15
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (SC-1..SC-5, verbatim from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | `shipped-modules.ts` no longer exists, nothing imports it | ✓ VERIFIED | `ls src/mcp/vice/shipped-modules.ts` returns ENOENT. `grep -rn "shipped-modules" src/` finds only two comment-only mentions (`vice-proxy.test.ts:3488`, `hostpath-consumers.test.ts:624`). It finds zero `import` lines and zero `from "./shipped-modules` lines anywhere. This verifier confirmed all 16 previously-importing test files one by one. Each file has zero mentions. |
| SC-2 | No real coverage removed as collateral. Both numbers reported separately | ✓ VERIFIED | This verifier computed the numbers independently, not from SUMMARY prose. `git diff 188ca931 HEAD` (188ca931 is the commit immediately before 56-01's first test commit) over the 16 surviving files shows 104 removed `test(` lines and 4 added `test(` lines (renames). The net is 100. This matches the phase's own claimed "100 embedded cases" exactly. `shipped-modules.test.ts` itself lost 16 `test(` lines on removal. This matches the claimed "16 whole-file cases" exactly. This verifier hand-read a sample of removed case bodies in `anno-coverage.test.ts` (PIN 4, PIN 8), `stock-dispatch.test.ts`, `anno-store.test.ts`, and `anno-overlap.test.ts`. Every sampled removal's entire subject was a `readFileSync`/`codeOnly()`-style scan of a module's own source text. None called a real production function for its assertion. This verifier also sampled the 4 renamed (strip-in-place) cases: `anno-store.test.ts`'s "reserved bank field," `anno-types.test.ts`'s SCHEMA_VERSION case, and `stock-dispatch.test.ts`'s WR-06 case and its anno_* curation case. All four keep a genuinely behavioural half. All four correctly drop only the source-text half. |
| SC-3 | `test:automated` green, `typecheck` exits 0, drop reconciled | ✓ VERIFIED | This verifier ran both commands directly, not from SUMMARY claims. `npm run test:automated` returned `EXIT=0, tests 3637, pass 3628, fail 0, skipped 9`. `npm run typecheck` returned `EXIT=0`. These numbers match the orchestrator's own baseline-to-final measurement (3753 to 3637, net drop 116). They also match this verifier's own independent git-diff arithmetic (100 embedded plus 16 whole-file equals 116). |
| SC-4 | No test file left empty or setup-only | ✓ VERIFIED | This verifier confirmed all 16 touched files directly. Every file has a non-zero `test(` count (2 to 185) and a non-zero `assert.` count (8 to 694). No file is empty. No file is setup-only. |
| SC-5 | `anno-seam.test.ts`'s WR-25 case survives | ✓ VERIFIED | This verifier ran `node --test --test-reporter=tap anno-seam.test.ts` directly, not by grepping for the case name. Result: 2 tests, 2 pass, 0 fail — the `package.json files[]` case and `"WR-25: the guard itself exists -- openStore refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied"`. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/shipped-modules.ts` | removed | ✓ VERIFIED | Confirmed absent. `git show --name-status c179b272` shows status `D`. |
| `src/mcp/vice/shipped-modules.test.ts` | removed | ✓ VERIFIED | Confirmed absent. Same commit, status `D`. |
| 16 surviving test files (`anno-coverage.test.ts` … `vsf-slice.test.ts`) | reduced, not gutted | ✓ VERIFIED | All 16 present. All green. All carry surviving assertions (see SC-4 table). |
| 5 production files (`anno-store.ts`, `capture-predicate.ts`, `dxa-blocks.ts`, `evid-ingest.ts`, `memmap-lookup.ts`) | comment-only D-11 repairs | ✓ VERIFIED | `git diff 188ca931 HEAD` for all five shows deletions only inside comment blocks. No executable line changed. |

### Key Link Verification

Not applicable in the conventional sense. This phase has no component-to-API wiring. The
equivalent check is whether removing an import leaves a dangling reference. The green
`typecheck` run confirms it does not (a dangling reference would fail typecheck). The direct
grep census above confirms the same thing from the other direction.

### Independent Reconciliation (SC-2/SC-3 — this verifier's own measurement, not SUMMARY-derived)

```
Baseline (188ca931, immediate parent of 56-01's first commit):
  Per-file test( removed/added, git diff 188ca931 HEAD:
    anno-coverage.test.ts     removed=16 added=0
    anno-derive.test.ts       removed=5  added=0
    anno-export-asm.test.ts   removed=11 added=0
    anno-graphics.test.ts     removed=2  added=0
    anno-index.test.ts        removed=3  added=0
    anno-join.test.ts         removed=1  added=0
    anno-overlap.test.ts      removed=1  added=0
    anno-seam.test.ts         removed=21 added=0
    anno-store.test.ts        removed=13 added=1
    anno-types.test.ts        removed=2  added=1
    block-class.test.ts       removed=2  added=0
    capture-predicate.test.ts removed=2  added=0
    evid-report-keys.test.ts  removed=2  added=0
    prg-image.test.ts         removed=2  added=0
    stock-dispatch.test.ts    removed=17 added=2
    vsf-slice.test.ts         removed=4  added=0
  TOTAL removed=104 added=4 net=100  (phase claims 100 -- MATCH)
  shipped-modules.test.ts removed=16 (phase claims 16 -- MATCH)
  100 + 16 = 116 = 3753 - 3637 (orchestrator's own measured drop -- MATCH)
```

This verifier's own test run returned `EXIT=0, tests 3637, pass 3628, fail 0, skipped 9`. This
is identical to the orchestrator's post-56-11 measurement.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full automated suite green | `npm run test:automated` (src/mcp/vice) | EXIT=0, tests 3637, fail 0, skipped 9 | ✓ PASS |
| Typecheck clean | `npm run typecheck` (src/mcp/vice) | EXIT=0 | ✓ PASS |
| WR-25 survives, run directly | `node --test --test-reporter=tap anno-seam.test.ts` | 2/2 pass, WR-25 present | ✓ PASS |
| Manual-only regression unaffected (D-13's `vice-proxy.test.ts` stale mention is comment-only) | `node --test vice-proxy.test.ts` | tests 56, pass 53, fail 0, skipped 3 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SC-1 | 56-01..56-11 | `shipped-modules.ts` removed, no importers | ✓ SATISFIED | See truths table |
| SC-2 | 56-01..56-11 | No collateral coverage loss, two numbers reported | ✓ SATISFIED | Independently reconciled (100 + 16), sample-verified |
| SC-3 | 56-01..56-11 | Green suite, clean typecheck, reconciled drop | ✓ SATISFIED | Re-run independently, EXIT=0 both |
| SC-4 | 56-01..56-11 | No empty/setup-only files | ✓ SATISFIED | Checked all 16 files directly |
| SC-5 | 56-02, 56-11 | WR-25 survives | ✓ SATISFIED | Ran the file directly |

REQUIREMENTS.md records all five as `Complete` under Phase 56. Its coverage summary block
explains the `SC-N` naming choice. This verifier found no orphaned requirement IDs. SC-1..SC-5
is the complete declared set, and all five are claimed by at least one plan's
`requirements-completed` frontmatter.

### Anti-Patterns Found

| File | Line(s) | Pattern | Severity | Impact |
|------|---------|---------|----------|--------|
| `src/mcp/vice/anno-store.test.ts` | 2489, 2500, 4560 | Stale comment claims `anno-seam.test.ts` still "pins all three structurally," still enforces a "structural CAS assertion," and still "bounds the set of TEST files naming the SQLite builtin to a declared list" (`TEST_FILES_NAMING_SQLITE`). This phase (56-02) removed all three. | ⚠️ Warning | Comment-only. `grep` for the removed symbol names returns zero code hits. `typecheck` and `test:automated` are both green, so no test result depends on this text. This is the same "overclaim" pattern the phase's own code review found and fixed in five other files (WR-01/03/05/06/07). It was missed here even though `anno-store.test.ts` is inside the review's 21-file scope. |
| `src/mcp/vice/anno-confinement.test.ts` | 82 | Same pattern. The comment says "`anno-seam.test.ts`'s declared `TEST_FILES_NAMING_SQLITE` list is untouched." That list no longer exists. | ⚠️ Warning | Comment-only. This file sits outside phase 56's touched-file set and outside the code review's 21-file scope, so it was never in scope to be caught. |
| `src/mcp/vice/evid-ingest.test.ts` | 263-266 | Same pattern. The comment references "`anno-seam.test.ts`'s shipped-module-set scan" and its "`TEST_FILES_NAMING_SQLITE` declared list." Both are gone. | ⚠️ Warning | Comment-only. Outside phase 56's scope. |
| `src/mcp/vice/host-tool.test.ts` | 53 | Same pattern. The comment says "`anno-seam.test.ts`'s `TEST_FILES_NAMING_SQLITE` list is untouched." | ⚠️ Warning | Comment-only. Outside phase 56's scope. |

This verifier found no `TBD`/`FIXME`/`XXX` debt markers in any of the 21 phase-touched files.
This verifier also found no orphaned section-header chains (one header immediately followed by
another header) in any of the 16 surviving test files, beyond the two the code review already
fixed (`anno-seam.test.ts`, `block-class.test.ts`).

**Assessment:** None of these four findings touch a `test(...)` assertion. None changes runtime
behavior. `grep` confirms the removed symbol names (`SEAM_PRIVATE_EXPORTS`, `THE_ONE_SEAM`,
`TEST_FILES_NAMING_SQLITE`, `namesNodeSqlite`, `sqliteImporters`, `stripForSpecifierScan`,
`commitStatements(`) have zero remaining *code* references anywhere in `src/` — only these four
comment mentions. They do not violate SC-1 through SC-5 as literally stated. None of the five
success criteria address comment accuracy outside the module-import census. They do not regress
any test. They ARE a residual instance of the exact defect class the phase's own code review
targeted and fixed (5 instances). Three of the four new instances found here sit entirely
outside that review's declared 21-file scope. The fourth (`anno-store.test.ts`) sits inside that
scope but was missed. This verifier recommends a small follow-up commit that fixes these four
references the same way WR-01/03/05/06/07 were fixed. This does not block the phase goal as
stated.

### Human Verification Required

None. This verifier confirmed all five success criteria by direct command execution — a test run,
a typecheck run, a targeted single-file test run, and independent git-diff arithmetic. None was
checked by trusting SUMMARY.md prose alone.

### Gaps Summary

No gaps against the stated Success Criteria. SC-1 through SC-5 all hold, independently
re-measured rather than taken from SUMMARY claims. The orchestrator's own measured numbers
(3753 to 3637, EXIT=0 throughout) reproduce exactly under a fresh run.

One quality finding surfaced beyond the stated criteria. Four stale comments make a false claim
— one file inside the phase's own reviewed scope, three outside it. Each still claims
`anno-seam.test.ts` enforces a structural check that this phase removed. This is documented
above as a non-blocking Warning-level anti-pattern and a suggested follow-up. It is not a
phase-blocking gap.

---

_Verified: 2026-09-15_
_Verifier: Claude (gsd-verifier)_
