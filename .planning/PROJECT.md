# c64-re-tools

## What This Is

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects. It ships a `vice` MCP server
driving a host VICE emulator through an on-demand broker, plus six C64
reverse-engineering skills, distributed both as two npm packages
(`@henols/vice-mcp`, `@henols/c64-re-tools`) and as a Claude Code plugin.

**As of v0.2.0 the plugin runs on a VICE anyone can install.** Two backends are
selectable per project: the **stock** backend drives unmodified upstream `x64sc`
through its binary monitor and advertises **38 tools**; the **fork** backend
drives [barryw/vice-mcp](https://github.com/barryw/vice-mcp)'s `-mcpserver` HTTP
endpoint and advertises **62**, unchanged from v0.1.x. The stdio surface is
*trimmed per backend*, not made uniform — a tool on both keeps its name and a
backward-compatible argument shape, and the three capabilities stock provably
cannot have (`vice_sid_get_state`, `vice_keyboard_matrix`,
`vice_keyboard_restore`) refuse by name and say which backend provides them.

## Core Value

A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

*Still correct after v0.2.0.* Shipping the second backend did not shift it; the
milestone widened *which* emulator qualifies as "a real C64 emulator" without
changing what the session needs to do with it.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Claude drives a host VICE emulator through a stable `vice_*` stdio MCP surface — existing, v0.1.x
- ✓ Emulator instances are pooled on demand with port allocation, warm floor, and crash supervision — existing, v0.1.x
- ✓ A crashed or wedged emulator is detected and recycled without losing evidence (incident record written before any kill) — existing, v0.1.x
- ✓ Tool calls work from inside a container against an emulator on the host, with every path translated at the boundary — existing, v0.1.x
- ✓ Six C64 RE skills usable as playbooks: `acme-build`, `c64-memory-mapping`, `c64-program-recon`, `c64-provenance-diff`, `c64-ram-capture`, `vice-wedge-triage` — existing, v0.1.x
- ✓ Installable two ways: `npx @henols/c64-re-tools` into any project, or as a Claude Code plugin — existing, v0.1.x
- ✓ Releases are automated: CI typechecks, tests, validates both npm tarballs, and publishes via OIDC trusted publishing on `v*` tags — existing, v0.1.x
- ✓ User selects which VICE backend the MCP server drives, project-level, without editing code — v0.2.0 (`VICE_BACKEND`, resolved once per broker process by `backend-detect.mts`)
- ✓ The tool surface works against an unmodified upstream `x64sc` from apt / Homebrew / official builds — v0.2.0 (proven live against genuine stock VICE 3.9 at `/usr/bin/x64sc`)
- ✓ The fork backend keeps working exactly as it does today when selected — v0.2.0 (`tools-manifest.json` byte-identical; fork argv byte-identical; standing regression gate at every phase boundary)
- ✓ A binary-monitor protocol client speaks stock VICE's wire format, correlating replies and demultiplexing unsolicited events — v0.2.0 (request-id-first demux across all five event types, never resolving a pending request with an event)
- ✓ Tools with a 1:1 binary-monitor equivalent work on the stock backend — v0.2.0 (memory, registers, checkpoints, watchpoints, step, reset, joystick, snapshots, autostart, banks, ping)
- ✓ Tools the fork implemented in-emulator are reimplemented client-side — v0.2.0 (memory search/compare, symbol store, 6510 disassembler, sprite decode, VIC-II/CIA state decode; **scoped to what the skills call** — see Out of Scope)
- ✓ The broker launches stock VICE with binary-monitor flags as well as the fork with `-mcpserver` — v0.2.0 (incl. the `-default -drive8type 1541` ordering invariant, regression-pinned)
- ✓ Every tool declares its support level per backend, so a user is told which backend restores a capability — v0.2.0 (`capability-registry.ts`, 26 entries, four consumers and no copies)
- ✓ The client detects the connected VICE's version and degrades gracefully when a capability is absent — v0.2.0 (`CPUHISTORY_GET`'s three-way answer settled once per binary)
- ✓ The binary-monitor assumptions are confirmed empirically against a real VICE build before client design is locked — v0.2.0 (13-check probe run against stock 3.9 and fork 3.10; all five UNVERIFIED items resolved)
- ✓ Cycle timing and "is the emulator still advancing" work on the stock backend — v0.2.0
- ✓ A user can install this from a package manager and is never silently given a wrong answer by a backend that cannot do the thing — v0.2.0 (`docs/tool-support.md` generated from both manifests with a byte-identity drift guard)
- ✓ Five load-bearing assumptions checked against a real regenerator2000 build before any plan is written, with the pty/HTTP-MCP one gating the rest — Phase 9 (`R2000-16`; verdict `degrade` via rule `R4`, see [`docs/phase9-regenerator2000-probe-findings.md`](../docs/phase9-regenerator2000-probe-findings.md))

