---
phase: 28-the-store-core
plan: 02
subsystem: testing
tags: [store-03, paint-index, cross-validation, oracle, structural-guard, 6502]

# Dependency graph
requires:
  - phase: 28-the-store-core
    provides: "anno-index.ts — the pure narrowest-range-wins paint index (buildPaintIndex, resolveAt, NO_ROW, PAINT_INDEX_SIZE, IndexableRange) shipped by plan 28-01"
  - phase: 28-the-store-core
    provides: "anno-types.ts — ADDRESS_MIN, ADDRESS_MAX and AnnoAddressError with its input/what fields"
  - phase: 27-shared-seams-extracted
    provides: "shipped-modules.ts's codeOnly(keepLiteralBodies) — the shared stripper both structural scans in this file run on"
  - phase: 27-shared-seams-extracted
    provides: "block-class.test.ts:176-212 — the import-specifier scan and the module-level-mutable-state scan reused here"
provides:
  - "anno-index.test.ts — the exhaustive 65,536-address cross-validation of the paint index against an independently written linear-scan oracle, zero disagreements"
  - "resolveByScan — Oracle B, test-only, the second statement of the narrowest-wins + higher-id-wins rule, written as an explicit length-then-id comparison"
  - "a deterministic seeded 2,000-range overlapping fixture, proven non-degenerate on BOTH the narrowest-wins and the equal-length axes"
  - "five separately-pinned edge cases: $FFFF, both inclusive ends against a DIFFERENT row, length 1, the equal-length tie-break, and the empty/single-row index"
  - "the out-of-range refusal pin: resolveAt throws AnnoAddressError carrying the offending value for 0x10000 and -1"
  - "structural purity assertions over anno-index.ts: no module-level mutable binding, exactly one import specifier, no dynamic import"
affects: [28-03, 28-04, 28-05, 28-06, "the MCP annotation surface", "ACME export", "coverage census"]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate:
# chars/4 over the file actually changed (26,690 chars, one file).
actuals:
  tokens: 6673
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "two implementations of one rule, neither calling the other, cross-checked exhaustively rather than by spot checks"
    - "non-vacuity measured from the fixture itself: a comparison counter plus per-axis overlap census, so an agreement cannot be vacuous"
    - "each edge case pinned on its own hand-written row set, never on the generated fixture"
    - "every pin observed RED against a deliberately broken production rule before being committed"
    - "a failure message that must be RENDERABLE: capped diff list plus a separately counted total"

key-files:
  created:
    - src/mcp/vice/anno-index.test.ts
  modified: []

key-decisions:
  - "A4's non-vacuity is proven by RELABELLING one of two equal-span rows (7/9 → 9, then 7/3 → 7), not by exchanging two ids: exchanging 7 and 9 between identical spans is a no-op on the row set, so the plan's literal 'expect 7' is unreachable under the pinned rule"
  - "The import-purity assertion pins the specifier SET to exactly ['./anno-types.ts'] plus family exclusions rather than asserting `import type`: anno-index.ts imports two error classes it throws, so a type-only import is unreachable"
  - "The module-level-mutable scan is anchored at column zero AND allows an `export ` prefix — every module-level binding in anno-index.ts is exported, which block-class.test.ts's unprefixed anchor would have missed entirely"
  - "The cross-validation's disagreement list is CAPPED at 8 with the total counted separately: an uncapped deepEqual diff over thousands of disagreements was killed by the OS before printing"
  - "The fixture's span sizes come from a small palette rather than a continuous distribution, because shared EXACT spans are what make equal-length overlaps plentiful"

patterns-established:
  - "Observed-red-per-pin: an assertion that a rule is present proves nothing; each pin is broken deliberately, the failure message read, and the break reverted in the same task"
  - "Capped-and-counted failure reporting: state the scale, name a bounded sample — a gate whose failure cannot be rendered reports nothing"
  - "Region-scoped structural scan: extract the function's own body from codeOnly() source, because a file-wide scan for identifiers the file legitimately names elsewhere is permanently red"

requirements-completed: [STORE-03]

