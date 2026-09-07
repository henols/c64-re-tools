# Phase 39: The Dual-Channel Coexistence Gate (Go/Degrade/No-Go) - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning

<domain>
## Phase Boundary

**This phase's deliverable is evidence, not code.** One pre-committed gate
(`CHAN-01`) whose verdict — `go`, `degrade` or `no-go` — says whether a
text-monitor client and a binary-monitor client can drive the same emulator
without corrupting each other, derived from live measurement against genuine
stock VICE by rules committed to git before any measurement exists.

Three things ship:

1. **The pre-commitment** — decision rules, the outcome-line schema and the
   evidence conventions, committed as the phase's first plan, with git order as
   the proof and an executable totality walk.
2. **Seven measurements** — the five named experiments (idle coexistence,
   foreign-halt visibility, concurrent in-flight commands, cross-channel resume,
   abrupt-disconnect recovery) plus the milestone's two blocking UNVERIFIED
   items (whether interleaved halt/resume corrupts the binary client's view, and
   whether the text-monitor server enforces the same single-client limit the
   binary monitor does), each recording an outcome at column 0 of its own
   evidence file.
3. **The first text-channel fixture batch** — the probe's raw captured text,
   with the same five provenance keys the binary-monitor fixtures already
   require, from two binaries on this host.

The verdict has the authority to narrow or cancel every phase after it: it
selects which of three structurally different serialization modules Phase 41
builds, and a `no-go` re-scopes Phase 43's capture step from concurrent to
scheduled.

**Not in this phase, in any shape:** `monitor-lock.ts`. The in-process mutex,
the broker-level lease and the connect-gate are three structurally different
things and picking the wrong one wastes a phase — the verdict is the
deliverable. Also not here: `CHAN-02`'s port-surfacing plumbing, `CHAN-03`'s
reliable framing, `CHAN-04`'s serialization authority, `CHAN-05`'s contention
verdict, and every `PARSE-*` parser. **No production module of Phase 41 exists
when this phase closes.**

**A factual correction carried here so a planner does not lose an afternoon to
it:** `vice-sync.ts` is **not** the seam any of the three shapes extends. It
imports the fork-only `call()` from `vice.ts`, and no `stock-*.ts` module
imports it; the several stock modules that uphold the same two invariants do so
natively, per module, and reference `vice-sync.ts` only in comments.

</domain>

<decisions>
## Implementation Decisions

The owner selected all four gray areas and answered each question directly. One
answer (`D-15`) was given as free text and is reproduced in the owner's own
framing. Everything not settled below is Claude's discretion under the standing
autonomy preference; the items most worth a second look before `39-01` is
committed are named at the end.

### The gate (`CHAN-01`)

- **D-01: The rules, the schema and the evidence conventions are plan `39-01`,
  and that plan touches nothing else.** Every measuring plan comes after it.
  **Git history is the proof** — the rules commit precedes the first measurement
  commit and is checkable with `git log`; no test guard. This is Phase 9's
  shape, Phase 23's `D-07` and Phase 33's `D-01`, reused because it has now
  worked three times: Phase 9's `R4` returned `degrade`, Phase 23's `R1`
  returned `no-go` and five of its eleven plans were deliberately never
  dispatched, and Phase 33's `R6` returned `degrade`.
  — **Reversibility:** one-way — once a measurement has been committed, the
  rules can never again be shown to predate it. Ordering is the entire
  mechanism.

- **D-02: The gate takes exactly seven named, machine-readable inputs — one per
  named experiment, plus the two blocking UNVERIFIED items as inputs of their
  own.**

  | Input | Domain | Source |
  |---|---|---|
  | `IDLE_COEXIST` | `clean` \| `corrupts` \| `not-taken` | A non-halting `MEM_GET` on the binary channel while the text client is connected and silent |
  | `FOREIGN_HALT_VISIBILITY` | `visible` \| `invisible` \| `corrupts` \| `not-taken` | A non-stopping checkpoint armed on the binary channel while a halting `memmapshow` is issued on the text one |
  | `CONCURRENT_INFLIGHT` | `clean` \| `degraded` \| `corrupts` \| `not-taken` | `ADVANCE_INSTRUCTIONS` against `prof flat 5` at overlapping instants |
  | `CROSS_CHANNEL_RESUME` | `clean` \| `corrupts` \| `not-taken` | Halt on one channel, read and resume from the other |
  | `DISCONNECT_RECOVERY` | `recovers` \| `leaves-halted` \| `not-taken` | `SIGKILL` the text client while it holds a halt |
  | `HITCOUNT_INVARIANT_HOLDS` | `holds` \| `breaks` \| `not-taken` | Whether the existing "poll on `hit_count`, never on paused state" invariant already tolerates a foreign halt for free, or a foreign `STOPPED` can be mistaken for the client's own |
  | `TEXT_SINGLE_CLIENT` | `single` \| `multi` \| `not-taken` | A two-connection live test against the text port |

  The two UNVERIFIED items are gate inputs rather than sub-facts because
  criterion 3 requires both to be "settled by measurement and **recorded either
  way**", and a gate input is the only recording with teeth. The exact value
  domains above are indicative — `SCHEMA.md` fixes them, and `SCHEMA.md` is what
  a measuring plan reads.
  — **Reversibility:** costly — the input set is what the rules are written
  against; adding an eighth input after the rules are committed re-opens the
  pre-commitment question for the whole gate.

