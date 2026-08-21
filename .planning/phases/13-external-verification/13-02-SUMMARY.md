---
phase: 13-external-verification
plan: 02
subsystem: testing
tags: [vice-mcp, backend-detect, x64sc, real-hardware-evidence, extv-02]

# Dependency graph
requires:
  - phase: 13-external-verification (plan 01)
    provides: the re-recorded binmon fixture convention (README/sidecar shape) this plan mirrors for backend-detect
provides:
  - Two verbatim, real-hardware `--help` transcripts (stock + fork) with provenance sidecars under `.claude/mcp/vice/fixtures/backend-detect/`
  - A live-run evidence document proving `probeBackend()`/`resolvedBackend()` against both real `x64sc` builds on this host
  - A real-hardware regression test block in `backend-detect.test.ts`, kept structurally separate from the pre-existing ASSUMED fixtures
affects: [13-05, docs/phase2-backend-probe-evidence.md]

# Actuals (#2632)
actuals:
  tokens: 41300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Real-hardware fixture directories carry a `capturedFrom: \"real hardware\"` sidecar label plus a directory README with a provenance table, mirroring `fixtures/binmon/`'s convention but with its own distinct label (D-13-03) rather than the binmon `<kind>:<path>` form"
    - "A real-hardware test block lives in its own file section with its own banner comment and reads fixtures from disk via `dirname(fileURLToPath(import.meta.url))`, never sharing an array/helper with author-constructed (ASSUMED) fixtures in the same test file"

key-files:
  created:
    - .claude/mcp/vice/fixtures/backend-detect/stock-help-transcript.txt
    - .claude/mcp/vice/fixtures/backend-detect/stock-help-transcript.json
    - .claude/mcp/vice/fixtures/backend-detect/fork-help-transcript.txt
    - .claude/mcp/vice/fixtures/backend-detect/fork-help-transcript.json
    - .claude/mcp/vice/fixtures/backend-detect/README.md
    - .planning/phases/13-external-verification/13-HELP-DISCRIMINATOR-EVIDENCE.md
  modified:
    - .claude/mcp/vice/backend-detect.test.ts

key-decisions:
  - "Enumerated x64sc candidates with `which -a x64sc` (3 paths) and deduped by `readlink -f` (2 distinct real binaries: `/usr/local/bin/x64sc` fork, `/usr/bin/x64sc` stock) rather than assuming a fixed pair, per D-13-03's discovery-not-assumption requirement"
  - "Recorded the fallback-ladder's -help/-? branches as *unexercised on this host* rather than confirmed -- both real builds exit 0 with non-empty output on --help alone, so the ladder never advances past the first flag"
  - "Documented, rather than silently worked around, a genuine VICE property discovered mid-task: x64sc --help's own startup diagnostics (a 'VSP Bug: safe channels are: <permutation>' line) are not byte-reproducible across repeated invocations of the identical command -- confirmed by four back-to-back captures. The committed transcripts are still each a single genuine verbatim capture; only the stronger cmp-reproducibility claim in the plan's acceptance criteria does not hold, and cannot be made to hold, because the non-determinism lives inside the real binary, not the capture method"
  - "EXTV-02 is a requirement shared with sibling plan 13-05 (unfinished); `requirements.ready-ids` correctly reports 0/1 ready, so this plan does not mark EXTV-02 complete -- it will flip once 13-05 also finishes (#2388 shared-ID gate)"

patterns-established:
  - "Real-hardware fixture sidecars for this consumer use the literal `capturedFrom: \"real hardware\"` label (not binmon's `<kind>:<path>` form) because a different consumer reads them"

requirements-completed: []  # EXTV-02 declared by this plan's frontmatter, but shared with 13-05 (unfinished) -- requirements.ready-ids reports 0/1 ready; will be marked once 13-05's SUMMARY also exists (#2388)

coverage:
  - id: D1
    description: "Two verbatim --help transcripts (stock + fork) committed with real-hardware provenance sidecars and a directory README"
    requirement: EXTV-02
    verification:
      - kind: unit
        ref: "backend-detect.test.ts#EXTV-02: the committed {stock,fork} real-hardware --help transcript file exists and is non-empty"
        status: pass
      - kind: unit
        ref: "backend-detect.test.ts#EXTV-02: the committed {stock,fork} sidecar carries capturedFrom \"real hardware\" and non-empty binaryPath/viceVersion"
        status: pass
    human_judgment: false
  - id: D2
    description: "probeBackend() returns stock/fork (never unknown) for the two real builds, and resolvedBackend()'s on-disk cache round-trips with zero re-probes on the second call"
    requirement: EXTV-02
    verification:
      - kind: other
        ref: "13-HELP-DISCRIMINATOR-EVIDENCE.md §2-3 (live node -e run against both real binaries, recorded verbatim)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A real-hardware regression test block pins classifyHelpOutput()/probeBackend() against the committed transcripts, sharing no driver with the ASSUMED author-constructed fixtures"
    requirement: EXTV-02
    verification:
      - kind: unit
        ref: "backend-detect.test.ts (REAL HARDWARE section, 10 new EXTV-02-named tests, 50 total vs 40 before)"
        status: pass
    human_judgment: false
  - id: D4
    description: "backend-detect.test.ts's module header states the file's two real fixture classes instead of the retired blanket 'every fixture is author-constructed' claim"
    requirement: EXTV-02
    verification:
      - kind: other
        ref: "backend-detect.test.ts lines 1-30 (module header), manually reviewed during this plan"
        status: pass
    human_judgment: false
  - id: D5
    description: "All three of the folded todo's enumerated assumed sub-claims answered explicitly, including an honest 'unexercised on this host' finding for the -help/-? fallback ladder"
    requirement: EXTV-02
    verification:
      - kind: other
        ref: "13-HELP-DISCRIMINATOR-EVIDENCE.md §4"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-08-21
