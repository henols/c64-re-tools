---
phase: 36-the-sleigh-language-and-the-ghidra-harness
plan: 05
subsystem: reverse-engineering-harness
tags: [ghidra, volatile-memory, decompiler, dead-store-elimination, live-tests]

# Dependency graph
requires:
  - phase: 36-the-sleigh-language-and-the-ghidra-harness
    provides: "plan 36-03's VolatileCarve.java/GhidraStructExport.java and the bank fixture pair, plan 36-04's ghidra-live.test.ts (the shared scratch-workspace helpers, the flat-64K generator, SKIP_REASON) which this plan extends with six new live cases"
provides:
  - "GHID-02 and GHID-03 proven live against a real Ghidra 12.1.3 installation: the volatile carve proven by DISAPPEARANCE (not presence) on both import routes, and a memory conflict during the carve proven loud (a genuine thrown MemoryConflictException) rather than a silent fall-back to non-volatile"
  - "A new, additive `## DECOMPILED_TEXT` section in the committed GhidraStructExport.java -- the actual site where the volatile flag's effect is observable; MEASURED this plan that `## REFERENCES` is NOT (byte-identical with and without the flag)"
  - "A corrected fixtures/ghidra/README.md: the .prg route's real entry point is $0812, not $0810 -- BinaryLoader does not strip the .prg file's own two-byte load-address header"
  - "evidence/36-05-volatile-disappearance.md: the full with-flag / without-flag / forced-conflict record, both routes, including the MEASURED premise correction"
