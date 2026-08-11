<!-- refreshed: 2026-08-11 -->
# Architecture

**Analysis Date:** 2026-08-11

## System Overview

This repository is a **Claude Code plugin** distributed as two npm packages
(`@henols/vice-mcp`, `@henols/c64-re-tools`) plus a plugin manifest. It has two
independently-deployable halves: an **MCP server** that proxies VICE C64
emulator control into a container, and a set of **skills** (markdown
playbooks + Node scripts) that use that server's tools to do C64
reverse-engineering work. Nothing in this repo runs a C64 emulator itself —
`x64sc` always runs on the **host**, outside the container/sandbox Claude
Code executes in.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    Claude Code (client, in-container)                 │
│  loads skills as playbooks, calls mcp__plugin_c64-re-tools_vice__*    │
├─────────────────────────────┬───────────────────────────────────────┤
│   Skills (playbooks +        │   `vice` MCP server (stdio)           │
│   Node scripts, offline)     │   `.claude/mcp/vice/vice-proxy.ts`    │
│  `.claude/skills/*/SKILL.md` │   answers initialize/tools_list       │
│  `.claude/skills/*/scripts/` │   locally; forwards tools_call        │
└───────────────┬───────────────┴──────────────┬────────────────────────┘
                │ (drives the emulator only          │ HTTP (JSON-RPC/MCP)
                │  via vice_* tool calls)             ▼
                │                     ┌───────────────────────────────────┐
                │                     │   Host VICE MCP server (:6510+)    │
                │                     │   external process, not this repo  │
                │                     └───────────────┬─────────────────────┘
                │                                     │ spawns/controls
                ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│         Host broker daemon (long-lived, on-demand pool)               │
