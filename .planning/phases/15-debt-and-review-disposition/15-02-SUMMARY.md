---
phase: 15-debt-and-review-disposition
plan: 02
subsystem: testing
tags: [ci-gates, skill-corpus, regex, static-analysis, capability-registry]

requires:
  - phase: 15-01
    provides: "The widened docs-review-disposition.test.ts guard (150 findings discovered) that this plan's fixes are dispositioned against."
provides:
  - "scripts/lib/skill-corpus.mjs -- the one module both CI-gating skill-lint scripts import for corpus traversal and vice_* extraction"
  - "check-skill-tool-coverage.mjs's FORK_ONLY_UNRECOVERABLE cardinality is pinned by an independently-computed registry count, not two tautological per-member echoes"
  - "check-skill-tool-coverage.mjs's core-check allowlist is narrowed to hardware/fork tools a skill actually mentions, with the third hand-maintained expected-set list deleted"
  - "check-skill-fork-honesty.mjs's stale-forward-reference lint is paragraph-scoped and recognises non-possessive phase references"
  - "check-skill-fork-honesty.mjs's annotation compliance is decided per tool name with correct per-name line numbers"
affects: [15-12]

actuals:
  tokens: 7207
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Single-seam corpus module: scripts/lib/skill-corpus.mjs exports walkSkills()/MCP_PREFIX_RE/TOOL_NAME_RE/extractToolNames()/topLevelSkillDirs(), following the scripts/lib/r2000-cli-verbs.mjs and scripts/lib/skill-honesty-checks.mjs precedent (shared logic in scripts/lib/, out of .claude/mcp/vice/package.json's files[] allow-list, still git-tracked for scripts/package.sh's git archive)"
    - "Registry-derived cardinality assertion (WR-06 style): assert a projection's length equals an INDEPENDENTLY-computed count from the same source, rather than echoing the projection's own filter predicate back at itself"
    - "Citation-strip-before-test: PHASE_CITATION_RE strips a recognized 'quoting a third party, not deferring' shape before testing a widened pattern, so widening a lint does not resurrect a known false positive"

key-files:
  created:
    - scripts/lib/skill-corpus.mjs
  modified:
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-skill-fork-honesty.mjs

key-decisions:
  - "WR-07's allowlist narrowing was implemented exactly as 08-REVIEW.md's own fix snippet and this plan's <action> text specify (filter FORK_ONLY_UNRECOVERABLE by extracted.has(n)) rather than inventing a stronger mechanism the plan did not ask for. This satisfies the plan's must_haves truth for the CURRENT corpus (the three keyboard names are excluded from the allowlist today, since none is currently referenced) but does NOT close the gap for a FUTURE stealth mention -- see Deviations below for the full architectural reason and the planted-violation evidence."
  - "The WR-10/WR-11 acceptance criterion's literal grep for the bare string 'VICE_BACKEND' anywhere in check-skill-fork-honesty.mjs is satisfied for its actual intent (removed from ANNOTATION_RE and the nearName predicate) but not literally at the whole-file level, because a second, unrelated, pre-existing README-required-substring check legitimately requires that same string to appear in README.md. Deleting that check to satisfy an unrelated grep would itself violate this plan's own prohibition against weakening a check to force a pass -- see Deviations below."

patterns-established:
  - "A CI-gating script's own header comment must be corrected in the SAME commit as the assertion it describes, not left claiming a stronger guarantee than the code provides (WR-06's 'three checks' framing corrected to 'two')."

requirements-completed: [GATE-02]

