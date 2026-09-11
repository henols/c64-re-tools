---
title: Removing the fork backend reverses FORK-01 — the basis, the blast radius, and the order
date: 2026-09-11
context: /gsd-explore — owner scope call, 2026-09-11
confidence: MEASURED for the guard inventory and blast radius (grep, 2026-09-11); the reversal itself is an OWNER DECISION, recorded here, not a finding
---

# The scope call

Owner, 2026-09-11, verbatim in substance: *the `barryw/vice-mcp` fork is totally out of scope;
everything around it is legacy and must be totally removed. It was a test to use it and it never
worked.*

This is a reversal of `FORK-01`, which was decided **retain** by a human at a blocking checkpoint
in Phase 14 on 2026-08-22. Recording the basis here so the reversal is traceable rather than
looking like drift.

# Why the original rationale no longer holds

`FORK-01` retained the fork on two grounds. Both are now gone.

**Ground 1 — "it is the hedge against stock's three hard losses."** The project's own v0.8.0
close audit (`PROJECT.md:398`, written 2026-09-06) already records that the hedge was never
used:

> the fork-backend hedge (`FORK-01`) was **never exercised** — v0.8.0 ran end-to-end on genuine
> stock `x64sc` 3.9, and the three stock losses it hedges (SID read-back, matrix keyboard,
> RESTORE/NMI) were **not needed by any of the six** shipped skills

**Ground 2 — "its incremental maintenance cost is near zero since it already exists and is
tested."** The owner reports the fork never worked in practice. Whatever the tests cover, the
premise that a working hedge sits there at no cost is withdrawn by the person who tried to use it.

So the decision is not being overridden on a whim: one ground was already contradicted in
writing by the project's own audit, and the other is withdrawn by the owner's direct experience.

# THE thing that is a decision, not a deletion

Removing the fork makes stock's three hard losses **permanent and accepted**, not hedged:

    SID read-back      $D400-$D418 is write-only in hardware; the binary monitor has no SID
                       command. Unrecoverable, not merely unimplemented.
    Matrix keyboard    KEYBOARD_FEED (0x72) injects buffer text only. No matrix control.
    RESTORE / NMI      no monitor route to the physical line.

That acceptance is the actual content of the reversal and belongs in the decision record. See the
research question appended to `.planning/research/questions.md` — whether anything in the v1.0.0
rebuild half needs them is the one open input, and it is worth answering BEFORE the phase runs.

# Guard inventory — what pins the retain decision, and the order it must be unwound

**`src/mcp/vice/docs-fork-decision.test.ts` (181 lines) is the blocker.** It asserts against
`PROJECT.md` that:

1. the `## Key Decisions` table is locatable and clears a 20-row floor (non-vacuity);
2. **exactly one** row names `FORK-01`;
3. that row states an ISO `YYYY-MM-DD` date;
4. that row names `KEYBOARD_MATRIX_SET` in canonical upper case, **case-sensitively**;
5. that row carries at least one named reversal-trigger phrase;
6. the `### Out of Scope` fork-backend bullet cites `FORK-01`.

**Order matters.** Editing the decision record and deleting the code are not independent: this
guard reds on any edit to that row, so a code-first pass leaves the suite red for the whole
removal and gives no signal about the deletions themselves. Amend the decision record and this
guard together, in one step, first — then delete code against a green baseline.

Other records carrying the retain disposition, all needing the same reversal pass:

- `PROJECT.md:438` — "Removing or deprecating the fork backend" listed under **Out of Scope**,
  with the hedge rationale and a v0.2.0 reaffirmation.
- `PROJECT.md:251`, `:933`, `:1758` — further FORK-01 citations.
- `REQUIREMENTS.md` — `FORK-01` / `FORK-02` marked Complete.
- `.planning/todos/completed/` — a `fully-remove-the-forked-vice-mcp-backend` todo already
  disposed **retain** in plan 14-05. Its resolution is now superseded; it must not be left
  reading as the current answer.
- `.planning/MILESTONES.md:522`, `STATE.md:157/860/864/1290/1872`, `RETROSPECTIVE.md:540`.

# Blast radius (MEASURED 2026-09-11)

**Non-test modules** — 9 files reference the backend split; `"fork"` appears in 9, `ViceBackend`
in 6, `backend === "fork"` in 4, `buildBackendAwareTool` in 4, `mcpserver` in 3.

**Whole-file candidates:**

    vice.ts               772 lines   the HTTP/MCP transport to the fork host
    vice-probe.ts         278 lines   fork liveness probe
    refresh-manifest.ts   124 lines   sole writer of the fork manifest
    tools-manifest.json  1223 lines   the fork's snapshotted tool surface

**`vice.ts` is NOT a clean delete.** Ten non-test modules import from it, and most import types
and errors rather than the transport: `ViceError` / `ViewErrorOptions` (`stock-symbols.ts`,
`stock-petscii.ts`, `stock-paths.ts`, `anno-types.ts`), `MachineRestartedError`
(`stock-reproducible-run.ts`, `stock-handler.ts`), `readEpoch` (`stock-recycle.ts`), `call`
(`vice-sync.ts`). The error hierarchy and epoch reader are shared infrastructure that must
survive; only the HTTP transport half goes. Split before deleting.

**Fork-conditional test branches** — 12 test files, by `"fork"` hit count:

    backend-detect.test.ts 22   broker-control.test.ts 10   broker-launch.test.ts 8
    stock-dispatch.test.ts  6   capability-registry.test.ts 6  text-capability-probe.test.ts 5
    vice-proxy.test.ts      4   text-tools.test.ts 3        vice-broker-client.test.ts 2
    host-tool.test.ts       2   vice-broker-supervision.test.ts 1  vice-broker-acquire.test.ts 1

# Things that get simpler, and one that does not

**Simpler:** `backend-detect.mts` collapses (no `probeBackend()` classification, no
`VICE_BACKEND` override, no capability record); `capability-registry.ts` loses its whole reason
for existing — it is a per-backend capability-gap registry, and with one backend there are no
gaps to explain; `buildBackendAwareTool()` collapses into `buildViceTool()`;
`tools-manifest.stock.json` becomes simply *the* manifest; `DENY_LIST` becomes vestigial (see
[[deny-list-is-a-fork-artifact]]).

**Not simpler:** the `SKILL-01` constraint in CLAUDE.md — "a skill written against the full fork
surface *breaks* on stock rather than degrading; the playbooks must name the stock route or the
fork requirement." With no fork, every "requires the fork" route in skill text becomes a dead
end that must be rewritten as a stated permanent limitation, not merely deleted. `tool-selection.md`
carries at least one (`vice_sid_get_state`). Grep the skills for fork-requirement language.

Related: [[deny-list-is-a-fork-artifact]], [[mcp-tool-redundancy-census]].
