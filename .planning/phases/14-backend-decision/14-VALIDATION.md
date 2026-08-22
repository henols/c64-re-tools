---
phase: 14
slug: backend-decision
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-22
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `14-RESEARCH.md` § Validation Architecture (lines 592-623).

**Branch-dependent by construction.** FORK-01 resolves to `retain` or `remove` at a
decision checkpoint during execution. Rows below marked *(retain)* / *(remove)* apply
only to the branch taken; the unmarked rows apply either way.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — invoked via `npm test` / `npm run test:automated` in `.claude/mcp/vice/package.json` |
| **Quick run command** | `cd .claude/mcp/vice && node --test capability-registry.test.ts fork-manifest-surface.test.ts backend-detect.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm test` |
| **Doc-honesty guard** | `node scripts/check-skill-fork-honesty.mjs` (repo root) |
| **Estimated runtime** | ~10s quick · full suite per `.claude/mcp/vice` norms |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/check-skill-fork-honesty.mjs` — fast, deterministic, catches doc-drift immediately
- **After every plan wave:** Run `cd .claude/mcp/vice && npm test`
- **Before `/gsd-verify-work`:** Full suite green, **plus** the branch phase-gate below
- **Phase gate (retain):** the live fork-transport exercise (research Q3) passes
- **Phase gate (remove):** the full-absence sweep returns zero hits outside history notes
- **Max feedback latency:** ~10 seconds for the per-commit guard

---

## Per-Task Verification Map

*Seeded at plan time with the requirement-level map from research; per-task rows are
filled by `/gsd-validate-phase` once PLAN.md task IDs exist.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | FORK-01 | — | N/A | doc-content | `grep -n "FORK-01" .planning/PROJECT.md \| grep -i "KEYBOARD_MATRIX_SET"` | ❌ W0 | ⬜ pending |
| TBD | — | — | FORK-02 (annotation half) | — | N/A | doc-content, mechanical | `node scripts/check-skill-fork-honesty.mjs` | ✅ | ⬜ pending |
| TBD | — | — | FORK-02 (runtime half) | — | Refusal names an actual route | unit | `cd .claude/mcp/vice && node --test capability-registry.test.ts` | ✅ | ⬜ pending |
| TBD | — | — | FORK-01/02 crit. 3 *(remove)* | — | No path advertises/spawns fork transport | grep sweep | `grep -rn "mcpserver" .claude/mcp/vice/*.ts .claude/mcp/vice/*.mts` → 0 hits; `grep -rn "VICE_BACKEND" .` → 0 outside history notes | ❌ W0 | ⬜ pending |
| TBD | — | — | FORK-01/02 crit. 3 *(retain)* | — | Real fork transport still answers | manual-only, live | see **Manual-Only Verifications** | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] A grep-based regression guard asserting PROJECT.md's `FORK-01` entry co-occurs with `KEYBOARD_MATRIX_SET` and a named reversal trigger — inherently a prose check, but a cheap smoke assertion following this project's established `docs-*.test.ts` pattern (FORK-01)
- [ ] *(retain branch only)* A live fork-transport smoke test — env-gated, manual-only — does not exist and must be written to satisfy criterion 3. Concrete command sequence in research Q3
- [ ] *(remove branch only)* A "fork transport is fully absent" guard, mirroring `fork-manifest-surface.test.ts`'s exact-count pattern inverted to zero. Added as part of the removal itself, then immediately passes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retained fork path still works end-to-end *(retain)* | FORK-01/02 crit. 3 | Needs a real fork binary and a real HTTP `/mcp` transport; no test in the repo drives it today (`broker-e2e.test.ts` stubs the binary to `/bin/sleep`) | `/usr/local/bin/x64sc -mcpserver -mcpserverhost 127.0.0.1 -mcpserverport 6510 &` then drive `vice_ping`, `vice_registers_get`, `vice_sid_get_state` through the real dispatch with `VICE_BACKEND=fork` and `VICE_MCP_URL` pointed at that host:port; kill the process afterwards |
| PROJECT.md `FORK-01` entry satisfies FORK-01's literal text | FORK-01 | Prose adequacy — "names the criteria that would reverse it" cannot be asserted mechanically beyond the co-occurrence smoke check | Read the new Key Decisions row against FORK-01's requirement text; confirm a dated entry, named reversal criteria, and the `KEYBOARD_MATRIX_SET` coupling stated explicitly |
| Hard-loss routes are followable at the point of use | FORK-02 | Criterion 2 demands *evidence in live doc/skill text*, and "can a user actually follow this" is a judgement | For each of SID read-back, matrix keyboard, RESTORE/NMI: read the text the user meets at the point of use (skill doc + runtime refusal) and confirm it states a route that exists on the branch taken — on `remove`, "use the fork" is no longer a route and must be replaced with an honest statement |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (branch-appropriate rows only)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s for the per-commit guard
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