coverage:
  - id: D1
    description: "scripts/lib/skill-corpus.mjs extracted (walkSkills, MCP_PREFIX_RE, TOOL_NAME_RE, extractToolNames, topLevelSkillDirs); both check-skill-tool-coverage.mjs and check-skill-fork-honesty.mjs import it, neither retains a local copy or the stale 'Copied from ...' comment (WR-12)"
    requirement: GATE-02
    verification:
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs && node scripts/check-skill-fork-honesty.mjs (both exit 0)"
        status: pass
      - kind: integration
        ref: "npm run test:automated (.claude/mcp/vice): 2097 pass, 0 fail, 5 pre-existing todo"
        status: pass
    human_judgment: false
  - id: D2
    description: "check-skill-tool-coverage.mjs's FORK_ONLY_UNRECOVERABLE tautological per-member category/providedBy echoes replaced with a cardinality assertion against an independently-computed registry count; comment corrected (WR-06)"
    requirement: GATE-02
    verification:
      - kind: other
        ref: "Planted mutation: capability-registry.ts vice_sid_get_state category retagged away from 'hardware' -- script now fails naming the cardinality mismatch (got 5 of 5, expected >= 6); reverted, script passes again"
        status: pass
    human_judgment: false
  - id: D3
    description: "check-skill-tool-coverage.mjs's core-check allowlist narrowed to only skill-referenced hardware/fork tools; EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS (a third hand-maintained three-tool list) deleted (WR-07)"
    requirement: GATE-02
    verification:
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs exits 0 with no new violation surfaced by the narrowing"
        status: pass
    human_judgment: true
    rationale: "The narrowing is implemented exactly as specified, but a planted-violation test (documented in Deviations) shows it does not catch a brand-new bare mention of a previously-unreferenced tool within the same run -- this is an architectural property of the single-pass filter, not an implementation gap, but a human should read the caveat before treating WR-07 as fully closed for future-proofing purposes."
  - id: D4
    description: "check-skill-fork-honesty.mjs's stale-forward-reference lint is paragraph-scoped (splitParagraphs) and recognises optional-possessive phase references, without reviving the tool-selection.md '(Phase 7, D-02)' false positive (WR-09)"
    requirement: GATE-02
    verification:
      - kind: other
        ref: "Planted mutation: a phase-9 deferral hard-wrapped across two lines in observation-hazards.md now fails, naming the paragraph's start line; reverted, script passes; both positive controls stay green throughout"
        status: pass
    human_judgment: false
  - id: D5
    description: "check-skill-fork-honesty.mjs's annotation compliance decided per tool name via a bounded bidirectional window; the two loose alternatives ('fork backend', 'VICE_BACKEND') removed from the signal predicate (WR-10); per-name line offsets computed from that name's own first mention (WR-11)"
    requirement: GATE-02
    verification:
      - kind: other
        ref: "Planted mutation: a bare vice_keyboard_chord mention added to an already-vice_sid_get_state-annotated section fails, naming vice_keyboard_chord at the exact line it appears on, while vice_sid_get_state stays compliant; reverted, script passes"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 2: Close Six Phase 08 Findings in the Two CI-Gating Skill Lints Summary

**Extracted `scripts/lib/skill-corpus.mjs` to end the byte-for-byte `walkSkills()` duplication between `check-skill-tool-coverage.mjs` and `check-skill-fork-honesty.mjs` (WR-12), then fixed five guard-quality defects across both scripts -- a tautological cardinality check, an accidentally-widened core-check allowlist, a line-wrap-dependent stale-reference lint, a section-scoped-instead-of-tool-scoped annotation rule, and misdirected error line numbers -- each proven non-vacuous by a reverted planted violation.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-22T14:02:15Z (approx., immediately following 15-01)
- **Completed:** 2026-08-22T14:24:38Z
- **Tasks:** 3 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `scripts/lib/skill-corpus.mjs` created, exporting `walkSkills(dir)`, `MCP_PREFIX_RE`, `TOOL_NAME_RE`, `extractToolNames(text)` and `topLevelSkillDirs(dir)` -- lifted verbatim (byte-equivalent behavior) from `check-skill-tool-coverage.mjs`'s original implementation. Both scripts now import it; neither retains a local copy or the stale "Copied from `scripts/check-skill-tool-coverage.mjs`'s `walkSkills()`" provenance comment. Each script's own non-vacuity block (directory/file-read counts) stays local, since it asserts about that run, not a corpus primitive. **WR-12.**
- `check-skill-tool-coverage.mjs`'s `FORK_ONLY_UNRECOVERABLE` assertions (`scripts/check-skill-tool-coverage.mjs:279-304`): the two `need()` calls that re-asserted the exact `category === "hardware" && providedBy === "fork"` predicates the array was filtered on (unfalsifiable by construction) are replaced with a cardinality assertion (`:298-304`) against an independently-computed registry count, verified at **6** against `capability-registry.ts` before being asserted (not imported unchecked from the review's literal). The framing comment's stale "three checks" claim is corrected to "two". **WR-06.**
- `check-skill-tool-coverage.mjs`'s allowlist (`:349-366`): narrowed to include only the hardware/fork registry entries a skill file actually mentions (`FORK_ONLY_UNRECOVERABLE.filter(([n]) => extracted.has(n))`), and the third hand-maintained `EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS` three-tool list (plus its two set-equality `need()` calls, whose only role was giving that hand-typed list a liveness check) is deleted outright. **WR-07** -- see Deviations for the documented limitation this fix does not close.
- `check-skill-fork-honesty.mjs`'s stale-forward-reference lint (`:158-198`): rewritten from same-physical-line scope to `splitParagraphs()`-delimited paragraph scope, with `PHASE_REF_RE` widened from possessive-only to optional-possessive. A new `PHASE_CITATION_RE` strips the `"(Phase N, ID-NN)"` citation shape before testing the widened pattern, so tool-selection.md's own legitimate `"(Phase 7, D-02)"` citation (co-occurring with the third-party doc string `"not yet implemented"`) does not become a false positive under the widened, paragraph-scoped rule. **WR-09.**
- `check-skill-fork-honesty.mjs`'s annotation-proximity rule (`:218-273`): compliance is now decided per distinct fork-only tool name via a bidirectional 200-character windowed match (`nearName`, `:250-253`), with a `names.length === 1` fallback preserving the existing any-annotation-in-section behavior for every currently-compliant single-tool section. `ANNOTATION_RE` (`:111`) drops the two loose alternatives (`"fork backend"`, `"VICE_BACKEND"`), which were strict superstrings of the two precise phrases and only ever weakened the rule. **WR-10.**
- Per-name error line numbers (`:266-269`) are now computed from that specific name's own first mention in the section, not the section's first fork-only mention of any name. **WR-11.**
- Both scripts still exit 0 against the committed skill corpus and still report a non-zero directory/file count: `check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 30 files across 6 skill directories`; `check-skill-fork-honesty: OK -- 11 fork-only mentions across 30 files in 6 skill directories`.
- `npm run typecheck` and `npm run test:automated` (`.claude/mcp/vice`) both exit 0 after every task: 2097 pass, 0 fail, 5 pre-existing todo.

