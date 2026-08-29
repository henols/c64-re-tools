---
phase: 29-the-mcp-surface
plan: 06
subsystem: mcp-surface
tags: [mcp, annotation-store, tool-surface, batch-validation, idempotency, disassembly, derived-reads]

# Dependency graph
requires:
  - phase: 29-the-mcp-surface
    provides: "29-01's anno-tools.ts (ANNO_TOOL_DEFINITIONS, CURATED_ANNO_TOOLS, assertAnnoTool, runAnnoTool as the never-throw boundary); 29-03's applyEnumUsage/clearEnumUsage/listEnumUsage at SCHEMA_VERSION 3; 29-04's anno-derive.ts (crossReferencesTo, searchAnnotations) and anno-details.ts (composeAddressDetails); 29-05's renamed anno-* modules"
  - phase: 28-the-store-core
    provides: "anno-store.ts's write and read entry points, anno-types.ts's assertion family, prg-image.ts, disasm-decoder.ts, disasm-renderer.ts"
provides:
  - "The COMPLETE 19-verb anno_* surface: every verb the Phase 19 manifest classifies curated has a route, the one adapt-to-address-input verb is folded into anno_disassemble's explicit address argument, every omit verb is absent, and delete_project_enum is not carried"
  - "One per-verb argument validator per verb, reached through the single assertVerbArgs() dispatch that BOTH the outer allow-list gate and the batch pre-validator call"
  - "anno_batch_execute: recursive, depth-capped, whole-batch pre-validation before any store is opened, then per-item execution status that never aborts on the first failure"
  - "ANNO_READ_REGION_MAX_BYTES + ANNO_READ_REGION_MAX_BYTES_ENV — ONE byte cap governing both the region view and the disassemble view, read at call time"
  - "ANNO_MAX_BATCH_DEPTH and assertAnnoBatch(), exported"
  - "AnnoRegionRangeError — its own class, so an over-cap range is distinguishable from every other argument refusal without substring-matching"
  - "anno-store.ts's removeScope() — addScope's inverse (F-5 / WR-28), so a transposed span is recoverable without spending the 32-revision snapshot ring"
  - "A structural proof that no identifier, schema property or dispatch branch on the surface names a cursor or a current address (D-09), asserted over the comment-and-string-stripped source with a positive control that the header still explains the absence"
affects: [29-07, 29-08, 29-09, 29-10, 29-11, 29-12]

actuals:
  tokens: 96388
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One validator per verb, reached through ONE dispatch that both the outer gate and the batch pre-validator call — a verb cannot be validated on one route and waved through on the other"
    - "Two-phase batch: whole-batch pre-validation before anything opens, then a loop that runs to completion with per-item status; isError:true and an error ENTRY answer two different questions"
    - "Two refusal channels: an invalid argument is isError:true naming the AnnoStoreError subclass; a well-formed-but-unanswerable request is isError:false carrying {available:false, reason} with reason >= 40 characters"
    - "A disclosure that rides on a SUCCESS is a named top-level field present even when empty, so a caller reads it unconditionally rather than guarding on absence"
    - "Non-creating writable open: existence refusal by name plus an inode-identity guard, because openStore's mustExist also forces a read-only connection and there is no third state to ask for"
    - "The caller's own argument bag is passed through to a module that detects unsupported requests by scanning for keys it does not recognise — reconstructing the request would drop exactly that signal"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-tools.test.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-derive.test.ts

