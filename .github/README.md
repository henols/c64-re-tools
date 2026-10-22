# c64-re-tools

<img src="../assets/branding/c64-re-tools-transparent.svg" alt="C64 RE Tools" width="440">


Let an AI agent work on Commodore 64 programs. The agent drives a real VICE
emulator and runs ACME, DXA, Ghidra and Exomizer. Use it to build new C64 apps and games,
and to reverse engineer old ones.

It works with Claude Code, Codex, pi, opencode, Gemini, Copilot, Cursor and
Windsurf.

## What it can do

Ask for what you want in plain words. The agent picks the skill for each step.

**Build new apps and games**

- Assemble 6510 source with ACME, with errors by file and line, and symbols.
- Pack and crunch a program with Exomizer into one PRG that unpacks itself, checked byte for byte before it is written.
- Load and run the program in VICE. Set breakpoints and watchpoints, step, and read the CPU history and the call stack.
- Read, write, search and compare memory, and disassemble it.
- Show the VIC-II, sprite, SID and CIA state, and capture the screen.
- Type on the keyboard, press keys of the keyboard matrix (also several together, and RESTORE), and move the joystick.
- Count cycles, profile the code, and wait for a raster line.
- Run many steps in one go and keep screens, snapshots and coverage as files.
- Tell what any address or register value means on the C64.
- Add features and fixes to a program. Each change has a switch, so you can build the program with it or without it.
- Test a program with scenarios: steps with expected values that give PASS or FAIL.

**Reverse engineer existing programs**

- Read D64, D71, D81, G64, T64 and CRT images, list BASIC and find the SYS address.
- Find packers and capture the unpacked program from the emulator.
- Analyse the code with DXA and Ghidra. The toolkit brings Ghidra's decoder and decompiler with its own NMOS 6510 language, with all 256 opcodes: nothing to install.
- Keep names, regions and comments as text in the project, ready for git.
- Compare releases, and find routines that several programs share.
- Generate ACME source that rebuilds the program byte for byte, and its documentation.
- Test that a rebuild behaves as the original: PASS, FAIL or INCONCLUSIVE.
- Export a rebuild as the start of a new program: one value for each switch, unused code removed, as a zip file.

## How it works

VICE and the Host Runtime run on your computer, where VICE can open a window.
The agent runs in a dev container in your project. It reaches VICE through an
MCP server, and it runs ACME, DXA, Ghidra, Exomizer and c64run through its skills.

## Install

### Host

You need Node.js 24 or newer and VICE 3.9 or later (`x64sc`, `c1541`, `petcat`)
with its ROM files. Use the latest VICE release.

VICE 3.10 and older have a joystick and keyboard flaw (VICE bug #2202). The
nightly builds (SVN r45971 or later) have the fix. When you compile VICE from
source, give `configure` the SVN revision of the source, or the Host Runtime
cannot see the fix:

```
SVN_REVISION_OVERRIDE=46290 ./configure ...
x64sc -version    # x64sc (VICE 3.10 SVN r46290)
```

Start the Host Runtime, and leave it running:

```
npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host
```

### Dev container

You need Docker or Podman. Copy the example into your project:

```
mkdir -p .devcontainer
curl -fsSL -o .devcontainer/devcontainer.json https://raw.githubusercontent.com/henols/c64-re-tools/main/devcontainer/example/devcontainer.json
```

Its comments tell what to change: the harness, the release channel, the image
and the address of the Host Runtime. If the project already has a
`devcontainer.json`, copy the c64-re-tools Feature, `runArgs` and `appPort` into it.
`appPort` publishes the page of a retro-testing play run on
http://localhost:6465/ of your computer; rebuild the container after you add it.

Open the project in the container, for example with "Reopen in Container" in
VS Code, or with `npx -y @devcontainers/cli up --workspace-folder .`. The
Feature gives the container ACME, dxa, Exomizer and c64run. At each
start it installs the newest toolkit of its channel into the project, with the
tools of that version. It reads its options only when the container is built:
rebuild after a change.

## Use it

Start the agent in the project, for example `claude`, and ask for what you want:

```
Write a game in ACME where a sprite moves with the joystick and the border
flashes when it hits the edge. Build it, run it, and show me the screen.
```
```
The music stops when the title screen starts. Find out why.
```
```
Reverse engineer original/game.d64. Find how it starts, unpack it if it is
packed, and name the main routines.
```
```
Find the routine that draws the score, and explain how it works.
```

The agent keeps what it learns about a program as text in
`.c64-re-tools/knowledge/`. Commit that folder with the project. If a command
reports conflicts after a `git pull`, run `knowledge.ts merge`.

Several programs in one repository: open the repository root in the dev
container and give each program its own folder. A folder with `.c64-re-tools/` is a project.

## Settings

Set the host variables where the Host Runtime starts, and the others in
`containerEnv` of the `devcontainer.json`.

| Variable | Meaning |
| --- | --- |
| `C64RT_VICE`, `C64RT_C1541`, `C64RT_PETCAT` | Full path of the VICE tool, when it is not on `PATH` (host). |
| `C64RT_HOST` | `host:port` of the Host Runtime, when it is not on 127.0.0.1, `host.docker.internal` or `host.containers.internal` at port 6464. |
| `C64RT_VIDEO` | `pal` (default) or `ntsc`. |
| `C64RT_TRACE` | A directory for the trace of the MCP server and the skill scripts. See [Trace](#trace). |

## Trace

Turn on the trace when a tool fails and its error does not tell why. Each
program then writes what it does to a directory, as JSON lines. The Host
Runtime also keeps a copy of the VICE log. The agent does not see the trace.

On the host, `--log-dir` names the directory, and `--log-console` prints the
same events:

```
npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host --log-dir $HOME/c64-trace --log-console
```

For the MCP server and the skill scripts, set `C64RT_TRACE` to an absolute
directory in `containerEnv` of the `devcontainer.json`.

## License

MIT. See [LICENSE](../LICENSE).
