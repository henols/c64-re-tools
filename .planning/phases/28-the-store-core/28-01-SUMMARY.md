---
phase: 28-the-store-core
plan: 01
subsystem: database
tags: [node-sqlite, sqlite, annotation-store, structural-guard, single-seam, 6502]

# Dependency graph
requires:
  - phase: 27-shared-seams-extracted
    provides: "shipped-modules.ts's shippedTsModules() and codeOnly(keepLiteralBodies) — the derived shipped module set every structural guard scans, and the literal-bodies-kept stripper an import-specifier assertion needs"
  - phase: 27-shared-seams-extracted
    provides: "block-class.ts and prg-image.ts as the header and structural-test conventions for a new prefix-free shipped module"
provides:
  - "anno-types.ts — the frozen 12-member data-type vocabulary, the four derived split layouts, the inclusive-both-ends RangeRow, the four validators, and the named AnnoStoreError family over ViceError"
  - "anno-index.ts — the pure narrowest-range-wins paint index over the 64K address space, rebuilt from rows, with the equal-length tie-break pinned explicitly"
  - "anno-store.ts — the ONE module in the tree that names node:sqlite: the full DDL at SCHEMA_VERSION 1, the corrupt-file refusal SQLite will not give, the revision compare-and-swap, the vacuum-into snapshot, split-and-preserve retype, and snapshot revert"
  - "anno-seam.test.ts — STORE-07's structural single-seam assertion, four planted access routes through one shared predicate, the comment-only negative control, the non-vacuity pairing, and the seam's extension-API / mutable-state / single-commit properties"
  - "anno-types.test.ts — the committed hand-written freeze of the milestone's one irreversible decision"
  - "an on-disk .annostore format with a snapshots/ sibling directory holding r<revision>.db"
affects: [28-02, 28-03, 28-04, 28-05, 28-06, "the MCP annotation surface", "ACME export", "coverage census"]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate:
# chars/4 over the files actually changed (90,085 chars over 7 files).
actuals:
  tokens: 22521
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: ["node:sqlite (Node builtin, DatabaseSync) — zero package-manager installs"]
  patterns:
    - "single persistence seam, asserted structurally over the shipped module set rather than promised in a header"
    - "frozen vocabulary written down once, with derived projections instead of a second literal list"
    - "hand-written pin for 'did the one home change'; derived cross-check for 'do two homes agree'"
    - "pure index taking rows as an argument, so the resolution rule is reachable with inputs the write path can never produce"
    - "snapshot before mutation, pointer row inside the mutation's own transaction"

key-files:
  created:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-index.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-types.test.ts
    - src/mcp/vice/anno-seam.test.ts
    - src/mcp/vice/anno-store.test.ts
  modified:
    - src/mcp/vice/package.json

key-decisions:
  - "Data-type vocabulary frozen at twelve members with all four split-table layouts first-class — the phase's one irreversible decision, taken at the plan's decision gate"
  - "parseStoreAddress owns the string address forms only; assertRangeShape owns range-ness for both forms, so a boundary refusal is an AnnoRangeShapeError"
  - "The commit statement is centralised in one private helper shared by first-open init and the write sequence, keeping exactly one planted-violation site"
  - "The node:sqlite detector is one substring test over literal-bodies-kept stripped source, trading the string-literal half of the negative control for coverage of all four access routes"
  - "The seam's module-level-mutable-state scan is anchored at column zero, keeping block-class.test.ts's const-mutable-container half in full"
  - "No import path from .regen2000proj is built, and none is owed"

patterns-established:
  - "Single seam + planted violations: one named predicate shared by the real scan and every planting, so the guard and its own proof cannot drift"
  - "Non-vacuity pairing: deepEqual against the expected list AND an explicit length assertion, plus a separate assertion that the scanned set is real"
  - "Refusal messages embed the offending value AND the valid range or form"
  - "Requirement ids in headers and messages; never a phase number in a comment assignment shape or in any string literal"

