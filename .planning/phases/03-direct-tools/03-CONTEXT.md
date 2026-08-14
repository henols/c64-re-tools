# Phase 3: Direct Tools - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Every tool with a 1:1 binary-monitor opcode works on the stock backend.

Four largely independent tool families: memory/registers, checkpoints and
watchpoints, execution control, and machine control (reset / autostart / disk
attach / input / snapshots / banks).

**In scope:** DIRECT-01..09.

**Not in this phase:** the pre-`rewriteArguments()` derived-tool seam and the
disassembler (Phase 4); memory search/compare/fill, checkpoint groups, symbols,
sprites, chip-state decode, backtrace, `.d64` sector reads, screenshots
(Phase 5); CPU history, drive-CPU debugging, resources, raster conditions
(Phase 6); cycle timing, `run_until`, wedge-triage advance check, **and disk
detach** (Phase 7); the per-backend capability matrix and its error text
(BACK-05, Phase 8).

**Phase 3 starting state (Phase 2's end state):** `tools-manifest.stock.json`
advertises exactly **one** tool (`vice_ping`). `stock-dispatch.ts` holds the one
dispatch table with that one entry and a hard no-fall-through refusal.
`stock-protocol.ts` carries the complete `CommandType` / `ResponseType` /
`ErrorCode` enums and response **parsers** (MemoryGet, RegisterInfo,
RegistersAvailable, CheckpointInfo/List, DisplayGet, PaletteGet, Undump, the
five events) — but **no request-body encoders**. Phase 3 writes the encoders,
the handlers, and the manifest entries.

</domain>

<decisions>
## Implementation Decisions

### Answer and argument shape

- **D-01: Stock answers are stock-native, and every divergence is logged.**
  A tool present on both backends does **not** have to reproduce the fork's JSON
  answer. Design the cleanest shape for stock and record each divergence in
  `docs/stock-vice-parity.md` so Phase 8's parity harness treats it as expected
  rather than as a defect.
  - Rejected: bug-for-bug reproduction of the fork's answers (the fork's shapes
    are undocumented — `tools-manifest.json` carries **no `outputSchema` on any
    tool** — so it would require a live fork capture session first, and would
    lock stock into fork quirks permanently).
  - Rejected: a documented common core with stock extras allowed.
  - **Consequence, must be carried:** a skill that parses fork answer fields
    breaks on stock. SKILL-01 (Phase 8) already owns capability gaps; this adds
    **answer-shape** drift to what it must cover. Phase 8 planning must not
    assume SKILL-01 is capability-only.

- **D-02: `outputSchema` on every stock manifest entry is the enforced
  contract.** Each tool in `tools-manifest.stock.json` declares its answer
  shape, so the shape is machine-readable at `tools/list` time and a test can
  assert each handler's answer validates against its own schema. The **fork**
  manifest stays as-is (no `outputSchema`) — that is a fork-surface change and
  BACK-02 forbids it.
  - Rejected: a prose-only divergence list (the contract would have no runtime
    check).

- **D-03: Inputs stay fork-compatible; stock may add only OPTIONAL arguments.**
  *(Claude's discretion — user expressed no preference; this is the default
  taken, and the planner may revisit it with a stated reason.)* Required
  argument names and types match the fork's exactly for any tool on both
  backends, so CLAUDE.md's standing same-argument-shape rule survives intact and
  an existing skill's **call** still works even though the **answer** differs.
  Stock-only optional arguments with safe defaults are permitted (e.g. a
  side-effects flag, a memspace selector, the `stop:false` acknowledgement in
  D-11).
  - Rejected: stock-native inputs (would reverse the standing constraint the way
    D-07 reversed the surface constraint, and make every skill call site
    backend-specific).
  - Rejected: dropping fork arguments stock cannot honour (turns a silent no-op
    into a hard error on existing skill calls).

