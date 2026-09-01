# External Integrations

**Analysis Date:** 2026-09-01

This project has **no cloud services, no SaaS integrations, and no server-hosted database**. Its integrations are: a locally/host-run emulator process (VICE) reached over **two alternative transports**, a local **SQLite** file (via `node:sqlite`) holding the annotation store, and the npm registry plus GitHub for distribution. There is no user-facing auth and no incoming or outgoing webhooks.

## Core Integration: VICE Emulator — two backends

The `vice` MCP server (`@henols/vice-mcp`, source in `src/mcp/vice/`) is a stdio MCP server that Claude Code launches. It does **not** run an emulator itself — it forwards `vice_*` tool calls to a **host-side** `x64sc` process. Since v0.5.x there are **two** backends, selected per project.

**Backend selection:**
- `src/mcp/vice/backend-detect.mts` is the ONE place that decides fork-vs-stock and the ONE reader of `VICE_BACKEND`. It spawns `<bin> --help` (`spawnSync`, argv array, `shell: false`, 5000ms kill-on-timeout) and classifies the text: `-mcpserver` present → `fork`; else `-binarymonitor` present → `stock`; else `unknown`. Result is memoized in-process and cached on disk as `backend.json` under the supervisor dir.
- Resolved **exactly once at broker process startup** (`vice-broker.mts`'s `run()`) and threaded down; never per-acquire, per-launch, or per-connect, and never inside `broker-launch.mts`'s synchronous `inFlight` guard.

### Backend A — fork (`-mcpserver`, HTTP JSON-RPC)

- Transport seam: `src/mcp/vice/vice.ts` — every fork interaction goes through its `call()`; no other file speaks HTTP/MCP to the VICE endpoint.
- Protocol: HTTP JSON-RPC 2.0 POSTed to `/mcp` (`initialize`, `tools/list`, `tools/call`), responses either plain JSON or SSE-framed (`text/event-stream`, `data:` lines), both parsed in `rpc()`.
- Served by a **non-upstream, custom-patched `x64sc`** launched with `-mcpserver -mcpserverhost <ip> -mcpserverport <port>` (`src/mcp/vice/resources/broker-launch.mts`, upstream: [barryw/vice-mcp](https://github.com/barryw/vice-mcp), ~17k lines of patched C).
- Endpoint resolution: `http://host.docker.internal:6510/mcp` inside a container, `http://127.0.0.1:6510/mcp` otherwise (`mcpHost()` in `vice.ts`, detection via `container-guard.mts`). Overridable by `VICE_MCP_URL` (full endpoint) or `VICE_MCP_HOST` (host only).
- Port band 6510-6599 is reserved by convention for a human-launched instance; broker-owned instances use an allocated band from `DEFAULT_BASE_PORT` in `broker-state.mts`.
- Liveness: `src/mcp/vice/vice-probe.ts` — deliberately fragile, no-retry, 1500ms.
- Tool surface: **62** tools, `src/mcp/vice/tools-manifest.json`.

### Backend B — stock (`-binarymonitor`, raw TCP binary protocol)

- Wire seam: `src/mcp/vice/stock-protocol.ts` — the ONE place that frames, parses, and demultiplexes binmon bytes; holds both the pure framing functions and `ViceMonitorClient` over a `node:net` socket (request-id correlation, demux, socket-lifecycle rejection). Derived from `henrik/c64-debug-mcp`'s `src/vice-protocol.ts` (v1.0.14, MIT) with four defects fixed on the way in.
- Handshake seam: `src/mcp/vice/stock-connect.ts` — claims the monitor socket from the broker **before** any TCP dial, opens the client, asserts `api_version`, reads build identity via `VICE_INFO`, settles version-gated capabilities once per binary, and detects same-machine-across-reconnect.
- Dispatch: `src/mcp/vice/stock-dispatch.ts` → `stock-handler.ts`, with per-domain implementations: `stock-memory.ts`, `stock-memory-search.ts`, `stock-registers.ts`, `stock-checkpoints.ts`, `stock-condition.ts`, `stock-execution.ts`, `stock-run-until.ts`, `stock-runstate.ts`, `stock-machine.ts`, `stock-input.ts`, `stock-petscii.ts`, `stock-symbols.ts`, `stock-vicii.ts`, `stock-cia.ts`, `stock-sprites.ts`, `stock-timing.ts`, `stock-disassemble.ts`, `stock-address.ts`, `stock-paths.ts`, `stock-diagnose.ts`, `stock-recycle.ts`, plus derived (client-side composed) tools in `stock-derived.ts`.
- Client-side work the fork did server-side: disassembly (`disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts`), PNG encoding of INDEXED8 `DISPLAY_GET` frames (`prg-image.ts`, `node:zlib`).
- Wire facts (normative, per `docs/phase0-binmon-findings.md`): 11-byte request / 12-byte response headers, little-endian; **five** unsolicited message types at request-id `0xffffffff` (`STOPPED` 0x62, `RESUMED` 0x63, `JAM` 0x61, `CHECKPOINT_INFO` 0x11, `REGISTER_INFO` 0x31) — the last two share a response type with legitimate replies, so demux must key on request-id; `JAM` has a **zero-length** body; memspace byte is `0x00` main / `0x01`-`0x04` for units 8-11.
- **Concurrency constraint:** stock's binary monitor services **exactly one client**. A second `connect()` sits unserviced in the backlog with no reply and no EOF, indistinguishable from a wedge — hence the broker-side `claimMonitor()` before dial (`MonitorOwnershipError` in `vice-broker-client.ts`).
- Launch-order constraint: `-default` must precede `-binarymonitor` or the monitor never binds.
- Tool surface: **38** tools, `src/mcp/vice/tools-manifest.stock.json` — a strict subset; the surface is trimmed per backend rather than degraded.
- Capability delta: `src/mcp/vice/capability-registry.ts` is the single authoritative table of gaps and their reason text (read-only message lookup, **never** an authorization boundary); `docs/tool-support.md` and `docs/stock-vice-parity.md` document it. Version gate: `CPUHISTORY_GET` (0x86) needs VICE >= 3.10.

### On-demand broker / control plane (shared by both backends)

- Host-side broker (`src/mcp/vice/vice-broker.mts` → `resources/vice-broker.mjs`) launches, supervises, and recycles `x64sc` instances on demand.
- Container ↔ broker: **TCP control plane**, newline-delimited JSON over a raw socket, authenticated by a per-boot capability token; "connection open = claim a lease, connection close = release it" (`src/mcp/vice/vice-broker-client.ts`, `openBrokerControl()` / `BrokerControlSession`).
- Discovery record: `broker.json` under `.vice-supervisor/`, containing `control_host`, `control_port`, `control_token`, `pid`, `heartbeat_at`.
- Request kinds: `acquire`, `release` (implicit via socket close), `recycle`, `status`, `host_state`, plus the stock-only monitor claim.
- Must run as a **systemd user unit** in practice — `setsid`/`nohup` dies with the session and voids captures in flight.
- The superseded file-based request/grant/lease/recycle-ack protocol is fully retired.

### Reliability / session-identity handling

- Fork transport failures retried with backoff (`RECONNECT_ATTEMPTS = 5`, `[2000, 5000, 12000, 30000, 0]` ms) in `withReconnect()` (`vice.ts`).
- Because the broker can respawn a **blank** emulator after a crash, an epoch file (`.vice-supervisor/epoch.json`, path via `repo-root.ts:supervisorDir()`) is compared before/after any reconnect: `readEpoch()`, `beginSession()`, `assertSameMachine()`, throwing `MachineRestartedError` — the ONE restart error type in the tree, reused by `stock-connect.ts`.
- `DENY_LIST` (`vice.ts`) permanently refuses certain tool names before any call is serialized — `vice_disk_list` (crashes the shared host fork server) plus generic meta-tools (`tools_list`, `tools_call`, `initialize`, `notifications_initialized`) that could smuggle a forbidden name as a nested argument. This is the only refusal in the tree that is a security control, and it runs strictly before any capability-registry lookup.
- Three resources are denied outright because they power-cycle the machine one call deep: `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency`.
- Incident capture: `src/mcp/vice/incident-record.ts` writes a pre-kill record before any recycle/kill.

## Data Storage

**Annotation store (SQLite, local file):**
- `node:sqlite` (`DatabaseSync`) is named by **exactly one module**, `src/mcp/vice/anno-store.ts` (STORE-07, enforced by `anno-seam.test.ts` across all four access routes).
- On-disk `SCHEMA_VERSION` is **3** (`src/mcp/vice/anno-types.ts`); the full schema is created at first open. Tables include `anno_meta`, labels, comments, ranges, scopes, blocks, cross-references, `anno_snapshot` (revision ring, `MAX_SNAPSHOT_REVISIONS`), `anno_enum` and `anno_enum_usage` (added at v3, D-15). A version-1 store is **refused, not migrated**.
- Integrity posture: an open validates the `anno_meta` row, the `schema_version` match, and `pragma integrity_check` (~0.73ms on a 100KB/5,000-row store), because a zero-length file otherwise opens cleanly and reports `ok`.
- Journal mode is deliberately left at the default `delete` (single-file at rest, only a transient `<db>-journal`); no `pragma journal_mode` is ever issued, since it is a persistent database property.
- Store path is caller-supplied (`--store` on `anno-cli.ts`; `storePathWithinWorkspace()` in `anno-types.ts` confines it to the workspace).
- Tool surface: **19** `anno_*` tools in `src/mcp/vice/anno-tools.ts` — `anno_get_binary_info`, `anno_get_symbols`, `anno_get_comments`, `anno_get_blocks`, `anno_get_cross_references`, `anno_get_address_details`, `anno_read_region`, `anno_search`, `anno_disassemble`, `anno_set_label_name`, `anno_set_comment`, `anno_set_data_type`, `anno_add_scope`, `anno_remove_scope`, `anno_create_project_enum`, `anno_update_project_enum`, `anno_apply_enum_usage`, `anno_batch_execute`, `anno_save_project`. Registered through `buildViceTool()`, so they appear in **neither** tool manifest and never reach `forwardToVice()` — the MCP-02 host-path-rewrite hazard is satisfied by construction for this family.
- Supporting modules: `anno-index.ts`, `anno-derive.ts`, `anno-details.ts`, `anno-register.ts`, `anno-coverage.ts`, `anno-confidence.ts`, `anno-export-asm.ts`, `anno-memmap-render.ts` (**contains a NUL byte — invisible to plain `grep`, use `grep -a`**), `anno-symbols.ts`, `anno-acme-ident.ts`, `anno-enum-gen.ts`, `anno-regbits-gen.ts` + `anno-regbits.json`, `anno-d64.ts` (offline `.d64` directory listing / named-entry extraction, a deliberate second copy of the sector-chain walk that also lives in `src/skills/c64-ram-capture/scripts/d64-parse.mjs`), `block-class.ts`, `prg-image.ts`, `anno-cli.ts` (host-out CLI entry).

**Other databases:** None. No SQL/NoSQL *client* dependency anywhere in the npm tree.

**File Storage:** Local filesystem only —
- `.vice-supervisor/` (gitignored): `epoch.json`, `broker.json`, `backend.json`, incident records.
- `.vice-snapshots/` (gitignored): `<name>.vsf` + `.json` sidecar written by `vice_snapshot_save` (path from `snapshotPathFor()` in `stock-paths.ts`).
- `tools/` (gitignored, listed per-file): deployed host launcher scripts.
- Skill-generated artifacts (`.prg`, `.sym`, `.vs`, `.rep`, RAM captures).
- No object storage / S3-style service.

**Caching:** In-memory module state only (`activeInstance` in `vice.ts`, the backend memo in `backend-detect.mts`), plus the on-disk `backend.json` capability cache.

## Filesystem-based cross-process "integrations"

**Host-synchronized state directory:**
- `.vice-supervisor/` under the resolved project root. Root resolution order: `CLAUDE_PROJECT_DIR` → `CONTAINER_WORKSPACE_PATH` → `.git` ancestor walk (`src/mcp/vice/repo-root.ts`).

**Deployed host launcher scripts:**
- On first tool call (unless `VICE_SKIP_RESOURCE_INSTALL=1`), the server deploys host-run helpers into `<project>/tools/`: `vice-launcher.sh`, `vice-broker.mjs`, `broker-control.mjs`, `broker-epoch.mjs`, `broker-kill.mjs`, `broker-launch.mjs`, `broker-state.mjs`, `container-guard.mjs`, and (new) **`backend-detect.mjs`**, plus a `.vice-deployed.json` manifest. See `src/mcp/vice/install-resources.ts`; `host-scripts.test.ts` keeps the `.gitignore` list and `resourceEntries()` in two-way parity.
- `tools/vice-launcher.sh` is the operator-facing entry point run **on the host** (never inside the container).

**External skill sources:**
- `skills-lock.json` (repo root) pins externally sourced Claude skills by content sha256 — currently one entry, `mastra` from the `mastra-ai/skills` GitHub repo (`skills/mastra/SKILL.md`).

## Authentication & Identity

**No user-facing auth.** The only credential-like construct is the **per-boot capability token** (`control_token` in `broker.json`) authenticating the container↔broker TCP control plane — a locally generated shared secret (`node:crypto`), not tied to any identity provider. The stock binary monitor itself has **no authentication**, which is why single-client ownership is brokered rather than negotiated on the wire.

## Monitoring & Observability

**Error Tracking:** None (no Sentry/Bugsnag). Errors are typed (`ViceError`, `MachineRestartedError`, `StockProtocolError`, `StockFramingError`, `StockDesyncError`, `StockResponseMismatchError`, `StockConnectionClosedError`, `StockRequestTimeoutError`, `MonitorOwnershipError`, `AnnoTypeError`) and surfaced through the MCP tool-call response; incidents are recorded to disk by `src/mcp/vice/incident-record.ts`.

**Telemetry:** Mastra's built-in telemetry (which pulls in `@posthog/core`/`@posthog/types` transitively) is explicitly **disabled** everywhere the server is launched via `MASTRA_TELEMETRY_DISABLED=1` (`.mcp.json`, and every installer-generated MCP entry in `installer/bin/cli.mjs`). `src/mcp/vice/telemetry-import.test.ts` guards it.

**Logs:** `console.error` for warnings/diagnostics (stderr, per MCP stdio convention — stdout is reserved for the protocol). `vice_diagnose` is a synthetic proxy-local tool that gathers wedge evidence on demand (`stock-diagnose.ts`, `gatherWedgeEvidence()` in `vice-proxy.ts`).

## CI/CD & Deployment

**Hosting:** No application hosting — this ships as source/npm packages, not a deployed service.

**CI Pipeline:** GitHub Actions, `.github/workflows/ci.yml`, on `node-version: "24"`:
- `build` job: `npm ci`, typecheck, install ACME (DISASM-03 round-trip gate), assemble the `acme-build` scaffold, generate the shipped skills tree (`scripts/sync-skills.mjs`), `npm test`, `npm run smoke`, installer tests, skill-script tests (`node --test 'src/skills/*/scripts/*.test.mjs'`), `check-npm-packages.mjs`, `scripts/package.sh`, artifact upload.
- `release` job (on `v*` tags): attaches the built zip + sha256 to a GitHub Release via `gh release create`/`upload` (ambient `GITHUB_TOKEN`, `permissions: contents: write`).
- `publish-npm` job (on `v*` tags or manual `workflow_dispatch`): publishes `@henols/vice-mcp` then `@henols/c64-re-tools` using **npm Trusted Publishing (OIDC)** — `permissions: id-token: write`, no `NPM_TOKEN` needed.
- `.github/workflows/check-npm-token.yml`: manual diagnostic only; verifies an `NPM_TOKEN` secret is present/valid without printing it.
- Release policy: every merge to `main` bumps and publishes a **patch** version unless the merge commit subject contains `[skip release]`; minor/major via `workflow_dispatch` input or a hand-pushed `v<version>` tag.

## Environment Configuration

**Required env vars:** None strictly required for default operation — all VICE/broker/anno knobs have defaults. Full list in `STACK.md`'s Configuration section.

**Secrets location:** No `.env` files exist in the repo. The only secret-like values are the ephemeral GitHub OIDC token in CI, the optional (publish-path-unused) `NPM_TOKEN` diagnostic secret, and the runtime-generated broker `control_token`.

## Webhooks & Callbacks

**Incoming:** None.

**Outgoing:** None. The closest analogs are internal to this project's own tooling: the container→broker TCP control-plane connection, and stock VICE's **unsolicited** binmon event frames (`CHECKPOINT_INFO`, `STOPPED`, `RESUMED`, `JAM`, `REGISTER_INFO`) pushed at request-id `0xffffffff`, which are demuxed as events and must never resolve a pending request.

---

*Integration audit: 2026-09-01*
