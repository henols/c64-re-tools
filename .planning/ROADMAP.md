# Roadmap: c64-re-tools

## Milestones

- 🚧 **v0.2.0 Switchable stock-VICE backend** — Phases 1-8 (in progress)
- 📋 **v0.3.0 regenerator2000 static-analysis backend** — Phases 9-12 (proposed, not opened)

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
6510 disassembler that several later tools depend on (Phase 4) → reimplement the
tools the fork did inside the emulator, plus client-side screenshot encoding
(Phase 5) → land the three capability groups only stock has (Phase 6) → restore
cycle timing and wedge triage (Phase 7) → annotate the surface per backend,
document the install story, and compare the two backends against each other
(Phase 8).

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
- [ ] **Phase 5: Client-Side Derivations and Screenshots** - Reimplement the tools the fork ran inside the emulator, and encode screenshots client-side from the framebuffer
- [ ] **Phase 6: Stock-Only Gains** - CPU-history tracing, 1541 drive-CPU debugging, and raster-precise conditions / exact palette / full resources
- [ ] **Phase 7: Cycle Timing and Wedge Triage** - Elapsed-cycle measurement, exact run-until-address, and the "is the emulator advancing" check on stock
- [ ] **Phase 8: Capability Surface, Docs, and Cross-Backend Verification** - Per-backend support annotation, the install story, skill-playbook revision, and a two-process parity harness

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

**Plans**: 10 plans in 7 waves
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

### Phase 5: Client-Side Derivations and Screenshots

**Goal**: Tools the fork implemented inside the emulator work client-side on stock, including screenshots
**Depends on**: Phase 4
**Requirements**: DERIV-01, DERIV-02, DERIV-03, DERIV-04, DERIV-05, DERIV-06, SHOT-01, SHOT-02, SHOT-03, SHOT-04, SHOT-05
**Success Criteria** (what must be TRUE):

  1. A user can search, compare and fill memory ranges, group checkpoints and set an ignore count, get a call backtrace, load a symbol file and see addresses resolved to symbol names, and inspect and set sprites including ASCII rendering — all on the stock backend.
  2. Decoded VIC-II and CIA state marks every internal field stock cannot read as explicitly unavailable, never reporting it as zero.
  3. A user capturing a screenshot on the stock backend receives a valid PNG at a returned file path, written directly to the container path with no host translation, and the incident record's "saved to" claim is verifiable against the file existing.
  4. Screenshot capture adds no npm dependency, and screenshot content is visible to Claude as an MCP image content block rather than only as a text-encoded data URI.
  5. `gatherWedgeEvidence()` no longer host-translates the screenshot path on the stock backend, and torn-frame behaviour is either avoided by capturing while paused or documented.

**Plans**: TBD

Notes:

- Screenshots are a derived tool through Phase 4's seam, composing `DISPLAY_GET` + `PALETTE_GET` plus local encoding. The two calls can be issued concurrently — the client correlates by request id.
- Encode with a ~50-line indexed-PNG writer over `node:zlib` (`crc32` since Node 22.2, `deflateSync` for the RFC 1950 stream `IDAT` needs). `DISPLAY_GET` INDEXED8 bytes are already PNG colour-type-3 pixel data — index `N` maps directly to palette entry `N`. `pngjs` cannot write indexed PNGs at all; native encoders are the wrong shape for an `npx`-distributed plugin.
- Parse `BL`/`BD` off `4 + FL`, not the literal offsets 17/21 the probe hardcodes, and advance palette entries by `1 + IS`, not a fixed 4.
- Default to the full frame including border. `XO`/`YO`/`IW`/`IH` are degenerate on every VICE machine, so cropping from them is a no-op; an optional `crop: "inner"` must come from a `(DW,DH)` lookup table and refuse-with-note on unrecognised geometry.
- **Second breakage site, same cause as DERIV-07:** `gatherWedgeEvidence()` calls `rewriteArguments()` itself. On the stock backend, *performing* that translation becomes the bug — its own comment inverts. Route it through the same derived-tool helper the public tool uses rather than branching on backend at the call site.
- This phase retires the screenshot host-path candidate ladder and makes screenshotting unit-testable for the first time — both were previously recorded as untestable without a real emulator. Treat both as acceptance, not accident.
- **Parallel:** memory search/compare/fill, checkpoint groups, the symbol store, chip-state decode, sprites, and screenshots are six independent tool families. Only backtrace has an intra-milestone dependency (Phase 4's opcode table).

### Phase 6: Stock-Only Gains

**Goal**: The three capability groups only stock VICE has become usable, with their traps closed rather than discovered later
**Depends on**: Phase 5
**Requirements**: GAIN-01, GAIN-02, GAIN-03, GAIN-04, GAIN-05, GAIN-06, GAIN-07, GAIN-08, GAIN-09
**Success Criteria** (what must be TRUE):

  1. On a build that supports it, a user retrieves a CPU instruction-history trace with registers and cycle timestamps; on a build that does not, the tool explains what is missing and which version provides it, distinguishing "opcode absent" from "feature not compiled in".
  2. A user can set checkpoints and read registers and memory on a 1541 drive CPU; with true drive emulation disabled the tool reports that precondition explicitly instead of returning zeros that look like data.
  3. After a drive checkpoint hit, stepping and `@bank:` conditions still act on the CPU the user asked for — the tool either restores the contaminated state or refuses, and never silently steps the drive.
  4. A user can break at an exact raster line and cycle; a condition that would be silently always false — unparenthesised, bare-decimal, `LIN`/`CYC`, lowercase, or out of range for the machine's video standard — is refused with an explanation instead of being sent.
  5. A user can read the emulator's exact palette and get and set resources beyond today's whitelist, while resources that power-cycle the machine or break the monitor connection are denied outright and drive-resetting ones require explicit intent.

**Plans**: TBD

Notes:

- **GAIN-05 is in the same phase as GAIN-03 by requirement, not by convenience.** Drive debugging is what creates `default_memspace` contamination: a drive checkpoint hit sets it at `monitor.c:3393-3396`, no binary-monitor command resets it, and afterwards `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the *drive* CPU while `@bank:` conditions fail outright. Shipping GAIN-03 without GAIN-05 silently breaks stepping for the rest of the session.
- Drive reads on `x64sc` **always succeed** — `check_drive_emu_level_ok()` is a machine-capability check that always passes, so there is no protocol-level way to detect a stopped drive CPU. The real gate is `Drive8TrueEmulation` plus a non-zero `Drive8Type`, and setting TDE resets the drive CPU (destructive, must be labelled).
- `CPUHISTORY_GET` needs VICE ≥ 3.10 (Debian and all current Ubuntu ship 3.9) **and** is compile-time optional even on 3.10+ — the two failures are distinguishable only by error code (`0x83` vs `0x8f`). Gate on the 4-byte version quad, never the SVN revision, which is zeros in distro builds. Clamp the count field to 65535.
- Conditions attach to an existing checkpoint by number, cannot be read back, cannot be cleared, and leak if re-set — so keep a client-side condition registry, treat conditions as immutable, and delete the orphan checkpoint if `CONDITION_SET` fails, or a full-range unconditioned breakpoint is left armed.
- `RESOURCE_SET` ships an **allow-list**, not a deny-list. Hard-block `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency` (each power-cycles the machine one call deep), and `BinaryMonitorServer`/`BinaryMonitorServerAddress` (each makes the instance unreconnectable). Resource names are not version-stable (`TrapDevice8` was `VirtualDevice8` before 3.10, no alias) — probe or version-key.
- **Parallel:** the three research groups (A drive-CPU, B raster conditions, C resources/palette) are independent of each other. Within A, GAIN-03/04/05 are one unit.

### Phase 7: Cycle Timing and Wedge Triage

**Goal**: "How long did that take" and "is the emulator still advancing" work on the stock backend
**Depends on**: Phase 6
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04, DIRECT-06 *(detach half only — see criterion 4)*
**Success Criteria** (what must be TRUE):

  1. A user can measure elapsed CPU cycles on the stock backend on any supported VICE version, by a route whose socket cost has been measured against a real build rather than assumed.
  2. A user can run until an address is reached exactly, and cycle-bounded execution either works or reports its approximation and error bound honestly rather than implying precision it does not have.
  3. `vice-wedge-triage`'s "is the emulator advancing" check works on the stock backend: two samples straddling a resume, distinguishing advancing-but-jiffy-frozen from a tight loop.
  4. **DIRECT-06 (detach half, inherited from Phase 3):** disk *detach* on the stock backend either works via the concurrent `-remotemonitor` text-monitor route this phase already stands up, or is closed out as a permanent, documented divergence in `docs/stock-vice-parity.md`. Stock VICE's binary monitor has no detach opcode, so Phase 3 correctly scoped it out (D-13); this phase owns the decision because it is the first phase that establishes the text-monitor route detach would need. Attach itself already works on stock and is not in question.

**Plans**: TBD

Notes:

- This phase must **resolve the CONFLICT and REFINEMENT blocks** in `.planning/notes/stock-vice-migration-revised-loss-ledger.md` rather than inherit them. Route 1 (reconstruct from `LIN`/`CYC` with a frame counter from an unconditioned non-stopping checkpoint at `$EA31`) costs ~50-60 unsolicited `CHECKPOINT_INFO` frames per second for as long as the stopwatch exists, emitted synchronously from inside the CPU loop. The REFINEMENT does not rescue it — every hit of a frame counter is a wanted hit, so a condition cannot reduce the traffic. Route 2 (the text monitor's real `stopwatch` over a concurrent `-remotemonitor`, which coexists with `-binarymonitor`) avoids it. Decide with measurement, and record the decision.
- Route 2's dependency is why this phase sits after Phase 6: enabling the text monitor is either a broker launch flag or `RESOURCE_SET MonitorServer 1`, and keeping both options open means not blocking on a launch-flag decision made in Phase 2.
- There is no monotonic cycle register. `LIN`/`CYC` are readable but wrap every frame, are derived from the CPU clock rather than the VIC-II raster counter (fixed phase offset from `$D012`), are identical across all memspaces, and are silently read-only.
- Prefer registers over `$D012` for the advancing check, and add the jiffy clock at `$A0-$A2`. Both samples must straddle an `EXIT` or the values are frozen.

### Phase 8: Capability Surface, Docs, and Cross-Backend Verification

**Goal**: A user knows what each backend gives them, can get there from a package manager, and the two backends' output has actually been compared
**Depends on**: Phase 7
**Requirements**: BACK-05, DIST-01, DIST-02, DIST-03, SKILL-01, VERIF-03
**Success Criteria** (what must be TRUE):

  1. The full tool inventory is documented with its per-backend availability, so a user can see which tools each backend advertises without running anything — the manifest itself is trimmed per backend (D-07), so this declaration lives in documentation and covers tools absent from the active backend's list.
  2. Calling a tool the active backend does not advertise returns an error naming the capability, the reason, and which backend provides it — not a generic unknown-tool error, never a silent wrong answer, and never a no-op success. On stock this is the out-of-manifest call path, since the tool is absent from `tools/list` rather than present-and-refusing.
  3. A new user can read which VICE they need, where to get it per platform, what differs per version, and that the fork is required for SID read-back and matrix keyboard.
  4. Installing the plugin plus a package-manager stock VICE is sufficient to drive the emulator end to end, verified on a clean machine or container rather than asserted.
  5. Tool output has been compared between backends for a known program using a harness that runs **two server processes**, one per backend, with every divergence either explained as expected or filed as a defect.
  6. No skill playbook instructs Claude to use a capability the active backend cannot provide without naming the stock-backend route or the fork requirement — covering `c64-program-recon`'s `vice_keyboard_matrix` instruction and whole-chip-read guidance, `c64-ram-capture`'s matrix-keyboard "hit any key" step, and `vice-wedge-triage`'s stopwatch bracket.

**Plans**: TBD

Notes:

- **VERIF-03 is a harness design task, not a test run.** Backend selection is project-level — one backend per MCP server process — so both backends cannot be live in one process. The harness must stand up two servers, drive the same script through each, and diff structured output, with a documented divergence list (disassembly spelling, illegal-opcode rendering, and everything `docs/stock-vice-parity.md` §A.7 already licensed) treated as expected rather than as failures. Budget it as real work.
- BACK-05 lands here rather than in Phase 2 because the error it returns must name the capability and the restoring backend, which requires the completed per-backend capability matrix — and that requires the full tool inventory from Phases 3-7.
- BACK-05 also carries the runtime half of the skill-methodology problem: `vice_keyboard_matrix` on stock must say "the fork backend provides this" instead of doing nothing. Under D-07 that tool is **absent** from stock's `tools/list`, so BACK-05's error is raised on an out-of-manifest `tools/call` — an MCP client may call a tool it was never advertised, and that is the case this criterion covers. See Coverage Notes for the prose half.
- **Parallel:** the manifest annotation, the install/version documentation, and the parity harness are three independent plans.

## Coverage Notes

**Requirement count corrected.** `REQUIREMENTS.md` stated "63 total" in its
Coverage block, but the file contains **67** requirement items
(BACK 5, BROK 3, DERIV 7, DIRECT 9, DISASM 7, DIST 3, DOC 3, GAIN 9, PROTO 8,
SHOT 5, TIME 4, VERIF 4). The 63 was stale — possibly carried over from
PROJECT.md's "~63 tools" figure. All 67 are mapped; the Coverage block has been
corrected to 67.

**Coverage:** 68/68 v0.2.0 requirements mapped to exactly one phase. No orphans,
no duplicates. (67 from the corrected count, plus `SKILL-01` added by user decision.)

**Gap identified, not silently absorbed.** The loss ledger records that **3 of 6
skills need methodology revision** (`c64-program-recon`'s "use
`vice_keyboard_matrix`" instruction, `c64-ram-capture`'s matrix-keyboard step in
its "hit any key" gate, `vice-wedge-triage`'s stopwatch bracket, and
`c64-program-recon`'s "prefer whole-chip state reads" guidance). No v0.2.0
requirement covers revising that **playbook prose**:

- TIME-04 covers the wedge-triage *mechanism*, not the SKILL.md text.
- BACK-05 covers the *runtime* symptom — a stock-backend call to a fork-only
  tool now names the capability and the backend that restores it, instead of
  silently doing nothing.

- DIST-02 covers *install* documentation, not skill methodology.

So the failure mode is caught at runtime but the playbooks still tell Claude to
do something that will be refused.

**RESOLVED (user decision, 2026-08-12): `SKILL-01` added and mapped to Phase 8.**
The skills whose documented methodology depends on fork-only capabilities must
name the stock-backend route or state the fork requirement. It is Phase 8 success
criterion 6, and it sits alongside `DIST-02` (install docs) and `BACK-05` (the
runtime error) so all three halves of the same problem land together. Coverage is
therefore **68/68**, not 67/67.

The alternatives considered and rejected: deferring to a follow-up milestone
(leaves the playbooks wrong while the runtime error carries the user), and
splitting it so only `vice-wedge-triage` is fixed in Phase 7 (fixes the skill
whose mechanism changed but leaves the two keyboard-dependent playbooks stale).

**No UI phases.** Scanned every phase for UI/frontend indicators. This milestone
is an MCP server, a protocol client, and a broker — there is no frontend
surface. Phase 5's screenshot and sprite work concerns an emulator framebuffer
and PNG bytes, not an interface, so no `UI hint` annotation applies.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Corrected Ground Truth | 4/4 | Complete    | 2026-08-12 |
| 2. Stock Backend Connection | 10/10 | Complete    | 2026-08-13 |
| 3. Direct Tools | 18/18 | Complete    | 2026-08-16 |
| 4. Client-Side Tool Seam and 6510 Disassembler | 7/7 | Complete    | 2026-08-17 |
| 5. Client-Side Derivations and Screenshots | 0/TBD | Not started | - |
| 6. Stock-Only Gains | 0/TBD | Not started | - |
| 7. Cycle Timing and Wedge Triage | 0/TBD | Not started | - |
| 8. Capability Surface, Docs, and Cross-Backend Verification | 0/TBD | Not started | - |

---

# Milestone v0.3.0: regenerator2000 static-analysis backend (PROPOSED)

**Status:** proposed, not opened. Requires v0.2.0 complete.
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

- [ ] **Phase 9: Verified Batch Route** - Check the five load-bearing assumptions against a real build, automate project bootstrap, then land the batch-CLI integration and retire `acme-build`'s `toacme` shim
- [ ] **Phase 10: Container-Side MCP Server** - Stand up the regenerator2000 MCP server beside the proxy under the never-`--vice` guard, with the two-project limit reported rather than hit
- [ ] **Phase 11: Annotation Store and Enums** - Recon writes queryable state instead of prose only, and `memmap.json` generates regenerator2000 enums
- [ ] **Phase 12: Symbol Round Trip, Install Story, and Playbooks** - Close the DERIV-04 loop in both directions and finish the prerequisite documentation and skill revisions

### Phase 9: Verified Batch Route

**Goal**: The batch route is proven against a real build and is good enough to delete the `toacme` shim
**Depends on**: v0.2.0 complete
**Requirements**: R2000-16, R2000-05, R2000-06, R2000-07, R2000-08, R2000-09, R2000-03
**Success Criteria** (what must be TRUE):

  1. All five assumptions in `R2000-16` are answered against a real regenerator2000 build and recorded in the repo — pty tolerance, ACME export reassembly under `!cpu 6510`, `--export_lbl` format versus what DERIV-04 will consume, `.vsf` load fidelity, and container-side toolchain cost — with any that fail recorded as an accepted limit stating what it breaks.
  2. A raw `.prg` or a `.vsf` snapshot becomes a `.regen2000proj` **without a human**: HTTP MCP mode under a pty, auto-analysis on load, then `r2000_save_project`. If the pty check in criterion 1 fails, this degrades to a documented one-time interactive step and every affected playbook says so.
  3. `acme-build`'s `disasm` verb and its `## Disassembly` section are gone, the `toacme` prerequisite is dropped, and the replacement route is documented in their place.
  4. A user can turn a `.prg` or an emulator-depacked snapshot into ACME source that **reassembles**, verified by running the assembler, not asserted.
  5. A user can produce an HTML disassembly with working cross-reference links.

**Plans**: TBD

Notes:

- **Criterion 1(a) gates the rest of the milestone.** Whether HTTP MCP mode tolerates a pty with no real TTY decides whether criterion 2 is an automated bootstrap or a documented manual step — and that in turn decides how every later playbook reads. Do not plan Phases 10-12 in detail before it runs.
- The bootstrap in criterion 2 exists because `validate_headless_mode` is an extension allowlist, not an information requirement: `.prg` and `.vsf` already carry origin, system and entry point. Prefer `.vsf` over a flat `.raw` for anything coming out of the emulator — `.raw` loads at origin `$0000` with no override.
- The removal in criterion 2 is smaller than it looks: `disasm` is a 14-line `spawnSync` wrapper around `toacme` (`scripts/acme.mjs:208-223`). The real removal is documentary — ~50 lines of `SKILL.md` caveats that exist only because `toacme` does a flat linear decode (BASIC stub read as instructions, out-of-range labels needing manual definition, illegal-opcode indentation, the `.dis.a` → `.dis.asm` Read-tool workaround).
- Criterion 4's reassembly check is the honest version of what `SKILL.md` currently only advises. regenerator2000 ships `--verify-roundtrip` (export → assemble → diff) — prefer using its gate over building one. Note it implies `--headless`, so it needs a project file, i.e. criterion 2 first.
- **Parallel:** the assumption probe (criterion 1) precedes everything, and criterion 2 precedes anything using a batch flag. The `acme-build` retirement, ACME export and HTML export are then three independent units.

### Phase 10: Container-Side MCP Server

**Goal**: Claude can drive regenerator2000 over MCP from inside a devcontainer, with the socket-ownership rule enforced in code
**Depends on**: Phase 9
**Requirements**: R2000-01, R2000-02, R2000-04, R2000-11
**Success Criteria** (what must be TRUE):

  1. The launch path **refuses** to pass `--vice`, enforced in code and tested, so no configuration or user error can put a second client on the binary monitor.
  2. Claude reaches the regenerator2000 MCP server from inside a devcontainer, and no argument passed to it is host-translated.
  3. Two projects open in separate devcontainers both work; a second project in the *same* namespace is refused with a message naming the hardcoded-port cause and the upstream gap, not a bind error or a hang.
  4. A user can ask which addresses reference a given address, and search labels, comments and instructions across an analysed program.

**Plans**: TBD

Notes:

- Criterion 1 is the load-bearing one. It mirrors `vice.ts`'s `DENY_LIST` pattern: one place, checked at the dispatch seam, never re-derived locally.
- Criterion 2's "no host translation" is a deliberate *absence*. It is the mirror image of `DERIV-07` — there, translation was wrongly applied; here, applying it would be the bug. Assert it in a test rather than trusting that nobody adds it later.
- Criterion 3 is a reporting requirement, not a pooling one. The broker is deliberately **not** extended to pool regenerator2000 instances — that would only be needed for host-side operation, which is blocked upstream by both the boolean `--mcp-server` and the loopback bind.
- Consider whether the stdio transport avoids the port question entirely. Upstream documents it as "experimental/testing only", so treat it as an investigation, not a plan.

### Phase 11: Annotation Store and Enums

**Goal**: Recon findings become state a later session can query, and register writes read as names instead of magic numbers
**Depends on**: Phase 10
**Requirements**: R2000-10, R2000-12, R2000-13
**Success Criteria** (what must be TRUE):

  1. `c64-program-recon` writes labels, comments, block types and scopes into an annotation store, and a later session queries that store instead of re-deriving the findings from the Markdown.
  2. `c64-program-recon`'s tool-selection reference tells Claude which questions are static and which need the running machine, so neither substrate is used for the other's job.
  3. Enum definitions generated from `c64-memory-mapping`'s `memmap.json` make a disassembly render per-bit VIC-II/SID/CIA register writes with semantic names — `lda #$1b / sta $d011` reads as named bits.

**Plans**: TBD

Notes:

- Criterion 1 is the milestone's main prize. Today `templates/memory-map.template.md` produces prose nothing can query, diff, or undo.
- Criterion 3 is the most distinctive gain available here — **neither project can do it alone.** `memmap.json` holds the bit tables; regenerator2000 holds the enum mechanism and `--dump-enum-files`. Generate once, benefit on every disassembly.
- Criterion 2 adds a third axis to tool selection on top of stock-vs-fork. Reuse the `SKILL-01` shape rather than inventing a second convention for "which backend answers this".
- **Parallel:** the enum generator (criterion 3) is independent of the recon rewrite (criteria 1-2) — different skills, different files.

### Phase 12: Symbol Round Trip, Install Story, and Playbooks

**Goal**: Names flow in both directions between the annotation store and the live emulator, and the prerequisite is honestly documented
**Depends on**: Phase 11, and v0.2.0 Phase 5 (DERIV-04)
**Requirements**: R2000-14, R2000-15, R2000-03
**Success Criteria** (what must be TRUE):

  1. Symbols annotated in regenerator2000 are exported and consumed by DERIV-04's symbol store, so live addresses resolve to the names the user chose.
  2. Names discovered against the running machine flow back into the annotation store, closing the round trip rather than being a one-way dump.
  3. The install documentation names regenerator2000 as a prerequisite alongside VICE, states the toolchain cost honestly, and its Apache-2.0 notice is in `THIRD-PARTY-NOTICES.md`.

**Plans**: TBD

Notes:

- Criterion 1 closes a loop v0.2.0 leaves open: DERIV-04 consumes a symbol file but nothing in the project *produces* one. regenerator2000's `--export_lbl` emits **VICE label files** and `--import_lbl` reads them — native format on both sides, no glue format to invent.
- Criterion 3 is the honest half of decision D-R2. No prebuilt release assets exist upstream, so install means `cargo install regenerator2000` and a Rust toolchain. Say so plainly; do not bury it. Re-check for prebuilt binaries before writing the docs — the project is young and may have shipped them by then.
- **Depends on v0.2.0 Phase 5**, not just on Phase 11. If DERIV-04 shipped in a shape that does not match `--export_lbl`, Phase 9's criterion 1 will already have surfaced it.

## Progress

**Execution Order:** 9 → 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. Verified Batch Route | 0/TBD | Not started | - |
| 10. Container-Side MCP Server | 0/TBD | Not started | - |
| 11. Annotation Store and Enums | 0/TBD | Not started | - |
| 12. Symbol Round Trip, Install Story, and Playbooks | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.3.0 appended 2026-08-17 as a proposed milestone from `/gsd-explore` — not opened*
