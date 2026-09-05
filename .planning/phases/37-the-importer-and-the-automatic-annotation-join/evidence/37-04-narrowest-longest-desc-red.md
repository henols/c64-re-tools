# AUTO-02 control 2: longest-description selection reddens narrowest-range-wins at $D020 (Phase 37, plan 37-04, Task 2)

**What this record is:** a hand-run transcript proving that `selectMemmapEntry()`'s
narrowest-range-wins criterion for `$D020` genuinely FAILS a SECOND, order-independent way —
not merely under first-match selection (control 1), but also when the WIDTH comparison step is
replaced with a rule that prefers the containing entry whose `desc` string is longest. The
mutation happened ONLY inside a scratch copy under this host's RAM-backed `/tmp`; the committed
`src/mcp/vice/memmap-lookup.ts` was never opened for writing (`git status --porcelain` on that
file read 0 lines both before and after this session, confirmed below).

This same observation is also encoded as a test case
(`memmap-lookup-controls.test.ts`'s second `PLANTED VIOLATION` case, landed in this plan's
Task 2 commit), so the red is checked mechanically on every future run of the suite, not only
recorded here as a one-time transcript.

Date: 2026-09-05.

## Why this control is not redundant with control 1 (first-match)

An implementation that happened to enumerate `$D020`'s 8 containing entries in narrowest-first
order would return the correct 1-byte entry under a first-match rule — surviving control 1's
mutation by accident, because "the first entry the scan finds" and "the narrowest entry" would
coincide for that particular enumeration order. It would still FAIL this control, because
longest-description selection does not depend on enumeration order at all: it scans every
contender's own `desc` length regardless of where each one sits in `entries`. Both controls are
required because each catches a different way "compare widths" could have been silently
dropped — one that happens to depend on scan order, and one that provably does not.

## Part 1: the step replaced

The same `narrowestWidthSurvivors()` function control 1 replaced
(`src/mcp/vice/memmap-lookup.ts:169-176`), this time with a different replacement body:

```typescript
function narrowestWidthSurvivors(containing: readonly MemmapEntry[]): MemmapEntry[] {
  let winner = containing[0]!;
  for (const entry of containing) {
    if (entry.desc.length > winner.desc.length) winner = entry;
  }
  return [winner];
}
```

## Part 2: the observation

MEASURED at execution time, over the real committed `memmap.json`'s 8 containing entries at
`$D020`: the entry with the longest `desc` string is `entries[441]`, at 295 characters —
`"I/O Area (memory mapped chip registers), Character ROM or RAM area (4096 bytes); depends on
the value of bits #0-#2 of the processor port at memory address $0001: ..."`. This was measured
programmatically (not assumed from the plan) so a later map edit that changes which entry holds
the longest description would fail this transcript's own assertion loudly.

**Observed selection under the mutation:**

| Field | Value |
|---|---|
| Winning entry index (`entries.indexOf(...)`) | **441** |
| Label | `"I/O Area (memory mapped chip registers), Character ROM or RAM area (4096 bytes);..."` |
| `desc` length | 295 characters |
| Inclusive width (`end - start`) | **4095** (a 4096-byte range: `start=53248`, `end=57343`) |

This is a specific, named wrong answer, again of the same kind the requirement warns about: an
answer wider than one byte.

**Correct selection, same address, committed (unmutated) module, for comparison:**

| Field | Value |
|---|---|
| Label | `"Border color (only bits #0-#3)"` |
| Inclusive width | 0 (a 1-byte range) |

## Part 3: the working-tree check

```
$ git status --porcelain src/mcp/vice/memmap-lookup.ts
```

produced 0 lines both immediately before this session's scratch-tree work and immediately after
the scratch tree was torn down in the test's own `finally` — the mutation lived only inside an
`mkdtempSync` directory under `/tmp`, never inside the committed tree.

```
$ node --test memmap-lookup.test.ts anno-join.test.ts
```

28 tests, 28 pass, 0 fail — the committed module's own behaviour is unaffected by having run
either control.

## Closing note

The same observation is encoded as a test case in `memmap-lookup-controls.test.ts` (the second
`PLANTED VIOLATION` case in that file, which measures the longest-description winner
programmatically rather than pinning `entries[441]` as a literal), so this red is re-checked
mechanically on every future run of the suite.