### Active

<!-- Next scope: milestone v0.3.0, regenerator2000 static-analysis backend. Proposed, not opened. -->

- [ ] regenerator2000 is adopted as a **static-analysis** backend and is never launched with `--vice`, guarded in code rather than only documented (`R2000-01`)
- [ ] It runs on the same side of the container boundary as the MCP proxy, so no path translation applies — and a devcontainer, and two projects open at once, both work without an upstream patch (`R2000-02`)
- [ ] It is a declared prerequisite named in the install documentation alongside VICE, with its Apache-2.0 notice in `THIRD-PARTY-NOTICES.md` (`R2000-03`)
- [ ] `acme-build`'s `disasm` verb and its `toacme`-on-PATH prerequisite are removed, replaced by a regenerator2000 route (`R2000-05`)
- [ ] A `.prg` or flat 64K capture becomes reassemblable ACME source matching this project's `!cpu 6510` expectations, **verified by reassembly** rather than asserted (`R2000-06`)
- [ ] Project bootstrap from a raw binary is automated rather than a documented manual step (`R2000-09`)
- [ ] `c64-program-recon` writes findings as queryable annotation state, not only Markdown prose, so a later session can query instead of re-deriving (`R2000-10`)
- [ ] A user can ask which addresses reference a given address, and search labels, comments and instructions across an analysed program (`R2000-11`)
- [ ] Enum definitions are generated from `c64-memory-mapping`'s `memmap.json`, so register writes render with semantic names instead of magic numbers (`R2000-13`)
- [ ] Symbols annotated in regenerator2000 export as VICE label files into the symbol store, and names discovered live flow back — closing the round trip (`R2000-14`, `R2000-15`)

### Out of Scope

<!-- Explicit boundaries, with reasoning to prevent re-adding. -->

