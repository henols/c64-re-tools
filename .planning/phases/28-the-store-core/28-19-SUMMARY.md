---
phase: 28-the-store-core
plan: 19
subsystem: database
tags: [sqlite, annotation-store, node-sqlite, split-tables, invariants, data-integrity]

requires:
  - phase: 28-the-store-core
    provides: "the annotation store's range table, `retype()`'s split-and-preserve, `assertRangeShape()`, `resolveSplitTargets()`, `anno-overlap.test.ts`'s five-case overlap table and its two plantings"
provides:
  - "`AnnoSplitRemainderError` — a named, structured, in-family refusal for a split-and-preserve remainder the store cannot legally preserve"
  - "a remainder shape gate inside `retype()` that runs over every remainder of every overlapping row BEFORE the first delete, asking `assertRangeShape()` itself"
  - "`insertRange()` taking `bank` as a parameter, so a remainder carries the overlapped row's reserved `bank` forward (IN-06)"
  - "the two decisions this settles recorded in `retype()`'s doc comment: the remainder rule with demotion rejected, and the union collapse as intended"
  - "all five overlap geometries exercised against a `lo_hi_address` row, by value or by refusal"
  - "the WR-08 union-retype and same-type-subrange shapes pinned by value with their id lists"
  - "the round-trip re-acceptance invariant with three non-vacuity counts, plus PLANTING C observed red test-locally AND against the shipped function"
affects: [29-the-mcp-surface, 30-acme-export]

actuals:
  tokens: 14933
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "The store's own internal writers are validated by the SAME function the entry point uses — one definition of a legal range shape in the repo, never a second copy of the rule"
    - "Compute-then-refuse-then-mutate: a refusal is raised before the first mutation rather than undone by a rollback, so it costs nothing and does not depend on a rollback that can itself fail"
    - "A round-trip invariant (`listRanges()` output must be re-acceptable at `setDataType`) asserted after every write of a deterministic table-driven sequence, with explicit non-vacuity counts"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-overlap.test.ts
    - src/mcp/vice/anno-store.test.ts

key-decisions:
  - "CR-09 resolved by (b) REFUSE THE WHOLE RETYPE, not by (a) demotion to `undefined` — demotion destroys the recorded split orientation, which the module's own header calls unrecoverable with no field to migrate. Rounding the range outward is forbidden by trap 7."
  - "`AnnoSplitRemainderError` extends `AnnoRangeShapeError` rather than `AnnoStoreError`, so every existing `instanceof AnnoRangeShapeError` caller keeps working and the refusal sits in the family it belongs to."
  - "The shape gate runs over the whole overlapping set BEFORE the first delete, so a refusal is free rather than rolled back — the rollback path is one 28-17 already showed can itself fail."
  - "`anno-store.test.ts`'s bank control is narrowed from 'never READ' to 'never INTERPRETED': IN-06's verbatim pass-through is allowed by exact line shape and an unconditional no-branch/no-compare/no-arithmetic assertion is added beside it."

patterns-established:
  - "Remainder validation by delegation: an internal writer asks the public validator, so a rule added to the validator later applies to the writer for free"
  - "Per-step planting selectivity measured on freshly seeded stores, so the measurement does not inherit a divergence from an earlier step"

requirements-completed: [STORE-01, STORE-02, STORE-03]

