# @henols/c64-re-tools

One-command installer that adds the **C64 reverse-engineering skills** and the
**VICE emulator MCP server** ([`@henols/vice-mcp`](https://www.npmjs.com/package/@henols/vice-mcp))
to a project, so an MCP client such as Claude Code can drive a Commodore 64
emulator for reverse-engineering work.

## Usage

From the project you want to set up:

```sh
npx @henols/c64-re-tools
```

That will:

1. Copy the bundled skills into `<project>/.claude/skills/`
2. Add a `vice` server to `<project>/.mcp.json` (existing servers are preserved),
   launched via `npx -y @henols/vice-mcp`

Then restart Claude Code in that project.

### Options

| Option | Effect |
| --- | --- |
| `[targetDir]` | Install into this directory instead of the current one. |
| `--force` | Overwrite existing skills and an existing `vice` MCP entry. |
| `--vendor` | Also `npm install -D @henols/vice-mcp` into the project and wire `.mcp.json` to the local copy (pinned / offline), instead of `npx`. |
| `--dry-run`, `-n` | Show what would change without writing anything. |
| `--help`, `-h` | Show help. |

Re-running is safe: existing skills and an existing `vice` entry are kept unless
you pass `--force`.

## What gets installed

- **Skills** — `acme-build`, `c64-memory-mapping`, `c64-program-recon`,
  `c64-provenance-diff`, `c64-ram-capture`, `vice-wedge-triage`.
- **MCP server** — `@henols/vice-mcp`, exposing the `vice` tools.

## Requirements

- **This installer** runs on Node ≥ 18.
- **The VICE MCP server** it wires up requires **Node ≥ 22.18** (or ≥ 23.6), and a
  host with VICE (`x64sc`) reachable from the MCP client. See the
  [`@henols/vice-mcp`](https://www.npmjs.com/package/@henols/vice-mcp) readme.

## Alternative: Claude Code plugin

If you use Claude Code, you can instead install everything as a plugin:

```
/plugin marketplace add henols/c64-re-tools
/plugin install c64-re-tools@c64-re-tools
```

## License

MIT © Henrik Olsson
