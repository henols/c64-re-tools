# Phase 23 — The outcome-line schema and measurement definitions

**Binding. Committed before any measurement exists.** Every literal name the rest of this
phase may emit is fixed here. A measuring plan that needs a name not declared below has
found a gap in the pre-commitment; it records that as an `## ACCEPTED LIMIT` in its own
evidence file and the findings document records an explicit override. **It does not invent
a name, and it does not edit this file.**

`DECISION-RULE.md` reads its inputs from the lines declared here. The two files are one
pre-commitment in two parts and share its frozen status.

---

## 1. Corpus release list (`corpus.releases[]`)

The corpus is modelled as a **list of releases with exactly one flagged canonical**, never
as a scalar image with a second bolted alongside.

The findings frontmatter carries `corpus.releases` as a YAML list. Each element has:

| Key | Type | Meaning |
|---|---|---|
| `release` | string | Operator-supplied release name/id, e.g. group + title + release number |
| `file_sha256` | string, 64 hex | sha256 of the shipped image as supplied (`.d64` or `.prg`) |
| `capture_sha256` | string, 64 hex | sha256 of the depacked flat 64K capture taken from it |
| `canonical` | boolean | Exactly one element in the list is `true` |

**Exactly one element carries `canonical: true`**, and that element is the one criterion 1's
rule inputs are computed over. The secondary release's numbers live in their own evidence
file and never gate (`DECISION-RULE.md` § *Hold-out precedence contract*).

**This supersedes the scalar phrasing in prior documents.** `23-RESEARCH.md` Pattern 2 and
`23-VALIDATION.md`'s verification map both proposed scalar `corpus.file_sha256` /
`corpus.capture_sha256` keys. With two releases those keys have no single correct value, and
adding a `corpus.file_sha256_secondary` beside them would reproduce the exact
canonical-image-centric model `recovery-schema.mjs` already exists in this codebase to
prevent. **The one-release case is the degenerate single-element list**, still carrying
`canonical: true`. Where this file and any prior document disagree, this file wins — it is
the pre-commitment; they are derived. The correction is carried into the findings document's
`## Corrections to prior documents` section.

---

## 2. Findings-document frontmatter keys

Fixed here, before `docs/phase23-real-release-gate-findings.md` exists.

| Key | Domain |
|---|---|
| `phase` | `23-the-real-release-gate-go-degrade-no-go` |
| `requirement` | the five ids: `PROOF-01`, `PROOF-02`, `PROOF-03`, `PROOF-04`, `PROOF-05` |
| `probe_date` | `YYYY-MM-DD` |
| `verdict` | one of `go`, `degrade`, `no-go` |
| `verdict_rule_applied` | matches `R[0-9]+` — the id of the first rule that fired |
| `corpus.releases[]` | the list schema in § 1 |
| `tools.dxa` | version + binary sha256 |
| `tools.ghidra` | version string only, never an install path |
| `tools.vice` | backend identifier (`fork` or `stock`) plus version |
| `criteria.*` | one key per `DECISION-RULE.md` rule input, carrying its recorded value |

The body reproduces the full rule and walks the actual outcome values through it, so a
reader mechanically re-derives the verdict rather than taking it on trust (D-10).

---

## 3. Outcome lines

Every rule input and every recorded fact is a bare `NAME: value` at **column 0** of a named
evidence file. Where a line is written more than once in one file, **the final occurrence
wins** — stated because Phase 9's own evidence carried a superseded early `INSTALLED_VERSION:`
line that was only resolved 106 lines later.

**Percentage value shape.** Every line whose name ends `_PCT` or `_FRACTION` carries
`<decimal> (<numerator>/<denominator>)` — e.g. `72.46 (100/138)`. The **rule input is the
leading decimal**; the parenthesised raw byte counts are the audit trail the precision
contract requires. No separate numerator line name exists, and none may be minted.

### Corpus and capture — `evidence/capture/CAPTURE-SUMMARY.txt`

| Line | Domain |
|---|---|
| `C0_CORPUS` | `pass` \| `partial` \| `could-not-run` |
| `CORPUS_RELEASES` | integer count of elements in `corpus.releases[]` |
| `CORPUS_CANONICAL` | the `release` string of the element carrying `canonical: true` |
| `CORPUS_FILE_SHA256` | 64 hex, one line per release, canonical first |
| `CAPTURE_SHA256` | 64 hex, one line per release, canonical first |
| `CAPTURE_SIZE` | integer bytes; `65536` for a well-formed flat capture |
| `CAPTURE_EQUIVALENT` | `yes` \| `no` \| `could-not-run` — two runs compared |
| `CAPTURE_HANDOFF_PC` | `$xxxx` — the entry handoff the capture broke at |
| `CAPTURE_PORT01` | `$xx` — the `$0001` value observed at the capture point |

