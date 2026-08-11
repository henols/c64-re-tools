# Codebase Structure

**Analysis Date:** 2026-08-11

## Directory Layout

```
c64-re-tools/
├── .claude-plugin/            # Claude Code plugin manifests (not runtime code)
│   ├── plugin.json             # skills dir, mcpServers file, SessionStart hook
│   └── marketplace.json        # single-plugin marketplace definition
├── .mcp.json                   # `vice` MCP server entry (launched via node, .ts direct)
├── .claude/
│   ├── mcp/vice/               # @henols/vice-mcp — the MCP server package
│   │   ├── vice-proxy.ts          # stdio entry point (bin/main)
│   │   ├── vice.ts                # HTTP/MCP transport seam + deny-list
│   │   ├── vice-probe.ts          # fragile no-retry liveness check
│   │   ├── vice-broker-client.ts  # container-side broker protocol client
│   │   ├── vice-sync.ts           # (host-sync helper)
│   │   ├── repo-root.ts           # repo-root / .vice-supervisor resolver
│   │   ├── install-resources.ts   # deploys resources/ into <project>/tools/
│   │   ├── hostpath.ts            # container -> host path translation
│   │   ├── containerpath.ts       # host -> container path translation
│   │   ├── container-guard.mts    # 5-signal container detector (host-bound)
│   │   ├── incident-record.ts     # pre-kill incident capture
│   │   ├── vice-broker.mts        # host broker daemon entry (host-bound)
│   │   ├── broker-state.mts       # port/instance bookkeeping (host-bound)
│   │   ├── broker-launch.mts      # single-owner launch guard + crash supervision (host-bound)
│   │   ├── broker-kill.mts        # verified kill / orphan reaping (host-bound)
│   │   ├── broker-epoch.mts       # per-instance epoch/log records (host-bound)
│   │   ├── broker-control.mts     # TCP control listener (host-bound)
│   │   ├── build.ts               # compiles *.mts -> resources/*.mjs
│   │   ├── refresh-manifest.ts    # regenerates tools-manifest.json from a live host
│   │   ├── tools-manifest.json    # committed snapshot of the vice_* tool surface
│   │   ├── smoke.mjs              # boots server, does an MCP handshake
│   │   ├── *.test.ts / *.mts      # co-located test files (node --test)
│   │   ├── resources/             # GENERATED, committed .mjs + vice-launcher.sh
│   │   ├── fixtures/              # test fixtures (JSON records, README)
│   │   ├── package.json / package-lock.json / tsconfig*.json
│   │   └── README.md
│   └── skills/                 # canonical source for the six C64 skills
│       ├── acme-build/            # ACME 6502/6510 assembler wrapper
│       ├── c64-memory-mapping/    # address/register lookup, disassembly annotation
│       ├── c64-program-recon/     # runtime-structure recon for unknown programs
│       ├── c64-provenance-diff/   # cracker-patch vs. original-code diffing
│       ├── c64-ram-capture/       # 64K RAM capture + comparison
│       └── vice-wedge-triage/     # diagnosing a stuck/wedged VICE
├── installer/                  # @henols/c64-re-tools — npx installer package
│   ├── bin/cli.mjs                # installer CLI entry point
│   ├── scripts/sync-skills.mjs    # copies .claude/skills/ -> installer/skills/ before packaging
│   ├── package.json
│   └── README.md
├── scripts/                    # repo-level maintenance scripts (not shipped)
│   ├── ensure-mcp-deps.sh         # SessionStart hook: npm ci for the MCP server
│   ├── package.sh                 # validates manifests, builds plugin release zip
│   └── check-npm-packages.mjs     # validates the two published npm tarballs
├── docs/                       # design notes (VICE parity, stock-binary migration roadmap)
├── .github/workflows/          # CI: typecheck, test, smoke, package, publish
├── .planning/                  # GSD planning artifacts (this document lives here)
├── LICENSE
└── README.md
```

## Directory Purposes

**`.claude/mcp/vice/`:**
- Purpose: The entire MCP server implementation, its tests, and its
  host-deployable resources, as a single self-contained npm package
  (`@henols/vice-mcp`).
- Contains: Authored `.ts`/`.mts` sources, one `*.test.ts` per source module
  (co-located, `node --test`), generated `resources/*.mjs`, `fixtures/` for
  test data, `tools-manifest.json` (the tool surface snapshot consumed
  locally by `vice-proxy.ts` for `tools/list`).
- Key files: `vice-proxy.ts` (entry point), `vice.ts` (transport seam),
  `package.json` (declares `bin`, `files`, `dependencies`).

**`.claude/mcp/vice/resources/`:**
- Purpose: Host-bound JavaScript, compiled from the `.mts` siblings by
  `build.ts`, deployed verbatim into a consuming project's `tools/`
  directory by `install-resources.ts`.
