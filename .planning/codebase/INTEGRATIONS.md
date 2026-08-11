# External Integrations

**Analysis Date:** 2026-08-11

This project has **no cloud services, databases, or SaaS integrations**. Its one external integration is a locally/host-run emulator process (VICE) reached over HTTP JSON-RPC, plus the npm registry and GitHub for distribution. There is no user-facing auth, no webhooks in the traditional sense, and no persistent database.

## Core Integration: VICE Emulator (custom MCP-enabled build)

**What it is:**
- The `vice` MCP server (`@henols/vice-mcp`, source in `.claude/mcp/vice/`) is a stdio MCP server that Claude Code launches. It does **not** run an emulator itself — it forwards every `vice_*` tool call to a **host-side** VICE emulator process (`x64sc`).
- The single transport seam is `.claude/mcp/vice/vice.ts` — every emulator interaction in the project goes through its `call()` function; no other file speaks MCP JSON-RPC or raw HTTP to the VICE endpoint directly (explicit design constraint documented at the top of `vice.ts`).

**Protocol:**
- HTTP JSON-RPC 2.0, POSTed to a `/mcp` endpoint (`method: "tools/call"`, `"initialize"`, `"tools/list"`), with response bodies either plain JSON or SSE-framed (`text/event-stream`, `data:` lines) — both are parsed in `rpc()` (`.claude/mcp/vice/vice.ts:324-381`).
- Served by a **non-upstream, custom-patched `x64sc` build** launched with an undocumented `-mcpserver -mcpserverhost <ip> -mcpserverport <port>` flag (`.claude/mcp/vice/resources/broker-launch.mts`, documented in `docs/roadmap-stock-vice.md`). Stock/upstream VICE has no such flag; this custom binary is an external, load-bearing dependency of the entire tool surface.
- A documented migration plan (`docs/roadmap-stock-vice.md`) exists to replace this with stock VICE's binary monitor protocol (`-binarymonitor`, TCP, length-prefixed binary framing) — not yet implemented.

**Endpoint resolution:**
- Default: `http://host.docker.internal:6510/mcp` when running inside a container, `http://127.0.0.1:6510/mcp` otherwise (`mcpHost()` in `.claude/mcp/vice/vice.ts:76-78`, detection via `.claude/mcp/vice/container-guard.mts`).
- Overridable via `VICE_MCP_URL` (full endpoint) or `VICE_MCP_HOST` (host only).
- Port band 6510-6599 is reserved by convention for a human-launched `x64sc` instance; the broker's own on-demand instances use a separate allocated band (6600+, `DEFAULT_BASE_PORT` in `broker-state.mts`).

**On-demand broker / control plane:**
- A host-side broker process (`.claude/mcp/vice/vice-broker.mts`, compiled to `resources/vice-broker.mjs`) launches, supervises, and recycles `x64sc` instances on demand instead of requiring a human to keep one running.
- Container ↔ broker communication is a **TCP control plane**: newline-delimited JSON over a raw socket, authenticated by a per-boot capability token; "connection open = claim a lease, connection close = release it" (`.claude/mcp/vice/vice-broker-client.ts`, `openBrokerControl()` / `BrokerControlSession`).
- Discovery record: `broker.json`, written under `.vice-supervisor/` (see below), containing `control_host`, `control_port`, `control_token`, `pid`, `heartbeat_at`.
- Five request kinds over the control plane: `acquire`, `release` (implicit, via socket close), `recycle`, `status`, `host_state`.
- A superseded, file-based request/grant/lease/recycle-ack protocol (polling files under `.vice-supervisor/`) has been fully retired in favor of the TCP control plane (documented in `vice-broker-client.ts` history comments).

**Reliability / session-identity handling:**
- Transport failures are retried with backoff (`RECONNECT_ATTEMPTS = 5`, backoff `[2000, 5000, 12000, 30000, 0]` ms) since the host server has been observed to drop and later recover connections (`withReconnect()` in `vice.ts`).
- Because the broker can respawn a **brand-new, blank** emulator instance after a crash, an "epoch" file (`.vice-supervisor/epoch.json`, path via `.claude/mcp/vice/repo-root.ts:supervisorDir()`) is compared before/after any reconnect to detect a silent machine restart (`readEpoch()`, `beginSession()`, `assertSameMachine()`, throwing `MachineRestartedError` when identity cannot be proven).
- A hard-coded `DENY_LIST` (`vice.ts:201-207`) permanently refuses certain tool names before any network call is serialized — most notably `vice_disk_list`, documented as crashing the shared host VICE MCP server, plus generic-surface meta-tools (`tools_list`, `tools_call`, `initialize`, `notifications_initialized`) that could otherwise smuggle a forbidden tool name as a nested argument.

**Tool surface (63 tools, see `.claude/mcp/vice/tools-manifest.json`):**
Execution control (`vice_execution_run/pause/step`, `vice_run_until`), registers (`vice_registers_get/set`), memory (`vice_memory_read/write/banks/search/fill/compare`), checkpoints & watchpoints (`vice_checkpoint_*`, `vice_watch_add`), chip state (`vice_vicii_*`, `vice_sid_*`, `vice_cia_*`), sprites (`vice_sprite_get/set/inspect`), disk (`vice_disk_attach/detach/read_sector` — `vice_disk_list` is deny-listed), display (`vice_display_screenshot/get_dimensions`), keyboard/joystick input (`vice_keyboard_*`, `vice_joystick_*`), disassembly and symbols (`vice_disassemble`, `vice_symbols_load/lookup`), snapshots (`vice_snapshot_save/load/list`), machine config (`vice_machine_config_get/set`, `vice_machine_reset`), and `vice_ping`.

