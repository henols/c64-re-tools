# PROOF-01: dxa's data-recovery rate on a real cracked release

**What this record is:** the end-to-end measurement of dxa's data-recovery rate
and false-positive disposition against the named real cracked release
`danish.d64`'s `BRUCE LEE   (DC)`, taken through
`evidence/proof01-dxa-real-release.mjs`, recorded beside the already-committed
fixture figures and the pivot's published figures — never in place of either.

Date: 2026-09-05.

## Verification preconditions, verified before this run

Per `README.md`'s evidence conventions, taken immediately before the run below:

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

BROKER_STATE: inactive

`TEST_AUTOMATED_BASELINE` was measured at Wave 0 of this phase and is stated
once in `README.md`, cited (never re-derived) here: `tests 3519 / pass 3506 /
fail 2`.

## Block A: the real release

Corpus identity, entry identity, and the dxa/ground-truth measurement,
reproduced from a single run of the committed driver:

```
$ node .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.mjs
$ sha256sum /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5  /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
$ listEntries(/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64)
[{"name":"BRUCE LEE   (DC)","type":"PRG","track":17,"sector":0,"sizeBlocks":178}]
$ extractEntry(/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64, "BRUCE LEE   (DC)")
sha256=331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4 bytes=45074
$ runDxaDisassemble({ image: "bl.prg", imageKind: "prg", entrypointsPath: "bl.entrypoints" }, { repoRoot: "/home/henrik/.cache/c64-re-tools/phase38/proof01-kjnu64" })
runDxaDisassemble: code=67 data=45005 unclassified=0 covered=45072
$ partitionByteDerived({ bytes: <extracted BRUCE LEE   (DC) .prg>, isPrg: true })
partitionByteDerived: certainData=24 certainCode=0 unknown=45048 stubOutcome="BASIC stub at $0801 parsed cleanly: 24 byte(s) certain-data ($0801-$0818)."
$ renderProof01Report(compareByteDerivedRecovery({ listing, groundTruth }), meta)
PROOF01_GROUND_TRUTH_TIER: byte-derived
PROOF01_POSITIVE_CLASS: data
PROOF01_DATA_RECOVERY_PCT: 100.00 (24/24)
PROOF01_FALSE_POSITIVES: structurally-uncomputable (certainCode.size is 0 on the byte-derived tier -- see dxa-partition.ts:462-464)
PROOF01_UNCLASSIFIED_OVERLAP: 0
PROOF01_DXA_CODE_ADDRESSES: 67
PROOF01_DXA_DATA_ADDRESSES: 45005
```

Run a second time, immediately after, to confirm determinism (the driver's own
`main()` tears down its scratch workspace in a `finally` between runs):

```
$ node .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.mjs
[... identical transcript, identical outcome-line block, byte-for-byte ...]
```

The two runs' `renderProof01Report()` blocks were compared with `diff` and are
byte-identical.

The recorded outcome lines for Block A, transcribed from the run above (final
occurrence wins; these are the bare, authoritative values this file declares):

PROOF01_RELEASE_ID: danish

PROOF01_RELEASE_SHA256: 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5

PROOF01_ENTRY_NAME: BRUCE LEE   (DC)

PROOF01_ENTRY_SHA256: 331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4

PROOF01_ENTRY_BYTES: 45074

PROOF01_ENTRYPOINTS: $0819

PROOF01_GROUND_TRUTH_TIER: byte-derived

PROOF01_POSITIVE_CLASS: data

PROOF01_DATA_RECOVERY_PCT: 100.00 (24/24)

PROOF01_FALSE_POSITIVES: structurally-uncomputable (certainCode.size is 0 on the byte-derived tier -- see dxa-partition.ts:462-464)

PROOF01_UNCLASSIFIED_OVERLAP: 0

PROOF01_DXA_CODE_ADDRESSES: 67

PROOF01_DXA_DATA_ADDRESSES: 45005

