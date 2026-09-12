---
phase: 52-remove-the-fork-backend
plan: 09
subsystem: testing
tags: [ci-gate, documentation-honesty, fork-removal, README, capability-registry]

# Dependency graph
requires:
  - phase: 52-remove-the-fork-backend (52-07)
    provides: capability-registry.ts deleted, docs/stock-hard-losses.md as the six-loss acceptance record
  - phase: 52-remove-the-fork-backend (52-08)
    provides: every skill file rewritten to state permanent limitations citing docs/stock-hard-losses.md, zero fork mentions in src/skills/
provides:
  - scripts/check-skill-capability-honesty.mjs, the inverted and renamed documentation-honesty CI gate, still blocking, still non-vacuous
  - README.md and docs/stock-vice-parity.md rewritten to describe one backend
  - CLAUDE.md / .planning/PROJECT.md Constraints list corrected of every claim about a deleted file or a second backend
affects: [ci-workflow, docs, requirements-FORKRM-03, requirements-FORKRM-05]

# Actuals (#2632)
actuals:
  tokens: 68000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate inversion, not deletion: a CI-blocking documentation-honesty check whose subject was removed gets every assertion re-pointed at the surviving obligation, never dropped -- the file's own header already carried this precedent from an earlier re-pointing"
    - "A literal, hand-maintained six-name set replaces a registry-derived one when the registry itself is retired prose (docs/stock-hard-losses.md), not an importable module -- the WHAT-NOT-TO-DO note explains why this is the one place a hand-copied list is the correct call"

key-files:
  created: []
  modified:
    - scripts/check-skill-capability-honesty.mjs (renamed via git mv from check-skill-fork-honesty.mjs)
    - .github/workflows/ci.yml
    - src/mcp/vice/ci-guardrails.test.mjs
    - src/mcp/vice/audit-root-args.test.ts
    - src/mcp/vice/skill-honesty-checks.test.ts
    - scripts/lib/skill-corpus.mjs
    - scripts/lib/skill-honesty-checks.mjs
    - scripts/lib/skill-descriptions.mjs
    - scripts/check-skill-description-overlap.mjs
    - README.md
    - docs/stock-vice-parity.md
    - CLAUDE.md
    - .planning/PROJECT.md

key-decisions:
  - "Inverted and renamed check-skill-fork-honesty.mjs to check-skill-capability-honesty.mjs rather than deleting it; every assertion re-pointed at the six permanent stock hard-losses instead of the deleted CAPABILITY_REGISTRY."
  - "audit-root-args.test.ts's MATRIX row for the renamed gate moved from contained:refuses to contained:synthetic-corpus, and its hardcoded bound/clean population assertions were updated (2 refusing scripts, 3 clean) to match -- the inversion removed the gate's only static ../src import, so there is no split-read hazard left to refuse."
  - "CLAUDE.md/PROJECT.md's Testing bullet was restated against stock-run-until.ts rather than removed: it honors the exactly-one-resume-per-wait invariant in event-driven, unit-tested form. The sibling poll-on-hit_count invariant was not restated as its own rule, since stock-diagnose.ts explicitly uses wall-clock timing instead by its own comment."

patterns-established:
  - "Pattern: when a fixed-position test matrix (audit-root-args.test.ts) hardcodes a population's size or membership as a non-vacuity floor, an inversion that changes a member's own properties (no longer binding a static import) must retype that row AND update the hardcoded floor/list in the same commit, or the suite reds on a stale expectation instead of the intended defect."

requirements-completed: [FORKRM-03, FORKRM-05]

