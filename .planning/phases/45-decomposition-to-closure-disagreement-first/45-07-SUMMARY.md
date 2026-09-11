---
phase: 45-decomposition-to-closure-disagreement-first
plan: 07
subsystem: annotation-store
tags: [ghidra, vice-broker, evid-ingest, bank-state-join, decline, stack-overflow, fixtures]

requires:
  - phase: 45
    provides: "plan 45-01's execution manifest and decomp-completeness scaffolding; plan 45-02's anno-store-export.ts D-02/D-03 export schema; plan 45-04's completeness measure set; plan 45-06's working live-VICE procedure (broker lifecycle, re-issue vice_execution_run before every poll)"
provides:
  - "Three committed, fully-typed Ghidra-derived .annostore.json fixture stores (ghidra/bank, ghidra/bank-path-dependent, ghidra/charset-phantom), D-12's derived half, typed by hand from the known static layout (no dxa for this family)"
  - "Real execution evidence anchored to a recorded run identity for all three fixtures, including bank-path-dependent.prg's own two-caller/two-bank-state capture and charset-phantom.prg's bounded-step capture of its self-executing charset chain"
  - "bank-path-dependent.prg's two bank-conditional addresses ($d000/$d020) captured as real anno_join_memmap DECLINE decisions with named reasons -- no bank state guessed"
  - "A MEASURED correction to 45-RESEARCH.md Section 9: charset-phantom.prg's 511-level jsr chain genuinely overflows the 6502's 256-byte hardware stack and does not unwind cleanly back to its own entry point"
affects: [45-08, 45-09, 45-10]

