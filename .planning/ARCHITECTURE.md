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
