# Phase 56: Remove `shipped-modules.ts` and Its Embedded Source Scans - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-14
**Phase:** 56-Remove `shipped-modules.ts` and Its Embedded Source Scans
**Areas discussed:** Mixed-case cut rule, `anno-seam.test.ts` survivors, Memorialising invariants, Proving no collateral loss

---

## Area selection

All four offered gray areas were selected.

---

## Mixed-case cut rule

Grounded on a measured example before asking: `anno-store.test.ts:865`, one case
whose first half opens a real store and asserts every row has `bank` null, and
whose second half runs `codeOnly()` over `anno-store.ts` and asserts on the text.

### Question 1 — what happens to a case that does both?

| Option | Description | Selected |
|--------|-------------|----------|
| Strip text half, keep case | Remove only the scanning assertions, keep behavioural ones, rename the case. Preserves criterion 2; means reading and re-titling every mixed case by hand. | |
| Delete the whole case | If any part touches source text, the case goes. Mechanical, no renaming judgement — but deletes the bank-null behavioural proof as collateral. | ✓ |
| Keep only if the half stands alone | Strip the text half, delete the case when the remainder is not a complete assertion. Middle path, adds a judgement call per case. | |

**User's choice:** Delete the whole case.

**Notes:** Claude then measured the consequence rather than proceeding: 18 of the
57 scanning cases also call production code (10 of them in `anno-store.test.ts`),
of which roughly 8-10 carry genuinely unique behavioural proofs — CR-08's
truncated-snapshot refusal, `decodeRawData`'s round-trip, `argvDigest`'s
ordering, `NO_ROW` resolution. This was raised as a direct collision with the
phase's own success criterion 2 ("Only cases whose entire subject is source text
are removed"), and with Phase 54's identically-shaped criterion.

### Question 2 — how to resolve the clash with criterion 2?

| Option | Description | Selected |
|--------|-------------|----------|
| Reword criterion 2, accept the loss | Whole-case deletion stands; criterion 2 is rewritten and the 8-10 behavioural proofs are lost with nothing replacing them. Phase 54 reworded to match. | |
| Delete whole case, re-home unique proofs | Delete the case entire, re-add the behavioural half as a new standalone case. No half-edited cases, but ~8-10 new cases written. | |
| Strip text half for mixed cases only | 39 pure-scan cases deleted whole, the 18 mixed ones stripped in place and renamed. Keeps criterion 2 and Phase 54's wording; 18 hand-read edits. | |

**User's choice:** "You decide" — delegated to Claude after seeing the measurement.

**Claude's resolution and reasoning:** whole-case deletion kept as the DEFAULT,
honouring the owner's stated rule, with one exemption: a case survives only when
removing every source-text assertion still leaves at least one assertion that
exercises production behaviour. That exemption test is success criterion 4
applied at case level, so it needs no roadmap rewording and no new test code.
Exempt cases are stripped in place with surviving lines kept BYTE-FOR-BYTE and
renamed. Re-homing (option 2) was rejected as reaching the same end state by
retyping assertions — strictly more work and more risk of a silently weaker case,
which is the exact failure criterion 2 exists to catch. Recorded as D-01..D-05.

---

## `anno-seam.test.ts` survivors

Measured first: 22 of 23 cases scan source. Correcting Claude's own framing in
the area menu — the `files[]`-completeness case at line 238 reads `package.json`
as JSON, `readdirSync` as a directory listing, and a 3-element local const. It
calls neither `codeOnly()` nor `shippedTsModules()`, asserts on no source text,
and survives D-1 outright. It was never at risk.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the file, 2 cases | Delete 21 of 23; both survivors stay byte-for-byte where they are, no transcription slip possible. Cost: the filename still says "seam". | ✓ |
| Split the two, delete the file | WR-25 to `anno-confinement.test.ts`, `files[]` to a manifest-shaped home, `anno-seam.test.ts` removed. Cleanest end state; moves code between files. | |
| Keep both, rename the file | Same as keeping, plus a `git mv`. Fixes the name; churns history on a 770-line file and staleifies every citation of the old name. | |

**User's choice:** Keep the file, 2 cases.

**Notes:** `anno-confinement.test.ts` (915 lines / 21 cases, no `shipped-modules`
import) was verified as a viable home and deliberately not used. Recorded in
CONTEXT.md so a later reader knows it was considered. Recorded as D-06..D-09.

---

## Memorialising invariants

