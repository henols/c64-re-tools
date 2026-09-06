---
status: complete
phase: 38-proof-01-03-on-real-cracked-code
source: [38-01-SUMMARY.md, 38-02-SUMMARY.md, 38-03-SUMMARY.md, 38-04-SUMMARY.md]
started: 2026-09-06T11:37:21Z
updated: 2026-09-06T11:48:00Z
---

## Current Test

[testing complete]

## Tests

### 1. PROOF-01 real-release record reads honestly
expected: evidence/proof01-dxa-real-release.md frames Block A's 100.00 (24/24) as beside (not instead of) the 72.39 (97/134) fixture and 72.46 (100/138) pivot figures, with the BASIC-loader-stub denominator visible and the pivot non-reproduction cause labelled a hypothesis
result: pass

### 2. PROOF-03 bank-boundary record stands alone
expected: evidence/proof03-bank-boundary.md is readable end to end without opening any Phase 37 file -- it cites 37-06's two transcripts as prior art rather than depending on them -- and its "does not establish" section is honest that the fixture is synthetic
result: pass

### 3. PROOF-02 loader-stage record scopes its claims
expected: evidence/proof02-loader-stage.md scopes every claim to the loader/depacker depth actually searched, and presents Phase 36's BRK-trick finding as a different mechanism sitting alongside -- not as an answer to PROOF-02's own computed-dispatch question
result: pass

### 4. PROOF-02 depacked capture states its oracle beside the numbers
expected: evidence/proof02-depacked-capture.md puts the two-term (PC, hit_count) oracle statement -- with the frame term recorded, not asserted -- beside the numbers it qualifies, not in a closing footnote; and presents PROOF02_DEPACK_PROGRESS (40511/45072 inside range, 10581/20464 outside) as depth-of-run evidence, not a whole-game claim
result: pass

### 5. PROOF-02 roll-up frames not-exercised honestly
expected: evidence/proof02-computed-dispatch.md frames a not-exercised verdict as a statement about the corpus at the depths searched -- not a clean bill of health -- and does not gloss over that no entry points were supplied to the depacked-depth Ghidra run
result: pass

### 6. Outcome-line vocabulary committed before measurement
expected: Outcome-line vocabulary for all three proofs (57 names) committed in SCHEMA.md before any measurement, each with a value domain and single declared source file
result: pass
source: automated
coverage_id: 38-01/D1

### 7. TEST_AUTOMATED_BASELINE measured with broker stopped
expected: TEST_AUTOMATED_BASELINE measured with the broker stopped and recorded in README.md, cited (never re-derived) by later files
result: pass
source: automated
coverage_id: 38-01/D2

### 8. PROOF-01 comparator ships as a tested src/ module
expected: dxa-proof01-compare.ts ships as a tested src/ module, never reads the filesystem or spawns a process, joins DumpListingMap against ByteDerivedPartition
result: pass
source: automated
coverage_id: 38-01/D3

### 9. PROOF-03 direction 1 -- same address annotates differently per bank
expected: The same $D020 address annotates differently under $34 (RAM) vs $33 (Character ROM), confirmed by direct string inequality
result: pass
source: automated
coverage_id: 38-02/D1

### 10. PROOF-03 direction 2 -- committed branch declines, mutated branch is confidently wrong
expected: The committed decline branch declines with a reason naming both values; a scratch-mutated forward-carry annotates confidently and wrongly at the same address
result: pass
source: automated
coverage_id: 38-02/D2

### 11. PROOF-03 all four constWrites shapes exercised
expected: All four constWrites shapes (absent, empty, agreeing-values, disagreeing-values) exercised and recorded against JoinDecision.outcome's own vocabulary, plus the decisions[]/decline-reason ordering rule
result: pass
source: automated
coverage_id: 38-02/D3

### 12. Ghidra-independent $6C site enumerator
expected: Ghidra-independent $6C (JMP abs) site enumerator: linear byte scan, four-bucket classification, dxa cross-check as annotation never a filter, deterministic --json output, no Ghidra-export read and no child-process import
result: pass
source: automated
coverage_id: 38-03/D1

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
