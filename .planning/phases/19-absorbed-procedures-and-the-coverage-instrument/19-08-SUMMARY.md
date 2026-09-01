---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 08
subsystem: analysis-tooling
tags: [the external analyser, coverage, dispatch-scan, false-positives, negative-control, schema-version, 6502]

requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "the coverage instrument (anno-coverage.ts), its widened four-class dispatch scan, and 19-06's anchored multi-caller rule in the same two files"
provides:
  - "A dispatch-context GATE on the Class-3 split lo/hi table scan: same index register, a dispatch consumer in evidence, every reconstructed target in-image AND decodable, and a lo/hi orientation resolved by the pairing's own store construction"
  - "`splitTableCandidates` — the advisory sibling where ungated pairings survive, reported beside the proven classes and never summed into them (COV-01)"
  - "`provenDispatchTargets()` — the ONE exported seam that decides what may seed a recursive descent"
  - "Class-4-first ordering: the stack-return idiom claims its window and Class 3 declines it, killing WR-01's byte-swapped twin at its source"
  - "COVERAGE_SCHEMA_VERSION 2, with the nine-entry top-level COVERAGE_REPORT_KEYS set UNCHANGED"
  - "The 16-bit census bound (IN-04)"
  - "Five negative controls, two of them OBSERVED RED against pre-fix code"
affects: [19-09, phase-20-decomposition-to-closure, phase-21-hazard-report]

actuals:
  tokens: 34105
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A reconstruction heuristic must be gated on evidence before its output may seed anything; ungated output is reported as an advisory class, never discarded and never summed"
    - "One exported seam per 'what may seed a descent' decision, so adding a source is a deliberate, reviewable act"
    - "Where two passes can match the same instructions, the pass whose role assignment is justified runs FIRST and claims its window"
    - "A negative control accompanies every positive one for any heuristic whose risk is false positives"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-coverage.ts
    - src/mcp/vice/anno-coverage.test.ts

key-decisions:
  - "Checkpoint option `narrow-and-add-sibling` implemented exactly as chosen: `discoveredTargets` narrowed to proven-only, `splitTableCandidates` added as an advisory sibling, ungated pairings preserved there. `discoveredTargets` was NOT renamed, no `provenTargets`/`advisoryTargets` pair was introduced, and `anno-cli.ts` was NOT modified — all three were consequences of the rejected `rename-both` option."
  - "COVERAGE_SCHEMA_VERSION bumped 1 -> 2 with the authorised, deliberate edit to the test's version assertion. The nine-entry top-level COVERAGE_REPORT_KEYS set is unchanged; only the nested `dispatch` sub-object changed."
  - "A PROVEN class-3 pairing additionally requires a RESOLVED lo/hi orientation, decided by the pairing's own store construction (the load reaching the lower of two consecutive zero-page addresses holds the low byte). A pairing with dispatch context but no resolvable orientation is ADVISORY, not proven — otherwise the orientation would fall back to `Math.min`, which is precisely WR-01's defect."
  - "The `SPLIT_TABLE` positive-control fixture was extended with a genuine dispatch consumer rather than the gate being weakened. As committed it had NO consumer at all — it was a positive control for a heuristic that fired on anything."
  - "`git stash` was NOT used for the RED observation (project rule 6 forbids it — the stash ref is shared across worktrees). A disposable shadow tree built with `git archive HEAD` was used instead, per 19-06's and 19-07's precedent."
  - "`classFromBytes()` takes the proven-target array as a parameter rather than dropping the branch entirely, so a proven dispatch target still classifies as code in the reproducibility comparison while the un-narrowed read is gone."

patterns-established:
  - "Null-hypothesis shadow tree: to observe a control red against pre-fix code when the control names new API, rebuild the PRE-fix module in a scratchpad tree and express the old behaviour through the new API (here, a seam that simply returns the un-narrowed list). The failure that results isolates exactly the change under test rather than an import error."

requirements-completed: [COV-01, COV-02]

