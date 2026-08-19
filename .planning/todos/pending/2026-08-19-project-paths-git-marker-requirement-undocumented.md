---
title: project-paths.mjs's .git-marker requirement for the toolkit project root is undocumented
date: 2026-08-19
priority: medium
source: 08.1-WALKTHROUGH-SETUP.md FINDING-B2 — Phase 8.1 walkthrough, tracked via v0.2.0-MILESTONE-AUDIT.md §7 E-5
---

# A scratch project silently needs `git init` before the toolkit will find its root

`project-paths.mjs` requires the toolkit's project root to carry a `.git` marker (or
have `C64RE_PROJECT_ROOT` set explicitly). This requirement is documented only in that
module's own code comments — not in `c64-ram-capture/SKILL.md` or any other user-facing
doc. A scratch/throwaway project a user spins up to try the toolkit (exactly the Phase
8.1 walkthrough's own situation) will silently need `git init` first or an explicit env
override, and nothing in the skill's user-facing docs says so.

## Why deferred rather than fixed here

Documentation-only gap, out of Phase 8.2's scope fence. Fixing it means editing
`c64-ram-capture/SKILL.md`, which E-5's own instruction forbids in this plan — E-5
asks only for a tracked home, not the fix.

## What would close it

Add a one-line prerequisite note to `c64-ram-capture/SKILL.md`'s setup section: the
toolkit's project root must be a git repository (or `C64RE_PROJECT_ROOT` must be set),
and a scratch project needs `git init` first.
