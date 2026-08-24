---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 03
subsystem: testing
tags: [coverage, 6502, static-analysis, regenerator2000, recursive-descent, dispatch-tables, sealed-answer-key]

# Dependency graph
requires:
  - phase: 04-disassembler
    provides: "disasm-decoder.ts's bounded, never-throwing decode() -- the independent instruction stream the census walks"
  - phase: 10-adoption-boundaries
    provides: "r2000-project.ts's synthesizeProject()/decodeRawData() symmetric writer and reader for the on-disk payload"
  - phase: 11-annotation-store-enums
    provides: "r2000-confidence.ts's five-grade vocabulary, the sealed-answer-key mechanism, and the previously-unseen recon-subject fixture"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-01/19-02 absorbed the upstream analyze procedures whose own reachability walk this census deliberately does not reuse"
provides:
  - "src/mcp/vice/r2000-coverage.ts -- the coverage instrument: a byte census, a widened indirect-dispatch scan, two label figures, a comment-vacuity measure, a sampled reproducibility result and a divergence sub-report, under a pinned schema"
  - "COVERAGE_SCHEMA_VERSION = 1 and COVERAGE_REPORT_KEYS -- the field-set contract Phase 20 reads and Phase 21 reuses"
  - "scanIndirectDispatch() -- the four-class widened scan Phase 21's hazard report (BUILD-04) consumes without re-deriving it"
  - "Six committed synthetic control fixtures plus a deterministic generator"
  - "A sealed bytes-versus-store reproducibility answer under evidence/coverage-reproducibility/"
affects: [19-04 coverage CLI verb, phase 20 decomposition sweep, phase 21 hazard report]

actuals:
  tokens: 32678
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Store-independent census: the annotation store's own block table is read at exactly ONE call site (the divergence sub-report) and a test proves a mass block-type rewrite moves no census byte"
    - "Separately-addressable measures with a recursive key scan that forbids any combined-figure vocabulary anywhere in the report"
    - "Bytes-versus-store independence axis for a sealed answer key, substituting for the two-session axis that nested headless sessions make unrunnable"
    - "Data-driven controls: each fixture's store.json declares its own expect_clean/expect_measure, so the test loop reads the expectation from the fixture rather than repeating it in test code"

key-files:
  created:
    - src/mcp/vice/r2000-coverage.ts
    - src/mcp/vice/r2000-coverage.test.ts
    - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
    - src/mcp/vice/fixtures/coverage/README.md
    - src/mcp/vice/fixtures/coverage/nc1-all-auto/{project.regen2000proj,store.json}
    - src/mcp/vice/fixtures/coverage/nc1b-auto-renamed-in-place/{project.regen2000proj,store.json}
    - src/mcp/vice/fixtures/coverage/nc2-generic-comments/{project.regen2000proj,store.json}
    - src/mcp/vice/fixtures/coverage/nc3-all-data-blocks/{project.regen2000proj,store.json}
    - src/mcp/vice/fixtures/coverage/nc4-multi-caller-unnamed/{project.regen2000proj,store.json}
    - src/mcp/vice/fixtures/coverage/nc5-well-documented/{project.regen2000proj,store.json}
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/coverage-reproducibility/QUESTION.md
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/coverage-reproducibility/ANSWER.md
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/coverage-reproducibility/ANSWER.sha256
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/coverage-reproducibility/RE-DERIVED-ANSWER.md
  modified: []

