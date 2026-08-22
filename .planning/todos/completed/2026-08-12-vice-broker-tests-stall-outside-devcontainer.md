---
title: Three broker/proxy test files are not automatable — exclude them from the gate
date: 2026-08-12
priority: low
source: /gsd-execute-phase 1 — post-merge test gate investigation
---

# `npm test` cannot complete on a bare host

Three of the 24 test files in `.claude/mcp/vice` never finish when the suite runs
outside the devcontainer, so `npm test` times out rather than reporting:

- `vice-broker-launch.test.ts` — stalls at test 6 of 15
- `vice-proxy.test.ts` — stalls after test 11 of 110
- `broker-e2e.test.ts` — stalls (12 tests, none reported)

The other 21 files pass with **294 tests, 0 failures** (verified 2026-08-12 after
the fixes in `aff8117`).

## DISPOSITION (user decision, 2026-08-12)

**Not a bug to fix — these are not automatable.** They depend on manual host
setup (a real broker topology and a real emulator/display environment), so they
cannot be driven unattended. Do NOT sink further effort into making them pass
headless. Exclude them from the automated gate and treat them as manual /
environment-dependent checks.

Consequence: the automated test gate should run the 21-file subset, which is a
real signal (294 tests, 0 failures). A bare `npm test` is not a usable gate on a
host and its timeout must not be read as a regression.

## What was ruled out before that decision

- **Real emulator launches.** These files were spawning actual `x64sc` processes
  on the host, because `container-guard` only refuses to launch inside a
  container and the broker's default `VICE_BIN` resolves to `x64sc`. Fixed for
  `vice-broker-launch` in `9dc8265`; leakage is gone (`x64sc` count is 0 after a
  run) but the stall is unchanged, so it was **not** the cause.
- **The orphan reap killing the test's own processes.** Re-run with a unique
  `VICE_BIN` stub path that the reap cannot match: stall unchanged. (The reap is
  still a genuine safety bug — see
  [[broker-orphan-reap-substring-identity-match]], which IS worth fixing.)

Recorded for whoever revisits this: `vice-broker-launch.test.ts` test 6 has a
fully bounded body (`waitFor(..., 5000)`, `stopBroker()` = SIGTERM + 3s + SIGKILL)
yet never emits a TAP line at all, while tests 1-5 each finish under 400ms. Tests
7-9 in that file additionally assert container-guard refusal codes (`exit 2`,
`exit 3`, `verdict: CONTAINER`) that cannot hold on a host.

## Caveat

This is the broker subsystem the current milestone (`v0.2.0`, switchable
stock-VICE backend) is reworking, so this may be resolved or invalidated by that
work anyway.

## Resolution

**Closed `wont-fix` (Phase 15, plan 15-12), promoting the existing 2026-08-12 dated
user decision above into this Resolution rather than re-deciding it.** The three
named files (`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`)
depend on manual host setup — a real broker topology, a real emulator process, and a
real display environment — so they cannot be driven unattended in an automated gate.

**Consequence:** they stay excluded from the automated test gate
(`npm run test:automated` / `test-gate.mjs`'s `MANUAL_ONLY_TESTS`) and are treated as
manual, environment-dependent checks, not a regression when they hang or are skipped
under `npm run test:automated`.

**Cross-reference:** Phase 15 plan 15-11's CI test-command decision (Task 3, closed
todo `2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md`) touched this same
manual-only set from the other direction — it settled, from a real GitHub Actions run's
own log (run `32517575905`), that all nine `MANUAL_ONLY_TESTS` suites (including these
three) DO run to completion cleanly on a CI runner, so `npm test`'s wider glob stays in
CI while the narrower `npm run test:automated` remains the local/gate-facing subset.
That decision does not reopen this one: the two are about different environments (CI
runner vs. this repository's own dev/agent host), and the 2026-08-12 finding that these
three stall specifically on a bare host (not inside a devcontainer, not on the CI
runner) stands unchanged.

Disposed by DEBT-01 (Phase 15, plan 15-12) — this todo carried no `resolves_phase`
frontmatter field of its own (it predates that convention, filed at the v0.2.0
Phase 1 merge), so none is added retroactively; this Resolution section is the
authoritative closure record.