- Contains: `vice-broker.mjs`, `container-guard.mjs`, `broker-state.mjs`,
  `broker-launch.mjs`, `broker-kill.mjs`, `broker-epoch.mjs`,
  `broker-control.mjs`, `vice-launcher.sh`.
- Generated: Yes (banner-marked `// GENERATED FILE -- DO NOT EDIT.`).
  Committed: Yes — it must be present without a build step running on the
  consumer's machine.

**`.claude/skills/<skill-name>/`:**
- Purpose: One directory per C64 reverse-engineering skill; each is a
  self-contained playbook + optional helper scripts.
- Contains: `SKILL.md` (required — YAML frontmatter `name`/`description`
  plus prose instructions), `scripts/*.mjs` (offline Node helpers, some with
  `*.test.mjs` co-located), and skill-specific extras: `templates/`
  (`acme-build`, `c64-ram-capture`), `references/` (`c64-program-recon`),
  `memmap.json` (`c64-memory-mapping`).
- Key files: each skill's `SKILL.md` is the entry point Claude Code matches
  against by `description`.

**`installer/`:**
- Purpose: The alternate, non-plugin distribution path (`npx
  @henols/c64-re-tools`).
- Contains: `bin/cli.mjs` (installer logic), `scripts/sync-skills.mjs` (dev
  step that mirrors `.claude/skills/` into `installer/skills/` before
  packaging — `installer/skills/` itself is build output, not hand-edited).
- Key files: `bin/cli.mjs`.

**`scripts/`:**
- Purpose: Repo-level automation not shipped in either npm package.
- Contains: `ensure-mcp-deps.sh` (SessionStart hook), `package.sh` (release
  packaging), `check-npm-packages.mjs` (tarball content validation).

**`docs/`:**
- Purpose: Standalone design/analysis documents (VICE stock-binary parity
  and migration roadmap) — not API docs, not code.
- Contains: `roadmap-stock-vice.md`, `stock-vice-parity.md`.