key-decisions:
  - "Report schema pinned as flat sibling objects one level deep (checkpoint option `flat-three`), auto-selected under the project's yolo mode: each measure is addressable by its own stable top-level key, the schema test is a plain key-set assertion, and reducing over the measures into one aggregate is structurally awkward rather than one line away"
  - "The reproducibility independence axis is bytes-versus-store, not a second agent session -- nested headless sessions stall in this environment, so the axis that matters is that neither route reads the other's input; the seal is what prevents retrofit"
  - "coverageFindings() lives OUTSIDE the report object: a boolean verdict with per-measure reasons is not a combined coverage figure, and keeping it out of the schema keeps the no-aggregate key scan honest"
  - "The census marks exactly one byte per data reference, never a guessed extent -- the length of an indexed access is not determinable from the bytes, so guessing would manufacture coverage that was never proven"
  - "An absent block listing reports divergence as explicitly UNAVAILABLE with a stated reason rather than letting an all-null block lookup read as `the store classified none of it` (COV-02)"
  - "A near-miss confidence token is caught rather than propagated: r2000-confidence.ts throws by design, but a measurement pass must never throw, so the near-miss is reported as the measured defect it is"

patterns-established:
  - "Store-derived-census refusal: any future measure added to this module must state which of the six named traps it avoids, and the block listing stays at one call site"
  - "Both-directions controls: five planted defects that must each be caught by a NAMED measure, plus one genuinely good subject that must come back clean -- the last one asserted explicitly as the non-vacuity control"
  - "Live seal non-vacuity: the sealed answer is not only hash-checked between two committed files, it is recomputed from the committed fixture on both routes on every run, so a fixture change cannot leave two mutually-consistent but stale answers passing"

requirements-completed: [COV-01, COV-02]

