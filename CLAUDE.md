# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**c64-re-tools**

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects. It ships an MCP server, a
broker and reverse-engineering skills. The skills install with the `skills`
CLI (`npx skills add henols/c64-re-tools`) straight from this repo; the MCP server
and broker ship as the npm package `@henols/vice-mcp` and in the Claude Code plugin.

**Core Value:** A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

## Two codebases live side by side

The repo is mid-transition. Know which one you are in before editing.

- **Legacy, shipping** — `src/mcp/vice/` (package `@henols/vice-mcp`), `skills/`,
  `test/vice/`. Roughly 77k lines of `.ts`/`.mts`: the broker (`broker-*`,
  `vice-broker.mts`), the MCP proxy (`vice-proxy.ts`), VICE monitor clients
  (`stock-*` binary monitor, `text-*`/`textmon-*` text monitor), the host tool
  runner (`host-tool*.mts`), and the annotation store (`anno-*`, SQLite via
  `node:sqlite`). `src/mcp/vice/README.md` documents it.
- **Greenfield rewrite, scaffold only** — root `src/` (`c64.ts`, `project.ts`,
  `protocol.ts`, and stub `cli/`, `mcp/main.ts`, `host/`), built by the root
  `tsconfig.json`, which lists its entry files explicitly and so never compiles
  `src/mcp/vice/`. The design is frozen in `docs/redesign/` (start at its
  `README.md`; `18-repository-structure.md` is the target layout and
  `19-implementation-plan.md` the milestones). The redesign is not required to
  keep the legacy module boundaries, tool names, DB schema or broker protocol;
  legacy code is evidence to mine (`10-current-code-reuse.md`), not a template.

Rewrite architecture in one line: one MCP process owns one VICE instance and is
VICE-only; a Host Runtime on the graphical host owns VICE and all native tools
(ACME, DXA, Ghidra, c1541, petcat); skill scripts call the Host Runtime for
native tools and keep project knowledge local in `.c64-re-tools/knowledge.db`.

## Commands

Node ≥ 24 is required; TypeScript runs directly through native type-stripping
(no build step) in the legacy package and skill scripts.

Root (rewrite scaffold):

```
npm run typecheck                                   # tsc --noEmit
npm run build                                       # tsc -> dist/
npm test                                            # build, then node --test test/scaffold/scaffold.test.mjs
```

Legacy server (run from `src/mcp/vice/`, after `npm ci` there; its `node_modules` is not committed):

```
npm run typecheck
npm test                                            # node --test over ../../../test/vice/*.test.{ts,mts}
node --test ../../../test/vice/<file>.test.ts       # one file; ls first, a typo'd name still exits 0
npm run test:automated                              # skips the MANUAL_ONLY_TESTS in test/vice/test-gate.ts
npm run test:manual
npm run build                                       # build.ts: host-bound .mjs resources + vice-cli.mjs
npm run smoke
```

- Compare the failing SET against a baseline, never the count. Don't pipe `npm test` into `tail`/`head`: that reports the pipe's exit code.
- Live suites need real VICE (`/usr/bin/x64sc`, absolute path) and are opt-in; run each alone under a timeout. They spawn their own broker; never leave one running.
- Tests leak large scratch dirs into `/tmp` (a RAM tmpfs here); expect it to fill.

## Conventions that bite

- **TypeScript only.** Never hand-write `.js`/`.mjs`. Code that must run where Node cannot strip types (under `node_modules`, host-bound) is `.mts` and compiled by `build.ts`; `resources/*.mjs`, `vice-cli.mjs` and `dist/` are generated output. (`test/scaffold/scaffold.test.mjs` is the one exception, for the root scaffold.)
- Binding rules live in `agent-os/standards/` (index in `index.yml`) — module headers, injectable deps, atomic state files, files travel as bytes, SKILL.md shape, refuse-never-guess. Skill specs under `agent-os/specs/`.
- Host tools (ACME, c1541, petcat, Ghidra, dxa) run on the host through the broker's container-out seam; never `spawnSync` an external binary from a skill script. Never auto-install external tools: detect, refuse by name, print the remedy.
- Tools take client paths and stream bytes; never a fixed file list or a path over the socket.
- `.c64-re-tools/` at an analysed project's root holds committed artifacts (`annotations.db`); `.c64-re-tools/local/` is machine-specific and self-ignored. In this repo the whole directory is gitignored.
- Skill docs (`SKILL.md`, references, descriptions) are written in ASD-STE100 (use the `asd-ste100` skill). Skills are single-capability; most call `c64-project`'s scripts.
- Some source files contain stray NUL bytes that make `grep` skip them (e.g. `anno-memmap-render.mts`, `anno-store-export.mts`); check with `readFileSync(f).indexOf(0)`.
- Don't put `\u0000`, backticks or `\b` in Write/Edit params or `node -e` edit scripts — they land as raw bytes or shell commands; use a scratch `.ts` file.

## Technology Stack

### Languages
- TypeScript (the only language for new code; see `agent-os/product/tech-stack.md`)
- Bash - host launcher script (`src/mcp/vice/resources/vice-launcher.sh`) and the dxa build script
- 6502/6510 assembly (ACME dialect) - skill scaffolds/templates, e.g. `skills/c64-assembler/template.a`
- Markdown - all skill documentation (`SKILL.md` files)

### Runtime
- Node.js ≥ 24 for the MCP server (`@henols/vice-mcp`) and for the skill scripts.

### Key runtime dependencies
- `@mastra/mcp` - MCP server/tooling framework
- `@mastra/core` - underlying Mastra runtime
- `@modelcontextprotocol/sdk` - MCP protocol types and client, imported directly by `vice-proxy.ts`
