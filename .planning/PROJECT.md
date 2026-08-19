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
- **Architecture**: The transport swap happens behind `vice.ts`'s `call()` seam for *direct* tools. **Derived tools must be intercepted before `forwardToVice()`, not behind `call()`** — `rewriteArguments()` runs at `vice-proxy.ts:2889` inside `forwardToVice()` and before `call()`, so a derived tool sitting behind `call()` receives host-translated paths and acts on them inside the container. Second site with the same cause: `gatherWedgeEvidence()` calls `rewriteArguments()` itself, at `vice-proxy.ts:1368`. (Line numbers in this bullet are checked against the source at each phase and drift between phases; treat a mismatch as drift to re-verify, not as evidence the constraint itself changed.)
- **Protocol (settled, normative)**: 11-byte request header / 12-byte response header, all multi-byte values little-endian. Confirmed opcode set and error codes per `docs/phase0-binmon-findings.md` §5.
- **Protocol**: **Five** unsolicited message types arrive at request-id `0xffffffff`, not three: `STOPPED` (0x62), `RESUMED` (0x63), `JAM` (0x61), plus `CHECKPOINT_INFO` (0x11) on every checkpoint hit and `REGISTER_INFO` (0x31) on every monitor open. The last two **share a response type with a legitimate command reply**, so demux must key on request-id and never resolve a pending request with an event.
- **Protocol**: `JAM` (0x61) has a **zero-length body**. `monitor_binary.c:384-394` computes the PC then passes `length = 0`, so no PC is sent. Every client surveyed assumes 2 bytes and breaks on it.
- **Protocol**: A non-stopping checkpoint emits a `CHECKPOINT_INFO` frame per hit **synchronously, over the blocking socket, from inside the CPU loop** — `mon_breakpoint.c:557-562` calls `mon_breakpoint_event()` before checking `cp->stop`. On a hot address this can stall the emulator thread. Independent source-level confirmation of `vice-sync.ts`'s "poll on `hit_count`, never on paused state" invariant.
- **Concurrency**: Stock VICE's binary monitor services **exactly one client**. A second `connect()` sits unserviced in the backlog with no reply and no EOF — indistinguishable from a wedge. The broker must guarantee single-client-per-instance and must not diagnose this state as a hang.
- **Protocol**: `default_memspace` contamination has no direct remedy over the binary monitor. A drive checkpoint hit sets it (`monitor.c:3393-3396`) and no command resets it, after which `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the *drive* CPU and `@bank:` conditions fail outright. Affects any stepping code written after drive debugging is added.
- **Protocol**: The wire memspace byte is **not** the internal enum — `0x00` = main, `0x01`–`0x04` = units 8–11 (`monitor_binary.c:401-434`). `0x08` is rejected.
- **Protocol**: Checkpoint *conditions* use the pseudo-registers `RL` and `CY` (uppercase), **not** the register-list names `LIN`/`CYC` — those lex as `BANKNAME` and produce a syntax error. Conditions have **no operator precedence** (`mon_parse.y:168`), so `RL == $64 && CY == $14` parses as `(((RL==$64) && CY) == $14)` and is always false; parenthesise every comparison. Bare integer literals are **hex** by default (`monitor.c:1597`), so `RL == 100` means line 256.
- **Protocol**: `CPUHISTORY_GET`'s count field is read as uint32 but stored in a `uint16_t` (`monitor_binary.c:1492`), so counts ≥ 65536 wrap. Clamp client-side to 65535.
- **Capability**: There is no runtime `WarpMode` resource (`vsync.c:220-241`, deliberately). Warp control on the stock backend must be launch-time (`-warp` / `InitialWarpMode`).
- **Capability**: Drive memory reads with true drive emulation off return **silent zeros, not an error**. The real gate is `Drive8TrueEmulation` plus a non-zero `Drive8Type` (`drive/drive-resources.c:450`); `check_drive_emu_level_ok()` is a machine-capability check that always passes on `x64sc`.
- **Safety**: Three resources power-cycle the machine one call deep, destroying all emulation state — `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency` (all reach `machine_trigger_reset(POWER_CYCLE)` at `c64/c64.c:1367`). Any resource-set tool exposed to an LLM must deny these.
- **Compatibility**: Resource names are not version-stable — `TrapDevice8` was `VirtualDevice8` before 3.10, renamed with no alias.
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

**Current state:** v0.2.0's phase work is complete — **all 9 executed phases closed**, Phase 8.2
(inserted) being the last, on 2026-08-19. Phase 6 was cut wholesale, so 9 of 10 phase-list
entries is the terminal figure for this milestone.

Phase 8.1 first ran the one unwitnessed claim — the install-to-RAM-capture walkthrough — and
**recorded it as failed**, which was the honest outcome: it surfaced a confirmed product defect
rather than a documentation gap, and deliberately declined to apply the known fix to manufacture
a pass. Phase 8.2 then closed that defect and re-ran the walkthrough to a real pass:

- **I-2 (the blocker):** the broker launched stock `x64sc` with `Drive8Type=0` (NONE), so no drive
  answered unit 8 and `LOAD"*",8,1` returned `?DEVICE NOT PRESENT ERROR`. Fixed at one site —
  `buildViceArgs()`'s stock branch now emits `-default -drive8type 1541` ahead of
  `-binarymonitor`, with the fork branch's argv byte-identical to before. The blast radius was
  **measured, not inferred**, and proved wider than the audit had guessed: a bare `.prg`
  autostart hit the identical wall, so it was **all program loads**, not just disk loads.
- **I-1:** production stock launches now get a per-instance scratch `XDG_CONFIG_HOME` that
  reaches the real `nodeSpawn()` on every path — cold acquire, warm-floor spare and
  crash-respawn — so an emulator never reads the operator's real `vicerc`. Proven through the
  real spawn composition rather than an injected stub.
- **I-3:** the red test gate is green; CI's own bare `npm test` reports zero failures, so the
  tagging push cannot produce a red run.
- **DIST-03, the milestone's stated finish line:** `c64-ram-capture` reached a verified
  65536-byte capture on a provably broker-launched genuine stock `x64sc` (VICE 3.9), approved by
  a human at a blocking gate. Two limitations are recorded rather than glossed: the artifact was
  a local checkout, not a published release, and an agent-proxy drove it rather than a human
  witness.
- Coverage added where its absence had hidden the defect: `stock-broker-live.test.ts` is the first
  test to launch through the real broker primitive instead of hand-spawning its own argv.

**Known open, tracked, non-blocking:** the `vice_keyboard_type` `LOAD` fallback route does not
progress within a bounded poll (FINDING-E2), and the `acme-build` scaffold cannot build on any
machine provisioned the documented way because the Debian `acme` package ships no `cbm/c64/*.a`
standard library — CI's own environment included (FINDING-A1). Also untested by design: no
VIC-II revision / PAL-vs-NTSC / board-revision matrix, and only drive type `1541` was exercised
— the defect fixed was *no drive at all*, and other board and drive variants remain an open
question rather than a verified claim.

**Previously:** Phase 2 (Stock Backend Connection) complete — 2026-08-13.
The server can now be pointed at a stock VICE and hold a correlated,
event-demultiplexed conversation with it: `stock-protocol.ts` (framing, parsing,
request-id-first demux), `stock-connect.ts` (the one connect handshake),
`stock-dispatch.ts` + `tools-manifest.stock.json` (a trimmed, separately committed
stock surface per D-07), `backend-detect.mts` (backend resolved once, cached per
binary), and broker support for `-binarymonitor` launch plus broker-enforced
single-monitor-client ownership. The fork path is untouched — `tools-manifest.json`
is byte-identical to the phase-start commit. Verified 5/5 success criteria,
16/16 requirements.

Two things about this phase constrain how much it proved. **No stock VICE binary
exists in this environment** (user ruling, 2026-08-13) *(Superseded 2026-08-19, during
Phase 8.1: this ruling is now known wrong. A genuine unpatched stock binary is present at
`/usr/bin/x64sc` (VICE 3.9) — the fork build at `/usr/local/bin/x64sc` merely shadows it on
`$PATH`, which is why bare-`x64sc` probes resolve to the fork. Phase 8.1 plan 04 drove
`c64-ram-capture` against that genuine binary and confirmed its identity from the broker log
and live `ps` argv. The synthetic-fixture caveat below still stands; the no-binary caveat does
not.)*: every line is written
against the normative spec, the three VERIF-02 fixtures are synthetic and stamped
as such, locked decision D-19 was explicitly overridden
(`docs/phase2-backend-probe-evidence.md`), and the `--help` backend discriminator
is recorded as an OPEN question rather than an answered one. And a post-execution
code review found **7 critical defects that all ten plans' green test suites had
reported as passing** — including a connect handshake that halted the emulator
with a bare `PING` and never sent the `EXIT` that resumes it, and a reap whose
identity guard was vacuously true for an empty identity. All 20 Critical+Warning
findings were fixed (`02-REVIEW-FIX.md`); the lesson worth carrying is that a
green suite written by the same pass that wrote the code proves less than it
looks like it does. Three follow-ups are tracked in `.planning/todos/pending/`:
re-record the fixtures against hardware, confirm the discriminator against real
stock and fork binaries, and settle whether CI's bare `npm test` or the narrowed
`test:automated` gate is correct.

**Previously:** Phase 3 (Direct Tools) complete — 2026-08-16. Every tool with a
1:1 binary-monitor opcode now works on the stock backend: memory and registers,
checkpoints and watchpoints with a typed condition builder, pause/resume/step/
until-return, and machine control (reset, autostart, disk attach, keyboard,
joystick, snapshots, bank/register enumeration). 18 plans across 4 waves, plus 5
gap-closure plans answering `03-UAT.md`.

**Phase 2's central constraint no longer holds.** That phase was written entirely
against the spec because "no stock VICE binary exists in this environment" (user
ruling, 2026-08-13). It does exist: a genuine unpatched stock VICE 3.9 at
`/usr/bin/x64sc`, distinct from the fork build at `/usr/local/bin/x64sc` that
shadows it on `$PATH`. Phase 3 therefore validated against real hardware-equivalent
behaviour rather than against the spec alone, and that is what caught the phase's
blocker: `vice_registers_set` refused **every** register, because the catalog read
VICE's `REGISTERS_AVAILABLE` size byte as *bytes* when the wire reports *bits*.
Unit tests had missed it for exactly the reason Phase 2's post-mortem warned about
— the fixtures stubbed the same wrong assumption the code made. The fix renames the
field `sizeBits`, derives the range check from it, and pins it with a wire-shaped
fixture built from the real 3.9 enumeration. `stock-live.test.ts` now re-verifies it
against the real binary on demand, and skips cleanly where none exists.

Two further gap-closure results worth carrying: `npm test` could previously hang
forever on a bare host (a listener opened before its `try` leaked when a precondition
threw), which silently converted a *failure* into an *infinite wait* — now fixed with
an `after()` registry and env-gated skips. And CI had not run against any Phase 01/02/03
commit since 2026-08-11; it now has — run `31972421757` against sha `f040d79`, conclusion
**success**, via a PR branch deliberately chosen over pushing `main`, since a push to
`main` auto-publishes both npm packages and the milestone is only 3 of 8 phases done.

Verified 8/9 must-haves plus one accepted override: disk **detach** is not implemented
on stock and will not be — the binary monitor has no detach opcode, so it falls outside
this phase's "1:1 equivalent" goal by definition. It is no longer an orphaned deferral;
Phase 7 now formally owns it in both ROADMAP.md and REQUIREMENTS.md. Three items still
need a human at a real emulator, tracked in `03-HUMAN-UAT.md`. A code review of the
gap-closure diff returned 0 critical / 8 warning; the two most useful are that the stock
manifest still advertises flag-bit register names the handler always refuses, and that
the new leak-prevention net covers only 1 of 4 server factories.

**Previously:** Phase 4 (Client-Side Tool Seam and 6510 Disassembler) complete —
2026-08-17. DERIV-07's derived-tool seam exists as sibling modules (`stock-derived.ts`
plus `withDerivedTool()` in `stock-dispatch.ts`), intercepting client-side tools *before*
`forwardToVice()` runs `rewriteArguments()`, so a derived tool structurally cannot receive
a host-translated path. `vice_disassemble` is its first consumer and is live on the stock
backend. 7 plans across 6 waves; all 5 success criteria verified; 1321 tests green.

**The real-assembler gate is what made this phase honest.** The opcode table was
transcribed from cc65 and pinned by an independent `aaabbbcc` bit-pattern derivation test,
and it still shipped 14 wrong `acmeExpressible` entries — caught only when 04-06 ran the
renderer's output through a real ACME 0.97 and compared bytes. Bare `jam` assembles to
`$02` no matter which of the 12 JAM opcodes it decoded from, and `anc #imm` always to
`$0B`, so 11 JAM entries and `$2B` were over-substituting: they would have emitted a
mnemonic that silently re-assembles to a *different byte*. Seven further entries were
under-substituting — byte-faithful, but seeded `false`, so they emitted `!byte` where ACME
accepts the mnemonic. Net: 221 of 256 opcodes are assembler-expressible, verified
byte-exact in both directions. A test written from the same understanding as the code
cannot find this class of error; only the external tool can.

**Four of seven plans had their own plan text corrected during execution**, nearly always
the same defect: a test whose expected value was read from the same live source that built
its input, making the acceptance criterion permanently green. 04-03's suite 6 was the
first (asserting `entry.length` against a stream built from `entry.length`); it was fixed
by asserting against `LENGTH_FOR_MODE` and proven non-vacuous by corrupting `$00` and
watching it fail. Both gates this phase added were likewise verified by watching them
fail, not by inspection: removing `THIRD-PARTY-NOTICES.md` from `files[]` makes
`check-npm-packages.mjs` reject publication, and with ACME absent under CI's
`VICE_REQUIRE_ACME=1` the round-trip hard-fails instead of skipping.

Independently cross-checked outside this codebase: all 256 instruction lengths re-derived
from oxyron.de (a source separate from cc65) with **0 mismatches**; the illegal-`NOP` class
re-counted as exactly 27 opcodes across 6 addressing-mode groups, confirming the
planning-time correction to the ROADMAP's stale "twelve"; and `vice_disassemble` live-tested
against genuine unpatched stock VICE 3.9, output byte-identical to that emulator's own
text-monitor `d`. Criterion 5 holds empirically — all four dependency blocks are
byte-identical to the phase-start commit, so the disassembler added zero npm dependencies.

Carried forward: no Active requirement graduates yet — Phase 4 delivered only the
disassembler slice of "tools the fork implemented in-emulator are reimplemented
client-side"; backtrace, sprite decode and chip-state decode remain Phase 5. One code-review
Warning is open and worth closing *before* Phase 5 consumes the decoder: `decode()`'s
`startAddress` accepts any non-negative safe integer and silently wraps via `& 0xffff`,
harmless today only because `parseAddress()` bounds the single current call site, while the
decoder is explicitly the direct import surface for Phase 5's backtrace and Phase 6's
CPU-history decode. `04-HUMAN-UAT.md` tracks one deployment-observable item: CI has never
run this work, since all commits are local and `origin/main` is 298 behind. A separate
pre-existing tracking gap surfaced at completion: `UP-01`, `UP-02`, `QUAL-01..03` appear in
REQUIREMENTS.md's body but not its traceability table — it predates Phase 4 and belongs to
whichever phase owns those IDs.

**Current state:** Phase 5 (Skill-Critical Derived Tools) complete — 2026-08-17. All four
DERIV families the shipped skills call now work on the stock backend: memory search/compare
(DERIV-01), the symbol store and address resolution (DERIV-04), decoded VIC-II and CIA state
(DERIV-05 read side), and sprite read/inspect with ASCII rendering (DERIV-06 read side).
13 plans; all 5 success criteria verified; 1426 tests green, 0 fail.

**One defect class accounted for this entire phase's rework, and only the real emulator
found it.** All four chip and sprite reads hardcoded `bank: 0x0000` — the *CPU* view, which
follows `$00`/`$01` banking. With I/O banked out (`$01 = $34`) every tool returned
`isError:false` and plausible, fully-"available" values decoded from the RAM *underneath* the
I/O area: `borderColour:15`, `rasterLine:256`, CIA joystick `raw:255`. Nothing moved to
`unavailable`, because the defect arrived through the bank argument, not the field registry
that the phase had carefully built. Every unit suite was green. Verification failed criteria 3
and 4, and five gap-closure plans (05-09..05-13) closed it by resolving the emulator's *own*
`io`/`ram` bank ids through one new seam, `resolveRequiredBank()`, which refuses rather than
falling back when a build reports no such bank.

**The same anti-pattern then survived gap closure twice more, in smaller form.** A
post-closure review found `tod.tenths` still fabricating an impossible decimal (`tenths: 15`)
from a non-BCD nibble while its three siblings had been hardened — conforming to its own
schema, so an agent trained to trust `invalidBcd` would read it as measured. And
`vice_memory_banks` reported 5 banks where the wire enumerates 6, which mattered beyond its
own answer because the same map feeds `resolveRequiredBank()`'s refusal text: a refusal could
tell an agent that a working bank name did not exist. Both are fixed, with 7 of 16 findings
closed (`05-REVIEW-FIX.md`). The lesson is narrower and sharper than Phase 2's: a registry
that marks unavailable fields cannot defend against a wrong *address*, and only a live read
with I/O banked out distinguishes the two.

Live evidence is now first-class rather than incidental: `stock-live.test.ts` runs 10 cases
against genuine unpatched stock VICE 3.9 at `/usr/bin/x64sc`, including the `$01 = $34`
regression for both chip state and sprites. It stays out of `test:automated` (it is in
`test-gate.mjs`'s `MANUAL_ONLY_TESTS`), so it must be run deliberately — worth remembering,
since the automated suite cannot catch a break in it.

Carried forward as tracked debt, each judged against the five criteria and breaking none:
`WR-07` (the `mode:'snapshot'` refusal and two docs promise a time dimension `mode:'ranges'`
lacks — now quoted in a third place), `WR-08` (`truncated` set on an exact-boundary result,
with a dead `!truncated` conjunct), `WR-09` (`stock-sprites.ts` re-deriving constants
`stock-vicii.ts` exports), `WR-10` (a structurally unfailable derived-path test), `WR-11`
(dead code across the derived modules), and `IN-01..IN-04` — including `IN-04`, where
`sound-and-input.md` documents the joystick bits without mentioning the new `confounded`
field. Phase 4's open decoder bound (`decode()`'s `startAddress` silently wrapping via
`& 0xffff`) was not consumed by this phase and remains open for whichever phase adds
backtrace. The `UP-01`/`UP-02`/`QUAL-01..03` traceability note above is confirmed a false
positive of a body-vs-table scan: those IDs sit under "Future Requirements — deferred, not in
this roadmap", and the v0.2.0 traceability table is correct to omit them, as it is to omit the
proposed `R2000-*` v0.3.0 set.

**Previously:** Phase 8 (Capability Honesty and the Install Story) complete —
2026-08-18, and it is the milestone's last phase. `capability-registry.ts` is now
the single runtime-importable home for the 26-entry per-backend capability delta,
deliberately shaped like `vice.ts`'s `DENY_LIST` / `denyListRefusalMessage()` pair.
Four consumers read it and none holds a copy: `vice-proxy.ts`'s `tools/call` miss
branch (strictly after `DENY_LIST`), the generator behind `docs/tool-support.md`,
the skill-honesty lint, and `check-skill-tool-coverage.mjs` — whose literal
duplicate array this phase deleted, closing the **D-E** debt its own header comment
had asked for. `docs/tool-support.md` is this repository's first generated markdown
file: 63 rows derived from the two shipped manifests plus three mechanically
discovered synthetic tools, with **zero** hand-curated exclusions, guarded by the
same generate-into-scratch-then-byte-diff mechanism `resources-sync.test.ts` uses
for compiled resources. README gained the install story — per-ecosystem VICE
versions, the `VICE_BACKEND` choice and its consequences — and lost two false
claims, including an assertion that two guardrail test files existed when neither
was anywhere in the repository. Verified 4/4 success criteria, 5/5 requirements.

**The phase's own deliverables contained the failure class it exists to remove**,
and only executing the documentation caught it. Running the README's own install
instructions in a fresh `debian:trixie` container failed outright — Debian ships
`vice` in `contrib`, not `main` — a defect in a section written minutes earlier and
reviewed as correct. The post-execution code review then found two more: README
called `VICE_BACKEND` "one config value" in `.mcp.json` while `vice-proxy.ts`'s own
mismatch error says it "must be set for both" processes, and
`capabilityRefusalMessage()` rendered `entry.alternative` only in its `descoped`
branch — while all five entries carrying one are `hardware`, so the field was dead
at exactly the surface `BACK-05` exists for. The generated table, four skill files
and README all printed the stock route; the runtime refusal alone dropped it. Two
green test suites had passed over it because the hardware case tested
`vice_sid_get_state` and the descoped case `vice_memory_fill`, neither of which has
an alternative. All three are fixed and pinned. Thirteen review warnings were
consciously left; `WR-14` is the one to revisit — skill prose presents
`vice_joystick_set` as the stock route for a keyboard-matrix gate, where the
registry itself only hedges "covers most in-game input".

One item stays open by design: `08-HUMAN-UAT.md` records the plugin-install plus
`c64-ram-capture` walkthrough as `pending`, since its interactive half needs a live
session. The install half was executed live and is what caught the `contrib` defect.

Next: v0.2.0's phase work is complete — `/gsd-audit-milestone` then
`/gsd-complete-milestone`.

---
*Last updated: 2026-08-19 after Phase 8.2 completion — the inserted phase that closed v0.2.0's last three blockers and turned Phase 8.1's honest `failed` walkthrough into a real, human-approved pass: the `Drive8Type=0` defect fixed at one site, production config isolation threaded end to end through every spawn path, the red CI gate cleared before the tagging push, and the first live test that launches through the real broker primitive rather than hand-spawning its own argv. The blast radius was measured rather than inferred and proved wider than the audit had assumed. Re-verified 7/7 after closing two stale verification documents; every figure asserted as self-consistency rather than a pinned literal, per Phase 8.1's twice-learned lesson.*
