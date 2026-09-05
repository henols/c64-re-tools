---
phase: 37-the-importer-and-the-automatic-annotation-join
plan: 03
subsystem: annotation-store
tags: [memmap-json, annotation-join, provenance, tie-break, in-image-skip]

# Dependency graph
requires:
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-01's memmap-lookup.ts (loadMemmap/memmapDigest/selectMemmapEntry placeholder) and anno-join.ts (runMemmapJoin's counts/decisions shape)"
provides:
  - "selectMemmapEntry(): the complete, three-deep, stated selection order (WIDTH -> SYMBOL -> ORDER), with tieBrokenBy reporting which step decided"
  - "runMemmapJoin()'s in-image guard as a proven control-flow fact (an injectable selectEntry seam makes 'never looked up' checkable by a counting spy, not just inferred from the result)"
  - "the memmapSha256 provenance token (PROVENANCE_TOKEN_PREFIX + full 64-char digest) on every derived comment, computed once per run"
affects: ["37-04", "37-05", "37-06", "37-07", "37-08"]

# Actuals (#2632)
actuals:
  tokens: 8765
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three separately-named comparison steps (narrowestWidthSurvivors/symbolSurvivors/orderWinner) instead of one dense comparator, so a later plan's single-mutation observed-red control stays a one-line textual replacement per step"
    - "An injectable pure-function seam (selectEntry, defaulting to the real implementation) as the ONLY way to prove a code path is unreached, when the caller-visible result would look identical either way"
    - "A provenance token computed once per batch operation and reused for every row, rather than recomputed per row, so byte-identical inputs are a structural guarantee rather than an incidental observation"

key-files:
  created: []
  modified:
    - src/mcp/vice/memmap-lookup.ts
    - src/mcp/vice/memmap-lookup.test.ts
    - src/mcp/vice/anno-join.ts
    - src/mcp/vice/anno-join.test.ts

key-decisions:
  - "D-37-10/D-37-11 confirmed exactly as measured at plan time: $D020 has 8 contenders (two 1-byte, index 506 'Border color (only bits #0-#3)' beats index 507 'Border Color' -- both lack a sym, so only the ORDER step decides); $0000 has 3 contenders (index 1 carries sym 'D6510' -- the SYMBOL step decides). No map drift found."
  - "D-37-12: the in-image guard tests membership BEFORE selectEntry() is called at all, and an injected counting-spy seam (selectEntry, defaulting to the real selectMemmapEntry) is the only way to prove the lookup is genuinely unreached rather than merely discarded."
  - "runMemmapJoin() now refuses (AnnoJoinError) when imageByteLength is 0, rather than silently treating a zero-width range at the origin as in-image."
  - "D-37-13: PROVENANCE_TOKEN_PREFIX is '[memmap-sha256:' with NO closing delimiter -- the full 64-char lowercase hex digest is deliberately the very last thing in the comment text, so a trailing-anchored regex finds it without knowing the preceding label's shape."
  - "The pre-37-03 residual tie-break test in memmap-lookup.test.ts (first-in-entries-order winning over a sym-bearing entry) was UPDATED, not kept -- it explicitly documented itself as superseded by this plan's own sym rule (37-01's own comment: 'a later plan replaces it with the sym rule')."

requirements-completed: [AUTO-02, AUTO-03, AUTO-08]

coverage:
  - id: D1
    description: "selectMemmapEntry() implements the complete three-deep selection order (narrowest-range-wins, then sym tie-break, then stated residual entries-order rule), with tieBrokenBy reporting which step decided, over both the real $D020/$0000 fixtures and hand-built equal/touching-range cases"
    requirement: "AUTO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/memmap-lookup.test.ts#selectMemmapEntry(0xd020): resolves to the 1-byte border-colour entry ... decided by the ORDER step"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/memmap-lookup.test.ts#selectMemmapEntry(0x0000): resolves to the sym-bearing entry ... decided by the SYMBOL step"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/memmap-lookup.test.ts#the selection path contains at most one sort() call"
        status: pass
    human_judgment: false
  - id: D2
    description: "runMemmapJoin()'s in-image skip runs as an early-return guard before the map lookup, proven by an injected counting-spy selectEntry seam rather than inferred from the result; refuses by name on a zero-byte image"
    requirement: "AUTO-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-join.test.ts#an injected counting spy in place of the selection function records zero calls for an all-in-image store, and exactly one once an out-of-image target is added"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-join.test.ts#the origin and the last byte of the image are in-image; the byte immediately before and immediately after are not"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-join.test.ts#an image whose body length is zero refuses by name rather than treating the origin as in-image"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every derived comment carries the memmapSha256 provenance token (PROVENANCE_TOKEN_PREFIX + full 64-char digest), computed once per run, always last in the comment text, surviving close+reopen, refused rather than truncated when over the byte bound"
    requirement: "AUTO-08"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-join.test.ts#every derived comment ends in the provenance prefix followed by exactly 64 lowercase hex characters, equal to memmapDigest() computed independently ... byte-identical tokens"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-join.test.ts#setComment() refuses, by name, a synthetic label long enough that label+token exceeds MAX_COMMENT_BYTES"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-05
