---
status: testing
phase: 40-the-three-preprocessing-host-tools
source: [40-VERIFICATION.md]
started: 2026-09-08T13:41:56Z
updated: 2026-09-08T13:41:56Z
---

## Current Test

number: 1
name: Accept or reject the Ghidra per-run project directory staying OUTSIDE `.c64-re-tools/`
expected: |
  A project-owner decision on whether the two-location split
  (`tools/ghidra-runs/` + `.c64-re-tools/`) is acceptable long-term, or
  whether a future non-dot-prefixed alias should reunify it.
awaiting: user response

## Tests

### 1. Accept or reject the Ghidra per-run project directory staying OUTSIDE `.c64-re-tools/` (at `tools/ghidra-runs/`) as a permanent, standing exception to the D-33 "one root" consolidation
expected: A project-owner decision on whether the two-location split (`tools/ghidra-runs/` + `.c64-re-tools/`) is acceptable long-term, or whether a future non-dot-prefixed alias should reunify it.
why_human: Ghidra's own `hasDotPrefixedSegment()` refuses any ancestor path segment starting with `.`, verified directly against `ghidra-project.test.ts` before any code was written that would have broken it. So this is an evidence-backed technical necessity, not a bug — but it IS a deviation from 40-01's own declared must-have truth ("every tool-written file lands under one repo-root directory") and from the phase's declared artifact list. Plan 40-01 flagged it `human_judgment: true` and recorded it in code, in `CLAUDE.md`, and on the folded consolidation todo. One Task 3 acceptance criterion (`grep -ac 'ghidra-runs' .gitignore` expected 0) fails as a direct consequence.
result: [pending]

### 2. Confirm the fake-stand-in-binary substitution used for PREP-04's non-vacuity proof on `c1541.bam`/`c1541.chain`/`c1541.read` is an acceptable resolution, and that `findSiblingBinary()`'s $PATH-fallback branch needs no dedicated automated test
expected: A decision that (a) proving classifier-vs-exit-status disagreement via fake stand-in binaries — reproducing the MEASURED `c1541.dir`/`entry` failure text, and the DOCUMENTED general D-09 shape for `c1541.bam`/`chain`/`read` — is sufficient evidence for "a failure is reported as a failure, proven separately on each of the two shipped tools"; and (b) `findSiblingBinary()`'s PATH-fallback branch having no dedicated unit test is an acceptable residual gap.
why_human: Live re-measurement against both installed VICE builds found `c1541.bam`/`chain`/`read` actually exit **1** on a real failure — contradicting `host-tool.mts`'s own general D-11 comment, which was written from a `-dir`-only measurement. An exit-1 failure makes the exit-status-only predicate AGREE with the classifier, which is a vacuous control, so those three ids could not take their non-vacuity fixture from the real binary. The classifiers are pure POSITIVE-shape checks (a specific success marker must be present), so they are architecturally robust to any failure text lacking that marker regardless of exit code; and 2 of 6 ids (`c1541.dir`/`entry`) plus `petcat.decode` ARE verified end-to-end against the real binary's real failure output. But no test proves the real classifier refuses the real `c1541 -bam`/`-chain`/`-read` failure output specifically. Disclosed in `host-tool-oracle.test.ts`'s header with the measurements; 40-02 flagged the sibling PATH-fallback branch `human_judgment: true` for the same reason. Whether this meets the owner's evidentiary bar is the owner's call.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
