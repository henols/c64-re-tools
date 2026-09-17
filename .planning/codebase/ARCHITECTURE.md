<!-- refreshed: 2026-09-01 -->
# Architecture

**Analysis Date:** 2026-09-01

**Fork-backend content corrected: 2026-09-12.** Every claim in this document
about the removed fork backend, its HTTP transport, its manifest, its probe
or its per-backend capability table was corrected against the tree on this
date (phase `52-remove-the-fork-backend`, plan 52-12). The rest of this
document remains a 2026-09-01 snapshot and carries its own, unrelated
staleness — a reader wanting a current picture of anything else should
re-run a mapping pass rather than trust these lines. See
`docs/stock-hard-losses.md` for the permanent, accepted capability losses
that replaced the deleted per-backend capability table.

## System Overview

This repository is a **Claude Code plugin** distributed as two npm packages
(`@henols/vice-mcp`, `@henols/c64-re-tools`) plus a plugin manifest. It has
three independently-deployable halves: an **MCP server** (`src/mcp/vice/`)
that presents a `vice_*` + `anno_*` tool surface over stdio, a **host broker
daemon** that owns a pool of real `x64sc` emulator processes, and a set of
seven **skills** (`src/skills/`) that are markdown playbooks plus offline Node
scripts. Nothing here runs a C64 emulator itself — `x64sc` always runs on the
**host**, outside the container/sandbox Claude Code executes in.

The fork backend this section used to describe here is **removed, not
degraded**: `x64sc` now names exactly one accepted shape — stock upstream
VICE, any unpatched build installable from a package manager — driven over
its **binary monitor** (a raw TCP socket, framed by `stock-protocol.ts`,
connected and torn down by `stock-connect.ts`, dispatched by
`stock-dispatch.ts`) and its text channel. There is no second backend, no
per-process selection, and no divergent manifest to fall through to (D-09).
Three hardware-level capabilities the fork backend used to cover have no
route on stock at all and are recorded in `docs/stock-hard-losses.md` as
permanent, accepted losses rather than a gap awaiting a second backend.

One structural fact dominates the rest of the current shape:

**An in-repo annotation store.** `anno-store.ts` owns a `node:sqlite`
database of labels, comments, block types, enums and cross-references for
the binary under analysis. The `anno_*` tool family (`anno-tools.ts`) is
served entirely proxy-locally and touches no emulator at all.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     Claude Code (client, in-container)                    │
│  loads skills as playbooks; calls mcp__plugin_c64-re-tools_vice__*        │
├───────────────────────────────┬──────────────────────────────────────────┤
│  Skills (playbooks + offline   │  `vice` MCP server (stdio)               │
│  Node scripts)                 │  `src/mcp/vice/vice-proxy.ts`            │
│  `src/skills/*/SKILL.md`       │  answers initialize/tools_list locally   │
│  `src/skills/*/scripts/*.mjs`  │  from the committed stock manifest       │
└───────────────┬────────────────┴───┬───────────────────┬─────────────────┘
                │                    │                   │
                │        ┌───────────┘                   └──────────┐
                │        ▼                                          ▼
                │  ┌──────────────────────────┐        ┌──────────────────────────┐
                │  │ anno_* family (LOCAL)    │        │ vice_* family (REMOTE)   │
                │  │ `anno-tools.ts` ->        │        │ registered via           │
                │  │ `anno-store.ts`           │        │ `buildViceTool()`         │
                │  │ (node:sqlite, no emulator)│        │ dispatched to below       │
                │  └──────────────────────────┘        └────────────┬─────────────┘
                │                                                    │
                │                                                    ▼
                │                                     ┌──────────────────────────┐
                │                                     │ `stock-dispatch.ts`       │
                │                                     │ dispatch table; refuses   │
                │                                     │ any unmatched tool name   │
                │                                     └────────────┬─────────────┘
                │                                                  │
                │                                                  ▼
                │                                     ┌──────────────────────────┐
                │                                     │ `stock-connect.ts` /      │
                │                                     │ `stock-protocol.ts`       │
                │                                     │ binary monitor over       │
                │                                     │ raw TCP socket            │
                │                                     └────────────┬─────────────┘
                │                                                  │
                ▼                                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│         Host broker daemon (long-lived, on-demand pool)                   │
