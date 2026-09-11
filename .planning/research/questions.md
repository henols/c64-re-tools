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

**Note on the evidence base:** seed this from `tools-manifest.stock.json`, which is hand-authored
source, matches the live stock surface exactly (46/46), and is pinned to the dispatch table by
`stock-dispatch.test.ts`'s conformance battery. Do NOT seed it from `tools-manifest.json` — that
file describes the FORK's surface, which differs by design (D-07 per-backend trimming), and
comparing the two produces false "unused tool" findings. `vice_result_continue` is in neither
manifest because it is registered proxy-locally (`vice-proxy.ts:3403`); its absence there is not
evidence about its value.

## Does anything in the v1.0.0 rebuild half need stock's three hard losses?

**Raised:** 2026-09-11 — `/gsd-explore`, owner scope call to remove the fork backend entirely.
**Blocks:** the fork-removal phase should not run until this is answered.

Removing the fork makes three capabilities **permanently unavailable**, not hedged:

    SID read-back      $D400-$D418 is write-only in hardware and the binary monitor has no SID
                       command. Not "unimplemented" — unrecoverable on stock.
    Matrix keyboard    KEYBOARD_FEED (0x72) injects buffer text only; there is no matrix control.
    RESTORE / NMI      no monitor route to the physical line.

These are exactly what `FORK-01` retained the fork to hedge. Accepting their permanent loss is
the real content of the reversal, so it should be an explicit, dated acceptance — not a silent
consequence of a deletion.

**What is already known (do not re-derive):** `PROJECT.md:398`, the v0.8.0 close audit dated
2026-09-06, records that the hedge was never exercised and that all three losses were **not
needed by any of the six shipped skills**, running end-to-end on genuine stock `x64sc` 3.9. That
is strong evidence for acceptance, but it is evidence about the SHIPPED skills at v0.8.0, not
about work not yet written.

**What is genuinely open:** the v1.0.0 "Rebuild Half" is the milestone in flight. Does any of its
planned work need to read SID state back, drive the keyboard matrix directly, or trigger
RESTORE/NMI?

- **Matrix keyboard** is the one to check hardest. It is named as the hardest loss, and
  `PROJECT.md:1758` couples it to `FORK-01` — an upstream `KEYBOARD_MATRIX_SET` opcode (~60 lines
  in `monitor_binary.c` calling `keyboard_set_keyarr_any`) would close it for everyone. A game
  that scans the matrix directly rather than reading the KERNAL buffer cannot be driven without
  it, and driving a game is squarely in scope for a rebuild milestone.
- **SID read-back** matters for music-player reverse engineering; check whether any planned phase
  inspects a running player's register state rather than its code.
- **RESTORE/NMI** is the narrowest; likely accept without further work.

**How to settle it:** read the v1.0.0 phase list in `ROADMAP.md` for work that drives input or
inspects sound state, and check the six shipped skills' text for surviving "requires the fork"
routes (`tool-selection.md` carries at least one, for `vice_sid_get_state`). If nothing needs
them, record the acceptance with its date and evidence and proceed. If something does, that work
must be rescoped BEFORE the fork is removed, not after.