### Instruments and the fixture baseline — `evidence/tools/TOOLS.txt`

| Line | Domain |
|---|---|
| `DXA_VERSION` | version string, e.g. `0.1.5` |
| `DXA_TARBALL_SHA256` | 64 hex |
| `DXA_TARBALL_SHA256_VERIFIED` | `yes` \| `no` |
| `DXA_BINARY_SHA256` | 64 hex of the built binary |
| `GHIDRA_VERSION` | version string **only**, e.g. `12.1.3 PUBLIC` build `2026-Aug-17` — never a path |
| `JAVA_VERSION` | version string |
| `VICE_BACKEND` | `fork` \| `stock`, plus version |
| `FIXTURE_DATA_RECOVERY_PCT` | percentage shape; the 279-byte fixture, reproduced not quoted |
| `FIXTURE_FALSE_POSITIVES` | integer count |
| `FIXTURE_FALSE_NEGATIVES` | percentage shape |
| `FIXTURE_TOTAL_BYTES` | integer |
| `FIXTURE_REPRODUCED` | `yes` \| `no` \| `could-not-run` |

### Inventory — `evidence/inventory/INVENTORY.txt`

| Line | Domain |
|---|---|
| `INV_SOURCE` | `vice-runtime-observation` — the D-06 assertion; no other value is valid |
| `INV_WINDOW` | explicit list of `$xxxx-$yyyy` ranges, ascending, never a percentage |
| `INV_WINDOW_BYTES` | integer — `\|W\|` |
| `INV_DISPATCH_SITES` | integer count |
| `INV_DISPATCH_SITE` | repeated: `$xxxx <kind> targets=<n> hits=<n>` |
| `INV_BANK_WRITE_SITES` | integer count of distinct `$01`-writing program addresses |
| `INV_BANK_VALUES` | space-separated `$xx` list of distinct observed `$01` values |
| `INV_HIT_CEILING` | integer, **declared before the run** |
| `INV_TERMINATION` | `saturation` \| `ceiling` |
| `INV_CERTAIN_CODE_BYTES` | integer — `\|C\|` |
| `INV_CERTAIN_DATA_BYTES` | integer — `\|D\|` |
| `INV_CODE_DATA_OVERLAP` | integer — `\|C ∩ D\|` |
| `INV_ADJUDICATED_FRACTION` | percentage shape |

### Provenance — `evidence/criterion1-provenance.txt`

| Line | Domain |
|---|---|
| `PROV_ANCHOR_OK` | `yes` \| `no` \| `could-not-run` |
| `PROV_RELEASES` | integer count diffed; `< 2` classifies nothing |
| `PROV_CRACKER_PATCH_BYTES` | integer |
| `PROV_CRACKER_PATCH_RANGES` | repeated `$xxxx-$yyyy` |
| `PROV_HOLDOUT` | `applied` \| `unavailable` \| `could-not-run` |

### Criterion 1 — `evidence/criterion1-dxa-classification.txt`

| Line | Domain |
|---|---|
| `C1_WINDOW` | the range list, identical to `INV_WINDOW` |
| `C1_WINDOW_BYTES` | integer |
| `C1_DXA_FLAGS` | the flag string verbatim, as invoked |
| `C1_DENOMINATOR_BYTES` | integer — `\|D\|` after the cracker hold-out |
| `C1_DATA_RECOVERY_PCT` | percentage shape — **rule input (R2, R5)** |
| `C1_FALSE_POSITIVES` | integer — **rule input (R2, R4)** |
| `C1_FALSE_NEGATIVES` | percentage shape — never a gate |
| `C1_ADJUDICATED_FRACTION` | percentage shape — **rule input (R3)** |
| `C1_CRACKER_HELD_OUT` | `yes` \| `no` |
| `C1_DATA_RECOVERY_PCT_WITH_CRACKER` | percentage shape — never a gate |
| `C1_FALSE_POSITIVES_WITH_CRACKER` | integer — never a gate |
| `C1_DETECT_INTERNAL_DATA_BYTES` | integer — the **primary** invocation |
| `C1_DETECT_ALL_DATA_BYTES` | integer — the second invocation, printed beside it |
| `C1_PARSE_ACCOUNTED_BYTES` | integer; must equal the image size or the parser refuses |
| `C1_CODE_DATA_OVERLAP` | integer — a finding, never a gate |

