---
phase: 34-the-host-tool-execution-seam
plan: 02
subsystem: infra
tags: [broker, control-plane, transport, host-tool, evidence]

requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "plan 34-01's host_tool control op (broker-control.mts's onHostTool dispatch, host-tool.mts's runHostTool(), host-tool-client.ts's hostToolOverControlPlane()), which this plan observes rather than extends"
provides:
  - "A committed, automated observation that the control plane's 64 KiB inline-line cap produces a bare disconnect (hadError=false, zero response bytes) against the real startControlListener() -- at the exact byte boundary and one step either side, in bytes not characters"
  - "A committed, re-runnable probe script reproducing 34-RESEARCH.md Finding 1's own transcript exactly, plus a recorded verdict transcript"
  - "A recursive key-enumeration assertion that every host_tool response entry crosses as exactly { path, sha256, byteLength }, at every result size including zero and under two overlapping requests"
affects: [34-03-PLAN, 34-04-PLAN, 34-05-PLAN, 34-06-PLAN]

actuals:
  tokens: 8282
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Read the cap from the module under test's own source text at run time (a regex over broker-control.mts's source, asserted to parse a positive integer) -- never a hand-copied literal, so a future change to MAX_LINE_BYTES cannot leave a stale expectation passing"
    - "Assert a response shape by recursive key enumeration (walk every field, fail on any Buffer or over-bound string) rather than by grepping source for a payload field name -- catches a payload added at any nesting depth"
    - "A bounded, unref()'d race between a socket's close event and a short timer is the 'connection stayed open' observation for a boundary case that must NOT close -- mirrors acquireOverControlPlane()'s own connect-timeout idiom"

key-files:
  created:
    - src/mcp/vice/host-tool-transport.test.ts
    - .planning/phases/34-the-host-tool-execution-seam/evidence/64k-cap-probe.mjs
    - .planning/phases/34-the-host-tool-execution-seam/evidence/34-transport-cap.md
  modified: []

key-decisions:
  - "The multi-byte-UTF-8 over-cap case does not assert hadError===false, unlike the two pure-ASCII over-cap cases. Measured this session: at the same total byte count, pure-ASCII content over the cap produces a clean hadError=false destroy, but multi-byte UTF-8 content over the cap produces hadError=true (ECONNRESET) -- a race between the server's early destroy() and the client's still-in-flight write, apparently sensitive to the raw byte content rather than only to timing. The plan's own <behavior> block does not require hadError===false for this specific case (only 'IS destroyed'), so the test asserts exactly that plus zero response bytes, and records the observed asymmetry in a comment rather than papering over it with a loosened or content-tuned line."
  - "Used a fake, environment-overridden ACME_BIN stand-in for the result-shape/zero-byte/concurrency cases (mirroring host-tool.test.ts's own precedent) rather than requiring real ACME -- keeps this file's 8 cases fully deterministic and independent of whether real ACME happens to be installed on a given host, while the cap-boundary cases need no tool executable at all."

requirements-completed: [SEAM-03]

