# c64-re-tools

An agent-friendly Commodore 64 engineering toolkit for reverse engineering
unknown applications and for developing, debugging, building and testing new
C64 applications.

## Status: ground-up rewrite

The project is being rebuilt from scratch. The design is frozen in
[`docs/redesign/`](docs/redesign/README.md); start at its README.
[`19-implementation-plan.md`](docs/redesign/19-implementation-plan.md) lists the
milestones, and [`docs/plan.md`](docs/plan.md) tracks the steps. Milestone 1 is
in place: the MCP reads C64 memory, registers and run state from a real VICE
started by the Host Runtime.

The previous implementation (the `vice` MCP server published as
`@henols/vice-mcp`, its broker, and twelve `c64-*` skills) has been removed from
`main`. Nothing from it carries forward.

Architecture in one line: one MCP process owns one VICE instance and is
VICE-only; a Host Runtime on the graphical host owns VICE and the native tools
(ACME, DXA, Ghidra, c1541, petcat); skill scripts call the Host Runtime for
native tools and keep project knowledge local in `.c64-re-tools/knowledge.db`.

## Prerequisites

- **Node.js ≥ 24.**
- **Stock upstream VICE** (`x64sc`, `c1541`, `petcat`) on the graphical host.
  The toolkit drives VICE's binary monitor and does not bundle an emulator.
- ACME, DXA and Ghidra for the milestones that use them.

The toolkit never installs a native tool for you. It detects a missing tool,
refuses by name, and gives the remedy.

### Installing VICE

Checked against each ecosystem on 2026-08-18:

| Ecosystem | Platforms | Install command |
| --- | --- | --- |
| Debian trixie / forky | Linux | `sudo apt install vice` (enable the `contrib` component first) |
| Ubuntu 25.10 | Linux | `sudo apt install vice` (enable `multiverse` first) |
| Arch | Linux | `sudo pacman -S vice` |
| Fedora | Linux | enable RPM Fusion Non-Free, then `sudo dnf install vice` |
| Alpine edge | Linux | enable `edge/testing`, then `apk add vice` |
| Homebrew | Linux, macOS | `brew install vice` |
| Windows | Windows | download the official GTK3/SDL2 win64 zip |

Flatpak and Snap builds are unverified: their sandboxing may block the binary
monitor on `127.0.0.1`.

The Host Runtime runs drive 8 as a 1541, so VICE needs the 1541 DOS ROM
(`dos1541-325302-01+901229-05.bin`) besides the C64 KERNAL, BASIC and
character ROMs.

Only one process can hold a stock VICE binary monitor. A second connection gets
no reply and no EOF, which looks like a hang. Close any stray `nc` session,
second agent session or `-remotemonitor` user before you suspect a wedge.

## Running

Start the Host Runtime on the graphical host and leave it in the foreground:

```
c64-re-tools-host          # listens on 127.0.0.1:6464; Ctrl+C stops it and every emulator
```

Then register `c64-re-tools-mcp` as a stdio MCP server in the agent harness.
Each MCP process gets its own emulator, which stops when the MCP process ends.

| Variable | Read by | Meaning |
| --- | --- | --- |
| `C64RT_VICE` | host | Full path of `x64sc` when it is not on `PATH`. |
| `C64RT_HOST` | MCP | `host:port` of the Host Runtime when it is not on 127.0.0.1, `host.docker.internal` or `host.containers.internal` at 6464. |
| `C64RT_VIDEO` | MCP | `pal` (default) or `ntsc`, fixed for the life of the MCP process. |

## Developing

Node ≥ 24 and pnpm are required; install pnpm yourself (for example
`corepack enable pnpm`). `packageManager` in `package.json` pins its version.

```
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build         # tsc -p tsconfig.build.json -> dist/
pnpm test          # build, then node --test on src/**/*.test.ts and test/**/*.test.ts
```

Unit tests sit beside their source as `src/**/*.test.ts`; `test/` holds
integration and end-to-end tests. Node runs the TypeScript directly (type
stripping), so relative imports name the `.ts` file.

Tests against a real emulator are opt-in. Without the variable they are
reported as skipped, never as passed:

```
C64RT_LIVE_VICE=/usr/bin/x64sc pnpm test
```

The package exposes three executables: `c64-re-tools`, `c64-re-tools-mcp` and
`c64-re-tools-host`. The target source layout is
[`18-repository-structure.md`](docs/redesign/18-repository-structure.md).

## Layout

```
src/                 # the rewrite (flat by ownership: mcp, host, host-client, knowledge, cli), unit tests beside source
test/                # fixtures, integration and end-to-end tests
docs/redesign/       # the frozen design
.claude-plugin/      # plugin and marketplace manifests
```

## License

MIT. See [`LICENSE`](./LICENSE).
