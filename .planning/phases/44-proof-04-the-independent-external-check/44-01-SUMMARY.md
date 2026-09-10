---
phase: 44-proof-04-the-independent-external-check
plan: 01
subsystem: testing
tags: [dxa, vice-monitor, memmapshow, evid-reconcile, evidence-layer, stock-vice]

requires:
  - phase: 43-the-runtime-evidence-layer
    provides: "memmapshow parser (textmon-memmap.ts), evid-ingest.ts, evid-reconcile.ts's reconcileObservedExecution(), all unexercised on real code until this plan"
  - phase: 38-proof-01-03-on-real-cracked-code
    provides: "PROOF-01's own dxa classification of BRUCE LEE (DC) (code=67 data=45005 unclassified=0 covered=45072), the same corpus/entry this plan reuses"
provides:
  - "evidence/SCHEMA.md -- the resolved/unresolved/not-exercised derivation rule and the full SUBJECT_/ORACLE_/PROOF04_ outcome-line vocabulary, fixed before any measurement"
  - "proof04-subject-dxa.mjs, proof04-oracle-memmap.mjs, proof04-reconcile.mjs -- two structurally-independent evidence producers and a join driver, each independently runnable"
  - "One live, measured PROOF04_VERDICT (resolved, 168 false positives / denominator 45072) against genuine stock VICE 3.9 at anchor depth 10"
  - "proof04-independence.test.ts -- a non-vacuous structural proof that the two producers never import each other's domain"
  - "proof04-reconcile.mjs --self-check -- four synthetic edge cases (empty-observations, zero-denominator, single-address, ordering-determinism) gating the join without an emulator"
affects: [44-02, 44-03]

actuals:
  tokens: 17936
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Two-producer, hash-pinned handoff for structural independence: each side is a separately-invoked script with a closed import list, proven non-vacuous by a planted-violation test rather than promised"
    - "Comment-aware stripComments()/findForbiddenTokens() specifier-scoped import census, distinguishing a real import position from the same token inside boundary-documentation prose"
    - "Derivation rule fixed in SCHEMA.md before any run, encoded exactly once in code (deriveVerdict()), and exercised identically by both a live run and --self-check's synthetic cases"

key-files:
  created:
    - .planning/phases/44-proof-04-the-independent-external-check/evidence/SCHEMA.md
    - .planning/phases/44-proof-04-the-independent-external-check/evidence/README.md
    - .planning/phases/44-proof-04-the-independent-external-check/evidence/proof04-subject-dxa.mjs
    - .planning/phases/44-proof-04-the-independent-external-check/evidence/proof04-oracle-memmap.mjs
    - .planning/phases/44-proof-04-the-independent-external-check/evidence/proof04-reconcile.mjs
    - .planning/phases/44-proof-04-the-independent-external-check/evidence/proof04-independence.test.ts
  modified: []

key-decisions:
  - "In-memory subject classification (D-P1): the subject BlockEntry[] is built directly from dxa's own map, never routed through a populated .annostore -- matches the plan's own recorded decision, no store dependency added."
  - "The oracle producer never throws on a short run (ORACLE_DEPTH_REACHED < target) -- it records the shortfall and continues to memmapshow, per Success Criterion 3's own requirement that a shortfall is recorded, not smoothed over."
  - "c1541.read's name argument must match the directory listing's own lowercase display spelling, not the uppercase display-form constant this plan's own outcome-line convention uses -- the subject producer parses the listing for the real entry name (mirroring dxa-live.test.ts's extractCorpusProgram()) while still asserting it matches the expected entry case-insensitively before trusting it."

requirements-completed: [PROOF-04]

