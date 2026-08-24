---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 04
subsystem: api
tags: [cli, coverage, regenerator2000, packer-identity, oracle-chain, live-gate, skills]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-03's r2000-coverage.ts -- buildCoverageReport(), coverageFindings() and the pinned flat-three schema this verb renders"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-02's absorbed routine-queue-walker playbook, the place a `how documented is this program` measurement belongs"
  - phase: 18-persistent-session-and-tool-surface
    provides: "r2000-session.ts's single held regenerator2000 child per project path (Rule A21) -- the seam every store read here goes through"
  - phase: 11-annotation-store-enums-and-the-symbol-round-trip
    provides: "the previously-unseen recon-subject.regen2000proj fixture, authored for a different phase and never used to write the instrument's rules"
  - phase: 10-adoption-boundaries
    provides: "r2000-cli.ts's closed-option-set posture, VERB_OPTIONS, checkAcceptedOptions() and the shared overwrite-refusal helper"
provides:
  - "`vice-mcp r2000 coverage <project> [--out FILE] [--force] [--sample N]` -- the eighth CLI verb, COV-01's delivery path"
  - "cmdCoverage() plus a `coverage` entry in VERB_OPTIONS in src/mcp/vice/r2000-cli.ts"
  - "A live coverage report against a fixture the instrument's rules were never written against"
  - "src/skills/c64-program-recon/scripts/packer-finding.mjs -- the project-owned packer recon finding with an ordered oracle chain and a structurally-enforced hard unknown"
  - "packerFinding(), probeUnp64(), runUnp64(), parseUnp64Stdout(), skipReasonForUnp64(), shannonEntropy(), PACKER_VERDICTS, PACKED_ENTROPY_THRESHOLD, MAX_ORACLE_STDOUT_BYTES, MAX_PACKER_NAME_LENGTH, REQUIRE_ORACLE_ENV_VAR"
  - "R2000_CLI_VERB_FLOOR raised 7 -> 8, REAL_VERBS gains `coverage`, and the VERB_OPTIONS/USAGE agreement count raised 7 -> 8"
  - "r2000-coverage.ts added to src/mcp/vice/package.json's files[]"
affects: [19-05 phase decisions and skill-description overlap, phase 20 decomposition sweep, phase 21 hazard report]

actuals:
  tokens: 19021
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Separately-headed report rendering with an explicit never-combine rule stated at the display seam, because that is the last place an aggregate could be introduced"
    - "Ordered oracle chain with structural enforcement: the name field has exactly one assignment site, the high confidence level exactly one, and the source-level counts are asserted by the colocated test"
    - "External-oracle live gate reused from the D-11 precedent: absent means a VISIBLE skip by default and a hard failure under an opt-in variable, never a pass"
    - "Bounded per-address session reads: an explicit lookup ceiling whose effect is PRINTED whenever it bites, so a partial population never reports as the whole one"

key-files:
  created:
    - src/skills/c64-program-recon/scripts/packer-finding.mjs
    - src/skills/c64-program-recon/scripts/packer-finding.test.mjs
  modified:
    - src/mcp/vice/r2000-cli.ts
    - src/mcp/vice/r2000-cli.test.ts
    - src/mcp/vice/r2000-verb-coverage.test.ts
    - src/mcp/vice/package.json
    - scripts/lib/r2000-cli-verbs.mjs
    - src/skills/routine-queue-walker/SKILL.md
    - src/skills/c64-program-recon/SKILL.md

key-decisions:
  - "The coverage verb adds NO child-process site: every store read goes through runR2000Tool() into r2000-session.ts's single held child, exactly the route r2000-memmap-render.ts already uses, so the frozen two-entry child-launch registry is untouched (T-19-25)"
  - "Path validation goes through resolveStorePath() alone -- no second hand-rolled validator (T-19-22)"
  - "Exit code 0 for any report that could be built, however poor the numbers; non-zero reserved for a caller error, an unreadable store, or an undecodable payload. A bad score is a result, not a failure"
  - "The renderer prints three named measures plus comment vacuity, the dispatch scan and the divergence sub-report, each with its own numbers, and computes nothing at the point of display -- the header states plainly that the ratios measure different populations and are not commensurable"
  - "Cross-reference lookups are bounded at 512 non-System labels, and the bound's effect is printed whenever it bites, because r2000_get_cross_references answers one address per call"
  - "The packer finding is a skill script, NOT an r2000_* tool: that prefix means `regenerator2000 serves this` and no such tool exists upstream, so a project-invented name there would be a fabricated upstream tool this repo's own gates would then treat as legitimate"
  - "The oracle branch's stdout SHAPE is recorded as an assumption, not a measurement -- the external identifier is not installed here, so the parser is defensive and the oracle-route test skips visibly rather than pretending to have run"