coverage:
  - id: D1
    description: "The store never persists a range row it would refuse at its own entry point: `retype()`'s remainder writes are gated by `assertRangeShape()` inside the same transaction, before any delete or insert."
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#CR-09, PRODUCTION ENTRY POINTS ONLY: typing one byte inside a lo_hi_address table is REFUSED by name, and the refusal costs the store nothing"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#split overlap case 3 (new fully INSIDE the split row, ODD tail remainder (the CR-09 drive)) over $1000..$100f lo_hi_address -> REFUSED"
        status: pass
    human_judgment: false
  - id: D2
    description: "The outcome is REPORTED, never silent: a named `AnnoSplitRemainderError` in the `ViceError` family carrying the overlapped row's id/range/type, the illegal remainder's range and byte count, which side it is, and the two nearest legal caller boundaries."
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#CR-09, PRODUCTION ENTRY POINTS ONLY: typing one byte inside a lo_hi_address table is REFUSED by name, and the refusal costs the store nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "A refusal costs nothing: `listRanges()` is deep-equal and `currentRevision()` unchanged afterwards, because the gate runs before the first delete."
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#split overlap case 4 (overlap at the LOW end leaving an ODD tail) over $1000..$100f lo_hi_address -> REFUSED"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#split overlap case 5 (overlap at the HIGH end leaving an ODD head) over $1000..$100f lo_hi_address -> REFUSED"
        status: pass
    human_judgment: false
  - id: D4
    description: "All five overlap geometries are exercised against a `lo_hi_address` existing row, with the row set asserted BY VALUE where the write is legal and the refusal asserted by class where it is not."
    requirement: "STORE-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#the SPLIT case definitions really do satisfy their own predicates, and the table covers all five geometries with both outcomes"
        status: pass
      - kind: unit
        ref: "node --test anno-overlap.test.ts (8 split-table entries, 31 tests, # fail 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The union-retype collapse and the same-type-subrange fragmentation are pinned by value with their before/after id lists, and `retype()`'s doc comment records the collapse as intended and why it does not contradict STORE-02."
    requirement: "STORE-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#WR-08 pin, THE UNION RETYPE: a caller range spanning two adjacent rows leaves exactly ONE row and NEITHER original id"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#WR-08 pin, THE SAME-TYPE SUBRANGE: retyping a subrange to the type it already has fragments one row into three, with every id churned"
        status: pass
    human_judgment: false
  - id: D6
    description: "The class-level invariant: after every write of a deterministic 11-step sequence over all four split members, every row `listRanges()` returns is re-acceptable at `setDataType` and decodable by `resolveSplitTargets`, with three non-vacuity counts."
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#THE ROUND-TRIP INVARIANT: after every write of a deterministic sequence, every row listRanges() returns is re-acceptable at setDataType and decodable by resolveSplitTargets"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#planting C, OBSERVED: the same sequence through a writer without the remainder rule leaves rows the store would refuse, named by value"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#planting C, SELECTIVE and MEASURED: it can differ from the production path on exactly the three steps whose remainder is illegal, and is indistinguishable on the other eight"
        status: pass
    human_judgment: false
  - id: D7
    description: "IN-06: a remainder re-inserted from an overlapped row carries that row's reserved `bank` forward while the newly typed range carries `null`, read back through `listRanges()` after a production `setDataType`."
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#IN-06: a remainder carries the overlapped row's own `bank` forward, while the newly typed range carries null"
        status: pass
    human_judgment: false
  - id: D8
    description: "PLANTING C observed red ON THE REAL TREE (the shipped `retype()` with its gate deleted by hand), then restored to an empty diff and a green file."
    verification:
      - kind: manual_procedural
        ref: "hand-removed gate -> node --test anno-overlap.test.ts -> 6 not-ok lines -> git checkout -- src/mcp/vice/anno-store.ts -> empty git diff --stat, 31/31 green"
        status: pass
    human_judgment: true
    rationale: "The observation is a hand-performed edit-run-restore cycle against the shipped function; it cannot live in the suite (a test that deletes production code and reruns the suite is not a test). The `not ok` lines and the empty restore diff are recorded verbatim below."

duration: 38 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 19: The Remainder Rule Summary

**`retype()` now asks `assertRangeShape()` itself about every split-and-preserve remainder before it deletes anything, so the store can no longer persist an odd-byte-count split table it would refuse at its own entry point — refusing instead with a named `AnnoSplitRemainderError` that carries both conflicting spans and the two nearest legal boundaries, while the reserved `bank` column now survives a split.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-08-28T19:50:17Z
- **Completed:** 2026-08-28T20:28:19Z
- **Tasks:** 3 (task 1 executed red-green, so 4 commits)
- **Files modified:** 4

## Accomplishments

