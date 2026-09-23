# G-64-1: handle-only authority for `attach` and `transfer`

Phase 64, plan 64-08 (gap closure, G-64-1). This records the primary-cause fix
for UAT gap G-64-1 — every `vice_*` tool call through the real `vice-proxy.ts`
over stdio failed with `"stock handshake failed (vice: missing or invalid
control token)."` — and the reversal of a Phase 63 security mitigation that
fix required.

## What changed and where

`attach` and `transfer` are now dispatched in `broker-control.mts`'s
`handleLine()` **ahead of** the per-boot control-token gate, by their
broker-minted handle alone:

- `attach` (Phase 63, SESS-02) — dispatched immediately after the `hello` arm,
  before `tokensMatch()` runs. The handle comparison itself is untouched: it
  still lives in `vice-broker.mts`'s `handleRelayAttach()` (length check before
  `timingSafeEqual`, second-attach refusal, handle cleared on relay death).
- `transfer` (Phase 64, XFER-04) — dispatched beside `attach`, also ahead of
  the gate. The unknown-handle refusal and the in-flight guard stay in
  `vice-broker.mts`'s `handleFileTransfer()`.

Only the dispatch **position** moved. Neither handler's own check was widened,
narrowed or bypassed — Task 2's `broker-control.test.ts` cases prove the
second-attach refusal is reached with no token presented at all, and that the
transfer callback's own refusals (`bad_request`, `internal`) are unchanged.

