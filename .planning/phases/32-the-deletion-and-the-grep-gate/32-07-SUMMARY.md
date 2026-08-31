---
phase: 32-the-deletion-and-the-grep-gate
plan: 07
subsystem: testing
tags: [guard-fates, mutation-harness, observed-red, non-vacuity, audit, node-test, tsc, timeout]

requires:
  - phase: 32-01
    provides: "scripts/audit-mutation-harness.mjs (plant / green-control / capture / restore), scripts/check-guard-fates.mjs, the registry and its row schema"
  - phase: 32-02
    provides: "evidence/32-root-override-inventory.md and the --root additions to six repo-level guards"
  - phase: 32-06
    provides: "the 15 renamed rows, the row shape, and the two recorded harness caveats (--run unusable; 15s timeout too short)"
provides:
  - "21 new rows in guard-fates.json covering every set-A member that survived under its ORIGINAL path"
  - "18 machine-captured observed reds, each paired with a green exit-0 unplanted control"
  - "3 kept-unchanged rows with a recorded existence proof and a stated removal trigger, owing no observedRed"
  - "evidence/32-sweep-same-path-rows.md -- 3965 lines: preconditions, measured runtimes, findings, then the harness's verbatim per-row both-leg record"
  - "A measured resolution of the vice-proxy.test.ts landmine: the file does not terminate at 300106ms, its obvious scope is red UNPLANTED, and a third scope is measurable"
  - "Two findings: audit-gate.mjs --json cannot report a structural error through its exit status; DOCS_GUARD_FLOOR is 7 against 9 guards on disk"
affects: [32-08, 32-09, guard-fates-registry, audit-mutation-harness, audit-gate]

actuals:
  tokens: 74956
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Measure every candidate guard's UNPLANTED runtime against the harness's timeout BEFORE designing any plant -- a timeout maps to status 1 and is a false red"
    - "Scope a slow or non-terminating guard with --test-name-pattern to the assertion its plant targets, and re-measure the scoped control green before use"
    - "For a same-path member the red must name the member; for a renamed one it must not -- the two directions are opposite checks"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-same-path-rows.md
  modified:
    - .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
    - .planning/WINDOWS.md

key-decisions:
  - "Followed the guard's derivation over the plan's table: the same-path group is 21 and r2000-upstream-audit.test.ts is in `gone`, so it was NOT claimed here and is handed to plan 32-08 by name."
  - "vice-proxy.test.ts was NOT recorded UNMEASURABLE-LOCALLY. Three scopes were measured; the third is genuinely measurable behind a green control, so the row carries a real observed red and the hang is recorded as a finding instead of as a verdict."
  - "Every plant is `kind: worktree`. The harness implements no other kind, so the four rows the plan routes through a `--root` synthetic tree are planted in the working tree instead, with the substitution stated in each row's note."
  - "Two rows needed a second plant. Both attempts are recorded in the row note and in the evidence; neither guard was weakened and neither row was reclassified."
  - "The plan's Task-2 verify threshold of 34 re-pointed rows is stale by the same off-by-one plan 32-06 already corrected (15 renamed, not 16). Re-anchored to 33 = 15 + 18 and recorded, rather than inflating the registry to satisfy the assertion."

patterns-established:
  - "Pattern 1: probe rows through the harness ONE AT A TIME first. The harness skips its registry write-back for the WHOLE run if any single row is unmeasurable or exits 0, so a batch-first sweep loses every good row's evidence to one bad one."
  - "Pattern 2: when a plant does not bite, diagnose the CAUSE before changing the plant -- twice here the plant was correct and the guard INVOCATION or the guard SCOPE was wrong, which a blind second plant would have hidden."
  - "Pattern 3: a plant that can only ever produce a green is not a plant. disasm-roundtrip.test.ts's re-pointed seam gates its own tests behind a SKIP, so planting it yields exit 0; the row plants the round-trip subject instead and says why."

requirements-completed: [CUT-04]