- **CR-09 closed.** `retype()` runs a remainder shape gate over every remainder of every overlapping row before the first `delete`. The gate asks `assertRangeShape()` — the exact function `setDataType()` calls on a caller's range — so there is one definition of a legal range shape in the repo and a rule added to it later applies to the store's own writer for free.
- **The refusal is named, structured and in-family.** `AnnoSplitRemainderError extends AnnoRangeShapeError` (and so `AnnoStoreError` and `ViceError`), carrying `rowId`, `rowStart`, `rowEndInclusive`, `dataType`, `remainderStart`, `remainderEndInclusive` and `side`.
- **The refusal costs nothing.** Compute, refuse, then mutate — not compute, mutate, roll back. Every refusing control asserts a `listRanges()` deep-equal (ids included) and an unchanged `currentRevision()`.
- **IN-06 closed.** `insertRange()` takes `bank` as a parameter; `retype()` selects the overlapped row's `bank` and hands it to both remainder inserts, while the newly typed range still gets `null`.
- **The split class is no longer invisible.** `anno-overlap.test.ts` grew an 8-entry split overlap table across all five geometries (5 asserted by value, 3 refusals), the two WR-08 pins with their id lists, the round-trip invariant with three non-vacuity counts, and PLANTING C — observed red both test-locally and against the shipped function.
- **Both decisions are on the record next to the code** in `retype()`'s doc comment.

## Task Commits

1. **Task 1 (RED): failing CR-09 remainder-rule controls** — `e3adb18` (test)
2. **Task 1 (GREEN): the remainder rule, IN-06, and the two recorded decisions** — `e93ddf0` (feat)
3. **Task 2: five geometries against a split row + WR-08 pins by value** — `c2cfab2` (test)
4. **Task 3: the round-trip invariant and PLANTING C** — `1776c76` (test)

## Files Created/Modified

- `src/mcp/vice/anno-types.ts` — `AnnoSplitRemainderErrorOptions` and `AnnoSplitRemainderError`, exported, extending `AnnoRangeShapeError`, with the doc comment recording why it extends the shape family rather than `AnnoStoreError`.
- `src/mcp/vice/anno-store.ts` — `insertRange()` gains a `bank` parameter; `OverlappedRangeRow`; `remainderRefusal()` and `hexRange()`; `retype()`'s select gains `bank`, the gate loop precedes the mutation loop, both remainder inserts carry `row.bank`, and the doc comment gains the two decisions.
- `src/mcp/vice/anno-overlap.test.ts` — 17 new tests, the header updated, `runCase()` extended with the seed range/type, the new type, the captured refusal and the revision pair.
- `src/mcp/vice/anno-store.test.ts` — the reserved-`bank` control narrowed from "never READ" to "never INTERPRETED" (see Deviations).

## The Numbers, Verbatim

### The CR-09 drive, before and after

**Before this plan (measured by the round-5 verifier and re-stated in the plan):**

```
setDataType($1000..$100f, "lo_hi_address")  -> {revision:1, changed:true, contradictedComments:[]}
setDataType($1004..$1004, "byte")           -> {revision:2, changed:true, contradictedComments:[]}
listRanges() ->
  id=2 4096..4099 lo_hi_address bank=null
  id=3 4101..4111 lo_hi_address bank=null    <-- span 11, ODD, a shape the store refuses
  id=4 4100..4100 byte          bank=null
```

**After this plan, re-driven through production entry points only:**

```
first: {"revision":1,"changed":true,"contradictedComments":[]}
before rows: [{"id":1,"start":4096,"endInclusive":4111,"dataType":"lo_hi_address","bank":null}]
before revision: 1
THROWN CLASS: AnnoSplitRemainderError | name: AnnoSplitRemainderError
after rows: [{"id":1,"start":4096,"endInclusive":4111,"dataType":"lo_hi_address","bank":null}]
after revision: 1
```

The full message, verbatim:

> typing 4100..4100 ($1004-$1004) would split range id 1 (4096..4111, $1000-$100f, lo_hi_address) and leave a tail remainder 4101..4111 ($1005-$100f) of 11 byte(s), which is not a shape this store accepts: a lo_hi_address table needs an even byte count, but 4101..4111 is 11 byte(s) -- the low half and the high half must be the same length. The whole retype is refused, so nothing was written. The nearest endInclusive values that would leave an even tail are 4099 and 4101; alternatively extend the retype to one of the table's own entry boundaries, or retype the whole table to the type you want first.

