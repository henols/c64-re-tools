---
phase: 2
slug: stock-backend-connection
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node --test` (no separate framework) |
| **Config file** | none — `.claude/mcp/vice/package.json:58`'s glob (`'*.test.*'`) is the only configuration |
| **Quick run command** | `cd .claude/mcp/vice && node --test <file>.test.ts` (per-file, scoped by `--test-name-pattern`) |
| **Full suite command** | **NOT** the bare `npm test`. Wave 0 must create a narrowed script (e.g. `npm run test:automated`) that globs the 21 automated files and excludes the 3 devcontainer-stalling ones. See "The BACK-02 Verification Gate" in RESEARCH.md. |
| **Estimated runtime** | ~30s for the narrowed 21-file gate; per-file quick runs are sub-second |

**Load-bearing caveat:** 24 `*.test.*` files exist today. `vice-broker-launch.test.ts`,
`vice-proxy.test.ts` and `broker-e2e.test.ts` never finish outside the devcontainer —
already user-dispositioned as *not a bug* (they need manual host setup). The bare
`npm test` therefore hangs rather than reports, and **can never be this phase's
pass/fail signal**. BACK-02's and BROK-03's criterion ("the existing suite passes
unchanged") is only mechanically checkable once the narrowed script exists.

---

## Sampling Rate

- **After every task commit:** the `--test-name-pattern`-scoped run for the
  requirement(s) that task addresses.
- **After every plan wave:** every new test file
  (`node --test stock-protocol.test.ts stock-connect.test.ts backend-detect.test.ts`)
  plus every extended existing file (`broker-launch.test.ts`, `broker-control.test.ts`),
  plus the narrowed 21-file regression gate for BROK-03/BACK-02.
- **Before `/gsd-verify-work`:** narrowed 21-file gate green AND every new
  `*.test.ts` green.
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is keyed on requirement until plans exist.

| Requirement | Stream | Wave | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-------------|--------|------|------------|-----------|-------------------|-------------|--------|
| PROTO-01 | (a) client | 1 | — | unit | `node --test stock-protocol.test.ts --test-name-pattern="byte-at-a-time"` | ❌ W0 | ⬜ pending |
| PROTO-02 | (a) client | 1 | — | unit | `… --test-name-pattern="correlat"` | ❌ W0 | ⬜ pending |
| PROTO-03 | (a) client | 1 | — | unit | `… --test-name-pattern="demux\|event"` | ❌ W0 | ⬜ pending |
| PROTO-04 | (a) client | 1 | — | unit | `… --test-name-pattern="jam"` | ❌ W0 | ⬜ pending |
| PROTO-05 | (a) client | 1 | — | unit | `… --test-name-pattern="error.*code\|protocol.*error"` | ❌ W0 | ⬜ pending |
| PROTO-06 | (a)+(c) | 1,2 | — | unit + integration | `stock-protocol.test.ts` (client half); `stock-connect.test.ts` (`MachineRestartedError` reuse) | ❌ W0 | ⬜ pending |
| PROTO-07 | (a) client | 1 | — | unit | `… --test-name-pattern="display.*get\|157"` | ❌ W0 | ⬜ pending |
| PROTO-08 | (b)+(a) | 1,2 | T-02-01 | integration + unit | `broker-control.test.ts` extension; `stock-connect.test.ts` | ❌ W0 | ⬜ pending |
| BROK-01 | (b) broker | 1 | — | unit | `broker-launch.test.ts` extension | ❌ W0 | ⬜ pending |
| BROK-02 | (b) broker | 1 | T-02-01 | integration | `broker-control.test.ts` extension | ❌ W0 | ⬜ pending |
| BROK-03 | (b) broker | 1 | — | regression | narrowed 21-file gate | ✅ (needs narrowed script) | ⬜ pending |
| BACK-01 | (c) selection | 2 | — | unit | `backend-detect.test.ts` (override precedence) | ❌ W0 | ⬜ pending |
| BACK-02 | all | gate | — | regression | narrowed 21-file gate | ✅ (needs narrowed script) | ⬜ pending |
| BACK-03 | (c) selection | 2 | — | unit | `backend-detect.test.ts` + `vice_ping` shape assertion | ❌ W0 | ⬜ pending |
| BACK-04 | (c) selection | 2 | — | unit + manual | `backend-detect.test.ts` (cache logic); probe mechanism manual on a real dual-build host | ❌ W0 | ⬜ pending |
| VERIF-02 | (a) fixtures | 1 | — | unit | `stock-protocol.test.ts`, one test per named case (8) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Assigned to **plan 02-01** (wave 1, blocking) unless noted. Every task in every
> plan carries an `<automated>` verify pointing at a file plan 02-01 or its own task
> creates. The three stub test files listed below are created by the plan that owns
> the code they test (02-04/02-06 for `stock-protocol.test.ts`, 02-08 for
> `stock-connect.test.ts`, 02-07 for `backend-detect.test.ts`), tests-first inside
> the task via its `<behavior>` block — the Wave 0 obligation they actually carry is
> the *fixture* and *gate* substrate they consume, which plan 02-01 delivers first.

- [x] **Narrowed test-runner script** — plan 02-01 task 1 (`npm run test:automated`, `test-gate.mjs` + `test-gate.test.ts` drift guard)
- [x] **Fixture directory + provenance record** — plan 02-01 task 2 (`fixtures/binmon/README.md`, `binmon-fixtures.ts`); real captures in plan 02-02
- [x] **`probe-binmon.mjs` capture mode** — plan 02-01 task 3 (`MAX_CAPTURE_FRAMES = 32`, single-address checkpoints, `finally` deletion)
- [x] `stock-protocol.test.ts` — plans 02-04 and 02-06, tests-first per task
- [x] `stock-connect.test.ts` — plan 02-08, tests-first per task
- [x] `backend-detect.test.ts` — plan 02-07, tests-first per task
- [x] `stock-dispatch.test.ts` — plan 02-09 (new since this document was written: it carries the automated coverage for logic that would otherwise live in `vice-proxy.ts`, whose own test file is manual-only)

### Original list (superseded above)

- [ ] **Narrowed test-runner script** (e.g. `npm run test:automated`) in
      `.claude/mcp/vice/package.json`, globbing the 21 automated files and excluding
      `vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`.
      **Blocks BACK-02 and BROK-03 from being checkable at all** — do this first.
- [ ] `stock-protocol.test.ts` — stubs for PROTO-01..08 and VERIF-02's 8 cases
- [ ] `stock-connect.test.ts` — stubs for the PROTO-06/PROTO-08 wrapper halves and
      the `MachineRestartedError` reuse
- [ ] `backend-detect.test.ts` — stubs for BACK-01..04's cache and override logic
- [ ] Fixture directory (`tests/fixtures/binmon/` or equivalent) with a provenance
      record (build + capture date per fixture, per D-19). Must exist before
      `stock-protocol.test.ts` can consume anything.
- [ ] `probe-binmon.mjs` capture mode — produces the capturable fixtures. Bound the
      event count per case; the fork's `CHECKPOINT_INFO ×18` flood is a known hazard.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backend probe against a real binary | BACK-04, D-03 | No VICE binary in the planning sandbox; the probe's correctness depends on what stock's arg parser actually does with `-mcpserver` (RESEARCH marks this `[ASSUMED]`, not verified) | On a host with both builds: run the probe against stock `x64sc` and the fork; confirm it classifies each correctly and that the cache key changes when a binary is replaced in place |
| The 3 excluded test files | BACK-02, BROK-03 | Depend on manual host setup (real VICE + display); not automatable — already user-dispositioned as not-a-bug | Run inside the devcontainer with a host VICE reachable: `node --test vice-broker-launch.test.ts vice-proxy.test.ts broker-e2e.test.ts` |
| Fork-path behavioural parity with v0.1.x | BACK-02 | "Identical to v0.1.x" is a behavioural claim the unit suite samples but does not prove end to end | Drive a known program through the fork backend and compare tool output against v0.1.x |
| Live capture of the capturable VERIF-02 fixtures | VERIF-02, D-19 | Requires a running emulator to generate real frames | Run `probe-binmon.mjs --capture` against a real stock build; record build + date alongside each fixture |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references — especially the narrowed test script
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] The phase gate is the narrowed command, never the bare `npm test`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved at planning (2026-08-12) — 9 plans, 6 waves
