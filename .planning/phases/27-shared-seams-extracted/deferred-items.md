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

## D-27-05-A — `vice-proxy.test.ts` leaks two LISTEN sockets and prevents `node --test` from exiting

**Found during:** plan 27-05, criterion 4's whole-glob `npm test` evidence run.
**Symptom:** the whole-glob run does not terminate. After every test file has
emitted its results, the `vice-proxy.test.ts` child stays alive indefinitely.

Diagnosed rather than guessed, on PID 2308306 after 19 minutes of frozen output:

- process state `Sl`, and **zero CPU consumed across a 5-second sample**
  (`utime/stime` read `322 50` before and after) — it is not running anything
- **all 2410 of the run's flat TAP result lines already emitted**, the last one
  being `vice-proxy.test.ts`'s own final `vice_recycle` test
- **two LISTEN sockets still open**: `127.0.0.1:34211` (fd 21) and
  `127.0.0.1:42613` (fd 22), both held by that child

So the file finishes its tests and then cannot exit, because two
test-created listeners are never closed and keep the event loop alive.

**Reproduced twice on this host:** a stale run from an earlier plan sat in the
same state for 67 minutes before it was terminated, and plan 27-05's own run
reached it again. Terminating that one child lets the runner emit its totals,
and doing so adds **no** failure (`# fail 44` matches the dispositioned count
exactly), so the whole-glob totals are still genuine.

**Consequence for a future reader:** `cd src/mcp/vice && npm test` cannot be
expected to terminate unaided on a host with no broker. Budget for terminating
the hung `vice-proxy.test.ts` child once its results have all been emitted, and
say so in any evidence taken this way.

**Not fixed here:** `vice-proxy.test.ts` is in no phase-27 plan's
`files_modified`, it is on `test-gate.mjs`'s frozen nine-file
`MANUAL_ONLY_TESTS` list, and closing the leaked handles is stdio-proxy test
behaviour with no requirement in this phase.

## D-27-05-B — `contested` is prose-only and Direction 4's prefix scan exempts `note`

**Found during:** verification (`27-VERIFICATION.md` prohibition item 2,
verdict `HOLDS_WITH_RESIDUAL`); **accepted by henrik at UAT test 3** as a
residual rather than a phase-27 blocker.
**Symptom:** two structural holes in `module-classification.ts`'s guard set,
both about *future* entries rather than any present one:

- A contested capability-or-glue verdict is recorded as CONTESTED inside the
  free-text `note` (today: `r2000-test-gate.ts`, WR-10). Nothing mechanical
  forces a future contested verdict to be flagged — `contested` is not a
  structured field, so a guard cannot assert on it.
- `note` is deliberately exempt from Direction 4's name-prefix scan (which does
  cover `rationale`, every consumer path, every symbol and every requirement
  id). A future prefix justification parked in `note` therefore has no gate.

**Why it is not a phase-27 defect:** every present entry is correct and the
non-vacuity of Direction 4 is proven both ways (a planted name-justified entry
goes red; a clean control stays green), and Direction 1 was proven against a
real unclassified `r2000-*.ts` created on disk. The residual is about what a
later maintainer could add, not about what the record now says.

**Not fixed here:** promoting `contested` to a structured field changes the
classification record's schema and every consumer of it, and extending
Direction 4 to `note` needs the prose-exemption rationale revisited — both
outside plan 27-05's `files_modified`.