coverage:
  - id: D1
    description: "SCHEMA.md fixes the derivation rule and outcome-line vocabulary before any measurement"
    requirement: "PROOF-04"
    verification:
      - kind: other
        ref: "grep -ac 'not-exercised'/'frame-exact-region'/'narrowed' SCHEMA.md, all >=1; git commit timestamp precedes any run log"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two structurally-independent producer scripts (subject, oracle), each with a closed import boundary"
    requirement: "PROOF-04"
    verification:
      - kind: unit
        ref: "evidence/proof04-independence.test.ts (7 tests, all passing, including a planted-violation control in both directions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The join is the shipped reconcileObservedExecution(), called exactly once, never re-derived by hand"
    requirement: "PROOF-04"
    verification:
      - kind: unit
        ref: "evidence/proof04-independence.test.ts#join driver (proof04-reconcile.mjs) calls reconcileObservedExecution exactly once"
        status: pass
    human_judgment: false
  - id: D4
    description: "One live end-to-end pass against genuine stock VICE 3.9 at anchor depth 10 produces a verdict from the committed vocabulary"
    requirement: "PROOF-04"
    verification:
      - kind: manual_procedural
        ref: "live run transcripts under $HOME/.cache/c64-re-tools/phase44/tracer/{subject,oracle,reconcile}.log -- PROOF04_VERDICT resolved, PROOF04_FALSE_POSITIVES 168, PROOF04_DENOMINATOR 45072, PROOF04_BUCKET_IDENTITY_OK true, denominator agreeing with SUBJECT_COVERED_ADDRESSES"
        status: pass
    human_judgment: true
    rationale: "A live emulator run against genuine stock VICE 3.9 hardware/software is not repeatable by an automated CI assertion of a specific number (per this project's own evidence-script discipline) -- the transcript is the evidence, and a human reviewer confirms the recorded numbers against the printed logs."
  - id: D5
    description: "The empty/zero-denominator/ordering/single-address edges are gated by self-check cases needing no emulator"
    requirement: "PROOF-04"
    verification:
      - kind: other
        ref: "proof04-reconcile.mjs --self-check: SELFCHECK_RESULT pass, all four named cases pass; manually verified the empty-observations case reddens when inverted, then reverted"
        status: pass
    human_judgment: false

duration: 62min
completed: 2026-09-10
status: complete
---

# Phase 44 Plan 01: The Independent External Check Summary

