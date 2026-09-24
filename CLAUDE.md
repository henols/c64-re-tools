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
hardware-level capabilities have no route on stock at all.
`docs/stock-hard-losses.md` records them as permanent, accepted losses rather
than a gap awaiting a workaround.

**Core Value:** A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

### Constraints

- **Compatibility**: The stdio MCP surface advertises only the tools this project implements against stock VICE. There is no second backend and no per-backend trim to reconcile. A skill written against a tool the server does not advertise therefore *breaks* rather than degrading. A playbook must name a real route, or state that the capability is a permanent limitation (see `docs/stock-hard-losses.md`).
- **Protocol (settled, normative)**: 11-byte request header / 12-byte response header, all multi-byte values little-endian. Confirmed opcode set and error codes per `.planning/phases/01-corrected-ground-truth/evidence/phase0-binmon-findings.md` §5.
- **Protocol**: **Five** unsolicited message types arrive at request-id `0xffffffff`, not three:

  1. `STOPPED` (0x62)
  2. `RESUMED` (0x63)
  3. `JAM` (0x61)
  4. `CHECKPOINT_INFO` (0x11), on every checkpoint hit
  5. `REGISTER_INFO` (0x31), on every monitor open

  Types 4 and 5 **share a response type with a legitimate command reply**. Therefore demux must key on request-id. Never resolve a pending request with an event.
- **Protocol**: `JAM` (0x61) has a **zero-length body**. `monitor_binary.c:384-394` computes the PC, then passes `length = 0`. VICE therefore sends no PC. Every client surveyed assumes 2 bytes and breaks on it.
- **Protocol**: A non-stopping checkpoint emits one `CHECKPOINT_INFO` frame per hit. It sends that frame **synchronously, over the blocking socket, from inside the CPU loop** — `mon_breakpoint.c:557-562` calls `mon_breakpoint_event()` before it checks `cp->stop`. On a hot address this can stall the emulator thread.

  That is the source-level reason for a rule: checkpoint-wait code must always resolve state from a response field such as `hit_count`. Never infer a paused state from elapsed time alone.
