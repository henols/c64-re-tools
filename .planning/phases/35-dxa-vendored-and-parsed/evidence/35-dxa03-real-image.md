# DXA-03 real-image exercise (Phase 35, plan 35-04, Task 3)

**What this record is:** `DXA-03`'s route exercise on a real cracked release --
a before/after pair of dxa's OWN classification of one named, hand-chosen
known-data range, run through the `-B`/`-l` route `dxa-blocks.ts` and
`dxa-run.ts` land in this plan. It states the mechanism worked on real
cracked code. It is not a measurement of how often dxa gets code/data
classification right or wrong on cracked releases in general, and it does
not attempt to be one -- that is a separate, later requirement this plan is
not entitled to answer from one release and one range.

## Release identity

The corpus release is never committed to this repository (D-04,
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/README.md`
convention 10). Identity is name plus sha256 only:

| Field | Value |
|---|---|
| Release name | `danish.d64` |
| Path (gitignored, operator-supplied) | `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64` |
| File size | 174848 bytes |
| sha256 | `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` |

This is the SAME release identity Phase 23's own real-release gate recorded
for this file.

## Extracted entry

Read with the committed `anno-d64.ts` reader (`listEntries()` /
`extractEntry()`) -- no VICE, no broker, no capture pipeline. The image has
exactly one directory entry:

| Field | Value |
|---|---|
| Entry name | `BRUCE LEE   (DC)` |
| Entry type | `PRG` |
| Extracted length | 45074 bytes (2-byte `.prg` load-address header + 45072-byte body) |
| sha256 of the extracted bytes | `331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4` |

Extracted with:

```
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
import { listEntries, extractEntry } from './anno-d64.ts';
const img = readFileSync('.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64');
const entries = listEntries(new Uint8Array(img));
const bytes = extractEntry(new Uint8Array(img), entries[0].name);
writeFileSync('<scratch>/release.prg', Buffer.from(bytes));
"
```

`dxa-live.test.ts`'s `dxa-live CORPUS` case performs the identical extraction
at test time, into a `mkdtemp`-created scratch directory OUTSIDE this
repository's working tree, so the extracted `.prg` never touches the
repository (verified below: `git status --porcelain` shows no `.d64` and no
extracted `.prg`).

## The chosen range and its basis (A-11: hand-supplied, not derived)

The extracted `.prg`'s own BASIC header, read directly from its first bytes
(load address `$0801`, then a standard tokenised BASIC line), is `10
SYS2073` -- decimal 2073 is `$0819`. Declaring `$0819` as dxa's ONE routine
(`-R`) under this seam's FIXED `-d skip-scanning -t detect-internal -p
all-nmos6502` policy (`host-tool.mts`'s `dxa.disassemble` argv, unconfigurable
per-request) is enough for dxa itself to discover a real, multi-instruction
code region there: `lda #$36` / `sta $01` / `jmp $b70a` (`$0819-$081f`,
3 instructions, 7 bytes), the routine dxa's OWN skip-scanning heuristics
follow through that unconditional jump.

**The range this task names is `$0819-$081f`** -- exactly the seven bytes
dxa's own baseline run (below) classifies as code from that one declared
entry point. This mirrors this plan's own tracer exercise (Task 2) on a real
image: the point being exercised is the MECHANISM (a named known-data range
removes bytes from dxa's code discovery), not a claim that this project has
determined which bytes of a cracked Commodore 64 game are "real" data --
that determination is a human annotation judgement (A-11), and Phase 37's
`AUTO-06`/`AUTO-07` is where an automatically DERIVED graphics/data range
enters this same emitter, not this plan.

## Both commands, verbatim

Both runs use the IDENTICAL `-R release.entrypoints` (containing `0819`);
the ONLY difference is the added `-B` file in the second run. Both were
executed through this plan's own `dxa-run.ts`/`dxa-blocks.ts` route (via
`runDxaDisassemble()`), which resolves to this underlying `dxa` invocation:

**Without the known-data range:**

```
vendor/dxa/dxa -p all-nmos6502 -d skip-scanning -t detect-internal \
  -R release.entrypoints -a dump release.prg
```

**With the known-data range** (`dxa-blocks.ts`'s `emitDataBlocks()` writes a
one-line `-B` file, `0819-081f`):

```
vendor/dxa/dxa -p all-nmos6502 -d skip-scanning -t detect-internal \
  -R release.entrypoints -B release.dxa-blocks.txt -a dump release.prg
```

## Before/after classification of the named range

Read directly from dxa's OWN listing, per byte, over `$0819-$081f`:

| Address | Without the range | With the range |
|---|---|---|
| `$0819`-`$081f` (all 7 bytes) | `code` (matched instructions `lda #$36` / `sta $01` / `jmp $b70a`) | `data` (`.byt` lines) |

This is the criterion DXA-03 states -- "excluded from discovery" -- observed
in dxa's own classification, never inferred from the `-B` file's own
syntactic validity. `dxa-live.test.ts`'s `dxa-live CORPUS` case asserts this
exact per-address membership (every address in `$0819-$081f` is in dxa's
`code` set without the range and in its `data` set, never its `code` set,
with the range) -- a RELATIVE assertion, not a pinned byte count of a
release this repository does not ship (per this plan's own `<action>` text).

As an incidental, honestly-reported observation (not an assertion this
record or the test relies on): naming just those seven bytes as data also
removed the entire downstream chain dxa had followed through the `jmp
$b70a` from `code` classification too, because with the entry point itself
now declared data, dxa never re-enters that routine's control flow at all.
This is not a claim about how much of the release IS actually code or data
-- only a note that the mechanism's effect can cascade beyond the literal
named bytes when the named range is a routine's own entry point.

## Oracle narrowing (D-04)

This task produced and consumed NO capture pair. The `anno-d64.ts` route
reads the corpus `.d64`'s directory and one file's byte contents directly
off disk -- no VICE, no broker, no checkpoint, no runtime observation of any
kind, and therefore nothing for the two-term `(PC, hit_count)` oracle (with
the frame term `(LIN, CYC)` recorded but not asserted, per `D-04`'s
pre-mapped narrowing of rule R6) to apply to. Stated explicitly per this
plan's own instruction to say so rather than leave the line out.

## Working-tree check

`git status --porcelain` was verified to show no `.d64` file (the corpus
image, gitignored per `evidence/corpus/.gitignore`) and no extracted `.prg`
(written only to a `mkdtemp` scratch directory outside this repository,
removed in the test's own `finally` block) at the time this record was
written.
