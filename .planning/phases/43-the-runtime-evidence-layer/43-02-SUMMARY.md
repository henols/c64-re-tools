---
phase: 43-the-runtime-evidence-layer
plan: 02
subsystem: database
tags: [sqlite, node:sqlite, schema-migration, runtime-evidence, anno-store]

# Dependency graph
requires:
  - phase: 43-the-runtime-evidence-layer (plan 01)
    provides: "the run-identity schema decision (no-change: the bare (binary_sha256, argv_digest, seed) triple, no run_class column) and the EVID-06 no-perturbation verdict this plan's DDL is built from"
provides:
  - "SCHEMA_VERSION 4 with a recorded, dated, fact-checked reaffirm-refusal decision for EVID-02"
  - "anno_evid_exec: the durable per-address runtime-execution observation table (EVID-01), with insertExecObservations/listExecObservations/listObservedRuns/deleteExecObservationsForRun"
  - "a durability proof across a real process death for the new table, mirroring STORE-04's existing proof"
affects: [43-03, 43-04, 43-05, 43-06, 43-07]

# Actuals (#2632)
actuals:
  tokens: 15647
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A schema-version decision checkpoint's factual check and its outcome are transcribed verbatim into the versioned constant's own doc comment, in the same VERSION N paragraph register D-15 established -- never left in a planning directory"
    - "A `type` alias (not an `interface`) is required when casting node:sqlite's `Record<string, SQLOutputValue>[]` to a named raw-row shape -- TypeScript's type-assertion comparability check treats the two differently even though they are structurally identical"
    - "A test-only mutator's new mode reuses the SAME writer-selection tokens (`commit`/`no-commit`) an existing mode already defined, via one shared `pickWriter()` helper, rather than inventing a parallel vocabulary"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-store.test.ts
    - src/mcp/vice/anno-durability.test.ts
    - src/mcp/vice/anno-durability-mutator.mjs
    - src/mcp/vice/anno-types.test.ts
    - src/mcp/vice/anno-derive.test.ts

key-decisions:
  - "EVID-02: reaffirm-refusal. A version-3 .annostore does not open under SCHEMA_VERSION 4; no migration arm is written. Decided from a dated, four-part factual check (filesystem search, git history, release-tag dates, one-machine scope) transcribed into the SCHEMA_VERSION doc comment, which also corrects VERSION 3's now-stale \"no release has ever shipped a store\" framing and records the reversal condition for a future version-5 migration arm."
  - "The no-change run-identity composite plan 43-01 selected (image_sha256, argv_digest, seed -- no run_class) is the anno_evid_exec table's key, with no promote-branch fields added."
  - "The evidence table stores ONLY execute:true observations, one row per (identity, address, source_bank) -- never a row for read/write-only access -- matching 43-RESEARCH.md's Open Question 1 recommendation."

patterns-established:
  - "listObservedRuns returns { runs, denominator } rather than a bare array, so a caller can never form a count-only summary that implies the unobserved remainder is data (EVID-04)."

requirements-completed: [EVID-01, EVID-02]

