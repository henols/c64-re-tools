# PROOF-04 — the false-positive count, closed

This is the record `PROOF-04` closes on. It states the false-positive count
with its denominator and its positive class, places `PROOF-01`'s recorded
figures beside it rather than over them, names what this phase discharges
and what it does not, and states every limit that bounds it. A committed
gate (`proof04-verify-record.mjs`) re-derives every number below from the two
run transcripts alone and refuses on any disagreement, so this record's
internal consistency is mechanically checked rather than promised.

## What was measured, and the rule it was measured against

The question is `PROOF-01`'s own false-positive count, recorded there as
`PROOF01_FALSE_POSITIVES: structurally-uncomputable` because the byte-derived
tier's `certainCode` set is always empty by that tier's own design. The oracle
supplying the missing check is observed execution from a real emulator run,
captured through `memmapshow`'s execute bit and durably ingested. The subject
is dxa's own static, byte-derived classification of the same release's same
extracted entry `PROOF-01` measured. The join is `reconcileObservedExecution()`
(`src/mcp/vice/evid-reconcile.ts`), shipped in the prior milestone's runtime
evidence layer and unexercised on real cracked code until this phase. The
derivation rule that decides `resolved`/`unresolved`/`not-exercised` and the
`frame-exact-region`/`narrowed` depth label lives in exactly one place,
`evidence/SCHEMA.md`, and this record cites it rather than restating it.
`SCHEMA.md` was committed at `c62c261b`, before either run below: Run A landed
at `00450ac3` and Run B at `dd1517e8`, both strictly later commits than the
rule that decided their verdicts. The rule was fixed before either value it
was later applied to, which is what makes this a proof by this project's own
standard rather than a number with a story attached after the fact.

## The count

| Run | Anchor hit target | `ORACLE_DEPTH_REACHED` | `ORACLE_DEPTH_LABEL` | `PROOF04_FALSE_POSITIVES` | `PROOF04_DENOMINATOR` | `PROOF04_BLOCK_ADDRESSES_OBSERVED` | `PROOF04_VERDICT` |
|---|---|---|---|---|---|---|---|
| `run-a-hit50` (licensed) | 50 | 50 | `frame-exact-region` | 168 | 45072 | 168 | `resolved` |
| `run-b-narrowed` (deeper) | 3000 | 3000 | `narrowed` | 434 | 45072 | 434 | `resolved` |

The positive class, stated once in words: an address the byte-derived tier
classified `data` and the emulator was observed executing. The tier is
`runtime-observed` -- both read from `reconcileObservedExecution()`'s own
return fields, never asserted by either driver script.

Formed as a percentage, to exactly two decimal places, using standard
rounding, beside its own integer numerator and denominator:

`PROOF04_FALSE_POSITIVE_PCT run-a-hit50` -- 0.37(168/45072)

`PROOF04_FALSE_POSITIVE_PCT run-b-narrowed` -- 0.96(434/45072)

`PROOF04_DENOMINATOR` is nonzero in both runs, so both percentages above are
formed; had either run's denominator read 0, this record would form no
percentage for it and would say so in this same place rather than silently
omitting the row.

## Beside it, not instead of it

Three figures from `PROOF-01`'s own committed record, transcribed verbatim
with the source path, never re-derived by running dxa again and never
replaced by anything this phase measured:

- `PROOF01_DATA_RECOVERY_PCT 100.00 (24/24)` -- the real-release recall on
  `BRUCE LEE   (DC)`, source
  `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.md`.
- `FIXTURE_DATA_RECOVERY_PCT 72.39 (97/134)` -- the unchanged fixture figure,
  same source.
- `PIVOT_PUBLISHED_DATA_RECOVERY_PCT 72.46 (100/138)` -- the pivot's own
  published figure, same source, cited beside and never treated as ground
  truth.

Also transcribed, because it is exactly what this phase discharges:
`PROOF01_FALSE_POSITIVES: structurally-uncomputable (certainCode.size is 0 on
the byte-derived tier)`, and the reversal condition it was left carrying,
`PROOF01_WEAKNESS_NO_EXTERNAL_CHECK`, whose recorded discharge condition reads
"a binary-monitor-reachable execution oracle becomes available to this
project, or an owner decision reopens the text-monitor channel that would let
such an oracle be built" -- closed here by the second branch, deliberately.

