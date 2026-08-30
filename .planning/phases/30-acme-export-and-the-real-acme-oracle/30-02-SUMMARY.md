---
phase: 30-acme-export-and-the-real-acme-oracle
plan: 02
subsystem: testing
tags: [acme, assembler, oracle, byte-diff, spawnSync, mandatory-red, fixtures, provenance]

requires:
  - phase: 30-acme-export-and-the-real-acme-oracle
    provides: "plan 30-01's acme-verify.ts (the one ACME spawn plus the three-outcome verdict), anno-export-asm.ts's exportAsm(), and acme-verify.test.ts's tracer"
  - phase: 27-acme-gate
    provides: "acme-gate.ts's ACME_BIN / ACME_AVAILABLE module-load constants and assertAcmeRequiredIfEnvSet, whose env-var boundary only a child process can move"
  - phase: 29-the-mcp-surface
    provides: "the carried verify transcripts under .planning/phases/29-the-mcp-surface/fixtures/ and the re-record obligation their README states"
provides:
  - "classifySpawn() / SpawnClassifier / SpawnClassification -- the ONE place availability is decided, with RESEARCH.md Pitfall 2's measured table in its JSDoc"
  - "missingAssemblerIsNeverAPass() -- the ONE predicate both the real check and the planted-violation control drive"
  - "the five verdict rules as named pure exported helpers: parseAcmeResultLines, parseAcmeAggregateLines, refuseOnCompetingAggregates, firstResultLineDisagreement, parseAcmeDiagnostics"
  - "AcmeSegmentLine and AcmeDiagnostic -- ACME's own result-line and diagnostic shapes, parsed"
  - "runVerifyProbe() -- the child-process mandatory-red harness with its paired zero-exit control"
  - "the phase's own re-recorded ACME 0.97 transcripts and their provenance README, plus capture-transcripts.mjs"
affects: [30-03, 30-04, 30-05, 30-06]

actuals:
  tokens: 21700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "one shared property predicate driven twice -- once with the real implementation and once with a deliberately planted violation -- so a guard that cannot fail is impossible (the 11-01 discipline, here as missingAssemblerIsNeverAPass)"
    - "a verdict rule is a named pure exported function with its own JSDoc and its own test, so a rule that silently stopped firing cannot hide behind an end-to-end path that happens to agree"
    - "evidence whose production is a committed program: the fixtures README's Regenerating section names capture-transcripts.mjs rather than a prose recipe, and the transcript's argv is rebuilt from the module's own exported flag list"

key-files:
  created:
    - .planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/README.md
    - .planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/verify-honest-pass.txt
    - .planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/verify-false-pass-trap.txt
    - .planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/capture-transcripts.mjs
  modified:
    - src/mcp/vice/acme-verify.ts
    - src/mcp/vice/acme-verify.test.ts

key-decisions:
  - "SHORTCUT_CLASSIFIER is a genuinely different function, not a constant: `!r.status ? \"ran\" : \"unavailable\"` answers `ran` for every missing-binary shape AND `unavailable` for a real non-zero exit, so the control is wrong in both directions the historical rule was wrong in"
  - "AcmeVerifyResult.diagnostics stays WIDER than parseAcmeDiagnostics()'s structured subset -- every non-empty stderr line still reaches the human, so narrowing the severity union could not silently drop a line"
  - "parseAcmeDiagnostics gained ACME's default (non---msvc) shape and a last-resort severity sniff, preserving 30-01's BARE_SEVERITY safety net through the extraction rather than losing it to a tidier union"
  - "firstResultLineDisagreement() owns the COUNT disagreement as well as the per-index one, because a count mismatch is the degenerate case of the same property and splitting them would put one rule in two places"
  - "capture-transcripts.mjs was added (not in the plan's files_modified) because the README's required Regenerating section has to name a re-runnable command, and a prose recipe is not one"
  - "The fixtures README's DO-NOT block answers the Phase 29 obligation BY NAME and a test enforces it: no *.test.* file but this one may reference the retired producer's directory, and this one references it only to assert byte-INEQUALITY"

