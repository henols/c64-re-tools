---
phase: 36-the-sleigh-language-and-the-ghidra-harness
plan: 04
subsystem: reverse-engineering-harness
tags: [ghidra, live-tests, run-log-classifier, harness-gates, opt-in]

# Dependency graph
requires:
  - phase: 36-the-sleigh-language-and-the-ghidra-harness
    provides: "plan 36-02's seven ghidra.analyze wire fields and the checked language preflight, and plan 36-03's VolatileCarve.java/GhidraStructExport.java plus the bank fixture pair -- this plan drives all of it end to end against a real Ghidra 12.1.3 installation for the first time"
provides:
  - "ghidra-live.test.ts and ghidra-opcode-live.test.ts: the phase's eleventh and twelfth MANUAL_ONLY_TESTS entries, landed together in one commit with the array edit and the enumerating assertion"
  - "GHID-01's three gates (thrown-script exact literal with an uninformative exit status; the block-total classification count on both import routes; reproducibility plus a version-declared Ghidra prerequisite) each observed firing on a real analyzeHeadless run, recorded in evidence/36-04-three-gates.md"
  - "OPC-04's criterion-1 seed case: the same image under the stock language and the new language names two different languages in their own run logs, byte-exact"
affects: [36-05-boundary-and-adjacency-fixtures, 36-06-opcode-sweep, 36-07-decompinterface-live-proofs]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 10400
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two live suites landed in one commit rather than one, so two later plans (36-05, 36-06) can expand disjoint files in parallel without contending on a shared MANUAL_ONLY_TESTS edit."
    - "Every live case builds its own mkdtemp scratch workspace outside the repository and passes it as repoRoot -- this repository's own tools/ghidra-runs/ is never touched by a live test run."
    - "A run-log classifier verdict (classifyGhidraRunLog()) and a separate, export-FILE-text parser (parseExportClassificationCounts()) are deliberately two different parsers over two different texts with two different label formats (colon-suffixed println() output vs. bare-space file content) -- conflating them would have silently misread one or the other."

key-files:
  created:
    - src/mcp/vice/ghidra-live.test.ts
    - src/mcp/vice/ghidra-opcode-live.test.ts
    - .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-04-three-gates.md
  modified:
    - src/mcp/vice/test-gate.mjs
    - src/mcp/vice/test-gate.test.ts

key-decisions:
  - "The wrong-expectation value for gate 1 was 1 (not the image's own byte length) -- reused from plan 36-03's own already-captured runlog-script-error.txt fixture precedent, avoiding a second arbitrary choice for the same demonstrated failure mode."
  - "Gate 2's two live cases are read in registration order (a module-level `gate2PrgObserved` variable, set by the prg-route test and read by the flat64k-route test immediately after it) rather than a third, separately-ordered comparison test -- node:test's own default serial execution within one file makes this safe, and it avoids introducing an artificial third test whose only job is reading two module variables."
  - "Ghidra's own version is read from `$GHIDRA_HOME/Ghidra/application.properties`'s `application.version=` line (MEASURED: `12.1.3`) rather than from a `--version`-style CLI probe -- analyzeHeadless has no such flag, and application.properties is the installation's own declaration, read at test time, never assumed."
  - "The task commit-by-commit split was done by trimming the fully-authored final ghidra-live.test.ts/evidence file down to each task's own subset before its commit, then restoring the remainder for the next task's commit -- rather than authoring each task's content only after the prior commit landed. Every commit was independently typechecked, and the live suite was independently run in full against the real installation, at each commit boundary before proceeding (see Deviations)."

patterns-established:
  - "A duplicated (never imported) three-condition SKIP_REASON helper per live-Ghidra test file -- opt-in variable, then GHIDRA_HOME/analyzeHeadless, then the specific installed language a file's own cases need -- following this repository's own 'two short duplicates are cheaper than a shared production module' convention."

requirements-completed: [GHID-01]  # OPC-04 stays pending: 36-06-PLAN.md also declares it (requirements.ready-ids reports it BLOCKED until 36-06 produces its own SUMMARY.md -- shared-ID gate, #2388). GHID-01 was the only one of this plan's two declared requirements with every declaring sibling (36-01..36-04) already summarized.

