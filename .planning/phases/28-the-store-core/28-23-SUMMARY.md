---
phase: 28-the-store-core
plan: 23
subsystem: database
tags: [sqlite, annotation-store, split-tables, typescript, node-test]

requires:
  - phase: 28-the-store-core
    provides: "CR-09's pre-delete parity gate in `retype()`, `remainderRefusal()`, the 210-test phase surface"
provides:
  - "`splitPartnerOffsets()` — the ONE definition of a split entry's partner offset couple, consumed by both `resolveSplitTargets()` and the writer-side gate"
  - "`splitEntryAddressPairs()` + `SplitEntryPairs` / `SplitTableSurvivor` / `SplitTableReinterpretation`"
  - "`SetDataTypeResult.reinterpretedSplitTables` — the disclosure channel for what a partial overwrite of a split table cost, in both entry-pair sets"
  - "A class-level invariant stated over ENTRY PAIRS rather than rows: no split entry pair vanishes outside the caller's own range without being named by that write's own report"
affects: [29-mcp-surface, 30-export]

actuals:
  tokens: 21508
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "The disclosure sibling: a second always-present-often-empty report field on a SUCCESSFUL write result, beside `contradictedComments`, rather than a refusal or an on-disk column"
    - "One definition, two consumers: a resolver and a writer that both read the same layout rule, proven by a planting that moves the definition and reddens the resolver's own worked-arithmetic pin"
    - "Independent-oracle test data: every expected entry-address couple in `anno-overlap.test.ts` is hand-derived from the layout rule in words; the file deliberately does not import the production pairing function"
    - "Symmetric carve-out: a set comparison's exclusion filter applied identically to both operands, because the carve-out belongs to the comparison and never to the report"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-types.test.ts
    - src/mcp/vice/anno-overlap.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "CR-10 answered with (b) — ACCEPT the even fragmentation and return the re-interpretation AS DATA — not (a) refuse. Answer (a) makes split tables editable only wholesale, and criterion 3's operative failure word is `silently`, not `preserve`."
  - "The disclosure is a RETURN CHANNEL, not a new on-disk column recording the table's original extent: a column is a `SCHEMA_VERSION` bump (28-10 P4), and this milestone's one irreversible decision is already spent on the twelve-member vocabulary."
  - "`preservedEntryPairs` is COMPUTED by comparing the before and after sets, never hardcoded to empty — it is empty today as a consequence of the layout, and a computed field stays correct if a future layout changes that."
  - "The class invariant's caller's-range carve-out is applied to BOTH sides of the comparison; one-sided reds on a correct write the moment any step covers 9+ contiguous bytes of a 16-byte split row."
  - "The `refusals >= 3` floor deliberately does NOT rise. The round-6 verifier's instruction that it should was written for answer (a); under (b) parity remains the only refusal, and the floor that rises is the new `reinterpretingSteps` one."
  - "Planting C's `damage survives to the end` claim moved to step 10, where it is still true, rather than being retired — the added twelfth step cleans the odd row up by accident, and that is recorded rather than asserted as the expectation."

patterns-established:
  - "Report both of the numbers that conflicted, where the numbers are SETS: `entryPairsBefore` and each survivor's `entryPairs`, with their computed intersection"
  - "State an invariant over the unit the property is actually about (the entry pair), not over its container (the row)"

requirements-completed: [STORE-01]