requirements-completed: [STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-07]

coverage:
  - id: D1
    description: "The data-type vocabulary is frozen at exactly twelve members in the r2000_set_data_type schema's own order and spelling, with the four split layouts derived rather than re-typed, and both arrays frozen"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#DATA_TYPES is exactly the twelve members, in the schema's own order and spelling, and is frozen"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#SPLIT_DATA_TYPES is exactly the four split layouts, frozen, and every member of it is also a member of DATA_TYPES"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#the twelve members are pairwise distinct and none contains the substring r2000, so the rented-analyser removal gate (CUT-02) is unaffected by the vocabulary"
        status: pass
      - kind: other
        ref: "planted violation OBSERVED: swapping lo_hi_address and hi_lo_address in DATA_TYPES reddened 2 of 3 tests; reverted before commit 5e1903f"
        status: pass
    human_judgment: false
  - id: D2
    description: "A store at a workspace-confined path carries one lo_hi_address range across a close and a reopen with the row readable BY VALUE, the paint index resolves it at an interior address, and revertTo(0) returns the prior empty state"
    requirement: "STORE-01"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#the store vertical: type $0810-$084F as lo_hi_address, close, reopen a FRESH handle, and read the row back BY VALUE -- then revertTo(0) returns the prior value"
        status: pass
    human_judgment: false
  - id: D3
    description: "Boundary and empty-input behaviour: a range ending at 0xFFFF is accepted and resolves at 0xFFFF; a start or endInclusive of 0x10000 or -1 is refused with AnnoRangeShapeError naming the offending value and the valid 0..65535 range; a $0400-$0400 range is one byte long; an empty store's index resolves NO_ROW at all 65,536 addresses"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#boundary: a range ending at 0xFFFF is accepted and resolves at 0xFFFF"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#boundary: a start or endInclusive of 0x10000 or -1 is refused with AnnoRangeShapeError naming the offending value and the valid range"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#empty input: on an empty store every list function returns [] and the index resolves NO_ROW at all 65,536 addresses"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#the range length rule is endInclusive - start + 1: a $0400-$0400 range is one byte long"
        status: pass
    human_judgment: false
  - id: D4
    description: "node:sqlite is named by exactly one module of the shipped module set, and all four of its working access routes (single-line static, multi-line static, dynamic import(), process.getBuiltinModule) are proven catchable by the one predicate the real scan calls; a comment-only mention is proven NOT reported; the scanned set is proven non-empty and to contain the three new modules"
    requirement: "STORE-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#node:sqlite is named by exactly one module of the shipped module set (STORE-07)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#planted violation, route (a/b/c/d) — four separate tests, all through namesNodeSqlite()"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#negative control: a source whose ONLY mention of the specifier is inside a // comment is NOT reported"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#non-vacuity: the scanned shipped module set is non-empty and contains all three new modules"
        status: pass
      - kind: other
        ref: "planted violation OBSERVED: a real static node:sqlite import added to anno-index.ts reddened the single-seam assertion (11 pass / 1 fail); reverted before commit 5e1903f"
        status: pass
    human_judgment: false
  - id: D5
    description: "The store refuses a file that is not a store: a zero-length file, a non-database file, a foreign schema_version (refusal naming both versions), and a mid-file truncation are each refused with AnnoStoreCorruptError instead of opening as a pristine empty database"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a zero-length store file is REFUSED with AnnoStoreCorruptError instead of opening as a pristine empty database"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a store file whose schema_version is not this build's is refused, and the refusal names both versions"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a store truncated mid-file is refused rather than read -- and integrity_check reports exactly one row reading ok on a healthy one"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a file that is not a database at all is refused"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every accepted write advances anno_meta.revision by exactly one through a compare-and-swap guarded on the revision the caller read, inside begin immediate, ending at exactly one commit statement; a write based on a stale revision is refused with both numbers and does not advance the revision"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#every accepted write advances the revision by exactly one, and a write based on a stale revision is refused with both numbers"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the revision compare-and-swap is structurally intact: begin immediate, an UPDATE guarded on the current revision, and a changes count that must equal 1"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the seam contains exactly one commit statement, so the single planted-violation site is unique"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every anno_range, anno_label, anno_comment and anno_xref row carries a nullable, uninterpreted bank column and every row written today has it null; anno_xref exists with access_kind from the first write; the store creates no virtual table and no FTS5 table"
    requirement: "STORE-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#the reserved bank column exists and is nullable on all four annotated tables, and every row written today has it null"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#anno_xref exists with its access_kind column from the first write, and the store creates NO FTS5 virtual table"
        status: pass
    human_judgment: false
  - id: D8
    description: "The scan is idempotent (a pure function of the shipped set and the files' contents, no cached state between runs) and the seam holds no module-level mutable state, so every DatabaseSync handle is owned by its caller"
    requirement: "STORE-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#idempotency: re-running the scan over an unchanged tree yields the identical one-element importer list"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the seam declares no module-level mutable binding, including a const bound to a mutable container"
        status: pass
    human_judgment: false
  - id: D9
    description: "The default `delete` journal mode is the decision and nothing sets it — pragma journal_mode on a freshly created store reads delete, so no persistent -wal/-shm sidecar can be inherited by a later connection"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#pragma journal_mode on a freshly created store reads delete -- the default is the decision, and nothing sets it"
        status: pass
    human_judgment: false
  - id: D10
    description: "The store path is confined to a supplied workspace root, boundary-safely (a sibling directory whose name merely starts with the root's name is refused), and the store never imports either host/container path-translation seam"
    requirement: "STORE-07"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#a store path resolving outside the supplied workspace root is refused with AnnoStorePathError"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hostpath-consumers.test.ts#hostpath.ts's production consumer set is exactly the five declared modules"
        status: pass
    human_judgment: false
  - id: D11
    description: "Split-and-preserve retype: an overlapping row's surviving head and tail are re-inserted with their original type, so the fully-contained case does not lose bytes"
    requirement: "STORE-02"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts — the no-overlap path only (a single range typed into an empty store)"
        status: pass
    human_judgment: true
    rationale: "The five overlap cases — and the fully-contained case that is the sole detector for a filter()-and-insert implementation — are IMPLEMENTED here but proven in a later plan of this phase, which owns STORE-02's total-typed-bytes invariant. This plan's tracer exercises only the no-overlap path, so the overlap behaviour is unverified code as of this SUMMARY and must not be read as proven."
  - id: D12
    description: "revertTo restores the whole store to a snapshot revision atomically (staging copy, fsync file and directory, rename, fsync directory), returning a fresh handle"
    requirement: "STORE-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-store.test.ts#the store vertical: ... revertTo(0) returns the prior value"
        status: pass
    human_judgment: true
    rationale: "The in-process revert is proven. The cross-process durability half of STORE-04 — mutate, SIGKILL, reopen in a fresh OS process, read back BY VALUE, then revert in the same test — is a later plan's combined proof and is NOT exercised here. Snapshot pruning to MAX_SNAPSHOT_REVISIONS is likewise declared but not enforced yet (see Deliberately Deferred)."