patterns-established:
  - "Count-site discipline for a new CLI verb: an eighth verb moves FOUR counts (the dispatch switch, R2000_CLI_VERB_FLOOR, REAL_VERBS, and the VERB_OPTIONS/USAGE agreement count) and all four move in the same commit, each kept hand-maintained so none becomes a tautology over the parser it tests"
  - "Fixture constants are separated from real-source constants the moment they stop coinciding: a synthetic planted-violation source is a fixture with its own fixed shape, never a mirror of the real switch"
  - "Grep-gate hygiene applied to a new file's own prose: an acceptance check that greps this source for child-launch verbs means the header must describe the property without writing the verbs out, and must say why"

requirements-completed: [SURF-03, COV-01]

coverage:
  - id: D1
    description: "The coverage instrument is runnable from the command line against a real project as an eighth CLI verb, through the existing session seam"
    requirement: "COV-01"
    verification:
      - kind: integration
        ref: "node src/mcp/vice/vice-proxy.ts r2000 coverage .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/recon-subject.regen2000proj --out <path>"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-verb-coverage.test.ts#real-source parse: r2000-cli.ts's dispatch switch yields exactly the 8 known verbs, never 'default'"
        status: pass
      - kind: unit
        ref: "node scripts/check-skill-tool-coverage.mjs (8 verbs parsed, 8/8 resolved)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The verb prints three separately named measures plus the divergence sub-report and the comment-vacuity measure, and prints no combined figure anywhere including at the point of display"
    requirement: "COV-01"
    verification:
      - kind: integration
        ref: "captured stdout in this SUMMARY, plus a recursive key scan over the written JSON report for a combined-figure vocabulary (no hits)"
        status: pass
    human_judgment: true
    rationale: "The plan's own <human-check> asks a reader to judge whether the rendering invites being quoted as a single 'percent documented' figure. A key scan proves no aggregate KEY exists; whether the prose rendering reads as one is a judgment no test asserts."
  - id: D3
    description: "Running the verb against the previously-unseen Phase 11 fixture produces a well-formed report whose byte classes sum to the fixture's recorded size and which names its recorded origin"
    requirement: "COV-01"
    verification:
      - kind: integration
        ref: "captured stdout: 'the four classes sum to 100 of 100 censused byte(s)' and 'origin $0810'; independently confirmed against the fixture (decodeRawData -> 100 bytes, origin 2064 = $0810, blocks span 0..99)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The verb floor and the frozen verb registry are both raised deliberately rather than left stale, and the synthetic fixtures keep their own shapes"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-verb-coverage.test.ts#non-vacuity floor: R2000_CLI_VERB_FLOOR matches the measured true count and the real parse meets it"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-verb-coverage.test.ts#planted violation: an 8th, genuinely new case is parsed and reported missing, while a real, documented verb is not"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-cli.test.ts#the verb-options map agrees with USAGE's own per-verb option lists, for all eight verbs (IN-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Which packer a binary used is surfaced as a recon finding with a three-valued verdict plus an explicit unknown, a route, a confidence, an evidence list and a checked-at timestamp"
    requirement: "SURF-03"
    verification:
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#the verdict set has exactly four members and is frozen"
        status: pass
      - kind: integration
        ref: "node src/skills/c64-program-recon/scripts/packer-finding.mjs <synthetic unpacked file> -- one JSON object, packer null, verdict 'unpacked'"
        status: pass
    human_judgment: false
  - id: D6
    description: "The packer name is non-null only when an oracle reported it verbatim -- no code path can write it from entropy, a decompression address, or a byte pattern"
    requirement: "SURF-03"
    verification:
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#planted violation: an entropy value ABOVE the packedness threshold, oracle absent, never sets the name field"
        status: pass
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#source level: the packer name is assigned at exactly one site, and the high confidence level at exactly one"
        status: pass
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#source level: no transcribed packer signature bytes and no hedged vocabulary"
        status: pass
    human_judgment: false
  - id: D7
    description: "An unknown verdict always carries a non-empty unavailable-reason, and the vocabulary is exactly the four verdicts with no fractional rating and no hedged guess"
    requirement: "SURF-03"
    verification:
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#rule 3: an unknown verdict always carries a non-empty reason"
        status: pass
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#rule 4: every returned verdict is a member of the four-verdict set, over every non-oracle input"
        status: pass
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#rule 2: the high confidence level appears on NO non-oracle route, over every non-oracle input"
        status: pass
    human_judgment: false
  - id: D8
    description: "The oracle is live-gated: absent means an expected VISIBLE skip by default and a hard failure under the opt-in variable, and absence never reads as a pass"
    requirement: "SURF-03"
    verification:
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#the oracle route reports a name ONLY when a real external oracle stated one (reported SKIP with a reason naming the absent oracle)"
        status: pass
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#the skip is VISIBLE, not silent: an absent oracle yields a non-empty reason that names it"
        status: pass
      - kind: integration
        ref: "VICE_REQUIRE_UNP64=1 node --test src/skills/c64-program-recon/scripts/packer-finding.test.mjs -- exits 1, 15 pass / 1 fail / 1 skip (demonstrated, then unset)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The oracle subprocess is launched with an argument array and never a command interpreter, and a non-existent configured path is oracle-absent rather than interpolated anywhere"
    requirement: "SURF-03"
    verification:
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#source level: no command-interpreter invocation anywhere in the module"
        status: pass
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#a configured oracle path that does not exist is oracle-absent, and the configured value is not echoed back"
        status: pass
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs#the parser rejects over-long input and over-long names, both by an explicit cap"
        status: pass
    human_judgment: false