- **Concurrency**: Stock VICE's binary monitor services **exactly one client**. A second `connect()` sits unserviced in the backlog with no reply and no EOF — indistinguishable from a wedge. The broker must guarantee single-client-per-instance and must not diagnose this state as a hang.
- **Protocol**: `default_memspace` contamination has no direct remedy over the binary monitor. A drive checkpoint hit sets it (`monitor.c:3393-3396`). No binary-monitor command resets it. After that, `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the *drive* CPU, and `@bank:` conditions fail outright. This affects any stepping code written after someone adds drive debugging.

  **The remedy exists on the text channel.** `device c:` over `-remotemonitor` resets the default device (MEASURED 2026-08-27). Write the colon. `device c` without it is a syntax error.

  A live run exercised the contamination itself, not only the remedy. A real drive checkpoint armed over the whole 1541 ROM range froze main-CPU `ADVANCE_INSTRUCTIONS` stepping at a fixed PC. `device c:` restored forward stepping. MEASURED 2026-09-09 on genuine stock `/usr/bin/x64sc` VICE 3.9. See `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/evidence/phase41-text-channel-live-evidence.md`.
- **Protocol**: The wire memspace byte is **not** the internal enum — `0x00` = main, `0x01`–`0x04` = units 8–11 (`monitor_binary.c:401-434`). VICE rejects `0x08`.
- **Protocol**: Checkpoint *conditions* use the pseudo-registers `RL` and `CY` (uppercase), **not** the register-list names `LIN`/`CYC` — those lex as `BANKNAME` and produce a syntax error. Conditions have **no operator precedence** (`mon_parse.y:168`), so `RL == $64 && CY == $14` parses as `(((RL==$64) && CY) == $14)` and is always false. Parenthesise every comparison. Bare integer literals are **hex** by default (`monitor.c:1597`), so `RL == 100` means line 256.
- **Protocol**: VICE reads `CPUHISTORY_GET`'s count field as a uint32, then stores it in a `uint16_t` (`monitor_binary.c:1492`). A count of 65536 or more therefore wraps. Clamp the count to 65535 in the client.
- **Capability**: There is no runtime `WarpMode` resource (`vsync.c:220-241`, deliberately). On the stock backend, set warp at launch time with `-warp` or `InitialWarpMode`.

  **This limit binds the binary monitor only.** The claim is about the *resource*. `warp on` and `warp off` are monitor *commands*. They work at runtime over the text channel, and they report their own state (MEASURED 2026-08-27).

  A live run re-probed both directions through the shipped `vice_warp_set` tool with the channel open. Both round trips succeeded. MEASURED 2026-09-09 on genuine stock `/usr/bin/x64sc` VICE 3.9. On that build the response carried no textual "on" or "off" confirmation beyond the framed prompt. This run recorded that nuance rather than assuming it. See `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/evidence/phase41-text-channel-live-evidence.md`.
- **Capability**: Drive memory reads with true drive emulation off return **silent zeros, not an error**. The real gate is `Drive8TrueEmulation` plus a non-zero `Drive8Type` (`drive/drive-resources.c:450`). `check_drive_emu_level_ok()` is a machine-capability check that always passes on `x64sc`.
- **Safety**: Three resources power-cycle the machine one call deep, destroying all emulation state — `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency` (all reach `machine_trigger_reset(POWER_CYCLE)` at `c64/c64.c:1367`). Any resource-set tool exposed to an LLM must deny these.
- **Compatibility**: Resource names are not version-stable — `TrapDevice8` was `VirtualDevice8` before 3.10, renamed with no alias.
- **Protocol**: `DISPLAY_GET` (0x84) is INDEXED8-only and needs api_version ≥ 2. RGB conversion and PNG encoding move client-side.
- **Protocol**: No monotonic cycle register. `LIN`/`CYC` are readable but not monotonic. Absolute cycles must be reconstructed or read from the text monitor's `stopwatch`.
- **Dependency**: `CPUHISTORY_GET` (0x86) requires **VICE ≥ 3.10**. Debian trixie, forky and sid ship 3.9. All current Ubuntu releases ship 3.9. Version 3.9 lacks the opcode. Homebrew builds and official builds carry it.

  **This floor binds the binary monitor only.** It applies to the *opcode*, not to the capability. Over the text channel, `chis` returned CPU history with per-entry cycle counts on genuine stock 3.9 (MEASURED 2026-08-27).

  Note the polarity. A build excludes text-command tracing and profiling by opt-**out**. That is the opposite of a version floor.

  The affected text commands do not each carry a separate guard:

  - `memmapshow` and `chis` share one guard and one stub string.
  - `bt` and `prof flat` carry no guard.
  - `io` degrades per chip at runtime instead of refusing.

  Per-command probing still works. See `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/evidence/phase42-text-format-drift-citations.md`.

  A separate fixture batch confirmed this independently (`FIXTURE_UNSUPPORTED: none`, `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/phase39-dual-channel-coexistence-gate-findings.md` §7). `chis` succeeded on genuine stock VICE 3.9 over the text channel, through a different code path from the binary-monitor opcode. `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/evidence/phase41-text-channel-live-evidence.md` collects both citations.
- **Capability**: SID `$D400–$D418` is write-only in hardware and the binary monitor has no SID command — read-back is unrecoverable on stock. VIC-II/CIA *internal* state (raster-IRQ latch, timer latches) is likewise unavailable. Only the readable register map is.
- **Capability**: Matrix keyboard is not recoverable on stock. `KEYBOARD_FEED` (0x72) injects buffer text only.
- **Tech stack**: Node ≥ 24 (native TypeScript type-stripping — the shipped server has no build step). Host-bound `.mts` files must still be compiled by `build.ts` into committed `resources/*.mjs`, and `resources-sync.test.ts` fails CI on drift.
- **Architecture**: Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`. The project maintains a tested closed consumer set for host-path logic.
- **Architecture**: The broker's single-owner `inFlight` launch guard must stay a synchronous check-and-set with no `await` between. It exists because of the 2026-08-01 triple-launch outage and is regression-tested.
- **Architecture**: Every shipped module that spawns the emulator binary must spawn it in the safe form. The safe form is an argv **array**. Never use a shell command string. Never use a string-interpolated binary path.

  The set of modules that spawn the emulator is frozen, not assumed. That set has exactly **one** member today: `src/mcp/vice/broker-launch.mts`. It calls `spawn(viceBin, viceArgs)`. It never passes `shell: true`. It never interpolates the binary path into a string.

  That module had a predecessor: a `--help` probe that reported which VICE backend the host carried. Backend detection collapsed to a single stock target, and the probe went with it.

  Any NEW module that spawns the emulator binary must use the same argv-array form.
- **Testing**: `stock-run-until.ts` holds the single-resume-per-wait checkpoint invariant: never send a second resume while one wait is outstanding. A unit test proves it against a synthetic client.

  `stock-run-until.ts` is an event-driven port. The project's original checkpoint-wait code polled, and it carried this rule untested. That code's correctness meant something only against a real emulator's timing. The event-driven port removed that dependency.

  Preserve the invariant if this file changes.
- **Dependency**: **Never auto-install an external tool.** The user installs it. The project only detects what is already present. This is the owner's standing constraint, stated 2026-09-08. Do not re-litigate it.

  Use this pattern: detect the tool, then refuse by name and put the remedy in the message. Each tool follows it:

  - `x64sc` — `resolvedBackend()` in `backend-detect.mts` probes for it. `README.md` carries the per-distro `apt` / `brew` / `pacman` line. The **user** runs that line.
  - `c1541` and `petcat` — `findSiblingBinary()` in `host-tool.mts` finds them beside the resolved `x64sc`. It memoises the result per process. A `$PATH` fallback logs a warning. That warning names the shadowing hazard.
  - ACME — `findAcmeLib()` in `src/mcp/vice/host-tool.mts` probes `$PATH` and four documented prefixes.
  - Ghidra — declared by version only, non-vendored, at a path the user chooses. Search for `analyzeHeadless`. Never guess a prefix.
  - dxa — `findDxaBinary()` in `host-tool.mts` makes `dxa.disassemble` refuse by name. The refusal names `bash vendor/dxa/build.bash build` as the remedy. The tool never builds dxa itself.

  dxa ships as committed source under `src/mcp/vice/vendor/dxa/`. The `curl` inside `build.bash` runs only when the user runs `build.bash`. It verifies the committed tree against the pinned `src/mcp/vice/vendor/dxa/dxa-0.1.5.tar.gz.sha256`. Nothing triggers it automatically.

  Three prohibitions follow:

  1. Never call a package manager from code.
  2. Never fetch a tool and build it on demand.
  3. Never run `npx -y` on a **third-party** package to make a missing tool appear.

  Prohibition 3 does not cover `npx -y @henols/vice-mcp anno <verb>`. That route is an invocation, not an install.

  Three things are **out of scope**. Do not "fix" them:

  1. `scripts/ensure-mcp-deps.sh` runs `npm ci` on `SessionStart` for the MCP server's own `node_modules`. A lockfile sha256 gates it. Those are this package's dependencies, not an external tool.
  2. `.github/workflows/ci.yml` runs `retry_apt install -y acme`. CI uses a throwaway runner, never a user machine.
  3. `installer/bin/cli.mjs` runs `npm install -D @henols/vice-mcp`. It runs only behind the explicit `--vendor` opt-in.
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
- `node_modules/` for the MCP server is **never committed** (`.gitignore`). A `SessionStart` hook (`scripts/ensure-mcp-deps.sh`) provisions it on first use. That hook gates `npm ci` behind a sha256 hash of the lockfile, so a normal session start does nothing.
## Frameworks / Key Runtime Dependencies
- `@mastra/mcp` `1.15.0` - MCP server/tooling framework (`dependencies` in `src/mcp/vice/package.json`)
- `@mastra/core` `1.55.0` - underlying Mastra runtime the MCP package depends on
- `@modelcontextprotocol/sdk` `1.30.0` (transitive, via `@mastra/mcp`) - the official MCP TypeScript SDK
- `MASTRA_TELEMETRY_DISABLED=1` disables Mastra's own telemetry. Every launch path sets it: `.mcp.json`, and the `.mcp.json` entries the installer generates.
- Node's built-in test runner (`node --test`), no separate test framework. Run via `npm test` in `src/mcp/vice` (the `test` script in `src/mcp/vice/package.json`: `node --test '*.test.*'`).
- Test files are colocated `*.test.ts` / `*.test.mts` next to the module under test (e.g. `stock-dispatch.ts` / `stock-dispatch.test.ts`).
- TypeScript `7.0.2` (devDependency, typecheck-only — `tsc --noEmit`). No emitted `.js` from the TS sources at runtime (Node type-stripping runs the `.ts`/`.mts` files directly).
- `src/mcp/vice/build.ts` - a custom build step. It compiles the host-bound `.mts` launcher modules into plain `.mjs` files under `resources/`. The **host** side runs outside any container, so it cannot rely on Node's type-stripping the same way.

  **Read `HOST_BOUND_ARTIFACTS` in `build.ts` for the current set. This file does not reproduce it.** The set grows every time someone adds a host-side module. The copies drifted apart once already: on 2026-09-24 this file listed ten, `STACK.md` said eight, and the real list held sixteen. `tsconfig.build.json`'s `include` must match it entry for entry.
- `@types/node` `24.13.3` - Node type definitions for the TypeScript build.
- ACME cross-assembler (external, not an npm package) - required on `$PATH` for the `acme-build` skill. The skill probes `$ACME`, `/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme` (`findAcmeLib()` in `src/mcp/vice/host-tool.mts`). Verified locally against ACME release 0.97 "Zem".
## Key Dependencies (transitive, via package-lock.json)
- `@a2a-js/sdk` `0.3.14`
- `@ai-sdk/provider` (multiple versions: `2.0.3`, `3.0.14`, `4.0.3`) and `@ai-sdk/provider-utils` (`3.0.30`, `4.0.40`, `5.0.11`) - AI SDK provider abstractions Mastra depends on
- `@hono/node-server` `2.1.0` - HTTP server (Hono framework) used internally by Mastra
- `@posthog/core` / `@posthog/types` - analytics client code inside Mastra (disabled via `MASTRA_TELEMETRY_DISABLED`)
- `@modelcontextprotocol/ext-apps` `1.7.5`
- `@isaacs/ttlcache`, `@lukeed/csprng`, `@lukeed/uuid`, `@sindresorhus/slugify` / `transliterate` - small utility libs
- `x64sc` - stock upstream VICE. Any unpatched build from a package manager works. The project drives it over its binary monitor and text channel. It is the load-bearing external dependency under the whole `vice` MCP tool surface. There is no non-upstream build and no backend to select. Three hardware-level capabilities have no route on stock at all. `docs/stock-hard-losses.md` records them as permanent, accepted losses.
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
- `.c64-re-tools/` (repo root, gitignored) - the single tool-written root. Every writer in this codebase derives its location from `toolsDir()` in `src/mcp/vice/repo-root.ts` (D-33, 2026-09-08 clean break). It holds:

  - `snapshots/` — `.vsf` files and `.json` sidecars
  - `bin/` — deployed host launcher artifacts
  - `runs/oracle/` — oracle.run scratch
  - `runs/ghidra/` — `ghidra.analyze` per-run project data
  - `incidents/` — recycle incident records
  - `cache/` — the MCP dep lockfile stamp

  **Broker state does not live here.** `supervisor/`, which carries `broker.json`, sits under the machine-level root instead (Phase 64, plan 64-10, G-64-1). `src/mcp/vice/broker-home.mts` resolves that root. It defaults to `~/.c64-re-tools/supervisor/`, or to `VICE_BROKER_HOME`. The broker writes there. Same-machine clients read there. Both go through `broker-home.mts`, never through `toolsDir()` or `supervisorDir()`.

  `VICE_POOL_DIR`, `VICE_EPOCH_FILE`, `VICE_SUPERVISOR_DIR` and `VICE_INCIDENTS_DIR` each still override their own resolved default.

  **The 2026-09-08 change was a clean break.** The code does not read the previous locations (`.vice-supervisor/`, `.vice-snapshots/`, `tools/*.mjs`, `.planning/incidents/`). There is no migration shim. There is no env var that restores the old layout. The code ignores an old-layout tree and leaves it on disk. The user deletes it by hand.

  **There is no remaining exception** (corrected 2026-09-08, gap `G-40-1`). `ghidra.analyze` writes its per-run project data under `.c64-re-tools/runs/ghidra/` like everything else. Ghidra reaches it through a non-dotted ALIAS at `<repoRoot>/c64-re-tools`. That alias is a symlink. Its target is the RELATIVE string `.c64-re-tools`. The broker mints it host-side at startup (`vice-broker.mts`). `ensureGhidraRunsHandle()` in `ghidra-project.mts` re-asserts it as an idempotent precondition on every resolve. It refuses BY NAME when something unexpected already sits at the handle path. It never repairs that path.

  The alias exists because Ghidra's project-location refusal binds the ABSOLUTIZED path argument it receives. `ProjectLocator` calls `java.io.File.getAbsolutePath()`. It never calls `getCanonicalPath()` (MEASURED from the class's own bytecode, `.planning/notes/ghidra-dot-path-check-semantics.md`). Ghidra therefore absolutizes a relative argument but does **not** resolve a symlink. A broker-minted symlink handle meets three conditions at the same time:

  1. The absolutized path Ghidra receives carries no dotted segment and no bare-`.` segment.
  2. The handle sits inside the bind-mounted workspace, because `containerPath()` throws on a host path outside it.
  3. The link's target is RELATIVE, because the container must traverse the same link to read the run log.

  This arrangement is fragile by design. It depends on Ghidra never switching to `getCanonicalPath()`. A live, opt-in test against real Ghidra guards it — the SYMLINK GUARD cases in `src/mcp/vice/ghidra-live.test.ts` (phase 40, plan 40-09).

  An earlier version of this entry called the split location "a hard external-tool constraint, not a preference". That was an overstatement. It came from running this project's own `hasDotPrefixedSegment()` check against a synthetic string, which observes this project and never observed Ghidra. MEASURED 2026-09-08 against real Ghidra 12.1.3: the refusal binds the path string, not where the bytes physically live.
- `VICE_BROKER_STALE_MS`, `VICE_BROKER_ACQUIRE_TIMEOUT_MS`, `VICE_BROKER_RECYCLE_TIMEOUT_MS`, `VICE_BROKER_CONTROL_DIAL_HOST`, `VICE_BROKER_CONTROL_HOST` - broker/control-plane tuning. `VICE_BROKER_NODE` - an absolute-path override pinning which `node` interpreter `vice-launcher.sh` execs into (for a service environment whose PATH carries no usable one). The launcher refuses by name, before exec, when the resolved interpreter (override or PATH) is below the floor mirrored from `engines.node`.
- `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` - Claude Code-provided plugin paths, consumed by `scripts/ensure-mcp-deps.sh` and `.mcp.json`.
- `CLAUDE_PROJECT_DIR`, `CONTAINER_WORKSPACE_PATH`, `HOST_WORKSPACE_PATH` - project-root resolution (`src/mcp/vice/repo-root.ts`) and host/container path translation.
- `MASTRA_TELEMETRY_DISABLED` - disables Mastra's telemetry.
- `.env` files: none detected in the repository.
## Platform Requirements
- Node.js >= 24 to run/test the MCP server. Node >= 18 to run the installer.
- ACME cross-assembler on `$PATH` for the `acme-build` skill.
- A reachable host running stock upstream VICE (`x64sc`) for any live emulator interaction — the MCP server itself has no in-process emulator.
- Docker/devcontainer awareness baked in: code checks `isInsideContainer()` (`src/mcp/vice/container-guard.mts`) to decide between `host.docker.internal` and `127.0.0.1` as the default VICE host.
- Published to the public npm registry as `@henols/vice-mcp` and `@henols/c64-re-tools`, installed via `npx` into consumer projects, or as a Claude Code plugin via `/plugin marketplace add`.
- CI: GitHub Actions (`.github/workflows/ci.yml`), two jobs only.

  - `build` runs typecheck plus the MCP-server, installer and skill suites.
  - `publish-npm` triggers on a `v*` tag, or on a manual dispatch that names an explicit version. It derives the version from the ref. It publishes both packages through OIDC Trusted Publishing. There is no `NPM_TOKEN` secret.
- Merging to `main` publishes nothing. A release is a git tag: `git tag v1.2.3 && git push origin v1.2.3`. A consumer installs the plugin from the repository, so a release builds no zip and attaches none.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Full detail: `.planning/codebase/CONVENTIONS.md`. The rules below change what you write.

- **`docs/` is operator-owned.** `docs/` holds only what the project owner put there: documentation about the C64 tooling product itself. Put every GSD phase artifact under `.planning/phases/<phase>/evidence/` instead. Never put one in `docs/`. This covers evidence, findings, gate verdicts, decision records, provenance records, and a ROADMAP criterion answered in writing.

  This rule binds every role that names a destination path. It binds the planner and the discuss agent most of all. An executor writes where its plan says, so a `docs/` path in a `<files>` block is already the defect.

  **Do not infer the destination from precedent.** The planning corpus still cites `docs/…` paths in historical entries. Some of those paths no longer resolve. They are the residue of a convention the project reversed. They are not evidence for it:

  - Phase 53 relocated its documents out of `docs/` on 2026-09-17 (`ccdc58da`).
  - Two more documents went straight back in within 24 hours, because no file an agent reads carried this rule.
  - Phase 53's work relocated those two on 2026-09-19.

  A citation that reads "recorded in `docs/phaseNN-….md`" is a stale pointer. Never copy it as house style.

  **No guard enforces any of this.** The project withdrew Phase 53's guard criterion on 2026-09-17, because that guard would scan source text, which `260914-poo` D-1 bans. This bullet is the whole enforcement.

  To check the current state instead of trusting a count, run both commands:

  1. `ls docs/` — it must show only operator-authored files.
  2. `grep -rl 'docs/phase' $(git ls-files src tools)` — it must return nothing.
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
- **One module per seam. It is NOT test-enforced.** `anno-store.ts` is the only module that imports `node:sqlite`. Keep it that way. Route annotation-store access through it. Do not open a second database handle.

  Phase 56 deleted the structural scan that used to assert this. `anno-seam.test.ts` records that removal in its own header. Nothing now catches a second importer. Check by hand: `grep -rl 'from "node:sqlite"'`.

  **`node:net` is a different case. It is NOT confined.** `stock-protocol.ts` owns the binary-monitor *wire format*, and nothing wider. About a dozen production modules open sockets of their own, and they do so legitimately: the broker, the relay, the text channel and the host-tool client. Do not read the binmon-codec seam as a ban on `node:net`.
- **No build step for the shipped server.** Container-side `.ts` modules run under Node type-stripping. `build.ts` compiles only the host-bound `.mts` files, because those run on a bare host Node.
- **This codebase avoids module cycles deliberately.** Passing `workspaceRoot` explicitly broke the cycle from `repo-root.ts` to `install-resources.ts` to `hostpath.ts`. Adding `stock-handler.ts` broke the cycle from `stock-dispatch.ts` to the `stock-*.ts` modules. Do not reintroduce either import.
- **Global state lives in four modules.** `stock-dispatch.ts` holds `heldSession`. `backend-detect.mts` holds `memoisedResult`. `broker-launch.mts` holds `inFlight`. `vice-proxy.ts` holds `CONTINUATION_STORE`. The event loop is single-threaded throughout, and the broker spawns emulator instances as child processes rather than worker threads.
- **Several tracked source files contain a NUL byte, and plain `grep` skips them silently.** Any content census must use `grep -a`. Do not work from a remembered list of which files — it has been wrong before (this bullet named exactly one until 2026-09-24. Four `.ts` files qualified). Recompute it: `node -e 'require("child_process").execSync("git ls-files src",{encoding:"utf8"}).trim().split("\n").filter(f=>require("fs").readFileSync(f).indexOf(0)!==-1).forEach(f=>console.log(f))'`, which also lists the binary fixtures, where a NUL is expected rather than a hazard.

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

Run phases with worktree isolation ON. Do not disable it project-wide. Do not add standing
instructions that route around GSD's dispatch, cleanup or synthesis machinery. Do not treat a
single bad worktree run as evidence that isolation is unusable.

Nested `claude -p` sessions are **not** prohibited. This project banned them once. A test
refuted the ban's stated cause on 2026-08-29.

GSD is a vendored, gitignored install, so CI and fresh clones have none. **Nothing in this repo
may branch on whether GSD is installed.** The install carries **zero local customisations** and
must keep carrying zero. Never edit a file under the vendored tree.

**GSD's own behaviour is GSD's to document. It does not belong in this file.** The worktree
carve-outs, the cleanup-wave deletion check and the isolation sentinel are stock mechanics, and
they change with the GSD version. Read them from the install itself:
`gsd-core/references/dispatch-isolation-gate.md`,
`gsd-core/workflows/execute-phase/steps/per-plan-worktree-gate.md` and
`gsd-core/bin/lib/worktree-safety.cjs`. Read `workflow.use_worktrees` with
`gsd_run config-get`, which answers from `.planning/config.json`.

A copy of those mechanics goes stale here, and one did. Until 2026-09-24 this section stated
that `cleanup-wave` refuses every deletion **unconditionally** and told the reader to merge a
deletion plan's branch by hand. GSD 1.14.0 blocks only the **undeclared** deletions — its own
`#3003` comment in `worktree-safety.cjs` reads "a deletion the PLAN declared is authorized".
The hand-merge remedy was therefore unnecessary, and it contradicted this section's own rule
against routing around cleanup.

Full rationale and history: `.planning/ENGINEERING_RULES.md` § 20 and § 20.1.



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