The real-release denominator (24) is a structurally narrower fact than the
fixture's denominator (134), not a smaller sample of the same thing --
`PROOF-01`'s own record states this explicitly and this record does not blur
it while placing the numbers side by side: the byte-derived tier can only
ever certify the two-byte header exclusion and a cleanly-parsing BASIC stub's
own bytes, and says nothing about the packed game code that follows.

One sentence stating the direction of each measurement, so neither is read as
superseding the other: `PROOF01_DATA_RECOVERY_PCT` and the fixture/pivot
figures beside it measure **recall** of the byte-derived tier's positive class
`data` -- how much of what should be data, dxa actually called data. The new
`PROOF04_FALSE_POSITIVES` count measures the opposite direction: **false
positives** of that same tier's `data` calls, checked against an external,
independently-produced oracle that never saw dxa's guess. A recall figure and
a false-positive count are not the same claim and neither one supersedes the
other.

## Why this check is independent of the thing it checks

The independence is stated here as a mechanism, not an intention. Two
separately-invoked Node processes: `evidence/proof04-subject-dxa.mjs` reaches
only dxa's own classification path, and `evidence/proof04-oracle-memmap.mjs`
reaches only the live emulator and the text-monitor parsing path. Each
producer's own import boundary is closed against the other's domain -- the
subject producer never imports anything from the oracle's textmon/probe-harness
domain, and the oracle producer never imports anything from the subject's
dxa/block-classifier domain. Neither producer names, reads, or can name the
other's output artifact; each writes its own JSON file and prints its own
sha256, and the join script (`evidence/proof04-reconcile.mjs`) is the only
script that reads both, by path, after both have already finished running.
The join itself is a pure function over two arrays already read from files it
did not produce -- `reconcileObservedExecution()` never fetches either side
and never opens a store, a socket, or a child process.

All four of these properties -- the closed import boundary in both
directions, the inability of either producer to name the other's artifact,
and the join calling `reconcileObservedExecution()` exactly once -- are
asserted by `evidence/proof04-independence.test.ts`, itself proven non-vacuous
against a planted violation in both directions, per this project's own
Non-Vacuous Verification rule (`ENGINEERING_RULES.md` section 6): the test was
observed to fail when a forbidden import was deliberately planted, then
reverted.

Against this project's own Independent Oracle Rule evidence hierarchy
(`ENGINEERING_RULES.md` section 7), the level reached here is the top of the
ladder: real external system, live end-to-end behavior -- because the oracle
is a real, genuine stock emulator run against real cracked code, not a
fixture standing in for one.

## What is a count and never a class

`PROOF04_BLOCK_COVERED_NEVER_OBSERVED` (44904 for `run-a-hit50`, 44638 for
`run-b-narrowed`) is a count against `PROOF04_DENOMINATOR` and nothing else.
An address never observed executing proves nothing about whether it is code
or data -- the runtime evidence layer's own record states this precisely:
"The absence of a row is the absence of an assertion. It is never an
assertion that the address is data"
(`.planning/phases/43-the-runtime-evidence-layer/evidence/phase43-runtime-evidence-layer.md`). No sentence in this record, or in
either run's own transcript, pairs the never-observed bucket with a
conclusion that those addresses are settled as data, established as data, or
in any other way known to be data. Reading absence as "the rest must be
data" would be exactly the inference this project's own runtime evidence
layer forbids, and this record makes none.

`PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK` (890 for `run-a-hit50`, 1392 for
`run-b-narrowed`) is reported and is **not** part of `PROOF04_DENOMINATOR`.
An observed execute at an address no block covers -- the KERNAL and BASIC ROM,
the I/O window -- is real evidence about an address the block table never
classified at all, and reporting it as its own named count, separate from the
denominator, is what keeps the denominator from silently dropping real
evidence while claiming to account for it.

## Shortfalls and limits

Named separately, on `PROOF-01`'s own precedent of naming each weakness on
its own rather than folding them together.

### PROOF04_LIMIT_DEPTH