actuals:
  tokens: 489000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Broker started as a transient systemd --user unit and left running for the WHOLE session (contrast plan 45-06's one-broker-per-run), stopped once at the end -- matches this plan's own action text rather than 45-06's per-run pattern"
    - "A fresh openBrokerControl()/.acquire() control session is opened per fixture even when the broker daemon itself stays up: the connection IS the lease (vice-broker-client.ts's own release() comment), so a session cannot be reused across fixtures after release() destroys the socket"
    - "Load-completion verified at the file's OWN LAST bytes, never only its first few, before trusting a large .prg's autostart LOAD has fully landed -- checking only the entry point's own first bytes is a measured false-positive for a multi-KB file whose load is progressive over real time"
    - "A checkpoint on an address reached from N distinct callers is polled to hitCount >= N, never hitCount >= 1 -- stopping on the first hit silently drops every caller after the first"
    - "anno_evid_reset before anno_evid_ingest makes a live-capture script naturally idempotent against its own earlier, incomplete attempt under the same run identity"
    - "Execution bounded by an explicit, discrete step count (never a checkpoint wait) for a fixture whose own control flow does not terminate as designed -- mirrors 45-06's export-asm/smc.prg precedent, extended here to a fixture with a genuine stack overflow rather than an infinite loop"

key-files:
  created:
    - src/mcp/vice/fixtures/ghidra/bank.annostore.json
    - src/mcp/vice/fixtures/ghidra/bank-path-dependent.annostore.json
    - src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json
    - docs/phase45-ghidra-derivation-evidence.md
  modified:
    - src/mcp/vice/fixtures/ghidra/README.md

key-decisions:
  - "charset-phantom.prg's $1000-$17ff charset chain stays typed code end to end (Task 1's own shape), now backed by real positive evidence (640 of 2048 bytes observed executing) rather than only the byte-structural argument -- the remaining 1408 never-observed bytes are NOT re-typed on the strength of their own absence, per DECOMP-01's one-directional soundness rule."
  - "bank-path-dependent.prg's $d000/$d020 declines are recorded in the evidence document only, never persisted as a store comment in this plan's own export -- persistence of a DECLINED: comment is plan 45-09's authored-closure job, written FROM this derived evidence, per D-03's split."
  - "The decline reason actually observed ('no recovered processor-port value reaches...') differs from the plan's own illustrative example ('disagreeing processor-port values') because GHIDRA_REFTYPE_TO_ACCESS_KIND drops ordinary UNCONDITIONAL_CALL references, leaving the reachability graph with no call edge to walk -- disclosed as a genuine, previously-unmeasured importer limit rather than treated as a discrepancy to paper over; both are equally valid instances of the required decline-with-a-reason mechanism."
  - "charset-phantom.prg is executed via LOAD-only (run:false) plus a direct PC set at the real entry point, mirroring 45-06's own export-asm/smc.prg fallback -- vice_autostart({run:true})'s own simulated RUN keystroke was measured never to complete for this one larger fixture across three independent probes."
  - "Execution for charset-phantom.prg is bounded by an explicit vice_execution_step({count: 4000}) rather than a checkpoint at its own entry-call return address, because a live single-step trace proved the 511-level jsr chain overflows the 256-byte hardware stack -- the checkpoint was observed never to fire across two independent multi-minute attempts."

requirements-completed: [DECOMP-01, DECOMP-03]

coverage:
  - id: D1
    description: "All three ghidra/ fixtures' bytes are typed from the frozen twelve with zero undefined ranges, zero labels, provenance derived throughout, and full coverage of each fixture's own payload length (bank.prg 58/58, bank-path-dependent.prg 50/50, charset-phantom.prg 4095/4095)."
    requirement: DECOMP-01
    verification:
      - kind: unit
        ref: "manual node -e range/coverage assertions against all three committed .annostore.json files, run during execution (undefined_ranges=0, labels=0, exact coverage) -- not yet a committed automated test"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase45-ghidra-derivation-evidence.md -- Task 1 section, per-fixture route, volatile marking, classifyGhidraRunLog() verdict, and coverage-check table"
        status: pass
    human_judgment: true
    rationale: "The range/coverage assertions were run ad hoc during execution (matching plan 45-01/45-06's own precedent) rather than committed as a standing regression test."
  - id: D2
    description: "All three fixtures carry real execObservations from genuine stock VICE runs, anchored to a recorded run identity (image_sha256, argv_digest, seed): bank.prg (2012), bank-path-dependent.prg (2001, corrected mid-session to cover both callers), charset-phantom.prg (2555, from an explicit 4000-step bound after two disclosed live-execution findings)."
    requirement: DECOMP-01
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-ghidra-derivation-evidence.md -- Task 2 section, all three runs' full transcripts including the checkpoint/step sequence, memmapshow byte counts and per-address execute evidence"
        status: pass
    human_judgment: false
  - id: D3
    description: "bank-path-dependent.prg's own path-dependent addresses ($d000, $d020) are captured as real anno_join_memmap DECLINE decisions with named reasons, never a guessed bank state."
    requirement: DECOMP-03
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-ghidra-derivation-evidence.md -- the real runMemmapJoin() result quoted verbatim, both addresses declined"
        status: pass
    human_judgment: false
  - id: D4
    description: "charset-phantom.prg's contested $1000-$17ff region is typed by the MEASURED observation set, and the fixture README's own correction is appended (not overwritten) with the date and the evidence that forced it, including the genuine stack-overflow finding that corrects 45-RESEARCH.md Section 9's own 'unwinds cleanly' prediction."
    requirement: DECOMP-01
    verification:
      - kind: manual_procedural
        ref: "src/mcp/vice/fixtures/ghidra/README.md's own appended correction section; docs/phase45-ghidra-derivation-evidence.md's Finding A/Finding B sections"
        status: pass
    human_judgment: false
  - id: D5
    description: "The derived half regenerates byte-identically: bank.prg re-derived into a fresh scratch store reproduces the committed artifact's derived-half fields exactly (execObservations excluded by design)."
    requirement: DECOMP-01
    verification:
      - kind: manual_procedural
        ref: "docs/phase45-ghidra-derivation-evidence.md -- Task 3(3) section; git status --porcelain confirmed empty for the three .annostore.json files after the committed re-run"
        status: pass
    human_judgment: false

duration: ~200min
completed: 2026-09-11
status: complete
---

# Phase 45 Plan 7: The Ghidra Fixture Family — Derivation and Execution, With Two Measured Corrections Summary

**All three ghidra/ fixtures fully typed and hand-derived (no dxa) with real stock-VICE execution evidence, including a genuine measured stack-overflow correction to 45-RESEARCH.md's own "clean unwind" prediction for charset-phantom.prg and a two-caller bank-state capture for bank-path-dependent.prg that required mid-session correction to cover both bank states.**

## Performance

- **Duration:** ~200 min (extensive live-execution debugging; see Deviations)
- **Started:** 2026-09-11 (session start)
- **Completed:** 2026-09-11T09:31:24Z
- **Tasks:** 3 completed
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- All three fixtures in this family (`ghidra/bank.prg`, `ghidra/bank-path-dependent.prg`,
  `ghidra/charset-phantom.prg`) have committed, fully-typed `.annostore.json`
  stores: every byte typed from the frozen twelve (zero `undefined`), typed
  BY HAND from the known static layout per this plan's own Task 1 action
  text (no `dxa` run anywhere in this family, unlike plan 45-06's dxa+Ghidra
  family), every range row `provenance: "derived"`, zero labels. Every
  Ghidra run marked `$0000-$0001` and `$D000-$DFFF` volatile on the
  EXISTING flat64k block before `analyzeAll()`, and no run ever fell back
  to non-volatile (`classifyGhidraRunLog()` confirmed clean on all three,
  no `VOLATILE-NEW` line anywhere).
- `bank-path-dependent.prg`'s own two path-dependent addresses (`$d000`,
  `$d020`) were captured as real `anno_join_memmap` DECLINE decisions with
  named reasons -- no bank state guessed. The observed decline reason
  ("no recovered processor-port value reaches...") differs from the plan's
  own illustrative example and is disclosed as a genuine importer
  limitation (`UNCONDITIONAL_CALL` is dropped by `GHIDRA_REFTYPE_TO_ACCESS_KIND`),
  not corrected in this plan's own scope.
