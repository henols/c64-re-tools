---
phase: "43"
slug: "the-runtime-evidence-layer"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-10"
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase` from `43-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/test-gate.mjs` is the automated-subset selector, not a framework config |
| **Quick run command** | `cd src/mcp/vice && node --test <touched>.test.ts && npm run typecheck` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~120 seconds (automated subset) |

**Known-good baseline is NOT zero.** `test:automated`'s floor is **3 failures** in
`anno-register` / `anno-import` (one named bookkeeping cause) as of 2026-09-09. An
intermittent 4th failure is a `zz-scratch` ENOENT race, not a regression. Never pipe
`npm test` (the full, non-gated glob) into `tail` — it hangs forever on
`vice-proxy.test.ts`, and reporting `tail`'s exit code fakes a green baseline. Redirect
and read `$?` on the same line.

**A live VICE broker deterministically reddens `vice-proxy.test.ts` BACK-05.** Stop the
broker before trusting any suite reading.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && node --test <touched>.test.ts && npm run typecheck`
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated`
- **Before `/gsd-verify-work`:** Full automated suite at its known 3-failure floor (not 0)
- **EVID-06's live A/B** is its own gate, recorded in the phase findings doc, independent of the unit suite
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Populated by `/gsd-validate-phase` once PLAN.md task IDs exist.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → test intent (from RESEARCH.md)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVID-01 | Durable, run-keyed, accumulating rows; idempotent re-ingest | unit | `node --test anno-store.test.ts` (extend) | ❌ W0 |
| EVID-02 | Migration-arm-vs-refusal decision recorded, reached from a factual field check | decision record | N/A — documentation deliverable | ❌ W0 |
| EVID-03 | Disagreement-first query; block table never overwritten; agreement as a count | unit | `node --test evid-reconcile.test.ts` (new) | ❌ W0 |
| EVID-04 | No `data` from absence; denominators on every summary; no `data` branch to return | unit + structural | `node --test evid-reconcile.test.ts` + structural source scan | ❌ W0 |
| EVID-05 | Bracket reset without leakage; concurrent-reset / relaunch safety | unit (multi-process) | `node --test anno-durability.test.ts` (extend) | ❌ W0 |
| EVID-06 | A/B measurement against a pass/fail rule fixed in advance | manual (live VICE) evidence script | one-off script, modeled on `frame-anchor-probe.mjs` | ❌ W0 |

---

## Wave 0 Requirements

- [ ] `evid-reconcile.test.ts` — covers EVID-03 / EVID-04, mirroring `dxa-proof01-compare.test.ts`'s structure
- [ ] Extend `anno-store.test.ts` — new table DDL, insert/read, idempotent re-ingest
- [ ] Extend `anno-durability.test.ts` — two-run-identity concurrent SIGKILL case (EVID-05)
- [ ] The EVID-06 A/B evidence script — modeled on `frame-anchor-probe.mjs`
- [ ] A structural banned-key test for the evidence layer's report output, mirroring `anno-coverage.test.ts`'s banned-key regex

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Instrumentation-perturbation A/B | EVID-06 | Needs a real emulator run at v0.8.0's anchor sequence; no unit test can answer whether instrumenting perturbs frame-exactness | Run the A/B script against `/usr/bin/x64sc` (genuine stock 3.9; `-default` must precede `-binarymonitor`), instrumentation on vs off, at ≥2 depths inside the proven window (≤ hit 50). Compare with the existing `compareCaptures()` predicate. Record the verdict against the rule fixed **before** the measurement. |
| Field-store existence check | EVID-02 | Whether a real `.annostore` exists in the field is a fact about the world, not about the code | Search the machine for `.annostore` files outside dated scratch caches; record the finding and the resulting decision (migration arm vs re-affirmed strict-equality refusal) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
