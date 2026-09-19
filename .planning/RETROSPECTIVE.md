# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1.0 — The Prerequisite Doctor

**Shipped:** 2026-09-19 (`override_closeout`)
**Phases:** 4 closed (58-61), 4 still carried forward (51, 53, 54, 57) | **Plans:** 19 | **Tasks:** 44 | **Requirements:** 15/15 in-scope, 15 still carried

### What Was Built

The first milestone in this project's history that adds **nothing** to what a
session can do once it is running — decided at the open, not discovered at the
close. It rebuilt the hour before a session exists.

- **One declaration** (Phase 58). `src/mcp/vice/prerequisites.json` names all
  eight host prerequisites with per-platform remedies and three-valued
  provenance, shipped in `files[]` and proven parseable by a standalone Node-18
  CI job. Behind it, a machine-read citation ledger recording the five
  disagreements the declaration had to settle.
- **One seam** (Phase 59). `tool-location.mts`'s `resolveTool()`: environment
  variable → `.c64-re-tools/tools.json` → `$PATH`/sibling probe, naming the layer
  that answered, validating a directory candidate against its marker, refusing a
  bad entry by name rather than falling through, and caching nothing.
- **Everything shipped wired onto it** (Phase 60). `resolvedBackend()`,
  `buildHostToolArgv()` and `findSiblingBinary()` rewired with no duplicated
  ordering left behind; `remedyTextsFor()` made the one runtime reader of the
  declaration's remedy prose; a closed-consumer-set scan proving no production
  module reads a tool-location environment variable by name except one declared
  exception.
- **Generated install tables with a fact-comparing guard** (Phase 61).
  `prereq-readme-gen.ts` derives README.md's two regions; `auditGeneratedReadme()`
  parses the committed region back into records and fails on a changed fact while
  forgiving a reflow.
- **The doctor, dropped.** `DOCTOR-01`..`09` moved to Future Requirements unbuilt
  and un-retracted at owner decision on 2026-09-18, with the gap they leave
  recorded rather than absorbed.

### What Worked

- **Declaration first, readers after.** Phase 58 shipped *data only* and was
  thinner for it — a departure the roadmap flagged and accepted in advance. Every
  later phase then had exactly one file to read, and `DECL-03`'s "every live
  refusal carries the declaration's remedy" became a one-function change
  (`remedyTextsFor()`) instead of a sweep. The ordering paid for itself twice
  over.

- **Making "nothing changed" prove itself.** `LOC-03`'s success condition was
  that a developer with `VICE_BIN` already set notices nothing — a claim the unit
  tests of the changed code structurally cannot check. Phase 60 was required to
  run a real-process full-suite comparison against the pre-rewiring tree and diff
  the *failing sets*. It **caught two genuine regressions nothing else saw**: the
  real broker never threaded its resolved binary into a live acquire, and a
  deployed broker could not find `prerequisites.json` at all. Both would have
  shipped green.

- **Dropping the centrepiece at the discussion gate, before any plan existed.**
  The owner's ruling landed during `/gsd-discuss-phase 61` — the cheapest moment
  it could have. No plan was written, no code was built and then deleted, and the
  renumber (62 → 61) cost one roadmap edit. Compare this with a decision taken one
  phase later.

- **Planted violations as the acceptance bar, again.** Every refusal family in
  Phases 59 and 61 was proven by a planted violation observed failing beside a
  clean control observed passing, through the same exported function. Phase 61's
  guard has five such cases and they do more than prove non-vacuity: each asserts
  the failure string *names what moved*.

- **Comparing facts rather than bytes.** The README guard parses the committed
  region back into records. It is the first guard in this project written after
  the owner's 2026-09-13 removal of every byte-identical assertion, and it shows
  what the replacement shape looks like: a reflow passes, a changed remedy fails.

### What Was Inefficient

- **Phase 60 needed three successive gap-closure plans on one requirement.**
  Plans 60-06, 60-07 and 60-08 each widened `LOC-03`'s environment layer further:
  60-06 made it terminal for a separator-free value and left the
  separator-containing case as a stated accepted limit; 60-07 carried that limit
  forward in its own evidence note; 60-08 closed it by making the layer terminal
  for *any* non-empty value. Three passes at one contract. The contract was
  under-specified at plan time, not hard — the phase shipped 8 plans against a
  roadmap that scoped it as rewiring.

- **A summary asserted pre-phase behaviour without reading the pre-phase
  source.** Plan 60-06's SUMMARY described the fall-through its tests pinned as
  legacy behaviour. It was not: `60-VERIFICATION.md`'s own read of commit
  `d54d98a1` established it as a same-phase regression introduced by plan 60-01.
  Two shipped tests had their expectations reversed across 60-06 and 60-08, and
  the record was corrected rather than quietly flipped — but two plans were
  written against a wrong premise first.

- **The citation ledger drifted, and no phase was allowed to fix it.** Phase 58
  built a machine-read ledger precisely to stop citations going stale, and by the
  phase close five of its own `.planning/` anchors no longer resolved — leaving
  the full-glob suite at 2 failures. The cause is structural rather than
  careless: none of 61-01, 61-02 or 61-03 declared `.planning/ROADMAP.md` or
  `.planning/REQUIREMENTS.md` in `files_modified`, so repairing them was outside
  every executor's sanctioned scope, and all three correctly complied. It was
  filed as a **high** todo and repaired at the milestone close instead — which
  turned out to be the only right place, since the close rewrites both cited
  files and any line-bump done in-phase would have been stale within hours. A
  guard over citations is itself a citation-holder, and its citations need an
  owner that outlives a phase.

- **Line movement was the hidden cost of generating README.** Every Phase 61 task
  that moved a README line forced re-anchoring the ledger's line ranges in three
  places at once — the ledger JSON block, the document body and the YAML
  frontmatter — because the guard fails a ledger entry with no body occurrence
  *and* a body citation with no ledger entry. Correct, and paid three times.