coverage:
  - id: D1
    description: "The documentation-honesty CI gate is inverted and renamed (not deleted, not replaced by a manual grep), asserting the surviving obligation against the six permanent stock hard-losses"
    requirement: "FORKRM-03"
    verification:
      - kind: unit
        ref: "node scripts/check-skill-capability-honesty.mjs (exit 0, non-vacuous counts)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-honesty-checks.test.ts (12/12 pass)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts (46/46 pass)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/ci-guardrails.test.mjs (20/20 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "README.md and docs/stock-vice-parity.md no longer describe a two-backend world; every permanently-unavailable capability is still named"
    requirement: "FORKRM-03"
    verification:
      - kind: unit
        ref: "grep -ac assertions in this plan's own <verify> blocks, reproduced manually (VICE_BACKEND=0, docs/tool-support.md=0, docs/stock-hard-losses.md>=1, vice_sid_get_state>=1, vice_keyboard_matrix>=1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CLAUDE.md and .planning/PROJECT.md's Constraints list no longer cite a deleted file (manifest-arg-compat.test.ts, vice-sync.ts) or a per-backend trim, and stay byte-identical"
    requirement: "FORKRM-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-constraints-sync.test.ts (byte-identity, 8/8 pass)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-fork-decision.test.ts (7/7 pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The automated suite's failure SET matches the 6-member pre-existing floor, with no new member"
    verification:
      - kind: integration
        ref: "npm run test:automated, run twice, both runs producing the identical 6-member set"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 09: Invert the Documentation-Honesty Gate and Clear the Last Two-Backend Prose Summary

