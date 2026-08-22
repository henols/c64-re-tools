# Roadmap: c64-re-tools

## Milestones

- ✅ **v0.2.0 Switchable stock-VICE backend** — Phases 1-8, 8.1, 8.2 (shipped 2026-08-19)
- ✅ **v0.3.0 regenerator2000 static-analysis backend** — Phases 9-11, 11.1 (shipped 2026-08-21)
- ⏳ **v0.4.0 Debt discharged, decisions settled** — Phases 12-17 (in progress, opened 2026-08-21)

## Phases

<details>
<summary>✅ v0.2.0 Switchable stock-VICE backend (Phases 1-8, 8.1, 8.2) — SHIPPED 2026-08-19</summary>

**Delivered:** a second, project-selectable backend that drives stock upstream
VICE through its binary monitor — so a user with an apt-installed VICE can run
the six shipped skills, and is told plainly where they must reach for the fork
instead. The stock manifest ships **38** tools against the fork's 62; the gap is
documented rather than hidden.

- [x] Phase 1: Corrected Ground Truth (4/4 plans) — completed 2026-08-12
- [x] Phase 2: Stock Backend Connection (10/10 plans) — completed 2026-08-13
- [x] Phase 3: Direct Tools (18/18 plans) — completed 2026-08-16
- [x] Phase 4: Client-Side Tool Seam and 6510 Disassembler (7/7 plans) — completed 2026-08-17
- [x] Phase 5: Skill-Critical Derived Tools (13/13 plans) — completed 2026-08-17
- [~] Phase 6: Stock-Only Gains — **CUT** 2026-08-17 (no skill calls any of them)
- [x] Phase 7: Cycle Timing and Wedge Triage (18/18 plans) — completed 2026-08-18
- [x] Phase 8: Capability Honesty and the Install Story (6/6 plans) — completed 2026-08-18
- [x] Phase 8.1: Close v0.2.0 audit items (INSERTED) (5/5 plans) — completed 2026-08-19
- [x] Phase 8.2: Close v0.2.0 blockers (INSERTED) (6/6 plans) — completed 2026-08-19

**Shipped and archived 2026-08-19:** 9 phases, 87 plans, 218 tasks, 51/51
in-scope requirements, 8 days. Final audit round 4 — `tech_debt`, no blockers.

**Full phase details, standing constraints, cut-scope rationale and success
criteria:** [`milestones/v0.2.0-ROADMAP.md`](milestones/v0.2.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.2.0-REQUIREMENTS.md`](milestones/v0.2.0-REQUIREMENTS.md)
**Final audit (round 4, `tech_debt`, no blockers):** [`milestones/v0.2.0-MILESTONE-AUDIT.md`](milestones/v0.2.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v0.3.0 regenerator2000 static-analysis backend (Phases 9-11, 11.1) — SHIPPED 2026-08-21</summary>

**Delivered:** recon findings stop being prose. regenerator2000 is adopted as a
static-analysis backend — a persistent, queryable annotation store plus a
recursive-descent disassembler — reached through **17** curated `r2000_*` tools
and a `vice-mcp r2000 <verb>` CLI, entirely container-side and structurally
incapable of touching VICE. Register writes read as bit names, symbols flow both
ways between the store and a live emulator, and the flat linear `toacme` decoder
it makes obsolete is deleted.

- [x] Phase 9: The Assumption Probe (Go/No-Go) (8/8 plans) — completed 2026-08-20 — verdict `degrade` (rule `R4`), see `docs/phase9-regenerator2000-probe-findings.md`
- [x] Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal (9/9 plans) — completed 2026-08-20
- [x] Phase 11: Annotation Store, Enums, and the Symbol Round Trip (12/12 plans) — completed 2026-08-21
- [x] Phase 11.1: Close v0.3.0 Audit Items (INSERTED) (7/7 plans) — completed 2026-08-21

**Shipped and archived 2026-08-21:** 4 phases, 36 plans, 101 tasks, 12/12
in-scope requirements, 3 days. Final audit round 2 — `passed`, zero open gaps.

**Full phase details, standing constraints, cut-scope rationale, success
criteria and the close-time milestone summary:** [`milestones/v0.3.0-ROADMAP.md`](milestones/v0.3.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.3.0-REQUIREMENTS.md`](milestones/v0.3.0-REQUIREMENTS.md)
**Final audit (round 2, `passed`):** [`milestones/v0.3.0-MILESTONE-AUDIT.md`](milestones/v0.3.0-MILESTONE-AUDIT.md)

</details>

### v0.4.0 Debt discharged, decisions settled (Phases 12-17, in progress)

**Goal:** Stop inheriting the same ledger a third time. Every carried item
becomes a fix or a dated decision, and the two questions this project has
answered *by default* each milestone (the fork backend, the Core Value
statement) get answered deliberately.

