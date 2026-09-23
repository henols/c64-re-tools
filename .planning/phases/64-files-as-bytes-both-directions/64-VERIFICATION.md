---
phase: 64-files-as-bytes-both-directions
verified: 2026-09-23T20:30:00Z
status: human_needed
score: 5/5 ROADMAP criteria verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-01-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-01-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-02-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-02-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-03-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-03-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-04-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-04-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-05-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-05-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-06-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-06-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-07-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-07-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-08-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-08-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-09-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-09-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-10-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-10-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-11-PLAN.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-11-SUMMARY.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-REVIEW.md"
  - ".planning/phases/64-files-as-bytes-both-directions/64-UAT.md"
  - ".planning/phases/64-files-as-bytes-both-directions/deferred-items.md"
  - ".planning/phases/64-files-as-bytes-both-directions/evidence/64-boundary-confirmations.md"
  - ".planning/phases/64-files-as-bytes-both-directions/evidence/64-convergence-metric.md"
  - ".planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-handle-only-authority.md"
  - ".planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-check.md"
  - ".planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-driver.mjs"
  - ".planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-state-dir-agreement.md"
  - ".planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md"
  - ".planning/todos/pending/2026-09-23-container-clients-cannot-see-the-machine-level-broker-json.md"
  - ".planning/todos/pending/2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md"
  - "CLAUDE.md"
  - "src/mcp/vice/broker-control.mts"
  - "src/mcp/vice/broker-control.test.ts"
  - "src/mcp/vice/broker-endpoint.test.ts"
  - "src/mcp/vice/broker-endpoint.ts"
  - "src/mcp/vice/broker-home.mts"
  - "src/mcp/vice/broker-home.test.ts"
  - "src/mcp/vice/broker-kill.mts"
  - "src/mcp/vice/broker-kill.test.ts"
  - "src/mcp/vice/broker-launch.mts"
  - "src/mcp/vice/broker-launch.test.ts"
  - "src/mcp/vice/broker-relay-text.test.ts"
  - "src/mcp/vice/broker-relay.test.ts"
  - "src/mcp/vice/broker-transfer.mts"
  - "src/mcp/vice/broker-transfer.test.mts"
  - "src/mcp/vice/build.ts"
  - "src/mcp/vice/package.json"
  - "src/mcp/vice/repo-root.test.ts"
  - "src/mcp/vice/repo-root.ts"
  - "src/mcp/vice/resources/broker-control.mjs"
  - "src/mcp/vice/resources/broker-home.mjs"
  - "src/mcp/vice/resources/vice-broker.mjs"
  - "src/mcp/vice/stock-connect.test.ts"
  - "src/mcp/vice/stock-connect.ts"
  - "src/mcp/vice/stock-dispatch.test.ts"
  - "src/mcp/vice/stock-dispatch.ts"
  - "src/mcp/vice/stock-machine.test.ts"
  - "src/mcp/vice/stock-machine.ts"
  - "src/mcp/vice/text-connect.test.ts"
  - "src/mcp/vice/text-connect.ts"
  - "src/mcp/vice/text-tools.test.ts"
  - "src/mcp/vice/text-tools.ts"
  - "src/mcp/vice/tools-manifest.stock.json"
  - "src/mcp/vice/transfer-disjoint-roots.test.ts"
  - "src/mcp/vice/transfer-hash.mts"
  - "src/mcp/vice/transfer-hash.test.mts"
  - "src/mcp/vice/transfer-paths.test.ts"
  - "src/mcp/vice/transfer-paths.ts"
  - "src/mcp/vice/vice-broker-client.test.ts"
  - "src/mcp/vice/vice-broker-client.ts"
  - "src/mcp/vice/vice-broker-launch.test.ts"
  - "src/mcp/vice/vice-broker.mts"
  - "src/mcp/vice/vice-proxy.test.ts"
  - "src/mcp/vice/vice-proxy.ts"
