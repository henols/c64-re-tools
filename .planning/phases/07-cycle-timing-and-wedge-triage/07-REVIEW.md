---
phase: 07-cycle-timing-and-wedge-triage
reviewed: 2026-08-18T15:10:00Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - .claude/mcp/vice/stock-connect.ts
  - .claude/mcp/vice/stock-connect.test.ts
  - .claude/mcp/vice/stock-protocol.ts
  - .claude/mcp/vice/stock-protocol.test.ts
  - .claude/mcp/vice/stock-run-until.ts
  - .claude/mcp/vice/stock-run-until.test.ts
  - .claude/mcp/vice/stock-diagnose.ts
  - .claude/mcp/vice/stock-diagnose.test.ts
  - .claude/mcp/vice/stock-timing.ts
  - .claude/mcp/vice/stock-timing.test.ts
  - .claude/mcp/vice/stock-dispatch.ts
  - .claude/mcp/vice/stock-dispatch.test.ts
  - .claude/mcp/vice/stock-derived.ts
  - .claude/mcp/vice/stock-derived.test.ts
  - .claude/mcp/vice/stock-recycle.ts
  - .claude/mcp/vice/stock-recycle.test.ts
  - .claude/mcp/vice/stock-live.test.ts
  - .claude/mcp/vice/stock-live-triage.test.ts
  - .claude/mcp/vice/vice-proxy.ts
  - .claude/mcp/vice/probe-binmon.mjs
  - .claude/mcp/vice/test-gate.mjs
  - .claude/mcp/vice/test-gate.test.ts
  - .claude/mcp/vice/hostpath-consumers.test.ts
  - .claude/mcp/vice/tools-manifest.stock.json
  - .claude/mcp/vice/package.json
  - .claude/mcp/vice/fixtures/binmon/cpuhistory-get.bin
  - .claude/mcp/vice/fixtures/binmon/cpuhistory-get.json
  - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.bin
  - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.json
  - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.bin
  - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.json
  - .claude/skills/vice-wedge-triage/SKILL.md
  - .claude/skills/c64-program-recon/references/tool-selection.md
  - docs/stock-vice-parity.md
  - docs/phase0-binmon-findings.md
  - scripts/check-skill-tool-coverage.mjs
findings:
  critical: 1
  warning: 19
  info: 0
  total: 20
status: issues_found
---

# Phase 7: Code Review Report (re-review after gap closure)

**Reviewed:** 2026-08-18
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

This is a re-review of Phase 7 after the 07-11 … 07-18 gap-closure batch. Verification
went past reading: `tsc --noEmit` is clean, the full automated gate (`node test-gate.mjs`)
reports **1565 pass / 0 fail / 5 todo** (the 5 todo are the CLAUDE.md-sanctioned
`vice-sync.ts` items), the three new binary fixtures were **hand-decoded byte by byte**
against the corrected parser, and three parser edge cases were **executed** against the
real `parseBuffer()` to confirm or refute claims made in comments.

### Verdict on the seven findings the batch targeted

| Finding | Status | Evidence |
|---|---|---|
| CR-01 (CPUHISTORY probe kills the handshake) | **Closed** | `stock-connect.ts:154-169` classifies decode failures (`StockFramingError`/`StockDesyncError`/`StockResponseMismatchError`) as `"absent"`; `resolveCapabilities()` (`:210-218`) additionally guards the call site; transport classes still reject. Six new regression tests. **But the fix introduced CR-01 below.** |
| CR-02 (`RESOURCE_GET` integer `RangeError`) | **Closed** | `stock-protocol.ts:1578-1590` checks `size !== 4` *before* any read; `need(body, 2 + 4, …)` precedes `readUInt32LE(2)`. Four new regressions including `[1,0]`, `[1,2,…]`, `[1,3,…]` and a "no `BUG:` line" assertion. |
| WR-01 (`reached:false` on a fired checkpoint) | **Closed** | `stock-run-until.ts:302-338` resolves the race from a live PC read (`pc_at_address`/`pc_elsewhere`) and, when the read fails, **omits `reached`** and sets `reachedUnknown`. Manifest `required` correctly dropped `reached`. |
| WR-02 (timeout leaves the machine halted, silently) | **Closed in substance, defective in detail** | `machineHalted`/`machineHaltedNote` now emitted unconditionally on both paths — see WR-01 below for the branch where that unconditional `true` is false. |
| WR-03 (`machinePaused` hand-passed) | **Closed** | The parameter was *removed* from `diagnoseVerdictResult()`; `deriveMachinePaused()` (`stock-diagnose.ts:659-671`) derives it from `runStateFor()` and adds `machinePausedSource`. See WR-03 below for the residual trust problem. |
| WR-07 (advertised stock schema overwritten) | **Closed** | `resolveAdvertisedToolDefinition()` (`stock-dispatch.ts:106-146`) + `vice-proxy.ts:3179-3202`; asserted on the **resolved** definition, not the source text, in six new tests. |
| WR-13 (`[CITED]` layout that was disproven) | **Closed, and better than asked** | The layout was not merely annotated — it was **re-derived and proven**. I decoded `fixtures/binmon/cpuhistory-get.bin` by hand: `count=1`, `item_size=0x2f=47`, `regCount=8`, 8×4-byte register items, `cycle=0x031734ec`, `instruction_length=4`, `8D 92 02 FF` → `4 + 1 + 47 = 52` = exactly the declared body. `cpuhistory-get-multi.bin` decodes to four entries with strictly ascending cycles (`0x04616d0b/0f/12/15`), confirming `entries[0]` is the **oldest**. Both fixtures are genuine captures. |