│  `src/mcp/vice/vice-broker.mts` -> compiled to                           │
│  `src/mcp/vice/resources/vice-broker.mjs`, deployed to `<project>/tools/` │
│  Owns: port allocation, warm floor, crash supervision, epoch/liveness      │
│  records, TCP control listener (acquire / release / recycle / status /   │
│   host_state / monitor_claim / monitor_release)                          │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ launches / kills
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   x64sc instance(s) (VICE emulator, host)                 │
│  `-default -drive8type 1541 -binarymonitor                                │
│   -binarymonitoraddress ip4://<host>:<port>`                              │
│  one process per acquired lease; state under `.vice-supervisor/`          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Stdio MCP entry point | Speaks MCP JSON-RPC to Claude Code; answers `initialize`/`tools/list` from the committed stock manifest, dispatches `tools/call` | `src/mcp/vice/vice-proxy.ts` |
| Binary identity resolver | No backend to decide anymore (FORKRM-01) — resolves the configured `x64sc` binary's own path/identity and caches its version/capability record once per binary | `src/mcp/vice/backend-detect.mts` |
| Transport seam | The one place that speaks VICE's binary monitor wire, framed by `stock-protocol.ts`, with connect/reconnect/teardown owned by `stock-connect.ts`; no deny-list or refusal mechanism exists at this seam | `src/mcp/vice/stock-connect.ts`, `src/mcp/vice/stock-protocol.ts` |
| Stock dispatch table | THE tool surface: manifest selection, the handler table, refuse-by-name, no fall-through to any other transport (D-09) | `src/mcp/vice/stock-dispatch.ts` |
| Stock wire protocol | The ONE place that frames/parses/demuxes the binary-monitor wire; `ViceMonitorClient` over `net.Socket` | `src/mcp/vice/stock-protocol.ts` |
| Stock connect handshake | Claims the monitor socket from the broker, asserts `api_version`, reads build identity via `VICE_INFO`, settles version-gated capabilities once per binary, detects machine identity across reconnect | `src/mcp/vice/stock-connect.ts` |
| Stock handler contract | The cycle-free leaf every `stock-*` family module imports: result types, error converters, `stockAnswer()` | `src/mcp/vice/stock-handler.ts` |
| Stock tool families | Per-domain handlers: memory, registers, checkpoints, execution, machine, input, disassemble, memory-search, symbols, VIC-II, CIA, sprites, timing, run-until, diagnose, recycle | `src/mcp/vice/stock-*.ts` (26 non-test modules) |
| Derived-tool leaf | Tools computed client-side rather than asked of the emulator | `src/mcp/vice/stock-derived.ts` |
| Annotation store | The ONE module that names `node:sqlite`; opens/queries/writes the annotation store, asserted-confined | `src/mcp/vice/anno-store.ts` |
| Annotation tool surface | The curated `anno_*` definitions, per-verb arg validators, store-path containment, and `runAnnoTool()` | `src/mcp/vice/anno-tools.ts` |
| Annotation CLI | `vice-mcp anno <verb>` ergonomics layer over the same store | `src/mcp/vice/anno-cli.ts` |
| Annotation derivations | Address index, derived answers, composed address detail, coverage census, ACME export, memory-map render, symbol round trip, enum/regbit generation, type vocabulary, confidence grades | `src/mcp/vice/anno-index.ts`, `anno-derive.ts`, `anno-details.ts`, `anno-coverage.ts`, `anno-export-asm.ts`, `anno-memmap-render.ts`, `anno-symbols.ts`, `anno-enum-gen.ts`, `anno-regbits-gen.ts`, `anno-types.ts`, `anno-confidence.ts` |
| Pure 6510 disassembler | Committed 256-entry opcode table, pure `decode()`, pure `render()` — import-free of any `stock-*`/`vice*` module | `src/mcp/vice/disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts` |
| Pure C64 byte layout | `.prg` load-address/body split, flat-64K load address, block-type translation. `.d64` reading is NOT in-process: the one route is the `c1541.*` host-tool family (7d36844c retired the second, in-process parser) | `src/mcp/vice/prg-image.ts`, `block-class.ts`, `host-tool.mts` |
| ACME gate / verify | The ONE ACME availability gate and the three-outcome reassembly verdict | `src/mcp/vice/acme-gate.ts`, `acme-verify.ts` |
| Broker client | Container-side broker protocol: acquire/release/recycle plus monitor claim/release, over a TCP control session | `src/mcp/vice/vice-broker-client.ts` |
| Checkpoint sync helpers | The single-resume-per-wait checkpoint invariant, ported here in event-driven form (no polling on `hit_count`) | `src/mcp/vice/stock-run-until.ts` |
| Repo root resolution | The one shared resolver for "where is the project root" / "where is `.vice-supervisor`" | `src/mcp/vice/repo-root.ts` |
| Resource deployment | Deploys host launcher scripts into the *consuming* project's `tools/` on first use | `src/mcp/vice/install-resources.ts` |
| Container detection | Five-signal container-vs-host detector, checked at broker startup | `src/mcp/vice/container-guard.mts` |
| Host/container paths | Container→host and host→container path translation | `src/mcp/vice/hostpath.ts`, `containerpath.ts`, `stock-paths.ts` |
| Incident capture | Writes a pre-kill incident record before any recycle/kill | `src/mcp/vice/incident-record.ts` |
| Host broker daemon | Pool manager: port allocation, warm floor, crash supervision, TCP control listener | `src/mcp/vice/vice-broker.mts` (+ `broker-*.mts`) |
| Structural-guard seams | The manual-vs-automated test gate and the single version algorithm. The shipped-module enumerator and the capability-vs-glue record are GONE -- phase 56 removed `shipped-modules.ts` and its source-text scans, and 276c15c9 removed `module-classification.ts` | `src/mcp/vice/test-gate.mjs`, `version.ts` |
| Build step | Compiles host-bound `.mts` sources into committed, banner-marked `.mjs` under `resources/` | `src/mcp/vice/build.ts` |
| Advertised tool surface | The advertised tool surface is a committed snapshot read offline at `tools/list`; nothing regenerates it from a live host | `src/mcp/vice/tools-manifest.stock.json`, resolved through `src/mcp/vice/stock-dispatch.ts` |
| Plugin manifest | Declares `./src/skills/`, `./.mcp.json`, SessionStart hook | `.claude-plugin/plugin.json` |
| npm installer | Non-plugin install path: copies skills + wires `.mcp.json` into any project | `installer/bin/cli.mjs` |
| Skills (seven) | Markdown playbooks + Node scripts driving the tool surface or working offline on files | `src/skills/*/SKILL.md`, `src/skills/*/scripts/*.mjs` |

