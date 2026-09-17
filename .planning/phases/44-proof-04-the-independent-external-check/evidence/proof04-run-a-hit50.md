# PROOF-04, Run A -- the licensed run at anchor hit target 50

**What this run is:** a live pass against genuine stock `/usr/bin/x64sc` (VICE
3.9), joining `proof04-oracle-memmap.mjs`'s runtime-observed execution
capture against `proof04-subject-dxa.mjs`'s byte-derived classification of
the same release/entry `PROOF-01` measured, through `evid-reconcile.ts`'s
`reconcileObservedExecution()`. Taken at anchor hit target 50 -- inside the
region `EVID-06` proved does not perturb frame-exactness. The derivation rule
that produced this run's verdict lives in exactly one place:
`evidence/SCHEMA.md`; this transcript cites it and does not restate it.

Fixed inputs (SCHEMA.md section 1):

- Binary: `/usr/bin/x64sc`, resolved by absolute path.
- Release: `danish.d64`, sha256
  `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`.
- Entry: `BRUCE LEE   (DC)`, sha256
  `331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4`, 45074
  bytes.
- Seed: `4242` (from `STOCK_DETERMINISM_FLAGS`, unmodified).
- Argv digest: `967c932acfc176431a898e9241f6966cce8e62e0be4946995d6474917074559d`
  (`ORACLE_ARGV_DIGEST`, below).

## Pre-run state

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

BROKER_STATE: inactive

## Subject artifact -- reused from plan 44-01, not re-produced

Plan 44-01's subject artifact was still on disk at
`$HOME/.cache/c64-re-tools/phase44/subject/subject-dxa.json`, so it was
reused rather than re-produced -- this is what makes anchor depth the only
variable between Run A and Run B in this plan.

```
$ sha256sum /home/henrik/.cache/c64-re-tools/phase44/subject/subject-dxa.json
db8bd51a5259427cf61cacf3b3d0df4413400c3118699987167d69aa13e41f8a  /home/henrik/.cache/c64-re-tools/phase44/subject/subject-dxa.json
```

SUBJECT_ARTIFACT_SHA256 db8bd51a5259427cf61cacf3b3d0df4413400c3118699987167d69aa13e41f8a

(This artifact's own outcome lines, from the plan 44-01 tracer run that
produced it: `SUBJECT_RELEASE_SHA256
1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`,
`SUBJECT_ENTRY_NAME BRUCE LEE   (DC)`, `SUBJECT_ENTRY_SHA256
331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4`,
`SUBJECT_ENTRY_BYTES 45074`, `SUBJECT_ORIGIN $0801`,
`SUBJECT_DXA_CODE_ADDRESSES 67`, `SUBJECT_DXA_DATA_ADDRESSES 45005`,
`SUBJECT_DXA_UNCLASSIFIED_ADDRESSES 0`, `SUBJECT_BLOCK_COUNT 5`,
`SUBJECT_COVERED_ADDRESSES 45072`.)

## The oracle run, depth 50

```
$ node .planning/phases/44-proof-04-the-independent-external-check/evidence/proof04-oracle-memmap.mjs --depth 50 --label run-a-hit50 --out $HOME/.cache/c64-re-tools/phase44/run-a-hit50/oracle-memmap.json > $HOME/.cache/c64-re-tools/phase44/run-a-hit50/oracle.log 2>&1; echo "oracle_exit=$?"
oracle_exit=0

$ cat $HOME/.cache/c64-re-tools/phase44/run-a-hit50/oracle.log
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
ORACLE_BROKER_STATE inactive
ORACLE_RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
ORACLE_VICE_BINARY /usr/bin/x64sc
ORACLE_VICE_VERSION x64sc (VICE 3.9)
ORACLE_SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:32833","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:33173"]
ORACLE_DEPTH_TARGET 50
ORACLE_DEPTH_REACHED 50
ORACLE_SHORT_RUN false
ORACLE_DEPTH_LABEL frame-exact-region
ORACLE_MAP_ENTRIES 43355
ORACLE_PARSE_REFUSAL none
ORACLE_SEED 4242
ORACLE_ARGV_DIGEST 967c932acfc176431a898e9241f6966cce8e62e0be4946995d6474917074559d
ORACLE_EXEC_OBSERVATIONS 1058
ORACLE_ARTIFACT_SHA256 d4d7b55be9b2c6e3dc60dc456eacceacf2d3f1fd05ad9a65e0e03ffe5fbc6c60
ORACLE_ARTIFACT_PATH /home/henrik/.cache/c64-re-tools/phase44/run-a-hit50/oracle-memmap.json
```

Post-oracle process check, before the join:

```
$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

## The join

```
$ node .planning/phases/44-proof-04-the-independent-external-check/evidence/proof04-reconcile.mjs --subject $HOME/.cache/c64-re-tools/phase44/subject/subject-dxa.json --oracle $HOME/.cache/c64-re-tools/phase44/run-a-hit50/oracle-memmap.json --label run-a-hit50 --out $HOME/.cache/c64-re-tools/phase44/run-a-hit50/reconcile.json > $HOME/.cache/c64-re-tools/phase44/run-a-hit50/reconcile.log 2>&1; echo "reconcile_exit=$?"
reconcile_exit=0