## Planted-Violation Evidence (before/after, all reverted)

**WR-06 non-vacuity** -- retagged `capability-registry.ts`'s `vice_sid_get_state` entry's `category` from `"hardware"` to `"software"`:
```
check-skill-tool-coverage: FAIL
  - FORK_ONLY_UNRECOVERABLE must project every hardware/fork registry entry (got 5 of 5, expected >= 6)
  - vice_sid_get_state: referenced by ... but NOT advertised in tools-manifest.stock.json and NOT classified in any allowlist. ...
```
Reverted via `git checkout -- .claude/mcp/vice/capability-registry.ts`; diffed against a pre-mutation backup to confirm a byte-identical revert; script passes again (exit 0).

**WR-07 planted mutation (documented limitation, not a pass)** -- appended a bare, unannotated mention of `vice_keyboard_chord` (a currently-unreferenced hardware/fork tool) to `observation-hazards.md`:
```
check-skill-tool-coverage: OK -- 38 distinct vice_* names extracted from 30 files across 6 skill directories; 31 resolved as advertised ...
exit: 0
```
The mutation does **not** fail the script. This is an inherent property of the single-pass filter `FORK_ONLY_UNRECOVERABLE.filter(([n]) => extracted.has(n))`: `extracted` is fully recomputed from the on-disk corpus (including the just-added mention) *before* the filter runs, so a name becomes "actually referenced" and therefore allowlist-eligible in the very same run that introduces the mention -- there is no earlier snapshot of "referenced before this change" to compare against within one script execution. The plan's own must-haves truth ("the three keyboard names ... are back under the core check") holds for the *current, committed* corpus (none of the three is referenced today, so none is in the narrowed allowlist today), but this specific fix, implemented exactly as `08-REVIEW.md`'s own "Fix:" snippet and this plan's `<action>` text specify, does not add a mechanism that would catch a *future* stealth mention the moment it appears. Reverted via `git checkout -- .claude/skills/c64-program-recon/references/observation-hazards.md`; diffed against a pre-mutation backup to confirm a byte-identical revert.

**WR-09 non-vacuity** -- appended to `observation-hazards.md`, hard-wrapped across two physical lines:
```
This capability is being deferred to Phase 12, a numbered-phase deferral hard-wrapped
across two lines rather than sharing one physical line with the stale word unavailable.
```
```
check-skill-fork-honesty: FAIL
  - .claude/skills/c64-program-recon/references/observation-hazards.md:145: stale forward reference to a numbered phase -- state the current truth instead, and name no future phase
```
Line 145 is the paragraph's start line (the inserted `## Scratch WR-09 probe` heading). Reverted; diffed against a pre-mutation backup to confirm a byte-identical revert; script passes again.

