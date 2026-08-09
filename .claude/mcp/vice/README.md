# @henols/vice-mcp

A stdio [MCP](https://modelcontextprotocol.io) server that exposes a running
[VICE](https://vice-emu.sourceforge.io/) Commodore 64 emulator to an MCP client
(such as Claude Code) for reverse-engineering work. It forwards `vice` tool calls
to a **host** VICE MCP server, and on first use deploys the host launcher scripts
it needs into `<project>/tools/`.

This package is normally installed for you by the
[`@henols/c64-re-tools`](https://www.npmjs.com/package/@henols/c64-re-tools)
installer, which also drops the matching skills into your project. It is published
separately so it can be launched directly by an MCP client.

## Requirements

- **Node.js ≥ 22.18** (or ≥ 23.6). The server ships as TypeScript and runs under
  Node's native type-stripping — no build step, no flags. Older Node needs
  `--experimental-strip-types` and is unsupported.
- A **host** with VICE (`x64sc`) available, reachable from wherever the MCP client
  runs. The server talks to the host VICE MCP server over HTTP (default
  `http://host.docker.internal:6510/mcp` in a container, `http://127.0.0.1:6510/mcp`
  otherwise); override with `VICE_MCP_URL` / `VICE_MCP_HOST`.

## Use as an MCP server

Add it to your MCP client configuration and let the client launch it:

```json
{
  "mcpServers": {
    "vice": {
      "command": "npx",
      "args": ["-y", "@henols/vice-mcp"],
      "timeout": 150000,
      "env": { "MASTRA_TELEMETRY_DISABLED": "1" }
    }
  }
}
```

The bin (`vice-mcp`) speaks the MCP stdio protocol. `initialize` and `tools/list`
are answered locally (from `tools-manifest.json`); `tools/call` forwards to the host
VICE MCP server.

## Environment

| Variable | Purpose |
| --- | --- |
| `VICE_MCP_URL` | Full host MCP endpoint (overrides host/port derivation). |
| `VICE_MCP_HOST` | Host to reach the VICE MCP server on. |
| `VICE_SKIP_RESOURCE_INSTALL=1` | Disable deploying host launcher scripts into `<project>/tools/`. |
| `MASTRA_TELEMETRY_DISABLED=1` | Disable Mastra telemetry. |

## Development

```sh
npm ci
npm run typecheck
npm test
npm run smoke     # boots the server and completes an MCP initialize + tools/list handshake
npm run build     # recompiles the host-bound .mts launchers into resources/
```

## License

MIT © Henrik Olsson
