# Coverage control fixtures — COV-02

**Twelve** committed synthetic fixtures, in four groups.

- **Five findings controls plus one non-vacuity control** (`nc1`…`nc5`). Five must FAIL and one
  must PASS. Without `nc5-well-documented` the whole coverage instrument would be vacuous: an
  instrument that fails everything measures nothing.
- **One false-positive control PAIR for the structural census** (`fp1`, `fp1b`). These are not
  findings controls at all. The property they hold down is that the census does **not inflate** —
  `structural.reachedAsInstruction` may never exceed the real code size — and their clean/non-clean
  verdict is incidental, which is why both declare `expect_measure: null`.
- **The dispatch gate's INTERIOR control PAIR** (`fp2`, `fp2b`). `fp1`/`fp1b` carry no zero-page
  store at all and the positive control `SPLIT_TABLE` carries a real `jmp ($00fb)`, so those two
  bracket the gate from the **outside**. `fp2-zeropage-data-pointer` is *inside* it: a zero-page
  vector that is genuinely built and then consumed by an indirect-indexed **data** read. A negative
  control built from the outside of the predicate it constrains is not a control at all — which is
  why a 2517-passing suite concealed `19-REVIEW.md` CR-04. `fp2b-immediate-data-pointer` is its
  immediate twin, committed so FP2's census is compared against a **measured** baseline rather than
  a remembered number.
- **The class-3 push-idiom route's INTERIOR control PAIR** (`fp3`, `fp3b`). The dispatch predicate
  accepts two sufficient shapes, and one of them — `stack-return-push-idiom` — is ruled on by **two**
  gates: the class-4 five-instruction pass and the class-3 pairing pass. `STACK_RETURN` and its two
  twins all reach that shape through the class-4 window, so the class-3 route into it had no control
  at all. `fp3-unlinked-push-idiom` takes exactly that route: class 4 declines its window outright,
  and the class-3 pass then had to rule on a pairing whose only dispatch evidence was two `pha` bytes
  and an `rts` somewhere in reach — pushes carrying the accumulator's leftover value and the X
  register, **neither of them a byte either paired load supplied**. A control that brackets a branch
  from the outside cannot hold that branch down, which is why three green push-idiom controls
  coexisted with a live inflation route. `fp3b-immediate-push-idiom` is its immediate twin, supplying
  the **measured** census baseline.

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
| `fp2b-immediate-data-pointer` | FP2b | **nothing** — FP2 with its two vector-byte loads made immediate; the only difference between the two programs. The same vector is still built at `$fb`/`$fc` and still consumed by the same `lda ($fb),y` | the baseline half of the interior pair: `structural.reachedAsInstruction` must equal FP2's, must equal the declared `code_size` (17), and must be **strictly greater than zero** — otherwise the equality is satisfiable by an instrument that censused nothing. Pre-fix the pair was asymmetric, **33** against **17** |
| `fp3-unlinked-push-idiom` | FP3 | **nothing** — an ordinary 16-bit pointer setup followed by an ordinary `pha`/`pha`/`rts` register save: `lda $0830,x : sta $fb : lda $0838,x : sta $fc : pha : txa : pha : tya : rts`, fifteen code bytes with **no `$6c` byte anywhere in the image**. **This is the control that reaches the CLASS-3 route into the push-idiom shape**, which no prior control did | `dispatch.splitTables`, `provenDispatchTargets()` and `dispatch.tableEntryAddresses` must all be **empty**, `classAt($0840)` must be `unreached`, `structural.reachedAsInstruction` must equal the declared `code_size` (15), and `dispatch.splitTableCandidates` must be exactly **1** — so the gate is seen to have examined and *declined* the pairing rather than never noticed it. Pre-fix: `splitTables=1`, eight proven targets at `$0840`…`$0847`, 16 claimed table-entry bytes, `classAt($0840)="reached-as-instruction"`, **reached=31** |
| `fp3b-immediate-push-idiom` | FP3b | **nothing** — FP3 with its two vector-byte loads made immediate; the only difference between the two programs. The same vector is still built at `$fb`/`$fc` and the same `pha`/`txa`/`pha`/`tya`/`rts` tail is retained, so the push idiom is present in both and only the indexed pairing is gone | the baseline half of the pair: `structural.reachedAsInstruction` must equal FP3's, must equal the declared `code_size` (15), and `dispatch.splitTableCandidates` must be **0** because there is no indexed pair to rule on. Pre-fix the pair was asymmetric, **31** against **15** |

