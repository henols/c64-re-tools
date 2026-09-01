# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.7.0 — Own the Annotation Store

**Shipped:** 2026-09-01 (`override_closeout`)
**Phases:** 6 (27-32) | **Plans:** 80 | **Tasks:** 214 | **Requirements:** 28/28

### What Was Built

`.annostore` — a `node:sqlite` annotation store behind one structurally-asserted
seam, holding labels, comments, a frozen twelve-member per-range type vocabulary,
scopes and project enums, with a narrowest-range-wins paint index proven exact at
all 65,536 addresses against an independent linear-scan oracle. Durability and
revert proven together across a real `SIGKILL` in a separate OS process.
Eighteen `anno_*` MCP tools registered proxy-locally through `buildViceTool()`,
plus a two-verb `vice-mcp anno` CLI. ACME export behind a real-ACME 0.97
byte-diff oracle that is deliberately test-only. All five absorbed analysis
procedures re-pointed onto the new surface with their attribution headers
byte-preserved. And regenerator2000 deleted outright — 14 files, 8,221 lines,
6,309 net after the surviving code was renamed rather than removed.

### What Worked

**Classifying before deleting, and letting the registry drive the deletion.**
Phase 27 committed `module-classification.ts` — 19 modules judged
capability-or-glue by what they do — *before* the deletion window opened, with a
16-direction guard whose non-vacuity threshold is derived from the registry
rather than pinned. Phases 29 and 32 then deleted entry by entry from that
registry rather than by prefix glob. A glob would have deleted by name, which is
the one justification that begs the question the record exists to answer. Two
capability modules' heuristics were extracted out of their dying routes as live
code precisely because the registry forced someone to look at them.

**Proving a guard non-vacuous by doing the thing, not by writing a fixture.** The
strongest instance this milestone: a *real* unclassified `r2000-*.ts` was created
on disk and Direction 1 went red naming it. The removal gate was watched going
red on four evasion routes and on a deleted attribution block. This is now the
project's default acceptance bar and it keeps paying — Phase 32 found that a
single-commit-site control was matching the *word* `commit` rather than commit
statements, so a working `db.exec("end")` had been passing it unchanged.

**A verifier that re-executes rather than reads.** `MCP-04` sat BLOCKED through
several rounds and moved only when the round-6 verifier re-ran both findings
through `runAnnoTool()` rather than reading the fixes. That is the property that
made the promotion trustworthy, and it is worth naming as a rule: a verdict
promoted on a re-read of a summary is a weaker artifact than it looks.

**Dropping the parity obligation at the open.** The single highest-leverage
decision of the milestone was made before any plan: no parity is owed to
regenerator2000, and the engine coupling goes with it. That is what made a
store-and-cutover milestone reachable in 7 days under a live `no-go` gate.

### What Was Inefficient

**Phase 28 ran six verification rounds on one blocker chain** (`CR-05` → `CR-10`),
21 of the milestone's 80 plans landing in a single phase. Each round closed by
real work rather than re-reading, so the rounds were not wasted — but the chain's
shape (a snapshot-ring invariant re-broken at a third cause, then a fourth) says
the ring's ownership model should have been settled once at the top rather than
patched per-symptom. `reconcileSnapshotRing` eventually *abstained* from the
pointer-row direction entirely, which is the design that should have been reached
in round 1.

**Sizing claims were asserted, then measured, then corrected — twice.** `CUT-01`
carried three falsified figures (19,181 lines; 25,759; ~12.4k net) before Phase 32
ran the actual measurement and got 6,309. A number in a requirement that no one
has run is a guess wearing a requirement's clothes.

**The archival experiment at close cost a full test cycle.** Phase directories
were archived per the default, and it reddened 9 tests across 5 files — nine
`docs-*` guards, `check-guard-fates`, `anno-register`'s basis-integrity path
check, `acme-verify`'s fixtures. Restoring returned the suite to its floor. The
standing constraint was recorded as "two guards"; it is at least twelve
consumers. Measuring it was worth the cycle, but the record should have been
accurate four closes ago.

### Patterns Established

- **Classification registry as deletion driver.** A committed per-module fate,
  written before the deletion window, consulted per entry — not a glob.
- **A checked `ModuleFate`** so a module cannot leave the tree without a recorded
  reason.
- **Non-vacuity thresholds derived from the artifact, never pinned.** A pinned
  literal goes red on a correct tree — this project's own recorded scar, and it
  was avoided by construction this milestone.
- **Withdrawal notes that correct a superseded forecast rather than delete it.**
  Three Validated capabilities lost their routes; each note says so, names that no
  phase owns the return, and preserves the record that the capability once worked.
- **An oracle that refuses to trust the exit status.** The ACME verify layer
  refuses the exit code, refuses the aggregate line, and carries `skipped` as a
  third outcome that is never a pass.

### Key Lessons

1. **Delete from a record, not from a pattern.** Every line removed this milestone
   was removed because an entry said so. The two things that survived the deletion
   — extracted heuristics, preserved attribution — survived because the registry
   made someone decide about them individually.
2. **A guard that cannot be made to fail has not been written.** Restated because
   it caught a live false pass this milestone (`db.exec("end")`), not because it
   sounds good.