coverage:
  - id: D1
    description: "Two 64-byte programs at $0810 with 7 bytes of real code each, differing ONLY in immediate versus indexed addressing, report the SAME reachedAsInstruction, and neither exceeds the real code size"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#an ordinary indexed copy loop does not inflate the census over its immediate twin"
        status: pass
    human_judgment: false
  - id: D2
    description: "An ungated split lo/hi pairing is reported as an advisory candidate and is absent from the proven target set, from extraSeeds and from tableEntryAddresses"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#dispatch class 3 DECLINES an ordinary two-table indexed read loop"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#an advisory split-table candidate never reaches the census"
        status: pass
    human_judgment: false
  - id: D3
    description: "The class-4 stack-return idiom is reported exactly once, with the orientation its push order justifies, and no reported target is the byte-swap of another (WR-01)"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#the class-4 stack-return idiom is not also reported as a class-3 split table"
        status: pass
    human_judgment: false
  - id: D4
    description: "A census whose origin plus payload size would leave the 16-bit address space is bounded rather than wrapping: no address at or above $10000 is classified (IN-04)"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#a census whose origin plus size would leave the 16-bit space is bounded"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two consecutive reports over the same fixture are deeply equal once generatedAt is removed, INCLUDING the new advisory field, whose presence is asserted so the comparison cannot pass vacuously"
    requirement: COV-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#idempotency: two consecutive reports over the same fixture are deeply equal once the timestamp is removed"
        status: pass
    human_judgment: false
  - id: D6
    description: "A genuine split table with a real dispatch consumer is still PROVEN and still seeds the descent, so the gate is not a machine that declines everything"
    requirement: COV-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-coverage.test.ts#dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases"
        status: pass
    human_judgment: false
  - id: D7
    description: "The report-shape change and the schema-version bump were accepted by a human before they were implemented, discharging 19-VERIFICATION.md human_verification item 2"
    requirement: COV-01
    verification:
      - kind: other
        ref: "19-08 Task 1 decision checkpoint — option `narrow-and-add-sibling` selected, COVERAGE_SCHEMA_VERSION 1 -> 2 approved, nine-entry COVERAGE_REPORT_KEYS accepted as-is"
        status: pass
    human_judgment: true
    rationale: "A forward-compatibility commitment, not a correctness property a test can decide. The pin is mechanised afterwards by the literal `assert.equal(COVERAGE_SCHEMA_VERSION, 2, ...)` in the schema test, whose message names the reason for the bump."

duration: 30 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 08: Gate the Split-Table Scan Summary

**Ordinary data can no longer buy headline structural coverage: the Class-3 split lo/hi table scan
now requires evidence that something actually dispatches through a pairing before its reconstructed
values may seed a recursive descent, and the two 64-byte programs that reported `reached=7` and
`reached=55` for the same 7 bytes of code now both report 7.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-25
- **Tasks:** 2 of 3 executed here (Task 1 was the decision checkpoint, answered by the human before
  this agent started; no commit, by design)
- **Files modified:** 2

## The checkpoint decision, verbatim

Task 1 was a `checkpoint:decision` with `gate="blocking-human"`. The human answered **both**
questions.

**1. Report shape — selected option id: `narrow-and-add-sibling`.** As presented and chosen:

> **Narrow `discoveredTargets` to proven-only, add a sibling advisory field, bump the schema version to 2.**
> `discoveredTargets` keeps its name and its documented meaning ("targets the scan discovered") but
> becomes honest: only evidence-backed targets. The ungated pairings survive as
> `splitTableCandidates`, so no information is lost and Phase 21's hazard report can still see them —
> flagged as unproven, which is what a hazard report actually wants. Top-level `COVERAGE_REPORT_KEYS`
> is unchanged, so no consumer's top-level read breaks. The version bump is the honest signal that a
> nested meaning changed.

**2. Schema/keys confirmation — CONFIRMED, both:**

- `COVERAGE_SCHEMA_VERSION` **1 → 2 APPROVED**, together with the deliberate, authorised edit to
  `anno-coverage.test.ts`'s exact top-level key-set / version assertion that
  `anno-coverage.ts`'s own doc comment requires. That test edit was authorised — it is not a
  guard that was worked around.
- The nine-entry `COVERAGE_REPORT_KEYS` top-level set **ACCEPTED AS-IS, unchanged**:
  `["schemaVersion", "generatedAt", "project", "structural", "dispatch", "labels", "commentVacuity", "reproducibility", "divergence"]`.

**Consequences of the REJECTED options that were deliberately NOT applied:** `discoveredTargets`
was not renamed; no `provenTargets`/`advisoryTargets` pair was introduced; `anno-cli.ts` was not
modified; ungated pairings were not discarded.

### Discharge of `19-VERIFICATION.md` `human_verification` item 2

Item 2 — *"Review 19-03's `flat-three` coverage report schema before Phase 20 reads it"* — is
**DISCHARGED** by this checkpoint. Recorded here so a later reader can check it: the selected
option id is **`narrow-and-add-sibling`**, the confirmed version bump is **`COVERAGE_SCHEMA_VERSION`
1 → 2**, and the top-level key set was confirmed unchanged at nine entries. The decision was taken
**before** the implementing task ran, per the plan's one-way reversibility gate.