coverage:
  - id: D1
    description: "All 21 same-path set-A members are classified by a recorded mechanical rule, not by judgement: 18 re-pointed / 3 kept-unchanged"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "per member, `git diff -U0 0394cbc 345d5c4 -- <path> | grep -E '^[+-]' | grep -av '^[+-][+-][+-]' | grep -aic r2000` -- 18 non-zero / 3 zero; the command is re-run by the row-authoring script and quoted in every row's note"
        status: pass
      - kind: automated
        ref: "deriveAuditedSet({root}).forwardSamePath -- 21 members, matching the plan's enumeration exactly"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 18 re-pointed same-path guards observed exiting non-zero against their new subject, each behind a green exit-0 unplanted control"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "node scripts/audit-mutation-harness.mjs --rows <18 registry-derived historicalPaths> --out evidence/32-sweep-same-path-rows.md -- `measured 18 row(s)`, 18 x OBSERVED RED, 0 x UNMEASURABLE, 0 x ZERO-EXIT, harness exit 0"
        status: pass
      - kind: automated
        ref: "registry predicate: every re-pointed row has an integer non-zero observedRed.exitStatus, non-empty command/excerpt, and control.exitStatus === 0 -- 33 rows pass, 0 fail"
        status: pass
    human_judgment: false
  - id: D3
    description: "No recorded red is timeout-derived -- the 15s-timeout-to-status-1 false red is excluded per row, by construction"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "every candidate guard timed UNPLANTED under a 90s-300s bound before any plant was designed (table in evidence section 2); the two that exceeded 15000ms were scoped and re-measured green"
        status: pass
      - kind: automated
        ref: "structural argument, checked per row: a control that timed out cannot exit 0, and all 18 controls exited 0 on the identical command that later produced the red"
        status: pass
    human_judgment: false
  - id: D4
    description: "vice-proxy.test.ts's local behaviour is recorded as measured -- not omitted, not laundered into a red"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "unscoped `node --test vice-proxy.test.ts` TIMEOUT at 300106ms against a 300000ms bound; scope A (`tools/list's full output matches the manifest exactly`) terminates but its UNPLANTED control exits 1 with 58 stock tools vs the 80-name fork manifest; scope B (`tools/list survives a missing or corrupt snapshot`) control exit 0 at 4562ms, planted exit 1 at 1162ms"
        status: pass
    human_judgment: true
    rationale: "The three measurements are mechanical, but the JUDGEMENT that scope B answers CUT-04's question -- that a red on one of the two re-pointed `...CURATED_ANNO_TOOLS` spreads is adequate evidence for the member, given the file as a whole cannot be run -- is a scoping call a human should confirm."
  - id: D5
    description: "The 3 kept-unchanged members carry newSubject === historicalPath, a recorded existence proof and a stated removal trigger, and owe no observedRed"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "per row: path present on the working tree, plus the recorded `git diff --quiet 0394cbc 345d5c4 -- <path>` exit (0, 1, 0); registry predicate confirms no kept-unchanged row carries an observedRed"
        status: pass
    human_judgment: false
  - id: D6
    description: "The tree is byte-identical to its pre-run state and every gate is green"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "harness self-report `tree: restored byte-identical to the baseline`; git status --porcelain over tracked non-.planning paths empty; git diff --exit-code -- docs/tool-support.md exit 0"
        status: pass
      - kind: automated
        ref: "all six CI check scripts exit 0; node scripts/audit-gate.mjs --json reports allowed=true redGuards=[] structuralErrors=[]; cd src/mcp/vice && npm run typecheck exit 0"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && npm run test:automated -- 2950 tests, 2943 pass, 1 fail (the pre-existing worktree-only repo-root.test.ts artifact, deferred-items.md section 1)"
        status: fail
    human_judgment: true
    rationale: "The suite is NOT at 0 failures in this worktree, so the plan's must-have truth is not literally met. The single failure is the known worktree-only repo-root.test.ts artifact, independently verified 0-fail in the main checkout after every prior wave, and it cannot have contaminated any red. A human should confirm that reading rather than have this plan self-certify it."
  - id: D7
    description: "Two findings against instruments this plan is forbidden from modifying: audit-gate.mjs --json cannot signal a structural error through its exit status, and DOCS_GUARD_FLOOR is 7 against 9 guards on disk"
    verification:
      - kind: automated
        ref: "measured: floor plant 7->8 under --json exits 0 with the breach inside structuralErrors; the same plant at 7->10 in text mode exits 1 naming the assertion. Recorded in .planning/WINDOWS.md as a `deviation` entry against scripts/audit-gate.mjs:1210"
        status: pass
    human_judgment: true
    rationale: "Whether audit-gate.mjs's --json exit contract should be changed is a decision outside this plan's remit -- this plan measures and records only. It also needs a human to decide whether any existing caller depends on the current behaviour."