## Filesystem-based "Integrations" (no network, but cross-process)

**Host-synchronized state directory:**
- `.vice-supervisor/` (gitignored) under the resolved project root — holds `epoch.json`, `broker.json`, and previously the file-based broker protocol (now retired). Root resolution order: `CLAUDE_PROJECT_DIR` env var, then `CONTAINER_WORKSPACE_PATH`, then a `.git` ancestor walk (`.claude/mcp/vice/repo-root.ts`).

**Deployed host launcher scripts:**
- On first tool call (unless `VICE_SKIP_RESOURCE_INSTALL=1`), the MCP server deploys its host-run helper scripts into `<project>/tools/` (gitignored, listed explicitly in `.gitignore`): `vice-launcher.sh`, `vice-broker.mjs`, `broker-control.mjs`, `broker-epoch.mjs`, `broker-kill.mjs`, `broker-launch.mjs`, `broker-state.mjs`, `container-guard.mjs`, plus a `.vice-deployed.json` manifest. See `.claude/mcp/vice/install-resources.ts`.
- `tools/vice-launcher.sh` is the operator-facing entry point run **on the host** (never inside the container) to boot/supervise/recover the VICE broker.

## Authentication & Identity

**No user-facing auth.** The only credential-like construct is the **per-boot capability token** (`control_token` in `broker.json`) authenticating the container↔broker TCP control plane — a locally generated shared secret, not tied to any external identity provider.

## Data Storage

**Databases:** None. No SQL/NoSQL client dependencies anywhere in the dependency tree.

**File Storage:** Local filesystem only — `.vice-supervisor/` state, `tools/` deployed scripts, and skill-generated artifacts (`.prg`, `.sym`, `.vs`, `.rep` files from `acme-build`; RAM capture/snapshot files from `c64-ram-capture`). No object storage / S3-style service.

**Caching:** None beyond in-memory module state in the MCP server (e.g. `activeInstance` in `vice.ts`).

## Monitoring & Observability

**Error Tracking:** None (no Sentry/Bugsnag/etc.). Errors are typed (`ViceError`, `MachineRestartedError`) and surfaced through the MCP tool-call response; incidents are recorded to disk by `.claude/mcp/vice/incident-record.ts`.

**Telemetry:** Mastra's own built-in telemetry (via `@mastra/core`/`@mastra/mcp`, which pulls in PostHog client libraries `@posthog/core`/`@posthog/types` transitively) is explicitly **disabled** everywhere the server is launched via `MASTRA_TELEMETRY_DISABLED=1` (set in `.mcp.json`, and in every installer-generated MCP entry — `installer/bin/cli.mjs:91`).

**Logs:** `console.error` for warnings/diagnostics (stderr, per MCP stdio server convention — stdout is reserved for the protocol).

## CI/CD & Deployment

**Hosting:** No application hosting — this ships as source/npm packages, not a deployed service.

**CI Pipeline:** GitHub Actions, `.github/workflows/ci.yml`:
- `build` job: `npm ci`, typecheck, test, smoke-test, `check-npm-packages.mjs` validation, `scripts/package.sh` build, artifact upload.
- `release` job (on `v*` tags): attaches the built zip + sha256 to a GitHub Release via `gh release create`/`upload` (uses the ambient `GITHUB_TOKEN`, `permissions: contents: write`).
- `publish-npm` job (on `v*` tags or manual `workflow_dispatch`): publishes `@henols/vice-mcp` then `@henols/c64-re-tools` to the public npm registry using **npm Trusted Publishing (OIDC)** — `permissions: id-token: write`, no `NPM_TOKEN` secret needed for the real publish path.
- `.github/workflows/check-npm-token.yml`: a manual, on-demand diagnostic workflow that verifies an `NPM_TOKEN` repository secret is present/valid (for troubleshooting only — it never prints the token, only whether `npm whoami` accepts it).
- Automatic release policy: every merge to `main` bumps and publishes a new **patch** version unless the merge commit subject contains `[skip release]`; minor/major bumps are triggered manually via `workflow_dispatch` input or a hand-pushed `v<version>` tag.

## Environment Configuration

**Required env vars:** None strictly required for default operation (all VICE/broker env vars have sane defaults). Relevant knobs are listed in `STACK.md`'s Configuration section (`VICE_MCP_URL`, `VICE_MCP_HOST`, `VICE_SKIP_RESOURCE_INSTALL`, etc.).

**Secrets location:** No `.env` files exist in the repo. The only secret-like value in CI is the GitHub-provided OIDC token (ephemeral, not stored) and, only for the diagnostic workflow, an optional `NPM_TOKEN` repository secret (unused by the actual publish path).

## Webhooks & Callbacks

**Incoming:** None.

**Outgoing:** None — no third-party webhook calls. The closest analog is the container→broker TCP control-plane connection described above, which is internal to this project's own tooling, not a public webhook.

---

*Integration audit: 2026-08-11*
