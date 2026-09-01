# Codebase Structure

**Analysis Date:** 2026-09-01

## Directory Layout

```
c64-re-tools/
├── .claude-plugin/             # Claude Code plugin manifests (not runtime code)
│   ├── plugin.json              # skills: ./src/skills/, mcpServers: ./.mcp.json, SessionStart hook
│   └── marketplace.json         # single-plugin marketplace definition
├── .mcp.json                    # `vice` MCP server entry -> src/mcp/vice/vice-proxy.ts
├── VERSION                      # single source for the derived version (see version.ts)
├── skills-lock.json             # pinned external skill installs
├── src/
│   ├── mcp/vice/               # @henols/vice-mcp -- the MCP server package (flat layout)
│   │   ├── vice-proxy.ts           # stdio entry point (bin/main), tool registration + dispatch
│   │   ├── vice.ts                 # FORK transport seam (HTTP/MCP) + DENY_LIST
│   │   ├── vice-probe.ts           # fragile no-retry liveness check
│   │   ├── vice-sync.ts            # checkpoint-wait invariants (deliberately not unit-tested)
│   │   ├── vice-broker-client.ts   # container-side broker protocol client + HeldLease
│   │   ├── backend-detect.mts      # THE fork-vs-stock resolver (host-bound)
│   │   ├── capability-registry.ts  # per-backend capability/refusal text
│   │   ├── fork-deleted-tools.ts   # "deleted from the fork manifest, not stale"
│   │   ├── stock-protocol.ts       # THE binary-monitor codec + ViceMonitorClient
│   │   ├── stock-connect.ts        # stock connect handshake / capability settling
│   │   ├── stock-dispatch.ts       # THE stock tool surface + dispatch table
│   │   ├── stock-handler.ts        # cycle-free handler contract (stockAnswer())
│   │   ├── stock-derived.ts        # derived-tool leaf
│   │   ├── stock-*.ts              # per-domain stock handlers (memory, registers,
│   │   │                           #  checkpoints, execution, machine, input,
│   │   │                           #  disassemble, memory-search, symbols, vicii,
│   │   │                           #  cia, sprites, timing, run-until, condition,
│   │   │                           #  address, petscii, runstate, paths, recycle,
│   │   │                           #  diagnose, schema-check) -- 26 non-test modules
│   │   ├── disasm-opcodes.ts       # committed 256-entry 6502/6510 opcode table
│   │   ├── disasm-decoder.ts       # pure decode(bytes, startAddress) -> Instruction[]
│   │   ├── disasm-renderer.ts      # pure render(instructions) -> string
│   │   ├── anno-store.ts           # THE only node:sqlite consumer (annotation store)
│   │   ├── anno-tools.ts           # curated anno_* surface (19 verbs) + runAnnoTool()
│   │   ├── anno-cli.ts             # `vice-mcp anno <verb>` CLI layer
│   │   ├── anno-*.ts               # index, derive, details, coverage, export-asm,
│   │   │                           #  memmap-render, symbols, register, types, d64,
│   │   │                           #  confidence, acme-ident, enum-gen, regbits-gen
│   │   ├── anno-regbits.json       # curated address -> bit-name table
│   │   ├── block-class.ts          # block-type translation
│   │   ├── prg-image.ts            # pure .prg / flat-64K byte layout
│   │   ├── acme-gate.ts            # THE ACME availability gate
│   │   ├── acme-verify.ts          # three-outcome reassembly verdict
│   │   ├── repo-root.ts            # repo-root / .vice-supervisor resolver
│   │   ├── install-resources.ts    # deploys resources/ into <project>/tools/
│   │   ├── hostpath.ts             # container -> host path translation
│   │   ├── containerpath.ts        # host -> container path translation
│   │   ├── incident-record.ts      # pre-kill incident capture
│   │   ├── container-guard.mts     # 5-signal container detector (host-bound)
│   │   ├── vice-broker.mts         # host broker daemon entry (host-bound)
│   │   ├── broker-state.mts        # port/instance bookkeeping (host-bound)
│   │   ├── broker-launch.mts       # single-owner launch guard + buildViceArgs (host-bound)
│   │   ├── broker-kill.mts         # verified kill / orphan reaping (host-bound)
│   │   ├── broker-epoch.mts        # per-instance epoch/log records (host-bound)
│   │   ├── broker-control.mts      # TCP control listener incl. monitor_claim (host-bound)
│   │   ├── shipped-modules.ts      # THE files[]-derived shipped-module enumerator
│   │   ├── module-classification.ts# committed capability-vs-glue module record
│   │   ├── version.ts              # THE version-derivation algorithm
│   │   ├── build.ts                # compiles *.mts -> resources/*.mjs
│   │   ├── refresh-manifest.ts     # regenerates both tools manifests from a live host
│   │   ├── tools-manifest.json     # committed FORK tool surface
│   │   ├── tools-manifest.stock.json # committed STOCK tool surface
│   │   ├── test-gate.mjs (+ .d.mts)# THE manual-vs-automated test split
│   │   ├── smoke.mjs               # boots server, does an MCP handshake
│   │   ├── probe-binmon.mjs        # raw binary-monitor probe
│   │   ├── anno-durability-mutator.mjs / anno-schema-v2-fixture.mjs
│   │   ├── binmon-fixtures.ts      # THE binmon fixture builder/loader for tests
│   │   ├── *.test.ts / *.test.mjs  # 129 co-located test files (node --test)
│   │   ├── resources/              # GENERATED, committed .mjs + vice-launcher.sh
│   │   ├── fixtures/               # test fixtures (see Special Directories)
│   │   ├── package.json / package-lock.json / tsconfig*.json
│   │   ├── README.md / THIRD-PARTY-NOTICES.md
│   │   └── node_modules/           # gitignored, provisioned by ensure-mcp-deps.sh
│   └── skills/                 # canonical source for the seven C64 skills
│       ├── acme-build/             # ACME 6502/6510 assembler wrapper (+ template.a)
│       ├── c64-memory-mapping/     # address/register lookup (+ memmap.json)
│       ├── c64-program-recon/      # runtime-structure recon (+ references/, templates/)
│       ├── c64-provenance-diff/    # cracker-patch vs. original-code diffing
│       ├── c64-ram-capture/        # 64K RAM capture + comparison (+ templates/)
│       ├── routine-queue-walker/   # annotation-backlog driver (prose only)
│       └── vice-wedge-triage/      # diagnosing a stuck/wedged VICE (prose only)
├── installer/                  # @henols/c64-re-tools -- npx installer package
│   ├── bin/cli.mjs                 # installer CLI entry point
│   ├── scripts/sync-skills.mjs     # copies src/skills/ -> installer/skills/ on prepack
│   ├── wire-mcp.test.mjs           # tests the .mcp.json merge
│   ├── skills/                     # GENERATED, gitignored sync target
│   ├── package.json / README.md / THIRD-PARTY-NOTICES.md
├── scripts/                    # repo-level maintenance (not shipped)
│   ├── ensure-mcp-deps.sh          # SessionStart hook: npm ci for the MCP server
│   ├── package.sh / release-assets.sh  # release packaging
│   ├── check-npm-packages.mjs      # validates the two published npm tarballs
│   ├── audit-gate.mjs / audit-mutation-harness.mjs
│   ├── generate-tool-support-table.mjs # writes docs/tool-support.md
│   ├── check-guard-fates.mjs / check-no-analyser.mjs
│   ├── check-skill-*.mjs           # skill CLI/overlap/honesty/coverage checks
│   ├── version.mjs
│   └── lib/                        # shared .mjs helpers (+ hand-written .d.mts)
├── docs/                       # design notes, probe findings, parity/support tables
├── .github/workflows/          # ci.yml, check-npm-token.yml
├── .planning/                  # GSD planning artifacts (this document lives here)
├── tools/                      # GITIGNORED deploy target (deployed resources/ copy)
├── .vice-supervisor/           # GITIGNORED host broker runtime state
├── .vice-snapshots/            # GITIGNORED snapshot byproducts
├── CLAUDE.md / README.md / LICENSE / THIRD-PARTY-NOTICES.md
```