## Accomplishments

### The gate (Task 2, commit `1706d8b`)

A Class-3 pairing is **PROVEN** only when **all** of the following hold; anything else is
**ADVISORY**:

1. **Not inside a Class-4 window.** The stack-return pass now runs **first** and records the
   address of every instruction in each matched five-instruction window. Class 3 declines any
   pairing whose leading load sits in one.
2. **Same index register.** Compared via `indexRegisterOf()` on the decoded `mode`, not by mere
   membership in `INDEXED_LOAD_MODES` — an `absolute_x` load paired with an `absolute_y` load is
   two tables walked by two registers, not one split table.
3. **A dispatch consumer in evidence** (`hasDispatchContext()`), any ONE of: an indirect-jump
   opcode `0x6c` within `SPLIT_TABLE_WINDOW` reach; a `pha` … `pha` … `rts` shape in reach (kept so
   the function reads as a complete statement of what counts, even though the reordering means such
   a window is skipped rather than promoted); or two stores into **consecutive zero-page addresses**
   in reach — the classic "build a vector, then `jmp (vector)`" construction.
4. **Every reconstructed target is a plausible entry point:** strictly inside the image *and*
   decoding via `decode()` as a legal, non-truncated instruction.
5. **A resolved lo/hi orientation** (`resolveSplitOrientation()`). For each load, the nearest
   following zero-page store within reach is its consumer; when the two consumers are two
   *different, consecutive* zero-page addresses, the load reaching the lower address holds the low
   byte. A 6502 vector is little-endian, so that is a fact about the construction. Any other shape
   returns `null` and the pairing is advisory — the `Math.min`/`Math.max` fallback that WR-01 names
   is gone entirely.

### The advisory class

`IndirectDispatchScan.splitTableCandidates: SplitTableFinding[]` carries the ungated pairings. Its
doc comment states the same discipline `linearSweepDecodable` carries and for the same reason: it
is reported **beside** the proven classes and **never summed into them** (COV-01). An advisory
finding contributes nothing to `discoveredTargets`, nothing to `tableEntryAddresses`, carries
`orientationResolved: false`, records its two bases in **encounter order** with no lo/hi claim, and
has an **empty `targets` list** — a byte-swapped value is not an address and is never printed as
one.

### The single seam

`provenDispatchTargets(scan): number[]` is exported, ascending and deduped, built from non-null
`indirectJumps[].target`, `multiEntryTables[].targets`, `stackReturnDispatch[].targets` and
**proven** `splitTables[].targets` — and from nothing else. Its doc comment states that it is the
one place deciding what may seed a recursive descent, and that adding a source to it **is** the
decision to treat that source as proof of code.

### Header, schema, and IN-04

- The module header's "WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR" list gained the gate and the
  seam; "WHAT NOT TO DO" gained **trap 8**, which names the reproduced numbers so the trap cannot
  be read as hypothetical.
- `COVERAGE_SCHEMA_VERSION = 2` with a version history block recording what changed at 2 and that a
  human accepted it.
- **IN-04 folded in:** `computeStructuralCensus()` bounds the censused range at
  `min(origin + size, 0x10000)`. `rangeBytes` is now the *censused* count while `size` remains the
  payload's own length, so the truncation is visible rather than hidden. The linear sweep is swept
  over the same bounded range, so both figures describe the same bytes.

## Pre-fix and post-fix census numbers

The exact reproduction script (run against shipped code before any edit, then again after Task 2):

```ts
const ORIGIN = 0x0810;
function pad(prologue: number[]): Uint8Array {
  const out = new Uint8Array(64);
  out.set(prologue, 0);
  let i = prologue.length;
  for (let k = 0; k < 24; k++) out[i++] = 0x10 + k;   // 24 ascending from $10
  for (let k = 0; k < 24; k++) out[i++] = 0x08;       // 24 of $08
  for (let k = 0; k < 9;  k++) out[i++] = 0x20;       //  9 of $20
  return out;
}
const IMM = pad([0xa9, 0x20, 0xa9, 0x38, 0xea, 0xea, 0x60]); // lda #$20 : lda #$38 : nop : nop : rts
const IDX = pad([0xbd, 0x27, 0x08, 0xbd, 0x3f, 0x08, 0x60]); // lda $0827,x : lda $083f,x : rts

for (const [label, bytes] of [["immediate", IMM], ["indexed", IDX]] as const) {
  const scan   = scanIndirectDispatch(decode(bytes, ORIGIN), bytes, ORIGIN);
  const census = computeStructuralCensus(bytes, ORIGIN, [ORIGIN], {
    tableEntryAddresses: scan.tableEntryAddresses,
    extraSeeds: scan.discoveredTargets,        // post-fix: provenDispatchTargets(scan)
  });
  console.log(label, census.reachedAsInstruction, census.unreached,
              scan.splitTables.length, scan.discoveredTargets.length);
}
```

