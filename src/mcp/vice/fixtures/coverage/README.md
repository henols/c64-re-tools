# Coverage control fixtures — COV-02

Six committed synthetic fixtures. **Five must FAIL and one must PASS.** Without the sixth the
whole coverage instrument would be vacuous: an instrument that fails everything measures nothing.

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

## Shape of each fixture

| File | What it is |
|---|---|
| `project.regen2000proj` | the project file, written by `synthesizeProject()`. Identical across all six — only the store differs. |
| `store.json` | the already-fetched store data in exactly the shape the curated read tools return: `symbols`, `comments`, `blocks`, `cross_references`. Also carries `control`, `purpose`, `expect_clean` and `expect_measure`, so `r2000-coverage.test.ts` is data-driven off the fixture rather than repeating each expectation in test code. |

## The one shared program

All six carry the same 64-byte program at `$0810`. It has real subroutines, one label reached
from **two** call sites (which is what the cross-reference rule engages on), one absolute data
reference, one indexed data reference, and deliberate unreachable filler. The filler is what makes
the divergence sub-report's "store says `Code`, the census never reached it" direction non-zero
even on the well-documented control — proving that direction is *reported*, not treated as a
defect.

Byte-level layout is in the generator's own header comment, disassembled line by line.

## These do not ship

`scripts/check-npm-packages.mjs`'s `assertLeanTarball()` refuses any packed file under
`fixtures/`, in both tarballs. The filename `make-coverage-fixtures.mjs` deliberately carries no
test suffix: `ci-suite-coverage.test.ts` derives the set of directories holding committed test
files from the repository itself and requires a CI step for each, so a `*.test.mjs` here would
register `fixtures/coverage` as a suite directory no CI step runs.

Synthetic payloads only — no copyrighted image and no user data, per the milestone's own
proving-ground bar.