**Stood up two structurally-independent evidence producers (dxa's byte-derived classification, a live stock-VICE runtime-execution capture) and joined them through the shipped `reconcileObservedExecution()`, closing PROOF-01's named reversal condition with one live measurement: 168 false positives out of a 45072-address denominator.**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-10T15:52:00Z
- **Completed:** 2026-09-10T16:54:00Z
- **Tasks:** 2
- **Files modified:** 6 created

## Accomplishments

- `evidence/SCHEMA.md` fixes the `resolved`/`unresolved`/`not-exercised` derivation rule and the full outcome-line vocabulary (`SUBJECT_*`, `ORACLE_*`, `PROOF04_*`) before any script ran or any number existed.
- `proof04-subject-dxa.mjs` extracts `BRUCE LEE   (DC)` from `danish.d64` over the `c1541.dir`/`c1541.read` host-tool seam, feeds it through `runDxaDisassemble()`, and writes an in-memory `BlockEntry[]` artifact — reproducing PROOF-01's own figures exactly (`code=67 data=45005 unclassified=0 covered=45072`).
- `proof04-oracle-memmap.mjs` drives genuine, direct-spawned stock `/usr/bin/x64sc` (VICE 3.9) through the S3 frame-anchored AUTOSTART sequence, dials `memmapzap`/`memmapshow`, and writes `EvidExecRow`-shaped observations via `evid-ingest.ts`'s `ingestAccessMap()`.
- `proof04-reconcile.mjs` joins the two artifacts through `evid-reconcile.ts`'s `reconcileObservedExecution()`, called exactly once, and derives the verdict strictly from `SCHEMA.md`'s committed rule.
- One live end-to-end pass at anchor depth 10 against genuine stock VICE 3.9 produced `PROOF04_VERDICT resolved`, `PROOF04_FALSE_POSITIVES 168`, `PROOF04_DENOMINATOR 45072`, `PROOF04_BUCKET_IDENTITY_OK true` — PROOF-01's false-positive count is now computable for the first time.
- `proof04-independence.test.ts` proves the two producers' independence structurally (7 tests, including a planted-violation control proven non-vacuous in both directions) rather than merely documenting it.
- `proof04-reconcile.mjs --self-check` gates the empty-observations, zero-denominator, single-address and ordering-determinism edges without needing a live emulator; the empty-observations case was manually inverted to confirm it reddens correctly, then reverted.
- No leftover `x64sc` process and no untracked evidence-directory files after the live run.

## Task Commits

1. **Task 1: The fixed rule, the two independent producers, the join driver, and one live end-to-end pass at anchor depth 10** — `c62c261b` (feat)
2. **Task 2: Assert the independence structurally, prove the assertion non-vacuous, and gate the empty / zero-denominator / ordering / adjacency edges** — `d2dee305` (test)

_Note: this plan's tasks were executed inline (Task 1 is `type="tracer"`, Task 2 is `type="auto"`); no plan-metadata commit follows since STATE.md/ROADMAP.md updates for a sequential (non-worktree) executor land in the same final commit sequence per `execute-plan.md`._

## Files Created/Modified

- `evidence/SCHEMA.md` — the derivation rule and outcome-line vocabulary
- `evidence/README.md` — the phase's evidence conventions (broker-inactive rule, `PROBE_DIR`, corpus resolution, `TEST_AUTOMATED_BASELINE`)
- `evidence/proof04-subject-dxa.mjs` — the SUBJECT producer
- `evidence/proof04-oracle-memmap.mjs` — the ORACLE producer
- `evidence/proof04-reconcile.mjs` — the JOIN driver, plus `--self-check`
- `evidence/proof04-independence.test.ts` — the structural, non-vacuous independence test

## Decisions Made

- In-memory subject classification (D-P1 from the plan): no `.annostore` file is created or read anywhere in this plan.
- The oracle producer's short-run handling never throws — it records `ORACLE_DEPTH_REACHED`/`ORACLE_SHORT_RUN` and continues to `memmapshow`, per Success Criterion 3.
- `c1541.read`'s `name` argument had to be the directory listing's own lowercase display spelling (see Deviations below), not the plan's uppercase outcome-line convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `c1541.read` refused the plan's literal uppercase entry name**
- **Found during:** Task 1, the first live run of `proof04-subject-dxa.mjs`
- **Issue:** The plan's fixed input `ENTRY_NAME = "BRUCE LEE   (DC)"` is the uppercase display-form convention `PROOF-01`'s own evidence file uses. `c1541 -dir` prints CBM PETSCII names in LOWERCASE display form (`178  "bruce lee   (dc)" prg`), and `c1541 -read` matches against that exact lowercase spelling — the uppercase literal produced `c1541.read: expected exactly one result with a byteLength greater than zero; got 0 result(s)`.
- **Fix:** `extractEntryOverSeam()` now parses the `c1541.dir` listing for the entry's own quoted name (the same extraction `src/mcp/vice/dxa-live.test.ts`'s `extractCorpusProgram()` already uses, live-tested against this exact corpus), asserts it matches the expected entry name case-insensitively (so a genuinely different corpus still refuses loudly), and passes THAT raw name to `c1541.read`. `SUBJECT_ENTRY_NAME` still prints the canonical uppercase form for outcome-line consistency with `PROOF-01`'s own convention.
- **Files modified:** `evidence/proof04-subject-dxa.mjs`
- **Verification:** Re-ran the subject producer end to end; `SUBJECT_ENTRY_SHA256`/`SUBJECT_ENTRY_BYTES` matched the pinned expected values, and the full three-script pipeline (subject → oracle → reconcile) completed with `PROOF04_BUCKET_IDENTITY_OK true`.
- **Committed in:** `c62c261b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The fix is a correction to how the seam's own case convention was reached, not a change to what is measured — the extracted bytes, their digest and length, and every downstream number are unaffected. No scope creep.

## Issues Encountered

None beyond the deviation above.

## Known Stubs

None. Every script performs a real live measurement or a real, hand-derived self-check case; no placeholder data paths exist anywhere in this plan's files.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The rig (`SCHEMA.md`, the two producers, the join driver, the independence test, `--self-check`) is fully operational and independently re-runnable.
- Plan 44-02 (per the plan's own recorded decision D-P2) is expected to take two further runs: one licensed at anchor depth 50 (inside `EVID-06`'s proven `frame-exact-region`) and one explicitly `narrowed` deeper run, neither replacing the other.
- Plan 44-03 is expected to close out the phase's own evidence record and roll-up verdict (`PROOF04_PHASE_VERDICT`).
- No blockers. The broker was left `inactive` and no `x64sc` process was left running.

---
*Phase: 44-proof-04-the-independent-external-check*
*Completed: 2026-09-10*