3. **Measure the claim in the requirement.** Three wrong sizing figures shipped in
   a requirement's text across two milestones before anyone ran the count.
4. **Record a constraint's blast radius, not just its existence.** "Do not archive
   phase directories" was carried for four closes with a two-guard justification;
   the real cost is twelve-plus consumers, and nobody knew until it was measured.
5. **Skipping the milestone audit has a name and a cost.** This close skipped it,
   as the two before it did. The cost is concrete: `STORE-03`'s row/prose
   contradiction was explicitly routed to *"a Phase 28 verification pass or a
   milestone audit"* and ships unresolved. A second milestone carrying the same
   row would be evidence the audit should not have been skipped twice.

### Cost Observations

Not instrumented this milestone — no per-model or per-session accounting was
collected, so no mix is reported rather than an estimated one. What is measured:
690 commits over 7 days across 6 phases and 80 plans, with 21 of those plans
(26%) absorbed by Phase 28's six-round blocker chain and a further 21 by Phase
32's three gap-closure rounds. Two phases therefore carried **53%** of the
milestone's plans — the clearest efficiency signal available without token
accounting, and it points at the same place both retro sections do.

## Milestone: v0.5.0 — Persistent Session and the Coverage Instrument

**Shipped:** 2026-08-25 (`override_closeout`)
**Phases:** 2 executed, 3 cut | **Plans:** 27 | **Tasks:** 61

### What Was Built

A regenerator2000 session that survives many tool calls, with crash recovery,
a restart budget and a FIFO call queue. All five upstream analyze procedures
absorbed at one pinned commit, plus a seventh skill. A derived-from-bytes
coverage census the store's own block table cannot move by a byte, with six
committed controls and a four-class dispatch scan. A pairwise trigger-collision
gate over all seven skill descriptions.

### What Worked

**Building the instrument before the sweep it measures.** Phase 19 preceded the
decomposition work deliberately, mirroring v0.4.0's audit-gate-first ordering.
That sequencing is what made the pivot cheap: because the coverage instrument
existed and was adversarially tested, its four gap-closure rounds surfaced how
weak the underlying substrate's discovery actually was — which is the finding
the pivot rests on.

**Cutting three phases cost almost nothing, because no plan had been written.**
The three cut phases had goals and success criteria but no PLAN.md and no
directories. The pivot rewrote roadmap prose and reworded exactly one
requirement (BUILD-01). Late planning was, this once, exactly right.

**Measuring instead of arguing.** The pivot decision was settled by building a
279-byte fixture and running four toolchains against it, not by comparing
feature lists. Two of the assistant's own confident readings were overturned by
that measurement — Ghidra was written off as weak on 6502 before the decompiler
layer was queried, and the annotation join's first selection rule produced
plausible wrong comments.

### What Was Inefficient

**Four gap-closure rounds on one success criterion.** SC4/COV-01 was closed and
re-defeated three times, each round shutting the shape it was shown and being
beaten by a different shape in the same function. Round 4 was finally scoped by
*defect class* rather than by finding id, which worked — but that framing should
have been round 2's. The criterion ultimately shipped as an accepted override.

**Thirteen evidence-table rows read as open deferred items** at close, because
a deferred-items file titled with `#` rather than `##` makes the scanner treat
the whole document as the Deferred Items section. Cost a detour through a CLI
writer that refuses that shape.

### Patterns Established

- **Cut, not abandoned.** A phase dissolved by a substrate change is recorded
  as `Cut` in the Progress table with a banner in its detail section saying the
  goal survives and where its requirements were re-mapped. Distinct from a
  phase that was attempted and failed.
- **Carry standing constraints out of phase notes before archiving them.**
  Archiving v0.5.0's phase details silently removed the only second normative
  mention of `.vsf`, reddening `docs-dangling-refs` and cascading into
  `audit-integrity`. Constraints that outlive a phase belong in a
  `## Standing Constraints` section, which the ROADMAP now has.

### Key Lessons

- **Query the right layer before concluding a tool is weak.** Ghidra's 6502
  structural facts are in `DecompInterface`, not `DataTypeManager`. The obvious
  implementation returns almost nothing and reads as a capability gap.
- **Declare I/O volatile or the decompiler deletes hardware writes.** Silently.
  Three of four `$01` writes and a `$d020` write vanished as dead stores. On a
  raster loop this would delete the entire visible effect with no warning.
- **A guard cascade has one root.** Six red docs guards traced to a single
  missing `.vsf` mention. Fix the root before triaging the cascade.

### Cost Observations

- Sessions: the pivot was decided inside a single `/gsd-explore` session that
  built the fixture, installed Ghidra, and ran four toolchains end to end.
- Notable: the whole evidential basis for cancelling half a milestone is 279
  bytes of assembly and about a dozen tool invocations. The standing caveat is
  that it is *one* fixture, written by the person testing it — recorded as the
  first open research question rather than resolved.


## Milestone: v0.4.0 — Debt discharged, decisions settled

**Shipped:** 2026-08-23
**Phases:** 6 (12, 13, 14, 15, 16, 17 — no inserted decimals) | **Plans:** 44 | **Tasks:** 119
**Timeline:** 2 days (2026-08-21 → 2026-08-23) | **Commits:** 292 since `v0.3.0`
**Final audit:** round 1 — `tech_debt`, **zero blockers and zero open gaps** (16/16 requirements, 6/6 phases, 12/12 integration, 4/4 flows)
**Closeout:** `override_closeout` — 16 bookkeeping items acknowledged, 0 carried forward

