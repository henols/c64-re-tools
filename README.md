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

Stock VICE's binary monitor serves **exactly one client** — a second
connection sits unserviced with no reply and no EOF, indistinguishable from a
hang. Do not leave a hand-run monitor session open while the plugin is also
driving the same emulator instance.

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

Releases are **automatic**: every merge to `main` publishes a new **patch**
version. CI reads the current version from npm, bumps the patch, publishes
`@henols/vice-mcp` then `@henols/c64-re-tools`, and creates the matching `v<version>`
tag + GitHub release. Put `[skip release]` in the merge commit **subject** (first
line) to land a change without releasing.

For a **minor or major** bump, trigger a release manually with an explicit version:
Actions → **CI** → **Run workflow** → enter e.g. `0.2.0` (this is the
`workflow_dispatch` path). Pushing a `v<version>` tag by hand also works.

Either way the version is taken from the tag/input/auto-bump, so you do **not**
pre-bump the source `package.json` files (their versions are placeholders CI
overwrites at publish time).

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
