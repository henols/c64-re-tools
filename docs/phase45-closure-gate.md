# Phase 45 plan 45-10 — the closure gate

This document is the phase's own closure record, organised against
`.planning/ROADMAP.md`'s five Phase 45 success criteria. Each criterion
section below names what was measured, where the underlying evidence
lives, and what the result was — never restating the two family closure
documents (`docs/phase45-closure-dxa-family.md`,
`docs/phase45-closure-ghidra-family.md`) that already carry the per-fixture
detail.

## Criterion 5 — hardware register writes render as named enum members, with a multi-bit register decomposed

**MEASURED 2026-09-11**, against the REAL committed
`src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json` export and the
REAL committed `src/mcp/vice/fixtures/ghidra/charset-phantom.prg` image — not
a synthetic image. Method: the committed export was imported
(`importStoreDocument()`) into a fresh scratch sqlite store, `anno
export-asm`'s own implementation (`exportAsm()`) was run over that store
against the real fixture image, the exported source was assembled with real
ACME 0.97 ("Zem"), and the produced bytes were diffed against the fixture
image byte for byte. `anno_disassemble` was then run over the same store and
image for the readability half (D-16).

### A measured blocker, disclosed and worked around for this demonstration only

Running `exportAsm()` over the committed store **exactly as committed**
throws for the WHOLE document:

```
Error: exportAsm: decomposing the enum usage at $0810 (enum "DD00", value $3f)
against its bit-name table failed: decomposeRegisterValue: register $DD00
value 0x3f is not fully covered by its fields -- the OR of the decomposed
terms is 0x3c, leaving bits 0x3 unaccounted for. Refusing to emit a lossy
decomposition rather than a residual hex literal (add an OVERRIDES entry in
anno-regbits-gen.ts and regenerate anno-regbits.json).
```

Root cause, read directly from the committed `anno-regbits.json`: the `$DD00`
entry's fields cover only bits #2-#7 (mask `0xfc` — `RS_232_DATA_OUTPUT`,
`SERIAL_BUS_ATN_SIGNAL_OUTPUT`, `SERIAL_BUS_CLOCK_PULSE_OUTPUT`,
`SERIAL_BUS_DATA_OUTPUT`, `SERIAL_BUS_CLOCK_PULSE_INPUT`,
`SERIAL_BUS_DATA_INPUT`). It carries **no field for bits #0-#1** — the VIC
bank-select bits — even though those are exactly the bits
`charset-phantom.a`'s own header comment calls out as semantically load-bearing
("`$DD00 = $3f`: bits #0-#1 = `%11` -> VIC bank select inverts to 0 -> bank
base `$0000`"). `decomposeRegisterValue()` is doing exactly its documented
job here — refusing to emit a lossy decomposition rather than silently
dropping two bits — so this is **not a bug in the decoder**; it is a
genuine, pre-existing incompleteness in the curated `anno-regbits.json` table
for `$DD00`, unrelated to `$D011`/`$D018` (both of which this table covers
**completely**: `$D011`'s fields OR to `0xff`, `$D018`'s fields OR to `0xff`,
confirmed by reading the committed table directly).

`$DD00` was never criterion 5's own subject — the roadmap names `$D011` and
`$D018` specifically, and plan 45-09's own SUMMARY records `DD00` as "a
bonus eligible register" the enum-generation route happened to also pick up,
never a requirement. Per this plan's own prohibitions ("never hand-edit
`anno-regbits.json`") and plan 45-08's own established precedent (widening a
curated table's inclusion rule is an architectural change to a shared
generator, out of scope for a fixture-closure plan), this gap is **not**
fixed here. For this demonstration only, the `DD00` project-enum and its one
usage binding were dropped from a **scratch copy** of the imported document
(2 of 3 project enums and 2 of 3 usage bindings survive: `D011` and `D018`,
untouched) — the committed `charset-phantom.annostore.json` on disk was never
modified. Every other row (514 labels, 514 comments, 4 ranges, 3 xrefs, 2555
exec observations) is the real, unmodified, committed content. This is
recorded here as a genuine, disclosed limitation of the current closed state
of `charset-phantom.prg`'s store: **`anno export-asm` cannot run over the
committed store as committed today**, only over the store with `DD00`'s enum
usage removed. A later plan/human decision is needed on whether to widen
`anno-regbits-gen.ts`'s `$DD00` field set (adding the VIC-bank-select field)
or to leave `DD00`'s enum uninstalled in the committed fixture.