### What Was Built

The first milestone whose deliverable is *the absence of something*: the ledger
this project had carried across three closes.

- **`scripts/audit-gate.mjs` plus a real `PreToolUse` hook** (Phase 12,
  sequenced first). A milestone audit cannot record a gated status while any of
  six `docs-*.test.ts` guards is red — enforced at the moment of writing, not
  reviewed afterward. Claude Code's own dispatch was observed refusing all four
  write routes (Write, Edit in two payload shapes, a Bash heredoc, a subagent's
  Write) against a genuinely red guard, then allowing them after a verified
  revert, with `gaps_found` passing through unobstructed throughout.
- **Real binaries replacing internal proxies** (Phase 13). `VERIF-02`'s three
  synthetic binmon fixtures are now hardware captures; the `--help` backend
  discriminator is confirmed against genuine stock *and* fork `x64sc` with both
  transcripts committed; all four spec-driven Phase 3 wire details were run.
  Two confirmed, one inconclusive, one **refuted** — `vice_disk_attach`'s
  advertised no-side-effect promise is false, corrected at source.
- **Two dated decisions where there had been two defaults** (Phases 14, 17).
  `FORK-01` = **retain**, with the upstream `KEYBOARD_MATRIX_SET` coupling named
  as the reversal criterion and its caveats carried rather than resolved;
  `CORE-01` = **keep-dated**, taken at a `gate="blocking-human"` checkpoint. Each
  is read out of the live PROJECT.md by its own new guard.
- **19 inherited items → 0 pending** (Phases 15, 17). Every one fixed,
  dispositioned `wont-fix` with rationale, or promoted with a **named owner** (9
  of them). Widening `docs-review-disposition.test.ts`'s parser surfaced 150
  findings where 119 had been visible; all 9 newly exposed were dispositioned.
- **The repo's shipping shape** (Phase 16). Payload under `src/` in two atomic
  `git mv`s with ~30 consumers repointed and the tarball proven byte-identical;
  `installer/`'s `wireMcp()` went from never-tested to 18 cases; `QUAL-01..03`
  closed, the last as a dated accepted risk with its residual exposure stated
  without softening.

### What Worked

- **Building the gate before the work it gates.** Phase 12 first was the single
  highest-leverage sequencing choice in the milestone. Every later phase ran
  under its own audit-integrity guard, which is precisely what v0.3.0's close
  lacked when `4f048bb` shipped with a red guard nobody was forced to read.
- **Promotion with a named owner as a third option.** "Fixed or carried" is a
  false binary that produced three milestones of silent inheritance. Nine items
  are now in named buckets with owners, and the ledger reads 0 *honestly* rather
  than by redefinition. Making `docs-deferred-ledger.test.ts` able to *express*
  zero (its non-vacuity floor asserted `pending.length >= 2`) was part of the
  work, not a footnote.
- **Widening a guard rather than trusting its green run.** The review-disposition
  guard keyed on level-3-colon-only headings — a property of how findings
  happened to be written, not of what a finding is. Widening it found 31 more.
- **Two days for six phases.** The fastest milestone yet, on the largest phase
  count outside v0.2.0, because almost every phase was closing a known item
  rather than discovering scope.

### What Was Inefficient

- **A census assertion nobody could satisfy at a close.**
  `audit-integrity.test.ts` pinned exact per-status audit totals (`tech_debt: 3`,
  `gatedAudits: 4`). Those are a function of how many milestones have shipped, so
  writing v0.4.0's own audit file turned the test red on a correct tree — *while
  `/gsd-audit-milestone` was recording a green suite in the same document.* It
  went unnoticed because the file is deliberately not a `docs-*.test.ts` member
  (a correct recursion fence), so `audit-gate.mjs` reported `allowed: true`
  throughout. Found and fixed during this close.
- **The close procedure fights the guards it installed.** Default-on phase
  archival would have turned `docs-review-disposition.test.ts` and
  `r2000-answer-key.test.ts` red, because both read `.planning/phases/` directly
  and one explicitly excludes `.planning/milestones/`. Three consecutive closes
  have now had to pass `--no-archive-phases`. The guards are right and the
  archival is right; nobody taught them about each other.
- **Two closure plans had to reverse their own premises.** Plan 15-04 was told
  two findings were "superseded" and found both still open on direct inspection.
  Plan 16-08's deferred entry predicted the wrong closing plan. Both cost a
  re-derivation that a citation would have made unnecessary.
- **Validation and security coverage was left behind.** Five of six phases ended
  with a `VALIDATION.md` at `status: draft`, and only Phase 17 produced a
  `SECURITY.md` — in a milestone that moved every file in the repo and accepted a
  network-bind risk.

### Patterns Established

- **Gate-first sequencing.** When a milestone's job is to stop a failure mode,
  the instrument that detects it is phase 1, not a success criterion inside a
  later phase.
- **Promote-with-owner as a first-class disposition**, alongside fix and
  `wont-fix`. An item without an owner is carried, whatever the ledger says.
