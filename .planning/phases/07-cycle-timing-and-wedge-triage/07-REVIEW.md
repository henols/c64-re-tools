---
phase: 07-cycle-timing-and-wedge-triage
reviewed: 2026-08-18T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - .claude/mcp/vice/hostpath-consumers.test.ts
  - .claude/mcp/vice/package.json
  - .claude/mcp/vice/stock-connect.test.ts
  - .claude/mcp/vice/stock-connect.ts
  - .claude/mcp/vice/stock-derived.test.ts
  - .claude/mcp/vice/stock-derived.ts
  - .claude/mcp/vice/stock-diagnose.test.ts
  - .claude/mcp/vice/stock-diagnose.ts
  - .claude/mcp/vice/stock-dispatch.test.ts
  - .claude/mcp/vice/stock-dispatch.ts
  - .claude/mcp/vice/stock-protocol.test.ts
  - .claude/mcp/vice/stock-protocol.ts
  - .claude/mcp/vice/stock-recycle.test.ts
  - .claude/mcp/vice/stock-recycle.ts
  - .claude/mcp/vice/stock-run-until.test.ts
  - .claude/mcp/vice/stock-run-until.ts
  - .claude/mcp/vice/stock-timing.test.ts
  - .claude/mcp/vice/stock-timing.ts
  - .claude/mcp/vice/tools-manifest.stock.json
  - .claude/skills/vice-wedge-triage/SKILL.md
  - docs/phase0-binmon-findings.md
  - docs/stock-vice-parity.md
  - scripts/check-skill-tool-coverage.mjs
findings:
  critical: 2
  warning: 13
  info: 0
  total: 15
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-18
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 7 adds four stock-backend tools (`vice_cycles_stopwatch`, `vice_run_until`,
`vice_diagnose`, `vice_recycle`), a `RESOURCE_GET` encoder/parser pair, a
`CPUHISTORY_GET` parser, and the manifest/skill/doc updates around them. Typecheck is
clean and all 354 tests across the touched files pass.

Verification performed for this review went past reading: three live probes were run
against the genuine `/usr/local/bin/x64sc` (`VICE 3.10`) binary monitor using this tree's
own `ViceMonitorClient`, plus a unit-level probe of `parseResponse()`. Two of the findings
below are **live-reproduced**, not inferred.

The two blockers are both in the read path this phase added:

1. The capability probe now feeds a real `CPUHISTORY_GET` reply through the parser whose
   entry layout the phase's own `deferred-items.md` records as wrong — which makes the
   **entire stock handshake fail on any genuine VICE ≥ 3.10**, not just Route A of the
   stopwatch. `docs/stock-vice-parity.md` was updated in this phase to claim the opposite,
   "live-confirmed".
2. The new `RESOURCE_GET` integer branch reads a 4-byte value behind a guard that only
   proves 2 bytes exist, so `parseResponse()` — documented in this same file as "provably
   total for any Buffer" — throws a bare `RangeError`. Reproduced.

The known `CPUHISTORY_GET` per-entry layout defect (52-byte body vs. 65 required) is
**not** re-reported as new; finding CR-01 is a different, unrecorded consequence of the
same root cause with a fix that is independent of it.

Two things the domain brief asked about were checked and are **clean**: the request-id-first
demux still never resolves a pending command from an event (verified live — `REGISTER_INFO`
and `STOPPED`/`RESUMED` all arrive on the `event` channel), and no new `const`
arrow-function export was added inside the `stock-dispatch` ↔ `stock-diagnose` ↔
`stock-recycle` runtime cycle (`handleCyclesStopwatch`/`handleRunUntil` are `const`, but
`stock-timing.ts`/`stock-run-until.ts` are leaves of that graph, so they are safe today —
see WR-09 for the missing guard that keeps them safe tomorrow).

## Critical Issues

### CR-01: The `CPUHISTORY_GET` capability probe makes the stock handshake fail outright on every genuine VICE ≥ 3.10 (live-reproduced)

**File:** `.claude/mcp/vice/stock-connect.ts:117-133` (probe), `:163` (call site), `.claude/mcp/vice/stock-protocol.ts:1414-1447` (parser), `docs/stock-vice-parity.md:342-352` (false claim)

