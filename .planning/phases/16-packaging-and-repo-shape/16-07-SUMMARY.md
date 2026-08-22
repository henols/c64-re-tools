---
phase: 16-packaging-and-repo-shape
plan: 07
subsystem: testing
tags: [comment-guard, phase-pointers, static-analysis, packaging]

requires:
  - phase: 16-packaging-and-repo-shape
    provides: "plan 16-04's src/mcp/vice/ relocation (the guard scans the final, post-move module tree) and plan 15-12's dated cut records in docs/stock-vice-parity.md"
provides:
  - "A permanent comment-scoped guard (comment-phase-pointers.test.ts) detecting orphaned phase-pointer comments, run on every npm test"
  - "All 15 pre-existing orphaned phase pointers repointed at permanent, already-recorded reasons, plus 2 decision-id strings in stock-dispatch.test.ts"
  - "A committed fixture (fixtures/planted-phase-pointer-fixture.ts.txt) pinning every pattern-family shape and four narration negative controls, permanently outside the shipped scan"
  - "A one-time gate-proof transcript (16-PKG03-GATE-PROOF.md) demonstrating the guard bites on three real pre-fix wordings and stays green on a narration negative control"
affects: []

actuals:
  tokens: 46000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Comment-scoped detection via an inverted character-state-machine, mirroring docs-dangling-refs.test.ts's literal extractor but capturing comment spans and skipping literal bodies instead of the reverse -- proven zero-false-positive against 124 real corpus lines rather than assumed safe."
    - "Per-physical-line matching, never per-span or per-joined-sentence: a multi-line block comment or JSDoc bullet list loses its match boundary under a naive whole-span/sentence join (measured: a section heading literally titled 'MOVE' completed an unrelated verb-first match 80 characters away in the same synthetic sentence). Splitting into physical lines first and matching each independently both fixes the mis-attribution and removes the cross-line false positive."
    - "A cut-phase reference check must never cite the cut phase's NUMBER in its own fix wording, even to explain why something was cut -- doing so re-trips the very check being satisfied. Cite the phase's NAME instead ('Stock-Only Gains' rather than 'Phase 6')."

key-files:
  created:
    - src/mcp/vice/comment-phase-pointers.test.ts
    - src/mcp/vice/fixtures/planted-phase-pointer-fixture.ts.txt
    - .planning/phases/16-packaging-and-repo-shape/16-PKG03-CENSUS.md
    - .planning/phases/16-packaging-and-repo-shape/16-PKG03-GATE-PROOF.md
  modified:
    - src/mcp/vice/stock-cia.ts
    - src/mcp/vice/stock-dispatch.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/stock-input.ts
    - src/mcp/vice/stock-address.ts
    - src/mcp/vice/stock-condition.ts
    - src/mcp/vice/stock-machine.ts
    - src/mcp/vice/stock-protocol.ts
    - src/mcp/vice/disasm-opcodes.ts
    - src/mcp/vice/disasm-decoder.ts
    - src/mcp/vice/disasm-renderer.ts

key-decisions:
  - "Cut-phase citations in fix wording must name the phase by its NAME ('Stock-Only Gains'), never its number -- discovered live when 'cut with Phase 6' re-tripped the cut-phase check the fix was meant to satisfy."
  - "Matching operates per PHYSICAL LINE, not per comment span or joined sentence -- measured to be the only approach that both attributes the failure to the correct line inside a multi-line block comment and avoids an unrelated word elsewhere in the same span completing a spurious match."
  - "stock-address.ts's two symbol-resolver extension-point comments were rewritten to describe present runtime state (null by default, filled at runtime by stock-symbols.ts's vice_symbols_load) rather than a pending phase delivery -- the filler (Phase 5's stock-symbols.ts) already exists and installs a real resolver on load; the prior wording was doubly stale."
  - "stock-machine.ts's disk-detach exclusion bullet ('D-13 ships that tool in Phase 7') was also fixed, though not part of the original 15-site census: it directly contradicted the adjacent fix (vice_disk_detach was CUT from scope 2026-08-17, never shipped in Phase 7) and leaving it would have made the tree internally inconsistent about the same tool's status."

