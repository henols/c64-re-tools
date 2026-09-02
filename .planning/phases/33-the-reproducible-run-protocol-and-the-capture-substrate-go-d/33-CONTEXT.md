# Phase 33: The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go) - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Three deliverables plus the milestone's first real measurement.

1. **A reproducible-run protocol.** Launch nondeterminism pinned on the stock
   branch (`-seed` plus the three `raminit*` flags, after `-default`, fork argv
   untouched); the monitor-issued hard reset inside **one named single-seam
   procedure** reached through an optional argument on `vice_run_until`; a
   stop-identity oracle of `(PC, hit_count, (LIN, CYC))` with a frame-anchor
   checkpoint supplying the frame term; warp and headless as **additive**
   launch knobs.
2. **A capture substrate.** A flat 64K image sliced out of a VICE `.vsf`
   snapshot's `C64MEM` module body with **no transcription step anywhere**, and
   a committed equivalence predicate with an **enumerated** transient allow-list
   under a committed size cap.
3. **A pre-committed go / degrade / no-go gate** (`GATE-01`) with the authority
   to narrow or cancel Phases 34-38.

Plus `CAP-04`: every `REPRO-*` probe ran at the KERNAL `READY` prompt over the
now-excluded text channel, so the protocol is **re-instrumented over
`-binarymonitor`** on an **autostarted** real cracked release with true drive
emulation in the loop, and re-measured here.

Covers `REPRO-01`..`REPRO-05`, `CAP-01`..`CAP-04`, `GATE-01`.

**The two halves are parallel.** The `.vsf` slicer touches no emulator and is
independent of the stop; it runs as a concurrent plan, not behind one.

**Not in this phase:** absolute cycle count (`stopwatch` excluded by owner
decision 2026-09-02; `CPUHISTORY_GET` needs VICE >= 3.10 and this host runs
3.9), the text-monitor client, the accumulating runtime-evidence layer, any
`DXA-*` / `GHID-*` / `OPC-*` / `AUTO-*` work, and the host-tool execution seam
(Phase 34).

</domain>

<decisions>
## Implementation Decisions

Every decision below is **Claude's discretion** — the owner answered "you
suggest" to the gray-area selection, which under the standing autonomy
preference is a delegation of the whole discussion, not a request for a
narrower menu. Each carries its rationale so a later reader can overturn any
one of them on its own reasoning rather than on trust.

### The gate (`GATE-01`)

- **D-01: The decision rules are plan `33-01`, and that plan touches nothing
  else.** Every measuring plan comes after it. **Git history is the proof** —
  the rules commit precedes the first measurement commit and is checkable with
  `git log`; no test guard. This is Phase 9's shape and Phase 23's `D-07`,
  reused because it worked twice: Phase 9's `R4` returned `degrade` and Phase
  23's `R1` returned `no-go`, both correctly, both five-plus plans before the
  measurements they gated existed.
  — **Reversibility:** one-way — once a measurement has been committed, the
  rules can never again be shown to predate it. Ordering is the entire
  mechanism.

- **D-02: The gate takes exactly five named, machine-readable inputs, four of
  which are measurable before any corpus exists.**

  | Input | Domain | Source |
  |---|---|---|
  | `SEED_EFFECT` | `pinned` \| `partial` \| `unpinned` | `REPRO-01` — differing-address count over an untouched window, without vs. with the determinism block |
  | `JITTER_IMMUNITY` | `immune` \| `partial` \| `not-immune` | `REPRO-02` — the 0 / 1500 / 4000 ms triple under the protocol |
  | `ORACLE_NECESSITY` | `proven` \| `unproven` | `REPRO-03` — the control in which `(LIN, CYC)` alone **passes** on two stops one frame apart |
  | `SLICER` | `validated` \| `failed` | `CAP-01` + `CAP-02` — the slice, and the planted-byte control failing |
  | `C0_CAPTURE_PAIR` | `pass` \| `fail` \| `not-obtained` | `CAP-04` — a real release captured twice, against `CAP-02`'s predicate |

  The first four need no corpus. `not-obtained` is an **input value**, never a
  reason to abstain. This is the specific defect Phase 23's gate carried
  (every one of its inputs needed a corpus, so `could-not-run` was reachable),
  and the ROADMAP names removing it as this gate's distinguishing property.
  — **Reversibility:** costly — the input set is what the rules are written
  against; adding a sixth input after the rules are committed re-opens the
  pre-commitment question for the whole gate.