`run-a-hit50` reached anchor hit 50, at or below the licensed threshold, so
its label is `frame-exact-region`. `.planning/phases/43-the-runtime-evidence-layer/evidence/phase43-instrumentation-perturbation-ab.md`
states the licensing sentence verbatim: "This `no-perturbation` verdict
licenses **only** the claim that this project's own instrumentation dials
(`memmapzap` pre-`AUTOSTART`, `memmapshow` post-stop) do not perturb
frame-exactness at anchor hit depths of 50 or below." The same document's own
frame-exactness boundary, quoted from
`.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md`:
"`S3` | connect -> arm anchor -> `AUTOSTART` -> count hits -> `REGISTERS_GET`
| **yes** -- the sequence that works | frame-exact and byte-identical to hit
50; diverging from hit 75." `run-a-hit50` sits exactly at that boundary, not
past it, so its licensed claim is the narrowest available one: at this depth,
this project's own instrumentation dials do not perturb frame-exactness.

`run-b-narrowed` reached anchor hit 3000, nearly two orders of magnitude past
the point where `S3` was measured diverging from hit 75, so its label is
`narrowed` and `EVID-06`'s licensing sentence does not extend to it. Any
comparison of `run-b-narrowed`'s capture against a prior frame-exact capture
is narrowed rather than assumed. What the `narrowed` label does **not**
weaken: an observed execute at an address is still an observed execute, so
`PROOF04_FALSE_POSITIVES` (434) and `PROOF04_DENOMINATOR` (45072) stand as
counts exactly as firmly as `run-a-hit50`'s did. It is the reproducibility /
frame-exactness claim that is narrowed at this depth, not the disagreement
count itself.

### PROOF04_LIMIT_SELF_MODIFICATION

The subject classifies the release's file bytes as loaded at `$0801`. The
oracle observes whatever occupied an address at the moment the CPU executed
it. On a cracked release those are not always the same byte: a loader or
depacker that writes over its own region, or over the region it just
decompressed, makes an observed execute at address A evidence that A held
code at that moment, not that the original file byte at A was code. This does
not weaken the false-positive count as a statement about the byte-derived
tier's classification being wrong at A -- an address the static tier called
`data` and the machine executed is a genuine miss either way -- but it bounds
any reading of the count as "dxa mis-parsed these specific file bytes". At
anchor hit 50 this caveat is a limit on interpretation rather than a specific
known instance; at anchor hit 3000, well past the pre-load region, the same
caveat applies with more force, since the disagreement count at that depth
may include addresses the release itself overwrote during depacking or
loading. Both run transcripts (`evidence/proof04-run-a-hit50.md`,
`evidence/proof04-run-b-narrowed.md`) state this caveat in their own
`PROOF04_SELF_MODIFICATION_CAVEAT` section, and this record carries it
forward rather than smoothing it away.

### PROOF04_LIMIT_ONE_RELEASE

`saeger.d64` was not taken (planner decision D-P3, `44-01-PLAN.md`), for the
same reason `PROOF-01` declined it: a second release doubles the live-testing
surface without changing whether the false-positive count is computable,
which is the reversal condition this phase closes. The count this record
states is a fact about dxa on this one binary, `danish.d64`'s
`BRUCE LEE   (DC)` entry. It says nothing about dxa in general, and nothing
about how dxa performs on any other release.

### PROOF04_LIMIT_ONE_CLASSIFIER

Ghidra strengthening and a `chis` cross-confirmation were both available and
both declined (planner decision D-P6, `44-01-PLAN.md`), because dxa alone
supplied `PROOF-01`'s original classification, and dxa alone is the
classifier whose count this phase makes computable. Adding a second static
classifier would change what is being measured. The subject of this record is
dxa, and only dxa.

Neither run recorded in this phase is `unresolved`, so no
`PROOF04_LIMIT_COVERAGE_SHORTFALL` subsection is needed: both runs reached
their anchor stop, both joins ran, and both produced `PROOF04_BLOCK_ADDRESSES_OBSERVED`
counts of at least 1 (168 and 434 respectively).

## What this phase does not close

- `PROOF-03` on real cracked code stays carried and unowned. It was proven in
  both directions on a synthetic two-caller fixture; the `danish.d64` question
  stays open and stays recorded as open. Nothing in this phase satisfies it,
  including as a side effect -- this phase's subject and oracle answer a
  different question (false positives in dxa's `data` classification against
  observed execution), not the bank-boundary annotation question `PROOF-03`
  leaves open.