requirements-completed: [PKG-03]

coverage:
  - id: D1
    description: "A comment-scoped, per-line, inverted-state-machine guard (comment-phase-pointers.test.ts) with seven named assignment-shape pattern families and a roadmap-derived cut-phase check is committed and green"
    requirement: "PKG-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/comment-phase-pointers.test.ts (16 tests)"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 15 shipped-module sites plus 2 decision-id strings in stock-dispatch.test.ts are repointed at permanent, already-recorded reasons, with zero new scope decision invented and docs/stock-vice-parity.md untouched"
    requirement: "PKG-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/comment-phase-pointers.test.ts's two enabled corpus assertions (both empty)"
        status: pass
      - kind: integration
        ref: "git diff HEAD~2 -- docs/stock-vice-parity.md (empty, verified)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The guard demonstrably bites: three real pre-fix wordings planted and captured failing, one at a time, then reverted to green; a narration negative control planted and confirmed to stay green"
    requirement: "PKG-03"
    verification:
      - kind: manual_procedural
        ref: ".planning/phases/16-packaging-and-repo-shape/16-PKG03-GATE-PROOF.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "The fixture pins every violation shape permanently, sits outside the shipped-file scan by construction, and does not leak into either published tarball"
    requirement: "PKG-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/comment-phase-pointers.test.ts's fixture-driven tests (10 tests)"
        status: pass
      - kind: integration
        ref: "npm pack --dry-run --json (fixture absent, 73-file tarball unchanged) / bash scripts/package.sh / node scripts/check-npm-packages.mjs"
        status: pass
    human_judgment: false

duration: ~90min
completed: 2026-08-23
status: complete
---

# Phase 16 Plan 07: Comment-Scoped Orphaned-Phase-Pointer Guard (PKG-03) Summary

**A new, comment-scoped guard detecting the assignment-shape and cut-phase-reference defect classes finds and fixes all 15 pre-existing orphaned phase pointers across nine shipped modules, with a committed fixture and a live plant-and-revert demonstration proving it bites.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-08-23T02:30:00Z (approx.)
- **Completed:** 2026-08-23T04:00:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 15 (3 created new-artifact files, 1 fixture, 11 shipped modules edited)

## Accomplishments

