# Phase 43 Plan 01: The EVID-06 Instrumentation-Perturbation A/B

This document records the live measurement plan 43-01 took to answer
EVID-06: does recording runtime evidence during v0.8.0's S3 anchor-counted
AUTOSTART sequence perturb the frame-exact, byte-identical capture that
sequence produces through anchor hit 50? The measurement is taken against a
rule fixed **before** any run, per this repository's own discipline that a
pre-committed rule is what makes a verdict a proof rather than a
retrospective judgment.

Every run below is against genuine, unpatched stock VICE, resolved by
absolute path (the fork build shadows `x64sc` on `$PATH`), with no broker
daemon and no leftover `x64sc` process running beforehand or afterward
(`systemctl --user is-active vice-broker` confirmed `inactive` and `pgrep -x
x64sc` confirmed empty immediately before each run in this session, and
`pgrep -x x64sc` confirmed empty again after every run completed).

## The rule, fixed before the measurement

**Fixed 2026-09-10, in `.planning/phases/43-the-runtime-evidence-layer/43-01-PLAN.md`'s `<objective>`, before any run.**

> Fixed inputs, identical in both conditions: binary `/usr/bin/x64sc`
> (genuine unpatched stock, VICE 3.9 -- the fork at `/usr/local/bin/x64sc`
> shadows a bare `x64sc` and is never launched here); release
> `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64`,
> sha256
> `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`; argv
> from `buildProbeArgs()` including `STOCK_DETERMINISM_FLAGS` unmodified, so
> the same `-seed`; zero pre-protocol jitter in every run; both monitor
> sockets connected in both conditions.
>
> Two conditions, at each of two anchor hit depths N in {10, 50}:
>
> * **Condition A, the control.** The S3 sequence -- connect, arm a
>   non-temporary Exec checkpoint at `$ea31` with `stop: true` while halted,
>   `AUTOSTART` with `runAfter: true` and `fileIndex: 0` on the release,
>   count `CHECKPOINT_INFO` hits to N with exactly one resume per observed
>   hit, `REGISTERS_GET`, `DUMP`. No `RESET` anywhere. The text socket is
>   connected and its banner drained, and **nothing is dialed over it**.
> * **Condition B, instrumented.** Byte-identical to A except two dials over
>   the text channel: `memmapzap` during the halted pre-`AUTOSTART` window,
>   and `memmapshow` after the anchor stop at hit N and before `DUMP`.
>
> Both captures are sliced to flat 64K through the shipped `vsf-slice.mjs`
> CLI, port-normalised through `normalisePorts()` from each snapshot's own
> `dirRead`/`dataRead`, and compared with the shipped, unmodified
> `compareCaptures(a, b, [])` -- an **EMPTY** allow-list.
>
> * **`no-perturbation`** iff, at BOTH depths, `compareCaptures().verdict` is
>   `"equivalent"`.
> * **`perturbation`** iff at EITHER depth `compareCaptures().verdict` is
>   `"not-equivalent"`.
> * **`not-exercised`** iff a required input is absent, either condition
>   fails to reach the anchor stop at either depth, or the
>   control-of-the-control does not itself compare `equivalent`.
>   `not-exercised` is NOT a pass: it forbids any claim of `no-perturbation`
>   and selects the `perturbation` labelling branch as the conservative
>   default.
>
> The control-of-the-control is mandatory and runs first. Without it a
> `not-equivalent` A-versus-B result cannot be distinguished from baseline
> nondeterminism, and this repository's discipline is that a red with no
> green beside it is not a proof.

The full rule, including the flagged no-toggle assumption, is quoted
verbatim at the top of
`.planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs`,
above its first line of executable code.

## What was actually run

- **Binary:** `/usr/bin/x64sc`, resolved by absolute path.
- **Reported version:** `x64sc (VICE 3.9)` (`/usr/bin/x64sc --version`).
- **Release:**
  `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64`.
- **Release sha256:**
  `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`
  (confirmed against the corpus file on disk before every run; the script
  refuses by name on any mismatch rather than proceeding against an
  unidentified image).
- **Argv** (from `buildProbeArgs()`, `STOCK_DETERMINISM_FLAGS` unmodified,
  transcribed from the live run's own `SPAWN_ARGV` line, ports elided since
  each direct-spawn run allocates its own ephemeral pair and the port number
  is a transport detail this project's run-identity discipline does not key
  on):
  ```
  /usr/bin/x64sc -default -console -drive8type 1541 -seed 4242
    -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0
    +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:<port>
    -remotemonitor -remotemonitoraddress ip4://127.0.0.1:<port>
  ```
- **Depths:** N = 10 and N = 50 -- both inside the window plan 33-03's own
  survey measured frame-exact (hits 1/10/50, 0 differing bytes), with hit 50
  at the outer proven edge.