# Metrics
duration: 21 min
completed: 2026-08-27
status: complete
---

# Phase 28 Plan 01: The Store Core Summary

**A working `.annostore` on disk: `node:sqlite` behind one structurally-asserted seam, a frozen twelve-member type vocabulary, and one `lo_hi_address` range that survives a close and a reopen readable by value, with `revertTo(0)` restoring the prior state.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-27T12:48:41Z
- **Completed:** 2026-08-27T13:09:30Z
- **Tasks:** 3 (1 decision gate, 1 tracer, 1 test-freeze)
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- **The whole store vertical works end to end on one range.** `setDataType(store, { start: 0x0810, endInclusive: 0x084f, dataType: "lo_hi_address" })` validates, persists, survives `closeStore` plus a reopen through a **fresh handle**, and reads back by value — `start` 0x0810, `endInclusive` 0x084F, `dataType` `"lo_hi_address"`, `bank` null — with the paint index resolving that row's id at 0x0820 and `NO_ROW` one past the inclusive end. `revertTo(handle, 0)` returns an empty `listRanges()` and revision 0.
- **The milestone's one irreversible decision is frozen and pinned.** Twelve members in the `r2000_set_data_type` schema's own order and spelling, four split layouts **derived** by filtering rather than re-typed, both arrays `Object.freeze`d, and the pin **hand-written** so a silent vocabulary edit cannot silently edit its own expectation. Observed reddening: swapping `lo_hi_address` and `hi_lo_address` failed 2 of 3 tests.
- **`STORE-07`'s confinement is asserted, not promised.** `node:sqlite` is named by exactly one module of `shippedTsModules()`, proven with a `deepEqual` **and** a length assertion **and** a separate non-vacuity test. All four working access routes — single-line static, multi-line static, dynamic `import()`, `process.getBuiltinModule` — are proven catchable by the same `namesNodeSqlite()` predicate the real scan calls. Observed reddening: a real static import planted in `anno-index.ts` failed the assertion.
- **The corrupt-file refusal SQLite will not give you.** A zero-length file, a non-database file, a foreign `schema_version` and a mid-file truncation are each refused with `AnnoStoreCorruptError` — because a zero-length file *opens*, reports `integrity_check` `ok` and returns an empty `sqlite_master`, making "your annotations are gone" and "there are no annotations" indistinguishable without the store's own refusal.
- **The write sequence is pinned in both directions.** Behaviourally: three successive writes each advance the revision by exactly one, and a write based on a stale revision is refused with **both** numbers and leaves the revision untouched. Structurally, from the seam's own source: `begin immediate`, the CAS `update ... where id = 1 and revision = ?`, the changes-must-equal-1 check, the rollback, and exactly **one** `commit` statement in the module.
- **`journal_mode` reads `delete` on a fresh store, and nothing sets it.** The default is the decision, pinned by a test because `journal_mode` is a *persistent database property* — one stray pragma anywhere would be inherited by every later connection to that file, by any process.

