# Phase 27 — Deferred Items

Out-of-scope discoveries logged during execution. Not fixed: each lies outside
the touching plan's file set (executor scope boundary).

## D-27-02-A — `r2000-session.test.ts`'s five plan-18-06 queue tests are ungated

**Found during:** plan 27-02, whole-glob `node --test '*.test.*'` run.
**Symptom:** 5 hard failures, all `R2000SpawnError: regenerator2000 was not
found on PATH`, at `r2000-session.test.ts:809` onward:

- `plan 18-06: five same-tick callers begin in strict FIFO arrival order`
- `plan 18-06: a throwing callback releases the queue and the following entry still runs`
- `plan 18-06: a waiting caller times out with R2000SessionBusyError and is removed from the queue before it can run late`
- `plan 18-06: the bounded wait applies only to waiting for the slot, not to a slow callback once it holds it`
- `plan 18-06: the queue prevents a client-side lost update, and bypassing it makes the same scenario fail loud as non-exercising`

**Why it is a real gap rather than a missing binary:** every OTHER
regenerator2000-dependent test in the same file is wrapped by
`skipReasonFor("r2000-session.test.ts")` and SKIPs cleanly with a message that
names `R2000_BIN`. These five spawn a real child with no gate, so on a host
without `regenerator2000` they FAIL where their siblings skip. The file is
untouched by phase 27 (last modified in phase 18) and the failures reproduce in
isolation.

**Not fixed here:** outside plan 27-02's `files_modified`, and it touches the
r2000 session/spawn family that plan 27-04 owns.

## D-27-02-B — `vice-proxy.test.ts` needs a live host, and the whole-glob run does not know that

**Found during:** the same whole-glob run — 39 failures, all in
`vice-proxy.test.ts`.
**Disposition:** expected, not a regression. `vice-proxy.test.ts` is the second
entry of `test-gate.mjs`'s frozen nine-file `MANUAL_ONLY_TESTS` list precisely
because it needs a reachable host / broker, and no broker was running (running
one would deterministically redden `BACK-05`). `npm test`'s bare glob does not
consult that list, so the whole-glob run cannot be read as a pass/fail verdict
on its own — the dispositioned nine must be subtracted by hand. Recorded so a
future reader does not mistake the 44 for a phase-27 regression.