- [x] **Phase 12: Audit Integrity Instrument** - A milestone audit cannot record `status: passed` while any `docs-*.test.ts` guard is red, and the precondition is mechanical (verification 2026-08-22: passed, 11/11 — both layers proven, the live `PreToolUse` dispatch observed refusing all four write routes) (completed 2026-08-22)
- [x] **Phase 13: External Verification** - The three highest-value carried items (fixtures, `--help` discriminator, Phase 3 wire details) are proven against real stock/fork VICE binaries instead of internal proxies (completed 2026-08-22)
- [x] **Phase 14: Backend Decision** - The fork-backend question gets a dated decision with named reversal criteria, and every hard-loss capability gets a real user-facing route (completed 2026-08-22)
- [x] **Phase 15: Debt and Review Disposition** - Every open code-review finding and pending todo is fixed, dispositioned `wont-fix`, or promoted; Phase 03's UAT gap is closed (completed 2026-08-22, 12/12 plans; pending-todo tree reduced 21 → 2, both remaining items promoted to Phase 16 with named owners)
- [ ] **Phase 16: Packaging and Repo Shape** - The plugin payload moves under `src/` with `.mcp.json` merged, and `QUAL-01..03` are closed
- [ ] **Phase 17: Project Identity and Ledger Close** - Core Value is restated or explicitly confirmed, and the deferred-items ledger measurably shrinks below 19 — measured at the true close, after every phase that can change the pending set

## Phase Details

### Phase 12: Audit Integrity Instrument

**Goal**: A milestone audit cannot record `status: passed` while any of the four
`docs-*.test.ts` guards (`docs-linerefs.test.ts`, `docs-dangling-refs.test.ts`,
`docs-deferred-ledger.test.ts`, `docs-review-disposition.test.ts`) is red — the
precondition is mechanically enforced, not documented. Sequenced first: the rest
of this milestone runs under its own gate, which is the point (`4f048bb` closed
v0.3.0 with `docs-review-disposition.test.ts` already red, and nothing forced
anyone to notice).
**Depends on**: Nothing (first phase of v0.4.0)
**Requirements**: GATE-01
**Success Criteria** (what must be TRUE):

  1. A guard deliberately turned red is proven to block the audit-`passed` path — a committed transcript shows the mechanism refusing to record `status: passed` while it is red
  2. With all four guards genuinely green, the same mechanism allows `status: passed` — evidenced by a real green run recorded against the milestone-audit tooling
  3. The check point lives in code or an executable script that the audit command actually calls, cited by file and line — not a checklist instruction a future audit could skip

**Plans**: 7/7 plans executed (7 waves, sequential — each wave builds on the previous; waves 5-7 are gap closure from `12-VERIFICATION.md`)

**Wave 1**

- [x] 12-01-PLAN.md — `scripts/audit-gate.mjs` (the single check point) + Layer 1 `audit-integrity.test.ts` with the committed planted pair

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-02-PLAN.md — resolve the PreToolUse payload shape empirically, then add `--hook` mode and pin its contract with committed tests

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 12-03-PLAN.md — commit a hooks-only `.claude/settings.json`, relocate machine-specific permissions, amend `.gitignore`, and make Layer 1 guard the wiring

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 12-04-PLAN.md — the one-time real-tree plant-and-revert transcript (`12-GATE-PROOF.md`) satisfying criteria 1 and 2