- **Estimation ran ~3.3× high.** ~695k tokens estimated across the 19 plans
  against ~213k actual. The direction is safe but the magnitude is not useful for
  sequencing.

### Patterns Established

- **Declaration → structural gate → named readers.** One data file; one test that
  polices its *shape* (`assertLocationBlockShape`, `assertKindAndMarker`,
  `assertNoReservedToolId`); each consumer a named exported reader rather than an
  inline parse. Adding a fact becomes a one-file edit with a guard that notices.

- **A "nothing changed" requirement earns a differential, not a unit test.** The
  failing-set-difference evidence note — full glob, real processes, before and
  after, regression list stated — is now a shipped artifact shape this project has
  three committed instances of.

- **Refuse at the layer that failed; never fall through.** A malformed
  `tools.json` entry does not quietly become a `$PATH` probe. The refusal names
  the layer, the id and the remedy, quoted from the declaration.

- **Guard a generated region by parsing it back into records.** Tolerant of
  presentation, intolerant of facts, with the regenerate command in every failure
  string.

### Key Lessons

- **A success condition of "nothing changed" cannot be verified by the tests of
  the thing that changed.** This milestone's strongest evidence came from the one
  check that stepped outside the changed code entirely, and it found two
  regressions that every in-phase test agreed were not there.

- **Drop a scope item at the discussion gate, and record the gap it leaves.** The
  doctor's removal was correct and cheap. What makes it honest is the ✗ entry in
  Validated and the named open question in Next Milestone Goals — the milestone
  shipped 15/15 *and* did not close the ground truth it opened against, and both
  are true.

- **Three gap-closure plans on one requirement is a specification signal, not an
  effort signal.** `LOC-03` was widened three times because "a developer notices
  nothing" was never decomposed into which variable shapes count. Decomposing it
  at plan time would have cost one paragraph.

- **Carrying is not free, and the second carry is the one to watch.** Phases 51,
  53, 54 and 57 have now been carried through two closes. The v1.0.0 close named
  reconciling the 2026-09-14 retirement as "the first task of the next
  milestone"; the next milestone took a different scope by owner decision, and
  the item is repeated verbatim rather than restated softer.

### Cost Observations

- Plans: 19 across 4 phases (mean ~4.75/phase; range 3-8)
- Tasks: 44 | Commits: 193 since the `v1.0.0` tag (61 recorded as plan commits in
  summary `actuals`) | Timeline: 4 days (2026-09-16 → 2026-09-19)
- Tokens (summed from summary `actuals`, all 19 plans carry them): **~213k**,
  against **~695k** estimated — a 3.3× over-estimate, the largest recorded gap
- Notable: **Phase 60 alone is 8 of the 19 plans and 20 of the 44 tasks** — the
  wiring phase cost more than the two phases that built what it wired, combined.
  Three of its eight plans are successive gap closures on a single requirement.

## Milestone: v1.0.0 — The Rebuild Half

**Shipped:** 2026-09-16 (`override_closeout`)
**Phases:** 9 closed (45-50, 52, 55, 56), 4 carried forward (51, 53, 54, 57) | **Plans:** 73 | **Tasks:** 203 | **Requirements:** 33/33 in-scope, 15 carried

### What Was Built

**The "and rebuild" half — claimed in `PROJECT.md`'s first sentence since v0.1.x,
and until now the one thing the tool could not do.** An annotated store exports
as a real *directory* of ACME source, one file per scope wired by `!source`, with
data tables extracted to sibling `.bin` files. Real ACME 0.97 reassembles it
byte-identically. A person edits it, and the rebuild is shown behaving
identically to the original on genuine stock VICE 3.9 — `VERDICT: PASS`, exit 0,
empty difference set — under the same narrowed mask that a planted three-bit
regression had already been watched failing.

**A reassembly gate that was written before it could be influenced.** Seven
inputs, twelve first-match-wins rules, an 864-combination totality proof — all
frozen in git *alone*, in a commit containing no measurement, and then run. It
returned **`red` under rule `R7`** on its first real subject and shipped red.

**One backend, honestly described.** The fork is gone entirely — `vice.ts`, its
manifest, its probe, `capability-registry.ts`, ~1,800 lines of proxy forwarding —
and the three capabilities stock provably cannot have are recorded as permanent
accepted losses rather than routed somewhere that no longer exists.

**About 2,900 lines of test code deleted on purpose**, under the owner's
data-driven-tests-only rule, with the suite's drop reconciled case by case so a
silently broken file could not hide inside an expected decrease.

### What Worked

**Committing the instrument before the thing it measures — now the project's
default, not an experiment.** Phase 49 froze the gate before any measurement
existed. Phase 50 committed `compare-cross-binary.mjs` before any rebuild existed
to compare under it. Phase 45's completeness gate was proven non-vacuous by three
planted controls watched going RED against a *real* store. In every case the
sequence made the verdict derived rather than argued, and in Phase 49's case it
is the only reason a `red` first result was publishable instead of embarrassing.

**Running the milestone audit.** After **five consecutive closes without one**,
this milestone ran `/gsd-audit-milestone` — and it changed the outcome. It found
15 requirements that were not merely unmet but *unimplementable as written*, a
phase marked complete with no verification artifact of any kind, and a live
requirement whose subject file had been deleted. None of that was visible from
the per-phase verifiers, all of which had passed. **The audit is what made a
scope-split close possible instead of a false "shipped with known gaps".**

**Measuring instead of adjudicating.** When the audit found two records
disagreeing about whether `vice-proxy.test.ts` hangs, it ran the suite rather
than deciding which document to believe: it terminates, green, empty failing set. The
same move retired a "3-failure floor" that had been copied forward through every
phase transition of the milestone without anyone re-running it.

**Disclosure over smoothing, repeatedly and at cost.** Phase 48's synthetic
subject does not visibly show its four planted effects in combination; the root
cause is unknown and the finding was **not** retracted. Phase 50's criterion 5
rests on a CI red observed locally, because the developer was asked for a real
runner and declined — recorded as a *declined verification, not a passed one*.
Phase 45 disclosed a `$DD00` curated-table gap rather than working around it
quietly.