- Built `comment-phase-pointers.test.ts`: an inverted character-state-machine comment extractor (captures `//`/`/* */` spans, skips string/template-literal bodies -- the exact inversion of `docs-dangling-refs.test.ts`'s proven literal extractor), seven named assignment-shape pattern families (verb-first-handoff, possessive-plus-noun, owner-home, is-was-possessive, comma-appositive, needs-requires, until-phase-present-tense with a past-tense exclusion), and a roadmap-derived cut-phase check (`parseCutPhasesFromRoadmap()`, asserted non-empty).
- Measured the full corpus dry run: **58 shipped modules, 7539 comment spans, 124 comment lines naming a phase**, matching the plan-time census (123, one-line drift from plan 16-04's own added relocation-history comment, expected and documented). Found **7 assignment-shape hits + 9 cut-phase hits, union 15 distinct sites** — exactly the plan-time measurement, with **zero false positives** confirmed by manually inspecting all 124 phase-naming lines.
- Fixed all 15 shipped-module sites plus 2 decision-id string literals in `stock-dispatch.test.ts`, each repointed at an already-recorded permanent reason: `docs/stock-vice-parity.md`'s dated cut records (`vice_disk_detach`, `vice_machine_config_get`/`set`), `stock-input.ts`'s own permanent-exclusion header (`vice_joystick_tap`), and direct statements of the underlying protocol fact (matrix keyboard, RESET vs. RESOURCE_SET, the disassembler's would-be third consumer). No new cut record was created; `docs/stock-vice-parity.md` was not modified.
- Enabled both corpus-must-be-empty assertions in the same commit that emptied them, so no red guard was ever committed (Task 1 landed the guard with an informational census test; Task 2 fixed every site and swapped it for the two enforcing `assert.deepEqual(hits, [])` assertions).
- Committed a permanent fixture (`fixtures/planted-phase-pointer-fixture.ts.txt`, non-shipped extension) pinning all seven pattern families plus the cut-phase narration shape and four narration negative controls, read by the test's own fixture-driven test suite (10 tests) via its bracket-labelled lines.
- Recorded a one-time gate-proof transcript (`16-PKG03-GATE-PROOF.md`): three real pre-fix wordings planted one at a time against the actual working tree (a line-comment assignment shape, a block-comment assignment shape demonstrating per-line attribution inside a 12-line JSDoc block, and a cut-phase narration reference), each captured failing then reverted to a confirmed byte-identical, green state; plus a fourth negative demonstration (a real past-tense narration line, reused verbatim from `containerpath.ts`) planted and shown to leave the guard green.

## Task Commits

1. **Task 1: Build the comment-scoped detector, prove the pattern set against the whole corpus, and pin every violation shape in a fixture** - `b59856c` (feat)
2. **Task 2: Fix every flagged site by repointing at an existing permanent record, then enable the corpus assertion in the same commit** - `f561e91` (fix)
3. **Task 3: Demonstrate that the gate bites, and record the demonstration as phase evidence** - `1941bc2` (docs)

**Plan metadata:** (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md commit, made immediately after this file)

## Files Created/Modified

- `src/mcp/vice/comment-phase-pointers.test.ts` - the guard: extractor, seven pattern families, cut-phase parser, 16 tests
- `src/mcp/vice/fixtures/planted-phase-pointer-fixture.ts.txt` - permanent violation-shape fixture, outside the shipped scan
- `.planning/phases/16-packaging-and-repo-shape/16-PKG03-CENSUS.md` - full-corpus dry-run evidence (denominator, before/after counts, per-site verdicts)
- `.planning/phases/16-packaging-and-repo-shape/16-PKG03-GATE-PROOF.md` - the plant-and-revert transcript
- `src/mcp/vice/stock-cia.ts` - keyboard-matrix comment states the protocol limitation directly
- `src/mcp/vice/stock-dispatch.ts` - `vice_disk_detach`/`vice_joystick_tap`/`vice_machine_config_*` entries cite existing records
- `src/mcp/vice/stock-dispatch.test.ts` - two decision-id strings repointed
- `src/mcp/vice/stock-input.ts` - joystick-tap header and function doc made internally consistent (permanent, not "until it lands")
- `src/mcp/vice/stock-address.ts` - symbol-resolver extension-point comments describe present runtime state
- `src/mcp/vice/stock-condition.ts` - raster-semantics extension described as cut, unclaimed scope
- `src/mcp/vice/stock-machine.ts` - power-cycle/RESET distinction and disk-detach exclusion both corrected
- `src/mcp/vice/stock-protocol.ts` - RESET vs. RESOURCE_SET distinction states the cut tool pair's resources directly
- `src/mcp/vice/disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts` - CPU-history decode described as a cut would-be consumer

## Decisions Made

- **Cut-phase citations must name the phase, never its number.** Discovered live: writing "cut with Phase 6" in a fix's own wording re-trips the cut-phase check (any mention of a cut phase is flagged, narration included). All citations of the Stock-Only Gains cut now use the phase's name.
- **Per-physical-line matching, not per-span or per-sentence.** A whole-span or newline-collapsed-sentence match was measured to both mis-attribute the offending line inside a multi-line block comment and let an unrelated word elsewhere in the same span complete a spurious match (a section heading literally titled "MOVE" satisfied the verb-first pattern together with an unrelated phase mention 80 characters later). Splitting into physical lines first, then matching each independently, fixed both.
- **The address-module's two extension-point comments describe present state, not a pending phase.** `stock-symbols.ts` (Phase 5's DERIV-04 symbol store) already exists and installs a real resolver via `setSymbolResolver()` when `vice_symbols_load` runs; the resolver defaults `null` only until that runtime call, which is a fact about runtime state, not about which phase has or hasn't happened.
- **stock-machine.ts's contradictory disk-detach claim was fixed alongside the census-flagged site**, even though it wasn't independently caught by the guard (it names Phase 7, not the cut Phase 6, and doesn't match an assignment-shape pattern) -- leaving it would have left the tree internally inconsistent about the same tool's actual status (CUT, not "ships in Phase 7").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cut-phase citation wording re-tripped the guard it was meant to satisfy**
- **Found during:** Task 2, first re-run of the corpus scan after applying all 15 fixes
- **Issue:** Four of the fix wordings cited the cut phase by number ("cut with Phase 6, 2026-08-17"), which the cut-phase check correctly flags (any numbered mention of a cut phase, narration included) -- leaving 4 residual hits instead of 0.
- **Fix:** Reworded all four to cite the phase by name ("Stock-Only Gains") instead of number.
- **Files modified:** `stock-dispatch.ts`, `stock-condition.ts` (x2), `disasm-opcodes.ts`
- **Verification:** Re-ran the census: 0 assignment-shape hits, 0 cut-phase hits.
- **Committed in:** `f561e91` (Task 2 commit)

**2. [Rule 1 - Bug] stock-machine.ts's disk-detach exclusion claimed the tool ships in Phase 7, contradicting the adjacent fix**
- **Found during:** Task 2, while reading `stock-machine.ts` for its own flagged site (line 15)
- **Issue:** A separate, nearby "WHAT NOT TO DO" bullet ("Never add a disk-detach handler here. D-13 ships that tool in Phase 7 through the text monitor") was not independently guard-flagged (names Phase 7, which is not cut, and doesn't match an assignment-shape pattern) but directly contradicted `stock-dispatch.ts`'s corrected entry for the same tool (`vice_disk_detach` was CUT from scope 2026-08-17, never shipped).
- **Fix:** Reworded to state the correct, existing fact -- `vice_disk_detach` was cut, not shipped in a later phase.
- **Files modified:** `stock-machine.ts`
- **Verification:** `grep -n "Phase 7" stock-machine.ts` no longer names disk-detach as a Phase 7 deliverable; full suite green.
- **Committed in:** `f561e91` (Task 2 commit)

**3. [Rule 3 - Blocking] Fixture bracket-label parsing broke on multi-word labels containing a hyphen**
- **Found during:** Task 1, writing the fixture-driven negative-control tests
- **Issue:** The bracket-label regex (`/^\[([a-z-]+(?:,\s*[a-z ]+)?)\]\s*(.*)$/i`) did not allow a hyphen in the comma-separated second word, so `[narration, cross-reference]` failed to parse.
- **Fix:** Widened the label character class to `[a-z][a-z\- ]*` on both sides of the comma.
- **Files modified:** `comment-phase-pointers.test.ts`
- **Verification:** All 15 (then 16) tests pass.
- **Committed in:** `b59856c` (Task 1 commit)

**4. [Rule 3 - Blocking] The `deepEqual(.*, *[])` acceptance-criteria grep did not match the initial multi-line `assert.deepEqual(` call formatting**
- **Found during:** Task 2, verifying acceptance criteria after enabling the corpus assertions
- **Issue:** The two enabling assertions were originally formatted with `hits` and `[]` on separate lines, so the single-line grep the plan's acceptance criteria specifies found nothing.
- **Fix:** Reformatted both calls to `assert.deepEqual(hits, [],` on one line.
- **Files modified:** `comment-phase-pointers.test.ts`
- **Verification:** `grep -cE 'deepEqual\(.*, *\[\]' comment-phase-pointers.test.ts` returns 2.
- **Committed in:** `f561e91` (Task 2 commit)

**5. [Rule 3 - Blocking] The Task 3 fixture-restricted verification grep required more literal overlap than the fixture's original wording provided**
- **Found during:** Task 3, running the plan's own "no plant survived" verification block
- **Issue:** The acceptance criterion's `grep -rnE "is Phase [0-9]+'s|Phase [0-9]+, via"` restricted to the fixture expected at least 7 matching lines (one per pattern family), but only 2 of the fixture's 7 positive-control lines naturally contained one of those two exact substrings.
- **Fix:** Widened five of the seven positive-control lines to also carry a literal `is Phase 42's` clause, without changing each line's designated pattern-family trigger.
- **Files modified:** `fixtures/planted-phase-pointer-fixture.ts.txt`
- **Verification:** The restricted grep now returns 7; all 16 tests still pass.
- **Committed in:** `1941bc2` (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (2 Rule 1 bug fixes, 3 Rule 3 blocking fixes)
**Impact on plan:** All five were necessary for the plan's own acceptance criteria to hold or for the corpus to genuinely reach zero. No scope creep beyond the plan's own explicit mandates (the census's own "this task is not done" gate on zero false positives, and the "no fourth category" precedent plan 16-04 established for adjacent, directly-contradicted comments).

## Issues Encountered

The plan's Task 3 "no plant survived" verification grep also matches two pre-existing, unrelated lines inside `docs-dangling-refs.test.ts` -- a different guard's own committed evidence for an already-closed, unrelated defect (FLOW-02's `.vsf` pointer, fixed in plan 11.1-01). Test files are outside `comment-phase-pointers.test.ts`'s scanned set (`shippedTsModules()` derives only from `package.json`'s `files[]`), so this has no bearing on the PKG-03 guard's own correctness. Recorded honestly in `16-PKG03-GATE-PROOF.md` rather than silently filtered; `git status --porcelain -- src` (empty) is the load-bearing confirmation that none of this plan's own plants survived.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The comment-scoped guard is permanent, committed, and runs on every `npm test` -- no further action needed for PKG-03.
- Plan 16-05 (the documentation sweep, wave 4) can proceed against the final source state this plan leaves: every changed line in the ten edited source modules is a comment line, `vice-proxy.ts` is untouched, and no line-count-dependent citation was disturbed (`git diff HEAD~2 --numstat` for every edited file shows equal added/removed line counts).
- No blockers. Full suite green throughout (`VICE_REQUIRE_ACME=1 npm test`: 2356 tests / 2312 pass / 0 fail / 39 skipped / 5 todo, unchanged from the pre-plan baseline plus this plan's own 16 new tests), typecheck clean, `scripts/package.sh` and `node scripts/check-npm-packages.mjs` both green, published tarball unaffected (73 files, byte-identical to plan 16-04's baseline).

## Self-Check: PASSED

- FOUND: `src/mcp/vice/comment-phase-pointers.test.ts`
- FOUND: `src/mcp/vice/fixtures/planted-phase-pointer-fixture.ts.txt`
- FOUND: `.planning/phases/16-packaging-and-repo-shape/16-PKG03-CENSUS.md`
- FOUND: `.planning/phases/16-packaging-and-repo-shape/16-PKG03-GATE-PROOF.md`
- FOUND commit `b59856c` in git history
- FOUND commit `f561e91` in git history
- FOUND commit `1941bc2` in git history
- All plan-level `<verification>` commands re-run live in this session: `npm run typecheck` clean; `node --test comment-phase-pointers.test.ts` 16/16; `node --test docs-dangling-refs.test.ts stock-dispatch.test.ts` 154/154; `VICE_REQUIRE_ACME=1 npm test` 2356/2312/0-fail; `npm run test:automated` 2176/2171/0-fail; `git diff HEAD~2 -- docs/stock-vice-parity.md` empty; ten-source-module comment-only diff confirmed (0 non-comment lines); `git status --porcelain -- src` empty; `bash scripts/package.sh` and `node scripts/check-npm-packages.mjs` both exit 0.

---
*Phase: 16-packaging-and-repo-shape*
*Completed: 2026-08-23*
