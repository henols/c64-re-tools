---
phase: 64-files-as-bytes-both-directions
verified: 2026-09-23T00:00:00Z
status: human_needed
score: 4/5 ROADMAP criteria fully verified, 1 partially verified (behavior present, full-stack behavior not exercised)
covered_files:
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
  - ".planning/phases/64-files-as-bytes-both-directions/64-REVIEW.md"
  - ".planning/phases/64-files-as-bytes-both-directions/evidence/64-boundary-confirmations.md"
  - ".planning/phases/64-files-as-bytes-both-directions/evidence/64-convergence-metric.md"
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
  - "src/mcp/vice/broker-relay.test.ts"
  - "src/mcp/vice/broker-transfer.mts"
  - "src/mcp/vice/broker-transfer.test.mts"
  - "src/mcp/vice/build.ts"
  - "src/mcp/vice/repo-root.ts"
  - "src/mcp/vice/resources/broker-control.mjs"
  - "src/mcp/vice/resources/broker-home.mjs"
  - "src/mcp/vice/resources/broker-kill.mjs"
  - "src/mcp/vice/resources/broker-launch.mjs"
  - "src/mcp/vice/resources/broker-transfer.mjs"
  - "src/mcp/vice/resources/transfer-hash.mjs"
  - "src/mcp/vice/resources/vice-broker.mjs"
  - "src/mcp/vice/stock-broker-live.test.ts"
  - "src/mcp/vice/stock-connect.test.ts"
  - "src/mcp/vice/stock-connect.ts"
  - "src/mcp/vice/stock-dispatch.test.ts"
  - "src/mcp/vice/stock-live-broker-monitor.test.ts"
  - "src/mcp/vice/stock-machine.test.ts"
  - "src/mcp/vice/stock-machine.ts"
  - "src/mcp/vice/stock-paths.ts"
  - "src/mcp/vice/stock-recycle.test.ts"
  - "src/mcp/vice/text-connect.test.ts"
  - "src/mcp/vice/text-monitor-live.test.ts"
  - "src/mcp/vice/text-tools.test.ts"
  - "src/mcp/vice/tools-manifest.stock.json"
  - "src/mcp/vice/transfer-disjoint-roots.test.ts"
  - "src/mcp/vice/transfer-hash.mts"
  - "src/mcp/vice/transfer-hash.test.mts"
  - "src/mcp/vice/transfer-paths.test.ts"
  - "src/mcp/vice/transfer-paths.ts"
  - "src/mcp/vice/tsconfig.build.json"
  - "src/mcp/vice/vice-broker-acquire.test.ts"
  - "src/mcp/vice/vice-broker-client.test.ts"
  - "src/mcp/vice/vice-broker-client.ts"
  - "src/mcp/vice/vice-broker-staging.test.ts"
  - "src/mcp/vice/vice-broker.mts"
  - ".planning/REQUIREMENTS.md"
covered_digest: "v1:sha256:71d94ae601db7022d6cd5cfaa1f46b340a32b8e6c17ee61ac876457199c2ce2b"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "ROADMAP Success Criterion 1 — vice_autostart, vice_disk_attach, vice_snapshot_save and vice_snapshot_load each complete end to end against a real production client (Claude Code via vice-proxy.ts) and a real broker/emulator, with no shared filesystem."
    test: "Start the real broker as its systemd unit against the absolute /usr/bin/x64sc; drive each of the four tools through a genuine vice-proxy.ts stdio session (the actual MCP entry point), exactly as a live Claude Code session would."
    expected: "All four tool calls succeed and no broker-side path appears in any result."
    why_human: "The phase's own automated proof (transfer-disjoint-roots.test.ts) drives the real stock-machine.ts handlers, the real compiled broker-control.mts/vice-broker.mts/broker-transfer.mts staging and control-listener code, and a real dialFileTransfer() connection — but constructs the StockConnectSession by hand and stubs the emulator's command responses; it never calls stockConnect(), dispatchStock(), or vice-proxy.ts. Plan 64-07 additionally ran the real end-to-end path live (systemd-unit broker, absolute /usr/bin/x64sc, real vice-proxy.ts over stdio) and every one of the four tool calls failed identically with \"stock handshake failed (vice: missing or invalid control token)\", traced to vice-proxy.ts's dispatchStockFor() never forwarding the broker's control_token into StockDispatchDeps. No Phase 64 commit touches vice-proxy.ts or stock-dispatch.ts, and StockDispatchDeps.controlToken was added by Phase 63 (commit bba7a44e) and never wired at this one call site. This is presence+wiring at every layer this phase owns, with a live, reproducible negative result one layer up, in a module this phase does not modify — a human must decide whether this pre-existing, disclosed defect (todo: .planning/todos/pending/2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md) blocks reliance on this phase's own deliverable in production."
