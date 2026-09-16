---
title: Fix stale "six skills" count — nine ship
date: 2026-09-14
priority: low
source: /gsd-explore — skill installer route survey (.planning/notes/skill-installer-routes-surveyed.md)
audit_acknowledged:
  milestone: v1.0.0
  at: 2026-09-16
---

# Stale skill count: prose says six, nine ship

Measured 2026-09-14: `src/skills/` contains **nine** skill directories —
`acme-build`, `c64-disk-access`, `c64-memory-mapping`, `c64-petcat`,
`c64-program-recon`, `c64-provenance-diff`, `c64-ram-capture`,
`routine-queue-walker`, `vice-wedge-triage`.

Five locations still say six:

- `README.md:31` — "copies the six skills into `<project>/.claude/skills/`"
- `README.md:55` — "the six skills under `src/skills/`"
- `README.md:220` — "`skills/  # the six skills above (canonical source)`"
- `CLAUDE.md:8` — "plus six C64 reverse-engineering skills"
- `CLAUDE.md:189` — component table row "| Skills (six) |"

`CLAUDE.md` contradicts itself: its own Project Skills table already lists all nine.

## Note on the fix

A bare count in prose goes stale every time a skill is added — this is the second
kind of drift, not the first. Consider whether the three `README.md` sites and the
`CLAUDE.md` component-table row can drop the number entirely ("the skills under
`src/skills/`") rather than being corrected to nine and going stale again at ten.
`CLAUDE.md:8` is a description sentence where a count may genuinely be wanted; if it
is kept, it is worth checking whether any existing docs gate would catch it drifting
again.
