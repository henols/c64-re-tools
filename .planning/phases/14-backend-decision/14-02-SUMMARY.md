---
phase: 14-backend-decision
plan: 02
subsystem: capability-registry
tags: [fork-backend, capability-registry, skill-honesty-guard, doc-content-guard, FORK-02]

# Dependency graph
requires:
  - phase: 14-backend-decision (plan 01)
    provides: "The literal branch token `retain` and sub-question B's un-overridden default reading"
provides:
  - "14-ROUTE-EVIDENCE.md: an enumerated 17-site inventory of every point-of-use mention of the three hard-loss tools, each verdicted holds-as-is against the retain branch, plus the live runtime-refusal strings and both guard scripts' before/after output"
  - "Three new pinning tests in capability-registry.test.ts for vice_sid_get_state (pre-existing), vice_keyboard_matrix, and vice_keyboard_restore"
  - "A recorded zero-diff outcome across capability-registry.ts and all 8 skill/doc mention-site files, as a decision rather than an omission"
affects: [14-03-backend-decision, 14-05-backend-decision]

# Actuals (#2632)
actuals:
  tokens: 4059
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verification-not-authoring plan execution: when research establishes a route already exists and is already policed, the deliverable is an enumerated evidence document with live tool-call output and guard-script baselines, not new prose"

key-files:
  created:
    - .planning/phases/14-backend-decision/14-ROUTE-EVIDENCE.md
  modified:
    - .claude/mcp/vice/capability-registry.test.ts

key-decisions:
  - "Branch acted on: `retain` (read from 14-01-SUMMARY.md's `## Decision` section; confirmed, not inferred)."
  - "All 17 enumerated hard-loss mention sites verdicted `holds-as-is` — the fork route is real, followable, and undisturbed by this phase on the retain branch, so no site required amendment or rewrite."
  - "Zero edit to capability-registry.ts, README.md, docs/stock-vice-parity.md, or any of the 6 skill/reference files — recorded as the decided outcome of the retain branch, evidenced by 14-ROUTE-EVIDENCE.md and two before/after-identical guard runs, not left as a silent omission."

requirements-completed: [FORK-02]

coverage:
  - id: D1
    description: "Every point-of-use mention of vice_sid_get_state, vice_keyboard_matrix and vice_keyboard_restore is enumerated with a file:line citation and a per-site verdict against the retain branch"
    requirement: "FORK-02"
    verification:
      - kind: other
        ref: "grep -rn -E 'vice_sid_get_state|vice_keyboard_matrix|vice_keyboard_restore' .claude/skills/ README.md docs/stock-vice-parity.md (17 lines, 8 files, matching the plan-time figure with zero drift) -- 14-ROUTE-EVIDENCE.md ## Site inventory"
        status: pass
    human_judgment: false
  - id: D2
    description: "The runtime tool-call refusal for each of the three hard-loss tools states a route that is true on the retain branch (a fork pointer), with no point-of-use text promising a future fix no requirement owns"
    requirement: "FORK-02"
    verification:
      - kind: unit
        ref: "capability-registry.test.ts (13/13 passing, including the 2 new vice_keyboard_matrix/vice_keyboard_restore pinning tests)"
        status: pass
      - kind: manual_procedural
        ref: "Task 3's <human-check>: read the skill-section and runtime-refusal text a user actually meets for all three tools; confirmed each names the fork route, the two truly-unrecoverable losses (SID, RESTORE/NMI) carry no dangling promise of a fix, and the matrix-keyboard sites correctly also carry the vice_joystick_set partial route"
        status: pass
    human_judgment: true
    rationale: "FORK-02's judgement half (does the text read honestly, with no false promise) cannot be reduced to a grep -- the plan's own Task 3 verify block names this explicitly."
  - id: D3
    description: "node scripts/check-skill-fork-honesty.mjs exits 0 after the (zero) edits, with its non-vacuity floors unchanged, and check-skill-tool-coverage.mjs exits 0 too"
    requirement: "FORK-02"
    verification:
      - kind: other
        ref: "node scripts/check-skill-fork-honesty.mjs && node scripts/check-skill-tool-coverage.mjs, before and after Tasks 2/3, byte-identical counts (11 fork-only mentions/30 files/6 dirs/24 fork-only names; 37 vice_* names/31 resolved/6 fork-only-unrecoverable) -- 14-ROUTE-EVIDENCE.md ## Guards, before / ## Guards, after"
        status: pass
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-dangling-refs.test.ts docs-linerefs.test.ts capability-registry.test.ts (24/24 passing)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The literal token unrecoverable appears only in the hardware-category refusal wording (vice_sid_get_state, vice_keyboard_matrix, vice_keyboard_restore) and never in the descoped-category wording"
    requirement: "FORK-02"
    verification:
      - kind: unit
        ref: "capability-registry.test.ts: 'fork-only descoped tool on stock ... never says unrecoverable' (pre-existing, re-verified green, unmodified)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-22
