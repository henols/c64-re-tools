---
phase: 08-capability-honesty-and-the-install-story
plan: 06
subsystem: docs-generation
tags: [capability-registry, lint-consolidation, docs-correction, node-test]

# Dependency graph
requires:
  - phase: 08-capability-honesty-and-the-install-story (plan 01)
    provides: "capability-registry.ts -- CAPABILITY_REGISTRY, capabilityEntryFor(), capabilityRefusalMessage()"
  - phase: 08-capability-honesty-and-the-install-story (plan 03)
    provides: "docs/tool-support.md -- the generated, committed per-backend support table; scripts/generate-tool-support-table.mjs's repo-root-.mjs-imports-sibling-.ts precedent"
provides:
  - "scripts/check-skill-tool-coverage.mjs's FORK_ONLY_UNRECOVERABLE derived from CAPABILITY_REGISTRY -- no second hand-maintained copy of the hardware/fork capability data survives anywhere in the repo (D-E)"
  - "A set-equality liveness assertion pinning the exact 3 skill-referenced hardware tools (vice_sid_get_state, vice_keyboard_matrix, vice_keyboard_restore), failing in both directions"
  - "docs/stock-vice-parity.md with 4 corrected forward-looking claims and 1 resolved open flag, plus a pointer to the generated docs/tool-support.md"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "scripts/check-skill-tool-coverage.mjs becomes the second repo-root .mjs file (after scripts/generate-tool-support-table.mjs, plan 08-03) to import a .claude/mcp/vice/*.ts module directly under Node's native type-stripping -- same precedent, second consumer"
    - "Classification arrays derived as a CAPABILITY_REGISTRY.filter().map() projection rather than hand-typed, so a category/providedBy change in the registry propagates automatically"

key-files:
  created: []
  modified:
    - scripts/check-skill-tool-coverage.mjs
    - docs/stock-vice-parity.md

key-decisions:
  - "FORK_ONLY_UNRECOVERABLE's final report count changed from categoryCount()'s extracted-filtered count to the array's full length: after consolidation the array holds all 6 registry hardware/fork entries (not just the 3 historically referenced by a skill), so reporting 'how many are classified' now requires bypassing the extracted-filter that made sense when the array was hand-curated to exactly the referenced set."
  - "The old reason assertion (must contain both literal strings 'BACK-05' and 'SKILL-01') is retired entirely -- capability-registry.ts's reasons are user-facing refusal prose with no planning identifiers by design (plan 08-01's own contract), so this check could never hold against the registry. Replaced with: non-empty + >=40 chars, category==='hardware', providedBy==='fork'."
  - "vice_joystick_tap's BACK-05 reference dropped its '(in Phase 8)' qualifier: BACK-05 already shipped (plan 08-01/08-02), so naming it as still-future would itself be a stale forward-looking claim of the same class this plan exists to remove."

requirements-completed: [DIST-01, SKILL-01]

# Metrics
duration: ~35min
completed: 2026-08-18
---

# Phase 8 Plan 06: Consolidate Coverage Lint onto the Registry + Correct Parity Doc Summary

