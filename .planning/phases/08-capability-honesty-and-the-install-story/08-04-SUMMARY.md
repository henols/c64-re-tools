---
phase: 08-capability-honesty-and-the-install-story
plan: 04
subsystem: skills
tags: [skill-docs, lint, capability-registry, markdown, node-fs]

# Dependency graph
requires:
  - phase: 08-capability-honesty-and-the-install-story
    provides: "capability-registry.ts (08-01) -- CAPABILITY_REGISTRY, the single source of truth for which tool names require an annotation"
provides:
  - "scripts/check-skill-fork-honesty.mjs -- section-scoped proximity lint over .claude/skills/, deriving its policed name list from CAPABILITY_REGISTRY"
  - "Four annotated fork-only call sites naming the fork requirement and the stock route"
  - "A stale-forward-reference guard (research Pitfall 5) using a possessive Phase-N's pattern"
affects: [08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Markdown-section-scoped proximity check: split a skill .md file at ATX headings, treat a tool mention as compliant when ANY annotation signal appears anywhere in its own section body -- not a fixed +/-N-line window"
    - "Stale-phase-reference detection narrowed to a possessive Phase-N's idiom rather than a bare same-line co-occurrence, to avoid false-positiving on a citation of a third party's own doc string"

key-files:
  created:
    - scripts/check-skill-fork-honesty.mjs
  modified:
    - .claude/skills/c64-program-recon/SKILL.md
    - .claude/skills/c64-program-recon/references/sound-and-input.md
    - .claude/skills/c64-program-recon/references/observation-hazards.md
    - .claude/skills/c64-program-recon/references/control-flow.md
    - .claude/skills/c64-ram-capture/SKILL.md

key-decisions:
  - "The stale-forward-reference check uses a possessive `Phase N's` pattern (matching the idiom this project's own prose uses to hand a capability to a future phase) rather than the plan's literal 'Phase \\d co-occurring with deferred/not yet/until/unavailable on the same line' spec, because the literal spec false-positives on tool-selection.md:39's unrelated citation of the fork's own '*not yet implemented*' schema text. Verified: the possessive form matches exactly the one line that needed fixing (control-flow.md:92) and excludes the false positive."
  - "The proximity lint walks the same .md+.mjs file set as check-skill-tool-coverage.mjs (copied verbatim), but only applies the ATX-heading section split to .md files -- .mjs files carry no markdown section structure to scope against, and no fork-only mention exists in any .mjs file in this tree today."
  - "Names to police are every CAPABILITY_REGISTRY entry with providedBy: \"fork\" (24 entries: 6 hardware + 18 descoped), not filtered to the hardware category, per the plan's own instruction that a descoped fork-only tool named bare is the same failure class."

patterns-established:
  - "scripts/check-skill-fork-honesty.mjs is the ONE place that checks proximity honesty of fork-only tool mentions in playbook prose; plan 08-05 extends it (README presence checks) rather than re-deriving its walk or extraction."

requirements-completed: [SKILL-01]

# Metrics
duration: 20min
completed: 2026-08-18
---

# Phase 8 Plan 04: Skill Fork-Honesty Lint and Annotation Summary

**A CI-runnable, section-scoped proximity lint (`scripts/check-skill-fork-honesty.mjs`) driven entirely by `capability-registry.ts`, plus four newly-annotated fork-only call sites naming both the fork requirement and the stock route.**

## Performance

- **Duration:** ~20 min (22:00 -> 22:20 local, task commits)
- **Started:** 2026-08-18T22:00:00+02:00 (approx, base commit `eaa49b5`)
- **Completed:** 2026-08-18T22:20:28+02:00 (final task commit `3038edb`)
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 edited)

