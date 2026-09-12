---
phase: 52-remove-the-fork-backend
plan: 08
subsystem: skills
tags: [fork-removal, skill-docs, permanent-limitations, stock-hard-losses, skill-redundancy]

# Dependency graph
requires:
  - phase: 52-remove-the-fork-backend (plan 01)
    provides: "docs/stock-hard-losses.md — the docs/-rooted citation target for every rewritten permanent-limitation site"
  - phase: 52-remove-the-fork-backend (plan 07)
    provides: "docs/tool-support.md deleted; confirmed no skill text links to it before this plan started"
provides:
  - "All 27 fork-mentioning lines across the nine shipped skill files rewritten or cleared — 0 remaining, verified by whole-tree grep"
  - "Every former fork-routing capability (vice_sid_get_state, vice_keyboard_restore, vice_keyboard_matrix) restated as a stated permanent limitation citing docs/stock-hard-losses.md, still named in skill text, never silently dropped"
  - "The wider two-backend framing (both-backends/either-backend/stock-only annotations, fork-vs-stock confidence comparisons, the dead stale_read_path verdict row) collapsed to unqualified single-backend facts"
  - "routine-queue-walker's SS2.2 delegates to c64-program-recon's per-routine procedure instead of paraphrasing it, restoring the dropped 4096-byte cap and tail-call/fall-through bounds rules by reference"
  - "c64-memory-mapping's description/body scope mismatch resolved via body restructure (two secondary jobs demoted under a new subordinate heading), description left byte-identical to CLAUDE.md's copy"
affects: [52-09]

actuals:
  tokens: 13645
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Permanent-limitation rewrite: a former fork-routing sentence becomes '<tool> is permanently unavailable' plus the hardware-level reason plus a docs/stock-hard-losses.md citation, never a deletion — the capability stays named so a reader hits a stated fact instead of a silent gap"
    - "Dead-verdict-row removal is distinct from a routing-site rewrite: vice-wedge-triage's stale_read_path row described an output value only the REMOVED backend's vice_diagnose ever returned (not a capability this backend has or lacks), so it was deleted outright rather than rewritten as a limitation"
    - "Description-widening vs body-restructure for a scope mismatch: widening c64-memory-mapping's frontmatter description was tried first and reverted after it broke skill-description-overlap.test.ts's CLAUDE.md-byte-identity invariant (CLAUDE.md is out of scope for this plan); body restructure (heading demotion under a new subordinate parent) achieves the same scope-agreement without touching a file this plan does not own"

key-files:
  created: []
  modified:
    - src/skills/c64-program-recon/SKILL.md
    - src/skills/c64-program-recon/references/tool-selection.md
    - src/skills/c64-program-recon/references/control-flow.md
    - src/skills/c64-program-recon/references/observation-hazards.md
    - src/skills/c64-program-recon/references/sound-and-input.md
    - src/skills/vice-wedge-triage/SKILL.md
    - src/skills/c64-ram-capture/SKILL.md
    - src/skills/c64-petcat/SKILL.md
    - src/skills/c64-disk-access/SKILL.md
    - src/skills/routine-queue-walker/SKILL.md
    - src/skills/c64-memory-mapping/SKILL.md
    - .planning/todos/completed/2026-09-11-routine-queue-walker-restates-instead-of-delegating.md (moved from pending/)
    - .planning/todos/completed/2026-09-11-c64-memory-mapping-is-three-skills.md (moved from pending/)