- **D-03: `could-not-run` is not an emittable verdict, and every input carries
  an explicit `not-taken` member instead.** The verdict field's accepted values
  are exactly `go` / `degrade` / `no-go`. An experiment that cannot be taken
  records *that* as an input value — criterion 2's "an experiment that cannot be
  taken records that, as a gate input; it is never silently omitted" — so the
  gate can never abstain, and no host limitation is laundered into silence. This
  is Phase 33's `R9` shape (a terminal antecedent-free rule) generalised to
  seven inputs.
  — **Reversibility:** one-way — a gate that abstained once has already failed
  to be a gate.

- **D-04: Totality is discharged by a committed executable walk, not by prose.**
  A named script under the phase's evidence directory enumerates the full
  cross-product of the seven input domains, evaluates the committed rules in
  order over every tuple, and asserts exactly one antecedent matches each — then
  emits the tuple count and a per-rule hit histogram as column-0 outcome lines.
  Phase 33 walked 108 tuples in prose and that was already at the limit of what
  a reader can check; the product here is in the low thousands and cannot be
  walked by hand honestly. The script is committed **in `39-01`**, so the walk
  itself predates every measurement.
  — **Reversibility:** reversible — but a rule set found non-total *after* the
  first measurement lands cannot be repaired without breaking `D-01`.

- **D-05: The verdict is machine-readable YAML frontmatter in
  `docs/phase39-dual-channel-coexistence-gate-findings.md`** — `verdict:
  go|degrade|no-go`, `verdict_rule_applied: R<N>`, plus all seven `D-02` inputs
  reproduced verbatim as frontmatter fields, each citing the evidence file and
  line its value was transcribed from. The document reproduces the full rule and
  walks the actual outcome values through it, so a reader mechanically
  re-derives the verdict rather than taking it on trust. Same key order as
  `docs/phase33-reproducible-run-gate-findings.md`.
  — **Reversibility:** reversible.

- **D-06: The verdict binds Phases 41-44 through ROADMAP `Depends on` + Notes +
  a STATE.md pointer, with no test guard.** Phase 23's `D-08` and Phase 33's
  `D-06`, which closed Phase 9's criterion 5 the same way. A guard would encode
  roadmap policy in a suite belonging to a phase that ships almost no product
  code, and the likeliest outcome (`degrade` — proceed, narrowed) is exactly the
  case such a guard cannot check. Phase 43's `no-go` re-scope (capture becomes
  scheduled rather than concurrent) is bound by the same route.
  — **Reversibility:** reversible — a guard can be added later if the pointer
  proves insufficient.

- **D-07: The evidence layout mirrors Phase 33's exactly.**
  `.planning/phases/39-…/evidence/` carrying `DECISION-RULE.md`, `SCHEMA.md`
  and `README.md` as three files, not one. They were split deliberately —
  `SCHEMA.md` fixes the literal names a measuring plan may emit and
  `DECISION-RULE.md` consumes them, so merging them would let a rule edit and a
  name edit hide in one diff. The transcription rule carries over verbatim:
  bare `NAME: value` at **column 0**, **final occurrence wins**, **one declared
  source file per line**, and an absent gate-input line is an incomplete phase
  rather than a default. Phase 33's conventions are **copied, not shared** — a
  shared conventions doc would mean editing a closed phase's evidence tree and
  would turn honest drift between gates into a merge conflict.
  — **Reversibility:** reversible.

### Verdict thresholds

