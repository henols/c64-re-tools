# Phase 41: The Text Channel, Its Serialization Authority, and the Contention Verdict - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 10 (3 new, 7 modified)
**Analogs found:** 10 / 10

All analog paths below were re-verified this session with `Read`/`Grep` against
the actual tracked source (`git ls-files` confirms every path is git-tracked,
not a `.gsd/capabilities/` mirror). Line numbers reflect the state of the tree
on 2026-09-08 and — per `CLAUDE.md`'s own standing discipline — will drift the
moment this phase's plans land; treat a later mismatch as drift to re-verify,
not as evidence a cited pattern moved or vanished. Two corrections versus
`41-CONTEXT.md`'s own citations, found by direct read this session:
`jamObservedFor()` is **imported** into `stock-diagnose.ts` from
`stock-runstate.ts:138`, not defined at `stock-diagnose.ts:754-771` (that range
is `diagnoseVerdictResult()`, which **calls** it — copy that call site's shape,
not a same-file definition); and `stock-connect.ts`'s
`StockConnectBrokerControl` interface is a **2-method** interface
(`claimMonitor`/`releaseMonitor`), confirming `41-CONTEXT.md`'s description
exactly.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/text-protocol.ts` (NEW) | service (wire-protocol client) | streaming (TCP, framed by regex not length-prefix) | `src/mcp/vice/stock-protocol.ts` | exact (same role, same channel-family, only the framing rule differs) |
| `src/mcp/vice/text-connect.ts` (NEW) | service (session/claim lifecycle) | request-response (claim → connect → hold → release) | `src/mcp/vice/stock-connect.ts` | exact |
| `src/mcp/vice/channel-lock.ts` (NEW) | utility (in-process primitive) | event-driven (FIFO queue, acquire/release, timeout) | none in this codebase — see § No Analog Found | no analog (explicitly checked, not extracted) |
| `src/mcp/vice/stock-dispatch.ts` (MODIFIED — import `channel-lock.ts`) | controller/dispatcher | request-response | itself (existing file, integration point only) | n/a — read-only integration, see Pitfall 6 |
| `src/mcp/vice/stock-diagnose.ts` (MODIFIED — D-09/D-10/D-11 evidence field) | service (diagnostic derivation) | CRUD-like (derive-then-append evidence) | itself, `jamObserved` shape at `diagnoseVerdictResult()` | exact (copy in-file precedent) |
| `src/mcp/vice/broker-control.mts` (MODIFIED — `grant` gains `remoteMonitorPort`, `monitor_claim` gains `channel`) | controller (wire-protocol handler) | request-response | itself, `monitor_claim` handler + `MONITOR_OWNERSHIP_DENIAL` | exact |
| `src/mcp/vice/broker-state.mts` (MODIFIED — `channel` discriminator on `monitorClient`) | model (in-memory instance record) | CRUD | itself, `monitorClient`/`remoteMonitorPort` fields | exact |
| `src/mcp/vice/broker-launch.mts` (MODIFIED — D-16 mandatory text port, folded-todo warm-floor removal) | service (process launch) | request-response / batch | itself, `acquirePortAndLaunch()` | exact |
| `src/mcp/vice/vice-broker-client.ts` (MODIFIED — `HeldLease` gains `remoteMonitorPort`, `claimMonitor()` gains `channel`) | service (control-plane client) | request-response | itself, `HeldLease`/`claimMonitor()` | exact |
| `src/skills/vice-wedge-triage/SKILL.md` (MODIFIED — contention row, MEDIUM provenance row) | documentation (skill playbook) | n/a | itself, verdict table + provenance table | exact |

## Pattern Assignments

### `src/mcp/vice/text-protocol.ts` (NEW — service, streaming)

**Analog:** `src/mcp/vice/stock-protocol.ts` (`ViceMonitorClient`, git-tracked)

**Class shape to mirror** (`stock-protocol.ts:1956` onward — read this session, verbatim):
```typescript
export class ViceMonitorClient extends EventEmitter {
  #socket: net.Socket | null = null;
  #buffer: Buffer = Buffer.alloc(0);
  #desyncBytes = 0;
  #duplicateReplies = 0;
  #nextRequestId = 1;
  #pending = new Map<number, PendingCommand>();
  #settledRing: number[] = [];
  #settledSet = new Set<number>();
  #port: number | null = null;
  #closed = false;
  #onDataBound = (chunk: Buffer) => this.#onData(chunk);
  #onCloseBound = () => this.#onClose();
  #onErrorBound = (err: Error) => this.#onError(err);

