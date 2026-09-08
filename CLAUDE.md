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

- **Compatibility**: The stdio MCP surface is **trimmed per backend** — stock advertises only the tools it implements, so the two backends expose different tool lists (Phase 2, D-07). A tool advertised on both keeps the same name and a backward-compatible argument shape — stock may add optional parameters but never removes, retypes, or newly-requires one — and the fork's list is unchanged from v0.1.x. A skill written against the full fork surface therefore *breaks* on stock rather than degrading; the playbooks must name the stock route or the fork requirement (SKILL-01).
- **Architecture**: The transport swap happens behind `vice.ts`'s `call()` seam for *direct* tools. **Derived tools must be intercepted before `forwardToVice()`, not behind `call()`** — `rewriteArguments()` runs at `vice-proxy.ts:3056` inside `forwardToVice()` (which starts at `:2991`) and before `call()`, so a derived tool sitting behind `call()` receives host-translated paths and acts on them inside the container. Second site with the same cause: `gatherWedgeEvidence()` calls `rewriteArguments()` itself, at `vice-proxy.ts:1529` (the function starts at `:1505`). The `anno_*` family is registered through `buildViceTool()` and never reaches `forwardToVice()`, so neither call site is reachable from it — the constraint is satisfied by construction for that family, not by an interception (MCP-02). (Line numbers in this bullet are checked against the source at each phase and drift between phases; treat a mismatch as drift to re-verify, not as evidence the constraint itself changed. `docs-linerefs.test.ts` mechanically checks the two `rewriteArguments()` citations. All four moved by −2 in phase 29 plan 29-10, which removed the retired analyser's session-close import and the comment block above its call site: 3052→3050, 2987→2985, 1531→1529, 1507→1505. The two `forwardToVice()`-side citations moved again by +6 in phase 40 plan 40-01, which added `brokerHostPath()`'s `.c64-re-tools/` doc comment above line 1607 -- before both `gatherWedgeEvidence()` citations (unaffected) but before `forwardToVice()`'s: 3050→3056, 2985→2991.)
- **Protocol (settled, normative)**: 11-byte request header / 12-byte response header, all multi-byte values little-endian. Confirmed opcode set and error codes per `docs/phase0-binmon-findings.md` §5.
- **Protocol**: **Five** unsolicited message types arrive at request-id `0xffffffff`, not three: `STOPPED` (0x62), `RESUMED` (0x63), `JAM` (0x61), plus `CHECKPOINT_INFO` (0x11) on every checkpoint hit and `REGISTER_INFO` (0x31) on every monitor open. The last two **share a response type with a legitimate command reply**, so demux must key on request-id and never resolve a pending request with an event.
- **Protocol**: `JAM` (0x61) has a **zero-length body**. `monitor_binary.c:384-394` computes the PC then passes `length = 0`, so no PC is sent. Every client surveyed assumes 2 bytes and breaks on it.
- **Protocol**: A non-stopping checkpoint emits a `CHECKPOINT_INFO` frame per hit **synchronously, over the blocking socket, from inside the CPU loop** — `mon_breakpoint.c:557-562` calls `mon_breakpoint_event()` before checking `cp->stop`. On a hot address this can stall the emulator thread. Independent source-level confirmation of `vice-sync.ts`'s "poll on `hit_count`, never on paused state" invariant.
- **Concurrency**: Stock VICE's binary monitor services **exactly one client**. A second `connect()` sits unserviced in the backlog with no reply and no EOF — indistinguishable from a wedge. The broker must guarantee single-client-per-instance and must not diagnose this state as a hang.
- **Protocol**: `default_memspace` contamination has no direct remedy over the binary monitor. A drive checkpoint hit sets it (`monitor.c:3393-3396`) and no command resets it, after which `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the *drive* CPU and `@bank:` conditions fail outright. Affects any stepping code written after drive debugging is added. (`binary monitor only` — MEASURED 2026-08-27: `device c:` over the text channel (`-remotemonitor`) resets the default device, so the remedy exists on the second channel. Note `device c` without the colon is a syntax error; the accepted spelling carries it.)
- **Protocol**: The wire memspace byte is **not** the internal enum — `0x00` = main, `0x01`–`0x04` = units 8–11 (`monitor_binary.c:401-434`). `0x08` is rejected.
- **Protocol**: Checkpoint *conditions* use the pseudo-registers `RL` and `CY` (uppercase), **not** the register-list names `LIN`/`CYC` — those lex as `BANKNAME` and produce a syntax error. Conditions have **no operator precedence** (`mon_parse.y:168`), so `RL == $64 && CY == $14` parses as `(((RL==$64) && CY) == $14)` and is always false; parenthesise every comparison. Bare integer literals are **hex** by default (`monitor.c:1597`), so `RL == 100` means line 256.
- **Protocol**: `CPUHISTORY_GET`'s count field is read as uint32 but stored in a `uint16_t` (`monitor_binary.c:1492`), so counts ≥ 65536 wrap. Clamp client-side to 65535.
- **Capability**: There is no runtime `WarpMode` resource (`vsync.c:220-241`, deliberately). Warp control on the stock backend must be launch-time (`-warp` / `InitialWarpMode`). (`binary monitor only` — the claim is about the *resource*: `warp on` / `warp off` is a monitor *command* and works at runtime over the text channel, MEASURED 2026-08-27, and it reports its own state.)
- **Capability**: Drive memory reads with true drive emulation off return **silent zeros, not an error**. The real gate is `Drive8TrueEmulation` plus a non-zero `Drive8Type` (`drive/drive-resources.c:450`); `check_drive_emu_level_ok()` is a machine-capability check that always passes on `x64sc`.
- **Safety**: Three resources power-cycle the machine one call deep, destroying all emulation state — `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency` (all reach `machine_trigger_reset(POWER_CYCLE)` at `c64/c64.c:1367`). Any resource-set tool exposed to an LLM must deny these.
- **Compatibility**: Resource names are not version-stable — `TrapDevice8` was `VirtualDevice8` before 3.10, renamed with no alias.
- **Protocol**: `DISPLAY_GET` (0x84) is INDEXED8-only and needs api_version ≥ 2; RGB conversion and PNG encoding move client-side.
- **Protocol**: No monotonic cycle register. `LIN`/`CYC` are readable but not monotonic; absolute cycles must be reconstructed or read from the text monitor's `stopwatch`.
- **Dependency**: `CPUHISTORY_GET` (0x86) requires **VICE ≥ 3.10**. Debian trixie/forky/sid and all current Ubuntu ship 3.9, which lacks the opcode entirely. Homebrew and official builds are fine. (`binary monitor only` — the version floor is on the *opcode*, not the capability: `chis` returned CPU history with per-entry cycle counts over the text channel on genuine stock 3.9, MEASURED 2026-08-27. Polarity distinction `PARSE-04` depends on: text-command tracing/profiling support is opt-**out** at build time, the opposite of a version floor, and the affected commands do not share a single guard.)
- **Capability**: SID `$D400–$D418` is write-only in hardware and the binary monitor has no SID command — read-back is unrecoverable on stock. VIC-II/CIA *internal* state (raster-IRQ latch, timer latches) is likewise unavailable; only the readable register map is.
- **Capability**: Matrix keyboard is not recoverable on stock. `KEYBOARD_FEED` (0x72) injects buffer text only.
- **Tech stack**: Node ≥ 24 (native TypeScript type-stripping — the shipped server has no build step). Host-bound `.mts` files must still be compiled by `build.ts` into committed `resources/*.mjs`, and `resources-sync.test.ts` fails CI on drift.
- **Architecture**: Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`. The project maintains a tested closed consumer set for host-path logic.
- **Architecture**: The broker's single-owner `inFlight` launch guard must stay a synchronous check-and-set with no `await` between. It exists because of the 2026-08-01 triple-launch outage and is regression-tested.
- **Testing**: `vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested — their correctness only means anything against a real emulator's timing. Preserve the documented invariants (exactly one resume per wait; poll on `hit_count`, never on paused state).
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Project Type
## Languages
- TypeScript (ES2022, NodeNext modules) - MCP server implementation, `src/mcp/vice/*.ts` and `*.mts`
- JavaScript (ESM, `.mjs`) - installer CLI (`installer/bin/cli.mjs`), skill scripts (`src/skills/*/scripts/*.mjs`), compiled host launcher resources (`src/mcp/vice/resources/*.mjs`)
- Bash - host launcher script (`src/mcp/vice/resources/vice-launcher.sh`), release/packaging scripts (`scripts/package.sh`, `scripts/ensure-mcp-deps.sh`)
- 6502/6510 assembly (ACME dialect) - skill scaffolds/templates, e.g. `src/skills/acme-build/template.a`
- Markdown - all skill documentation (`SKILL.md` files), project docs (`docs/`, `README.md`)
## Runtime
- Node.js. The MCP server (`@henols/vice-mcp`) requires **Node >= 24** because it runs TypeScript directly via Node's native type-stripping (no build/transpile step at runtime). See `engines` in `src/mcp/vice/package.json:29`.
- The installer package (`@henols/c64-re-tools`) only requires **Node >= 18** (`installer/package.json:11`) since it is plain `.mjs`.
- `type: "module"` (ESM) throughout — both packages and all skill scripts.
- npm. Lockfiles present: `src/mcp/vice/package-lock.json` (committed). The `installer/` package has no committed lockfile.
- `node_modules/` for the MCP server is **never committed** (`.gitignore`); it is provisioned on first use by a `SessionStart` hook (`scripts/ensure-mcp-deps.sh`), which gates `npm ci` behind a sha256 hash of the lockfile so normal session starts are a no-op.
## Frameworks / Key Runtime Dependencies
- `@mastra/mcp` `1.15.0` - MCP server/tooling framework (`src/mcp/vice/package.json:64`)
- `@mastra/core` `1.55.0` - underlying Mastra runtime the MCP package depends on
- `@modelcontextprotocol/sdk` `1.30.0` (transitive, via `@mastra/mcp`) - the official MCP TypeScript SDK
- `MASTRA_TELEMETRY_DISABLED=1` is set everywhere the server is launched (`.mcp.json`, installer-generated `.mcp.json` entries) to disable Mastra's own telemetry.
- Node's built-in test runner (`node --test`), no separate test framework. Run via `npm test` in `src/mcp/vice` (`package.json:58`: `node --test '*.test.*'`).
- Test files are colocated `*.test.ts` / `*.test.mts` next to the module under test (e.g. `vice.ts` / no direct test file shown, but `vice-broker.mts` / `vice-broker.test.ts` pattern... see `src/mcp/vice/*.test.ts`).
- TypeScript `7.0.2` (devDependency, typecheck-only — `tsc --noEmit`); no emitted `.js` from the TS sources at runtime (Node type-stripping runs the `.ts`/`.mts` files directly).
- `src/mcp/vice/build.ts` - a custom build step that compiles the host-bound `.mts` launcher modules (`broker-control.mts`, `broker-epoch.mts`, `broker-kill.mts`, `broker-launch.mts`, `broker-state.mts`, `container-guard.mts`, `vice-broker.mts`) into plain `.mjs` files under `resources/`, since the **host** side (outside any container) cannot rely on Node's type-stripping the same way.
- `@types/node` `24.13.3` - Node type definitions for the TypeScript build.
- ACME cross-assembler (external, not an npm package) - required on `$PATH` for the `acme-build` skill; the skill probes `$ACME`, `/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme` (`src/skills/acme-build/SKILL.md:181-186`). Verified locally against ACME release 0.97 "Zem".
## Key Dependencies (transitive, via package-lock.json)
- `@a2a-js/sdk` `0.3.14`
- `@ai-sdk/provider` (multiple versions: `2.0.3`, `3.0.14`, `4.0.3`) and `@ai-sdk/provider-utils` (`3.0.30`, `4.0.40`, `5.0.11`) - AI SDK provider abstractions Mastra depends on
- `@hono/node-server` `2.1.0` - HTTP server (Hono framework) used internally by Mastra
- `@posthog/core` / `@posthog/types` - analytics client code inside Mastra (disabled via `MASTRA_TELEMETRY_DISABLED`)
- `@modelcontextprotocol/ext-apps` `1.7.5`
- `@isaacs/ttlcache`, `@lukeed/csprng`, `@lukeed/uuid`, `@sindresorhus/slugify` / `transliterate` - small utility libs
- `x64sc` - a **custom/patched build** of the VICE emulator that exposes a non-upstream `-mcpserver` flag (`-mcpserver -mcpserverhost <ip> -mcpserverport <port>`) serving HTTP JSON-RPC at `/mcp`. This is the load-bearing external dependency the whole `vice` MCP tool surface is built on. See `docs/roadmap-stock-vice.md` for a documented plan to migrate off this custom build onto stock VICE's binary monitor protocol (`-binarymonitor`).
## Configuration
- `.mcp.json` (repo root) - declares the `vice` MCP server, launched via `node ${CLAUDE_PLUGIN_ROOT}/src/mcp/vice/vice-proxy.ts`, `timeout: 150000`, `env.MASTRA_TELEMETRY_DISABLED=1`.
- `.claude-plugin/plugin.json` - plugin manifest: points at `./src/skills/` and `./.mcp.json`, registers a `SessionStart` hook running `scripts/ensure-mcp-deps.sh`, `defaultEnabled: false`.
- `.claude-plugin/marketplace.json` - single-plugin marketplace manifest so `/plugin marketplace add` works directly against this repo.
- `src/mcp/vice/tsconfig.json` - typecheck-only config: `target: es2022`, `module`/`moduleResolution: nodenext`, `strict: true`, `isolatedModules`, `verbatimModuleSyntax`, `noEmit: true`, `allowImportingTsExtensions: true`.
- `src/mcp/vice/tsconfig.build.json` - separate config used by `build.ts` to compile the host-bound `.mts` launchers into `resources/*.mjs`.
- `VICE_MCP_URL` - full host MCP endpoint override.
- `VICE_MCP_HOST` - host to reach the VICE MCP server on (container vs. host detection otherwise picks `host.docker.internal` or `127.0.0.1`).
- `VICE_MCP_TIMEOUT_MS` - per-RPC client timeout (default 30000).
- `VICE_SKIP_RESOURCE_INSTALL=1` - disable deploying host launcher scripts into `<project>/.c64-re-tools/bin/`.
- `.c64-re-tools/` (repo root, gitignored) - the single tool-written root every writer in this codebase derives its location from (`src/mcp/vice/repo-root.ts`'s `toolsDir()`, D-33, 2026-09-08 clean break): `supervisor/` (broker state), `snapshots/` (`.vsf` + `.json` sidecars), `bin/` (deployed host launcher artifacts), `runs/oracle/` (oracle.run scratch), `incidents/` (recycle incident records), `cache/` (the MCP dep lockfile stamp). `VICE_POOL_DIR` / `VICE_EPOCH_FILE` / `VICE_SUPERVISOR_DIR` / `VICE_INCIDENTS_DIR` still override their respective resolved default. Clean break: no dual-read of the previous locations (`.vice-supervisor/`, `.vice-snapshots/`, `tools/*.mjs`, `.planning/incidents/`), no migration shim, no opt-back-in env var — a pre-existing old-layout tree is simply ignored and left on disk for the user to delete by hand. One documented exception: `ghidra.analyze`'s per-run project directories stay at `<repoRoot>/tools/ghidra-runs/`, never under `.c64-re-tools/` — Ghidra's own dot-segment refusal rejects any ancestor path segment starting with `.` (`src/mcp/vice/ghidra-project.mts`'s `hasDotPrefixedSegment()`).
- `VICE_BROKER_STALE_MS`, `VICE_BROKER_ACQUIRE_TIMEOUT_MS`, `VICE_BROKER_RECYCLE_TIMEOUT_MS`, `VICE_BROKER_CONTROL_DIAL_HOST`, `VICE_BROKER_CONTROL_HOST` - broker/control-plane tuning.
- `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` - Claude Code-provided plugin paths, consumed by `scripts/ensure-mcp-deps.sh` and `.mcp.json`.
- `CLAUDE_PROJECT_DIR`, `CONTAINER_WORKSPACE_PATH`, `HOST_WORKSPACE_PATH` - project-root resolution (`src/mcp/vice/repo-root.ts`) and host/container path translation.
- `MASTRA_TELEMETRY_DISABLED` - disables Mastra's telemetry.
- `.env` files: none detected in the repository.
- `scripts/package.sh` - builds the installable plugin release zip (used by CI).
- `scripts/check-npm-packages.mjs` - validates, via `npm pack --dry-run --json`, that both published tarballs (`@henols/vice-mcp`, `@henols/c64-re-tools`) contain exactly the right files (no `node_modules/`, no test files, no fixtures leaked; skills present).
## Platform Requirements
- Node.js >= 24 to run/test the MCP server; Node >= 18 to run the installer.
- ACME cross-assembler on `$PATH` for the `acme-build` skill.
- A reachable host running VICE (`x64sc`, custom `-mcpserver` build) for any live emulator interaction — the MCP server itself has no in-process emulator.
- Docker/devcontainer awareness baked in: code checks `isInsideContainer()` (`src/mcp/vice/container-guard.mts`) to decide between `host.docker.internal` and `127.0.0.1` as the default VICE host.
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
- Compiled/deployed output lives under `src/mcp/vice/resources/*.mjs` — generated by
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
- Base: `class ViceError extends Error` (`src/mcp/vice/vice.ts:250`) carries an optional
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
| Stdio MCP entry point | Speaks MCP JSON-RPC to Claude Code over stdin/stdout; answers `initialize`/`tools/list` locally from the manifest, forwards `tools/call` | `src/mcp/vice/vice-proxy.ts` |
| Transport seam | The one place that speaks HTTP/MCP to the host VICE server; owns retry ladder, SSE parsing, deny-list enforcement, epoch/restart detection | `src/mcp/vice/vice.ts` |
| Liveness probe | Deliberately fragile, no-retry 1500ms liveness check (distinct from `vice.ts`'s resilient path) | `src/mcp/vice/vice-probe.ts` |
| Broker client | Container-side half of the on-demand broker protocol: acquire/release/recycle over a TCP control session | `src/mcp/vice/vice-broker-client.ts` |
| Repo root resolution | The one shared resolver for "where is the project root" / "where is `.vice-supervisor`" | `src/mcp/vice/repo-root.ts` |
| Resource deployment | Deploys host launcher scripts (`tools/`) into the *consuming* project on first use | `src/mcp/vice/install-resources.ts` |
| Container detection | Five-signal container-vs-host detector, checked at broker process startup | `src/mcp/vice/container-guard.mts` |
| Host/container path translation | Rewrites container paths (bind-mount) to host-reachable paths, and the inverse | `src/mcp/vice/hostpath.ts`, `src/mcp/vice/containerpath.ts` |
| Incident capture | Writes a pre-kill incident record (snapshot/screenshot metadata) before any recycle/kill | `src/mcp/vice/incident-record.ts` |
| Host broker daemon | Long-lived pool manager: port allocation, warm floor, crash supervision, TCP control listener | `src/mcp/vice/vice-broker.mts` (+ `broker-*.mts` siblings) |
| Build step | Compiles host-bound `.mts` sources into committed, banner-marked `.mjs` under `resources/` | `src/mcp/vice/build.ts` |
| Manifest refresh | Regenerates `tools-manifest.json` from the live host server's `tools/list` | `src/mcp/vice/refresh-manifest.ts` |
| Plugin manifest | Declares skills dir, mcpServers file, SessionStart hook | `.claude-plugin/plugin.json` |
| MCP server wiring | The `vice` server entry Claude Code launches | `.mcp.json` |
| npm installer | Non-plugin install path: copies skills + wires `.mcp.json` into any project | `installer/bin/cli.mjs` |
| Skills (six) | Markdown playbooks + Node scripts driving the MCP tools or working offline on files | `src/skills/*/SKILL.md`, `src/skills/*/scripts/*.mjs` |
## Pattern Overview
- **Container-in / host-out split**: the MCP proxy and skills run inside the
- **Single seam per concern**: one file owns each cross-cutting responsibility
- **Generated-but-committed artifacts**: `.mts` sources under
- **No build step for the shipped server**: `vice-proxy.ts` and its sibling
- **Documentation-as-code**: source files carry long structured header
- **Never-throw boundary**: the stdio server registers global handlers before
## Layers
- Purpose: Domain playbooks for C64 reverse-engineering tasks (build,
- Location: `src/skills/<skill-name>/`
- Contains: `SKILL.md` (playbook, YAML frontmatter + prose), `scripts/*.mjs`
- Depends on: the `vice` MCP tool surface (for skills that touch the
- Used by: Claude Code directly, matched by `SKILL.md` frontmatter
- Purpose: Presents a stable `vice_*` tool surface over stdio to Claude Code,
- Location: `src/mcp/vice/*.ts` (authored TypeScript, no build step)
- Contains: wire protocol (`vice-proxy.ts`), transport/deny-list
- Depends on: `@mastra/mcp` / `@mastra/core` for stdio JSON-RPC framing,
- Used by: Claude Code's MCP client, per `.mcp.json`.
- Purpose: On-demand pool of `x64sc` instances; owns launch, warm floor,
- Location authored: `src/mcp/vice/vice-broker.mts` +
- Location deployed (compiled): `src/mcp/vice/resources/*.mjs` (and
- Depends on: Node builtins only (`node:child_process`, `node:fs`,
- Used by: the container-side `vice-broker-client.ts`, over a TCP control
- Purpose: Non-plugin distribution path — `npx @henols/c64-re-tools` copies
- Location: `installer/bin/cli.mjs`, `installer/scripts/sync-skills.mjs`
- Depends on: the canonical skills under `src/skills/` (synced into
- Used by: end users installing outside the Claude Code plugin marketplace.
## Data Flow
### Primary tool-call path (emulator control)
### Recovery/incident path (recycle or crash)
### Skill-driven offline flow (e.g. `c64-provenance-diff`)
- Host-synchronised state lives under `.vice-supervisor/` at the resolved
- The MCP transport seam (`vice.ts`) holds mutable module-level state
## Key Abstractions
- Purpose: Single definition of "where is the project this MCP instance is
- Examples: `src/mcp/vice/repo-root.ts` (`repoRoot()`, `supervisorDir()`)
- Pattern: Ordered fallback ladder — `CLAUDE_PROJECT_DIR` env →
- Purpose: Hard-blocks specific tool names known to crash or bypass the
- Examples: `DENY_LIST` and `denyListRefusalMessage()` in
- Pattern: One array, checked at every dispatch seam — never re-derived
- Purpose: Translate a bind-mounted path between the container's view and
- Examples: `src/mcp/vice/hostpath.ts` (container → host, via
- Pattern: Both take the workspace root as an explicit argument rather than
- Purpose: On-demand pool of emulator instances, acquired/released/recycled
- Examples: `src/mcp/vice/vice-broker-client.ts`
- Pattern: The connection itself IS the lease — no separate TTL/heartbeat
- Purpose: Host-bound `.mjs` scripts that must run on a bare host Node with
- Examples: `src/mcp/vice/resources/*.mjs`, each prefixed with a
- Pattern: `build.ts` asserts the emitted file set exactly matches
## Entry Points
- Location: `src/mcp/vice/vice-proxy.ts` (declared as `bin.vice-mcp` and
- Triggers: Claude Code spawning the configured `vice` MCP server once per
- Responsibilities: JSON-RPC framing (delegated to `@mastra/mcp`
- Location: `src/mcp/vice/vice-broker.mts` (authored) /
- Triggers: First on-demand acquire request from the container side, or a
- Responsibilities: parse CLI args (`--repo-root`, `--state-dir`,
- Location: `installer/bin/cli.mjs` (`npx @henols/c64-re-tools [targetDir]`)
- Triggers: A user running the installer against their own project.
- Responsibilities: copy `installer/skills/` into `<target>/.claude/skills/`,
- `src/mcp/vice/build.ts` — `node build.ts`, recompiles `.mts` →
- `src/mcp/vice/refresh-manifest.ts` — regenerates `tools-manifest.json`
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
| acme-build | Assemble Commodore 64 6510 assembly with the ACME cross assembler. Use when asked to assemble, build, compile or link .a/.asm 6502/6510 source, produce a C64 .prg, scaffold a new C64 program, or list which symbols an assembled build actually used from its symbol file. | `src/skills/acme-build/SKILL.md` |
| c64-memory-mapping | Look up what any C64 address means and turn raw 6502 disassembly into documented assembly, by resolving every address against the C64 memory map, KERNAL ROM routine list, canonical assembler symbols, and per-bit VIC-II/SID/CIA register tables. Use when asked to annotate or comment assembly against the published memory map, document a disassembly listing by resolving every address it touches, or look up an address like $D020, $EA24 or $FFD2. | `src/skills/c64-memory-mapping/SKILL.md` |
| c64-program-recon | Work out how an unknown C64 program is structured at runtime — entry point, interrupt handlers, main loop, game states, graphics and sound — in a fixed order, before disassembling anything. Use when asked to reverse engineer a C64 game, find the main loop, entry point or IRQ handler, locate the player sprite, charset or music player, identify a game state machine, work out which memory regions are code versus data, or decide where to start on a depacked image. | `src/skills/c64-program-recon/SKILL.md` |
| c64-provenance-diff | Decide whether a byte in a cracked C64 release is original game code or something a cracker changed, by diffing two or more independently-cracked releases at an anchor-proven offset. Use when asked to diff two releases or disk images, work out which bytes the cracker patched, tell loader or cracktro code from game code, prove a byte is original, establish provenance or confidence for a memory range, regenerate the provenance ledger, or run anchor-search, count-patches or diff-images. Also use when asked whether a crack added a trainer or cheat, whether a patch changes gameplay rather than loading, whether a rebuild would inherit a cracker's gameplay alteration, or whether two releases are genuinely independent rather than sharing an ancestor. | `src/skills/c64-provenance-diff/SKILL.md` |
| c64-ram-capture | Capture a running C64's full 64K RAM as a verified flat image, and prove two captures are equivalent. Use when asked to dump RAM, depack a program by running it, capture a memory image at a checkpoint, or compare two captures for reproducibility. | `src/skills/c64-ram-capture/SKILL.md` |
| routine-queue-walker | Drive an existing C64 annotation store's backlog of undocumented routines and auto-named symbols to closure — build the candidate queue from labels and comments, work it one entry at a time against explicit addresses, rebuild it after every pass, and report every leftover. Use when asked to annotate every remaining routine in a project, document all undocumented subroutines left in an annotation project, rename the leftover auto-generated labels, clear a backlog of unnamed symbols, drive an annotation pass to completion, or list what is still unannotated after a pass. | `src/skills/routine-queue-walker/SKILL.md` |
| vice-wedge-triage | Decide whether a VICE emulator that has stopped responding is genuinely wedged, stopped itself at your own checkpoint, crashed and respawned, or merely paused — and what is safe to do about each. Use when asked why the emulator is stuck, frozen, hung, wedged, dead or not advancing, when a cycle bracket reads zero, when vice_ping says running but nothing happens, when a checkpoint never fires, when deciding whether to recycle or restart VICE, or when a run has to be voided and its evidence recorded. | `src/skills/vice-wedge-triage/SKILL.md` |
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

## GSD Execution Isolation (project policy — NOT installer-managed)

`workflow.use_worktrees` is **true** (stock). Run phases with worktree isolation ON. Do not
disable it project-wide, do not add standing instructions that route around GSD's dispatch,
cleanup, or synthesis machinery, and do not treat a single bad worktree run as evidence that
isolation is unusable. Nested `claude -p` sessions are **not** prohibited — the ban's stated
cause was tested and refuted on 2026-08-29.

Three constraints are real and are **stock GSD behaviour, not local policy** — honour them
rather than disabling isolation to avoid them:

1. A plan delivering `.planning/STATE.md` or `ROADMAP.md` content gets the stock per-plan
   carve-out `USE_WORKTREES_FOR_PLAN=false` (worktree executors may not touch those files —
   `execute-phase.md`; the commit strips them — `execute-plan.md`). `REQUIREMENTS.md`
   is unaffected.
2. `cleanup-wave` refuses any branch whose diff contains a deletion, unconditionally
   (`worktree-safety.cjs`'s cleanup-wave deletion check). Merge a deletion plan's branch by hand.
3. The per-plan worktree gate owns the isolation sentinel; do not hand-force
   `--force-isolation` as a standing ritual.

GSD itself is a **vendored, gitignored install** — `/gsd-update` may be run freely and the
repo never changes as a result. Nothing here may branch on whether it is installed (CI and
fresh clones have none). It carries **zero local customisations** and must keep carrying zero — never edit a file
under the vendored tree. `.claude/gsd-local-patches/` should always be empty; if it
appears, something edited the install.

Full rationale and history: `.planning/ENGINEERING_RULES.md` § 20 and § 20.1.



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