key-decisions:
  - "anno_get_blocks carries an optional `include` array (scopes / enums / enum_usage) rather than the surface growing separate project-enum and enum-usage reader verbs. Task 1's action names five readers, but the phase's own canonical roll-up (29-08-PLAN.md) fixes the surface at exactly 19 tool names, and 29-08's derivation check requires every unclassified surface verb to have a committed register entry — two extra verbs would have failed that check against a register that does not anticipate them. The read routes exist; the verb count is the one the phase declared."
  - "A write verb cannot use openStore's mustExist, because that option deliberately bundles the absent-path refusal with a read-only connection. The refusal is therefore made in anno-tools.ts by name, and the residual unlink-between-check-and-open window that mustExist's read-only open would have closed is closed by comparing the store file's inode across the open."
  - "removeScope() was added to anno-store.ts even though that file is outside the plan's files_modified. F-5 requires anno_remove_scope, no inverse existed anywhere in the store, and anno-tools.ts must never issue SQL of its own — so the inverse had to land in the one seam that owns writes."
  - "anno_save_project is routed HONESTLY rather than refused: it opens, reads currentRevision(), closes, and returns the revision with a body stating that it performed no write and that durability is already the store's. Returning {available:false} was rejected — a permanent refusal for a `curated` disposition is what `omit` is for, and the manifest does not say omit."
  - "anno_search answers a request naming an unsupported corpus with a refusal-shaped body ONLY — no hit list rides alongside. A partial result set beside {available:false} would read as the complete answer to the question actually asked."
  - "base_revision refusals throw anno-types.ts's exported AnnoRevisionArgumentError rather than a fourth class, because anno-store.ts's own assertRevisionArgument is module-private and WR-22 requires a caller to tell 'you passed the wrong thing' from 'the annotations are gone' BY CLASS."
  - "The batch names its store (and image) once at the top level and every inner call inherits it; an inner `store` is overridden, never honoured — proved by asserting the inner call's named store file is never even created."

patterns-established:
  - "Shared-validator discipline made structural: assertVerbArgs() is the ONE per-verb dispatch, so the batch route cannot drift from the direct route"
  - "Depth-capped recursion over an attacker-shaped payload, refused BY NAME past the cap rather than walked (the analog's recursion was unbounded and safe only because a spawn cost dominated)"
  - "An empty collection argument is a refusal, not a zero-length success — the ambiguous-request case of the plausible-looking-zero prohibition"
  - "Structural guards asserted over comment-and-string-stripped source, with a positive control that the prose explaining the absence still exists — so the explanation cannot satisfy the check"
  - "A guard that catches a legitimate new write site is the guard working: anno-derive.test.ts's named SQL-write-site set was extended, with the reason recorded in the set's own doc block"

requirements-completed: [MCP-01, MCP-04]

coverage:
  - id: D1
    description: "The twelve write and stored-read verbs answer over the existing store functions, each requiring an explicit store, with edits idempotent"
    requirement: MCP-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#a repeated identical anno_set_label_name SUCCEEDS reporting changed:false -- an annotation pass re-run is not an error"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation"
        status: pass
    human_judgment: false
  - id: D2
    description: "F-4 discharged: anno_set_data_type's successful body carries both contradictedComments and reinterpretedSplitTables as named top-level fields, present even when empty"
    requirement: MCP-04
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables"
        status: pass
    human_judgment: false
  - id: D3
    description: "F-5 discharged: addScope's overlap refusal has an inverse, so a transposed span is recoverable without spending the 32-revision snapshot ring"
    requirement: MCP-04
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-derive.test.ts#STORE-06 never-cached control: the tree's SQL write sites are exactly the named expected set"
        status: pass
    human_judgment: false
  - id: D4
    description: "anno_save_project reports the revision and performs no write, and says so in its own body"
    requirement: MCP-01
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after"
        status: pass
    human_judgment: false
  - id: D5
    description: "The six derived and composed read verbs answer from the bytes, each naming its own image explicitly (D-07)"
    requirement: MCP-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#anno_get_address_details returns the composition with its composed_from disclosure intact"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-09: addressing is by explicit address everywhere, and no cursor or current-address concept exists anywhere on the surface"
    requirement: MCP-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)"
        status: pass
    human_judgment: false
  - id: D7
    description: "ONE byte cap governs both the region and disassemble views, read at call time, refusing by name with the cap and the requested width; max_results is required with no default and the true total rides beside the truncated list"
    requirement: MCP-04
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total"
        status: pass
    human_judgment: false
  - id: D8
    description: "A well-formed request this surface cannot answer returns {available:false, reason} in a successful body, never isError:true and never an empty result set"
    requirement: MCP-04
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short"
        status: pass
    human_judgment: false
  - id: D9
    description: "anno_batch_execute pre-validates recursively and depth-capped, refusing the whole batch by index before anything is opened"
    requirement: MCP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#the six whole-batch refusal shapes, each naming what it refused on"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible"
        status: pass
    human_judgment: false
  - id: D10
    description: "Batch execution runs to completion with a per-item status for every entry and never aborts on the first failure"
    requirement: MCP-04
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order"
        status: pass
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair"
        status: pass
    human_judgment: false

