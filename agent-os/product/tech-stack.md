# Tech Stack

## Languages

- **TypeScript is the only allowed programming language for new code.**
  JavaScript is never an allowed language: do not write new `.js`/`.mjs`
  files. Settings: ES2022, NodeNext modules, `strict`, `erasableSyntaxOnly`.
  Code that must run where Node cannot strip types is written as `.mts` and
  compiled by `build.ts`.
- **Generated JavaScript**, never edited by hand: `resources/*.mjs` (host-bound,
  committed), `vice-cli.mjs` (the package bin, committed) and `dist/` (the npm
  server build, made at publish time, never committed). No hand-written
  `.mjs`/`.js` exists; `no-handwritten-mjs.test.ts` enforces it.
- **Bash**: the host launcher (`resources/vice-launcher.sh`) and `dxa`'s build
  script.
- **6502/6510 assembly (ACME dialect)**: skill templates and the exported
  rebuild source.
- **Markdown**: skill playbooks (`SKILL.md`) and their references.

## Runtime

- **Node.js ≥ 24** for `@henols/vice-mcp`, which needs `node:sqlite`. From the
  plugin or a checkout it runs `.ts` directly through native type-stripping.
  Installed from npm it runs the compiled `dist/` build, because Node never
  strips types under `node_modules`.
- **Node.js ≥ 24** for skill scripts. They are plain `.ts` and run directly,
  with no build step. `npx skills add` installs them into the project (e.g.
  `.agents/skills/` linked from `.claude/skills/`), which is outside
  `node_modules`, so type-stripping applies. Each skill's `scripts/` carries a
  `{"type":"module"}` `package.json`. They need a
  `node` ≥ 24 on PATH. A bare non-interactive `node` can resolve to an older
  system Node (measured on the dev host: v20.19), and an older `node` cannot run
  a `.ts` script at all.
- Any module loaded from `node_modules` must be compiled TypeScript, where Node
  never strips types: `dist/`, `resources/*.mjs` or `vice-cli.mjs`.
- ESM (`"type": "module"`) is used everywhere.

## Dependencies

- Runtime: `@mastra/mcp` 1.15.0, `@mastra/core` 1.55.0 and `@modelcontextprotocol/sdk`
  (imported directly by `vice-proxy.ts`, already pulled in by `@mastra/mcp`) only. Mastra telemetry
  is disabled with `MASTRA_TELEMETRY_DISABLED=1`.
- Node built-ins that carry architecture: `node:sqlite` (only `anno-store.mts`
  may import it, and no broker module loads it), `node:net` (the monitor channels and the broker endpoint) and
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
- Tests use Node's built-in `node --test`. Server tests sit next to the module
  they test; skill-script tests live in `test/skills/<skill>/` so they never ship.
  `npm run test:automated` skips the manual-only suites, and live suites run only
  when `VICE_LIVE_*` environment variables are set. Tests must be data-driven: no
  test may scan source text.
- GitHub Actions run the typecheck, the tests, the smoke test and the
  packed-install smoke test (`smoke-packed.ts`). A `v*` tag publishes
  `@henols/vice-mcp` through OIDC trusted publishing.

## Distribution

- npm: `@henols/vice-mcp` (bin `vice-mcp`: the MCP server, `vice-mcp anno`,
  `vice-mcp broker`). Other agents wire it with `npx add-mcp vice-mcp`.
- Skills: `npx skills add henols/c64-re-tools` reads `skills/` from this
  repository. Nothing is published for them.
- Claude Code plugin: `.claude-plugin/plugin.json` and `.mcp.json`, with
  `defaultEnabled: false`. In plugin mode the tools are namespaced
  `mcp__plugin_c64-re-tools_vice__*`.

## Architecture Decisions That Bind Future Work

**Process topology**
- Three separate parts: the stdio MCP server (`vice-proxy.ts`), one broker per
  machine (`vice-broker.mts`), and the `x64sc` instances that the broker
  launches. The user starts the broker by hand with `vice-mcp broker` (npm)
  or `node <plugin-root>/src/mcp/vice/vice-cli.mjs broker` (plugin or checkout). No client spawns it, and the project ships
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
  under the project's `.c64-re-tools/local/<kind>/`. Neither side ever names a path
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
- `node:sqlite` is used in one module only (`anno-store.mts`). The schema version
  (6) check is strict equality, with no migration.
- Annotation is a CLI (`anno call` and the report verbs). It never touches the
  emulator.
- **The project owns the store:** each project's annotations are ONE SQLite
  file, `<project>/.c64-re-tools/annotations.db`, committed with the project.
  The client opens it in-process per call; the broker never loads the store.
  The file holds exactly one project, created by the first write. Every row
  still carries `project_id`, bound into every statement. `anno export-project`
  / `import-project` give the binary file a diffable text form.
- Skill scripts never spawn external binaries. Every host tool goes through the
  broker's fixed endpoint (`host_tool_stage`/`host_tool_run`): inputs upload as
  bytes, results download by handle, and no request names a broker-side path.
- Tool location has one declaration (`prerequisites.json`) and one resolver
  (`tool-location.mts`). A missing tool is refused by name, with the remedy.