human_verification:
  - test: "Run the four migrated tools through a real, unmodified Claude Code session against the systemd-unit broker and the absolute /usr/bin/x64sc, after fixing (or deciding not to fix, for this verification round) vice-proxy.ts's control-token wiring gap."
    expected: "All four tools complete and report a local client-side path; no broker-side path appears anywhere in any result; disk write-loss wording reads correctly after a real attach-write-close cycle."
    why_human: "Blocked in-session by the control-token defect (see behavior_unverified_items). This is the same live-check plan 64-07's own <human-check> items 1 and 2 attempted and recorded as attempted-but-blocked (D6/D7 in 64-07-SUMMARY.md), not fabricated new scope."
  - test: "Confirm the disposition of the control-token todo: is this in-scope for Phase 64 to fix before sign-off, or does it get tracked and fixed in a dedicated follow-up (e.g. at the start of Phase 65, before any skill script tries to reach the endpoint)?"
    expected: "A maintainer decision, recorded either as an accepted-and-tracked risk or a blocking fix requirement."
    why_human: "This is a scope/prioritization call the codebase cannot make for itself — the defect affects every tool reachable through vice-proxy.ts, not only the four migrated by this phase, so its fix may reasonably belong to a different unit of work than this phase's plans."
---

# Phase 64: Files as Bytes, Both Directions Verification Report

**Phase Goal:** The four file-carrying tools work with no shared filesystem
between client and broker at all. Bytes cross the socket; the client writes
only under its own `.c64-re-tools/`; the broker chooses and owns every path
on its own side; neither ever names a path the other must be able to open.