- **D-04: One shared address parser with a symbol-resolution hook.** Build a
  single `parseAddress()` seam handling decimal / `$hex` / `0x`, with a
  pluggable symbol resolver that is **empty in Phase 3** and filled by Phase 5's
  symbol store (DERIV-04). A symbolic address in Phase 3 refuses with text
  saying no symbol table is loaded — **not** a parse error.
  - Rationale: re-deriving an address parser per tool family is this codebase's
    own named anti-pattern ("re-deriving a cross-cutting seam locally").
  - Rejected: numeric-only with no hook; pulling the symbol store forward.

### Run/stop state and the halt policy

- **D-05: Commands leave the machine halted, and say so. No unrequested
  resume, ever.** On stock, `monitor_startup_trap()` fires on any inbound byte,
  so **every** command halts the machine; resume is a separate `EXIT` (0xaa).
  The client never issues an `EXIT` the agent did not ask for. The agent resumes
  explicitly.
  - Rejected: transparent restore (issue `EXIT` after a command if the machine
    was running). Rejected with the consequence understood.
  - Rejected: transparent-with-opt-out.
  - **This is the single biggest behavioural divergence in the milestone.** On
    the fork a read does not stop the game; on stock it does. It satisfies
    Phase 3 success criterion 1's "no read forces a pause/resume round trip it
    does not need" maximally — there is no round trip at all.
  - **Consequence, must be carried:** `c64-ram-capture` and `c64-program-recon`
    both read memory mid-run and assume the machine keeps running. SKILL-01
    (Phase 8) must cover this, alongside D-01's answer-shape drift.

- **D-06: `runState` appears on EVERY stock tool answer.** Values
  `"running" | "stopped" | "unknown"`, derived **purely from the event stream**
  (`STOPPED` 0x62 / `RESUMED` 0x63), never inferred from the commands sent.
  Declared in each tool's `outputSchema` per D-02.
  - Rejected: reporting it only on `vice_ping` and the execution tools (an agent
    that just read memory would need a second call to learn the machine
    stopped — exactly the round trip criterion 1 objects to).
  - Rejected: reporting only on change (absence would be ambiguous).

- **D-07: `"unknown"` gates the execution tools only.** After connect the
  derived state is honestly `unknown` — the handshake itself halted the machine
  and nothing on the wire says whether the user had it running. Memory,
  register, and checkpoint tools run freely in that state. `vice_execution_step`
  and execute-until-return **refuse** while `unknown`, telling the agent to
  pause or run first.
  - Rejected: asserting `"stopped"` at connect (asserts something the protocol
    did not report — the exact thing the roadmap note forbids).
  - Rejected: gating nothing.

- **D-08: Pause and resume short-circuit on known state.** If derived state is
  `"stopped"`, `vice_execution_pause` sends nothing and answers ok with an
  already-stopped marker; same for resume when `"running"`. While state is
  `"unknown"` the command **is** sent — there is nothing to short-circuit
  against. A genuine agent retry produces no wire traffic. Satisfies criterion 3.
  - Rejected: always-send-and-rely-on-harmlessness (a duplicate resume after an
    event race genuinely restarts a machine the agent thought it had paused).
  - Not taken: an additional resume cooldown / rate limit. The roadmap's "cool
    resumes down" note is **not** implemented as a separate mechanism —
    short-circuiting is the whole answer. Revisit only if a resume storm is
    observed.

### Checkpoints, watchpoints, and conditions

- **D-09: The `condition` argument accepts EITHER a string or a structured
  object.** Both funnel into one typed AST and one canonical emitter. The string
  form keeps the fork's argument shape (`"A == $42"`) so existing skill calls
  work; the structured form lets a caller skip the parser entirely. Two input
  paths, one emitter — the emitter is the only thing that ever produces wire
  text.
  - The emitter always fully parenthesises every comparison, emits `$hex`
    literals, and uses uppercase `RL`/`CY`.
  - **Already settled by Phase 6 criterion 4, not re-decided here:** bare-decimal
    literals, `LIN`/`CYC`, lowercase register names, unparenthesised input, and
    out-of-range values are **refused with an explanation**, never silently sent.
    Phase 3 establishes the refusal; Phase 6's GAIN-06 extends the same AST with
    raster semantics rather than rewriting a string-concatenation path.
  - Rejected: string-only (parse → AST → re-emit); structured-only (breaks the
    argument-shape rule and every existing call site).