**Renamed and inverted `check-skill-fork-honesty.mjs` into `check-skill-capability-honesty.mjs` (policing a literal six-tool permanent-loss set instead of the deleted `CAPABILITY_REGISTRY`), rewrote README.md/docs/stock-vice-parity.md/CLAUDE.md/PROJECT.md to describe one backend, and closed all 7 of the fork-honesty-crash suite failures the orchestrator handed off — the automated suite is back to its 6-member pre-existing floor.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-12T10:20:00Z (approx, continuing directly from plan 52-08's completion)
- **Completed:** 2026-09-12T10:55:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- `scripts/check-skill-capability-honesty.mjs` (renamed via `git mv`, history preserved) inverts every assertion the fork-era script made: a literal `PERMANENTLY_UNAVAILABLE` six-name array (matching `docs/stock-hard-losses.md`'s hardware losses) replaces the `CAPABILITY_REGISTRY`-derived `FORK_ONLY_NAMES` set; the proximity annotation phrase moves from `fork-only|requires the fork` to `permanently unavailable`; README's required-string set drops `VICE_BACKEND`/`docs/tool-support.md` and gains `docs/stock-hard-losses.md`, with `VICE_BACKEND` newly forbidden; the parity-doc required string moves from the dead `docs/tool-support.md` pointer to a literal proving the new dated removal note exists. Every non-vacuity floor is replaced against its new subject (6 tool names, 8 permanent-limitation mentions, 5 hard-losses citations across the skills tree) rather than dropped.
- Because the inversion removed the script's only static `../src/` import, it no longer needs to refuse a contained non-default `--root` — `audit-root-args.test.ts`'s `MATRIX` row for it moved from `contained: "refuses"` to `contained: "synthetic-corpus"`, and its two hardcoded population assertions (`bound.length >= 3` → `>= 2`; the `clean` array gaining a third member) were updated to match.
- `.github/workflows/ci.yml`'s blocking step and `ci-guardrails.test.mjs`'s frozen `GUARD_SCRIPTS` array both now name the renamed file; `skill-honesty-checks.test.ts`'s `CI_SCRIPT` constant and its "OK" assertion were repointed too. Comment-only citations in `scripts/lib/skill-corpus.mjs`, `skill-honesty-checks.mjs`, `skill-descriptions.mjs` and `check-skill-description-overlap.mjs` were fixed for consistency (not load-bearing, but they named the old file).
- `README.md` no longer describes a `VICE_BACKEND` selection or a fork build to install; the two named permanently-unavailable tools plus their three siblings are restated as permanent limitations citing `docs/stock-hard-losses.md`, which also replaces the dead `docs/tool-support.md` pointer in both the body and the Layout tree. The absolute-path note about `x64sc` shadowing on `PATH` is restated as a hazard about a non-stock build, not a supported backend.
- `docs/stock-vice-parity.md` gets a dated top note (2026-09-12) recording the fork's removal and explaining why a "parity" document survives with nothing left to compare against; its historical measurement records and `(Phase N, REQ-ID)` citations are untouched. Repointed its one dead `docs/tool-support.md` reference and reworded Section C's closing paragraph out of present-tense migration-decision framing (also dropping a stale "PNG screenshots" claim — `vice_display_screenshot` was cut from scope and never shipped on either backend).
- `CLAUDE.md`'s Compatibility bullet is re-pinned to the renamed gate; its Testing bullet is restated against `stock-run-until.ts` (the surviving, unit-tested module honoring the exactly-one-resume-per-wait invariant); its Architecture bullet states the frozen emulator-spawn set is now empty (matching plan 52-06's `FORKRM-01`); a Protocol bullet's `vice-sync.ts` citation is restated independently of that deleted file. `.planning/PROJECT.md`'s byte-identical Constraints copy carries the same four edits in the same commit, plus two unrelated `vice-sync.ts` mentions in its Key Decisions table (outside the byte-synced section) were reworded to describe the surviving invariant without naming the deleted file.

## Task Commits

1. **Task 1: Invert and rename the documentation-honesty gate** — `47432e50` (fix)
2. **Task 2: Rewrite README.md and docs/stock-vice-parity.md for a single backend** — `38464dcb` (docs)
3. **Task 3: Rewrite the two falsified CLAUDE.md constraints, byte-identically in PROJECT.md** — `8dcbb9b9` (docs)

## Files Created/Modified

- `scripts/check-skill-capability-honesty.mjs` — the inverted, renamed documentation-honesty gate (was `check-skill-fork-honesty.mjs`)
- `.github/workflows/ci.yml` — blocking step renamed
- `src/mcp/vice/ci-guardrails.test.mjs` — frozen `GUARD_SCRIPTS` list renamed
- `src/mcp/vice/audit-root-args.test.ts` — `MATRIX` row retyped, bound/clean population assertions updated
- `src/mcp/vice/skill-honesty-checks.test.ts` — `CI_SCRIPT` constant and OK-message assertion repointed
- `scripts/lib/skill-corpus.mjs`, `scripts/lib/skill-honesty-checks.mjs`, `scripts/lib/skill-descriptions.mjs`, `scripts/check-skill-description-overlap.mjs` — comment-only citations repointed
- `README.md` — VICE_BACKEND/fork-build install instructions removed; permanent-limitation framing added; dead doc pointer repointed
- `docs/stock-vice-parity.md` — dated removal note added; one dead pointer and one stale present-tense closing paragraph repointed
- `CLAUDE.md`, `.planning/PROJECT.md` — Compatibility/Testing/Architecture Constraints bullets and Project prose corrected; byte-identity preserved

## Decisions Made

See `key-decisions` in frontmatter for the full record. In short: the gate is inverted rather than replaced by a hand grep (the threat model names this as the mitigation); the audit-root-args test matrix's hardcoded population counts moved with the gate's own architecture change (no more static `../src/` import, so no more split-read hazard to refuse); and the Testing constraint bullet follows the one surviving invariant to its new home (`stock-run-until.ts`) rather than being deleted wholesale, since one of its two named invariants is genuinely still honored (in an improved, unit-tested form) while the other is not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `audit-root-args.test.ts` and `skill-honesty-checks.test.ts` needed edits despite not being in the plan's `files_modified` list**
- **Found during:** Task 1
- **Issue:** The plan's `files_modified` list did not name these two test files, but both spawn `check-skill-fork-honesty.mjs` by literal filename and both crashed (`ERR_MODULE_NOT_FOUND`) the moment the rename landed without them. This matches the orchestrator's own `<you_close_the_last_red>` framing, which explicitly named these as 6 of the 7 originally-failing tests to close.
- **Fix:** Repointed `audit-root-args.test.ts`'s `MATRIX` row (script name, `contained` type, and the two hardcoded population assertions this required) and `skill-honesty-checks.test.ts`'s `CI_SCRIPT` constant plus its "OK" message assertion.
- **Files modified:** `src/mcp/vice/audit-root-args.test.ts`, `src/mcp/vice/skill-honesty-checks.test.ts`
- **Verification:** Both files run green in isolation (`node --test audit-root-args.test.ts` 46/46, `node --test skill-honesty-checks.test.ts` 12/12); full automated suite failure set matches the 6-member floor.
- **Committed in:** `47432e50` (Task 1 commit)

**2. [Rule 1 - Bug] The renamed gate's docs/stock-vice-parity.md required-string set pointed at a dead link left over from the fork-era version**
- **Found during:** Task 1
- **Issue:** `REQUIRED_PARITY_SUBSTRINGS` still required `docs/tool-support.md`, a document plan 52-07 deleted. Requiring it would either fail the gate permanently or force Task 2 to re-add a dead-link reference just to satisfy a stale check.
- **Fix:** Replaced the required string with a literal (`"the fork backend was removed"`) proving the parity doc's own dated removal note exists — the re-pointing the file's own header names as the correct repair pattern.
- **Files modified:** `scripts/check-skill-capability-honesty.mjs`
- **Verification:** `node scripts/check-skill-capability-honesty.mjs` exits 0 once Task 2's parity-doc edit lands; `grep -ac 'docs/tool-support.md' docs/stock-vice-parity.md` is 0.
- **Committed in:** `47432e50` (Task 1 commit)

**3. [Rule 1 - Bug] Screenshot capability claimed in two places that were never actually true**
- **Found during:** Task 2
- **Issue:** README.md's feature list and `docs/stock-vice-parity.md`'s Section C both claimed the plugin ships PNG screenshots. `vice_display_screenshot` was CUT from scope 2026-08-17 (per `docs/stock-vice-parity.md`'s own item A.6) and is absent from `tools-manifest.stock.json` — the claim was false independent of the fork's removal, adjacent to text this task was already rewriting.
- **Fix:** Removed the screenshot claim from both locations rather than carrying it forward unqualified.
- **Files modified:** `README.md`, `docs/stock-vice-parity.md`
- **Verification:** `grep -c vice_display_screenshot tools-manifest.stock.json` is 0 (tool genuinely absent); the removed claim is no longer present in either file.
- **Committed in:** `38464dcb` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs).
**Impact on plan:** All three were necessary to reach a genuinely green suite rather than a script that merely exits 0 in isolation. No scope creep — no skill file under `src/skills/` was touched (plan 52-08's territory, confirmed untouched).

## Known Non-Issues (named, not silently dropped)

- `grep -aic 'fork' CLAUDE.md` returns `1` and `grep -aic 'fork' README.md` returns `1` — both survivors are Debian's `forky` testing-release codename (`CLAUDE.md`'s `CPUHISTORY_GET` Dependency bullet and README's distro table), matched only because the case-insensitive grep the plan's own `<verify>` command uses also matches the substring `fork` inside `forky`. Neither is a backend mention; both pre-date this phase.
- The pre-existing floor's `no milestone audit declares a gated status while any docs guard is red (D-12-02)` test was checked explicitly per the task_baseline instruction to watch for a flip. It did **not** flip: it fails for the same reason both before and after this plan's work — `docs-deferred-ledger.test.ts` (an unrelated docs guard, carrying the pre-existing `AUDIT-04` gap) reports non-zero, which this integrity test treats as "a docs guard is red" regardless of which of its own sub-assertions failed. `docs-constraints-sync.test.ts` and `docs-fork-decision.test.ts` — the two guards this plan's work could plausibly have flipped — both pass in isolation (confirmed via `node --test docs-constraints-sync.test.ts docs-fork-decision.test.ts`, 15/15).

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both plan requirements (`FORKRM-03`, `FORKRM-05`) marked complete.
- The automated suite is back to its 6-member pre-existing floor (verified across two consecutive runs, identical member set both times) — none of the floor members are new or caused by this plan.
- `node scripts/check-npm-packages.mjs`, `node scripts/check-skill-tool-coverage.mjs`, and `npm run typecheck` all exit 0.
- Phase 52 now stands at 9/10 plans summarized (see ROADMAP.md); one more plan remains before this phase can close.

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*

## Self-Check: PASSED
