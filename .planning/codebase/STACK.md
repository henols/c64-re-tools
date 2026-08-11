# Technology Stack

**Analysis Date:** 2026-08-11

## Project Type

This is **not** a web/backend application. It is a **Claude Code plugin** (`.claude-plugin/plugin.json`) distributed two ways:

1. As a Claude Code plugin marketplace entry (`.claude-plugin/marketplace.json`).
2. As two published npm packages (`@henols/vice-mcp`, `@henols/c64-re-tools`) installable via `npx` into any project.

It bundles an MCP (Model Context Protocol) stdio server that drives a host-side VICE Commodore 64 emulator, plus six Claude Code "skills" for 6502/6510 reverse-engineering and rebuilding.

## Languages

**Primary:**
- TypeScript (ES2022, NodeNext modules) - MCP server implementation, `.claude/mcp/vice/*.ts` and `*.mts`
- JavaScript (ESM, `.mjs`) - installer CLI (`installer/bin/cli.mjs`), skill scripts (`.claude/skills/*/scripts/*.mjs`), compiled host launcher resources (`.claude/mcp/vice/resources/*.mjs`)

**Secondary:**
- Bash - host launcher script (`.claude/mcp/vice/resources/vice-launcher.sh`), release/packaging scripts (`scripts/package.sh`, `scripts/ensure-mcp-deps.sh`)
- 6502/6510 assembly (ACME dialect) - skill scaffolds/templates, e.g. `.claude/skills/acme-build/template.a`
- Markdown - all skill documentation (`SKILL.md` files), project docs (`docs/`, `README.md`)

## Runtime

**Environment:**
- Node.js. The MCP server (`@henols/vice-mcp`) requires **Node >= 22.18** (or >= 23.6) because it runs TypeScript directly via Node's native type-stripping (no build/transpile step at runtime). See `engines` in `.claude/mcp/vice/package.json:29`.
- The installer package (`@henols/c64-re-tools`) only requires **Node >= 18** (`installer/package.json:11`) since it is plain `.mjs`.
- `type: "module"` (ESM) throughout — both packages and all skill scripts.

**Package Manager:**
- npm. Lockfiles present: `.claude/mcp/vice/package-lock.json` (committed). The `installer/` package has no committed lockfile.
- `node_modules/` for the MCP server is **never committed** (`.gitignore`); it is provisioned on first use by a `SessionStart` hook (`scripts/ensure-mcp-deps.sh`), which gates `npm ci` behind a sha256 hash of the lockfile so normal session starts are a no-op.

## Frameworks / Key Runtime Dependencies

**MCP protocol:**
- `@mastra/mcp` `1.15.0` - MCP server/tooling framework (`.claude/mcp/vice/package.json:64`)
- `@mastra/core` `1.55.0` - underlying Mastra runtime the MCP package depends on
- `@modelcontextprotocol/sdk` `1.30.0` (transitive, via `@mastra/mcp`) - the official MCP TypeScript SDK
- `MASTRA_TELEMETRY_DISABLED=1` is set everywhere the server is launched (`.mcp.json`, installer-generated `.mcp.json` entries) to disable Mastra's own telemetry.

**Testing:**
- Node's built-in test runner (`node --test`), no separate test framework. Run via `npm test` in `.claude/mcp/vice` (`package.json:58`: `node --test '*.test.*'`).
- Test files are colocated `*.test.ts` / `*.test.mts` next to the module under test (e.g. `vice.ts` / no direct test file shown, but `vice-broker.mts` / `vice-broker.test.ts` pattern... see `.claude/mcp/vice/*.test.ts`).

**Build/Dev:**
- TypeScript `7.0.2` (devDependency, typecheck-only — `tsc --noEmit`); no emitted `.js` from the TS sources at runtime (Node type-stripping runs the `.ts`/`.mts` files directly).
- `.claude/mcp/vice/build.ts` - a custom build step that compiles the host-bound `.mts` launcher modules (`broker-control.mts`, `broker-epoch.mts`, `broker-kill.mts`, `broker-launch.mts`, `broker-state.mts`, `container-guard.mts`, `vice-broker.mts`) into plain `.mjs` files under `resources/`, since the **host** side (outside any container) cannot rely on Node's type-stripping the same way.
- `@types/node` `24.13.3` - Node type definitions for the TypeScript build.
- ACME cross-assembler (external, not an npm package) - required on `$PATH` for the `acme-build` skill; the skill probes `$ACME`, `/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme` (`.claude/skills/acme-build/SKILL.md:181-186`). Verified locally against ACME release 0.97 "Zem".