- **D-10: The client-side condition registry and fail-closed cleanup ship in
  Phase 3, not Phase 6.** On stock a condition attaches to an existing
  checkpoint by number, **cannot be read back, cannot be cleared, and leaks if
  re-set**. Therefore, in this phase:
  - Keep a client-side registry of which condition text is attached to which
    checkpoint number, so `vice_checkpoint_list` can report conditions.
  - Treat conditions as **immutable** once set.
  - **Fail closed:** if `CONDITION_SET` fails, delete the checkpoint it was
    meant to condition — otherwise a full-range **unconditioned** breakpoint is
    left armed.
  - Rationale: the leak exists the moment DIRECT-03 ships, so the guard ships
    with it. The roadmap files this note under Phase 6; that placement is
    superseded for the registry and cleanup halves.

- **D-11: `stop:false` (trace) checkpoints get the full guard: opt-in, rate
  limit, auto-disable.** A non-stopping checkpoint emits a `CHECKPOINT_INFO`
  frame per hit **synchronously, from inside the CPU loop, over the blocking
  socket** — on a hot address that mutually deadlocks client and emulator.
  Therefore:
  - `stop:false` requires an explicit acknowledging argument (a stock-only
    optional arg, permitted by D-03).
  - The client enforces a per-second hit-rate limit.
  - A checkpoint that exceeds the limit is **toggled off automatically**, with
    the reason and the checkpoint id reported in the answer.
  - Rejected: refusing `stop:false` outright in Phase 3; accepting it with only
    a warning (leaves a documented way to hang the emulator that
    `vice-wedge-triage` would then have to diagnose).

- **D-12: Keep the fork's add-then-condition split.** `vice_checkpoint_add` does
  **not** gain an optional `condition` argument. Stock mirrors the fork's call
  sequence exactly (add, then `set_condition`), so Phase 8's parity harness
  drives identical sequences through both backends. D-10's fail-closed cleanup
  covers the armed-unconditioned window between the two calls.
  - Note: `vice_watch_add` already takes `condition` **on the fork**, so it is
    atomic there by the fork's own schema and stays that way on stock.

### Tools with no 1:1 opcode

