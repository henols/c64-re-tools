# c64-re-tools

## What This Is

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects. It ships a `vice` MCP server
(~63 tools driving a host VICE emulator through an on-demand broker) plus six C64
reverse-engineering skills, distributed both as two npm packages
(`@henols/vice-mcp`, `@henols/c64-re-tools`) and as a Claude Code plugin.

Today the whole tool surface only works against a **custom, non-upstream VICE
fork** ([barryw/vice-mcp](https://github.com/barryw/vice-mcp), ~17k lines of C
patched into the emulator, exposing `-mcpserver` and an HTTP `/mcp` endpoint).
This milestone adds a second backend that drives **stock upstream VICE** through
its binary monitor, selected per project — so the plugin works on a VICE anyone
can install, without giving up the fork's capabilities.

## Core Value

A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from the codebase map (.planning/codebase/). -->

- ✓ Claude drives a host VICE emulator through a stable `vice_*` stdio MCP surface (~63 tools) — existing, v0.1.x
- ✓ Emulator instances are pooled on demand with port allocation, warm floor, and crash supervision — existing, v0.1.x
- ✓ A crashed or wedged emulator is detected and recycled without losing evidence (incident record written before any kill) — existing, v0.1.x
- ✓ Tool calls work from inside a container against an emulator on the host, with every path translated at the boundary — existing, v0.1.x
- ✓ Six C64 RE skills usable as playbooks: `acme-build`, `c64-memory-mapping`, `c64-program-recon`, `c64-provenance-diff`, `c64-ram-capture`, `vice-wedge-triage` — existing, v0.1.x
- ✓ Installable two ways: `npx @henols/c64-re-tools` into any project, or as a Claude Code plugin — existing, v0.1.x
- ✓ Releases are automated: CI typechecks, tests, validates both npm tarballs, and publishes via OIDC trusted publishing on `v*` tags — existing, v0.1.x

### Active

<!-- Current scope: milestone v0.2.0, switchable stock-VICE backend. -->

- [ ] User selects which VICE backend the MCP server drives, project-level, without editing code
- [ ] The tool surface works against an unmodified upstream `x64sc` obtained from apt / Homebrew / official builds
- [ ] The fork backend keeps working exactly as it does today when selected
- [ ] A binary-monitor protocol client speaks stock VICE's wire format, correlating replies and demultiplexing unsolicited events
- [ ] Tools with a 1:1 binary-monitor equivalent work on the stock backend (memory, registers, checkpoints, watchpoints, step, reset, joystick, snapshots, autostart, banks, resources, ping)
- [ ] Tools the fork implemented in-emulator are reimplemented client-side (memory search/compare/fill, backtrace, checkpoint groups, symbol store, 6502 disassembler, sprite decode, chip-state decode)
- [ ] Screenshots are produced on the stock backend by encoding the framebuffer client-side
- [ ] The broker launches stock VICE with binary-monitor flags as well as the fork with `-mcpserver`
- [ ] Every tool declares its support level per backend, so a user is told which backend restores a capability
- [ ] Stock-only capability: CPU instruction-history tracing
- [ ] Stock-only capability: 1541 drive-CPU debugging (drive CPUs as separate memspaces)
- [ ] Stock-only capability: raster-precise checkpoint conditions, exact emulator palette, and full resource get/set
- [ ] The client detects the connected VICE's version and degrades gracefully when a capability is absent
- [ ] Tool output on the stock backend can be compared against the fork backend for a known program
- [ ] The binary-monitor assumptions are confirmed empirically against a real VICE build before client design is locked

### Out of Scope

<!-- Explicit boundaries, with reasoning to prevent re-adding. -->

- **Client-side SID write-shadowing mitigation** — switchability supersedes it. SID read-back work routes to the fork backend, which retains `vice_sid_get_state`. Shadowing could only ever capture writes the client itself issued, never the running program's, so it was never parity. (Resolves ingest WARNING W1.)
- **Removing or deprecating the fork backend** — it is the hedge against the stock backend's two hard losses (SID read-back, matrix keyboard) and the reason this migration is not a bet. Its incremental maintenance cost is near zero since it already exists and is tested.
- **Upstreaming a `KEYBOARD_MATRIX_SET` opcode to VICE** — genuinely worth doing (~60 lines in `monitor_binary.c` calling `keyboard_set_keyarr_any`, and it would close the hardest loss for everyone), but it is an upstream contribution, not a deliverable of this project. Recorded as a follow-up.
- **Byte-identical output parity with the fork** — explicitly not an acceptance bar. Disassembly formatting and illegal-opcode rendering will differ from VICE's own, per `docs/stock-vice-parity.md` §A.7.
- **Matrix-keyboard equivalence on the stock backend** — proven not recoverable at source level. `read_ciapb()` recomputes from `keyarr` on every read, and watchpoints fire after the load completes. `JOYPORT_SET` covers most in-game input instead.
- **Distributed / multi-host broker** — outside the current single-host architecture; no demand established.
- **Fixing the unauthenticated emulator endpoint exposure** — real (documented in `.planning/codebase/CONCERNS.md`), but a property of the external fork and its `0.0.0.0` bind, not of this milestone's scope.

## Context

**Why this milestone exists.** The plugin's install instructions never mention
that it needs a special VICE build, and `README.md` cannot honestly claim to be
generic while the only working emulator is an out-of-repo fork. The fork *does*
publish prebuilt releases (Linux x86_64, macOS arm64, Windows headless), so users
are not fully blocked — but it is a single-maintainer project (4 stars) carrying
~17k lines of C against an upstream with 36k commits, and it has platform holes
stock VICE closes for free (no Windows GUI, no macOS x86_64, no Linux ARM).
Staying on the fork is not the low-risk option; it is the deferred-risk option.
This milestone builds the exit route while the choice is still voluntary.

**Research already done, and where it lives.** Two source-verified research
passes ran against `VICE-Team/svn-mirror` master @ `e50d42c`. Their conclusions
are recorded in `.planning/notes/stock-vice-migration-revised-loss-ledger.md`,
which **corrects three claims** in `docs/phase0-binmon-findings.md` — a document
that is normative by ingest resolution W2 and therefore still propagating the
errors until fixed (tracked in `.planning/todos/pending/`). In short: pause-on-
demand and the cycle stopwatch both survive on stock (contra the doc), and the
real new constraint is that `CPUHISTORY_GET` needs VICE ≥ 3.10 while
Debian/Ubuntu still ship 3.9.

**Net capability picture.** Two genuine losses on the stock backend, not four:
SID state read-back (write-only registers, unrecoverable) and low-level/matrix
keyboard. Everything else either ports 1:1, reimplements client-side, or turned
out to be recoverable after all.

**Existing planning context (do not re-derive).** `.planning/codebase/` holds the
full codebase map. `.planning/intel/` holds the ingested doc set: 11 decisions,
14 constraints, 7 `CAND-*` scope items, and a Resolutions section answering all
three previously-open scope questions. `.planning/INGEST-CONFLICTS.md` records
two user-resolved precedence warnings (W1, W2).

**Known debt this milestone touches.** `vice-proxy.ts` is already 3,093 lines and
is the sole seam registering the whole tool surface; the concerns audit warns that
group-B client-side derivations should be extracted into sibling modules rather
than appended there. Separately, hundreds of source comments cite decision records
(`D-04`, `01.4-RESEARCH.md`, `.planning/STATE.md`) that never travelled with the
code into this repo.

**Shipping history.** Tagged through `v0.1.10`; both npm packages published.
Every merge to `main` auto-publishes a patch version unless the subject contains
`[skip release]`.

## Constraints

- **Compatibility**: The stdio MCP surface Claude sees must not change — same tool names and shapes across both backends. The whole point is that skills keep working.
- **Architecture**: The transport swap happens behind `vice.ts`'s `call()` seam for *direct* tools. **Derived tools must be intercepted before `forwardToVice()`, not behind `call()`** — `rewriteArguments()` runs at `vice-proxy.ts:2773` inside `forwardToVice()` and before `call()`, so a derived tool sitting behind `call()` receives host-translated paths and acts on them inside the container. Second site with the same cause: `gatherWedgeEvidence()` calls `rewriteArguments()` itself.
- **Protocol (settled, normative)**: 11-byte request header / 12-byte response header, all multi-byte values little-endian. Confirmed opcode set and error codes per `docs/phase0-binmon-findings.md` §5.
- **Protocol**: **Five** unsolicited message types arrive at request-id `0xffffffff`, not three: `STOPPED` (0x62), `RESUMED` (0x63), `JAM` (0x61), plus `CHECKPOINT_INFO` (0x11) on every checkpoint hit and `REGISTER_INFO` (0x31) on every monitor open. The last two **share a response type with a legitimate command reply**, so demux must key on request-id and never resolve a pending request with an event.
- **Protocol**: `JAM` (0x61) has a **zero-length body**. `monitor_binary.c:384-394` computes the PC then passes `length = 0`, so no PC is sent. Every client surveyed assumes 2 bytes and breaks on it.
- **Protocol**: A non-stopping checkpoint emits a `CHECKPOINT_INFO` frame per hit **synchronously, over the blocking socket, from inside the CPU loop** — `mon_breakpoint.c:557-562` calls `mon_breakpoint_event()` before checking `cp->stop`. On a hot address this can stall the emulator thread. Independent source-level confirmation of `vice-sync.ts`'s "poll on `hit_count`, never on paused state" invariant.
- **Concurrency**: Stock VICE's binary monitor services **exactly one client**. A second `connect()` sits unserviced in the backlog with no reply and no EOF — indistinguishable from a wedge. The broker must guarantee single-client-per-instance and must not diagnose this state as a hang.
- **Protocol**: `DISPLAY_GET` (0x84) is INDEXED8-only and needs api_version ≥ 2; RGB conversion and PNG encoding move client-side.
- **Protocol**: No monotonic cycle register. `LIN`/`CYC` are readable but not monotonic; absolute cycles must be reconstructed or read from the text monitor's `stopwatch`.
- **Dependency**: `CPUHISTORY_GET` (0x86) requires **VICE ≥ 3.10**. Debian trixie/forky/sid and all current Ubuntu ship 3.9, which lacks the opcode entirely. Homebrew and official builds are fine.
- **Capability**: SID `$D400–$D418` is write-only in hardware and the binary monitor has no SID command — read-back is unrecoverable on stock. VIC-II/CIA *internal* state (raster-IRQ latch, timer latches) is likewise unavailable; only the readable register map is.
- **Capability**: Matrix keyboard is not recoverable on stock. `KEYBOARD_FEED` (0x72) injects buffer text only.
- **Tech stack**: Node ≥ 22.18 (native TypeScript type-stripping — the shipped server has no build step). Host-bound `.mts` files must still be compiled by `build.ts` into committed `resources/*.mjs`, and `resources-sync.test.ts` fails CI on drift.
- **Architecture**: Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`. The project maintains a tested closed consumer set for host-path logic.
- **Architecture**: The broker's single-owner `inFlight` launch guard must stay a synchronous check-and-set with no `await` between. It exists because of the 2026-08-01 triple-launch outage and is regression-tested.
- **Testing**: `vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested — their correctness only means anything against a real emulator's timing. Preserve the documented invariants (exactly one resume per wait; poll on `hit_count`, never on paused state).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add a stock-VICE backend rather than replacing the fork | The fork retains SID read-back and matrix keyboard; keeping it costs almost nothing since it already exists and is tested, and it removes the single-point-of-failure bet | — Pending |
| Backend selected project-level (one per MCP server process) via config | Simplest to implement and reason about; user chose it over launch-time probing and per-instance selection | — Pending |
| Parity verification runs two server processes, not one switching in-process | Forced by the project-level choice above — both backends cannot be live at once | — Pending |
| All three stock-only gain groups in scope, not parity-first | User elected the fuller scope; makes the milestone materially larger than the ADR's 7-phase plan | — Pending |
| Every tool kept in the manifest with per-backend support annotation | A tool degraded on stock may be fully supported on the fork; a single flag would lose that, and removing tools would change the surface shape between backends | — Pending |
| No SID write-shadowing mitigation | Switchability routes SID work to the fork; shadowing was never parity | — Pending |
| Ship a client-side 6502 disassembler | The binary monitor has none, and byte-identical output was explicitly ruled out as an acceptance bar | — Pending |
| Backend swap confined to the `call()` seam | `vice.ts` was built as the single transport seam for exactly this kind of change | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Current Milestone: v0.2.0 Switchable stock-VICE backend

**Goal:** Drive stock upstream VICE through its binary monitor as a second,
selectable backend — so the plugin runs on a VICE anyone can install — while the
existing fork backend keeps working unchanged for the capabilities only it has.

**Target features:**
- Project-level backend selection (`VICE_BACKEND`), fork backend unchanged
- Binary-monitor protocol client behind the `call()` seam, with async event demux
- Direct tools (1:1 opcode) and reimplemented derived tools, incl. a 6502 disassembler
- Client-side screenshot encoding from the INDEXED8 framebuffer + palette
- Broker launch support for `-binarymonitor` alongside `-mcpserver`
- Per-backend capability annotation across the whole tool surface
- Stock-only gains: CPU-history tracing, 1541 drive-CPU debugging, raster-precise checkpoints / palette / full resources
- Version detection (VICE ≥ 3.10) with graceful degradation
- Empirical probe against a real build, and a two-process parity harness

---
*Last updated: 2026-08-12 after initialization (bootstrapped from existing codebase map and ingested docs; milestone v0.2.0 opened)*