## Shape of each fixture

| File | What it is |
|---|---|
| `project.regen2000proj` | the project file, written by `synthesizeProject()`. Identical across the **five** `nc*` fixtures — for those, only the store differs. The false-positive pair, the interior pair and the push-idiom pair each carry their own program, which is the whole point of them. |
| `store.json` | the already-fetched store data in exactly the shape the curated read tools return: `symbols`, `comments`, `blocks`, `cross_references`. Also carries `control`, `purpose`, `expect_clean` and `expect_measure`, so `r2000-coverage.test.ts` is data-driven off the fixture rather than repeating each expectation in test code. The false-positive pair, the interior pair and the push-idiom pair additionally carry `code_size`, so the non-inflation assertion reads the bound **from the fixture** instead of from a number typed into a test. |

## The program shared by the five `nc*` fixtures

The **five** `nc*` fixtures carry the same 64-byte program at `$0810`; the false-positive pair, the
interior pair and the push-idiom pair do not, and no fixture outside the `nc*` group is claimed to. It has real
subroutines, one label reached from **two** call sites (which is what the cross-reference rule
engages on), one absolute data reference, one indexed data reference, and deliberate unreachable
filler. The filler is what makes
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

## The interior pair's own two programs

`fp2-zeropage-data-pointer` and `fp2b-immediate-data-pointer` are two 64-byte programs at `$0810`,
unrelated to either group above, **byte-identical apart from a 17-byte code prologue**:

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

FP2b replaces the two indexed table reads with immediate constants, padded with `nop` so the
prologue length is unchanged:

```
$0810  ldx #$00 : lda #$30 : nop : sta $fb : lda #$38 : nop : sta $fc
$081C  ldy #$00 : lda ($fb),y : rts
$0821..$084F  identical to FP2, byte for byte
```

The same zero-page vector is still constructed and still consumed by the same indirect-indexed data
read; only the **source** of the two vector bytes changes. It is committed rather than inferred so
FP2's census is compared against a **live measurement** — a lone FP2 asserting `reached <= 17`
would be satisfied by an instrument that had quietly stopped censusing anything.

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
`unreached`, and 17 — the same 17 the twin reports.

Two invariants are **enforced by the generator, not asserted about**:

- "**This program dispatches nowhere**" is not a claim in a comment — the generator **throws** on
  any byte equal to `$6c` (`jmp (indirect)`) or `$48` (`pha`) anywhere in **either** image, naming
  the offset.
- The pair must be equal in length, each exactly 64 bytes, each prologue exactly `FP2_CODE_SIZE`,
  and byte-identical from offset `FP2_CODE_SIZE` onward. Both data regions are written out in full
  in their own literal rather than shared, and each payload is **concatenated** from prologue plus
  data rather than laid into a pre-sized array — so the identical-tail invariant is a real check an
  edit can break, and a prologue edit changes the payload *length* rather than being silently
  absorbed.

## The push-idiom pair's own two programs

`fp3-unlinked-push-idiom` and `fp3b-immediate-push-idiom` are two 64-byte programs at `$0810`,
unrelated to any group above, **byte-identical apart from a 15-byte code prologue**:

```
$0810  lda $0830,x     ; lo table, indexed through X
$0813  sta $fb         ; vector lo
$0815  lda $0838,x     ; hi table, indexed through the SAME register
$0818  sta $fc         ; vector hi  <- consecutive with $fb
$081A  pha             ; pushes A -- the HI table byte, already consumed by the store
$081B  txa
$081C  pha             ; pushes X -- an index, not a table byte
$081D  tya
$081E  rts             ; the RTS trick, over bytes NEITHER paired load supplied
$081F  ea x17          ; filler
$0830  40 41 ... 47    ; eight ascending lo bytes
$0838  08 x8           ; eight hi bytes
$0840  ea x16          ; sixteen legal single-byte instructions
```

FP3b replaces the two indexed table reads with immediate constants, padded with `nop` so the
prologue length is unchanged, and keeps the identical push tail:

```
$0810  lda #$30 : nop : sta $fb : lda #$38 : nop : sta $fc
$081A  pha : txa : pha : tya : rts
$081F..$084F  identical to FP3, byte for byte
```

**Why the three existing push-idiom controls could not catch this.** `stack-return-push-idiom` is
ruled on by **two** gates. The class-4 pass matches an exact five-instruction window
(`indexed load : pha : indexed load : pha : rts`); the class-3 pass consults
`hasDispatchContext()` for any same-register indexed pairing. `STACK_RETURN`,
`STACK_RETURN_MIXED_REGISTERS` and `STACK_RETURN_IMPLAUSIBLE_TARGET` all satisfy the class-4
window, so all three sat outside the class-3 route entirely. This payload takes that route: class
4 declines it outright because its second instruction is a `sta` rather than a `pha`, after which
the class-3 branch accepted the mere **presence** of two `$48` bytes and a `$60` byte inside the
window — never once consulting the pairing it was being asked to rule on.

Pre-fix it reported `splitTables=1`, eight `provenDispatchTargets` at `$0840`…`$0847`, 16 claimed
`tableEntryAddresses`, `classAt($0840)="reached-as-instruction"` and **reached=31** of 64 bytes
against 15 bytes of real code — 47 of 64 bytes claimed as code-or-table out of a 15-byte program.
The branch now requires each paired load's own **next** instruction to be the `pha` carrying the
byte it just read, with the `rts` following both, so all five converge: empty, empty, empty,
`unreached`, and 15 — the same 15 the twin reports. The pairing is still reported as exactly **one**
advisory candidate, which is the record that the gate examined it and declined rather than never
seeing it.

Three invariants are **enforced by the generator, not asserted about**:

- `assertNoIndirectJumpOpcode()` **throws** on any `$6c` (`jmp (indirect)`) byte anywhere in either
  image, naming the offset. That is what makes "nothing here dispatches through these tables" true
  of the whole image rather than of the prefix a decode happened to walk.
- `assertCarriesPushIdiom()` **throws** unless the 15-byte prologue carries at least two `$48`
  (`pha`) bytes and at least one `$60` (`rts`) byte. This pair may **not** use
  `assertDispatchesNowhere()`, which throws on `$48` — the push idiom is the fixture's whole reason
  for existing. Without this second throw a future edit could delete the idiom and leave a payload
  that never enters the region the class-3 branch rules on, bracketing it from the **outside** while
  still wearing an interior control's label.
- The pair must be equal in length, each exactly 64 bytes, each prologue exactly `FP3_CODE_SIZE`,
  and byte-identical from offset `FP3_CODE_SIZE` onward. Both data regions are written out in full
  in their own literal rather than shared, and each payload is **concatenated** from prologue plus
  data rather than laid into a pre-sized array.

## These do not ship

`scripts/check-npm-packages.mjs`'s `assertLeanTarball()` refuses any packed file under
`fixtures/`, in both tarballs. The filename `make-coverage-fixtures.mjs` deliberately carries no
test suffix: `ci-suite-coverage.test.ts` derives the set of directories holding committed test
files from the repository itself and requires a CI step for each, so a `*.test.mjs` here would
register `fixtures/coverage` as a suite directory no CI step runs.

Synthetic payloads only — no copyrighted image and no user data, per the milestone's own
proving-ground bar.