## Directory Purposes

**`src/mcp/vice/`:**
- Purpose: The entire MCP server implementation, its tests, and its
  host-deployable resources, as one self-contained npm package
  (`@henols/vice-mcp`).
- Contains: 78 non-test `.ts`/`.mts` source modules and 129 co-located test
  files, in a **deliberately flat layout** (no `lib/`, `utils/`, `stock/` or
  `anno/` subdirectory — grouping is by filename prefix, not by directory).
  Plus `resources/` (generated), `fixtures/`, both tool manifests, and the
  package metadata.
- Prefix groups: `vice-*` (proxy/transport/broker client), `stock-*` (the
  stock binary-monitor backend), `disasm-*` (pure disassembler), `anno-*`
  (annotation store and its derivations), `broker-*` (host daemon),
  `docs-*` / `skill-*` (structural guard tests only).
- Key files: `vice-proxy.ts` (entry point), `vice.ts` (fork transport seam),
  `stock-dispatch.ts` (stock surface), `anno-store.ts` (the only
  `node:sqlite` consumer), `package.json` (`bin`, `files`, `dependencies`).
- Caution: `anno-memmap-render.ts` contains a NUL byte — any content census
  must use `grep -a` or it is silently skipped.

**`src/mcp/vice/resources/`:**
- Purpose: Host-bound JavaScript, compiled from the `.mts` siblings by
  `build.ts`, deployed verbatim into a consuming project's `tools/` by
  `install-resources.ts`.