- **A guard's scope is itself a claim to be checked.** A green guard whose
  parser is narrower than its subject reports clean for the wrong reason.
- **Assertions must not encode a census.** Any expected value that grows with
  project history is a scheduled false failure. Assert the *relation* (one status
  per file) rather than the total.
- **Acknowledgment as a disclosed, self-invalidating state.** Sixteen bookkeeping
  items were acknowledged rather than resolved, itemised in STATE.md, and each
  suppression lapses automatically if its artifact changes — so it cannot hide a
  *new* problem while still declining to claim the old one was fixed.

### Key Lessons

1. **An artifact that gates nothing is not evidence — and neither is a gate
   nobody can pass.** v0.3.0 taught the first half. v0.4.0 taught the second:
   two mechanisms this project built to enforce correctness (the census
   assertion, default-on phase archival) were themselves obstacles to a correct
   close. Enforcement needs a maintenance story.
2. **The sixth instance of the external-check lesson was the most expensive one
   to have skipped.** Four wire details written spec-driven and never run: one
   was simply false, and had been advertised to users in a tool's own response
   string for two milestones.
3. **Restating a stale claim confidently is the same defect one level up.** Twice
   a closure plan asserted a premise it had been handed rather than re-derived,
   and both times the premise was wrong. "Dispositioned" and "fixed" are also
   this: ~15 WR-class findings carry citations, not fixes, and the closure note
   correctly declines to blur them.
4. **Zero is reachable, and the number was never the point.** 19 → 0 took one
   milestone once the disposition options were honest. What made it possible was
   admitting that some items would be promoted, not closed.

### Cost Observations