## Accomplishments
- `scripts/check-skill-fork-honesty.mjs` derives its policed tool-name list from `CAPABILITY_REGISTRY` (24 `providedBy: "fork"` entries) -- no second hand-maintained list exists anywhere in the repo.
- Before Task 2's edits, the lint named exactly the four known bare mentions (plus one known stale forward reference), proving it detects the real gaps rather than passing vacuously; after Task 2, it exits 0.
- The four bare `vice_keyboard_matrix` mentions across `c64-program-recon` and `c64-ram-capture` now each state the fork requirement, the reason (`KEYBOARD_FEED` injects buffer text only), and the stock route (`vice_keyboard_type` / `vice_keyboard_petscii` / `vice_joystick_set`, with the `$DC00`/`$DC01` caveat).
- `control-flow.md`'s stale future-tense sentence about `vice_keyboard_restore` ("Phase 8's `BACK-05` is what reports...") now describes present runtime behaviour and names no phase.
- Both lints (`check-skill-fork-honesty.mjs`, the sibling `check-skill-tool-coverage.mjs`) and `check-npm-packages.mjs` exit 0; the vice test-gate passes 1635/1635 (0 fail, 5 todo).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write scripts/check-skill-fork-honesty.mjs** - `03e3308` (feat)
2. **Task 2: Annotate the four bare fork-only mentions** - `3038edb` (docs)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `scripts/check-skill-fork-honesty.mjs` - section-scoped proximity lint; derives its policed name list from `CAPABILITY_REGISTRY`, splits each skill `.md` file at ATX headings, flags a fork-only mention with no annotation signal in its own section, plus a possessive-form stale-phase-reference guard
- `.claude/skills/c64-program-recon/SKILL.md` - Troubleshooting table row for `vice_keyboard_matrix` now names the fork requirement and points at `observation-hazards.md` section 4
- `.claude/skills/c64-program-recon/references/sound-and-input.md` - "Three CIA hazards" bullet states the fork requirement, reason, and stock route
- `.claude/skills/c64-program-recon/references/observation-hazards.md` - section 4 ("The keyboard buffer is not how games read keys") carries the fullest treatment: fork requirement, reason, stock route, `$DC00`/`$DC01` caveat
- `.claude/skills/c64-program-recon/references/control-flow.md` - `vice_keyboard_restore` paragraph's future tense corrected to present-tense runtime behaviour, no phase named
- `.claude/skills/c64-ram-capture/SKILL.md` - "Find an entry point" step 1 states the fork requirement self-containedly (this skill mentioned no backend anywhere before this edit)

## Verbatim Pre-Fix Lint Output (Task 1, before Task 2's edits)

```
check-skill-fork-honesty: FAIL
  - .claude/skills/c64-program-recon/SKILL.md:171: "vice_keyboard_matrix" mentioned in section "Troubleshooting" with no fork-requirement annotation in that section -- state that it requires the fork backend. Stock route: vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection.
  - .claude/skills/c64-program-recon/references/control-flow.md:92: stale forward reference to a numbered phase ("PETSCII text into the buffer) cannot produce it. This call is unavailable on stock; Phase 8's") -- state the current truth instead, and name no future phase
  - .claude/skills/c64-program-recon/references/observation-hazards.md:103: "vice_keyboard_matrix" mentioned in section "4. The keyboard buffer is not how games read keys" with no fork-requirement annotation in that section -- state that it requires the fork backend. Stock route: vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection.
  - .claude/skills/c64-program-recon/references/sound-and-input.md:64: "vice_keyboard_matrix" mentioned in section "Three CIA hazards" with no fork-requirement annotation in that section -- state that it requires the fork backend. Stock route: vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection.
  - .claude/skills/c64-ram-capture/SKILL.md:158: "vice_keyboard_matrix" mentioned in section "Find an entry point" with no fork-requirement annotation in that section -- state that it requires the fork backend. Stock route: vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection.
```

Note: this pre-fix run named **five** sites, not four -- the plan's `<behavior>` block's "exactly four sites" describes the bare-mention proximity errors specifically; Task 2's own text separately confirms the stale-forward-reference check (`control-flow.md:92`) also fails before that same task's fix, which lands in the same commit as three of the four bare-mention fixes.

## Re-verified Line Numbers (all five edit sites, at execution time)

| File | Plan's cited line | Re-verified line | Drift |
|---|---|---|---|
| `c64-program-recon/SKILL.md` Troubleshooting row | ~171 | 171 | none |
| `references/sound-and-input.md` CIA hazards bullet | ~64 | 64 (mention), edit inserted after line 65 | none |
| `references/observation-hazards.md` section 4 | ~103 | 103 (mention) | none |
| `c64-ram-capture/SKILL.md` step 1 | ~158 | 158 | none |
| `references/control-flow.md` `vice_keyboard_restore` paragraph | 90-93 | 90-93 | none |

All five sites matched the plan's cited locations exactly; no re-verification drift found.

## Final Annotation Wording Used (verbatim, per site)

**1. `c64-program-recon/SKILL.md` (Troubleshooting table row):**
> `| \`vice_keyboard_type\` does nothing | The game polls \`$DC00\`/\`$DC01\` directly. Use \`vice_keyboard_matrix\` (**requires the fork backend** — see \`references/observation-hazards.md\` § 4 for the stock route). |`

**2. `references/sound-and-input.md` ("Three CIA hazards" bullet, appended sentence):**
> "**`vice_keyboard_matrix` requires the fork backend** — the binary monitor's `KEYBOARD_FEED` only injects PETSCII buffer text and cannot drive the raw matrix. On stock, use `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL buffer, or `vice_joystick_set` when it polls the matrix directly; buffer injection stays invisible to a program polling `$DC00`/`$DC01` itself."

