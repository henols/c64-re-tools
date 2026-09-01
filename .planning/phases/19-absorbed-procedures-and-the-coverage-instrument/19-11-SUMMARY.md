---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 11
subsystem: testing
tags: [anno, coverage-instrument, dispatch-scan, 6502, stack-return-idiom, split-tables, negative-controls]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-10's `DISPATCH_CONTEXT_SHAPES`, `GATE_INTERIOR_DECLARATIONS` and the `reachesGateInterior()` witness, which this plan extends rather than re-invents"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-08's class-3 five-condition gate and the `provenDispatchTargets()` single seam — the conditions this plan ports to class 4"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-14's CR-02 disposition, which made the full-suite gate honest"
provides:
  - "The class-4 stack-return scan held to class 3's standard before it may feed `provenDispatchTargets()`: same-index-register match, and every published entry point strictly in-image AND decodable as a legal non-truncated instruction"
  - "`isPlausibleEntryPoint()` — the ONE entry-point predicate, extracted so class 3's condition (e) and class 4's condition (d) are the same code rather than the same intention"
  - "`STACK_RETURN_MIXED_REGISTERS` and `STACK_RETURN_IMPLAUSIBLE_TARGET` — the class-4 negative controls the scan never had, both declared in `GATE_INTERIOR_DECLARATIONS` and mechanically witnessed as INTERIOR to the five-instruction window"
  - "A rebuilt `STACK_RETURN` fixture whose table bytes name three real entry points outside the idiom's own instruction stream, replacing a committed assertion that pinned a mid-instruction address"
  - "The class-3 leading-load consumption rule: only a PROVEN pairing consumes its leading load, so an unrelated indexed load between the two halves of a real split table no longer erases it"
  - "`SPLIT_TABLE_CLEAN` / `SPLIT_TABLE_INTERPOSED` — a two-payload comparison control asserting the interposed variant reports identically to the clean one, by deep-equality against the live baseline"
  - "`MULTIPLE_ADVISORY_PAIRINGS` — makes 'at most one advisory candidate per leading load' non-vacuous"
  - "`polarity` on every `GATE_INTERIOR_DECLARATIONS` row, so an interior POSITIVE control is recorded as one instead of being filed under a table introduced for negative ones"
affects: [phase-20 decomposition sweep, phase-21 hazard report, 19-VERIFICATION re-run]

actuals:
  tokens: 51800
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One predicate, two consumers: when two halves of a seam are meant to be held to the same standard, the standard is a shared function, not two copies of the same intention — WR-14 existed for exactly as long as the decodability test lived in only one of them"
    - "Register-agnostic interior witness: the condition UNDER TEST must be excluded from the interior predicate, or the control that isolates that condition sits outside the very predicate it constrains"
    - "Evidence-bounded walk: where an entry count is derived from arithmetic over two base addresses, the walk stops at the first implausible value and RAISES a truncation flag — the bound is the tighter of the arithmetic and the evidence"
    - "Declared polarity: a control declares whether it asserts an ACCEPT or a DECLINE, and the shape-coverage rule counts only declines, so adding a positive control cannot silently satisfy a shape's need for a negative one"
    - "Twin derived by insertion: the interposed-load payload is built from the clean prologue by splicing in the one differing instruction, so 'identical except for the interposed load' is true by construction and the asserted claim is the SCAN's output equality instead"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-coverage.ts
    - src/mcp/vice/anno-coverage.test.ts
    - .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md

key-decisions:
  - "WR-14 disposition: FIXED-AND-CITED. The class-4 scan was gated, not deleted and not demoted to advisory — the idiom is real and its push-order lo/hi justification is sound, so the defect was the missing gate."
  - "WR-15 disposition: FIXED-AND-CITED. Only the proven branch consumes the leading load; the advisory branch remembers its first candidate and keeps scanning."
  - "The same-index-register check runs BEFORE class 4 claims its window. A mismatched-register window is not class 4's, so class 3 must stay free to report the pairing — which it does, as an advisory candidate with no targets. Declining a window must not become silence."
  - "A class-4 walk with zero surviving entry points pushes NO finding (the plan's literal instruction) but raises the scan-level `truncated` flag, so the under-report is visible rather than a clean empty list. A finding claiming `entries: 0` would have been a new shape for Phase 21's consumers."
  - "No new id was added to `DISPATCH_CONTEXT_SHAPES`: 19-10 already minted `stack-return-push-idiom`, and adding a third id without a third true-returning branch in `hasDispatchContext()` would have reddened 19-10's source-derived count assertion — correctly."
  - "`reachesGateInterior()`'s `stack-return-push-idiom` predicate gained the class-4 window route and is REGISTER-AGNOSTIC there. Requiring the register match would have put the mismatched-register control outside the predicate it constrains — CR-04's exact defect."
  - "The scan-level `truncated` flag is now raised only for a finding that is actually emitted, so evaluating more class-3 pairings (a consequence of the WR-15 fix) cannot manufacture truncation noise."

