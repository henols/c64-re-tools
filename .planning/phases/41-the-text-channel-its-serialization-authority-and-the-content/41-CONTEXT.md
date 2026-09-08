# Phase 41: The Text Channel, Its Serialization Authority, and the Contention Verdict - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase **dials the `-remotemonitor` text channel** that `broker-launch.mts:377`
has appended to every stock launch since Phase 3 and that nothing in the
project's history has ever opened a socket to. Four things, and nothing else:

1. **`CHAN-02`** — a container-side caller can learn its instance's text-monitor
   port. Pure plumbing; MEASURED as zero grep hits today.
2. **`CHAN-03`** — a tool call issues a text-monitor command and gets its
   complete response back, **framed by the prompt, never by a timeout**, proven
   against two planted controls (a prompt split across TCP segments; a command
   whose own output contains prompt-shaped text).
3. **`CHAN-04`** — every halt-taking operation on **either** channel passes
   through one serialization authority, whose shape Phase 39's verdict already
   selected (`go`, rule `R15` → **an in-process async mutex**). The two existing
   binary-side invariants hold unchanged.
4. **`CHAN-05`** — a contended instance is reported as contended, and
   `vice-wedge-triage` is fixed **in this same phase** so it cannot recommend a
   destructive recycle of a healthy instance.

Plus criterion 5's `default_memspace` remedy, exercised live rather than merely
made available.

**NOT in this phase** — named explicitly because each is adjacent enough to be
reached for:

- **The five text-format parsers** (`memmapshow`, `prof flat`, `chis`, `bt`,
  `io`). Phase 42 owns them; `PARSE-01..03` can run concurrently with this phase
  because they never see a socket.
- **The runtime evidence layer** and any `.annostore` table. Phase 43.
- **Drive-side checkpoints and the fastloader signal.** Deferred beyond this
  milestone by Phase 40's own ROADMAP note. This phase *opens* the `device c:`
  capability drive debugging will need; it does not use it for drive work.
- **Text-monitor `a` / `d` (assemble / disassemble)** and `x64` ↔ `x64sc` mode
  switching — both become available the moment the channel opens, and both were
  declined on the spot by owner decision 2026-09-06.
- **Improving `vice_cycles_stopwatch` via the text `stopwatch` command.** The
  stock implementation reconstructs cycles today (`stock-timing.ts`); routing it
  through the newly-opened channel is not in `CHAN-02..05`.

</domain>

<decisions>
## Implementation Decisions

Fifteen decisions from four discussed areas, plus one folded todo. Phase 39's
verdict is **locked input, not a decision here**: `go`, rule `R15`
(`docs/phase39-dual-channel-coexistence-gate-findings.md`) selects an in-process
async mutex, `R15` carries no narrowing, and neither pre-mapped narrowing
(`R11`/`D-10`, `R13`/`D-11`) triggered. Nothing below re-opens that.

### The text-channel tool surface (`CHAN-03`)

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

- **D-02: The two remedy tools ship now; the five Phase-42 commands stay behind the internal allowlist.** `device c:` and `warp` reach `tools/list` in this
  phase because their results are honestly presentable. `memmapshow`,
  `prof flat`, `chis`, `bt` and `io` are reachable **in-process** through
  `text-protocol.ts`'s allowlist — and so are covered by `CHAN-03`'s framing
  controls — but do not become MCP tools until Phase 42 lands their owning
  parser. **A tool never ships returning a blob it cannot interpret.** Phase 42
  does not need this to proceed: its first fixture batch already exists from
  Phase 39 (`FIXTURE_COUNT: 12`, both binaries).
  — **Reversibility:** reversible — adding the five later is additive, and
  nothing published changes shape.

- **D-03: `device c:` is an explicit tool plus a live contamination test — not auto-healing on the stepping path.** Criterion 5 wants it "exercised, not
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

- **D-04: All three narrowed `CLAUDE.md` constraints are re-anchored to this phase's evidence.** The scoping clauses **already exist** at
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

### The serialization authority (`CHAN-04`)

- **D-05: The mutex protects a holdable critical section, not a single wire command.** The lock is acquired per **logical operation** and may span many
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

### Reporting contention (`CHAN-05`)