coverage:
  - id: D1
    description: "A coverage report carries five separately addressable measures under a pinned schema, with no combined figure anywhere in the object"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#the report's top-level key set is exactly the pinned set, in order, and carries the schema version"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#COV-01: no key anywhere in the report matches a combined-figure vocabulary"
        status: pass
    human_judgment: false
  - id: D2
    description: "The structural census is a pure function of the raw bytes and the seed set -- regenerator2000's own block table cannot move a census byte"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#NC3 earns its place: the census does not move by one byte under a mass block-type set, only the divergence does"
        status: pass
    human_judgment: false
  - id: D3
    description: "Decodability is never counted as evidence of code: reached-as-instruction means reached by recursive descent from a seed, and the linear-sweep figure is reported separately and never summed in"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#decodability: removing the seed set collapses the reached count, so a census that barely responds to its seeds would fail here"
        status: pass
    human_judgment: false
  - id: D4
    description: "The widened dispatch scan reaches all four classes upstream's own reachability walk does not: zero-page vectors, multi-entry tables, split lo/hi tables, and the stack-return idiom that contains no indirect-jump opcode"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#dispatch class 1: an indirect jump through a ZERO-PAGE vector is found and reported, with a null target"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#dispatch class 2: a multi-entry table yields every entry, not the single entry upstream reads"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#dispatch class 3: a split lo/hi table pair is reconstructed from its two bases"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every table walk is bounded by an explicit maximum entry count, the descent walker by an explicit step bound, and the whole census never throws on malformed input"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#bounded walk: the descent walker honours an explicit step bound and reports truncation rather than looping"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#emptiness: a zero-byte, a one-byte and a seedless payload each report zero reached and unreached == range, with no thrown error"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Auto-versus-User label measure reports two independent figures, so a mass rename that flips kind while leaving the auto name in place is still caught"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#NC1b earns its place: the kind figure alone would pass the auto-renamed-in-place control, the name figure catches it"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#AUTO_NAME_PREFIX_RE deliberately excludes the prefix upstream shares between predefined and user-defined label types"
        status: pass
    human_judgment: false
  - id: D7
    description: "Comment normalisation is exact, duplicate comments count once, a banned-generic comment never counts as documentation, and a zero-comment project reports a null ratio rather than dividing by zero"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#normalisation pins the exact rules: ASCII lowercase, backticks and emphasis stripped, whitespace runs collapsed, trimmed"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#two identical normalised comments at different addresses count as ONE distinct comment"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#a zero-comment project reports a NULL distinct-comment ratio with a zero commented-address count, never a division"
        status: pass
    human_judgment: false
  - id: D8
    description: "The cross-reference rule engages at strictly more than one caller, and a multi-caller label documented without naming a caller is excluded from the user tally"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#the cross-reference rule engages at strictly MORE THAN ONE caller, and not at one"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#control NC4 (nc4-multi-caller-unnamed): produces a non-clean result naming reproducibility"
        status: pass
    human_judgment: false
  - id: D9
    description: "Five negative controls each produce a non-clean result naming the measure that caught it, and the well-documented control produces a clean result"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#control NC1 .. NC5 (six data-driven control tests)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#NON-VACUITY: the well-documented control passes, so the instrument is not merely a machine that fails everything"
        status: pass
      - kind: manual_procedural
        ref: "demonstrated: flipping every nc5 label to kind Auto makes the false-positive control test exit non-zero, then restored"
        status: pass
    human_judgment: false
  - id: D10
    description: "The sampled reproducibility result is sealed against retrofit, and a missing or empty re-derivation FAILS rather than skips"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-19-SEAL-DRIFT)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#QUESTION.md does not contain either canonical answer line, nor any of its compound field assignments (T-19-LEAK)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#LIVE non-vacuity: both routes are recomputed from the committed fixture and both reproduce the sealed line"
        status: pass
      - kind: manual_procedural
        ref: "demonstrated: emptying ANSWER.sha256 exits 1; blanking RE-DERIVED-ANSWER.md's marker fence exits 1 (2 failures, not a skip); both restored"
        status: pass
    human_judgment: false
  - id: D11
    description: "Two runs of the report over the same project are byte-identical apart from the timestamp, and every offending-address list is ascending"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#ordering: every offending-address list in every fixture's report is in ascending numeric order"
        status: pass
    human_judgment: false
  - id: D12
    description: "A coverage run cannot corrupt a project file and leaves no partial report on disk, because the module contains no write, save or session call"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#the coverage module contains no file-write call, no project-save call and no live-session import"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hostpath-consumers.test.ts#the r2000 module family (D-08/R2000-02) is absent from the consumer set"
        status: pass
    human_judgment: false
  - id: D13
    description: "The instrument produces a well-formed report over a previously-unseen fixture authored for a different phase"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#the previously-unseen Phase 11 fixture -- authored for a different phase, never used to write these rules -- produces a well-formed report"
        status: pass
    human_judgment: false
  - id: D14
    description: "The six control fixtures are reproducible from a committed deterministic generator and do not leak into either published tarball"
    requirement: "COV-02"
    verification:
      - kind: manual_procedural
        ref: "demonstrated: `node fixtures/coverage/make-coverage-fixtures.mjs` run three times leaves no modification in `git status --porcelain src/mcp/vice/fixtures/coverage`"
        status: pass
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs (assertLeanTarball refuses any packed file under fixtures/)"
        status: pass
    human_judgment: false

# Metrics
duration: 19 min
completed: 2026-08-24
status: complete
---

# Phase 19 Plan 03: The Coverage Instrument Summary

**A derived-from-bytes coverage census that regenerator2000's own block table cannot move by a single byte, with a four-class widened dispatch scan, two label figures, a comment-vacuity measure, a bytes-versus-store reproducibility seal, and six committed controls — five that must fail for a named reason, one that must pass.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-24T16:43:33Z
- **Completed:** 2026-08-24T17:03:17Z
- **Tasks:** 2 (plus one auto-resolved checkpoint decision)
- **Files created:** 20

## Accomplishments

