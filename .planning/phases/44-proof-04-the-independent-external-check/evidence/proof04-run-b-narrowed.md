# PROOF-04, Run B -- the deeper, narrowed run

**What this run is:** a second live pass against genuine stock
`/usr/bin/x64sc` (VICE 3.9), at a deeper anchor hit target than Run A, so
the measurement is not limited to the pre-load / early-run region. Joins
`proof04-oracle-memmap.mjs`'s runtime-observed execution capture against the
SAME subject artifact Run A cited -- never a re-produced one -- through
`evid-reconcile.ts`'s `reconcileObservedExecution()`. The derivation rule
that produced this run's verdict lives in exactly one place:
`evidence/SCHEMA.md`; this transcript cites it and does not restate it.

**This run does not replace Run A (`proof04-run-a-hit50.md`), and Run A does
not replace this one: the two are recorded beside each other, at their two
depths, with their two labels.**

Fixed inputs (SCHEMA.md section 1), identical to Run A except depth target:

- Binary: `/usr/bin/x64sc`, resolved by absolute path.
- Release: `danish.d64`, sha256
  `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`.
- Entry: `BRUCE LEE   (DC)`, sha256
  `331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4`, 45074
  bytes.
- Seed: `4242` (from `STOCK_DETERMINISM_FLAGS`, unmodified).
- Depth target: `3000` -- roughly sixty seconds of emulated PAL frames past
  `AUTOSTART`, deeper than Run A's licensed 50.
- Budget: the script's own shipped default `countHits` budget, `180000` ms.
  No `--budget`-style flag exists on `proof04-oracle-memmap.mjs`'s CLI
  surface (only `--depth`, `--label`, `--out`), and none was added for this
  invocation per this task's own instruction ("do not add a new flag to the
  script for this"). The run completed well inside that default budget --
  see the timed command below -- so no budget shortfall occurred and none
  needed raising.

## Pre-run state

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

BROKER_STATE: inactive

## Subject artifact -- the SAME one Run A cited, not re-produced

```
$ sha256sum /home/henrik/.cache/c64-re-tools/phase44/subject/subject-dxa.json
db8bd51a5259427cf61cacf3b3d0df4413400c3118699987167d69aa13e41f8a  /home/henrik/.cache/c64-re-tools/phase44/subject/subject-dxa.json
```

SUBJECT_ARTIFACT_SHA256 db8bd51a5259427cf61cacf3b3d0df4413400c3118699987167d69aa13e41f8a

This is the identical value `proof04-run-a-hit50.md` cites. Anchor depth is
therefore the only variable between the two runs in this plan.

## The oracle run, depth 3000

```
$ time node .planning/phases/44-proof-04-the-independent-external-check/evidence/proof04-oracle-memmap.mjs --depth 3000 --label run-b-narrowed --out $HOME/.cache/c64-re-tools/phase44/run-b-narrowed/oracle-memmap.json > $HOME/.cache/c64-re-tools/phase44/run-b-narrowed/oracle.log 2>&1; echo "oracle_exit=$?"
real	0m46.521s
user	0m42.891s
sys	0m2.005s
oracle_exit=0

$ cat $HOME/.cache/c64-re-tools/phase44/run-b-narrowed/oracle.log
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
ORACLE_BROKER_STATE inactive
ORACLE_RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
ORACLE_VICE_BINARY /usr/bin/x64sc
ORACLE_VICE_VERSION x64sc (VICE 3.9)
ORACLE_SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:46407","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:36291"]
ORACLE_DEPTH_TARGET 3000
ORACLE_DEPTH_REACHED 3000
ORACLE_SHORT_RUN false
ORACLE_DEPTH_LABEL narrowed
ORACLE_MAP_ENTRIES 44694
ORACLE_PARSE_REFUSAL none
ORACLE_SEED 4242
ORACLE_ARGV_DIGEST cd1bc83585e80bda9c4f506c8624c8354a221bd7755ab0032832e15d9614ea55
ORACLE_EXEC_OBSERVATIONS 1826
ORACLE_ARTIFACT_SHA256 5833092f55207ca70a82fa3b427520754f0669d6f46cf4582f1398f71789a126
ORACLE_ARTIFACT_PATH /home/henrik/.cache/c64-re-tools/phase44/run-b-narrowed/oracle-memmap.json
```

The full run reached its target: `ORACLE_DEPTH_REACHED 3000` equals
`ORACLE_DEPTH_TARGET 3000`, `ORACLE_SHORT_RUN false`. Exactly one Exec
checkpoint was armed at the frame anchor by `armStoppingExec()` inside this
script's own fixed sequence -- no sweep, no additional checkpoint arming;
this run's own arming call is the single `armed` result the script's
`takeOracleRun()` obtains before `AUTOSTART`, and no other checkpoint-arming
command appears anywhere in the quoted log above or in `proof04-oracle-memmap.mjs`'s
fixed sequence. `armStoppingExec()` itself prints no console line (it is a
bare `client.send()`), so this transcript states the fact in prose rather
than quoting a line the script never emits: `ARMED` -- one stopping Exec
checkpoint at `$ea31`, taken once, before `AUTOSTART`, and never re-armed
for the remainder of this run.

Post-oracle process check, before the join:

```
$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

## The join

```
$ node .planning/phases/44-proof-04-the-independent-external-check/evidence/proof04-reconcile.mjs --subject $HOME/.cache/c64-re-tools/phase44/subject/subject-dxa.json --oracle $HOME/.cache/c64-re-tools/phase44/run-b-narrowed/oracle-memmap.json --label run-b-narrowed --out $HOME/.cache/c64-re-tools/phase44/run-b-narrowed/reconcile.json > $HOME/.cache/c64-re-tools/phase44/run-b-narrowed/reconcile.log 2>&1; echo "reconcile_exit=$?"
reconcile_exit=0

