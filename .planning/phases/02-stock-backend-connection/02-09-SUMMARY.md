---
phase: 02-stock-backend-connection
plan: 09
subsystem: protocol
tags: [manifest, dispatch, binary-monitor, vice, backend-selection, broker, lease, tdd]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: "02-05's claimMonitor()/releaseMonitor()/MonitorOwnershipError on BrokerControlSession; 02-08's stockConnect()/stockDisconnect()/stockReconnect() connect handshake, whose StockConnectOptions shape this plan threads a lease into verbatim"
provides:
  - "tools-manifest.stock.json: the trimmed, separately committed per-backend manifest (D-07), carrying only vice_ping today"
  - "stock-dispatch.ts's manifestPathForBackend(): the pure, tested selector between the fork and stock manifests, honoring VICE_TOOLS_MANIFEST's existing override precedence unchanged"
  - "refresh-manifest.ts's writeManifestAtomic() guard (T-02-31): the fork's manifest regeneration step can never overwrite the hand-authored stock surface"
  - "HeldLease (vice-broker-client.ts): the backend-agnostic host/port/targetId/brokerControl coordinate set a session that already holds a broker grant hands to a dialing handler"
  - "stock-dispatch.ts's ensureStockSession(): the ONE seam that turns an injected LeaseProvider's lease into a live stockConnect() session, with no second acquisition path"