Four previously-unproven manual-only rows are now backed by real code
(`stock-live-triage.test.ts`, correctly registered as the fifth `MANUAL_ONLY_TESTS` entry),
and `docs/stock-vice-parity.md`'s false "live-confirmed" paragraph has been replaced with an
honest, ordered history. That is genuinely good work.

### What this review found anyway

One **BLOCKER** is a direct consequence of the CR-01 fix: a client-side decode failure — or a
one-off wire desync — is now written to the on-disk capability record as
`cpuHistoryAvailable: false`, and that record has no invalidation key except the VICE version
quad. The file's own comment states the rule this violates.

Beyond that, the recurring theme in the new code is **hand-asserted facts about the emulator's
state**. 07-15 removed exactly that anti-pattern from `vice_diagnose` (`machinePaused` is now
derived, never passed) while 07-14 introduced a new instance of it in the sibling handler
(`machineHalted: true`, unconditional, in `vice_run_until`) — and there is a reachable branch
where it is provably wrong and contradicts `runState` in the same JSON object.

Also new: the phase's own live test (`c5ac707`) **proves the run-state tracker can be stale**,
which is the same projection `machinePausedSource: "observed"` now presents as a wire
observation; the wire's `JAM` event is parsed and then discarded by its only consumer, so
`vice_diagnose` can answer `live` for a jammed CPU; and `docs/phase0-binmon-findings.md` §5 —
which CLAUDE.md names as the *normative* protocol reference — still carries the exact
`item_size` wording that produced the disproven layout, so the next reader can re-derive the
bug from the document that was supposed to prevent it.

Carryover: seven warnings from the previous review (WR-04/05/06/09/10/11/12) are untouched and
not recorded in `deferred-items.md`. Two of them were made *worse* by the gap-closure work and
are re-reported with the new consequence (WR-15, WR-17 below).

Checked and clean: request-id-first demux still never resolves a pending request from an
event; `JAM`'s zero-length body is still handled without fabricating a PC
(`stock-protocol.ts:1441`); no derived tool can reach `forwardToVice()`/`rewriteArguments()`
(`buildBackendAwareTool()` routes every stock call through `dispatchStock`); the stock manifest
advertises **no** resource-set tool, so the three power-cycling resources are unreachable by
construction; `package.json`'s `files[]` is a closed import graph (verified programmatically —
no shipped module imports an unshipped one); `probe-binmon.mjs`'s `parseTarget()` arg-consumption
fix is correct.

## Critical Issues

### CR-01: A client-side decode failure is persisted to the on-disk capability record, permanently disabling Route A with no invalidation path

**File:** `.claude/mcp/vice/stock-connect.ts:160-164` (the new classification), `:219-221` (the write), `:200-208` (the rule it breaks); `.claude/mcp/vice/backend-detect.mts:548-555` (staleness keyed on `versionQuad` only)

**Issue:**
07-11 made `probeCpuHistory()` return the *value* `"absent"` for a decode failure:

```ts
if (err instanceof StockFramingError) return "absent";
if (err instanceof StockDesyncError) return "absent";
if (err instanceof StockResponseMismatchError) return "absent";
```

That is a **normal return**, so control reaches `resolveCapabilities()`'s persistence step:

```ts
if (deps.binPath) {
  writeCap(deps.binPath, { versionQuad, cpuHistoryAvailable: cpuHistory === "available" }, { supervisorDir: deps.supervisorDir });
}
```

`cpuHistoryAvailable: false` is now on disk for that `binPath` + `versionQuad`. The record is
invalidated **only** when the observed version quad differs (`backend-detect.mts:550-554`);
there is no client/parser-version field, so no code change can ever invalidate it.
Consequences:

1. **Reachable today, not only in hindsight.** `StockDesyncError` is in the swallowed set. A
   single transient framing desync during the probe permanently records "this build has no
   CPU history" for that binary — Route A (the exact stopwatch, the whole point of TIME-01)
   silently degrades to Route B's `within-one-frame-unverified` figure, or to `unavailable` on
   a build that does not enumerate `LIN`/`CYC`. Recovery requires manually deleting a file
   under `.vice-supervisor/` that nothing tells the user about.
2. **It defeats future decode fixes by construction.** Any machine that connected while a
   parser bug existed keeps answering `"absent"` after the parser is fixed, until VICE itself
   is upgraded.
3. **The file states the opposite rule 12 lines above the write.**
   `stock-connect.ts:205-208`: *"Anything unclassifiable degrades to `"absent"` **WITHOUT
   writing a capability cache record** -- a capability answer nobody could actually establish
   must never be persisted for the next connect."* A decode failure is precisely "a capability
   answer nobody could establish"; the guard was applied only to the *unclassified* branch.
   The test suite locks in the narrow reading: `stock-connect.test.ts` asserts `writeCalls === 0`
   for the unclassified case and asserts nothing about the write for the three decode classes.

Secondary, same site: the `resolveCapabilities()` catch-all also swallows
`StockProtocolError` codes it does not name — including `InvalidApiVersion` (`0x82`) — which
`stock-connect.test.ts:530-536` now asserts as intended behaviour. An api-version rejection is
the one thing step 3 of the handshake exists to make fatal; downgrading it to a capability
answer with a stderr line is a widening the CR-01 fix did not need.

