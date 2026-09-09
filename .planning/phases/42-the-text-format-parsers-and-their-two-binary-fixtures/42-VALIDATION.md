---
phase: "42"
slug: "the-text-format-parsers-and-their-two-binary-fixtures"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-09"
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase 42` from `42-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` — no separate framework, matches every other file in `src/mcp/vice` |
| **Config file** | none — invoked directly via `node --test` |
| **Quick run command** | `cd src/mcp/vice && node --test textmon-*.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~5s quick, ~90s full |

**Baseline caveat (load-bearing):** `npm run test:automated` runs the project's own
`MANUAL_ONLY_TESTS`-aware gate and **hides twelve manual-only tests**. Its floor is
**3 pre-existing failures** (`anno-register` / `anno-import`, one named bookkeeping
cause) as of 2026-09-09 — **not 0**. Measure the floor before the first task and diff
against it; never read a non-zero count as this phase's own regression. Do not use the
full glob `npm test` — it blocks forever on `vice-proxy.test.ts`.

**Broker hygiene (load-bearing):** a live vice broker deterministically reddens
`vice-proxy.test.ts` BACK-05 and poisons any suite reading. Confirm no broker and no
`x64sc` is running before trusting a green/red verdict.

---

## Sampling Rate

- **After every task commit:** Run the specific new `textmon-*.test.ts` file(s) that task touches
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated`, diffed against the measured floor
- **Before `/gsd-verify-work`:** Full suite at or below the measured baseline
- **Max feedback latency:** ~5 seconds (per-file unit run)

---

## Per-Task Verification Map

Seeded at requirement granularity — plan-phase runs before task IDs exist. `/gsd-validate-phase 42`
refines this to per-task rows after `42-*-PLAN.md` is written.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PARSE-01 | — | N/A | unit | `node --test textmon-memmap.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PARSE-02 | — | N/A | unit | `node --test textmon-profile.test.ts textmon-cpuhistory.test.ts textmon-backtrace.test.ts textmon-registers.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PARSE-03 | T-42-02 | An unrecognised enum value refuses instead of mapping to a plausible wrong value | unit + structural | `node --test textmon-*.test.ts` plus the new single-owner structural test | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PARSE-04 | — | A missing build capability is named per command and per binary, never a silent empty result | unit | `node --test` against the new capability-probe module's test file | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PARSE-02/04 | T-42-01 | A caller-supplied count/address is validated before any byte reaches the socket | unit | `node --test text-protocol.test.ts` (extended) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `textmon-memmap.ts` + `textmon-memmap.test.ts` — PARSE-01
- [ ] `textmon-profile.ts` + `textmon-profile.test.ts` — PARSE-02 (`prof flat`)
- [ ] `textmon-cpuhistory.ts` + `textmon-cpuhistory.test.ts` — PARSE-02 (`chis`)
- [ ] `textmon-backtrace.ts` + `textmon-backtrace.test.ts` — PARSE-02 (`bt`)
- [ ] `textmon-registers.ts` + `textmon-registers.test.ts` — PARSE-02 (`io`)
- [ ] A structural single-owning-module test — PARSE-03 clause 3 (the closed-consumer-set shape from `hostpath-consumers.test.ts`)
- [ ] At least one **planted** fixture per format carrying an **unrecognised** value, observed making the parser refuse — PARSE-03 clause 4. A fixture-only defence passes while returning inverted answers; this control is what makes the defence real.
- [ ] At least one synthetic fixture exercising **RAM-execute** decode for `memmapshow` — absent from the real captures (the idle-loop capture never ran RAM code), so criterion 1's "RAM and ROM alike" is otherwise unproven
- [ ] A build-capability probe module + test file — PARSE-04
- [ ] `TEXT_COMMAND_ALLOWLIST` parameterization in `text-protocol.ts` — prerequisite for `chis` / `prof flat` / `io` to dial with a non-default parameter

*Framework install: none — `node:test` ships with Node ≥ 24, already the project floor.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A genuinely `--disable-cpuhistory` VICE build naming its missing capability | PARSE-04 | No such build exists on this host and building one is out of scope. The stub string (`"Disabled. configure with --enable-cpuhistory and recompile."`) was traced from `mon_memmap.c:422-459`, not observed live. | If such a build ever becomes available: dial `memmapshow` and `chis` against it over the text channel and confirm the probe names the capability rather than returning empty. Until then the probe is unit-tested against the source-traced literal. |
| `io`'s degradation strings (`"No details available."` / `"No I/O regs available"`) | PARSE-04 | Source-traced (`monitor.c:1980-2000`), not live-observed; the path is not expected to fire on `x64sc`, which always builds VIC-II support. | Reachable only on a target/bank with no register dump function. Recorded as INFERRED (assumption A1). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] Baseline floor measured before the first task, and every later reading diffed against it
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