duration: 54min
completed: 2026-08-31
status: complete
---

# Phase 32 Plan 07: The Same-Path Sweep Summary

**All 18 re-pointed set-A guards that survived under their original path observed exiting non-zero against their new subjects behind green exit-0 controls, with every guard's unplanted runtime measured against the harness's 15s bound first — including `vice-proxy.test.ts`, which does not terminate at 300106ms unscoped and was made measurable rather than recorded unmeasurable.**

## Performance

- **Duration:** 54 min
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)
- **Commits:** 3

## Accomplishments

- **21 new registry rows**, taking `guard-fates.json` from 15 to **36**. Every set-A member that survived under its original path now has a fate.
- **18 observed reds in one sweep.** Zero UNMEASURABLE, zero ZERO-EXIT in the final run, tree restored byte-identical. Every red is an integer non-zero exit captured by `spawnSync` and preceded by an unplanted control that exited 0 on the identical command.
- **The timeout landmine was defused by measurement, not by luck.** Every candidate guard was timed UNPLANTED before any plant was designed. Two exceeded the harness's 15000 ms bound and would have produced **false observed reds**: `audit-integrity.test.ts` (21483 ms) and `vice-proxy.test.ts` (non-terminating). Both were scoped and re-measured green.
- **`vice-proxy.test.ts` resolved honestly, and better than the plan expected.** It is measurable — but only after two other routes were measured and rejected on the record.
- **3 `kept-unchanged` rows** with a recorded existence proof and a stated removal trigger, and deliberately **no** `observedRed`.
- **`evidence/32-sweep-same-path-rows.md`** — 3965 lines. A preconditions-and-findings header, then the harness's verbatim per-row record of both legs.
- **Two findings against `scripts/audit-gate.mjs`**, produced by using it as a mutation target for the first time.

## Task Commits

1. **Task 1: classify the 21 and author the eight `scripts/` descriptors** — `fa74f47` (docs)
2. **Task 2: the ten test-row descriptors and the three kept-unchanged triggers** — `95e9b0c` (docs)
3. **Task 3: the sweep, the 18 observed reds and the raw evidence** — `d68ec96` (docs)

## The classification, measured

The rule, run per member and quoted in every row's note:

```
git diff -U0 0394cbc 345d5c4 -- <path> | grep -E '^[+-]' | grep -av '^[+-][+-][+-]' | grep -aic r2000
```

**18 `re-pointed` / 3 `kept-unchanged`** — exactly the plan's prediction, and the three `kept-unchanged` are exactly the three it named: `scripts/lib/skill-descriptions.mjs`, `src/mcp/vice/skill-attribution.test.ts`, `src/mcp/vice/stock-connect.test.ts`.

Match counts ranged from 1 (`skill-corpus.d.mts`, `skill-descriptions.d.mts`, `skill-honesty-checks.mjs`, `audit-integrity.test.ts`) to 56 (`check-skill-tool-coverage.mjs`).

