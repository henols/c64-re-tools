---
phase: 36-the-sleigh-language-and-the-ghidra-harness
plan: 03
subsystem: reverse-engineering-harness
tags: [ghidra, decompinterface, volatile-memory, java-scripts, run-log-classifier]

# Dependency graph
requires:
  - phase: 36-the-sleigh-language-and-the-ghidra-harness
    provides: "plan 36-01's ghidra.analyze host tool, its preScript/postScript/scriptPath/entrypointsPath/exportPath fields, and ghidra-run.ts's classifyGhidraRunLog() -- this plan writes the two Java scripts those fields drive and the hermetic test importing that classifier unmodified"
provides:
  - "VolatileCarve.java and GhidraStructExport.java: committed, function-named Ghidra scripts (promoted from Phase 23's throwaway evidence), replacing the image-size classification defect with a self-computed block-total assertion and adding a DecompInterface-based structural export with a three-way accounting identity"
  - "A committed bank.a/bank.prg fixture pair with its seven MEASURED reference-dump lines recorded"
  - "Two REAL captured analyzeHeadless run-log fixtures (a benign base-0 conflict, and a genuine script throw) proving the exact-literal signal and the naive grep's false-fire hazard"
  - "ghidra-harness-gates.test.ts: the hermetic half of GHID-01's gate 1, importing ghidra-run.ts's classifyGhidraRunLog() unmodified"
affects: [36-04-live-ghidra-suites, 36-05-boundary-and-adjacency-fixtures, 36-06-opcode-sweep, 36-07-decompinterface-live-proofs]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 18037
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Java scripts compiled by Ghidra itself at analyzeHeadless run time -- no Gradle, no javac build step shipped; javac IS used here as a one-time syntax/type-check against the real Ghidra jars, never as a build dependency."
    - "A classification expectation self-computed from the program's own memory (mem.getBlocks() sum), never from a caller-supplied image size -- the .prg route's classified address space is far larger than the imported file's own byte length, and comparing against the latter is silently wrong."
    - "A one-script, mode-argument control (getScriptArgs()[2]) rather than a second script, so the acceptance route and its DataTypeManager control run against the SAME image in the SAME file -- sameness is structural, not a matter of the caller remembering."

key-files:
  created:
    - src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java
    - src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java
    - src/mcp/vice/vendor/ghidra-scripts/README.md
    - src/mcp/vice/fixtures/ghidra/bank.a
    - src/mcp/vice/fixtures/ghidra/bank.prg
    - src/mcp/vice/fixtures/ghidra/runlog-benign-base0-conflict.txt
    - src/mcp/vice/fixtures/ghidra/runlog-script-error.txt
    - src/mcp/vice/fixtures/ghidra/README.md
    - src/mcp/vice/ghidra-harness-gates.test.ts
  modified: []

key-decisions:
  - "The classification expectation is computed from mem.getBlocks() inside GhidraStructExport.java itself and asserted internally; getScriptArgs()[1], when present, OVERRIDES that assertion rather than replacing its normal source -- this is what lets the hermetic gate's own real script-error fixture plant a deliberately wrong expectation and observe a genuine throw, while the normal (no-override) path still self-verifies against the block total."
  - "Deviation (Rule 1 -- bug): GhidraStructExport.java's classification expected/observed lines were written only into the export FILE, not printed to the script console, in the first draft -- discovered when the first live capture attempt produced a run log with no parseable classification information. println() calls were added alongside the file writes so the run-log classifier (ghidra-run.ts's classifyGhidraRunLog()) can answer the classification question against a REAL captured log, matching the ancestor script's own printed-line precedent."
  - "Deviation (Rule 1 -- bug, discovered live): ghidra.analyze's postScript field resolves through resolveWorkspacePath() as a full workspace-relative path, independent of scriptPath -- a bare filename (\"GhidraStructExport.java\", matching the plan's own <action> usage-comment shape) resolves against the workspace ROOT and Ghidra reports \"Script not found\". The working value is the full path (\"vendor/ghidra-scripts/GhidraStructExport.java\"). Recorded in fixtures/ghidra/README.md with the real failure shown, not silently corrected. This is a fixture-authoring finding about the EXISTING seam (36-01/36-02's own ghidra.analyze), not a defect in this plan's own deliverables -- host-tool.mts/ghidra-project.mts were not modified."
  - "The DataTypeManager control mode's third script argument (getScriptArgs()[2]) is not yet reachable through ghidra.analyze's typed seam -- that seam supplies only the export path and the expected-line override as positional script arguments (36-02's own buildAnalyzeHeadlessArgv()). The control mode is invoked directly against analyzeHeadless, outside the seam, until a later plan wires a third positional slot. Recorded as a finding, not treated as a defect in this plan -- GHID-04's control-mode requirement is about the SCRIPT carrying the capability, which it does."

