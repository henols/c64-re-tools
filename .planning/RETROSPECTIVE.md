# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

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

### Cumulative Quality

| Milestone | Tests (approx. green) | Live-evidence suites | Zero-Dep Additions |
|-----------|-----------------------|----------------------|--------------------|
| v0.2.0 | ~1400+ | 3 (`stock-live`, `stock-live-triage`, `stock-broker-live`) | disassembler, PETSCII table, all derived tools — 0 new npm deps |

### Top Lessons (Verified Across Milestones)

1. *(Awaiting a second milestone to cross-validate.)* The v0.2.0 candidate is
   lesson 1 above — self-written tests validate understanding, not code — which
   recurred four times **within** one milestone and is the strongest candidate for
   a standing rule.

---
*Created 2026-08-19 at v0.2.0 milestone close.*
