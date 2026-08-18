---
gsd_state_version: 1.0
milestone: v0.2.0
milestone_name: Switchable stock-VICE backend
status: executing
last_updated: "2026-08-18T10:46:37.709Z"
last_activity: 2026-08-18 -- Completed quick task 260818-nh5: Phase 07 UAT test-8 gap closed (live proof restored 6/6 on both stock binaries, gate hole closed by an automated shape oracle); 07-UAT.md now 12/12, 1 code-review blocker outstanding
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 70
  completed_plans: 70
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-12)

**Core value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.
**Current focus:** Phase 07 — cycle-timing-and-wedge-triage

## Current Position

Phase: 07 (cycle-timing-and-wedge-triage) — EXECUTING
Plan: 1 of 18
Status: Executing Phase 07
Last activity: 2026-08-18 -- Phase 07 execution started

**Scope was cut on 2026-08-17.** The filter: does a shipped skill call the tool, or
does something a skill calls depend on it? The six skills call 28 tools -- 16 already
work on stock, 10 are buildable (8 in Phase 5, 2 in Phase 7), and 3 are provably
impossible (`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`) and
route to the fork via Phase 8. The fork's other 34 tools are called by no skill. Phase 6
was cut wholesale; screenshots, backtrace, checkpoint groups, disk detach and the parity
harness came out. See ROADMAP.md "Cut from scope" and REQUIREMENTS.md for the 21
CUT-marked items.

*(The impossible list was two until plan 05-08's skill-vs-manifest sweep found
`vice_keyboard_restore`, called by `c64-program-recon/references/control-flow.md:86` and
absent from the stock manifest. Recorded as a hard loss in `docs/stock-vice-parity.md` §A
item 2 — `KEYBOARD_FEED` (0x72) injects buffer text only and cannot pulse RESTORE/NMI.)*

Progress: [███████░░░] 71%

## Performance Metrics

**Velocity:**

- Total plans completed: 52
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

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 03 P17 | N/A | 2 tasks | 0 files |
| Phase 03-direct-tools P18 | 5m | 1 tasks | 0 files |

## Accumulated Context

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

### Pending Todos

1 pending — `.planning/todos/pending/2026-08-11-correct-phase0-binmon-findings-three-verified-errors.md`
(subsumed by Phase 1's DOC-01..03; close it when Phase 1 lands).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260817-n6p | Fix WR-01 — bound `decode()`'s `startAddress` to `0..0xffff` in `disasm-decoder.ts` | 2026-08-17 | e19d8eb | [260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i](./quick/260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i/) |
| 260818-nh5 | Close Phase 07 UAT gap: fix stale evidence-key assertion in `stock-live-triage.test.ts`, restore the restarted live proof, and close the manual-only gate hole | 2026-08-18 | acc9933 (+84cca54, 9831fa8) | [260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc](./quick/260818-nh5-close-phase-07-uat-gap-fix-stale-evidenc/) |

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

- **Open coverage gap:** no requirement covers revising the playbook prose in the
  3 of 6 skills whose documented methodology depends on fork-only capabilities.
  Runtime symptom is covered by BACK-05. Decide: add `SKILL-01` mapped to Phase
  8, or defer explicitly. See ROADMAP.md "Coverage Notes".

- **`CPUHISTORY_GET` needs VICE ≥ 3.10**; Debian and all current Ubuntu ship 3.9,
  so the milestone's headline gain is unavailable on the most common `apt`
  install path. Graceful degradation is required, not optional.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Upstream | UP-01/UP-02 — `KEYBOARD_MATRIX_SET` opcode upstream to VICE | Deferred | v0.2.0 scoping |
| Quality | QUAL-01 — tests for `acme.mjs`, `driver.mjs`, `derive.mjs` | Deferred | v0.2.0 scoping |
| Quality | QUAL-02 — orphaned planning references in source comments | Deferred | v0.2.0 scoping |
| Quality | QUAL-03 — emulator control-plane network exposure | Deferred | v0.2.0 scoping |

## Session Continuity

Last session: 2026-08-17T05:51:53.006Z
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-client-side-tool-seam-and-6510-disassembler/04-CONTEXT.md