**3. `references/observation-hazards.md` (section 4, full treatment):**
> "**`vice_keyboard_matrix` requires the fork backend.** The binary monitor's `KEYBOARD_FEED` (0x72) only injects PETSCII text into the KERNAL keyboard buffer; the emulator recomputes CIA port B from its own keyboard array on every read, so there is no wire command that can drive the raw matrix — this is unrecoverable on stock, not merely unbuilt. On stock, use `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL buffer, or `vice_joystick_set` when it polls the matrix directly instead; either way, buffer injection is invisible to a program polling `$DC00`/`$DC01` itself, so a matrix-polling gate must be driven by the joystick or not at all."

**4. `c64-ram-capture/SKILL.md` ("Find an entry point" step 1, appended after the existing step):**
> "**This call requires the fork backend** — the binary monitor's `KEYBOARD_FEED` only injects PETSCII text into the KERNAL buffer and cannot drive the raw matrix. On stock, use `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL buffer, or `vice_joystick_set` when it polls the matrix directly; buffer injection stays invisible to a program polling `$DC00`/`$DC01` itself."

**5. `references/control-flow.md` (stale-tense correction, `vice_keyboard_restore` paragraph):**
> Before: "...This call is unavailable on stock; Phase 8's `BACK-05` is what reports the absence at runtime."
> After: "...Calling it on the stock backend returns an error naming the reason and the fork backend, rather than pulsing RESTORE."

## Transient Failure Messages Proved (Task 1 acceptance criteria)

**1. Bare mention with no annotation** — a temporary `vice_sid_get_state` mention injected into `acme-build/SKILL.md`'s "Build" section (which carries no annotation signal):
```
.claude/skills/acme-build/SKILL.md:28: "vice_sid_get_state" mentioned in section "Build" with no fork-requirement annotation in that section -- state that it requires the fork backend. No stock route exists.
```
Reverted immediately; `git diff --stat` confirmed a clean revert.

**2. Deleting the annotation from `observation-hazards.md` section 3** — this required removing BOTH the intentional `fork-only` annotation at line 88 AND a coincidental, unrelated "the fork backend" phrase at line 95 (an aside about an older transcript lacking a `bank` field) that would otherwise keep the section classified as annotated under the section-scoped rule (any signal anywhere in the section counts). With both neutralized:
```
.claude/skills/c64-program-recon/references/observation-hazards.md:79: "vice_sid_get_state" mentioned in section "3. Registers that clear when you read them" with no fork-requirement annotation in that section -- state that it requires the fork backend. No stock route exists.
```
Reverted via `git checkout --`; confirmed clean.

This is a real finding about the section-scoped design (not a bug in the implementation): the coarse "any signal anywhere in section" rule is deliberately loose per the plan's own spec, and a coincidental phrase match elsewhere in a long section can mask an unrelated missing annotation. Recorded here rather than tightened, since tightening risks the false positives the section-scoped design was chosen specifically to avoid (fixed +/-N-line windows wrongly flagging `observation-hazards.md:79` itself, whose real annotation sits 9 lines away at line 88).

**3. Non-vacuity control (empty `SKILLS_DIR`)** — a scratch copy of the script pointed at an empty directory:
```
check-skill-fork-honesty: FAIL
  - non-vacuity: expected at least 6 skill directories scanned with at least one file read in each, got 0 directories (0 with a file read)
  - non-vacuity: expected at least 8 fork-only tool mentions across .claude/skills/, got 0 -- the skills walk or extraction regex may be broken
  - non-vacuity: positive control references/tool-selection.md must be classified compliant (inline annotation on the same line as the mention) -- if this fails, the annotation-signal match or the walk is broken
  - non-vacuity: positive control references/control-flow.md must be classified compliant (annotation in the same section as the mention) -- if this fails, the section-scoped proximity rule or the walk is broken
```
The scratch copy was deleted immediately after capture; nothing in the working tree was affected (verified via `git status --short`).

## Section-Scoped Rule Confirmation (already-compliant sites)

Confirmed via the final lint run (`check-skill-fork-honesty: OK -- 11 fork-only mentions across 30 files in 6 skill directories, all section-scoped-compliant; 24 fork-only names policed`):
- `observation-hazards.md:79` (`vice_sid_get_state`, section "3. Registers that clear when you read them") — compliant via its own section's `fork-only` annotation at line 88.
- `control-flow.md:86` (`vice_keyboard_restore`, section "What the widened sweep found here — 2026-08-04") — compliant via the same section's "requires the fork backend" annotation at line 90.
- `tool-selection.md:18` (`vice_sid_get_state`) — compliant via its own inline "(**requires the fork** — ...)" annotation on the same line.

