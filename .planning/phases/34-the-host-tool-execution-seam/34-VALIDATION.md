---
phase: "34"
slug: "the-host-tool-execution-seam"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-03"
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `34-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled by `/gsd-validate-phase` once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/package.json`'s `"test"` script is the whole config |
| **Quick run command** | `cd src/mcp/vice && node --test broker-control.test.ts spawn-seam.test.ts hostpath-consumers.test.ts host-scripts.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~5s quick · ~3min full |

**Recorded baseline, not a gate:** the project's own floor for `npm run test:automated`
is **5 failing tests in 3 files** as of 2026-09-02 (two named bookkeeping causes) — a
residual failure at that baseline is not caused by this phase. Never assume a 0 floor;
measure it before and after. A live VICE broker also deterministically reds the BACK-05
test — stop the broker before trusting any suite result.

---

## Sampling Rate

- **After every task commit:** Run the quick run command, scoped to the files touched
- **After every plan wave:** Run `npm run test:automated` and compare against the measured baseline
- **Before `/gsd-verify-work`:** Full suite at baseline, plus `npm run typecheck` and `node scripts/check-npm-packages.mjs` both green
- **Max feedback latency:** ~5 seconds (quick), ~180 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → test route (from RESEARCH.md § Validation Architecture)

| Req ID | Test Type | Route | File Exists? |
|--------|-----------|-------|-------------|
| SEAM-01 | integration | `broker-control.test.ts` — new op dispatched with VICE deps stubbed; assert no lease call | ❌ Wave 0 |
| SEAM-02 | unit | new `host-tool.test.ts` — typed allowlist / argv construction | ❌ Wave 0 |
| SEAM-03 | integration | commit the session's live 64 KiB probe as a real test | ❌ Wave 0 |
| SEAM-04 | unit | pure dot-path refusal function, synthetic paths, no Ghidra install required | ❌ Wave 0 |
| SEAM-05 | structural | new `scripts/check-no-skill-external-spawn.mjs` + test, scoped via `packFiles()` | ❌ Wave 0 |
| SEAM-06 | structural | second prefix floor in the `hostpath-consumers.test.ts` pattern + real positive control | ❌ Wave 0 |
| SEAM-07 | manual/doc | decision record carrying measurement + reversal condition — doc artifact, not code | N/A |

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/host-tool.test.ts` — typed allowlist / argv-construction unit coverage (SEAM-02)
- [ ] `src/mcp/vice/broker-control.test.ts` — extended cases: new-op dispatch isolated from VICE deps (SEAM-01), 64 KiB cap as a committed test (SEAM-03)
- [ ] Ghidra path-validation unit test that does NOT require a real Ghidra install (SEAM-04)
- [ ] `scripts/check-no-skill-external-spawn.mjs` + its test — the npm-pack-scoped grep gate (SEAM-05)
- [ ] Second prefix floor test + one real on-disk positive-control module (SEAM-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| JVM lifetime binding is a recorded decision carrying its measurement and reversal condition | SEAM-07 | A decision record is a documentation deliverable; no automated test can assert a rationale is honest | Read the decision record: it must name the measured JVM startup cost, the chosen binding, and a concrete checkable condition that would reverse it |
| The 64 KiB over-cap disconnect observed as a transcript | SEAM-03 | The *transcript* is the evidence artifact; the committed test is its automated counterpart | Confirm the recorded transcript shows a bare close with no error frame, and that the committed test asserts the same |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
