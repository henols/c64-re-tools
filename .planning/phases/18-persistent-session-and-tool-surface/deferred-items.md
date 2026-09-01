# Phase 18 — Deferred Items (out-of-scope discoveries)

Logged per the executor's scope-boundary rule: discovered during plan 18-03's
execution, judged unrelated to this plan's own file changes, not fixed.

**Item 1 was subsequently disproven and fixed** at phase 18 wave 2's
post-merge gate — see its own entry. Item 2 stands as recorded.

## 1. ~~A literal `npm test` never exits when the external analyser is installed~~
   — RESOLVED at wave 2's post-merge gate; the "pre-existing" attribution
   was WRONG

**Status: fixed, not deferred.** Left in place as a correction record, because
the original entry's reasoning is the instructive part.

**What was recorded:** that `cd src/mcp/vice && npm test` hangs after printing
every result, that it was pre-existing, that it was unrelated to plan 18-03,
and that `--test-force-exit` was an acceptable local workaround.

**What was actually true:** plan 18-03 introduced it. Rewiring
`runAnnoTool()` through `anno-session.ts`'s HELD single slot means the
retained `the external analyser` child — and its three `stdio: "pipe"` sockets, all
ref'd libuv handles — keep the event loop alive in every host that is not
`vice-proxy.ts`. `anno-cli.test.ts:1303` calls `runAnnoTool(...)` exactly
once and never closes the session (only `anno-session.test.ts` has the
`__resetAnnoSessionForTest()` seam), so its `node --test` worker printed all
64 `ok` lines and then hung forever. Three sibling files hung for the same
reason. The hazard was never test-only: any CLI verb or one-shot host reaching
`runAnnoTool()` once would also never exit.

**How the original conclusion went wrong — the transferable lesson:** it was
reached by *inspecting the import chain* (`anno-cli.ts` imports neither
`anno-mcp-client.ts` nor `anno-session.ts`, therefore not caused by this
plan) and never by *running the suite against an unmodified checkout*. The
import chain was read correctly and the inference from it was still false: the
coupling runs through a dynamic `await import("./anno-tools.ts")` inside the
test body, which a static chain walk does not see. A single measurement
settled it — the same file exits in 2s at the wave-1 tip `ebe90f8` and hung at
`f6a5b03`. **An "it predates me" claim about a suite is cheap to measure and
must be measured, never inferred.**

**The fix (commit at the wave-2 gate):** `openAnnoSession()` now calls
`child.unref()` plus an `unrefStream()` on each of `stdin`/`stdout`/`stderr`,
immediately after a successful handshake. A held session stops being a reason
for its host process to live, while staying fully usable — every `request()`
arms a ref'd `setTimeout` that holds the loop open for the duration of any
in-flight call or teardown, so no event is ever missed. All four unrefs are
load-bearing: `child.unref()` alone still hung (verified by removing the
other three). Plain `npm test` now exits 0 in ~88s: 2425 tests, 2381 pass,
0 fail, 39 skipped, 5 todo. `--test-force-exit` is no longer needed and
`package.json`'s `test` script is unchanged.

**Consequence handed to plan 18-04, deliberately:** a host that exits while a
session is still held now orphans that child until it observes stdin EOF.
Bounding that is 18-04's own charter (`18-STDIN-EOF-EVIDENCE.md` and the
synchronous `vice-proxy.ts` teardown calling `closeAnnoSessionSync()`). The
unref is the complement that keeps every *other* host exitable, not a
substitute for that teardown. Measured at this gate: no
`analyser --mcp-server-stdio` process survived any of the seven test
files run individually, nor the full suite.

## 2. Two flaky (non-reproducible) failures observed during a full-suite run

- **Status:** acknowledged
  (v0.5.0 close, 2026-08-25 — load-induced test flakiness on a shared host,
  not a regression; carried forward rather than fixed.)
   under heavy concurrent load — not real regressions

Running the full suite with all ~24 test files' default parallelism (via the
`--test-force-exit` workaround above) surfaced two failures on one run that
did **not** reproduce on isolated re-runs of the same test files:

- `broker-e2e.test.ts` — `"end-to-end: a real SIGHUP to the broker kills
  every stub child it launched and the broker exits 0"` failed on one full
  run; a *different* test in the same file (`"wired warm floor..."`) failed
  on a subsequent isolated re-run, and the file's own re-run also timed out
  at 60s under `--test-force-exit` alone. This file has **zero** import
  dependency on `anno-mcp-client.ts`/`anno-session.ts`/`anno-tools.ts` —
  confirmed by direct import inspection. Broker process-supervision timing
  tests are inherently sensitive to host scheduling latency; this reads as
  pre-existing flakiness under load, not a regression from this plan.
- `anno-mcp-client.test.ts` — `"Task 3 mid-call exit: ... distinguishable
  BY CLASS ..."` failed once with `"expected a fast failure, took 811ms"`
  (asserts `< 750ms`, a hard-coded wall-clock threshold against a stub
  child process). Re-run in isolation 3 times immediately after: 0 failures
  each time, all well under the threshold. This is the SAME test file this
  plan's own Task 1 acceptance criterion requires to pass with **zero
  edits** (confirmed: `git diff --stat` on it is empty) — the flake is
  scheduling jitter from dozens of concurrent `node --test` worker
  processes and real the external analyser/stub children competing for CPU on
  this host, not a logic defect in the promoted `openAnnoSession()`/
  `withAnnoSession()` pair.

Neither failure reproduces the same way twice, both live in test bodies
this plan does not modify, and both are timing-sensitive assertions —
consistent with load-induced flakiness on a shared, heavily-loaded
development host (166+ concurrent `node` processes observed from unrelated
sessions at the time of this run), not a change in this plan's own code.