- Sessions: multiple across 2 days; six phases, 44 plans, 292 commits.
- Notable: the highest plan-per-day rate of any milestone (22/day vs v0.3.0's 12
  and v0.2.0's 11), on work that was almost entirely *closing* known items. Scope
  discovery, not execution, is this project's cost centre.
- Notable: zero new npm dependencies again — third milestone running.
- Notable: the two most valuable findings of the milestone (the refuted
  `vice_disk_attach` promise, the red census assertion) both came from running
  something rather than reading it.
---

## Milestone: v0.3.0 — regenerator2000 static-analysis backend

**Shipped:** 2026-08-21
**Phases:** 4 (9, 10, 11, inserted 11.1) | **Plans:** 36 | **Tasks:** 101
**Timeline:** 3 days (2026-08-19 → 2026-08-21) | **Commits:** 268 since `v0.2.0`
**Final audit:** round 2 — **`passed`**, zero open gaps, Nyquist compliant across all four phases

### What Was Built

A second axis. v0.2.0 was about *which* live emulator qualifies; v0.3.0 is about
what survives the session. regenerator2000 is adopted as a required,
container-side, static-analysis-only prerequisite reached through 17 curated
`r2000_*` tools and 7 `vice-mcp r2000` CLI verbs:

- **A go/no-go probe phase** that drove a real regenerator2000 0.9.20 against
  seven criteria and returned `degrade` (rule `R4`), narrowing the input set to
  `.prg`/`.d64`/flat-64K. No product code — the deliverable is evidence.
- **The adoption boundary made structural:** `--vice` unreachable by fixed
  per-verb argv builders *and* denied by a scan that throws; the whole family
  registered proxy-locally so it never reaches `forwardToVice()`.
- **Bootstrap with no human:** a pure-Node `.regen2000proj` synthesiser plus a
  cycle-guarded `.d64` reader that refuses to guess between matching entries.
- **The removal it earned:** `cmdDisasm`/`toacme` and ~50 lines of decoder-shaped
  `SKILL.md` caveats deleted behind a whole-tree grep gate.
- **The annotation store, the enums, the round trip:** `memmap.json`-generated
  register bit-names verified byte-identical under real ACME; the store made
  canonical with the Markdown memory map a generated view; symbols flowing both
  ways, demonstrated live against genuine unpatched stock `x64sc`.
- **Four `docs-*.test.ts` guards** that fail CI on planning-document drift.

### What Worked

- **A gate that can say no, honoured when it did.** `R2000-16` was promoted from a
  criterion inside Phase 9 to a standalone phase precisely because its failure
  mode is reconsider-the-milestone. It came back `partial` on criterion 3(4), rule
  `R4` fired, and the milestone shipped *smaller* than proposed. The rule and its
  inputs were written before the answer was known, which is the only reason the
  outcome is credible. `R4` not `R3` also mattered: the bootstrap was not the
  degraded element, so Phase 10 kept full automation.
- **The probe corrected its own research.** Three inputs treated as settled turned
  out wrong under a real build: the rustc floor (≥ 1.90, transitive and
  undeclared — not edition 2024's 1.85, and not the 1.88 first measured), the
  licence (dual `MIT OR Apache-2.0`, not Apache-2.0), and a Debian-release/glibc
  mismatch that breaks a naive multi-stage container build. Two days of building
  on any of those would have been wasted.
- **Falsifiability applied to a claim that reads true and tests nothing.** "A
  later session can query instead of re-deriving" was proved by sealing a question
  with a hashed answer key, then having a genuinely separate session answer it
  from tool calls alone. The hashes matched. This is the strongest single piece of
  evidence the project has produced, and it cost one plan pair.
- **Guards over prose, extended to planning documents.** v0.2.0's audits kept
  finding stale document claims by hand, round after round. Making them
  mechanical worked immediately: this close found two stale counts *and* a red
  guard because the instruments exist.
- **Structural satisfaction beats remembered discipline.** The `r2000_*` family
  satisfies CLAUDE.md's derived-tool path-translation constraint by construction —
  neither `rewriteArguments()` call site is reachable from it — so there is no
  interception for a future refactor to forget.
- **Density.** 36 plans in 3 days against v0.2.0's 87 in 8, with a `passed` audit
  instead of `tech_debt`. Smaller scope helped, but so did arriving with the
  research already done (`notes/regenerator2000-integration.md`) and refusing to
  re-derive it.

### What Was Inefficient

- **The audit's own guard went unread.** Plan 11.1-07 built
  `docs-review-disposition.test.ts`, and it was **red at `4f048bb`** — the commit
  whose subject says "all findings closed" — with Phase 09's `IN-01`..`IN-03`
  undispositioned. Round 1 never scanned Phase 9's review; 11.1-07's ledger was
  scoped by its plan to Phase 10/11. Building the instrument and not reading it is
  a worse outcome than not building it, because it buys false confidence. Found
  at this close, filed, and the process fix proposed.
- **An inserted phase created a validation gap of its own.** Phase 11.1 was
  planned straight from the audit with no validation-planning pass, so its Nyquist
  ledger had to be filled retroactively — the closure phase reproducing, at
  smaller scale, exactly the gap it existed to close.
- **A prediction off by 3×.** Plan 11.1-07 pre-measured 8 undispositioned review
  findings; its guard's first run found **27** (7 in Phase 10/11, 20 outside it,
  spanning Phases 01, 02, 08, 09, 11). The estimate was made by reading rather
  than by measuring, which is the same substitution the milestone's other lessons
  are about.
- **Two stale planning counts survived into the close** — `STATE.md`'s
  hand-maintained "14 pending" against 17 real files, and a false-positive
  paragraph naming four quick tasks when the audit reported nine. Both were in the
  one section a guard already covered *adjacently*, which is the argument for
  widening guards rather than adding prose.
- **Worktree mode kept being the wrong default** for plans whose deliverable *is*
  `.planning/` content (09-08, 11-03) — worktree commits strip those files. Each
  such plan had to declare `worktree: false` by hand.

### Patterns Established

- **The recorded-verdict gate.** A phase whose deliverable is evidence, with the
  decision rule and its inputs written before the answer is known, and the verdict
  recorded in one place (`docs/phase9-…-findings.md` frontmatter) that every other
  document *points at* rather than restates.
- **Guard-proven-non-vacuous as an acceptance bar.** No guard is accepted without
  a planted violation or a real reverted edit demonstrating it fails. Applied to
  every finding Phase 11.1 closed.
- **Bidirectional guards.** A marker tied to reality in *both* directions —
  `regenerateAndReload()`'s `LIBRARY-ONLY` marker fails if it gains a caller *and*
  fails if the marker is removed while it has none. Likewise the deferred ledger:
  a pending todo with no row fails, and a row with no todo fails.
- **Derived, not enumerated.** Hard-coded lists rot: a 10-name array became a
  `readdirSync`-derived set with a floor; a hand-typed CLI verb list became one
  parsed from the dispatch switch; a hand-maintained deferred table became one
  derived from the todo tree.
- **Generated-and-digest-pinned documents.** The memory map joins
  `docs/tool-support.md`: rendered from canonical state, with `--check` and a
  render digest making drift mechanical.
- **Sealed-question verification** for any claim of the form "a later session can
  X from stored state".

### Key Lessons

1. **A gate that cannot say no is theatre — and one that can must be honoured the
   first time it does.** The `degrade` verdict cost one input format. Overriding it
   would have cost the credibility of every future gate, which is not a price paid
   once.
2. **An instrument nobody reads is worse than no instrument.** The completeness
   guard was correct, committed, running under `test:automated`, and red — under a
   commit subject asserting the opposite. Coverage without a gate that *consumes*
   it produces false confidence. Concrete fix proposed: require a green run of the
   four `docs-*.test.ts` guards before a milestone audit may record `passed`.
3. **Estimate by measuring, not by reading.** 8 predicted, 27 found. The same
   substitution as v0.2.0's lesson 1 (self-written tests validate understanding,
   not code), one level up: a pre-measurement done by inspection is an internal
   check standing in for an external one.
4. **Prove the claim that reads true and tests nothing.** The store's whole value
   was a sentence nobody could falsify until a question was sealed and a separate
   session answered it. Cost: one plan pair. Every milestone has at least one such
   sentence.
5. **A closure phase inherits the process it exists to fix.** Phase 11.1 skipped
   validation planning and had to backfill its own Nyquist ledger. Insert-on-audit
   phases need the same discipline as planned ones, not a lighter one.
6. **Guard planning documents like code.** Four `docs-*.test.ts` guards found more
   real drift in one milestone than four rounds of hand audit did in v0.2.0.

### Cost Observations