coverage:
  - id: D1
    description: "The split layout's partner rule has exactly ONE definition in the repo, consumed by both `resolveSplitTargets()` and the writer-side gate"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#CR-10: the partner rule has exactly ONE definition -- the pairs splitEntryAddressPairs reports and the targets resolveSplitTargets produces agree ENTRY FOR ENTRY"
        status: pass
      - kind: unit
        ref: "PLANTING P2 (interleaved [2i, 2i+1] couples) -> anno-types.test.ts not ok 4 + not ok 9, observed on the final tree"
        status: pass
    human_judgment: false
  - id: D2
    description: "An accepted partial overwrite of a split table returns the re-interpretation as data on the successful result — the overlapped row's identity and span, the pairs before, every survivor's span and pairs, and the pairs preserved"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#CR-10, PRODUCTION ENTRY POINTS ONLY: an even-remainder fragmentation of a split row is ACCEPTED AND REPORTED"
        status: pass
      - kind: unit
        ref: "PLANTING P1 (gate computation removed) -> anno-overlap.test.ts 9 not ok lines, observed on the final tree"
        status: pass
    human_judgment: false
  - id: D3
    description: "All five accepted geometries the round-6 verifier drove are asserted by value, each with a resolveSplitTargets before/after comparison whose intersection is 0"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#CR-10, THE TARGET-SET COMPARISON over every accepted split geometry"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#CR-10, THE ROUND-6 VERIFIER'S OWN FIVE DRIVES, re-run verbatim through production entry points"
        status: pass
    human_judgment: false
  - id: D4
    description: "The class invariant: no split entry pair vanishes outside the caller's own range without being named by that write's own report, with the carve-out applied symmetrically"
    requirement: "STORE-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#THE ROUND-TRIP INVARIANT (extended with the class assertion)"
        status: pass
      - kind: unit
        ref: "Planting A (a fragmenting step's report content suppressed) and Planting B (carve-out widened on the LOST SIDE ONLY) -> not ok 34 in both, observed on the final tree"
        status: pass
    human_judgment: false
  - id: D5
    description: "The parity gate (CR-09) is untouched: the odd fragment still refuses by name and the refusal still costs nothing"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-overlap.test.ts#CR-09, PRODUCTION ENTRY POINTS ONLY (unchanged), plus a re-drive on the final tree"
        status: pass
    human_judgment: false
  - id: D6
    description: "`.planning/REQUIREMENTS.md` moves STORE-01 to Complete on the round-6 verifier's quoted sentence, keeps STORE-03 at Gaps Found with CR-10 as the reason, and records both behavior_unverified items STILL OPEN"
    verification:
      - kind: manual_procedural
        ref: "git show --stat HEAD -- .planning lists .planning/REQUIREMENTS.md; status table and checkbox list read back and compared for all six STORE rows"
        status: pass
    human_judgment: true
    rationale: "A record edit's correctness is a judgment about whether the transcription is faithful to the verifier's sentences and whether the executor over-reached. No test can assert that; the phase verifier is the authority."

duration: 32 min
completed: 2026-08-29
status: complete
---

# Phase 28 Plan 23: Close CR-10 — the store discloses what a partial overwrite of a split table costs

**A partial overwrite of a split table now returns, as data on the successful result, the entry-address pairs the table read before and the pairs each survivor reads after — with the partner rule reduced to one definition consumed by both the resolver and the writer, and a class-level invariant over entry pairs that was observed going red on four separate plantings before it was observed green.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-08-28T23:22Z
- **Completed:** 2026-08-28T23:54Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `splitPartnerOffsets()` in `anno-types.ts` is now the only place in the repo where a split entry's partner is computed. `resolveSplitTargets()` consumes it instead of its own `n + i` loop, and the new exported `splitEntryAddressPairs()` consumes the same couples over ADDRESSES. The round-6 `✗ NOT WIRED` key link — *nothing on any write path consults the layout that determines what a split row MEANS* — is wired.
- `retype()`'s pre-delete gate builds a `SplitTableReinterpretation` per fragmented split row, AFTER both parity refusals for that row and BEFORE the first `delete`, and `setDataType()` returns them as `reinterpretedSplitTables`. A refusal still costs nothing; an acceptance is never half-applied.
- `retype()`'s DECISION 1 comment and the code below it now state one rule — closing the instance that made 28-19 P2, 28-21 P1 and 28-07 P3 read **violated** in round 6.
- `anno-overlap.test.ts:592`'s test, which pinned the corrupted three-row set BY VALUE and named the outcome legal, is rewritten. It keeps the (correct) row assertions and adds the disclosure by value plus the disjoint target-set comparison.
- The split case table grew from 8 to 10 entries with the MIDPOINT split and the SAME-TYPE subrange, all five accepted geometries assert their report by value, and the round-6 verifier's own five drives are re-run verbatim at its own caller ranges.
- The round-trip invariant now carries a class-level assertion stated over ENTRY PAIRS, with the caller's-range carve-out applied symmetrically to both sides of the comparison.

## Task Commits

1. **Task 1 (TRACER): the pairing rule gets one definition and a writer-side consumer, one geometry disclosed end-to-end** — `0df4ab3` (feat)
2. **Task 2: all five accepted geometries; the split case table stops certifying the defect** — `e606894` (test)
3. **Task 3: the class invariant, the requirement record, the closing gate** — `871de8b` (test)

