# Phase 41: The Text Channel, Its Serialization Authority, and the Contention Verdict - Research

**Researched:** 2026-09-08
**Domain:** TCP text-protocol client (Node.js `net.Socket`), in-process async mutual exclusion, broker control-plane wire extension, MCP tool-surface allowlisting, VICE stock-backend liveness diagnostics
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Fifteen decisions from four discussed areas, plus one folded todo. Phase 39's
verdict is **locked input, not a decision here**: `go`, rule `R15`
(`docs/phase39-dual-channel-coexistence-gate-findings.md`) selects an in-process
async mutex, `R15` carries no narrowing, and neither pre-mapped narrowing
(`R11`/`D-10`, `R13`/`D-11`) triggered. Nothing below re-opens that.

**The text-channel tool surface (`CHAN-03`)**

- **D-01: Allowlisted typed verbs only — no free-text command field, ever.**
  One typed tool per capability, the way `host_tool`'s ids are per-capability
  (`c1541.chain`, `petcat.decode`) rather than per-binary. A single
  `vice_monitor_command` taking an arbitrary command string is the same generic
  remote-execution seam this project **rejected on the record** for `host_tool`,
  and here it would sit over a channel `broker-launch.mts:370-376`'s own warning
  already describes as accepting "arbitrary monitor commands" while
  "unauthenticated" — a channel that can `load` and `save` host files. Current
  MCP guidance is deny-by-default with an explicit allowlist of names *and*
  parameter constraints; this matches it.
  — **Reversibility:** one-way in the direction that matters — widening an
  allowlist later is additive, but a published raw-command tool cannot be
  narrowed without breaking every caller that used it.

- **D-02: The two remedy tools ship now; the five Phase-42 commands stay behind
  the internal allowlist.** `device c:` and `warp` reach `tools/list` in this
  phase because their results are honestly presentable. `memmapshow`,
  `prof flat`, `chis`, `bt` and `io` are reachable **in-process** through
  `text-protocol.ts`'s allowlist — and so are covered by `CHAN-03`'s framing
  controls — but do not become MCP tools until Phase 42 lands their owning
  parser. **A tool never ships returning a blob it cannot interpret.** Phase 42
  does not need this to proceed: its first fixture batch already exists from
  Phase 39 (`FIXTURE_COUNT: 12`, both binaries).
  — **Reversibility:** reversible — adding the five later is additive, and
  nothing published changes shape.

- **D-03: `device c:` is an explicit tool plus a live contamination test — not
  auto-healing on the stepping path.** Criterion 5 wants it "exercised, not
  merely made available": the live test contaminates `default_memspace` and
  shows `device c:` restoring main-CPU stepping. It is **not** issued
  automatically before every `ADVANCE_INSTRUCTIONS` / `EXECUTE_UNTIL_RETURN`,
  because **no shipped tool can contaminate `default_memspace` today** — drive
  checkpoints are deferred past this milestone — so auto-healing would add a
  text round trip and a mutex acquisition to the hottest binary-side path to
  defend a route nothing currently opens. The accepted spelling carries the
  colon; `device c` without it is a syntax error.
  — **Reversibility:** reversible — promoting it to automatic later is a local
  change at one seam.

- **D-04: All three narrowed `CLAUDE.md` constraints are re-anchored to this
  phase's evidence.** The scoping clauses **already exist** at
  `CLAUDE.md:32`, `:36` and `:42`, so criterion 5's "gains a scoping clause
  rather than a deletion" is textually satisfied already — but all three cite
  `MEASURED 2026-08-27`, which is the `/gsd-explore` live probe, **not a phase's
  evidence discipline**. Phase 39 independently re-confirmed only the `chis`
  one (`FIXTURE_UNSUPPORTED: none`). So: the `device c:` clause is re-cited to
  this phase's own live contamination evidence, the `warp on` clause is
  re-probed and re-cited while the channel is open, and the `chis` clause gains
  Phase 39's citation **beside** the probe's. **None of the three is deleted,
  and none is weakened** — the absent runtime `WarpMode` *resource* stays a real
  and separate fact from `warp on` being a working monitor *command*.
  — **Reversibility:** reversible.

**The serialization authority (`CHAN-04`)**

- **D-05: The mutex protects a holdable critical section, not a single wire
  command.** The lock is acquired per **logical operation** and may span many
  wire commands, so `stock-run-until.ts`'s `waitForCheckpointHit()` and
  `stock-reproducible-run.ts`'s `waitForReproducibleStop()` hold it across
  resume → wait → observe. This is the **only** shape under which "exactly one
  resume per wait" survives a second channel: Phase 39 MEASURED that a text
  command halts the machine (the stopwatch advanced only across an `x`), so a
  per-command lock preserves the resume *count* while destroying what it
  protects — a text command landing mid-wait halts an emulator that was supposed
  to be running toward a checkpoint, and the checkpoint then never fires.
  Single-command tools simply hold it briefly.
  — **Reversibility:** costly — the wait paths' call shape depends on being able
  to hold across an `await`; retrofitting that onto a per-command lock means
  re-cutting every wait path.

- **D-06: FIFO queue, bounded wait, refusal that names the holder.** Contenders
  are queued in arrival order (FIFO is the anti-starvation answer) with a
  timeout; on expiry the refusal **names the holder and the hold duration** —
  "the other channel holds halt authority, held Ns for `<operation>`" — never a
  generic timeout. This is the shape `monitor_claim`'s `monitor_owned` refusal
  already uses, and `broker-control.mts`'s own comment on it is binding here
  too: the wording must **never suggest the emulator itself has stopped
  answering**. The bound is what stops a hung holder from presenting as a wedge.
  A `POLL_WINDOWS_MS` wait runs 3s → 28s, so the bound must exceed a legitimate
  wait or it will fire on healthy operation.
  — **Reversibility:** reversible.