| Variant | | `reached` | `tableEntry` | `referencedAsData` | `unreached` | `splitTables` | `discovered` | `tableEntryAddresses` |
|---|---|---|---|---|---|---|---|---|
| immediate | **pre-fix** | 7 | 0 | 0 | 57 | 0 | 0 | 0 |
| indexed | **pre-fix** | **55** | 0 | 0 | 9 | **1** | **8** | 34 |
| immediate | **post-fix** | 7 | 0 | 0 | 57 | 0 | 0 | 0 |
| indexed | **post-fix** | **7** | 0 | **2** | 55 | 0 | 0 | 0 |

Pre-fix the eight in-image reconstructed "targets" were `$0820 $0821 $0822 $0823 $0824 $0825 $0826
$0827`, all read out of ordinary data bytes. Post-fix the two variants report the **same**
`reachedAsInstruction`, and it equals the real code size (7). The indexed variant's `unreached` is
within 2 bytes of the immediate twin's, because its two operand bases `$0827` and `$083f` are
correctly `referenced-as-data` — which is not `reached-as-instruction`.

Post-fix, the indexed variant's advisory finding is exactly one entry:

```json
{"at":2064,"loBase":2087,"hiBase":2111,"entries":17,"targets":[],"truncated":false,"orientationResolved":false}
```

(`at` `$0810`, bases `$0827`/`$083f` in encounter order, no targets, orientation unresolved.)

## The two required RED observations

`git stash` is forbidden in this project (project rule 6 — the stash ref is shared across
worktrees). Following 19-06's and 19-07's precedent, a **disposable shadow tree** was built in the
scratchpad instead:

```
git archive HEAD src/mcp/vice .planning/phases/19-.../evidence | tar -x -C <scratch>/shadow
cp src/mcp/vice/anno-coverage.test.ts  <scratch>/shadow/src/mcp/vice/   # the NEW tests
# + a recorded NULL-HYPOTHESIS SHIM appended to the shadow's PRE-fix anno-coverage.ts:
#     export function provenDispatchTargets(scan: IndirectDispatchScan): number[] {
#       return scan.discoveredTargets;
#     }
cd <scratch>/shadow/src/mcp/vice && node --test --test-name-pattern '<the two controls>' anno-coverage.test.ts
```

The shim expresses the **pre-fix behaviour through the post-fix API** — the "seam" is simply the
un-narrowed discovered-target list and there is no advisory class — so the resulting failure
isolates exactly the change under test (the gate and the narrowing) rather than degenerating into
an import error. The shadow tree was deleted afterwards (`/tmp` is a RAM-backed tmpfs here).

Result: `# tests 2 / # pass 0 / # fail 2`.

**RED 1 — `dispatch class 3 DECLINES an ordinary two-table indexed read loop`.** Observed:

```
+ [ { at: 2064, entries: 17, hiBase: 2111, loBase: 2087,
+     targets: [ 2080, 2081, 2082, 2083, 2084, 2085, 2086, 2087,
+                8200, 8200, 8200, 8200, 8200, 8200, 8200, 8200, 8200 ],
+     truncated: false } ]
- []
```

i.e. `splitTables=1` at `$0810` with `loBase $0827` / `hiBase $083f`, 17 reconstructed entries —
eight of them the in-image `$0820`…`$0827`, nine of them the out-of-image `$2008`.

**RED 2 — `an ordinary indexed copy loop does not inflate the census over its immediate twin`.**
Observed: `AssertionError … 55 !== 7` (`actual: 55`, `expected: 7`).

**Explicitly stated, as the plan requires:** the other **four** new assertions — the double-report
suppression test, the advisory-never-reaches-census test, the 16-bit bound test, and the
idempotency extension — are **POST-FIX ASSERTIONS ONLY**. They were **not** observed red, and no
claim is made here that they were. That cap was deliberate: the expensive red-observation guarantee
is kept where the gap contract demands it (the two controls named above) and nowhere else.

