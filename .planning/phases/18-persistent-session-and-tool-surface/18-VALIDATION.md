---
phase: 18
slug: persistent-session-and-tool-surface
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-24
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `18-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled in once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework (`src/mcp/vice/package.json`, `"test": "node --test '*.test.*'"`) |
| **Config file** | none — glob-driven, colocated `*.test.ts` files under `src/mcp/vice/` |
| **Quick run command** | `node --test <file>.test.ts` (run from `src/mcp/vice/`) |
| **Full suite command** | `npm test` (run from `src/mcp/vice/`) |
| **Estimated runtime** | ~60–120 seconds for the full suite; single-file runs are seconds |

**Full-suite discipline (project lesson):** `npm run test:automated` skips
`MANUAL_ONLY_TESTS` and therefore hides CI failures. The phase gate is the full
`npm test`, never the filtered subset.

---

## Sampling Rate

- **After every task commit:** Run `node --test <file>.test.ts` for the single test file the task touched
- **After every plan wave:** Run `npm test` (full suite) from `src/mcp/vice/`
- **Before `/gsd-verify-work`:** Full suite must be green, live-gated tests included
- **Max feedback latency:** 120 seconds

**Live-gating rule:** live scenarios run through the existing `r2000-test-gate.ts`
seam (`skipReasonFor` / `assertR2000RequiredIfEnvSet`). A SKIP is acceptable only
when `regenerator2000` is genuinely absent from the environment — never as a
substitute for running it when the binary IS present.

---

## Per-Task Verification Map

Requirement-level map seeded from RESEARCH.md. Task IDs are bound by
`/gsd-validate-phase` after PLAN.md exists.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-03/3 | 18-03 | 2 | SESS-01 | — | No third spawn site; the long-lived path still guards `--vice` before spawn | unit (structural scan) | `node --test r2000-spawn-seam.test.ts` | ✅ | ✅ green — `18-PHASE-GATE-EVIDENCE.md` |
| 18-04/2 | 18-04 | 3 | SESS-02 | — | Crash-between-calls transparently respawns; crash-mid-call fails loud and recoverable | integration (live-preferred) | `node --test r2000-session.test.ts` | ✅ | ✅ green — `18-PHASE-GATE-EVIDENCE.md` |
| 18-03/2 | 18-03 | 2 | SESS-03 | — | Planted-violation save discipline across 3 scenarios under `SIGKILL` | integration (live-preferred) | `node --test r2000-session.test.ts` | ✅ | ✅ green — `18-PHASE-GATE-EVIDENCE.md` |
| 18-06/1 | 18-06 | 4 | SESS-04 | — | Concurrent mutating calls serialise; lost-update planted violation fails without the mutex | integration | `node --test r2000-session.test.ts` | ✅ | ✅ green — `18-PHASE-GATE-EVIDENCE.md` |
| 18-05/1 | 18-05 | 4 | SURF-01 | — | `r2000_read_region` curated; count and doc-drift guards hold | unit | `node --test r2000-tools.test.ts` | ✅ | ✅ green — `18-PHASE-GATE-EVIDENCE.md` |
| 18-05/2 | 18-05 | 4 | SURF-02 | — | D-32 refusal retired; composed answer matches a real 64K project | unit + gated integration | `node --test r2000-tools.test.ts` | ✅ | ✅ green — `18-PHASE-GATE-EVIDENCE.md` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/mcp/vice/r2000-session.test.ts` — new file covering SESS-02 / SESS-03 / SESS-04. Reuse `r2000-mcp-client.test.ts`'s `STUB_SOURCE` stub-server harness for protocol-shape assertions (extend its `STUB_MODE` set with the new session-reuse scenarios), and gate live scenarios through `r2000-test-gate.ts`, exactly as `r2000-tools.test.ts`'s gated integration test already does.
- [x] No new shared fixture files required beyond the existing `probe-illegal.prg` fixture (`.planning/phases/09-the-assumption-probe-go-no-go/evidence/fixture/probe-illegal.prg`) already used by `r2000-tools.test.ts`'s gated test.
- [x] Framework install: none — `node --test` is already wired.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification. Live-dependent scenarios are automated but environment-gated through `r2000-test-gate.ts`, not manual.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated by the Phase 18 gate on 2026-08-24.