patterns-established:
  - "Mandatory reds are observed in BOTH the property's own terms (in process, through one shared predicate) and the boundary's terms (in a child process, because the constant is module-load), and neither substitutes for the other"
  - "A pinned transcript records the argv rebuilt from the module's own exported constant, so a flag added to the module and not to the evidence is impossible rather than merely unlikely"
  - "A re-record obligation is discharged with a byte-inequality assertion against the file it replaces -- proof of a re-record rather than a copy"

requirements-completed: [EXPORT-01, EXPORT-03]

coverage:
  - id: D1
    description: "MANDATORY RED 1: with ACME_BIN pointed at a path that does not exist, export verification reports skipped-or-failed and never a pass -- observed in a child process, with its paired zero-exit control and a wording-read-from-source guard"
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#MANDATORY RED 1 (child process): VICE_REQUIRE_ACME=1 with a nonexistent ACME_BIN makes the child FAIL, never skip"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#MANDATORY RED 1 (child process): that same failing run names the gate's OWN refusal wording, so the non-zero exit is the assertion and not a broken import"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#MANDATORY RED 1, paired direction: the identical child run with VICE_REQUIRE_ACME ABSENT exits zero"
        status: pass
    human_judgment: false
  - id: D2
    description: "The non-vacuity control: the same shared predicate, driven with the historical truthiness-of-exit-status classifier, reports the missing assembler as a pass -- so the guard is provably able to bite"
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#MANDATORY RED 1 (in process): a missing assembler is never a pass, and the same predicate driven with the historical exit-status shortcut says it is"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#classifySpawn maps the three measured shapes: no exit status is `unavailable`, exit 0 and exit 1 are both `ran`"
        status: pass
    human_judgment: false
  - id: D3
    description: "MANDATORY RED 2: a deliberately corrupted export byte makes the byte-diff fail while ACME itself still exits 0 -- outcome failed, byteDiff.equal false, exitStatus 0 in the same recorded result"
    requirement: "EXPORT-01"
    verification:
      - kind: integration
        ref: "src/mcp/vice/acme-verify.test.ts#MANDATORY RED 2: a corrupted export byte fails the byte-diff while ACME itself exits 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The stale-output vector: real ACME leaves a pre-existing output file untouched on failure, and the module refuses to read a previous run's product"
    requirement: "EXPORT-03"
    verification:
      - kind: integration
        ref: "src/mcp/vice/acme-verify.test.ts#real ACME does NOT truncate its output file on failure: a pre-existing file survives an exit-1 run untouched"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/acme-verify.test.ts#a failing `!error` assertion is `failed` with byteDiff null, and an earlier honest run's diff never survives into it"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each of the five verdict rules is exercised by its own named test against its own named pure helper, with verbatim real-ACME output"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#VERDICT RULE 1 of five: parseAcmeResultLines() reads ACME's OWN per-segment lines off real -v2 stdout"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#VERDICT RULE 2 of five: parseAcmeAggregateLines() returns the `Saving ...` lines and nothing else -- recorded, never trusted"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#VERDICT RULE 3 of five: refuseOnCompetingAggregates() refuses two disagreeing aggregates and passes one or none"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#VERDICT RULE 4 of five: firstResultLineDisagreement() names the FIRST disagreeing index, and agrees silently"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#VERDICT RULE 5 of five: parseAcmeDiagnostics() classifies real Warning lines as warnings and real Error lines as errors"
        status: pass
    human_judgment: false
  - id: D6
    description: "EXPORT-03 structurally: the verdict is never satisfiable by the exporter's own output -- no substring-containment call whose receiver is the caller-supplied source text, with a planted-violation control and a comment-only control"
    requirement: "EXPORT-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#EXPORT-03: the verdict never string-matches the exporter's own output, and the scan that says so can go red"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both pinned transcripts re-recorded from real ACME 0.97 output produced by this phase's own producer, with provenance, provably not copies, and nothing in this phase asserting against the retired producer's bytes"
    requirement: "EXPORT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#non-vacuity: each re-recorded transcript is NOT byte-equal to its Phase 29 counterpart"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#the honest-pass transcript and parseAcmeResultLines() agree -- the parser and its own evidence tell the same story"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#no test in this phase reads the retired producer's fixtures directory"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/acme-verify.test.ts#the fixtures README records the assembler release string and a capture date"
        status: pass
    human_judgment: false

