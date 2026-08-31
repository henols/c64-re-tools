# c64-re-tools Architecture

## Purpose

This document defines the stable architectural boundaries for `c64-re-tools`.
It complements `.planning/PROJECT.md`: `PROJECT.md` owns project scope, milestone state,
requirements, constraints, and decisions; this file makes the enduring runtime and module
boundaries explicit so implementation plans can be checked against them consistently.

## Architectural Principles

1. Preserve a clear separation between MCP tool routing, backend transport, derived tools,
   emulator lifecycle management, and host/container boundary handling.
2. Keep backend-specific behavior behind explicit seams.
3. Never advertise a capability that the selected backend cannot honestly provide.
4. Prefer one authoritative source for capability, path, and protocol facts rather than copies.
5. Treat live emulator behavior and external tools as part of the architecture's verification
   surface, not merely as optional integration tests.

## Runtime Topology

```text
Claude Code / MCP client
        |
        v
stdio MCP proxy
        |
        v
backend selection
        |
        +----------------------+----------------------+
        |                                             |
        v                                             v
Stock VICE backend                              Fork VICE backend
(binary monitor)                                (HTTP MCP endpoint)
        |                                             |
        v                                             v
upstream x64sc                                  barryw/vice-mcp VICE
```

Backend selection is project-level for one MCP server process. The selected backend owns the
runtime capability surface for that process.

## Direct Tool Flow

Direct tools map to a backend operation and follow the normal forwarding path.

```text
tool call
  -> MCP dispatch
  -> forwardToVice()
  -> argument/path rewriting where required
  -> vice.ts call() transport seam
  -> selected backend
```

### Rule A1 — Direct transport seam

Direct tools may use `vice.ts`'s `call()` seam for backend transport.

### Rule A2 — Do not bypass the transport seam casually

A direct tool must not open its own emulator connection when the existing backend transport can
serve the operation. A new transport path requires an explicit architecture decision.

## Derived Tool Flow

Derived tools are implemented client-side from lower-level emulator primitives.

```text
tool call
  -> MCP dispatch
  -> derived-tool interception
  -> client-side implementation
  -> backend primitive(s), if required
```

### Rule A3 — Derived tools intercept before `forwardToVice()`

Derived tools MUST be intercepted before `forwardToVice()` performs argument rewriting.

Reason: host-path rewriting happens before the backend `call()` seam. A client-side derived tool
placed behind `call()` can receive host-translated paths and then incorrectly act on them inside
the container.

### Rule A4 — Keep derived implementations outside the proxy monolith

New client-side derivations should live in dedicated sibling modules rather than growing
`vice-proxy.ts` indefinitely. `vice-proxy.ts` remains the routing surface, not the home for all
backend-specific logic.

## Backend Capability Model

The stock and fork backends intentionally expose different tool surfaces.

### Rule A5 — Honest per-backend exposure

A backend must advertise only tools it can actually serve.

A tool available on both backends must preserve:

- its tool name;
- backward-compatible argument shapes;
- existing required arguments;
- compatible result semantics unless explicitly versioned or documented.

### Rule A6 — Capability metadata has one authoritative source

Backend support metadata must come from the project's canonical capability registry and/or
backend manifests. Do not create hand-maintained duplicate support tables.

Generated documentation should be derived from those sources and drift-checked.

### Rule A7 — Refuse unsupported capabilities explicitly

When a capability is unavailable on the selected backend, fail by name with an actionable message
that states the supported route where one exists. Do not silently emulate a capability if doing so
would produce weaker or misleading semantics.

## Stock VICE Binary Monitor

The binary-monitor protocol is normative infrastructure.

### Rule A8 — Request correlation is request-id first

Unsolicited events must never satisfy a pending request. Demultiplex responses by request id before
interpreting response type.

### Rule A9 — Preserve settled wire facts

The project currently relies on these settled protocol facts:

