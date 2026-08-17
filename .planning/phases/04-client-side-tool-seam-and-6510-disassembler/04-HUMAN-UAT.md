---
status: partial
phase: 04-client-side-tool-seam-and-6510-disassembler
source: [04-VERIFICATION.md]
started: 2026-08-17T13:53:42Z
updated: 2026-08-17T13:53:42Z
---

## Current Test

[awaiting human testing]

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

result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
