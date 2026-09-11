---
phase: 45-decomposition-to-closure-disagreement-first
reviewed: 2026-09-11T11:17:50Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - docs/phase45-closure-dxa-family.md
  - docs/phase45-closure-gate.md
  - docs/phase45-closure-ghidra-family.md
  - docs/phase45-derivation-execution-evidence.md
  - docs/phase45-ghidra-derivation-evidence.md
  - docs/phase45-planted-control-evidence.md
  - docs/phase45-wave0-measurements.md
  - scripts/lib/anno-cli-invocations.mjs
  - scripts/lib/anno-cli-verbs.mjs
  - src/mcp/vice/anno-cli-path-consumers.test.ts
  - src/mcp/vice/anno-cli.test.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-decomp-closure.test.ts
  - src/mcp/vice/anno-enum-gen.test.ts
  - src/mcp/vice/anno-enum-gen.ts
  - src/mcp/vice/anno-export-asm.test.ts
  - src/mcp/vice/anno-export-asm.ts
  - src/mcp/vice/anno-store-export.test.ts
  - src/mcp/vice/anno-store-export.ts
  - src/mcp/vice/anno-tools.test.ts
  - src/mcp/vice/anno-tools.ts
  - src/mcp/vice/anno-verb-coverage.test.ts
  - src/mcp/vice/fixtures/decomp-execution-manifest.json
  - src/mcp/vice/fixtures/dxa/README.md
  - src/mcp/vice/fixtures/export-asm/README.md
  - src/mcp/vice/fixtures/ghidra/README.md
  - src/mcp/vice/fixtures/petcat/README.md
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/skills/routine-queue-walker/scripts/completeness-report.mjs
  - src/skills/routine-queue-walker/scripts/completeness-report.test.mjs
  - src/skills/routine-queue-walker/SKILL.md
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-09-11T11:17:50Z
**Depth:** standard
**Files Reviewed:** 31 (plus the nine `fixtures/**/*.annostore.json` blobs, deliberately out of scope per this review's own `<scope_note>`)
**Status:** issues_found

## Summary

This phase adds the fifth `anno` CLI verb (`decomp-completeness`), a general
per-fixture store export/import round trip (`anno-store-export.ts`), the
multi-bit register decomposition decoder (`decomposeRegisterValue()` in
`anno-enum-gen.ts`) and its two render surfaces (`anno-export-asm.ts`,
`anno-tools.ts`), and the `routine-queue-walker` gate script
(`completeness-report.mjs`) plus its regression suite. The work is unusually
well self-documented and already discloses one real defect against its own
committed `charset-phantom.annostore.json` fixture (the `$DD00`
incomplete-bitfield-table throw, `docs/phase45-closure-gate.md`).

Tracing the diff against the actually-changed source (rather than trusting the
prose), I found one undisclosed regression in the new decomposition-dispatch
logic that is broader than the disclosed `$DD00` gap and reachable outside the
nine fixtures, plus two lower-severity robustness gaps in the new
`anno-store-export.ts` round trip and the `decomp-completeness` verb's image
fallback. Everything else traced cleanly: `decomposeRegisterValue()` genuinely
has no second implementation (`anno-export-asm.ts` and `anno-tools.ts` both
call it, never re-derive a bit mask), the CLI's confinement, required-flag and
anti-vacuity discipline for the new verb is applied consistently with the
rest of the file, and `anno-decomp-closure.test.ts` is a real, non-vacuous
regression (Test 5's non-vacuity control and the planted-control evidence
document both prove the gate can actually fail).

## Critical Issues

### CR-01: Hardware-register decomposition is attempted by enum-NAME SHAPE alone, with no check that the register has a curated table entry — breaks any hand-authored register-shaped enum for a register `anno-regbits.json` does not cover (e.g. `$D020`/`$D021`)

**File:** `src/mcp/vice/anno-export-asm.ts:1202-1204` (and the identical pattern in `src/mcp/vice/anno-tools.ts`, `renderDisassembleListing()`, the `REGISTER_ENUM_NAME_RE.test(usage.enumName)` branch)

**Issue:**

Both D-16 render surfaces gate the new multi-bit-decomposition attempt purely
on whether the enum's *name* has the shape `^[0-9A-F]{4}$` (`REGISTER_ENUM_NAME_RE`):

```ts
if (REGISTER_ENUM_NAME_RE.test(usage.enumName)) {
  try {
    decomposition = decomposeRegisterValue(parseInt(usage.enumName, 16), instr.operand!.value);
  } catch (err) {
    throw new Error(
      `exportAsm: decomposing the enum usage at ${hex4(usage.address)} (enum ${JSON.stringify(usage.enumName)}, value ` +
        `${hex2(instr.operand!.value)}) against its bit-name table failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
```

`decomposeRegisterValue()` unconditionally calls `requireRegBitsEntry()`,
which *throws* when `anno-regbits.json` has no entry at all for that register
(`anno-enum-gen.ts`: `"no bit-name table entry for register ... anno-regbits.json has no fields for this address"`). That throw is caught here only to be
**re-thrown**, fatally aborting the whole export (or, in `anno-tools.ts`, the
whole `anno_disassemble` render) — there is no fallback to the pre-existing
single-symbol matching path (the `else` branch a few lines below, which is
still fully functional and still exercised by the `"viccolor"` test case).

This is a real regression, not merely the already-disclosed `$DD00` gap:

- The disclosed `$DD00` issue (`docs/phase45-closure-gate.md`) is about a
  register that **is** in the curated table but whose field set is
  incomplete (`orAccumulator !== value`) — a different throw, from a
  different branch of `decomposeRegisterValue()`.
- This finding is about a register that is **not in the table at all**.
  Per this phase's own measurement (`docs/phase45-closure-dxa-family.md`,
  Task 3), `$D020` (VIC-II border colour — one of the two or three most
  commonly annotated C64 registers) is confirmed **absent** from the
  committed `anno-regbits.json`. The exact same is true of `$D021` and most
  other simple value registers.
- The project's own established convention for a *generated* register enum
  is to name it exactly `regKey.slice(1)` (`"D011"`, `"D018"`, `"DD00"` —
  confirmed in `docs/phase45-ghidra-derivation-evidence.md`'s enum-install
  output). Nothing prevents — and the `c64-memory-mapping` skill explicitly
  documents and encourages — a human or agent hand-authoring a register enum
  the same way via `anno_create_project_enum`/`anno_apply_enum_usage` for a
  register the generator skipped precisely because it has no table entry
  (`$D020` is the textbook case). Doing so today silently breaks: the
  previously-working single-symbol path is never reached, because the
  branch condition tests only the *name's shape*, not table membership.
- Contrast this with `anno-enum-gen.ts`'s own `fetchRegisterSearchRows()`,
  which correctly gates on `knownRegisters.has(key)` (table membership)
  before ever treating a `sta` target as a register candidate. The two new
  render call sites do not apply the same discipline.
- No test in `anno-export-asm.test.ts` or `anno-tools.test.ts` exercises a
  register-shaped enum name (`^[0-9A-F]{4}$`) for a register absent from
  `anno-regbits.json` (confirmed by grep — the only 4-hex-digit enum names
  under test are `D018`, `DC00`/`E000`/`D011`, all either real registers in
  the table or a test-injected synthetic table entry). The regression is
  unguarded.

**Fix:** Gate the decomposition attempt on table membership, not name shape —
mirror `fetchRegisterSearchRows()`'s own `knownRegisters.has(key)` check (or
export a `hasRegBitsEntry(key)` predicate from `anno-enum-gen.ts` for exactly
this purpose) before calling `decomposeRegisterValue()`. When the shape
matches but the table has no entry, fall through to the existing
single-symbol path instead of attempting — and failing — a decomposition the
enum was never modelled for:

```ts
let decomposition: RegisterDecomposition | undefined;
if (REGISTER_ENUM_NAME_RE.test(usage.enumName) && hasRegBitsEntry(usage.enumName)) {
  decomposition = decomposeRegisterValue(parseInt(usage.enumName, 16), instr.operand!.value);
  // (any throw here is now a genuine data/coverage error the table has an
  // entry for, e.g. the $DD00 incomplete-coverage case, and should still propagate)
}
```

Apply the identical fix in `anno-tools.ts`'s `renderDisassembleListing()`.

## Warnings

### WR-01: `anno-store-export.ts`'s `importStoreDocument()` silently discards every row's `bank` field instead of validating it is null or round-tripping it

**File:** `src/mcp/vice/anno-store-export.ts:426-492` (the `PlannedWrite` construction loops for `range`/`label`/`comment`/`enumUsage`/`xref`)

**Issue:** `exportStoreDocument()` faithfully exports the store's `bank`
column for every row kind (`StoreExportRangeRow.bank`,
`StoreExportLabelRow.bank`, `StoreExportCommentRow.bank`,
`StoreExportEnumUsageRow.bank`, `StoreExportXrefRow.bank`). `importStoreDocument()`, however, reads the row's `bank` field for **none** of them — every `PlannedWrite` variant drops it, and every corresponding write call
(`setDataType`, `setLabel`, `setComment`, `applyEnumUsage`, `putXref`) is
called with no `bank` argument, which `anno-store.ts` confirms always
hard-codes `bank: null` for a fresh insert. This is currently harmless only
because `bank` is, project-wide, "reserved and interpreted by nothing today"
(`anno-store.ts:1890`) — no writer anywhere in the codebase can currently
produce a non-null value. The module's own header nonetheless claims this is
"the general JSON export/import module" and the closure gate
(`docs/phase45-closure-gate.md`'s Idempotence sweep) asserts a
byte-identical whole-document round trip with "no loss ... for all nine
fixtures" — a claim that holds today only because every fixture's `bank`
column happens to already be null everywhere, never because the import path
actually preserves it. The moment any future feature starts writing a
non-null `bank` (the column exists specifically so a banked-memory model can
inherit it, per its own doc comment), this module will silently and
untestably drop that data on any import, and neither `anno-store-export.test.ts` nor `anno-decomp-closure.test.ts` would catch it, since both round-trip stores where `bank` is null throughout by construction.

**Fix:** Either (a) validate `bank` is `null` on every row and reject a
non-null value with a named refusal (matching this project's "refuse by name,
never silently drop" convention, exactly as `validateDisagreementDocumentShape()` does elsewhere in this phase), or (b) thread `bank` through every `PlannedWrite` variant and every write call now, before a real bank-carrying writer exists to expose the gap in production. Given this project's own stated discipline ("never silently drop an annotation while reporting success"), (a) is the minimal safe fix.

### WR-02: `decomp-completeness`'s image fallback fabricates a phantom `$0000` entry point when the fixture image cannot be located

**File:** `src/mcp/vice/anno-cli.ts:899-905` (`cmdDecompCompleteness()`, the `loadedImage`/`image` fallback feeding `buildRangeProvenance()`/`buildEntryPoints()`/`buildReferencedAddresses()`)

**Issue:**

```ts
const fixtureImagePath = join(HERE, "fixtures", manifestEntry.path);
const loadedImage = existsSync(fixtureImagePath) ? projectImage(fixtureImagePath) : null;
const image = loadedImage ?? { origin: 0, bytes: new Uint8Array(0) };
```

`buildEntryPoints()` unconditionally adds `image.origin` to its candidate set.
When the fixture's own image file is missing or fails to decode, `image.origin` becomes `0` — and the resulting report then names `$0000` as an
`entryPoints` row (with `hasName: false`, since nothing is ever labelled
there), which reads as a real finding about the program rather than as "this
verb could not locate the bytes it needed." The verb's own header comment
acknowledges the degrade ("degrades entryPoints/referencedAddresses to the
image's origin only / empty, rather than throwing") but the degrade fabricates a specific, wrong address (`$0000`) rather than surfacing the missing-image condition explicitly. This path is not reachable for the nine committed fixtures (all nine images exist), so it did not surface in this phase's own closure evidence, but `decomp-completeness` is a general verb (its own `--help` text and `VERB_OPTIONS` entry make no fixtures-only restriction) and a future fixture whose `manifestEntry.path` is typo'd, moved, or simply not yet committed would get a plausible-looking but fabricated report instead of a clear refusal.

**Fix:** When `loadedImage` is `null`, report the condition by name (e.g. an
`imageUnavailable: true` field on the JSON answer, or refuse the verb outright with exit 1) rather than substituting a zero-length image whose `origin` masquerades as a real entry-point candidate.

## Info

### IN-01: Two independent, hand-copied definitions of `SURVIVOR_EXTRA_RE`/`isSurvivorLabelName()` (and of `typedByFor()`) must be kept in sync by inspection, not by import

**File:** `src/mcp/vice/anno-cli.ts:188-197` vs. `src/skills/routine-queue-walker/scripts/completeness-report.mjs:95-121`

**Issue:** Both files' own header comments are candid about this: the two
packages (`src/mcp/vice/**` and `src/skills/**`) publish separately and
cannot import each other, so the frozen survivor-prefix regex and the
`typedByFor()` precedence rule are each declared twice, "kept in sync by
inspection." This is a deliberate, disclosed tradeoff (not a defect this
phase introduced silently), but it is worth naming as a standing
maintenance risk: nothing mechanically fails if a future edit updates one
copy and not the other, beyond a careful reviewer noticing the drift. Given
this project's general aversion to "two answers to one question," a
cross-file assertion test (comparing the two regex sources' string
representations, or a small shared JSON-literal `SKILL.md`/`.mjs` data file
the CI packaging step can inline into both) would close this gap
mechanically rather than by discipline.

**Fix:** Optional — no action required now; consider a mechanical
cross-package drift check if this pattern is repeated for a third value in a
later phase.

---

_Reviewed: 2026-09-11T11:17:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