**Three of the 18 are comment-only re-pointings.** For `scripts/lib/skill-corpus.d.mts`, `scripts/lib/skill-descriptions.d.mts` and `scripts/lib/skill-honesty-checks.mjs` the single subject-naming line the rule matched is a header cross-reference, not an assertion — two of them are declaration files with no assertion to re-point at all. The rule's verdict stands and each row's note says plainly that the plant targets the only mechanically observable property such a member has, rather than an assertion Phase 29 moved.

## The 18 rows and what each plant trips

| historical path | plant | guard | red |
|---|---|---|---|
| `scripts/audit-gate.mjs` | `DOCS_GUARD_FLOOR` 7→10 | `node scripts/audit-gate.mjs` | 1 |
| `scripts/check-npm-packages.mjs` | `package.json` `files[]`: `anno-cli.ts`→`anno-cliX.ts` | `node scripts/check-npm-packages.mjs` | 1 |
| `scripts/check-skill-fork-honesty.mjs` | expected pointer `anno export-asm`→`…ZZ` | `node scripts/check-skill-fork-honesty.mjs` | 1 |
| `scripts/check-skill-tool-coverage.mjs` | SKILL.md `anno_set_comment`→`anno_set_commentary` | `node scripts/check-skill-tool-coverage.mjs` | 1 |
| `scripts/generate-tool-support-table.mjs` | its `ANNO_LOOP_VAR_RE` → a nonexistent collection | `node --test --test-name-pattern 'byte-identical to committed' tool-support-table.test.mjs` | 1 |
| `scripts/lib/skill-corpus.d.mts` | drop the `walkSkills` declaration | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | 1 |
| `scripts/lib/skill-descriptions.d.mts` | drop the `expectedPairCount` declaration | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | 1 |
| `scripts/lib/skill-honesty-checks.mjs` | invert `fileClaimViolations`'s `required` branch | `node scripts/check-skill-fork-honesty.mjs` | 1 |
| `audit-integrity.test.ts` | `audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` entry misspelt | `node --test --test-name-pattern 'registry-drift detector' audit-integrity.test.ts` | 1 |
| `capability-registry.test.ts` | `vice-proxy.ts` anno loop var `annoDef`→`annoDefX` | `node --test capability-registry.test.ts` | 1 |
| `disasm-roundtrip.test.ts` | `disasm-renderer.ts` word hex `padStart(4`→`padStart(5` | `node --test disasm-roundtrip.test.ts` | 1 |
| `docs-dangling-refs.test.ts` | `anno-cli.ts` overwrite-refusal literal, one char | `node --test docs-dangling-refs.test.ts` | 1 |
| `hop-chain-comments.test.ts` | shift `absorbed-answer-key.test.ts`'s control line 34→35 | `node --test hop-chain-comments.test.ts` | 1 |
| `hostpath-consumers.test.ts` | give `anno-store.ts` a `./hostpath.ts` import | `node --test hostpath-consumers.test.ts` | 1 |
| `skill-acme-build-cli.test.ts` | `acme-gate.ts` `ACME_BIN` default `acme`→`acmeZZ` | `node --test skill-acme-build-cli.test.ts` | 1 |
| `stock-dispatch.test.ts` | a `forwardToVice` token inside `runAnnoTool`'s body | `node --test stock-dispatch.test.ts` | 1 |
| `tool-support-table.test.mjs` | its own `ANNO_LOOP_VAR_RE` witness → a nonexistent collection | `node --test --test-name-pattern 'derived-union equality' tool-support-table.test.mjs` | 1 |
| `vice-proxy.test.ts` | `CURATED_ANNO_TOOLS` derivation suffixed | `node --test --test-name-pattern 'tools/list survives a missing or corrupt snapshot' vice-proxy.test.ts` | 1 |

Every control exited 0.

**Where each red was observed.** For a same-path member `newSubject === historicalPath`, so — unlike plan 32-06's renamed rows, where a red naming the historical path would mean the red was observed against the DEAD subject — a red naming the member is exactly right here. Measured: **14** reds were observed by running the member itself; **4** through a consuming gate, because the member is a library or generator with no CLI of its own (`generate-tool-support-table.mjs`, `skill-corpus.d.mts`, `skill-descriptions.d.mts`, `skill-honesty-checks.mjs`) — precisely the routing `evidence/32-root-override-inventory.md` §2.1 tabulates.

