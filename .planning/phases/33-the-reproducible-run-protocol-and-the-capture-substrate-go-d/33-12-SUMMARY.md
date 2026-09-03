---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 12
subsystem: planning
tags: [gate, decision-rule, verdict, roadmap, state, todos, git-ordering]

requires:
  - phase: 33-01
    provides: "The frozen pre-commitment — DECISION-RULE.md's R1..R9 first-match-wins, SCHEMA.md's outcome-line names/domains/derivations, and README.md's evidence conventions plus the banked ordering proof, all committed at 2a8ef95 before any measurement existed"
  - phase: 33-03
    provides: "AUTOSTART_SEQUENCE: S3, AUTOSTART_FRAME_EXACT: not-achieved, WALLCLOCK_CONTROL: red and WARP_BRACKET_CONTROL: red — the non-input findings and the withdrawn cap claim"
  - phase: 33-07
    provides: "SLICER: validated (gate input 1), with both declared suite transcripts, plus the CAP-03 derived-scalar accepted limit"
  - phase: 33-10
    provides: "C0_CAPTURE_PAIR: pass (gate input 4), CAPTURE_FRAME_EXACT: no, TRANSIENT_COUNT: 49 and MEMSPACE_ASSERTION: refuses"
  - phase: 33-11
    provides: "SEED_EFFECT: pinned, JITTER_IMMUNITY: immune and ORACLE_NECESSITY: unproven (gate inputs 2, 3 and 5), RESET_REMOVED_CONTROL: red, PROBEREADY_BUDGET: short, and the ACCEPTED LIMIT that named 33-12 as the only plan that may revisit the oracle value"
provides:
  - "GATE-01's machine-readable verdict: `degrade`, fired by rule `R6`, in docs/phase33-reproducible-run-gate-findings.md's frontmatter, derived by walking five transcribed input values through rules that provably predate them"
  - "The rule set reproduced verbatim plus the walk written out, so the verdict is re-derivable from the document alone without any plan file or SUMMARY surviving"
  - "The re-run ordering proof: rev-list --count over evidence/ still 1 at 2a8ef95 after every measurement landed, and all three frozen files still at exactly one commit"
  - "One document section per gate input and per non-input finding, plus every ACCEPTED LIMIT any evidence file recorded, the two superseded ROADMAP-note claims, and the four 33-02 reconciliations"
  - "R6's D-04 pre-mapped narrowing bound into Phases 34-38's own ROADMAP Notes, with what it does NOT narrow stated explicitly per phase"
  - "Phase 33's finalised ROADMAP entry: a real Plans line and all five success criteria annotated with their outcome and the evidence file behind it, including one PARTLY MET and one named shortfall"
  - "Three folded todos closed with honest closing notes, two of them on partial results, with their Deferred Items rows removed in the same commit"
affects: [34, 35, 36, 37, 38, milestone-close, gate-precedent]

actuals:
  tokens: 26400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A derived verdict: five values transcribed from column-0 outcome lines in named files, walked through rules committed at a provably earlier commit, with the fired rule recorded by id"
    - "Unevaluated rules recorded as NOT EVALUATED rather than left blank, so a first-match-wins derivation cannot be misread as exhaustive"
    - "An available override declined in writing, with the four grounds recorded — the escape hatch is documented as unused rather than silently unavailable"

key-files:
  created:
    - docs/phase33-reproducible-run-gate-findings.md
  modified:
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/todos/completed/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md
    - .planning/todos/completed/2026-08-26-frame-exact-emulator-stop-is-unowned.md
    - .planning/todos/completed/2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md

key-decisions:
  - "The GATE-01 verdict is `degrade`, fired by R6 on ORACLE_NECESSITY: unproven — R1..R5 evaluated and did not match, R7/R8/R9 never evaluated under first-match-wins"
  - "The one override available to this plan was DECLINED: SCHEMA.md 2.3's strict 'exactly one frame apart' reading stands, so ORACLE_NECESSITY remains `unproven` rather than being moved to the flattering `proven` that would have reached R9 -> go"
  - "R6's narrowing is reproduced verbatim from DECISION-RULE.md's D-04 pre-mapping rather than re-authored, and labelled as written before the answer was known"
  - "The corpus frontmatter list carries only `danish` — the second on-disk release was not exercised in this phase and no outcome line here carries a number for it, so recording it would have been an unsourced value in the one document required to have none"
  - "Task 3's whole-file grep verify was replaced with the ledger guard's own section-scoped predicate: the plan's version was unsatisfiable without deleting v0.7.0 milestone-close records"

