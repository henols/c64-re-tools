---
title: RELEASES.json's schema is undocumented anywhere in c64-ram-capture/SKILL.md or README.md
date: 2026-08-19
priority: medium
source: 08.1-WALKTHROUGH-SETUP.md FINDING-B1 — Phase 8.1 walkthrough, tracked via v0.2.0-MILESTONE-AUDIT.md §7 E-5
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