**Wave 5** *(gap closure, blocked on Wave 4; sole owner of `scripts/audit-gate.mjs`'s detection internals and of `audit-integrity.test.ts`)*

- [x] 12-05-PLAN.md — CR-01 + CR-03 + WR-04: a bounded, non-backtracking milestone-audit token locator replacing both super-linear regexes, an unanchored gated-status scan for Bash command text derived from the one `GATED_STATUSES` set, the dead `pathish` push removed, and every falsified comment reconciled (D-12-04, D-12-12, D-12-14) [wave 5]

**Wave 6** *(gap closure, blocked on 12-05 — same two files)*

- [x] 12-06-PLAN.md — CR-02 + WR-01/WR-02/WR-03: an iterative depth-capped leaf walk whose truncation is a signal rather than a `RangeError`, matcher-first dispatch, symmetric try/catch in both modes, a 15 s bound on the guard subprocess, and a fast structural-failure path (D-12-03, D-12-10, D-12-14) [wave 6]

**Wave 7** *(gap closure, blocked on 12-06; human-gated — `autonomous: false`)*

- [x] 12-07-PLAN.md — the two `human_verification:` items: the live in-session `PreToolUse` block `12-04-PLAN.md` deferred and never performed, recorded in `12-GATE-PROOF.md`, plus a dated terminal state for RESEARCH assumptions A2 and A3 (D-12-03, D-12-19, D-12-20) [wave 7]

### Phase 13: External Verification

**Goal**: The three highest-value carried items are re-proven against real
binaries in place of the internal proxies that stood in for them. All three are
live-testable here: genuine unpatched stock VICE is at `/usr/bin/x64sc`, with the
fork shadowing it earlier on `PATH`.
**Depends on**: Nothing (independent of Phase 12 and 14; the three sub-items are
independent of each other and may execute in parallel)
**Requirements**: EXTV-01, EXTV-02, EXTV-03
**Success Criteria** (what must be TRUE):

  1. The three capturable `VERIF-02` binmon wire fixtures are re-recorded from a real VICE binary — whichever `x64sc` resolves first in `PATH`, per D-13-01, with the sidecar recording that build honestly — and no sidecar in the fixture set still declares itself synthetic while being relied on as ground truth — evidenced by the committed fixtures plus a capture transcript
  2. The `--help` backend discriminator (`BACK-01`/`BACK-04`) is run against a real stock `x64sc` and a real fork `x64sc`, with both transcripts committed as evidence
  3. Each of the four Phase 3 behavioural/spelling wire details written spec-driven and never exercised (A1, A2, A3, A5 — A4 is out of scope per D-13-05 and stays open in its own todo) is run against a real binary, with a committed transcript naming a pass, fail or inconclusive per detail, and any contradicted detail corrected at its source

**Plans**: 4/5 plans executed (3 waves)

**Wave 1** *(the three sub-items are independent and run in parallel)*

- [x] 13-01-PLAN.md — EXTV-01: live re-capture of `display-get`/`event-interleaved`/`checkpoint-list` from the first-in-`PATH` binary, decode of the real request ids and terminator frame, and reconciliation of every consumer that depended on the synthetic provenance — in one plan so the tree is never red (D-13-01, D-13-06)
- [x] 13-02-PLAN.md — EXTV-02: both `--help` transcripts committed verbatim with real-hardware sidecars, `probeBackend()` and `resolvedBackend()` run live against both real builds, and a real-hardware regression block kept apart from the author-constructed fixtures (D-13-03)
- [x] 13-03-PLAN.md — EXTV-03: `probe-binmon.mjs` extended with A1/A2/A3/A5 probes plus offline selftest coverage, run live, and one recorded verdict per assumption (D-13-02, D-13-07; A4 excluded per D-13-05)

**Wave 2** *(blocked on 13-01 and 13-03 — shares `stock-protocol.ts` with 13-01 and reads 13-03's verdicts)*

- [x] 13-04-PLAN.md — EXTV-03 corrections: every confirmed assumption's `[ASSUMED]` label removed at every `grep`-enumerated site, every contradicted one regression-tested before its label comes off, and a committed all-or-nothing label-discipline guard (D-13-04)

**Wave 3** *(blocked on 13-01, 13-02 and 13-04)*

- [x] 13-05-PLAN.md — Ledger close: both retired verdicts in `docs/phase2-backend-probe-evidence.md` resolved with artifact citations, two todos closed, the probe-debt todo trimmed to A4 only, surfaced-but-unfixed findings filed, and `STATE.md`'s deferred ledger re-derived so its two-directional guard stays green (D-13-03, D-13-05)

### Phase 14: Backend Decision

**Goal**: The fork-backend question is answered by a dated decision rather than
retained by default for a third close, and whichever way it goes, a user hitting
one of the three hard losses (SID read-back, matrix keyboard, RESTORE/NMI) has an
actual route to follow. Sequenced early — cheap in code, expensive in
consequence: if the decision is "remove", nothing downstream should be built on
a backend about to be deleted.
**Depends on**: Nothing directly, but sequenced before Phase 15 and 17 so their
disposition/relocation work does not touch fork-backend code or fork-coupled
claims (e.g. the `warp-over-resource_set` todo) ahead of knowing the outcome
**Requirements**: FORK-01, FORK-02
**Success Criteria** (what must be TRUE):

  1. PROJECT.md → Key Decisions carries a dated `FORK-01` entry naming the criteria that would reverse it, explicitly including the upstream `KEYBOARD_MATRIX_SET` coupling
  2. A user who hits SID read-back, matrix keyboard, or RESTORE/NMI is told, at the point of use, a route they can actually follow — evidenced by the live doc/skill text, not merely asserted in this roadmap
  3. The decision is reflected in the code's actual state, checked live: if "remove", no code path still advertises or spawns the fork transport; if "retain", the retained path is exercised once more against a real fork binary and still passes

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 14-01-PLAN.md — Decision brief, the blocking FORK-01 checkpoint, the dated Key Decisions row, and the guard that reads it back (tracer; not autonomous)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 14-02-PLAN.md — FORK-02: enumerate all hard-loss route sites, judge each against the decided branch, then apply only what the verdicts require
- [x] 14-03-PLAN.md — Criterion 3 live: the first committed exercise of the fork's own `-mcpserver` HTTP transport against a real fork binary
- [x] 14-04-PLAN.md — Branch-conditional code consequence: stop the fork being the silent default, and move the stock backend's shared error types out of the fork transport module

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 14-05-PLAN.md — Close the record: dispose the standing todo, reconcile the deferred ledger, and hand the outcome to Phases 15/16/17

**Planning note**: plan this phase with **worktree mode off**. Every plan's
deliverables include `.planning/` and `PROJECT.md`/`ROADMAP.md`/`STATE.md`
content, which worktree mode strips from executor commits. The FORK-01 branch is
decided by a human at 14-01's `blocking-human` checkpoint and is NOT pre-decided
by the plan set; plans 14-02, 14-04 and 14-05 read the recorded branch token
(`retain`, `deprecate-first`, `remove-now`) from `14-01-SUMMARY.md` and skip
branch-inapplicable tasks visibly. On a `remove-now` outcome, criterion 3's
remove clause cannot be satisfied in-phase (research Q1/Q2 sizes the deletion at
~15 production modules, 23 test files, 4 skill playbooks, README, the parity doc
and a premise rewrite of the 505-line honesty guard) and 14-05 records a
follow-on-phase recommendation rather than reporting it satisfied.

**Notes**: Branch token: **`retain`**, decided 2026-08-22 by a human at plan
14-01's `gate="blocking-human"` checkpoint after explicit escalation — not
inferred, not auto-approved, not a third silent default carry. See
PROJECT.md → Key Decisions, the dated `FORK-01` row. Per-criterion verdict:

  1. **Satisfied.** PROJECT.md carries the dated `FORK-01` row naming the
     `KEYBOARD_MATRIX_SET` opcode landing as the reversal trigger, pinned by
     `docs-fork-decision.test.ts`.

  2. **Satisfied.** All 17 point-of-use mention sites for the three hard-loss
     tools verdicted `holds-as-is` against the retained branch, with zero
     rewrite needed (`14-ROUTE-EVIDENCE.md`); each tool's runtime refusal
     string is pinned by a test naming the fork route (`Set VICE_BACKEND=fork`).

  3. **Satisfied for the retained path; the "remove" clause does not apply
     on this branch.** The fork's own `-mcpserver` HTTP transport was
     exercised live for the first time in this repository's history against
     a real fork binary (`/usr/local/bin/x64sc`, VICE 3.10) — 6/6 passing,
     including `vice_sid_get_state` end to end (`14-CRITERION3-EVIDENCE.md`).
     Since `retain` was decided, criterion 3's "if remove, no code path still
     advertises or spawns the fork transport" clause is not in play — no
     unmet part to record, no follow-on removal phase to recommend.

### Phase 15: Debt and Review Disposition

**Goal**: Every open code-review finding across all phases is dispositioned, and
every pending todo not already claimed by Phase 13/14/17 becomes fixed,
dispositioned `wont-fix` with recorded rationale, or explicitly promoted —
nothing carried silently into v0.5.0. Phase 03's three pending UAT scenarios are
finally executed and recorded. This is the milestone's bulk workload.
**Depends on**: Phase 14 (the fork decision determines the disposition of
fork-coupled todos, e.g. `warp-over-resource_set`, which the fork-removal todo
itself notes "would make moot")

**Fork-decision consequence (resolved 2026-08-22, Phase 14 plan 14-05)**:
FORK-01 decided `retain` — the fork-removal todo it "would make moot" is
itself now closed (see `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`),
but that closure does NOT make `warp-over-resource_set` moot. Its
fork-facing question is answered the other way: since the fork stays, its
Solution item 4 (`vice_machine_config_set`'s `WarpMode` description is a
SKILL-01 landmine) is the applicable route — **mark the description
fork-only, do not delete it** — recorded directly on that todo. Separately,
`WR-13`'s dead second hardcoded capability-refusal string is **unaffected
and still open**: Phase 14 plan 14-02 made zero edits to
`capability-registry.ts` (all 17 mention sites verdicted `holds-as-is`), so
`WR-13` remains exactly the dead-code-violating-one-source-of-truth finding
this phase's `GATE-02` work must disposition — not fixed, not superseded.

**Structural-cause handoff**: this phase's own code-review findings will
land after 14-05's own last SUMMARY and therefore cannot be dispositioned by
any plan of Phase 14 itself — the same structural cause Phases 08, 09 and 13
each filed a todo for (the review gate runs after the last plan's SUMMARY).
`GATE-02` already owns dispositioning open findings across all phases;
Phase 14 is now named as the fourth instance so this phase's own plans do
not need to rediscover it.

**Requirements**: GATE-02, DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):

  1. `docs-review-disposition.test.ts` runs green from a clean checkout, with Phase 08's `WR-04`..`WR-12`, Phase 09's `IN-01`..`IN-03`, `WR-13`'s second hardcoded capability-refusal string, and `02-REVIEW.md`'s `IN-05` each carrying a cited disposition
  2. Every file remaining in `.planning/todos/pending/` after this phase is either fixed with a commit reference, moved to `completed/` with a `wont-fix` rationale, or promoted into `REQUIREMENTS.md` → Future Requirements with a named owner
  3. The five DEBT-02 undocumented behaviours (`Drive8Type` prerequisite, project-paths git-marker requirement, `releases.json` schema, `vice_ping`'s `resolvedBinaryPath` under the broker pool, the refuted warp-over-`resource_set` claim) are each documented at the location a user would actually look, cited by file
  4. Phase 03's three pending UAT scenarios in `03-HUMAN-UAT.md` are executed against real fixtures and a running program, and each is recorded `pass` or `fail` with evidence — none left `pending`

**Planning note (2026-08-22, discovered while planning this phase)**: the guard
criterion 1 names is green today **for the wrong reason**. Its heading parser only
matches level-3 finding headings ending in a colon, so it sees 119 of the 150
findings that actually exist — `03-REVIEW.md` (14 findings, all level 4),
`05-REVIEW.md` (16, all level 4) and `14-REVIEW.md` (1, level 3 with no colon) are
wholly or partly invisible to it. Measured live against the tree at `3f0089f`:
widening the parser surfaces **9 undispositioned findings** the shipped guard cannot
see (8 in `03-REVIEW.md`, 1 in `14-REVIEW.md`; `05-REVIEW.md`'s 16 are already
dispositioned via `05-REVIEW-FIX.md`). Plan 15-01 is therefore the phase's tracer:
it widens the parser first, because until it does, "every open finding" means
something different from what criterion 1 intends. Two further corrections found at
plan time: `13-REVIEW.md`'s `WR-01` is **already fixed** at source (commit
`f73d0fa`), and the `tools-manifest.json` "staleness" todo is inverted —
`vice_snapshot_list`'s absence is D-16's deliberate deletion, so regenerating the
manifest would re-add a tool the project decided to remove.

**Plans**: 12/12 plans executed

Plans:
**Wave 1**

- [x] 15-01-PLAN.md — TRACER: widen the disposition guard's parser, prove it end-to-end on one finding

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 15-02-PLAN.md — Phase 08 GATE-02: skill-corpus extraction (WR-12) and the two lint scripts (WR-06/07/09/10/11)
- [x] 15-03-PLAN.md — Phase 08 GATE-02: cell escaping (WR-04), bounded declaration scans (WR-08), single-source refusal (WR-13)
- [x] 15-04-PLAN.md — Phase 03's eight newly-surfaced findings, re-verified then fixed or superseded
- [x] 15-08-PLAN.md — DEBT-03: UAT scenarios 1 and 2 live against genuine stock VICE

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 15-05-PLAN.md — Phase 09 wont-fix, Phase 13's four, and `02-REVIEW.md`'s `IN-05` at source

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 15-06-PLAN.md — DEBT-02: the three `c64-ram-capture` documentation gaps

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 15-07-PLAN.md — DEBT-01: build-atomic isolation, fixture provenance labels, test-gate migration

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 15-09-PLAN.md — DEBT-02: the refuted warp claim marked fork-only, and `vice_ping`'s field named honestly

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 15-10-PLAN.md — DEBT-03: scenario 3 and the A4 checkpoint-flood probe (one experiment, two items)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 15-11-PLAN.md — Disk-attach record corrected, manifest todo inverted, CI command settled from a run log

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 15-12-PLAN.md — Closure: per-finding verdicts, promotions with owners, requirements and ledger reconciled

**Cross-cutting constraints:**

- STATE.md's `## Deferred Items` table and both of its prose count figures are updated in the same commits that move this plan's todos out of `pending/`, so `docs-deferred-ledger.test.ts` — which is in the automated gate — is never left red.

**Notes (Phase 15 complete, 2026-08-22)**: Criterion-by-criterion outcome —

  1. **Satisfied.** `docs-review-disposition.test.ts` runs green from a clean checkout (7/7
     tests, 150 findings, 0 undispositioned). Phase 08's `WR-04`..`WR-12` — corrected to ten
     findings, `WR-04`..`WR-13`, since `WR-13` is a separately-named tenth finding — all fixed
     at source across plans 15-02/15-03 and transcribed with resolvable commits by plan 15-12.
     Phase 09's `IN-01`..`IN-03` closed `wont-fix` on evidence-immutability grounds (plan
     15-05). `WR-13`'s second hardcoded capability-refusal string fixed (plan 15-03,
     `dispatchStock()` now routes through `capabilityRefusalMessage()`). `02-REVIEW.md`'s
     `IN-05` fixed at source (plan 15-05, commit `9849224`).

  2. **Satisfied.** The pending-todo tree went from 21 (measured at plan 15-01's close, after
     the guard widening exposed 9 previously-invisible findings) to 2 at this phase's close —
     19 todos closed across plans 15-04 through 15-12, each fixed with a commit reference,
     closed `wont-fix` with recorded rationale, or promoted into `REQUIREMENTS.md` → Future
     Requirements with a named owner. The two todos still pending are both promoted, not
     silently carried: `PKG-01` (Phase 16) owns the payload-relocation todo, `PKG-03` (Phase
     16) owns the stale-phase-pointers todo.

  3. **Satisfied.** All five DEBT-02 behaviours documented at point of use, cited by file and
     heading: `c64-ram-capture/SKILL.md`'s `## Boot a disk` closing note (`Drive8Type`), a
     prerequisite paragraph before `## The order` plus a Troubleshooting row (project-paths
     git-marker), a new `## Release registry shape` section (`releases.json` schema) — all
     plan 15-06; `vice-proxy.ts`'s module-scope comment plus a new `resolvedBinaryPathScope`
     response field (`vice_ping`) and `GAINS-PROTOCOL.md`'s corrected warp error codes plus a
     fork-only caveat in `docs/stock-vice-parity.md`/`capability-registry.ts` (warp claim) —
     both plan 15-09.

  4. **Satisfied.** All three `03-HUMAN-UAT.md` scenarios executed live against genuine
     `/usr/bin/x64sc` and recorded with evidence: scenario 1 pass (plan 15-08, byte-comparison
     snapshot round trip), scenario 2 partial (plan 15-08 — keyboard pass, joystick an honest
     zero-delta negative result reproducing Phase 13's `A3`), scenario 3 pass (plan 15-10, a
     real checkpoint-flood probe against genuine stock VICE). None left `pending`; `status:`
     stays `partial` rather than being softened to force an overall pass.

  **The one discovery worth carrying forward**: the guard criterion 1 depends on
  (`docs-review-disposition.test.ts`) was green throughout v0.3.0 and the v0.4.0 phases before
  this one **for the wrong reason** — its parser matched only level-3, colon-terminated
  finding headings, blind to 31 findings across three phases (`03-REVIEW.md`'s 14 level-4
  findings, `05-REVIEW.md`'s 16 already dispositioned elsewhere, `14-REVIEW.md`'s 1
  colon-less finding). Plan 15-01 widened it as this phase's own tracer, before any other
  disposition work could rely on it meaning what it claimed. The two invariants that stop
  this recurring — a shape-drift detector requiring every future heading-marker shape's ids
  to be a subset of the parser's own output, and a fixture-driven regression test pinning the
  two previously-invisible shapes against a committed fixture — are the structural fix, not
  the widened regex alone; a sixth heading shape would fail loudly under either invariant
  rather than silently under-counting the way the first four did.