duration: 28 min
completed: 2026-08-30
status: complete
---

# Phase 30 Plan 02: Both mandatory reds, the five verdict rules, and re-recorded evidence Summary

**A missing assembler and a corrupted byte are now both OBSERVED refusals -- one in a child process because `ACME_BIN` is a module-load constant, one against a real ACME that exits 0 on the wrong bytes -- each paired with a control that proves the guard can bite, and both pinned transcripts re-recorded from ACME 0.97 output this phase's own producer made.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-08-30T21:40Z (approx.)
- **Completed:** 2026-08-30T22:08Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- **MANDATORY RED 1 observed, in both of the two ways it has to be.** In process, `missingAssemblerIsNeverAPass()` is one predicate driven twice, and the historical truthiness classifier fails it. In a child process, with `ACME_BIN` pointed at a path that does not exist, the run exits **1** naming the gate's own refusal wording; the identical run with `VICE_REQUIRE_ACME` **deleted** exits **0**.
- **MANDATORY RED 2 observed.** One flipped operand byte gives `outcome: "failed"`, `byteDiff.equal: false`, `firstDifferingOffset: 1` and **`exitStatus: 0`** in one recorded result. The exit status cannot see a wrong byte, so it can never be the verdict, not even when it is zero.
- **The stale-output vector -- the fourth false-pass vector, undocumented in this repo before Phase 30 -- is both reproduced and closed.** Real ACME exits 1, prints its error, and leaves a pre-existing output file byte-for-byte untouched. The module's defence is observed behaviourally: a failing run reports `byteDiff === null`, and an earlier honest run's `equal: true` diff provably does not survive into it.
- **The five verdict rules are named pure exported helpers**, each with its own JSDoc naming which rule it carries and its own test driving it with verbatim real-ACME output. `verifyAcmeAssembles()`'s body now decides nothing itself.
- **Both transcripts re-recorded, and the re-record is proved rather than asserted.** Each new `.txt` is byte-UNEQUAL to its same-named Phase 29 counterpart, and a source scan holds every other `*.test.*` file in `src/mcp/vice/` to zero references to the retired producer's directory.

## Task Commits

1. **Task 1: MANDATORY RED 1 -- a missing assembler is never a pass** - `3ce7659` (test)
2. **Task 2: MANDATORY RED 2, the five verdict rules, and the stale-output trap** - `7f0389a` (test)
3. **Task 3: re-record both pinned transcripts, with provenance** - `ed27cf3` (docs)

**Plan metadata:** the `docs(30-02)` commit that carries this file.

## Files Created/Modified

- `src/mcp/vice/acme-verify.ts` — gains `SpawnClassification`, `SpawnClassifier`, `classifySpawn`, `missingAssemblerIsNeverAPass`, `AcmeSegmentLine`, `AcmeDiagnostic`, `parseAcmeResultLines`, `parseAcmeAggregateLines`, `parseAcmeDiagnostics`, `refuseOnCompetingAggregates`, `firstResultLineDisagreement`. All extracted **out of** `verifyAcmeAssembles()`'s body, never duplicated.
- `src/mcp/vice/acme-verify.test.ts` — 12 tests → 33. Both mandatory reds with their controls, the stale-output pair, five verdict-rule tests, the EXPORT-03 structural scan, and five keeping-honest tests over the fixtures.
- `.planning/phases/30-.../fixtures/verify-honest-pass.txt` — the honest pass through this phase's producer.
- `.planning/phases/30-.../fixtures/verify-false-pass-trap.txt` — the three vectors provoked against the new route.
- `.planning/phases/30-.../fixtures/README.md` — provenance table, the DO / DO-NOT block answering Phase 29's obligation by name, Regenerating, and two declared sources of non-determinism.
- `.planning/phases/30-.../fixtures/capture-transcripts.mjs` — the regeneration program.

## Evidence the plan asked to be recorded, raw

### MANDATORY RED 1, FAIL direction — `VICE_REQUIRE_ACME=1`, `ACME_BIN` nonexistent

`child exit status: 1`

