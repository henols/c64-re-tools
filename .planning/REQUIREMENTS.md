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
- [~] **DIRECT-06**: User can reset the machine, autostart a PRG or disk image, and attach disks on the stock backend — *attach half delivered in Phase 3; **detach** deferred to Phase 7, because stock VICE's binary monitor exposes no detach opcode (D-13 in `03-CONTEXT.md`, `docs/stock-vice-parity.md`). Phase 7 owns it as its success criterion 4.*
- [x] **DIRECT-07**: User can type text and drive the joystick on the stock backend
- [x] **DIRECT-08**: User can save and restore emulator snapshots on the stock backend
- [x] **DIRECT-09**: User can enumerate available memory banks and registers on the stock backend

### Derived tools

- [ ] **DERIV-01**: User can search, compare, and fill memory ranges on the stock backend
- [ ] **DERIV-02**: User can get a call backtrace on the stock backend
- [ ] **DERIV-03**: User can group checkpoints and set an ignore count on the stock backend
- [ ] **DERIV-04**: User can load a symbol file and have addresses resolved to symbol names
- [ ] **DERIV-05**: User can read decoded VIC-II and CIA state on the stock backend, with unavailable internal fields explicitly marked unavailable rather than reported as zero
- [ ] **DERIV-06**: User can inspect and set sprites, including ASCII rendering, on the stock backend
- [ ] **DERIV-07**: Derived tools are implemented in sibling modules, not appended to `vice-proxy.ts`, and are intercepted before argument rewriting so they never receive host-translated paths

### Disassembler

- [ ] **DISASM-01**: User can disassemble a memory range on the stock backend
- [x] **DISASM-02**: Disassembly decodes all 256 opcodes including the undocumented 6510 set, with correct instruction lengths
- [ ] **DISASM-03**: Disassembly output reassembles through ACME, verified by a round-trip test with documented exclusions
- [ ] **DISASM-04**: Branch instructions render the resolved target address, not the raw offset
- [ ] **DISASM-05**: A partial instruction at the end of a range is reported as truncated rather than fabricated
- [ ] **DISASM-06**: Symbol substitution is applied only where it cannot change the encoding, using operand role and width
- [ ] **DISASM-07**: The disassembler adds no npm dependency and no GPL-licensed material

### Screenshots

- [ ] **SHOT-01**: User can capture a screenshot on the stock backend and receives a valid PNG
- [ ] **SHOT-02**: Screenshot capture adds no npm dependency
- [ ] **SHOT-03**: Screenshot returns a file path, preserving parity with the fork backend and with incident-record bookkeeping
- [ ] **SHOT-04**: Screenshot content is visible to Claude as an image, not only as a text-encoded data URI
- [ ] **SHOT-05**: Capture behaviour with respect to torn frames is either avoided by capturing while paused, or documented

### Stock-only capabilities

- [ ] **GAIN-01**: User can retrieve a CPU instruction-history trace with registers and cycle timestamps, on builds that support it
- [ ] **GAIN-02**: On a build without CPU-history support, the trace tool explains what is missing and what version provides it
- [ ] **GAIN-03**: User can set checkpoints, read registers, and read memory on a 1541 drive CPU
- [ ] **GAIN-04**: Drive debugging with true drive emulation disabled reports that explicitly, rather than returning zeros that look like data
- [ ] **GAIN-05**: Stepping and conditions behave correctly after a drive checkpoint hit, despite `default_memspace` contamination
- [ ] **GAIN-06**: User can break at an exact raster line and cycle, with conditions built so operator-precedence and hex-literal traps cannot produce a silently-false condition
- [ ] **GAIN-07**: User can read the emulator's exact palette
- [ ] **GAIN-08**: User can get and set VICE resources beyond today's whitelist
- [ ] **GAIN-09**: Resources that power-cycle the machine, break the monitor connection, or destroy observed state are denied or gated behind explicit intent

### Timing

- [ ] **TIME-01**: User can measure elapsed CPU cycles on the stock backend, on any supported VICE version
- [ ] **TIME-02**: User can run until an address is reached, exactly
- [ ] **TIME-03**: Cycle-bounded execution is either supported or reports its approximation honestly
- [ ] **TIME-04**: `vice-wedge-triage`'s "is the emulator advancing" check works on the stock backend

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
- [ ] **VERIF-03**: Tool output is compared between backends for a known program, with expected divergences documented rather than treated as failures
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
| DERIV-01 | Phase 5 | Pending |
| DERIV-02 | Phase 5 | Pending |
| DERIV-03 | Phase 5 | Pending |
| DERIV-04 | Phase 5 | Pending |
| DERIV-05 | Phase 5 | Pending |
| DERIV-06 | Phase 5 | Pending |
| DERIV-07 | Phase 4 | Pending |
| DISASM-01 | Phase 4 | Pending |
| DISASM-02 | Phase 4 | Complete |
| DISASM-03 | Phase 4 | Pending |
| DISASM-04 | Phase 4 | Pending |
| DISASM-05 | Phase 4 | Pending |
| DISASM-06 | Phase 4 | Pending |
| DISASM-07 | Phase 4 | Pending |
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
| TIME-01 | Phase 7 | Pending |
| TIME-02 | Phase 7 | Pending |
| TIME-03 | Phase 7 | Pending |
| TIME-04 | Phase 7 | Pending |
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

**Coverage:**
- v0.2.0 requirements: 68 total
- Mapped to phases: 68
- Unmapped: 0 ✓

*Count correction: an earlier version of this block stated 63 total. The file
contains 67 requirement items (BACK 5, BROK 3, DERIV 7, DIRECT 9, DISASM 7,
DIST 3, DOC 3, GAIN 9, PROTO 8, SHOT 5, TIME 4, VERIF 4). Corrected during
roadmap creation.*

**Requirements per phase:** Phase 1: 5 · Phase 2: 16 · Phase 3: 9 · Phase 4: 8 ·
Phase 5: 11 · Phase 6: 9 · Phase 7: 4 · Phase 8: 5

---
*Requirements defined: 2026-08-12*
*Last updated: 2026-08-12 after roadmap creation (traceability populated, count corrected 63 -> 67)*