status: complete
---

# Phase 13 Plan 02: Real-hardware `--help` backend discriminator evidence Summary

**Committed two verbatim `--help` transcripts from the genuine stock and patched fork `x64sc` builds on this host, proved `classifyHelpOutput()`/`probeBackend()`/`resolvedBackend()` against both live, and pinned the result with a real-hardware regression test block kept structurally separate from the file's existing author-constructed fixtures.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-21T23:05:00Z (approx.)
- **Completed:** 2026-08-21T23:31:21Z
- **Tasks:** 2
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- Enumerated `x64sc` candidates with `which -a` (3 paths) and deduped by real path (2 distinct real binaries: `/usr/local/bin/x64sc` fork, `/usr/bin/x64sc` stock), never assuming which was which
- Captured both binaries' `--help` output using the exact `spawnSync` invocation `probeBackend()`'s own `defaultSpawnHelp()` uses, and committed them verbatim under `fixtures/backend-detect/` with real-hardware provenance sidecars and a directory README
- Ran `probeBackend()` live against both real binaries: `fork` and `stock`, neither `unknown`
- Ran `resolvedBackend()` live against both real binaries with a scratch `supervisorDir`, resetting the module memo between binaries: each first call probed (1 spawn) and wrote `backend.json`; each second call read the cache (0 additional spawns)
- Answered all three of the folded todo's assumed sub-claims in `13-HELP-DISCRIMINATOR-EVIDENCE.md`, including the finding that the `-help`/`-?` fallback ladder is unexercised on this host (both builds exit 0 with output on `--help` alone)
- Added a 10-test `REAL HARDWARE` (`EXTV-02`) block to `backend-detect.test.ts` that reads the committed transcripts from disk and drives the same classification/probe surface, sharing no array or helper with the pre-existing `ASSUMED` fixtures; rewrote the file's module header to describe both fixture classes
- Discovered and documented a genuine VICE property: `x64sc --help`'s own startup diagnostics are not byte-reproducible across repeated identical invocations (a randomized digit-permutation line), confirmed with a four-run diff; the discriminator substrings themselves are unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture both transcripts verbatim and run the discriminator live end to end** - `f5df0e9` (feat)
2. **Task 2: Add a real-hardware regression block to backend-detect.test.ts, kept apart from the author-constructed fixtures** - `803e9a2` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.claude/mcp/vice/fixtures/backend-detect/stock-help-transcript.txt` - verbatim `--help` output of genuine stock `x64sc` (`/usr/bin/x64sc`, VICE 3.9)
- `.claude/mcp/vice/fixtures/backend-detect/stock-help-transcript.json` - its real-hardware provenance sidecar
- `.claude/mcp/vice/fixtures/backend-detect/fork-help-transcript.txt` - verbatim `--help` output of the patched fork build (`/usr/local/bin/x64sc`, VICE 3.10)
- `.claude/mcp/vice/fixtures/backend-detect/fork-help-transcript.json` - its real-hardware provenance sidecar
- `.claude/mcp/vice/fixtures/backend-detect/README.md` - directory README: what's here, provenance table, the cmp non-determinism finding, never-merge-with-ASSUMED statement
- `.planning/phases/13-external-verification/13-HELP-DISCRIMINATOR-EVIDENCE.md` - full live-run evidence: enumeration, transcript capture, `probeBackend()`/`resolvedBackend()` verdicts, the three assumed sub-claims answered, the cmp non-determinism finding
- `.claude/mcp/vice/backend-detect.test.ts` - added the `REAL HARDWARE` (`EXTV-02`) test block (10 new tests) and rewrote the module header

## Decisions Made

- Deduped `which -a x64sc`'s three candidate paths by `readlink -f` before classifying, finding only two distinct real binaries -- recorded the enumeration itself in the evidence document rather than only the final pair, per D-13-03/T-13-01's mitigation
- Left `docs/phase2-backend-probe-evidence.md` unedited (outside this plan's stated file list) and instead cross-referenced it from the new evidence document, since a reader following that document's §2 forward lands on the real-hardware confirmation
- Did not correct `classifyHelpOutput()` -- neither real binary classified as `unknown`, so the plan's contingency correction path did not trigger and `resources/backend-detect.mjs` did not need rebuilding (`node build.ts` confirmed no diff)

## Deviations from Plan

### Auto-fixed Issues

None - no bugs, missing functionality, or blockers were found in the existing implementation. `classifyHelpOutput()`/`probeBackend()`/`resolvedBackend()` all behaved correctly against real hardware on the first live run.

### Documented Finding (not an auto-fix -- a real-world assumption in the plan's own acceptance criteria that does not hold)

**1. [Deviation - unsatisfiable literal acceptance criterion] `x64sc --help`'s own output is not byte-reproducible across repeated invocations**
- **Found during:** Task 1, while satisfying the acceptance criterion "re-running the recorded command and comparing with `cmp` reports no difference"
- **Issue:** `x64sc --help` prints a one-time startup diagnostic block, including a `VSP Bug: safe channels are: <permutation>` line whose digit ordering genuinely changes between back-to-back invocations of the identical command with nothing else changed. Re-running the recorded command and diffing against the committed transcript is expected to show a difference confined to that one line, not a corrupted or stale fixture.
- **Evidence:** Captured the same command four times in a row using the exact `spawnSync` invocation `probeBackend()` uses; runs 1-2 and 2-3 were byte-identical, run 3-4 differed at byte 528 (`safe channels are: 012357` vs `012367`). Full diff recorded in `13-HELP-DISCRIMINATOR-EVIDENCE.md` §5.
- **Disposition:** The committed transcripts are each a single, genuine, verbatim capture -- that half of the requirement is fully satisfied. The stronger cmp-reproducibility claim does not hold and cannot be made to hold by any capture-method change, because the non-determinism is inside the real binary's own startup code. The two discriminator substrings (`-mcpserver*`, `-binarymonitor*`) were confirmed stable across every repeated capture -- only the unrelated diagnostic line moved. Documented in both `13-HELP-DISCRIMINATOR-EVIDENCE.md` §5 and `fixtures/backend-detect/README.md` so a future reader does not mistake the expected diagnostic-line drift for fixture staleness.
- **Files modified:** none (no code change required -- this is a documentation-only disposition)
- **Verification:** Reproduced independently four times; the finding is stable
- **Committed in:** `f5df0e9` (Task 1 commit, `13-HELP-DISCRIMINATOR-EVIDENCE.md` §5)

---

**Total deviations:** 0 auto-fixed, 1 documented finding (an unsatisfiable literal acceptance criterion caused by real binary non-determinism, not a code or capture-tooling defect)
**Impact on plan:** No scope creep, no code changes to `backend-detect.mts`. The plan's core deliverable (real-hardware evidence for the discriminator) is fully satisfied; only the stronger byte-for-byte cmp-reproducibility phrasing in the acceptance criteria required an honest correction, which is now documented in two places for future readers.

## Issues Encountered

None beyond the documented finding above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs/phase2-backend-probe-evidence.md` §2's OPEN verdict now has a real-hardware confirmation to point to (`13-HELP-DISCRIMINATOR-EVIDENCE.md`), though that document itself was deliberately left unedited (out of this plan's file list)
- `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md` is answered end to end by this plan's evidence document; closing/moving that todo is left to whichever step in this phase owns todo disposition
- EXTV-02 is not yet marked complete in REQUIREMENTS.md -- it is shared with sibling plan 13-05, which has not yet produced a SUMMARY; `requirements.ready-ids` will flip it once 13-05 finishes (#2388 shared-ID gate), no action needed from this plan
- No blockers for the rest of Phase 13

---
*Phase: 13-external-verification*
*Completed: 2026-08-21*

## Self-Check: PASSED

- `[ -f .claude/mcp/vice/fixtures/backend-detect/stock-help-transcript.txt ]` -> FOUND
- `[ -f .claude/mcp/vice/fixtures/backend-detect/stock-help-transcript.json ]` -> FOUND
- `[ -f .claude/mcp/vice/fixtures/backend-detect/fork-help-transcript.txt ]` -> FOUND
- `[ -f .claude/mcp/vice/fixtures/backend-detect/fork-help-transcript.json ]` -> FOUND
- `[ -f .claude/mcp/vice/fixtures/backend-detect/README.md ]` -> FOUND
- `[ -f .planning/phases/13-external-verification/13-HELP-DISCRIMINATOR-EVIDENCE.md ]` -> FOUND
- `git log --oneline --all | grep -q f5df0e9` -> FOUND
- `git log --oneline --all | grep -q 803e9a2` -> FOUND
- Re-ran all task-level `<acceptance_criteria>`: Task 1's file-count/JSON-field/classification/probe/cache/git-status checks all pass; the literal `cmp`-reproducibility phrase is documented as an unsatisfiable finding (see Deviations). Task 2's test-count/banner/no-shared-driver/deletion-fails/grep-gate/tsc/test:automated checks all pass.
- Re-ran plan-level `<verification>`: `npx tsc --noEmit` clean; `node --test backend-detect.test.ts` green (50 tests, was 40); `npm run test:automated` green (2079/2084 pass, 5 pre-existing todo); `npm test` green (2220/2255 pass, 30 skipped pre-existing, 5 pre-existing todo); `node build.ts` left `resources/` unchanged (no diff); `git status --porcelain .vice-supervisor` empty.
