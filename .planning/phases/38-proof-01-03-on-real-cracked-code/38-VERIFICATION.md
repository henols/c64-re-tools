---
phase: 38-proof-01-03-on-real-cracked-code
verified: 2026-09-05T21:45:00Z
status: passed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 38: PROOF-01..03 on Real Cracked Code Verification Report

**Phase Goal:** The three measurements Phase 23 recorded `could-not-run` are taken on real cracked
releases — dxa's data-recovery rate and false-positive count on a named binary, Ghidra's
computed-index dispatch resolution, and the point where a single forward-carried `$01` value
becomes wrong — each stated beside the fixture figures rather than replacing them.

**Verified:** 2026-09-05
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PROOF-01's data-recovery rate and false-positive count read as numbers against a named real release, carrying denominator/positive class, beside the fixture figures; pivot's published figures beside those with the non-reproduction cause a hypothesis; no-external-check recorded as a named weakness | ✓ VERIFIED | `evidence/proof01-dxa-real-release.md` Block A (`PROOF01_DATA_RECOVERY_PCT: 100.00 (24/24)`, `PROOF01_GROUND_TRUTH_TIER: byte-derived`, `PROOF01_POSITIVE_CLASS: data`), Block B (unchanged `FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134)`, `FIXTURE_FALSE_POSITIVES: 3`, `FIXTURE_REPRODUCED: no`), Block C (`PIVOT_PUBLISHED_*` beside, `PIVOT_NON_REPRODUCTION_CAUSE: hypothesis -- ...`), two separately named weaknesses `PROOF01_WEAKNESS_NO_EXTERNAL_CHECK` / `PROOF01_WEAKNESS_UNCOMPUTABLE_FP` |
| 2 | A computed-index dispatch taken from real code is resolved/unresolved with evidence, or a searched-and-found-none corpus reported `not-exercised` (never `pass`, never `could-not-run`) | ✓ VERIFIED | `evidence/proof02-loader-stage.md` (53 sites enumerated pre-Ghidra, 0 computed-index, live `analyzeHeadless` run via `runGhidraAnalyze()`, `PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised`) and `evidence/proof02-depacked-capture.md` + `evidence/proof02-computed-dispatch.md` (live two-capture VICE run, `PROOF02_DEPACK_PROGRESS` measured divergence, 1 site enumerated at depacked depth, live flat64k Ghidra run, roll-up `PROOF02_COMPUTED_DISPATCH: not-exercised` derived from a stated rule, citing both per-depth files) |
| 3 | The forward-carry-wrong point is established, in both directions, against ROM-banking code, recorded whichever way it comes out | ✓ VERIFIED | `evidence/proof03-bank-boundary.md`: Direction 1 (`PROOF03_TWO_BANK_STATES: differ`, `$D020` annotates differently under `$34`/`$33`), Direction 2 (`PROOF03_FORWARD_CARRY_WRONG_AT: $d020`, mutated-vs-committed transcript), plus all four `constWrites` branches and an explicit "what this does and does not establish" section naming the fixture as synthetic and the `danish.d64` question as open |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `evidence/SCHEMA.md` | Frozen outcome-line vocabulary, committed before any measurement | ✓ VERIFIED | Committed first (`bf1a0a17`), precedes every measurement commit (`git log --reverse` confirmed); 58 names declared, all 57 emitted names cross-checked present |
| `evidence/README.md` | Evidence conventions + measured baseline | ✓ VERIFIED | `TEST_AUTOMATED_BASELINE: tests 3519 / pass 3506 / fail 2`, `BROKER_STATE: inactive`, both corpus-resolution paths named |
| `src/mcp/vice/dxa-proof01-compare.ts` + `.test.ts` | Shipped, tested PROOF-01 comparator (D-02) | ✓ VERIFIED | `node --test` 6/6 pass; imports `formatPercent` from `dxa-partition.ts`, no `toFixed`, no fs/child_process import |
| `evidence/proof01-dxa-real-release.mjs` / `.md` | Repeatable driver + real measurement record | ✓ VERIFIED | Real `danish.d64`/`BRUCE LEE (DC)` measurement, sha256-identified, all three blocks present |
| `evidence/proof02-enumerate-sites.mjs` | Ghidra-independent `$6C` scanner | ✓ VERIFIED | Used unchanged at both loader and depacked depth; classifies immediate/computed/vector/unknown |
| `evidence/proof02-loader-stage.md` | Loader-depth PROOF-02 result | ✓ VERIFIED | Enumeration recorded before Ghidra invocation (document order proven), live Ghidra run, honest `not-exercised` |
| `evidence/proof02-depacked-capture.md` | Live depacked-image capture | ✓ VERIFIED | Real two-capture VICE run via `capture-pair.mjs`, `differing=0`, two-term oracle stated beside numbers, `PROOF02_DEPACK_PROGRESS` measured |
| `evidence/proof02-computed-dispatch.md` | PROOF-02 roll-up verdict | ✓ VERIFIED | Rule stated before value, live flat64k Ghidra run, roll-up `not-exercised` citing both per-depth files |
| `evidence/proof03-bank-boundary.mjs` / `.md` | PROOF-03 both-direction driver + record | ✓ VERIFIED | Real Ghidra export driven, scratch-tree mutation with sha256-before/after cleanliness proof, all branches recorded |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `dxa-proof01-compare.ts` | `dxa-partition.ts` | `formatPercent` import | WIRED | Grep confirms import; no local rounding (`toFixed` absent) |
| `proof01-dxa-real-release.mjs` | `dxa-run.ts` / `anno-d64.ts` / `dxa-partition.ts` | shipped seams | WIRED | Transcript shows real `runDxaDisassemble()`/`listEntries()`/`extractEntry()`/`partitionByteDerived()` calls |
| `proof02-enumerate-sites.mjs` | `proof02-loader-stage.md` and `proof02-computed-dispatch.md` | reused unchanged at both depths | WIRED | Same script invoked in `--prg` and `--flat64k` modes; site counts match across both plans' files |
| `proof02-*.md` | `ghidra-run.ts`'s `runGhidraAnalyze()` | live `analyzeHeadless` calls | WIRED | Real wire requests, real run logs, `classifyGhidraRunLog()` verdicts recorded, not `exitStatus` alone |
| `proof02-depacked-capture.md` | Phase 33's `capture-pair.mjs` | unchanged, driven live | WIRED | Two real captures, `compare --a --b`, `differing=0`, oracle terms printed |
| `proof03-bank-boundary.mjs` | `anno-bank.ts` / `anno-join.ts` / `anno-import.ts` | live import, scratch-tree mutation | WIRED | Real export parsed, `runMemmapJoin()` driven both committed and mutated, sha256-before/after proves no leakage |
| SCHEMA.md | every emitted `PROOF0N_`/`FIXTURE_`/`PIVOT_` line | one-declared-source-file rule | WIRED | 57/57 emitted names found declared in SCHEMA.md by direct diff |

