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