All three are named as literal string positive controls inside `check-skill-fork-honesty.mjs` and asserted via non-vacuity `need()` calls, per the acceptance criteria.

## Decisions Made

See `key-decisions` in frontmatter. In short: the stale-forward-reference check was narrowed from the plan's literal "any `Phase \d` co-occurring with a stale word on the same line" spec to a possessive `Phase N's` pattern, because the literal spec produces a false positive on `references/tool-selection.md:39` (a citation of the fork's own "*not yet implemented*" schema documentation, not a deferral of a capability owned by this project) — a file outside this plan's `files_modified` and outside Task 2's four target sites. The possessive form still catches the one genuine stale reference (`control-flow.md:92`) that Task 2 fixes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrowed the stale-forward-reference regex to avoid a false positive**
- **Found during:** Task 1, first run of the newly-written lint against the real tree.
- **Issue:** The plan's literal spec (`Phase \d` co-occurring on the same line with `deferred|not yet|until|unavailable`) matches `references/tool-selection.md:39`, a pre-existing line quoting the fork's own tool-schema text ("*not yet implemented*") alongside an unrelated `(Phase 7, D-02)` citation. This file is not in the plan's `files_modified` and is not one of Task 2's four target sites; flagging it would make the lint permanently non-zero after Task 2's edits, contradicting the plan's own acceptance criteria ("After Task 2's edits: exits 0") and its final `<verification>` block.
- **Fix:** Narrowed the pattern to require a possessive `Phase N's` form (matching the idiom this project's own prose actually uses to defer a capability, e.g. control-flow.md's "Phase 8's `BACK-05`"), which still flags exactly the one genuine stale reference and excludes the false positive.
- **Files modified:** `scripts/check-skill-fork-honesty.mjs`
- **Verification:** Ran the lint against the tree before and after the narrowing; confirmed the narrowed pattern matches only `control-flow.md:92` and no other line in the six skills (`grep -rnE "Phase [0-9]+['']s" .claude/skills/` returns exactly that one line).
- **Committed in:** `03e3308` (Task 1 commit)

**2. [Scope Boundary — logged, not fixed] `references/tool-selection.md:39` still trips the plan's own literal final-verification grep**
- **Found during:** Running the plan's `<verification>` block's final grep check directly (not through the lint).
- **Issue:** `grep -rn 'Phase [0-9]' .claude/skills/ | grep -Ei 'deferred|not yet|until|unavailable'` still returns `references/tool-selection.md:39`, since that grep is literal and not narrowed the way the lint is. This line pre-dates this plan, is not in `files_modified`, and is not one of Task 2's four target sites.
- **Resolution:** Not auto-fixed, per the Scope Boundary rule (pre-existing content outside this task's declared files). Logged to `deferred-items.md` for a future plan or quick task to either rephrase the line or narrow the plan's own verification grep to match the lint's possessive-form pattern.
- **Files modified:** none (documentation only, in `deferred-items.md`)

---

**Total deviations:** 1 auto-fixed (Rule 1), 1 logged-and-deferred (Scope Boundary).
**Impact on plan:** The auto-fix was necessary for the lint itself to satisfy its own acceptance criteria (exit 0 after Task 2) without producing a false positive on out-of-scope content. The deferred item is a pre-existing, narrowly-scoped documentation inconsistency in a file this plan does not touch; it does not affect SKILL-01's success criteria (all nine fork-only mentions across the six skills are correctly annotated, and no bare mention or genuine stale-phase-deferral sentence exists).

## Issues Encountered

None beyond the deviation above. All five re-verified edit sites matched the plan's cited line numbers exactly (see table above) — no line-number drift found despite the plan's own warning that this prose "shifts easily."

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`scripts/check-skill-fork-honesty.mjs` is ready for plan 08-05 to extend with the README presence checks (per the plan's own "Deliberately NOT in this plan" note) — the walk, extraction, and error-reporting shape it establishes should be extended, not re-derived. Plan 08-05 also extends this same file per the parallel_execution note in this plan's own worktree context; this plan leaves it in a state that is complete and passing on its own (11 fork-only mentions, 0 errors), ready for that extension.

No blockers for 08-05. One pre-existing, narrowly-scoped documentation gap (`tool-selection.md:39` vs. the plan's own literal final-verification grep) is logged in `deferred-items.md` for future cleanup; it does not block SKILL-01 or any Phase 8 success criterion.

---
*Phase: 08-capability-honesty-and-the-install-story*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: `scripts/check-skill-fork-honesty.mjs`
- FOUND: `.planning/phases/08-capability-honesty-and-the-install-story/08-04-SUMMARY.md`
- FOUND commit: `03e3308` (Task 1)
- FOUND commit: `3038edb` (Task 2)
- FOUND commit: `a835e06` (plan metadata)