- **D-03: `could-not-run` is not an emittable verdict of this gate, and that is
  asserted structurally rather than stated in prose.** The verdict field's
  accepted values are exactly `go` / `degrade` / `no-go`; a rule evaluator that
  cannot resolve to one of the three is a bug in the rules, not an outcome.
  — **Reversibility:** one-way — a gate that abstained once has already failed
  to be a gate; the assertion is what makes the improvement over Phase 23 real
  rather than intended.

- **D-04: `degrade` narrowing is pre-mapped for `C0_CAPTURE_PAIR` and
  `ORACLE_NECESSITY` only.** Phase 23's `D-09` shape, retargeted at the two
  inputs where a mapping written *after* seeing the numbers would be most
  suspect — one depends on a corpus that may not arrive, the other is the
  criterion the ROADMAP explicitly says must be *observed* rather than argued.
  Pre-mapped, in `33-01`, while the answers are unknown:
  - `C0_CAPTURE_PAIR: not-obtained` → **Phase 38 narrows to method-only** (it
    re-records the same `could-not-run` its predecessor did, for the same named
    reason), and Phases 35 / 36 / 37 lose their real-image exercise and narrow
    to fixture-only. The `REPRO-*` / `CAP-01` / `CAP-02` substrate is
    **untouched** by this branch — it was measured without a corpus.
  - `ORACLE_NECESSITY: unproven` → the oracle narrows to the two-term
    `(PC, hit_count)` form with the frame term **recorded but not asserted**,
    and every downstream capture pair carries that weakening in its record.

  `SEED_EFFECT`, `JITTER_IMMUNITY` and `SLICER` get their narrowing authored at
  verdict time against the evidence, Phase 9 style — each yields a plain
  enumerated value with no interpretive step.
  — **Reversibility:** costly — a pre-mapped narrowing that fits badly can be
  superseded at verdict time, but only by recording the override explicitly,
  which weakens the pre-commitment it exists to provide.

- **D-05: The verdict is machine-readable frontmatter in
  `docs/phase33-reproducible-run-gate-findings.md`** — `verdict: go|degrade|no-go`,
  `verdict_rule_applied: R<N>`, plus all five `D-02` inputs reproduced
  verbatim as frontmatter fields. The document reproduces the full rule and
  walks the actual outcome values through it, so a reader mechanically
  re-derives the verdict rather than taking it on trust. Mirrors
  `docs/phase23-real-release-gate-findings.md`.
  — **Reversibility:** reversible.

- **D-06: The verdict binds Phases 34-38 through ROADMAP `Depends on` + Notes +
  a STATE.md pointer, with no test guard.** Phase 23's `D-08`, which closed
  Phase 9's criterion 5 the same way. A guard would encode roadmap policy in a
  suite belonging to a phase that ships almost no product code, and the
  likeliest outcome (`degrade` — proceed, narrowed) is exactly the case such a
  guard cannot check. All five downstream phases already name Phase 33 in their
  `Depends on` lines.
  — **Reversibility:** reversible — a guard can be added later if the pointer
  proves insufficient.

### Evidence and the red controls

- **D-07: Each "observed red" control is a committed evidence transcript in the
  phase findings document, produced by a named repeatable script — not a
  test-suite assertion.** Five controls are demanded by the success criteria
  (no-seed divergence; the reset removed from the protocol; `(LIN, CYC)` alone
  passing one frame apart; a byte planted outside the allow-list; the
  wall-clock-anchoring negative control at `LIN` 116 / 223 / 267, plus the
  warp-invalidated wall-clock bracket timing out spuriously). A control whose
  entire purpose is to be **red** cannot live in a suite whose contract is to
  be green, and the corpus-dependent ones cannot run on a machine without the
  corpus at all.
  — **Reversibility:** reversible.