- Real execution evidence for all three fixtures, each anchored to a
  recorded run identity reported by `anno_evid_runs`: `bank.prg` (2012
  observations, every one of the README's own seven reference addresses
  plus the terminal RTS confirmed `execute:true`), `bank-path-dependent.prg`
  (2001 observations, after a disclosed mid-session correction -- see
  Deviations -- covering BOTH callers under BOTH `$01` bank states),
  `charset-phantom.prg` (2555 observations, from an explicit 4000-step
  bound after two disclosed live-execution findings -- see Deviations).
- The broker ran as a single `systemd --user` transient unit for the whole
  session (per this plan's own instruction, contrast plan 45-06's
  one-broker-per-run pattern), stopped once at the end;
  `pgrep -x x64sc` confirmed empty after every run and at session end.
- The Ghidra fixture family's README gained a provenance section per new
  artifact and an APPENDED (never overwritten) correction section for
  `charset-phantom.prg`'s own `$1000-$17ff` typing, citing the new evidence
  document.
- `bank.prg`'s derived half was proven to regenerate byte-identically by
  actually re-deriving it into a fresh scratch store after the commit:
  every derived-half field matched, and `git status --porcelain
  src/mcp/vice/fixtures/ghidra` showed no diff for the `.annostore.json`
  files afterward.

## Task Commits