### What Was Inefficient

**A quick task retired a convention and nobody reconciled the documents.** The
single most expensive thing that happened this milestone. On 2026-09-14 an
owner-directed quick task deleted 60 files and retired the planning-vocabulary
convention outright. Its own summary said the orchestrator would update
`STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md`. That never happened. For two days
Phase 51 had nine live plans and four requirements pointed at a deleted guard,
and the drift was only caught because this milestone ran an audit. **Eight plans
of genuinely useful work (755 citations rewritten) now sit behind a re-scoping
decision that should have been made the same day.**

**Phase 55 shipped with no gate at all.** Six plans, all reporting complete, a
`docs(phase-55)` close commit, and no VERIFICATION.md, VALIDATION.md or
REVIEW.md. Its ROADMAP checkboxes are still unticked and the two todos its work
closed in code are still filed pending. The work is real — independently traced
to live code and re-measured at the audit — which is exactly why the missing gate
went unnoticed: nothing downstream broke.

**Requirements written against mechanisms that then got deleted.** `FORKRM-02`
required a specific test file be *rewritten rather than deleted*; Phase 52 did
exactly that, and it was deleted two days later. `DOCS-04`'s entire subject is now
a deleted file, and the 7-citation finding that motivated it measures 0. A
requirement that names a *file* rather than a *property* cannot survive a
deletion sweep.

**Three phases were added to a closed roadmap and never started.** v1.0.0 opened
with 15 requirements across 6 phases and ended carrying 48 across 13. The 33 it
delivered were almost entirely the original scope; nearly everything added
mid-milestone went unexecuted.

### Patterns Established

- **The instrument is committed alone, in a commit with no measurement in it.**
  Not merely "before" — *alone*, so the diff proves it could not have been shaped
  by a result.
- **A gate's first real result is published whatever it says.** `red` under `R7`
  shipped. Phase 50 later got `acknowledged` under `R10` from the same table,
  which is what proved the table discriminates rather than always refusing.
- **Losslessness is proven by a planted control that wants to violate it.** A
  test-only filtering variant is watched dropping a range (RED) before the real
  exporter is trusted to keep it (GREEN).
- **A milestone may close on a subset and carry the rest with its text live.**
  Established at v0.6.0 for held Phases 24 and 26; used deliberately here for the
  first time as a *close strategy* rather than a gate outcome.
- **An acknowledge-refusal is recorded, not discarded, and does not halt a
  close.** Fourth consecutive close for the same 8 un-acknowledgeable table rows.

### Key Lessons

1. **Run the audit.** Five closes skipped it on the reasoning that every phase
   verifier passed. Every phase verifier passed this time too, and the audit
   still found 15 unimplementable requirements and an ungated phase. Per-phase
   verification cannot see cross-phase or post-hoc drift by construction.
2. **A quick task that retires a *convention* must reconcile the planning
   documents in the same pass, or name an owner who will.** "The orchestrator
   handles it" is not an owner.
3. **Write requirements against properties, not filenames.** Every requirement
   that broke this milestone broke because it named a specific file that a later,
   legitimate decision deleted.
4. **Re-measure inherited claims before copying them forward.** The 3-failure
   floor was false and was restated at every phase transition for a week. The
   `vice-proxy.test.ts` hang warning is false and is still being written into new
   documents.
5. **A phase with no verification artifact will not announce itself.** Nothing
   downstream of Phase 55 broke, so nothing surfaced it until an audit
   cross-referenced three independent sources.

### Cost Observations

- Plans: 73 across 9 closed phases (mean ~8/phase; range 6-13)
- Tasks: 203 | Commits: 619 since the `v0.9.0` tag | Timeline: 6 days (2026-09-10 → 2026-09-16)
- Tokens (summed from plan `actuals`): ~1.98M across the closed phases
- Notable: the two largest phases by plan count (52 at 13, 56 at 11) were both
  *deletion* phases. Removal cost more plans than any feature phase in the
  milestone — Phase 52 alone found five consumers neither the plan nor the
  orchestrator's own measured consumer-map had named.

## Milestone: v0.9.0 — The Text Channel and the Runtime Evidence Layer

**Shipped:** 2026-09-10 (`override_closeout`)
**Phases:** 6 (39-44) | **Plans:** 51 | **Tasks:** 123 | **Requirements:** 20/20 in-scope

### What Was Built

A **second monitor channel** to the same running emulator. The `-remotemonitor`
text port the broker had appended to every stock launch since Phase 3, and that
nothing had ever dialed, is open end to end — after a pre-committed gate
answered from live measurement whether a second client could exist at all.
Both channels pass through one FIFO mutex (`channel-lock.ts`), and a machine
merely contended between them now reports contention **by name** instead of
being diagnosed as wedged and recycled.

**Five human-formatted text outputs became structured data**: `memmapshow`,
`chis`, `bt`, `prof flat` and `io`, each with exactly one owning parser,
fixtures pinned to the two real VICE binaries they came from, and every closed
vocabulary refusing by name on drift rather than decoding a plausible-looking
wrong answer.

**A third independent classifier.** `anno_evid_exec` at `SCHEMA_VERSION` 4
stores what the emulator was *observed* executing, keyed by run identity,
monotonically accumulating, joined against the byte-derived block table by a
query that reports **disagreement first**.

**`PROOF-01`'s named reversal condition, closed** — its false-positive count is
computable for the first time: 168/45072 at anchor hit 50, 434/45072 at hit
3000, both recorded beside each other.

Plus two new skills (`c64-petcat`, `c64-disk-access`) on the existing
`host_tool` seam, and every tool-written path consolidated under one
`.c64-re-tools/` root.

### What Worked

