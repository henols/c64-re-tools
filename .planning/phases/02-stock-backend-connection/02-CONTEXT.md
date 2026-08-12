# Phase 2: Stock Backend Connection - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The server can be pointed at a stock VICE and hold a correct, correlated,
event-demultiplexed conversation with it.

Three work streams, largely independent: (a) the framing/correlation/demux
protocol client and its test fixtures, (b) broker launch flags plus single-client
ownership, (c) backend detection/selection and the connect handshake — (c)
consumes (a)'s handshake, so it lands last.

**In scope:** BACK-01..04, PROTO-01..08, BROK-01..03, VERIF-02.

**Not in this phase:** the tools themselves (Phases 3-7), the per-backend
capability matrix and its error text (BACK-05, Phase 8), timing routes (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Backend selection and reporting

- **D-01: Backend is DETECTED, not defaulted.** The broker works out what the
  `x64sc` binary is once, when it first starts, and remembers the result.
  `VICE_BACKEND` becomes an **explicit override**, not a required setting.
  BACK-01 still holds — one config value still switches backends, it just is not
  mandatory.
  - **This reverses** the milestone-intent note's recorded rejection of
    *"backend follows the emulator (probe at launch + explicit override)"*
    (`.planning/notes/milestone-intent-switchable-stock-vice-backend.md:52-57`).
    That note is **no longer authoritative** on this point. The reason for the
    reversal: it is what actually serves "install stock VICE and go", and the
    detection machinery the note priced in is a single cached probe.
  - Supersedes an earlier answer in this same discussion ("default to stock"),
    which is now moot — there is no fixed default to migrate anyone onto.

- **D-02: The discriminator is `-mcpserver`, not `-binarymonitor`.** The fork is
  built on a 3.10 tree and accepts **both** flags; stock accepts only
  `-binarymonitor`. So: binary accepts `-mcpserver` → fork, otherwise → stock.
  A fork binary driven with the stock protocol is a legitimate configuration and
  is exactly what the override exists for (it is the only way to exercise stock
  paths on a fork-only host).

- **D-03: Probe mechanism is the planner's call.** Trial launch (spawn with
  `-mcpserver`, watch it fail, respawn) and `-help`/`-?` flag introspection are
  both acceptable. Only the **cached result** matters. Constraints on it:
  - Runs **once when the broker first starts**, not per acquire, not per connect.
  - Cached under `.vice-supervisor/`, keyed so a binary replaced in place is
    noticed (path + version quad, not path alone).
  - Must **not** sit inside `broker-launch.mts`'s `inFlight` critical section.
    If a trial launch is used, both spawns are one logical launch under a single
    guard acquisition — never two racing spawns. See the 2026-08-01 outage.

- **D-04: One broker only ever launches one kind of binary.** Backend is fixed
  once per broker, so fork and stock instances can never coexist in a broker's
  port band. Nothing downstream needs to tell two launch shapes apart.

- **D-05: BACK-03 surfaces as fields on the existing `vice_ping`** — backend,
  VICE version, resolved binary path. No new tool. `vice_ping` is what an agent
  already calls first when something looks wrong, and `vice-wedge-triage`'s
  opening move already lands there. Its response shape grows; the manifest and
  any test asserting on it move with it.

- **D-06: One-time stderr note when `VICE_BACKEND` is unset**, naming the
  detected backend and how to override it. Follows `repo-root.ts`'s existing
  one-time-warning pattern (`warnedEnvOutsideFrom` / `warnedNoMarkerFound`).

### Tool surface per backend — REVERSES A LOCKED DECISION

- **D-07: The manifest is trimmed per backend, permanently.** Stock advertises
  only the tools it actually implements. The two backends genuinely expose
  **different tool lists**. This is the shipped end state, not scaffolding —
  confirmed after the conflict below was raised explicitly.