## Key Dependencies (transitive, via package-lock.json)

**Notable transitive packages pulled in by `@mastra/mcp` / `@mastra/core`:**
- `@a2a-js/sdk` `0.3.14`
- `@ai-sdk/provider` (multiple versions: `2.0.3`, `3.0.14`, `4.0.3`) and `@ai-sdk/provider-utils` (`3.0.30`, `4.0.40`, `5.0.11`) - AI SDK provider abstractions Mastra depends on
- `@hono/node-server` `2.1.0` - HTTP server (Hono framework) used internally by Mastra
- `@posthog/core` / `@posthog/types` - analytics client code inside Mastra (disabled via `MASTRA_TELEMETRY_DISABLED`)
- `@modelcontextprotocol/ext-apps` `1.7.5`
- `@isaacs/ttlcache`, `@lukeed/csprng`, `@lukeed/uuid`, `@sindresorhus/slugify` / `transliterate` - small utility libs

**Critical (project-authored, not npm):**
- `x64sc` - a **custom/patched build** of the VICE emulator that exposes a non-upstream `-mcpserver` flag (`-mcpserver -mcpserverhost <ip> -mcpserverport <port>`) serving HTTP JSON-RPC at `/mcp`. This is the load-bearing external dependency the whole `vice` MCP tool surface is built on. See `docs/roadmap-stock-vice.md` for a documented plan to migrate off this custom build onto stock VICE's binary monitor protocol (`-binarymonitor`).

## Configuration

**MCP server wiring:**
- `.mcp.json` (repo root) - declares the `vice` MCP server, launched via `node ${CLAUDE_PLUGIN_ROOT}/.claude/mcp/vice/vice-proxy.ts`, `timeout: 150000`, `env.MASTRA_TELEMETRY_DISABLED=1`.
- `.claude-plugin/plugin.json` - plugin manifest: points at `./.claude/skills/` and `./.mcp.json`, registers a `SessionStart` hook running `scripts/ensure-mcp-deps.sh`, `defaultEnabled: false`.
- `.claude-plugin/marketplace.json` - single-plugin marketplace manifest so `/plugin marketplace add` works directly against this repo.

**Build/TS config:**
- `.claude/mcp/vice/tsconfig.json` - typecheck-only config: `target: es2022`, `module`/`moduleResolution: nodenext`, `strict: true`, `isolatedModules`, `verbatimModuleSyntax`, `noEmit: true`, `allowImportingTsExtensions: true`.
- `.claude/mcp/vice/tsconfig.build.json` - separate config used by `build.ts` to compile the host-bound `.mts` launchers into `resources/*.mjs`.

**Environment variables (server behavior):**
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

**Packaging:**
- `scripts/package.sh` - builds the installable plugin release zip (used by CI).
- `scripts/check-npm-packages.mjs` - validates, via `npm pack --dry-run --json`, that both published tarballs (`@henols/vice-mcp`, `@henols/c64-re-tools`) contain exactly the right files (no `node_modules/`, no test files, no fixtures leaked; skills present).

## Platform Requirements

**Development:**
- Node.js >= 22.18 (or >= 23.6) to run/test the MCP server; Node >= 18 to run the installer.
- ACME cross-assembler on `$PATH` for the `acme-build` skill.
- A reachable host running VICE (`x64sc`, custom `-mcpserver` build) for any live emulator interaction — the MCP server itself has no in-process emulator.
- Docker/devcontainer awareness baked in: code checks `isInsideContainer()` (`.claude/mcp/vice/container-guard.mts`) to decide between `host.docker.internal` and `127.0.0.1` as the default VICE host.

**Production / Distribution:**
- Published to the public npm registry as `@henols/vice-mcp` and `@henols/c64-re-tools`, installed via `npx` into consumer projects, or as a Claude Code plugin via `/plugin marketplace add`.
- CI: GitHub Actions (`.github/workflows/ci.yml`) — typecheck, test, smoke-test, package validation, artifact build, GitHub Release creation on `v*` tags, and npm publishing via OIDC Trusted Publishing (no `NPM_TOKEN` secret required for release; a manual `check-npm-token.yml` workflow exists purely as a diagnostic).
- Every merge to `main` auto-publishes a new patch version (unless the commit subject contains `[skip release]`).

---

*Stack analysis: 2026-08-11*
