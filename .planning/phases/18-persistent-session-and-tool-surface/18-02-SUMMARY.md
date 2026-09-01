---
phase: 18-persistent-session-and-tool-surface
plan: 02
subsystem: external-analyser-integration
tags: [anno-project, settings-forcing, illegal-opcodes, planted-violation, non-vacuity]

# Dependency graph
requires:
  - phase: 18-persistent-session-and-tool-surface (plan 01)
    provides: "The D-17/D-18 reversal record and Rule A21 this plan's session-reopen gap is scoped against"
provides:
  - "ensureProjectSettings(projectPath, opts?) in anno-project.ts: read-parse-force-rewrite pass over an existing .regen2000proj, forcing settings.use_illegal_opcodes to true and refusing by name on a settings.system mismatch, missing file, malformed JSON, or non-object top level"
  - "AnnoProjectSettingsError, a named error class carrying a public projectPath field, mirroring anno-mcp-client.ts's error convention"
  - "A committed non-vacuity control (a forcing-removed test-only mutant) proving the forcing assertion actually distinguishes the real implementation"
affects: ["18-03 (wires ensureProjectSettings() into anno-session.ts's session-open path)", "18-07 (proves the live-session half: a subsequent mutating save does not revert the forced setting)"]

# Actuals (#2632)
actuals:
  tokens: 4883
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Write-temp-then-renameSync in-place file replacement (matching refresh-manifest.ts's writeManifestAtomic() and broker-epoch.mts's writeEpochRecord()), reused rather than reinvented for a third file-replacement idiom"
    - "Test-only 'forcing-removed mutant' as a committed non-vacuity control, paired with a real-implementation assertion, so a future edit that quietly drops the force is caught by a red test rather than by review"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-project.ts
    - src/mcp/vice/anno-project.test.ts

key-decisions:
  - "ensureProjectSettings() forces use_illegal_opcodes silently (never a throw, never an option to skip) but refuses by name on a settings.system mismatch -- forcing illegal-opcode decoding only ever widens what decodes correctly, while rewriting the machine type could reinterpret every existing block classification (D18-34)."
  - "Shared ANNO_SYSTEM_C64 with synthesizeProject() as the one source of the expected system string rather than a second copy of the forced-values convention (D18-33); synthesizeProject()'s body was left byte-for-byte untouched."
  - "Reworded a pre-existing header comment that duplicated the literal string \"Commodore 64\" (predating this plan) so ANNO_SYSTEM_C64's own definition is the sole occurrence in the file, satisfying the plan's own single-occurrence acceptance criterion (Rule 1 -- required for a stated acceptance criterion to hold, not scope creep)."
  - "The forcing-removed mutant lives only in the test file, is never exported, and is documented as existing solely as a non-vacuity control -- mirroring spawn-seam.test.ts's planted-violation shape rather than inventing a new one."

requirements-completed: [SESS-01]

coverage:
  - id: D1
    description: "ensureProjectSettings() reads an existing .regen2000proj, forces settings.use_illegal_opcodes to true silently, and rewrites the file"
    requirement: SESS-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-project.test.ts#ensureProjectSettings: use_illegal_opcodes false -- forced to true, re-read from disk"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-project.test.ts#ensureProjectSettings: use_illegal_opcodes already true -- idempotent no-op, file unchanged"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-project.test.ts#ensureProjectSettings: no settings key at all -- both use_illegal_opcodes and system get set"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-project.test.ts#ensureProjectSettings: every other key survives the rewrite unchanged (deep equality)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ensureProjectSettings() refuses by name when settings.system is present and does not match the expected system string, rather than rewriting it, leaving the file byte-identical"
    requirement: SESS-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-project.test.ts#ensureProjectSettings: settings.system mismatch throws naming both values, file byte-identical after"
        status: pass
    human_judgment: false
  - id: D3
    description: "ensureProjectSettings() refuses by name when the project file is missing, unreadable, not parseable JSON, or not a top-level JSON object -- never a best-effort continue"
    requirement: SESS-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-project.test.ts#ensureProjectSettings: missing path throws AnnoProjectSettingsError naming the path"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-project.test.ts#ensureProjectSettings: malformed JSON throws naming the path and parse failure, file byte-identical after"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-project.test.ts#ensureProjectSettings: a top-level JSON array throws rather than writing settings onto it"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-project.test.ts#ensureProjectSettings: a top-level JSON primitive throws rather than writing settings onto it"
        status: pass
    human_judgment: false
  - id: D4
    description: "The forced values are shared with synthesizeProject() by referencing the same ANNO_SYSTEM_C64 constant and the same forced-true literal convention, not a second divergent copy"
    requirement: SESS-01
    verification:
      - kind: other
        ref: "acceptance criteria: grep -c 'ANNO_SYSTEM_C64' shows ensureProjectSettings() referencing the constant; grep -c 'Commodore 64' returns 1 (sole occurrence, at the constant's definition); git diff shows zero changed lines inside synthesizeProject()'s body"
        status: pass
    human_judgment: false
  - id: D5
    description: "Removing the forcing step makes the round-trip test go red -- demonstrated, not assumed"
    requirement: SESS-01
    verification:
      - kind: other
        ref: "manual live probe: temporarily removed the force assignment from the real ensureProjectSettings(), observed the real-implementation test go RED with assertion message \"real implementation must force the setting to true -- false !== true\", restored via `git checkout --`, observed green again (24/24 passing); committed non-vacuity pair (real vs. forcing-removed mutant) makes the same proof permanent"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-24