### Phase 16: Packaging and Repo Shape

**Goal**: The plugin payload lives under `src/` with `.mcp.json` merged into any
consumer's existing config, and `QUAL-01..03` (tests for the three CLI scripts,
orphaned planning references, control-plane exposure) are closed. Sequenced after
every phase that changes source: the fork decision in Phase 14 may delete code
under the current tree, Phase 15's disposition work edits docs and source
comments, and CLAUDE.md's line-number citations drift with every phase. Doing the
relocation once, after all of that has settled, sweeps the path and
line-reference citations a single time instead of re-sweeping them per phase.
**Depends on**: Phases 12-15 (relocates the payload only after the fork decision
and all disposition work have landed, so the move sweeps a final file set once)

**Fork-decision consequence (resolved 2026-08-22, Phase 14 plan 14-05)**:
FORK-01 decided `retain`, and plan 14-04 confirmed zero code deletion under
the current tree — both of its code-consequence tasks (the
`resolvedBackend()` default flip; the `vice-errors.ts` extraction) are gated
to non-`retain` branches by their own precondition and were correctly
skipped (`git diff --quiet -- .claude/mcp/vice` after 14-04). The
sweep-path-and-line-reference-once rationale above is **unamended**: nothing
about this phase's `src/`-relocation scope changed as a result of the fork
decision.

