---
phase: "40"
slug: "the-three-preprocessing-host-tools"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-08"
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Test Infrastructure, Sampling Rate and Wave 0 are carried from
> `40-RESEARCH.md` § Validation Architecture (measured this session).
> The Per-Task Verification Map is seeded as scaffolding — the planner
> assigns real task IDs, and `/gsd-validate-phase` fills and signs it off.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/package.json`'s `test` / `test:automated` scripts |
| **Quick run command** | `cd src/mcp/vice && npm run typecheck` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~60 seconds (typecheck ~15s) |

**Two standing hazards on the full suite** (both recorded, both reproduce deterministically):
`npm test` (full glob) hangs on `vice-proxy.test.ts` — always use `test:automated`; and
`test:automated` has a non-zero known floor (2-in-1 as of 2026-09-03, one named bookkeeping
cause), so measure the floor rather than assuming 0. A **live broker reddens the BACK-05
test deterministically** — stop the broker before trusting any suite result.

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && npm run typecheck` — a skipped one of
  the seven synchronized `host-tool.mts` edit sites surfaces here as a type error, not only
  as a test failure.
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated`
- **Before `/gsd-verify-work`:** Full suite at its measured floor, **plus** a re-run of
  `scripts/check-no-skill-external-spawn.mjs`'s planted-violation controls — ROADMAP
  criterion 1 requires these be re-run, not assumed still green.
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Seeded scaffolding — task IDs are assigned by the planner; `/gsd-validate-phase` fills the
rows and flips `nyquist_compliant`.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PREP-01 | — | Declared shape returned for BAM / dir / entry / chain / read against a committed synthetic `.d64` | integration | `cd src/mcp/vice && node --test host-tool.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PREP-01 | — | Fabricated first-track entry flagged; cyclic chain reports an error rather than hanging | unit | `cd src/mcp/vice && node --test host-tool.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PREP-02 | — | Literal `SYS <decimal>` resolves to an address | integration | `cd src/mcp/vice && node --test host-tool.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PREP-02 | — | Computed `SYS` yields a **named decline**, never a guessed entry point | integration | `cd src/mcp/vice && node --test host-tool.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PREP-04 | — | Planted-failure fixture refused by the shape oracle **and** shown to pass an exit-status-only predicate in the same test (non-vacuous control) | unit | `cd src/mcp/vice && node --test host-tool.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PREP-03 | — | *(see note below — PREP-03's scope is settled in CONTEXT.md, not in the ROADMAP text)* | TBD | TBD | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | — | — | Path-consolidation parity: ignore rules and the deployed set stay in two-way parity | unit | `cd src/mcp/vice && node --test host-scripts.test.ts` | ✅ exists — **re-run**, do not assume | ⬜ pending |
| TBD | TBD | TBD | — | — | The no-external-spawn gate's planted-violation controls still catch a violation | integration | `node scripts/check-no-skill-external-spawn.mjs` + `cd src/mcp/vice && node --test skill-external-spawn-gate.test.ts` | ✅ exists — **re-run**, do not assume | ⬜ pending |
| TBD | TBD | TBD | — | — | The both-directions path-key census matches the new real tool-id total | unit | `cd src/mcp/vice && node --test host-tool.test.ts` | ✅ exists, needs edit (literal count is pinned) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] A synthetic `.d64` fixture, authored by a one-time throwaway script and committed pinned by sha256
- [ ] A planted corrupt-directory-chain fixture (cyclic next-track/sector) for the cycle-guard regression
- [ ] The computed-`SYS` fixture pair (BASIC source + tokenized `.prg`), built with the `petcat -w2` recipe verified in research
- [ ] A fakery-detector test file, porting the existing synthetic-plus-real fixture posture onto `c1541`'s inputs
- [ ] One planted-failure test case per new tool id carrying `PREP-04`'s two-directional non-vacuous control
- [ ] No framework install required — `node --test` is already in use

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Binary shadowing on this host | PREP-01/02 | The fork's VICE toolset shadows stock on this host's `PATH`; which build answered a call is a property of the machine, not of the repo | Read the per-call logged path and version and confirm they name the intended build |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
