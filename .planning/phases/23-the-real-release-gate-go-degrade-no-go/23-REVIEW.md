---
phase: 23-the-real-release-gate-go-degrade-no-go
reviewed: 2026-08-26T18:20:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - docs/phase23-real-release-gate-findings.md
findings:
  critical: 4
  warning: 5
  info: 2
  total: 11
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-08-26T18:20:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Phase 23 changed zero product code. The review scope passed by the workflow is a single
Markdown decision artifact, `docs/phase23-real-release-gate-findings.md`, reviewed against the
defect classes that matter for an artifact of this kind: internal contradiction, unsourced
values, verdict-derivation error, overstatement, and broken internal references.

**What holds up, verified mechanically and not by reading:**

- **The verdict derivation is correct.** `grep '^C0_CORPUS:' evidence/capture/CAPTURE-SUMMARY.txt`
  returns exactly one line, `C0_CORPUS: partial`, at column 0. `R1` fires on "`c0_corpus` is not
  `pass`" and is listed first under first-match-wins. No later rule is silently doing work; `R2`
  through `R8` are unreachable. `c4_unreplaced = 0` is correctly recorded as non-firing for `R8`
  and correctly excluded from the derivation.
- **The rule reproduced in the body is byte-identical to `evidence/DECISION-RULE.md`.** Stripping
  the `> ` prefix from lines 159-341 and diffing against the source produces zero output across
  183 lines. The tamper check the document invites actually passes.
- **The ordering proof reproduces exactly.** All three commands run today return what the
  document says they return: both fact-one queries name `474c37c`, and the fact-two query scoped
  to `474c37c` returns nothing.
- **Every arithmetic claim closes.** Criterion 4: `8+11+7=26`, `7+10+6=23`, `1+1+1=3`,
  `23+3+0=26`. Fixture: `97/134 = 72.39`, `37/134 = 27.61`, `94/131 = 71.76`, `100/138 = 72.46`,
  `145+131+3 = 279`. Every one matches a column-0 outcome line in
  `evidence/fixture/fixture-baseline.txt` or `evidence/tools/TOOLS.txt`.
- **Both recorded tool hashes verify against the artifacts on disk.** `sha256sum evidence/tools/dxa`
  returns `0e2bf1a5…f0ec8523` as recorded.
- **Frontmatter conforms to `SCHEMA.md` § 2** on every key, including exactly one
  `canonical: true`, and `tools.ghidra` carrying no install path.
- **No broken evidence reference.** Every cited `evidence/…` path either exists or is explicitly
  labelled absent/never-produced, and every "would have to be produced by a re-run" file is
  genuinely absent.
- **The `could-not-run` / `not-exercised` distinction is held rigorously throughout.** No
  `could-not-run` is presented as a pass anywhere, no fixture number is presented as a real-release
  number, and Finding A is explicitly and correctly disclaimed as not having changed the verdict.

**What does not hold up.** Four claims in the document are falsifiable by running a command or
listing a directory, and the two most serious are in the sections a future reader will actually
act on: the "Reproducing this" re-run instructions, and the statement of where the corpus lives.
The verdict itself is untouched by all of them — every defect is in the *durable record* around a
correct derivation, which is exactly where a decision artifact's value lives.

**Scope note carried forward:** the phase's only executable artifacts —
`evidence/dxa-listing-parse.mjs`, `evidence/fixture/fixture-baseline.mjs`,
`evidence/FlatVolatile.java` and `evidence/ExportAnalysis23.java` — live under `.planning/` and
are excluded from review scope by the workflow's own D-03 exclusion. **A clean result on any of
those four must not be inferred from this report. They were not reviewed.**

## Critical Issues

### CR-01: The "one measurement a re-run can reproduce today" does not reproduce, and cannot be run as written

**File:** `docs/phase23-real-release-gate-findings.md:1022-1035`

**Issue:** The document introduces this block as *"this is the one measurement a re-run can
reproduce today, because it needs no corpus"* and prints:

```
dxa -g 0000 -p all-nmos6502 -d skip-scanning -t detect-internal -R <entrypoints> -B <datablocks> -a dump fixture.prg
```

