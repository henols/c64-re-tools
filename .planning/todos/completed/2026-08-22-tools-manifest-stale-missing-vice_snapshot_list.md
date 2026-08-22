---
title: tools-manifest.json is stale — live fork server offers vice_snapshot_list, manifest does not
date: 2026-08-22
priority: low
source: /gsd-execute-phase 14 plan 14-03 — found by fork-live.test.ts's live surface diff (Task 2)
---

# `tools-manifest.json` is missing `vice_snapshot_list`

`fork-live.test.ts`'s surface test (`serverInfo() lists every vice_* tool the
committed manifest names`) diffs the committed `tools-manifest.json` against
a real fork server's live `tools/list` answer. It asserts the manifest's
names are all present live (that passed), and separately logs — as a
finding, not a failure — any live name the manifest lacks.

On this run, the live fork server (`/usr/local/bin/x64sc`, VICE 3.10)
offered `vice_snapshot_list`, which `tools-manifest.json` (generated
2026-07-31T15:56:00.302Z by `refresh-manifest.ts`) does not list. No other
mismatch was found in either direction.

## Why this was not fixed here

Plan 14-03's scope is a live-transport exercise and its evidence record, not
a manifest regeneration. `tools-manifest.json` is a generated, committed
snapshot (`refresh-manifest.ts`'s own job); regenerating it is a one-command
fix but is still a scope decision, and 14-03's task list does not include
"regenerate the manifest." Filed as a todo per the project's own escape
hatch rather than silently widening this plan's scope.

## What a fix would look like

```
cd .claude/mcp/vice && node refresh-manifest.ts
```

against a live fork server, then commit the regenerated `tools-manifest.json`
and confirm no `.claude/mcp/vice`-shipped code assumed the old tool count.
Re-run `fork-live.test.ts`'s surface test afterward to confirm the drift is
gone (no more live-only names logged).

## Also check

Whether `vice_snapshot_list` should be added to any tool-selection
documentation (`.claude/skills/*/references/tool-selection.md`) alongside the
other fork tools it sits next to, since a tool absent from the manifest is
also a tool a session's context-gathering skills may not know to recommend.

## Resolution

**wont-fix — the manifest is not stale.**

The recommendation in "What a fix would look like" above (regenerate
`tools-manifest.json` against the live fork server) is the wrong action, on
inverted ground: `vice_snapshot_list`'s absence from the manifest is a
**deliberate, documented deletion**, not staleness.

- **D-16 citation.** `vice_snapshot_list` was deleted from the fork manifest
  by D-16, recorded at
  `.planning/phases/03-direct-tools/03-05-SUMMARY.md` (Task 1, commit
  `f5c171d`): "D-16 implemented: `vice_snapshot_list` deleted from the fork
  manifest (no consumer anywhere in the repo), `vice_snapshot_load`'s
  description no longer references it, fork surface gated at exactly 62
  tools." This is a single documented exception to `BACK-02` (the fork
  backend's advertised list is unchanged from v0.1.x). The decision's own
  ROADMAP-facing citations are `.planning/ROADMAP.md`'s Phase 15 planning
  note ("`vice_snapshot_list`'s absence is D-16's deliberate deletion, so
  regenerating the manifest would re-add a tool the project decided to
  remove") and the Wave 1 plan-listing line for `03-05-PLAN.md` ("D-16's
  fork-manifest deletion and the 62-tool gate"). No dedicated dated-decision
  table row exists beyond these citations — recorded here precisely rather
  than overclaiming a row that is not there.
- **Why the recommended regeneration is wrong.** `fork-manifest-surface.test.ts`'s
  own header states that `refresh-manifest.ts` is the ONLY writer of
  `tools-manifest.json` and always writes the tool list *exactly* as the live
  fork host's `tools/list` answers. Pointing that script at a live fork
  server that still advertises `vice_snapshot_list` (as this todo's own
  finding shows it does) would silently re-add a tool the project decided to
  remove — the exact regression `fork-manifest-surface.test.ts`'s 62-tool
  count assertion and its "no entry is named vice_snapshot_list" assertion
  exist to catch. Following the todo's own recommendation would therefore
  trip a guard whose header explicitly says not to change its number without
  a decision record — and a decision record (D-16) already exists, on the
  other side of the question.
- **The manifest and count gate are untouched.** `tools-manifest.json` is
  byte-identical (`git diff --quiet` confirmed); `fork-manifest-surface.test.ts`'s
  62-tool assertion is unchanged (verified: the same number of `62`
  occurrences in the file before and after this plan's edits).
- **The reporting fix.** `fork-live.test.ts`'s live-surface diff (the test
  that produced this todo's original finding) previously logged ANY live-only
  `vice_*` name as an undifferentiated finding, with no indication that some
  such names are deliberate deletions rather than drift. It now partitions
  live-only names into `deliberatelyDeleted` (checked against a new shared,
  single-named constant, `DELIBERATELY_DELETED_FORK_TOOLS` in the new
  `fork-deleted-tools.ts` module, imported by both this file and
  `fork-manifest-surface.test.ts` — never hand-typed twice) and
  `genuinelyUnexpected` (still logged exactly as before, so the check keeps
  its teeth for a real future drift). Landed in this plan's Task 2 commit.
- **Skill tool-selection docs.** Confirmed `vice_snapshot_list` is absent
  from every `.claude/skills/*/references/tool-selection.md` (and from the
  skills tree generally) — `grep -rc 'vice_snapshot_list' .claude/skills/`
  returns zero hits everywhere. This absence is intentional (D-16 deleted the
  tool; nothing should recommend calling a tool that does not exist), and is
  recorded here so a future reader does not add it.

Commits: this plan's Task 2 commit (see `15-11-SUMMARY.md`).