- Contains: `vice-broker.mjs`, `backend-detect.mjs`, `container-guard.mjs`,
  `broker-state.mjs`, `broker-launch.mjs`, `broker-kill.mjs`,
  `broker-epoch.mjs`, `broker-control.mjs`, `vice-launcher.sh`.
- Generated: Yes (banner-marked `// GENERATED FILE -- DO NOT EDIT.`).
  Committed: Yes — it must be present without a build step on the consumer's
  machine. `resources-sync.test.ts` fails CI on drift.

**`src/skills/<skill-name>/`:**
- Purpose: One directory per C64 reverse-engineering skill; each a
  self-contained playbook plus optional helper scripts.
- Contains: `SKILL.md` (required — YAML frontmatter `name`/`description` plus
  prose), `scripts/*.mjs` (offline Node helpers, several with co-located
  `*.test.mjs`), and skill-specific extras: `template.a` (`acme-build`),
  `memmap.json` (`c64-memory-mapping`), `references/` + `templates/`
  (`c64-program-recon`), `templates/` + `RELEASES.json.example`
  (`c64-ram-capture`).
- Key files: each skill's `SKILL.md` is what Claude Code matches on.

**`installer/`:**
- Purpose: The alternate, non-plugin distribution path
  (`npx @henols/c64-re-tools`).
- Contains: `bin/cli.mjs`, `scripts/sync-skills.mjs` (mirrors `src/skills/`
  into `installer/skills/` on `prepack`), `wire-mcp.test.mjs`.

**`scripts/` and `scripts/lib/`:**
- Purpose: Repo-level automation not shipped in either npm package —
  packaging, tarball validation, audit gate and mutation harness, generated
  docs, and the skill/guard checkers.
- `scripts/lib/` holds shared `.mjs` helpers, each paired with a
  hand-written `.d.mts` so the TypeScript side can consume them; a check
  script is the CI entry point and a `src/mcp/vice/*.test.ts` is the second
  caller of the same library.

**`docs/`:**
- Purpose: Standalone design/analysis documents — not API docs, not code.
- Contains: `roadmap-stock-vice.md`, `stock-vice-parity.md`,
  `phase0-binmon-findings.md` (the normative protocol record),
  `phase1-probe-results.md`, `phase2-backend-probe-evidence.md`,
  `phase9-external-analyser-probe-findings.md`,
  `phase23-real-release-gate-findings.md`, `tool-support.md` (generated by
  `scripts/generate-tool-support-table.mjs`), `dissambler-workflow.md`,
  `undocumented-opcodes-ghidra.md`, `vice-mcp-ideas.md`.

**`.planning/`:**
- Purpose: GSD planning artifacts, including this codebase map, kept out of
  the shipped npm packages.

## Key File Locations

**Entry Points:**
- `src/mcp/vice/vice-proxy.ts` — stdio MCP server (the `vice-mcp` bin).
- `src/mcp/vice/anno-cli.ts` — `vice-mcp anno <verb>` annotation CLI.
- `src/mcp/vice/vice-broker.mts` — host broker daemon (compiled to
  `resources/vice-broker.mjs`, launched via `resources/vice-launcher.sh`;
  in practice run as a systemd unit).
- `installer/bin/cli.mjs` — `npx @henols/c64-re-tools` installer CLI.