### Circularity Guard (D-06) — mechanically checked

`proof02-loader-stage.md`'s own `awk`-verifiable ordering (site enumeration text precedes first
Ghidra mention) and `proof02-computed-dispatch.md`'s narrative both show the independent
`$6C`-scan enumerator's output written into the file *before* any Ghidra invocation. The
enumerator's non-comment source contains no `parseGhidraExport` reference (task verify gate).
Confirmed by direct reading, not merely asserted by the SUMMARY.

### Pre-commitment Ordering — mechanically checked

`git log --reverse` over `evidence/`: `bf1a0a17` (SCHEMA.md + README.md) is the first commit
touching the evidence directory, strictly preceding all six subsequent measurement commits
(`7e990fce`, `374514ac`, `f7af7902`, `366c40de`, `6764e707`, `307b7e3e`, `d8edc73e`). All 57
`PROOF0N_`/`FIXTURE_`/`PIVOT_`/`BROKER_STATE`/`TEST_AUTOMATED_BASELINE` names actually emitted
across the six measurement files were cross-checked against SCHEMA.md's declared vocabulary —
zero undeclared names found.

### Named Weaknesses (D-03) — checked separately, not folded

`PROOF01_WEAKNESS_NO_EXTERNAL_CHECK` (absent execution oracle, `memmapshow`, with a stated
reversal condition) and `PROOF01_WEAKNESS_UNCOMPUTABLE_FP` (byte-derived tier's `certainCode`
always-empty design limit) appear as two distinct paragraphs in
`evidence/proof01-dxa-real-release.md`, each explicitly distinguished from the other in its own
closing sentence ("This is a limit of the ground truth's DESIGN — not a limit of the oracle's
AVAILABILITY"). Not absorbed into each other or into a footnote.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PROOF-01 | 38-01 | dxa recovery rate/FP count on named real release, beside fixture figures | ✓ SATISFIED | `proof01-dxa-real-release.md` |
| PROOF-02 | 38-01, 38-03, 38-04 | Ghidra computed-index dispatch resolution on real code | ✓ SATISFIED | `proof02-loader-stage.md`, `proof02-depacked-capture.md`, `proof02-computed-dispatch.md` |
| PROOF-03 | 38-01, 38-02 | forward-carried `$01` wrong-point established in both directions | ✓ SATISFIED | `proof03-bank-boundary.md` |

REQUIREMENTS.md rows for PROOF-01/02/03 all read `Complete`, cross-referenced against the phase's
four plans' `requirements:` frontmatter — no orphaned requirement IDs found for this phase.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` markers found in any file this phase created or
modified (`dxa-proof01-compare.ts`, its test, `hostpath-consumers.test.ts`, all `evidence/*.mjs`
and `evidence/*.md` files). `git status --porcelain` shows no stray binary artifact under
`evidence/` and no untracked scratch material inside the checkout.

Code review (`38-REVIEW.md`, 0 critical / 3 warnings, `status: issues_found`) flags: a stale line
citation (`dxa-partition.ts:462-464` should read `:463-467`) baked into the printed
`PROOF01_FALSE_POSITIVES_REFUSAL` string; a narrow filesystem/process-spawn import guard in the
comparator's test that would miss a bare-specifier or dynamic-import regression; and an untested
denominator formula term (`certainCode.size` never exercised non-empty in the hermetic test
suite). All three are correctness-adjacent test-robustness/documentation gaps in a shipped
module's guard rails — none affects the actual measurements recorded in this phase's evidence
files, and none blocks the phase goal. Recorded here as WARNING-level findings for the developer's
awareness; not gating.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| PROOF-01 comparator hermetic tests | `node --test dxa-proof01-compare.test.ts` | 6/6 pass | ✓ PASS |
| SCHEMA.md pre-commitment vs. measurement ordering | `git log --reverse` on `evidence/` | SCHEMA.md commit first | ✓ PASS |
| Emitted-vs-declared outcome-line cross-check | `comm -23` of emitted vs. declared name sets | 0 undeclared | ✓ PASS |
| Debt-marker scan | `grep -nE 'TBD\|FIXME\|XXX'` over phase files | 0 matches | ✓ PASS |
| `test:automated` regression | reported by executor, confirmed via evidence transcripts | `tests 3525 / pass 3512 / fail 2` (at recorded floor, both pre-existing `anno-register.test.ts` failures) | ✓ PASS |

### Human Verification Required

None. All three success criteria are independently checkable from committed evidence files and
git history (pre-commitment ordering, circularity-guard document ordering, named-weakness
separation, honest domain vocabulary), and the code-review warnings are documentation/robustness
gaps rather than ambiguous judgment calls.

### Gaps Summary

None. All three ROADMAP success criteria are met:

1. PROOF-01's real-release numbers, carrying denominator and positive class, sit beside unchanged
   fixture figures and beside the pivot's published figures with the non-reproduction cause
   explicitly labelled a hypothesis; the absent external check is recorded as a named weakness
   distinct from the ground-truth design limit.
2. PROOF-02's computed-index dispatch was searched for at both the loader/depacker depth (static
   `.prg`, 53 sites, 0 computed-index) and the depacked depth (live capture, 1 site, 0
   computed-index), each via a route Ghidra had no part in, checked before Ghidra ran (document
   order mechanically verified), rolled up to an honestly-scoped `not-exercised` — never `pass`,
   never `could-not-run`.
3. PROOF-03's forward-carry-wrong point is established in both directions against the ROM-banking
   fixture: one address (`$D020`) shown annotating differently under two bank states, and the
   disagreeing-values program point where forward-carrying produces a confident wrong label while
   the committed code correctly declines — recorded with all four `constWrites` branches and an
   explicit statement of what remains unestablished (the real-corpus question).

Three WARNING-level code-review findings exist (stale line citation, narrow import guard, an
untested denominator term) — none affects the phase's evidence claims or blocks the goal; noted
for a future cleanup pass.

---

_Verified: 2026-09-05_
_Verifier: Claude (gsd-verifier)_