- **The census is store-independent by construction, and proven so.** `computeStructuralCensus()` classifies every byte in `[origin, origin+size)` into four disjoint classes by recursive descent from an explicit seed set, using nothing but the raw bytes and `decode()`. The annotation store's block listing is read at exactly one call site in the whole module — `computeDivergence()` — and the independence test rewrites every block entry to one type and asserts no census byte count moves while the divergence sub-report does. This is the design constraint that makes the instrument non-circular: upstream's own `follow_indirect_jumps()` walks only bytes already classified `Code` through pointers already classified `Address`, so on an under-classified binary it finds nothing.
- **The widened dispatch scan reaches all four classes upstream misses.** Zero-page vectors (upstream's `is_internal` gate excludes them), multi-entry dispatch tables (upstream reads exactly one entry per `jmp ($nnnn)`), split lo/hi tables (no block type opens upstream's gate), and the stack-return idiom `lda hi,x : pha : lda lo,x : pha : rts`, which contains no indirect-jump opcode at all and is therefore completely invisible to an opcode-keyed walk. Each class is returned separately with its own targets so Phase 21's hazard report can consume the one it needs.
- **No combined figure exists anywhere.** The report is flat sibling objects under `COVERAGE_REPORT_KEYS`; a recursive key scan over the whole object asserts nothing matches `overall|combined|aggregate|composite|score|headline|totalcoverage`. `coverageFindings()` — the boolean verdict the controls assert against — deliberately lives outside the report object and emits no number.
- **Six controls, both directions.** Five planted defects each caught by the measure the research named for it, and one genuinely well-documented program that comes back clean. That last one is asserted explicitly as the non-vacuity control, and degrading it (flipping every label to `Auto`) was demonstrated to turn the suite red.
- **The reproducibility result is sealed and live-checked.** `ANSWER.sha256` was committed against the store-route answer; the bytes-route re-derivation hashes to the same seal; and a live test recomputes *both* routes from the committed fixture on every run, so a fixture change cannot leave two mutually-consistent but stale answers passing. Emptying the seal and blanking the re-derivation's marker fence were each demonstrated to produce a failing run, never a skip.
- **Full suite stays green:** 2514 tests, 2469 pass, 0 fail, 40 skipped, 5 todo — exactly the pre-plan baseline plus the 42 new tests.

## Task Commits

1. **Task 1: the census, the widened dispatch scan, and the three measures** — `d4e9c16` (feat)
2. **Task 2: six committed controls, the schema test, and the independence proof** — `d13862f` (test)

**Plan metadata:** see the `docs(19-03)` commit that follows.

## Files Created/Modified

- `src/mcp/vice/r2000-coverage.ts` (1446 lines) — the instrument. `COVERAGE_SCHEMA_VERSION`, `COVERAGE_REPORT_KEYS`, `buildCoverageReport()`, `computeStructuralCensus()`, `scanIndirectDispatch()`, `computeLabelRatio()`, `computeCommentVacuity()`, `computeReproducibility()`, `classAt()`, `normaliseComment()`, `coverageFindings()`, `AUTO_NAME_PREFIX_RE`, `BANNED_GENERIC_COMMENTS`, `MAX_WALK_STEPS`, `MAX_TABLE_ENTRIES`, `R2000CoverageInputError`, plus the input/output types.
- `src/mcp/vice/r2000-coverage.test.ts` (755 lines, 42 tests) — schema, independence, decodability, emptiness, idempotency, ordering, normalisation, the cross-reference rule, both bounds, four dispatch classes, the six controls, the previously-unseen fixture, the read-only source assertion, and four seal guards.
- `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` (247 lines) — the deterministic generator, with the shared 64-byte control program disassembled line by line in its header.
- `src/mcp/vice/fixtures/coverage/README.md` — what each fixture is a control for, the regeneration command, and why the filename carries no test suffix.
- `src/mcp/vice/fixtures/coverage/{nc1-all-auto,nc1b-auto-renamed-in-place,nc2-generic-comments,nc3-all-data-blocks,nc4-multi-caller-unnamed,nc5-well-documented}/` — six fixture directories, each a `project.regen2000proj` written by the real `synthesizeProject()` plus a `store.json` in exactly the curated tools' response shape.
- `.planning/.../evidence/coverage-reproducibility/{QUESTION.md,ANSWER.md,ANSWER.sha256,RE-DERIVED-ANSWER.md}` — the sealed bytes-versus-store reproducibility evidence.