## Task Commits

1. **Task 1: decision gate — freeze the vocabulary at twelve members** — no commit (decision, auto-selected `twelve-members`; see Decisions Made)
2. **Task 2: end-to-end "type one range and read it back by value"** — `4c9cea3` (feat)
3. **Task 3: the vocabulary freeze and the STORE-07 structural single-seam assertion** — `5e1903f` (test)
4. **Task 3 follow-on: assert the must-have truths that were implemented but unproven** — `b6f560d` (test)

## Files Created/Modified

- `src/mcp/vice/anno-types.ts` (410 lines) — the frozen twelve-member vocabulary, the derived four split layouts, `RangeRow` with inclusive `endInclusive`, `assertDataType` / `assertRangeShape` / `parseStoreAddress` / `storePathWithinWorkspace`, and the seven-member `AnnoStoreError` family over `ViceError`.
- `src/mcp/vice/anno-index.ts` (150 lines) — `buildPaintIndex` / `resolveAt` over an `Int32Array` of 65,536 cells: longest-span-first paint so narrowest-wins falls out of the paint order, with the equal-length tie-break pinned explicitly in the comparator (decision `A4`) rather than left to sort stability. Pure; refuses an out-of-range row because `TypedArray.fill` clamps silently.
- `src/mcp/vice/anno-store.ts` (556 lines) — the one module naming `node:sqlite`. Complete `DDL` at `SCHEMA_VERSION` 1 (eight tables, four indexes, nullable `bank` on all four annotated tables, `anno_xref.access_kind` from the first write, **no** FTS5), `openStore`'s corrupt-file refusal, `runWriteSequence`'s snapshot-then-CAS-then-mutate-then-one-commit ordering, `setDataType`'s split-and-preserve, `listRanges`, `revertTo`, `paintIndexOf`.
- `src/mcp/vice/anno-store.test.ts` (14 tests) — the tracer's end-to-end test plus the boundary, empty-input, corrupt-file, revision, reserved-column, xref/FTS5, journal-mode and path-confinement assertions.
- `src/mcp/vice/anno-seam.test.ts` (14 tests) — the `STORE-07` structural assertion, the four planted routes, the negative control, the non-vacuity pairing, the extension-API absence, the module-level-mutable-state scan, the no-commit-wrapper containment, the single-commit count, the idempotency probe and the CAS structural pin.
- `src/mcp/vice/anno-types.test.ts` (3 tests) — the hand-written vocabulary freeze.
- `src/mcp/vice/package.json` — three `files[]` entries added after `prg-image.ts`. **No dependency change: zero package-manager installs** (`T-28-SC` confirmed by diff).