- **D-08: `MANUAL_ONLY_TESTS` stays at exactly nine files.** `D-07` is chosen
  partly so this holds. If a live frame-exact suite is nevertheless written,
  its file is added to `MANUAL_ONLY_TESTS` **and** to the nine-file
  `assert.deepEqual` in `test-gate.test.ts` **in the same commit** — never left
  to a later pass. That list is one of this milestone's five reviewed
  decisions; a live suite not added to it silently runs inside `test:automated`
  and fails on every machine without the corpus. Default expectation for this
  phase: **zero** new entries.
  — **Reversibility:** costly — the two-directional gate (`automatedTestFiles()`
  ∪ `MANUAL_ONLY_TESTS` must equal the on-disk set exactly) means a file added
  to one side and not the other reds the suite immediately.

- **D-09: Two things that *are* corpus-free and must not regress do become
  automated tests**, and only these two: `CAP-03`'s structural bar (`D-22`) and
  `CAP-02`'s fail-ability over a synthetic pair (`D-21`). Everything else in
  this phase's evidence is a transcript.
  — **Reversibility:** reversible.

- **D-10: Evidence scripts are evidence, not deliverables**, and live under the
  phase directory rather than in `src/`. Phase 23's standing precedent
  ("throwaway scripts are evidence, not deliverables"). The two exceptions are
  the slicer and the predicate — `CAP-01` and `CAP-02` are requirements, so
  those ship in the tree (`D-15`).
  — **Reversibility:** reversible.

- **D-11: Every live run in this phase is taken with the broker stopped**, and
  each evidence transcript records that fact alongside the `test:automated`
  baseline it was taken against (clean floor: **0** failures; `npm test` is not
  used — the whole-glob run does not terminate unaided). A live broker reddens
  the `BACK-05` assertion deterministically, so a phase measuring against a
  live-broker run reads a false baseline and every number in it is suspect.
  — **Reversibility:** one-way — a measurement taken against a contaminated
  baseline cannot be repaired afterwards; it has to be discarded and re-run.

### The run-protocol surface

- **D-12: The protocol is an optional boolean `reproducible` argument on
  `vice_run_until`, stock-only, defaulting to absent.** The procedure itself is
  `runReproducible()` in a new `src/mcp/vice/stock-reproducible-run.ts`, called
  from `stock-run-until.ts` — one named seam, one call site. The fork backend
  does **not** advertise it: the compatibility rule permits stock to add
  optional parameters, the fork's tool list is frozen byte-identical from
  v0.1.x, and `fork-manifest-surface.test.ts` guards that.
  — **Reversibility:** costly — the argument name becomes part of the stock
  tool surface the skills are written against; renaming it later means editing
  the manifest, the conformance tests and every playbook that names it.

- **D-13: The knob is a whole-procedure switch, never a set of composable
  sub-flags.** No `skip_reset`, no `no_anchor`, no `reset_only`. The
  reset-removed control (`D-07`) is produced by an **evidence script that calls
  the protocol's pieces directly**, not by a shipped argument — shipping a
  "protocol without the reset" option would ship exactly the second route
  `REPRO-02` exists to prevent a caller forgetting.
  — **Reversibility:** one-way — once a sub-flag is published, a caller
  depends on it and the single-seam property is gone for good.

- **D-14: `reproducible: true` requires a sibling `frame_anchor` address, and
  refuses when it is absent.** The frame-anchor checkpoint is armed by the
  procedure, not by the caller — but its once-per-frame site is
  release-specific (a cracked release almost always takes over the IRQ, so no
  KERNAL default such as `$EA31` is safe to guess). Refusing with an error that
  names *why the frame term cannot be supplied* beats silently degrading to a
  two-term oracle, which is the precise weakening `REPRO-03` guards against.
  This does not violate the compatibility rule: the requirement is conditional
  on an argument that itself defaults to absent, so no existing call shape
  changes.
  — **Reversibility:** costly — relaxing it later is easy; tightening it later
  is not, because by then captures certified under the two-term oracle exist.