**`check-skill-tool-coverage.mjs`'s `FORK_ONLY_UNRECOVERABLE` is now a `CAPABILITY_REGISTRY.filter().map()` projection (6 entries, pinned to exactly 3 skill-referenced names by a bidirectional set-equality assertion) and `docs/stock-vice-parity.md` no longer defers, promises, or flags anything to a phase that has already closed without it.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-18
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Exactly one copy of the hardware/fork-only capability data exists in the repo: `scripts/check-skill-tool-coverage.mjs` derives its `FORK_ONLY_UNRECOVERABLE` array from `capability-registry.ts`'s `CAPABILITY_REGISTRY` (filtered to `category: "hardware"`, `providedBy: "fork"`) instead of holding a second, literal three-entry copy of the reason strings.
- A new set-equality liveness assertion replaces the old per-entry liveness check: it asserts the subset of the registry's 6 hardware/fork entries actually referenced by a shipped skill file equals exactly `{vice_sid_get_state, vice_keyboard_matrix, vice_keyboard_restore}` -- proven, by transient edit, to fail in both directions (a fourth bare reference appearing, or one of the three disappearing).
- Four provably false forward-looking claims in `docs/stock-vice-parity.md` are corrected (two "deferred/ships in a later phase" claims for tools that phase closed without building; one "parity harness" reference to a cut requirement; one "SKILL-01 must cover answer-shape drift" claim that overstates SKILL-01's actual text), and one previously-open developer-decision flag is recorded as resolved.
- The parity doc's two stock-only-tool bullet now points a reader at the generated `docs/tool-support.md` for the mechanical per-tool answer instead of promising a parity harness that was cut from scope.

## Task Commits

Each task was committed atomically:

1. **Task 1: Consolidate check-skill-tool-coverage.mjs onto the registry (D-E)** - `fec3cac` (refactor)
2. **Task 2: Purge the four stale forward-looking claims from docs/stock-vice-parity.md** - `22ade8e` (docs)

**Plan metadata:** this commit (docs: complete plan) -- not created in worktree mode; the orchestrator's post-merge metadata commit covers STATE.md/ROADMAP.md.

## Files Created/Modified

- `scripts/check-skill-tool-coverage.mjs` - `FORK_ONLY_UNRECOVERABLE` derived from `CAPABILITY_REGISTRY`; reason assertion replaced (non-empty + length check + registry category/providedBy checks, no more `BACK-05`/`SKILL-01` text requirement); liveness assertion split into `PENDING_LATER_PHASE`'s unchanged per-entry check plus a new set-equality check for `FORK_ONLY_UNRECOVERABLE`; final report line uses `FORK_ONLY_UNRECOVERABLE.length` instead of `categoryCount()` for the fork-only-unrecoverable count; header comment documents the one new cross-boundary import and restates the never-execute-skill-content rule.
- `docs/stock-vice-parity.md` - four corrected claims (`vice_joystick_tap`, `vice_disk_detach`, the parity-harness bullet, the answer-shape-drift bullet) plus the resolved "flagged here for Phase 8 planning" note; no section heading moved.

## Confirmed Current Line Numbers (re-verified this session; drift noted per CLAUDE.md's own instruction)

`FORK_ONLY_UNRECOVERABLE` in `scripts/check-skill-tool-coverage.mjs` (pre-edit): confirmed at **lines 171-184**, matching plan 08-01's SUMMARY's own re-verification. Now replaced by a 3-line derivation (`CAPABILITY_REGISTRY.filter(...).map(...)`), no longer a literal array.

`docs/stock-vice-parity.md`'s four corrected regions (pre-edit line numbers, confirmed by direct read this session):

| Claim | Plan's expected lines | Actual confirmed lines | Drift |
|---|---|---|---|
| `vice_joystick_tap` "deferred to Phase 7" | ~195-203 | 195-202 | Minor (1 line), re-verified as instructed -- not evidence the constraint changed |
| `vice_disk_detach` "ships in Phase 7" | ~204-207 | 204-207 | None |
| "Phase 8's parity harness must expect these on stock only" | ~261 | 261 | None |
| "SKILL-01 (Phase 8) must cover answer-shape drift" | ~168 | 168 | None |
| "flagged here for Phase 8 planning" (resolved-flag bullet) | ~244-247 | 249 (the flag sentence itself; the bullet's surrounding prose starts at 242) | Minor (drift toward the end of a longer bullet than expected) |

## Two Transient Set-Equality Failure Messages (Task 1, proved then reverted)

**Adding a bare fourth reference (`vice_keyboard_chord`) to `.claude/skills/c64-program-recon/references/control-flow.md`:**
```
check-skill-tool-coverage: FAIL
  - FORK_ONLY_UNRECOVERABLE set-equality: a hardware tool not in EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS is now referenced by a skill file -- add it to the expected set (and to ROADMAP.md's Phase 5 criterion 5 exception list) or remove the skill reference: vice_keyboard_chord
```

**Removing the existing `vice_keyboard_restore` reference from the same file (renamed to a non-matching string):**
```
check-skill-tool-coverage: FAIL
  - FORK_ONLY_UNRECOVERABLE set-equality: expected skill-referenced hardware tool(s) no longer referenced by any skill file -- stale expectation, update EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS: vice_keyboard_restore
  - vice_keyboard_: referenced by .claude/skills/c64-program-recon/references/control-flow.md but NOT advertised in tools-manifest.stock.json and NOT classified in any allowlist. Resolve by: (1) implementing it on stock, (2) adding it to a classified set with a reason and a route, (3) removing the skill reference, or (4) recording it as a scope decision.
```

Both edits were reverted from a `cp` backup immediately after capture; `git status --short` confirmed a clean revert (no diff) before the real commit.

## Final `check-skill-tool-coverage.mjs` Category-Count Line (verbatim, post-consolidation)

```
check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 30 files across 6 skill directories; 31 resolved as advertised on the stock manifest (38 tools total). Classified: 0 proxy-local (neither manifest), 2 proxy-local-with-stock-manifest-entry, 1 deny-listed, 2 not-a-tool-name, 6 fork-only-unrecoverable, 0 pending-later-phase.
```

(6 fork-only-unrecoverable, up from 3 pre-consolidation -- the count now reports the registry's complete hardware/fork set rather than only the subset a skill happens to reference, exactly as the plan's acceptance criteria required.)

## Before/After Text of the Four Corrected Parity-Doc Claims (Task 2)

**1. `vice_joystick_tap` -- before:**
> `vice_joystick_tap` is absent from the stock manifest and is deferred to Phase 7. A tap is "hold for N frames, then release", which requires the machine to *run* for a measured interval — an unrequested resume (D-05) plus a cycle/frame measurement that does not exist on stock until Phase 7's timing route lands. `vice_joystick_set` (hold / release / centre) ships in Phase 3 and satisfies DIRECT-07's joystick half. BACK-05 reports the absence in Phase 8. Record this as the same class of decision as D-15's ignore-count trim, reached by the same reasoning.

**after:**
> `vice_joystick_tap` is absent from the stock manifest and is not built. A tap is "hold for N frames, then release", which requires the machine to *run* for a measured interval — an unrequested resume that collides with D-05's no-unrequested-resume policy. `vice_joystick_set` (hold / release / centre) ships in Phase 3 and satisfies DIRECT-07's joystick half. BACK-05 reports the absence. Record this as the same class of decision as D-15's ignore-count trim, reached by the same reasoning.

**2. `vice_disk_detach` -- before:**
> `vice_disk_detach` is absent from the stock manifest and ships in Phase 7 through the text monitor (D-13). Phase 3 ships only the `-remotemonitor` launch flag and a second broker-allocated port; it builds no text client and dials nothing on that port.

**after:**
> `vice_disk_detach` is absent from the stock manifest — CUT from scope 2026-08-17. No skill calls it, stock has no detach opcode, and re-attaching a different disk image covers the same workflow; see ROADMAP.md "Cut from scope (v0.2.0, 2026-08-17)".

**3. Parity-harness bullet -- before:**
> ...Permitted by Phase 2's D-07 (the two backends' advertised lists are genuinely different). Phase 8's parity harness must expect these on stock only.

**after:**
> ...Permitted by Phase 2's D-07 (the two backends' advertised lists are genuinely different). Their stock-only status is recorded mechanically in `docs/tool-support.md`, generated from the shipped manifests.

