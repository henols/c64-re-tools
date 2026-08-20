---
title: CI's ACME install step can hang the whole build for hours — no timeout, no retry
date: 2026-08-19
priority: medium
area: ci
source: observed live during the v0.3.0 release-asset fix run, 2026-08-19
files:
  - .github/workflows/ci.yml
---

# An apt mirror flake stalls the build job indefinitely

## Problem

Run `32303212069` (push of `4e42657` to `main`) sat **~25 minutes** on step 6,
`Install ACME cross-assembler (DISASM-03 round-trip gate)`, against a historical
build time of ~3 minutes. Steps 1-5 had all passed; the `Test` step never started.
Per-step status at the time:

```
5 completed success Typecheck
6 in_progress -     Install ACME cross-assembler (DISASM-03 round-trip gate)
7 pending    -      Test
```

The step is:

```yaml
run: |
  set -euo pipefail
  sudo apt-get update
  sudo apt-get install -y acme
  ...
```

Neither `apt-get` call has a timeout, a retry, or a mirror fallback, and the step
has no `timeout-minutes`. A slow or unresponsive Debian/Ubuntu mirror therefore
stalls the job until GitHub's default **6-hour** job limit kills it. Nothing in the
log says what is wrong while it happens — the step simply produces no output.

The run had to be cancelled and re-run by hand to make progress.

## Why it matters more than a normal flake

- `build` is a `needs:` dependency of `release`, `publish-npm` and
  `release-on-merge`. A stalled `build` blocks every publish path, so a release can
  silently sit unshipped for hours with no failure signal.
- The stall is indistinguishable, from the outside, from a genuinely slow test run.
  There is no diagnostic.
- It burns up to 6 hours of runner time per occurrence.

## Solution

Cheapest first:

1. Add `timeout-minutes` to the step (or the job) so a stall fails fast and loudly
   instead of hanging. ~5 minutes is generous for an apt install.
2. Wrap the two `apt-get` calls in a bounded retry (3 attempts) — mirror flakes are
   usually transient, and a retry turns a hard stall into a short delay.
3. Consider `apt-get -o Acquire::Retries=3` plus `-o Acquire::http::Timeout=30`,
   which handles it inside apt rather than in shell.

Do **not** drop the step or make it non-fatal: the comment on it explains it exists
so `disasm-roundtrip.test.ts` runs as a real gate rather than silently skipping, and
it deliberately proves the installed binary really is ACME by grepping its own
banner. That design is right; only its failure mode is wrong.

## Note

Unrelated to any code change in quick tasks `260819-tsz` or `260819-vie` — those
touched `version.ts`, `version.mjs`, `release-assets.sh` and the `release` /
`release-on-merge` jobs, none of which the ACME step depends on. The three
changed/new test files were verified to pass under bare `node --test` (the command
CI actually runs): 45 pass / 0 fail.
