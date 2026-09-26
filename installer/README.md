# @henols/c64-re-tools

One-command installer that adds the **C64 reverse-engineering skills** to a
project. It installs nothing else: the **VICE emulator MCP server** comes from
the Claude Code plugin (see below).

## Usage

From the project you want to set up:

```sh
npx @henols/c64-re-tools
```

That copies the bundled skills into `<project>/.claude/skills/`. It writes no
`.mcp.json` and never runs `npm` or `npx`. Then restart Claude Code in that
project.

### Options

| Option | Effect |
| --- | --- |
| `[targetDir]` | Install into this directory instead of the current one. |
| `--force` | Overwrite existing skills. |
| `--dry-run`, `-n` | Show what would change without writing anything. |
| `--help`, `-h` | Show help. |

Re-running is safe: existing skills are kept unless you pass `--force`.

## What gets installed

- **Skills** — `acme-build`, `c64-disk-access`, `c64-memory-mapping`,
  `c64-petcat`, `c64-program-recon`, `c64-provenance-diff`, `c64-ram-capture`,
  `routine-queue-walker`.

## Requirements

- **This installer** runs on Node ≥ 18.
- **The skill scripts** it installs require **Node ≥ 24**.

## The MCP server: Claude Code plugin

The `vice` MCP server is installed as a Claude Code plugin:

```
/plugin marketplace add henols/c64-re-tools
/plugin install c64-re-tools@c64-re-tools
```

## License

MIT © Henrik Olsson