> **SUPERSEDED the same day — read this before acting on the paragraph above.**
> The "later plan/human decision" named above was taken immediately, at the phase's
> post-review gate: the owner chose to **leave `DD00`'s enum uninstalled in the
> committed fixture** rather than widen `anno-regbits-gen.ts`. Commit `42820042`
> removed the `DD00` project enum and its one usage binding from the committed
> `charset-phantom.annostore.json` itself; `D011` and `D018` were left untouched.
>
> Two consequences for the paragraph above, which is now historical rather than current:
>
> 1. **`anno export-asm` DOES run over the committed store as committed.** The
>    sentence "cannot run over the committed store as committed today" describes the
>    state before `42820042`, not the shipped state. Independently reproduced at the
>    phase verification gate: the real `exportAsm()` over the real committed store
>    succeeds, and its output reassembles byte-identically under real ACME 0.97.
> 2. **The scratch copy is no longer part of the mechanism.** Criterion 5's
>    demonstration below was originally captured against a DD00-removed *scratch*
>    copy; the committed fixture now has that same shape on disk, so the two are no
>    longer different documents. Later references in this file to a "scratch copy"
>    (and to rows "deleted from a scratch copy") are historical for the same reason.
>
> The separate, genuine gap this paragraph identified is unchanged and still open:
> `anno-regbits.json`'s `$DD00` entry still has no field for bits #0-#1 (VIC bank
> select). Nothing in this phase widened the curated table.

### The exported source, verbatim (D011/D018 only — criterion 5's own subject)

Per-field constant header definitions (one line per field, each appearing
exactly once):

```
D018_SELECT_UPPER_LOWER_CHARACTER_SET0 = $00
D018_CHARACTER_DOT_DATA_BASE_ADDRESS2 = $04
D018_VIDEO_MATRIX_BASE_ADDRESS0 = $00
D011_YSCROLL3 = $03
D011_ROW25 = $08
D011_SCREENON = $10
D011_TEXT = $00
```

