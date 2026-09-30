# @henols/vice-mcp

A stdio [MCP](https://modelcontextprotocol.io) server that exposes a running
[VICE](https://vice-emu.sourceforge.io/) Commodore 64 emulator to an MCP client
(such as Claude Code) for reverse-engineering work. It forwards `vice` tool calls
to a broker on the **host**, which launches an emulator instance per session.

It runs two ways: from the Claude Code plugin (or a checkout of the
repository), which also carries the matching skills, or as this npm package
for any other MCP client. The skills install separately with the `skills` CLI
(`npx skills add henols/c64-re-tools --skill '*'`).

## Requirements

- **Node.js ≥ 24**. The plugin and a checkout run the TypeScript sources under
  Node's native type stripping, with no build step and no flags. The npm
  package runs a compiled copy (`dist/`, built when the package is packed),
  because Node never strips types under `node_modules`.
- A **host** with VICE (`x64sc`) and a running broker, started by hand from the
  same install the server runs from:

  ```sh
  vice-mcp broker                                      # npm install
  node <plugin-root>/src/mcp/vice/vice-cli.mjs broker  # plugin or checkout
  ```

  No client starts the broker for you. The server reaches it on TCP port 19510,
  dialling `127.0.0.1` and then `host.docker.internal`, so the same
  configuration works on the host and inside a container. Nothing is read from
  disk to find it.

## Use as an MCP server

**Claude Code:** install the plugin, then install the server's dependencies once
with `npm ci --prefix <plugin-root>/src/mcp/vice`. The plugin wires the server
itself.

**Other MCP clients:** install the package globally, then register its bin:

```sh
npm i -g @henols/vice-mcp
npx add-mcp vice-mcp --env MASTRA_TELEMETRY_DISABLED=1
```

Or add it to the client configuration by hand:

```json
{
  "mcpServers": {
    "vice": {
      "command": "vice-mcp",
      "timeout": 150000,
      "env": { "MASTRA_TELEMETRY_DISABLED": "1" }
    }
  }
}
```

Register the installed `vice-mcp` bin, not the package name: a configuration
that launches the package through `npx` installs it at launch time.

A checkout runs the source directly:

```json
{
  "mcpServers": {
    "vice": {
      "command": "node",
      "args": ["<plugin-root>/src/mcp/vice/vice-proxy.ts"],
      "timeout": 150000,
      "env": { "MASTRA_TELEMETRY_DISABLED": "1" }
    }
  }
}
```

The annotation CLI runs from the same install: `vice-mcp anno <verb>` (npm) or
`node <plugin-root>/src/mcp/vice/vice-proxy.ts anno <verb>` (plugin or checkout).

The bin (`vice-mcp`) speaks the MCP stdio protocol. `initialize` and `tools/list`
are answered locally (from `tools-manifest.stock.json`); `tools/call` runs through an
emulator instance the broker launches for this session.

## Environment

| Variable | Purpose |
| --- | --- |
| `VICE_MCP_URL` | Full host MCP endpoint (overrides host/port derivation). |
| `VICE_BROKER_CONTROL_PORT` | The broker's control port (default `19510`), for the broker and every client. |
| `VICE_SKIP_RESOURCE_INSTALL=1` | Disable deploying host launcher scripts into `<project>/.c64-re-tools/local/bin/` (the npm package never deploys them). |
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
only. No control operation — `monitor_claim`, `monitor_release`,
`attach`, or `operation` — ever accepts a session label as a target selector; the
only credential this protocol recognises is the grant a connection itself holds (and,
for a relay attach, the per-claim handle minted from that grant). A request that
puts another session's label where a target id belongs is refused with the exact
same authorisation wording a bare, unrecognised target id gets.

## Development

The tests, their helpers and their fixtures live in `test/vice/` at the
repository root, so the package holds production code only. `npm test` runs
them on the host with no extra environment. Suites that drive a
real emulator run only when their `VICE_LIVE_*` variable is set, and suites
that need a host tool skip with a named reason when it is missing.

`npm run test:automated` is the subset of `npm test` that excludes the
manual-only files (see `test/vice/test-gate.ts`'s own header).

```sh
npm ci
npm run typecheck
npm test
npm run test:automated  # the automated subset (excludes manual-only files)
npm run smoke     # boots the server and completes an MCP initialize + tools/list handshake
npm run build     # recompiles the host-bound .mts launchers into resources/
node smoke-packed.ts  # builds dist/, packs the package, runs it from a scratch node_modules
```

## License

MIT © Henrik Olsson
