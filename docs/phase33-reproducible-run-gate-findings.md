---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
requirement: [REPRO-01, REPRO-02, REPRO-03, REPRO-04, REPRO-05, CAP-01, CAP-02, CAP-03, CAP-04, GATE-01]
probe_date: 2026-09-02
# Exactly one of go / degrade / no-go. `could-not-run` is NOT in this field's
# domain, and that is structural rather than a promise: R9 carries no
# antecedent and the rule set is total over all 108 input tuples
# (DECISION-RULE.md section Totality), so every tuple resolves to one of the
# three. This is the specific defect the Phase 23 predecessor carried and hit.
verdict: degrade
verdict_rule_applied: R6
inputs:
  # Each value below is the FINAL occurrence of its declared outcome line at
  # column 0 of its declared source file. Paths are relative to
  # .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/.
  seed_effect: pinned          # evidence/33-repro01-determinism.md:428
  jitter_immunity: immune      # evidence/33-repro02-reset-removed.md:690
  oracle_necessity: unproven   # evidence/33-repro03-frame-anchor.md:752
  slicer: validated            # evidence/33-slicer-validation.md:288
  c0_capture_pair: pass        # evidence/33-capture-pair.md:631
corpus:
  releases:
    - release: "danish"
      file_sha256: "1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5"
      capture_sha256: "99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5"
      canonical: true
---

This document carries YAML frontmatter, unlike its sibling probe documents under
`.planning/phases/33-…/evidence/`, which have none — the departure is deliberate and is
carried forward from `docs/phase23-real-release-gate-findings.md` for the same reason it was
taken there: `GATE-01` requires a machine-readable `go` / `degrade` / `no-go` verdict that a
downstream planner reads as a gate, and a prose sentence in the body is **not** a
machine-readable verdict. `SCHEMA.md` § 5 fixed these keys, in this order, before this file
existed.

**The transcription rule, which is the whole basis of the verdict's honesty.** Every value in
this document is taken from a literal outcome line at **column 0** of a named evidence file,
**cited by path** relative to
`.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/`. Where a
line appears more than once in one file, the **final occurrence** is the one taken
(`evidence/README.md` § *Evidence conventions* 6). Nothing here is written from memory and
nothing is taken from a plan SUMMARY's paraphrase — a numeric or enumerated result with no
transcript behind it is a restatement wearing a measurement's clothes.

## Verdict

**`degrade` — rule `R6` fired.**

`R6`'s text, reproduced verbatim from `evidence/DECISION-RULE.md`:

> - **R6 → `degrade`.** `ORACLE_NECESSITY` is `unproven`. **Pre-mapped narrowing (D-04):** the
>   oracle narrows to the two-term `(PC, hit_count)` form with the frame term **recorded but
>   not asserted**, and every downstream capture pair carries that weakening in its own
>   record rather than in a footnote to this document. Note that `unproven` includes the case
>   where no `(LIN, CYC)`-alone-passing control pair was produced at all: the ROADMAP requires
>   the necessity of the frame term to be *observed*, and an unobserved necessity is not a
>   proven one.

### The walk, in written order, first match wins

`R1` through `R5` were evaluated and did not match. `R6` matched. `R7`, `R8` and `R9` were
**not evaluated**.

| Rule | Antecedent | Input value read | Source file | Matched? |
|---|---|---|---|---|
| `R1` | `SLICER` is `failed` | `SLICER: validated` | `evidence/33-slicer-validation.md` | **no** — `validated` is not `failed` |
| `R2` | `SEED_EFFECT` is `unpinned` | `SEED_EFFECT: pinned` | `evidence/33-repro01-determinism.md` | **no** — `pinned` is not `unpinned` |
| `R3` | `JITTER_IMMUNITY` is `not-immune` | `JITTER_IMMUNITY: immune` | `evidence/33-repro02-reset-removed.md` | **no** — `immune` is not `not-immune` |
| `R4` | `C0_CAPTURE_PAIR` is `fail` | `C0_CAPTURE_PAIR: pass` | `evidence/33-capture-pair.md` | **no** — `pass` is not `fail` |
| `R5` | `C0_CAPTURE_PAIR` is `not-obtained` | `C0_CAPTURE_PAIR: pass` | `evidence/33-capture-pair.md` | **no** — `pass` is not `not-obtained` |
| `R6` | `ORACLE_NECESSITY` is `unproven` | `ORACLE_NECESSITY: unproven` | `evidence/33-repro03-frame-anchor.md` | **YES — first match, derivation stops here** |
| `R7` | `SEED_EFFECT` is `partial` | — | — | **NOT EVALUATED** |
| `R8` | `JITTER_IMMUNITY` is `partial` | — | — | **NOT EVALUATED** |
| `R9` | *(none — exhaustive default)* | — | — | **NOT EVALUATED** |

**`R7`, `R8` and `R9` were not evaluated, and that is stated rather than left blank on
purpose.** Under first-match-wins the derivation stops at the first matching rule, so no
later rule is ever reached. A blank cell against `R9` would read as "the `go` rule was
checked and did not apply", which is a different and stronger claim than the truth: `R9` was
never consulted at all. `DECISION-RULE.md` § *Totality* states the requirement directly —
"Rules that were never evaluated because an earlier one matched are recorded as **not
evaluated**, not as passed." Phase 23's findings document had to add exactly this
clarification after the fact; recording it in the same pass is the improvement.

For completeness, and **not** as part of the derivation: had evaluation reached them, `R7`
would not have fired (`SEED_EFFECT` is `pinned`, not `partial`) and `R8` would not have fired
(`JITTER_IMMUNITY` is `immune`, not `partial`), and `R9` requires all five inputs at their
best value, which `ORACLE_NECESSITY: unproven` denies. That observation is arithmetic about
the recorded tuple, not a step in the walk — evaluation stopped at `R6`.

### No override was taken, and the alternative reading was considered in full

`evidence/33-repro03-frame-anchor.md` § *ACCEPTED LIMIT* names this document as the only
place that may revisit its recorded value, and it disclosed a judgement it made against
itself. The situation, transcribed:

`SCHEMA.md` § 2.3 asks for `(LIN, CYC)` **alone passing** on two stops **exactly one frame
apart**. On the `$ea31` KERNAL-IRQ anchor that pair is unbuildable — a 60 Hz IRQ against a
50.125 Hz PAL frame, measured as `ANCHOR_SURVEY_SAMPLES 240` producing
`ANCHOR_SURVEY_DISTINCT_LIN_CYC 240` with
`ANCHOR_SURVEY_CONSECUTIVE_PAIRS_WITH_EQUAL_LIN_CYC 0`. The plan built a variant control at a
raster-conditioned probe point (`$e5d4`, condition `(RL == $f0)`) where the two-term
projection **does** pass — `VARIANT_TWO_TERM_PROJECTION {"identical":true,…}` — on two stops
whose sliced images genuinely differ (`VARIANT_IMAGE_DIFF differing_bytes=3`,
`VARIANT_IMAGE_SHA_EQUAL no`), with the shipped four-term oracle separating them and naming
`hitCount`. But the separation is recorded as
`VARIANT_SEPARATION equal raster coordinates, so an exact INTEGRAL number of video frames --
10 probe hits apart, anchor hit counts 11 and 14`, and the strict conjunct is recorded
`CONJUNCT_0_ONE_FRAME_APART_PAIR_EXISTS no`, with the file adding that "the minimum
equal-raster separation reachable on this build is 2 frames". Read as "an integral number of
frames apart", every conjunct holds and the value would be `proven`, which reaches
`R9 → go`.