- **D-09: Contention is an evidence field, not a sixth verdict. The frozen five are untouched.** `STOCK_DIAGNOSE_VERDICTS` is `Object.freeze`d at exactly five
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

- **D-10: `wedged` is made structurally unreachable while contended — in code, not in prose.** `vice_diagnose` consults the holder record before it can reach
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

- **D-11: While contended, the verdict returned is `live`, carrying the contention evidence.** The instance is healthy and responsive — not wedged —
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

- **D-12: Live on genuine stock 3.9 only, recorded MEDIUM, single-binary basis named.** The contention signature is reproduced live against
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

### The text socket's lifecycle (`CHAN-02`)

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

- **D-14: The text socket is claimed through the broker with an explicit channel discriminator.** A `monitor_claim` carrying `channel: "text"`, `broker-state.mts:129-137`'s
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

- **D-15: The port travels on the `grant` response and on `HeldLease`, and nowhere else.** `remoteMonitorPort` joins `broker-control.mts:242`'s `grant`
  beside `port` / `url` / `epoch_file` / `supervisor_dir`, and `HeldLease`
  (`vice-broker-client.ts:757`) gains the field. `StatusInstanceEntry` is
  **not** extended — that is exactly what criterion 1's "given no more weight
  than it deserves" asks for, and the claim-and-dial flow needs nothing more.
  — **Reversibility:** reversible — adding it to status later is additive.

- **D-16: The text port is MANDATORY on every stock launch. The degrade path is removed.** Owner direction, verbatim: *"it should not be possible, vice must be
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

One pending todo folds into this phase's scope.

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
  cold launch is **accepted**. Warming *per profile* is explicitly **not** taken
  — the todo calls it "a different todo", and it would grow this phase by a
  capability rather than a cleanup.
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
     preemptively to serve a newer request. Those invariants are protected by the
     floor's comments but are **not** the floor's.
  4. `VICE_BROKER_MAX` / `atCapacity()` **stay** — the ceiling is a separate
     concern from the floor.
  `broker-e2e.test.ts` touches `VICE_BROKER_WARM_FLOOR` in ten places; **four
  already set it to `0`**, so a no-warm broker is an already-exercised
  configuration, and only the two fixtures setting it to `1` and asserting the
  instance-directory count (`:393`, `:520`) actually depend on the floor.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 39's verdict — the locked input that selects this phase's shape

- `docs/phase39-dual-channel-coexistence-gate-findings.md` — the `go` verdict,
  rule `R15`, its YAML frontmatter with all seven transcribed inputs. **Read
  § *What this selects for the next phase*** (the `go` branch stated
  concretely), **§ *Narrowings*** (both pre-mapped narrowings checked and NOT
  triggered), and **§ *Recorded facts that gate nothing*** — that last section
  carries **twelve** numbered facts, each with an explicit *Phase 41
  implication*, and they are the most directly load-bearing prose in this
  phase's entire input set. Facts 1, 3, 4, 5, 8, 9, 10, 11 and 12 all bind
  decisions above.
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/39-CONTEXT.md`
  — `D-13` (the throwaway text client was evidence, **nothing survives into this
  phase** — do not go looking for a client to reuse), `D-15` (the `PATH` hazard:
  the fork 3.10 shadows stock on `PATH`, so resolve by absolute path and record
  which binary answered), `D-16` (broker stopped; the 2-failing measured floor),
  `D-19`/`D-20` (the two-directional `MANUAL_ONLY_TESTS` gate).
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/DECISION-RULE.md`
  — § *The three shapes the verdict selects*, § *Never a gate*.

### Phase scope and requirements

- `.planning/ROADMAP.md` § *Phase 41* — the four success criteria and the Notes
  paragraph confirming `CHAN-01` narrows nothing for this phase.
- `.planning/ROADMAP.md` § *Phase 42* — the boundary this phase must not cross,
  and the source of the `text-protocol.ts` module name.
- `.planning/ROADMAP.md` § *Phase 43* — confirms the capture step is
  **concurrent** under this verdict, not scheduled.
- `.planning/REQUIREMENTS.md` — `CHAN-02` (line 31), `CHAN-03` (32), `CHAN-04`
  (33), `CHAN-05` (34); the Excluded table (line 106); § *`CHAN-01` and
  `EVID-06` are gates, not features* (183) and the `CHAN-05`-ships-with-the-code
  rule (198).