**Issue:**
`probeCpuHistory()` was changed in this phase from `count=0` to `count=1`. On a pre-3.10
build the reply is an error code and the three-way mapping works. On a build that
*supports* the opcode, VICE now sends a real history reply — which is decoded by the
`ResponseType.CpuHistoryGet` case whose per-entry layout is wrong (the phase's own
`deferred-items.md`, 07-10). The resulting `StockFramingError` is **not** a
`StockProtocolError`, so it falls through to `throw err` at `stock-connect.ts:131`,
propagates through `resolveCapabilities()` (no try/catch at `stock-connect.ts:163`) and out
of `stockConnect()` step 5 (`stock-connect.ts:341`), which treats it as a fatal handshake
failure, releases the monitor claim and rejects.

Net effect: on any genuine VICE ≥ 3.10, `ensureStockSession()` never returns a session, so
**every** stock tool — including `vice_ping`, `vice_diagnose` and `vice_recycle` — answers
refusal text. The blast radius is the whole backend, not the one stopwatch route the
deferred item scopes it to.

Live reproduction (this review, `/usr/local/bin/x64sc` = `VICE 3.10`, launched with
`-default -binarymonitor`), replicating `probeCpuHistory()`'s exact request bytes through
this tree's own client:

```
PING ok: unknown
PROTOERR: StockFramingError response type 0x86 body is 52 byte(s), needs at least 65
CPUHISTORY REJECTED: StockFramingError | response type 0x86 body is 52 byte(s), needs at least 65
```

Because `probeCpuHistory()` only maps `StockProtocolError` codes, that rejection is
rethrown verbatim.

This directly contradicts the paragraph this phase added to
`docs/stock-vice-parity.md:349-352`: *"so the capability now actually resolves to
`"available"` where the build supports it, live-confirmed against the fork's own genuine
VICE 3.10.0.0 build."* It does not resolve to `"available"`; the connect fails before a
capability value is ever produced. A claim like that must not ship unverified — it is the
exact "trusted as fact" failure mode `stock-timing.ts`'s own header warns about.

**Fix:** make a *decode* bug incapable of failing the handshake, independent of fixing the
layout. Treat a framing failure as a capability answer, not a fatal error:

```ts
async function probeCpuHistory(client: ViceMonitorClient): Promise<CpuHistoryCapability> {
  const count = clampCpuHistoryCount(1);
  const body = Buffer.alloc(5);
  body[0] = 0x00; // memspace: main
  body.writeUInt32LE(count, 1);
  try {
    await client.send(CommandType.CpuHistoryGet, body);
    return "available";
  } catch (err) {
    if (err instanceof StockProtocolError) {
      if (err.errorCode === ErrorCode.InvalidType) return "absent";
      if (err.errorCode === ErrorCode.CmdFailure) return "not_compiled_in";
      if (err.errorCode === ErrorCode.InvalidParameter) return "absent";
    }
    // The opcode EXISTS (the monitor answered with a frame) but this client
    // cannot decode its reply -- see deferred-items.md's 07-10 layout
    // mismatch. Route A is unusable, but a decode bug must never fail the
    // whole handshake and take every other stock tool down with it.
    if (err instanceof StockFramingError) return "absent";
    throw err;
  }
}
```

Also revert the `docs/stock-vice-parity.md:349-352` claim to what is actually established
(count=0 was malformed; count=1 is well-formed; Route A remains blocked by the layout
mismatch), and drop "live-confirmed" until it is.

### CR-02: `RESOURCE_GET` integer branch reads 4 bytes behind a 2-byte guard — `RangeError` escapes `parseResponse()` (reproduced)

**File:** `.claude/mcp/vice/stock-protocol.ts:1455-1461`

**Issue:**
The guard proves only `2 + size` bytes, then the integer branch reads a fixed 4-byte value
regardless of `size`:

```ts
need(body, 2 + size, responseType, requestId);
if (valueTypeByte === 1) {
  return { ..., value: body.readUInt32LE(2) };   // needs 6 bytes, guard proved 2 + size
}
```

A body of `[0x01, 0x00]` (`valueType=int`, `size=0`) passes both `need()` calls and then
throws. Both `size` and `valueTypeByte` are wire-controlled, so this is reachable from
ordinary desync — the same reachability argument the CR-01 fix comment at
`stock-protocol.ts:1182-1200` already makes for the guards it added, and a direct violation
of that comment's normative rule: *"never add a `case` here that reads at a fixed or
wire-derived offset without a preceding `need()` for the bytes it touches."* It also
falsifies the function's own doc claim, *"Provably total for any Buffer"*
(`stock-protocol.ts:1218`).

