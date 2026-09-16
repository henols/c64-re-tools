---
created: 2026-09-11T16:23:31.049Z
title: Remove anno from the MCP surface; reach it via a stateless broker call
area: broker
severity: minor
files:

  - src/mcp/vice/vice-proxy.ts:3415-3440
  - src/mcp/vice/vice-proxy.ts:196-312
  - src/mcp/vice/anno-tools.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-store.ts:132-537

audit_acknowledged:
  milestone: v1.0.0
  at: 2026-09-16
---

## Problem

Owner's directive, verbatim: *"remove it from the mcp and it shall acces the broker
as a state less call"*.

Surfaced by `/gsd-explore` on 2026-09-11 ("is the anno a real part of the mcp and must
it have access to the vice emulator?"). The answer measured out as **yes to the first,
no to the second** — which is the whole reason the coupling is worth undoing.

**What is true today (measured this session, not inferred):**

- 25 `anno_*` tools are registered in `vice-proxy.ts:3438-3440` via `buildViceTool()`
  and are advertised in `tools/list` like any `vice_*` tool. It is a real part of the
  MCP surface, not a side channel.
- The family **never touches VICE**. The registration deliberately bypasses the
  manifest loop and `buildBackendAwareTool()`, so no `anno_*` runner can reach
  `forwardToVice()`, `call()`, or `ensureViceSession()` — satisfied *by construction*
  per the comment block at `vice-proxy.ts:3415-3437`, not by an interception.
- The only import from `vice.ts` anywhere in the ~50 `anno-*` modules is the
  `ViceError` base class (`anno-types.ts:114`, `anno-store.ts:192`). No transport.
- Backing store is a proxy-local `node:sqlite` file (`anno-store.ts`). The family is in
  **neither** `tools-manifest.json` nor `tools-manifest.stock.json`, because both are
  regenerated from a live host VICE's own `tools/list`.
- MEASURED 2026-09-11: with `x64sc` genuinely absent from `PATH` (both
  `/usr/local/bin` and `/usr/bin` excluded), `vice-proxy.ts` starts, and `tools/list`
  returns all **25** `anno_*` tools alongside **61** `vice_*` tools. A `tools/call`
  round trip executed entirely in-process and returned a domain refusal raised by
  `anno-store.ts`'s own path guard (`AnnoStorePathError`), never a wire error.
- `npx @henols/vice-mcp anno <verb>` (`vice-proxy.ts:273`) already runs the whole
  family as a CLI **above** the backend probe — no server, no socket, no emulator.

**The cost of the current coupling**, from that same measured run: a user who installed
this only to annotate a binary gets a tool list that is ~70% dead — 61 `vice_*` tools
that will all fail at the wire, next to 25 `anno_*` tools that work fine.

**What holds it in place:** D-06 at `vice-proxy.ts:198-206` — `vice-mcp anno <verb>` is
named there as the ONLY surface that resolves identically across the Claude Code plugin
route and both npm-installer routes, because `installer/bin/cli.mjs`'s
`viceServerEntry()` always launches the server via `npx` in both npm modes. Any design
that resolves a filesystem path to the seam silently fails for npm-installed users.
Whatever replaces the MCP registration has to survive that same three-route test.

## Solution

TBD — the directive names the destination ("the broker, as a stateless call") but not
the mechanism, and two readings are open. **Do not pick one without asking the owner.**

1. **Transport-only reading.** Drop the 25 `anno_*` tools from `tools/list`, and let
   callers reach the same runners through a stateless request to the host broker's TCP
   control listener (`vice-broker.mts`), one request → one reply, no lease, no session.
   Note the tension to resolve: the broker's existing contract is "the connection IS
   the lease" (`vice-broker-client.ts`) — a stateless anno call would be the first
   control-plane verb that deliberately holds none, so the listener has to tell the two
   shapes apart.
2. **Host-placement reading.** The point is *where the SQLite file lives*. Routing anno
   through the broker puts the store on the host side of the container/host split
   rather than inside the container, which is the same class of problem `hostpath.ts` /
   `containerpath.ts` already exist for. Under this reading the MCP removal is a
   consequence, not the goal.

Either way, these are settled and should not be re-litigated:

- CLAUDE.md's MCP-02 constraint ("derived tools must be intercepted before
  `forwardToVice()`") is currently satisfied for `anno_*` *by construction*, because the
  runner is never wired to `forwardToVice()` in the first place. Any rewiring through
  the broker must preserve that property explicitly, or restate how it is met.
- `anno_*` must keep working with **no VICE binary installed at all**. That is measured
  behaviour today and is the strongest argument for the split; a broker route must not
  quietly reintroduce an emulator dependency (the broker's job is launching `x64sc`).
- The three-route resolution constraint from D-06 above.

Open question for the owner before planning: which reading is intended, and should the
`anno` CLI subcommand (`vice-proxy.ts:273`) remain as-is, become the primary surface, or
also move behind the broker?