covered_digest: "v1:sha256:eedd3a82607b3b99dfc3fea499d4ec64e8d934b40d83c7ceb70f8b83c90896fb"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "4/5 ROADMAP criteria fully verified, 1 partially verified (behavior present, full-stack behavior not exercised)"
  gaps_closed:
    - "ROADMAP Success Criterion 1 / XFER-08 — the four migrated tools now measured, live, through the real vice-proxy.ts against a real systemd-run broker and the real /usr/bin/x64sc, with zero broker-side path leaks (previously only proven at the protocol/handler layer)."
    - "G-64-1's PRIMARY root cause (vice-proxy.ts never forwarding a control token into StockDispatchDeps) closed by making the broker authenticate attach/transfer by broker-minted handle alone, ahead of the per-boot token gate — verified directly in broker-control.mts and by an independently re-run regression suite."
    - "G-64-1's SECONDARY root cause (broker and client resolving broker.json in different directories on the documented start route) closed by making the client import broker-home.mts's brokerStateDir() directly instead of recomputing a project-relative path — verified directly in vice-broker-client.ts/vice-broker.mts and by independently re-run route-agreement tests."
  gaps_remaining: []
  regressions: []
overrides: []
behavior_unverified_items: []
human_verification:
  - test: "The owner's own in-session re-run of 64-UAT.md test 1: reconnect the vice MCP server (or start a new Claude Code session) so it loads the fixed code; start the broker as a systemd user unit by the documented route with VICE_BIN=/usr/bin/x64sc; run vice_autostart, vice_disk_attach, vice_snapshot_save and vice_snapshot_load; confirm none errors and no result names a path under ~/.c64-re-tools/; read the disk write-loss wording after an attach-write-close cycle; then stop the broker and confirm a clean teardown."
    expected: "All four tools succeed with no broker-side path in any result, matching what plan 64-11's own scripted run and its independent nested Claude Code session both already measured."
    why_human: "Plan 64-11's own Task 3 <human-check> explicitly queues this as the owner's own confirmation step, distinct from (and in addition to) the scripted/nested-session evidence this verifier already re-confirmed against source. This item is inherited from the plan's own design, not invented by this verification."
  - test: "Decide the disposition of the newly discovered, third live defect: a cold-launched broker instance's first relay attach races the real emulator's own startup and is killed by the broker's kill-never-recycle release policy on that race's failure (measured 11 consecutive failures in one session; independently reproduced through a nested Claude Code session's own first vice_ping call)."
    expected: "A recorded decision: fix before the v2.0.0 milestone is treated as production-ready, or accept and track as a fast-follow. The pending todo is filed: .planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md."
    why_human: "This is NOT one of G-64-1's two root causes and is not in scope of any XFER-01..08 requirement — it is a pre-existing timing gap in the broker's acquire→claim→attach chain (vice-broker.mts, from Phase 62/63), invisible to every existing test because every stub emulator binds its port synchronously before a real x64sc ever would. It affects every stock tool call on a cold session, not only the four tools this phase migrated, so whether it blocks Phase 64's own closure is a scope/prioritization call this verifier cannot make unilaterally. It does not block THIS phase's own requirements (XFER-01..08), all of which concern the file-transfer protocol itself, not connection warm-up timing — but a human should read the full evidence (.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-check.md, \"Live defect 1\") before treating Phase 64 as unconditionally shippable."
---

# Phase 64: Files as Bytes, Both Directions Verification Report

**Phase Goal:** The four file-carrying tools work with no shared filesystem
between client and broker at all. Bytes cross the socket; the client writes
only under its own `.c64-re-tools/`; the broker chooses and owns every path
on its own side; neither ever names a path the other must be able to open.

**Verified:** 2026-09-23
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 64-08..64-11, UAT gap G-64-1)

## What changed since the initial verification

The initial verification (2026-09-23, prior round) found 4/5 ROADMAP Success
Criteria fully verified and 1 (Criterion 1 / XFER-08) verified only at the
protocol/handler layer this phase owns — a live attempt through the real
`vice-proxy.ts` entry point failed identically on all four tools with
`"stock handshake failed (vice: missing or invalid control token)"`. UAT then
ran that same test live, confirmed the failure (gap `G-64-1`, blocker
severity), and the owner decided "fix now" rather than defer.

Four gap-closure plans (64-08 through 64-11) closed this:

- **64-08** moved `broker-control.mts`'s `attach` and `transfer` dispatch arms
  ahead of the per-boot control-token gate, authenticating each by its
  broker-minted handle alone (route (b), owner decision 5 — the token is
  never threaded through, per REQUIREMENTS.md's standing rule against a new
  credential).
