# c64-re-tools

<img src="assets/branding/c64-re-tools-transparent.svg" alt="C64 RE Tools" width="440">


Let an AI agent work on Commodore 64 programs. The agent drives a real VICE
emulator and runs ACME, DXA and Ghidra. Use it to build new C64 apps and games,
and to reverse engineer old ones.

It works with Claude Code, Codex, pi, opencode, Gemini, Copilot, Cursor and
Windsurf.

## What it can do

**Build new apps and games**

- Assemble 6510 source with ACME, with errors by file and line, and symbols.
- Load and run the program in VICE. Set breakpoints and watchpoints, step, and read the CPU history and the call stack.
- Read, write, search and compare memory, and disassemble it.
- Show the VIC-II, sprite, SID and CIA state, and capture the screen.
- Type on the keyboard and move the joystick.
- Count cycles, profile the code, and wait for a raster line.
- Run many steps in one go and keep screens, snapshots and coverage as files.
- Tell what any address or register value means on the C64.

**Reverse engineer existing programs**

- Read D64, D71, D81, G64, T64 and CRT images, list BASIC and find the SYS address.
- Find packers and capture the unpacked program from the emulator.
- Analyse the code with DXA and Ghidra. The toolkit brings its own NMOS 6510 language for Ghidra, with all 256 opcodes.
- Keep names, regions and comments as text in the project, ready for git.
- Compare releases, and find routines that several programs share.
- Generate ACME source that rebuilds the program byte for byte, and its documentation.
- Test that a rebuild behaves as the original: PASS, FAIL or INCONCLUSIVE.

## How it works

VICE and the Host Runtime run on your computer, where VICE can open a window.
The agent runs in your project, preferably in a dev container. It reaches VICE
through an MCP server, and it runs ACME, DXA and Ghidra through its skills.

## Install

You need Node.js 24 or newer and VICE 3.9 or later (`x64sc`, `c1541`, `petcat`)
with its ROM files on the host. Use the latest VICE release.

Start the Host Runtime on the host, and leave it running:

```
npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host
```

`--log-console` prints each call, and `--log-dir <directory>` writes them to a file.

### Dev container

This is the preferred way. The container gets Node.js 24, ACME, dxa, Java 21, Ghidra and c64run.
At each start it installs the newest toolkit of the channel into the project,
with the tools of that version, so the tools and the skills always match. Add to `.devcontainer/devcontainer.json`:

```json
"features": {
  "https://github.com/henols/c64-re-tools/releases/latest/download/devcontainer-feature-c64-re-tools.tgz": { "target": "claude" }
},
"runArgs": ["--add-host=host.docker.internal:host-gateway"]
```

`target` is the harness, or a comma list such as `claude,codex`. The Feature
needs a Debian or Ubuntu image. `runArgs` is for Docker on Linux.

### Without a container

Install ACME, dxa, Ghidra and c64run as in [docs/install-tools.md](docs/install-tools.md).
Then, in your project:

```
npx -y @henols/c64-re-tools@latest install --target claude
```

`--target` is `claude`, `codex`, `pi`, `opencode`, `gemini`, `copilot`, `cursor`
or `windsurf`. Without it, `install` installs for all of them.

Check what works:

```
npx -y @henols/c64-re-tools@latest status
```

## Use it

Start the agent in the project, for example `claude`, and ask for what you want:

```
Write a game in ACME where a sprite moves with the joystick and the border
flashes when it hits the edge. Build it, run it, and show me the screen.

The music stops when the title screen starts. Find out why.

Reverse engineer original/game.d64. Find how it starts, unpack it if it is
packed, and name the main routines.

Find the routine that draws the score, and explain how it works.
```

The agent keeps what it learns about a program as text in
`.c64-re-tools/knowledge/`. Commit that folder with the project. If a command
reports conflicts after a `git pull`, run `knowledge.ts merge`.

Several programs in one repository: install once at the root and give each
program its own folder. A folder with `.c64-re-tools/` is a project.

## Skills

| Skill | Use |
| --- | --- |
| c64-assembler | Builds ACME source, with errors and symbols. |
| c64-emulator | Runs, debugs and observes the program in VICE. |
| c64-memory-map | What an address or a register value means. |
| c64-testing | Runs scenarios: original against rebuild, or many steps on one program. |
| c64-disk | Directory, BAM, entries, sector chains and extraction of disk images. |
| c64-basic | BASIC V2 listings and the SYS/USR handoff to machine code. |
| c64-unpacker | Packing evidence, and capture of the unpacked program. |
| c64-static-analysis | Analysis with DXA and Ghidra into the knowledge. |
| c64-knowledge | Symbols, regions, comments and references, with history. |
| c64-provenance | Compares releases, finds leftovers of the development and of cracks, and keeps a library of shared routines. |
| c64-source | ACME source from the knowledge, checked byte for byte. |
| c64-docs | Documentation of a program from its knowledge and source. |
| c64-reverse-engineering | Leads an investigation and picks the next skill. |

## Settings

| Variable | Meaning |
| --- | --- |
| `C64RT_VICE`, `C64RT_C1541`, `C64RT_PETCAT` | Full path of the VICE tool, when it is not on `PATH` (host). |
| `C64RT_ACME`, `C64RT_DXA`, `C64RT_C64RUN` | Full path of the tool, when it is not on `PATH`. |
| `C64RT_C64_ROMS` | The C64 ROM folder of c64run, when it is not `share/c64-re-tools/roms` next to its `bin`. |
| `C64RT_GHIDRA` | The Ghidra installation directory, when `analyzeHeadless` is not on `PATH`. |
| `C64RT_HOST` | `host:port` of the Host Runtime, when it is not on 127.0.0.1, `host.docker.internal` or `host.containers.internal` at port 6464. |
| `C64RT_VIDEO` | `pal` (default) or `ntsc`. |
| `C64RT_TRACE` | A directory for a trace of a run. See [docs/debug-install.md](docs/debug-install.md). |

## Developing

To work on the toolkit itself you need Node 24 or newer and pnpm.

```
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm host          # the Host Runtime from this checkout
```

Tests that need real tools are skipped unless you turn them on:

```
C64RT_LIVE_VICE=/usr/bin/x64sc C64RT_GHIDRA=/opt/ghidra pnpm test
```

To release, see [docs/releasing.md](docs/releasing.md).

## License

MIT. See [LICENSE](LICENSE).