# Metrics
duration: 25 min
completed: 2026-08-24
status: complete
---

# Phase 19 Plan 04: The Coverage Verb and the Packer Recon Finding Summary

**The coverage instrument became runnable — an eighth `r2000` CLI verb that reads the store through the held session and prints three separately named measures with no aggregate anywhere — and packer identity became a project-owned recon finding whose name field has exactly one assignment site, inside an external oracle's branch.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-24T17:12:00Z
- **Completed:** 2026-08-24T17:37:00Z
- **Tasks:** 2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- **An instrument nobody could run is now runnable.** `vice-mcp r2000 coverage <project>` fetches the symbol list, the comment list, the block listing and the per-label cross-references through `runR2000Tool()` — into `r2000-session.ts`'s single held regenerator2000 child for that project path — and hands them to `buildCoverageReport()`. It adds no child-process site of its own (`grep -Ec 'spawn|exec'` over `r2000-cli.ts` is 0, exactly as before the task), and validates its project argument only through `resolveStorePath()`, the one authoritative resolver.
- **The rendering keeps COV-01's substance at the last place it could be lost.** Three measures print under `MEASURE 1 of 3` / `2 of 3` / `3 of 3` headings with their own numbers, followed by comment vacuity, the dispatch scan and the divergence sub-report under their own headings. The renderer's own doc comment states why nothing is combined here: the ratios measure different populations (labels, comments, sampled addresses) and are not commensurable. A recursive key scan over the written JSON found no key matching `overall|combined|aggregate|composite|score|headline|totalcoverage|percent`.
- **It was exercised against a fixture it was never written against.** The Phase 11 `recon-subject.regen2000proj` was authored for a different phase's sealed-answer-key exercise and played no part in writing the census rules. The live run's byte classes sum to 100 of 100 censused bytes — matching the fixture's decoded payload length of exactly 100 — and the report names origin `$0810`, the fixture's recorded `origin: 2064`. Full stdout is captured verbatim below.
- **The instrument found real disagreements on that unseen subject, which is the point.** Two of five sampled addresses disagree between the bytes route and the store route, and 11 bytes the census reached as instructions are not classified `Code` by the store. Neither is an instrument error: they are what a coverage instrument exists to surface.
- **Every count the eighth verb moves was moved deliberately — and there were four, not the three the plan named.** `R2000_CLI_VERB_FLOOR` 7→8, `REAL_VERBS` gains `coverage`, the `VERB_OPTIONS`/USAGE agreement count 7→8, plus the dispatch switch itself. Each stays hand-maintained, with a comment saying why it is not derived from the parser it tests.
- **SURF-03's honest answer shipped as an honest artifact.** `packer-finding.mjs` is a project-owned skill script with an ordered oracle chain — an external identifier located from `UNP64`/`UNP64_PATH`, then a packedness-only entropy gate against the 7.5 threshold the curated binary-info tool's own description carries, then an explicit unknown. The four rules are structural: exactly one non-null `packer` assignment in the module, exactly one high-confidence assignment, an `unknown` verdict with an empty reason that cannot be constructed at all, and no vocabulary beyond the four verdicts (`grep -Eci 'probably|likely|maybe|percent|%'` returns 0).
- **An absent oracle is a visible skip, never a pass.** The oracle-route test reports `# SKIP` with a reason naming the missing tool and the variable that turns it into a failure. Setting `VICE_REQUIRE_UNP64=1` was demonstrated to make the same run exit 1.
- **Full suite unchanged and green:** 2514 tests, 2469 pass, 0 fail, 40 skipped, 5 todo — exactly the measured pre-plan baseline. `check-skill-tool-coverage.mjs` and `check-npm-packages.mjs` both exit 0; `tsc --noEmit` exits 0.