- 11-byte request header;
- 12-byte response header;
- little-endian multi-byte fields;
- unsolicited messages use request id `0xffffffff`;
- five known unsolicited event types are handled;
- `JAM` has a zero-length body;
- wire memspace ids are not the internal VICE enum;
- `CPUHISTORY_GET` counts must be clamped to 65535 client-side.

Changing any settled wire assumption requires new external evidence and an explicit recorded
architecture/protocol decision.

### Rule A10 — One binary-monitor client per emulator instance

Stock VICE services exactly one binary-monitor client. The broker must preserve single-client
ownership and must not classify a queued second connection as an emulator wedge.

## Broker Architecture

### Rule A11 — Single-owner launch guard

The broker's `inFlight` launch guard must remain a synchronous check-and-set with no `await`
between ownership check and ownership acquisition.

This is a concurrency invariant, not an implementation preference.

### Rule A12 — Incident evidence precedes destructive recovery

When an emulator is judged crashed or wedged, write or preserve the incident evidence before
killing/recycling the process.

### Rule A13 — Backend launch arguments are contract surface

Backend-specific launch flags and ordering that are regression-pinned must not be casually
reordered. Changes require a live broker launch test where the behavior depends on VICE startup.

## Host / Container Boundary

### Rule A14 — Translate host paths exactly at the boundary

All host-facing paths and hostnames must go through the existing path/boundary abstractions such as:

- `hostpath.ts`;
- `containerpath.ts`;
- `container-guard.mts`.

Do not add ad-hoc path rewriting inside individual tools.

### Rule A15 — Preserve the closed consumer set

If a new module consumes host-path translation logic, update the architectural guard/test that
tracks the allowed consumer set.

### Rule A16 — Container-side static analysis remains container-side

Static-analysis backends such as regenerator2000 should run on the same side of the boundary as the
MCP proxy unless an explicit architecture decision changes that model. Host-path translation must
not be applied to container-local analysis paths.

## External Tool Boundaries

External tools are part of the system's correctness model where they provide an independent oracle.

Examples include:

- stock VICE for binary-monitor behavior;
- ACME for assembler/reassembly correctness;
- package-manager/fresh-container installs for installation claims;
- regenerator2000 for static-analysis behavior.

### Rule A17 — Do not replace an external oracle with a same-assumption mock

Mocks and synthetic fixtures are useful for speed and fault injection, but they do not replace a
real external oracle when acceptance depends on the external program's actual behavior.

## Static Analysis / regenerator2000

For the v0.3.0 direction:

### Rule A18 — Static-analysis-only integration

regenerator2000 is a static-analysis backend. It must not be launched with `--vice` unless a future
architecture decision explicitly changes this project boundary.

### Rule A19 — Queryable annotation state is authoritative analysis state

Labels, comments, scopes, block types, and related recon findings should be stored in the chosen
queryable annotation model rather than existing only as Markdown prose when the milestone delivers
that capability.

### Rule A20 — Symbol round trip must use explicit adapters

Static-analysis symbols exported to VICE and live-discovered symbols imported back into the
annotation model must flow through explicit conversion/adapter code. Do not make either side parse
the other's internal representation directly.

### Rule A21 — One long-lived regenerator2000 child per project path, per proxy process

⚠ **SUPERSEDED 2026-08-30 (Phase 29, plan 29-10, commit `1d40ad0`) — this rule governed a
subsystem that no longer exists.** Kept as a dated record rather than deleted, on the same
keep-dated precedent as `CORE-01` and `D-36`: the rule number is cross-referenced by number
(`.planning/ROADMAP.md` § Phase 32 names "Rule A21"), and deleting it would erase the record
that this project once chose a long-lived child process and then reversed that choice on
measured grounds.

**What the rule said, in the past tense.** At most one live regenerator2000 child existed per
`vice-proxy.ts` process, keyed on `resolveStorePath()`'s output (D18-04). It was opened lazily
on the first `r2000_*` call that needed it and never at tool-registration time (D18-03). It was
killed only through the retained `ChildProcess` handle, never by a stored pid (D18-21). It was
never spawned from a module other than `r2000-mcp-client.ts` (D18-02). Rule A18's `--vice`
prohibition was unchanged and unaffected by this rule, and still stands on its own.