coverage:
  - id: D1
    description: "Both live suites are registered as the eleventh and twelfth MANUAL_ONLY_TESTS entries in one commit with the array, the header paragraph and the enumerating assertion all landing together; each skips by named reason (opt-in variable, then GHIDRA_HOME, then the installed language) with no hand-rolled early return; test:automated's file list contains neither filename and its failing count matches the measured baseline"
    requirement: GHID-01
    verification:
      - kind: unit
        ref: "test-gate.test.ts#gate: MANUAL_ONLY_TESTS contains exactly the twelve dispositioned files"
        status: pass
      - kind: unit
        ref: "test-gate.test.ts#gate: automated set + manual set equals the on-disk *.test.* set, with no overlap"
        status: pass
      - kind: integration
        ref: "shell verification: node --test ghidra-live.test.ts ghidra-opcode-live.test.ts with no opt-in set -- 8/8 skipped, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Gate 1 (a wrong expected count throws the exact literal signal with an uninformative exit status of 0, and the paired negative case succeeds against the script's own computed block total) is observed firing on a real analyzeHeadless run against a real Ghidra 12.1.3 installation"
    requirement: GHID-01
    verification:
      - kind: integration
        ref: "shell verification: GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 node --test ghidra-live.test.ts -- both GATE 1 cases pass live"
        status: pass
      - kind: manual_procedural
        ref: "evidence/36-04-three-gates.md, Part: Gate 1"
        status: pass
    human_judgment: true
    rationale: "This is a live integration proof against a real, non-committed Ghidra installation, captured as a transcript rather than an automated assertion CI can re-run unattended -- a human should confirm the transcript's own quoted run-log line and recorded exit status are genuine."
  - id: D3
    description: "Gate 2 (the classification count read is the script's own computed block total on BOTH import routes, never the image's byte length, with the two routes' own numbers recorded as differing) and gate 3 (byte-identical reproducibility across run ids, anchored to the fixture's own sha256, plus Ghidra's own version read from the installation) are both observed firing on real runs"
    requirement: GHID-01
    verification:
      - kind: integration
        ref: "shell verification: GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 node --test ghidra-live.test.ts -- all GATE 2/GATE 3 cases pass live"
        status: pass
      - kind: manual_procedural
        ref: "evidence/36-04-three-gates.md, Parts: Gate 2 and Gate 3"
        status: pass
    human_judgment: true
    rationale: "Same as D2 -- a live proof against a real, non-committed Ghidra installation, recorded as a transcript for human confirmation of the recorded counts, digests and version string."
  - id: D4
    description: "The OPC-04 criterion-1 seed case: the same image under 6502:LE:16:default and 6502:LE:16:nmos names two different languages in their own run logs, by byte-exact comparison"
    requirement: OPC-04
    verification:
      - kind: integration
        ref: "shell verification: GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 node --test ghidra-opcode-live.test.ts -- SEED case passes live"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-09-04
status: complete
---

# Phase 36 Plan 04: The SLEIGH Language and the Ghidra Harness -- Live Ghidra Suites Summary