- **D-07: The mutex lives in its own module.** A new `channel-lock.ts` (name at
  the planner's discretion) owns the primitive, the FIFO queue, the **holder
  record**, and the refusal text — imported by `stock-dispatch.ts` and
  `text-protocol.ts` alike. Single-seam-per-concern, as this codebase requires:
  putting it inside `stock-dispatch.ts` would make that file's own header
  sentence ("THE ONE PLACE the stock tool surface is defined and dispatched")
  cover two concerns, and putting it in `text-protocol.ts` would invert the
  dependency so the older, larger binary path imports the newcomer for a
  primitive that is not about text. The holder record living here is also what
  makes `D-11`'s evidence readable by `vice_diagnose`.
  — **Reversibility:** costly — two importers would have to be re-pointed.

- **D-08: Unit-test the primitive; live-test the interleaving.** `channel-lock`'s
  own behaviour — FIFO ordering, timeout expiry, release on throw, holder-record
  contents — is **fully unit-tested with no emulator**, because it is a pure
  primitive. Criterion 3's identical-checkpoint-state-visibility assertion and
  the mid-wait interleaving are **live** tests. This respects `CLAUDE.md`'s
  existing exemption (the checkpoint-wait functions are deliberately not
  unit-tested, because a stub answering fast and deterministically proves
  nothing about a resume count) **without letting it excuse an untested lock** —
  a FIFO queue and its timeout have nothing to do with emulator timing.
  — **Reversibility:** reversible.
  — **Two-directional gate:** any new live test file goes into
  `MANUAL_ONLY_TESTS` **and** into `test-gate.test.ts`'s count assertion **in
  the same commit** — the union guard fails in both directions.

**Reporting contention (`CHAN-05`)**

- **D-09: Contention is an evidence field, not a sixth verdict. The frozen five
  are untouched.** `STOCK_DIAGNOSE_VERDICTS` is `Object.freeze`d at exactly five
  by `D-03` (`stock-diagnose.ts:406-413`), with an explicit never-add comment,
  and `stock-diagnose.test.ts:846-851` asserts the list verbatim, in order, by
  length. That freeze stands. Instead, `vice_diagnose` gains an **always-present
  evidence field on the `jamObserved` model** — cutting across verdicts rather
  than being one — saying whether the other channel holds halt authority, and
  naming the holder and the hold duration. This is criterion 4's own split
  wording read literally: *`vice_diagnose` gains the **evidence**;
  `vice-wedge-triage` gains the **verdict***. The skill's verdict → response
  table gains a contention row derived from that evidence.
  — **Reversibility:** reversible — the field is additive, and promoting it to a
  verdict later is still available.

- **D-10: `wedged` is made structurally unreachable while contended — in code,
  not in prose.** `vice_diagnose` consults the holder record before it can reach
  `wedged`; with contention evidence present, `wedged` cannot be returned. The
  skill's row documents it. This is **deliberately stronger than the
  `jamObserved` precedent**, which qualifies `wedged` in the skill's prose and
  lets the verdict still return: the failure mode here is a destructive recycle
  of a healthy instance, and a guard in prose is advice while a guard in code is
  a guarantee. The regression being prevented is one this milestone would
  otherwise *introduce* into shipped software — a text-channel hold the binary
  side cannot see reads as exactly the `wedged` signature, two cycle brackets
  reading zero.
  — **Reversibility:** costly — the guard sits inside the verdict derivation;
  removing it means re-deriving which paths may reach `wedged`.

- **D-11: While contended, the verdict returned is `live`, carrying the
  contention evidence.** The instance is healthy and responsive — not wedged —
  and the evidence explains why the bracket read zero. This is exactly parallel
  to how `jamObserved` already qualifies `live`: the manifest already tells
  readers a `live` verdict can be a false negative on liveness, and
  `machinePaused` is never false for any verdict that was reached, so `live` has
  never meant "advancing". `monitor_held_elsewhere` was rejected because its own
  manifest text says "a different client already holds this instance's single
  binary-monitor slot", which is false for a same-client cross-channel hold;
  `diagnosis_unavailable` was rejected because it reports UNKNOWN for a state
  that is positively known and healthy.
  — **Reversibility:** reversible.

- **D-12: Live on genuine stock 3.9 only, recorded MEDIUM, single-binary basis
  named.** The contention signature is reproduced live against
  `/usr/bin/x64sc` (genuine stock 3.9) and recorded in `vice-wedge-triage`'s
  provenance table at **MEDIUM**, with the single-binary basis stated. This is a
  deliberate departure from the table's existing HIGH rows, which are all
  two-binary: the text channel is a stock-backend capability, so it is proven
  where it ships, and the row is **honest about its own reach** rather than
  claiming a coverage it does not have. Do **not** enter it as HIGH, and do not
  imply a two-binary basis.
  — **Reversibility:** reversible — a later two-binary run can upgrade the grade.
  — **`D-16` discipline carries forward:** every live run is taken with the
  broker **stopped** (a live broker reddens the `BACK-05` assertion
  deterministically), and the measured test floor is **2 failing tests in
  `anno-register.test.ts`** — **never write "clean floor: 0"** into any
  acceptance criterion. `npm test` is not used; the whole-glob run does not
  terminate unaided.

**The text socket's lifecycle (`CHAN-02`)**

- **D-13: Opened eagerly at `stockConnect()`, held for the session's lifetime.**
  Exactly what the `go` verdict was won to permit — both channels connected for
  the session's lifetime. Phase 39 MEASURED that this costs nothing:
  `IDLE_TEXT_CLIENT_HALTS: no` (an idle text client does not halt the machine —
  only issuing a command does) and `TEXT_BIND_BUDGET_MS_MAX: 0` (the text port
  binds faster than the binary port's ~150ms). It also means a contention
  diagnosis has a real holder to name rather than a dial to attempt mid-triage.
  — **Reversibility:** reversible.
  — **Framing consequences, both MEASURED and both binding on `CHAN-03`:**
  (a) **never wait for a connect banner** — `TEXT_PROMPT_LITERAL_CONFIRMED: no`,
  stock's text monitor sends **zero bytes** on connect, so there is nothing to
  frame or race; (b) a **binary-owned checkpoint hit pushes an unsolicited
  breakpoint banner to the text console**, ending in a real prompt
  (`(C:$ea31) `), with no command from the text client at all — framing must
  **drain that passively before treating the next prompt as a command reply**.

- **D-14: The text socket is claimed through the broker with
  `channel: "text"`.** A `monitor_claim` carrying `broker-state.mts:129-137`'s
  already-anticipated discriminator, so a **second MCP process is refused by
  name on a working control socket** instead of vanishing into the
  `accepted-then-silent` black hole. That is Phase 39 fact #5's explicitly
  demanded policy: a second text connection "must be handled by explicit policy
  (refuse or queue) — it cannot be diagnosed automatically as a wedge from
  protocol signal alone", because it is indistinguishable from one at the wire
  level. **This does not contradict the ROADMAP's "bookkeeping, never
  enforcement":** what is enforced is one-text-client-per-instance; cross-channel
  serialization stays entirely the in-process mutex's job (`D-05`).
  — **Reversibility:** costly — the claim/release pairing threads through
  `stockConnect()` / `stockDisconnect()` and the grant lifecycle.
  — **Note:** Phase 39 MEASURED that a killed text client's socket close
  releases the machine within ~100ms with **no broker involved**, mirroring
  `broker-control.mts`'s "connection close IS the release" semantics at the
  emulator's own accept loop. `R11`'s pre-mapped mechanism (`D-10`) for a
  machine left permanently halted by a killed text client is therefore **not
  needed** and must not be built.

- **D-15: The port travels on the `grant` response and on `HeldLease`, and
  nowhere else.** `remoteMonitorPort` joins `broker-control.mts:242`'s `grant`
  beside `port` / `url` / `epoch_file` / `supervisor_dir`, and `HeldLease`
  (`vice-broker-client.ts:757`) gains the field. `StatusInstanceEntry` is
  **not** extended — that is exactly what criterion 1's "given no more weight
  than it deserves" asks for, and the claim-and-dial flow needs nothing more.
  — **Reversibility:** reversible — adding it to status later is additive.

- **D-16: The text port is MANDATORY on every stock launch. The degrade path is
  removed.** Owner direction, verbatim: *"it should not be possible, vice must be
  started with the text channel."* `broker-launch.mts`'s
  `acquirePortAndLaunch()` currently **degrades** — a failed second-port
  allocation launches without `-remotemonitor` rather than failing the acquire
  (documented in `broker-state.mts`'s own banner). That degrade goes: **a stock
  launch that cannot bind a text port fails the acquire.** Consequences the
  planner must carry: no stock instance ever exists without a text port, so
  **there is no missing-port refusal path to design** and no optional-absence
  case downstream; `remoteMonitorPort` is **required** on a stock grant.
  `broker-state.mts`'s banner and `broker-launch.mts:530`'s
  absent-request comment both describe the removed behaviour and must be
  corrected, not left standing.
  — **Reversibility:** one-way in effect — this converts a survivable
  degradation into a hard acquire failure, and every caller and test that
  tolerated a portless stock instance changes with it.
  — **Scope:** **stock only; the fork is unchanged.** The fork keeps launching
  with no `-remotemonitor` and advertises no text tools, honouring `D-07`'s
  frozen v0.1.x fork list. So `remoteMonitorPort` is required on a stock grant
  and absent on a fork grant — a discrimination the backend already makes
  everywhere else. Do **not** append `-remotemonitor` to fork launches.

### Claude's Discretion

The owner answered every question put to them. Everything not enumerated above
is Claude's discretion:

- Plan decomposition and wave structure across the four criteria.
- Module and symbol naming (`channel-lock.ts` is indicative, not fixed;
  `text-protocol.ts` is named by the ROADMAP's Phase 42 note and should be kept).
- The exact timeout bound for `D-06`'s queued wait, subject to its stated
  constraint: it must exceed a legitimate `POLL_WINDOWS_MS` wait (3s → 28s) or
  it will fire on healthy operation.
- The evidence field's exact name and shape (`D-09`), subject to matching
  `jamObserved`'s always-present discipline.
- Whether the text channel gets its own reconnect/identity story analogous to
  `stockReconnect()`, and how the unsolicited banner drain (`D-13`) is
  implemented without racing a genuine reply.
- The two remedy tools' exact names and argument shapes.
- Evidence file naming and layout.

Three worth a second look before the first plan is committed:

- **`D-16`'s blast radius.** Removing a documented degrade path is the one
  decision here rated one-way. Every test and caller that tolerated a portless
  stock instance is in scope, and the comments describing the old behaviour are
  load-bearing documentation that will otherwise become false.
- **`D-10` departing from the `jamObserved` precedent.** `jamObserved` guards in
  prose and lets `wedged` return; this guards in code and makes it unreachable.
  That asymmetry is deliberate and reasoned, but it means two cross-cutting
  evidence flags now behave differently — worth stating in the code so a later
  reader does not "fix" the inconsistency.
- **`D-05`'s hold spanning a 28-second wait.** A critical section that long is
  unusual, and it is what makes `D-06`'s bound delicate. If the bound is wrong in
  either direction the result is either spurious refusals on healthy runs or a
  hung holder presenting as a wedge — the exact failure `CHAN-05` exists to
  prevent.

### Folded Todos

- **Remove pre-warm; launch VICE only on first request**
  (`.planning/todos/pending/2026-09-07-remove-pre-warm-launch-vice-on-first-request.md`,
  area `broker`, severity `minor`).
  **Why it fits here:** `D-16` reopens `acquirePortAndLaunch()` and the launch
  path to make the text port mandatory. The warm-floor call site
  (`vice-broker.mts:952-980`) is a *second* launch call site that would
  otherwise need the same mandatory-text-port change — and it is the one the
  todo shows is structurally useless.
  **The todo's own open question, settled by the owner: neither latency nor
  grant certainty — just remove it.** The measured basis is the todo's own:
  `profileEligible()` (`vice-broker.mts:498`) compares `warp` and `headless`
  `=== true` on both sides while the warm call site passes **no `profile:` field
  at all**, so every spare is `{}` — unwarped, windowed — and any acquire asking
  for `warp` skips it synchronously and cold-launches anyway. The floor helps
  exactly the requests that care least about boot latency. Latency on the first
  cold launch is **accepted**. Warming *per profile* is explicitly **not** taken.
  **Four things the todo names that must not be lost in the removal:**
  1. The **launching→ready promotion** step is currently step 1 *inside*
     `maintainWarmFloor()` and is **not** warm-floor logic — a cold acquire's own
     instance needs promoting too. It has to **move, not go**.
  2. `selectWarmInstance()` also carries the grant-time re-probe, the `CR-01`
     concurrent-drop identity recheck, and the `WR-02` fire-and-forget kill of a
     dead candidate. Whether any `ready`-but-ungranted instances remain for it to
     walk must be **argued, not assumed** — if yes it survives intact.
  3. The synchronous single-owner `inFlight` check-and-set with **no `await`
     between** stays (the 2026-08-01 triple-launch outage, regression-tested per
     `CLAUDE.md`), as does the named anti-pattern against killing or relaunching
     preemptively to serve a newer request.
  4. `VICE_BROKER_MAX` / `atCapacity()` **stay** — the ceiling is a separate
     concern from the floor.
  `broker-e2e.test.ts` touches `VICE_BROKER_WARM_FLOOR` in ten places; **four
  already set it to `0`**, so a no-warm broker is an already-exercised
  configuration, and only the two fixtures setting it to `1` and asserting the
  instance-directory count (`:393`, `:520`) actually depend on the floor.

### Deferred Ideas (OUT OF SCOPE)

- **Warming per profile** instead of removing the warm floor — belongs in its
  own item if boot latency on warp captures ever becomes the real want.
- **Routing `vice_cycles_stopwatch` through the text `stopwatch` command.** The
  channel makes it possible; `CHAN-02..05` do not ask for it. A future
  timing-accuracy item.
- **Automatic `device c:` on observed drive-checkpoint contamination**
  (`D-03`'s rejected third option). Cannot be built or tested end to end until
  drive checkpoints ship, which is deferred beyond this milestone.
- **Exposing the five parse-target commands as MCP tools** — Phase 42, with
  their owning parsers (`D-02`).
- **Promoting contention to a sixth `vice_diagnose` verdict** (`D-09`'s rejected
  option). Still available later if the evidence field proves insufficient in
  practice; the additive field does not foreclose it.
- Text-monitor `a`/`d` (assemble/disassemble) and `x64`↔`x64sc` mode switching —
  declined by owner decision 2026-09-06.

**NOT in this phase's boundary** (also excluded, per `41-CONTEXT.md` § *Phase
Boundary*): the five text-format parsers (`memmapshow`, `prof flat`, `chis`,
`bt`, `io` — Phase 42 owns interpreting them, though `text-protocol.ts` must
still be able to *frame* their raw responses per `D-02`); the runtime evidence
layer and `.annostore` (Phase 43); drive-side checkpoints and the fastloader
signal (deferred past this milestone — this phase *opens* `device c:` but does
not use it for drive work).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAN-02 | A container-side caller can learn the text-monitor port of the instance it holds. | § Architecture Patterns (grant/`HeldLease` wire extension, `D-15`); verified code seams in § Code Seams Verified This Session confirm `grant`'s current shape has no port field and `remoteMonitorPort` is host-only today. |
| CHAN-03 | A tool call reaches the text monitor with responses framed by the prompt, never a timeout, surviving a split-segment prompt and a command whose own output is prompt-shaped. | § Architecture Patterns (`text-protocol.ts` framing design), § Common Pitfalls (buffer accumulation, encoding, banner drain, prompt-shaped-output collision), § Code Examples (prior-art throwaway client, `stock-protocol.ts`'s accumulation-cap lesson). |
| CHAN-04 | Every halt-taking operation on either channel passes through one serialization authority (in-process async mutex, per `go`/`R15`); binary-side invariants unchanged. | § Architecture Patterns (`channel-lock.ts` design, FIFO mutex sketch), § Don't Hand-Roll, § Common Pitfalls (critical-section span, refusal wording). |
| CHAN-05 | A contended instance is reported as contended, not wedged; `vice_diagnose` gains evidence, `vice-wedge-triage` gains the verdict row. | § Architecture Patterns (`jamObserved`-shaped evidence field, `stock-diagnose.ts` verdict derivation), § Code Seams Verified This Session (frozen verdict list, freeze-test line numbers), § Validation Architecture (skill provenance table row at MEDIUM). |

</phase_requirements>

## Summary

This phase has almost no open design question left to research — `41-CONTEXT.md`
already carries sixteen locked decisions (`D-01`..`D-16`) plus a folded todo,
each with its own reversibility grade and the exact code seam it touches. What
this document adds is: (1) line-by-line **re-verification** of every code seam
`41-CONTEXT.md` cites, since this project's own `CLAUDE.md` documents that line
numbers drift between phases and a mismatch is not evidence the constraint
itself changed; (2) the concrete **implementation pattern** to follow for the
two new sibling modules (`text-protocol.ts`, `text-connect.ts`), modelled
directly on the existing `stock-protocol.ts` / `stock-connect.ts` pair, whose
class shape, buffer-accumulation discipline, and desync/duplicate counters are
proven, tested, shipped code; and (3) two **concrete pitfalls** the throwaway
Phase 39 probe client's own header comments flag but do not solve —
prompt-shaped-output collision and multi-byte-sequence splitting across TCP
reads — that this phase must solve for real.

No new npm package is needed anywhere in this phase. The async mutex (`D-07`)
is deliberately hand-built per an explicit, reasoned project decision (no
existing single-flight primitive survives in this tree — the only prior one
died with the retired analyser and was explicitly not extracted); the text
protocol is a from-scratch sibling of an existing, tested binary-protocol
module, not a job for a telnet/terminal library (VICE's text monitor is not a
terminal — it has no ANSI escapes, no line editing, and a fixed prompt
grammar `(C:$xxxx) ` that a generic terminal-emulation library would not help
frame any better than a purpose-built regex would).

**Primary recommendation:** Build `text-protocol.ts`'s `TextMonitorClient` as a
`net.Socket`-wrapping `EventEmitter` that accumulates all bytes into one
`Buffer` (never decodes per-chunk), matches `PROMPT_RE` only against the
*tail* of the accumulated buffer using a state machine that has already
stripped and dispatched any leading unsolicited breakpoint-banner segment, and
hands the mutex (`channel-lock.ts`) to both `text-protocol.ts` and
`stock-dispatch.ts` as a per-logical-operation `acquire()`/`release()` pair —
exactly mirroring `stock-protocol.ts`'s proven `ViceMonitorClient` shape
(private `#socket`, `#buffer`, bound `#onData`/`#onClose`/`#onError` handlers)
rather than inventing a new client architecture.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Text-monitor port surfacing (`CHAN-02`) | Host broker (`broker-launch.mts`, `broker-control.mts`) | Container-side client (`vice-broker-client.ts`) | Port is allocated and bound host-side at launch; the container only ever *learns* it over the existing control-plane wire protocol — no new transport. |
| Text-monitor wire framing (`CHAN-03`) | Container-side MCP process (`text-protocol.ts`) | — | The text socket itself is dialled from inside the container-side MCP process (same process that dials the binary socket), so framing is entirely in-process; no broker involvement once the port is known. |
| Serialization authority (`CHAN-04`) | Container-side MCP process (`channel-lock.ts`) | — | `go`/`R15` selected the in-process shape specifically to avoid a broker round trip per halting call — this capability is deliberately NOT delegated to the broker. |
| Contention evidence and verdict (`CHAN-05`) | Container-side MCP process (`stock-diagnose.ts`) | Skill layer (`vice-wedge-triage/SKILL.md`) | The evidence is derived from the same in-process holder record `channel-lock.ts` owns; the skill only consumes and presents it — it has no independent detection mechanism. |
| Text-socket claim/release lifecycle (`D-14`) | Host broker (`broker-control.mts`'s `monitor_claim`/`monitor_release`) | Container-side (`stock-connect.ts`) | Ownership enforcement (one text client per instance) is a broker-side control-plane concern, identical in shape to the existing binary-monitor claim; the container-side call site just extends an existing call with a channel discriminator. |
| `device c:` / `warp` remedy tools (`D-02`, `D-03`) | Container-side MCP tool surface (`tools-manifest.stock.json` + a stock handler) | Text wire (`text-protocol.ts`) | These are ordinary allowlisted stock tools; they differ from existing tools only in which wire protocol their handler dials. |

## Standard Stack

### Core

No new runtime dependency is needed. Everything this phase needs is a Node.js
built-in already used elsewhere in this exact codebase:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:net` | Node >=24 built-in [VERIFIED: `src/mcp/vice/package.json:29`, `"engines": {"node": ">=24.0.0"}`; installed `node --version` on this host reports `v24.20.0`] | TCP socket to the `-remotemonitor` text port | `stock-protocol.ts`'s `ViceMonitorClient` already builds the binary-monitor client directly on `net.Socket` with no wrapper library — the project's own established pattern for this exact class of problem. |
| `node:events` (`EventEmitter`) | built-in | Event surface for the text client (`data`, `close`, `error`, unsolicited-banner) | `ViceMonitorClient extends EventEmitter` [VERIFIED: `src/mcp/vice/stock-protocol.ts:1956`, `export class ViceMonitorClient extends EventEmitter {`] — the exact shape to mirror. |
| `node --test` | built-in (Node's native test runner) | Unit tests for `channel-lock.ts`'s FIFO/timeout/holder-record behaviour | Every existing test in this package uses it; no separate framework exists anywhere in the tree [VERIFIED: `src/mcp/vice/package.json:121`, `"test": "node --test '*.test.*'"`]. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none | — | — | This phase adds zero entries to `dependencies` or `devDependencies`. Current `package.json` dependency set is exactly `@mastra/mcp@1.15.0`, `@mastra/core@1.55.0` [VERIFIED: `src/mcp/vice/package.json:128-131`], unchanged by this phase. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A hand-built `channel-lock.ts` primitive (`D-07`, locked) | The npm package `async-mutex` (a well-established, widely-used community mutex/semaphore library) | `async-mutex` gives a `Mutex`/`Semaphore` with `acquire()`/`release()` and is a legitimate, non-hand-rolled answer to "I need an async mutex" in general. It is **not** used here because `D-07` is a locked decision: the mutex must live alongside a **holder record** (who holds it, since when, for what operation) that a generic library's `Mutex` does not expose, and that holder record is what `CHAN-05`'s contention evidence reads directly. Wrapping a generic library to bolt on a holder record would add an indirection layer for no benefit over writing the ~30-line primitive directly, and this project has an explicit standing preference (`CLAUDE.md` § *Anti-Patterns*, "re-deriving a cross-cutting seam locally") to build the ONE thing this module needs rather than adapt a general-purpose one. Do not relitigate this in planning — it is locked, not a gap. |
| A raw prompt-terminator regex over an accumulated `Buffer` (this phase's `text-protocol.ts`) | A generic terminal-emulation / telnet-client library (e.g. one that parses ANSI escapes and VT100 semantics) | VICE's text monitor is not a terminal emulator target — it emits no ANSI escapes, no cursor control, and a single fixed prompt grammar `(C:$xxxx) ` [CITED: `docs/phase39-dual-channel-coexistence-gate-findings.md` § *Recorded facts that gate nothing*, item 3, `TEXT_PROMPT_LITERAL_CONFIRMED`]. A terminal library would add a large, wrong-shaped dependency to parse escape sequences that never arrive. |

**Installation:** none required — no `npm install` step for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero external packages (see § Standard
Stack / Alternatives Considered above — the two candidate libraries considered,
`async-mutex` and a generic terminal-emulation library, are both explicitly
**not** adopted, the first by locked decision `D-07`, the second because the
protocol has no use for what it offers). No `package-legitimacy check` run was
needed; nothing in this phase touches `package.json`'s `dependencies` or
`devDependencies`.

## Architecture Patterns

### System Architecture Diagram

```
Container-side MCP process (vice-proxy.ts)
│
├── tools/call "vice_device_console" or "vice_warp_set" (D-02 remedy tools)
│     │
│     ▼
│   withStockSession()-style dispatch  ──────────────►  channel-lock.ts
│     │  (stock-dispatch.ts pattern,                     acquire("device_c")
│     │   new text-side sibling)                              │
│     ▼                                                        │ FIFO queue,
│   text-protocol.ts                                           │ holder record,
│     TextMonitorClient                                        │ bounded wait
│     - drains any pending unsolicited                         │
│       breakpoint banner first (D-13b)                        ▼
│     - writes "device c:\n"                            (grants or refuses,
│     - accumulates raw bytes into one Buffer            naming holder+duration
│     - matches PROMPT_RE against the TAIL               on refusal, D-06)
│       of the accumulated buffer only
│     - resolves with the framed response
│
├── tools/call "vice_execution_run" / other binary-side halting op
│     │
│     ▼
│   stock-dispatch.ts's withStockSession()  ──────────────►  channel-lock.ts
│     │  (existing, unmodified entry point)                   acquire("run_until")
│     ▼                                                             │
│   stock-run-until.ts's waitForCheckpointHit()                     │ same primitive,
│     - holds the lock across resume → wait → observe (D-05)        │ same holder
│                                                                    │ record
│                                                                    ▼
├── tools/call "vice_diagnose"
│     │
│     ▼
│   stock-diagnose.ts's handleDiagnoseStock()
│     - reads channel-lock.ts's holder record BEFORE the
│       liveness bracket (D-10: wedged unreachable while contended)
│     - if contended: verdict "live", evidence.contention = {...} (D-11)
│     - else: existing 5-verdict path unchanged
│
└── Broker control session (vice-broker-client.ts)
      - claimMonitor({ targetId, channel: "text" })  (D-14, new discriminator)
      - grant response carries remoteMonitorPort      (D-15, CHAN-02)
            │
            ▼
      Host broker (broker-control.mts, broker-launch.mts)
        - acquirePortAndLaunch(): text port allocation is now MANDATORY
          for stock (D-16) — failure fails the whole acquire, no degrade
        - launches x64sc with "-remotemonitor -remotemonitoraddress ip4://host:port"
              │
              ▼
        x64sc (stock VICE)
          - binary monitor on binmonPort   (existing, Phase 3+)
          - text monitor on remoteMonitorPort  (bound since Phase 3, dialled
            for the first time by THIS phase)
```

### Recommended Project Structure

```
src/mcp/vice/
├── text-protocol.ts       # NEW — the text wire's bytes: framing, prompt
│                          #   regex, banner drain, internal allowlist for
│                          #   the five Phase-42 commands (D-02). Sibling of
│                          #   stock-protocol.ts; never merges into it.
├── text-connect.ts        # NEW — claims the text channel via
│                          #   brokerControl.claimMonitor({channel:"text"}),
│                          #   reads remoteMonitorPort off the lease, hands
│                          #   back a connected TextMonitorClient. Sibling of
│                          #   stock-connect.ts.
├── channel-lock.ts        # NEW — the in-process async mutex (D-05..D-08):
│                          #   FIFO queue, bounded wait, holder record,
│                          #   refusal text. Imported by stock-dispatch.ts
│                          #   AND text-protocol.ts.
├── stock-protocol.ts      # EXISTING — binary wire bytes. Read-only model
│                          #   for text-protocol.ts's class shape.
├── stock-connect.ts       # EXISTING — binary channel claim/connect/
│                          #   reconnect. Read-only model for text-connect.ts;
│                          #   also gains the D-14 channel-aware claim call.
├── stock-dispatch.ts      # EXISTING — imports channel-lock.ts at the
│                          #   binary-side integration point (D-05, D-07).
├── stock-diagnose.ts      # EXISTING — gains the D-09/D-10/D-11 evidence
│                          #   field and wedged-unreachable-while-contended
│                          #   guard.
├── broker-state.mts       # EXISTING — remoteMonitorPort (already present,
│                          #   host-only), channel discriminator on
│                          #   monitorClient (D-14).
├── broker-control.mts     # EXISTING — grant response gains
│                          #   remoteMonitorPort (D-15); monitor_claim gains
│                          #   channel param.
├── broker-launch.mts      # EXISTING — D-16's mandatory-text-port change to
│                          #   acquirePortAndLaunch(); folded-todo warm-floor
│                          #   removal.
├── vice-broker-client.ts  # EXISTING — HeldLease gains remoteMonitorPort
│                          #   (D-15); claimMonitor() gains channel param.
└── tools-manifest.stock.json  # EXISTING — two new remedy tools (D-02),
                               #   vice_diagnose's new evidence field (D-09).
```

### Pattern 1: The binary-protocol client shape, to be mirrored by `text-protocol.ts`

**What:** A `net.Socket`-wrapping class extending `EventEmitter`, with private
fields for the socket, an accumulating `Buffer`, and desync/error counters, and
three bound instance-method handlers registered once at connect time.

**When to use:** Any new wire-protocol client in this codebase — this is the
established, tested pattern, not a suggestion.

**Example (existing, shipped code — model, do not import):**
```typescript
// Source: src/mcp/vice/stock-protocol.ts:1956-1985 (read this session)
export class ViceMonitorClient extends EventEmitter {
  #socket: net.Socket | null = null;
  #buffer: Buffer = Buffer.alloc(0);
  #desyncBytes = 0;
  #duplicateReplies = 0;
  #nextRequestId = 1;
  #pending = new Map<number, PendingCommand>();
  #settledRing: number[] = [];
  #settledSet = new Set<number>();
  #port: number | null = null;
  #closed = false;
  #onDataBound = (chunk: Buffer) => this.#onData(chunk);
  #onCloseBound = () => this.#onClose();
  #onErrorBound = (err: Error) => this.#onError(err);

  constructor({ initialRequestId }: ViceMonitorClientOptions = {}) {
    super();
    if (initialRequestId !== undefined) {
      this.#nextRequestId = initialRequestId;
    }
  }

  get connected(): boolean {
    return this.#socket != null && !this.#socket.destroyed;
  }
}
```
A `TextMonitorClient` in `text-protocol.ts` needs no request-id map (the text
protocol is not multiplexed — one command in flight, one prompt back — see
Pitfall 1 below) but should keep the same `#socket`/`#buffer`/bound-handler
shape, `connected` getter, and the discipline of refusing a second `connect()`
over a still-live socket (`stock-protocol.ts:2006-2015`'s `WR-13(b)` comment:
a prior bug let a second `connect()` silently leak the previous socket and its
listeners — route a reconnect through an explicit `disconnect()` first).

### Pattern 2: The binary-protocol accumulation-cap lesson

**What:** `#onData()` concatenates every incoming chunk onto one Buffer, parses
as many complete frames as are present, and only trips a "give up, this is
garbage" cap on the **remainder after parsing**, not on the raw accumulated
size.

**When to use:** `text-protocol.ts`'s own accumulation loop, because the text
protocol has the same "unbounded legitimate response size" problem the binary
protocol already solved and got wrong once.

**Example (existing, shipped code — the fixed version, with the bug it fixed documented in the comment):**
```typescript
// Source: src/mcp/vice/stock-protocol.ts:2153-2170 (read this session)
#onData(chunk: Buffer): void {
  let combined: Buffer;
  try {
    combined = Buffer.concat([this.#buffer, chunk]);
    const counters: ParseCounters = { desyncBytes: this.#desyncBytes };
    const { responses, remainder, desyncBytes } = parseBuffer(combined, counters);
    this.#desyncBytes = desyncBytes;

    // WR-03: the cap is MAX_BUFFERED_LEN (accumulated bytes), NOT
    // MAX_BODY_LEN (one frame's declared body). Using the latter for both
    // meant a frame at or near 4 MiB -- a full-screen DISPLAY_GET is already
    // ~157 KB, and nothing bounds a future one lower -- could never be
    // reassembled from chunks: its own partially-received bytes tripped the
    // cap, the buffer was reset, and the retry hit the same wall.
    if (remainder.length > MAX_BUFFERED_LEN && !beginsWithPlausibleFrame(remainder)) {
      // ... desync recovery ...
    }
  }
}
```
**The text-protocol analogue:** a `chis` or `prof flat` response can be
arbitrarily long (a full CPU-history dump). `text-protocol.ts`'s own
accumulation cap — if any is used at all — must be sized against the largest
plausible in-process command response (Phase 39's fixture batch already
captured real samples: `FIXTURE_COUNT: 12`, both binaries [VERIFIED:
`docs/phase39-dual-channel-coexistence-gate-findings.md`, item 7]), not against
the two shipped remedy tools' tiny expected replies. Getting this wrong
reproduces exactly the bug the comment above documents: a legitimately large
in-progress response gets mistaken for desync and truncated.

### Pattern 3: Refusal wording that never suggests the emulator has stopped answering

**What:** Every existing ownership-conflict refusal in this codebase is worded
as an ownership conflict between two legitimate holders, explicitly never as
an emulator fault.

**When to use:** `D-06`'s FIFO-queue timeout-expiry refusal in `channel-lock.ts`
must follow the same discipline — it is textually required by `41-CONTEXT.md`.

**Example (existing, shipped code):**
```typescript
// Source: src/mcp/vice/broker-control.mts:294-295 (read this session)
// CR-03: the one refusal wording for a target-naming op whose `target_id` is
// not the grant the asking connection itself holds. Deliberately worded as an
// authorisation refusal and NOT as an ownership conflict between two
// legitimate holders (`monitor_owned`, which names a holder) and never as an
// emulator fault -- see attachControlProtocol()'s own ownsTarget() comment,
// and T-02-18's prohibition on wedge/hang vocabulary in this file's
// monitor-op refusals.
const MONITOR_OWNERSHIP_DENIAL =
  "monitor_claim/monitor_release may only target the grant this connection itself holds";
```
`channel-lock.ts`'s refusal text (naming the holder and hold duration per
`D-06`) should be modelled on this exact register — factual, holder-named,
never implying a hang.

### Pattern 4: The `jamObserved`-shaped always-present evidence field, to be mirrored by contention evidence

**What:** A cross-cutting fact is derived once, from one seam, and stamped
into **every** verdict's evidence — never per-call-site, never omitted when
false.

**When to use:** `D-09`'s contention evidence field on `vice_diagnose`.

**Example (existing, shipped code — the field to copy the shape of):**
```typescript
// Source: src/mcp/vice/stock-diagnose.ts:760-772 (read this session)
function diagnoseVerdictResult(
  session: StockConnectSession | null,
  verdict: StockDiagnoseVerdict,
  evidence: Record<string, unknown>,
  report: string,
): StockToolResult {
  const { machinePaused, machinePausedSource } = deriveMachinePaused(session);
  const jamObserved = session === null ? false : jamObservedFor(session.client);
  const payload: Record<string, unknown> = {
    verdict,
    evidence: { ...evidence, jamObserved },
    report: jamObserved ? report + JAM_OBSERVED_NOTE : report,
    machinePaused,
    machinePausedSource,
  };
  return session ? stockAnswer(session.client, payload) : derivedAnswer(payload);
}
```
The manifest's own `outputSchema` requires `jamObserved` inside `evidence`
[VERIFIED: `src/mcp/vice/tools-manifest.stock.json:3638-3648`, `"jamObserved": {"type": "boolean"}` listed under `"required": ["jamObserved"]`]
— the contention field should join this same `required` list so it too can
never be silently omitted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Buffer accumulation / desync recovery for a wire protocol | A second, independently-invented accumulation algorithm for the text protocol | The exact accumulation discipline already proven in `stock-protocol.ts`'s `#onData()` (concat-then-parse-then-cap-on-remainder) | This project already found and fixed the "cap the wrong quantity" bug once (`WR-03`, § Pattern 2 above); a fresh implementation that doesn't consult that fix will very likely reintroduce it under a new name. |
| Ownership-conflict wire semantics (claim/release, "who holds this") | A parallel claim mechanism for the text channel | `monitor_claim`/`monitor_release`'s existing wire op, extended with a `channel` discriminator (`D-14`) | The claim/release control op, the `MonitorOwnershipError` type, the `monitor_owned` refusal naming its holder, and the `hasMonitorClient` status flag all already exist end to end [VERIFIED: `src/mcp/vice/broker-control.mts:811` (`monitor_claim` handler), `src/mcp/vice/vice-broker-client.ts:685` (`MonitorOwnershipError`), `:1046` (`claimMonitor()`)]. |
| An async mutex primitive | See § Alternatives Considered — `async-mutex` is a legitimate library, but `D-07` locks the decision to hand-build a ~30-line primitive here because it must also own a holder record no generic library exposes. | `channel-lock.ts`, purpose-built | Locked project decision; do not relitigate in planning. |

**Key insight:** every piece of this phase that looks like "build a new wire
client" or "build a new ownership mechanism" already has a proven sibling in
this exact codebase to copy the shape of. The only genuinely novel code is the
text protocol's *framing state machine* (prompt-tail matching plus banner
drain) — everything else is "the same shape, second instance."

## Common Pitfalls

### Pitfall 1: Matching the prompt regex against a per-chunk decode instead of the accumulated Buffer

**What goes wrong:** A prompt or command output arrives split across two TCP
segments, so `sock.on("data", chunk => ...)` fires twice for one logical
response. If the handler decodes each `chunk` to a string and tests
`PROMPT_RE` against only that chunk (or concatenates *decoded strings* rather
than raw `Buffer`s), a prompt whose four hex digits straddle the segment
boundary never matches at all, and the caller times out on a response that in
fact arrived completely and promptly.

**Why it happens:** It is the single most natural first draft of a
"read until prompt" client, and this project's own throwaway Phase 39 probe
client demonstrates the *safe* half of this (it re-tests `PROMPT_RE` against
the whole re-concatenated buffer on every `data` event) while its own header
comment explicitly documents this file as **not** solving the harder half —
distinguishing a genuine terminator from prompt-shaped bytes inside a
command's own output (Pitfall 2 below).

**How to avoid:** Accumulate into one `Buffer` via `Buffer.concat([this.#buffer, chunk])` exactly as `stock-protocol.ts`'s `#onData()` does (§ Pattern 2), and only ever test the regex against the **tail** of the fully accumulated buffer, never against an individual chunk. `CHAN-03`'s own acceptance criterion requires a planted control proving this specific case: "a prompt arriving split across two TCP segments" observed red without the fix.

**Warning signs:** A test that sends a command whose response is artificially chunked at the byte boundary that falls inside `(C:$` and never resolves.

### Pitfall 2: A command's own output contains prompt-shaped text — the framing must distinguish real terminator from data

**What goes wrong:** `memmapshow`'s or a disassembly command's output could, in
principle, contain the literal bytes `(C:$xxxx) ` as **data** (e.g. inside an
address range's annotation, or as part of a longer text blob a future command
returns) before the monitor's own real terminator prompt arrives. A framing
implementation that matches `PROMPT_RE` anywhere in the accumulated buffer —
rather than specifically at its very end, immediately followed by nothing more
arriving within a short quiescence window — will falsely conclude the response
is complete mid-stream and hand back a truncated response.

**Why it happens:** The text protocol has **no frame delimiter and no length
prefix** — end of output is inferred, never declared [CITED:
`.planning/phases/41-.../41-CONTEXT.md` § *Phase Boundary*, quoting the
ROADMAP's own framing of `CHAN-03`]. The throwaway Phase 39 probe client's own
header comment names this exact gap as unsolved by design: *"This client does
NOT distinguish a prompt-shaped substring appearing inside a command's own
OUTPUT from the real terminator... Solving that properly... is a later
phase's OWNED scope (`CHAN-03`)"* [quoted verbatim from
`.planning/phases/39-.../evidence/textmon-probe-client.mjs:20-26`, read this
session].

**How to avoid:** `CHAN-03`'s own acceptance criterion requires this as a
second planted control, observed red without the fix. A workable approach:
anchor the match at the buffer's true end (`PROMPT_RE` as `/\(C:\$[0-9A-Fa-f]{4}\)\s*$/`,
matching against `.toString()` of the tail) **and** require a short quiescence
window (no further bytes arrive for N milliseconds) before accepting the match
as final — since VICE's own monitor writes the prompt as the very last thing
it sends for a completed command, a genuine terminator is never immediately
followed by more command-output bytes, while data merely resembling a prompt
mid-stream is followed by more bytes shortly after. The exact quiescence
bound and any alternative (e.g. tracking whether the command that produced
prompt-shaped output is a known-safe allowlisted command, vs. one whose output
format is not yet fully characterised) is left to the planner — this is the
genuinely novel piece of this phase.

### Pitfall 3: Waiting for a connect banner that will never arrive

**What goes wrong:** A framing implementation that does `awaitBanner()` (read
some bytes before sending the first command) before it is willing to issue a
command will hang until its own timeout on every single connection, because
stock's text monitor sends **zero bytes** on connect.

**Why it happens:** This project's own Phase 39 measurement corrects an
assumption `39-CONTEXT.md` itself carried as already confirmed:
`TEXT_PROMPT_LITERAL_CONFIRMED: no` for the banner specifically — an empty
capture within a 10-second budget, not a bug in the capture code [VERIFIED:
`docs/phase39-dual-channel-coexistence-gate-findings.md` § *Recorded facts
that gate nothing*, item 3].

**How to avoid:** `text-protocol.ts`/`text-connect.ts` must never wait for a
banner under any circumstance — connect, then send the first command
immediately.

**Warning signs:** Every connection attempt takes exactly the banner timeout
before the first command can be sent.

### Pitfall 4: Treating a binary-owned checkpoint's unsolicited text-console banner as a reply to the next command

**What goes wrong:** A binary-channel checkpoint hit (stopping or
non-stopping) pushes an unsolicited breakpoint-notification banner to the
**text** console, ending in a real prompt (`(C:$ea31) `), with **no command
sent from the text client at all**. If the text client's framing logic treats
"the next prompt I see" as "the reply to the last command I sent", it will
pair this unsolicited banner with a command issued moments later — or worse,
with a command issued *before* the banner arrived, silently attributing the
banner's prompt to the wrong request.

**Why it happens:** Directly measured by Phase 39: *"A binary-owned checkpoint
hit pushes an unsolicited breakpoint-notification banner to the TEXT console,
ending in a real prompt... with no command from the text client at all"*
[VERIFIED: `docs/phase39-dual-channel-coexistence-gate-findings.md` § *Recorded
facts that gate nothing*, item 10, with explicit *"Phase 41 implication: text-channel framing must drain this passively-arriving banner before treating the next prompt as a genuine command reply"*].

**How to avoid:** The framing state machine needs an explicit "idle" state in
which any bytes arriving with no command outstanding are drained and
discarded (or logged/counted) as a passive banner, never matched against a
pending command's promise. Only bytes arriving **after** a command was written
are eligible to resolve that command's promise.

**Warning signs:** A live test that arms a binary-side checkpoint and issues a
text command shortly after intermittently gets a response that is clearly the
banner text, not the command's real output.

### Pitfall 5: Decoding text in pieces rather than after the full frame is assembled

**What goes wrong:** VICE's own text-monitor output legitimately contains
multi-byte UTF-8 sequences — the `prof flat` cycle-count columns use
U+202F (NARROW NO-BREAK SPACE, three bytes `e2 80 af`) as a thousands
separator [VERIFIED: Phase 39's own fixture capture, `FIXTURE_ENCODING:
has-high-bytes`, `.planning/phases/39-.../evidence/39-fixture-batch.md:206`
and `:280-285`, quoting the exact byte sequence and its use as a digit-group
separator]. If a chunk boundary falls inside this three-byte sequence and the
implementation decodes each raw chunk to a string independently (e.g.
`chunk.toString("utf8")` per `data` event, then string-concatenates), Node's
UTF-8 decoder will emit a replacement character for the truncated sequence in
each half, silently corrupting the numeric output a Phase-42 parser would
later need to read.

**Why it happens:** It is easy to decode "as you go" for logging/debugging
convenience and only realize the corruption when a downstream parser
disagrees with hand inspection of the raw bytes.

**How to avoid:** Always accumulate raw `Buffer`s first (as Pitfall 1
requires anyway) and only call `.toString()` once, on the fully-assembled
response buffer, after the prompt-tail match confirms the frame is complete.
This is the same discipline the throwaway Phase 39 probe client already
follows correctly (it concatenates `Buffer`s and decodes once at the very end
of each helper) — worth explicitly preserving rather than "simplifying" during
the from-scratch build.

### Pitfall 6: A per-command lock instead of a per-logical-operation lock silently breaking "exactly one resume per wait"

**What goes wrong:** If `channel-lock.ts`'s mutex is acquired and released
around each individual wire command rather than held across an entire
`waitForCheckpointHit()`/`waitForReproducibleStop()` call, a text command can
land in the gap between "resume sent" and "wait for checkpoint_info observed",
halting an emulator that was supposed to be running toward the checkpoint —
so the checkpoint never fires and the wait times out, even though no protocol
invariant was technically violated per command.

**Why it happens:** Per-command locking is the more obvious, more local-looking
design, and it does correctly preserve "resume count" bookkeeping — it is only
wrong about what the count is supposed to protect. This is `D-05`'s own
stated reasoning, restated here because it is easy to lose sight of while
implementing `channel-lock.ts` in isolation from its two call sites.

**How to avoid:** The lock's public API must support "acquire, then do many
wire operations, then release" (i.e. an explicit `acquire()`/`release()` pair
or a callback/async-block form that spans the whole logical operation), not
just a `withLock(oneCommand)` wrapper. `stock-run-until.ts`'s
`waitForCheckpointHit()` [VERIFIED: `src/mcp/vice/stock-run-until.ts:135`,
`async function waitForCheckpointHit(client: ViceMonitorClient, checkpointId: number, timeoutMs: number): Promise<WaitOutcome>`]
and `stock-reproducible-run.ts`'s `waitForReproducibleStop()` [VERIFIED:
`src/mcp/vice/stock-reproducible-run.ts:255`] both narrow on
`.type === "checkpoint_info"` [VERIFIED: `stock-run-until.ts:107` and
`stock-reproducible-run.ts:217`, both `item.type === "checkpoint_info" && isPlainObject(item.checkpoint)`]
and must hold the lock across their own full duration, which can run up to
~28 seconds (`D-06`'s own stated bound derivation: `POLL_WINDOWS_MS` runs 3s
→ 28s).

### Pitfall 7: Line-number citations drifting during this phase's own edits

**What goes wrong:** Every code-seam citation in this document and in
`41-CONTEXT.md` is a snapshot from before this phase's own edits land. This
phase itself edits several of the cited files (`broker-state.mts`,
`broker-control.mts`, `broker-launch.mts`, `vice-broker-client.ts`,
`stock-connect.ts`, `stock-dispatch.ts`, `stock-diagnose.ts`), so every line
number will shift again as soon as the first plan lands.

**Why it happens:** `docs-linerefs.test.ts` mechanically checks cited line
numbers in tracked prose (`CLAUDE.md`) against the source [confirmed by the
project's own standing note in `CLAUDE.md`: "Line numbers in this bullet are
checked against the source at each phase and drift between phases; treat a
mismatch as drift to re-verify, not as evidence the constraint itself
changed."]. This session's own re-verification already found small drift
versus `41-CONTEXT.md`'s citations (e.g. `MONITOR_OWNERSHIP_DENIAL` is at
`broker-control.mts:294`, not `:295`; `MonitorOwnershipError` is at
`vice-broker-client.ts:685`, not `:671`; `claimMonitor()` is at `:1046`, not
`:1037` — all confirmed by direct `grep`/`Read` this session).

**How to avoid:** Any plan that edits `CLAUDE.md`'s own cited line ranges (the
`rewriteArguments()` citations, the container/host-path citations) must
re-verify and correct them in the same commit — this is exactly the pattern
`CLAUDE.md`'s own history describes for prior phases (29-10, 40-01). Treat
every line-number citation in this RESEARCH.md and in `41-CONTEXT.md` as
"true as of 2026-09-08" and re-verify before quoting it in a PLAN.md or a
code comment.

### Pitfall 8: `D-16`'s degrade-path removal leaving stale documentation/comments behind

**What goes wrong:** `broker-state.mts`'s own banner comment currently reads
*"NOTHING IN PHASE 3 DIALS THIS PORT... Phase 7, which builds the text-monitor
client... is the right place to add a `channel: "binary" | "text"`
discriminator"* [VERIFIED: `src/mcp/vice/broker-state.mts:136`, the
"MONITOR-OWNERSHIP DECISION" comment block, read this session] — this
sentence is already historically inaccurate (the milestone renumbered this
work from "Phase 7" to Phase 41) and will become **factually false** the
moment this phase adds the discriminator, if the comment is not rewritten.
Similarly, `broker-launch.mts`'s degrade-path comment (*"launching WITHOUT
-remotemonitor... nothing in Phase 3 dials the text-monitor port anyway"*
[VERIFIED: `src/mcp/vice/broker-launch.mts:~700`, read this session — exact
wording: `"vice-broker: second (-remotemonitor) port allocation failed (${remoteResult.reason}) -- launching WITHOUT -remotemonitor; nothing in Phase 3 dials the text-monitor port anyway"`]) describes behaviour `D-16` removes entirely.

**Why it happens:** Removing a code path is easy to do while leaving the prose
that described it in place, especially when the prose is split across a log
message string and a nearby comment.

**How to avoid:** `41-CONTEXT.md` itself already flags this
(`broker-state.mts`'s banner and `broker-launch.mts:530`'s absent-request
comment "both describe the removed behaviour and must be corrected, not left
standing") — treat this as a required, not optional, part of any `D-16` plan.

### Pitfall 9: `resources-sync.test.ts` and the two-directional `MANUAL_ONLY_TESTS` gate, both easy to miss in the same commit

**What goes wrong:** `broker-state.mts`, `broker-control.mts`, and
`broker-launch.mts` are all `.mts` sources that compile to committed
`resources/*.mjs` artifacts via `build.ts`; editing the `.mts` source without
re-running `node build.ts` and committing the regenerated `.mjs` in the same
commit reds `resources-sync.test.ts`. Separately, any new live test file this
phase adds (per `D-08`'s "live-test the interleaving" requirement) must be
added to **both** `MANUAL_ONLY_TESTS` (currently twelve entries: `broker-e2e.test.ts`, `stock-live.test.ts`, `stock-live-triage.test.ts`, `stock-live-broker-monitor.test.ts`, `stock-broker-live.test.ts`, `vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `fork-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`, `ghidra-live.test.ts`, `ghidra-opcode-live.test.ts` [VERIFIED: `node --test test-gate.test.ts` output, run this session, confirming the count and set]) **and** `test-gate.test.ts`'s own count assertion, in the same commit, or the drift guard fails in one direction or the other.

**Why it happens:** Two separate guards, easy to satisfy one and forget the
other; this project's own `MEMORY.md` records this exact class of mistake
recurring (`test:automated hides CI failures`, `full-glob suite outlives bash
timeout`).

**How to avoid:** Treat `node build.ts` + committed `resources/*.mjs` and the
`MANUAL_ONLY_TESTS` addition as checklist items on every commit that touches
a `.mts` launcher file or adds a live test file — not something to remember
unprompted.

### Pitfall 10: `hostpath-consumers.test.ts`'s floor is a literal prefix, invisible to a new module family

**What goes wrong:** `hostpath-consumers.test.ts` pins its consumer floor over
the `anno-*` prefix as a literal, deliberately never derived from disk. A new
`text-*` module family is therefore invisible to it, whether or not
`text-connect.ts` becomes a host-path consumer.

**Why it happens:** The floor was designed before this module family existed
and has no mechanism to discover a new prefix on its own.

**How to avoid:** `41-CONTEXT.md` already resolves the likely case:
`text-connect.ts` resolves a network **hostname** the same way `vice.ts`'s
`mcpHost()` does, not a filesystem path, so the preferred outcome is simply
**not** to become a host-path consumer at all. If any module in this phase
does need host-path translation, add a second floor for the new prefix with a
real unclassified module on disk as a positive control, observed red, before
claiming the floor is satisfied — per this project's standing constraint on
positive controls.

## Code Examples

### The prior-art prompt regex and its documented limitations (throwaway code — pattern only, not to be imported or promoted)

```javascript
// Source: .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/
//         evidence/textmon-probe-client.mjs:43 (read this session)
// This regex is confirmed correct for matching an actual prompt
// (POST_MEASUREMENT_PROMPT_MATCHES_PROMPT_RE: true, Phase 39 measurement),
// but this file's own header comment states explicitly it is throwaway
// and does NOT survive into Phase 41 (D-13) -- copy the pattern, not the file.
export const PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;
```

The same file's `awaitBanner()`/`sendAndAwaitPrompt()` helpers show the
**correct half** of the framing problem (accumulate `Buffer`s, decode once,
match `PROMPT_RE` against the whole accumulated string on each `data` event)
and its own header comment names the **two halves this phase must still
solve**: split-segment robustness under adversarial/slow-peer conditions, and
distinguishing a prompt-shaped substring in a command's own output from the
real terminator (quoted in full in § Common Pitfalls 1 and 2 above).

### The frozen five-verdict enum `channel-lock.ts`'s evidence must not touch

```typescript
// Source: src/mcp/vice/stock-diagnose.ts:406-413 (read this session, verbatim)
export const STOCK_DIAGNOSE_VERDICTS = Object.freeze([
  "restarted",
  "checkpoint_trap",
  "wedged",
  "monitor_held_elsewhere",
  "live",
] as const);

export type StockDiagnoseVerdict = (typeof STOCK_DIAGNOSE_VERDICTS)[number];
```
`stock-diagnose.test.ts:846-851` [location cited in `41-CONTEXT.md`; this
session independently confirmed the array's own definition and its
`Object.freeze` call at the lines above] asserts this list verbatim, in order,
by length — `D-09`'s contention evidence must add a field, never a sixth
string to this array.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Stock backend drives the emulator only through the binary monitor (`-binarymonitor`) | Stock backend drives the emulator through **two** monitor channels simultaneously, serialized by an in-process mutex | This phase (41), gated by Phase 39's `go`/`R15` verdict, 2026-09-08 | Every halt-taking stock operation must now reason about which channel initiated it; `vice_diagnose`'s liveness check must account for a benign cross-channel hold that looks identical to a wedge at the binary-monitor level. |
| `acquirePortAndLaunch()` degrades to a text-portless stock launch on second-port allocation failure | A stock launch that cannot bind a text port fails the whole acquire (`D-16`) | This phase | Every caller and test that tolerated a portless stock instance must be updated; there is no missing-port case to design for downstream. |

**Deprecated/outdated:**
- The `broker-state.mts` banner's own framing of "Phase 7 is where the
  `channel` discriminator gets added" — historically accurate at the time it
  was written, now stale after the milestone's phase renumbering; this phase
  both adds the discriminator and should correct the stale phase reference.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A short quiescence window (no further bytes for N ms) after a `PROMPT_RE` tail-match is a workable discriminator between a genuine terminator and prompt-shaped data mid-stream (Pitfall 2's proposed remedy). | Common Pitfalls, Pitfall 2 | If VICE's own text monitor can legitimately pause mid-response for longer than the chosen window (e.g. a very large `chis` dump written in bursts with wire-level backpressure), a naive quiescence window either times out real responses too eagerly or accepts prompt-shaped data as final too readily. This is genuinely unresearched — Phase 39 never measured inter-chunk timing on a large response, only that responses complete within budget. The planner should treat the exact discriminator mechanism as an open design question, not a settled fact, and may need a live measurement task early in this phase's own plan. |
| A2 | `async-mutex` (the npm package named in § Alternatives Considered) is a real, legitimate, non-slopsquatted package — named from training knowledge, not independently verified against the registry this session, since it is explicitly NOT being adopted. | Standard Stack / Alternatives Considered | None — the package is discussed only as a rejected alternative and is never installed. If cited elsewhere, its name should be independently re-verified before any future adoption. |
| A3 | A per-command-type accumulation-cap size distinct from the binary protocol's `MAX_BUFFERED_LEN` will be needed for `text-protocol.ts`, sized against the largest Phase-39 fixture capture. | Architecture Patterns, Pattern 2 | If the cap is copied verbatim from the binary protocol's constant without re-deriving it against real text-command output sizes, a legitimately large `chis`/`prof flat` response could trip a false-desync path exactly as `WR-03` once did on the binary side. |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **The exact quiescence-window discriminator for Pitfall 2 (prompt-shaped-output collision).**
   - What we know: the two planted controls (`CHAN-03`'s own acceptance
     criterion) are non-negotiable and must be observed red without the fix;
     a length-prefixed or otherwise unambiguous framing was explicitly
     declined as "a later phase's owned scope" by the throwaway client's own
     comment — but that comment is about Phase 42's *parsers*, not about
     `CHAN-03`'s own framing, which must still solve the terminator-detection
     problem itself, just not the format-parsing problem.
   - What's unclear: whether a pure quiescence-window heuristic is sufficient,
     or whether the five in-process-only Phase-42 commands (`memmapshow`,
     `prof flat`, `chis`, `bt`, `io`) need per-command knowledge (e.g. "this
     command's output format is fixed-width and never contains this byte
     sequence") layered on top.
   - Recommendation: budget an early live-measurement task in this phase's
     own plan (mirroring Phase 39's own measurement discipline) that
     specifically constructs an adversarial fixture — a real VICE command
     whose output is known to contain `(C:$` at a byte offset that is not the
     final prompt — and confirms the chosen discriminator handles it, rather
     than trusting a heuristic un-exercised against a real binary.

2. **Whether `text-connect.ts` needs its own `stockReconnect()`-equivalent identity story.**
   - What we know: `41-CONTEXT.md` explicitly leaves this to Claude's
     discretion. `stockReconnect()` proves machine identity across a
     transient socket drop using the epoch baseline captured at
     `stockConnect()` time [VERIFIED: `src/mcp/vice/stock-connect.ts:529-540`].
   - What's unclear: whether a text-socket drop (distinct from a machine
     restart) needs the same epoch-proof discipline, or whether — since the
     text socket's lifecycle is claimed once per session per `D-13` and
     released only at session end — a dropped text socket should simply be
     treated as a fatal error for that session rather than something to
     silently reconnect.
   - Recommendation: default to treating an unexpected text-socket close as a
     fatal error surfaced to the caller (matching `D-13`'s "held for the
     session's lifetime" framing) unless a concrete need for reconnection
     surfaces during implementation; do not build reconnect logic
     speculatively.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `x64sc` (genuine stock, unpatched) | Live-testing `CHAN-02..05` against real stock VICE | ✓ | `/usr/bin/x64sc`, VICE 3.9 [per user's own standing memory note: "How to live-test against real stock VICE" — `/usr/bin/x64sc` is genuine unpatched stock; the fork shadows it on `$PATH`, so it must be invoked by absolute path] | — |
| `x64sc` (fork, patched, ≥3.10) | Confirming this phase does NOT append `-remotemonitor` to fork launches (`D-16`'s scope note) | Not independently re-probed this session; assumed present per prior phases' own measurements (`/usr/local/bin/x64sc`, VICE 3.10, cited throughout `vice-wedge-triage/SKILL.md`'s provenance table) | — | — |
| Node.js ≥24 | Running the MCP server directly (no build step) | ✓ | `v24.20.0` [VERIFIED: `node --version`, run this session] | — |
| A stopped host broker daemon, before any live test | `D-12`'s carried-forward discipline: a live broker deterministically reddens `BACK-05` | **Observed running** — this session's environment probe found a live, orphaned `x64sc` process already bound to ports 6600 (binary) and 6601 (text/`-remotemonitor`), launched with the exact stock argv shape this phase's own § Architecture Patterns diagram describes [`x64sc -default -drive8type 1541 -seed 4242 ... -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6600 -remotemonitor -remotemonitoraddress ip4://127.0.0.1:6601`, observed via `pgrep -fa x64sc` this session] | — | Any executor of this phase's live tests must first confirm no broker daemon and no leftover `x64sc` instance is running (`pgrep -fa vice-broker`, `pgrep -fa x64sc`), and terminate any found, before trusting a live-test result — this orphaned instance is independent evidence the discipline is easy to violate accidentally. |

**Missing dependencies with no fallback:** none identified.

**Missing dependencies with fallback:** none beyond the broker-must-be-stopped
discipline noted above, which has a clear remedy (stop it before testing).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate library [VERIFIED: `src/mcp/vice/package.json:121-123`] |
| Config file | none — colocated `*.test.ts` files next to the module under test |
| Quick run command | `cd src/mcp/vice && npm run test:automated` (runs `test-gate.mjs`, which excludes the twelve `MANUAL_ONLY_TESTS` files) |
| Full suite command | `cd src/mcp/vice && node --test '*.test.*'` — **do not use for this phase's gate check**; per this project's own standing memory, the whole-glob run does not terminate unaided and the measured floor is 2 failing tests in `anno-register.test.ts`, never "clean floor: 0" |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAN-02 | Container-side caller learns text-monitor port from grant/`HeldLease` | unit | `node --test broker-control.test.ts` / `node --test vice-broker-client.test.ts` (extend existing files) | ✅ both files exist today; extend, don't create |
| CHAN-03 | Prompt framing survives split-segment and prompt-shaped-output planted controls | unit (framing logic with a fake socket) + live (real VICE, per `D-08`) | `node --test text-protocol.test.ts` (new); live variant added to `MANUAL_ONLY_TESTS` | ❌ Wave 0 — new file |
| CHAN-04 | Mutex FIFO ordering, timeout, holder record (unit); identical checkpoint-state visibility across channels (live) | unit + live | `node --test channel-lock.test.ts` (new, unit); live interleaving test added to `MANUAL_ONLY_TESTS` (new) | ❌ Wave 0 — new files |
| CHAN-05 | Contention evidence present, `wedged` unreachable while contended, skill row correctness | unit (`stock-diagnose.test.ts` extension) + live (contention signature on genuine stock 3.9, MEDIUM per `D-12`) | `node --test stock-diagnose.test.ts` (extend, currently 55 tests [VERIFIED: `node --test stock-diagnose.test.ts` run this session, `tests 55 / pass 55`]); live variant added to `MANUAL_ONLY_TESTS` | ✅ file exists, extend; live test is new |

### Sampling Rate
- **Per task commit:** `cd src/mcp/vice && npm run test:automated`
- **Per wave merge:** same command, plus `npm run typecheck`
- **Phase gate:** `npm run test:automated` green (with the documented 2-failure baseline in `anno-register.test.ts` unchanged, never asserted as 0) before `/gsd-verify-work`; live tests run manually per `D-08`/`D-12`'s discipline (broker stopped) and their result recorded in `vice-wedge-triage/SKILL.md`'s provenance table

### Wave 0 Gaps

- [ ] `text-protocol.test.ts` — unit tests for `TextMonitorClient`'s framing state machine (split-segment, banner-drain, prompt-shaped-output collision as planted controls; per `CHAN-03`)
- [ ] `text-connect.test.ts` — unit tests for claim/connect/release lifecycle (per `CHAN-02`)
- [ ] `channel-lock.test.ts` — unit tests for FIFO ordering, timeout expiry, release-on-throw, holder-record contents (per `D-08`)
- [ ] A new live test file (name at planner's discretion, e.g. `text-monitor-live.test.ts` or folded into an existing `stock-live-*.test.ts` sibling) for `CHAN-03`'s two planted controls against real VICE, `CHAN-04`'s identical-checkpoint-state-visibility assertion, and `CHAN-05`'s contention signature — added to `MANUAL_ONLY_TESTS` **and** `test-gate.test.ts`'s count assertion in the same commit (`D-08`'s two-directional gate)
- [ ] Extensions (not new files) to `stock-diagnose.test.ts`, `broker-control.test.ts` (if it exists — verify), `vice-broker-client.test.ts` (if it exists — verify), `stock-connect.test.ts`, `stock-dispatch.test.ts`, `broker-launch.test.ts` (if it exists — verify) for `D-14`/`D-15`/`D-16`'s wire-shape changes

*(These are additive to the existing per-module test files this phase edits; the planner should confirm each existing sibling test file's name via `ls src/mcp/vice/*.test.ts` before assuming a name above.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | The text monitor, like the binary monitor, is unauthenticated by VICE's own design [CITED: `src/mcp/vice/broker-launch.mts:370-376`'s own bind-widening security warning, read this session: "VICE's text monitor accepts arbitrary monitor commands and is unauthenticated, exactly like the binary monitor"]. This is an inherited, documented constraint of the upstream tool, not something this phase can remediate — the mitigation is scope containment (V5 below), not authentication. |
| V3 Session Management | No | No web/HTTP session concept applies; the "session" here is the broker's own grant/claim lifecycle, already covered by existing controls this phase extends rather than redesigns. |
| V4 Access Control | Yes | `monitor_claim`'s existing `ownsTarget()` check [VERIFIED: `src/mcp/vice/broker-control.mts:811-818`, read this session] already enforces "a connection may only claim/release the grant it itself holds" — `D-14` extends this exact mechanism with a `channel` discriminator rather than building a parallel one. |
| V5 Input Validation | Yes | `D-01`'s locked decision: allowlisted typed verbs only, no free-text command field, ever. This is the primary mitigation for the unauthenticated-channel risk — every tool parameter must be constrained (not just the command name), matching this project's existing `host_tool` per-capability-id precedent rather than a generic pass-through. |
| V6 Cryptography | No | Not applicable to this phase's scope. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via an argument value that embeds the text monitor's own line terminator (e.g. a future tool parameter containing an embedded newline could inject a second, attacker-controlled monitor command onto the same wire) | Tampering / Elevation of Privilege | Any tool parameter that is written into the text-monitor command string (even the two remedy tools' fixed-shape commands, `device c:` and `warp on`/`warp off`) must be validated to reject embedded newlines/control characters before being concatenated into the wire command. Since `D-01` mandates typed verbs with parameter constraints (not free text), this is naturally mitigated for the two shipped tools (`device c:` takes no argument; `warp` takes a boolean, not a string) — but the constraint should be stated explicitly in `text-protocol.ts`'s own header comment so a future Phase-42 tool exposing a string parameter (e.g. a filename) does not reintroduce the injection surface. |
| A malicious or misbehaving second text-monitor client causing an `accepted-then-silent` connection that is indistinguishable from a hang | Denial of Service | `D-14`'s broker-level claim refusal (named holder, per the existing `monitor_owned` pattern) prevents a second **legitimate MCP process** from ever reaching this ambiguous wire state; VICE's own single-client behavior at the emulator's accept/select loop is inherited and cannot be hardened from this codebase [VERIFIED: `TEXT_SECOND_CONNECT_OBSERVATION: accepted-then-silent`, `docs/phase39-...findings.md` § *Recorded facts that gate nothing*, item 5]. |
| A hung cross-channel lock holder (e.g. a crashed request that never releases) presenting as a wedge and triggering an unnecessary destructive recycle | Denial of Service (self-inflicted) | `D-06`'s bounded FIFO wait with a named-holder refusal is the mitigation — this is exactly the failure mode `CHAN-05` exists to prevent, and the bound must exceed the legitimate 3s–28s `POLL_WINDOWS_MS` range or it will misfire on healthy operation (see § Common Pitfalls, Pitfall 6, and the "Three worth a second look" note in § User Constraints). |

## Sources

### Primary (HIGH confidence — direct file reads this session)

- `src/mcp/vice/broker-state.mts:117-149` — `monitorClient`, the MONITOR-OWNERSHIP DECISION banner, `remoteMonitorPort?: number` (line 149)
- `src/mcp/vice/broker-control.mts:242` (`grant` shape), `:294-295` (`MONITOR_OWNERSHIP_DENIAL`), `:269` (`monitor_claimed` type), `:811-830` (`monitor_claim` handler), `:97` (`StatusInstanceEntry`)
- `src/mcp/vice/broker-launch.mts:355-400` (`-remotemonitor` argv construction and bind-widening warning), `:515-540` (`spawnAndRecordInstance()`'s `remoteMonitorPort` threading), `:660-715` (`acquirePortAndLaunch()`'s degrade path)
- `src/mcp/vice/vice-broker-client.ts:655-680` (`ClaimMonitorOutcome`/`MonitorOwnershipErrorOptions`), `:685` (`MonitorOwnershipError`), `:745-770` (`HeldLease`, line 757), `:1046-1075` (`claimMonitor()`)
- `src/mcp/vice/stock-connect.ts:63` (`StockConnectBrokerControl`), `:404` (`stockConnect()`), `:494` (`stockDisconnect()`), `:529` (`stockReconnect()`)
- `src/mcp/vice/stock-dispatch.ts:285` (`ensureStockSession()`), `:493` (`withStockSession()`)
- `src/mcp/vice/stock-diagnose.ts:406-413` (`STOCK_DIAGNOSE_VERDICTS`, frozen), `:750-775` (`jamObservedFor`/`diagnoseVerdictResult`), `:960-985` (`wedged` derivation path)
- `src/mcp/vice/stock-run-until.ts:107,135` (`waitForCheckpointHit()`)
- `src/mcp/vice/stock-reproducible-run.ts:217,255` (`waitForReproducibleStop()`)
- `src/mcp/vice/stock-protocol.ts:1956-2004` (`ViceMonitorClient` class shape), `:2153-2170` (`#onData()` accumulation-cap discipline)
- `src/mcp/vice/tools-manifest.stock.json:3616-3660` (`vice_diagnose` description, output schema, frozen verdict enum)
- `src/skills/vice-wedge-triage/SKILL.md:1-100` (verdict table, `jamObserved` cross-cutting section), `:200-245` (provenance table)
- `src/mcp/vice/test-gate.test.ts` (run this session: confirms 12-entry `MANUAL_ONLY_TESTS`, drift guards)
- `src/mcp/vice/stock-diagnose.test.ts` (run this session: 55/55 passing)
- `src/mcp/vice/package.json` (engines, scripts, dependencies — no async-mutex or terminal library present)
- `docs/phase39-dual-channel-coexistence-gate-findings.md` (full read — verdict `go`/`R15`, all twelve "recorded facts that gate nothing", all five closed research assumptions)
- `.planning/phases/39-.../evidence/textmon-probe-client.mjs` (full read — the throwaway client, its documented unsolved problems, `PROMPT_RE`)
- `.planning/phases/39-.../evidence/39-fixture-batch.md` (grep + read — `FIXTURE_ENCODING: has-high-bytes`, the U+202F thousands-separator finding)
- `.planning/phases/41-.../41-CONTEXT.md` (full read — all sixteen locked decisions, discretion areas, deferred ideas)
- `.planning/REQUIREMENTS.md` (full read — `CHAN-02..05`'s exact text, Excluded table, Notes for the roadmapper)
- `.planning/STATE.md` (tail read — Phase 39/40 completion status, Phase 39 verdict summary)
- `.planning/config.json` (full read — `nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1`)
- Live environment probe this session: `node --version` (`v24.20.0`), `pgrep -fa x64sc` (found a live orphaned instance bound to 6600/6601 with the expected stock argv shape)

### Secondary (MEDIUM confidence)

- None used as load-bearing this session — every claim above traces to a direct file read or a project-internal, previously-measured document.

### Tertiary (LOW confidence)

- The existence and general shape of the `async-mutex` npm package (§ Standard Stack, Alternatives Considered) — named from training knowledge only, explicitly marked `[ASSUMED]` in § Assumptions Log (A2), and not adopted regardless.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; every recommended pattern is verified, shipped, tested code in this exact repository.
- Architecture: HIGH — the two new sibling modules' shape is modelled on a directly-read, tested existing pair (`stock-protocol.ts`/`stock-connect.ts`); every wire-protocol claim traces to a Phase 39 measurement document read in full this session.
- Pitfalls: HIGH for six of ten (directly measured Phase 39 facts or directly-read existing bug-fix comments); MEDIUM for Pitfall 2's exact quiescence-window mechanism (flagged as Open Question 1 and Assumption A1 — this is the one genuinely open design question in the whole phase).

**Research date:** 2026-09-08
**Valid until:** 7 days (fast-moving — this phase itself edits several of the cited files, so line-number citations degrade immediately; re-verify before quoting any line number in a PLAN.md)