## Task Commits

1. **Task 1: the coverage verb, the count sites the eighth verb moves, and a live run against an unseen fixture** — `b1b0f16` (feat)
2. **Task 2: the packer recon finding — an ordered oracle chain, a hard unknown, and a proof it never infers a name** — `22c76c2` (feat)

**Plan metadata:** see the `docs(19-04)` commit that follows.

## Files Created/Modified

- `src/mcp/vice/r2000-cli.ts` — `cmdCoverage()`, `parseCoverageArgs()`, `printCoverageReport()`, `queryR2000Json()`, `MAX_COVERAGE_CROSS_REFERENCE_LOOKUPS`, the `coverage` entry in `VERB_OPTIONS`, the USAGE block and the dispatch case.
- `src/mcp/vice/package.json` — `r2000-coverage.ts` added to `files[]`.
- `scripts/lib/r2000-cli-verbs.mjs` — `R2000_CLI_VERB_FLOOR` 7 → 8, doc comment lists the eighth verb and why it exists.
- `src/mcp/vice/r2000-verb-coverage.test.ts` — `REAL_VERBS` gains `coverage` with a comment stating why the registry is frozen and hand-maintained; the two synthetic sources keep their own seven-case shape under a new `SYNTHETIC_FIXTURE_VERBS` constant.
- `src/mcp/vice/r2000-cli.test.ts` — the fourth count site, 7 → 8, plus a `--sample` placeholder so the option is genuinely exercised.
- `src/skills/routine-queue-walker/SKILL.md` — Phase 5: the command from the repo root, when in the queue walk to run it (three times: before Phase 2, at the 2.3 refresh point, and after Phase 4's final save), and how to read the three numbers against each other.
- `src/skills/c64-program-recon/scripts/packer-finding.mjs` (610 lines) — the finding, its oracle chain, the probe, the runner, the defensive parser, the live gate and a command-line entry.
- `src/skills/c64-program-recon/scripts/packer-finding.test.mjs` (282 lines, 17 tests) — the planted violation, the three rule proofs, the parser's four rejection classes, the probe's non-existent-path case, three source-level structural scans, and both halves of the live gate.
- `src/skills/c64-program-recon/SKILL.md` — Step 0.5, between scoping and the entry point, with the command, a four-verdict table and the plain statement that this project does not guess a packer name.

## The live run against the previously-unseen fixture

Command, from the repository root:

```
node src/mcp/vice/vice-proxy.ts r2000 coverage .planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/recon-subject.regen2000proj --out <scratch>/recon-subject-coverage.json
```

Exit code: **0**. Full stdout, verbatim:

```
coverage: /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip/evidence/criterion1/recon-subject.regen2000proj
  origin $0810, 100 byte(s), payload decoded
  schema version 1, generated 2026-08-24T17:21:46.126Z

  MEASURE 1 of 3 -- structural byte census (raw bytes plus the seed set only; the store cannot move it)
    reached-as-instruction : 87
    table-entry            : 0
    referenced-as-data     : 0
    unreached              : 13
    the four classes sum to 100 of 100 censused byte(s)
    linear-sweep decodable : 94 byte(s) -- reported BESIDE the census, never added to it; decodability is not evidence of code
    seeds: 7 ($0810, $082f, $084c, $0850, $0854, $085c, $0864); descent steps 63; truncated: no

  MEASURE 2 of 3 -- label figures (two of them, both printed; neither is folded into the other)
    kind ratio over non-System labels: 4 user / 6 auto -> user fraction 0.400
    auto-prefix names remaining      : 6 at $0002, $0314, $0315, $0839, $0846, $ea31
    System labels excluded           : 0
    disqualified by the multi-caller rule: 3 at $082f, $084c, $0850

  MEASURE 3 of 3 -- sampled reproducibility (the bytes route versus the store route; neither reads the other's input)
    sampled 5, agreed 3, disagreed 2 -> agreement rate 0.600
    sample rule: documented labels sorted ascending by address (population 5), take every 1st (step = ceil(population / sampleSize), sampleSize 8)
    sampled addresses: $0810, $0846, $0854, $085c, $0864
      $0810  bytes=code  store=code  agree
      $0846  bytes=code  store=code  agree
      $0854  bytes=code  store=code  agree
      $085c  bytes=code  store=data  DISAGREE
      $0864  bytes=code  store=data  DISAGREE
    multi-caller labels documented without naming a caller: 4 at $0002, $082f, $084c, $0850

  comment vacuity (its own measure -- kept out of the three above, not averaged into them)
    commented addresses : 6
    distinct comments   : 6 -> distinct-comment ratio 1.000
    graded              : 5 graded, 1 [unknown] -> graded fraction 0.833
    banned-generic      : 0 at none
    near-miss grade token: 0 at none

  indirect-dispatch scan (feeds the census its extra seeds; reported as counts, never graded)
    indirect jumps 0, multi-entry tables 0, split lo/hi tables 0, stack-return dispatch 0
    discovered targets 0, table-entry addresses 0, truncated: no

  divergence sub-report (census versus the store's own block table -- a COMPARISON, not a measure of completeness)
    census reached as instructions but the store does not call Code : 11 byte(s)
    the store calls Code but the census never reached             : 0 byte(s)
    covered by no block entry at all                              : 0 byte(s)
    compared over 100 byte(s)
    KNOWN, NAMED BIAS ON THE STORE SIDE: regenerator2000 auto-merges two adjacent same-type blocks with no boundary marker, and the upstream setter for that marker (its splitter toggle) is not on this project's curated tool surface. An over-merge on the store side is therefore expected and is not evidence of a census error. The census side reads no block data at all.

  per-measure findings (one named measure each -- this list is not a rating and carries no number)
    [labels] user fraction 0.400 is below 0.5
    [labels] 6 label name(s) still carry an auto-name prefix at $2, $314, $315, $839, $846, $ea31
    [reproducibility] 4 multi-caller label(s) documented without naming a caller at $2, $82f, $84c, $850
    [reproducibility] agreement rate 0.600 is below 0.8
    [divergence] 11 byte(s) the census reached as instructions are not classified Code by the store

  Read the numbers against each other, never as one figure: a high user fraction beside a large unreached count means the wrong things were named, and a large divergence means the store and the bytes disagree about what is code.
coverage: wrote <scratch>/recon-subject-coverage.json (schema version 1)
```

**Assertions against the fixture's own recorded facts, checked independently of the run:**

- The four byte classes sum to **100**, which is exactly the fixture's recorded size: `decodeRawData(raw_data_base64)` yields 100 bytes (the on-disk base64 decodes to 123 bytes of gzip, which expands to 100), and the fixture's own block table spans offsets `0..99` inclusive.
- The report names origin **`$0810`**, which is exactly the fixture's recorded `origin: 2064`.
- A recursive key scan over the written JSON report found **no** top-level or nested key matching `overall|combined|aggregate|composite|score|headline|totalcoverage|percent`. Top-level keys are exactly the pinned nine: `schemaVersion, generatedAt, project, structural, dispatch, labels, commentVacuity, reproducibility, divergence`.
- The fixture and every coverage fixture were **byte-unchanged** afterwards (`git status --short` over both paths is empty). A held session calls `ensureProjectSettings()` before reuse, which rewrites a project whose settings need correcting; this fixture already carries `use_illegal_opcodes: true` and `system: "Commodore 64"`, so the idempotent path returned without touching the file. This was checked, not assumed.

A second live run was made first, against a project copied from the `nc5-well-documented` coverage fixture, and also exited 0 — that one reports `0 user / 10 auto` labels and `agreement rate UNAVAILABLE` with the stated reason "no label carries a non-vacuous line comment", which is the correct answer for a fixture whose store data lives beside it rather than inside it.

## The packer finding, run

```
$ node src/skills/c64-program-recon/scripts/packer-finding.mjs <synthetic unpacked file>
{
  "packer": null,
  "verdict": "unpacked",
  "confidence": "MEDIUM",
  "route": "entropy-only",
  "evidence": [
    { "source": "unp64", "available": false, "version": null,
      "reason": "no \"unp64\" packer identifier was found on the search path" },
    { "source": "local-shannon-entropy", "entropy": 0.012150381221219527, "threshold": 7.5 }
  ],
  "checkedAt": "2026-08-24T17:30:16.101Z",
  "unavailableReason": "no name is claimed: the entropy gate places these bytes below its packedness threshold, which is a statement about compression and not about identity"
}
```

The live gate, both halves, demonstrated:

```
$ node --test src/skills/c64-program-recon/scripts/packer-finding.test.mjs
ok 16 - the oracle route reports a name ONLY when a real external oracle stated one # SKIP the oracle-route
   tests are skipped -- no external packer identifier was found (no "unp64" packer identifier was found on
   the search path). Point UNP64 or UNP64_PATH at one, or install "unp64". An absent oracle is an EXPECTED
   SKIP here, never a pass: set VICE_REQUIRE_UNP64 to turn it into a hard failure.
# tests 17 / pass 16 / fail 0 / skipped 1        -> exit 0

$ VICE_REQUIRE_UNP64=1 node --test src/skills/c64-program-recon/scripts/packer-finding.test.mjs
# tests 17 / pass 15 / fail 1 / skipped 1        -> exit 1        (then unset)
```

## Decisions Made

**The coverage verb reuses `runR2000Tool()` rather than opening its own session.** `r2000-memmap-render.ts` — the closest analog, and the one the plan named — already reads the store this way, and `runR2000Tool()` routes into `r2000-session.ts`'s held child for the project path while also passing through `assertCuratedTool()` and `resolveStorePath()`. Calling `runInR2000Session()` directly from the CLI would have saved one mutex acquisition per read at the cost of bypassing the curated-tool assertion. Reads still share ONE child: that is exactly what the D18/Rule A21 seam holds.

**Cross-reference lookups are bounded, and the bound speaks up.** `r2000_get_cross_references` answers one address per call, so an unbounded loop over a fully auto-labelled 64K image would be thousands of round trips. Lookups are limited to the lowest 512 non-System label addresses; System labels are excluded from every label figure already, so paying a round trip for them buys nothing. When the ceiling bites, the report prints a NOTE saying how many of how many were looked up and that the multi-caller count is therefore a floor — COV-02's rule that a partial population must never report as the whole one.

**An undecodable payload exits non-zero; a bad score does not.** A low measurement is a result and exits 0. A payload that would not decode means every byte-side measure was computed over nothing, which is an unusable input rather than a poor one — so the report is printed first (with the reason on screen) and the exit code is 1 afterwards.

**The finding is a skill script, not an `r2000_*` tool.** The `r2000_` prefix asserts "regenerator2000 serves this". No packer-identity tool exists upstream at the pinned version, so an invented name there would be a fabricated upstream tool that `check-skill-tool-coverage.mjs` would then happily resolve as legitimate — the exact class of dishonest surface this repo's fork-honesty gate exists to prevent.

**Entropy may be measured locally, and the evidence entry says which source it came from.** The command-line entry has no live session, so it computes Shannon entropy over the file when `--entropy` is not supplied. The threshold (7.5) is the one the curated binary-info tool's own description carries; the evidence entry records `local-shannon-entropy` versus `r2000_get_binary_info` so the two can never be confused. Entropy still gates packedness only and has no path to the `packer` field.

**The oracle's stdout shape is an assumption, and says so in the file.** The external identifier is not installed here, so `parseUnp64Stdout()`'s accepted marker set is defensive and explicitly recorded as unmeasured in the module header. The env-var convention (`UNP64`, then `UNP64_PATH`) is the verified half. Installing the identifier and running it against a genuinely packed fixture is the experiment that would settle the parse shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] A FOURTH count site the eighth verb moves, which the plan named three of**

