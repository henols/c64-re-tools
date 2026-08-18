# Requirements: c64-re-tools — milestone v0.2.0 Switchable stock-VICE backend

**Defined:** 2026-08-12
**Core Value:** A Claude session can reliably drive a real C64 emulator to reverse-engineer a program — read and write memory, set checkpoints, capture RAM, inspect chip state — and keep working when the emulator misbehaves.

Requirements are grounded in `.planning/research/` (3,553 lines, source-verified against
`VICE-Team/svn-mirror` @ `e50d42c` = VICE 3.10.0) and the scope resolutions in
`.planning/intel/requirements.md`.

## v0.2.0 Requirements

### Docs correctness (prerequisite)

- [x] **DOC-01**: `docs/phase0-binmon-findings.md` no longer asserts that pause-on-demand requires a checkpoint, that `REGISTERS_GET` cannot source a stopwatch, or that CPU history's compile flag is the availability risk — and states the real gate (VICE ≥ 3.10)
- [x] **DOC-02**: `docs/phase0-binmon-findings.md` and `docs/stock-vice-parity.md` name the condition-parser pseudo-registers as `RL`/`CY`, so no downstream plan writes a condition on `LIN` and gets error `0x8f`
- [x] **DOC-03**: `.planning/intel/constraints.md` reflects the corrected findings, and `CON-stopwatch-via-cpuhistory` is no longer marked PROVISIONAL-on-CPU-history

### Backend selection

- [x] **BACK-01**: User selects which VICE backend the server drives by setting one config value, without editing code
- [x] **BACK-02**: User running the fork backend sees behaviour identical to v0.1.x — no regression in any tool
- [x] **BACK-03**: User can ask which backend is active and which VICE version is connected, and gets an answer naming both
- [x] **BACK-04**: Server detects at connect time whether the connected VICE supports each version-gated capability, rather than failing at first use
- [ ] **BACK-05**: Calling a tool the active backend does not advertise returns an error that names the capability, the reason, and which backend provides it — not a generic unknown-tool error, and never a silent wrong answer. Under D-07 the manifest is trimmed per backend, so on stock this is the out-of-manifest `tools/call` path rather than a present-but-refusing tool

### Protocol client

- [x] **PROTO-01**: Client reassembles messages from arbitrary TCP chunk boundaries, buffering until a full header plus body is present
- [x] **PROTO-02**: Client correlates each response to its request by request id, so concurrent in-flight commands cannot be confused
- [x] **PROTO-03**: Client demultiplexes all five unsolicited message types (`STOPPED`, `RESUMED`, `JAM`, `CHECKPOINT_INFO`, `REGISTER_INFO`) and never resolves a pending request with an event, including when the event shares a response type with a legitimate reply
- [x] **PROTO-04**: Client handles a zero-length `JAM` body without throwing and without desynchronising the stream
- [x] **PROTO-05**: Client surfaces a protocol error code as a distinguishable failure, not as an empty success
- [x] **PROTO-06**: Client detects that the emulator died or restarted underneath it and reports that distinctly from a timeout
- [x] **PROTO-07**: Client handles the largest binary-monitor response (a full `DISPLAY_GET` frame, ~157 KB) without truncation
- [x] **PROTO-08**: A second client connecting to an instance is prevented or reported as a conflict, never diagnosed as a wedged emulator

### Direct tools

- [x] **DIRECT-01**: User can read and write emulator memory on the stock backend, without triggering I/O side effects on read
- [x] **DIRECT-02**: User can read and write CPU registers on the stock backend
- [x] **DIRECT-03**: User can set, list, delete, toggle, and condition checkpoints and watchpoints on the stock backend
- [x] **DIRECT-04**: User can step instructions and execute-until-return on the stock backend
- [x] **DIRECT-05**: User can pause a freely-running emulator on demand and resume it
- [~] **DIRECT-06**: User can reset the machine, autostart a PRG or disk image, and attach disks on the stock backend — *attach half delivered in Phase 3. **Detach CUT 2026-08-17** — no skill calls `vice_disk_detach`, stock VICE's binary monitor exposes no detach opcode (D-13 in `03-CONTEXT.md`, `docs/stock-vice-parity.md`), and attaching a different image covers the workflow. No longer owned by Phase 7.*
- [x] **DIRECT-07**: User can type text and drive the joystick on the stock backend
- [x] **DIRECT-08**: User can save and restore emulator snapshots on the stock backend
- [x] **DIRECT-09**: User can enumerate available memory banks and registers on the stock backend