- `.planning/STATE.md` — milestone scope and the two owner exclusions of
  2026-09-06 (text-monitor `a`/`d`; `x64`↔`x64sc` mode switching).

### Protocol and stock-backend facts

- `CLAUDE.md:32` — `default_memspace` contamination and the `device c:` remedy
  (`D-03`, `D-04`).
- `CLAUDE.md:36` — no runtime `WarpMode` resource vs `warp on` as a command
  (`D-04`).
- `CLAUDE.md:42` — `CPUHISTORY_GET`'s ≥ 3.10 opcode floor vs `chis`'s
  capability on 3.9 (`D-04`).
- `CLAUDE.md` § *Concurrency* — stock's binary monitor services exactly one
  client; a second `connect()` sits unserviced with no reply and no EOF, and
  **must not be diagnosed as a hang**. The text port behaves the same way
  (`text_single_client: single`), which is `D-14`'s whole justification.
- `CLAUDE.md` § *Testing* — the `vice-sync.ts` unit-test exemption `D-08` splits
  against.
- `docs/phase0-binmon-findings.md` §5 — the confirmed opcode set and error codes.

### Code seams this phase edits

- `src/mcp/vice/broker-state.mts:117-149` — `monitorClient`, the
  MONITOR-OWNERSHIP DECISION banner naming Phase 7 as the place to add the
  `channel` discriminator, and `remoteMonitorPort`. The banner's "NOTHING IN
  PHASE 3 DIALS THIS PORT" becomes false in this phase and must be corrected
  (`D-14`, `D-16`).
- `src/mcp/vice/broker-control.mts:242` (`grant`), `:269`
  (`monitor_claimed`), `:295` (`MONITOR_OWNERSHIP_DENIAL`), `:811+`
  (`monitor_claim` handler), `StatusInstanceEntry` — `D-14`, `D-15`. The
  `monitor_owned` refusal's own comment on never suggesting the emulator stopped
  answering is binding on `D-06`'s wording too.
- `src/mcp/vice/broker-launch.mts:367-378` (the `-remotemonitor` append and its
  bind-widening security warning), `:530` (the absent-request comment), `:670-706`
  (`acquirePortAndLaunch()`'s degrade), `:1148` (`maintainWarmFloor()`), `:1277`
  (`runBrokerPass()`), `:1439-1511` (the respawn path threading
  `remoteMonitorPort`) — `D-16` and the folded todo.
- `src/mcp/vice/vice-broker.mts:195` (`resolveWarmFloorForRecord()`), `:498` (`profileEligible()`), `:680`,
  `:952-980` (`maintainWarmFloorForRealBroker()`, incl. the `"spare"` launch reason at `:980`), `:1034-1067` (`handleRelease()`) — the folded todo.
- `src/mcp/vice/vice-broker-client.ts:757` (`HeldLease`), `:671`
  (`MonitorOwnershipError`), `:1037-1069` (`claimMonitor()`) — `D-14`, `D-15`.
- `src/mcp/vice/stock-connect.ts:404` (`stockConnect()`), `:494`
  (`stockDisconnect()`), `:529` (`stockReconnect()`), and its
  `StockConnectBrokerControl` narrow interface at `:63` — `D-13`, `D-14`.
- `src/mcp/vice/stock-dispatch.ts:285` (`ensureStockSession()`), `:493`
  (`withStockSession()`) — the mutex's binary-side integration point (`D-05`,
  `D-07`). Its header's two prohibitions (never fall through to
  `forwardToVice()`; never acquire a broker lease here) both stand.
- `src/mcp/vice/stock-diagnose.ts:406-413` (the frozen five), `:432-451` (the
  eight reason classes), `:754-771` (where `jamObserved` is derived and appended
  — the model `D-09` copies), `:976` (the `wedged` path `D-10` guards) — `D-09`,
  `D-10`, `D-11`.
- `src/mcp/vice/stock-run-until.ts` (`waitForCheckpointHit()`) and
  `src/mcp/vice/stock-reproducible-run.ts` (`waitForReproducibleStop()`) — the
  two wait paths `D-05`'s critical section must span. Both narrow on
  `.type === "checkpoint_info"` then the specific checkpoint id, and Phase 39
  confirmed both sound against a foreign halt. **Read-only in this phase's
  intent** — the mutex wraps them, it does not re-cut them.
