---
status: complete
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
source: [33-VERIFICATION.md]
started: "2026-09-03T02:19:11Z"
updated: "2026-09-03T12:55:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. Disposition criterion 3's unclosable clause
expected: A recorded decision — accept the degrade verdict (a), override to proven with the price acknowledged (b), or amend the criterion text for future phases (c). Not a gap-closure plan.
why_human: Requires an owner scope decision against a frozen pre-commitment
result: pass
decision: "(a) ACCEPT the degrade verdict as it stands"
decided_by: owner (Henrik), 2026-09-03
notes: |
  Disposition (a). The `R6 -> degrade` verdict and `ORACLE_NECESSITY: unproven`
  STAND as 33-11 recorded them. No override is written to the findings document,
  DECISION-RULE.md's rule text does not move, and the ROADMAP criterion text is
  left untouched. R6's narrowing is already pre-mapped by D-04 and bound into
  Phases 34-38, so accepting it requires no further action and creates no
  gap-closure plan.

  The one-frame clause of criterion 3 remains unclosable on this build -- a
  60 Hz KERNAL IRQ against a 50.125 Hz PAL frame gives a smallest reachable
  equal-raster separation of 2 frames. That is a hardware fact, recorded rather
  than argued away; a future phase wanting the strict pair needs a different
  anchor, not a re-reading of this one.

### 2. Exercise `vice_run_until` with `reproducible: true` + `frame_anchor` against real stock VICE
expected: |
  One sha256 and one four-term stop identity across the 0/1500/4000 ms jitter
  triple, through the SHIPPED seam.

  Why this is open: no evidence probe in the phase imports
  `stock-reproducible-run.ts` — all five drove the pieces directly via
  `stock-protocol.ts` / `broker-launch.mts`. `runReproducible()`'s only coverage
  is 30 unit tests against scripted clients, and it was changed by three
  code-review-fix commits (`edb5d7f`, `f00446b`, `d49a8ce`) AFTER every live run
  (`2b40040`, `678da05`, `01cfae9`). The code that was measured is not the code
  that ships. The invariants at stake — one resume per wait, poll on hit_count
  never on paused state, and the new `anchorHitCount === 0` refusal — are
  exactly the class CLAUDE.md's `vice-sync.ts` exemption calls unprovable by
  unit test.

  Note: stock VICE 3.9 is at `/usr/bin/x64sc`; the fork shadows it at
  `/usr/local/bin/x64sc`. `-default` must precede `-binarymonitor`.
why_human: Needs a live emulator; the seam has zero live coverage and changed after all measurement
result: pass
verified_by: evidence/reproducible-seam-probe.mjs (2026-09-03), against genuine stock VICE 3.9 at /usr/bin/x64sc
evidence: evidence/33-uat-shipped-seam.md
notes: |
  PASS through the shipped seam -- `handleRunUntil` (stock-run-until.ts), the only
  non-test caller of runReproducible(). Two independent invocations, three cold boots
  each. At jitter 0/1500/4000 ms: ONE four-term stop identity
  (PC=$ea31, hit_count=1, LIN=257, CYC=57 -- matching the module header's own claim
  byte for byte) and ONE 64K sha256 (bf083cb3...5c7438), the same sha across BOTH
  invocations. compareCaptures() with an EMPTY allow-list reports differing: 0 on all
  three pairwise comparisons -- the 64-address transient budget was not needed.
  resumes: 1 on every run (the "exactly one resume per wait" invariant, live);
  anchorCleanup: deleted / cleanup: auto_deleted_by_vice / machineHalted: true.

  One finding recorded, not a gap: the probe's FIRST run omitted
  STOCK_DETERMINISM_FLAGS (it spawned x64sc directly rather than through the broker).
  The stop identity still reproduced perfectly, but the 64K sha differed on all three
  runs -- 1032 single-bit flips confined to RAM ($0100-$9FFF, $C000-$CFFF), the
  signature of randomised power-on RAM init. The shipped broker emits the block
  unconditionally so the shipped route is never in that state; recorded because the
  stop identity CANNOT detect the condition, which is a measured argument for the
  unconditional emission REPRO-01 asked for.

### 3. Correct the three factually wrong sentences in `capture-predicate.ts`'s CONSUMER STATUS header
expected: The header stops claiming the module is imported by nothing outside its own tests, stops claiming `normalisePorts()` has never run against a real capture, and stops claiming the only runnable equivalence check is `derive-transients.mjs`. All three were false.
why_human: A judgement call on wording in a header whose whole purpose is to be the accurate status record
result: passed — fixed in commit `9c8de68` (2026-09-03), after independently confirming all three claims were false: four committed evidence probes import the module (`capture-pair.mjs:120`, `reset-removed-probe.mjs:103`, `frame-anchor-probe.mjs:86`, `determinism-probe.mjs:78`), `normalisePorts()` ran on three real captures at `capture-pair.mjs:680`, and `compareCaptures()` at `capture-pair.mjs:776` IS the `C0_CAPTURE_PAIR: pass` gate input. The header now states what is genuinely not-yet-wired: no shipped MCP tool or production caller reaches it. `npm run typecheck` clean after the edit.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
