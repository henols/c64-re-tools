# Coverage control fixtures — COV-02

**Nine** committed synthetic fixtures, in three groups.

- **Five findings controls plus one non-vacuity control** (`nc1`…`nc5`). Five must FAIL and one
  must PASS. Without `nc5-well-documented` the whole coverage instrument would be vacuous: an
  instrument that fails everything measures nothing.
- **One false-positive control PAIR for the structural census** (`fp1`, `fp1b`). These are not
  findings controls at all. The property they hold down is that the census does **not inflate** —
  `structural.reachedAsInstruction` may never exceed the real code size — and their clean/non-clean
  verdict is incidental, which is why both declare `expect_measure: null`.
- **The dispatch gate's INTERIOR control** (`fp2`). `fp1`/`fp1b` carry no zero-page store at all
  and the positive control `SPLIT_TABLE` carries a real `jmp ($00fb)`, so those two bracket the
  gate from the **outside**. `fp2-zeropage-data-pointer` is *inside* it: a zero-page vector that is
  genuinely built and then consumed by an indirect-indexed **data** read. A negative control built
  from the outside of the predicate it constrains is not a control at all — which is why a
  2517-passing suite concealed `19-REVIEW.md` CR-04.

Every fixture is generated, never hand-written:

```sh
cd src/mcp/vice && node fixtures/coverage/make-coverage-fixtures.mjs
```

The generator is deterministic and idempotent — running it twice must leave
`git status --porcelain src/mcp/vice/fixtures/coverage` empty. Project files are produced by this
repository's own real `synthesizeProject()`, so the payload format is exactly what the shipped
writer emits rather than a hand-assembled approximation.

## What each fixture is a control for

| Directory | Control | The defect it plants | The measure that must catch it |
|---|---|---|---|
| `nc1-all-auto` | NC1 | every label is `kind: Auto` with its auto name intact | `labels` — `userFraction` is 0 **and** `autoPrefixNamesRemaining` is 4 |
| `nc1b-auto-renamed-in-place` | NC1b | every label flipped to `kind: User` with the auto NAME unchanged | `labels` — the kind figure looks perfect, so only `autoPrefixNamesRemaining` catches it. **This is the control that proves the second label figure earns its place.** |
| `nc2-generic-comments` | NC2 | every line comment is the same banned-generic string | `commentVacuity` — `distinctCommentRatio` collapses and every address lands in `bannedGenericAddresses` |
| `nc3-all-data-blocks` | NC3 | every byte set to a data block type while the code is real | `divergence` — the census does not move by one byte, and `censusCodeStoreNotCode` explodes |
| `nc4-multi-caller-unnamed` | NC4 | the two-caller label at `$0820` is documented without naming either caller | `reproducibility` — the strictly-more-than-one-caller cross-reference rule |
| `nc5-well-documented` | NC5 | **nothing** — a genuinely well-documented program | none: this one must come back **clean** |
| `fp1-indexed-copy-loop` | FP1 | **nothing** — an ordinary two-table indexed copy loop that dispatches through nothing. It is a control against a defect the *instrument* can commit, not one a project can | `structural.reachedAsInstruction` must not exceed the `code_size` the store declares (7), and must equal FP1b's. Pre-gate this program reported **55** of 64 bytes reached |
| `fp1b-immediate-copy-loop` | FP1b | **nothing** — FP1 with its two loads made immediate; the only difference between the two programs | the baseline half of the pair: it reported **7** pre-gate and must still report 7, so FP1's number is compared against a *measured* value rather than a remembered one |
| `fp2-zeropage-data-pointer` | FP2 | **nothing** — an ordinary 16-bit pointer: two indexed table reads stored into `$fb`/`$fc`, then `lda ($fb),y`. It satisfies **every** condition the pre-CR-04 dispatch gate required while dispatching nowhere at all. **This is the control that reaches the gate's interior**, which no prior control did | `dispatch.splitTables`, `provenDispatchTargets()` and `dispatch.tableEntryAddresses` must all be **empty**, `classAt($0840)` must be `unreached`, and `structural.reachedAsInstruction` must not exceed the declared `code_size` (17). Pre-fix: `splitTables=1`, eight proven targets at `$0840`…`$0847`, 16 claimed table-entry bytes, `classAt($0840)="reached-as-instruction"`, **reached=33** |

## Shape of each fixture

| File | What it is |
|---|---|
| `project.regen2000proj` | the project file, written by `synthesizeProject()`. Identical across the **five** `nc*` fixtures — for those, only the store differs. The false-positive pair and the interior control each carry their own program, which is the whole point of them. |
| `store.json` | the already-fetched store data in exactly the shape the curated read tools return: `symbols`, `comments`, `blocks`, `cross_references`. Also carries `control`, `purpose`, `expect_clean` and `expect_measure`, so `r2000-coverage.test.ts` is data-driven off the fixture rather than repeating each expectation in test code. The false-positive pair and the interior control additionally carry `code_size`, so the non-inflation assertion reads the bound **from the fixture** instead of from a number typed into a test. |