### Criterion 2 — `evidence/criterion2-ghidra-dispatch.txt`

| Line | Domain |
|---|---|
| `C2_COMPUTED_DISPATCH` | `resolved` \| `unresolved` \| `not-exercised` \| `could-not-run` — **rule input (R6)** |
| `C2_SITES_ENUMERATED` | integer, from the inventory, never from Ghidra |
| `C2_COMPUTED_SITES` | integer — sites meeting the runtime definition of *computed* |
| `C2_RESOLVED_TARGET` | `$xxxx`, or `none` |
| `C2_TRANSCRIPT` | relative path to the transcript |
| `C2_REFERENCE_COUNT` | integer references exported |
| `C2_CLASSIFICATION_LINES` | integer lines in the per-site classification table |

### Criterion 3 — `evidence/criterion3-bank-divergence.txt`

| Line | Domain |
|---|---|
| `C3_BANK_DIVERGENCE` | `found` \| `not-exercised` \| `could-not-run` — **rule input (R7)** |
| `C3_DIVERGENT_SITES` | integer — never a gate |
| `C3_DIVERGENT_SITE` | repeated: `$xxxx $v1=<resolution> $v2=<resolution>` |
| `C3_MEMMAP_SHA256` | 64 hex of the `memmap.json` the join resolved against |

### Criterion 4 — `evidence/criterion4-analyzer-audit.md`

| Line | Domain |
|---|---|
| `C4_CAPABILITIES_AUDITED` | integer |
| `C4_REPLACED` | integer — count of `replaced-by:` |
| `C4_LOST_ACCEPTED` | integer — count of `lost-accepted:`; never a gate |
| `C4_UNREPLACED_CAPABILITIES` | integer — count of `lost-blocking:`; **rule input (R8)** |

### The `not-exercised` value

`not-exercised` is a **declared value distinct from `pass`** for both
`C2_COMPUTED_DISPATCH` and `C3_BANK_DIVERGENCE`. No rule in `DECISION-RULE.md` maps it to
`go`: R6 and R7 both fire on it. It states a fact about the corpus — the construct was not
present to test — and it is earned only by the pre-committed inventory (D-05) showing the
construct absent. It is never a summary of a measurement that was not attempted; that is
`could-not-run`, which also fires R6 and R7.

---

## 4. Criterion 1 measurement definitions

The positive class is **data**. The denominator is **certain-data bytes**. These are the
fixture's own definitions, recovered by reproduction, so the D-11 side-by-side is
apples-to-apples.

| Term | Definition |
|---|---|
| `W` (window) | The explicit list of `$xxxx-$yyyy` ranges committed in the inventory, derived by § 5's rule. **Never expressed as a percentage of the image.** |
| `C` (certain code) | Bytes in `W` proven code by observed execution, or by being a JSR call site or a JSR call target |
| `D` (certain data) | Bytes in `W` proven data by VIC DMA derivation: the screen matrix at `screen_base`, the 8 sprite pointers at `screen_base+$3F8`, the charset or bitmap at `charset_base`, and the sprite bitmaps those pointers name |
| `U` (unadjudicated) | `W \ (C ∪ D)`. Reported as unclassified and **enters no ratio** |
| adjudicated fraction | `(\|C\| + \|D\|) / \|W\|` — a first-class number, not a footnote |
| data-recovery rate | (bytes in `D` that dxa typed as data) / `\|D\|` |
| false positives | count of bytes in `C` that dxa typed as **data** |
| false negatives | count of bytes in `D` that dxa typed as **code** |

**`C ∩ D` is a finding, not an error.** Self-modifying code and jump tables legitimately
produce bytes that are both executed and DMA-fetched. Reported by count on
`C1_CODE_DATA_OVERLAP` and **excluded from both ratios**.

**The fixture's reproduced baseline, for the D-11 side-by-side.** Positive class data,
denominator true-data bytes, on 279 bytes with a stated ground truth of 141 code / 138 data:
data recovery `100/138 = 72.46%`; false positives `0`; false negatives `38/138 = 27.5%`;
179 bytes emitted as instructions, 100 as `.byt`/`.word`, `179 + 100 = 279`. These are
**reproduced** by rebuilding the fixture and re-running dxa's own command line, not quoted
from the pivot note — reproduction is what makes the comparison honest.

---

## 5. Window derivation rule

`W` is:

- the union of the address ranges the loader was **observed writing**, plus the ranges
  **observed executing**;