- **D-08: This contradicts artifacts that have not yet been updated.** The
  planner must not treat the following as still-authoritative on tool-surface
  shape; they say the opposite and need editing to match D-07:
  - `.planning/ROADMAP.md` "Standing Constraints" — *"The stdio MCP surface must
    not change. Same tool names and argument shapes across both backends, so the
    six skills keep working."*
  - `.planning/ROADMAP.md` Phase 8 success criteria 1 and 2 — *"no tool is
    removed and no single backend-agnostic flag is used"*, and BACK-05's
    "returns an error naming the capability" (with the tool absent, there is no
    call to return that error).
  - `.planning/REQUIREMENTS.md` DIST-01 and BACK-05.
  - `.planning/notes/milestone-intent-switchable-stock-vice-backend.md:78-83`
    — *"Degraded-tool policy: keep every tool, annotate per backend."*
  - `CLAUDE.md` **Compatibility** constraint — *"The stdio MCP surface Claude
    sees must not change — same tool names and shapes across both backends."*
  - **Knock-on:** skills written against the full surface now **break** on stock
    rather than degrade. SKILL-01 (Phase 8) grows accordingly.
  - **Action required before planning Phase 8**, and ideally before planning
    Phase 2: reconcile ROADMAP.md and REQUIREMENTS.md via `gsd-sdk` roadmap
    handlers. Not done from inside discuss-phase.

- **D-09: Listing was already static — dispatch is what differs.**
  `tools-manifest.json` is committed and `vice-proxy.ts` answers
  `initialize`/`tools/list` from it locally on both paths today;
  `refresh-manifest.ts` is a manual regeneration step, not a runtime call. So
  D-07 is a change to **which entries the manifest carries per backend**, plus a
  stock dispatch path that routes each listed tool to a binmon command or a
  client-side derivation. There must be **no fall-through** from the stock
  dispatch path to the fork's HTTP forward.

### Connect handshake and capability gating

- **D-10: Version-gated capabilities fold into the same cached probe.**
  Determined once per binary and remembered under `.vice-supervisor/` — not per
  connect. Cache keying must catch a binary replaced in place, or a build
  upgrade goes unnoticed.
  - Phase 1 proved the signal is clean: `CPUHISTORY_GET` returns `0x83`
    (opcode absent) on stock 3.9 and `OK` on the 3.10 fork; both report
    `api_version 0x2`. `0x8f` is the distinct "not compiled in" case.
  - This is what satisfies BACK-04 ("at connect time rather than at first use")
    and pre-answers GAIN-02's absent-vs-not-compiled-in distinction in Phase 6.

- **D-11: PROTO-06 rides the socket lifecycle.** A TCP close or reset is
  unambiguous and immediate — every in-flight request rejects with a
  died-underneath error, and a timeout stays reserved for "connected but
  silent". No epoch polling on the stock path.
  - Consequence to handle: a broker relaunch on the same lease is a **new
    machine with fresh state**. The client must invalidate its connect-time
    record and re-handshake. `MachineRestartedError` already models this on the
    fork path — reuse the type, do not invent a second one.

### Broker: launch flags, ownership, port allocation

- **D-12: Stock launches with the binary monitor only** — `-binarymonitor` plus
  `-binarymonitoraddress` on the broker-allocated port. No `-remotemonitor`, no
  `-warp`. Phase 7 may need the text monitor for the stopwatch route and will
  revisit launch flags then; the roadmap already says not to block on it here
  (`.planning/ROADMAP.md:247`).

- **D-13: Exclusivity is enforced broker-side — the lease is the owner.** The
  broker's instance record is extended with "this instance has a monitor
  client"; a second acquire is refused with an ownership conflict naming the
  holder. Nothing ever reaches a second `connect()`, so the
  no-reply-no-EOF state that is indistinguishable from a wedge **cannot be
  entered**. No client-side timeout heuristic — that would be a guess on
  exactly the signal that has no distinguishing shape.