status: complete
---

# Phase 37 Plan 03: Three-Deep Selection Order, the Proven In-Image Guard, and the Provenance Token Summary

**`selectMemmapEntry()` now resolves `$D020` and `$0000` through a three-step, separately-mutable order (width, then sym, then stated entries-order) reporting `tieBrokenBy`; `runMemmapJoin()`'s in-image skip is proven unreachable by an injectable counting-spy seam rather than merely inferred from its result; and every derived comment now carries the full 64-character sha256 of the map bytes that produced it, computed once per run and never truncated.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-05T~08:55:00Z (estimated, immediately after 37-02's closing commit)
- **Completed:** 2026-09-05T~09:40:00Z
- **Tasks:** 3
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments

- `selectMemmapEntry()` rewritten as three separately-named, separately-mutable comparison steps (`narrowestWidthSurvivors` / `symbolSurvivors` / `orderWinner`), each callable independently and each a single textual replacement target for a future observed-red control (plan 37-04) -- `MemmapSelection` gains `tieBrokenBy: "unique" | "width" | "symbol" | "order"` so a caller can tell WHICH rule decided, not merely infer it from the winning entry's own shape
- Re-measured the requirement's own named fixtures against the REAL committed `memmap.json`, both confirming the plan's own decisions exactly: `$D020` has 8 containing entries, of which the two 1-byte ones (index 506 `"Border color (only bits #0-#3)"`, index 507 `"Border Color"`) both lack a `sym` -- only the ORDER step decides, and 506 wins; `$0000` has 3 containing entries, of which exactly one (index 1) carries `sym: "D6510"` -- the SYMBOL step decides. No map drift found; both numbers matched the plan's own measurement
- `runMemmapJoin()` gains an injectable `selectEntry` parameter (defaulting to the real `selectMemmapEntry`) purpose-built as the ONE seam that makes "never looked up" checkable by a counting spy -- a result-filtering implementation (compute the selection, then discard it for an in-image address) would otherwise pass every result-only assertion while still violating `AUTO-03`
- `runMemmapJoin()` now refuses by name (`AnnoJoinError`) when the image's own body length is zero, rather than silently treating a zero-width range at the origin as in-image; the in-image skip reason now names both the specific address and the range, not just the range
- Every annotated comment now ends with `PROVENANCE_TOKEN_PREFIX` (`"[memmap-sha256:"`, exported from `memmap-lookup.ts`, no closing delimiter) followed by the full 64-character lowercase hex `memmapDigest()`, computed ONCE per join run and reused for every row -- a skipped or declined address writes no comment and therefore no token; an over-long label+token combination surfaces `setComment()`'s own `AnnoCommentError` refusal rather than being pre-truncated
- A rendered ACME comment line for the `$D020` example now reads (indent per `anno-export-asm.ts`'s own `INDENT` constant):
  ```
      ; Border color (only bits #0-#3) [memmap-sha256:<64-char-hex-digest>]
  ```
  (`anno-export-asm.test.ts`/`anno-store.test.ts` confirmed unaffected -- 191/191 pass across both plus `anno-regbits.test.ts`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Narrowest-range-wins, the sym tie-break, and the stated residual order** - `6aee80ec` (feat)
2. **Task 2: The in-image skip, placed before the lookup** - `ecfa1cfe` (feat)
3. **Task 3: The memmapSha256 provenance token on every derived row** - `e122b634` (feat)

_Plan metadata (this SUMMARY, STATE.md, ROADMAP.md) lands in the final `docs(37-03):` commit per the workflow's `git_commit_metadata` step._

## Files Created/Modified

- `src/mcp/vice/memmap-lookup.ts` - `selectMemmapEntry()` rewritten as the three-deep stated order; `MemmapTieBreak`/`MemmapSelection.tieBrokenBy` added; `PROVENANCE_TOKEN_PREFIX` exported
- `src/mcp/vice/memmap-lookup.test.ts` - new cases for the real `$D020`/`$0000` fixtures with `tieBrokenBy` assertions, hand-built equal-range/touching-range/single-entry/empty-list cases, a two-call determinism case, and the "at most one `sort(`" structural check; the pre-37-03 residual-tie-break case updated to its own documented successor
- `src/mcp/vice/anno-join.ts` - `runMemmapJoin()` gains the `selectEntry` injection seam, the zero-byte-image refusal (`AnnoJoinError`), the address-naming in-image reason, and the `memmapDigest()`-once-per-run provenance token on every write
- `src/mcp/vice/anno-join.test.ts` - new cases for the four boundary addresses, the counting-spy proof, zero-cross-reference-rows, zero-byte-image refusal, decision ordering/determinism, token shape/digest-equality/byte-identity/close-reopen-survival, zero-comments-when-all-skipped, and the over-long-label refusal

## Decisions Made

- **`PROVENANCE_TOKEN_PREFIX = "[memmap-sha256:"` with no closing bracket.** The plan's own acceptance criteria require the digest to be the LAST thing in the comment text ("ends in the provenance prefix followed by exactly 64 lowercase hex characters"); a closing `]` would put a non-hex character after the digest and fail that exact assertion. A trailing-anchored regex (`PREFIX + [0-9a-f]{64}$`) finds it reliably without needing a closing delimiter.
- **`selectEntry` is a positional parameter on `runMemmapJoin()`, not a field on `RunMemmapJoinArgs`.** Keeps the existing call site in `anno-tools.ts`'s `dispatchJoinMemmap()` (`runMemmapJoin(handle, { imageOrigin, imageByteLength })`) unchanged -- the new parameter is purely additive and defaults to the real implementation, so no other caller needed touching.
- **`AnnoJoinError` follows `anno-import.ts`'s `AnnoImportError` construction idiom** (a bare `Error` subclass, not `AnnoStoreError`) since `anno-join.ts` never touches the store's own persistence and has no reason to join that error family.
- **The order step uses a linear scan over `entries`, never `Array.prototype.sort()`.** Keeps the "at most one `sort(` call in the selection path" invariant trivially true (the file now has zero), and keeps plan 37-04's own "reverse the tie-break" mutation a one-line replacement inside `orderWinner()` rather than a sort-comparator edit.

## Deviations from Plan

None - plan executed exactly as written. Both re-measured fixture numbers ($D020: 8 contenders / two 1-byte / neither with `sym`; $0000: 3 contenders / one with `sym`) matched the plan's own measurements exactly -- no map drift found, no numbers needed correcting.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `selectMemmapEntry()`'s `tieBrokenBy` field and its three separately-named comparison steps (`narrowestWidthSurvivors`/`symbolSurvivors`/`orderWinner`) are ready for plan 37-04's three observed-red controls (each a one-line mutation to one named step)
- `runMemmapJoin()`'s `selectEntry` injection seam and its single removable early-return in-image guard are ready for plan 37-05's control (row 4: "remove the image-range check")
- The `memmapSha256` provenance token is live on every derived comment; plans 37-06/37-07/37-08 (bank-state resolution, graphics derivation, dxa/Ghidra feedback) inherit it automatically since they write through the same `setComment()` path this plan's join uses
- No blockers. `npm run test:automated` (broker stopped) measured at 3465 tests / 3452 pass / 2 fail, both in `anno-register.test.ts` (`:385`, `:479`) -- the same pre-existing pair every prior phase-37 plan has recorded, unchanged by this plan

## Self-Check: PASSED

- `src/mcp/vice/memmap-lookup.ts` — FOUND
- `src/mcp/vice/memmap-lookup.test.ts` — FOUND
- `src/mcp/vice/anno-join.ts` — FOUND
- `src/mcp/vice/anno-join.test.ts` — FOUND
- Commit `6aee80ec` — FOUND in `git log --oneline --all`
- Commit `ecfa1cfe` — FOUND in `git log --oneline --all`
- Commit `e122b634` — FOUND in `git log --oneline --all`
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `node --test memmap-lookup.test.ts anno-join.test.ts anno-import.test.ts` 54/54 pass; `node --test anno-regbits.test.ts anno-export-asm.test.ts anno-store.test.ts` 191/191 pass; `npm run test:automated` (broker confirmed stopped) 3465 tests / 3452 pass / 2 fail (both pre-existing in `anno-register.test.ts`); `grep -av '^[[:space:]]*[/*]' anno-join.ts | grep -c totalBytes` outputs `0`; `grep -av '^[[:space:]]*[/*]' memmap-lookup.ts | grep -c 'sort('` outputs `0`

---
*Phase: 37-the-importer-and-the-automatic-annotation-join*
*Completed: 2026-09-05*