### Derived tools

- [x] **DERIV-01**: User can search and compare memory ranges on the stock backend *(narrowed 2026-08-17: `fill` cut — no skill calls `vice_memory_fill`)*
- [-] **CUT 2026-08-17** — no skill calls `vice_backtrace`. Original: **DERIV-02**: User can get a call backtrace on the stock backend
- [-] **CUT 2026-08-17** — no skill calls any `vice_checkpoint_group_*` or `vice_checkpoint_set_ignore_count`. Original: **DERIV-03**: User can group checkpoints and set an ignore count on the stock backend
- [x] **DERIV-04**: User can load a symbol file and have addresses resolved to symbol names *(completed Phase 5; `outputSchema` conformance defect WR-01 — `query.address` echoed as a raw string — fixed 2026-08-17 in plan 05-11)*
- [x] **DERIV-05**: User can read decoded VIC-II and CIA state on the stock backend, with unavailable internal fields explicitly marked unavailable rather than reported as zero *(narrowed 2026-08-17: read side only — no skill calls `vice_vicii_set_state` or `vice_cia_set_state`)* *(this mark was premature when first set: 05-VERIFICATION.md live-falsified it via CR-01 — all chip reads used the banking-dependent CPU view. Genuinely complete after plan 05-09 (io-bank resolution + live `$01 = $34` regression) and plan 05-12 (confounded joystick and BCD honesty))*
- [x] **DERIV-06**: User can read and inspect sprites, including ASCII rendering, on the stock backend *(narrowed 2026-08-17: read side only — no skill calls `vice_sprite_set`)* *(completed Phase 5; the CPU-view-bank defect CR-02 and the hi-res/multicolour legend defect fixed 2026-08-17 in plan 05-10, with a live regression in `stock-live.test.ts`)*
- [x] **DERIV-07**: Derived tools are implemented in sibling modules, not appended to `vice-proxy.ts`, and are intercepted before argument rewriting so they never receive host-translated paths

### Disassembler

- [x] **DISASM-01**: User can disassemble a memory range on the stock backend
- [x] **DISASM-02**: Disassembly decodes all 256 opcodes including the undocumented 6510 set, with correct instruction lengths
- [x] **DISASM-03**: Disassembly output reassembles through ACME, verified by a round-trip test with documented exclusions
- [x] **DISASM-04**: Branch instructions render the resolved target address, not the raw offset
- [x] **DISASM-05**: A partial instruction at the end of a range is reported as truncated rather than fabricated
- [x] **DISASM-06**: Symbol substitution is applied only where it cannot change the encoding, using operand role and width
- [x] **DISASM-07**: The disassembler adds no npm dependency and no GPL-licensed material

### Screenshots

- [-] **CUT 2026-08-17** — no skill calls `vice_display_screenshot`; incident capture degrades cleanly via `captureStep()`. Original: **SHOT-01**: User can capture a screenshot on the stock backend and receives a valid PNG
- [-] **CUT 2026-08-17** — see SHOT-01. Original: **SHOT-02**: Screenshot capture adds no npm dependency
- [-] **CUT 2026-08-17** — see SHOT-01. Original: **SHOT-03**: Screenshot returns a file path, preserving parity with the fork backend and with incident-record bookkeeping
- [-] **CUT 2026-08-17** — see SHOT-01. Original: **SHOT-04**: Screenshot content is visible to Claude as an image, not only as a text-encoded data URI
- [-] **CUT 2026-08-17** — see SHOT-01. Original: **SHOT-05**: Capture behaviour with respect to torn frames is either avoided by capturing while paused, or documented

### Stock-only capabilities

