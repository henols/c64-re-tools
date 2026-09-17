---
phase: "58"
slug: "one-declaration-four-places-that-can-no-longer-disagree"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-17"
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `58-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled once plans exist (validate-phase §6).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node --test` (no separate framework; project-wide convention) |
| **Config file** | none — `src/mcp/vice/test-gate.mjs`'s `MANUAL_ONLY_TESTS` list governs which colocated `*.test.ts` files the automated gate excludes. A new `prerequisites.test.ts` needs no host dependency and terminates in milliseconds, so it must **not** be added to that list |
| **Quick run command** | `cd src/mcp/vice && node --test prerequisites.test.ts phase58-citation-ledger.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~1 second quick · full automated gate per existing baseline |

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && node --test prerequisites.test.ts`
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated` — DECL-05's tarball-list assertion is a colocated case inside `prerequisites.test.ts`, so it is inside `npm test`; no separate packaging script exists
- **Before `/gsd-verify-work`:** Full suite green and the `decl-02-node18-proof` CI job green on a real runner
- **Max feedback latency:** 5 seconds for the quick command

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 58-01 T1, T2 | 01 | 1 | DECL-01 | — | N/A | unit | `cd src/mcp/vice && node --test prerequisites.test.ts` | ✅ | ✅ green (20/20) |
| 58-03 T1, T2, T3 | 03 | 3 | DECL-01 (provenance half, SC5) | — | A fabricated or drifted `file:line` citation fails the suite, not a reader | unit (ledger audit) | `cd src/mcp/vice && node --test phase58-citation-ledger.test.ts` | ✅ | ✅ green (10/10) |
| 58-01 T1 | 01 | 1 | DECL-02 | — | N/A | integration (CI) | `.github/workflows/ci.yml` job `decl-02-node18-proof` (`actions/setup-node@v4`, `node-version: "18"`) | ✅ | ✅ green on a real runner |
| 58-01 T1, T2; 58-02 T2 | 01, 02 | 1, 2 | DECL-04 | — | N/A | unit (non-vacuous, planted violation) | `cd src/mcp/vice && node --test prerequisites.test.ts` | ✅ | ✅ green |
| 58-01 T1 | 01 | 1 | DECL-05 | T-58-01 | Packaging omission cannot ship silently | build-gate (colocated) | `cd src/mcp/vice && node --test prerequisites.test.ts` | ✅ | ✅ green |
| 58-01 T1 | 01 | 1 | DECL-01 (D-09) | T-58-02 | Every remedy is a bare string; no `argv`/`cmd`/`args` key anywhere | unit (structural) | `cd src/mcp/vice && node --test prerequisites.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs bound by validate-phase §6 on 2026-09-17 against the three executed plans.*

---

## Wave 0 Requirements

- [x] `src/mcp/vice/prerequisites.json` — the declaration itself; every other artifact in this phase depends on it
- [x] `src/mcp/vice/prerequisites.test.ts` — stubs for DECL-01, DECL-04, and D-09's no-argv structural assertion
- [x] DECL-05 tarball-list assertion — landed as a colocated case in `src/mcp/vice/prerequisites.test.ts`, **not** as the planned `scripts/check-npm-packages.mjs`; that script was never created and nothing references it
- [x] New CI step in `.github/workflows/ci.yml` (`actions/setup-node@v4`, `node-version: "18"`) — DECL-02
- [x] `docs/phase58-declaration-provenance.md` — not a test, but a required deliverable (D-04) cited by D-05's worked example and by the c1541/petcat carried-remedy case

*No test framework install is required — `node --test` is already the project convention.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Status |
|----------|-------------|------------|--------|
| The Node-18 CI matrix cell actually runs green on a GitHub Actions runner | DECL-02 | The evidence D-14/D-15 require is the real runner environment; a local run proves the JSON parses under Node 18 but not that the workflow cell is wired correctly | **✅ DISCHARGED 2026-09-17.** Commits `d0e9fb2e..589e56e0` pushed to `origin/main`; CI run `35270271098`, job `decl-02-node18-proof` (id `105367530978`) concluded success in 12s. `actions/setup-node@v4` acquired a real `18.20.8` and the step reported `node: v18.20.8`, so the floor was exercised rather than merely declared. Console carried the expected line verbatim: `prerequisites.json parsed on Node 18 -- 8 tool record(s)`. Recorded in `58-UAT.md` test 1. |
| A quoted source actually SAYS what the declaration claims it says | DECL-01 / SC5 | Residual human judgement only. The mechanical half — that every `file:line` citation resolves, and that the anchor text really appears at that line — was automated by plan 58-03's citation-ledger audit (raw substring match, no normalisation, plus a planted-shift control proving non-vacuity). What no assertion can check is whether a resolving citation is *honest* about the claim it supports. | **Signed off** via `docs/phase58-declaration-provenance.md`, reviewed against each cited `file:line`; every source disagreement records a chosen-and-why. |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s — measured 1.22s for both phase-58 files together (30 cases)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-17

---

## Validation Audit 2026-09-17

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Every phase-58 requirement resolves to an automated command, so §4's gap gate and
§5's auditor spawn were both skipped per §3 ("No gaps -> skip to Step 6"). Measured,
not asserted: `node --test prerequisites.test.ts phase58-citation-ledger.test.ts`
returned exit 0 with 30 pass / 0 fail / 0 skipped in 1.22s, and neither file appears
in `test-gate.mjs`'s `MANUAL_ONLY_TESTS`, so both run inside the automated gate
rather than beside it.

Two drift corrections were applied to this document, which was seeded as a `draft`
before any plan existed:

1. **DECL-05's route changed during execution.** The draft, and `58-01-PLAN.md`,
   both named `scripts/check-npm-packages.mjs` with a new `need(...)` call. That
   script was never created; `scripts/` holds only `ensure-mcp-deps.sh`, and no file
   in the repository mentions `DECL-05`. The requirement is nonetheless satisfied —
   by a colocated case, `prerequisites.test.ts:356`, asserting `prerequisites.json`
   appears in the packed tarball's own file list. The map, the Sampling Rate and the
   Wave 0 list now name the route that exists. This is a documentation correction,
   not a gap: the behaviour was always covered.
2. **Task IDs were `{58-NN-NN}` placeholders.** Bound to the three executed plans.

DECL-02 moved out of Manual-Only in this audit; see that table for the run evidence.
