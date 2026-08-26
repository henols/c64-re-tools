# Phase 23: The Real-Release Gate (Go/Degrade/No-Go) - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A measurement probe plus a recorded verdict. **Nothing here builds product** —
the Phase 9 shape exactly (8 plans, zero product code). Throwaway scripts are
evidence, not deliverables.

The phase re-measures the four claims behind the dxa+Ghidra pivot against real
cracked code rather than the one 279-byte self-authored fixture, and emits a
machine-readable `go` / `degrade` / `no-go` against decision rules committed
**before** the measurements were run. Phase 24's planner reads that verdict as a
precondition.

Covers `PROOF-01`..`PROOF-05`. Nothing downstream (Phases 24, 25, 26) may be
planned before this phase closes.

</domain>

<decisions>
## Implementation Decisions

### Instruments (what this phase is allowed to use)

- **D-01: regenerator2000 is excluded entirely.** No r2000 binary, no
  `r2000-coverage.ts` structural census, no r2000 output as an oracle, a
  baseline or a screening tool anywhere in this phase. It is `CUT-01` scope and
  is being deleted in Phase 25; building the gate on the thing being removed
  would make the gate worthless the moment the cutover lands. This overrides the
  otherwise-tempting reuse of `r2000-coverage.ts`'s widened
  `scanIndirectDispatch()`. *(User decision, verbatim intent: "Don't use r2000
  for anything, it has to be removed.")*
  — **Reversibility:** reversible — nothing is built on the exclusion; it only
  narrows which tools a probe plan may invoke.

- **D-02: VICE is how the code of interest is reached.** Navigate to the region
  under study in the running emulator rather than analysing whatever the file
  statically happens to contain. *(User decision: "let's use VICE to go to the
  code where we are interested in reverse engineering".)*
  — **Reversibility:** reversible.

### What gets measured, and on what

- **D-03: dxa and Ghidra are measured on a depacked flat 64K RAM capture**, not
  on the shipped file. Route: autostart the release in VICE → run past the
  loader/depacker → break at a checkpoint → capture flat 64K via
  `c64-ram-capture`. Rationale: a packed payload is high-entropy bytes, so a
  data-recovery percentage taken on the shipped `.prg` measures the packer's
  output, not game code. This also matches the milestone's own standing
  decision that depack-by-running is sufficient and no unpacker is in scope.
  — **Reversibility:** costly — the capture is the substrate every subsequent
  measurement in the phase reads; changing it invalidates criteria 1-3's numbers
  and forces a re-run of the whole measuring sequence.

- **D-04: The corpus is operator-supplied, as a `.d64` disk image or a `.prg`.**
  Not fetched from public archives by the phase, and not another self-authored
  fixture. The binary is identified in the verdict by release name/id **and
  sha256** so the numbers stay auditable without committing the image.
  — **Reversibility:** reversible.

  *Note on how this was reached:* the first answer was "corpus absence is the
  verdict" — record no-corpus-obtainable as a gate input and let the rule fire.
  On being shown that this conflicts with D-03 and predetermines the outcome
  before the rules exist (which the ROADMAP explicitly forbids: "write the rules
  before you have the answers"), it was revised to supplying an image. The
  absence branch is **not** dead: it stays as a rule input for whatever the
  supplied corpus turns out not to contain — see D-05.

- **D-05: Inventory first, reject nothing.** Before any measurement runs, scan
  the depacked capture and commit what it actually contains — computed-index
  dispatches found, `$01` writes found, at which addresses. That inventory is a
  fact about the corpus recorded *ahead* of the measurements. Nothing is
  rejected for lacking a construct, so there is no selection bias to declare;
  "not exercised" becomes a **pre-declared corpus property** the decision rule
  keys on, rather than a post-hoc excuse. Criteria 2 and 3 both already permit
  "not exercised" as an honest outcome — this makes that outcome earned.
  — **Reversibility:** costly — the inventory's pre-commitment is the thing that
  makes criteria 2 and 3 credible; producing it after measuring destroys the
  property and cannot be repaired by re-ordering documents.

- **D-06: The inventory is produced by VICE runtime observation — never by dxa
  or Ghidra.** Watchpoint `$01` and run: every bank switch is recorded with its
  actual program point and actual value. Checkpoint the dispatch site for
  criterion 2. **This closes a circularity trap:** if either engine under test
  produced the inventory, criterion 2 would degrade to "Ghidra resolved the
  dispatch that Ghidra found", and criterion 3 would inherit the same defect.
  Observation is also strictly better for criterion 3 on its merits — "the point
  at which a single forward-carried `$01` value stops being correct" is a
  question about execution paths, and a watchpoint answers it directly where
  static inference only guesses.
  — **Reversibility:** one-way — a criterion-2 result produced from a
  self-supplied inventory cannot be laundered into a valid one afterwards; the
  measurement would have to be discarded and re-run from a fresh capture.

### The verdict and its pre-commitment

- **D-07: The decision rules live in their own early plan (23-01), which touches
  nothing else.** Every measuring plan comes after it. **Git history is the
  proof** — the rules commit precedes the first measurement commit and is
  checkable with `git log` by anyone, no test required. This is Phase 9's shape,
  which the ROADMAP names as the bar. 23-01 also fixes the corpus inventory
  format (D-05), since that is equally a pre-commitment.
  — **Reversibility:** one-way — once a measurement has been committed, the
  rules can never again be shown to predate it. Ordering is the entire mechanism.

- **D-08: The verdict gates Phase 24 through ROADMAP + STATE pointers.**
  Phase 24's `Depends on` and Notes name the verdict file and its frontmatter
  field explicitly; STATE.md points at it too. The planner reads ROADMAP for the
  phase entry as its first act, so the verdict is unavoidable in practice. This
  is how Phase 9 closed its own criterion 5. **No test guard** — it would encode
  roadmap policy in a suite belonging to a phase that ships no code, and the
  likeliest outcome (`degrade`, meaning "proceed, narrowed") is precisely the
  case such a guard cannot check.
  — **Reversibility:** reversible — a guard can be added later if the pointer
  proves insufficient.

- **D-09: `degrade` narrowing is pre-mapped for criteria 2 and 3 only.** The
  rules spell out, up front, what narrows if the computed-dispatch case fails
  and what narrows if path-dependent bank state proves unresolvable — e.g.
  "`AUTO-04`/`AUTO-05` narrow to decline-to-annotate only". Criteria 1, 4 and 5
  get their narrowing authored at verdict time against the evidence, Phase 9
  style. Rationale: criterion 3 is named in the ROADMAP as "the highest-risk
  item on the pivot's own record" and criterion 2 is the case the fixture never
  exercised, so those two are where a mapping written *after* seeing the numbers
  is most suspect. The other three produce a plain number, a capability list, or
  are the rule itself. *(Claude's discretion — see below.)*
  — **Reversibility:** costly — a pre-mapped narrowing that turns out to fit
  badly can be superseded at verdict time, but only by recording the override
  explicitly, which weakens the pre-commitment it exists to provide.

- **D-10: The verdict is machine-readable frontmatter in a durable findings
  document**, mirroring `docs/phase9-regenerator2000-probe-findings.md`:
  `verdict: go|degrade|no-go` plus `verdict_rule_applied: R<N>`. The document
  reproduces the full rule and walks the actual outcome values through it, so a
  reader can mechanically re-derive the verdict rather than take it on trust.
  — **Reversibility:** reversible.

- **D-11: The 279-byte fixture's claims are printed beside the new numbers, not
  replaced by them.** `PROOF-01` is explicit about this, and so is criterion 1:
  a reader must be able to see for themselves whether the fixture flattered the
  tool. The error *direction* is re-measured too — the fixture scored 0 false
  positives against 28% false negatives, and which way the errors run is what
  decides whether Phase 26's graphics-feedback containment is sufficient or
  load-bearing.
  — **Reversibility:** reversible.

### Claude's Discretion

The user answered "you decide" on the `degrade` pre-mapping question (D-09) —
recorded above with its rationale. These were additionally defaulted without
being put to the user, and a planner may revisit any of them on evidence:

- **Ghidra provisioning:** reuse the surviving probe install at
  `~/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` (1.4 GB) rather than reinstalling.
  Its README marks it safe to delete and states nothing in the repo depends on
  the path — so treat the path as an *undeclared external input to this phase*
  and record the version in evidence, not the location.
- **dxa provisioning:** dxa is **not on this host** — the pivot built it in
  `/tmp`, which is tmpfs here, so it is gone. Build 0.1.5 throwaway for this
  phase, but **pin and record the exact version/tarball**, because `DXA-01`
  (Phase 24) vendors it and must vendor the same one the gate measured.
- **`PROOF-04` audit depth:** a source read of `analyzer.rs` (1,506 lines),
  function by function, each matched to a dxa/Ghidra replacement or accepted as
  lost with its cost. **No r2000 execution** (follows from D-01). The source is
  available offline at
  `~/.cargo/registry/src/*/regenerator2000-core-0.9.20/src/analyzer.rs` — no
  network needed.
- **Ghidra pre-scripts:** reuse `BankProbe3.java`'s `getBlock()`-first guard
  pattern verbatim; it exists specifically to stop an unhandled
  `MemoryConflictException` silently falling back to non-volatile.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The claims being re-tested (read first)
- `.planning/notes/dxa-ghidra-pivot.md` — the pivot decision and every number
  this phase exists to re-measure; its "Standing caveat" section is the phase's
  own charter
- `.planning/notes/dxa-ghidra-pivot-evidence/README.md` — file-by-file guide to
  the reproduction material below
- `.planning/notes/dxa-ghidra-pivot-evidence/dxa.out` — the fixture's dxa run
  (`dxa -U -p all-nmos6502 -t detect-all -a enabled`), source of the 72%/0-FP
  claim
- `.planning/notes/dxa-ghidra-pivot-evidence/ghidra3.txt` — 152 code bytes, 17
  functions, 43 typed xrefs, including the `COMPUTED_JUMP` criterion 2 must
  re-test on a *computed* index
- `.planning/notes/dxa-ghidra-pivot-evidence/Decomp.java` — the
  `DecompInterface` export that works; `ExportAnalysis.java` alongside it is the
  listing-layer version that does not, kept as the documented trap
- `.planning/notes/dxa-ghidra-pivot-evidence/BankProbe3.java`,
  `bank.a`, `bank.txt`, `bank3.txt` — the volatile-I/O pre-script and the
  with/without comparison showing silent dead-store deletion of hardware writes
- `.planning/notes/dxa-ghidra-pivot-evidence/fixture.a`, `fixture.lbl` — the
  279-byte fixture and its ground-truth symbols, whose numbers criterion 1 must
  print *beside* the new ones

### Requirements, scope and the gate's own terms
- `.planning/ROADMAP.md` — Phase 23 entry, its five success criteria, and its
  Notes (the Notes are normative here: they name the corpus problem, the
  write-the-rules-first discipline, and the deliberate non-scoping of research
  question 2)
- `.planning/REQUIREMENTS.md` — `PROOF-01`..`PROOF-05`, plus the Out of Scope
  table (no unpacker; `DataTypeManager` named as the most expensive available
  mistake)
- `.planning/research/questions.md` — both open research questions. **Carries a
  known factual error**: it states the measurements are "answerable against the
  existing `c64-provenance-diff` fixtures — real releases, already committed".
  No such corpus exists in this repo. Filed as
  `.planning/todos/pending/2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md.md`;
  read the ROADMAP Phase 23 Notes as authoritative instead.

### The verdict precedent (the bar to match)
- `docs/phase9-regenerator2000-probe-findings.md` — the durable verdict
  artifact: frontmatter `verdict: degrade` / `verdict_rule_applied: R4`, with
  the rule reproduced and walked through in the body
- `.planning/phases/09-the-assumption-probe-go-no-go/09-07-PLAN.md` — the
  pre-written `R1`..`R5` first-match-wins rule, written before the run
- `.planning/phases/09-the-assumption-probe-go-no-go/09-VERIFICATION.md` — how
  criterion 5 was adjudicated as VERIFIED, including why `R4` and not `R3` fired

### Corpus handling and capture
- `src/skills/c64-ram-capture/SKILL.md` — the depack-by-running and
  verified-flat-image route D-03 depends on
- `src/skills/c64-provenance-diff/SKILL.md` — cited for the *shape* a
  provenance-classified corpus has (`RELEASES.json`, `loader_ranges`,
  `CRACKER-PATCH`), **not** because instances exist here; it is an N-way diff
  and needs two independently-cracked releases of one title to classify anything
- `src/skills/c64-provenance-diff/scripts/recovery-schema.mjs` — the registry
  invariants, if a corpus is ever registered rather than used ad hoc
- `src/skills/vice-wedge-triage/SKILL.md` — the emulator will be driven hard
  (watchpoints on `$01`, checkpoints in hot code); this is the playbook for
  telling a wedge from a checkpoint stop

### Engine-specific technique
- `.planning/notes/ghidra-volatile-io-and-banking.md` — why `$0000-$0001` and
  `$D000-$DFFF` must be volatile before `analyzeAll()`
- `.planning/notes/auto-annotation-from-ghidra-xrefs.md` — the join whose two
  selection rules criterion 3 stress-tests
- `.planning/notes/vic-graphics-map-derivation.md` — relevant to criterion 1's
  error *direction* and its consequence for Phase 26
- `docs/dissambler-workflow.md` — the workflow document that started the pivot
- `docs/undocumented-opcodes-ghidra.md` — untracked but present; relevant if an
  undecodable byte is observed poisoning a function (record it, do **not** act
  on it — that is `OPC-03` in Phase 24)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`c64-ram-capture` skill** — delivers D-03 wholesale: depack-by-running,
  verified flat 64K image, and capture-equivalence proof between two runs.
- **VICE MCP surface** — checkpoints, watchpoints, memory reads, chip state.
  This is D-02's and D-06's instrument. Works on either backend.
- **`disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts`**
  (2,555 lines) — in-house 6502 decode that survives the cutover as `CUT-02`.
  Not chosen for the inventory (D-06 picked runtime observation) but available
  if a plan needs to render a disassembly excerpt as evidence without invoking
  either engine under test.
- **`r2000-d64.ts`** (310 lines, also a `CUT-02` survivor) — `.d64` parsing, if
  the supplied corpus is a disk image and a plan needs file-level access rather
  than autostart.
- **`~/.cargo/registry/src/*/regenerator2000-core-0.9.20/src/analyzer.rs`** —
  `PROOF-04`'s subject, present offline. Reading it does not violate D-01;
  *running* r2000 would.

### Established Patterns
- **Verdict-as-artifact** — a machine-readable field in a durable `docs/` file,
  pointed at from STATE.md and ROADMAP.md rather than copied into them
  (Phase 9, plan 09-08).
- **Pre-committed decision rule** — first-match-wins `R1..R5`, evaluated in the
  findings document against the actual outcome values so a reader re-derives
  rather than trusts.
- **Evidence directories** — `.planning/phases/NN-*/evidence/` holds probe
  transcripts and fixtures; scripts living there are evidence, not deliverables.
- **`/tmp` is tmpfs on this host** — the pivot lost its dxa build to it. Any
  probe artifact that matters must be copied into the phase's evidence
  directory before the session ends, exactly as the pivot's own README explains
  it had to.

### Integration Points
- **Phase 24's planner** reads the verdict via ROADMAP Phase 24's `Depends on`
  and Notes (D-08). Those lines must be written by this phase's closing plan.
- **STATE.md** carries a pointer to the verdict document, not a copy of its
  outcomes (Phase 9 plan 09-08's shape).
- **`REQUIREMENTS.md` traceability** — `PROOF-01`..`05` flip to Complete only on
  the closing plan's evidence, never on the measuring plans.

</code_context>

<specifics>
## Specific Ideas

- **Corpus format:** "disk image or a prg" — both are already reachable (VICE
  autostarts either; `r2000-d64.ts` parses `.d64` if file-level access is
  wanted).
- **Criterion 1 carries an open method question the researcher must close.**
  The 72%/0-FP claim was measured against `fixture.lbl`, a ground-truth symbol
  file. A real release has no such file, so "data-recovery rate" and "false
  positive" need operational definitions that do not presuppose ground truth,
  and the memory window they are computed over must be stated. D-06's runtime
  observation supplies part of the answer — bytes actually executed are
  certainly code, which bounds false-negatives from below — but it does not by
  itself define the data side. **This was flagged, offered for discussion, and
  deliberately left to research rather than decided here.**
- **Criterion 1's cracker/game separation is not available via provenance
  diffing** on a single image, since `c64-provenance-diff` is N-way. Depacking
  helps — after the loader runs, what is resident is mostly game — but a
  cracktro or trainer patch can still sit in the capture. The researcher must
  propose how cracker-authored bytes are held out, or state explicitly that the
  measurement covers everything resident and what that costs the number.
- **Research question 2 is deliberately unmapped.** If an undecodable illegal
  opcode is observed poisoning a whole function rather than being skipped,
  *record it* — it raises `OPC-01`'s priority inside Phase 24. It adds no scope
  here, and the deliberate answer is `OPC-03` in Phase 24.

</specifics>

<deferred>
## Deferred Ideas

- **`r2000-coverage.ts` is not in `CUT-02`'s survivor list.** The bytes-derived
  coverage census v0.5.0 just shipped appears to fall inside `CUT-01`'s 19,181
  deleted lines. Consistent with D-01 and with the owner's stated intent that
  r2000 "has to be removed", so it is not raised as a defect — but Phase 25's
  planner should confirm the deletion is intended rather than incidental.
- **Fetching a corpus from public archives** (CSDb / Internet Archive) — offered
  and not taken. Would give third-party reproducibility; revisit only if the
  supplied image proves unable to exercise criteria 2 and 3 and a second opinion
  is wanted.
- **A test guard on the verdict gating Phase 24** — offered and declined in
  favour of ROADMAP/STATE pointers (D-08). Revisit if the pointer proves
  insufficient in practice.
- **Pre-mapping `degrade` narrowing for all five criteria** — offered and
  narrowed to criteria 2 and 3 (D-09).

### Reviewed Todos (not folded)
- **Reap vicerc scratch dirs in broker kill/recycle path** (`broker`, minor) —
  matched only on the keyword "milestone" at score 0.2. Unrelated to this
  phase's scope; left pending.

</deferred>

---

*Phase: 23-The Real-Release Gate (Go/Degrade/No-Go)*
*Context gathered: 2026-08-26*
