# Roadmap: c64-re-tools

## Milestones

- 🚧 **v0.2.0 Switchable stock-VICE backend** — Phases 1-8, 8.1 (all requirements met; audit close-out in 8.1)
- 📋 **v0.3.0 regenerator2000 static-analysis backend** — Phases 9-10 (proposed, not opened)

**Scope was cut on 2026-08-17** against a single test: *does a shipped skill call
it, or does something a skill calls depend on it?* Measured by diffing the six
skills' actual `vice_*` usage against `tools-manifest.json` and
`tools-manifest.stock.json`. v0.2.0 went from 29 open requirements across 4
phases to 14 across 3; v0.3.0 from 16 across 4 phases to 12 across 2. See "Cut
from scope" in each milestone.

# Milestone v0.2.0: Switchable stock-VICE backend

## Overview

The plugin's whole tool surface currently only works against a non-upstream VICE
fork. This milestone adds a second, project-selectable backend that drives
**stock upstream VICE** through its binary monitor, without changing the stdio
MCP surface Claude sees and without giving up the fork's two exclusive
capabilities.

The journey runs: fix the normative protocol documents and prove the protocol
against a real build (Phase 1) → make the server able to launch, select, and
correctly converse with a stock VICE (Phase 2) → port the tools that map 1:1
onto binary-monitor opcodes (Phase 3) → build the client-side tool seam and the
6510 disassembler that several later tools depend on (Phase 4) → build the eight
skill-called tools stock lacks (Phase 5) → restore cycle timing and wedge triage,
the last two (Phase 7) → make both backends honest about the two capabilities
stock provably cannot have, and ship an install story (Phase 8).

**The finish line is not parity with the fork.** It is: a user with an
apt-installed VICE can run the six shipped skills, and is told plainly where they
must reach for the fork instead. The skills call 29 tools; 16 already work on
stock, 10 are buildable and are Phases 5 and 7, and 3 are impossible
(`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`) and are
Phase 8's job to route honestly. The fork's other 33 tools are called by no
skill and are not a gap.

## Standing Constraints

These hold across every phase. They are deliberately **not** repeated as
per-phase success criteria — repeating them would dilute each phase's criteria
without adding a check that the test suite does not already run.