This is `SCHEMA.md` § 6's **flat-64K-capture** invocation with `fixture.prg` appended. It is not
what 23-02 ran, and it does not produce 23-02's numbers. I rebuilt the fixture with the
document's own `acme` line and ran both commands against the phase's own pinned `evidence/tools/dxa`:

| Command | Result |
|---|---|
| Recorded in `evidence/fixture/fixture-baseline.txt:50`: `dxa -U -p all-nmos6502 -t detect-all -a dump fixture.prg` | `code=179 data=100 total=279`, range `$0801-$0917` — **exactly** `PARSE_CODE_BYTES: 179` / `PARSE_DATA_BYTES: 100` / `PARSE_ACCOUNTED_BYTES: 279` / `PARSE_ADDRESS_RANGE: $0801-$0917` |
| The document's line, verbatim | **exit 2**, `dxa: Could not open <entrypoints>.` |
| The document's line with the unfillable `-R`/`-B` removed | `code=0 data=282 total=282`, range `$0000-$0117` |

Four independent defects, each verified in isolation:

1. **`-R <entrypoints>` / `-B <datablocks>` have no fixture-side value and never did.** Those files
   come from the VICE runtime inventory (D-05) that 23-05 was never dispatched to produce — the
   document says so itself at lines 429-433. The command is unrunnable as printed.
2. **`-g 0000` is wrong for `fixture.prg`.** `fixture.prg` is 281 bytes: a real 2-byte `$0801`
   load-address header plus the 279-byte image. Forcing base `$0000` decodes the header bytes as
   content and shifts every address. Alone it gives `code=183 data=98 total=281` — and
   `total=282`/`281` ≠ 279 is precisely the condition `SCHEMA.md` § 6 specifies the listing parser
   must **refuse** on. The narration at line 1031 ("`-g 0000` is **mandatory** on a flat capture")
   is true of a flat capture and false of this file; the two got conflated.
3. **`-d skip-scanning` alone destroys the classification**: `code=33 data=246`. Combined with the
   absent `-R` seeds it drives code detection to zero.
4. **`-U` (recorded, load-address-honouring) was dropped**, and the primary/secondary roles are
   inverted: line 1034 says *"The second invocation is identical except `-t detect-all`"*, but
   `-t detect-all` **is** the run that produced the recorded baseline. No `detect-internal` fixture
   number exists anywhere in the evidence tree (`grep -r detect-internal evidence/fixture/` returns
   nothing), so `C1_DETECT_INTERNAL_DATA_BYTES` and `C1_DETECT_ALL_DATA_BYTES` are both absent and
   the "both numbers are printed" protocol was never exercised on the fixture.

For a document whose stated purpose is re-derivability without any other file surviving, printing
a reproduce command that yields `code=0` where the record says `code=179` is the highest-cost
error in the artifact.

**Fix:** Replace the block with the invocation that was actually run and that reproduces the
recorded outcome lines, and move `SCHEMA.md` § 6's flat-capture flag set to a clearly separate
"for a future 64K capture, not for the fixture" note:

```
acme -f cbm -o fixture.prg -l fixture.lbl fixture.a
dxa -U -p all-nmos6502 -t detect-all -a dump fixture.prg     # -> 179 code / 100 data / 279 total, $0801-$0917
node evidence/fixture/fixture-baseline.mjs                   # ground-truth re-derivation + classification
```

and rewrite the `-g 0000` paragraph to say that it is mandatory **on a flat 64K capture and must
not be used on `fixture.prg`**, which carries a genuine load-address header — the opposite of the
hazard `-g 0000` exists to prevent.

---

### CR-02: "201 multi-bit divergences" is cited to a file that does not contain it, and appears nowhere in the evidence tree

**File:** `docs/phase23-real-release-gate-findings.md:772` (citation at `:781`)

**Issue:** Finding B's headline number is:

> Diffing the two `danish` handoff snapshots **directly, with no transcription anywhere**, still
> shows **201 multi-bit divergences**.

and the paragraph closes by attributing its numbers to
"(`evidence/capture/CAPTURE-SUMMARY.txt`; both comparisons are the tool's own output, pasted
verbatim in the capture records)".

`grep -rn '201' evidence/` returns two hits, both file sizes in a `ls -l` transcript. The number
`201` is not in `CAPTURE-SUMMARY.txt`, not in either capture record, and not anywhere else under
`evidence/`. Its only occurrence in the repository is line 54 of
`.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`
— a todo, which the document cites for Finding A but not for Finding B.