$ cat $HOME/.cache/c64-re-tools/phase44/run-b-narrowed/reconcile.log
PROOF04_LABEL run-b-narrowed
PROOF04_POSITIVE_CLASS code
PROOF04_TIER runtime-observed
PROOF04_FALSE_POSITIVES 434
PROOF04_AGREEMENTS 0
PROOF04_BLOCK_COVERED_NEVER_OBSERVED 44638
PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK 1392
PROOF04_OBSERVED_AT_UNDEFINED_BLOCK 0
PROOF04_DENOMINATOR 45072
PROOF04_BLOCK_ADDRESSES_OBSERVED 434
PROOF04_BUCKET_IDENTITY_OK true
PROOF04_VERDICT resolved
PROOF04_DISAGREEMENT_HEAD $a3fb $a3fc $a3fe $a400 $a402 $a403 $a405 $a407 $a408 $a40a $a434 $a474 $a476 $a478 $a47b $a47d $a480 $a483 $a486 $a488 $a48a $a48d $a48e $a490 $a492 $a494 $a496 $a499 $a560 $a562 $a565 $a567
PROOF04_ARTIFACT_SHA256 f9b805271afac3e8e934e8b1ef6551c3ae368c15fa9df317c6ef3718cea9bfa0
PROOF04_ARTIFACT_PATH /home/henrik/.cache/c64-re-tools/phase44/run-b-narrowed/reconcile.json
```

The full disagreement row list (434 addresses) and the full access map
(44694 entries) are **not** reproduced above -- `PROOF04_DISAGREEMENT_HEAD`
caps the shown addresses at 32, per SCHEMA.md section 7. The complete rows
live only in the uncommitted JSON artifacts cited by path and sha256 above;
neither artifact is committed to this checkout.

## Post-run state

```
$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

No `x64sc` process survived this run.

## Depth label: narrowed -- what this costs and what it does not

`ORACLE_DEPTH_REACHED` is `3000`, above the threshold of 50, so
`ORACLE_DEPTH_LABEL` is `narrowed` (SCHEMA.md section 5).

`docs/phase43-instrumentation-perturbation-ab.md` (lines 152-156) states the
licensing sentence verbatim, and it does not extend here:

> This `no-perturbation` verdict licenses **only** the claim that this
> project's own instrumentation dials (`memmapzap` pre-`AUTOSTART`,
> `memmapshow` post-stop) do not perturb frame-exactness at anchor hit depths
> of 50 or below.

`.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md`
(line 236) states the `S3` row verbatim -- the hit-50 / hit-75 boundary this
run is well past:

> `S3` | connect → arm anchor → `AUTOSTART` → count hits → `REGISTERS_GET` |
> **yes** — the sequence that works | frame-exact and byte-identical to hit
> 50; diverging from hit 75

`S3` is measured frame-exact and byte-identical to hit 50 and diverging from
hit 75, because `AUTOSTART`'s power cycle does not reset the absolute
emulated clock. This run's anchor hit target (3000) is nearly two orders of
magnitude past that hit-75 divergence point. Therefore: this run is
labelled `narrowed`, and any comparison against v0.8.0's frame-exact captures
is narrowed rather than assumed -- this run's own frame-exactness /
reproducibility claim at hit 3000 is NOT licensed by `EVID-06`, and no
sentence in this transcript asserts one.

**What the `narrowed` label does NOT weaken:** an observed execute at an
address is still an observed execute, so `PROOF04_FALSE_POSITIVES` (434) and
`PROOF04_DENOMINATOR` (45072) stand as counts exactly as firmly as Run A's
did -- it is this run's reproducibility / frame-exactness claim that is
narrowed, not the observation itself. The disagreement count is not weakened
by the label.

**Neither run replaces the other.** Run A (hit 50, `frame-exact-region`) and
Run B (hit 3000, `narrowed`) are recorded beside each other, at their two
depths, with their two labels; this file does not supersede Run A's number
and Run A's file does not supersede this one's.

## PROOF04_SELF_MODIFICATION_CAVEAT

The subject classifies the release's file bytes as loaded at `$0801`. The
oracle observes whatever occupied an address at the moment the CPU executed
it. On a cracked release those are not always the same byte: a loader or
depacker that writes over its own region, or over the region it just
decompressed, makes an observed execute at address A evidence that A held
code *at that moment*, not that the original file byte at A was code. This
does not weaken the false-positive count as a statement about the
byte-derived tier's classification being wrong at A -- an address the static
tier called `data` and the machine executed is a genuine miss either way --
but it does bound any reading of the count as "dxa mis-parsed these specific
file bytes". At anchor hit 3000 -- well past the pre-load region -- this
caveat applies with more force than at Run A's shallower depth: the
disagreement count at this depth may include addresses the release itself
overwrote during depacking or loading, and this transcript states that as a
limit on interpretation rather than smoothing it away.

## Verdict

`PROOF04_VERDICT resolved`. `PROOF04_FALSE_POSITIVES` is `434` against
`PROOF04_DENOMINATOR` `45072`. `PROOF04_BUCKET_IDENTITY_OK` is `true`: the
four block-covered buckets (434 disagreements + 0 agreements + 44638
never-observed + 0 observed-at-undefined-block) sum to 45072 exactly.

`PROOF04_BLOCK_COVERED_NEVER_OBSERVED` (44638) is a count against the
denominator and nothing else (SCHEMA.md section 6) -- it is not paired with
any data conclusion anywhere in this transcript.
