# Research Questions

Open questions raised during planning and exploration. Each carries the date it was raised and
what would settle it.

## Can any advertised `vice_*` tool be proven strictly dominated, given the v0.1.x compatibility promise?

**Raised:** 2026-09-11 — `/gsd-explore`, MCP tool redundancy census.
**Blocks:** any removal of a tool from the advertised surface.

The decision taken was "remove only tools that are pure aliases with no unique capability,
disambiguate everything else." That requires proving domination per tool, and the proof is the
gate — a tool that merely *looks* like an alias is a disambiguation row, not a deletion.

Four REASONED candidates, none yet proven:

- `vice_execution_until_return` — overlaps the 5-tool stepping cluster; named in no shipped skill.
- `vice_registers_available` — overlaps `vice_registers_get`; named in no shipped skill.
- `vice_checkpoint_set_condition` — overlaps `vice_checkpoint_add`'s own condition handling.
- `vice_result_continue` — proxy-local; unclear whether an agent should ever select it directly.

`vice_watch_add` is the fifth and the most explicit — its own description says *"shorthand for
checkpoint with store/load"* — but it IS named by three shipped skill files, so removing it has a
caller cost the other four do not.

**What would settle it, per tool:**

1. Is every argument shape reachable through the proposed replacement, with the same semantics?
   Read the stock handler, not the description — `handleExecutionUntilReturn`
   (`stock-execution.ts`), `stock-checkpoints.ts`, `stock-dispatch.ts`.
2. Does the fork implement it differently from stock? A tool can be an alias on one backend and
   not the other, which would make removal a backend-conditional change.
3. Is it reachable from internal code as well as from an agent? The `vice_ping` case is the
   worked example of this trap: it reads as a duplicate of `vice_diagnose`, but is `PROBE_TOOL`
   (`vice-probe.ts:47`), the broker launch gate (`broker-launch.mts:868`) and a `vice-sync.ts`
   poll primitive. Grep `src/` as well as `src/skills/` before calling anything unused.
4. What does removal cost against `CLAUDE.md`'s compatibility constraint — *"the fork's list is
   unchanged from v0.1.x"*? Does removing a stock-only tool touch that promise at all, or does
   the constraint bind only tools advertised on both?

**Note on the evidence base:** do not seed this from `tools-manifest.json`. It does not describe
the advertised surface in either direction — see `.planning/todos/pending/tools-manifest-drift.md`.
