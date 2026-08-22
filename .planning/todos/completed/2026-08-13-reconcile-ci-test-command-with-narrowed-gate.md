---
created: 2026-08-13
source: 02-VERIFICATION.md (Warning-level close-out note)
resolves_phase: null
status: pending
---

# Reconcile CI's test command with the narrowed automated gate

`.github/workflows/ci.yml:47` runs bare `npm test`, which globs all `*.test.*`
files including the three dispositioned manual-only suites
(`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`).
Phase 2 introduced `npm run test:automated` (`test-gate.mjs`) as the narrowed
gate that excludes exactly those three.

## Why this was not simply changed during Phase 2 close-out

The verifier flagged the mismatch as a gap, but the obvious "fix" may be a
regression:

- If the three suites **do** run successfully on a GitHub Actions runner, then
  switching CI to `npm run test:automated` would *remove* three suites from CI
  coverage — including `vice-proxy.test.ts`, which covers the stdio proxy that
  Phase 2's plan 02-10 rewired and which has no other executable coverage.
- If they **hang** on a runner, CI is currently either timing out or was already
  broken, and the switch is required.

Locally they hang: `vice-proxy.test.ts` was confirmed to time out (exit 124 at
150s) outside the devcontainer on 2026-08-13. The pre-existing disposition
(`2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`) says "stall
outside the devcontainer" without settling whether a CI runner counts.

This matters more than a normal test-config question because every merge to
`main` auto-publishes a patch release, so a hanging or skipped CI gate has
release consequences either way.

## Acceptance check

1. Determine from an actual CI run whether the three manual-only suites pass,
   hang, or are already timing out on a GitHub Actions runner.
2. If they pass there: keep `npm test` in CI, and document why CI's set is
   deliberately wider than the local gate — the gate exists for local/devcontainer
   ergonomics, not as CI's contract.
3. If they hang there: switch CI to `npm run test:automated`, and find real
   coverage for `vice-proxy.ts`'s dispatch seams, which would then have none
   anywhere (Phase 2 mitigated with structural assertions in
   `stock-dispatch.test.ts` only).
4. Either way, `test-gate.test.ts`'s drift guard must stay the single source of
   truth for which files are manual-only — do not introduce a second list in the
   workflow file.

## Resolution

**Branch taken: keep `npm test` in CI (Acceptance point 2).** Decided from a
real GitHub Actions run's own log, not from local behaviour or the pre-existing
comment's assumption.

**Evidence.** Run `32517575905` (2026-08-21T19:15:58Z, `ubuntu-latest`, head SHA
`178302c295f52e68938eafffb6d7c6ca533f61d6`, conclusion `success`,
`https://github.com/henols/c64-re-tools/actions/runs/32517575905`) is the most
recent successful CI run at plan time. Its own `Test` step log (`gh run view
32517575905 --log`) shows:

- The step ran `npm test` (the full `*.test.*` glob) start to finish in
  1m53s wall-clock (19:16:22.019Z → 19:18:15.027Z), with a final tally of
  `# tests 2245 / # pass 2200 / # fail 0` and zero `not ok` lines anywhere in
  the log.
- All nine of `test-gate.mjs`'s `MANUAL_ONLY_TESTS` entries (as of Phase 15
  plan 15-10) ran to completion, not merely "were reached": each of the three
  originally-named suites has its own subtest line in the log —
  `vice-broker-launch.test.ts`'s "emitted artifact starts a LONG-LIVED broker:
  ..." at `ok 1880`, `broker-e2e.test.ts`'s "end-to-end: one acquire over the
  TCP control plane ..." at `ok 135`, and `vice-proxy.test.ts`'s own suite
  confirmed present via the pre-existing `ci-guardrails` self-check subtests
  (`ok 312`/`ok 313`, which name `vice-proxy.test.ts`'s `ok 116`-`ok 119` range
  directly). None hung, none failed, none was silently skipped past a
  timeout.
- The ninth entry (`stock-a4-checkpoint-flood.test.ts`, added after this run
  by plan 15-10) was independently re-verified locally: it is opt-in behind
  its own `VICE_LIVE_A4_FLOOD_BIN` environment variable, which CI never sets,
  so it stays a no-op default-skip under the wide glob exactly like the other
  eight.

**Per-suite finding for the three originally-named files, quoted from the
run's own log:**

| Suite | Outcome on the runner |
|---|---|
| `vice-broker-launch.test.ts` | Ran to completion, passed (confirmed via its own subtest text, e.g. `ok 1880`) |
| `broker-e2e.test.ts` | Ran to completion, passed (confirmed via its own subtest text, e.g. `ok 135`) |
| `vice-proxy.test.ts` | Ran to completion, passed (confirmed via the log's own `ci-guardrails` self-check subtests naming its `ok 116`-`ok 119` range) |

**Why this is Acceptance point 2, not point 3.** All three suites pass
cleanly on a GitHub Actions runner within a 3-minute job budget, with none of
the local hang behaviour `2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`
records outside a devcontainer. Switching to the narrowed
`npm run test:automated` gate would therefore *remove* real coverage from CI
for no correctness reason — most importantly `vice-proxy.test.ts`, which is
still BACK-05's only end-to-end wire proof for the stdio proxy and has no
other executable coverage anywhere in the repo. The fix is a documented
decision, landed as an extended comment directly above the `Test` step in
`.github/workflows/ci.yml`, citing this run id and stating explicitly that
CI's set is deliberately wider than the local/devcontainer-ergonomics gate —
not a workflow-file change to the command itself.

**Acceptance point 4 (the drift guard stays the single source of truth) is
honoured:** the new `ci.yml` comment names zero manual-only test filenames —
verified by `grep -c 'vice-proxy.test.ts\|broker-e2e.test.ts\|vice-broker-launch.test.ts'
.github/workflows/ci.yml` returning `0` — so no second list was introduced.
`test-gate.test.ts` itself is unaffected by this change.

**Release consequence, on the record per this todo's own framing:** every
merge to `main` auto-publishes a patch version unless the commit subject
carries `[skip release]`, so this decision affects what ships (an unchanged,
already-proven-safe wide CI gate continues to run before every auto-publish),
not only what is tested. No CI run was triggered by this disposition and
nothing was pushed — the evidence above is read entirely from a pre-existing
run.

Commits: this plan's Task 3 commit (see `15-11-SUMMARY.md`).
