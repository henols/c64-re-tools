# AUTO-03: the in-image skip observed RED (Phase 37, plan 37-05, Task 1)

**What this record is:** a hand-run transcript proving `runMemmapJoin()`'s in-image early-return
guard genuinely does the work `AUTO-03` requires -- when the guard is DELETED (in a scratch copy
only), an ordinary program address the real, committed `memmap.json` happens to cover starts
annotating as a machine feature, and the injected COUNTING selection spy proves the map lookup
was genuinely REACHED under the mutation and genuinely UNREACHED under the committed code. That
second half is what makes this a claim about control flow rather than about the result a caller
sees back -- a result-filtering implementation (compute the selection, then discard it for an
in-image address) would satisfy the label half of this control while failing the spy half. The
mutation happened ONLY inside a `mkdtempSync` scratch tree; the committed
`src/mcp/vice/anno-join.ts` was never opened for writing (`git status --porcelain` on that file
read 0 lines both before and after this session, confirmed below).

This same observation is also encoded as a test case (`join-image-controls.test.ts`'s first
`PLANTED VIOLATION` test, landed in the same commit as this record), so the red is checked
mechanically on every future run of the suite, not only recorded here as a one-time transcript.

Environment: this repository's own committed `anno-store.ts`/`anno-join.ts`/`memmap-lookup.ts`
and `src/skills/c64-memory-mapping/memmap.json`, read directly (no scratch copy of the map is
needed for this control -- only the join module's own guard is mutated). Date: 2026-09-05.

## Part 1: the guard reverted

The single early-return guard `runMemmapJoin()` runs BEFORE calling `selectEntry()` at all
(D-37-12), committed at `src/mcp/vice/anno-join.ts`:

```
    if (address >= imageStart && address <= imageEnd) {
      skippedInImage += 1;
      decisions.push({
        address,
        outcome: "skipped-in-image",
        reason:
          `address $${address.toString(16)} lies inside the loaded image's own range ($${imageStart.toString(16)}-` +
          `$${imageEnd.toString(16)}) and is therefore a program address, never looked up in memmap.json`,
      });
      continue;
    }
```

Deleted, in a scratch copy only, leaving every other line of the file byte-identical -- the
scratch copy's two sibling imports (`./anno-store.ts`, `./memmap-lookup.ts`) are satisfied by
tiny re-export shims forwarding to the real, absolute, unmutated files, so the mutated join calls
the exact same real store functions and the exact same real selection logic the committed tree
uses.

## Part 2: the command and the red observation

A store was built holding two cross-reference rows: one targeting `$0800` (2048, the BASIC
area's own first byte), one targeting `$D020` (53280, the border-colour register) -- against a
synthetic image range `$07f0-$080f` that covers `$0800` but not `$D020`. An injected counting
selection spy was passed in place of `selectEntry`, delegating to the real `selectMemmapEntry` so
the out-of-image address is still genuinely annotated (the spy only counts, it never fakes an
answer). MEASURED at execution time, over the real, committed `memmap.json`: `$0800` has exactly
2 containing entries, the narrowest 1 byte wide, labelled `"Unused"`.

**Committed code (guard present) -- for comparison:**

```
counts: {"addressesConsidered":2,"annotated":1,"skippedInImage":1,"skippedNoMapEntry":0,"declined":0,"commentsChanged":1}
decisions: [
  { "address": 2048, "outcome": "skipped-in-image",
    "reason": "address $800 lies inside the loaded image's own range ($7f0-$80f) and is therefore a program address, never looked up in memmap.json" },
  { "address": 53280, "outcome": "annotated", "label": "Border color (only bits #0-#3)" }
]
spy calls: [53280]
```

**Mutated code (guard deleted) -- the red observation:**

```
counts: {"addressesConsidered":2,"annotated":2,"skippedInImage":0,"skippedNoMapEntry":0,"declined":0,"commentsChanged":2}
decisions: [
  { "address": 2048, "outcome": "annotated", "label": "Unused" },
  { "address": 53280, "outcome": "annotated", "label": "Border color (only bits #0-#3)" }
]
spy calls: [2048, 53280]
```

| Field | Committed (guard present) | Mutated (guard deleted) |
|---|---|---|
| `$0800`'s outcome | `skipped-in-image` | **`annotated`, label `"Unused"`** |
| Spy called for `$0800`? | **No** (`spy calls: [53280]`) | **Yes** (`spy calls: [2048, 53280]`) |
| `$D020`'s outcome | `annotated` (unaffected) | `annotated` (unaffected) |

Removing the guard makes an ordinary, map-covered in-image address (`$0800`) annotate as a
machine feature (`"Unused"`), exactly as `AUTO-03`'s own failure story describes (the first
attempt annotated ordinary program addresses as machine features) -- and the spy call list proves
the map lookup was genuinely reached under the mutation (`2048` now appears) and genuinely
unreached under the committed code (`2048` is absent), which is the control-flow half of this
control, not merely a result-only assertion. The out-of-image `$D020` address is annotated under
BOTH runs, proving the guard is selective rather than a total on/off switch.

## Part 3: the committed tree is unaffected

The committed run above (Part 2, "Committed code") was executed directly against this
repository's own real, on-disk `anno-join.ts`, `anno-store.ts` and `memmap-lookup.ts` -- no
scratch copy involved for that half at all. The mutation lived only inside a temporary directory
under this host's RAM-backed `/tmp`, removed immediately after the mutated run.

## Working-tree check

```
$ git status --porcelain src/mcp/vice/anno-join.ts
```

produced 0 lines both immediately before this session's scratch work began and immediately after
the scratch tree was torn down -- the guard's deletion lived only inside a `mkdtempSync`
directory, never inside the committed tree.

## Closing note

This observation is encoded as a passing test case in `src/mcp/vice/join-image-controls.test.ts`
(the file's first test, titled `PLANTED VIOLATION: deleting runMemmapJoin's in-image guard makes
an ordinary, map-covered in-image address ($0800, "Unused") annotate as a machine feature, with
the injected selection spy proving the guard is control flow, not result filtering`), so this red
is re-checked mechanically on every future run of the suite rather than depending on this
transcript alone.
