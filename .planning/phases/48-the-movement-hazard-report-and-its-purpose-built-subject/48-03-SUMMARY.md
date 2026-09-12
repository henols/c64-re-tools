---
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
plan: 03
subsystem: analysis
tags: [hazard-report, indexed-dispatch, vic-ii-alignment, cycle-exact-raster, reuse]

requires:
  - phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
    provides: "plan 48-01's report shell, class-2 detector and three-outcome region machinery; plan 48-02's purpose-built hazard-subject fixture (the stack-return dispatch, the mixed-register decline, the VIC-II alignment routine and its mis-aligned twin)"
provides:
  - class 1 (indexed-dispatch): the existing scanIndirectDispatch() imported and mapped onto findings, pinned at exactly two non-test call sites by an exact-count reuse test; its advisory splitTableCandidates bucket carried through verbatim as HazardReport.unprovenDispatchCandidates
  - class 3 (page-alignment): a VIC-II constant-write-fact recovery walk over decoded bytes, handed to the existing anno-graphics.ts derivation (never re-derived); character-set and sprite-pointer findings; a missing-register combination marked undecided rather than no-signal
  - class 4 (cycle-exact-raster): structural-signature-only detection of a raster-register access, a NOP timing sled, or a one-shot timer reload inside a routine the RAM IRQ vector names -- always static-signature-only unless a runtime observation corroborates it
  - HAZARD_LIMITS completed to at least one entry per hazard class; a boolean report shape structurally refused; the undecided third region outcome proven reached by real fixtures
affects: [48-04, 48-05, 48-06]

actuals:
  tokens: 18034
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Single shared literal-target operand extraction (literalOperandTarget()) reused by the class-2, class-3 and sprite-pointer detectors -- one operand decoder, never a second."
    - "Single shared adjacent immediate-load/store recovery walk (recoverImmediateStoreFacts()) reused by the class-3 VIC-II register recovery and the class-4 interrupt-vector-byte recovery."
    - "'We looked and could not tell' (a recovered-but-incomplete register combination) is carried through classifyRegions() as a distinct unclassified reason, never folded into the 'we looked and found nothing' no-signal outcome."
    - "A foreign, verbatim-carried collection (the imported scanner's SplitTableFinding[] advisory bucket) is explicitly excluded from this module's own 'no boolean but truncated' shape discipline, since that discipline governs fields this module defines, not a preserved external shape."

key-files:
  modified:
    - src/mcp/vice/anno-hazard-report.ts
    - src/mcp/vice/anno-hazard-report.test.ts

key-decisions:
  - "A stack-return-dispatch or split-address-table finding's blockedAddress is Math.min(loBase, hiBase) -- the base of the combined two-table region -- rather than an arbitrary pick between the hi and lo tables."
  - "The class-3 VIC-II constant-write recovery only recognises an immediate load immediately followed by a matching store (lda #imm ; sta $addr) -- a read-modify-write construction (lda $addr ; and #mask ; ora #mask ; sta $addr), as plan 48-02's own hazard-subject-align.a uses for its bank-select write, is correctly left unrecovered rather than guessed, which is what lets that fixture's own missing-register case exercise the undecided-region path for real."
  - "The class-4 detector recovers RAM IRQ vector ($0314/$0315) byte writes independently (cross-producting every recovered low value against every recovered high value) rather than requiring a single 4-instruction low-then-high idiom; this favours a signature detector that finds more real installs over one that misses uncommon store orderings."
  - "$D012 is treated as one signal for both its read (current raster line) and write (raster-compare) roles, since VIC-II exposes both through the same address and the plan's own wording pairs them."
  - "class-4 anchors 'raster-access-in-vectored-handler' and 'timing-sled-after-raster-access' at the raster-register access instruction's own address (not the NOP run's first byte), and 'timer-reload-in-vectored-handler' at the store instruction; every class-4 finding carries a null blockedAddress -- there is no single byte a structural signature can name as pinned."

requirements-completed: [BUILD-04]

