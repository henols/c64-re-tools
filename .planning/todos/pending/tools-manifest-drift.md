---
title: tools-manifest.json describes a surface that is not advertised
date: 2026-09-11
priority: medium
source: /gsd-explore — MCP tool redundancy census
---

# What

`src/mcp/vice/tools-manifest.json` holds 62 entries and is stale in both directions against the
72 tools actually advertised to a client. MEASURED 2026-09-11.

**Lists tools that are not advertised** (~22): `vice_checkpoint_group_add` / `_create` / `_list` /
`_toggle`, `vice_memory_fill`, `vice_sid_get_state`, `vice_sid_set_state`, `vice_cia_set_state`,
`vice_vicii_set_state`, `vice_sprite_set`, `vice_display_screenshot`,
`vice_display_get_dimensions`, `vice_disk_detach`, `vice_disk_read_sector`,
`vice_keyboard_chord` / `_key_press` / `_key_release` / `_matrix` / `_restore`,
`vice_joystick_tap`, `vice_machine_config_get` / `_set`, `vice_checkpoint_set_ignore_count`.

**Omits tools that are advertised**: the entire `anno_*` family (26), plus every derived tool —
`vice_diagnose`, `vice_recycle`, `vice_memmap_show`, `vice_memmap_zap`, `vice_cpu_history`,
`vice_profile_flat`, `vice_backtrace`, `vice_io_registers`, `vice_device_console`,
`vice_warp_set`, `vice_registers_available`, `vice_result_continue`,
`vice_execution_until_return`.

# Why it matters

Anything that reasons about "the tool surface" from this file reasons about the wrong surface.
That includes a human auditing for redundancy, and it would include any generated support table
or lint seeded from it. Establish which reading is authoritative before building anything on it.

# First question, before any edit

Decide what this file is *for*. Two readings, and they imply opposite fixes:

1. **A cache of the fork's raw `tools/list`** — in which case the omissions are correct by
   design (`anno_*` and derived tools are proxy-local and were never in the fork's reply, exactly
   as `capability-registry.ts` explains for `vice_diagnose`/`vice_recycle`), the file is not
   "the tool surface" at all, and the fix is a header comment saying so plus refreshing it
   against a fork that still advertises those 22.
2. **The advertised manifest** — in which case both directions are real drift and it needs
   regenerating.

`refresh-manifest.ts` regenerates it from a live host server's `tools/list`, which points at
reading 1. Confirm that before touching the data — and note there is a second file,
`tools-manifest.stock.json`, which the same question applies to.