- `ANNO-13` (generated bit-name enums) and `ANNO-14` / `ANNO-15` (the symbol
  round trip) are not restored. The prior "no parity is owed" decision stands.
- The carried frame-exactness limits from the milestone that shipped the
  reproducible-run protocol are unchanged and still bind: the `S3` sequence is
  frame-exact and byte-identical to anchor hit 50 and diverging from hit 75,
  because `AUTOSTART`'s power cycle does not reset the absolute emulated
  clock. This is exactly why `run-b-narrowed` carries the `narrowed` label
  above rather than a frame-exactness claim.
- The self-modification bound above: an observed execute proves the address
  held code at that moment, which is a genuine miss by the byte-derived tier
  either way, but does not by itself prove the original file byte at that
  address was code.
- The subject is dxa alone. Ghidra strengthening and a `chis` cross-check were
  both available and both declined, because dxa alone is the classifier whose
  count `PROOF-01` left uncomputable.
- One release. `saeger.d64` was not taken, so the count says nothing about
  dxa in general -- only about dxa on this one binary.

## The recorded outcome lines

Every `SUBJECT_*`, `ORACLE_*` and `PROOF04_*` value below is transcribed from
the two committed run transcripts (final occurrence wins, matching the
convention both transcripts already state for themselves), plus the roll-up
`PROOF04_PHASE_VERDICT` derived from `SCHEMA.md`'s roll-up rule across the two
per-run verdicts above. `TEST_AUTOMATED_BASELINE` and each run's `BROKER_STATE`
line are appended by Task 2's own `## Integrity cross-check and suite
baseline` section below, taken at the same time as the suite reading rather
than re-stated here ahead of that measurement. `ORACLE_VICE_VERSION` and
`ORACLE_SPAWN_ARGV` are deliberately not restated here: both values are fully
recorded, once each, in their own run's committed transcript
(`evidence/proof04-run-a-hit50.md`, `evidence/proof04-run-b-narrowed.md`),
cited by path, and are not repeated in this file because both contain either
a version number or embedded IP-address octets shaped exactly like an
unformatted percentage -- restating either here would trip this same
record's own two-decimal percentage-shape requirement over a token that is
not a percentage at all. Omitting them changes no measured value; the
transcripts remain the authoritative source for both fields.

Shared subject identity (identical across both runs, so anchor depth was the
only variable):

```
SUBJECT_ARTIFACT_SHA256 db8bd51a5259427cf61cacf3b3d0df4413400c3118699987167d69aa13e41f8a
```

Run A (`run-a-hit50`):

```
PROOF04_LABEL run-a-hit50
ORACLE_BROKER_STATE inactive
BROKER_STATE: inactive
ORACLE_RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
ORACLE_VICE_BINARY /usr/bin/x64sc
ORACLE_DEPTH_TARGET 50
ORACLE_DEPTH_REACHED 50
ORACLE_DEPTH_LABEL frame-exact-region
ORACLE_SHORT_RUN false
ORACLE_MAP_ENTRIES 43355
ORACLE_PARSE_REFUSAL none
ORACLE_SEED 4242
ORACLE_ARGV_DIGEST 967c932acfc176431a898e9241f6966cce8e62e0be4946995d6474917074559d
ORACLE_EXEC_OBSERVATIONS 1058
ORACLE_ARTIFACT_SHA256 d4d7b55be9b2c6e3dc60dc456eacceacf2d3f1fd05ad9a65e0e03ffe5fbc6c60
ORACLE_ARTIFACT_PATH /home/henrik/.cache/c64-re-tools/phase44/run-a-hit50/oracle-memmap.json
PROOF04_POSITIVE_CLASS code
PROOF04_TIER runtime-observed
PROOF04_FALSE_POSITIVES 168
PROOF04_AGREEMENTS 0
PROOF04_BLOCK_COVERED_NEVER_OBSERVED 44904
PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK 890
PROOF04_OBSERVED_AT_UNDEFINED_BLOCK 0
PROOF04_DENOMINATOR 45072
PROOF04_BLOCK_ADDRESSES_OBSERVED 168
PROOF04_VERDICT resolved
PROOF04_ARTIFACT_SHA256 77bdfd6524de4d79b83623e09cca844d78edd4360bcb60b99be09efc63137074
PROOF04_ARTIFACT_PATH /home/henrik/.cache/c64-re-tools/phase44/run-a-hit50/reconcile.json
PROOF04_FALSE_POSITIVE_PCT 0.37(168/45072)
```

Run B (`run-b-narrowed`):

```
PROOF04_LABEL run-b-narrowed
ORACLE_BROKER_STATE inactive
BROKER_STATE: inactive
ORACLE_RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
ORACLE_VICE_BINARY /usr/bin/x64sc
ORACLE_DEPTH_TARGET 3000
ORACLE_DEPTH_REACHED 3000
ORACLE_DEPTH_LABEL narrowed
ORACLE_SHORT_RUN false
ORACLE_MAP_ENTRIES 44694
ORACLE_PARSE_REFUSAL none
ORACLE_SEED 4242
ORACLE_ARGV_DIGEST cd1bc83585e80bda9c4f506c8624c8354a221bd7755ab0032832e15d9614ea55
ORACLE_EXEC_OBSERVATIONS 1826
ORACLE_ARTIFACT_SHA256 5833092f55207ca70a82fa3b427520754f0669d6f46cf4582f1398f71789a126
ORACLE_ARTIFACT_PATH /home/henrik/.cache/c64-re-tools/phase44/run-b-narrowed/oracle-memmap.json
PROOF04_POSITIVE_CLASS code
PROOF04_TIER runtime-observed
PROOF04_FALSE_POSITIVES 434
PROOF04_AGREEMENTS 0
PROOF04_BLOCK_COVERED_NEVER_OBSERVED 44638
PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK 1392
PROOF04_OBSERVED_AT_UNDEFINED_BLOCK 0
PROOF04_DENOMINATOR 45072
PROOF04_BLOCK_ADDRESSES_OBSERVED 434
PROOF04_VERDICT resolved
PROOF04_ARTIFACT_SHA256 f9b805271afac3e8e934e8b1ef6551c3ae368c15fa9df317c6ef3718cea9bfa0
PROOF04_ARTIFACT_PATH /home/henrik/.cache/c64-re-tools/phase44/run-b-narrowed/reconcile.json
PROOF04_FALSE_POSITIVE_PCT 0.96(434/45072)
```

Roll-up, derived from `SCHEMA.md` section 4 across the two per-run verdicts
above (`resolved` iff at least one recorded run is `resolved` -- both are):

```
PROOF04_PHASE_VERDICT resolved
```

## Integrity cross-check and suite baseline

**The gate.** `evidence/proof04-verify-record.mjs`, run against this committed
record and the two committed transcripts, printed:

```
RECORDGATE_RUN_AGREEMENT pass
RECORDGATE_SUBJECT_DIGEST pass
RECORDGATE_SUBJECT_DIGEST_DETAIL both transcripts cite db8bd51a5259427cf61cacf3b3d0df4413400c3118699987167d69aa13e41f8a
RECORDGATE_BUCKET_IDENTITY pass
RECORDGATE_DEPTH_LABEL pass
RECORDGATE_VERDICT_RULE pass
RECORDGATE_ROLLUP pass
RECORDGATE_ROLLUP_DETAIL PROOF04_PHASE_VERDICT=resolved matches roll-up of resolved, resolved
RECORDGATE_PERCENTAGE_SHAPE pass
RECORDGATE_RESULT pass
```

Exit code `0`, seven named assertions (`RUN_AGREEMENT`, `SUBJECT_DIGEST`,
`BUCKET_IDENTITY`, `DEPTH_LABEL`, `VERDICT_RULE`, `ROLLUP`,
`PERCENTAGE_SHAPE`), all `pass`.

**The planted-violation proof (non-vacuity).** A scratch copy of this record
was made under `$HOME/.cache/c64-re-tools/phase44/planted/record.md` (never
inside this checkout), with its first `PROOF04_DENOMINATOR ` line altered from
`45072` to `999999999 45072` by a single `sed` substitution on the run-a-hit50
bucket. Run against that copy via `--record`, the gate printed:

```
RECORDGATE_RUN_AGREEMENT fail
RECORDGATE_RUN_AGREEMENT_DETAIL run-a-hit50: PROOF04_DENOMINATOR expected(transcript)=45072 found(record)=999999999 45072
RECORDGATE_SUBJECT_DIGEST pass
RECORDGATE_BUCKET_IDENTITY fail
RECORDGATE_BUCKET_IDENTITY_DETAIL run-a-hit50: bucket sum 168+0+44904+0=45072 expected(denominator)=999999999
RECORDGATE_DEPTH_LABEL pass
RECORDGATE_VERDICT_RULE pass
RECORDGATE_ROLLUP pass
RECORDGATE_PERCENTAGE_SHAPE fail
RECORDGATE_PERCENTAGE_SHAPE_DETAIL run-a-hit50: PROOF04_FALSE_POSITIVE_PCT denominator=45072 expected(PROOF04_DENOMINATOR)=999999999 45072
RECORDGATE_RESULT fail
```

Exit code `1`. A single altered `PROOF04_DENOMINATOR` value reds exactly the
three assertions this record's own design ties to it -- `RUN_AGREEMENT`
(the record no longer matches its own transcript), `BUCKET_IDENTITY` (the four
buckets no longer sum to the corrupted denominator), and `PERCENTAGE_SHAPE`
(the derived `PROOF04_FALSE_POSITIVE_PCT` line's own denominator no longer
matches the same corrupted bucket value it is checked against) -- while
`SUBJECT_DIGEST`, `DEPTH_LABEL`, `VERDICT_RULE` and `ROLLUP` correctly stay
`pass`, since none of their own inputs were touched by this one edit. The
scratch copy was deleted after this proof; nothing altered is left anywhere
in this checkout.

**Broker and process state at the time of the reading.**

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

`ORACLE_BROKER_STATE inactive` (both runs, above) and this reading agree: no
live broker and no surviving `x64sc` process at any point in this plan.

**The automated-subset suite reading**, taken with the broker confirmed
inactive per the check immediately above (a live broker deterministically
reddens `vice-proxy.test.ts`'s `BACK-05` case, so a reading taken with one up
would measure the broker and not this phase):

```
$ cd src/mcp/vice && npm run test:automated
...
ℹ tests 4051
ℹ pass 4035
ℹ fail 3
```

```
TEST_AUTOMATED_BASELINE tests=4051 pass=4035 fail=3
```

This project's own automated-subset floor is **three** pre-existing failures
in `anno-register`/`anno-import`, not zero, per the `STORE-06`
undeclared-requirement-id bookkeeping cause standing note. The observed fail
count (3) sits exactly at that documented floor -- no additional failure was
introduced by this plan. The three failing tests, named individually rather
than folded into the floor count:

- `anno-import.test.ts:352`
- `anno-register.test.ts:385`
- `anno-register.test.ts:479`

All three assert that every `anno_*` MCP tool's own requirement-id citation is
declared in `.planning/REQUIREMENTS.md`; the standing cause is bookkeeping
(a handful of requirement ids referenced by tool registration entries --
`STORE-01`, `STORE-04`, `STORE-06`, `IMP-01`, `IMP-02`, `AUTO-01`, `MCP-04` --
are not yet declared in `REQUIREMENTS.md`), unrelated to anything this plan
touched. No test outside this named set of three failed.

**The four doc-guard tests**, run from `src/mcp/vice` after every file this
phase introduced existed on disk:

```
$ node --test docs-dangling-refs.test.ts docs-linerefs.test.ts comment-phase-pointers.test.ts shipped-modules.test.ts
...
ℹ tests 50
ℹ pass 50
ℹ fail 0
```

Exit code `0`. This phase's new documents (`proof04-false-positives.md`,
`proof04-verify-record.mjs`) introduced no dangling reference, no
line-reference drift, no phase number baked into a shipped string literal,
and no change to the shipped module set.

**The phase's own structural gates**, re-confirmed after every file in this
phase existed:

```
$ node --test evidence/proof04-independence.test.ts
...
ℹ tests 7
ℹ pass 7
ℹ fail 0

$ node evidence/proof04-reconcile.mjs --self-check
SELFCHECK_RESULT pass
```

Both exit `0`.
