---
phase: 38-proof-01-03-on-real-cracked-code
plan: "03"
subsystem: testing
tags: [ghidra, dxa, static-analysis, 6502-disassembly, evidence-schema, circularity-guard]

requires:
  - phase: 38-proof-01-03-on-real-cracked-code
    provides: "evidence/SCHEMA.md's frozen PROOF02_* outcome-line vocabulary and evidence/README.md's conventions (38-01)"
  - phase: 36-the-sleigh-language-and-the-ghidra-harness
    provides: "ghidra-run.ts's runGhidraAnalyze()/classifyGhidraRunLog(), vendor/ghidra-scripts/ (VolatileCarve.java, GhidraStructExport.java), the corpus's five established entry points and the BRK-trick finding (36-07)"
  - phase: 35-dxa-vendored-and-parsed
    provides: "dxa-run.ts's runDxaDisassemble(), dxa-listing.ts's parseDumpListing()/DumpListingMap"
provides:
  - "evidence/proof02-enumerate-sites.mjs: the Ghidra-independent $6C (JMP abs) site enumerator, reused unchanged by plan 38-04 at the depacked depth"
  - "evidence/proof02-loader-stage.md: PROOF-02's loader/depacker-depth result, PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised, citing Phase 36's BRK-trick finding alongside"
affects: [38-04]

actuals:
  tokens: 12163
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "D-06 circularity guard as a checkable document property: the enumerator's own source never imports a Ghidra-export parser (verified by a comment-filtered grep), and the evidence file's own line ordering (site enumeration written before any Ghidra mention) is asserted by an awk line-number comparison, not merely claimed in prose"
    - "Full NMOS 6502 instruction-length table (256 entries, legal + documented illegal opcodes) driving a bounded backward-realignment walk, used to classify a fixed-address opcode's own preceding data-flow shape without a general-purpose disassembler"
    - "Cross-check, never a filter: dxa's own code/data classification is attached to every enumerated site as an annotation column, never used to drop a site from the report"
    - "Ghidra scratch workspace must avoid ANY dot-prefixed path segment (resolveGhidraProject()'s own refusal) -- this phase's own $HOME/.cache PROBE_DIR cannot host a Ghidra project directory; use a sibling non-dot scratch root for Ghidra runs specifically"

key-files:
  created:
    - .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-enumerate-sites.mjs
    - .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-loader-stage.md

key-decisions:
  - "The enumerator's backward classification tries every candidate realignment start within the 48-byte window and keeps the one using the MOST of the window (smallest start) among those that decode cleanly to the JMP site -- deterministic (order-independent) and maximises available context for the register-history walk, rather than stopping at the first (possibly minimal, low-context) alignment found."
  - "Only DIRECT (non-indexed) STA forms ($85 zp, $8D abs) count as 'the pointer was written here' -- an indexed STA's effective address depends on a runtime register value this static walk cannot resolve, so it is never treated as a positive pointer-write match."
  - "PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised, derived per the plan's own rule (zero computed-index sites enumerated at this depth) -- not a claim that no computed dispatch exists anywhere in the release, only that this depth's search found no candidate of that shape to check."

requirements-completed: [PROOF-02]