**Configuration:**
- `.mcp.json` — MCP server registration for in-repo/plugin use.
- `.claude-plugin/plugin.json` — plugin manifest (`skills: ./src/skills/`,
  `mcpServers: ./.mcp.json`, SessionStart hook, `defaultEnabled: false`).
- `src/mcp/vice/tsconfig.json` / `tsconfig.build.json` — typecheck-only
  config vs. the host-bound build config.
- `src/mcp/vice/tools-manifest.json` / `tools-manifest.stock.json` — the two
  committed tool-surface snapshots.
- `src/mcp/vice/package.json`'s `files[]` — the authoritative shipped-module
  list, consumed programmatically by `shipped-modules.ts`.
- `VERSION` + `src/mcp/vice/version.ts` — the single version source and its
  derivation.

**Core Logic:**
- `src/mcp/vice/vice.ts` — fork transport + deny-list (`call()` at `:697`).
- `src/mcp/vice/vice-proxy.ts` — `gatherWedgeEvidence()` `:1505`
  (`rewriteArguments()` at `:1529`), `rewriteArguments()` `:2007`,
  `forwardToVice()` `:2985` (`rewriteArguments()` at `:3050`),
  `buildBackendAwareTool()` `:3329`, `anno_*` registration `:3388`.
- `src/mcp/vice/backend-detect.mts` — the fork/stock decision.
- `src/mcp/vice/stock-dispatch.ts` + `stock-*.ts` — the stock backend.
- `src/mcp/vice/anno-store.ts` + `anno-tools.ts` — the annotation store.
- `src/mcp/vice/repo-root.ts` — repo-root/state-dir resolution.
- `src/mcp/vice/hostpath.ts` / `containerpath.ts` / `stock-paths.ts` — path
  translation.
- `src/mcp/vice/vice-broker.mts` + `broker-*.mts` — broker daemon.

**Testing:**
- Co-located `*.test.ts` / `*.test.mjs` next to each source file under
  `src/mcp/vice/` (e.g. `vice-proxy.ts` ↔ `vice-proxy.test.ts`).
- Skill scripts: co-located `*.test.mjs` under `src/skills/<skill>/scripts/`
  (e.g. `c64-ram-capture/scripts/d64-parse.test.mjs`).
- Installer: `installer/wire-mcp.test.mjs`.
- `src/mcp/vice/test-gate.mjs` is the ONE place naming which test files are
  manual-only; use `npm run test:automated` rather than the full glob (the
  full `npm test` glob blocks indefinitely on `vice-proxy.test.ts`).
- Structural guards live alongside behavioural tests and are named by what
  they guard, not by a module: `docs-*.test.ts`, `skill-*.test.ts`,
  `ci-suite-coverage.test.ts`, `load-order.test.ts`, `spawn-seam.test.ts`,
  `removal-gate.test.ts`, `guard-fates.test.ts`, `audit-integrity.test.ts`.

## Naming Conventions

**Files:**
- Container-side MCP server sources: `.ts`, run unbuilt via Node's native
  type-stripping (e.g. `vice.ts`, `stock-dispatch.ts`, `anno-store.ts`).
- Host-bound sources: `.mts`, compiled by `build.ts` into `.mjs` under
  `resources/`, because they must run on a bare host Node (e.g.
  `vice-broker.mts` → `resources/vice-broker.mjs`).
- Plain `.mjs` for scripts that need no types (`smoke.mjs`, `test-gate.mjs`,
  `probe-binmon.mjs`, everything under `scripts/` and `src/skills/*/scripts/`),
  each paired with a hand-written `.d.mts` where TypeScript consumes it.
- **Prefix-as-family** is the primary grouping mechanism: `stock-` for the
  binary-monitor backend, `anno-` for the annotation store, `disasm-` for the
  pure disassembler, `broker-` for the host daemon, `vice-` for the
  proxy/transport, `docs-`/`skill-` for guard tests. Tool prefixes mirror
  module prefixes: `anno_` names the tools, `anno-` names the modules (D-05),
  and there is exactly one annotation family.
- Tests: `<module-name>.test.ts` (or `.test.mjs`), co-located, `node --test`.
- Generated files carry a `// GENERATED FILE -- DO NOT EDIT.` banner as the
  first line (see `GENERATED_BANNER()` in `build.ts`).

