---
phase: 43-the-runtime-evidence-layer
fixed_at: 2026-09-10T12:48:08Z
review_path: .planning/phases/43-the-runtime-evidence-layer/43-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 43: Code Review Fix Report

**Fixed at:** 2026-09-10T12:48:08Z
**Source review:** .planning/phases/43-the-runtime-evidence-layer/43-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, IN-01 -- `fix_scope: all`)
- Fixed: 2 (WR-01, WR-02)
- Skipped/declined: 1 (IN-01, declined with reason -- the guard it asks for already exists)

## Fixed Issues

### WR-01: `anno_evid_ingest`'s zero-observation path bypasses optimistic-concurrency (`base_revision`) checking

**Status:** fixed: requires human verification (classified as a logic/control-flow gap
in REVIEW.md -- concurrency-contract correctness, not a pure syntax defect. Full
automated suite passes with this change, including every EVID-01/EVID-04/EVID-05
test, but no NEW test was added asserting a stale `base_revision` is refused
specifically on the zero-observation path; a human should confirm the fix's exact
scenario before treating this as fully closed.)

**Files modified:** `src/mcp/vice/anno-tools.ts`
**Commit:** `12f856ed`
**Applied fix:** `dispatchEvidIngest`'s zero-observation early-return now calls
`applyWrite(handle, () => false, { baseRevision })` instead of returning
`currentRevision(handle)` directly. `applyWrite`'s own `runWriteSequence` checks
`baseRevision` against the current on-disk revision (throwing
`AnnoStoreStaleRevisionError`) before the no-op mutator ever runs, so a caller
supplying a stale `base_revision` on this path is now refused exactly as it would
be on every other write path in this store. `applyWrite` was added to
`anno-tools.ts`'s existing `anno-store.ts` import list; no other import changed.

### WR-02: `observationsWritten` is computed via a query outside the write transaction, so it can be wrong under a concurrent writer

**Status:** fixed: requires human verification (classified as a logic/TOCTOU gap
in REVIEW.md -- the rows written were always correct; only the reported count
could drift under a concurrent writer to the same run identity. Full automated
suite passes, including the existing EVID-01 idempotent-reingest and EVID-05
concurrent-planting tests, but no NEW test plants a concurrent writer between the
old read and the new count specifically to prove the fixed count no longer
drifts; a human should confirm the fix's exact concurrency scenario before
treating this as fully closed.)

**Files modified:** `src/mcp/vice/anno-store.ts`, `src/mcp/vice/anno-tools.ts`
**Commit:** `20969c37`
**Applied fix:** `insertExecObservations()` (`anno-store.ts`) now counts rows it
actually inserts row-by-row INSIDE its own `applyWrite` transaction (renamed its
local `anyInserted: boolean` accumulator to an `insertedCount: number` counter)
and returns that count as a new `insertedCount` field on a new
`InsertExecObservationsResult` interface (`AnnoWriteResult` extended with
`insertedCount`), rather than only a boolean `changed`.
`dispatchEvidIngest`'s (`anno-tools.ts`) non-empty-observations branch no longer
calls `listExecObservations()` before the write to derive `observationsWritten`
from a pre-write snapshot; it now reads `written.insertedCount` directly from
`insertExecObservations()`'s result, eliminating the TOCTOU window entirely. Both
functions' doc comments were updated to describe the new counting mechanism.

## Skipped Issues

### IN-01: `docs/phase43-runtime-evidence-layer.md`'s "one positive fact" section is worth double-checking against a future retrofit

**File:** `docs/phase43-runtime-evidence-layer.md:34-50`
**Reason:** Declined -- no code or test change made, and none is needed. The
finding's own Fix text says "No action required now," and on inspection the
structural guard it describes as missing already exists: it names
`anno-durability.test.ts:576` as the pattern to mirror ("consider a durability or
schema test asserting `anno_evid_exec`'s column set stays exactly the five
documented columns... mirroring `anno-durability.test.ts:576`'s existing 'carries
exactly the no-change run-identity column set' assertion"). Reading that exact
line shows the test at `anno-durability.test.ts:576` (`"SCHEMA_VERSION 4: a fresh
store carries anno_evid_exec with exactly the no-change run-identity column set,
all NOT NULL"`) is not an analogous test on a *different* table to mirror -- it
already runs `pragma table_info(anno_evid_exec)` and asserts (via
`assert.deepEqual` on the sorted column names) that the table carries EXACTLY
`["address", "argv_digest", "id", "image_sha256", "seed", "source_bank"]`, plus a
per-column `NOT NULL` check. A future retrofit adding nullable `read`/`write`
columns directly onto `anno_evid_exec` (the exact scenario IN-01 warns about)
would add entries to that `pragma table_info` result and fail this `deepEqual`
assertion outright -- the guard IN-01 asks for is already in place, at the exact
line the finding itself cites, and a second, duplicate assertion would be pure
overhead with the same fragility (a legitimately-growing schema pinning) this
project's own convention (assert relations, not counts) warns against elsewhere.
No source or test file was touched for this finding.
**Original issue:** No structural test today (analogous to
`evid-report-keys.test.ts`'s direction 4 for `RuntimeExecClass`) that would catch
a `read`/`write` column being added to `anno_evid_exec` itself, so a future
retrofit onto the existing table (rather than a new table) would not be
mechanically caught.

---

_Fixed: 2026-09-10T12:48:08Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