The client-side empty-token parameters this defect traced through
(`StockDispatchDeps.controlToken`, `defaultDialMonitorSocket()`/
`defaultTransferFile()`'s `controlToken` plumbing in `stock-connect.ts`) are
left in place by this plan — they are dead weight now, not a defect, since the
ops they were meant to authenticate no longer read them. Plan 64-09 removes
them.

## Why route (b) and not threading the token through

The diagnosis (`.planning/debug/vice-proxy-control-token-handshake.md`)
recorded two candidate fixes: (a) thread the per-boot token from `broker.json`/
`BrokerControlSession` into `StockDispatchDeps`/`StockConnectDeps` so the relay
and transfer dials present it, or (b) stop requiring it for these two ops and
authenticate by the handle alone. The orchestrator chose route (b), and it is
binding on this plan.

Route (a) is rejected because it re-entrenches a credential the owner has
already decided to remove. REQUIREMENTS.md's settled design decision 5 states
it without qualification:

> **Bind and auth — `PKG-04` is REVERSED.** Loopback plus **enumerated** bridge
> gateways; never `0.0.0.0`; the per-boot token is **dropped**. A hardcoded
> `172.17.0.1` is wrong — a custom Docker network has its own gateway.

And ROADMAP.md's milestone-open section restates it as a standing prohibition
on every phase in this milestone, this one included:

> **There is no token and no credential of any kind, and the bind is never
> `0.0.0.0`.** ... the per-boot token is **dropped**, because narrowing removed
> its job. **No phase may plan an auth mechanism, a credential file or a
> wildcard bind.**

Threading the token through `vice-proxy.ts`'s `dispatchStockFor()` — the fix
the original todo's own "Do NOT" section left as an open question — would have
been exactly that: a new phase-64 plan wiring reliance on a credential the
owner already decided to delete and that Phase 66 is scheduled to remove
outright. The handles `monitor_claim` and `stage_file` already mint, over a
control session that is STILL token-gated, do not have this problem: they are
per-claim/per-stage, not per-boot, and nothing about relying on them plans a
new credential.

## What it reverses, quoted

`63-SECURITY.md`'s threat register recorded two mitigations this plan
reverses:

- **T-63-01**: "`monitor_claim` mints a 16-byte random handle
  (`vice-broker.mts:1019`); **attach requires the per-boot control token AND a
  length check *before* `timingSafeEqual`** (`vice-broker.mts:1289-1292`). A
  bare target id is never trusted. A second attach on an attached channel is
  refused."
- **T-63-05**: "The handshake tag is a self-declared connection label answered
  ahead of the token gate and carries no authority. **Every authority decision
  is the control token plus the per-claim handle.**"

And `broker-control.mts` itself, before this plan, stated the same rule for
`transfer` (Phase 64, plan 64-02): the op "sits AFTER the token gate, like
every op except `hello`" (XFER-04, T-63-01 precedent).

All three are now false as written. A dated Superseded note pointing at this
file has been appended to `63-SECURITY.md`, below its threat register; the
historical rows themselves are left unedited, because they accurately recorded
what Phase 63 shipped at the time.

## The replacement mitigation, itemised

| Control | Owner | Status |
|---|---|---|
| 16-byte random handle, minted only by `monitor_claim` (relay) or `stage_file` (transfer) | `vice-broker.mts`'s `handleMonitorClaim()` / `handleStageFile()` | unchanged — both callers still require the per-boot token and, for `stage_file`, ownership (`ownsTarget()`) |
| Length check before `timingSafeEqual()` on the presented handle | `vice-broker.mts`'s `handleRelayAttach()` | unchanged |
| Second-attach-on-an-attached-channel refusal | `vice-broker.mts`'s `handleRelayAttach()` | unchanged — proven in Task 2 reachable with no token presented |
| Handle cleared on relay death | `vice-broker.mts`'s relay-death teardown | unchanged |
| Unknown-handle refusal for `transfer` | `vice-broker.mts`'s `handleFileTransfer()` | unchanged |
| In-flight guard for `transfer` | `vice-broker.mts`'s `handleFileTransfer()` | unchanged |
| Staging removed at session close | `broker-transfer.mts`'s staging teardown | unchanged, out of this plan's `files_modified` |
| Bind narrowed to loopback plus enumerated bridge gateways, never the wildcard address | `broker-control.mts`'s `attachControlProtocol()`/bind set | unchanged; now the first line of defence for `attach` and `transfer` too, exactly as it already was for `hello` |

## Residual risk accepted

A refused pre-gate op (a bad `attach` or `transfer`) no longer destroys the
connection the way a token-gate refusal does — a caller may therefore present
several handles on one connection before it gives up, where a token failure
used to terminate the socket outright. This is judged infeasible to exploit: a
16-byte handle is a 128-bit space, and per-client rate limiting is explicitly
listed Out of Scope in REQUIREMENTS.md's own table. Any process that can reach
a bound address (loopback, or an enumerated bridge gateway) and learns a live
handle could attach or transfer with it — exactly the same as before this
plan, when any process able to read `broker.json` could learn the per-boot
token and do the same for every op, not merely these two. The narrowed bind is
therefore no weaker a boundary than it already was; the difference is that a
guessing attempt against a 128-bit handle space is not meaningfully slowed by
the connection surviving a wrong guess, and 128 bits already makes guessing
infeasible regardless.

## What did NOT change

Every op other than `attach` and `transfer` — `acquire`, `release`, `recycle`,
`status`, `host_state`, `monitor_claim`, `monitor_release`, `host_tool`,
`operation`, `stage_file` — still requires the per-boot control token, checked
before any state is read or written, exactly as before this plan.
`broker.json` still exists and is still the token's only distribution
channel; removing either is explicitly Phase 66's job (RM-02: "The
`broker.json` discovery record and every reader of it are deleted"), not this
plan's. Phase 66's own Success Criterion 2 states it as the exit bar this
plan does not attempt to clear:

> **The discovery record and the second route are gone.** `broker.json` is
> neither written nor read anywhere and every reader of it is deleted ...
> (RM-02, RM-03).

Flagged explicitly, because it is easy to miss: **no `RM-*` requirement names
the removal of the per-boot token gate itself** — RM-02 names deleting
`broker.json` (the token's distribution channel) and RM-03 names the
host/container route, but neither says "and the token check on the surviving
ops goes too." Phase 66's planner must name that removal explicitly when it
happens rather than assume it falls out of RM-02 for free; deleting
`broker.json` without also deciding what happens to `tokensMatch()`'s callers
would leave every one of the eight still-gated ops permanently refusing
`unauthorized`, since nothing would ever supply a token again.

## The latent port note from the diagnosis

The diagnosis recorded a second, independent finding: the relay and transfer
dials ignored `broker.json`'s `control_port` and the `VICE_BROKER_CONTROL_PORT`
environment variable, always dialling the fixed default port regardless of
what the broker was actually told to bind. This plan closes the **environment**
half of that: `broker-endpoint.ts`'s new `resolveEndpointPort()` is now the one
default-port resolver for `dialBrokerEndpoint()`, `dialMonitorRelay()` and
`dialFileTransfer()` alike, and it honours `VICE_BROKER_CONTROL_PORT` — the
same variable `broker-control.mts`'s own `resolveControlPort()` binds the
listener on. The **`broker.json` `control_port`** half is deliberately left
open: `broker-endpoint.ts` must never read a file (see that module's own
header "WHAT NOT TO DO" list — this is D-06/D-07's whole premise, a client
that finds the broker with nothing on disk), so a resolver that consulted
`broker.json` would violate that boundary. This gap disappears on its own once
RM-02 (Phase 66) moves the control session onto the fixed endpoint and
`broker.json` stops existing to disagree with the environment variable in the
first place.

## The proof

- `G-64-1 tracer: vice_ping through the real proxy reaches a handle-authenticated relay attach, end to end` (`vice-proxy.test.ts`) — binary relay, through the real `vice-proxy.ts` over stdio.
- `G-64-1 transfer: vice_snapshot_save then vice_snapshot_load complete through the real proxy in both directions, with no broker-side path in either result` (`vice-proxy.test.ts`) — both transfer directions, through the real proxy.
- `G-64-1 text: vice_warp_set completes through the real proxy over the text relay, authenticated by its own handle` (`vice-proxy.test.ts`) — the text channel, through the real proxy.
- `attach: a channel already attached is refused by the REAL handleRelayAttach(), reached with no token at all` (`broker-control.test.ts`) — proves the second-attach refusal (T-63-01's surviving control) is unaffected by the gate's removal.
- `transfer: a wrong token, and a request with no token field at all, both still reach onFileTransfer -- G-64-1 route (b), the token is neither required nor read for this op` (`broker-control.test.ts`).
- `after a refused attach and a refused transfer on one connection, a token-less status line on that SAME connection is still answered unauthorized -- a pre-gate refusal never unlocks a gated op` (`broker-control.test.ts`) — proves every other op's gate is unaffected.
- `stage_file: unauthorized when the token is wrong, before the callback is ever invoked` (`broker-control.test.ts`) — proves `stage_file` (the handle's own mint site) is still token-gated.
- `resolveEndpointPort: ...` and `dialBrokerEndpoint with no port option reaches a hello-answering listener on the port named by VICE_BROKER_CONTROL_PORT` (`broker-endpoint.test.ts`) — the latent port defect, environment half, closed.
