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
| Project root | nearest ancestor with a `.git` entry | `C64RE_PROJECT_ROOT` |
| Data root | `<project root>/recovery` | `C64RE_DATA_DIR` |
| Disks root | the project root | `C64RE_DISKS_ROOT` |
| Registry file | `<data root>/RELEASES.json` | `C64RE_REGISTRY` |

Before a capture or a diff writes a file, run `node $P/project-paths.ts`.
It prints the four locations.

## The release registry

`releases.ts` is the only module that reads a release id from the
registry. All other scripts get the id as an argument.

```bash
node $P/releases.ts list             # id, canonical, disk_image, dump count
node $P/releases.ts show <release-id>
node $P/releases.ts schema-notes
```

| Field | Level | Required | For |
|---|---|---|---|
| `schema_version` | top-level | — | The registry format version. |
| `schema_notes` | top-level | — | Free text on the registry's N-readiness claim. |
| `releases` | top-level | yes | The array of release entries below. |
| `id` | per-release | yes | The `--release` argument every other script takes. |
| `canonical` | per-release | — | A boolean on one entry. There are N releases, not one "canonical image". |
| `disk_image` | per-release | yes | Path to the release's `.d64`, relative to the disks root. |
| `dumps` | per-release | **yes, as an array** | Per-capture records. `[]` is fine. A missing key makes `list` throw a `TypeError`. |

To start a registry, copy `RELEASES.json.example` from the folder of this
skill. It has a value in each field.

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

Each script in this skill prints its result, or it refuses with a message and
a non-zero exit code. If the script cannot find the project root, the refusal
names the start directory of the search and the variable to set. If the
registry file is missing, the refusal names its path. The scripts never use
a default in place of a missing value.

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
| `could not locate the project root -- no .git found above …` | Run inside a git checkout, or set `C64RE_PROJECT_ROOT`. |
| `… needs the "c64-project" skill, which is not installed next to it` | `npx skills add henols/c64-re-tools --skill c64-project` |
| `TypeError: Cannot read properties of undefined (reading 'length')` from `list` | A release entry has no `dumps` key. Add `"dumps": []`. |
| `could not resolve resources/host-tool-endpoint.mjs` | Install `@henols/vice-mcp`, or set `VICE_MCP_DIR` to its folder. |