**The real-release denominator (24) is a structurally different, much
narrower fact than the fixture's denominator (134) — not a smaller sample of
the same thing.** The byte-derived tier can only ever certify the two-byte
`.prg` header exclusion (excluded from every count entirely) and, where a
BASIC stub parses cleanly at `$0801`, that stub's own bytes — here, the
24-byte loader stub at `$0801`-`$0818`. It says nothing about, and cannot
be extended to say anything about, the packed game code that follows: there is
no execution oracle and no source in this measurement, so nothing beyond the
BASIC stub is ever certain. `100.00 (24/24)` means "dxa recovered every byte
this tier can prove is data" — the BASIC loader stub, in full — not "dxa
recovered all of `BRUCE LEE`'s data."

`danish.d64` is PROOF-01's primary named binary (D-05). The `saeger.d64`
cross-check is optional strengthening and is deliberately **not** taken in
this plan.

## Block B: the fixture figures, unchanged and not replaced

Cited to `docs/phase23-real-release-gate-findings.md` (lines 456-479) and
Phase 35's own independent re-derivation (`35-03-SUMMARY.md`). Never
re-derived here, never replaced by Block A's numbers:

FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134)

FIXTURE_FALSE_POSITIVES: 3

FIXTURE_REPRODUCED: no

## Block C: the pivot's published figures, beside — never as ground truth

The pivot's own published headline, recorded beside Blocks A and B, never
treated as ground truth and never presented as reproduced:

PIVOT_PUBLISHED_DATA_RECOVERY_PCT: 72.46 (100/138)

PIVOT_PUBLISHED_FALSE_POSITIVES: 0

PIVOT_REPRODUCTION_STATUS: not-reproduced

PIVOT_NON_REPRODUCTION_CAUSE: hypothesis -- the pivot's published 141/138
code/data partition was not independently source-derivable from the same
fixture source and report Phase 35 used, and the published figures happen to
flatter dxa exactly where its "0 false positives" headline lived (a 141/138
partition where the fixture's own independently re-derived source-derived
partition reads 145 code / 131 strict data / 3 pad,
`docs/phase23-real-release-gate-findings.md`). This is written as a
hypothesis about why the two partitions disagree, not as an established
finding — no further investigation into the pivot's own methodology was
undertaken in this plan.

## Two named weaknesses (D-03), recorded separately

Per D-03, PROOF-01's structurally-uncomputable false-positive count gets its
own separately named weakness, distinct from the already-disclosed absent
external oracle. Neither is folded into the other.

PROOF01_WEAKNESS_NO_EXTERNAL_CHECK: no independent execution oracle exists for
this measurement. `memmapshow` is stated absent by owner decision 2026-09-02,
excluded twice over from this phase's instrument set (`38-RESEARCH.md`, "Not
needed / explicitly out of scope"). Reversal condition: this weakness is
discharged if a binary-monitor-reachable execution oracle becomes available to
this project, or if an owner decision reopens the text-monitor channel that
would let such an oracle be built.

PROOF01_WEAKNESS_UNCOMPUTABLE_FP: the byte-derived ground-truth tier decides
exactly two facts about a real release with no source — the `.prg` header's
two bytes are excluded entirely, and a cleanly-parsing BASIC stub at `$0801`
is certain-data — and neither of those two facts is EVER code
(`dxa-partition.ts:462-464`, `certainCode` is ALWAYS empty by this tier's own
design, A-09). A false-positive count (dxa says data, ground truth says code)
therefore has no denominator to exist against on this tier, for any real
release, regardless of which release or how much of it dxa misclassifies.
This is a limit of the ground truth's DESIGN — not a limit of the oracle's
AVAILABILITY (`PROOF01_WEAKNESS_NO_EXTERNAL_CHECK`, above) — and the two are
different limitations: an execution oracle, if one existed, would not by
itself make this tier's `certainCode` non-empty; only a source-derived ground
truth (unavailable for a real release with no source) or a genuinely new,
independently-validated code-identification method could.

## Closing record

PROOF01_CAPTURE_PAIR: none

This measurement reports no capture pair — `GATE-01`'s two-term `(PC,
hit_count)` stop-oracle narrowing has nothing to attach to here, stated rather
than left absent.

BROKER_STATE: inactive

Verified before the run, per the transcript at the top of this file:
`systemctl --user is-active vice-broker` read `inactive`, and `pgrep -x x64sc`
exited `1` with no output.

`TEST_AUTOMATED_BASELINE` (cited from `README.md`, never re-derived here):
`tests 3519 / pass 3506 / fail 2`.