## The four Task 2 grep patterns, AS EXECUTED

Run from `src/mcp/vice`, against the identifiers the selected option (`narrow-and-add-sibling`)
actually produced. No substitution was needed — the option's own spelling was implemented verbatim.

| # | Purpose | Command | Identifier named | Observed |
|---|---------|---------|------------------|----------|
| 1 | The advisory field's declaration | `grep -c 'splitTableCandidates: SplitTableFinding\[\];' anno-coverage.ts` | `splitTableCandidates` | **1** (line 584) |
| 2 | The proven-seam `extraSeeds:` assignment (POSITIVE form) | `grep -c 'extraSeeds: provenDispatchTargets(dispatch),' anno-coverage.ts` | `provenDispatchTargets` | **1** (line 1659) |
| 3 | No `extraSeeds:` assignment reads the raw list | `grep -c 'extraSeeds:.*discoveredTargets\|extraSeeds:.*splitTableCandidates' anno-coverage.ts` | `discoveredTargets` | **0** |
| 4 | No bare membership test in `classFromBytes()` | `sed -n '/^function classFromBytes/,/^}/p' anno-coverage.ts \| grep -c 'discoveredTargets\|splitTableCandidates'` | `discoveredTargets` | **0** |

Pattern 3 additionally confirmed by listing **every** `extraSeeds:` occurrence in the file: three
hits, of which two are prose in doc comments (lines 45 and 942, both asserting the invariant) and
exactly one is an assignment (line 1659), and that assignment reads the seam.

## What happened to the existing class-3 positive control

It **failed** the moment Task 2 landed — `node --test anno-coverage.test.ts` reported
`# tests 46 / # pass 45 / # fail 1`, the single failure being
`dispatch class 3: a split lo/hi table pair is reconstructed from its two bases`.

**That is the finding, and it was recorded rather than worked around.** The `SPLIT_TABLE` payload
as originally committed was:

```
$c000 lda $c010,x     ; lo base
$c003 lda $c013,x     ; hi base
$c006 rts
$c007..$c00f  nine nops
$c010 06 06 06        ; lo bytes
$c013 c0 c0 c0        ; hi bytes
```

It carries **no dispatch consumer at all** — no indirect jump, no `pha`/`pha`/`rts`, no zero-page
vector construction. It was a positive control for a heuristic that fired on anything, which is the
same inadequacy the plan exists to close, sitting inside the control set itself.

**The gate was not weakened.** Per the plan's first option, the payload was extended with a genuine
consumer (Task 3, commit `9c9166d`):

```
$c000 lda $c010,x     ; lo base
$c003 sta $fb         ; -> vector lo
$c005 lda $c013,x     ; hi base
$c008 sta $fc         ; -> vector hi
$c00a jmp ($00fb)     ; <- the dispatch consumer
$c00d ea ea ea
$c010 0d 0d 0d        ; lo bytes -> $c00d, a legal nop
$c013 c0 c0 c0        ; hi bytes
```

The bases (`$c010` / `$c013`) and the entry count (3) are unchanged; the targets moved from
`$c006` to `$c00d` because the consumer occupies the bytes the old target pointed at, and `$c00d`
is a `nop` — legal and non-truncated, so it also exercises gate condition 4. The store pair is what
now determines the orientation, so this fixture is a positive control for a **proven** table in the
full sense: consumer present, orientation justified, targets decodable. The test was renamed
`dispatch class 3: a PROVEN split lo/hi table pair is reconstructed from its two bases` and gained
assertions that `splitTableCandidates` is empty, that `orientationResolved` is `true`, and that
`provenDispatchTargets(scan)` includes the target — so a gate that declined everything would fail
here.

The `DECLINES` negative control also re-asserts the proven case in its own body, so the
both-directions doctrine holds inside a single test as well as across the pair.

## Test counts and the named delta

**Shape chosen:** the idempotency extension was authored as **extra assertions inside the existing
test**, not as its own test. The delta is therefore **exactly 5**, the plan's primary shape.

| | `cd src/mcp/vice && node --test anno-coverage.test.ts` |
|---|---|
| 19-06 baseline (recorded in 19-06-SUMMARY) | `# tests 46`, `# pass 46`, `# fail 0` |
| Observed after 19-08 | `# tests 51`, `# pass 51`, `# fail 0` |

The schema-version assertion is an **edit** to an existing test and adds nothing to the count. No
absolute total is asserted anywhere, and the command was never widened past this one file.

The five new tests:

1. `dispatch class 3 DECLINES an ordinary two-table indexed read loop` — *red-observed*
2. `an ordinary indexed copy loop does not inflate the census over its immediate twin` — *red-observed*
3. `the class-4 stack-return idiom is not also reported as a class-3 split table`
4. `an advisory split-table candidate never reaches the census`
5. `a census whose origin plus size would leave the 16-bit space is bounded`

Plus two new payloads, `ORDINARY_INDEXED_COPY` and `ORDINARY_IMMEDIATE_COPY`, whose
differ-only-in-addressing-mode property is **asserted** inside test 2 rather than claimed in a
comment.

## Verification

| # | Command | Result |
|---|---------|--------|
| 1 | `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` | exit **0** |
| 2 | `cd src/mcp/vice && node --test anno-coverage.test.ts` | exit **0** — `# tests 51`, `# pass 51`, **`# fail 0`** |
| 3 | `cd src/mcp/vice && npm test` (FULL suite, not `test:automated`) | exit **0** — `# tests 2560`, `# pass 2515`, **`# fail 0`**, `# skipped 40`, `# todo 5` |
| 4 | `node scripts/check-npm-packages.mjs` | exit **0** |
| 4 | `node scripts/check-skill-tool-coverage.mjs` | exit **0** |
| 4 | `node scripts/check-skill-description-overlap.mjs` | exit **0** |
| 5 | Pre-fix / post-fix census numbers with reproduction script | recorded above |
| 6 | The two RED observations, plus the explicit not-red-observed statement | recorded above |
| 7 | `node src/mcp/vice/vice-proxy.ts anno coverage src/mcp/vice/fixtures/coverage/nc5-well-documented/project.regen2000proj` | exit **0** — prints `schema version 2`, `MEASURE 1 of 3`, `MEASURE 2 of 3`, `MEASURE 3 of 3`, and no combined figure. The CLI survived the schema change unmodified. |

**Inherited-suite note.** The orchestrator measured the full suite green at the wave-1 boundary
(`# tests 2555, # pass 2510, # fail 0`). It is green here at `# tests 2560, # pass 2515, # fail 0`
— exactly `+5 tests / +5 pass`, the delta this plan authored. Nothing was attributed to
pre-existing breakage, because there was none.

**Artifact floors held:** `anno-coverage.ts` **1794** lines (floor 1480), `anno-coverage.test.ts`
**1158** lines (floor 850).

**COV-01 prohibition honoured:** no single combined coverage figure is computed, emitted, stored or
displayed. The advisory class is reported beside the census and never summed into it, exactly as
`linearSweepDecodable` is; the existing recursive banned-key scan
(`COV-01: no key anywhere in the report matches a combined-figure vocabulary`) still passes over the
new nested field.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 3 — Blocking] `git stash` replaced by a null-hypothesis shadow tree**
- **Found during:** Task 3
- **Issue:** Task 3's acceptance criterion prescribes "stashing ONLY the `anno-coverage.ts`
  change". Project rule 6 forbids `git stash` outright — the stash ref is shared across worktrees
  in this repository.
- **Fix:** A disposable `git archive HEAD` shadow tree in the scratchpad, with a recorded shim
  expressing the pre-fix behaviour through the post-fix API. Documented in full above. Evidence
  produced is strictly stronger than a stash would have given: the failures carry the pre-fix
  values, not an import error.
- **Files modified:** none (scratchpad only, deleted after use)

**2. [Rule 2 — Missing critical functionality] A proven pairing additionally requires a RESOLVED orientation**
- **Found during:** Task 2
- **Issue:** The plan's gate lists same-index-register, a dispatch consumer, and decodable targets.
  It separately requires (truth 4) that lo/hi roles are only assigned where something determines
  them. With only the listed three conditions, a pairing gated by an indirect jump alone would
  still need lo/hi roles, and the only available fallback is `Math.min` — WR-01's exact defect.
- **Fix:** `resolveSplitOrientation()` was added and a `null` result makes the pairing advisory
  however good its other evidence is. `SplitTableFinding` and `StackReturnFinding` both carry an
  explicit `orientationResolved` field so the distinction is in the report, not just in the code.
- **Files modified:** `src/mcp/vice/anno-coverage.ts`
- **Commit:** `1706d8b`

**3. [Plan-sanctioned] The `SPLIT_TABLE` positive-control fixture gained a dispatch consumer**
- Documented in full under *What happened to the existing class-3 positive control*. This is the
  first of the two branches the plan's Task 3 action explicitly permits.