- **Found during:** Task 1
- **Issue:** `src/mcp/vice/r2000-cli.test.ts` carries `assert.equal(verbs.length, 7, ...)` over `Object.keys(VERB_OPTIONS)`, in the test that cross-checks `VERB_OPTIONS` against USAGE's own per-verb option lists. The plan's action (d) enumerated three count sites — `R2000_CLI_VERB_FLOOR`, `REAL_VERBS`, and the floor assertion — and this one is a fourth, in a file outside the plan's `files_modified`. Adding the eighth verb turned it red.
- **Fix:** Raised to 8, retitled to "all eight verbs", and given a comment naming it as the fourth count site and stating why it stays a hand-maintained literal (deriving it from `Object.keys(VERB_OPTIONS).length` would assert that a number equals itself). Added a `--sample` placeholder to the sibling test's option-value map so the new option is genuinely exercised rather than silently hitting the missing-value branch.
- **Files modified:** `src/mcp/vice/r2000-cli.test.ts`
- **Verification:** `r2000-cli.test.ts` 65/65, `r2000-verb-coverage.test.ts` 5/5
- **Committed in:** `b1b0f16`

**2. [Rule 3 — Blocking] `r2000-coverage.ts` was absent from `package.json`'s `files[]`**

- **Found during:** Task 1 (anticipated — 19-03's recorded handoff named it)
- **Issue:** `scripts/check-npm-packages.mjs` walks every relative import reachable from `vice-proxy.ts` and requires each to be an exact `files[]` entry. `r2000-cli.ts` importing `r2000-coverage.ts` made it reachable for the first time. `package.json` was outside 19-03's `files_modified`, so it was deliberately left for this plan.
- **Fix:** Added `"r2000-coverage.ts"` to `files[]`, beside the other `r2000-*.ts` entries. This also puts the module inside `r2000-spawn-seam.test.ts`'s derived scanned set (it reads `files[]` and asserts every named entry exists on disk) — the module contains no child-launch call, so the frozen two-entry registry is unchanged.
- **Files modified:** `src/mcp/vice/package.json`
- **Verification:** `node scripts/check-npm-packages.mjs` exits 0 (`@henols/vice-mcp` 75 files); `r2000-spawn-seam.test.ts` passes.
- **Committed in:** `b1b0f16`

**3. [Rule 1 — Bug] My own prose broke the grep gate it was describing**

- **Found during:** Task 1 (acceptance-criteria run)
- **Issue:** Task 1's own criterion is that `grep -Ec 'spawn|exec' src/mcp/vice/r2000-cli.ts` is unchanged (0 before). Three of the comments I wrote to explain that the verb adds no child-process site each used the literal verb, taking the count to 3 — a self-invalidating gate, the exact defect `r2000-spawn-seam.test.ts`'s own "grep-gate hygiene" header describes, and the same shape 19-03 hit with the path-translation module names.
- **Fix:** Reworded all three to describe the property without writing the child-launch verbs out, and stated in the header WHY the verbs are not written out, so a later editor does not "fix" them back and break the check.
- **Files modified:** `src/mcp/vice/r2000-cli.ts`
- **Verification:** `grep -Ec 'spawn|exec' src/mcp/vice/r2000-cli.ts` → 0, matching `git show HEAD~2:src/mcp/vice/r2000-cli.ts | grep -Ec 'spawn|exec'` → 0.
- **Committed in:** `b1b0f16`

### Corrections to the plan's own text

**4. Task 1's acceptance criterion `node src/mcp/vice/r2000-cli.ts coverage --nonsense-flag` cannot exit non-zero as written.** `r2000-cli.ts` has no main guard by design — its header states that the bin, `vice-proxy.ts`, is the only place that ends the process with `runR2000Cli()`'s return value. Running the module directly executes its body and exits 0 for every verb, including the seven that already existed (confirmed: `node src/mcp/vice/r2000-cli.ts verify --nonsense-flag` exits 0 on the pre-task tree). Adding a main guard to satisfy the literal command would have changed a deliberate architectural property to suit a test invocation. The criterion was run through the real entry point instead:

```
$ node src/mcp/vice/vice-proxy.ts r2000 coverage --nonsense-flag
coverage: unknown option "--nonsense-flag" -- not accepted by this verb (accepted: --out, --force, --sample)
[USAGE]
exit 1
```

The substance — the flag and the accepted set are both named, and the refusal happens before the command runs — is satisfied exactly as intended.

**5. The skill's pointer to `19-DECISIONS.md` is a forward reference for one plan.** The plan asked for "a pointer to the dated decision that records why". `19-DECISIONS.md` does not exist yet; 19-05 creates it and also declares `src/skills/c64-program-recon/SKILL.md` in its own `files_modified`. Rather than leave a reader in the gap with a dangling path (the FLOW-02 defect class), the sentence names `19-RESEARCH.md` §2 — which exists today and carries all four proofs — first, and `19-DECISIONS.md` in the same directory second. No mechanical guard scans skill files for dangling planning paths, so nothing is red either way; this is recorded so 19-05's author knows the pointer is already placed.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug), plus 2 recorded corrections to the plan's own text.
**Impact on plan:** No scope creep. Two files outside `files_modified` were touched — `src/mcp/vice/package.json` (19-03's explicit handoff) and `src/mcp/vice/r2000-cli.test.ts` (the fourth count site) — both strictly required to land the eighth verb without leaving a red gate behind.

## Threat Flags

None. The coverage verb adds no network endpoint, no auth path and no schema change; it opens no child process of its own and writes only the file the caller names with `--out`, behind the existing overwrite refusal. The packer finding's own new surface — an optional external subprocess and its stdout — is exactly what `<threat_model>`'s T-19-18/T-19-19/T-19-23/T-19-24 already cover, and each mitigation is asserted by a named test rather than stated.

## Known Stubs

None. One recorded ASSUMPTION, which is not a stub: `parseUnp64Stdout()`'s accepted marker set is written against an oracle that is not installed here. The module header records it as unmeasured, the oracle-route test skips visibly rather than passing, and the re-open trigger (install the identifier, build a genuinely packed fixture, confirm the name and the confidence flip) is named in the header.

## Issues Encountered

- **`r2000_get_cross_references` is one address per call.** There is no bulk form on the curated surface, so the coverage verb loops. The bound (512 non-System labels) and its printed NOTE are the answer; a bulk cross-reference read would be the better one if a later phase adds it.
- **Node's `--input-type=module` must precede `-e`.** The plan flagged this and it holds: placed after the script string it is consumed as a positional argument, the snippet runs as CommonJS, and the top-level `await` is a SyntaxError. Both runs of the criterion used the correct order.
- **`check-npm-packages.mjs` runs the installer's `prepack`,** which re-syncs `installer/skills/`. That is expected and left nothing dirty in git; the exclusion count moved 5 → 6 as the new colocated test file was correctly kept out of the tarball, and the installer package moved 33 → 34 files as `packer-finding.mjs` was correctly included.

## User Setup Required

None required. Two optional environment variables are now recognised, both no-ops when unset:

- `UNP64` / `UNP64_PATH` — an absolute path to an external packer identifier. Setting either enables the oracle route, which is the only route that can ever report a packer name.
- `VICE_REQUIRE_UNP64` — turns an absent oracle from a visible skip into a hard test failure. Deliberately NOT set in CI, by the `VICE_REQUIRE_R2000` precedent: absence is an expected skip there, forever, by design.

## Next Phase Readiness

**Ready for 19-05.** Three concrete handoffs:

1. **`19-DECISIONS.md`'s packer-identity entry already has a reader.** `src/skills/c64-program-recon/SKILL.md` points at it (and at `19-RESEARCH.md` §2 alongside). 19-05 owns both files; the acceptance bar to record is the one this plan implemented — a name only when an oracle stated one — and the named re-open trigger is installing the external identifier and confirming the parse shape against a genuinely packed fixture.
2. **The skill corpus is now seven directories and grew two files.** `check-skill-tool-coverage.mjs` reports 33 files across 7 skill directories (was 31). 19-05's description-overlap threshold is set against the seven `SKILL.md` frontmatter blocks, which this plan did not touch — only body prose changed, in `routine-queue-walker` and `c64-program-recon`.
3. **The verb count is 8 and lives in four places.** Any later phase adding a ninth verb must move all four: the dispatch switch, `R2000_CLI_VERB_FLOOR`, `REAL_VERBS`, and `r2000-cli.test.ts`'s `VERB_OPTIONS` length assertion. All four now carry comments saying so.

Phase 20's decomposition sweep can drive the instrument from the command line with `--out` and read `COVERAGE_SCHEMA_VERSION = 1` off the written report.

## Self-Check: PASSED

- Both created files verified present on disk (`packer-finding.mjs` 610 lines ≥ 120 required; `packer-finding.test.mjs` 282 lines ≥ 80 required); `cmdCoverage` present in `r2000-cli.ts`.
- Both task commits verified present in `git log`: `b1b0f16`, `22c76c2`. Neither commit deletes a tracked file.
- Every Task 1 and Task 2 acceptance criterion re-run and passing (the one exception, criterion `node src/mcp/vice/r2000-cli.ts coverage --nonsense-flag`, is documented as deviation 4 and was satisfied through the real entry point).
- Plan-level verification block re-run in full: `check-skill-tool-coverage.mjs` exit 0 (8 verbs parsed, 8/8 resolved), `check-npm-packages.mjs` exit 0, `r2000-verb-coverage.test.ts` + `r2000-cli.test.ts` + `r2000-spawn-seam.test.ts` + `ci-suite-coverage.test.ts` 94/94, `packer-finding.test.mjs` 16 pass / 1 visible skip, `tsc --noEmit` exit 0, `npm test` (the FULL suite, never the automated subset) 2514 tests / 2469 pass / 0 fail.
- The live coverage run against the previously-unseen Phase 11 fixture exited 0, its stdout is captured verbatim above, and its byte-class sum and origin were checked independently against the fixture's own recorded values.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-24*