patterns-established:
  - "A committed .java script's own header states the two-way reachability contract (which ghidra.analyze field supplies it, which field supplies its argument) so a future reader never has to reverse-engineer the wiring from the seam alone."
  - "A word-bounded negative grep (filtering full-line comments first) enforces 'no denominator/percentage/ratio/fixed-image-size figure anywhere in the export logic' mechanically, at plan-verify time, rather than by review discipline alone."

requirements-completed: []  # GHID-01..GHID-05 are each shared with at least one sibling plan (36-02/36-04 for GHID-01; 36-05 for GHID-02/GHID-03; 36-07 for GHID-04/GHID-05) -- requirements.ready-ids reports all five blocked until every plan declaring each id has its own SUMMARY.md (shared-ID gate, #2388).

coverage:
  - id: D1
    description: "VolatileCarve.java is promoted from FlatVolatile.java with the split-then-flag carve, both per-split guards, the getBlock-first flag setting, and the entry-point seeding loop preserved verbatim in behaviour; no exception handler anywhere in its non-comment body; no phase number anywhere"
    requirement: GHID-02
    verification:
      - kind: other
        ref: "vendor/ghidra-scripts/VolatileCarve.java grep gate: grep -c 'getBlock' >= 2 (11 observed); grep -aciE catch == 0; grep -aciE 'Phase[0-9]' == 0 -- all three run and asserted in this plan's own <verify> block"
        status: pass
      - kind: manual_procedural
        ref: "src/mcp/vice/fixtures/ghidra/README.md -- bank.prg's origin ($0801) and seven MEASURED reference-dump lines recorded and re-checked by grep"
        status: pass
    human_judgment: false
  - id: D2
    description: "GhidraStructExport.java's classification expectation is the script's own block total (mem.getBlocks() sum), never the image size, asserted internally with an explicit override path; no fixed image size or denominator word anywhere in its non-comment body"
    requirement: GHID-01
    verification:
      - kind: other
        ref: "vendor/ghidra-scripts/GhidraStructExport.java grep gate: grep -c 'DecompInterface|isTimedOut|decompileCompleted|getBlocks' >= 4 (12 observed); the word-bounded negative grep for 65536/percent/percentage/denominator/ratio/ratios == 0; grep -aciE 'Phase[0-9]' == 0"
        status: pass
      - kind: manual_procedural
        ref: "javac -cp <real Ghidra 12.1.3 jars> -d <scratch> VolatileCarve.java GhidraStructExport.java -- exit 0, no errors (this session, both before and after the Rule-1 println fix)"
        status: pass
    human_judgment: false
  - id: D3
    description: "GhidraStructExport.java walks DecompInterface with a three-way attempted/decompiled/timedOut(+failed) accounting identity under a named ceiling, an explicit zero-function line, five structural-fact kinds each with a not-found fallback, a denominator-free unresolved-dispatch section, an uncapped typed reference loop, and a DataTypeManager control mode that never constructs a DecompInterface -- all structurally present in the committed source"
    requirement: GHID-04
    verification:
      - kind: manual_procedural
        ref: "vendor/ghidra-scripts/GhidraStructExport.java source inspection against every <acceptance_criteria> bullet in 36-03-PLAN.md Task 2 -- not exercised against a live Ghidra decompile this plan (no functions to decompile on the fixtures used); D4's real captures exercise the classification/reference halves only"
        status: pass
      - kind: manual_procedural
        ref: "javac syntax/type check against real Ghidra 12.1.3 jars, exit 0"
        status: pass
    human_judgment: true
    rationale: "The five structural-fact detectors and the DataTypeManager control mode are exercised by source inspection and a real javac type-check, not by a live analyzeHeadless run producing actual decompiled functions -- this plan's own fixtures (bank.prg, base0.bin) were run with noanalysis/no entry points for the two captured run-log fixtures, so DecompInterface's per-function loop was never exercised against real decompiled output this session. A human should confirm the structural-facts and accounting logic reads correctly rather than treating the javac pass as behavioural proof; plan 36-07 is where DecompInterface runs live."
  - id: D4
    description: "The exact literal ERROR REPORT SCRIPT ERROR is the only signal the harness treats as a thrown script, proven over two REAL captured run logs; a case-insensitive naive error/fail grep is proven to MATCH the benign fixture (the false-fire proof); the classifier's signature carries no exit status; language-line comparison is byte-exact and case-sensitive with a named absence for a missing line"
    requirement: GHID-01
    verification:
      - kind: unit
        ref: "ghidra-harness-gates.test.ts -- 10/10 pass (node --test ghidra-harness-gates.test.ts)"
        status: pass
      - kind: integration
        ref: "fixtures/ghidra/README.md -- both fixtures captured via ghidra.analyze against real Ghidra 12.1.3, exact commands/image sizes/exit statuses/dates recorded"
        status: pass
    human_judgment: false

