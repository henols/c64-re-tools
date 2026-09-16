---
title: Stamp installed-skill provenance and give the npm route a real update path
date: 2026-09-14
priority: medium
source: /gsd-explore — skill installer route survey (.planning/notes/skill-installer-routes-surveyed.md)
audit_acknowledged:
  milestone: v1.0.0
  at: 2026-09-16
---

# Stamp installed-skill provenance in the npm installer target

## Problem

`installSkills()` (`installer/bin/cli.mjs:144-172`) copies each skill directory with
`cpSync` and writes **no version marker** into the target. Nothing in
`<target>/.claude/skills/<name>/` records which version of `@henols/c64-re-tools`
produced it.

Two consequences:

1. **Re-running the installer to update is a silent no-op.** Any skill directory
   that already exists is skipped unless `--force` (`cli.mjs:161`), and an existing
   `vice` entry in `.mcp.json` is "kept" (`cli.mjs:197`). The user sees
   `9 already present (use --force to overwrite)` and nothing updates. `README.md:28`
   documents the install command with no update guidance at all.
2. **Skill/server version skew is undetectable.** `.mcp.json` carries a pinned
   `@henols/vice-mcp@<version>`, but the skills beside it carry no version. Neither
   the user nor a future Claude session can answer "do these skills match the server
   wired here?" — and this project's own compatibility constraint says a skill
   written against a tool the server does not advertise **breaks** rather than
   degrades. That makes this the single most consequential question the installed
   tree currently cannot answer.

## Precedent — every other installer surveyed stamps provenance

- asd-ste100 → `.upstream-commit` holding the upstream git SHA
  (`setup-claude-ste100.sh:460`)
- graphify → `.graphify_version` (`0.8.30`)
- Claude Code plugins → version encoded in the cache path,
  e.g. `~/.claude/plugins/cache/claude-plugins-official/frontend-design/022b3c274938/`

This repo is the outlier.

## Suggested shape (not yet decided)

- Write a marker the installer owns — e.g. one file under the installed skills root
  recording `SELF_VERSION` plus the `@henols/vice-mcp` version wired alongside it.
  `SELF_VERSION` already exists at `cli.mjs:50`; nothing new needs resolving.
- Prefer a single marker at the skills root over one per skill directory: the nine
  skills always ship as a set from one package version, so per-directory stamps
  would be nine copies of one fact.
- On re-run, compare the marker and report the actual situation ("installed 0.1.2,
  bundled 0.3.0 — re-run with --force to update") instead of the current
  version-blind "already present".
- Respect the project's existing version seam: `src/mcp/vice/version.ts` is the one
  version-resolution algorithm, and `cli.mjs:32-49` documents at length why the
  installer deliberately does not import it. Do not reimplement the seam — reuse
  `SELF_VERSION`, which is already that seam's precedence step 1.

## Out of scope

Do not change what the plugin route writes. The plugin already carries its version
in the marketplace cache path; this gap is specific to the npm installer's target.