coverage:
  - id: D1
    description: "Class 1 is the existing scanIndirectDispatch() imported, not re-derived: exactly two non-test call sites (the coverage report builder and the hazard report), pinned by an exact-count test; the scanner's four proven collections map onto findings whose blockedAddress is always the table/vector base."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard reuse: the scanner is declared exactly once and called from exactly two non-test source sites"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-1: a stack-return (RTS-trick) dispatch is proven on the committed hazard-subject fixture and produces mechanism stack-return-dispatch"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-1: a proven split hi/lo address-table pairing gated by a zero-page-vector jump produces mechanism split-address-table, blocked at the table base -- never the dispatching instruction"
        status: pass
    human_judgment: false
  - id: D2
    description: "The scanner's advisory splitTableCandidates bucket is carried through HazardReport.unprovenDispatchCandidates verbatim -- never summed into findings, never promoted, never dropped."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-1: an advisory, ungated split-table pairing (mismatched index registers) produces NO entry in findings, and appears verbatim in unprovenDispatchCandidates"
        status: pass
    human_judgment: false
  - id: D3
    description: "Class 3 reuses the existing VIC-II derivation (anno-graphics.ts) rather than re-deriving it: recovers register-write facts from decoded bytes, hands them to deriveGraphicsRanges(), and adds the sprite-shape base the graphics module declined by name. Fires on the committed charset-phantom.prg fixture at its 2K-aligned base and stays silent on the committed processor-port (bank.prg) and 23-byte negative controls. A missing register produces an undecided region, not a no-signal one."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-3: the committed character-set fixture produces exactly that finding, with the blocked address at the 2K-aligned base its own source comment derives"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-3: the committed processor-port bank-switching image yields zero class-3 findings"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-3: the committed 23-byte negative-control image yields zero class-3 findings"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-3: a graphics map whose missingRegisters list is non-empty contributes no finding for the dependent ranges, and the region is undecided (unclassified) rather than no-signal"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-3: a store of an immediate literal into the derived sprite pointer table yields mechanism sprite-pointer-names-aligned-base, blocked at the literal times 64, when inside the image"
        status: pass
    human_judgment: false
  - id: D4
    description: "Class 4 flags a structural signature only (a raster-register access, a NOP timing sled, or a one-shot timer reload, each inside a routine an interrupt vector store names), never a verified timing claim -- static-signature-only unless a runtime observation covers the finding's own anchor address, and mechanism/detail text asserted free of 'verified'/'proven'/'confirmed'/'exact'."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-4: a raster-register access inside a routine an interrupt vector store names yields mechanism raster-access-in-vectored-handler at the weakest strength"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-4: no finding is ever emitted at the shape-matched or corroborated strength on the strength of a static match alone, and detail prose says 'signature' but never 'verified', 'proven' or 'confirmed'"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard class-4: a runtime observation covering the finding's own anchor address promotes its strength to observed-corroborated"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every hazard class has at least one HAZARD_LIMITS entry; a boolean clean-or-dirty report shape is refused by a runtime key enumeration; the undecided third region outcome is proven REACHED (not merely declared reachable) by real fixtures, with every unclassified region carrying a non-empty cause."
    requirement: BUILD-04
    verification:
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard limits: every one of the four hazard classes has at least one entry in the emitted limits array"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard shape: enumerating a real report's own keys finds no boolean field but truncated, and no key name reading clean/dirty/safe/ok/verdict/pass"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard shape: across the fixture corpus the suite reads, all three region-outcome tokens occur at least once"
        status: pass
      - kind: unit
        ref: "anno-hazard-report.test.ts#hazard shape: every undecided (unclassified) region across the fixture corpus carries a non-empty cause"
        status: pass
    human_judgment: false
  - id: D6
    description: "The full automated suite (npm run test:automated) shows exactly the same six pre-existing failing test names the measured baseline records, and no seventh; typecheck exits zero; the coverage and graphics modules' own test files pass unchanged."
    requirement: BUILD-04
    verification:
      - kind: integration
        ref: "npm run test:automated -- failing set {anno-import.test.ts:352, anno-register.test.ts:385, anno-register.test.ts:479, audit-integrity.test.ts:245, docs-deferred-ledger.test.ts:101, docs-deferred-ledger.test.ts:195}"
        status: pass
      - kind: integration
        ref: "npm run typecheck"
        status: pass
      - kind: integration
        ref: "node --test anno-coverage.test.ts anno-graphics.test.ts"
        status: pass
    human_judgment: false

duration: 74min
completed: 2026-09-13
status: complete
---

# Phase 48 Plan 03: The Movement-Hazard Report's Remaining Detectors Summary