**Verified:** 2026-09-23
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP's five Success Criteria — the contract)

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | All four tools complete end to end against disjoint client/broker filesystem roots (XFER-08) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (full stack) / ✓ VERIFIED (protocol+handler layer) | `transfer-disjoint-roots.test.ts` drives real `stock-machine.ts` handlers, the real compiled broker (`vice-broker.mts`/`broker-control.mts`/`broker-transfer.mts`), a real control listener and real staging directory, across two disjoint `mkdtempSync` roots — independently re-run, 54/54 pass. But the session object is hand-built (not `stockConnect()`), and `dispatchStock()`/`vice-proxy.ts` are never invoked. A live attempt through the real `vice-proxy.ts` entry point (64-07's own `<human-check>` item 1) failed identically on all four tools at the relay handshake, tracing to a pre-existing, un-owned-by-this-phase gap: `vice-proxy.ts`'s `dispatchStockFor()` never forwards `control_token` into `StockDispatchDeps`. See `behavior_unverified_items`. |
| 2 | A produced file returns as bytes, client writes it under its own `.c64-re-tools/snapshots/`, result names the local path, not a broker path (XFER-01, XFER-02) | ✓ VERIFIED | `stock-machine.test.ts`'s `assertNoStagedPathLeak()`/`assertNoLeak()` helpers enumerate every result key for both `handleSnapshotSave`/`handleSnapshotLoad` and `handleAutostart`/`handleDiskAttach`; `transfer-disjoint-roots.test.ts`'s recursive `collectStringLeaves()`/`assertNoPrefixLeak()` scanner is proven to catch a planted 3-level-deep violation before being trusted against the four real results. `tools-manifest.stock.json` requires `handle`, not `sentPath`, for all four tools, checked by `stock-dispatch.test.ts`'s conformance harness. |
| 3 | Bytes survive (including non-UTF-8); a bad transfer is refused, never half-written (XFER-05, XFER-06) | ✓ VERIFIED | `broker-transfer.test.mts`: 3+ MiB / 76800-byte full-byte-range (0x00-0xFF) payloads round-trip byte-for-byte over a real socket; cap enforced independently at both ends (16777216 accepted, 16777217 refused, both directions); malformed `byteLength` (`-1`, `1.5`, `"12"`, `null`, `MAX_SAFE_INTEGER+2`) refused before the pipeline is constructed; mid-stream abort and socket-destroyed-mid-payload leave no file and no temp file. Independently re-run: pass. One non-blocking WARNING (WR-01, see Anti-Patterns) exists in the client-side mirror of this check. |
| 4 | Traversal refused in both directions, refuse-not-sanitise (XFER-03, XFER-04) | ✓ VERIFIED, with a disclosed scope note | `transfer-paths.test.ts` (26 cases, independently re-run: pass) covers all four D-13 fixtures (`../../etc/passwd`, `/etc/passwd`, `C:\`, NUL-embedded) plus empty/dot/fullwidth-solidus edges, pure, no I/O. `broker-transfer.mts`'s `stageFileSlot()` refuses unsafe grant/slot values before any directory is created. **Scope note, disclosed by the phase itself:** `validateContainedDestination()` has zero production callers within Phase 64 — the broker never supplies the client a destination name to validate in this phase's actual data flow (the four tools use broker-minted opaque handles instead); its first real caller is Phase 65. The rule exists and is correctly unit-tested, not wired into a live path yet. This matches the phase's own D-13 disclosure exactly and is not a defect. |
| 5 | Staged files do not accumulate: session-close cleanup, stateless-request scratch cleanup, and a sweep for crash/vanished-client residue (XFER-07) | ✓ VERIFIED, with one terminology note | `clearStagingForSession()` wired into both branches of `handleRelease()` (`vice-broker.mts:1825,1853`) — the function `broker-control.mts`'s `onRelease` invokes both on an explicit release and on the control connection's own close (including SIGKILL), tested in `vice-broker-staging.test.ts`. Transfer scratch (the `.tmp-<pid>-<ts>` file) is atomically renamed on success or `rmSync`'d on every failure path in both `broker-transfer.mts:314-342` and `stock-connect.ts:555-581` — confirmed directly in source, so a stateless transfer's own scratch never outlives its response. `sweepOrphanedStaging()`/`reapOrphanedConfigScratch()` wired into the real broker's startup-reap block before the control listener binds (`vice-broker.mts:1972-1973`), tested in `broker-kill.test.ts`. **Terminology note:** the ROADMAP text says "age-based sweep"; the implementation is a startup-only, unconditional sweep with no age/mtime check at all, per an explicit, documented owner decision (D-07, `64-CONTEXT.md`): every directory found at broker startup is *by definition* residue, because live sessions are already reclaimed by socket events (SESS-03/SESS-04), so a periodic timer was offered and declined as adding tuning surface and a race window the startup-only variant structurally cannot have. Functionally equivalent to the stated intent; not a gap. |

**Score:** 4/5 ROADMAP criteria fully verified at the codebase level; 1 (criterion 1) verified at the protocol/handler layer this phase actually owns, with a live-reproduced negative result one layer outside this phase's own file scope, routed to human verification rather than scored as failed or passed.

### Supporting Plan-Level Must-Haves

Cross-checked against all seven plans' `must_haves` blocks (64-01 through 64-07). Every truth in every plan traces to one of the five ROADMAP criteria above via its own `(XFER-NN/...)` tag; none reduces or contradicts the ROADMAP contract. Representative spot-checks, independently re-run rather than trusted from SUMMARY claims:

- `node --test transfer-disjoint-roots.test.ts broker-transfer.test.mts transfer-paths.test.ts` → 54/54 pass (re-run by this verifier, not copied from a SUMMARY).
- `grep -n "clearStagingForSession"` in `vice-broker.mts` → both call sites present and inside the release/close path (re-confirmed by direct source read).
- `grep -n "sweepOrphanedStaging\|reapOrphanedConfigScratch"` in `vice-broker.mts` → both wired before the control listener binds (re-confirmed by direct source read).
- `grep -nE "TBD|FIXME|XXX"` across all 13 phase-touched non-test/non-resource modules → zero matches (debt-marker gate clear).
- `git status --porcelain` after the above runs → clean of Phase 64 scratch; no `x64sc`/`vice-broker` process left running.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/transfer-hash.mts` + `resources/transfer-hash.mjs` | Streaming cap+digest Transform, 16 MiB constant | ✓ VERIFIED | Present, substantive (9 unit cases), wired into `broker-transfer.mts` and `stock-connect.ts`; `resources-sync.test.ts` passes. |
| `src/mcp/vice/broker-transfer.mts` + `resources/broker-transfer.mjs` | Header framing, sender/receiver, staging model | ✓ VERIFIED | Present, substantive (34 unit+integration cases across 64-01/64-03), wired into `vice-broker.mts`. |
| `src/mcp/vice/transfer-paths.ts` | Pure containment validator + relocated snapshot name/path owner | ✓ VERIFIED (artifact) / ⚠️ ORPHANED (validator only, disclosed, see criterion 4) | `validateContainedDestination()` has no live caller in Phase 64 by design (D-13); `validateSnapshotName()`/`snapshotPathFor()`/`snapshotMetaPathFor()` ARE wired, into `stock-paths.ts` and `stock-machine.ts`. |
| `src/mcp/vice/broker-control.mts` | `stage_file`/`transfer` control-plane ops | ✓ VERIFIED | Wired into `vice-broker.mts`'s `startControlListenerOnHosts()`; ownership-gated vs. handle-only dispatch both tested. |
| `src/mcp/vice/broker-endpoint.ts` | `dialFileTransfer()` | ✓ VERIFIED | Wired into `stock-connect.ts`'s default `transferFile`; tested against a fake broker and (in 64-07) a real one. |
| `src/mcp/vice/stock-machine.ts` (4 handlers) | Migrated off `withEmulatorSidePath()` | ✓ VERIFIED | `grep` for `stock-paths.ts` import and `withEmulatorSidePath` outside comments: zero matches. All four handlers stage-then-send/resolve-then-stage-then-upload-then-send, tested individually (64-04/64-06) and jointly (64-07). |
| `src/mcp/vice/tools-manifest.stock.json` | `handle` (and `writeLoss`) replace `sentPath` | ✓ VERIFIED | Confirmed by `stock-dispatch.test.ts`'s conformance harness against the real `dispatchStock()` answer shape. |
| `src/mcp/vice/broker-kill.mts` (2 new sweeps) | Startup reap for config-scratch and staging residue | ✓ VERIFIED | Wired into `vice-broker.mts`'s startup block; opposite lifetime rules (live-pid-guarded vs. unconditional) tested side by side. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `stock-machine.ts` handlers | `broker-control.mts` `stage_file`/`transfer` | `session.brokerControl.stageFile()` / `session.deps.transferFile()` | ✓ WIRED | Confirmed by handler-level tests (64-04/64-06) and the joint disjoint-roots test (64-07). |
| `vice-broker.mts` | `broker-transfer.mts` staging model | `handleStageFile()`/`handleFileTransfer()`/`clearStagingForSession()` | ✓ WIRED | Direct source read: both handlers registered in the same `startControlListenerOnHosts()` options object as `onRelayAttach`/`onOperation`; `clearStagingForSession()` called from both branches of `handleRelease()`. |
| `stock-connect.ts` `defaultTransferFile()` | `broker-endpoint.ts` `dialFileTransfer()` | direct call | ✓ WIRED, but with a disclosed duplication | `defaultTransferFile()` reimplements (does not import) `broker-transfer.mts`'s wire shape — measured, re-confirmed twice (64-02, 64-04), as an unavoidable consequence of `.mts` host-bound modules' relative imports only resolving post-build, while `stock-connect.ts` is a plain, never-built container-side file. Two copies of the same shape are an accepted, documented cost (also flagged as REVIEW.md WR-01: the two copies' declared-length validation diverges slightly). |
| `vice-proxy.ts` → `stock-dispatch.ts` → `stockConnect()` | The four migrated handlers, in a real MCP session | `dispatchStockFor()` | ✗ NOT_WIRED (pre-existing, out of phase scope) | `control_token` is never forwarded from the broker's acquire reply into `StockDispatchDeps` at this one call site. No Phase 64 commit touches either file. Confirmed: `grep -ni controlToken vice-proxy.ts` → zero code hits (one comment only, line 834); `StockDispatchDeps.controlToken` exists since Phase 63 (`bba7a44e`). This is the link a real Claude Code session needs and it is broken today, for every tool reachable through this entry point, not only the four this phase migrated. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| XFER-01 | 64-01, 64-02, 64-04, 64-06, 64-07 | Produced-file bytes return over socket, local path in result | ✓ SATISFIED | `stock-machine.test.ts`, `transfer-disjoint-roots.test.ts` |
| XFER-02 | 64-01, 64-02, 64-04, 64-06 | Consumed-file read client-side, streamed to broker | ✓ SATISFIED | `stock-machine.test.ts` (handleAutostart/handleDiskAttach/handleSnapshotLoad) |
| XFER-03 | 64-01 | Broker-supplied name traversal refused, not sanitised | ✓ SATISFIED (validator correct; scope-limited — see criterion 4 note) | `transfer-paths.test.ts`; no production caller in Phase 64 (disclosed, by design) |
| XFER-04 | 64-01, 64-02, 64-03 | Broker chooses staging paths; client uses opaque handle only | ✓ SATISFIED | `broker-control.test.ts`, `broker-transfer.test.mts`, `vice-broker-staging.test.ts` |
| XFER-05 | 64-01, 64-02, 64-04, 64-07 | Bytes survive round trip, including non-UTF-8 | ✓ SATISFIED | `broker-transfer.test.mts`, `stock-machine.test.ts`, `transfer-disjoint-roots.test.ts` (76800-byte full-range payload) |
| XFER-06 | 64-01 | Integrity-checked end to end, cap refused by name | ✓ SATISFIED (one non-blocking client-side gap, WR-01) | `broker-transfer.test.mts`; `64-REVIEW.md` WR-01 |
| XFER-07 | 64-03, 64-05 | Staged files removed on session close; crash sweep | ✓ SATISFIED (see terminology note above) | `vice-broker-staging.test.ts`, `broker-kill.test.ts` |
| XFER-08 | 64-02, 64-04, 64-06, 64-07 | All four tools work over the socket, no shared filesystem | ⚠️ SATISFIED at protocol/handler layer; full-stack production behavior UNVERIFIED (blocked by an out-of-scope, pre-existing defect) | `transfer-disjoint-roots.test.ts`; 64-07's own live-test attempt (blocked); see `behavior_unverified_items` |

No orphaned requirements: `grep -n "Phase 64" .planning/REQUIREMENTS.md` names exactly XFER-01..08, and all eight are declared across the seven plans' frontmatter.

### Anti-Patterns Found

Sourced from `64-REVIEW.md` (code review already run against this phase, 39 files, 0 critical / 4 warning / 0 info), re-read and treated as findings rather than trusted as resolved:

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `stock-connect.ts` | 540-551 | Client-side download path validates only the upper half of D-11's declared-length check (misses non-integer/negative/NaN) | ⚠️ Warning | Not currently exploitable (per-chunk cap + digest/length compare still catch it), but is the exact "checked wherever consumed" mandate implemented asymmetrically. |
| `broker-transfer.mts:467-481` | — | `stageFileSlot()`'s supersession does not consult the in-flight-transfer guard before deleting a handle's registry entry/file | ⚠️ Warning | Unreachable through today's 4 call sites (channel lock serialises them), but a real gap in the general primitive, undocumented until this review. |
| `broker-transfer.mts:544-563` | — | `clearStagingForSession()` has no guard against a transfer in flight on a separate connection | ⚠️ Warning | POSIX semantics prevent corruption (unlink-after-open-fd, failed rename lands on the existing refusal path), but produces a confusing error rather than a clean one; undiscussed anywhere in the module. |
| `vice-broker.mts:1153,1161` | — | Transfer handles logged verbatim to broker stderr on failure | ⚠️ Warning | Inconsistent with the sibling `refuseUnsafeSegment()`'s stated never-echo posture for the same class of secret; low practical exposure (host-local log). |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any of the 13 phase-touched source modules (re-checked directly, not from SUMMARY claims). No blocker-level anti-pattern found in this phase's own code, consistent with `64-REVIEW.md`'s `status: issues_found` / 0 critical verdict.

### Process Observation (not a goal failure)

Plans 64-03, 64-04 and 64-06 each disclosed combining their `tdd="true"` tasks' RED and GREEN into a single commit rather than a strict RED-then-GREEN pair. `workflow.tdd_mode` is `false` in this project's configuration, so the automated gate-enforcement machinery was not active, and each plan's own SUMMARY records this explicitly as a "discipline gap" rather than omitting it. Cross-checked against the actual test files: every acceptance-criteria row named in each plan's `must_haves.truths` has a corresponding passing test case in the relevant `*.test.ts`/`*.test.mts` file (independently spot-run above, 54/54 pass on the sampled subset; orchestrator-reported full suite 4398/4314/0 fail). No evidence this hid a missing test — the coverage is present, just not committed as a separate RED artifact. Recorded as a process note per the task instructions, not counted against the phase goal.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Disjoint-roots proof + transfer core + containment validator all pass | `node --test transfer-disjoint-roots.test.ts broker-transfer.test.mts transfer-paths.test.ts` | `# tests 54 / # pass 54 / # fail 0` | ✓ PASS |
| Session-close cleanup wired | `grep -n clearStagingForSession vice-broker.mts` | both call sites inside `handleRelease()`'s two branches | ✓ PASS |
| Startup sweeps wired before listener binds | `grep -n "sweepOrphanedStaging\|reapOrphanedConfigScratch" vice-broker.mts` | both present, called at :1972-1973 | ✓ PASS |
| Atomic temp-then-rename on both sides of the wire | `grep -n "tmpPath\|rmSync\|renameSync" broker-transfer.mts stock-connect.ts` | present on both sides, matching pattern | ✓ PASS |
| No debt markers in phase-touched modules | `grep -nE "TBD\|FIXME\|XXX"` across 13 modules | zero matches | ✓ PASS |
| No leftover process/scratch after verification | `pgrep x64sc; pgrep vice-broker; git status --porcelain` | none running; clean | ✓ PASS |
| Full pre-existing suite (orchestrator-run, cited not re-run in full) | `npm test` | 4398 tests, 4314 pass, 0 fail, 84 skipped, exit 0 | ✓ PASS (cited) |

### Human Verification Required

1. **Run the four migrated tools through a real, unmodified Claude Code session against the real broker and a real `/usr/bin/x64sc`.**
   **Test:** Start the broker as its systemd unit (never a detached shell process), point it at the absolute `/usr/bin/x64sc`, and call `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save` and `vice_snapshot_load` from a real session.
   **Expected:** All four succeed and no broker-side path appears in any result; disk write-loss wording reads correctly after a real attach-write-close cycle.
   **Why human:** This phase's own automated proof stops one layer short of `vice-proxy.ts`/`dispatchStock()`, and a live attempt through that real entry point failed identically on all four tools with `"stock handshake failed (vice: missing or invalid control token)"` — traced precisely to `vice-proxy.ts`'s `dispatchStockFor()` never forwarding `control_token` into `StockDispatchDeps` (a Phase 63 field, never wired at this call site, and not touched by any Phase 64 commit). A todo is already filed: `.planning/todos/pending/2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md`.

2. **Decide the disposition of the control-token wiring gap.**
   **Test:** N/A — a scope/prioritization decision, not a test.
   **Expected:** A recorded decision: fix before treating Phase 64 (or the milestone) as production-ready, or accept and track as a fast-follow (e.g., at the start of Phase 65, before any skill script exercises this same endpoint).
   **Why human:** The defect is not specific to the four tools this phase migrated — it blocks every tool reachable through `vice-proxy.ts` today — so whether it is "this phase's problem" is a judgment call this verifier cannot make unilaterally. Recommending it be resolved (or explicitly, knowingly deferred) before this milestone is presented as shippable.

### Gaps Summary

No artifact this phase owns is missing, stub, or unwired. No key link this phase owns is broken. The protocol core (framing, hashing, cap enforcement, atomic publish, both-direction traversal refusal), the broker's staging model, the crash/session cleanup sweeps, and all four tool handlers are implemented, code-reviewed (0 critical), and independently re-tested by this verifier, not merely trusted from SUMMARY claims.

The one open item is a live, reproducible failure of the full production path (`vice-proxy.ts` → `stock-dispatch.ts` → the migrated handlers) due to a control-token wiring gap that predates this phase (Phase 63), is outside every plan's own `files_modified`, and was discovered and transparently disclosed by this phase's own final plan (64-07) rather than hidden. It is not scored as a phase-goal FAILURE because it is not a defect in anything this phase built, and treating it as a Phase-64 gap would misattribute a cross-cutting production-readiness issue to the wrong unit of work. It is not scored as PASSED either, because the ROADMAP's own criterion 1 language ("complete end to end") is not true today for a real client. It is routed to human verification, matching the phase's own already-recorded, already-blocked `<human-check>` items.
