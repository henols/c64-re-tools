---
title: RELEASES.json's schema is undocumented anywhere in c64-ram-capture/SKILL.md or README.md
date: 2026-08-19
priority: medium
source: 08.1-WALKTHROUGH-SETUP.md FINDING-B1 — Phase 8.1 walkthrough, tracked via v0.2.0-MILESTONE-AUDIT.md §7 E-5
resolves_phase: 15
---

# `RELEASES.json`'s shape has to be learned by reading source, not docs

`RELEASES.json`'s schema — `schema_version`, `schema_notes`, and each release entry's
`id` / `canonical` / `disk_image` / `dumps` fields, including that `dumps` must be
present as an array rather than optional (`releases.mjs`'s `list` command reads
`r.dumps.length` with no `??` guard, so an omitted `dumps` throws) — is documented
nowhere in `c64-ram-capture/SKILL.md` or `README.md`. It was learned during the Phase
8.1 walkthrough only by reading `releases.mjs` and `project-paths.mjs` source directly
(module docstrings and the CLI `list`/`show` output shape).

## Why deferred rather than fixed here

Documentation-only gap, out of Phase 8.2's scope fence (this phase closes v0.2.0's
Drive8Type/test-gate/walkthrough blockers). Fixing it means editing
`c64-ram-capture/SKILL.md`, which this plan (E-5's own instruction) is explicitly
forbidden from doing — E-5 asks only for a tracked home.

## What would close it

Add a short "Release registry shape" subsection to `c64-ram-capture/SKILL.md`
documenting the fields above, or ship a `RELEASES.json.example` in the skill's own
directory that a new user can copy.

## Resolution

Closed 2026-08-22, Phase 15 plan 15-06.

Did both: added a `## Release registry shape` section to
`.claude/skills/c64-ram-capture/SKILL.md`, placed immediately before `## References`,
with a two-column field table naming all seven fields (`schema_version`,
`schema_notes`, `releases`, `id`, `canonical`, `disk_image`, `dumps`), each verified
present in `.claude/skills/c64-ram-capture/scripts/releases.mjs` by grep. `dumps`'s
required-as-an-array rationale is stated explicitly, citing the exact unguarded read:
`releases.mjs:98`'s `list` command reads `r.dumps.length` with no nullish guard, so an
omitted `dumps` throws instead of listing anything.

Shipped `.claude/skills/c64-ram-capture/RELEASES.json.example` alongside it — one
release entry with every documented field populated with placeholder values
(`example-release`, `example-label`), parses as valid JSON, and is confirmed present
in the published `@henols/c64-re-tools` tarball by `node scripts/check-npm-packages.mjs`
(36 files, up from 35 — the installer's `skills/` `files[]` glob picks it up with no
pattern change needed).
