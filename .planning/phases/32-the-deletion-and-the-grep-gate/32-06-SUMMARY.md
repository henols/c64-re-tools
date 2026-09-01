---
phase: 32-the-deletion-and-the-grep-gate
plan: 06
subsystem: testing
tags: [guard-fates, mutation-harness, observed-red, non-vacuity, audit, node-test, tsc]

requires:
  - phase: 32-01
    provides: "scripts/audit-mutation-harness.mjs (plant / green-control / capture / restore), scripts/check-guard-fates.mjs, the registry and its tracer row"
  - phase: 32-02
    provides: "evidence/32-root-override-inventory.md and the --root additions to six repo-level guards"
  - phase: 32-03
    provides: "the repaired .planning/PROJECT.md D-36 row this plan plants against"
  - phase: 32-04
    provides: "the widened docs-linerefs.test.ts, settling the tree this sweep measures"
provides:
  - "14 new `re-pointed` rows in guard-fates.json, each with a minimal plant, a guard descriptor and a note naming the assertion it trips"
  - "15 machine-captured observed reds (every renamed set-A member), each paired with a green exit-0 unplanted control"
  - "evidence/32-sweep-renamed-rows.md — raw command, raw stdout/stderr, exit status, plant and tree state per row, both legs"
  - "A measured correction: the renamed group is 15, not 16; anno-derivation.test.ts is `gone` and belongs to the wave-5 sweep"
  - "Two findings against the harness's guard-argv conventions (`--run` unusable; 15s timeout too short for anno-cli.test.ts)"
affects: [32-07, 32-08, 32-09, guard-fates-registry, audit-mutation-harness]

actuals:
  tokens: 89911
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Registry-driven mutation testing: the plant/guard descriptor pair is the only per-row input, and the harness writes observedRed back"
    - "Green false-positive control before every plant — a red with no green control is UNMEASURABLE, never evidence"
    - "Selector built by filtering the registry, never retyped from a plan table"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md
  modified:
    - .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json

key-decisions:
  - "Followed the guard's mechanical derivation over the plan's hand-typed table: 15 renamed members, not 16. anno-derivation.test.ts is derived `gone` and was NOT given a `re-pointed` row."
  - "Every plant is `kind: worktree`. The harness implements no other kind and throws on one, so no synthetic fixture tree was built and no `mktemp -d` was used."
  - "The .d.mts row's guard runs tsc directly rather than the harness's documented `[\"--run\",\"typecheck\"]`, which spawns an invocation npm rejects."
  - "The anno-cli row's guard is scoped with --test-name-pattern because the full file (20596ms) exceeds the harness's 15000ms timeout, and a timeout is mapped to status 1 — a false red."
  - "The tracer row was re-measured in the same sweep rather than left carrying an excerpt citing a worktree that no longer exists."

patterns-established:
  - "Pattern 1: a plant that reuses an existing in-test non-vacuity assertion applies that violation to the REAL subject, and the row's note states explicitly that the in-test assertion is a map, not the evidence (D-04)."
  - "Pattern 2: where two rows must share a plant file, they take different targets AND different guards, and the note argues why neither can mask the other."
  - "Pattern 3: a forced guard-argv deviation is recorded in the row note with the measured number that forced it, not silently applied."

requirements-completed: [CUT-04]

