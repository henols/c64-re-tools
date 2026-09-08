---
created: 2026-09-07T09:42:32.805Z
title: Consolidate all tool-written files under .c64-re-tools
area: paths
severity: minor
files:
  - src/mcp/vice/repo-root.ts:186-189
  - src/mcp/vice/stock-paths.ts:178-184
  - src/mcp/vice/incident-record.ts:36
  - src/mcp/vice/install-resources.ts
  - src/mcp/vice/ghidra-project.mts
  - src/mcp/vice/vice-broker.mts:123
  - src/mcp/vice/resources/vice-broker.mjs:83
  - scripts/ensure-mcp-deps.sh
  - .gitignore
---

## Problem

Every tool in this plugin that writes to disk picks its own top-level location
under the resolved project root. A consumer who installs `@henols/vice-mcp` and
uses more than one tool ends up with five or six unrelated entries littering
their repo root, each needing its own `.gitignore` stanza (the current
`.gitignore` spends ~40 lines explaining them):

| What writes it | Where it lands today | Source |
|---|---|---|
| Broker / supervisor runtime state | `<root>/.vice-supervisor/` (+ `.vice-supervisor.bak-*/`) | `repo-root.ts:186-189`, `vice-broker.mts:123`, `resources/vice-broker.mjs:83` |
| `vice_snapshot_save` | `<root>/.vice-snapshots/<name>.vsf` + `.json` sidecar | `stock-paths.ts:178-184` |
| Deployed host launcher artifacts | `<root>/tools/*.mjs`, `tools/vice-launcher.sh`, `tools/.vice-deployed.json` | `install-resources.ts` |
| `ghidra.analyze` per-run projects | `<root>/tools/ghidra-runs/<runId>/` | `ghidra-project.mts` (SEAM-04) |
| `vice_recycle` incident records + screenshots | `<root>/.planning/incidents/` | `incident-record.ts:36` |
| MCP dep lockfile stamp (fallback) | `<root>/mcp-deps.lock.sha256` | `scripts/ensure-mcp-deps.sh` |

Two of these are actively confusing rather than merely untidy:

- `tools/` mixes two unrelated things — *deployed program artifacts* (parity-gated
  against `resourceEntries()` by `host-scripts.test.ts`) and *runtime scratch*
  (`ghidra-runs/`). The `.gitignore` comment for `tools/ghidra-runs/` documents a
  deliberate missing leading slash purely to keep that parity scan from
  mistaking scratch for a deployed artifact. That workaround exists only because
  the two kinds share a directory.
- `.planning/incidents/` writes product output into the *consumer's* GSD
  planning tree. `incident-record.ts:28` calls it "repo-tracked, never
  gitignored", which is right for this repo but wrong for a consumer who has a
  `.planning/` for their own unrelated project.

Want: one root — `.c64-re-tools/` — with well-formed subdirectories, so a
consumer gets exactly one gitignore entry and one directory to delete.

## Solution

Sketch (not settled — the subdirectory names are the part worth arguing about):

```
.c64-re-tools/
  supervisor/       # was .vice-supervisor/  (broker state, pool, epoch file)
  snapshots/        # was .vice-snapshots/   (.vsf + .json sidecars)
  bin/              # was tools/*.mjs, vice-launcher.sh, .vice-deployed.json
  runs/ghidra/      # was tools/ghidra-runs/
  incidents/        # was .planning/incidents/
  cache/            # was mcp-deps.lock.sha256
```

**Clean break — no back-compat.** Confirmed with Henrik at capture time
(2026-09-07): "minor, but no support/fallback for the old structure." So:

- No dual-read of old and new paths, no migration shim, no env var to opt back in.
- No code that looks for `.vice-supervisor/` if `.c64-re-tools/supervisor/` is
  absent. A pre-existing old-layout tree is simply ignored and left where it is;
  the release notes tell people to delete it.
- The old `.gitignore` stanzas are *removed*, not kept alongside the new one.
- Any live broker started under the old layout must be stopped before the
  upgrade — the version boundary is not hot-swappable (`.vice-supervisor/` is
  the rendezvous point between the container-side client and the host daemon).

Constraints the work has to respect:

- **Path seams are load-bearing.** `repo-root.ts` owns `supervisorDir()` and is
  the single resolver; `stock-paths.ts`, `incident-record.ts`,
  `install-resources.ts` and `ghidra-project.mts` each own their own subtree.
  This is a change *inside* those seams — do not let callers start joining
  `.c64-re-tools` themselves. Ideally add one `toolsDir()` in `repo-root.ts` that
  the other four derive from.
