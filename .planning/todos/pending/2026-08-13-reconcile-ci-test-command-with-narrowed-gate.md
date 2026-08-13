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
