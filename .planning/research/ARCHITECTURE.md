# Architecture Research

**Domain:** VICE emulator control plane — text-monitor second channel, dual-channel scheduling, runtime-evidence store, host-binary executor
**Researched:** 2026-09-06
**Confidence:** HIGH for what exists today (verified against source, line-cited); MEDIUM for the new-module shapes proposed (design proposal, not yet built); LOW for anything downstream of the unresolved coexistence probe (explicitly gated, see below)

This is not a general-domain survey. It is an integration design for a specific, mature codebase, answering the five questions the milestone context poses, each grounded in the actual files under `src/mcp/vice/`.

## Standard Architecture

### System Overview — today, plus where v0.9.0's new pieces attach

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Claude Code (container)                                                          │
│  skills/*/scripts/*.mjs  ─────────────────────────────┐                          │
│  vice_* / anno_* tool calls ─┐                         │ (NEW) host_tool RPC     │
└───────────────────────────────┼─────────────────────────┼──────────────────────────┘
                                │                         │
                                ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ vice-proxy.ts (stdio MCP entry)                                                   │
│   buildBackendAwareTool() ──► stock-dispatch.ts ──► stock-*.ts (binary monitor)    │
│   buildViceTool() (proxy-local) ──► anno-tools.ts ──► anno-store.ts (SQLite)       │
│   (NEW) buildBackendAwareTool() ──► text-dispatch.ts ──► text-protocol.ts          │
└───────────────┬─────────────────────────────┬───────────────────────┬────────────┘
                │ TCP: acquire/release/        │ TCP: claim/dial       │ TCP: (NEW)
                │ recycle/monitor_claim/        │ BINARY monitor        │ namespaced
                │ (NEW) host_tool               │ socket                │ TEXT monitor
                │                               │                       │ socket
                ▼                               ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Host broker daemon (vice-broker.mts + broker-*.mts, compiled to resources/*.mjs)  │
│  buildViceArgs(): appends -binarymonitor AND -remotemonitor to every stock launch  │
│  broker-state.mts: InstanceRecord.remoteMonitorPort (allocated, unclaimed today)   │
│  broker-control.mts: monitor_claim/monitor_release (binary only today), host_tool  │
└───────────────┬─────────────────────────────┬───────────────────────┬────────────┘
                │ launches                     │                       │
                ▼                              ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ x64sc (host): BinaryMonitorServer @ port A        MonitorServer (text) @ port B    │
│               both serviced from the SAME monitor_vsync_hook() — single-threaded   │
│  (NEW, host-side, no VICE code change) c1541 / petcat / cartconv — separate,       │
│  stateless child processes, spawned per host_tool request, NOT part of x64sc       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Two structural facts anchor everything below:

1. **The broker already provisions the text monitor and refuses to touch it.** `broker-launch.mts`'s `buildViceArgs()` appends `-remotemonitor -remotemonitoraddress ip4://<host>:<remoteMonitorPort>` to every stock launch when `remoteMonitorPort` is supplied (documented at `broker-launch.mts` in the `buildViceArgs()` doc comment, plan 03-04/D-13), and `broker-state.mts`'s `InstanceRecord.remoteMonitorPort` (~line 146) records the allocated port. `InstanceRecord.monitorClient` (~line 121) is documented, in its own header comment (~lines 137–144), as the field that should gain a `channel: "binary" | "text"` discriminator once a text client exists — **it does not have one today**, and nothing dials the port.
2. **The binary monitor's client stack is a two-file pattern, not one.** `stock-protocol.ts` owns the wire bytes (`ViceMonitorClient`, frame constants, `net.Socket`), and `stock-connect.ts` owns the handshake sequence: claim the monitor from the broker over the control socket **before** any TCP dial, then open the raw socket, assert `api_version`, read build identity, settle capabilities once per binary (`stock-connect.ts`'s own header, lines 1–30). The text channel needs its own version of exactly this pair — not a modification of either file, because the wire format is unrelated (line-oriented prompts, not 11/12-byte binary frames) and mixing the two would violate "`node:net`/binmon bytes in exactly one module" (`.planning/codebase/ARCHITECTURE.md` § Architectural Constraints).

### Component Responsibilities — new vs. modified, named by file

| Component | New / Modified | File | Responsibility |
|---|---|---|---|
| Text wire protocol | **NEW** | `src/mcp/vice/text-protocol.ts` | The one place that owns the text-monitor's line-oriented framing: send a command, read until the prompt/terminator, no other module touches this socket's bytes. Mirrors `stock-protocol.ts`'s role, not its code. |
| Text connect/handshake | **NEW** | `src/mcp/vice/text-connect.ts` | Claims the text channel from the broker (extends `monitor_claim`), reads `remoteMonitorPort` off the lease, dials, and hands back a ready `TextMonitorClient`. Mirrors `stock-connect.ts`'s sequencing, not its code (no `api_version`/`VICE_INFO` — those are binary-monitor concepts). |
| Dual-channel lock | **NEW** | `src/mcp/vice/monitor-lock.ts` (name TBD by probe outcome) | The single seam serializing any halt-issuing command across both channels. Shape (in-process mutex vs. broker-level lease) is decided by the probe — see below. |
| Text dispatch | **NEW** | `src/mcp/vice/text-dispatch.ts` | Stock-only tool surface for the 5 commands the probe confirmed (`memmapshow`/`memmapzap`, `prof`, `chis`, `bt`, `io`, plus `warp`/`sw`/`device`), parallel in shape to `stock-dispatch.ts` but far narrower. |
| Parser modules | **NEW** | `src/mcp/vice/text-parse-memmapshow.ts`, `text-parse-prof.ts`, `text-parse-chis.ts`, `text-parse-bt.ts`, `text-parse-io.ts` | One module per text format; pure `parse(raw: string): T[]`; no socket, no timing. |
| Fixture pinning | **NEW** | `src/mcp/vice/fixtures/textmon/`, `src/mcp/vice/textmon-fixtures.ts` | Mirrors `binmon-fixtures.ts`'s `REQUIRED_PROVENANCE_KEYS` discipline (`capturedFrom`, `viceVersion`, `capturedAt`, `command`, `synthetic`) for text-format fixtures. |
| Broker port surfacing | **MODIFIED** | `vice-broker-client.ts`'s `HeldLease` (line 757–759, currently `{ grantId, port, claimedAt }` with no text-port field), `broker-control.mts`'s acquire/status response builders | The container-side client has **no route today** to learn `remoteMonitorPort` — it is recorded host-side only (`broker-state.mts`) and never serialised into any control-plane response. This must be added before `text-connect.ts` can dial anything. |
| Monitor claim | **MODIFIED** | `broker-state.mts`'s `InstanceRecord.monitorClient` (~121), `broker-control.mts`'s `monitor_claim`/`monitor_release` handling (~811–863), `vice-broker-client.ts`'s `claimMonitor()`/`releaseMonitor()` (~1037–1093) | Gains the anticipated `channel: "binary" | "text"` discriminator. Whether ownership stays per-socket or becomes a single cross-channel "halt authority" is the probe's decision, not a free choice. |
| Runtime evidence schema | **NEW** | `anno-store.ts`'s `DDL` string (currently `anno_meta`/`anno_range`/`anno_label`/`anno_comment`/`anno_scope`/`anno_enum`/`anno_enum_usage`/`anno_xref`/`anno_snapshot`, lines ~246–312) | A new table, same seam, same file — `anno-store.ts` stays the only `node:sqlite` consumer (`anno-seam.test.ts` enforces this structurally). |
| Runtime evidence derivation | **NEW** | `src/mcp/vice/anno-runtime-evidence.ts` | Mirrors `anno-coverage.ts`'s existing `classFromBytes()`/`classFromStore()` pair (lines ~1681, ~1692) with a third `classFromRuntime()`, and the union/report query. A new sibling module, not a growth of `anno-coverage.ts` (a different, already-large concern) and not a growth of `block-class.ts` (which is deliberately a pure 3-valued translator, not a query engine). |
| Runtime evidence tool surface | **NEW** | `anno-tools.ts`'s `ANNO_TOOL_DEFINITIONS` (append) | At minimum an ingest verb (writes parsed observations) and a report verb (joins against the block table). Registered through `buildViceTool()` exactly like every other `anno_*` verb, so it never reaches `forwardToVice()` — no new interception rule needed (satisfied by construction, same as `MCP-02`). |
| Host binaries | **MODIFIED** | `host-tool.mts`'s `HostToolId` union (~139), `HOST_TOOL_IDS` (~141), `HOST_TOOL_ARG_KEYS` (~180), `HOST_TOOL_PATH_ARG_KEYS` (~252), `HOST_TOOL_TIMEOUT_MS` (~1325) | Three new members: `c1541.*`, `petcat.decode`, `cartconv.identify` (or similar per-verb ids — see below). Same seven synchronized edits the file's own header already demands for any new tool. |

## Sub-question 1 — Where does the text client live, and what owns it?

**It lives beside `vice.ts`/`stock-protocol.ts`/`stock-connect.ts`, container-side, in `src/mcp/vice/`.** Not in the broker.

Trace of how the binary client reaches the emulator today, to mirror exactly:

1. The broker (`vice-broker.mts` + `broker-launch.mts`, host-side, `.mts`) launches `x64sc` with `-binarymonitor -binarymonitoraddress ip4://<host>:<port>` and records the port in `broker-state.mts`'s `InstanceRecord`. The broker's job stops at *launch and bookkeeping* — it never speaks the binary-monitor wire protocol itself.
2. The container-side `vice-broker-client.ts` acquires a lease (`acquire`) and, separately, claims exclusive monitor ownership (`monitor_claim`, ~lines 1037–1069) over the **control-plane** TCP socket — a JSON-line protocol, distinct from the binary-monitor wire itself.
3. `stock-connect.ts` (container-side `.ts`, run unbuilt) is the ONE place that, having a successful claim, opens the actual `ViceMonitorClient` (`stock-protocol.ts`) — a **direct TCP dial from the container to the host's allocated port**, not proxied through the broker. `hostpath.ts`/`containerpath.ts` are **not involved** in this dial: those two modules translate filesystem paths crossing the container/host boundary (snapshot files, disk images, ACME sources), not network endpoint resolution. Host reachability for the dial itself is resolved the same way `vice.ts`'s `mcpHost()` resolves it (`VICE_MCP_HOST`/`host.docker.internal`/`127.0.0.1`, `container-guard.mts`-informed) — a **network hostname**, not a path.

The text client mirrors this exactly, as two new sibling files:

- **`text-connect.ts`** — claims the text channel (extends `monitor_claim` with a `channel` field, or a new `monitor_claim_text` op if the probe requires a genuinely separate ownership model — see sub-question 3), reads the allocated `remoteMonitorPort` off the lease, and hands back a connected `TextMonitorClient`.
- **`text-protocol.ts`** — the one module owning the text wire's bytes: write a command line, read until the prompt terminator (VICE's text monitor prints a `(C:$xxxx)` — style prompt; the exact terminator sentinel needs one more live capture to pin, same as the binary protocol's settled facts were pinned in `docs/phase0-binmon-findings.md`).

**Required plumbing gap, found and not yet closed:** `vice-broker-client.ts`'s `HeldLease` interface (line 757–759) is `{ grantId, port, claimedAt }` — no text-port field. `broker-control.mts`'s acquire/status response builders likewise never serialize `InstanceRecord.remoteMonitorPort` to the client. **Neither `remoteMonitorPort` string appears anywhere in `broker-control.mts`, `vice-broker.mts`, or `vice-broker-client.ts` today** (confirmed by grep — zero hits). This is not a design choice to make; it is a small, mechanical, unavoidable prerequisite: the container-side text client has no way to learn which port to dial until this is added.

**hostpath.ts/containerpath.ts implication:** not implicated for the socket connection itself (same as today's binary monitor). They ARE implicated for two adjacent things this milestone touches: (a) any file the parser/evidence layer writes to disk for fixture capture or bulk output must go through `containerpath.ts` on the way back to the container, same as every other host-produced artifact; (b) the host-tool executor's own path arguments (`c1541`/`petcat`/`cartconv` — see sub-question 5), which is a pre-existing, explicit constraint in `.planning/seeds/host-tool-executor.md` constraint #6, unrelated to the text channel.

## Sub-question 2 — The dual-channel controller

**`vice-sync.ts` is the wrong seam to route through, and this is a factual correction to the milestone context, not a stylistic one.** Its imports are `import { call } from "./vice.ts"` — the **fork-only HTTP transport**. Its five exported functions (`readCheckpoint`, `waitCheckpointHit`, `runToCheckpoint`, `reset`, `screenshot`) all call `call("vice_execution_run", …)` etc. directly against the fork's HTTP endpoint. It is never imported by any `stock-*.ts` module (grep across `stock-checkpoints.ts`, `stock-run-until.ts`, `stock-machine.ts`, `stock-symbols.ts`, `stock-diagnose.ts`, `stock-reproducible-run.ts` finds only **comment references** to it, citing its invariant as precedent — never a real `import`). The stock backend already re-implements the *same two invariants* — exactly one resume per wait; poll on the checkpoint's own state, never on "is it paused" — **natively, per module**, against the binary-monitor's own primitives (`stock-reproducible-run.ts` states this explicitly at lines ~79, ~611, ~787: "vice-sync.ts's own invariant in its stock-native event-driven form").

So there is no single existing stock-side lock to extend. There is a *duplicated invariant*, independently upheld in several stock modules, all serialized today only because there is exactly one client of exactly one socket (`monitor_claim` guarantees this). **The moment a second channel exists, that guarantee stops being sufficient**, because `monitor_claim` today scopes ownership to the binary socket specifically (`InstanceRecord.monitorClient`, one field, no channel axis) — it says nothing about the text socket, which the probe's own finding establishes also halts the machine on command (`sw` before/after `x`, only advancing across the exit).

**The concrete seam to build:** a single new module — call it `monitor-lock.ts` — that is the one place either channel's dispatch layer (`stock-dispatch.ts`'s existing halting operations, and the new `text-dispatch.ts`) acquires before issuing *any command that can halt the machine*. Its exact shape is not a free design choice; it is dictated by the probe:

- If the probe returns **GO** (serialized command issuance is sufficient — see below), this is a small **in-process async mutex**, since both channels are dialed by the same container-side MCP server process. No broker RPC needed; cheap.
- If the probe returns **DEGRADE**, the lock must move to the broker (`broker-control.mts`, extending `monitor_claim`'s already-anticipated `channel` discriminator into a **cross-channel halt-authority lease** rather than a per-socket ownership flag) — because a second container-side session, or a second skill script process, could otherwise dial the *other* channel concurrently and defeat an in-process-only mutex.
- If the probe returns **NO-GO**, the two channels cannot be live at once at all, and the lock becomes a **connect/disconnect gate**: opening the text socket first requires releasing the binary claim (or vice versa), turned into one logical channel with two incompatible physical protocols, never simultaneous.

This is exactly why the probe must be the first gate: the answer determines which of three structurally different modules gets built, and building the wrong one wastes the phase.

## Sub-question 3 — The probe (first gate)

**What to measure**, using the same method the original probe used (`/usr/bin/x64sc -default -binarymonitor -binarymonitoraddress ip4://127.0.0.1:PORT_A -remotemonitor -remotemonitoraddress ip4://127.0.0.1:PORT_B`, a plain Node `net` socket on each port, both live simultaneously — bind-time coexistence is already confirmed, so this reuses the exact harness):

1. **Idle coexistence, control.** Binary client issues a non-halting read (`MEM_GET`) while the text client is connected but silent. Confirm the read is correct and the text socket is still responsive afterward — establishes the floor.
2. **Foreign-halt visibility.** Arm a non-stopping checkpoint on the binary channel (`CHECKPOINT_INFO` fires per hit, per CLAUDE.md's documented synchronous-delivery fact). While it is armed and the machine running, issue `memmapshow` on the text channel (a halting command, per the confirmed `sw`/`x` finding). Measure: does the binary channel's `CHECKPOINT_INFO` delivery still work correctly across a halt it did not itself cause? Does the binary channel ever misinterpret the foreign halt as its own `STOPPED` event in a way that would fool the "poll on hit_count, never on paused state" invariant — or does that invariant, being keyed on hit_count rather than pause state, already tolerate this for free (the favorable case)?
3. **Concurrent in-flight commands.** Issue a halting command on each channel at overlapping wall-clock instants (binary: `ADVANCE_INSTRUCTIONS`; text: `prof flat 5`). Measure: does either response ever carry state contaminated by the other command's execution (e.g., an instruction-count or profile sample that could only be explained by interleaved execution neither side requested)? Does either socket ever return a reply misassociated with the wrong request (framing corruption) — the same failure class `stock-protocol.ts`'s request-id-first demux exists to prevent on the binary side alone.
4. **Cross-channel resume visibility.** Halt via one channel (e.g., binary checkpoint hit), read the *other* channel's own state (text `sw`/`r` — the `STOPWATCH` column the original probe found), resume via the *other* channel (text `x`), and confirm the *halting* channel's next read reflects the resumed timing correctly. This is the direct dual-channel analogue of the single-channel `sw` bracket the original probe already ran.
5. **Abrupt-disconnect recovery.** With the text channel holding a halt (mid-`memmapshow`, before typing `x`), kill the text client process (`SIGKILL`, mirroring this project's own durability-testing convention — see `anno-durability.test.ts`'s planted-`SIGKILL` pattern). Measure: does the machine stay permanently halted with the binary channel now indistinguishable from a genuine wedge under `vice-wedge-triage`'s existing model? Today's `monitor_claim`/`monitor_release` model clears binary ownership on the client's own disconnect (`broker-control.mts` ~388–397's "connection close IS the release" rule) — the text channel has no such mechanism yet, and this measurement decides whether it needs one before shipping at all.

**Outcomes and their architectural consequences:**

- **GO** — serialized command issuance (never two commands in flight across both sockets at once) is sufficient; a foreign-triggered halt is already tolerated by the existing hit-count-based invariant; no cross-talk observed. → Build the **in-process mutex** in `monitor-lock.ts`; extend `InstanceRecord.monitorClient` with a `channel` discriminator purely for bookkeeping/diagnostics, not for enforcement; both channels stay connected for the session's whole lifetime; the dual-channel controller is a thin wrapper, not a new distributed-lock concern.
- **DEGRADE** — safe only when no command is in flight on the *other* channel at the moment a halting command is issued; some narrow, bounded inconsistency appears under true concurrency but is confined to a specific, nameable window (e.g., a stale event that a re-read resolves). → Build a **broker-level per-operation channel lease**: extend `monitor_claim`'s semantics from "own this socket" to "hold exclusive halt authority over this instance, regardless of which socket you're using it from" — `broker-control.mts` gates both `stock-dispatch.ts`'s halting calls and `text-dispatch.ts`'s calls through the SAME acquire/release RPC before either reaches its respective socket. More broker round-trips per call; correctness moves from "trust one process's in-memory mutex" to "trust the broker," which is the right place for a genuinely cross-process race.
- **NO-GO** — corruption or deadlock persists even under serialized issuance (e.g., a `STOPPED`/`RESUMED` event misdelivered to the wrong socket, or state genuinely diverges by which channel touched it last, in a way client-side serialization structurally cannot prevent). → **Connect-text-only-while-binary-idle**: extend `monitor_claim`/`monitor_release` so opening the text socket requires holding no binary claim and vice versa — the two channels time-share, never coexist live. The runtime-evidence-gathering steps become their own exclusive phase (release the binary lease, claim+dial+capture+release the text lease, re-claim binary if needed), scheduled by the broker denying a `monitor_claim` for one channel while the other channel holds any claim on the same instance. This is the heaviest of the three and the one the milestone's hypothesis language ("claimable as a *second* client without corrupting the binary client's view") is written to test against — a NO-GO does not kill the runtime-evidence layer, it just means the layer's capture step is scheduled, not concurrent.

No production module in sub-questions 1 or 2 should be built ahead of this measurement — the mutex, the broker lease, and the connect-gate are three structurally different things, and picking the wrong one is exactly the wasted-phase risk the milestone's stated gate exists to avoid.

## Sub-question 4 — The evidence table's schema and its join

**Where it goes:** `anno-store.ts`'s `DDL` string (the ONE schema definition, lines ~246–312 today), appended alongside the nine existing tables. It stays in the same file because `anno-seam.test.ts` structurally asserts `anno-store.ts` is the only `node:sqlite` consumer — a second store file is exactly the "parallel store" this design must not create, and the seed itself already commits to "the block table stays byte-derived" (no mutation of `anno_range`).

**Concrete shape**, following the existing tables' own conventions (autoincrement id, nullable `bank`, explicit index per hot column):

```sql
create table anno_runtime_observation (
  id integer primary key autoincrement,
  run_id text not null,          -- see run-identity key below
  address integer not null,
  bank integer,
  observed_exec integer not null check(observed_exec in (0, 1)),
  captured_at text not null,
  unique(run_id, address, bank)
);
create index anno_runtime_observation_address on anno_runtime_observation(address);
create index anno_runtime_observation_run on anno_runtime_observation(run_id);
```

`observed_exec` is deliberately not a richer enum — the seed's own design constraint is that a run can license `code` and can *never* license `data`, so the column only ever needs to record "was this address seen executing in this run" (1) or is simply absent (never touched — no row, not a 0-row, since "no row" and "observed not-executing" are NOT the same fact and must not collide). The `unique(run_id, address, bank)` constraint makes repeat ingests of the same run idempotent (an `insert or ignore`), matching the monotone-union design: a later run only ever adds new `(run_id, address)` pairs, never touches an existing row.

**Run-identity key.** Do not invent a new identity scheme — Phase 33 already built one and this project's own single-seam discipline says reuse it. `capture-predicate.ts`'s `argvDigest()` (line 581, "usable as a run identity key (`REPRO-04`)") plus the capture-record convention PROJECT.md's v0.8.0 close already states verbatim: *"every capture record carries `(binary sha256, argv digest, seed)` as one key."* `run_id` should be the same composite, serialised as one string (e.g. `${binarySha256}:${argvDigest}:${seed}`) or stored as three columns with a composite unique index — either is acceptable, but it must be **the same three values**, not a fourth independently-invented scenario label. This directly answers "which image, which scenario, which bracket" from the seed: image → binary sha256, scenario+bracket → already folded into argv digest (the launch profile/arguments) and seed.

**The join query.** This project already has the exact reconciliation pattern to extend: `anno-coverage.ts`'s `classFromBytes()` (~1681) and `classFromStore()` (~1692), each producing a `DerivedClass` from an independent source, explicitly designed (per that function's own comment) so "a second annotation substrate [can] be substituted without this function changing at all." The new module — `anno-runtime-evidence.ts`, a sibling, not a growth of `anno-coverage.ts` (a different, already large, concern) — adds a third: `classFromRuntime(observations, address): DerivedClass`, returning `"code"` if any observation row exists for that address, `"unreached"` otherwise (never `"data"` — the soundness asymmetry is enforced structurally by the function never returning that branch). The report query then compares this against `classFromBytes()`/`classFromStore()`'s existing outputs for the same address set and emits three buckets: **agree** (all sources concur), **disagree** (runtime says code, bytes/store say data or undefined — the seed's stated highest-value output), and **runtime-silent** (no observation — informative about coverage, never treated as evidence for `data`).

**Tool surface.** New, not an extension of an existing verb — `ANNO_TOOL_DEFINITIONS` in `anno-tools.ts` gains at minimum:
- an ingest verb (writes parsed-and-typed observation rows for one run — the only writer of `anno_runtime_observation`), and
- a report verb (the read-only join above).

Both register through `buildViceTool()` exactly like the other 21 `anno_*` verbs today, so — per the existing, already-proven `MCP-02` pattern — they never reach `forwardToVice()` by construction, no new interception rule needed. Per PROJECT.md's Out of Scope ("an entry in `capability-registry.ts` for the store" was explicitly rejected for the annotation store), these new verbs should **not** get a `capability-registry.ts` entry either — they are backend-independent, appear in neither manifest, same as every existing `anno_*` tool.

## Sub-question 5 — The parser boundary

**Where the modules live:** `src/mcp/vice/text-parse-memmapshow.ts`, `text-parse-prof.ts`, `text-parse-chis.ts`, `text-parse-bt.ts`, `text-parse-io.ts` — one file per format, following this codebase's existing "prefix-as-family" convention (`disasm-*.ts` for the pure disassembler is the closest existing analogue: import-free of any `stock-*`/`vice*` module, pure functions, exhaustively unit-testable). Each module's contract is `parse(raw: string): T[]`, nothing else — no socket, no connection, no timing, no knowledge of which channel produced the text.

**How this avoids becoming a second transport seam:** the parser modules never see a live connection. `text-protocol.ts`/`text-connect.ts` own sending the command and collecting the raw response text (framed by the prompt terminator); everything downstream of "here is a string" is pure. This is the same separation `stock-protocol.ts` (wire bytes) vs. `stock-*.ts` (typed handlers via `stockAnswer()`) already enforces on the binary side — the parser boundary is this project's `stock-handler.ts`-equivalent for the text side, minus any transport code at all.

**Fixture capture and pinning — the existing pattern to mirror, found and cited exactly.** `binmon-fixtures.ts` defines `REQUIRED_PROVENANCE_KEYS = ["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"]` (line 228) and refuses a fixture sidecar missing any of them; `capturedFrom` names the resolved binary path plus stock/fork kind (e.g. `"stock:/usr/bin/x64sc"`, per `probe-binmon.mjs` line 2320's convention), and `synthetic: false` is asserted for the three re-recorded real-hardware fixtures (`backend-detect.test.ts`'s `EXTV-02`). The text-format fixtures should use **the exact same five keys**, in a new `textmon-fixtures.ts` (a sibling loader/validator, not a reuse of `binmon-fixtures.ts` itself, since that module is typed to binary-monitor wire frames specifically — the PATTERN transfers, the code does not). Raw captures live under `src/mcp/vice/fixtures/textmon/<format>/`, one `.txt` (the literal captured text) + one `.json` sidecar per case, captured live during the probe itself (the probe's own harness already produces exactly this raw text — reuse the capture, don't re-run it later).

## Sub-question 6 — The three host binaries

**What has to be added**, per `host-tool.mts`'s own header (which names the seven synchronized edit sites a new tool must touch, and a data-driven test census that catches a skipped one): each of `c1541`, `petcat`, `cartconv` needs entries in `HostToolId` (~139), `HOST_TOOL_IDS` (~141), `HOST_TOOL_ARG_KEYS` (~180), `HOST_TOOL_PATH_ARG_KEYS` (~252, for whichever args are paths — e.g. `c1541`'s disk-image argument, `cartconv`'s `.crt` input), and `HOST_TOOL_TIMEOUT_MS` (~1325). Following the existing naming convention (`acme.build`, `ghidra.analyze`, `dxa.disassemble`), the new ids should be per-capability, not per-binary: e.g. `c1541.chain` / `c1541.dir` (the seed's own stated first uses — BAM/chain vs. what the loader actually reads), `petcat.decode` (BASIC-stub SYS-entry recovery), `cartconv.identify` (CRT bank structure).

**Version/digest declaration — the existing precedent does not transfer cleanly, and the right answer is a *different* existing precedent.** PROJECT.md states dxa and Ghidra are "both declared by version with a digest" — but this is two different mechanisms already: dxa is a **vendored source tarball**, pinned by a committed `dxa-0.1.5.tar.gz.sha256` sidecar checked by `dxa-build-gate.test.ts` (a build-time integrity gate over a tarball this project downloads and compiles itself). Ghidra is a **543 MiB non-vendored install**, declared by version only (12.1.3, in comments/docs; no sha256 pin was found for the Ghidra binary itself — it is too large and too platform-variable to make that practical). `c1541`/`petcat`/`cartconv` are neither: they are small, OS-installed binaries that typically ship **alongside VICE itself** (same package, same version family as `x64sc`), with no separate tarball to vendor and hash. The closest actual precedent in this tree is **`backend-detect.mts`'s own `--help` probe** — memoized once per process, no digest, version/capability inferred from the binary's own output. Recommend the same shape here: a version/availability probe (`c1541 --help` or equivalent) run once, its output captured as a fixture with the same `capturedFrom`/`synthetic` provenance discipline `binmon-fixtures.ts` already established, rather than inventing a sha256-pin mechanism these binaries don't fit.

**Does c1541 supersede `d64-parse.mjs`? No, and this milestone should not decide otherwise.** `.planning/seeds/host-tool-executor.md` states this explicitly: *"Deliberately NOT decided here: whether `d64-parse.mjs` stays as the in-container fast path or defers to host `c1541`... Keep it, and let `c1541` be additive, until that record exists."* `d64-parse.mjs`'s own header calls itself "the permanent, sanctioned replacement for the forbidden `vice_disk_list` tool," and the seed names a real reason to keep both rather than deleting one: `c1541` sees BAM/sector-chain divergence a directory-chain parser structurally cannot (the exact fastloader/protection signal this project cares about), while `d64-parse.mjs` works with zero host round-trip and zero token/broker dependency. **This milestone should add `c1541` additively and explicitly decline to touch `d64-parse.mjs`** — deleting or deprecating it is its own future decision record, not a byproduct of landing the host-tool seam.

## Architectural Patterns

### Pattern 1: Second-channel client mirrors the binary-monitor client's two-file split, never merges into it

**What:** `text-protocol.ts` (wire bytes) + `text-connect.ts` (claim → dial → handshake) as two new sibling files, structured identically to `stock-protocol.ts` + `stock-connect.ts`.
**When:** Any time a second wire protocol to the same external process is added.
**Trade-offs:** More files, but preserves "one module owns each protocol's bytes" — the alternative (extending `stock-protocol.ts` to also speak text) would violate the single-seam discipline this codebase enforces by test (`anno-seam.test.ts`'s analogue for `node:sqlite` is the model; a `text-protocol` seam test should exist too).

### Pattern 2: Serialization discipline lives in a NEW seam, not in `vice-sync.ts`

**What:** A `monitor-lock.ts` (or broker-level equivalent, per the probe) that both `stock-dispatch.ts` and `text-dispatch.ts` acquire before any halting command.
**When:** Once the probe returns any answer other than "coexistence is free" (which the probe itself already rules out — halting is confirmed on both channels).
**Trade-offs:** `vice-sync.ts` looks like the natural home by name, but it is fork-only, imports the fork's `call()` directly, and the stock backend already duplicates its invariant natively per module rather than centrally — routing text-channel work through it would be importing dead-for-stock code, not reuse.

### Pattern 3: Runtime evidence as a third independent classifier, following the codebase's own established reconciliation shape

**What:** `classFromRuntime()` alongside the existing `classFromBytes()`/`classFromStore()` (`anno-coverage.ts` ~1681/~1692), never collapsed into either.
**When:** Any time a new, independently-sourced classification needs to be compared against — never merged with — an existing one.
**Trade-offs:** More query surface, but preserves the disagreement signal the seed calls "the highest-value output of the whole design" — collapsing it into the block table (rejected explicitly in the seed) would destroy exactly that.

### Pattern 4: Parser boundary is pure-text-in, typed-out, with the same fixture-provenance discipline as the binary side

**What:** `text-parse-*.ts` modules with zero socket/timing knowledge; fixtures pinned with the same five `REQUIRED_PROVENANCE_KEYS` `binmon-fixtures.ts` already uses.
**When:** Any text-format output from an external tool that this project must parse and trust.
**Trade-offs:** Requires live-capturing real fixtures before writing parsers (cannot invent plausible-looking VICE output and call it a fixture — `binmon-fixtures.ts`'s own `synthetic` flag exists precisely to prevent that failure mode).

### Pattern 5: Host binaries via typed, per-capability `host_tool` ids — never a generic passthrough

**What:** `c1541.chain`, `petcat.decode`, `cartconv.identify` as new `HostToolId` members, each with its own typed arg allowlist, mirroring `acme.build`/`ghidra.analyze`/`dxa.disassemble`.
**When:** Any new host-side, stateless binary this project needs to reach from a container-side skill script.
**Trade-offs:** Seven synchronized edits per tool (by design — `host-tool.mts`'s own header states this is intentional, catching a skipped edit via a two-directions test census) versus a generic run-arbitrary-command op, which the seed explicitly calls a remote-execution seam and rejects.

## Data Flow

### New flow: dual-channel capture into the runtime-evidence layer (post-probe, assuming GO or DEGRADE)

```
skill/orchestrator triggers a capture run
  -> text-connect.ts claims + dials text channel (behind monitor-lock.ts)
  -> text-protocol.ts sends `memmapshow` / `prof flat N` / `chis N` / `bt`
  -> raw text response
  -> text-parse-*.ts (pure) -> typed rows
  -> anno_* ingest verb (anno-tools.ts) -> anno-store.ts INSERT OR IGNORE
       into anno_runtime_observation, keyed by (run_id, address, bank)
  -> anno_* report verb -> anno-runtime-evidence.ts joins against
       anno_range / block-class.ts-derived classes -> agree/disagree/silent
```

### New flow: host binary invocation

```
skill script (container) -> host-tool-client.ts (new, container-side,
   mirrors vice-broker-client.ts's short-lived open/send/close convention)
  -> broker-control.mts's `host_tool` op (already exists, six tools registered)
  -> host-tool.mts's runHostTool() -> async spawn of c1541/petcat/cartconv
       (host-side, per-invocation child process, never the broker's own process)
  -> result digest back over the same socket (or, for bulk output, a
       host-side file path translated through containerpath.ts)
```

## Anti-Patterns (specific to this integration)

### Routing the text channel through `vice-sync.ts`

**What people might do:** Import `vice-sync.ts`'s helpers for the text channel because the invariant names match.
**Why it's wrong:** `vice-sync.ts` calls the fork's HTTP `call()` directly; it has no route to the stock binary-monitor socket, let alone the text one. It would either silently target the wrong backend or fail to compile against a stock-only connection.
**Do this instead:** Build the new `monitor-lock.ts` seam per the probe's verdict; treat `vice-sync.ts`'s two invariants as the *specification* to satisfy, not code to call.

### A second `node:net`/text-wire consumer

**What people might do:** Let `text-dispatch.ts`'s handler modules touch the raw socket directly, "just for this one command," bypassing `text-protocol.ts`.
**Why it's wrong:** Exactly the bug class this codebase's own header comments document repeatedly (`mcpHost()`'s three inlined copies, `shipped-modules.ts`'s four hand copies) — a second place that frames text-monitor bytes will drift from the first the moment a VICE version changes the prompt format.
**Do this instead:** Every text command goes through `text-protocol.ts`; handler modules only ever call its typed send/receive functions.

### Promoting a runtime observation into the block table

**What people might do:** Once an address is observed executing enough times, write it into `anno_range` as `data_type: code` directly, "since we're confident now."
**Why it's wrong:** Explicitly rejected in the seed on the record — it collapses two independently-sourced classifiers into one, destroys the disagreement signal (the design's stated highest-value output), and an over-confident wrong promotion is unrecoverable (the store has no per-cell provenance to unwind it from).
**Do this instead:** The report query surfaces disagreement; a human or a later, explicitly-designed promotion rule (not this milestone's job) decides whether and how to act on it.

### A generic `host_tool.run` passthrough for c1541/petcat/cartconv

**What people might do:** Add one `disk.run` op that accepts a subcommand string and forwards it, to avoid three separate typed ids.
**Why it's wrong:** The seed calls this out by name as a remote-execution seam; `host-tool.mts`'s existing six tools all use per-capability typed ids with a fixed, server-constructed argv — this project already has the discipline (`DENY_LIST` in `vice.ts`, the power-cycle resource denials) and the same rule applies here.
**Do this instead:** One `HostToolId` per capability, each with its own typed arg allowlist, per Pattern 5 above.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `text-dispatch.ts` ↔ `monitor-lock.ts` | direct function call, in-process (or broker RPC if DEGRADE/NO-GO) | Every halting command from either channel must pass through this seam; no direct socket access from dispatch modules. |
| `text-connect.ts` ↔ broker control plane | JSON-line TCP, extends `monitor_claim`/`monitor_release` | Needs `remoteMonitorPort` added to the acquire/status response shape first — confirmed absent today. |
| `text-parse-*.ts` ↔ `text-protocol.ts` | pure function call on a string | Parsers never see the socket; protocol module never interprets parsed structure. |
| `anno-runtime-evidence.ts` ↔ `anno-store.ts` | SQL through the one open handle, same as every other `anno-*` derivation module | New table, same file, no second `node:sqlite` consumer. |
| `anno-runtime-evidence.ts` ↔ `anno-coverage.ts` / `block-class.ts` | reads `classFromBytes()`/`classFromStore()`-shaped outputs | Read-only; the runtime module never mutates coverage state. |
| `host-tool-client.ts` (new, container-side) ↔ `broker-control.mts`'s `host_tool` op | short-lived open/send/close TCP, same socket as VICE control ops, namespaced by tool id | Mirrors `vice-broker-client.ts`'s existing lease-connection idiom, but explicitly stateless (no lease held between calls). |
| `host-tool.mts` ↔ `hostpath.ts`/`containerpath.ts` | path arguments in, produced paths out | Every `c1541`/`petcat`/`cartconv` path argument must resolve through the same `resolveWorkspacePath()` discipline `acme.build`/`ghidra.analyze` already use — no new path-translation site. |

## Build Order

Respecting dependencies, probe first:

1. **Probe gate (dual-channel coexistence).** No new production module required — a throwaway harness in the spirit of `probe-binmon.mjs`/the original text-monitor probe, run against genuine stock 3.9 with both channels live. **Blocking**: nothing in steps 3, 5, or 6 below should be designed, let alone built, before this returns GO/DEGRADE/NO-GO, because each answer implies a different shape for `monitor-lock.ts` and for the `monitor_claim` extension.
2. **Host-tool executor extension (c1541/petcat/cartconv).** Fully independent of the text channel (explicitly stated in the seed: "Independent of the text-monitor work"). Can proceed in parallel with step 1 — zero shared files, zero shared risk.
3. **Text protocol + connect + the chosen lock shape.** Depends on step 1's verdict. Also needs the `remoteMonitorPort`-surfacing fix to `HeldLease`/broker responses (small, mechanical, do it as part of this step).
4. **Parser modules + fixtures.** Can start as soon as step 1's probe harness produces raw captured text (reuse the probe's own output as the first fixture batch) — does not need step 3's client to be finished, only needs sample text, which the probe already generates. Runs in parallel with step 3.
5. **Text dispatch (tool surface over the parsed data).** Depends on steps 3 and 4 both landing (needs a working client to call, and parsers to shape the response).
6. **Runtime-evidence schema + `anno-runtime-evidence.ts` + new `anno_*` verbs.** The schema and join-query logic are pure/`anno-store.ts`-local and can be built and unit-tested against synthetic parsed rows in parallel with steps 3–5, gated only on the parser output shape being settled (an interface contract, not a build dependency). Wiring the live ingest path (capture → parse → store) depends on step 5.
7. **`PROOF-01`'s independent external check.** Last — consumes the finished, live runtime-evidence layer against `danish.d64`, so it cannot start until steps 1–6 are proven working end to end.

## Sources

- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/vice-sync.ts` (imports, invariants, `call()` from `vice.ts`)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/stock-connect.ts`, `stock-protocol.ts` (binary-monitor client pattern to mirror)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/broker-state.mts` (`InstanceRecord.monitorClient`, `.remoteMonitorPort`)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/broker-launch.mts` (`buildViceArgs()`'s `-remotemonitor` append)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/broker-control.mts`, `vice-broker-client.ts` (`monitor_claim`/`monitor_release`, `HeldLease`, `host_tool` op)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/anno-store.ts` (`DDL`, schema conventions)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/anno-coverage.ts` (`classFromBytes()`, `classFromStore()`, `DerivedClass`)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/block-class.ts` (three-valued `BlockClass`, header rationale)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/host-tool.mts` (`HostToolId`, the seven synchronized edit sites)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/capture-predicate.ts` (`argvDigest()`, run-identity precedent)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/binmon-fixtures.ts` (`REQUIRED_PROVENANCE_KEYS` fixture pattern)
- `/home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/d64-parse.mjs` (existing pure-JS `.d64` parser, kept additive)
- `/home/henrik/dev/henrik/git/c64-re-tools/.planning/notes/text-monitor-channel-live-probe.md`, `.planning/seeds/runtime-evidence-layer.md`, `.planning/seeds/host-tool-executor.md` (design constraints and live-probe findings)
- `/home/henrik/dev/henrik/git/c64-re-tools/.planning/codebase/ARCHITECTURE.md`, `.planning/PROJECT.md` (standing architectural rules and milestone history)

---
*Architecture research for: c64-re-tools v0.9.0 (text channel + runtime evidence layer)*
*Researched: 2026-09-06*