# Metrics
duration: 71 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 06: The Complete `anno_*` Tool Surface Summary

**All nineteen `anno_*` verbs now answer over the owned annotation store — write, stored-read, derived-read and batch — with edits idempotent, the split-table disclosure surfaced, the scope refusal given an inverse, one byte cap over both views, and a depth-capped whole-batch pre-validator that runs before anything opens.**

## Performance

- **Duration:** 71 min
- **Tasks:** 3 of 3
- **Files modified:** 4
- **Commits:** 3 (one per task)

## Accomplishments

- **The surface is complete and derived, not chosen.** All 15 verbs the Phase 19 manifest classifies `curated` have a route; the one `adapt-to-address-input` verb (`get_disassembly_cursor`) is folded into `anno_disassemble`'s explicit `address` argument; all 4 `omit` verbs are absent; and `delete_project_enum` — the one verb with zero callers anywhere — is not carried. `anno_search`, `anno_add_scope`, `anno_remove_scope` and `anno_update_project_enum` are the four verbs the register (29-08) will carry, exactly as the phase planned.
- **Every argument rule is the store's own, called rather than copied.** Addresses go through `parseStoreAddress`, ranges through `assertRangeShape`, data types through `assertDataType`, label names through `assertLegalLabel`, comment text through `assertCommentText`, enum names through `assertEnumName`. A structural guard asserts this over the stripped source and additionally pins that case folding appears in exactly one place — the file-extension normalization — so a sanitizing implementation cannot slip in as a "cleanup".
- **F-4 discharged where the human actually reads.** `anno_set_data_type`'s successful body carries `contradictedComments` and `reinterpretedSplitTables` as named top-level fields, present even when empty, so a caller reads them unconditionally. A single test exercises one call that both fragments a four-entry split table and falsifies a `[confirmed-code]` comment inside it.
- **F-5 discharged in the same phase as the refusal it fixes.** `anno-store.ts` gained `removeScope()` and the surface gained `anno_remove_scope`. The test reproduces 28-REVIEW's exact scenario — `anno_add_scope($1000, $ffff)`, one transposed end — shows every later scope above that start refusing, then removes it and shows the intended scope becoming addable again, with no revert and no snapshot spent.
- **The batch verb is two phases and says so.** Phase one refuses the WHOLE batch, before any store opens, on six shapes each naming what it refused on; phase two runs to completion pushing a per-entry status and never aborting on the first failure. The header states that `isError:true` means "this batch should never have been sent" and an error ENTRY means "this call in the batch did not work", and both are proven: a refused batch leaves the revision unchanged with no partial write, while a three-call batch whose middle call fails returns three entries in order and the third call really did land.

## Task Commits

1. **Task 1: The write and stored-read verbs, over the store functions that already exist** — `a8126be` (feat)
2. **Task 2: The derived and composed read verbs, with the caps that keep a result answerable** — `9a2d111` (feat)
3. **Task 3: The batch verb — whole-batch pre-validation with a depth cap, then per-item execution status** — `84b7d67` (feat)

