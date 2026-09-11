---
phase: 46-the-lossless-export-invariant-and-the-provenance-carry
plan: 02
subsystem: annotation-export
tags: [provenance, markdown-parser, refusal-contract, byte-diff-verification]

# Dependency graph
requires:
  - phase: 46-the-lossless-export-invariant-and-the-provenance-carry
    provides: "anno-provenance-ledger.ts's tracer shape (readProvenanceLedger, provenanceForRange) and anno-export-asm.ts's ledgerPath carry, both shipped by plan 46-01"
provides:
  - "readProvenanceLedger()'s full refusal set: zero data rows, wrong cell count, unparseable Start/End (naming the column), End-below-Start, row overlap/non-ascending order, and non-$0000-$FFFF coverage -- every message naming only the permitted fact vocabulary (path, line number, column name, cell count, parsed address), never a cell's own text"
  - "anno-provenance-ledger.test.ts: the reader's own sibling suite (21 tests) -- positive round trips built from renderLedger()'s real output, one test per refusal asserting on message content, a three-assertion information-disclosure control, and the five provenanceForRange() join boundary cases"
  - "anno-export-asm.test.ts's BUILD-05 edge-class coverage: adjacency (touching contributes zero, one-byte overlap contributes one, two-row overlap emits two markers plus one named ambiguity line), empty (omitted ledger, zero-row refusal distinguishable from absent-file refusal, the zero-ranges refusal unmoved by --ledger, single-row-tiling annotation), and ordering (retype()-carved blocks stay strictly ascending, repeat exports are byte-identical)"
affects: [46-03, 46-04, 46-05, 46-06]

# Actuals (#2632)
actuals:
  tokens: 15749
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reader refusals mirror writer preconditions exactly: readProvenanceLedger()'s three address-shaped assertions (row-shape, ordering/overlap, full-$0000-$FFFF coverage) are the SAME three conditions renderLedger() refuses to emit under -- a violation is evidence of tampering or corruption, never a reader bug -- while the two content-shaped preconditions (UNKNOWN-empty-reason, ORIGINAL-agreeing<2) are deliberately never re-asserted, since that would make the reader adjudicate a verdict's substance."
    - "Permitted-fact vocabulary enumerated in the module's own \"WHAT NOT TO DO\" section (path, 1-based line number, column name, cell count, parsed address) rather than left as a general instruction -- a later contributor adding a refusal has the list in front of them."
    - "Every malformed test fixture is ONE documented string mutation of a real renderLedger() output, asserted to have actually changed the text before the refusal is checked -- never a hand-typed table, so the suite cannot drift from the one real writer's format."
  patterns-established:
    - "A narrow (1-byte) store range is the clean way to test an exact address-overlap boundary in isolation: a wider block forces a SECOND ledger row to cover its remainder, contaminating a single-row overlap assertion with a second marker."

key-files:
  created:
    - src/mcp/vice/anno-provenance-ledger.test.ts
  modified:
    - src/mcp/vice/anno-provenance-ledger.ts
    - src/mcp/vice/anno-export-asm.test.ts
    - src/mcp/vice/anno-cli.test.ts

key-decisions:
  - "All refusal messages were renamed from the readProvenanceLedger: function-name prefix (46-01's shipped spelling) to the anno-provenance-ledger: module-name prefix, matching the exact house-shape family the plan's own read_first citations (anno-export-asm.ts's two shipped refusals) establish -- one consistent prefix across every refusal this module raises, old and new."
  - "The overlap/non-ascending check and the full-coverage check are two SEPARATE refusals rather than one combined message, deliberately mirroring renderLedger()'s own two distinct emit-time coverage preconditions (tiling with no gap/overlap; reaching $FFFF) rather than collapsing them into a single generic 'bad ledger' refusal."
  - "The zero-data-rows check runs textually AFTER the per-row shape/address checks in the code (since it can only be evaluated once the parse loop over candidate rows completes), even though it is conceptually 'does the table hold any rows at all' -- documented explicitly in readProvenanceLedger()'s own doc comment as RULE order versus EXECUTION order, so a reader is not misled by the numbered list above the function."

requirements-completed: [BUILD-05]