## Decisions Made

- **Twelve members, four split layouts first-class (Task 1's decision gate).** Auto-selected `twelve-members` — the plan's own "mandated option" — rather than halting. Rationale for auto-selecting: the gate carried `gate="blocking"` (not `blocking-human`), the project runs `mode: yolo`, the standing user preference is autonomous decisions, and the plan states the alternative "contradicts ROADMAP criterion 1 and STORE-01 outright" and would make criterion 1's control unwritable. The decision is recorded here as the one irreversible choice of the milestone: split-table orientation is unrecoverable from a store that never recorded it, so the recovery cost is a hand re-annotation, not a migration.
- **`parseStoreAddress` owns the string forms only; `assertRangeShape` owns range-ness.** Discovered by the boundary probe (see Deviations). A range-shape refusal must be an `AnnoRangeShapeError` so a caller can distinguish "that is not an address" from "those two ends do not make a range".
- **One private `commitTransaction()` helper shared by first-open init and the write sequence.** The plan requires exactly one `commit` statement in the module, and the fresh-store schema creation also needs a transaction. Routing both through one helper keeps the single planted-violation site unique while leaving schema creation atomic. `commitTransaction`, `applyWriteWithoutCommit` and `doCommit` are all invisible to a `\bcommit\b` count, verified.
- **The seam's module-level-mutable-state scan is anchored at column zero.** `block-class.test.ts:194-212`'s version is unanchored, which was free for a module with no function-local state; this seam has genuine locals (`let meta`, `let touched`). The requirement is about *module-level* state, so the anchor is what makes the scan mean that rather than "no local variable anywhere". The `const`-bound-mutable-container half — the half `WR-04` was about — is kept in full, and the divergence is written into the test.
- **`paintIndexOf(handle)` added to `anno-store.ts`, one export beyond the plan's list.** The plan's `key_links` require a real, used `anno-index.ts` import in the seam ("`buildPaintIndex` over `listRanges` output — the index is rebuilt from rows, never maintained incrementally"). `paintIndexOf` is the minimal honest realisation; it holds nothing between calls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The boundary refusal was the wrong error type**

- **Found during:** Task 2 (tracer), by the plan's own `STORE-01` boundary probe
- **Issue:** `setDataType` called `parseStoreAddress` before `assertRangeShape`, so an `endInclusive` of `0x10000` or `-1` was refused with `AnnoAddressError`. The plan's must-have truth requires `AnnoRangeShapeError` for exactly that input, and collapsing the two leaves a caller unable to tell an unparseable address from an impossible range.
- **Fix:** `parseStoreAddress` is now applied only when the argument is a `string` (where the question is genuinely "what base is this text in"); a numeric argument passes straight through to `assertRangeShape`, which owns range-ness for both forms. The ordering and the reason are commented as load-bearing.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** the boundary test asserts `AnnoRangeShapeError` for all four offending shapes, that the message carries the offending value AND `0..65535`, and that a refused write leaves no row and does not advance the revision.
- **Committed in:** `4c9cea3`

**2. [Rule 1 - Bug] The zero-length-file refusal was silent about the distinction it exists to draw**

- **Found during:** Task 2 (tracer), by the corrupt-file test
- **Issue:** A zero-length file takes the **unreadable** branch (`no such table: anno_meta`), not the missing-row branch. Only the missing-row message said it was refusing to treat a truncated or foreign file as an empty store — so the message produced by the *one case `C-2` was actually measured on* said nothing about it.
- **Fix:** the unreadable branch's message now carries the same refusal statement and names the zero-length case explicitly, including why SQLite cannot make the distinction itself.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** the zero-length test asserts `AnnoStoreCorruptError` **and** matches the refusal wording.
- **Committed in:** `4c9cea3`

**3. [Rule 1 - Bug] A test title claimed two refusals and exercised one**

- **Found during:** the must-have truth reconciliation after Task 3
- **Issue:** "a store file whose `schema_version` is not the expected one is refused, and so is a file that is not a database at all" only ever wrote a text file — the `schema_version` branch was never reached, so the title overclaimed and the branch was unguarded.
- **Fix:** split into two tests; the `schema_version` branch is now exercised by forging a store with a foreign version, and the refusal is asserted to name **both** versions.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`
- **Verification:** both tests pass; the forged-version test fails if either version is dropped from the message.
- **Committed in:** `b6f560d`

**4. [Rule 2 - Missing Critical] Six stated must-have truths were implemented but unasserted**

- **Found during:** the reconciliation of `must_haves.truths` against the committed tests
- **Issue:** the `integrity_check` condition, the mid-file-truncation refusal, the revision-advances-by-exactly-one and stale-revision behaviour, the reserved-`bank` nullability across all four tables, `anno_xref.access_kind` plus the absence of any FTS5/virtual table, the `STORE-07` **idempotency** probe the plan names as this plan's own, and the CAS's three structurally-separable parts were all true of the code and asserted nowhere. Any of them could have been undone silently.
- **Fix:** seven tests added across `anno-store.test.ts` and `anno-seam.test.ts`. The `integrity_check` condition is exercised in its *passing* direction with the exact query and result shape `openStore()` checks, so the check cannot become a no-op through a changed shape.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`, `src/mcp/vice/anno-seam.test.ts`
- **Verification:** 31/31 across the three new test files; typecheck clean; the five structural guards 66/66.
- **Committed in:** `b6f560d`

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing critical). **Impact on plan:** all four were required for the plan's own stated truths to hold and to be *provable*; two changed production behaviour (both refusal paths), two changed only test coverage. No scope creep — no new capability, no new dependency, no new export beyond the one `paintIndexOf` recorded under Decisions.