  constructor({ initialRequestId }: ViceMonitorClientOptions = {}) {
    super();
    if (initialRequestId !== undefined) {
      this.#nextRequestId = initialRequestId;
    }
  }

  get connected(): boolean {
    return this.#socket != null && !this.#socket.destroyed;
  }
}
```
`TextMonitorClient` should keep `#socket`/`#buffer`/bound-handler
private-field shape and the `connected` getter, but **drop** the
`#pending`/`#nextRequestId`/`#settledRing` request-id-multiplexing fields
entirely — the text protocol is not multiplexed (one command in flight, one
prompt back). Add instead: an idle/pending-command state flag (Pitfall 4:
distinguishing an unsolicited breakpoint banner from a real reply) and a
quiescence-window timer (Pitfall 2).

**Accumulation-cap discipline to copy** (`stock-protocol.ts:2153` onward, read
this session — function signature and the load-bearing comment, verbatim):
```typescript
#onData(chunk: Buffer): void {
  let combined: Buffer;
  try {
    combined = Buffer.concat([this.#buffer, chunk]);
    const counters: ParseCounters = { desyncBytes: this.#desyncBytes };
    const { responses, remainder, desyncBytes } = parseBuffer(combined, counters);
    this.#desyncBytes = desyncBytes;

    // WR-03: the cap is MAX_BUFFERED_LEN (accumulated bytes), NOT
    // MAX_BODY_LEN (one frame's declared body). ...
    if (remainder.length > MAX_BUFFERED_LEN && !beginsWithPlausibleFrame(remainder)) {
      // ... desync recovery ...
    }
  }
}
```
`text-protocol.ts`'s own cap must be sized against real text-command output
(Phase 39's fixture batch, `FIXTURE_COUNT: 12`), not copied verbatim from the
binary protocol's constant — re-derive it, don't reuse the number.

**Never-throw / refuse-a-second-connect discipline:** `stock-protocol.ts`'s
own `WR-13(b)` comment (cited near line 2006-2015) documents a fixed prior bug
where a second `connect()` over a still-live socket silently leaked the
previous socket and its listeners. `text-protocol.ts` must route any
reconnect attempt through an explicit `disconnect()` first — same discipline,
new file.

**Prompt regex pattern (from throwaway Phase 39 evidence — copy the pattern
only, this file is explicitly not tracked source and is not an analog to
import from):**
```javascript
// Source (throwaway, do not import): .planning/phases/39-.../evidence/textmon-probe-client.mjs:43
export const PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;
```
Anchor at the buffer's true tail, decode once (after the full frame is
assembled, never per-chunk — Pitfall 5's UTF-8 multi-byte splitting risk),
and require a quiescence window before accepting a tail match as final
(Pitfall 2 — the one genuinely open design question in this phase).

**Security note to carry into the header comment:** `broker-launch.mts:371`'s
existing bind-widening warning is this project's precedent for how a
text-monitor security caveat is worded:
```typescript
// Source: src/mcp/vice/broker-launch.mts:371
`vice-broker: stock text (-remotemonitor) monitor bind widened to ${host} -- VICE's text monitor `
```

---

### `src/mcp/vice/text-connect.ts` (NEW — service, request-response)

**Analog:** `src/mcp/vice/stock-connect.ts` (git-tracked)

**Narrow structural interface to extend, not duplicate** (`stock-connect.ts:63`,
read this session, verbatim):
```typescript
export interface StockConnectBrokerControl {
  claimMonitor(opts: ClaimMonitorOptions): Promise<ClaimMonitorOutcome>;
  releaseMonitor(opts: ReleaseMonitorOptions): Promise<ReleaseMonitorOutcome>;
}
```
This is a deliberately narrow structural interface over the broker session —
existing tests inject a minimal stub. `D-14`'s `channel: "text"` claim can join
this same interface (extend `ClaimMonitorOptions` with an optional `channel`
field) rather than inventing a parallel claim path for the text socket.

**Lifecycle functions to mirror the shape of, not the body of:**
```typescript
// Source: src/mcp/vice/stock-connect.ts:404, :494, :529
export async function stockConnect({ host, port, targetId, brokerControl, deps = {} }: StockConnectOptions): Promise<StockConnectSession> { ... }
export async function stockDisconnect(session: StockConnectSession): Promise<void> { ... }
export async function stockReconnect(session: StockConnectSession, { lastToolCall = null }: StockReconnectOptions = {}): Promise<StockConnectSession> { ... }
```
Per Open Question 2 (RESEARCH.md), default to **no** `textReconnect()` unless
implementation surfaces a concrete need — treat an unexpected text-socket
close as a fatal error for the session (matching `D-13`'s "held for the
session's lifetime" framing), not something to silently reconnect. `text-connect.ts` claims via `channel: "text"` and never dials a raw host/port
directly outside the claim/grant flow (mirrors `stockConnect()`'s own
claim-before-dial discipline, documented in `HeldLease`'s header comment
below).

**`HeldLease` — the type `text-connect.ts` reads `remoteMonitorPort` off of**
(`vice-broker-client.ts:757`, read this session, verbatim):
```typescript
export interface HeldLease {
  host: string;
  port: number;
  targetId: string;
  brokerControl: BrokerControlSession;
  epochFile: string;
  // ... supervisorDir and siblings follow
}
```
`D-15` adds `remoteMonitorPort: number` (mandatory on a stock grant per
`D-16`, absent on a fork grant) alongside these existing fields — same
pattern as `epochFile`'s own "NOT optional" doc-comment discipline
(`vice-broker-client.ts`, read this session): a field whose absence would
silently break a downstream consumer must be documented as non-optional in
its own header comment, not left to infer from the type.

---

### `src/mcp/vice/channel-lock.ts` (NEW — utility, event-driven)

**No analog exists in this codebase — confirmed by direct search this
session** (see § No Analog Found for the full negative-result record). Build
fresh per `D-07`, following these codebase-wide conventions found in the
closest partial analogs:

**Refusal-wording register to copy** (`broker-control.mts:294-295`, read this
session, verbatim — this is the load-bearing precedent for `D-06`'s
"never suggest the emulator itself has stopped answering" requirement):
```typescript
// Source: src/mcp/vice/broker-control.mts:294-295
// CR-03: the one refusal wording for a target-naming op whose `target_id` is
// not the grant the asking connection itself holds. Deliberately worded as an
// authorisation refusal and NOT as an ownership conflict between two
// legitimate holders (`monitor_owned`, which names a holder) and never as an
// emulator fault -- see attachControlProtocol()'s own ownsTarget() comment,
// and T-02-18's prohibition on wedge/hang vocabulary in this file's
// monitor-op refusals.
const MONITOR_OWNERSHIP_DENIAL =
  "monitor_claim/monitor_release may only target the grant this connection itself holds";
```
The `monitor_owned` refusal handler beside it (`broker-control.mts` around
line 824, read this session) is the fuller worked example — it names the
holder explicitly:
```typescript
} else if (outcome.code === "monitor_owned") {
  // Ownership conflict, named by holder -- deliberately worded to
  // never suggest the emulator itself has stopped answering
  // (T-02-18; the plan's own grep gate polices this).
```
`channel-lock.ts`'s own timeout-expiry refusal text — "the other channel holds
halt authority, held Ns for `<operation>`" per `D-06` — should be modelled on
this exact register: factual, holder-named, never implying a hang.

**Module-header convention to follow** ("single seam per concern", declared
in a header stating what the file is the ONE place for and what NOT to do —
this project's standing pattern, e.g. `stock-dispatch.ts`'s own header
sentence "THE ONE PLACE the stock tool surface is defined and dispatched",
confirmed present in that file). `channel-lock.ts`'s header should state
symmetrically: this is the ONE place the cross-channel mutex, its FIFO queue,
its holder record, and its refusal text live — do not re-derive any piece of
it in `stock-dispatch.ts` or `text-protocol.ts`.

**Testing split to honor** (`D-08`): unit-test the primitive fully (FIFO
ordering, timeout expiry, release-on-throw, holder-record contents) with
`node --test channel-lock.test.ts`, no emulator involved — this is a pure
primitive, unlike `vice-sync.ts`'s checkpoint-wait functions, which
`CLAUDE.md` § *Testing* documents as deliberately NOT unit-tested. Do not let
that exemption bleed into excusing an untested lock.

---

### `src/mcp/vice/stock-diagnose.ts` (MODIFIED — D-09/D-10/D-11 evidence field)

**Analog:** itself — `jamObserved`'s existing always-present evidence-field
shape, at the same file's own `diagnoseVerdictResult()` (`stock-diagnose.ts:760`,
read this session, verbatim — **correction versus `41-CONTEXT.md`'s citation
`:754-771`: `jamObservedFor()` is imported from `stock-runstate.ts:138`, not
defined in this file; `diagnoseVerdictResult()` itself starts at line 760**):
```typescript
function diagnoseVerdictResult(
  session: StockConnectSession | null,
  verdict: StockDiagnoseVerdict,
  evidence: Record<string, unknown>,
  report: string,
): StockToolResult {
  const { machinePaused, machinePausedSource } = deriveMachinePaused(session);
  const jamObserved = session === null ? false : jamObservedFor(session.client);
  const payload: Record<string, unknown> = {
    verdict,
    evidence: { ...evidence, jamObserved },
    report: jamObserved ? report + JAM_OBSERVED_NOTE : report,
    machinePaused,
    machinePausedSource,
  };
  return session ? stockAnswer(session.client, payload) : derivedAnswer(payload);
}
```
`D-09`'s contention evidence field must be derived and spread into `evidence`
in exactly this shape — a value computed once per call, always present (never
conditionally omitted), joining `evidence: { ...evidence, jamObserved,
contention }`.

**The frozen five-verdict enum this must NOT touch** (`stock-diagnose.ts:406-413`,
read this session, verbatim):
```typescript
export const STOCK_DIAGNOSE_VERDICTS = Object.freeze([
  "restarted",
  "checkpoint_trap",
  "wedged",
  "monitor_held_elsewhere",
  "live",
] as const);

export type StockDiagnoseVerdict = (typeof STOCK_DIAGNOSE_VERDICTS)[number];
```
Confirmed still exactly five, still frozen, still with the explicit
never-add comment ("The verdict set is EXACTLY the five of D-03") directly
above it in-file.

**The `wedged` derivation call site `D-10` must guard** (`stock-diagnose.ts`
around line 976, read this session, verbatim):
```typescript
return diagnoseVerdictResult(
  session,
  "wedged",
  { bracketsRun: 2, bracket1: serializeBracket(bracket1), bracket2: serializeBracket(bracket2) },
  renderStockWedgedReport(bracket1, bracket2),
);
```
`D-10`'s guard must sit **before** this call is reachable — consult
`channel-lock.ts`'s holder record earlier in the same function's control flow
and short-circuit to `live` with contention evidence (`D-11`) rather than
letting execution reach this `wedged` return at all.

**Manifest's `required` list to extend** (`tools-manifest.stock.json:3641-3646`,
read this session — `jamObserved` is listed under `"required"` inside
`evidence`'s schema): the new contention field should join this same
`required` array so it, too, can never be silently omitted.

---

### `src/mcp/vice/broker-control.mts` (MODIFIED — `grant` gains `remoteMonitorPort`, `monitor_claim` gains `channel`)

**Analog:** itself — the existing `monitor_claim` handler and `grant` shape.

**`grant` response shape to extend** (`broker-control.mts:242`, read this
session, verbatim):
```typescript
| { kind: "grant"; id: string; port: number; url: string; epoch_file: string; supervisor_dir: string }
```
`D-15` adds `remoteMonitorPort` here, beside `port`/`url`/`epoch_file`/
`supervisor_dir` — same discriminated-union member, one more field.

**`monitor_claim` handler to extend with the `channel` discriminator**
(`broker-control.mts`, read this session, verbatim — the full handler body,
confirmed at the location grep found, immediately after the `else if
(req.op === "monitor_claim")` branch):
```typescript
} else if (req.op === "monitor_claim") {
  const targetId = typeof req.target_id === "string" ? req.target_id : "";
  if (targetId === "") {
    writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "monitor_claim requires target_id" });
    return;
  }
  if (!ownsTarget(targetId)) {
    writeLine(socket, { kind: "error", code: "denied" as ControlErrorCode, message: MONITOR_OWNERSHIP_DENIAL });
    return;
  }
  const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("claim");
  const outcome = opts.onMonitorClaim(requestId, targetId);
  if (outcome.ok) {
    writeLine(socket, { kind: "monitor_claimed" });
  } else if (outcome.code === "monitor_owned") {
    // Ownership conflict, named by holder -- deliberately worded to
    // never suggest the emulator itself has stopped answering
    ...
```
`D-14` adds a `channel: "binary" | "text"` parameter read alongside
`target_id`, threaded into `opts.onMonitorClaim(requestId, targetId, channel)`
and ultimately into `broker-state.mts`'s `monitorClient` field (see next
entry) — extend this exact call chain, do not build a parallel claim op.

**`StatusInstanceEntry` — confirmed NOT extended** (`broker-control.mts:97-106`,
read this session, verbatim):
```typescript
export interface StatusInstanceEntry {
  port: number;
  url: string;
  state: string;
  reason: string;
  epoch: number | null;
  hasMonitorClient: boolean;
}
```
`D-15` is explicit that this type stays as-is — `remoteMonitorPort` travels
only on `grant` and `HeldLease`, never here.

---

### `src/mcp/vice/broker-state.mts` (MODIFIED — `channel` discriminator on `monitorClient`)

**Analog:** itself — the existing `monitorClient` field and its own banner
comment, which must be corrected in the same commit (Pitfall 8).

**Field to extend** (`broker-state.mts:121,149`, read this session, verbatim):
```typescript
monitorClient?: { grantId: string; claimedAt: number; pid: number | null };
// ...
remoteMonitorPort?: number;
```
`D-14` adds a `channel: "binary" | "text"` field inside the `monitorClient`
object literal type.

**Stale banner comment that MUST be corrected, not left standing**
(`broker-state.mts:136-144`, read this session, verbatim):
```typescript
// MONITOR-OWNERSHIP DECISION, stated out loud here so Phase 7 finds it:
// `monitorClient` above stays a SINGLE field per instance, keyed by
// ...
// discriminator to `monitorClient` -- do NOT add one speculatively here.
```
This sentence names "Phase 7" as the future home of the discriminator; the
milestone has since renumbered this work to Phase 41. `41-CONTEXT.md` and
`RESEARCH.md` § *Pitfall 8* both flag this as required correction, not
optional cleanup — rewrite the comment to reflect that Phase 41 is the phase
adding the discriminator, in the same commit that adds the field.

---

### `src/mcp/vice/broker-launch.mts` (MODIFIED — D-16 mandatory text port, folded-todo warm-floor removal)

**Analog:** itself — `acquirePortAndLaunch()`'s existing degrade path, which
`D-16` removes.

**Degrade path to remove** (`broker-launch.mts:690-691`, read this session,
verbatim):
```typescript
`vice-broker: second (-remotemonitor) port allocation failed (${remoteResult.reason}) -- ` +
  `launching WITHOUT -remotemonitor; nothing in Phase 3 dials the text-monitor port anyway`,
```
This log message and the code path producing it must be replaced with a hard
acquire failure — no launch proceeds without a bound text port for stock. The
string itself is stale evidence of the removed behaviour and must not survive
verbatim anywhere in the diff (Pitfall 8).

**`-remotemonitor` argv construction — confirmed stock-only, unaffected in
shape** (`broker-launch.mts:377`, read this session, verbatim):
```typescript
args.push("-remotemonitor", "-remotemonitoraddress", `ip4://${host}:${remoteMonitorPort}`);
```
This append stays exactly as-is; `D-16`'s change is entirely in whether a
failed port allocation degrades (removed) versus fails the acquire (added) —
not in this argv line itself. Confirmed **not** touched for fork launches
(the fork branch of this same function has no `-remotemonitor` append to
remove or add).

**Bind-widening security warning — precedent for any new text-channel
caveat wording** (`broker-launch.mts:371`, read this session, verbatim):
```typescript
`vice-broker: stock text (-remotemonitor) monitor bind widened to ${host} -- VICE's text monitor `
```

---

### `src/mcp/vice/vice-broker-client.ts` (MODIFIED — `HeldLease` gains `remoteMonitorPort`, `claimMonitor()` gains `channel`)

**Analog:** itself — `MonitorOwnershipError`, `HeldLease`, `claimMonitor()`.

**`MonitorOwnershipError`** (`vice-broker-client.ts:685`, read this session —
confirmed at line 685, not `:671` as `41-CONTEXT.md` cited; drift already
corrected in `RESEARCH.md` and reconfirmed here):
```typescript
export class MonitorOwnershipError extends ViceError {
```

**`claimMonitor()`** (`vice-broker-client.ts:1046`, read this session —
confirmed at line 1046, not `:1037` as `41-CONTEXT.md` cited):
```typescript
async function claimMonitor(opts: ClaimMonitorOptions): Promise<ClaimMonitorOutcome> {
```
`D-14` adds an optional `channel?: "binary" | "text"` field to
`ClaimMonitorOptions`, threaded straight through to the wire request built
inside this function.

**`HeldLease`'s own "NOT optional" doc-comment discipline** to copy for the
new `remoteMonitorPort` field (`vice-broker-client.ts`, the `epochFile` field
comment, read this session, verbatim):
```typescript
/** CR-06: THIS instance's own epoch.json, in the CONSUMER's view of the
 * filesystem ... NOT optional: with it absent, stockReconnect() reports a
 * FALSE MachineRestartedError on every transient socket drop ...
```
`remoteMonitorPort` should carry an equally explicit doc comment stating it
is **mandatory on a stock grant, absent on a fork grant** — the same
discrimination pattern this project already applies elsewhere in this exact
file, not left to be inferred from a `?` in the type.

---

### `src/skills/vice-wedge-triage/SKILL.md` (MODIFIED — contention row + MEDIUM provenance row)

**Analog:** itself — the existing verdict → response table and provenance
table.

**Verdict table location** (`SKILL.md:12-16`, `:61`, `:66`, read this
session, verbatim header row and two representative existing rows):
```
| State | Cheap tell | Safe action |
|---|---|---|
...
| `live` | Cycles advanced | Resume and carry on. Suspect your own checkpoint conditions, not the emulator — **unless `evidence.jamObserved` is true** (below) |
...
| `wedged` | Two brackets, zero cycles, no epoch change | Last resort: `vice_recycle` with a real reason — **but check `evidence.jamObserved` first** (below) |
```
`D-09`'s contention row should follow this exact three-column shape and sit
adjacent to the `live`/`wedged` rows it qualifies, cross-referencing a new
`evidence.contention` section modelled directly on the existing
`### evidence.jamObserved — read it before acting on wedged or live` section
(`SKILL.md:69-86`, confirmed present, read this session) — same heading
pattern, same "read before acting" framing, same "never a reason to X"
closing sentence style (`"jamObserved: true is never a reason to recycle"` at
`SKILL.md:84`).

**Provenance table — the MEDIUM row's placement and register**
(`SKILL.md:217-236`, read this session, verbatim final row, showing the
established "confidence, basis stated honestly" pattern the new row must
match):
```
| Stock's five-verdict path (`restarted`, `checkpoint_trap`, `wedged`, `monitor_held_elsewhere`, `live`) and its bounded `vice_run_until` | Unit-proven (40/40 `stock-diagnose.test.ts`, 21/21 `stock-run-until.test.ts`, 07-15/07-14). **Live-proven** against genuine `/usr/bin/x64sc` (VICE 3.9) and `/usr/local/bin/x64sc` (VICE 3.10) for `live` ... | HIGH for the five verdicts ...; MEDIUM for the run_until honesty fields only, which stay unit-only |
```
`D-12`'s new row must explicitly state its single-binary basis (genuine
stock `/usr/bin/x64sc`, VICE 3.9 only) and grade **MEDIUM**, following this
same table's own established convention of stating exactly what was measured
rather than implying broader coverage — do **not** phrase it to read like the
existing HIGH, two-binary rows above it.

## Shared Patterns

### Single seam per concern
**Source:** `stock-dispatch.ts`'s own header sentence declaring itself "THE
ONE PLACE the stock tool surface is defined and dispatched" (confirmed
present in-file this session).
**Apply to:** `channel-lock.ts` (owns the mutex, queue, holder record, and
refusal text — nothing else may re-derive any piece of it) and
`text-protocol.ts` (owns the text wire's framing — `stock-dispatch.ts` never
re-implements framing logic locally).

### Refusal wording that never implies a hang
**Source:** `broker-control.mts:294-295` (`MONITOR_OWNERSHIP_DENIAL`) and the
`monitor_owned` handler beside it (excerpted above under `channel-lock.ts`).
**Apply to:** `channel-lock.ts`'s `D-06` timeout-expiry refusal;
`text-connect.ts`'s `D-14` second-client claim refusal. Both must name the
holder and (for `channel-lock.ts`) the hold duration, and must never use
wedge/hang vocabulary — this project's `T-02-18` grep gate polices this
register elsewhere and the same discipline should be assumed to extend here.

### Always-present, never-conditionally-omitted evidence field
**Source:** `stock-diagnose.ts:760` (`diagnoseVerdictResult()`'s
`jamObserved` derivation and spread) plus `tools-manifest.stock.json`'s
`required: ["jamObserved", ...]`.
**Apply to:** `D-09`'s contention evidence field on `vice_diagnose` — derive
once per call, spread unconditionally into `evidence`, add to the manifest's
`required` array.

### Buffer accumulation, never per-chunk decode
**Source:** `stock-protocol.ts:2153` (`#onData()`'s concat-then-parse-then-
cap-on-remainder discipline, with the `WR-03` bug comment documenting the
mistake this pattern already fixed once on the binary side).
**Apply to:** `text-protocol.ts`'s own accumulation loop — concat raw
`Buffer`s, decode once at the end, cap on the parsed remainder using a size
re-derived from real text-command output (not copied from the binary
protocol's constant).

### `.mts` → committed `resources/*.mjs` regeneration
**Source:** `build.ts` + `resources-sync.test.ts` (project-wide convention,
not file-specific).
**Apply to:** any plan touching `broker-state.mts`, `broker-control.mts`, or
`broker-launch.mts` — `node build.ts` must run and the regenerated
`resources/*.mjs` must be committed in the same commit, or
`resources-sync.test.ts` reds.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/mcp/vice/channel-lock.ts` | utility (async mutex primitive) | event-driven (FIFO acquire/release/timeout) | Explicitly confirmed absent this session: no async mutex exists anywhere in this tree. The only prior single-flight queue died with the retired analyser (`module-classification.ts:134-136,:780-785`, named and explicitly not extracted per `RESEARCH.md` § *Architecture Patterns*, "What is NOT reusable"). `RESEARCH.md`'s own § *Don't Hand-Roll* table also considered and rejected the npm package `async-mutex` as an alternative — locked decision `D-07` requires a hand-built primitive because it must also own a holder record no generic library exposes. Build fresh, following the shared patterns above (refusal wording, single-seam header) rather than a structural analog. |

## Metadata

**Analog search scope:** `src/mcp/vice/*.ts`, `src/mcp/vice/*.mts`,
`src/mcp/vice/tools-manifest.stock.json`, `src/skills/vice-wedge-triage/SKILL.md`
— all confirmed git-tracked via `git ls-files` this session (no
`.gsd/capabilities/` mirror paths involved; this repo has no such mirror tree
for this module family).
**Files scanned:** 10 modified/analog source files + 1 skill doc, each read
directly this session (not taken on faith from `41-CONTEXT.md`/`RESEARCH.md`'s
own citations).
**Pattern extraction date:** 2026-09-08