- **`.mts` → `resources/*.mjs` build parity.** `vice-broker.mts:123` and its
  compiled `resources/vice-broker.mjs:83` both carry the literal; `build.ts` must
  be re-run and `resources-sync.test.ts` will fail CI on drift.
- **`host-scripts.test.ts`'s two-way `/tools/` parity gate** matches on the
  literal `/tools/` prefix. Moving deployed artifacts to `.c64-re-tools/bin/`
  means that scan's prefix moves with them, and the `ghidra-runs/`
  leading-slash workaround in `.gitignore` can be deleted outright once scratch
  no longer shares a root with deployed artifacts.
- **Env overrides** `VICE_POOL_DIR`, `VICE_EPOCH_FILE`, `VICE_SUPERVISOR_DIR`
  keep working and keep winning over the new default.
- **Host/container translation** (`hostpath.ts` / `containerpath.ts`) has the new
  root on both sides of the bind mount; `containerpath.test.ts:55,112,117`,
  `repo-root.test.ts:246`, `host-tool.test.ts:1080` and
  `vice-proxy.test.ts:2963` all pin the old literal and need updating.
- **Docs**: `CLAUDE.md`'s configuration section, `.gitignore` (collapses to a
  single `/.c64-re-tools/`), and `incident-record.ts`'s own header comment about
  `.planning/incidents/README.md`.

## Addendum (2026-09-08, plan 40-01 execution): `runs/ghidra/` is NOT movable

The sketch above lists `runs/ghidra/` as a subdirectory of `.c64-re-tools/`, but
executing this move revealed a hard conflict this todo's own "Solution" sketch
never checked: `ghidra-project.mts`'s `hasDotPrefixedSegment()` refuses EVERY
ancestor segment of a Ghidra project location that starts with `.` (proven
against real Ghidra 12.1.3 -- `evidence/34-ghidra-dotpath.md`), and
`.c64-re-tools` itself is dot-prefixed by design. Re-pointing
`GHIDRA_RUNS_DIR_NAME` under `.c64-re-tools/` makes `resolveGhidraProject()`
refuse EVERY call, unconditionally -- confirmed directly:
`hasDotPrefixedSegment("/repo/.c64-re-tools/runs/ghidra/r1")` returns
`{ dotted: true, segment: ".c64-re-tools" }`, and
`ghidra-project.test.ts`'s own happy-path test pins `runsRoot` at
`join(dir, "tools", GHIDRA_RUNS_DIR_NAME)`.

**Resolution taken:** the Ghidra runs root is exempted from this consolidation
and stays at `<repoRoot>/tools/ghidra-runs/`, documented in
`GHIDRA_RUNS_DIR_NAME`'s own doc comment as the one deliberate exception to
"every writer lands under one root". This is a hard external-tool constraint,
not a preference -- there is no dot-prefix-safe way to nest a Ghidra project
under a dot-prefixed ancestor. A future non-dot-prefixed alias directory
(e.g. a project-scoped `c64-re-tools-ghidra-runs/` symlinked INTO
`.c64-re-tools/runs/ghidra/`) could reunify the two trees, but is not
attempted here -- scope discipline (D-35 in 40-01-PLAN.md: no new
retention/reaping/symlink machinery invented in this phase).

## Resolution

**Fixed.** Plan `40-01` (commits `f739b4ff`, `7a8ec1e0`, `aaa03144`).

One owning function, `toolsDir()` in `src/mcp/vice/repo-root.ts`, is the single
definition of the `.c64-re-tools/` root; `supervisorDir()`, `stock-paths.ts`'s
snapshot paths, `incident-record.ts`'s `incidentsDir()`, and
`install-resources.ts`'s `installTargetDir()` all derive from it (or its
documented two-segment join convention for the host-bound modules that cannot
import it — `vice-broker.mts`, `host-tool.mts`, `scripts/ensure-mcp-deps.sh`).
`.gitignore` collapsed from five per-writer stanzas plus twelve per-file deploy
entries down to one `/.c64-re-tools/` stanza; `host-scripts.test.ts`'s two-way
parity gate was rewritten from a per-file relation to a directory relation to
match. Clean break, no back-compat, exactly as scoped: no dual-read, no
migration shim, no opt-back-in env var.

**The one exception is the addendum above, not a new one**: `runs/ghidra/`
stayed at `<repoRoot>/tools/ghidra-runs/` for the hard technical reason already
recorded here — Ghidra's own dot-segment refusal — with the `.gitignore` entries
for that path kept and simplified rather than deleted.

See `40-01-SUMMARY.md` for the full task-by-task account, including the ten
pinned-literal test files (outside this plan's own declared file list) that
needed updating for the move, and the `docs-linerefs.test.ts` citation drift
this plan's own doc-comment insertion caused and fixed in the same commit.
