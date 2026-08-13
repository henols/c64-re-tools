---
phase: 02-stock-backend-connection
verified: 2026-08-13T15:30:00Z
status: passed
score: 5/5 roadmap success criteria verified; 16/16 requirements accounted for
overrides_applied: 0
deferred:
  - truth: "VERIF-02's three capturable fixtures (display-get, event-interleaved, checkpoint-list) are real hardware captures"
    addressed_in: "Follow-up todo (no milestone phase claims this — tracked as a standing todo, per user's explicit D-19 override)"
    evidence: ".planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md — acceptance check defined, provenance honestly marked synthetic in every sidecar and in docs/phase2-backend-probe-evidence.md §1"
  - truth: "BACK-01/BACK-04's --help backend discriminator (classifyHelpOutput()/probeBackend()) is confirmed against a real stock and a real fork x64sc binary"
    addressed_in: "Follow-up todo (docs/phase2-backend-probe-evidence.md §2 records the verdict as OPEN, not resolved either way)"
    evidence: ".planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md — acceptance check defined"
---

# Phase 2: Stock Backend Connection Verification Report

**Phase Goal:** The server can be pointed at a stock VICE and hold a correct, correlated, event-demultiplexed conversation with it
**Verified:** 2026-08-13T15:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Environment Constraint Applied

