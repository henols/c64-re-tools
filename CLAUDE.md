# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**c64-re-tools** — an agent-friendly Commodore 64 engineering toolkit for
reverse engineering unknown applications and for developing, debugging,
building and testing new C64 applications.

**Core value:** a Claude session can reliably drive a real C64 emulator —
read and write memory, set checkpoints, inspect chip state — and keep working
when the emulator misbehaves.

## Status: greenfield rewrite

The repo holds only the rewrite. The design is frozen in `docs/redesign/`
(start at its `README.md`; `18-repository-structure.md` is the target layout,
`19-implementation-plan.md` the milestones). `docs/plan.md` tracks the steps
and their status; work its first unchecked step. Do not pre-create empty files
to match the layout.

The old implementation (`@henols/vice-mcp`, the broker, twelve skills) was
deleted. Everything is built new from scratch; nothing from the old code is
mined, ported or kept for reference.

Architecture in one line: one MCP process owns one VICE instance and is
VICE-only; a Host Runtime on the graphical host owns VICE and the tools that
come with it (c1541, petcat); skill scripts call the Host Runtime for those,
run ACME, DXA and Ghidra themselves (D16), and keep project knowledge local in
`.c64-re-tools/knowledge.db`.

## Commands

Node ≥ 24 and pnpm (installed by hand; `packageManager` pins the version) are required.

```
pnpm install --frozen-lockfile
pnpm typecheck   # tsc over src/ and test/, tests included
pnpm build       # tsc -p tsconfig.build.json -> dist/, tests excluded
pnpm test        # build, then node --test "src/**/*.test.ts" "test/**/*.test.ts"
```

- Unit tests sit beside source (`src/**/*.test.ts`); `test/` is for integration/e2e.
  Node runs `.ts` by type stripping, so relative imports end in `.ts` and only
  erasable syntax is allowed (no enums, namespaces or parameter properties).

- `node --test` exits 0 for a missing or typo'd file; `ls` it first.
- Don't pipe `pnpm test` into `tail`/`head`: that reports the pipe's exit code.
- Real VICE is `/usr/bin/x64sc`, by absolute path. `-default` must precede
  `-binarymonitor`, and autostart needs `-autostartprgmode 1`.
- `/tmp` is a RAM tmpfs here; tests that leak scratch dirs fill it.

## Conventions that bite

- **TypeScript only.** Never hand-write `.js`/`.mjs`; JS exists only as build output in `dist/`.
- The Host Runtime runs only VICE, c1541 and petcat. Skill scripts run ACME, DXA and Ghidra through `src/native/` (supervisor, staging, bounded `runTool`); never a bare `spawnSync`. Never auto-install external tools: detect, refuse by name, print the remedy.
- The host refuses to start unless VICE starts (ROMs present); the host is started by hand only.
- Tools take client paths and stream bytes; never a fixed file list or a path over the socket.
- Stopping the Host Runtime or a skill script must stop every emulator, tool and descendant it started.
- Skill docs (`SKILL.md`, references, descriptions) are written in ASD-STE100 (use the `asd-ste100` skill).
- Don't put `\u0000`, backticks or `\b` in Write/Edit params or `node -e` edit scripts — they land as raw bytes or shell commands; use a scratch `.ts` file.
