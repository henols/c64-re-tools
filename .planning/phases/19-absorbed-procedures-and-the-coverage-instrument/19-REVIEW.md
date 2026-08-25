---
phase: 19-absorbed-procedures-and-the-coverage-instrument
reviewed: 2026-08-25T05:37:36Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - CLAUDE.md
  - .github/workflows/ci.yml
  - installer/package.json
  - installer/THIRD-PARTY-NOTICES.md
  - scripts/check-npm-packages.mjs
  - scripts/check-skill-description-overlap.mjs
  - scripts/lib/r2000-cli-verbs.mjs
  - scripts/lib/skill-corpus.d.mts
  - scripts/lib/skill-descriptions.d.mts
  - scripts/lib/skill-descriptions.mjs
  - src/mcp/vice/ci-guardrails.test.mjs
  - src/mcp/vice/fixtures/coverage/fp1b-immediate-copy-loop/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/fp1b-immediate-copy-loop/store.json
  - src/mcp/vice/fixtures/coverage/fp1-indexed-copy-loop/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/fp1-indexed-copy-loop/store.json
  - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
  - src/mcp/vice/fixtures/coverage/nc1-all-auto/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc1-all-auto/store.json
  - src/mcp/vice/fixtures/coverage/nc1b-auto-renamed-in-place/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc1b-auto-renamed-in-place/store.json
  - src/mcp/vice/fixtures/coverage/nc2-generic-comments/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc2-generic-comments/store.json
  - src/mcp/vice/fixtures/coverage/nc3-all-data-blocks/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc3-all-data-blocks/store.json
  - src/mcp/vice/fixtures/coverage/nc4-multi-caller-unnamed/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc4-multi-caller-unnamed/store.json
  - src/mcp/vice/fixtures/coverage/nc5-well-documented/project.regen2000proj
  - src/mcp/vice/fixtures/coverage/nc5-well-documented/store.json
  - src/mcp/vice/fixtures/coverage/README.md
  - src/mcp/vice/package.json
  - src/mcp/vice/r2000-cli.test.ts
  - src/mcp/vice/r2000-cli.ts
  - src/mcp/vice/r2000-coverage.test.ts
  - src/mcp/vice/r2000-coverage.ts
  - src/mcp/vice/r2000-tools.ts
  - src/mcp/vice/r2000-upstream-audit.test.ts
  - src/mcp/vice/r2000-verb-coverage.test.ts
  - src/mcp/vice/skill-attribution.test.ts
  - src/mcp/vice/skill-description-overlap.test.ts
  - src/mcp/vice/THIRD-PARTY-NOTICES.md
  - src/skills/acme-build/SKILL.md
  - src/skills/c64-memory-mapping/SKILL.md
  - src/skills/c64-program-recon/scripts/packer-finding.mjs
  - src/skills/c64-program-recon/scripts/packer-finding.test.mjs
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/routine-queue-walker/SKILL.md
  - THIRD-PARTY-NOTICES.md
findings:
  critical: 4
  warning: 15
  info: 5
  total: 24
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-25T05:37:36Z (second pass, after gap-closure plans 19-06 … 19-09)
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Summary

This is the **second** review of phase 19. The first pass (2026-08-24) recorded
19 findings; four gap-closure plans have since landed and changed exactly
thirteen source files:

```
THIRD-PARTY-NOTICES.md                          installer/THIRD-PARTY-NOTICES.md
scripts/check-npm-packages.mjs                  src/mcp/vice/THIRD-PARTY-NOTICES.md
src/mcp/vice/r2000-coverage.ts                  src/mcp/vice/r2000-coverage.test.ts
src/mcp/vice/skill-attribution.test.ts          src/mcp/vice/fixtures/coverage/README.md
src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
src/mcp/vice/fixtures/coverage/fp1{,b}-*/project.regen2000proj + store.json
```

**Every finding id from the first pass is preserved below.** Five are now
**RESOLVED IN PLACE** (`CR-01`, `CR-02`, `CR-03`, `WR-01`, `WR-02`, plus `IN-04`
folded in) — their text is retained, annotated with the plan that discharged
them, and never deleted, because `docs-review-disposition.test.ts` keys on the
ids present in this file. The rest stand, verified against the current source
rather than against the earlier review's prose. Four **new** findings continue
the sequence: `CR-04`, `WR-13`, `WR-14`, `WR-15`, `IN-05`.

**What the gap-closure work genuinely fixed.** The MIT inclusion condition is
now discharged by artifact, not by assertion: the 1072-byte upstream
`LICENSE-MIT` is reproduced byte-for-byte in all three notices documents, pinned
by sha256 in `skill-attribution.test.ts:317`, with a planted-violation control
and a scoped forbidden-claim check that catches the deleted false sentence even
when re-wrapped. The multi-caller hex rule is properly anchored. The reported
counts are now derived from the deduped lists printed beside them. `Math.min`
role assignment is gone and Class 4 claims its window before Class 3 runs. The
census is bounded at `$10000`. `provenDispatchTargets()` is a real, single,
documented seam and the FP1/FP1b pair is a well-built control.

**What the gap-closure work did not fix, and this is the load-bearing part of
this review.** `CR-02`'s failure mode — *the instrument manufacturing
`reachedAsInstruction` out of ordinary data* — was narrowed, not closed. The new
dispatch-context gate accepts **the construction of a 16-bit zero-page pointer**
as proof that something dispatches through it. Building a pointer in zero page
and reading data through it (`lda ($fb),y`) is one of the most common shapes in
6502 code and is not a dispatch. Reproduced against the shipped code at
`HEAD`:

```
lda $0830,x : sta $fb : lda $0838,x : sta $fc : ldy #$00 : lda ($fb),y : rts
                                                            ^ a DATA read, no jump anywhere

splitTables (PROVEN) = 1     provenDispatchTargets = [$0840..$0847]
census WITH the scan : reached=33  tableEntry=16  unreached=15
census PLAIN         : reached=17  tableEntry=0   unreached=45
```

Sixteen bytes of pure data are promoted to the headline measure and sixteen more
are claimed as table entries — from a program that jumps nowhere. That is
`CR-04`, and the committed test suite cannot see it: the class-3 positive
control (`SPLIT_TABLE`, `r2000-coverage.test.ts:166-175`) carries a real
`jmp ($00fb)` and the negative control (`ORDINARY_INDEXED_COPY`) carries no
zero-page store at all, so the two controls bracket the *outside* of the gate
and never test its interior.

