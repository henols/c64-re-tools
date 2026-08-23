---
phase: 17
slug: project-identity-and-ledger-close
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-23
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `17-RESEARCH.md` → `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node:test`) — no separate framework |
| **Config file** | none — invoked directly via `src/mcp/vice/package.json` scripts |
| **Quick run command** | `cd src/mcp/vice && node --test docs-deferred-ledger.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm test` (= `node --test '*.test.*'`) |
| **Estimated runtime** | quick ~2s · full ~2 minutes (~2386 tests; live/manual suites skip when their opt-in env vars are unset) |

**Do not substitute `npm run test:automated` for the phase gate.** It skips the
nine `MANUAL_ONLY_TESTS` suites and has previously hidden CI failures. The full
`npm test` is the documented gate (`STATE.md` → CI test-command divergence,
settled keep-`npm test`).

---

## Sampling Rate

- **After every task commit:** `cd src/mcp/vice && node --test docs-deferred-ledger.test.ts`
- **After every plan wave:** `cd src/mcp/vice && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds (quick) / ~120 seconds (full)

`GATE-01` (Phase 12) already forbids recording `status: passed` while any
`docs-*.test.ts` guard is red, so the quick command is the load-bearing signal
for every DEBT-04 task.

---

## Per-Task Verification Map

Task IDs are provisional — the planner owns the final decomposition. The
requirement→check mapping below is binding regardless of how tasks are numbered.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 (tracer) | 01 | 1 | DEBT-04 | — | N/A | unit/guard | `cd src/mcp/vice && node --test docs-deferred-ledger.test.ts` — non-vacuity test green, direction B still red | ✅ exists (currently RED) | ⬜ pending |
| 17-01-02 | 01 | 1 | DEBT-04 | — | N/A | unit/guard | `cd src/mcp/vice && node --test docs-deferred-ledger.test.ts` — all 4 tests pass | ✅ exists | ⬜ pending |
| 17-01-03 | 01 | 1 | CORE-01 | — | N/A | manual/evidentiary + grep | `grep -nE '[0-9]{4}-[0-9]{2}-[0-9]{2}' .planning/PROJECT.md` scoped to `## Core Value`, plus a named-evidence citation check | ❌ no guard today (discretionary) | ⬜ pending |
| 17-01-04 (closer) | 01 | 1 | DEBT-04, CORE-01 | — | N/A | structural + full suite | `ls .planning/todos/pending/ \| wc -l` = 0 **after** this task's own edits; Traceability table has no `Pending` row; `cd src/mcp/vice && npm test` green | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] No missing test files or fixtures.

**Atypical Wave 0 gap — name it, do not hunt for it.** The gap is not a missing
test; it is that an existing, load-bearing guard
(`src/mcp/vice/docs-deferred-ledger.test.ts`) is **currently red against the
real tree** because `.planning/todos/pending/` reached 0 files for the first
time. Its non-vacuity floor (`pending.length >= 2`) and its hard-coded
positive-control stem (a now-completed todo) both assume pending is never
empty. Fixing that behavior is the phase's tracer, not new coverage.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Core Value verdict is *weighed*, not a bookkeeping edit | CORE-01 | The judgement itself is not mechanizable; only its artifacts are | Confirm the `## Core Value` entry carries (a) an ISO date, and (b) a citation of the specific evidence weighed by name (e.g. Phase 11's sealed-question test, the symbol round-trip, `r2000_*`). A paragraph reading only "confirmed, no change needed" fails this check. Mirrors `docs-fork-decision.test.ts`'s requirement that FORK-01 name `KEYBOARD_MATRIX_SET` verbatim. |
| Restate-vs-keep decision is made by a human | CORE-01 | FORK-01 precedent: decided at an explicit blocking checkpoint, "not inferred, not auto-approved" | The plan must gate this behind a `checkpoint:decision`; an executor must not pick a side unilaterally. |
| Criterion 3 — no phase of this milestone left to run | DEBT-04 | Requires reading the milestone's own phase list, not just a file count | Traceability table in `REQUIREMENTS.md` shows no remaining `Pending` row; ROADMAP has no phase after 17; `.planning/todos/pending/` re-checked empty after the closing task's own edits. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a named manual-only justification above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (n/a — see Wave 0 note)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