**Plan metadata:** see the `docs(28-23)` commit that carries this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-types.ts` — `splitPartnerOffsets()` (private, one home for the partner rule), `assertSplitLayout()` (one home for the non-split refusal), `splitEntryAddressPairs()`, and the `SplitEntryPairs` / `SplitTableSurvivor` / `SplitTableReinterpretation` shapes beside `ContradictedComment`
- `src/mcp/vice/anno-store.ts` — `entryPairKey()`, `splitReinterpretation()`, the gate's collection loop, `retype()`'s widened return, `SetDataTypeResult.reinterpretedSplitTables`, and the rewritten DECISION 1 block
- `src/mcp/vice/anno-types.test.ts` — hand-derived pins for `splitEntryAddressPairs`, its odd-span and non-split refusals, and the one-definition agreement control (+4 tests)
- `src/mcp/vice/anno-overlap.test.ts` — the rewritten fragmentation case, the idempotency case, `ExpectedReinterpretation` and the hand-derived pair constants, two new geometries, the shared target-set control, the verifier's five drives, `splitPairsOf`/`dropContained`/`pairKey`, the class invariant, and the added `SEQUENCE` step (+4 tests)
- `.planning/REQUIREMENTS.md` — STORE-01 to `Complete` in both places, STORE-03's recorded reason corrected from CR-09 to CR-10, and both `behavior_unverified` items as explicit STILL-OPEN rows

---

## THE GATE'S NUMBERS

Recorded verbatim, because the next round's verifier reads them and five rounds of green suites have already sat on top of live blockers.

### The tracer geometry, driven through production entry points only

`setDataType($1000..$100f, "lo_hi_address")` then `setDataType($1004..$1007, "byte")`:

- `changed: true`, `contradictedComments: []`, `reinterpretedSplitTables.length === 1`
- `rowId: 1`, `rowStart: 4096 ($1000)`, `rowEndInclusive: 4111 ($100f)`, `dataType: lo_hi_address`, `entryCountBefore: 8`
- **`entryPairsBefore` (all eight):** `[$1000,$1008] [$1001,$1009] [$1002,$100a] [$1003,$100b] [$1004,$100c] [$1005,$100d] [$1006,$100e] [$1007,$100f]`
- **survivor 0 (HEAD)** `$1000..$1003`, `entryCount 2`, pairs `[$1000,$1002] [$1001,$1003]`
- **survivor 1 (TAIL)** `$1008..$100f`, `entryCount 4`, pairs `[$1008,$100c] [$1009,$100d] [$100a,$100e] [$100b,$100f]`
- **`preservedEntryPairs.length === 0`**
- **within-record survivor order:** `survivors[0]` is the HEAD `$1000..$1003` and `survivors[1]` is the TAIL `$1008..$100f` — asserted, not merely observed
- **`summary`, verbatim:**

> `typing 4100..4103 ($1004-$1007) fragments range id 1 (4096..4111, $1000-$100f, lo_hi_address, 8 entries), leaving 4096..4099 ($1000-$1003, 2 entries) and 4104..4111 ($1008-$100f, 4 entries). A split table pairs byte i with byte n + i, so changing either end re-pairs every entry: 0 of 8 entry-address pairs are preserved. The surviving row(s) are still legal and still decode -- they decode to DIFFERENT 16-bit values than the ones recorded here.`

**Row set, unchanged from before this round and recorded by value:** `$1000..$1003 lo_hi_address`, `$1008..$100f lo_hi_address`, `$1004..$1007 byte`.

**Target-set comparison, as two lists.** Original eight over the `00 01 02 ... 0f` image: `$0800 $0901 $0a02 $0b03 $0c04 $0d05 $0e06 $0f07`. Union of the surviving split rows' targets: `$0200 $0301 $0c08 $0d09 $0e0a $0f0b`. **Intersection size: 0.**

### All five accepted geometries, re-driven on the FINAL tree

| geometry | caller range | surviving split rows | surviving target set | ∩ with the original 8 | the store's report |
|---|---|---|---|---|---|
| mid EVEN fragment | `setDataType($1004..$1007, byte)` | 2 | `$0200 $0301 $0c08 $0d09 $0e0a $0f0b` | **0** | 1 record, 8 pairs before, survivors `$1000..$1003`/2 + `$1008..$100f`/4, preserved 0 |
| head-overlap | `setDataType($0ffe..$1003, byte)` | 1 | `$0a04 $0b05 $0c06 $0d07 $0e08 $0f09` | **0** | 1 record, 8 pairs before, survivor `$1004..$100f`/6, preserved 0 |
| tail-overlap | `setDataType($100c..$1011, byte)` | 1 | `$0600 $0701 $0802 $0903 $0a04 $0b05` | **0** | 1 record, 8 pairs before, survivor `$1000..$100b`/6, preserved 0 |
| midpoint split | `setDataType($1008..$100f, byte)` | 1 | `$0400 $0501 $0602 $0703` | **0** | 1 record, 8 pairs before, survivor `$1000..$1007`/4, preserved 0 |
| SAME-TYPE subrange | `setDataType($1004..$1007, lo_hi_address)` | 3 | `$0200 $0301 $0c08 $0d09 $0e0a $0f0b $0604 $0705` | **0** | 1 record (ONE overlapped row), 8 pairs before, survivors `$1000..$1003`/2 + `$1008..$100f`/4, preserved 0 |

Every one of the five reproduces the round-6 verification report's own numbers exactly. Every intersection is the number **0**, not an adjective. **The difference this round makes is the last column: the report says the call was silent; it is not any more.**

**The two full-cover geometries report an empty array**, and the reason is quoted from the test's own message: *"a full cover leaves no surviving split row to compare, so no preservation is claimed"* / *"a full cover is a deletion, and a deletion is already visible in the row set"*.

**The five pre-existing NON-split cases each report an empty array** — asserted per case in the `CASES` loop with the message *"a NON-SPLIT overlapped row is re-paired by nothing, so the write reports no re-interpretation"*. This is the control that stops "reports nothing anywhere" from satisfying every split-side assertion by being empty everywhere.

**Idempotency:** the identical repeat of an accepted fragmenting write reports `changed: false` and `reinterpretedSplitTables: []`. A second disclosure of a fragmentation that already happened would be a false report.

### The CR-09 refusal drive, re-driven on the final tree

`setDataType($1004..$1004, "byte")` on the same seed:

- throws `AnnoSplitRemainderError`
- rows **before**: `[[1, $1000, $100f, lo_hi_address]]`
- rows **after**:  `[[1, $1000, $100f, lo_hi_address]]` — byte-identical, ids included
- revision **before 1**, **after 1** — did not move

The parity gate was not weakened to buy the acceptance.

### The four re-derived `SPLIT_CASES` counts (before → after)

| count | before | after | note |
|---|---|---|---|
| table length | 8 | **10** | the midpoint split and the same-type subrange added |
| refusing entries | 3 | **3** | **UNCHANGED** — see the refusal-floor explanation below |
| row-set-by-value entries | 5 | **7** | |
| entries carrying a non-empty `reinterpreted` | (did not exist) | **5** | the new floor: a table that quietly lost a fragmenting geometry is now visible |

### The five `SEQUENCE` non-vacuity floors (before → after)

| floor | before | after |
|---|---|---|
| accepted writes | `>= 8` | `>= 9` |
| refusals | `>= 3` | **`>= 3` (unchanged)** |
| final row count | `=== 13` | `=== 14` |
| final split rows | `>= 4` | `>= 4` (observed 7 both ways) |
| steps returning a non-empty report | (did not exist) | `=== 5` |
| total entry pairs reported lost | (did not exist) | `=== 42` |

**Why the refusal floor did NOT rise, quoted from the test's own comment:**

> The round-6 verification report's `missing` item 3 says "the `refusals >= 3` non-vacuity floor rises with them" — that sentence was written for ANSWER (a), which refuses every partial overlap of a split row. The answer actually taken is (b): the even fragmentation is ACCEPTED and REPORTED, so parity remains the ONLY thing this store refuses and the three parity refusals are still the whole refusal set. The floor that rises instead is `reinterpretingSteps` immediately below. The divergence from the verifier's instruction is recorded here rather than left to look like a forgotten line.

### The added two-row `SEQUENCE` step — the report's ARRAY ORDER

- **caller range:** `$120e..$1301`, `byte`, `expect: accepted`, `expectReinterpretedRows: 2`
- **rows read from `listRanges()` BEFORE the write** (the plan's arithmetic was verified against the tree, not trusted — and the tree agreed):
  - `id=12  $1206..$120f  lo_hi_word`  → head remainder `$1206..$120d`, 8 bytes, **even**
  - `id=14  $1300..$1309  hi_lo_word`  → tail remainder `$1302..$1309`, 8 bytes, **even**
- **the two records the store returned**, in the order it returned them:
  - `rowId 12`, `$1206..$120f lo_hi_word`, 5 pairs before, survivor `$1206..$120d`/4, preserved 0
  - `rowId 14`, `$1300..$1309 hi_lo_word`, 5 pairs before, survivor `$1302..$1309`/4, preserved 0
- **returned `rowId` sequence:** `[12, 14]` — ascending, and **equal to the two overlapped rows' ids read from `listRanges()` before the write and sorted ascending**, which is what the test asserts rather than a pinned literal.
- **DID ID ORDER AND ADDRESS ORDER AGREE FOR THIS STEP? YES.** Row 12 starts at `$1206` and row 14 at `$1300`, so ascending id and ascending address coincide here. The case therefore does not *discriminate* the two orders by producing a disagreement — what makes the assertion non-vacuous is that the expectation is **derived from the store's own reported ids**, not from address arithmetic, so a future re-insertion that breaks the coincidence would be caught rather than silently accommodated. Recorded plainly so a later reader is not misled into thinking a disagreement was observed.

### Every planting, re-observed on the FINAL tree and restored to an empty diff

| # | planting | file run | `not ok` (first line quoted) | counts | restore |
|---|---|---|---|---|---|
| P1 | reinterpretation computation removed from the gate | `anno-overlap.test.ts` | `not ok 12 - CR-10, PRODUCTION ENTRY POINTS ONLY: an even-remainder fragmentation of a split row is ACCEPTED AND REPORTED -- the three rows are correct and the store names both entry-pair sets` | `# pass 27 / # fail 9` | `git diff --stat -- src/mcp/vice` **empty** |
| P2 | `splitPartnerOffsets` interleaved to `[2i, 2i+1]` | `anno-types.test.ts` | `not ok 4 - criterion 1's control: the fixture is non-degenerate FIRST, and then a lo_hi_address reading and a hi_lo_address reading of it produce DIFFERING target sets` | `# pass 16 / # fail 2` | **empty** |
| T2 | midpoint entry's `reinterpreted` expectation emptied by hand | `anno-overlap.test.ts` | `not ok 24 - split overlap case 5 (MIDPOINT split -- the caller's range abuts the table's exact halfway point) over $1000..$100f lo_hi_address -> row set by value` | `# pass 33 / # fail 3` | **empty** |
| T3-A | one accepted FRAGMENTING step's report content suppressed (`$1102..$1109` claims everything preserved) | `anno-overlap.test.ts` | `not ok 34 - THE ROUND-TRIP INVARIANT: after every write of a deterministic sequence, every row listRanges() returns is re-acceptable at setDataType and decodable by resolveSplitTargets` | `# pass 35 / # fail 1` | **empty** |
| T3-B | carve-out widened by one address either side **on the LOST SIDE ONLY** | `anno-overlap.test.ts` | `not ok 34 - THE ROUND-TRIP INVARIANT: ...` | `# pass 35 / # fail 1` | **empty** |

