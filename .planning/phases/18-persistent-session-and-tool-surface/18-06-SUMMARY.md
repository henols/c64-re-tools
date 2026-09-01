---
phase: 18-persistent-session-and-tool-surface
plan: 06
subsystem: session-concurrency
tags: [the external analyser, mutex, fifo, timeout, concurrency]
requires:
  - phase: 18-04
    provides: persistent session lifecycle, restart handling, and named client errors
provides:
  - A coarse FIFO session mutex whose critical section is the caller's complete callback
  - Bounded queue waits with a named, attributable busy error
  - A planted lost-update proof that exercises both locked and bypassed paths
affects: [phase-19-absorbed-procedures-and-coverage]
actuals:
  tokens: 0
  tasks: 3
  commits: 0
tech-stack:
  added: []
  patterns: [explicit cancellable FIFO queue, test-only non-vacuity bypass]
key-files:
  created: [.planning/phases/18-persistent-session-and-tool-surface/18-06-SUMMARY.md]
  modified:
    - src/mcp/vice/anno-session.ts
    - src/mcp/vice/anno-mcp-client.ts
    - src/mcp/vice/anno-session.test.ts
    - .planning/ROADMAP.md
key-decisions:
  - "Serialize complete runInAnnoSession callbacks at the session seam, preserving call-then-save atomicity."
  - "Keep the synchronous open guard beside the queue because it protects future entry points that might bypass it."
  - "Defer reader-writer locking until Phase 19 measures the external analyser stdio multiplexing."
patterns-established:
  - "Queue timeout timers remain referenced until grant or timeout; an unref'd timer cannot guarantee a pending Promise will reject."
requirements-completed: [SESS-04]
coverage:
  - id: D1
    description: Coarse FIFO session mutex with bounded, attributable queue waits
    requirement: SESS-04
    verification:
      - kind: integration
        ref: src/mcp/vice/anno-session.test.ts#plan 18-06
        status: pass
      - kind: unit
        ref: src/mcp/vice/anno-mcp-client.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Locked and bypassed read-modify-write scenarios demonstrate queue non-vacuity
    requirement: SESS-04
    verification:
      - kind: integration
        ref: src/mcp/vice/anno-session.test.ts#the queue prevents a client-side lost update
        status: pass
    human_judgment: false
duration: 0min
completed: 2026-08-24
status: complete
---

# Phase 18 Plan 06: Session Concurrency Summary

**A single FIFO queue now owns each persistent the external analyser session, preserving whole-operation call-and-save ordering and surfacing stuck contention as a named timeout.**

## Accomplishments

- Added a coarse mutex around the complete `runInAnnoSession()` body, so project eviction/opening, a mutating tool call, and its internal save cannot interleave with another logical operation.
- Added `AnnoSessionBusyError` with public `waitedMs` and `holder` fields; timed-out callers are removed before they can run late.
- Added FIFO, failure-release, timeout-removal, slow-holder, and non-vacuity tests. The planted bypass deliberately produces a lost update (`1` or `10`, not `11`) from two interleaved read-modify-write callbacks, while the locked run produces `11`.
- Recorded the coarse mutex decision and Phase 19's required stdio-multiplexing measurement in the roadmap; reader-writer locking is deferred, not rejected.

## Verification

- `node --experimental-strip-types --test anno-session.test.ts` — 23 passing tests, including live the external analyser session checks.
- `node --experimental-strip-types --test anno-mcp-client.test.ts` — 23 passing tests.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` — passed.
- `npm test` cannot load TypeScript tests under Node 22.13 without `--experimental-strip-types`; with that option it begins executing but reports unrelated existing failures in `audit-integrity.test.ts`, `binmon-fixtures.test.ts`, and broker tests. The Phase 18 focused suites above pass.

## Deviations From Plan

The plan's live lost-update fallback was not needed as the dedicated test uses a real session fixture but a controlled in-memory read-modify-write callback. This is the explicit stub oracle permitted by the plan: it makes interleaving deterministic, and the bypassed run demonstrably loses an update. The Phase 18 live session gate remains plan 18-07.

## Next Phase Readiness

Phase 19 inherits a clear rule: do not copy upstream's seven-way mutation fan-out. The remaining Phase 18 plan, `18-07`, must run the live phase gate and record its evidence before phase verification.