**Two live Ghidra test suites (`ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`) registered together as the phase's eleventh and twelfth manual-only files, with all three of `GHID-01`'s gates -- the exact-literal thrown-script signal, the block-total classification count on both import routes, and reproducibility plus a version-declared Ghidra prerequisite -- each observed firing on a real `analyzeHeadless` run against Ghidra 12.1.3.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-04T17:22:00Z (approx.)
- **Completed:** 2026-09-04T17:51:48Z
- **Tasks:** 3 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- Registered `ghidra-live.test.ts` (the harness suite, `GHID-01`..`05`) and `ghidra-opcode-live.test.ts` (the language suite, `OPC-04`) as `MANUAL_ONLY_TESTS`'s eleventh and twelfth entries, in the same commit as the array edit, the dated header paragraph and `test-gate.test.ts`'s enumerating assertion -- `npm run test:automated`'s file list contains neither filename.
- Each file computes `SKIP_REASON` exactly once from three ordered conditions (the `VICE_LIVE_GHIDRA` opt-in, then `GHIDRA_HOME`/`support/analyzeHeadless`, then the installed `6502:LE:16:nmos` language via `installedLanguageIds()`), passed through `node:test`'s own `{ skip }` option on every case -- with no opt-in set, all 8 cases across both files report SKIP and exit 0.
- Seeded both files with one real passing case each against the real Ghidra 12.1.3 installation: a `.prg`-route run over `bank.prg` under `6502:LE:16:nmos`, and the same image run under `6502:LE:16:default` then `6502:LE:16:nmos`, asserting the two run logs name different languages by byte-exact comparison.
- Observed gate 1 firing live: a deliberately wrong `expectedClassificationLines` (1, against the script's own real block total of 572) makes `GhidraStructExport.java` throw for real, the run log carries the exact literal `ERROR REPORT SCRIPT ERROR`, and `analyzeHeadless`'s own exit status is asserted equal to 0 -- recorded as evidence that the exit status is uninformative, never a pass signal. The paired negative case (override omitted) succeeds, with the export carrying its completed-assertion section and `observed == expected == 572`.
- Observed gate 2 firing live on both import routes over the same fixture body: the `.prg` route's observed classification count (572) equals its own computed block total and is asserted NOT equal to the image's own byte length (60); the flat-64K route's count (65536) equals its own block total and *coincides* with the image size there -- the two routes' own numbers (572 vs. 65536) are asserted to differ, so a single-route reading could not have stood in for both.
- Observed gate 3 firing live: two runs under different run ids over the same fixture produced byte-identical export files (sha256 `e5acd26...`, 6996 bytes each), anchored to `bank.prg`'s own sha256 (matched against `fixtures/ghidra/README.md`'s recorded value); Ghidra's own installed version was read from `$GHIDRA_HOME/Ghidra/application.properties` (`application.version=12.1.3`) and asserted against a named constant in the test file.
- Recorded all three gates' observations -- exact wire requests, the quoted thrown-script line, both routes' counts, the fixture's sha256, the two identical export digests, the asserted Ghidra version and the JDK version present -- in `evidence/36-04-three-gates.md`, closing with a stated scope of what each gate catches and what it does not.
- Every live run built its own `mkdtemp` scratch workspace outside this repository and tore it down in a `finally`; `git status --porcelain` over `tools/` and `fixtures/` stayed empty after every live run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Register both live suites and the twelve-entry manual-only set in one commit** - `c85e096b` (test)
2. **Task 2: Observe gate 1 firing** - `649197e4` (test)
3. **Task 3: Observe gates 2 and 3** - `e3aa896c` (test)

**Plan metadata:** committed separately (this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md).

## Files Created/Modified

- `src/mcp/vice/ghidra-live.test.ts` - the harness suite: `SKIP_REASON`, the scratch-workspace helpers, the flat-64K generator, the export-file classification-count parser, and all seven live cases (seed, gate 1 x2, gate 2 x2, gate 3 x2)
- `src/mcp/vice/ghidra-opcode-live.test.ts` - the language suite: a duplicated `SKIP_REASON`/scratch-workspace helper pair, and the one seed case asserting two different languages in their own run logs
- `src/mcp/vice/test-gate.mjs` - `MANUAL_ONLY_TESTS` grown from ten to twelve entries, plus the dated header paragraph naming the two mirror-assertion suites (`ghidra-harness-gates.test.ts`, `host-tool.test.ts`)
- `src/mcp/vice/test-gate.test.ts` - the enumerating assertion's test name and array literal updated from ten to twelve
- `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-04-three-gates.md` - the recorded transcript of all three gates firing live

## Decisions Made

See `key-decisions` in the frontmatter above. The most consequential: Ghidra's own version is read from `application.properties` (the installation's own declaration) rather than probed via a CLI flag `analyzeHeadless` does not have.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A TypeScript literal-type comparison error in the opcode-live seed case's redundant boolean-equality assertion**
- **Found during:** Task 1's own `npm run typecheck` verify step
- **Issue:** After `assert.equal(defaultResult.language.id, DEFAULT_LANGUAGE_ID)` and the equivalent `nmos` assertion, `node:assert/strict`'s `equal()` is typed with an `asserts` signature that narrows each side to the literal type of its second argument. The subsequent redundant `defaultResult.language.id === nmosResult.language.id` boolean-equality check then compared two disjoint string-literal types, which `tsc` flags as `TS2367` ("this comparison appears to be unintentional").
- **Fix:** Cast both sides to `string` explicitly at that one comparison site (`(defaultResult.language.id as string) === (nmosResult.language.id as string)`), preserving the intended runtime check (byte-exact, non-case-folded) without fighting TypeScript's own narrowing.
- **Files modified:** `src/mcp/vice/ghidra-opcode-live.test.ts`
- **Verification:** `npm run typecheck` clean; the case re-run live against the real installation, still passing.
- **Committed in:** `c85e096b` (Task 1 commit)