**P1's decisive detail:** the failure is `expected: 1, actual: 0` on `assert.equal(result.reinterpretedSplitTables.length, 1, "one overlapped split row was fragmented, so one record")` — an assertion that sits AFTER the three row-set assertions in the same test, so **those three still passed**. That is what proves the new control measures the DISCLOSURE and not the row set.

**P2 is the only evidence in this round that the partner rule's definition actually MOVED.** It went red, on criterion 1's own worked-arithmetic pin (`the low-high reading, verified arithmetically during research`). A green run there would have meant `resolveSplitTargets` kept its own copy of the rule and the refactor was cosmetic.

**T3-A names the unreported couples BY VALUE**, which is what the class assertion is for:

> `step 3 (...): a split entry pair vanished outside the caller's own range and the write did not name it. ... lost-and-unreported: ($1100,$1108) ($1101,$1109) ($1102,$110a) ($1103,$110b) ($1104,$110c) ($1105,$110d) ($1106,$110e) ($1107,$110f) ; reported-but-not-lost: (none)`

**T3-B fired on the `$1102..$1109` step, exactly as the plan predicted**, and the difference is exactly the two couples the widened range wholly contains and the true range does not:

> `reported-but-not-lost: ($1101,$1109) ($1102,$110a)`

Widening the carve-out on BOTH sides is deliberately not a planting: `F` applied identically to two equal sets stays equal for any `F`, so a symmetric widening cannot go red and asserting that it does would be vacuous (28-22 P1).