## Files Created/Modified

- `src/mcp/vice/anno-tools.ts` — grew from one tracer verb to the full 19-verb table, its per-verb validators, the single `assertVerbArgs()` dispatch, the image loader, the region/disassemble cap, `assertAnnoBatch()` and the two-phase batch runner. The header now records D-07, D-09, the two refusal channels, and the one-sanctioned-nested-argument-verb rule.
- `src/mcp/vice/anno-tools.test.ts` — 30 new tests across the three tasks, including the ported `r2000-tools.test.ts` batch cases and a shared single-pass comment-and-string stripper used by every structural guard.
- `src/mcp/vice/anno-store.ts` — `removeScope()`, the module's fourth row-deleting statement, with its doc block superseding `clearEnumUsage`'s "third" count and stating the new one in prose that deliberately does not spell the SQL prefix a census greps for.
- `src/mcp/vice/anno-derive.test.ts` — the named SQL-write-site expected set gained `anno-store.ts#removeScope`, with the reason recorded in the set's own doc block.

## Decisions Made

See `key-decisions` in the frontmatter. The three that a later reader is most likely to mistake for oversights:

1. **`anno_get_blocks` carries an `include` option instead of the surface growing two more verbs.** Task 1's `<action>` names "the symbol, comment, block, project-enum and enum-usage readers". The phase's own canonical roll-up in `29-08-PLAN.md` fixes the surface at exactly 19 tool names and does not list a project-enum or enum-usage reader; 29-08's derivation check additionally requires every unclassified surface verb to carry a committed register entry, and a register written before those verbs existed would fail against them. So the read routes exist — `include: ["scopes","enums","enum_usage"]` — and the verb count is the one the phase declared. The scopes reader in particular is load-bearing: `anno_remove_scope` requires an exact span match, and its description points at this route for finding it.
2. **`anno_save_project` reports rather than writes, and its own body says so.** This is C-2 executed as planned, and it is exactly the shape a later reader would read as an unfinished verb. The note in the result body exists to stop that reading at the point of use rather than only in a decision register.
3. **A write verb cannot use `openStore`'s `mustExist`.** That option's two halves — refuse an absent path, open read-only — are inseparable by design, and the second half makes it unusable for a write. The refusal moved up into `anno-tools.ts`, and the window `mustExist`'s read-only open was closing is now closed by inode identity across the open.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] `removeScope()` did not exist in the store**

- **Found during:** Task 1
- **Issue:** The plan requires `anno_remove_scope` as F-5's inverse and lists only `anno-tools.ts` / `anno-tools.test.ts` in `files_modified`. No `removeScope` existed anywhere in `anno-store.ts`, and `anno-tools.ts` must never issue SQL of its own (`STORE-07`: every write lives in the one seam). Without the store function the verb cannot exist, and F-5's whole point is that the inverse ships in the same phase as the refusal.
- **Fix:** Added `removeScope()` to `anno-store.ts`, modelled on `clearEnumUsage`'s shape: exact-span match, accepted no-op reporting `changed:false` when there is nothing to remove, inside the existing write sequence's transaction. Its doc block records why it exists (WR-28 / 28-REVIEW:1788-1814), why the span must match exactly (a partial removal would leave a shape nothing downstream can express while reporting success), and supersedes `clearEnumUsage`'s "third row-deleting statement" count.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** `anno-tools.test.ts#F-5: a transposed scope span is refused...` reproduces 28-REVIEW's scenario end to end; `anno-store.test.ts`, `anno-overlap.test.ts` and `anno-durability.test.ts` all green.
- **Committed in:** `a8126be`

**2. [Rule 3 — Blocking issue] `anno-derive.test.ts`'s named SQL-write-site set went red on the new write site**