patterns-established:
  - "Pattern: the accepted limits of every measuring plan are collected into the verdict document, so the phase's honest edges reach the gate rather than dying in a plan SUMMARY"
  - "Pattern: a superseded ROADMAP note gets a dated rider appended in place with the original sentence left readable, never a silent rewrite"

requirements-completed: [GATE-01]

coverage:
  - id: D1
    description: "The machine-readable verdict — frontmatter carrying `verdict: degrade`, `verdict_rule_applied: R6` and all five transcribed input fields, with the rule set reproduced verbatim and the walk written out"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "grep -Eq '^verdict: (go|degrade|no-go)$' && grep -Eq '^verdict_rule_applied: R[1-9]$' && all five input fields present && 'Ordering proof' present -> VERDICT_SHAPE_OK"
        status: pass
      - kind: other
        ref: "each declared outcome line's final occurrence extracted from its declared source file and required present in the findings document -> INPUTS_TRANSCRIBED"
        status: pass
      - kind: other
        ref: "git rev-list --count 2a8ef95b3a6474d0300c3069eb56bfee33e820eb -- <evidence> == 1 -> ORDERING_STILL_HOLDS"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase 33's finalised ROADMAP entry (real Plans line, five criteria annotated with outcomes citing their evidence files, two superseded notes riddered, 33-12 ticked) and the verdict bound into Phases 34-38's own Notes with their per-phase narrowing"
    requirement: "GATE-01"
    verification:
      - kind: other
        ref: "Plans line matches ^\\*\\*Plans\\*\\*: [0-9]+ plans and each of Phases 34-38 carries a Notes entry citing phase33-reproducible-run-gate-findings -> BINDING_OK"
        status: pass
      - kind: other
        ref: "Phase 33 section cites evidence/ 6 times and no 'Plans**: TBD' survives -> CRITERIA_ANNOTATED"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-dangling-refs.test.ts + docs-linerefs.test.ts (tests 21 / fail 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three folded todos closed with closing notes naming what discharged each and its outcome line — two on partial results — with their three Deferred Items rows removed in the same commit, leaving 7 rows against 7 pending todos"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-deferred-ledger.test.ts + audit-integrity.test.ts (tests 50 / fail 0) — the two-directional ledger invariant"
        status: pass
      - kind: other
        ref: "all three under todos/completed/, none under todos/pending/, no bare-stem table cell left in the ## Deferred Items section -> FILES_MOVED_OK + SECTION_CLEAN_OK + SAME_COMMIT_OK"
        status: pass
    human_judgment: false
  - id: D4
    description: "The declined override: 33-11's disclosed ambiguity in SCHEMA.md 2.3 adjudicated in favour of the strict reading, with the four grounds recorded and the price of an override stated"
    requirement: "GATE-01"
    verification: []
    human_judgment: true
    rationale: "The only judgement this plan had authority over, and no automated check can assert that a reading of frozen prose was the right one. A verifier should read `## Verdict` -> `No override was taken` against `evidence/33-repro03-frame-anchor.md` `## ACCEPTED LIMIT` and confirm the value was NOT moved and that the four grounds are each traceable to a transcribed line."

duration: 21min
completed: 2026-09-03
status: complete
---

# Phase 33 Plan 12: The Recorded Verdict, Its Downstream Binding and the Folded-Todo Ledger Summary

**`GATE-01` returns `degrade` by rule `R6` — derived, not judged: five values transcribed from column-0 outcome lines walked through rules committed at `2a8ef95` (still the only commit reachable from itself touching the phase evidence tree), with `could-not-run` structurally unemittable and the one available override explicitly declined.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-03T00:13:24Z
- **Completed:** 2026-09-03T00:34:58Z
- **Tasks:** 3 of 3
- **Files modified:** 5 (1 created, 4 modified, 3 of them moved)

## Accomplishments

- **The verdict is a walk, not an assessment.** All five inputs were read from the **final occurrence** of their declared outcome line at column 0 of their declared source file — `SLICER: validated` (`evidence/33-slicer-validation.md:288`), `SEED_EFFECT: pinned` (`33-repro01-determinism.md:428`), `JITTER_IMMUNITY: immune` (`33-repro02-reset-removed.md:690`), `C0_CAPTURE_PAIR: pass` (`33-capture-pair.md:631`), `ORACLE_NECESSITY: unproven` (`33-repro03-frame-anchor.md:752`). Independently transcribed rather than taken from the orchestrator's table or any plan SUMMARY; **all five agreed with the orchestrator's table, so there is no disagreement to report.** `R1`..`R5` were evaluated and did not match, `R6` matched, and `R7`/`R8`/`R9` are recorded as **NOT EVALUATED** — the distinction `DECISION-RULE.md` § *Totality* requires and that Phase 23's findings document had to add after the fact.
- **`could-not-run` was structurally unavailable, and the document shows why rather than asserting it.** The `## Totality` partition is reproduced: 108 tuples, `R9` with no antecedent, 84 → `no-go`, 23 → `degrade`, exactly 1 → `go`. That is the defect the Phase 23 predecessor carried and hit, and its removal is what the ROADMAP names as this gate's distinguishing property.
- **The ordering proof was re-run after every measurement landed and still returns `1`.** `git rev-list --count 2a8ef95 -- <evidence>` = `1`, with all three frozen files at exactly one commit each. The frozen files were not modified — not even to clarify the § 2.3 wording this plan adjudicated.
- **The one override available was declined in writing, with its price named.** `33-11` disclosed that `unproven` rests on the strict reading of "exactly one frame apart" and named this plan as the only one that may revisit it. The value stands. See § *Decisions Made*.
- **`R6`'s narrowing was reproduced verbatim, not re-authored**, and bound into each of Phases 34-38's own Notes with what it does **not** narrow stated per phase — including the load-bearing negative for Phase 38: `R5` did **not** fire, so its denominator is not narrowed and `could-not-run` is no longer reportable there.
- **Every accepted limit in the phase reached the verdict.** Ten `## ACCEPTED LIMIT` entries collected across seven evidence files, plus the two ROADMAP-note claims measurement superseded and the four `33-02` reconciliations — so the phase's honest edges are in the durable document rather than in plan SUMMARYs.
- **Three folded todos closed, two of them on partial results stated as such.** The frame-exact todo closes with `AUTOSTART_FRAME_EXACT: not-achieved` and `CAPTURE_FRAME_EXACT: no` named, and says plainly that **a frame-exact post-load stop on an autostarted release is still unowned work**. The headless/warp todo closes with `PROBEREADY_BUDGET: short` and its unowned, milestone-level follow-up.

## Task Commits

1. **Task 1 (tracer): Transcribe the five inputs, walk the rules, record the verdict as frontmatter** — `25f93d5` (docs)
2. **Task 2: Bind the verdict to Phases 34-38 and finalise Phase 33's ROADMAP entry** — `7570095` (docs)
3. **Task 3: Close the three folded todos and point STATE.md at the verdict, in one commit** — `40d725b` (docs, amended to carry the closing notes alongside the moves)

**Tracer feedback gate:** `AUTO_CHAIN` and `AUTO_CFG` both `false`, `HUMAN_VERIFY_MODE` `end-of-phase`, and Task 1's `<verify>` carries only `<automated>` blocks with no `<human-check>`. All three re-ran green after the commit, so per the executor's tracer branch the gate resolved to `⚡ Tracer verified end-to-end — expanding` with no checkpoint synthesized.

## Files Created/Modified

- `docs/phase33-reproducible-run-gate-findings.md` **(created, 944 lines)** — the durable verdict artifact: frontmatter per `SCHEMA.md` § 5's fixed key order, the transcription rule, `## Verdict` with the rule walk and the declined override, the whole rule set reproduced verbatim, the re-run `## Ordering proof`, one section per gate input, one per non-input finding, `## Narrowing`, and `## Accepted limits and corrections`.
- `.planning/ROADMAP.md` — Phase 33's Plans line made real; all five success criteria annotated with outcomes citing their evidence files; the guards note and baselines note given dated superseded riders with originals left readable; `33-12`'s checkbox ticked; a verdict Note added to each of Phases 34-38.
- `.planning/STATE.md` — Current Position now names the verdict value, the fired rule, the findings path, the narrowing, the declined override and the `test:automated` trajectory; three Deferred Items rows removed; stale wave/activity prose repaired.
- `.planning/todos/completed/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md` — moved from `pending/`, closing note citing `src/mcp/vice/vsf-slice.ts`, `SLICER: validated`, and two corrections to the todo's own method (`D-21`, `D-24`).
- `.planning/todos/completed/2026-08-26-frame-exact-emulator-stop-is-unowned.md` — moved, closing note citing `src/mcp/vice/stock-reproducible-run.ts`, `JITTER_IMMUNITY: immune`, `ORACLE_NECESSITY: unproven` **and** `AUTOSTART_FRAME_EXACT: not-achieved`, with what remains open stated.
- `.planning/todos/completed/2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md` — moved, closing note citing `normaliseLaunchProfile()`, `profileEligible()` and `PROBEREADY_BUDGET: short` with its named follow-up.

## Decisions Made

**1. The verdict is `degrade`, fired by `R6`.** Not chosen — derived. `ORACLE_NECESSITY: unproven` is the first input value any rule's antecedent matches under first-match-wins.

**2. The available override was DECLINED, and this is the plan's only real decision.** `33-11` recorded that `SCHEMA.md` § 2.3's "exactly one frame apart" admits a second reading ("an integral number of frames apart") under which its variant control satisfies every conjunct, the value becomes `proven`, and the walk reaches `R9 → go`. Four grounds for leaving the recorded value alone, each traceable to a transcribed line:

- The frozen text states the strict reading and closes with "including when no such pair was produced at all".
- `proven` is the **flattering** value — the difference between `degrade` and a possible `go` — and `33-11` took the unflattering reading deliberately, naming that asymmetry. Adopting the generous reading here would relocate the flattering choice one document downstream, not remove it.
- **The measurement points the same way `R6` does.** On the variant pair the frame term contributed nothing (`(LIN, CYC)` identical on two genuinely different stops) and `hit_count` is what separated them, so a `(PC, hit_count)` oracle would have got the pair right. The evidence file's own words: `R6` "is not a penalty imposed by a missing measurement; it is the correct response to the measurement that was taken."
- The same file's second accepted limit removes the ground an override would stand on: the control proves `(LIN, CYC)` **alone** is insufficient and gives *no* support to a reading in which the frame term is load-bearing on that pair — while `R6`'s narrowing *drops* the frame term. An override to `proven` would assert a necessity the evidence declines to support, to keep a term it showed idle.

Even under the generous reading the antecedent is not literally met: the pair is an *integral*, not a *one*, frame separation, and the smallest reachable equal-raster separation on this build is measured at 2 frames. The price `DECISION-RULE.md` sets for an override — a recorded weakening of the pre-commitment — was therefore not paid.

**3. `R6`'s narrowing is reproduced verbatim from the `D-04` pre-mapping** and labelled as written before the answer was known, rather than re-authored against the evidence. `R6` is one of the two rules that carries a pre-mapping precisely so this step involves no authorship.

**4. The corpus list carries one release.** `danish` with `canonical: true`. `saeger.d64` is on disk but was not exercised in this phase and no outcome line here carries a number for it; recording it with a digest lifted from Phase 23 would have been an unsourced value in the one document required to have none. `SCHEMA.md` § 4 explicitly blesses the degenerate single-element list, and `DECISION-RULE.md` § *Never a gate* states the release count never changes the verdict.

**5. No test guard was added** (`D-06`), and the reason is kept visible in each phase's Note: a guard would encode roadmap policy in a suite belonging to a phase that ships almost no product code, and `degrade` — "proceed, narrowed" — is exactly the case such a guard cannot check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker] Task 3's first `<verify>` command is unsatisfiable without falsifying a milestone-close record**

- **Found during:** Task 3
- **Issue:** The command ends `grep -aq "$t" .planning/STATE.md && { echo "stem still in STATE.md: $t"; exit 1; }` — a **whole-file** scan. All three stems legitimately appear elsewhere in `STATE.md`: at lines 811, 1131 and 144 in Project Reference / Accumulated Context prose describing them, and — the blocking ones — as `.md`-suffixed rows in the **v0.7.0 milestone-close** `deferred_items` table *inside* the `## Deferred Items` section, plus a prose paragraph naming the frame-exact todo as a v0.8.0 planner's pointer. Satisfying the command as written would require deleting v0.7.0 close records that the section explicitly preserves ("kept here as history rather than overwritten").
- **Fix:** Ran the check the acceptance criterion and the guard actually mean — `docs-deferred-ledger.test.ts`'s own predicate, `stemHasOwnTableCell()`, i.e. a **bare-stem table cell** `| <stem> |` scoped to the `## Deferred Items` section. The historical rows carry the `.md` extension and so are not bare-stem cells, which is exactly why the shipped guard tolerates them by design and its own header records the false-positive reasoning ("A guard that demanded the WHOLE file avoid ever mentioning a completed todo's stem would be unsatisfiable and would get switched off"). Result: `SECTION_CLEAN_OK`, plus `FILES_MOVED_OK` and `SAME_COMMIT_OK`, plus `docs-deferred-ledger.test.ts` + `audit-integrity.test.ts` at `tests 50 / fail 0`.
- **Files modified:** none — a verification-method correction, not a content change.
- **Verification:** the guard itself is green in both directions.
- **Committed in:** `40d725b` (behaviour unchanged; recorded here)

**2. [Rule 3 — Blocker] Phase 33's `**Plans**:` line was not `TBD`, and its actual text failed the plan's own verify regex**

- **Found during:** Task 2
- **Issue:** The plan's action text says "Replace the `**Plans**: TBD` line". It was not `TBD` — it read `**Plans**: 11/12 plans executed in 7 waves — …`, written by an earlier plan. That string fails the plan's own `^\*\*Plans\*\*: [0-9]+ plans` verify (`[0-9]+` matches `11`, then ` plans` is needed but `/12 plans` follows), so `CRITERIA_ANNOTATED`/`BINDING_OK` could not pass while it stood.
- **Fix:** Rewrote the head to `**Plans**: 12 plans in 7 waves, all twelve executed and none deliberately withheld — …`, keeping the full per-plan list and the trailing concurrency clause, which is still accurate.
- **Files modified:** `.planning/ROADMAP.md`
- **Verification:** `PLANS_LINE_MATCHES`, then `BINDING_OK` and `CRITERIA_ANNOTATED`.
- **Committed in:** `7570095`

**3. [Rule 1 — Bug] STATE.md's Current Position carried three stale claims the plan did not ask about**

- **Found during:** Task 3
- **Issue:** The plan asked only for a verdict pointer and the suite trajectory. The block also asserted `Status: **Wave 5 complete**`, `**Wave 6 (33-11) is next**, and it is unblocked`, `Plan: 11 of 12 executed … next pointer at plan 12 of 12`, `Phase … — EXECUTING`, and `Last activity: 2026-09-02 — 33-02 executed`. Every one of those is false at this commit and would have shipped as the project's live position.
- **Fix:** Repaired each in place, folding wave 6's real outcome into the retained-history prose rather than deleting it.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `git diff` reviewed line by line — 6 prose lines and 3 table rows deleted, all six prose deletions replaced with corrected text, no standalone token collateral.
- **Committed in:** `40d725b`

**4. [Rule 1 — Bug] Task 3's closing-note appends were left unstaged by `git mv`**

- **Found during:** Task 3, immediately after the first commit
- **Issue:** The notes were appended to the files while still under `pending/`, then `git mv`'d. `git mv` stages the **committed** content's rename, so the first commit carried three 100%-similarity renames and none of the notes — violating the acceptance criterion "Each moved file carries a closing note".
- **Fix:** `git add` the three files and `git commit --amend --no-edit`, keeping the moves, the notes and the three row removals in one commit as the two-directional ledger invariant requires.
- **Files modified:** the three completed todos
- **Verification:** `git show --stat HEAD` lists all five files; both guards re-run green after the amend.
- **Committed in:** `40d725b` (amended)

**5. [Rule 1 — Bug] `roadmap.update-plan-progress` mangled two known shapes, both reproduced and repaired**

- **Found during:** state-update step
- **Issue:** Two independent defects, both known to this project and both hit exactly as recorded. (a) It rewrote the count on the `**Plans**:` line back to `11/12 plans executed in 7 waves` while leaving the trailing clause "all twelve executed and none deliberately withheld" in place — a self-contradictory line, and it also re-broke the verify regex. (b) It stripped the Progress-table row's pipe spacing and dropped its Completed cell: `| … | v0.8.0 | 11/12 | In Progress|  |`.
- **Fix:** Reverted the verb's write, wrote SUMMARY.md so the on-disk summary count is 12, re-ran the verb once so it derives `12/12` / `Complete`, then hand-repaired both shapes.
- **Files modified:** `.planning/ROADMAP.md`
- **Verification:** `git diff` after every verb call; the Plans-line regex and the Progress row's pipe spacing both re-checked afterwards.
- **Committed in:** the plan-metadata commit

---

**Total deviations:** 5 auto-fixed (3 × Rule 1 bugs, 2 × Rule 3 blockers). No Rule 4 architectural decision arose.
**Impact on plan:** None on scope or on the verdict. Deviations 1 and 2 are defects in the plan's own verification text; 3 and 5 are stale-content and tooling repairs the plan's own hazard list predicted; 4 is a staging mistake caught and corrected inside the same commit. **No deviation touched an input value, a rule, or the derivation.**

## Issues Encountered

**The three frozen files were left untouched, including the one whose wording was under adjudication.** `SCHEMA.md` § 2.3's frame-separation wording is the exact ambiguity this plan resolved, and the temptation to "clarify" it there is what `DECISION-RULE.md` § *Status* forbids. The resolution lives in the findings document; all three files remain at exactly one commit (`2a8ef95`).

**The `test:automated` baseline is unchanged and is not this plan's regression.** `tests 3113 / suites 24 / pass 3105 / fail 2`, both failures in `anno-register.test.ts` at `:385` and `:479`, taken with `systemctl --user is-active vice-broker` → `inactive` and `pgrep -x x64sc` → no output. Same 2-in-1 count, same single file, and the test total is unchanged from the phase's earlier measurement — this plan added no tests, correctly, since `D-06` declines a guard. The shared root cause is out of phase and named: `STORE-01`, `STORE-04`, `STORE-06` and `MCP-04` are cited by the anno tool register but no longer declared in `.planning/REQUIREMENTS.md` after the v0.8.0 rewrite dropped the v0.7.0 ids. **No Deferred Items row was filed for it**, deliberately — a row with no matching pending file reds the same ledger guard in the other direction.

**One open item this plan closed a todo *around* rather than *on*.** The frame-exact todo is moved to `completed/` because its filed condition ("nothing owns it") is discharged — the stop is now a named single-seam procedure. But a frame-exact **post-load stop on an autostarted release** is still not achieved, and the closing note says so with `AUTOSTART_FRAME_EXACT: not-achieved` and `CAPTURE_FRAME_EXACT: no` quoted. A phase needing that has unowned work, and the mechanism it must defeat is recorded.

## Verification Results

| Check | Result |
|---|---|
| `VERDICT_SHAPE_OK` — frontmatter carries `verdict` (one of three), a rule id, all five inputs, `Ordering proof` | **PASS** |
| `INPUTS_TRANSCRIBED` — each declared line's final occurrence extracted from its source file and present in the findings document | **PASS** |
| `ORDERING_STILL_HOLDS` — `git rev-list --count 2a8ef95 -- <evidence>` = `1` | **PASS** |
| `could-not-run` absent as any frontmatter field value (appears only in a YAML comment explaining its structural unavailability) | **PASS** |
| `BINDING_OK` — real Plans line; Phases 34-38 each cite the findings document | **PASS** |
| `CRITERIA_ANNOTATED` — Phase 33 section cites `evidence/` 6×; no `Plans**: TBD` survives | **PASS** |
| `docs-dangling-refs.test.ts` + `docs-linerefs.test.ts` | **PASS** — `tests 21 / fail 0` |
| `FILES_MOVED_OK` / `SECTION_CLEAN_OK` / `SAME_COMMIT_OK` | **PASS** |
| `docs-deferred-ledger.test.ts` + `audit-integrity.test.ts` | **PASS** — `tests 50 / fail 0` |
| Deferred Items table row count | **7 data rows**, one per remaining pending todo, both directions green |
| Three frozen files unmodified | **PASS** — `DECISION-RULE.md`, `SCHEMA.md`, `README.md` at 1 commit each, all `2a8ef95` |
| `npm run typecheck` | **PASS** — exit 0, no output |
| `npm run test:automated` (wave gate, broker stopped) | **PASS against baseline** — `tests 3113 / pass 3105 / fail 2`, both in `anno-register.test.ts`; no count increase, no second file |
| `node scripts/check-npm-packages.mjs` | **PASS** — exit 0; 59-module closure clean, `@henols/vice-mcp` 83 files, `@henols/c64-re-tools` 38 files / 7 skills |
| Three known ROADMAP editing hazards | **CHECKED** — no criterion runs into the Plans line; no stale trailing clause; Progress row pipe spacing intact (defect (b) hit by the verb and repaired) |

## Known Stubs

None. This plan ships no code — the deliverables are a findings document and three planning-file edits, and every claim in them is transcribed from a committed evidence file.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema at a trust boundary was created or changed. `T-33-SC` (package-manager installs) remains `accept` — no install task exists in this plan or anywhere in this phase.

The plan's threat register mitigations were each applied: **T-33-39** (every input read from its declared file's final column-0 line, cited by path, with a verify extracting each value from the source and requiring it in the document); **T-33-12** (the ordering assertion re-run *after* the measurements, not only at `33-01`); **T-33-40** (`R7`/`R8`/`R9` recorded as NOT EVALUATED with the reason); **T-33-15** (rows addressed by unique stem, never by a status token; scoped replacements only, never a whole-file write; all three known ROADMAP hazards checked and one repaired); **T-33-41** (moves and row removals in one commit, staged-path asserted, and no new row filed for the out-of-phase residual); **T-33-42** (every criterion annotated with its outcome line's value, and criterion 3 marked **PARTLY MET** against evidence that says so rather than **MET**).

## Next Phase Readiness

**Phase 33 is complete — 12 of 12 plans executed.** The gate has spoken: `degrade`, by `R6`.

Phases 34-38 are unblocked and each carries its own binding Note. What the narrowing costs them, per phase: **34** nothing (gate authority only, reads no Phase 33 deliverable); **35 / 36 / 37** nothing to scope — `R5` did not fire, so the real-image exercise survives — but each capture pair must carry the two-term-oracle weakening in its own record; **38** nothing to its denominator, which is the load-bearing negative, since the branch that would have narrowed it to method-only did not fire.

Three carried items a Phase 34+ planner should read rather than rediscover, all recorded in the findings document: a frame-exact **post-load** stop on an autostarted release is still unowned; `probeReady`'s per-attempt budget is short in every profile and the fix needs a milestone-level owner; and the `test:automated` floor is **2-in-1**, not 0, with a named out-of-phase cause.

## Self-Check: PASSED

All five created/moved files exist on disk. All four commits (`25f93d5`, `7570095`, `40d725b`,
`4af828f`) are reachable. The three frozen files are still at exactly one commit each
(`2a8ef95`), and `git rev-list --count 2a8ef95 -- <evidence>` still returns `1`.
