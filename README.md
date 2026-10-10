# c64-re-tools

An agent-friendly Commodore 64 engineering toolkit for reverse engineering
unknown applications and for developing, debugging, building and testing new
C64 applications.

An agent drives a real VICE emulator through an MCP server, and uses skills
for the rest: disk images, BASIC, static analysis with DXA and Ghidra, a project
knowledge database, the ACME assembler, unpacking, release comparison and
functional-equivalence tests.

Architecture in one line: one MCP process owns one VICE instance and is
VICE-only; a Host Runtime on the graphical host owns VICE and the tools that
come with it (c1541, petcat); skill scripts call the Host Runtime for those,
run ACME, DXA and Ghidra themselves, and keep project knowledge local in
`.c64-re-tools/knowledge.db`.
The design is in [`docs/redesign/`](docs/redesign/README.md), and
[`docs/plan.md`](docs/plan.md) tracks the implementation.

## Install and start

Requirements:

- Node.js 24 or newer with npx.
- On the machine with VICE: VICE 3.9 or later (`x64sc`, `c1541`, `petcat`) with its ROM files.
- Where the agent runs: ACME, DXA and Ghidra, for the skills that use them.

Everything runs through npx. Nothing is installed globally.

### Release or prerelease

| Channel | Version |
| --- | --- |
| `latest` | The current release. |
| `next` | The current prerelease, for example `2.0.0-rc.1`. |

Until 2.0.0 is released, `latest` is the old 1.1.0. Use `next` until then. In the commands below, replace `<channel>` with `latest` or `next`. Use the same channel on both machines.

### On one machine

Start the Host Runtime in its own terminal. Ctrl+C stops it and every emulator:

```
npx -y --package=@henols/c64-re-tools@<channel> c64-re-tools-host
```

Install into the project, check it, and start the agent:

```
cd my-c64-project
npx -y @henols/c64-re-tools@<channel> install --target claude
npx -y @henols/c64-re-tools@<channel> status
claude
```

### In a dev container

On the host, start the Host Runtime on the container bridge with a shared secret:

```
export C64RT_HOST_TOKEN=$(openssl rand -hex 16)
npx -y --package=@henols/c64-re-tools@<channel> c64-re-tools-host --listen 172.17.0.1
```

In the container, set the same `C64RT_HOST_TOKEN`, then:

```
npx -y @henols/c64-re-tools@<channel> install --target claude
npx -y @henols/c64-re-tools@<channel> status
claude
```

The container reaches the host as `host.docker.internal`. `status` must show the Host Runtime as reachable.

### Update and remove

```
npx -y @henols/c64-re-tools@<channel> update      # the newest skills into the project
npx -y @henols/c64-re-tools@<channel> uninstall
```

Restart the Host Runtime after a new release. `--global` installs into your home directory.

### Debugging

See [docs/debugging.md](docs/debugging.md) for the trace and the field test.

### Settings

| Variable | Read by | Meaning |
| --- | --- | --- |
| `C64RT_VICE` | host | Full path of `x64sc` when it is not on `PATH`. |
| `C64RT_C1541`, `C64RT_PETCAT` | host | Full path of the tool when it is not on `PATH`. |
| `C64RT_ACME`, `C64RT_DXA` | skills, CLI | Full path of the tool when it is not on `PATH`. |
| `C64RT_GHIDRA` | skills, CLI | The Ghidra installation directory, when `analyzeHeadless` is not on `PATH`. |
| `C64RT_HOST` | MCP, skills, CLI | `host:port` of the Host Runtime when it is not on 127.0.0.1, `host.docker.internal` or `host.containers.internal` at 6464. |
| `C64RT_HOST_TOKEN` | host, MCP, skills, CLI | The shared secret for a Host Runtime that listens beyond loopback. |
| `C64RT_VIDEO` | MCP | `pal` (default) or `ntsc`, fixed for the life of the MCP process. |
| `C64RT_TRACE` | host, MCP, skills, CLI | A directory for a trace of what the programs do, for a person who debugs a run. See [docs/debugging.md](docs/debugging.md). Nothing of the trace reaches the agent. |

Ghidra runs with its own settings directory for each request. The toolkit
brings its own NMOS 6510 language (all 256 opcodes); your Ghidra installation
and settings stay unchanged.

## Use it with an agent

1. Install for your harness: `--target claude`, `codex`, `pi`, `opencode`, `gemini`, `copilot`, `cursor` or `windsurf`. Without `--target`, `install` installs for all of them.
2. Start the Host Runtime and leave it running.
3. Start the harness in the project, for example `claude` or `codex`, or open the project in Cursor or Windsurf. The harness starts the MCP server and finds the skills by itself.
4. Ask for the result you want, in plain words. The agent picks the skills and the `c64_*` tools.

