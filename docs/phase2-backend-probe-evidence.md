# Phase 2 backend-probe evidence

This document records two pieces of evidence-gathering plan 02-02 was
supposed to perform against real VICE builds on a host outside this
repo's execution container, and what happened instead: neither the stock
nor the fork binary is reachable from this environment, so both checks
were either overridden (fixtures) or left explicitly open (the `--help`
discriminator), never silently assumed.

## 1. D-19 override: the three VERIF-02 fixtures are synthetic, not captured

**Decision overridden:** D-19 ("record everything a real emulator will
produce" — `.planning/phases/02-stock-backend-connection/02-CONTEXT.md`),
which required `display-get.bin`, `event-interleaved.bin`, and
`checkpoint-list.bin` to be raw wire bytes captured live from a real
`x64sc -binarymonitor` session via `probe-binmon.mjs --capture`.

**Overridden by:** explicit user direction, 2026-08-13, mid-execution of
plan 02-02.

**Why:** no stock VICE binary is available in the environment this plan
executed in. `probe-binmon.mjs`'s own header already states this repo's
container "has no VICE and no display"; on 2026-08-13 the user confirmed
that a real stock build is not obtainable in this environment at all right
now, and that a live capture "can only be made later." Plan 02-02's
`checkpoint:human-verify` Task 1 was written to pause and ask a developer
to run the capture on a separate host — but per the override, this plan
runs fully autonomously and must not block waiting for hardware that does
not exist here.

**What was affected:** exactly the three fixtures D-19 named as real-only:

| Fixture | What it models | Why it needed a real emulator |
|---|---|---|
| `.claude/mcp/vice/fixtures/binmon/display-get.bin` | A full ~157 KB `DISPLAY_GET` (0x84) frame | Only a running C64 has a framebuffer to serialize |
| `.claude/mcp/vice/fixtures/binmon/event-interleaved.bin` | A `0xffffffff` broadcast event landing between a request and its own reply | Only a live CPU loop actually interleaves unsolicited events with a pending reply |
| `.claude/mcp/vice/fixtures/binmon/checkpoint-list.bin` | `CHECKPOINT_LIST` answering N+1 frames on one request id | Only a real monitor session has checkpoints to list |

**What was done instead:** all three were generated from the normative
protocol spec rather than captured:

- `docs/phase0-binmon-findings.md` §5 — the 12-byte response header layout
  (STX, api_version, body length, response type, error code, request id)
  every frame in all three fixtures uses.
- `docs/phase0-binmon-findings.md` §3 and `probe-binmon.mjs`'s
  `parseDisplayGet()` — the `DISPLAY_GET` body layout, with the geometry
  `docs/phase1-probe-results.md` already recorded from a real probe run
  (`dw=504 dh=312 xo=136 yo=51 iw=320 ih=200 bpp=8`).
- `docs/phase0-binmon-findings.md` §4 (pause/run model) plus this
  repository's own `CLAUDE.md` protocol constraints (five unsolicited
  message types at `0xffffffff`; `REGISTER_INFO` recurs on every `STOPPED`
  transition, not only at monitor open) — the event ordering in
  `event-interleaved.bin`.
- `probe-binmon.mjs`'s `parseCheckpointInfo()` (23-byte `CHECKPOINT_INFO`
  body, itself hand-derived from §5's opcode table) — the checkpoint
  entries and terminator frame in `checkpoint-list.bin`.