`listRanges()` before the refusal and after it are the same single row `id=1 4096..4111 lo_hi_address bank=null`; `currentRevision()` reads **1** before and **1** after. The test asserts `instanceof AnnoSplitRemainderError`, `instanceof AnnoRangeShapeError` and `instanceof ViceError` directly.

### The legal-remainder case

`setDataType($1004..$1007, "byte")` on the same `$1000..$100f lo_hi_address` row SUCCEEDS (`changed: true`) and `listRanges()` returns exactly three rows:

```
4096..4099 lo_hi_address bank=null
4104..4111 lo_hi_address bank=null
4100..4103 byte          bank=null
```

Each of the three is then re-accepted by `setDataType` at its own boundaries without throwing (asserted in the test, not reasoned about).

### The split overlap table (8 entries, all five geometries)

| # | geometry | new range | outcome |
|---|---|---|---|
| 1 | case 1, identical | `$1000..$100f` byte | rows: `[4096..4111 byte]` |
| 2 | case 2, contains | `$0ff0..$101f` byte | rows: `[4080..4127 byte]` |
| 3 | case 3, both strict, even remainders | `$1004..$1007` byte | rows: `[4096..4099 lo_hi_address], [4104..4111 lo_hi_address], [4100..4103 byte]` |
| 4 | case 3, ODD tail (the CR-09 drive) | `$1004..$1004` byte | **REFUSED** |
| 5 | case 4, low end, EVEN tail | `$0ff8..$1007` byte | rows: `[4104..4111 lo_hi_address], [4088..4103 byte]` |
| 6 | case 4, low end, ODD tail | `$0ff8..$1006` byte | **REFUSED** |
| 7 | case 5, high end, EVEN head | `$1008..$101f` byte | rows: `[4096..4103 lo_hi_address], [4104..4127 byte]` |
| 8 | case 5, high end, ODD head | `$1009..$101f` byte | **REFUSED** |

**Counts, as numbers:** 8 entries; 3 refusals; 5 row-sets asserted by value; 5 geometries covered (`[1,2,3,4,5]`, asserted as a set). Every entry's predicate is checked against the header's five-case table in `the SPLIT case definitions really do satisfy their own predicates` before any store is opened, and each entry is asserted to be exactly one outcome kind.

**The block that guarantees the three refusal assertions for all of them at once** is the `if (kase.refused === true) { … return; }` arm of the per-entry `for (const kase of SPLIT_CASES)` test — it asserts the error class, then `assert.deepEqual(r.after, r.before)` (whole `RangeRow` objects, so ids are included), then `assert.equal(r.revisionAfter, r.revisionBefore)`. There is one arm, so no refusing entry can be written with a weaker check.

Every legal entry also asserts `bank` is `null` on every row, invariant A (`totalTypedBytes(after) === unionSize(beforeCovered, c, d)`) and invariant B (`lost === []`).

### IN-06

The precondition (a row carrying `bank: 7`) is constructed through `applyWrite`, then the split is a production `setDataType($1004..$1007, "byte")` and the result is read back through `listRanges()`:

```
before: [[4096, 4111, "lo_hi_address", 7]]
after:  [{4096..4103? no} ->
         { start: 4096, endInclusive: 4099, dataType: "lo_hi_address", bank: 7 },
         { start: 4104, endInclusive: 4111, dataType: "lo_hi_address", bank: 7 },
         { start: 4100, endInclusive: 4103, dataType: "byte",          bank: null }]
```

**Backstop truth, structured form:**

- statement: "The NON-NULL half of IN-06 — that a remainder carries a non-null `bank` forward. MEASURED AT PLAN TIME and re-confirmed against the tree: `insertRange()` was the module's ONLY range insert and bound the literal `null`, and after this plan every production caller passes either `null` (a newly typed range) or the overlapped row's own value (a remainder), so no production entry point can put a non-null `bank` on disk. The precondition was therefore CONSTRUCTED through `applyWrite` — the route that was taken, not one that might be — and only the read-back (a production `setDataType` observed through `listRanges()`) is production-driven."
  verification: backstop

`insertRange()`'s callers were **not** broadened to manufacture a production route for a non-null `bank`.

### WR-08 pins, with their id lists