The other three numbers in the same paragraph (231, 100, 41) *do* trace to `CAPTURE-SUMMARY.txt`.
The effect is that a reader following the citation finds three of four numbers and silently
assumes the fourth. In a document whose opening sentence is "Nothing here is written from memory",
a headline value attributed to a file that does not contain it is a false provenance claim, not a
formatting slip.

Note also that 201 and 231 measure different things (snapshot-to-snapshot direct diff vs. live-to-
snapshot `vice_memory_compare` over `$0000-$CFFF`), and the paragraph presents them adjacently
with no statement that the comparanda differ.

**Fix:** Cite the number to its real source and state what it measures:

```markdown
Diffing the two `danish` handoff snapshots **directly, with no transcription anywhere**, still
shows **201 multi-bit divergences**
(`.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`,
a snapshot-to-snapshot diff over the full 64K — a different comparison from the 231-address
`vice_memory_compare` result below, which is live memory against a snapshot over `$0000-$CFFF`).
```

---

### CR-03: Claims a fourth VICE snapshot that was never saved, and generalises a one-snapshot verification to three

**File:** `docs/phase23-real-release-gate-findings.md:997-999`

**Issue:** Two overstatements in one sentence:

> What exists instead are four VICE `.vsf` snapshots banked outside the checkout
> (`danish_r1_handoff`, `danish_r2_handoff`, `saeger_r1_handoff` **and its sibling**), each proven
> faithful on reload.

1. **There is no fourth snapshot.** `grep -rn 'snapshot_save' evidence/` returns exactly four hits,
   one of which is `probe_frame_a` from the calibration run. Only three handoff snapshots were ever
   saved. `evidence/capture/capture-record-secondary.md` § *Comparison against sibling runs* states
   the reason explicitly: saeger run 2 was **not** banked — "run 1's instant was banked as a
   snapshot and run 2's live memory compared against it". The phrase "and its sibling" names an
   artifact that does not exist. (The upstream `CAPTURE-SUMMARY.txt:139-141` carries the same "four"
   while naming three; the findings document propagated the count and invented a name for the gap
   rather than catching it.)
2. **"each proven faithful on reload" is recorded for one of the three.**
   `capture-record-primary.md:433` verifies `danish_r1_handoff` (`$0000-$0001` reads back `EF 35`,
   `$8FF8` reads back the sprite pointers). No equivalent verification exists for
   `danish_r2_handoff` or `saeger_r1_handoff`.

This is not cosmetic. The sentence is the bridge into Finding A, whose whole value is that the
banked snapshots are a recoverable route to a real 64K image — the argument that `R1`'s "secure a
corpus first" branch "is materially cheaper than it looks". A re-run planning against four verified
instants will find three, one verified, and no saeger run-2 instant recoverable at all.

**Fix:**

```markdown
What exists instead are **three** VICE `.vsf` snapshots banked outside the checkout —
`danish_r1_handoff`, `danish_r2_handoff` and `saeger_r1_handoff`. `danish_r1_handoff` was proven
faithful on reload (`capture-record-primary.md`); the other two were not re-read after saving.
**saeger run 2's instant was never banked** — it was compared live against `saeger_r1_handoff`
(`capture-record-secondary.md` § *Comparison against sibling runs*) — so a re-run can recover at
most three of the four recorded instants by Finding A's route.
```

`evidence/capture/CAPTURE-SUMMARY.txt:139` carries the same "Four instants" error and should be
corrected in the same pass.

---

### CR-04: The document states twice that the corpus images are not in the repository; both `.d64` files are in the working tree

**File:** `docs/phase23-real-release-gate-findings.md:349`, `:818`, `:990`

**Issue:** Three assertions of the same false fact:

- `:349` — "the images live outside this repository and their paths are deliberately absent from
  this document"
- `:818` (correction 1) — "**The corpus was operator-supplied under D-04** and lives outside this
  checkout"
- `:990` — "**The corpus images are not in this repository.**"

Both images are inside the repository working tree, at the hashes the document records:

```
$ sha256sum .planning/phases/23-.../evidence/corpus/*.d64
1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5  evidence/corpus/danish.d64
b45e53e602fe94654934beffaa483f59989a6d3973ef054afaeea4ea4bc2b8f5  evidence/corpus/saeger.d64
```

They are untracked, matched by `evidence/corpus/.gitignore:13` (`*.d64`). The evidence tree records
their in-checkout location directly — `capture-record-primary.md:69` pastes the full absolute path
`/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-…/evidence/corpus/danish.d64`, and
`handoff-identification.txt:19` records a second path outside the repo.

The true and defensible claim is **"never committed"**, which the document also makes (`:348`) and
which git history confirms. "Not in this repository" is a materially different and stronger claim,
and it is wrong: the no-commit guarantee rests entirely on one nested `.gitignore` file, not on the
images being elsewhere. A future maintainer told the images are not here will not know two 174848-byte
files are sitting in the checkout depending on that one file staying correct.

**Fix:** Replace all three with the claim that is true and that the evidence supports:

```markdown
The corpus images are **never committed** (D-04) — `evidence/corpus/.gitignore` refuses every
binary image form. The operator-supplied copies used for this run are present in the working tree
at `evidence/corpus/danish.d64` and `evidence/corpus/saeger.d64`, untracked; identity in this
document is release name plus sha256 and does not depend on their location.
```

Correction 1's `:818` clause and `evidence/corpus/corpus-intake.txt:8` / `:1021` and
`evidence/capture/RELEASES.json:3` carry the same wording and should be corrected in the same pass.

## Warnings

### WR-01: Finding E was superseded by the phase's own `deferred-items.md` 19 minutes after it was written, and 23-11 ran afterwards without updating it

**File:** `docs/phase23-real-release-gate-findings.md:795-799`

**Issue:** Finding E presents a four-test "load-sensitive flake set" and concludes "A single red run
of that suite is not evidence that a `.planning/`-only change broke something."

`deferred-items.md` § *Orchestrator regression-gate reading — the "flake set" was mostly one live
broker* (recorded 2026-08-26, after 23-10 and before 23-11) supersedes exactly that characterisation:

- With the broker stopped, one full run is **completely green**: `# tests 2638 # pass 2593 # fail 0
  # skipped 40 # todo 5`, exit 0.
- **`2408` is not a flake** — it is deterministic and broker-caused, proven both directions with
  single-test runs, and filed as its own todo.
- Only `916` is confirmed load-sensitive; `159` and `2410` are left explicitly unresolved.
- Its stated conclusion is the opposite of Finding E's: "the gate result a later phase should carry
  forward is **green on a broker-free host**, not '1-4 varying failures'".

Timeline: the findings document's last commit is `7e01bd6` at 17:19; the superseding note landed in
`dc9f002` at 17:38; plan 23-11 ran 17:44-18:00 and closed the phase without touching the document.
This is also a direct violation of the phase's own binding convention 7 ("where a line is written
more than once, **the final occurrence wins**") — the document took the earlier characterisation.

**Fix:** Replace Finding E's body with the superseding reading, keeping the citation to
`deferred-items.md`:

```markdown
**Finding E — the phase's regression gate is green on a broker-free host; one test fails
deterministically when a broker is live.** Recorded in the phase's `deferred-items.md`
§ *Orchestrator regression-gate reading*, not fixed (phase 23 may not modify anything under
`src/`). With the broker stopped, a full run is `# tests 2638 # pass 2593 # fail 0`. Test `2408`
(BACK-05 D-G ordering) is **not** a flake — it fails deterministically whenever a live broker owns
the emulator, filed as its own todo. `916` is a confirmed load-sensitive flake; `159` and `2410`
remain unresolved. A plan that drives the emulator should expect exactly `2408` and not read it as
a regression.
```

---

### WR-02: "2592/2638 passing every time" is arithmetically impossible alongside the fail counts in the same sentence

**File:** `docs/phase23-real-release-gate-findings.md:797-798`

**Issue:** "Four consecutive full runs on an unchanged tree gave fail counts 1, 4, 1, 1 with the
failing test *identity* changing between runs and 2592/2638 passing every time."

A test that fails in run 2 and passes in run 4 changes the pass count. With a fixed total of 2638
and fail counts of 1 and 4, the pass count cannot be constant unless the skipped/todo counts shift
by 3 in compensation — and `deferred-items.md:134` records a run with `# fail 0 # pass 2593
# skipped 40 # todo 5`, fixing skipped+todo at 45 and therefore pass at `2638 - 45 - fail`. Under
that arithmetic the four runs are 2592, 2589, 2592, 2592 — not "2592 every time".