- Sessions: not instrumented this milestone (unchanged from v0.2.0).
- 36 plans / 101 tasks over 3 days — ~12 plans/day, comparable to v0.2.0's ~11.
- Notable inversion: audit-closure work was **7 of 36 plans (~19%)** against
  v0.2.0's ~30 of 87 (~34%), plus 3 quick tasks. Arriving with research already
  done and gating on a probe moved cost out of re-verification and into
  construction — the opposite of v0.2.0's dominant driver.
- Zero new npm dependencies again, including a hand-rolled JSON-RPC client chosen
  over an available library by live measurement.

---

## Milestone: v0.2.0 — Switchable stock-VICE backend

**Shipped:** 2026-08-19
**Phases:** 9 (of 10 listed; Phase 6 cut whole) | **Plans:** 87 | **Tasks:** 218
**Timeline:** 8 days (2026-08-11 → 2026-08-19) | **Commits:** 696 since `v0.1.10`
**Final audit:** round 4 — `tech_debt`, no blockers, Nyquist compliant across all nine phases

### What Was Built

- A **stock-VICE backend** driving unmodified upstream `x64sc` over its binary
  monitor, selected per project, advertising 38 tools. The fork backend's 62-tool
  surface is byte-identical to v0.1.x.
- A **correctly-demultiplexed protocol client** — request-id-first, handling all
  five unsolicited event types (two of which share a response type with a
  legitimate command reply), plus broker-enforced single-monitor-client ownership
  that refuses a conflicting claim by name before a second `connect()` can create
  a wedge lookalike.
- **A client-side 6510 disassembler**, round-tripped byte-exact through a real
  ACME 0.97 across all 256 opcodes, plus memory search/compare, a symbol store,
  and VIC-II/CIA/sprite state decoders that report unavailable fields as
  `{available:false, reason}` rather than a plausible zero.
- **`capability-registry.ts`** — one 26-entry source of truth read by four
  consumers and copied by none, backing a runtime refusal that names the
  capability, the reason, and which backend provides it.
- **`docs/tool-support.md`**, the repo's first generated markdown file: 63 rows
  derived from both shipped manifests with zero hand-curated exclusions, guarded
  by a generate-into-scratch-then-byte-diff drift check.

### What Worked

- **Cutting scope by a measured test, not judgment.** "Does a shipped skill call
  it, or does something a skill calls depend on it?" — answered by diffing the six
  skills' actual `vice_*` usage against both manifests. 29 open requirements → 14,
  Phase 6 removed whole. Every cut names its requirements, so reversal is a scope
  decision rather than archaeology. This was the single highest-leverage hour of
  the milestone.
- **Correcting the ground truth before building on it.** Phase 1 existed only to
  fix four factual errors and an event-count undercount in the normative documents
  and to run a real probe. Every later phase read facts that matched the emulator.
- **Inserting decimal phases instead of forcing the close.** 8.1 and 8.2 were both
  inserted after audits returned gaps, and both were right. The milestone closed
  later and honestly rather than on time and falsely.
- **Preferring a refusal to a fallback.** `resolveRequiredBank()` refuses when a
  build reports no such bank rather than silently falling back — which is the
  shape that would have prevented the defect it was written to fix.

### What Was Inefficient

- **Four separate discoveries of the same lesson.** Phases 2, 3, 4 and 5 each
  rediscovered that a self-written test suite validates the author's
  understanding, not the code. Roughly a third of the milestone's plan count was
  gap-closure work re-verifying things already marked green. Reaching for the
  external check *first* — a real assembler, a real emulator, a real container, a
  real broker launch — would have collapsed much of it.
- **Documentation drift outran the code by a consistent margin.** Three audit
  rounds each found the *previous* phase's VALIDATION.md and STATE.md stale at
  exactly the moment that phase completed. Round 4 was the first to find them
  current — after the close-out was actually run as its own task rather than
  assumed as a side effect.
- **A wrong environment ruling propagated for six days.** "No stock VICE binary
  exists in this environment" (2026-08-13) shaped all of Phase 2 — synthetic
  fixtures, an overridden locked decision, an open discriminator question. It was
  false: `/usr/bin/x64sc` is genuine stock, merely shadowed on `$PATH` by the
  fork. Three of the 13 deferred items trace directly to it.

### Patterns Established

- **Single seam per concern, enforced by a test that fails on a second copy.**
  `capability-registry.ts` deleted `check-skill-tool-coverage.mjs`'s duplicate
  array; `hostpath-consumers.test.ts` pins the closed host-path consumer set.
- **Generate-then-byte-diff for derived documentation.** `docs/tool-support.md`
  reuses `resources-sync.test.ts`'s mechanism. A hand-maintained support table
  drifts on the first tool added.
- **Shape oracles for manual-only live tests.** When a live suite's assumption
  cannot itself run under the automated gate, mirror the assumption in a zero-cost
  unit test so drift reds automatically. Now a standing rule in `test-gate.mjs`'s
  header.
- **Prove a gate by watching it fail.** Every gate added this milestone was
  verified by breaking its input, not by inspection — the ACME round-trip, the
  packaging check, the pre-fix baseline in `stock-broker-live.test.ts`.
- **Preserve a failed attempt beside its later pass.** `08-VERIFICATION.md` keeps
  Phase 8.1's `outcome: failed` as history and records the 8.2 re-run in a
  separate `resolved_final:` field rather than overwriting it.