### The `n + i` grep — the LINE, not the count

```
$ grep -n 'n + i' src/mcp/vice/anno-types.ts | grep -vE ':[[:space:]]*(//|\*|/\*)'
1441:  for (let i = 0; i < n; i += 1) offsets.push([i, n + i] as const);
```

Count: **1**, before and after. Before this round the single hit was `1350:    const second = source[n + i] & 0xff;` — **inside `resolveSplitTargets` itself**. It is now `1441`, **inside `splitPartnerOffsets` (declared at `:1431`)**. The count alone cannot tell those two apart, which is why the line is the recorded value. This grep is *not* the evidence the refactor landed — P2 is.

Two further greps, both recorded as **regression checks rather than as passes**, since both were already at their target values before this round:

- `sed -n '1,60p' src/mcp/vice/anno-overlap.test.ts | grep -c 'splitEntryAddressPairs'` → **0** (was already 0 — the symbol did not exist; it can only catch a regression this round introduced)
- `grep -vE '^\s*(//|\*|/\*)' src/mcp/vice/anno-overlap.test.ts | grep -c 'LEGAL remainder'` → **0**, where it was **1** before this round

### The suite

| gate | command | result |
|---|---|---|
| phase-scoped surface | `node --test anno-*.test.ts block-class.test.ts` | `# tests 218 / # pass 218 / # fail 0 / # skipped 0`, **real exit 0** |
| typecheck | `./node_modules/.bin/tsc --noEmit` | no output, **exit 0** |
| docs guards (regression) | `node --test docs-review-disposition.test.ts audit-integrity.test.ts` | `# tests 51 / # pass 51 / # fail 0 / # skipped 0`, **exit 0** |