- **D-08: `TEXT_SINGLE_CLIENT` gates nothing on its own.** A single-client limit
  on the text side constrains the broker to one text client per instance — the
  same rule it already enforces for the binary monitor — but says nothing about
  whether one text client and one binary client can coexist, which is the only
  question this gate asks. Bind-time coexistence of the two ports is already
  MEASURED on both builds on this host, so the limit is per-server, not
  machine-wide. It is recorded as a fact that shapes Phase 41's connection
  management and appears in no antecedent.
  — **Reversibility:** reversible.

- **D-09: `IDLE_COEXIST` is the sole `no-go` trigger, and it triggers on both
  `corrupts` and `not-taken` — by two separately numbered rules, so the record
  distinguishes them.** If a non-halting read on the binary channel returns
  wrong data, errors, or desyncs merely because a silent text client is
  connected, then no serialization authority helps: the mutex, the lease and the
  connect-gate all assume the idle case is safe, and only the connect-gate
  (never coexisting) survives. This is the one input whose failure is unfixable
  by discipline. `not-taken` reaches the same verdict by a different rule and a
  different stated reason — an unmeasured coexistence precondition cannot
  license a design that *assumes* coexistence — and because `IDLE_COEXIST` is
  the cheapest experiment and a precondition for the other four, its being
  untakeable means none of them were taken either.
  — **Reversibility:** costly — this is the rule that can cancel the concurrent
  design; relaxing it after the numbers are visible is the exact move the
  pre-commitment exists to forbid.

- **D-10: `DISCONNECT_RECOVERY: leaves-halted` is a `degrade` whose fix is named
  in the verdict, and the narrowing is pre-mapped in `39-01`.** The ROADMAP
  already states the obligation: "the mechanism that fixes it becomes named
  Phase 41 scope in the verdict — discovered here, not at Phase 41's gate." A
  killed text client leaving the machine permanently halted, indistinguishable
  from a genuine wedge, is a **missing mechanism**, not a proof of
  incompatibility: the binary side's "connection close IS the release" has no
  text-channel analogue, and only the broker outlives a killed client — so this
  outcome points at the broker-lease shape rather than away from coexistence.
  — **Reversibility:** costly — pre-mapped narrowing can be superseded at
  verdict time only by recording the override explicitly, which weakens the
  pre-commitment it exists to provide.

- **D-11: Pre-mapped `degrade` narrowing is authored for `DISCONNECT_RECOVERY`
  and `HITCOUNT_INVARIANT_HOLDS` only.** Phase 33's `D-04` shape, retargeted at
  the two inputs where a narrowing written *after* seeing the result would be
  most suspect. The ROADMAP names the first. The second is the milestone's other
  blocking UNVERIFIED item and is where an after-the-fact author would be most
  tempted to declare the existing invariant already sufficient; its pre-mapped
  narrowing is that every stock module upholding "poll on `hit_count`, never on
  paused state" natively must gain foreign-halt discrimination, and Phase 41's
  selected shape must supply it. The other five inputs yield plain enumerated
  values with no interpretive step, so their narrowing is **authored at verdict
  time against the evidence**, Phase 9 style, and is labelled as such so a
  reader weighs it differently from a pre-commitment.
  — **Reversibility:** costly — same reason as `D-10`.

### The probe and how instances are reached

- **D-12: The probe spawns `x64sc` directly and does not go through the
  broker.** `execve` the binary with `-default` **first**, then
  `-binarymonitor` and `-remotemonitor` on ports the probe itself chose. The
  broker cannot hand a container-side caller the text port — `CHAN-02` records
  that `remoteMonitorPort` is recorded host-side in the instance record but
  never surfaced through acquire/status, MEASURED as zero grep hits — and
  closing that gap is Phase 41 work this phase must not do. Because both port
  numbers are the probe's own, no plumbing is needed and no broker state is
  touched. Recorded as a trust boundary in the plan's threat model, Phase 33's
  `T-33-04` shape, rather than left implicit. Direct precedent:
  `.planning/phases/33-…/evidence/determinism-probe.mjs` § *Why it spawns x64sc
  directly and not through the broker*.
  — **Reversibility:** reversible.

- **D-13: The text-channel client is a throwaway probe helper in the phase's
  evidence directory, and nothing from it survives into Phase 41.** It frames on
  the `(C:$xxxx) ` prompt **crudely and deliberately** — `CHAN-03` owns framing
  that survives the prompt arriving split across TCP segments and that does not
  mistake the prompt appearing inside data for the end of a response, and
  building that here would be Phase 41 code by another name. The standing
  precedent is Phase 23's and Phase 33's `D-10`: throwaway scripts are evidence,
  not deliverables. What survives the phase is the captured text and the
  verdict, not the client.
  — **Reversibility:** reversible — but shipping a client here would foreclose
  the shape the verdict is supposed to select, which is one-way.