status: complete
---

# Phase 18 Plan 02: ensureProjectSettings() Read-Force-Rewrite Pass Summary

**Added `ensureProjectSettings()` and `AnnoProjectSettingsError` to `anno-project.ts` -- a read-parse-force-rewrite pass over an existing `.regen2000proj` that silently forces `use_illegal_opcodes` to `true` and refuses by name on a `settings.system` mismatch, a missing file, or malformed JSON, proven by 11 new unit tests including a committed non-vacuity control and a live red-then-green probe.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-24T10:03:00+02:00 (approx.)
- **Completed:** 2026-08-24T10:33:10+02:00 (last commit)
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `ensureProjectSettings(projectPath, opts?)` closes the ROADMAP gap the plan's objective named: `synthesizeProject()` only ever forced `use_illegal_opcodes` at creation time, so a session re-opening an older or hand-edited `.regen2000proj` had no path back to the forced setting. The new function reads, parses, force-corrects, and rewrites in place via the write-temp-then-`renameSync` idiom already used by `refresh-manifest.ts` and `broker-epoch.mts`.
- Three distinguishable named refusals, each proven to leave the file byte-identical: a `settings.system` mismatch (sha256-verified unchanged bytes), a missing file, and malformed JSON (sha256-verified unchanged bytes) -- plus a fourth for a non-object top-level JSON value (array or primitive).
- The forced setting and the expected system string are shared with `synthesizeProject()` through the single `ANNO_SYSTEM_C64` constant -- no second copy of the forced-values convention was introduced, and `synthesizeProject()`'s body is byte-for-byte untouched (confirmed via `git diff -U0`, which shows edits only outside its line range).
- The forcing step carries a committed non-vacuity control: a test-only `ensureProjectSettingsForcingRemoved()` mutant performs the identical read-parse-rewrite but omits the force, and a paired assertion proves the real implementation's `true` and the mutant's `false` are genuinely different outcomes -- not two assertions that would both pass regardless.
- A live probe (required by the plan's acceptance criteria, not merely the committed test) removed the force assignment from the real function, observed the real-implementation test go RED, and restored the file via `git checkout --`, confirming green again with a clean `git status`.

## Task Commits

Each task was committed atomically:

1. **Task 1: ensureProjectSettings() -- read, force, refuse, rewrite** - `e789ffd` (feat)
2. **Task 2: Planted-violation coverage for the forcing step** - `8baae6e` (test)

_No TDD tasks in this plan (Task 1 was `tdd="true"` at the plan level but landed as a single feat commit alongside its own `<verify>` run passing before commit, consistent with Task 1's `<verify>` being the unit-half test run rather than a separate RED-commit step; Task 2 supplied the additional coverage and the non-vacuity control as its own commit)._

## Files Created/Modified
- `src/mcp/vice/anno-project.ts` -- added `AnnoProjectSettingsError`, `EnsureProjectSettingsOptions`, and `ensureProjectSettings()`; added a "two settings surfaces" paragraph to the module header; reworded one pre-existing header sentence that duplicated the `Commodore 64` literal
- `src/mcp/vice/anno-project.test.ts` -- added 11 new unit tests for `ensureProjectSettings()` (8 behavior-list cases + the 2-test non-vacuity pair + the always-present availability-gate interaction unaffected) plus the test-only `ensureProjectSettingsForcingRemoved()` mutant helper and a `withTempDir`/`sha256` local test harness

## Decisions Made
See `key-decisions` in frontmatter. Most consequential: the pre-existing module header (predating this plan) already contained the literal string `Commodore 64` in a prose sentence at line 51, which meant the plan's own acceptance criterion ("the string `Commodore 64` appears in `anno-project.ts` exactly once, at the `ANNO_SYSTEM_C64` definition") would fail regardless of anything this plan added. Reworded that one sentence to reference `ANNO_SYSTEM_C64` by name instead of repeating its literal value -- a minimal, in-scope fix (the file was already being edited per the task's own module-header-update instruction) rather than scope creep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing header comment duplicated the `Commodore 64` literal, which would have failed this plan's own acceptance criterion**
- **Found during:** Task 1 (writing the module header update)
- **Issue:** `anno-project.ts`'s original header (predating this plan, present since Phase 9) states "...with the C64 constant equal to the exact literal `Commodore 64`." -- a second occurrence of the literal string beyond the `ANNO_SYSTEM_C64` definition. Task 1's acceptance criteria requires `grep -c 'Commodore 64' src/mcp/vice/anno-project.ts` to return exactly 1.
- **Fix:** Reworded the sentence to say "...with the C64 constant's exact literal value defined once, below, as `ANNO_SYSTEM_C64`." -- same meaning, no literal duplication.
- **Files modified:** src/mcp/vice/anno-project.ts
- **Verification:** `grep -c 'Commodore 64' src/mcp/vice/anno-project.ts` returns 1; full test suite and tsc both clean.
- **Committed in:** e789ffd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix necessary to satisfy the plan's own stated acceptance criterion).
**Impact on plan:** No scope creep -- the edit was to the exact file and exact section (module header) Task 1's action already instructed touching, and was required for the plan's own acceptance criteria to be satisfiable at all.

## Issues Encountered
None.

## Non-Vacuity Proof (Task 2 acceptance criterion)

Live probe against the real, committed `ensureProjectSettings()`:

1. Edited `src/mcp/vice/anno-project.ts` line 334, changing `use_illegal_opcodes: true,` to `use_illegal_opcodes: existingSettings?.use_illegal_opcodes === true,` (identical to the test-only mutant's own non-forcing behavior).
2. Ran `node --test anno-project.test.ts`. Result: test 21, "non-vacuity: the REAL ensureProjectSettings() leaves use_illegal_opcodes true", failed:
   ```
   real implementation must force the setting to true
   false !== true
   ```
3. Restored via `git checkout -- src/mcp/vice/anno-project.ts`; `git status --porcelain src/mcp/vice/anno-project.ts` returned empty (clean).
4. Re-ran the test file: 24/24 passing again.

Before this plan: 13 tests in `anno-project.test.ts`. After: 24 tests (11 more, exceeding the acceptance criterion's "at least 8 more").

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ensureProjectSettings()` and `AnnoProjectSettingsError` are ready for plan 18-03 to wire into `anno-session.ts`'s session-open path, immediately before an external analyser child spawns against the project file.
- This plan deliberately did not touch `anno-session.ts` (it does not exist yet) or wire `ensureProjectSettings()` to any caller -- that wiring, and the tracer proving it end-to-end, is 18-03's job.
- The half only a live session can prove -- that a subsequent mutating call's own save does not revert the forced setting -- remains for plan 18-07, as scoped in the plan's objective.
- No blockers.

---
*Phase: 18-persistent-session-and-tool-surface*
*Completed: 2026-08-24*

## Self-Check: PASSED

- `src/mcp/vice/anno-project.ts` — FOUND
- `src/mcp/vice/anno-project.test.ts` — FOUND
- `.planning/phases/18-persistent-session-and-tool-surface/18-02-SUMMARY.md` — FOUND
- Commit `e789ffd` (feat: ensureProjectSettings()) — FOUND in `git log --all`
- Commit `8baae6e` (test: planted-violation coverage) — FOUND in `git log --all`
- Commit `5922eae` (docs: this SUMMARY) — FOUND in `git log --all`