**`.planning/`:**
- Purpose: GSD (this tool's own planning workflow) artifacts, including this
  codebase map, kept out of the shipped npm packages.

## Key File Locations

**Entry Points:**
- `.claude/mcp/vice/vice-proxy.ts`: stdio MCP server (the `vice-mcp` bin).
- `.claude/mcp/vice/vice-broker.mts`: host broker daemon (compiled to
  `resources/vice-broker.mjs`, launched via `resources/vice-launcher.sh`).
- `installer/bin/cli.mjs`: `npx @henols/c64-re-tools` installer CLI.

**Configuration:**
- `.mcp.json`: MCP server registration for in-repo/plugin use.
- `.claude-plugin/plugin.json`: plugin manifest (skills path, mcpServers
  path, SessionStart hook, `defaultEnabled: false`).
- `.claude/mcp/vice/tsconfig.json` / `tsconfig.build.json`: container-side
  typecheck config vs. the host-bound build config.
- `.claude/mcp/vice/tools-manifest.json`: committed tool-surface snapshot.

**Core Logic:**
- `.claude/mcp/vice/vice.ts`: transport + deny-list (the one HTTP seam).
- `.claude/mcp/vice/repo-root.ts`: repo-root/state-dir resolution (the one
  path seam).
- `.claude/mcp/vice/hostpath.ts` / `containerpath.ts`: path translation.
- `.claude/mcp/vice/vice-broker.mts` + `broker-*.mts`: broker daemon logic.

**Testing:**
- Co-located `*.test.ts` / `*.test.mts` next to each source file under
  `.claude/mcp/vice/` (e.g. `vice-proxy.ts` ↔ `vice-proxy.test.ts`).
- Skill scripts: co-located `*.test.mjs` under
  `.claude/skills/<skill>/scripts/` (e.g.
  `c64-ram-capture/scripts/d64-parse.test.mjs`).
- Two doc-guardrail tests (`skill-docs.test.ts`,
  `vice-mcp-selector-docs.test.ts`) deliberately do NOT live in this repo —
  per `.claude/mcp/vice/README.md` they validate a *consuming* project's own
  `CLAUDE.md`/`.planning`/`docs` and remain there.

## Naming Conventions

**Files:**
- Container-side MCP server sources: `.ts`, run unbuilt via Node's native
  type-stripping (e.g. `vice.ts`, `vice-proxy.ts`).
- Host-bound broker sources: `.mts`, compiled by `build.ts` into `.mjs`
  under `resources/` because they must run on a bare host Node (e.g.
  `vice-broker.mts` → `resources/vice-broker.mjs`).
- Tests: `<module-name>.test.ts` (or `.test.mts` for host-bound modules),
  co-located next to the module under test, run with `node --test`.
- Skill scripts: `.mjs`, imperative-verb or noun names matching the skill's
  domain (`diff-images.mjs`, `derive.mjs`, `driver.mjs`, `dump-artifacts.mjs`).
- Generated files carry a `// GENERATED FILE -- DO NOT EDIT.` banner as the
  first line (see `GENERATED_BANNER()` in `build.ts`).

**Directories:**
- Skill directories: `<domain>-<verb-or-noun>` (`acme-build`,
  `c64-memory-mapping`, `c64-program-recon`, `c64-provenance-diff`,
  `c64-ram-capture`, `vice-wedge-triage`).
- `scripts/` inside a skill: its executable helpers.
- `templates/`, `references/`: skill-specific static assets, only where a
  skill needs them.
- `.vice-supervisor/` (created at runtime, not committed): host-synchronised
  state directory at the resolved repo root — epoch file, broker records,
  per-instance logs.
- `tools/` (created at runtime under the *consuming* project, not this
  repo's own `tools/` — this repo has no top-level `tools/`): host launcher
  scripts deployed by `install-resources.ts`.

## Where to Add New Code

**New MCP tool forwarding logic:**
- Add/adjust the tool entry via `.claude/mcp/vice/refresh-manifest.ts`
  regeneration (updates `tools-manifest.json`), then wire any special-case
  handling (e.g. a new deny-list entry) in `.claude/mcp/vice/vice.ts`.
- Tests: a matching case in `vice-proxy.test.ts` and/or `vice.test.ts`.

**New broker/host-side behavior:**
- Implementation goes in the relevant `.claude/mcp/vice/broker-*.mts` file
  (state → `broker-state.mts`, launch/supervision → `broker-launch.mts`,
  kill/reap → `broker-kill.mts`, epoch/log records → `broker-epoch.mts`,
  TCP protocol → `broker-control.mts`).
- Must remain Node-builtins-only (no npm deps) since it runs unbuilt on a
  bare host.
- After changing any host-bound `.mts` file, run `node build.ts` from
  `.claude/mcp/vice/` to regenerate `resources/*.mjs` before committing.
- Tests: co-located `<name>.test.ts` in the same directory.

**New skill:**
- Create `.claude/skills/<new-skill-name>/SKILL.md` with YAML frontmatter
  (`name`, `description` — the description drives Claude Code's trigger
  matching, so make it specific and example-rich, matching the style of the
  six existing `SKILL.md` files).
- Add `scripts/` only if the skill needs executable helpers; keep scripts
  offline (no direct MCP/HTTP calls) unless the skill is explicitly about
  driving the emulator, in which case route exclusively through
  `mcp__plugin_c64-re-tools_vice__*` tool calls, never a hand-rolled
  connection (see `vice-wedge-triage/SKILL.md` and `c64-ram-capture/SKILL.md`
  for the pattern).
- After adding a skill, run `installer/scripts/sync-skills.mjs` so the
  installer package picks it up, and update `README.md`'s skill list.

**Shared/cross-cutting helper (path resolution, container detection, etc.):**
- Do not create a new one. Check first whether `repo-root.ts`,
  `hostpath.ts`, `containerpath.ts`, `container-guard.mts`, or `vice.ts`'s
  `mcpHost()` already owns the concern — this codebase treats a second,
  independently-derived copy of any of these as a bug class, documented
  explicitly in each file's header.

**Utilities:**
- Container-side shared helpers live directly under `.claude/mcp/vice/` as
  top-level `.ts` modules (no separate `utils/` or `lib/` subdirectory
  exists in this package — flat layout is deliberate, see `repo-root.ts`'s
  "THIRD MOVE" comment about flattening out of nested `skills/*/scripts/`).
- Skill-local helpers live under that skill's own `scripts/` directory
  (e.g. `c64-ram-capture/scripts/project-paths.mjs`); do not share skill
  helpers across skills — each skill's `scripts/` is self-contained.

## Special Directories

**`.claude/mcp/vice/resources/`:**
- Purpose: Host-bound compiled output + the shell launcher.
- Generated: Yes (via `node build.ts`).
- Committed: Yes (required for the no-build-step-on-consumer-machine
  guarantee).

**`.claude/mcp/vice/fixtures/`:**
- Purpose: Static JSON fixtures for tests (e.g. `bash-broker.json`,
  `bash-epoch-*.json` — snapshots of the retired bash implementation's
  record shapes, used to test backward-compatible parsing).
- Generated: No. Committed: Yes.

**`installer/skills/`:**
- Purpose: Build output — a synced copy of `.claude/skills/`, produced by
  `installer/scripts/sync-skills.mjs` so the installer package can ship
  skills without depending on the plugin's own directory layout at publish
  time.
- Generated: Yes (do not hand-edit; edit `.claude/skills/` and re-sync).
- Committed: Not verified as tracked in this pass — treat as build output
  regardless; the canonical source of truth is always `.claude/skills/`.

**`.vice-supervisor/`, `tools/` (runtime, in a *consuming* project):**
- Purpose: Host-synchronised broker state and deployed launcher scripts.
- Generated: Yes, on first use by `install-resources.ts` / the broker
  itself. Committed: No — these belong to whichever project the MCP server
  is running against, not to this repo.

---

*Structure analysis: 2026-08-11*
