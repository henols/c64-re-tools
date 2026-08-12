---
title: Milestone intent — switchable stock-VICE backend (captured from an aborted /gsd-new-milestone run)
date: 2026-08-11
context: /gsd-new-milestone "implement an interface to the stock vice but make it switchable" — halted at the project_exists gate
status: intent captured, not yet a milestone
---

# Milestone intent: switchable stock-VICE backend

`/gsd-new-milestone` was invoked with the scope *"implement an interface to the stock
vice but make it switchable"* and **halted at its validation gate**: `PROJECT.md`,
`MILESTONES.md`, `STATE.md`, and `config.json` do not exist
(`gsd-sdk query init.new-milestone` → `project_exists: false`, `state_exists: false`,
`latest_completed_milestone: null`). The brownfield milestone workflow has no project
record to attach to.

User elected to **run `/gsd-new-project` first** rather than bootstrap `PROJECT.md`
from the existing intel. This note preserves what was gathered so it does not have to
be re-elicited.

**No milestone artifacts were written.** No `PROJECT.md`, `STATE.md`,
`REQUIREMENTS.md`, or `ROADMAP.md`; nothing committed.

## Milestone scope as stated

Implement a client interface to **stock upstream VICE** (via its binary monitor)
while keeping the existing custom-fork backend available — i.e. a **switchable
backend**, not a replacement.

This matches the dual-backend recommendation in
`.planning/notes/stock-vice-migration-revised-loss-ledger.md`, reached independently
during the preceding exploration session.

## Decisions taken (see also the Resolutions section of `.planning/intel/requirements.md`)

### Switching mechanism: project-level, one backend per project

Chosen once in `.mcp.json` / config (e.g. `VICE_BACKEND=stock|fork`) and fixed for the
MCP server process. Switching means editing config and restarting.

```jsonc
// .mcp.json
{
  "mcpServers": {
    "vice": {
      "env": { "VICE_BACKEND": "stock" }
    }
  }
}
```

Rejected alternatives, recorded for the ADR:

- *Backend follows the emulator (probe at launch + explicit override)* — richer UX,
  best serves "install stock VICE and go", but adds detection machinery.
  **→ REVERSED by D-07's sibling decision D-01 (2026-08-12): this is now the chosen
  mechanism.** The backend is **detected** once when the broker first starts and
  cached; `VICE_BACKEND` becomes an explicit **override**, not a required setting.
  BACK-01 still holds — one config value still switches backends. The detection
  machinery priced in above turned out to be a single cached probe. The
  discriminator is `-mcpserver`, not `-binarymonitor` (the fork accepts both).
- *Explicit per-instance at launch* (`vice_start({ backend })`) — fully deterministic,
  allows both backends concurrently. **Still rejected.**

**Known consequence of the project-level choice:** you **cannot run both backends
side by side** in one server process. That directly affects
`CAND-phase6-verify`, whose stated acceptance is "diff outputs against the current
`-mcpserver` behavior for a known program" — the parity harness will need to drive
two separate server processes (or two config states sequentially) rather than
switching backends in-process. Worth designing for explicitly rather than
discovering during Phase 6.

### Stock-only gains: all three groups IN SCOPE

Not parity-first. CPU-history tracing, 1541 drive-CPU debugging, and
raster-precise checkpoints + `PALETTE_GET` + full `RESOURCE_GET/SET` are all in
scope. This makes the milestone materially larger than
`docs/roadmap-stock-vice.md`'s 7-phase plan, which included none of them.

Hard constraint attached: **`CPUHISTORY_GET` (0x86) requires VICE ≥ 3.10.**
Debian trixie/forky/sid and all current Ubuntu ship 3.9, which lacks the opcode.
Detect via `VICE_INFO` (0x85) + trial 0x86; degrade gracefully.

### Degraded-tool policy: keep every tool, annotate per backend — **REVERSED by D-07 (2026-08-12)**

> **This section is no longer authoritative.** Phase 2 decision D-07 reverses it:
> the manifest **is** trimmed per backend, permanently, and the two backends
> expose different tool lists. What survives from this section: the rejection of
> a single backend-agnostic `degraded` flag (still lossy), and the requirement
> that the user be told which backend restores a capability — which now lands as
> documentation (DIST-01) plus an out-of-manifest call error (BACK-05).
> See `.planning/phases/02-stock-backend-connection/02-CONTEXT.md` D-07/D-08/D-09.

~~No tool is removed from `tools-manifest.json`. Support is annotated **per backend**,
so the client can tell the user which backend restores a capability. A single
backend-agnostic `degraded` flag was rejected as lossy; removing tools was rejected
because the surface would change shape between backends.~~

### SID read-back: no mitigation to build

Switchability supersedes ingest question 2 / WARNING W1. SID work routes to the fork
backend, which retains `vice_sid_get_state`. Do **not** build the client-side
write-shadowing mitigation. `CON-sid-readback-hard-loss` remains accurate as a
statement about the stock backend specifically.

## Carry-forward for `/gsd-new-project`

Context that already exists and should not be re-derived:

- `.planning/codebase/` — full codebase map (architecture, stack, conventions,
  integrations, testing, concerns)
- `.planning/intel/` — 11 decisions, 14 constraints, 7 `CAND-*` scope items, plus the
  Resolutions section added 2026-08-11
- `.planning/notes/stock-vice-migration-revised-loss-ledger.md` — corrected loss
  ledger, the VICE ≥ 3.10 finding, dual-backend rationale
- `docs/` — the ADR (`roadmap-stock-vice.md`), SPEC (`phase0-binmon-findings.md`,
  **contains 3 known errors**), and DOC (`stock-vice-parity.md`)
- Shipping history: git tags through `v0.1.10`; `@henols/vice-mcp` and
  `@henols/c64-re-tools` published at 0.1.1

Version suggestion when the milestone is eventually created: **v0.2.0** (backend
architecture change on a 0.1.x line).

Still open, unaffected by the above:

1. `CON-probe-outstanding` — `.claude/mcp/vice/probe-binmon.mjs` has never been run
   against a real build. Gates the timing-tool design.
2. 5 of 7 `CAND-*` items have no acceptance criteria. These resolutions settle scope,
   not acceptance bars.
3. `docs/phase0-binmon-findings.md` is normative (W2) and wrong in three places —
   fix before planning derives from it.
