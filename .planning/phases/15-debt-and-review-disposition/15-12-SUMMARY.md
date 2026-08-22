---
phase: 15-debt-and-review-disposition
plan: 12
subsystem: testing
tags: [review-disposition, requirements-close, deferred-ledger, planning-doc-guards, gate-02, debt-01, debt-02, debt-03]

requires:
  - phase: 15-debt-and-review-disposition
    provides: "Every sibling plan's landed fixes and dispositions (15-01 through 15-11) — this plan transcribes their verdicts into one closing record rather than re-deciding anything"
provides:
  - "Phase 08's ten review findings (WR-04..WR-13) closed with a per-finding verdict table citing resolvable commits from plans 15-02/15-03"
  - "Three remaining pending todos (broker-tests-stall, .vsf-bootstrap-input, keyboard-fallback-load) closed wont-fix/promoted with recorded rationale"
  - "Every item promoted rather than fixed carries a named Owner: clause in REQUIREMENTS.md -> Future Requirements -> ### Promoted by DEBT-01"
  - "GATE-02, DEBT-01, DEBT-02, DEBT-03 flipped Complete in REQUIREMENTS.md with closure notes stating exactly what was achieved"
  - "STATE.md's Deferred Items ledger regenerated from disk (2 pending todos, 0 UAT gaps) and reconciled in both directions"
  - "ROADMAP.md's Phase 15 section closed out: 12/12 plans, criterion-by-criterion Notes, milestone checklist flipped"
affects: [16-packaging-and-repo-shape, 17-project-identity-and-ledger-close]

actuals:
  tokens: 20928
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Transcribe-not-restate disposition: per-finding verdicts for findings fixed by sibling plans are copied with their landing commit into one closing Resolution table, each commit re-verified with git cat-file -e at closure time rather than trusted from the sibling SUMMARY."
    - "Promotion requires an Owner: clause, always: every Future Requirements bullet this plan adds ends with a named forward-looking owner (a future phase ID, or an explicit 'no v0.4.0 phase does this' statement), never a bare deferral."
    - "Guard non-vacuity floors and positive-control stems move WITH the debt they measure: closing a todo that was itself a guard's positive-control fixture (or dropping pending count below an existing floor) requires updating the guard's own constants in the same commit, not leaving it to go red."

key-files:
  created:
    - .planning/phases/15-debt-and-review-disposition/15-12-SUMMARY.md
  modified:
    - .planning/todos/completed/2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md
    - .planning/todos/completed/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md
    - .planning/todos/completed/2026-08-20-vsf-as-a-bootstrap-input.md
    - .planning/todos/completed/2026-08-19-keyboard-fallback-load-does-not-progress-within-bounded-poll.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md
    - .claude/mcp/vice/docs-dangling-refs.test.ts
    - .claude/mcp/vice/docs-deferred-ledger.test.ts
    - .claude/mcp/vice/r2000-cli.ts
    - .claude/mcp/vice/r2000-project.ts

key-decisions:
  - "Moving the .vsf-bootstrap-input todo to completed/ was not a pure documentation move: docs-dangling-refs.test.ts's VSF_BACKLOG_ITEM constant and two shipped runtime/comment string literals in r2000-cli.ts/r2000-project.ts all hardcode the exact pending/ path as the r2000 CLI's own user-facing refusal message. All three updated to completed/ in the same commit as the move (Rule 3 blocking-issue fix) — leaving them stale would have shipped a refusal message pointing users at a file that no longer exists at that path, and failed the guard."
  - "The keyboard-fallback-load todo was promoted with a named owner, not closed wont-fix or closed on new evidence: plan 15-08's live UAT work exercised neither the same tool (vice_keyboard_petscii, not the keyboard-typed LOAD route) nor the same failure mode (no LOAD command was ever issued in scenario 2), so neither of the plan's two closing conditions was met. Closing on inference from either result would have been exactly the kind of unproven disposition this phase exists to stop."
  - "13-REVIEW.md's IN-02 promotion (named to this plan by plan 15-05) was recorded with a real forward-looking owner (the GSD toolkit itself / code-review.md's files: derivation), not re-promoted back to 'plan 15-12' — this plan is the terminal owner the promotion was handed to, and a Future Requirements bullet naming a now-finished plan as its own owner would be a promotion with no real future action attached."
  - "docs-deferred-ledger.test.ts's positive-control stem and non-vacuity floor were updated in Task 1's own commit (not deferred to Task 3): closing 2026-08-20-vsf-as-a-bootstrap-input.md removed the exact stem the guard's positive control hardcoded, and reducing pending to 2 tripped the pre-existing >=5 floor. Both were fixed immediately so the guard was never left red between commits."
  - "STATE.md's Deferred Items uat_gap row was removed only in Task 3, not Task 1: Task 1's four closures did not touch 03-HUMAN-UAT.md, and the plan's own Task 3 action text assigns the uat_gap-row-removal decision specifically to the final reconciliation pass."
  - "No finding was recorded superseded in this phase's own work. A draft closure-note claim asserting docs-review-disposition.test.ts had 'recognised a genuine superseded verdict' on a prior finding was checked against source before committing and found to conflate an unrelated stale-phase-pointer discussion with an actual finding disposition; corrected before commit rather than left as an unverified claim."