- **D-15: Warp and headless are an additive optional `profile` object on the
  broker's existing `acquire` control op** — `{op:"acquire", id, token,
  profile:{warp?:true, headless?:true}}`. An absent `profile` produces argv
  **byte-identical to today's**, which keeps the three whole-argv
  `assert.deepEqual` assertions in `broker-launch.test.ts` green, keeps
  `-default` at index 0 ahead of `-binarymonitor`, and leaves the fork branch's
  argv untouched (a Validated v0.2.0 requirement, not merely a test).
  — **Reversibility:** reversible — the field is additive and absent by
  default.

- **D-16: A pre-warmed instance whose profile does not match the request is
  ineligible; the broker launches a dedicated instance for that grant and never
  retro-warps.** Not "refuse the acquire" (that would make warp unusable
  whenever a warm floor exists) and not "serve it unwarped" (that would make
  the knob a lie the caller cannot detect). The warm floor keeps serving
  profile-less acquires exactly as it does today. Warp is a **per-instance**
  property — this is the warm-instance-eligibility half of the headless/warp
  todo, and it is folded here rather than deferred.
  — **Reversibility:** costly — eligibility is inside the acquire path the
  single-owner `inFlight` launch guard protects; changing the rule later means
  re-reasoning about that guard, which exists because of a real triple-launch
  outage.

- **D-17: The stale warp sentence is re-grounded to say both things, and
  `docs/tool-support.md` is regenerated in the same commit.**
  `capability-registry.ts` states, inside `vice_machine_config_set`'s reason,
  that warp on stock is launch-time and not runtime-togglable. That is
  **factually wrong about VICE** (runtime `warp` / `warp on` / `warp off` were
  refuted live on 2026-08-27) and **operationally correct for this milestone**
  (runtime toggling lives only on the excluded text channel). The replacement
  says both: no runtime `WarpMode` resource exists, and runtime toggling exists
  only on the text monitor, which this project does not dial. The docs table is
  generated from the registry under a **byte-identity drift guard**, so
  splitting the edit across two commits reds it.
  — **Reversibility:** reversible.

- **D-18: `probeReady`'s real-time timeouts are re-checked under warp in the
  same plan that adds the profile.** `REPRO-05` names this, and a warp launch
  that boots an order of magnitude faster is exactly where a wall-clock
  readiness probe misjudges — the same class of error as the
  wall-clock-anchoring negative control this phase is required to observe red.
  — **Reversibility:** reversible.

### The capture substrate

- **D-19: The `.vsf` slicer is a container-side module in the shipped tree** —
  `src/mcp/vice/vsf-slice.ts` — with a thin wrapper script under
  `src/skills/c64-ram-capture/scripts/`. It **reads a file and spawns nothing**,
  and `vice_snapshot_save` already writes through `stock-paths.ts`'s single
  translation wrapper via `snapshotPathFor()`, so the snapshot is
  container-visible by construction. **No host-tool execution seam is needed** —
  Phase 34's seam is for external binaries, and this is not one.
  — **Reversibility:** reversible.

- **D-20: The slicer is not promoted to an MCP tool in this phase.** `CAP-01`
  requires only that a flat 64K image is *produced* by slicing with no
  transcription; a skill script imports the module directly. Leaving it out of
  the manifest keeps the stock tool surface, its conformance tests and the
  fork/stock parity tables untouched in a phase that already breaks several
  guards.
  — **Reversibility:** reversible — promoting it later is additive.

- **D-21: The slicer locates `C64MEM` by walking the snapshot's module table,
  never by a fixed byte offset**, and asserts the module body is exactly
  `4 + 65536` bytes, refusing otherwise. A fixed offset is fragile across VICE
  builds and would silently produce **garbage rather than an error** — the worst
  available failure mode for the substrate every downstream number is measured
  on.
  — **Reversibility:** costly — a capture corpus produced by an offset-based
  slicer would have to be entirely re-derived to be trusted.

- **D-22: The transient allow-list is a per-release committed JSON artifact
  derived by a named script, under a committed size cap of 64 addresses.**
  Rationale for 64: the only measurement in hand is 3 transients out of 1024
  addresses at the `READY` prompt, and that is an upper bound taken under
  frame-divergent conditions. A real release adds its own frame counters, RNG,
  sprite positions and music-player pointers — tens, not hundreds. 64 sits an
  order of magnitude above the only measured value and at a quarter of the page
  the requirement names as over-wide. **Exceeding the cap is a hard failure
  that voids the derivation**, not a warning: it means the stop is not
  frame-exact, and that is a fact the gate must hear rather than a threshold to
  raise.
  — **Reversibility:** costly — the cap is a pre-commitment like the rules;
  raising it after seeing a derivation overflow converts a measurement into an
  excuse.

- **D-23: The derivation method, not any address set, is what carries
  forward.** Committed method: N >= 3 runs of the same release under the same
  protocol at the same stop; the allow-list is the **union of addresses
  differing across the pairwise comparisons**; each entry records the address,
  which run pairs it differed in, and a one-line attribution where known. It is
  **re-derived per release** and no address set is ever inherited between
  releases. Three runs is already this project's documented minimum for a
  verified capture.
  — **Reversibility:** costly — an allow-list inherited across releases cannot
  be distinguished afterwards from one honestly derived, so a contaminated
  ledger has to be re-derived from fresh captures.

- **D-24: The `$0000`/`$0001` 6510-port overlay is normalised inside the
  predicate, in code**, by substituting the snapshot's own 4-byte port/PLA
  prefix over RAM `$0000`/`$0001` before comparison. Explicitly **not** by
  adding those two addresses to the allow-list — that would spend two of the
  cap's 64 slots to hide a divergence that might be real.
  — **Reversibility:** reversible.

- **D-25: The planted-byte control is asserted red twice, at two different
  costs.** Corpus-free, in CI: an automated test plants a byte outside the
  allow-list in a **synthetic pair of fixture buffers** and asserts the
  predicate fails — so `CAP-02`'s fail-ability is guarded on every run, on any
  machine. Corpus-bound, as a transcript: the same plant on the real capture
  pair, recorded per `D-07`.
  — **Reversibility:** reversible.

- **D-26: `CAP-03`'s structural bar is an automated test, not prose.** It
  asserts that the predicate module never imports the oracle module and that
  the oracle's comparison function takes no image-buffer argument — so the
  captured 64K is barred by *shape* from becoming a conjunct of the stop-identity
  oracle, and the next edit cannot reintroduce the circularity. Note the
  grep-census hazard when writing it: at least one source file in this tree
  (`anno-memmap-render.ts`) contains a NUL byte and is invisible to a plain
  `grep` — use `grep -a` for any census, or the test silently under-covers.
  — **Reversibility:** one-way — a circularity that has already certified a
  capture cannot be laundered out of that capture's record.

- **D-27: Corpus is one operator-supplied real cracked release, as a `.d64` or
  `.prg`, identified by name **and sha256**, never committed.** Phase 23's
  `D-04`, carried unchanged. `CAP-04` asks for "a real cracked release ...
  captured twice" — singular — so a second release is a **stretch input**, not
  a requirement, and its absence is not a shortfall. The release is autostarted
  with true drive emulation in the loop, which is also the condition under which
  `default_memspace` contamination becomes reachable rather than theoretical
  (`D-28`).
  — **Reversibility:** reversible.

- **D-28: The main-CPU memspace assertion is proven able to refuse, by
  observation.** A drive checkpoint hit sets `default_memspace`
  (`monitor.c:3393-3396`) and no binary-monitor command resets it, after which
  `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the **drive** CPU and
  `@bank:` conditions fail outright. The evidence is a transcript of the
  assertion refusing after one deliberate drive checkpoint hit — not a unit
  test, because the contaminated state has no synthetic equivalent worth
  trusting.
  — **Reversibility:** reversible.