- **Found during:** Task 1
- **Issue:** `STORE-06`'s never-cached control enumerates every SQL write site in the tree by file-and-declaration and asserts set equality. `removeScope` is a genuinely new write site, so the control went red — which is the control working, not a false positive.
- **Fix:** Added `anno-store.ts#removeScope` to `EXPECTED_SQL_WRITE_SITES` and extended the set's doc block to record which plan added it and why, matching how the block already records 29-03's two additions. The entry is on a WRITE path in the one WRITE seam, so the control's actual claim — that no derived read ever writes — is unchanged.
- **Files modified:** `src/mcp/vice/anno-derive.test.ts`
- **Verification:** `anno-derive.test.ts` green (63 tests with `anno-tools.test.ts`).
- **Committed in:** `a8126be`

**3. [Rule 1 — Bug] Write verbs opened the store read-only**

- **Found during:** Task 1
- **Issue:** The tracer's runner opened with `mustExist: true`, which `openStore` deliberately implements as a `readOnly` connection. Every write verb failed with `attempt to write a readonly database` — a real bug introduced by extending a read-only runner to write verbs, not a test artefact.
- **Fix:** The absent-store refusal was moved into `anno-tools.ts` as `assertStorePresent()`, naming the store by path and stating that "gone" and "empty" must not read the same; `mustExist` is now passed only for the read-only verbs (`READ_ONLY_ANNO_VERBS`). The residual unlink-between-check-and-open window that `mustExist`'s read-only open was closing is closed by `assertSameFile()`, comparing the store file's inode across the open, so a replaced file is a named refusal rather than a store the call invented and wrote into.
- **Files modified:** `src/mcp/vice/anno-tools.ts`
- **Verification:** All twelve Task 1 verbs write successfully; the pre-existing "an absent store is refused, never created" test still passes; the single-`openStore`-call-site and `closeStore`-in-a-`finally` structural guards still pass.
- **Committed in:** `a8126be`

**4. [Rule 1 — Bug] `anno_search` dropped the unsupported-corpus signal by reconstructing the request**

- **Found during:** Task 2
- **Issue:** `dispatchSearch` built a fresh request object from the three flags it knew about. `searchAnnotations` detects a corpus this surface does not have by scanning the request's own keys for `search_<name>` it does not recognise — so a caller passing `search_strings: true` got a clean, plausible, complete-looking hit list for a corpus that was never searched. That is precisely the plausible-looking zero MCP-04 exists against, produced by this layer rather than by the store.
- **Fix:** The caller's own bag is now spread through, with the validated `query` and `max_results` re-stated last so they win. A comment records why reconstruction is forbidden here.
- **Files modified:** `src/mcp/vice/anno-tools.ts`
- **Verification:** `anno-tools.test.ts#anno_search naming a corpus this surface does not have answers {available:false, reason}...` asserts `available:false`, a reason of at least 40 characters, the named corpus, and that no hit list rides alongside.
- **Committed in:** `9a2d111`

---

**Total deviations:** 4 auto-fixed (1 × Rule 1 blocking correctness, 1 × Rule 1 correctness-of-the-answer, 1 × Rule 2 missing critical functionality, 1 × Rule 3 blocking guard). **Impact on plan:** No scope creep. Two touched files outside `files_modified` (`anno-store.ts`, `anno-derive.test.ts`), both forced by the plan's own F-5 obligation and by the guard that correctly caught it. All three plan tasks completed as written.

## Issues Encountered

- **The structural guard against re-implemented argument rules initially forbade `toLowerCase()` outright**, which caught the file-extension normalization in the image loader — a legitimate use copied from `anno-cli.ts`'s own dispatch discipline. The guard was narrowed rather than dropped: case folding must appear **exactly once**, and that one site must be an `extname(...).toLowerCase()`. It still forbids folding a label, enum or comment argument, which is what T-29-23 is about.
- **`anno_disassemble`'s default extent had to be the cap, not the image.** An omitted `end_address` defaults to `address + cap - 1` clamped to the last byte of the image, so the default is the bound. A default of "the whole image" would have made the cap opt-in, which is the hazard rather than the mitigation.

