---
created: 2026-08-28
source: phase-28 code review round 3 (28-REVIEW.md), findings CR-05, CR-06, CR-07,
  WR-12 and IN-05 — all NEW in round 3, none fixed, recorded here so every id has a
  disposition and none is silently lost between gap-closure rounds
severity: blocker
resolves_phase:
audit_acknowledged:
  milestone: v0.7.0
  at: 2026-09-01
---

# Phase 28 review round 3 — five new findings, disposition: OPEN, not fixed

## Why this file exists

Round 3 of the phase-28 code review ran at the tail of the second gap-closure round
(`/gsd-execute-phase 28 --gaps-only`, plans 28-10..28-12). It confirmed that three of
round 2's four blockers are genuinely closed and found **five new findings**, three of
them blockers. `docs-review-disposition.test.ts` reported them undispositioned the
moment `28-REVIEW.md` was written:

```
finding(s) with no disposition anywhere -- fix them and cite the plan/SUMMARY, or file a todo naming the reason:
  28-REVIEW.md (28-the-store-core): CR-05
  28-REVIEW.md (28-the-store-core): CR-06
  28-REVIEW.md (28-the-store-core): CR-07
  28-REVIEW.md (28-the-store-core): IN-05
  28-REVIEW.md (28-the-store-core): WR-12
```

They are dispositioned **here** and not by editing `28-VERIFICATION.md`, for the same
reason the round-2 `IN-02` todo gives: `VERIFICATION.md` is evidence written by the agent
that did the verifying, and editing it from the orchestrator seat to turn a guard green is
fact-laundering. A todo is the guard's own documented alternative, and it survives the next
re-verification.

**This is a tracking record, not a fix.** Full evidence — reproductions driven through the
production functions, with verbatim output — is in
`.planning/phases/28-the-store-core/28-REVIEW.md`. Do not re-derive it here; read it there.

## Disposition: OPEN, out of scope for the round that found them

All five were discovered *by* the review that closes out plans 28-10..28-12, so none of
those plans could have addressed them. Closing CR-05..CR-07 is a **third gap-closure
round** (`/gsd-plan-phase 28 --gaps` → `/gsd-execute-phase 28 --gaps-only`), not a repair
that belongs to the round just executed.

## The findings

### CR-05 — blocker. Ring identity is the store path's basename *spelling*, not the store.

Reach the same store file under a second spelling (a symlink alias, or `mv proj.annostore
other.annostore`) and the next accepted write deletes **every** pointer row while starting a
second, unbounded ring. Reopening by the real path then reports `retained []` and refuses
`revertTo(1)`.

This makes 28-10's own stated residual **understated**: `28-10-SUMMARY.md` says the old ring
"is deliberately never deleted and `retainedRevisions()` honestly reports `[]`" — true of the
*files*, false of the *rows*, so renaming back recovers nothing. Correcting that claim is part
of closing this.

Directly contradicts 28-10's own prohibition *"MUST NOT destroy the only remaining route back
to a state the store still advertises as reachable."*

### CR-06 — blocker. `commitTransaction` at step 8 is outside every handler.

28-11 wrapped the staging call, the CAS/publish/pointer-insert window and the prune below it —
but not the statement between them. A concurrent **reader** is enough (`COMMIT` needs
EXCLUSIVE; `begin immediate` never excluded readers): the write escapes the `ViceError`
family as a bare `Error: database is locked` and leaves a leaked transaction on the writer's
handle, still holding the write lock. So WR-01's complaint is still true, one statement later.

### CR-07 — blocker. `reconcileSnapshotRing`'s new transaction is not exception-safe.

No `try/finally` around the transaction it opens, so a throw between `anno-store.ts:702` and
`:757` leaves it open on the caller's connection — and step 9's WR-02 wrap *swallows* the
throw. Reproduced two ways (commit `SQLITE_BUSY`, and `EACCES`/`ENOTDIR` out of
`readdirSync`). It conceals itself: a later sweep then fails `begin immediate` and reports
`deferred: true`, indistinguishable from ordinary contention — which defeats the very
reporting field 28-11 added.

### WR-12 — warning. Regression introduced by 28-12.

`lstatSync(p, { throwIfNoEntry: false })` suppresses only `ENOENT`, so `ENOTDIR` (a
regular-file ancestor) and `EACCES` now escape `openStore` as bare `Error`s where the previous
`existsSync` returned. It also falsifies `realpathOfNearestExisting`'s own doc claim that every
`lstatSync` failure is rethrown as `AnnoStorePathError`.

### IN-05 — info. Wrapped refusals drop the SQLite code.

Every wrap discards the underlying code and sets no `cause`, so contention and corruption are
only distinguishable by substring matching on the message. Informational; it is the reason
CR-06 and CR-07 are hard to tell apart from ordinary contention in the field.

## What closing these looks like

CR-06 and CR-07 are narrow and mechanical (bring `commitTransaction` inside the family wrap;
give the sweep's transaction a `try/finally`; stop step 9 swallowing a wedge). CR-05 is a
design question of the same shape 28-10 answered once — what identifies a ring when the same
inode has two names — and should be planned, not patched. WR-12 rides along with whichever
plan touches `realpathOfNearestExisting`. IN-05 is optional and additive.