## Deliberately Deferred

Recorded so a later reader does not mistake absence for oversight. Each is scoped to a named later plan by `28-01-PLAN.md` itself.

- **The five overlap cases of split-and-preserve.** Implemented in `retype()`, including the fully-contained case that is the sole detector for a `filter()`-and-insert implementation, but exercised here only on the no-overlap path. `STORE-02`'s total-typed-bytes invariant is a later plan's proof. Flagged as `human_judgment: true` on coverage entry `D11`.
- **The cross-process durability half of `STORE-04`.** Mutate → `SIGKILL` → fresh OS process → reopen → read back by value → revert, as one combined test, is a later plan's. `applyWriteWithoutCommit` exists in this commit precisely so that proof's planted violation drives the identical code path; no shipped module but the seam names it, asserted. Flagged on coverage entry `D12`.
- **Snapshot pruning.** `MAX_SNAPSHOT_REVISIONS = 32` is declared in `anno-types.ts` and **not enforced** — the `snapshots/` directory grows unbounded today. `T-28-diskgrowth` in the plan's threat register assigns the pruning to a later plan. Filed to the broken-windows ledger.
- **No `.regen2000proj` import path.** None is owed (no parity obligation, no `.annostore` file exists anywhere to migrate) and none was written. Stated so a later reader does not look for a converter that deliberately never existed.
- **No mnemonic-to-access classifier.** Nothing derivable is stored in `anno_xref`, so the classifier has no consumer yet.

