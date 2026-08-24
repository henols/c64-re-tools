---
phase: 19
slug: absorbed-procedures-and-the-coverage-instrument
status: draft
nyquist_compliant: false
created: 2026-08-24
---
# Phase 19 Validation Strategy

| Requirement | Plan | Automated evidence |
|---|---|---|
| ABS-01 | 19-01, 19-02 | upstream-audit test; skill-tool coverage; package-content check |
| ABS-02 | 19-01, 19-02 | attribution/notice assertions and packed-payload check |
| ABS-03 | 19-05 | `check-skill-description-overlap.mjs` plus collision control |
| ABS-04 | 19-01, 19-05 | pinned manifest and resync-trigger assertion; `19-DECISIONS.md` reversal-condition count |
| COV-01 | 19-03, 19-04 | `r2000-coverage.test.ts` separate-metric tests; live `r2000 coverage` run against an unseen fixture |
| COV-02 | 19-03 | auto-label, generic-comment, and multi-caller negative controls |
| SURF-03 | 19-04 | `packer-finding.test.mjs` never-infer-a-name planted violation plus the oracle live-gate skip/fail proof |

Plan attribution above is checked against the final plan set's `requirements:` frontmatter
(19-01 `[ABS-01, ABS-02, ABS-04]`, 19-02 `[ABS-01, ABS-02]`, 19-03 `[COV-01, COV-02]`,
19-04 `[SURF-03, COV-01]`, 19-05 `[ABS-03, ABS-04]`), corrected in the planning revision pass so
this draft strategy agrees with the plans it governs. 19-05 Task 3 rewrites this file with
executed evidence at phase close.

Run focused tests after each task. Before close, run the Node 22 full suite, package checks, and a live coverage report against a fixture not used to author its rules.