coverage:
  - id: D1
    description: "readProvenanceLedger() refuses, by name, every way a ledger can be absent or malformed (zero data rows, wrong cell count, unparseable address naming the column, inverted span, row overlap/non-ascending order, non-full coverage), with a five-fact permitted vocabulary enforced and never a cell's own text disclosed."
    requirement: "BUILD-05"
    verification:
      - kind: unit
        ref: "anno-provenance-ledger.test.ts#refusal: a data row splits into other than seven cells"
        status: pass
      - kind: unit
        ref: "anno-provenance-ledger.test.ts#refusal: a data row's Start cell is not a parseable $XXXX address, naming Start and never the cell's own text"
        status: pass
      - kind: unit
        ref: "anno-provenance-ledger.test.ts#refusal: two data rows overlap"
        status: pass
      - kind: unit
        ref: "anno-provenance-ledger.test.ts#refusal: the accepted rows leave a gap (a middle row deleted) -- names the first uncovered address"
        status: pass
      - kind: unit
        ref: "anno-provenance-ledger.test.ts#information-disclosure control: a distinctive token in the offending row's Evidence cell never reaches the refusal message, while the path and line number do"
        status: pass
    human_judgment: false
  - id: D2
    description: "A committed sibling test file (anno-provenance-ledger.test.ts) covers every refusal, the verbatim-carry and escaped-text positive cases, the single-row tiling edge, and the five provenanceForRange() join boundary cases -- built exclusively from renderLedger()'s own output, joining the automated test run with no test-gate.mjs edit."
    requirement: "BUILD-05"
    verification:
      - kind: unit
        ref: "anno-provenance-ledger.test.ts (21 tests, 0 fail, 0 skipped)"
        status: pass
      - kind: other
        ref: "node -e \"automatedTestFiles(...).includes('anno-provenance-ledger.test.ts')\" -> true"
        status: pass
    human_judgment: false
  - id: D3
    description: "BUILD-05's adjacency, empty and ordering edge classes are each asserted end to end through the real exportAsm(): exact adjacency (touching contributes zero, one-byte overlap contributes one, two-row overlap emits two markers plus one ambiguity line naming 2), empty ledger states (omitted, zero-rows vs absent-file, zero-ranges unmoved by --ledger, single-row tiling), and ordering (retype()-carved blocks strictly ascending, repeat exports byte-identical)."
    requirement: "BUILD-05"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#adjacency: a ledger row ending exactly one below a store range's start contributes ZERO PROVENANCE LEDGER lines to that block"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#adjacency: a store range spanning a ledger row boundary is overlapped by exactly two rows, emitted in ascending row-start order with one ambiguity line naming the count 2"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#empty: a ledger with the header and ZERO data rows throws the named zero-rows refusal, distinguishable from the absent-file refusal"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#ordering: emitted block starts are strictly ascending with no two equal, over a store retype() carved from overlapping writes"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#ordering: running the same ledger-mode export twice produces byte-identical result.source"
        status: pass
    human_judgment: false

duration: 41 min
completed: 2026-09-11
status: complete
---

# Phase 46 Plan 02: The Ledger Reader's Refusal Set Summary

