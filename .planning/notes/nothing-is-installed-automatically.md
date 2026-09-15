---
title: "Nothing is installed automatically — the measured inventory of every install and auto-write site"
date: 2026-09-15
context: /gsd-explore — "what tools that the broker or the skills use are automatically installed"
status: inventory MEASURED against the tree at 9891e711; owner extended the rule to cover all three triggers
---

# Nothing is installed automatically

Owner decision, stated 2026-09-15, generalising the standing external-tool rule:

> "I don't want anything to be installed at all, not from a new session, mcp start
> or when running the test. We can expect that all tools are correctly installed."

Scope confirmed the same day as **total** — it covers the two user-machine triggers,
the installer's explicit `--vendor` flag, **and** CI. Nothing is exempt.

This supersedes the narrower reading in `CLAUDE.md`, whose external-tools bullet
exempts three things by name (`scripts/ensure-mcp-deps.sh`, CI's `retry_apt install
-y acme`, and `--vendor`). All three exemptions are withdrawn.

## The external-tool rule was already clean

MEASURED by grep over `*.ts` / `*.mts` / `*.mjs` / `*.sh` / `*.json` / `*.yml`,
excluding `node_modules` and `.claude/`: **no shipped path installs an external
tool.** Every one is detect-then-refuse-by-name, as documented:

| Tool | Resolver | Refusal carries the remedy |
|---|---|---|
| `x64sc` | `resolvedBackend()`, `backend-detect.mts` | `README.md` carries the per-distro line for the user to run |
| `c1541`, `petcat` | `findSiblingBinary()`, `host-tool.mts:2273` | sibling of the resolved `x64sc`; `$PATH` fallback logs the shadowing hazard |
| ACME | `$PATH` + 4 documented prefixes | `src/skills/acme-build/SKILL.md` |
| Ghidra | version-declared, non-vendored, user-chosen path | search for `analyzeHeadless`, never guess a prefix |
| dxa | `findDxaBinary()`, `host-tool.mts:2223` | refuses by name with `bash vendor/dxa/build.bash build` (`host-tool.mts:1472`) |

The `curl` inside `vendor/dxa/build.bash:97` is user-invoked only — it verifies the
committed tree against the pinned `dxa-0.1.5.tar.gz.sha256`. Nothing triggers it.

## What actually installs: the project's own npm dependencies, four sites

| # | Site | Trigger | Gate | Was exempt in CLAUDE.md |
|---|---|---|---|---|
| 1 | `scripts/ensure-mcp-deps.sh:49` — `npm ci --no-audit --no-fund` | SessionStart hook, registered in `.claude-plugin/plugin.json` | lockfile sha256 stamp under `.c64-re-tools/cache/` | yes |
| 2 | `installer/bin/cli.mjs:135-142` — `npx -y @henols/vice-mcp@<ver>` written into the consumer's `.mcp.json` | **every MCP server launch**, installer path without `--vendor` | **none** | **no — undocumented** |
| 3 | `installer/bin/cli.mjs:213` — `npm install --save-dev` | `--vendor` flag only | explicit opt-in | yes |
| 4 | `.github/workflows/ci.yml` — `npm ci` (L39), `retry_apt install -y acme` (L78), `npm install -g npm@latest` (L282, L349) | every CI run | none | partly (only the apt line was named) |

Site 2 is the one that had escaped the record. `CLAUDE.md` argues the `anno` route
(`npx -y @henols/vice-mcp anno <verb>`) is "an invocation, not an install" — that
argument does **not** transfer here, because this `npx -y` *is* the server launch.
Two consequences follow from it, both MEASURED:

- **No lockfile gate.** `package-lock.json` is not in the published `files[]`, and a
  lockfile is not honoured for a package's own dependencies anyway. The two direct
  deps are exact-pinned (`@mastra/mcp@1.15.0`, `@mastra/core@1.55.0`), but the
  **transitive tree floats** to whatever the registry resolves at launch time.
- The plugin path resolves the same tree from a committed lockfile via `npm ci`.
  The two distribution paths therefore do not run the same dependency tree, and only
  the plugin path runs the tested one.

The repo's own `.mcp.json` is already clean: `node ${CLAUDE_PLUGIN_ROOT}/src/mcp/vice/vice-proxy.ts`.

## Tests install nothing

MEASURED: no test file shells out to a package manager. The live tests default-skip
and refuse by name — `dxa-live.test.ts`, `ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`,
`stock-live.test.ts`. A local `npm test` works today only because site 1 already ran
earlier in the session; the test run itself adds nothing.

`actions/setup-node@v4` carries `cache: npm` keyed on `src/mcp/vice/package-lock.json`
(ci.yml:31-35). That is a cache restore, not an install, but it exists only to
accelerate site 4's `npm ci` and becomes dead weight once that is removed.

## Auto-*written* (no network) — a separate category, not covered by the decision

Recorded so a later reader does not mistake these for installs and remove them:

- `install-resources.ts` copies the host launcher scripts into
  `<project>/.c64-re-tools/bin/` the first time any skill `.mjs` entry point runs.
  Disableable with `VICE_SKIP_RESOURCE_INSTALL=1`.
- The broker mints the `c64-re-tools` → `.c64-re-tools` symlink at startup
  (`vice-broker.mts`), re-asserted idempotently by `ghidra-project.mts`'s
  `ensureGhidraRunsHandle()`.

Both write inside the project's own tool-written root from bytes already on disk.
Neither fetches anything.

## The known cost, named before it is discovered

**A plugin ships no `node_modules`, and site 1 is the only reason a fresh plugin
install works at all today.** Removing it means a first-time plugin user gets a
refusal naming `npm ci` in `src/mcp/vice` instead of a working MCP server. That is a
real cost of the rule, accepted deliberately — not an argument against it, and not a
defect to be "fixed" later by restoring the hook.

The same holds for CI, more sharply: a GitHub runner has **nothing** pre-installed,
so "CI does not install" necessarily means CI is provisioned from a pre-baked image
or container that already carries `node_modules`, `acme`, and a new enough npm.
There is no in-workflow way to satisfy the rule.