**Why it is superseded.** Phase 29 deleted the binary-driving glue, `r2000-mcp-client.ts`
included, and `resolveStorePath()` went with it — so every clause above now names a symbol or a
module that is not on disk. Phase 29's own `D-06` reversed this rule explicitly and on the
record, choosing open/close per call with an explicit store-path argument on every verb
(`openStore(path, { workspaceRoot })` and `closeStore` in a `finally`, no cross-call state
anywhere). A21's whole premise was avoiding a per-call child-process respawn; Phase 29's `D-01`
and `D-02` deleted the child process, so the premise is gone rather than outweighed.

**What replaced it: nothing of the same kind.** The successor `anno_*` family reaches a
proxy-local SQLite annotation store in-process, opened and closed inside the runner itself.
There is no child process to keep alive, so there is no one-per-project-path invariant left to
state. Two Phase 28 hazard classes A21's session model exposed — `revertTo` returning a new
handle, and a `transactionStateUnknown` connection being reused — became unreachable across
calls by construction rather than guarded.

**Reversal condition.** This rule returns only if a long-lived child process is reintroduced
behind the annotation surface — for instance if per-call open/close is measured to be the
dominant cost of a real recon session and a cached handle is added back, which Phase 29's `D-06`
records as reversible ("adding a cache later is local"). A reintroduced child would need these
four clauses restated against the new module rather than inherited from this record.

## Dependency Direction

The intended dependency direction is:

```text
MCP routing / orchestration
        |
        +--> direct transport adapters
        |
        +--> derived-tool modules
        |
        +--> capability registry
        |
        +--> broker lifecycle
        |
        +--> boundary/path adapters

backend adapters
        |
        +--> stock protocol client
        +--> fork HTTP client

static-analysis adapters
        |
        +--> regenerator2000 integration
```

Avoid circular dependencies between routing, transport, broker, and derived-tool modules.

## Architecture Change Procedure

If a plan requires violating one of these rules:

1. identify the rule by id;
2. explain why the existing architecture cannot support the requirement;
3. list at least one alternative that preserves the rule;
4. record the proposed architecture change in planning context/decision history;
5. add or update a regression guard that makes the new rule machine-checkable where practical;
6. only then implement the change.

A convenience-driven violation is not sufficient justification.

## Architecture Change Record

**Dated 2026-08-24 — Phase 18 reverses D-17 and D-18.** This record executes the
six-step Architecture Change Procedure above for that reversal.

1. **Identify the decisions by id.** `D-17` and `D-18` (Phase 11,
   `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/11-CONTEXT.md`)
   are reversed by Phase 18. D-17 fixed regenerator2000's lifecycle as
   **per-call**: spawn, load, mutate, `r2000_save_project`, exit — no
   long-lived child, no process supervision, no second wedge class. D-18
   built the curated tool surface on top of that assumption. `r2000-mcp-client.ts`'s
   own header states the reversed lifecycle: this repo must spawn
   `regenerator2000 --mcp-server-stdio`, send it JSON-RPC requests, and trust
   (or refuse to trust) its answers, once per `withR2000Session()` call, with
   no long-lived child and no supervision. Phase 18 reverses that: one
   `regenerator2000 --mcp-server-stdio` child now stays alive across many
   `r2000_*` tool calls inside the already-running `vice-proxy.ts` process.

2. **Why the existing architecture cannot support the requirement.** SESS-01
   requires a regenerator2000 project to stay open across a whole working
   session instead of being respawned per tool call — a session-model
   mismatch the per-call lifecycle cannot serve. Cursor-shaped tools
   (`jump_to_address`, `get_disassembly_cursor`, `read_selected`) are
   meaningless under a per-call spawn: there is no cursor to hold between
   calls when the process holding it exits after every one. The project's
   own text already concedes the respawn cost: `src/skills/c64-program-recon/SKILL.md`
   states, for `r2000_batch_execute`, that "batching is what makes that
   affordable under the per-call spawn-load-mutate-save-exit lifecycle" —
   an admission that anything short of batching is not affordable under
   D-17 as written.

