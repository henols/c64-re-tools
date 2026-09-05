# AUTO-04's bank decode observed RED (Phase 37, plan 37-06, Task 2)

**What this record is:** a hand-run transcript proving `anno-bank.ts`'s `decodeBankState()` --
the bit arithmetic that decides whether `$D000-$DFFF` currently reads as the I/O area,
Character ROM or RAM -- genuinely matters: bypassing it, in a scratch copy only, makes the
`$34`/`$33` two-value flip **stop changing the annotation**, and the shared subroutine's
border-colour-register write at `$D020` becomes labelled the border colour regardless of which
value was actually recovered. The bypass happened ONLY inside a scratch copy; the committed
`src/mcp/vice/anno-bank.ts` and `src/mcp/vice/anno-join.ts` were never touched (`git status
--porcelain` on both read 0 lines both before and after this session, confirmed below).

This same observation is also encoded as a test case (`anno-bank.test.ts`'s `PLANTED VIOLATION`
test, landed in the same commit as this record), so the red is checked mechanically on every
future run of the suite, not only recorded here as a one-time transcript.

Date: 2026-09-05.

## Part 1: the decode bypassed

`decodeBankState()`'s committed form, `src/mcp/vice/anno-bank.ts`:

```typescript
export function decodeBankState(value: number): BankState {
  const raw = value;
  const b = value & 0x07; // bits #2-#0: CHAREN(2) HIRAM(1) LORAM(0)
  const bits10 = b & 0x03;
  const bit2Set = (b & 0x04) !== 0;

  const ioRange: BankedRegion = bits10 === 0 ? "ram" : bit2Set ? "io_area" : "character_rom";
  const basicRange: BankedRegion = bits10 === 0x03 ? "basic_rom" : "ram";
  const kernalRange: BankedRegion = (b & 0x02) !== 0 ? "kernal_rom" : "ram";

  return { raw, ioRange, basicRange, kernalRange };
}
```

Bypassed, in a scratch copy only, to a form that ignores the processor-port value entirely and
always reports the SAME region -- exactly as an implementation that forgot to decode `$01` at
all would:

```typescript
export function decodeBankState(value: number): BankState {
  const raw = value;
  // BYPASS (planted violation, plan 37-06 Task 2): ignores the processor
  // port entirely and always reports the same region.
  return { raw, ioRange: "io_area", basicRange: "basic_rom", kernalRange: "kernal_rom" };
}
```

## Part 2: the scratch tree, and the red observation

A scratch tree was built holding: the mutated `anno-bank.ts` above; an UNMUTATED copy of
`anno-join.ts` (so the FULL join pipeline is what is observed going wrong, not the decode
function in isolation); and re-export shims (`export * from "<absolute path>";`) forwarding
`anno-join.ts`'s other two sibling imports (`anno-store.ts`, `memmap-lookup.ts`) to the real,
unmutated files -- so the mutated join calls the exact same real store and memmap-lookup
functions the test file itself uses statically. The mutated join was driven from the real,
committed captured export (`fixtures/ghidra/export-bank-path-dependent.txt`), the SAME two
const-write facts Task 1's own flip cases use (`$34` at `$0815`, `$33` at `$081c`), each wired
to `$D020` via one `putXref()` per run.

**Under the committed (unmutated) module:**

| Reaching value | Store address | `$D020` annotation |
|---|---|---|
| `$34` (all-RAM) | `$0815` | NOT "Border color (only bits #0-#3)" -- resolves to the RAM-constrained candidate |
| `$33` (Character ROM) | `$081c` | NOT "Border color (only bits #0-#3)" -- resolves to the Character-ROM-constrained candidate |

The two values produce **DIFFERENT** annotations, confirmed by direct string inequality.

**Under the bypassed (mutated) module:**

| Reaching value | Store address | `$D020` annotation |
|---|---|---|
| `$34` (all-RAM) | `$0815` | **`"Border color (only bits #0-#3)"`** |
| `$33` (Character ROM) | `$081c` | **`"Border color (only bits #0-#3)"`** |

The two values now produce the **SAME** annotation -- the flip has stopped -- and that
annotation is specifically the wrong one the requirement names: the border-colour register
label, regardless of which value was actually recovered, because the bypass always reports
`io_area` at the I/O range no matter what `$01` held.

## Working-tree check

```
$ git status --porcelain src/mcp/vice/anno-bank.ts src/mcp/vice/anno-join.ts
```

produced 0 lines both immediately before this session's scratch work began and immediately
after the scratch tree was torn down -- the bypass lived only inside a `mkdtempSync` directory
under this host's RAM-backed `/tmp`, never inside the committed tree.

## Closing note

This observation is encoded as `anno-bank.test.ts`'s `"PLANTED VIOLATION: bypassing
decodeBankState() makes the $34/$33 flip stop changing the annotation, and the border-colour
write is now labelled the border colour"` test case, which re-checks it mechanically on every
future run of the suite.
