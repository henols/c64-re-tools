---
phase: 37-the-importer-and-the-automatic-annotation-join
plan: 05
subsystem: annotation-store
tags: [memmap-lookup, anno-join, planted-violation, observed-red, pitfall-23, auto-03, auto-08]

# Dependency graph
requires:
  - phase: 37-the-importer-and-the-automatic-annotation-join
    provides: "37-03's single early-return in-image guard in anno-join.ts (a one-block textual deletion target) and its injectable selectEntry counting-spy seam, plus the memmapSha256 provenance token on every derived comment"
provides:
  - "A committed red transcript proving AUTO-03's in-image skip genuinely fails against the real committed memmap.json when the guard is deleted, with an injected counting spy proving the claim is about control flow (the map lookup being reached or not), not merely about the result"
  - "join-image-controls.test.ts: two planted-violation test cases (the in-image-skip deletion, the provenance-drift append) that re-check both reds mechanically on every future run"
  - "A committed transcript proving the memmapSha256 provenance token is a live discriminator -- a one-byte change to a copy of memmap.json produces a digest differing from one a previously-written comment carries"
affects: []

# Actuals (#2632)
actuals:
  tokens: 8019
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-export shims by absolute path (`export * from \"<abs path>\";`) as a lighter alternative to mirroring a mutated module's full dependency tree in a scratch copy -- used here so the scratch anno-join.ts's two sibling imports (anno-store.ts, memmap-lookup.ts) resolve without dragging anno-store.ts's own deep chain (anno-index.ts, anno-confidence.ts, vice.ts, node:sqlite) into the scratch tree; both the mutated and the test file's own statically-imported store functions resolve to the SAME cached module instance"
    - "A counting selection spy that DELEGATES to the real selection function (rather than faking an answer) -- proves a guard is control-flow (the lookup is reached or not) while still producing a genuinely correct annotation for the address that should be reached"

key-files:
  created:
    - src/mcp/vice/join-image-controls.test.ts
    - .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-05-in-image-skip-red.md
    - .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-05-provenance-drift-red.md
  modified: []

key-decisions:
  - "The in-image control's subject address is $0800 (2048, the BASIC area's own first byte), NOT a hardware register like $D020/$0000 used elsewhere in this phase -- the requirement's own failure story is about ORDINARY PROGRAM addresses the map merely happens to cover, and a hardware address would prove nothing about that specific failure mode. Measured at execution time: $0800 has 2 containing entries in the real memmap.json, the narrowest 1 byte wide, labelled \"Unused\"."
  - "Task 1's scratch tree uses RE-EXPORT SHIMS (export * from an absolute path) for anno-join.ts's two sibling imports rather than mirroring anno-store.ts's own deep dependency chain into the scratch tree -- anno-store.ts alone pulls in anno-index.ts, anno-confidence.ts and vice.ts, none of which this control has any reason to duplicate or even touch. The shim resolves to the exact same cached module the test file itself imports statically, so the mutated join and the test's own store setup share one real store instance."
  - "The committed anno-join.ts split into two commits mirrors 37-04's own precedent (memmap-lookup-controls.test.ts): each task's own test case is added incrementally to the growing file, one commit per task, per Pitfall 23's 'each red transcript is a deliverable of a task SEPARATE from the task that implements the fix' -- and separate from EACH OTHER here, since both are red-observation tasks in the same plan."

requirements-completed: [AUTO-03, AUTO-08]

coverage:
  - id: D1
    description: "Removing anno-join.ts's in-image early-return guard, in a scratch copy only, makes the ordinary BASIC-area address $0800 (real map entry: \"Unused\", 1 byte) annotate as a machine feature; the injected counting selection spy proves the map lookup is genuinely reached under the mutation and genuinely unreached under the committed code -- recorded as a committed transcript and encoded as a test case"
    requirement: "AUTO-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/join-image-controls.test.ts#PLANTED VIOLATION: deleting runMemmapJoin's in-image guard makes an ordinary, map-covered in-image address ($0800, \"Unused\") annotate as a machine feature, with the injected selection spy proving the guard is control flow, not result filtering"
        status: pass
    human_judgment: false
  - id: D2
    description: "A one-byte change to a COPY of memmap.json produces a memmapDigest() differing from the digest a previously-written comment carries (read back after a close+reopen), proving the memmapSha256 provenance token is a live discriminator between map versions rather than a decoration -- an EXTRA control beyond the phase's six required ones, recorded and encoded"
    requirement: "AUTO-08"
    verification:
      - kind: unit
        ref: 'src/mcp/vice/join-image-controls.test.ts#PROVENANCE (EXTRA -- not one of the phase''s six required controls): a one-byte change to a COPY of memmap.json produces a memmapDigest() differing from the digest a previously-written comment carries'
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-09-05
status: complete
---