key-decisions:
  - "Re-derived the fork census myself rather than trusting the plan's line numbers, per the plan's own warning. Confirmed via `grep -aic fork` against the pre-plan HEAD (dbc4e084): 27 fork-mentioning lines across the exact 9 files the plan named (1+4+2+4+1+12+1+1+1), matching the plan's stated total exactly. Also found one line the plan's Task 1 read_first omitted — tool-selection.md:21 (`vice_diagnose`'s 'the fork answers stale_read_path' clause) — and rewrote it alongside the others."
  - "tool-selection.md's four '(**both backends**)' annotations (lines 16/18/19/20) and control-flow.md's 'on either backend' (line 165) were cleaned even though they contain no literal 'fork' — they assert a per-backend capability difference, which the plan's second must-have truth requires gone ('the whole two-backend framing is gone, not just the nine routing sentences'). 'stock' as a plain product-name descriptor (e.g. 'Stock VICE's binary monitor') was left alone — that is this project's standing terminology (used throughout CLAUDE.md and docs/stock-hard-losses.md), not a per-backend comparison."
  - "vice-wedge-triage's `stale_read_path` verdict row (was line 68, untouched by the plan's own read_first — a second miss beyond the :132 the plan named) was DELETED, not rewritten as a limitation. It described an output value only the fork's vice_diagnose ever returned; this backend's tool has never returned it and never will, so it is dead documentation of an impossible output, not a capability this project has or has lost. The plan's no-deletion rule is scoped to capabilities/routes (SID read-back, matrix control, RESTORE) that a reader might still want and would otherwise think are silently gone; this is neither."
  - "control-flow.md's RESTORE-press recommendation (the paragraph immediately preceding the vice_keyboard_restore limitation) was rewritten alongside the limitation itself, not left as-is: the original text recommended 'press RESTORE with vice_keyboard_restore, then vice_machine_reset soft and hard' as a next experiment, which would now silently fail since the tool is permanently unavailable. Rewrote to state the RESTORE half of the experiment cannot currently be run and the reset half remains testable — avoiding a recommendation that contradicts the very next paragraph."
  - "c64-memory-mapping's description/body mismatch (ride-along 2) was fixed via BODY RESTRUCTURE, not description-widening, reversing my own first attempt. Widening the description to name all three jobs was written and verified clean against skills-planning-vocabulary/tool-coverage, but a subsequent floorcheck run showed it broke `skill-description-overlap.test.ts`'s invariant that CLAUDE.md's project-skills table stays byte-identical to every SKILL.md frontmatter description — CLAUDE.md is explicitly out of scope for this plan (52-09's). Reverted the description edit; instead demoted 'Classifying every region of an annotation project' and 'What a symbol in the store actually represents' from `##` to `###` under a new `## Reference material for annotating` heading, with their own child headings bumped `###`→`####` to preserve nesting. No content deleted, no skill split or merged, description untouched and still byte-identical to CLAUDE.md's copy."
  - "Both ride-along todos moved from .planning/todos/pending/ to .planning/todos/completed/ with a short resolution note, since this pass genuinely closed them. This is standard todo-lifecycle housekeeping, not scope creep — the plan itself instructs recording which direction was chosen and why, and closing the todo file is the natural place to also record the resolution."

requirements-completed: []

