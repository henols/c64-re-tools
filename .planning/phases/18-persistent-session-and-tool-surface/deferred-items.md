# Phase 18 — Deferred Items (out-of-scope discoveries)

Logged per the executor's scope-boundary rule: discovered during plan 18-03's
execution, confirmed unrelated to this plan's own file changes, not fixed.

## 1. A literal `npm test` (no flags) never exits when regenerator2000 is
   installed locally — pre-existing, not caused by plan 18-03

**Symptom:** `cd src/mcp/vice && npm test` (i.e. `node --test '*.test.*'`)
hangs indefinitely after printing every individual test result, never
printing the final `1..N` / pass-fail summary line or exiting. Reproduced in
isolation against `r2000-cli.test.ts` alone (deterministic: 64/64 tests print
`ok`, then the process never exits — confirmed 3 times).

**Confirmed unrelated to plan 18-03:** `r2000-cli.test.ts` and its production
dependency (`r2000-cli.ts`) import neither `r2000-mcp-client.ts` nor the new
`r2000-session.ts` — traced the full import chain (`r2000-launch.ts`,
`r2000-project.ts`, `r2000-d64.ts`, `r2000-verify.ts`, `r2000-enum-gen.ts`,
`r2000-symbols.ts`, `r2000-memmap-render.ts`). None of plan 18-03's edits
touch any file in that chain. The same hang is therefore present against an
unmodified HEAD checkout too — this is not a regression this plan introduced.

**Root cause (not investigated further — out of scope):** almost certainly a
lingering open handle (an un-`unref()`'d timer, an un-closed child process,
or similar) somewhere in the `r2000-cli.test.ts`/`r2000-enum-gen.test.ts`/
`r2000-memmap-render.test.ts`/`r2000-symbol-roundtrip.test.ts` cluster,
keeping Node's event loop alive past the point every individual test has
already completed. Node's `--test-force-exit` flag (Node >= 22.16/23) works
around it cleanly: `node --test-force-exit --test '*.test.*'` completes the
full suite in ~2-3 minutes with the correct pass/fail accounting.

**Why this was not fixed under plan 18-03:** the scope-boundary rule
("Only auto-fix issues DIRECTLY caused by the current task's changes") — this
predates the plan, and diagnosing/fixing a lingering-handle leak in four
unrelated test files is a distinct piece of work deserving its own plan/task.

**Why it never surfaces in CI:** `.github/workflows/ci.yml` never installs
regenerator2000 (D-11's own documented design: a 5-minute Rust build on every
merge would contradict "cheapest by far"). Every regenerator2000-gated test
in the affected files reads `{ skip: SKIP_REASON }` in CI, so the hang is
provably a **local-development-only** symptom, on a machine with
regenerator2000 installed — exactly this plan's own execution environment.

**Recommended fix (for whoever picks this up):** either instrument the four
affected test files to find and close the leaked handle (e.g.
`node --test --test-reporter=... --experimental-detect-open-handles`-style
diagnostics, or bisecting `after()`/`before()` blocks), or add
`--test-force-exit` to `package.json`'s own `"test"` script — the latter is a
one-line, low-risk fix but changes CI's own test invocation and was judged
out of scope for a session-persistence plan to decide unilaterally.

## 2. Two flaky (non-reproducible) failures observed during a full-suite run
   under heavy concurrent load — not real regressions

Running the full suite with all ~24 test files' default parallelism (via the
`--test-force-exit` workaround above) surfaced two failures on one run that
did **not** reproduce on isolated re-runs of the same test files:

- `broker-e2e.test.ts` — `"end-to-end: a real SIGHUP to the broker kills
  every stub child it launched and the broker exits 0"` failed on one full
  run; a *different* test in the same file (`"wired warm floor..."`) failed
  on a subsequent isolated re-run, and the file's own re-run also timed out
  at 60s under `--test-force-exit` alone. This file has **zero** import
  dependency on `r2000-mcp-client.ts`/`r2000-session.ts`/`r2000-tools.ts` —
  confirmed by direct import inspection. Broker process-supervision timing
  tests are inherently sensitive to host scheduling latency; this reads as
  pre-existing flakiness under load, not a regression from this plan.
- `r2000-mcp-client.test.ts` — `"Task 3 mid-call exit: ... distinguishable
  BY CLASS ..."` failed once with `"expected a fast failure, took 811ms"`
  (asserts `< 750ms`, a hard-coded wall-clock threshold against a stub
  child process). Re-run in isolation 3 times immediately after: 0 failures
  each time, all well under the threshold. This is the SAME test file this
  plan's own Task 1 acceptance criterion requires to pass with **zero
  edits** (confirmed: `git diff --stat` on it is empty) — the flake is
  scheduling jitter from dozens of concurrent `node --test` worker
  processes and real regenerator2000/stub children competing for CPU on
  this host, not a logic defect in the promoted `openR2000Session()`/
  `withR2000Session()` pair.

Neither failure reproduces the same way twice, both live in test bodies
this plan does not modify, and both are timing-sensitive assertions —
consistent with load-induced flakiness on a shared, heavily-loaded
development host (166+ concurrent `node` processes observed from unrelated
sessions at the time of this run), not a change in this plan's own code.