## Pattern Overview

**Overall:** Split-process proxy/broker architecture with a hard container/host
boundary, wrapped as a Claude Code plugin. There is one emulator target and no
per-project backend selection (FORKRM-01).

**Key Characteristics:**
- **One tool manifest, a committed snapshot.** `tools-manifest.stock.json` is
  the whole advertised surface, selected by
  `stockDispatch.manifestPathForBackend()` — not a runtime filter over a
  larger shared list, and not regenerated from a live host. A tool stock
  cannot do is simply not advertised, so there is nothing for a fall-through
  to catch (D-09).
- **Single seam per concern.** One file owns each cross-cutting
  responsibility: one binmon codec (`stock-protocol.ts`), one `node:sqlite`
  consumer (`anno-store.ts`), one repo-root resolver (`repo-root.ts`), one
  container detector (`container-guard.mts`), one ACME gate. Several of these
  confinements are **asserted by a structural test** rather than promised
  (e.g. `anno-seam.test.ts` scans the shipped module set for a second
  `node:sqlite` mention).
- **Generated-but-committed artifacts.** `.mts` sources are compiled by
  `build.ts` into `resources/*.mjs`, which IS committed, because it is what
  gets deployed to a consuming project's `tools/` with no build step there.
  `resources-sync.test.ts` fails CI on drift.
- **No build step for the shipped server.** `vice-proxy.ts` and its `.ts`
  siblings run directly under Node's native type-stripping (Node ≥ 24);
  `package.json`'s `bin` points straight at a `.ts` file.
- **Structural guards as architecture.** A share of the 136 test files guard
  the architecture itself, not behaviour: import-cycle and seam-bypass scans,
  shipped-`files[]` coverage, and skill honesty checks. This category SHRANK
  deliberately -- 276c15c9 deleted 43 source-text-scanning tests and phase 56
  removed the enumerator they scanned with, so do not assume a guard exists
  for a given rule without checking the tree.
- **Documentation-as-code.** Source files carry long structured headers
  recording *why* a decision was made, the incident behind it, and explicit
  "do not revert this" warnings. Treat them as part of the architecture
  record.
- **Never-throw boundary.** The stdio server registers global handlers before
  anything else runs, because a dead stdio MCP server is never auto-restarted
  by Claude Code for the rest of the session.

## Layers

**Skills layer:**
- Purpose: Domain playbooks for C64 reverse-engineering (ACME build,
  memory-map lookup, program recon, provenance diffing, RAM capture,
  annotation-backlog walking, wedge triage).