- **D-29: The capture record gains `REPRO-04`'s reproducibility key as three
  new rows in its Identity table** — `binary sha256`, `argv digest`, `seed` —
  where the argv digest is a sha256 over the exact spawn argv array joined by
  NUL. The template quotes the measured counterexample (same seed, reordered
  argv, **76-byte-different image**) inline, so a reader cannot reduce the key
  to the seed alone by inattention. Template:
  `src/skills/c64-ram-capture/templates/capture-record.template.md`.
  — **Reversibility:** costly — captures recorded under the old two-field
  identity cannot be retro-keyed, so any pre-existing record is
  non-reproducible by definition.

### Claude's Discretion

All 29 decisions above are Claude's discretion, under the owner's "you suggest"
delegation of the whole discussion. The three most consequential — and therefore
the three most worth a second look before `33-01` is committed — are:

- **D-04** (which two inputs get pre-mapped narrowing). Getting this wrong
  means a `degrade` verdict whose narrowing was authored after the numbers were
  visible, which is the failure mode the gate exists to prevent.
- **D-22** (the size cap of 64). The number is reasoned from a single
  measurement taken under different conditions. It is a pre-commitment, so it
  cannot be revised upward later without cost.
- **D-14** (refusing when `frame_anchor` is absent). This is the one decision
  that makes the tool harder to call, deliberately.