coverage:
  - id: D1
    description: "The >64 KiB inline-line cap is observed as a bare disconnect (hadError=false, zero response bytes) against the real startControlListener(), at the exact boundary and one step either side, in bytes not characters (SEAM-03)"
    requirement: "SEAM-03"
    verification:
      - kind: unit
        ref: "host-tool-transport.test.ts#a 70050-byte inline line (34-RESEARCH.md Finding 1's own observed byte count)..."
        status: pass
      - kind: unit
        ref: "host-tool-transport.test.ts#a line of exactly the cap's own byte count..."
        status: pass
      - kind: unit
        ref: "host-tool-transport.test.ts#a line of the cap's own byte count plus one..."
        status: pass
      - kind: unit
        ref: "host-tool-transport.test.ts#a line whose JavaScript .length is below the cap but whose UTF-8 byte length is above it..."
        status: pass
      - kind: other
        ref: "evidence/64k-cap-probe.mjs + evidence/34-transport-cap.md (INLINE_OVER_CAP_CONTROL: red, BOUNDARY_CONTROL: exact)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A host_tool response carries no byte payload at any result size -- including zero -- and each result entry's key set is exactly path/sha256/byteLength, asserted by recursive key enumeration rather than by comment (SEAM-03)"
    requirement: "SEAM-03"
    verification:
      - kind: unit
        ref: "host-tool-transport.test.ts#a host_tool response carries no byte payload at any field..."
        status: pass
      - kind: unit
        ref: "host-tool-transport.test.ts#a zero-byte produced output crosses as byteLength: 0..."
        status: pass
    human_judgment: false
  - id: D3
    description: "Two overlapping host_tool requests over the real control plane resolve to distinct output paths, each sha256 matching an independent digest of its own file on disk (SEAM-03, edge: concurrency)"
    requirement: "SEAM-03"
    verification:
      - kind: unit
        ref: "host-tool-transport.test.ts#two host_tool requests issued over the real control plane without awaiting the first..."
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-03
status: complete
---

# Phase 34 Plan 02: Transport Cap and Result-Shape Observation Summary

