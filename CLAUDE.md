# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Branding assets are in [`assets/branding/`](assets/branding/README.md). The README and human-facing docs use the compact transparent logo; keep skill instructions and test prompts free of decorative branding.

**c64-re-tools** — an agent-friendly Commodore 64 engineering toolkit for
reverse engineering unknown applications and for developing, debugging,
building and testing new C64 applications.

**Core value:** a Claude session can reliably drive a real C64 emulator —
read and write memory, set checkpoints, inspect chip state — and keep working
when the emulator misbehaves.

## Status

Released as 2.0.0. `.github/README.md` is the user documentation (GitHub shows it on the repository page). It stays out of the npm package: the agent side gets only skills and tools, never the README. Do not add design
documents, plans or decision numbers to the repository.

Architecture in one line: one MCP process owns one VICE instance and is
VICE-only; a Host Runtime on the graphical host owns VICE and the tools that
come with it (c1541, petcat); skill scripts call the Host Runtime for those,
run ACME, DXA and Exomizer themselves and Ghidra in process (a committed WebAssembly
build of a Rust port, from `native/sleigh/`, as base64 in a `.ts` file), and keep project knowledge local as
text in `.c64-re-tools/knowledge/`, with a SQLite index in `local/`.

## Commands

Node ≥ 24 and pnpm (installed by hand; `packageManager` pins the version) are required.

```
pnpm install --frozen-lockfile
pnpm typecheck   # tsc over src/, skills/, distribution/ and test/; nothing is emitted
pnpm test        # node --test "src/**/*.test.ts" "test/**/*.test.ts"
pnpm host        # the Host Runtime from this checkout, in the foreground
                 # --log-console / --log-dir <dir>: log each request and tool run (off by default)
```

- Release by tag only: `git tag v2.0.0-rc.2 && git push origin v2.0.0-rc.2` (prerelease, npm `next`) or `v2.0.0` (release, `latest`). The tag gives the version; the repo keeps `0.0.0-development`. Never bump the version in a commit.
- CI on push runs on ubuntu-latest only. A tag tests nothing again: it needs a passed CI run of a push to main for the tagged commit. Platforms (macOS, Windows), Dev container Feature and Live run only when started by hand (`gh workflow run <name>`); never run OS-specific tests automatically.
- The dev container Feature has its own version in `devcontainer-feature.json`; change it only with its files. The release tars it to the same bytes each time, so a project's `devcontainer-lock.json` digest stays valid.

- Unit tests sit beside source (`src/**/*.test.ts`); `test/` is for integration/e2e.
  Node runs `.ts` by type stripping, so relative imports end in `.ts` and only
  erasable syntax is allowed (no enums, namespaces or parameter properties).

- `node --test` exits 0 for a missing or typo'd file; `ls` it first.
- Don't pipe `pnpm test` into `tail`/`head`: that reports the pipe's exit code.
- Live suites: `C64RT_LIVE_VICE=/usr/bin/x64sc`; every VICE runs headless. The
  c64_window tests open real windows and also need `C64RT_LIVE_WINDOW=1`.
- Real VICE is `/usr/bin/x64sc`, by absolute path. `-default` must precede
  `-binarymonitor`, and autostart needs `-autostartprgmode 1`.
- `/tmp` is a RAM tmpfs here; tests that leak scratch dirs fill it.

## Conventions that bite

- **TypeScript only.** No `.js`/`.mjs` anywhere, also not installed: nothing is built at install or release, there is no `dist/`. The one exception is the Rust in `native/sleigh/`, whose WebAssembly is committed as `src/native/ghidra/c64rt-wasm.ts`. Users run everything through `npx -y @henols/c64-re-tools@latest` (the MCP declaration too), so it updates itself; never link (`npm link`, `npm install -g <dir>`). Node never strips types under `node_modules`, so the bins are `.ts` with a `#!/usr/bin/env tsx` shebang, and every spawn of node on our own `.ts` passes `process.execArgv`. Skill scripts import `src/` as `#src/...`. npx exits on SIGTERM without passing it on: signal the process group.
- The Host Runtime runs only VICE, c1541 and petcat. Skill scripts run ACME, DXA and Exomizer through `src/native/` (supervisor, staging, bounded `runTool`); never a bare `spawnSync`. Ghidra is `src/native/ghidra/c64rt-wasm.ts` (WebAssembly as base64: skills install as text), built by hand with `native/sleigh/build.sh` (Rust, a patched crates.io crate) and committed; rebuild it only when `native/sleigh/` or the language changes, and compile `c64rt_6510.sla` from the `.slaspec` with Ghidra's `support/sleigh`. The toolkit never installs external tools: it detects them, refuses by name and prints the remedy. The one installer is the dev container Feature: at image build and at each start it installs the tools in `tools/` of the toolkit version that it puts into the project.
- The host refuses to start unless VICE starts (ROMs present); the host is started by hand only.
- Tools take client paths and stream bytes; never a fixed file list or a path over the socket.
- Stopping the Host Runtime or a skill script must stop every emulator, tool and descendant it started.
- Every date and time the code writes is ISO 8601 in CET at a fixed `+01:00`; never `toISOString()` (UTC) or a local-time format.
- Skill docs (`SKILL.md`, references, descriptions) are written in ASD-STE100 (use the `asd-ste100` skill).
- Don't put `\u0000`, backticks or `\b` in Write/Edit params or `node -e` edit scripts — they land as raw bytes or shell commands; use a scratch `.ts` file.
