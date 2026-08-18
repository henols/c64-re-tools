---
phase: 7
slug: cycle-timing-and-wedge-triage
status: complete
nyquist_compliant: false
wave_0_complete: true
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
| **Quick run command** | `node --test stock-connect.test.ts stock-protocol.test.ts stock-timing.test.ts stock-run-until.test.ts stock-diagnose.test.ts stock-recycle.test.ts` (run from `.claude/mcp/vice`) |
| **Full suite command** | `npm run test:automated` (`.claude/mcp/vice/test-gate.mjs`, excludes the four frozen `MANUAL_ONLY_TESTS`) |
| **Estimated runtime** | ~21 s quick (225 tests) · ~22 s full suite |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above (all six timing/wedge-triage test files — fast, no emulator process).
- **After every plan wave:** Run `npm run test:automated`.
- **Before `/gsd-verify-work`:** Full suite green, **plus** a live-VICE pass per requirement (see Manual-Only Verifications).
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

Every row below resolves to a real `{phase}-{plan}-{task}` ID, its actual shipped wave, and the
observed result of running its command (2026-08-18, this worktree). Waves reflect the shipped
structure (1 through 7), not this document's original 0/1/2 draft placeholders.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-1 | 01 | 1 | Wave-0 prereq (Pitfall 8) | T-07-01 | `probeCpuHistory()` treats `InvalidParameter` (0x81) as the capability answer `"absent"`, not a fatal handshake error | unit | `node --test stock-connect.test.ts` | ✅ | ✅ green (29/29) |
| 07-02-1 | 02 | 1 | Wave-0 prereq (Pitfall 6) | T-07-07 | `CPUHISTORY_GET` response decodes to a typed record via `need()`-guarded offsets, never `"unknown"` | unit | `node --test stock-protocol.test.ts` | ✅ | ✅ green |
| 07-02-2 | 02 | 1 | Wave-0 prereq (Pitfall 7); RESOURCE_GET encoder/parser round-trip | T-07-04, T-07-08 | `RESOURCE_GET` request encoder + response parser round-trip; read-side only (no `RESOURCE_SET` route opened), argument bounds enforced | unit | `node --test stock-protocol.test.ts` | ✅ | ✅ green |
| 07-03-1 | 03 | 1 | TIME-02 | — | `CHECKPOINT_SET` carries `temporary:true` and `CHECKPOINT_DELETE` is never called on the hit path (call-count assertion) | unit | `node --test stock-run-until.test.ts` | ✅ | ✅ green (15/15) |
| 07-03-1 | 03 | 1 | TIME-02 | T-07-02 | On synthetic timeout, delete is attempted and `ObjectMissing` is tolerated as a benign already-gone race | unit | `node --test stock-run-until.test.ts` | ✅ | ✅ green |
| 07-03-1 | 03 | 1 | TIME-02 | T-07-02 | On synthetic `MachineRestartedError` mid-wait, the delete is skipped entirely and the standard restarted outcome is reported | unit | `node --test stock-run-until.test.ts` | ✅ | ✅ green |
| 07-05-1 | 05 | 2 | TIME-01 | — | Route A decodes the newest `CPUHISTORY_GET` entry's cycle field against a synthetic wire body when `session.capabilities.cpuHistory === "available"` | unit | `node --test stock-timing.test.ts` | ✅ | ✅ green (22/22) |
| 07-05-1 | 05 | 2 | TIME-01 | — | Route B computes `LIN*cyclesPerLine+CYC` correctly for all four video standards | unit | `node --test stock-timing.test.ts` | ✅ | ✅ green |
| 07-05-1 | 05 | 2 | TIME-01 (video-standard fallback) | T-07-13 | `resolveVideoStandard()` reads `MachineVideoStandard` via `RESOURCE_GET`, caches only successful reads per `session.targetId`, and falls back to PAL with `assumed:true`+`reason` on failure — a transient wire failure gets a fresh chance on the next call rather than pinning a degraded answer | unit | `node --test stock-timing.test.ts` | ✅ | ✅ green |
| 07-05-2 | 05 | 2 | TIME-03 | T-07-01 | A detected Route-B wraparound is refused with an explanatory message — never a fabricated number and never `0` | unit | `node --test stock-timing.test.ts` | ✅ | ✅ green |
| 07-06-1 | 06 | 3 | TIME-04 | — | Ported checkpoint-trap algorithm matches an armed stopping exec checkpoint at the current PC, or at the resolved live-IRQ-handler address with `hitCount === 0` | unit | `node --test stock-diagnose.test.ts` | ✅ | ✅ green (25/25) |
| 07-06-2 | 06 | 3 | TIME-04 | T-07-03 | Stock `vice_diagnose` reaches `"monitor_held_elsewhere"` on synthetic `MonitorOwnershipError` and `"restarted"` on synthetic `MachineRestartedError`, at near-zero simulated wire cost | unit | `node --test stock-diagnose.test.ts` | ✅ | ✅ green |
| 07-06-2 | 06 | 3 | TIME-04 (bounded session acquisition) | T-07-03 | `handleDiagnoseStock()` races `ensureStockSession()` against a configurable deadline (default 10000ms) and returns a named result rather than blocking when stock VICE's single-client binary monitor is already held | unit | `node --test stock-diagnose.test.ts` | ✅ | ✅ green |
| 07-07-1 | 07 | 4 | TIME-04 (scope add) | T-07-02 | Stock-native `gatherStockWedgeEvidence()`/`handleRecycleStock()` produce an incident record **before** the destructive broker recycle RPC | unit | `node --test stock-recycle.test.ts` | ✅ | ✅ green (18/18) |
| 07-07-3 | 07 | 4 | TIME-04 (record-before-RPC ordering proof) | T-07-05 | The recycle RPC stub itself reads the incidents directory and observes exactly one record file with a complete evidence section already on disk at RPC time — an ordering regression fails as a test, not as a lost incident | unit | `node --test stock-recycle.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Registration-only plans (07-08 wiring `vice_cycles_stopwatch`/`vice_run_until` into the stock
dispatch table and manifest, 07-09 wiring `vice_diagnose`/`vice_recycle`) are covered by
`stock-dispatch.test.ts`'s conformance cases (`node --test stock-dispatch.test.ts`, part of the
full suite below) rather than a dedicated row here — those tasks wire already-tested handlers into
the dispatch table and manifest; the behaviors above are what those handlers actually do. 07-04 is
a documentation-drift-correction plan with no runtime behavior to sample.

---

## Wave 0 Requirements

- [x] **`stock-connect.ts` — `probeCpuHistory()` `InvalidParameter` fix (BLOCKING).** Shipped in
      07-01. Without it every stock connect to a real VICE ≥ 3.10 build failed outright, so no
      Route A test was meaningful. Regression fixture matches the live-captured 0x81 response
      (`07-RESEARCH.md` § Code Examples), and is additionally re-confirmed live in this plan's own
      manual verification pass against the fork's genuine VICE 3.10.0.0 build.
- [x] `stock-protocol.ts` — `CPUHISTORY_GET` response parser case. Shipped in 07-02 (today decodes
      to a typed record with `need()`-guarded offsets rather than falling through to `"unknown"`).
      **Caveat recorded during this plan's own live pass:** the parser's assumed per-entry layout
      (`item_size` register bytes, then `cycle`(8) + four instruction fields + one trailing byte)
      does not match a real VICE 3.10 build's wire reply size — see Manual-Only Verifications
      below and `deferred-items.md`'s "Route A live decode mismatch" entry. The unit-tested
      contract (synthetic fixtures matching the same assumed layout) is unaffected; the live gap
      is recorded, not silently absorbed.
- [x] `stock-protocol.ts` — `RESOURCE_GET` request-body encoder + response parser case. Shipped in
      07-02.
- [x] `stock-timing.ts` + `stock-timing.test.ts` — new files. Shipped in 07-05.
- [x] `stock-run-until.ts` + `stock-run-until.test.ts` — new files. Shipped in 07-03. The wire
      primitive (`temporary:true` on `CHECKPOINT_SET`) was already live-confirmed
      (`docs/phase1-probe-results.md` item 1); 07-03 composed the handler.
- [x] `stock-diagnose.ts` + `stock-diagnose.test.ts` — new files. Shipped in 07-06. Ports
      `vice-proxy.ts`'s already-live-tested `gatherCheckpointTrapEvidence()`.
- [x] `tools-manifest.stock.json` — new entries. Corrected count: **34 → 36 → 38 tools**, not
      34 → 37 as this document's own earlier draft (and `07-RESEARCH.md`) stated —
      `vice_diagnose`/`vice_recycle` are proxy-local synthetic tools with no manifest entry on
      either backend before Phase 7, so 07-08 registered only the two timing tools (34 → 36) and
      07-09 registered the remaining two (36 → 38). Correction first made in `07-08-PLAN.md`/
      `07-08-SUMMARY.md`.
- [x] `stock-connect.test.ts` — extended with the 0x81 regression fixture. Shipped in 07-01.

---

## Manual-Only Verifications

Live-emulator proofs. `/usr/bin/x64sc` is genuine unpatched stock VICE 3.9, and
`/usr/local/bin/x64sc` is a genuine VICE 3.10 build (also supports `-binarymonitor`), on this
machine — the fork build shadows `/usr/bin/x64sc` on `PATH` only for a bare `x64sc`, never for an
absolute path. **Flag-order gotcha: `-default` must precede `-binarymonitor`, or the monitor never
binds.**

Run 2026-08-18 during 07-10's own execution, dispatching through the real `dispatchStock()` seam
against both real binaries (see `.planning/phases/07-cycle-timing-and-wedge-triage/
deferred-items.md` for the full session transcript and the one outstanding finding).

| Behavior | Requirement | Why Manual | Test Instructions | Result |
|----------|-------------|------------|-------------------|--------|
| Route B stopwatch on genuine stock 3.9 | TIME-01, TIME-03 | 3.9 has no `CPUHISTORY_GET` opcode at all — only a real 3.9 proves the fallback route is the one selected | Launch `/usr/bin/x64sc -default -binarymonitor`, bracket a known operation, assert a non-zero exact figure or an explicit refusal — never `0` | ✅ **PASS.** Route `frame_position` selected (no CPU-history capability on 3.9); the read after a short run produced an explicit refusal (`measurable:false`, "at least one frame boundary was crossed... elapsed cycle count cannot be reconstructed") — the wraparound refusal fires live, never a fabricated number, never `0` |
| Route A stopwatch on a ≥ 3.10 build | TIME-01 | Needs a real `CPUHISTORY_GET` responder; no unit fixture proves the live handshake | Launch a genuine ≥3.10 build with `-binarymonitor`, re-run the `count=0`-vs-`count=1` empirical test, commit the captured response as a fixture | ⚠️ **OUTSTANDING.** Against genuine VICE 3.10 (`/usr/local/bin/x64sc`), forcing Route A surfaced a decode failure: `CPUHISTORY_GET`'s real reply body (52 bytes for `count:1`) does not fit the parser's assumed per-entry layout (which needs 65). A raw-wire probe confirmed the real bytes; root-causing the actual layout is protocol-level investigation outside this plan's docs-only scope. **This is the row blocking `nyquist_compliant: true`** — see `deferred-items.md`, "Route A live decode mismatch against genuine VICE 3.10", for the full byte-level analysis and the recommended follow-up plan |
| `vice_run_until` reaching a real address, and timing out on an unreachable one | TIME-02 | Checkpoint-hit timing only means anything against a real CPU loop | Run a real program, target a reached address (assert hit + checkpoint auto-gone), then an unreachable address (assert timeout + cleanup) | ✅ **PASS**, against both 3.9 and 3.10. `$EA31` (KERNAL IRQ entry) reached with `hitCount:1` within a 5000ms bound; `$C000` (unreached from the idle KERNAL loop) timed out within 1500ms with `cleanup:"deleted"` |
| `vice_diagnose` against a real checkpoint trap and a real wedge | TIME-04 | The four/five verdicts are timing-dependent emulator states, not decodable from fixtures | Arm a real stopping checkpoint (expect `checkpoint_trap`); induce a wedge and a kill-and-respawn (expect `wedged`, `restarted`); open a second monitor connection (expect `monitor_held_elsewhere`) | ⚠️ **PARTIAL.** The `live` verdict is live-confirmed against both 3.9 and 3.10 (a real liveness bracket measured an advance). `checkpoint_trap`, `wedged`, and `restarted` were **not** exercised in this pass — inducing them live (arming a real checkpoint on the IRQ path, forcing a genuine wedge, forcing a kill-and-respawn) needs a longer, more deliberate live session than this plan's docs-only scope covers. Recorded as outstanding, not silently assumed passing |
| Second-client contention does not itself hang the diagnostician | TIME-04 | The failure mode *is* an indefinite hang with no reply and no EOF — only a live second `connect()` proves the guard | With one client attached, run `vice_diagnose` from a second; assert it returns `monitor_held_elsewhere` within its bound rather than blocking | ⚠️ **PARTIAL.** The underlying VICE-side fact is live-confirmed: a second raw TCP `connect()` to the same port succeeds at the socket level and then sits with no reply and no EOF, exactly as documented. The **broker-mediated** `monitor_held_elsewhere` verdict itself (reached via `MonitorOwnershipError` from a real second `claimMonitor()` call) is unit-proven (`stock-diagnose.test.ts`) but not exercised end-to-end here — that requires the actual host broker control plane running two real sessions, which this plan's own dispatch-level harness does not stand up |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Task IDs resolved (no placeholder rows remain in the Per-Task Verification Map)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [ ] Every Manual-Only row has a recorded live result — **four of five have a full PASS; one
      (Route A on a ≥3.10 build) is OUTSTANDING with a named blocker, and two others
      (`vice_diagnose`'s `checkpoint_trap`/`wedged`/`restarted` verdicts; the broker-mediated half
      of second-client contention) are PARTIAL, not full passes**
- [ ] `nyquist_compliant: true` set in frontmatter — **left `false`.** The blocking row is "Route A
      stopwatch on a ≥ 3.10 build": a genuine live decode mismatch against real VICE 3.10, not yet
      root-caused (see `deferred-items.md`). Setting this flag `true` before that row resolves
      would tick a checklist to reach a flag rather than reflect recorded evidence — the standing
      instruction this document itself carries (T-07-19).

**Approval:** blocked on the Route A live-decode finding above; recommend a dedicated follow-up
plan to re-derive `CPUHISTORY_GET`'s real per-entry wire layout from source and fix
`stock-protocol.ts`/`stock-timing.ts` accordingly, then re-run this Manual-Only pass in full
(including the two PARTIAL rows) before setting `nyquist_compliant: true`.