**Fix:** distinguish "the server answered a capability" from "this client could not read the
answer", and never persist the latter. Carry the provenance out of the probe:

```ts
type CpuHistoryProbe = { capability: CpuHistoryCapability; source: "wire" | "decode_failure" };

async function probeCpuHistory(client: ViceMonitorClient): Promise<CpuHistoryProbe> {
  // ...
  if (err instanceof StockFramingError || err instanceof StockDesyncError || err instanceof StockResponseMismatchError) {
    // The opcode EXISTS; this client just cannot read the reply. Usable as an
    // in-process answer, NEVER as a persisted fact about the build.
    return { capability: "absent", source: "decode_failure" };
  }
  throw err;
}

// in resolveCapabilities():
const probe = await probeCpuHistory(client);
if (deps.binPath && probe.source === "wire") {
  writeCap(deps.binPath, { versionQuad, cpuHistoryAvailable: probe.capability === "available" }, { supervisorDir: deps.supervisorDir });
}
return { cpuHistory: probe.capability };
```

Add a `capabilitySchema`/`clientParserVersion` field to the record in `backend-detect.mts` and
treat a mismatch as `stale`, so a shipped parser fix invalidates records written by the broken
one. Re-narrow the `resolveCapabilities()` catch to rethrow `StockProtocolError` codes it does
not classify. Add the missing regression: *"a StockFramingError from the probe writes NO
capability record"*.

## Warnings

### WR-01: `vice_run_until` asserts `machineHalted: true` unconditionally — false on the closed-socket branch, and self-contradictory with `runState` in the same answer

**File:** `.claude/mcp/vice/stock-run-until.ts:277-298` (the unconditional claim), `:268-275` (the `delete_failed` branch), `:124-126` (`close` resolves the wait as a timeout); `.claude/mcp/vice/stock-handler.ts:175-178` (`runState` stamping)

**Issue:** The timeout payload hardcodes `machineHalted: true` plus *"The machine is now stopped
(see machineHalted) and needs vice_execution_run to resume."* on **all three** cleanup
branches. One of those branches is reached when the socket is already gone: `onClose` resolves
the wait as `{ status: "timeout" }`, the cleanup `CHECKPOINT_DELETE` then rejects with
`StockConnectionClosedError`, `cleanup = "delete_failed"`, and the answer still claims the
machine is halted and instructs the caller to send `vice_execution_run` — over a dead socket, to
an emulator that may have crashed or been recycled. `stockAnswer()` stamps
`runState: runStateFor(client)` into the *same* JSON object, so that answer can read
`{"machineHalted": true, "runState": "running"}`.

This is the same defect class 07-15 removed from the sibling handler in this very batch.
`stock-diagnose.ts:642-656` now says, normatively: *"`machinePaused` is derived HERE, from the
observed run state, and NEVER hand-passed by a call site again -- a hand-passed flag drifts
from reality the moment a call site changes."* `vice_run_until` hand-passes exactly such a flag,
and `tools-manifest.stock.json` marks it `required`, while `vice-wedge-triage/SKILL.md:115-118`
instructs agents to trust it.

**Fix:** derive it from the same seam, and keep the note honest per branch:

```ts
import { runStateFor } from "./stock-runstate.ts";
// ...
const halted = session.client.connected && cleanup !== "delete_failed"
  ? true
  : runStateFor(session.client) === "stopped";
payload.machineHalted = halted;
payload.machineHaltedNote = halted
  ? "the cleanup CHECKPOINT_DELETE halted the emulated machine (on stock, any inbound byte does) and nothing here " +
    "resumed it -- this is expected, not a wedge. Call vice_execution_run to resume."
  : "the machine's run state could not be observed: the cleanup CHECKPOINT_DELETE did not complete (see cleanupError), " +
    "so nothing here can claim the machine is halted -- call vice_diagnose before acting.";
```

Add a regression asserting a `StockConnectionClosedError` on the cleanup delete does **not**
answer `machineHalted: true`.

### WR-02: the advertised `diagnosis_unavailable` contract does not cover two reachable no-verdict paths

**File:** `.claude/mcp/vice/stock-diagnose.ts:809`, `:825`, `:843` (still `diagnoseErrorResult`); `.claude/mcp/vice/tools-manifest.stock.json` (`vice_diagnose` description); `.claude/skills/vice-wedge-triage/SKILL.md:67`

**Issue:** The stock manifest description now promises, and the skill's verdict table repeats
verbatim: *"A failure that establishes no verdict at all answers isError:true with text
beginning `vice_diagnose: diagnosis_unavailable (<reason>)`"* / *"the message starts
`vice_diagnose: diagnosis_unavailable (<reason>)`"*. Three code paths still answer
`isError: true` **without** that prefix and without a reason class:

- `:809` and `:825` — the inconclusive-bracket path. Genuinely reachable: a build whose
  `REGISTERS_AVAILABLE` enumerates neither `LIN` nor `CYC` and lacks `CPUHISTORY_GET` produces
  `route: "unavailable"` (`stock-timing.ts:403-411`), which is the *documented* stock 3.9-class
  outcome — precisely the population this backend exists for.
- `:843` — the outer catch-all (`"an unexpected error occurred"`).