coverage:
  - id: D1
    description: "SCHEMA_VERSION bumped to 4 with a VERSION 4 doc-comment paragraph recording the reaffirm-refusal decision, its dated four-part factual check, and the reversal condition for a future migration arm"
    requirement: "EVID-02"
    verification:
      - kind: unit
        ref: "anno-types.test.ts#SCHEMA_VERSION is 4, and the constant's own doc comment records EVID-02's reaffirm-refusal decision by name and by date"
        status: pass
      - kind: unit
        ref: "anno-durability.test.ts#SCHEMA_VERSION 4: a store whose anno_meta.schema_version is 3 is refused by name, naming both versions, with its bytes and mtime unchanged"
        status: pass
      - kind: unit
        ref: "anno-store.test.ts#EVID-02 concurrency: two parallel opens of a version-3 store both refuse by name, and neither writes anno_meta"
        status: pass
      - kind: unit
        ref: "anno-store.test.ts#EVID-02 idempotency: opening an already-version-4 store does not re-run the DDL and does not rewrite anno_meta"
        status: pass
    human_judgment: false
  - id: D2
    description: "anno_evid_exec added to the single DDL, with insertExecObservations/listExecObservations/listObservedRuns/deleteExecObservationsForRun, keyed by the no-change run-identity composite"
    requirement: "EVID-01"
    verification:
      - kind: unit
        ref: "anno-durability.test.ts#SCHEMA_VERSION 4: a fresh store carries anno_evid_exec with exactly the no-change run-identity column set, all NOT NULL"
        status: pass
      - kind: unit
        ref: "anno-store.test.ts#EVID-01: inserting the identical observation set twice for the same run identity reports changed:false on the second call and leaves the row count unchanged"
        status: pass
      - kind: unit
        ref: "anno-store.test.ts#EVID-05: deleteExecObservationsForRun for run identity A removes every row for A and leaves run identity B's rows readable and unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "One evidence observation survives a real SIGKILL with no clean close and reads back BY VALUE in a fresh process, and the same insert with the commit removed leaves no row (one planting, both halves fused)"
    requirement: "EVID-01"
    verification:
      - kind: unit
        ref: "anno-durability.test.ts#EVID-01/T-43-09: one evidence observation survives a real SIGKILL with no clean close and reads back BY VALUE via listExecObservations"
        status: pass
      - kind: unit
        ref: "anno-durability.test.ts#EVID-01/T-43-09's planted violation, through the SAME mutator mode: with the commit removed, the evidence insert leaves NO row"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every run summary carries an explicit denominator (ADDRESS_MAX - ADDRESS_MIN + 1, never a literal or a formed percentage), and the runtime class union has no data member"
    requirement: "EVID-01"
    verification:
      - kind: unit
        ref: "anno-store.test.ts#listObservedRuns returns one row per distinct run identity with the correct observationCount, and its summary carries a denominator naming the address-space size the counts are a fraction of"
        status: pass
      - kind: unit
        ref: "anno-store.ts toFixed census (this task's own acceptance criterion): grep -v comments | grep -c toFixed == 0"
        status: pass
    human_judgment: false