### Folded Todos

Three pending todos are folded into this phase's scope. All three carry
`resolves_phase: 33`.

- **Extract flat 64K from VICE snapshots instead of transcribing hex**
  (`.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`)
  — the transcription step is the error source `CAP-01` removes. Discharged by
  `D-19`/`D-21`.
- **Frame-exact emulator stop is the single gate on a real corpus, and nothing
  owns it**
  (`.planning/todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md`)
  — this phase is the owner. Discharged by `REPRO-02`/`REPRO-03` and `D-12`..`D-14`.
- **Run VICE headless and in warp mode when the run allows it**
  (`.planning/todos/pending/2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md`)
  — including the acquire-frame and warm-instance-eligibility half. Discharged
  by `D-15`/`D-16`.

Note the two-directional guard: `docs-deferred-ledger.test.ts` fails in **both**
directions, so resolving any of these three requires moving its `STATE.md` row
in the same commit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` (Phase 33 entry, lines ~740-771) — the five success
  criteria and eight Notes; the Notes carry MEASURED numbers that are not
  repeated anywhere else
- `.planning/REQUIREMENTS.md` §"v0.8.0 Requirements" — `REPRO-01`..`REPRO-05`,
  `CAP-01`..`CAP-04`, `GATE-01` verbatim with their MEASURED evidence
- `.planning/PROJECT.md` — milestone framing and the core-value statement
- `.planning/STATE.md` — current position, the deferred ledger rows, and the
  archival decision that keeps 28 phase directories in place

### The gate pattern (precedent that fired twice)
- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-CONTEXT.md` —
  `D-04` (corpus supply), `D-07` (rules in their own early plan, git order as
  proof), `D-08` (verdict binds through ROADMAP+STATE, no test guard), `D-09`
  (partial pre-mapping of `degrade`), `D-10` (verdict frontmatter shape). Four
  of the five are carried forward here
- `docs/phase23-real-release-gate-findings.md` — the `no-go` verdict document
  whose frontmatter shape `D-05` mirrors, and the `could-not-run` outcome
  `D-02`/`D-03` exist to prevent recurring

### Protocol and stock-backend facts
- `docs/phase0-binmon-findings.md` §5 — the settled normative protocol: 11-byte
  request header / 12-byte response header, little-endian, confirmed opcode set
  and error codes
- `docs/stock-vice-parity.md` — what is CUT from the stock surface and why;
  read before assuming any tool exists on stock
- `docs/tool-support.md` — **generated** from `capability-registry.ts` under a
  byte-identity drift guard; never hand-edit, always regenerate in the same
  commit as the registry (`D-17`)
- `CLAUDE.md` §Constraints — the five unsolicited message types, `JAM`'s
  zero-length body, the synchronous `CHECKPOINT_INFO` from inside the CPU loop,
  single-client-per-instance, `default_memspace` contamination, the wire
  memspace byte mapping, `RL`/`CY` condition pseudo-registers with no operator
  precedence, and the three power-cycling resources

### Code seams this phase edits
- `src/mcp/vice/stock-run-until.ts` — the tool `D-12`'s optional argument lands
  on; read its "WHAT NOT TO DO" header first (three cleanup paths, exactly one
  resume per wait, no second wire-error converter)
- `src/mcp/vice/broker-launch.mts` (`buildViceArgs()`, ~lines 170-216) — the
  argv builder; `-default` at index 0, `-drive8type 1541` immediately after,
  `-binarymonitor` after that. The determinism block and the `profile` knobs go
  on the **stock branch only**
- `src/mcp/vice/broker-control.mts` (`ControlRequestKind`, the `acquire`
  handler at ~line 534) and `src/mcp/vice/vice-broker-client.ts`
  (`acquireOverControlPlane()`, `openBrokerControl().acquire()`) — where
  `D-15`'s optional `profile` field is threaded
- `src/mcp/vice/stock-machine.ts` (`vice_snapshot_save`) and
  `src/mcp/vice/stock-paths.ts` (`snapshotPathFor()`) — how the `.vsf` reaches
  a container-visible path, which is why `D-19` needs no host-tool seam
- `src/mcp/vice/capability-registry.ts` — the stale warp sentence `D-17`
  re-grounds