coverage:
  - id: D1
    description: "Every former fork-routing capability (vice_sid_get_state, vice_keyboard_restore, vice_keyboard_matrix) across c64-program-recon, c64-ram-capture and vice-wedge-triage is rewritten as a stated permanent limitation citing docs/stock-hard-losses.md, still named in skill text"
    requirement: FORKRM-03
    verification:
      - kind: unit
        ref: "grep -ac 'requires the fork\\|fork-only\\|fork backend' src/skills/c64-program-recon -r -> 0"
        status: pass
      - kind: unit
        ref: "grep -ac 'vice_sid_get_state|vice_keyboard_restore|vice_keyboard_matrix' src/skills/c64-program-recon -r -> each present (1, 1, 2)"
        status: pass
      - kind: unit
        ref: "grep -ac docs/stock-hard-losses.md src/skills/c64-program-recon -r -> present in tool-selection.md, sound-and-input.md, observation-hazards.md (x2), control-flow.md"
        status: pass
      - kind: other
        ref: "grep -ac vice_keyboard_matrix src/skills/c64-ram-capture/SKILL.md -> 1; grep -ac docs/stock-hard-losses.md -> 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zero fork mentions remain anywhere under src/skills/ (whole-tree census)"
    requirement: FORKRM-03
    verification:
      - kind: other
        ref: "grep -raic fork src/skills --include='*.md' | awk -F: '{s+=$2} END {print s+0}' -> 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "skills-planning-vocabulary.test.ts, check-skill-cli-invocations.mjs, check-skill-tool-coverage.mjs and check-npm-packages.mjs all still exit 0 after every rewrite"
    requirement: FORKRM-03
    verification:
      - kind: unit
        ref: "node --test skills-planning-vocabulary.test.ts -> 5/5 pass"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-cli-invocations.mjs -> OK"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs -> OK"
        status: pass
      - kind: other
        ref: "node scripts/check-npm-packages.mjs -> OK"
        status: pass
    human_judgment: false
  - id: D4
    description: "routine-queue-walker SS2.2 delegates to c64-program-recon's per-routine procedure (restoring the 4096-byte cap and tail-call/fall-through rules by reference); file line count decreased, confirming a replacement not a padding"
    verification:
      - kind: unit
        ref: "grep -ac c64-program-recon src/skills/routine-queue-walker/SKILL.md -> 3; wc -l -> 365 (was 366)"
        status: pass
    human_judgment: false
  - id: D5
    description: "c64-memory-mapping's description/body scope agreement, nine skill directories unchanged, no content deleted"
    verification:
      - kind: unit
        ref: "ls src/skills | wc -l -> 9; skill-description-overlap.test.ts (CLAUDE.md byte-identity) -> pass"
        status: pass
    human_judgment: true
    rationale: "Whether the chosen body-restructure genuinely resolves the trigger-surface mismatch as well as description-widening would have is a judgment call about skill discoverability; a human should confirm the new 'Reference material for annotating' framing reads naturally."
  - id: D6
    description: "The automated suite's failure SET matches plan 52-07's reference floor (13-member set: 6 non-fork-honesty floor members + 7 check-skill-fork-honesty-attributable members substituting for the 1 floor member they displace) -- no new regression"
    verification:
      - kind: other
        ref: "/tmp/claude-1000/gsd52/floorcheck.sh task3check2 -- TEST_EXIT=1, failure set 13, diff vs 7-member floor shows only check-skill-fork-honesty-attributable members (plan 52-09's known scope)"
        status: pass
    human_judgment: true
    rationale: "Attributing all 7 substituted failures to the known check-skill-fork-honesty.mjs breakage (rather than a second, unrelated regression hiding behind the same symptom) is the same judgment call 52-07's executor made and flagged for human spot-check; this plan inherits that same open item, does not add to it."

duration: 40min
completed: 2026-09-12
status: complete
---

# Phase 52 Plan 08: Rewrite Fork Routes as Permanent Limitations Summary

**Every one of the 27 fork-mentioning lines across nine shipped skill files is now either a stated permanent limitation citing `docs/stock-hard-losses.md` or a collapsed unqualified single-backend fact — zero fork mentions remain anywhere under `src/skills/`, and both ride-along skill-redundancy defects (routine-queue-walker's lossy paraphrase, c64-memory-mapping's scope mismatch) are closed in the same pass.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-12
- **Tasks:** 3
- **Files modified:** 13 (11 skill files + 2 todo files)

## Accomplishments

- `c64-program-recon`'s six routing sites (`SKILL.md`, `tool-selection.md`, `control-flow.md`, `observation-hazards.md`, `sound-and-input.md`) and its wider two-backend framing (both-backends annotations, fork-vs-stock confidence comparisons) rewritten to zero fork mentions.
- `vice-wedge-triage`'s twelve fork lines cleared, including the missed 9th routing site (`:132`'s "or use the fork backend" clause) and a second miss beyond that (the dead `stale_read_path` verdict row, deleted rather than rewritten since it names an output value only the removed backend's tool ever returned).
- `c64-ram-capture`, `c64-petcat`, `c64-disk-access` — each skill's single fork mention cleared; `c64-ram-capture`'s `vice_keyboard_matrix` call rewritten as a stated permanent limitation with its already-present KERNAL-buffer/joystick alternative kept intact.
- `routine-queue-walker` SS2.2 now delegates to `c64-program-recon`'s "Documenting one routine, end to end" procedure instead of paraphrasing it, restoring the 4096-byte `anno_read_region` cap and the tail-call/fall-through bounds rules by reference. File line count decreased (366 → 365).
- `c64-memory-mapping`'s description/body scope mismatch resolved via body restructure (not description-widening, which was tried and reverted after breaking a CLAUDE.md invariant outside this plan's scope) — nine skill directories unchanged, no content deleted.

## Task Commits