status: complete
---

# Phase 14 Plan 2: FORK-02 Evidenced True On The Retain Branch, Zero Rewrite

**14-ROUTE-EVIDENCE.md enumerates all 17 point-of-use mentions of the three hard-loss tools, verdicts every one `holds-as-is` under the retained fork backend, and pins the runtime refusal for all three with new tests — with zero edit to any skill, doc, or source file.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-22T09:20:14Z (sequential continuation from 14-01)
- **Completed:** 2026-08-22T09:42:10Z
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `.planning/phases/14-backend-decision/14-ROUTE-EVIDENCE.md` created: re-derives
  the 17-site mention list from the live tree (not from the plan's cited line
  numbers), confirms zero drift against the plan-time figure, records the
  `retain` branch and sub-question B's un-overridden default, verdicts all 17
  sites `holds-as-is`, quotes the three live `capabilityRefusalMessage()`
  strings produced by an actual function call (not the format string), records
  the two totally-unrecoverable cases (SID, RESTORE/NMI) versus the genuine
  matrix-keyboard partial route (`vice_joystick_set`), and captures both guard
  scripts' verbatim stdout before and after Tasks 2/3 — byte-identical.
- `capability-registry.test.ts` gained two new tests pinning
  `vice_keyboard_matrix` and `vice_keyboard_restore`'s refusal strings on
  `activeBackend: "stock"` (tool name present, `unrecoverable` present,
  `VICE_BACKEND=fork` present, shared `KEYBOARD_ALTERNATIVE` text rendered) —
  joining the pre-existing `vice_sid_get_state` test to give all three
  hard-loss tools an explicit, named pin. **No change to
  `capability-registry.ts` itself**: Task 1's evidence already showed the
  refusal wording is true on the retain branch.
- Zero edit to any of the 8 skill/README/parity-doc files carrying the 17
  point-of-use mentions — every site's verdict was `holds-as-is`, so nothing
  needed amending. `git diff --quiet -- .claude/skills README.md
  docs/stock-vice-parity.md` exits 0.
- Both mechanical guards (`check-skill-fork-honesty.mjs`,
  `check-skill-tool-coverage.mjs`) re-run after Tasks 2 and 3 report figures
  byte-identical to the pre-edit baseline: 11 fork-only mentions across 30
  files in 6 skill directories, 24 fork-only names from `CAPABILITY_REGISTRY`.

## Task Commits

1. **Task 1: Enumerate the 17 hard-loss mention sites and judge each against the decided branch** - `49e23f2` (docs)
2. **Task 2: Make the runtime refusal true on the decided branch** - `5cdd04e` (test)
3. **Task 3: Make the documented routes true at every point of use** - `6ac3518` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified
- `.planning/phases/14-backend-decision/14-ROUTE-EVIDENCE.md` - the enumerated 17-site route inventory with per-site verdicts, live runtime-refusal quotes, and both guards' before/after output
- `.claude/mcp/vice/capability-registry.test.ts` - two new pinning tests for `vice_keyboard_matrix` and `vice_keyboard_restore`'s refusal strings

## Decisions Made
See `## key-decisions` in frontmatter. The load-bearing one: all 17 sites
verdict `holds-as-is` on `retain`, so this plan's entire deliverable is
evidence-recording plus test-pinning, with zero prose rewrite — matching the
plan's own explicit framing ("this plan's work is verification and
evidence-recording, not authoring") and avoiding research Pitfall 3's warning
against budgeting new writing on this branch.