Separately, the class-4 half of the same "proven" seam is **completely
ungated** (`WR-14`): no same-index-register check, no target-plausibility check,
an entry count guessed from the distance between the two bases. Its own
committed positive fixture reconstructs `$c006` — an address in the middle of
the idiom's second instruction — and feeds it into `provenDispatchTargets()` as
proof of code.

The suite is green (2564 tests, 0 fail). Green means the controls that exist
pass; `CR-04` and `WR-14` are the shapes no control covers, which is exactly the
condition `r2000-coverage.test.ts:770-780`'s own comment names as the reason a
fully green suite concealed `CR-02` the first time.

## Critical Issues

### CR-01: `namesACaller()` matches caller addresses as unanchored substrings, defeating the multi-caller rule

> **RESOLVED — plan 19-06** (commit `0bca490`). `namesACaller()` at
> `src/mcp/vice/r2000-coverage.ts:1329-1348` now matches a delimited token:
> `` `\\$${escapeRegExp(token)}(?![0-9a-f])` `` over both the bare and
> canonical-4-digit widths, and the label-name branch is bounded on both sides
> by `(?<![0-9A-Za-z_])` / `(?![0-9A-Za-z_])`. `escapeRegExp()` was added so a
> store-sourced label name reaches the `RegExp` constructor as a literal.
> Two committed anchoring controls were observed red pre-fix. Re-verified at
> `HEAD`: `callers: [0x0012, 0x0034]` with a comment mentioning `$1234` is now
> reported `{count: 1, addresses: [...]}`. **A residual remains — see WR-13.**

**File:** `src/mcp/vice/r2000-coverage.ts:992-1006` *(pre-fix line numbers)*