**`readProvenanceLedger()` hardened into a full refuse-by-name reader over `renderLedger()`'s own output -- nine distinct named refusals, a 21-test sibling suite with an information-disclosure control, and nine new end-to-end tests pinning BUILD-05's adjacency, empty and ordering address-join edges through the real exporter.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-09-11T17:05:16+02:00
- **Completed:** 2026-09-11T17:45:52+02:00
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `anno-provenance-ledger.ts`'s `readProvenanceLedger()` gained six new refusals (zero data rows; a data row not splitting into seven cells now names both the found and expected counts; an unparseable Start or End cell names the specific column and never the cell's own text; an inverted End-below-Start span; row overlap or non-ascending order naming both line numbers and both spans; the accepted rows not tiling exactly `$0000..$FFFF`, naming the first uncovered address) on top of the three refusals plan 46-01 already shipped, for nine total. Every message was also renamed to a single consistent `anno-provenance-ledger:` prefix, and the module's "WHAT NOT TO DO" section now enumerates the five permitted fact kinds a message may carry.
- `anno-provenance-ledger.test.ts`: a new 21-test sibling suite, built exclusively from `renderLedger()`'s real output (never a hand-typed table) -- four positive cases (round trip, unrecognised-verdict verbatim carry, escaped-pipe restoration, single-row tiling), ten refusal tests asserting on message content, a three-assertion information-disclosure control, and five `provenanceForRange()` join boundary cases.
- `anno-export-asm.test.ts` gained nine new tests extending its existing ledger section: three `adjacency:` tests (a touching row contributes zero marker lines, a one-byte overlap contributes exactly one, a block spanning a ledger row boundary gets two markers plus one ambiguity line naming the count 2), four `empty:` tests (omitted ledger, the zero-data-rows refusal distinguishable from the absent-file refusal, the pre-existing zero-ranges refusal unmoved by `--ledger`, a single-row-tiling ledger annotating a single-range store), and two `ordering:` tests (a store `retype()`-carved from overlapping `setDataType()` writes still yields strictly ascending block starts, and a repeat ledger-mode export is byte-identical).
- Fixed a regression Task 1's new coverage assertion caused in a pre-existing 46-01 test: `anno-cli.test.ts`'s hand-written `writeMinimalLedger()` fixture covered only `$C000-$C005`, which the new full-coverage assertion now refuses -- padded with two rows to tile `$0000..$FFFF` exactly.

## Task Commits

Each task was committed atomically:

1. **Task 1: The reader's full refusal set** - `65e078a9` (feat)
2. **Task 2: The reader's own test file, with the information-disclosure control** - `ac6b7b01` (test)
3. **Task 3: BUILD-05's three edge classes, asserted through the real exporter** - `01cf6f6b` (test, includes the `anno-cli.test.ts` deviation fix discovered during its own full-suite verification pass)

_Note: Task 3's commit also carries the `anno-cli.test.ts` fixture fix and the `anno-export-asm.test.ts` Test 6 stale-comment correction described below under Deviations, since they were discovered and fixed together during that task's own verification loop before the commit was made._

## Files Created/Modified
- `src/mcp/vice/anno-provenance-ledger.ts` - the reader's full refusal set (nine named refusals), a shared `hex4()`/`refuseBadAddress()` helper pair, and the enumerated permitted-fact vocabulary
- `src/mcp/vice/anno-provenance-ledger.test.ts` - new: the reader's own 21-test sibling suite
- `src/mcp/vice/anno-export-asm.test.ts` - nine new `adjacency:`/`empty:`/`ordering:` tests, plus a corrected comment on 46-01's PROVENANCE CARRY Test 6
- `src/mcp/vice/anno-cli.test.ts` - `writeMinimalLedger()` padded to tile `$0000..$FFFF` exactly (Rule 1 fix)