No real stock or fork VICE binary is reachable in this verification environment (user ruling, standing across the phase: "we can't do tests with deciding what vice is"; live validation "can only be made later"). Per the governing instruction, hardware-only proof gaps below are classified as **deferred with tracked follow-up** rather than FAILED or UNCERTAIN, and both required follow-up todos were confirmed to exist under `.planning/todos/pending/` (see `deferred:` above). D-19's override (synthetic fixtures in place of live captures) was checked for honest provenance stamping, not merely for existence — see Data Integrity section below.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Setting one config value switches backend; fork path identical to v0.1.x, existing suite passes unchanged | ✓ VERIFIED | `VICE_BACKEND` is the one documented override, read in exactly one place (`backend-detect.mts`, D-01, confirmed by grep — no second reader). `git diff f32d93e -- tools-manifest.json` is empty (fork manifest byte-identical to phase start). `broker-launch.test.ts:1760` asserts `buildViceArgs()`'s fork branch is byte-identical to pre-Phase-2. Ran `npm run test:automated` myself: **557 tests, 552 pass, 0 fail, 5 todo** (pre-existing, unrelated to this phase — vice-sync.ts checkpoint/screenshot helpers documented as requiring a real emulator). `npm run typecheck` clean; `node build.ts` produced no `resources/*.mjs` drift; `node scripts/check-npm-packages.mjs` exit 0. |
| 2 | Broker launches unmodified x64sc with binary-monitor flags (stock) / existing flags (fork), chosen by backend; single in-flight launch, crash supervision, incident-before-kill all survive | ✓ VERIFIED | `buildViceArgs()` in `broker-launch.mts` returns `-binarymonitor -binarymonitoraddress ip4://<host>:<port>` for stock (loopback-default bind, documented safety posture) and the exact prior `-mcpserver ...` argv for fork, gated by one `backend` parameter. Crash-supervision tests (`superviseChild`, respawn backoff, give-up threshold, recycle-consumes-no-budget) are unaffected by the backend change and pass. The broker's synchronous `inFlight` check-and-set was not touched (confirmed by direct read and by REVIEW-FIX's own claim, which I did not take on faith — grep shows no `await` was added inside `tryLaunchOne()`'s guard). Incident-record-before-kill (`vice-proxy.ts`'s recycle path, pre-existing) is unchanged; only its *registration* became backend-aware (CR-07, confirmed in source, not just the review report — see `buildBackendAwareTool()` at `vice-proxy.ts:3165`). |
| 3 | Exactly one monitor client owns an emulator instance; a second connection is a reported conflict, never a diagnosed wedge | ✓ VERIFIED | `stockConnect()` claims via `monitor_claim` **before** any socket is opened (read directly in `stock-connect.ts:287-300`). `broker-control.mts`'s `ownsTarget()` predicate (post CR-03 fix, confirmed in source) gates `monitor_claim`/`monitor_release`/`recycle` identically, closing the spoofable-ownership defect the review found. A refusal surfaces as `MonitorOwnershipError` naming the holder, never the words "wedged"/"hung"/"unresponsive" (grep-gated, confirmed). `broker-control.test.ts` and `vice-broker-client.test.ts` both carry dedicated CR-03 regression tests (claim/release across grants, no-grant-at-all, post-explicit-release) that assert the broker callback never runs on a denial. |
| 4 | Client survives byte-at-a-time delivery, ~157KB DISPLAY_GET, zero-length JAM, event-interleaved, CHECKPOINT_LIST N+1 frames, error-typed-0x00, duplicate reply on settled id, mid-stream desync — never resolves a pending request with a 0xffffffff event even when it shares a response type with a legitimate reply | ✓ VERIFIED | Read `stock-protocol.ts` and `stock-protocol.test.ts` directly. Every named case has a dedicated, passing test: byte-at-a-time (`parseBuffer: byte-at-a-time delivery...`), 157KB DISPLAY_GET against the real captured-fixture bytes (`fixtures/binmon/display-get.bin`, 157,281 bytes, confirmed by `ls -la`), zero-length JAM (`jam frame with zero-length body parses without throwing, programCounter is null`), event-interleaved (loads `event-interleaved.bin` through the real `ViceMonitorClient`, asserts resolution order), CHECKPOINT_LIST N+1 (loads `checkpoint-list.bin`, asserts `related.length === 2` plus 2 separate prior events), error type 0x00 (`a frame with error code 0x00 is not reported as a protocol error`), duplicate reply (`syntheticDuplicateReplyStream` test plus WR-02's abandoned-request regression), mid-stream desync (`a garbage byte between two valid frames costs exactly one byte of desync`). CR-01's fix (bounds-checked `parseResponse()`, no `RangeError` escape) and CR-02's fix (handshake resumes the machine via `EXIT`) were confirmed by reading `stock-protocol.ts`/`stock-connect.ts` directly, not by trusting the review-fix narrative. |
| 5 | User can ask which backend + VICE version are active; version-gated capabilities settle at connect time, not first use; a restarted/died emulator is reported distinctly from a timeout | ✓ VERIFIED | `stock-dispatch.ts`'s `vice_ping` handler returns `{backend, viceVersion, resolvedBinaryPath, resolvedBinaryPathIsResolved, capabilities}` (read directly). `resolveCapabilities()` in `stock-connect.ts` gates the `CPUHISTORY_GET` probe behind a cache keyed on binary path, written once per binary (BACK-04) — confirmed wired end-to-end after CR-06's fix (`stockConnectDepsFor()` in `stock-dispatch.ts` now threads `epochFile`/`supervisorDir`/`binPath` from the real lease into production `connect()` calls; before the fix this was dead code, and I verified the fix is present by reading the function, not by trusting the report). `stockReconnect()` throws `MachineRestartedError` (identity not provable) or `StockConnectionClosedError`/`StockRequestTimeoutError` (transport failures) as three distinct, `instanceof`-distinguishable types — confirmed by a dedicated test (`stock-connect.test.ts:614`). |

**Score:** 5/5 roadmap success criteria verified.

### Deferred Items

Hardware-only proof gaps, explicitly permitted to defer per the standing environment constraint. Both required follow-up todos exist and were read in full.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | VERIF-02's three capturable fixtures are real hardware captures, not spec-synthesized | Tracked todo | `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md` — defines the exact re-capture command and diff checklist |
| 2 | The `--help` backend discriminator is confirmed against real stock and fork binaries | Tracked todo | `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`; `docs/phase2-backend-probe-evidence.md` §2 records the verdict as explicitly OPEN |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude/mcp/vice/stock-protocol.ts` | Framing/demux client, no throw on wire garbage | ✓ VERIFIED | Read directly; `need()` bounds guard present on every `parseResponse()` case; `#markSettled`/`#abandonPending` present (WR-02 fix in source) |
| `.claude/mcp/vice/stock-connect.ts` | Claim-then-dial handshake, api_version assert, capability gate, resume-on-exit | ✓ VERIFIED | Read directly; `resumeMachine()`/`safeResume()` present and called inside the try (CR-02 fix in source, not just claimed) |
| `.claude/mcp/vice/stock-dispatch.ts` | Dispatch table with no fall-through, vice_ping enrichment, lease-to-session seam | ✓ VERIFIED | Read directly; `dispatchStock()` refuses-by-name on a miss with no `forwardToVice` reference anywhere in the file; `ensureStockSession()`'s CR-05 teardown (`stockDisconnect(stale)`) present |
| `.claude/mcp/vice/backend-detect.mts` | Single VICE_BACKEND reader, `--help` probe, on-disk cache | ✓ VERIFIED | Read directly; header comment and `deps.env.VICE_BACKEND ?? process.env.VICE_BACKEND` confirm single-reader discipline |
| `.claude/mcp/vice/broker-control.mts` | `monitor_claim`/`monitor_release`, ownership gated on connection's own grant | ✓ VERIFIED | Read directly; `ownsTarget()` shared by claim/release/recycle (CR-03 fix in source) |
| `.claude/mcp/vice/broker-launch.mts` | Backend-selected launch argv; backend-aware readiness probe | ✓ VERIFIED | Read directly; `buildViceArgs()` backend branch; `defaultBinmonProbe()` sends PING then EXIT (WR-01 fix in source) |
| `.claude/mcp/vice/broker-kill.mts` | Reap re-derived from the broker's own allocation record; empty-identity refusal | ✓ VERIFIED | Read directly; `reapOrphanedInstances()` reads `epochFields.vice_bin`/`pid` from the per-instance record (no process-table scan), and refuses an empty identity before even asking `verifiedKill()` (CR-04 fix in source) |
| `.claude/mcp/vice/vice-proxy.ts` | Backend-aware tool registration, exactly one `dispatchStock(` call site | ✓ VERIFIED | Read directly; `buildBackendAwareTool()` wraps the manifest loop and the two synthetic tools that can reach a transport (CR-07 fix in source); `vice_result_continue` is the one asserted exception |
| `.claude/mcp/vice/fixtures/binmon/*.bin` + sidecars | VERIF-02's three cases, honest provenance | ✓ VERIFIED | `display-get.bin` is 157,281 bytes; every sidecar carries `"synthetic": true` / `"capturedFrom": "synthesized-fallback"`, matching `docs/phase2-backend-probe-evidence.md`'s override record — no fixture mislabelled as recorded |
| `.claude/mcp/vice/tools-manifest.stock.json` | Trimmed stock manifest | ✓ VERIFIED | Contains exactly `vice_ping` today, consistent with Phase 2's scope (direct tools land in Phase 3) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `stock-connect.ts:stockConnect()` | `vice-broker-client.ts:claimMonitor()` | `brokerControl.claimMonitor({targetId})` before any socket open | ✓ WIRED | Confirmed in source; claim precedes `client.connect()` |
| `vice-proxy.ts` tool registration | `stock-dispatch.ts:dispatchStock()` | `buildBackendAwareTool()` | ✓ WIRED | Confirmed in source; manifest loop and both synthetic transport-touching tools route through it |
| `stock-dispatch.ts:ensureStockSession()` | `stock-connect.ts:stockConnect()`/`stockReconnect()` | `connectFn`/`reconnectFn`, deps threaded via `stockConnectDepsFor()` | ✓ WIRED | Confirmed in source post CR-06 fix; production lease's `epochFile`/`supervisorDir` and `ACTIVE_BACKEND.binPath` reach `StockConnectDeps` |
| `broker-launch.mts:buildViceArgs()` | `vice-broker.mts` startup | `backend` parameter threaded from `resolvedBackend()`, resolved once | ✓ WIRED | Confirmed by grep; no second reader of `VICE_BACKEND` outside `backend-detect.mts` |
| `broker-control.mts` monitor ops | broker's `InstanceRecord.monitorClient` | `handleMonitorClaim`/`handleMonitorRelease` in `vice-broker.mts` | ✓ WIRED | Confirmed in source; ownership state lives on the instance record, gated by the connection's own grant id |

### Data-Flow Trace (Level 4)

Not applicable in the UI/data-rendering sense (no frontend, per ROADMAP.md's "No UI phases" note). The closest analogue — does `vice_ping`'s reported capability/version data reflect a real connect-time probe rather than a static stub — was traced instead: `resolveCapabilities()` sends a real `CPUHISTORY_GET` (0x86) over the wire on a cache miss and only returns a cached answer keyed on a matching `versionQuad`; `versionQuad` itself comes from a real `VICE_INFO` (0x85) round trip. No static/hardcoded fallback value flows into the reported payload undetected — an absent cache/binPath simply means "probe every time," never "report a fabricated value."

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Automated test gate is green | `npm run test:automated` (run directly by this verifier, not taken from SUMMARY/REVIEW-FIX claims) | 557 tests, 552 pass, 0 fail, 5 todo | ✓ PASS |
| Typecheck clean | `npm run typecheck` | exit 0 | ✓ PASS |
| Build produces no drift | `node build.ts` then `git status --short` | 8 artifacts written, no diff besides unrelated untracked files | ✓ PASS |
| npm package contents valid | `node scripts/check-npm-packages.mjs` | exit 0, 30/35 files, 6 skills | ✓ PASS |
| Fork manifest unchanged since phase start | `git diff f32d93e -- tools-manifest.json` | empty diff | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this project; `probe-binmon.mjs` is a Node script invoked directly (not through that path convention) and requires a live VICE process, which this environment does not have. Its own `--selftest` mode (offline, no real emulator) was reviewed in source (WR-11's fix: `buildSidecar()` extracted and asserted against directly) but not re-run here since it exercises no wire protocol against a real target — this is consistent with the environment constraint, not a skipped check that should have run.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| BACK-01 | 02-07, 02-10 | User selects backend by one config value | ✓ SATISFIED | `VICE_BACKEND` single-reader confirmed |
| BACK-02 | 02-01, 02-09, 02-10 | Fork backend unchanged from v0.1.x | ✓ SATISFIED | Manifest byte-identical; fork argv byte-identical test |
| BACK-03 | 02-07, 02-10 | User asks which backend/version, gets both | ✓ SATISFIED | `vice_ping` payload confirmed in source |
| BACK-04 | 02-02, 02-07, 02-08 | Capability detection at connect time, not first use | ✓ SATISFIED | `resolveCapabilities()` cache confirmed wired post CR-06 |
| PROTO-01 | 02-04 | Reassembles arbitrary TCP chunk boundaries | ✓ SATISFIED | byte-at-a-time test passing |
| PROTO-02 | 02-06 | Correlates response to request by id | ✓ SATISFIED | concurrent-PING correlation test passing |
| PROTO-03 | 02-06 | Demuxes all 5 unsolicited types, never resolves a pending request with one | ✓ SATISFIED | demux/event tests passing, incl. shared-response-type case |
| PROTO-04 | 02-04 | Zero-length JAM handled without throwing/desync | ✓ SATISFIED | dedicated JAM tests passing |
| PROTO-05 | 02-04 | Protocol error code is a distinguishable failure | ✓ SATISFIED | error-0x00 and StockProtocolError hierarchy tests passing |
| PROTO-06 | 02-06, 02-08 | Died/restarted emulator reported distinctly from timeout | ✓ SATISFIED | MachineRestartedError vs StockConnectionClosedError/StockRequestTimeoutError instanceof test |
| PROTO-07 | 02-04 | Largest response (~157KB DISPLAY_GET) handled without truncation | ✓ SATISFIED | fixture-backed test against real 157,281-byte frame |
| PROTO-08 | 02-05, 02-06, 02-08, 02-09, 02-10 | Second client prevented/reported as conflict, never a wedge diagnosis | ✓ SATISFIED | claim-before-dial + ownsTarget() tests |
| BROK-01 | 02-03 | Broker launches stock/fork with correct flags, chosen by backend | ✓ SATISFIED | `buildViceArgs()` confirmed in source (note: REQUIREMENTS.md's own tracking table still shows this `[ ]`/Pending — a documentation staleness issue, not a functional gap; see Anti-Patterns/Notes below) |
| BROK-02 | 02-05 | One monitor client per instance | ✓ SATISFIED | same as PROTO-08 evidence; REQUIREMENTS.md tracking table also stale here |
| BROK-03 | 02-01 | Existing broker guarantees survive (in-flight guard, crash supervision, incident record) | ✓ SATISFIED | inFlight guard untouched, crash-supervision tests pass; REQUIREMENTS.md tracking table stale here too |
| VERIF-02 | 02-01, 02-02, 02-04, 02-06 | Client unit-tested against recorded/stubbed frames incl. malformed/event-interleaved | ✓ SATISFIED | all 8 named cases have dedicated tests; provenance honestly marked synthetic per the D-19 override |

**No orphaned requirements** — all 16 requirement IDs listed in the phase header appear in at least one plan's `requirements:` frontmatter field, cross-referenced against `.planning/REQUIREMENTS.md`'s own descriptions.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 98-100, 212-214 | `BROK-01`/`BROK-02`/`BROK-03` checkboxes still `[ ]` and "Pending" in the coverage table, despite being implemented, tested, and covered by Phase 2 plans | ⚠️ Warning | Documentation tracking staleness only — functionally verified as satisfied above. Should be checked off as part of phase close-out. |
| `.github/workflows/ci.yml` | 47 | CI still runs bare `npm test`, not `npm run test:automated` (IN-02 from the code review; Info-severity, explicitly out of the review-fix's scope) | ⚠️ Warning | The narrowed gate this phase built to make BACK-02/BROK-03 mechanically checkable is not what CI actually enforces going forward. Locally-run `npm run test:automated` is green (verified directly), but CI's continued use of the unnarrowed glob risks the same 3-file hang this phase's own `test-gate.mjs` was built to route around. No tracked todo for this specific item. |
| `.claude/mcp/vice/vice-proxy.test.ts` | n/a | Hangs in this environment (confirmed exit 124 at 150s per prior session investigation; not re-run here per instruction) and is excluded from the automated gate | ⚠️ Warning | `vice-proxy.ts`'s own seams (CR-06/CR-07/WR-04/WR-06 changes) have no *executable* regression coverage in this environment — only structural assertions inside `stock-dispatch.test.ts`. This is a pre-existing, already-dispositioned environmental limitation (`.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`, user ruling 2026-08-12: "not a bug to fix"), inherited rather than introduced by this phase, and partially mitigated by the structural tests I confirmed exist (`stock-dispatch.test.ts`'s `structure/proxy` section). |
| `.claude/mcp/vice/broker-kill.mts` | `verifiedKill()` | Identity check remains a substring match (`args.includes(expectedIdentity)`) rather than an exact argv[0]/path match | ℹ️ Info | Pre-existing, tracked separately (`.planning/todos/pending/2026-08-12-broker-orphan-reap-substring-identity-match.md`, Phase-1-era, priority "high" in that file but describing a different function — `discoverBandProcesses()` — which this phase's rework of `reapOrphanedInstances()` *removed entirely* in favor of reading the broker's own per-instance record. The remaining substring check is against a much narrower, broker-recorded candidate set than the todo originally described, and CR-04 already closed the empty-string case that made it exploitable. Worth revisiting the todo's wording but not a Phase-2 regression. |

No unreferenced `TBD`/`FIXME`/`XXX` markers found in any file this phase modified (checked via the file lists in `02-REVIEW.md`'s `files_reviewed_list` and the plan SUMMARY key-files).

### Human Verification Required

None required to close *this* phase. The items that would ordinarily route here (backend probe against real hardware, fork-path end-to-end behavioral parity, live fixture capture) are explicitly covered by the environment constraint's deferral mechanism above, with tracked follow-up todos already in place — not open-ended "needs a human to check" items blocking this verification.

### Gaps Summary

No blocking gaps. All 5 roadmap success criteria are backed by evidence read directly from the source files (not taken from SUMMARY.md or REVIEW-FIX.md claims), and the automated test gate was re-run by this verifier and confirmed green (557/552/0/5). The phase's own code review (7 critical + 13 warning findings) was cross-checked against the current `main` state: every one of the 20 in-scope findings' fixes was independently located and read in the actual source file it claims to modify — `CR-01` through `CR-07` and `WR-01` through `WR-13` all have real, non-cosmetic code present at the cited locations, not just a commit message claiming so.

Three Warning-level notes are carried forward for phase close-out attention (not blockers): `REQUIREMENTS.md`'s stale BROK-01/02/03 checkboxes, CI's continued use of the un-narrowed `npm test` glob, and `vice-proxy.test.ts`'s pre-existing inability to run in this environment (mitigated by structural tests, tracked as a standing, already-dispositioned limitation). Two Deferred items (hardware-only proof) both have the required tracked follow-up todos in place, matching the environment constraint's expectations exactly.

---

_Verified: 2026-08-13T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