**The union retype** — `$1000..$1007 byte` + `$1008..$100f byte`, then `setDataType($1000..$100f, "byte")`:

- ids before: `[1, 2]` (`[1, 4096..4103, byte]`, `[2, 4104..4111, byte]`)
- result: `changed: true`, exactly ONE row `4096..4111 byte`
- ids after: `[3]` — neither pre-retype id survives (asserted per id, not only as a list)

**The same-type subrange** — on that single row, `setDataType($1004..$1007, "byte")`:

- ids before: `[3]`
- result: `changed: true`, three rows `4096..4099 byte`, `4104..4111 byte`, `4100..4103 byte`
- ids after: `[4, 5, 6]` — all three absent from the pre-retype id set

Both match the plan's plan-time measurements exactly.

### The two recorded decisions, quoted from `retype()`'s doc comment

> DECISION 1: THE REMAINDER RULE, WITH THE ALTERNATIVE NOT TAKEN (CR-09). … **DEMOTING the illegal remainder to the vocabulary's `undefined` member was considered and REJECTED, because it destroys the recorded split ORIENTATION, which this module's own header calls the one irreversible decision in this area with no field to migrate -- a one-way data decision taken silently on the caller's behalf.**

> DECISION 2: THE UNION COLLAPSE IS INTENDED (STORE-02, round-3 WR-08). … **That is intended, and it does not contradict STORE-02: STORE-02 forbids the store joining adjacent ranges OF ITS OWN ACCORD, and here the caller asked for exactly one range and got exactly one range.**

The comment also states that `changed: true` is correct for that call because `changed` reports the ROW SET, and points the reader at the two pins in `anno-overlap.test.ts`.

### The round-trip invariant

- **Sequence length:** 11 steps (over a 5-row seed carrying all four split layouts plus one `byte` row)
- **Accepted writes:** 8
- **Refusals:** 3
- **Final row count:** 13, of which 7 carry a split type and all four split layouts are present

The three non-vacuity assertion messages, quoted:

1. `` `the sequence must actually write: ${accepted} accepted writes, expected at least 8` ``
2. `` `the sequence must actually exercise the refusal path: ${refusals} refusals, expected at least 3` ``
3. `` `the invariant must be asked about split rows: ${finalSplitRows} split rows survive, expected at least 4` ``

The invariant is asserted after **every** step, accepted or refused, and the seed itself is checked before the sequence starts.

**Backstop truth, structured form:**

- statement: "The remainder rule holds for every reachable overlap geometry, not only the enumerated five, over an unbounded input space. The invariant is driven over a DETERMINISTIC FINITE sequence, so it is direct evidence for the geometries that sequence constructs and a BACKSTOP for the unbounded input space; no property-based sweep over all 65,536 start/end pairs is run here."
  verification: backstop

The same limit is written in the section's own comment in `anno-overlap.test.ts`, so a later reader cannot mistake a finite sequence for a proof over the whole input space.

### PLANTING C, test-local

The offending row it names, by value, at the first step it appears (step 2):

```
{ start: 4352, endInclusive: 4356, dataType: "hi_lo_address" }
id=6 4352..4356 hi_lo_address (5 bytes) -- assertRangeShape: a hi_lo_address table needs an even byte
count, but 4352..4356 is 5 byte(s) -- the low half and the high half must be the same length
```

And the offender still standing at the end of the sequence:

```
{ start: 4865, endInclusive: 4873, dataType: "hi_lo_word" }
```

**Selectivity, measured per step on freshly seeded stores:** the planting differs from the production path on exactly steps `[2, 4, 6]` — the three whose remainder is an odd split table — and produces the byte-identical row set on `[0, 1, 3, 5, 7, 8, 9, 10]`.

### PLANTING C, observed red ON THE REAL TREE

The 13-line gate was deleted from `retype()` in `src/mcp/vice/anno-store.ts` by hand (`git diff --stat -- src/mcp/vice` → `src/mcp/vice/anno-store.ts | 13 -------------`, `1 file changed, 13 deletions(-)`). `node --test anno-overlap.test.ts` then reported `# pass 25 / # fail 6` and these `not ok` lines, verbatim:

```
not ok 11 - CR-09, PRODUCTION ENTRY POINTS ONLY: typing one byte inside a lo_hi_address table is REFUSED by name, and the refusal costs the store nothing
not ok 18 - split overlap case 3 (new fully INSIDE the split row, ODD tail remainder (the CR-09 drive)) over $1000..$100f lo_hi_address -> REFUSED
not ok 20 - split overlap case 4 (overlap at the LOW end leaving an ODD tail) over $1000..$100f lo_hi_address -> REFUSED
not ok 22 - split overlap case 5 (overlap at the HIGH end leaving an ODD head) over $1000..$100f lo_hi_address -> REFUSED
not ok 29 - THE ROUND-TRIP INVARIANT: after every write of a deterministic sequence, every row listRanges() returns is re-acceptable at setDataType and decodable by resolveSplitTargets
not ok 31 - planting C, SELECTIVE and MEASURED: it can differ from the production path on exactly the three steps whose remainder is illegal, and is indistinguishable on the other eight
```

The invariant's own failure text:

```
error: 'step 2 (hi_lo_address, head $1100..$1104 is 5 bytes -- odd): expected a refusal, got acceptance'
```

That is the invariant test, all three refusing entries of the split table, the tracer's own CR-09 drive, and the selectivity control — six reds, and the eight legal split entries plus the five non-split cases stayed green, so the planting is discriminating rather than merely destructive.

**After restore** (`git checkout -- src/mcp/vice/anno-store.ts`): `git diff --stat -- src/mcp/vice` produced **no output** (empty), and `node --test anno-overlap.test.ts` reported `# tests 31 / # pass 31 / # fail 0 / # skipped 0` at exit 0.

### Suite counts and greps, before and after

| measurement | before | after |
|---|---|---|
| `node --test anno-*.test.ts block-class.test.ts` | `# tests 169 / # pass 169 / # fail 0 / # skipped 0`, exit 0 | `# tests 186 / # pass 186 / # fail 0 / # skipped 0`, exit 0 |
| `node --test anno-overlap anno-types anno-store anno-index` | 115 pass | 118 pass |
| `node --test anno-overlap.test.ts` | 14 pass | 31 pass |
| task 3's eight-file set | — | `# tests 186 / # pass 186 / # fail 0 / # skipped 0`, exit 0 |
| `grep -c lo_hi_address src/mcp/vice/anno-overlap.test.ts` | **2** | **29** |
| `grep -c AnnoSplitRemainderError` (types / store / overlap test) | 0 / 0 / 0 | **4 / 3 / 3** |
| `grep -c 'SCHEMA_VERSION = 2' src/mcp/vice/anno-types.ts` | 1 | **1** |
| `tsc --noEmit -p src/mcp/vice/tsconfig.json` | clean, exit 0 | clean, exit 0 |

**The 17 tests added, so the growth from 169 to 186 is accounted for rather than rounded** (all 17 are in `anno-overlap.test.ts`, 14 → 31):

1. `CR-09, PRODUCTION ENTRY POINTS ONLY: typing one byte inside a lo_hi_address table is REFUSED by name, and the refusal costs the store nothing`
2. `the LEGAL remainder case on the same split row: an even head and an even tail split into three rows, and every one of them is re-acceptable at setDataType`
3. ``IN-06: a remainder carries the overlapped row's own `bank` forward, while the newly typed range carries null``
4. `the SPLIT case definitions really do satisfy their own predicates, and the table covers all five geometries with both outcomes`
5. `split overlap case 1 (identical range retyped to byte) … -> row set by value`
6. `split overlap case 2 (new fully CONTAINS the split row) … -> row set by value`
7. `split overlap case 3 (… BOTH remainders even (LOAD-BEARING)) … -> row set by value`
8. `split overlap case 3 (… ODD tail remainder (the CR-09 drive)) … -> REFUSED`
9. `split overlap case 4 (overlap at the LOW end leaving an EVEN tail) … -> row set by value`
10. `split overlap case 4 (overlap at the LOW end leaving an ODD tail) … -> REFUSED`
11. `split overlap case 5 (overlap at the HIGH end leaving an EVEN head) … -> row set by value`
12. `split overlap case 5 (overlap at the HIGH end leaving an ODD head) … -> REFUSED`
13. `WR-08 pin, THE UNION RETYPE: a caller range spanning two adjacent rows leaves exactly ONE row and NEITHER original id`
14. `WR-08 pin, THE SAME-TYPE SUBRANGE: retyping a subrange to the type it already has fragments one row into three, with every id churned`
15. `THE ROUND-TRIP INVARIANT: after every write of a deterministic sequence, every row listRanges() returns is re-acceptable at setDataType and decodable by resolveSplitTargets`
16. `planting C, OBSERVED: the same sequence through a writer without the remainder rule leaves rows the store would refuse, named by value`
17. `planting C, SELECTIVE and MEASURED: it can differ from the production path on exactly the three steps whose remainder is illegal, and is indistinguishable on the other eight`