- **64-09** deleted the now-dead client-side credential parameters from every
  relay/transfer dial option and dependency type, so no future caller can
  re-thread a token back in.
- **64-10** closed G-64-1's secondary cause: the broker and the client now
  resolve `broker.json` through the SAME resolver (`broker-home.mts`'s
  `brokerStateDir()`) for every documented start route; `--repo-root` no
  longer selects a state directory.
- **64-11** measured G-64-1's own truth live: a real, systemd-run broker
  spawning the absolute `/usr/bin/x64sc`, driven by the real `vice-proxy.ts`
  over stdio, with all four tools succeeding — reproduced twice, once by a
  scripted driver and independently again through a real, separate, nested
  `claude -p` session. It also discovered, precisely traced, and (per its own
  explicit prohibition) did NOT fix a third, unrelated live defect — see
  "New finding" below.

## Goal Achievement

### Observable Truths (ROADMAP's five Success Criteria — the contract)

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | All four tools complete end to end against disjoint client/broker filesystem roots, through the real production entry point (XFER-08) | ✓ VERIFIED | Previously blocked at the `vice-proxy.ts` layer by G-64-1. Now closed: `broker-control.mts`'s `handleLine()` dispatches `attach`/`transfer` ahead of `tokensMatch()` (confirmed by direct source read, lines ~1305-1420); `vice-broker-client.ts`'s `brokerRootDir()` delegates to `broker-home.mts`'s `brokerStateDir()` (confirmed by direct source read); the client-side credential fields are gone from `DialMonitorRelayOptions`/`DialFileTransferOptions`/`StockConnectDeps`/`TextConnectOptions`/`StockDispatchDeps` (confirmed: zero `controlToken` hits in `stock-connect.ts`/`stock-dispatch.ts`). The `G-64-1` regression suite in `vice-proxy.test.ts` (tracer/transfer/text, driving the real proxy against a real listener) — independently re-run by this verifier: 4/4 pass. Beyond the offline proof, plan 64-11 measured the literal truth live: a real systemd-run broker spawning `/usr/bin/x64sc`, all four tools `isError: false`, zero broker-side path leaks — reproduced twice (scripted driver + an independent, separate nested Claude Code session reading the stream's own `tool_result` blocks). See "New finding" below for a disclosed, out-of-scope caveat on session warm-up. |
| 2 | A produced file returns as bytes, client writes it under its own `.c64-re-tools/snapshots/`, result names the local path, not a broker path (XFER-01, XFER-02) | ✓ VERIFIED (unchanged) | Unaffected by the gap-closure plans (none touch `stock-machine.ts`'s result-shape logic). Re-confirmed live in 64-11: the saved snapshot path lay under the scratch client project's own `.c64-re-tools/snapshots/`, confirmed 193261 bytes on host. |
| 3 | Bytes survive (including non-UTF-8); a bad transfer is refused, never half-written (XFER-05, XFER-06) | ✓ VERIFIED (unchanged) | Unaffected by the gap-closure plans (none touch `broker-transfer.mts`'s framing/hashing/cap logic). |
| 4 | Traversal refused in both directions, refuse-not-sanitise (XFER-03, XFER-04) | ✓ VERIFIED, with the same disclosed scope note as the initial round | Unaffected by the gap-closure plans (none touch `transfer-paths.ts`). `validateContainedDestination()` still has zero production callers within Phase 64 by design (D-13); its first real caller is Phase 65. Not a regression — the same disclosed scope note as the initial verification. |
| 5 | Staged files do not accumulate: session-close cleanup, stateless-request scratch cleanup, and a startup sweep for crash/vanished-client residue (XFER-07) | ✓ VERIFIED (unchanged) | Unaffected by the gap-closure plans (none touch `broker-kill.mts`'s sweep wiring). |

**Score:** 5/5 ROADMAP criteria verified. Criterion 1 moved from
"protocol/handler layer only, full-stack unverified" to fully VERIFIED —
directly measured live, twice, through independent means, with the wiring
that makes it work confirmed by direct source read and by an independently
re-run regression suite.

### G-64-1's own truth — explicit judgement

The task's own instruction is to judge, from the evidence, whether "G-64-1's
truth (succeed through a real Claude Code session (vice-proxy.ts) against the
real broker and /usr/bin/x64sc, with no broker-side path in any result)" is
met, met with a caveat, or not met.

**Verdict: MET, with one disclosed caveat that is explicitly outside G-64-1's
own scope.**

- **Met:** All four migrated tools (`vice_autostart`, `vice_disk_attach`,
  `vice_snapshot_save`, `vice_snapshot_load`) returned `isError: false`
  through the real `vice-proxy.ts`, against a real systemd-run broker
  spawning the absolute `/usr/bin/x64sc`, with a leak scan finding zero
  occurrences of the broker's machine root in any of the four results. This
  was reproduced independently through a real, separate, nested Claude Code
  session (`claude -p`), reading results from the stream's own `tool_result`
  blocks rather than the model's retelling. The write-loss wording was judged
  against a real attach-write-close cycle (screen-RAM directory proof the
  write reached the attached image, an unchanged host-side sha256 proving it
  never came back). Both of G-64-1's own root causes are independently
  confirmed fixed by direct source read (see Criterion 1 above), not merely
  inferred from the live run succeeding.
- **The caveat:** reaching a successful FIRST tool call in that live run
  required riding out a newly discovered, third, unrelated live defect (a
  cold-launched instance's first relay attach races the real emulator's own
  startup and is killed by the broker's kill-never-recycle release policy —
  measured 11 consecutive failures before one attempt won the race, in the
  scripted run, and independently reproduced through the nested session's own
  first `vice_ping` attempt). The workaround used was a bounded retry at the
  test/driver level, never a production-code change (explicitly prohibited
  by plan 64-11's own frontmatter). No code path in the current
  acquire→claim→attach chain (`vice-broker.mts`, `broker-relay.mts`) actually
  implements the wait `vice-proxy.ts`'s own `brokerWarmingMessage()` comment
  describes as the intended remedy.
- **Why this does not reopen G-64-1 or fail Criterion 1:** the new defect is
  not one of G-64-1's two diagnosed root causes (the control-token gate and
  the state-directory mismatch), is not in scope of any `XFER-01..08`
  requirement (all eight concern the file-transfer protocol itself — framing,
  hashing, staging, cleanup, traversal — never connection warm-up timing), and
  predates Phase 64 architecturally (the acquire/claim/attach code it traces
  to is Phase 62/63 work, untouched by any Phase 64 plan). It is precisely
  traced with line citations, disclosed in full in
  `evidence/64-g641-live-check.md`, and filed as its own pending todo
  (`2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md`)
  rather than silently worked around. It is routed to human verification
  below because whether it blocks the v2.0.0 milestone's own
  production-readiness is a scope/prioritization call this verifier cannot
  make unilaterally — the same posture the initial verification took toward
  G-64-1 itself before the owner's "fix now" decision.

### Supporting Plan-Level Must-Haves (gap-closure plans 64-08..64-11)

Cross-checked against all four plans' `must_haves` blocks. Independently
re-verified by this verifier, not trusted from SUMMARY claims:

- `broker-control.mts`'s `handleLine()`: `attach` and `transfer` dispatched
  immediately after `hello`, before `tokensMatch()` — confirmed by direct
  source read (lines ~1268-1420); every existing handle check (length-gated
  `timingSafeEqual`, second-attach refusal, unknown-handle refusal, in-flight
  guard) is untouched, confirmed unchanged in `vice-broker.mts`.
- `broker-endpoint.ts`'s `DialMonitorRelayOptions`/`DialFileTransferOptions`:
  no credential field — confirmed by direct source read (lines ~626-647,
  843-861).
- `stock-connect.ts`/`stock-dispatch.ts`: zero `controlToken` occurrences —
  confirmed by grep against the live tree.
- `vice-broker-client.ts`'s `brokerRootDir()`: `return brokerStateDir();` —
  a direct delegation, confirmed by source read (line 113-114), with the
  import from `./broker-home.mts` present (line 40).
- `package.json`'s `files[]`: `broker-home.mts`, `broker-endpoint.ts`,
  `transfer-hash.mts`, `transfer-paths.ts`, `tool-location.mts` all present —
  confirmed by grep. (64-10's own pack-and-import check additionally caught
  and fixed a second, independent closure gap — `tool-location.mts` — beyond
  the plan's own originally-scoped four modules; disclosed in the SUMMARY,
  not hidden.)
- `CLAUDE.md`'s `.c64-re-tools/` bullet: corrected to state broker state
  lives under the machine-level root, not any project's tree — confirmed by
  direct read.
- `node --test --test-reporter=tap --test-name-pattern="G-64-1" vice-proxy.test.ts`
  → **4/4 pass** (independently re-run by this verifier).
- `node --test --test-reporter=tap broker-control.test.ts broker-endpoint.test.ts
  vice-broker-launch.test.ts repo-root.test.ts resources-sync.test.ts
  broker-home.test.ts vice-broker-client.test.ts` → **282/282 pass**
  (independently re-run by this verifier).
- `npm run typecheck` → **exit 0** (independently re-run by this verifier).
- `grep -nE "TBD|FIXME|XXX"` across all 11 gap-closure-touched non-test
  modules → zero matches (debt-marker gate clear, independently re-checked).
- No broker/emulator process or listener on 19510/66xx was running before or
  after this verification's own commands (confirmed).

### Required Artifacts (gap-closure additions)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/broker-control.mts` (modified) | `attach`/`transfer` dispatched ahead of the token gate, handle-only authority | ✓ VERIFIED | Confirmed by direct source read; every comment describing the old ordering rewritten. |
| `src/mcp/vice/broker-endpoint.ts` (modified) | `resolveEndpointPort()`, no credential field on either dial option type | ✓ VERIFIED | Confirmed by direct source read (lines 66-104, 626-647, 843-861). |
| `src/mcp/vice/vice-broker-client.ts` / `vice-broker.mts` (modified) | One shared resolver (`brokerStateDir()`) for the state directory on both sides | ✓ VERIFIED | Confirmed by direct source read; `--repo-root` no longer joins a state-directory path in `parseArgs()`. |
| `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-handle-only-authority.md` | The T-63-01/T-63-05 reversal record | ✓ VERIFIED | Present, all 8 required sections (What changed, Why route b, What it reverses, Replacement mitigation, Residual risk, What did NOT change, Latent port note, Proof). |
| `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-state-dir-agreement.md` | The state-dir decision record | ✓ VERIFIED | Present, all 6 required sections. |
| `.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-live-driver.mjs` + `64-g641-live-check.md` | The live proof of G-64-1's own truth | ✓ VERIFIED | Present; the evidence file's tool-call table, leak scan, write-loss cycle, teardown checks and nested-session section all read as measured observations, not narration. |
| Three new pending todos (control-token resolution, container-client interim limit, cold-launch race) | Filed, not silently absorbed | ✓ VERIFIED | All three present under `.planning/todos/pending/`, each naming an owning phase or a disposition ask. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `vice-proxy.ts` → `stock-dispatch.ts` → `stockConnect()` | The four migrated handlers, in a real MCP session | `dispatchStockFor()` | ✓ WIRED (previously ✗ NOT_WIRED) | The link the initial verification found broken (the control token never forwarded) is now moot: `attach`/`transfer` no longer need the token at all (route b), so `dispatchStockFor()` correctly supplies nothing — confirmed by the independently re-run `G-64-1` regression suite (4/4 pass) and by the live run through the real entry point (twice, independently). |
| `broker-control.mts`'s `attach`/`transfer` arms | `vice-broker.mts`'s `handleRelayAttach()`/`handleFileTransfer()` | direct call, dispatch position moved, handle checks untouched | ✓ WIRED | Confirmed by direct source read: the dispatch arms still call `opts.onRelayAttach()`/`opts.onFileTransfer()` with the same signature; only their position relative to `tokensMatch()` changed. |
| `vice-broker-client.ts` | `broker-home.mts` | value import of `brokerStateDir()` | ✓ WIRED | Confirmed by direct source read (import at line 40, delegation at line 113-114). |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| XFER-01 | 64-01, 64-02, 64-04, 64-06, 64-07, 64-11 | Produced-file bytes return over socket, local path in result | ✓ SATISFIED | `stock-machine.test.ts`; live-confirmed in 64-11 (snapshot path under the scratch client project's own `.c64-re-tools/snapshots/`). |
| XFER-02 | 64-01, 64-02, 64-04, 64-06, 64-11 | Consumed-file read client-side, streamed to broker | ✓ SATISFIED | `stock-machine.test.ts`; live-confirmed in 64-11 (`vice_snapshot_load`). |
| XFER-03 | 64-01 | Broker-supplied name traversal refused, not sanitised | ✓ SATISFIED (validator correct; scope-limited — unchanged, see criterion 4) | `transfer-paths.test.ts`; no production caller in Phase 64 (disclosed, by design). |
| XFER-04 | 64-01, 64-02, 64-03, 64-08, 64-09 | Broker chooses staging paths; client uses opaque handle only | ✓ SATISFIED | `broker-control.test.ts`, `broker-transfer.test.mts`, `vice-broker-staging.test.ts`; the gap-closure plans reinforce this by making `attach`/`transfer` themselves handle-authenticated. |
| XFER-05 | 64-01, 64-02, 64-04, 64-07 | Bytes survive round trip, including non-UTF-8 | ✓ SATISFIED | Unchanged from initial verification. |
| XFER-06 | 64-01 | Integrity-checked end to end, cap refused by name | ✓ SATISFIED (one non-blocking client-side gap, WR-01, unchanged) | `broker-transfer.test.mts`; `64-REVIEW.md` WR-01. |
| XFER-07 | 64-03, 64-05 | Staged files removed on session close; crash sweep | ✓ SATISFIED | Unchanged from initial verification. |
| XFER-08 | 64-02, 64-04, 64-06, 64-07, 64-08, 64-09, 64-10, 64-11 | All four tools work over the socket, no shared filesystem | ✓ SATISFIED (upgraded from partial) | `transfer-disjoint-roots.test.ts`; the `G-64-1` regression suite (4/4, independently re-run); 64-11's live run through the real proxy, twice, independently. |

No orphaned requirements: `grep -n "Phase 64" .planning/REQUIREMENTS.md` still
names exactly XFER-01..08, and all eight remain declared across the eleven
plans' frontmatter (`grep -A5 "^requirements:"` across all 64-*-PLAN.md files).

### Anti-Patterns Found

Sourced from `64-REVIEW.md` (code review run against the full gap-closure
diff, 25 files, 0 critical / 2 warning / 1 info — re-read, and its file/count
totals independently confirmed against the report's own frontmatter):

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `broker-endpoint.ts:97-104` vs. `broker-control.mts:833-839` | — | `VICE_BROKER_CONTROL_PORT` validated inconsistently between the new dial-side `resolveEndpointPort()` (strict) and the pre-existing bind-side `resolveControlPort()` (loose) | ⚠️ Warning | A malformed port value produces the least-informative of the four ranked dial failures rather than naming the env var as the cause; not a correctness defect, a diagnosability gap. |
| `broker-control.mts` (attach/transfer/monitor_claim/monitor_release/operation/stage_file arms) | ~1325-1667 | Six synchronous dispatch callbacks have no `try/catch`, unlike their async siblings (`host_tool`, `acquire`, `recycle`) | ⚠️ Warning | No concrete throwing input found in today's implementations; a future change to any of the six callbacks could crash the whole broker process rather than just the offending connection. Latent, not demonstrated. |
| `broker-home.mts` | (info-level, not itemised further here) | Stale doc-comment referencing an import that does not exist | ℹ️ Info | Cosmetic; does not affect behaviour. |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any of the gap-closure-touched
source modules (re-checked directly against the live tree, not from SUMMARY
claims). No blocker-level anti-pattern found, consistent with `64-REVIEW.md`'s
own `status: issues_found` / 0 critical verdict.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| G-64-1 regression suite (real proxy, real listener, real broker-side handlers) | `node --test --test-reporter=tap --test-name-pattern="G-64-1" vice-proxy.test.ts` | `# tests 4 / # pass 4 / # fail 0` | ✓ PASS |
| Broker-control/endpoint/launch/client/home/repo-root/resources-sync suites | `node --test --test-reporter=tap broker-control.test.ts broker-endpoint.test.ts vice-broker-launch.test.ts repo-root.test.ts resources-sync.test.ts broker-home.test.ts vice-broker-client.test.ts` | `# tests 282 / # pass 282 / # fail 0` | ✓ PASS |
| Typecheck clean | `npm run typecheck` | exit 0, no `error TS` lines | ✓ PASS |
| No credential field survives in production dial types | `grep -n controlToken stock-connect.ts stock-dispatch.ts` | zero hits | ✓ PASS |
| Broker/client share one state-dir resolver | `grep -n "brokerRootDir\|brokerStateDir" vice-broker-client.ts` | delegation confirmed at line 113-114 | ✓ PASS |
| `attach`/`transfer` dispatched ahead of the token gate | `grep -n "case \|tokensMatch" broker-control.mts` (direct read of `handleLine()`) | both arms precede the `tokensMatch()` call | ✓ PASS |
| No debt markers in gap-closure-touched modules | `grep -nE "TBD\|FIXME\|XXX"` across 11 modules | zero matches | ✓ PASS |
| No leftover process/listener at verification time | `ss -ltn`, `pgrep -af 'x64sc\|vice-broker'` | none running | ✓ PASS |
| Full automated gate (orchestrator-measured, cited not re-run in full per this project's full-suite convention) | `npm run test:automated` | 4241 tests, 4232 pass, 0 fail, 9 skipped, exit 0 | ✓ PASS (cited) |
| `vice-proxy.test.ts` full file (orchestrator-measured) | `node --test vice-proxy.test.ts` | 60/57 pass, 0 fail, 3 skipped | ✓ PASS (cited) |
| `vice-broker-launch.test.ts` full file (orchestrator-measured) | `node --test vice-broker-launch.test.ts` | 24/24 pass | ✓ PASS (cited) |

### Probe Execution

Not applicable — this phase's own verification criteria are proven by the
`G-64-1` regression suite and the live-check evidence file, not by a
`scripts/*/tests/probe-*.sh` convention. No such probes are declared by any
Phase 64 plan or referenced by success criteria.

### Human Verification Required

1. **The owner's own in-session re-run of UAT test 1.**
   **Test:** Reconnect the vice MCP server (or start a new Claude Code
   session) so it loads the fixed code; start the broker as a systemd user
   unit by the documented route with `VICE_BIN=/usr/bin/x64sc`; run
   `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save` and
   `vice_snapshot_load`; confirm none errors and no result names a path
   under `~/.c64-re-tools/`; read the disk write-loss wording after an
   attach-write-close cycle; then stop the broker and confirm a clean
   teardown (no `vice-broker`/`x64sc` process, no listener on 19510 or any
   66xx port).
   **Expected:** All four succeed, matching plan 64-11's own scripted and
   nested-session measurements.
   **Why human:** Plan 64-11's own Task 3 queues this explicitly as a
   `<human-check>` — the owner's own confirmation, distinct from (and in
   addition to) the scripted/nested-session evidence this verifier already
   re-confirmed against source and by independently re-running the targeted
   test suites.

2. **Disposition of the newly discovered cold-launch relay-attach race.**
   **Test:** N/A — a scope/prioritization decision, not a test.
   **Expected:** A recorded decision: fix before the v2.0.0 milestone is
   treated as production-ready, or accept and track as a fast-follow (the
   pending todo already names it:
   `.planning/todos/pending/2026-09-23-cold-launch-relay-attach-races-emulator-startup-and-gets-killed.md`).
   **Why human:** Not one of G-64-1's own two root causes and not in scope
   of any `XFER-01..08` requirement (see "G-64-1's own truth" above for the
   full reasoning) — but it is a real, precisely-traced, severe defect
   (blocks the first stock tool call of almost every fresh session on this
   host) that a maintainer should weigh before treating the milestone as
   shippable, even though it does not block THIS phase's own goal.

### Gaps Summary

No artifact the gap-closure plans own is missing, stub, or unwired. No key
link the gap-closure plans own is broken — the one link the initial
verification found broken (`vice-proxy.ts` never forwarding a control token)
is resolved not by fixing the forwarding but by removing the need for it
entirely (route b), independently re-verified against source and by
re-running the targeted regression suites rather than trusted from SUMMARY
claims. All eight `XFER-01..08` requirements are satisfied, with no orphaned
requirements.

The phase is not marked `passed` because two items require a human decision:
plan 64-11's own already-queued in-session re-run (inherited from the plan's
own design, not new scope this verifier invented), and the disposition of a
newly discovered, precisely-traced, out-of-G-64-1-scope live defect that this
same live-check run surfaced. Neither is a FAILED must-have of this phase's
own goal or requirements — both are disclosed, filed, and routed for a
human's own judgement, matching the posture this project's verification
process took toward G-64-1 itself before the owner's "fix now" decision.

---

_Verified: 2026-09-23_
_Verifier: Claude (gsd-verifier)_