## The program shared by the five `nc*` fixtures

The **five** `nc*` fixtures carry the same 64-byte program at `$0810`; the false-positive pair and
the interior control do not, and no fixture outside the `nc*` group is claimed to. It has real
subroutines, one label reached
from **two** call sites (which is what the cross-reference rule engages on), one absolute data
reference, one indexed data reference, and deliberate unreachable filler. The filler is what makes
the divergence sub-report's "store says `Code`, the census never reached it" direction non-zero
even on the well-documented control — proving that direction is *reported*, not treated as a
defect.

Byte-level layout is in the generator's own header comment, disassembled line by line.

## The false-positive pair's own two programs

`fp1-indexed-copy-loop` and `fp1b-immediate-copy-loop` are two 64-byte programs at `$0810` that are
**byte-identical apart from a seven-byte code prologue**:

| | prologue | the remaining 57 bytes |
|---|---|---|
| FP1 | `lda $0827,x : lda $083f,x : rts` | 24 ascending bytes from `$10`, then 24 bytes of `$08`, then 9 spaces |
| FP1b | `lda #$20 : lda #$38 : nop : nop : rts` | identical, byte for byte |

Nothing in either program dispatches through anything — no indirect jump, no `pha`/`pha`/`rts`
stack-return idiom, no zero-page vector construction. A two-table indexed read loop is the single
most ordinary shape in C64 code. Before the dispatch-context gate landed, the scan paired any two
indexed `ld*` instructions inside a short window, reconstructed eight in-image "targets" out of
those 57 bytes of ordinary data, fed them back as recursive-descent seeds, and reported **55** of
64 bytes reached against **7** bytes of real code — while the immediate twin reported 7. That 8×
inflation of the headline structural measure, manufactured out of data, is what the pair is a
control for.

The "differing **only** in addressing mode" relationship is **enforced by the generator, not
asserted about**: it throws unless the two payloads are equal in length, each exactly 64 bytes,
each prologue exactly `FP_CODE_SIZE`, and byte-identical from offset `FP_CODE_SIZE` onward. Both
data regions are written out in full in their own literal rather than shared, so that last
invariant is a real check an edit can break rather than one true by construction.

## The interior control's own program

`fp2-zeropage-data-pointer` is a third 64-byte program at `$0810`, unrelated to either group above,
with a **17-byte** code prologue:

```
$0810  ldx #$00
$0812  lda $0830,x     ; lo table, indexed through X
$0815  sta $fb         ; vector lo
$0817  lda $0838,x     ; hi table, indexed through the SAME register
$081A  sta $fc         ; vector hi  <- consecutive with $fb
$081C  ldy #$00
$081E  lda ($fb),y     ; reads DATA through the pointer. NOT a dispatch.
$0820  rts
$0821  ea x15          ; filler
$0830  40 41 ... 47    ; eight ascending lo bytes
$0838  08 x8           ; eight hi bytes
$0840  ea x16          ; sixteen legal single-byte instructions
```

**Why the outside-bracketing controls above could not catch CR-04.** The pre-fix gate accepted
*"two stores into consecutive zero-page addresses within reach"* as proof of dispatch. That is the
construction of **any** 16-bit pointer on a 6502 — it is what `jmp ($fb)` needs and equally what
`lda ($fb),y`, `sta ($fb),y` and `cmp ($fb),y` need — and the predicate never looked at what
*consumed* the vector it saw being built. `fp1`/`fp1b` carry no zero-page store at all and
`SPLIT_TABLE` carries a real `jmp ($00fb)`, so both sat outside the region the gate had to rule on.
This payload sits inside it: it satisfies every pre-fix condition — two indexed loads through one
register, two consecutive zero-page stores inside the pairing window, a resolvable lo/hi
orientation, and eight reconstructed targets that each decode — while dispatching nowhere.

Pre-fix it reported `splitTables=1`, eight `provenDispatchTargets` at `$0840`…`$0847`, 16 claimed
`tableEntryAddresses`, `classAt($0840)="reached-as-instruction"` and **reached=33** of 64 bytes
against 17 bytes of real code. The gate now requires the indirect-jump operand value to equal the
**lower** of two adjacent zero-page store targets, so all five converge: empty, empty, empty,
`unreached`, and 17.

"**This program dispatches nowhere**" is not a claim in a comment — the generator **throws** on any
byte equal to `$6c` (`jmp (indirect)`) or `$48` (`pha`) anywhere in the image, naming the offset.

## These do not ship

`scripts/check-npm-packages.mjs`'s `assertLeanTarball()` refuses any packed file under
`fixtures/`, in both tarballs. The filename `make-coverage-fixtures.mjs` deliberately carries no
test suffix: `ci-suite-coverage.test.ts` derives the set of directories holding committed test
files from the repository itself and requires a CI step for each, so a `*.test.mjs` here would
register `fixtures/coverage` as a suite directory no CI step runs.

Synthetic payloads only — no copyrighted image and no user data, per the milestone's own
proving-ground bar.