## The `vice-proxy.test.ts` landmine, resolved

The plan's own must-have anticipated a `UNMEASURABLE-LOCALLY` outcome. Three measurements were made and the third is a real observed red, so the row carries evidence and the hang is recorded as a finding rather than promoted to a verdict.

1. **The unscoped file does not terminate.** `node --test vice-proxy.test.ts` was given a deliberately generous **300000 ms** bound and was still running when killed at **300106 ms** — twenty times the harness's 15000 ms limit. Under the harness this becomes status 1, exit-status-indistinguishable from a failing assertion. It is recorded as a timeout everywhere and as a red nowhere.
2. **The obvious scope is red UNPLANTED.** `--test-name-pattern "tools/list's full output matches the manifest exactly"` — which carries one of the re-pointed `...CURATED_ANNO_TOOLS` spreads — terminates in 1665–2095 ms but its unplanted control **exits 1**: the wire surface answers with **58** tools (the stock set) against an expectation of the **80**-name fork manifest. Red for a backend reason, with no plant present. Under the green-control rule that is UNMEASURABLE; it was discarded, and the raw output is in the evidence.
3. **A third scope is measurable.** `"tools/list survives a missing or corrupt snapshot"` reads the other two re-pointed spreads (`:603`, `:621`). Control exit 0 at 4562 ms; planted exit 1 at 1162 ms; the captured diff names all 19 curated tools with and without the planted suffix.

**What CI's green proves, in words.** CI runs the full `npm test` glob (`.github/workflows/ci.yml:130-161`, decided from run 32517575905, 2026-08-21), which includes this file, and on the runner it reaches its default-SKIP branch. So CI's green proves the nine `MANUAL_ONLY_TESTS` **DID NOT FAIL** — it does not prove they exercised anything. A green from a skipped test and a green from a passing test are the same colour and different facts.

**The hang was not debugged.** `ROADMAP.md` states this phase contains no build work by design and `32-CONTEXT.md` lists diagnosing it as a deferred idea. One observation is recorded without acting on it: every scoped run prints `after() force-closed 0 leaked server(s) and killed 1 leaked child(ren)`, so a leaked child is present even in a run that completes.

## `r2000-upstream-audit.test.ts` — explicitly NOT claimed here

Plan 32-06 suggested this plan might have to take it. **It does not, and no row was created for it.** The guard's own forward map places it in `forwardGone`, not `forwardSamePath`: `nameDescendantCandidates()` yields three candidates, none of which exists at `AUDIT_END`, and git's `-M` heuristic does not score it. It is owed to **plan 32-08** as a `deleted` or `superseded` verdict, together with the rest of the `gone` group:

`r2000-launch.test.ts`, `r2000-mcp-client.test.ts`, `r2000-project.test.ts`, `r2000-session.test.ts`, `r2000-symbol-roundtrip.test.ts`, **`r2000-upstream-audit.test.ts`**, `r2000-verify.test.ts`.

## Registry row count, before and after

- **Before:** 15 rows (plan 32-06). **After:** **36** rows — 33 `re-pointed`, 3 `kept-unchanged`. Verified against the guard's own summary line: `rows=36`.
- **This plan added 21.** No `historicalPath` and no `newSubject` is duplicated — the guard checks both directions and reports neither.
- `check-guard-fates.mjs` remains red **as pre-declared**, and its output is now **exactly 25** `no recorded fate` lines and nothing else — down from 46. Mechanically decomposed: **16** set B + **7** `gone` + **2** set C = 25, with **0** same-path and **0** renamed remaining.

## Decisions Made

1. **The derivation beat the table, again.** The same-path group was taken from `deriveAuditedSet().forwardSamePath` (21 members), never from the plan's enumeration — which happened to agree exactly. The `renamed`/`gone` split (15/7, not 16/6) is likewise the derivation's, confirming plan 32-06's correction. No floor was moved; the forward-map split is descriptive.