- **D-13: Disk detach moves to Phase 7 via the text monitor.** There is no
  binary-monitor command for detach. The text monitor's `detach` does exist and
  `-remotemonitor` coexists with `-binarymonitor`.
  - **Phase 3 ships the launch flag and the port allocation only:** the broker
    launches stock with `-remotemonitor` alongside `-binarymonitor` on a
    **second** broker-allocated port, and the instance record carries it. Phase 3
    stays purely binary-monitor at the protocol layer — it builds no text client.
  - `vice_disk_detach` is **absent** from Phase 3's stock manifest and ships in
    Phase 7, which needs the text client anyway for the stopwatch route.
  - **This reverses D-12 of Phase 2** ("Stock launches with the binary monitor
    only — no `-remotemonitor`"). That decision explicitly deferred the question
    to Phase 7; it is now answered early, in the launch-flag half only.
  - **Touches D-13 of Phase 2** (broker-side single-monitor-client ownership).
    The text monitor is a second socket on a second port. The planner must state
    whether the existing `monitor_claim`/`monitor_release` ownership record
    covers it, extends to cover it, or leaves it deliberately unclaimed in
    Phase 3 because nothing dials it yet.
  - **Roadmap change required:** DIRECT-06's detach half moves from Phase 3 to
    Phase 7. Reconcile through `gsd-sdk` roadmap handlers — not from inside
    discuss-phase.
  - Rejected: trimming detach from the stock manifest permanently; broker
    relaunch (destroys all emulation state mid-session).

- **D-14: Disk attach is `AUTOSTART` with the run flag clear.** The documented
  approximation. Record it in `docs/stock-vice-parity.md` as an approximation,
  not an exact port.

- **D-15: `vice_checkpoint_set_ignore_count` is trimmed from the stock
  manifest.** There is no native ignore count; the only implementation is
  "client counts hits and resumes on each ignored hit", which would require a
  carve-out in D-05's absolute no-unrequested-resume policy. **The halt policy
  stays absolute.** The tool is absent from `tools-manifest.stock.json` and
  BACK-05 reports it in Phase 8. DIRECT-03 is therefore met **except** for
  ignore counts — record that in the parity doc and in Phase 3's own
  verification.
  - Rejected: implementing it as the single sanctioned exception to D-05;
    reshaping it into a non-resuming hit-reporter (no longer an ignore count in
    any useful sense).

- **D-16: `vice_snapshot_list` is deleted from BOTH manifests.** It has **no
  consumer anywhere** — verified: no skill, no script, no source calls it; the
  only reference in the repo is `vice_snapshot_load`'s own description telling
  the reader to use it.
  - Remove the entry from `tools-manifest.json` (fork) **and** never add it to
    `tools-manifest.stock.json`.
  - **Update `vice_snapshot_load`'s description in the same change** — it
    currently says "Use snapshot.list to see available snapshots"
    (`tools-manifest.json:1000`).
  - **This is a deliberate exception to BACK-02** ("the fork backend's
    advertised list is unchanged from v0.1.x", ROADMAP.md Standing Constraints).
    It needs the same explicit reconciliation D-07/D-08 of Phase 2 got:
    reconcile ROADMAP.md through `gsd-sdk` roadmap handlers, and expect the
    fork-surface regression test asserting a 63-tool manifest to move with it.
  - Rejected: absent-from-stock-but-kept-on-fork; filing the fork removal as a
    separate todo.

- **D-17: Emulator-side path arguments are translated explicitly, per tool,
  from a declared table.** *(Claude's discretion — user said "you decide".)*
  `DUMP`/`UNDUMP` (snapshot save/load), `AUTOSTART`, and disk attach pass a
  filename that **VICE on the host** opens, so those paths **do** need
  container→host translation — while client-side derivations (Phase 5's
  screenshots) must **never** be translated. A declared table names exactly
  which stock tools have emulator-side path arguments; those handlers call
  `hostpath.ts` directly.
  - Rejected: calling the fork's `rewriteArguments()` from stock handlers (it
    lives inside `forwardToVice()`, the one function D-09 of Phase 2 says the
    stock path must never touch, and its own comment inverts on stock).
  - Rejected: requiring the caller to pass host paths (pushes a container/host
    distinction onto every skill, which the `hostpath.ts` seam exists to hide).
  - This is the **mirror image** of the DERIV-07 hazard: there, translating is
    the bug; here, not translating is. Both directions belong in one legible
    place.

### Claude's Discretion

- **D-03** (fork-compatible inputs plus optional stock extras) — user expressed
  no preference; the default above was taken to preserve the standing rule.
- **D-17** (explicit per-tool path-translation table) — user said "you decide".
- Module layout for the Phase 3 handlers, subject to the standing constraint
  that client-side code goes in sibling modules and is never appended to
  `vice-proxy.ts` (already ~172 KB).
- Request-body encoder design in `stock-protocol.ts` (none exist yet — only
  `encodeRequestHeader()`).
- Wire-level detail already fixed by the normative docs and **not** re-opened
  here: the memspace byte is `0x00` = main and `0x01`–`0x04` = units 8–11
  (`0x08` is rejected); `MEM_GET` always sends exactly 8 bytes because the
  handler dereferences the body before its length check.

### Open items the planner must resolve (not gray areas — naming/coverage gaps)

- **EXECUTE_UNTIL_RETURN (0x73) has no fork tool name.** DIRECT-04 names
  "execute-until-return" but the fork surface has no such tool — the nearest is
  `vice_execution_step`'s `stepOver`, which is a different operation. D-07 of
  Phase 2 permits stock-only manifest entries, so this needs a **new stock-only
  tool name** following the existing `vice_execution_*` convention. Planner's
  call.
- **REGISTERS_AVAILABLE (0x83) has no fork tool name.** DIRECT-09 names
  "enumerate available memory banks **and registers**". `vice_memory_banks`
  covers banks via `BANKS_AVAILABLE` (0x82); nothing covers the register
  enumeration. Either a stock-only tool or a field on `vice_registers_get`'s
  answer (permitted by D-01's stock-native shapes). Planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Protocol (normative)
- `docs/phase0-binmon-findings.md` — the normative protocol document (normative
  by ingest resolution W2), corrected in Phase 1. §5 carries the confirmed
  opcode set and error codes. §1 documents the synchronous `CHECKPOINT_INFO`
  cost behind D-11. §4 documents `monitor_startup_trap()` firing on any inbound
  byte — the fact D-05 rests on.
- `docs/stock-vice-parity.md` — per-capability parity. §A lists the losses
  (SID read-back, low-level keyboard, `run_until` cycles, ignore count); §A.7
  licenses expected divergences; §B lists the stock-only gains. **This phase
  adds to it:** D-01's answer-shape divergences, D-14's attach approximation,
  D-15's trimmed ignore count.
- `docs/phase1-probe-results.md` — what a real build actually did: api version,
  version quads, `CPUHISTORY_GET` per build, `DISPLAY_GET` geometry,
  `PALETTE_GET` count, the observed unsolicited event sequence, and the fork's
  `CHECKPOINT_INFO` flood anomaly.
- `docs/roadmap-stock-vice.md` — the ADR (status: proposed). Superseded on the
  tool-triage point by ingest resolution W1.

### Prior-phase decisions this phase builds on
- `.planning/phases/02-stock-backend-connection/02-CONTEXT.md` — **read in
  full.** D-07/D-09 (trimmed manifest, no fall-through, one dispatch table),
  D-12 (**reversed here by D-13**), D-13 (single-monitor-client ownership,
  **touched by D-13 here**), D-16/D-17 (protocol client, request-id demux).
- `.planning/ROADMAP.md` "Standing Constraints" — BACK-02's fork-unchanged gate
  (**D-16 here is a deliberate exception needing reconciliation**), the
  `vice-sync.ts` invariants, the sibling-module rule.
- `.planning/notes/stock-vice-migration-revised-loss-ledger.md` — the corrected
  loss ledger. Its CONFLICT/REFINEMENT blocks remain Phase 7's problem.
- `.planning/intel/constraints.md` — the CON-* blocks, agreed with the corrected
  docs in Phase 1.
- `.planning/INGEST-CONFLICTS.md` — the W1/W2 resolutions.

### Code this phase touches
- `.claude/mcp/vice/stock-dispatch.ts` — **the** dispatch table and **the** one
  dispatch entry point. Phase 3 adds ~20 entries to `STOCK_DISPATCH_TABLE`.
  Never a parallel table, never a second dispatch site, never a fall-through to
  `forwardToVice()`.
- `.claude/mcp/vice/stock-protocol.ts` — `CommandType` / `ResponseType` /
  `ErrorCode` enums, `encodeRequestHeader()`, `parseResponse()`, `parseBuffer()`,
  `EXPECTED_RESPONSE`, `RELATED_RESPONSES`. **Request-body encoders do not exist
  yet** — this phase writes them.
- `.claude/mcp/vice/stock-connect.ts` — the session, handshake, capability gate,
  `MachineRestartedError` reuse.
- `.claude/mcp/vice/tools-manifest.stock.json` — currently **one** tool
  (`vice_ping`). D-02 adds `outputSchema` to every entry this phase writes.
- `.claude/mcp/vice/tools-manifest.json` — the 63-tool fork manifest. D-16
  removes `vice_snapshot_list` and edits `vice_snapshot_load`'s description at
  line 1000.
- `.claude/mcp/vice/hostpath.ts` / `containerpath.ts` — D-17's translation for
  emulator-side path arguments.
- `.claude/mcp/vice/vice-proxy.ts` — `rewriteArguments()` at line 2773 runs
  **inside** `forwardToVice()`. The stock path must not reach it (Phase 2 D-09).
- `.claude/mcp/vice/broker-launch.mts` — D-13's `-remotemonitor` flag and the
  second port allocation. `.mts` change ⇒ rebuild the committed
  `resources/*.mjs` or `resources-sync.test.ts` fails CI.
- `.claude/mcp/vice/broker-control.mts` / `vice-broker-client.ts` — the
  `monitor_claim`/`monitor_release` ownership record D-13 may need to extend.
- `.claude/mcp/vice/vice-sync.ts` — invariants that must survive: exactly one
  resume per wait; poll on `hit_count`, never on paused state; never delete a
  VICE-marked temporary checkpoint. Deliberately not unit-tested.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — layers, seams, and the two named
  anti-patterns (re-deriving a cross-cutting seam locally; preemptive
  kill/relaunch).
- `.planning/codebase/TESTING.md` — the automated gate is `npm run
  test:automated` (`test-gate.mjs`), which excludes the three manual-only
  suites.

### Reviewed todos (see Deferred)
- `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`
- `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`
- `.planning/todos/pending/2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md`
- `.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`STOCK_DISPATCH_TABLE` + `dispatchStock()` + `stockHandlerFor()`**
  (`stock-dispatch.ts`) — the table exists with one entry and a documented
  extension point ("a later plan (phases 3-7) adds its own stock entries here").
  Phase 3 fills it; it invents nothing.
- **`ensureStockSession(deps)` / `StockDispatchDeps`** — every handler reaches a
  live session **only** through this. No handler resolves a lease or opens a
  socket of its own.
- **`convertHandshakeError()`** — already converts `MonitorOwnershipError` and
  `MachineRestartedError` into well-formed refusal text and never says "wedge"
  or "hung". Reuse for every new handler; do not write a second converter.
- **`parseResponse()` / `parseBuffer()` / `EXPECTED_RESPONSE` /
  `RELATED_RESPONSES`** (`stock-protocol.ts`) — response side is done for every
  opcode this phase needs. Only the **request-body encoders** are missing.
- **`ErrorCode`** (`stock-protocol.ts`) — `Ok`, `ObjectMissing`,
  `InvalidMemspace`, `InvalidLength`, … already enumerated; error text maps from
  these, not from ad-hoc strings.
- **`hostpath.ts` / `containerpath.ts`** — the tested closed consumer set for
  host-path logic. D-17 adds stock handlers to it deliberately, not casually.
- **`ViceError` subclasses** (`vice.ts`) and the `Stock*Error` family
  (`stock-protocol.ts`) — the established error hierarchy.

### Established Patterns
- **Single seam per concern.** One dispatch table, one transport, one repo-root
  resolver, one deny-list. D-04's `parseAddress()` and D-17's path-translation
  table both follow it; re-deriving either locally is the named anti-pattern.
- **Generated-but-committed artifacts.** `.mts` → `resources/*.mjs` via
  `build.ts`; `resources-sync.test.ts` fails CI on drift. D-13's broker change
  touches `.mts` **and** requires the rebuild.
- **No build step for the shipped server.** Container-side `.ts` runs under
  Node's native type-stripping; only host-bound `.mts` is compiled.
- **Never-throw boundary.** `vice-proxy.ts` registers global handlers first — a
  dead stdio server is never restarted by Claude Code for the rest of the
  session. No handler may let an exception escape; `dispatchStock()` already
  converts anything that escapes.
- **Runtime narrowing at every JSON boundary** via `isPlainObject()`, not casts.
  Every new handler's argument parsing follows this.
- **Long structured header comments** stating why a file exists and what NOT to
  do, naming the specific past mistake. New modules match this density.

### Integration Points
- `STOCK_DISPATCH_TABLE` — where every Phase 3 tool registers.
- `tools-manifest.stock.json` — where each tool's name, `inputSchema` (D-03) and
  `outputSchema` (D-02) are declared.
- `stock-protocol.ts` — where the new request-body encoders land.
- The event stream (`STOPPED` / `RESUMED` / `JAM`) — the **only** source for
  D-06's `runState` projection.
- `broker-launch.mts` — D-13's second launch flag and port.
- `hostpath.ts` — D-17's emulator-side path translation.

</code_context>

<specifics>
## Specific Ideas

- *"if it ever used? if not just delete it"* — the user's framing for D-16, on
  `vice_snapshot_list`. The instinct generalises: a tool with no consumer is not
  a porting obligation. The planner may apply the same test to any other tool it
  is about to port and cannot find a caller for — but a **removal from the fork
  manifest** always carries the BACK-02 reconciliation D-16 describes.
- The user chose the **text monitor** for detach over trimming the capability or
  relaunching the instance, then deliberately scoped Phase 3 to the launch flag
  only. The intent: keep the capability reachable and let Phase 7 — which needs
  the text client regardless — own the transport.
- The user chose **"leave halted, say so"** over transparent resume with the
  divergence spelled out. The intent is honesty over fork-mimicry: the stock
  backend behaves like what it is, and the playbooks change to match.

</specifics>

<deferred>
## Deferred Ideas

- **Resume cooldown / rate limiting on `EXIT`** — the roadmap's "cool resumes
  down" note. Not implemented; D-08's short-circuit is the whole answer. Revisit
  only if a resume storm is observed against a real emulator.
- **The text-monitor transport itself** (framing, prompt detection,
  command/response correlation) — Phase 7, alongside the stopwatch route.
  Phase 3 provides only the launch flag and the port.
- **`vice_disk_detach`** — Phase 7 (D-13).
- **`vice_disk_read_sector`** — parse the `.d64` client-side; Phase 5.
- **Low-level keyboard** (`key_press`, `key_release`, `restore`, `matrix`,
  `chord`) — hard loss on stock; absent from the stock manifest, and BACK-05 /
  SKILL-01 in Phase 8 carry the runtime and playbook halves.
- **`vice_sid_get_state`** — hard loss (write-only registers, no SID command).
  `vice_sid_set_state` is a memory write and belongs with Phase 5's chip-state
  work.
- **`vice_machine_config_get`/`set`** — `RESOURCE_GET`/`SET`; Phase 6 (GAIN-07),
  which owns the allow-list and the power-cycle denials.
- **Reconciling the roadmap with this phase's two surface changes** — DIRECT-06's
  detach half moving to Phase 7 (D-13) and BACK-02's exception for
  `vice_snapshot_list` (D-16). Both are roadmap edits through `gsd-sdk`
  handlers, not phase work.
- **Skill playbook revision for D-01 and D-05** — the answer-shape drift and the
  read-halts-the-machine divergence both land on SKILL-01 in Phase 8, which was
  scoped for capability gaps only. Phase 8 planning must widen it.

### Reviewed Todos (not folded)

None of the four pending todos matched Phase 3's scope on inspection —
`todo.match-phase` scored all four at 0.6 on generic keywords ("stock",
"phase", "gate"), not on substance:

- **`2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`**
  (high) — Phase 2's backend discriminator is unverified against a real binary.
  Belongs with whichever session has a real stock **and** fork build reachable;
  it is a Phase 2 verification debt, not Phase 3 work.
- **`2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`** (high) —
  the three VERIF-02 fixtures are synthetic. Same disposition: Phase 2
  verification debt, blocked on the same missing prerequisite.
- **`2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md`** — CI runs bare
  `npm test` while Phase 2 introduced `npm run test:automated`. A CI-config
  question with release consequences; not Phase 3 scope, but Phase 3's own gate
  is `npm run test:automated`, so the mismatch persists through this phase.
- **`2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`** (low) —
  already user-dispositioned as not-a-bug; the three suites stay manual.
  Relevant to Phase 3 only as the definition of the automated gate.

</deferred>

---

*Phase: 3-Direct Tools*
*Context gathered: 2026-08-14*