patterns-established:
  - "Correction, not relaxation: when a fix changes a committed assertion, the SUMMARY records the old value, the new value and why the old one was wrong — so a future reader cannot mistake it for a test weakened to fit an implementation (T-19G-11-05)"
  - "Non-vacuity precondition counted, not claimed: 'the leading load has two possible second loads' is derived from the decoded stream inside the test that depends on it"

requirements-completed: [COV-02, COV-01]

coverage:
  - id: D1
    description: "The class-4 stack-return scan requires both loads to index through the SAME register before it may claim its window or feed `provenDispatchTargets()`"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different index registers"
        status: pass
      - kind: other
        ref: "observed RED against the unfixed scan before the fix — pre-fix values recorded in ## Fail-First Record below"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every class-4 entry point is checked against the same plausibility predicate class 3 uses — strictly in-image and decodable as a legal, non-truncated instruction — and the walk stops at the first implausible value, raising the scan-level truncated flag rather than publishing it"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#dispatch class 4 DECLINES a window whose reconstructed entry point does not decode as a legal instruction"
        status: pass
      - kind: other
        ref: "observed RED against the unfixed scan before the fix — a $02 (jam) target changed nothing pre-fix"
        status: pass
    human_judgment: false
  - id: D3
    description: "The committed class-4 positive fixture no longer proves a mid-instruction address: `STACK_RETURN`'s table bytes name three real entry points, none of which falls inside any instruction of the idiom's own five-instruction window"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#dispatch class 4: the stack-return dispatch idiom is found even though it contains no indirect-jump opcode"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both class-4 negative controls are declared in `GATE_INTERIOR_DECLARATIONS` and mechanically witnessed as reaching the INTERIOR of the class-4 window, and the register-agnostic witness is shown to be neither always-true nor always-false"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#every gate-interior declaration is mechanically TRUE, not a claim in a table"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#NON-VACUITY: the witness DECLINES an outside-bracketing payload offered as the zero-page vector shape's interior control"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#every shape the dispatch predicate accepts is claimed by an interior declaration"
        status: pass
    human_judgment: false
  - id: D5
    description: "A proven split-table pairing survives an unrelated indexed load between its two halves: the interposed variant reports `splitTables.length === 1` with deep-equal targets and a deep-equal `provenDispatchTargets()` result against the clean payload"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#a PROVEN split table survives an unrelated indexed load between its two halves (WR-15)"
        status: pass
      - kind: other
        ref: "observed RED against the unfixed loop before the fix — proven 0 / advisory 2 / proven targets 0, recorded in ## Fail-First Record"
        status: pass
    human_judgment: false
  - id: D6
    description: "At most one advisory candidate is emitted per leading load, a leading load with a proven pairing emits none, and the two committed controls that depend on the single-candidate property still observe it"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#only a PROVEN pairing consumes its leading load, and at most one advisory candidate is emitted per leading load"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#dispatch class 3 DECLINES an ordinary two-table indexed read loop"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#a false-positive control fixture is committed for the census, and the census declines to inflate on it"
        status: pass
    human_judgment: false
  - id: D7
    description: "The instrument stays read-only by construction and the FP2 interior control from 19-10 still declines — this run reopened nothing (COV-01 / concurrency)"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#the coverage module contains no file-write call, no project-save call and no live-session import"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#a zero-page vector that is BUILT and then read through as data is not dispatch context, and the census does not inflate on it"
        status: pass
    human_judgment: false

# Metrics
duration: 30 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 11: Class-4 Gate and the Leading-Load Consumption Rule Summary