affects: ["02-10"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A second, permanently trimmed manifest file (tools-manifest.stock.json) is the shipped mechanism for D-07's per-backend tool-list difference, selected by a pure function (manifestPathForBackend()) rather than a runtime filter over one shared list"
    - "A generator that regenerates one file from a live external source (refresh-manifest.ts) gets an explicit assertion naming the ONE path it must never target, rather than relying on 'nobody would ever point VICE_TOOLS_MANIFEST there by accident'"
    - "A lease-to-session seam (ensureStockSession()) takes its coordinates from an injected provider function whose shape is structurally identical to the real acquisition function's own return type, so the real function is assignable with zero adapter code -- the same 'inject the existing seam, do not re-derive it' pattern 02-08's StockConnectBrokerControl already established for the claim/release surface"
    - "A held session is keyed on the lease's own identity (targetId), re-validated by re-consulting the (cheap, already-memoized) provider on every call, rather than cached and trusted -- the provider is the only thing that ever notices a replacement acquisition"

key-files:
  created:
    - .claude/mcp/vice/tools-manifest.stock.json
    - .claude/mcp/vice/stock-dispatch.ts
    - .claude/mcp/vice/stock-dispatch.test.ts
  modified:
    - .claude/mcp/vice/vice-broker-client.ts
    - .claude/mcp/vice/refresh-manifest.ts
    - .claude/mcp/vice/refresh-manifest.test.ts
    - .claude/mcp/vice/package.json

key-decisions:
  - "manifestPathForBackend()'s envOverride parameter is a plain injected string, never a process.env read inside the function itself -- keeps the selector a pure, directly testable seam, matching the plan's own instruction"
  - "The stock manifest's endpoint field names the transport ('stock-binary-monitor') rather than an HTTP URL, since there is no host MCP endpoint on this path -- there was no existing convention to preserve here, so this plan established one"
  - "ensureStockSession() re-calls the injected LeaseProvider on every invocation rather than caching the lease locally, because ensureBrokerLease()'s own first line already short-circuits when a control session is held (so the re-consultation is free) and it is the only thing that can ever notice a replacement acquisition happened underneath"
  - "A held session whose socket has closed is re-established via stockReconnect() (which itself re-proves machine identity via the epoch baseline) rather than silently re-dialed -- any error out of that reconnect (MachineRestartedError or otherwise) clears the holder before propagating, so a future call always re-handshakes from scratch rather than retrying a session known to be bad"

requirements-completed: [BACK-02, PROTO-08]

# Metrics
duration: ~20min
completed: 2026-08-13
---

# Phase 2 Plan 9: Stock Manifest and Lease-to-Session Seam Summary

**A separately committed, trimmed `tools-manifest.stock.json` with a pure/tested selector (`manifestPathForBackend()`) that the fork's live-host manifest regenerator can never overwrite, plus `ensureStockSession()` — the one seam that turns an injected broker lease into a live `stockConnect()` session with no second acquisition path.**

## Performance

- **Duration:** ~20 min (first commit 12:45:30 CEST, last task commit 12:57:01 CEST, plus prior research/read time)
- **Completed:** 2026-08-13
- **Tasks:** 2 completed / 2 planned
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `tools-manifest.stock.json` is the trimmed, separately committed stock tool surface (D-07): same three top-level keys as the fork's `tools-manifest.json`, `tools` array carrying only `vice_ping` (copied verbatim, name and `inputSchema` byte-identical to the fork entry), no `DENY_LIST` name present — every one of these asserted by a test driven directly off the two committed files, not just the plan's own acceptance `node -e` one-liner (which also passes).
- `manifestPathForBackend(backend, hereDir, envOverride)` (`stock-dispatch.ts`) is the pure selector between the two manifests, following `vice-proxy.ts`'s existing `manifestPath()` override precedence exactly: an explicit `envOverride` wins for either backend unchanged; otherwise fork resolves to `tools-manifest.json` and stock to `tools-manifest.stock.json` beside `hereDir`.
- `refresh-manifest.ts`'s `writeManifestAtomic()` now refuses (throws) if ever asked to write to a path literally named `tools-manifest.stock.json` (T-02-31) — proven live by a new test that points `VICE_TOOLS_MANIFEST` directly at that filename and asserts `main()` rejects with the refusal message and that no file is written there.
- `HeldLease` (`vice-broker-client.ts`) is the backend-agnostic `{ host, port, targetId, brokerControl }` coordinate set, declared beside `BrokerControlSession`/`openBrokerControl()`, with field names matching `stockConnect()`'s own parameters exactly — no adapter needed to thread one into the other.
- `ensureStockSession(deps)` (`stock-dispatch.ts`) is the ONE place a stock handler turns a lease into a live session: awaits the injected `LeaseProvider` strictly before ever calling `stockConnect()` (proven by a spy call-index test); passes the provider's `host`/`port`/`targetId`/`brokerControl` straight through, unmodified (proven field-by-field via `assert.strictEqual`); refuses without dialing on a provider failure (message passed through verbatim) or a `lease: null` (VICE_MCP_URL override, refusal names `VICE_MCP_URL` explicitly); reuses a held session across repeated calls with the same `targetId` (`stockConnect()` called exactly once across two calls); discards and reconnects on a replacement acquisition (a different `targetId` calls `stockConnect()` again); and re-establishes a session whose socket has closed via `stockReconnect()`, clearing the holder on any error (including `MachineRestartedError`) so the next call re-handshakes from scratch.
- Grep-gated: zero occurrences of `openBrokerControl`/`adoptGrant`/`.acquire(`/`readBrokerLiveness`/`broker.json` in `stock-dispatch.ts`'s source-code lines (comments excluded) — no second acquisition path exists (T-02-33).
- `npm run typecheck` is clean. `npm run test:automated` is green except the one pre-existing, out-of-scope worktree-path artifact every prior plan in this phase (02-01, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08) has already documented (449/455 passing, 5 `todo`, 1 known pre-existing failure). `node scripts/check-npm-packages.mjs` exits 0. `git diff .claude/mcp/vice/tools-manifest.json` is empty — the fork manifest is byte-unchanged, and `vice-proxy.ts` was not touched at all by this plan.

## Task Commits

Both tasks were TDD (`tdd="true"`), each landing as a genuine RED commit (confirmed failing before any implementation existed) followed by a GREEN commit:

1. **Task 1 RED: failing coverage for the manifest selector** - `53f8a8e` (test)
2. **Task 1 GREEN: trimmed stock manifest and the tested selector** - `d73f457` (feat)
3. **Task 2 RED: failing coverage for the lease-to-session seam** - `9fddeb8` (test)
4. **Task 2 GREEN: lease-to-session seam, HeldLease, ensureStockSession** - `08b1e01` (feat)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode).

_Task 1 RED confirmed `ERR_MODULE_NOT_FOUND` (stock-dispatch.ts did not exist). Task 2 RED confirmed a `SyntaxError` (`ensureStockSession`/`clearHeldStockSession` not exported yet), since Task 1's GREEN commit had already created the file for the manifest selector alone._

## Files Created/Modified