# Phase 37 Plan 05: The In-Image-Skip and Provenance Controls Observed Red Summary

**Deleting `anno-join.ts`'s single early-return in-image guard, in a scratch copy only, is observed making the BASIC-area address `$0800` annotate as `"Unused"` instead of being skipped -- with an injected counting selection spy proving the map lookup is genuinely reached under the mutation and genuinely unreached under the committed code -- and a one-byte change to a copy of `memmap.json` is observed producing a `memmapDigest()` differing from the digest a previously-written comment carries, both recorded as committed transcripts and encoded as passing planted-violation test cases.**

## Performance

- **Duration:** ~24 min
- **Started:** ~2026-09-05T07:19:00Z (estimated, immediately after 37-04's closing commit)
- **Completed:** 2026-09-05T07:43:08Z
- **Tasks:** 2
- **Files modified:** 3 (3 created, 0 modified)

## Accomplishments

- `join-image-controls.test.ts` created with two planted-violation cases sharing the file but each with its own scratch-tree helper (per D-37-20, this file deliberately duplicates 37-04's scratch-tree helper SHAPE rather than sharing a module, since 37-04 and 37-05 run in the same wave)
- **Control 4 (in-image skip, AUTO-03, one of the phase's six required controls):** `runMemmapJoin()`'s single early-return guard (D-37-12/D-37-18) is deleted in a scratch copy, whose two sibling imports (`anno-store.ts`, `memmap-lookup.ts`) resolve via re-export shims forwarding to the real, absolute, unmutated files -- no dragged-in `anno-store.ts` dependency chain (`anno-index.ts`/`anno-confidence.ts`/`vice.ts`/`node:sqlite`) needed. MEASURED at execution time: `$0800` (2048, the BASIC area's own first byte) has 2 containing entries in the real `memmap.json`, the narrower 1 byte wide, labelled `"Unused"`. Under the deletion this address is annotated `"Unused"` and an injected counting selection spy records a call for it; under the committed code it is skipped-in-image and the spy records zero calls for it. A genuine out-of-image machine address (`$D020`) is annotated under both runs, proving the guard is selective rather than a total on/off switch
- **Control (provenance, AUTO-08, extra -- explicitly NOT one of the phase's six required controls):** a store's join against the committed `memmap.json` writes a comment carrying the `memmapSha256` token; read back after a close and a reopen, that token equals `memmapDigest()`. A scratch tree mirroring the repo shape three levels deep (matching `anno-regbits.test.ts`'s own drift-control pattern, D-37-19) copies the real map, appends one byte to THAT COPY (after a non-vacuity byte-identity precheck), and the mutated digest differs from both the committed digest and the comment's own token -- proving a comment written before the map changed still carries the OLD digest, so the token genuinely distinguishes map versions
- Two evidence transcripts committed under this phase's `evidence/` directory, each recording: the guard's/map's committed form, the observed wrong/differing result under the mutation, the spy call lists or digest values, the working-tree porcelain check (0 lines before and after), the date, and a closing note naming the encoding test file -- the provenance transcript additionally states explicitly that it is NOT one of the phase's six required controls, so a later reader does not miscount

## Task Commits

Each task was committed atomically:

1. **Task 1: Control -- removing the image-range check reddens the in-image skip** - `5c7078fd` (test)
2. **Task 2: Control -- a changed map produces a different provenance digest** - `c6f8e6bf` (test)

_Plan metadata (this SUMMARY, STATE.md, ROADMAP.md) lands in the final `docs(37-05):` commit per the workflow's `git_commit_metadata` step._

## Files Created/Modified

- `src/mcp/vice/join-image-controls.test.ts` - two planted-violation cases (in-image-skip deletion, provenance-drift append), each with its own scratch-tree helper
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-05-in-image-skip-red.md` - Task 1's transcript (both directions: committed skip, mutated wrong annotation; both spy call lists)
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-05-provenance-drift-red.md` - Task 2's transcript (both digests, the comment's token, the porcelain reading, and the explicit "not one of the six" statement)

## Decisions Made

- **The in-image control's subject is `$0800`, not a hardware register.** `AUTO-03`'s own failure story ("the first attempt annotated two ordinary loop-back branches as machine features") is about ordinary PROGRAM addresses the map merely happens to cover -- `$D020`/`$0000` (used elsewhere in this phase for AUTO-02's tie-break controls) are genuine hardware registers and would prove nothing about this specific failure mode. `$0800`'s real `memmap.json` entry ("Unused", 1 byte) gives a clean, specific, measurable wrong label.
- **Re-export shims instead of mirroring `anno-store.ts`'s full dependency chain.** Only `anno-join.ts` itself needed mutating for Task 1; its two sibling imports needed to resolve, not be reimplemented. A tiny `export * from "<absolute path>"` shim forwards to the real file, so the mutated join calls the exact same real store functions the rest of the test file uses statically (both resolve to the same cached ESM module instance) -- confirmed by hand before writing the test (see the exploratory transcripts this session ran, matching the committed evidence file's own numbers).
- **Split into two commits, incrementally extending one file, mirroring 37-04's own precedent.** Task 1's commit contains only the in-image-skip case and its own imports; Task 2's commit adds the provenance case and its own additional imports (`listComments`, `memmapDigest`, `PROVENANCE_TOKEN_PREFIX`, `REAL_MEMMAP_PATH`). Each commit was independently verified green before the next was added.

## Deviations from Plan

None - plan executed exactly as written. The re-export-shim approach for Task 1's scratch tree was hand-confirmed working (three exploratory runs, matching the committed evidence transcript's own numbers) before being encoded as the test's own helper -- this is the plan's own described mechanism ("the scratch tree must carry those siblings at the same relative positions"), satisfied by forwarding rather than by duplicating.

## Issues Encountered

One transient failure during the plan-level `npm run test:automated` verification: a first run showed 3 failures (the documented pre-existing pair in `anno-register.test.ts` plus one failure in `audit-root-args.test.ts`'s `check-skill-fork-honesty` case). Re-running `audit-root-args.test.ts` in isolation showed 58/58 pass, and a second full-suite run showed the clean, documented floor exactly (3470 tests / 3457 pass / 2 fail, both pre-existing in `anno-register.test.ts`) -- matching this project's own recorded memory that a full-glob run intermittently reddens on a `zz-scratch` ENOENT race unrelated to any particular plan's own files. Not a regression; the floor stays 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Four of the phase's six required observed-red controls are now committed transcripts and passing test cases (three from plan 37-04's `AUTO-02` controls, one from this plan's `AUTO-03` control); the remaining two (`AUTO-04`'s bank decode, `AUTO-05`'s path-dependent decline) are unaffected by this plan and remain for later plans in this phase, per `37-VALIDATION.md`'s own table
- `AUTO-08`'s provenance token is now defended by a real observed-red control in addition to plan 37-03's own passing (non-red) assertions
- No blockers.

## Self-Check: PASSED

- `src/mcp/vice/join-image-controls.test.ts` — FOUND
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-05-in-image-skip-red.md` — FOUND
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-05-provenance-drift-red.md` — FOUND
- Commit `5c7078fd` — FOUND in `git log --oneline --all`
- Commit `c6f8e6bf` — FOUND in `git log --oneline --all`
- Re-ran plan-level `<verification>`: `node --test join-image-controls.test.ts anno-join.test.ts memmap-lookup.test.ts` — 30/30 pass; `git status --porcelain` over `src/skills/c64-memory-mapping/memmap.json src/mcp/vice/anno-join.ts src/mcp/vice/memmap-lookup.ts` — 0 lines; `ls evidence/37-05-*.md | wc -l` — 2; `npm run test:automated` (broker confirmed absent via `ps -eo pid,cmd`) — 3470 tests / 3457 pass / 2 fail, both pre-existing in `anno-register.test.ts`

---
*Phase: 37-the-importer-and-the-automatic-annotation-join*
*Completed: 2026-09-05*
