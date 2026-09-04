---
phase: 36-the-sleigh-language-and-the-ghidra-harness
plan: 01
subsystem: reverse-engineering-harness
tags: [ghidra, sleigh, host-tool-seam, language-extension, opcodes]

# Dependency graph
requires:
  - phase: 34-the-host-tool-execution-seam
    provides: host-tool.mts's typed allowlist, resolveWorkspacePath(), spawnHostTool(), and ghidra-project.mts's resolveGhidraProject()/buildAnalyzeHeadlessArgv() this plan extends
provides:
  - A committed, vendored SLEIGH extension source tree covering all 105 undocumented NMOS 6502/6510 opcode bytes, compiling clean under support/sleigh
  - A new Ghidra language id, 6502:LE:16:nmos, that does not collide with any stock .ldefs id
  - ghidra.installExtension, a sixth host tool that materialises the extension and compiles its .sla
  - ghidra.analyze's required, non-defaulted processor field and its run-log capture slot
  - ghidra-run.ts, the container-side orchestrator with a byte-exact language-id check and a run-log classifier
  - The sleigh compile gate (structural + COMPILE halves), observed red on a reverted sized-local fix and green on the committed tree
affects: [36-02-loader-import-route-and-preflight, 36-03-java-scripts-and-run-log-gates, 36-04-live-ghidra-suites, 36-06-opcode-sweep]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 36356
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SLEIGH extension modules materialised at install time from a host-side Ghidra installation (support/sleigh, Ghidra/Processors/6502/data/languages/*), never committed -- mirrors the vendored-but-built dxa binary's own D-36-02-cited precedent."
    - "A run-log classifier taking log TEXT only, never an exit status, because a thrown post-script inside analyzeHeadless still exits 0 (MEASURED, real Ghidra 12.1.3)."

key-files:
  created:
    - src/mcp/vice/vendor/ghidra-ext/Module.manifest
    - src/mcp/vice/vendor/ghidra-ext/extension.properties
    - src/mcp/vice/vendor/ghidra-ext/data/sleighArgs.txt
    - src/mcp/vice/vendor/ghidra-ext/data/languages/6502_nmos.ldefs
    - src/mcp/vice/vendor/ghidra-ext/data/languages/6502_nmos.slaspec
    - src/mcp/vice/vendor/ghidra-ext/data/languages/6502_undocumented.sinc
    - src/mcp/vice/sleigh-compile-gate.test.ts
    - src/mcp/vice/ghidra-run.ts
    - .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-01-sleigh-gate-red.md
    - .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-01-language-used.md
    - .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/COVERAGE.md
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/ghidra-project.mts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/resources/ghidra-project.mjs
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/ghidra-project.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - .gitignore

key-decisions:
  - "Applied the eight sized-local SLEIGH fixes to docs/undocumented-opcodes-ghidra.md's fenced source verbatim per 36-RESEARCH.md's verified fix (local i8:1/a16:2 introduced before every raw userop/macro/deref use of imm8/imm16); MEASURED to compile clean, exit 0, only the two expected warnings plus one pre-existing stock-inherited warning."
  - "ghidra.installExtension's materialisation side effects (mkdir, copy the vendored tree, copy the three stock files) live in runHostTool()'s own resolution branch, not buildHostToolArgv() -- keeping buildHostToolArgv() the one place argv/outputs are DERIVED from already-resolved fields, never the place a filesystem mutation happens."
  - "LANGUAGE_ID_PATTERN is syntactic only (colon-separated alphanumeric/underscore segments, length-capped) and deliberately does NOT reject a wrong-case id at request-normalisation time -- the byte-exact, case-sensitive refusal is ghidra-run.ts's own job (Task 3), and in practice Ghidra's own analyzeHeadless already refuses an unregistered-case id outright (MEASURED: 'Unsupported language: 6502:le:16:nmos', InvalidInputException) before any run log is even produced."
  - "installedLanguageIds() (named in this plan's phase-wide artifacts list) was deliberately NOT implemented here -- 36-02-PLAN.md's own action text specifies it as that plan's deliverable with a detailed, different spec (walks two directory sets against a real Ghidra tree). Implementing a placeholder here risked colliding with that plan's own from-scratch authoring."
  - "classifyGhidraRunLog()'s classification-count question (expected vs. observed) is a provisional, generic labelled-number extraction -- the export script that will print those two numbers (GhidraStructExport.java) does not exist until plan 36-03, and that plan's own instructions explicitly anticipate recording a finding rather than editing this file if the provisional parser does not match the real format."
  - "The script-throw literal ('ERROR REPORT SCRIPT ERROR:') and the fact that a thrown post-script still yields exit status 0 were MEASURED this session against real Ghidra 12.1.3 with a deliberately-thrown GhidraScript, rather than assumed."

patterns-established:
  - "Host-side Ghidra language extensions: vendor the SLEIGH source, copy the host's own stock support files at materialisation time, compile with support/sleigh, never commit the .sla."
  - "Run-log classifiers take TEXT only, never an exit status, when the host tool being classified can exit 0 on a partial or failed run."

requirements-completed: [OPC-01, OPC-04]

coverage:
  - id: D1
    description: "The vendored SLEIGH extension source compiles clean under support/sleigh (exit 0, .sla produced, mtime strictly newer than every input) and is observed red on a reverted sized-local fix"
    requirement: OPC-01
    verification:
      - kind: integration
        ref: "sleigh-compile-gate.test.ts#COMPILE: support/sleigh compiles the vendored extension with exit 0, zero errors, and produces a .sla whose mtime is strictly newer than every input"
        status: pass
      - kind: integration
        ref: 'sleigh-compile-gate.test.ts#PLANTED VIOLATION: reverting the ":NOP imm16" (op=0x0c) sized-local fix reddens the compile gate'
        status: pass
    human_judgment: false
  - id: D2
    description: "A real analyzeHeadless run driven through ghidra.analyze with the new language id names that language in its captured run log, and the same import under the stock id names the stock id -- criterion 1 has a real failing direction"
    requirement: OPC-04
    verification:
      - kind: manual_procedural
        ref: "evidence/36-01-language-used.md"
        status: pass
    human_judgment: true
    rationale: "This is a live integration proof against a real installed Ghidra distribution (not committed to the repo), captured as a transcript rather than an automated assertion the CI suite can re-run unattended -- a human should confirm the transcript's own digests and run-log excerpts are genuine."
  - id: D3
    description: "ghidra.analyze's processor field is required, non-defaulted, and validated; ghidra-run.ts refuses a byte-exact language mismatch"
    requirement: OPC-04
    verification:
      - kind: unit
        ref: "host-tool.test.ts#normaliseHostToolRequest(...) (processor absent) is refused, naming \"processor\""
        status: pass
      - kind: unit
        ref: "ghidra-project.test.ts#buildAnalyzeHeadlessArgv: refuses a \"processor\" that does not match LANGUAGE_ID_PATTERN"
        status: pass
    human_judgment: false

# Metrics
duration: 41min
completed: 2026-09-04
status: complete
---

# Phase 36 Plan 01: The SLEIGH Language and the Ghidra Harness -- tracer Summary

**A vendored NMOS 6502 SLEIGH extension (all 105 undocumented opcode bytes) compiles under `support/sleigh` into a new `6502:LE:16:nmos` language, installed by a sixth host tool, and a real `analyzeHeadless` run through `ghidra.analyze`'s new required `processor` field captures a run log that names the language it actually used.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-09-04T15:37:38Z
- **Completed:** 2026-09-04T16:18:37Z
- **Tasks:** 3 completed
- **Files modified:** 14 (11 created, 8 modified, some overlap between task boundaries)

## Accomplishments

- Vendored the `6502_nmos` SLEIGH extension source under `src/mcp/vice/vendor/ghidra-ext/`, applying the eight sized-local fixes to `docs/undocumented-opcodes-ghidra.md`'s fenced content -- MEASURED to compile clean with `support/sleigh`: exit 0, an 8435-byte `.sla`, only the two expected warnings plus one pre-existing stock-inherited warning.
- Declared the new Ghidra language id `6502:LE:16:nmos` in a new `.ldefs` file; confirmed the stock `6502.ldefs` is never touched and still declares only its own two ids.
- Landed `ghidra.installExtension`, a sixth host tool: resolves `sourceDir`, refuses by name when `GHIDRA_HOME` is unset or `support/sleigh`/the three stock 6502 language files are absent, materialises the extension plus the copied stock files into `<GHIDRA_HOME>/Ghidra/Extensions/<moduleName>/`, and compiles the `.sla` there.
- Made `ghidra.analyze`'s `processor` field required and non-defaulted, validated against a new anchored `LANGUAGE_ID_PATTERN`, re-checked independently inside `buildAnalyzeHeadlessArgv()`; the argv now emits `-processor <id>` as two separate entries.
- Captured the run log as `outputs[0]` (a digested `results[]` entry) for every `ghidra.analyze` invocation, since `HostToolClientResult` carries no stdout field -- `runHostTool()` now writes the child's stdout followed by its stderr to that slot before the digest loop runs.
- Wrote `sleigh-compile-gate.test.ts`: a structural half (no Ghidra required) plus a COMPILE half (gated on `GHIDRA_HOME`/`support/sleigh`, skipped by named reason otherwise) asserting the three-part pass condition, three degenerate-input cases, and a planted-violation case reverting one of the eight fixes.
- Recorded the compile gate observed RED (reverted fix) and GREEN (committed tree) in `evidence/36-01-sleigh-gate-red.md`.
- Wrote `ghidra-run.ts`: the container-side orchestrator (`runGhidraAnalyze()`) and run-log classifier (`classifyGhidraRunLog()`), with a byte-exact, case-sensitive comparison between the requested `processor` and the run log's own `Using Language/Compiler:` line.
- Raised `hostpath-consumers.test.ts`'s `HOST_TOOL_FAMILY_FLOOR` for `ghidra-run.ts` and added it to the SEAM-06 positive control.
- Recorded criterion 1's language-used observation in `evidence/36-01-language-used.md` and wrote the phase's `COVERAGE.md`.
- Verified live, twice, against real Ghidra 12.1.3: a `6502:LE:16:nmos` run names that language in its captured run log; the same import under `6502:LE:16:default` names the stock language instead.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end -- the extension compiles, installs, and the run log names it** - `55a758c8` (feat)
2. **Task 2: Observe the compile gate red, then restore the fix** - `25e19987` (docs -- the planted-violation test case itself landed in Task 1's commit; see Deviations)
3. **Task 3: The container-side orchestrator, the family floor, and the coverage declaration** - `edc8a0ae` (feat)

## Files Created/Modified

- `src/mcp/vice/vendor/ghidra-ext/data/languages/6502_undocumented.sinc` - the corrected extension source, all 105 undocumented opcode bytes
- `src/mcp/vice/vendor/ghidra-ext/data/languages/6502_nmos.slaspec` - two-line wrapper including the stock file then the extension
- `src/mcp/vice/vendor/ghidra-ext/data/languages/6502_nmos.ldefs` - the new `6502:LE:16:nmos` language declaration
- `src/mcp/vice/vendor/ghidra-ext/extension.properties`, `Module.manifest`, `data/sleighArgs.txt` - the minimum extension-module file set
- `src/mcp/vice/host-tool.mts` - `ghidra.installExtension` (sixth host tool), `ghidra.analyze`'s required `processor` field, the run-log output slot
- `src/mcp/vice/ghidra-project.mts` - `LANGUAGE_ID_PATTERN`, `GHIDRA_EXTENSION_MODULE_NAME`, `GHIDRA_STOCK_6502_LANGUAGE_FILES`, `-processor` argv emission
- `src/mcp/vice/ghidra-run.ts` - container-side `runGhidraAnalyze()` and `classifyGhidraRunLog()`
- `src/mcp/vice/sleigh-compile-gate.test.ts` - the phase's earliest gate, structural + COMPILE halves, planted violation
- `src/mcp/vice/hostpath-consumers.test.ts` - `HOST_TOOL_FAMILY_FLOOR` raised, SEAM-06 positive control extended
- `.gitignore` - the built `.sla` and a nested `tools/ghidra-runs/` entry ignored

## Decisions Made

See `key-decisions` in the frontmatter above. The most consequential: `installedLanguageIds()` was deliberately deferred to plan 36-02 rather than stubbed here, since that plan's own action text specifies a from-scratch, differently-shaped implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `runHostTool()` never wrote the run log for `ghidra.analyze`**
- **Found during:** Task 1's own live tracer verification
- **Issue:** `buildHostToolArgv()`'s ghidra branch was changed to return `outputs[0]` as the run-log path, but nothing wrote the child's stdout/stderr to that path before the digest loop -- the live tracer's first run returned `results: []` instead of a digested run log.
- **Fix:** Added a `ghidra.analyze` branch in `runHostTool()`, immediately below the existing `dxa.disassemble` stdout-to-file branch, writing `stdout + stderr` to `built.outputs[0]` before the digest loop -- exactly as Task 1's own action text specified but which was missed on the first implementation pass.
- **Files modified:** `src/mcp/vice/host-tool.mts`
- **Verification:** The live tracer command re-run afterward printed `TRACER_OK` with both run logs correctly digested.
- **Committed in:** `55a758c8` (Task 1 commit)

**2. [Rule 1 - Bug] 23 pre-existing tests in `host-tool.test.ts`/`ghidra-project.test.ts` broke when `processor` became required**
- **Found during:** Task 1's own verify step (`node --test host-tool.test.ts ghidra-project.test.ts`)
- **Issue:** Every pre-existing `ghidra.analyze` test fixture predates the required `processor` field and omitted it, so they all failed the new required-field check.
- **Fix:** Added `processor: "6502:LE:16:default"` (or an equivalent valid id) to every affected fixture; added a `processor` entry to `HOST_TOOL_ARG_KEYS_REMAINDER`/`HOST_TOOL_MINIMAL_VALID_ARGS`/`HOST_TOOL_TIMEOUT_MS`-adjacent census tables; raised the pinned path-key-total census from 12 to 13; added two new tests asserting the missing-`processor` and invalid-pattern refusals directly.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`, `src/mcp/vice/ghidra-project.test.ts`
- **Verification:** `node --test host-tool.test.ts ghidra-project.test.ts` -- 118/118 pass.
- **Committed in:** `55a758c8` (Task 1 commit)

### Task-boundary note (not a defect)

Task 2's own planted-violation test case was authored as part of `sleigh-compile-gate.test.ts` in Task 1's single commit, rather than as a separate follow-up edit in Task 2's own commit -- both were written together as one coherent unit of work, since the gate and its own red observation are naturally authored in the same pass. Task 2's commit therefore contains only the evidence file. This is a commit-granularity difference from the plan's literal task-by-task split, not a missing deliverable: both the test case and the evidence transcript exist, and every one of Task 2's own `<verify>`/`<acceptance_criteria>` items passes.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), plus 1 commit-granularity note.
**Impact on plan:** Both auto-fixes were necessary for the plan's own stated verification to pass; no scope creep. The commit-granularity note changes nothing about what was delivered.

## Known Stubs

None. `classifyGhidraRunLog()`'s classification-count question is explicitly documented as PROVISIONAL in its own code comments (not a stub hiding an incomplete feature) -- it has no caller in this plan and plan 36-03 is explicitly instructed to record a finding rather than treat a mismatch as a defect in this file.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required. `GHIDRA_HOME` is an existing, already-documented host prerequisite from Phase 34, not new to this plan.

## Next Phase Readiness

- `OPC-01`'s compile gate and `OPC-04`'s language-id/processor-field/run-log-capture criteria are the phase's foundation; plan 36-02 can now build the loader/import-route preflight on top of `ghidra.analyze`'s required `processor` field and `ghidra-project.mts`'s `LANGUAGE_ID_PATTERN`/`GHIDRA_STOCK_6502_LANGUAGE_FILES`.
- `ghidra-run.ts`'s `classifyGhidraRunLog()` is ready for plan 36-03 to import over its own captured log fixtures without modifying this file -- though its classification-count parser is provisional and may need a documented finding rather than a fix.
- `installedLanguageIds()` remains unimplemented, as designed -- plan 36-02 is expected to add it to `ghidra-project.mts`.
- No blockers.

---
*Phase: 36-the-sleigh-language-and-the-ghidra-harness*
*Completed: 2026-09-04*

## Self-Check: PASSED

- All 11 declared created files verified present on disk with `[ -f ]`.
- All 3 task commits (`55a758c8`, `25e19987`, `edc8a0ae`) verified present in `git log --oneline --all`.
- Re-ran every plan-level `<verification>` command: `npm run typecheck` green; `node build.ts` + `resources-sync.test.ts` green (no drift); `host-tool.test.ts`/`ghidra-project.test.ts`/`hostpath-consumers.test.ts`/`sleigh-compile-gate.test.ts` combined -- 149 tests, 144 pass, 0 fail, 5 skipped (the COMPILE half, no `GHIDRA_HOME` in that shell); `git ls-files -- '*.sla'` is 0; `git ls-files -- '*.sh'` is 5; the live tracer command re-run printed `TRACER_OK`.
- Re-ran `npm run test:automated`: 2 failing tests in 1 file (`anno-register.test.ts`), matching the measured baseline exactly -- no regression.