- `src/mcp/vice/vice-sync.ts` — the documented checkpoint-wait invariants
  (exactly one resume per wait; poll on `hit_count`, never on paused state)
  that `D-12`'s procedure must preserve in its stock-native form

### Capture substrate
- `src/skills/c64-ram-capture/SKILL.md` — the existing capture procedure, the
  three-run minimum, the `$D000-$DFFF` volatility rule, and the void protocol
- `src/skills/c64-ram-capture/templates/capture-record.template.md` — the
  record `D-29` extends with the reproducibility key
- `src/skills/c64-ram-capture/scripts/compare.mjs` — existing `digest`,
  `compare` and `floor` verbs the predicate builds beside
- `src/skills/c64-ram-capture/RELEASES.json.example` — the release-registry
  shape `D-27`'s corpus identification uses

### Guards this phase must not red
- `src/mcp/vice/test-gate.test.ts` — `MANUAL_ONLY_TESTS` is exactly nine files
  and the union with `automatedTestFiles()` must equal the on-disk set exactly
  (`D-08`)
- `src/mcp/vice/broker-launch.test.ts` — three whole-argv `assert.deepEqual`
  assertions, kept green by `D-15`'s absent-by-default field
- `src/mcp/vice/fork-manifest-surface.test.ts` — the fork tool list is frozen;
  `D-12` is stock-only because of it
- `src/mcp/vice/resources-sync.test.ts` + `build.ts`'s `HOST_BOUND_ARTIFACTS` —
  fails in both directions, and `build.ts` **throws** on an unlisted host-bound
  `.mts`. Any new launcher module must be added to both
- `docs-deferred-ledger.test.ts` — fails in both directions; the three folded
  todos each need their `STATE.md` row moved in the resolving commit
- `docs-linerefs.test.ts` — mechanically checks the two `rewriteArguments()`
  citations in `CLAUDE.md`