- [-] **CUT 2026-08-17** — entire Phase 6 cut; capability surplus, not a gap. Original: **GAIN-01**: User can retrieve a CPU instruction-history trace with registers and cycle timestamps, on builds that support it
- [-] **CUT 2026-08-17** — entire Phase 6 cut; capability surplus, not a gap. Original: **GAIN-02**: On a build without CPU-history support, the trace tool explains what is missing and what version provides it
- [-] **CUT 2026-08-17** — entire Phase 6 cut; capability surplus, not a gap. Original: **GAIN-03**: User can set checkpoints, read registers, and read memory on a 1541 drive CPU
- [-] **CUT 2026-08-17** — entire Phase 6 cut; capability surplus, not a gap. Original: **GAIN-04**: Drive debugging with true drive emulation disabled reports that explicitly, rather than returning zeros that look like data
- [-] **CUT 2026-08-17** — entire Phase 6 cut; capability surplus, not a gap. Original: **GAIN-05**: Stepping and conditions behave correctly after a drive checkpoint hit, despite `default_memspace` contamination
- [-] **CUT 2026-08-17** — entire Phase 6 cut; capability surplus, not a gap. Original: **GAIN-06**: User can break at an exact raster line and cycle, with conditions built so operator-precedence and hex-literal traps cannot produce a silently-false condition
- [-] **CUT 2026-08-17** — entire Phase 6 cut; capability surplus, not a gap. Original: **GAIN-07**: User can read the emulator's exact palette
- [-] **CUT 2026-08-17** — entire Phase 6 cut; capability surplus, not a gap. Original: **GAIN-08**: User can get and set VICE resources beyond today's whitelist
- [-] **CUT 2026-08-17** — entire Phase 6 cut; capability surplus, not a gap. Original: **GAIN-09**: Resources that power-cycle the machine, break the monitor connection, or destroy observed state are denied or gated behind explicit intent

### Timing