1. **Tasks 1+2 (combined, disclosed sequencing deviation, mirroring plan
   45-06's own precedent)** - `db042ffb` (feat) -- the three derived and
   live-executed stores.
2. **Task 3** - `2e7b4aca` (docs) -- provenance READMEs, the
   charset-phantom correction, the full evidence document, idempotence
   proven.

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/fixtures/ghidra/bank.annostore.json`,
  `bank-path-dependent.annostore.json`, `charset-phantom.annostore.json` -
  the three committed derived-half plus real execution-evidence fixture
  stores
- `src/mcp/vice/fixtures/ghidra/README.md` - three new provenance sections
  plus the appended charset-phantom typing correction
- `docs/phase45-ghidra-derivation-evidence.md` - new; every Ghidra run's
  volatile marking and log verdict, the real join decisions, all three live
  execution transcripts, both disclosed corrections in full, and the
  idempotence proof

## Decisions Made

- `charset-phantom.prg`'s `$1000-$17ff` stays typed `code` end to end --
  see key-decisions above.
- `bank-path-dependent.prg`'s declines are recorded in the evidence
  document only, not persisted as a store comment (plan 45-09's job).
- `charset-phantom.prg` is executed via LOAD-only + direct PC set,
  mirroring 45-06's `smc.prg` precedent, because `run:true` autostart never
  completes for this one fixture.
- Execution for `charset-phantom.prg` is bounded by an explicit step count,
  not a checkpoint, because the fixture's own 511-level `jsr` chain
  overflows the hardware stack and never reliably returns to a fixed
  address.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] bank-path-dependent.prg's first live capture stopped after only one caller**
- **Found during:** Task 2, verifying the captured execution evidence
  against both of the fixture's own callers
- **Issue:** The checkpoint at `probe`'s own shared `$0832` RTS is hit once
  per caller (this fixture's entire purpose). The first capture attempt
  used a poll loop that stopped the instant `hit_count >= 1`, capturing
  only call 1's own evidence; call 2 (the `$01=$33` path) never executed at
  all within the capture window, confirmed directly (`$081a`-`$0824`
  uniformly `execute:false`).
- **Fix:** Changed the poll loop to wait for `hit_count >= 2` before
  stopping. Used `anno_evid_reset` to clear the first, incomplete run's own
  1998 observations before re-ingesting the corrected, complete capture
  (2001 observations) under the same run identity.
- **Files modified:** `src/mcp/vice/fixtures/ghidra/bank-path-dependent.annostore.json`
- **Verification:** Both `$0827` (the shared `sta $d020`) and `$082c` (the
  shared `lda $d000,x`) confirmed `execute:true`, reached under both bank
  states, per the full re-capture transcript.
- **Committed in:** `db042ffb`

**2. [Rule 1 - Bug] A stray leftover disassembly-trace line in one memmapshow capture**
- **Found during:** Task 2, ingesting charset-phantom.prg's `memmapshow`
  reply
- **Issue:** The raw text-channel reply carried 89 bytes of a leftover
  `.C:xxxx ... RTS ...` disassembly-trace line prepended ahead of the real
  `addr: IO  ROM RAM` header -- residue from this session's own earlier
  debug probes reusing the same warm emulator instance. `anno_evid_ingest`
  correctly refused the malformed document by name rather than absorbing
  it.
- **Fix:** `rawMemmapShow()`'s own scratch capture helper now locates the
  real header and slices from there, discarding only the genuinely foreign
  leading bytes (never altering the real memmapshow payload itself).
- **Files modified:** none in the committed tree (the fix lives in this
  session's own gitignored scratch script, `.c64-re-tools/phase45-07-scratch/live-run.mts`)
- **Verification:** The corrected capture ingested cleanly (2555
  observations written).
- **Committed in:** n/a (scratch tooling, not a committed deliverable)

---

**Total deviations:** 2 auto-fixed (2 bugs, both found and corrected during
this plan's own live-execution work). **Impact on plan:** Both fixes were
necessary for the plan's own must_haves ("bank-path-dependent.prg's
ambiguous addresses ... never a guessed bank state" and the general
requirement for real, non-fabricated execution evidence) to be genuinely
met rather than silently short of complete. No scope expansion beyond
correcting this plan's own captures.

### Disclosed sequencing note (not a numbered rule)

**Tasks 1 and 2 landed in one commit**, for the same reason plan 45-06
recorded: Task 2's live execution reads and writes the SAME scratch store
Task 1's derivation created, and re-deriving a second time purely to
produce a "Task-1-only" commit would waste an already-expensive live VICE
workload for no evidentiary benefit. Both tasks' own verify commands were
run and passed before the combined commit.

### Disclosed, extensively measured findings (not numbered rules -- genuine live-hardware/emulator behavior, not defects in this plan's own scope)

**`vice_autostart({run:true})`'s own simulated RUN keystroke never
completes for `charset-phantom.prg`.** Confirmed across three independent
live probes: the LOAD itself eventually succeeds (7-20s of real elapsed
time, progressive over the file's own size), but the machine is then
parked in the KERNAL's own idle loop indefinitely. `bank.prg` (60 bytes)
and `bank-path-dependent.prg` (52 bytes) both complete RUN normally. Root
cause not identified further given the time available (plausibly a
READY-prompt detection heuristic timing out before a much bigger loaded
block's own relink finishes) -- worked around via LOAD-only + direct PC
set, mirroring 45-06's own `export-asm/smc.prg` precedent.

**`charset-phantom.prg`'s own 511-level `jsr *+4 / rts` chain genuinely
overflows the 6502's 256-byte hardware stack.** A batched single-step trace
recorded the stack pointer descending NON-MONOTONICALLY across 2156 steps
(`f2, 8e, c6, 36, 3e, ce, 5e, ee, 7e, 0e, 9e, 2e, be` -- proof the 256-byte
stack page wrapped multiple times, since 511 nested calls need 1022 bytes
of return-address space). This CORRECTS 45-RESEARCH.md Section 9's own
prediction that the chain "unwinds cleanly back through every intervening
block's own trailing RTS" -- a checkpoint at the fixture's own predicted
return point (`$0822`) never fired across two independent multi-minute
attempts. What the measurement DOES confirm, unaffected by the correction:
the region stays observed executing (640 of 2048 bytes, real positive
evidence), satisfying DECOMP-01's own soundness rule regardless of how the
chain's control flow ultimately resolves. Recorded in full in both the
evidence document and the fixture README's own appended correction.

## Issues Encountered

**Broker acquire races during debugging (not a defect in the shipped
artifacts):** repeated rapid `pkill`+immediate-retry cycles against the
broker's own crash-supervision logic produced a brief multi-instance
launch storm during this session's own diagnostic work (never during the
final, committed captures). Resolved by fully stopping and cleanly
restarting the broker unit. No effect on the committed evidence, all of
which comes from clean, single-instance runs.

## Known Stubs

None. Every deliverable this plan claims (three typed stores, three real
execution runs anchored to a recorded run identity, the real join declines,
the two measured corrections, idempotence) is backed by a real, measured,
disclosed result -- no placeholder value or empty default stands in for
unimplemented behaviour.

## User Setup Required

None -- no external service configuration required. `x64sc` and Ghidra were
both already present on this host (per plan 45-01/45-06's own Wave 0
measurements) and were only detected, never installed.

## Next Phase Readiness

- The derived half for this fixture family is complete and committed;
  plan 45-09's own agent-closure pass (names, purpose comments,
  `DECLINED:` persistence for bank-path-dependent.prg's two addresses, the
  `DISAGREEMENT-ACCEPTED:` convention if ever needed) has real, honest
  material to work from for all three fixtures, including the two
  disclosed corrections this plan surfaced.
- Criterion 5's own multi-bit register-decomposition proof
  (`$D011`/`$D018`) is unaffected by either correction -- it is independent
  of how the charset body bytes end up typed, per RESEARCH.md's own note.
- The completeness gate is expected to report `FAIL` for all three
  fixtures in this family (every entry point still carries no authored
  name, and `bank-path-dependent.prg` also carries two unresolved
  referenced addresses) -- expected and correct: this plan ships the
  derived half and the execution evidence, not the closure.
- No blockers. `pgrep -x x64sc` and `systemctl --user is-active
  vice-broker-4507` were both confirmed clean before, during (between
  runs) and after this plan's work. `npm run test:automated` reports
  exactly 3 failures, all inside `docs/phase45-wave0-measurements.md`'s own
  named baseline set (the `anno-register.test.ts` requirement-id
  findings) -- the two named flakes outside that file did not fire this
  run, expected flake variability, never counted against the baseline.

---
*Phase: 45-decomposition-to-closure-disagreement-first*
*Completed: 2026-09-11*

## Self-Check: PASSED