**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04
**Success Criteria** (what must be TRUE):

  1. Both published tarballs (`@henols/vice-mcp`, `@henols/c64-re-tools`) contain exactly the right files after the move — `scripts/check-npm-packages.mjs` green, no `node_modules/`, no test files, no fixtures leaked, all six skills present
  2. `acme.mjs`, `driver.mjs` and `derive.mjs` each have a committed test file that runs and passes as part of the test suite
  3. A whole-tree grep gate proves zero orphaned planning references remain in source comments, demonstrated by biting on a planted violation before acceptance
  4. The emulator control-plane network exposure is either narrowed (evidenced by a live bind-address check showing it is no longer `0.0.0.0`) or recorded in PROJECT.md as an accepted risk with rationale
  5. `resources-sync.test.ts` and the byte-pinned per-backend tool manifests still pass after the relocation — evidenced by a green test run against the moved tree

**Planning note**: plan numbers are not wave order. Wave 1 is plans 16-01/16-02/16-03,
wave 2 is 16-04, wave 3 is 16-06/16-07, and wave 4 is 16-05 — the documentation and
line-citation sweep runs last on purpose, so the citations are swept once against final
source rather than re-swept after every source-editing plan (this phase's own sequencing
rationale, above). Same convention as Phase 15, where wave order also differed from plan
order.

