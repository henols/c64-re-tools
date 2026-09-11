---
title: MCP tool redundancy census — the live surface, and what "unreferenced" actually means
date: 2026-09-11
context: /gsd-explore "check all MCP tools and all the skills and their scripts for redundant functions"
confidence: MEASURED for the counts and the reference sets (grep over the tree, 2026-09-11); REASONED for the domination candidates
---

# What was measured

Question put: which MCP tools and skill-script functions are redundant enough to remove, so an
agent has fewer ways to pick the same operation?

Everything below is a grep/count over the tree at 2026-09-11, except where marked REASONED.

## The live surface is 72 tools, and `tools-manifest.json` does not describe it

- **Live advertised**: 46 `vice_*` + 26 `anno_*` = **72**.
- **`tools-manifest.json`**: 62 entries, of which 4 are protocol entries (`initialize`,
  `notifications_initialized`, `tools_call`, `tools_list`) already owned by `vice.ts`'s
  `DENY_LIST`.

It is stale in BOTH directions:

- **Lists but not advertised**: `vice_checkpoint_group_add` / `_create` / `_list` / `_toggle`,
  `vice_memory_fill`, `vice_sid_set_state`, `vice_sid_get_state`, `vice_cia_set_state`,
  `vice_vicii_set_state`, `vice_sprite_set`, `vice_display_screenshot`,
  `vice_display_get_dimensions`, `vice_disk_detach`, `vice_disk_read_sector`,
  `vice_keyboard_chord` / `_key_press` / `_key_release` / `_matrix` / `_restore`,
  `vice_joystick_tap`, `vice_machine_config_get` / `_set`, `vice_checkpoint_set_ignore_count`.
- **Advertised but absent**: the whole `anno_*` family (26), plus every derived tool
  (`vice_diagnose`, `vice_recycle`, `vice_memmap_show`, `vice_memmap_zap`, `vice_cpu_history`,
  `vice_profile_flat`, `vice_backtrace`, `vice_io_registers`, `vice_device_console`,
  `vice_warp_set`, `vice_registers_available`, `vice_result_continue`,
  `vice_execution_until_return`).

Consequence: any redundancy analysis that starts from `tools-manifest.json` analyses a surface
that is not the one an agent sees. Start from the advertised list.

## 16 of 72 live tools are named in no shipped skill — from THREE different causes

Measured by `grep -r <tool> src/skills/`. The split matters more than the count: only the third
bucket is a redundancy signal at all.

**Cause 1 — documentation lag (7).** Phase 41–43 text-channel tools; the capability is new and
the skills were never updated. Nothing redundant; the remedy is skill text, not removal.

    vice_memmap_show  vice_cpu_history  vice_profile_flat  vice_backtrace
    vice_io_registers  vice_device_console  vice_warp_set

**Cause 2 — load-bearing primitives no skill happens to name (5).** Obviously required; absence
from skill prose says nothing about value.

    vice_memory_write  vice_registers_set  vice_snapshot_save  vice_snapshot_load
    anno_update_project_enum

**Cause 3 — genuine overlap candidates (4).** REASONED, not yet proven dominated.

    vice_execution_until_return   overlaps the 5-tool stepping cluster
    vice_registers_available      overlaps vice_registers_get
    vice_checkpoint_set_condition overlaps vice_checkpoint_add
    vice_result_continue          proxy-local; unclear whether an agent should ever select it

Collapsing these three causes into one "unused tools" list is exactly the error
`capability-registry.ts` already warns about for `vice_diagnose`/`vice_recycle`: *"a naive
set-difference over the two manifests misclassifies them as a divergence; they are not one, and
including them here would be a factual error."*

# Two candidates REFUTED by the measurement

**`vice_ping` is not removable, despite reading as a duplicate of `vice_diagnose`.** It is
`PROBE_TOOL` (`vice-probe.ts:47`), the broker's launch liveness gate
(`broker-launch.mts:868`), and the poll primitive in `vice-sync.ts` and `vice-proxy.ts:1267`.
It is deliberately the fragile, no-retry probe that `vice_diagnose` is not — the two answer
different questions and the codebase depends on the difference.

**The skill scripts hold no duplication worth removing.** 18 non-test `.mjs` across 8 skills.
They already cross-import instead of reimplementing: `c64-provenance-diff/scripts/diff-images.mjs`
imports `releases.mjs`, `watch-loads.mjs` and `project-paths.mjs` from `c64-ram-capture/scripts/`.
The one pair that looks duplicated is not: `compare.mjs` classifies volatile/drift/divergence
across two 65536-byte RAM captures for reproducibility; `diff-images.mjs` does N-way
anchor-proven provenance diffing with gap-tolerant coalescing. Different questions, different
outputs. **The skill-script half of the original question has no action.**

# The asymmetry that explains the whole finding

The two families have opposite description discipline.

`anno_*` descriptions disambiguate themselves — each names its neighbour and says which to pick:

- `anno_read_region`: *"`view: 'disasm'` is what routine documentation wants … the SAME cap
  governs `anno_disassemble` — one cap, both views, so there is no per-view rule to get subtly
  wrong."*
- `anno_get_address_details`: *"composed from four reads … the body carries `composed_client_side`
  and a `composed_from` list naming all four sources, so a composition is never mistaken for
  something the store held whole."*
- `anno_save_project`: *"IT PERFORMS NO WRITE, and it exists to say so"* — a tool whose entire
  purpose is to intercept a wrong mental model.

`vice_*` descriptions are terse one-liners inherited from the fork's manifest, and that is where
the coin-flips are. `vice_watch_add` self-describes as *"shorthand for checkpoint with
store/load"* — an alias announced in its own description with no guidance on when to prefer it.

**So: `anno_*` overlaps are documented and deliberate; `vice_*` overlaps are undocumented and
accidental.** Removal pressure belongs almost entirely on the `vice_*` side, and even there it is
a short list — the larger defect is missing selection guidance, not excess tools.

# Where selection guidance lives today, and why that is the real problem

`src/skills/c64-program-recon/references/tool-selection.md` (65 lines) is a genuine
question-to-call mapping and is the right idea. Its four limits are structural, not cosmetic:

1. **Prose, not data** — nothing can lint it against the advertised surface, so it cannot go
   stale loudly.
2. **Scoped to one skill** — it sits under `c64-program-recon/references/`; the other eight
   skills cannot see it.
3. **Partial and dated** — self-declared `Curated 2026-08-01, Confidence: MEDIUM`, covering
   roughly 20 of 72 tools, and it still routes to `vice_sid_get_state`, which the live surface
   does not advertise.
4. **A hand-maintained partial copy of registry data** — precisely the
   "re-deriving a cross-cutting seam locally" anti-pattern `CLAUDE.md` names, and precisely what
   `capability-registry.ts`'s own header forbids: *"do not hand-maintain a second copy of this
   data anywhere else in the repo."*

`capability-registry.ts` answers **"which backend has this."** Nothing in the tree answers
**"which of these two should I pick."** That missing seam is the finding.

See [[tool-selection-registry]] (seed), [[tools-manifest-drift]] (todo), and the domination
question appended to `.planning/research/questions.md`.
