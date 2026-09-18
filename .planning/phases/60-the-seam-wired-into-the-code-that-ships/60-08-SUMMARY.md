---
phase: 60-the-seam-wired-into-the-code-that-ships
plan: 08
subsystem: infra
tags: [tool-location, backend-detect, vice-broker, LOC-03, gap-closure, tdd, evidence]

# Dependency graph
requires:
  - phase: 60-the-seam-wired-into-the-code-that-ships (plans 60-06, 60-07)
    provides: the widened, terminal-for-separator-free-values environment layer (plan 60-06),
      and the second failing-set-difference evidence note this plan's own third note repeats the
      method of (plan 60-07)
provides:
  - A terminal environment layer in tool-location.mts's resolveTool() for a declared variable's
    non-empty value WHATEVER its shape -- closing the separator-containing substitution hazard
    plan 60-06 deliberately left open and plan 60-07's own evidence note carried forward as an
    accepted limit.
  - A kind-correct buildEnvLayerRefusal() justification clause -- an executable-kind id keeps the
    $PATH-shadowing warning, a directory-kind id (ghidra, acme-lib) no longer claims a $PATH
    substitution protection that cannot structurally apply to it (fixes 60-REVIEW.md's WR-03).
  - Two shipped tests (vice-broker-acquire.test.ts's "Plan 60-01 Test 4",
    tool-location.test.ts's separator-containing case) rewritten in place with their surviving
    intents kept and their expected outcomes reversed, with the correction recorded on the
    record rather than left as an unexplained flip.
  - A third failing-set-difference evidence note
    (evidence/phase60-loc03-terminal-env-set-diff.md) closing the carried-forward accepted limit
    from plan 60-07's own note.
affects: [61-the-doctor-tool-and-its-own-precedence-report, any future phase reading
  ResolveToolResult or ResolvedBackendResult]

# Actuals (#2632)
actuals:
  tokens: 21335
  tasks: 3
  commits: 3
  plan_head_before: 8c2d985fe87d891201f88b29c18c4cabfa22cca8

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Terminal-for-both-shapes environment layer: the refusal condition (envUnresolved) and the
      $PATH-walk gate (the separator test) are two DISTINCT expressions in resolveTool()'s Layer
      1 -- the walk stays gated to a separator-free, executable-kind candidate (a $PATH search of
      an absolute path or a directory is meaningless), but the refusal now fires WHATEVER the
      value's shape once neither Layer 1 step nor the file layer answered."
    - "Kind-branched refusal justification: buildEnvLayerRefusal() composes its trailing clause
      from record.kind, reusing the same discriminator the function's own `wants` ternary already
      reads -- never a second source of truth for the kind, never a new parameter."
    - "Declaration-enumerated invariant test: a test that reads the committed prerequisites.json
      at test time to build its own id list, rather than a hand-typed array, so a newly declared
      id with an envVar is covered the day it is added."

key-files:
  created: []
  modified:
    - src/mcp/vice/tool-location.mts
    - src/mcp/vice/tool-location.test.ts
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/resources/tool-location.mjs
    - docs/phase58-declaration-provenance.md
    - docs/phase59-tool-location-placement.md
    - .planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-loc03-terminal-env-set-diff.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The environment layer's terminal refusal (envUnresolved) now fires for ANY non-empty declared
    value that resolves through neither Layer 1 step, not only a separator-free one. The $PATH
    walk itself stays gated to a separator-free, executable-kind value -- that surviving
    distinction (what the walk asks vs. what the refusal asks) is the load-bearing correction this
    plan makes to plan 60-06's own scoping decision, per 60-VERIFICATION.md's direct read of the
    pre-phase source (git show d54d98a1:src/mcp/vice/backend-detect.mts)."
  - "WR-03 fixed by branching the refusal message on record.kind (PD-21), not by deleting the
    $PATH-shadowing clause for every kind -- the clause stays true and load-bearing for the six
    executable-kind ids and is dropped only where it is structurally false (the two directory-kind
    ids), per 60-REVIEW.md's own two fix options and the ROADMAP's cross-cutting constraint that
    the warning 'stays' for the shadowing hazard it is real for."

requirements-completed: [LOC-03]

coverage:
  - id: D1
    description: "A stale absolute VICE_BIN refuses by name instead of starting a same-named
      decoy on $PATH, end to end from the seam to the real handleAcquire() cold-spawn call."
    requirement: "LOC-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 2: an environment variable set to a separator-containing value that resolves nowhere refuses, naming the variable and the value, with a decoy on PATH never answering"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#Plan 60-08 Test 1b (tracer spawn, LOC-03): the real handleAcquire() cold-spawn call receives the unresolved absolute VICE_BIN value, never the decoy's absolute path"
        status: pass
    human_judgment: false
  - id: D2
    description: "The $PATH walk stays gated to a separator-free value, and the declared-id probe
      never runs once a variable was set and left unresolved, whatever the value's shape."
    requirement: "LOC-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 3: a separator-containing unresolvable value is never walked on $PATH for itself, and the declared-id probe never runs either"
        status: pass
    human_judgment: false
  - id: D3
    description: "A separator-containing value that resolves still wins outright through the
      environment layer, and .c64-re-tools/tools.json still gets its say after an unresolved
      environment value of either shape (PD-14 unchanged)."
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 4: a separator-containing VICE_BIN naming a real executable still resolves outright through the environment layer"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 5 (PD-14): a separator-containing unresolvable VICE_BIN still lets a valid tools.json entry answer from the file layer"
        status: pass
    human_judgment: false
  - id: D4
    description: "A directory-kind id's refusal carries no $PATH-shadowing justification clause,
      while an executable-kind id's refusal still carries it -- a planted-violation/clean-control
      pair, plus the second directory-kind id (acme-lib) proving the fix lives in the shared
      builder."
    requirement: "WR-03 (60-REVIEW.md, not a REQUIREMENTS.md id)"
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-06 Test G: a directory-kind GHIDRA_HOME set to a bare name that is not a directory is never walked on $PATH, and refuses (negative assertion added)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 7 (clean control): an executable-kind refusal still carries the $PATH-shadowing justification clause"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 8: the acme-lib directory-kind refusal (via ACME) also carries no $PATH-shadowing clause"
        status: pass
    human_judgment: false
  - id: D5
    description: "The generalized invariant, enumerated from the committed declaration: for every
      declared id carrying an envVar, an unresolvable value of either shape refuses; the seam
      gains no cache, memo or reset hatch (LOC-03 concurrency edge)."
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 10 (invariant, enumerated from prerequisites.json): every declared id with an envVar refuses for both an unresolvable bare name and an unresolvable separator-containing value"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 11 (concurrency): many concurrent resolutions of a separator-containing unresolvable value each return the same fields as a solo call"
        status: pass
    human_judgment: false
  - id: D6
    description: "Two shipped tests whose contracts this round reverses are rewritten in place
      with their surviving intents kept, and the reversal is recorded as a correction of a
      same-phase regression rather than an unexplained flip."
    verification:
      - kind: unit
        ref: "src/mcp/vice/vice-broker-acquire.test.ts#Plan 60-01 Test 4: two resolutions of x64sc in one process agree on path/layer/mechanism, and the environment candidate is tried before any $PATH candidate (rewritten)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 2 (rewrite of the former 'behaves exactly as today' case)"
        status: pass
    human_judgment: false
  - id: D7
    description: "resources/tool-location.mjs is regenerated and committed, resources-sync.test.ts
      is green, and a compiled-artifact case proves the terminal refusal and the kind-correct
      message both answer from the built artifact."
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 6: compiled artifact -- the terminal refusal for a separator-containing value answers from resources/tool-location.mjs"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-location.test.ts#Plan 60-08 Test 12: compiled artifact -- the kind-correct refusal (no $PATH clause for a directory-kind id) answers from resources/tool-location.mjs"
        status: pass
      - kind: other
        ref: "node build.ts (exit 0) + node --test resources-sync.test.ts (0 failing)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The failing SET after this round contains nothing that was passing before it,
      measured against d7d5a151 with the full test glob and an explicit TAP reporter, never a
      total or the filtered test:automated gate; the two deliberately reversed tests are named
      under both old and new assertions; the carried-forward accepted limit from plan 60-07's own
      evidence note is stated closed."
    verification:
      - kind: other
        ref: "evidence/phase60-loc03-terminal-env-set-diff.md -- baseline d7d5a151 (7 failing, all explained), post-round 2cf21509 (0 failing), regression list empty"
        status: pass
    human_judgment: false

# Metrics
duration: ~65min (not machine-timestamped at start; estimated from session extent)
completed: 2026-09-18
status: complete
---

# Phase 60 Plan 08: Terminal environment layer for both value shapes, kind-correct refusal, third evidence note Summary

**The environment layer is now terminal for a declared variable's non-empty value whatever its
shape (not only a bare name), the refusal message no longer claims a `$PATH`-shadowing protection
for a `directory`-kind id where none exists, and a third failing-set-difference note closes the
carried-forward accepted limit plan 60-06 left open.**

Workflow files read: `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/checkpoints.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/tdd.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/worktree-path-safety.md`, `/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/references/executor-examples.md`

## Performance

- **Duration:** ~65 min (estimated)
- **Completed:** 2026-09-18
- **Tasks:** 3
- **Files modified:** 8 (6 in the plan's own `files_modified` list, plus 2 documentation files
  fixed as an in-scope citation-drift deviation, plus `.planning/REQUIREMENTS.md` for the
  requirement-completion step)

## Accomplishments

- Moved the `envUnresolved = true` assignment out of the separator-gated branch in
  `resolveTool()`'s Layer 1 block, so the terminal refusal fires for ANY non-empty declared
  variable value that resolves through neither Layer 1 step -- not only a separator-free one.
  The `$PATH`-walk gate itself is untouched: exactly one separator test remains in the block,
  guarding the walk alone. This closes the substitution hazard for an absolute (or otherwise
  separator-containing) stale `VICE_BIN`/`ACME_BIN`/`ACME`/`GHIDRA_HOME`, end to end through
  `resolvedBackend()` to the real `handleAcquire()` cold-spawn call.
- Rewrote the module header's Phase 60 paragraph and the Layer 1 block's own explanatory comment
  to state the corrected LOC-03 history: `60-VERIFICATION.md` read the pre-phase source directly
  and found the separator-containing fall-through plan 60-06 kept was itself a same-phase
  regression (plan 60-01's own unconditional declared-id `$PATH` probe), not pre-phase behaviour
  as plan 60-06's own SUMMARY recorded.
- Branched `buildEnvLayerRefusal()`'s trailing justification clause on `record.kind` (fixes
  `60-REVIEW.md`'s WR-03): an `executable`-kind id keeps the `$PATH`-shadowing warning
  byte-for-byte; a `directory`-kind id gets a terminal-resolution statement instead, since Layer
  3 has no `$PATH` probe for it at all (D-15) and the old clause named a protection that
  structurally cannot apply.
- Rewrote `vice-broker-acquire.test.ts`'s "Plan 60-01 Test 4" and
  `tool-location.test.ts`'s separator-containing case IN PLACE, keeping both tests' surviving
  intents and reversing their expected outcomes, with an in-file comment recording the
  correction.
- Added 22 new tests across `tool-location.test.ts` and `vice-broker-acquire.test.ts` (prefixed
  `Plan 60-08`), covering the refusal, the walk-gate survival, the positive control, PD-14
  file-layer reachability, the compiled artifact, the kind-correct message pair
  (negative/positive control plus a second directory-kind id), the declaration-enumerated
  invariant, and the concurrency edge.
- Regenerated and committed `resources/tool-location.mjs` after each of Tasks 1 and 2;
  `resources-sync.test.ts` is green.
- Wrote a third failing-set-difference evidence note comparing the full test glob at baseline
  `d7d5a151` against this plan's own `2cf21509`, with an explicit TAP reporter, no live broker,
  and exit status read on the redirect line. The regression list is empty. Two genuine
  citation-ledger drifts the measurement itself surfaced (one caused by this plan's own header
  rewrite shifting a line range, one pre-existing ROADMAP drift) were fixed within the plan.
- Marked `LOC-03` `Complete` in `REQUIREMENTS.md` -- the last of this phase's five requirement ids
  to close.

## Task Commits

Each task was committed atomically:

1. **Task 1: A stale absolute VICE_BIN refuses by name instead of starting a decoy, end to end
   from the seam to the real spawn call** - `f0a51757` (feat) - includes the two citation-ledger
   line-drift repairs the same task's own verify surfaced.
2. **Task 2: The refusal stops claiming a protection that cannot apply, and the promotion is
   pinned as an invariant rather than as one input shape** - `2cf21509` (fix)
3. **Task 3: The unchanged-behaviour claim measured a third time, with the deliberate contract
   reversal named on the record** - `d896c076` (docs)

**Plan metadata:** (this commit, following)

_Both Tasks 1 and 2 carry `tdd="true"`; RED was observed via manual pre-write probes of each new
scenario against the pre-fix code (confirming the exact failure the fix would need to close)
before any test text was committed, and via the pre-existing shipped suite's own pinned
assertions going red the moment the production code changed -- see TDD Gate Compliance below._

## Files Created/Modified

- `src/mcp/vice/tool-location.mts` - terminal-for-both-shapes Layer 1 refusal, kind-branched
  `buildEnvLayerRefusal()`, rewritten module header and Layer 1 block comment.
- `src/mcp/vice/tool-location.test.ts` - one shipped case rewritten in place, 22 new `Plan 60-08`
  tests, one existing case ("Plan 60-06 Test G") extended with a negative assertion.
- `src/mcp/vice/vice-broker-acquire.test.ts` - "Plan 60-01 Test 4" rewritten in place, two new
  `Plan 60-08` tracer tests.
- `src/mcp/vice/resources/tool-location.mjs` - regenerated compiled artifact.
- `docs/phase58-declaration-provenance.md`, `docs/phase59-tool-location-placement.md` - two
  citation-ledger line-range repairs (see Deviations).
- `.planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-loc03-terminal-env-set-diff.md` -
  new committed evidence note.
- `.planning/REQUIREMENTS.md` - `LOC-03` marked `Complete`.

## Decisions Made

See `key-decisions` in frontmatter: the terminal-for-both-shapes refusal (with the surviving
walk-gate/refusal-condition distinction), and the kind-branched WR-03 fix. Both are the plan's
own PD-20/PD-21 decisions, implemented as specified with no interpretive deviation from the plan
text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired a citation-ledger line drift caused by this task's own header
rewrite**
- **Found during:** Task 1's own verify step (`phase58-citation-ledger.test.ts`).
- **Issue:** Rewriting the module header's Phase 60 paragraph and the Layer 1 block comment in
  `tool-location.mts` shifted `export function resolveOnPath(...)`'s line range from `293-308` to
  `313-328`, drifting a citation in `docs/phase59-tool-location-placement.md` (both a prose
  reference and the document's own citation-ledger entry).
- **Fix:** Updated both occurrences in `docs/phase59-tool-location-placement.md` to
  `src/mcp/vice/tool-location.mts:313-328`.
- **Files modified:** `docs/phase59-tool-location-placement.md`.
- **Verification:** `phase58-citation-ledger.test.ts` green.
- **Committed in:** `f0a51757` (Task 1 commit).

**2. [Rule 3 - Blocking] Repaired a pre-existing, unrelated ROADMAP.md citation drift the same
verify run surfaced**
- **Found during:** Task 1's own verify step, same run as Deviation #1.
- **Issue:** `docs/phase58-declaration-provenance.md`'s citation into `.planning/ROADMAP.md`
  (`1999-2002`, anchor "a user missing ACME learns that") no longer contained the anchor text --
  it had drifted to line 2004 from unrelated ROADMAP progress-table edits accumulated across this
  phase's plans, the identical failure class plan 60-07's own evidence note recorded for a
  different ROADMAP citation. Not caused by this plan's own source diff.
- **Fix:** Updated the citation and its ledger entry to `.planning/ROADMAP.md:2002-2005`.
- **Files modified:** `docs/phase58-declaration-provenance.md`.
- **Verification:** `phase58-citation-ledger.test.ts` green (11/11).
- **Committed in:** `f0a51757` (Task 1 commit).

---

**Total deviations:** 2 auto-fixed (both Rule 3, blocking issues surfaced by this plan's own
required verify step). **Impact on plan:** Necessary to pass this plan's own gate
(`phase58-citation-ledger.test.ts` is one of Task 1's required `<verify>` commands). No scope
creep: both fixes are documentation-only line-range corrections, verified against live source by
re-running the citation-ledger test itself rather than by inspection.

## TDD Gate Compliance

Tasks 1 and 2 carry `tdd="true"`. Gate evidence:

- **RED:** Before any Task 1 production change, `tool-location.test.ts` (76 tests) and
  `vice-broker-acquire.test.ts` (33 tests) were green against the pre-fix code (plan 60-06/60-07's
  own committed state). A manual pre-write probe of the exact Task 1 scenario (a separator-containing,
  unresolvable `VICE_BIN` with a decoy `x64sc` on `PATH`) against the pre-fix `resolveTool()`
  confirmed it returned the decoy's path through the probe layer -- the intentional RED target.
  After the Layer 1 rewrite landed (before the test files were touched), re-running the pre-existing
  suite showed the expected, intentional RED: `tool-location.test.ts`'s own "an environment
  variable set to an absolute path that does not exist behaves exactly as today..." case and
  `vice-broker-acquire.test.ts`'s "Plan 60-01 Test 4" both failed on their TARGET assertions (the
  ones pinning the old substitution outcome), not on an unrelated crash or syntax error --
  satisfying the #3770 intentional-RED bar. Task 2's RED was observed the same way: a manual
  pre-write probe of the `ghidra`/`GHIDRA_HOME` refusal against the pre-fix `buildEnvLayerRefusal()`
  confirmed it contained the `$PATH`-shadowing clause before the fix.
- **GREEN:** After both tasks' rewrites, `tool-location.test.ts` (98/98), `vice-broker-acquire.test.ts`
  (35/35), `backend-detect.test.ts`, `host-tool.test.ts`, and `tool-location-consumers.test.ts` are
  all green (294 tests total across the five files, 0 failing).
- **REFACTOR:** None needed beyond the header-comment revisions made alongside Task 1's own
  production change (folded into the `feat` commit, not a separate commit) -- this plan's own
  `<tasks>` structure commits per TASK, matching every other plan in this phase, not per
  RED/GREEN/REFACTOR micro-commit.

No RED/GREEN commit-message convention violation: Task 1's `feat(60-08)` commit carries the
production code plus its own end-to-end tests; Task 2's `fix(60-08)` commit carries the
message-composition fix plus its own matrix of tests -- the grain the plan's own two tasks are
already cut on.

## Issues Encountered

None beyond the two citation-ledger drifts documented under Deviations above.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- `src/mcp/vice/tool-location.mts` - FOUND
- `src/mcp/vice/tool-location.test.ts` - FOUND
- `src/mcp/vice/vice-broker-acquire.test.ts` - FOUND
- `src/mcp/vice/resources/tool-location.mjs` - FOUND
- `docs/phase58-declaration-provenance.md` - FOUND
- `docs/phase59-tool-location-placement.md` - FOUND
- `.planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-loc03-terminal-env-set-diff.md` - FOUND
- Commit `f0a51757` - FOUND in `git log --oneline --all`
- Commit `2cf21509` - FOUND in `git log --oneline --all`
- Commit `d896c076` - FOUND in `git log --oneline --all`
- Re-ran every `<acceptance_criteria>` item from all three tasks: all pass (direct `resolveTool()`
  probes including the decoy scenario, `resolvedBackend()`/`handleAcquire()` end-to-end probe, the
  kind-correct message probe printing the exact four expected lines, `npm run typecheck` clean,
  `node build.ts` + `resources-sync.test.ts` green, `tool-location-consumers.test.ts` green,
  `host-tool.mts`/`resources/host-tool.mjs` untouched, evidence note's own five grep-based gates).
- Re-ran the plan-level `<verification>` block: `node --test` on all five named files (294/294
  passing), `npm run typecheck` clean, `phase58-citation-ledger.test.ts` green (11/11),
  `resources-sync.test.ts` green, source-level structural counts
  (`walk_gate_code_lines=1`, no reset-hatch export, `env_var_literals_in_seam_code=0`) all as
  required, no live broker process running throughout.

## Next Phase Readiness

- All five of this phase's requirement ids (`LOC-01`, `LOC-02`, `LOC-03`, `LOC-04`, `DECL-03`) are
  now `Complete` in `REQUIREMENTS.md`. `LOC-03` was the sole remaining open one; this plan closes
  it.
- The two carried-forward `<human-check>` items restated by this plan (an updated `ACME_BIN`
  expectation from plan 60-03, and the unchanged `tools.json`-vs-`VICE_BIN` live broker check from
  plan 60-05) remain deferred to end-of-phase human verification under
  `workflow.human_verify_mode: end-of-phase` -- they are NOT closed by this gap-closure pass and
  must not be forgotten when the phase seals.
- Phase 60's three failing-set-difference evidence notes (`phase60-suite-set-diff.md`,
  `phase60-gap-closure-suite-set-diff.md`, this plan's `phase60-loc03-terminal-env-set-diff.md`)
  now form a complete chain: each measures the unchanged-behaviour claim against the immediately
  preceding baseline, and each states plainly whether the prior note's own carried-forward limits
  are closed or still open. None remain open after this plan.
- Phase 61 (the doctor) can now rely on `ResolveToolResult`/`ResolvedBackendResult` reporting a
  terminal, kind-correct refusal for a declared variable's non-empty value of any shape -- no
  further per-shape carve-out should reappear in that phase's own reading of this seam.

---
*Phase: 60-the-seam-wired-into-the-code-that-ships*
*Completed: 2026-09-18*
