---
phase: "61"
slug: "the-install-tables-generated-and-a-guard-that-compares-facts"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-19"
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

Seeded by `/gsd-plan-phase` from `61-RESEARCH.md` § Validation Architecture. The
per-task map below is filled by `/gsd-validate-phase` once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test`) — no separate framework (`src/mcp/vice/package.json`) |
| **Config file** | none — `test-gate.mjs` names manual-only exclusions; everything else is auto-globbed |
| **Quick run command** | `cd src/mcp/vice && node --test <this phase's guard>.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm test` |
| **Estimated runtime** | TBD — measured at Wave 0 once the guard file exists |

**Suite-selection caution (carried, not re-derived):** `npm run test:automated`
skips the manual-only files named in `test-gate.mjs`. This phase's guard needs no
host binary, no emulator and no network, so it is **not** manual-only and runs
under either script. When comparing a run against a baseline, compare the failing
*set*, never the count.

---

## Sampling Rate

- **After every task commit:** the phase guard's own file, plus
  `node --test phase58-citation-ledger.test.ts` — load-bearing per D-08, because
  any `README.md` line movement can red it.
- **After every plan wave:** `cd src/mcp/vice && npm test`
- **Before `/gsd-verify-work`:** full suite green, plus `npm run typecheck`
- **Max feedback latency:** TBD — measured at Wave 0

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] The phase's generator module under `src/mcp/vice/` — nothing is testable until it exists
- [ ] Its colocated `.test.ts` guard — covers `GEN-01`, `GEN-02`, `GEN-03`

No shared fixture/conftest infrastructure is needed: the existing
`mkdtempSync(tmpdir())` fixture pattern in this suite is self-contained per test
file. No framework install is needed — `node --test` is already wired.

**Existing guards that must stay green rather than be added:**
`phase58-citation-ledger.test.ts` (re-anchored by D-08) and
`prerequisites.test.ts` (declaration untouched under D-02).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency measured and recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