**Directories:**
- Skill directories: `<domain>-<verb-or-noun>` (`acme-build`,
  `c64-memory-mapping`, `c64-program-recon`, `c64-provenance-diff`,
  `c64-ram-capture`, `routine-queue-walker`, `vice-wedge-triage`).
- `scripts/` inside a skill: its executable helpers. `templates/`,
  `references/`: static assets, only where a skill needs them.
- `.vice-supervisor/`, `.vice-snapshots/`, `tools/` (all gitignored):
  runtime state, snapshot byproducts, and the deployed launcher set.

## Where to Add New Code

**New fork-backend tool:**
- Regenerate `tools-manifest.json` via `src/mcp/vice/refresh-manifest.ts`
  against a live host, then wire any special-case handling (deny-list entry,
  argument rewrite) in `src/mcp/vice/vice.ts` / `vice-proxy.ts`.
- Tests: a matching case in `vice-proxy.test.ts` and/or `vice.test.ts`, plus
  `manifest-arg-compat.test.ts` if the argument shape is shared with stock.

**New stock-backend tool:**
- Implementation goes in the right `stock-<domain>.ts` family module (create
  a new one only for a genuinely new domain), importing its result types and
  `stockAnswer()` from `stock-handler.ts` — **never** from
  `stock-dispatch.ts` (import cycle).
- Register it in `stock-dispatch.ts`'s dispatch table and add the entry to
  `tools-manifest.stock.json`; a tool absent from that manifest is not
  advertised and is refused by name. Never fall through to
  `forwardToVice()`.
- If a name exists on both backends, keep the argument shape
  backward-compatible (optional additions only) and record any gap in
  `capability-registry.ts`; regenerate `docs/tool-support.md` with
  `scripts/generate-tool-support-table.mjs`.
- Tests: `stock-<domain>.test.ts`, plus `stock-schema-check.test.ts` and
  `stock-dispatch.test.ts` coverage.

**New annotation verb:**
- Add the `AnnoToolDefinition` to `ANNO_TOOL_DEFINITIONS` in
  `src/mcp/vice/anno-tools.ts` with a per-verb argument validator; put the
  query/write itself in `anno-store.ts` (the only module allowed to name
  `node:sqlite`) and any derived shaping in `anno-index.ts` /
  `anno-derive.ts` / `anno-details.ts`.
- Add the module to `package.json`'s `files[]` if it is a new file, add the
  CLI verb in `anno-cli.ts` and `scripts/lib/anno-cli-verbs.mjs`, and do
  **not** add the tool to either `tools-manifest*.json` (both are regenerated
  from a live host and a hand-added entry would be wiped).
- Tests: `anno-*.test.ts`, plus `anno-verb-coverage.test.ts` and
  `anno-seam.test.ts`.

**New broker/host-side behavior:**
- Implementation goes in the relevant `src/mcp/vice/broker-*.mts` (state →
  `broker-state.mts`, launch/argv/supervision → `broker-launch.mts`,
  kill/reap → `broker-kill.mts`, epoch/log records → `broker-epoch.mts`, TCP
  protocol → `broker-control.mts`, backend probe → `backend-detect.mts`).
- Must remain Node-builtins-only (no npm deps) since it runs unbuilt on a
  bare host, and must import siblings as `./x.mjs` (not `.mts`).
- Nothing blocking may go inside `broker-launch.mts`'s synchronous `inFlight`
  check-and-set.
- After changing any `.mts`, run `node build.ts` from `src/mcp/vice/` to
  regenerate `resources/*.mjs` before committing, and check the deployed copy
  under `tools/` if you are testing locally.
- Tests: co-located `<name>.test.ts`, plus `host-scripts.test.ts` and
  `resources-sync.test.ts`.

**New pure C64 knowledge (opcodes, byte layouts, register bits):**
- Add to the existing pure modules — `disasm-opcodes.ts`,
  `disasm-decoder.ts`, `disasm-renderer.ts`, `prg-image.ts`, `anno-d64.ts`,
  `anno-regbits.json`, `anno-acme-ident.ts` — and keep them import-free of
  any `stock-*` / `vice*` module.

**New skill:**
- Create `src/skills/<new-skill-name>/SKILL.md` with YAML frontmatter
  (`name`, `description` — the description drives trigger matching; keep it
  specific and example-rich, matching the seven existing files, and non-
  overlapping since `skill-description-overlap.test.ts` checks this).