```
TAP version 13
# Subtest: ACME availability gate, under a deliberately nonexistent ACME_BIN
not ok 1 - ACME availability gate, under a deliberately nonexistent ACME_BIN
  ---
  duration_ms: 2.572004
  type: 'test'
  location: '/tmp/acme-verify-red-DkBy4c/probe.test.mjs:5:1'
  failureType: 'testCodeFailure'
  error: 'VICE_REQUIRE_ACME is set but no real ACME was found at ACME_BIN="/tmp/acme-verify-red-DkBy4c/definitely-not-acme" -- a maintainer (and CI, which sets this) expects a hard FAIL, never a SKIP, when the binary is actually missing.'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    assertAcmeRequiredIfEnvSet (file:///home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a9bce7cc22ac84927/src/mcp/vice/acme-gate.ts:117:15)
    TestContext.<anonymous> (file:///tmp/acme-verify-red-DkBy4c/probe.test.mjs:6:3)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: verifyAcmeAssembles() with a nonexistent ACME_BIN is never ok
ok 2 - verifyAcmeAssembles() with a nonexistent ACME_BIN is never ok
  ---
  duration_ms: 6.700414
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 1
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 155.754388
```

Note the second probe test: `verifyAcmeAssembles()` under the same nonexistent binary passed, because its outcome was `"skipped"` and never `"ok"`. The child exits non-zero because of the **gate**, not because the verify primitive misbehaved — which is exactly the separation the wording-read-from-source guard exists to keep visible.

### MANDATORY RED 1, paired direction — same probe, `VICE_REQUIRE_ACME` DELETED

`child exit status: 0`

```
TAP version 13
# Subtest: ACME availability gate, under a deliberately nonexistent ACME_BIN
ok 1 - ACME availability gate, under a deliberately nonexistent ACME_BIN
  ---
  duration_ms: 1.640578
  type: 'test'
  ...
# Subtest: verifyAcmeAssembles() with a nonexistent ACME_BIN is never ok
ok 2 - verifyAcmeAssembles() with a nonexistent ACME_BIN is never ok
  ---
  duration_ms: 6.000271
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 204.122915
```

Without this direction the non-zero exit above would be indistinguishable from a broken harness — a typo'd import path, a syntax error and a missing probe file all exit non-zero too.

### MANDATORY RED 1, the non-vacuity control, measured

```
ACME_BIN: /tmp/observe-red2-heVw4T/definitely-not-acme
status: null
error.code: ENOENT
historical truthiness classifier (!r.status ? "ran" : "unavailable"): ran
classifySpawn(): unavailable
```

And the verdict over that shape:

```json
{
  "outcome": "skipped",
  "exitStatus": null,
  "acmeResultLines": [],
  "aggregateLines": [],
  "diagnostics": [],
  "byteDiff": null,
  "reason": "ACME never ran: spawning \"/tmp/observe-red2-heVw4T/definitely-not-acme\" failed with ENOENT. No assembler ran, so no claim about the bytes exists -- this is \"skipped\", which is neither a pass nor a byte-level failure."
}
```

### MANDATORY RED 2 — the raw `AcmeVerifyResult`

The honest control first, so the red is a change of exactly one byte and nothing else:

```json
{
  "exitStatus": 0,
  "acmeResultLines": [
    "Segment size is 6 (0x6) bytes (0x801 - 0x807 exclusive)."
  ],
  "aggregateLines": [
    "Saving 6 (0x6) bytes (0x801 - 0x807 exclusive)."
  ],
  "diagnostics": [
    "/tmp/acme-verify-6CUm7I/export.a(5) : Warning (Zone <untitled>): Wrong type - expected address."
  ],
  "byteDiff": {
    "equal": true,
    "firstDifferingOffset": null,
    "expectedLength": 6,
    "actualLength": 6
  },
  "outcome": "ok",
  "reason": "the output file this run created is byte-identical to the expected bytes (6 byte(s) across 1 segment(s))."
}
```