**The recorded value stands. `ORACLE_NECESSITY` remains `unproven` and the verdict is derived
from it rather than around it.** Four reasons, in order of weight:

1. **The frozen text states the strict reading.** `SCHEMA.md` § 2.3 says "exactly one frame
   apart" and closes with "including when no such pair was produced at all". The rule text
   does not move, and `DECISION-RULE.md` § *Status* is explicit that an ambiguity is recorded,
   not resolved into the rule.
2. **`proven` is the flattering value and the measuring plan said so.** It is the difference
   between `degrade` and a possible `go`. `33-11` took the unflattering reading deliberately,
   naming that exact asymmetry. Adopting the generous reading here would relocate the
   flattering choice one document downstream rather than remove it.
3. **The measurement points the same way `R6` does.** `33-repro03-frame-anchor.md`'s own
   words: "the narrowing `R6` prescribes is well supported by what was measured here" — on
   the variant pair the frame term contributed nothing, `(LIN, CYC)` was identical on two
   genuinely different stops, and the term that separated them was `hit_count`. A
   `(PC, hit_count)` oracle with the frame term recorded but not asserted would have got this
   pair right. `R6` is, in that file's words, "not a penalty imposed by a missing measurement;
   it is the correct response to the measurement that was taken."
4. **The same file's second accepted limit removes the ground an override would stand on.**
   The control establishes that `(LIN, CYC)` **alone** is insufficient. The line's name and
   § 2.3's prose call that "the necessity of the frame term", and `R6`'s narrowing *drops* the
   frame term. Those are not the same claim, and the measurement "gives no support to a
   reading in which the frame term is the load-bearing one on this pair". An override to
   `proven` would assert a necessity the evidence declines to support, in order to keep a
   term the evidence showed idle.

Even under the generous reading the antecedent is not literally met: the pair is an
**integral** number of frames apart, not **one**, and the smallest reachable equal-raster
separation on this build is measured at 2 frames. So the override would require both a
loosened reading of "exactly one" *and* the value the loosening produces.

`DECISION-RULE.md` states the price of an override — the rule text does not move and the
override is recorded as an explicit override here, which "weakens exactly the pre-commitment
it exists to provide". That price was not paid, because there is no positive reason the strict
reading is wrong. **This section is a derivation, not an assessment: the value was read from
the file, and `R6` is the first rule its value matches.**

## The rule, reproduced

Reproduced verbatim from `evidence/DECISION-RULE.md` so this document is self-contained and
the verdict is re-derivable from it alone.

### Inputs

| Input | Domain | Corpus-free | Source line | Source file |
|---|---|---|---|---|
| `SEED_EFFECT` | `pinned` / `partial` / `unpinned` | yes | `SEED_EFFECT:` | `evidence/33-repro01-determinism.md` |
| `JITTER_IMMUNITY` | `immune` / `partial` / `not-immune` | yes | `JITTER_IMMUNITY:` | `evidence/33-repro02-reset-removed.md` |
| `ORACLE_NECESSITY` | `proven` / `unproven` | yes | `ORACLE_NECESSITY:` | `evidence/33-repro03-frame-anchor.md` |
| `SLICER` | `validated` / `failed` | yes | `SLICER:` | `evidence/33-slicer-validation.md` |
| `C0_CAPTURE_PAIR` | `pass` / `fail` / `not-obtained` | no | `C0_CAPTURE_PAIR:` | `evidence/33-capture-pair.md` |

### Rules, first match wins

> - **R1 → `no-go`.** `SLICER` is `failed`. The flat-64K substrate every downstream number is
>   measured on does not exist, so Phases 35-38 would measure hand-transcribed hex again —
>   the exact error source `CAP-01` removes (one 32 KB write truncated mid-payload, one 8 KB
>   write dropping ten characters, localised to `$7871`). Nothing downstream can be trusted
>   above the trustworthiness of the bytes it reads, and with no slicer those bytes are typed
>   by hand. **Corpus-free:** the slicer is validated against committed `.vsf` fixtures and
>   two unit suites, so a missing corpus can never produce this `no-go`.
>
> - **R2 → `no-go`.** `SEED_EFFECT` is `unpinned`. Launch nondeterminism dominates every
>   comparison — worth roughly a thousand false-divergence addresses per capture pair
>   (MEASURED `NOSEED_DIFF_TOTAL_64K 1092` on this host), with `RAMInitRandomChance` shipping
>   at `10`, i.e. 0.1% of all RAM bits flipped at power-up — so no capture pair can be
>   trusted and no equivalence claim means anything. **Corpus-free:** measured by two cold
>   boots with and without the determinism block, no release involved.
>
> - **R3 → `no-go`.** `JITTER_IMMUNITY` is `not-immune`. The reset protocol does not
>   reproduce, so there is no frame-exact stop for anything downstream to stand on and the
>   milestone's premise fails at its root: a capture taken at a stop that moves is not a
>   capture of anything in particular. **Corpus-free:** measured as the 0 / 1500 / 4000 ms
>   jitter triple under the protocol, no release involved.
>
> - **R4 → `degrade`.** `C0_CAPTURE_PAIR` is `fail`. Two captures were obtained from a real
>   release and the pair does **not** compare equivalent, or the allow-list derivation
>   exceeded the committed cap of 64. Narrowing **authored at verdict time against the
>   evidence** — deliberately *not* pre-mapped (`D-04`), because a `fail` whose recorded
>   cause is "the stop was not frame-exact" and a `fail` whose recorded cause is "the
>   derivation overflowed the committed cap of 64" narrow in different directions: the first
>   is a fact about this phase's substrate and is actionable here, the second is a fact about
>   the release and is not. The narrowing is written against the cause the evidence actually
>   records, and is labelled authored-at-verdict-time so a reader weighs it differently from
>   a pre-commitment.
>
> - **R5 → `degrade`.** `C0_CAPTURE_PAIR` is `not-obtained`. **Pre-mapped narrowing (D-04):**
>   Phase 38 narrows to **method-only** — it re-records the same `could-not-run` its
>   predecessor did, for the same named reason — and Phases 35 / 36 / 37 lose their
>   real-image exercise and narrow to **fixture-only**. The `REPRO-*` / `CAP-01` / `CAP-02`
>   substrate is **untouched** by this branch: it was measured without a corpus, so it stands
>   on its own evidence whatever happens to the release.
>
> - **R6 → `degrade`.** `ORACLE_NECESSITY` is `unproven`. **Pre-mapped narrowing (D-04):** the
>   oracle narrows to the two-term `(PC, hit_count)` form with the frame term **recorded but
>   not asserted**, and every downstream capture pair carries that weakening in its own
>   record rather than in a footnote to this document. Note that `unproven` includes the case
>   where no `(LIN, CYC)`-alone-passing control pair was produced at all: the ROADMAP requires
>   the necessity of the frame term to be *observed*, and an unobserved necessity is not a
>   proven one.
>
> - **R7 → `degrade`.** `SEED_EFFECT` is `partial`. The determinism block reduces the
>   differing-address count over the untouched window but does not drive it to zero. Narrowing
>   **authored at verdict time against the evidence**, Phase 9 style — the value is a plain
>   enumerated result with no interpretive step, so the narrowing costs nothing to defer and
>   gains precision by seeing the residual count.
>
> - **R8 → `degrade`.** `JITTER_IMMUNITY` is `partial`. The four-term stop identity matches
>   across all three jitter values but the 64K sha256 does not, so the stop reproduces while
>   the machine state does not. Narrowing **authored at verdict time against the evidence**.
>
> - **R9 → `go`.** Reached only when `SLICER: validated`, `SEED_EFFECT: pinned`,
>   `JITTER_IMMUNITY: immune`, `C0_CAPTURE_PAIR: pass` and `ORACLE_NECESSITY: proven`.
>   v0.8.0 proceeds as scoped, with no narrowing anywhere. `R9` has **no antecedent** — it is
>   the exhaustive default, which is what makes `could-not-run` structurally unemittable
>   (`D-03`) rather than merely discouraged.

