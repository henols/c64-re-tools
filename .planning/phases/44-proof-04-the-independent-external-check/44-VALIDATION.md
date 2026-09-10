---
phase: "44"
slug: "proof-04-the-independent-external-check"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-10"
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase` from `44-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/test-gate.mjs` is the automated-subset selector, not a framework config |
| **Quick run command** | `cd src/mcp/vice && node --test evid-reconcile.test.ts evid-ingest.test.ts textmon-memmap.test.ts block-class.test.ts && npm run typecheck` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~120 seconds (automated subset) |

**Known-good baseline is NOT zero.** `test:automated`'s floor is **3 failures** in
`anno-register` / `anno-import` (one named bookkeeping cause) as of 2026-09-09. An
intermittent 4th failure is a `zz-scratch` ENOENT race, not a regression. Never pipe
`npm test` (the full, non-gated glob) into `tail` — it hangs forever on
`vice-proxy.test.ts`, and reporting `tail`'s exit code fakes a green baseline. Redirect
and read `$?` on the same line.

**A live VICE broker deterministically reddens `vice-proxy.test.ts` BACK-05.** Stop the
broker before trusting any suite reading, and record `BROKER_STATE: inactive` before and
after every live evidence run — the discipline every evidence plan in this milestone used.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && node --test <touched>.test.ts && npm run typecheck`
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated`
- **Before `/gsd-verify-work`:** Full automated suite at its known 3-failure floor (not 0)
- **The live measurement is its own gate**, recorded in `evidence/proof04-*.md` with its
  derivation rule fixed **before** the run, independent of the unit suite
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Populated by `/gsd-validate-phase` once PLAN.md task IDs exist.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

### Requirement → test intent (from RESEARCH.md)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROOF-04 · Criterion 1 (count computed) | A live run against real cracked code produces a genuine `disagreementCount` / denominator pair with its positive class named | live evidence transcript — a **measurement**, not an assertion of a known number (the same shape `PROOF-01` and `EVID-06` used) | N/A by design — no CI assertion of a specific count | N/A by design |
| PROOF-04 · Criterion 2 (structural independence) | Neither producer script imports the other's domain; the oracle producer cannot read the classifier's output | unit / structural | `node --test evidence/proof04-independence.test.ts` | ❌ W0 — new file, following `textmon-memmap.ts`'s own import-purity test pattern |
| PROOF-04 · Criterion 2 (join purity) | `reconcileObservedExecution()` fetches nothing and mutates nothing | unit | `node --test evid-reconcile.test.ts` | ✅ already exists and passing (Phase 43) |
| PROOF-04 · Criterion 3 (shortfall / `not-exercised`) | The derivation rule is written before any run; a shortfall is recorded with its denominator rather than smoothed over | manual — evidence-document discipline, mirroring Phase 38's `proof02-computed-dispatch.md` | N/A — process discipline, not a test | ❌ W0 (the rule document) |
| PROOF-04 · Criterion 3 (EVID-06 bound respected) | Any run past anchor hit 50 is labelled `instrumented` / narrowed rather than claimed frame-exact | manual — live transcript review | N/A — a runtime depth choice recorded during the run, not assertable in advance | N/A by design |

---

## Wave 0 Requirements

- [ ] `evidence/proof04-independence.test.ts` — structural two-producer purity check
      covering Criterion 2. No existing file provides it; the closest precedent
      (`textmon-memmap.ts`'s own test) checks one module only.
- [ ] `evidence/proof04-subject-dxa.mjs` — subject-producer driver, reusing
      `dxa-partition.ts`'s `partitionByteDerived()` and Phase 38's `runDxaDisassemble()`
      call shape. Must never touch VICE.
- [ ] `evidence/proof04-oracle-memmap.mjs` — oracle-producer driver, reusing
      `probe-harness.mjs`'s `buildProbeArgs()` / `spawnVice()` and EVID-06's AUTOSTART
      sequencing unchanged. Must never read the classifier's output.
- [ ] The derivation-rule document, written and committed **before** any run
      (`resolved` / `unresolved` / `not-exercised`), on Phase 38's precedent.
- [ ] No framework install needed — `node --test` is already the runner and every module
      this phase touches already has committed unit tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The false-positive measurement itself | PROOF-04 · C1 | The true count is not knowable in advance — this is a measurement, and a CI assertion of a specific number would be circular | Drive `/usr/bin/x64sc` (genuine stock 3.9; `-default` must precede `-binarymonitor`) via `probe-harness.mjs` at an anchor depth inside the proven window (≤ hit 50). Ingest the `memmapshow` reply under the real launch `argv`. Feed the shipped join. Record count, denominator and positive class beside `PROOF-01`'s `100.00 (24/24)` / fixture `72.39 (97/134)` / pivot `72.46 (100/138)`, never replacing them. |
| Depth / exactness labelling | PROOF-04 · C3 | Whether a given run stayed inside the frame-exact window is a fact about that run | Record the anchor hit depth reached. At ≤50, EVID-06 licenses `no-perturbation`. Past 50 (and certainly from 75, where the S3 sequence diverges), label the run `instrumented` and state any comparison against v0.8.0's frame-exact captures as **narrowed**, not assumed. |
| `not-exercised` closure | PROOF-04 · C3 | A measurement phase must be free to close on `not-exercised` without that reading as failure | If the check cannot be run, record `not-exercised` together with what was searched and at what depth — the shape Phase 38 recorded for `PROOF-02`. This is a legitimate phase outcome, not a gap. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