**The class-4 stack-return scan is now held to class 3's standard before it may seed a recursive descent — same-index-register match plus a decodable, in-image entry point — with the two negative controls it never had; and only a PROVEN split-table pairing consumes its leading load, so an unrelated indexed load between the two halves of a real dispatch table no longer erases it.**

## Findings dispositioned

Both are recorded **fixed-and-cited**:

| Finding | Disposition | Fixed by |
|---|---|---|
| **WR-14** — the class-4 stack-return scan feeds `provenDispatchTargets()` with no register match, no target plausibility, a guessed entry count and no negative control | fixed-and-cited | `c95bdaf` |
| **WR-15** — one unrelated indexed load between a genuine split-table pair silently downgrades the whole pairing to advisory | fixed-and-cited | `084f17a` |

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-25T07:47:42Z (bounded by wave 1's last commit; `PLAN_START_TIME` was not captured)
- **Completed:** 2026-08-25T08:17:35Z
- **Tasks:** 2
- **Files modified:** 3 (2 source, 1 planning ledger)

`actuals.tokens` is `chars/4` over the two changed source files (207,163 chars → 51,800), the same scale the plan's `estimate: 75000` used. The diff alone is 50,135 chars (≈12,500) — recorded here so neither figure is hidden.

## Accomplishments

- **The seam is gated on both sides.** 19-08 gated class 3 behind five conditions and called `provenDispatchTargets()` "the ONE seam that decides what may seed a recursive descent". Class 4 poured into that same seam and satisfied none of them. It now satisfies the two that were missing, and the entry-point predicate is *shared code* rather than two copies of the same intention.
- **The walk is bounded by evidence, not by arithmetic.** The class-4 entry count is derived from the distance between the two table bases and is therefore a guess. The walk now stops at the first implausible value, marks the finding truncated and raises the scan-level `truncated` flag — so a cut-short walk is reported instead of shown as a clean empty list.
- **The positive fixture stopped proving a mid-instruction address.** See ## The `STACK_RETURN` correction.
- **A real dispatch table is no longer erased by an unrelated load.** See ## The WR-15 two-payload comparison.
- **Every new control declares its position AND its polarity**, and both are mechanically checked by the mechanism 19-10 installed.

## Task Commits

1. **Task 1: gate the class-4 stack-return scan, rebuild its fixture, add its negative controls** — `c95bdaf` (fix)
2. **Task 2: only a proven pairing consumes its leading load** — `084f17a` (fix)
3. **Deferred-item log** (out-of-scope observation, see ## Issues Encountered) — `109231e` (docs)

**Plan metadata:** see the `docs(19-11)` commit that carries this file.

## Files Created/Modified

- `src/mcp/vice/anno-coverage.ts` — the gated class-4 scan, the extracted `isPlausibleEntryPoint()` predicate, and the corrected class-3 leading-load consumption rule
- `src/mcp/vice/anno-coverage.test.ts` — the class-4 negative controls with their interior declarations, the rebuilt `STACK_RETURN` fixture, the WR-15 two-payload comparison, the multi-advisory non-vacuity payload, and the `polarity` field on every declaration row
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/deferred-items.md` — item 3, the load-sensitive session timeout test

## Fail-First Record

Every value below was **observed against the shipped code at this wave's HEAD** (`cdf60bc`, i.e. after 19-10 and 19-14) before any fix was written, by running the real `scanIndirectDispatch()` and `provenDispatchTargets()` over the payloads.

### Class-4 control 1 — mismatched index registers (`STACK_RETURN_MIXED_REGISTERS`)

`lda $c010,x : pha : lda $c013,y : pha : rts` — two tables walked by two different registers.

| | pre-fix | post-fix |
|---|---|---|
| `stackReturnDispatch` | 1 finding: `loBase $c013`, `hiBase $c010`, `entries 3` | `[]` |
| `targets` | `[$c006, $c006, $c006]` against the originally-committed table bytes; `[$c00a, $c00c, $c00e]` against the rebuilt ones | — |
| `provenDispatchTargets()` | `[$c006]` (originally-committed bytes) / `[$c00a, $c00c, $c00e]` (rebuilt) | `[]` |
| `tableEntryAddresses` | 6 addresses claimed | `[]` |
| `splitTableCandidates` | `0` | `1`, `orientationResolved: false`, `targets: []` |

The post-fix advisory candidate is deliberate: class 4 declines the window **without claiming it**, so class 3 still sees the pairing and still reports it — declining must not become silence (COV-01 transparency).

### Class-4 control 2 — implausible entry point (`STACK_RETURN_IMPLAUSIBLE_TARGET`)

Byte-identical to the genuine fixture apart from `$02` (`jam`, an illegal opcode) at the three reconstructed target addresses.

| | pre-fix | post-fix |
|---|---|---|
| `stackReturnDispatch` | 1 finding, `entries 3`, `truncated: false` | `[]` |
| `targets` | `[$c00a, $c00c, $c00e]` — three addresses whose bytes decode as `jam` | — |
| `provenDispatchTargets()` | `[$c00a, $c00c, $c00e]`, and the descent seeded from them | `[]` |
| `scan.truncated` | `false` | `true` — the walk was cut short and the report says so |

### Both-directions control

The genuine rebuilt `STACK_RETURN` still yields exactly one class-4 finding with `entries 3`, `truncated: false`, and `provenDispatchTargets() === [$c00a, $c00c, $c00e]`. A gate that declines everything measures nothing.

## The `STACK_RETURN` correction

This plan changed a **committed assertion**, deliberately, and the change is a correction rather than a relaxation (T-19G-11-05).

| | value |
|---|---|
| **Old** table bytes | hi `c0 c0 c0` at `$c010`, lo `05 05 05` at `$c013` |
| **Old** asserted `idiom.targets` | `[0xc006, 0xc006, 0xc006]` (`anno-coverage.test.ts:764` pre-fix) |
| **New** table bytes | hi `c0 c0 c0` at `$c010`, lo `09 0b 0d` at `$c013` |
| **New** asserted `idiom.targets` | `[0xc00a, 0xc00c, 0xc00e]` |

**Why `$c006` was wrong.** The idiom occupies `$c000..$c008`, and its second instruction `lda $c013,x` occupies `$c004..$c006`. `$c006` is therefore the **third byte of the fixture's own second instruction** — a mid-instruction address, not an address a program can be entered at. It was being handed to `provenDispatchTargets()`, whose doc comment states that adding a source to it *is* the decision to treat that source as proof of code, and the suite asserted that value was correct. A positive control asserting a defect is correct is worse than no control.

**Why the new value is right.** The three entries name `$c00a`, `$c00c` and `$c00e` — three `rts` instructions placed in the filler region between the idiom and its tables, each a legal one-byte instruction, none inside any instruction of the idiom's own window. The table bytes encode `target - 1` because the idiom pushes the address `rts` will increment past, so the lo bytes read `09 0b 0d`. Three **distinct** targets rather than one repeated value, so "the walk read three real entries" is a visible property.

The property the old fixture violated is now **asserted**, not described: the test derives the window's byte coverage from the decoded stream (`$c000..$c008`) and asserts no reconstructed target falls inside it. Two dependent assertions were updated with it — the class-4 positive test's `idiom.targets` deep-equal, and the class-3/class-4 disjointness test's byte-swap cross-check (which needed no literal change; its `$05c0 for $c005` illustration in the source comment was refreshed to the live `$09c0 for $c009`).

## The WR-15 two-payload comparison

One payload carries a genuine split table with its zero-page vector and a real `jmp ($00fb)` consumer. Its twin is **derived by insertion** — the same prologue with one unrelated `lda $c018,y` spliced between the two halves — so "identical except for the interposed load" is true by construction, and what is asserted is the scan's output equality.

| payload | pre-fix proven `splitTables` | pre-fix advisory | pre-fix `provenDispatchTargets()` | post-fix proven | post-fix advisory | post-fix `provenDispatchTargets()` |
|---|---|---|---|---|---|---|
| clean (`SPLIT_TABLE_CLEAN`) | 1 | 0 | 8 (`$c010`…`$c017`) | 1 | 0 | 8 (`$c010`…`$c017`) |
| interposed (`SPLIT_TABLE_INTERPOSED`) | **0** | **2** | **0** | 1 | 1 | 8 (`$c010`…`$c017`) |

These are the review's own numbers, reproduced verbatim before the fix. Post-fix the interposed variant's `splitTables[0]` is asserted deep-equal to the clean one's `targets`, `loBase` and `hiBase`, and its `provenDispatchTargets()` deep-equal to the clean one's — **against the live baseline, never a hard-coded list** — with a non-vacuity assertion that the baseline actually proves eight entries.

The one remaining advisory candidate in the interposed payload sits at `$c003`, the interposed load's *own* leading-load pairing, and carries `orientationResolved: false` with no targets. The test asserts no advisory candidate shares an address with the proven pairing, so the advisory list cannot be where a proven pairing went.

**Preserved properties, asserted:** at most one advisory candidate per leading load (asserted over `MULTIPLE_ADVISORY_PAIRINGS`, whose leading load genuinely has two possible second loads — a precondition counted from the decoded stream rather than claimed), and a leading load with a proven pairing emits none. The two committed controls that depend on the single-candidate property — `dispatch class 3 DECLINES an ordinary two-table indexed read loop` and the FP1 report-level control — both still observe `splitTableCandidates.length === 1`.

## `DISPATCH_CONTEXT_SHAPES` after this plan

**Unchanged — still exactly two ids, in the same order:**

```ts
export const DISPATCH_CONTEXT_SHAPES: readonly string[] = Object.freeze([
  "stack-return-push-idiom",
  "zeropage-vector-jumped-through",
]);
```

No id was added. 19-10 had already minted `stack-return-push-idiom`, and adding a third id without a third true-returning branch in `hasDispatchContext()` would have reddened 19-10's source-derived count assertion — correctly. What changed is the *interior predicate* for the existing id: `reachesGateInterior()` now reaches `stack-return-push-idiom` by **either** of the two gates that rule on that shape — the class-4 pass's own five-instruction window (register-agnostic) or the pre-existing class-3 pairing precondition followed by `pha` … `pha` … `rts` in reach.

`GATE_INTERIOR_DECLARATIONS` grew from 6 rows to 10, and every row now carries a `polarity`:

| control | position | polarity |
|---|---|---|
| `ORDINARY_INDEXED_COPY` | OUTSIDE | negative |
| `fp1-indexed-copy-loop` | OUTSIDE | negative |
| `fp1b-immediate-copy-loop` | OUTSIDE | negative |
| `fp2b-immediate-data-pointer` | OUTSIDE | negative |
| `fp2-zeropage-data-pointer` | `zeropage-vector-jumped-through` | negative |
| `STACK_RETURN` | `stack-return-push-idiom` | negative |
| `STACK_RETURN_MIXED_REGISTERS` | `stack-return-push-idiom` | negative |
| `STACK_RETURN_IMPLAUSIBLE_TARGET` | `stack-return-push-idiom` | negative |
| `MULTIPLE_ADVISORY_PAIRINGS` | OUTSIDE | negative |
| `SPLIT_TABLE_CLEAN` | `zeropage-vector-jumped-through` | **positive** |
| `SPLIT_TABLE_INTERPOSED` | `zeropage-vector-jumped-through` | **positive** |

The shape-coverage test now counts only `negative` interior rows, so 19-10's rule — every sufficient shape owes the suite a control that reaches *inside* it and asserts a DECLINE — is preserved rather than diluted by the two positive rows. A `positive` row is checked the other way: a new test asserts every declared positive control is actually ACCEPTED (non-empty `provenDispatchTargets()`), because a positive control that proves nothing is mislabelled and reads as coverage it does not supply.

## Verification Results

| check | result |
|---|---|
| `cd src/mcp/vice && node --test anno-coverage.test.ts` | exit 0 — `# tests 69 / # pass 69 / # fail 0` (was 66 before this plan) |
| `cd src/mcp/vice && npm test` (FULL suite, not `test:automated`) | **`# tests 2578 / # suites 24 / # pass 2533 / # fail 0 / # skipped 40 / # todo 5`** |
| `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `node scripts/check-npm-packages.mjs` | exit 0 |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 |
| `node scripts/check-skill-description-overlap.mjs` | exit 0 |
| `node fixtures/coverage/make-coverage-fixtures.mjs` twice | `git status --porcelain src/mcp/vice/fixtures/coverage` empty — this plan writes no fixture |
| `git status --porcelain .planning/REQUIREMENTS.md` | empty — this plan ticks no box |
| `git diff` on `COVERAGE_SCHEMA_VERSION` / `COVERAGE_REPORT_KEYS` | no change; schema stays at version 2 |
| `19-REVIEW.md` byte-unchanged | confirmed — `git status --porcelain` on it is empty |
| every commit subject carries `[skip release]` | confirmed (3 commits) |
| source-level read-only assertion over `anno-coverage.ts` | passes — COV-01 / concurrency unaffected |
| FP2 interior control from 19-10 | still `splitTables` empty, `provenDispatchTargets` empty, `classAt($0840)` unreached |

## Decisions Made

See `key-decisions` in the frontmatter. The two that most change how the module reads:

1. **The register check runs before the window is claimed.** A mismatched-register window is not class 4's, so class 3 must stay free to report the pairing. It does — as an advisory candidate with no orientation and no targets, which is the honest statement "something indexes two tables here and we cannot prove what it dispatches to". Declining must not become silence.
2. **A zero-survivor class-4 walk pushes no finding but raises `scan.truncated`.** The plan's Step 2 says to push a finding only when at least one target survives; the COV-01 prohibition says an under-report may not be silent. Both are satisfied by using the flag the module already has for "a walk was cut short" — and a finding claiming `entries: 0` would have been a new shape for Phase 21's consumers to handle. The acceptance criterion's "the finding it produces (if any)" wording anticipates this branch, and the test asserts both halves: absent-or-empty finding, AND `scan.truncated === true`.

## Deviations from Plan

**1. [Rule 2 - Missing critical] The `isPlausibleEntryPoint()` predicate was extracted rather than duplicated**

- **Found during:** Task 1
- **Issue:** The plan said to "port" class 3's conditions (b) and (e) to class 4 and explicitly "do not re-derive them". Condition (e) was an inline arrow function inside the class-3 loop, so a literal port would have produced a second copy of the same four lines. WR-14 existed for exactly as long as that test lived in only one of the two halves of the seam; two copies would let them drift apart again.
- **Fix:** Extracted the predicate to a single `isPlausibleEntryPoint()` closure alongside `wordAt()`, read by class 3's condition (e) and class 4's condition (d). Class 3's behaviour is byte-identical (`targets.every(isPlausibleEntryPoint)` is the same computation).
- **Files modified:** `src/mcp/vice/anno-coverage.ts`
- **Verification:** full suite green; every pre-existing class-3 control (`ORDINARY_INDEXED_COPY`, FP1/FP1b, FP2/FP2b, `SPLIT_TABLE`) unchanged in outcome.
- **Committed in:** `c95bdaf`

**2. [Rule 2 - Missing critical] `MULTIPLE_ADVISORY_PAIRINGS` added beyond the plan's payload list**

- **Found during:** Task 2
- **Issue:** The plan requires "at most ONE advisory candidate is emitted per leading load" to be asserted. Neither WR-15 payload has a leading load with more than one candidate pairing in its window, so asserting the property over them would have been vacuous — satisfied by an implementation that could only ever produce one candidate anyway. That is precisely the vacuity class this gap-closure run exists to eliminate.
- **Fix:** Added a third payload — three indexed loads, no consumer — whose leading load has two possible second loads, and asserted the non-vacuity precondition by counting indexed loads in the decoded window inside the test.
- **Files modified:** `src/mcp/vice/anno-coverage.test.ts`
- **Verification:** the test asserts `indexedLoadsInWindow.length >= 2` before asserting the property.
- **Committed in:** `084f17a`

**3. [Rule 2 - Missing critical] `scan.truncated` is raised only for an emitted class-3 finding**

- **Found during:** Task 2
- **Issue:** The WR-15 fix makes the inner loop evaluate more pairings per leading load. The global `truncated = true` was set at `MAX_TABLE_ENTRIES` clamp time, i.e. for pairings that are now discarded — so the fix would have manufactured truncation noise on payloads whose reported findings were never truncated.
- **Fix:** Moved the global flag set to emission time (proven push, or advisory emission). Behaviour-preserving for the pre-fix path, where the first pairing was always emitted.
- **Files modified:** `src/mcp/vice/anno-coverage.ts`
- **Verification:** full suite green; `bounded walk: a table whose entries would chain indefinitely reports truncation and terminates (T-19-12)` still passes.
- **Committed in:** `084f17a`

**4. [Rule 2 - Missing critical] `polarity` added to `GateInteriorDeclaration`, and the shape-coverage test narrowed to negative rows**

- **Found during:** Task 2
- **Issue:** The plan requires the two WR-15 payloads to be added to `GATE_INTERIOR_DECLARATIONS` "as POSITIVE controls rather than negative ones — record that distinction honestly in the row rather than mislabelling them". The table's own doc comment read "one row per **negative** dispatch control", and the shape-coverage test computed its `claimed` set from *every* interior row. Adding two positive rows without narrowing that filter would have let a positive control silently satisfy a shape's need for an interior negative one — displacing 19-10's rule rather than extending it.
- **Fix:** Added an explicit `polarity: "negative" | "positive"` field; `claimed` now counts negative interior rows only, the stale-row reverse check spans both polarities, and a new test asserts every declared positive control is actually accepted.
- **Files modified:** `src/mcp/vice/anno-coverage.test.ts`
- **Verification:** `every shape the dispatch predicate accepts is claimed by an interior declaration` and `the declared shape count equals the number of true-returning sites in hasDispatchContext()'s own source` both still pass.
- **Committed in:** `084f17a`

---

**Total deviations:** 4 auto-fixed (4 missing-critical). No Rule 1 bugs, no Rule 3 blockers, no Rule 4 escalations.
**Impact on plan:** all four close vacuity or drift routes the plan's own criteria required to be closed; none widens scope beyond the two files in `files_modified` plus the deferred-items ledger. No scope creep.

## Issues Encountered

**A load-sensitive failure in an unrelated test file, on one of two full-suite runs.** `anno-session.test.ts`'s `stub: a child that answers nothing within the call timeout rejects with AnnoTimeoutError, is killed, and the crash counter increases by 1` failed once (`# fail 1`), then passed standalone (`# tests 25 / # pass 25 / # fail 0`) and on an immediate full-suite re-run (`# fail 0`). The test drives a real child process against a wall-clock timeout, so it is sensitive to machine load. This plan touched only `anno-coverage.ts` and `anno-coverage.test.ts`, neither of which `anno-session.test.ts` reads. Logged as `deferred-items.md` item 3 (commit `109231e`) rather than fixed — widening the timeout would be a change to a file outside this plan's scope fence, made on one observation. **The recorded full-suite result is the clean run: `# tests 2578 / # pass 2533 / # fail 0`.**

## Known Stubs

None. No stub value, no `TODO`/`FIXME`, no skipped or `todo` test was added by this plan; the suite's pre-existing 40 skipped / 5 todo counts are unchanged from the wave-1 baseline. Every `<verify>` command in the plan was run and its result recorded above.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change at a trust boundary. Every threat in the plan's register carries disposition `mitigate` and is discharged: T-19G-11-01 (Task 1's register condition plus its interior control), T-19G-11-02 (the shared plausibility predicate plus the rebuilt fixture), T-19G-11-03 (`MAX_TABLE_ENTRIES` retained, and the walk additionally stops at the first implausible entry, so the bound is the tighter of the two), T-19G-11-04 (Task 2's consumption rule plus the two-payload comparison), T-19G-11-05 (the `STACK_RETURN` correction recorded above with old value, new value and reason). T-19G-11-SC is `accept`: this plan installs nothing and `package-lock.json` is untouched, so no `## Package Legitimacy Audit` row is required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both `missing` items this plan owned are closed: GAP 1's third item (WR-14) and the WR-15 under-report. Their dispositions are recorded above in the form `docs-review-disposition.test.ts` reads.
- GAP 2's disposition ledger still needs **WR-13** and **IN-05** — this plan dispositions WR-14 and WR-15 only, and claiming the other two would be claiming work it did not do.
- The hold's lifting condition remains a no-gaps Phase 19 re-verification, which has not happened. Every commit carries `[skip release]` accordingly.
- No requirement checkbox was ticked and no REQUIREMENTS.md status row was moved — those are earned by re-verification, not by the plan that fixed the defect.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*

## Self-Check: PASSED

All modified files exist on disk; all four commits (`c95bdaf`, `084f17a`, `109231e`, `d3cbab6`) are present in `git log --all`. Every task-level `<acceptance_criteria>` and the plan-level `<verification>` list were re-run and recorded in ## Verification Results above.