Then `expectedBytes[1]` flipped `$00` → `$01` (the `lda`'s immediate operand), everything else identical:

```json
{
  "exitStatus": 0,
  "acmeResultLines": [
    "Segment size is 6 (0x6) bytes (0x801 - 0x807 exclusive)."
  ],
  "aggregateLines": [
    "Saving 6 (0x6) bytes (0x801 - 0x807 exclusive)."
  ],
  "diagnostics": [
    "/tmp/acme-verify-6e6IWk/export.a(5) : Warning (Zone <untitled>): Wrong type - expected address."
  ],
  "byteDiff": {
    "equal": false,
    "firstDifferingOffset": 1,
    "expectedLength": 6,
    "actualLength": 6
  },
  "outcome": "failed",
  "reason": "assembled bytes differ from the expected bytes: first differing byte offset 1, expected length 6, actual length 6."
}
```

`exitStatus: 0` and `byteDiff.equal: false` in the same object is the whole content of this red. ACME reported success; the byte-diff caught it anyway.

### The stale-output reproduction, raw

```
bytes BEFORE: 5354414c45  (ascii "STALE")
argv: acme -f plain --msvc -o <tmp>/stale.bin <tmp>/dup.a
exit: 1
stdout: ""
stderr: /tmp/observe-red2-heVw4T/dup.a(3) : Error (Zone <untitled>): Symbol already defined.

bytes AFTER : 5354414c45  (ascii "STALE")
```

A verify path assembling to a fixed output path would have byte-diffed `STALE` and called this failed run a pass. The module's own defence, observed:

```json
{
  "exitStatus": 1,
  "acmeResultLines": [
    "Segment size is 3 (0x3) bytes (0x801 - 0x804 exclusive)."
  ],
  "aggregateLines": [],
  "diagnostics": [
    "/tmp/acme-verify-eJlAyo/export.a(5) : Error (Zone <untitled>): !error: block end drifted: expected $0899"
  ],
  "byteDiff": null,
  "outcome": "failed",
  "reason": "ACME reported a fatal diagnostic: /tmp/acme-verify-eJlAyo/export.a(5) : Error (Zone <untitled>): !error: block end drifted: expected $0899"
}
```

`byteDiff: null` is the load-bearing half — no bytes were read at all, so no previous run's product could have been reported as a match.

### The exact `npm run test:automated` tail

```
1..2600
# tests 2804
# suites 24
# pass 2797
# fail 1
# cancelled 0
# skipped 1
# todo 5
# duration_ms 42331.018437
```

The single failure is `repo-root.test.ts`'s path-agreement test, red **because this executor runs inside a GSD worktree located under `.claude/`** — the environmental failure plan 30-01 logged in `deferred-items.md`. Arithmetic against 30-01's recorded 2783/2776: 2783 + 21 new tests = 2804; 2776 + 21 = 2797. Exact.

## Decisions Made

- **The planted control is wrong in both directions, not merely blind in one.** `SHORTCUT_CLASSIFIER` is `!r.status ? "ran" : "unavailable"`. It answers `"ran"` for all three measured missing-binary shapes (the hole), *and* `"unavailable"` for a genuine non-zero exit (a real assembly failure misread as an absent assembler). Making it a constant would have been simpler and would have proved nothing: a constant control cannot distinguish a working predicate from a broken one.
- **`AcmeVerifyResult.diagnostics` stays wider than the structured parse.** Narrowing `AcmeDiagnostic.severity` to ACME's three spellings meant unmatched stderr lines had nowhere to go. Rather than drop them, `diagnostics` keeps recording **every** non-empty stderr line and `parseAcmeDiagnostics()` returns the structured subset the fatal check reads. Nothing a human might need is lost to a tidier type.
- **30-01's non-`--msvc` safety net survived the extraction, and grew.** The old `BARE_SEVERITY` test would have been quietly dropped by a strict-union parser. It is now three tiers, most specific first: the `--msvc` shape, ACME's default `Error - File f, line N (Zone <z>): …` shape, and a last-resort sniff for any line opening with a severity word. A build that ignored `--msvc` cannot read as "no diagnostics were reported".
- **The count disagreement lives inside `firstResultLineDisagreement()`.** It is the degenerate case of the same property, and its message is what `/bin/true`'s paired-direction test asserts on; splitting it into a sixth helper would have put one rule in two places and broken that test's meaning.
- **The transcript's argv is rebuilt, never retyped.** `capture-transcripts.mjs` composes it from `acme-verify.ts`'s own exported `ACME_VERIFY_ARGV_FLAGS`, so a flag added to the module and not to the evidence is impossible rather than merely unlikely.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` absent in the worktree, so `npm run typecheck` could not run**

- **Found during:** Task 1 (first `npm run typecheck`)
- **Issue:** GSD worktrees are fresh checkouts and the repo never commits `node_modules/`; the `SessionStart` hook provisions it only in the main checkout. Same blocker plan 30-01 recorded.
- **Fix:** symlinked `src/mcp/vice/node_modules` to the main checkout's already-provisioned directory. No package was installed and no lockfile was touched.
- **Files modified:** none tracked. The symlink is untracked and was never staged (files are staged individually, never `git add .`). Note for the orchestrator, unchanged from 30-01: `.gitignore`'s `node_modules/` has a trailing slash and therefore does not match a symlink, so it shows as `??` in `git status` inside the worktree.
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** nothing — deliberately.

**2. [Rule 2 - Missing critical] `capture-transcripts.mjs` added, outside the plan's `files_modified`**

- **Found during:** Task 3
- **Issue:** the plan requires the fixtures README to carry "a **Regenerating** section: the exact command to re-run". A prose recipe is not a command, and the Phase 29 README's own analogue records "there is no capture script for this directory" as a known weakness. Evidence whose production cannot be re-run is a claim, which is precisely the property this phase is obliged not to inherit.
- **Fix:** added `capture-transcripts.mjs` to the fixtures directory. It rebuilds both `.txt` files from real ACME output through this phase's producer, applies exactly one declared post-capture transformation (temp paths → `<TMPDIR>`), and is what the README's Regenerating section names.
- **Files modified:** `.planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/capture-transcripts.mjs` (new)
- **Verification:** run end to end; both transcripts regenerated from scratch. A keeping-honest test asserts the script exists. Nothing in `src/` or the npm tarballs is affected — `check-npm-packages.mjs` exits 0 with 79/34 files unchanged.
- **Committed in:** `ed27cf3`

**3. [Rule 2 - Missing critical] The two header paragraphs `acme-verify.test.ts` carried about unproven boundaries were stale the moment Task 1 landed**

- **Found during:** Task 1
- **Issue:** the file's own header said the `ACME_BIN` **environment-variable** boundary "belongs to the mandatory-red harness in a later plan of this phase, not here", and the tracer's DIVISION OF LABOUR comment repeated it. Both became false with Task 1's child harness. A header that describes a state the file left is worse than no header: a later reader adds the "missing" proof and gets a third, weaker copy.
- **Fix:** both paragraphs rewritten to state what is now proved where, and why neither observation substitutes for the other. The COST paragraph was re-derived too — four children after Task 1, nine after Task 2, with the memoisation and the per-child cost stated.
- **Files modified:** `src/mcp/vice/acme-verify.test.ts`
- **Verification:** the counts in the header were checked against the actual spawn sites, not estimated.
- **Committed in:** `3ce7659`, `7f0389a`

---

**Total deviations:** 3 (1 blocking, 2 missing-critical)
**Impact on plan:** No scope creep. Deviation 1 is the same environmental blocker 30-01 hit and is resolved the same way. Deviations 2 and 3 both close gaps between what an artifact claims and what is true — the one property this whole phase exists to defend.

## Issues Encountered

- **`repo-root.test.ts` path-agreement remains red inside a GSD worktree.** Environmental, unchanged from 30-01, logged in `deferred-items.md`. Every "0 failures" claim in this SUMMARY means "0 other than that one" while running in a worktree.

## Same-wave contract with 30-03

Both rules held, and both are checked rather than asserted:

1. **`verifyAcmeAssembles()`'s public signature is unchanged.** `git diff` against the wave base over `acme-verify.ts` removes no line from `AcmeVerifyOptions`, `AcmeVerifyResult`, `AcmeByteDiff`, `AcmeExpectedSegment` or the `verifyAcmeAssembles` declaration. Every new export is additive.
2. **`ACME_VERIFY_ARGV_FLAGS` was not touched.** Its declaration and member list are byte-identical to plan 30-01's; the only diff line naming it is the unchanged `const flags = [...ACME_VERIFY_ARGV_FLAGS]` inside `buildArgv`, moved by a hunk boundary.

No file 30-03 owns (`anno-export-asm.ts`, `anno-export-asm.test.ts`, `anno-types.ts`, `anno-types.test.ts`) was edited by this plan.

## Known Stubs

None. No hardcoded empty value reaches a caller, no placeholder text is emitted, and every new code path either produces verified output or refuses by name. No test was skipped, and every `<verify>` block in the plan was run — so there is nothing for this plan to append to `.planning/WINDOWS.md`.

## Requirements

`requirements-completed` carries this plan's declared `[EXPORT-01, EXPORT-03]`, but **`.planning/REQUIREMENTS.md` was deliberately NOT marked**, for the same shared-ID reason 30-01 recorded: `EXPORT-01` is also declared by 30-05 and 30-06, and `EXPORT-03` by 30-03 and 30-04, none of which has a `SUMMARY.md` yet. The shared-ID gate blocks both until the last declaring plan finishes. No `REQUIREMENTS.md` edit is part of this plan's commits.

## User Setup Required

None — no external service configuration required. Real ACME 0.97 "Zem" is installed on this host at `/home/henrik/.local/bin/acme`, and CI installs it and sets `VICE_REQUIRE_ACME=1`.

## Next Phase Readiness

- **EXPORT-01's two mandatory reds are earned against the current producer.** The ROADMAP's note that the prior evidence does not transfer is discharged: both reds, both non-vacuity controls, and both transcripts came out of the route that exists now.
- **The five verdict rules are individually addressable.** Plans 30-04 and 30-05 can add emission features and assert against the specific rule that would catch a regression, instead of only through the end-to-end path.
- **`verifyAcmeAssembles()`'s signature stays frozen for the rest of the phase.** New exports are additive; callers may keep binding to the 30-01 shape.
- **Re-capturing the fixtures is a one-line command.** `node .planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/capture-transcripts.mjs`, with the README's provenance table the only thing to update alongside.
- **Caveat for every later plan in this phase:** while running inside a GSD worktree the suite's clean floor is 1 failure, not 0, for the environmental reason above.

---
*Phase: 30-acme-export-and-the-real-acme-oracle*
*Completed: 2026-08-30*

## Self-Check: PASSED

- `.planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/README.md` — FOUND
- `.planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/verify-honest-pass.txt` — FOUND
- `.planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/verify-false-pass-trap.txt` — FOUND
- `.planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/capture-transcripts.mjs` — FOUND
- `src/mcp/vice/acme-verify.ts` — FOUND (modified)
- `src/mcp/vice/acme-verify.test.ts` — FOUND (modified)
- commit `3ce7659` — FOUND
- commit `7f0389a` — FOUND
- commit `ed27cf3` — FOUND
- plan `<verification>`: `npm run typecheck` exit 0 — PASS
- plan `<verification>`: `VICE_REQUIRE_ACME=1 node --test acme-verify.test.ts` exit 0, 33/33 — PASS
- plan `<verification>`: `npm run test:automated` — 2797/2804 pass, the single failure environmental and documented in `deferred-items.md`
- plan `<verification>`: both mandatory reds pasted above as raw output, not summarised — PASS
- acceptance: `cmp -s` against both Phase 29 transcripts exits non-zero — PASS
- acceptance: `grep -rl '29-the-mcp-surface/fixtures' src/mcp/vice/*.test.ts` returns only `acme-verify.test.ts` — PASS
- acceptance: `grep -v '^\s*//' acme-verify.ts | grep -v '^\s*\*' | grep -c 'r\.status\b'` returns 2 — PASS
- acceptance: `grep -v '^\s*//' acme-verify.test.ts | grep -c 'delete env.NODE_TEST_CONTEXT'` returns 1 — PASS
- acceptance: `grep -v '^\s*//' acme-verify.test.ts | grep -cE 'spawnSync\(\s*"node"'` returns 0 — PASS
- extra: `node scripts/check-npm-packages.mjs` exit 0 — PASS