1. **Task 1: Rewrite c64-program-recon's six routing sites and its wider fork framing** - `df02fec9` (docs)
2. **Task 2: Clear vice-wedge-triage's twelve fork lines and the three remaining single-site skills** - `4bff0cb2` (docs)
3. **Task 3: Ride-along — restore routine-queue-walker's delegation and narrow c64-memory-mapping's scope** - `00f9c538` (docs)

**Plan metadata:** (this commit, following SUMMARY)

## Files Created/Modified

- `src/skills/c64-program-recon/SKILL.md` - troubleshooting row for `vice_keyboard_matrix` restated as a permanent limitation with a repointed § 4 reference
- `src/skills/c64-program-recon/references/tool-selection.md` - `vice_sid_get_state` and `vice_diagnose`'s verdict-set comparison rewritten; `vice_run_until` timeout/confidence qualifiers collapsed to unqualified stock facts; four `(**both backends**)` annotations removed
- `src/skills/c64-program-recon/references/control-flow.md` - `vice_keyboard_restore` rewritten as a permanent limitation; the preceding RESTORE-press recommendation reworded so it does not contradict the limitation; "on either backend" duality removed
- `src/skills/c64-program-recon/references/observation-hazards.md` - `vice_sid_get_state` rewritten as a permanent limitation; two backend-comparison sentences (hazard 3's confidence claim, the bank-field suspicion clause) restated on their own terms; `vice_keyboard_matrix` (hazard 4) rewritten as a permanent limitation
- `src/skills/c64-program-recon/references/sound-and-input.md` - `vice_keyboard_matrix` rewritten as a permanent limitation
- `src/skills/vice-wedge-triage/SKILL.md` - four-vs-five-state comparison collapsed to a five-state statement; both stock-only table rows had their tag removed; the verdict-vocabulary paragraph rewritten without a fork comparison; the dead `stale_read_path` row deleted; the `liveness_unmeasurable` row's fork clause dropped; the `vice_run_until` fork-timeout paragraph and its now-moot Provenance-table row removed; the fork-only liveness poll replaced with the stock cycle bracket presented as THE procedure
- `src/skills/c64-ram-capture/SKILL.md` - `vice_keyboard_matrix` call rewritten as a permanent limitation, keeping its already-present alternative
- `src/skills/c64-petcat/SKILL.md`, `src/skills/c64-disk-access/SKILL.md` - "silent on fork vs. stock by construction" restated as "no emulator dependency"
- `src/skills/routine-queue-walker/SKILL.md` - SS2.2 rewritten to delegate to `c64-program-recon`'s per-routine procedure
- `src/skills/c64-memory-mapping/SKILL.md` - two secondary sections demoted under a new `## Reference material for annotating` heading; frontmatter description untouched
- `.planning/todos/completed/2026-09-11-routine-queue-walker-restates-instead-of-delegating.md`, `.planning/todos/completed/2026-09-11-c64-memory-mapping-is-three-skills.md` - moved from `pending/` with resolution notes

## Decisions Made

See `key-decisions` in frontmatter for full detail. Summary: re-derived the fork census myself (confirmed 27 lines across the plan's named 9 files, plus caught one line the plan's own read_first missed); deleted rather than rewrote one dead verdict-vocabulary row that names an output value the current backend cannot produce; reworded a RESTORE-press recommendation that would otherwise contradict its own very-next paragraph; and reversed my first attempt at the c64-memory-mapping ride-along (description-widening) after it broke a CLAUDE.md invariant outside this plan's scope, landing on body-restructure instead.

## Before/After: the nine routing-site rewrites

**1. `tool-selection.md:17` — `vice_sid_get_state`**
- Before: `` `vice_sid_get_state` (**requires the fork** — SID `$D400-$D418` is write-only in hardware and the binary monitor has no SID command; unrecoverable on stock) ``
- After: `` `vice_sid_get_state` — **permanently unavailable**: SID `$D400-$D418` is write-only in hardware and the binary monitor has no SID command, so read-back cannot be recovered. Writes to those addresses still work fine over the memory-set primitive. See `docs/stock-hard-losses.md` ``

**2. `control-flow.md:89-92` — `vice_keyboard_restore`**
- Before: `**`vice_keyboard_restore` requires the fork backend.** The RESTORE key pulses the NMI line directly and is not part of the keyboard matrix, so stock's `KEYBOARD_FEED` ... cannot produce it. Calling it on the stock backend returns an error naming the reason and the fork backend, rather than pulsing RESTORE.`
- After: `**`vice_keyboard_restore` is permanently unavailable.** ... calling the tool returns an error naming the reason, rather than pulsing RESTORE. No client-side substitute exists — see `docs/stock-hard-losses.md`.` (the preceding RESTORE-press recommendation was also reworded so it no longer proposes an experiment the very next sentence says cannot succeed)

**3. `observation-hazards.md:88` — `vice_sid_get_state` (fork-only)**
- Before: `` `vice_sid_get_state` is **fork-only**, since SID `$D400-$D418` is write-only in hardware and the binary monitor has no SID command. ``
- After: `` `vice_sid_get_state` read-back is **permanently unavailable**: SID `$D400-$D418` is write-only in hardware and the binary monitor has no SID command, so there is no route to recover it. Writes to those addresses still work fine. See `docs/stock-hard-losses.md`. ``

**4. `observation-hazards.md:106` — `vice_keyboard_matrix`**
- Before: `**`vice_keyboard_matrix` requires the fork backend.** ... this is unrecoverable on stock, not merely unbuilt. On stock, use ...`
- After: `**`vice_keyboard_matrix` is permanently unavailable.** ... this is unrecoverable, not merely unbuilt. See `docs/stock-hard-losses.md`. Use ...` (KERNAL-buffer/joystick alternative kept verbatim)

**5. `sound-and-input.md:64` — `vice_keyboard_matrix`**
- Before: `drive input with `vice_keyboard_matrix` or the joystick tools instead. **`vice_keyboard_matrix` requires the fork backend** — the binary monitor's `KEYBOARD_FEED` only injects PETSCII buffer text and cannot drive the raw matrix.`
- After: `Assume it until shown otherwise. **`vice_keyboard_matrix` is permanently unavailable** — ... see `docs/stock-hard-losses.md`. Use `vice_keyboard_type` / `vice_keyboard_petscii` ... or `vice_joystick_set` ...` (dropped the "drive input with vice_keyboard_matrix" instruction that recommended the now-unavailable call)

**6. `SKILL.md:698` — `vice_keyboard_matrix` troubleshooting row**
- Before: `Use `vice_keyboard_matrix` (**requires the fork backend** — see `references/observation-hazards.md` § 4 for the stock route).`
- After: `` `vice_keyboard_matrix` is **permanently unavailable** — see `references/observation-hazards.md` § 4 for the reason and the available alternative. `` — pointer KEPT because § 4 (hazard 4) still offers real content after its own rewrite: the KERNAL-buffer/joystick-port alternative.

**7. `c64-ram-capture/SKILL.md:163` — `vice_keyboard_matrix`**
- Before: `Press past any "hit any key" gate with `vice_keyboard_matrix`. **This call requires the fork backend** — ...`
- After: `Press past any "hit any key" gate. **`vice_keyboard_matrix` is permanently unavailable** — ... see `docs/stock-hard-losses.md`. Use ...` — § 2 check: the fallback (KERNAL-buffer/joystick alternative) was ALREADY present in the same paragraph (lines immediately following), so this is a citation-and-rewording fix, not a new fallback invented.

**8. `vice-wedge-triage/SKILL.md:132` — `liveness_unmeasurable` row (the missed 9th)**
- Before: `Judge liveness from outside the monitor (screenshot, process state), or use the fork backend. Retrying will produce the same answer`
- After: `Judge liveness from outside the monitor (screenshot, process state). Retrying will produce the same answer` — trailing clause deleted only, remedy (screenshot/process-state) kept.

**9. `vice-wedge-triage/SKILL.md` — the fork-only liveness poll (was lines ~211-234)**
- Before: two competing four-step procedures, one headed "**On the fork**, it is four calls" (including a non-pausing `vice_ping` ×3 poll), the other headed "On stock..." as an alternative.
- After: one procedure — the stopwatch-reset/run/wait/read bracket — presented as THE liveness test, with an explanatory sentence on why a `vice_ping` poll during the wait would measure nothing (rather than naming it as a fork-only alternative).

## Ride-along fixes (NOT Phase 52 success criteria)

Both restated here per the plan's own instruction: **neither of the following two fixes is caused by fork removal, and neither counts toward Phase 52's success criteria.** They landed in this pass only because these skill pages were already open for the fork-routing rewrites above, and reopening them in a later phase would cost a second read-through of the same files for no benefit.

**routine-queue-walker delegation restored.** SS2.2 "Walk it" previously paraphrased `c64-program-recon`'s "Documenting one routine, end to end" procedure and had silently dropped two hazards in the process (the 4096-byte `anno_read_region` cap, the tail-call/fall-through bounds rules — both measured at 0 mentions in the paraphrase versus 4-5 in the source skills). Rewrote to delegate by reference instead of restating, citing the cap and bounds rules explicitly so a reader following only this skill still hits them. File line count decreased from 366 to 365, confirming a genuine replacement rather than padding.

**c64-memory-mapping scope mismatch fixed via body restructure, not description-widening.** The skill's 623-line `SKILL.md` covers three jobs (address lookup/annotation, region classification, per-symbol documentation) under a frontmatter description naming essentially the first. **First attempt:** widened the description to name all three jobs — this was written, and verified clean against `skills-planning-vocabulary.test.ts` and `check-skill-tool-coverage.mjs`, but a subsequent full-suite floorcheck run caught that it broke `skill-description-overlap.test.ts`'s invariant that `CLAUDE.md`'s project-skills table stays byte-identical to every `SKILL.md`'s own description — and `CLAUDE.md` is explicitly out of scope for this plan (52-09's). **Reverted, and used body restructure instead:** demoted "Classifying every region of an annotation project" and "What a symbol in the store actually represents" from `##` to `###` under a new `## Reference material for annotating` parent heading (with a short framing paragraph explaining both are reference material feeding the annotate/lookup job, not standalone jobs), and bumped their own child headings from `###` to `####` to preserve nesting. No content deleted, no heading text changed, frontmatter description untouched and still byte-identical to `CLAUDE.md`'s copy. Nine skill directories unchanged; no skill merged, split or created.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tool-selection.md:21 was a routing site the plan's Task 1 read_first missed**
- **Found during:** Task 1, whole-tree fork re-census before starting
- **Issue:** `vice_diagnose`'s row said "the fork answers `stale_read_path`, stock answers `monitor_held_elsewhere`" — a genuine fork comparison the plan's enumerated site list for this file (`:17`, `:44`, `:47`) did not include
- **Fix:** Rewrote alongside the other tool-selection.md sites, restating the row as an unqualified single-verdict-set fact
- **Files modified:** `src/skills/c64-program-recon/references/tool-selection.md`
- **Verification:** `grep -aic fork tool-selection.md` → 0
- **Committed in:** `df02fec9` (Task 1 commit)

**2. [Rule 1 - Bug] vice-wedge-triage's `stale_read_path` row and its fork-only liveness-test Provenance row were two more misses beyond the plan-named `:132`**
- **Found during:** Task 2, whole-tree fork re-census before starting (twelve lines counted, matching the plan's stated total, but at different line numbers than the plan's own read_first enumerated)
- **Issue:** the plan's own intro flagged `:132` as the one miss from the hand-off list; re-deriving the census independently found the file still had 12 fork lines total including these two the Task 2 read_first also did not name individually
- **Fix:** `stale_read_path` row deleted (names an output value only the removed backend's tool ever returned — see key-decisions); the Provenance table's fork-only-timeout row removed as it duplicated a claim the adjacent stock row already covers
- **Files modified:** `src/skills/vice-wedge-triage/SKILL.md`
- **Verification:** `grep -aic fork vice-wedge-triage/SKILL.md` → 0; the file's other stock procedures (stopwatch bracket, `monitor_held_elsewhere` remedy) all still present
- **Committed in:** `4bff0cb2` (Task 2 commit)

**3. [Rule 4-adjacent, self-corrected within task] c64-memory-mapping description-widening reverted after breaking an out-of-scope invariant**
- **Found during:** Task 3, full-suite floorcheck after first attempt
- **Issue:** widening the frontmatter description (the plan's other named option) broke `skill-description-overlap.test.ts`'s CLAUDE.md byte-identity invariant — a file this plan does not own
- **Fix:** reverted the description edit, used the body-restructure option instead (see Ride-along section above)
- **Files modified:** `src/skills/c64-memory-mapping/SKILL.md`
- **Verification:** `skill-description-overlap.test.ts` → 32/32 pass; `skills-planning-vocabulary.test.ts` and `check-skill-tool-coverage.mjs` → both exit 0
- **Committed in:** `00f9c538` (Task 3 commit; the reverted attempt was never separately committed)

---

**Total deviations:** 3 (2 Rule-1 census misses beyond what the plan's own read_first enumerated, 1 self-corrected approach reversal within Task 3)
**Impact on plan:** All three are necessary corrections that keep the plan's own must-haves true (zero fork mentions; no new regression in an out-of-scope file). No scope creep — the reversal specifically avoided expanding scope into `CLAUDE.md`.

## Known Stubs

None.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 52-09.** That plan's scope (`README.md`, `docs/stock-vice-parity.md`, `CLAUDE.md`, `scripts/check-skill-fork-honesty.mjs` inversion, `scripts/check-skill-description-overlap.mjs`'s check-npm-packages non-vacuity floor) is unaffected by this plan's changes except where it needs this plan's output as input:

- **Fork-mention count in `src/skills/**` after this pass: 0.** (52-09's `check-skill-fork-honesty.mjs` rewrite will need to assert against this new baseline instead of the pre-removal "at least 8 fork mentions" floor it used to carry.)
- `check-skill-fork-honesty.mjs` remains known-broken (imports the registry 52-07 deleted) — untouched by this plan, exactly as scoped. Not part of `npm run test:automated`'s glob, so it does not appear in the floorcheck failure set; it does appear as 7 attributable node-test failures inside files that DO import it (`stock-dispatch.test.ts`-adjacent census, `WR-03` checks, `check-skill-description-overlap`'s live-execution control) that substitute for the single floor member they displace — same 13-member set 52-07's own SUMMARY recorded, unchanged by this plan.
- `docs/tool-support.md` is deleted (52-07); confirmed zero skill-text links to it, before and after this plan.

No blockers.

## Self-Check: PASSED

- `src/skills/c64-program-recon/SKILL.md` — FOUND
- `src/skills/c64-program-recon/references/tool-selection.md` — FOUND
- `src/skills/c64-program-recon/references/control-flow.md` — FOUND
- `src/skills/c64-program-recon/references/observation-hazards.md` — FOUND
- `src/skills/c64-program-recon/references/sound-and-input.md` — FOUND
- `src/skills/vice-wedge-triage/SKILL.md` — FOUND
- `src/skills/c64-ram-capture/SKILL.md` — FOUND
- `src/skills/c64-petcat/SKILL.md` — FOUND
- `src/skills/c64-disk-access/SKILL.md` — FOUND
- `src/skills/routine-queue-walker/SKILL.md` — FOUND
- `src/skills/c64-memory-mapping/SKILL.md` — FOUND
- `.planning/todos/completed/2026-09-11-routine-queue-walker-restates-instead-of-delegating.md` — FOUND
- `.planning/todos/completed/2026-09-11-c64-memory-mapping-is-three-skills.md` — FOUND
- Commit `df02fec9` — FOUND in `git log --oneline --all`
- Commit `4bff0cb2` — FOUND in `git log --oneline --all`
- Commit `00f9c538` — FOUND in `git log --oneline --all`
- Whole-tree fork census: `grep -raic fork src/skills --include='*.md'` → 0 — PASSED
- `skills-planning-vocabulary.test.ts` → 5/5 pass — PASSED
- `check-skill-cli-invocations.mjs`, `check-skill-tool-coverage.mjs`, `check-npm-packages.mjs` → all exit 0 — PASSED
- Automated suite floorcheck → 13-member failure set, identical composition to plan 52-07's recorded reference (7-member floor + 7 fork-honesty-attributable substitutions for the 1 they displace), zero new members — PASSED

---
*Phase: 52-remove-the-fork-backend*
*Completed: 2026-09-12*
