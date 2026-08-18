---
phase: 7
slug: cycle-timing-and-wedge-triage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `07-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` (no separate framework) |
| **Config file** | none — `.claude/mcp/vice/package.json`'s `test` / `test:automated` scripts are the only config |
| **Quick run command** | `node --test stock-timing.test.ts stock-run-until.test.ts stock-diagnose.test.ts` (run from `.claude/mcp/vice`) |
| **Full suite command** | `npm run test:automated` (`.claude/mcp/vice/test-gate.mjs`, excludes the four frozen `MANUAL_ONLY_TESTS`) |
| **Estimated runtime** | ~3 s quick · ~60 s full suite |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above (all three new test files — fast, no emulator process).
- **After every plan wave:** Run `npm run test:automated`.
- **Before `/gsd-verify-work`:** Full suite green, **plus** a live-VICE pass per requirement (see Manual-Only Verifications).
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Every task below must resolve to a concrete
`{phase}-{plan}-{task}` ID before `nyquist_compliant: true` can be set.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | Wave-0 prereq (Pitfall 8) | — | `probeCpuHistory()` treats `InvalidParameter` (0x81) as a capability answer, not a fatal handshake error | unit | `node --test stock-connect.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | Wave-0 prereq (Pitfall 6) | — | `CPUHISTORY_GET` response decodes to a typed record, never `"unknown"` | unit | `node --test stock-protocol.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | Wave-0 prereq (Pitfall 7) | — | `RESOURCE_GET` request encoder + response parser round-trip | unit | `node --test stock-protocol.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TIME-01 | — | Route A decodes the newest `CPUHISTORY_GET` entry's cycle field against a synthetic wire body when `session.capabilities.cpuHistory === "available"` | unit | `node --test stock-timing.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TIME-01 | — | Route B computes `LIN*cyclesPerLine+CYC` correctly for all four video standards | unit | `node --test stock-timing.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TIME-03 | T-07-01 | A detected Route-B wraparound is refused with an explanatory message — never a fabricated number and never `0` | unit | `node --test stock-timing.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TIME-02 | — | `CHECKPOINT_SET` carries `temporary:true` and `CHECKPOINT_DELETE` is never called on the hit path (call-count assertion) | unit | `node --test stock-run-until.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TIME-02 | T-07-02 | On synthetic timeout, delete is attempted and `ObjectMissing` is tolerated as a benign already-gone race | unit | `node --test stock-run-until.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TIME-02 | T-07-02 | On synthetic `MachineRestartedError` mid-wait, the delete is skipped entirely and the standard restarted outcome is reported | unit | `node --test stock-run-until.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TIME-04 | T-07-03 | Stock `vice_diagnose` reaches `"monitor_held_elsewhere"` on synthetic `MonitorOwnershipError` and `"restarted"` on synthetic `MachineRestartedError`, at near-zero simulated wire cost | unit | `node --test stock-diagnose.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TIME-04 | — | Ported checkpoint-trap algorithm matches an armed stopping exec checkpoint at the current PC, or at the resolved live-IRQ-handler address with `hit_count === 0` | unit | `node --test stock-diagnose.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TIME-04 (scope add) | T-07-02 | Stock-native `gatherWedgeEvidence()` equivalent produces an incident record **before** the destructive broker recycle RPC | unit | `node --test stock-diagnose.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **`stock-connect.ts` — `probeCpuHistory()` `InvalidParameter` fix (BLOCKING).** Without it every stock connect to a real VICE ≥ 3.10 build fails outright, so no Route A test is meaningful. Regression fixture must match the live-captured 0x81 response in `07-RESEARCH.md` § Code Examples.
- [ ] `stock-protocol.ts` — `CPUHISTORY_GET` response parser case (today falls through to `"unknown"`).
- [ ] `stock-protocol.ts` — `RESOURCE_GET` request-body encoder + response parser case (neither exists).
- [ ] `stock-timing.ts` + `stock-timing.test.ts` — new files.
- [ ] `stock-run-until.ts` + `stock-run-until.test.ts` — new files. The wire primitive (`temporary:true` on `CHECKPOINT_SET`) already exists and is live-confirmed (`docs/phase1-probe-results.md` item 1); no handler composes it yet.
- [ ] `stock-diagnose.ts` + `stock-diagnose.test.ts` — new files. Ports `vice-proxy.ts`'s already-live-tested `gatherCheckpointTrapEvidence()`.
- [ ] `tools-manifest.stock.json` — new entries (34 → 37 tools).
- [ ] `stock-connect.test.ts` — extend with the 0x81 regression fixture.

---

## Manual-Only Verifications

Live-emulator proofs. `/usr/bin/x64sc` is genuine unpatched stock VICE 3.9 on this
machine (the fork build shadows it on `PATH`), so these are runnable, not
hypothetical. **Flag-order gotcha: `-default` must precede `-binarymonitor`, or the
monitor never binds.**

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Route B stopwatch on genuine stock 3.9 | TIME-01, TIME-03 | 3.9 has no `CPUHISTORY_GET` opcode at all — only a real 3.9 proves the fallback route is the one selected | Launch `/usr/bin/x64sc -default -binarymonitor`, bracket a known operation, assert a non-zero exact figure or an explicit refusal — never `0` |
| Route A stopwatch on a ≥ 3.10 build | TIME-01 | Needs a real `CPUHISTORY_GET` responder; no unit fixture proves the live handshake | Launch the fork's 3.10-vintage build with `-binarymonitor`, re-run the `count=0`-vs-`count=1` empirical test, commit the captured response as a fixture |
| `vice_run_until` reaching a real address, and timing out on an unreachable one | TIME-02 | Checkpoint-hit timing only means anything against a real CPU loop | Run a real program, target a reached address (assert hit + checkpoint auto-gone), then an unreachable address (assert timeout + cleanup) |
| `vice_diagnose` against a real checkpoint trap and a real wedge | TIME-04 | The four/five verdicts are timing-dependent emulator states, not decodable from fixtures | Arm a real stopping checkpoint (expect `checkpoint_trap`); induce a wedge and a kill-and-respawn (expect `wedged`, `restarted`); open a second monitor connection (expect `monitor_held_elsewhere`) |
| Second-client contention does not itself hang the diagnostician | TIME-04 | The failure mode *is* an indefinite hang with no reply and no EOF — only a live second `connect()` proves the guard | With one client attached, run `vice_diagnose` from a second; assert it returns `monitor_held_elsewhere` within its bound rather than blocking |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Task IDs resolved (no `TBD` rows remain in the Per-Task Verification Map)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] Every Manual-Only row has a recorded live result
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