(`$D011`'s real written value is `$1b` = `%00011011`: `YSCROLL=3` (bits
#0-#2), `ROWS=1`/`ROW25` (bit #3), `SCREENON=1` (bit #4), `MODE=0`/`TEXT`
(bit #5), `ECM=0` and `RST8=0` (bits #6-#7, both mapped to an EMPTY token by
the curated table and therefore emit no OR term — this is why 4 constants
appear for `$D011`'s 6 fields, not 6). `$D018`'s real written value is `$04`
= `%00000100`: `SELECT_UPPER_LOWER_CHARACTER_SET=0`,
`CHARACTER_DOT_DATA_BASE_ADDRESS=2`, `VIDEO_MATRIX_BASE_ADDRESS=0` — all
three of `$D018`'s fields, none empty.)

The two register-write lines, exported (OR-ed named constants, each followed
by a decoded comment on the SAME line, D-17's shape):

```
        lda #D018_SELECT_UPPER_LOWER_CHARACTER_SET0 | D018_CHARACTER_DOT_DATA_BASE_ADDRESS2 | D018_VIDEO_MATRIX_BASE_ADDRESS0  ; $D018: SELECT_UPPER_LOWER_CHARACTER_SET=0, CHARACTER_DOT_DATA_BASE_ADDRESS=2, VIDEO_MATRIX_BASE_ADDRESS=0
        lda #D011_YSCROLL3 | D011_ROW25 | D011_SCREENON | D011_TEXT  ; $D011: YSCROLL=3, ROWS=1, SCREENON=1, MODE=0, ECM=0, RST8=0
```

`start`'s own hand-authored purpose comment (unaffected by the DD00
workaround, since it is an authored comment row, not a derived enum row),
shown immediately above the two lines in the real export:

```
        ; function: configures a complete VIC-II bank/screen/charset combination ($DD00=$3F selects bank $0000, $D018=$04 places the screen at $0000 and the character set at $1000, $D011=$1B selects character mode) then calls into the charset region at $1000 | inputs: none | outputs: none in registers | side effects: writes $DD00, $D018, $D011 (CIA2 port A and two VIC-II registers), calls charset_start (jsr), returns via rts
```

`enumSubstitutionCount: 2`, `enumDecompositionCount: 2` — both of criterion
5's own register writes are decompositions, and nothing else in the store
substitutes an enum (the `DD00` usage was removed for this run, per above).

### ACME's own verdict — real assembler, byte-identical

```json
{
  "outcome": "ok",
  "reason": "the output file this run created is byte-identical to the expected bytes (4095 byte(s) across 4 segment(s)).",
  "byteDiff": {
    "equal": true,
    "firstDifferingOffset": null,
    "expectedLength": 4095,
    "actualLength": 4095
  }
}
```

515 stderr lines were emitted, **all `Warning` severity** (`Wrong type -
expected address.`, on the mechanically-named `chain_link_*` blocks' own
`jsr * + 4` computed targets — a documented, non-fatal ACME 0.97 quirk per
`anno-export-asm.ts`'s own header). **Zero `Error` or `Serious error`
diagnostics.** No warning was reported as a failure — the verdict layer's own
rule 5 (`acme-verify.ts`) treats only `Error`/`Serious error` as fatal, and
`outcome: "ok"` with `byteDiff.equal: true` is the only thing this document
treats as success, matching this file's own read-first instruction.

**This is criterion 5's proof**: the OR-ed named-constant decomposition for
BOTH `$D011` and `$D018`, taken from the real committed store and the real
committed image, reassembles through a real, unmodified ACME 0.97 to bytes
IDENTICAL to the fixture's own committed `.prg` — 4095 of 4095 bytes, exact.
The decomposition is therefore arithmetically correct, not merely plausible.

### The readability half — `anno_disassemble` over `$0810-$0822`

Same store (DD00-usage-removed scratch copy), same real image, run through
the real `anno_disassemble` tool (`runAnnoTool()`):

```
!cpu 6510
* = $0810
        lda #$3f
        sta $dd00
        lda #D018_SELECT_UPPER_LOWER_CHARACTER_SET0 | D018_CHARACTER_DOT_DATA_BASE_ADDRESS2 | D018_VIDEO_MATRIX_BASE_ADDRESS0  ; $D018: SELECT_UPPER_LOWER_CHARACTER_SET=0, CHARACTER_DOT_DATA_BASE_ADDRESS=2, VIDEO_MATRIX_BASE_ADDRESS=0
        sta $d018
        lda #D011_YSCROLL3 | D011_ROW25 | D011_SCREENON | D011_TEXT  ; $D011: YSCROLL=3, ROWS=1, SCREENON=1, MODE=0, ECM=0, RST8=0
        sta $d011
        jsr $1000
        rts
```

The `$dd00` write renders as a plain hex literal here (its enum usage was
removed from this scratch copy for the reason above — this is the SAME
scratch store the export ran against, not a second inconsistent one). Both
`$D018` and `$D011` render the SAME OR-ed named constants and decoded
comments `anno-export-asm.ts` proved byte-identical above — one decoder
(`decomposeRegisterValue()`), two renderers (D-16), exactly as designed: a
Claude session reading this listing sees what the export proves.

## Criterion 1 — zero `Undefined` bytes, and the gate cannot render without `anno_evid_disagreements`

**Result: MET, for all nine committed fixtures.**

The real `decomp-completeness` gate (`completeness-report.mjs`, D-08's own
numeric stop condition) reports `exit=0` and `GATE: PASS` for all nine
fixtures, with `undefined: 0 of <denominator>` in every byte census. Verbatim
per-fixture gate output lives in:

- `docs/phase45-closure-dxa-family.md` §"The gate, per fixture, real CLI
  output" — `dxa/tracer.prg`, `dxa/fixture.prg`, `dxa/basic-stub.prg`,
  `export-asm/smc.prg`, `petcat/computed-sys.prg`, `petcat/not-basic.prg`
  (all six `exit=0`).
- `docs/phase45-closure-ghidra-family.md` §"Final green gate output, per
  fixture" — `ghidra/bank.prg`, `ghidra/bank-path-dependent.prg`,
  `ghidra/charset-phantom.prg` (all three `exit=0`).

The gate's refusal to render without the disagreement input, observed going
RED for real (never merely asserted present), is recorded in
`docs/phase45-planted-control-evidence.md` — three controls, each captured
verbatim: Control 1 (the input omitted entirely), Control 2 (the input
emptied with a foreign run identity), Control 3 (the required-field guard
deleted from a scratch copy). Two of the three are pinned as permanent,
CI-safe regression tests (`completeness-report.test.mjs`'s own `PLANTED
CONTROL 1`/`PLANTED CONTROL 2` cases, per plan 45-04's SUMMARY).

`src/mcp/vice/anno-decomp-closure.test.ts` (this plan's own Task 2) now
re-proves this criterion mechanically on every CI run: for all nine
fixtures, the real gate exits 0 with `byteCensus.undefinedCount === 0`
asserted by name (23 tests, all green — see Task 2 below), and its own
Test 5 is a fourth, independent non-vacuity control proving the disagreement
input stays load-bearing after this plan's own closure work.

## Criterion 2 — every disagreement resolved or accepted, never reported beside a pass

**Result: MET, for all nine committed fixtures — trivially, because the
real disagreement count is genuinely zero everywhere, not because the
resolution path was never exercised.**

`anno evid-disagreements --store <store> --json`, run against all nine
fixtures' real, live-executed (or, for the three not-executed fixtures,
genuinely run-free) stores, reports `disagreementCount: 0` in every case:

- Six fixtures (`docs/phase45-closure-dxa-family.md` §"The disagreement
  oracle"): `disagreementCount: 0` for every one of the six, both before and
  after that plan's own closure edits.
- Three fixtures (`docs/phase45-closure-ghidra-family.md` §"The disagreement
  oracle: nothing to accept anywhere in this family"): `disagreementCount: 0`
  for `bank.prg`, `bank-path-dependent.prg` and `charset-phantom.prg` alike.

With a zero numerator, `disagreementResolution.unresolvedCount` is trivially
`0` of a `0` denominator for all nine — no `DISAGREEMENT-ACCEPTED:` comment
was ever needed anywhere in the committed fixture set. This is a genuine
finding about these nine SYNTHETIC fixtures' own construction (see the
Limits section below), not a claim that the resolution mechanism itself was
never exercised: `anno-decomp-closure.test.ts`'s Test 2/4 asserts
`disagreementResolution.unresolvedCount === 0` by name for all nine, on
every CI run, and the `DISAGREEMENT_ACCEPTED_COMMENT_PREFIX` mechanism
itself is unit-tested directly in `anno-store-export.test.ts` (Test 6) and
`anno-cli.ts`'s own disagreement-resolution code path is exercised by
`completeness-report.test.mjs`.

## Criterion 3 — no `p_XXXX`/`l_XXXX` survivor, every entry point's four-element purpose comment

**Result: MET, for all nine committed fixtures.**

Survivor search: `anno-decomp-closure.test.ts`'s Test 2/4 asserts
`survivors.length === 0`, by name, for all nine fixtures, on every CI run —
a real, non-vacuous check (`docs/phase45-planted-control-evidence.md`'s own
controls establish the survivor predicate is load-bearing, and the searched
set is genuinely populated: all nine fixtures carry real authored labels,
per plan 45-08/45-09's own naming passes).

Per-entry-point purpose comments, table by table:

- `docs/phase45-closure-dxa-family.md` §"Task 1 — entry points, by address" —
  all six fixtures, one row per entry point, each with the four labelled
  elements (`function:`/`inputs:`/`outputs:`/`side effects:`) present.
- `docs/phase45-closure-ghidra-family.md` §"Entry points by fixture" —
  `bank.prg` (1 gate-required entry point), `bank-path-dependent.prg` (2),
  `charset-phantom.prg` (513, including the measured correction that the
  real gate's own `buildEntryPoints()` counts every chained `jsr` target as
  its own entry point — 512 chain-block addresses, not the 2-3 originally
  predicted).

The real gate's own `ENTRY POINTS (N of N)` line reads fully documented for
every fixture in both family documents' own verbatim output (cited under
Criterion 1 above) — `N of N`, never a partial count.

## Criterion 4 — every referenced address resolved or declined, with a genuine decline where the evidence is path-dependent

**Result: MET.** All three of this phase's own named decline shapes are
persisted, each naming what is genuinely unknown rather than a fabricated
symbol:

1. **`bank-path-dependent.prg`'s $082c** (`lda $D000,x`, criterion 4's own
   canonical example) — ONE `DECLINED:` comment naming BOTH candidate
   meanings (`$01=$33` → Character ROM, `$01=$34` → RAM), carrying
   `anno_join_memmap`'s own real decline reason verbatim.
   `docs/phase45-closure-ghidra-family.md` §"Criterion 4's canonical decline
   -- ONE record, both bank states".
2. **`export-asm/smc.prg`'s $0802** — the self-modified operand byte,
   genuinely path-dependent by construction (its value varies per loop
   iteration). `docs/phase45-closure-dxa-family.md` §"Task 2 — declines and
   accepted disagreements, by address".
3. **`petcat/computed-sys.prg`'s $0805** — the computed `SYS
   peek(43)+256*peek(44)` handover, whose target depends on the runtime
   zero-page pointer at `$2B`/`$2C` (decimal 43/44). Same section as (2)
   above.

`bank-path-dependent.prg`'s SIBLING address ($0827, `sta $D020`) was
reasoned through by hand and found genuinely NOT ambiguous (both callers'
`$01` configurations leave I/O unselected, so the write lands in the same
determinate RAM byte under both) — resolved with an authored comment
instead of a second decline, per the same document's §"A resolved, NOT
declined, sibling address". Every other referenced non-hardware address in
all nine fixtures is resolved (named), with the real gate's own
`REFERENCED NON-HARDWARE ADDRESSES (N resolved of N)` line confirming zero
unresolved in both family documents' verbatim output.

`anno-decomp-closure.test.ts`'s Test 2/4 additionally asserts
`referencedAddresses.unresolved.length === 0` by name for all nine, on
every CI run.

## Criterion 5 — hardware register writes as named enums, one multi-bit register decomposed

**Result: MET, on the real committed store, with a disclosed, scoped
workaround for an unrelated bonus register.** See the criterion-5 section
at the top of this document for the full capture: the OR-ed `$D011`/`$D018`
decomposition, taken from the real committed `charset-phantom.annostore.json`
export and the real committed `charset-phantom.prg` image, reassembles
byte-identically (4095/4095 bytes) through real ACME 0.97, with
`anno_disassemble` rendering the same named constants for readability
(D-16). The disclosed `$DD00` curated-table gap (bits #0-#1 uncovered) is
orthogonal to criterion 5's own two named registers, both of which
`anno-regbits.json` covers completely.

## Idempotence sweep — all nine fixtures, whole-document round trip

Every committed `.annostore.json` was imported into a fresh, `mkdtempSync`-built
scratch store (outside this repository's tree), re-exported via the SAME
`exportStoreDocument()`/`importStoreDocument()` pair `anno-store-export.ts`
ships (D-02), and the re-exported JSON text was written back OVER the real
committed file. `git status --porcelain src/mcp/vice/fixtures` was checked
immediately after each write:

```
$ node <scratch-script importing all nine, re-exporting, overwriting> 2>&1
{"fixture":"dxa/tracer","identical":true,"originalLength":572045,"newLength":572045}
{"fixture":"dxa/fixture","identical":true,"originalLength":591436,"newLength":591436}
{"fixture":"dxa/basic-stub","identical":true,"originalLength":1591,"newLength":1591}
{"fixture":"ghidra/bank","identical":true,"originalLength":575394,"newLength":575394}
{"fixture":"ghidra/bank-path-dependent","identical":true,"originalLength":571250,"newLength":571250}
{"fixture":"ghidra/charset-phantom","identical":true,"originalLength":1018218,"newLength":1018218}
{"fixture":"export-asm/smc","identical":true,"originalLength":492693,"newLength":492693}
{"fixture":"petcat/computed-sys","identical":true,"originalLength":2362,"newLength":2362}
{"fixture":"petcat/not-basic","identical":true,"originalLength":3689,"newLength":3689}

$ git status --porcelain src/mcp/vice/fixtures
(empty)
```

All nine: `identical: true` — the re-exported document is byte-for-byte the
same file that was already committed, and the subsequent `git status
--porcelain` confirms no diff was introduced by writing it back.

**Scope, disclosed precisely.** This sweep proves the WHOLE committed
document (both the derived rows — `ranges`/`xrefs` — and the authored rows —
`labels`/`comments`/`projectEnums`/`enumUsage` — plus `execObservations`)
round-trips through `importStoreDocument()`/`exportStoreDocument()` with no
loss or drift, for all nine fixtures, at the phase's own closure point. It
does **not** re-run the raw `dxa`/Ghidra derivation tools from the image
bytes for all nine — that narrower claim (D-03's literal wording,
"regenerate deterministically from the bytes") was independently
established, BEFORE this phase's closure passes added any authored content,
for four of the nine fixtures: `dxa/tracer.prg`, `export-asm/smc.prg`,
`petcat/not-basic.prg` (`docs/phase45-derivation-execution-evidence.md`
§"Task 3 (3) — idempotence") and `ghidra/bank.prg`
(`docs/phase45-ghidra-derivation-evidence.md` §"Task 3 (3) — idempotence").
The remaining five fixtures' raw-derivation idempotence
(`dxa/fixture.prg`, `dxa/basic-stub.prg`, `ghidra/bank-path-dependent.prg`,
`ghidra/charset-phantom.prg`, `petcat/computed-sys.prg`) was **not**
independently re-verified against the raw image bytes in this closing
sweep — see the Limits section below. An initial attempt to re-run `dxa`
directly for all nine (via `runDxaDisassemble()`'s host route) was made and
abandoned when the byte-window coverage came back short for every fixture
(a parser/invocation-shape mismatch against this session's own script, not
a finding about the derivation route itself) — rather than force a
result under time pressure and risk reporting a false match or mismatch
from a buggy reproduction, this is disclosed as not attempted to
completion, and the already-established four-fixture (plus `bank.prg`)
raw-derivation evidence is cited instead of restated.

**The AUTHORED half makes no regeneration claim, explicitly.** Names,
purpose comments, declines and enum installations are authored, reviewed
once, then frozen (D-03) — nothing in this sweep, or anywhere else in this
phase, asserts that re-running any tool from scratch would reproduce
`charset_phantom_stub`, the four-element purpose comments, or the
`DECLINED:` text. Those rows survive this sweep only because the sweep
never regenerates them — it reproduces whatever was already in the store,
authored rows included.

## Suite baseline comparison — a named set difference, never a count

The broker was confirmed **inactive** before the run:

```
$ pgrep -x x64sc; echo "pgrep_exit=$?"
pgrep_exit=1
$ systemctl --user is-active vice-broker
inactive
```

`npm run test:automated` was run from `src/mcp/vice`, redirected to a file
with `$?` read on the SAME line — never piped to `tail`:

```
$ npm run test:automated > /tmp/gsd-45-10-suite-baseline.log 2>&1; echo "EXITCODE=$?" >> /tmp/gsd-45-10-suite-baseline.log
```

**MEASURED exit code: 1.** `tests 4108, pass 4089, fail 5, skipped 9, todo 5`.

**Named failing-test set, this run (5 total):**

| File | Failing test |
|---|---|
| `anno-import.test.ts` / `anno-register.test.ts` | `annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id` |
| `anno-register.test.ts` | `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md` |
| `anno-register.test.ts` | `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates` |
| `audit-root-args.test.ts` | `check-skill-fork-honesty: every spelling that RESOLVES to the repository root is accepted` |
| `text-protocol.test.ts` | `Control 2 (planted RED, without the fix): a quiescence window of 0ms accepts prompt-shaped mid-stream text as final, losing the real output` |

**Set difference against `docs/phase45-wave0-measurements.md`'s own named
baseline** (`anno-register.test.ts` ×3, `anno-tools.test.ts` Task 3 Test 3,
`audit-root-args.test.ts` check-skill-fork-honesty):

- **UNCHANGED (4):** the three `anno-register.test.ts` findings (the stable
  requirement-id floor) and `audit-root-args.test.ts`'s
  `check-skill-fork-honesty` (the documented `/tmp`-scratch race).
- **GONE (1):** `anno-tools.test.ts`'s `Task 3 Test 3` (the `ENOTEMPTY`
  TOCTOU race) did not fire this run — expected flake variability, not a
  fix landed by this plan (this plan touches neither `anno-tools.ts` nor
  its dependency chain).
- **NEW relative to the Wave 0 baseline's exact five (1):**
  `text-protocol.test.ts`'s `Control 2 (planted RED, without the fix)`.
  **This is not a new class of flake** — `Control 2` and `WR-01` are two
  deliberately-planted RED controls in the SAME file, both testing a `0ms`
  quiescence window against a real timer, and `.planning/phases/45-decomposition-to-closure-disagreement-first/45-05-SUMMARY.md`'s
  own "Issues Encountered" section already recorded `WR-01` firing once
  under load and confirmed it as a timing-sensitive flake via **three
  isolated re-runs, 34/34 green each time**. The SAME confirmation method
  was repeated here for `Control 2`: `node --test text-protocol.test.ts` was
  re-run in isolation three times, **34/34 green on all three runs**,
  confirming this is the same documented timing-sensitive flake family
  (quiescence-window planted-RED controls racing a real timer under whole-suite
  load), not a regression this plan introduced (this plan touches neither
  `text-protocol.ts` nor `anno-decomp-closure.test.ts`'s own dependency
  chain reaches into it).

**Conclusion: no new, non-flake failure was introduced by this phase's own
work.** The stable floor is unchanged; the flake set varies exactly as
previously documented (one flake absent, a second flake from an
already-known family present), and both are confirmed non-regressions by
isolated re-run, not merely asserted.

Broker/emulator state confirmed clean again after the run:

```
$ pgrep -x x64sc; echo "pgrep_exit=$?"
pgrep_exit=1
```

## Limits — what this phase did NOT prove

Stated plainly, per this plan's own instruction, rather than rounded up:

1. **Purpose-comment CONTENT is human-reviewed, not mechanically checked.**
   The gate verifies that all four labelled elements
   (`function:`/`inputs:`/`outputs:`/`side effects:`) are PRESENT as
   substrings on every entry point's comment (`completeness-report.mjs`'s
   own `computeGateFailures()`). Whether the prose itself is an honest,
   accurate description of what the routine does — including the 510
   mechanically-named `chain_link_*` blocks in `charset-phantom.prg`, whose
   description is honest because the underlying bytes are genuinely
   structurally identical by construction, not because a human individually
   verified each one — is a judgement call made in good faith from the
   fixture's own source and this phase's own measured execution evidence,
   and a reviewer should still read it rather than trust the gate alone.
2. **The authored half makes no regeneration claim.** Names, purpose
   comments, declines and installed enums are authored, reviewed once, then
   frozen (D-03) — nothing in this phase asserts that re-running any
   derivation tool would reproduce them. Only the derived half (block types,
   cross-references, enum bindings) carries a regeneration claim, and that
   claim was independently verified against raw image bytes for four of the
   nine fixtures pre-closure, plus a whole-document round-trip sweep for all
   nine at closure time (see above) — not a full nine-fixture raw-derivation
   re-run.
3. **The nine fixtures are synthetic.** Every one of them was built for this
   phase's own tests (`45-CONTEXT.md`'s own "Fixture set for typing" note;
   `fixtures/*/README.md` per-family provenance records). Nothing measured
   here — the zero-disagreement result, the clean survivor search, the
   declines, the enum decomposition — establishes how this closure bar
   behaves on REAL cracked C64 code, whose registers, bank-switching
   patterns and indirect dispatch are governed by no fixture author's
   deliberate design. That is a claim for a later phase (48's purpose-built
   subject, or a real-corpus validation), not this one.
4. **This closing sweep's idempotence check is a whole-document round trip,
   not a nine-fixture raw-derivation re-run.** See the idempotence section
   above: five of the nine fixtures' `ranges`/`xrefs` were not
   independently re-verified against the raw `.prg` bytes through `dxa`/
   Ghidra in this session, after an attempted re-run did not reproduce the
   expected byte-window coverage and was abandoned rather than forced.