## Decisions Made

**Checkpoint (auto-resolved): the report schema is `flat-three`.** The plan opened with a `checkpoint:decision` (`gate="blocking"`) pinning the report's JSON shape. The project's configured mode is `yolo` and the plan itself marks `flat-three` as the recommended option, so it was auto-selected and logged rather than surfaced. Rationale as stated in the plan: each measure is addressable by a stable top-level key, which makes "never one aggregate" structurally obvious and makes the schema test a plain key-set assertion; the rejected `measures-array` shape makes reducing over the measures into a single figure *easier*, which is exactly what COV-01 forbids, and `nested-by-requirement` would couple an output format to requirement IDs that retire at the milestone close.

**The reproducibility independence axis is bytes-versus-store, not a second session.** Recorded as a named deviation from 19-RESEARCH.md §3.4 in the module header itself. Nested headless agent sessions stall indefinitely in this environment, so the runnable independence is that neither route reads the other's input: the store route reads only grades, block types and cross-reference lists; the bytes route reads only the payload. The seal is what prevents retrofit, exactly as in Phase 11.

**The canonical answer line was designed to be two-sided derivable and not guessable.** It carries `sample=`, `classes=` and `callers=`. The caller counts are the discriminating field: the store route reads them off the recorded cross-reference lists, the bytes route re-counts control-flow targets in the census-reached instruction stream, and the two agreeing is a real result rather than a coin flip over a three-word vocabulary.

**`coverageFindings()` is deliberately not a report key.** A boolean verdict with per-measure reasons is what the six controls need to assert against, but putting it inside `CoverageReport` would give a consumer one field to read as "the coverage answer". Keeping it outside keeps the no-combined-figure key scan meaningful and keeps the measures the only thing the schema promises.

**One byte per data reference, never a guessed extent.** `lda $0840,x` marks exactly `$0840` as `referenced-as-data`. The extent of an indexed access is not determinable from the bytes; extending the mark would manufacture coverage that was never proven, which is the same failure mode as counting linear-sweep decodability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] An absent block listing was reading as "the store classified nothing"**

- **Found during:** Task 1 (smoke test against the Phase 11 fixture)
- **Issue:** With no `blocks` supplied, every block lookup returned `null`, so `censusCodeStoreNotCode` counted every reached byte and the divergence measure reported a large, confident-looking number derived from nothing. COV-02 requires an unavailable check to report an explicit unknown carrying a reason, never a figure that reads as a finding.
- **Fix:** Added `blocksSupplied: boolean` and `reason: string | null` to `DivergenceReport`; `coverageFindings()` now reports divergence as explicitly *unavailable* with its stated reason when no listing was supplied, instead of firing the census-versus-store comparison.
- **Files modified:** `src/mcp/vice/r2000-coverage.ts`
- **Verification:** The Phase 11 fixture (no store data) now reports `divergence: unavailable`; the six controls, which all supply blocks, are unaffected.
- **Committed in:** `d4e9c16` (Task 1 commit)

**2. [Rule 2 — Missing Critical] A near-miss confidence token would have thrown out of a measurement pass**

