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

- **Node.js ≥ 24**. The server ships as TypeScript and runs under
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
are answered locally (from `tools-manifest.stock.json`); `tools/call` forwards to the host
VICE MCP server.

## Environment

| Variable | Purpose |
| --- | --- |
| `VICE_MCP_URL` | Full host MCP endpoint (overrides host/port derivation). |
| `VICE_MCP_HOST` | Host to reach the VICE MCP server on. |
| `VICE_SKIP_RESOURCE_INSTALL=1` | Disable deploying host launcher scripts into `<project>/tools/`. |
| `MASTRA_TELEMETRY_DISABLED=1` | Disable Mastra telemetry. |
| `VICE_LIVE_STOCK_BIN` | Absolute path to a genuinely unpatched stock VICE binary; opts `stock-live.test.ts` in (default-skipped). |
| `VICE_BROKER_RELAY_IDLE_MS` | The broker-owned idle deadline (default `300000`, 5 minutes) a monitor-relay connection may sit carrying no traffic in either direction before the broker reclaims that one channel. This is the mechanism the broker actually controls end-to-end (`Socket.setTimeout()`, userspace, needs no cooperation from the OS or the peer); it is suspended for as long as the connection's own grant has a declared operation in flight, so a legitimately long-running capture is never torn down by the clock. An absent, non-numeric, zero or negative value falls back to the default and is logged by name — it is never possible to disable this bound. |
| `VICE_BROKER_RELAY_KEEPALIVE_MS` | The TCP keepalive delay (default `30000`) set on the client-facing relay socket and on every accepted control connection. This is a **secondary, best-effort signal only** — `Socket.setKeepAlive(true, ms)` sets *only* the delay before the first probe; the interval between probes and the number of probes past that delay remain the host's own kernel settings (`tcp_keepalive_intvl`/`tcp_keepalive_probes` on Linux), which this broker cannot change. It does **not** bound anything by itself — `VICE_BROKER_RELAY_IDLE_MS` above is the owned bound. Same absent/non-numeric/zero/negative fallback discipline as the idle deadline. |

## The session label

A single broker can serve several unrelated projects at once. `status` names each
live session with a **session label** — a short, human-readable string a client
declares once, at `acquire` time — alongside that session's grant id and whatever
operation it currently has in flight, so a reader can tell "that one is mine" apart
from an unrelated session on the same machine-wide broker.

The value comes from the calling process, not from anything the broker derives on
its own: it is the `CLAUDE_CODE_SESSION_ID` environment variable when that is set to
a non-empty string, and otherwise the current working directory's base name joined
to the process id (e.g. `c64-re-tools-48213`). It is declared once, at `acquire`,
and is optional on the wire — a bare test client or a future non-agent caller that
never declares one is never refused for it, and `status` reports an absent label as
absent, never fabricated.

The broker sanitises whatever it receives before it is ever recorded or displayed:
control characters and line terminators are stripped, the result is trimmed, and it
is capped at 64 characters. Nothing server-side is ever derived from it — in
particular, the client-side default never sends more than the working directory's
**base name**, never a full absolute path, so no other project's filesystem layout,
username or hostname reaches another session's `status` reply.

**The session label carries no authority.** It is a display and diagnosis value
only. No control operation — `monitor_claim`, `monitor_release`, `recycle`,
`attach`, or `operation` — ever accepts a session label as a target selector; the
only credential this protocol recognises is the grant a connection itself holds (and,
for a relay attach, the per-claim handle minted from that grant). A request that
puts another session's label where a target id belongs is refused with the exact
same authorisation wording a bare, unrecognised target id gets.

## Development

`npm test` assumes it is running inside the devcontainer. On a bare host, set
`CONTAINER_WORKSPACE_PATH` (the repo root) and `HOST_WORKSPACE_PATH` (any
consistent host-side mirror) exactly as `.github/workflows/ci.yml` does, or
the path-translation and container-guard tests skip with a reason naming
both variables instead of running:

```sh
export CONTAINER_WORKSPACE_PATH="$(git rev-parse --show-toplevel)"
export HOST_WORKSPACE_PATH="/host$(git rev-parse --show-toplevel)"
```

`npm run test:automated` is the subset of `npm test` that excludes the nine
manual-only files (see `test-gate.mjs`'s own header).

```sh
npm ci
npm run typecheck
npm test
npm run test:automated  # the automated subset (excludes manual-only files)
npm run smoke     # boots the server and completes an MCP initialize + tools/list handshake
npm run build     # recompiles the host-bound .mts launchers into resources/
```

## License

MIT © Henrik Olsson
