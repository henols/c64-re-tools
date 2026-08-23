---
gsd_state_version: 1.0
milestone: v0.4.0
milestone_name: Debt discharged, decisions settled (Phases 12-17, in progress)
current_phase: 17
current_phase_name: Project Identity and Ledger Close
status: verifying
stopped_at: Completed 17-03-PLAN.md
last_updated: "2026-08-23T09:06:45.903Z"
last_activity: 2026-08-23
last_activity_desc: Phase 17 execution started
state_head: 1070b97495b707a46431d9471b3b59ec31386601
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 43
  completed_plans: 43
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-21 at the v0.4.0 milestone open)

**Core value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.
*Flag still standing, now with an owner: this says nothing about findings that
outlive the session, which is what v0.3.0 delivered. Restating or explicitly
confirming it is a **v0.4.0 target feature**, not a bookkeeping edit — see
PROJECT.md → Core Value for the candidate shape.*

**Shipped:** v0.3.0 regenerator2000 static-analysis backend — 2026-08-21 (4
phases, 36 plans, 101 tasks, 12/12 in-scope requirements, audit round 2
`passed`). Recon findings are queryable state: 17 curated `r2000_*` tools and 7
`vice-mcp r2000` CLI verbs over a persistent annotation store, container-side and
structurally incapable of touching VICE; generated register bit-name enums; the
symbol round trip closed live against genuine stock `x64sc`; the `toacme` decoder
deleted.
**Previously:** v0.2.0 Switchable stock-VICE backend — 2026-08-19 (9 phases, 87
plans, 51/51 in-scope requirements). Stock upstream `x64sc` is a first-class,
project-selectable backend with 38 tools; the fork keeps its 62 unchanged.

**Current focus:** Phase 17 — Project Identity and Ledger Close
2026-08-21. Goal: stop inheriting the same ledger a third time; every carried item
becomes a fix or a dated decision, and the fork-backend and Core Value questions
get answered deliberately rather than by default. Requirements are being defined
(`.planning/REQUIREMENTS.md` was removed at the v0.3.0 close and is recreated by
`/gsd-new-milestone`). ROADMAP.md carries both shipped milestones collapsed, with
full detail in `milestones/v0.2.0-ROADMAP.md` and `milestones/v0.3.0-ROADMAP.md`.
**Phase numbering continues from 11.1 — this milestone starts at Phase 12**, and
numbers are never reused, including the dissolved ones. The 19 items in Deferred
Items below are no longer inherited context: discharging them *is* the milestone.

## Current Position

Phase: 17 (Project Identity and Ledger Close) — COMPLETE
Plan: 3 of 3
Status: Phase complete — ready for verification