- **BACK-02 (fork backend unchanged, no regression)** is scoped as its own
  success criterion in **Phase 2**, the phase that introduces the switch and is
  therefore the only phase where a fork-path regression can first be introduced
  by construction. From Phase 3 onward it is enforced as a standing gate: the
  existing fork-backend test suite must pass unchanged at every phase boundary,
  and any phase that touches a shared seam (`vice.ts`'s `call()`,
  `vice-proxy.ts`'s dispatch, `rewriteArguments()`, the broker launch path) must
  show the fork path exercised. **Decision: one criterion in Phase 2, plus a
  standing regression gate — not a criterion repeated per phase.**

- **The stdio MCP surface is trimmed per backend, not made uniform.** Stock
  advertises only the tools it actually implements, so the two backends expose
  **different tool lists** — this is the shipped end state, not scaffolding
  (Phase 2, D-07). What does not change: a tool advertised on both backends has
  the **same name and the same argument shape** on both, and the fork backend's
  advertised list is unchanged from v0.1.x. Consequence, carried by SKILL-01:
  a skill written against the full fork surface **breaks** on stock rather than
  degrading, so the playbooks must name the stock route or the fork requirement.
  **This supersedes** the earlier "the surface must not change" constraint and
  `.planning/intel/decisions.md`'s `DEC-preserve-mcp-surface`.

- **The broker's single-owner `inFlight` launch guard stays a synchronous
  check-and-set with no `await` between.** It exists because of the 2026-08-01
  triple-launch outage and is regression-tested.

- **`vice-sync.ts`'s documented invariants survive:** exactly one resume per
  wait; poll on `hit_count`, never on paused state; never delete a VICE-marked
  temporary checkpoint.

- **Any host-facing path or hostname goes through `hostpath.ts` /
  `containerpath.ts` / `container-guard.mts`.** The closed consumer set for
  host-path logic is tested; do not widen it casually.

- **Client-side derivations go in sibling modules, never appended to
  `vice-proxy.ts`** (already 3,093 lines and the sole tool-surface seam).

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Corrected Ground Truth** - Fix the four verified errors in the normative protocol docs and run the binary-monitor probe against a real stock VICE (completed 2026-08-12)
- [x] **Phase 2: Stock Backend Connection** - Select a backend by config, launch stock `x64sc` with binary-monitor flags, and hold a correctly correlated, event-demultiplexed conversation with it (completed 2026-08-13)
- [x] **Phase 3: Direct Tools** - Every tool with a 1:1 binary-monitor opcode works on the stock backend (18 plans: 13 executed 2026-08-14 + 5 gap-closure 2026-08-16; all four 03-UAT gaps closed and the 2 Critical broker defects fixed and re-confirmed; verified 8/9 + 1 accepted override — disk detach has no stock opcode and is owned by Phase 7) (completed 2026-08-16)
- [x] **Phase 4: Client-Side Tool Seam and 6510 Disassembler** - Establish the pre-`rewriteArguments()` interception point in sibling modules and land the disassembler through it (completed 2026-08-17)
- [x] **Phase 5: Skill-Critical Derived Tools** - The eight tools the shipped skills call that stock lacks and that can be built client-side (13 plans: 8 executed 2026-08-17 + 5 gap-closure 2026-08-17 after verification returned gaps_found on criteria 3 and 4 — the hardcoded CPU-view `bank: 0x0000` in all four chip/sprite reads; re-verified 5/5 2026-08-17, both criteria closed and live-confirmed against genuine stock VICE 3.9) (completed 2026-08-17)
- [~] **Phase 6: CUT** - Stock-only gains moved to backlog 2026-08-17; no skill calls any of them
- [x] **Phase 7: Cycle Timing and Wedge Triage** - The last two skill-called tools, plus "is the emulator advancing" on stock (18/18 plans executed: 10 on 2026-08-18 + 8 gap-closure plans 07-11..07-18 in 3 waves; 07-VERIFICATION.md: status verified, 4/4 truths fully verified -- the one residual human-verification item, the broker-mediated monitor_held_elsewhere verdict, was live-proven by quick task 260818-obc, and the CR-01 review blocker from 07-REVIEW.md was fixed by quick task 260818-nh5) (completed 2026-08-18)
- [x] **Phase 8: Capability Honesty and the Install Story** - The runtime error, the playbook routes, and the install docs for the two capabilities stock provably cannot have (completed 2026-08-18)
- [x] **Phase 8.1: Close v0.2.0 audit items: UAT walkthrough + planning-doc drift** (INSERTED) - Run the one unwitnessed claim in the milestone — the install-to-RAM-capture walkthrough — and correct the seven planning documents that would otherwise start the next audit from a false picture (completed 2026-08-19)
- [ ] **Phase 8.2: Close v0.2.0 blockers: stock drive-config defect, red test gate, walkthrough re-run** (INSERTED) - Fix the Drive8Type defect that leaves DIST-03 unsatisfied, clear the red test gate that would fail CI on the tagging push, and re-run the install-to-RAM-capture walkthrough until it passes

## Phase Details

### Phase 1: Corrected Ground Truth

**Goal**: Every downstream plan reads protocol facts that match what the emulator actually does
**Depends on**: Nothing (first phase)
**Requirements**: DOC-01, DOC-02, DOC-03, VERIF-01, VERIF-04
**Success Criteria** (what must be TRUE):

  1. `docs/phase0-binmon-findings.md` and `docs/stock-vice-parity.md` name `RL`/`CY` as the condition-parser pseudo-registers, so a reader following them cannot write a condition on `LIN` and get error `0x8f`.
  2. The same documents no longer assert that pause-on-demand requires a checkpoint, that `REGISTERS_GET` cannot source a stopwatch, or that CPU history's compile flag is the availability risk — and they name VICE ≥ 3.10 as the real gate. `.planning/intel/constraints.md` agrees and `CON-stopwatch-via-cpuhistory` is no longer marked PROVISIONAL-on-CPU-history.
  3. `probe-binmon.mjs` has been run against a real stock `x64sc -binarymonitor` and its output is recorded in the repo: api version, the VICE version quad, whether `CPUHISTORY_GET` succeeds or fails with `0x83` versus `0x8f`, `DISPLAY_GET` geometry, `PALETTE_GET` entry count, and the observed unsolicited event sequence.
  4. Each of the five items the research flagged UNVERIFIED is either answered by that probe run or recorded as an accepted unknown that states what breaks if the assumption is wrong.

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Correct the two normative protocol documents (`phase0-binmon-findings.md`, `stock-vice-parity.md`): RL/CY, pause-on-demand, stopwatch, version gate, 3-to-5 event types [wave 1]
- [x] 01-02-PLAN.md — Bring `constraints.md` into agreement (4 CON blocks) and fully correct the `roadmap-stock-vice.md` ADR [wave 1]
- [x] 01-03-PLAN.md — Extend `probe-binmon.mjs` to cover PALETTE_GET, RL/CY conditions, 8-vs-9-byte CHECKPOINT_SET, Drive8TrueEmulation, drive-ROM MEM_SET, event pair, pixel check, plus an offline `--selftest` [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-04-PLAN.md — Run the probe against stock 3.9 and fork 3.10, record `docs/phase1-probe-results.md`, close the two "probe outstanding" references [wave 2]

Notes:

- This phase exists because `docs/phase0-binmon-findings.md` is **normative by ingest resolution W2** and currently contains four verified errors. Any later phase that derives protocol design from it inherits them — most sharply, a checkpoint condition written on `LIN` instead of `RL` fails at runtime with `0x8f`, and the condition parser gives no diagnostic back over the socket.
- VERIF-01 has never been run. It gates timing design (Phase 7) and screenshot design (Phase 5), and five items in `GAINS-PROTOCOL.md` route to it.
- **Parallel:** the doc corrections and the probe run are fully independent — no ordering between them. Realised as three Wave-1 plans (01-01 docs, 01-02 intel+ADR, 01-03 probe extension) with disjoint file ownership, plus a Wave-2 plan (01-04) that runs the probe and cross-links the result into the files the Wave-1 plans own.
- **External prerequisite — RESOLVED (verified 2026-08-12, planning).** This session runs on the host, not in a container. Both builds are present: `/usr/bin/x64sc` is stock VICE 3.9 and `/usr/local/bin/x64sc` is the barryw fork built from a VICE 3.10 tree; both expose `-binarymonitor`/`-binarymonitoraddress`, `DISPLAY=:0` and Wayland are available, and Node is v22.22.0. Having both builds gives a real `CPUHISTORY_GET` differential (expect `0x83` on 3.9, success on 3.10). The remaining gap — no *stock* 3.10 build — is recorded as an accepted unknown under success criterion 4, not treated as a blocker.
- Probe additions worth folding in while it is being run: a 9-byte `CHECKPOINT_SET` against 3.9, whether `Drive8TrueEmulation` exists under that name on 3.9, `MEM_SET` into drive ROM, whether `ADVANCE_INSTRUCTIONS` emits a `RESUMED`/`STOPPED` pair, and one `DISPLAY_GET` pixel checked against the known colour at that position.

### Phase 2: Stock Backend Connection

**Goal**: The server can be pointed at a stock VICE and hold a correct, correlated, event-demultiplexed conversation with it
**Depends on**: Phase 1
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, PROTO-01, PROTO-02, PROTO-03, PROTO-04, PROTO-05, PROTO-06, PROTO-07, PROTO-08, BROK-01, BROK-02, BROK-03, VERIF-02
**Success Criteria** (what must be TRUE):

  1. Setting one project-level config value switches which VICE backend the server drives, with no code edit; with the fork selected, tool behaviour is identical to v0.1.x and the existing suite passes unchanged.
  2. The broker launches an unmodified `x64sc` with binary-monitor flags and the fork with its existing flags, chosen by backend — and its existing guarantees still hold: one launch in flight at a time, crash supervision, and an incident record written before any kill.
  3. Exactly one monitor client owns an emulator instance; a second connection is prevented or reported as an ownership conflict, and is never diagnosed as a wedged emulator.
  4. Against recorded and synthesised frames, the client survives byte-at-a-time delivery, a ~157 KB `DISPLAY_GET`, a zero-length `JAM`, an event interleaved between a request and its reply, a `CHECKPOINT_LIST` answering N+1 frames on one request id, an error reply typed `0x00`, a duplicate reply on a settled id, and a mid-stream desync — and it never resolves a pending request with a `0xffffffff` event, including when the event shares a response type with a legitimate reply.
  5. A user can ask which backend is active and which VICE version is connected and gets both; the version-gated capabilities of that build are determined at connect time rather than at first use, and an emulator that died or restarted underneath the client is reported distinctly from a timeout.

**Plans**: 18 plans — 10 executed in 7 waves, plus 8 gap-closure plans in 3 further waves
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Wave 1: narrowed automated test gate, binmon fixture encoder and synthetic case builders, bounded `probe-binmon.mjs --capture` mode

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Wave 2 (checkpoints): capture the three real-emulator VERIF-02 fixtures with provenance, and record what `--help` actually prints on both builds
- [x] 02-03-PLAN.md — Wave 2: backend-selected launch argv (`-binarymonitor`), and the orphan reap re-derived from the broker's own allocation record

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md — Wave 3: `stock-protocol.ts` framing, response parsing, the three vendored defect fixes, and the body-length guard
- [x] 02-05-PLAN.md — Wave 3: broker-side single-monitor-client ownership (`monitor_claim`/`monitor_release`) and the container-side conflict outcome

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-06-PLAN.md — Wave 4: request-id-first demux, related-frame accumulation, expected-response table, and the socket-lifecycle rejection path
- [x] 02-07-PLAN.md — Wave 4: `backend-detect.mts` — the `--help` probe, the cached verdict under `.vice-supervisor/`, and the single `VICE_BACKEND` reader

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-08-PLAN.md — Wave 5: `stock-connect.ts` — claim-then-dial handshake, `api_version` assertion, capability gate, and `MachineRestartedError` reuse

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-09-PLAN.md — Wave 6: trimmed stock manifest with a tested selector, and the lease-to-session seam that threads `ensureBrokerLease()`'s held lease into `stockConnect()`

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 02-10-PLAN.md — Wave 7: `stock-dispatch.ts`'s table with no fall-through, `vice_ping` naming backend and VICE version, and the three `vice-proxy.ts` backend seams

Notes:

- This is the foundation everything after it builds on, which is why it is one phase despite carrying 16 requirements. Its three work streams are largely independent and can be planned in parallel: (a) the framing/correlation/demux client and its test fixtures, (b) broker launch flags plus single-client ownership, (c) config-driven selection and the connect handshake — (c) consumes (a)'s handshake, so it lands last.
- **PROTO-03 and PROTO-04 are correctness-critical, not hardening.** Five unsolicited message types arrive at request-id `0xffffffff`, and `CHECKPOINT_INFO` (0x11) / `REGISTER_INFO` (0x31) share a response type with legitimate replies — resolving a pending request with one returns silently wrong data that looks right. `JAM` (0x61) has a zero-length body and breaks every client surveyed. Both belong here.
- PROTO-08 and BROK-02 are two halves of one mechanism (exclusive per-instance ownership) and are deliberately in the same phase. Stock VICE services exactly one client; a second `connect()` sits unserviced in the backlog with no reply and no EOF, indistinguishable from a wedge.
- Start from `henols/c64-debug-mcp`'s `src/vice-protocol.ts` (same author, MIT, no deps) with its two known defects fixed on the way in: the zero-length `JAM` read and the throw-on-bad-STX that never advances the buffer. Add the generalised `related[]` accumulation, the command→expected-response table, a connect epoch, the `api_version === 2` assertion, and a desync counter.
- Size the read-buffer growth and the test fixtures against `DISPLAY_GET`, not `MEM_GET`.
- Never mint request id `0xffffffff`; keep the id a full uint32.

### Phase 3: Direct Tools

**Goal**: Every tool with a 1:1 binary-monitor equivalent works on the stock backend
**Depends on**: Phase 2
**Requirements**: DIRECT-01, DIRECT-02, DIRECT-03, DIRECT-04, DIRECT-05, DIRECT-06, DIRECT-07, DIRECT-08, DIRECT-09
**Success Criteria** (what must be TRUE):

  1. A user can read and write emulator memory and CPU registers on the stock backend, with reads side-effect-free by default — reading `$D019` does not acknowledge the IRQ — and no read forces a pause/resume round trip it does not need.
  2. A user can set, list, delete, toggle and condition checkpoints and watchpoints; conditions are emitted through a typed builder that parenthesises every comparison, emits `$hex` literals, and uses `RL`/`CY`, so a silently-always-false condition cannot be produced.
  3. A user can pause a freely-running emulator on demand and resume it, step instructions, and execute until return — with pause and resume idempotent, so an agent retry is a no-op rather than a second halt.
  4. A user can reset the machine, autostart a PRG or disk image, attach disks, type text, drive the joystick, save and restore snapshots, and enumerate available banks and registers on the stock backend. *(Disk **detach** is explicitly out of scope for this phase: stock VICE's binary monitor exposes no detach opcode, so it has no 1:1 equivalent and falls outside this phase's goal. Deferred to Phase 7 — see D-13 in `03-CONTEXT.md` and `docs/stock-vice-parity.md`.)*

**Plans**: 13 plans in 4 waves, plus 5 gap-closure plans in 4 waves (03-UAT.md)
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Wave 1: shared seams — the `runState` projection (D-06/07/08), `parseAddress()` (D-04), and the cycle-free `stock-handler.ts` contract with both error converters
- [x] 03-02-PLAN.md — Wave 1: all 16 request-body encoders in `stock-protocol.ts`, ported from `probe-binmon.mjs` where a tested builder exists
- [x] 03-03-PLAN.md — Wave 1: the typed condition AST, the one canonical emitter, and the fork-compatible string parser with its refusal set (D-09)
- [x] 03-04-PLAN.md — Wave 1: broker `-remotemonitor` launch flag and second allocated port, with the monitor-ownership answer written down for Phase 7 (D-13's launch half)
- [x] 03-05-PLAN.md — Wave 1: D-16's fork-manifest deletion and the 62-tool gate, the parity register for every Phase 3 divergence, and the `[ASSUMED]` probe-debt todo

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-06-PLAN.md — Wave 2 (family A): memory read/write/banks, side-effect-free by default, with the per-session bank catalog
- [x] 03-07-PLAN.md — Wave 2 (family A): registers get/set plus the stock-only `vice_registers_available`, over a per-session register catalog
- [x] 03-08-PLAN.md — Wave 2 (family B): checkpoints and watchpoints, the D-10 condition registry with fail-closed cleanup, and the D-11 trace guard
- [x] 03-09-PLAN.md — Wave 2 (family C): pause/run with D-08 short-circuiting, step and the stock-only `vice_execution_until_return` with D-07 gating
- [x] 03-10-PLAN.md — Wave 2 (family D): reset, autostart, unit-8-only disk attach, snapshots, and D-17's declared path-translation table
- [x] 03-11-PLAN.md — Wave 2 (family D): the new ASCII↔PETSCII table, keyboard type/petscii, and joystick set

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-12-PLAN.md — Wave 3: `withStockSession()`, the tracker attach points, all 25 dispatch-table entries, and the dependency-free `outputSchema` checker

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-13-PLAN.md — Wave 4: the 25-entry stock manifest with an `outputSchema` per tool, and the per-handler answer-conformance harness

**Gap closure** *(from 03-UAT.md — run with `/gsd-execute-phase 03 --gaps-only`)*

- [x] 03-14-PLAN.md — Gap wave 1: BLOCKER — `vice_registers_set` refused every real register (REGISTERS_AVAILABLE reports width in BITS, not bytes); fix plus a wire-shaped regression fixture
- [x] 03-15-PLAN.md — Gap wave 1: MAJOR — `npm test` hung forever on a bare host (listener leaked before its try); plus env-gated skips with named reasons and the widened `vice-proxy:` identity detector
- [x] 03-16-PLAN.md — Gap wave 2: live re-verification of the register write and the never-reached flag-bit refusal against genuine stock VICE 3.9 (`/usr/bin/x64sc`), as a committed opt-in gate
- [x] 03-17-PLAN.md — Gap wave 3: MAJOR — CI has not validated the tree for 214 commits; local CI-equivalence run plus a blocking authorisation decision (a push to main auto-publishes both npm packages)
- [x] 03-18-PLAN.md — Gap wave 4: execute the authorised CI route and record the run URL, sha and conclusion

Notes:

- **Build the condition builder correctly here, not in Phase 6.** DIRECT-03 already covers conditions; the typed-AST approach (full parenthesisation, `$hex` literals, uppercase `RL`/`CY`) eliminates three independent traps at once and means Phase 6's GAIN-06 extends it with raster semantics rather than rewriting a string-concatenation path.
- Run/stop state must be a projection of the event stream only, with an honest `unknown` state after connect — never derived from the commands sent. Every command halts the machine; resume is a separate `EXIT`. Gate commands on the derived state, cool resumes down, and never send from inside the event handler.
- `stop: false` (trace) checkpoints emit one frame per hit synchronously from inside the CPU loop over a blocking socket, which can mutually deadlock client and emulator. Treat them as a dangerous capability: explicit opt-in, hot-range refusal, and a per-second rate limit that disables the offending checkpoint id.
- The wire memspace byte is not the internal enum: `0x00` = main, `0x01`–`0x04` = units 8–11; `0x08` is rejected. Always send exactly 8 bytes for `MEM_GET` — the handler dereferences the body before its length check.
- **Parallel:** memory/registers, checkpoints/watchpoints, execution control, and the machine-control group (reset/autostart/disks/input/snapshots/banks) are four largely independent tool families.

### Phase 4: Client-Side Tool Seam and 6510 Disassembler

**Goal**: Client-side tools have a home that never sees a host-translated path, and the largest one — the disassembler several later tools depend on — works
**Depends on**: Phase 3
**Requirements**: DERIV-07, DISASM-01, DISASM-02, DISASM-03, DISASM-04, DISASM-05, DISASM-06, DISASM-07
**Success Criteria** (what must be TRUE):

  1. Client-side tools are intercepted **before** `forwardToVice()` runs `rewriteArguments()` and live in sibling modules rather than in `vice-proxy.ts`; a test proves a derived tool receives the container path and never the host-translated one.
  2. A user can disassemble a memory range on the stock backend, and all 256 opcodes decode with correct instruction lengths — including the undocumented 6510 set and, in particular, the illegal `NOP`-class variants (**27 opcodes across 6 addressing-mode groups**, not twelve — corrected during Phase 4 planning, see Notes) whose operand lengths desynchronise everything after them when wrong.
  3. Branch instructions render the resolved target address rather than the raw offset; a partial instruction at the end of a range is reported as truncated rather than fabricated; `JMP ($xxFF)` carries an explicit NMOS page-wrap warning; and symbol substitution is applied only where operand role and width prove it cannot change the encoding.
  4. Disassembly re-assembles through ACME, verified by a round-trip test whose exclusions are enumerated and asserted rather than skipped.
  5. The disassembler adds no npm dependency and no GPL-licensed material, and the opcode table's zlib provenance is attributed in the source and in third-party notices.

**Plans**: 7 plans in 6 waves
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — the committed 256-entry 6510 opcode table and its bit-pattern derivation test (wave 1)
- [x] 04-02-PLAN.md — the derived-tool seam: stock-derived.ts, withDerivedTool(), and D-02's two enforcement mechanisms (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — the pure decoder: resolved branch targets, truncation, page-wrap notes (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-04-PLAN.md — the ACME-ready renderer: !byte substitution, width invariant, symbol gating (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-05-PLAN.md — vice_disassemble on the stock backend, through the derived adapter (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-06-PLAN.md — ACME in CI plus the byte-exact round-trip and substitution-membership assertions (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 04-07-PLAN.md — third-party notices, the publish gate, and the parity-doc divergences (wave 6)

Notes:

- **This phase answers the shared-seam question deliberately.** DERIV-07's interception point is built once here, and every later client-side tool routes through it: Phase 5's derivations and screenshots, and Phase 6's gains that compose multiple primitives. Building it in the phase that has the first and largest consumer avoids both a seam with no user and a seam retrofitted under three consumers at once.
- The hazard being closed: `rewriteArguments()` runs at `vice-proxy.ts:2773` **inside** `forwardToVice()` and before `call()`. A derived tool sitting behind `call()` receives host-translated paths and acts on them inside the container.
- **Parallel, and the biggest parallelism win in the milestone:** the disassembler library (DISASM-02..07) is a pure function with no protocol dependency and no emulator requirement. It can be built and fully tested alongside Phase 2 or Phase 3. Only DISASM-01 — the tool that reads memory through the seam — needs Phase 3.
- The table is transcoded from cc65's `opc6502x.c` (zlib), cross-checked against `fluffy-6502` (MIT) and ACME's illegal-opcode matrix, with mnemonics re-spelled to ACME's `!cpu 6510` set. **Nothing is sourced from VICE** — VICE is GPL-2 and this repo is MIT.
- **Two planning-time corrections to the note above (Phase 4 research, 2026-08-17).** (a) The real illegal-`NOP` set is **27 opcodes across 6 addressing-mode groups** (6 implied/1-byte, 5 immediate/2-byte, 3 zeropage/2-byte, 6 zeropage,X/2-byte, 1 absolute/3-byte, 6 absolute,X/3-byte) — no grouping of them yields twelve. Criterion 2 above is corrected accordingly, and the verification is written exhaustively over all 256 opcodes, which is a strict superset. (b) **`fluffy-6502` could not be located under that name** on GitHub or the general web, so it is **not** a cross-check source. The `aaabbbcc` bit-pattern derivation test and the byte-exact real-ACME round-trip carry that burden instead, and `THIRD-PARTY-NOTICES.md` records `fluffy-6502` as an unavailable non-source rather than citing it.
- Over-read by two bytes and drop instructions starting past the requested end, so truncation only ever happens at a genuine memspace boundary.
- Blocks: DERIV-02 (backtrace needs instruction lengths) and GAIN-01 (CPU-history decode uses the same table).

### Phase 5: Skill-Critical Derived Tools

**Goal**: Every tool the six shipped skills actually call either works on stock or is explicitly routed to the fork
**Depends on**: Phase 4
**Requirements**: DERIV-01 (search/compare), DERIV-04, DERIV-05 (read side), DERIV-06 (read side)
**Success Criteria** (what must be TRUE):

  1. A user can search and compare memory ranges on the stock backend.
  2. A user can load a symbol file and have addresses resolved to symbol names on the stock backend.
  3. A user can read decoded VIC-II and CIA state on the stock backend, with every internal field stock cannot read marked explicitly unavailable — never reported as zero.
  4. A user can read and inspect sprites, including ASCII rendering, on the stock backend.
  5. Running each of the six skills' documented tool calls against the stock backend produces no unadvertised-tool failure except for the three tools proven unrecoverable (`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`), which are Phase 8's business. *(Corrected 2026-08-17, during Phase 5 planning: the count was **two**. Plan 05-08's skill-vs-manifest sweep found a third — `vice_keyboard_restore`, called by `c64-re-tools/.claude/skills/c64-program-recon/references/control-flow.md:86`, present on the fork manifest, absent from stock. It belongs to the same family as `vice_keyboard_matrix` and is already recorded as a hard loss in `docs/stock-vice-parity.md` §A item 2 — `KEYBOARD_FEED` (0x72) injects buffer text only and cannot pulse the RESTORE/NMI line. It is covered by no requirement and falls in no phase's scope, so this is a factual correction to the exception list, not a scope cut; without it criterion 5 is literally unmeetable. Route: `BACK-05` + `SKILL-01` in Phase 8.)*

**Plans**: 13 plans in 8 waves *(8 shipped in waves 1-4; 5 gap-closure plans added 2026-08-17 in waves 5-8 after `05-VERIFICATION.md` returned `gaps_found` — criteria 3 and 4 failed on CR-01/CR-02, the hardcoded CPU-view `bank: 0x0000` in all four chip/sprite reads)*
Plans:
**Wave 1** *(the four declared-independent tool families, five plans, disjoint file ownership -- none writes a shared registration file)*

- [x] 05-01-PLAN.md — `stock-memory-search.ts`: `vice_memory_search` + `vice_memory_compare` (`mode:'ranges'` only; `mode:'snapshot'` refused by name, D-05-01) [wave 1]
- [x] 05-02-PLAN.md — `stock-symbols.ts`: the DERIV-04 store installing into `stock-address.ts`'s one resolver holder, workspace-contained file read, plus `derivedAnswer()` in `stock-handler.ts` (D-05-06) [wave 1]
- [x] 05-03-PLAN.md — `stock-vicii.ts`: `vice_vicii_get_state` over one `sidefx:false` read of `$D000-$D02E`, with six internal-only fields marked explicitly unavailable [wave 1]
- [x] 05-04-PLAN.md — `stock-cia.ts`: `vice_cia_get_state` over one `sidefx:false` read per chip, with the three read-versus-write address collisions named as five unavailable fields (D-05-11) [wave 1]
- [x] 05-05-PLAN.md — `stock-sprites.ts`: `vice_sprite_get` + `vice_sprite_inspect`, pointer-chain arithmetic ported verbatim from `dump-artifacts.mjs`, native-resolution ASCII (D-05-04), `png_base64` refused (D-05-03) [wave 1]

**Wave 2** *(blocked on 05-01 and 05-02; sole owner of every shared registration file this wave)*

- [x] 05-06-PLAN.md — register the four DERIV-01/DERIV-04 tools: dispatch table, `STOCK_DERIVED_TOOLS`, manifest 26 -> 30, `files[]` 39 -> 41 (Rule 2), four conformance cases, and the de-vacuumed `hostpath-consumers.test.ts` guard (D-05-12) [wave 2]

**Wave 3** *(blocked on 05-03/04/05 and 05-06; takes the same shared files over)*

- [x] 05-07-PLAN.md — register the four DERIV-05/DERIV-06 tools: manifest 30 -> 34 with eleven `enum: [false]` unavailability pins, `files[]` 41 -> 44, four address-dispatching conformance cases, phase-neutral tarball regression list [wave 3]

**Wave 4** *(blocked on 05-07)*

- [x] 05-08-PLAN.md — criterion 5 mechanised: `scripts/check-skill-tool-coverage.mjs` + a blocking CI step (D-05-05), the parity-doc trims and the DERIV-05 stock gain, and four bounded skill-reference corrections [wave 4]

**Wave 5** *(gap closure, blocked on 05-03/05-04/05-07; sole owner of `stock-memory.ts`, both chip modules, the two chip manifest entries and the shared conformance harness)*

- [x] 05-09-PLAN.md — CR-01: `resolveRequiredBank()` in `stock-memory.ts`, VIC-II and CIA read through the emulator's own `io` bank id (refusing rather than guessing), `bank:{id,name:"io"}` on both answers pinned with `enum:["io"]`, plus the live `$01 = $34` regression the phase never had (D-05-14, D-05-15) [wave 5]

**Wave 6** *(blocked on 05-09; two plans, disjoint file ownership)*

- [x] 05-10-PLAN.md — CR-02 + the legend defect: sprite registers read through `io`, pointer table and sprite data through `ram`, a VIC-bank-3 I/O-window note, and two ASCII legends selected on the per-sprite `multicolour` flag (D-05-16, D-05-17) [wave 6]
- [x] 05-11-PLAN.md — WR-01/WR-08 in `stock-symbols.ts`: `query.address` echoes the parsed number so the answer satisfies its own `outputSchema`, and the containment-checked canonical path is the one stat'ed, read and reported (D-05-18, D-05-19) [wave 6]

**Wave 7** *(blocked on 05-09; sole owner of `stock-cia.ts` and the CIA manifest entry)*

- [x] 05-12-PLAN.md — the remaining criterion-3 "plausible-but-wrong" fields: CIA1 joystick state marked confounded from the DDR byte already in the buffer (WR-02), and a non-BCD TOD byte reported as invalid instead of an impossible decimal (WR-03) (D-05-20, D-05-21) [wave 7]

**Wave 8** *(blocked on 05-09..05-12)*

- [x] 05-13-PLAN.md — the docs and traceability gaps: the banking hazard and the VERIFIED/ASSUMED side-effect split in `docs/stock-vice-parity.md` and `observation-hazards.md` (WR-12), `REQUIREMENTS.md`'s DERIV-04/05/06 marks reconciled with the live evidence, and `vice_disk_read_sector` recorded as CUT rather than pending (WR-13) (D-05-22, D-05-23) [wave 8]

Notes:

- **Scope is set by what the skills call, not by parity with the fork.** Measured against `tools-manifest.json` versus `tools-manifest.stock.json`: the skills call 28 tools; 16 already work on stock, 12 do not, and 2 of those 12 are impossible on stock. That leaves **8 tools in this phase** (`vice_memory_search`, `vice_memory_compare`, `vice_symbols_load`, `vice_symbols_lookup`, `vice_vicii_get_state`, `vice_cia_get_state`, `vice_sprite_get`, `vice_sprite_inspect`) and 2 in Phase 7. Everything else the fork offers is called by **no skill** and is therefore out of scope — see "Cut from scope" below. *(Corrected 2026-08-19, during Phase 8.1: the impossible count is three, not two -- plan 05-08's skill-vs-manifest sweep found `vice_keyboard_restore` in addition to `vice_sid_get_state` and `vice_keyboard_matrix`. The measured totals move with it: 29 called / 16 already working / 13 not working / 3 impossible. The "8 tools in this phase and 2 in Phase 7" split above is unchanged.)*
- Only the **read** halves are in scope. `vice_sprite_set`, `vice_vicii_set_state`, `vice_cia_set_state`, `vice_memory_fill` are called by no skill.
- `DERIV-04` gains a second reason to exist beyond parity: it is the consumer half of the regenerator2000 symbol round trip (v0.3.0). Build the loader so a VICE `.lbl` file from any producer works.
- `DERIV-07` (derived tools live in sibling modules, intercepted before `rewriteArguments()`) is already complete from Phase 4 and stands as the seam these eight tools land through.
- **Parallel:** memory search/compare, the symbol store, chip-state decode and sprites are four independent tool families with no ordering between them.

### Phase 6: CUT — Stock-Only Gains

**Status**: **removed from v0.2.0 scope on 2026-08-17.** Moved to backlog.
**Was**: CPU-history tracing, 1541 drive-CPU debugging, raster-precise conditions, exact palette, full resource get/set (`GAIN-01`..`GAIN-09`).

Why it went: **no skill calls any tool in this group, and no requirement outside
the group depends on it.** It is a capability surplus over the fork, not a gap
against it — genuinely interesting, and entirely optional to the milestone goal
of "the plugin works on a VICE anyone can install".

It also carried the milestone's densest trap cluster for no forced reason:
`default_memspace` contamination from drive checkpoints silently stepping the
wrong CPU, the `CPUHISTORY_GET` version-and-compile-flag double gate, the
condition parser's absent operator precedence, and three resources that
power-cycle the machine one call deep. All of that research is preserved in
`.planning/research/` and `docs/stock-vice-parity.md` and loses nothing by
waiting.

**Phase number 6 is retained, not reused.** Phases 1-4 have committed artifacts
under `.planning/phases/`; renumbering would invalidate every cross-reference.

### Phase 7: Cycle Timing and Wedge Triage

**Goal**: "How long did that take" and "is the emulator still advancing" work on the stock backend
**Depends on**: Phase 5
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04
**Success Criteria** (what must be TRUE):

  1. A user can measure elapsed cycles across an operation on the stock backend, and a bracket that cannot be measured says so rather than returning zero.
  2. A user can run to an exact address on the stock backend, with the temporary checkpoint cleaned up whether the run succeeded, timed out, or the machine restarted underneath it.
  3. `vice_diagnose` distinguishes, on the stock backend, an emulator that is genuinely wedged from one stopped at the user's own checkpoint, one that crashed and respawned, one merely paused, **and one whose binary monitor is already held by another client**.
  4. `vice-wedge-triage`'s documented opening move works on stock rather than returning fork HTTP failure text.

**Plans**: 18 plans — 10 executed in 7 waves, plus 8 gap-closure plans in 3 further waves
Plans:
**Wave 1** *(four independent plans, disjoint file ownership -- none writes a shared registration file)*

- [x] 07-01-PLAN.md — Wave-0 blocker: `probeCpuHistory()` sends `count=1` and classifies `InvalidParameter` (0x81), with the live-captured regression fixture [wave 1]
- [x] 07-02-PLAN.md — `stock-protocol.ts`: the `CPUHISTORY_GET` response parser and the `RESOURCE_GET` encoder + parser, both `need()`-guarded, no SET-side encoder [wave 1]
- [x] 07-03-PLAN.md — `stock-run-until.ts`: temporary stopping exec checkpoint, event-driven bounded wait, three distinct cleanup paths, stock-only `timeout_ms` (D-02) [wave 1]
- [x] 07-04-PLAN.md — doc corrections: `rewriteArguments()` cited at `vice-proxy.ts:2889`/`1368`, and `phase0-binmon-findings.md` §1's frame-counter fallback marked SUPERSEDED [wave 1]

**Wave 2** *(blocked on 07-01 and 07-02)*

- [x] 07-05-PLAN.md — `stock-timing.ts`: `vice_cycles_stopwatch` over Route A (`CPUHISTORY_GET` u64 clock) and Route B (`LIN`/`CYC` frame position), with every unmeasurable path carrying no `cycles` key at all [wave 2]

**Wave 3** *(blocked on 07-05)*

- [x] 07-06-PLAN.md — `stock-diagnose.ts`: the five D-03 verdicts, the ported checkpoint-trap algorithm, the snapshot-resume-wait-halt-compare bracket, and a bounded acquisition that cannot hang while diagnosing a hang [wave 3]

**Wave 4** *(blocked on 07-06)*

- [x] 07-07-PLAN.md — `stock-recycle.ts` (D-01): the stock-native evidence gatherer with no screenshot, the incident record written before the destructive broker RPC, and `stockDisconnect()` teardown [wave 4]

**Wave 5** *(blocked on 07-03 and 07-05; sole owner of every shared registration file this wave)*

- [x] 07-08-PLAN.md — register `vice_cycles_stopwatch` and `vice_run_until`: dispatch table, `STOCK_DERIVED_TOOLS`, manifest 34 -> 36, `files[]`, two conformance cases [wave 5]

**Wave 6** *(blocked on 07-06/07-07/07-08; takes the same shared files over)*

- [x] 07-09-PLAN.md — register `vice_diagnose` and `vice_recycle`: manifest 36 -> 38 with the five-verdict enum pinned, the new `PROXY_LOCAL_TOOLS` category, two conformance cases [wave 6]

**Wave 7** *(blocked on 07-09)*

- [x] 07-10-PLAN.md — `docs/stock-vice-parity.md` divergences, `vice-wedge-triage/SKILL.md`'s stock route (criterion 4), and `07-VALIDATION.md`'s resolved task-ID map [wave 7]

**Gap closure** *(planned 2026-08-18 after `07-VERIFICATION.md` returned `gaps_found`, 1/4 must-haves verified; waves renumbered from 1 for this batch — execute-phase runs only the unexecuted plans. Plans 07-01..07-10 are shipped history and were not modified.)*

**Wave 1** *(four independent plans, disjoint file ownership)*

- [x] 07-11-PLAN.md — gap 1 / CR-01: a `CPUHISTORY_GET` decode failure becomes a capability value instead of failing the whole stock handshake [wave 1]
- [x] 07-12-PLAN.md — gap 1 root cause / WR-13 + CR-02: re-derive the `CPUHISTORY_GET` per-entry layout from `monitor_binary.c` against three real captured fixtures, and fix the `RESOURCE_GET` integer guard [wave 1]
- [x] 07-14-PLAN.md — gap 2 / WR-01 + WR-02: resolve the cleanup race from the program counter, and report `machineHalted` on every `vice_run_until` answer [wave 1]
- [x] 07-15-PLAN.md — gap 3 / WR-03: derive `machinePaused` from observed run state, and add the classified non-verdict `diagnosis_unavailable` outcome (D-03's five verdicts unchanged) [wave 1]

**Wave 2** *(blocked on wave 1; disjoint file ownership)*

- [x] 07-13-PLAN.md — gaps 1/3/4 live proof: `stockConnect()` on both real binaries, the Route A stopwatch on genuine VICE 3.10, and bounded diagnosis under real second-client contention [wave 2]
- [x] 07-16-PLAN.md — gap 3 / WR-07: backend-aware advertisement for `vice_diagnose`/`vice_recycle`, plus the manifest `outputSchema` deltas for the new answer fields [wave 2]
- [x] 07-17-PLAN.md — gap 3 live proof: `checkpoint_trap`, `wedged` (a real CPU JAM held in the monitor) and `restarted` (a real kill-and-relaunch) against a real emulator [wave 2]

**Wave 3** *(blocked on all of the above)*

- [x] 07-18-PLAN.md — gap 4: correct `docs/stock-vice-parity.md`'s false live-confirmed claim, give the skill a `diagnosis_unavailable` response, and re-mark `TIME-01`..`TIME-04` from recorded evidence [wave 3]

Notes:

- **Manifest-count correction (planning, 2026-08-18):** `07-RESEARCH.md` says the stock manifest goes 34 -> 37. Reading the code shows `vice_diagnose` and `vice_recycle` are proxy-local synthetic tools with no manifest entry on either backend, while `stock-dispatch.test.ts`'s bidirectional table/manifest agreement test requires a manifest entry for every dispatch-table key. The real path is 34 -> 36 (plan 07-08) -> 38 (plan 07-09).
- **`vice_recycle` is in scope by decision D-01**, though no `TIME-*` requirement names it: the research found it broken on stock for the same root cause as the other two (`gatherWedgeEvidence()` calls `rewriteArguments()`/`call()`), so without it a stock `wedged` verdict has no working next step and criterion 4 is satisfied only in letter.
- These are the last two skill-called tools missing on stock: `vice_cycles_stopwatch` and `vice_run_until`. Together with Phase 5's eight, that closes the buildable half of the 12-tool gap.
- Criterion 3's fourth state is new and comes from `PROTO-08`'s human half: stock VICE's binary monitor serves exactly one client, and a second connection is behaviourally identical to a hang. Tracked as a pending todo dated 2026-08-17.
- `vice-sync.ts`'s invariants survive unchanged: exactly one resume per wait; poll on `hit_count`, never on paused state; never delete a VICE-marked temporary checkpoint.
- **Dropped from this phase:** `vice_disk_detach`, the deferred half of `DIRECT-06`. No skill calls it, stock has no detach opcode, and `vice_disk_attach` of a different image covers the real workflow. Recorded under "Cut from scope".
- No monotonic cycle register exists on stock. `LIN`/`CYC` are readable but not monotonic; reconstruct absolute cycles or read the text monitor's `stopwatch`.

### Phase 8: Capability Honesty and the Install Story

**Goal**: A user can install this from a package manager and is never silently given a wrong answer by a backend that cannot do the thing
**Depends on**: Phase 7
**Requirements**: BACK-05, DIST-01, DIST-02, DIST-03, SKILL-01
**Success Criteria** (what must be TRUE):

  1. Calling a tool the active backend does not advertise returns an error naming the capability, the reason, and which backend provides it — never a generic unknown-tool error and never a silent wrong answer.
  2. Every skill whose documented method depends on a fork-only capability either names the stock route or states the fork requirement. The two proven-unrecoverable tools (`vice_sid_get_state`, `vice_keyboard_matrix`) are named explicitly at their point of use.
  3. A user installs the plugin and a working VICE from a package manager by following the documentation, with the backend choice and its consequences stated.
  4. The documentation states which backend each tool works on, derived from the shipped manifests rather than maintained by hand.

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 08-01-PLAN.md — capability-registry.ts: the 26-entry single source of truth for per-backend capability data, its unit proof, and its packaging entry (BACK-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — wire the registry into vice-proxy.ts's tools/call miss branch, strictly after DENY_LIST, proven end-to-end over real stdio (BACK-05)
- [x] 08-03-PLAN.md — generate docs/tool-support.md from both manifests plus the registry, with a byte-identity drift guard (DIST-01)
- [x] 08-04-PLAN.md — section-scoped skill-honesty lint plus the four bare fork-only mentions annotated with the fork requirement and the stock route (SKILL-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-05-PLAN.md — README VICE-install story, per-ecosystem version table, VICE_BACKEND consequences, CI wiring, and the human install walkthrough (DIST-02, DIST-03)
- [x] 08-06-PLAN.md — consolidate check-skill-tool-coverage.mjs onto the registry and purge four stale forward-looking claims from docs/stock-vice-parity.md (DIST-01, SKILL-01)

Notes:

- **This is the phase the milestone actually exists for.** Phases 5 and 7 close the buildable tool gap; this one makes the two backends honest about the gap that cannot be closed. Two tools the skills call are provably unrecoverable on stock — without criteria 1 and 2, a stock user hits them as failures with no route forward.
- The three halves of one problem land together by design: `BACK-05` is the runtime error, `SKILL-01` is the playbook methodology, `DIST-02` is the install documentation. Splitting them leaves the user carried by whichever half shipped.
- Criterion 4 must be **derived** from `tools-manifest.json` / `tools-manifest.stock.json`, not hand-written. A hand-maintained support table drifts on the first tool added.
- **Dropped from this phase:** `VERIF-03`, the two-process cross-backend parity harness. `PROJECT.md` already declares byte-identical parity a non-goal, so the harness would measure something the project does not promise. Criterion 4's manifest-derived table gives the user the same information for far less work.
- Re-check for prebuilt regenerator2000 binaries when writing criterion 3, in case v0.3.0's prerequisite can be stated without `cargo install`.

### Phase 8.1: Close v0.2.0 audit items: UAT walkthrough + planning-doc drift (INSERTED)

**Goal**: The milestone's own definition of done is witnessed by a person, and no planning document lies to the next audit
**Depends on**: Phase 8
**Inserted**: 2026-08-19, from `.planning/v0.2.0-MILESTONE-AUDIT.md` §9
**Requirements**: none new — closes evidence and documentation debt against DIST-03 and the milestone's stated finish line
**Success Criteria** (what must be TRUE):

  1. `08-HUMAN-UAT.md` Test 1's drive-a-skill half is **run and recorded**: a person installs stock VICE and the plugin from the README alone, sets `VICE_BACKEND=stock`, and drives `c64-ram-capture` to a verified full 64K RAM capture. The result is recorded as observed — pass or fail — not as pending.
  2. Phase 8's `08-VALIDATION.md` is no longer `status: draft` / `nyquist_compliant: false`, so every phase in the milestone is Nyquist-compliant.
  3. All seven documentation-drift items in the audit's §7 table (D-1..D-7) are corrected: the 17 cut requirements read `Cut 2026-08-17` rather than `Pending`, `DIRECT-06`'s traceability row stops attributing detach to Phase 7, the coverage arithmetic reads 51/51/0, ROADMAP.md's Phase 7 checkbox and "NOT complete" text match its own progress table, STATE.md is synced to 7/7 and 100%, the "two provably impossible tools" prose says three, and the stock-manifest tool count is either refreshed or marked as-of-cut. *(Corrected 2026-08-19, during Phase 8.1 planning: the audit's "sync STATE.md to 7/7, 100%" was written before Phase 8.1 was inserted into the milestone. With 8.1 in flight, the truthful target is **7 of 9 phases complete, 78%** -- forcing 100% here would be a new false claim of exactly the kind this phase exists to remove.)*
  4. A re-read of REQUIREMENTS.md, ROADMAP.md and STATE.md by a fresh reader yields the same phase-completion and requirement-coverage picture the audit derived — no document contradicts another.

**Plans**: 5 plans in 3 waves *(two independent tracks — A: documentation drift, B: the walkthrough — plus a closing consistency read)*
Plans:

**Wave 1** *(two independent tracks, disjoint file ownership)*

- [x] 08.1-01-PLAN.md — Wave 0 D-1..D-7 checklist harness with a recorded RED baseline, then REQUIREMENTS.md's drift: the 17 `Pending` rows, DIRECT-06's row, the 51/51/0 coverage block, and its share of the D-6 arithmetic and D-7 manifest count [wave 1, track A]
- [x] 08.1-03-PLAN.md — walkthrough harness: pin the tested artifact by commit sha, probe the local-path install route, assemble a throwaway `.prg`/`.d64` via `acme-build` + `c1541`, and stand up a scratch project wired to local `HEAD` with `VICE_BACKEND=stock` [wave 1, track B]

**Wave 2** *(each blocked on its own track's wave 1)*

- [x] 08.1-02-PLAN.md — ROADMAP.md's Phase 7 checkbox and stale "NOT complete" text, both files' share of the D-6 arithmetic and D-7 as-of annotations, STATE.md's progress figures, and the criterion-2 verification evidence [wave 2, track A, blocked on 08.1-01]
- [x] 08.1-04-PLAN.md — drive `c64-ram-capture` end to end against genuine stock VICE and record the outcome in `08-HUMAN-UAT.md` as pass or fail (never pending) with `driven_by: agent-proxy`, the tested sha, and the local-`HEAD` limitation; point `08-VERIFICATION.md` and `08-VALIDATION.md` at it [wave 2, track B, blocked on 08.1-03]

**Wave 3** *(blocked on both tracks)*

- [x] 08.1-05-PLAN.md — the closing cross-document consistency read (criterion 4): reconcile every claim shared by REQUIREMENTS.md, ROADMAP.md and STATE.md, fix residuals, and prove all seven D-items green in one run [wave 3, blocked on 08.1-02 and 08.1-04]

Notes:

- **This phase exists to close v0.2.0, not to extend it.** It adds no requirement and ships no feature. If criterion 1's walkthrough finds a real defect, that defect is the finding — fix it here only if it is install-path-shallow, otherwise record it and let it size its own work.
- **Criterion 1's recorded outcome: failed**, not fixed here per the Note above (the
  defect is not install-path-shallow). Plan 08.1-04 drove `c64-ram-capture` end to end
  against genuine stock `/usr/bin/x64sc` and hit a confirmed defect: the broker
  launches stock VICE with `Drive8Type=0` (NONE), no stock MCP tool sets a drive type,
  so `LOAD"*",8,1` fails and the 64K capture is never reached. Confirmed fix, live:
  `-drive8type 1541` at launch — not yet applied. This is an open product defect
  carried into the next milestone's backlog, not a documentation gap; see
  `STATE.md` "Deferred Items" and `08-HUMAN-UAT.md` Test 1 (`status: failed`).
- Criteria 1 and 2 are the same gap surfacing twice: Phase 8 is both the phase carrying the open UAT and the only non-Nyquist-compliant phase. Running the walkthrough is what clears the flag.
- The audit's two optional follow-ons are **not** in this phase's scope: `XDG_CONFIG_HOME` isolation on the production stock launch (§4.2) and the Phase 3 / Phase 5 warning clusters. Both are tracked; neither blocks tagging.
- Criterion 3 is mechanical and can run in parallel with criterion 1 — it touches only `.planning/` documents plus the two stale prose lines, and shares no files with the walkthrough.
- The milestone heading `# Milestone v0.2.0: ...` was added to ROADMAP.md on 2026-08-19 when this phase was inserted: without it, `extractCurrentMilestone()` matched `## Cut from scope (v0.2.0, ...)` first and extracted a 27-line slice containing no phases, so every SDK phase operation reported v0.2.0's phases as absent. Do not remove it.

### Phase 8.2: Close v0.2.0 blockers: stock drive-config defect, red test gate, walkthrough re-run (INSERTED)

**Goal**: A user who installs stock VICE and this plugin reaches a verified 64K RAM capture on a broker-launched stock instance, and the tree is green and truthful enough to tag
**Depends on**: Phase 8.1
**Inserted**: 2026-08-19, from `.planning/v0.2.0-MILESTONE-AUDIT.md` §9 (round 2, verdict `gaps_found`)
**Requirements**: TBD — closes DIST-03, which round 2 falsified; adds no new requirement. Plans map to audit items instead: I-1, I-2, I-3, E-1..E-5
**Success Criteria** (what must be TRUE):

  1. A broker-launched stock `x64sc` boots with a 1541 on unit 8 — `buildViceArgs()`'s stock branch emits `-default -drive8type 1541` ahead of `-binarymonitor`, from one fix site, with the fork branch's argv byte-identical to before (I-2).
  2. A production stock launch never reads or writes the operator's real `$HOME/.config/vice/vicerc` — the scratch `XDG_CONFIG_HOME` computed in `spawnAndRecordInstance()` reaches `nodeSpawn()` on every real launch path (cold acquire, warm-floor spare, crash-respawn), proven through the real `makeLoggingSpawn` + `withCrashSupervision` composition rather than an injected stub (I-1, same-pass rider).
  3. A live, opt-in test drives `vice_disk_attach` and `vice_autostart` against a real `.d64` on an instance launched **through the real broker primitive**, and the `.prg`-only blast radius is settled by a pre-fix versus post-fix measurement rather than inference (I-2's coverage clause and its open question).
  4. `node test-gate.mjs` and CI's own bare `npm test` both report zero failures, so the tagging push cannot produce a red CI run (I-3).
  5. `c64-ram-capture` has been driven end to end against a provably broker-launched genuine-stock instance, and `08-HUMAN-UAT.md` Test 1 records the outcome as pass or fail — never pending (DIST-03).
  6. REQUIREMENTS.md, ROADMAP.md and STATE.md agree with what the re-run actually recorded, with coverage arithmetic and body-versus-frontmatter figures internally consistent rather than pinned to a literal, and each of Phase 8.1's five orphaned walkthrough findings has a tracked home (E-1..E-5).

**Plans**: 6 plans in 5 waves
Plans:

**Wave 1** *(two independent tracks, disjoint file ownership — item 2 and item 1's argv half)*

- [x] 08.2-01-PLAN.md — I-3: untrack Phase 8.1's throwaway `08.1-d-checklist.sh`, restoring a green `host-scripts.test.ts`, and prove both the narrowed gate and CI's bare `npm test` green [wave 1]
- [x] 08.2-02-PLAN.md — I-2 + I-1's first half: `-default -drive8type 1541` first in `buildViceArgs()`'s stock branch, the injected-spawn seam widened with an options parameter and the scratch `XDG_CONFIG_HOME` computed in `spawnAndRecordInstance()`, five new unit tests, and the mandatory `node build.ts` rebuild of `resources/broker-launch.mjs` [wave 1]

**Wave 2** *(blocked on 08.2-02, which co-owns `broker-launch.mts`)*

- [x] 08.2-06-PLAN.md — I-1 end to end: the options argument forwarded through the four hops that currently drop it (`makeLoggingSpawn`, `withCrashSupervision`'s wrapper body, the warm floor's `stashingSpawn`, `launchSupervised`'s `defaultRealSpawn`), both real daemon spawn-factory closures updated, `resources/vice-broker.mjs` rebuilt, and a `handleAcquire()` composition test with `buildColdSpawnFactory` omitted so an injected stub cannot fake it [wave 2]

**Wave 3** *(blocked on 08.2-02 and 08.2-06)*

- [ ] 08.2-03-PLAN.md — I-2's missing coverage: `stock-broker-live.test.ts`, the first live test to launch through the real spawned broker daemon (so both `buildViceArgs()` and the supervision composition are in the call path), registered as the seventh `MANUAL_ONLY_TESTS` entry, plus the pre-fix/post-fix `.prg` measurement that settles the blast radius [wave 3]

**Wave 4** *(blocked on 08.2-02, 08.2-03 and 08.2-06; runs in the main checkout, not a worktree)*

- [ ] 08.2-04-PLAN.md — item 3: re-run the install-to-RAM-capture walkthrough against a broker-launched stock instance, prove the argv from `epoch.json` + `ps` (never `resolvedBinaryPath`), assert `XDG_CONFIG_HOME` from `/proc/<pid>/environ` as a required pass, and record pass or fail in `08-HUMAN-UAT.md` [wave 4]

**Wave 5** *(blocked on 08.2-01, 08.2-03 and 08.2-04; runs in the main checkout, not a worktree)*

- [ ] 08.2-05-PLAN.md — item 4 / E-1..E-5: DIST-03's status derived from the re-run's actual verdict, self-consistent coverage arithmetic, the two stale "two-versus-three" phrases, a verify-before-editing pass over STATE.md, and five tracked todos for Phase 8.1's orphaned findings [wave 5]

Notes:

- **This phase is the last thing between the milestone and its tag.** Round 2 of the audit says do not tag v0.2.0 yet, and names four ordered items — the three in this phase's title plus the documentation drift that the newly-found defect invalidated:
  1. **I-2, the Drive8Type defect (CRITICAL).** The broker launches stock `x64sc` with `Drive8Type=0` (NONE) and no stock tool can set it, so `LOAD"*",8,1` fails and DIST-03's 64K capture is unreachable. Confirmed fix, live: `-drive8type 1541` in `buildViceArgs()`'s stock branch. Audit §4.2. Add the live `vice_autostart` / `vice_disk_attach` coverage through the **broker** whose absence hid this, and resolve the open `.prg`-only question — it decides whether the blast radius was "disk loads" or "all program loads".
  2. **I-3, the red test gate (CRITICAL for tagging).** Phase 8.1's committed throwaway `08.1-d-checklist.sh` trips `host-scripts.test.ts`'s repo-wide allowlist; CI runs bare `npm test`, so this fails CI on the tagging push. Untrack the script or extend `EXPECTED_TRACKED_SHELL_SCRIPTS`. Audit §4.3.
  3. **Re-run the walkthrough.** DIST-03 is not satisfied until `c64-ram-capture` reaches a verified 64K capture on a **broker-launched** stock instance. Record the outcome in `08-HUMAN-UAT.md` as pass or fail, never pending — the same protocol Phase 8.1 used.
  4. **Correct E-1..E-5.** Especially E-1: REQUIREMENTS.md asserts 51/51/0, which round 2 falsifies. Audit §7.
- **I-1 (production config isolation) is in scope only as a same-pass rider.** `buildViceArgs()` / `spawnFn` are already open for item 1, so give `spawnFn` an options parameter and set a scratch `XDG_CONFIG_HOME` for stock launches while there. Audit §4.4. It does not block tagging on its own.
- **Not in scope:** the Phase 3 and Phase 5 warning clusters (audit §4.5), and the five untracked walkthrough findings from Phase 8.1. Both are tracked; neither blocks tagging. If they are to be worked, they size their own phase.
- Item 1 must land before item 3 — the re-run has nothing new to prove until the drive-config fix exists. Item 2 is independent of both and must land before any push.

## Cut from scope (v0.2.0, 2026-08-17)

Removed after measuring the shipped skills' actual tool usage against both
manifests. **The test applied: does a skill call it, or does something a skill
calls depend on it?** Nothing below passes.

| Cut | Requirements | Why |
|---|---|---|
| Client-side screenshots and the PNG encoder | `SHOT-01`..`SHOT-05` | No skill calls `vice_display_screenshot`. Its only consumer is `gatherWedgeEvidence()`, where `captureStep()` already returns `{available: false}` on failure — so the incident record degrades from five evidence items to four and is still written. Five requirements and an indexed-PNG writer for one optional evidence field. |
| Call backtrace | `DERIV-02` | No skill calls `vice_backtrace`. |
| Checkpoint groups and ignore counts | `DERIV-03` | No skill calls any `vice_checkpoint_group_*` or `vice_checkpoint_set_ignore_count`. |
| Memory fill; every `*_set_state` write half | part of `DERIV-01`, `DERIV-05`, `DERIV-06` | No skill calls `vice_memory_fill`, `vice_sprite_set`, `vice_vicii_set_state`, `vice_cia_set_state`. |
| All stock-only gains | `GAIN-01`..`GAIN-09` | Entire Phase 6. Capability surplus, not a gap. See above. |
| Disk detach | remainder of `DIRECT-06` | No skill calls `vice_disk_detach`; stock has no detach opcode; re-attaching a different image covers the workflow. |
| Cross-backend parity harness | `VERIF-03` | Byte-identical parity is already an explicit non-goal in `PROJECT.md`. |

**Net effect:** 29 open requirements → 14. Phase 6 removed entirely; Phases 5, 7
and 8 narrowed to the ten buildable skill-called tools plus the capability-honesty
work that makes the two unbuildable ones survivable.

**Kept despite being uncalled:** nothing. Every retained requirement is either
called by a skill, or is `BACK-05`/`SKILL-01`/`DIST-*`, which exist precisely
because two called tools cannot be built.

**How to reverse a cut:** each row above names its requirements. They remain in
`REQUIREMENTS.md` marked `CUT` with this rationale, so restoring one is a
scope decision, not an archaeology exercise.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 7 → 8 → 8.1 → 8.2. **Phase 6 is
cut**; its number is retained so committed artifacts under `.planning/phases/` keep
their references. **Phase 8.1 was inserted 2026-08-19** to close audit round 1's two
open items before v0.2.0 is tagged. **Phase 8.2 was inserted later the same day**:
running 8.1's walkthrough falsified the claim it was meant to witness, audit round 2
returned `gaps_found`, and 8.2 is now the last phase of this milestone.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Corrected Ground Truth | 4/4 | Complete    | 2026-08-12 |
| 2. Stock Backend Connection | 10/10 | Complete    | 2026-08-13 |
| 3. Direct Tools | 18/18 | Complete    | 2026-08-16 |
| 4. Client-Side Tool Seam and 6510 Disassembler | 7/7 | Complete    | 2026-08-17 |
| 5. Skill-Critical Derived Tools | 13/13 | Complete    | 2026-08-17 |
| 6. Stock-Only Gains | — | **Cut** 2026-08-17 | - |
| 7. Cycle Timing and Wedge Triage | 18/18 | Complete   | 2026-08-18 |
| 8. Capability Honesty and the Install Story | 6/6 | Complete    | 2026-08-18 |
| 8.1 Close v0.2.0 audit items (INSERTED) | 5/5 | Complete    | 2026-08-19 |
| 8.2 Close v0.2.0 blockers (INSERTED) | 3/6 | In Progress|  |

**Remaining scope:** 14 open requirements across 3 phases, covering the 10
buildable skill-called tools missing on stock plus the capability-honesty work
for the 2 that cannot be built. Was 29 requirements across 4 phases.
*(Corrected 2026-08-19, during Phase 8.1: **0 open** -- all 51 in-scope
requirements are satisfied with evidence, and "the 2 that cannot be built" is
**3** (`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`).
See the paragraph immediately below and REQUIREMENTS.md's coverage block.)*

~~**Remaining work is not requirement work.** All 51 in-scope requirements are
satisfied with evidence (`.planning/v0.2.0-MILESTONE-AUDIT.md` §2). What Phase 8.1
closes is one unwitnessed claim and seven stale documents.~~

**Superseded 2026-08-19 by audit round 2.** Remaining work *is* requirement work:
running Phase 8.1's walkthrough falsified **DIST-03**, so the 51/51/0 figure above
and in REQUIREMENTS.md is no longer true. The two paragraphs above are left struck
through rather than rewritten here because correcting them — audit items E-1..E-5,
`.planning/v0.2.0-MILESTONE-AUDIT.md` §7 — is **Phase 8.2's own deliverable**, and
the count depends on what 8.2's fix actually restores. Read §2 of that audit, not
this section, until 8.2 closes.

---

# Milestone v0.3.0: regenerator2000 static-analysis backend (PROPOSED)

**Status:** proposed, not opened.
**Dependency on v0.2.0: none, structurally.** regenerator2000 never touches VICE
(D-R1), so it is backend-agnostic — it behaves identically on the fork and stock
backends. The one apparent cross-dependency, Phase 12's symbol round trip needing
`DERIV-04`, is **already satisfied on the fork**: `vice_symbols_load` and
`vice_symbols_lookup` ship today; `DERIV-04` only restores them on *stock*. So
this milestone could run against the fork backend with no v0.2.0 work at all.

**Phase 9's assumption probe (`R2000-16`) may be pulled forward now**, ahead of
v0.2.0 Phases 5-8, and should be. It has no v0.2.0 dependency, it de-risks the
whole milestone for the cost of a day, and — the real reason — it erases the only
genuine rework between the two milestones: v0.2.0 Phase 8 writes the install
story (`DIST-01/02/03`) and revises the playbooks (`SKILL-01`), which v0.3.0 then
rewrites and re-touches. Knowing the probe's answers before Phase 8 lets Phase 8
write those docs **once**, already naming regenerator2000.

**What v0.2.0 still has to finish regardless of this milestone**, because
regenerator2000 replaces none of it: stock advertises 26 tools against the fork's
62, and Phase 5 is that gap (memory search, backtrace, sprites, chip-state
decode, screenshots, symbols). Phase 4's disassembler has one consumer today and
gains its second from Phase 5's backtrace. Phase 7 owns disk detach (the deferred
half of `DIRECT-06`) and wedge triage on stock. The entire overlap analysis found
exactly one deletable thing in this codebase: a 14-line `toacme` shim. *(As of
2026-08-19: `tools-manifest.stock.json` ships **38** tools. 26 was the figure at
the 2026-08-17 cut, before Phases 5 and 7 added twelve tools; the fork's 62 is
unchanged.)*

**If v0.3.0 needs to start sooner, defer Phase 6, not 5 or 7.** Phase 6 is
"Stock-Only Gains" — value-add with no parity requirement behind it. Phases 5 and
7 are what make the stock backend usable at all. This holds independently of
regenerator2000.
**Defined:** 2026-08-17 from `/gsd-explore`.
**Grounding:** `.planning/notes/regenerator2000-integration.md` (decisions
D-R1..D-R4, overlap map, source-confirmed upstream blockers).
**Requirements:** `R2000-01`..`R2000-16` in `REQUIREMENTS.md` (proposed block).

## Overview

[regenerator2000](https://github.com/ricardoquesada/regenerator2000) is an
interactive 6502 disassembler for Commodore 8-bits (Rust, TUI, Apache-2.0). It
brings three things this project structurally lacks: a **persistent, queryable
annotation store** (labels, comments, enums, block types, scopes, undo/redo), a
**recursive-descent disassembler with an auto-analyzer** and export to four
assemblers, and a **sandboxed binary unpacker** covering the common C64 packers.

It is adopted as a **static-analysis backend only**. It is never given
`--vice` — our broker keeps sole ownership of stock VICE's binary monitor,
because that monitor serves exactly one client and a second connection is
indistinguishable from a wedge. Everything uniquely ours (broker, pool, warm
floor, crash supervision, container path translation, incident capture, wedge
triage, live-RAM disassembly) is untouched.

The journey runs: prove the four load-bearing assumptions against a real build
and land the batch-CLI route, which is enough to retire `acme-build`'s
`toacme` shim (Phase 9) → stand up the container-side MCP server under the
never-`--vice` guard (Phase 10) → make recon write queryable state and generate
enums from `memmap.json` (Phase 11) → close the symbol round trip with DERIV-04
and finish the install and playbook story (Phase 12).

## Standing Constraints

- **`--vice` is never passed.** Guarded in the launch path, not merely
  documented (`R2000-01`). This is the constraint the whole milestone shape
  follows from.

- **regenerator2000 runs on the MCP proxy's side of the container boundary.** No
  `hostpath.ts` / `containerpath.ts` translation is applied to any argument
  passed to it (`R2000-02`). This is what makes devcontainer use and two
  simultaneous projects work with no upstream patch — separate network
  namespaces mean the hardcoded `127.0.0.1:3000` stops colliding. Note the
  inversion hazard: were it host-side, the project-file argument *would* need
  host translation, the mirror image of the `DERIV-07` screenshot-path trap.

- **Phase 4's disassembler stays.** Its sole non-test consumer is
  `stock-disassemble.ts` — `vice_disassemble` against live RAM at a checkpoint,
  which a file-based static tool cannot serve. Phase 5's backtrace also needs
  the opcode table.

- **Phase 5 does not shrink.** regenerator2000's sprite/bitmap/charset views are
  TUI-only and not MCP-exposed, so the agent-readable ASCII rendering is still
  required.

- **The emulator depack route stays.** regenerator2000's unpacker becomes the
  fast path for the packers it recognises; the emulator handles custom loaders
  and disk-based loads its sandbox cannot.

## Known upstream limits (not this milestone's work)

Source-confirmed at `ricardoquesada/regenerator2000@main`:

| Limit | Location | Effect |
|---|---|---|
| `--mcp-server` is a bare boolean, HTTP port hardcoded 3000 | `src/main.rs:62-64`, `mcp/http.rs:198` | two projects in one namespace cannot coexist. `run_server(port: u16)` is already parameterized — a ~3-line CLI fix upstream |
| MCP HTTP binds `127.0.0.1` only | `mcp/http.rs:196` | a host-side regenerator2000 is unreachable from a devcontainer. Sidestepped by D-R4, not fixed |
| headless refuses non-`.regen2000proj` | `src/main.rs:141-152` | the batch-export and stdio-MCP routes cannot ingest a raw binary. **Does not affect HTTP MCP mode** — `main.rs:710` omits `cli.mcp_server` from the headless disjunction |

The third limit is narrower than its error message suggests. Only `.bin`/`.raw`
(origin hardcoded to `Addr::ZERO`, `file_io.rs:125-127`, and no `--origin` flag
exists) and disk/tape images (which file inside the container?) are genuinely
ambiguous. `.prg` and `.vsf` are self-configuring — origin, system and entry
point all come from the file — and are over-restricted by a blunt extension
check. The route through it is a **bootstrap under a pty**: `--mcp-server <raw
binary>` loads and auto-analyses (`auto_analyze` is checked in the load path at
`file_io.rs:391`, no keypress), then `r2000_save_project` writes the project
file, after which every headless route unlocks. No human decisions are required.
Whether the TUI tolerates a pty with no real TTY is `R2000-16`(a) and gates
Phase 9.

Consequences carried, not solved: r2000-assisted two-release diffing in
`c64-provenance-diff` is blocked by the first limit, and is documented for the
user (`R2000-04`) rather than worked around. Synthesizing a `.regen2000proj`
ourselves was considered and rejected — it depends on an undocumented serde
format, and the pty bootstrap makes it unnecessary.

## Phases

Two phases, not four. Collapsed 2026-08-17 by the same test applied to v0.2.0:
**does a skill need it, or does something a skill needs depend on it?**

- [ ] **Phase 9: Probe, Bootstrap, and the Removal** - Answer the five load-bearing assumptions against a real build, automate project creation, and retire `acme-build`'s `toacme` shim
- [ ] **Phase 10: Annotation Store, Enums, and the Symbol Round Trip** - Recon writes queryable state, `memmap.json` generates enums, and names flow both ways between the store and the live emulator

### Phase 9: Probe, Bootstrap, and the Removal

**Goal**: The bet is de-risked, project creation needs no human, and the one thing regenerator2000 makes obsolete is gone
**Depends on**: nothing — **may run now, ahead of v0.2.0 Phases 5-8** (see the dependency note above)
**Requirements**: R2000-16, R2000-01, R2000-02, R2000-03, R2000-05, R2000-06, R2000-09
**Success Criteria** (what must be TRUE):

  1. All five assumptions in `R2000-16` are answered against a real build and recorded in the repo, with any failure recorded as an accepted limit stating what it breaks.
  2. A raw `.prg` or a `.vsf` snapshot becomes a `.regen2000proj` **without a human** — HTTP MCP mode under a pty, auto-analysis on load, then `r2000_save_project`. If `R2000-16`(a) fails, this degrades to a documented one-time interactive step and every affected playbook says so.
  3. The launch path **refuses** to pass `--vice`, enforced in code and tested, and no argument passed to regenerator2000 is host-translated.
  4. `acme-build`'s `disasm` verb and its `## Disassembly` section are gone, the `toacme` prerequisite is dropped, and a replacement route producing source that **reassembles** — verified by running the assembler — is documented in its place.
  5. The install documentation names regenerator2000 as a prerequisite, states the toolchain cost plainly, and its Apache-2.0 notice is in `THIRD-PARTY-NOTICES.md`.

**Plans**: TBD

Notes:

- **Criterion 1 gates everything, including whether Phase 10 is worth starting.** Run it first, alone, and read the result before planning further. If regenerator2000 cannot be driven without a human, the annotation store is not reachable from a skill and the milestone should be reconsidered rather than replanned.
- **Run this phase before v0.2.0 Phase 8.** It has no v0.2.0 dependency, and knowing its answers lets Phase 8 write the install story once — already naming regenerator2000 — instead of writing it and then rewriting it here. That is the only genuine rework between the two milestones.
- Criterion 3's "no host translation" is a deliberate *absence*, the mirror image of `DERIV-07` where translation was wrongly applied. Assert it in a test so nobody adds it later.
- Criterion 4 is the entire deletion this milestone earns: a 14-line `spawnSync` wrapper around `toacme` (`scripts/acme.mjs:208-223`) plus ~50 lines of `SKILL.md` caveats that exist only because `toacme` does a flat linear decode. Prefer regenerator2000's own `--verify-roundtrip` over building a reassembly gate — note it implies `--headless`, so criterion 2 comes first.
- Prefer `.vsf` over `.raw` for anything out of the emulator: snapshots carry memory, machine type and start address, while `.raw` loads at origin `$0000` with no CLI override.

### Phase 10: Annotation Store, Enums, and the Symbol Round Trip

**Goal**: Recon findings become state a later session can query, register writes read as names, and names flow both ways between the store and the running machine
**Depends on**: Phase 9, and v0.2.0 Phase 5 for `DERIV-04` on the stock backend
**Requirements**: R2000-10, R2000-11, R2000-13, R2000-14, R2000-15
**Success Criteria** (what must be TRUE):

  1. `c64-program-recon` writes labels, comments, block types and scopes into the annotation store, and a later session queries that store instead of re-deriving the findings from Markdown.
  2. A user can ask which addresses reference a given address, and search labels, comments and instructions across an analysed program.
  3. Enums generated from `c64-memory-mapping`'s `memmap.json` make a disassembly render per-bit VIC-II/SID/CIA writes with semantic names — `lda #$1b / sta $d011` reads as named bits.
  4. Symbols annotated in regenerator2000 resolve live addresses through `vice_symbols_load`, and names discovered against the running machine flow back into the store — a round trip, not a one-way dump.

**Plans**: TBD

Notes:

- Criterion 1 is why this milestone exists. Today `templates/memory-map.template.md` produces prose that nothing can query, diff, or undo.
- Criterion 3 is the most distinctive thing available here — **neither project can do it alone.** `memmap.json` holds the bit tables; regenerator2000 holds the enum mechanism and `--dump-enum-files`.
- Criterion 4 works on the **fork backend today** — `vice_symbols_load` and `vice_symbols_lookup` already ship there. `DERIV-04` (v0.2.0 Phase 5) is what extends it to stock, which is why this phase depends on Phase 5 but this milestone as a whole does not depend on v0.2.0.
- `--export_lbl` / `--import_lbl` are **VICE label files** on both sides. No glue format to invent; if Phase 9's criterion 1(c) found a mismatch, resolve it here.

## Cut from v0.3.0 scope (2026-08-17)

| Cut | Requirements | Why |
|---|---|---|
| Separate MCP-server-standup phase | (was Phase 10) | Wiring is a task inside Phase 9's criterion 3, not a phase. Nothing else was in it once the two-project limit became a documentation line. |
| HTML export with clickable xrefs | `R2000-07` | A shareable artifact no skill produces or consumes. Genuinely nice; not why we are here. Available ad-hoc via `--export_html` regardless. |
| Two-project limit as a reported error | `R2000-04` | Folded into Phase 9's install documentation as a stated limitation. Building detection-and-reporting for an upstream port collision is work in the wrong place. |
| Static-vs-live tool-selection axis | `R2000-12` | Folded into v0.2.0's `SKILL-01`, which is already rewriting the same playbooks for backend routing. One pass over `c64-program-recon`, not two. |
| `.vsf`/`.raw` bridge as its own requirement | `R2000-08` | Reduced to a note on Phase 9 criterion 2 — it is which file extension you hand over, not a deliverable. |

**Net effect:** 4 phases → 2, and 16 requirements → 12 (with 4 folded rather than
abandoned). Phases 11 and 12's numbers are not reused.

## Progress

**Execution Order:** 9 → 10. Phase 9's criterion 1 may run **now**, ahead of
v0.2.0 Phases 5-8.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. Probe, Bootstrap, and the Removal | 0/TBD | Not started | - |
| 10. Annotation Store, Enums, and the Symbol Round Trip | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.3.0 appended 2026-08-17 as a proposed milestone from `/gsd-explore` — not opened*