**Freezing a gate's rules *and* a totality proof before taking any measurement.**
Phase 39 committed `CHAN-01`'s R1..R15 plus a 3,888-tuple executable proof that
every input combination maps to exactly one verdict — before any of the seven
measurements existed. The gate then returned **`go`** on rule `R15`, the first
`go` any of this project's four gates has produced. Nobody had to argue about
it, and `could-not-run` was structurally unemittable. This is now three
consecutive milestones where a pre-committed gate was honoured (`no-go` at
v0.6.0, `degrade` at v0.8.0, `go` here) — the practice has survived every
verdict, including the one that cancelled a milestone.

**Measuring the remedy, not merely its availability.** Phase 41 did not settle
for "`device c:` should reset `default_memspace`". It armed a real drive
checkpoint over the whole 1541 ROM range, watched main-CPU `ADVANCE_INSTRUCTIONS`
freeze at a fixed PC, then watched `device c:` restore forward-stepping — on
genuine stock `/usr/bin/x64sc`. The contamination itself was exercised, not just
the remedy's reachability.

**Letting a live run surface findings instead of confirming a plan.** Phase 42's
live run produced two genuine live-only discoveries — a session-boundary
prompt-doubling transport artifact and a real production gap in
`vice_profile_flat` — plus a parser-correctness fix. All were recorded honestly
rather than smoothed over, and the phase took two gap-closure rounds as a
result.

**Refusing by name, everywhere.** The milestone's most repeated pattern: a
`CIA1`/`SID` address refused by the chip's own name rather than reported as a
malformed VIC-II reply; an incomplete decoded-prose object refused as
`incomplete-decoded-state` rather than cast; a cold profiler reported as
`profiling-not-started` rather than "could not be parsed". Each replaced a
plausible-looking wrong answer with a named one.

### What Was Inefficient

**Phase 42 cost 16 plans across two gap-closure rounds** — nearly a third of the
milestone's total, for four requirements. The parsers themselves were
straightforward; the cost was in the gap rounds (CR-01, WR-02, G2, G3, G5), most
of which were quality findings on freshly written code rather than integration
surprises. A tighter first pass on the refuse-by-name discipline would have
folded several of them in.

**The same 8 scanner false positives were re-investigated for a third close.**
Phase 23's evidence *tables* are read as deferred items by `audit-open` and
cannot be acknowledged by its writer. The v0.8.0 close left an explicit note
saying a future close should "re-disclose rather than re-investigate" — and this
close still spent the effort re-deriving the refusal once before trusting the
note. The note was right; the fix belongs upstream in the scanner.

**Bookkeeping drift needed a dedicated plan, twice.** Plans 40-08 and 40-11
existed largely to bring `REQUIREMENTS.md` / `ROADMAP.md` / `STATE.md` back into
agreement with what earlier plans had actually landed, including a
`19/19`-vs-`20/20` requirement count that was stale in one document for days
after a mid-milestone scope change. Two owner-directed scope changes
(`PREP-03` out, `PREP-05` in) landing mid-phase is the underlying cause.

### Patterns Established

- **Freeze the totality proof with the rules.** A gate is only derived rather
  than judged if every input combination provably maps to exactly one verdict,
  and that proof is committed before the inputs exist.
- **One mutex per *machine*, not per channel.** Two independent locks would have
  let a text command land inside a held binary wait. The single cross-channel
  lock also caught a real design error at registration time — two new tools had
  to be `needsSession:false` or they would self-deadlock against it.
- **A destructive verdict needs a non-destructive sibling before you add a
  second client.** `wedged` authorises a recycle; contention looks identical on
  stock's `accepted-then-silent` wire. Shipping the second channel without
  `CHAN-05` would have made the triage playbook destroy healthy instances.
- **Absence is a count, never a class.** `RuntimeExecClass` has no `data`
  member, so "never observed executing" cannot be rendered as evidence of data
  by any code path. The soundness asymmetry is enforced by the type, not by
  reviewer care.
- **Record two measurements beside each other when neither supersedes the
  other.** Phase 44 published both anchor depths against one identical subject
  digest rather than picking the more defensible number.
- **Re-scope a constraint rather than deleting it when it turns out to be
  narrower than written.** Three `CLAUDE.md` constraints were each literally
  true but silently scoped to the binary monitor; all three were amended with
  dated riders naming the channel, not removed.

### Key Lessons

1. **A gate that has returned `no-go`, `degrade` and now `go` is a working
   instrument, not a formality.** The `go` is the weakest evidence of the three
   — it is the verdict that lets you proceed — which is exactly why freezing the
   rules beforehand mattered most here.
2. **Opening a channel is cheap; making two channels safe is the work.** Phase
   41's port-dialing was the small part. The mutex, the per-channel holder map,
   the contention verdict, and deleting the warm floor's speculative
   pre-launching were the milestone.
3. **A milestone that adds a new *kind* of fact must state what the fact cannot
   say.** The runtime evidence layer's value depends entirely on never letting
   "unobserved" drift into "data" — so that was enforced structurally on day one
   rather than reviewed for later.
4. **Owner-directed mid-milestone scope changes need a bookkeeping owner.** Two
   changes (`PREP-03`, `PREP-05`) produced stale counts in three documents and
   two remediation plans. The scope change itself was correct both times.
5. **Five consecutive closes without a milestone audit is now the norm, not a
   lapse to flag each time** — but v0.7.0's `STORE-03` contradiction has now
   been carried by *three* milestones, which is the concrete cost the trend was
   flagged to surface.

### Cost Observations

- Timeline: 5 days (2026-09-06 → 2026-09-10), 360 commits, 401 files changed
  (+188,417 / −7,702)
- Plans per phase ranged 3 (Phase 44) to 16 (Phase 42) — the widest spread of
  any milestone so far
- Live-emulator measurement appeared in five of six phases, against genuine
  stock `/usr/bin/x64sc` VICE 3.9
- **0 new npm dependencies and 0 new external prerequisites** — the text channel
  is a hand-rolled line protocol over a raw socket; `c1541` and `petcat` resolve
  as siblings of the already-resolved `x64sc`

## Milestone: v0.8.0 — Frame-Exact Capture and the Two Engines

