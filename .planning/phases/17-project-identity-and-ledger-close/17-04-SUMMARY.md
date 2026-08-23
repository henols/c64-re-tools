---
phase: 17-project-identity-and-ledger-close
plan: 04
subsystem: docs
tags: [gap-closure, core-value, provenance, audit-integrity, doc-guard]

requires:
  - phase: 17-project-identity-and-ledger-close
    provides: "plan 17-02's dated CORE-01 verdict and its guard, plan 17-03's closure notes — the seven-document propagation this gap closes"
  - phase: 17-project-identity-and-ledger-close
    provides: "17-UAT.md's gap `G-17-1` and .planning/debug/core-01-provenance-overstates-human-involvement.md's diagnosis, naming the unevidenced comprehension claim and the exact transcript timestamps this plan corrects to"
provides:
  - "A cross-document absence/presence gate (this plan's own task 4, re-runnable ad hoc) that is the first mechanical contact the CORE-01 provenance claim has ever had"
  - "Seven `.planning/` documents stating only what the primary session transcript evidences: attendance and delegation, not comprehension"
affects: [gsd-audit-milestone, gsd-complete-milestone]

gap_closure: true
gap_ids: [G-17-1]

actuals:
  tokens: 9700
  tasks: 4
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Canonical-copy-then-propagate correction: fix the one canonical paragraph (PROJECT.md's *Provenance.*) first, then compress the same account into six re-transcriptions, rather than independently re-deriving wording per file"
    - "Cross-document absence+presence gate as the recurrence guard for a claim no single-file doc-*.test.ts guard scopes to"

key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/phases/17-project-identity-and-ledger-close/17-02-SUMMARY.md
    - .planning/phases/17-project-identity-and-ledger-close/17-03-SUMMARY.md
    - .planning/phases/17-project-identity-and-ledger-close/17-VERIFICATION.md

key-decisions:
  - "ROADMAP.md's Phase 17 outcome Notes criterion 1 was corrected even though the diagnosis assessed it as 'defensible as written' ('a human saw the full evidence and responded to it' is an attendance claim, not a comprehension claim) — because 'the full evidence' is exactly the SECOND over-claim this plan exists to fix (the decision prompt itself carried only two option labels plus one strongest-argument line each, not the full evidence). Leaving one of the seven documents asserting 'full evidence' while the other six deny it would reintroduce, in miniature, the exact inconsistency this plan closes."
  - "src/mcp/vice/docs-core-value-decision.test.ts was left entirely alone, including the provenance predicate offered at gap disposition — the operator declined it, and the guard is 6/6 green and needs no change for correctness (empirically, the diagnosis proved the *Provenance.* paragraph is not load-bearing for any of the guard's six predicates by deleting it and observing 6/6 still green)."
  - "CORE-01 stays `[x]` with 17-02-PLAN.md's must_have truth 3 still literally unmet (the operator delegated rather than personally selected an option word) — reported as intent-satisfied with a disclosed deviation, which is the state the operator accepted at this phase's UAT. This plan corrects the WORDING of the provenance record; it does not reopen the verdict."

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "The comprehension-claim literal family returns zero matching lines across all seven corrected documents, down from a measured baseline of 16"
    requirement: CORE-01
    verification:
      - kind: other
        ref: "grep -niE (11-phrase family) across the seven files, before this plan: 16 matches (3 in 17-02-SUMMARY.md, 5 in 17-VERIFICATION.md, 2 each in PROJECT.md/STATE.md/17-03-SUMMARY.md, 1 each in REQUIREMENTS.md/ROADMAP.md). After: 0."
        status: pass
    human_judgment: false
  - id: D2
    description: "Each of the seven files still asserts attendance (blocking-human), delegation (a delegat stem and 'you decide'), the comprehension disclaimer, and the G-17-1 attribution"
    requirement: CORE-01
    verification:
      - kind: other
        ref: "Per-file grep for all five literals, re-run live against the final state of all seven files: PASS in every file"
        status: pass
    human_judgment: false
  - id: D3
    description: "17-VERIFICATION.md no longer offers the standing 'you decide' preference as corroboration that the operator was informed; docs-core-value-decision.test.ts is byte-unmodified; all six docs-*.test.ts guards and the full npm test suite are green"
    requirement: CORE-01
    verification:
      - kind: other
        ref: "grep -qF 'a standing delegation is precisely what permits an uninformed answer' 17-VERIFICATION.md; git diff --quiet -- docs-core-value-decision.test.ts; git diff --quiet HEAD -- src/"
        status: pass
      - kind: unit
        ref: "All six docs-*.test.ts guards individually: docs-core-value-decision.test.ts 6/6, docs-dangling-refs.test.ts 8/8, docs-deferred-ledger.test.ts 6/6, docs-fork-decision.test.ts 6/6, docs-linerefs.test.ts 3/3, docs-review-disposition.test.ts 7/7 — all exit 0"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && npm test (full gate, not test:automated): 2395 total, 2351 pass, 0 fail, 39 skipped, 5 todo, 24 suites"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-23
status: complete
---

# Phase 17 Plan 04: G-17-1 Provenance Correction Summary

**Corrected the unevidenced comprehension claim in CORE-01's provenance record across all seven planning documents that carried it — attendance and delegation stay asserted (the primary transcript establishes both: rendered at 08:32:48Z, answered 298 seconds later in free text `you decide`), comprehension is stated as not evidenced by any artifact, and a cross-document gate now checks the whole set at once.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 4 (3 edit tasks + 1 read-only mechanical-gate task)
- **Files modified:** 7 `.planning/` documents; zero `src/` files

## Accomplishments

- **Task 1 (canonical fix):** Replaced PROJECT.md's `*Provenance.*` paragraph — the
  canonical copy the other six documents re-transcribe — with wording that states
  exactly what the transcript evidences: the checkpoint was rendered with the
  counted evidence columns in the terminal output, the decision prompt itself
  carried only two option labels plus one strongest-argument line each, the
  operator answered 298 seconds later in free text `you decide`, and the
  orchestrator then selected `keep-dated`. States the UAT non-recall (the operator
  did not recall the exchange when asked roughly 106 minutes later) and attributes
  the correction to plan 17-04, gap `G-17-1`. Core Value leading statement and
  verdict marker left byte-identical; `docs-core-value-decision.test.ts` untouched,
  6/6 green.
- **Task 2 (propagate + count fix):** Corrected REQUIREMENTS.md's CORE-01 closure
  note, STATE.md's Phase-17 narrative paragraph and Decisions bullet, and
  ROADMAP.md's Phase 17 outcome Notes criterion 1 to the same account. Fixed two
  stale `docs-core-value-decision.test.ts` guard-count claims (REQUIREMENTS.md's
  parenthesised enumeration, which was also short one test name; ROADMAP.md's and
  STATE.md's parenthesised pass ratios) from the plan-time `5` to the measured `6`.
- **Task 3 (phase records + circular corroboration):** Corrected 17-02-SUMMARY.md's
  three passages and appended a dated correction note to its "Task 1 — Resolution
  Record" section explaining the retracted narrative was supplied in that agent's
  own spawn prompt, never independently observed. Corrected 17-03-SUMMARY.md's two
  passages and its D3 coverage ref's stale count (5/5 → 6/6); left its two
  defensible passages (the tech-stack pattern entry, the Gaps Summary sentence)
  untouched, both of which claim only attendance and delegation. Replaced
  17-VERIFICATION.md's frontmatter `expected:`/`why_human:` strings, must-have
  table row 9, and human-verification item 1's Test/Expected paragraphs — the
  Expected paragraph now states plainly that a standing "you decide" delegation
  preference is NOT corroboration of comprehension, since a standing delegation is
  precisely what permits an uninformed answer.
- **Task 4 (mechanical gate):** Read-only. Ran the absence gate, the presence gate,
  and the guard/suite gate over the final state of all seven documents at once —
  the first mechanical contact this provenance claim has ever had, closing the
  propagation path (continuation agent → plan 17-03 → verifier, three
  re-transcriptions, zero prior checks) that let the original over-claim survive
  unchallenged.

## Gate Results (measured, this session)

**Gate 1 — absence, whole set.** Comprehension-claim literal family
(`having read|who read it|read the full evidence|having seen the full
evidence|shown the full evidence|was presented in full|full evidence
presented|saw the full evidence|present, informed, and consented`) across the
seven documents:

| | Before this plan | After this plan |
|---|---|---|
| Matching lines | 16 (3 in 17-02-SUMMARY.md, 5 in 17-VERIFICATION.md, 2 each in PROJECT.md/STATE.md/17-03-SUMMARY.md, 1 each in REQUIREMENTS.md/ROADMAP.md) | **0** |

The seven-file list is enumerated explicitly, not globbed: `17-UAT.md` and
`.planning/debug/core-01-provenance-overstates-human-involvement.md` legitimately
carry the retracted clause as diagnosis quotations and must not be swept in, and
this plan's own `17-04-PLAN.md` sits in the same directory. No comment filter
applies — these are markdown prose documents where the whole file is the
assertion surface, and none of the located passages sat inside a heading.

**Gate 2 — presence, whole set.** Each of the seven files still carries
`blocking-human`, a `delegat` stem, `you decide`, the comprehension disclaimer
(`comprehension is not evidenced`), and the `G-17-1` attribution — verified live
against the final state of all seven files, all PASS. This is what forbids gate 1
being satisfied by silently deleting the provenance record instead of correcting
it.

**Gate 3 — guards and the full suite.**
- `docs-core-value-decision.test.ts` byte-unmodified by this plan: `git diff
  --quiet` clean. `git diff --quiet HEAD -- src/` clean — no `src/` file touched.
- Measured test count for `docs-core-value-decision.test.ts` (this plan's own
  verification step, not carried from any prior document): **6 tests** — 1.
  non-vacuity, 2. verdict-marker presence, 3. ISO date, 4. named evidence, 5.
  reversal condition, 6. planted violation. This is the number every corrected
  planning-document claim about the guard's count was brought to.
- All six `docs-*.test.ts` guards, run individually: `docs-core-value-decision.test.ts`
  6/6, `docs-dangling-refs.test.ts` 8/8, `docs-deferred-ledger.test.ts` 6/6,
  `docs-fork-decision.test.ts` 6/6, `docs-linerefs.test.ts` 3/3,
  `docs-review-disposition.test.ts` 7/7 — all exit 0.
- `docs-linerefs.test.ts` was never at risk: it is scoped to the single
  `CLAUDE.md` bullet containing the literal `rewriteArguments()` and checks its
  `vice-proxy.ts` line citations against the real source. This plan edits neither
  file, so the guard is unaffected by construction — running it (3/3) converts
  that from an assumption into an observation.
- Full `cd src/mcp/vice && npm test` (the full gate, not `npm run
  test:automated`, which skips `MANUAL_ONLY_TESTS` and has previously hidden real
  failures): **2395 total, 2351 pass, 0 fail, 39 skipped, 5 todo, 24 suites.**

## Deliberate Decisions (recorded so no later reader has to re-derive them)

1. **ROADMAP.md's criterion 1 was corrected even though the diagnosis called it
   "defensible as written."** "A human saw the full evidence and responded to it"
   is, read narrowly, an attendance claim rather than a comprehension claim — but
   "the full evidence" is exactly the SECOND over-claim this plan exists to fix:
   the decision prompt the operator actually answered carried only two option
   labels plus one strongest-argument line each, not the eleven-item evidence set
   that appeared in the terminal render preceding it. Leaving one of the seven
   documents asserting "full evidence" while the other six deny it would have
   reintroduced, in miniature, the exact cross-document inconsistency this plan
   closes.
2. **`docs-core-value-decision.test.ts` was left entirely alone, including the
   provenance predicate offered at gap disposition.** The operator declined that
   option; the guard is 6/6 green and needs no change for correctness. The
   diagnosis had already proven the `*Provenance.*` paragraph is not load-bearing
   for any of the guard's six predicates — by deleting the paragraph and observing
   6/6 still green — so rewriting the paragraph freely (as tasks 1–3 did) could
   not and did not touch the guard.
3. **CORE-01 stays `[x]`, with 17-02-PLAN.md's must_have truth 3 still literally
   unmet.** The operator delegated the choice rather than personally selecting
   `restate` or `keep-dated`; that gap between the literal must-have wording and
   what actually happened is reported as intent-satisfied with a disclosed
   deviation — the same disposition the operator accepted at this phase's UAT.
   This plan corrects the WORDING of the provenance record so it no longer
   overstates comprehension; it does not reopen, and was never intended to reopen,
   the verdict itself.

## Task Commits

1. **Task 1: Correct the canonical `*Provenance.*` paragraph in PROJECT.md** — `2fcecf6` (docs)
2. **Task 2: Propagate the correction to REQUIREMENTS.md/STATE.md/ROADMAP.md, fix stale counts** — `2c0c1be` (docs)
3. **Task 3: Correct the three phase records, fix circular corroboration** — `bde3fb8` (docs)
4. **Task 4: Mechanical gate (read-only)** — no commit; verification results recorded above and in this SUMMARY's own commit

## Files Created/Modified

- `.planning/PROJECT.md` — `*Provenance.*` paragraph corrected (canonical copy)
- `.planning/REQUIREMENTS.md` — CORE-01 closure note corrected, guard-count enumeration fixed (5 → 6, missing test name added)
- `.planning/STATE.md` — Phase-17 narrative paragraph and Decisions bullet corrected, guard-count ratio fixed (5/5 → 6/6)
- `.planning/ROADMAP.md` — Phase 17 outcome Notes criterion 1 corrected, guard-count ratio fixed (5/5 → 6/6)
- `.planning/phases/17-project-identity-and-ledger-close/17-02-SUMMARY.md` — three passages corrected, dated correction note appended
- `.planning/phases/17-project-identity-and-ledger-close/17-03-SUMMARY.md` — two passages corrected, D3 coverage ref count fixed (5/5 → 6/6)
- `.planning/phases/17-project-identity-and-ledger-close/17-VERIFICATION.md` — frontmatter strings, must-have row 9, and human-verification item 1 corrected; circular corroboration removed

No file under `src/` was modified by this plan.

## Deviations from Plan

None — plan executed exactly as written. All three prose-editing tasks matched
their `<verify>` blocks on the first pass except REQUIREMENTS.md's initial edit,
where the `comprehension is not evidenced` phrase was split across a markdown
line wrap and the blockquote `> ` prefix, causing the literal-string grep to miss
it; rewrapped within the same task before commit, no separate deviation fix
needed (caught by the task's own verification step before committing).

## Known Stubs

None.

## Threat Flags

None — this plan introduces no new network endpoint, auth path, file-access
pattern, or schema change at a trust boundary. It edits markdown prose only.

## Issues Encountered

None. All three edit tasks' automated `<verify>` blocks passed; task 4's
read-only gate confirmed the whole-set result.

## User Setup Required

None.

## Next Phase Readiness

This is the terminal plan for Phase 17 and for v0.4.0's Phase 17 wave.
`G-17-1` is closable: `/gsd-verify-work` can reconcile it as `resolved` on resume,
since this plan's frontmatter carries `gap_closure: true` and `gap_ids: [G-17-1]`.
CORE-01 remains `[x]` and Complete in Traceability, unreopened. The full `npm
test` suite is green and all six `docs-*.test.ts` guards pass individually — the
precondition `GATE-01` requires before any milestone audit records `status:
passed`.

---
*Phase: 17-project-identity-and-ledger-close*
*Completed: 2026-08-23*