- Add `scripts/` only if the skill needs executable helpers; keep them
  offline. A skill that drives the emulator must route exclusively through
  `mcp__plugin_c64-re-tools_vice__*` tool calls — never `spawnSync` an
  external binary and never a hand-rolled connection, because the app lives
  on the host.
- Name the stock route or the fork requirement explicitly wherever the
  playbook depends on one (SKILL-01); `skill-honesty-checks.test.ts` and
  `check-skill-fork-honesty.mjs` enforce this.
- `installer/skills/` is synced automatically on `prepack`; update
  `README.md`'s skill list.

**Shared/cross-cutting helper (path resolution, backend, container check):**
- Do not create a new one. Check whether `repo-root.ts`, `hostpath.ts`,
  `containerpath.ts`, `stock-paths.ts`, `container-guard.mts`,
  `backend-detect.mts`, `capability-registry.ts`, `shipped-modules.ts`, or
  `vice.ts`'s `mcpHost()` already owns the concern — a second,
  independently-derived copy of any of these is a documented bug class.

**Utilities:**
- Container-side shared helpers live directly under `src/mcp/vice/` as
  top-level modules (the flat layout is deliberate — see `repo-root.ts`'s
  "THIRD MOVE" comment about flattening out of nested `skills/*/scripts/`).
- Repo-level `.mjs` helpers shared between a `scripts/` entry point and a
  test go in `scripts/lib/`, with a hand-written `.d.mts`.
- Skill-local helpers live under that skill's own `scripts/` (e.g.
  `c64-ram-capture/scripts/project-paths.mjs`); each skill's `scripts/` is
  self-contained — do not share across skills.

## Special Directories

**`src/mcp/vice/resources/`:**
- Purpose: Host-bound compiled output + the shell launcher.
- Generated: Yes (`node build.ts`). Committed: Yes (required for the
  no-build-step-on-consumer-machine guarantee).

**`src/mcp/vice/fixtures/`:**
- Purpose: Static test fixtures. Subdirectories: `binmon/` (captured
  binary-monitor wire frames), `backend-detect/` (`--help` probe outputs),
  `coverage/`, `export-asm/`, `harness-signal/`. Top-level: `bash-broker.json`
  and `bash-epoch-*.json` (retired bash implementation record shapes, for
  backward-compatible parsing), plus `planted-*` fixtures the structural
  guards scan.
- Generated: No. Committed: Yes.

**`src/mcp/vice/node_modules/`:**
- Purpose: The MCP server's real dependencies (`@mastra/mcp`,
  `@mastra/core`).
- Generated: Yes, by `scripts/ensure-mcp-deps.sh` on SessionStart (gated on a
  lockfile sha256). Committed: No (gitignored).

**`installer/skills/`:**
- Purpose: Build output — a synced copy of `src/skills/`, produced by
  `installer/scripts/sync-skills.mjs` on `prepack`.
- Generated: Yes. Committed: **No** — explicitly gitignored. The canonical
  source of truth is always `src/skills/`.

**`tools/` (this repo's own):**
- Purpose: The deployment target `install-resources.ts` copies `resources/`
  into on first tool call, plus `.vice-deployed.json`.
- Generated: Yes. Committed: No — gitignored **per file** rather than as a
  blanket `/tools/`, so `host-scripts.test.ts`'s two-way parity gate with
  `resourceEntries()` holds.

**`.vice-supervisor/`:**
- Purpose: Host-synchronised broker state — `broker.json`, `backend.json`
  (the resolved backend record), per-port directories, per-instance logs.
- Generated: Yes, at runtime. Committed: No (gitignored, along with
  `.vice-supervisor.bak-*`).

**`.vice-snapshots/`:**
- Purpose: `.vsf` snapshots plus `.json` sidecars written by
  `vice_snapshot_save`, at the path `snapshotPathFor()` builds in
  `stock-paths.ts`. A *product* byproduct, not a project artifact.
- Generated: Yes. Committed: No (gitignored).

**`.claude/gsd-core/`, `.gsd/`, `.agents/`:**
- Purpose: A vendored, machine-stamped GSD install and its runtime state —
  **not this project's code**. Regenerated wholesale by `/gsd-update`.
- Generated: Yes. Committed: No (gitignored). Nothing in the repo may branch
  on whether this tree exists.

---

*Structure analysis: 2026-09-01*
