# Coverage Reproducibility Question — COV-01, Plan 19-03

## What this seals, and why the axis is bytes-versus-store

19-RESEARCH.md §3.4 recommended reproducing Phase 11's two-SESSION answer key: a second agent
session re-deriving the answer with no access to the first session's work. Nested headless agent
sessions stall indefinitely in this project's environment, so that axis is not runnable here.

The axis used instead is **bytes-versus-store**. Two routes answer the same question, and neither
route may read the other's input:

- the **store route** may read only the fixture's `store.json` — its labels, its line comments
  (including their D-25 confidence-grade prefixes), its block listing and its cross-reference
  lists;
- the **bytes route** may read only the fixture's `project.regen2000proj` payload — the raw
  program bytes, decoded and walked by `anno-coverage.ts`'s census, with the store's own
  classification never consulted.

`ANSWER.sha256` is committed with the store-route answer. The bytes-route re-derivation lands in
`RE-DERIVED-ANSWER.md` and must hash to the same seal. A missing or empty re-derivation is a
FAILURE, never a skip — see `anno-coverage.test.ts`'s three named guard classes.

## Permitted inputs

Answering is permitted to use **only**:

- `src/mcp/vice/fixtures/coverage/nc5-well-documented/` — the well-documented control fixture
  (its `store.json` for the store route, its `project.regen2000proj` for the bytes route, never
  both for one route);
- this file.

**Explicitly forbidden**, and reading any of them invalidates the result:

- `ANSWER.md` and `ANSWER.sha256`;
- `RE-DERIVED-ANSWER.md`;
- `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` (the generator, which states each
  fixture's intent in prose);
- `19-03-PLAN.md`, `19-03-SUMMARY.md`, and any git commit message or diff from plan 19-03.

## The question

For the well-documented control fixture, answer all three parts.

1. **Sample.** Apply the instrument's own deterministic sample rule — documented labels sorted
   ascending by address, take every `ceil(population / sampleSize)`-th, with `sampleSize` at its
   default of 8. List the resulting addresses. A label counts as *documented* when it carries a
   line comment that is non-empty and is not equal, after the schema's normalisation, to a
   banned-generic entry; a label with strictly more than one caller additionally counts as
   documented only when its comment literally names one of its callers.

2. **Class.** For each sampled address, in the same order, give its coarse classification, drawn
   from exactly this three-word vocabulary: `code`, `data`, `unreached`.

   - The **store route** derives it from the address's recorded confidence grade, falling back to
     its block type when the grade is absent or `[unknown]`.
   - The **bytes route** derives it from the structural census alone: an address the recursive
     descent reached as an instruction is `code`; one classified as a table entry or as
     referenced-as-data is `data`; anything else is `unreached`.

3. **Callers.** For each sampled address, in the same order, give the number of **distinct**
   addresses that reference it, as a bare decimal integer.

   - The **store route** reads the cross-reference list recorded for that address.
   - The **bytes route** counts the distinct addresses of census-reached instructions whose
     resolved control-flow target is that address.

## Canonical answer format

Exactly one line. Lowercase throughout. Single ASCII space between fields, single comma with no
space inside a field. No trailing newline — the sealed hash in `ANSWER.sha256` is computed over
the raw bytes of this line with no trailing `\n`.

```
sample=<addr>[,<addr>...] classes=<class>[,<class>...] callers=<int>[,<int>...]
```

Field rules:

- `<addr>` — the address in lowercase hexadecimal, **exactly four digits, zero-padded**, with no
  `$` and no `0x` prefix. Ascending, in the order the sample rule produced them.
- `<class>` — one of the three vocabulary words above, lowercase.
- `<int>` — a bare decimal integer with no leading zeros (`0` when nothing references the
  address).
- The three lists must all have the same length, one entry per sampled address, in the same
  order.

**Worked example** (dummy values — this is not the real answer, and the addresses, classes and
counts below are invented):

```
sample=1234,5678 classes=unreached,data callers=7,9
```

Two answers built from the same underlying facts must produce byte-identical lines under this
grammar, which is what lets `ANSWER.sha256` check a submitted answer mechanically.

## Why the two routes are genuinely independent

- **Part 2 (class).** The store route reads a human judgement recorded as a D-25 confidence-grade
  prefix — a *confidence* axis the external analyser's own `BlockType` does not carry at all. The bytes
  route reads no comment and no block entry; it runs a recursive descent from a seed set and asks
  whether the address was reached. Neither derivation can see the other's input, and the store
  route's fallback to a block type is exactly the input the census is forbidden to read.
- **Part 3 (callers).** The store route reads a list analyser maintains. The bytes route
  re-counts control-flow targets from the decoded instruction stream. A disagreement here would
  mean the store's cross-reference bookkeeping and the program's own bytes have drifted apart —
  which is precisely the class of drift a coverage instrument exists to surface.
- **Part 1 (sample).** The sample rule is deliberately shared: both routes must classify the same
  addresses or the comparison would be meaningless. Sharing the *selection* is what makes the
  *classification* comparable; it is not a shared answer.
