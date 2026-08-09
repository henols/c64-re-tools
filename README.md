# c64-rc-tools

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games — extracted from the [Bruce Lee](https://github.com/henols/bruce_lee)
reverse-engineering project so it can be reused across C64 projects.

It provides two things as a single installable unit:

- **The `vice` MCP server** — `mcp__plugin_c64-rc-tools_vice__*` tools that drive a host VICE
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

```
/plugin marketplace add henols/c64-rc-tools
/plugin install c64-rc-tools@c64-rc-tools
```

The plugin is `defaultEnabled: false`; enable it in the project where you want
the C64 tooling.

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
is reached only through the `mcp__plugin_c64-rc-tools_vice__*` tools.

## Layout

```
.claude-plugin/
  plugin.json        # manifest: skills, mcpServers, deps hook
  marketplace.json   # single-plugin marketplace, so `marketplace add` works on this repo
.mcp.json            # vice server, launched via ${CLAUDE_PLUGIN_ROOT}
.claude/
  mcp/vice/          # the MCP server (authored TS, generated-but-committed resources/, tests)
  skills/            # the six skills above
scripts/
  ensure-mcp-deps.sh # SessionStart dependency provisioning
```

The internal `.claude/mcp/vice` + `.claude/skills` layout mirrors a project
tree on purpose: the MCP server's own test suite resolves paths relative to it,
so the tests travel and run unchanged.

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
