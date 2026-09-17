<!-- GSD:project-start source:PROJECT.md -->
## Project

**c64-re-tools**

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects. It ships a `vice` MCP server
(76 tools driving a host VICE emulator through an on-demand broker: 47 from the
`vice_*` manifest plus 29 registered directly) plus nine C64
reverse-engineering skills, distributed both as two npm packages
(`@henols/vice-mcp`, `@henols/c64-re-tools`) and as a Claude Code plugin.

The whole tool surface drives **stock upstream VICE** — any unpatched build
anyone can install from a package manager — through its binary monitor and
text channel. There is no non-upstream emulator build to install, and no
backend to select: this is the only transport the plugin drives. Three
hardware-level capabilities have no route on stock at all and are recorded
as permanent, accepted losses rather than a gap awaiting a workaround — see
`docs/stock-hard-losses.md`.

**Core Value:** A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

### Constraints

- **Compatibility**: The stdio MCP surface advertises only the tools this project actually implements against stock VICE — there is no second backend and no per-backend trim to reconcile. A skill written against a tool the server does not advertise therefore *breaks* rather than degrading; playbooks must name a real route or state that the capability is a permanent limitation (see `docs/stock-hard-losses.md`).
- **Protocol (settled, normative)**: 11-byte request header / 12-byte response header, all multi-byte values little-endian. Confirmed opcode set and error codes per `.planning/phases/01-corrected-ground-truth/evidence/phase0-binmon-findings.md` §5.
- **Protocol**: **Five** unsolicited message types arrive at request-id `0xffffffff`, not three: `STOPPED` (0x62), `RESUMED` (0x63), `JAM` (0x61), plus `CHECKPOINT_INFO` (0x11) on every checkpoint hit and `REGISTER_INFO` (0x31) on every monitor open. The last two **share a response type with a legitimate command reply**, so demux must key on request-id and never resolve a pending request with an event.
- **Protocol**: `JAM` (0x61) has a **zero-length body**. `monitor_binary.c:384-394` computes the PC then passes `length = 0`, so no PC is sent. Every client surveyed assumes 2 bytes and breaks on it.
- **Protocol**: A non-stopping checkpoint emits a `CHECKPOINT_INFO` frame per hit **synchronously, over the blocking socket, from inside the CPU loop** — `mon_breakpoint.c:557-562` calls `mon_breakpoint_event()` before checking `cp->stop`. On a hot address this can stall the emulator thread. This is the source-level reason checkpoint-wait code must always resolve state from a response field like `hit_count`, never by assuming a paused state from elapsed time alone.
- **Concurrency**: Stock VICE's binary monitor services **exactly one client**. A second `connect()` sits unserviced in the backlog with no reply and no EOF — indistinguishable from a wedge. The broker must guarantee single-client-per-instance and must not diagnose this state as a hang.
- **Protocol**: `default_memspace` contamination has no direct remedy over the binary monitor. A drive checkpoint hit sets it (`monitor.c:3393-3396`) and no command resets it, after which `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the *drive* CPU and `@bank:` conditions fail outright. Affects any stepping code written after drive debugging is added. (`binary monitor only` — MEASURED 2026-08-27: `device c:` over the text channel (`-remotemonitor`) resets the default device, so the remedy exists on the second channel. Note `device c` without the colon is a syntax error; the accepted spelling carries it. Re-confirmed live, and the contamination itself — not merely the remedy's availability — was exercised: a real drive checkpoint armed over the whole 1541 ROM range froze main-CPU `ADVANCE_INSTRUCTIONS` stepping at a fixed PC, and `device c:` restored forward-stepping — MEASURED 2026-09-09, genuine stock `/usr/bin/x64sc` VICE 3.9, `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/evidence/phase41-text-channel-live-evidence.md`.)
- **Protocol**: The wire memspace byte is **not** the internal enum — `0x00` = main, `0x01`–`0x04` = units 8–11 (`monitor_binary.c:401-434`). `0x08` is rejected.
- **Protocol**: Checkpoint *conditions* use the pseudo-registers `RL` and `CY` (uppercase), **not** the register-list names `LIN`/`CYC` — those lex as `BANKNAME` and produce a syntax error. Conditions have **no operator precedence** (`mon_parse.y:168`), so `RL == $64 && CY == $14` parses as `(((RL==$64) && CY) == $14)` and is always false; parenthesise every comparison. Bare integer literals are **hex** by default (`monitor.c:1597`), so `RL == 100` means line 256.
- **Protocol**: `CPUHISTORY_GET`'s count field is read as uint32 but stored in a `uint16_t` (`monitor_binary.c:1492`), so counts ≥ 65536 wrap. Clamp client-side to 65535.
- **Capability**: There is no runtime `WarpMode` resource (`vsync.c:220-241`, deliberately). Warp control on the stock backend must be launch-time (`-warp` / `InitialWarpMode`). (`binary monitor only` — the claim is about the *resource*: `warp on` / `warp off` is a monitor *command* and works at runtime over the text channel, MEASURED 2026-08-27, and it reports its own state. Both directions were re-probed live through the shipped `vice_warp_set` tool with the channel open — MEASURED 2026-09-09, genuine stock `/usr/bin/x64sc` VICE 3.9: both round trips succeeded, though on this build the response itself carried no textual "on"/"off" confirmation beyond the framed prompt, a nuance this run recorded rather than assumed — `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/evidence/phase41-text-channel-live-evidence.md`.)
- **Capability**: Drive memory reads with true drive emulation off return **silent zeros, not an error**. The real gate is `Drive8TrueEmulation` plus a non-zero `Drive8Type` (`drive/drive-resources.c:450`); `check_drive_emu_level_ok()` is a machine-capability check that always passes on `x64sc`.
- **Safety**: Three resources power-cycle the machine one call deep, destroying all emulation state — `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency` (all reach `machine_trigger_reset(POWER_CYCLE)` at `c64/c64.c:1367`). Any resource-set tool exposed to an LLM must deny these.
- **Compatibility**: Resource names are not version-stable — `TrapDevice8` was `VirtualDevice8` before 3.10, renamed with no alias.
- **Protocol**: `DISPLAY_GET` (0x84) is INDEXED8-only and needs api_version ≥ 2; RGB conversion and PNG encoding move client-side.
- **Protocol**: No monotonic cycle register. `LIN`/`CYC` are readable but not monotonic; absolute cycles must be reconstructed or read from the text monitor's `stopwatch`.
- **Dependency**: `CPUHISTORY_GET` (0x86) requires **VICE ≥ 3.10**. Debian trixie/forky/sid and all current Ubuntu ship 3.9, which lacks the opcode entirely. Homebrew and official builds are fine. (`binary monitor only` — the version floor is on the *opcode*, not the capability: `chis` returned CPU history with per-entry cycle counts over the text channel on genuine stock 3.9, MEASURED 2026-08-27. Note the polarity: text-command tracing/profiling support is opt-**out** at build time, the opposite of a version floor. The affected commands do not each carry their own separate guard — two share one guard and one stub string (`memmapshow`/`chis`), two carry none (`bt`/`prof flat`), and one degrades per-chip at runtime instead of refusing (`io`); per-command probing is unaffected — `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/evidence/phase42-text-format-drift-citations.md`. Independently re-confirmed by a separate fixture batch (`FIXTURE_UNSUPPORTED: none`, `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/phase39-dual-channel-coexistence-gate-findings.md` §7) — `chis` succeeded on genuine stock VICE 3.9 over the text channel via a completely different code path than the binary-monitor opcode's version floor; both citations are collected together in `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/evidence/phase41-text-channel-live-evidence.md`.)
- **Capability**: SID `$D400–$D418` is write-only in hardware and the binary monitor has no SID command — read-back is unrecoverable on stock. VIC-II/CIA *internal* state (raster-IRQ latch, timer latches) is likewise unavailable; only the readable register map is.
- **Capability**: Matrix keyboard is not recoverable on stock. `KEYBOARD_FEED` (0x72) injects buffer text only.
- **Tech stack**: Node ≥ 24 (native TypeScript type-stripping — the shipped server has no build step). Host-bound `.mts` files must still be compiled by `build.ts` into committed `resources/*.mjs`, and `resources-sync.test.ts` fails CI on drift.
- **Architecture**: Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`. The project maintains a tested closed consumer set for host-path logic.
- **Architecture**: The broker's single-owner `inFlight` launch guard must stay a synchronous check-and-set with no `await` between. It exists because of the 2026-08-01 triple-launch outage and is regression-tested.
- **Architecture**: Every shipped module that spawns the emulator binary must do it in the safe form — an argv **array**, never a shell command string and never a string-interpolated binary path — and the set of modules that spawn it at all is frozen rather than assumed. That set currently has exactly **one** member, `src/mcp/vice/broker-launch.mts`, which spawns in argv-array form (`spawn(viceBin, viceArgs)`, never `shell: true`, never a string-interpolated binary path). Its predecessor, a `--help` probe used to tell which VICE backend was installed, was removed when backend detection collapsed to a single stock target. Any NEW module that spawns the emulator binary must use the same argv-array form.
- **Testing**: The single-resume-per-wait checkpoint invariant (never send a second resume while one wait is outstanding) is unit-tested against a synthetic client in `stock-run-until.ts`, an event-driven port of a rule the project's original polling-based checkpoint-wait code carried untested (that code's correctness only meant anything against a real emulator's timing; the event-driven port removed that dependency). Preserve the invariant if this file changes.
- **Dependency**: External tools are **never auto-installed** — the user installs them and the project only *detects* what is already present (owner's standing constraint, stated 2026-09-08, not up for re-litigation). The permitted pattern, stated positively, is **detect, then refuse by name with the remedy in the message**: `x64sc` is probed by `resolvedBackend()` in `backend-detect.mts` while `README.md` carries the per-distro `apt` / `brew` / `pacman` line for the *user* to run; `c1541` and `petcat` are resolved by `findSiblingBinary()` in `host-tool.mts` as siblings of the already-resolved `x64sc`, memoised per process, with a `$PATH` fallback that logs a warning naming the shadowing hazard; ACME is probed on `$PATH` plus four documented prefixes (`findAcmeLib()` in `src/mcp/vice/host-tool.mts`); Ghidra is declared by version only, non-vendored, at a user-chosen path (search for `analyzeHeadless`, never guess a prefix); and dxa ships as committed source under `src/mcp/vice/vendor/dxa/`, where `findDxaBinary()` in `host-tool.mts` makes `dxa.disassemble` refuse **by name** with `bash vendor/dxa/build.bash build` as the remedy rather than building it — the `curl` inside `build.bash` is user-invoked only and exists to verify the committed tree against the pinned `src/mcp/vice/vendor/dxa/dxa-0.1.5.tar.gz.sha256`, so nothing triggers it automatically. Therefore: never shell out to a package manager, never fetch-and-build on demand, and never `npx -y` a *third-party* package to make a missing tool appear (the project's own documented `npx -y @henols/vice-mcp anno <verb>` route is an invocation, not an install, and is unaffected). Three things are deliberately **out of scope** and must not be "fixed" by a reader of this bullet: `scripts/ensure-mcp-deps.sh` provisioning the MCP server's *own* `node_modules` via `npm ci` on `SessionStart`, gated on a lockfile sha256 (that is this package's dependencies, not an external tool); CI's `retry_apt install -y acme` in `.github/workflows/ci.yml` (a throwaway runner, never a user machine); and `installer/bin/cli.mjs`'s `npm install -D @henols/vice-mcp`, which runs only behind the explicit `--vendor` opt-in.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Project Type
## Languages
- TypeScript (ES2022, NodeNext modules) - MCP server implementation, `src/mcp/vice/*.ts` and `*.mts`
- JavaScript (ESM, `.mjs`) - installer CLI (`installer/bin/cli.mjs`), skill scripts (`src/skills/*/scripts/*.mjs`), compiled host launcher resources (`src/mcp/vice/resources/*.mjs`)
- Bash - host launcher script (`src/mcp/vice/resources/vice-launcher.sh`), SessionStart dependency provisioning (`scripts/ensure-mcp-deps.sh`)
- 6502/6510 assembly (ACME dialect) - skill scaffolds/templates, e.g. `src/skills/acme-build/template.a`
- Markdown - all skill documentation (`SKILL.md` files), project docs (`docs/`, `README.md`)
## Runtime
- Node.js. The MCP server (`@henols/vice-mcp`) requires **Node >= 24** because it runs TypeScript directly via Node's native type-stripping (no build/transpile step at runtime). See `engines.node` in `src/mcp/vice/package.json`.
- The installer package (`@henols/c64-re-tools`) only requires **Node >= 18** (`engines.node` in `installer/package.json`) since it is plain `.mjs`.
- `type: "module"` (ESM) throughout — both packages and all skill scripts.
- npm. Lockfiles present: `src/mcp/vice/package-lock.json` (committed). The `installer/` package has no committed lockfile.
- `node_modules/` for the MCP server is **never committed** (`.gitignore`); it is provisioned on first use by a `SessionStart` hook (`scripts/ensure-mcp-deps.sh`), which gates `npm ci` behind a sha256 hash of the lockfile so normal session starts are a no-op.
## Frameworks / Key Runtime Dependencies
- `@mastra/mcp` `1.15.0` - MCP server/tooling framework (`dependencies` in `src/mcp/vice/package.json`)
- `@mastra/core` `1.55.0` - underlying Mastra runtime the MCP package depends on
- `@modelcontextprotocol/sdk` `1.30.0` (transitive, via `@mastra/mcp`) - the official MCP TypeScript SDK
- `MASTRA_TELEMETRY_DISABLED=1` is set everywhere the server is launched (`.mcp.json`, installer-generated `.mcp.json` entries) to disable Mastra's own telemetry.
- Node's built-in test runner (`node --test`), no separate test framework. Run via `npm test` in `src/mcp/vice` (the `test` script in `src/mcp/vice/package.json`: `node --test '*.test.*'`).
- Test files are colocated `*.test.ts` / `*.test.mts` next to the module under test (e.g. `stock-dispatch.ts` / `stock-dispatch.test.ts`).
- TypeScript `7.0.2` (devDependency, typecheck-only — `tsc --noEmit`); no emitted `.js` from the TS sources at runtime (Node type-stripping runs the `.ts`/`.mts` files directly).
- `src/mcp/vice/build.ts` - a custom build step that compiles the host-bound `.mts` launcher modules (`vice-broker.mts`, `container-guard.mts`, `broker-state.mts`, `broker-launch.mts`, `broker-kill.mts`, `broker-epoch.mts`, `broker-control.mts`, `backend-detect.mts`, `host-tool.mts`, `ghidra-project.mts`) into plain `.mjs` files under `resources/`, since the **host** side (outside any container) cannot rely on Node's type-stripping the same way.
- `@types/node` `24.13.3` - Node type definitions for the TypeScript build.
- ACME cross-assembler (external, not an npm package) - required on `$PATH` for the `acme-build` skill; the skill probes `$ACME`, `/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme` (`findAcmeLib()` in `src/mcp/vice/host-tool.mts`). Verified locally against ACME release 0.97 "Zem".
## Key Dependencies (transitive, via package-lock.json)
- `@a2a-js/sdk` `0.3.14`
- `@ai-sdk/provider` (multiple versions: `2.0.3`, `3.0.14`, `4.0.3`) and `@ai-sdk/provider-utils` (`3.0.30`, `4.0.40`, `5.0.11`) - AI SDK provider abstractions Mastra depends on
- `@hono/node-server` `2.1.0` - HTTP server (Hono framework) used internally by Mastra
- `@posthog/core` / `@posthog/types` - analytics client code inside Mastra (disabled via `MASTRA_TELEMETRY_DISABLED`)
- `@modelcontextprotocol/ext-apps` `1.7.5`
- `@isaacs/ttlcache`, `@lukeed/csprng`, `@lukeed/uuid`, `@sindresorhus/slugify` / `transliterate` - small utility libs
- `x64sc` - stock upstream VICE, any unpatched build installable from a package manager, driven over its binary monitor and text channel — the load-bearing external dependency the whole `vice` MCP tool surface is built on. There is no non-upstream build and no backend to select. Three hardware-level capabilities have no route on stock at all and are recorded as permanent, accepted losses in `docs/stock-hard-losses.md`.
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
- `.c64-re-tools/` (repo root, gitignored) - the single tool-written root every writer in this codebase derives its location from (`src/mcp/vice/repo-root.ts`'s `toolsDir()`, D-33, 2026-09-08 clean break): `supervisor/` (broker state), `snapshots/` (`.vsf` + `.json` sidecars), `bin/` (deployed host launcher artifacts), `runs/oracle/` (oracle.run scratch), `runs/ghidra/` (`ghidra.analyze` per-run project data), `incidents/` (recycle incident records), `cache/` (the MCP dep lockfile stamp). `VICE_POOL_DIR` / `VICE_EPOCH_FILE` / `VICE_SUPERVISOR_DIR` / `VICE_INCIDENTS_DIR` still override their respective resolved default. Clean break: no dual-read of the previous locations (`.vice-supervisor/`, `.vice-snapshots/`, `tools/*.mjs`, `.planning/incidents/`), no migration shim, no opt-back-in env var — a pre-existing old-layout tree is simply ignored and left on disk for the user to delete by hand. **There is no remaining exception** (corrected 2026-09-08, gap `G-40-1`): `ghidra.analyze`'s per-run project data lands physically under `.c64-re-tools/runs/ghidra/` like everything else, reached through a non-dotted ALIAS at `<repoRoot>/c64-re-tools` — a symlink whose target is the RELATIVE string `.c64-re-tools`, minted host-side by the broker at startup (`vice-broker.mts`) and re-asserted as an idempotent precondition by `ghidra-project.mts`'s `ensureGhidraRunsHandle()` on every resolve, refused BY NAME (never repaired) when something unexpected already sits at the handle path. The alias exists because Ghidra's own project-location refusal binds the ABSOLUTIZED path argument it is handed — `ProjectLocator` calls `java.io.File.getAbsolutePath()`, never `getCanonicalPath()` (MEASURED from the class's own bytecode, `.planning/notes/ghidra-dot-path-check-semantics.md`) — so it absolutizes a relative argument but does **not** resolve a symlink, and a broker-minted symlink handle satisfies three conditions simultaneously: no dotted or bare-`.` segment anywhere in the absolutized path Ghidra receives; the handle sits inside the bind-mounted workspace, since `containerPath()` throws on a host path outside it; and the link's target is RELATIVE, since the container itself must traverse the same link to read the run log. This is fragile by design — the whole arrangement depends on Ghidra never switching to `getCanonicalPath()` — and is guarded by a live, opt-in test against real Ghidra (`src/mcp/vice/ghidra-live.test.ts`'s SYMLINK GUARD cases, phase 40 plan 40-09). The previous record here called the split location "a hard external-tool constraint, not a preference" — an overstatement produced by running this project's own `hasDotPrefixedSegment()` check against a synthetic string, which observes this project and never observed Ghidra; MEASURED 2026-09-08 against real Ghidra 12.1.3 that the refusal binds the path string, not where the bytes physically live.
- `VICE_BROKER_STALE_MS`, `VICE_BROKER_ACQUIRE_TIMEOUT_MS`, `VICE_BROKER_RECYCLE_TIMEOUT_MS`, `VICE_BROKER_CONTROL_DIAL_HOST`, `VICE_BROKER_CONTROL_HOST` - broker/control-plane tuning. `VICE_BROKER_NODE` - an absolute-path override pinning which `node` interpreter `vice-launcher.sh` execs into (for a service environment whose PATH carries no usable one); the launcher refuses by name, before exec, when the resolved interpreter (override or PATH) is below the floor mirrored from `engines.node`.
- `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` - Claude Code-provided plugin paths, consumed by `scripts/ensure-mcp-deps.sh` and `.mcp.json`.
- `CLAUDE_PROJECT_DIR`, `CONTAINER_WORKSPACE_PATH`, `HOST_WORKSPACE_PATH` - project-root resolution (`src/mcp/vice/repo-root.ts`) and host/container path translation.
- `MASTRA_TELEMETRY_DISABLED` - disables Mastra's telemetry.
- `.env` files: none detected in the repository.
## Platform Requirements
- Node.js >= 24 to run/test the MCP server; Node >= 18 to run the installer.
- ACME cross-assembler on `$PATH` for the `acme-build` skill.
- A reachable host running stock upstream VICE (`x64sc`) for any live emulator interaction — the MCP server itself has no in-process emulator.
- Docker/devcontainer awareness baked in: code checks `isInsideContainer()` (`src/mcp/vice/container-guard.mts`) to decide between `host.docker.internal` and `127.0.0.1` as the default VICE host.
- Published to the public npm registry as `@henols/vice-mcp` and `@henols/c64-re-tools`, installed via `npx` into consumer projects, or as a Claude Code plugin via `/plugin marketplace add`.
- CI: GitHub Actions (`.github/workflows/ci.yml`) — two jobs only. `build` runs typecheck plus the MCP-server, installer and skill suites. `publish-npm` triggers on a `v*` tag (or a manual dispatch with an explicit version), derives the version from the ref, and publishes both packages via OIDC Trusted Publishing (no `NPM_TOKEN` secret).
- Merging to `main` publishes nothing. A release is a git tag: `git tag v1.2.3 && git push origin v1.2.3`. The plugin is installed from the repository, so no release zip is built or attached.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Full detail: `.planning/codebase/CONVENTIONS.md`. The rules below change what you write.

- **Files.** A file name is lowercase words joined by hyphens. Domain prefixes carry meaning and you must continue them. `stock-*` is the binary-monitor backend. `anno-*` is the annotation store. `disasm-*` is the disassembler. `broker-*` is the host broker. A test sits beside its module under the same basename plus `.test.ts`, `.test.mts` or `.test.mjs`.
- **`.mts` against `.ts`.** `.mts` marks a module that `build.ts` compiles into `resources/`. Plain `.ts` runs as source under Node type-stripping. Read the `HOST_BOUND_ARTIFACTS` array in `build.ts` before you rename a file across the two.
- **Names.** A function name is camelCase and starts with a verb, as in `repoRoot()` and `containerPath()`. A function that returns a boolean reads as a predicate, as in `isInsideContainer()`. A type name is PascalCase. An options type is `<FunctionName>Options`. A result type is `<FunctionName>Result`. An error class name ends in `Error`.
- **Style.** The repo holds no formatter config. Match the file you edit. Indent with 2 spaces. Use double quotes, semicolons and template literals. Lines run to about 100 to 120 columns. Do not rewrap an existing line. `npm run typecheck` is the only static gate, so treat strict TypeScript as the linter.
- **Imports.** Import Node built-ins first, always with the `node:` prefix. Leave a blank line. Then import local modules as relative paths that include the real file extension. The repo defines no path alias. `verbatimModuleSyntax` makes `import type` mandatory for a type-only import. The runtime dependency set is exactly `@mastra/mcp` and `@mastra/core`. Nothing enforces that mechanically any more, so do not add a runtime dependency without deciding to.
- **Errors.** `ViceError` in `src/mcp/vice/vice-errors.ts:158` is the base class and carries an optional `code` and `data`. A subclass extends it and adds domain fields as public properties. A constructor takes a message and an options object. Prefer a structured result over a throw. A `reason` field holds prose that a caller shows to a user. It is not a code to map later.
- **Comments.** A module header states WHY the file exists and names the incident behind it. Write "a second broker launch raced the first and killed a live capture". Do not write "plan 02-03 (BROK-03, D-14)". State what the file is the one authoritative place for. State what NOT to do and name the past mistake. Give every export a JSDoc block written as prose.
- **Modules.** Export by name. This repo uses no default export and no barrel file. One module owns each piece of derived knowledge. `repo-root.ts` owns the project root. `stock-connect.ts` owns the binary-monitor handshake. `hostpath.ts` and `containerpath.ts` own path translation. `stock-dispatch.ts` owns the dispatch table. Import the owning function. Do not recompute it inline.
- **Injection.** Pass parameters as a destructured options object. Do not pass a positional boolean. A function that touches env, time, spawning or I/O accepts an injectable override. The suite has no mocking library.
- **Boundary.** Any host-facing path or hostname must go through `hostpath.ts`, `containerpath.ts` or `container-guard.mts`. Never call `spawnSync` on an external binary from a skill script. The app runs on the host, so the call must cross a container-out seam.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Full detail: `.planning/codebase/ARCHITECTURE.md`. The system is a split-process proxy and broker with a hard container and host boundary, shipped as a Claude Code plugin. There is one emulator target and no backend to select.

## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| Stdio MCP entry point | Speaks MCP JSON-RPC to Claude Code over stdin and stdout. Answers `initialize` and `tools/list` from the manifest. Forwards `tools/call` | `src/mcp/vice/vice-proxy.ts` |
| Stock transport (binary monitor) | The one place that performs the stock connect handshake. Owns session setup, reconnect and teardown over the length-prefixed binary framing | `src/mcp/vice/stock-connect.ts` (framing in `src/mcp/vice/stock-protocol.ts`) |
| Broker client | The container-side half of the on-demand broker protocol. Acquires, releases and recycles over a TCP control session | `src/mcp/vice/vice-broker-client.ts` |
| Repo root resolution | The one shared resolver for the project root and for the `.c64-re-tools` directory | `src/mcp/vice/repo-root.ts` |
| Resource deployment | Deploys host launcher scripts into the *consuming* project on first use, under `.c64-re-tools/bin/` | `src/mcp/vice/install-resources.ts` |
| Container detection | A five-signal detector that tells container from host. The broker checks it at process startup | `src/mcp/vice/container-guard.mts` |
| Host and container path translation | Rewrites a bind-mounted container path to a host-reachable path, and the inverse | `src/mcp/vice/hostpath.ts`, `src/mcp/vice/containerpath.ts` |
| Incident capture | Writes an incident record, with snapshot and screenshot metadata, before any recycle or kill | `src/mcp/vice/incident-record.ts` |
| Host broker daemon | A long-lived pool manager. Owns port allocation, the warm floor, crash supervision and the TCP control listener | `src/mcp/vice/vice-broker.mts` (+ `broker-*.mts` siblings) |
| Build step | Compiles host-bound `.mts` sources into committed, banner-marked `.mjs` files under `resources/` | `src/mcp/vice/build.ts` |
| Advertised tool surface | A committed snapshot that the proxy reads offline at `tools/list`. Nothing regenerates it from a live host | `src/mcp/vice/tools-manifest.stock.json`, resolved through `src/mcp/vice/stock-dispatch.ts` |
| Plugin manifest | Declares the skills directory, the mcpServers file and the SessionStart hook | `.claude-plugin/plugin.json` |
| MCP server wiring | The `vice` server entry that Claude Code launches | `.mcp.json` |
| npm installer | The non-plugin install path. Copies skills and writes `.mcp.json` into any project | `installer/bin/cli.mjs` |
| Skills (nine) | Markdown playbooks and Node scripts. They drive the MCP tools or work offline on files | `src/skills/*/SKILL.md`, `src/skills/*/scripts/*.mjs` |

### Constraints that bind what you may write
- **No fall-through to another transport.** Every tool reaches `stockDispatch.dispatchStock()`. It matches a table entry and answers by name, or it matches nothing and refuses by name. There is no third path. `vice_result_continue` and the `anno_*` family touch no transport, and `stock-dispatch.test.ts` asserts those two exceptions by name.
- **Single-owner launch guard.** The module-level `inFlight` boolean in `broker-launch.mts` is a synchronous check-and-set with no `await` between. It is the sole gate on spawning `x64sc`. It exists because of the 2026-08-01 triple-launch outage. Do not add a second gate. Do not put anything blocking inside that window.
- **One module per seam.** `anno-store.ts` is the only `node:sqlite` consumer. `stock-protocol.ts` is the only module that handles `node:net` and binary-monitor bytes. A structural test asserts each one.
- **No build step for the shipped server.** Container-side `.ts` modules run under Node type-stripping. `build.ts` compiles only the host-bound `.mts` files, because those run on a bare host Node.
- **This codebase avoids module cycles deliberately.** Passing `workspaceRoot` explicitly broke the cycle from `repo-root.ts` to `install-resources.ts` to `hostpath.ts`. Adding `stock-handler.ts` broke the cycle from `stock-dispatch.ts` to the `stock-*.ts` modules. Do not reintroduce either import.
- **Global state lives in four modules.** `stock-dispatch.ts` holds `heldSession`. `backend-detect.mts` holds `memoisedResult`. `broker-launch.mts` holds `inFlight`. `vice-proxy.ts` holds `CONTINUATION_STORE`. The event loop is single-threaded throughout, and the broker spawns emulator instances as child processes rather than worker threads.
- **`src/mcp/vice/anno-memmap-render.ts` contains a NUL byte.** Plain `grep` skips the file without a warning. Any content census must use `grep -a`.

### Patterns and anti-patterns
- **Generated but committed.** `build.ts` compiles `.mts` sources into `resources/*.mjs`, and the repo commits that output, because a consuming project deploys it with no build step. `resources-sync.test.ts` fails CI on drift.
- **Structural guards as architecture.** Many test files guard the architecture rather than the behaviour. They scan for import cycles and for a bypassed seam. They also check every documentation line reference, and they catch a skill that claims a tool the server does not advertise.
- **Documentation as code.** A source header records the reason for a decision and warns against reverting it. Treat those headers as part of the architecture record.
- **Never-throw boundary.** The stdio server registers global handlers before anything else runs. Claude Code never restarts a dead stdio MCP server for the rest of the session.
- **Do not re-derive a cross-cutting seam locally.** Import the owning module named above.
- **Do not kill or relaunch the emulator to serve a newer request.** Write the incident record first.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| acme-build | Assemble Commodore 64 6510 assembly with the ACME cross assembler. Use when asked to assemble, build, compile or link .a/.asm 6502/6510 source, produce a C64 .prg, scaffold a new C64 program, or list which symbols an assembled build actually used from its symbol file. | `src/skills/acme-build/SKILL.md` |
| c64-disk-access | Read a Commodore .d64 disk image's directory, block allocation map, a named file's sector chain, or a named file's raw bytes, using VICE's own c1541 disk tool as the reference implementation, and audit its directory for fabricated or corrupted entries. Use when asked to list what a disk image contains, check a disk's free blocks or block allocation map, trace which sectors a named file occupies on disk, extract a named file's raw bytes from a .d64, or check whether a disk's directory entries are genuine (a cracker-fabricated filename, a corrupted first track/sector, or a cyclic directory chain). | `src/skills/c64-disk-access/SKILL.md` |
| c64-memory-mapping | Look up what any C64 address means and turn raw 6502 disassembly into documented assembly, by resolving every address against the C64 memory map, KERNAL ROM routine list, canonical assembler symbols, and per-bit VIC-II/SID/CIA register tables. Use when asked to annotate or comment assembly against the published memory map, document a disassembly listing by resolving every address it touches, or look up an address like $D020, $EA24 or $FFD2. | `src/skills/c64-memory-mapping/SKILL.md` |
| c64-petcat | Convert a Commodore .prg between PETSCII and ASCII, detokenize a BASIC program into readable text, and read the machine-code handover address out of its startup line, using VICE's own petcat conversion tool as the reference implementation. Use when asked to detokenize a BASIC listing, list what a BASIC stub does, find where a program hands over to machine code, or convert C64 text between PETSCII and ASCII. | `src/skills/c64-petcat/SKILL.md` |
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
