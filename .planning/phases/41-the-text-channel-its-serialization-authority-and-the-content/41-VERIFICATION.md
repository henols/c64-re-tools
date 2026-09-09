---
phase: 41-the-text-channel-its-serialization-authority-and-the-content
verified: 2026-09-09T10:38:16Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 41: The Text Channel, Its Serialization Authority, and the Contention Verdict Verification Report

**Phase Goal:** A user's tool call reaches VICE's text monitor over the `-remotemonitor` port, with responses framed by the prompt rather than by a timeout; every halt-taking operation on **either** channel passes through one serialization authority **whose shape Phase 39's verdict selected**; and an emulator that is merely contended between the two channels is reported as contended rather than diagnosed as wedged and destroyed.
**Verified:** 2026-09-09T10:38:16Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This verification did not trust SUMMARY.md claims at face value. For each of
the five ROADMAP success criteria, the actual source was read and, where the
criterion made a live/measured claim, the underlying test file was **re-run
independently, fresh, in this verification session** against genuine stock
`/usr/bin/x64sc` (VICE 3.9), with no broker or `x64sc` process left running
before or after. All non-live automated tests for the phase's changed modules
were also re-run, plus one full `npm run test:automated` pass.

## Goal Achievement

### Observable Truths (mapped to ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|------|--------|----------|
| 1 | A container-side caller can learn the text-monitor port of the instance it holds | ✓ VERIFIED | `HeldLease.remoteMonitorPort?: number` at `vice-broker-client.ts:841` (inside the `HeldLease` interface starting `:801`), documented as "MANDATORY on a stock grant, ABSENT on a fork grant" and enforced by `broker-launch.mts`'s `no_free_text_port` acquire failure (see #3/#5 below). Live-reproduced fresh in this session: `text-monitor-live.test.ts`'s first case (`"a stock grant carries remote_monitor_port, textConnect() dials it..."`) passed. |
| 2 | A tool call issues a text-monitor command and gets its complete response back, framed by the prompt and not by a timeout, with two planted controls each observed RED without the fix | ✓ VERIFIED | `text-protocol.ts:278` `export class TextMonitorClient`. Re-ran `text-protocol.test.ts` "Control 1"/"Control 2" tests fresh in this session: both planted controls genuinely construct the class in the pre-fix configuration (`quiescenceMs: 0`) and assert the RED failure occurs (`Control 2 (planted RED...)`: asserts `payload === ""`, i.e. the bug reproduced), then separately assert the GREEN fix on the default-configured class — this is a live A/B demonstration, not a narrated claim. All 4 tests passed (82–71ms each). The live end-to-end round trip (split-TCP-segment `memmapshow`, ~48KB in this run) was also re-run live and passed. |
| 3 | The serialization authority is the shape Phase 39 selected (in-process async mutex under `go`), both channels' halting operations go through it, the two binary-side invariants are unchanged, and a test asserts identical checkpoint-state visibility from both channels | ✓ VERIFIED | `channel-lock.ts:304` `export function acquireChannelLock`, FIFO queue, holder record, `channelLockRefusalMessage()` — contains none of "wedge/hang/frozen/stuck/unresponsive" vocabulary (grep-checked). `stock-run-until.ts`/`stock-reproducible-run.ts` confirmed untouched by this phase's diffs (per SUMMARY's own `git diff --name-only` evidence, spot-checked). Live-reproduced fresh: the criterion-3 live test (checkpoint id/address/enabled-state agreement across both channels) and the interleaving-refusal live test both passed in this session's fresh run, with the refusal text observed live containing no wedge/hang vocabulary. |
| 4 | A contended instance is reported as contended (not wedged), `vice-wedge-triage` is fixed in this phase, and the new signature is reproduced live and recorded at a stated confidence | ✓ VERIFIED | `stock-diagnose.ts:1076` places `tryAcquireChannelLock()` immediately before the first liveness bracket (step 4), short-circuiting to `verdict: live, bracketsRun: 0` on a foreign hold — read and confirmed structurally unreachable-`wedged`-while-contended by inspection of the code path (a `wedged` return is only reachable after two full brackets ran, which only happens when this call itself held the lock). `STOCK_DIAGNOSE_VERDICTS` confirmed frozen at exactly five entries (`stock-diagnose.ts:407-412`); contention is evidence (`channelContention`), not a sixth verdict. `vice-wedge-triage/SKILL.md` carries the contention row, the `evidence.channelContention` section, and a provenance row graded **MEDIUM**, explicitly distinguished from the neighbouring **HIGH** two-binary row and honest about its single-binary (`/usr/bin/x64sc`, VICE 3.9) basis. Live-reproduced fresh in this session: the CHAN-05 live test (`vice_diagnose` observes a live text-channel hold as `verdict=live, bracketsRun=0, channelContention.held=true, channel="text"`, then a real bracket runs once released) passed. |
| 5 | The `default_memspace` remedy is exercised (not merely made available) via a live test that contaminates and then restores it, and the three narrowed CLAUDE.md constraints each gain a scoping clause without deletion/weakening | ✓ VERIFIED | `CLAUDE.md`'s three narrowed bullets (`default_memspace`/`device c:`, `WarpMode`, `CPUHISTORY_GET`) all read intact, each retaining its original `MEASURED 2026-08-27` clause **and** a newly appended Phase 41 citation to `docs/phase41-text-channel-live-evidence.md` (grep-confirmed: `phase41-text-channel-live-evidence` appears 3×, `MEASURED 2026-08-27` appears 3×, `binary monitor only` appears 3× — no bullet lost either marker). `docs/phase41-text-channel-live-evidence.md` read in full: its "Named gaps" section states "None for this run" and the contamination-and-remedy path is documented as genuinely measured (not skipped), with the actual PC-freeze-then-recovery numbers (`0xfd83` frozen, `0xfd83`→`0xfd80` after remedy) and the caveat about `CHECKPOINT_LIST`'s own `default_memspace` scoping recorded as a newly-measured fact. Live-reproduced fresh in this session: criterion-5's contamination-and-remedy test (drive checkpoint armed over 1541 ROM, main-CPU PC observed frozen at `0xfd83`, `device c:` issued, PC observed to advance `0xfd83`→`0xfd80`) and the `warp on`/`warp off` re-probe both passed. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Fresh Live Re-run (this verification session, not carried over from SUMMARY claims)

Ran from a clean state (`pgrep -fa vice-broker` and `pgrep -fa x64sc` both empty before and after):

```
VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts
```

Result: **7/7 pass, 0 skipped, 0 failed**, covering — in order — the basic port/framing round trip, the multi-segment `memmapshow` framing proof, the criterion-3 cross-channel checkpoint-visibility proof, the criterion-3 interleaving-refusal proof, the CHAN-05 contention proof, the criterion-5 `default_memspace` contamination-and-remedy proof, and the D-04 `warp on`/`warp off` re-probe. All measured values (PC addresses, checkpoint ids, refusal text, response byte counts) were freshly observed in this session, not copied from a prior SUMMARY.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/text-protocol.ts` | `TextMonitorClient`, framing, allowlist, quiescence window | ✓ VERIFIED | 606 lines, class exported, 8-entry `TEXT_COMMAND_ALLOWLIST` confirmed |
| `src/mcp/vice/text-connect.ts` | `textConnect()` session lifecycle | ✓ VERIFIED | 157 lines, function exported |
| `src/mcp/vice/text-protocol.test.ts` | Framing unit tests incl. 2 planted controls + WR-01 fix tests | ✓ VERIFIED | 526 lines; re-ran targeted subset, all pass |
| `src/mcp/vice/text-connect.test.ts` | Claim/connect/release unit tests | ✓ VERIFIED | 287 lines |
| `src/mcp/vice/text-monitor-live.test.ts` | The phase's one live E2E proof | ✓ VERIFIED | 1103 lines, 7 live cases, re-ran fresh, 7/7 pass |
| `src/mcp/vice/channel-lock.ts` | Cross-channel FIFO mutex | ✓ VERIFIED | 349 lines, `acquireChannelLock`/`tryAcquireChannelLock`/holder record exported |
| `src/mcp/vice/channel-lock.test.ts` | Unit proof of FIFO/timeout/release-on-throw | ✓ VERIFIED | 338 lines |
| `src/mcp/vice/broker-state.mts` | `InstanceRecord.monitorClients` per-channel map | ✓ VERIFIED | `monitorClients: Partial<Record<MonitorChannel,...>>` confirmed non-optional |
| `src/mcp/vice/stock-diagnose.ts` | `channelContention` evidence + pre-bracket guard | ✓ VERIFIED | 1158 lines, guard placed before first liveness bracket at line ~1076 |
| `src/mcp/vice/tools-manifest.stock.json` | `channelContention` schema, 2 new tools (38→40) | ✓ VERIFIED | `channelContention` present, tool count = 40 |
| `src/skills/vice-wedge-triage/SKILL.md` | Contention row + MEDIUM provenance row | ✓ VERIFIED | Contention row, `evidence.channelContention` section, MEDIUM row present and distinguished from HIGH |
| `src/mcp/vice/text-tools.ts` | `handleDeviceConsole`/`handleWarpSet` | ✓ VERIFIED | Both exported, `needsSession:false` registration confirmed |
| `docs/phase41-text-channel-live-evidence.md` | This phase's own live evidence record | ✓ VERIFIED | 225 lines, full read, "Named gaps: None" |
| `CLAUDE.md` | 3 narrowed constraints re-cited | ✓ VERIFIED | 3/3/3 grep counts confirmed, no deletion |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `vice-broker.mts` `handleAcquire()` | `broker-control.mts` grant wire | `remoteMonitorPort` / `remote_monitor_port` | ✓ WIRED (grep-confirmed both sides) |
| `vice-proxy.ts` `buildHeldLease()` | `text-connect.ts` `textConnect()` | `remoteMonitorPort` field read off `HeldLease` | ✓ WIRED |
| `stock-dispatch.ts` `withStockSession`/`withDerivedTool` | `channel-lock.ts` | `withChannelLockHeld()` wraps handler call for `channel:"binary"` | ✓ WIRED |
| `text-protocol.ts` `command()` | `channel-lock.ts` | `withTextChannelLock()`, refuses when not held | ✓ WIRED |
| `stock-diagnose.ts` `handleDiagnoseStock()` | `channel-lock.ts` | `tryAcquireChannelLock()` guard before step-4 bracket | ✓ WIRED |
| `tools-manifest.stock.json` | `src/skills/vice-wedge-triage/SKILL.md` | `evidence.channelContention` read by the skill's table | ✓ WIRED |
| `stock-dispatch.ts` | `text-tools.ts` | `handleDeviceConsole`/`handleWarpSet` registered `needsSession:false` | ✓ WIRED |

### Data-Flow Trace (Level 4)

`channelContention` is derived once per `vice_diagnose` call (`channelContentionFor()`), spread unconditionally into `evidence`, and read live in this session's fresh test run with real values (`held:true, channel:"text", operation:"device c:", heldMs:2968` while held; `held:false, channel:null,...,heldMs:null` after release) — confirmed flowing from a real `tryAcquireChannelLock()`/`currentChannelLockHolder()` call, not a static placeholder.

### Behavioral Spot-Checks / Live Proofs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Text-channel round trip + 2 planted controls | `node --test --test-name-pattern="Control 1\|Control 2" text-protocol.test.ts` | 4/4 pass | ✓ PASS |
| WR-01 fix (banner-drain quiescence) | `node --test --test-name-pattern="WR-01" text-protocol.test.ts` | 3/3 pass | ✓ PASS |
| Full phase unit-test set | `node --test text-protocol.test.ts text-connect.test.ts channel-lock.test.ts stock-dispatch.test.ts broker-state.test.ts broker-control.test.ts stock-diagnose.test.ts text-tools.test.ts capability-registry.test.ts` | 372/372 pass | ✓ PASS |
| Full live E2E suite (fresh, this session) | `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` | 7/7 pass, 0 skipped | ✓ PASS |
| Full automated suite (once) | `npm run test:automated` | 3693 tests / 3679 pass / 3 fail | ✓ PASS (matches documented pre-existing `anno-register.test.ts` baseline exactly; no phase-41 file among the 3 failures) |
| Typecheck | `npm run typecheck` | clean | ✓ PASS |
| Docs guards | `docs-linerefs.test.ts`, `docs-dangling-refs.test.ts`, `docs-absorbed-decisions.test.ts`, `resources-sync.test.ts`, `shipped-modules.test.ts`, `test-gate.test.ts` | 44/44 pass | ✓ PASS |
| `docs/tool-support.md` regeneration | `node scripts/generate-tool-support-table.mjs` then `git status --short docs/tool-support.md` | no diff | ✓ PASS (never hand-edited) |
| Forbidden vocabulary in refusals | grep `channelLockRefusalMessage()`, `renderStockContendedReport()` | no wedge/hang/frozen/stuck/unresponsive | ✓ PASS |
| Debt markers in changed files | grep TBD/FIXME/XXX across 12 core phase-41 files | none found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| CHAN-02 | 41-01, 41-03, 41-05 | Container-side caller can learn text-monitor port | ✓ SATISFIED | `HeldLease.remoteMonitorPort`, mandatory-on-stock enforced via `no_free_text_port` |
| CHAN-03 | 41-01, 41-06 | Tool call reaches text monitor, framed by prompt | ✓ SATISFIED | `TextMonitorClient`, live round trip, `vice_device_console`/`vice_warp_set` shipped |
| CHAN-04 | 41-02 | Single serialization authority, invariants preserved | ✓ SATISFIED | `channel-lock.ts`, both channels routed through it, live cross-channel checkpoint-visibility proof |
| CHAN-05 | 41-04, 41-06 | Contention reported as contended, skill fixed same phase | ✓ SATISFIED | `channelContention` evidence, structural `wedged`-unreachable guard, `vice-wedge-triage/SKILL.md` updated |

No orphaned requirements — `.planning/REQUIREMENTS.md` lines 124-127 map exactly `CHAN-02..05` to Phase 41, all marked Complete, matching the four plan-declared requirement sets exactly.

### Anti-Patterns Found

None found in the 12 core phase-41 source files scanned (text-protocol.ts, text-connect.ts, channel-lock.ts, stock-diagnose.ts, text-tools.ts, broker-state.mts, broker-control.mts, broker-launch.mts, vice-broker.mts, vice-broker-client.ts, vice-proxy.ts, stock-connect.ts): no TBD/FIXME/XXX, no placeholder/stub return patterns, no forbidden wedge-vocabulary in refusal text.

### Human Verification Required

None. Every ROADMAP success criterion resolved to VERIFIED via a combination of direct code inspection and a fresh, independently re-run live test against genuine stock `/usr/bin/x64sc` (VICE 3.9) executed during this verification session (not merely re-quoted from a prior SUMMARY.md claim).

### Gaps Summary

No gaps. All five ROADMAP success criteria are met with both static evidence (code inspection, wiring, manifest/schema checks) and fresh dynamic evidence (a live re-run of the phase's own E2E test suite in this verification session, plus a full non-live automated-suite run landing exactly at the documented, pre-existing, out-of-scope 3-failure baseline in `anno-register.test.ts`).

One note for the record, not a gap: `docs/phase41-text-channel-live-evidence.md`'s own "Named gaps" section states "None for this run" — the document's only self-identified residual risk (a drive checkpoint that might not hit within the bounded window on a different host) was not encountered in either the original phase-41 live runs or this verification's own fresh re-run, and the test's own `t.skip()` fallback for that scenario was not exercised.

---

_Verified: 2026-09-09T10:38:16Z_
_Verifier: Claude (gsd-verifier)_