│  `.claude/mcp/vice/vice-broker.mts` -> compiled to                    │
│  `.claude/mcp/vice/resources/vice-broker.mjs` (deployed under         │
│  `<project>/tools/` by `install-resources.ts`)                        │
│  Owns: port allocation, warm floor, crash supervision, epoch/         │
│  liveness records, TCP control listener (acquire/release/recycle)     │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ launches / kills
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  x64sc instance(s) (VICE emulator, host)               │
│  one process per acquired lease; state under `.vice-supervisor/`       │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Stdio MCP entry point | Speaks MCP JSON-RPC to Claude Code over stdin/stdout; answers `initialize`/`tools/list` locally from the manifest, forwards `tools/call` | `.claude/mcp/vice/vice-proxy.ts` |
| Transport seam | The one place that speaks HTTP/MCP to the host VICE server; owns retry ladder, SSE parsing, deny-list enforcement, epoch/restart detection | `.claude/mcp/vice/vice.ts` |
| Liveness probe | Deliberately fragile, no-retry 1500ms liveness check (distinct from `vice.ts`'s resilient path) | `.claude/mcp/vice/vice-probe.ts` |
| Broker client | Container-side half of the on-demand broker protocol: acquire/release/recycle over a TCP control session | `.claude/mcp/vice/vice-broker-client.ts` |
| Repo root resolution | The one shared resolver for "where is the project root" / "where is `.vice-supervisor`" | `.claude/mcp/vice/repo-root.ts` |
| Resource deployment | Deploys host launcher scripts (`tools/`) into the *consuming* project on first use | `.claude/mcp/vice/install-resources.ts` |
| Container detection | Five-signal container-vs-host detector, checked at broker process startup | `.claude/mcp/vice/container-guard.mts` |
| Host/container path translation | Rewrites container paths (bind-mount) to host-reachable paths, and the inverse | `.claude/mcp/vice/hostpath.ts`, `.claude/mcp/vice/containerpath.ts` |
| Incident capture | Writes a pre-kill incident record (snapshot/screenshot metadata) before any recycle/kill | `.claude/mcp/vice/incident-record.ts` |
| Host broker daemon | Long-lived pool manager: port allocation, warm floor, crash supervision, TCP control listener | `.claude/mcp/vice/vice-broker.mts` (+ `broker-*.mts` siblings) |
| Build step | Compiles host-bound `.mts` sources into committed, banner-marked `.mjs` under `resources/` | `.claude/mcp/vice/build.ts` |
| Manifest refresh | Regenerates `tools-manifest.json` from the live host server's `tools/list` | `.claude/mcp/vice/refresh-manifest.ts` |
| Plugin manifest | Declares skills dir, mcpServers file, SessionStart hook | `.claude-plugin/plugin.json` |
| MCP server wiring | The `vice` server entry Claude Code launches | `.mcp.json` |
| npm installer | Non-plugin install path: copies skills + wires `.mcp.json` into any project | `installer/bin/cli.mjs` |
| Skills (six) | Markdown playbooks + Node scripts driving the MCP tools or working offline on files | `.claude/skills/*/SKILL.md`, `.claude/skills/*/scripts/*.mjs` |

## Pattern Overview

**Overall:** Split-process proxy/broker architecture with a hard container/host
boundary, wrapped as a Claude Code plugin.

**Key Characteristics:**
- **Container-in / host-out split**: the MCP proxy and skills run inside the
  Claude Code sandbox; the actual emulator and its broker run on the host.
  Every cross-boundary path is explicitly translated (`hostpath.ts` /
  `containerpath.ts`), never assumed identical.
- **Single seam per concern**: one file owns each cross-cutting responsibility
  (one transport (`vice.ts`), one repo-root resolver (`repo-root.ts`), one
  container detector (`container-guard.mts`), one deny-list). Comments
  throughout the codebase explicitly warn against re-deriving these
  elsewhere ("closed consumer set").
- **Generated-but-committed artifacts**: `.mts` sources under
  `.claude/mcp/vice/` are compiled by `build.ts` into `.mjs` under
  `resources/`, which IS committed to git (not gitignored) because it is
  what actually gets deployed to a consuming project's `tools/` directory
  and cannot depend on a build step running there.
- **No build step for the shipped server**: `vice-proxy.ts` and its sibling
  `.ts` modules run directly under Node's native TypeScript type-stripping
  (Node >= 22.18) — `package.json`'s `bin` points straight at a `.ts` file.
- **Documentation-as-code**: source files carry long structured header
  comments recording *why* a decision was made, prior incidents, and
  explicit "do not revert this" warnings (e.g. `vice.ts`'s `mcpHost()`,
  `repo-root.ts`'s hop-count history). Treat these comments as part of the
  architecture record, not incidental — they encode constraints an executor
  must not silently undo.
- **Never-throw boundary**: the stdio server registers global handlers before
  anything else runs, because a dead stdio MCP server is never
  auto-restarted by Claude Code for the rest of the session (`vice-proxy.ts`).

## Layers

**Skills layer:**
- Purpose: Domain playbooks for C64 reverse-engineering tasks (build,
  memory-map lookup, program recon, provenance diffing, RAM capture, wedge
  triage). Each skill is markdown instructions plus small offline Node
  scripts.
- Location: `.claude/skills/<skill-name>/`
- Contains: `SKILL.md` (playbook, YAML frontmatter + prose), `scripts/*.mjs`
  (executable helpers, some with co-located `*.test.mjs`), `templates/`,
  `references/` where present.
- Depends on: the `vice` MCP tool surface (for skills that touch the
  emulator: `c64-ram-capture`, `vice-wedge-triage`) or pure filesystem
  operations (for `acme-build`, `c64-memory-mapping`, `c64-provenance-diff`).
- Used by: Claude Code directly, matched by `SKILL.md` frontmatter
  `description` triggers.

**MCP server layer (container-side):**
- Purpose: Presents a stable `vice_*` tool surface over stdio to Claude Code,
  forwards calls to the host.
- Location: `.claude/mcp/vice/*.ts` (authored TypeScript, no build step)
- Contains: wire protocol (`vice-proxy.ts`), transport/deny-list
  (`vice.ts`), broker client (`vice-broker-client.ts`), path translation
  (`hostpath.ts`, `containerpath.ts`), repo/root + resource deployment
  (`repo-root.ts`, `install-resources.ts`), incident capture
  (`incident-record.ts`).
- Depends on: `@mastra/mcp` / `@mastra/core` for stdio JSON-RPC framing,
  `@modelcontextprotocol/sdk` (transitive) for `CallToolRequestSchema`.
- Used by: Claude Code's MCP client, per `.mcp.json`.

**Broker layer (host-side, deployed):**
- Purpose: On-demand pool of `x64sc` instances; owns launch, warm floor,
  crash supervision, port allocation, and a TCP control protocol for
  acquire/release/recycle.
- Location authored: `.claude/mcp/vice/vice-broker.mts` +
  `broker-state.mts`, `broker-launch.mts`, `broker-kill.mts`,
  `broker-epoch.mts`, `broker-control.mts`, `container-guard.mts`.
- Location deployed (compiled): `.claude/mcp/vice/resources/*.mjs` (and
  `vice-launcher.sh`), copied by `install-resources.ts` into the consuming
  project's `tools/` directory at first use.
- Depends on: Node builtins only (`node:child_process`, `node:fs`,
  `node:path`) — no third-party deps, since this code runs unbuilt on the
  host outside any npm-managed environment.
- Used by: the container-side `vice-broker-client.ts`, over a TCP control
  socket; state files under `.vice-supervisor/` at the project root.

**Installer layer:**
- Purpose: Non-plugin distribution path — `npx @henols/c64-re-tools` copies
  skills and wires `.mcp.json` into an arbitrary target project.
- Location: `installer/bin/cli.mjs`, `installer/scripts/sync-skills.mjs`
- Depends on: the canonical skills under `.claude/skills/` (synced into
  `installer/skills/` before packaging).
- Used by: end users installing outside the Claude Code plugin marketplace.

## Data Flow

### Primary tool-call path (emulator control)

1. Claude Code sends a `tools/call` JSON-RPC request over stdio to the
   already-running `vice-proxy.ts` process (`.claude/mcp/vice/vice-proxy.ts`).
2. The `CallToolRequestSchema` override (installed after `startStdio()`
   resolves) looks up the tool, checks it against `DENY_LIST`
   (`.claude/mcp/vice/vice.ts`), and dispatches to `forwardToVice(name, args)`.
3. `call()` in `vice.ts` builds/serialises the request, resolves the active
   endpoint (`activeInstance()`, possibly redirected by a broker lease via
   `useInstance()`), and does the HTTP round trip to the host VICE MCP
   server, with retry and epoch/restart detection.
4. If a broker lease is in play, `vice-broker-client.ts` has already
   performed acquire/heartbeat over a TCP control session
   (`openBrokerControl()`) against the host broker
   (`.claude/mcp/vice/vice-broker.mts` running as deployed `.mjs`).
5. Any host-side file path in the request/response is translated at the
   boundary: container → host via `hostpath.ts`, host → container via
   `containerpath.ts` (`containerizeRecord()`), so neither side ever sees a
   path meaningless to it.
6. The response is wrapped back into the MCP `{content, isError}` shape and
   written to stdout for Claude Code.

### Recovery/incident path (recycle or crash)

1. `vice.ts`'s epoch check or an explicit recycle request detects the
   instance needs recovery.
2. A pre-kill incident record is written **before** anything is killed
   (`writeIncidentRecord()` in `incident-record.ts`, D-17 invariant).
3. The broker's kill path runs (`broker-kill.mts`: `verifiedKill()`), then
   `broker-launch.mts` relaunches through the single-owner `tryLaunchOne()`
   guard (never a second concurrent launch — this guard exists because of a
   real historical outage from concurrent spawns).
4. `finaliseIncidentRecord()` completes the record once evidence (screenshot,
   snapshot) is gathered.

### Skill-driven offline flow (e.g. `c64-provenance-diff`)

1. A skill script (`.claude/skills/c64-provenance-diff/scripts/diff-images.mjs`)
   is invoked directly by Claude Code as a subprocess — no MCP call.
2. The script reads files (disk images, prior ledgers) from the project
   directory and writes results (ledger entries, diffs) back to the project.
3. Ordering is enforced by convention within the skill's `SKILL.md`
   (`anchor-search` before `diff` before `ledger`), not by code.

**State Management:**
- Host-synchronised state lives under `.vice-supervisor/` at the resolved
  repo root (`epoch.json`, broker records, per-instance logs) — written
  atomically (tmp-sibling-then-rename) throughout.
- The MCP transport seam (`vice.ts`) holds mutable module-level state
  (`activeUrl`, `activeEpochFile`, `activePort`, `activePooled`) deliberately
  not frozen at import time, since a broker lease redirect must change it at
  runtime for every subsequent call.

## Key Abstractions

**Repo root resolver:**
- Purpose: Single definition of "where is the project this MCP instance is
  working in", correct whether running in-repo, as an installed plugin, or
  inside a devcontainer.
- Examples: `.claude/mcp/vice/repo-root.ts` (`repoRoot()`, `supervisorDir()`)
- Pattern: Ordered fallback ladder — `CLAUDE_PROJECT_DIR` env →
  `CONTAINER_WORKSPACE_PATH` (if it contains the caller) → `.git` ancestor
  walk → `CONTAINER_WORKSPACE_PATH` anyway → fixed hop count, each later
  branch logging a one-time stderr warning.

**Deny-list:**
- Purpose: Hard-blocks specific tool names known to crash or bypass the
  shared host MCP server (`vice_disk_list`, plus protocol-shaped names like
  `tools_call`, `initialize`), enforced before any request is serialised.
- Examples: `DENY_LIST` and `denyListRefusalMessage()` in
  `.claude/mcp/vice/vice.ts`, re-checked in `vice-proxy.ts`'s registration
  loop and `CallToolRequestSchema` override.
- Pattern: One array, checked at every dispatch seam — never re-derived
  per-caller.

**Host/container path pair:**
- Purpose: Translate a bind-mounted path between the container's view and
  the host's view, in both directions.
- Examples: `.claude/mcp/vice/hostpath.ts` (container → host, via
  `HOST_WORKSPACE_PATH` or `/proc/self/mountinfo` heuristics),
  `.claude/mcp/vice/containerpath.ts` (host → container, `containerizeRecord()`)
- Pattern: Both take the workspace root as an explicit argument rather than
  importing `repo-root.ts`, specifically to avoid a module import cycle
  (`hostpath.ts` header documents the exact cycle and crash it would cause).

**Broker lease:**
- Purpose: On-demand pool of emulator instances, acquired/released/recycled
  over a persistent TCP control connection rather than file-based polling.
- Examples: `.claude/mcp/vice/vice-broker-client.ts`
  (`openBrokerControl()`, `BrokerControlSession`), `broker-control.mts`
  (server side).
- Pattern: The connection itself IS the lease — no separate TTL/heartbeat
  file mechanism (an earlier file-lease design was deliberately retired).

**Generated resource bundle:**
- Purpose: Host-bound `.mjs` scripts that must run on a bare host Node with
  no npm install step.
- Examples: `.claude/mcp/vice/resources/*.mjs`, each prefixed with a
  `GENERATED FILE — DO NOT EDIT` banner produced by `build.ts`.
- Pattern: `build.ts` asserts the emitted file set exactly matches
  `HOST_BOUND_ARTIFACTS` — an unexpected addition or omission fails the
  build rather than deploying silently.

## Entry Points

**Stdio MCP server:**
- Location: `.claude/mcp/vice/vice-proxy.ts` (declared as `bin.vice-mcp` and
  `main` in `.claude/mcp/vice/package.json`; launched via
  `${CLAUDE_PLUGIN_ROOT}/.claude/mcp/vice/vice-proxy.ts` in `.mcp.json`)
- Triggers: Claude Code spawning the configured `vice` MCP server once per
  session.
- Responsibilities: JSON-RPC framing (delegated to `@mastra/mcp`
  `MCPServer`), tool listing, tool-call dispatch, deny-list enforcement,
  resource deployment side effect (via importing `repo-root.ts`).

**Host broker daemon:**
- Location: `.claude/mcp/vice/vice-broker.mts` (authored) /
  `.claude/mcp/vice/resources/vice-broker.mjs` (deployed, run by
  `resources/vice-launcher.sh` on the host)
- Triggers: First on-demand acquire request from the container side, or a
  human launching it directly on the host.
- Responsibilities: parse CLI args (`--repo-root`, `--state-dir`,
  `--check-container`, `--dry-run`), run the container guard, maintain the
  warm floor, own the single in-flight launch guard, serve the TCP control
  listener.

**npm installer CLI:**
- Location: `installer/bin/cli.mjs` (`npx @henols/c64-re-tools [targetDir]`)
- Triggers: A user running the installer against their own project.
- Responsibilities: copy `installer/skills/` into `<target>/.claude/skills/`,
  merge a `vice` entry into `<target>/.mcp.json`, optionally vendor the MCP
  package locally with `--vendor`.

**Manual build/refresh scripts:**
- `.claude/mcp/vice/build.ts` — `node build.ts`, recompiles `.mts` →
  `resources/*.mjs`.
- `.claude/mcp/vice/refresh-manifest.ts` — regenerates `tools-manifest.json`
  from a live host server.
- `scripts/package.sh` — validates manifests and builds the plugin release
  zip (used by CI, `.github/workflows/ci.yml`).
- `scripts/ensure-mcp-deps.sh` — SessionStart hook that runs `npm ci` for
  the MCP server's real dependencies on first use (gated on a lockfile hash).

## Architectural Constraints

- **Container/host boundary is load-bearing everywhere:** any file that
  builds a host-facing path or hostname must go through `hostpath.ts` /
  `containerpath.ts` / `container-guard.mts` — the project maintains and
  tests a *closed consumer set* for host-path logic (enforced by a doc
  guardrail test referenced in `.claude/mcp/vice/README.md`).
- **No build step for the shipped server:** `vice-proxy.ts` and its
  container-side siblings run as raw `.ts` files under Node's native
  type-stripping. Only the host-bound `.mts` files require `tsc` (via
  `build.ts`) because they must run un-transpiled on a bare host Node.
- **Single-owner launch guard:** `broker-launch.mts` keeps one
  module-level `inFlight` boolean as the sole gate on spawning a new
  `x64sc` instance; this exists specifically to prevent a repeat of a real
  concurrent-spawn outage. Do not add a second, parallel gating mechanism.
- **Global state:** `vice.ts` holds mutable module-level transport state
  (`activeUrl`, `activeEpochFile`, `activePort`, `activePooled`); a broker
  lease mutates it via `useInstance()`, resetting the MCP handshake flag.
  `broker-launch.mts` holds the module-level `inFlight` / `inFlightReason`
  launch guard.
- **Module-cycle avoidance is deliberate and documented:** `repo-root.ts` →
  `install-resources.ts` → (would-be) `hostpath.ts` → `repo-root.ts` is a
  known cycle that was broken by having `hostpath.ts` take `workspaceRoot`
  as an explicit argument instead of importing `repo-root.ts`. Do not
  re-introduce that import.
- **Threading:** single-threaded Node event loop throughout; the broker
  uses `child_process.spawn` for emulator instances, not worker threads.

## Anti-Patterns

### Re-deriving a cross-cutting seam locally

**What happens:** A new module computes its own repo root, its own
host/container hostname default, or its own container-detection check
instead of importing the canonical helper.
**Why it's wrong:** This codebase has direct history of exactly this bug —
`mcpHost()`'s header in `vice.ts` documents three separate inlined copies of
`process.env.VICE_MCP_HOST || "host.docker.internal"` that existed before
being collapsed into one function, and `repo-root.ts`'s header documents a
depth-assumption bug from copy-pasted hop counts.
**Do this instead:** Import `repoRoot()`/`supervisorDir()` from
`repo-root.ts`, `mcpHost()` from `vice.ts`, and `isInsideContainer()` from
`container-guard.mts`. Never inline an equivalent check.

### Killing/relaunching preemptively to serve a newer request

**What happens:** Interrupting an in-flight emulator boot to satisfy a
later, higher-priority acquire request.
**Why it's wrong:** `broker-launch.mts` explicitly rejects this
("preemption... re-creates the exact concurrent-spawn window the
2026-08-01 outage came from"). Priority only decides who gets a slot once it
next frees, never who currently holds it.
**Do this instead:** Let an in-flight boot always complete; queue later
requests behind the fixed-order pass in `runBrokerPass()`.

## Error Handling

**Strategy:** Fail loud and traceable at process boundaries; never silently
produce a plausible-looking wrong answer.

**Patterns:**
- The stdio server registers global uncaught-exception/rejection handlers
  before anything else runs (`vice-proxy.ts`), since a dead stdio server is
  never restarted by Claude Code mid-session.
- Path/root resolution fallbacks emit a one-time stderr warning rather than
  silently guessing (`repo-root.ts`'s `warnedEnvOutsideFrom` /
  `warnedNoMarkerFound` gates).
- `MachineRestartedError` (`vice.ts`) is a distinct error type for
  epoch-mismatch detection, so a silent host restart is never mistaken for a
  successful call.
- Incident records are written **before** any destructive action
  (`incident-record.ts`), so a crash mid-recovery still leaves evidence.

## Cross-Cutting Concerns

**Logging:** stderr `console.error()` calls throughout, often gated to fire
once per process to avoid log spam (`repo-root.ts` warning flags); per-instance
boot/crash logs written to files under the broker's log directory
(`broker-epoch.mts`'s `instanceLogDirFor()`).

**Validation:** Runtime narrowing at every JSON boundary via `isPlainObject()`
checks rather than unchecked casts (documented convention shared between
`vice-proxy.ts` and `vice-broker.mts`).

**Authentication:** No end-user auth; the broker's TCP control listener uses
a per-process `control_token` (`newControlToken()` in `broker-control.mts`)
to scope who may issue control commands to a given broker instance.

---

*Architecture analysis: 2026-08-11*