### Commit-granularity note (not a defect)

Per this phase's own established precedent (36-01, 36-02, 36-03 each recorded an equivalent note), all three tasks' test content was authored together as one coherent file before being split for per-task commits: the fully-authored final `ghidra-live.test.ts` and `evidence/36-04-three-gates.md` were trimmed down to each task's own subset immediately before that task's commit, then restored for the next task's commit. This is a commit-*sequencing* technique, not a shortcut on verification: `npm run typecheck` was re-run and the live suite was re-run in full against the real Ghidra 12.1.3 installation independently at EACH of the three commit boundaries (Task 1's trimmed file has only the seed case; Task 2's has the seed case plus both gate 1 cases; Task 3 has the complete file) before that task's own commit was made, and each commit's own `git status --porcelain` over `tools/`/`fixtures/` was confirmed clean. Every task's own `<verify>`/`<acceptance_criteria>` passed at its own commit boundary, using the file content that actually existed at that commit.

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug), plus 1 commit-granularity note.
**Impact on plan:** The typecheck fix was necessary for the plan's own stated verification (`npm run typecheck` clean) to pass; no scope creep. The commit-granularity note changes nothing about what was delivered or verified at each boundary.

## Known Stubs

None.

## Issues Encountered

Two full `npm run test:automated` runs during this plan transiently showed 4 failing tests instead of the measured baseline's 2 (the extra two were `check-skill-tool-coverage`/`check-skill-fork-honesty` in `audit-root-args.test.ts`, both timing-sensitive spawn cases). Re-running the full suite immediately afterward, and running `audit-root-args.test.ts` in isolation, both returned to 0 failures for that file and the overall count returned to the measured baseline (2 failing, both in `anno-register.test.ts`) -- confirmed as a transient flake under full-suite load, not a regression introduced by this plan. The final `test:automated` reading recorded before the last commit matched the baseline exactly.

## User Setup Required

None - no external service configuration required. `GHIDRA_HOME` remains the existing, already-documented host prerequisite from Phase 34; this plan is read-only toward the Ghidra installation (never calls `ghidra.installExtension`).

## Next Phase Readiness

- Both live suites are ready for plans 36-05 (volatile-carve/boundary fixtures) and 36-06 (opcode sweep) to expand in parallel against disjoint files -- `ghidra-live.test.ts` for the harness half, `ghidra-opcode-live.test.ts` for the language half -- with no further `MANUAL_ONLY_TESTS`/`test-gate.test.ts` edits needed for either.
- `GHID-01` is now `requirements-completed` here -- every plan declaring it (36-01..36-04) has produced a `SUMMARY.md`.
- `OPC-04` stays pending: `36-06-PLAN.md` also declares it, and `requirements.ready-ids` reports it BLOCKED until that plan produces its own `SUMMARY.md` (shared-ID gate, #2388). This plan's own criterion-1 seed case for `OPC-04` is done and verified; the requirement's checkbox flips once the last declaring plan finishes.
- No blockers.

---
*Phase: 36-the-sleigh-language-and-the-ghidra-harness*
*Completed: 2026-09-04*

## Self-Check: PASSED

- All 3 declared created files verified present on disk with `[ -f ]`.
- All 3 task commits (`c85e096b`, `649197e4`, `e3aa896c`) verified present in `git log --oneline --all`.
- Re-ran every plan-level `<verification>` command: `node --test test-gate.test.ts` green, `MANUAL_ONLY_TESTS.length === 12` (`TWELVE_OK`); both live files skip everything with no opt-in (8/8 skipped, exit 0) and pass fully with the opt-in plus the real installation (8/8 pass); `npm run test:automated`'s file list contains neither live filename and the failing count (2, both in `anno-register.test.ts`) matches the measured baseline; `evidence/36-04-three-gates.md` carries all three gates' observations (`GATE1_RECORDED`, `GATES23_RECORDED` both printed); `git status --porcelain` over `tools/`/`fixtures/` empty after every live run.
