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
| ABS-02 | 19-02 | attribution/notice assertions and packed-payload check |
| ABS-03 | 19-02 | `check-skill-description-overlap.mjs` plus collision control |
| ABS-04 | 19-01 | pinned manifest and resync-trigger assertion |
| COV-01 | 19-03 | `r2000-coverage.test.ts` separate-metric tests |
| COV-02 | 19-03 | auto-label, generic-comment, and multi-caller negative controls |
| SURF-03 | 19-01, 19-03 | live packer finding and coverage report test |

Run focused tests after each task. Before close, run the Node 22 full suite, package checks, and a live coverage report against a fixture not used to author its rules.