### Key Lessons

1. **A test written by the same pass that wrote the code proves less than it looks
   like it does.** Learned four times in escalating forms; the external check is
   the only one that found each defect.
2. **An unwitnessed claim is not a weaker version of a verified one — it is a
   different kind of thing.** Running Phase 8.1's walkthrough *falsified* the
   claim it was meant to confirm. That failure was the cheapest defect discovery
   of the milestone.
3. **A registry that marks fields unavailable cannot defend against a wrong
   address.** Phase 5's chip reads returned `isError:false` with fully-"available"
   plausible values decoded from RAM underneath the banked-out I/O area. Defect
   classes that arrive through a *different argument* than the one the safety
   mechanism guards will pass every check that mechanism performs.
4. **Trimming a surface is more honest than annotating it.** The original decision
   to keep every tool in the manifest with per-backend annotation was reversed;
   advertising a tool the backend cannot serve is exactly the dishonesty the
   milestone existed to remove.
5. **Measure blast radius, don't infer it.** The `Drive8Type=0` defect was assumed
   to affect disk loads; measurement showed a bare `.prg` autostart hit the same
   wall. It was *all program loads*.

### Cost Observations

- Sessions: not instrumented this milestone.
- 87 plans / 218 tasks over 8 days — roughly 11 plans/day sustained.
- Notable: gap-closure plans (03-14..03-18, 05-09..05-13, 07-11..07-18, and all of
  8.1/8.2) account for **~30 of 87 plans**. The dominant cost driver was
  re-verification, not construction.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.1.x | — | — | Pre-GSD; fork-only tool surface, released through `v0.1.10` |
| v0.2.0 | 9 | 87 | First GSD milestone. Introduced measured scope cuts, decimal-phase insertion on audit gaps, and live-evidence gates as first-class artifacts |
| v0.3.0 | 4 | 36 | First `passed` audit. Introduced the recorded-verdict go/no-go phase, guard-proven-non-vacuous as an acceptance bar, bidirectional and derived-not-enumerated guards, and mechanical guarding of *planning* documents |
| v0.4.0 | 6 | 44 | First milestone with zero inherited debt at close. Introduced gate-first phase sequencing, promote-with-named-owner as a third disposition, dated decisions pinned by live-file guards, and acknowledgment as a disclosed self-invalidating state |
| v0.5.0 | 2 executed, 3 cut | 27 | Closed `override_closeout` with 13/27 requirements. Introduced derived-from-bytes measurement the measured artifact cannot move, and a pairwise trigger-collision gate across skill descriptions |
| v0.6.0 | 1 of 4 | 6 of 11 | **Closed incomplete by its own gate** (`no-go`, rule `R1`). First time a pre-committed verdict cancelled the milestone that wrote it — honoured rather than overridden |
| v0.7.0 | 6 | 80 | First large deletion. Introduced the classification registry as *deletion driver* (never a prefix glob), a checked `ModuleFate`, and non-vacuity thresholds derived from the artifact rather than pinned |

### Cumulative Quality