**Plans**: 3/7 plans executed

Plans:
**Wave 1**

- [x] 16-01-PLAN.md — Tracer: relocate the six skills to `src/skills/` end-to-end (manifest, packaging validator, both corpus checks, installer sync, CI, the three skills-path literals inside the MCP package), and record the dev-time decision
- [x] 16-02-PLAN.md — PKG-04: verify the broker control-plane facts against source and a live socket, then record the `0.0.0.0` bind as a dated accepted risk in PROJECT.md with the rejected narrow branch and a named follow-on
- [x] 16-03-PLAN.md — Stand up `installer/`'s first test suite and pin `wireMcp()`'s nine merge behaviours and six refusal behaviours against the shipped CLI

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 16-04-PLAN.md — Relocate the MCP server to `src/mcp/vice/`, sweep ~30 functional consumers, prove tarball parity (73 entries unchanged), and resolve the `repoRoot()` depth record

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 16-06-PLAN.md — PKG-02: three committed CLI-script test files (`acme.mjs`, `driver.mjs`, `derive.mjs`) inside the MCP package, reusing the existing assembler-availability seam
- [ ] 16-07-PLAN.md — PKG-03: a comment-scoped orphaned-reference gate (assignment shapes plus roadmap-derived cut phases), 15 sites fixed, a committed fixture, and a recorded plant-and-revert demonstration

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 16-05-PLAN.md — Single documentation sweep: `CLAUDE.md` (52 references) plus README and `docs/*.md`, and re-verify the architectural line citations against final source