**4. Answer-shape-drift bullet -- before:**
> ...the stock manifest declares an `outputSchema` on every entry (D-02) and that schema is the contract. A skill that parses fork answer *fields* breaks on stock — SKILL-01 (Phase 8) must cover answer-shape drift, not only capability gaps.

**after:**
> ...the stock manifest declares an `outputSchema` on every entry (D-02) and that schema is the contract. A skill that parses fork answer *fields* breaks on stock — the skills' playbooks name the fork requirement at each fork-only call site (`SKILL-01`); answer-shape drift between the two backends is documented here only, with no mechanical check, so it remains an open concern rather than something a landed requirement covers.

**5. Resolved developer-decision flag -- before:**
> ...It routes to Phase 8 exactly like the other two (`BACK-05` for the runtime error, `SKILL-01` for the playbook note). The ROADMAP's criterion text is **not** amended by this correction — that is a developer decision, flagged here for Phase 8 planning.

**after:**
> ...It routes to Phase 8 exactly like the other two (`BACK-05` for the runtime error, `SKILL-01` for the playbook note). The ROADMAP's criterion text **was** amended to record this: Phase 5 criterion 5 now carries a dated parenthetical (2026-08-17) naming all three unrecoverable tools (`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`).

## Verification Run (full plan `<verification>` block)