Each generated `.bin` was fed back through
`binmon-fixtures.ts`'s own frame-decomposition logic and asserted to parse
as a complete, well-formed sequence with no trailing partial frame before
being committed (see `binmon-fixtures.test.ts`'s `fixture:` tests).

**Provenance marking (no silent downgrade):** every `.json` sidecar under
`.claude/mcp/vice/fixtures/binmon/` carries:

```json
{
  "capturedFrom": "synthesized-fallback",
  "viceVersion": "N/A -- synthetic, not observed from any real VICE_INFO reply",
  "capturedAt": "<generation timestamp>",
  "command": "<wire command modeled> [synthesized, not a live capture]",
  "synthetic": true,
  "specSections": ["<the exact spec section(s) each field came from>"],
  "note": "<why this is synthetic and what replaces it>"
}
```

`.claude/mcp/vice/fixtures/binmon/README.md`'s provenance table names all
three fixtures `synthesized-fallback` — the same downgrade label plan
02-02's own "no host build reachable" fallback path already used, chosen
deliberately over inventing a new label, since it already carries the
project's established meaning of "not real evidence, use with that
caveat." None of the three fixtures is labelled, or should ever be
mistaken for, a hardware-recorded capture.

**What re-recording later must confirm:** a real capture run
(`node probe-binmon.mjs --capture all` against a real
`x64sc -binarymonitor` build) must be diffed against these synthetic
fixtures for:

1. `display-get.bin`'s exact geometry fields (`dw`/`dh`/`xo`/`yo`/`iw`/`ih`/`bpp`)
   — confirmed once already in `docs/phase1-probe-results.md`, but not
   against the same build these synthetic bytes assume.
2. `event-interleaved.bin`'s actual event ordering and count for a
   single-instruction `ADVANCE_INSTRUCTIONS` step — this plan's ordering
   (`RESUMED`, `STOPPED`, `REGISTER_INFO`, then the correlated reply) is a
   plausible reading of the spec and the Phase 1 refinement, not an
   observed sequence. A real capture could show a different count or
   order (e.g. no `REGISTER_INFO` if that refinement was itself
   mis-generalized, or additional `CHECKPOINT_INFO` frames if a leftover
   checkpoint is active).
3. `checkpoint-list.bin`'s exact terminator-frame shape — this plan
   modeled it as a `0x14`-typed frame carrying a `u32LE` count, which is a
   reasonable but unverified reading of "N+1 frames on one request id";
   the real terminator's response type and body layout are not sourced
   from any spec text this plan had access to.

The follow-up todo tracking this is
`.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`.

## 2. `--help` discriminator evidence (RESEARCH.md A1 / Open Question 2): NOT GATHERED

Plan 02-02's Task 3 was written to gather this evidence, but it depends on
the *same* missing prerequisite as the fixtures above — a real, reachable
`x64sc` binary (both stock and fork) — which the 2026-08-13 override
confirms does not exist in this execution environment. Unlike the
fixtures, this check has no synthetic substitute: `--help` output is
whatever a specific build's argument parser prints, and fabricating a
plausible-looking transcript would be exactly the kind of "provenance that
lies" this plan is required not to produce.

**What this plan needed to confirm:** RESEARCH.md's assumption A1 — that
stock VICE's argument parser rejects an unrecognized flag (e.g.
`-mcpserver`) rather than silently ignoring it — is flagged `[ASSUMED]`
because RESEARCH.md's own execution container has no VICE binary either.
Plan 02-07 is expected to implement backend detection by string-matching
`x64sc --help` output for the flag token `-mcpserver` (fork) versus
`-binarymonitor`-only (stock), per D-02/D-03
(`.planning/phases/02-stock-backend-connection/02-CONTEXT.md`).

**Verdict: OPEN, not resolved either way.** This document does not claim
`--help` introspection works, and does not claim it fails. Neither
`-mcpserver` nor `-binarymonitor` grep counts were obtained, because no
`x64sc --help 2>&1` transcript from either build exists to grep. Plan
02-07 must gather this evidence itself — as a checkpoint at the start of
its own execution, run by a developer against a real host with both
builds available (mirroring plan 02-02's original Task 3
`checkpoint:human-verify` instructions almost verbatim) — before
implementing the `-mcpserver`/`-binarymonitor` string-match mechanism
against it. If that evidence-gathering step shows the expectation does not
hold (neither build lists `-mcpserver`, or `--help` produces nothing
usable), plan 02-07's detection mechanism needs revising before it ships,
exactly as the original Task 3 already anticipated.

This is a deferred check, not a resolved one, and not a silent gap: it is
recorded here precisely so plan 02-07 does not proceed on an assumption
that RESEARCH.md itself already flagged `[ASSUMED]` and this plan could
not upgrade to `[VERIFIED]`.

---
*Recorded by plan 02-02, 2026-08-13, under the mid-execution scope
override described above.*
