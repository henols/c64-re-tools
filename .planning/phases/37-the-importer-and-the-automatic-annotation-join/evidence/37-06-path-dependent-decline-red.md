# AUTO-05's path-dependent decline observed RED (Phase 37, plan 37-06, Task 3)

**What this record is:** a hand-run transcript proving `anno-join.ts`'s decline branch --
the rule that a program point reached under two DISAGREEING recovered processor-port values
must decline with a reason, never annotate with either one -- genuinely matters: replacing it,
in a scratch copy only, with a form that forward-carries the FIRST reaching value produces a
confident annotation at `$D020`, the shared subroutine's address where the real captured
export's own `$34` and `$33` facts disagree, where the committed code correctly stays silent.
The mutation happened ONLY inside a scratch copy; the committed `src/mcp/vice/anno-join.ts` and
`src/mcp/vice/anno-bank.ts` were never touched (`git status --porcelain` on both read 0 lines
both before and after this session, confirmed below).

This is the sixth and last of the phase's six required observed-red controls
(`37-VALIDATION.md`'s own table, row 6). It is also encoded as a test case
(`anno-bank.test.ts`'s second `PLANTED VIOLATION` test, landed in the same commit as this
record), so the red is checked mechanically on every future run of the suite, not only
recorded here as a one-time transcript.

Date: 2026-09-05.

## Why there is no prior art to validate this decline against

`AUTO-05`'s own measured survey (`.planning/REQUIREMENTS.md`) found that three comparable tools
all annotate their device/register maps unconditionally: SVD-Loader (a comparable
device-description importer), radare2's device-description import, and IDA's device
definitions. None of them declines, because none of their domains has a path-dependent address
meaning -- a register map for an ARM SVD file, or a device-tree import, means the same thing no
matter what code path reached it. This project's own domain is the exception: the SAME `$D020`
write can be the VIC-II border-colour register, plain RAM, or a Character-ROM byte, depending
entirely on which processor-port value the program itself set before reaching it. There is
therefore no external precedent to lean on here -- the absence itself is the argument FOR this
control, not a gap in it: nothing else in the surveyed prior art has ever had to prove that its
own "decline rather than guess" rule actually bites, because nothing else needed the rule in the
first place.

## The conservatism limit this decline sits inside

D-37-24 records, and this control does not soften: the reaching-values computation Task 1 built
is NOT a dataflow analysis. It walks the stored cross-reference graph forward from each
recovered const-write's own address, and if that graph does not connect a store to a given
program point, the value simply never joins the reaching set for that point. A real dataflow
analysis would resolve strictly more cases than this conservative walk does -- meaning the
decline count over a real binary will be HIGHER than a reader used to a fuller analysis would
expect. That is the deliberate trade this project made in the direction the requirement points:
a decline is a stated absence, and the whole point of `AUTO-05` is that a stated absence beats a
confident guess, even at the cost of declining some cases a heavier analysis would have
resolved.

**The actual decline count observed in this session's own committed-module run: 1.** One
address (`$D020`) was driven through the committed, unmutated join with both the `$34` and `$33`
const-write facts wired to reach it (via `putXref()`, mirroring the real, measured control-flow
fact the `.prg`-route capture's own internal-`jsr` defect prevents the automatic `REFERENCES`
scan from proving directly -- see `fixtures/ghidra/README.md`'s own recorded finding). That one
address declined; `runMemmapJoin()`'s own `counts.declined` read `1` and no comment was written
for it (confirmed by `listComments()` on the committed run reporting zero rows for `$D020`).
This is a per-scenario count, not a corpus-wide measurement -- reported as the number this
session actually observed, per this task's own instruction to report numbers rather than
qualities.

## Part 1: the decline branch replaced

The decline branch's committed text, `src/mcp/vice/anno-join.ts` (the "several values resolving
to different regions" case):

```typescript
      if (uniqueRegions.size > 1) {
        declined += 1;
        const named = uniqueValues.map((value, i) => `$${value.toString(16)}(${regionsByValue[i]})`).join(", ");
        decisions.push({
          address,
          outcome: "declined",
          reason: `$${address.toString(16)} is reached under disagreeing processor-port values: ${named}`,
        });
        continue;
      }
```

Replaced, in a scratch copy only, with a forward-carry: take the FIRST (ascending) reaching
value and annotate with its own region, exactly as an implementation that carried a single bank
value forward past a disagreement would:

```typescript
      if (uniqueRegions.size > 1) {
        const region = regionsByValue[0]! as Exclude<BankedRegion, "not_applicable">;
        annotateUnderRegion(region, `$${uniqueValues[0]!.toString(16)}`);
        continue;
      }
```

## Part 2: the scratch tree, and the red observation

A scratch tree was built holding the mutated `anno-join.ts` above, plus re-export shims
(`export * from "<absolute path>";`) forwarding ALL THREE of its sibling imports
(`anno-bank.ts`, `anno-store.ts`, `memmap-lookup.ts`) to the real, unmutated files -- none of
those three siblings needed mutating for this control, only resolving. The mutated join was
driven from the real, committed captured export's own const-write facts (`$34` at `$0815`,
`$33` at `$081c`), BOTH wired to reach `$D020` via `putXref()` -- the disagreeing-values case.

**Under the committed (unmutated) module:** `$D020`'s decision is `declined`, its reason names
both `$34` and `$33`, `counts.declined` reads `1`, and `listComments()` over that store reports
ZERO rows -- no comment exists.

**Under the forward-carry (mutated) module:** `$D020`'s decision is `annotated`, exactly ONE
comment is written, and its label equals the SAME label the character-ROM-constrained candidate
set independently computes for `$33` (the ascending-sorted first value) -- confirming the
mutation produced a confident, specific, WRONG annotation rather than merely "some different
outcome".

## Working-tree check

```
$ git status --porcelain src/mcp/vice/anno-join.ts src/mcp/vice/anno-bank.ts
```

produced 0 lines both immediately before this session's scratch work began and immediately
after the scratch tree was torn down -- the forward-carry replacement lived only inside a
`mkdtempSync` directory under this host's RAM-backed `/tmp`, never inside the committed tree.

## Closing note: the phase's six required controls, all discharged

Across this plan (`37-06`) and its two predecessors in the same wave-sequence
(`37-04`, `37-05`):

- `anno-bank.test.ts` (this plan) carries **2** planted-violation cases -- the bank-decode
  bypass (Task 2) and this task's forward-carried decline.
- **2** transcripts are committed with this plan's own `37-06-` prefix:
  `37-06-bank-decode-bypass-red.md` and this file.
- The phase's six required observed-red controls (`37-VALIDATION.md`'s own table) are now ALL
  discharged: three from plan `37-04` (narrowest-range-wins first-match, narrowest-range-wins
  longest-description, the `sym` tie-break reversed), one from plan `37-05` (the in-image skip
  removed), and two from this plan (the bank decode bypassed, the decline forward-carried) --
  **6 of 6**. Stated as the count itself, not as an assertion that "the controls are in place",
  per this task's own instruction and `.planning/research/PITFALLS.md`'s Pitfall 23.