An agent following the skill's own instruction (match the prefix, read the reason class, act on
the table) falls off the contract for the most likely no-verdict outcome on the most common
distro build.

**Fix:** route both through the classifier, adding one reason class rather than leaving a hole:

```ts
export const STOCK_DIAGNOSE_UNAVAILABLE_REASONS = Object.freeze([
  ..., "liveness_unmeasurable",
] as const);
// :809 / :825
return diagnoseUnavailableResult("liveness_unmeasurable", inconclusiveBracketText(bracket1));
// :843
return diagnoseUnavailableResult("unknown", `an unexpected error occurred (${describeStockError(err)}).`);
```

Then delete `diagnoseErrorResult()` (it becomes an unused one-line alias for `isErrorText`) and
add the `liveness_unmeasurable` row to the SKILL table and the manifest description. Add a test
asserting **every** `isError` answer this handler can produce starts with the documented prefix.

### WR-03: `machinePausedSource: "observed"` presents as a wire observation a projection this phase itself proved can be stale

**File:** `.claude/mcp/vice/stock-diagnose.ts:659-671`; evidence: `.claude/mcp/vice/stock-live-triage.test.ts:175-220` and commit `c5ac707`

**Issue:** `deriveMachinePaused()` labels a `runStateFor()` result of `"stopped"`/`"running"` as
`"observed"` and reserves `"structural"` for `"unknown"` only. But commit `c5ac707`
(*"absorb a real stale-tracker race"*), written in this same batch, records an **empirically
reproduced** failure of that projection: *"the tracker read `"stopped"` at t+0/1ms while the
real machine (server-side) had genuinely resumed and kept running in the background"*. The
helper `resumeUntilCheckpointHits()` exists solely because a `"stopped"` read could not be
trusted. The symmetric error (a stale `"running"` after a halting read) yields
`machinePaused: false, machinePausedSource: "observed"` — WR-03's original defect, now carrying
a label that tells the caller it was directly observed. `deriveMachinePaused()`'s own comment
concedes *"the tracker's own event-driven update can still lag a command reply"* and then applies
that caveat only to the `"unknown"` branch.

No test covers a stale tracker for this function: `stock-diagnose.test.ts:405` and `:427` cover
`"stopped"` and `"unknown"`, and nothing covers `"running"` on a path that has already sent
halting reads.

**Fix:** treat a `"running"` reading on a path that has provably sent at least one halting read
as a contradiction rather than an observation:

```ts
if (runState === "running") {
  // Every path reaching a verdict has already sent a halting read (D-05), so a
  // "running" projection is a stale tracker (reproduced live, 07-17/c5ac707) --
  // not an observation. Report the contradiction instead of trusting either side.
  return { machinePaused: true, machinePausedSource: "structural" };
}
```

…and add the missing `"running"` case to `stock-diagnose.test.ts`, plus a `live`/`wedged`
`machinePaused` assertion (both were hardcoded `true` before this batch and are now unasserted).

### WR-04: the wire's `JAM` event is parsed and then discarded — `vice_diagnose` can answer `live` for a jammed CPU

**File:** `.claude/mcp/vice/stock-runstate.ts:76-80`; `.claude/mcp/vice/stock-protocol.ts:1439-1441`; `.claude/mcp/vice/stock-diagnose.ts:838-843` (`wedged` evidence); `.claude/skills/vice-wedge-triage/SKILL.md:58-68`

**Issue:** CLAUDE.md singles out `JAM` (0x61) as one of the five unsolicited types and
`stock-protocol.ts` goes to the trouble of handling its zero-length body without fabricating a
PC. Its **only** consumer then throws the distinction away:

```ts
if (item.type === "stopped" || item.type === "jam") { state = "stopped"; }
```