- **Found during:** Task 1 (`computeCommentVacuity` design)
- **Issue:** `parseConfidencePrefix()` throws on a near-miss bracket token by deliberate design — that is the whole point of `r2000-confidence.ts`. But the plan's own truth requires the census never to throw on malformed input, so a single typo'd grade in a real project would have crashed the whole report.
- **Fix:** The call is wrapped, and the near-miss is recorded in a new `malformedGradeAddresses` list and surfaced as a `commentVacuity` finding — reported as the measured defect it is rather than silently degraded to "ungraded" (which is precisely the drift `r2000-confidence.ts`'s header forbids).
- **Files modified:** `src/mcp/vice/r2000-coverage.ts`
- **Verification:** `r2000-coverage.test.ts#a near-miss confidence token is reported as a measured defect, never thrown and never degraded to ungraded`
- **Committed in:** `d4e9c16` (Task 1 commit)

**3. [Rule 3 — Blocking] The module header could not name the path-translation guard file**

- **Found during:** Task 1 (acceptance-criteria run)
- **Issue:** The repo's module-header doctrine (copied from `r2000-verify.ts`) names the absence-assertion test file by name, but this plan's own acceptance criterion greps `r2000-coverage.ts` for `hostpath|containerpath` and fails on any match — including a comment. The two requirements were in direct conflict.
- **Fix:** The header states the rule and names the guard by description rather than by filename, and says explicitly why the filename is omitted so a future editor does not "fix" it back and break the check.
- **Files modified:** `src/mcp/vice/r2000-coverage.ts`
- **Verification:** `! grep -Eq "hostpath|containerpath" src/mcp/vice/r2000-coverage.ts` succeeds; `hostpath-consumers.test.ts` passes 11/11 with the new module inside its derived `r2000-*.ts` set.
- **Committed in:** `d4e9c16` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 blocking)
**Impact on plan:** All three were required for correctness under the plan's own stated truths. No scope creep — no file outside `files_modified` was touched.

## Threat Flags

None. No new network endpoint, auth path, file-write path or schema change at a trust boundary. The module opens exactly one file for reading and contains no write, save or session call, asserted at source level.

## Known Stubs

None.

## Issues Encountered

- **`R2000_MODULE_FLOOR` interaction:** `hostpath-consumers.test.ts` asserts a floor of 14 derived `r2000-*.ts` production modules and forbids any of them importing the path-translation modules. Adding `r2000-coverage.ts` raises the derived count and puts the new module under the absence assertion automatically — no test edit was needed, and the floor is a `>=` so it stays satisfied. Confirmed by running that suite.
- **`ci-suite-coverage.test.ts` and the fixture directory:** the guard registers a directory as a suite only when it directly contains a committed test file. `make-coverage-fixtures.mjs` deliberately carries no test suffix, so `fixtures/coverage` never registers and needs no CI step. Verified: 10/10 pass.
- **cwd drift during a demonstration:** one shell demonstration `cd`'d into `src/mcp/vice` and a follow-up relative-path restore failed. Re-run with absolute paths; the evidence file was restored and re-verified byte-for-byte against its hash before committing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for 19-04.** That plan adds `cmdCoverage()` and the `coverage` verb to `r2000-cli.ts`. Two concrete handoffs it must pick up:

1. **`r2000-coverage.ts` is not in `src/mcp/vice/package.json`'s `files[]`.** Nothing shipped imports it yet, so `scripts/check-npm-packages.mjs` passes today (verified, exit 0). The moment `r2000-cli.ts` imports it, that script's reachable-module assertion will require the entry. Adding it is 19-04's job; this plan deliberately did not touch `package.json`, which is outside its `files_modified`.
2. **The CLI's report writer must not become a combined-figure display.** COV-01's prohibition covers "not as a headline number derived at the point of display". `coverageFindings()` is available for a verdict line; there is no numeric aggregate to print and none should be computed in the CLI.

Phase 20's decomposition sweep can read `COVERAGE_SCHEMA_VERSION = 1` and the nine top-level keys as a stable contract. Phase 21's hazard report (BUILD-04) can consume `scanIndirectDispatch()`'s four separately-reported classes — in particular `stackReturnDispatch`, which is its own named class — without re-deriving them.

## Self-Check: PASSED

All 20 created files verified present on disk; both task commits (`d4e9c16`, `d13862f`) verified present in `git log`; all Task 1 and Task 2 acceptance criteria re-run and passing; the plan-level verification block re-run in full (`r2000-coverage.test.ts` 42/42, `hostpath-consumers.test.ts` 11/11, `ci-suite-coverage.test.ts` 10/10, `tsc --noEmit` exit 0, `npm test` 2469/2469 with 0 failures, `scripts/check-npm-packages.mjs` exit 0).

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-24*