- **D-14: Ports are allocated, never contested.** If a port the broker wants is
  occupied, it launches on a **free** port and records the actual port. It does
  not probe, judge, or kill whatever is sitting there. An occupied port that
  answers nothing recognisable is simply skipped.

- **D-15: Ownership is the broker's own allocation record — not argv
  archaeology.** A process is ours because the broker allocated its port and
  launched it, read from its own records. This is the same connection agreement
  the MCP path already uses. Anything on a port the broker did not allocate is
  out of scope **by construction**.

### Protocol client

- **D-16: Vendor `henols/c64-debug-mcp`'s `src/vice-protocol.ts`, fixing on the
  way in.** Same author, MIT, no deps. Fix both known defects during the copy:
  the zero-length `JAM` read, and the throw-on-bad-STX that never advances the
  buffer. Keep header attribution. Then add: generalised `related[]`
  accumulation, the command→expected-response table, a connect epoch, the
  `api_version === 2` assertion, and a desync counter.
  - Known cost, accepted: it arrives in another repo's conventions (quoting,
    error classes, header-comment style) and this codebase is strict about
    those. Align it to `ViceError` subclasses and the single-seam header-comment
    convention as part of landing it, not as a follow-up.

- **D-17: Never mint request id `0xffffffff`; keep the id a full uint32.**
  Five unsolicited types arrive at that id, and `CHECKPOINT_INFO` (0x11) /
  `REGISTER_INFO` (0x31) **share a response type with a legitimate reply** —
  demux keys on request-id and never resolves a pending request with an event.

- **D-18: Size the read buffer and fixtures against `DISPLAY_GET` (~157 KB),
  not `MEM_GET`.**

### Testing

- **D-19: Record everything a real emulator will produce.** Extend
  `probe-binmon.mjs` with a capture mode and commit real frames for every VERIF-02
  case the emulator can actually generate; synthesise only the impossible ones
  (duplicate reply on a settled id, mid-stream desync, error typed `0x00` — a
  healthy emulator never emits these).
  - Accepted costs: a ~157 KB binary fixture in git, and fixtures acquire
    provenance and staleness of their own — record which build and date each
    was captured from.
  - Capture hazard: the fork build produced a `CHECKPOINT_INFO ×18` flood during
    Phase 1's fire test (`docs/phase1-probe-results.md` "Anomaly observed on the
    fork build"). Bound the capture.

### Claude's Discretion

- The probe mechanism itself (trial launch vs `-help` introspection) — D-03.
- Exact cache-key composition for the probe result, subject to D-03's
  replaced-in-place requirement.
- Module layout for the vendored client and the stock dispatch path, subject to
  the standing constraint that client-side derivations go in sibling modules and
  are never appended to `vice-proxy.ts` (already 160 KB / ~3,093 lines).

### Folded Todos

- **`2026-08-12-broker-orphan-reap-substring-identity-match.md`** (high) —
  `discoverBandProcesses()` at `.claude/mcp/vice/broker-kill.mts:489` picks
  SIGTERM/SIGKILL targets by plain substring match on any host process's full
  argv, gated only by "some integer ≥ basePort appears somewhere". Shipped code,
  runs on every broker start (unconditional startup reap, criterion I / D-15).
  Phase 2 adds a second launch shape to that band. **Resolved by D-14 + D-15**:
  the substring match and the `>= basePort` gate both disappear, replaced by the
  broker's own allocation record with nothing heuristic in their place.