Nothing else in the tree reads `type === "jam"` (grep-verified: the only other hits are
`disasm-opcodes.ts`'s mnemonic table). Consequences, both established by this phase's own
artifacts:

- With `-jamaction 2` (Monitor), a real KIL jam produces two zero-advance brackets and
  `vice_diagnose` answers **`wedged`** — `stock-live-triage.test.ts:530-556` asserts exactly
  this. The skill's response for `wedged` is *"Last resort: `vice_recycle` with a real
  reason"*, i.e. destroy the instance — when a `vice_machine_reset` recovers a jam. This is the
  same shape as the `checkpoint_trap` hazard the skill warns about ("recycling a self-inflicted
  stop destroys a healthy instance").
- With VICE's **default** `jamaction` (continue), the emulator keeps consuming cycles while the
  CPU is stuck refetching the same opcode, so both routes' brackets *advance* and
  `vice_diagnose` answers **`live`** — for a machine that will never execute another
  instruction. The `JAM` frame that says so arrived and was discarded.

**Fix:** keep the signal, and surface it as evidence (not a sixth verdict, so D-03 holds):

```ts
// stock-runstate.ts
export interface RunStateTracker { get(): RunState; jamObserved(): boolean; }
// ... in the listener:
if (item.type === "jam") { jamSeen = true; state = "stopped"; }

// stock-diagnose.ts, in every verdict's evidence:
evidence.jamObserved = jamObservedFor(session.client);
```

Then add a `jamObserved` line to the `wedged`/`live` report builders ("the CPU reported a JAM —
reset, do not recycle"), declare it in the stock manifest's `vice_diagnose` outputSchema, and add
a `jamObserved` row to the SKILL verdict table.

### WR-05: the corrected `CPUHISTORY_GET` loop reads `regCount` from outside the declared entry, does not validate its own `instruction_length`, and its hostile-input test passes for a different reason than its name claims

**File:** `.claude/mcp/vice/stock-protocol.ts:1502-1510` (`regCount`), `:1532-1550` (`instruction_length`); `.claude/mcp/vice/stock-protocol.test.ts:1922-1932` (the test)

**Issue:** Three defects in the otherwise-correct rewrite, all **executed and confirmed** against
the real `parseBuffer()` during this review:

1. `regCount` is bounds-checked against the **body**, never against `entryEnd`:
   `need(body, cursor + 2, …)` at `:1503` precedes the read at `:1504`, but the
   `cursor + 2 > entryEnd` check only appears *inside* the register-item loop. For an entry with
   `item_size < 2` in a multi-entry body, `regCount` is read from the **next entry's** bytes.
   Observed: a frame with `count=2` and a first entry of `item_size=1` produces
   `CPUHISTORY_GET entry 0's item_size 1 does not leave room for register item 0 of 4608` — the
   `4608` is garbage assembled from bytes outside entry 0. It throws (no crash, no silent
   success), but the diagnostic names a fabricated number.
2. `instruction_length` is validated only against a hardcoded `3`, while the error message it
   guards claims to check *"room for its declared instruction_length"*. Observed: an entry
   declaring `instructionLength: 200` with 3 instruction bytes present **parses successfully** and
   hands `instructionLength: 200` to consumers.
3. The regression test named *"an item_size too small to hold its own regCount field is a
   returned StockFramingError **naming item_size**"* asserts only `instanceof StockFramingError`.
   Observed message: `response type 0x86 body is 6 byte(s), needs at least 7` — the generic
   `need()` failure, which does **not** name `item_size`. The guard the parser comment claims
   (*"a StockFramingError naming the observed item_size"*, T-07-12-03) is therefore untested.

**Fix:**

```ts
// (1) bound regCount by the declared entry, not just the body
if (cursor + 2 > entryEnd) {
  throw new StockFramingError(
    `CPUHISTORY_GET entry ${index}'s item_size ${itemSize} does not leave room for its own 2-byte regCount field`,
    { observed: itemSize, expected: 2, responseType, requestId },
  );
}
need(body, cursor + 2, responseType, requestId);

// (2) validate against what the entry DECLARES, then read the 3 fields it defines
if (cursor + instructionLength > entryEnd) { throw new StockFramingError(/* names both */); }
```

For (3): assert the message (`assert.match(err.message, /item_size 1/)`) and add a case with a
body long enough that the entry-relative guard, not `need()`, is what fires.

### WR-06: `RESOURCE_GET` silently decodes any unknown value-type byte as an ASCII string

**File:** `.claude/mcp/vice/stock-protocol.ts:1578-1598`

**Issue:** The CR-02 rewrite hardened `valueTypeByte === 1` and left everything else to fall
through to the string branch. The documented contract (`:1561-1565`,
`[CITED monitor_binary.c:938-965]`) is exactly two types: `0` = string, `1` = int. A wire byte of
`2`, `7` or `0xff` is now reported as `valueType: "string"` with `size` bytes of arbitrary
memory rendered as ASCII — a mislabelled value rather than the framing error the rest of this
function produces for out-of-contract input, and a direct sibling of the CR-02 rule stated at
`:1184-1203`. It degrades safely today only because the single consumer
(`stock-timing.ts:136-139`) rejects any non-`integer` reply.

**Fix:**

```ts
if (valueTypeByte !== 0) {
  throw new StockFramingError(
    `RESOURCE_GET reply declared value type ${valueTypeByte}, expected 0 (string) or 1 (integer)`,
    { observed: valueTypeByte, responseType, requestId },
  );
}
need(body, 2 + size, responseType, requestId);
```

### WR-07: Route A reads `entries[0]` and names it `newest` — correct only while `count === 1`, immediately after this phase proved `entries[0]` is the oldest

**File:** `.claude/mcp/vice/stock-timing.ts:229-246`

**Issue:** 07-12's central ordering correction is that `entries[0]` is the **OLDEST** of the
returned window (`stock-protocol.ts:1136-1152`, proven by the multi-entry capture). The consumer
was not updated:

```ts
const newest: ParsedCpuHistoryEntry = response.entries[0]!;
```

This is safe *only* because `count` is 1, and nothing enforces that coupling: the parser happily
returns `count` entries for whatever the server sends, and a future caller (or a build that
returns a full window regardless of the requested count) makes the stopwatch silently sample the
**oldest** entry of the window — a stale baseline reported with `exactness: "exact"`. The
misleading identifier is what will make that change look correct.

**Fix:**

```ts
// entries[] is in wire order: entries[0] is the OLDEST, entries[length-1] the
// NEWEST (07-12, proven against fixtures/binmon/cpuhistory-get-multi.bin).
// Index from the END so this stays correct if the returned window ever grows.
const newest: ParsedCpuHistoryEntry = response.entries[response.entries.length - 1]!;
```

Add a `stock-timing.test.ts` case feeding a two-entry reply and asserting the *higher* cycle is
the one used.

### WR-08: `docs/phase0-binmon-findings.md` §5 — CLAUDE.md's *normative* protocol reference — still carries the disproven `CPUHISTORY_GET` layout and the wrong entry ordering

**File:** `docs/phase0-binmon-findings.md:157-160` (layout), `:54-57` ("newest entry")

**Issue:** CLAUDE.md states: *"**Protocol (settled, normative)**: … Confirmed opcode set and error
codes per `docs/phase0-binmon-findings.md` §5."* That section still reads:

```
Response: uint32 entry count, then per entry:
`item_size`(1) + register block + **cycle (uint64)** + instr_len(1) + opcode + operands.
```

This is verbatim the ambiguous wording `deferred-items.md` identifies as the source of the
disproven layout ("`item_size` denotes … the raw register-block byte count alone"). It is *the*
document a future implementer will re-derive from, and it is now contradicted by the code, the
tests, `deferred-items.md` and `docs/stock-vice-parity.md`. Line 56 likewise still says *"Read
the **newest** entry's cycle"* with no mention that the newest entry is the **last**, not the
first — the exact claim 07-12 falsified. 07-18 was scoped as "documentation integrity gap
closure" and corrected `stock-vice-parity.md` and the skills, but not the file CLAUDE.md points
at as normative.

**Fix:** correct §5 in place, with the same provenance the code carries:

```
**`CPUHISTORY_GET` response body (CORRECTED 2026-08-18, plan 07-12 -- re-derived from
monitor_binary_process_cpuhistory() and verified against fixtures/binmon/cpuhistory-get{,-multi}.bin
from genuine VICE 3.10):** `count`(u32LE), then per entry `item_size`(1) -- the byte count of
EVERYTHING AFTER this byte, so the entry stride is `item_size + 1`, NOT the register-block length
alone -- containing `regCount`(u16LE) + regCount x (size(1)+id(1)+value(u16LE)) +
`cycle`(u64LE) + `instruction_length`(1, a hardcoded 4 in VICE, never a decoded instruction size)
+ that many instruction bytes. Entries arrive OLDEST-first: `entries[count-1]` is the newest.
The earlier "item_size = register block length" reading was disproven live -- do not restore it.
```

### WR-09: the fixture directory's own registry still describes three synthetic fixtures; the three new real captures declare no provenance flag at all

**File:** `.claude/mcp/vice/fixtures/binmon/README.md:11-24`, `:29-33`, `:52`; `.claude/mcp/vice/binmon-fixtures.ts:18-33`; `.claude/mcp/vice/fixtures/binmon/cpuhistory-get{,-multi,-unsupported}.json`

**Issue:** Three real captures were added to a directory whose README is the documented registry
for it, and the README was not touched. It still says *"the **three** fixtures below were
generated from the normative protocol spec"*, *"**Every** sidecar below carries `"synthetic":
true`"*, lists only three rows in its "Source paths" table, and documents `<case>` as one of
`display-get`, `event-interleaved`, `checkpoint-list`, or `all`. `binmon-fixtures.ts`'s header —
the module that **loads** them — asserts *"the three fixtures under fixtures/binmon/ are NOT
currently real captures"* and *"Nothing downstream may treat these bytes as hardware evidence"*,
which is now false for exactly the three fixtures on which 07-12's entire layout proof rests.

Compounding it: the three new sidecars omit `synthetic` entirely, and
`loadCapturedFixture()` derives `synthetic: provenance.synthetic === true`
(`binmon-fixtures.ts:274`). So `assert.equal(fixture.synthetic, false)` — the assertion
`stock-protocol.test.ts` describes as *"asserting non-synthetic provenance so a future re-record
to a synthesized fallback fails loudly here rather than silently"* — is satisfied by **omission**.
Any hand-written sidecar claims hardware provenance by saying nothing.

**Fix:** add `"synthetic": false` explicitly to the three new sidecars and have
`buildSidecar()` (`probe-binmon.mjs:1361-1379`) emit it, so provenance is always stated rather
than defaulted. Add the three rows to the README table, correct the "three fixtures"/"every
sidecar" sentences to name which fixtures are real and which remain synthetic, extend the
`<case>` list, and correct `binmon-fixtures.ts`'s header.

### WR-10: `probe-binmon.mjs --capture all` regenerates `cpuhistory-get-unsupported` from whatever build is connected, writing a sidecar whose `command` string lies

**File:** `.claude/mcp/vice/probe-binmon.mjs:1311-1327` (the three runners), `:1408` (`casesToRun`), `:1361-1378` (`buildSidecar`)

**Issue:** `CAPTURE_CASES` now mixes cases with **mutually exclusive** target requirements:
`cpuhistory-get`/`-multi` must be captured against a ≥ 3.10 build, `cpuhistory-get-unsupported`
against a 3.9 build. `--capture all` runs every case against the one connected target, and
`captureCpuHistoryGetUnsupportedCase()` is byte-identical to `captureCpuHistoryGetCase()`. Run
`--capture all` against a 3.10 build and `cpuhistory-get-unsupported.bin` is overwritten with a
successful 52-byte history frame, while its sidecar's `command` still reads *"against a build
without FEATURE_CPUMEMHISTORY"* — a provenance lie generated by the provenance tooling itself, in
a repo whose stated standard is *"provenance that lies is the thing not to produce"*. The
mitigation is only that `stock-protocol.test.ts`'s errorCode `0x83` assertion then fails; the
committed fixture is already clobbered by then.

**Fix:** make the requirement machine-checked rather than a comment. Declare the expected
version family per case and refuse the mismatch before writing:

```js
const CAPTURE_REQUIRES_VERSION = {
  "cpuhistory-get": /^3\.(1[0-9]|[2-9][0-9])\./,
  "cpuhistory-get-multi": /^3\.(1[0-9]|[2-9][0-9])\./,
  "cpuhistory-get-unsupported": /^3\.9\./,
};
// in runCapture()'s per-case loop, before the runner:
const want = CAPTURE_REQUIRES_VERSION[c];
if (want && !want.test(viceVersion)) {
  console.log(`[capture] case "${c}" SKIPPED: needs a VICE build matching ${want}, connected build is ${viceVersion} -- no .bin written`);
  continue;
}
```

### WR-11: `check-skill-tool-coverage.mjs` still classifies `vice_diagnose`/`vice_recycle` as "present in neither manifest by design" — now contradicted by this phase's own test

**File:** `scripts/check-skill-tool-coverage.mjs:112-125` (the reason strings), `:180-188` (the assertion block that has no manifest-absence check)

**Issue:** Carried over from the previous review (WR-08) and now demonstrably false rather than
merely stale: both names are in `tools-manifest.stock.json`, and
`stock-dispatch.test.ts:186-190` **asserts** they must be (*"PROXY_LOCAL_TOOLS name must be
present in the stock manifest"*). Two committed sources of truth in the same repo now state
opposite facts, and only one of them fails on drift — `PROXY_LOCAL_TOOLS` is the sole
classification with no manifest-presence assertion, and `allowlistedNames` short-circuits the
core check, so both tools are silently excluded from `resolvedAdvertisedCount`. The script's
stated design is "shrink by failing"; here it grew a false exemption without failing.

**Fix:** reclassify and assert, so the two files can never disagree again:

```js
// 1b. Served proxy-locally BUT advertised from the stock manifest (Phase 7).
const PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY = [
  ["vice_recycle", "Served inside vice-proxy.ts; advertised from tools-manifest.stock.json on the stock backend (Phase 7, WR-07)."],
  ["vice_diagnose", "Served inside vice-proxy.ts; advertised from tools-manifest.stock.json on the stock backend (Phase 7, WR-07)."],
];
for (const [name] of PROXY_LOCAL_TOOLS) {
  need(!stockNames.has(name), `${name}: classified as PROXY_LOCAL_TOOLS ("neither manifest") but present in the STOCK manifest -- reclassify`);
}
for (const [name] of PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY) {
  need(stockNames.has(name), `${name}: classified as advertised-from-stock-manifest but absent from it`);
}
```

### WR-12: `stock-derived.ts`'s load-bearing line citations and its "unreachable on stock" reasoning are stale

**File:** `.claude/mcp/vice/stock-derived.ts:20-27` (cites `vice-proxy.ts:2773`), `:29-35` (cites `:1343`/`:1367`, and the reachability argument)

**Issue:** This header is the in-tree statement of CLAUDE.md's derived-tool constraint, so its
citations are load-bearing. Verified against the current source: `rewriteArguments()` is called
from `forwardToVice()` at **`vice-proxy.ts:2889`** (not 2773), `gatherWedgeEvidence()` begins at
**`:1344`** (not 1343) and calls `rewriteArguments()` at **`:1368`** (not 1367). CLAUDE.md's own
numbers (2889, 1368) are correct; this file's are not, and 07-16 edited `vice-proxy.ts` without
re-verifying them.

The reachability argument in the same block is also stale: *"it is currently unreachable on stock
anyway: handleRecycle() is backend-aware and refused by name after CR-07, and
vice_display_screenshot does not exist on stock until Phase 5."* On stock, `vice_recycle` is no
longer refused by name — Phase 7 implemented it (`handleRecycleStock`) and registered it in
`STOCK_DERIVED_TOOLS` (`:95`). The conclusion still holds (stock routes through `dispatchStock`,
never `handleRecycle`), but the reason given is now wrong, which is worse than no reason for a
constraint a future reader will re-derive.

**Fix:** update the three line numbers and restate the reachability argument in terms of what
actually enforces it today (`buildBackendAwareTool()` routes every stock call to
`dispatchStock`; `handleRecycle`/`gatherWedgeEvidence` are reachable only on the fork arm). Since
these numbers drift every phase, prefer a symbol-anchored citation
(`forwardToVice()`'s `rewriteArguments(args, name)` call) over a line number.

### WR-13: a bigint cycle delta is narrowed with `Number()` and still labelled `exactness: "exact"` (carryover, unaddressed)

**File:** `.claude/mcp/vice/stock-timing.ts:391-397`; same pattern at `.claude/mcp/vice/stock-recycle.ts:144`

**Issue:** Unchanged from the previous review and not recorded in `deferred-items.md`.
`ParsedCpuHistoryEntry`'s doc comment still says the cycle is *"never narrowed to `Number`, since
a uint64 clock does not fit a JS number safely and the stopwatch's whole value is exactness"*, and
the consumer does `cycles: Number(delta)` with `exactness: "exact"` on the same object.
`stock-recycle.ts:144` writes the narrowed value into a permanent incident record with no exact
counterpart. **Fix:** as previously specified — gate the narrowing on
`delta <= BigInt(Number.MAX_SAFE_INTEGER)`, downgrade the label when it does not hold, and record
`cyclesExact` in the incident record.

### WR-14: stopwatch baselines and the video-standard cache are never invalidated across a reconnect or a restart (carryover, unaddressed)

**File:** `.claude/mcp/vice/stock-timing.ts:112` (video-standard cache), `:295` (stopwatch baselines), `:296-300` (the only reset, test-only)

**Issue:** Unchanged. Both module caches are keyed on `session.targetId`, which survives a
`stockReconnect()` and a `vice_recycle` respawn; only Route A has a `delta < 0n` guard, so Route B
compares two unrelated within-frame positions and answers `measurable: true`. **Fix:** as
previously specified — store `session.baselineEpoch` alongside the baseline and refuse when it
moves; export a per-target reset the dispatch seam calls where it already evicts the
condition registry.

### WR-15: env-var timeout parsers still accept `0`, and the new classification now dresses the result up as a diagnosable condition (carryover, made worse)

**File:** `.claude/mcp/vice/stock-diagnose.ts:350-357`; `.claude/mcp/vice/stock-recycle.ts:103-108`; new consequence at `.claude/mcp/vice/stock-diagnose.ts:449-454`

**Issue:** Both validators still accept `parsed >= 0`. With
`VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS=0`, `Promise.race` always resolves the timeout branch — and
07-15 changed what the caller is told. It now receives
`diagnosis_unavailable (monitor_acquisition_timeout)` with the guidance *"this is behaviourally
indistinguishable from a second client already holding the monitor socket … retry once the current
holder releases."* A misconfiguration is now reported as a specific, plausible, actionable
diagnosis of the emulator's environment — strictly worse than the previous unclassified refusal.
`VICE_RECYCLE_CAPTURE_TIMEOUT_MS=0` similarly yields an evidence-free incident record for a
destructive action. **Fix:** require `parsed > 0` in both, log the rejected value and the default
being used.

### WR-16: the `stock-dispatch` ↔ `stock-diagnose` ↔ `stock-recycle` runtime cycle still has no regression guard (carryover, unaddressed)

**File:** `.claude/mcp/vice/stock-recycle.ts:41-47`; `.claude/mcp/vice/load-order.test.ts:324-336`

**Issue:** Unchanged, and this batch added a third `function`-declared export into that cycle
(`resolveAdvertisedToolDefinition`, `stock-dispatch.ts:140`) whose doc comment again asserts the
`function`-not-`const` rule is enforced. It is not: `load-order.test.ts`'s cycle detection is
seeded from `repo-root` only. The live-reproduced `ReferenceError: Cannot access
'handleDiagnoseStock' before initialization` still has no test. **Fix:** as previously specified —
one child process per cycle entry point asserting a clean `import`, plus a source regex asserting
no handler exported from a cycle member is a `const` arrow.

### WR-17: `resolveVideoStandard()`'s catch-all still swallows typed transport errors, and now defeats two of the new `diagnosis_unavailable` reason classes (carryover, made worse)

**File:** `.claude/mcp/vice/stock-timing.ts:147-150`

**Issue:** Unchanged: `catch (err)` converts everything — including
`StockConnectionClosedError`, `StockRequestTimeoutError` and `MachineRestartedError` — into a PAL
result with `assumed: true`. 07-15 added the reason classes `connection_lost` and
`request_timeout` and both the manifest and the SKILL now promise them. But
`resolveVideoStandard()` is the last wire call inside Route B's `readCycleBaseline()`, itself
called from `runStockLivenessBracket()` — so a socket that dies *there* can never be classified
as `connection_lost`; it is laundered into "assuming PAL" and re-surfaces later, if at all, as
`evidence_gathering_failed`. The new classification is only as honest as the narrowest catch on
the path. **Fix:** as previously specified — rethrow `MachineRestartedError`,
`StockConnectionClosedError` and `StockRequestTimeoutError`; keep the PAL fallback for
value-shaped failures only.

### WR-18: `vice_run_until` still silently ignores `cycles` when `address` is present, and still accepts unknown arguments (carryover, unaddressed)

**File:** `.claude/mcp/vice/stock-run-until.ts:149-158`

**Issue:** Unchanged. The "cycles-only mode not yet implemented" refusal is reachable only when
`address` is absent; passing both `address` and `cycles: 5000` drops the cycle bound without a
word while the answer reports `reached: true`. Unknown keys are accepted silently, unlike the
sibling handler added in the same phase (`handleCyclesStopwatch` refuses unexpected keys by name,
`stock-timing.ts:310-313`). **Fix:** as previously specified — refuse whenever `cycles` is
present, and apply the same unexpected-key check the stopwatch handler uses.

### WR-19: `vice_diagnose`'s bounded acquisition still abandons the losing `ensureStockSession()` unobserved (carryover, unaddressed)

**File:** `.claude/mcp/vice/stock-diagnose.ts:726-745`

**Issue:** Unchanged. When the timeout branch wins the race, the in-flight
`ensureStockSession(deps)` keeps running: a later success installs a module-level `heldSession`
*after* the tool answered `diagnosis_unavailable (monitor_acquisition_timeout)`, and a later
rejection — including the `MonitorOwnershipError` that has its own verdict — is absorbed by the
settled race and never reaches stderr. Both are invisible state changes attributable to a call
that reported failure. **Fix:** as previously specified — attach an observer to the abandoned
promise so the outcome is recorded on stderr, and say in the refusal text that an acquisition may
still be in flight.

---

_Reviewed: 2026-08-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
