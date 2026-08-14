---
phase: 3
slug: direct-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` § "Validation Architecture (Focus Item 9)".

**Environment note (load-bearing):** no live stock VICE is reachable in this
environment. Every row below is validated **offline** — encoder byte-layout
round-trips, golden emitter tests, synthetic-event projection tests, and
manifest/`outputSchema` conformance. What cannot be validated offline is
enumerated under *Manual-Only Verifications* and must be filed as verification
debt, never silently claimed as passing.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node:test`) — no third-party framework, no new runtime deps |
| **Config file** | none — `node --test` defaults; `.claude/mcp/vice/package.json` `scripts.test` is `node --test '*.test.*'` |
| **Quick run command** | `cd .claude/mcp/vice && node --test stock-*.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm run test:automated` (`test-gate.mjs`; excludes the three manual-only suites `vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`) |
| **Estimated runtime** | ~10–30 seconds (pure unit, no emulator, no network) |

---

## Sampling Rate

- **After every task commit:** Run `node --test stock-<family>.test.ts` for the family module the task touched.
- **After every plan wave:** Run `npm run test:automated`.
- **Before `/gsd-verify-work`:** Full automated suite green **plus** `npm run typecheck`.
- **Max feedback latency:** 30 seconds.

**Continuity rule for the planner:** no 3 consecutive tasks may land without an
automated verify. Because Phase 3 is ~20 handlers over four families, each
handler task must carry its own encoder/answer-shape assertion rather than
deferring all tests to an end-of-family task.

---

## Per-Task Verification Map