affects: [36-06-opcode-sweep, 36-07-decompinterface-live-proofs]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 15654
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A committed Ghidra post-script's export format is extended ADDITIVELY (a new trailing `## ` section) rather than in place, so prior plans' already-landed live tests parsing the same export format (36-04's GATE 1/2/3) keep passing unmodified -- verified by re-running them at every commit boundary in this plan."
    - "D-36-13's scratch-copy discipline generalised into a reusable test helper (`makeEditedVolatileCarveScriptDir()`): read the committed source, assert each intended string replacement occurs EXACTLY ONCE before substituting, write the result into a throwaway script directory, copy the unedited sibling script alongside it. A drift in the committed script that removes the expected text now fails loudly at the assertion, not silently by producing an unedited copy."

key-files:
  created:
    - .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-05-volatile-disappearance.md
  modified:
    - src/mcp/vice/ghidra-live.test.ts
    - src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java
    - src/mcp/vice/fixtures/ghidra/README.md

key-decisions:
  - "[Rule 1 - plan premise corrected by measurement] GhidraStructExport.java's `## REFERENCES` section does NOT reflect the volatile flag at all -- MEASURED, byte-identical reference sections with and without volatility, on both routes. References are populated from the reference manager at DISASSEMBLY time; dead-store elimination is a DECOMPILER-layer, per-function, p-code transformation that never touches the listing's own reference database. The plan's own action text assumed the disappearance would be visible in `## REFERENCES`; it is not, and this is disclosed prominently in the evidence file rather than worked around silently."
  - "[Rule 2 - missing critical functionality] Added a new, additive `## DECOMPILED_TEXT` section to the committed GhidraStructExport.java (from plan 36-03), printing each function's full decompiled C body -- the actual, real site where the carve's effect is observable, matching `.planning/notes/ghidra-volatile-io-and-banking.md`'s own original demonstration exactly (three of four `$01` writes and one of two `$d020` writes vanish, with the read, when non-volatile). Without this section the plan's own criterion could not be proven true or false at all by this script pair. The addition is purely additive (a new trailing section); re-ran 36-04's GATE 1/2/3 live tests at every commit boundary in this plan and all continued to pass unmodified."
  - "[Rule 1 - bug in prior evidence] Corrected fixtures/ghidra/README.md's own 'MEASURED reference-dump lines' table: the .prg route's real entry point for bank.prg is $0812, not $0810. MEASURED this session: ghidra.analyze's 'prg' route loads the file through BinaryLoader with no awareness of the .prg format's own two-byte load-address header -- those two bytes are loaded as ordinary content at the base address, shifting every address two bytes later than bank.a's own source labels. An entry point of $0810 on that route disassembles a padding zero byte (BRK) and stops immediately -- the original symptom that surfaced this correction. The flat-64K route was already correct (its own generator strips the header)."
  - "Task 3's forced-conflict edit is larger than the plan's own literal wording ('remove the pre-carve split') -- MEASURED that removing only the split is insufficient to force a genuine thrown conflict on the route where a loader-owned block already covers the target range (flat64k): `mem.getBlock()` never returns null there (a single block spans the whole image), so the existing-block branch is always taken regardless of whether the split ran. Forcing the create branch, and therefore the conflict, required collapsing makeVolatile() to always attempt createUninitializedBlock() -- confirmed by direct measurement before being written into the test, with the harmless alternative (removing only the split) also measured and shown to produce the pre-existing VOLATILE-WARN case, not a conflict."
  - "Task 3's companion assertion is necessarily on the flat64k route, not the .prg route: bank.prg (60 bytes) is too small to produce a block that starts before $d000 and extends past it, which is the only shape that lets a real split matter. The .prg route's own I/O-page target has nothing covering it at all under this fixture's default base address, so the split is a no-op there either way -- confirmed by direct measurement, not assumed."

patterns-established:
  - "A per-route entry-point constant, derived from a MEASURED loader characteristic rather than assumed identical across routes -- PRG_ROUTE_ENTRYPOINT ($0812) and FLAT64K_ROUTE_ENTRYPOINT ($0810) differ by exactly the .prg header's own two bytes, and this difference is documented at the constant's own definition site rather than left to be rediscovered."

requirements-completed: [GHID-02, GHID-03]  # Neither is declared by any sibling plan in this phase (36-03-SUMMARY: "36-05 for GHID-02/GHID-03") -- requirements.ready-ids reports both ready. See "Traceability note" in Deviations below for a disclosed nuance on GHID-03's exact scope.

coverage:
  - id: D1
    description: "The volatile carve's with-flag reference section is established on both import routes -- the fixture's hardware accesses present as typed reference lines, and the pre-script's own carve branch (existing-block-and-split on flat64k, create on prg) observed from its printed output, not assumed"
    requirement: GHID-02
    verification:
      - kind: integration
        ref: "shell verification: GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 node --test ghidra-live.test.ts -- both VOLATILE with-flag cases pass live"
        status: pass
      - kind: manual_procedural
        ref: "evidence/36-05-volatile-disappearance.md, Part 1 (both routes)"
        status: pass
    human_judgment: true
    rationale: "This is a live integration proof against a real, non-committed Ghidra installation, captured as a transcript rather than an automated assertion CI can re-run unattended -- a human should confirm the transcript's own quoted block dumps and decompiled text are genuine."
  - id: D2
    description: "With the volatile flag removed (in a scratch copy, never the committed script), the fixture's hardware writes VANISH from the decompiled C text -- the actual site of the effect, since `## REFERENCES` is MEASURED to never reflect volatility at all -- on both routes, asserted per statement, with the run otherwise completing normally (no thrown-script signal, a non-trivial reference count, its own completed-assertion section present)"
    requirement: GHID-02
    verification:
      - kind: integration
        ref: "shell verification: GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 node --test ghidra-live.test.ts -- both VOLATILE without-flag cases pass live"
        status: pass
      - kind: manual_procedural
        ref: "evidence/36-05-volatile-disappearance.md, Part 2 (both routes, vanished/survived statements listed individually)"
        status: pass
    human_judgment: true
    rationale: "Same as D1 -- a live proof against a real installation, recorded as a transcript for human confirmation of the quoted decompiled C text before and after the edit."
  - id: D3
    description: "A memory conflict during the carve (forced via a scratch-copy edit, on the route where a loader-owned block already covers the target range) is observed as a genuine thrown MemoryConflictException with the exact literal run-log signal, on a run whose exit status is 0; a companion run with the committed, unedited script on the same route confirms the correct path -- the flag lands on the EXISTING block after a real split, with no wider-than-requested warning"
    requirement: GHID-03
    verification:
      - kind: integration
        ref: "shell verification: GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 node --test ghidra-live.test.ts -- both forced-conflict cases pass live"
        status: pass
      - kind: manual_procedural
        ref: "evidence/36-05-volatile-disappearance.md, Part 3 (forced-conflict edit quoted, thrown-script line, companion block dump)"
        status: pass
    human_judgment: true
    rationale: "Same as D1/D2, plus a disclosed MEASURED surprise (the post-script still ran to completion after the pre-script threw) that a human should weigh: the export's own completion is shown to prove nothing about whether the carve succeeded."

# Metrics
duration: 48min
completed: 2026-09-04
status: complete
---

# Phase 36 Plan 05: The SLEIGH Language and the Ghidra Harness -- Volatile Carve Proven by Disappearance Summary

**The volatile-I/O carve proven by disappearance (not presence) on both import routes, via a new additive `## DECOMPILED_TEXT` export section added after live measurement showed the existing `## REFERENCES` section never reflects the flag at all -- plus a genuine, forced `MemoryConflictException` proving a conflict during the carve is loud rather than a silent fall-back.**

## Performance

- **Duration:** 48 min
- **Started:** 2026-09-04T17:56:00Z (approx.)
- **Completed:** 2026-09-04T18:43:46Z
- **Tasks:** 3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Ran the committed `VolatileCarve.java` (preScript) and `GhidraStructExport.java` (postScript) together, for the first time in this phase, on both import routes over the `bank.prg` fixture -- establishing the with-flag baseline the disappearance is measured against. Asserted the pre-script's own carve branch from its printed block dumps: on the `.prg` route the processor port's `ZERO_PAGE` block splits and flags existing, while nothing covers the I/O page so the create branch fires (`VOLATILE-NEW`); on the flat64k route the loader owns one block spanning the whole image, so all three splits succeed and BOTH ranges flag an EXISTING (post-split) block -- D-36-14's own route dependence, observed rather than assumed.
- **MEASURED, and corrected the plan's own premise on it:** `GhidraStructExport.java`'s `## REFERENCES` section is populated from the reference manager at disassembly time and is completely UNCHANGED by the volatile flag -- diffed byte-identical, both routes, with and without the flag. The real, historical dead-store-elimination phenomenon (`.planning/notes/ghidra-volatile-io-and-banking.md`) is visible only in DECOMPILED C TEXT. Added a new, purely additive `## DECOMPILED_TEXT` section to the committed `GhidraStructExport.java`, printing each function's full decompiled body (already computed internally for the structural-fact regexes, never previously printed) -- verified additive and safe by re-running plan 36-04's own GATE 1/2/3 live tests at every commit boundary in this plan.
- Proved the disappearance for real: a scratch copy of `VolatileCarve.java` with both flag-setting calls neutralised (`blk.setVolatile(false)` / `nb.setVolatile(false)`) reproduces, byte-for-byte, the historical finding -- three of the four `$01` writes, one of the two `$d020` writes, and the read vanish from the decompiled function on BOTH routes, while the run otherwise reports complete success (exit 0, no thrown-script signal, a non-trivial reference count, the export's own completed-assertion section present). Asserted per statement, not merely a lower total count.
- Proved a forced conflict is loud: MEASURED that removing only the pre-carve split is insufficient to force a real conflict on the route where a loader-owned block already covers the target range (flat64k) -- `getBlock()` never returns null there, so the existing-block branch is always taken. The working edit collapses `makeVolatile()` to always attempt `createUninitializedBlock()`, which throws a genuine `ghidra.program.model.mem.MemoryConflictException: Part of range (0000, 0001) already exists in memory.` -- the exact literal thrown-script signal appears in the run log, and `analyzeHeadless`'s own exit status is recorded as 0.
- **A disclosed, MEASURED surprise:** `analyzeHeadless` still ran the post-script for the same program after the pre-script threw, and that post-script's own export completed normally (zero functions found, since no entry points were ever seeded -- the pre-script's own `run()` aborted before reaching `readEntryPoints()`). The export's own "it completed" signal proves nothing about whether the carve succeeded; only the run log's exact thrown-script literal is reliable. Recorded prominently rather than hidden, since it strengthens the exact threat this task exists to guard against.
- A companion case on the same route with the committed, unedited script confirms the correct path: the flag lands on the EXISTING block after a real split, and the wider-than-requested warning line is ABSENT anywhere in the log -- the paired positive control against the just-proven negative.
- Corrected `fixtures/ghidra/README.md`'s own reference-dump table: MEASURED this session that the `.prg` route's real entry point for `bank.prg` is `$0812`, not `$0810` -- `BinaryLoader` does not strip the `.prg` format's own two-byte load-address header, so every address is shifted two bytes later than the source's own labels on that route. An entry point of `$0810` on that route disassembles a padding zero byte (`BRK`) and stops immediately, which is exactly how this was discovered.
- All 13 live cases in `ghidra-live.test.ts` (7 pre-existing + 6 new) pass with the opt-in against the real installation, and all 13 skip with the named reason without it. `npm run test:automated` unchanged at the recorded baseline (3409 tests, 3396 pass, 2 fail in `anno-register.test.ts`, 6 skipped).

## Task Commits

Each task was committed atomically:

1. **Task 1: The with-flag reference section, on both routes** - `45d744ff` (feat) -- includes the `## DECOMPILED_TEXT` addition to `GhidraStructExport.java` and the `fixtures/ghidra/README.md` correction, both necessary for this task's own verification
2. **Task 2: Remove the flag and observe the writes vanish** - `9574fe35` (test)
3. **Task 3: A memory conflict is loud, not a silent fall-back** - `ba9d873a` (test)

**Plan metadata:** committed separately (this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md).

## Files Created/Modified

- `src/mcp/vice/ghidra-live.test.ts` - six new live cases: with-flag (prg, flat64k), without-flag (prg, flat64k), forced-conflict and its companion (both flat64k); plus the scratch-copy-edit helper, the per-route entry-point/reference-line/decompiled-statement constants, and a section-extraction helper
- `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java` - new additive `## DECOMPILED_TEXT` section (one function's full decompiled C body per entry), populated inside the existing `DecompInterface` loop with no new decompile pass
- `src/mcp/vice/fixtures/ghidra/README.md` - corrected `.prg`-route reference-dump addresses ($0812 entry, not $0810), with the root cause recorded; flat64k-route table unchanged (already correct)
- `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-05-volatile-disappearance.md` - the full recorded transcript: the premise correction, Parts 1-3, both routes, closing note

## Decisions Made

See `key-decisions` in the frontmatter above. The most consequential: the plan's own premise (disappearance visible in `## REFERENCES`) was measured false and corrected via an additive script change, rather than forced to pass by asserting something untrue.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - plan premise corrected by measurement] `## REFERENCES` never reflects the volatile flag**
- **Found during:** Task 1's own with-flag verification
- **Issue:** The plan's action text assumed hardware-access disappearance would be observable in `GhidraStructExport.java`'s `## REFERENCES` section. MEASURED: it is not -- references are populated at disassembly time and are unaffected by later volatility.
- **Fix:** Documented the finding prominently in the evidence file's own opening section; sourced the actual disappearance assertion from decompiled C text instead (see deviation 2).
- **Files modified:** none (a finding, not a code change on its own)
- **Verification:** Diffed `## REFERENCES` byte-for-byte between with-flag and without-flag exports, both routes -- identical every time.
- **Committed in:** `45d744ff` (documented in evidence Part 1's opening section)

**2. [Rule 2 - missing critical functionality] Added `## DECOMPILED_TEXT` to `GhidraStructExport.java`**
- **Found during:** Task 1, immediately after deviation 1's discovery
- **Issue:** Without a printed decompiled-text output, this plan's own criterion (the carve proven by disappearance) could not be proven true or false by the committed script pair at all.
- **Fix:** Added a new, purely additive trailing section printing each function's full decompiled C body, reusing the already-computed `cText` variable inside the existing `DecompInterface` loop -- no new decompile pass, no change to any existing section's content or order.
- **Files modified:** `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java`
- **Verification:** `javac` clean against the real Ghidra 12.1.3 jars; re-ran plan 36-04's own GATE 1/2/3 live tests at every commit boundary in this plan -- all continued to pass unmodified, confirming the addition did not disturb the pre-existing export format any consumer already parses.
- **Committed in:** `45d744ff` (Task 1 commit)

**3. [Rule 1 - bug in prior evidence] Corrected `fixtures/ghidra/README.md`'s `.prg`-route addresses**
- **Found during:** Task 1's own entry-point selection (a `$0810` entry point on the `.prg` route disassembled a single `BRK` and stopped)
- **Issue:** The table (written by plan 36-03) was hand-traced assuming the `.prg` file's own two-byte load-address header would be stripped before loading, matching real C64 loader convention. `ghidra.analyze`'s `"prg"` route does not do this.
- **Fix:** Corrected the table to record both routes' own reference-dump lines separately, with the root cause and the original symptom recorded.
- **Files modified:** `src/mcp/vice/fixtures/ghidra/README.md`
- **Verification:** Re-ran with entry point `$0812` on the `.prg` route -- produces exactly the seven expected reference lines, shifted +2 from the flat64k route's own (already-correct) values.
- **Committed in:** `45d744ff` (Task 1 commit)

**4. [Rule 1 - bug, measurement-driven] Task 3's forced-conflict edit is larger than the plan's literal wording**
- **Found during:** Task 3's own scratch-copy construction
- **Issue:** The plan's action text says "remove the pre-carve split" as the forcing edit. MEASURED: on the route where a loader-owned block already covers the target range (flat64k), removing only the split reproduces the pre-existing, harmless `VOLATILE-WARN` case, not a conflict -- `getBlock()` never returns null there regardless of whether the split ran.
- **Fix:** The scratch edit also collapses `makeVolatile()` to always attempt `createUninitializedBlock()` (never checking `getBlock()` first), which does throw a genuine `MemoryConflictException` at the processor port -- matching `.planning/research/PITFALLS.md` Pitfall 13's own described scenario exactly.
- **Files modified:** none in the committed tree (the edit lives only in a scratch copy, per D-36-13)
- **Verification:** Both the "split-only-removed" and the final edit were run live and compared; only the final edit produces a thrown script.
- **Committed in:** `ba9d873a` (Task 3 commit; quoted in evidence Part 3)

---

**Total deviations:** 4 auto-fixed (1 plan-premise correction, 1 missing-critical addition, 2 bugs found via live measurement). **Impact on plan:** All four were necessary for this plan's own stated criterion to be provable and true; the additive export change was verified not to disturb any existing consumer. No scope creep beyond what the criterion required.

## Traceability note (disclosed, not silently resolved)

`REQUIREMENTS.md`'s own `GHID-03` text (AMENDED) reads "the control is observed red on **both** import routes, not one." This plan's own `36-05-PLAN.md`, however, scopes Task 3's forced-conflict case to "the route where the loader owns that block" (singular) -- and MEASURED this plan (see deviation 4's own note, and the plan's own `flagged_assumptions`), `bank.prg` is too small to produce a loader-owned block that overlaps the I/O page under the `.prg` route's own default base address, so the `.prg` route has no naturally-reachable loader-owned-block conflict to force with this fixture. This plan executed the task exactly as `36-05-PLAN.md` scoped it (one route, flat64k, matching D-36-14's own finding that flat64k is where the loader-owned-block case is reachable) and marks `GHID-03` complete on that basis, per the plan's own declared `requirements` field and `requirements.ready-ids` reporting both ids ready. The apparent gap between `REQUIREMENTS.md`'s literal "both routes" wording and the plan's actual one-route scope is recorded here rather than silently reconciled either way -- a future reader auditing `GHID-03` should read this note, not assume the `.prg` route's own conflict was also forced and observed.

## Known Stubs

None.

## Issues Encountered

None beyond the four auto-fixed deviations above, all resolved during execution.

## User Setup Required

None - no external service configuration required. `GHIDRA_HOME` remains the existing, already-documented host prerequisite.

## Next Phase Readiness

- `GHID-02` and `GHID-03` are both `requirements-completed` here -- neither is declared by any sibling plan in this phase, so both mark complete immediately (no shared-ID gate wait).
- The `## DECOMPILED_TEXT` section is now available to plan 36-07's own `DecompInterface` live proofs, which can reuse it directly rather than re-deriving a way to observe decompiled output.
- The traceability note above (`GHID-03`'s "both routes" wording vs. this plan's one-route scope) should be read by whoever next audits this requirement or plans a follow-up; it is not a blocker for this phase's own success criteria, which this plan's own text defines.
- No blockers.

---
*Phase: 36-the-sleigh-language-and-the-ghidra-harness*
*Completed: 2026-09-04*

## Self-Check: PASSED

- The declared created file (`evidence/36-05-volatile-disappearance.md`) verified present on disk with `[ -f ]`.
- All 3 task commits (`45d744ff`, `9574fe35`, `ba9d873a`) verified present in `git log --oneline --all`.
- Re-ran every plan-level `<verification>` command: `node --test ghidra-live.test.ts` with the opt-in unset -- 13/13 skipped, exit 0; with the opt-in and the real installation -- 13/13 pass; `--test-name-pattern="volatile"` selects and passes the new cases; the evidence file's three grep gates (`WITHFLAG_RECORDED`, `DISAPPEARANCE_RECORDED`, `CONFLICT_RECORDED`) all print; `git status --porcelain` over `vendor/ghidra-scripts/`, `fixtures/ghidra/` and `tools/` empty after every task's own commit; the no-exception-handler grep gate over the committed `VolatileCarve.java` returns 0; `npm run typecheck` clean; `npm run test:automated` matches the recorded baseline exactly (3409 tests, 3396 pass, 2 fail in `anno-register.test.ts`, 6 skipped) with the VICE broker confirmed stopped beforehand.
