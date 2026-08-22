---
created: 2026-08-20T08:03:35.716Z
title: Fully remove the forked VICE MCP backend, leaving stock as the only backend
area: general
files:
  - .claude/mcp/vice/vice.ts
  - .claude/mcp/vice/vice-probe.ts
  - .claude/mcp/vice/backend-detect.mts
  - .claude/mcp/vice/resources/backend-detect.mjs
  - .claude/mcp/vice/tools-manifest.json
  - .claude/mcp/vice/refresh-manifest.ts
  - .claude/mcp/vice/fork-manifest-surface.test.ts
  - .claude/mcp/vice/capability-registry.ts
  - .claude/mcp/vice/broker-launch.mts
  - .claude/mcp/vice/vice-broker.mts
  - README.md:72-157
  - .claude/skills/c64-program-recon/references/tool-selection.md
resolves_phase: 14
---

## Problem

v0.2.0 made stock upstream `x64sc` a first-class, project-selectable backend, but
the fork ([barryw/vice-mcp](https://github.com/barryw/vice-mcp), ~17k lines of
patched C exposing `-mcpserver` and an HTTP `/mcp` endpoint) is still the
*default* — `backend-detect` falls back to `fork` on an indeterminate probe
(README.md:111) — and still carries the larger tool surface. Every consumer who
is not running that custom build is on the second-class path, and the project
pays for two backends in code, tests, docs and skill prose.

Removing the fork entirely means: one transport, one manifest, no
`VICE_BACKEND` selection, no per-backend skill routing, no `--help`
discriminator, and an install story that works on a VICE anyone can `apt
install`.

**What removal costs (the reason this is a todo, not a decision):** the fork
manifest ships **62** tools against stock's **38**. Excluding the four MCP
protocol entries (`initialize`, `notifications_initialized`, `tools_list`,
`tools_call`), **24 `vice_*` tools exist only on the fork** and would leave the
surface entirely:

- **Chip state writes / reads with no binary-monitor equivalent:**
  `vice_sid_get_state`, `vice_sid_set_state`, `vice_vicii_set_state`,
  `vice_cia_set_state` — SID `$D400–$D418` is write-only in hardware and the
  binary monitor has no SID command, so read-back is *unrecoverable* on stock,
  not merely unimplemented (see CLAUDE.md capability constraints).
- **Matrix keyboard / scripted input:** `vice_keyboard_matrix`,
  `vice_keyboard_key_press`, `vice_keyboard_key_release`,
  `vice_keyboard_restore`, `vice_keyboard_chord`, `vice_joystick_tap` — stock
  has only `KEYBOARD_FEED` (0x72) buffer-text injection.
- **Display:** `vice_display_screenshot`, `vice_display_get_dimensions`.
- **Sprites / memory / checkpoints:** `vice_sprite_set`, `vice_memory_fill`,
  `vice_checkpoint_set_ignore_count`, `vice_checkpoint_group_create`,
  `vice_checkpoint_group_add`, `vice_checkpoint_group_toggle`,
  `vice_checkpoint_group_list`, `vice_backtrace`.
- **Disk / machine config:** `vice_disk_detach`, `vice_disk_read_sector`,
  `vice_machine_config_get`, `vice_machine_config_set`.

Stock-only tools (`vice_registers_available`, `vice_execution_until_return`,
`vice_diagnose`, `vice_recycle`) are unaffected — they stay.

So this is not a pure deletion: it is a **capability-loss decision** that has to
be taken deliberately, per tool, with the skills that reference the fork route
rewritten rather than left dangling (SKILL-01 in CLAUDE.md says a skill written
against the full fork surface *breaks* on stock rather than degrading).

## Solution

TBD — needs a decision pass before any code moves. Sketch:

1. **Decide the 24.** For each fork-only tool: drop it outright, reimplement it
   on the binary monitor (some are feasible — `vice_display_screenshot` via
   `DISPLAY_GET` 0x84 with client-side RGB/PNG; `vice_memory_fill` via repeated
   writes; checkpoint groups as a client-side abstraction over stock
   checkpoints), or record it as an accepted permanent loss (SID read-back,
   matrix keyboard).
2. **Collapse the backend seam.** Remove `VICE_BACKEND`, `backend-detect.mts`
   + its committed `resources/backend-detect.mjs`, the `--help` discriminator,
   the two-manifest split (`tools-manifest.json` / `tools-manifest.stock.json`),
   and the per-backend branches in `capability-registry.ts`,
   `stock-dispatch.ts`, `broker-launch.mts`, `vice-broker.mts`. Note the
   caching of the probe verdict under `.vice-supervisor/` also goes.
3. **Retire the HTTP transport.** `vice.ts` (the fork's HTTP/MCP `/mcp` seam),
   `vice-probe.ts`, `refresh-manifest.ts` (regenerates the fork manifest from a
   live fork server) and `fork-manifest-surface.test.ts` all lose their reason
   to exist. Check whether the deny-list and epoch/restart-detection logic in
   `vice.ts` has stock equivalents before deleting.
4. **Rewrite the docs and skills.** README.md:72-157 (the fork-requirement
   table and the `vice_sid_get_state` / `vice_keyboard_matrix` caveats), the
   fork-vs-stock prose in `docs/stock-vice-parity.md` and
   `docs/roadmap-stock-vice.md`, and the fork routes in `c64-program-recon`
   (SKILL.md + `references/tool-selection.md`, `control-flow.md`,
   `observation-hazards.md`, `sound-and-input.md`), `c64-ram-capture/SKILL.md`,
   `vice-wedge-triage/SKILL.md`. Also `CLAUDE.md`'s compatibility constraint,
   which currently promises the fork's list is unchanged from v0.1.x.
5. **Version it as a breaking change.** The fork's 62-tool list is a published
   contract of `@henols/vice-mcp` — dropping it is semver-major, and every
   merge to `main` auto-publishes a patch, so the release path needs handling.

**Open question to settle first:** is this "delete the fork backend" or
"stop defaulting to it and stop testing it"? Deprecating the fork (keep the
code, flip the default to stock, remove it a release later) preserves the 24
tools for anyone who already runs the custom build and de-risks step 1.

Related: `.planning/todos/pending/2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md`
touches the fork tool's `WarpMode` claim, which this would make moot.

## Resolution

Closed 2026-08-22 by phase 14 ("Backend Decision"), plan 14-05, against the
dated `FORK-01` decision this todo's own "Open question to settle first"
asked for.

**The answer: `retain`.** Decided by a human at plan 14-01's `gate="blocking-human"`
checkpoint (Task 2), after explicit escalation — not inferred, not
auto-approved, not a third silent default carry. Recorded in
`.planning/PROJECT.md` → Key Decisions (row citing `FORK-01`, dated
2026-08-22, naming the `KEYBOARD_MATRIX_SET` opcode landing as the reversal
trigger) and pinned by the committed guard `.claude/mcp/vice/docs-fork-decision.test.ts`.
Full reasoning: `.planning/phases/14-backend-decision/14-01-SUMMARY.md` →
`## Decision`.

This settles the todo's own open question directly: the fork backend is
neither deleted nor deprecated-then-scheduled-for-deletion. It stays the
default hedge for the two capability losses that have no route except it
(SID read-back — write-only in hardware; RESTORE/NMI — no client-side
substitute), with named, mechanically-guarded reversal criteria rather than
an unexamined status quo. This is a settled question, not an abandoned one —
the difference the guard and the dated row exist to prove.

**Consequence for this todo's own five-step sketch and 24-tool inventory:**
none of the five steps execute on this branch. The backend seam, the HTTP
transport, the docs/skill rewrites, and the breaking-release handling all
stay exactly as they are. The 24-tool inventory this todo enumerated remains
accurate as a description of what a future non-`retain` decision would have
to dispose of — see `.planning/REQUIREMENTS.md` → `## Future Requirements`
for that forward-looking record (added by this same plan), and `UP-01` for
the one condition (`KEYBOARD_MATRIX_SET` landing upstream) that would reopen
this question.

**FORK-02 (the companion requirement — "a route they can actually follow"):**
verified true on this branch with zero rewrite by plan 14-02
(`.planning/phases/14-backend-decision/14-ROUTE-EVIDENCE.md`, all 17
point-of-use mention sites verdicted `holds-as-is`) and exercised live for
the first time by plan 14-03 against a real fork binary
(`.planning/phases/14-backend-decision/14-CRITERION3-EVIDENCE.md`, 6/6
passing, including `vice_sid_get_state` end to end).

**Cross-reference resolved:** the related
`2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md` todo's
fork-facing question ("is `vice_machine_config_set`'s `WarpMode` claim moot
because the fork is going away?") is answered NOT moot — the fork stays, so
that todo's own Solution item 4 (mark the description fork-only per
SKILL-01 rather than delete it) is the applicable route. Recorded directly
on that todo by this same plan.