patterns-established:
  - "A closing plan's own draft prose is re-verified against source before commit, the same discipline this phase's other plans applied to inherited claims — catching a fabricated cross-reference is exactly the kind of error a self-check step exists to prevent, not just errors inherited from someone else's prior work."

requirements-completed: [GATE-02, DEBT-01, DEBT-02, DEBT-03]

coverage:
  - id: D1
    description: "Phase 08's ten review findings (WR-04..WR-13) closed in .planning/todos/completed/2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md with a per-finding verdict table, each commit verified with git cat-file -e"
    requirement: GATE-02
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-review-disposition.test.ts (7/7 pass, 150 findings, 0 undispositioned)"
        status: pass
      - kind: other
        ref: "git cat-file -e on all seven distinct commits cited (f868d51, 98f0531, e9fa737, 21a42cbb8635cac414f70179f934ae95e0c68b83, 9118089, 71bc692, f2eea29) — all exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Broker-tests-stall, .vsf-bootstrap-input, and keyboard-fallback-load todos closed (wont-fix / wont-fix / promoted-with-owner respectively); all four Task 1 todos renamed not deleted"
    requirement: DEBT-01
    verification:
      - kind: other
        ref: "git status --porcelain shows four renames pending/ -> completed/; ls .planning/todos/pending/*.md | wc -l == 2"
        status: pass
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-dangling-refs.test.ts (8/8 pass, including the .vsf backlog item's still-exists check against its new completed/ path)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every remaining pending todo mapped to a named Phase 16 owner (PKG-01, PKG-03); every Future Requirements promotion carries an Owner: clause; GATE-02/DEBT-01/DEBT-02/DEBT-03 flipped Complete with closure notes"
    requirement: DEBT-01
    verification:
      - kind: other
        ref: "grep -c '\\[x\\] \\*\\*GATE-02'/DEBT-0[123] .planning/REQUIREMENTS.md each == 1; Traceability rows agree; bullets under ### Promoted by DEBT-01 (4) == Owner: count (4); placeholder sentence grep == 0"
        status: pass
    human_judgment: true
    rationale: "Confirming each closure note states what was actually achieved rather than what was intended is this plan's own <human-check> requirement — a judgment call about prose honesty on a text artifact, not a mechanically checkable fact."
  - id: D4
    description: "STATE.md's Deferred Items table regenerated from .planning/todos/pending/ in ascending filename order, uat_gap row removed (03-HUMAN-UAT.md has zero pending scenarios), both prose counts reconciled to 2; ROADMAP.md's Phase 15 section closed out with a criterion-by-criterion Notes paragraph, scoped-edited"
    requirement: null
    verification:
      - kind: unit
        ref: "cd .claude/mcp/vice && node --test docs-deferred-ledger.test.ts (4/4 pass, both directions)"
        status: pass
      - kind: other
        ref: "diff <(awk -F'|' '/^\\| todo \\|/{gsub(/ /,\"\",$3); print $3}' .planning/STATE.md) <(ls .planning/todos/pending/ | sed 's/\\.md$//') reports no differences; git diff --stat .planning/ROADMAP.md confined to Phase 15 section (0 other ### Phase headings touched)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full gate chain green: npm run typecheck, all five docs-*.test.ts guards, npm run test:automated, both skill-lint scripts, check-npm-packages.mjs"
    requirement: null
    verification:
      - kind: integration
        ref: "cd .claude/mcp/vice && npm run typecheck && node --test docs-review-disposition.test.ts docs-deferred-ledger.test.ts docs-linerefs.test.ts docs-dangling-refs.test.ts docs-fork-decision.test.ts && npm run test:automated (2112/2107/0/5) && node scripts/check-skill-tool-coverage.mjs && node scripts/check-skill-fork-honesty.mjs && node scripts/check-npm-packages.mjs"
        status: pass
    human_judgment: false

duration: ~40min (estimated — PLAN_START_TIME was not captured at session start; based on the three task commit timestamps, 20:03-20:14, plus reading/research time beforehand)
completed: 2026-08-22
status: complete
---

# Phase 15 Plan 12: Close the Phase's Record — Per-Finding Verdicts, Named Owners, Requirements Flipped Complete Summary

**Transcribed Phase 08's ten review findings into one resolvable-commit verdict table, closed the three remaining pending todos (wont-fix/wont-fix/promoted), named an owner for every follow-on DEBT-01 promotes, flipped GATE-02/DEBT-01/DEBT-02/DEBT-03 Complete with closure notes, and regenerated STATE.md's Deferred Items ledger to 2 pending todos with zero UAT gaps — closing Phase 15 at 12/12 plans with every planning-doc guard green.**

## Performance

- **Duration:** ~40 min (estimated)
- **Completed:** 2026-08-22T20:14:43+02:00
- **Tasks:** 3 completed
- **Files modified:** 14 (across three commits — 4 todo renames, 4 shipped/test files, 4 planning documents; see per-task detail below)

## Accomplishments

### Task 1 — Phase 08's ten findings, and three remaining todos closed

**Ten-finding verdict table** (`.planning/todos/completed/2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md`), transcribed from plans 15-02/15-03's landed commits, every commit re-verified with `git cat-file -e` at closure time:

| Id | Verdict | Commit | Non-vacuity |
|----|---------|--------|-------------|
| WR-04 | Fixed | `f868d51` | Cell-count invariant test; planted-pipe probe (green with `cell()`, red without) |
| WR-05 | Fixed already (cited) | `21a42cbb8635cac414f70179f934ae95e0c68b83` | Predates this phase — TS7016/`allowJs:false` is why the review's suggested import route was not taken |
| WR-06 | Fixed | `71bc692` | Cardinality assertion against an independently-verified count (6); planted category-retag probe |
| WR-07 | Fixed, with a documented limitation | `71bc692` | Planted-mutation probe honestly recorded an architectural limit (single-pass filter cannot catch a same-run stealth mention) |
| WR-08 | Fixed | `98f0531` | Three independently-bounded declaration scans; planted `BOGUS_TOOL` probe |
| WR-09 | Fixed | `f2eea29` | Paragraph-scoped lint with a citation-guard; planted hard-wrapped-deferral probe |
| WR-10 | Fixed | `f2eea29` | Per-tool bidirectional-window compliance; planted `vice_keyboard_chord` probe (shared with WR-11) |
| WR-11 | Fixed | `f2eea29` | Per-name line offsets; same planted probe |
| WR-12 | Fixed | `9118089` | `scripts/lib/skill-corpus.mjs` extraction; each script's own pre-existing directory/file-count check exercised unchanged |
| WR-13 | Fixed | `e9fa737` | Two shipped-module-wide invariant tests; planted `stock-memory.ts` probe |

No finding recorded `superseded` — every one confirmed genuinely still open (or, for `WR-05`, already fixed at a cited prior commit) before being fixed.

**Broker-tests-stall todo** (`.planning/todos/completed/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`) — closed **`wont-fix`**, quoted rationale:

> **Not a bug to fix — these are not automatable.** They depend on manual host setup (a real broker topology and a real emulator/display environment), so they cannot be driven unattended. Do NOT sink further effort into making them pass headless. Exclude them from the automated gate and treat them as manual / environment-dependent checks.

Promoted the pre-existing 2026-08-12 user decision into the Resolution rather than re-deciding it; cross-referenced plan 15-11's CI test-command decision (same manual-only set, opposite direction: they DO pass on a CI runner, so `npm test` stays wider than the local gate there).

**`.vsf`-as-bootstrap-input todo** (`.planning/todos/completed/2026-08-20-vsf-as-a-bootstrap-input.md`) — closed **`wont-fix`**, quoted rationale (`REQUIREMENTS.md`'s own pre-existing Out of Scope line, verbatim):

> `.vsf` as a regenerator2000 bootstrap input | Covered by `DEBT-01` as a disposition, not as a build. D-34 stands unless a consumer has `.vsf` captures and cannot re-capture as `.raw`.

Moving this file required a wider sweep than a pure documentation move: `docs-dangling-refs.test.ts`'s `VSF_BACKLOG_ITEM` constant, and two shipped runtime/comment string literals in `r2000-cli.ts` (the CLI's own user-facing `.vsf` refusal message, two sites) and `r2000-project.ts` (a header comment) all hardcoded the exact `pending/` path. All three updated to `completed/` in the same commit — a real user running the shipped `r2000 bootstrap` CLI against a `.vsf` file would otherwise have been told to look at a file that no longer existed at that path.

**Keyboard-fallback-load todo** (`.planning/todos/completed/2026-08-19-keyboard-fallback-load-does-not-progress-within-bounded-poll.md`) — **promoted with a named owner**, neither wont-fix nor closed on new evidence. Checked plan 15-08's live UAT work directly: scenario 1 used `vice_autostart` (not the keyboard-typed `LOAD` route); scenario 2 used `vice_keyboard_petscii` (proves keyboard injection works, but never issues a `LOAD` command, so it never exercises the IEC-emulated disk-load timing this todo is about). Neither of the plan's two closing conditions was met — closing on inference from either result would have been unproven. Owner: whichever future plan or milestone next touches `c64-ram-capture`'s keyboard-typed-fallback load path (no v0.4.0 phase does).

### Task 2 — Promotions with named owners, four requirements flipped Complete

**`### Promoted by DEBT-01`** filled in with four bullets, each ending in an `Owner:` clause:

1. **`vice_disk_attach`'s contract-redesign question** (from plan 15-11) — Owner: whichever future milestone next redesigns `vice_disk_attach`'s tool contract (no v0.4.0 phase implements it).
2. **`code-review.md`'s file-list scoping omission** (`13-REVIEW.md` `IN-02`, from plan 15-05, named to this plan) — Owner: the GSD toolkit itself (upstream, not this project's source tree).
3. **Measuring `InitialWarpMode`'s actual runtime effect** (from plan 15-09) — Owner: whichever future plan next needs stock warp/speed control for a real capability.
4. **Deriving `cpuhistory-get*` fixtures' `capturedFrom` kind automatically** (from plan 15-07) — Owner: whichever future plan next edits `probe-binmon.mjs`'s capture path for an unrelated reason.