**Derived expectation vs observed, for the phase surface.** Baseline 210 (measured on the tree 28-22 left, real exit 0). Task 1 added 4 tests (`139 → 143` on its own file set); task 2 added 4 (`32 → 36` on `anno-overlap.test.ts`); task 3 added 0 new test cases — it extended existing ones rather than adding cases. Derived: `210 + 4 + 4 + 0 = 218`. **Observed: 218. No difference to explain.**

**Docs guards are recorded as an UNCHANGED NON-REGRESSION.** Both were measured green at plan time (51/51) and this plan dispositions nothing in `28-REVIEW.md` and repairs nothing in them. They cannot go red here, so no acceptance criterion took the form "make that guard go green" (28-22 P1).

### Structural invariants, re-observed

- `SCHEMA_VERSION` unchanged at **2** (`anno-types.ts:154`)
- **No DDL change**: `git diff b681488..HEAD` over `anno-store.ts` / `anno-types.ts` matches no `create table` / `create index` / `alter table` / `SCHEMA_VERSION` assignment line — the single hit is a COMMENT in DECISION 1 explaining why a column was rejected
- **No on-disk directory-layout change**
- `node:sqlite` still named by exactly **one** shipped module: `anno-store.ts`

### `.planning/REQUIREMENTS.md` — the six STORE rows, both places, read back and compared

| requirement | status table | checkbox list | agree? |
|---|---|---|---|
| STORE-01 | `Complete` | `[x]` | ✓ |
| STORE-02 | `Complete` | `[x]` | ✓ |
| STORE-03 | `Gaps Found` | `[ ]` | ✓ |
| STORE-04 | `Complete` | `[x]` | ✓ |
| STORE-05 | `Complete` | `[x]` | ✓ |
| STORE-07 | `Complete` | `[x]` | ✓ |

`git show --stat HEAD -- .planning` on `871de8b` lists `.planning/REQUIREMENTS.md | 17 +++++++++++++----` — the record deliverable is in the commit. (Worktree isolation was forbidden for this plan and none was used; the plan ran sequentially on the main working tree.)

**The STORE-01 authorising sentence, quoted verbatim** from `.planning/phases/28-the-store-core/28-VERIFICATION.md`, §2 (the paragraph beginning *"STORE-01 is a change from round 5 and I state the reason"*):

> **STORE-01 is a change from round 5 and I state the reason.** Round 5 blocked STORE-01 on CR-09 with the stated reason "the store persists a per-range typing it refuses at its own entry point and its own resolver cannot decode." Neither half of that sentence is true any longer: every row CR-10 produces is re-acceptable and decodable. CR-10 attaches to the partial-overwrite clause, which is STORE-03's, not STORE-01's. **STORE-01 is SATISFIED and its row may move to `Complete`; this is the authorising verdict.** STORE-03 stays `Gaps Found`.

**The STORE-03 blocking sentence, quoted verbatim** from the same file's §Requirements Coverage table, STORE-03 row:

> The first two clauses hold (oracle cross-validation, both ends, `$FFFF`, tie-break, length-1). The third does not: the partial-overwrite behaviour for the four split members is pinned to an outcome that discards every recorded target (`preserved 0/8` across five geometries). CR-10.

Both are transcribed into `REQUIREMENTS.md` with the source file and section named. **`requirements.mark-complete` was NOT run for STORE-03** under any circumstance (28-18 P2). This round is EXECUTED, not VERIFIED, and STORE-03 moves only when a verification pass says so — stated in the file's own words.

