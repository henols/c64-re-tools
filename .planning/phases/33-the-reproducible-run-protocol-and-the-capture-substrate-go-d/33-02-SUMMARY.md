---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 02
subsystem: planning
tags: [research-reconciliation, vsf, snapshot-layout, deferred-items-ledger, test-baseline, audit-04]

# Dependency graph
requires:
  - phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
    provides: "33-RESEARCH.md's § Decisions This Research Falsifies (both tables), M4/M5 measured evidence, and P3/P6/P7/P8 pitfalls — the measured counter-values this plan transcribes onto the decision record"
provides:
  - "33-CONTEXT.md's D-21 amended: the C64MEM body assertion is `>= 65543` (65543 at snapshot minor 0, 65555 at minor 1), not `4 + 65536` (= 65540) — plus the Phase 23 prototype's stale `first_module_offset = 37` corrected to 58 and its resync fallback replaced by a strict walk"
  - "33-CONTEXT.md's D-24 amended: `$0000` takes `dir_read` and `$0001` takes `data_read`, both from the 3-byte suffix AFTER the RAM array, at `body[RAM_OFFSET + RAM_SIZE + 2]` and `body[RAM_OFFSET + RAM_SIZE + 1]` — never the 4-byte `(pport.data, pport.dir, EXROM, GAME)` prefix"
  - "33-CONTEXT.md's compare.mjs code-insight claim amended: its four volatile RANGES (4866 addresses) and its one-bit-drift-passes rule are named incompatible with CAP-02's enumerated-list requirement and with D-25's planted-byte control; the inheritable subset (reporting vocabulary, `digest` verb, hex4/hex2/bin8/popcount, exact-size load refusal) is named separately"
  - "33-CONTEXT.md's D-15 narrowed (scope correction, not falsification): five stock whole-argv `assert.deepEqual` assertions change, not three, and they change with `profile` absent; byte-identity survives in full only on the fork branch"
  - "A `### Research Reconciliation` index at the end of 33-CONTEXT.md's `<decisions>` block covering all four amendments plus the two ROADMAP-note claims superseded by measurement"
  - "A STATE.md Deferred Items table that matches the pending-todo tree in both directions (10 rows ↔ 10 files), with AUDIT-04's two-directional guard and the audit-integrity cascade green"
  - "The tightened suite baseline every later Phase 33 wave gate compares against: 2 failing tests in anno-register.test.ts alone (was 5 in 3 files), with the residual root cause recorded as out-of-phase"
affects: [33-04, 33-05, 33-06, 33-07, 33-08, 33-09, 33-10, 33-11, 33-12]