- `src/mcp/vice/tools-manifest.stock.json:3617-3632` — `vice_diagnose`'s
  description and verdict enum. `D-09` adds an evidence field; the enum itself
  does not change.
- `src/skills/vice-wedge-triage/SKILL.md` — the verdict → response table
  (`:57-67`), the `jamObserved` cross-cutting section (`:69-86`), and the
  provenance table (`:217-236`) where `D-12`'s MEDIUM row lands.

### Guards this phase must not red

- `src/mcp/vice/stock-diagnose.test.ts:846-851` — asserts
  `STOCK_DIAGNOSE_VERDICTS` verbatim, in order, by length. `D-09` keeps it green
  by construction.
- `src/mcp/vice/test-gate.test.ts` + `MANUAL_ONLY_TESTS` — two-directional; a
  live test file must be added to both in one commit (`D-08`).
- `src/mcp/vice/resources-sync.test.ts` — `broker-*.mts` edits require
  `node build.ts` and the committed `resources/*.mjs` to be regenerated in the
  same commit. `D-16` and the folded todo both touch `.mts` launcher modules,
  so this fires.
- `src/mcp/vice/docs-linerefs.test.ts` — mechanically checks cited line numbers.
- `src/mcp/vice/broker-e2e.test.ts` — ten `VICE_BROKER_WARM_FLOOR` sites (the
  folded todo).
- `scripts/check-no-skill-external-spawn.mjs` — still green; nothing here
  spawns a host binary from a skill script.

### Folded todo

