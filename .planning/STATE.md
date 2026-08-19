---
gsd_state_version: 1.0
milestone: v0.2.0
milestone_name: Switchable stock-VICE backend
status: executing
last_updated: "2026-08-19T13:23:20.621Z"
last_activity: 2026-08-19 -- Phase 08.2 execution started
progress:
  total_phases: 10
  completed_phases: 8
  total_plans: 87
  completed_plans: 81
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-12)

**Core value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.
**Current focus:** Phase 08.2 — close-v0-2-0-blockers-drive-config-test-gate-walkthrough

## Current Position

Phase: 08.2 (close-v0-2-0-blockers-drive-config-test-gate-walkthrough) — EXECUTING
Plan: 1 of 6
Next: /gsd-execute-phase 8.2
Status: Executing Phase 08.2
Last activity: 2026-08-19 -- Phase 08.2 execution started
Phase 08: Complete, UAT 12/12, all 20 code-review findings fixed, verification's
single human_verification item live-proven. Phase 8.1 closed the audit's one
unwitnessed claim and its seven stale documents -- and running that claim is what
falsified it: the walkthrough failed on a real defect. Audit round 2 (2026-08-19)
therefore returned `gaps_found` and Phase 8.2 was inserted as the actual last phase
of v0.2.0. **Do not tag v0.2.0 until 8.2 closes**, per
`.planning/v0.2.0-MILESTONE-AUDIT.md` §9. Its three blockers: the `Drive8Type=0`
stock-launch defect that leaves DIST-03 unsatisfied (§4.2), the red `npm test` gate
that would fail CI on the tagging push (§4.3), and the walkthrough re-run that has to
actually reach a verified 64K capture (plus the E-1..E-5 doc drift the defect created).

**Scope was cut on 2026-08-17.** The filter: does a shipped skill call the tool, or
does something a skill calls depend on it? The six skills call 29 tools -- 16 already
work on stock, 10 are buildable (8 in Phase 5, 2 in Phase 7), and 3 are provably
impossible (`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`) and
route to the fork via Phase 8. The fork's other 33 tools are called by no skill. Phase 6
was cut wholesale; screenshots, backtrace, checkpoint groups, disk detach and the parity
harness came out. See ROADMAP.md "Cut from scope" and REQUIREMENTS.md for the 17
CUT-marked requirements and 4 cut halves.

*(The impossible list was two until plan 05-08's skill-vs-manifest sweep found
`vice_keyboard_restore`, called by `c64-program-recon/references/control-flow.md:86` and
absent from the stock manifest. Recorded as a hard loss in `docs/stock-vice-parity.md` §A
item 2 — `KEYBOARD_FEED` (0x72) injects buffer text only and cannot pulse RESTORE/NMI.)*

Progress: [████████░░] 80%

*(Phase-based, matching frontmatter `percent`: 8 of 10 phases complete — the
denominator moved from 9 to 10 on 2026-08-19 when Phase 8.2 was inserted after audit
round 2 returned `gaps_found`, so the same 8 completed phases now read 80% rather than
89%. Do not "restore" the 89%: it was correct only while 8.1 was the last phase. The
earlier drift this note was written for is still worth knowing about --
this line had once drifted to 99% via an SDK `state.update-progress` call that computes a
different, real-time plan-file ratio (80 or 81 of 81 plans) with no phase-completion
cap, unlike this file's own frontmatter recompute (`buildStateFrontmatter`, disk
-ground-truth, phase-fraction-capped), which every `state.*` mutation triggers
automatically. Both ratios are individually valid measurements of different things;
only the phase-based one belongs on this line, labelled here so the two are never
conflated again. See `08.1-CONSISTENCY-READ.md` RESIDUAL-1 and its "Correction" note
for the 89%-vs-78% episode within Phase 8.1: 78% was this file's truth at that
plan's Task 2 start (7 of 9 phases, Phase 8.1 still in flight) and 89% its truth once
8.1's plans were all on disk. Both were correct for their moment, and so is 80% for
this one. The standing rule is the point: this line is phase-based, it is whatever
the frontmatter `percent` says, and it changes whenever the phase count does.)*

## Performance Metrics

**Velocity:**

- Total plans completed: 81
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

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Close v0.2.0 audit items: UAT walkthrough + planning-doc drift (URGENT)
- Phase 8.2 inserted after Phase 8.1: Close v0.2.0 blockers: stock drive-config defect, red test gate, walkthrough re-run (URGENT)

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

### Pending Todos

1 pending — `.planning/todos/pending/2026-08-11-correct-phase0-binmon-findings-three-verified-errors.md`
(subsumed by Phase 1's DOC-01..03; close it when Phase 1 lands).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260817-n6p | Fix WR-01 — bound `decode()`'s `startAddress` to `0..0xffff` in `disasm-decoder.ts` | 2026-08-17 | e19d8eb | [260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i](./quick/260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i/) |
| 260818-nh5 | Close Phase 07 UAT gap: fix stale evidence-key assertion in `stock-live-triage.test.ts`, restore the restarted live proof, and close the manual-only gate hole | 2026-08-18 | acc9933 (+84cca54, 9831fa8) | [260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc](./quick/260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc/) |
| 260818-obc | Live-prove the broker-mediated `monitor_held_elsewhere` verdict and the broker-supervised `restarted` respawn against a real host broker daemon and genuine stock VICE (both 3.9/3.10); closes TIME-04 | 2026-08-18 | 662dfd4, 0b236f1, b3965eb, d2a9235 | [260818-obc-live-prove-the-broker-mediated-monitor-h](./quick/260818-obc-live-prove-the-broker-mediated-monitor-h/) |

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

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Defect | `Drive8Type=0` default on stock broker launch blocked all program loads (`.d64` and bare `.prg` alike) via `c64-ram-capture` (FINDING-C1); fix `-drive8type 1541` at launch | **Fixed** — Phase 8.2 plans 02-04 landed the fix, proved it live, and re-ran the walkthrough to a recorded `pass` | v0.2.0 Phase 8.1 (2026-08-19), fixed in Phase 8.2 (2026-08-19) |
| Upstream | UP-01/UP-02 — `KEYBOARD_MATRIX_SET` opcode upstream to VICE | Deferred | v0.2.0 scoping |
| Quality | QUAL-01 — tests for `acme.mjs`, `driver.mjs`, `derive.mjs` | Deferred | v0.2.0 scoping |
| Quality | QUAL-02 — orphaned planning references in source comments | Deferred | v0.2.0 scoping |
| Quality | QUAL-03 — emulator control-plane network exposure | Deferred | v0.2.0 scoping |

## Session Continuity

Last session: 2026-08-19T11:11:44.295Z
Stopped at: Completed 08.1-02-PLAN.md
Resume file: None