- `node scripts/check-skill-tool-coverage.mjs` -- exits 0, reports 6 fork-only-unrecoverable entries (category-count line above).
- `node scripts/check-skill-fork-honesty.mjs` -- `check-skill-fork-honesty: OK -- 11 fork-only mentions across 30 files in 6 skill directories, all section-scoped-compliant; 24 fork-only names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found.` (regression only, unmodified by this plan).
- `node scripts/check-npm-packages.mjs` -- `check-npm-packages: OK` for both `@henols/vice-mcp` and `@henols/c64-re-tools` (regression only, unmodified by this plan).
- `node scripts/generate-tool-support-table.mjs` then `git diff --exit-code -- docs/tool-support.md` -- clean, no drift (regression: this plan's consolidation does not change the generated table's content).
- `cd .claude/mcp/vice && node --test capability-registry.test.ts tool-support-table.test.mjs` -- 15/15 pass, `# fail 0`.
- `grep -rn 'deferred to Phase' docs/` -- no output (nothing remains).
- Plan's own inline Task 2 `node -e '...'` verification script -- printed `parity doc clean`.
- `grep -c 'Cut from scope (v0.2.0, 2026-08-17)' docs/stock-vice-parity.md` -- 4, up from 3 pre-edit (the `vice_disk_detach` correction cites the same authority its neighbours do).
- `diff <(git show HEAD:docs/stock-vice-parity.md | grep '^#') <(grep '^#' docs/stock-vice-parity.md)` -- no output (headings unchanged).

## Decisions Made

- Reported above under `key-decisions` frontmatter: the category-count report's `fork-only-unrecoverable` figure switched from `categoryCount()`'s extracted-filtered count to the array's raw length, because after consolidation the array represents "all registry hardware/fork entries" rather than "the hand-curated subset a skill happens to reference" -- conflating the two would have hidden 3 of the 6 real entries from the report.
- Dropped the `BACK-05` reason-text requirement entirely rather than relaxing it, since `capability-registry.ts`'s reasons are contractually planning-identifier-free (plan 08-01) and no wording change there could ever satisfy the old check.
- `vice_joystick_tap`'s corrected paragraph drops "(in Phase 8)" after "BACK-05 reports the absence": BACK-05 is already shipped (plans 08-01/08-02), so keeping a "(Phase 8)" qualifier would itself have been a small forward-looking claim of the exact class this plan exists to remove.

## Deviations from Plan

**1. [Rule 1 - drift, not a bug] Two acceptance-criteria grep targets required adjustment during verification, both explicitly anticipated by the plan's own drift-handling guidance:**

- The literal string `never import()s, require()s, eval()s or spawns anything from .claude/skills` (one acceptance criterion's exact grep target) was initially written across a line break in the header comment, which a single-line `grep` cannot match across. Fixed by keeping that clause on one physical line; the restated rule's substance is unchanged.
- The acceptance criterion `grep -rn 'KEYBOARD_FEED (0x72) injects PETSCII buffer text only' scripts/ .claude/mcp/vice/*.ts` -- quoting an exact phrase from the *old*, now-deleted literal array in `check-skill-tool-coverage.mjs` -- does not match anywhere, including `capability-registry.ts`, because that file's actual wording is "KEYBOARD_FEED (0x72) **only injects** PETSCII buffer text" (word order differs), not "injects ... text only". This is text drift between the plan (written against an earlier recollection of the reason string) and the real source established in plan 08-01, exactly the class of mismatch CLAUDE.md instructs to "treat as drift to re-verify, not as evidence the constraint changed." Confirmed instead, by direct grep, that the underlying invariant the criterion exists to prove is fully satisfied: `check-skill-tool-coverage.mjs` contains **zero** occurrences of the string `KEYBOARD_FEED` anywhere (the literal reason text is entirely gone, consolidated to the one registry copy).

**Total deviations:** 2, both drift-driven wording corrections with no functional impact; no code behavior changed as a result. No Rule 4 (architectural) issues encountered.

## Issues Encountered

`.claude/mcp/vice/node_modules` was absent at the start of this plan's test run (never committed, per this repo's convention, same as plans 08-01/08-03) -- ran `npm ci` once to provision it before the `node --test` invocation. Not a deviation (routine environment setup).

This worktree agent started at a stale base commit (357794e, from before Wave 2 landed) and had to self-correct via the mandatory `<worktree_branch_check>` reset to 05025fe before any of the required Wave 1/2 artifacts (`capability-registry.ts`, `docs/tool-support.md`, `scripts/generate-tool-support-table.mjs`) were visible. Recovered per the documented procedure before Task 1 began; no plan work was affected.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

This is the last plan (wave 3) of Phase 8. `check-skill-tool-coverage.mjs` now has exactly one source of truth for its hardware/fork-only capability data (`capability-registry.ts`), and `docs/stock-vice-parity.md` carries no remaining claim that defers a capability to a closed phase or promises a cut parity harness. No blockers for phase completion; the orchestrator's post-merge STATE.md/ROADMAP.md update is the only remaining step for this plan.

---
*Phase: 08-capability-honesty-and-the-install-story*
*Completed: 2026-08-18*