### Totality — why the verdict field cannot carry `could-not-run`

Reproduced verbatim, because it is the structural claim rather than a promise:

> `could-not-run` is not an emittable verdict of this gate, and that is asserted by
> arithmetic rather than by promise. The five inputs have domains of size 3, 3, 2, 2 and 3,
> so there are **3 × 3 × 2 × 2 × 3 = 108** input tuples. `R1`..`R8` remove every tuple
> containing a non-best value and `R9` takes the remainder, so every tuple resolves to
> exactly one verdict in `{go, degrade, no-go}`.

| Rule | Antecedent | Tuples reaching it that match | Verdict | Tuples still unresolved after it |
|---|---|---|---|---|
| — | (all tuples) | — | — | 108 |
| `R1` | `SLICER: failed` | 3 × 3 × 2 × 3 = **54** | `no-go` | 54 |
| `R2` | `SEED_EFFECT: unpinned` | 1 × 3 × 2 × 3 = **18** | `no-go` | 36 |
| `R3` | `JITTER_IMMUNITY: not-immune` | 2 × 1 × 2 × 3 = **12** | `no-go` | 24 |
| `R4` | `C0_CAPTURE_PAIR: fail` | 2 × 2 × 2 × 1 = **8** | `degrade` | 16 |
| `R5` | `C0_CAPTURE_PAIR: not-obtained` | 2 × 2 × 2 × 1 = **8** | `degrade` | 8 |
| `R6` | `ORACLE_NECESSITY: unproven` | 2 × 2 × 1 × 1 = **4** | `degrade` | 4 |
| `R7` | `SEED_EFFECT: partial` | 1 × 2 × 1 × 1 = **2** | `degrade` | 2 |
| `R8` | `JITTER_IMMUNITY: partial` | 1 × 1 × 1 × 1 = **1** | `degrade` | 1 |
| `R9` | *(none — exhaustive default)* | **1** | `go` | **0** |

`54 + 18 + 12 + 8 + 8 + 4 + 2 + 1 + 1 = 108`: **84** tuples resolve `no-go`, **23** resolve
`degrade`, and exactly **1** — the all-best tuple — resolves `go`. Four of the five inputs are
**corpus-free**, so an absent corpus produces `C0_CAPTURE_PAIR: not-obtained` as an input
*value* matching `R5`, i.e. a narrowed proceed — never an abstention. That is what this gate
removed relative to its predecessor, and it is asserted here by the arithmetic above rather
than by this sentence.

### Never a gate

`DECISION-RULE.md` § *Never a gate* declares four recorded values as measurements rather than
gates, so a later reader cannot mistake an unflattering value in any of them for a failure:
the **number of corpus releases**, the **absolute cycle count**, **`probeReady`'s timing
budget**, and the **`test:automated` failure count**. None appears in any rule above, and none
may be added to one. Every one of the four has an unflattering or absent recorded value in
this phase, and each is reported below in its own section rather than omitted.

## Ordering proof

`GATE-01` rests on commit ordering and nothing else (`D-06` declined a test guard).

**The two facts banked in `evidence/README.md` § *Ordering proof*, before the first
measurement.** Taken with `HEAD` at `543522cd0f62e3052841a0a93d6155c3cc37627d`
(`543522c docs(33): record phase planned — 12 plans in 7 waves`), the commit that became the
rules commit's parent:

```
$ git log --oneline -- .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence
(no output)

$ git rev-list --count HEAD -- .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence
0
```

and, immediately before staging, the evidence tree was exactly the three files of `33-01`:

```
$ ls .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence
DECISION-RULE.md
README.md
SCHEMA.md
```

**The assertion re-run now, after every measurement in the phase has landed.** This is the
whole claim — it says no evidence commit precedes or accompanies the rules:

```
$ E=.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence
$ RULES=$(git log --diff-filter=A --format=%H -- "$E/DECISION-RULE.md" | tail -1)
$ echo "$RULES"
2a8ef95b3a6474d0300c3069eb56bfee33e820eb

$ git rev-list --count "$RULES" -- "$E"
1

$ git log --oneline -1 -- "$E/DECISION-RULE.md"
2a8ef95 docs(33-01): pre-commit the GATE-01 decision rules, the outcome-line schema and the evidence conventions
```

**Still `1`.** The adding commit of `DECISION-RULE.md` remains the only commit reachable from
itself that touches `evidence/`, so the rules provably predate every measurement in this
phase. This is the check that would detect a rules edit or an evidence commit slipped in
ahead of them, and it is run here rather than only at `33-01` because a pre-commitment
verified only at the moment it is made is not verified at all.

The three frozen files are each at exactly one commit, all of them `2a8ef95`:

```
$ for f in DECISION-RULE.md SCHEMA.md README.md; do echo -n "$f: "; git rev-list --count HEAD -- "$E/$f"; done
DECISION-RULE.md: 1
SCHEMA.md: 1
README.md: 1
```

**Scope note, carried forward from `README.md`.** Every ordering assertion is scoped to
`evidence/`, never to the phase directory, which already carried the CONTEXT, RESEARCH,
PATTERNS, VALIDATION, DISCUSSION-LOG and twelve PLAN documents before execution began. A check
scoped to the phase directory is unsatisfiable by construction and must not be written.

## Input 1 — `SLICER: validated`

**Value:** `validated`. **Source:** `evidence/33-slicer-validation.md`, line 288, at column 0.

**Derivation `SCHEMA.md` § 2.4 declared:** `validated` iff **both** `node --test
vsf-slice.test.ts` **and** `node --test capture-predicate.test.ts capture-seam.test.ts` report
`fail 0`, with **both transcripts appended to the declared source file**; `failed` otherwise.
The transcripts are part of the derivation and not decoration — a `fail 0` claimed without its
run output is a restatement.

**The numbers behind it**, transcribed from the two appended transcripts:

| Suite | Result |
|---|---|
| `node --test vsf-slice.test.ts` | `tests 34 / pass 34 / fail 0`, `exit=0` |
| `node --test capture-predicate.test.ts capture-seam.test.ts` | `tests 39 / pass 39 / fail 0`, `exit=0` |

Both transcripts are appended in full to the declared source file, so both halves of the
declared derivation have their run output. `R1` does not fire.

**The line was deliberately not emitted earlier.** `33-04` built the slicer but recorded an
`## ACCEPTED LIMIT` in `evidence/33-04-slicer-substrate.md` rather than writing `SLICER:`:
neither `capture-predicate.test.ts` nor `capture-seam.test.ts` existed at that commit, so
`validated` would have been false (half the derivation had no transcript) and `failed` would
have been *wronger* — it would fire `R1 → no-go` on the absence of a sibling plan's
not-yet-written file rather than on any measured property of the slicer. `SCHEMA.md` § 1's
one-declared-source-file rule made writing the line into `33-04`'s own file a name collision
rather than a second opinion. The gap was closed by `33-07` in the declared file.