- **Commit:** `9c9166d`

**4. [Consequential] `classFromBytes()` signature changed**
- It now takes `provenTargets: readonly number[]` instead of the whole `IndirectDispatchScan`,
  computed once per report in `computeReproducibility()`. The plan permitted either this or
  deleting the branch; keeping it preserves the semantic that a *proven* dispatch target classifies
  as code, while removing the un-narrowed read. Module-private function; no external caller.

**5. [Consequential] `StructuralCensus.rangeBytes` is now the censused count, not the payload length**
- They are equal for every well-formed payload and differ only when `origin + size` leaves the
  16-bit space, which is the malformed case IN-04 addresses. `size` still reports the payload's own
  length, so the truncation is visible. `anno-cli.ts`'s "the four classes sum to N of M censused
  byte(s)" line reads `rangeBytes` and remains correct.

**6. [Rule 1 — Bug] `requirements.mark-complete COV-01 COV-02` reverted as a false claim**
- **Found during:** state updates
- **Issue:** The executor's standard state flow marks a plan's frontmatter `requirements:` complete.
  Running it flipped COV-01 and COV-02 from `Gaps Found` to `Complete` in REQUIREMENTS.md. But
  **19-09 declares `requirements: [COV-02, COV-01]` too** and is the plan that closes the remaining
  gap-2 items (the committed false-positive control fixture pair, and the extended validation
  record). Marking them complete while an unexecuted gap-closure plan still owns them is precisely
  a "documentation claim the same commit falsifies" — this plan's own COV-02 prohibition.
- **Fix:** `git checkout -- .planning/REQUIREMENTS.md`. Both requirements stay `Gaps Found` until
  19-09 lands and legitimately closes them.
- **Files modified:** none (revert)

**7. [Rule 1 — Bug] ROADMAP's stale gap-closure count corrected**
- **Found during:** state updates
- **Issue:** The Phase 19 plans line read `8/9 plans executed, plus 4 gap-closure plans (0/4
  executed)`. The `0/4` clause is planning-time text the SDK's `roadmap.update-plan-progress` does
  not rewrite, and it was already false before this plan (19-06 and 19-07 had executed). It also
  double-counts: the phase's nine plans ARE five original plus four gap-closure.
- **Fix:** Rewritten to `8/9 plans executed — 5/5 original plans, 3/4 gap-closure plans (19-06,
  19-07, 19-08 done; 19-09 remaining)`.
- **Files modified:** `.planning/ROADMAP.md`

**8. [Rule 1 — Bug] STATE.md's Current Position block was stale**
- **Found during:** state updates
- **Issue:** The body block read `Plan: 5 of 5` / `Status: Phase complete — ready for verification`
  — a known GSD SDK artefact. Phase 19 has nine plans and 19-09 is outstanding.
- **Fix:** Corrected to `Plan: 8 of 9 complete (19-09 remaining)` with an accurate status and
  activity line. The frontmatter `progress` block was already correct (15/16 milestone plans) and
  was not touched.
- **Files modified:** `.planning/STATE.md`

### Not applied (rejected checkpoint options)

`discoveredTargets` was **not** renamed; `provenTargets`/`advisoryTargets` were **not** introduced;
`anno-cli.ts` was **not** modified; ungated pairings were **not** discarded.

## Review disposition table, restated as shipped fact

