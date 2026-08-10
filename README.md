# c64-re-tools

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games — extracted from the [Bruce Lee](https://github.com/henols/bruce_lee)
reverse-engineering project so it can be reused across C64 projects.

It provides two things as a single installable unit:

- **The `vice` MCP server** — tools that drive a host VICE
  emulator (run disks, read/write RAM, checkpoints, screenshots, snapshots,
  scripted input) through an on-demand broker.
- **Six C64 skills:**
  - `acme-build` — assemble 6502/6510 source with the ACME cross-assembler.
  - `c64-memory-mapping` — resolve any C64 address; annotate disassembly.
  - `c64-program-recon` — work out an unknown C64 program's runtime structure.
  - `c64-provenance-diff` — decide what a cracker changed vs. original code.
  - `c64-ram-capture` — capture and compare a running C64's 64K RAM.
  - `vice-wedge-triage` — diagnose a stuck/wedged VICE and recover safely.

## Install

There are two independent ways to install; pick one.

### A. npm / npx (any project)

From the project you want to set up:

```
npx @henols/c64-re-tools
```

This copies the six skills into `<project>/.claude/skills/` and wires the
`vice` MCP server into `<project>/.mcp.json` (launched via `npx -y @henols/vice-mcp`).
Existing servers and skills are preserved; pass `--force` to overwrite, `--dry-run`
to preview, `--vendor` to install the server locally instead of via `npx`. Running
the MCP server requires **Node ≥ 22.18** (or ≥ 23.6).

The two published packages:

- [`@henols/vice-mcp`](https://www.npmjs.com/package/@henols/vice-mcp) — the MCP server.
- [`@henols/c64-re-tools`](https://www.npmjs.com/package/@henols/c64-re-tools) — this installer (bundles the skills, depends on the server).

### B. Claude Code plugin

```
/plugin marketplace add henols/c64-re-tools
/plugin install c64-re-tools@c64-re-tools
```

The plugin is `defaultEnabled: false`; enable it in the project where you want
the C64 tooling. (In plugin mode the tools are namespaced
`mcp__plugin_c64-re-tools_vice__*`.)

### Dependencies

The MCP server has real npm dependencies (`@mastra/mcp`, `@mastra/core`). They
are **not** committed. A `SessionStart` hook (`scripts/ensure-mcp-deps.sh`)
runs `npm ci` into `.claude/mcp/vice/node_modules` on first session and after
any lockfile change, gated on a hash so normal starts are a cheap no-op. This
needs `node` and `npm` on `PATH` and network access to the npm registry on the
consumer's machine.

## How it locates the project

At runtime the MCP writes host-synchronised state (`.vice-supervisor/`) and
deploys its host launcher scripts (`tools/`) under the **project you are
working in**, not under the plugin's own install directory. It resolves that
root from `CLAUDE_PROJECT_DIR` (which Claude Code sets), falling back to
`CONTAINER_WORKSPACE_PATH` and then a `.git` ancestor walk — see
`.claude/mcp/vice/repo-root.ts`. The VICE emulator itself runs on the host and
is reached only through the `mcp__plugin_c64-re-tools_vice__*` tools.

## Layout

```
.claude-plugin/
  plugin.json        # manifest: skills, mcpServers, deps hook
  marketplace.json   # single-plugin marketplace, so `marketplace add` works on this repo
.mcp.json            # vice server, launched via ${CLAUDE_PLUGIN_ROOT}
.claude/
  mcp/vice/          # @henols/vice-mcp — the MCP server (authored TS, generated-but-committed resources/, tests)
  skills/            # the six skills above (canonical source)
installer/           # @henols/c64-re-tools — npx installer; bundles the skills, depends on vice-mcp
scripts/
  ensure-mcp-deps.sh    # SessionStart dependency provisioning (plugin mode)
  package.sh            # validates manifests + builds the plugin release zip
  check-npm-packages.mjs # validates the two npm tarballs' contents
```

The internal `.claude/mcp/vice` + `.claude/skills` layout mirrors a project
tree on purpose: the MCP server's own test suite resolves paths relative to it,
so the tests travel and run unchanged.

## Publishing (maintainers)

Releases are **automatic**: every merge to `main` publishes a new **patch**
version. CI reads the current version from npm, bumps the patch, publishes
`@henols/vice-mcp` then `@henols/c64-re-tools`, and creates the matching `v<version>`
tag + GitHub release. Include `[skip release]` in the merge commit message to land
a change without releasing.

For a **minor or major** bump, trigger a release manually with an explicit version:
Actions → **CI** → **Run workflow** → enter e.g. `0.2.0` (this is the
`workflow_dispatch` path). Pushing a `v<version>` tag by hand also works.

Either way the version is taken from the tag/input/auto-bump, so you do **not**
pre-bump the source `package.json` files (their versions are placeholders CI
overwrites at publish time).

Publishing uses **npm Trusted Publishing (OIDC)** — no `NPM_TOKEN` secret. Each
package has a Trusted Publisher configured on npmjs.com pointing at this repo and
`ci.yml`; the `publish-npm` job runs with `id-token: write` and authenticates to
npm directly, and npm records provenance automatically.

## Developing / testing the MCP server

```
cd .claude/mcp/vice
npm ci
npm run typecheck
npm test
```

Two repo-wide documentation guardrail tests (`skill-docs.test.ts`,
`vice-mcp-selector-docs.test.ts`) intentionally did **not** move here — they
validate a full project's docs (`CLAUDE.md`, `.planning/`, `docs/`) against the
tool surface and remain in the originating project.

## License

MIT — see [`LICENSE`](./LICENSE).
