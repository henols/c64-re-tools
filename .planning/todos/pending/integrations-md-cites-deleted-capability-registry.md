---
created: 2026-09-24T00:00:00.000Z
title: INTEGRATIONS.md cites a module deleted in Phase 52 and a two-backend tool surface
area: docs
severity: major
files:

  - .planning/codebase/INTEGRATIONS.md:44
  - .planning/codebase/INTEGRATIONS.md:45

---

# INTEGRATIONS.md still describes the fork-era world

Found 2026-09-19 during the `docs/` recurrence debug, re-verified 2026-09-24. Two adjacent
lines in a codebase map that planning agents read:

- **Line 44** — "Tool surface: **38** tools … a strict subset; the surface is **trimmed per
  backend** rather than degraded." MEASURED 2026-09-24: the manifest holds **47** and the live
  advertised surface is **76** (48 `vice_*` + 28 `anno_*`). "Trimmed per backend" describes a
  two-backend world that Phase 52 removed — `CLAUDE.md` now states there is one target and no
  backend to select.
- **Line 45** — names `src/mcp/vice/capability-registry.ts` as "the single authoritative table
  of gaps and their reason text". That file **does not exist**; Phase 52 deleted it along with
  the fork backend, and `CLAUDE.md` records the deletion. The gaps it held are now permanent
  accepted losses in `docs/stock-hard-losses.md`.

Only the `docs/tool-support.md` pointer on line 45 was corrected on 2026-09-19 (`6c081a05`),
because that commit's mandate was `docs/` citations. The rest was deliberately left rather
than silently widened into a codebase-map rewrite.

## Why it matters

This is the same failure mode as the `docs/` recurrence it was found next to: a codebase map
that planning agents read, asserting something that stopped being true, with nothing checking
it. An agent reading line 45 will look for `capability-registry.ts`, not find it, and have to
guess what replaced it — or worse, propose recreating it.

## Suggested shape

Check the whole file, not these two lines. They were found incidentally while chasing an
unrelated bug, so the sample is not the population — the fork removal (Phase 52), the manifest
growth and the Phase 56 guard deletions all postdate this document's last real pass, and it is
likely stale in other places too. Prefer pointers over counts: a "**38** tools" line is a
number that rots, and the same audit found the `build.ts` module list recorded three different
ways in three files.