## Input 2 — `SEED_EFFECT: pinned`

**Value:** `pinned`. **Source:** `evidence/33-repro01-determinism.md`, line 428, at column 0.

**Derivation `SCHEMA.md` § 2.1 declared:** measured over the untouched `$C000-$CFEF` window
(4080 addresses), comparing two cold boots against each other in each condition. `pinned` iff
the with-block count is **0** *and* the without-block count is **above 0** — both halves
required, because a with-block count of 0 means nothing if the window was never
nondeterministic to begin with.

**The numbers behind it**, transcribed from the four-boot transcript:

| Quantity | Value |
|---|---|
| with-block window count (`$C000-$CFEF`, 4080 addresses) | **0** |
| without-block window count | **57** |
| `NOSEED_DIFF_TOTAL_64K` | **1028** |
| `BLOCK_DIFF_TOTAL_64K` | **0** |

`0 === 0` and `57 > 0`, so the first clause matches with both halves satisfied. The rule is
implemented as `deriveSeedEffect()` in the committed probe and the transcript carries
`DERIVED_SEED_EFFECT pinned`, so the value is produced by the rule rather than chosen after
the numbers were visible. `R2` does not fire and `R7` does not fire; this input contributes no
narrowing.

**The whole-64K counts are the audit trail and never gate** (`SCHEMA.md` § 2.1). Worth
recording that `BLOCK_DIFF_TOTAL_64K` came out **0** here, against research's **1242** with
the block fully applied on the same host and build — the difference is the anchoring, and it
is what the reset protocol and the frame anchor close rather than what the seed does.

**A concurrency arm, because pinning has to be a property of the flags.** Arm B was repeated
on a second port with everything else held: `CONCURRENCY_ARGV_DIFFERING_INDICES [16]`, the
`ip4://` element, `CONCURRENCY_ARGV_DIFFERS_ONLY_IN_IP4_ELEMENT yes`, and both ports produced
`0 of 4080` (`CONCURRENCY_SAME_WINDOW_COUNT yes`). The two ports' `ARGV_DIGEST` values differ,
which is `REPRO-04`'s own discipline — two launches on different ports are different launches
and are not a comparable pair even though their pinning behaviour is identical.

## Input 3 — `JITTER_IMMUNITY: immune`

**Value:** `immune`. **Source:** `evidence/33-repro02-reset-removed.md`, line 690, at
column 0.

**Derivation `SCHEMA.md` § 2.2 declared:** three runs of the identical protocol at
pre-protocol jitter **0 / 1500 / 4000 ms**. `immune` iff all three produce **one identical 64K
sha256** *and* identical `(PC, hit_count, LIN, CYC)`.

**The numbers behind it**, transcribed from the reported run's triple:

```
TRIPLE_RUN full-j0-r1    jitter=0    stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
TRIPLE_RUN full-j1500-r1 jitter=1500 stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
TRIPLE_RUN full-j4000-r1 jitter=4000 stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
TRIPLE_DISTINCT_SHA256 1 (0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b)
TRIPLE_PAIRWISE_DIFF_TOTAL 0
TRIPLE_ANY_STOP_TERM_DIFFERS no
```

One distinct sha256 across the triple and zero differing bytes in all three pairings, with all
four stop-identity terms identical. Both conjuncts hold, so the value is `immune`. `R3` does
not fire and `R8` does not fire; this input contributes no narrowing.

**Independent second confirmation at a much later stop.** `evidence/33-repro03-frame-anchor.md`
took the same probe point at two different jitters and got four-term identity with **0**
differing bytes and one identical sha256 at probe hit 20 / anchor hit 11 — far past the
triple's anchor hit 1.

## Input 4 — `C0_CAPTURE_PAIR: pass`

**Value:** `pass`. **Source:** `evidence/33-capture-pair.md`, line 631, at column 0. This is
the gate's one corpus-bound input.

**Derivation `SCHEMA.md` § 2.5 declared:** `pass` iff **one real cracked release**,
**autostarted**, with **true drive emulation in the loop**, was **captured twice** and the pair
compares **equivalent** under `CAP-02`'s predicate with an allow-list **at or under the
committed cap of 64**.

**The conditions, walked one by one** as the evidence file walks them:

| Condition | Observed |
|---|---|
| one real cracked release | `danish.d64`, sha256 `1a9d294e…` asserted equal before launch |
| **autostarted** | `AUTOSTART` (0xdd) `err=0x00` on all three runs; no `RESET` anywhere |
| **true drive emulation in the loop** | `Drive8TrueEmulation=1`, `Drive8Type=1541`, read back over `RESOURCE_GET` inside each run |
| **captured twice** | two usable captures, 65536 bytes each |
| pair compares **equivalent** | `verdict=equivalent`, `differing=0`, 28 differences all enumerated transients |
| allow-list at or under the cap of 64 | **49** entries against a cap of **64** |

**The capture identities**, transcribed from the per-run capture records:

| Run | raw slice sha256 | port-normalised sha256 |
|---|---|---|
| `danish-ea31x400-run1` (jitter 0) | `99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5` | `23f4fe20f45db3e55367fd8c80a26f79b0d40a0cb53635f9b2c64836bc5448f5` |
| `danish-ea31x400-run2` (jitter 2500) | `d517148e1bf2e7abb529f43c60db2fd250777566f4e21595e1d7f40c003b1d94` | `c79c8ec0e8b23d22d78b5ebc0d9707ad7d8bc04bf24c0ac8c11fff74a629219d` |
| `danish-ea31x400-run3` (jitter 4000) | `3934b7172707f790ad94b963cda2dcbb5cf94d186cdaf9871eecec748b1cd24a` | `8673db3b5529f9a51fc051ef3a3f71a25facb8753d199650e2ae457bab6a7c5e` |

The reported pair is runs 1 and 2 — the first two usable captures **in the order taken**,
fixed before run 3 existed, per `README.md` § *Evidence conventions* 5. `R4` does not fire
(the pair compares equivalent and the derivation did not exceed the cap) and `R5` does not fire
(two captures were obtained).

**`CAPTURE_FRAME_EXACT: no`** is recorded beside it in the same file (line 633), with the
differing terms named: `line` (154 against 311) and `cycle` (11 against 9), while `pc`
(`$ea31`) and `hitCount` (400) are identical on both runs and all four terms were asserted.
Two of four `ORACLE_TERMS` differ, so the value is `no` under `SCHEMA.md` § 3's rule; a
three-of-four match is not a pass. `SCHEMA.md` § 3 declares `CAPTURE_FRAME_EXACT` "the *cause*
a `fail` narrowing is authored against, **not a second gate**", so it does not enter the
derivation. It is reported here because reading the `pass` without it is the misreading this
document exists to prevent — see § *Accepted limits and corrections*, item 6.