- **Client-side SID write-shadowing mitigation** — switchability supersedes it. SID read-back routes to the fork backend, which retains `vice_sid_get_state`. Shadowing could only ever capture writes the client itself issued, never the running program's, so it was never parity. (Resolves ingest WARNING W1.)
- **Removing or deprecating the fork backend** — it is the hedge against stock's three hard losses (SID read-back, matrix keyboard, RESTORE/NMI) and the reason this migration is not a bet. Its incremental maintenance cost is near zero since it already exists and is tested. *Reaffirmed at v0.2.0 close: the fork's 62-tool surface shipped unchanged.*
- **Upstreaming a `KEYBOARD_MATRIX_SET` opcode to VICE** — genuinely worth doing (~60 lines in `monitor_binary.c` calling `keyboard_set_keyarr_any`, and it would close the hardest loss for everyone), but it is an upstream contribution, not a deliverable of this project. Recorded as a follow-up.
- **Byte-identical output parity with the fork** — explicitly not an acceptance bar. Disassembly formatting and illegal-opcode rendering differ from VICE's own, per `docs/stock-vice-parity.md` §A.7. *v0.2.0 dropped the two-process parity harness (`VERIF-03`) for exactly this reason: it would have measured something the project does not promise.*
- **Matrix-keyboard equivalence on the stock backend** — proven not recoverable at source level. `read_ciapb()` recomputes from `keyarr` on every read, and watchpoints fire after the load completes. `JOYPORT_SET` covers most in-game input instead.
- **Distributed / multi-host broker** — outside the current single-host architecture; no demand established.
- **Fixing the unauthenticated emulator endpoint exposure** — real (documented in `.planning/codebase/CONCERNS.md`), but a property of the external fork and its `0.0.0.0` bind, not of this project's scope.
- **Tool surplus on either backend, absent a caller** *(added v0.2.0, 2026-08-17)* — 17 requirements were cut against one measured test: *does a shipped skill call it, or does something a skill calls depend on it?* Cut: client-side screenshots and the PNG encoder (`SHOT-01..05`), call backtrace (`DERIV-02`), checkpoint groups and ignore counts (`DERIV-03`), memory fill and every `*_set_state` write half, all nine stock-only gains (`GAIN-01..09`, Phase 6 entire), disk detach, and the parity harness. Each stays in `milestones/v0.2.0-REQUIREMENTS.md` marked `CUT` with rationale, so restoring one is a scope decision rather than archaeology. **The fork's other 33 uncalled tools are surplus, not a gap.**
- **Uniform tool lists across backends** *(added v0.2.0)* — superseded the original "the MCP surface must not change" constraint and `.planning/intel/decisions.md`'s `DEC-preserve-mcp-surface`. Stock advertises only what it implements. A skill written against the full fork surface therefore *breaks* on stock rather than degrading, which is why the playbooks must name the stock route or the fork requirement.

## Context

**Where this stands.** v0.2.0 shipped 2026-08-19: 9 phases, 87 plans, 51/51
in-scope requirements, 8 days. The exit route off the fork is built and proven —
a user with an apt-installed VICE can run the six shipped skills, and is told
plainly where they must reach for the fork instead. The final audit (round 4)
returned `tech_debt`, not `passed`: nothing is broken and the tree is green, but
the accumulated deferred work is large enough to deserve an explicit decision
rather than silent inheritance.

**Current codebase state.** ~54k lines added outside `.planning/` across 151
files this milestone. Node ≥ 22.18, TypeScript run directly via native
type-stripping (no build step for the shipped server). Stock backend: 38 tools,
9 of them derived client-side. Fork backend: 62 tools, unchanged.
`docs/tool-support.md` is the repository's first generated markdown file.

**The lesson this milestone taught, four times, in escalating forms.** A test
written by the same pass that wrote the code proves less than it looks like it
does. Phase 2's green suites hid 7 critical defects. Phase 3's fixtures stubbed
the same bits-vs-bytes assumption the code made. Phase 4's opcode table was pinned
by an independent bit-pattern derivation and *still* shipped 14 wrong entries —
caught only by running output through a real ACME. Phase 5's registry could mark
fields unavailable but could not defend against a wrong *bank address*, so every
chip read returned plausible values decoded from RAM underneath the I/O area. In
every case the external check — a real assembler, a real emulator, a real
container, a real broker launch — found what the internal one could not. Phase 8.1
is the cleanest instance: running the one unwitnessed claim *falsified* it.

**Known debt carried into v0.3.0.** 13 items acknowledged at close (see
`STATE.md` → Deferred Items): 12 tracked pending todos and Phase 03's three
open human-UAT scenarios. The highest-value three are the synthetic VERIF-02 wire
fixtures, the unconfirmed `--help` backend discriminator, and the four Phase 3
wire details written spec-driven and never exercised. Separately: `vice-proxy.ts`
remains large and is the sole tool-surface seam — client-side derivations go in
sibling modules, never appended to it.

**Existing planning context (do not re-derive).** `.planning/codebase/` holds the
codebase map. `.planning/intel/` holds the ingested doc set: decisions,
constraints, `CAND-*` scope items, and resolutions. `.planning/INGEST-CONFLICTS.md`
records two user-resolved precedence warnings (W1, W2).
`.planning/notes/regenerator2000-integration.md` grounds v0.3.0 (D-R1..D-R4).