## Decisions Made
See `key-decisions` in the frontmatter above (the module-name refusal prefix, the two-separate-coverage-checks split mirroring `renderLedger()`'s own two preconditions, and the RULE-order-versus-execution-order documentation for the zero-data-rows check).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `anno-cli.test.ts`'s hand-written ledger fixture was refused by Task 1's new coverage assertion**
- **Found during:** Task 3's own full-suite (`npm run test:automated`) verification pass
- **Issue:** `writeMinimalLedger()` (introduced in plan 46-01) hand-writes a ledger covering only `$C000-$C005` -- valid before Task 1 added the full-`$0000..$FFFF`-coverage assertion, refused after. This reddened `export-asm: --ledger FILE annotates the output with the ledger's verdict, and the run still exits 0`, a name NOT in the documented five-failure baseline.
- **Fix:** Padded the fixture with two rows (`$0000-$BFFF` and `$C006-$FFFF`, both `ORIGINAL`/`HIGH`) so the whole table tiles the full address space, per the section's own stated intent that this fixture "only needs to be SHAPED like a ledger, not a byte-for-byte `renderLedger()` product."
- **Files modified:** `src/mcp/vice/anno-cli.test.ts`
- **Verification:** `node --test anno-cli.test.ts` 94/94, 0 fail; full `npm run test:automated` re-run afterward showed exactly the four (of five) documented baseline failures, with no new or different failing names.
- **Committed in:** `01cf6f6b` (Task 3 commit)

**2. [Rule 1 - Bug] A stale comment on 46-01's PROVENANCE CARRY Test 6, now factually wrong after Task 1's coverage assertion landed**
- **Found during:** Task 3's own verification pass, reading the test this plan's `<read_first>` pointed at
- **Issue:** The comment above Test 6 stated `readProvenanceLedger()` "does not yet enforce that coverage assertion (deferred to plan 46-02)" -- true when written, false once Task 1 landed in this same plan. The test itself needed no code change (both its assertions -- path named, no row's text leaked -- hold whether the refusal fires in the reader or in `exportAsm()`'s own per-block check), but the comment explaining WHY would have misled a future reader.
- **Fix:** Rewrote the comment to state that the refusal now fires one layer earlier (inside the reader itself) and to point at `anno-provenance-ledger.test.ts` for the reader-level coverage tests directly.
- **Files modified:** `src/mcp/vice/anno-export-asm.test.ts`
- **Verification:** `node --test anno-export-asm.test.ts` 105/105, 0 fail, 0 skipped (Test 6 unchanged in behavior, comment only).
- **Committed in:** `01cf6f6b` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug fixes: one a genuine test-fixture regression caused by this plan's own Task 1, one a stale comment made incorrect by the same change)
**Impact on plan:** Both are direct, necessary corrections to consequences of this plan's own work landing inside a single plan's execution -- no scope creep, no behavior or requirement change beyond what Task 1 already specified.

## Issues Encountered

**Non-issue, verified as a transient flake:** one `npm run test:automated` run during verification showed a fifth failing test, `text-protocol.test.ts`'s "WR-01 (fixed, GREEN): the default quiescence window on the banner-drain path..." -- a name not in this file's touch set and not in the documented baseline. Running `text-protocol.test.ts` alone showed 34/34 passing, 0 fail, and a subsequent full-suite re-run showed exactly the four documented baseline names with no fifth failure at all. Confirmed as system-load timing flake, unrelated to this plan's changes.

## User Setup Required

None - no external service configuration required. No `user_setup` block in the plan's frontmatter.

## Next Phase Readiness
- `readProvenanceLedger()`'s refusal set is now complete per BUILD-05 criterion 4: every way a ledger can be absent or malformed has a named refusal, none of them quotes the file's own cell text, and the reader asserts only address-shaped invariants (never the two content-shaped preconditions `renderLedger()` enforces).
- `provenanceForRange()`'s address-only join is now pinned at both the unit level (`anno-provenance-ledger.test.ts`, five boundary cases) and the end-to-end level (`anno-export-asm.test.ts`, the adjacency group), so the two suites agree by construction on exact-adjacency semantics.
- `npm run test:automated`'s failing-name set matches the documented baseline (four of five names present this run, the fifth a documented flake that passed) -- confirmed via a fresh re-run after all three task commits landed.
- No blockers for 46-03.

## Self-Check: PASSED

- `[ -f src/mcp/vice/anno-provenance-ledger.ts ]` - FOUND (modified)
- `[ -f src/mcp/vice/anno-provenance-ledger.test.ts ]` - FOUND
- `[ -f src/mcp/vice/anno-export-asm.test.ts ]` - FOUND (modified)
- `[ -f src/mcp/vice/anno-cli.test.ts ]` - FOUND (modified)
- `git log --oneline --all --grep="46-02"` returns 3 commits: `65e078a9`, `ac6b7b01`, `01cf6f6b` - FOUND
- Re-ran every task's `<verify>` command and every plan-level `<verification>` command: `npm run typecheck` clean; `node --test anno-provenance-ledger.test.ts anno-export-asm.test.ts` 126/126, 0 fail; `grep -ac 'refusing to' anno-provenance-ledger.ts` = 9 (>= 8 required); `node --test anno-export-asm.test.ts 2>&1 | grep -ac 'adjacency:\|empty:\|ordering:'` = 9 (>= 9 required); `node scripts/check-npm-packages.mjs` exit=0 (new test file NOT in `files[]`); `npm run test:automated` failing-name set matches the documented baseline (4 of 5 names present, fifth a documented flake that passed this run) - PASSED

---
*Phase: 46-the-lossless-export-invariant-and-the-provenance-carry*
*Completed: 2026-09-11*