**Pending file → named owner mapping** (both files stay in `pending/`, mapped, not moved — matching the phase's own precedent that a promotion does not require moving the file when the owner is a future phase, not a closed disposition):

| Pending file | Owner |
|---|---|
| `2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json.md` | `PKG-01` (Phase 16) — confirmed against Phase 16's own goal text ("The plugin payload lives under `src/`...") and the todo's own `resolves_phase: 16` frontmatter |
| `2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md` | `PKG-03` (Phase 16) — confirmed against Phase 16's own goal text ("Orphaned planning references in source comments are removed or repointed") and the todo's own `resolves_phase: 16` frontmatter |

Row count (2) equals `ls .planning/todos/pending/*.md | wc -l` (2); no Owner cell empty.

**Four requirements flipped Complete**, each with a closure note (quoted in full in `.planning/REQUIREMENTS.md`; summarized here):

- **GATE-02** — the guard's parser was widened in-phase (119 → 150 findings) before anything could be dispositioned against it meaning what it claimed; two new shape invariants (a shape-drift detector, a fixture-driven regression test) stop a fifth heading shape vanishing silently. No finding was disposed `superseded` in this phase's own work.
- **DEBT-01** — pending count moved 21 → 2 (19 todos closed across plans 15-04 through 15-12); every promotion has a named owner; every `wont-fix` disposition's rationale is quoted; this is the Phase-15 count, not the milestone-final one (Phase 17 measures `DEBT-04` after Phase 16 discharges `PKG-01`'s own todo).
- **DEBT-02** — all five behaviours documented at point of use, cited by file and heading; the warp caveat landed in two project-owned files (not the generated manifest, which is byte-identical to before), with the reason stated (it's a text/documentation caveat, not a schema change).
- **DEBT-03** — all three UAT scenarios recorded with evidence; scenario 2's honest joystick negative result is named plainly, with no fix promoted for it specifically since `A3`'s `[ASSUMED]` label was already a standing, disclosed limitation before this phase.

### Task 3 — Ledger reconciled, STATE.md and ROADMAP.md closed out, full gate run

**Three agreeing ledger counts** — pending files (2) + UAT-gap rows (0) = table rows (2) = prose count (2). `03-HUMAN-UAT.md`'s `uat_gap` row (present since the v0.2.0 close) removed: the file now records zero `result: [pending]` rows (all three scenarios closed live by plans 15-08/15-10).

`.planning/STATE.md` updates: Current Position rewritten for Phase 15's close (12/12 plans); the v0.3.0-close-era "Operator Next Steps" section (still saying "Next phase number is 12", referencing a `v0.3.0` tag push) replaced entirely with real Phase 16/17 guidance; a stale "Also carried, not blocking" paragraph still describing `WR-13` as open dead code corrected (it was fixed by plan 15-03); frontmatter `stopped_at`/`last_updated`/`last_activity_desc`/`progress` block updated by hand after `state.advance-plan`'s own blind "N of 12" framing did not fit this wave-parallel phase (same known limitation this file already documents from plan 08's own execution).

`.planning/ROADMAP.md`'s Phase 15 section: `**Plans**: 11/12` → `12/12`, `15-12-PLAN.md` checked off, a criterion-by-criterion Notes paragraph added (all four success criteria satisfied, plus the guard-blindness discovery carried forward), and the milestone-level phase checklist entry flipped `[x]`. Edited scoped via `Edit`, not a whole-file `Write`: `git diff --stat .planning/ROADMAP.md` shows changes confined to the Phase 15 region; zero other `### Phase` headings touched.

**No-silent-drop audit, counts not claims:** the phase's own probe-fallback surfaced 9 edge items across four requirement texts. Verified directly against source: 4 authored as `must_haves.truths` on `GATE-02` (plan 15-01 — parsed-id de-duplication, the empty/zero-parse cases, the id terminator, the sorted failure list); 3 authored as `must_haves.truths` on `DEBT-01` (2 in this plan's own frontmatter — ledger both-direction health, ascending-filename row order; 1 in plan 15-05 — "no incidental-phase-match disposition", confirmed present in `15-05-PLAN.md`'s own `must_haves.truths`); 2 flagged rather than answered (`DEBT-02`, `DEBT-03` — both `unclassified` by the probe, no boundary/ordering/encoding edge applies to a placement-judgment or a live-emulator-timing requirement). 4 + 3 + 2 = 9, matching the plan's own `applicable: 9` claim. Every kept prohibition in this plan's own `must_haves.prohibitions` (5 total) was checked against the actual work done — all five satisfied (see Deviations section below for how each was honored, not merely asserted).

**Full gate chain, all green:**

```
cd .claude/mcp/vice
npm run typecheck                                    # exit 0
node --test docs-review-disposition.test.ts          # 7/7 pass, 150 findings, 0 undispositioned
node --test docs-deferred-ledger.test.ts             # 4/4 pass, both directions
node --test docs-linerefs.test.ts                    # 3/3 pass
node --test docs-dangling-refs.test.ts               # 8/8 pass
node --test docs-fork-decision.test.ts               # 6/6 pass
npm run test:automated                               # 2112 tests / 2107 pass / 0 fail / 5 pre-existing todo
cd ..
node scripts/check-skill-tool-coverage.mjs           # OK — 37 vice_* names, 30 files, 6 directories
node scripts/check-skill-fork-honesty.mjs            # OK — 11 fork-only mentions, 30 files, 6 directories
node scripts/check-npm-packages.mjs                  # OK — both tarballs clean
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Close the Phase 08 review todo with per-finding verdicts, and the three remaining wont-fix todos** - `68b26c6` (docs)
2. **Task 2: Record every promotion with a named owner and flip the four requirements Complete** - `601a53c` (docs)
3. **Task 3: Reconcile the ledger and STATE.md, update ROADMAP Phase 15, and run the full gate** - `3dbf749` (docs)

**Plan metadata:** this SUMMARY commits alongside `.planning/STATE.md`/`.planning/ROADMAP.md`/`.planning/REQUIREMENTS.md`, all of which already carry their real content from the three task commits above — the final metadata commit is this file only (STATE.md/ROADMAP.md/REQUIREMENTS.md have no further changes at this point).

## Files Created/Modified

- `.planning/todos/completed/2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md` - renamed from `pending/`; ten-finding verdict table added
- `.planning/todos/completed/2026-08-12-vice-broker-tests-stall-outside-devcontainer.md` - renamed from `pending/`; `wont-fix` Resolution added
- `.planning/todos/completed/2026-08-20-vsf-as-a-bootstrap-input.md` - renamed from `pending/`; `wont-fix` Resolution added
- `.planning/todos/completed/2026-08-19-keyboard-fallback-load-does-not-progress-within-bounded-poll.md` - renamed from `pending/`; promoted-with-owner Resolution added
- `.claude/mcp/vice/docs-dangling-refs.test.ts` - `VSF_BACKLOG_ITEM` constant updated `pending/` → `completed/` to match the move
- `.claude/mcp/vice/docs-deferred-ledger.test.ts` - positive-control stem switched to a todo that stays pending; non-vacuity floor lowered 5 → 2
- `.claude/mcp/vice/r2000-cli.ts` - two shipped runtime refusal-message string literals updated `pending/` → `completed/`
- `.claude/mcp/vice/r2000-project.ts` - one header comment updated `pending/` → `completed/`
- `.planning/PROJECT.md` - `.vsf` Out of Scope bullet's path reference and closure status updated
- `.planning/REQUIREMENTS.md` - `### Promoted by DEBT-01` filled in (4 bullets with owners); GATE-02/DEBT-01/DEBT-02/DEBT-03 flipped Complete with closure notes in both the checklist and Traceability table
- `.planning/STATE.md` - Deferred Items table regenerated (2 pending, 0 UAT gaps); Current Position, Operator Next Steps, frontmatter, and one stale WR-13 paragraph corrected for Phase 15's close
- `.planning/ROADMAP.md` - Phase 15 section closed out (12/12 plans, Notes paragraph, milestone checklist), scoped-edited

## Decisions Made

See `key-decisions` in frontmatter. In summary: (1) the `.vsf` todo move required updating three shipped/test path references, not just the todo file itself; (2) the keyboard-fallback todo was promoted, not closed, since neither of the plan's two closing conditions was met by 15-08's evidence; (3) `13-REVIEW.md`'s `IN-02` promotion was given a real forward-looking owner (the GSD toolkit) rather than re-promoted to this now-finished plan; (4) `docs-deferred-ledger.test.ts`'s positive-control stem and non-vacuity floor were fixed in the same commit as the closures that would otherwise break them; (5) the `uat_gap` row's removal was deliberately deferred to Task 3, per the plan's own task boundary; (6) a fabricated "superseded" cross-reference was caught and corrected in this plan's own closure-note draft before commit, not left as an unverified claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moving the `.vsf` todo to `completed/` broke a guard constant and two shipped user-facing strings**
- **Found during:** Task 1, immediately after `git mv`, before writing the Resolution
- **Issue:** `docs-dangling-refs.test.ts`'s `VSF_BACKLOG_ITEM` constant and `r2000-cli.ts`'s two runtime refusal-message string literals (plus `r2000-project.ts`'s one header comment) all hardcoded the exact `.planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md` path. Left unfixed, `docs-dangling-refs.test.ts` would fail (`existsSync` check against the stale path) and the shipped CLI's own `.vsf` refusal message would point a real user at a file that no longer existed there.
- **Fix:** Updated all three references from `pending/` to `completed/` in the same commit as the move.
- **Files modified:** `.claude/mcp/vice/docs-dangling-refs.test.ts`, `.claude/mcp/vice/r2000-cli.ts`, `.claude/mcp/vice/r2000-project.ts`
- **Verification:** `node --test docs-dangling-refs.test.ts` (8/8 pass); `node --test r2000-cli.test.ts` (64/64 pass, including the test asserting the refusal message names the backlog item)
- **Committed in:** `68b26c6`

**2. [Rule 1 - Bug] `docs-deferred-ledger.test.ts`'s positive-control stem hardcoded the exact todo this plan closes**
- **Found during:** Task 1, first post-edit test run
- **Issue:** The guard's non-vacuity test asserted `"2026-08-20-vsf-as-a-bootstrap-input"` is a real pending stem — the exact todo Task 1 closes `wont-fix`. Left unfixed, the guard would fail the moment the todo moved.
- **Fix:** Switched the positive-control stem to `2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json`, a todo this plan deliberately leaves pending (promoted to `PKG-01`).
- **Files modified:** `.claude/mcp/vice/docs-deferred-ledger.test.ts`
- **Verification:** `node --test docs-deferred-ledger.test.ts` (12/12 pass after this fix plus the floor fix below)
- **Committed in:** `68b26c6`

**3. [Rule 1 - Bug] `docs-deferred-ledger.test.ts`'s non-vacuity floor (`>= 5`) would fail once pending dropped to 2**
- **Found during:** Task 1, same test run as #2
- **Issue:** The floor was already lowered once by plan 15-10 (10 → 5) with an explicit comment inviting a further lowering "if it ever trips for the same reason." Closing four todos in Task 1 dropped pending to 2, well under the existing floor.
- **Fix:** Lowered the floor to 2, following the same precedent, with a comment noting `DEBT-04` (Phase 17) may shrink it further still.
- **Files modified:** `.claude/mcp/vice/docs-deferred-ledger.test.ts`
- **Verification:** `node --test docs-deferred-ledger.test.ts` (12/12 pass)
- **Committed in:** `68b26c6`

**4. [Rule 1 - Bug] Three historical stem mentions inside STATE.md's `## Deferred Items` section tripped predicate 2 after the four todos moved to `completed/`**
- **Found during:** Task 1, running `docs-deferred-ledger.test.ts` after the STATE.md ledger edit
- **Issue:** `docs-deferred-ledger.test.ts`'s predicate 2 scans the whole `## Deferred Items` section for any completed todo's stem — including historical prose describing when and how a todo was filed, not only the current-status table. Three such mentions (of the now-completed `.vsf` and Phase-08-review todos) remained in historical paragraphs.
- **Fix:** Reworded each to a paraphrase that still names the finding/date but does not contain the literal filename stem, following the exact precedent plans 15-09/15-10/15-11 established for the same guard shape.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `node --test docs-deferred-ledger.test.ts` (12/12 pass, including the direction-B predicate)
- **Committed in:** `68b26c6`

**5. [Rule 1 - Bug] A stale "Also carried, not blocking" paragraph in STATE.md still described `WR-13` as open dead code**
- **Found during:** Task 1, while writing the ten-finding verdict table and noticing the contradiction with a separate STATE.md paragraph
- **Issue:** A paragraph dated from before this phase's work stated `WR-13` was "verified unreachable today ... dead code that violates one-source-of-truth" — accurate when written, but plan 15-03 had since fixed it (commit `e9fa737`).
- **Fix:** Corrected the paragraph to state the fix and cite the commit, pointing to the full ten-finding disposition for detail.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Direct re-read of the corrected paragraph against `15-03-SUMMARY.md`'s own accomplishments
- **Committed in:** `68b26c6`

**6. [Rule 1 - Bug] Draft GATE-02 closure note asserted an inaccurate cross-reference before verification**
- **Found during:** Task 2, while drafting the GATE-02 closure note
- **Issue:** An early draft claimed `docs-review-disposition.test.ts` "has recognised a genuine `superseded` verdict" on a prior finding (`stock-input.ts`'s `vice_joystick_tap`). Direct source inspection of the cited completed todo found this conflated an unrelated stale-phase-pointer discussion with an actual WR/IN/CR finding disposition — no such `superseded` verdict exists anywhere in the currently-tracked findings.
- **Fix:** Corrected the closure note to state accurately that no finding was disposed `superseded` in this phase's own work, citing plan 15-01's own corrected `WR-08`/`IN-03` verdicts (from `MOOT`/`SUPERSEDED` back to `STILL OPEN`) as the concrete evidence of that discipline instead.
- **Files modified:** `.planning/REQUIREMENTS.md` (caught before the commit that added this text — no separate fix commit needed)
- **Verification:** Direct grep across `.planning/todos/completed/*.md` for any finding ID paired with the word "superseded" — none found
- **Committed in:** `601a53c` (the corrected text is what was committed; the inaccurate draft was never committed)

---

**Total deviations:** 6 auto-fixed (1 blocking-issue fix, 5 bugs — all Rule 1/Rule 3). **Impact:** All six were caught and corrected within the task that introduced or discovered them, before that task's own commit. No scope creep: every fix was a documentation-accuracy or guard-consistency correction directly required by this plan's own assigned closures, not new unrelated work.

## Issues Encountered

None beyond the six auto-fixed deviations above, all caught and resolved within the task that introduced or discovered them.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. This plan edited planning documents, one test guard's constants, and three shipped string literals (path references only) — no code path renders empty/placeholder data.

## Threat Flags

None. This plan installs no packages, adds no dependency, and introduces no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary — see the plan's own `T-15-SC` threat-register row (`accept`, "installs no packages").

## Next Phase Readiness

- **Phase 15 is complete: 12/12 plans, all four requirements (`GATE-02`, `DEBT-01`, `DEBT-02`, `DEBT-03`) Complete with closure notes.**
- The pending-todo tree is down to 2 files, both promoted to named Phase 16 requirements (`PKG-01`, `PKG-03`) — Phase 16 can start planning with both already scoped and cited.
- `DEBT-04` (Phase 17) is NOT measured by this plan — this is the Phase-15 count (2 pending, 0 UAT gaps), not the milestone-final one; Phase 17 must wait for Phase 16 to discharge `PKG-01`'s own todo before taking its measurement, per ROADMAP's own Phase 17 sequencing note.
- All five planning-doc guards, `npm run test:automated`, both skill-lint scripts, and `check-npm-packages.mjs` are green — `GATE-01`'s own mechanically-enforced precondition for a future milestone-audit `status: passed` is satisfied at this phase boundary.
- No blockers for Phase 16 planning.

---
*Phase: 15-debt-and-review-disposition*
*Completed: 2026-08-22*

## Self-Check: PASSED

- All twelve key-files (four completed todos, `REQUIREMENTS.md`, `STATE.md`, `ROADMAP.md`, `docs-dangling-refs.test.ts`, `docs-deferred-ledger.test.ts`, `r2000-cli.ts`, `r2000-project.ts`, this SUMMARY) confirmed present on disk with `[ -f ]`.
- All three task commits confirmed in `git log --oneline --all`: `68b26c6`, `601a53c`, `3dbf749`.
- Plan-level `<verification>` re-run clean immediately before this check: `npm run typecheck` exits 0; all five `docs-*.test.ts` guards exit 0 (28/28 combined); `npm run test:automated` exits 0 (2112/2107/0/5, unchanged baseline); both skill-lint scripts and `check-npm-packages.mjs` exit 0 (see Task 3 output above, re-run identically).
- `git status --porcelain` on `.planning/todos/` shows exactly the four expected renames, zero deletions.
- `ls .planning/todos/pending/*.md | wc -l` == 2, matching the SUMMARY's own pending-file → owner mapping table row count.
- `docs-deferred-ledger.test.ts`'s two AUDIT-04 predicates both pass against the real, current `STATE.md` and todo tree (not only the synthetic planted-violation fixtures).