Examples:

```
Reverse engineer original/game.d64. Find how it starts, unpack it if it is packed,
and name the main routines in project knowledge.

Find the routine that draws the score, and explain how it works.

Write a program in ACME that scrolls a text at the bottom of the screen.
Build it, run it in the emulator, and write a test for it.

Show me the emulator window.
```

The agent keeps what it learns about the program in `.c64-re-tools/knowledge.db`. Commit that file with the project.

## Skills

| Skill | Use |
| --- | --- |
| c64-reverse-engineering | Coordinates an investigation and picks the specialist for the next unknown. |
| c64-emulator | Runs and observes the program in VICE through the MCP tools. |
| c64-static-analysis | A fast first pass with DXA and a deeper pass with Ghidra into knowledge, with seeds from knowledge and decompilation. |
| c64-knowledge | Reads and writes symbols, regions, comments and references, with history. |
| c64-disk | Directory, BAM, entries, sector chains and extraction of disk images. |
| c64-basic | BASIC V2 listings and the SYS/USR handoff to machine code. |
| c64-unpacker | Packing evidence, and capture of the unpacked program from the emulator. |
| c64-memory-map | Platform meaning of addresses and register values. |
| c64-provenance | Byte comparison of releases. |
| c64-assembler | ACME builds with diagnostics and symbols. |
| c64-testing | Original-against-rebuild scenarios with PASS, FAIL or INCONCLUSIVE. |

## Examples

Reverse engineering, from an unknown disk to a verified rebuild (the commands
that the skills run for the agent; `<skills>` is the installed skills
directory):

```
node <skills>/c64-disk/scripts/disk.ts directory original/game.d64
node <skills>/c64-disk/scripts/disk.ts read original/game.d64 GAME --out extracted/game.prg
node <skills>/c64-basic/scripts/basic.ts extracted/game.prg                  # the SYS address, e.g. $080d
node <skills>/c64-unpacker/scripts/unpack.ts inspect extracted/game.prg
node <skills>/c64-static-analysis/scripts/analyze.ts extracted/game.prg --analyzer dxa --listing analysis/game.lst
node <skills>/c64-static-analysis/scripts/analyze.ts extracted/game.prg --entry '$080d'
node <skills>/c64-knowledge/scripts/knowledge.ts rename '$080d' main --kind routine --reason 'entry from BASIC'
node <skills>/c64-static-analysis/scripts/analyze.ts extracted/game.prg --entry '$080d' --decompile '$080d'
node <skills>/c64-assembler/scripts/assemble.ts --source-root src --entry game.a --out build/game.prg > build/game.json
node <skills>/c64-testing/scripts/test.ts tests/counts.json                   # PASS, FAIL or INCONCLUSIVE
```

Development: build with the c64-assembler skill, then load and debug with the
MCP tools (`c64_program_load`, `c64_breakpoint`, `c64_run_until`,
`c64_memory_read`, `c64_screen`), and test with the c64-testing skill.

## Developing

To work on the toolkit itself, Node 24 or newer and pnpm are required; install pnpm yourself (for example
`corepack enable pnpm`). `packageManager` in `package.json` pins its version.

```
pnpm install --frozen-lockfile
pnpm typecheck     # tsc checks everything; it emits nothing
pnpm test          # node --test on src/**/*.test.ts and test/**/*.test.ts
```

Unit tests sit beside their source as `src/**/*.test.ts`; `test/` holds
integration and end-to-end tests. Node runs the TypeScript directly (type
stripping), so relative imports name the `.ts` file. Skill scripts import
`src/` as `#src/...` (the `imports` map in `package.json`); an installed skill
gets the `src/` modules it reaches and its own `package.json` with that map.

Tests that need real tools are opt-in. Without them they are reported as
skipped, never as passed:

```
C64RT_LIVE_VICE=/usr/bin/x64sc C64RT_GHIDRA=/opt/ghidra pnpm test
```

ACME, DXA, c1541 and petcat tests run when the tools are on `PATH`.

## Layout

```
src/             # mcp, host, host-client, native, knowledge, cli; unit tests beside the source
skills/          # the skills: SKILL.md, scripts (TypeScript) and references
distribution/    # the AP SDK plugin definition: skills with the src/ modules they reach
test/            # fixtures, integration and end-to-end tests
docs/redesign/   # the design
```

## License

MIT. See [`LICENSE`](./LICENSE).
