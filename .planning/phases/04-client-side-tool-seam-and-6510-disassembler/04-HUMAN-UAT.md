---
status: complete
phase: 04-client-side-tool-seam-and-6510-disassembler
source: [04-VERIFICATION.md]
started: 2026-08-17T13:53:42Z
updated: 2026-08-17T15:05:00Z
---

## Current Test

[none — all tests resolved]

## Tests

### 1. CI actually executes the ACME round-trip on a real push

expected: The `Install ACME cross-assembler` step in `.github/workflows/ci.yml`'s `build`
job succeeds, and the `Test` step (which sets `VICE_REQUIRE_ACME=1`) reports
`disasm-roundtrip.test.ts`'s 5 suites as **executed and passing, not skipped**.

why_human: All of Phase 4's work is committed to local `main` but has not been pushed to
`origin` — `gh run list` shows no CI run covering this phase. Whether GitHub Actions
really installs ACME on `ubuntu-latest` and runs the round-trip is a deployment-observable
fact only visible in the Actions log after a real push. It cannot be confirmed by static
inspection or local reproduction.

what_is_already_proven_locally: the exact CI command and env
(`VICE_REQUIRE_ACME=1 npm test`) passes 1321/0/11 locally, with
`disasm-roundtrip.test.ts`'s 5 suites passing with zero skips; and the gate was proven
non-vacuous — with ACME absent and `VICE_REQUIRE_ACME=1` set, the suite hard-fails rather
than skipping. The only unproven link is that `sudo apt-get install -y acme` resolves on
the GitHub runner image.

result: **PASSED** — confirmed 2026-08-17 against GitHub Actions run
[32039853822](https://github.com/henols/c64-re-tools/actions/runs/32039853822), commit
`4fb36a6`, conclusion `success`.

Evidence from the Actions log, all four links in the chain:

1. **ACME resolves on the runner image.** The `Install ACME cross-assembler (DISASM-03
   round-trip gate)` step reports `Setting up acme (1:0.97~svn20211115+ds-1) ...` and
   `command -v acme` → `/usr/bin/acme`. This was the only unproven link — `apt-get install
   -y acme` does resolve on `ubuntu-latest`.
2. **The gate env is actually set.** The `Test` step's env block shows `VICE_REQUIRE_ACME: 1`.
3. **All five round-trip entries executed and passed, zero skips:**

   ```
   ok 308 - ACME availability gate (D-08)
   ok 309 - Suite A: full 256-opcode round-trip through vice_disassemble's own listing (D-13, D-09)
   ok 310 - Suite B: a realistic fragment round-trips byte-exact (branches, D-11 shrink hazard, D-10 page-wrap, jsr, illegal-but-expressible opcodes)
   ok 311 - Suite C: the acmeExpressible substitution table is byte-faithful in BOTH directions, driven from OPCODES (D-09)
   ok 312 - Suite D: the +2 size-force spelling is understood by ACME and produces the correct wide encoding (D-11)
   ```

   None carries a `# SKIP` marker.
4. **The run's only two skips are unrelated.** Suite totals were `# tests 1337 / # pass 1330
   / # fail 0 / # skipped 2`, and both skips are `stock-live.test.ts` entries 716-717,
   which are opt-in by design and require `VICE_LIVE_STOCK_BIN` to be set. Neither touches
   the round-trip.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. The single human-verification item is closed by direct observation of the Actions log.