**Phase 17 — Project Identity and Ledger Close — is COMPLETE (2026-08-23, 3/3
plans).** Plan 17-01 (the phase's tracer) found `docs-deferred-ledger.test.ts`'s
non-vacuity floor could not express a genuinely empty pending-todo tree — it
asserted `pending.length >= 2`, a floor written when 0 pending seemed
theoretical, and was red 1 pass / 3 fail the moment Phase 16 discharged the
last two survivors (`PKG-01`, `PKG-03`). Fixing that floor to no floor at all
(not a smaller nonzero number) was real source work under `src/mcp/vice/`,
not a planning-document edit — the phase's own Goal claim to the contrary is
corrected in ROADMAP.md. With the guard able to express zero, plan 17-01 then
brought the `## Deferred Items` ledger below to the true v0.4.0-close count:
**0** (0 pending todo files + 0 UAT-gap rows), down from the 19 items
inherited at the v0.3.0 close. Plan 17-02 decided `CORE-01` at a
`gate="blocking-human"` checkpoint: the full evidence was presented to a
human, who read it, declined to select between `restate`/`keep-dated`, and
explicitly delegated the call to the orchestrating session — the orchestrator
then selected **keep-dated** on `R2000-01`'s structural argument that
regenerator2000 is never launched with `--vice`. Recorded precisely in
PROJECT.md → Core Value (dated 2026-08-23) and pinned by
`src/mcp/vice/docs-core-value-decision.test.ts` (5/5). Plan 17-03 (this
closer) ticked both requirements Complete in REQUIREMENTS.md with closure
notes, closed ROADMAP.md's Phase 17 section to its real plan list and
outcome, re-took the pending-todo measurement after every one of this
phase's own edits (still 0), and confirmed the full `npm test` suite green
with every `docs-*.test.ts` guard passing.

16-10 reverted the phase's own CR-01 regression (16-04's sweep had rewritten four
consumer-facing path literals in generated skill output to name this repository's
source tree instead of a consumer's installed `.claude/skills/` directory) and
closed the sole remaining `16-REVIEW.md` finding (WR-03). Shipped
`skill-consumer-paths.test.ts`, a frozen four-entry registry guard against the
class recurring, each entry demonstrated live to bite on a planted regression.
`docs-review-disposition.test.ts` and `audit-integrity.test.ts` are both
confirmed green for the first time this phase (full baseline: 2386 tests, 2342
pass, 0 fail, 39 skipped, 5 todo, 24 suites).

Phase 15 (Debt and Review Disposition) closed 2026-08-22, 12/12 plans, verification
`passed` 4/4. It ran as nine waves but sequentially on the main checkout
(`workflow.use_worktrees=false`), so plan order was wave order, not 01..12:
08 depends only on 15-01 and ran ahead of 06/07; 09 on 15-03/15-07; 10 on 15-08/15-09;
11 on 15-09/15-10; 12 (the designated closer) on all eleven prior plans. Note for future
phases: `state.advance-plan`'s sequential "N of 12" counter does not fit a wave-parallel
phase and had to be corrected by hand three times during execution — do not trust its
blind increment as the completed set.

Phase 15 outcome: GATE-02, DEBT-01, DEBT-02 and DEBT-03 all Complete in REQUIREMENTS.md
with closure notes; pending-todo tree reduced 21 → 2, both survivors promoted to Phase 16
with named owners (`PKG-01`, `PKG-03`); `docs-review-disposition.test.ts` green
(150 findings, 0 undispositioned); `docs-deferred-ledger.test.ts` green in both
directions; ROADMAP.md's Phase 15 section carries the real 12-plan list and outcome Notes.
A post-execution code review found one CI-breaking blocker the plans' own gate could not
see (`test:automated` excludes `vice-proxy.test.ts`); fixed in `c340a61`, and the
verifier's one DEBT-01 gap fixed in `7c6d55d`.

**Phase 12 — Audit Integrity Instrument — is COMPLETE (2026-08-22, 7/7 plans,
verification `passed` 11/11).** The record disagreement flagged here earlier is
resolved, and it was a bookkeeping gap, not missing work: plan 12-07's three
tasks were executed and committed on 2026-08-21 (`f81abd6`, `6ca1785`) but its
SUMMARY was never written, so every plan index reported 12-07 incomplete and
the phase never closed. `/gsd-execute-phase 12`'s safe-resume gate caught the
mismatch, stopped before dispatching a duplicate executor, and the SUMMARY was
reconstructed from the two commits with every acceptance criterion re-run live
rather than assumed (`f9729fb`). Re-verification then re-derived all 11 truths
from the tree instead of copying the prior report forward, and corrected three
drifted `audit-gate.mjs` line citations (`checkAuditGate()`:353,
`hookGuardVerdict()`:836, `hookMain()`:944). ROADMAP's superseded
"gaps_found, 6/11" verdict is replaced.

Both `GATE-01` layers are now proven. Layer 1 is `checkAuditGate()` under
`npm test` and CI; Layer 2 is the committed `Write|Edit|Bash` PreToolUse hook,
observed live refusing all four write routes — Write, Edit in two payload
shapes, a Bash heredoc, and a subagent's Write — against a genuinely red guard,
then allowing the same Write after the revert. Standing, disclosed limitation:
that evidence is session-observed rather than independently human-reproduced,
covering Claude Code 2.1.238 on this host; `12-GATE-PROOF.md` §"Provenance of
these observations" says so and names what it does not establish.

Phase 13 — External Verification — is COMPLETE (2026-08-22, 5/5 plans,
verification `passed` 9/9 after one gap-closure round). It verified the
milestone's three highest-value carried items against real binaries instead
of internal proxies. Plans 13-01/13-02 re-recorded the three `VERIF-02`
binmon fixtures (captured from fork `/usr/local/bin/x64sc` 3.10, labelled
truthfully as such per D-13-02's dynamic resolution) and confirmed the
`--help` backend discriminator against real stock (VICE 3.9) and fork (VICE
3.10) binaries. Plan 13-03 live-probed Phase 3's four wire assumptions
against fork VICE 3.10 (A1/A2 CONFIRMED, A3 INCONCLUSIVE, A5 CONTRADICTED);
A4 was deliberately excluded (D-13-05) and remains the sole open item in its
probe-debt todo. Plan 13-04 removed the A1/A2 `[ASSUMED]` labels, left A3/A5
labelled, and shipped a permanent label-discipline guard
(`assumption-label-discipline.test.ts`). Plan 13-05 closed the phase's
record: both retired verdicts in `docs/phase2-backend-probe-evidence.md`
resolved with artifact citations, two finished todos moved to
`.planning/todos/completed/`, the third trimmed to A4, two new findings
filed, and the Deferred Items ledger below reconciled.

Post-phase, at the tail gates: A5's contradiction is an advertised
*tool-contract* defect (`vice_disk_attach`'s D-14 promise), so per D-13-04's
escape hatch it became a high-priority todo rather than a source fix, and
EXTV-03 now carries a closure note in REQUIREMENTS.md recording that
carve-out explicitly. `13-REVIEW.md`'s four findings were dispositioned into
a pending todo (WR-01 fixed at source: `checkCommandAvailable()` no longer
interpolates into a shell command line); that todo also records the
structural cause worth fixing — the code-review gate runs *after* the last
plan's SUMMARY, so no plan can ever disposition its own phase's findings,
which is why phases 08, 09 and 13 each filed the same todo.
Phase 14 — Backend Decision — all 5 plans executed (2026-08-22). FORK-01
decided `retain` at 14-01's blocking-human checkpoint; FORK-02 verified true
with zero rewrite (14-02) and exercised live for the first time against a
real fork binary (14-03, 6/6 passing); 14-04 confirmed a clean retain-branch
recorded zero; 14-05 closed the record — the fork-removal todo moved to
`.planning/todos/completed/` with a Resolution section, FORK-01/FORK-02
ticked Complete in REQUIREMENTS.md, and ROADMAP's Phase 14 Notes plus Phase
15/16/17 dependency notes resolved against the decision.

**Phase 15 — Debt and Review Disposition — is COMPLETE (2026-08-22, 12/12
plans).** The milestone's bulk workload: every open code-review finding
across all phases dispositioned (`GATE-02`), the pending-todo tree reduced
from 21 to 2 with every remaining item promoted to a named Phase 16 owner
(`DEBT-01`), all five undocumented behaviours documented at point of use
(`DEBT-02`), and Phase 03's three UAT scenarios executed live with evidence
(`DEBT-03`, scenario 2's joystick half an honest negative result). Plan
15-01 widened `docs-review-disposition.test.ts`'s parser first, as the
phase's tracer, discovering 150 findings where the guard had only ever seen
119 — the same guard that had reported green at the v0.3.0 close while blind
to 31 findings across three phases. Plan 15-12 (wave 9, the phase's
designated closer) transcribed Phase 08's ten-finding verdict table from
plans 15-02/15-03's landed commits, closed the three remaining
`wont-fix`/promoted todos, filled in every `### Promoted by DEBT-01` owner,
flipped the four requirements Complete with closure notes, and reconciled
the ledger to 2 pending todos with zero UAT gaps. Next session should read:
ROADMAP's Phase 16 section (Packaging and Repo Shape — `PKG-01`..`PKG-04`,
which owns both remaining pending todos) and `## Deferred Items` below.
Last activity: 2026-08-23 — Phase 17 execution started

## Performance Metrics

**Velocity:**

- Total plans completed: 156
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 10 | - | - |
| 03 | 18 | - | - |
| 04 | 7 | - | - |
| 05 | 13 | - | - |
| 07 | 18 | - | - |
| 08 | 6 | - | - |
| 08.1 | 5 | - | - |
| 08.2 | 6 | - | - |
| 09 | 8 | - | - |
| 10 | 9 | - | - |
| 11 | 12 | - | - |
| 13 | 5 | - | - |
| 12 | 7 | - | - |
| 14 | 5 | - | - |
| 15 | 12 | - | - |
| 16 | 11 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 03 P17 | N/A | 2 tasks | 0 files |
| Phase 03-direct-tools P18 | 5m | 1 tasks | 0 files |
| Phase 08.1 P01 | 15min | 3 tasks | 3 files |
| Phase 08.1 P03 | 25m | 3 tasks | 1 files |
| Phase 08.1 P02 | 22min | 3 tasks | 3 files |
| Phase 08.1 P04 | 90min | 2 tasks | 5 files |
| Phase 08.1 P05 | 45min | 2 tasks | 3 files |
| Phase 09 P01 | 30min | 3 tasks | 5 files |
| Phase 09 P08 | 10m | 2 tasks | 2 files |
| Phase 11 P03 | 28min | 3 tasks | 10 files |
| Phase 11.1 P01 | 45min | 2 tasks | 4 files |
| Phase 11.1 P02 | 55min | 2 tasks | 7 files |
| Phase 11.1 P03 | 45m | 2 tasks | 1 files |
| Phase 11.1 P04 | 95min | 3 tasks | 5 files |
| Phase 11.1 P05 | ~2h | 3 tasks | 9 files |
| Phase 11.1 P06 | 70min | 3 tasks | 3 files |
| Phase 11.1 P07 | ~3.5h | 4 tasks | 8 files |
| Phase 12 P01 | 90min | 2 tasks | 2 files |
| Phase 12 P02 | 150min | 3 tasks | 3 files |
| Phase 12 P03 | 40min | 2 tasks | 4 files |
| Phase 12 P04 | 35min | 1 tasks | 1 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 12 P05 | 22min | 3 tasks | 3 files |
| Phase 12 P06 | 55min | 3 tasks | 2 files |
| Phase 13 P01 | 40min | 3 tasks | 11 files |
| Phase 13 P02 | 27min | 2 tasks | 7 files |
| Phase 13 P03 | 25min | 3 tasks | 2 files |
| Phase 13 P04 | 25min | 3 tasks | 7 files |
| Phase 13-external-verification P05 | 35min | 3 tasks | 8 files |
| Phase 14 P01 | 17min | 3 tasks | 4 files |
| Phase 14 P02 | 22min | 3 tasks | 2 files |
| Phase 14 P03 | 25min | 2 tasks | 6 files |
| Phase 14 P04 | 37min | 2 tasks | 4 files |
| Phase 14 P05 | 26min | 2 tasks | 6 files |
| Phase 15 P01 | 28min | 3 tasks | 5 files |
| Phase 15 P02 | 22 min | 3 tasks | 3 files |
| Phase 15-debt-and-review-disposition P03 | 19min | 3 tasks | 6 files |
| Phase 15 P04 | 40min | 3 tasks | 7 files |
| Phase 15 P08 | 24min | 3 tasks | 3 files |
| Phase 15 P05 | 45min | 3 tasks | 6 files |
| Phase 15-debt-and-review-disposition P06 | 35min | 3 tasks | 6 files |
| Phase 15 P07 | 55min | 3 tasks | 12 files |
| Phase 15 P09 | 40min | 3 tasks | 10 files |
| Phase 15 P10 | 28min | 3 tasks | 8 files |
| Phase 15 P11 | 40min | 3 tasks | 11 files |
| Phase 15 P12 | ~40min (estimated) | 3 tasks | 14 files |
| Phase 16 P01 | 50min (estimated) | 3 tasks | 46 files |
| Phase 16-packaging-and-repo-shape P02 | 25min | 2 tasks | 3 files |
| Phase 16 P03 | 10min | 2 tasks | 3 files |
| Phase 16 P04 | ~55min | 3 tasks | 238 files |
| Phase 16 P06 | 55min | 3 tasks | 3 files |
| Phase 16 P07 | ~90min | 3 tasks | 15 files |
| Phase 16 P05 | 40min | 3 tasks | 6 files |
| Phase 16 P08 | 40min | 3 tasks | 6 files |
| Phase 16 P09 | 35min | 2 tasks | 5 files |
| Phase 16 P10 | ~70min | 3 tasks | 8 files |
| Phase 16 P11 | 30min | 2 tasks | 2 files |
| Phase 17 P01 | 20min | 2 tasks | 2 files |
| Phase 17 P02 | 25min | 2 tasks | 3 files |
| Phase 17 P03 | 35min | 3 tasks | 5 files |

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Close v0.2.0 audit items: UAT walkthrough + planning-doc drift (URGENT)
- Phase 8.2 inserted after Phase 8.1: Close v0.2.0 blockers: stock drive-config defect, red test gate, walkthrough re-run (URGENT)
- v0.3.0 opened as Phases 9-11, continuing v0.2.0's numbering rather than resetting to 1.
- v0.3.0 re-split from two phases to three: `R2000-16`'s assumption probe was
  promoted out of Phase 9's body into a standalone go/no-go phase. Its failure mode
  is *reconsider the milestone*, not *replan the phase* — if regenerator2000 cannot
  be driven without a human, the annotation store is unreachable from a skill and
  the thesis is in question. A note inside a larger phase makes that gate skippable;
  a phase boundary makes it structural. Precedent: v0.2.0 Phase 8.1, where running
  the one unwitnessed claim falsified it.

- Phase 11.1 inserted after Phase 11: Close v0.3.0 audit items: the stale .vsf pointer, the undocumented CLI verbs, and the guards that let them drift (URGENT)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: BACK-02 (fork backend unchanged) is a success criterion in Phase 2
  only, plus a standing per-phase regression gate — not a criterion repeated per
  phase. See ROADMAP.md "Standing Constraints".

- Roadmap: DERIV-07's derived-tool interception seam is built once in Phase 4
  alongside its first and largest consumer (the disassembler); Phase 5's
  screenshots and derivations and Phase 6's gains all route through it.

- Roadmap: the disassembler library is protocol-independent and may be built in
  parallel with Phase 2/3 — the largest parallelism win available.

- Milestone: all three stock-only gain groups in scope (not parity-first).
- Milestone: backend selected project-level, one per MCP server process; parity
  verification therefore requires two server processes.

- [Phase ?]: Route authorised: pr-branch — push a branch and open a PR against main; no push/branch/tag/publish performed by 03-17 — milestone v0.2.0 is only 3 of 8 phases done; publishing now would ship a partial stock backend to real users
- [Phase 03-direct-tools]: CI validated via pr-branch route: PR #9 (ci/phase-03-validation -> main), GitHub Actions build job concluded success against sha f040d79efdfe02fc5a22a77589052c138f5cdc20; no push to main, no tag, no release, no npm publish; PR left open unmerged
- [Phase 08.1]: Checklist emits one composite PASS/FAIL line per D-item (not per sub-condition) so the RED baseline shows zero PASS lines despite already-true guard conditions
- [Phase 08.1]: 08.1-03: FINDING-A1 corrected/widened -- the acme-build scaffold's missing cbm/c64/* library gap also breaks CI's own apt-provisioned environment, verified via apt-get download + dpkg-deb -x
- [Phase 08.1]: 08.1-03: capture target built from a new library-free ACME source (hand-rolled hardware constants) per human decision, instead of installing an ACME stdlib or hand-editing acme-build/template.a
- [Phase 08.1]: 08.1-03: scratch project wired via route A (local installer) + hand-edited .mcp.json, not claude plugin marketplace add/install, to avoid writing into machine-global ~/.claude/plugins/ state shared with the live orchestrating session
- [Phase 08.1]: STATE.md frontmatter left untouched (already correct: 7/9 phases, 78%); only STATE.md's/ROADMAP.md's bodies were reconciled with it
- [Phase 08.1]: Criterion 2 verified rather than re-authored: 08-VALIDATION.md already read status: audited / nyquist_compliant: true from prior commit 4306338; evidence recorded, file left unmodified
- [Phase 08.1]: Recorded criterion-1 UAT walkthrough result honestly as failed — Genuine stock x64sc boots with Drive8Type=0 by default; no MCP tool on the stock surface can set it, so the disk-based capture cannot complete; no workaround was applied to force a pass (FINDING-C1 in 08.1-WALKTHROUGH-EVIDENCE.md).
- [Phase 08.1]: Root-caused the recurring STATE.md Progress-line drift to two disagreeing GSD SDK formulas (uncapped plan-file ratio vs phase-fraction-capped computeProgressPercent), then caught its own initial 78% fix going stale mid-execution when a state.* frontmatter auto-resync mechanism correctly advanced ground truth to 8/9 phases (89%); corrected the body line to 89%, synced ROADMAP.md via roadmap.update-plan-progress, and replaced D-5's brittle bare-literal checklist assertion with a body-vs-frontmatter self-consistency invariant.
- [Phase 08.1]: Carried the confirmed Drive8Type=0 open product defect (plan 08.1-04's live-proven finding, confirmed fix -drive8type 1541 at launch, not yet applied) forward into STATE.md's Deferred Items/Blockers and ROADMAP.md's Phase 8.1 notes as explicit open backlog, rather than leaving it recoverable only from a dated decision-log line.
- [Phase quick-260819-vie]: One release-assets seam (scripts/release-assets.sh) now owns stamp/zip/attach; both release and release-on-merge CI jobs call it with the version as an explicit argument — v0.2.0 shipped with zero release assets because the merge path's GITHUB_TOKEN-created tag never re-triggers the tag-gated release job
- [Phase 09-01]: Human authorized cargo install regenerator2000 and tmux install at a blocking checkpoint; both performed by the human, never by this agent (its own tool-permission classifier denies cargo install outright)
- [Phase 09-01]: regenerator2000 0.9.20's real toolchain floor is rustc >=1.88 (transitive, undeclared in Cargo.toml), not edition 2024's 1.85; --locked does not work around it; rustup update stable (1.85.1->1.97.1) was a human-authorized host change
- [Phase 09]: Go/no-go verdict recorded: **`degrade`**, rule **`R4`** fired (triggering input: `c3_4_vsf_load: partial`), against installed **regenerator2000 0.9.20**. Full evidence, all seven criteria and the reproduced decision rule live in one place: `docs/phase9-regenerator2000-probe-findings.md` (frontmatter `verdict`/`verdict_rule_applied`/`criteria`) — read there, not restated here.
- [Phase 09-08]: Ran sequentially on main with no worktree isolation, per this plan's own worktree: false frontmatter -- its deliverable IS STATE.md/ROADMAP.md content, which worktree mode strips from executor commits
- [Phase 09-08]: Added a ROADMAP Phase 11 Notes pointer to the findings document even though the verdict produced no scope amendment there, because Phase 11's own pre-existing Notes anticipated a criterion-3(3) format-mismatch contingency that needed an explicit answer (it did not fire)
- [Phase 11-03]: Ran sequentially on main with no worktree isolation, per this plan's own worktree: false frontmatter -- its deliverables ARE .planning/ROADMAP.md/REQUIREMENTS.md content plus two todo-file git mv moves, which worktree mode strips from executor commits
- [Phase 11-03]: Reworded ROADMAP.md's Phase-10-criterion-3 .vsf note from 'Phase 11 confirmed this (D-34)' to 'confirmed by D-34' after the literal string 'Phase 11' on a .vsf-mentioning line tripped the acceptance grep gate that checks no document still names Phase 11 as .vsf's home -- same meaning, mechanically clean
- [Phase 11.1]: D-11.1-01: both r2000-cli.ts .vsf surfaces reworded to name .planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md instead of a phase; a committed character-state-machine guard (docs-dangling-refs.test.ts) now fails if any shipped string literal names a phase number
- [Phase 11.1-02]: D-11.1-02: gen-enums, export-lbl, import-lbl documented in c64-memory-mapping/c64-program-recon; the symbol round trip documented as one closed loop matching Phase 11's live walkthrough, not two one-way dumps
- [Phase 11.1-02]: check-skill-tool-coverage.mjs's r2000 CLI verb list is parsed from r2000-cli.ts's dispatch switch (scripts/lib/r2000-cli-verbs.mjs), never hand-typed -- proven non-vacuous by a committed planted-violation test
- [Phase 11.1-03]: INT-01/D-11.1-03 -- hostpath-consumers.test.ts's r2000 absence list is now readdirSync-derived with a floor (>= 14) rather than a hard-coded 10-name array; the four previously-uncovered modules (r2000-acme-ident.ts, r2000-regbits-gen.ts, r2000-symbols.ts, r2000-test-gate.ts) are now covered and confirmed clean
- [Phase 11.1-03]: Phase 10 IN-02 -- the hostpath.ts import detector now matches the whole comment-stripped source with the m flag (catching multi-line named imports) plus a dedicated dynamic-import pattern (catching await import(...)), each proven by a committed planted-violation test
- [Phase 11.1]: D-11.1-04 (WR-10): default runR2000() timeout 120s, maxBuffer 32 MiB, proven live against real regenerator2000 0.9.20 (38/38 pass) and the timeout proven real via a separate child process.
- [Phase 11.1]: D-11.1-05 (INT-02): r2000-launch.ts's header corrected to name r2000-mcp-client.ts as a second, necessary async spawn site; R2000-01's guard-before-spawn invariant is now checked by r2000-spawn-seam.test.ts over the shipped module set (package.json files[]), not a raw directory listing, to exclude r2000-test-gate.ts's legitimate --version probe.
- [Phase 11.1]: D-11.1-06 (Phase 11 IN-02): regenerateAndReload() marked library-only rather than given an invented caller; a biconditional guard in r2000-symbol-roundtrip.test.ts ties the LIBRARY-ONLY marker to the real production-caller count in both directions.
- [Phase 11.1]: 11.1-05: WR-11 pinned bidirectionally via fileClaimViolations(); IN-03's isStandaloneDisasmToken() excludes hyphen-adjacent-letter shapes to stop false-positiving on Phase 4's disasm-*.ts; IN-01's drained/bounded process.exit() also fixed a self-inflicted EPIPE-crash regression, using a test-only env-var hatch since neither plan-named payload route scales past ~220 bytes on this host's regenerator2000
- [Phase 11.1]: IN-06 map is built from ground-truth code behaviour, not USAGE text; export-asm's USAGE was corrected to document its real --entry forwarding
- [Phase 11.1]: verify refuses both --out and --force (the identical accepted-but-ignored shape), not just the --out case IN-06 named
- [Phase 11.1]: WR-12's tautology only reproduces when writeChain's write formula and extractEntry's read formula are mutated together in a self-consistent way; a single-sided mutation breaks the round-trip test too
- [Phase 11.1-07]: AUDIT-01/04/05 closed: every Phase 10/11 review finding now has a cited disposition (11 fixed, 1 deferred); STATE.md's Deferred Items is derived from .planning/todos/pending/ and guarded both directions; Operator Next Steps names the two remaining Phase 10 coverage commands then /gsd-complete-milestone v0.3.0
- [Phase 11.1-07]: Task 4's ledger-completeness guard (docs-review-disposition.test.ts), scanning every phase not just 10/11, found 27 undispositioned findings before this plan (7 in Phase 10/11, 20 outside it: Phase 01 six, Phase 02 one, Phase 08 nine, Phase 09 one, Phase 11 one) versus the plan's own pre-measured 8 -- confirming the process risk was real and larger than predicted; closed to zero by fixing (Phase 01, quick task 260821-a86) or filing (Phase 08) each
- [Phase 12]: audit-gate.mjs built as the single check point; the planted-violation test in audit-integrity.test.ts caught runGuardsLive() silently reporting green under a red guard when nested under an outer node --test (NODE_TEST_CONTEXT inheritance), fixed by stripping NODE_TEST_* from the guard subprocess env
- [Phase 12-02]: RESEARCH.md's Route A (piggyback on live PreToolUse hooks) does not hold on this host -- resolved A1 via session-transcript inspection instead, without registering a hook or restarting the session
- [Phase 12-02]: audit-gate.mjs's hook mode is fail-open outside the Write/Edit/MultiEdit/NotebookEdit/Bash + MILESTONE-AUDIT-token scope, fail-closed on every internal error once in scope; exit 2 plus stderr is the sole blocking mechanism, never exit-2-plus-permissionDecision JSON (anthropics/claude-code#43407)
- [Phase 12-03]: settings.json split into a committed hooks-only file (Write|Edit|Bash PreToolUse -> audit-gate.mjs --hook) and .claude/settings.local.json (merged machine-specific permissions, still ignored); MultiEdit/NotebookEdit deliberately left out of the matcher since neither was verified against the live hook runtime
- [Phase 12-03]: Layer 1 (audit-integrity.test.ts) now asserts the settings.json hook block itself (5 new tests), proven non-vacuous by two live break-and-restore probes against the real committed file (missing file -> exit 1; matcher narrowed to Write|Edit -> exit 1 naming the heredoc-bypass risk), closing T-12-09's silent-deletion gap
- [Phase 12]: GATE-01's real-tree proof confirms status: tech_debt is gated alongside status: passed (D-12-12); gaps_found is never gated (D-12-13). — Both tech_debt and passed route to /gsd-complete-milestone, so both must be blocked while a docs guard is red; a milestone honestly reporting open gaps must never be blocked from saying so.
- [Phase 12]: GATE-01's Bash-mode write-target scan is a content-adjacency heuristic, evadable by a base64/python -c runtime-assembled payload (T-12-02, accepted). — Layer 1 (audit-integrity.test.ts driving checkAuditGate(), which re-reads the actual committed file content regardless of how the shell wrote it) is the unevadable enforcement point; the hook is a deterrent, not the boundary.
- [Phase 12]: [Phase 12-05]: CR-01/CR-03 closed via a bounded, non-backtracking token locator (auditTokenOffsets/textNamesMilestoneAudit, indexOf-based) plus small fixed-length windows (256/512/4096 chars), replacing the two super-linear Bash regexes and the unbounded whole-text token regex; a new unanchored gated-status scan (declaresGatedStatusUnanchored, derived from the single GATED_STATUSES set) replaces the line-anchored scan specifically in the Bash branch, closing the single-line echo/printf/tee-a/sed-i append bypass while leaving the structured Write/Edit document-content branch's line-anchored scan untouched (preserves the T-12-04 false-positive defence). WR-04's dead pathish push removed. New accepted limitation T-12-20: an in-place edit whose script argument exceeds the 4096-char window is not detected (Layer 1 still catches the landed write).
- [Phase 12]: [Phase 12-06]: CR-02/WR-01/WR-02/WR-03 closed -- collectStringLeaves() converted to an iterative, depth-capped walk (MAX_LEAF_DEPTH=200, MAX_LEAF_NODES=50000) returning a truncation signal; hookMain() hoists the HOOK_MATCHER_TOOLS check above extraction and wraps scope determination in a try/catch; main()'s check-mode block is wrapped in one try/catch so a bad --root fails cleanly in both output modes; runGuardsLive() bounds its spawnSync to 15s (WR-01, gated at source level only, no behavioral timeout test); checkAuditGate() short-circuits before the guard spawn on a structural failure (WR-02). The --hook exit surface is now exactly {0, 2}.
- [Phase 13]: Captured against the fork build (command -v x64sc resolves to /usr/local/bin/x64sc on this host) rather than forcing genuine stock, recording the truthful fork: kind per D-13-01/D-13-02
- [Phase 13]: checkpoint-list terminator-frame reading CONFIRMED against real bytes; stock-protocol.ts left untouched
- [Phase 13]: Corrected checkpoint-list correlat: test's events.length (2 -> 8) against real capture bytes rather than loosening the assertion
- [Phase 13]: EXTV-02 shared with sibling 13-05; requirements.ready-ids correctly held 0/1 ready, not marked complete yet
- [Phase 13]: x64sc --help's own startup diagnostics are not byte-reproducible across runs (randomized VSP-bug channel line); discriminator substrings themselves are stable -- documented in 13-HELP-DISCRIMINATOR-EVIDENCE.md and fixtures README rather than silently worked around
- [Phase 13]: Phase 13 plan 03: probed A1/A2/A3/A5 live against fork VICE 3.10 -- A1/A2 CONFIRMED, A3 INCONCLUSIVE, A5 CONTRADICTED (AUTOSTART with runAfter=false still resets+loads); vice_disk_attach contract finding handed to plan 13-05
- [Phase 13]: Phase 13 plan 04: A1/A2 assumption labels removed (confirmed live against fork VICE 3.10); A3/A5 left assumed (INCONCLUSIVE/CONTRADICTED); A5's vice_disk_attach tool-contract finding handed to plan 13-05 via D-13-04's escape hatch; assumption-label-discipline.test.ts ships as a permanent all-or-nothing label guard
- [Phase 13]: Phase 13 plan 05: closed both retired verdicts in docs/phase2-backend-probe-evidence.md -- EXTV-01 (fork:/usr/local/bin/x64sc, VICE 3.10.0.0; terminator-frame reading CONFIRMED, event order differs from the synthetic model but matches phase1-probe-results.md) and EXTV-02 (probeBackend()/resolvedBackend() confirmed against both real binaries, -help/-? fallback branches recorded unexercised rather than verified); moved the fixtures and discriminator todos to completed/ with Resolution sections; trimmed the probe-phase3 todo to A4 only; filed two new pending todos (cpuhistory-get* sidecar mislabel; vice_disk_attach's D-14 approximation contradicted by A5); reconciled STATE.md's Deferred Items ledger against the post-phase todo tree -- docs-deferred-ledger.test.ts green in both directions
- [Phase 14]: FORK-01 decided `retain` by a human at the blocking-human checkpoint (14-01 Task 2): the forked VICE MCP backend stays the default hedge, formalised in PROJECT.md with a dated Key Decisions row naming KEYBOARD_MATRIX_SET reversal criteria. Sub-question B was NOT overridden.
- [Phase 14]: [Phase 14-02] FORK-02 evidenced true on the retain branch with zero rewrite: all 17 point-of-use mention sites verdicted holds-as-is; runtime refusal for vice_sid_get_state/vice_keyboard_matrix/vice_keyboard_restore pinned by three tests; capability-registry.ts and all 8 skill/doc files left unedited, recorded as the decided retain-branch outcome rather than an omission.
- [Phase 14]: fork-live.test.ts drives vice.ts's real HTTP transport seam (useInstance/call/serverInfo) against buildViceArgs()'s own fork-branch argv, forced to loopback -- registered as MANUAL_ONLY_TESTS entry 8 — Criterion 3 required the fork's own -mcpserver transport to be live-exercised at least once; no prior test in this repo had ever done so (broker-e2e.test.ts stubs the binary; the phase 8 human walkthrough and phase 13 live captures were stock-only or spoke the wrong protocol)
- [Phase 14]: [Phase 14-04] Retain branch recorded zero: both code-consequence tasks (fork-default flip in backend-detect.mts; vice-errors.ts extraction from vice.ts) confirmed skipped -- gated to non-retain branches by their own precondition; git diff --quiet -- .claude/mcp/vice clean
- [Phase 14]: [Phase 14-05] Closed the record: fully-remove-the-forked-vice-mcp-backend todo disposed retain (moved to completed/ with Resolution section); FORK-01/FORK-02 marked Complete in REQUIREMENTS.md; ROADMAP.md's Phase 14 Notes and Phase 15/16/17 dependency notes resolved against the retain decision; warp-over-resource_set todo answered on its fork-facing question (not moot, mark fork-only per SKILL-01); pending-todo count reduced 21->20 (22->21 total Deferred Items), not the DEBT-04 true close
- [Phase 15]: Widened docs-review-disposition.test.ts's parseFindingIds() regex to /^#{2,6} +(WR|IN|CR)-(\d+)(?![0-9])/gm -- discovers all 150 findings across every *-REVIEW.md (was 119); 03-REVIEW.md's 14 level-4 findings and 14-REVIEW.md's no-colon IN-01 were invisible to the old regex
- [Phase 15]: 14-REVIEW.md IN-01 closed via a new completed todo citing commit 69465e41c580a0bcbf97fc7e4b58cbfac6e368ac -- fixed in Phase 14 but never cited in a source docs-review-disposition.test.ts recognises
- [Phase 15]: 03-REVIEW.md's eight newly-surfaced findings filed as one pending todo owned by plan 15-04, with per-finding re-verification against current source correcting two of the plan's own stale verdicts (WR-08, IN-03 both confirmed STILL OPEN, not moot/superseded)
- [Phase 15]: WR-07's allowlist narrowing implemented exactly per 08-REVIEW.md's fix; documented that it does not catch a future stealth mention of a currently-unreferenced hardware/fork tool (architectural limit of the single-pass filter), not silently claimed closed. — Evidence-based disposition over an inflated 'fully fixed' claim, matching this plan's own prohibition against recording a finding fixed without proof.
- [Phase 15-debt-and-review-disposition]: WR-05 already fixed (commit 21a42cb); no new code needed, cited with the TS7016/allowJs:false reason the review's suggested import route was not taken — capability-registry.test.ts's synthetic-tool set was already derived mechanically from vice-proxy.ts before this plan ran
- [Phase 15-debt-and-review-disposition]: Plan 15-04 closed all eight of 03-REVIEW.md's newly-surfaced findings, re-verifying each against current source before touching anything. WR-06/IN-05/IN-06 fixed in stock-live.test.ts (commit aaaffce); IN-02/IN-04 fixed and WR-07/IN-03 re-verified-then-fixed in stock-registers.ts/.test.ts/vice-proxy.test.ts (commit e8621d7) — WR-07's false-negative class and IN-03's dead union member were confirmed still live by direct source inspection, contrary to the plan's own stale premise that both had superseded; WR-08 likewise confirmed STILL OPEN (README.md still said "three" against an actual eight, and still omitted VICE_LIVE_STOCK_BIN) and fixed rather than recorded superseded, since the plan's "moot" premise did not hold either. The pending todo this phase's 15-01 plan filed was moved to `.planning/todos/completed/` with a Resolution section citing all eight verdicts and commits; pending-todo count returns to 20 (see `### Pending Todos` above and `## Deferred Items` below)
- [Phase 15]: [Phase 15-04] WR-08 and IN-03 re-verified against current source and found STILL OPEN, contrary to the plan's own stale "moot"/"superseded" claims; both fixed for real (README.md manual-only count/env var, OPEN_SERVERS narrowed to Set<Server>) rather than dispositioned falsely. — Matches this plan's own must-have (never record a finding fixed/superseded without a landed fix or reproducible evidence) and 15-01's precedent of trusting direct source verification over inherited review claims.
- [Phase 15]: [Phase 15-04] registerCatalogFor() now caches the in-flight promise (not the resolved catalog) with rejection eviction, closing a real concurrent-duplicate-REGISTERS_AVAILABLE race; non-vacuity proven by two planted-revert probes. — IN-02's finding was real: two synchronous callers on a fresh session previously each saw an empty cache before either write landed, sending two wire requests.
- [Phase 15]: 15-08: closed 03-HUMAN-UAT.md scenarios 1/2 with live evidence against genuine stock VICE 3.9 -- scenario 1 pass (byte-comparison snapshot round trip), scenario 2 partial (keyboard pass, joystick zero-delta reproducing Phase 13 A3 under a proven-running program; no [ASSUMED] label touched) — DEBT-03 requires execution with evidence, not a claim; both scenarios were live-testable in this environment
- [Phase 15]: 02-REVIEW.md IN-05 fixed: stockReconnect() thrown message corrected to name itself, pinned by a derived where:-vs-message-prefix invariant test (commit 9849224)
- [Phase 15]: 09-REVIEW.md IN-01..IN-03 recorded wont-fix on evidence-immutability grounds (Phase 9's probe-harness transcripts back the milestone's degrade/R4 verdict); not one byte under Phase 09's directory changed
- [Phase 15]: 13-REVIEW.md WR-01 confirmed already fixed at commit f73d0fa (contrary to 15-RESEARCH.md's stale two-line-fix claim) and pinned mechanically via a readdirSync-derived sh -c interpolation gate; WR-02/IN-01 deferred with named reopen triggers; IN-02 promoted to plan 15-12 with a named owner
- [Phase 15]: Phase 15 plan 15-06 closed DEBT-02's items 1-2-3 (drive-type closing note, project-root prerequisite, RELEASES.json schema) in c64-ram-capture/SKILL.md, each grep-verified against the implementing module; three todos moved to completed/
- [Phase 15]: Phase 15 plan 15-07 fixed three cheap pending todos: build-atomic.test.ts's cleanup-scan flake (private wrapper dir, proven by planted violation, commit 7484afa), cpuhistory-get*/cpuhistory-get-multi.json's mislabelled fork-as-stock capturedFrom (commit d67f0ef, derive-the-kind follow-on named rather than fixed since it touches evidence-immutable probe-binmon.mjs), and the hand-copied ACME/regenerator2000 gate migration onto r2000-test-gate.ts across three files (commit 185187a), proven by a measured before/after pass-count table identical in every cell
- [Phase 15]: Phase 15 plan 15-09: GAINS-PROTOCOL.md's warp error codes corrected to the measured 2026-08-20 stock-3.10 values (0x01 object-does-not-exist, 0x8f only for int-typed set); vice_machine_config_set's WarpMode caveated fork-only in docs/stock-vice-parity.md and capability-registry.ts (existing fields, no schema growth); vice_ping's resolvedBinaryPath documented as a startup-time probe with a new backward-compatible resolvedBinaryPathScope field. Both pending todos closed; STATE.md ledger reconciled (pending 12->10, total 13->11).
- [Phase 15]: [Phase 15-10]: A4 (the D-11 rate-limiter's setImmediate() auto-disable deferral) live-tested against genuine stock VICE (KERNAL IRQ at $EA31, ~21 observed hits/sec) and CONFIRMED for the rates and host tested -- auto-disable fired, wire-side enabled flag independently confirmed false, emulator kept progressing; probe-debt todo closed with all five original assumptions accounted for
- [Phase 15]: [Phase 15-10]: 03-HUMAN-UAT.md's last pending scenario (scenario 3) closed pass, citing 15-A4-PROBE-EVIDENCE.md; file now carries zero result: [pending] rows, status stays partial (scenario 2's joystick half remains an honest negative result)
- [Phase 15]: [Phase 15-11] vice_disk_attach's approximation string and docs/stock-vice-parity.md's D-14 bullet both corrected to state the real reset-plus-load behaviour Phase 13's A5 probe observed; the plan's own claimed second disagreeing site at :311 was verified and found unrelated (a different D-14).
- [Phase 15]: [Phase 15-11] tools-manifest.json staleness todo disposed wont-fix on the D-16 ground (deliberate deletion, not staleness); fork-live.test.ts's live-surface diff now names D-16 explicitly via a new shared fork-deleted-tools.ts constant, never a second hand-typed list.
- [Phase 15]: [Phase 15-11] CI test-command divergence settled keep-npm-test from GitHub Actions run 32517575905's own log (all nine MANUAL_ONLY_TESTS suites pass cleanly in under two minutes); documented in ci.yml's Test-step comment citing the run id, naming zero manual-only test filenames.
- [Phase 15]: [Phase 15-11] vice_disk_attach's contract-redesign question promoted to REQUIREMENTS.md Future Requirements with plan 15-12 named as owner, not implemented here; REQUIREMENTS.md itself untouched by this plan.
- [Phase 15]: [Phase 15-12] Closed the phase's record: Phase 08's ten review findings (WR-04..WR-13) transcribed with resolvable commits into one Resolution table; broker-tests-stall and .vsf-bootstrap-input todos closed wont-fix; keyboard-fallback-load todo promoted with a named owner (plan 15-08's live evidence met neither of the two closing conditions this plan named); GATE-02/DEBT-01/DEBT-02/DEBT-03 flipped Complete with closure notes; pending-todo count reduced from 21 (as of 15-01) to 2, both remaining items promoted to Phase 16 (PKG-01, PKG-03)
- [Phase 15]: [Phase 15-01, restated by 15-12's phase-close] The widened guard's two new invariants: a shape-drift detector (declaredFindingIdsInHeadings(), anchored at any heading level 1-6, whose output must be a subset of the narrower parser's) so a future fifth heading shape fails a named test instead of silently vanishing; and a fixture-driven regression test (planted WR-98/IN-97 shapes in fixtures/planted-review-fixture.md) pinning the two previously-invisible shapes against a committed fixture
- [Phase 16]: Phase 16 plan 01: skills relocated to src/skills/; D-16-02 accepted losing in-repo autoload, documented two consumer routes in README.md; found and fixed 3 out-of-scope functional path literals (r2000-regbits-gen.ts MEMMAP_PATH family) that the plan's own consumer enumeration missed
- [Phase 16-packaging-and-repo-shape]: Accept broker control-plane 0.0.0.0 bind (PKG-04) rather than narrowing it — The bind exists so a containerised consumer dialing host.docker.internal can reach the broker; narrowing without a replacement route would be a regression. Compensating control: 256-bit token, timingSafeEqual, mode-0600 broker.json. Recorded in PROJECT.md Key Decisions with a named smart-default follow-on.
- [Phase 16]: 16-03: PKG-01 merge half verified rather than rebuilt -- wireMcp() already implemented correct merge semantics; added 18 node:test cases (in-process happy paths + subprocess-driven refusal paths via an entry-point dispatch guard) pinning it against the shipped cli.mjs, zero new dependencies — The pending todo's own Solution step 4 asked for exactly this test; a malformed-config refusal was the security research's named tampering mitigation and was previously unasserted
- [Phase 16]: Phase 16 plan 04: relocated the MCP server package (@henols/vice-mcp) from .claude/mcp/vice/ to src/mcp/vice/ in one atomic git mv; repoRoot()'s branch-4 hop count reviewed and left unchanged (same 3-segment depth); found and fixed 3 functional literals plus ~22 stale .claude/skills self-references that plan 16-01's own sweep missed; published tarball proven byte-identical to the pre-move baseline — PKG-01's second, larger half -- the same relocation machinery plan 16-01 proved on the skills tree, driven through the ~180-file vice-mcp package
- [Phase 16]: Phase 16 plan 16-06: PKG-02 closed -- all three previously-untested skill CLI scripts (acme.mjs, driver.mjs, derive.mjs) now have committed, discovered test coverage (47 new tests: 16+17+14); a driver.mjs .d.mts declaration file was tried and reverted after it leaked into the installer npm tarball, replaced with a scoped @ts-expect-error on the one import line instead; parseAddr()'s null-address branch confirmed unreachable through the shipped (unexported) surface, pinned to its nearest reachable observed proxy rather than invented or fixed by editing the script.
- [Phase 16]: PKG-03: comment-scoped orphaned-phase-pointer guard built; 15 sites + 2 test decision-id strings repointed at existing permanent records; fixture + gate-proof committed — Cut-phase citations must name the phase, not its number (re-tripping risk); matching is per-physical-line, not per-span, to avoid cross-line false positives measured in the real corpus
- [Phase 16]: Phase 16 plan 05: swept CLAUDE.md/README.md/docs/*.md path references to relocated src/ trees; re-verified all four vice-proxy.ts line citations unchanged; fixed a pre-existing acme-build Project Skills table description drift; left one 2026-08-12 command transcript in docs/phase1-probe-results.md untouched as historical record
- [Phase 16]: [Phase 16-08]: Leak assertions promoted into assertLeanTarball(), invoked from inside packFiles() so no packed package skips the check; the packed-package name set is pinned to exactly two names so a third package cannot be packed unchecked.
- [Phase 16]: [Phase 16-08]: ci-suite-coverage.test.ts fixed a self-inflicted regression in ci-guardrails.test.mjs (its npm-test-step assertion assumed exactly one such step existed repo-wide); scoped to working-directory: src/mcp/vice.
- [Phase 16]: [Phase 16-08]: Two pre-existing npm-test failures (docs-review-disposition.test.ts, audit-integrity.test.ts) tripping on 16-REVIEW.md's own undispositioned findings, confirmed via git stash to predate this plan; logged to deferred-items.md as out of scope, expected closure at 16-11.
- [Phase 16]: [Phase 16-09]: hop-chain-comments.test.ts built as a fixture-pinned, per-line structural guard against WR-02's defect class (a comment splicing a current path-chain segment onto pre-relocation intermediate segments); demonstrated RED against both real violations before fixing them. r2000-regbits.test.ts's two scratch-tree segment lists and .gitignore's canonical-source comment renamed to the current src/mcp/vice / src/skills shape (behaviour-neutral, proven by the drift guard's own unequal digests). SUMMARY deliberately avoids naming 16-REVIEW.md's OTHER open finding by its literal id token, since docs-review-disposition.test.ts's disposition check is a bare-word presence scan that would otherwise falsely close it -- that finding stays open, owned by plan 16-10.
- [Phase 16]: 16-10: Reverted CR-01 consumer-path regression (renderLedger/anchor-search/renderLoading/template.a/SKILL.md), shipped skill-consumer-paths.test.ts as a frozen four-entry registry guard against the class recurring; docs-review-disposition.test.ts and audit-integrity.test.ts confirmed fully green (2386/2342/0/39/5) for the first time this phase
- [Phase 16]: [Phase 16-11]: PKG-04 flipped to checked/Complete in REQUIREMENTS.md with a closure note citing PROJECT.md's dated accepted-risk row and 16-PKG04-EVIDENCE.md, explicitly preserving the open Control-Plane Bind Follow-on; PKG-01 given a companion closure note naming plans 16-08/16-10
- [Phase 16]: [Phase 16-11]: New decision register 16-GAP-CLOSURE-DECISIONS.md records five deliberate non-reversals with owners/reversal triggers (four SKILL.md quick-references, recovery-schema.mjs, project-paths.mjs, repo-root.test.ts, and 16-REVIEW.md's IN-01 recorded as renamed-not-left by plan 16-09), the spec-less probe's four-item accounting (two authored, two flagged unresolved), the three recalled prohibitions, and five newly-found sites with their closing plans
- [Phase 17]: Dropped docs-deferred-ledger.test.ts's non-vacuity pending floor to no floor at all (not a smaller nonzero number), since 0 pending is DEBT-04's own success criterion, and made the positive control conditional on pending.length > 0 (selecting its stem from the live pending array instead of a hard-coded filename) — The previous floor of 2 could not express a genuinely empty pending tree; the guard's own prior-author comment named this exact phase as the one that might need to lower it further
- [Phase 17]: STATE.md's Deferred Items ledger now reads the true v0.4.0-close count of 0, derived from and agreeing with the empty .planning/todos/pending/ tree — Phase 16 discharged both remaining pending todos (PKG-01, PKG-03); the ledger text was stale by exactly those two rows until this plan's Task 2
- [Phase 17]: CORE-01 decided keep-dated at plan 17-02 task 1's blocking-human checkpoint, delegated by the human to the orchestrator, recorded in PROJECT.md → Core Value dated 2026-08-23 — Full evidence presented at the checkpoint; human declined to select and delegated the call; orchestrator selected keep-dated on R2000-01's structural VICE-incapability argument and v0.4.0's lack of new evidence

### Pending Todos

0 pending (0 files in `.planning/todos/pending/` + 0 UAT-gap rows = 0) — see
`.planning/todos/pending/` (`/gsd-capture --list`). The count
is authoritative in `## Deferred Items` below, which is derived from the todo
tree and guarded in both directions by `docs-deferred-ledger.test.ts`. This
section previously read 18 (set at the phase 13 close) before rising and
falling again across Phase 15's own dispositioning work (see below); between
the phase 13 close and now,
phase 14 plan 14-03 filed one more (the `tools-manifest.json` staleness
finding) and other tail activity filed two more (a phase-12 regression-gate
finding and the phase-13-close review-disposition finding), bringing the
count to 21, before phase 14 plan 14-05 closed the fork-backend-removal
question against the dated `FORK-01` decision, moving it to
`.planning/todos/completed/` and returning the count to 20. Phase 15 plan
15-01 then filed one more (`03-REVIEW.md`'s eight newly-surfaced findings,
one todo), bringing the count to 21, before phase 15 plan 15-04 fixed all
eight of that todo's findings (WR-06/WR-07/WR-08, IN-02/IN-03/IN-04/IN-05/
IN-06) and closed it — moved to `.planning/todos/completed/` with a
Resolution section — returning the count to 20. Phase 15 plan 15-05 then
closed the Phase 09 `IN-01`..`IN-03` todo `wont-fix` (evidence immutability;
see `.planning/todos/completed/`), returning the count to 19, and closed the
Phase 13 `WR-01`/`WR-02`/`IN-01`/`IN-02` todo (`WR-01` already fixed and now
pinned; the other three deferred/promoted with named triggers/owners — see
`.planning/todos/completed/`), returning the count to 18. Phase 15 plan 15-06
Task 1 then closed the drive-type-prerequisite and project-root-`.git`-marker
todos (DEBT-02 items 1 and 2), both documented at the point of use in
`c64-ram-capture/SKILL.md` — see `.planning/todos/completed/` for both
Resolutions — returning the count to 16. Task 2 then closed DEBT-02's third
item, the `RELEASES.json` schema todo, adding a `## Release registry shape`
section plus a copyable `RELEASES.json.example` — returning the count to 15.
Phase 15 plan 15-07 then closed the `build-atomic.test.ts` flake, the
mislabelled `cpuhistory-get*` fixtures, and the ACME/regenerator2000 gate
migration (three todos, see `.planning/todos/completed/`), returning the
count to 12. Phase 15 plan 15-09 then closed the `vice_ping`
`resolvedBinaryPath` documentation todo and the warp-over-RESOURCE_SET
refutation todo, returning the count to 10. Phase 15 plan 15-10 then live-answered
A4 (the `stop:false` rate-limiter's auto-disable deferral timing, CONFIRMED
against genuine stock VICE) and closed the `2026-08-14-probe-phase3-assumed-
wire-details` todo in full — see `.planning/todos/completed/` for its
Resolution — returning the count to 9. Phase 15 plan 15-11 Task 1 then
corrected `vice_disk_attach`'s refuted no-side-effect record (both the
returned approximation string and `docs/stock-vice-parity.md`'s D-14 bullet)
and closed that todo — see `.planning/todos/completed/` — returning the count
to 8. Task 2 then closed the `tools-manifest.json` staleness todo `wont-fix`
on the inverted D-16 ground and fixed `fork-live.test.ts`'s reporting so the
same false finding cannot recur — see `.planning/todos/completed/` —
returning the count to 7. Task 3 then settled the CI test-command divergence
from a real GitHub Actions run's own log (run `32517575905`; all nine
`MANUAL_ONLY_TESTS` suites pass cleanly on the runner, so `npm test` stays in
CI, documented with the run id in `ci.yml`'s `Test`-step comment) and closed
that todo too — see `.planning/todos/completed/` — returning the count to 6.
**Phase 15 plan 15-12 (the phase's designated closer) then closed all four remaining
"genuinely close now" todos in one task:** the Phase 08 review todo (`WR-04`
through `WR-13`, ten findings — both plans 15-02 and 15-03 had already fixed all
ten at source; this closure transcribes their per-finding verdicts with
resolvable commits into one `## Resolution` table), the broker-tests-stall todo
(`wont-fix`, promoting the pre-existing 2026-08-12 user decision), the `.vsf`
bootstrap-input todo (`wont-fix`, quoting `REQUIREMENTS.md`'s own Out of Scope
table verbatim — required updating three shipped runtime/comment string
literals in `r2000-cli.ts`/`r2000-project.ts` and `docs-dangling-refs.test.ts`'s
own `VSF_BACKLOG_ITEM` constant from `pending/` to `completed/`, since the
r2000 CLI's own refusal message names this exact path), and the
keyboard-fallback-load todo (promoted with a named owner — neither of the
two closing conditions the plan named was met by plan 15-08's live evidence:
scenario 1 used `vice_autostart`, not the keyboard-typed `LOAD` route, and
scenario 2's `vice_keyboard_petscii` injection proved keyboard injection
works but never issued a `LOAD` command, so neither reproduced this todo's
specific stall nor demonstrated the fallback route working) — see
`.planning/todos/completed/` for all four Resolutions. Two todos remain
pending, both promoted to a Phase 16 requirement with a named owner rather
than fixed here (`2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json`
→ `PKG-01`; `2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments`
→ `PKG-03`; both already carry `resolves_phase: 16` in their own frontmatter) —
returning the count to **2**. See `## Deferred
Items` below for the current, itemised list — this prose figure must always
equal that section's table row count, which has gone stale twice before and
is not itself guarded.

**As of phase 15 plan 15-12 Task 1 (2026-08-22), only two todos remained pending
— both promoted, neither fixed nor closed at that point.** Plan 15-12 Task 1 closed the
four todos that used to fill this paragraph's "newest pending" slot —
`2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned` (ten
Phase 08 findings, transcribed with resolvable commits from plans 15-02/15-03),
`2026-08-12-vice-broker-tests-stall-outside-devcontainer` (`wont-fix`,
promoting the pre-existing 2026-08-12 decision), `2026-08-20-vsf-as-a-
bootstrap-input` (`wont-fix`, quoting `REQUIREMENTS.md`'s own Out of Scope
line verbatim), and `2026-08-19-keyboard-fallback-load-does-not-progress-
within-bounded-poll` (promoted with a named owner — plan 15-08's live
evidence bore on neither of the two closing conditions) — see
`.planning/todos/completed/` for all four Resolutions.

The two todos that had remained pending were `2026-08-20-relocate-plugin-payload-
under-src-and-merge-mcp-json` and `2026-08-21-stale-phase-pointers-in-stock-
cia-and-stock-dispatch-comments`, both promoted to named Phase 16
requirements (`PKG-01` and `PKG-03` respectively — both todos already carried
`resolves_phase: 16` in their own frontmatter, confirmed against
`REQUIREMENTS.md`'s Phase 16 goal text before promoting) rather than fixed in
Phase 15. Neither was carried silently: both were recorded with named owners
in `REQUIREMENTS.md` → Future Requirements → `### Promoted by DEBT-01`.

**Phase 16 then closed both** (2026-08-23): `PKG-01` and `PKG-03` both read
`Complete` in `REQUIREMENTS.md`'s Traceability table, and
`.planning/todos/pending/` is empty for the first time in this project's
history. Phase 17 plan 17-01 Task 2 (2026-08-23) is the terminus of this
history — it measured the true count and found it 0, updating this section's
opening figure from 2 to 0. This section's opening figure above (`0 pending`)
is derived from, and must always equal, `## Deferred Items`'s table row count
below — a discipline that has gone stale twice before and is not itself
guarded.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260817-n6p | Fix WR-01 — bound `decode()`'s `startAddress` to `0..0xffff` in `disasm-decoder.ts` | 2026-08-17 | e19d8eb |  | [260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i](./quick/260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i/) |
| 260818-nh5 | Close Phase 07 UAT gap: fix stale evidence-key assertion in `stock-live-triage.test.ts`, restore the restarted live proof, and close the manual-only gate hole | 2026-08-18 | acc9933 (+84cca54, 9831fa8) |  | [260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc](./quick/260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc/) |
| 260818-obc | Live-prove the broker-mediated `monitor_held_elsewhere` verdict and the broker-supervised `restarted` respawn against a real host broker daemon and genuine stock VICE (both 3.9/3.10); closes TIME-04 | 2026-08-18 | 662dfd4, 0b236f1, b3965eb, d2a9235 |  | [260818-obc-live-prove-the-broker-mediated-monitor-h](./quick/260818-obc-live-prove-the-broker-mediated-monitor-h/) |
| 260819-rop | Fix milestone-audit D4-2 and NEW-1: stop ROADMAP.md asserting Phase 7 owns disk detach, and correct the D-07 "same argument shape" claim to backward-compatible at all six live sites plus a structural test pinning it | 2026-08-19 | f574e21, 79af9a7, 3344809 |  | [260819-rop-fix-d4-2-and-new-1-from-v0-2-0-milestone](./quick/260819-rop-fix-d4-2-and-new-1-from-v0-2-0-milestone/) |
| 260819-tsz | Replace six hand-maintained version strings with one `VERSION` template (`0.2.-`, `-` = auto-managed slot) plus a resolver seam, wired into CI; a hand minor/major bump now publishes X.Y.0 instead of continuing the old patch count | 2026-08-19 | 38a56ac..811746b (16 commits) | passed (verifier returned `partial` on a stale-README gap; gap closed in 7665025, and 8/8 code-review findings fixed) | [260819-tsz-single-version-template-plus-resolver-sc](./quick/260819-tsz-single-version-template-plus-resolver-sc/) |
| 260819-vie | Fix the release-asset gap: extract stamp+zip+upload into one seam (`scripts/release-assets.sh`) called by both release paths, since `release-on-merge`'s GITHUB_TOKEN tag cannot re-trigger the tag-gated `release` job; v0.2.0's missing plugin zip attached retroactively | 2026-08-19 | 4867535..ee296c0 (4 commits, all `[skip release]`) | passed (asset verified by download: zip + sha256, `plugin.json`/`marketplace.json` all `0.2.0`) | [260819-vie-extract-release-stamp-zip-upload-into-on](./quick/260819-vie-extract-release-stamp-zip-upload-into-on/) |
| 260820-jwb | Post-Phase-9 repo hygiene: bound CI's ACME install with a 5-minute timeout and 3-attempt apt retry (todo closed), gitignore `.vice-snapshots/`/`.vscode/`/`.claude/settings.json` with tarball-drift verification, and correct four stale ahead-of-`origin/main`-at-a-superseded-tag release claims to the true v0.2.0-shipped position | 2026-08-20 | 393ddf7, 5fbf66b, b86e596, 828bea4, 823943c | passed (npm tarballs unaffected, `test:automated` 1699/1704 unchanged) | [260820-jwb-post-phase-9-repo-hygiene-ci-acme-timeou](./quick/260820-jwb-post-phase-9-repo-hygiene-ci-acme-timeou/) |
| 260821-a86 | Close Phase 11's three open SECURITY.md findings: WR-01's parent-realpath containment in `resolveStorePath()` (deepest-existing-ancestor walk + dangling-symlink-component refusal), T-11-NAME-INJECT's REJECT policy on both label-name entry routes (`r2000_set_label_name` outer *and* batch-inner, `importLabels()` naming the offending `.lbl` line) via a new dependency-free `r2000-acme-ident.ts` seam, and WR-04's Markdown-cell escaping in `renderMemoryMap()`; `11-SECURITY.md` flipped to `threats_open: 0` / `status: verified` | 2026-08-21 | de788b9, bb08c46, 2c287cb | passed (orchestrator re-ran the gates independently: `tsc --noEmit` clean, `test:automated` 1947 tests / 1942 pass / 0 fail / 5 pre-existing todo, `check-npm-packages.mjs` green, all three controls confirmed present in source) | [260821-a86-fix-phase-11-security-md-open-findings-w](./quick/260821-a86-fix-phase-11-security-md-open-findings-w/) |
| 260821-jd8 | Close 10-REVIEW.md's WR-08, Phase 10's last open security finding: `parseArgs()`'s `--entry`/`--out` refused a missing or flag-shaped value (`bootstrap x.prg --out --entry FOO` wrote a project literally named `--entry`); reused `parseExportLblArgs()`'s existing guard shape across all three verbs that route through `parseArgs()` (`bootstrap`, `export-asm`, `verify`); pinned by 10 new tests proven non-vacuous against a scratch pre-fix revert; assigned T-10-19, `10-SECURITY.md` flipped to `threats_open: 0` / `status: verified`; pending todo moved to `completed/` with a Resolution section | 2026-08-21 | 3541886, e0fd305 | — | [260821-jd8-close-wr-08-flag-shaped-option-values](./quick/260821-jd8-close-wr-08-flag-shaped-option-values/) |

### Blockers/Concerns

- **Phase 1 external prerequisite:** VERIF-01 needs a real stock VICE build and a
  display on the *host*; this repo's container has neither. Confirm availability
  before planning Phase 1.

- **`docs/phase0-binmon-findings.md` is normative (ingest W2) and currently
  wrong in four places.** Until Phase 1 lands, do not derive protocol design
  from it — in particular, a condition written on `LIN` instead of `RL` fails at
  runtime with error `0x8f` and gives no diagnostic over the socket.

- **Requirement count discrepancy resolved:** REQUIREMENTS.md said 63; the file
  contains 67 items. Corrected to 67 in the Coverage block.

- ~~**Open coverage gap:** ... Decide: add `SKILL-01` mapped to Phase 8, or defer
  explicitly.~~ **Decided (recorded 2026-08-18).** `SKILL-01` exists, is written up at
  `REQUIREMENTS.md:110`, and is mapped to Phase 8 in both `REQUIREMENTS.md:227` and
  ROADMAP.md's Phase 8 Requirements list. The decision had already been taken; only
  this note lagged.

- **`CPUHISTORY_GET` needs VICE ≥ 3.10**; Debian and all current Ubuntu ship 3.9,
  so the milestone's headline gain is unavailable on the most common `apt`
  install path. Graceful degradation is required, not optional.

- Phase 08.1 plan 03 Task 2 blocked: acme-build's own template.a cannot assemble on this machine -- the ACME binary at ~/.local/bin/acme has no accompanying cbm/c64/*.a library, apt has a candidate (acme 1:0.97~svn20211115+ds-2) but this session has no passwordless sudo. Needs a human to run 'sudo apt-get install -y acme' (or supply an ACME library at $ACME) before the criterion-1 walkthrough's capture target can be built. See 08.1-WALKTHROUGH-SETUP.md FINDING-A1.

- **Fixed product defect (FINDING-C1, Phase 8.1 plan 04, fixed Phase 8.2):** the
  broker used to launch stock `x64sc` with `Drive8Type=0` (NONE) by default. No tool
  on the stock MCP surface (`vice_disk_attach`, `vice_autostart`) set a drive type, so
  `LOAD"*",8,1` failed `?DEVICE NOT PRESENT ERROR` and every disk-based
  `c64-ram-capture` walkthrough against genuine stock VICE failed at the load step
  -- and plan 03's live measurement found the blast radius was **all program loads**
  (a bare `.prg` autostart hit the identical wall too), not merely disk loads.
  Phase 8.2 plan 02 landed the fix (`-drive8type 1541` in `buildViceArgs()`'s stock
  branch); plan 03 proved the fixed argv reaches a real live launch; plan 04 re-ran
  the same walkthrough end to end and recorded `capture_result: pass`
  (`08.2-WALKTHROUGH-EVIDENCE.md`), flipping `08-HUMAN-UAT.md` Test 1 to
  `status: passed` (human-approved, 08.2-04 Task 3). Full original diagnosis:
  `08.1-WALKTHROUGH-EVIDENCE.md` FINDING-C1; superseded outcome recorded at
  `08-HUMAN-UAT.md` Test 1.

- **Phase 9 verdict accepted limit — `.vsf` machine-type auto-detection does not
  generalise beyond C64.** A `.vsf` produced by `vice_snapshot_save` against genuine
  stock VICE loads into regenerator2000 with the correct RAM content and start
  address, but its displayed machine type is a coincidental default, not a genuine
  read — the snapshot's raw `machine_name` (`"C64SC"`) matches none of
  `file_io.rs`'s four literal match arms. **What this breaks:** the ROADMAP's standing
  "prefer `.vsf` over `.raw`" constraint is unsupported as worded for the machine-type
  field, and Phase 10 criterion 3 (plus any future non-C64 `.vsf` extension of
  `c64-ram-capture`) must verify or explicitly set the system rather than trust
  auto-detection. See `docs/phase9-regenerator2000-probe-findings.md` § Accepted
  limits, entry 2.

- **Phase 9 verdict accepted limit — `use_illegal_opcodes` is not the keystroke-
  bootstrap default.** regenerator2000's illegal-opcode reassembly passed, but only
  under a direct-JSON-edit override; the fresh bootstrap (criterion 2b) leaves the
  project setting `false`, and auto-analysis does not flip it. **What this breaks:**
  `R2000-09`'s automated-bootstrap work and any pipeline wanting illegal-opcode-correct
  disassembly must explicitly set `settings.use_illegal_opcodes = true` in the
  generated `.regen2000proj` before exporting or verifying — it does not withhold the
  Phase 10 criterion 4 / `R2000-06` deletion decision, which was earned against real
  illegal opcodes. See `docs/phase9-regenerator2000-probe-findings.md` § Accepted
  limits, entry 1.

## Deferred Items

**13 items acknowledged and deferred at the v0.2.0 milestone close on 2026-08-19**
(superseded by the current count below, kept here as history rather than
overwritten). The pre-close artifact audit reported these; the round-4
milestone audit had already assessed the same set as `tech_debt` with no
blockers. They were accepted rather than resolved, and were v0.3.0's
inheritance unless dispositioned sooner.

**As of phase 13 plan 13-05's close (2026-08-22): 19 items — 18 pending
todos plus Phase 03's UAT gap — derived from `.planning/todos/pending/` and
guarded by `docs-deferred-ledger.test.ts` (AUDIT-04) — this table is no longer
hand-maintained (superseded by the current count below).** Phase 13 closed two of the three highest-value carried
probe-debt todos against real binaries: the binmon-fixture re-record todo
(closing `EXTV-01`) and the `--help` backend-discriminator todo (closing
`EXTV-02`) — both moved to `.planning/todos/completed/` with Resolution
sections citing plans 13-01/13-02's commits and evidence documents. The
third — the Phase 3 wire-assumption probe-debt item (closed in full by phase 15 plan 15-10; see
`.planning/todos/completed/`) — stayed pending at this point: three
of its four wire assumptions (A1/A2/A3/A5, live-probed by plan 13-03) were
then answered, and it was trimmed to A4 — the `stop:false` rate-limiter's
auto-disable deferral timing — as its only remaining item, deliberately
excluded at that time because arming that probe risked stalling the emulator's CPU loop.
Phase 13 also filed two new todos for findings it surfaced but did not fix:
a mislabelled `cpuhistory-get*` sidecar pair (`capturedFrom: "stock"`
recorded for a fork binary) and an advertised-tool-contract finding for
`vice_disk_attach` (its documented no-side-effect approximation is
empirically false, per plan 13-03's A5 probe). The pending count holds at 18
— two closed, two filed — by arithmetic coincidence, not because nothing
moved.

Before phase 13, the 18th todo was filed *at the v0.3.0 close*: the same
`docs-review-disposition.test.ts` guard, run as part of the close, was found red
at `4f048bb` with Phase 09's `IN-01`..`IN-03` undispositioned — predating the
close, not caused by it. That todo was later closed `wont-fix` by Phase 15
plan 15-05 on evidence-immutability grounds — see `.planning/todos/completed/`
for the Resolution. 4 of the 18 were
opened during v0.3.0 (the fork-backend-removal question — resolved 2026-08-22
by Phase 14 plan 14-05, see `.planning/todos/completed/` for the Resolution
section;
the plugin-payload relocation under `src/` with the `.mcp.json` merge
(resolved 2026-08-23 by Phase 16 as `PKG-01`, see `.planning/todos/completed/`
for the closed todo),
the `.vsf`-as-a-regenerator2000-bootstrap-input backlog item (resolved
`wont-fix` 2026-08-22 by Phase 15 plan 15-12, quoting `REQUIREMENTS.md`'s own
Out of Scope line — see `.planning/todos/completed/` for the Resolution), and
the warp-over-RESOURCE_SET
refutation (resolved 2026-08-22 by Phase 15 plan 15-09, see
`.planning/todos/completed/` for the Resolution)); 3 more were opened
by Phase 11.1 itself while dispositioning Phase 10/11's review findings and
building Task 4's completeness guard, which caught undispositioned findings
outside Phase 10/11 too
(the hand-copied ACME/regenerator2000 gate migration — resolved 2026-08-22 by
Phase 15 plan 15-07, see `.planning/todos/completed/` for the Resolution;
the stale phase pointers in `stock-cia.ts` and `stock-dispatch.ts` comments
(resolved 2026-08-23 by Phase 16 as `PKG-03`, see `.planning/todos/completed/`
for the closed todo);
the Phase 08 review-disposition backlog item, v0.2.0's `08-REVIEW.md`
`WR-04`..`WR-13`, resolved 2026-08-22 by Phase 15 plans 15-02/15-03/15-12 —
see `.planning/todos/completed/` for the Resolution).
**Three rows from the 2026-08-19/18-items counts above are removed here
because their todos now live in `.planning/todos/completed/`, not because the
items were dropped:** the second-binmon-client wedge-lookalike documentation
todo (2026-08-17), the acme-build scaffold-library todo (2026-08-19), and
WR-08's flag-shaped/missing option-value todo (2026-08-21, closed by quick
task 260821-jd8 — assigned T-10-19 in `10-SECURITY.md`, now `status:
verified` / `threats_open: 0`) are all resolved and closed — see
`.planning/todos/completed/` for the filed resolutions.

Before phase 15, as of phase 14 plan 14-05 (2026-08-22): 21 items — 20
pending todos plus Phase 03's UAT gap. Between the phase-13 close and then,
one todo was filed by 14-03 (the `tools-manifest.json` staleness finding, see
below) and other tail activity added two more (a phase-12 regression-gate
finding and the phase-13-close review-disposition finding, both listed
below), bringing pending to 21. Plan 14-05 then closed the
fork-backend-removal question against the dated `FORK-01` decision (`retain`)
— its todo moved to `.planning/todos/completed/` with a Resolution section —
leaving the count at 20 pending todos.

**Current, as of phase 15 plan 15-01 (2026-08-22): 22 items — 21 pending
todos plus Phase 03's UAT gap.** Task 1 widened
`docs-review-disposition.test.ts`'s parser (`^### (WR|IN|CR)-(\d+):` →
any heading level 2-6, id terminated at the first non-digit), which surfaced
31 previously-invisible findings (119 → 150 total) and 9 genuinely
undispositioned among them. Task 2 closed `14-REVIEW.md`'s `IN-01` with a
cited, commit-referencing disposition, filed to `.planning/todos/completed/`
(see that directory for the full record) — fixed in Phase 14, never
previously cited in a source the guard recognises. Task 3 (this update)
files `03-REVIEW.md`'s remaining eight (`WR-06`, `WR-07`, `WR-08`, `IN-02`,
`IN-03`, `IN-04`, `IN-05`, `IN-06`) as one new pending todo, owned by plan
15-04 — see the table row below. Pending count rises 20 → 21 (one filed,
none moved to completed); total items 21 → 22.

Plan 15-04 then fixed all eight of that todo's findings and closed it,
returning pending to 20 (total 21). Task 2 of plan 15-05 closed
`09-REVIEW.md`'s `IN-01`..`IN-03` `wont-fix` on evidence-immutability
grounds, moving that todo to `.planning/todos/completed/` — pending 20 → 19,
total 21 → 20. Task 3 closed
`13-REVIEW.md`'s `WR-01`/`WR-02`/`IN-01`/`IN-02` todo — `WR-01` already fixed
at source (commit `f73d0fa`) and now pinned by a derived test; `WR-02` and
`IN-01` deferred with stated reopen triggers; `IN-02` promoted out of this
repo to plan 15-12 — moving that todo to `.planning/todos/completed/` too:
pending 19 → 18, total 20 → 19. Plan 15-06 Task 1 then closed DEBT-02's
drive-type-prerequisite and project-root-`.git`-marker todos, documenting
both at the point of use in `c64-ram-capture/SKILL.md` (`## Boot a disk`'s
closing sentence and the new prerequisite line before `## The order`) —
pending 18 → 16, total 19 → 17. Plan 15-06 Task 2 then closed DEBT-02's
third item, `RELEASES.json`'s undocumented schema, adding a `## Release
registry shape` section (before `## References`) and a copyable
`RELEASES.json.example` — pending 16 → 15, total 17 → 16. Plan 15-07 Task 1
then closed the `build-atomic.test.ts` cleanup-scan flake (fixed at commit
`7484afa`, immune to concurrent `build()` callers) — pending 15 → 14, total
16 → 15. Task 2 then corrected the two `cpuhistory-get*` sidecars'
`capturedFrom` kind from `stock` to `fork` (commit `d67f0ef`), with the
derive-the-kind-automatically sub-item promoted to a named follow-on rather
than implemented, since it would touch `probe-binmon.mjs` — pending 14 → 13,
total 15 → 14. Task 3 then migrated the three hand-copied ACME/regenerator2000
gates in `r2000-cli.test.ts`, `r2000-project.test.ts` and
`disasm-roundtrip.test.ts` onto the shared `r2000-test-gate.ts` seam (commit
`185187a`), proven by a measured before/after pass-count table (identical in
both the default and opt-in runs) — pending 13 → 12, total 14 → 13. Plan 15-09
then closed the `vice_ping` `resolvedBinaryPath` documentation todo (a
`resolvedBinaryPathScope` sibling field added to the response, plus a
module-scope comment in `vice-proxy.ts`, pinned by a new
`vice-proxy-ping.test.ts`) and the warp-over-RESOURCE_SET refutation todo
(`GAINS-PROTOCOL.md`'s error codes corrected, a fork-only caveat landed in
`docs/stock-vice-parity.md` and `capability-registry.ts`, `docs/tool-support.md`
regenerated) — pending 12 → 10, total 13 → 11.
Plan 15-10 then answered A4 (the `stop:false` rate-limiter's auto-disable deferral timing) live
against genuine stock VICE — a real KERNAL-IRQ-hot checkpoint exceeded the D-11 guard's
20-hits-per-second limit, the auto-disable fired, its wire-side `enabled` flag was independently
confirmed `false`, and the emulator kept progressing afterward. Verdict CONFIRMED (for the rates
and host tested); no new todo was filed. The Phase 3 probe-debt todo left carrying only that
final assumption is closed in full (all five original assumptions accounted for — see its own
`## Resolution` in `.planning/todos/completed/`) — pending 10 → 9, total 11 → 10.
Plan 15-11 Task 1 then closed the `vice_disk_attach` approximation-contradicted-
by-A5 todo — `stock-machine.ts`'s `handleDiskAttach` and `docs/stock-vice-parity.md`'s
D-14 bullet both corrected to state the real reset-plus-load behaviour Phase 13's
A5 probe observed, with the contract-redesign question promoted to
`REQUIREMENTS.md` → Future Requirements (owner: plan 15-12, not yet landed) —
pending 9 → 8, total 10 → 9.
Plan 15-11 Task 2 then closed the `tools-manifest.json` staleness todo
`wont-fix` on the inverted D-16 ground (`vice_snapshot_list`'s absence is a
deliberate deletion, not staleness — regenerating would silently re-add it),
and fixed `fork-live.test.ts`'s live-surface diff so it no longer reports a
D-16-deleted name as an undifferentiated finding — pending 8 → 7, total 9 → 8.
Task 3 then settled the CI test-command divergence from a real GitHub Actions
run's own log (run `32517575905`, 2026-08-21): all nine `MANUAL_ONLY_TESTS`
suites pass cleanly on the runner in under two minutes, so `npm test` stays
in CI (deliberately wider than the local `npm run test:automated` gate),
documented in a comment above `ci.yml`'s `Test` step citing the run id — and
closed the todo — pending 7 → 6, total 8 → 7.
**Current, as of Phase 17 plan 17-01 Task 2 (2026-08-23): 0 items — 0 pending
todos, zero UAT gaps.** This is the first time the pending-todo tree has read
empty in this project's history. Phase 16 discharged both todos that were
still pending at the Phase 15 close — `PKG-01` (the plugin-payload relocation
under `src/` with the `.mcp.json` merge) and `PKG-03` (the stale phase
pointers in `stock-cia.ts`/`stock-dispatch.ts` comments) — moving this count
**2 → 0**. The count in this paragraph is derived from
`.planning/todos/pending/` and guarded in both directions by
`docs-deferred-ledger.test.ts`, whose non-vacuity floor this phase's own plan
17-01 task 1 lowered from `pending.length >= 2` to no floor at all: the
previous floor of two could not express a genuinely empty tree, and the
guard's own prior-author comment named this exact phase as the one that might
need to lower it further. The arithmetic in full: 0 pending todo files in `.planning/todos/pending/` + 0 UAT-gap rows = 0.
This 0 excludes, and does not
resolve, two categories this table's own accounting rule (pending todo files
plus any open UAT-gap row) never covered and still does not scan — the
guard's own header comment records both scoping exclusions explicitly, and
this paragraph states them rather than leaving a reader to infer zero known
debt: the `### Carried forward from earlier closes` table below, which still
carries four `Deferred` rows naming five items (`UP-01`/`UP-02` share one row;
then `QUAL-01`, `QUAL-02`, `QUAL-03`), and the roughly fifteen carried
WR-class code-review findings enumerated in
`milestones/v0.2.0-MILESTONE-AUDIT.md`. Both are unchanged by this
measurement.

| Category | Item | Priority | Status |
|----------|------|----------|--------|

*The ledger is empty at the v0.4.0 close. The header row above is retained
deliberately, so a reader can see the table was emptied rather than
truncated.*

Not counted above, because they are complete on disk: all nine
`.planning/quick/` tasks the v0.3.0 pre-close audit reported as `[missing]`
(`260817-n6p`, `260818-nh5`, `260818-obc`, `260819-rop`, `260819-tsz`,
`260819-vie`, `260820-jwb`, `260821-a86`, `260821-jd8`) each carry a PLAN and a
SUMMARY; the audit reads `missing` because their SUMMARY frontmatter has no
`status:` field. (This paragraph named only the first four until the v0.3.0
close; the five added since are the same false positive, not new debt.)
Likewise the three UAT files reported as gaps that read `resolved` / `passed` /
`passed` (`03-UAT.md`, `08-HUMAN-UAT.md`, `08.1-HUMAN-UAT.md`).

Also carried, not blocking: roughly fifteen WR-class code-review findings across
five phases, enumerated per phase in
`milestones/v0.2.0-MILESTONE-AUDIT.md` → `tech_debt`. **WR-13 is no longer among
them** — Phase 15 plan 15-03 fixed it (commit `e9fa737`): `dispatchStock()`'s
miss branch now calls `capabilityRefusalMessage(name, "stock")` instead of the
locally-hardcoded "the fork backend provides this tool" wording, pinned by two
new invariant tests scanning every shipped module for either forbidden shape.
See the Phase 08 review-disposition backlog item, moved to
`.planning/todos/completed/` by Phase 15 plan 15-12, for the full
ten-finding disposition table.

Also carried, not blocking, from Phase 11.1's own disposition ledger (filed
under `.planning/todos/completed/`, dated 2026-08-21): the test-only
env hatch `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES` in `vice-proxy.ts` (narrow,
inert unless explicitly set, no user-facing surface); the comment-scope gap in
plan 11.1-01's phase-pointer guard (`r2000-project.ts`'s one comment-only
FLOW-02 site is permanently outside that guard's string-literal-only reach);
`r2000-cli.test.ts`'s harmless duplicate of `writeChain()`'s used-byte formula
(used only to build unrelated CLI fixtures, never to verify the DOS
convention). **`02-REVIEW.md`'s IN-05** (`stockReconnect()`'s thrown message
named the wrong function) is no longer carried here — Phase 15 plan 15-05
fixed it at source (commit `9849224`) and pinned it with a derived test; see
`.planning/todos/completed/` for the Resolution.

### Carried forward from earlier closes

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Defect | `Drive8Type=0` default on stock broker launch blocked all program loads (`.d64` and bare `.prg` alike) via `c64-ram-capture` (FINDING-C1); fix `-drive8type 1541` at launch | **Fixed** — Phase 8.2 plans 02-04 landed the fix, proved it live, and re-ran the walkthrough to a recorded `pass` | v0.2.0 Phase 8.1 (2026-08-19), fixed in Phase 8.2 (2026-08-19) |
| Upstream | UP-01/UP-02 — `KEYBOARD_MATRIX_SET` opcode upstream to VICE | Deferred | v0.2.0 scoping |
| Quality | QUAL-01 — tests for `acme.mjs`, `driver.mjs`, `derive.mjs` | Deferred | v0.2.0 scoping |
| Quality | QUAL-02 — orphaned planning references in source comments | Deferred | v0.2.0 scoping |
| Quality | QUAL-03 — emulator control-plane network exposure | Deferred | v0.2.0 scoping |

## Session Continuity

Last session: 2026-08-23T09:06:45.701Z
Stopped at: Completed 17-03-PLAN.md
Resume file: None

## Operator Next Steps

**Phase 17 (Project Identity and Ledger Close) is complete, and with it every
v0.4.0 requirement (16/16, no open Traceability row).** `DEBT-04` and `CORE-01`
are both ticked Complete in `REQUIREMENTS.md` with closure notes; the
deferred-items ledger reads 0 (down from the 19 inherited at the v0.3.0
close); ROADMAP.md's Phase 17 section carries its real 3-plan list and
outcome; the full `npm test` suite is green with every `docs-*.test.ts` guard
passing. Milestone-close work itself (rewriting ROADMAP's `**v0.4.0 in
progress:**` narrative into a final-state paragraph, cutting the release) is
deliberately out of scope for Phase 17 — that belongs to the two commands
below.

**Read this before running either command below:** Phase 17 is the *last*
phase of v0.4.0, and `code_review` is enabled — this phase's own
post-execution review runs *after* this SUMMARY, with no Phase 18 in this
milestone to inherit or disposition anything it files. If that review (or any
later check) files a new todo into `.planning/todos/pending/`, the ledger
count this phase recorded as 0 is stale by exactly that much, and nothing
downstream in *this* milestone catches it structurally. **The backstop is
`/gsd-audit-milestone`**, which runs next and is itself gated by `GATE-01`
(blocks recording `status: passed` while any `docs-*.test.ts` guard is red) —
so a reader who later finds a Phase 17 todo in `pending/` should read that as
anticipated by this record, not missed by it.

The two next steps, in order:

1. **`/gsd-audit-milestone`** — audits v0.4.0's completion against its
   original intent before anything is archived. Run this first; it is the
   named backstop for any post-count finding above.

2. **`/gsd-complete-milestone`** — archives the completed milestone and
   prepares `PROJECT.md`/`ROADMAP.md`/`REQUIREMENTS.md` for the next cycle,
   once the audit above is clean.

**Optional, non-blocking:** `/gsd-cleanup` to archive completed v0.4.0 phase
directories, left until last — the same deliberate-non-archival convention
prior milestone closes used (none of v0.4.0's phase directories are archived
yet; all left in place).
