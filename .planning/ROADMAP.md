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

- [ ] **Phase 12: Audit Integrity Instrument** - A milestone audit cannot record `status: passed` while any `docs-*.test.ts` guard is red, and the precondition is mechanical
- [ ] **Phase 13: External Verification** - The three highest-value carried items (fixtures, `--help` discriminator, Phase 3 wire details) are proven against real stock/fork VICE binaries instead of internal proxies
- [ ] **Phase 14: Backend Decision** - The fork-backend question gets a dated decision with named reversal criteria, and every hard-loss capability gets a real user-facing route
- [ ] **Phase 15: Debt and Review Disposition** - Every open code-review finding and pending todo is fixed, dispositioned `wont-fix`, or promoted; Phase 03's UAT gap is closed
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
**Plans**: 4 plans (4 waves, sequential — each wave builds on the previous)
- [ ] 12-01-PLAN.md — `scripts/audit-gate.mjs` (the single check point) + Layer 1 `audit-integrity.test.ts` with the committed planted pair
- [ ] 12-02-PLAN.md — resolve the PreToolUse payload shape empirically, then add `--hook` mode and pin its contract with committed tests
- [ ] 12-03-PLAN.md — commit a hooks-only `.claude/settings.json`, relocate machine-specific permissions, amend `.gitignore`, and make Layer 1 guard the wiring
- [ ] 12-04-PLAN.md — the one-time real-tree plant-and-revert transcript (`12-GATE-PROOF.md`) satisfying criteria 1 and 2

### Phase 13: External Verification
**Goal**: The three highest-value carried items are re-proven against real
binaries in place of the internal proxies that stood in for them. All three are
live-testable here: genuine unpatched stock VICE is at `/usr/bin/x64sc`, with the
fork shadowing it earlier on `PATH`.
**Depends on**: Nothing (independent of Phase 12 and 14; the three sub-items are
independent of each other and may execute in parallel)
**Requirements**: EXTV-01, EXTV-02, EXTV-03
**Success Criteria** (what must be TRUE):
  1. The three capturable `VERIF-02` binmon wire fixtures are re-recorded from a real stock VICE binary, and no sidecar in the fixture set still declares itself synthetic while being relied on as ground truth — evidenced by the committed fixtures plus a capture transcript
  2. The `--help` backend discriminator (`BACK-01`/`BACK-04`) is run against a real stock `x64sc` and a real fork `x64sc`, with both transcripts committed as evidence
  3. Each of the four Phase 3 behavioural/spelling wire details written spec-driven and never exercised is run against a real binary, with a committed transcript naming a pass or fail per detail, and any contradicted detail corrected at its source
**Plans**: TBD

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
**Plans**: TBD

### Phase 15: Debt and Review Disposition
**Goal**: Every open code-review finding across all phases is dispositioned, and
every pending todo not already claimed by Phase 13/14/17 becomes fixed,
dispositioned `wont-fix` with recorded rationale, or explicitly promoted —
nothing carried silently into v0.5.0. Phase 03's three pending UAT scenarios are
finally executed and recorded. This is the milestone's bulk workload.
**Depends on**: Phase 14 (the fork decision determines the disposition of
fork-coupled todos, e.g. `warp-over-resource_set`, which the fork-removal todo
itself notes "would make moot")
**Requirements**: GATE-02, DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. `docs-review-disposition.test.ts` runs green from a clean checkout, with Phase 08's `WR-04`..`WR-12`, Phase 09's `IN-01`..`IN-03`, `WR-13`'s second hardcoded capability-refusal string, and `02-REVIEW.md`'s `IN-05` each carrying a cited disposition
  2. Every file remaining in `.planning/todos/pending/` after this phase is either fixed with a commit reference, moved to `completed/` with a `wont-fix` rationale, or promoted into `REQUIREMENTS.md` → Future Requirements with a named owner
  3. The five DEBT-02 undocumented behaviours (`Drive8Type` prerequisite, project-paths git-marker requirement, `releases.json` schema, `vice_ping`'s `resolvedBinaryPath` under the broker pool, the refuted warp-over-`resource_set` claim) are each documented at the location a user would actually look, cited by file
  4. Phase 03's three pending UAT scenarios in `03-HUMAN-UAT.md` are executed against real fixtures and a running program, and each is recorded `pass` or `fail` with evidence — none left `pending`
**Plans**: TBD

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
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04
**Success Criteria** (what must be TRUE):
  1. Both published tarballs (`@henols/vice-mcp`, `@henols/c64-re-tools`) contain exactly the right files after the move — `scripts/check-npm-packages.mjs` green, no `node_modules/`, no test files, no fixtures leaked, all six skills present
  2. `acme.mjs`, `driver.mjs` and `derive.mjs` each have a committed test file that runs and passes as part of the test suite
  3. A whole-tree grep gate proves zero orphaned planning references remain in source comments, demonstrated by biting on a planted violation before acceptance
  4. The emulator control-plane network exposure is either narrowed (evidenced by a live bind-address check showing it is no longer `0.0.0.0`) or recorded in PROJECT.md as an accepted risk with rationale
  5. `resources-sync.test.ts` and the byte-pinned per-backend tool manifests still pass after the relocation — evidenced by a green test run against the moved tree
**Plans**: TBD

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
| 12. Audit Integrity Instrument | v0.4.0 | 0/TBD | Not started | - |
| 13. External Verification | v0.4.0 | 0/TBD | Not started | - |
| 14. Backend Decision | v0.4.0 | 0/TBD | Not started | - |
| 15. Debt and Review Disposition | v0.4.0 | 0/TBD | Not started | - |
| 16. Packaging and Repo Shape | v0.4.0 | 0/TBD | Not started | - |
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
