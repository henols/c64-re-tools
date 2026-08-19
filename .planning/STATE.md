---
gsd_state_version: 1.0
milestone: v0.2.0
milestone_name: Switchable stock-VICE backend
status: executing
last_updated: "2026-08-19T09:16:54.078Z"
last_activity: 2026-08-19
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 81
  completed_plans: 78
  percent: 78
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-12)

**Core value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.
**Current focus:** Phase 08.1 — close-v0-2-0-audit-items-uat-walkthrough-planning-doc-drift

## Current Position

Phase: 08.1 (close-v0-2-0-audit-items-uat-walkthrough-planning-doc-drift) — EXECUTING
Plan: 3 of 5
Next: Phase 08.1 (close-v0-2-0-audit-items-uat-walkthrough-planning-doc-drift) — planned, 0/5 plans executed
Status: Ready to execute
Last activity: 2026-08-19
Phase 08: Complete, UAT 12/12, all 20 code-review findings fixed, verification's
single human_verification item live-proven. Phase 8.1 is the last phase of
v0.2.0 -- it closes the audit's one unwitnessed claim and its seven stale
documents rather than shipping a feature.

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

Progress: [████████░░] 78%

## Performance Metrics

**Velocity:**

- Total plans completed: 76
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

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 03 P17 | N/A | 2 tasks | 0 files |
| Phase 03-direct-tools P18 | 5m | 1 tasks | 0 files |
| Phase 08.1 P01 | 15min | 3 tasks | 3 files |
| Phase 08.1 P03 | 25m | 3 tasks | 1 files |

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Close v0.2.0 audit items: UAT walkthrough + planning-doc drift (URGENT)

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

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Upstream | UP-01/UP-02 — `KEYBOARD_MATRIX_SET` opcode upstream to VICE | Deferred | v0.2.0 scoping |
| Quality | QUAL-01 — tests for `acme.mjs`, `driver.mjs`, `derive.mjs` | Deferred | v0.2.0 scoping |
| Quality | QUAL-02 — orphaned planning references in source comments | Deferred | v0.2.0 scoping |
| Quality | QUAL-03 — emulator control-plane network exposure | Deferred | v0.2.0 scoping |

## Session Continuity

Last session: 2026-08-19T09:16:54.056Z
Stopped at: Completed 08.1-03-PLAN.md
Resume file: None