- Location: `src/skills/<skill-name>/`
- Contains: `SKILL.md` (YAML frontmatter + prose), `scripts/*.mjs`,
  plus `templates/`, `references/`, `memmap.json`, `template.a` where needed.
  Two skills (`routine-queue-walker`, `vice-wedge-triage`) are pure prose with
  no scripts.
- Depends on: the `vice_*` / `anno_*` MCP surface, or pure filesystem work.
- Used by: Claude Code directly, matched by `SKILL.md` `description`.

**MCP server layer (container-side):**
- Purpose: Presents a stable `vice_*` + `anno_*` surface over stdio; routes
  each call to the stock binary monitor or the local annotation store.
- Location: `src/mcp/vice/*.ts` (78 non-test source modules, run unbuilt).
- Sub-groups: proxy/transport (`vice-proxy.ts`, `vice-errors.ts`,
  `vice-broker-client.ts`), stock backend (`stock-*.ts`,
  `disasm-*.ts`), annotation store (`anno-*.ts`, `block-class.ts`,
  `prg-image.ts`), path/root seams (`repo-root.ts`, `hostpath.ts`,
  `containerpath.ts`, `install-resources.ts`), guard seams (`version.ts`,
  `test-gate.mjs`).
- Depends on: `@mastra/mcp` / `@mastra/core` for stdio framing,
  `@modelcontextprotocol/sdk` (transitive) for `CallToolRequestSchema`,
  `node:sqlite` (in exactly one module), `node:net` (in exactly one module).
- Used by: Claude Code's MCP client, per `.mcp.json`.

**Broker layer (host-side, deployed):**
- Purpose: On-demand pool of `x64sc` instances; launch, warm floor, crash
  supervision, port allocation, and a TCP control protocol.
- Location authored: `src/mcp/vice/vice-broker.mts`, `broker-state.mts`,
  `broker-launch.mts`, `broker-kill.mts`, `broker-epoch.mts`,
  `broker-control.mts`, `container-guard.mts`, `backend-detect.mts`.
- Location deployed: `src/mcp/vice/resources/*.mjs` + `vice-launcher.sh`,
  copied into the consuming project's `tools/` by `install-resources.ts`
  (this repo's own `tools/` holds a deployed copy).
- Depends on: Node builtins only — it runs unbuilt on a bare host Node.
- Used by: `vice-broker-client.ts` over a TCP control socket; state under
  `.vice-supervisor/`.

**Installer layer:**
- Purpose: Non-plugin distribution — `npx @henols/c64-re-tools` copies skills
  and wires `.mcp.json` into an arbitrary target project.
- Location: `installer/bin/cli.mjs`, `installer/scripts/sync-skills.mjs`,
  `installer/wire-mcp.test.mjs`.
- Depends on: `src/skills/` (synced into `installer/skills/`).

## Data Flow

Four named flows, each walked step by step below.

### Primary tool-call path

1. Claude Code sends `tools/call` over stdio to the running proxy
   (`src/mcp/vice/vice-proxy.ts`).
2. The `CallToolRequestSchema` override looks the tool up in `tools` and —
   if unknown — answers the generic `Unknown tool: ${name}` fallback; there
   is no per-capability refusal lookup to consult first now that there is
   only one backend.
3. Every registered tool's runner reaches
   `stockDispatch.dispatchStock(name, args, { ensureLease,
   resolvedBinaryPath, … })`. There is no other transport to fall through to
   (D-09).
4. `ensureStockSession()` / `stockConnect()` (`stock-connect.ts`) claims the
   monitor socket from the broker (`monitor_claim` over the control session)
   **before** any TCP dial, opens a `ViceMonitorClient`
   (`stock-protocol.ts`), asserts `api_version`, reads build identity via
   `VICE_INFO`, and settles version-gated capabilities once per binary.
5. The dispatch table's family handler runs (`stock-memory.ts`,
   `stock-checkpoints.ts`, …), constructing its answer only through
   `stockAnswer()` (`stock-handler.ts`).
6. Unsolicited frames (`STOPPED`, `RESUMED`, `JAM`, `CHECKPOINT_INFO`,
   `REGISTER_INFO`) arrive at request-id `0xffffffff` and are demuxed by
   request-id — never used to resolve a pending request.
7. Path arguments are translated through `stock-paths.ts`'s single declared
   table and wrapper.

### Annotation-store path (`anno_*`)

