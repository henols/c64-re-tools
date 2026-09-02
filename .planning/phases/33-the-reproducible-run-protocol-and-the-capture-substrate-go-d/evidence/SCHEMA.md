# Phase 33 — The outcome-line schema and measurement definitions

**Binding. Committed before any measurement exists.** Every literal name the rest of this
phase may emit is fixed here, together with the **derivation rule** that produces its value
from raw measurements — so no measuring plan can invent a favourable definition, and no
plan can mint a line name that flatters its own result. A measuring plan that needs a name
not declared below has found a gap in the pre-commitment; it records that as an
`## ACCEPTED LIMIT` in its **own** evidence file and the findings document records an
explicit override. **It does not invent a name, and it does not edit this file.**

`DECISION-RULE.md` reads its inputs from the lines declared here. The two files are one
pre-commitment in two parts and share its frozen status.

---

## 1. Outcome-line conventions

Every rule input and every recorded fact is a bare `NAME: value` at **column 0** of a named
evidence file. Never indented, never inside a fenced block that a reader would take for
sample output, never inside a table cell.

- **Final occurrence wins.** Where a line is written more than once in one file, the last
  occurrence is the value. Stated because Phase 9's own evidence carried a superseded early
  `INSTALLED_VERSION:` line that was only resolved 106 lines later.
- **One declared source file per line.** The tables below name exactly one file per line
  name. A gate input written into a second file is not a second opinion; it is a name
  collision, and the declared file is the one that counts.
- **Absence.** For the **five gate inputs** an absent line is not a pass, not a default and
  not a defensible state — it is an incomplete phase. For every other line declared below,
  absence is permitted where the branch that would write it was not taken, and is noted as
  such in the tables.
- **Transcripts are appended, never reconstructed.** The `$ <command>` line convention, the
  `BROKER_STATE:` / `TEST_AUTOMATED_BASELINE:` requirement and the voided-run rule are in
  `README.md` § *Evidence conventions*, which is binding on every plan in this phase.

---

## 2. The five gate inputs

These five, and only these five, are read by `DECISION-RULE.md`. Paths are relative to
`.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/`.

| Line | Domain | Corpus-free | Declared source file |
|---|---|---|---|
| `SEED_EFFECT` | `pinned` \| `partial` \| `unpinned` | yes | `evidence/33-repro01-determinism.md` |
| `JITTER_IMMUNITY` | `immune` \| `partial` \| `not-immune` | yes | `evidence/33-repro02-reset-removed.md` |
| `ORACLE_NECESSITY` | `proven` \| `unproven` | yes | `evidence/33-repro03-frame-anchor.md` |
| `SLICER` | `validated` \| `failed` | yes | `evidence/33-slicer-validation.md` |
| `C0_CAPTURE_PAIR` | `pass` \| `fail` \| `not-obtained` | no | `evidence/33-capture-pair.md` |

`could-not-run` is **not** in any of these five domains. It is not a spelling this phase
uses for a gate input at all: four of the five are measurable with no corpus, and the fifth
carries `not-obtained` as an input value.

### 2.1 `SEED_EFFECT` — derivation

Measured over the **untouched `$C000-$CFEF` window (4080 addresses)**, comparing two cold
boots against each other in each condition:

- **`pinned`** iff two cold boots **with** the determinism block differ at **0** addresses
  in that window **and** two cold boots **without** it differ at **more than 0**. Both
  halves are required: a with-block count of 0 means nothing if the without-block count is
  also 0, because then the window was never nondeterministic and the block was never tested.
- **`partial`** iff the with-block count is **greater than 0 but strictly less than** the
  without-block count.
- **`unpinned`** iff the with-block count is **greater than or equal to** the without-block
  count.

Research reproduced `59 of 4080 → 0 of 4080` on this host over `-binarymonitor`
(33-RESEARCH.md M3), matching `REPRO-01`'s original `67 → 0` in shape and magnitude.

The window is chosen because it is untouched by the KERNAL, the BASIC interpreter and the
protocol itself; `NOSEED_DIFF_TOTAL_64K` and `BLOCK_DIFF_TOTAL_64K` are recorded beside the
window counts as the audit trail and **never gate** — the whole-64K count still differs at
1242 bytes with the block fully applied, because that stop was wall-clock-anchored, and that
residual is what the reset protocol and the frame anchor close rather than what the seed
does.

### 2.2 `JITTER_IMMUNITY` — derivation

Three runs of the identical protocol at **pre-protocol jitter 0 / 1500 / 4000 ms**:

- **`immune`** iff all three runs produce **one identical 64K sha256** **and** identical
  `(PC, hit_count, LIN, CYC)`.
- **`partial`** iff the four-term stop identity matches on all three runs but the sha256
  does **not**.
- **`not-immune`** iff **any** of the four stop-identity terms differs across the three
  runs.

Research measured `immune` at the KERNAL `READY` prompt over `-binarymonitor`
(33-RESEARCH.md M4): one sha `0999713e…` across all three jitters, `PC=$ea31 LIN=257
CYC=57`, `hit_count = 1`. `CAP-04` is why that is re-measured here on an **autostarted**
real release with true drive emulation in the loop rather than being carried forward.

### 2.3 `ORACLE_NECESSITY` — derivation

- **`proven`** iff a **committed control** shows `(LIN, CYC)` **alone PASSING** on two
  stops **exactly one frame apart**, while the full triple `(PC, hit_count, (LIN, CYC))`
  correctly reports those two stops as different.
- **`unproven`** otherwise — **including when no such pair was produced at all**.

The necessity of the frame term must be **observed**, not argued: an unobserved necessity is
not a proven one. Note the direction the control has to run in — the interesting failure is
`(LIN, CYC)` agreeing on two stops that are genuinely different, which is what makes a
two-term oracle insufficient. A control in which `(LIN, CYC)` merely *differs* proves
nothing.

### 2.4 `SLICER` — derivation

- **`validated`** iff **both** `node --test vsf-slice.test.ts` **and** `node --test
  capture-predicate.test.ts capture-seam.test.ts` report `fail 0`, with **both transcripts
  appended to the declared source file**.
- **`failed`** otherwise.

The transcripts are part of the derivation, not decoration: a `fail 0` claimed without its
run output is a restatement, and the two suites are named individually because the slicer
and the predicate are separate deliverables (`CAP-01`, `CAP-02`) and either one failing
voids the substrate.

### 2.5 `C0_CAPTURE_PAIR` — derivation

- **`pass`** iff **one real cracked release**, **autostarted** with **true drive emulation
  in the loop**, was **captured twice** and the pair compares **equivalent** under `CAP-02`'s
  predicate with an allow-list **at or under the committed cap of 64**.
- **`fail`** iff **two captures were obtained** and the pair does **not** compare
  equivalent, **or** the derivation **exceeded the cap**.
- **`not-obtained`** iff **fewer than two usable captures were obtained**, **with the reason
  named** on the same page.

`not-obtained` is an input **value**, not an abstention, and the reason is part of it — a
`not-obtained` with no named reason is an incomplete measurement, not a recorded absence.
The cap is a pre-commitment: exceeding it **voids the derivation** and is recorded as
`fail`, never repaired by raising the cap.

---

## 3. Recorded lines that never gate