**Shipping history.** Newest tag `v0.2.0`; both npm packages published at 0.2.0.
The planning label `v0.2.0` and the published npm semver currently coincide at
0.2.0 but are determined independently — every merge to `main` auto-publishes a
patch version unless the subject contains `[skip release]`, so npm can run ahead
of the planning label at any time.

## Constraints

- **Compatibility**: The stdio MCP surface is **trimmed per backend** — stock advertises only the tools it implements, so the two backends expose different tool lists (Phase 2, D-07). A tool advertised on both keeps the same name and a backward-compatible argument shape — stock may add optional parameters but never removes, retypes, or newly-requires one — and the fork's list is unchanged from v0.1.x. A skill written against the full fork surface therefore *breaks* on stock rather than degrading; the playbooks must name the stock route or the fork requirement (SKILL-01). *(Supersedes the original "the surface must not change" constraint, and is pinned by `manifest-arg-compat.test.ts`.)*
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
| Add a stock-VICE backend rather than replacing the fork | The fork retains SID read-back and matrix keyboard; keeping it costs almost nothing since it already exists and is tested, and it removes the single-point-of-failure bet | ✓ Good — v0.2.0 shipped both; the fork's 62-tool surface is byte-identical to v0.1.x |
| Backend selected project-level (one per MCP server process) via config | Simplest to implement and reason about; user chose it over launch-time probing and per-instance selection | ✓ Good — `backend-detect.mts` resolves once per broker process with an on-disk cache |
| Parity verification runs two server processes, not one switching in-process | Forced by the project-level choice above — both backends cannot be live at once | ⚠️ Revisit — the harness (`VERIF-03`) was **dropped**: `PROJECT.md` already declares byte-identical parity a non-goal, so it would have measured an unpromised property. The generated `docs/tool-support.md` gives the user the same information |
| All three stock-only gain groups in scope, not parity-first | User elected the fuller scope; makes the milestone materially larger than the ADR's 7-phase plan | ⚠️ Revisit — **reversed 2026-08-17.** `GAIN-01..09` and all of Phase 6 were cut: no shipped skill calls any of them. Capability surplus, not a gap |
| Every tool kept in the manifest with per-backend support annotation | A tool degraded on stock may be fully supported on the fork; a single flag would lose that, and removing tools would change the surface shape between backends | ⚠️ Revisit — **reversed by D-07.** The stock manifest is genuinely trimmed to 38 tools. Per-backend honesty moved into `capability-registry.ts`'s runtime refusal plus the generated support table, which serve the same goal better than a manifest annotation would have |
| No SID write-shadowing mitigation | Switchability routes SID work to the fork; shadowing was never parity | ✓ Good — held all milestone; `vice_sid_get_state` refuses on stock by name |
| Ship a client-side 6510 disassembler | The binary monitor has none, and byte-identical output was explicitly ruled out as an acceptance bar | ✓ Good — 221/256 opcodes assembler-expressible, round-tripped byte-exact through real ACME 0.97; live output byte-identical to VICE's own text-monitor `d` |
| Backend swap confined to the `call()` seam | `vice.ts` was built as the single transport seam for exactly this kind of change | ⚠️ Revisit — true for *direct* tools only. **Derived tools must be intercepted before `forwardToVice()`**, since `rewriteArguments()` runs inside it and ahead of `call()`; a derived tool behind `call()` receives host-translated paths and acts on them inside the container. Phase 4 built `withDerivedTool()` as the second seam |
| Cut scope by measured caller, not by judgment (2026-08-17) | Diffing the six skills' actual `vice_*` usage against both manifests answers "is this needed" mechanically | ✓ Good — 29 open requirements → 14, Phase 6 removed whole, and every cut names its requirements so reversal is a scope decision |
| Trim the stock manifest instead of keeping surface shape uniform (D-07) | Advertising a tool the backend cannot serve is the dishonesty the milestone exists to remove | ✓ Good — and it forced `SKILL-01`: playbooks now name the stock route or the fork requirement at the point of use |
| Run the walkthrough for real rather than assert it (Phase 8.1) | The one claim in the milestone with no witness was the install-to-capture flow | ✓ Good — and it **failed**, exposing the `Drive8Type=0` defect. Phase 8.2 fixed it and re-ran to a verified 65536-byte capture. The cheapest defect this milestone found came from refusing to assume |
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