coverage:
  - id: D1
    description: "The paint index and an independently written linear-scan oracle agree at every one of the 65,536 addresses over a 2,000-range deliberately overlapping fixture, with zero disagreements and no shared code path"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#the paint index and an independently written linear scan agree at every one of the 65,536 addresses"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#the linear-scan oracle shares no code path with the production paint index"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cross-validation is exhaustive rather than sampled: a comparison counter asserted equal to 65536, so a loop that visited no addresses cannot satisfy the agreement"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#the paint index and an independently written linear scan agree at every one of the 65,536 addresses"
        status: pass
      - kind: manual_procedural
        ref: "narrowed the loop bound to 0x00FF; assertion failed with 'expected 65536 comparisons, performed 256'; reverted"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fixture is proven non-degenerate on both axes: some address is covered by ranges of DIFFERENT lengths, and some address by two ranges of EQUAL length"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#the fixture is non-degenerate on the narrowest-wins axis: some address is covered by ranges of DIFFERENT lengths"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#the fixture is non-degenerate on the tie-break axis: some address is covered by two ranges of EQUAL length"
        status: pass
    human_judgment: false
  - id: D4
    description: "The $FFFF boundary is pinned separately: a range ending at 0xFFFF resolves there, the index length is exactly PAINT_INDEX_SIZE, and resolveAt refuses 0x10000 and -1 with AnnoAddressError carrying the offending value"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#a range ending at 0xFFFF resolves AT 0xFFFF and the paint loop does not run off the array"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#resolveAt refuses an address outside 0x0000..0xFFFF with AnnoAddressError carrying the offending value"
        status: pass
      - kind: manual_procedural
        ref: "made anno-index.ts's paint upper bound exclusive; pin failed with '0xFFFF is INSIDE a range that ends at 0xFFFF'; reverted"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both range ends are proven inclusive against a DIFFERENT row rather than against NO_ROW: an inner 0x0810-0x084F inside an outer 0x0800-0x08FF"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#start and endInclusive are BOTH inclusive, and one step either side resolves to the OUTER row"
        status: pass
    human_judgment: false
  - id: D6
    description: "The length-1 case is pinned: $0400-$0400 reports endInclusive - start + 1 === 1, resolves at exactly 0x0400 and NO_ROW at 0x03FF and 0x0401"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#a $0400-$0400 range has length 1 and resolves at exactly 0x0400"
        status: pass
    human_judgment: false
  - id: D7
    description: "The equal-length tie-break (decision A4) is pinned, is not decided by array order or sort stability, is not satisfiable by a hard-coded answer, and is cross-checked against the oracle"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#two rows of EQUAL length covering one address resolve to the HIGHER id, and the oracle agrees"
        status: pass
      - kind: manual_procedural
        ref: "reversed anno-index.ts's equal-length tie order to b.id - a.id; pin failed with 'the higher id wins an equal-length tie' and the cross-validation reported 25111/65536 disagreements; reverted"
        status: pass
    human_judgment: false
  - id: D8
    description: "The empty and single-row indexes are pinned: buildPaintIndex([]) is full-size and resolves NO_ROW at 0x0000/0x7FFF/0xFFFF; a single row resolves inside its span and NO_ROW one step either side"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#buildPaintIndex([]) is a full-size index that resolves NO_ROW everywhere probed"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#a single-row index resolves that row inside its span and NO_ROW one step either side"
        status: pass
    human_judgment: false
  - id: D9
    description: "anno-index.ts cannot become a second truth: no module-level mutable binding (including a const bound to a mutable container), exactly one import specifier, and no dynamic import"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#anno-index.ts declares no module-level mutable binding, including a const bound to a mutable container"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-index.test.ts#anno-index.ts imports from exactly one module, anno-types.ts, and uses no dynamic import"
        status: pass
    human_judgment: false
  - id: D10
    description: "The whole file joins the normal automated suite with no MANUAL_ONLY_TESTS entry and no sampling gate, and adds no failure outside the named test:automated baseline"
    requirement: "STORE-03"
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && npm run test:automated (broker stopped) — 2561 tests, 6 fail, all six in anno-session.test.ts (the five named plan 18-06: baseline failures plus the named load-sensitive flake at :615)"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && npm run typecheck"
        status: pass
    human_judgment: false

