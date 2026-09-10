# Phase 45 plan 45-01 — Wave 0 measurements

**MEASURED** 2026-09-10, on this host, against genuine tool installs (never
installed by this session — detected, per the project's standing "detect,
then refuse by name" convention).

This document records the two Wave 0 measurements `45-VALIDATION.md`
requires, plus the end-to-end tracer.prg spine run they were taken from.

## Tool availability (MEASURED, detected, never installed)

| Tool | Detected | Path / version |
|---|---|---|
| `x64sc` (stock VICE) | yes | `/usr/bin/x64sc` (genuine unpatched stock; `/usr/local/bin/x64sc` shadows it earlier on `$PATH` and is the custom fork — the absolute path was used throughout) |
| `dxa` (vendored) | yes | `src/mcp/vice/vendor/dxa/dxa`, sha256 `0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523` per `fixtures/dxa/README.md` |
| Ghidra `analyzeHeadless` | yes | `GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`, the `C64NmosLanguage` extension already installed under `Ghidra/Extensions/` |
| ACME | yes (not newly needed this plan) | `/home/henrik/.local/bin/acme`, release 0.97 ("Zem") |

## MEASUREMENT A — the real label population

Derived `dxa/tracer.prg` through the real spine (dxa disassemble → typed
ranges; Ghidra flat64k analyze → `anno_import_ghidra_export`) into a fresh
scratch store, then called `anno_get_symbols` with an explicit
`max_results: 1000`. Verbatim result:

```json
{"store":".../tracer.annostore","symbols":[],"returned":0,"matched":0,"truncated":false}
```

**MEASURED: zero labels.** This CONFIRMS RESEARCH.md Assumption A1's own
prediction exactly — derivation (dxa's byte-level code/data classification
via `setDataType`, Ghidra's cross-reference import via
`anno_import_ghidra_export`) writes typed ranges and cross-references only,
never names. `anno-import.ts`'s import route calls `putXref()` and nothing
else; there is no label-writing code path in it at all. Ghidra's own export
for this fixture additionally reported `REFERENCE_COUNT 0` and
`DECOMPILE_ZERO_FUNCTIONS true` — genuinely measured, not assumed: this
23-byte fixture has no JSR/JMP and no address Ghidra's own auto-analysis
recognised as a function entry (no entry point was seeded via
`entrypointsPath` for this run), so its cross-reference import is real but
vacuous for this particular fixture. This is a legitimate, honest finding
about `tracer.prg`'s own trivial shape, not a defect in the derivation route.

### The FROZEN survivor prefix set (decided from this measurement)

Because the measurement confirms zero labels exist to inspect, none of the
candidate prefix shapes (the eleven `AUTO_NAME_PREFIX_RE` prefixes, dxa's
`lNNNN`, Ghidra's `FUN_XXXX`) can be *positively* confirmed against a
populated store this session — there is nothing populated to check them
against. The measurement therefore does not CONTRADICT RESEARCH.md
Assumption A1; it CONFIRMS the premise A1 was built on (derivation writes no
labels) without adding new positive evidence for the exact regex shape
itself. Given that, the frozen set is decided exactly as RESEARCH.md §2
recommended, with the reasoning restated here as the decision record
`src/mcp/vice/anno-cli.ts` cites:

**FROZEN**: the eleven `AUTO_NAME_PREFIX_RE` prefixes (`zpf_ f_ zpa_ a_ p_
zpp_ e_ j_ s_ b_ r_`, imported from `anno-coverage.ts`, never restated —
`grep -ac 'zpf_' src/mcp/vice/anno-cli.ts` returns 0) **plus** an anchored,
case-sensitive `^l_[0-9a-f]{4}$` (an underscored form no current tool emits,
kept as the literal shape criterion 3's own prose names) **plus** two
defensive, anchored, case-sensitive extras for real tool output that no
import route carries through today but might in the future:
`^(FUN|LAB)_[0-9a-f]{4}$` (Ghidra's own default function-naming convention,
MEASURED at `fixtures/ghidra/charset-phantom-minted-labels.json`) and
`^l[0-9a-f]{3,4}$` (dxa's own real, no-underscore listing convention,
MEASURED at `dxa-listing.test.ts:52`, `l810`/`l8bf`/etc.). All anchored at
both ends — unlike `AUTO_NAME_PREFIX_RE`'s prefix-only match — because these
shapes are short enough that an unanchored match would false-fire on a
legitimate longer authored name (`player_x_pos`, `bank_switch_handler`).

Case-sensitivity precedent: `l_0810` IS a survivor, `L_0810` is NOT (mirrors
`anno-coverage.test.ts`'s own `L_` exclusion, restated for this phase's own
prefix set since `L_` was never one of the eleven `AUTO_NAME_PREFIX_RE`
prefixes to begin with).

This set is implemented identically (by necessity, not preference — see
`completeness-report.mjs`'s own header) in two places: `anno-cli.ts`'s
`isSurvivorLabelName()` (used by the verb to compute the real `survivors`
list from a live store) and `completeness-report.mjs`'s `isSurvivorName()`
(exported so the report script's own tests can assert on the predicate
without a live store). Both cite this document by path in their own header
comments; a future change to the frozen set must move both together.

## MEASUREMENT B — the suite failure baseline

The broker was confirmed **inactive** (`systemctl --user is-active
vice-broker` → `inactive`) and no `x64sc` process was alive (`pgrep -x
x64sc` → empty) before the baseline run. `npm run test:automated` was run
from `src/mcp/vice`, **redirected to a file**, with `$?` read on the same
line — never piped to `tail`:

```
npm run test:automated > /tmp/test-automated-baseline.log 2>&1; echo "EXITCODE=$?" >> /tmp/test-automated-baseline.log
```

**MEASURED exit code: 1.** **MEASURED named failing-test set (5 total,
compare the SET, never the count):**

| File | Failing test |
|---|---|
| `anno-register.test.ts` | `annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id` |
| `anno-register.test.ts` | `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md` |
| `anno-register.test.ts` | `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates` |
| `anno-tools.test.ts` | `Task 3 Test 3: the store file replaced between the existence check and the open refuses by name, writing nothing` (`ENOTEMPTY` on a `/tmp` scratch-dir race — a timing flake, not a regression) |
| `audit-root-args.test.ts` | `check-skill-fork-honesty: every spelling that RESOLVES to the repository root is accepted` |

This matches this project's own previously-recorded pattern almost exactly:
a stable 3-failure floor in `anno-register.test.ts` (the register cites
requirement ids no longer declared in a live `REQUIREMENTS.md` — an
inherited, disclosed debt item, not new), plus two named flakes OUTSIDE that
file (`anno-tools.test.ts`'s TOCTOU race and `audit-root-args.test.ts`'s
scratch-fixture race, both previously documented as intermittent, non-broker,
`/tmp`-timing-dependent). **This named set — not the bare count — is the
baseline every later plan in this phase compares its own suite runs against.**

## Task 1 — the rendered tracer.prg completeness report (real, end to end)

Derivation summary: dxa disassembled `fixtures/dxa/tracer.prg` (window
`$0801-$0815`, matching `fixtures/dxa/README.md`'s own MEASURED listing
exactly) → `setDataType()` wrote `$0801-$080f` as `byte` and `$0810-$0815`
as `code` → Ghidra (flat64k route, processor `6502:LE:16:nmos`) analyzed the
same bytes and its `GhidraStructExport.java` export was imported via
`importGhidraExport()` (0 xrefs written — genuinely measured, see
Measurement A) → a task-scoped broker (spawned as a plain child process,
this script's own lifetime, torn down in the same run — never `setsid`,
never a standing unit) launched genuine stock `x64sc` → `AUTOSTART` loaded
and ran `tracer.prg` for real → an exec checkpoint at `$0815` (the `RTS`)
stopped the machine, one `ADVANCE_INSTRUCTIONS` step retired the `RTS` itself
→ `memmapshow` was captured over the text channel (1,651,493 bytes) →
`anno_evid_ingest` wrote 1,994 real observation rows, keyed by the REAL
launch argv (transcribed from the broker's own `launching ...` stderr line,
never rebuilt) and image sha256 `875c96218be61538bc71cf6986e37af0e8bc7e4669c85759bb1813f4a689b8a5`.
The broker and every `x64sc` process were confirmed gone after the run
(`pgrep -x x64sc` empty, `systemctl --user is-active vice-broker` →
`inactive`).

**Real per-address MEASURED execute evidence at `$0810-$0815`** (from the
real `memmapshow` capture, addresses in decimal — `2064`=`$0810` etc.):
`$0810` (LDA opcode byte) `execute:true`; `$0811` (operand) `execute:false`;
`$0812` (STA opcode byte) `execute:true`; `$0813`/`$0814` (operands)
`execute:false`; `$0815` (RTS) `execute:true` — exactly the three opcode
bytes, never the four operand bytes, matching real 6502 execute semantics.

`anno evid-disagreements --store <store> --json` (real answer, this run):

```json
{
  "store": ".../tracer.annostore",
  "runIdentity": {
    "imageSha256": "875c96218be61538bc71cf6986e37af0e8bc7e4669c85759bb1813f4a689b8a5",
    "argvDigest": "c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864",
    "seed": "phase45-01-tracer-fixed-seed"
  },
  "disagreements": [],
  "disagreementCount": 0,
  "agreementCount": 3,
  "blockCoveredNeverObservedCount": 18,
  "observedOutsideAnyBlockCount": 1991,
  "observedAtUndefinedBlockCount": 0,
  "denominator": 21,
  "positiveClass": "code",
  "tier": "runtime-observed"
}
```

`anno decomp-completeness --store <store> --disagreements <above> --manifest
fixtures/decomp-execution-manifest.json` (real rendered report, this run):

```
decomp-completeness: .../tracer.annostore
  FIXTURE: dxa/tracer.prg
  EXECUTED: this fixture was run under Phase 33's reproducible-run protocol.

  BYTE CENSUS (denominator 21)
    byte: 15 of 21
    code: 6 of 21
    undefined: 0 of 21

  SURVIVORS (0)
    none

  DISAGREEMENTS (0 of 21)
    none
  AGREEMENT: 3 of 21
  NO OBSERVATION: 18 of 21 -- an address never observed executing proves NOTHING about what it is; absence is not evidence for or against any classification.

  Read every figure above against the others, never combined into one -- together they name what this store's block table covers, never what the program actually is.
```

The same shape, through `routine-queue-walker/scripts/completeness-report.mjs`
(the skill script itself, spawning the resolved `vice-proxy.ts`), reproduces
byte-identically.

### The refusal — omitting `--disagreements`

```
$ anno decomp-completeness --store <store> --manifest <manifest>
decomp-completeness: --disagreements FILE is required -- there is no default and no empty-array substitute; omitting the disagreement input must never render the same report as a real, empty answer (D-09).

exit=1
```

No report body was printed on this run — captured directly, not asserted.
The same refusal, through the skill script, prints:

```
completeness-report.mjs: anno decomp-completeness exited 1: decomp-completeness: --disagreements FILE is required -- there is no default and no empty-array substitute; omitting the disagreement input must never render the same report as a real, empty answer (D-09).
exit=1
```

### The anti-vacuity refusals (real, observed)

A `--disagreements` document whose `runIdentity` was replaced with a
fabricated triple (`imageSha256`/`argvDigest` of all-zero/all-one digests,
`seed: "fabricated"`) was refused, naming the unmatched identity:

```
decomp-completeness: the --disagreements document's run identity (image_sha256=00...00, argv_digest=11...11, seed="fabricated") matches no row in <store>'s own evid-runs table -- a fabricated or foreign document is refused, never rendered.
exit=1
```

A `--manifest` naming an empty fixture list was refused, naming the missing
fixture:

```
decomp-completeness: no fixture matching store "tracer.annostore" (stem "tracer") is listed in the manifest <empty-manifest.json> -- an unlisted fixture is refused, never defaulted to "executed" (D-13).
exit=1
```

## Deviations recorded here (see SUMMARY.md for the full list)

- **[Rule 2] `evid-disagreements --json` now also carries `runIdentity`.**
  The shipped `EvidReconciliation` join has no run-identity field of its own
  (by design — it currently unions across whatever runs a store holds), so
  the anti-vacuity check D-09 mechanism 2 requires had nothing to validate
  against. `cmdEvidDisagreements()`'s `--json` branch now additionally calls
  `listObservedRuns()` and includes `runIdentity` (the SINGLE run's identity
  when the store holds exactly one, `null` otherwise) alongside the spread
  reconciliation fields — additive, never renaming or restructuring
  `EvidReconciliation` itself.
- **[Interpretive] dxa's own listing ranges, not `partitionByteDerived()`,
  feed `setDataType()`.** `partitionByteDerived()` (Phase 35's own
  ground-truth-only classifier) never assigns `code` by design (`certainCode`
  is always empty) — using it as the derivation route would leave the store
  with no code range at all, which would make the disagreement query
  structurally vacuous for every fixture. `runDxaDisassemble()`'s own
  `.map.ranges` (class `"code"`/`"data"`, dxa's real listing-derived
  classification) is the byte-derived source actually written, matching this
  phase's intent (derive first, then agent closure) rather than the letter
  of the plan's own shorthand.