## Current State

**Shipped: v0.2.0 Switchable stock-VICE backend** — 2026-08-19.
9 phases, 87 plans, 218 tasks, 51/51 in-scope requirements, 8 days.
Full record: [`MILESTONES.md`](MILESTONES.md) ·
[`milestones/v0.2.0-ROADMAP.md`](milestones/v0.2.0-ROADMAP.md) ·
[`milestones/v0.2.0-MILESTONE-AUDIT.md`](milestones/v0.2.0-MILESTONE-AUDIT.md)

The plugin no longer requires a custom VICE build. Stock upstream `x64sc` is a
first-class, project-selectable backend with 38 tools; the fork keeps its 62 and
is the documented route for the three capabilities stock provably cannot have.
The install story, the per-backend support table, and the playbook routes all
ship. The definition of done was never parity — it was *"a user with an
apt-installed VICE can run the six shipped skills, and is told plainly where they
must reach for the fork instead"* — and that is what was verified, end to end,
against a genuine `/usr/bin/x64sc` (VICE 3.9), through the real broker.

**Audit verdict: `tech_debt`, no blockers.** Nyquist fully compliant across all
nine phases. 13 items acknowledged as deferred at close (`STATE.md` → Deferred
Items), none of them blocking a tag.

**Shipped.** `v0.2.0` is tagged on the remote and is an ancestor of
`origin/main`; both npm packages are published at 0.2.0; every local tag is
pushed; the working tree is in sync with `origin/main`.

**Phase 9 complete — the assumption probe returned `degrade`.** 2026-08-20.
8 plans, 5 waves, no product code: the deliverable is evidence. `regenerator2000
0.9.20` was driven for real, and four of the five assumptions hold — the pty
tolerates a non-TTY, the Save-As bootstrap completes **with no human**, ACME
reassembly is byte-identical once `use_illegal_opcodes` is on, and an unmodified
`--export_lbl` file is consumed by the live `vice_symbols_load`. The fifth is a
genuine `partial`: a `.vsf` carries its start address, but its machine type reads
correct only by coincidence — `"C64SC"` matches none of regenerator2000's literal
arms, so it falls through to that tool's own C64 default, and a non-C64 snapshot
would be misreported. Rule `R4` therefore fired, not `R3`: **the bootstrap is not
the degraded element**, so Phase 10 still delivers automation. Verdict and all
five criteria: [`docs/phase9-regenerator2000-probe-findings.md`](../docs/phase9-regenerator2000-probe-findings.md).

## Current Milestone: v0.3.0 regenerator2000 static-analysis backend

**Goal:** Adopt regenerator2000 as a static-analysis-only backend so recon findings
become queryable, undoable state instead of Markdown prose — and the symbol round
trip between static annotation and the live emulator finally closes.

**Target features:**
- The `R2000-16` assumption probe answered against a real build, as a standalone
  go/no-go gate before any further plan is written — the pty/HTTP-MCP question
  decides whether project bootstrap is automatable at all
- regenerator2000 adopted static-analysis-only, never launched with `--vice`,
  guarded in code rather than only documented; runs container-side so no path
  translation applies
- Project bootstrap from a raw binary automated rather than a documented manual step
- `acme-build`'s `disasm` verb and its `toacme`-on-PATH prerequisite removed,
  replaced by a route whose output is verified by reassembly
- `c64-program-recon` writes labels, comments, block types and scopes into a
  queryable annotation store; a later session queries instead of re-deriving
- Cross-reference and search over an analysed program
- Enums generated from `c64-memory-mapping`'s `memmap.json`, so register writes
  render with semantic names instead of magic numbers — neither project can do
  this alone