Task IDs are assigned by the planner. This table is keyed by requirement and
must be extended with concrete `{phase}-{plan}-{task}` IDs as PLAN.md files are
written; every task in every plan must map to exactly one row here.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | shared seams | 1 | D-04 | — | `parseAddress()` refuses a symbolic address with "no symbol table loaded", not a parse error | unit | `node --test stock-address.test.ts` | ❌ W0 | ⬜ pending |
| TBD | shared seams | 1 | D-06/07/08 | — | `runState` derives only from `STOPPED`/`RESUMED` events; never from commands sent | unit (synthetic event frames) | `node --test stock-runstate.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family A | 2 | DIRECT-01 | T-3-01 (side-effect read) | `MEM_GET` `sidefx` byte defaults to 0 — reading `$D019` does not ack the IRQ; body is always exactly 8 bytes | unit (encode → hand-decode field offsets) | `node --test stock-protocol.test.ts stock-memory.test.ts` | ✅ / ❌ W0 cases | ⬜ pending |
| TBD | family A | 2 | DIRECT-02 | — | `REGISTERS_GET`/`SET` encode correctly; catalog resolves name↔id from a synthetic `REGISTERS_AVAILABLE` fixture | unit | `node --test stock-registers.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family A | 2 | DIRECT-09 (banks + registers) | — | `BANKS_AVAILABLE` / `REGISTERS_AVAILABLE` encode correctly; the chosen surface for register enumeration is in both manifest and dispatch table | unit | `node --test stock-memory.test.ts stock-registers.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family B | 2 | DIRECT-03 | T-3-02 (always-false condition) | Emitter fully parenthesises every comparison, emits `$hex`, uses uppercase `RL`/`CY`; bare decimals / `LIN`/`CYC` / lowercase registers / unparenthesised input / out-of-range are **refused with an explanation** | unit (golden: bad input → refusal text, good input → exact wire string) | `node --test stock-condition.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family B | 2 | DIRECT-03 (D-10) | T-3-03 (armed unconditioned breakpoint) | On `CONDITION_SET` failure the checkpoint it was meant to condition is **deleted**; registry reports condition text back through `checkpoint_list` | unit (stubbed client forced to fail) | `node --test stock-checkpoints.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family B | 2 | DIRECT-03 (D-11) | T-3-04 (trace-checkpoint deadlock) | `stop:false` requires the acknowledging argument; exceeding the per-second hit rate toggles that checkpoint id off and reports id + reason | unit (synthetic hit bursts) | `node --test stock-checkpoints.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family C | 2 | DIRECT-04 | — | `ADVANCE_INSTRUCTIONS` / execute-until-return encode correctly and **refuse** while `runState === "unknown"` | unit | `node --test stock-execution.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family C | 2 | DIRECT-05 | — | Pause short-circuits when `"stopped"`, resume when `"running"` — a genuine agent retry produces **zero wire traffic**; the command **is** sent while `"unknown"` | unit (stubbed `send()`, asserted not-called) | `node --test stock-execution.test.ts stock-runstate.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family D | 2 | DIRECT-06 | — | `RESET` / `AUTOSTART` encode correctly; disk attach is `AUTOSTART` with the run flag clear; units 9–11 refuse with an explanation (no silent no-op); `vice_disk_detach` is **absent** from the stock manifest | unit | `node --test stock-machine.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family D | 2 | DIRECT-07 | — | `KEYBOARD_FEED` / `JOYPORT_SET` encode correctly; the new ASCII→PETSCII table round-trips every character it claims to map | unit (exhaustive table test) | `node --test stock-petscii.test.ts stock-machine.test.ts` | ❌ W0 | ⬜ pending |
| TBD | family D | 2 | DIRECT-08 | T-3-05 (path escape) | `DUMP` / `UNDUMP` encode correctly and route their filename through `hostpath.ts` per the D-17 declared table; client-side derivations are **never** translated | unit (encoder) + integration (translation call made, via stub) | `node --test stock-machine.test.ts` | ❌ W0 | ⬜ pending |
| TBD | any | 2+ | D-02 | — | Every stock handler's answer validates against its own declared `outputSchema`; every answer carries `runState` | unit (hand-rolled ~40-line checker, no new deps) | `node --test stock-dispatch.test.ts` | ✅ / ❌ W0 cases | ⬜ pending |
| TBD | D-16 | 2+ | BACK-02 exception | — | `vice_snapshot_list` is gone from `tools-manifest.json`, `vice_snapshot_load`'s description no longer references it, and the fork-surface count assertion moved with it (63 → 62) | unit | `node --test stock-dispatch.test.ts vice-proxy.test.ts` | ✅ (count assertion exists) | ⬜ pending |
| TBD | broker (D-13) | any | DIRECT-06 (launch half) | — | Stock argv carries `-remotemonitor` on a second broker-allocated port; `InstanceRecord` carries it; `resources/*.mjs` rebuilt so `resources-sync.test.ts` passes | unit | `node --test resources-sync.test.ts` + `node --test vice-broker-launch.test.ts` (manual-only suite — run it explicitly) | ✅ existing files | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Infrastructure exists (Node's test runner, `test-gate.mjs`, the three `stock-*.test.ts`
suites from Phase 2). No framework install is needed. Wave 0 is purely **new test
files and new cases in existing files**:

- [ ] `stock-address.test.ts` — `parseAddress()` decimal / `$hex` / `0x`, plus the "no symbol table loaded" refusal path (D-04)
- [ ] `stock-runstate.test.ts` — the tri-state tracker against synthetic `STOPPED`/`RESUMED`/`JAM` sequences (D-06/07/08)
- [ ] `stock-condition.test.ts` — golden tests for the AST/emitter and every named refusal case (D-09)
- [ ] `stock-checkpoints.test.ts` — the D-10 registry, fail-closed delete-on-`CONDITION_SET`-failure, and D-11's rate limit / auto-disable
- [ ] `stock-execution.test.ts` — D-07 `unknown`-state gating and D-08 short-circuit (assert no wire traffic)
- [ ] `stock-machine.test.ts` — `RESET`/`AUTOSTART`/keyboard/joystick/snapshot encoders, the unit-8-only disk-attach refusal, and the `hostpath.ts` translation call
- [ ] `stock-registers.test.ts` — the register catalog against a synthetic `RegistersAvailable` fixture
- [ ] `stock-petscii.test.ts` — exhaustive round-trip over the new ASCII↔PETSCII table
- [ ] `stock-dispatch.test.ts` **extension** — `outputSchema` conformance cases per D-02, using the hand-rolled checker
- [ ] `stock-protocol.test.ts` **extension** — encoder-shape cases for every request body layout in the four family tables

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New encoders are byte-for-byte accepted by a real VICE binary | DIRECT-01..09 | No live stock VICE in this environment. Body layouts are grounded in the normative docs and the repo's own tested `probe-binmon.mjs` builders, but `ADVANCE_INSTRUCTIONS` step-over semantics, `JOYPORT_SET`'s bit layout, and `-remotemonitor`'s exact address-flag spelling are `[ASSUMED]` | On a host with a real stock build: extend `probe-binmon.mjs` with each new body, send it, assert the response type is not `InvalidLength`/`InvalidParameter`. **File as a pending todo** in the style of the two existing Phase 2 probe-debt todos — not a Phase 3 blocker |
| Real-world event ordering across connect → tool call → disconnect matches the `runState` projection | DIRECT-05, D-06/07/08 | `runState`'s honesty is provable against synthetic events; its real-world correctness depends on the event ordering a real emulator emits, which `docs/phase1-probe-results.md` recorded only for a subset of transitions | Same session as above: log the raw event stream across the full new tool set and diff against the projection's expected transitions |
| `-remotemonitor` actually binds the second port and coexists with `-binarymonitor` | DIRECT-06 (D-13 launch half) | Phase 3 builds no text client, so nothing dials the port; only the launch flag and allocation are in scope | Launch stock with both flags, `ss -ltnp` both ports, confirm both accept a connection. Phase 7 owns the transport |
| `vice-sync.ts` checkpoint-wait timing invariants | DIRECT-03 | Deliberately not unit-tested by project convention (CLAUDE.md) — correctness only means anything against a real emulator's timing | Preserve the documented invariants by inspection: exactly one resume per wait; poll on `hit_count`, never on paused state; never delete a VICE-marked temporary checkpoint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] Every offline-unverifiable claim above is filed as a pending todo, not silently claimed
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