## Issues Encountered

- **`npm run test:automated` exits 1 on a clean tree, as the plan documents.** The gate is the failure list, not the exit code. Reconciled item by item with the broker confirmed stopped: **6 failures, all in `r2000-session.test.ts`** — the five named `plan 18-06:` tests (`R2000SpawnError: regenerator2000 was not found on PATH`; `R2000_BIN` is the documented alternative) plus the named load-sensitive flake at `r2000-session.test.ts:615`, confirmed at that exact line. Across three runs the flake appeared in two and not in the third (5 fail / 6 fail / 6 fail), exactly the behaviour the plan predicted. **No failure in any other file.** Test count rose 2517 → 2548, which is the 31 tests this plan adds.
- **`state.update-progress` could not find its target** (`"Progress field not found in STATE.md"`) — this project keeps its plan counters in STATE.md frontmatter rather than as a body progress bar. `completed_plans` was corrected by hand from 5 to 6; `percent` tracks phases and correctly stays at 17.
- **`state.add-decision --summary-file` rejects a path outside the repo.** Worked around with a temporary directory under `.planning/`, removed afterwards. Not a defect in this plan's work.

## User Setup Required

None — no external service configuration required. The persistence layer is a Node builtin and every in-repo import is a relative path.

## Next Phase Readiness

**Ready for 28-02.** The seam, the vocabulary and the write sequence every later criterion plants a violation against are all committed and green, and the three modules are in `files[]` so `shippedTsModules()`-based guards see them automatically with no edit in any guard.

What later plans in this phase inherit and must not re-litigate:

- `SCHEMA_VERSION` stays **1** for the whole phase. The DDL is complete — eight tables, four indexes — so no expansion task alters an on-disk shape.
- `anno-index.ts` is pure and takes rows as an argument. The cross-validation oracle belongs *inside* a test file and must never become a second production implementation or an injectable comparator — that would give the store two answers to "what type is this address" and destroy the property the cross-check exists to prove.
- The one `commit` statement lives in `commitTransaction()`. A second `commit` anywhere in the seam splits the durability proof's planted violation across two sites and lets half of it survive; `anno-seam.test.ts` fails on it.
- Nothing may set `journal_mode`, create an FTS5 table, name the SQLite extension surface, or import either path-translation seam. All four are asserted, not requested.

**Requirement marking note:** this plan declares `STORE-01`…`STORE-05` and `STORE-07`. Five of those six are also declared by sibling plans that have no SUMMARY yet, so the shared-ID gate correctly defers marking them Complete in `REQUIREMENTS.md` until the last declaring plan finishes. `STORE-07` is declared by this plan alone and marks now.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-27*

## Self-Check: PASSED

- All 6 created source files present on disk (`[ -f ]` verified), plus this SUMMARY.
- All 3 task commits present in `git log --oneline --all`: `4c9cea3`, `5e1903f`, `b6f560d`.
- Plan-level verification re-run against the final state: `node --test anno-seam.test.ts anno-types.test.ts anno-store.test.ts` 31/31; `npm run typecheck` clean; the five structural guards (`shipped-modules`, `hostpath-consumers`, `comment-phase-pointers`, `docs-dangling-refs`, `module-classification`) 66/66; `node scripts/check-npm-packages.mjs` OK (80 files, no test file listed); `npm run test:automated` with the broker stopped shows no failure outside the named baseline.
- Every task `<acceptance_criteria>` re-run and green, including both required planted-violation observations (vocabulary reorder, second `node:sqlite` importer), each reverted before its commit.
- No stub markers (`TODO`/`FIXME`/placeholder text) in any file this plan created.