- The symbol round trip: annotations export as VICE label files into the symbol
  store, and names discovered live flow back

**Key context:**
- **Structurally independent of v0.2.0.** regenerator2000 never touches VICE, so it
  behaves identically on both backends. Only Phase 11's `DERIV-04`-on-stock
  dependency reaches back into v0.2.0 at all.
- **The probe gates the milestone, not just its first phase.** If regenerator2000
  cannot be driven without a human, the annotation store is unreachable from a
  skill and the milestone should be *reconsidered* rather than replanned. That is
  why it is its own phase with an explicit gate rather than a criterion inside a
  larger one.
- **Required prerequisite, not an optional accelerator** (D-R2). Optional-with-
  detection was rejected: it forbids any removal, since every skill would need a
  working fallback, and it adds a third axis of conditionality on top of
  stock-vs-fork.
- **Install story regresses on its own axis.** No release assets exist upstream, so
  install is `cargo install regenerator2000` — a Rust toolchain. Accepted when D-R2
  was reaffirmed.
- Research is **not** owed: `.planning/notes/regenerator2000-integration.md` is the
  research, source-read at `ricardoquesada/regenerator2000@main`, with three
  upstream blockers confirmed at file:line and a verified overlap map.
- 12 of 16 `R2000-*` requirements are in scope; `R2000-04`, `-07`, `-08` and `-12`
  were folded or cut on 2026-08-17 with rationale recorded in ROADMAP.md.

## Next Milestone Goals

**Beyond v0.3.0** — nothing scoped yet. The standing candidates, in the order
their cost is currently understood:

1. **The carried debt, dispositioned rather than inherited again.** 13 items were
   accepted at v0.2.0's close (`STATE.md` -> Deferred Items) and the round-4 audit
   assessed the set as `tech_debt`. The three highest-value are the synthetic
   `VERIF-02` wire fixtures, the unconfirmed `--help` backend discriminator, and
   the four Phase 3 wire details written spec-driven and never exercised against a
   real binary. Each is a case of the same lesson: an internal check standing in
   for an external one.
2. **The upstream contributions**, already recorded as out of scope here but
   genuinely worth doing: a `KEYBOARD_MATRIX_SET` opcode for VICE's binary monitor
   (~60 lines, closes stock's hardest loss for everyone), and regenerator2000's
   `--mcp-port` / `--mcp-bind` (~5 lines total, unblocks two projects at once and a
   host-side TUI).
3. **`QUAL-01..03`** — tests for `acme.mjs` / `driver.mjs` / `derive.mjs`, orphaned
   planning references in source comments, and the emulator control-plane network
   exposure.

**Shipped since this section was last written:** v0.2.0 reached users on
2026-08-19 — npm `0.2.0` for both packages, tag and GitHub Release at `089127a`,
plugin zip attached. The version number is now resolved from a single `VERSION`
template rather than hand-maintained in six places; see README's "Publishing
(maintainers)".

<details>
<summary>Previous milestone detail — v0.2.0 phase-by-phase narrative (archived 2026-08-19)</summary>

**v0.2.0 Switchable stock-VICE backend — as it was tracked during execution:**

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
`/gsd-complete-milestone`. *(Both were run: audit round 4 returned `tech_debt` with
no blockers, and the milestone was archived and tagged on 2026-08-19.)*

</details>

---
*Last updated: 2026-08-20 after Phase 9 close (`R2000-16` graduated to Validated; assumption-probe verdict `degrade`/`R4` recorded). Previously: 2026-08-19 at v0.2.0 milestone close. Full evolution review performed: "What This Is" rewritten to a shipped two-backend description, Core Value re-checked and kept, 12 requirements graduated to Validated, Active replaced with the v0.3.0 `R2000-*` set, two new Out of Scope boundaries recorded (measured-caller scope cuts; non-uniform tool lists), the superseded "surface must not change" constraint replaced with D-07's trimmed-per-backend rule, and all eight original Key Decisions given outcomes — four ✓ Good, four ⚠️ Revisit, three of those four genuinely reversed during the milestone.*