**Shipped:** 2026-09-06 (`override_closeout`)
**Phases:** 6 (33-38) | **Plans:** 47 | **Tasks:** 118 | **Requirements:** 43/43

### What Was Built

A reproducible-run protocol and the capture substrate under it: five launch
nondeterminism sources pinned in `buildViceArgs()`'s stock branch, a monitor-issued
reset that makes two runs of a real cracked release stop in the same frame and
capture byte-identically, and a flat 64K sliced out of a VICE `.vsf` snapshot's
`C64MEM` body by a strict module-table walk — eight named refusals, each proven by
its own fixture. Behind `GATE-01`, whose rules were committed at `2a8ef95` before
any measurement existed and which returned **`degrade`** by rule `R6`.

On top of it, a host-tool execution seam — one typed `host_tool` control op on the
existing broker socket carrying six tools, with every other route banned by
`check-no-skill-external-spawn.mjs` in CI — and two disassembly engines reached
only through it: a vendored, digest-verified dxa 0.1.5 behind a listing parser that
refuses by name rather than by exit status, and Ghidra 12.1.3 under a vendored NMOS
6502 SLEIGH language that decodes all **105** opcode bytes stock `6502.slaspec`
omits. Their output imports into `.annostore` as typed `anno_xref` rows and joins
against `memmap.json`'s 959 entries into comments — narrowest-range-wins, in-image
addresses skipped, `$01` bank state resolved *before* address, and a decline with a
named reason wherever the reaching bank values disagree. Finally `PROOF-01`..`03`,
the three measurements Phase 23 recorded `could-not-run`, taken on real cracked
code and stated beside the fixture figures rather than replacing them.

### What Worked

**Committing the verdict rules before the measurements, for the second time.**
Phase 33 reused Phase 23's pattern and fixed its one structural defect: `R9`
carried no antecedent in Phase 23, so `could-not-run` could fire. Phase 33 walked
all **108** input tuples for totality, leaving `could-not-run` structurally
unemittable, and `git rev-list --count 2a8ef95 -- <evidence>` was re-run after every
measurement landed to prove the rules commit still preceded them. The gate then
returned `degrade` and the one available override was **explicitly declined** with
the reasoning written down. A gate is only worth building if the unflattering value
is reachable and reached.

**Spending whole plans making the failure happen.** Three of this milestone's
silent failure modes were known in advance to be silent, and each got a plan whose
deliverable was a *red* observation, not a green one: three scratch-copy mutations
of `memmap-lookup.ts` each producing a specific named wrong answer against the real
`memmap.json` (37-04); the in-image guard deleted so `$0800` annotates as
`"Unused"`, with an injected counting spy proving the lookup is genuinely reached
under the mutation and genuinely unreached without it (37-05); and the graphics
feedback measured at **512 phantom labels before, 0 after** on a live Ghidra run
(37-08). The committed modules were never touched. Asserting a fix is present
proves nothing against a failure that is silent by construction.

**Proving a carve by disappearance rather than by presence.** Phase 36 set out to
prove the volatile-I/O carve through the existing `## REFERENCES` export section
and live measurement showed that section *never reflects the flag at all* — so the
plan added `## DECOMPILED_TEXT` and proved the carve by what vanishes from it. The
measurement corrected the plan rather than the plan surviving the measurement.

**Live-running the thing before trusting the unit test.** Plan 37-02 ran plan
37-01's importer against a *real* captured Ghidra export and found two defects no
test had ever reached — a mis-parsed `## CLASSIFICATION` accounting tail, and a
total refusal of Ghidra's own bare-hex address rendering. The importer had passing
tests. It had never seen real output.

**Refusing to award a winner.** `dxa-listing.ts` disposes any overlapping decode as
`unclassified` with a stated reason **even when the two claims agree**. Agreement
between two decoders is not evidence; it is two decoders agreeing.

### What Was Inefficient

**Two phases carried half the milestone again.** Phases 33 and 34 hold 23 of 47
plans (49%) — the same shape v0.7.0 recorded, where two phases carried 53%. Phase
33 spent plans voiding its own first measurement pass under `D-11` (correct, but
paid for twice), and Phase 34 spent three plans (34-07/08/09) closing code-review
findings `CR-01` and `CR-04` after the phase's gap-closure round had already run.

**A forecast was carried into the milestone as fact and cost re-planning.** The
milestone was *opened* on VICE event record/replay as the reproducibility
mechanism. It does not exist — `event.c` registers six options, none of them
`-record`; `x64sc -record` exits 255. Measured on 2026-09-02, at the open, not
during Phase 33. Similarly `docs/undocumented-opcodes-ghidra.md` was carried as
766 working lines and did not compile (8 failing constructors, one root cause), so
`OPC-01` became fix → compile → integrate → verify. Both were caught by
milestone-open research rather than mid-phase, which is the cheap place to catch
them — but both had stood in `PROJECT.md` as settled claims for a milestone or more.

**Eleven of 21 carried requirement ids were amended against an explicit forecast
that they would carry byte-identically.** The forecast was written into
`ROADMAP.md` at the v0.8.0 open and corrected there eleven ids later.

**Scratch fixtures written inside walked trees, twice, still unowned.** Two tests
write scratch files into directories another test's directory-walk observes
(`src/skills/acme-build/`, `resources/vendor/dxa/`). Node runs test files
concurrently, so `audit-root-args.test.ts` fails scheduling-dependently. The
culprit is named, the fix is one idiom (`mkdtemp`) already used by
`dxa-live.test.ts` — and no pass owns it, so it shipped.

### Patterns Established

- **A verdict rule set must be total over its input space, and the totality walk is
  an artifact.** 108 tuples enumerated, not argued about.
- **Vendor the engine, declare the platform.** dxa (small, buildable) is vendored
  with its GPL headers quoted; Ghidra (543 MiB) is declared by version with a
  digest and installed out of tree. Size decides, not principle.