**Issue:** The COV-02 multi-caller rule ("a label with strictly more than one
caller must name a caller") is satisfied by a plain `String.includes` of
`` `$${hex}` `` with no boundary check. Any longer hexadecimal address in the
comment whose leading digits coincide with a caller's short-form hex rescues the
label. Reproduced against the shipped code:

```
callers: [0x0012, 0x0034]
comment: "[confirmed-code] reads the table at $1234 and returns"
=> multiCallerUndocumented = { count: 0, addresses: [] }
```

The comment names neither caller. The label is silently counted as documented,
stays in `labels.kindRatio.user`, stays in the reproducibility sample population,
and produces no finding. This is a **falsely-clean verdict** — the failure mode
`r2000-coverage.test.ts`'s own header calls out as T-19-14, and the one the NC4
control fixture exists to catch. NC4 only passes because its comment happens not
to contain a colliding hex string.

The label-name branch has the same shape: `rawComment.includes(name)` matches a
caller's label name anywhere in the text, including as a substring of a longer
identifier.

**Fix:** *(applied by 19-06)* Match on a delimited token, and compare against a
canonical width; word-boundary the label name too.

### CR-02: the split lo/hi table scan manufactures census coverage from ordinary data

> **RESOLVED (NARROWED) — plan 19-08** (commit `1706d8b`). The class-3 scan is
> now gated (`r2000-coverage.ts:836-924`), ungated pairings move to the advisory
> `splitTableCandidates` sibling, `COVERAGE_SCHEMA_VERSION` was bumped to 2, and
> `provenDispatchTargets()` (`:954-969`) is the single seam every `extraSeeds:`
> assignment reads. `classFromBytes()` (`:1276`) takes the proven array as a
> parameter instead of testing `discoveredTargets`. The exact reproduction
> below no longer fires: the FP1/FP1b committed pair now reports identical
> `reachedAsInstruction` (7 and 7).
>
> **The defect class is narrowed, not closed.** The gate accepts a zero-page
> *pointer construction* as proof of dispatch, so the same manufacturing still
> happens on the most ordinary indirect-data-read idiom in 6502 code. Tracked
> as the new **CR-04** rather than by reopening this id.

**File:** `src/mcp/vice/r2000-coverage.ts:580-621` (feeding `buildCoverageReport` at `:1308-1312`) *(pre-fix line numbers)*

**Issue:** The class-3 scan pairs **any** two indexed `ld*` instructions occurring
within `SPLIT_TABLE_WINDOW` (8) decoded instructions, assumes their operands are
the bases of an adjacent lo/hi pointer table, assumes the table length is
`hiBase - loBase`, reconstructs that many 16-bit "targets" out of whatever bytes
are there, and returns them in `discoveredTargets`. `buildCoverageReport()` then
passes `discoveredTargets` straight in as `extraSeeds` to the descent walk, and
`tableEntryAddresses` as table entries.

There is no test that the two loads are related, no test that either base holds
pointer data, and no test that the reconstructed values are plausible entry
points. A two-table indexed read loop — `lda screen,x` / `lda colour,x`, one of
the most common shapes in C64 code — matches. Reproduced against the shipped
code with a 64-byte program whose only real code is 7 bytes:

```
plain census    reached=7   tableEntry=0  referencedAsData=2  unreached=55
with the scan   reached=63  tableEntry=0  referencedAsData=0  unreached=1
```

56 bytes of ordinary data were promoted to `reached-as-instruction`, the headline
measure. This directly contradicts the module's own trap 2 ("`reachedAsInstruction`
means REACHED BY RECURSIVE DESCENT FROM A SEED") and its own stated rule at
`DATA_REF_MNEMONICS` ("guessing a length here would manufacture coverage that was
never proven"). The `linearSweepDecodable` / `reachedAsInstruction` separation the
module is built around is worthless if arbitrary data can be injected into the
seed set.

**Fix:** *(applied by 19-08)* Split-table targets must not be treated as proven;
seed the descent only from evidence-backed targets through one seam.

### CR-03: the elected MIT licence's permission notice ships nowhere, and the notices file states that it does

> **RESOLVED — plan 19-07** (commits `48e02f4`, `f941eef`). The upstream
> `LICENSE-MIT` (1072 bytes, sha256
> `e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b`) is now
> reproduced verbatim under an identical `## Upstream MIT permission notice
> (regenerator2000)` heading in all three of `THIRD-PARTY-NOTICES.md`,
> `installer/THIRD-PARTY-NOTICES.md` and `src/mcp/vice/THIRD-PARTY-NOTICES.md`.
> The false sentence is deleted and pinned as forbidden
> (`skill-attribution.test.ts:363-368`). The presence check is a **sha256 over
> the extracted fence content**, not a substring match, with two in-memory
> planted-violation controls. `scripts/check-npm-packages.mjs:105-119` adds the
> packaging-side half. Verified at `HEAD`: all three files carry the notice and
> the guard's `claiming` list deep-equals `NOTICES_FILES`.

**File:** `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117`, `installer/THIRD-PARTY-NOTICES.md`, every `ATTRIBUTION (ABS-02)` block (e.g. `src/skills/routine-queue-walker/SKILL.md:6-40`) *(pre-fix line numbers)*

**Issue:** The project elects **MIT** for the incorporated `regenerator2000`
prose. The MIT licence requires that *"The above copyright notice and this
permission notice shall be included in all copies or substantial portions of the
Software."* A repo-wide search finds the string `Permission is hereby granted`
in exactly one place — a 2018-vintage planning document — and **nowhere** in
`src/skills/`, `installer/THIRD-PARTY-NOTICES.md`,
`src/mcp/vice/THIRD-PARTY-NOTICES.md`, or either published tarball. Only the
copyright line (`Copyright (c) 2026 Ricardo Quesada`) travels.

Compounding it, `src/mcp/vice/THIRD-PARTY-NOTICES.md:115-117` asserts:

> "The MIT permission notice and copyright above travel inside every absorbed
> file's header, which is what ships in both published tarballs."

That statement is false as written — verified against every attribution block.
Electing Apache-2.0 instead would not help: §4(a) requires shipping a copy of the
Apache licence. So neither dual option is currently discharged, and both npm
packages publish adapted third-party text without its permission notice.

**Fix:** *(applied by 19-07)* Add the verbatim upstream MIT permission notice to
all notices documents, correct the false claim, and pin the reproduction by
digest so it cannot silently regress.

### CR-04: the dispatch-context gate accepts an ordinary zero-page *data*-pointer construction as proof of dispatch, so the census still manufactures `reachedAsInstruction` out of data

**File:** `src/mcp/vice/r2000-coverage.ts:644-662` (`hasDispatchContext`), gating at `:871` and `:907-911`

**Issue:** `CR-02`'s fix requires a class-3 pairing to carry "a dispatch consumer
in evidence". `hasDispatchContext()` implements that as **any one of three
shapes**, and the third is:

```ts
for (let a = 0; a < zpStores.length; a++) {
  for (let b = a + 1; b < zpStores.length; b++) {
    if (Math.abs(zpStores[a]! - zpStores[b]!) === 1) return true;   // :658-661
  }
}
```

Two stores into consecutive zero-page addresses. That is the construction of
**any** 16-bit pointer, not of a dispatch. It is what `jmp ($fb)` needs — and
equally what `lda ($fb),y`, `sta ($fb),y`, `cmp ($fb),y` and `adc ($fb),y` need.
Indirect-indexed **data** access is far more common in 6502 code than
indirect jump, and this predicate cannot tell the two apart because it never
looks at what consumes the vector it saw being built.

Worse, condition (c) contributes almost nothing on top of condition (d):
`resolveSplitOrientation()` (`:679-712`) *already requires* two consecutive
zero-page store consumers before it will resolve an orientation at all, and an
unresolved orientation makes the pairing advisory regardless. So whenever both
stores fall inside the eight-instruction window — the ordinary case for a tight
pointer setup — (c) is satisfied by the very same two instructions that
satisfied (d). The gate therefore reduces in practice to *"two indexed loads
through the same register whose values are stored into consecutive zero-page
addresses, and whose reconstructed values happen to decode"*, which is the
definition of building a pointer table, not of dispatching through one.

**Reproduced against the shipped code at `HEAD`** (64-byte payload at `$0810`,
7 real code bytes plus a `lda ($fb),y` data read; no `jmp ($nnnn)` opcode, no
`pha`/`pha`/`rts`, anywhere in the image):

```
$0810 ldx #$00
$0812 lda $0830,x     ; lo table
$0815 sta $fb
$0817 lda $0838,x     ; hi table
$081a sta $fc
$081c ldy #$00
$081e lda ($fb),y     ; reads DATA through the pointer -- this is not a dispatch
$0820 rts

splitTables (PROVEN)  = 1  { loBase: $0830, hiBase: $0838, targets: $0840..$0847 }
splitTableCandidates  = 0
provenDispatchTargets = [$0840, $0841, ... $0847]

census WITH the scan : reached=33  tableEntry=16  referencedAsData=0  unreached=15
census PLAIN         : reached=17  tableEntry=0   referencedAsData=2   unreached=45
```

The sixteen data bytes at `$0840..$084f` are classified `reached-as-instruction`
— the headline measure — and the sixteen pointer bytes are claimed as
`table-entry`. `provenDispatchTargets()`'s own doc comment says "ADDING A SOURCE
HERE IS THE DECISION TO TREAT THAT SOURCE AS PROOF OF CODE"; this is that
decision made by accident, one level down, inside `hasDispatchContext`.

The committed controls cannot catch it. `SPLIT_TABLE`
(`r2000-coverage.test.ts:166-175`) is the positive control and carries a real
`jmp ($00fb)`; `ORDINARY_INDEXED_COPY` / FP1 is the negative control and carries
**no zero-page store at all**. The two bracket the outside of the gate. Nothing
tests the interior — a vector that is built and then consumed by something other
than a jump.

**Fix:** Require the *consumer*, not the construction. Match the vector to the
instruction that dispatches through it:

```ts
function hasDispatchContext(insns: readonly Instruction[], start: number, reach: number): boolean {
  const end = Math.min(insns.length, start + reach + 1);

  let sawPha = 0;
  const zpStores: number[] = [];
  const indirectJumpPointers: number[] = [];
  for (let k = start; k < end; k++) {
    const insn = insns[k]!;
    if (insn.opcode === 0x6c && insn.operand) indirectJumpPointers.push(insn.operand.value);
    if (insn.opcode === 0x48) sawPha++;
    if (insn.opcode === 0x60 && sawPha >= 2) return true;
    const zp = zeroPageStoreTarget(insn);
    if (zp !== null) zpStores.push(zp);
  }

  // A zero-page vector counts ONLY when something jumps through the vector it
  // built. `lda ($fb),y` builds the identical pointer and dispatches nowhere,
  // so the construction alone proves nothing (CR-04).
  for (const a of zpStores) {
    for (const b of zpStores) {
      if (b - a !== 1) continue;
      if (indirectJumpPointers.includes(a)) return true;
    }
  }
  return false;
}
```

Then add the missing interior control to `r2000-coverage.test.ts`: the payload
above, asserting `splitTables === []`, `provenDispatchTargets(scan) === []`, and
`classAt(census, 0x0840) === "unreached"`. Consider committing it as a third
false-positive fixture (`fp2-zeropage-data-pointer`) alongside FP1/FP1b, since
the report-level statement is where the gap is actually phrased.

## Warnings

### WR-01: split-table lo/hi roles are assigned by address order, producing byte-swapped targets, and the same idiom is reported twice

> **RESOLVED — plan 19-08** (commit `1706d8b`). `Math.min`/`Math.max` role
> assignment is deleted. Class 4 now runs first (`r2000-coverage.ts:780-838`),
> records every instruction of a matched window in `classFourWindow`, and Class
> 3 declines any pairing whose leading load sits in one (`:841`). Orientation
> comes from `resolveSplitOrientation()` (`:679-712`) — the load whose value
> reaches the lower of two consecutive zero-page addresses holds the low byte —
> or the pairing is advisory with `orientationResolved: false` and an **empty**
> `targets` list, so a byte-swapped value is never printed as an address.
> Regression-tested by *"the class-4 stack-return idiom is not also reported as
> a class-3 split table"*, which includes an explicit byte-swap cross-check.

**File:** `src/mcp/vice/r2000-coverage.ts:591-592`, `:605-618`, `:626-664` *(pre-fix line numbers)*

**Issue:** `loBase = Math.min(a, b); hiBase = Math.max(a, b)` assumes the low-byte
table always sits at the lower address. Nothing justifies that. The file's own
class-4 fixture demonstrates the counter-case: in the stack-return idiom the HI
table is at the lower address, and the class-3 scan matches the *same two
instructions*, producing a second finding with the two tables swapped:

```
splitTables: [{ at: $c000, loBase: $c010, hiBase: $c013, targets: [$05c0, $05c0, $05c0] }]
stackReturn: [{ at: $c000, loBase: $c013, hiBase: $c010, targets: [$c006, $c006, $c006] }]
```

`$05c0` is `$c005` byte-swapped — pure garbage. On a real 64K image such values
land in range and become `discoveredTargets`. The class-3 and class-4 scans also
double-count the idiom in every printed count and in `tableEntryAddresses`.

**Fix:** *(applied by 19-08)* Run class 4 first and let it claim its window;
infer lo/hi from the store construction or report the pairing as unresolved.

### WR-02: `autoPrefixNamesRemaining` and `multiCallerUndocumented.count` are pre-dedup lengths reported beside deduped address lists

> **RESOLVED — plan 19-06** (commit `cbdbf97`). `computeLabelRatio()` now
> dedupes once into a local (`r2000-coverage.ts:1042`) and both
> `autoPrefixNamesRemaining` and `autoPrefixNameAddresses` read from it;
> `computeReproducibility()` does the same at `:1387` for
> `multiCallerUndocumented`. Regression-tested by *"two symbols at one address
> produce a count of one, not two"* and *"every reported count is a count of the
> deduped list printed beside it"*.

**File:** `src/mcp/vice/r2000-coverage.ts:746-747`, `:1061`, `:1090` *(pre-fix line numbers)*

**Issue:** `autoPrefixNamesRemaining: autoPrefixNameAddresses.length` is computed
before `sortedUniqueNumbers()` is applied to the list that is reported. Two
symbols at one address produce `autoPrefixNamesRemaining: 2` with a single
address. Reproduced:

```
autoPrefixNamesRemaining = 2   autoPrefixNameAddresses = ['1000']
```

`coverageFindings()` (`:1394-1399`) and `printCoverageReport()` print both in one
sentence, so the message contradicts itself: *"2 label name(s) still carry an
auto-name prefix at $1000"*. `multiCallerUndocumented.count` has the same shape.

**Fix:** *(applied by 19-06)* Derive every reported count from the deduped list
printed beside it.

### WR-03: the descent walk counts illegal/JAM opcodes as instructions; the linear sweep does not

> **STILL OPEN.** Deferred by 19-08 ("DEFERRED, not rejected — the correct fix is
> gated on the project's `use_illegal_opcodes` setting … carry into Phase 20").
> Re-verified against `HEAD`: `computeStructuralCensus()`'s descent break at
> `r2000-coverage.ts:432` is still `if (!decoded || decoded.notes.includes("truncated")) break;`
> with no `illegal` test, while the linear sweep still skips it at `:468`.
> Reproduced at `HEAD`: a four-byte run of `0x02` reports
> `reached=4, linearSweepDecodable=0, unreached=0`.

**File:** `src/mcp/vice/r2000-coverage.ts:432` versus `:468`

**Issue:** The linear sweep explicitly skips `insn.illegal`; the descent walk
never inspects it, marks the bytes `reached-as-instruction`, and keeps walking
through them. A run of `0x02` (JAM) reports `reached=4` against
`linearSweepDecodable=0` over the same 4 bytes. A descent that has decoded a JAM
has, by definition, left real code — continuing past it inflates the headline
measure with garbage, and does so *asymmetrically* to the figure it is meant to
be contrasted against.

**Fix:** Stop the trace at an illegal opcode, and record it, rather than walking
through it.

```ts
if (!decoded || decoded.notes.includes("truncated")) break;
if (decoded.illegal) break;  // a descent that decoded an illegal opcode has left real code
```

If illegal opcodes are wanted (some crunchers use them deliberately), gate on the
project's `use_illegal_opcodes` setting rather than ignoring the flag entirely —
but keep the descent and sweep rules identical either way.

### WR-04: the cross-reference bound is printed but never recorded in the JSON report

> **STILL OPEN.** Deferred by 19-08 (CLI cluster). `r2000-cli.ts` is untouched by
> all four gap-closure plans — confirmed by `git diff --name-only 5c68473..HEAD`.
> Line references below re-verified against `HEAD`.

**File:** `src/mcp/vice/r2000-cli.ts:1284-1288`, `:1418-1427`

**Issue:** `MAX_COVERAGE_CROSS_REFERENCE_LOOKUPS` (512) caps the per-label
cross-reference lookups. When it bites, `printCoverageReport()` prints a NOTE
saying the multi-caller count is a floor — but that fact never reaches
`buildCoverageReport()` and therefore never reaches the JSON written by `--out`.
A Phase 20 consumer reading the report file sees a `multiCallerUndocumented`
count with no indication that it was measured over the lowest 512 addresses of a
larger population. That is precisely COV-02's "a measure computed over less than
the whole population must say so", violated on the machine-readable side.

**Fix:** Thread the bound into the report.

```ts
// CoverageOptions
crossReferenceBound?: { requested: number; performed: number };
// Reproducibility
crossReferencesBounded: boolean;
crossReferenceBoundReason: string | null;
```

Set them in `computeReproducibility()`, bump `COVERAGE_SCHEMA_VERSION`, update
the key-set assertion, and add a `reproducibility` finding in `coverageFindings()`
when the bound bit.

### WR-05: `--sample` silently accepts and truncates non-integer input

> **STILL OPEN.** Deferred by 19-08 (CLI cluster). Re-verified at `HEAD`:
> `r2000-cli.ts:1119` still reads `sample = Number.parseInt(value, 10);`.

**File:** `src/mcp/vice/r2000-cli.ts:1113-1120`, `:1349-1352`

**Issue:** `Number.parseInt(value, 10)` accepts a trailing-garbage prefix, so
`--sample 4abc` → `4`, `--sample 3.7` → `3`, `--sample 1e9` → `1`. Each passes
`Number.isInteger(sample) && sample > 0` and silently changes the sample rule
recorded in the report. This is the same class as WR-08's documented lesson for
`--out`/`--entry`, applied inconsistently to `--sample`.

**Fix:**

```ts
} else if (a === "--sample") {
  const value = rest[i + 1];
  if (value === undefined || value.startsWith("--")) {
    sampleMissingValue = true;
  } else {
    sampleRaw = value;
    sample = /^\d+$/.test(value) ? Number(value) : Number.NaN;
    i++;
  }
}
```

### WR-06: the entire coverage CLI surface is untested

> **STILL OPEN.** Deferred by 19-08 (CLI cluster, "closing it means authoring a
> CLI test suite"). Re-verified at `HEAD`: `parseCoverageArgs`,
> `printCoverageReport` and `cmdCoverage` still appear only at their definitions
> and call sites.

**File:** `src/mcp/vice/r2000-cli.ts:1078-1443`

**Issue:** `parseCoverageArgs()`, `printCoverageReport()` and `cmdCoverage()` are
~250 new lines with zero direct test coverage — a repo-wide search for those
three identifiers finds only their definitions and call sites. The only test
touching `coverage` at all is the `VERB_OPTIONS`/USAGE agreement check. Notably,
`printCoverageReport()` is the **sole enforcement point** of COV-01's display-side
prohibition ("never compute a combined figure at the point of display"), and that
prohibition currently exists only as a comment. Every refusal path
(`outMissingValue`, `sampleMissingValue`, bad `--sample`, refused overwrite,
`payloadDecoded === false` → exit 1) is likewise unasserted.

**Fix:** Export `printCoverageReport` and `parseCoverageArgs` (or extract the
rendering into a pure `renderCoverageReport(report, bound): string[]`) and add
tests that (a) drive every refusal branch through `runR2000Cli(["coverage", ...])`,
and (b) assert the rendered output contains no number that is not present in the
report object — the mechanical form of "no combined figure at the point of
display".

### WR-07: `parseCoverageArgs`'s `unknownOption` branch is unreachable

> **STILL OPEN.** Deferred by 19-08 (CLI cluster). Re-verified at `HEAD`.

**File:** `src/mcp/vice/r2000-cli.ts:1123-1124`, `:1328-1332`

**Issue:** `runR2000Cli()` calls `checkAcceptedOptions(verb, rest)` before
dispatch, and `VERB_OPTIONS.coverage` is exactly `["--out", "--force",
"--sample"]`. Any `--`-shaped token outside that set is refused there, so
`parseCoverageArgs`'s `unknownOption` field and `cmdCoverage`'s corresponding
refusal block can never execute. Dead code in a file whose whole discipline is
"one place enforces the closed option set for every verb".

**Fix:** Delete `unknownOption` from `CoverageParsedArgs`, the parser and
`cmdCoverage`, letting the token fall through to `positional` like every other
verb's parser does; or, if the local check is wanted as defence in depth, say so
in a comment and add a test that reaches it by calling `cmdCoverage` directly.

### WR-08: the oracle's raw stdout reaches a second, unsanitised report field

> **STILL OPEN.** Deferred by 19-08 and recorded in its threat register as
> `T-19G-08-06` / **accept** (both `spawnSync` sites already pass an argument
> array with `shell: false`; the field is JSON data with no markup or shell sink
> downstream). Carried into Phase 20 with WR-09.
> Note the deferral accepts the *risk* but leaves the **module header's claim
> false as written** — that half is a documentation defect, not a security one,
> and is still unfixed.

**File:** `src/skills/c64-program-recon/scripts/packer-finding.mjs:481-482` (contradicting the header at `:78-80`)

**Issue:** The module header states: *"The oracle's standard output reaches
exactly one field, through one bounded parser that evaluates nothing (T-19-19)."*
It reaches two. `packer` goes through `parseUnp64Stdout()` with its narrow
`PACKER_NAME_RE` charset — "so a hostile standard output cannot smuggle control
characters or markup into a document a human later reads". But `evidence[].raw`
carries up to 512 bytes of the same stdout **verbatim**, with no charset filter,
and the CLI prints it into the JSON finding a human then pastes into a recon
write-up. `JSON.stringify` escapes C0 control characters, so this is not a
terminal-injection hole, but ANSI escape sequences above `\x1f`, Markdown, and
arbitrary Unicode pass through — exactly what the sanitisation of the sibling
field exists to prevent.

**Fix:** Either apply a printable-ASCII filter to `raw` before storing it, or
correct the header to say the parsed *name* reaches one field while the evidence
record deliberately preserves raw output, and state why that is safe.

```js
const raw = typeof result.stdout === "string"
  ? result.stdout.slice(0, MAX_PACKER_NAME_LENGTH * 8).replace(/[^\x20-\x7e\n]/g, "?")
  : "";
```

### WR-09: `probeUnp64()` ignores a non-zero exit status, contradicting its own contract

> **STILL OPEN.** Deferred by 19-08, carried with WR-08 into Phase 20.
> `packer-finding.mjs` is untouched by all four gap-closure plans.

**File:** `src/skills/c64-program-recon/scripts/packer-finding.mjs:242-276`

**Issue:** The doc comment says *"A launch error, a non-zero status or a timeout
are all 'absent', never a failure."* The code checks only `probe.error` (`:254`)
and an empty banner (`:266`). A command that exits non-zero but writes anything
to stdout or stderr is accepted as an available oracle at `:276`, and is then run
against the user's binary. On the many tools that print usage to stderr and exit
`1` for an unrecognised `--version`, this makes any same-named binary on `$PATH`
an accepted oracle.

**Fix:**

```js
if (probe.error || probe.status !== 0) {
  return { available: false, command: null, version: null, reason: ... };
}
```

### WR-10: `--entropy` is neither range-checked nor refused when its value is missing

> **STILL OPEN.** Deferred by 19-08 (CLI cluster).

**File:** `src/skills/c64-program-recon/scripts/packer-finding.mjs:562-568`, `:596-601`

**Issue:** Two problems in the CLI entry:

1. `readFlag()` returns `undefined` when the next token is absent or `--`-shaped,
   so `packer-finding.mjs game.prg --entropy` and `... --entropy --foo` **silently
   drop the flag** and fall back to local measurement. That is the exact
   accepting-but-silently-dropping-an-option defect `r2000-cli.ts`'s WR-08
   comments record as already paid for once in this repo.
2. There is no range check. Shannon entropy over bytes is 0.0–8.0, but
   `--entropy -5` and `--entropy 99` are accepted by `Number.isFinite` and drive
   an `unpacked` / `packed-unidentified` verdict from a physically impossible
   input.

**Fix:**

```js
const idx = argv.indexOf("--entropy");
if (idx !== -1 && (argv[idx + 1] === undefined || argv[idx + 1].startsWith("--"))) {
  console.error("packer-finding: --entropy requires a value");
  process.exit(1);
}
...
if (entropyRaw !== undefined && (!Number.isFinite(entropy) || entropy < 0 || entropy > 8)) {
  console.error(`packer-finding: --entropy must be a number in 0..8, got "${entropyRaw}"`);
  process.exit(1);
}
```

Apply the same 0..8 guard inside `packerFinding()` itself (`:496-508`), since the
library is callable independently of the CLI.

*(The first review's prose cited "`r2000-cli.ts`'s WR-08/IN-06". `IN-06` is a
phantom cross-reference — this review has no `IN-06`. Corrected above; recorded
by 19-08's disposition table as "DOES NOT EXIST".)*

### WR-11: three suites and five shipped-prose citations hard-code a `.planning/phases/19-...` path that GSD archives

> **STILL OPEN — deferred with a recorded reason by plan 19-07.** 19-07
> deliberately did not aggravate it (`git diff … | grep -c '^+.*\.planning/phases/19'`
> = 0) and the new `NOTICES_FILES` list uses repo-relative, non-planning paths
> for exactly this reason (`skill-attribution.test.ts:304-315`). Re-verified at
> `HEAD`: `skill-attribution.test.ts:88-92` still resolves `MANIFEST_PATH` into
> `.planning/phases/19-…` and still calls `JSON.parse(readFileSync(MANIFEST_PATH))`
> **at module scope, unguarded** (`:93`).

**File:** `src/mcp/vice/skill-attribution.test.ts:88-93`, `src/mcp/vice/r2000-upstream-audit.test.ts:44-49`, `src/mcp/vice/r2000-coverage.test.ts:66-79` and `:596-608`, `src/skills/routine-queue-walker/SKILL.md:11-13,27`, `src/skills/c64-program-recon/SKILL.md`, `src/skills/c64-memory-mapping/SKILL.md`

**Issue:** Two of the three test files call `readFileSync(MANIFEST_PATH)` at
**module scope**, unguarded — so if
`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/` moves, the
whole suite fails to load with a raw ENOENT rather than a diagnosable assertion.
`r2000-coverage.test.ts` additionally reads that directory's
`evidence/coverage-reproducibility/` and phase **11**'s
`evidence/criterion1/recon-subject.regen2000proj`. Archiving a completed phase
directory is a routine, first-class GSD operation. This is a shipped-source test
suite whose liveness depends on a planning artifact's directory name.

Separately, the `ATTRIBUTION` blocks tell a reader the full upstream path *"is
recorded once, in .planning/.../upstream-procedure-manifest.json"* — a file that
ships in neither tarball. For every npm or plugin consumer, the pointer the
attribution header offers as its escape hatch is dangling.

**Fix:** Move the manifest and the sealed reproducibility evidence to a durable,
shipped-or-at-least-stable location (`docs/upstream/` or
`src/mcp/vice/fixtures/`), and reference *that* from both the tests and the
attribution headers. If the planning location must stay, resolve it through a
single exported constant with an `existsSync` guard that fails with a named
message (`"the phase-19 manifest has moved; update MANIFEST_PATH"`) rather than
an ENOENT at import.

### WR-12: `manifestEntryFor()` lies to the type system and can throw a TypeError instead of its intended message

> **STILL OPEN — deferred with a recorded reason by plan 19-07.** Re-verified at
> `HEAD`: `skill-attribution.test.ts:230-232` still annotates the return type as
> `{ path: string; sha256: string }` with no `| undefined`, and the digest test
> at `:492` still dereferences `entry.sha256` without a local guard.

**File:** `src/mcp/vice/skill-attribution.test.ts:230-232`, used at `:479-493`

**Issue:** `manifest.procedures.find(...)` returns `T | undefined`, but the
function is annotated `{ path: string; sha256: string }`. The `manifest` object
is `any` (from `JSON.parse`), so `strict` does not catch it. The only guard —
`assert.ok(manifestEntryFor(row), ...)` — lives in a *different* test
(`:444-445`); node:test runs tests independently, so the digest test
dereferences `entry.sha256` unguarded. A re-pathed manifest entry therefore
surfaces as `TypeError: Cannot read properties of undefined` instead of the
written diagnostic.

**Fix:**

```ts
function manifestEntryFor(row: AbsorbedFile): { path: string; sha256: string } | undefined {
  return manifest.procedures.find((p: { path: string }) => p.path === row.upstreamPath);
}
// at the call site:
const entry = manifestEntryFor(row);
assert.ok(entry, `${row.destination}: manifest lists no entry for ${row.upstreamPath}`);
```

### WR-13: the anchored multi-caller rule's label-name branch is still satisfied by an ordinary English word that happens to be a caller's name

**File:** `src/mcp/vice/r2000-coverage.ts:1342-1343`

**Issue:** `CR-01`'s fix anchored the *hex* branch correctly. The *name* branch
is now identifier-bounded, which fixes the `my_entry_pointer` / `entry_point`
case — but it still declares "this comment names its caller" for **any**
standalone occurrence of the caller's label text anywhere in the comment:

```ts
const name = nameByAddress.get(caller);
if (name && new RegExp(`(?<![0-9A-Za-z_])${escapeRegExp(name)}(?![0-9A-Za-z_])`).test(rawComment)) return true;
```

regenerator2000 label names are routinely ordinary English words — `loop`,
`init`, `main`, `start`, `data`, `table`, `draw` — and an ordinary description of
what a routine does will contain them by accident. The rule then certifies a
comment that names nothing.

**Reproduced against the shipped code at `HEAD`** (identical inputs, one caller
renamed):

```
callers of $0820: [$0012, $0034]
comment:          "[confirmed-code] sets the mode flag before the main loop runs"

caller $0012 named "caller"  ->  multiCallerUndocumented = { count: 1, addresses: [2080] }   (correct)
caller $0012 named "loop"    ->  multiCallerUndocumented = { count: 0, addresses: [] }        (FALSELY CLEAN)
```

Nothing in the comment refers to the routine at `$0012`. The label is counted as
documented, stays in `labels.kindRatio.user`, and enters the reproducibility
sample. This is the same falsely-clean class as `CR-01`, at a lower trigger rate.

**Fix:** Demand that the name be used *as a reference*, not merely present.
Cheapest honest tightening: require an adjacent citation marker — the name
immediately preceded by `` ` ``, or followed by its hex in parentheses, or
appearing in a `from`/`called by`/`callers:` context. If that is judged too
strict, the alternative is to stop accepting bare names entirely and require the
hex form (which `CR-01`'s fix already anchors correctly), documenting the
decision beside the rule. Whichever is chosen, add the control:

```ts
test("a caller whose label name is an ordinary English word does not satisfy the rule by coincidence", () => {
  // caller named "loop"; comment says "... before the main loop runs" and refers
  // to no caller at all.
  assert.equal(repro.multiCallerUndocumented.count, 1);
});
```

### WR-14: the class-4 stack-return scan feeds `provenDispatchTargets()` with no gate at all — no register match, no target plausibility, a guessed entry count

**File:** `src/mcp/vice/r2000-coverage.ts:794-838`, consumed at `:961-963`

**Issue:** 19-08 gated class 3 behind five conditions and named
`provenDispatchTargets()` "the ONE seam that decides what may seed a recursive
descent". Class 4 pours into that same seam and satisfies **none** of the
conditions class 3 must satisfy:

| condition | class 3 | class 4 |
|---|---|---|
| both loads index the same register | required (`:871`, `sameIndexRegister`) | **not checked** |
| lo/hi orientation justified | required (`resolveSplitOrientation`) | justified by push order — genuinely fine |
| every target in-image **and decodable** | required (`:901-905`) | **not checked** |
| entry count | `span`, then gated on (e) | `span`, ungated (`:808-809`) |
| a negative control exists | yes (`dispatch class 3 DECLINES …`) | **none** |

Two consequences, both reproduced against the shipped code at `HEAD`:

1. **Mismatched index registers are accepted.** `lda $c010,x : pha : lda $c013,y :
   pha : rts` — two tables walked by two different registers, which class 3's own
   comment calls "two tables, not one split one" — is reported as a class-4
   idiom and yields `provenDispatchTargets = [$c006]`.
2. **A target that decodes as an illegal opcode is still proven.** Setting the
   reconstructed target byte to `0x02` (JAM) changes nothing: `targets` still
   `[$c006, $c006, $c006]`, `provenDispatchTargets` still `[$c006]`, and the
   descent seeds from it.

Worse, the **committed positive fixture already demonstrates the problem**.
`STACK_RETURN` (`r2000-coverage.test.ts:179-188`) reconstructs `$c006` — which is
the *third byte of the idiom's own second instruction* (`lda $c013,x` occupies
`$c004..$c006`). `r2000-coverage.test.ts:764` asserts that value is correct. A
mid-instruction address is not an entry point, and it is being handed to the seam
whose doc comment says adding a source to it "IS THE DECISION TO TREAT THAT
SOURCE AS PROOF OF CODE".

The trigger rate is much lower than `CR-04`'s (the five-instruction idiom is
specific), but the failure is the same manufactured-coverage class, and
`r2000-coverage.test.ts:770-780`'s own comment states the rule this violates:
*"A heuristic with a positive control and no negative one is not evidence that it
declines anything."*

**Fix:** Apply class 3's conditions (b) and (e) to class 4, and give it a negative
control.

```ts
if (!isIndexedLoad(a)) continue;
if (b.opcode !== 0x48) continue;
if (!isIndexedLoad(c)) continue;
if (!sameIndexRegister(a, c)) continue;   // two registers are two tables (WR-14)
...
const value = (pushed + 1) & 0xffff;
const decoded = decode(safeBytes.subarray(value - safeOrigin), value, { count: 1 })[0];
const plausible =
  value >= safeOrigin && value < safeOrigin + size &&
  !!decoded && !decoded.illegal && !decoded.notes.includes("truncated");
if (!plausible) { tableTruncated = true; break; }   // do not publish an implausible entry point
```

Then rebuild `STACK_RETURN` so its lo/hi bytes name a real routine outside the
idiom (so `targets` stops being a mid-instruction address), and add
`dispatch class 4 DECLINES a pha/pha/rts window whose two loads use different
index registers`.

### WR-15: one unrelated indexed load between a genuine split-table pair silently downgrades the whole pairing to advisory

**File:** `src/mcp/vice/r2000-coverage.ts:923` (`break; // one pairing per leading load`)

**Issue:** The inner class-3 loop takes the **first** second-load it encounters
and then `break`s — whether that pairing was accepted as proven **or** recorded
as advisory. So an unrelated indexed load sitting between the two halves of a
real split table consumes the leading load, and the genuine pairing behind it is
never examined.

**Reproduced against the shipped code at `HEAD`**, same payload with and without
one interposed `lda $0828,y`:

```
                                    proven splitTables   advisory   provenTargets
lda $0830,x / sta $fb / lda $0838,x / sta $fc / jmp ($fb)        1          0             8
lda $0830,x / lda $0828,y / sta $fb / lda $0838,x / ... jmp ($fb) 0          2             0
```

A dispatch table with a real `jmp ($00fb)` consumer — the exact shape the
positive control certifies — becomes invisible, and its eight targets vanish from
the census seed set. The direction is safe (under-report, not over-report), but
it is silent: the report shows two advisory candidates and a clean-looking
`splitTables: []`, with no indication that a proven pairing was preempted.

**Fix:** Only the *proven* branch should consume the leading load; an advisory
recording should keep scanning the window.

```ts
if (gatedSoFar && everyTargetIsAPlausibleEntryPoint) {
  ...
  splitTables.push({ ... });
  break;                    // a PROVEN pairing consumes its leading load
}
// otherwise remember the candidate and keep looking inside the window
pending ??= { at: first.address, loBase: a, hiBase: b, entries: targets.length,
              targets: [], truncated: tableTruncated, orientationResolved: false };
```

...emitting `pending` into `splitTableCandidates` only if no proven pairing was
found for that leading load. Add the two-payload comparison above as a control.

## Info

### IN-01: `r2000-coverage.ts` carries a shebang but is a pure library

> **REJECTED — plan 19-08** ("out-of-scope cosmetics; shebang retained.
> Harmless; removing it risks nothing but gains nothing"). Recorded here so the
> decision is not re-litigated. Still present at `r2000-coverage.ts:1`.

**File:** `src/mcp/vice/r2000-coverage.ts:1`

**Issue:** `#!/usr/bin/env node` implies a CLI entry point. The module has none —
it exports functions only, and the CLI lives in `r2000-cli.ts`. The project's own
convention is "shebang on every standalone script", which this is not.

**Fix:** Remove line 1.

### IN-02: fixture regeneration is host-dependent despite the stated determinism contract

> **STILL OPEN — and the deferral was not honoured.** 19-08 deferred it *to
> 19-09* ("19-09 is the plan that edits the generator"). 19-09 did edit
> `make-coverage-fixtures.mjs` — adding per-fixture `program` support and four
> pair invariants — but added no per-host qualifier. Re-verified at `HEAD`:
> `make-coverage-fixtures.mjs:27-29` still reads "There is no timestamp, no
> random value and no host-dependent path in any emitted file", and the payload
> still comes from `r2000-project.ts:147`'s `gzipSync(bytes)`. `README.md` says
> nothing either. Two more `project.regen2000proj` blobs were added under the
> unqualified claim, so the exposure grew from six files to eight.

**File:** `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs:27-29`

**Issue:** The header states running the generator twice must leave
`git status --porcelain` empty — verified locally. But the payload comes from
`synthesizeProject()` → `gzipSync()`, and the gzip header's OS byte is set from
zlib's compile-time `OS_CODE`. Regenerating on a non-Unix host would churn all
eight `project.regen2000proj` files with no source change. The determinism claim
is true per-host, not absolutely.

**Fix:** State the per-host qualifier in the header, or normalise the OS byte
after gzip so the artifact is byte-identical across platforms.

### IN-03: `stripComments()` has no regex-literal awareness

> **STILL OPEN.** Deferred by 19-08 ("different module family; no gap depends on
> it"). `scripts/lib/r2000-cli-verbs.mjs` is untouched by all four plans.

**File:** `scripts/lib/r2000-cli-verbs.mjs:59-96`

**Issue:** The scanner treats `'` and `` ` `` as string delimiters unconditionally.
A regex literal in `r2000-cli.ts` containing an apostrophe or a backtick would
open a phantom string and desync the scan, and a string literal containing an
unbalanced `{`/`}` would desync `switchVerbBody()`'s depth count. Severity is low
only because `R2000_CLI_VERB_FLOOR` turns the resulting under-count into a loud CI
failure rather than a silent one.

**Fix:** Note the limitation in the function's doc comment so a future maintainer
knows why a verb "disappeared", and reference the floor as the backstop.

### IN-04: `computeStructuralCensus` never checks that `origin + size` stays inside the 16-bit space

> **RESOLVED — plan 19-08** (commit `1706d8b`). `computeStructuralCensus()` now
> computes `effectiveEnd = Math.min(safeOrigin + size, 0x10000)` and derives
> `rangeSize` from it (`r2000-coverage.ts:376-377`); `inRange`, the class array,
> the count loop and the linear sweep all read the bounded range, and `size`
> versus `rangeBytes` are documented as differing only for a malformed pair.
> Regression-tested by *"a census whose origin plus size would leave the 16-bit
> space is bounded"*. **The sibling scan was not bounded — see IN-05.**

**File:** `src/mcp/vice/r2000-coverage.ts:335-336` *(pre-fix line numbers)*

**Issue:** `origin` is clamped to `0..0xffff`, but `size` is taken from the
payload unchecked. A 64K payload at a non-zero origin produces `classRuns` whose
`end` exceeds `$ffff` and `hexAddr()` output wider than four digits — addresses
that do not exist on the machine being measured.

**Fix:** *(applied by 19-08)* Clamp the censused range to `min(size, 0x10000 - safeOrigin)`.

### IN-05: `scanIndirectDispatch()` was not given IN-04's 16-bit bound, so the report can still carry addresses above `$FFFF`

**File:** `src/mcp/vice/r2000-coverage.ts:722` (`inImage`), `:762-764`, `:830-831`, `:889`

**Issue:** IN-04's fix bounded the *census* at `$10000`, but the dispatch scan's
own predicate was left as

```ts
const inImage = (addr: number): boolean => addr >= safeOrigin && addr + 1 < safeOrigin + size;
```

with the class-2, class-3 and class-4 index arithmetic likewise reading
`safeOrigin + size`. For a malformed origin/length pair — the exact input IN-04's
comment names ("a `.regen2000proj` file the operator did not author can claim any
origin and carry any length") — `dispatch.tableEntryAddresses`,
`dispatch.discoveredTargets` and every `SplitTableFinding.targets` can contain
values at or above `$10000`.

They cause no crash: `computeStructuralCensus`'s `mark()` filters them out. But
they are written into the JSON report that Phase 20 and Phase 21 consume, and
`r2000-cli.ts`'s `hexAddr()` renders them as five hex digits — an address the
machine being measured cannot address, printed as though it could. The census and
its own dispatch sub-report now describe two different address spaces.

**Fix:** Give the scan the same bound and state it once.

```ts
const effectiveEnd = Math.min(safeOrigin + size, 0x10000);
const inImage = (addr: number): boolean => addr >= safeOrigin && addr + 1 < effectiveEnd;
```

...and replace every remaining `safeOrigin + size` comparison in
`scanIndirectDispatch()` with `effectiveEnd`. Extend the existing *"a census
whose origin plus size would leave the 16-bit space is bounded"* test to assert
`dispatch.tableEntryAddresses.every((a) => a <= 0xffff)`.

---

_Reviewed: 2026-08-25T05:37:36Z (second pass)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_First pass: 2026-08-24T18:33:32Z — 19 findings; ids preserved, six resolved in place_