# Metrics
duration: 19 min
completed: 2026-08-27
status: complete
---

# Phase 28 Plan 02: STORE-03's Exhaustive Cross-Validation Summary

**The narrowest-range-wins paint index is now proven exact at all 65,536 addresses against a test-only linear-scan oracle that shares no code path with it — zero disagreements over a 2,000-range overlapping fixture proven non-degenerate on both axes — with $FFFF, both inclusive ends, length 1, the equal-length tie-break and the empty/single-row cases each pinned separately and each observed RED against a deliberately broken production rule.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-27T13:15:14Z
- **Completed:** 2026-08-27T13:34:03Z
- **Tasks:** 2
- **Files modified:** 1 created (`src/mcp/vice/anno-index.test.ts`, 530 lines, 13 tests)

## Accomplishments

- **The exhaustive loop stayed exhaustive.** All 65,536 addresses, not a sample. Measured on this host at 415–922 ms for the cross-validation and 576–775 ms for the whole file — comfortably under the plan's 5 s bar, so no `MANUAL_ONLY_TESTS` entry, no sampling and no `--test-only` gate. The file joins both `npm test` and `npm run test:automated` with no edit anywhere.
- **Oracle B (`resolveByScan`) is genuinely independent, and that is asserted structurally.** No sort, no typed array, no call into `anno-index.ts`; the tie-break written out as an explicit `len < bestLen || (len === bestLen && row.id > bestId)` rather than derived from a sort order. The independence assertion extracts the oracle's own body from this file's `codeOnly()` source and asserts it names none of `buildPaintIndex`, `resolveAt`, `Int32Array` or `.sort(` — scoped to the body because the file legitimately names all four elsewhere, and guarded against an empty extraction so it cannot pass vacuously.
- **Three separate non-vacuity halves, all measured rather than assumed.** A comparison counter asserted equal to 65536; an O(addresses + rows) sweep census proving some address is covered by ranges of *different* lengths; and the same census proving some address is covered by two ranges of *equal* length. The reversed-tie red incidentally measured how far the equal-length axis is from marginal: 25,111 of 65,536 addresses change answer when the rule flips.
- **Five pins, four observed reds.** Each pin uses its own hand-written row set. Both ends inclusive is proven against a *different* row (inner 0x0810-0x084F inside outer 0x0800-0x08FF) rather than against `NO_ROW`, which is strictly stronger: an off-by-one shifting the inner span would still return `NO_ROW` outside the outer range and hide.
- **The index is structurally prevented from becoming a second truth.** No module-level mutable binding (the `const`-bound-container half kept in full, with `block-class.test.ts`'s WR-04 comment intact and the anchor extended to catch `export const`), exactly one import specifier, and no dynamic import.

## Task Commits

1. **Task 1: the exhaustive 65,536-address cross-validation against an independently written scan oracle** — `7902aea` (test)
2. **Task 2: the four pins, the empty/single-row pin, and the module-purity assertions** — `512a8de` (test)

**Plan metadata:** see the `docs(28-02)` commit.

`anno-index.ts` is byte-identical to its state at `4c9cea3`/`ac4e6a5`. It appears in Task 2's plan file list only because a pin might have revealed a real defect in it; none did, and both deliberate breaks were reverted before committing (`git diff --stat` named only the test file at each commit).

## Files Created/Modified

- `src/mcp/vice/anno-index.test.ts` — created. 530 lines, 13 tests: the exhaustive cross-validation, both non-degeneracy assertions, the oracle-independence structural scan, the five pins, and the two purity scans. Holds `resolveByScan` (Oracle B), the seeded fixture generator, the overlap census and the per-pin row sets — all test-only, none exported, none in `package.json`'s `files[]`.

## Decisions Made

- **A4's non-vacuity is proven by relabelling, not by exchanging.** The plan instructed "build a second index from the same spans with the ids exchanged and assert the resolved id is 7". That is unreachable under the rule it is testing: exchanging 7 and 9 between two *identical* spans is a no-op on the row set, so the answer stays 9. The intent — the assertion must not be satisfiable by a hard-coded answer — is met by two checks instead: reversing array order keeps the answer 9 (so sort stability does not decide it), and relabelling one row to id 3 flips the answer to 7 (so the answer tracks the id). The contradiction and its resolution are commented in the test.
- **The import-purity assertion pins the specifier set, not `import type`.** `anno-index.ts` imports two error classes it *throws* (`AnnoAddressError`, `AnnoRangeShapeError`), which are runtime values, so a type-only import is unreachable. What the constraint is actually for — the index must not acquire a runtime dependency on the store, a decoder or the filesystem — is stated directly by a family-prefix loop (`node:`, `./anno-store`, `./hostpath`, `./containerpath`, `./vice`, `./disasm-`, `./anno-`) plus a `deepEqual` to the one-element specifier list, plus the dynamic-`import(` prohibition a specifier scan cannot see.
- **The module-level-mutable anchor gained an optional `export ` prefix.** `block-class.test.ts`'s column-zero anchor works for that module because it has no exported module-level bindings; every one of `anno-index.ts`'s is exported, so the unprefixed anchor would have missed a memoising `export const cache = new Map()` entirely. The `const`-bound-mutable-container half is kept in full, WR-04 comment included.
- **The fixture's spans come from a small palette.** A continuous span distribution makes equal-length overlaps rare by construction (a 1..4096 draw over 2,000 rows gives roughly one row per span value). Shared *exact* spans are what make the tie-break half of the agreement non-vacuous.
- **The disagreement list is capped and the total counted separately.** See the deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The cross-validation's own failure path could not be rendered**

- **Found during:** Task 2, by the required observed red against a reversed equal-length tie order
- **Issue:** Task 1 asserted `assert.deepEqual(disagreements, [])` over an *uncapped* list. A genuinely broken resolution rule disagrees at tens of thousands of addresses (measured: 25,111), and `deepEqual`'s diff over that many objects ran for 26–46 s and was killed by the OS (`SIGTERM`, then `SIGKILL`) before printing anything. The test reported only `not ok 1 - anno-index.test.ts`, naming neither the failing assertion nor a single address — a gate whose failure cannot be rendered reports nothing, and the plan's stated reason for using `deepEqual` at all ("so a failure names the addresses") was defeated in exactly the case that matters.
- **Fix:** the reported list is capped at 8 entries and the total is counted separately. `assert.equal(disagreementCount, 0, …)` states the scale and embeds the bounded sample as JSON; the `deepEqual` against the now-bounded list follows, so a failure still names addresses. The measured reason is recorded in a comment beside the cap.
- **Files modified:** `src/mcp/vice/anno-index.test.ts`
- **Verification:** with the tie order reversed the failure now renders in under a second as `disagreed at 25111 of 65536 addresses; first 8: [{"address":362,…}]`; with the rule correct, 13/13 pass.
- **Committed in:** `512a8de`

**2. [Rule 3 - Blocking] Pin 4's literal instruction contradicted the rule it pins**

- **Found during:** Task 2
- **Issue:** "exchange the two equal-length rows' ids and assert the resolved id is 7" cannot hold under A4 (higher id wins) — exchanging 7 and 9 between two identical spans leaves the row set unchanged, so the answer is 9 either way. Written literally, the pin would have been permanently red for the wrong reason.
- **Fix:** replaced with the two checks that carry the intent — array-order reversal (answer unchanged, proving sort stability does not decide it) and relabelling one row to id 3 (answer flips to 7, proving no hard-coded answer satisfies both). Both are cross-checked against `resolveByScan`.
- **Files modified:** `src/mcp/vice/anno-index.test.ts`
- **Verification:** all three orderings assert, and the whole pin goes red when the production comparator's tie order is reversed.
- **Committed in:** `512a8de`

**3. [Rule 3 - Blocking] The "type-only import" clause was unsatisfiable**

- **Found during:** Task 2
- **Issue:** the plan (and must-have truth 9) asks that `anno-index.ts`'s single import be *type-only*. It imports `AnnoAddressError` and `AnnoRangeShapeError`, which it constructs and throws; `import type` would erase them and break the module.
- **Fix:** asserted the specifier *set* is exactly `["./anno-types.ts"]`, plus a family-prefix exclusion loop and the dynamic-`import(` prohibition, which is what the constraint exists to enforce. The reason the type-only form is unreachable is commented in the test. Recorded to `.planning/WINDOWS.md` as a deviation so it is visible at ship time.
- **Files modified:** `src/mcp/vice/anno-index.test.ts`
- **Verification:** the assertion is present and non-vacuous (the scanned set is asserted non-empty before the `deepEqual`); `npm run typecheck` clean.
- **Committed in:** `512a8de`

**4. [Rule 2 - Missing Critical] Two properties the plan's behaviours implied but did not assert**

- **Found during:** Task 2
- **Issue:** Pin 1's `AnnoAddressError` check would have passed on an error carrying no offending value, and the oracle-independence scan would have passed on a region that failed to extract (an empty string contains none of the forbidden identifiers).
- **Fix:** the refusal pin asserts `error.input` equals the offending value and `error.what` is `"address"`; the independence scan asserts the extracted region is findable, non-empty and contains `bestLen` before scanning it.
- **Files modified:** `src/mcp/vice/anno-index.test.ts`
- **Verification:** 13/13 pass; both added assertions are on the failing side of a deliberately emptied region / a message-only error.
- **Committed in:** `512a8de`

---

**Total deviations:** 4 auto-fixed (1 bug, 2 blocking, 1 missing critical).
**Impact on plan:** all four were confined to the test file; `anno-index.ts` was not changed by this plan at all. Two (2 and 3) are places where the plan's literal wording contradicted the design it was testing and the intent was preserved instead. No scope creep — no new export, no new dependency, no new `files[]` entry, no new shipped module.

## Issues Encountered

- **`npm run test:automated` exits 1 on a clean tree, as the plan documents.** The gate is the failure list, not the exit code. Reconciled item by item with the VICE broker confirmed stopped (`systemctl --user is-active vice-broker` → `inactive`, no `x64sc` process): **2561 tests, 6 failures, all six in `anno-session.test.ts`** — the five named `plan 18-06:` tests plus the named load-sensitive flake `"stub: a child that answers nothing within the call timeout…"` at `:615`. **No failure in any other file.** Test count rose 2548 → 2561, which is this plan's 13 tests.
- **The measured exhaustive-loop cost on this host is higher than the research host's 279 ms** — 415–922 ms across runs, 576–775 ms for the whole file. Recorded honestly rather than restating the research figure. Still an order of magnitude under the plan's 5 s bar, so the conclusion (exhaustive, no `MANUAL_ONLY_TESTS`, no sampling) is unchanged.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `STORE-03` is proven the way the requirement demands: two implementations, no shared code path, all 65,536 addresses, zero disagreements, and every named edge case pinned separately and observed red.
- `anno-index.ts` is now fenced structurally against the two changes that would quietly break it: acquiring module-level state (a memoising cache) and acquiring an import outside the type vocabulary.
- Ready for 28-03. No blockers introduced. One ledger entry filed (the unreachable type-only-import clause), no stubs, no skipped tests, and no unrun `<verify>`.

## Self-Check: PASSED

- `src/mcp/vice/anno-index.test.ts` — FOUND (530 lines, ≥ 170 required by `must_haves.artifacts`)
- Commit `7902aea` — FOUND
- Commit `512a8de` — FOUND
- `key_links`: `from "./anno-index.ts"` present (1), `from "./anno-types.ts"` present (1)
- Plan `<verification>`: `node --test anno-index.test.ts` 13/13 green in 576–775 ms; `npm run typecheck` exits 0; `npm run test:automated` shows no failure outside the named baseline; four observed reds each named in a commit message
- Stub scan over the created file: no `TODO`, `FIXME`, placeholder, `.skip(` or `test.todo`

---
*Phase: 28-the-store-core*
*Completed: 2026-08-27*