- **One typed control op per host binary, with the ban written as a CI gate before
  the second consumer exists.** `HOST_TOOL_PATH_ARG_KEYS` made "no argv
  passthrough" a census-driven refusal loop rather than three point fixes.
- **A real-corpus absence is a reportable result.** `not-exercised` is a
  first-class PROOF verdict, distinct from both `pass` and `could-not-run`, and it
  is scoped to the corpus and the depths searched rather than generalised.
- **State the real-release figure beside the fixture figure, never in place of it.**
  `100.00 (24/24)` sits next to `72.39 (97/134)` and the pivot's unreproduced
  `72.46 (100/138)`, with the non-reproduction labelled a hypothesis.
- **Enumerate independently, before the tool runs, and assert the document
  ordering.** Phase 38's `$6C` dispatch enumerator ran before each `analyzeHeadless`
  invocation so the count could not be a rationalisation of Ghidra's answer.

### Key Lessons

1. **A gate earns its keep on the run where it returns the unflattering value.**
   `GATE-01` returned `degrade`, `R7`/`R8`/`R9` went unevaluated because first-match
   wins, and an unevaluated rule was recorded as unevaluated rather than satisfied.
   Phase 23 was the first gate honoured; this is the second, and the pattern is now
   the project's default for any measurement-gated milestone.
2. **A passing test suite is not evidence the code has met its real input.** Two
   live-only importer defects existed under green tests until a real Ghidra export
   was fed through. Prefer one live run over ten more fixtures.
3. **Prove the carve by absence, and let the measurement rewrite the plan.** Phase
   36's export section could not have shown the carve; discovering that *was* the
   plan's work product.
4. **The audit skip has now cost what the last retrospective predicted it would.**
   v0.7.0's lesson 5 said: *"A second milestone carrying the same row would be
   evidence the audit should not have been skipped twice."* `STORE-03`'s row/prose
   contradiction has now shipped through a second close. That prediction resolved
   against the project. This is the **fourth** consecutive close without an audit.
5. **A known-red test with a named cause is not a resolved test.** The
   `anno-register.test.ts` 2-fail floor has a fully understood root cause — the
   register cites v0.7.0 ids no v0.8.0 requirements document declares — and it has
   been understood since Phase 33 opened. Understanding it did not fix it, and it
   shipped. Deliberately no Deferred Items row is filed, because a row with no
   matching pending todo reds the ledger guard in the other direction; that is a
   real constraint, but it also means the item has nowhere to live.
6. **Two consecutive closes have now paid the same un-acknowledgeable-items tax.**
   The 8 Phase 23 evidence-table rows are structurally unclosable and will be
   re-derived at every future close until the scanner changes. Re-disclose; do not
   re-investigate.

### Cost Observations

Not instrumented — no per-model or per-session accounting was collected, so no mix
is reported rather than an estimated one. What is measured: 365 commits over 5 days
across 6 phases and 47 plans; 1,014 files changed (+290,305 / −27,971) tree-wide,
of which 238 files and +48,264 / −9,066 are source. The planning tree accounts for
**82%** of the insertions — 237,629 of 290,305 — which is the clearest available
signal of where this project's effort actually goes, and is worth watching rather
than acting on immediately. **Zero new npm runtime dependencies**, holding a streak
now four milestones long, while adding two external engines as declared host
prerequisites instead.

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
byte-preserved. And the external analyser deleted outright — 14 files, 8,221 lines,
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
strongest instance this milestone: a *real* unclassified `anno-*.ts` was created
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
The external analyser, and the engine coupling goes with it. That is what made a
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

an external analyser session that survives many tool calls, with crash recovery,
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
  `absorbed-answer-key.test.ts` red, because both read `.planning/phases/` directly
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

## Milestone: v0.3.0 — the external analyser static-analysis backend

**Shipped:** 2026-08-21
**Phases:** 4 (9, 10, 11, inserted 11.1) | **Plans:** 36 | **Tasks:** 101
**Timeline:** 3 days (2026-08-19 → 2026-08-21) | **Commits:** 268 since `v0.2.0`
**Final audit:** round 2 — **`passed`**, zero open gaps, Nyquist compliant across all four phases

### What Was Built

A second axis. v0.2.0 was about *which* live emulator qualifies; v0.3.0 is about
what survives the session. The external analyser is adopted as a required,
container-side, static-analysis-only prerequisite reached through 17 curated
`anno_*` tools and 7 `vice-mcp anno` CLI verbs:

- **A go/no-go probe phase** that drove a real analyser 0.9.20 against
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

- **A gate that can say no, honoured when it did.** `ANNO-16` was promoted from a
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
- **Structural satisfaction beats remembered discipline.** The `anno_*` family
  satisfies CLAUDE.md's derived-tool path-translation constraint by construction —
  neither `rewriteArguments()` call site is reachable from it — so there is no
  interception for a future refactor to forget.
- **Density.** 36 plans in 3 days against v0.2.0's 87 in 8, with a `passed` audit
  instead of `tech_debt`. Smaller scope helped, but so did arriving with the
  research already done (`notes/external-analyser-integration.md`) and refusing to
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
| v0.8.0 | 6 | 47 | First milestone measured on **real cracked code** rather than a synthetic fixture. Second pre-committed gate honoured (`degrade`, `R6`), this one proven **total** over its 108-tuple input space. Introduced the typed host-tool control op with its ban written as a CI gate, `not-exercised` as a first-class verdict, and proving a carve **by disappearance** |
| v0.9.0 | 6 | 51 | First **`go`** from a pre-committed gate — the third distinct verdict (`no-go`/`degrade`/`go`) the practice has produced and honoured. First time the project drives one emulator over **two concurrent channels**. Introduced the totality proof frozen alongside the rules, one mutex per *machine* rather than per channel, a non-destructive sibling to a destructive verdict, and absence-as-a-count enforced by the type system |
| v1.0.0 | 9 closed, 4 carried | 73 | **First milestone audit in six closes — and it changed the outcome.** Every per-phase verifier passed; the audit still found 15 requirements unimplementable as written and a phase complete with no gate. Introduced closing on a **subset** with the remainder carried and its text live (a close strategy, not a gate outcome), the instrument committed *alone* in a measurement-free commit, and publishing a gate's first real result whatever it says (`red`, `R7`) |
| v1.1.0 | 4 closed, 4 still carried | 19 | **First milestone that adds nothing to what a session can do** — scoped entirely upstream of the Core Value at its open, and the first whose own centrepiece (the doctor) was dropped mid-flight by owner decision *before any plan for it existed*. Introduced the single declaration read by every consumer, the layered `env → file → $PATH` resolution seam that refuses at the layer that failed rather than falling through, the failing-set-difference note as the evidence shape for a "nothing changed" requirement, and guarding a generated document region by parsing it back into **records rather than bytes** |

