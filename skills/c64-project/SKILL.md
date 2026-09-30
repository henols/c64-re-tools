---
name: c64-project
description: Set up and inspect the workspace of a C64 reverse-engineering project. It shows where the committed files and the machine-local files are. It holds the release registry, which names each cracked release and its disk image. It also holds the broker connection that each host tool uses. Use when asked where the project files are, to register a cracked release or disk image, or to list the releases. Also use when asked to point the toolkit at a project root or data directory. Also use when a skill says that c64-project is missing.
---

# The reverse-engineering project

**All other skills get their paths and their host-tool connection from this skill.**
If a path in this skill is wrong, each capture, diff and build writes to the
wrong location. No script reports an error.

```bash
P=skills/c64-project/scripts   # from the repo root

node $P/project-paths.ts        # print the resolved roots
node $P/releases.ts list        # every registered release
node $P/releases.ts register --id <id> --disk-image <path>   # add a release
```

The other skills load the scripts of this skill as a sibling. Install this
skill next to them: `npx skills add henols/c64-re-tools --skill '*'`.

## Where the project's files live

The files are in two locations. Each location has its own rules:

- **`.c64-re-tools/`** in your project holds the per-project files of the MCP
  server. The folder itself holds the committed artifacts. Today this is
  `annotations.db`, which holds each label, comment and typed range.
  **Commit this folder.**
- **`.c64-re-tools/local/`** holds the files that belong to this machine or
  that the tools can make again: `tools.json`, launchers, snapshots and
  host-tool output. This folder has its own `.gitignore`.
- **The recovery data** is the release registry and the dumps of each
  release. `project-paths.ts` finds its location:

| Root | Default | Override |
|---|---|---|
| Project root | `CLAUDE_PROJECT_DIR`, then the nearest `.git` directory at or above the working directory | `C64RE_PROJECT_ROOT` |
| Data root | `<project root>/recovery` | `C64RE_DATA_DIR` |
| Disks root | the project root | `C64RE_DISKS_ROOT` |
| Registry file | `<data root>/RELEASES.json` | `C64RE_REGISTRY` |

`C64RE_PROJECT_ROOT` has priority over `CLAUDE_PROJECT_DIR`. The search for
`.git` starts at the working directory, not at the script. So run the
scripts from inside your project.

Before a capture or a diff writes a file, run `node $P/project-paths.ts`.
It prints the four locations.

## The release registry

`releases.ts` is the only module that reads a release id from the
registry. All other scripts get the id as an argument.

```bash
node $P/releases.ts list             # id, canonical, disk_image, dump count
node $P/releases.ts show <release-id>
node $P/releases.ts schema-notes
node $P/releases.ts register --id <id> --disk-image <path> [--canonical]
node $P/releases.ts add-dump --from set.json [--force]
```

`register` adds a release with an empty `dumps` array. If the registry file
does not exist, `register` makes it. It refuses an id that is already in the
registry, and a second release with `canonical`.

`add-dump` records one dump set. Its input is the JSON result that
`dump-artifacts.ts write-set` (in `c64-ram-capture`) prints. Save that output
to a file, then give the file to `add-dump`:

```bash
node skills/c64-ram-capture/scripts/dump-artifacts.ts write-set --release <id> --label run1 \
  --chunks chunks.json --raw raw.json > set.json
node $P/releases.ts add-dump --from set.json
```

`add-dump` refuses a label that the release already has. Use `--force` to
replace that dump.

**Label the primary dump `run1`.** `diff-images.ts` (in `c64-provenance`)
and `watch-loads.ts` (in `c64-ram-capture`) read the dump with the label
`run1` as the primary dump of a release. They refuse a release with no
`run1` dump.

| Field | Level | Required | For |
|---|---|---|---|
| `schema_version` | top-level | — | The registry format version. |
| `schema_notes` | top-level | — | Free text on the registry's N-readiness claim. |
| `releases` | top-level | yes | The array of release entries below. |
| `id` | per-release | yes | The `--release` argument every other script takes. |
| `canonical` | per-release | — | A boolean on one entry. There are N releases, not one "canonical image". |
| `disk_image` | per-release | yes | Path to the release's `.d64`, relative to the disks root. |
| `dumps` | per-release | **yes, as an array** | Per-capture records. `[]` is fine. Each script refuses a release with no `dumps` array. |

To start a registry, use `register`, or copy `RELEASES.json.example` from
the folder of this skill. The example has a value in each field.

## The broker connection

Each external binary (acme, c1541, petcat, Ghidra, dxa, unp64) runs on the
host. The broker starts it. A skill script never starts one. The script
sends a typed request through `invokeHostTool()` in `mcp-module.ts`.
`resolveMcpModule()` finds the endpoint client of the MCP server. It tries
these locations in this order:

1. `$VICE_MCP_DIR`, if it is set.
2. The in-repo `src/mcp/vice/`. The module finds it from the `skills/` folder above the script.
3. The compiled `dist/` copy in the installed `@henols/vice-mcp` package.

If no location has the file, the refusal names each path that it tried. If
the broker does not run, the host tool refuses. Start the broker yourself
(`vice-mcp broker`) and run the script again.

## Failure shape

The last line on stdout is one JSON result: `{"ok": true, ...}` with exit
code 0, or `{"ok": false, "message": "..."}` with exit code 1. `--json` gives
only that line. Without `--json`, text lines come first.

If the script cannot find the project root, the refusal names the start
directory of the search and the variable to set. If the registry file is
missing or has the wrong shape, the refusal names the file and the bad
entry. The scripts never use a default in place of a missing value.

## What this skill does NOT do

- **No capture, diff or build.** This skill only gives the locations for
  those files. To capture RAM, use `c64-ram-capture`. To diff releases, use
  `c64-provenance`.
- **No access to the annotation store.** Only `c64-annotations` reads and
  writes `annotations.db`.
- **No broker start.** You start the broker yourself. This skill never
  starts, stops or installs it.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `could not locate the project root -- no .git found at or above …` | Run inside a git checkout, or set `C64RE_PROJECT_ROOT`. |
| `… needs the "c64-project" skill, which is not installed next to it` | `npx skills add henols/c64-re-tools --skill c64-project` |
| `release "x" has no "dumps" array -- add "dumps": [] to the entry` | Add `"dumps": []` to that release entry. |
| `add-dump: release "x" already has a dump labelled "run1"` | Give a different `--label` to `write-set`, or use `--force` to replace the dump. |
| `could not resolve resources/host-tool-endpoint.mjs` | Install `@henols/vice-mcp`, or set `VICE_MCP_DIR` to its folder. |