# Actuals (#2632) — estimateTokens scale (chars/4) over the realized diff, not a harness token count.
actuals:
  tokens: 3800
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Amend-beside, never amend-over: a falsified decision sentence stays readable and a dated rider carries the measured counter-value immediately after it (T-33-14, asserted mechanically by this plan's second verify)"
    - "Stem-scoped STATE.md editing: address a Deferred Items row by its unique todo stem, never by a bare status token, and pin the deletion count with `git diff --numstat` (T-33-15)"

key-files:
  created: []
  modified:
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-CONTEXT.md
    - .planning/STATE.md

key-decisions:
  - "D-21's exact-length assertion becomes `body.length >= 65543`, recording which snapshot minor produced which length (MIN_C64MEM_BODY_LEN = 65543, V01_C64MEM_BODY_LEN = 65555)"
  - "D-24's normalisation reads the 3-byte suffix after the RAM array, not the 4-byte prefix: a prefix-over-RAM copy writes 231 to $0000 where the CPU sees 47 — wrong by 176, silently, at the two addresses the normalisation exists to fix"
  - "The Phase 23 prototype's byte-by-byte resync fallback is rejected in favour of a strict walk that refuses on the first malformed module header: resync reintroduces D-21's own stated worst failure mode (garbage rather than an error) by the recovery route"
  - "compare.mjs is inherited as a vocabulary, not as a predicate: the four ranges and the drift-passes rule are dropped, because a control that plants a one-bit difference against them PASSES and proves nothing"
  - "D-15 is recorded as a scope narrowing, not a falsification — the research's own second table classifies it that way, and overstating it would falsify a decision that is mostly right"
  - "The four dropped requirement ids (STORE-01, STORE-04, STORE-06, MCP-04) are recorded as out-of-phase with NO Deferred Items row: filing a row without a matching pending file reds the same AUDIT-04 guard this plan repaired, in the other direction"

patterns-established:
  - "Reconciliation index: a `### Research Reconciliation` subsection makes every amendment discoverable without reading every decision, and distinguishes falsifications from scope narrowings so a reader can tell which kind of error was made"
  - "Baseline as a recorded measurement with named root causes, never a moving target: the phase-open 5-in-3 figure and the post-repair 2-in-1 figure are both written down, and the residual cause is named rather than absorbed"

requirements-completed: []  # CAP-01 / CAP-02 are declared by sibling plans still in flight — `requirements.ready-ids` returned 0/2 ready (shared-ID gate, #2388)

coverage:
  - id: D1
    description: "33-CONTEXT.md's D-21, D-24 and its compare.mjs code-insight claim each carry a dated AMENDED 2026-09-02 rider with its measured counter-value, and D-15 carries a fourth rider narrowing its argv byte-identity claim"
    requirement: "CAP-01"
    verification:
      - kind: other
        ref: "grep gate over 33-CONTEXT.md for 65543 / 65555 / dir_read / data_read / 'Research Reconciliation' / 'AMENDED 2026-09-02' / 'five stock whole-argv' + rider count >= 4 + first_module_offset → RECONCILED_OK"
        status: pass
      - kind: other
        ref: "grep gate asserting the superseded sentences survive ('asserts the module body is exactly', '4-byte port/PLA', 'volatile / drift', \"byte-identical to today's\") → ORIGINALS_INTACT"
        status: pass
    human_judgment: false
  - id: D2
    description: "The two stale Deferred Items rows are gone and the ledger matches the pending-todo tree in both directions"
    requirement: "CAP-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-deferred-ledger.test.ts (AUDIT-04 directions A and B, non-vacuity, planted violation, substring-safety)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/audit-integrity.test.ts#no milestone audit declares a gated status while any docs guard is red (D-12-02)"
        status: pass
      - kind: other
        ref: "git diff --numstat -- .planning/STATE.md → exactly 2 deleted lines, both the target rows"
        status: pass
    human_judgment: false
  - id: D3
    description: "The suite baseline is down from 5 failing tests in 3 files to 2 failing tests in anno-register.test.ts alone, with the residual root cause recorded as out-of-phase"
    requirement: "CAP-02"
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && npm run test:automated → EXIT=1, tests 2968, pass 2960, fail 2, both at anno-register.test.ts:385 and :479"
        status: pass
      - kind: other
        ref: "section-scoped ledger reconciliation: 10 pending todo files ↔ 10 Deferred Items data rows, 0 missing, 0 completed stems wrongly celled"
        status: pass
    human_judgment: false

# Metrics
duration: 13 min
completed: 2026-09-02
status: complete
---

# Phase 33 Plan 02: Research Reconciliation and the Ledger Repair Summary

**Four claims in `33-CONTEXT.md` that live measurement against genuine stock VICE 3.9 contradicted now carry dated riders with their counter-values beside the superseded text — and the suite's known-red set is down from 5 tests in 3 files to 2 in one, with the residual cause named as out-of-phase rather than absorbed.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-02T17:41Z
- **Completed:** 2026-09-02T17:57Z
- **Tasks:** 2 of 2
- **Files modified:** 2 (plus the plan-metadata set)

## Accomplishments

- **`D-21`'s arithmetic error is corrected before any code depended on it.** `4 + 65536` is 65540; the measured `C64MEM` body is **65555** at snapshot minor 1 and **65543** at minor 0, so the slicer's assertion becomes `body.length >= 65543` with the producing minor recorded. Left unfixed, the slicer would have refused *every* real snapshot and fired `R1 → no-go` on arithmetic — losing `GATE-01`'s most easily-earned `go` input. The same rider corrects the Phase 23 prototype's stale `first_module_offset = 37` to **58** (a second `"VICE Version\x1a"` magic block plus 4 version bytes and a 4-byte SVN dword follow the 16-byte machine name) and rejects its byte-by-byte resync fallback in favour of a strict walk, because a resync scan can lock onto a false module-name string inside 64 KB of RAM data — reintroducing `D-21`'s own stated worst failure mode by the recovery route rather than by the offset.
- **`D-24`'s port normalisation is corrected at the byte-offset level.** The 4-byte prefix is `(pport.data, pport.dir, EXROM, GAME)` — data first, address-swapped relative to the decision text — and the CPU sees neither: `dir_read` at `$0000` and `data_read` at `$0001`, both in the **3-byte suffix after the RAM array**. MEASURED `prefix=[231,47,0,0]` against `suffix3=[39,55,47]` with the live register read giving `$00=47 $01=55`, so a prefix-over-RAM copy writes **231** where the CPU sees **47** — wrong by 176, silently, at exactly the two addresses the normalisation exists to fix.
- **The `compare.mjs` inheritance claim is narrowed to what is actually inheritable.** Its volatile set is four *ranges* over 4866 addresses and its drift rule passes any single-bit difference anywhere — both forbidden by `CAP-02`, and together they make `D-25`'s planted-byte control vacuous. The rider names what carries forward (reporting vocabulary, `digest` verb, header-states-the-rules convention, `hex4`/`hex2`/`bin8`/`popcount`, exact-size load refusal) and what does not, plus the simplification the snapshot route buys: `$D000-$DFFF` is volatile only on the transcription route, so on the `.vsf` route that 4096-address exclusion disappears and the capture-record template's standing note must be re-grounded, not copied.
- **`D-15` is narrowed rather than falsified, and labelled as such.** Five stock whole-argv `assert.deepEqual` assertions change (lines 1775, 1789, 1907, 1919, 1929), not three, and they change with `profile` **absent**, because `REPRO-01`'s determinism block — not the profile — is what moves them. Byte-identity survives in full only on the fork branch; on stock only the `profile` half survives. What `D-15` gets right is named too: `-default` at index 0, the three ordering assertions, and the additive-and-absent-by-default field.
- **A `### Research Reconciliation` index** makes all four amendments discoverable without reading every decision, distinguishes the three falsifications from the one scope narrowing, and records the two ROADMAP-note claims superseded by measurement (the "avoidable" whole-argv assertions, cross-referenced to Amendment 4 rather than restated; and the "clean floor: 0" claim, which `D-11` also carries a correction beside).
- **The ledger repair moved a real number.** Removing the two stale Deferred Items rows took `docs-deferred-ledger.test.ts` (both directions) and the `audit-integrity.test.ts` cascade from red to green, and `test:automated` from `fail 5` across 3 files to **`fail 2`, both in `anno-register.test.ts`** — measured, broker inactive, `tests 2968 / pass 2960`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Amend the three falsified claims and narrow `D-15`** — `a62b510` (docs)
2. **Task 2: Remove the two stale Deferred Items rows and record the residual failures as out-of-phase** — `aa8d1f4` (fix)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-CONTEXT.md` — +139 lines, **0 deletions**: four `**AMENDED 2026-09-02**` riders (D-15, D-21, D-24, the `compare.mjs` bullet in `## Existing Code Insights`), one `**SUPERSEDED BY MEASUREMENT 2026-09-02**` rider on `D-11`'s "clean floor: 0" parenthesis, and a `### Research Reconciliation` subsection closing the `<decisions>` block.
- `.planning/STATE.md` — the two completed `audit`-category phase-32-review rows removed from `## Deferred Items` (exactly 2 deleted lines), the measured 5-in-3 → 2-in-1 trajectory and the out-of-phase root cause appended to the paragraph immediately above the table, plus the standard position / metric / decision / session updates.

## Decisions Made

All six are in the frontmatter `key-decisions`. The load-bearing one for later plans: the residual two failures are recorded as an **out-of-phase** concern with **no** Deferred Items row. `STORE-01`, `STORE-04`, `STORE-06` and `MCP-04` are cited by the anno tool register but were dropped from `.planning/REQUIREMENTS.md` by the v0.8.0 rewrite; the correct repair may legitimately be a carried-ids section in `REQUIREMENTS.md` rather than a code change, and filing a Deferred Items row for it would red the very AUDIT-04 guard this plan repaired, in the other direction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2's first `<automated>` verify is unsatisfiable as written**

- **Found during:** Task 2
- **Issue:** The command greps the **whole** of `.planning/STATE.md` for `phase-32-review-round-4-nine-open-findings` / `phase-32-review-twenty-five-open-findings` and exits 1 if either appears. Both stems legitimately appear outside the Deferred Items table — as `.md`-suffixed rows in the historical `### Acknowledged at the v0.7.0 close (2026-09-01)` table (`.planning/STATE.md:~1474-1475`) and in that section's prose (`~1488-1489`). The verify can therefore only pass by deleting milestone-close history, which the same task explicitly forbids ("do not touch the ten remaining rows… do not reformat the table") and which no acceptance criterion asks for. The task's own acceptance criterion is correctly scoped ("neither … appears in **that section**"), and `docs-deferred-ledger.test.ts` is narrower still — its `stemHasOwnTableCell()` matches only `| <stem> |` as its own table cell, which the `.md`-suffixed historical rows do not satisfy.
- **Fix:** Ran the section-and-table-cell-scoped equivalent instead, mirroring the guard's own semantics: extract the `## Deferred Items` section with the test's exact regex, then assert (a) all 10 pending todo stems have their own table cell, (b) no completed stem has one, (c) neither target stem has one. All three passed. The `git diff --numstat` half of the original verify was run verbatim and passed (exactly 2 deletions). The real guard — `node --test docs-deferred-ledger.test.ts audit-integrity.test.ts` — was run and reports `fail 0` over 50 tests.
- **Files modified:** none (verification-command scope only)
- **Verification:** `fail 0` on both test files; section-scoped script output `pending files: 10 / missing rows: [] / completed stems wrongly celled: [] / main-table Pending data rows: 10`
- **Committed in:** `aa8d1f4` (the task commit; the deviation is in the verification route, not the content)
- **Also recorded:** `.planning/WINDOWS.md` (`kind: deviation`, phase 33) so it is visible at ship time.

**2. [Rule 2 - Missing critical] `D-11`'s "clean floor: 0" left standing would keep a falsified number authoritative**

- **Found during:** Task 1
- **Issue:** The task's action names the "clean floor is 0" claim only as a line in the `### Research Reconciliation` index, but the acceptance criterion requires that `33-CONTEXT.md` "does not claim a clean floor of 0" — and `D-11` states it directly, in a parenthesis a reader who arrives at that decision alone would act on. Indexing the correction 200 lines away does not stop that reader.
- **Fix:** Appended a `**SUPERSEDED BY MEASUREMENT 2026-09-02**` rider beside `D-11`'s own parenthesis (same append-not-delete discipline as the four amendments, deliberately *not* labelled `AMENDED` so the count of four amendments stays exact), carrying the measured `EXIT=1 / 5 failing tests in 3 files` figure, the post-`33-02` 2-in-1 baseline, and the "do not write clean floor: 0 into an acceptance criterion" instruction. The `### Research Reconciliation` entry cross-references it.
- **Files modified:** `33-CONTEXT.md`
- **Verification:** `grep -ac 'AMENDED 2026-09-02'` still returns exactly **4**; `grep -aq '5 failing tests in 3 files'` passes; both Task 1 verifies still pass.
- **Committed in:** `a62b510`

**3. [Rule 1 - Bug] Three GSD state/roadmap verbs damaged the files they updated**

- **Found during:** post-task state updates
- **Issue:** (a) `state.advance-plan` wrote `Plan: 2 of 12 executed (33-01); next pointer at plan 2 of 12` — self-contradictory, omitting `33-02` from the executed list and leaving the next pointer at 2. (b) `last_activity_desc` stayed pinned to `33-01`, and the `Status:` prose still described only `33-01` as complete. (c) `roadmap.update-plan-progress 33` mangled the table row's pipe spacing (`In Progress|  |`) and could only see 1 summary, since this SUMMARY did not exist yet.
- **Fix:** Hand-repaired all three with targeted replacements: the plan line now reads `2 of 12 executed (33-01, 33-02); next pointer at plan 3 of 12`, the `Status:` prose and `last_activity_desc` record `33-02`'s outcome, and the ROADMAP row was restored to `| … | v0.8.0 | 2/12 | In Progress | - |`. `state.update-progress` reported `Progress field not found in STATE.md` and made no change — a pre-existing condition of this file, left alone (out of scope).
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`
- **Verification:** `git diff` reviewed line-by-line after every verb call; no collateral edits (in particular no `NONE`/`none` token damage, the documented `state.add-blocker` failure mode — that verb was not used).
- **Committed in:** this metadata commit

---

**Total deviations:** 3 auto-fixed (1× Rule 1 bug, 1× Rule 2 missing critical, 1× Rule 3 blocking). None architectural; none required a user decision.
**Impact on plan:** No scope creep. Deviation 1 changed only *how* a criterion was proven, not what was proven — and the stricter guard (the real test file) was run and is green. Deviations 2 and 3 were required to satisfy criteria the plan itself states.

## Verification Results

Plan-level `<verification>`, all five items:

1. **Corrected values greppable** — `65543`, `65555`, `dir_read`, `data_read` and `58` (as `first_module_offset`) all present in `33-CONTEXT.md`; none of them appeared before this plan. → `RECONCILED_OK`
2. **Four riders, four surviving originals** — `grep -ac 'AMENDED 2026-09-02'` = **4**; `asserts the module body is exactly`, `4-byte port/PLA`, `volatile / drift` and `byte-identical to today's` all still present. → `ORIGINALS_INTACT`
3. **`git diff --numstat -- .planning/STATE.md`** → `26  2` — exactly 2 deletions, both the target rows (confirmed by reading the `-` lines).
4. **`node --test docs-deferred-ledger.test.ts audit-integrity.test.ts`** → `tests 50 / pass 50 / fail 0`.
5. **Wave-1 gate, and this plan's own deliverable measurement** — `cd src/mcp/vice && npm run test:automated`, broker inactive: `EXIT=1`, `tests 2968 / pass 2960 / fail 2 / skipped 1 / todo 5`, `duration_ms 62815`. Both failures are in `anno-register.test.ts` (`:385` `DIRECTION 5 (basis integrity)` and `:479` `planted violation (the negative control)`), reporting the four undeclared ids `STORE-01`, `STORE-04`, `STORE-06`, `MCP-04`. Target met: **2 failing tests, one file**. `EXIT=1` is expected and is not the failure signal.

**One honest discrepancy, not adopted as a new baseline.** `33-RESEARCH.md` P8 measured `pass 3019 / fail 5` on the phase-open tree; this run reports `pass 2960 / fail 2` — the *pass* total is 59 lower, not just the 3 failures converted. The plan's prohibition forbids re-deriving the baseline to match the tree, so nothing was adjusted: the recorded phase-open figure stays **5 failing tests in 3 files** and the recorded post-repair figure is **2 in 1**. The pass-total delta is unexplained by this plan's two-line STATE.md edit and is left as an observation for whoever next measures the suite (a plausible cause is subtest counting under the anno-register failures, which abort differently now that the ledger guard passes; it was not investigated, being out of scope).

## Issues Encountered

None beyond the three documented deviations. No architectural decision was needed, no authentication gate was hit, and no package-manager install exists anywhere in this plan (matching `T-33-SC`'s `accept` disposition).

## Threat Model Compliance

- **T-33-14 (tampering, `33-CONTEXT.md` decision text)** — mitigated as specified: 139 insertions, **0 deletions**. Every superseded sentence is still greppable, asserted mechanically by Task 1's second verify.
- **T-33-15 (tampering, `.planning/STATE.md`)** — mitigated as specified: both rows addressed by their unique todo stems via an assertion-guarded script (each target line's prefix asserted before deletion), never by a bare status token. Deletion count pinned at exactly 2 by `git diff --numstat`. No `NONE`/`none` token was touched; `state.add-blocker` was deliberately not used.
- **T-33-16 (repudiation, the recorded suite baseline)** — mitigated as specified: the new expected count and its root cause are written into `STATE.md` (and into this SUMMARY's frontmatter as `coverage` D3), the residual failure is recorded as out-of-phase rather than absorbed, and the pass-total discrepancy above is disclosed rather than smoothed over.

## Known Stubs

None. This plan changed no source code and introduced no placeholder, empty-value or TODO path.

## Evidence Directory Untouched

`git show --stat` for both task commits confirms neither touches `.planning/phases/33-…/evidence/`. `2a8ef95` remains the only commit in history that does, so `33-01`'s pre-commitment ordering proof (`git rev-list --count 2a8ef95 -- <evidence>` = 1) is undisturbed and `33-12` can still rely on it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 1 is complete: `33-01` froze `GATE-01`'s rules, and `33-02` has reconciled every falsified source of truth those rules will be measured against. Specifically ready:

- **`33-04`** can implement `vsf-slice.ts` against an amended `D-21` that agrees with the plan text — `MIN_C64MEM_BODY_LEN = 65543`, `V01_C64MEM_BODY_LEN = 65555`, `FIRST_MODULE_OFFSET = 58`, strict walk, no resync.
- **`33-05`/`33-06`** can change five stock whole-argv assertions without that reading as an unplanned regression: `D-15`, `33-05`'s objective and `33-RESEARCH.md` P7 now all say five.
- **`33-07`/`33-08`** can build the predicate as a replacement in kind, with the `compare.mjs` inheritance boundary written down (vocabulary and helpers yes; ranges and drift-passes no) and `$D000-$DFFF`'s route-specificity recorded.
- **Every later wave gate** has one number to compare against: 2 failing tests in `anno-register.test.ts`. A third failure, or a failure in any other file, is a Phase 33 regression.

**Carried concern (out of phase, no todo filed):** `STORE-01`, `STORE-04`, `STORE-06` and `MCP-04` are cited by the anno tool register but undeclared in `.planning/REQUIREMENTS.md` after the v0.8.0 rewrite. Recorded in `STATE.md`'s Deferred Items preamble; deliberately not filed as a Deferred Items row (that would red AUDIT-04 in the other direction) and deliberately not repaired here (the right fix may be a carried-ids section, not a code change).

---
*Phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d*
*Completed: 2026-09-02*

## Self-Check: PASSED

- `33-02-SUMMARY.md`, `33-CONTEXT.md`, `.planning/STATE.md` — all present on disk (`[ -f ]`).
- Commits `a62b510`, `aa8d1f4`, `a986da0` — all reachable in `git log --oneline --all`.
- Neither task commit touches `.planning/phases/33-…/evidence/` (0 matching paths in `git show --stat`), and `git rev-list --count 2a8ef95 -- <evidence>` is still **1** — `33-01`'s pre-commitment ordering proof is intact.
