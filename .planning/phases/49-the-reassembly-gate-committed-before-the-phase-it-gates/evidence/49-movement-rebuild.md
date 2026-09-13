# Phase 49, plan 49-07 — `MOVEMENT_REBUILD` and `DIFF_SCOPE_COVERAGE` (movement occurrence)

Declares the two outcome lines `SCHEMA.md` §3 assigns to this file:
`MOVEMENT_REBUILD` (§2.2) and `DIFF_SCOPE_COVERAGE`'s movement-run occurrence
(§2.4).

**On this file's own excerpt.** Sliced to carry only its two assigned
lines, from the same single run `evidence/49-tree-rebuild.md` cites (see
that file's own header note) — never re-quoting the full multi-input
transcript, so this file does not "declare" a line that belongs to another
evidence file. See `## ACCEPTED LIMIT` below for the one place this plan's
own `<verify>` line-count command disagrees with `SCHEMA.md`'s own
dual-occurrence design for `DIFF_SCOPE_COVERAGE`.

---

## What was measured

The run harness relocates the shared movement subject's `routine_a` — the
same subject plan 49-04 built (`src/mcp/vice/reassembly-gate-movement-subject.ts`,
extracted this plan so the run harness reuses it rather than declaring a
second one) — through the real transform `relocateSubject()`, by the same
delta plan 49-04 chose: `261` bytes (`$0105`), which changes both octets of
the moved address. `routine_a`'s original address is `$080B` (2059); its
relocated address is `$0910` (2320) — two different addresses, as required
whenever the movement outcome is not the refused token.

The relocated subject (its transformed store document and its rebuilt
image) is exported as a fresh tree through the same real `exportAsmTree()`,
and verified through the same real tree-aware entry point
`verifyAcmeAssemblesTree()` — the identical real ACME binary the baseline
rebuild used — against the relocated export's own `expectedBytes`: 272
bytes across 4 emitted blocks.

The same run also builds the real hazard report over the **relocated**
subject's own bytes and ranges, and runs the diff-scope helper against the
relocated export's own half-open extent, `$0801..$0911` (exclusive). The
movement subject (an absolute-indexed entry load, a `lo_hi_address` split
table, two one-byte routines) is the small, purpose-built relocation
subject plan 49-04 constructed for exercising the transform — not the
hazard-bearing committed subject — so its own hazard report carries zero
findings and zero undecided regions, which is why this occurrence of
`DIFF_SCOPE_COVERAGE` reads `complete`.

## Command and raw output (this file's own excerpt)

```
$ date -u +"%Y-%m-%d"
2026-09-13

$ cd src/mcp/vice && node --test reassembly-gate-run.test.ts
[...]
movement rebuild:
MOVEMENT_REBUILD: ok
DIFF_SCOPE_COVERAGE: complete
[...]
context: movement-subject=routine_a movement-delta=261 ($0105) movement-original-address=$080B movement-relocated-address=$0910
context: movement-outcome-reason="the output file this run created is byte-identical to the expected bytes (272 byte(s) across 4 segment(s))." movement-byte-length=272 movement-segment-count=4 movement-diff-scope-extent=$0801..$0911 (exclusive)
[...]
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

Exit code of the full `node --test` invocation, read directly on the same
line (never through a pipe): `0`.

## Reading the two lines this file declares

`MOVEMENT_REBUILD: ok` is `movementRebuildFromResult()`'s own token derived
from the real assembler verdict (`buildMovementResult()`), carried through
unchanged because the relocation delta is non-zero (`261`, not `0`) — never
`"refused"` by the same-address rule, since the two addresses genuinely
differ ($080B vs $0910).

`DIFF_SCOPE_COVERAGE: complete`, immediately beneath it under the
`movement rebuild:` heading in the harness's own output, is this file's own
declared occurrence of that input, per `SCHEMA.md` §2.4's two-file rule —
the baseline occurrence (`incomplete`) is declared in
`evidence/49-tree-rebuild.md` instead.

## ACCEPTED LIMIT

Same accepted limit as `evidence/49-tree-rebuild.md` records in full: this
plan's own Task 2 `<verify>` asserts a total of seven bare outcome-line
matches across the five evidence files, but `SCHEMA.md` §2.4/§3 require
`DIFF_SCOPE_COVERAGE` to appear as its own bare line in two separate files
(this one and `evidence/49-tree-rebuild.md`), making the true, schema-correct
total eight. This file's own `DIFF_SCOPE_COVERAGE: complete` line is written
here because omitting it would leave this file's declared input ABSENT —
never a pass, per `SCHEMA.md` §1/§4 — which is the worse of the two
outcomes. The findings document records the corresponding override.

---

<!-- The two bare lines this file declares are already quoted verbatim in
     the code fence above -- not repeated a second time here, for the same
     reason `evidence/49-tree-rebuild.md` states. -->