**All four hazard classes now implemented in `anno-hazard-report.ts` -- class 1 imported from the existing scanner at an exact-count-pinned two call sites, class 3 built on the existing VIC-II derivation, class 4 as a structural-signature-only detector, and the report's honesty structure (limits, boolean refusal, undecided-reached) closed.**

## Performance

- **Duration:** 74 min
- **Started:** 2026-09-12T22:20:00Z
- **Completed:** 2026-09-12T23:34:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Class 1 (indexed-dispatch): `scanIndirectDispatch()` imported from `anno-coverage.ts` and called exactly once; its four proven collections (indirect jumps, multi-entry tables, stack-return dispatch, proven split tables) map onto findings whose `blockedAddress` is always the table or vector base; its advisory `splitTableCandidates` bucket rides through verbatim as `HazardReport.unprovenDispatchCandidates`; an exact-count reuse test pins the non-test call-site count at 2
- Class 3 (page-alignment): a narrow constant-write-fact recovery walk over decoded bytes (immediate-load-then-store to one of the three watched VIC-II registers), handed to the existing `deriveGraphicsRanges()` derivation; character-set findings anchored at the store that set the memory-control register; a sprite-pointer literal store becomes a movement constraint (value times 64) the graphics module itself declines to promise; a missing register produces an undecided region rather than a no-signal one
- Class 4 (cycle-exact-raster): structural-signature-only detection of a raster-register (`$D012`) access, a 3+ NOP timing sled after one, or a one-shot CIA1 timer reload, each inside a routine the RAM IRQ vector (`$0314`/`$0315`) names -- always `static-signature-only` unless a runtime observation covers the finding's own anchor address
- `HAZARD_LIMITS` completed to at least one entry per hazard class (asserted by a dedicated test); a boolean clean-or-dirty report shape is structurally refused by a runtime key enumeration; the undecided third region outcome is proven REACHED by a real fixture plus an out-of-image declared range, not merely declared reachable

## Task Commits

Each task was committed atomically:

1. **Task 1: Import the class-1 scanner as the second and only new call site, and pin the count** - `30e3e463` (feat)
2. **Task 2: The class-3 detector — VIC-II hardware alignment, and the reading it deliberately excludes** - `1e0a5095` (feat)
3. **Task 3: The class-4 signature, the undecided outcome reached, and a boolean shape refused** - `65818be2` (feat)

**Plan metadata:** committed below via `docs(48-03)`.

## Files Created/Modified

- `src/mcp/vice/anno-hazard-report.ts` - class-1/3/4 detectors, `literalOperandTarget()` and `recoverImmediateStoreFacts()` shared helpers, the completed `HAZARD_LIMITS`, and the extended `classifyRegions()` undecided-evidence path
- `src/mcp/vice/anno-hazard-report.test.ts` - 46 tests (up from 17), covering all three new classes, the reuse pin, the completed limits, and the closed shape/undecided-reached guarantees

## Decisions Made

See `key-decisions` in this file's frontmatter for the full list. The load-bearing one: the class-3 constant-write recovery deliberately does NOT recognise a read-modify-write register write (`lda $addr ; and #mask ; ora #mask ; sta $addr`), which is exactly the construction plan 48-02's own `hazard-subject-align.a` uses for its bank-select write -- so that committed fixture's own incompleteness is what exercises the "missing register produces an undecided region" behaviour against a real, independently-planted construction rather than a hand-built one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A quote-tracking comment/string stripper desynced on `anno-coverage.ts`'s own prose, undercounting the reuse test's call sites**
- **Found during:** Task 1, first test run
- **Issue:** The reuse test's first draft copied `anno-cli.test.ts`'s `stripCommentsAndLiterals()` (which also blanks quoted strings and template literals). Applied to `anno-coverage.ts`, it desynced somewhere in the file's own extensive doc-comment prose and undercounted `scanIndirectDispatch(` occurrences (reported 1 call site instead of 2).
- **Fix:** Switched to the simpler, comment-only stripper `anno-coverage.test.ts`'s own `withoutComments()` already uses successfully against this exact file (no quote/template tracking at all -- every occurrence of the literal text outside a real call site is inside a `//` or `/* */` comment in both source files, so comment-stripping alone is sufficient and does not desync).
- **Files modified:** `src/mcp/vice/anno-hazard-report.test.ts`
- **Verification:** `hazard reuse:` test passes, asserting the exact count 2.
- **Committed in:** `30e3e463` (Task 1 commit)