- **D-14: The binary half of every experiment is driven through the shipped
  `stock-protocol.ts` encoders, never hand-rolled frames.** Phase 33's probes
  already do this and record it under a "what it does *not* retype" header, so a
  future edit to the shipped encoders changes what the probe sends instead of
  leaving it measuring a stale copy. Only the *text* half is throwaway.
  *(Claude's discretion — not put to the owner.)*
  — **Reversibility:** reversible.

- **D-15: The gate is measured on genuine stock 3.9 at `/usr/bin/x64sc`; VICE
  version is provenance, never a gate input.** In the owner's words: *"Baseline
  is 3.9 and it doesn't matter if it's a later version."* So: the seven inputs
  are measured on the 3.9 baseline, which is what `CHAN-01`'s "live measurement
  against genuine stock VICE" names and what the stock backend Phase 41 serves
  actually runs. Criterion 5's second-binary capture stays — it is a roadmap
  success criterion — but **"3.10" in it describes what happens to be on this
  host, not a pin**: any second binary satisfies the two-binary provenance
  requirement, and a run landing on something later invalidates nothing. The
  second binary's outcomes are recorded as facts beside the gate, never as gate
  inputs, and a divergence between the two is recorded loudly rather than
  averaged. **Note the PATH hazard:** the fork 3.10 shadows stock on `PATH`
  (`which -a x64sc` → `/usr/local/bin/x64sc` first), so every probe must resolve
  its binary by absolute path and record which one answered.
  — **Reversibility:** reversible.

- **D-16: Every live run is taken with the broker stopped**, and each evidence
  transcript records that fact (`BROKER_STATE:`) alongside the
  `test:automated` baseline it was taken against. A live broker reddens the
  `BACK-05` assertion deterministically, so a phase measuring against a
  live-broker run reads a false baseline and every number in it is suspect.
  **Do not write "clean floor: 0" into any acceptance criterion** — the measured
  floor is **2 failing tests in `anno-register.test.ts` alone**, from a cause no
  phase in this milestone created, and `npm test` is not used at all because the
  whole-glob run does not terminate unaided.
  — **Reversibility:** one-way — a measurement taken against a contaminated
  baseline cannot be repaired afterwards; it has to be discarded and re-run.

### The fixture batch

- **D-17: Only parseable command outputs become committed fixtures; the
  coexistence experiments stay transcripts.** The raw bytes of the text-monitor
  command responses Phase 42 will have to parse — `memmapshow`, `prof flat`,
  `chis`, `bt`, `io`, and the bare prompt — each as a payload file plus its
  five-key sidecar. The experiments' interleavings stay as transcripts in their
  evidence files, where they are read by humans and by the transcription rule.
  A fixture is something a loader loads, and nothing will ever load a `SIGKILL`
  interleaving; the five-key sidecar's `command` field is meaningless for a
  trace that had no single command.
  — **Reversibility:** reversible — promoting a transcript to a fixture later is
  additive.

- **D-18: Text fixtures live in `src/mcp/vice/fixtures/textmon/` with their own
  sibling loader module; `binmon-fixtures.ts` is not extended.** That module's
  whole contract is byte-exact binary-monitor response frames — `STX`,
  `api_version`, the 12-byte header — and its own file header declares it the
  ONE place any test in the package builds or loads such a frame. Text captures
  share none of that beyond the five provenance keys. Single seam per concern:
  the shared part is the sidecar validation, not the frame layout, and widening
  the binary loader would make its own header sentence false and invite a text
  test to reach for a frame encoder.
  — **Reversibility:** costly — merging two loaders later is easy; unpicking a
  text consumer that grew a dependency on the binary frame encoder is not.

- **D-19: Exactly one corpus-free automated test guards the loader, and
  `MANUAL_ONLY_TESTS` is unchanged.** It asserts the loader refuses a sidecar
  missing any of the five required keys, and that every committed sidecar
  carries `synthetic: false` with a `capturedFrom` naming the binary's kind and
  resolved absolute path — the shape `binmon-fixtures.test.ts` already uses. It
  needs no emulator, so it joins `automatedTestFiles()` and the manual list does
  not move. This is criterion 5's own mechanism: "the loader refusing a sidecar
  that is missing a key is what makes this checkable rather than claimed."
  **Default expectation for this phase: zero new `MANUAL_ONLY_TESTS` entries.**
  If a live capture suite is nevertheless written, its file is added to
  `MANUAL_ONLY_TESTS` **and** to the count assertion in `test-gate.test.ts` **in
  the same commit** — the union guard fails in both directions.
  — **Reversibility:** costly — the two-directional gate means a file added to
  one side and not the other reds the suite immediately.

- **D-20: When a command is unsupported on a binary, the refusal itself is
  committed as a fixture.** The unsupported response is the capture, with a
  sidecar whose `command` field names the command and whose `note` names the
  missing capability **and the binary** — exactly what
  `fixtures/binmon/cpuhistory-get-unsupported.json` already does for the 3.9
  build with no `0x86` case. `PARSE-04` needs a real unsupported response to
  build its "told which capability is missing" path against, and this is the
  cheapest moment in the project to capture one. Note the polarity: this support
  is opt-**out** at build time, the opposite of the `>= 3.10` opcode note, and
  the affected commands do not share a single guard — so each is probed on its
  own.
  — **Reversibility:** reversible.

### Claude's Discretion

The owner answered every question put to them; `D-14` is the only decision
above that was not. Everything not enumerated here — plan decomposition, which
experiments run concurrently, the concurrent in-flight experiment's timing
method, evidence file naming — is Claude's discretion.

The three decisions most worth a second look before `39-01` is committed:

- **`D-09`'s `not-taken` → `no-go` arm.** It is the one place this context
  extends the owner's answer rather than recording it: they chose "idle
  coexistence fails" as the sole `no-go`, and the untakeable case was reasoned
  out here. If the reasoning is wrong, a host hiccup cancels the concurrent
  design.
- **`D-02`'s seven-input set and their value domains.** The domains above are
  indicative; `SCHEMA.md` fixes them, and every one it fixes is frozen from the
  first measurement commit onward.
- **`D-11`'s choice of which two inputs get pre-mapped narrowing.** Getting this
  wrong means a `degrade` whose narrowing was authored after the numbers were
  visible — the failure mode the gate exists to prevent.

### Folded Todos

One pending todo is folded into this phase's scope. It already carries
`resolves_phase: 39`.

- **Phase 7 Pitfall 5 overgeneralizes "text monitor unreachable" and is why the
  `-remotemonitor` port stayed unclaimed**
  (`.planning/todos/pending/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md`)
  — `07-RESEARCH.md` states, in its Alternatives Considered table and again as
  Pitfall 5, that the text monitor's `stopwatch` is reachable only from the
  interactive console. Phase 33 reviewed this todo and declined it because that
  milestone kept the channel out of scope. This phase is the first thing in the
  project's history to actually dial the port, so it produces exactly the
  measured evidence the correction needs. Named files:
  `.planning/phases/07-cycle-timing-and-wedge-triage/07-RESEARCH.md`,
  `CLAUDE.md`, `.planning/notes/stock-vice-migration-revised-loss-ledger.md`.

Note the two-directional guard: `docs-deferred-ledger.test.ts` fails in **both**
directions, so resolving this todo requires moving its `STATE.md` Deferred Items
row (the `docs | 2026-08-28-phase-7-pitfall-5-…` row) in the **same commit** as
moving the file to `.planning/todos/completed/`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` (Phase 39 entry, lines ~850-880) — the five success
  criteria and five Notes; the Notes carry the `vice-sync.ts` correction and the
  abrupt-disconnect obligation, neither of which is repeated anywhere else
- `.planning/REQUIREMENTS.md` — `CHAN-01` verbatim (line 30) with its MEASURED
  evidence, plus `CHAN-02`..`CHAN-05` (lines 31-34) for what this phase must
  **not** build, and `PARSE-03`/`PARSE-04` (lines 40-41) for the fixture
  provenance discipline and the opt-out build-support polarity
- `.planning/STATE.md` — current position, the v0.9.0 scope decision that
  reverses v0.8.0's text-channel exclusion, the three MEASURED-FALSE exploration
  claims, and the Deferred Items ledger row `D-20`'s folded todo must move

### The gate pattern (precedent that fired three times)
- `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/DECISION-RULE.md`
  — the rule-ordering, first-match-wins, frozen-after-first-measurement shape
  `D-01` reuses, including its Decision-checkpoint paragraph recording that the
  human owner resolved the freeze **before** dispatch
- `.planning/phases/33-…/evidence/SCHEMA.md` — §1 outcome-line conventions
  (column 0, final occurrence wins, one declared source file per line, absence
  rules) that `D-07` carries over verbatim, and §2's per-input derivation-rule
  shape
- `.planning/phases/33-…/evidence/README.md` — the evidence conventions binding
  on every plan: the `$ <command>` transcript convention, `BROKER_STATE:` /
  `TEST_AUTOMATED_BASELINE:`, the voided-run rule, and the ordering proof
- `.planning/phases/33-…/33-CONTEXT.md` — `D-01`..`D-06` (the gate), `D-10`
  (throwaway scripts are evidence), `D-11` (broker stopped, baseline recorded)
- `docs/phase33-reproducible-run-gate-findings.md` — the frontmatter key order
  `D-05` mirrors and the transcription rule stated in its opening paragraphs
- `docs/phase23-real-release-gate-findings.md` — the `no-go` verdict document,
  and the `could-not-run` outcome `D-03` exists to keep unreachable

### Protocol and stock-backend facts
- `CLAUDE.md` § Constraints — the five unsolicited message types (`STOPPED`,
  `RESUMED`, `JAM`, `CHECKPOINT_INFO`, `REGISTER_INFO`) arriving at request-id
  `0xffffffff` and why demux must never resolve a pending request with an event;
  single-client-per-instance on the binary monitor and its
  indistinguishable-from-a-wedge second `connect()`; the synchronous
  `CHECKPOINT_INFO` emitted from inside the CPU loop; the absent runtime
  `WarpMode` resource
- `docs/phase0-binmon-findings.md` §5 — the settled normative wire protocol
- `docs/stock-vice-parity.md` — what is CUT from the stock surface and why
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-RESEARCH.md` — Pitfall 5
  and the Alternatives Considered table, both corrected by the folded todo

### Code seams this phase reads (and, for one, adds beside)
- `src/mcp/vice/broker-launch.mts` (`buildViceArgs()`, the `-remotemonitor`
  append at ~367-377) — the shipped argv shape the probe reproduces by hand.
  Verified order at discussion time: `-default` at index 0, optional `-console`
  (headless), `-drive8type 1541`, then the exported frozen
  `STOCK_DETERMINISM_FLAGS` array, optional `-warp`, then `-binarymonitor
  -binarymonitoraddress ip4://<host>:<port>`, then `-remotemonitor
  -remotemonitoraddress ip4://<host>:<remoteMonitorPort>`. The probe should
  **import** `STOCK_DETERMINISM_FLAGS` rather than retype it (Phase 33's
  `T-33-36`), so a later edit to the shipped block changes what the probe
  launches instead of leaving it measuring a stale copy. The same function
  carries the recorded warning that VICE's text monitor "accepts arbitrary
  monitor commands and is unauthenticated, exactly like the binary monitor" —
  the probe binds both ports on `127.0.0.1` only
- `src/mcp/vice/broker-control.mts` (~line 522, "Connection close IS the
  release") — the binary side's release semantics that the text channel has no
  analogue for, which is what `D-10`'s experiment probes
- `src/mcp/vice/stock-protocol.ts` — the shipped wire encoders `D-14` requires
  the binary half of every experiment to use
- `src/mcp/vice/binmon-fixtures.ts` — `REQUIRED_PROVENANCE_KEYS` at :228 (the
  five keys), `loadCapturedFixture()`'s refusal behaviour, and the file header
  declaring it the ONE binary-frame loader (`D-18`'s reason for a sibling)
- `src/mcp/vice/binmon-fixtures.test.ts` — :326's assertion shape that `D-19`
  copies for the text sidecars
- `src/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.json` — the
  unsupported-response sidecar `D-20` follows, including its re-record guard note
- `src/mcp/vice/vice-sync.ts` — the two documented invariants
  (`HITCOUNT_INVARIANT_HOLDS` measures the second of them), read for the
  invariant text only; see the domain note above on why it is **not** the seam

### Guards this phase must not red
- `src/mcp/vice/test-gate.mjs` — `MANUAL_ONLY_TESTS` (the ONE list) and
  `test-gate.test.ts`'s union guard, which fails in both directions (`D-19`)
- `src/mcp/vice/docs-deferred-ledger.test.ts` — fails in both directions; the
  folded todo needs its `STATE.md` row moved in the resolving commit
- `src/mcp/vice/docs-linerefs.test.ts` — mechanically checks the two
  `rewriteArguments()` citations in `CLAUDE.md`, which the folded todo also edits
- `src/mcp/vice/broker-launch.test.ts` — the stock whole-argv `assert.deepEqual`
  assertions; this phase changes no argv, but a planner should know they exist
  before touching `broker-launch.mts` for any reason

### Folded todo
- `.planning/todos/pending/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.planning/phases/33-…/evidence/determinism-probe.mjs`** — the worked
  precedent for `D-12`: a probe that spawns `x64sc` directly, imports the
  shipped constants rather than retyping them, and records the direct-spawn
  route as a named trust boundary. Its "WHY IT SPAWNS x64sc DIRECTLY", "WHAT IT
  DOES *NOT* RETYPE" and "WHAT NOT TO DO" headers are the structure this
  phase's probes should copy.
- **`stock-protocol.ts`'s encoders** — every binary-channel command body in
  every experiment comes from here (`D-14`). The probe hand-rolls no frames.
- **`binmon-fixtures.ts`'s sidecar discipline** — `REQUIRED_PROVENANCE_KEYS`
  and the refuse-on-missing-key behaviour are the *contract* `D-18`'s sibling
  loader reimplements for text; the frame encoding is not.
- **`broker-launch.mts`'s `-remotemonitor` block** — the shipped argv the probe
  reproduces. Reading it is how the probe gets the flag spellings right;
  `-remotemonitoraddress`'s exact spelling is already recorded there as
  non-obvious.

### Established Patterns
- **The pre-committed gate.** Rules in their own early plan, git order as the
  proof, a machine-readable verdict in `docs/phaseNN-…-findings.md`, values
  transcribed from column-0 outcome lines. Fired at Phases 9, 23 and 33.
- **Throwaway probe scripts are evidence, not deliverables** (Phase 23,
  Phase 33 `D-10`). `D-13` applies it to the text client.
- **Single seam per concern.** Every cross-cutting responsibility has exactly
  one owning file; re-deriving it locally is a named anti-pattern. `D-18`
  follows it by *not* widening the binary loader.
- **Structured "WHAT NOT TO DO" file headers naming the specific past mistake.**
  The new text-fixture loader is expected to carry one.
- **Two-directional guards.** `test-gate`'s union, the deferred ledger, and the
  resources sync all fail in both directions — every one of them turns a
  half-finished bookkeeping edit into a red suite rather than a silent drift.

### Integration Points
- Probe (`execve /usr/bin/x64sc`) → two ports it chose → binary channel via
  `stock-protocol.ts` encoders + text channel via the throwaway helper →
  column-0 outcome lines in seven evidence files.
- The seven outcome lines → `DECISION-RULE.md` → the verdict frontmatter in
  `docs/phase39-dual-channel-coexistence-gate-findings.md`.
- The verdict → ROADMAP `Depends on` + Notes of Phases 41-44 + a STATE.md
  pointer (`D-06`); Phase 41's serialization shape and Phase 43's
  concurrent-versus-scheduled capture step both read it.
- Captured command text → `src/mcp/vice/fixtures/textmon/` + sidecars → the
  sibling loader → Phase 42's `PARSE-01`..`PARSE-04` parsers.

</code_context>

<specifics>
## Specific Ideas

- **The gate's distinguishing property, stated as the thing to check against
  every rule draft.** Phase 23's gate could return `could-not-run` because every
  input needed a corpus; Phase 33 removed that by making four of five inputs
  corpus-free. This gate's analogue is different: every input is corpus-free
  (no cracked release is involved anywhere), so the abstention risk is not a
  missing corpus but an **untakeable experiment**. `D-03`'s `not-taken` member
  is what absorbs it. If a draft rule can be reached only when every input has a
  measured value, the draft is wrong.
- **Flag order is load-bearing.** `-default` must precede `-binarymonitor` or
  the monitor never binds. MEASURED on this host; the shipped `buildViceArgs()`
  already puts `-default` at argv index 0 and the probe must too. Treat the same
  rule as unverified-but-likely for `-remotemonitor`: nothing has ever dialed
  that port, so no measurement exists either way — keep `-default` first and
  record it as an assumption rather than a fact.
- **`/usr/bin/x64sc` is genuine unpatched stock 3.9; the fork 3.10 shadows it on
  `PATH` at `/usr/local/bin/x64sc`.** Both are on this host. Every probe
  resolves its binary by absolute path and records which one answered — never by
  bare name.
- **This is the fourth time this project makes an assumption probe a phase
  rather than a criterion, and the first three all fired.** Phase 9's `R4`
  returned `degrade` and the milestone shipped smaller and correct. Phase 23's
  `R1` returned `no-go` and five of eleven plans were deliberately never
  dispatched. Phase 33's `R6` returned `degrade`. The precedent is not
  decorative: gates here fire, and are obeyed.
- **What is already MEASURED, so the probe does not re-derive it.** Bind-time
  coexistence of the two channels on both builds; the `(C:$xxxx) ` prompt as a
  dependable terminator on both; and the text monitor **halting the machine on
  command** exactly as the binary one does — the stopwatch counter advanced only
  across an `x`. That last fact is why this is a gate at all.
- **VICE event record/replay does not exist.** `event.c` registers six event
  options, none a recording flag; `x64sc -record` exits 255. It was v0.8.0's
  false premise and had to be corrected mid-milestone. The text monitor's
  `record` / `playback` are monitor-command **file scripting**, not event
  history. Do not spend a research pass rediscovering this.

</specifics>

<deferred>
## Deferred Ideas

- **`CHAN-02`'s port surfacing** — making `remoteMonitorPort` reachable from the
  container through the broker's acquire/status responses. Mapped to Phase 41.
  `D-12` routes around it by spawning directly rather than closing it early.
- **`CHAN-03`'s reliable framing** — a prompt terminator that survives split TCP
  segments and does not mistake the prompt appearing inside data. Mapped to
  Phase 41; `D-13` deliberately ships the crude version as throwaway evidence.
- **`monitor-lock.ts` in any of its three shapes** — the whole point of the
  verdict. Phase 41.
- **A text-monitor client module in `src/`** — declined by `D-13`. Phase 41
  writes it against the shape the verdict selects.
- **A test guard on the gate's downstream binding** — declined by `D-06`,
  matching Phases 23 and 33. Can be added later if the ROADMAP+STATE pointer
  proves insufficient.
- **A live text-capture suite in `MANUAL_ONLY_TESTS`** — declined by `D-19`. The
  capture is a one-time act this phase performs, not a regression surface.
- **VICE's text-monitor `a` / `d` (assemble/disassemble) and `x64` ↔ `x64sc`
  mode switching** — both become available the moment the channel opens and both
  were declined by the owner on 2026-09-06 at the milestone open. Not revisited
  here.

### Reviewed Todos (not folded)

Eleven todos matched Phase 39 in the cross-reference scan; one was folded (see
`<decisions>`), and ten were reviewed and left where they are:

- **Reap vicerc scratch dirs in broker kill/recycle path** (score 0.9) — scored
  on keyword overlap with "broker"/"launch" alone. This phase spawns `x64sc`
  directly and touches no broker kill path. Its own phase.
- **Remove pre-warm; launch VICE only on first request** (score 0.9) — same
  cause; a broker-lifecycle change with no bearing on a gate whose probes never
  acquire.
- **BACK-05 D-G ordering test fails deterministically on a live-broker host**
  (score 0.6) — real and load-bearing for this phase's *practice* (`D-16` names
  it as a working rule), but fixing the test is not in `CHAN-01`'s requirement
  set. Phase 33 declined it on exactly this ground.
- **Correct the false real-corpus claim in `research/questions.md`** (score 0.6)
  — no corpus is involved in this phase at all.
- **WR-03 — `host-tool.mts`'s "nothing throws" contract has two holes** (score
  0.6) — the host-tool seam is Phase 40's integration surface, not this one's.
- **Consolidate all tool-written files under `.c64-re-tools`** (score 0.6) — a
  path-layout change; this phase writes evidence under `.planning/` and fixtures
  under `src/mcp/vice/fixtures/`, both already settled locations.
- **Installer must self-ignore its deployed `tools/` in the consumer repo**
  (score 0.6) — packaging, unrelated.
- **Move all tests into a separate test folder** (score 0.6) — a tree-wide
  refactor; `D-19` adds one test file in the existing colocated convention and
  should not be the wedge for changing it.
- **Phase 28 review: `in-02` fsync portability on Windows** (score 0.6) and
  **Phase 28 review round 3, five open findings** (score 0.6) — annotation-store
  review findings from v0.7.0; no relation to this phase's domain.

</deferred>

---

*Phase: 39-The Dual-Channel Coexistence Gate (Go/Degrade/No-Go)*
*Context gathered: 2026-09-07*
