---
phase: 1
slug: corrected-ground-truth
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` § Validation Architecture.

**Phase shape note:** this phase produces no application code. Its deliverables are
(a) corrected markdown files and (b) a one-time empirical probe run whose output is
recorded, not re-run automatically. Verification is therefore **grep-based content
assertion** plus **artifact existence**, with the existing `node --test` suite used only
as a non-regression backstop.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` (project-wide, `.claude/mcp/vice/package.json`) — used as a regression backstop only, not as this phase's primary mechanism |
| **Config file** | none — this phase adds no `*.test.*` files |
| **Quick run command** | the per-requirement `grep` assertions in the map below |
| **Full suite command** | `cd .claude/mcp/vice && npm test` |
| **Estimated runtime** | grep assertions ~1s; `npm test` ~30s |

---

## Sampling Rate

- **After every task commit:** run the `grep` assertion(s) for the file(s) just edited.
- **After every plan wave:** run all six assertions together, plus `cd .claude/mcp/vice && npm test`
  as a non-regression check. This phase should not touch any `.ts`/`.mts` file — a failure
  here indicates scope creep, not a broken test.
- **Before `/gsd-verify-work`:** all six assertions pass and `npm test` is green.
- **Max feedback latency:** ~30 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-* | 01 | 1 | DOC-01 | — | N/A (docs) | content-assertion | `grep -c "no real ergonomic wrinkle\|cannot be a stopwatch\|compile-time \*feature\*" docs/phase0-binmon-findings.md` → expect `0` | ✅ green | ✅ green |
| 1-01-* | 01 | 1 | DOC-01 | — | N/A (docs) | content-assertion | `grep -c "VICE ≥ 3.10\|VICE >= 3.10" .planning/intel/constraints.md` → expect `>=1` | ✅ green | ✅ green |
| 1-01-* | 01 | 1 | DOC-02 | — | N/A (docs) | content-assertion | `grep -l "RL.*CY" docs/phase0-binmon-findings.md docs/stock-vice-parity.md` → expect both files listed | ✅ green | ✅ green |
| 1-01-* | 01 | 1 | DOC-03 | — | N/A (docs) | content-assertion | `grep -c PROVISIONAL .planning/intel/constraints.md` → expect `0` (corrected from the original narrow-context-window piped `grep`/`grep -c PROVISIONAL` combination, which returned `0` against the *uncorrected* file too since the `status:` line sits several lines below the heading and the narrow context window never reached it — see `01-04-SUMMARY.md`) | ✅ green | ✅ green |
| 1-02-* | 02 | 1 | VERIF-01 | — | N/A (probe) | artifact-existence | `test -f docs/phase1-probe-results.md && grep -c "PALETTE_GET" docs/phase1-probe-results.md` → file exists, `>=1` | ✅ green | ✅ green |
| 1-02-* | 02 | 1 | VERIF-04 | — | N/A (probe) | content-assertion | all five UNVERIFIED items appear in `docs/phase1-probe-results.md`, each marked resolved or accepted-unknown (count = 5) | ✅ green | ✅ green |

*Status legend: pending (box-drawing placeholder, not used below) · ✅ green · ❌ red · ⚠️ flaky*

*Plan 01 (doc corrections) and Plan 02 (probe run) are independent — both sit in Wave 1
with no ordering between them, per the ROADMAP Phase 1 note.*

---

## Wave 0 Requirements

- [ ] No `tests/` fixtures needed — verification is grep-based content assertion, not unit tests.
      Plans must embed the six assertions above directly as task-level verification steps rather
      than writing a throwaway shell script.
- [ ] `docs/phase1-probe-results.md` does not exist yet — the probe-execution plan creates it.

*Existing `node --test` infrastructure covers the regression backstop; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Probe run against real emulators | VERIF-01 | Requires launching `x64sc` with a display and a live binary-monitor socket; inherently a one-time empirical run, not a repeatable CI test | Run `.claude/mcp/vice/probe-binmon.mjs` against `/usr/bin/x64sc` (stock 3.9) and `/usr/local/bin/x64sc` (fork 3.10), capture stdout verbatim into `docs/phase1-probe-results.md` |
| Fork-vs-stock 3.10 equivalence | VERIF-04 | No stock 3.10 build is available in this environment; cannot be resolved empirically here | Record as an accepted unknown stating what breaks if the fork's binary monitor diverges from stock 3.10 |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

All six requirement-level assertions in the Per-Task Verification Map above pass, the
DOC-03 row's broken narrow-context-window assertion is fixed (it now uses a whole-file
`grep -c PROVISIONAL`), and the `npm test` non-regression backstop is green (see
`01-04-SUMMARY.md` for the full gate-run record). Signed off after Phase 1 Plan 04 closed
the probe-execution half and retired the two remaining "probe outstanding" references.

**Approval:** approved 2026-08-12
