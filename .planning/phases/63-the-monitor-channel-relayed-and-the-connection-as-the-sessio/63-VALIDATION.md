---
phase: "63"
slug: "the-monitor-channel-relayed-and-the-connection-as-the-session"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-19"
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase from `63-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node:test`) — no third-party runner (`src/mcp/vice/package.json`) |
| **Config file** | none — `src/mcp/vice/test-gate.mjs` is the automated-suite *selector*, not a framework config |
| **Quick run command** | `node --test <edited>.test.ts` from `src/mcp/vice/` |
| **Full suite command** | `npm --prefix src/mcp/vice test` (`node --test '*.test.*'` — runs everything, including the 12 `MANUAL_ONLY_TESTS`) |
| **Estimated runtime** | ~180 seconds full glob; a single file is seconds |

**Gate-composition fact this phase turns on — again, and harder than Phase 62.**
`npm run test:automated` (this project's configured `test_command`) runs
`automatedTestFiles()`, which excludes the frozen 12-member `MANUAL_ONLY_TESTS`
array (`src/mcp/vice/test-gate.mjs:141-153`). Three of those twelve are exactly
the files a relay phase reaches for first:

- `broker-e2e.test.ts` — spawns a real broker
- `vice-broker-launch.test.ts` — spawns a real broker
- `vice-proxy.test.ts` — the stdio server whose connection lifetime SESS-02 is about

**A new relay-lifecycle assertion written only into one of those three is
invisible to CI.** Every lifecycle behaviour this phase introduces must have an
automated home in a file that is *not* on that list — the research names a new
`broker-relay.test.ts` as that home. Mirroring an assertion into a manual-only
file as well is fine; relying on one alone is not.

**Two suite traps that fake a green reading.** `node --test` silently skips a
missing or mistyped filename and still exits 0 — `ls` or `test -f` the file
before trusting a run. Piping `npm test` reports the *pipe's* exit code —
redirect to a file and read `$?` on the same line.

---

## Sampling Rate

- **After every task commit:** `node --test <the file(s) that task edited>` — by name, never `test:automated` as a stand-in when the edited file is manual-only.
- **After every plan wave:** `npm --prefix src/mcp/vice test` (full glob), plus `npm --prefix src/mcp/vice run typecheck`.
- **Before `/gsd-verify-work`:** full `npm test` green — not `test:automated`, for the reason stated above.
- **Max feedback latency:** ~180 seconds (full glob); seconds for a single file.

**Injected clocks are mandatory, not a convenience.** SESS-04's bounded idle
detection and SESS-03's abrupt-death path must not wait out real wall-clock
minutes. This repo's standing convention for anything touching time is an
injectable override (`now?: () => number`, as in `stock-checkpoints.ts:298,384`).
Any lifecycle test that sleeps on a real timer is a defect in the test, not a
slow test.

**Port discipline, carried forward from Phase 62 and now load-bearing.** Port
19510 is a persistent machine-wide fixture, so a live broker is the *expected*
state rather than an accident. Every test that binds or dials a control port
allocates dynamically (`VICE_BROKER_CONTROL_PORT: "0"`) or refuses by name when
an unexpected listener answers. No test may assume 19510 is free.

**Scratch discipline.** This suite has a recorded history of races on scratch
files written into the repo tree. Write scratch under `mkdtemp` in the OS temp
dir and reap it in a `try/finally`; never into the repo. `/tmp` on this host is
a tmpfs whose aging is disabled — leaked scratch is leaked RAM.

**Byte-mode discipline.** The relay carries raw binmon frames that are not
valid UTF-8. `broker-control.mts`'s existing reader decodes every chunk with
`chunk.toString("utf8")`. A test that asserts transparency by comparing strings
will pass while the bytes are corrupted — every transparency assertion compares
`Buffer` contents, never strings.

---

## Per-Task Verification Map

*Seeded by plan-phase before the planner ran; the per-task rows below are filled
from the PLAN.md files once they exist. The requirement → evidence map is
already binding.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 63-01 T1 | 63-01 | 1 | SESS-02 | T-63-01 | Attach gated on a per-claim handle compared constant-time, never a bare target id | integration (stub emulator + real control listener, loopback) | `node --test broker-relay.test.ts broker-control.test.ts broker-endpoint.test.ts stock-protocol.test.ts resources-sync.test.ts` | ❌ W0 (`broker-relay.test.ts` new) | ⬜ pending |
| 63-01 T2 | 63-01 | 1 | SESS-02 | T-63-07 | Pre-splice Buffer carry capped at the control line limit; no string decode of relayed bytes | integration + source gate | `node --test broker-relay.test.ts broker-control.test.ts` | ✅ after T1 | ⬜ pending |
| 63-01 T3 | 63-01 | 1 | SESS-02 | — | Two grants relay concurrently without cross-wiring | integration + full glob | `node --test stock-connect.test.ts stock-dispatch.test.ts broker-relay.test.ts`; `npm test` | ✅ files exist | ⬜ pending |
| 63-02 T1 | 63-02 | 2 | SESS-02 | T-63-08 | Text attach refuses a missing text-monitor port by name before any dial | integration (stub text monitor, loopback) | `node --test broker-relay-text.test.ts text-connect.test.ts text-protocol.test.ts resources-sync.test.ts` | ❌ W0 (`broker-relay-text.test.ts` new) | ⬜ pending |
| 63-02 T2 | 63-02 | 2 | SESS-02 | T-63-09 | A dead text relay fails the session; no reconnect entry point exists on the text path | integration + source gate | `node --test broker-relay-text.test.ts broker-relay.test.ts stock-connect.test.ts` | ✅ after T1 | ⬜ pending |
| 63-03 T1 | 63-03 | 3 | SESS-05 | T-63-10, T-63-11 | Operation declaration ownership-gated and sanitised before any state sees it | unit/integration (real listener) | `node --test broker-control.test.ts vice-broker-client.test.ts resources-sync.test.ts` | ✅ files exist | ⬜ pending |
| 63-03 T2 | 63-03 | 3 | SESS-05 | T-63-12 | Atomic, owner-only record written into the machine-level incidents directory | unit (temp dir) | `node --test broker-incident.test.ts resources-sync.test.ts incident-record.test.ts` | ❌ W0 (`broker-incident.test.ts` new) | ⬜ pending |
| 63-03 T3 | 63-03 | 3 | SESS-05 | T-63-13 | Declaration never blocks or fails a tool call | integration + source gate + full glob | `node --test broker-control.test.ts`; `npm test` | ✅ files exist | ⬜ pending |
| 63-04 T1 | 63-04 | 4 | SESS-03, SESS-05 | T-63-06, T-63-14 | Record durable before any claim release, socket destroy or kill; teardown idempotent per grant and channel | integration (loopback, injected writer/recorders) | `node --test broker-relay.test.ts resources-sync.test.ts` | ✅ after 63-01 | ⬜ pending |
| 63-04 T2 | 63-04 | 4 | SESS-04 | T-63-02, T-63-16 | Broker-owned bounded idle deadline, suspended while an operation is declared; keepalive labelled secondary | integration (injected timer, no real sleep) | `node --test broker-relay.test.ts broker-relay-text.test.ts broker-control.test.ts` | ✅ after 63-02 | ⬜ pending |
| 63-04 T3 | 63-04 | 4 | SESS-05 | T-63-15 | Evidence written ahead of the identity-verified kill; pid-match discipline unchanged | integration + source gate + full glob | `node --test broker-relay.test.ts broker-relay-text.test.ts broker-control.test.ts broker-incident.test.ts`; `npm test` | ✅ after 63-03 | ⬜ pending |
| 63-05 T1 | 63-05 | 5 | SESS-06 | T-63-03, T-63-18 | Label sanitised and capped; status identity resolved by the same port-and-pid comparison the release path uses | unit/integration (real listener) | `node --test broker-control.test.ts vice-broker-client.test.ts resources-sync.test.ts` | ✅ files exist | ⬜ pending |
| 63-05 T2 | 63-05 | 5 | SESS-02, SESS-06 | T-63-17 | No target-naming op accepts a session label as a selector | integration (real listener, two connections) | `node --test broker-control.test.ts` | ✅ files exist | ⬜ pending |
| 63-05 T3 | 63-05 | 5 | SESS-01 | T-63-19 | A stateless call leaves broker state deeply equal and fires no lease callback | integration + source gate + full glob | `node --test broker-control.test.ts host-tool-transport.test.ts`; `npm test` | ✅ files exist | ⬜ pending |
| 63-06 T1 | 63-06 | 5 | SESS-02 | T-63-20 | Live proof default-skips with a reported reason, never a false pass | live, opt-in, default-SKIP | `env -u VICE_LIVE_RELAY_BIN node --test stock-live-relay.test.ts` | ❌ W0 (`stock-live-relay.test.ts` new) | ⬜ pending |
| 63-06 T2 | 63-06 | 5 | SESS-02, SESS-06 | T-63-21, T-63-22 | No emulator or broker process outlives the live run; a failing live case is a finding, not a relaxed assertion | live (human-check) + census + full glob | `node --test hostpath-consumers.test.ts`; `npm test`; live run with the opt-in variable set | ✅ after T1 | ⬜ pending |

### Requirement → evidence map (from `63-RESEARCH.md` § Validation Architecture)

| Req ID | Behaviour that must be proven | Test type | File | Exists? |
|--------|-------------------------------|-----------|------|---------|
| SESS-01 | A stateless, skill-script-shaped call opens, sends, receives and closes — binding no emulator and holding no lease | unit / structural | extend `host-tool.test.ts` / `host-tool-transport.test.ts`, or a structural assertion over the dispatch path | ✅ files exist |
| SESS-02 | An MCP server's connection lifetime equals the emulator-hold lifetime, *observable in broker status* | integration (real spawned broker, `VICE_BROKER_CONTROL_PORT: "0"`) | new automated file + mirrored into `broker-e2e.test.ts` | ❌ W0 |
| SESS-03 | `socket.destroy()` (abrupt, no `FIN`) on the relay connection reclaims the instance from socket events alone | integration, synthetic loopback pair — no live VICE | new `broker-relay.test.ts` | ❌ W0 |
| SESS-04 | A death that produces no `FIN` at all is detected within a bounded, *injected-clock* time — not the OS's ~7200s keepalive default | integration, synthetic loopback, injected `now()`/timers | same new file | ❌ W0 |
| SESS-05 | An incident record exists **before** the instance is reclaimed, carrying a broker-minted reason naming the in-flight operation; a live capture/checkpoint run is marked void | integration; assert write-ordering relative to the kill call | same new file | ❌ W0 |
| SESS-06 | Broker `status` output lets a user positively identify their own session among unrelated projects' sessions | unit | new cases in `broker-control.test.ts` | ❌ W0 (new field) |
| Criterion 1 | True byte-transparency end to end: a real register read, memory write, checkpoint hit and `JAM` parse identically after relaying | live, opt-in, default-SKIP | a new member of the `stock-*-live.test.ts` family, gated by an env var like its siblings | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each gap below is closed by the first task of the plan that owns it, before any
expansion depends on it.

- [ ] A new **automated** test file for the synthetic client/server relay-lifecycle matrix — abrupt (`socket.destroy()`) × graceful (`socket.end()`) × idle (never sends), across the binary and text channels. Styled after `stock-run-until.ts`'s synthetic-client precedent, with `now?: () => number` timer injection. It must NOT be added to `MANUAL_ONLY_TESTS`.
- [ ] New relay/attach-op cases in `src/mcp/vice/broker-control.test.ts` — no existing case exercises a relay op or a post-handshake byte-pipe mode.
- [ ] New `status`-identity cases (SESS-06) in `src/mcp/vice/broker-control.test.ts` — `StatusInstanceEntry` carries no identity fields today.
- [ ] An incident-ordering assertion for SESS-05 — `brokerIncidentsDir()` exists in `broker-home.mts` but is unwired; nothing writes a broker-side incident yet.
- [ ] A live, default-SKIP byte-transparency test for Success Criterion 1, gated by an env var in the style of `stock-live-broker-monitor.test.ts`.
- [ ] Framework install: none needed — `node:test` is already wired.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A relayed register read, memory write, checkpoint hit and `JAM` parsing identically to the direct dial | Success Criterion 1 | Needs genuine binmon wire bytes from a real `x64sc`; a stub server cannot produce VICE's actual frames | `cd src/mcp/vice && VICE_LIVE_*_BIN=/usr/bin/x64sc node --test <new live file>` |
| One broker holding sessions from two unrelated project roots at once | SESS-02, SESS-06 | `broker-e2e.test.ts` is on the frozen `MANUAL_ONLY_TESTS` list; it spawns a real broker | `cd src/mcp/vice && node --test broker-e2e.test.ts` |
| The stdio MCP server's connection living for the life of the process | SESS-02 | `vice-proxy.test.ts` is manual-only | `cd src/mcp/vice && node --test vice-proxy.test.ts` |
| A real client `SIGKILL` reclaiming its instance | SESS-03 | Requires an actual process kill against a live broker; the synthetic pair proves the socket semantics, not the process semantics | `cd src/mcp/vice && node --test broker-e2e.test.ts` with the kill case opted in |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] Every lifecycle assertion has a home OUTSIDE `MANUAL_ONLY_TESTS`
- [ ] Every timing assertion uses an injected clock, never a real sleep
- [ ] Every transparency assertion compares `Buffer` contents, never strings
- [ ] Every control-port test allocates dynamically or refuses an unexpected listener
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