### Cumulative Quality

| Milestone | Tests (approx. green) | Live-evidence suites | Zero-Dep Additions |
|-----------|-----------------------|----------------------|--------------------|
| v0.2.0 | ~1400+ | 3 (`stock-live`, `stock-live-triage`, `stock-broker-live`) | disassembler, PETSCII table, all derived tools — 0 new npm deps |
| v0.3.0 | ~2066 | 3 carried + anno live gates (real `the external analyser 0.9.20` + genuine stock `x64sc`) | `.regen2000proj` synthesiser, `.d64` reader, NDJSON JSON-RPC client, ACME-ident seam — 0 new npm deps |
| v0.4.0 | **2351** (0 fail, 39 skipped, 5 todo, 24 suites) | 4 carried + `fork-live.test.ts` (the fork's `-mcpserver` HTTP transport exercised live for the first time, 6/6) | `audit-gate.mjs`, `hop-chain-comments` + `comment-phase-pointers` guards, `skill-corpus.mjs`, 18 `wireMcp()` cases — 0 new npm deps |
| v0.7.0 | 0 failures on `test:automated` (the project's floor; the whole-glob `npm test` still does not terminate unaided — `vice-proxy.test.ts` leaks two LISTEN sockets) | real ACME 0.97 as a byte-diff oracle, hard-failed in CI with `VICE_REQUIRE_ACME=1` | the annotation store on `node:sqlite` — a **built-in** at this project's Node floor; `better-sqlite3` rejected on 11.4 MB/consumer and 8 prebuild targets — 0 new npm deps |
| v0.8.0 | **2 failures in 1 file** on `test:automated` (`anno-register.test.ts` `:385`/`:479` — the register cites v0.7.0 ids no v0.8.0 requirements document declares; root cause named, unfixed). ~3113 tests. The whole-glob `npm test` still does not terminate unaided | real dxa 0.1.5 and real Ghidra 12.1.3 as live oracles — `ghidra-live.test.ts` and `ghidra-opcode-live.test.ts` are the 11th and 12th manual-only files | a vendored, digest-verified dxa 0.1.5 build and a vendored NMOS 6502 SLEIGH language, both reached over the host-tool seam — Ghidra declared by version rather than vendored (543 MiB) — **0 new npm deps** |
| v0.9.0 | **3 failures in 2 files** on `test:automated` (`anno-register.test.ts` `:385`/`:479` and `anno-import.test.ts` `:352` — same root cause as v0.8.0, now with `IMP-*`/`AUTO-*` ids joining the `STORE-*`/`MCP-*` ones; still unfixed, still named). 4051 tests, 4033 pass, 10 skipped, 5 todo, 24 suites. **Measured after the close's own `git rm` and ROADMAP collapse**, which reddened nothing — the `requirementsPath()` archive fallback added at v0.7.0 held. Beside the floor sits the intermittent `audit-root-args.test.ts` scratch race (a *second*, orthogonal hazard the v0.8.0 `mkdtemp` fix does not touch) | genuine stock `/usr/bin/x64sc` VICE 3.9 across five of six phases; `text-monitor-live.test.ts` joins the manual-only set with a teardown assertion proven able to go red | the text-monitor line protocol hand-rolled over a raw socket, `channel-lock.ts` (a FIFO async mutex), five zero-import format parsers, and `anno_evid_exec` on the built-in `node:sqlite` — **0 new npm deps, and 0 new external prerequisites** (`c1541`/`petcat` resolve as siblings of `x64sc`) |
| v1.0.0 | **0 failures** on `test:automated` — `tests 3701 / pass 3692 / fail 0 / skipped 9 / EXIT=0`. The 3-failure floor carried since v0.8.0 is **closed**: `anno-register.test.ts` and `anno-import.test.ts` are both green, the citing entries removed by Phase 52's reconciliation and the 2026-09-14 deletions. The whole-glob `npm test` **also terminates and is green** — `3858 / 3777 / 0 / 81` — retiring a hang claim three later artifacts still repeat. (Wall time is load-dependent and is **not** the invariant: 67.6s at the audit, 193s re-measured at the close on the same machine. The counts were byte-identical both times; only the duration moved.) Measured twice, independently (audit and close), and again after this close's own `git rm` and ROADMAP collapse | real ACME 0.97 as a byte-diff oracle across the whole rebuild chain; genuine stock `x64sc` VICE 3.9 for the equivalence and modifiability runs, including three planted single-bit regressions each producing its own named DIVERGENCE row | the reassembly gate's twelve-rule decision table, the multi-file ACME tree exporter, `compare-cross-binary.mjs`, and the four-class movement-hazard report — **0 new npm deps, 0 new external prerequisites**. Net **negative** dependency change: the fork backend and ~2,900 lines of test code were removed |
| v1.1.0 | **0 failures** on the whole `npm test` glob — `tests 4051 / pass 3970 / fail 0 / skipped 81 / EXIT=0`, measured **after** this close's own ROADMAP collapse, `git rm` and PROJECT.md rewrite rather than before them. That run is the second of two at this close, and the first is the more useful record: it came back **2 failures**, both `phase58-citation-ledger.test.ts`, and both **pre-existing** — proven by re-checking every ledger anchor against `git show HEAD:.planning/ROADMAP.md`, where all four already missed. The close repaired them rather than disclosing them, because four of the five cited files the close itself rewrites; they now cite the immutable milestone archives. Failing sets compared, not counts: `{provenance-ledger, phase59-ledger}` → `{}` | genuine stock `x64sc` VICE 3.9 unchanged from v1.0.0 — this milestone added no live oracle, which is consistent with a milestone that adds no session capability. Its own evidence shape is the **failing-set-difference note**: full glob, real processes, pre- and post-rewiring trees diffed, three committed instances | the tool-location seam, the prerequisite declaration and its structural gate, and the README generator with its fact-comparing guard — **0 new npm deps, 0 new external prerequisites**. The eight prerequisites were already required; this milestone is the first time they are *declared* rather than described in prose |

| Milestone | Audit verdict | Rounds | Open gaps at close | Deferred at close |
|-----------|---------------|--------|--------------------|-------------------|
| v0.2.0 | `tech_debt` | 4 | 0 blocking | 13 (hand-counted) |
| v0.3.0 | **`passed`** | 2 | 0 | 19 (derived + guarded both directions) |
| v0.4.0 | `tech_debt` | 1 | **0** | **0** pending todos (+ 9 promoted with named owners; 16 bookkeeping items acknowledged) |
| v0.5.0 | not run | — | — | 5 newly acknowledged, 16 carried |
| v0.6.0 | not run (gate's findings doc is the audit of record) | — | intent NOT delivered under 3 accepted overrides | — |
| v0.7.0 | **not run** | — | 0 against its own 28 requirements | 15 newly acknowledged, 21 carried, **8 disclosed as un-acknowledgeable** |
| v0.8.0 | **not run** | — | 0 against its own 43 requirements; `GATE-01` returned `degrade` (`R6`) | 4 newly acknowledged, 31 carried, **the same 8 disclosed as un-acknowledgeable for the second close running** |
| v0.9.0 | **not run** | — | 0 against its own 20 in-scope requirements; `CHAN-01` returned **`go`** (`R15`) | 6 newly acknowledged, 33 carried, **the same 8 disclosed as un-acknowledgeable for the third close running** |
| v1.0.0 | **`gaps_found`** | 1 | **15 carried forward rather than accepted** — 6 `VOCAB-*`, 4 `DOCS-*`, 5 `INSTALL-*`; 6 `PROXY-*` scored `partial` for want of a gate, not delivery. 0 gaps against the 33 it closed on | 11 newly acknowledged, 38 carried, **the same 8 disclosed as un-acknowledgeable for the fourth close running** |
| v1.1.0 | **not run** | — | 0 against its own 15 in-scope requirements; **no opening gate phase**. `DOCTOR-01..09` were dropped mid-milestone by owner decision and moved to Future Requirements unbuilt — not a gap found, a scope item withdrawn, with the question it leaves open recorded | 3 newly acknowledged, 49 carried, **the same 8 disclosed as un-acknowledgeable for the fifth close running** |

**The streak broke, and then resumed — read the two together** *(written at the
v1.1.0 close, 2026-09-19; every paragraph below is kept as written)*. v1.0.0 ran
a milestone audit, the first in six closes, and **it changed the outcome**: every
per-phase verifier had passed, and the audit still found 15 requirements
unimplementable as written and one phase complete with no gate at all. That is
the single strongest piece of evidence this document holds about the practice —
the per-phase verifier and the audit do not catch the same class of thing, and
the difference is not marginal.

v1.1.0 then closed **without** one. The reasoning was the same as the pre-v1.0.0
closes — all four phases `verification_status: passed`, 15/15 requirements
Complete — and it is recorded here as a decision rather than as a lapse, but with
the v1.0.0 result standing right beside it rather than folded away. Six of this
project's ten closes have now gone without an audit.

The specific cost named at the v0.9.0 close has **not** recurred in the same
form: `STORE-03`'s row/prose contradiction was carried by three milestones with
neither an audit nor a Phase 28 verification pass. What replaced it is a
different shape of the same thing. The v1.0.0 close named reconciling the
2026-09-14 retirement as *"the first task of the next milestone, not a cleanup
item"*. v1.1.0 did not do it, and no gate in v1.1.0 was capable of noticing,
because the item belongs to no phase in it. **An audit is the only instrument
this project has that reads across phase boundaries**, and the two concrete items
the trend has surfaced — `STORE-03` then the retirement reconciliation — are both
exactly that shape.

**Five consecutive closes without a milestone audit** *(updated at the v0.9.0
close, 2026-09-10; the paragraphs below are kept as written and extended, not
rewritten)*. v0.9.0 skipped it too, on the same reasoning as its two
predecessors — all six phases `verification_status: passed`. Two things are now
worth separating. **The trend has stopped being a warning and become the
project's actual practice**: five closes is not a lapse to re-flag each time,
and the per-phase verifier plus the pre-committed gates have caught what the
audits used to. **But the one concrete cost the trend was flagged to surface has
compounded**: `STORE-03`'s row/prose contradiction, routed by Phase 29 to "a
Phase 28 verification pass or a milestone audit", has now been carried by
**three** milestones (v0.7.0, v0.8.0, v0.9.0) with neither ever run. That is a
specific, named, cheap-to-close item that the practice demonstrably does not
catch — the argument for the audit is now that single item, not the streak.

**Four consecutive closes without a milestone audit** *(updated at the v0.8.0
close, 2026-09-06; the paragraph below is kept as written and extended, not
rewritten)*. The prediction it ends on has now **resolved against the project**:
v0.7.0's retrospective said a second milestone carrying `STORE-03`'s row/prose
contradiction would be evidence the audit should not have been skipped twice, and
v0.8.0 shipped carrying it. v0.8.0's own close skipped the audit again, on the
same reasoning — all phases `verification_status: passed` — which is exactly the
reasoning the trend was flagged to interrogate.

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