$ cat $HOME/.cache/c64-re-tools/phase44/run-a-hit50/reconcile.log
PROOF04_LABEL run-a-hit50
PROOF04_POSITIVE_CLASS code
PROOF04_TIER runtime-observed
PROOF04_FALSE_POSITIVES 168
PROOF04_AGREEMENTS 0
PROOF04_BLOCK_COVERED_NEVER_OBSERVED 44904
PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK 890
PROOF04_OBSERVED_AT_UNDEFINED_BLOCK 0
PROOF04_DENOMINATOR 45072
PROOF04_BLOCK_ADDRESSES_OBSERVED 168
PROOF04_BUCKET_IDENTITY_OK true
PROOF04_VERDICT resolved
PROOF04_DISAGREEMENT_HEAD $a408 $a40a $a434 $a474 $a476 $a478 $a47b $a47d $a480 $a483 $a560 $a562 $a644 $a646 $a647 $a649 $a64a $a64c $a64e $a64f $a651 $a653 $a655 $a657 $a659 $a65c $a65e $a660 $a663 $a665 $a667 $a669
PROOF04_ARTIFACT_SHA256 77bdfd6524de4d79b83623e09cca844d78edd4360bcb60b99be09efc63137074
PROOF04_ARTIFACT_PATH /home/henrik/.cache/c64-re-tools/phase44/run-a-hit50/reconcile.json
```

The full disagreement row list (168 addresses) and the full access map
(43355 entries) are **not** reproduced above -- `PROOF04_DISAGREEMENT_HEAD`
caps the shown addresses at 32, per SCHEMA.md section 7. The complete rows
live only in the uncommitted JSON artifacts cited by path and sha256 above
and below; neither artifact is committed to this checkout.

## Post-run state

```
$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

No `x64sc` process survived this run.

## The bare authoritative outcome-line block

Every `SUBJECT_*`, `ORACLE_*` and `PROOF04_*` line `SCHEMA.md` declares was
already transcribed verbatim, exactly once, in the two command blocks above
(the oracle run's `oracle.log` and the join's `reconcile.log`) plus the
`SUBJECT_ARTIFACT_SHA256`/`SUBJECT_ARTIFACT_PATH` pair recorded in the
"Subject artifact" section. Each run in this transcript executed exactly
once, so those quoted blocks ARE the final (and only) occurrence of every
outcome line -- restated here as a pointer rather than duplicated, so no
line in this file's authoritative record is printed twice.

## What this run's depth licenses

`ORACLE_DEPTH_REACHED` is 50, at or below the threshold, so
`ORACLE_DEPTH_LABEL` is `frame-exact-region` (SCHEMA.md section 5).

`.planning/phases/43-the-runtime-evidence-layer/evidence/phase43-instrumentation-perturbation-ab.md` (lines 152-156) states the
licensing sentence verbatim:

> This `no-perturbation` verdict licenses **only** the claim that this
> project's own instrumentation dials (`memmapzap` pre-`AUTOSTART`,
> `memmapshow` post-stop) do not perturb frame-exactness at anchor hit depths
> of 50 or below.

`.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md`
(line 236) states the `S3` row verbatim:

> `S3` | connect → arm anchor → `AUTOSTART` → count hits → `REGISTERS_GET` |
> **yes** — the sequence that works | frame-exact and byte-identical to hit
> 50; diverging from hit 75

At hit 50, this run sits exactly at the boundary `S3` measured
frame-exact-and-byte-identical to -- not past it. The claim this run may make
is therefore the narrowest licensed one: at this depth, this project's own
instrumentation dials do not perturb frame-exactness, and the captured state
is frame-exact and byte-identical to the un-instrumented control at this
same hit count.

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
file bytes". At anchor hit 50, the run is still inside the pre-load/early-run
region, so this caveat is stated as a limit on interpretation rather than a
specific known instance of self-modification observed in this run.

## Verdict

`PROOF04_VERDICT resolved`. `PROOF04_FALSE_POSITIVES` is `168` against
`PROOF04_DENOMINATOR` `45072`. `PROOF04_BUCKET_IDENTITY_OK` is `true`: the
four block-covered buckets (168 disagreements + 0 agreements + 44904
never-observed + 0 observed-at-undefined-block) sum to 45072 exactly.

`PROOF04_BLOCK_COVERED_NEVER_OBSERVED` (44904) is a count against the
denominator and nothing else (SCHEMA.md section 6) -- it is not paired with
any data conclusion anywhere in this transcript.

This run does not replace Run B (`proof04-run-b-narrowed.md`), and Run B does
not replace this one: the two are recorded beside each other, at their two
depths, with their two labels.