**WR-10/WR-11 non-vacuity** -- inside `observation-hazards.md`'s "3. Registers that clear when you read them" section (which already annotates `vice_sid_get_state` as `**fork-only**` at its own line), inserted a new bare mention of a *different* fork-only tool at line 98:
```
check-skill-fork-honesty: FAIL
  - .claude/skills/c64-program-recon/references/observation-hazards.md:98: "vice_keyboard_chord" mentioned in section "3. Registers that clear when you read them" with no fork-requirement annotation in that section -- ...
```
`sed -n '98p'` on the file confirms `vice_keyboard_chord` is the exact text on line 98 (WR-11: the cited line is where the name actually appears). `vice_sid_get_state` in the same section stays compliant -- no failure reported for it (WR-10: per-tool, not per-section). Reverted; diffed against a pre-mutation backup to confirm a byte-identical revert; both positive controls (`tool-selection.md`, `control-flow.md`) confirmed still green before and after.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract scripts/lib/skill-corpus.mjs and route both CI-gating scripts through it (WR-12)** - `9118089` (feat)
2. **Task 2: Fix the coverage script's vacuous projection assertions and its accidentally-widened allowlist (WR-06, WR-07)** - `71bc692` (fix)
3. **Task 3: Fix the fork-honesty lint's line-wrap dependence, section-scoped annotation rule, and misdirected error lines (WR-09, WR-10, WR-11)** - `f2eea29` (fix)

_No plan-metadata commit follows this file per the atomic close-out invariant -- this SUMMARY, STATE.md, and ROADMAP.md are committed together in the standard `git_commit_metadata` step immediately after this file is written._

## Files Created/Modified

- `scripts/lib/skill-corpus.mjs` - new module: `walkSkills()`, `MCP_PREFIX_RE`, `TOOL_NAME_RE`, `extractToolNames()`, `topLevelSkillDirs()`
- `scripts/check-skill-tool-coverage.mjs` - imports the new module (no local copy left); `FORK_ONLY_UNRECOVERABLE` cardinality assertion replaces two tautological echoes (WR-06); allowlist narrowed to skill-referenced hardware/fork tools, third hand-maintained expected-set list deleted (WR-07)
- `scripts/check-skill-fork-honesty.mjs` - imports the new module (no local copy left, stale provenance comment removed); stale-forward-reference lint is paragraph-scoped with a widened, citation-guarded phase pattern (WR-09); annotation compliance decided per tool name via a bounded window, loose alternatives dropped (WR-10); per-name line offsets corrected (WR-11)

## Decisions Made