# Metrics
duration: 31min
completed: 2026-09-04
status: complete
---

# Phase 36 Plan 03: The SLEIGH Language and the Ghidra Harness -- Java Scripts and Run-Log Gates Summary

**Two Phase-23 throwaway Ghidra scripts promoted to committed deliverables -- a self-computed block-total classification assertion replacing the image-size defect, a `DecompInterface`-based structural export with a three-way accounting identity, and a hermetic run-log gate proving the exact-literal throw signal over two REAL captured `analyzeHeadless` logs, including the proof that a naive `error`/`fail` grep false-fires.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-09-04T16:50:00Z (approx.)
- **Completed:** 2026-09-04T17:21:05Z
- **Tasks:** 3 completed
- **Files modified:** 9 created, 0 modified (all files are new to the repository)

## Accomplishments

- Promoted `FlatVolatile.java` (Phase 23 evidence) to `src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java`, class `VolatileCarve` -- the split-then-flag carve, both per-split guards, the getBlock-first flag setting with its printed warning, and the entry-point seeding loop are preserved verbatim in behaviour; the header is rewritten to describe a committed deliverable reached through `ghidra.analyze`'s `preScript`/`entrypointsPath` fields, with `noanalysis` required because the script calls `analyzeAll()` itself; no part of the carve is wrapped in an exception handler, mechanically asserted by a grep gate (0 matches).
- Committed `src/mcp/vice/fixtures/ghidra/bank.a` (copied unchanged from `.planning/notes/dxa-ghidra-pivot-evidence/bank.a`) and its ACME-assembled `bank.prg` (60 bytes, origin `$0801`), with `fixtures/ghidra/README.md` recording the exact ACME command, sha256 hashes, and all seven MEASURED reference-dump lines this fixture yields under a correct volatile carve -- verified by hand-tracing the assembled bytes against the source, all seven confirmed against the plan's own MEASURED values.
- Promoted `ExportAnalysis23.java` to `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java`, class `GhidraStructExport` -- fixed the classification-expectation defect (now `mem.getBlocks()`'s own sum, asserted internally, with an explicit override path for planted-wrong-expectation testing) and added a `DecompInterface` walk with an attempted/decompiled/timedOut(+failed) accounting identity under a named ceiling, five structural-fact kinds each with an explicit not-found fallback, a denominator-free unresolved-dispatch section, the preserved uncapped typed reference loop, and a `DataTypeManager` control mode (script argument 2) that never constructs a `DecompInterface`. Verified to compile cleanly with `javac` against the real Ghidra 12.1.3 jars on the classpath (exit 0, no errors).
- Captured two REAL `analyzeHeadless` run-log fixtures against a real Ghidra 12.1.3 installation: a base-0 `flat64k` import (4096 bytes of random content) whose language-defined `ZERO_PAGE`/`STACK` blocks conflict with the image (both MEASURED benign lines present verbatim), and a genuine post-script throw from `GhidraStructExport.java` run against the committed `bank.prg` with a deliberately wrong expected classification count (script argument 1 = `1` against a real block total of 572) -- both runs' process exit status recorded as **0**.
- Wrote `ghidra-harness-gates.test.ts`: 10 hermetic, no-child-process, no-Ghidra-installation cases importing `classifyGhidraRunLog()` from `ghidra-run.ts` unmodified -- the exact-literal throw/no-throw classification on both real fixtures, the false-fire proof (a naive `/error|fail/i` pattern DOES match the benign fixture), the exit-status-carries-no-information proof (`classifyGhidraRunLog.length === 1`), byte-exact/case-sensitive language-line parsing with a named-absence case, classification expected/observed parsing (both a planted mismatch and the real script-error fixture's own printed lines), and a non-vacuity floor on both fixtures' line counts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote VolatileCarve.java and commit the bank fixture pair** - `9368ce23` (feat)
2. **Task 2: Promote GhidraStructExport.java -- DecompInterface, the block total, and the accounting** - `e6ac9099` (feat)
3. **Task 3: The hermetic gate -- the exact literal, and the naive grep proven to false-fire** - `2e19f3a5` (test) -- includes the Rule 1 println fix to `GhidraStructExport.java` (Task 2's own file), discovered while capturing Task 3's real fixtures

**Plan metadata:** committed separately (this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md).

## Files Created/Modified

- `src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java` - the promoted `-preScript`, volatile-carve deliverable
- `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java` - the promoted `-postScript`, structural-export deliverable
- `src/mcp/vice/vendor/ghidra-scripts/README.md` - names both scripts, their reach, and the no-phase-number rule
- `src/mcp/vice/fixtures/ghidra/bank.a` / `bank.prg` - the committed hazard fixture, source and assembled
- `src/mcp/vice/fixtures/ghidra/runlog-benign-base0-conflict.txt` / `runlog-script-error.txt` - two REAL captured run logs
- `src/mcp/vice/fixtures/ghidra/README.md` - provenance for all five committed fixtures
- `src/mcp/vice/ghidra-harness-gates.test.ts` - the hermetic run-log-classifier gate, 10 cases

## Decisions Made

See `key-decisions` in the frontmatter above. The most consequential: `GhidraStructExport.java`'s classification-expectation override (`getScriptArgs()[1]`) is a testing seam layered on top of the always-computed block-total assertion, not a replacement for it -- the normal path never trusts a caller-supplied number, exactly as `GHID-01`'s amended text requires.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `GhidraStructExport.java`'s classification expected/observed lines were never printed to the script console**
- **Found during:** Task 3's own live fixture capture (the first attempt at the `runlog-script-error.txt` fixture)
- **Issue:** The initial Task 2 implementation appended the `CLASSIFICATION_EXPECTED_FROM_BLOCKS`/`CLASSIFICATION_OBSERVED`/`CLASSIFICATION_OVERRIDE_USED` lines only to the in-memory `StringBuilder` destined for the export FILE, never calling `println()` for them. A real captured run log therefore carried no parseable classification information at all, even though the plan's own action text says these numbers are "printed... on their own labelled lines" -- matching the ancestor script's own `println()`-based precedent for its `EXPORT_CLASSIFICATION_LINES` line.
- **Fix:** Added `println()` calls for all three lines, using the same labelled text written to the file, immediately alongside the existing `StringBuilder` appends.
- **Files modified:** `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java`
- **Verification:** Re-ran the live capture; the resulting `runlog-script-error.txt` fixture now carries `CLASSIFICATION_EXPECTED_FROM_BLOCKS: 572` and `CLASSIFICATION_OBSERVED: 572` as printed lines, both correctly parsed by `classifyGhidraRunLog()` in `ghidra-harness-gates.test.ts`'s own case. Re-ran the grep gates and the `javac` syntax/type check afterward -- all still pass.
- **Committed in:** `2e19f3a5` (Task 3 commit, since the fix was discovered while producing Task 3's own fixture; Task 2's commit `e6ac9099` predates the discovery)

**2. [Rule 1 - Bug] The first live capture of `runlog-script-error.txt` used a bare `postScript` filename and failed with "Script not found"**
- **Found during:** Task 3's own live fixture capture, first attempt
- **Issue:** The plan's own `<action>` usage-comment shows `-postScript <ExportScript>.java <out.txt>` (a bare filename, implying `-scriptPath` resolves it). The actual `ghidra.analyze` seam (`host-tool.mts`, landed in plans 36-01/36-02) resolves `postScript` through `resolveWorkspacePath()` as a full workspace-relative path, independent of `scriptPath` -- a bare filename resolves against the workspace ROOT, not the `scriptPath` directory, and Ghidra reported `Script not found`.
- **Fix:** Supplied `postScript: "vendor/ghidra-scripts/GhidraStructExport.java"` (the full workspace-relative path) instead of the bare filename. No code in this plan's own deliverables was changed -- this is a fixture-authoring correction, not a defect in `host-tool.mts`/`ghidra-project.mts` (out of scope: those files belong to plans 36-01/36-02).
- **Files modified:** None (command-line invocation only); recorded in `src/mcp/vice/fixtures/ghidra/README.md` with the real failure shown alongside the corrected command, rather than silently using the working command with no trace of the first attempt.
- **Verification:** The corrected command produced a real script throw (`ERROR REPORT SCRIPT ERROR:` present, exit status 0), captured as the committed fixture.
- **Committed in:** `2e19f3a5` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug). **Impact on plan:** Both fixes were necessary for Task 3's own real fixtures to carry the information the hermetic gate needs to exercise; no scope creep -- neither fix touched `ghidra-run.ts`, `host-tool.mts`, or `ghidra-project.mts`.

## Known Stubs

None. The `DataTypeManager` control mode's third script argument (`getScriptArgs()[2]`) is not yet reachable through `ghidra.analyze`'s typed seam (only the export path and expected-line override are wired as positional script arguments) -- this is a recorded finding in `key-decisions` above, not a stub: the script itself carries the full capability the plan requires, and the seam gap is pre-existing, from plans 36-01/36-02.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required. `GHIDRA_HOME` remains the existing, already-documented host prerequisite from Phase 34.

## Next Phase Readiness

- `VolatileCarve.java` and `GhidraStructExport.java` are ready for plan 36-04's live suites to drive through the full `ghidra.analyze` seam, including entry points and real function decompilation (not exercised by this plan's own two run-log fixtures, which used `noanalysis` with no entry points to keep the captures fast and focused on the classifier's own three questions).
- `GHID-01`..`GHID-05` all stay `requirements-completed: []` here -- each is shared with at least one sibling plan (36-02/36-04 for `GHID-01`; 36-05 for `GHID-02`/`GHID-03`; 36-07 for `GHID-04`/`GHID-05`) and `requirements.ready-ids` reports all five blocked. Each will be marked complete once every plan declaring it has produced its own SUMMARY.md.
- The `DataTypeManager` control mode's third positional script argument is not yet wired through `ghidra.analyze`'s typed seam -- a later plan (36-04 or 36-07) should either wire it or exercise the control mode by invoking `analyzeHeadless` directly, outside the seam, as this plan's own key-decisions note records.
- `ghidra-run.ts` was not modified by this plan, as instructed -- its `classifyGhidraRunLog()` is now exercised against two REAL captured logs rather than only synthetic ones, and both of its own PROVISIONAL classification-parsing patterns (`expected...NNN`/`observed...NNN`) were confirmed to match `GhidraStructExport.java`'s real printed output with no changes needed.
- No blockers.

---
*Phase: 36-the-sleigh-language-and-the-ghidra-harness*
*Completed: 2026-09-04*

## Self-Check: PASSED

- All 9 declared created files verified present on disk with `[ -f ]`.
- All 3 task commits (`9368ce23`, `e6ac9099`, `2e19f3a5`) verified present in `git log --oneline --all`.
- Re-ran every plan-level `<verification>` command: `node --test ghidra-harness-gates.test.ts` -- 10/10 pass; the grep gates over both `.java` files (getBlock count, catch count, phase-number count, denominator-word count) all pass; `fixtures/ghidra/bank.prg` exists with origin `$0801` and its README records the seven MEASURED reference lines plus the divergence note; both run-log fixtures carry their MEASURED content and recorded producing commands; `node --test ci-suite-coverage.test.ts test-gate.test.ts` -- 13/13 pass; `npm run typecheck` clean; `node build.ts` + `resources-sync.test.ts` clean (byte-identical, no drift, unaffected by this plan); `node --test hostpath-consumers.test.ts` -- 22/22 pass, host-tool-family floor unchanged; `node scripts/check-npm-packages.mjs` -- OK, `fixtures/`/`vendor/` absent from both packed tarballs.
- Re-ran `npm run test:automated` (VICE broker confirmed stopped beforehand): 3409 tests, 3396 pass, 2 fail (both in `anno-register.test.ts`, "DIRECTION 5 (basis integrity)" and "planted violation (the negative control)"), 6 skipped -- matches the recorded baseline floor exactly (2 failing in 1 file); 10 new tests added by this plan's own `ghidra-harness-gates.test.ts`.
