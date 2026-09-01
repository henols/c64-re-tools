# Technology Stack

**Analysis Date:** 2026-09-01

## Project Type

This is **not** a web/backend application. It is a **Claude Code plugin** (`.claude-plugin/plugin.json`) distributed two ways:

1. As a Claude Code plugin marketplace entry (`.claude-plugin/marketplace.json`).
2. As two published npm packages (`@henols/vice-mcp`, `@henols/c64-re-tools`) installable via `npx` into any project.

It bundles an MCP (Model Context Protocol) stdio server that drives a host-side VICE Commodore 64 emulator across **two interchangeable backends** (the custom `-mcpserver` fork, and stock upstream VICE's binary monitor), plus an **SQLite-backed annotation store** (`anno_*` tool family), plus **seven** Claude Code skills for 6502/6510 reverse-engineering and rebuilding.

## Languages

**Primary:**
- TypeScript (ES2022, NodeNext modules) - MCP server, stock binary-monitor backend, annotation store: `src/mcp/vice/*.ts` and `*.mts`
- JavaScript (ESM, `.mjs`) - installer CLI (`installer/bin/cli.mjs`), skill scripts (`src/skills/*/scripts/*.mjs`), compiled host launcher resources (`src/mcp/vice/resources/*.mjs`), test gate (`src/mcp/vice/test-gate.mjs`), smoke test (`src/mcp/vice/smoke.mjs`), binary-monitor probe (`src/mcp/vice/probe-binmon.mjs`)

**Secondary:**
- Bash - host launcher script (`src/mcp/vice/resources/vice-launcher.sh`), release/packaging scripts (`scripts/package.sh`, `scripts/ensure-mcp-deps.sh`)
- SQL (SQLite DDL) - the annotation-store schema, embedded as a string literal in `src/mcp/vice/anno-store.ts`
- 6502/6510 assembly (ACME dialect) - skill scaffolds/templates, e.g. `src/skills/acme-build/template.a`
- Markdown - all skill documentation (`SKILL.md` files), project docs (`docs/`, `README.md`)

## Runtime

**Environment:**
- Node.js. The MCP server (`@henols/vice-mcp`) requires **Node >= 24.0.0** (`engines` in `src/mcp/vice/package.json`). Two independent reasons: it runs TypeScript directly via Node's native type-stripping (no build/transpile step at runtime), and it uses `node:sqlite`.
- The installer package (`@henols/c64-re-tools`) only requires **Node >= 18** (`installer/package.json`) since it is plain `.mjs`.
- `type: "module"` (ESM) throughout — both packages and all skill scripts.

**Package Manager:**
- npm. Lockfile: `src/mcp/vice/package-lock.json` (committed). The `installer/` package has no committed lockfile.
- `node_modules/` for the MCP server is **never committed** (`.gitignore`); it is provisioned on first use by a `SessionStart` hook (`scripts/ensure-mcp-deps.sh`), which gates `npm ci` behind a sha256 hash of the lockfile so normal session starts are a no-op.

## Frameworks / Key Runtime Dependencies

**MCP protocol:**
- `@mastra/mcp` `1.15.0` - MCP server/tooling framework (`src/mcp/vice/package.json`)
- `@mastra/core` `1.55.0` - underlying Mastra runtime the MCP package depends on
- `@modelcontextprotocol/sdk` `1.30.0` (transitive, via `@mastra/mcp`) - the official MCP TypeScript SDK
- `MASTRA_TELEMETRY_DISABLED=1` is set everywhere the server is launched (`.mcp.json`, installer-generated `.mcp.json` entries) to disable Mastra's own telemetry. `src/mcp/vice/telemetry-import.test.ts` guards this.

**Node built-in APIs carrying architectural weight (no npm equivalent used):**
- `node:sqlite` (`DatabaseSync`) - the annotation store. **Confined to exactly one module**, `src/mcp/vice/anno-store.ts`; `anno-seam.test.ts` fails the build if any second shipped module names the specifier (STORE-07). On-disk `SCHEMA_VERSION` is **3** (`src/mcp/vice/anno-types.ts`), with a `pragma integrity_check` + `anno_meta` row + version match on every open, and the default `delete` journal mode deliberately left unset.
- `node:net` - raw TCP for both the stock binary-monitor socket (`src/mcp/vice/stock-protocol.ts`) and the broker control plane (`src/mcp/vice/vice-broker-client.ts`).
- `node:zlib` - client-side PNG encoding for screenshots (`src/mcp/vice/prg-image.ts`), because stock's `DISPLAY_GET` is INDEXED8-only.
- `node:http` - the fork backend's HTTP JSON-RPC transport (`src/mcp/vice/vice.ts`, `vice-probe.ts`).
- `node:child_process` (`spawnSync`) - the `--help` backend probe (`src/mcp/vice/backend-detect.mts`) and host launches (`broker-launch.mts`).

**Testing:**
- Node's built-in test runner (`node --test`), no separate test framework.
  - `npm test` → `node --test '*.test.*'` (full glob; **hangs** in practice — prefer the gate below)
  - `npm run test:automated` → `node test-gate.mjs` (`src/mcp/vice/test-gate.mjs`, skips `MANUAL_ONLY_TESTS`)
  - `npm run test:manual` → `node test-gate.mjs --manual`
  - `npm run smoke` → `node smoke.mjs` (boots the server under type-stripping and completes an MCP handshake)
- Test files are colocated `*.test.ts` / `*.test.mts` / `*.test.mjs` next to the module under test (e.g. `vice.ts` ↔ `vice.test.ts`, `anno-store.ts` ↔ `anno-store.test.ts`). ~150 test files under `src/mcp/vice/`.
- A large class of tests are **meta/guard tests** rather than unit tests — they assert repo invariants: `docs-linerefs.test.ts`, `resources-sync.test.ts`, `shipped-modules.test.ts`, `anno-seam.test.ts`, `hostpath-consumers.test.ts`, `ci-suite-coverage.test.ts`, `module-classification.test.ts`, `removal-gate.test.ts`.
- Live-hardware tests (`fork-live.test.ts`, `stock-live.test.ts`, `stock-broker-live.test.ts`, `stock-live-triage.test.ts`, `stock-a4-checkpoint-flood.test.ts`) are gated behind `VICE_LIVE_*_BIN` env vars.

**Build/Dev:**
- TypeScript `7.0.2` (devDependency, typecheck-only — `tsc --noEmit`); no emitted `.js` from the TS sources at runtime (Node type-stripping runs the `.ts`/`.mts` files directly). `erasableSyntaxOnly: true` enforces type-strippability.
- `src/mcp/vice/build.ts` (`npm run build`) - compiles the host-bound `.mts` modules into plain `.mjs` under `resources/`, since the **host** side (outside any container) may not have a type-stripping Node. Eight inputs per `tsconfig.build.json`: `vice-broker.mts`, `container-guard.mts`, `broker-state.mts`, `broker-launch.mts`, `broker-kill.mts`, `broker-epoch.mts`, `broker-control.mts`, and (new) **`backend-detect.mts`**. `resources-sync.test.ts` fails CI on drift.
- `src/mcp/vice/refresh-manifest.ts` - regenerates `tools-manifest.json` from a live host server's `tools/list`.
- `@types/node` `24.13.3` - Node type definitions.
- ACME cross-assembler (external, not an npm package) - required on `$PATH` for the `acme-build` skill and for the DISASM-03 disassembler round-trip gate in CI; the skill probes `$ACME`, `/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme`. Gate/verify wrappers: `src/mcp/vice/acme-gate.ts`, `acme-verify.ts`.

## Key Dependencies (transitive, via package-lock.json)

**Notable transitive packages pulled in by `@mastra/mcp` / `@mastra/core`:**
- `@a2a-js/sdk` `0.3.14`
- `@ai-sdk/provider` (`2.0.3`, `3.0.14`, `4.0.3`) and `@ai-sdk/provider-utils` (`3.0.30`, `4.0.40`, `5.0.11`)
- `@hono/node-server` `2.1.0` - HTTP server (Hono) used internally by Mastra
- `@posthog/core` / `@posthog/types` - analytics client code inside Mastra (disabled via `MASTRA_TELEMETRY_DISABLED`)
- `@modelcontextprotocol/ext-apps` `1.7.5`
- `@isaacs/ttlcache`, `@lukeed/csprng`, `@lukeed/uuid`, `@sindresorhus/slugify` / `transliterate`

**Critical external binaries (not npm):**
- `x64sc` — **two accepted shapes**, selected per project:
  - **fork**: the custom/patched build exposing a non-upstream `-mcpserver -mcpserverhost <ip> -mcpserverport <port>` flag serving HTTP JSON-RPC at `/mcp` ([barryw/vice-mcp](https://github.com/barryw/vice-mcp)).
  - **stock**: any upstream VICE build, driven over `-binarymonitor` (TCP, length-prefixed binary framing). `CPUHISTORY_GET` (0x86) additionally requires **VICE >= 3.10**; Debian trixie/forky/sid and current Ubuntu ship 3.9.
  - Which one is in play is decided **once at broker startup** by a `--help` token probe in `src/mcp/vice/backend-detect.mts` (`classifyHelpOutput()`: `-mcpserver` → fork, else `-binarymonitor` → stock), overridable by `VICE_BACKEND`, cached to `backend.json`.
- ACME cross-assembler (see above).

## Configuration

**MCP server wiring:**
- `.mcp.json` (repo root) - declares the `vice` MCP server, launched via `node ${CLAUDE_PLUGIN_ROOT}/src/mcp/vice/vice-proxy.ts`, `timeout: 150000`, `env.MASTRA_TELEMETRY_DISABLED=1`.
- `.claude-plugin/plugin.json` - plugin manifest: points at `./src/skills/` and `./.mcp.json`, registers a `SessionStart` hook running `scripts/ensure-mcp-deps.sh`, `defaultEnabled: false`.
- `.claude-plugin/marketplace.json` - single-plugin marketplace manifest so `/plugin marketplace add` works directly against this repo.

**Tool manifests (two, one per backend):**
- `src/mcp/vice/tools-manifest.json` - the fork surface, **62** tools.
- `src/mcp/vice/tools-manifest.stock.json` - the stock surface, **38** tools.
- `src/mcp/vice/capability-registry.ts` - the single authoritative table of per-backend capability gaps and their reason text; `docs/tool-support.md` is generated from it. `vice_diagnose` / `vice_recycle` are synthetic proxy-local tools registered on **both** backends and appear in neither raw manifest.
- The `anno_*` family (19 tools, `src/mcp/vice/anno-tools.ts`) is registered through `buildViceTool()` and never appears in either manifest JSON.

**Build/TS config:**
- `src/mcp/vice/tsconfig.json` - typecheck-only: `target: es2022`, `module`/`moduleResolution: nodenext`, `strict`, `isolatedModules`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noEmit`, `allowImportingTsExtensions`, `types: ["node"]`, `skipLibCheck`.
- `src/mcp/vice/tsconfig.build.json` - `noEmit: false`, `outDir: resources`, `allowImportingTsExtensions: false`; the eight-file include list for `build.ts`.

**Environment variables (server behavior):**
- Transport / endpoint: `VICE_MCP_URL`, `VICE_MCP_HOST`, `VICE_MCP_TIMEOUT_MS`, `VICE_PROBE_TIMEOUT_MS`, `VICE_MAX_RESULT_CHARS`.
- Backend selection: `VICE_BACKEND` (read **only** by `backend-detect.mts`), `VICE_BIN`, `VICE_ARGS`, `VICE_API_VERSION`.
- Broker/pool: `VICE_BROKER_STALE_MS`, `VICE_BROKER_ACQUIRE_TIMEOUT_MS`, `VICE_BROKER_RECYCLE_TIMEOUT_MS`, `VICE_BROKER_CONTROL_HOST`, `VICE_BROKER_CONTROL_DIAL_HOST`, `VICE_BROKER_CONTROL_PORT`, `VICE_BROKER_BASE_PORT`, `VICE_BROKER_MAX`, `VICE_BROKER_SPARES`, `VICE_BROKER_WARM_FLOOR`, `VICE_BROKER_HEARTBEAT_MS`, `VICE_BROKER_POLL_MS`, `VICE_BROKER_KILL_WAIT_S`, `VICE_BROKER_PROBE_TIMEOUT_S`, `VICE_BROKER_BINMON_HOST`, `VICE_BROKER_MCP_HOST`.
- Supervision/recovery: `VICE_MAX_RESTARTS`, `VICE_CRASH_WINDOW_S`, `VICE_RESTART_BACKOFF_S`, `VICE_RESTART_BACKOFF_MAX_S`, `VICE_RECYCLE_CAPTURE_TIMEOUT_MS`, `VICE_INCIDENTS_DIR`.
- State paths: `VICE_POOL_DIR`, `VICE_EPOCH_FILE`, `VICE_SUPERVISOR_DIR`, `VICE_SUPERVISOR_ALLOW_CONTAINER`, `VICE_DIR`, `VICE_TOOLS_MANIFEST`, `VICE_SKIP_RESOURCE_INSTALL`.
- Stock diagnostics: `VICE_STOCK_DIAGNOSE_BRACKET_MS`, `VICE_STOCK_DIAGNOSE_SESSION_TIMEOUT_MS`.
- Annotation store: `ANNO_READ_REGION_MAX_BYTES`, `ANNO_DERIVE_MAX_IMAGE_BYTES`, `ANNO_SEARCH_MAX_CORPUS_BYTES`, `ANNO_MAX_BATCH_DEPTH`.
- Test gates (never read in production paths): `VICE_LIVE_FORK_BIN`, `VICE_LIVE_STOCK_BIN`, `VICE_LIVE_STOCK_BIN_39`, `VICE_LIVE_STOCK_BIN_310`, `VICE_LIVE_BROKER_BIN`, `VICE_LIVE_TRIAGE_BIN`, `VICE_LIVE_A4_FLOOD_BIN`, `VICE_REQUIRE_ACME`, `VICE_REQUIRE_ANNO`, `VICE_REQUIRE_ANNO_UPSTREAM`.
- Claude Code-provided: `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`.
- Path translation: `CONTAINER_WORKSPACE_PATH`, `HOST_WORKSPACE_PATH`.
- Mastra: `MASTRA_TELEMETRY_DISABLED`.
- `.env` files: **none** in the repository.

**Packaging:**
- `scripts/package.sh` - builds the installable plugin release zip (used by CI).
- `scripts/check-npm-packages.mjs` - validates, via `npm pack --dry-run --json`, that both published tarballs contain exactly the right files (no `node_modules/`, no test files, no fixtures leaked; skills present) and walks the transitive import closure of `files[]`.
- `installer/scripts/sync-skills.mjs` - generates `installer/skills/` from the canonical `src/skills/` on `prepack`.
- `skills-lock.json` (repo root) - pins externally sourced Claude skills by content hash (currently one entry: `mastra` from `mastra-ai/skills`).
- `VERSION` (repo root) - version marker; published package versions are `0.0.0-dev` in-tree and rewritten at release.

## Platform Requirements

**Development:**
- Node.js **>= 24** to run/test the MCP server; Node >= 18 to run the installer.
- ACME cross-assembler on `$PATH` for the `acme-build` skill and the CI round-trip gate.
- A reachable host VICE (`x64sc`, either fork or stock) for any live emulator interaction — the MCP server has no in-process emulator.
- Container awareness baked in: `isInsideContainer()` (`src/mcp/vice/container-guard.mts`, five signals) decides between `host.docker.internal` and `127.0.0.1`. This repo itself is developed on the host, not in a devcontainer.

**Production / Distribution:**
- Published to the public npm registry as `@henols/vice-mcp` and `@henols/c64-re-tools`, installed via `npx` into consumer projects, or as a Claude Code plugin via `/plugin marketplace add`.
- CI: GitHub Actions (`.github/workflows/ci.yml`) on **`node-version: "24"`** — typecheck, ACME install + scaffold assembly, skills-tree generation, test, smoke-test, installer tests, skill-script tests, `check-npm-packages.mjs` validation, `scripts/package.sh` build, GitHub Release on `v*` tags, and npm publishing via OIDC Trusted Publishing (no `NPM_TOKEN` secret required; `check-npm-token.yml` is a manual diagnostic only).
- Every merge to `main` auto-publishes a new patch version (unless the commit subject contains `[skip release]`).

---

*Stack analysis: 2026-09-01*
