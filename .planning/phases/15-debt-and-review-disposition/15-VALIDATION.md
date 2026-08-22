---
phase: 15
slug: debt-and-review-disposition
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-22
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase 15` from `15-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — invoked per file, or via `npm test` / `npm run test:automated` in `.claude/mcp/vice` |
| **Quick run command** | `node --test docs-review-disposition.test.ts` (plus the other `docs-*.test.ts` guard touched by the task) |
| **Full suite command** | `npm run test:automated` (i.e. `node test-gate.mjs` — the narrowed gate, excludes the 3 manual-only suites) |
| **Estimated runtime** | ~0.2 s quick guard · ~26 s full gate (measured 2026-08-22: 2094 pass / 0 fail / 5 todo, exit 0) |

All commands run from `.claude/mcp/vice`.

---

## Sampling Rate

- **After every task commit:** Run the specific `docs-*.test.ts` guard(s) that task touched, plus `npm run typecheck`
- **After every plan wave:** Run `npm run test:automated`
- **Before `/gsd-verify-work`:** Full gate must be green — all five `docs-*.test.ts` guards included
- **Phase gate:** all `docs-*.test.ts` guards green is `GATE-01`'s own mechanically-enforced precondition (`audit-gate.mjs`) before any milestone-audit `status: passed`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

*Populated by `/gsd-validate-phase` once `*-PLAN.md` task IDs exist. The requirement→test mapping the rows will be derived from:*

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| GATE-02 | Every review finding across all phases carries a cited disposition | guard (planning-doc) | `node --test docs-review-disposition.test.ts` | ✅ exists — **its parser regex is itself in scope for this phase** (only matches `### ID:` headings; blind to Phase 03's `####` style and Phase 14's `### IN-01 (Info) — …`). Not a Wave 0 gap: fixing the guard is phase work. |
| DEBT-01 | Pending-todo tree reflects real dispositions | guard (planning-doc) | `node --test docs-deferred-ledger.test.ts` | ✅ existing |
| DEBT-02 | Five undocumented behaviours documented where a user would look | manual review — no automated assertion warranted for prose additions | — | N/A — human-verify mode (`human_verify_mode: "end-of-phase"`) |
| DEBT-03 | Phase 03's three live UAT scenarios executed and recorded | manual/live — `03-HUMAN-UAT.md`'s own `result:` field | — | ✅ file exists; its 3 `pending` rows must become `pass`/`fail` with evidence |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**None.** This phase's tests are the existing planning-doc guards
(`docs-review-disposition.test.ts`, `docs-deferred-ledger.test.ts`) plus small
source-level fixes that land inside already-tested modules. No new test
framework or fixture is needed.

Where a fix changes a string an existing test asserts on (e.g. `stock-dispatch.test.ts`
if `WR-13`'s refusal message changes), update that test in the **same commit** as the fix.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The five DEBT-02 doc additions land where a user would actually look | DEBT-02 | Prose placement is a judgment call; no automated doc-content assertion is warranted | Read each cited file at the cited location; confirm the behaviour is described and the citation in the plan resolves |
| Phase 03 UAT scenarios 1–3 | DEBT-03 | Require a running emulator and real fixtures | Execute against `x64sc` per `03-HUMAN-UAT.md`; record `pass`/`fail` plus evidence in the scenario's `result:` field. Stock (`/usr/bin/x64sc`) and fork `x64sc`, `c1541`, `acme` and a display are all confirmed available in this environment |
| `WR-01` shell-interpolation fix (if in scope) | GATE-02 | Behavioural check of a spawn path | Confirm `probe-binmon.mjs` uses argv-array `spawnSync`, never a shell string |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a recorded manual-only justification
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references *(N/A — no Wave 0 gaps)*
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