**The corpus is one release, and the second is a stretch input that earns nothing.** `D-27`
asks for one operator-supplied real cracked release. Two are on disk (`danish.d64`,
`saeger.d64`, both gitignored and untracked), and `DECISION-RULE.md` § *Never a gate* is
explicit that "the number of corpus releases never changes the verdict". `saeger` was not
exercised in this phase and no outcome line in this phase's evidence carries a number for it,
so it does not appear in the `corpus.releases` list above — recording it with a digest lifted
from a prior phase would be an unsourced number in the one document that must have none. Its
absence is not a shortfall (`SCHEMA.md` § 4: "The one-release case is the degenerate
single-element list, still carrying `canonical: true`"). No corpus byte, snapshot or capture
image entered git.

## Input 5 — `ORACLE_NECESSITY: unproven` (the input that fired the verdict)

**Value:** `unproven`. **Source:** `evidence/33-repro03-frame-anchor.md`, line 752, at
column 0.

**Derivation `SCHEMA.md` § 2.3 declared:** `proven` iff a **committed control** shows
`(LIN, CYC)` **alone PASSING** on two stops **exactly one frame apart**, while the full triple
`(PC, hit_count, (LIN, CYC))` correctly reports those two stops as different; `unproven`
otherwise — including when no such pair was produced at all.

**The four conjuncts, as the committed probe walks them:**

```
CONJUNCT_0_ONE_FRAME_APART_PAIR_EXISTS no
CONJUNCT_1_TWO_TERM_PASSES_ON_VARIANT_PAIR yes
CONJUNCT_2_FOUR_TERM_SEPARATES_VARIANT_PAIR yes (differing: hitCount)
CONJUNCT_3_SAME_FRAME_PAIR_UNIFIED yes
DERIVED_ORACLE_NECESSITY unproven
```

**Why conjunct 0 fails, measured rather than argued.** The anchor is a 60 Hz KERNAL IRQ
against a 50.125 Hz PAL frame:

```
ANCHOR_SURVEY_SAMPLES 240
ANCHOR_SURVEY_DISTINCT_LIN_CYC 240
ANCHOR_SURVEY_CONSECUTIVE_PAIRS 239
ANCHOR_SURVEY_CONSECUTIVE_PAIRS_WITH_EQUAL_LIN_CYC 0
ANCHOR_SURVEY_SMALLEST_REPEAT_GAP (none -- no (LIN, CYC) value repeated anywhere in the survey)
```

**The literal control was run and reported honestly as not satisfying the antecedent.** Anchor
hits 50 and 51 gave `($ea31, 50, 238, 15)` and `($ea31, 51, 186, 58)`; the two-term projection
**differs**, and § 2.3's own words are "A control in which `(LIN, CYC)` merely *differs*
proves nothing." Recorded rather than retried, and rather than silently replaced by the
variant.

**The variant control, at the raster-conditioned probe point.** `$e5d4` under condition
`(RL == $f0)`, pair selected in code by `PROBE_SURVEY_SMALLEST_EQUAL_RASTER_PAIR` rather than
after seeing the comparison:

```
VARIANT_STOP_A var-probe20-j0 {"pc":58836,"hitCount":11,"line":240,"cycle":3} sha256=126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f
VARIANT_STOP_B var-probe30-j0 {"pc":58836,"hitCount":14,"line":240,"cycle":3} sha256=f46751d331cbe79ae7ad3c1beabc726bf5bc487e5025a72df259ca201de3e090
VARIANT_TWO_TERM_PROJECTION {"identical":true,"differingTerms":[],"frameTermAsserted":true}
VARIANT_TWO_TERM_VERDICT PASSES -- it certifies the two stops as the SAME stop
VARIANT_FOUR_TERM_IDENTITY {"identical":false,"differingTerms":["hitCount"],"frameTermAsserted":true}
VARIANT_IMAGE_DIFF differing_bytes=3 first=$00a2 $00cd $01f2
VARIANT_IMAGE_SHA_EQUAL no
VARIANT_SEPARATION equal raster coordinates, so an exact INTEGRAL number of video frames -- 10 probe hits apart, anchor hit counts 11 and 14
```

So the two-term projection's PASS certified two genuinely distinct machine states as one stop,
and the shipped four-term oracle separated them naming `hitCount`. Every conjunct except
conjunct 0 holds. The declared derivation requires all four, so the value is `unproven` and
`R6` fires. See § *Verdict* → *No override was taken* for the full adjudication of the
"exactly one frame apart" reading, which is the one judgement call this document had authority
over and declined to use.

## Non-input finding — the autostart sequencing outcome

**`AUTOSTART_SEQUENCE: S3`** and **`AUTOSTART_FRAME_EXACT: not-achieved`**, both from
`evidence/33-autostart-sequencing.md` (lines 458 and 451, column 0).

`S3` is the settled anchor-counted ordering for an autostarted release: arm the frame anchor
while halted, then `AUTOSTART`, then count `CHECKPOINT_INFO` hits, with **no** `RESET`
anywhere — research's separate `RESET` is what undid the autostart. A checkpoint armed before
`AUTOSTART` **survives** its power cycle, settled by one observed `CHECKPOINT_LIST` reply
rather than inferred.

`not-achieved`, with the differing terms named as the derivation requires:

| Term | jitter 0 | jitter 2500 | Identical? |
|---|---|---|---|
| `PC` | `$ea31` | `$ea31` | yes |
| `hit_count` | 400 | 400 | yes |
| `LIN` | 154 | 159 | **no** |
| `CYC` | 11 | 47 | **no** |

**Cause:** `AUTOSTART`'s power cycle resets the CPU, the VIC-II and the CIAs but **not the
absolute emulated clock**, and the 1541's rotational phase is a function of that clock, so the
pre-protocol interval leaks into the disk load's byte timing. Frame-exactness holds through
anchor hit 50 and is lost from hit 75 — which is where the load begins. That boundary is
recorded in prose because the declared domain (`achieved | not-achieved`) has no value for
"achieved before the load, not after", and the domain was not widened.

## Non-input findings — the wall-clock and warp-bracket controls

**`WALLCLOCK_CONTROL: red`** and **`WARP_BRACKET_CONTROL: red`**, both from
`evidence/33-wallclock-control.md` (lines 442 and 443, column 0 — the final occurrences).

Two of the five `D-07` controls, **observed** red rather than asserted red. The warp bracket:

| | unwarped | `-warp` |
|---|---|---|
| wall-clock elapsed | 10002 ms | 10009 ms |
| expected jiffy window | 360..490 | 360..490 |
| jiffy at bracket end | **389** | **748** |
| region | **inside** | **OUTSIDE** |
| overshoot vs window centre | 0.92× | **1.76×** |

The two runs differ in exactly one argv element and the wall clock they were bracketed against
is the same to within 7 ms. See § *Accepted limits and corrections*, items 4 and 5, for the two
limits this control carries — it is red by **region overshoot, not by the spurious timeout the
ROADMAP's criterion 5 names**, and its paired positive is "materially better", not "green".

**Warp is behaviour-neutral under a frame-anchored protocol, and that was re-measured here
rather than cited.** On the real autostarted release at a pre-load frame-anchored stop,
`PC=$ea31 LIN=238 CYC=15` and one 64K sha256
`c97a08b636cba7e824d854b9a3fe15c4d18fed7b527203ac6ca3699cfc9be9d3` across all four of: warped
at jitter 0, warped at jitter 2500, and the *unwarped* run at the same target from
`33-autostart-sequencing.md`'s clean pass taken an hour earlier in a different process. Zero
differing addresses in every pairing. So: **`-warp` is invalidating for a wall-clock-anchored
bracket and behaviour-neutral for a frame-anchored one.**

## Non-input finding — the reset-removed control

**`RESET_REMOVED_CONTROL: red`**, from `evidence/33-repro02-reset-removed.md` line 696, at
column 0. The third of the five `D-07` controls, and `red` is the expected and required
observation.

The reset-removed arm's stops differ in `line`/`cycle` on all three pairs and produce **three
distinct** sha256 values, against the full protocol's one. Removing the monitor-issued hard
reset from the procedure **breaks** it, which is what makes the reset step load-bearing rather
than incidental.

**The mechanism, and the method rule it produced.** A hard reset does **not** reset the VIC-II
raster counter; the first post-reset IRQ is `raster_at_reset + constant`, so a reset issued
from an arbitrary raster phase produces an arbitrary stop phase. A monitor halt leaves `LIN`
reading **0** on this build, which is why the protocol as specified reproduces and the variant
does not. **Method rule: never add a step before the protocol's reset.** This probe's first
version added one and turned an `immune` measurement into a `not-immune` one — a **false
`no-go`** caught by a method control rather than shipped. The four voided runs and the
`PREHALT` arm are what caught it. This is also the mechanism behind `CAPTURE_FRAME_EXACT: no`:
an autostarted capture necessarily has the anchor armed and hit before the machine is
captured, so it is in exactly the `PREHALT` situation.

## Non-input finding — the transient derivation and its cap outcome

**`TRANSIENT_COUNT: 49`**, from `evidence/33-transient-derivation.md` line 97, at column 0
(the final occurrence; line 80 carries the same value). **`DERIVATION: void` is absent**, which
is correct: `SCHEMA.md` § 3 declares that line as written **only** when the union exceeded the
cap, and it did not.

All three pairwise comparisons were performed, not just the adjacent ones:

```
PAIR pair-j0.norm.bin vs pair-j2500.norm.bin: 28 differing addresses
PAIR pair-j0.norm.bin vs pair-j4000.norm.bin: 48 differing addresses
PAIR pair-j2500.norm.bin vs pair-j4000.norm.bin: 26 differing addresses
TRANSIENT_COUNT: 49
cap: 64 (committed cap 64)
```

The union (49) is larger than any single pairing (48) and smaller than their sum, which is
what a union of overlapping sets looks like. 49 is **15 under** the committed cap, so the
script wrote `src/skills/c64-ram-capture/transients/danish.json` — the phase's first committed
per-release allow-list — and exited zero. The cap was not touched and could not have been:
`TRANSIENT_ALLOW_LIST_CAP = 64` is checked first and throws with no artifact returned.

**No jitter was retried and no run was taken to get the union under the cap.** Every jitter
used is recorded — 0, 2500, 4000 — with the basis for each fixed before it was run. The
pre-committed 4000 ms rung is the one `33-03` measured **over** the cap, and that is precisely
why it could not be avoided: an input chosen to avoid a known overflow is not an input.

**How close this came to the other branch.** 48 of the 49 union addresses come from one
pairing (jitter 0 against jitter 4000), and `33-03` measured **66** — over the cap — for the
nominally corresponding comparison on a **directly launched** instance. The two are different
launches with different argv digests and are not two samples of one quantity, so 49 does not
contradict 66. What both agree on is the direction: **a frame-anchored post-load stop on this
release straddles the cap.** A future run of this same script may well void. That is the
measurement, not a flaw in it.

## Non-input finding — the memspace refusal

**`MEMSPACE_ASSERTION: refuses`**, from `evidence/33-memspace-refusal.md` line 195, at
column 0. Observed after exactly one deliberate drive-checkpoint hit, per `D-28`.

**But it rests on one of the two symptoms `P10` names, not both, and the file says so.**

| `P10` symptom | Observed in this session? |
|---|---|
| `ADVANCE_INSTRUCTIONS` steps the drive CPU rather than the main one | **not observed** — the main `PC` moved on both sides |
| a `@bank:` condition fails outright | **observed** — `err=0x00` clean, `0x8f` contaminated, twice each |

`EXECUTE_UNTIL_RETURN` (0x73), the third command `P10` mentions, was **not exercised** —
recorded as not exercised rather than left to look like an oversight. The `@bank:` sub-check
discriminated cleanly, twice on each side, with the expression byte-identical, the probe
checkpoint armed the same way at the same address (`$0326`) on the same main memspace, and the
only intervening event being the one drive checkpoint hit. **Had the assertion been defined
over the stepping symptom alone, this file would record `MEMSPACE_ASSERTION: did-not-refuse`**
— stated in the evidence file so nobody has to infer it, and `did-not-refuse` was a live
outcome of the run rather than an unreachable branch.

There is no unit test for this and that is a property of the state rather than a testing
preference: no binary-monitor command reads `default_memspace` and none resets it, so the
contaminated state is not reachable, inspectable or reversible from any surface a test could
stand on. The clean control ran **first**, which is what makes the refusal attributable — and
it was not hypothetical: it caught an assertion that could never have passed.

## Non-input finding — the `probeReady` re-check under warp and console

**`PROBEREADY_BUDGET: short`**, **`WARP_TIME_TO_BIND_MS_MAX: 3155`** and
**`CONSOLE_TIME_TO_BIND_MS_MAX: 2385`**, all from
`evidence/33-probeready-warp-console.md` (lines 398, 400 and 402, column 0).

Against a budget read from the shipped source in the same run —
`DEFAULT_PROBE_TIMEOUT_S = 1`, `BUDGET_RESOLVED_MS 1000`:

| Profile | Max observed time-to-bind | Budget | Headroom |
|---|---|---|---|
| `(absent)` | 3132 ms | 1000 ms | **−2132 ms** |
| `{warp: true}` | 3155 ms | 1000 ms | **−2155 ms** |
| `{headless: true}` | 2175 ms | 1000 ms | **−1175 ms** |
| `{warp: true, headless: true}` | 2385 ms | 1000 ms | **−1385 ms** |

**What `short` does and does not mean.** `DEFAULT_PROBE_TIMEOUT_S` is a **per-attempt**
timeout and `probeReady()` has **no retry loop** by design — a still-booting instance fails
*this* pass and is re-probed on the next, so a slow host is re-probed rather than starved. So
`short` means the first probe pass after a cold launch will always miss on this host, in every
profile, by 1.2–2.2 s. It does **not** mean a launch fails or an instance is lost. And the
shortfall is **not caused by either new flag**: the absent profile — the argv a stock launch
has always emitted — is 3132 ms, already 2.1 s over, and `-console` *reduces* it.
`LAUNCH_FAILED_PROBE_ATTEMPTS` ranged from **2 to 7** across a poll that sleeps 50 ms between
attempts.

`DECISION-RULE.md` § *Never a gate* declares this value non-gating in advance: it is a fact
about the launcher's margins, not about the reproducible-run protocol, and no threshold on it
could have been defended before the measurement existed. It is reported here rather than
buried in a plan SUMMARY precisely because it is unflattering.

## Non-input finding — the phase's `test:automated` baseline

A **recorded baseline**, never a threshold (`DECISION-RULE.md` § *Never a gate*,
`README.md` § *Evidence conventions* 4). Every live-run transcript in this phase records the
count it observed and the file names; none writes "clean" or "0 failures".

- **At the phase open:** `EXIT=1` with **5 failing tests in 3 files** —
  `anno-register.test.ts`, `docs-deferred-ledger.test.ts`, `audit-integrity.test.ts` — from
  **two** root causes Phase 33 did not create.
- **After `33-02`:** **2 failing tests in `anno-register.test.ts` only**, at `:385` and
  `:479`, `tests 3113 / suites 24 / pass 3105 / fail 2`, observed 2026-09-02 with the broker
  stopped. `33-02` repaired the other root cause (two completed `audit`-category todos still
  carrying `Pending` rows), which closed three of the five.
- **The residual root cause is out of phase and named:** the anno tool register cites
  requirement ids `STORE-01`, `STORE-04`, `STORE-06` and `MCP-04`, which
  `.planning/REQUIREMENTS.md` no longer declares — they are v0.7.0 store ids dropped by the
  v0.8.0 rewrite. The correct repair may legitimately be a carried-ids section in
  `REQUIREMENTS.md` rather than a code change, so it is recorded as an open out-of-phase
  concern. **No Deferred Items row is filed for it**, deliberately: a row with no matching
  file under `.planning/todos/pending/` reds the two-directional ledger guard in the other
  direction.

Every measurement in this phase was taken with the broker **stopped** and recorded
`BROKER_STATE: inactive` — a live broker reddens the `BACK-05` assertion deterministically, so
a measurement taken against a live-broker run reads a false baseline and every number in it is
suspect. Such a run is discarded and re-run, never repaired.

## Narrowing

The verdict is `degrade` and the fired rule `R6` **carries a pre-mapped narrowing**, so the
narrowing below is reproduced verbatim from `evidence/DECISION-RULE.md` and was **written
before the answer was known** — confirmed at `33-01` Task 1 as a blocking decision gate,
resolved by the human owner through the orchestrator before that plan was dispatched and
before any measurement in this phase existed. It is **not** authored at verdict time and is
**not** re-authored here.

> **Pre-mapped narrowing (D-04):** the oracle narrows to the two-term `(PC, hit_count)` form
> with the frame term **recorded but not asserted**, and every downstream capture pair carries
> that weakening in its own record rather than in a footnote to this document.

**Two operative consequences, both in the narrowing's own terms:**

1. **The stop-identity oracle narrows to `(PC, hit_count)`.** The frame term `(LIN, CYC)` is
   still **recorded** on every stop — it is read from the same single `REGISTERS_GET` reply and
   costs nothing — but it is **not asserted** as a conjunct of equivalence.
2. **The weakening travels in each capture pair's own record, not in a footnote here.** Any
   downstream capture pair produced under this verdict states, in its own record, that it was
   compared under a two-term oracle with the frame term recorded but not asserted. A reader of
   that pair must not have to find this document to learn what was asserted about it. This is
   the specific instruction `D-04` gave, and it is the reason a narrowing "recorded but not
   asserted" is different from a narrowing quietly dropped.

**What is *not* narrowed, stated explicitly because its absence would read as an oversight.**
`R6` is a fact about the oracle's frame term and nothing else:

- **The `REPRO-*` / `CAP-01` / `CAP-02` substrate is untouched by this branch.** `SLICER:
  validated`, `SEED_EFFECT: pinned` and `JITTER_IMMUNITY: immune` all stand on their own
  corpus-free evidence.
- **The corpus is untouched.** `C0_CAPTURE_PAIR: pass` was obtained on a real autostarted
  release with true drive emulation in the loop, so `R5`'s fixture-only branch does **not**
  apply and Phase 38 does **not** narrow to method-only. Read that `pass` for exactly what it
  supports — see § *Accepted limits and corrections*, item 6.
- **No numeric threshold moved.** `R6` is an equality test against a two-value enumerated
  domain, so the threshold-boundary contract has nothing to resolve.

The per-phase bindings for Phases 34-38, derived from this section, are written into each
phase's own ROADMAP Notes so a planner reading one phase finds them without reading this
document (`D-06`: ROADMAP `Depends on` + Notes + a `STATE.md` pointer, with **no test guard** —
a guard would encode roadmap policy in a suite belonging to a phase that ships almost no
product code, and `degrade` / "proceed, narrowed" is precisely the case such a guard cannot
check).

## Accepted limits and corrections

Every `## ACCEPTED LIMIT` any evidence file in this phase recorded, collected here so the
phase's record does not depend on plan files surviving. These are the phase's honest edges and
they reach the verdict rather than dying in a plan SUMMARY.

**1. `evidence/33-04-slicer-substrate.md` — `SLICER:` was not emitted by the plan that built
the slicer.** Half of `SCHEMA.md` § 2.4's declared derivation had no transcript because
`capture-predicate.test.ts` and `capture-seam.test.ts` did not exist at that commit.
`validated` would have been false; `failed` would have been wronger, firing `R1 → no-go` on a
sibling plan's not-yet-written file. Closed by `33-07` in the declared source file. See
§ *Input 1*.

**2. `evidence/33-autostart-sequencing.md` — three ambiguities in the frozen text, recorded
rather than resolved there.** (a) `AUTOSTART_FRAME_EXACT` has **no value** for "achieved
before the load, not after", so the pre-load result (0 differing bytes, all four terms
identical, three targets, both jitters) collapses into the same `not-achieved` as a total
failure would; the domain was not widened and the boundary is recorded in prose. (b)
`SCHEMA.md` § 3 names **two** runs; frame-exactness needs more — a two-run comparison returned
four-of-four identity on a sequence that is *not* frame-exact (`j0` against `j1200` agrees
exactly while `j2500` and `j4000` do not), so four jitters were swept and all four recorded,
with the reported pair still the first pair taken. (c) `33-RESEARCH.md` M5's prose says 27
snapshot modules; the strict walk visits **26**, and M5's own table lists 26 rows — the prose
count is off by one, not the table.