## Verification Results

| Check | Result |
|---|---|
| `node --test anno-tools.test.ts anno-derive.test.ts anno-store.test.ts anno-types.test.ts stock-dispatch.test.ts` | **green** — 0 fail |
| `npm run typecheck` | **clean** |
| `node scripts/check-npm-packages.mjs` | **OK** — `@henols/vice-mcp` 83 files, `@henols/c64-re-tools` 34 files / 7 skills |
| `node scripts/check-no-regenerator2000.mjs` | **exit 0** — allow-list unchanged (29-07: 27, 29-09: 65, 29-10: 167, 29-12: 4) |
| `node scripts/generate-tool-support-table.mjs` | **no drift** — `docs/tool-support.md` unchanged; the `anno_*` family is proxy-local and not in either backend manifest |
| Regression sweep (`anno-seam`, `anno-confinement`, `anno-durability`, `anno-overlap`, `anno-index`, `anno-derivation`, `hostpath-consumers`, `module-classification`, `capability-registry`, `docs-linerefs`, `spawn-seam`, `tool-support-table`) | **green** — 0 fail |
| `npm run test:automated` | **failing FILE set unchanged**: `{r2000-session.test.ts}` — 6 failures under load, 5 in isolation (re-measured this run), matching `29-BASELINE.md`'s recorded load-sensitive character. `audit-integrity.test.ts` remains out of the set, as 29-05 recorded. No new file entered the set. |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **29-07, 29-08, 29-09, 29-10, 29-11, 29-12 are unblocked.** The surface is complete in one plan, which is exactly what 29-08's derivation check needs: it can now assert against a finished `ANNO_TOOL_DEFINITIONS` without depending on a same-wave sibling.
- **What 29-08 must carry in the D-08 register**, each with a named consumer and requirement id: `anno_search` (`STORE-06`), `anno_add_scope`, `anno_update_project_enum`, and `anno_remove_scope` (cited to `28-VERIFICATION.md` WR-28 / `28-REVIEW.md:1788-1814`). All four are on the surface and none appears in any manifest procedure.
- **Exported names 29-08 and 29-11 will want:** `ANNO_TOOL_DEFINITIONS`, `CURATED_ANNO_TOOLS`, `assertAnnoTool`, `assertAnnoBatch`, `runAnnoTool`, `ANNO_READ_REGION_MAX_BYTES`, `ANNO_READ_REGION_MAX_BYTES_ENV`, `ANNO_MAX_BATCH_DEPTH`, `AnnoUncuratedToolError`, `AnnoToolArgumentError`, `AnnoRegionRangeError`.
- **Carried forward unchanged, and NOT closed by anything here** (28-18 P3 forbids closing, dropping or re-filing them): `openStore`'s `integrity_check could not be run at all` throw arm remains `behavior_unverified` with no reachable input absent fault injection, and 28-17's host-crash durability bound across `stageSnapshot` fsync → `publishSnapshot` rename → pointer-row commit remains abstained as `insufficient_spec`. Nothing in this plan touches either: `removeScope` runs inside the existing write sequence's transaction and adds no new durability claim.
- **One note for 29-10:** `r2000-tools.test.ts`'s batch cases are now ported into `anno-tools.test.ts`, so deleting that file loses no D-33 coverage.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*

## Self-Check: PASSED

- All four modified files present on disk.
- All three task commits present in `git log`: `a8126be`, `9a2d111`, `84b7d67`.
- Every task's `<acceptance_criteria>` re-run and green (see Verification Results).
- Plan-level `<verification>` commands re-run: test suites green, typecheck clean, `check-npm-packages.mjs` OK, `check-no-regenerator2000.mjs` exit 0, `test:automated` failing FILE set unchanged against `29-BASELINE.md`.
