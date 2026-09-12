---
phase: 47-multi-file-rebuildable-source
plan: 03
subsystem: reverse-engineering-toolchain
tags: [acme, export-asm, annotation-store, binary-export, multi-file-source]

requires:
  - phase: 47-multi-file-rebuildable-source
    provides: "47-01's cwd-aware acme.build and exportAsmTree() tree writer; 47-02's multi-scope partition and output-directory contract (force/overwrite refusal)"
provides:
  - "emitDataLines()'s third branch: an external_file-typed block emits one !binary line naming a bare data_XXXX.bin filename instead of inline !byte data"
  - "binaryFileName(start) -- module-private, derives data_XXXX.bin from a block's start address, on the same terms scopeFileName() already carries for .a siblings"
  - "ExportBinary / ExportAsmResult.binaries -- every external_file block's own image bytes, verbatim, ready for exportAsmTree() to write beside the .a files"
  - "exportAsmTree() writes every .bin sibling in the same pass as the .a files, before root.a, joining the output-directory contract's name set so force:true can replace one exactly like a previously-exported .a file"
  - "an end-to-end swap demonstration on the committed charset-phantom.prg's own real 2048-byte character set: the data changes, the code (every .a file, and ACME's own report listing) does not"
affects: [47-04, 47-05]

actuals:
  tokens: 8725
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "One named module-private constant per store-vocabulary comparison (EXTERNAL_FILE_DATA_TYPE, matching CODE_DATA_TYPE's existing precedent) -- the literal spelling is written down exactly once, never re-typed at each comparison site."
    - "A swap demonstration built from a REAL committed fixture's own bytes via a test-local store (buildStoreOverImage()), rather than a synthetic stand-in, when the committed store already types the same bytes for an unrelated purpose other tests depend on."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-export-asm.test.ts

key-decisions:
  - "The generic per-type DATA_TYPES round-trip loop excludes external_file: its !binary line names a sibling file only exportAsmTree() writes, and acme-verify.ts (which that loop's verifyExport() calls) is single-file by design (hard scope fence 3) with no sibling to write. external_file's own round trip is proved separately through exportAsmTree() in the new \"binary emission:\" suite -- never skipped, just reached through the right verifier."
  - "The swap demonstration uses the committed fixtures/ghidra/charset-phantom.prg's own $1000..$17ff bytes through a store this test builds itself (buildStoreOverImage()), because no committed fixture carries a store-typed data table ready for a !binary swap and the committed charset-phantom.annostore.json must stay typed \"code\" for Phase 37/45 tests."
  - "Replacement bytes are the original bytes' bitwise complement (b ^ 0xff), guaranteeing every byte differs without a random source this test would then have to seed or hardcode."

requirements-completed: [BUILD-02]

coverage:
  - id: D1
    description: "An external_file range is emitted as its own .bin file, referenced by a bare-filename !binary line, never as inline data."
    requirement: BUILD-02
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#binary emission: an external_file range emits exactly one !binary line with a bare-filename argument, and no !byte line for it"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#binary emission: result.binaries carries the block's own image bytes, octet-identical to bytes read independently from the image"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#binary emission: exportAsmTree() writes the .bin beside the tree with exactly those bytes and that length"
        status: pass
    human_judgment: false
  - id: D2
    description: "A tree carrying an external_file block assembles through real ACME, producing bytes identical to the image."
    requirement: BUILD-02
    verification:
      - kind: integration
        ref: "anno-export-asm.test.ts#binary emission: the tree assembles through runHostTool() at exitStatus 0 and the produced bytes deepEqual result.expectedBytes"
        status: pass
    human_judgment: false
  - id: D3
    description: "dataByteCount still counts an external_file range's bytes, matching a byte-typed range of the same extent, and the block bracket catches a wrong-length .bin at real ACME exit 1."
    requirement: BUILD-02
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#dataByteCount for an external_file range equals what the same extent typed byte would have produced"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#a .bin truncated by one byte makes real ACME exit non-zero, with the block-end drift !error text on stderr"
        status: pass
    human_judgment: false
  - id: D4
    description: "The swap is demonstrated end to end on a real 2048-byte character set taken from a committed fixture's own bytes: the data changes exactly in that window, every .a file is byte-identical before and after, and ACME's own report listing agrees, with the committed store untouched and a hand-swapped .bin protected from an unrequested re-export."
    requirement: BUILD-02
    verification:
      - kind: integration
        ref: "anno-export-asm.test.ts#binary swap: the setup -- a store typing the committed character-set region external_file assembles the baseline tree at exitStatus 0 with bytes equal to expectedBytes"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#binary swap: the demonstration -- replacing the written .bin's 2048 bytes and re-assembling WITHOUT re-exporting changes the produced bytes exactly in the $1000..$17ff window"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#binary swap: no code was touched -- every .a file in the tree is byte-identical before and after the swap"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#binary swap: ACME agrees -- the two report listings' code lines for $0801..$0fff are identical"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#the committed charset-phantom.annostore.json is untouched -- its $1000..$17ff row still reads code"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#a re-export into a directory holding a hand-swapped .bin refuses by name and leaves it intact; an explicit overwrite replaces it"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-09-12
status: complete
---

# Phase 47 Plan 3: External-File Binary Emission and the Character-Set Swap Demonstration Summary