- **Run labels, per depth:** `A1` and `A2` (the control-of-the-control
  pair, both un-instrumented) and `B1` (the instrumented run); `A1` also
  serves as `B1`'s treatment counterpart, so three physical launches per
  depth realize the plan's four named roles (`A1`, `A2`, `B1`, and
  "`A1` reused as `B`'s counterpart").
- **Allow-list:** empty (`compareCaptures(a, b, [])`). Correct at N ≤ 50 per
  plan 33-03's own measurement, recorded in
  `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md:541`:
  `| frame-anchored, pre-load stop | S3, hits 1 / 10 / 50 | 0 | far under |`
  -- a pre-load frame-anchored stop at these exact three hit counts was
  already measured to compare equivalent with an empty allow-list, so this
  A/B reuses that same empty list rather than inventing a new one.

## The control-of-the-control

| Depth | `AB_CONTROL_VERDICT` (A1 vs A2) | Differing addresses |
|---|---|---|
| 10 | `equivalent` | 0 |
| 50 | `equivalent` | 0 |

Both depths' control-of-the-control compared `equivalent` with zero
differing bytes. Without this pair, a `not-equivalent` result between A1 and
B1 would be indistinguishable from ordinary run-to-run nondeterminism in the
un-instrumented sequence itself -- this repository's own standing discipline
is that a red result with no green control beside it proves nothing. Because
both controls passed, the treatment comparison at each depth is
interpretable.

## VERDICT

```
no-perturbation
```

| Depth | `AB_DIFFERING_COUNT` (control, A1 vs A2) | `AB_DIFFERING_COUNT` (treatment, A1 vs B1) |
|---|---|---|
| 10 | 0 | 0 |
| 50 | 0 | 0 |

At both measured depths, the instrumented run (memmapzap dialed
pre-`AUTOSTART`, memmapshow dialed after the anchor stop) produced a capture
byte-identical to the un-instrumented control, under the same empty
allow-list plan 33-03 already validated. The verdict is `no-perturbation`,
derived in code from `compareCaptures().verdict` and printed by the script
as `DERIVED_EVID06_VERDICT no-perturbation` -- never chosen by hand after
seeing the numbers.

## What this verdict does and does not license

VICE has no runtime "instrumentation on/off" toggle: `monitor_memmap_store()`
records continuously and unconditionally once the connected binary carries
`FEATURE_CPUMEMHISTORY` (the same build flag `memmapshow`/`chis` already
require, and which this binary must already carry for Phase 42's shipped
tools to work at all), and `memmapzap` is a full clear, not a pause. The
recording itself therefore cannot be switched off on one arm of this A/B.

What this measurement actually isolates is the observable difference this
project can cause: the two extra text-monitor dials the evidence layer will
issue on every instrumented run. This `no-perturbation` verdict licenses
**only** the claim that this project's own instrumentation dials
(`memmapzap` pre-`AUTOSTART`, `memmapshow` post-stop) do not perturb
frame-exactness at anchor hit depths of 50 or below. It does **not** license
any claim about a build without `FEATURE_CPUMEMHISTORY`, since no run in
this phase can produce one, and launching a second, differently-configured
binary to reach that literal reading was explicitly rejected -- the binary's
own identity is part of the run-identity composite, so that experiment would
move two variables at once and answer a different question.

## The decision this verdict selects

| Verdict | Primary noun | Decision | What the schema carries |
|---|---|---|---|
| **`no-perturbation` ← SELECTED** | the run, identified by `(image sha256, argv digest, seed)`, unchanged | **`no-change`** | The bare triple. No `run_class` column exists. The old identity keeps its monopoly because nothing pluralized it. |
| `perturbation` | the observed run, identified by `(image sha256, argv digest, seed, run_class)` where `run_class` is one of `frame-exact` or `instrumented` | `promote` | The generalized four-part composite is primary; the v0.8.0 triple is demoted to a projection of it, never kept alongside as a second scheme. Every read verb and every rendering surface carries `run_class`. |
| `not-exercised` | as `perturbation` | `promote` | The conservative branch. A shortfall never buys the narrower schema. |

The measured verdict selects the **first row**: `no-change`. The
runtime-evidence table's run-identity column set is therefore the bare,
unchanged triple -- concretely:

```
binary_sha256   text/blob, the resolved emulator binary's own sha256
argv_digest     text/blob, argvDigest() over the exact spawn argv
seed            text, the -seed value from STOCK_DETERMINISM_FLAGS
```

No fourth `run_class` (or equivalently named) column is added. Plan 43-02
writes the evidence table's `CREATE TABLE` DDL from this exact row and from
nowhere else -- this measurement was taken before that DDL exists, precisely
so the schema is never retrofitted onto a shipped key after the fact.

Accepted debt, named rather than hidden: because the decision is
`no-change`, the schema carries no run-class discriminator. A later phase
that discovers a different perturbation source -- a different VICE version,
a different dial, a different instrumentation shape -- faces the one-way
schema bump this phase's own EVID-02 checkpoint already weighs. That is the
cost of not inventing a column for a phenomenon this measurement did not
observe.
