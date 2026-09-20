---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
reviewed: 2026-09-20T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-relay.test.ts
  - src/mcp/vice/broker-state.mts
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/stock-live-relay.test.ts
  - src/mcp/vice/text-tools.test.ts
  - src/mcp/vice/text-tools.ts
  - src/mcp/vice/vice-broker.mts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 63: Code Review Report (gap-closure plans 63-07..63-10)

**Reviewed:** 2026-09-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This is an incremental review of the four gap-closure plans (63-07, 63-08, 63-09, 63-10) against
diff base `0f35fdb7`. All four intents are met and I could not disprove any of them:

- **63-07**: `tearDownRelaySessionsForGrant()` deletes the `state.relaySessions` map entry before
  calling `close()`, in both `handleRelease()` branches and in `handleRecycleForRealBroker()`,
  strictly before the kill. It enumerates `MONITOR_CHANNELS` rather than a hardcoded pair. The
  stale "the ONE place an entry is ever removed" header in `broker-state.mts` was corrected to
  name both removal sites, and I found no remaining stale copy of that invariant anywhere in the
  tree. The `.mts`→`.mjs` compiled pair (`vice-broker.mts`/`resources/vice-broker.mjs`) is
  byte-identical per a fresh `resources-sync.test.ts` run.
- **63-08**: `text-tools.ts`'s `withTextTool()` now declares the operation only inside the
  callback handed to `withTextChannelLock()`, after the lock is granted, and clears it in a
  `finally` before the callback returns — matching `stock-dispatch.ts`'s `acquire → declare → run
  → clear → release` ordering on the binary side. A lock-acquisition timeout short-circuits before
  the callback ever runs, so nothing is declared or cleared on that path.
- **63-09**: `broker-relay.test.ts`'s new JAM cases drive a genuine zero-length-body JAM frame
  through the real `spliceRelay()`/`ViceMonitorClient` path (same-segment, header-split
  reassembly, and both single-write and split-write interleaves with a legitimate `Ping` reply),
  asserting `programCounter === null` and that the reply resolves the client's own request id, not
  the broadcast id.
- **63-10**: the two new `stock-live-relay.test.ts` cases are additions to an already
  `MANUAL_ONLY_TESTS`-registered file, correctly gated behind the same `VICE_LIVE_RELAY_BIN`/
  `SKIP_REASON` mechanism, and print a single `GAP-PROBE OBSERVED` line before any assertion runs.

`npx tsc --noEmit` is clean and the full non-live suite for these files (`broker-relay.test.ts`,
`broker-control.test.ts`, `text-tools.test.ts`, `broker-state.test.ts`) passes (238 pass / 1
opt-in skip / 0 fail).

One test-hygiene issue (WARNING) and two informational notes are below; nothing here rises to a
correctness or security defect that should block this gap closure.

## Warnings

### WR-01: A new contention test can leak the process-wide channel lock across the rest of the file on failure

**File:** `src/mcp/vice/text-tools.test.ts:400-426`
**Issue:** `"withTextTool declares the operation only AFTER the shared cross-channel mutex is
granted"` acquires `channel-lock.ts`'s single, module-level mutex (`acquireChannelLock({ channel:
"binary", ... })`, line 412) and only releases it via `handle.release()` on line 420 — a plain
statement, not inside a `try`/`finally`. Two `assert.*` calls (line 419, and later 422-423) run
*before* that release. If the assertion this test exists to catch (a regression that declares the
operation before the lock is granted) ever fires, `assert.deepEqual` throws, the test function
exits without ever calling `handle.release()`, and the process-wide lock (`currentHolder` in
`channel-lock.ts`) is left held for the remaining lifetime of the test process. Because
`node --test` runs every test in a file in one process/worker, every later test in
`text-tools.test.ts` that touches the channel lock (most of the file's binary/text-tool tests do,
transitively) would then queue behind a lock nobody will ever release, each one failing only after
its own `ChannelLockTimeoutError` wait elapses — turning one genuine regression into a long,
misleading cascade of unrelated timeouts rather than a single, clearly-attributed failure. The
sibling test two cases below (`"withTextTool that times out acquiring the lock..."`, lines
428-450) already gets this right with a `try { ... } finally { handle.release(); }` wrapper; this
test should use the same shape.
**Fix:**
```ts
test("withTextTool declares the operation only AFTER the shared cross-channel mutex is granted", async () => {
  const recorder: Array<string | null> = [];
  await withStubTextServer(
    (_line, socket) => {
      socket.write(`OK${PROMPT}`);
    },
    async (port) => {
      const deps = makeDeps(port, {}, recorder);
      const handle = await acquireChannelLock({ channel: "binary", operation: "vice_memory_read" });
      try {
        const pending = handleDeviceConsole({}, deps);
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setImmediate(resolve));
        }
        assert.deepEqual(recorder, [], "queued behind the binary channel's lock: must declare nothing yet");
        handle.release();
        const result = await pending;
        assert.equal(result.isError, false, `expected success once the lock was released, got ${JSON.stringify(result)}`);
        assert.deepEqual(recorder, ["vice_device_console", null], "declares only once the lock is granted, then clears");
      } finally {
        handle.release(); // no-op if already released above; guarantees release on any assertion throw
      }
    },
  );
});
```
(Confirm `ChannelLockHandle.release()` tolerates a repeated call — every other release-discipline
comment in this tree describes release as idempotent, so this should be safe; if it is not, guard
with a local `released` boolean instead.)

## Info

### IN-01: The binary-side ordering claim is proven only by a source-text scan, though a behavioural harness for it exists in a sibling file

**File:** `src/mcp/vice/text-tools.test.ts:452-471`
**Issue:** `"both channel wrappers declare only after acquiring the shared lock"` proves the
text-channel half behaviourally (the two tests immediately above it), but proves the
binary-channel half (`stock-dispatch.ts`'s `withChannelLockHeld()`/`declareOperation()`) only by
grepping `stock-dispatch.ts`'s own source text and checking that the string
`declareOperation(session, toolName)` appears on a later line number than the string
`acquireChannelLock({ channel: "binary"`. The test's own comment says a behavioural drive of
`dispatchStock()` "would need a full binary-monitor stub session harness this file does not
have." That is true of *this* file, but `stock-dispatch.test.ts` already has exactly such a
harness (`buildConformanceSession()` + the `CONFORMANCE_BROKER_CONTROL` stub, both driving the
real `dispatchStock()` → `withStockSession()` → `withChannelLockHeld()` path with a stubbed
`noteOperation()`) — the same shape used here for the text side could, with a small addition, hold
the shared lock from the text channel first and observe `noteOperation()` call order on the binary
side under genuine contention, exactly like WR-01's companion tests do for text. This is not a
functional defect (the source-scan is truthful and would catch an accidental reordering of those
two lines), but it is weaker than what the codebase already has available, and it lives in a
different file from the harness that could strengthen it — worth folding into
`stock-dispatch.test.ts` in a follow-up rather than leaving the binary side's ordering proof at the
text-match level indefinitely.
**Fix:** Add a behavioural case to `stock-dispatch.test.ts` using `buildConformanceSession()`/
`CONFORMANCE_BROKER_CONTROL` (with an instrumented `noteOperation` recorder) that holds the
text-channel lock first, drives a binary-side tool through `dispatchStock()`, and asserts the
`noteOperation` recorder stays empty until the lock is granted — mirroring
`text-tools.test.ts:400-426`. Once that exists, the source-text scan in `text-tools.test.ts` can
be dropped or kept as a cheap secondary guard.

### IN-02: `broker-state.mts`'s comment-only change produces no `resources/broker-state.mjs` drift — verified, not a defect

**File:** `src/mcp/vice/broker-state.mts:357-372`, `src/mcp/vice/resources/broker-state.mjs`
**Issue:** Flagged for verification by the review brief: `broker-state.mts` changed in this scope
(the `relaySessions` field's header comment, correcting the now-false "ONE place an entry is ever
removed" invariant) but `resources/broker-state.mjs` does not appear in the diff, even though plan
63-07's own artifact list said it would be "regenerated by build.ts and committed." I ran
`resources-sync.test.ts` directly (`node --test resources-sync.test.ts`) and it passes: `resources/
is byte-identical to a fresh build of its TypeScript source`. `build.ts` (via `tsc`) strips
comments from the emitted `.mjs`, so a comment-only edit to a `.mts` source produces zero emitted
delta — there is no latent drift, and nothing needs to be regenerated. Recorded here as a verified
non-finding per the review brief's explicit request, not as an issue.
**Fix:** None needed.

---

_Reviewed: 2026-09-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Disposition (recorded by the execute-phase orchestrator, 2026-09-20)

| ID | Severity | Disposition |
|----|----------|-------------|
| WR-01 | Warning | **Fixed** in `1d96eed2` — release moved into a `finally` (idempotent, because the mid-test release is deliberate), and the in-flight call settled there too. Verified by injecting a failure at the very assertion the case exists to trip: 1 failed / 64 passed / no cascade, versus the leak's cascade of unrelated `ChannelLockTimeoutError`s. |
| IN-01 | Info | **Accepted as-is.** The source-symmetry form of the binary-side assertion is the fallback `63-08-PLAN.md` explicitly authorises, and the plan requires the SUMMARY to state which form was used — it does. Converting it to a behavioural drive through `buildConformanceSession()` is a genuine improvement but is new scope, not a gap-closure defect. |
| IN-02 | Info | **Not an issue — verified.** `broker-state.mts`'s change is comment-only (correcting the now-false "ONE place an entry is ever removed" invariant), so `build.ts`/`tsc` comment-stripping emits no delta for `resources/broker-state.mjs`. `resources-sync.test.ts` passes, which is this project's own authority on `.mts` -> `.mjs` drift. Plan 63-07's artifact list over-predicted a regenerated file; the artifact is correct as committed. |