- [x] **TIME-01**: User can measure elapsed CPU cycles on the stock backend, on any supported VICE version *(re-verified 2026-08-18: 07-11/07-12 closed CR-01's decode-failure regression, and 07-13 live-proved `stockConnect()` resolving with the correct capability against both genuine `/usr/bin/x64sc` (VICE 3.9.0.0, `cpuHistory:"absent"`) and `/usr/local/bin/x64sc` (VICE 3.10.0.0, `cpuHistory:"available"`), with a real ~500ms Route A bracket measuring an exact cycle count)*
- [x] **TIME-02**: User can run until an address is reached, exactly *(the reach/timeout mechanism was already live-proven against both binaries in 07-10; 07-14 additionally closed WR-01/WR-02's misreporting defects — unit-proven, `stock-run-until.test.ts` 21/21 — not independently re-exercised live by this gap-closure batch)*
- [x] **TIME-03**: Cycle-bounded execution is either supported or reports its approximation honestly *(re-verified 2026-08-18: Route B's wraparound refusal was already live-proven on genuine VICE 3.9; 07-12/07-13 closed the Route A decode defect and live-proved it on genuine VICE 3.10.0.0)*
- [x] **TIME-04**: `vice-wedge-triage`'s "is the emulator advancing" check works on the stock backend — **Complete (07-15, 07-16, 07-17, quick-260818-obc).** `machinePaused` derivation (WR-03, 07-15), the advertised-schema fix (WR-07, 07-16), `checkpoint_trap`, `wedged` (both capability routes) and a test-performed `restarted` respawn were already live-proven (07-17). quick-260818-obc closed BOTH remaining residuals in one real broker-mediated run against genuine stock VICE, on both `/usr/bin/x64sc` (3.9) and `/usr/local/bin/x64sc` (3.10): (1) the **broker-mediated** `monitor_held_elsewhere` verdict — a real second `claimMonitor()` refusal from the real broker control plane, naming the other grant's real id, settling in 1ms (bound 10000ms) on both binaries; (2) the **broker-supervised** (not test-performed) `restarted` respawn — the host broker's own crash supervision genuinely relaunched the killed instance, and `vice_diagnose` answered `restarted` with the real `baselineEpoch`/`currentEpoch` pair (1→2 on both binaries), at zero emulator cost, before the test ever touched grant B

### Broker and launcher

- [x] **BROK-01**: Broker launches stock VICE with binary-monitor flags, and the fork with its existing flags, chosen by backend
- [x] **BROK-02**: Broker guarantees one monitor client per emulator instance
- [x] **BROK-03**: Existing broker guarantees survive the change — single in-flight launch, crash supervision, incident record before kill

### Distribution and documentation

- [ ] **DIST-01**: The full tool inventory is documented with its per-backend availability, so a user can see which tools each backend advertises without running anything — including tools absent from the active backend's trimmed manifest (D-07)
- [ ] **DIST-02**: A new user can read what VICE they need, where to get it, and what differs per version — including that the fork is required for SID read-back and matrix keyboard
- [ ] **DIST-03**: Installing the plugin and stock VICE from a package manager is sufficient to drive the emulator

### Skill playbooks

- [ ] **SKILL-01**: The skills whose documented methodology depends on fork-only capabilities name the stock-backend route or state the fork requirement, so Claude following a playbook is not sent into a refusal — covering `c64-program-recon`'s `vice_keyboard_matrix` instruction and whole-chip-read guidance, `c64-ram-capture`'s matrix-keyboard "hit any key" step, and `vice-wedge-triage`'s stopwatch bracket

### Verification

- [x] **VERIF-01**: The binary-monitor probe has been run against a real stock VICE build and its results recorded
- [x] **VERIF-02**: Protocol client behaviour is unit-tested against recorded or stubbed frames, including the malformed and event-interleaved cases
- [-] **CUT 2026-08-17** — byte-identical parity is an explicit non-goal in PROJECT.md. Original: **VERIF-03**: Tool output is compared between backends for a known program, with expected divergences documented rather than treated as failures
- [x] **VERIF-04**: The five items the research flagged UNVERIFIED are resolved empirically or recorded as accepted unknowns

## Future Requirements

Deferred. Tracked, not in this roadmap.

### Upstream contribution

- **UP-01**: A `KEYBOARD_MATRIX_SET` opcode is contributed to upstream VICE, closing the matrix-keyboard loss for all users
- **UP-02**: Once upstream matrix keyboard exists, the stock backend gains key-hold, chords, and RESTORE/NMI

### Deferred quality work

- **QUAL-01**: The three untested skill scripts (`acme.mjs`, `driver.mjs`, `derive.mjs`) gain test coverage
- **QUAL-02**: Source comments citing planning documents that never travelled into this repo are reconciled or stripped
- **QUAL-03**: Network exposure of the emulator control plane is documented or restricted

## Out of Scope

| Feature | Reason |
|---------|--------|
| Client-side SID write-shadowing | Switchability routes SID work to the fork backend. Shadowing can only capture writes the client issued, never the program's — never parity. Resolves ingest W1. |
| Removing or deprecating the fork backend | It is the hedge against the two hard losses and the reason this is not a one-way bet. Near-zero incremental cost — already written and tested. |
| Matrix-keyboard equivalence on stock | Proven unrecoverable at source: `read_ciapb()` recomputes from `keyarr` per read; watchpoints fire after the load. `JOYPORT_SET` covers most in-game input. |
| Byte-identical disassembly vs VICE | Explicitly ruled out by `docs/stock-vice-parity.md` §A.7. ACME round-trip is the acceptance bar instead — and VICE's tables are GPL-2, incompatible with this MIT project. |
| Runtime warp-mode control on stock | No runtime `WarpMode` resource exists in VICE (`vsync.c:220-241`, deliberate). Launch-time only. |
| Cropping the screenshot to the inner rect | `raster_screenshot()` sets the inner rect equal to the full frame and no chip overrides it — cropping from those fields is a no-op. |
| Distributed / multi-host broker | Outside the current single-host architecture; no demand established. |
| Vendoring the VICE fork's source | Out of this project's control; the fork publishes prebuilt releases. |

## Traceability

Populated during roadmap creation (2026-08-12). Every v0.2.0 requirement maps to
exactly one phase. See `.planning/ROADMAP.md` for phase goals, success criteria,
and the sequencing rationale.

**Status vocabulary:** `Complete` (or `Complete (plan-id, ...)`) — every claim is
backed by evidence in the cited plan's SUMMARY, live proof where the requirement
calls for it. `Pending` — not yet started. `Partial` (introduced 2026-08-18,
plan 07-18) — the core mechanism is built and at least unit-tested, but a
specific piece of live proof the requirement or its verification report calls
for is recorded as still outstanding (not merely "not yet attempted") in a named
plan SUMMARY; the checklist item stays `[ ]` until that proof lands. Do not mark
`Complete` from intent — mark it from the evidence a SUMMARY actually records.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOC-01 | Phase 1 | Complete |
| DOC-02 | Phase 1 | Complete |
| DOC-03 | Phase 1 | Complete |
| BACK-01 | Phase 2 | Complete |
| BACK-02 | Phase 2 | Complete |
| BACK-03 | Phase 2 | Complete |
| BACK-04 | Phase 2 | Complete |
| BACK-05 | Phase 8 | Pending |
| PROTO-01 | Phase 2 | Complete |
| PROTO-02 | Phase 2 | Complete |
| PROTO-03 | Phase 2 | Complete |
| PROTO-04 | Phase 2 | Complete |
| PROTO-05 | Phase 2 | Complete |
| PROTO-06 | Phase 2 | Complete |
| PROTO-07 | Phase 2 | Complete |
| PROTO-08 | Phase 2 | Complete |
| DIRECT-01 | Phase 3 | Complete |
| DIRECT-02 | Phase 3 | Complete |
| DIRECT-03 | Phase 3 | Complete |
| DIRECT-04 | Phase 3 | Complete |
| DIRECT-05 | Phase 3 | Complete |
| DIRECT-06 | Phase 3 (attach) / Phase 7 (detach) | Partial — attach complete; detach deferred, no stock opcode |
| DIRECT-07 | Phase 3 | Complete |
| DIRECT-08 | Phase 3 | Complete |
| DIRECT-09 | Phase 3 | Complete |
| DERIV-01 | Phase 5 | Complete |
| DERIV-02 | Phase 5 | Pending |
| DERIV-03 | Phase 5 | Pending |
| DERIV-04 | Phase 5 | Complete (05-11) |
| DERIV-05 | Phase 5 | Complete (05-09, 05-12) |
| DERIV-06 | Phase 5 | Complete (05-10) |
| DERIV-07 | Phase 4 | Complete |
| DISASM-01 | Phase 4 | Complete |
| DISASM-02 | Phase 4 | Complete |
| DISASM-03 | Phase 4 | Complete |
| DISASM-04 | Phase 4 | Complete |
| DISASM-05 | Phase 4 | Complete |
| DISASM-06 | Phase 4 | Complete |
| DISASM-07 | Phase 4 | Complete |
| SHOT-01 | Phase 5 | Pending |
| SHOT-02 | Phase 5 | Pending |
| SHOT-03 | Phase 5 | Pending |
| SHOT-04 | Phase 5 | Pending |
| SHOT-05 | Phase 5 | Pending |
| GAIN-01 | Phase 6 | Pending |
| GAIN-02 | Phase 6 | Pending |
| GAIN-03 | Phase 6 | Pending |
| GAIN-04 | Phase 6 | Pending |
| GAIN-05 | Phase 6 | Pending |
| GAIN-06 | Phase 6 | Pending |
| GAIN-07 | Phase 6 | Pending |
| GAIN-08 | Phase 6 | Pending |
| GAIN-09 | Phase 6 | Pending |
| TIME-01 | Phase 7 | Complete (07-11, 07-12, 07-13) |
| TIME-02 | Phase 7 | Complete (07-10, 07-14) |
| TIME-03 | Phase 7 | Complete (07-12, 07-13) |
| TIME-04 | Phase 7 | Complete (07-15, 07-16, 07-17, quick-260818-obc) |
| BROK-01 | Phase 2 | Complete |
| BROK-02 | Phase 2 | Complete |
| BROK-03 | Phase 2 | Complete |
| DIST-01 | Phase 8 | Pending |
| DIST-02 | Phase 8 | Pending |
| DIST-03 | Phase 8 | Pending |
| SKILL-01 | Phase 8 | Pending |
| VERIF-01 | Phase 1 | Complete |
| VERIF-02 | Phase 2 | Complete |
| VERIF-03 | Phase 8 | Pending |
| VERIF-04 | Phase 1 | Complete |

**Coverage (revised 2026-08-17 after the scope cut):**
- v0.2.0 requirements defined: 68
- **Cut**: 21 (`DERIV-02`, `DERIV-03`, `SHOT-01`..`SHOT-05`, `GAIN-01`..`GAIN-09`, `VERIF-03`, plus the `DIRECT-06` detach half and the `fill`/`*_set_state` halves of `DERIV-01`/`05`/`06`)
- **In scope**: 47 — 39 already complete, **8 open** *(revised 2026-08-18, quick
  task 260818-obc: Phase 7's contribution to this total moves from 1 open to 0
  open — `TIME-04` is now genuinely `Complete`, its last two residuals
  (broker-mediated `monitor_held_elsewhere`, broker-supervised `restarted`)
  closed in one real broker-mediated live run against genuine stock VICE on
  both `/usr/bin/x64sc` and `/usr/local/bin/x64sc`. This is a +1 complete / -1
  open delta on the previous 38/9 split (itself set by plan 07-18, which
  moved Phase 7 from 4 open to 1 open on `TIME-01`/`TIME-02`/`TIME-03`'s own
  gap-closure evidence, 07-11..07-14). The per-phase breakdown below is not
  fully exhaustive across every phase — e.g. `DIRECT-06` (Phase 3, `Partial`)
  is not itemised in it — so this total should not be read as independently
  re-derived from a full per-phase audit; only Phase 7's own contribution was
  corrected by 07-18 and by this task*)
- Mapped to phases: 47 · Unmapped: 0 ✓

**Open requirements per phase:** Phase 5: **0** — all four (`DERIV-01`,
`DERIV-04`, `DERIV-05`, `DERIV-06`) complete; the per-phase line previously
double-counted `DERIV-01` as open when the checklist already marked it `[x]`
Complete, a second stale number found and fixed alongside DERIV-04/05/06
(plan 05-13) · Phase 6: **cut** · Phase 7: **0** (`TIME-04` is now `Complete`
per quick task 260818-obc's own live broker-mediated evidence, closing the
last open Phase 7 item; `TIME-01`/`TIME-02`/`TIME-03` were already `Complete`
per the gap-closure evidence above. This line previously read "1 (`TIME-04`
only ...)", corrected here to 0 now that TIME-04 itself is closed) · Phase 8:
5 (`BACK-05`, `DIST-01`, `DIST-02`, `DIST-03`, `SKILL-01`)

### The cut criterion

Every cut above was decided by one test: **does a shipped skill call the tool, or
does something a skill calls depend on it?** Measured by diffing the six skills'
actual `vice_*` usage against `tools-manifest.json` (62 tools) and
`tools-manifest.stock.json` (26 tools):

- The skills call **28** tools.
- **16** already work on stock — Phase 3 delivered them.
- **10** are buildable and missing: `vice_memory_search`, `vice_memory_compare`,
  `vice_symbols_load`, `vice_symbols_lookup`, `vice_vicii_get_state`,
  `vice_cia_get_state`, `vice_sprite_get`, `vice_sprite_inspect` (Phase 5);
  `vice_cycles_stopwatch`, `vice_run_until` (Phase 7).
- **2** are provably impossible on stock — `vice_sid_get_state` (SID registers are
  write-only in hardware) and `vice_keyboard_matrix` (`read_ciapb()` recomputes
  from `keyarr` on every read). These need `BACK-05` + `SKILL-01` + `DIST-02`,
  i.e. honesty, not code. That is Phase 8, and it is why Phase 8 is the phase the
  milestone exists for.
- The fork's other **34** tools are called by no skill. They are not a gap.

The finish line is therefore *"a user with an apt-installed VICE can run the six
shipped skills, and is told plainly where they must reach for the fork"* — not
parity with the fork.

---

## v0.3.0 Requirements — regenerator2000 static-analysis backend (PROPOSED, not active)

**Defined:** 2026-08-17 from `/gsd-explore`. **Not counted in the v0.2.0 coverage
totals above.** Grounded in `.planning/notes/regenerator2000-integration.md`
(decisions D-R1..D-R4, source-confirmed upstream blockers). These become active
when v0.2.0 completes and the milestone is opened; until then they are a scoped
proposal, not a commitment.

### Constraints (bound the rest)

- [ ] **R2000-01**: regenerator2000 is **never** launched with `--vice`. The launch path refuses to pass it, guarded in code rather than only documented — mirroring the `DENY_LIST` pattern in `vice.ts`. Rationale: stock VICE's binary monitor serves exactly one client and a second connection is indistinguishable from a wedge (D-R1)
- [ ] **R2000-02**: regenerator2000 runs on the same side of the container boundary as the MCP proxy, so no host/container path translation is applied to any argument passed to it — and a user in a devcontainer, and two projects open at once in separate devcontainers, both work without an upstream patch (D-R4)
- [ ] **R2000-03**: regenerator2000 is a declared prerequisite of the plugin, named in the install documentation alongside VICE, with its Apache-2.0 notice recorded in `THIRD-PARTY-NOTICES.md` (D-R2)
- [-] **CUT 2026-08-17** — folded into Phase 9 install documentation as a stated limitation. Original: **R2000-04**: A user who tries to open two regenerator2000 projects in one network namespace is told why it fails and what the upstream gap is, rather than seeing a bind error or a silent hang — the port is hardcoded to 3000 with a bare boolean `--mcp-server` flag

### Tier 1 — batch CLI, no MCP server

- [ ] **R2000-05**: `acme-build`'s `disasm` verb and its `## Disassembly` documentation section are removed, replaced by a regenerator2000 route; the `toacme`-on-PATH prerequisite is dropped from the skill
- [ ] **R2000-06**: A user can turn a `.prg` or a flat 64K capture into reassemblable ACME source whose illegal opcodes match this project's `!cpu 6510` expectations, verified by reassembly rather than asserted
- [-] **CUT 2026-08-17** — HTML export: no skill produces or consumes it. Original: **R2000-07**: A user can produce an HTML disassembly artifact with clickable cross-references from an analysed program
- [-] **CUT 2026-08-17** — reduced to a note on Phase 9 criterion 2. Original: **R2000-08**: A program depacked in the real emulator can be handed to regenerator2000 for static analysis, using a VICE `.vsf` snapshot in preference to a flat `.raw` because snapshots carry memory, machine type and start address while `.raw` loads at origin `$0000` with no CLI override — and regenerator2000's own sandbox unpacker is documented as the fast path for the packers it recognises, with the emulator route as the fallback for custom loaders and disk-based loads
- [ ] **R2000-09**: Project bootstrap from a raw binary is automated, not a documented manual step: a skill can turn a `.prg` or snapshot into a `.regen2000proj` without a human, by driving HTTP MCP mode under a pty and calling `r2000_save_project`. If `R2000-16`'s pty check fails, this degrades to a documented one-time interactive step and every affected playbook says so rather than describing a pipeline that cannot run

### Tier 2 — MCP server and the annotation store

- [ ] **R2000-10**: `c64-program-recon` writes its findings as queryable annotation state — labels, comments, block types, scopes — not only as Markdown prose, and a later session can query that state instead of re-deriving it
- [ ] **R2000-11**: A user can ask which addresses reference a given address, and search labels, comments and instructions across an analysed program
- [-] **CUT 2026-08-17** — folded into v0.2.0 SKILL-01, same playbook pass. Original: **R2000-12**: `c64-program-recon`'s tool-selection reference tells Claude which questions are static (block classification, cross-references, routine boundaries) and which require the running machine (what actually executes, live IRQ vectors, self-modifying code), so neither substrate is used for the other's job
- [ ] **R2000-13**: Enum definitions are generated from `c64-memory-mapping`'s `memmap.json`, so per-bit VIC-II/SID/CIA register writes render with semantic names instead of magic numbers in a disassembly

### The symbol round trip

- [ ] **R2000-14**: Symbols annotated in regenerator2000 are exported as VICE label files and consumed by DERIV-04's symbol store, so live addresses resolve to names the user chose
- [ ] **R2000-15**: Names discovered against the running machine flow back into the annotation store via label import, closing the round trip rather than being a one-way dump

### Verification owed before planning

- [ ] **R2000-16**: Before any plan is written, five assumptions are checked against a real regenerator2000 build and the results recorded in the repo: (a) whether HTTP MCP mode runs under a pty with no real TTY, which decides whether project bootstrap is automatable — this one gates the rest; (b) whether `--export_asm --assembler acme` output reassembles under `!cpu 6510`; (c) whether `--export_lbl` emits a format DERIV-04's symbol store consumes as-is; (d) whether a `.vsf` from `vice_snapshot_save` loads with the expected machine type and start address; (e) container-side Rust toolchain build time and image size. Any that fails is recorded as an accepted limit stating what it breaks

**Coverage (revised 2026-08-17 after the scope cut):** 16 proposed → **12 in
scope**, 4 cut or folded (`R2000-04` folded into Phase 9's install docs,
`R2000-07` HTML export cut, `R2000-08` reduced to a note on Phase 9 criterion 2,
`R2000-12` folded into v0.2.0's `SKILL-01`). Two phases, not four.

**Per phase:** Phase 9: `R2000-16`, `R2000-01`, `R2000-02`, `R2000-03`,
`R2000-05`, `R2000-06`, `R2000-09` · Phase 10: `R2000-10`, `R2000-11`,
`R2000-13`, `R2000-14`, `R2000-15`

---
*Requirements defined: 2026-08-12*
*Last updated: 2026-08-17 — appended proposed v0.3.0 R2000-* block from `/gsd-explore`; v0.2.0 totals unchanged at 68/68*
