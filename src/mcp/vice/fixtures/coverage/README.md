# Coverage control fixtures — COV-02

**Eight** committed synthetic fixtures, in two groups.

- **Five findings controls plus one non-vacuity control** (`nc1`…`nc5`). Five must FAIL and one
  must PASS. Without `nc5-well-documented` the whole coverage instrument would be vacuous: an
  instrument that fails everything measures nothing.
- **One false-positive control PAIR for the structural census** (`fp1`, `fp1b`). These are not
  findings controls at all. The property they hold down is that the census does **not inflate** —
  `structural.reachedAsInstruction` may never exceed the real code size — and their clean/non-clean
  verdict is incidental, which is why both declare `expect_measure: null`.

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

## Shape of each fixture

| File | What it is |
|---|---|
| `project.regen2000proj` | the project file, written by `synthesizeProject()`. Identical across the **five** `nc*` fixtures — for those, only the store differs. The false-positive pair each carries its own program, which is the whole point of the pair. |
| `store.json` | the already-fetched store data in exactly the shape the curated read tools return: `symbols`, `comments`, `blocks`, `cross_references`. Also carries `control`, `purpose`, `expect_clean` and `expect_measure`, so `r2000-coverage.test.ts` is data-driven off the fixture rather than repeating each expectation in test code. The false-positive pair additionally carries `code_size`, so the non-inflation assertion reads the bound **from the fixture** instead of from a number typed into a test. |

## The program shared by the five `nc*` fixtures

The **five** `nc*` fixtures carry the same 64-byte program at `$0810`; the false-positive pair does
not, and no fixture outside that group is claimed to. It has real subroutines, one label reached
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

## These do not ship

`scripts/check-npm-packages.mjs`'s `assertLeanTarball()` refuses any packed file under
`fixtures/`, in both tarballs. The filename `make-coverage-fixtures.mjs` deliberately carries no
test suffix: `ci-suite-coverage.test.ts` derives the set of directories holding committed test
files from the repository itself and requires a CI step for each, so a `*.test.mjs` here would
register `fixtures/coverage` as a suite directory no CI step runs.

Synthetic payloads only — no copyrighted image and no user data, per the milestone's own
proving-ground bar.
