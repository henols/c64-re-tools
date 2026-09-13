---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
verified: 2026-09-13T13:45:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 49: The Reassembly Gate, Committed Before the Phase It Gates — Verification Report

**Phase Goal:** A gate that says whether an exported tree really rebuilds —
byte-diffed against the image, hazard report attached, movement exercised on
every run — with its pass/fail rules committed to git before its first real
run, and standing BEFORE the phase it gates rather than after it.

**Verified:** 2026-09-13
**Status:** passed
**Re-verification:** No — initial verification

**Important framing, stated up front so it is not misread below:** the
gate's own measured verdict is `red` (rule `R7`). This is **not** a phase
failure. The phase's deliverable is a working, honestly-derived gate and a
readable verdict — not a green verdict — and the ROADMAP's own phrasing for
this phase ("run for real — green, or explicitly acknowledged — before
Phase 50 begins") is a **precondition on Phase 50 starting**, not a success
criterion of Phase 49 itself. A gate that went green on its very first real
run, on a subject deliberately built to carry an unresolved hazard region,
would be the more suspicious outcome. All five ROADMAP success criteria
below were independently re-derived against the codebase, not read off
SUMMARY.md's narrative.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Decision rules + outcome vocabulary committed to git BEFORE any measurement, verdict is a machine-readable artifact Phase 50 reads | ✓ VERIFIED | `git log --diff-filter=A` on `evidence/SCHEMA.md` (`b6953618`) and `evidence/DECISION-RULE.md` (`4df0f567`) shows both added in one commit each, touching only themselves. All 5 measurement evidence files were added together in a single, strictly later commit (`ab07ee47`). `docs/phase49-the-reassembly-gate-findings.md` carries real YAML frontmatter (`verdict: red`, `verdict_rule_applied: R7`, all 7 `inputs.*` populated with real domain values and per-line citations) matching `SCHEMA.md` §5's fixed key order. |
| 2 | Verdict derived from byte-diff against exporter's `expectedBytes`; extends `acme-verify.ts`'s 3-outcome oracle; a test refuses a second independent verify path | ✓ VERIFIED | `verifyAcmeAssemblesTree()` (`acme-verify.ts:1041`) is documented and implemented as additive to `verifyAcmeAssembles()`, same byte-diff rule, same `AcmeOutcome` (`ok`/`failed`/`skipped`). `acme-seam.test.ts` freezes `ACME_SPAWN_SITES` and `EXPECTED_BYTES_COMPARISON_SITES` as both-direction set equalities over the whole server tree (not just this phase's own files) and asserts no `reassembly-gate*` module is a member of either. Re-ran `node --test acme-verify.test.ts reassembly-gate.test.ts acme-seam.test.ts reassembly-gate-ack.test.ts reassembly-gate-movement.test.ts reassembly-gate-run.test.ts`: 121/121 pass, exit 0, output byte-for-byte matches the evidence files' transcripts. |
| 3 | Gate observed going RED on 3 planted controls (wrong-byte, stale-output-path, hazard-adjacent range outside diff scope) before any green is trusted | ✓ VERIFIED | `evidence/49-red-controls.md` names all 3 controls with their exact test names; independently re-ran `node --test acme-verify.test.ts reassembly-gate.test.ts`: 67/67 pass including all 6 named planted-control cases (2 per control), matching the evidence transcript verbatim. `RED_CONTROLS: all-observed` sits at `R8` in `DECISION-RULE.md`, ahead of every passing rule (`R9`–`R11`), matching `reassembly-gate.ts`'s actual rule order. |
| 4 | Movement exercised on every run (not optional); same-address round trip refused; split hi/lo half-move without the other is caught | ✓ VERIFIED | `evidence/49-movement-rebuild.md`: `routine_a` relocated by a non-zero delta (261 bytes, `$080B`→`$0910`), re-exported, reassembled real ACME byte-identical. `reassembly-gate-movement.test.ts` has an explicit zero-delta-is-refused case and two split-table half-move cases ("...LOW-octet table site declared fails...", "...HIGH-octet table site declared fails..."), both grounded against `honestResult.expectedBytes` (the fully-relocated correct rebuild), never a self-diff of the half-patched tree against itself — confirmed by reading the test bodies directly (lines 568–614, 616–660). Both pass. |
| 5 | Non-clean hazard report either blocks the gate or passes only with explicit, recorded, per-finding acknowledgement — no silent-green path | ✓ VERIFIED | Real run against the committed hazard subject: 3 findings, all acknowledged by a frozen per-finding reasoned array; 1 undecided (`"unclassified"`) region left unacknowledged → `HAZARD_DISPOSITION: blocked`, not `acknowledged` — the harness's own comment states no entry is added to force a pass. `disposeHazardReport()` keys matching on the `(hazardClass, anchorAddress, mechanism)` triple, ambiguous matches treated as no-match. `R9` (blocks) and `R10` (requires acknowledged + every other input passing) in `reassembly-gate.ts` match `DECISION-RULE.md` verbatim. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `evidence/SCHEMA.md` | Frozen outcome-line vocabulary, committed first | ✓ VERIFIED | Added alone in `b6953618`, unedited since (per findings doc's own `git diff --quiet` check) |
| `evidence/DECISION-RULE.md` | Frozen 12-rule decision table, committed first | ✓ VERIFIED | Added alone in `4df0f567`; `reassembly-gate.ts`'s rule order and reason strings match this table verbatim |
| `evidence/49-tree-rebuild.md`, `49-movement-rebuild.md`, `49-hazard-disposition.md`, `49-red-controls.md`, `49-guards.md` | 5 measurement evidence files, each declaring its assigned outcome line(s) | ✓ VERIFIED (with a documentation-quality caveat, see Anti-Patterns) | All 7 outcome lines present at column 0, values reproduced by direct re-run |
| `src/mcp/vice/acme-verify.ts` (`verifyAcmeAssemblesTree`) | Tree-aware entry point, additive | ✓ VERIFIED | Present, wired, tested |
| `src/mcp/vice/reassembly-gate.ts` | Gate rule-table implementation | ✓ VERIFIED | 12 rules match `DECISION-RULE.md` exactly; excluded from `package.json` `files[]` |
| `src/mcp/vice/reassembly-gate-ack.ts` | Hazard disposition (`disposeHazardReport`) | ✓ VERIFIED | Present, wired, tested; excluded from `files[]` |
| `src/mcp/vice/reassembly-gate-movement.ts`, `reassembly-gate-movement-subject.ts` | Movement transform + subject | ✓ VERIFIED | Present, wired, tested; excluded from `files[]` |
| `src/mcp/vice/acme-seam.test.ts` | Second-path structural guard | ✓ VERIFIED | 14/14 cases pass; both frozen sets confirmed correct in both directions |
| `docs/phase49-the-reassembly-gate-findings.md` | Machine-readable verdict, Phase 50 precondition | ✓ VERIFIED | Correct frontmatter shape per `SCHEMA.md` §5; `verdict: red`, `verdict_rule_applied: R7`; all 7 inputs cited to real evidence lines |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `reassembly-gate-run.test.ts` | `verifyAcmeAssemblesTree()` | real ACME spawn, real `expectedBytes` diff | ✓ WIRED | Re-ran; output matches evidence verbatim |
| `reassembly-gate-run.test.ts` | `buildHazardReport()` / `disposeHazardReport()` | real hazard report over committed subject | ✓ WIRED | 3 findings + 1 unclassified region, matches evidence |
| `docs/phase49-the-reassembly-gate-findings.md` | `evidence/49-*.md` | per-input line citation, final-occurrence-wins | ✓ WIRED | Every `inputs.*` value cross-checked against its cited evidence-file line number and content — all correct |
| `evidence/DECISION-RULE.md` (R1–R12) | `reassembly-gate.ts`'s `runReassemblyGate()` | rule text → code | ✓ WIRED | Read both side by side; rule order, conditions and precedence match exactly |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full gate + oracle + seam + ack + movement + run suite reproduces evidence exactly | `cd src/mcp/vice && node --test acme-verify.test.ts reassembly-gate.test.ts acme-seam.test.ts reassembly-gate-ack.test.ts reassembly-gate-movement.test.ts reassembly-gate-run.test.ts` | 121/121 pass, exit 0, output byte-identical to evidence transcripts | ✓ PASS |
| Ordering proof | `git log --diff-filter=A -- evidence/SCHEMA.md evidence/DECISION-RULE.md` vs. evidence dir commit history | Both frozen files added in one commit each, before the single commit that added all 5 measurement files | ✓ PASS |
| Typecheck | `npm run typecheck` | exit 0 | ✓ PASS |
| npm package exclusion | `node -e "require('./package.json').files.includes(...)"` for all 11 gate/oracle/test modules | all `false` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| `BUILD-06` | 49-01 through 49-07 (all 7 plans) | Reassembly plus a clean hazard report is a gate that exists before the phase it gates runs, not after | ✓ SATISFIED | REQUIREMENTS.md line 65 marked `[x]`, line 150 `Complete`; ordering proof and machine-readable verdict both independently confirmed above |

No orphaned requirements found for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `evidence/49-tree-rebuild.md`, `evidence/49-movement-rebuild.md`, `evidence/49-hazard-disposition.md` | outcome lines at lines 48–49, 54–55, 50 respectively | Outcome lines (`TREE_REBUILD:`, `DIFF_SCOPE_COVERAGE:` ×2, `HAZARD_DISPOSITION:`) sit **only** inside a fenced ` ``` ` "raw output" block, with no separate bare, unfenced copy | ⚠️ Warning | `SCHEMA.md` §1 explicitly states an outcome line must be "Never indented, never inside a fenced block that a reader would take for sample output." `evidence/49-red-controls.md` and `evidence/49-guards.md` (same plan, same author, same commit) correctly write their declared lines a second time as bare, unfenced lines outside any fence (each with an explicit `<!-- Bare column-0 outcome line -->` comment), but the other 3 of the 5 files do not, and this deviation from the frozen §1 rule is not recorded as an `## ACCEPTED LIMIT` anywhere (unlike the genuinely-declared 7-vs-8 count deviation, which *is* recorded). **Does not change the verdict**: no code in this repository parses these evidence files programmatically (confirmed by search); the machine-readable artifact is `docs/phase49-...findings.md`'s YAML frontmatter, which was manually transcribed and independently re-verified correct against the cited evidence-file line numbers. This is a self-consistency gap in the plan's own stated discipline, not a defect in the verdict itself. |
| `src/mcp/vice/acme-seam.test.ts` (WR-01, carried from `49-REVIEW.md`) | 92–97, 138–149 | Spawn-site scan's regex only captures a bare identifier, not a member-expression (`options.acmeBin`), as the first arg to a spawn call | ⚠️ Warning (pre-existing, disclosed) | A future spawn site written in that shape would not register in `ACME_SPAWN_SITES`, undetected by the guard. No such call exists today; `SECOND_PATH_GUARD: held` is correct for the current tree. |
| `src/mcp/vice/reassembly-gate-movement.ts` (WR-02, WR-03, carried from `49-REVIEW.md`) | 142–166, 274–284 | Scope-shift doesn't verify 1:1 scope:range extent before shifting; out-of-bounds reference-site read/write silently no-ops instead of refusing | ⚠️ Warning (pre-existing, disclosed) | Not exercised by the current fixtures/tests (only a 1:1 scope:range shape is exercised); a real robustness gap for future subjects, not a defect in this run's measured result. |
| `reassembly-gate-ack.ts`, `reassembly-gate-movement.ts`, `reassembly-gate-movement-subject.ts` (WR-04, carried from `49-REVIEW.md`) | n/a | No mechanical `files[]`-absence test for these 3 test-only modules, unlike their siblings `acme-verify.ts`/`reassembly-gate.ts` | ⚠️ Warning (pre-existing, disclosed) | Confirmed today none of the 3 are actually in `package.json`'s `files[]` — no live leak — but nothing in CI would catch a future regression for these 3 specifically. |
| `reassembly-gate-ack.ts:129-157` (IN-01, carried) | 129-157 | Key-collision safety relies on an unenforced "no `::` in mechanism string" invariant | ℹ️ Info | Cosmetic hardening opportunity, no live collision in current mechanism set |

None of the above rise to a blocker: all are either already disclosed in `49-REVIEW.md` (Warnings/Info, non-blocking by the review's own classification, re-confirmed still present and still non-exploited in this codebase state) or are a documentation-consistency gap I found independently that does not affect the correctness of the actual machine-readable verdict.

### Human Verification Required

None. All five success criteria are independently, mechanically verifiable against git history, source code, and a fresh test re-run, and were re-verified directly rather than taken from SUMMARY.md.

### Gaps Summary

No gaps block phase goal achievement. The gate exists, is committed before any measurement, is byte-diff-derived and extends the existing oracle, was observed red on all three planted controls before its own green/acknowledged rules were trusted, exercises movement (including the split hi/lo case) on every run, and its hazard disposition mechanism correctly distinguishes `clean`/`acknowledged`/`blocked` with no silent-green path. The real run's own verdict is `red` under `R7` (an unclassified hazard region left outside the baseline diff scope) — this is the gate correctly doing its job on a subject that was deliberately built to carry an unresolved hazard region, not a failure of the gate itself, and the ROADMAP already anticipates this outcome as one of two states ("green, or explicitly acknowledged") that must precede Phase 50 starting. **Phase 50 planning should not begin until this subject's `red` verdict is resolved to `green` or `acknowledged`** (e.g., by improving the hazard report's VIC-II register recovery so the `$087A..$0FFF` region is no longer `"unclassified"`, or by widening the acknowledgement array to cover it) — this is a note for the next phase's planner, not a gap in this phase's own deliverable.

One documentation-consistency item (the fenced-vs-bare outcome-line inconsistency across the 5 measurement evidence files) is worth a follow-up cleanup pass but does not affect the verdict's correctness, since nothing in the codebase parses those files programmatically and the actual machine-readable artifact (the findings document's frontmatter) was independently checked correct.

---

_Verified: 2026-09-13_
_Verifier: Claude (gsd-verifier)_