**The five original `byte`-row overlap cases still pass unchanged** — `overlap case 1 (identical…)`, `overlap case 2 (new fully CONTAINS existing…)`, `overlap case 3 (new fully INSIDE existing (LOAD-BEARING)…)`, `overlap case 4 (overlap at the LOW end…)` and `overlap case 5 (overlap at the HIGH end…)` — and the pre-existing three-row assertion in `case 3 is the LOAD-BEARING case: the fully-contained retype produces exactly THREE rows, asserted field by field` is **untouched** (no line of it was edited). The only change inside the five-case loop is one added line asserting the retype was accepted, which is a strengthening, not a relaxation. PLANTING A and PLANTING B are likewise untouched and green.

## Decisions Made

1. **CR-09 resolved by (b) REFUSE THE WHOLE RETYPE.** Locked in the plan's `<reversibility>` block and re-recorded in `retype()`'s doc comment. Demotion to `undefined` was rejected because it destroys the recorded split orientation — a one-way data decision in the one area the module names as where one-way decisions must not be taken silently. Rounding the range outward is forbidden by trap 7. Rated `costly`, not `one-way`: relaxing the policy later needs only the gate deleted.
2. **The refusal is a shape refusal, so it lives in the shape family.** `AnnoSplitRemainderError extends AnnoRangeShapeError`.
3. **Compute, refuse, then mutate.** The gate is a separate loop preceding the mutation loop, so the guarantee does not depend on a rollback that 28-17's own `rollbackFailed` work shows can fail.
4. **The refusal message names the alternatives but never offers a widening.** It suggests extending the retype to an entry boundary or retyping the whole table; it does not say the store could have widened the range, which trap 7 forbids and which a message offering it would invite a later maintainer to implement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `anno-store.test.ts`'s reserved-`bank` control contradicted IN-06 and went red**