1. `runAnnoTool(name, args)` (`anno-tools.ts:2093-2097`) resolves the store
   path through `storePathWithinWorkspace(raw, repoRoot())`.
2. It asserts the store already **exists** (`assertStorePresent()`, refusing
   to create one), records the inode, opens it, re-checks the inode
   (`assertSameFile()`), answers exactly one call, and closes it again.
3. `anno-store.ts` is the only module that names `node:sqlite`; derived
   answers come from `anno-index.ts`, `anno-derive.ts`, `anno-details.ts`,
   `anno-coverage.ts`, `anno-export-asm.ts`, `anno-memmap-render.ts`.
4. No emulator, no HTTP, no socket — the family is backend-independent and is
   not part of the committed `tools-manifest.stock.json` snapshot at all; it
   is registered directly through `buildViceTool()`, separate from the
   manifest-driven registration loop.

### Recovery/incident path (recycle or crash)

1. `handleRecycle()` (`vice-proxy.ts`) delegates unconditionally to
   `stockDispatch.dispatchStock()`, which reaches `handleRecycleStock()`
   (`stock-recycle.ts`) — the stock-native evidence gatherer and recovery
   path; there is no separate fork-only implementation left to choose
   between.
2. A pre-kill incident record is written **before** anything is killed
   (`writeIncidentRecord()`, `incident-record.ts`, D-17 invariant).
3. `broker-kill.mts`'s `verifiedKill()` runs, then `broker-launch.mts`
   relaunches through the single-owner `tryLaunchOne()` guard.
4. `finaliseIncidentRecord()` completes the record once evidence is gathered.

### Skill-driven offline flow (e.g. `c64-provenance-diff`)

1. A skill script (`src/skills/c64-provenance-diff/scripts/diff-images.mjs`)
   is invoked directly as a subprocess — no MCP call.
2. It reads disk images / prior ledgers from the project and writes results
   back.
3. Ordering is enforced by convention inside `SKILL.md`, not by code.

**State Management:**
- Host-synchronised state lives under `.vice-supervisor/` at the resolved
  repo root: `broker.json`, `backend.json` (the resolved binary's
  identity/capability cache — no backend field anymore, since there is no
  longer anything to distinguish), per-port directories, per-instance logs —
  written atomically (tmp-sibling-then-rename).
- `stock-dispatch.ts` holds the mutable module-level held-session state
  (`heldSession`, cleared via `clearHeldStockSession()`), deliberately not
  frozen at import time because a lease redirect must change it at runtime.
- The annotation store is an on-disk SQLite file inside the workspace, opened
  and closed per call — no long-lived handle.

## Key Abstractions

**Binary identity and capability cache:**
- Purpose: Resolve the configured `x64sc` binary's own path/identity and
  cache its capability record (version quad, CPU-history support) once per
  binary. There is no backend to decide anymore — `resolvedBackend()` always
  answers `"stock"` (FORKRM-01).
- Examples: `src/mcp/vice/backend-detect.mts` (`resolvedBackend()`,
  `resolveBinPath()`, `readCapabilityRecord()`/`writeCapabilityRecord()`),
  consumed by `stock-connect.ts`'s connect handshake.
- Pattern: Binary-path resolution and capability caching only — no `--help`
  probe, no environment-variable backend override, and no second detection
  mechanism belongs here.

**Stock handler contract:**
- Purpose: Give every `stock-*` family module the result types, error
  converters and `stockAnswer()` without importing `stock-dispatch.ts` (which
  imports them) — a deliberate cycle break.
- Examples: `src/mcp/vice/stock-handler.ts`, re-exported by
  `stock-dispatch.ts` for backward compatibility.
- Pattern: A leaf both sides import. Never construct a
  `{ content, isError }` literal outside `stockAnswer()`.

**Annotation store confinement:**
- Purpose: Contain an experimental `node:sqlite` dependency to a blast radius
  of exactly one file, provably.
- Examples: `src/mcp/vice/anno-store.ts` (STORE-07),
  `anno-seam.test.ts`, `anno-confinement.test.ts`.
- Pattern: Confinement that is **asserted** — the guard scans the shipped
  module set for the specifier through all four working access routes.

**Repo root resolver:**
- Purpose: One definition of "where is the project this MCP instance works
  in", correct in-repo, as an installed plugin, and inside a devcontainer.
