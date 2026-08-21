# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

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

### Cumulative Quality

| Milestone | Tests (approx. green) | Live-evidence suites | Zero-Dep Additions |
|-----------|-----------------------|----------------------|--------------------|
| v0.2.0 | ~1400+ | 3 (`stock-live`, `stock-live-triage`, `stock-broker-live`) | disassembler, PETSCII table, all derived tools — 0 new npm deps |
| v0.3.0 | ~2066 | 3 carried + r2000 live gates (real `regenerator2000 0.9.20` + genuine stock `x64sc`) | `.regen2000proj` synthesiser, `.d64` reader, NDJSON JSON-RPC client, ACME-ident seam — 0 new npm deps |

| Milestone | Audit verdict | Rounds | Open gaps at close | Deferred at close |
|-----------|---------------|--------|--------------------|-------------------|
| v0.2.0 | `tech_debt` | 4 | 0 blocking | 13 (hand-counted) |
| v0.3.0 | **`passed`** | 2 | 0 | 19 (derived + guarded both directions) |

The deferred count rising 13 → 19 while the verdict improved is not a
contradiction: v0.3.0 is the first milestone whose ledger is *derived* from
`.planning/todos/pending/` rather than hand-maintained, and 4 of the additions
were surfaced by a guard that did not previously exist. The v0.2.0 figure should
be read as a floor, not a measurement.

### Top Lessons (Verified Across Milestones)

1. **An internal check does not substitute for an external one.** *Verified across
   both milestones — promote to a standing rule.* v0.2.0 met it four times as
   self-written tests validating understanding rather than code (green suites
   hiding 7 defects; fixtures stubbing the code's own assumption; an
   independently-derived opcode table still shipping 14 wrong entries; a registry
   that could not defend against a wrong bank address). v0.3.0 met it three more
   times in new disguises: a pre-measurement done by reading found 8 where
   measuring found 27; three research inputs treated as settled were wrong under a
   real build; and the three highest-value carried debt items are *still* exactly
   this — synthetic wire fixtures, an unconfirmed discriminator, four spec-driven
   wire details. Seven instances, two milestones, zero counterexamples.

2. **Coverage without a consuming gate produces false confidence.** *New in
   v0.3.0, watch for recurrence.* The completeness guard was correct, committed,
   running, and red under a commit asserting "all findings closed". The v0.2.0
   analogue is visible in hindsight: `08-REVIEW.md`'s `WR-04`..`WR-12` sat
   undispositioned for a whole milestone because nothing scanned for them. An
   artifact that exists but gates nothing is not evidence.

3. **Honour a gate the first time it fires.** *New in v0.3.0, one instance,
   recorded now because the counterfactual is unrecoverable later.* The `degrade`
   verdict was accepted and the milestone shipped smaller. Had it been overridden,
   nothing observable would have changed in v0.3.0 — the cost would have landed on
   every subsequent gate.

---
*Created 2026-08-19 at v0.2.0 milestone close. Updated 2026-08-21 at v0.3.0
milestone close — v0.3.0 section added, all three cross-milestone trend tables
extended, and Top Lessons promoted from one awaiting-cross-validation candidate
to three, the first now verified across both milestones with seven instances.*
