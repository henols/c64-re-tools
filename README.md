# c64-re-tools

An agent-friendly Commodore 64 engineering toolkit for reverse engineering
unknown applications and for developing, debugging, building and testing new
C64 applications.

An agent drives a real VICE emulator through an MCP server, and uses skills
for the rest: disk images, BASIC, static analysis with Ghidra, a project
knowledge database, the ACME assembler, unpacking, release comparison and
functional-equivalence tests.

Architecture in one line: one MCP process owns one VICE instance and is
VICE-only; a Host Runtime on the graphical host owns VICE and the tools that
come with it (c1541, petcat); skill scripts call the Host Runtime for those,
run ACME, DXA and Ghidra themselves, and keep project knowledge local in
`.c64-re-tools/knowledge.db`.
The design is in [`docs/redesign/`](docs/redesign/README.md), and
[`docs/plan.md`](docs/plan.md) tracks the implementation.

## Install

Requirements: Node.js 24 or newer with npx, and on the graphical host stock VICE
3.9 or later (`x64sc`, `c1541`, `petcat`) with its ROM files. The Host Runtime
refuses an older VICE by name: 3.7 has no monitor profiler, and its CPU
history, until-return and c1541 output differ. ACME, DXA and Ghidra are
needed for the skills that use them, on the machine where the agent runs its
skill scripts (inside the container, for an agent in one). The toolkit never
installs a native tool for you: when one is missing, the operation that needs
it says which one and how to install it. The `status` command runs each tool
once and shows which ones work.

Everything runs through npx with the latest published version, so it
updates itself; nothing is installed globally or linked:

```
cd my-c64-project
npx -y @henols/c64-re-tools@latest install --target claude   # the skills and the VICE MCP for this project
npx -y @henols/c64-re-tools@latest status
```

The skills are copied into the project. The MCP declaration starts the MCP
server the same way: `npx -y --package=@henols/c64-re-tools@latest
c64-re-tools-mcp`.

Everything is TypeScript, also when installed, and nothing is built. The
programs run with [tsx](https://tsx.is), because Node does not run
TypeScript inside `node_modules`; the installed skill scripts are `.ts` files
in the project, and Node runs them itself.

`install` uses [AP SDK](https://ap-sdk.dev) for the harness
layouts: `claude`, `codex`, `pi`, `opencode`, `gemini`, `copilot`, `cursor` and
`windsurf` (comma-separated; all of them without `--target`). Add `--global`
to install into your home directory instead of the project. `uninstall`
removes it. The MCP server and the Host Runtime get the latest version each
time they start; run `update` in a project to copy the latest skills.

Start the Host Runtime on the graphical host and leave it in the foreground:

```
npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host   # listens on 127.0.0.1:6464; Ctrl+C stops it and every emulator
```

It starts VICE once before it listens, and does not start when VICE cannot
run, for example without its ROM files.

Each MCP process gets its own emulator, which stops when the MCP process
ends. If the Host Runtime itself is killed, its watchdog stops what it
started.

### Agents in a container

An agent in a devcontainer reaches the Host Runtime through
`host.docker.internal` or `host.containers.internal`. Let the runtime listen on
the container bridge as well, with a shared secret on both sides:

```
export C64RT_HOST_TOKEN=$(openssl rand -hex 16)   # the same value inside the container
npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host --listen 172.17.0.1
```

Clients on loopback need no token; every other client must send it.

### Settings

| Variable | Read by | Meaning |
| --- | --- | --- |
| `C64RT_VICE` | host | Full path of `x64sc` when it is not on `PATH`. |
| `C64RT_C1541`, `C64RT_PETCAT` | host | Full path of the tool when it is not on `PATH`. |
| `C64RT_ACME`, `C64RT_DXA` | skills, CLI | Full path of the tool when it is not on `PATH`. |
| `C64RT_GHIDRA` | skills, CLI | The Ghidra installation directory, when `analyzeHeadless` is not on `PATH`. |
| `C64RT_HOST` | MCP, skills | `host:port` of the Host Runtime when it is not on 127.0.0.1, `host.docker.internal` or `host.containers.internal` at 6464. |
| `C64RT_HOST_TOKEN` | host, MCP, skills | The shared secret for a Host Runtime that listens beyond loopback. |
| `C64RT_VIDEO` | MCP | `pal` (default) or `ntsc`, fixed for the life of the MCP process. |

Ghidra runs with its own settings directory for each request. The toolkit
brings its own NMOS 6510 language (all 256 opcodes); your Ghidra installation
and settings stay unchanged.

## Skills

| Skill | Use |
| --- | --- |
| c64-reverse-engineering | Coordinates an investigation and picks the specialist for the next unknown. |
| c64-emulator | Runs and observes the program in VICE through the MCP tools. |
| c64-static-analysis | Ghidra analysis into knowledge, with seeds from knowledge and decompilation. |
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

ACME, c1541 and petcat tests run when the tools are on `PATH`.

## Layout

```
src/             # mcp, host, host-client, knowledge, cli; unit tests beside the source
skills/          # the skills: SKILL.md, scripts (TypeScript) and references
distribution/    # the AP SDK plugin definition: skills with the src/ modules they reach
test/            # fixtures, integration and end-to-end tests
docs/redesign/   # the design
```

## License

MIT. See [`LICENSE`](./LICENSE).
