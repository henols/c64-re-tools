# AUTO-02 control 1: first-match selection reddens narrowest-range-wins at $D020 (Phase 37, plan 37-04, Task 1)

**What this record is:** a hand-run transcript proving that `selectMemmapEntry()`'s
narrowest-range-wins criterion for `$D020` (the border-colour register resolves to the 1-byte
`"Border color (only bits #0-#3)"` entry, never a wider containing entry) genuinely FAILS when
the WIDTH comparison step is switched to first-match selection — return the first containing
entry found, in scan order, without comparing widths at all — and that the committed source
still resolves `$D020` correctly immediately afterwards. The mutation happened ONLY inside a
scratch copy under this host's RAM-backed `/tmp`; the committed
`src/mcp/vice/memmap-lookup.ts` was never opened for writing (`git status --porcelain` on that
file read 0 lines both before and after this session, confirmed below).

This same observation is also encoded as a test case
(`memmap-lookup-controls.test.ts`'s first `PLANTED VIOLATION` case, landed in this plan's
Task 1 commit), so the red is checked mechanically on every future run of the suite, not only
recorded here as a one-time transcript.

Date: 2026-09-05.

## Part 1: the step replaced

The `narrowestWidthSurvivors()` function (`src/mcp/vice/memmap-lookup.ts:169-176`), the whole
of narrowest-range-wins. Its committed form:

```typescript
function narrowestWidthSurvivors(containing: readonly MemmapEntry[]): MemmapEntry[] {
  let minWidth = Infinity;
  for (const entry of containing) {
    const width = inclusiveWidth(entry);
    if (width < minWidth) minWidth = width;
  }
  return containing.filter((entry) => inclusiveWidth(entry) === minWidth);
}
```

Replaced, in a scratch copy only, with a first-match selection that never compares widths at
all:

```typescript
function narrowestWidthSurvivors(containing: readonly MemmapEntry[]): MemmapEntry[] {
  return [containing[0]!];
}
```

## Part 2: the observation

`$D020` has 8 containing entries in the real, committed `memmap.json` (re-measured this
session, matching plan 37-03's own re-measured count). Under the first-match mutation, the
selection returns the FIRST of those 8 in `entries` array order — not either of the two
1-byte contenders (index 506, 507).

**Observed selection under the mutation:**

| Field | Value |
|---|---|
| Winning entry index (`entries.indexOf(...)`) | **438** |
| Label | `"6566 Video Interface Chip, VIC II"` |
| Inclusive width (`end - start`) | **46** (a 47-byte range: `start=53248`, `end=53294`) |
| `contenderCount` reported | 8 |

This is a specific, named wrong answer, not merely "a different answer": the annotation `$D020`
would receive under this mutation is the whole-chip label, not the border-colour register.

**Correct selection, same address, committed (unmutated) module, for comparison:**

| Field | Value |
|---|---|
| Label | `"Border color (only bits #0-#3)"` |
| Inclusive width | 0 (a 1-byte range: `start=53280`, `end=53280`) |
| `tieBrokenBy` | `"order"` (neither 1-byte contender at index 506/507 carries a `sym`) |

## Part 3: the working-tree check

```
$ git status --porcelain src/mcp/vice/memmap-lookup.ts
```

produced 0 lines both immediately before the scratch-tree work in this session began and
immediately after the scratch tree was torn down (`fs.rmSync(tmpDir, { recursive: true, force:
true })` in the test's own `finally`) — the mutation lived only inside an `mkdtempSync`
directory under `/tmp`, never inside the committed tree.

```
$ node --test memmap-lookup.test.ts anno-join.test.ts
```

28 tests, 28 pass, 0 fail — the committed module's own behaviour is unaffected by having run
the control.

## Closing note

The same observation is encoded as a test case in `memmap-lookup-controls.test.ts` (the first
`PLANTED VIOLATION` case in that file), so this red is re-checked mechanically on every future
run of the suite rather than being a claim recorded here once and never re-verified.