**3. `evidence/33-repro02-reset-removed.md` — `SCHEMA.md` § 2.2's aside about an autostarted
release.** § 2.2 closes by saying `JITTER_IMMUNITY` is re-measured "on an **autostarted** real
release". It was measured at the KERNAL `READY` prompt with **no corpus**, for two reasons that
are facts rather than preferences: `33-10` measured that `runReproducible()` **cannot** serve
an autostarted release at all (its hard `RESET` undoes `AUTOSTART`, and its single-resume wait
cannot count the hits an autostarted load needs — there is no configuration of this protocol
that both autostarts a release and issues the hard reset whose necessity `REPRO-02` exists to
prove); and `JITTER_IMMUNITY` is declared **corpus-free**, so a measurement requiring the
corpus would move it out of the set `D-02` names as this gate's distinguishing property. The
autostarted side is not unmeasured: `AUTOSTART_FRAME_EXACT: not-achieved` and
`CAPTURE_FRAME_EXACT: no` cover it, and the `PREHALT` arm supplies the mechanism behind both.

**4. `evidence/33-wallclock-control.md` — `WARP_BRACKET_CONTROL: red` was reached by region
overshoot, not by a spurious timeout.** The plan's own rule admits either; the ROADMAP's
success criterion 5 names **only** the timeout. The timeout form was **not observed** and the
literal instance came out `not-red` and was **reported rather than discarded**. The measured
reason: `AUTOSTART` owns warp during the load whatever argv says, and `-warp` is worth only
~**1.97×** on emulated throughput on this host — not enough to starve a once-per-frame anchor.
The domain was not widened and `red` is `red` under the declared rule, but a reader expecting
the timeout wording will not find it.