duration: ~50min (continuation session; Task 1's checkpoint decision and factual check were performed and recorded by a prior executor)
completed: 2026-09-10
status: complete
---

# Phase 43 Plan 2: The Runtime Evidence Table Summary

**`SCHEMA_VERSION` 4 adds `anno_evid_exec`, a durable per-address runtime-execution evidence table keyed by the bare `(image_sha256, argv_digest, seed)` triple, with a recorded, dated `reaffirm-refusal` decision for the version-3 schema gap and a proven-across-a-real-SIGKILL durability guarantee.**

## Performance

- **Duration:** ~50 min (continuation from a prior executor's Task 1 checkpoint; see Deviations)
- **Started:** unresumed exact time not captured by this continuation agent
- **Completed:** 2026-09-10T09:21:49Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- `SCHEMA_VERSION` bumped 3 -> 4, with a VERSION 4 doc-comment paragraph (matching the VERSION 1/VERSION 3 discipline) recording the `reaffirm-refusal` decision, its dated four-part factual check (filesystem search, git history, release-tag dates, one-machine scope), a correction to VERSION 3's now-stale "no release has ever shipped a store" claim, and the reversal condition for a future version-5 migration arm.
- `anno_evid_exec` added to the single `DDL`: `image_sha256`, `argv_digest`, `seed`, `address`, `source_bank`, unique across all five, no `bank` column, no nullable column, indexed on `address`.
- Four new store functions: `insertExecObservations` (one `applyWrite` callback, validates every field before the first statement, skips an already-present observation), `listExecObservations`, `listObservedRuns` (returns `{ runs, denominator }`), `deleteExecObservationsForRun` (the module's fifth row-deleting statement, a no-op-not-an-error bracket reset).
- `openStore`'s schema-version refusal message now names the remedy and states the refused file is left untouched, without using the literal word "migrate" (which would have falsely tripped `anno-seam.test.ts`'s no-migration-entry-point census).
- A durability proof for the new table, mirroring `STORE-04`'s existing proof exactly: a separate OS process inserts one evidence observation and `SIGKILL`s itself with no clean close; a fresh process reads the row back by value. The same insert with the commit removed (the mutator's `applyWriteWithoutCommit` planting) leaves no row -- one planting proving both halves are fused.
- A new fifth mode, `insert-evid`, added to `anno-durability-mutator.mjs`, reusing the exact `commit`/`no-commit` writer-selection tokens the existing range modes already use via a new shared `pickWriter()` helper.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration arm or re-affirmed strict-equality refusal at schema version 4** - `3c5daf1b` (docs)
2. **Task 2: One observation survives a process death end to end** - `82a72b04` (feat)
3. **Task 3: Bracket reset, idempotent re-ingest, and the denominator-carrying run listing** - `1cd3dbfc` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

_Note: Task 1 is a `type="checkpoint:decision"` task whose factual check and human decision were performed by a prior executor in an earlier session; this continuation agent verified no `43-02` commits existed yet, then transcribed the recorded decision into code and committed it as Task 1's own commit._

## Files Created/Modified
- `src/mcp/vice/anno-types.ts` - `SCHEMA_VERSION` -> 4 with its VERSION 4 doc-comment paragraph; new `EVID_SOURCE_BANKS`/`EvidSourceBank`, `RuntimeExecClass`, `EvidExecRow`, `ObservedRunRow`, `assertEvidSourceBank`/`assertRunIdentityDigest`/`assertRunIdentitySeed`
- `src/mcp/vice/anno-store.ts` - `anno_evid_exec` table + index in the single `DDL`; `insertExecObservations`/`listExecObservations`/`listObservedRuns`/`deleteExecObservationsForRun`; the schema-version refusal message now names the remedy and non-destructiveness
- `src/mcp/vice/anno-durability-mutator.mjs` - fifth mode `insert-evid`, `pickWriter()` helper, `mutateEvidence()`
- `src/mcp/vice/anno-durability.test.ts` - schema/table-shape tests, version-3 refusal (byte+mtime identical), the evidence durability proof and its planted no-commit counterpart
- `src/mcp/vice/anno-store.test.ts` - idempotent re-ingest, overlapping-larger re-ingest, bracket isolation, empty-bracket no-op reset, denominator relation, concurrent version-3 refusal (sha256 unchanged), already-version-4 no-op reopen
- `src/mcp/vice/anno-types.test.ts` - hand-pinned `SCHEMA_VERSION` assertion updated 3 -> 4 with new EVID-02 citations added beside the existing D-15 ones
- `src/mcp/vice/anno-derive.test.ts` - `STORE-06` never-cached control's declared expected SQL write-site set extended with the two new legitimate write sites

## Decisions Made
- **EVID-02: `reaffirm-refusal`.** See `key-decisions` above and `anno-types.ts`'s `SCHEMA_VERSION` doc comment for the full recorded reasoning, including the correction to VERSION 3's now-stale justification and the version-5 reversal condition.
- **Run-identity composite: no-change**, per plan 43-01's live A/B verdict (`no-perturbation`) -- `anno_evid_exec` carries no `run_class` column.
- **Only `execute:true` observations are stored** -- no row for read/write-only access, and no row at all for an address never observed, matching `43-RESEARCH.md`'s recommendation and the sparse-by-design discipline `textmon-memmap.ts` already established.
- **A `type` alias, not an `interface`**, for the raw SQLite row shape cast (`RawEvidExecRow`) -- a TypeScript comparability quirk this plan measured directly (a named interface fails the assertion comparability check against `node:sqlite`'s `Record<string, SQLOutputValue>[]`; a `type` alias to the identical shape succeeds).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The schema-version refusal message could not literally contain the word "migrate"**
- **Found during:** Task 2, first typecheck/test pass
- **Issue:** The checkpoint's condition 2 requires the refusal message to name a hand-remedy ("migrate its rows by hand"), but `anno-store.test.ts`'s existing D-15 single-witness structural test forbids the substring `migrate`/`migration` anywhere in the module's stripped-but-literal-kept source, as a guard against a migration arm entering quietly. My first wording tripped that guard.
- **Fix:** Reworded the refusal message to say "hand-copy its rows into a fresh store" instead of "migrate its rows by hand" -- same meaning, no banned substring.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** `node --test anno-store.test.ts` (the D-15 single-witness test) passes; the message still satisfies the checkpoint's naming-the-remedy requirement.
- **Committed in:** `82a72b04` (Task 2 commit)

**2. [Rule 1 - Bug] Two pre-existing pinned tests broke as a direct, foreseeable consequence of the schema bump**
- **Found during:** Task 2 (full-suite run) and Task 3 (full-suite verification pass)
- **Issue:** `anno-store.test.ts`'s CR-08 test pins the live store's exact byte size (81,920, D-15's own recorded figure) -- growing the DDL by one table and one index changed it to 94,208. `anno-types.test.ts` hand-pins `SCHEMA_VERSION === 3` by design (the file's own stated reason: "an edit to this number must be a decision"). `anno-derive.test.ts`'s `STORE-06` never-cached control declares its expected SQL write-site set by hand; `insertExecObservations` and `deleteExecObservationsForRun` are new, legitimate write sites it did not yet know about.
- **Fix:** Re-recorded the CR-08 byte count to 94,208 following the exact precedent D-15 already set for the 3->4 bump. Updated the hand-pinned `SCHEMA_VERSION` test to 4, adding EVID-02/`reaffirm-refusal`/2026-09-10 citations beside the D-15 citations it already carried. Added the two new function names to `EXPECTED_SQL_WRITE_SITES` with a comment explaining why they are legitimate (neither caches a derivation).
- **Files modified:** `src/mcp/vice/anno-store.test.ts`, `src/mcp/vice/anno-types.test.ts`, `src/mcp/vice/anno-derive.test.ts`
- **Verification:** Full `anno-store.test.ts` (105/105), `anno-types.test.ts`, and `anno-derive.test.ts` (29/29) suites pass; `npm run test:automated` returns to the documented 3-failure floor.
- **Committed in:** `82a72b04` (CR-08 and `SCHEMA_VERSION`) and `1cd3dbfc` (`anno-derive.test.ts`)

---

**Total deviations:** 2 auto-fixed (2 bugs, both direct consequences of this plan's own schema change, caught by the existing test suite exactly as it is designed to).
**Impact on plan:** Both fixes were necessary to keep the pre-existing test suite meaningful and green; neither changes scope. No scope creep.

## Issues Encountered
- `npm run test:automated` showed 5 failures on two separate runs during this session (the documented 3-failure floor plus 2 extra, both anchored at `audit-root-args.test.ts:982`) before a third run settled back to exactly the documented 3-failure floor. This matches 43-01's own recorded self-check pattern for the identical file/line and is an intermittent `zz-scratch`-adjacent race unrelated to this plan's changes (no scratch directories were touched by this plan, and no leftover scratch directories were found on disk after the run). Final verified state: `anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479` -- the documented floor, nothing outside it.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `anno_evid_exec` exists, is durable, and its full write/read/reset surface (`insertExecObservations`, `listExecObservations`, `listObservedRuns`, `deleteExecObservationsForRun`) is ready for plan 43-03's MCP-tool wiring (`anno_evid_*` verbs) and the `memmapshow`/`memmapzap` ingestion verb the research document scoped for a later plan.
- The reconciliation query (EVID-03, agreement/disagreement between the byte-derived block table and this new evidence table) has its input side ready: `listRanges()` (byte-derived) and `listExecObservations()`/`listObservedRuns()` (runtime-observed) are both available as plain-data read functions for a `dxa-proof01-compare.ts`-shaped pure join module.
- The `RuntimeExecClass` type-level control (`"code" | "unobserved"`, no `"data"` member) is in place for whatever later plan builds the runtime classifier itself.

---
*Phase: 43-the-runtime-evidence-layer*
*Completed: 2026-09-10*

## Self-Check: PASSED

- All key-files (modified) confirmed present on disk with `[ -f ]`.
- All three task commit hashes (`3c5daf1b`, `82a72b04`, `1cd3dbfc`) confirmed present in `git log --oneline --all`.
- All plan-level `<verification>` commands re-run and passing: `npm run typecheck` (clean), `node --test anno-durability.test.ts anno-seam.test.ts` (33/33), `node --test anno-store.test.ts` (105/105), the census (`export const DDL` = 1, `create table anno_evid_exec` = 1, `toFixed` outside comments = 0), and `npm run test:automated` (settled at the documented 3-failure floor after ruling out the intermittent `audit-root-args.test.ts:982` race).
- `pgrep -x x64sc` empty -- no live VICE broker was started or left running during this plan (purely SQLite/schema work, no live emulator interaction needed).
