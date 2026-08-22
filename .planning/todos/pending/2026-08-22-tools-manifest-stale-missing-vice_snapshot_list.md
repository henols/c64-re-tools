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
