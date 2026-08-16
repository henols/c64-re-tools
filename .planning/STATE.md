---
gsd_state_version: 1.0
milestone: v0.2.0
milestone_name: Switchable stock-VICE backend
status: executing
last_updated: "2026-08-16T19:09:21.064Z"
last_activity: 2026-08-16 -- Phase 03 execution started
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 32
  completed_plans: 27
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-12)

**Core value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.
**Current focus:** Phase 03 — direct-tools

## Current Position

Phase: 03 (direct-tools) — EXECUTING
Plan: 1 of 18
Status: Executing Phase 03
Last activity: 2026-08-16 -- Phase 03 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 14
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 10 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

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

### Pending Todos

1 pending — `.planning/todos/pending/2026-08-11-correct-phase0-binmon-findings-three-verified-errors.md`
(subsumed by Phase 1's DOC-01..03; close it when Phase 1 lands).

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

Last session: 2026-08-14T06:22:46.806Z
Stopped at: Phase 3 context gathered
Resume file: .planning/phases/03-direct-tools/03-CONTEXT.md