- Examples: `src/mcp/vice/repo-root.ts` (`repoRoot()`, `supervisorDir()`).
- Pattern: Ordered fallback ladder — `CLAUDE_PROJECT_DIR` →
  `CONTAINER_WORKSPACE_PATH` (if it contains the caller) → `.git` ancestor
  walk → `CONTAINER_WORKSPACE_PATH` anyway → fixed hop count, each later
  branch logging a one-time stderr warning.

**Host/container path pair:**
- Examples: `src/mcp/vice/hostpath.ts` (container→host, via
  `HOST_WORKSPACE_PATH` or `/proc/self/mountinfo`),
  `containerpath.ts` (host→container, `containerizeRecord()`),
  `stock-paths.ts` (D-17's declared table for the stock surface).
- Pattern: Both take the workspace root as an explicit argument rather than
  importing `repo-root.ts`, specifically to break a documented import cycle.

**Broker lease + monitor claim:**
- Purpose: On-demand emulator pool over a persistent TCP control connection;
  plus, on stock, exclusive ownership of the single-client binary monitor.
- Examples: `src/mcp/vice/vice-broker-client.ts` (`openBrokerControl()`,
  `HeldLease`), `broker-control.mts` (`monitor_claim` / `monitor_release`,
  `monitor_owned` refusal with holder identity and `claimedAt`).
- Pattern: The connection IS the lease and the open IS the claim — no
  separate TTL/heartbeat file. The claim exists because stock VICE's monitor
  services exactly one client, and a second `connect()` is
  indistinguishable from a wedge.

**Pure-data modules:**
- Purpose: Knowledge with no I/O, safe to unit-test exhaustively and to reuse
  offline.
- Examples: `disasm-opcodes.ts` (committed 256-entry table),
  `disasm-decoder.ts`, `disasm-renderer.ts`, `prg-image.ts`,
  `anno-regbits.json`, `anno-acme-ident.ts`.
- Pattern: Deliberately import-free of any `stock-*`/`vice*` module.

**Generated resource bundle:**
- Examples: `src/mcp/vice/resources/*.mjs`, each prefixed with a
  `GENERATED FILE — DO NOT EDIT` banner from `build.ts`.
- Pattern: `build.ts` asserts the emitted set exactly matches
  `HOST_BOUND_ARTIFACTS`; `resources-sync.test.ts` fails CI on drift.

## Entry Points

**Stdio MCP server:**
- Location: `src/mcp/vice/vice-proxy.ts` (`bin.vice-mcp` and `main` in
  `src/mcp/vice/package.json`; launched as
  `${CLAUDE_PLUGIN_ROOT}/src/mcp/vice/vice-proxy.ts` in `.mcp.json`).
- Triggers: Claude Code spawning the `vice` MCP server once per session.
- Responsibilities: global error handlers first, binary identity resolution,
  tool registration from the committed stock manifest (manifest loop and the
  `anno_*` family both → `buildViceTool()`), dispatch through
  `stockDispatch.dispatchStock()`.

**Annotation CLI:**
- Location: `src/mcp/vice/anno-cli.ts`, reached as `vice-mcp anno <verb>` (or
  `npx -y @henols/vice-mcp anno <verb>`) — that bin is the only surface that
  resolves identically across the plugin route and the npm route (D-06).
- Triggers: Skill scripts and humans working the annotation store without an
  MCP session.

**Host broker daemon:**
- Location: `src/mcp/vice/vice-broker.mts` (authored) /
  `src/mcp/vice/resources/vice-broker.mjs` (deployed, run via
  `resources/vice-launcher.sh`; a deployed copy lives in this repo's
  `tools/`).
- Triggers: First on-demand acquire from the container side, or a human
  launching it on the host. In practice it must run as a **systemd unit** —
  a session-scoped `setsid`/`nohup` dies with the session.
- Responsibilities: parse CLI args (`--repo-root`, `--state-dir`,
  `--check-container`, `--dry-run`), run the container guard, resolve the
  binary's identity once, maintain the warm floor, own the single in-flight
  launch guard, serve the TCP control listener.

**npm installer CLI:**
- Location: `installer/bin/cli.mjs` (`npx @henols/c64-re-tools [targetDir]`).
- Responsibilities: copy `installer/skills/` into `<target>/.claude/skills/`,
  merge a `vice` entry into `<target>/.mcp.json`, optionally vendor the MCP
  package with `--vendor`.

**Manual build/refresh/gate scripts:**
- `src/mcp/vice/build.ts` — `node build.ts`, recompiles `.mts` →
  `resources/*.mjs`.
- `src/mcp/vice/test-gate.mjs` — `npm run test:automated` / `test:manual`;
  the ONE place naming which test files are manual-only.
- `src/mcp/vice/smoke.mjs`, `probe-binmon.mjs` — handshake smoke test and a
  raw binary-monitor probe.
- `scripts/package.sh`, `scripts/check-npm-packages.mjs`,
  `scripts/ensure-mcp-deps.sh` — release packaging, tarball validation,
  SessionStart `npm ci`. The tool-support table and its generator were
  retired by af987e37, and the audit gate by e4759250.

## Architectural Constraints

- **No fall-through to another transport (D-09).** There is no other
  transport left to fall through to — every tool reaches
  `stockDispatch.dispatchStock()`, which either matches a table entry and
  answers by name or matches nothing and refuses by name; there is no third
  path. The only runners that touch no transport at all are
  `vice_result_continue` and the `anno_*` family, and those exceptions are
  asserted **by name** in `stock-dispatch.test.ts`.
- **Derived tools are refused by name unless declared.** A derived tool must
  be listed in `STOCK_DERIVED_TOOLS` (`stock-derived.ts`, D-03); anything not
  declared there is refused at call time by `withDerivedTool()`
  (`stock-dispatch.ts`) rather than silently answered.
- **One monitor client per stock instance.** The broker must guarantee
  single-client-per-instance (`monitor_claim`) and must not diagnose a
  second unserviced `connect()` as a hang.
- **Container/host boundary is load-bearing everywhere.** Any host-facing
  path or hostname must go through `hostpath.ts` / `containerpath.ts` /
  `stock-paths.ts` / `container-guard.mts`; the project maintains a tested
  *closed consumer set* for host-path logic (`hostpath-consumers.test.ts`;
  its skill-side companion was deleted in 276c15c9).
- **No build step for the shipped server.** Container-side `.ts` modules run
  under Node's native type-stripping (Node ≥ 24). Only host-bound `.mts`
  files are compiled, by `build.ts`, because they run on a bare host Node.
- **Single-owner launch guard.** `broker-launch.mts`'s module-level
  `inFlight` boolean is a **synchronous check-and-set with no `await`
  between**, and is the sole gate on spawning `x64sc`. It exists because of
  the 2026-08-01 triple-launch outage and is regression-tested. Do not add a
  second gate, and do not put anything blocking inside the window.
- **`node:sqlite` in exactly one module.** `anno-store.ts` only; asserted by
  `anno-seam.test.ts`.
- **`node:net`/binmon bytes in exactly one module.** `stock-protocol.ts`
  only.
- **Global state:** `stock-dispatch.ts` (`heldSession`, the held stock
  session), `backend-detect.mts` (`memoisedResult`, the resolved binary's
  identity — there is no backend left to memoise), `broker-launch.mts`
  (`inFlight` / `inFlightReason`), `vice-proxy.ts` (`CONTINUATION_STORE`).
- **Module-cycle avoidance is deliberate and documented.**
  `repo-root.ts` → `install-resources.ts` → (would-be) `hostpath.ts` →
  `repo-root.ts` was broken by passing `workspaceRoot` explicitly.
  `stock-dispatch.ts` → `stock-*.ts` → `stock-dispatch.ts` was broken by
  `stock-handler.ts`. Do not re-introduce either import.
- **Threading:** single-threaded Node event loop throughout; the broker uses
  `child_process.spawn` for emulator instances, not worker threads. Note that
  a non-stopping stock checkpoint emits `CHECKPOINT_INFO` synchronously from
  inside the emulator's CPU loop over the blocking socket, so a hot address
  can stall the emulator thread.
- **Three resources power-cycle the machine one call deep**
  (`MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency`): any
  resource-set tool exposed to an LLM must deny them.
- **`src/mcp/vice/anno-memmap-render.ts` contains a NUL byte** and is
  invisible to plain `grep`. Any content census must use `grep -a`.

## Anti-Patterns

Four recurring mistakes this codebase has direct history of, each with its
own dedicated guard.

### Re-deriving a cross-cutting seam locally

**What happens:** A new module computes its own repo root, its own
host/container hostname default, its own container check, or its own copy
of a cross-cutting seam.
**Why it's wrong:** This codebase has direct history of exactly this bug —
`mcpHost()`'s header in `vice-errors.ts` documents three separate inlined
copies of `process.env.VICE_MCP_HOST || "host.docker.internal"`;
`repo-root.ts`'s header documents a depth-assumption bug from copy-pasted
hop counts. A third case is recorded only in history now: `shipped-modules.ts`
documented **four** hand copies of `shippedTsModules()` whose filter logic had
silently diverged, each still passing because a guard that scans nothing finds
nothing. Phase 56 removed that module and its scans outright, so the lesson
survives while the file does not.
**Do this instead:** Import `repoRoot()`/`supervisorDir()` from
`repo-root.ts`, `mcpHost()` from `vice-errors.ts`, and `isInsideContainer()`
from `container-guard.mts`.

### Deleting by name glob

**What happens:** A retirement is driven by a module-name pattern (e.g.
`anno`-named files) rather than by what each module actually implements.
**Why it's wrong:** Ten of the sixteen non-test modules in that family
implemented capabilities unrelated to the analyser (disk geometry, register
bit layout, ACME identifier legality, coverage census, confidence grades,
label round trip). A glob would have taken them silently, inside a diff too
large to read.
**Do this instead:** classify before deleting, not under deletion pressure.
There is no committed capability-vs-glue record to consult any more —
276c15c9 deleted `module-classification.ts` and its guard — so the
classification is now a judgement you must make and state in the plan, file by
file, against a diff small enough to read.

### Killing/relaunching preemptively to serve a newer request

**What happens:** Interrupting an in-flight emulator boot to satisfy a later,
higher-priority acquire.
**Why it's wrong:** `broker-launch.mts` rejects this explicitly — preemption
re-creates the exact concurrent-spawn window the 2026-08-01 outage came from.
Priority only decides who gets a slot once it next frees.
**Do this instead:** Let an in-flight boot complete; queue later requests
behind the fixed-order pass in `runBrokerPass()`.

### Creating an annotation store implicitly

**What happens:** An `anno_*` verb opens a missing store path and creates an
empty database.
**Why it's wrong:** A zero-length file opens cleanly under `node:sqlite`, so
a typo'd path silently becomes a brand-new empty store and the real one looks
like it lost its data.
**Do this instead:** `runAnnoTool()` calls `assertStorePresent()` before
opening and `assertSameFile()` (inode re-check) after — refuse, never create.

## Error Handling

**Strategy:** Fail loud and traceable at process boundaries; never silently
produce a plausible-looking wrong answer.

**Patterns:**
- Global uncaught-exception/rejection handlers are registered in
  `vice-proxy.ts` before anything else, since a dead stdio server is never
  restarted mid-session.
- `ViceError` (`vice-errors.ts:158`) is the base; `MachineRestartedError`
  (`vice-errors.ts:185`) is a distinct type for epoch mismatch, so a silent
  host restart is never mistaken for a successful call.
- The stock path converts wire and handshake failures through the two
  converters in `stock-handler.ts` — never by hand at a family module.
- `stock-protocol.ts` resyncs on a stray STX byte instead of throwing out of
  the framing loop, and reads a `JAM` body as zero-length; both are fixes to
  defects in the vendored source it derives from.
- Unknown tool names are answered by the generic `Unknown tool: ${name}`
  fallback — there is no per-capability refusal lookup to consult first now
  that there is only one backend.
- Path/root resolution fallbacks emit a one-time stderr warning rather than
  silently guessing (`repo-root.ts`'s `warnedEnvOutsideFrom` /
  `warnedNoMarkerFound`).
- Incident records are written **before** any destructive action
  (`incident-record.ts`), so a crash mid-recovery still leaves evidence.

## Cross-Cutting Concerns

**Logging:** stderr `console.error()` throughout, often gated to fire once per
process; per-instance boot/crash logs written under the broker's log
directory (`broker-epoch.mts`'s `instanceLogDirFor()`).

**Validation:** Runtime narrowing at every JSON boundary via `isPlainObject()`
rather than unchecked casts (a convention shared by `vice-proxy.ts` and
`vice-broker.mts`); per-verb argument validators in `anno-tools.ts`;
`api_version` assertion at stock connect; `stock-schema-check.ts` for
manifest/handler agreement.

**Containment:** Annotation store paths go through
`storePathWithinWorkspace()`; the stock dispatch table's match-or-refuse is
the only authorization boundary (D-09) — a name not in the table is refused,
never forwarded to another transport; the container guard runs at broker
startup.

**Authentication:** No end-user auth; the broker's TCP control listener uses a
per-process `control_token` (`newControlToken()` in `broker-control.mts`) to
scope who may issue control commands, and `monitor_claim` grants exclusive
monitor ownership within that.

---

*Architecture analysis: 2026-09-01*