Declared so no plan mints a variant name, and so a reader cannot mistake one of these for a
verdict input. **None of them appears in any rule** in `DECISION-RULE.md`, and none may be
added to one (see that file's § *Never a gate*). Absence is permitted wherever the branch
that writes the line was not taken.

| Line | Domain | Declared source file | Note |
|---|---|---|---|
| `BROKER_STATE` | `inactive` | every evidence file carrying a live run | `D-11`. `inactive` is the **only** valid value; any other value means the run is discarded and re-run, never repaired |
| `TEST_AUTOMATED_BASELINE` | free text stating the observed failure count **and** the file names | every evidence file carrying a live run | Never `clean` and never `0 failures`; see `README.md` § *Evidence conventions* 4 |
| `AUTOSTART_FRAME_EXACT` | `achieved` \| `not-achieved` | `evidence/33-autostart-sequencing.md` | A named non-achievement keeps the `fail` branch honest instead of hiding it |
| `AUTOSTART_SEQUENCE` | `S1` \| `S2` \| `S3` \| `S4` \| `none` | `evidence/33-autostart-sequencing.md` | Which attempted ordering produced the usable stop, or `none` |
| `WALLCLOCK_CONTROL` | `red` \| `not-red` | `evidence/33-wallclock-control.md` | The `D-07` negative control; `red` is the expected and required observation |
| `WARP_BRACKET_CONTROL` | `red` \| `not-red` | `evidence/33-wallclock-control.md` | The warp-invalidated wall-clock bracket timing out spuriously |
| `RESET_REMOVED_CONTROL` | `red` \| `not-red` | `evidence/33-repro02-reset-removed.md` | `REPRO-02`'s reset-removed control, produced by an evidence script calling the protocol's pieces directly (`D-13`) |
| `CAPTURE_FRAME_EXACT` | `yes` \| `no` | `evidence/33-capture-pair.md` | Recorded beside `C0_CAPTURE_PAIR`; it is the *cause* a `fail` narrowing is authored against, not a second gate |
| `TRANSIENT_COUNT` | non-negative integer \| `not-obtained` | `evidence/33-transient-derivation.md` | The measured union size. Reference points to state beside it: `0` (frame-exact `READY` stop), `300` (wall-clock autostarted stop), `1242` (block-applied wall-clock 64K residual) |
| `DERIVATION` | `void` | `evidence/33-transient-derivation.md` | Written **only** when the union exceeded the cap of 64, in which case no allow-list artifact is committed. Absent on the at-or-under-cap branch |
| `MEMSPACE_ASSERTION` | `refuses` \| `did-not-refuse` | `evidence/33-memspace-refusal.md` | `D-28`: observed after one deliberate drive-checkpoint hit |
| `PROBEREADY_BUDGET` | `adequate` \| `short` | `evidence/33-probeready-warp-console.md` | `REPRO-05` / `D-18`, widened to `-console` as well as `-warp` |
| `WARP_TIME_TO_BIND_MS_MAX` | non-negative integer, milliseconds | `evidence/33-probeready-warp-console.md` | Worst observed time to bind under `-warp` |
| `CONSOLE_TIME_TO_BIND_MS_MAX` | non-negative integer, milliseconds | `evidence/33-probeready-warp-console.md` | Worst observed time to bind under `-console` |

---

## 4. Corpus release list (`corpus.releases[]`)

The corpus is modelled as a **list of releases with exactly one flagged canonical**, never
as a scalar image with a second bolted alongside. Carried unchanged from Phase 23's schema,
because `D-27` carries Phase 23's `D-04` unchanged.

The findings frontmatter carries `corpus.releases` as a YAML list. Each element has:

| Key | Type | Meaning |
|---|---|---|
| `release` | string | Operator-supplied release name/id |
| `file_sha256` | string, 64 hex | sha256 of the shipped image as supplied (`.d64` or `.prg`) |
| `capture_sha256` | string, 64 hex | sha256 of the flat 64K capture sliced from it, or `not-obtained` |
| `canonical` | boolean | **Exactly one** element in the list is `true` |

The canonical element is the one `C0_CAPTURE_PAIR` is computed over. A second release is a
**stretch input** (`D-27`): its numbers live in their own record and never gate, and its
absence is not a shortfall. The one-release case is the degenerate single-element list,
still carrying `canonical: true`.

**No corpus byte, snapshot or capture image is ever committed** (`D-27`). Identity is
release name plus sha256, and nothing else travels into git. Both releases currently on disk
are gitignored and untracked by construction.

---

## 5. Findings-document frontmatter keys

Fixed here, before `docs/phase33-reproducible-run-gate-findings.md` exists. Keys in this
order (`D-05`):

| Key | Domain |
|---|---|
| `phase` | `33-the-reproducible-run-protocol-and-the-capture-substrate-go-d` |
| `requirement` | the ten ids `REPRO-01`..`REPRO-05`, `CAP-01`..`CAP-04`, `GATE-01` |
| `probe_date` | `YYYY-MM-DD` |
| `verdict` | exactly one of `go`, `degrade`, `no-go` — `could-not-run` is **not** in this domain |
| `verdict_rule_applied` | matches `R[1-9]` — the id of the **first** rule that fired |
| `inputs.seed_effect` | the `SEED_EFFECT` domain in § 2 |
| `inputs.jitter_immunity` | the `JITTER_IMMUNITY` domain in § 2 |
| `inputs.oracle_necessity` | the `ORACLE_NECESSITY` domain in § 2 |
| `inputs.slicer` | the `SLICER` domain in § 2 |
| `inputs.c0_capture_pair` | the `C0_CAPTURE_PAIR` domain in § 2 |
| `corpus.releases[]` | the list schema in § 4 |

The five `inputs.*` values are **transcribed** from the literal outcome lines declared in
§ 2, each cited by path, final occurrence wins. Nothing is taken from a plan SUMMARY's
paraphrase. The body reproduces the full rule set verbatim and walks the actual outcome
values through it, so a reader mechanically re-derives the verdict rather than taking it on
trust, and names which rules were **not evaluated** because an earlier one matched.