See `key-decisions` in frontmatter: (1) WR-07 implemented exactly as the review's own fix snippet specifies, with the resulting future-mention limitation documented rather than silently accepted or papered over with an undocumented stronger mechanism the plan did not request; (2) the WR-10 acceptance criterion's literal whole-file grep for `"VICE_BACKEND"` is satisfied for its actual intent (removed from the annotation predicate) while a legitimate, unrelated, pre-existing README-required-substring check that also uses that string is left untouched, since deleting it to satisfy an unrelated grep would itself be a prohibited "weaken a check to force a pass."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Acceptance-criteria/fix-snippet tension] WR-07's planted-violation acceptance criterion cannot be satisfied by the fix as literally specified**
- **Found during:** Task 2, while running the acceptance criteria's planted-mutation probe before committing
- **Issue:** The task's `<acceptance_criteria>` says a bare mention of a newly-referenced keyboard tool name should make `check-skill-tool-coverage.mjs`'s core check fail. The task's own `<action>` text, and `08-REVIEW.md WR-07`'s own "Fix:" code snippet, both specify narrowing the allowlist via `FORK_ONLY_UNRECOVERABLE.filter(([n]) => extracted.has(n))` -- a filter evaluated against the SAME run's `extracted` map that the just-added mention is already part of. Empirically confirmed (see Planted-Violation Evidence above): adding the mention does not fail the script, because the filter and the mention are computed in the same pass; there is no way for a single-execution script to distinguish "referenced before this change" from "referenced including this change" without either (a) reading git history (out of scope, not requested, and a much bigger architectural change) or (b) reverting to a hand-typed name list (exactly what WR-07 objects to).
- **Fix:** Implemented the narrowing exactly as specified (matches the review's own written fix and the plan's `<action>` text verbatim). Ran the planted-mutation probe as instructed, recorded the true (non-failing) result, and documented the architectural reason in this SUMMARY rather than silently claiming the acceptance criterion passed, or inventing an unrequested stronger mechanism (e.g. requiring inline annotation, which is WR-10's job in the other script) to force the criterion to pass.
- **Files modified:** `scripts/check-skill-tool-coverage.mjs` (no additional change beyond the specified fix)
- **Verification:** Planted-mutation transcript recorded above; reverted and diffed clean against a pre-mutation backup
- **Committed in:** `71bc692`

**2. [Rule 1 - Acceptance-criteria over-breadth] WR-10's literal `VICE_BACKEND` grep would also require deleting an unrelated, legitimate check**
- **Found during:** Task 3, while checking acceptance criteria before committing
- **Issue:** The acceptance criterion `grep -v -E '^\s*(//|\*|/\*)' scripts/check-skill-fork-honesty.mjs | grep -c 'VICE_BACKEND'` expects `0`, but the file legitimately contains an unrelated, pre-existing `REQUIRED_README_SUBSTRINGS` entry (`["VICE_BACKEND", "a reader cannot select a backend at all"]`) asserting that README.md documents the `VICE_BACKEND` environment variable -- a real, independent requirement (`DIST-02`/`DIST-03`) that predates this plan and has nothing to do with the fork-only-annotation signal WR-10 addresses.
- **Fix:** Confirmed via direct inspection that `ANNOTATION_RE` and the `nearName` predicate (the actual WR-10 subject) no longer reference `"fork backend"` or `"VICE_BACKEND"` in any form. Left the unrelated README-required-substring check untouched, since deleting a real, correct check purely to satisfy an unrelated grep would be exactly the kind of "weaken a check to make it exit 0" this plan's own prohibitions forbid.
- **Files modified:** none beyond the specified WR-10/WR-11 fix
- **Verification:** `grep -n "ANNOTATION_RE\s*=\|nearName = new RegExp" -A3 scripts/check-skill-fork-honesty.mjs` shows neither loose alternative present in either definition
- **Committed in:** `f2eea29`

---

**Total deviations:** 2 auto-fixed, both documentation-accuracy corrections (no code beyond what the plan specified; no relaxed assertion; no name added to any allowlist). **Impact:** Both fixes landed exactly as specified in the plan and in `08-REVIEW.md`'s own written fixes; the deviations are honest documentation of where a literal acceptance-criterion reading diverges from what the specified code change can actually prove, recorded so GATE-02's disposition for WR-07 carries an accurate caveat rather than an inflated "fully closed" claim.

## Issues Encountered

None beyond the two deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Six of Phase 08's ten open review findings (WR-06, WR-07, WR-09, WR-10, WR-11, WR-12) are now fixed at source, each with a citable commit and a reverted planted-violation proof. `08-REVIEW.md`'s remaining four findings (WR-04, WR-05, WR-08, WR-13/WR-14 -- see `.planning/todos/pending/2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md`) are unaffected by this plan and remain for later disposition; per the plan's own `<output>` instruction, that pending todo is left in place (not moved or closed) since plan 15-12 closes it once plan 15-03's findings also land. Both CI-gating scripts (`check-skill-tool-coverage.mjs`, `check-skill-fork-honesty.mjs`) are green from a clean checkout, and `scripts/lib/skill-corpus.mjs` is now the one place a future skill-corpus-shape change needs to land. No blockers.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`scripts/lib/skill-corpus.mjs`, `scripts/check-skill-tool-coverage.mjs`, `scripts/check-skill-fork-honesty.mjs`, this SUMMARY). All three task commits confirmed in `git log` (`9118089`, `71bc692`, `f2eea29`). Plan-level `<verification>` re-run clean from the current working tree: `node scripts/check-skill-tool-coverage.mjs` exits 0 (37 vice_* names, 30 files, 6 directories); `node scripts/check-skill-fork-honesty.mjs` exits 0 (11 fork-only mentions, 30 files, 6 directories); `npm run typecheck` and `npm run test:automated` (`.claude/mcp/vice`) both exit 0 (2097 pass, 0 fail, 5 pre-existing todo). No `capability-registry.ts` or skill-corpus file left in a mutated state (all planted-violation probes reverted and diff-confirmed clean against pre-mutation backups before this check).
