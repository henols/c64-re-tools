# c64-re-tools

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects.

It provides two things as a single installable unit:

- **The `vice` MCP server** — tools that drive a host VICE
  emulator (run disks, read/write RAM, checkpoints, save-state capture,
  scripted input) through an on-demand broker.
- **Eight C64 skills:**
  - `acme-build` — assemble 6502/6510 source with the ACME cross-assembler.
  - `c64-disk-access` — read a `.d64` image's directory, BAM and files with c1541.
  - `c64-memory-mapping` — resolve any C64 address; annotate disassembly.
  - `c64-petcat` — detokenize a BASIC stub and find its machine-code handover.
  - `c64-program-recon` — work out an unknown C64 program's runtime structure.
  - `c64-provenance-diff` — decide what a cracker changed vs. original code.
  - `c64-ram-capture` — capture and compare a running C64's 64K RAM.
  - `routine-queue-walker` — drive a store's undocumented routines and symbols to closure.

## Install

The skills, the MCP server and the broker install separately. Nothing here
installs anything for you: every command below is one you run yourself.

### Skills — any agent, with the `skills` CLI

The eight skills install with the open agent-skills CLI
([`skills`](https://github.com/vercel-labs/skills), the one `/find-skills` uses).
It reads them straight from this GitHub repository; nothing has to be published.

```
npx skills add henols/c64-re-tools --skill '*'
```

- Install all eight. Several skills use `c64-ram-capture`'s scripts; a skill
  installed without it refuses by name and gives the command that installs it.
- `-a claude-code` (or `cursor`, `codex`, …) picks the agent; `-g` installs for
  your user instead of the project; `--list` shows the skills without installing.
- `npx skills update` updates them. The CLI sends anonymous telemetry;
  `DISABLE_TELEMETRY=1` turns it off.
- The skill scripts need **Node ≥ 24** as the `node` on `PATH`.

### MCP server — Claude Code plugin

```
/plugin marketplace add henols/c64-re-tools
/plugin install c64-re-tools@c64-re-tools
```

The plugin carries the `vice` MCP server and the skills. It is
`defaultEnabled: false`; enable it in the project where you want the C64 tooling.
In plugin mode the tools are namespaced `mcp__plugin_c64-re-tools_vice__*`.
The server's npm dependencies are not committed: run
`npm ci --prefix <plugin-root>/src/mcp/vice` once, and again after an update that
changes its `package-lock.json` (needs `node` ≥ 24, `npm` and registry access).

### MCP server — any other agent, from npm

```
npm install -g @henols/vice-mcp
npx add-mcp vice-mcp --env MASTRA_TELEMETRY_DISABLED=1
```

[`add-mcp`](https://github.com/neon-solutions/add-mcp) writes the server entry
(command `vice-mcp`) into Cursor, Codex, VS Code, Claude Code and other agents'
MCP configs; `-a <agent>` picks one. Or add `"command": "vice-mcp"` to the
agent's MCP config by hand. Never configure `npx @henols/vice-mcp` as the
command: that installs the package every time the agent starts the server.

### Broker — started by hand

The MCP server needs one broker per machine, and never starts it for you:

```
vice-mcp broker                                      # npm install
node <plugin-root>/src/mcp/vice/vice-cli.mjs broker  # plugin or checkout
```

See [Starting the broker](#starting-the-broker).

### Developing this repo: no in-repo autoload

The payload (the eight skills under `skills/` and the `vice` MCP server under
`src/mcp/vice/`) lives outside `.claude/`, so Claude Code does not auto-discover
it. A Claude Code session opened on this repository's own working tree therefore
does **not** auto-load the skills or the server the way it would if they sat
under `.claude/`. This is a deliberate tradeoff, not an oversight: with the payload
on the auto-discovery path, "it works in the repo" was never real evidence
that "it works when installed" — an install-path defect (a wrong manifest
path, a stale packaging literal) was structurally invisible to local
development, since the repo never exercised the actual install routes a
consumer uses.

Two supported ways to exercise the payload as a consumer does:

- **The skills CLI from this checkout** — `npx skills add ./ --skill '*' --copy`
  run from a scratch project with this checkout's path in place of `./`. It
  installs into that project only.
- **A local-marketplace plugin install** — this repository's own
  `.claude-plugin/marketplace.json` already declares `"source": "./"`, so
  `/plugin marketplace add ./` (run from this checkout) and
  `/plugin install c64-re-tools@c64-re-tools` install the plugin from source.
  This route writes into the user's machine-global `~/.claude/plugins/`
  state, so it is a **human action**, never something an automated agent
  performs.


## Prerequisites at a glance

Every prerequisite this project declares, in one place: what it unblocks, its
one-line remedy, and how to tell this project where an unusually-located one
lives. The remedies themselves are the table's own data — nothing here
restates one in prose.

<!-- prereq-gen:prerequisite-overview:start -->
<!-- Generated by `npm --prefix src/mcp/vice run generate:readme`. Edit src/mcp/vice/prerequisites.json and regenerate -- do not hand-edit this region. -->

| Prerequisite | Unblocks (skills) | Unblocks (MCP tools) | Remedy | Location override |
| --- | --- | --- | --- | --- |
| x64sc | c64-program-recon, c64-ram-capture | c1541.bam, c1541.dir, c1541.entry, c1541.chain, c1541.read, petcat.decode | See the VICE per-package-manager table. | VICE_BIN |
| c1541 | c64-disk-access | c1541.bam, c1541.dir, c1541.entry, c1541.chain, c1541.read | See the VICE per-package-manager table. | .c64-re-tools/local/tools.json |
| petcat | c64-petcat, c64-program-recon | petcat.decode | See the VICE per-package-manager table. | .c64-re-tools/local/tools.json |
| acme | acme-build | acme.build | Install ACME. | ACME_BIN |
| acme-lib | acme-build | acme.build | export ACME=<dir holding cbm/c64/vic.a>. | ACME |
| ghidra | c64-program-recon | ghidra.analyze, ghidra.installExtension | Set the GHIDRA_HOME environment variable to name a Ghidra installation directory. | GHIDRA_HOME |
| dxa | routine-queue-walker | dxa.disassemble | bash vendor/dxa/build.bash build | none |
| node | acme-build, c64-disk-access, c64-memory-mapping, c64-petcat, c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker | acme.build, ghidra.analyze, oracle.probe, oracle.run, dxa.disassemble, ghidra.installExtension, c1541.bam, c1541.dir, c1541.entry, c1541.chain, c1541.read, petcat.decode | Install Node >= v24 and put it on PATH, or set VICE_BROKER_NODE to an absolute path to one. | none |

<!-- prereq-gen:prerequisite-overview:end -->

## Installing VICE

The `vice` MCP server does not bundle an emulator — it drives one running on
your host, through **stock upstream VICE**'s binary monitor. Install it from
any package manager; no build step required.

### Which VICE you get, per package manager

Checked live against each ecosystem on 2026-08-18. Each row below names an
ecosystem, the platforms it covers, and the install command to run:

<!-- prereq-gen:vice-ecosystems:start -->
<!-- Generated by `npm --prefix src/mcp/vice run generate:readme`. Edit src/mcp/vice/prerequisites.json and regenerate -- do not hand-edit this region. -->

| Ecosystem | Platforms | Install command |
| --- | --- | --- |
| debian-trixie | linux | sudo apt install vice (enable the contrib component first — VICE ships there, not main; a stock debian:trixie installation has no vice candidate until it is) |
| debian-forky | linux | sudo apt install vice (same contrib-component requirement as trixie) |
| ubuntu-2510 | linux | sudo apt install vice (enable multiverse first) |
| arch | linux | sudo pacman -S vice |
| fedora-rpmfusion | linux | enable RPM Fusion Non-Free, then sudo dnf install vice |
| alpine-edge | linux | enable the edge/testing repo, then apk add vice |
| homebrew | linux, macOS | brew install vice |
| windows-official | Windows | download the GTK3/SDL2 win64 zip |

<!-- prereq-gen:vice-ecosystems:end -->

No MSYS2/pacman package exists for VICE on Windows; the alternatives there
are the official download named in the table's `windows-official` row
above, or a source build.

Flatpak and Snap builds of VICE exist but are **unverified** here — this
project has not confirmed whether their sandboxing permits reaching the
binary monitor on `127.0.0.1`, so neither is recommended either way.

### VICE version compatibility

No shipped tool in this project refuses on a VICE version. `vice_cpu_history`
— the exact per-instruction cycle counter — runs over the text channel's
`chis` command, not the binary monitor's `CPUHISTORY_GET` opcode, so it works
the same regardless of which VICE version you have installed. The measured
3.10 floor binds `CPUHISTORY_GET` itself, an opcode no shipped tool calls.
Consequently the prerequisite declaration (`src/mcp/vice/prerequisites.json`)
carries no VICE version data of any kind — not a floor, and not a dated
observation.

### Capabilities with no route on stock

Three capabilities have no route on stock VICE at all — a permanent hardware
fact, not a gap waiting on a later build. Calling any of these returns an
error naming the tool and the reason; it fails loudly, not silently.

- **`vice_sid_get_state`** — permanently unavailable. SID `$D400`-`$D418` is
  write-only in hardware and the binary monitor has no SID command; writes
  still work fine over the memory-set primitive.
- **`vice_keyboard_matrix`** (and its siblings `vice_keyboard_chord`,
  `vice_keyboard_key_press`, `vice_keyboard_key_release`) — permanently
  unavailable. The raw keyboard matrix is not readable over the wire at all;
  the binary monitor's `KEYBOARD_FEED` only injects PETSCII text into the
  KERNAL buffer.
- **`vice_keyboard_restore`** — permanently unavailable. RESTORE pulses the
  NMI line directly, which `KEYBOARD_FEED` has no way to produce.

### Verifying a stock install

This exact command was run live against a genuine, unpatched stock VICE 3.9
binary (`/usr/bin/x64sc`, invoked by absolute path — a non-stock, patched
build previously used during this project's own migration can still shadow
`x64sc` on `PATH` if one happens to be installed) and observed to bind its
monitor port:

```
x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502
```

On the stock backend, **exactly one process may hold the binary monitor** —
a second connection sits unserviced with no reply and no EOF,
indistinguishable from a hang. Do not leave a hand-run monitor session open
while the plugin is also driving the same emulator instance. Concrete traps
that cause this, none of them specific to this project: a stray `nc` session
against the monitor port, a second Claude Code session pointed at the same
instance, VICE's own `-remotemonitor` flag, or any other 6502 debugger that
dials in. This plugin's own annotation route can never cause it: the `anno`
CLI opens the project's own SQLite annotation file and decodes bytes out of a
file on disk, and there is no emulator connection anywhere on that path to
contend for the port. If an emulator has gone silent, check for one of these before assuming
it is wedged, then restart the broker.

## Starting the broker

The `vice` MCP server does not start the broker for you, and does not install
anything to make that happen — it **detects, then refuses by name with the
remedy**. The remedy is the same everywhere: run the broker as a foreground
command from the same install the MCP server runs from — the npm package, or
the plugin (or a checkout of this repository) at `<plugin-root>`:

```
vice-mcp broker                                      # npm install
node <plugin-root>/src/mcp/vice/vice-cli.mjs broker  # plugin or checkout
```

**One broker per machine** means every project and every Claude Code session
on that machine shares it — restarting it affects all of them at once, not
just the one you meant to restart.

**A bridge appearing later needs a broker restart.** The broker enumerates
its bind set once at startup and holds it for the life of the process. If you
start a container runtime (Docker, Podman, a devcontainer) *after* the broker
is already running, the broker has no way to notice the new bridge — restart
it and it will pick the new bind set up on its next startup. This is a
documented remedy, not a code feature: a broker that is unexpectedly
unreachable from inside a container you started later is not a bug, it is
this behavior.

## The retired static analyser (attribution, and what replaced it)

**There is no longer any external analyser to install.** Until 2026-08-29 this
document told you to `cargo install` a third-party Rust CLI and called it a
**required prerequisite** of the plugin, with a rustc floor and a container
cost. That is no longer true and the instruction is withdrawn: nothing in this
plugin runs that binary, and a document telling a user to install something the
tool no longer uses is worse than saying nothing. Its one-project-per-network-
namespace caveat went with it — that limit belonged to the analyser's own HTTP
MCP route, which this project never used and now cannot.

**What replaced it.** Annotations — labels, comments, typed ranges, scopes and
enums — live in the project's own SQLite file,
`.c64-re-tools/annotations.db`, committed with the project and reached
through the `anno` CLI's `call` verb, with no external process anywhere on
the path. Whole-program ACME export is **withdrawn and returns in Phase 30**,
rebuilt over that store and settled by assembling the output with a real ACME
and diffing the bytes against the input. The skill playbooks name that
withdrawal at each place a reader would otherwise reach for the old route.

**The attribution stands, and is not what paid for the removal.** The skill
playbooks in this repository still incorporate prose **adapted** from
[the external analyser](an upstream repository)'s own
analysis procedures, dual-licensed `MIT OR Apache-2.0` and taken here under
MIT, pinned at commit `493f840418f1450a342bb220c2fe3d2585dd0525` (`v0.9.20`,
2026-07-11). Every adapted playbook carries its own `ATTRIBUTION (ABS-02)`
header naming that source, and the full inventory — including the upstream MIT
permission notice reproduced verbatim — is in
[`THIRD-PARTY-NOTICES.md`](src/mcp/vice/THIRD-PARTY-NOTICES.md). Removing the
code integration does not retire that obligation, and this section is here so
the attribution is findable from the README rather than only from a notices
file.

## How it locates the project

The MCP server keeps its per-project files under `.c64-re-tools/` in the
**project you are working in**, not under the plugin's own install directory,
split into two folders:

- `.c64-re-tools/` itself holds the project's artifacts: today
  `annotations.db`, every label, comment and typed range. **Commit it.**
- `.c64-re-tools/local/` holds what belongs to this machine or can be
  regenerated: `tools.json`, the deployed launchers in `bin/`, snapshots and
  host-tool output. It carries its own `.gitignore`, so committing
  `.c64-re-tools/` never picks it up and the project needs no ignore rule.

It resolves that root from
`CLAUDE_PROJECT_DIR` (which Claude Code sets), falling back to
`CONTAINER_WORKSPACE_PATH` and then a `.git` ancestor walk — see
`src/mcp/vice/repo-root.ts`. The broker keeps its own state under its
machine-level home (`VICE_BROKER_HOME`), never inside a project. The VICE
emulator itself runs on the host, launched by the broker, and is reached only
through the `mcp__plugin_c64-re-tools_vice__*` tools.

## Layout

```
.claude-plugin/
  plugin.json        # manifest: mcpServers (skills/ is the default skills location)
  marketplace.json   # single-plugin marketplace, so `marketplace add` works on this repo
.mcp.json            # vice server, launched via ${CLAUDE_PLUGIN_ROOT}
skills/              # the eight skills (canonical source; what `npx skills add` installs)
src/mcp/vice/        # @henols/vice-mcp — the MCP server (authored TS, generated-but-committed resources/, tests)
test/skills/         # the skill scripts' tests (kept out of the skill folders so they never ship)
evidence/            # repo-only measured artifacts that must never ship with a skill
```

The payload no longer sits on Claude Code's auto-discovery path — see
"Developing this repo: no in-repo autoload" above for why that is deliberate.
The MCP server's own test suite resolves paths relative to its own module
directory (`repo-root.ts`'s depth-based fallback), so it does not depend on the
tree mirroring a consumer's installed `.claude/` layout.

## Publishing (maintainers)

**The git tag is the version.** There is no template, no auto-bump on merge, and
nothing to hand-edit before a release.

```sh
git tag v1.2.3
git push origin v1.2.3
```

That tag triggers the `publish-npm` job, which derives `1.2.3` from the ref,
stamps it into `src/mcp/vice/package.json` with `npm version`, and publishes
`@henols/vice-mcp` (its `prepack` compiles the server into `dist/`). A manual
`workflow_dispatch` with an explicit version does the same thing without a tag;
do not use both for one version, or the loser gets a 409.

Merging to `main` publishes nothing. It runs the build job — typecheck, the MCP
server suite, the skill suites and the packed-install smoke test — and stops there.

Every publishable version string in the working tree carries the self-evident
placeholder `0.0.0-dev`: `src/mcp/vice/package.json` `.version` and the plugin
manifests. `npm version` overwrites the first inside CI's ephemeral checkout at
publish time. Never pre-bump one by hand — a test asserts they are all still the
placeholder.

The skills are not published anywhere: `npx skills add henols/c64-re-tools`
reads them from this repository.

The plugin itself is **not** distributed as a release artifact. It installs from
this repository (`/plugin marketplace add henols/c64-re-tools`), so there is no
zip to build and none is attached to a release.

Publishing uses **npm Trusted Publishing (OIDC)** — no `NPM_TOKEN` secret. The
package has a Trusted Publisher configured on npmjs.com pointing at this repo and
`ci.yml`; the `publish-npm` job runs with `id-token: write` and authenticates to
npm directly, and npm records provenance automatically.


## Developing / testing the MCP server

```
cd src/mcp/vice
npm ci
npm run typecheck
npm test
```

## License

MIT — see [`LICENSE`](./LICENSE).