### Both `behavior_unverified` items — STILL OPEN, claimed by nothing here

`grep -c 'integrity_check' .planning/REQUIREMENTS.md` → **1**. Both rows are recorded in the file, with their reasons unchanged:

| Item | Status after round 6 | Reason, carried unchanged |
|---|---|---|
| `openStore`'s `integrity_check could not be run at all` throw arm (`anno-store.ts:529-535`) | **STILL OPEN** — open since round 4 | *"The arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection. Presence and wiring verified in source this round (`db.close()` precedes the throw, and the message names `resolved`); no test exercises the throw, and a 10-second spot-check cannot construct the precondition."* Nothing in 28-23 touches `openStore`. |
| 28-17's `backstop`-tagged host-crash durability bound across `stageSnapshot` fsync → `publishSnapshot` rename → pointer-row commit | **STILL OPEN** — abstained again as `insufficient_spec` | *"An `fsync` has NO in-process observable, so the only in-process evidence is the SOURCE ORDER of two `fsyncPath()` calls — which is presence, not behaviour. 28-17 filed this honestly as `backstop`. Presence + wiring never qualify as behavioural evidence for a durability claim."* Nothing in 28-23 touches the snapshot path. |

Neither is promoted. Neither is claimed closed.

---

## Decisions Made

1. **Answer (b), executed rather than re-litigated.** The plan had already taken the decision; this execution carried it out. The arithmetic that settles it is now in `retype()`'s DECISION 1 and in `SplitTableReinterpretation`'s doc block: a surviving fragment of `m` entries pairs its own byte `j` with its own byte `m + j`, which matches an original pair only when `m == n`. No proper fragment preserves a single pair, at any boundary, the midpoint included.
2. **`assertSplitLayout()` extracted.** `resolveSplitTargets()` and `splitEntryAddressPairs()` must refuse a non-split type identically; two copies of the refusal would be two homes for one fact. Same argument as the partner rule itself.
3. **`splitPartnerOffsets(byteCount, layout)` owns the odd-byte-count refusal**, so `resolveSplitTargets()` no longer keeps its own copy of that message either. The layout parameter exists purely so the message can name the layout, which the pre-existing `anno-types.test.ts` refusal test asserts.
4. **`splitReinterpretation()` returns `null` for a non-split row and for a full cover**, rather than an empty record. A full cover is a deletion and already visible in the row set; claiming a record for it would report a preservation nobody asked about.
5. **Planting C's survival claim moved to step 10 rather than retired.** See the deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The added twelfth `SEQUENCE` step destroyed planting C's surviving-offender evidence**

- **Found during:** Task 3
- **Issue:** The plan's named ordering step `$120e..$1301` is arithmetically correct for the production path (verified against `listRanges()` on the real tree — the tree agreed with the plan exactly). But under **planting C** (the writer without the remainder rule) the odd row left standing at the end of the original eleven steps is `$1301..$1309 hi_lo_word`, and the new step clips exactly one byte off its head, leaving an EVEN `$1302..$1309` — a row the store would accept. Planting C's assertion *"one survives all the way to the end, so the damage is not merely transient"* therefore went red with `actual: []`. Re-deriving that assertion to `[]` and calling it the expectation would have quietly retired a control that still discriminates.
- **Fix:** Captured the planting's refused-row set at the end of step 10 as well, asserted the surviving `$1301..$1309 hi_lo_word` **there** (where the claim is still true, across all eleven original steps), and asserted the now-empty final set separately with a comment recording that the twelfth step cleans it up **by accident**, for a reason unrelated to the remainder rule. The plan's named step is kept verbatim.
- **Files modified:** `src/mcp/vice/anno-overlap.test.ts`
- **Verification:** `node --test anno-overlap.test.ts` → 36/36, real exit 0; planting C still asserts `firstOffendingStep === 2` and names the offender by value.
- **Committed in:** `871de8b`

**2. [Rule 1 - Bug] Planting C's selectivity counts moved with the added step**

- **Found during:** Task 3
- **Issue:** `identical` was pinned to `[0, 1, 3, 5, 7, 8, 9, 10]` and the test name said "the other eight". Applied ALONE to the seed, step 11's two remainders (`$1200..$120d` and `$1302..$130f`, 14 bytes each) are both even, so the planting is indistinguishable from production **on the row set** and index 11 joins `identical`.
- **Fix:** Re-derived to `[0, 1, 3, 5, 7, 8, 9, 10, 11]` and renamed to "the other nine", with a comment recording *why* step 11 lands in `identical` rather than `differs`: what distinguishes the two paths there is the REPORT, which a row-set comparison structurally cannot see — which is precisely why the class invariant is stated over entry pairs. `differs` is unchanged at `[2, 4, 6]`.
- **Files modified:** `src/mcp/vice/anno-overlap.test.ts`
- **Verification:** as above.
- **Committed in:** `871de8b`