- **Found during:** Task 1 (GREEN)
- **Issue:** `the reserved bank field is never READ …` scanned `codeOnly(anno-store.ts)` for every line naming `bank` and allowed only two exact line shapes (`bank: row.bank,` and `bank: number | null;`). IN-06 legitimately adds four more lines that NAME a bank value — `insertRange()`'s parameter, its bind, and the two remainder call sites passing `row.bank` — plus one inline row-shape cast on `retype()`'s `select`. The control failed with those five lines as offenders. The plan's action mandates exactly those edits, so the control's absolute claim ("no line outside the row mappers may read a bank value") was the thing that had become false, not the code.
- **Fix:** narrowed the control from "never READ" to "never INTERPRETED": the five pass-through/cast line shapes are allowed by explicit regex with a comment explaining IN-06 and why carrying a value verbatim is not reading it; a **non-vacuity floor** (`bankLines.length >= 13`, measured at 14) was added so an allow-list cannot be satisfied by an empty scan; and an **unconditional** second assertion was added over the same scanned lines forbidding any line that branches on, compares, or computes with a bank value. The rule that actually matters is now asserted directly instead of being implied by an absence.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`
- **Verification:** `node --test anno-store.test.ts` green; the whole eight-file set 186/186.
- **Committed in:** `e93ddf0` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] `npx tsc` is not usable in this repo; and a named interface broke the `node:sqlite` row cast**

- **Found during:** Task 1 (GREEN)
- **Issue:** two separate blockers on the same acceptance criterion. (a) `npx tsc --noEmit -p src/mcp/vice/tsconfig.json` exits 1 with npm's "This is not the tsc command you are looking for" banner — TypeScript is a devDependency of `src/mcp/vice`, not of the repo root, and `npx` would otherwise fetch an unverified package. (b) Casting `db.prepare(...).all(...)` to the new named `OverlappedRangeRow` interface produced `TS2352: Conversion of type 'Record<string, SQLOutputValue>[]' … may be a mistake`, while the identical anonymous shape is accepted.
- **Fix:** (a) ran the project's own compiler, `src/mcp/vice/node_modules/.bin/tsc --noEmit -p tsconfig.json`, rather than installing or auto-fetching anything; (b) kept the anonymous shape on the cast — structurally identical to `OverlappedRangeRow`, which the helper still takes — with a comment recording the mechanical reason.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** `tsc --noEmit -p tsconfig.json` produces no output and exits 0.
- **Committed in:** `e93ddf0`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking).
**Impact on plan:** none on scope. Deviation 1 was mandated by the plan's own action (IN-06 changes exactly the lines that control scanned) and the control came out stronger, not weaker — it gained a non-vacuity floor and an unconditional no-interpretation assertion it did not have. Deviation 2 is a tooling-invocation correction with no behaviour change. No dependency was added, no `SCHEMA_VERSION` bump, no DDL or column-meaning change, no new CLI flag, no new result field. `setDataType`'s own entry-point validation, `contradictedCommentsFor`, and criterion 1's controls are untouched.

## Issues Encountered

- **PLANTING C's first formulation checked only the FINAL row set**, and a later step of the sequence overwrites the odd `hi_lo_address` head that step 2 produces — so the test named the wrong offender. Resolved by checking `rowsTheStoreWouldRefuse()` after **every** step (exactly as the invariant does), recording the first offending step and its offender by value, and separately recording the offender still standing at the end. That is a stronger measurement than the original, and it is why the planting reports both `4352..4356 hi_lo_address` (step 2) and `4865..4873 hi_lo_word` (final).

## Known Stubs

None. No stub, no skipped test, no `t.skip`/`test.todo`, and no `<verify>` left unrun: every task's `<automated>` command was executed with `set -o pipefail` and a real exit code recorded.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. The plan's own register (T-28-35 … T-28-40, T-28-SC) is unchanged: the five `mitigate` dispositions are all delivered by the controls recorded above, and the two `accept` dispositions stand as written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The round's tracer is verified end-to-end — caller → `setDataType` → `retype` → disk → `listRanges` → `assertRangeShape` / `resolveSplitTargets` — so plans 28-20, 28-21 and 28-22 can expand outward from a proven slice. They all rewrite or read `anno-store.ts`; the one structural thing they must not break is the gate loop preceding the mutation loop in `retype()`, which the round-trip invariant now guards.
- **One behaviour change on a shipped entry point:** `setDataType()` now THROWS `AnnoSplitRemainderError` for a retype that would leave an illegal remainder on a split-table row. Same name, same arguments, same result type, new refusal in the existing error family. Phase 29's tool path must surface it rather than swallow it.
- Not claimed and not touched: ROADMAP criterion 1 (the 12-member vocabulary, the four first-class split layouts, and the differing-resolved-target-set control with its collapse planting) — the round-5 verifier's correction is respected, those controls were not edited, and they are green.
- Carried, not lifted: the seventeen `28-EDGE-COVERAGE.json` items the plan records as carried by named executed plans of this phase. This plan re-ran the whole set as regression and added none of their claims.

## Self-Check: PASSED

- `src/mcp/vice/anno-types.ts` — FOUND
- `src/mcp/vice/anno-store.ts` — FOUND
- `src/mcp/vice/anno-overlap.test.ts` — FOUND
- `src/mcp/vice/anno-store.test.ts` — FOUND
- commit `e3adb18` — FOUND
- commit `e93ddf0` — FOUND
- commit `c2cfab2` — FOUND
- commit `1776c76` — FOUND
- plan `<verification>` re-run at close: `node --test anno-*.test.ts block-class.test.ts` → `# tests 186 / # pass 186 / # fail 0 / # skipped 0`, exit 0; `tsc --noEmit` clean, exit 0; `grep -c 'SCHEMA_VERSION = 2' anno-types.ts` → 1.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*