Reproduced this review:

```
parseResponse({responseType:0x51, body:[1,0]})       -> THREW: RangeError | Attempt to access memory outside buffer bounds
parseResponse({responseType:0x51, body:[1,2,aa,bb]}) -> THREW: RangeError | The value of "offset" is out of range...
parseBuffer(frame with that body) -> [framing] BUG: parseResponse() threw an undocumented error for response type 0x51 ...
```

`parseBuffer()`'s CR-01 backstop keeps the process alive, so the consequences are:
the pending request is rejected with a *mislabelled* `StockFramingError` ("threw an
undocumented RangeError"), and a routine short/garbage frame is logged as an internal
`BUG:` — burying a real defect signal under a wire-format event. The existing tests cover
"size byte missing" (`stock-protocol.test.ts:1746`) but never `valueType=1` with `size < 4`,
which is why it shipped.

**Fix:**

```ts
need(body, 2, responseType, requestId);
const valueTypeByte = body[0]!;
const size = body[1]!;
if (valueTypeByte === 1) {
  // e_MON_RESOURCE_TYPE_INT: a 4-byte payload is part of the contract, so a
  // shorter declared size IS a framing error, not a value to read past.
  need(body, 2 + 4, responseType, requestId);
  if (size !== 4) {
    throw new StockFramingError(
      `RESOURCE_GET integer reply declared size ${size}, expected 4`,
      { observed: size, expected: 4, responseType, requestId },
    );
  }
  return { type: "resource_get", requestId, errorCode, valueType: "integer", value: body.readUInt32LE(2) };
}
need(body, 2 + size, responseType, requestId);
```

Add the missing regression cases: `[1, 0]`, `[1, 2, 0xaa, 0xbb]`, `[1, 3, ...]`.

## Warnings

### WR-01: `vice_run_until`'s timeout answer reports `reached: false` even when the checkpoint provably fired

**File:** `.claude/mcp/vice/stock-run-until.ts:252-279`

**Issue:** The temporary checkpoint is auto-deleted by VICE the instant it fires
(`mon_breakpoint.c:605-607`, per the file's own comment). So an `ObjectMissing` on the
cleanup delete is near-proof that the address *was* reached between the deadline firing and
the delete being sent. The code correctly recognises that race ("the hit landed between the
deadline firing and this delete") but then treats it as cosmetic: `cleanup = "already_gone"`
while the top-level answer still says `reached: false, timedOut: true`. The machine is at
that point sitting stopped *at the requested address*, and the caller is told it never got
there — the strongest signal available is discarded into a secondary field.

**Fix:** on `already_gone`, do not assert `reached: false`. Either re-derive the truth
(`CHECKPOINT_GET`/`CHECKPOINT_LIST` before the delete, or read PC and compare to `address`)
or degrade honestly:

```ts
if (cleanup === "already_gone") {
  payload.reached = "unknown";
  payload.raceNote =
    "the temporary checkpoint was already gone when cleanup ran -- VICE auto-deletes a temporary " +
    "checkpoint the instant it fires, so the address may have been reached just after the deadline; " +
    "read PC to settle it";
}
```

### WR-02: `vice_run_until`'s timeout path leaves the emulated machine halted and does not say so (live-reproduced)

**File:** `.claude/mcp/vice/stock-run-until.ts:248-279`

**Issue:** On timeout the handler sends exactly one `CHECKPOINT_DELETE` and returns. On
stock, any inbound byte halts the machine (`monitor_binary.c:281`) and only `EXIT` resumes
it — so the cleanup delete freezes the C64, and nothing resumes it. The answer's
`explanation` then steers the caller *away* from that state: *"This bounded answer means the
address itself did not execute in time, not that the connection is unresponsive."* Nothing
in the payload says "and the machine is now stopped"; only the generic `runState` stamp
hints at it. This is the same shape as the incident `stockConnect()`'s CR-02 comment exists
to prevent (a health check that froze the machine and left it frozen), on the one tool whose
whole purpose is to *not* look like a wedge.

Live reproduction (this review; control first, to prove the machine really was advancing):

```
[+  857ms] raster A 0            <- read halts
[+  857ms] resumed
[+ 1362ms] raster B 55           <- control: machine advances after a resume
[+ 1369ms] checkpoint armed id 1
[+ 1372ms] the ONE resume of the wait
[+ 2874ms] wait over; sending CHECKPOINT_DELETE (the only cleanup handleRunUntil does)
[+ 2893ms] EVENT registers / EVENT stopped 58831     <- the delete halted the machine
[+ 2894ms] post-timeout raster 1 0
[+ 3295ms] post-timeout raster 2 0
[+ 3295ms] => MACHINE HALTED after the timeout path
```

The tests lock the behaviour in rather than catching it: `stock-run-until.test.ts:168-180`
asserts "resumes exactly once" and `Exit` count `1` on the hit path with no assertion about
the machine's state after a timeout.

**Fix:** either resume once after the cleanup delete (the wait is over, so this does not
violate "exactly one resume per wait" — it restores the state the caller asked for), or state
the halt explicitly in the payload:

```ts
payload.machineHalted = true;
payload.machineHaltedNote =
  "the cleanup CHECKPOINT_DELETE halted the machine (any inbound byte does, monitor_binary.c:281) " +
  "and nothing here resumed it -- send vice_execution_run before measuring anything";
```

Whichever is chosen, assert it in `stock-run-until.test.ts`.

### WR-03: `vice_diagnose` reports `machinePaused: false` for the `checkpoint_trap` verdict, but the machine is paused

**File:** `.claude/mcp/vice/stock-diagnose.ts:640-648` (and the `restarted`/step-2 path at `:625-634`)

**Issue:** The `checkpoint_trap` verdict is reached only *after*
`gatherStockCheckpointTrapEvidence()` has sent `CHECKPOINT_LIST`, `REGISTERS_GET` and two
or three `MEM_GET`s. Every one of those halts the machine on stock and nothing in that path
resumes it (deliberately — the file's own "never send a resume from either function in this
file"). So by the time the answer is built, the machine *is* paused, and the answer says
`machinePaused: false`. For a triage tool whose consumers decide whether to resume, delete a
checkpoint or step, that is a wrong observation in an evidence field, not a style nit —
and the field is not covered by a test for this verdict (only the `wedged`/`live` paths
assert it, `stock-diagnose.test.ts:474`).

**Fix:** pass `true` on the `checkpoint_trap` path (any wire read has already halted the
machine), or better, stop hand-passing a boolean: derive it from the same run-state tracker
`stockAnswer()` already reads, so the field cannot drift from reality:

```ts
// in diagnoseVerdictResult(), replace the hand-passed flag with the observed state
const payload = { verdict, evidence, report, machinePaused: session ? runStateFor(session.client) === "stopped" : false };
```

Add a test asserting `machinePaused === true` for `checkpoint_trap`.

### WR-04: a bigint cycle delta is narrowed with `Number()` and then labelled `exactness: "exact"`

**File:** `.claude/mcp/vice/stock-timing.ts:384-390`; same pattern at `.claude/mcp/vice/stock-recycle.ts:144`

**Issue:** `ParsedCpuHistoryEntry`'s own doc comment (`stock-protocol.ts:1104-1114`) says the
cycle is *"a `bigint` … never narrowed to `Number`, since a uint64 clock does not fit a JS
number safely and the stopwatch's whole value is exactness."* The consumer then does
`cycles: Number(delta)` and stamps `exactness: "exact"` on the same object. Above 2^53 that
number is silently wrong while claiming to be exact. `cyclesExact` (the string) mitigates it
only for a caller that knows to prefer it; the manifest declares both fields with no hint
that one can lie. `stock-recycle.ts:144` writes the same narrowed value into a permanent
incident record with no exact counterpart at all.

**Fix:** guard the narrowing and downgrade the label when it is not safe:

```ts
const exact = delta <= BigInt(Number.MAX_SAFE_INTEGER);
return finish({
  route: "cpu_history",
  measurable: true,
  ...(exact ? { cycles: Number(delta) } : {}),
  cyclesExact: delta.toString(),
  exactness: exact ? "exact" : "exact-decimal-string-only",
});
```

In `stock-recycle.ts:144`, record `cyclesExact: delta.toString()` alongside (or instead of)
the narrowed number.

### WR-05: stopwatch baselines and the video-standard cache are never invalidated across a reconnect or a restart

**File:** `.claude/mcp/vice/stock-timing.ts:112, 288, 396-418`

**Issue:** Both module caches are keyed on `session.targetId`, and nothing outside
`resetTimingStateForTest()` ever clears them. A `targetId` survives a `stockReconnect()`
*and* a `vice_recycle` respawn (same port, same target, new epoch). On Route A a stale
baseline is caught by the `delta < 0n` guard (`:377`). On Route B there is no equivalent
guard: a `read` against a baseline recorded before a restart compares two unrelated
within-frame positions and answers `measurable: true` with a plausible small `cycles`
figure. That is precisely the "fabricated figure trusted as fact" outcome this file's header
cites `observation-hazards.md` for. Secondarily, both caches grow one entry per distinct
target for the life of the process, with none of the eviction discipline
`ensureStockSession()` applies to the checkpoint-condition registry (`stock-dispatch.ts`,
WR-03 of the Phase 3 review).

**Fix:** store the epoch alongside the baseline and refuse when it moved, and evict on a
fresh handshake:

```ts
type StoredBaseline = { baseline: CycleBaseline; epoch: number | null };
// on read:
if (stored.epoch !== session.baselineEpoch) {
  return finish({ route: sample.route, measurable: false,
    reason: "the instance restarted since the baseline was recorded (epoch changed) -- reset before reading" });
}
```

and export a `resetTimingStateForTarget(targetId)` the dispatch seam calls where it already
evicts the condition registry.

### WR-06: env-var timeout parsers accept `0`, silently disabling diagnosis and evidence capture

**File:** `.claude/mcp/vice/stock-diagnose.ts:335-347`; `.claude/mcp/vice/stock-recycle.ts:103-108`

**Issue:** Both validators accept `Number.isFinite(parsed) && parsed >= 0`. With
`VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS=0`, `Promise.race` resolves the timeout branch on
the first turn, so `vice_diagnose` *always* answers the "session acquisition did not
complete within 0ms" refusal — the tool becomes permanently unusable with no diagnostic
pointing at the cause. With `VICE_RECYCLE_CAPTURE_TIMEOUT_MS=0`, every `captureStep()`
rejects immediately and every incident record is written with four `available: false`
entries — an evidence-free record for a destructive action. Neither is a valid duration;
`0` should be rejected the way a negative or non-numeric value is.

**Fix:** require a positive value in both, and say so when falling back:

```ts
const parsed = Number(raw);
if (!Number.isFinite(parsed) || parsed <= 0) {
  console.error(`${envVar}=${raw} is not a positive number of milliseconds -- using the ${fallback}ms default`);
  return fallback;
}
return Math.trunc(parsed);
```

### WR-07: the new `vice_diagnose`/`vice_recycle` manifest entries are shadowed — the advertised stock description still names `stale_read_path`

**File:** `.claude/mcp/vice/tools-manifest.stock.json:3361-3599`; `.claude/mcp/vice/vice-proxy.ts:3179-3192` (registration order), `:394-408` (`DIAGNOSE_TOOL`)

**Issue:** `tools` is a name-keyed record: the manifest loop fills it first, then
`tools[RECYCLE_TOOL.name] = …` and `tools[DIAGNOSE_TOOL.name] = …` **overwrite** those two
entries. `tools/list` is served from that object, so on the stock backend the advertised
definition is still `DIAGNOSE_TOOL`'s, which says the verdicts are *"restarted,
checkpoint_trap, wedged, stale_read_path, or live"* — one verdict the stock implementation
cannot produce (`STOCK_DIAGNOSE_VERDICTS`, `stock-diagnose.ts:359-365`) and one it *can*
(`monitor_held_elsewhere`) missing entirely. The carefully corrected description and
`outputSchema` added to the stock manifest in this phase never reach an agent, and the same
applies to `vice_recycle`'s "no screenshot on stock" note. This also contradicts the
`SKILL.md` change ("Read the tool's own schema for the exact contract on whichever backend
is active") — on stock, the schema an agent reads is the fork's.

**Fix:** make the synthetic definitions backend-aware too, e.g. have
`buildBackendAwareTool()` prefer the manifest entry for the active backend when one exists:

```ts
const manifestByName = new Map(readManifestTools().map((d) => [d.name, d]));
// ...
tools[DIAGNOSE_TOOL.name] = buildBackendAwareTool(
  ACTIVE_BACKEND.backend === "stock" ? (manifestByName.get(DIAGNOSE_TOOL.name) ?? DIAGNOSE_TOOL) : DIAGNOSE_TOOL,
  (args) => handleDiagnose(args),
);
```

and add a test asserting the advertised stock `vice_diagnose` description does not contain
`stale_read_path` (the mirror of `stock-diagnose.test.ts:596-605`, which only checks the
source file).

### WR-08: `check-skill-tool-coverage.mjs` still classifies `vice_diagnose`/`vice_recycle` as "present in neither manifest by design"

**File:** `scripts/check-skill-tool-coverage.mjs:105-125` (classification), `:224-235` (the assertion that is missing)

**Issue:** This phase added both tools to `tools-manifest.stock.json`, but their
`PROXY_LOCAL_TOOLS` reason strings still assert they are *"present in neither manifest by
design"*. Unlike every other category, `PROXY_LOCAL_TOOLS` has no manifest-absence
assertion, so the now-false classification passes silently — and because
`allowlistedNames` short-circuits the core check, both tools are excluded from
`resolvedAdvertisedCount` (the script reports 27 resolved / 2 proxy-local against 38 stock
tools). The stated design of this script is "shrink by failing"; here it grew a stale
exemption without failing.

**Fix:** either move both names out of `PROXY_LOCAL_TOOLS` (they are advertised stock tools
now, and the `name: "<tool>"` assertion can move to a new "proxy-local definition, stock
manifest entry" category), or add the missing assertion so the drift is loud:

```js
for (const [name] of PROXY_LOCAL_TOOLS) {
  need(!stockNames.has(name), `${name}: classified as PROXY_LOCAL_TOOLS ("neither manifest") but present in the STOCK manifest -- reclassify`);
}
```

### WR-09: the new runtime module cycle has no regression guard, and `stock-recycle.ts` claims one that does not cover it

**File:** `.claude/mcp/vice/stock-recycle.ts:41-47`; `.claude/mcp/vice/load-order.test.ts:324-336`

**Issue:** The header comment says a runtime back-import "would close the module cycle
stock-dispatch.ts -> stock-recycle.ts -> stock-dispatch.ts that `load-order.test.ts` exists
to forbid." `load-order.test.ts` forbids nothing of the kind: its cycle detection is
`findCyclesThroughNode(...)` seeded from **`repo-root`** only, with
`ALLOWED_CYCLES_THROUGH_REPO_ROOT = []`. The `stock-dispatch` ↔ `stock-diagnose` ↔
`stock-recycle` cycle this phase deliberately created passes through none of that. So the
`ReferenceError: Cannot access 'handleDiagnoseStock' before initialization` that was
reproduced live during this phase has **no** regression test, and the `function`-declaration
discipline that fixes it is protected only by comments. `grep` confirms no test imports
these modules in the crashing order.

**Fix:** correct the comment, and add the cheap structural + behavioural guard:

```js
// load-order.test.ts (or stock-dispatch.test.ts)
test("cycle: entering the stock-dispatch/diagnose/recycle cycle from any node does not throw", async () => {
  for (const stem of ["stock-recycle.ts", "stock-diagnose.ts", "stock-dispatch.ts"]) {
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(new URL(stem, base).href)})`]);
    assert.equal(child.status, 0, `${stem} entry failed: ${child.stderr}`);
  }
});
test("cycle: no handler exported from a cycle member is a const arrow", () => { /* regex the three sources */ });
```

(One process per entry point is required — a single test process caches the first entry
order and cannot observe the others.)

### WR-10: `resolveVideoStandard()`'s catch-all swallows typed transport and restart errors as "assuming PAL"

**File:** `.claude/mcp/vice/stock-timing.ts:134-150`

**Issue:** The `catch (err)` converts *everything* — `StockConnectionClosedError`,
`StockRequestTimeoutError`, `MachineRestartedError` — into a PAL result with
`assumed: true`. On the Route B path this is the last wire call inside
`readCycleBaseline()`, and it is also reached from `runStockLivenessBracket()`, i.e. from
`vice_diagnose`'s liveness measurement. A dead socket or a restarted machine discovered
here is reported as a video-standard assumption and the bracket carries on comparing
positions, instead of surfacing the condition that has its own verdict
(`restarted`) and its own error class. The function's contract ("never throws") is
reasonable for a *value* failure; it should not extend to "the connection died".

**Fix:** narrow the catch and let the typed transport/restart errors propagate:

```ts
} catch (err) {
  if (err instanceof MachineRestartedError || err instanceof StockConnectionClosedError || err instanceof StockRequestTimeoutError) {
    throw err; // not a video-standard question -- the callers have verdicts for these
  }
  const message = err instanceof Error ? err.message : String(err);
  return palFallback(`resolveVideoStandard: reading MachineVideoStandard failed (${message}) -- assuming PAL`);
}
```

### WR-11: `vice_run_until` silently ignores `cycles` when `address` is also given, and accepts unknown arguments

**File:** `.claude/mcp/vice/stock-run-until.ts:148-157`

**Issue:** The "cycles-only mode not yet implemented" refusal is reachable *only* when
`address` is absent (`:148`). Pass both `address` and `cycles: 5000` and the cycle bound is
dropped without a word, while the answer reports `reached: true` — the caller believes a
bound it never got was honoured. Unknown keys are likewise accepted silently, unlike the
sibling handler added in the same phase (`handleCyclesStopwatch` refuses unexpected keys by
name, `stock-timing.ts:310-313`).

**Fix:** refuse (or at least annotate) a `cycles` argument whenever it is present:

```ts
if (args.cycles !== undefined) {
  return isErrorText(
    "vice_run_until: cycles is not implemented on either backend -- remove it, or call with address alone " +
      "and bound the wait with timeout_ms",
  );
}
```

and apply the same unexpected-key check the stopwatch handler uses.

### WR-12: `vice_diagnose`'s bounded acquisition abandons the losing `ensureStockSession()` unobserved

**File:** `.claude/mcp/vice/stock-diagnose.ts:585-604`

**Issue:** When the timeout branch of the `Promise.race` wins, the in-flight
`ensureStockSession(deps)` keeps running. If it later succeeds it installs a module-level
`heldSession` *after* the tool has already answered "acquisition did not complete" (so the
next unrelated tool call silently inherits a session the diagnosis said could not be
obtained); if it later rejects — including with the `MonitorOwnershipError` that has its own
verdict — the rejection is absorbed by the already-settled race and never reaches stderr or
the caller. Neither outcome is a leak, but both are invisible state changes attributable to
a call that reported failure.

**Fix:** attach an observer to the abandoned promise so the outcome is at least recorded, and
mention the possibility in the refusal text:

```ts
const acquisition = ensureStockSession(deps);
acquisition.then(
  (o) => { if (raceLost) console.error(`vice_diagnose: abandoned acquisition later succeeded (ok=${o.ok})`); },
  (e) => { if (raceLost) console.error(`vice_diagnose: abandoned acquisition later failed: ${String(e)}`); },
);
```

### WR-13: the `CPUHISTORY_GET` parser comment still claims its layout is "confirmed against monitor_binary.c:1563-1617"

**File:** `.claude/mcp/vice/stock-protocol.ts:1414-1424`; also `stock-protocol.ts:1104-1129` (`[CITED …]` tags)

**Issue:** The phase's own `deferred-items.md` records that this layout does **not** match a
real VICE 3.10 reply (52-byte body, 47-byte declared `item_size`, no room for the documented
trailing 13 bytes) — re-confirmed live in this review. The code comment and the two
`[CITED monitor_binary.c:1563-1617]` tags still present it as confirmed. In this codebase a
`[CITED]`/`[VERIFIED]` tag is load-bearing: the next reader will trust it and look for the
bug elsewhere. The deferred item is the right place for the *fix*; the comment must not keep
asserting verification the phase disproved.

**Fix:** annotate at the parser, pointing at the deferred item:

```ts
// [DISPROVEN 2026-08-18, see .planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md]
// A real VICE 3.10 reply for count:1 is 52 bytes with item_size=47, leaving NO room for the
// trailing cycle+instruction fields this case reads -- so `item_size` is not "register-block
// byte count" on that build. Do not trust the [CITED] layout below until it is re-derived.
```

---

_Reviewed: 2026-08-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