coverage:
  - id: D1
    description: "All 15 renamed set-A members carry a machine-captured, non-zero observedRed against their NEW subject, each with a green exit-0 unplanted control"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "node scripts/audit-mutation-harness.mjs --rows <15 registry-derived historicalPaths> — `measured 15 row(s)`, 15 × OBSERVED RED, 0 × UNMEASURABLE, 0 × ZERO-EXIT"
        status: pass
      - kind: automated
        ref: "registry predicate: every re-pointed row has integer non-zero observedRed.exitStatus, non-empty command/cwd/excerpt/plant, and control.exitStatus === 0"
        status: pass
      - kind: automated
        ref: "registry predicate: no observedRed.command names its row's historicalPath basename (the red was observed against the NEW subject)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The working tree is byte-identical to its pre-run state — no plant survived, including in the NUL-carrying module"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "harness self-report: `tree: restored byte-identical to the baseline`"
        status: pass
      - kind: automated
        ref: "git diff --exit-code --stat -- src/mcp/vice/anno-memmap-render.ts (exit 0, no output)"
        status: pass
      - kind: automated
        ref: "git status --porcelain filtered to tracked non-.planning paths — empty"
        status: pass
      - kind: unit
        ref: "src/mcp/vice: npm run test:automated — 2943 pass / 1 fail (the pre-existing worktree-only repo-root.test.ts:178 artifact) and npm run typecheck exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The evidence document re-derives every measurement from raw command and raw output, and records broker state, commit measured and tree state verbatim"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md — 5721 harness-written lines plus a preconditions header; per row: green control command/cwd/exit/raw output, then planted plant/command/cwd/exit/raw output"
        status: pass
    human_judgment: false
  - id: D4
    description: "The renamed group is 15, not the plan's 16 — a derivation correction that reassigns anno-derivation.test.ts to the wave-5 deleted/superseded sweep"
    verification:
      - kind: automated
        ref: "deriveAuditedSet({root}).forwardRenamed via scripts/check-guard-fates.mjs — renamed 15, samePath 21, gone 7, summing to SET_A_FLOOR 43"
        status: pass
    human_judgment: true
    rationale: "The count is mechanical, but the consequence — that a member the plan assigned to THIS plan is instead owed a `deleted` or `superseded` verdict by plan 32-07 — is a scope reassignment across plans that a human should confirm before wave 5 runs."
  - id: D5
    description: "Two findings against scripts/audit-mutation-harness.mjs: the `--run` argv convention is unusable as documented, and GUARD_RUN_TIMEOUT_MS is too short for at least one real guard"
    verification:
      - kind: automated
        ref: "measured: `npm --run typecheck` -> exit 1 `Unknown command: \"typecheck\"`, recorded UNMEASURABLE by the green-control rule; `node --test anno-cli.test.ts` -> 20596ms against a 15000ms bound"
        status: pass
    human_judgment: true
    rationale: "This plan is forbidden from modifying any script, so both were routed around rather than fixed. Whether to patch the harness — and whether the `--run` convention should be corrected before the wave-5 sweep uses it — is a decision outside this plan's remit."

duration: 41min
completed: 2026-08-31
status: complete
---

# Phase 32 Plan 06: The Renamed-Member Sweep Summary

**All 15 renamed set-A guards observed exiting non-zero against their new subjects under recorded minimal plants, each paired with a green exit-0 control, with the tree restored byte-identical — and the renamed group measured at 15, not the plan's 16.**

## Performance

- **Duration:** 41 min
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)
- **Commits:** 3

## Accomplishments

- **14 new registry rows**, taking `guard-fates.json` from 1 row to 15. Each carries `historicalPath`, `verdict: re-pointed`, a `newSubject` that exists on disk, a `removalTrigger`, a minimal `plant`, a `guard` descriptor and a `note` naming the assertion the plant is expected to trip.
- **15 observed reds in a single sweep**, all on the first plant. Zero rows needed a second plant; zero came back UNMEASURABLE; zero are recorded as a possible-vacuity FINDING. Every red is an integer non-zero exit status captured by `spawnSync`, and every one is preceded by an unplanted control that exited 0.
- **`evidence/32-sweep-renamed-rows.md`** — 5721 harness-written lines carrying, per row, both legs in full: the raw command, the raw stdout and stderr, the exit status and the plant applied. Headed by the asserted preconditions and closed by the post-run tree state.
- **A measured derivation correction.** The plan's table claims 16 renamed members; the guard's own forward map returns 15. The sweep followed the derivation.
- **Two findings against the harness** delivered in plan 32-01, both surfaced by being the first rows to exercise the paths in question.

## Task Commits