2. **Rows were probed one at a time before the batch sweep.** The harness skips its registry write-back for the WHOLE run if any single row comes back unmeasurable or exits 0 (`main()`'s `if (!hardFailure)` guard). A batch-first sweep would have lost 16 good rows' evidence to the two plants that did not bite. Per-row probing found both, they were fixed, and a single `--rows` run then produced one coherent evidence document.

3. **`--rows`, never `--all`.** The selector was built by filtering the registry against the guard's derivation. `--all` would have re-measured plan 32-06's 15 rows for no new information.

4. **Every plant is `kind: "worktree"`.** The plan routes `audit-gate.mjs`, `generate-tool-support-table.mjs`, `check-skill-tool-coverage.mjs` and `check-skill-fork-honesty.mjs` through a `--root` synthetic tree per the inventory. The harness's `plant()` implements only `worktree` and throws on anything else, so all four are working-tree plants and each row's note records the substitution. No fixture tree was built, nothing was added under the `src/mcp/vice/fixtures/planted-` prefix (exact `prefixHits: 2` pin), and `mktemp -d` was never used as a `--root`.

5. **`docs/tool-support.md` was never planted into.** The generator's row plants the generator's own source and its guard generates **in memory**; the CLI that writes the file is never invoked. `git diff --exit-code -- docs/tool-support.md` exits 0.

## Deviations from Plan

### 1. [Rule 3 — Blocking] `scripts/audit-gate.mjs`'s first plant did not bite — two causes, both measured

- **Found during:** Task 3, per-row probe.
- **Issue:** plant `DOCS_GUARD_FLOOR = 7` → `8` under `node scripts/audit-gate.mjs --json` returned ZERO-EXIT. (a) The gate reports **9** docs guards on disk while the floor is pinned at **7**, and the assertion is `>=`, so `9 >= 8` still held. (b) More importantly, the `--json` branch ends `process.exit(result.allowed ? 0 : 1)` (`:1210`) and `allowed` tracks GATED AUDITS — a structural error is reported inside the JSON payload's `structuralErrors` array while the process exits 0. The text-mode branch does exit 1 on the same condition (`:1213-1218`).
- **Fix:** same file, same relation, floor → `10` and `--json` dropped. Control exit 0 (`audit-gate: OK -- 9 docs guards green`), planted exit 1 (`audit-gate: FAIL -- only 9 docs-*.test.ts guard(s) found ... (>= 10 required)`). Both attempts are in the row's note and in the evidence.
- **Verification:** `OBSERVED RED … guard exit status 1 (control exit status 0)`.
- **Committed in:** `d68ec96`.
- **Standing finding:** recorded in `.planning/WINDOWS.md` as a `deviation` against `scripts/audit-gate.mjs:1210`. Any caller treating `audit-gate.mjs --json`'s exit status as a structural-health check is reading a signal that cannot go non-zero for a structural error. No script was modified — this plan measures.

### 2. [Rule 3 — Blocking] `vice-proxy.test.ts`'s first scope did not bite

- **Found during:** Task 3, per-row probe.
- **Issue:** the scope `"tools/list reads the committed snapshot with no emulator"` consumes the re-pointed expression only as a **length** (`:540-544`). Suffixing every derived name changes no count, so both sides moved together and the assertion stayed true. The two deep-equals over the name list live in the next test.
- **Fix:** the plant was kept byte-identical and the scope moved to `"tools/list survives a missing or corrupt snapshot"`.
- **Verification:** control exit 0 / planted exit 1, with the captured diff naming all 19 curated tools both ways.
- **Committed in:** `d68ec96`.

### 3. [Rule 3 — Blocking] The harness's `["--run","typecheck"]` convention is still unusable

- **Found during:** Task 1, the two `.d.mts` rows.
- **Issue:** `resolveBin()` maps `argv[0] === "--run"` to the npm client, producing `npm --run typecheck`, which npm rejects.
- **Fix:** both rows use `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` with `cwd: src/mcp/vice` — byte-for-byte what the `typecheck` script runs — reaching the harness through its other documented convention. Identical to plan 32-06's workaround; no script modified.
- **Committed in:** `fa74f47`.
- **Standing finding:** this remains the only one of the harness's three documented argv conventions never successfully exercised. Two consecutive plans have now routed around it.

### 4. [Rule 3 — Blocking] A second guard exceeds `GUARD_RUN_TIMEOUT_MS`

- **Found during:** Task 2 design, from the up-front runtime measurement.
- **Issue:** `node --test audit-integrity.test.ts` takes **21483 ms** against the harness's 15000 ms bound. Unscoped, its control would have timed out and the row would have come back UNMEASURABLE — or worse, a timeout could have been banked as a red.
- **Fix:** scoped with `--test-name-pattern "registry-drift detector"`, the one assertion the plant targets. Runtime **1525 ms**.
- **Committed in:** `95e9b0c`.
- This is the second instance (plan 32-06 recorded `anno-cli.test.ts` at 20596 ms) and `vice-proxy.test.ts` is the third and worst.

### 5. [Correction, pre-authorised by the plan] The Task-2 verify threshold was stale

- The plan's Task-2 `<automated>` command asserts `rp.length >= 34` ("16 renamed from plan 32-06 plus these 18"). Plan 32-06 delivered **15** renamed rows, not 16 — the same off-by-one it had already measured and corrected — so the real figure is 15 + 18 = **33**. The command was run as written (exit 1, `re-pointed rows: 33`), then re-anchored to 33 and re-run (exit 0). Inflating the registry to satisfy the assertion would have been the exact failure the guard exists to catch.

### 6. [Scope choice, recorded] `disasm-roundtrip.test.ts` is planted at its subject, not at its re-pointed seam

- The line Phase 29 re-pointed in this file is its import of the ACME availability seam (`./r2000-test-gate.ts` → `./acme-gate.ts`). Planting that seam makes this guard **green, not red**: `ACME_BIN` feeds `probeAcme()`, whose result gates every ACME-dependent test behind `{ skip: SKIP_REASON }`, so a broken seam SKIPS the file to exit 0. That is the silent skip-degradation `acme-gate.ts`'s own header names as its reason for existing. The row plants the round-trip subject (`disasm-renderer.ts`) instead and states the reason.
- The same mutation IS a red for `skill-acme-build-cli.test.ts`, whose `:288-290` asserts the seam's value in a never-skipped test. That asymmetry is why the two rows do not share a plant, and is itself evidence the re-pointed seam is load-bearing.

---

**Total deviations:** 6 (4 blocking auto-fixes routed around without modifying any script, 1 pre-authorised threshold correction, 1 recorded scope choice).
**Impact on plan:** No scope creep. Three of the six are findings *about the instruments*, which is what a sweep at scale is for. Nothing was weakened, reclassified or exempted.

## Issues Encountered

- **`npm ci` was required** inside the worktree before `tsc` would resolve (`node_modules` absent). Installed from the committed lockfile at `src/mcp/vice`; nothing new was added.
- **`test:automated` reports 1 failure**, `repo-root.test.ts` — `the agreed directory must not sit under .claude`, which is true of every GSD worktree root by construction. The known artifact in `deferred-items.md` §1, verified 0-fail in the main checkout after each prior wave. Not caused here, not fixed, not loosened. It did **not** contaminate any observed red: every guard in this sweep runs a single named file or script, none of which is `repo-root.test.ts`, and every red is bracketed by its own green control on the identical command. See the Known Stubs section — the plan's must-have truth as literally written is not met in a worktree.
- **One empty `.planning/vice-proxy-evidence-test-wKSMT8/` leaked** from a `vice-proxy.test.ts` run and was removed with `rmdir`. Because it is empty, `git status --porcelain` never reported it — git does not track empty directories — so it had to be looked for by name rather than trusted to appear in the porcelain diff. No `.planning/vice-proxy-evidence-test-*` remains.

## Threat surface

No new network endpoints, auth paths, file-access patterns or trust-boundary schema changes. The plan's register (T-32-28 … T-32-SC) is satisfied as designed:

- **T-32-28** (a timeout recorded as a red): every red is gated by a green exit-0 control on the identical command, every captured output names a failing assertion, and both slow guards were measured and scoped before use rather than discovered as reds.
- **T-32-29** (a plant against `docs/tool-support.md`): the generator's guard generates in memory; the writing CLI is never invoked; `git diff --exit-code -- docs/tool-support.md` exits 0.
- **T-32-30** (moving the removal gate's exactly-2 pin): no plant touches the subject literal; `node scripts/check-no-regenerator2000.mjs` exits 0 after the sweep.
- **T-32-31** (a failed restore of a scanned normative document): the `docs-dangling-refs` plant targets `anno-cli.ts`, a source file, not `.planning/ROADMAP.md` or `CLAUDE.md`; the harness captured original bytes first and reported the tree byte-identical.
- **T-32-32** (tearing down the broker unit): broker state was read-only asserted with `systemctl --user is-active` and bracketed `pgrep -af '[v]ice-broker'`, and recorded. Nothing was stopped or started.
- **T-32-SC**: no packages were installed. `npm ci` restored the committed lockfile only; the only other npm-adjacent invocation is `tsc`, run directly as a guard.

## Known Stubs

No stub, placeholder or TODO was introduced, and no `<verify>` went unrun — every `<automated>` command in the plan was re-anchored to this worktree root and executed, with its real output recorded.

One **unmet must-have truth**, stated plainly rather than glossed:

| item | detail |
|---|---|
| `npm run test:automated` exits 0 with 0 failures | **NOT met in a worktree.** 2950 tests, 2943 pass, **1 fail** — `repo-root.test.ts`'s `path agreement (D-3, D-6, …)`, which asserts the agreed directory is not under `.claude` and is therefore false in every GSD worktree by construction. Recorded in `deferred-items.md` §1 and independently verified 0-fail in the main checkout after each prior wave. Not caused, not fixed, not loosened here; it cannot have contaminated any observed red. |

One finding recorded to `.planning/WINDOWS.md` (`deviation`, `scripts/audit-gate.mjs:1210`): the `--json` exit status cannot report a structural error.

## Next Phase Readiness

**Ready.** Plan 32-08 (the `gone` group) inherits:

- A registry at **36** rows with a settled shape; copy any same-path `re-pointed` row as the schema reference.
- **25 members still owe a row**, and the composition is now proven mechanically: 16 set B + 7 `gone` + 2 set C, with zero same-path and zero renamed remaining. Use `node scripts/check-guard-fates.mjs`'s own output as the work list; do not transcribe one.
- **The `gone` group is 7, and `r2000-upstream-audit.test.ts` is in it** — named above, not claimed here. A `deleted` verdict owes `newSubject: null`, the historical path absent from the working tree, and a `removingCommit`; it owes no `observedRed`.
- **Three harness caveats that will bite again:** `["--run", …]` is unusable; any guard slower than 15000 ms records a false red unless scoped; and only `kind: "worktree"` plants exist.
- **A new caveat specific to `--root` guards:** `audit-gate.mjs --json` cannot signal a structural error through its exit status. If plan 32-08 or 32-09 uses that invocation as a health check, use text mode.
- Do NOT re-run `--all`: 33 rows are measured and would be re-measured for no new information.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-08-31*

## Self-Check: PASSED

All three artifacts exist on disk (`32-07-SUMMARY.md`, `evidence/32-sweep-same-path-rows.md`,
`guard-fates.json`); all four commits (`fa74f47`, `95e9b0c`, `d68ec96`, `6ca0bd4`) resolve in
`git log`; the registry holds 36 rows; `git status --porcelain` is empty; `git diff
--diff-filter=D dc26a11..HEAD` reports no deletions.