**2. [Rule 1 - Bug] A hand-built split-table test image was one byte short of the scanner's own in-image bound**
- **Found during:** Task 1, first test run
- **Issue:** The scanner's `inImage()` predicate requires room for a full 2-byte word read (`addr + 1 < effectiveEnd`), one byte stricter than a naive `addr < effectiveEnd` bound. The mismatched-index-register advisory-candidate test's hand-built image was exactly one byte too short, so the pairing's second load failed `inImage()` and produced neither a finding nor an advisory candidate.
- **Fix:** Added one trailing padding byte to the test image.
- **Files modified:** `src/mcp/vice/anno-hazard-report.test.ts`
- **Verification:** The two affected tests pass.
- **Committed in:** `30e3e463` (Task 1 commit)

**3. [Rule 2 - Missing critical] A bare decision-id citation and a planning-document name leaked into the class-3 detector's own header comment**
- **Found during:** Post-Task-3 self-review, cross-checking the diff against CLAUDE.md's planning-vocabulary rule
- **Issue:** The class-3 section header cited `D-48-A` (a decision id) and `RESEARCH.md` (a planning document) by name. `src/mcp/vice/*.ts` ships verbatim to npm; neither citation resolves for that reader. (Not caught by any automated guard -- `skills-planning-vocabulary.test.ts` explicitly scopes itself away from `src/mcp/vice/**`, which the project records as an existing, accepted backlog -- but the letter of the CLAUDE.md rule and the discipline plans 48-01/48-02 both held themselves to call for fixing it rather than leaving a fresh instance.)
- **Fix:** Rephrased both mentions in plain prose describing the VIC-II hardware-alignment reading and the excluded page-crossing-timing reading directly, with no citation.
- **Files modified:** `src/mcp/vice/anno-hazard-report.ts`
- **Verification:** `grep` for the planning-vocabulary patterns this project's own guards check for returns zero hits in this plan's diff; `npm run typecheck` and the full `anno-hazard-report.test.ts` suite still pass.
- **Committed in:** `6f03b63b` (follow-up fix commit, after Task 3's own commit)

---

**Total deviations:** 3 auto-fixed (2 bugs in this plan's own newly-added tests, 1 missing-critical planning-vocabulary cleanup)
**Impact on plan:** All three were necessary to make the plan's own acceptance bar hold (a correct reuse-count pin, a working advisory-candidate test, and compliance with CLAUDE.md's shipped-source rule). No scope creep: no capability beyond what the three tasks already specified was added.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four hazard classes (self-modifying-code, indexed-dispatch, page-alignment, cycle-exact-raster) are now implemented, tested, and reachable through the MCP tool and CLI verb plan 48-01 wired.
- `HAZARD_LIMITS` is complete: every class carries at least one named limit, asserted by a dedicated test that reds if a fifth detector is ever added without one.
- No blockers. Plan 48-01's own readiness note named plans 48-04/48-05/48-06 as remaining phase work (further hardening, the multi-file export path, and/or additional negative controls per the phase's own roadmap); this plan's own scope (the three remaining detectors and the honesty structure) is complete.

---
*Phase: 48-the-movement-hazard-report-and-its-purpose-built-subject*
*Completed: 2026-09-13*

## Self-Check: PASSED

- Both modified files found on disk (`src/mcp/vice/anno-hazard-report.ts`, `anno-hazard-report.test.ts`).
- All 4 commits found in git log (`30e3e463`, `1e0a5095`, `65818be2`, `6f03b63b`).
- `npm run typecheck` exits 0.
- `node --test anno-hazard-report.test.ts` reports 46/46 passing.
- `npm run test:automated` shows exactly the same 6 pre-existing failing test names the plan's measured baseline records, and no others (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`, `audit-integrity.test.ts:245`, `docs-deferred-ledger.test.ts:101`, `docs-deferred-ledger.test.ts:195`).
- `node --test anno-coverage.test.ts anno-graphics.test.ts` both pass in full (126 and 12 tests respectively).
- `node scripts/check-npm-packages.mjs` and `node scripts/check-skill-tool-coverage.mjs` both exit 0.
- Full diff scan for planning vocabulary (`.planning/` paths, `/gsd-` names, `D-NN` ids, `BUILD-NN` ids, `Phase N` citations, `ROADMAP.md`/`REQUIREMENTS.md` cross-references) across every line this plan's four commits added returns zero hits.