- `.claude/mcp/vice/tools-manifest.stock.json` - the trimmed stock manifest: `generated_at`/`endpoint` (`"stock-binary-monitor"`)/`tools` (one entry, `vice_ping`, byte-identical name/inputSchema to the fork manifest's own entry)
- `.claude/mcp/vice/stock-dispatch.ts` - structured header comment naming D-07/D-09 and the three prohibitions (never fall through to `forwardToVice()`, never add a second dispatch site in `vice-proxy.ts`, never acquire a broker lease here); `manifestPathForBackend()`; `LeaseProvider`/`StockDispatchDeps`/`EnsureStockSessionOutcome` types; the module-level `heldSession` holder and `clearHeldStockSession()`; `ensureStockSession()`; a re-export of `stockDisconnect`
- `.claude/mcp/vice/stock-dispatch.test.ts` - 16 `node --test` cases: 8 for the manifest selector and cross-manifest shape/schema/DENY_LIST checks, 8 for `ensureStockSession()`'s wiring (lease-before-connect ordering, field pass-through, both refusal paths, session reuse, replacement-lease reconnection, closed-socket reconnection, MachineRestartedError clearing the holder)
- `.claude/mcp/vice/vice-broker-client.ts` - `HeldLease` interface (type-only addition, no runtime behavior change), declared beside `BrokerControlSession`/`openBrokerControl()`
- `.claude/mcp/vice/refresh-manifest.ts` - `STOCK_MANIFEST_BASENAME` constant; `writeManifestAtomic()` throws if ever asked to write to that basename, with a comment naming T-02-31/D-07/D-09
- `.claude/mcp/vice/refresh-manifest.test.ts` - one new test pointing `VICE_TOOLS_MANIFEST` at `tools-manifest.stock.json` and asserting `main()` rejects rather than writes
- `.claude/mcp/vice/package.json` - `"tools-manifest.stock.json"` and `"stock-dispatch.ts"` added to the published `files` array

## Decisions Made

See `key-decisions` in the frontmatter above for the full list with rationale. Summary:

- `manifestPathForBackend()`'s `envOverride` is an injected parameter, never a `process.env` read inside the function — keeps the selector pure and directly testable, per the plan's own instruction.
- The stock manifest's `endpoint` names the binary-monitor transport rather than an HTTP URL (no existing convention to preserve here; this plan established one).
- `ensureStockSession()` re-consults the injected `LeaseProvider` on every call rather than caching the lease, because the real provider (`ensureBrokerLease()`, landing in plan 02-10) is already cheap to re-call and is the only thing that notices a replacement acquisition.
- A held session whose socket has closed goes through `stockReconnect()` (re-proving machine identity), not a silent re-dial; any error there clears the holder before propagating.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rewrote a test-only nullable-capture pattern that typechecked as `never`**
- **Found during:** Task 2 verification (`npm run typecheck`)
- **Issue:** A test asserting the exact fields `stockConnect()` receives originally captured the connect stub's argument into a `let received: X | null = null` variable reassigned inside the stub's async closure, then narrowed via `if (received === null) throw ...`. TypeScript's control-flow analysis for a `let` variable reassigned only inside a nested async closure — combined with the object type's own shape here — resolved the post-guard type to `never` rather than the expected object type, so every field access afterward failed to typecheck (`TS2339`).
- **Fix:** Replaced the nullable-capture pattern with an array (`const receivedCalls: StockConnectOptions[] = []`), asserting `receivedCalls.length === 1` and reading `receivedCalls[0]!` — avoids the narrowing quirk entirely and additionally makes the "connect called exactly once" assertion explicit rather than implicit.
- **Files modified:** `.claude/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `npm run typecheck` exits 0; the same test still passes with identical assertions.
- **Committed in:** `08b1e01` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, test-only type-narrowing fix — no runtime behavior change, necessary for `npm run typecheck` to pass).
**Impact on plan:** No scope creep. The fix only touched how one test captures a spy call's argument; the assertions themselves are unchanged.

## Manual Reasoning Check (plan's own verification requirement)

Traced both `key_links` the plan's own frontmatter names:

- **`stock-dispatch.ts` → `stock-connect.ts` (ensureStockSession threads the held lease into stockConnect's host/port/targetId/brokerControl):** `ensureStockSession()` calls `connectFn({ host: lease.host, port: lease.port, targetId: lease.targetId, brokerControl: lease.brokerControl })` where `connectFn` defaults to the real `stockConnect` import — confirmed live by the field-equality test (`assert.strictEqual` on all four fields against the lease the injected provider returned, not re-derived or defaulted anywhere in between).
- **`stock-dispatch.ts` → `vice-broker-client.ts` (imports the HeldLease type; never opens a control session of its own):** `stock-dispatch.ts` imports `type { HeldLease }` (type-only) and never imports or calls `openBrokerControl`, `.acquire(`, `readBrokerLiveness`, or reads `broker.json` — confirmed by both a source-level grep (0 occurrences outside comments) and by every test in the file using only an injected two-method broker-control stub, never a real listener.

No path in `stock-dispatch.ts` reaches `stockConnect()`/`stockReconnect()` without the injected `LeaseProvider` having been awaited and having returned a non-null lease first (confirmed both by source-order grep — `ensureLease(` at line 42, `stockConnect(` afterward — and by the call-index spy test).

## Environment Constraint Compliance

Per this plan's environment constraint, no real stock VICE binary is reachable in this environment and nothing in either task launched, dialed, or probed a real emulator. `refresh-manifest.ts` was NOT run against any live host server in the course of this plan's work (its own tests already stub the host, per the pre-existing `refresh-manifest.test.ts` convention this plan extended, not replaced). All 16 `stock-dispatch.test.ts` tests are pure/offline: the manifest tests read committed JSON files directly, and the `ensureStockSession()` tests use injected spy stubs for both the lease provider and the connect/reconnect functions — never a real broker process, never a real socket.

**Deferred to a later phase (live validation):** actually driving `ensureStockSession()` against a real broker-acquired lease and a real stock `x64sc -binarymonitor` process end-to-end (the full acquire → claim → dial chain this plan's unit tests only prove piecewise via injected stubs) requires a real stock VICE binary this environment does not have, and additionally requires plan 02-10's own `ensureBrokerLease()`-as-`LeaseProvider` wiring, which is out of this plan's scope. Tracked against the existing `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md` todo (already covering live validation of this phase's binmon-protocol assumptions); no duplicate todo filed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ensureStockSession()` is ready for plan 02-10 to inject `ensureBrokerLease` itself (widened to the `LeaseProvider` shape) at the one call site in `vice-proxy.ts` that already changes for the backend switch — no adapter function is needed, per this plan's own design.
- `manifestPathForBackend()` is ready for plan 02-10 to wire into `vice-proxy.ts`'s `tools/list` handler alongside `resolvedBackend()`'s answer.
- `tools-manifest.stock.json` currently carries only `vice_ping`; every subsequent phase (3 through 7, per this plan's own Scope Note) adds its own entries to this same file and this same selector, never a parallel mechanism.
- Live validation against a real stock VICE binary (the deferred item above) is expected once a real build is reachable, per this plan's own environment constraint and the existing pending todo.
- No blockers to phase progress.

## Issues Encountered

- Same pre-existing worktree-path test artifact every prior plan in this phase (02-01 through 02-08) already documented: `repo-root.test.ts`'s "the agreed path is not under .claude" assertion fails only because this worktree is checked out under `.claude/worktrees/agent-.../`, unrelated to and untouched by this plan's files. Not touched, not auto-fixed, out of scope per the executor's scope boundary. `npm run test:automated` is 449/455 passing (5 `todo`, 1 pre-existing artifact) in this worktree as a result.
- This worktree's `node_modules` was not yet provisioned at the start of this session; ran `npm ci` in `.claude/mcp/vice` before any test could run (documented here per the parallel-execution instructions, not a deviation from the plan's own content).
- The plan's own literal acceptance-criteria invocation order (`node --test <file> --test-name-pattern=...`, flag AFTER the file argument) does not filter subtests in this Node v22.22.0 install — every test in the file still runs and reports regardless of the pattern. Placing the flag BEFORE the file argument (`node --test --test-name-pattern=... <file>`) filters correctly and was used to verify each named-pattern acceptance criterion (all satisfied: `manifest|backend` → 8/8 passing, `lease` → 8/8 passing, `lease.*before.*connect` → 1/1 passing). Since every test in the file passes regardless of ordering, the plan's own literal command also reports the required "0 failing, ≥N passing" either way — this is a Node CLI quirk, not a defect in this plan's tests.

---
*Phase: 02-stock-backend-connection*
*Completed: 2026-08-13*