**3. [Rule 3 - Blocking] The class-invariant planting had to suppress report CONTENT, not the record**

- **Found during:** Task 3
- **Issue:** The plan's first invariant planting is "return an empty array for that one row". Doing exactly that trips the *per-step count* assertion (`expectReinterpretedRows`) first, which reports `0 !== 1` and never reaches the class assertion — so the criterion's requirement that the invariant "names the unreported couples by value" could not be satisfied by that edit.
- **Fix:** Both variants were driven. The record-suppressing variant is recorded as red at the count guard (`step 3 ... 0 !== 1`); the variant reported in the planting table keeps the record so the count still matches and makes its content claim everything preserved — the *silent* form of the same defect — which reaches the class assertion and names all eight couples by value. This is a strictly stronger planting: it defeats the count guard and is still caught.
- **Files modified:** none permanently — hand edit to `src/mcp/vice/anno-store.ts`, restored to an empty `git diff --stat -- src/mcp/vice`.
- **Verification:** `not ok 34`, `# pass 35 / # fail 1`, message quoted above.
- **Committed in:** n/a (planting, reverted)

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3).
**Impact on plan:** All three are consequences of the plan's own named additions rather than scope changes. No production behaviour differs from what the plan specified; no existing control was retired, and the one control the added step would have silently weakened was repaired to keep discriminating. No scope creep.

## Issues Encountered

**A `git checkout -- anno-store.ts` during Task 1's first P1 restore reverted the whole file, not just the planting.** Task 1 was not yet committed, so `git checkout` restored to `b681488` and discarded the task's production work along with the planting. All `anno-store.ts` edits were re-applied and re-verified (`tsc --noEmit` clean, 143/143 green) before proceeding. Every later planting was hand-reverted with the inverse edit; only the final-tree re-observations (after all three commits) used `git checkout`, where it is safe by construction. Recorded because it cost time and because the lesson generalises: **`git checkout` is not a planting-restore mechanism until the work being planted into is committed.**

**One item the plan asked for was resolved by doing both readings rather than choosing.** Task 2's `<behavior>` names the round-6 verifier's own head-overlap (`$0ffe..$1003`) and tail-overlap (`$100c..$1011`) drives, while its `<action>` says only two geometries are missing from the table (whose case-4 and case-5 even entries use different ranges, `$0ff8..$1007` and `$1008..$101f`). Rather than rewriting existing entries, the table grew by the two named additions AND a dedicated test re-runs the verifier's five drives verbatim at its own caller ranges. The SUMMARY table above therefore matches the verification report line for line, and the case table keeps its own coverage.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **STORE-01 is at `Complete`** on the round-6 verifier's own authorising sentence. **STORE-03 remains at `Gaps Found` with CR-10 as its recorded reason**, and moves only when a verification pass scores this tree. This round is executed, not verified.
- The phase-scoped surface is at `218/218`, real exit 0, above the 210 baseline; `tsc --noEmit` clean; both docs guards unchanged at 51/51.
- **Both `behavior_unverified` items remain OPEN** and are claimed by nothing here. They need host- or SQLite-level fault injection.
- **For Phase 29:** `SetDataTypeResult.reinterpretedSplitTables` is a new field on a contract with **zero production callers today** (every reference outside `anno-store.ts` is in a test file). It is revertible in-tree by `git revert` until Phase 29 publishes it on the MCP surface — at which point it becomes a published contract and the reversibility rating hardens. Phase 29 should surface it on `anno_set_data_type`'s result, because the proxy validates nothing and an agent-driven caller is exactly the caller that most needs to be told what an edit cost.
- **Known limit, carried:** the class invariant is driven over a deterministic finite sequence, so it is direct evidence for the geometries that sequence constructs and a **backstop** for the unbounded space of reachable start/end pairs. No property-based sweep over all 65,536 address pairs is run.

## Known Stubs

None.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-29*

## Self-Check: PASSED

All five modified files exist on disk. All four commits (`0df4ab3`, `e606894`, `871de8b`, `cc54e35`) are present in `git log --oneline --all`. The plan-level `<verification>` commands were re-run on the final tree and are recorded above under THE GATE'S NUMBERS.