**5. `evidence/33-wallclock-control.md` — Control A's paired positive is "materially better",
not "green".** The standard for a control's attribution is not written down in the frozen
files, so the file stated the one it applied: the contrasting frame-anchored leg reaches a
genuine four-term identity with one sha256 at a **pre-load** stop (0 differing addresses),
while the post-load leg is `not-achieved` with 48. The attribution rests on the pre-load leg. A
reader taking `AUTOSTART_FRAME_EXACT: not-achieved` alone as the paired positive would
correctly object that a red-against-red pairing proves nothing.

**6. `evidence/33-capture-pair.md` and `evidence/33-transient-derivation.md` — read the
`C0_CAPTURE_PAIR: pass` for exactly what it can support.** The allow-list is the union of the
pairwise differences of runs 1, 2 and 3, and **runs 1 and 2 *are* the reported pair**. So the
pair's 28 differing addresses are inside the 49-entry list **by construction**, and the
`equivalent` verdict was determined the moment the derivation wrote an artifact at all. The
pair comparison is therefore **not an independent test of the pair**; it is a restatement of
"the union fitted under the cap". This follows from the committed method (`D-23`, N ≥ 3 runs of
one release at one stop, union of every pairwise comparison, cap 64, exceeding voids), which is
frozen — it is not a choice made there and must not be repaired by inventing a different
method. **The entire discriminating power of the result therefore sits in the cap**, which
`transients/README.md` says separates "**a frame-exact stop** from **a stop that is not**".
`CAPTURE_FRAME_EXACT: no` sits beside the `pass` on the same page, from the same runs, and
reports the opposite of what a casual reading of `pass` would suggest. **The list is not
vacuous, and that was checked rather than assumed:** a one-bit flip planted at `$C000`, outside
the 49 addresses, makes the same comparison fail (`PLANTED_COMPARE verdict=not-equivalent
differing=1 allowed=28`). 49 addresses of 65536 are allowed to differ; a single bit anywhere in
the other 65487 fails, at any bit count, with no tolerance at any address including the
allow-listed ones — those are excluded from the verdict entirely, not softened.