- **`2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`** (low, but
  load-bearing here) — `vice-broker-launch.test.ts`, `vice-proxy.test.ts` and
  `broker-e2e.test.ts` never finish outside the devcontainer, so `npm test`
  times out rather than reporting. Already user-dispositioned as **not a bug**:
  they depend on manual host setup and are not automatable. Phase 2 needs this
  settled because **BACK-02's criterion is "the existing suite passes
  unchanged"** — without a defined gate that criterion cannot be verified.
  Exclude the three from the automated gate and treat them as manual; the gate
  is the other 21 files (294 tests, 0 failures as of 2026-08-12, `aff8117`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Protocol (normative)
- `docs/phase0-binmon-findings.md` — the normative protocol document (normative
  by ingest resolution W2). §5 carries the confirmed opcode set and error codes.
  Corrected in Phase 1; its four verified errors are fixed.
- `docs/stock-vice-parity.md` — per-capability parity between the fork and stock
  backends; §A.7 licenses the expected divergences.
- `docs/phase1-probe-results.md` — **what a real build actually did.** api
  version, version quads, `CPUHISTORY_GET` outcome per build, `DISPLAY_GET`
  geometry, `PALETTE_GET` count, the observed unsolicited event sequence, and
  the fork's `CHECKPOINT_INFO` flood anomaly. Ground truth for D-10 and D-19.
- `docs/roadmap-stock-vice.md` — the ADR (status: proposed). Superseded on the
  tool-triage point by ingest resolution W1.

### Milestone decisions and their reversals
- `.planning/notes/milestone-intent-switchable-stock-vice-backend.md` — **read
  with D-01 and D-07 in hand.** Its "switching mechanism" section is reversed by
  D-01; its "degraded-tool policy" section is reversed by D-07. Everything else
  in it stands.
- `.planning/notes/stock-vice-migration-revised-loss-ledger.md` — the corrected
  loss ledger, the VICE ≥ 3.10 finding, the dual-backend rationale. Its CONFLICT
  and REFINEMENT blocks are Phase 7's problem, not this phase's.
- `.planning/intel/constraints.md` — the CON-* blocks, brought into agreement
  with the corrected docs in Phase 1.
- `.planning/intel/decisions.md` — DEC-preserve-mcp-surface and
  DEC-tool-triage-abc; both predate D-07.
- `.planning/INGEST-CONFLICTS.md` — the W1/W2 resolutions.

### Code the phase touches
- `.claude/mcp/vice/vice.ts` — the transport seam and `call()`; `mcpHost()`'s
  header documents the three-inlined-copies incident that governs how
  `VICE_BACKEND` must be read (one seam, not ~30 call sites).
- `.claude/mcp/vice/vice-proxy.ts` — the sole tool-surface seam; answers
  `tools/list` from the manifest, dispatches `tools/call`. `rewriteArguments()`
  at line 2773 runs **inside** `forwardToVice()` and **before** `call()`.
- `.claude/mcp/vice/tools-manifest.json` — committed, static, 63-tool surface.
  D-07 makes it per-backend.
- `.claude/mcp/vice/broker-launch.mts` — the `inFlight` single-owner launch
  guard. Synchronous check-and-set, no `await` between. Regression-tested.
- `.claude/mcp/vice/broker-kill.mts:489` — `discoverBandProcesses()`, the folded
  reap todo.
- `.claude/mcp/vice/vice-broker-client.ts` / `broker-control.mts` — the lease;
  the connection itself IS the lease.
- `.claude/mcp/vice/vice-sync.ts` — invariants that must survive: exactly one
  resume per wait; poll on `hit_count`, never on paused state; never delete a
  VICE-marked temporary checkpoint. Deliberately not unit-tested.
- `.claude/mcp/vice/incident-record.ts` — D-17 invariant: the record is written
  **before** any kill.
- `.claude/mcp/vice/probe-binmon.mjs` — gains a capture mode per D-19.

### Folded todos
- `.planning/todos/pending/2026-08-12-broker-orphan-reap-substring-identity-match.md`
- `.planning/todos/pending/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — layers, seams, the two named
  anti-patterns (re-deriving a cross-cutting seam; preemptive kill/relaunch).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`MachineRestartedError` (`vice.ts`)** — already models "the machine under
  you is not the machine you handshook with". D-11 reuses it rather than adding
  a second restart type.
- **`repo-root.ts`'s one-time-warning gates** — the exact pattern D-06 wants.
- **The broker instance record + lease (`broker-control.mts`,
  `vice-broker-client.ts`)** — D-13's ownership flag and D-14/D-15's allocation
  record both extend bookkeeping that already exists. No new mechanism.
- **`tools-manifest.json` + `refresh-manifest.ts`** — the manifest is already
  static and committed, so D-07 is an authoring change, not a new runtime path.
- **`probe-binmon.mjs`** — already speaks the wire protocol offline
  (`--selftest`); D-19's capture mode extends it rather than starting over.

### Established Patterns
- **Single seam per concern.** One transport, one repo-root resolver, one
  container detector, one deny-list. `VICE_BACKEND` gets **one** reader —
  `mcpHost()`'s header documents what happens otherwise.
- **Generated-but-committed artifacts.** `.mts` → `resources/*.mjs` via
  `build.ts`; `resources-sync.test.ts` fails CI on drift. Any broker change in
  this phase touches `.mts` sources **and** requires a rebuild of the committed
  `.mjs`.
- **No build step for the shipped server.** Container-side `.ts` runs under
  Node's native type-stripping; only host-bound `.mts` is compiled.
- **Never-throw boundary.** `vice-proxy.ts` registers global handlers first — a
  dead stdio server is never restarted by Claude Code for the rest of the
  session. Backend detection failure must not kill the process at startup.
- **Runtime narrowing at every JSON boundary** via `isPlainObject()`, not casts.

### Integration Points
- `vice.ts`'s `call()` — the transport swap for direct tools.
- `vice-proxy.ts`'s `tools/list` response — where D-07's per-backend trim lands.
- `vice-proxy.ts`'s `CallToolRequestSchema` override — where stock dispatch
  diverges from `forwardToVice()`.
- `broker-launch.mts` — D-12's flags and D-03's probe placement.
- `broker-kill.mts:489` — D-15 replaces the reap's identity test.
- `vice_ping`'s response shape — D-05.

</code_context>

<specifics>
## Specific Ideas

- *"Use the same connection agreement as the MCP does it"* — the user's framing
  for D-15. Ownership is established the way the MCP path already establishes
  it, not by inventing a process-identity heuristic.
- *"Try first to start VICE with the MCP flag and if it fails then we know it's
  stock VICE"* — the user's framing for D-01/D-02.
- *"It only needs to be done once when the broker is started for the first time
  and then it can remember what was started"* — D-03. The mechanism is
  explicitly not worth deliberating; the caching is.
- *"An instance of VICE that is started with an occupied port, we must launch it
  on a free port and the broker can keep track of that"* — D-14, verbatim
  intent.
- *"If it's the MCP it's just forward the tools, if stock the tools must be hard
  coded"* — the origin of D-07/D-09.

</specifics>

<deferred>
## Deferred Ideas

- **Text monitor (`-remotemonitor`) at launch** — raised under D-12 and left
  out. Phase 7 decides it by measurement when it picks a stopwatch route.
- **Launch-time warp (`-warp` / `InitialWarpMode`)** — no runtime `WarpMode`
  resource exists, so it can only ever be a launch-time choice. Not this phase;
  it would change emulation timing for every session, which is wrong for the
  raster-precise work in Phases 6-7.
- **Reconciling ROADMAP.md / REQUIREMENTS.md / the milestone-intent note /
  CLAUDE.md with D-07** — necessary, but a roadmap edit, not phase work. Must
  happen through `gsd-sdk` roadmap handlers before Phase 8 is planned.
- **Un-discussed and still open** (offered, user chose to proceed): whether the
  fork's own code may be touched at all under BACK-02; and how request ids are
  minted and bounded alongside any concurrent-in-flight limit, beyond D-17's
  "never `0xffffffff`, full uint32".

</deferred>

---

*Phase: 2-Stock Backend Connection*
*Context gathered: 2026-08-12*