coverage:
  - id: D1
    description: "Ghidra-independent $6C (JMP abs) site enumerator: linear byte scan, four-bucket classification (immediate-index/computed-index/vector/unknown), dxa cross-check annotation (never a filter), deterministic --json output, no Ghidra-export read and no child-process import"
    requirement: "PROOF-02"
    verification:
      - kind: other
        ref: "node evidence/proof02-enumerate-sites.mjs enumerate --prg fixtures/dxa/fixture.prg, run twice, byte-identical stdout and --json (cmp); pivot fixture's ldx #$02/disp_lo,x/disp_hi,x/jmp ($fb) construct classifies immediate-index; grep -al node:child_process count 0; comment-filtered grep for parseGhidraExport count 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "PROOF-02's loader/depacker-stage measurement: independent enumeration recorded before Ghidra ran (document ordering asserted, not merely claimed), Ghidra run through the seam with GHIDRA_HOME set explicitly and the SLEIGH language asserted installed, verdict inside its declared domain, Phase 36's BRK-trick finding cited alongside with the mechanism distinction stated"
    requirement: "PROOF-02"
    verification:
      - kind: other
        ref: "grep -acE for the 10 declared PROOF02_LOADER_*/BROKER_STATE outcome lines (10/10); PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised matches its declared domain; awk ordering check (enumeration line number < first Ghidra-seam mention) returns ORDER_OK; all five Phase 36 entry points and the 36-07-acceptance-run.md citation present; git status --porcelain free of stray Ghidra/binary artifacts"
        status: pass
    human_judgment: true
    rationale: "The grep/awk checks prove the keys, verdict domain and document ordering are correct. Whether the surrounding prose honestly scopes every claim to the loader/depacker depth actually searched, and presents Phase 36's BRK-trick finding as a genuinely different mechanism rather than as an answer to PROOF-02's own question, is the judgment this plan's own human-check verify step reserves for a human reader."

duration: 24min
completed: 2026-09-05
status: complete
---

# Phase 38 Plan 03: PROOF-02 -- The Ghidra-Independent Enumerator and the Loader-Stage Result Summary

