# Tech Stack

## Languages

- **TypeScript is the only allowed programming language for new code.**
  JavaScript is never an allowed language: do not write new `.js`/`.mjs`
  files. Settings: ES2022, NodeNext modules, `strict`, `erasableSyntaxOnly`.
  Code that must run where Node cannot strip types is written as `.mts` and
  compiled by `build.ts`.
- **Generated `.mjs`**: `resources/*.mjs` is compiler output from `.mts`
  sources, never edited by hand.
- **Existing hand-written `.mjs`**: the installer CLI, the skill scripts and a
  few server entry files are legacy code, to be converted to TypeScript (see
  the roadmap).
- **Bash**: the host launcher (`resources/vice-launcher.sh`) and `dxa`'s build
  script.
- **6502/6510 assembly (ACME dialect)**: skill templates and the exported
  rebuild source.
- **Markdown**: skill playbooks (`SKILL.md`) and their references.

## Runtime

- **Node.js ≥ 24** for `@henols/vice-mcp`. It runs `.ts` directly through
  native type-stripping, with no build step at runtime, and needs `node:sqlite`.
- **Node.js ≥ 24** for skill scripts. They are plain `.ts` and run directly,
  with no build step. The installer copies them into `<project>/.claude/skills/`,
  which is outside `node_modules`, so type-stripping applies. They need a
  `node` ≥ 24 on PATH. A bare non-interactive `node` can resolve to an older
  system Node (measured on the dev host: v20.19), and an older `node` cannot run
  a `.ts` script at all.
- **Node.js ≥ 18** for the `@henols/c64-re-tools` installer CLI. It must be
  compiled TypeScript. The same applies to any module loaded from
  `node_modules`, where Node never strips types.
- ESM (`"type": "module"`) is used everywhere.

## Dependencies

- Runtime: `@mastra/mcp` 1.15.0 and `@mastra/core` 1.55.0 only. Mastra telemetry
  is disabled with `MASTRA_TELEMETRY_DISABLED=1`.
- Node built-ins that carry architecture: `node:sqlite` (only `anno-store.ts`
  may import it), `node:net` (the monitor channels and the broker endpoint) and
  `node:zlib`.
- Dev: TypeScript 7.0.2 (typecheck only) and `@types/node`.

## External Tools

The user installs these tools. The project only detects them. All eight are
declared in `src/mcp/vice/prerequisites.json`.

| Tool | Version | Notes |
|------|---------|-------|
| VICE `x64sc` | ≥ 3.9 | The binary-monitor opcode `CPUHISTORY_GET` needs ≥ 3.10. On 3.9, CPU history comes from the text monitor (`chis`). |
| `c1541`, `petcat` | from VICE | Found as siblings of `x64sc`. `c1541` is the only `.d64` reader. |
| ACME + library | 0.97 | Assembler for `acme-build`, and the oracle that proves the exported source reassembles to the same bytes. |
| Ghidra | 12.1.3 | Headless `analyzeHeadless`, not vendored. The NMOS 6502 SLEIGH extension is vendored in `vendor/ghidra-ext`. |
| dxa | 0.1.5 | Vendored source in `vendor/dxa`, built by the user (`bash vendor/dxa/build.bash build`). |

## Build, Test, CI

- `build.ts` compiles the host-side `.mts` modules into committed
  `resources/*.mjs`. `resources-sync.test.ts` fails when the two drift apart.
- Tests use Node's built-in `node --test` and sit next to the module they test.
  `npm run test:automated` skips the manual-only suites, and live suites run only
  when `VICE_LIVE_*` environment variables are set. Tests must be data-driven: no
  test may scan source text.
- GitHub Actions run the typecheck, the tests, the smoke test and a check of
  both tarballs. A `v*` tag publishes both npm packages through OIDC trusted
  publishing.

## Distribution

- npm: `@henols/vice-mcp` (bin `vice-mcp`) and `@henols/c64-re-tools` (bin
  `c64-re-tools`).
- Claude Code plugin: `.claude-plugin/plugin.json` and `.mcp.json`, with
  `defaultEnabled: false`. In plugin mode the tools are namespaced
  `mcp__plugin_c64-re-tools_vice__*`.

## Architecture Decisions That Bind Future Work

**Process topology**
- Three separate parts: the stdio MCP server (`vice-proxy.ts`), one broker per
  machine (`vice-broker.mts`), and the `x64sc` instances that the broker
  launches. The user starts the broker by hand with
  `node <plugin-root>/src/mcp/vice/vice-cli.mjs broker`. No client spawns it, and the project ships
  no service definition for it: how the user keeps it running is their business.
- Endpoint: fixed TCP port 19510, dialled at `127.0.0.1` and then at
  `host.docker.internal`. The first handshake that completes wins, and the
  handshake checks identity and version. The dial order is the only host/container
  detection a client needs.
- Bind: loopback plus the bridge gateways that the broker enumerates at startup.
  Never `0.0.0.0`, and never a hardcoded `172.17.0.1`. There is no auth token.
- One endpoint, many tagged connections. A long-lived connection relays monitor
  traffic, and that connection is the session. Short stateless connections carry
  skill-script calls and files. There is no custom multiplexing envelope.
- Files cross the socket as bytes. The broker picks its own staging paths and
  gives the client an opaque handle for each file. The client writes results
  under the project's `.c64-re-tools/<kind>/`. Neither side ever names a path
  that the other side must open.

**Emulator protocol**
- The binary monitor serves exactly one client per instance. A second connect
  gets no reply and no EOF, which looks the same as a wedge, so the broker makes
  sure that only one client connects to each instance.
- Match replies by request id first. Unsolicited events arrive at id
  `0xffffffff`, and some of them share a response type with real replies. `JAM`
  has a zero-length body.
- The text and binary channels share one FIFO lock (`channel-lock.ts`). Every
  text command must come from an allowlist.
- On the binary monitor, `default_memspace` contamination has no remedy. The
  remedy is `device c:` on the text channel.
- Resource-set tools must deny `MachineVideoStandard`, `VICIIModel` and
  `MachinePowerFrequency`, because each one power-cycles the machine. Warp
  cannot be changed through a resource at runtime.
- Launch arguments are part of the contract: `-default` must come before
  `-binarymonitor`.

**Broker safety**
- The single-owner launch guard is a synchronous check-and-set with no `await`
  between the check and the set.
- An incident record is always written before any kill or reclaim.
- The emulator binary is spawned only with an argv array, never a shell string.

**Analysis and store**
- `node:sqlite` is used in one module only (`anno-store.ts`). The schema version
  check is strict equality, with no migration.
- Annotation is a CLI (`anno call`). It never touches the emulator.
- **Target store ownership (not yet built):** the broker owns ONE annotation
  database per machine, under the broker home. It serves every project, and no
  store file lives in a project. The calling script creates a random
  `project_id` on first use in `<project>/.c64-re-tools/project.json` and sends
  it on every call. Every row carries `project_id`. The broker binds it into
  every read and write, so no call can reach another project's data. There is
  no cross-project query. `anno-store.ts` then becomes host-bound. Today the
  store is still one client-local `.annostore` file per project.
- Skill scripts never spawn external binaries. Every host tool goes through the
  broker's fixed endpoint (`host_tool_stage`/`host_tool_run`): inputs upload as
  bytes, results download by handle, and no request names a broker-side path.
- Tool location has one declaration (`prerequisites.json`) and one resolver
  (`tool-location.mts`). A missing tool is refused by name, with the remedy.