| Milestone | Tests (approx. green) | Live-evidence suites | Zero-Dep Additions |
|-----------|-----------------------|----------------------|--------------------|
| v0.2.0 | ~1400+ | 3 (`stock-live`, `stock-live-triage`, `stock-broker-live`) | disassembler, PETSCII table, all derived tools — 0 new npm deps |
| v0.3.0 | ~2066 | 3 carried + r2000 live gates (real `regenerator2000 0.9.20` + genuine stock `x64sc`) | `.regen2000proj` synthesiser, `.d64` reader, NDJSON JSON-RPC client, ACME-ident seam — 0 new npm deps |
| v0.4.0 | **2351** (0 fail, 39 skipped, 5 todo, 24 suites) | 4 carried + `fork-live.test.ts` (the fork's `-mcpserver` HTTP transport exercised live for the first time, 6/6) | `audit-gate.mjs`, `hop-chain-comments` + `comment-phase-pointers` guards, `skill-corpus.mjs`, 18 `wireMcp()` cases — 0 new npm deps |
| v0.7.0 | 0 failures on `test:automated` (the project's floor; the whole-glob `npm test` still does not terminate unaided — `vice-proxy.test.ts` leaks two LISTEN sockets) | real ACME 0.97 as a byte-diff oracle, hard-failed in CI with `VICE_REQUIRE_ACME=1` | the annotation store on `node:sqlite` — a **built-in** at this project's Node floor; `better-sqlite3` rejected on 11.4 MB/consumer and 8 prebuild targets — 0 new npm deps |

| Milestone | Audit verdict | Rounds | Open gaps at close | Deferred at close |
|-----------|---------------|--------|--------------------|-------------------|
| v0.2.0 | `tech_debt` | 4 | 0 blocking | 13 (hand-counted) |
| v0.3.0 | **`passed`** | 2 | 0 | 19 (derived + guarded both directions) |
| v0.4.0 | `tech_debt` | 1 | **0** | **0** pending todos (+ 9 promoted with named owners; 16 bookkeeping items acknowledged) |
| v0.5.0 | not run | — | — | 5 newly acknowledged, 16 carried |
| v0.6.0 | not run (gate's findings doc is the audit of record) | — | intent NOT delivered under 3 accepted overrides | — |
| v0.7.0 | **not run** | — | 0 against its own 28 requirements | 15 newly acknowledged, 21 carried, **8 disclosed as un-acknowledgeable** |

**Three consecutive closes without a milestone audit.** v0.5.0, v0.6.0 and
v0.7.0 all shipped on per-phase `VERIFICATION.md` evidence alone. For v0.6.0 that
was defensible — its own gate had already recorded the intent as not delivered.
For v0.7.0 the cost is concrete and named: Phase 29 routed `STORE-03`'s row/prose
contradiction to *"a Phase 28 verification pass or a milestone audit"*, and
neither ran. The trend to watch is not any single skip but the third one in a row.

The deferred count rising 13 → 19 while the verdict improved is not a
contradiction: v0.3.0 is the first milestone whose ledger is *derived* from
`.planning/todos/pending/` rather than hand-maintained, and 4 of the additions
were surfaced by a guard that did not previously exist. The v0.2.0 figure should
be read as a floor, not a measurement.

Reading 19 → 0 requires the same care in the other direction. It is a real
result — the pending tree is genuinely empty and guarded in both directions — but
"0" is not the whole disposition. Nine items were **promoted with named owners**
rather than fixed, ~15 WR-class review findings are **dispositioned rather than
fixed**, and 16 bookkeeping items were **acknowledged rather than resolved** at
the close. All three sets are written down and pointed at. The claim v0.4.0 can
defend is "nothing is carried silently", not "nothing is carried".

v0.4.0's `tech_debt` after v0.3.0's `passed` is likewise not a regression: it is
`tech_debt` on bookkeeping and coverage only (draft `VALIDATION.md` files, a
missing `SECURITY.md`), with zero blockers and zero gaps across requirements,
phases, integration and flows. It closed in **one** audit round, against v0.3.0's
two and v0.2.0's four — the sharpest signal in this table.

### Top Lessons (Verified Across Milestones)

1. **An internal check does not substitute for an external one.** *Verified across
   all three milestones — standing rule.* v0.2.0 met it four times as
   self-written tests validating understanding rather than code (green suites
   hiding 7 defects; fixtures stubbing the code's own assumption; an
   independently-derived opcode table still shipping 14 wrong entries; a registry
   that could not defend against a wrong bank address). v0.3.0 met it three more
   times: a pre-measurement done by reading found 8 where measuring found 27;
   three research inputs treated as settled were wrong under a real build; and the
   three highest-value carried debt items were themselves exactly this. v0.4.0
   discharged those three against real binaries and one came back **refuted** — an
   advertised no-side-effect promise that had been false, and shipped in a tool's
   own response string, for two milestones. Eight instances, three milestones,
   zero counterexamples.

2. **Coverage without a consuming gate produces false confidence — and a gate
   without a maintenance story becomes the next obstacle.** *First half verified
   across all three; second half new in v0.4.0.* v0.3.0's completeness guard was
   correct, committed, running, and red under a commit asserting "all findings
   closed". v0.4.0 made a green guard run a *precondition* of the audit status,
   which is the fix — and then met the inverse twice in its own close: a census
   assertion that goes red every time a milestone ships, and default-on phase
   archival that would turn two guards red because both read `.planning/phases/`
   directly. Enforcement mechanisms need owners too.

3. **Restating a stale claim confidently is the same defect one level up.** *New
   in v0.4.0, two instances, plus one retroactively visible in v0.3.0.* Plan
   15-04 was handed two findings marked "superseded" and direct source inspection
   found both still open. Plan 16-08's deferred entry named the wrong closing
   plan and was corrected mid-close. The v0.3.0 analogue: a pre-measurement done
   by reading. Re-derive a premise before building on it, or cite where it was
   derived.

4. **Honour a gate the first time it fires.** *v0.3.0, one instance; no
   counterexample since.* The `degrade` verdict was accepted and the milestone
   shipped smaller. Had it been overridden, nothing observable would have changed
   in v0.3.0 — the cost would have landed on every subsequent gate. v0.4.0's
   `blocking-human` `CORE-01` checkpoint is the same discipline in a different
   shape: the operator delegated the choice, and the record says so rather than
   claiming a comprehension no artifact evidences.

5. **"Fixed or carried" is a false binary.** *New in v0.4.0.* Three milestones of
   silent inheritance came from having only two dispositions. Adding
   promote-with-a-named-owner took the ledger from 19 to 0 in one milestone. The
   number moved because the vocabulary did.

---
*Created 2026-08-19 at v0.2.0 milestone close. Updated 2026-08-21 at v0.3.0
milestone close — v0.3.0 section added, all three cross-milestone trend tables
extended, and Top Lessons promoted from one awaiting-cross-validation candidate
to three. Updated 2026-08-23 at v0.4.0 milestone close — v0.4.0 section added,
all three trend tables extended with a caveat on how to read 19 → 0 and why
`tech_debt` after `passed` is not a regression, and Top Lessons grown to five:
lesson 1 now verified across three milestones with eight instances, lesson 2
gained its inverse half, and two new lessons recorded (stale-premise restatement,
and the false fixed-or-carried binary).*