3. **The alternative that preserves the original safety property.** The
   safety property D-17/D-18 existed to protect is **durability** — no
   annotation is lost to a crashed or wedged child. The alternative that
   preserves it unchanged, without preserving the per-call lifecycle itself,
   is D18-08's save-per-mutation invariant: every mutating `r2000_*` call
   still calls `r2000_save_project` inside the same session before that tool
   call resolves to its caller, identically to today, byte-for-byte. The
   internal auto-save stays a plain `save_project`, never `saveAndVerify()` —
   `saveAndVerify()` remains reserved for `r2000_save_project` invoked as the
   outer tool by name, since an idempotent mutation legitimately produces an
   unchanged hash and `saveAndVerify()`'s contract is to throw when the hash
   does not change. Persistence changes process **lifetime**, not the
   durability **contract**.

4. **Record the change in decision history.** The full decision record for
   this reversal is
   `.planning/phases/18-persistent-session-and-tool-surface/18-CONTEXT.md`,
   decisions D18-01 through D18-36 — session placement (D18-01–D18-07), save
   discipline (D18-08–D18-09), crash detection and restart (D18-10–D18-14),
   concurrency (D18-15–D18-19), process ownership (D18-20–D18-23), the tool
   surface (D18-24–D18-31), project settings at session open
   (D18-32–D18-35), and this reversal record itself (D18-36). The
   project-wide decision rows live in `.planning/PROJECT.md`'s Key Decisions
   table, including `D-36` (allocated by this same plan, superseding `D-32`).

5. **Regression guards this phase lands, and what each catches.**
   `src/mcp/vice/r2000-session.test.ts` is D18-09's three-scenario
   planted-violation save-discipline gate (plan 18-03 task 2) — proving a
   mutation survives a direct `SIGKILL` of the child immediately after the
   mutating call resolves, that short-circuiting the internal save makes the
   same test fail (non-vacuity), and that a mid-window crash between the
   mutating call and its own save surfaces a named error with the file on
   disk left unchanged — and D18-19's lost-update planted-violation gate
   (plan 18-06), proving two concurrent mutating calls against the same
   address both land under the seam's lock and that removing the lock makes
   the same test go red. `src/mcp/vice/r2000-spawn-seam.test.ts` keeps its
   existing two-entry spawn-site set unchanged in shape and gains a new
   session-reuse fixture (plan 18-03 task 3) proving the long-lived path
   still calls `assertNoViceFlag()` before spawning. Step 5 of this procedure
   is satisfied by those guards being landed and proven non-vacuous by
   planted violation, not by this document asserting they exist.

   *Addendum, 2026-08-29 (phase 29, plan 29-05). The two sentences above are
   the Phase 18 record and are left as written. What they point AT has moved,
   and a pointer that no longer resolves is what this addendum exists to stop:
   `src/mcp/vice/r2000-spawn-seam.test.ts` is now `spawn-seam.test.ts` — a
   rename only, because the discipline it guards (no shipped module spawns a
   child that touches VICE) outlives the substrate it was written against.
   `src/mcp/vice/r2000-session.test.ts` is deleted with the session primitive
   in plan 29-10 and is NOT renamed; the surviving guard that carries the
   save-discipline half of step 5 forward is `anno-durability.test.ts`, the
   owned annotation store's crash-durability gate, which proves by planted
   violation that a mutation is on disk when the mutating call resolves. Those
   two names — `spawn-seam.test.ts` and `anno-durability.test.ts` — are what
   `docs-absorbed-decisions.test.ts`'s `GUARD_FILENAMES` checks this section
   for by containment.*

6. **Only then implement.** Plan 18-03 is the first implementing plan of this
   reversal — it lands `r2000-session.ts`, the long-lived session primitive,
   and the D18-09 save-discipline gate before anything else in this phase
   depends on the session.