### Folded todos
- `.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`
- `.planning/todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md`
- `.planning/todos/pending/2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`stock-run-until.ts`** — already arms a temporary stopping exec checkpoint,
  resumes exactly once, and takes three distinct cleanup actions (hit / timeout
  / machine-restarted). `D-12`'s procedure wraps this, it does not replace it.
- **`vice_snapshot_save` (`stock-machine.ts`)** — already writes a whole-machine
  `.vsf` on stock, through `stock-paths.ts`'s single translation wrapper. The
  slicer's input therefore already exists; `CAP-01` is a reader, not a producer.
- **`compare.mjs` (`digest` / `compare` / `floor`)** — the equivalence predicate
  extends this rather than starting a second comparison vocabulary. Its existing
  volatile / drift / divergence classification is the shape `CAP-02`'s verdict
  should keep.
- **`capture-record.template.md`** — the per-capture record `REPRO-04`'s key
  attaches to; it already carries sha256, `$01`, video standard, registers and
  the void protocol.
- **`broker-control.mts`'s newline-delimited JSON control protocol** — seven ops
  today, each `{op, id, token, ...}`. `D-15` is an eighth field on one existing
  op, not an eighth op.

### Established Patterns
- **Single seam per concern.** Every cross-cutting responsibility has exactly
  one owning file, and re-deriving it locally is a named anti-pattern. `D-12`'s
  `runReproducible()` and `D-24`'s in-code port normalisation both follow it.
- **Optional-and-absent-by-default is how this tree adds a field without
  breaking a frozen contract.** `broker-launch.mts`'s `backend?: ViceBackend`
  is the worked precedent: omitting it reproduces byte-identical fork argv, and
  every pre-existing 2-arg caller and test stub keeps compiling. `D-15` copies
  it exactly.
- **Generated-but-committed artifacts under drift guards.** `resources/*.mjs`
  from `.mts` sources, and `docs/tool-support.md` from `capability-registry.ts`.
  Both fail in both directions; regenerate in the same commit as the source.
- **Structured "WHAT NOT TO DO" file headers naming the specific past mistake.**
  New modules (`stock-reproducible-run.ts`, `vsf-slice.ts`) are expected to
  carry one.
- **Throwaway probe scripts are evidence, not deliverables** (Phase 23). `D-10`
  applies it here.

### Integration Points
- `vice_run_until` (stock dispatch) → `runReproducible()` → the existing
  checkpoint arm / resume / wait primitives in `stock-protocol.ts`.
- Broker `acquire` (control plane) → warm-floor eligibility check (`D-16`) →
  `buildViceArgs()`'s stock branch (`D-15`, plus `REPRO-01`'s determinism
  block).
- `vice_snapshot_save` → `snapshotPathFor()` → `vsf-slice.ts` → the equivalence
  predicate → the capture record → `GATE-01`'s `C0_CAPTURE_PAIR` input.
- `GATE-01`'s verdict document → ROADMAP `Depends on` lines of Phases 34-38 +
  STATE.md pointer.

</code_context>

<specifics>
## Specific Ideas

- **The gate's distinguishing property, stated as the thing to check against
  every rule draft:** Phase 23's gate could return `could-not-run` because
  every input needed a corpus. This one must not be writable in a way that lets
  it abstain. If a draft rule cannot be evaluated without `C0_CAPTURE_PAIR`,
  the draft is wrong.
- **`-record` / `-recordevents` does not exist.** MEASURED 2026-09-02: `event.c`
  registers exactly six event options and none is a recording flag; `x64sc
  -record` returns `Unknown option`, exit 255; `event_record_start()` has no
  non-UI caller; no binary-monitor opcode addresses it. The trap that makes the
  belief plausible is that the text monitor's `record` / `playback` are monitor
  command **file scripting**, not event history. Do not spend a research pass
  rediscovering this.
- **Phase 0's Route B reconstructed clock is deliberately not revived** — an
  incidental measurement put it at 19,657 cycles/frame against Phase 0's
  documented 19,656, a 1-cycle-per-frame accumulating error.
- **The `.vsf` slicer is already validated against 23-03's own hand-transcribed
  hex:** two 8 KB chunks byte-identical, one differing only at `$0000`/`$0001`,
  and the fourth localising ten dropped characters to `$7871` — which is the
  transcription error `CAP-01` exists to eliminate.

</specifics>

<deferred>
## Deferred Ideas

- **Absolute-cycle stop identity** — an optional strengthening of `REPRO-03`
  via `CPUHISTORY_GET` (0x86), already recorded as deferred in
  `.planning/REQUIREMENTS.md`. Blocked by the VICE 3.10 floor; this host runs
  3.9. `stopwatch` is excluded by name (owner decision 2026-09-02).
- **Promoting the `.vsf` slicer to an MCP tool** — additive, decided against
  for this phase by `D-20`. Revisit once a second consumer exists.
- **A second corpus release** — a stretch input under `D-27`, not a
  requirement. Would strengthen `D-23`'s claim that the derivation *method*
  generalises.
- **A test guard on the gate's downstream binding** — deliberately declined by
  `D-06`; a guard can be added later if the ROADMAP+STATE pointer proves
  insufficient.

### Reviewed Todos (not folded)

Seven todos matched Phase 33 in the cross-reference scan and were reviewed but
not folded:

- **Reap vicerc scratch dirs in broker kill/recycle path** (score 0.9) —
  broker hygiene, unrelated to reproducibility or capture. Its own phase.
- **Phase 7 Pitfall 5 overgeneralizes "text monitor unreachable"** (score 0.9)
  — a docs correction about the excluded text channel; this milestone's scope
  decision keeps that channel out, so correcting the pitfall changes nothing
  here.
- **BACK-05 D-G ordering test fails deterministically on a live-broker host**
  (score 0.6) — real and load-bearing for this phase's *practice* (`D-11`
  names it as a working rule), but fixing the test is not in this phase's
  requirement set.
- **Correct the false real-corpus claim in `research/questions.md`** (score
  0.6) — will be resolved incidentally when `CAP-04` produces a real corpus, or
  invalidated if it does not. Left where it is so the correction is made
  against the actual outcome.
- **Ghidra headless one-command 6502 decompile wrapper — proposal** (score
  0.6) — carries `resolves_phase: 36`.
- **Phase 28 review: `in-02` fsync portability on Windows** (score 0.6) and
  **Phase 28 review round 3, five open findings** (score 0.6) — annotation-store
  review findings from v0.7.0; no relation to this phase's domain.

</deferred>

---

*Phase: 33-The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go)*
*Context gathered: 2026-09-02*