| ID | Subject | Disposition in this plan | Shipped outcome |
|----|---------|--------------------------|-----------------|
| **WR-01** | Split-table lo/hi roles assigned by address order; byte-swapped targets; the same idiom reported twice | **FOLDED IN** | **Done.** `Math.min`/`Math.max` role assignment deleted. Class 4 runs first and claims its window; Class 3 declines it. Orientation comes from the store construction or the pairing is advisory. Regression-tested by *the class-4 stack-return idiom is not also reported as a class-3 split table*, which also asserts no reported target is the byte-swap of another. |
| **IN-04** | `computeStructuralCensus` never checks that `origin + size` stays inside the 16-bit space | **FOLDED IN** | **Done.** Effective end bounded at `0x10000`; `inRange`, the class array, the count loop and the linear sweep all use it. Regression-tested by *a census whose origin plus size would leave the 16-bit space is bounded*. |
| **WR-03** | The descent walk counts illegal/JAM opcodes as instructions while the linear sweep skips them | **DEFERRED, not rejected** | Not addressed here. The correct fix is gated on the project's `use_illegal_opcodes` setting (Phase 18 forces it on, deliberately), making it a behaviour decision needing its own record. Not in VERIFICATION.md's gap list. Carry into Phase 20's first use of the instrument. |
| **WR-04** | The cross-reference bound is printed but never recorded in the JSON report | **DEFERRED** | Not addressed. A report-shape addition that would widen the schema change this plan already makes, for a reporting nicety no gap depends on. |
| **WR-05** | `--sample` silently accepts and truncates non-integer input | **DEFERRED (CLI cluster)** | Not addressed. `anno-cli.ts` is untouched and is not in `files_modified`. |
| **WR-06** | The entire coverage CLI surface is untested | **DEFERRED (CLI cluster)** | Not addressed. Closing it means authoring a CLI test suite — a scope expansion beyond the two reproduced instrument defects. |
| **WR-07** | `parseCoverageArgs`'s `unknownOption` branch is unreachable | **DEFERRED (CLI cluster)** | Not addressed. Same file, same reason. |
| **WR-10** | `--entropy` is neither range-checked nor refused when its value is missing | **DEFERRED (CLI cluster)** | Not addressed. Same file, same reason. |
| **WR-08** | The oracle's raw stdout reaches a second, unsanitised report field | **DEFERRED**, recorded in this plan's threat register as `T-19G-08-06` / **accept** | Not addressed. Lives in `src/skills/c64-program-recon/scripts/packer-finding.mjs`, untouched here. Both `spawnSync` sites already pass an argument array with `shell: false`; the field is JSON data with no markup or shell sink downstream. Carried with WR-09 into Phase 20. |
| **WR-09** | `probeUnp64()` ignores a non-zero exit status | **DEFERRED** | Not addressed. Same module, carried with WR-08. |
| **WR-11**, **WR-12** | — | Dispositions recorded in **19-07** (same file family) | Untouched here. |
| **IN-01** | `anno-coverage.ts` carries a shebang but is a pure library | **REJECTED as out-of-scope cosmetics** | Shebang retained. Harmless; removing it risks nothing but gains nothing. |
| **IN-02** | Fixture regeneration is host-dependent despite the stated determinism contract | **DEFERRED to 19-09** | Not addressed. 19-09 is the plan that edits the generator. |
| **IN-03** | `stripComments()` has no regex-literal awareness | **DEFERRED** | Not addressed. Different module family; no gap depends on it. |
| **IN-06** | — | **DOES NOT EXIST** | Confirmed as shipped fact. `19-REVIEW.md:477` cross-references "`anno-cli.ts`'s WR-08/IN-06" inside WR-10's prose, but the review's real informational sections are IN-01 … IN-04, and WR-08 is a `packer-finding.mjs` finding rather than a CLI one. The citation is a **phantom in the upstream review document**. Nothing is dispositioned against IN-06 because there is nothing to dispose of; the row exists so this table is a complete accounting of every ID the review names. |

## Release discipline

Both code commits carry `[skip release]`, as does the metadata commit. 19-07's checkpoint approved
the licence **wording** only; it does not authorise a publish and does not lift the hold. The
release remains conditioned on Phase 19 re-verification passing, and 19-09 owns recording the named
lifting condition.

## Known Stubs

None. Every field added in this plan is populated by real logic and asserted by a test; no
placeholder value, empty-literal data source or "coming soon" text was introduced.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema change
at a trust boundary. The one schema change (`COVERAGE_SCHEMA_VERSION` 1 → 2) narrows a report field
and adds a read-only advisory sibling; it reduces attacker-influenced surface rather than widening
it, which is the point of `T-19G-08-01`. `T-19G-08-01`, `T-19G-08-02` and `T-19G-08-03` are all
**mitigated as planned**; `T-19G-08-04`, `T-19G-08-05`, `T-19G-08-06` and `T-19G-08-SC` were
accepted and remain accepted. No dependency was added; `package-lock.json` is untouched.

## Self-Check: PASSED

- `src/mcp/vice/anno-coverage.ts` — FOUND (1794 lines, floor 1480)
- `src/mcp/vice/anno-coverage.test.ts` — FOUND (1158 lines, floor 850)
- Commit `1706d8b` — FOUND (`fix(19-08): gate the split-table scan …`)
- Commit `9c9166d` — FOUND (`test(19-08): the negative controls …`)
- Neither commit deleted a tracked file (`git diff --diff-filter=D` empty for both)
- No untracked file was left behind by this plan
- Every plan `<verification>` item 1–7 re-run and recorded in the table above
- Every task `<acceptance_criteria>` re-checked; all pass