**`external_file` ranges now leave as sibling `.bin` files referenced by bare-filename `!binary` lines, proven end to end by swapping the committed `charset-phantom.prg`'s own 2048-byte character set for different bytes and reassembling with zero lines of code touched.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-12T17:34:00Z (approx, continuing directly from 47-05)
- **Completed:** 2026-09-12T17:51:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `emitDataLines()` gained a third branch: an `external_file`-typed block emits exactly one `!binary "data_XXXX.bin"` line covering the block's whole extent, and no `!byte` line at all
- `binaryFileName()`, `ExportBinary`, and `ExportAsmResult.binaries` carry each `external_file` block's own image bytes verbatim to `exportAsmTree()`, which writes every `.bin` sibling in the same pass as the `.a` files, before `root.a`, joining the output-directory contract's name set so a re-export can only replace one with an explicit `force`
- `dataByteCount` still counts an `external_file` range's bytes exactly as a `byte`-typed range of the same extent would, and the existing block-bracket assertion catches a wrong-length `.bin` at real ACME exit 1
- The swap is demonstrated, not described: the committed `fixtures/ghidra/charset-phantom.prg`'s own real 2048-byte `$1000..$17ff` character set is exported as its own `.bin`, replaced with its bitwise complement, and the tree reassembles with the produced bytes changed in exactly that window -- every `.a` file byte-identical before and after, and ACME's own report listing agreeing on the code lines

## Task Commits

Each task was committed atomically:

1. **Task 1: `external_file` leaves as its own file -- the `!binary` branch and the sibling writer** - `22207487` (feat)
2. **Task 2: The swap, demonstrated on a real character set -- data changes, code does not** - `3b558d3c` (test)

**Plan metadata:** (this commit, following this SUMMARY)

_Note: both tasks were `tdd="true"`; per this project's established phase-47 convention (see 47-01/47-02 history), implementation and its own direct test coverage landed in one `feat` commit for Task 1, with Task 2 -- pure test additions building on Task 1's implementation, no production code changed -- landing as its own `test` commit._

## Files Created/Modified
- `src/mcp/vice/anno-export-asm.ts` - `EXTERNAL_FILE_DATA_TYPE` constant, `emitDataLines()`'s new `!binary` branch, `binaryFileName()`, `ExportBinary`/`ExportAsmResult.binaries`, `exportAsmTree()`'s `.bin`-sibling write pass joining the directory-contract name set
- `src/mcp/vice/anno-export-asm.test.ts` - seven "binary emission:"/related tests proving the branch, the byte-identity, the tree write, the round trip, the byte count, the truncation guard, and the write-order/mtime invariant; seven "binary swap:"/related tests proving the end-to-end character-set swap demonstration; one line excluding `external_file` from the pre-existing generic per-type round-trip loop, with the reason stated inline

## Decisions Made
- The generic per-type `DATA_TYPES` round-trip loop excludes `external_file`: its `!binary` line names a sibling file only `exportAsmTree()` writes, and `acme-verify.ts` (which that loop's `verifyExport()` calls) is single-file by design (hard scope fence 3) with no sibling to write. `external_file`'s own round trip is proved separately through `exportAsmTree()` in the new "binary emission:" suite -- never skipped, just reached through the right verifier.
- The swap demonstration uses the committed `fixtures/ghidra/charset-phantom.prg`'s own `$1000..$17ff` bytes through a store this test builds itself (`buildStoreOverImage()`), because no committed fixture carries a store-typed data table ready for a `!binary` swap and the committed `charset-phantom.annostore.json` must stay typed `code` for Phase 37/45 tests.
- Replacement bytes are the original bytes' bitwise complement (`b ^ 0xff`), guaranteeing every byte differs without a random source this test would then have to seed or hardcode.

## Deviations from Plan

None - plan executed exactly as written. The generic-loop exclusion described above is a necessary consequence of implementing the plan's own action exactly as specified (the third `emitDataLines()` branch), not a deviation from it -- documented above as a decision rather than a Rule-1/2/3 fix, since nothing was broken by the plan; the plan's own change made one pre-existing test's assumption ("every real data type round-trips through the single-file verifier") stop holding for exactly the one type this plan changed, which the plan itself anticipated needing a dedicated `exportAsmTree()`-based round trip instead.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `external_file` is now a fully wired, twelfth data-type member with real emission, a real writer, and a real end-to-end demonstration -- the last of the store's twelve data types with a documented "reserved for later" gap.
- Plan 47-04 (labeling every emitted-block reference) can build on this plan's `charset_start`/`start` labels precedent without further groundwork here.
- No blockers for 47-04 or 47-05's already-landed CLI promotion.

---
*Phase: 47-multi-file-rebuildable-source*
*Completed: 2026-09-12*

## Self-Check: PASSED

- `src/mcp/vice/anno-export-asm.ts` FOUND
- `src/mcp/vice/anno-export-asm.test.ts` FOUND
- Commit `22207487` (Task 1, feat) FOUND in git log
- Commit `3b558d3c` (Task 2, test) FOUND in git log
- `node --test anno-export-asm.test.ts`: 173 pass, 0 fail, 0 skipped
- `node --test anno-join.test.ts anno-graphics.test.ts`: 38 pass, 0 fail, 0 skipped
- `npm run typecheck`: clean
- `node scripts/check-npm-packages.mjs`: exit 0
- `npm run test:automated`: failing set is exactly the documented 6-member baseline (anno-import.test.ts:352, anno-register.test.ts:385, anno-register.test.ts:479, audit-integrity.test.ts:245, docs-deferred-ledger.test.ts:101, docs-deferred-ledger.test.ts:195) -- no new failures
- `git diff --name-only -- src/mcp/vice/fixtures`: empty (no committed fixture touched)
- Committed `charset-phantom.annostore.json`'s `$1000..$17ff` row still reads `code`