**The 64 KiB inline-line cap is now a committed, automated observation against the real control-plane listener -- a bare disconnect at the exact byte boundary, reproduced from a probe script rather than asserted from reading source -- and the host_tool result shape is proven byte-payload-free by recursive key enumeration at every size including zero.**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-09-03T13:18:54Z (approx., continuing from plan 34-01's completion)
- **Completed:** 2026-09-03T13:44:00Z (approx.)
- **Tasks:** 2
- **Files modified:** 3 (all newly created)

## Accomplishments

- `src/mcp/vice/host-tool-transport.test.ts`: 8 test cases dialing the real, unmocked `startControlListener()` and the real `runHostTool()` (via the built `resources/host-tool.mjs` artifact). Reproduces 34-RESEARCH.md Finding 1's exact 70050-byte observation, proves the boundary is exact to the byte (cap survives, cap+1 destroyed), proves the cap counts UTF-8 bytes rather than JS string `.length`, and proves the `{ path, sha256, byteLength }` result shape holds -- including a genuine zero-byte edge case and two overlapping requests over the real control plane -- by walking the response object recursively rather than grepping source.
- `evidence/64k-cap-probe.mjs`: a standalone, committed, re-runnable probe (imports the real `startControlListener()`, no mock of the framing/token/dispatch chain) that reproduces the primary observation plus both boundary cases in one run, printing the five marker lines the plan's own `<verify>` block checks for.
- `evidence/34-transport-cap.md`: the recorded transcript, with both machine-greppable verdict lines (`INLINE_OVER_CAP_CONTROL: red`, `BOUNDARY_CONTROL: exact`), the verbatim probe output, a `TEST_COUNTERPART:` pointer naming the specific automated cases that assert the same observations, and a closing paragraph on why a megabyte-scale Ghidra export makes the path-by-reference contract forced rather than preferred.
- The cap constant is read from `broker-control.mts`'s own source text at run time in both the test file and the probe script -- never hand-copied as a literal -- so a future change to `MAX_LINE_BYTES` cannot leave either file's own expectation stale. Confirmed: zero occurrences of the literal `65536` in `host-tool-transport.test.ts`.
- `npm run test:automated` before/after this plan's own commits: unchanged at 2 failing tests in `anno-register.test.ts` (pre-existing, documented baseline, unrelated to this plan) -- no new failures introduced.

## Task Commits

Each task was committed atomically:

1. **Task 1: The 64 KiB cap observed red at the boundary, as a committed test** - `e4ad417` (test)
2. **Task 2: The committed probe and its recorded red transcript** - `e7c8709` (docs)

**Plan metadata:** commit to follow (this SUMMARY + STATE.md/ROADMAP.md)

## Files Created/Modified

- `src/mcp/vice/host-tool-transport.test.ts` - 8 cases: the cap boundary (exact, and one over/under), the UTF-8-bytes-not-characters contract, and the host_tool result-shape assertions (key enumeration, zero-byte edge case, two overlapping requests)
- `.planning/phases/34-the-host-tool-execution-seam/evidence/64k-cap-probe.mjs` - standalone, committed, re-runnable probe against the real listener, reproducing the researched observation plus both boundary cases
- `.planning/phases/34-the-host-tool-execution-seam/evidence/34-transport-cap.md` - the recorded transcript: both verdict lines, verbatim probe output, `TEST_COUNTERPART:` pointer, `BROKER_STATE:`, and the reasoning paragraph

## Decisions Made

- **The multi-byte-UTF-8 over-cap test case does not assert `hadError===false`.** Measured this session: at an identical total byte count, pure-ASCII content over the cap produces a clean `hadError=false` destroy in every run, while multi-byte UTF-8 content over the SAME byte count produces `hadError=true` (`ECONNRESET`) in every run -- a real, content-sensitive race between the server's early `destroy()` and the client's still-in-flight write, not test flakiness (confirmed reproducible across repeated runs and across both string- and pre-built-Buffer forms of the payload). The plan's own `<behavior>` block requires only "IS destroyed" for this case (unlike the two ASCII cases, which explicitly require `hadError === false`), so the test asserts exactly what the plan specifies -- destroyed, zero response bytes -- and records the observed asymmetry in an inline comment rather than silently asserting a value that would make the test host-dependent or flaky.
- **Fake, `ACME_BIN`-overridden stand-in tool for the result-shape/zero-byte/concurrency cases**, mirroring `host-tool.test.ts`'s own precedent, rather than depending on real ACME being installed. Keeps all 8 cases in this file deterministic on any host; the cap-boundary cases need no tool executable at all since they dial the raw socket directly.

## Deviations from Plan

None - plan executed exactly as written. The one adjustment made mid-task (relaxing the `hadError` assertion for the multi-byte over-cap case) is documented above as a Decision rather than a deviation, because it is a refinement within what the plan's own `<behavior>` text specifies for that case, not a change to scope, files, or acceptance criteria -- the acceptance criterion "asserts on `hadError` at least twice" is satisfied by the two ASCII cases regardless.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The transport contract (64 KiB cap, result-by-reference shape) is now a machine-enforced observation, not a documentation claim -- plans 34-03 through 34-06 (the allowlist expansion, Ghidra path validation, skill-script migrations, and the second prefix floor) can build on it without re-verifying the transport layer.
- `evidence/34-transport-cap.md` records `BROKER_STATE: inactive` and the measured `test:automated` baseline (2 pre-existing failures in `anno-register.test.ts`, unrelated to this plan) for any later plan that needs to confirm it inherited a clean starting point.
- No blockers.

## Self-Check: PASSED

- FOUND: src/mcp/vice/host-tool-transport.test.ts
- FOUND: .planning/phases/34-the-host-tool-execution-seam/evidence/64k-cap-probe.mjs
- FOUND: .planning/phases/34-the-host-tool-execution-seam/evidence/34-transport-cap.md
- FOUND commit: e4ad417
- FOUND commit: e7c8709
- `node --test host-tool-transport.test.ts`: 8/8 pass, 0 fail
- `npm run typecheck`: clean
- `node --check evidence/64k-cap-probe.mjs` and probe run: all five marker lines present, `PROBE_RUNS_RED`
- `evidence/34-transport-cap.md`: both verdict lines present (`INLINE_OVER_CAP_CONTROL: red`, `BOUNDARY_CONTROL: exact`), `TEST_COUNTERPART:` and `BROKER_STATE:` present
- `npm run test:automated`: 3161 tests, 3153 pass, 2 fail -- unchanged from the documented pre-existing baseline

---
*Phase: 34-the-host-tool-execution-seam*
*Completed: 2026-09-03*