- `.planning/todos/pending/2026-09-07-remove-pre-warm-launch-vice-on-first-request.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`withStockSession()`** (`stock-dispatch.ts:493`) is already the single
  wrapper every session-taking stock tool passes through, and
  `ensureStockSession()` (`:285`) already holds a **module-level singleton**
  session with a `clearHeldStockSession()` reset. An in-process mutex fits this
  existing shape naturally — there is no new lifecycle to invent.
- **`jamObservedFor()` / the `jamObserved` append at `stock-diagnose.ts:754-771`**
  is a working, shipped, tested example of exactly what `D-09` needs: a
  cross-cutting, always-present evidence field derived from one seam and appended
  to every verdict's evidence bag, with a note appended to the report text.
  Copy its shape.
- **`monitor_claim` / `monitor_release`** already exist end to end — the control
  op (`broker-control.mts:811+`), the client (`vice-broker-client.ts:1037`), the
  broker handler (`vice-broker.mts:809`), the `MonitorOwnershipError` type, the
  `monitor_owned` refusal naming its holder, and the `hasMonitorClient` status
  flag. `D-14` extends a working mechanism rather than building one.
- **`StockConnectBrokerControl`** (`stock-connect.ts:63`) is a deliberately
  narrow structural interface over the broker session — tests inject a minimal
  stub. A text-channel claim can join it without dragging in the whole session.
- **`broker-launch.mts:370-376`**'s bind-widening security warning is the
  precedent for how this project words a text-monitor security caveat.

### What is NOT reusable — checked, so nobody hunts for it

- **There is no async mutex anywhere in this tree.** The only prior
  single-flight queue died with the retired analyser
  (`module-classification.ts:134-136`, `:780-785`): its discipline was generic
  but its implementation was bound to that child process, it had no consumer
  outside the family, and it was surveyed and explicitly **not** extracted.
  `D-07` builds the primitive fresh.
- **There is no text-monitor client.** Phase 39's was throwaway evidence by
  `D-13` and nothing survived. Framing starts from zero (which is the point —
  building it in Phase 39 would have foreclosed the shape the verdict selected).
- **`vice-sync.ts` is the FORK-side sync module**, driving `mcp__vice__*` tools.
  Its three invariants are the ones criterion 3 names, but the stock-side code
  that must honour them lives in `stock-run-until.ts` and
  `stock-reproducible-run.ts`. Do not edit `vice-sync.ts` looking for the stock
  wait paths.

### Established Patterns

- **Single seam per concern**, declared in a file header that says what the file
  is the ONE place for and what not to do. `D-07` follows it; `D-05`'s two wait
  paths are wrapped rather than re-cut.
- **Detect, then refuse BY NAME with the remedy in the message** — the standing
  constraint for external tools. `D-06`'s refusal and `D-14`'s second-client
  refusal both follow it. Note `D-16` removes the one case where this phase might
  otherwise have needed a missing-capability refusal.
- **Frozen lists with a verbatim test**, e.g. `STOCK_DIAGNOSE_VERDICTS` and
  `STOCK_DIAGNOSE_UNAVAILABLE_REASONS`. `D-09` is shaped to respect one.
- **Per-capability ids, never a generic run-arbitrary-command op** — `host_tool`'s
  precedent, and `D-01`'s basis.
- **Two-directional guards** so a change made on one side only reds the suite
  (`MANUAL_ONLY_TESTS` + `test-gate.test.ts`; the deferred-ledger test).
- **Generated-but-committed `resources/*.mjs`** from `.mts` sources via
  `build.ts`, enforced by `resources-sync.test.ts`.

### Integration Points

- `grant` response + `HeldLease` → the container learns the port (`D-15`).
- `stockConnect()` → opens and claims the text socket (`D-13`, `D-14`);
  `stockDisconnect()` releases it.
- `channel-lock.ts` → imported by `stock-dispatch.ts` (binary side) and
  `text-protocol.ts` (text side); its holder record is read by
  `stock-diagnose.ts` (`D-09`).
- `text-protocol.ts` → owns the socket, the prompt framing, the banner drain and
  the internal allowlist; hands raw strings to Phase 42's parsers later.
- `tools-manifest.stock.json` → the two new remedy tools and
  `vice_diagnose`'s new evidence field.
- `vice-wedge-triage/SKILL.md` → the contention row and the MEDIUM provenance
  entry.

</code_context>

<specifics>
## Specific Ideas

- **Owner's words on the mandatory text port, verbatim:** *"it should not be
  possible, vice must be started witht the text channel"* — in response to a
  question offering a graceful refusal path for a portless instance. The
  refusal path is therefore **not** to be built; the state it would handle is
  designed out (`D-16`).
- **The contention row's confidence is deliberately MEDIUM, not HIGH.** Offered
  the two-binary HIGH option, the owner chose stock-3.9-only at MEDIUM. Read
  this as a standing preference for a provenance grade that matches what was
  actually measured over one that matches the neighbouring rows.
- **`CHAN-03`'s two planted controls are named by the criterion itself and are
  not negotiable:** a prompt arriving **split across two TCP segments**, and a
  command whose own output **contains prompt-shaped text**. Each must be
  observed **red without the fix** — the criterion says "prove the framing
  rather than assert it". Add the banner-drain race (`D-13`) as a third if it
  can be planted.

</specifics>

<deferred>
## Deferred Ideas

Nothing new was proposed during this discussion that grows the phase. These are
the adjacent capabilities named and explicitly held out:

- **Warming per profile** instead of removing the warm floor — the folded todo
  calls this "a different todo". Belongs in its own item if boot latency on warp
  captures ever becomes the real want.
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

### Reviewed Todos (not folded)

Six of the seven `todo.match-phase 41` matches were reviewed and not folded.

- **Reap vicerc scratch dirs in broker kill/recycle path**
  (`2026-08-24-…`) — offered and declined. A cleanup concern; this phase's
  recycle work is about *avoiding* a recycle, not about what one leaves behind.
- **BACK-05 D-G ordering test fails deterministically on a live-broker host**
  (`2026-08-26-…`) — not fixed here, but **honoured**: it is the reason `D-16`'s
  broker-stopped discipline and the 2-failing measured floor carry forward from
  Phase 39.
- **Correct the false real-corpus claim in `research/questions.md`**
  (`2026-08-26-…`) — keyword match only; unrelated to this phase.
- **Phase 28 review: `in-02` fsync portability on Windows**
  (`2026-08-28-…`) — keyword match only.
- **Phase 28 review round 3: five open findings** (`2026-08-28-…`) — keyword
  match only.
- **Move all tests into a separate test folder** (`2026-09-07-…`) — a
  repo-wide reorganisation; folding it into a phase that adds test files would
  guarantee a conflict.

</deferred>

---

*Phase: 41-The Text Channel, Its Serialization Authority, and the Contention Verdict*
*Context gathered: 2026-09-08*
