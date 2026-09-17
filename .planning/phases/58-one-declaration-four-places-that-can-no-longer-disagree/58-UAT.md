---
status: complete
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
source: [58-VERIFICATION.md]
started: 2026-09-17T19:33:53Z
updated: 2026-09-17T20:24:32Z
---

## Current Test

[testing complete]

## Tests

### 1. Push the phase 58 commits to origin and confirm the new decl-02-node18-proof CI job runs and passes on a real GitHub Actions runner.
expected: Job completes with exit 0 and the console output contains 'prerequisites.json parsed on Node 18 -- 8 tool record(s)'.
result: pass
evidence: |
  Measured, not asserted. Commits d0e9fb2e..589e56e0 pushed to origin/main
  2026-09-17T20:21Z, triggering CI run 35270271098.

  Job decl-02-node18-proof (id 105367530978), runs-on ubuntu-latest:
    - actions/setup-node@v4 resolved node-version 18 to a real interpreter:
      "Acquiring 18.20.8 - x64", then "node: v18.20.8". The Node floor is
      genuinely exercised, not merely declared in the job spec.
    - Step "Prove prerequisites.json parses on the installer's own Node floor"
      emitted the expected line verbatim:
          prerequisites.json parsed on Node 18 -- 8 tool record(s)
      The record count is 8, matching the eight tools the phase declares.
    - Job concluded success in 12s (exit 0).

  The sibling 'build' job on the same run also passed (2m37s), so the pushed
  tree is green as a whole, not only on the new job.

  Note: the run carries a GitHub-side annotation that actions/checkout@v4 and
  actions/setup-node@v4 are forced onto Node 24 because Node 20 is deprecated.
  That governs the ACTION RUNTIME, not the interpreter under test — the step's
  own 'node: v18.20.8' line is the authority for what parsed the file, and the
  two are independent. No action required for this phase.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