1. **Task 1: descriptors for the structurally-named renames** — `8e89d7d` (docs)
2. **Task 2: descriptors for the nine capability-test renames** — `8d6c442` (docs)
3. **Task 3: the sweep, the observed reds and the raw evidence** — `c39aee1` (docs)

## Files Created/Modified

- `.planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json` — 1 row → 15 rows; every `re-pointed` row now carries a plant, a guard and a machine-captured `observedRed` with a green control.
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-sweep-renamed-rows.md` — created; the raw record.

## The 15 rows and what each plant trips

| historical path | new subject | plant | guard | red |
|---|---|---|---|---|
| `anno-verb-coverage.test.ts` | `anno-verb-coverage.test.ts` | `ANNO_CLI_VERB_FLOOR` 3→4 | `node --test anno-verb-coverage.test.ts` | 1 |
| `lib/anno-cli-verbs.mjs` | `lib/anno-cli-verbs.mjs` | invocation literal `` `anno ${verb}` ``→`` `anno-${verb}` `` | `node scripts/check-skill-tool-coverage.mjs` | 1 |
| `lib/anno-cli-verbs.d.mts` | `lib/anno-cli-verbs.d.mts` | drop the `verbsMissingFromSkills` declaration | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | 1 |
| `docs-absorbed-decisions.test.ts` | `docs-absorbed-decisions.test.ts` | `PROJECT.md` `handler.rs:1894`→`1895` | `node --test docs-absorbed-decisions.test.ts` | 1 |
| `absorbed-answer-key.test.ts` | `absorbed-answer-key.test.ts` | `ANSWER.sha256` one hex digit | `node --test absorbed-answer-key.test.ts` | 1 |
| `spawn-seam.test.ts` | `spawn-seam.test.ts` | drop the argv-array brackets at the one emulator spawn | `node --test spawn-seam.test.ts` | 1 |
| `anno-cli.test.ts` | `anno-cli.test.ts` | `VERB_OPTIONS` key `export-asm`→`export-asmX` | `node --test --test-name-pattern '…surviving verbs' anno-cli.test.ts` | 1 |
| `anno-confidence.test.ts` | `anno-confidence.test.ts` | grade phrase `probable code`→`probable-code` | `node --test anno-confidence.test.ts` | 1 |
| `anno-coverage-grammar.test.ts` | `anno-coverage-grammar.test.ts` | `absolute_y` high-byte shift `<< 8`→`<< 9` | `node --test anno-coverage-grammar.test.ts` | 1 |
| `anno-coverage.test.ts` | `anno-coverage.test.ts` | `COVERAGE_SCHEMA_VERSION` 2→3 | `node --test anno-coverage.test.ts` | 1 |
| `anno-d64.test.ts` | `anno-d64.test.ts` | plain-image length `174848`→`174847` | `node --test anno-d64.test.ts` | 1 |
| `anno-enum-gen.test.ts` | `anno-enum-gen.test.ts` | `registerKeyFor` `padStart(4`→`padStart(5` | `node --test anno-enum-gen.test.ts` | 1 |
| `anno-memmap-render.test.ts` | `anno-memmap-render.test.ts` | SHA hex length `{64}`→`{63}` | `node --test anno-memmap-render.test.ts` | 1 |
| `anno-regbits.test.ts` | `anno-regbits.test.ts` | generated banner `memmapSha256` one hex digit | `node --test anno-regbits.test.ts` | 1 |
| `anno-tools.test.ts` | `anno-tools.test.ts` | registered `name: "anno_get_symbols"`→`"anno_get_symbolz"` | `node --test anno-tools.test.ts` | 1 |

Every control exited 0. No `observedRed.command` names its row's historical path — checked mechanically, not by eye.

## Registry row count, before and after

- **Before:** 1 row (the tracer, `anno-verb-coverage.test.ts`, from plan 32-01).
- **After:** 15 rows. Verified against the guard's own summary line: `rows=15`.
- **This plan added 14**, not 16 and not 15. The tracer was NOT duplicated — its `historicalPath` and `newSubject` appear exactly once, which the guard checks in both directions.
- `check-guard-fates.mjs` remains red as pre-declared, and its `no recorded fate` list shrank from **60** lines to **46** — exactly the 14 rows added.

## Decisions Made

1. **The derivation beat the table.** `32-06-PLAN.md`'s `<objective>` enumerates 16 renamed members and maps `src/mcp/vice/anno-derivation.test.ts` onto `anno-derivation.test.ts`. That mapping is not derivable: `nameDescendantCandidates()` yields `anno-upstream-audit.test.ts`, `absorbed-upstream-audit.test.ts` and `upstream-audit.test.ts`, none of which exists at `AUDIT_END`, and git's `-M` heuristic does not score it either. The guard's `forwardRenamed` returns **15**, with that member in `forwardGone`. The plan instructs, in as many words, to follow the derivation and never edit a floor or a table to make the planning-time reading win — so no row was created for it, and it is handed to the wave-5 sweep that owns the `gone` members as a `deleted` or `superseded` verdict. This is not a new finding: `evidence/32-audited-set-reconciliation.md` §4.1 already recorded "15 renamed / 7 gone, not the plan's 16 / 6". No floor moved; the forward-map split is descriptive.

2. **Every plant is `kind: "worktree"`.** Task 1's action contemplates a `kind: "root"` route with synthetic fixture trees. The harness's `plant()` implements only `worktree` and throws on anything else. So no fixture tree was built, nothing was added under the pinned `src/mcp/vice/fixtures/planted-` prefix, and `src/mcp/vice/fixtures/README.md` is untouched. This also made the `mktemp -d` hazard moot — see below.

3. **The tracer row was re-measured** rather than left alone. Its committed excerpt cited `agent-adc0e44067665a83e`, a worktree that no longer exists. Re-running it in the same sweep makes the evidence document one internally consistent record from one tree, which is the stated value of doing the sweep in one context.

## Deviations from Plan

### 1. [Rule 3 — Blocking] The harness's `["--run","typecheck"]` guard convention does not work

- **Found during:** Task 1, the `scripts/lib/anno-cli-verbs.d.mts` row.
- **Issue:** `resolveBin()` maps `argv[0] === "--run"` to the npm client, producing `npm --run typecheck`. npm 11 rejects that form: `Unknown command: "typecheck"` / `Did you mean this? npm run typecheck`. The UNPLANTED control therefore exited 1 and the row came back **UNMEASURABLE** — the green-control rule working exactly as designed, refusing to bank a broken invocation as evidence.
- **Fix:** re-pointed the row's `guard.argv` at `node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` with `cwd: src/mcp/vice`, which is byte-for-byte what `package.json`'s `typecheck` script runs, and which reaches the harness through its *other* documented convention. **No script was modified** — this plan measures.
- **Verification:** re-probed; `OBSERVED RED … guard exit status 1 (control exit status 0)`.
- **Committed in:** `8e89d7d`.
- **Standing finding:** of the harness's three documented argv conventions, `--run` is the only one that had never been exercised, and it is unusable as written. Recorded for whoever owns the harness.

### 2. [Rule 3 — Blocking] `GUARD_RUN_TIMEOUT_MS` is shorter than one real guard's runtime

- **Found during:** Task 2, the `src/mcp/vice/anno-cli.test.ts` row.
- **Issue:** `node --test anno-cli.test.ts` takes **20596ms** measured; the harness bounds every guard at **15000ms** and maps a timeout to status 1. Unscoped, the green control would have timed out (row UNMEASURABLE) and — worse, had the control somehow passed — a timeout would have been banked as an observed red proving nothing about the plant. This is precisely the false red the harness's own header warns about.
- **Fix:** scoped the guard with `--test-name-pattern 'VERB_OPTIONS carries exactly the surviving verbs'`, the one assertion the plant targets. Runtime drops to **2675ms**. The command still names the row's `newSubject` and still runs that guard's own assertion.
- **Verification:** `OBSERVED RED … guard exit status 1 (control exit status 0)`; all 13 other per-file control timings were measured up front and recorded in the evidence header, so the bound was checked rather than assumed.
- **Committed in:** `8d6c442`.

### 3. [Derivation — pre-authorised by the plan] 14 rows, not 16

Covered under Decisions Made §1. The plan's own `<automated>` verify commands encode the stale figures (`rows.length < 7` after task 1, `< 16` after task 2); both were re-anchored to the derived counts (6 and 15) and re-run. Editing the derivation to satisfy the assertion would have been the exact failure the guard exists to catch.

### 4. [Correction] `pgrep -af vice-broker` self-matches

The plan's precondition names `pgrep -af vice-broker`. Run plainly, it matches its **own** shell command line and returns exit 0 with one hit, which reads as a live broker. The bracketed `[v]ice-broker` form is the honest check and is what was recorded. Both forms and the explanation are in the evidence header so a future reader hitting the same false positive can recognise it.

---

**Total deviations:** 4 (2 blocking auto-fixes routed around without modifying any script, 1 pre-authorised derivation correction, 1 precondition-command correction).
**Impact on plan:** No scope creep. Two of the four are findings *about the instrument*, produced by using it at scale for the first time — which is what a sweep is for. The derivation correction narrows this plan's scope by one row and widens plan 32-07's by one.

## Issues Encountered

- **`npm ci` was required** inside the worktree before `tsc` would resolve (`node_modules` absent). Installed from the committed lockfile at `src/mcp/vice`; nothing new was added.
- **`test:automated` reports 1 failure**, `repo-root.test.ts:178` — `the agreed directory must not sit under .claude`, which is true of every GSD worktree root by construction. This is the known, recorded artifact in `deferred-items.md` §1, verified 0-fail in the main checkout after each prior wave. Not caused here, not fixed, not loosened. Critically, it did **not** contaminate any observed red: every guard in this sweep runs a single named test file or script, none of which is `repo-root.test.ts`, and every red is bracketed by its own green control on the same command.

## Threat surface

No new network endpoints, auth paths, file-access patterns or trust-boundary schema changes. The plan's register (T-32-22 … T-32-27) is satisfied as designed: plant targets pass through `resolveContainedRoot()`, `guard.argv` is spawned as an array with `shell` never set, `NODE_TEST_*` is stripped from the child env, byte-mode capture/restore held over the NUL-carrying module, broker state was read-only, and no evidence directory leaked.

## Known Stubs

None. No stub, placeholder, skipped test or unrun `<verify>` was introduced. Every `<automated>` verification command in the plan was re-anchored to this worktree root and run, with its real output recorded above.

## Next Phase Readiness

**Ready.** Plan 32-07 (wave 5) inherits:

- A registry at 15 rows with a settled shape — copy any `re-pointed` row as the schema reference.
- **One extra member than its plan expects:** `src/mcp/vice/anno-derivation.test.ts` is in `forwardGone`, not `forwardRenamed`, so it owes a `deleted` (with its removing commit named) or `superseded` verdict from the wave-5 sweep, not a `re-pointed` one. The full `gone` set is the seven listed in the evidence header.
- **46 members still owe a row** (down from 60), per `check-guard-fates.mjs`'s own output. Use that output as the work list; do not transcribe one.
- **Two harness caveats that will bite again:** `["--run", ...]` is unusable, and any guard slower than 15000ms must be scoped or it records a false red. `vice-proxy.test.ts` is in the remaining set and is the known slow one.
- Do NOT re-run `--all` on the wave-5 sweep: these 15 rows are measured and would be re-measured for no new information.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-08-31*

## Self-Check: PASSED

All three artifacts exist on disk; all four commits (`8e89d7d`, `8d6c442`, `c39aee1`, `40cf37b`) resolve in `git log`; the registry holds 15 rows; `git status --porcelain` is empty.