### Phase 17: Project Identity and Ledger Close

**Goal**: PROJECT.md's Core Value is either restated to reflect what v0.3.0
proved (that what a session learns outlives it) or carries a dated confirmation
that it should not be, with the evidence weighed either way. The deferred-items
ledger is then measured at the **true** close — after Phase 16 has discharged
`2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json`, the last
pending todo any phase of this milestone removes — and is smaller than the 19
items inherited. Sequenced last for exactly that reason: DEBT-04 says "at the
close", and a count taken before Phase 16 would go stale the moment Phase 16
landed. This phase edits planning documents only and touches no source, so
placing it after Phase 16 does not disturb the sweep-once rationale above.
**Depends on**: Phases 15 and 16 (the ledger measurement requires every
disposition *and* PKG-01's todo to have already left `.planning/todos/pending/`)

**Fork-decision consequence (resolved 2026-08-22, Phase 14 plan 14-05)**:
Phase 14 closed one pending todo
(`2026-08-20-fully-remove-the-forked-vice-mcp-backend`, resolved `retain`)
against the dated FORK-01 decision, reducing the pending-todo count `DEBT-04`
measures from 21 to 20 (STATE.md → Deferred Items: 22 → 21 total items,
counting the one UAT-gap row). This is **not** the "true close" count
criterion 2 requires — Phases 15 and 16 still have disposition and
relocation work outstanding (including `warp-over-resource_set`'s remaining
fix and PKG-01's own relocation todo) that will move the count further
before this phase's measurement is taken.

**Planning note**: plan this phase with **worktree mode off**. Its deliverables
are `STATE.md` and `PROJECT.md` content, and worktree mode strips those files
from commits — a plan of this shape silently cannot deliver.
**Requirements**: CORE-01, DEBT-04
**Success Criteria** (what must be TRUE):

  1. PROJECT.md → Core Value either states the outlives-the-session axis v0.3.0 proved, or has a dated entry recording that the evidence was weighed and the statement deliberately kept — not a bookkeeping edit made in passing
  2. `STATE.md` → Deferred Items, still derived from `.planning/todos/pending/` and guarded in both directions by `docs-deferred-ledger.test.ts`, reports a count strictly lower than 19
  3. The count is taken with no phase of this milestone left to run — nothing remaining that could remove another item from the pending set after the measurement

**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Corrected Ground Truth | v0.2.0 | 4/4 | Complete | 2026-08-12 |
| 2. Stock Backend Connection | v0.2.0 | 10/10 | Complete | 2026-08-13 |
| 3. Direct Tools | v0.2.0 | 18/18 | Complete | 2026-08-16 |
| 4. Client-Side Tool Seam and 6510 Disassembler | v0.2.0 | 7/7 | Complete | 2026-08-17 |
| 5. Skill-Critical Derived Tools | v0.2.0 | 13/13 | Complete | 2026-08-17 |
| 6. Stock-Only Gains | v0.2.0 | — | **Cut** 2026-08-17 | - |
| 7. Cycle Timing and Wedge Triage | v0.2.0 | 18/18 | Complete | 2026-08-18 |
| 8. Capability Honesty and the Install Story | v0.2.0 | 6/6 | Complete | 2026-08-18 |
| 8.1 Close v0.2.0 audit items (INSERTED) | v0.2.0 | 5/5 | Complete | 2026-08-19 |
| 8.2 Close v0.2.0 blockers (INSERTED) | v0.2.0 | 6/6 | Complete | 2026-08-19 |
| 9. The Assumption Probe (Go/No-Go) | v0.3.0 | 8/8 | Complete | 2026-08-20 |
| 10. Adoption Boundaries, Automated Bootstrap, and the Removal | v0.3.0 | 9/9 | Complete    | 2026-08-20 |
| 11. Annotation Store, Enums, and the Symbol Round Trip | v0.3.0 | 12/12 | Complete    | 2026-08-21 |
| 11.1 Close v0.3.0 Audit Items (INSERTED) | v0.3.0 | 7/7 | Complete   | 2026-08-21 |
| 12. Audit Integrity Instrument | v0.4.0 | 7/7 | Complete    | 2026-08-22 |
| 13. External Verification | v0.4.0 | 5/5 | Complete    | 2026-08-22 |
| 14. Backend Decision | v0.4.0 | 5/5 | Complete    | 2026-08-22 |
| 15. Debt and Review Disposition | v0.4.0 | 12/12 | Complete    | 2026-08-22 |
| 16. Packaging and Repo Shape | v0.4.0 | 3/7 | In Progress|  |
| 17. Project Identity and Ledger Close | v0.4.0 | 0/TBD | Not started | - |

**v0.2.0 final state:** 9 phases, 87 plans, 51/51 in-scope requirements satisfied.
17 requirements were cut wholesale on 2026-08-17 and remain in
`milestones/v0.2.0-REQUIREMENTS.md` marked `CUT` with rationale, so restoring one
is a scope decision rather than an archaeology exercise. Known deferred items at
close: 13 (see `STATE.md` → Deferred Items).

**v0.3.0 final state:** 4 phases, 36 plans, 101 tasks, 12/12 in-scope
requirements satisfied. 4 of the original 16 `R2000-*` requirements were cut or
folded on 2026-08-17 and remain in `milestones/v0.3.0-REQUIREMENTS.md` with
rationale. `R2000-16` was satisfied with criterion 3(4) scoring `partial`,
which fired decision rule `R4` and narrowed the shipped input set to
`.prg`/`.d64`/flat-64K (D-34) — the probe was honoured, not overridden. Known
deferred items at close: 19 — 18 pending todos plus Phase 03's UAT gap (see
`STATE.md` → Deferred Items, derived from `.planning/todos/pending/` and guarded
in both directions).

**v0.4.0 in progress:** 6 phases (12-17), 16/16 in-scope requirements mapped,
0 orphaned. `GATE-01` (Phase 12) is sequenced first so every later phase in this
milestone runs under its own audit-integrity guard. `FORK-01`/`FORK-02` (Phase
14) are sequenced early, ahead of the bulk disposition work (Phase 15) and the
packaging move (Phase 17), so neither builds on a backend that might be about to
be deleted. `PKG-01` (Phase 17) is sequenced last rather than first, because it
touches nearly every file the milestone's other phases also touch — see Phase
17's Goal for the full rationale. `DEBT-04`'s ledger measurement and `CORE-01`
(Phase 16) are sequenced after Phase 15 specifically so the ledger count and the
Core Value evidence both reflect this milestone's actual disposition work, not a
projection of it.

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.2.0 shipped and collapsed 2026-08-19 → `milestones/v0.2.0-ROADMAP.md`*
*v0.3.0 shipped and collapsed 2026-08-21 → `milestones/v0.3.0-ROADMAP.md`*
*v0.4.0 roadmap created 2026-08-21 — Phases 12-17, 16/16 requirements mapped, 0 orphaned.*
*Phase numbering is continuous across milestones and never reused. Next: `/gsd-plan-phase 12`.*
