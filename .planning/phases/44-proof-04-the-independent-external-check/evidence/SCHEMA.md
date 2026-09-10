# SCHEMA — Phase 44, PROOF-04, the Derivation Rule and Outcome-Line Vocabulary

Fixed BEFORE any measurement is taken (44-01-PLAN.md's own objective block,
"THE DERIVATION RULE -- FIXED AT PLAN TIME, BEFORE ANY MEASUREMENT"). This
file restates that block verbatim in structure. Neither this file nor the
plan's own block may drift from the other; if an amendment is ever
unavoidable, both the original rule and the amendment are recorded together
with the date and the reason, and every number taken under each rule is
labelled with which rule produced it (see this plan's second prohibition).

## 1. Fixed inputs

Binary `/usr/bin/x64sc`, resolved by absolute path — genuine unpatched stock,
VICE 3.9; the fork at `/usr/local/bin/x64sc` shadows a bare `x64sc` on
`$PATH` and is never launched by this phase's scripts. Release
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64`,
sha256 `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`.
Entry `BRUCE LEE   (DC)`, sha256
`331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4`, 45074
bytes, entrypoint `$0819`. Argv from `buildProbeArgs()` including
`STOCK_DETERMINISM_FLAGS` unmodified, so seed `4242`. The same release and
entry `PROOF-01` measured — not a different corpus.

## 2. Positive class and tier

The positive class is `code` and the tier is `runtime-observed`, both read
from `reconcileObservedExecution()`'s own return fields, never asserted by
the driver. A false positive is one address the byte-derived tier classified
`data` and the emulator was observed executing.

## 3. Verdict, per run

- **`not-exercised`** iff ANY of: a required input is absent or digests
  differently (the corpus, `/usr/bin/x64sc`, a resolvable dxa binary);
  `preflight()` refuses (the `vice-broker` unit is not `inactive`, or another
  `x64sc` is alive); the emulator never reached the anchor stop at all
  (`ORACLE_DEPTH_REACHED` is `0`); `parseAccessMap()` refused
  (`ORACLE_PARSE_REFUSAL` is not `none`); or `PROOF04_DENOMINATOR` is `0`.
  `not-exercised` is **NOT a pass**. It forbids any false-positive claim, and
  the record states what was searched and at what depth — the outcome Phase
  38 recorded for `PROOF-02` rather than smoothing over.
- **`unresolved`** iff the run reached the anchor stop and the join ran, but
  `PROOF04_BLOCK_ADDRESSES_OBSERVED` is `0` — no address the block table
  covers was observed executing. The answer is stated as
  `0 of <PROOF04_DENOMINATOR>` with the denominator named. This is a
  **shortfall**, explicitly not a clean bill of health, and the covered
  addresses are not thereby data.
- **`resolved`** iff the run reached the anchor stop, the join ran, and
  `PROOF04_BLOCK_ADDRESSES_OBSERVED` is at least `1`. `PROOF04_FALSE_POSITIVES`
  is the count; `PROOF04_DENOMINATOR` is its denominator.

The three verdict tokens, declared once, are: **`resolved`**, **`unresolved`**,
**`not-exercised`**.

## 4. Phase verdict

`PROOF04_PHASE_VERDICT` is `resolved` iff at least one recorded run is
`resolved`; `unresolved` iff no run is `resolved` and at least one reached
the join; `not-exercised` iff no run reached the join.

## 5. Depth label, per run

`frame-exact-region` iff `ORACLE_DEPTH_REACHED` is 50 or below; `narrowed`
above it. Under `narrowed` the record states beside itself that `EVID-06`'s
`no-perturbation` verdict licenses claims only at anchor hit depths of 50 or
below, that `S3` is measured frame-exact and byte-identical to hit 50 and
diverging from hit 75 because `AUTOSTART`'s power cycle does not reset the
absolute emulated clock, and that any comparison against v0.8.0's frame-exact
captures is therefore narrowed rather than assumed. A run reaching fewer hits
than its target does not change its verdict — it narrows the depth claim,
and `ORACLE_DEPTH_REACHED` is what the record states.

The two depth-label tokens, declared once, are: **`frame-exact-region`**,
**`narrowed`**.

## 6. Absence

`PROOF04_BLOCK_COVERED_NEVER_OBSERVED` is a count against
`PROOF04_DENOMINATOR` and nothing else. No branch of this rule converts it,
or any part of it, into a class.

## 7. Outcome-line vocabulary

Every name below has exactly one declared source (the script that prints
it), a domain, and a one-line meaning. No other script in this phase may
print a line under a name not declared here.

### `SUBJECT_*` — declared and printed only by `proof04-subject-dxa.mjs`

| Name | Domain | Meaning |
|---|---|---|
| `SUBJECT_RELEASE_SHA256` | 64 lowercase hex chars | sha256 of the resolved `danish.d64` bytes |
| `SUBJECT_ENTRY_NAME` | string | the extracted directory entry's name |
| `SUBJECT_ENTRY_SHA256` | 64 lowercase hex chars | sha256 of the extracted entry's raw bytes |
| `SUBJECT_ENTRY_BYTES` | non-negative integer | byte length of the extracted entry |
| `SUBJECT_ORIGIN` | 4-hex-digit string prefixed `$` | the `.prg`'s own load address |
| `SUBJECT_DXA_CODE_ADDRESSES` | non-negative integer | `dxaResult.map.code.size` |
| `SUBJECT_DXA_DATA_ADDRESSES` | non-negative integer | `dxaResult.map.data.size` |
| `SUBJECT_DXA_UNCLASSIFIED_ADDRESSES` | non-negative integer | `dxaResult.map.unclassified.size` |
| `SUBJECT_BLOCK_COUNT` | non-negative integer | number of `BlockEntry[]` runs emitted |
| `SUBJECT_COVERED_ADDRESSES` | non-negative integer | distinct addresses in the union of the emitted inclusive ranges |
| `SUBJECT_ARTIFACT_SHA256` | 64 lowercase hex chars | sha256 of the bytes written to the subject JSON artifact |
| `SUBJECT_ARTIFACT_PATH` | absolute path string | where the subject artifact was written |

### `ORACLE_*` — declared and printed only by `proof04-oracle-memmap.mjs`

| Name | Domain | Meaning |
|---|---|---|
| `ORACLE_VICE_BINARY` | absolute path string | the resolved emulator binary path (must equal `/usr/bin/x64sc`) |
| `ORACLE_VICE_VERSION` | string | `--version` probe output of the resolved binary |
| `ORACLE_BROKER_STATE` | `inactive` \| other systemd state string | `preflight()`'s own reported broker state |
| `ORACLE_SPAWN_ARGV` | JSON array string | the real launch argv passed to `spawnVice()` |
| `ORACLE_RELEASE_SHA256` | 64 lowercase hex chars | sha256 of the release image this run launched |
| `ORACLE_SEED` | string | the run identity's seed (fixed `"4242"`, from `STOCK_DETERMINISM_FLAGS`) |
| `ORACLE_ARGV_DIGEST` | 64 lowercase hex chars | `argvDigest()`'s own output over the real launch argv, read back from `runIdentityFrom()`'s result |
| `ORACLE_DEPTH_TARGET` | positive integer | the requested `--depth` |
| `ORACLE_DEPTH_REACHED` | non-negative integer | the anchor hit count actually observed |
| `ORACLE_DEPTH_LABEL` | `frame-exact-region` \| `narrowed` | derived per §5 above |
| `ORACLE_SHORT_RUN` | `true` \| `false` | whether `ORACLE_DEPTH_REACHED` fell short of `ORACLE_DEPTH_TARGET` |
| `ORACLE_MAP_ENTRIES` | non-negative integer | `parseAccessMap()`'s own `entries.length` |
| `ORACLE_EXEC_OBSERVATIONS` | non-negative integer | `execObservationsFrom()`'s own output length |
| `ORACLE_PARSE_REFUSAL` | `none` \| a `AccessMapRefusalCode` string | `none` on a clean parse, else the refusal's own code |
| `ORACLE_ARTIFACT_SHA256` | 64 lowercase hex chars | sha256 of the bytes written to the oracle JSON artifact |
| `ORACLE_ARTIFACT_PATH` | absolute path string | where the oracle artifact was written |

### `PROOF04_*` — declared and printed only by `proof04-reconcile.mjs`

| Name | Domain | Meaning |
|---|---|---|
| `PROOF04_LABEL` | string | the `--label` this reconcile run was invoked with |
| `PROOF04_POSITIVE_CLASS` | `code` | read from `EvidReconciliation.positiveClass`, never asserted by the driver |
| `PROOF04_TIER` | `runtime-observed` | read from `EvidReconciliation.tier`, never asserted by the driver |
| `PROOF04_FALSE_POSITIVES` | non-negative integer | `EvidReconciliation.disagreementCount` |
| `PROOF04_AGREEMENTS` | non-negative integer | `EvidReconciliation.agreementCount` |
| `PROOF04_BLOCK_COVERED_NEVER_OBSERVED` | non-negative integer | `EvidReconciliation.blockCoveredNeverObservedCount` — a count against `PROOF04_DENOMINATOR` and nothing else (§6) |
| `PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK` | non-negative integer | `EvidReconciliation.observedOutsideAnyBlockCount` — deliberately **NOT** part of the denominator (see below) |
| `PROOF04_OBSERVED_AT_UNDEFINED_BLOCK` | non-negative integer | `EvidReconciliation.observedAtUndefinedBlockCount` |
| `PROOF04_DENOMINATOR` | non-negative integer | `EvidReconciliation.denominator` |
| `PROOF04_BLOCK_ADDRESSES_OBSERVED` | non-negative integer | `disagreementCount + agreementCount`, computed by the driver, never a returned field |
| `PROOF04_BUCKET_IDENTITY_OK` | `true` \| `false` | whether `disagreementCount + agreementCount + blockCoveredNeverObservedCount + observedAtUndefinedBlockCount === denominator` |
| `PROOF04_VERDICT` | `resolved` \| `unresolved` \| `not-exercised` | derived strictly per §3 above |
| `PROOF04_VERDICT_CAUSE` | string | present only when the verdict is not `resolved`; states which rule branch fired |
| `PROOF04_DISAGREEMENT_HEAD` | space-separated hex address list | the first 32 disagreement addresses ascending, never the full row list |
| `PROOF04_PHASE_VERDICT` | `resolved` \| `unresolved` \| `not-exercised` | derived per §4 above, across however many runs are recorded |

`PROOF04_OBSERVED_OUTSIDE_ANY_BLOCK` is deliberately **NOT** part of the
denominator — an observation outside every block is real evidence about an
unclassified address, and the bucket exists so the denominator cannot lie.
The other four block-covered buckets (`PROOF04_FALSE_POSITIVES` /
disagreements, `PROOF04_AGREEMENTS`, `PROOF04_BLOCK_COVERED_NEVER_OBSERVED`,
`PROOF04_OBSERVED_AT_UNDEFINED_BLOCK`) sum to `PROOF04_DENOMINATOR` exactly —
that identity is what `PROOF04_BUCKET_IDENTITY_OK` reports.

## 8. `not-exercised` is not a pass

Stated in words, once, so no later reader has to infer it from the
derivation rule alone: **`not-exercised` is not a pass.** It is a refusal to
claim anything about the false-positive count, taken because a required
input, a preflight check, the anchor stop, the access-map parse, or the
denominator itself did not hold up. A `not-exercised` run forbids any
false-positive claim exactly as firmly as a `resolved` run supports one — the
absence of a number is not itself a favourable number.

## 9. Amendment ledger

Empty as of this file's first commit. Any future amendment is appended here
with its date, its reason, and which runs were taken under the original rule
versus the amendment — never a silent edit to §§1–8 above.
