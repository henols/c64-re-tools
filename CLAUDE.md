<!-- GSD:project-start source:PROJECT.md -->
## Project

**c64-re-tools**

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects. It ships a `vice` MCP server
(~63 tools driving a host VICE emulator through an on-demand broker) plus six C64
reverse-engineering skills, distributed both as two npm packages
(`@henols/vice-mcp`, `@henols/c64-re-tools`) and as a Claude Code plugin.

Today the whole tool surface only works against a **custom, non-upstream VICE
fork** ([barryw/vice-mcp](https://github.com/barryw/vice-mcp), ~17k lines of C
patched into the emulator, exposing `-mcpserver` and an HTTP `/mcp` endpoint).
This milestone adds a second backend that drives **stock upstream VICE** through
its binary monitor, selected per project — so the plugin works on a VICE anyone
can install, without giving up the fork's capabilities.

**Core Value:** A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

### Constraints

- **Compatibility**: The stdio MCP surface is **trimmed per backend** — stock advertises only the tools it implements, so the two backends expose different tool lists (Phase 2, D-07). A tool advertised on both keeps the same name and argument shape, and the fork's list is unchanged from v0.1.x. A skill written against the full fork surface therefore *breaks* on stock rather than degrading; the playbooks must name the stock route or the fork requirement (SKILL-01).
- **Architecture**: The transport swap happens behind `vice.ts`'s `call()` seam for *direct* tools. **Derived tools must be intercepted before `forwardToVice()`, not behind `call()`** — `rewriteArguments()` runs at `vice-proxy.ts:2773` inside `forwardToVice()` and before `call()`, so a derived tool sitting behind `call()` receives host-translated paths and acts on them inside the container. Second site with the same cause: `gatherWedgeEvidence()` calls `rewriteArguments()` itself.
- **Protocol (settled, normative)**: 11-byte request header / 12-byte response header, all multi-byte values little-endian. Confirmed opcode set and error codes per `docs/phase0-binmon-findings.md` §5.
- **Protocol**: **Five** unsolicited message types arrive at request-id `0xffffffff`, not three: `STOPPED` (0x62), `RESUMED` (0x63), `JAM` (0x61), plus `CHECKPOINT_INFO` (0x11) on every checkpoint hit and `REGISTER_INFO` (0x31) on every monitor open. The last two **share a response type with a legitimate command reply**, so demux must key on request-id and never resolve a pending request with an event.
- **Protocol**: `JAM` (0x61) has a **zero-length body**. `monitor_binary.c:384-394` computes the PC then passes `length = 0`, so no PC is sent. Every client surveyed assumes 2 bytes and breaks on it.
- **Protocol**: A non-stopping checkpoint emits a `CHECKPOINT_INFO` frame per hit **synchronously, over the blocking socket, from inside the CPU loop** — `mon_breakpoint.c:557-562` calls `mon_breakpoint_event()` before checking `cp->stop`. On a hot address this can stall the emulator thread. Independent source-level confirmation of `vice-sync.ts`'s "poll on `hit_count`, never on paused state" invariant.
- **Concurrency**: Stock VICE's binary monitor services **exactly one client**. A second `connect()` sits unserviced in the backlog with no reply and no EOF — indistinguishable from a wedge. The broker must guarantee single-client-per-instance and must not diagnose this state as a hang.
- **Protocol**: `default_memspace` contamination has no direct remedy over the binary monitor. A drive checkpoint hit sets it (`monitor.c:3393-3396`) and no command resets it, after which `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the *drive* CPU and `@bank:` conditions fail outright. Affects any stepping code written after drive debugging is added.
- **Protocol**: The wire memspace byte is **not** the internal enum — `0x00` = main, `0x01`–`0x04` = units 8–11 (`monitor_binary.c:401-434`). `0x08` is rejected.
- **Protocol**: Checkpoint *conditions* use the pseudo-registers `RL` and `CY` (uppercase), **not** the register-list names `LIN`/`CYC` — those lex as `BANKNAME` and produce a syntax error. Conditions have **no operator precedence** (`mon_parse.y:168`), so `RL == $64 && CY == $14` parses as `(((RL==$64) && CY) == $14)` and is always false; parenthesise every comparison. Bare integer literals are **hex** by default (`monitor.c:1597`), so `RL == 100` means line 256.
- **Protocol**: `CPUHISTORY_GET`'s count field is read as uint32 but stored in a `uint16_t` (`monitor_binary.c:1492`), so counts ≥ 65536 wrap. Clamp client-side to 65535.
- **Capability**: There is no runtime `WarpMode` resource (`vsync.c:220-241`, deliberately). Warp control on the stock backend must be launch-time (`-warp` / `InitialWarpMode`).
- **Capability**: Drive memory reads with true drive emulation off return **silent zeros, not an error**. The real gate is `Drive8TrueEmulation` plus a non-zero `Drive8Type` (`drive/drive-resources.c:450`); `check_drive_emu_level_ok()` is a machine-capability check that always passes on `x64sc`.
- **Safety**: Three resources power-cycle the machine one call deep, destroying all emulation state — `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency` (all reach `machine_trigger_reset(POWER_CYCLE)` at `c64/c64.c:1367`). Any resource-set tool exposed to an LLM must deny these.
- **Compatibility**: Resource names are not version-stable — `TrapDevice8` was `VirtualDevice8` before 3.10, renamed with no alias.
- **Protocol**: `DISPLAY_GET` (0x84) is INDEXED8-only and needs api_version ≥ 2; RGB conversion and PNG encoding move client-side.
- **Protocol**: No monotonic cycle register. `LIN`/`CYC` are readable but not monotonic; absolute cycles must be reconstructed or read from the text monitor's `stopwatch`.
- **Dependency**: `CPUHISTORY_GET` (0x86) requires **VICE ≥ 3.10**. Debian trixie/forky/sid and all current Ubuntu ship 3.9, which lacks the opcode entirely. Homebrew and official builds are fine.
- **Capability**: SID `$D400–$D418` is write-only in hardware and the binary monitor has no SID command — read-back is unrecoverable on stock. VIC-II/CIA *internal* state (raster-IRQ latch, timer latches) is likewise unavailable; only the readable register map is.
- **Capability**: Matrix keyboard is not recoverable on stock. `KEYBOARD_FEED` (0x72) injects buffer text only.
- **Tech stack**: Node ≥ 22.18 (native TypeScript type-stripping — the shipped server has no build step). Host-bound `.mts` files must still be compiled by `build.ts` into committed `resources/*.mjs`, and `resources-sync.test.ts` fails CI on drift.
- **Architecture**: Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`. The project maintains a tested closed consumer set for host-path logic.
- **Architecture**: The broker's single-owner `inFlight` launch guard must stay a synchronous check-and-set with no `await` between. It exists because of the 2026-08-01 triple-launch outage and is regression-tested.
- **Testing**: `vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested — their correctness only means anything against a real emulator's timing. Preserve the documented invariants (exactly one resume per wait; poll on `hit_count`, never on paused state).
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Project Type
## Languages
- TypeScript (ES2022, NodeNext modules) - MCP server implementation, `.claude/mcp/vice/*.ts` and `*.mts`
- JavaScript (ESM, `.mjs`) - installer CLI (`installer/bin/cli.mjs`), skill scripts (`.claude/skills/*/scripts/*.mjs`), compiled host launcher resources (`.claude/mcp/vice/resources/*.mjs`)
- Bash - host launcher script (`.claude/mcp/vice/resources/vice-launcher.sh`), release/packaging scripts (`scripts/package.sh`, `scripts/ensure-mcp-deps.sh`)
- 6502/6510 assembly (ACME dialect) - skill scaffolds/templates, e.g. `.claude/skills/acme-build/template.a`
- Markdown - all skill documentation (`SKILL.md` files), project docs (`docs/`, `README.md`)
## Runtime
- Node.js. The MCP server (`@henols/vice-mcp`) requires **Node >= 22.18** (or >= 23.6) because it runs TypeScript directly via Node's native type-stripping (no build/transpile step at runtime). See `engines` in `.claude/mcp/vice/package.json:29`.
- The installer package (`@henols/c64-re-tools`) only requires **Node >= 18** (`installer/package.json:11`) since it is plain `.mjs`.
- `type: "module"` (ESM) throughout — both packages and all skill scripts.
- npm. Lockfiles present: `.claude/mcp/vice/package-lock.json` (committed). The `installer/` package has no committed lockfile.
- `node_modules/` for the MCP server is **never committed** (`.gitignore`); it is provisioned on first use by a `SessionStart` hook (`scripts/ensure-mcp-deps.sh`), which gates `npm ci` behind a sha256 hash of the lockfile so normal session starts are a no-op.
## Frameworks / Key Runtime Dependencies
- `@mastra/mcp` `1.15.0` - MCP server/tooling framework (`.claude/mcp/vice/package.json:64`)
- `@mastra/core` `1.55.0` - underlying Mastra runtime the MCP package depends on
- `@modelcontextprotocol/sdk` `1.30.0` (transitive, via `@mastra/mcp`) - the official MCP TypeScript SDK
- `MASTRA_TELEMETRY_DISABLED=1` is set everywhere the server is launched (`.mcp.json`, installer-generated `.mcp.json` entries) to disable Mastra's own telemetry.
- Node's built-in test runner (`node --test`), no separate test framework. Run via `npm test` in `.claude/mcp/vice` (`package.json:58`: `node --test '*.test.*'`).
- Test files are colocated `*.test.ts` / `*.test.mts` next to the module under test (e.g. `vice.ts` / no direct test file shown, but `vice-broker.mts` / `vice-broker.test.ts` pattern... see `.claude/mcp/vice/*.test.ts`).
- TypeScript `7.0.2` (devDependency, typecheck-only — `tsc --noEmit`); no emitted `.js` from the TS sources at runtime (Node type-stripping runs the `.ts`/`.mts` files directly).
- `.claude/mcp/vice/build.ts` - a custom build step that compiles the host-bound `.mts` launcher modules (`broker-control.mts`, `broker-epoch.mts`, `broker-kill.mts`, `broker-launch.mts`, `broker-state.mts`, `container-guard.mts`, `vice-broker.mts`) into plain `.mjs` files under `resources/`, since the **host** side (outside any container) cannot rely on Node's type-stripping the same way.
- `@types/node` `24.13.3` - Node type definitions for the TypeScript build.
- ACME cross-assembler (external, not an npm package) - required on `$PATH` for the `acme-build` skill; the skill probes `$ACME`, `/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme` (`.claude/skills/acme-build/SKILL.md:181-186`). Verified locally against ACME release 0.97 "Zem".
## Key Dependencies (transitive, via package-lock.json)
- `@a2a-js/sdk` `0.3.14`
- `@ai-sdk/provider` (multiple versions: `2.0.3`, `3.0.14`, `4.0.3`) and `@ai-sdk/provider-utils` (`3.0.30`, `4.0.40`, `5.0.11`) - AI SDK provider abstractions Mastra depends on
- `@hono/node-server` `2.1.0` - HTTP server (Hono framework) used internally by Mastra
- `@posthog/core` / `@posthog/types` - analytics client code inside Mastra (disabled via `MASTRA_TELEMETRY_DISABLED`)
- `@modelcontextprotocol/ext-apps` `1.7.5`
- `@isaacs/ttlcache`, `@lukeed/csprng`, `@lukeed/uuid`, `@sindresorhus/slugify` / `transliterate` - small utility libs
- `x64sc` - a **custom/patched build** of the VICE emulator that exposes a non-upstream `-mcpserver` flag (`-mcpserver -mcpserverhost <ip> -mcpserverport <port>`) serving HTTP JSON-RPC at `/mcp`. This is the load-bearing external dependency the whole `vice` MCP tool surface is built on. See `docs/roadmap-stock-vice.md` for a documented plan to migrate off this custom build onto stock VICE's binary monitor protocol (`-binarymonitor`).
## Configuration
- `.mcp.json` (repo root) - declares the `vice` MCP server, launched via `node ${CLAUDE_PLUGIN_ROOT}/.claude/mcp/vice/vice-proxy.ts`, `timeout: 150000`, `env.MASTRA_TELEMETRY_DISABLED=1`.
- `.claude-plugin/plugin.json` - plugin manifest: points at `./.claude/skills/` and `./.mcp.json`, registers a `SessionStart` hook running `scripts/ensure-mcp-deps.sh`, `defaultEnabled: false`.
- `.claude-plugin/marketplace.json` - single-plugin marketplace manifest so `/plugin marketplace add` works directly against this repo.
- `.claude/mcp/vice/tsconfig.json` - typecheck-only config: `target: es2022`, `module`/`moduleResolution: nodenext`, `strict: true`, `isolatedModules`, `verbatimModuleSyntax`, `noEmit: true`, `allowImportingTsExtensions: true`.
- `.claude/mcp/vice/tsconfig.build.json` - separate config used by `build.ts` to compile the host-bound `.mts` launchers into `resources/*.mjs`.
- `VICE_MCP_URL` - full host MCP endpoint override.
- `VICE_MCP_HOST` - host to reach the VICE MCP server on (container vs. host detection otherwise picks `host.docker.internal` or `127.0.0.1`).
- `VICE_MCP_TIMEOUT_MS` - per-RPC client timeout (default 30000).
- `VICE_SKIP_RESOURCE_INSTALL=1` - disable deploying host launcher scripts into `<project>/tools/`.
- `VICE_POOL_DIR` / `VICE_EPOCH_FILE` / `VICE_SUPERVISOR_DIR` - override the `.vice-supervisor/` state directory location.
- `VICE_BROKER_STALE_MS`, `VICE_BROKER_ACQUIRE_TIMEOUT_MS`, `VICE_BROKER_RECYCLE_TIMEOUT_MS`, `VICE_BROKER_CONTROL_DIAL_HOST`, `VICE_BROKER_CONTROL_HOST` - broker/control-plane tuning.
- `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` - Claude Code-provided plugin paths, consumed by `scripts/ensure-mcp-deps.sh` and `.mcp.json`.
- `CLAUDE_PROJECT_DIR`, `CONTAINER_WORKSPACE_PATH`, `HOST_WORKSPACE_PATH` - project-root resolution (`.claude/mcp/vice/repo-root.ts`) and host/container path translation.
- `MASTRA_TELEMETRY_DISABLED` - disables Mastra's telemetry.
- `.env` files: none detected in the repository.
- `scripts/package.sh` - builds the installable plugin release zip (used by CI).
- `scripts/check-npm-packages.mjs` - validates, via `npm pack --dry-run --json`, that both published tarballs (`@henols/vice-mcp`, `@henols/c64-re-tools`) contain exactly the right files (no `node_modules/`, no test files, no fixtures leaked; skills present).
## Platform Requirements
- Node.js >= 22.18 (or >= 23.6) to run/test the MCP server; Node >= 18 to run the installer.
- ACME cross-assembler on `$PATH` for the `acme-build` skill.
- A reachable host running VICE (`x64sc`, custom `-mcpserver` build) for any live emulator interaction — the MCP server itself has no in-process emulator.
- Docker/devcontainer awareness baked in: code checks `isInsideContainer()` (`.claude/mcp/vice/container-guard.mts`) to decide between `host.docker.internal` and `127.0.0.1` as the default VICE host.
- Published to the public npm registry as `@henols/vice-mcp` and `@henols/c64-re-tools`, installed via `npx` into consumer projects, or as a Claude Code plugin via `/plugin marketplace add`.
- CI: GitHub Actions (`.github/workflows/ci.yml`) — typecheck, test, smoke-test, package validation, artifact build, GitHub Release creation on `v*` tags, and npm publishing via OIDC Trusted Publishing (no `NPM_TOKEN` secret required for release; a manual `check-npm-token.yml` workflow exists purely as a diagnostic).
- Every merge to `main` auto-publishes a new patch version (unless the commit subject contains `[skip release]`).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Scope Note
## Naming Patterns
- Lowercase, hyphen-separated: `repo-root.ts`, `container-guard.mts`, `broker-launch.mts`,
- Test files are co-located, same basename plus `.test.ts` / `.test.mjs`:
- `.mts` is used specifically for modules that get compiled to a build artifact under
- Compiled/deployed output lives under `.claude/mcp/vice/resources/*.mjs` — generated by
- `camelCase`, verb-first, descriptive of the single thing they do: `repoRoot()`, `containerPath()`,
- Boolean-returning functions read as predicates: `isInside()`, `isLoopbackHostname()`,
- Internal/private helpers are declared `function` (not exported); public API is `export function`.
- `camelCase` for locals and mutable module state (`warnedEnvOutsideFrom`, `reqId`).
- `SCREAMING_SNAKE_CASE` for module-level constants, especially ones with an env-var or
- `HERE` is the idiomatic name for `dirname(fileURLToPath(import.meta.url))` — used consistently
- `PascalCase` for interfaces and classes: `RepoRootOptions`, `ContainerizeRecordResult`,
- Options objects follow the pattern `<FunctionName>Options` (`RepoRootOptions`,
- Result/return shapes follow `<FunctionName>Result` (`HostRootCandidatesResult`,
- Custom error subclasses end in `Error`: `ViceError`, `MachineRestartedError`,
## Code Style
- No `.eslintrc*`, `.prettierrc*`, `biome.json`, or equivalent config file exists anywhere in the
- 2-space indentation throughout (`.ts`, `.mts`, `.mjs`).
- Double quotes for strings (`"like this"`), not single quotes.
- Semicolons are used consistently (not an ASI-reliant style).
- Line width is generous (~100-120 cols is common, some lines exceed that inside dense comments)
- Template literals for interpolation, always: `` `${toolName} is permanently forbidden...` ``.
- `#!/usr/bin/env node` shebang on every standalone script (`.mjs`, and CLI-capable `.ts` files).
## Import Organization
- No path aliases (no `tsconfig` `paths` remapping). All imports are explicit relative paths.
- Every relative import to a local TS/MTS module includes its real extension
- One documented cross-extension constraint: same-module-to-sibling-module imports inside files
## Error Handling
- Base: `class ViceError extends Error` (`.claude/mcp/vice/vice.ts:250`) carries an optional
- Specialized subclasses extend `ViceError` and add domain fields as plain public properties
- Other one-off error classes are declared minimally, `class PathOutOfWorkspaceError extends
- Constructor pattern: `constructor(message: string, { ...fields }: XOptions = {}) { super(message);
- Functions that cannot produce a valid result throw `new Error("<message>")` with a message that
- Range/validation errors embed the offending value and the valid range directly in the message
- Some functions are documented as deliberately swallowing all errors — e.g.
- Pure/never-throwing transforms return a `{ result, changes, untranslated }`-shaped record
## Comments
- WHY the file exists (what problem/incident motivated it, often referencing a specific dated
- What it is the ONE authoritative place for (the "single seam" pattern — see below).
- What NOT to do, with the specific past mistake named (e.g. "Do not reintroduce a fixed `".."`").
## Function Design
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- **Container-in / host-out split**: the MCP proxy and skills run inside the
- **Single seam per concern**: one file owns each cross-cutting responsibility
- **Generated-but-committed artifacts**: `.mts` sources under
- **No build step for the shipped server**: `vice-proxy.ts` and its sibling
- **Documentation-as-code**: source files carry long structured header
- **Never-throw boundary**: the stdio server registers global handlers before
## Layers
- Purpose: Domain playbooks for C64 reverse-engineering tasks (build,
- Location: `.claude/skills/<skill-name>/`
- Contains: `SKILL.md` (playbook, YAML frontmatter + prose), `scripts/*.mjs`
- Depends on: the `vice` MCP tool surface (for skills that touch the
- Used by: Claude Code directly, matched by `SKILL.md` frontmatter
- Purpose: Presents a stable `vice_*` tool surface over stdio to Claude Code,
- Location: `.claude/mcp/vice/*.ts` (authored TypeScript, no build step)
- Contains: wire protocol (`vice-proxy.ts`), transport/deny-list
- Depends on: `@mastra/mcp` / `@mastra/core` for stdio JSON-RPC framing,
- Used by: Claude Code's MCP client, per `.mcp.json`.
- Purpose: On-demand pool of `x64sc` instances; owns launch, warm floor,
- Location authored: `.claude/mcp/vice/vice-broker.mts` +
- Location deployed (compiled): `.claude/mcp/vice/resources/*.mjs` (and
- Depends on: Node builtins only (`node:child_process`, `node:fs`,
- Used by: the container-side `vice-broker-client.ts`, over a TCP control
- Purpose: Non-plugin distribution path — `npx @henols/c64-re-tools` copies
- Location: `installer/bin/cli.mjs`, `installer/scripts/sync-skills.mjs`
- Depends on: the canonical skills under `.claude/skills/` (synced into
- Used by: end users installing outside the Claude Code plugin marketplace.
## Data Flow
### Primary tool-call path (emulator control)
### Recovery/incident path (recycle or crash)
### Skill-driven offline flow (e.g. `c64-provenance-diff`)
- Host-synchronised state lives under `.vice-supervisor/` at the resolved
- The MCP transport seam (`vice.ts`) holds mutable module-level state
## Key Abstractions
- Purpose: Single definition of "where is the project this MCP instance is
- Examples: `.claude/mcp/vice/repo-root.ts` (`repoRoot()`, `supervisorDir()`)
- Pattern: Ordered fallback ladder — `CLAUDE_PROJECT_DIR` env →
- Purpose: Hard-blocks specific tool names known to crash or bypass the
- Examples: `DENY_LIST` and `denyListRefusalMessage()` in
- Pattern: One array, checked at every dispatch seam — never re-derived
- Purpose: Translate a bind-mounted path between the container's view and
- Examples: `.claude/mcp/vice/hostpath.ts` (container → host, via
- Pattern: Both take the workspace root as an explicit argument rather than
- Purpose: On-demand pool of emulator instances, acquired/released/recycled
- Examples: `.claude/mcp/vice/vice-broker-client.ts`
- Pattern: The connection itself IS the lease — no separate TTL/heartbeat
- Purpose: Host-bound `.mjs` scripts that must run on a bare host Node with
- Examples: `.claude/mcp/vice/resources/*.mjs`, each prefixed with a
- Pattern: `build.ts` asserts the emitted file set exactly matches
## Entry Points
- Location: `.claude/mcp/vice/vice-proxy.ts` (declared as `bin.vice-mcp` and
- Triggers: Claude Code spawning the configured `vice` MCP server once per
- Responsibilities: JSON-RPC framing (delegated to `@mastra/mcp`
- Location: `.claude/mcp/vice/vice-broker.mts` (authored) /
- Triggers: First on-demand acquire request from the container side, or a
- Responsibilities: parse CLI args (`--repo-root`, `--state-dir`,
- Location: `installer/bin/cli.mjs` (`npx @henols/c64-re-tools [targetDir]`)
- Triggers: A user running the installer against their own project.
- Responsibilities: copy `installer/skills/` into `<target>/.claude/skills/`,
- `.claude/mcp/vice/build.ts` — `node build.ts`, recompiles `.mts` →
- `.claude/mcp/vice/refresh-manifest.ts` — regenerates `tools-manifest.json`
- `scripts/package.sh` — validates manifests and builds the plugin release
- `scripts/ensure-mcp-deps.sh` — SessionStart hook that runs `npm ci` for
## Architectural Constraints
- **Container/host boundary is load-bearing everywhere:** any file that
- **No build step for the shipped server:** `vice-proxy.ts` and its
- **Single-owner launch guard:** `broker-launch.mts` keeps one
- **Global state:** `vice.ts` holds mutable module-level transport state
- **Module-cycle avoidance is deliberate and documented:** `repo-root.ts` →
- **Threading:** single-threaded Node event loop throughout; the broker
## Anti-Patterns
### Re-deriving a cross-cutting seam locally
### Killing/relaunching preemptively to serve a newer request
## Error Handling
- The stdio server registers global uncaught-exception/rejection handlers
- Path/root resolution fallbacks emit a one-time stderr warning rather than
- `MachineRestartedError` (`vice.ts`) is a distinct error type for
- Incident records are written **before** any destructive action
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| acme-build | Assemble Commodore 64 6510 assembly with the ACME cross assembler. Use when asked to assemble, build, compile or link .a/.asm 6502/6510 source, produce a C64 .prg, scaffold a new C64 program, list the symbols a program uses, or turn a .prg back into ACME source. | `.claude/skills/acme-build/SKILL.md` |
| c64-memory-mapping | Look up what any C64 address means and turn raw 6502 disassembly into documented assembly, by resolving every address against the C64 memory map, KERNAL ROM routine list, canonical assembler symbols, and per-bit VIC-II/SID/CIA register tables. Use when asked to annotate or comment assembly, document a disassembly listing, or look up an address like $D020, $EA24 or $FFD2. | `.claude/skills/c64-memory-mapping/SKILL.md` |
| c64-program-recon | Work out how an unknown C64 program is structured at runtime — entry point, interrupt handlers, main loop, game states, graphics and sound — in a fixed order, before disassembling anything. Use when asked to reverse engineer a C64 game, find the main loop, entry point or IRQ handler, locate the player sprite, charset or music player, identify a game state machine, work out which memory regions are code versus data, or decide where to start on a depacked image. | `.claude/skills/c64-program-recon/SKILL.md` |
| c64-provenance-diff | Decide whether a byte in a cracked C64 release is original game code or something a cracker changed, by diffing two or more independently-cracked releases at an anchor-proven offset. Use when asked to diff two releases or disk images, work out which bytes the cracker patched, tell loader or cracktro code from game code, prove a byte is original, establish provenance or confidence for a memory range, regenerate the provenance ledger, or run anchor-search, count-patches or diff-images. Also use when asked whether a crack added a trainer or cheat, whether a patch changes gameplay rather than loading, whether a rebuild would inherit a cracker's gameplay alteration, or whether two releases are genuinely independent rather than sharing an ancestor. | `.claude/skills/c64-provenance-diff/SKILL.md` |
| c64-ram-capture | Capture a running C64's full 64K RAM as a verified flat image, and prove two captures are equivalent. Use when asked to dump RAM, depack a program by running it, capture a memory image at a checkpoint, or compare two captures for reproducibility. | `.claude/skills/c64-ram-capture/SKILL.md` |
| vice-wedge-triage | Decide whether a VICE emulator that has stopped responding is genuinely wedged, stopped itself at your own checkpoint, crashed and respawned, or merely paused — and what is safe to do about each. Use when asked why the emulator is stuck, frozen, hung, wedged, dead or not advancing, when a cycle bracket reads zero, when vice_ping says running but nothing happens, when a checkpoint never fires, when deciding whether to recycle or restart VICE, or when a run has to be voided and its evidence recorded. | `.claude/skills/vice-wedge-triage/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