**Built a Ghidra-independent `$6C` (JMP abs) dispatch-site enumerator and used it to measure PROOF-02 at the loader/depacker depth on the real `danish.d64` corpus: 53 raw candidate sites, all classified `data` by dxa's own independent listing (false positives in the packed body), zero computed-index or immediate-index sites in the loader's 67 bytes of real code -- `PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised`, with Phase 36's BRK-trick finding cited alongside and its distinct mechanism stated explicitly.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-05T20:34:29+02:00
- **Completed:** 2026-09-05T20:58:11+02:00
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `evidence/proof02-enumerate-sites.mjs` -- a pure, deterministic enumerator: linear byte scan for opcode `$6C`, classifying each site `immediate-index`/`computed-index`/`vector`/`unknown` via a bounded 48-byte backward instruction-length-table walk over a full NMOS 6502 opcode table (legal plus the documented illegal/undocumented opcodes this corpus has already been measured to contain). Verified live against the pivot fixture's own `ldx #$02` / `disp_lo,x` / `disp_hi,x` / `jmp ($fb)` construct: classifies `immediate-index`, exactly as the plan's own acceptance criteria requires. `--json` output byte-identical across two runs; both `--prg` and `--flat64k` origins report correctly (`$0801` read from the `.prg`'s own header, `$0000` for a 65536-byte flat capture). The script imports no Node child-process module and reads no Ghidra export anywhere -- the D-06 circularity guard, verified by grep, not merely asserted in a comment.
- `evidence/proof02-loader-stage.md` records the loader/depacker-depth measurement, in the order that makes the circularity guard operational: the independent enumeration was run and written into the file FIRST (53 candidate sites over the extracted `BRUCE LEE (DC)` `.prg`, cross-checked against dxa's own listing -- all 53 classify `dxa=data`, zero `code`), and only THEN was Ghidra invoked, over the same image and Phase 36's own five established entry points (`$081b`, `$b70a`, `$b74c`, `$b7e7`, `$b790`). The Ghidra run reproduced Phase 36's own numbers exactly (49682 classification lines, 82 references, 10 decompiled functions, `STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found`) -- the same real corpus, the same real result, independently re-observed.
- `PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised` -- derived honestly from zero computed-index sites enumerated at this depth, never `pass` and never Phase 23's retired `could-not-run` spelling. Phase 36's BRK-trick finding (`evidence/36-07-acceptance-run.md`) is quoted and cited alongside, with the mechanism distinction stated plainly: a `BRK` opcode forcing control through the hardware IRQ vector is a fundamentally different construct from a `JMP (abs)`-based indexed dispatch table, and the enumerator's own `$6C`-only scan by design never sees the former at all.
- Live `test:automated` result confirmed at the recorded baseline (`tests 3525 / pass 3512 / fail 2`, both pre-existing `anno-register.test.ts` findings), broker confirmed `inactive` before and after.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the Ghidra-independent dispatch-site enumerator** - `366c40de` (feat)
2. **Task 2: Search the loader/depacker stage and record the answer at that depth** - `6764e707` (docs)

**Plan metadata:** committed after this SUMMARY.

## Files Created/Modified

- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-enumerate-sites.mjs` - the Ghidra-independent enumerator, reused unchanged by plan `38-04`
- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-loader-stage.md` - the loader/depacker-depth PROOF-02 record

## Decisions Made

- The backward-realignment search tries every candidate start offset within the 48-byte window and keeps the one using the MOST context (smallest start) among those that decode cleanly to the target `$6C` site -- deterministic (all candidates are checked; the winner does not depend on iteration order) and maximises the register-history walk's available context, rather than accepting the first (possibly minimal) alignment found.
- Only direct, non-indexed `STA` forms (`$85` zp, `$8D` abs) count as "the pointer was written here" for classification purposes -- an indexed `STA`'s effective address depends on a runtime register value this static walk has no way to resolve, so it is never treated as a positive match, keeping the classifier honest about what it can and cannot know statically.
- `PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised` is the correct, honestly-scoped verdict for zero enumerated computed-index sites at this depth, per the plan's own stated derivation rule -- explicitly NOT a claim that no computed dispatch exists anywhere in the release (the packed game body, reached only by plan `38-04`'s own deeper search, is untouched by this measurement).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ghidra scratch workspace moved off this phase's own `PROBE_DIR`**
- **Found during:** Task 2, the first live `ghidra.analyze` invocation
- **Issue:** `evidence/README.md`'s own `PROBE_DIR` (`$HOME/.cache/c64-re-tools/phase38`) contains a dot-prefixed path segment (`.cache`), and `ghidra-project.mts`'s `resolveGhidraProject()` unconditionally refuses any computed project location containing one -- reproduced live: the first attempt against `PROBE_DIR` refused outright, naming the offending segment.
- **Fix:** Built a sibling scratch workspace with no dot-prefixed segment anywhere in its path (`$HOME/c64-re-tools-ghidra-scratch/phase38/`, still outside the checkout and still never `/tmp`), copied the same extracted `.prg`, entry-point file and `vendor/ghidra-scripts/` into it, and ran `ghidra.analyze` against that root instead. The corpus extraction and dxa work (Step 1) remain under the standard `PROBE_DIR`, unaffected -- only the Ghidra-specific scratch root needed to move.
- **Files modified:** None (working-directory choice only, recorded in `evidence/proof02-loader-stage.md`'s own transcript, including the reproduced refusal).
- **Verification:** The re-run against the corrected scratch root succeeded (`exitStatus: 0`, `scriptThrew: false`, language byte-exact match); `git status --porcelain` confirmed clean of any artifact from either scratch root afterward.
- **Committed in:** `6764e707` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact:** Necessary for the Ghidra run to succeed at all; no scope creep -- the fix is a working-directory choice recorded transparently in the evidence transcript, not a change to any shipped source file.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `evidence/proof02-enumerate-sites.mjs` is committed and ready for plan `38-04` to reuse unchanged at the depacked-image depth (`--flat64k` mode already verified against a synthetic 65536-byte input in this plan).
- `evidence/proof02-loader-stage.md`'s loader-depth result (`PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised`) is recorded and will be cited alongside plan `38-04`'s own depacked-depth result when the roll-up `evidence/proof02-computed-dispatch.md` is written.
- `TEST_AUTOMATED_BASELINE: tests 3525 / pass 3512 / fail 2` remains the floor -- unaffected by this plan's work.
- No blockers for `38-04`, which depends only on `38-01`.

## Self-Check: PASSED

Both created files confirmed present on disk (`ls`); both commits (`366c40de`, `6764e707`) confirmed in `git log --oneline --all`.

---
*Phase: 38-proof-01-03-on-real-cracked-code*
*Completed: 2026-09-05*