The error originates upstream in `deferred-items.md:76` and was transcribed faithfully. That is
precisely the failure mode the document's transcription contract is supposed to catch: transcription
without a consistency check propagates an upstream arithmetic error into the durable record.

**Fix:** State the range rather than a constant, or drop the pass count. If WR-01's rewrite is taken
the sentence disappears; otherwise: "…gave fail counts 1, 4, 1, 1 out of 2638 tests (2589-2592
passing, 45 skipped or todo), with the failing test identity changing between runs."

---

### WR-03: Corrections 2 and 3 carry no applied/not-applied disposition and no owner, leaving two proven-wrong statements standing in `23-CONTEXT.md`

**File:** `docs/phase23-real-release-gate-findings.md:823-857`

**Issue:** The *Corrections to prior documents* section opens by declaring that "the applicable
corrections below are applied to it as scoped edits in the same commit as this section", and every
correction against `23-RESEARCH.md` closes with an explicit `*Applied* to 23-RESEARCH.md in this
commit` (items 4, 5, 6, 9, 10, 11, 12, 13, 15). Item 1 closes with `*Not applied here:*` **and names
an owner** (a filed todo). Item 7 closes with `*Not applied:*` and names the reason.

Corrections **2** and **3** — both against `23-CONTEXT.md` — close with neither. They have no
disposition marker and no owner.

`23-CONTEXT.md` was never edited: `git log -- 23-CONTEXT.md` shows only the two pre-execution
commits. So both statements the document proves wrong are still live guidance:

- `23-CONTEXT.md:168` still reads "reuse `BankProbe3.java`'s `getBlock()`-first guard" — the exact
  pattern correction 2 demonstrates marks the **entire 64K address space volatile with no error and
  no warning** on a flat import, with a symptom that "looks like success".
- `23-CONTEXT.md:312` still carries the superseded N-way framing correction 3 addresses.

Correction 2 is the highest-consequence correction in the section — a silent-wrong-answer trap in a
Ghidra pre-script — and it is the one left without an owner.

**Fix:** Give both the same disposition treatment as items 1 and 7. Either apply the scoped edit to
`23-CONTEXT.md`, or file a todo and name it:

```markdown
*Not applied:* `23-CONTEXT.md` is a committed pre-execution document and is not this plan's to
edit. Filed as `.planning/todos/pending/<date>-correct-23-context-getblock-first-volatile-guard.md`,
which owns it. `evidence/FlatVolatile.java`'s header comment carries the corrected pattern in the
meantime.
```

---

### WR-04: The Ghidra headless re-run block cannot run as printed

**File:** `docs/phase23-real-release-gate-findings.md:1037-1046`

**Issue:** Three defects in the printed commands, each checkable against the rehearsal transcripts
in `evidence/tools/instrument-provenance.txt`:

1. **`-scriptPath` is missing.** Every rehearsed invocation (`:318`, `:434`, `:582`) passes
   `-scriptPath $PROBE_DIR/ghidra`. Without it `analyzeHeadless` will not find `FlatVolatile.java`
   or `ExportAnalysis23.java`.
2. **`-deleteProject` on the first invocation destroys what the second needs.** The block runs
   import + preScript with `-deleteProject`, then a second `analyzeHeadless … -process <name>`.
   The project no longer exists at that point. The rehearsal at `:582` does import, preScript and
   postScript in a **single** invocation for exactly this reason.
3. **`-loader-baseAddr 0x0` does not match the stated rehearsal.** The block is labelled
   "rehearsed in this phase on the fixture", but the fixture rehearsals used
   `-loader-baseAddr 0x801` (`:434`, `:582`). `0x0` is the flat-64K route (`:318`), which was
   rehearsed against a *synthetic* 65536-byte image, not the fixture.

**Fix:** Print the single-invocation form that was actually rehearsed, and label the two routes
distinctly:

```
# fixture (.prg) route, as rehearsed:
analyzeHeadless <proj> fixture-export -import fixture-image.bin \
  -processor 6502:LE:16:default -loader BinaryLoader -loader-baseAddr 0x801 \
  -noanalysis -scriptPath <scriptdir> \
  -preScript FlatVolatile.java <entrypoints-file> \
  -postScript ExportAnalysis23.java <out.txt> -deleteProject

# flat 64K route (rehearsed on a synthetic image, never on a release): identical but
# -loader-baseAddr 0x0
```

---

### WR-05: The document's opening provenance contract overstates what it can guarantee

**File:** `docs/phase23-real-release-gate-findings.md:49-54`

**Issue:** "Every value in this document is transcribed from an outcome line at column 0 of a named
evidence file, cited by path relative to `.planning/phases/23-…/`."

Several load-bearing values are not that, and cannot be:

- `231`, `100`, `41`, `12`, `29`, `1` (Finding B, criterion 3) are prose inside
  `CAPTURE-SUMMARY.txt` and the capture records, not `NAME: value` lines at column 0.
- `201` (CR-02) is in no evidence file at all.
- Finding E's `1, 4, 1, 1` and `2592/2638` come from `deferred-items.md`, which is a planning
  document, not an evidence file, and are prose there too.
- `17 functions / 152 code bytes`, `082e -> 089a`, `26`-row breakdowns and the `analyzer.rs` line
  numbers are table cells in `criterion4-analyzer-audit.md`, not outcome lines.

The strict form is true of the seven **rule inputs**, which is the property that actually matters
and which the review confirms holds. Stating it of "every value" is an overclaim that CR-02
falsifies — and an overclaimed contract is worse than a narrower true one, because it invites the
reader to skip verification.

**Fix:** Narrow the sentence to what is enforceable:

```markdown
Every **rule input** in this document is transcribed from an outcome line at column 0 of a named
evidence file, cited by path relative to `.planning/phases/23-…/`. Supporting figures quoted from
transcripts and tables are cited to the file and section they appear in. Nothing here is written
from memory and nothing is taken from a plan SUMMARY's paraphrase.
```

## Info

### IN-01: `evidence/tools/verify/README.md` is missing from the "every evidence file" index

**File:** `docs/phase23-real-release-gate-findings.md:975`

**Issue:** The *Reproducing this* table is introduced as "**Every evidence file this phase
produced**, by relative path". The row `evidence/tools/verify/*.bash` covers the four scripts but
not `evidence/tools/verify/README.md`, which exists and is tracked. Every other tracked file under
`evidence/` is listed.

**Fix:** Widen the glob to `evidence/tools/verify/*` and mention the README, or add a row for it.

---

### IN-02: The same `082e -> 089a` observation is "the easy case" in criterion 2 and "strictly harder" in criterion 4, with the comparand unstated in both

**File:** `docs/phase23-real-release-gate-findings.md:525` and `:592-594`

**Issue:** Criterion 2 says the fixture's `COMPUTED_JUMP` "was an immediate `ldx #$02`, the easy
case, which is the specific defect this criterion exists to remove" and correctly refuses to count
it. Criterion 4 says E6 is written `replaced-by:` "because Ghidra was *observed* resolving a
strictly harder indirect dispatch".

Both are defensible against different comparanda — harder than r2000's E6 precondition (which
required the pointer already typed `BlockType::Address`, whereas the fixture's `$00fb` pointer is
written at runtime, per `criterion4-analyzer-audit.md:74`), easier than a real computed-index
dispatch. But neither sentence names its comparand, so a reader moving between the two sections
sees the same observation carrying opposite adjectives, with the load-bearing one (`replaced-by:`,
which holds `c4_unreplaced` at `0`) taking the flattering reading.

The document does disclose the tension honestly at `:596-601` by naming the exact condition that
would flip E6 — this is a clarity issue, not a soundness one.

**Fix:** Name the comparand in the criterion-4 sentence: "…resolving a dispatch strictly harder
*than the one r2000's E6 preconditions admit* — the fixture's `$00fb` pointer is written at
runtime, where E6 requires it already typed `BlockType::Address`. It remains an easy case relative
to a real computed-index dispatch, which is criterion 2's question and is `could-not-run`."

---

_Reviewed: 2026-08-26T18:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