**7. `evidence/33-slicer-validation.md` — one route to the `CAP-03` circularity that neither
census can see.** The two structural assertions bar the capture from the oracle by **import**
and by **parameter type**. They cannot see a third route: a caller that reads the capture
itself and passes a **derived scalar** into `compareStopIdentity()` — a digest, a
differing-address count, an equivalence verdict — has reintroduced the circularity through a
`number`, and no signature or import census can distinguish that `number` from a legitimately
read register value. `stop-oracle.ts`'s own `WHAT NOT TO DO` names the derived-scalar route as
the realistic one and **forbids it in prose only**, which is the weaker instrument the stronger
two cannot reach. What would falsify the assumption that the two assertions are together
sufficient: exactly such a call site.

**8. `evidence/33-repro03-frame-anchor.md` — "exactly one frame apart", and the alternative
reading.** Reproduced and adjudicated in full in § *Verdict* → *No override was taken*. The
second half of that limit belongs here too: **what the control actually proves is not what the
line is called.** § 2.3's control establishes the insufficiency of `(LIN, CYC)` **alone**. The
line's name and § 2.3's prose call this "the necessity of the frame term", and `R6`'s narrowing
*drops* the frame term. Those are not the same claim. The measurement supports the first (the
frame term alone is insufficient) and gives **no support** to a reading in which the frame term
is the load-bearing one on this pair. Both are recorded; the value emitted is the value the
declared derivation produces.

**9. A method control caught a false `no-go`.** Recorded here because it is the phase's
strongest single argument for controls over assertions. A hard reset does **not** reset the
VIC-II raster counter, so a *checkpoint* halt placed before the reset leaves the VIC-II
mid-frame and turned an `immune` measurement into a `not-immune` one — which would have fired
`R3 → no-go`. Caught by the `PREHALT` arm and four voided runs. **Method rule: never add a step
before the protocol's reset.** This is also the mechanism behind `CAPTURE_FRAME_EXACT: no`.

**10. The packaging closure walk was repaired to stop treating an erased `import type` as a
shipping edge.** `33-09` closed a `check-npm-packages.mjs` gate that had been red since wave 3.
Recorded because the **obvious `files[]` repair was wrong and provably cascades** — a later
reader reaching for it should know it was tried.

### Two ROADMAP-note claims this phase superseded by measurement

Both notes have been given dated riders in place in `.planning/ROADMAP.md`, with the original
sentences left readable.

**A. The guards note called the whole-argv `assert.deepEqual` assertions in
`broker-launch.test.ts` "avoidable", and put them at three.** Measured: there are **five**
stock whole-argv assertions (lines 1775, 1789, 1907, 1919, 1929), and `REPRO-01`'s determinism
block is **unconditional** on stock, so **all five** changed — and they changed with `profile`
**absent**, because it is the determinism block and not the profile that moves them. Only the
`profile` half was avoidable by optionality. What survives from the note: the three *ordering*
assertions did survive additions exactly as it says, `-default` stayed at index 0 ahead of
`-binarymonitor`, and the fork branch's argv is byte-identical (a Validated v0.2.0
requirement, not merely a test).

**B. The baselines note stated "The clean floor for `test:automated` is 0 failures."**
Measured at the phase open with the broker stopped: `EXIT=1` with **5 failing tests in 3
files** from two root causes Phase 33 did not create. `33-02` repaired one, leaving **2 failing
tests in `anno-register.test.ts`** for the rest of the phase, with the residual root cause —
four v0.7.0 requirement ids (`STORE-01`, `STORE-04`, `STORE-06`, `MCP-04`) dropped by the
v0.8.0 `REQUIREMENTS.md` rewrite — recorded as an out-of-phase concern. The floor is **not
0**, and no plan in this phase adopted "`test:automated` green" as an acceptance criterion.

### The reconciliations `33-02` made to falsified decisions

Three `33-CONTEXT.md` decisions were **falsified by measurement** and carry dated
`AMENDED 2026-09-02` riders, plus one narrowing. The originals are left readable in every case.

**`D-21` — the slicer's exact-length assertion is falsified.** `4 + 65536` is 65540, and the
measured `C64MEM` body on this host is **65555**: VICE writes three more port bytes and two
DWORD falloff clocks plus four more state bytes after the RAM array
(`4 + 65536 + 3 + 4 + 4 + 4 = 65555` at snapshot minor 1, and `4 + 65536 + 3 = 65543` at minor
0, which the reader also accepts). The assertion became `body.length >= 65543`
(`MIN_C64MEM_BODY_LEN = 65543`, `V01_C64MEM_BODY_LEN = 65555`).

**`D-24` — the prefix-over-RAM half of the `$0000`/`$0001` normalisation is falsified.** The
4-byte prefix is `(pport.data, pport.dir, EXROM, GAME)` — *data first*, address-swapped
relative to the decision's own sentence. And the CPU-visible values are neither of those:
`zero_read()` returns `pport.dir_read` for `$0000` and `pport.data_read` for `$0001`, and those
two fields live in the **3-byte suffix immediately after the RAM array**, not in the prefix.
What survives: the normalisation happens **in code, once**, and never by spending two of the
cap's 64 slots.

**`D-25` — the "keep `compare.mjs`'s classification shape" half is falsified.**
`compare.mjs`'s volatile set is four **ranges** covering **4866** addresses
(`$0000-$0001`, `$0100-$01FF`, `$0200-$03FF`, `$D000-$DFFF`), and its drift rule lets *any*
single-bit difference pass anywhere. `CAP-02` forbids both. Concrete consequence: a control
planting a one-bit difference against an inherited predicate **PASSES**, so the fail-ability
guard would prove nothing. What is inheritable is the reporting vocabulary and nothing else.

**`D-15` — a narrowing, not a falsification** (the research's own second table classifies it
that way). See item A above: five stock whole-argv assertions rather than three, all five moved
by the unconditional determinism block with `profile` absent, and byte-identity holding in full
only on the **fork** branch.