- **minus** `$0000-$01FF` (zero page and stack);
- **minus** `$D000-$DFFF` (I/O);
- **minus** any range the capture shows as neither written by the loader nor executed.

It is committed as an explicit range list in the inventory, **before dxa is run**.

---

## 6. dxa flag set

Fixed here, not chosen after seeing the result.

**Primary invocation:**

```
dxa -g 0000 -p all-nmos6502 -d skip-scanning -t detect-internal -R <entrypoints> -B <datablocks> -a dump
```

| Flag | Why it is fixed to this value |
|---|---|
| `-g 0000` | **Mandatory.** dxa's default load-address detection reads the first two bytes of a flat capture as a little-endian load address, so a processor-port `$2F $37` re-bases the image to `* = $372f` and discards roughly 50K. The warning it prints goes to **stderr**, and stderr is kept as evidence. |
| `-p all-nmos6502` | The narrower instruction sets exclude exactly the illegal opcodes crack code uses. |
| `-d skip-scanning` | dxa's default `-d poor` "lists as much of the object as possible as program code, even if illegal instructions are present" — a large code-side bias over unreferenced RAM. |
| `-t detect-internal` | Declared the **primary**; the rule inputs are computed from this run. |
| `-R <entrypoints>` | The VICE-observed entry-point file. Non-circular: the entry points come from runtime observation, never from an engine under test. |
| `-B <datablocks>` | The data-block file, excluding `$0000-$01FF`, `$D000-$DFFF` and every range the inventory shows the loader never wrote. |
| `-a dump` | Every byte-emitting line is prefixed with its actual bytes, so counts are **read**, not inferred from mnemonic lengths. |

**Second invocation**, identical except `-t detect-all`. Its data-byte count is printed on
`C1_DETECT_ALL_DATA_BYTES` beside the primary's `C1_DETECT_INTERNAL_DATA_BYTES`. **Both
numbers are printed**; neither is chosen after the fact.

**Listing parser.** Matches `^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s+(.*)$` — a whitespace
class, **not** a literal tab, because `.word` lines are space-separated. Classifies by
whether the text begins `.byt` or `.word`. **Asserts the accounted byte total equals the
image size** (`C1_PARSE_ACCOUNTED_BYTES`), refusing rather than under-counting on an unseen
line shape.

---

## 7. Inventory schema (D-05 / D-06)

**The inventory is produced by VICE runtime observation and by nothing else.**
`INV_SOURCE: vice-runtime-observation` is the assertion of that. No fact used to judge dxa
or Ghidra may be produced by dxa or Ghidra.

The inventory records:

- **The `$01` write timeline** as `(cycle, PC, value)` triples, ordered by **non-decreasing
  cycle**, with equal-cycle hits kept in **observation order**.
- **The hit ceiling, declared before the run** (`INV_HIT_CEILING`), and whether the run
  ended by saturation or by the ceiling (`INV_TERMINATION`).
- **The distinct `$01` values observed** (`INV_BANK_VALUES`).
- **The enumerated dispatch sites**, one `INV_DISPATCH_SITE:` line each, carrying the
  address, the construct kind (`jmp-indirect`, `rts-trick`, `self-modified-jmp`), the count
  of distinct targets observed at that site, and the hit count.
- **The certain-code and certain-data byte sets**, and their counts.
- **The window `W`**.

**A site is *computed* iff it dispatches through two or more distinct values at the same
program address**, across the observed run. A site with **one** target across many hits is
the easy case and is recorded as such — never as a pass. This definition is evaluable by
VICE alone, which is what closes the circularity trap: without it, criterion 2 degrades to
"Ghidra resolved the dispatch that Ghidra found".

**Every divergent-site and dispatch-site table is sorted ascending by address**, so two runs
of the same derivation produce byte-identical tables.

---

## 8. Audit disposition vocabulary (PROOF-04)

Every audited `analyzer.rs` capability carries **exactly one** of:

| Disposition | Meaning |
|---|---|
| `replaced-by:<what>` | A named dxa or Ghidra facility does the same job |
| `lost-accepted:<cost>` | Not replaced; the cost of losing it is stated, and it is accepted |
| `lost-blocking:<what it breaks>` | Not replaced, and something in the milestone depends on it |

`C4_UNREPLACED_CAPABILITIES` is the count of the third, and it is R8's input.

The audit is **scoped to `analyzer.rs` only**. A capability found to live in `exporter/` or
`state/` is recorded as a **scope observation for Phase 25** rather than widening this phase.
`analyzer.rs` is read **offline** from the crate source; the external analyser is never executed
(D-01).
