# c64-re-tools

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects.

It provides two things as a single installable unit:

- **The `vice` MCP server** — tools that drive a host VICE
  emulator (run disks, read/write RAM, checkpoints, screenshots —
  fork backend only, see below — save-state capture, scripted input)
  through an on-demand broker.
- **Six C64 skills:**
  - `acme-build` — assemble 6502/6510 source with the ACME cross-assembler.
  - `c64-memory-mapping` — resolve any C64 address; annotate disassembly.
  - `c64-program-recon` — work out an unknown C64 program's runtime structure.
  - `c64-provenance-diff` — decide what a cracker changed vs. original code.
  - `c64-ram-capture` — capture and compare a running C64's 64K RAM.
  - `vice-wedge-triage` — diagnose a stuck/wedged VICE and recover safely.

## Install

There are two independent ways to install; pick one.

### A. npm / npx (any project)

From the project you want to set up:

```
npx @henols/c64-re-tools
```

This copies the six skills into `<project>/.claude/skills/` and wires the
`vice` MCP server into `<project>/.mcp.json` (launched via `npx -y @henols/vice-mcp`).
Existing servers and skills are preserved; pass `--force` to overwrite, `--dry-run`
to preview, `--vendor` to install the server locally instead of via `npx`. Running
the MCP server requires **Node ≥ 22.18** (or ≥ 23.6).

The two published packages:

- [`@henols/vice-mcp`](https://www.npmjs.com/package/@henols/vice-mcp) — the MCP server.
- [`@henols/c64-re-tools`](https://www.npmjs.com/package/@henols/c64-re-tools) — this installer (bundles the skills, depends on the server).

### B. Claude Code plugin

```
/plugin marketplace add henols/c64-re-tools
/plugin install c64-re-tools@c64-re-tools
```

The plugin is `defaultEnabled: false`; enable it in the project where you want
the C64 tooling. (In plugin mode the tools are namespaced
`mcp__plugin_c64-re-tools_vice__*`.)

### Dependencies

The MCP server has real npm dependencies (`@mastra/mcp`, `@mastra/core`). They
are **not** committed. A `SessionStart` hook (`scripts/ensure-mcp-deps.sh`)
runs `npm ci` into `.claude/mcp/vice/node_modules` on first session and after
any lockfile change, gated on a hash so normal starts are a cheap no-op. This
needs `node` and `npm` on `PATH` and network access to the npm registry on the
consumer's machine.

## Installing VICE, and choosing a backend

The `vice` MCP server does not bundle an emulator — it drives one running on
your host. Two backends exist:

- **Stock upstream VICE**, driven through its binary monitor. Install it from
  any package manager; no build step required. **Pick this one** unless you
  specifically need SID register read-back or the raw keyboard matrix (see
  below).
- **A custom, non-upstream fork**
  ([barryw/vice-mcp](https://github.com/barryw/vice-mcp)), exposing an HTTP
  endpoint. It must be built from source.

### Which VICE you get, per package manager

Checked live against each ecosystem on 2026-08-18. `CPUHISTORY_GET`, the
opcode behind this project's exact cycle stopwatch, requires **VICE >= 3.10**:

| Ecosystem | Install command | Version it ships | Clears the 3.10 gate? |
|-----------|-----------------|-------------------|------------------------|
| Debian 13 "trixie" | `sudo apt install vice` (enable the `contrib` component first — VICE ships there, not `main`; a stock `debian:trixie` installation has no `vice` candidate until it is) | 3.9+dfsg-1 | ✗ no |
| Debian "forky" (testing) | `sudo apt install vice` (same `contrib`-component requirement as trixie) | 3.9+dfsg-1+b1 | ✗ no |
| Ubuntu 25.10 (multiverse) | `sudo apt install vice` (enable multiverse first) | 3.9+dfsg-1 | ✗ no |
| Arch Linux | `sudo pacman -S vice` | 3.10-3 | ✓ yes |
| Fedora (via RPM Fusion Non-Free — not Fedora's own base repos) | enable RPM Fusion Non-Free, then `sudo dnf install vice` | 3.10-4 (F45/devel), 3.10-3 (F44), 3.10-2 (F43 updates); 3.9-4 on F43 base before updates | ✓ once on the updates channel — single-source confirmation (one live fetch), not independently re-verified |
| Alpine Linux | enable the `edge`/`testing` repo, then `apk add vice` | 3.10-r0, edge/testing only | ✓ where available — not present in any stable Alpine release branch (3.20/3.21/3.22) |
| Homebrew (macOS + Linux) | `brew install vice` | 3.10 | ✓ yes |
| Official Windows downloads (vice-emu.sourceforge.io) | download the GTK3/SDL2 win64 zip | 3.9 — the site's own release announcement says 3.10 shipped, but the Windows binaries page still only offers 3.9 zips | ✗ no — "official" does not mean "latest" here |

No MSYS2/pacman package exists for VICE on Windows; the alternatives there are
the official SourceForge 3.9 zips above or a source build.

Flatpak and Snap builds of VICE exist but are **unverified** here — this
project has not confirmed whether their sandboxing permits reaching the
binary monitor on `127.0.0.1`, so neither is recommended either way.

### What a sub-3.10 VICE costs

Nothing breaks. `CPUHISTORY_GET` (the exact per-instruction cycle counter) is
absent below VICE 3.10, so the cycle stopwatch degrades to an honest
within-one-frame approximation instead of an exact count. This is
already-shipped graceful degradation — every other tool works the same
either way.

### Choosing the backend

The backend is selected by `VICE_BACKEND`, set to `stock` or `fork`. When it
is unset, each process probes the configured binary's `--help` output once at
startup and caches the verdict; an indeterminate probe falls back to `fork`
(this project's pre-existing default), and you can always force a choice
explicitly by setting `VICE_BACKEND`.

**Two processes read it, each from its own environment**, and they must
agree:

1. **The MCP server** — the `env` block of the `vice` entry in `.mcp.json`.
2. **The host broker**, which is what actually launches the emulator — its
   own environment on the host where you start it.

If both run on the same host and share one environment, setting it once
covers both. If they do not — the containerised setup this project is
architected around, where the MCP server runs in a container and the
emulator runs on the host — you must set it in **both** places. The MCP
server cannot see the host's binary, so its own probe cannot reach the right
answer on its own.

Getting this wrong is detected, not silently tolerated: the broker's verdict
wins, because it is what the emulator was actually launched with, and the
server refuses every call with a `backend mismatch` error naming both
resolved values and the exact variable to set. The two backends speak
different protocols on the same port, so proceeding would put HTTP on a
binary-monitor port or the reverse.

Consequences of the choice:

- The two backends deliberately advertise **different tool lists**. A tool
  advertised on both keeps the same name and a backward-compatible argument
  shape — stock may add optional parameters but never removes, retypes, or
  newly-requires one.
- Calling a tool the active backend does not advertise returns an error
  naming the tool, the reason, and which backend provides it — it fails
  loudly, not silently.
- **`vice_sid_get_state` and `vice_keyboard_matrix` require the fork
  backend**, and are unrecoverable on stock: SID `$D400`-`$D418` is
  write-only in hardware and the binary monitor has no SID command, and the
  raw keyboard matrix is not readable over the wire at all (stock's
  `KEYBOARD_FEED` only injects PETSCII text into the KERNAL buffer).
- For the full per-tool answer, see the generated
  [`docs/tool-support.md`](docs/tool-support.md) — derived from the two
  shipped tool manifests, not maintained by hand.

### Verifying a stock install

This exact command was run live against a genuine, unpatched stock VICE 3.9
binary (`/usr/bin/x64sc`, invoked by absolute path since a fork build shadows
`x64sc` on `PATH`) and observed to bind its monitor port:

```
x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502
```

On the stock backend, **exactly one process may hold the binary monitor** —
a second connection sits unserviced with no reply and no EOF,
indistinguishable from a hang. Do not leave a hand-run monitor session open
while the plugin is also driving the same emulator instance. Concrete traps
that cause this, none of them specific to this project: a stray `nc` session
against the monitor port, a second Claude Code session pointed at the same
instance, VICE's own `-remotemonitor` flag, or any other 6502 debugger —
explicitly including regenerator2000's own `--vice <HOST:PORT>` flag (see
below). This plugin's own regenerator2000 route can never cause it: the
launch path refuses `--vice` by construction (its argv is built only from
fixed per-verb builders that never accept a pass-through flag) and by a scan
that throws if the flag is ever present, not merely by documentation. If an
emulator has gone silent, see the `vice-wedge-triage` skill before assuming
it is wedged.

## Installing regenerator2000

`acme-build` and `c64-program-recon`'s static disassembly route requires
[regenerator2000](https://github.com/ricardoquesada/regenerator2000), a Rust
CLI that decodes a `.prg`/`.d64`/flat-64K image with a real auto-analyser
instead of a flat linear decode. It is a **required prerequisite**, not an
optional accelerator: an optional-with-detection design was rejected because
it would forbid ever removing the fallback it detects around, and this
project already removed that fallback (`toacme`'s `disasm` verb).

| Fact | Value |
|------|-------|
| Install | `cargo install regenerator2000` — **no upstream release assets exist**, so this is a Rust-toolchain cost, not a binary download |
| Toolchain floor | rustc **>= 1.90** (measured; earlier `>= 1.85` and `>= 1.88` readings undercounted it — a `rust:1.88-slim` image fails a real install) |
| Container cost, single-stage | ~1.26 GB image, ~5m39s build |
| Container cost, multi-stage | ~251 MB image, ~4m48s build |
| Verified against | `0.9.20`, published 2026-07-11, checked 2026-08-20 |
| Licence | `MIT OR Apache-2.0` (dual) — see [`THIRD-PARTY-NOTICES.md`](.claude/mcp/vice/THIRD-PARTY-NOTICES.md) |

Both container figures are absolute sizes with no baseline to diff them
against.

**The one-project-per-network-namespace limit is stated, not detected — and it
is narrower than it first appears.** The hardcoded port belongs to
regenerator2000's `--mcp-server` HTTP route; two projects cannot run that route
side by side in one network namespace. This project does not use it: it drives
`--mcp-server-stdio` instead, which binds no port at all and spawns one
short-lived child process per call. Through this project's route, two projects
in one network namespace are not in conflict. The limit was sidestepped, not
fixed — it still applies in full to anyone running regenerator2000's own HTTP
MCP server directly, and this project documents that limit rather than
building detection and reporting for it; separate containers sidestep it too.

## How it locates the project

At runtime the MCP writes host-synchronised state (`.vice-supervisor/`) and
deploys its host launcher scripts (`tools/`) under the **project you are
working in**, not under the plugin's own install directory. It resolves that
root from `CLAUDE_PROJECT_DIR` (which Claude Code sets), falling back to
`CONTAINER_WORKSPACE_PATH` and then a `.git` ancestor walk — see
`.claude/mcp/vice/repo-root.ts`. The VICE emulator itself runs on the host and
is reached only through the `mcp__plugin_c64-re-tools_vice__*` tools.

## Layout

```
.claude-plugin/
  plugin.json        # manifest: skills, mcpServers, deps hook
  marketplace.json   # single-plugin marketplace, so `marketplace add` works on this repo
.mcp.json            # vice server, launched via ${CLAUDE_PLUGIN_ROOT}
.claude/
  mcp/vice/          # @henols/vice-mcp — the MCP server (authored TS, generated-but-committed resources/, tests)
  skills/            # the six skills above (canonical source)
installer/           # @henols/c64-re-tools — npx installer; bundles the skills, depends on vice-mcp
docs/
  tool-support.md    # generated per-backend tool support table (see below)
scripts/
  ensure-mcp-deps.sh    # SessionStart dependency provisioning (plugin mode)
  package.sh            # validates manifests + builds the plugin release zip
  check-npm-packages.mjs # validates the two npm tarballs' contents
```

The internal `.claude/mcp/vice` + `.claude/skills` layout mirrors a project
tree on purpose: the MCP server's own test suite resolves paths relative to it,
so the tests travel and run unchanged.

## Publishing (maintainers)

The version lives in **one hand-edited file**: `VERSION` at the repo root. It holds
a *template*, not a number — each dot-component is either a literal integer or `-`,
which marks an auto-managed slot:

```
0.2.-
```

`scripts/version.mjs` resolves that template against whatever is actually published
on npm, using four rules:

| `VERSION` | published on npm | resolves to | rule |
|-----------|------------------|-------------|------|
| `0.2.-`   | `0.1.12`         | `0.2.0`     | literal prefix differs -> auto slots reset to 0 |
| `0.2.-`   | `0.2.0`          | `0.2.1`     | literal prefix matches -> first `-` increments |
| `0.3.-`   | `0.2.7`          | `0.3.0`     | you bumped minor by hand -> patch does **not** carry over |
| `0.-.-`   | `0.2.7`          | `0.3.0`     | first `-` (minor) increments, later `-` reset to 0 |
| `1.0.0`   | anything         | `1.0.0`     | fully pinned, no auto slot, no bump |

So in practice:

- **Patch release** — merge to `main`. Nothing to edit. CI resolves the next patch,
  publishes `@henols/vice-mcp` then `@henols/c64-re-tools`, and creates the matching
  `v<version>` tag + GitHub release.
- **Minor or major release** — edit `VERSION` (e.g. `0.2.-` -> `0.3.-`) and merge to
  `main`. The patch resets to `0` rather than continuing the old count, so you get
  `0.3.0`, never `0.3.13`. No manual workflow trigger, no tag to push.
- **Land a change without releasing** — put `[skip release]` in the merge commit
  **subject** (first line).

You never pre-bump a `package.json`. Every publishable version string in the working
tree carries the self-evident placeholder `0.0.0-dev`, stamped with the resolved
version inside CI's ephemeral checkout at publish time — the two `package.json`
files and the installer's `@henols/vice-mcp` dependency pin by `npm version`, the
three plugin-manifest fields by `scripts/version.mjs stamp`. Because that pin is a
placeholder in the tree, a local `cd installer && npm install` will not resolve it;
use the published package, or stamp a version locally first.

`scripts/version.mjs` **refuses to resolve downwards**: if the template would
produce a version that is not strictly greater than what is published, it exits
non-zero. That turns a mistaken downward edit of `VERSION` into a loud CI failure
instead of a registry 409 partway through publishing.

Useful locally (all read-only against npm):

```sh
node scripts/version.mjs resolve                 # what would ship right now
node scripts/version.mjs resolve --published X.Y.Z   # resolve against a hypothetical
node scripts/version.mjs check                   # assert all 6 derived strings are the placeholder
```

The algorithm has exactly one implementation, `.claude/mcp/vice/version.ts` — the
CLI, the MCP server's advertised version, and CI all call into it. Do not re-derive
the rules anywhere else; a test greps for that regression.

The two escape hatches still exist if you need them: pushing a `v<version>` tag by
hand, or Actions -> **CI** -> **Run workflow** with an explicit version
(`workflow_dispatch`). Do not combine either with a `main` push for the same
version — both paths would publish it and the loser gets a 409.

Publishing uses **npm Trusted Publishing (OIDC)** — no `NPM_TOKEN` secret. Each
package has a Trusted Publisher configured on npmjs.com pointing at this repo and
`ci.yml`; the `publish-npm` job runs with `id-token: write` and authenticates to
npm directly, and npm records provenance automatically.

## Developing / testing the MCP server

```
cd .claude/mcp/vice
npm ci
npm run typecheck
npm test
```

## License

MIT — see [`LICENSE`](./LICENSE).