Claude presented this area as a conflict between two precedents, then corrected
it during the discussion: `git log` shows `capture-predicate.ts` was last touched
in Phase 33, BEFORE `260914-uhm`, so uhm added no prose — the reasoning was
already in the header. And `260914-poo`'s actual behaviour was to keep the
underlying constraint sentence and drop the false enforcement claim, creating
nothing new. Both precedents agree: add nothing. The open question narrowed to
repair.

Measured repair surface: four surviving production modules name a doomed scanner
(`anno-store.ts`, `dxa-blocks.ts`, `evid-ingest.ts`, `memmap-lookup.ts`).
`CLAUDE.md` names none. And `capture-predicate.ts:40` credits
"`capture-predicate.test.ts` asserts it from this module's own source" — a false
enforcement claim naming neither `codeOnly` nor `shipped-modules`, so grep does
not find it.

| Option | Description | Selected |
|--------|-------------|----------|
| Repair the named set only | Add nothing new; drop the false enforcement clauses from the four named modules plus `capture-predicate.ts:40`, listed BY NAME so the set is bounded and checkable. Accepts that an uncatchable stale claim may survive. | ✓ |
| Repair nothing, sweep nothing | Pure deletion; every stale comment stays, as poo left its twelve. Cheapest, but leaves five modules crediting enforcement that no longer exists. | |
| Repair every claim, grep or not | Read every affected module header and remove each enforcement claim. Complete, but "done" becomes a judgement rather than a checkable set. | |

**User's choice:** Repair the named set only.

**Notes:** The underlying constraint sentence stays in every case; only the
"asserted by X" clause goes — the same edit poo made to CLAUDE.md. Recorded as
D-10..D-13.

---

## Proving no collateral loss

### Question 1 — how are the scanning cases found?

| Option | Description | Selected |
|--------|-------------|----------|
| Scratch script, planted-case proof | Throwaway script in the session scratchpad, never committed; must not depend on `codeOnly()`, must distinguish comments from code, must be proved against a planted case before its output is trusted. Every hit still hand-read. | ✓ |
| Hand-read all 17 files | No tooling. Immune to comment-versus-code confusion; ~769 cases across 33,000+ lines, and fatigue is its own silent-error source. | |
| Committed helper under `scripts/` | Reproducible and reviewable, but collides with the no-replacement-guard rule and becomes an artifact needing deletion. | |

**User's choice:** Scratch script, planted-case proof.

### Question 2 — how much reconciliation lands in the SUMMARY?

Mechanism verified live during the discussion: `node --test --test-reporter=tap
prg-image.test.ts` emits a flat `ok N - <name>` list, so a per-file name set is
exact and needs no source parsing.

| Option | Description | Selected |
|--------|-------------|----------|
| Every removed name, verbatim | Per-file TAP set diff gates; SUMMARY carries all ~57 names grouped by file with a one-line reason each. Long, but checkable without re-running anything. | ✓ |
| Names only for judgement calls | Set diff still gates; SUMMARY records per-file counts plus verbatim names only for exemptions and borderline cases. Shorter; trusts the gate for the majority. | |
| Counts only, no set diff | Before/after totals and arithmetic. Rejected by criterion 3's own wording — a file that silently stopped running produces exactly the expected decrease. | |

**User's choice:** Every removed name, verbatim.

**Notes:** Per-file invocation also sidesteps the whole-suite hang on
`vice-proxy.test.ts` and the live-broker BACK-05 failure, both of which live in
`MANUAL_ONLY_TESTS`. Recorded as D-14..D-17.

---

## Claude's Discretion

- **The cut-rule resolution (D-01..D-05).** Explicitly delegated with "You decide"
  after the 18-mixed-case measurement was presented. The owner's whole-case rule
  is preserved as the default; the exemption test is Claude's addition.
- **The stale-comment list (D-13).** Folded in without a question and flagged to
  the owner for veto: the six `.planning/codebase/*.md` maps and the two
  comment-only mentions at `vice-proxy.test.ts:3488` and
  `hostpath-consumers.test.ts:624` are left stale. No objection raised.

## Deferred Ideas

None. The discussion stayed inside the phase boundary; no scope creep was raised
and none needed redirecting.

Three pending todos matched on keyword overlap only and were reviewed without
folding — see CONTEXT.md `<deferred>` § "Reviewed Todos (not folded)". One of
them (BACK-05 on a live-broker host) is recorded there as an execution hazard
rather than as scope.
