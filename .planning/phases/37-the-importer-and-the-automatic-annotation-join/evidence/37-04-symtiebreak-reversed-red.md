# AUTO-02 control 3: reversing the symbol tie-break reddens the equal-width case at $0000 (Phase 37, plan 37-04, Task 3)

**What this record is:** a hand-run transcript proving that `selectMemmapEntry()`'s `sym`
tie-break criterion for `$0000` genuinely FAILS when the SYMBOL comparison step is reversed —
among equal-width contenders, preferring the entry WITHOUT a `sym` over one that has one — and
that the committed source still resolves `$0000` correctly, WITH its `tieBrokenBy` naming the
symbol rule, immediately afterwards. The mutation happened ONLY inside a scratch copy under
this host's RAM-backed `/tmp`; the committed `src/mcp/vice/memmap-lookup.ts` was never opened
for writing (`git status --porcelain` on that file read 0 lines both before and after this
session, confirmed below). Only the SYMBOL step's own text was replaced — the WIDTH step and the
residual ORDER step are asserted byte-identical in the scratch copy, both before and after the
replace, so the observed difference is attributable to the SYMBOL step alone.

This same observation is also encoded as a test case
(`memmap-lookup-controls.test.ts`'s third `PLANTED VIOLATION` case, landed in this plan's
Task 3 commit), so the red is checked mechanically on every future run of the suite, not only
recorded here as a one-time transcript.

Date: 2026-09-05.

## Part 0: the re-measured contender count (correcting the research document)

`37-RESEARCH.md` recorded the processor port's equal-width fixture as carrying TWO contenders.
Plan 37-03 re-measured it against the real, committed `memmap.json` and found the true count is
THREE, exactly one bearing a `sym` — recorded in `37-03-SUMMARY.md`'s key-decisions
("`$0000` has 3 contenders (index 1 carries sym `D6510` -- the SYMBOL step decides)"). This
transcript re-confirms plan 37-03's re-measured number, programmatically, rather than the
research document's figure of 2:

| index | label | `sym` |
|---|---|---|
| 0 | Processor port data direction register | (none) |
| 1 | 6510 On-chip Data Direction Register | `"D6510"` |
| 2 | 7-0 MOS 6510 Data Direction Register (xx101111) Bit= 1 | (none) |

All three are exactly one byte wide (`start=0`, `end=0`, inclusive width 0), so the WIDTH step
cannot decide among them — the SYMBOL step is the one that does, on the committed module.

## Part 1: the step replaced

The `symbolSurvivors()` function (`src/mcp/vice/memmap-lookup.ts:186-189`), `AUTO-02`'s own tie
break. Its committed form:

```typescript
function symbolSurvivors(survivors: readonly MemmapEntry[]): MemmapEntry[] {
  const withSym = survivors.filter((entry) => typeof entry.sym === "string" && entry.sym.length > 0);
  return withSym.length > 0 ? withSym : survivors.slice();
}
```

Replaced, in a scratch copy only, with the reversed rule — prefer the entry WITHOUT a `sym`:

```typescript
function symbolSurvivors(survivors: readonly MemmapEntry[]): MemmapEntry[] {
  const withoutSym = survivors.filter((entry) => !(typeof entry.sym === "string" && entry.sym.length > 0));
  return withoutSym.length > 0 ? withoutSym : survivors.slice();
}
```

The `narrowestWidthSurvivors()` (WIDTH) and `orderWinner()` (residual ORDER) functions were
asserted byte-identical to their committed forms in the scratch copy, both before AND after
this replace, so the observed difference below is attributable to the SYMBOL step alone.

## Part 2: the observation

Under the reversed step, the two sym-less contenders (index 0 and index 2) survive; the
unchanged residual ORDER step then resolves between them by picking whichever appears first in
`entries` order — index 0.

**Observed selection under the mutation:**

| Field | Value |
|---|---|
| Winning entry index (`entries.indexOf(...)`) | **0** |
| Label | `"Processor port data direction register"` |
| `sym` | `undefined` (carries no sym at all) |
| Inclusive width | 0 (still one byte — this control is about the tie-break, not the width) |

This is a specific, named wrong answer: the annotation `$0000` would receive under this
mutation is a contender carrying no symbol, when the requirement states ties should break
TOWARD the entry carrying a `sym`.

**Correct selection, same address, committed (unmutated) module, for comparison:**

| Field | Value |
|---|---|
| Label | `"6510 On-chip Data Direction Register"` |
| `sym` | `"D6510"` |
| `tieBrokenBy` | `"symbol"` |

The committed selection's `tieBrokenBy` naming `"symbol"` confirms the tie-break was genuinely
exercised — an answer reached by the WIDTH or ORDER step alone would mean this control proved
nothing.

## Part 3: the working-tree check

```
$ git status --porcelain src/mcp/vice/memmap-lookup.ts
```

produced 0 lines both immediately before this session's scratch-tree work and immediately after
the scratch tree was torn down in the test's own `finally` — the mutation lived only inside an
`mkdtempSync` directory under `/tmp`, never inside the committed tree.

```
$ node --test memmap-lookup-controls.test.ts
```

3 tests, 3 pass, 0 fail — all three of this requirement's planted-violation controls are green.

```
$ node --test memmap-lookup.test.ts anno-join.test.ts
```

28 tests, 28 pass, 0 fail — the committed module's own behaviour is unaffected by having run
any of the three controls.

## The closing count (Pitfall 23's own named avoidance)

- **Planted-violation cases in `memmap-lookup-controls.test.ts`: 3.**
- **Evidence transcripts committed under this phase's evidence directory with this plan's
  prefix: 3** (`37-04-narrowest-first-match-red.md`, `37-04-narrowest-longest-desc-red.md`,
  `37-04-symtiebreak-reversed-red.md`).
- The committed module's own behaviour is confirmed still correct: `node --test
  memmap-lookup.test.ts anno-join.test.ts` — 28/28 pass, and `npm run typecheck` is clean.

Stated as both explicit numbers, per this plan's own instruction, rather than the bare
"the controls are in place" phrasing `PITFALLS.md` § *Pitfall 23* names as the failure mode this
phase's own tasks exist to avoid.