## Deviations from Plan

None - plan executed exactly as written. The branch-conditional logic in
every task (`retain` → no source/doc edit, add evidence + pinning tests only)
was followed precisely; no architectural, blocking, or missing-functionality
issue arose.

## Issues Encountered

None. One thing worth recording honestly rather than silently: `node
scripts/check-skill-tool-coverage.mjs` and `check-skill-fork-honesty.mjs`
must be run from the repo root (they resolve paths relative to the script's
own location, not the caller's cwd) — running them from
`.claude/mcp/vice/scripts/` (a path that does not exist) throws
`MODULE_NOT_FOUND`. This is a cwd-discipline note for future executors, not a
defect in the scripts.

## Verification Scope

Ran the full automated gate (`cd .claude/mcp/vice && node test-gate.mjs`),
not just the files this plan touched, per this session's verification-scope
warning about enumerating guards. Result: 2081 pass / 10 fail / 3 cancelled /
5 todo out of 2099 total. All 10 failures match, by name, the
known-flaky-under-full-suite-load set already documented for this session:
`audit-integrity.test.ts`'s D-12-02 case, the broker singleton and real-SIGTERM
end-to-end cases in `broker-control.test.ts`/`broker-e2e.test.ts`, four
`vice-mcp anno --help`/bin cases plus the verb-options-map case in
`anno-cli.test.ts`, and a `runAnno()` slow-child-timeout case in
`anno-mcp-client.test.ts`. None touch `docs-*.test.ts`, `capability-registry.test.ts`,
or any file this plan modified — confirmed by grepping the full failure list
for those names (zero matches). `capability-registry.test.ts` itself:
13/13 passing, both standalone and inside the full suite.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `FORK-02` is NOT yet marked complete in `.planning/REQUIREMENTS.md`: the
  shared-ID gate (#2388) correctly holds it open because sibling plans 14-03
  and 14-05 also declare `FORK-02` and have not yet produced their own
  SUMMARY.md. It will flip to `Complete` once the last declaring plan
  finishes.
- Plans 14-04 and 14-05 (declaring `FORK-01`) can read the branch token
  `retain` from this plan's own read of 14-01-SUMMARY.md, unchanged.
- Plan 14-03 (declaring both `FORK-01` and `FORK-02`) is unaffected by this
  plan's zero-diff outcome — the fork route this plan confirmed still
  followable is the same one 14-03's live `-mcpserver` HTTP transport
  exercise depends on.
- No blockers.

## Self-Check: PASSED

- `[ -f .planning/phases/14-backend-decision/14-ROUTE-EVIDENCE.md ]` → FOUND
- `[ -f .claude/mcp/vice/capability-registry.test.ts ]` → FOUND (modified)
- `git log --oneline --all | grep -q 49e23f2` → FOUND
- `git log --oneline --all | grep -q 5cdd04e` → FOUND
- `git log --oneline --all | grep -q 6ac3518` → FOUND
- All task-level `<acceptance_criteria>` re-run: PASS (site count 17/17, verdict tokens 21 total in the evidence file, both guard scripts exit 0 at unchanged counts, `tsc --noEmit` clean, `capability-registry.test.ts` 13/13, `docs-dangling-refs.test.ts`/`docs-linerefs.test.ts`/`capability-registry.test.ts` 24/24, `git diff --quiet` on all zero-diff targets)
- Plan-level `<verification>` re-run: PASS (both guards 0 exit at unchanged baseline; `tsc --noEmit -p tsconfig.json` clean; the three named test files 24/24; `git diff -- scripts/check-skill-fork-honesty.mjs scripts/lib/skill-honesty-checks.mjs` empty)
- Full automated gate (`node test-gate.mjs`, 2099 tests): 10 failures, all matching the documented known-flaky-under-load set by name; zero failures in any `docs-*.test.ts` guard or in `capability-registry.test.ts`

---
*Phase: 14-backend-decision*
*Completed: 2026-08-22*
