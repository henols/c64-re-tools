# Phase 38 Plan 04 -- PROOF-02, the Depacked Flat-64K Capture

This file records the deeper half of PROOF-02: a depacked flat-64K image of
`danish.d64`'s `BRUCE LEE   (DC)`, captured through Phase 33's own committed
capture route (`evidence/capture-pair.mjs`, unchanged) -- never a re-authored
capture path. Plan `38-03`'s `evidence/proof02-loader-stage.md` owns the
shallower, statically-extracted-`.prg` half; this file owns the depth below
the depacker.

Every command below was actually run, with the broker confirmed stopped
first, per `evidence/README.md`'s conventions (binding on this plan, not
restated in full here).

## Preparation -- corpus identity, no worktree symlink needed

This execution ran directly on the main checkout (`isolation: none`, per the
orchestrator's dispatch notes), so the corpus images were already present at
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/`
-- no symlink placement was required. Confirmed before anything else:

```
$ sha256sum .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5  .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64

$ git status --porcelain
(empty)
```

## Step 0 -- preflight, broker confirmed stopped

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1

$ pgrep -x vice-broker; echo "exit=$?"
exit=1
```

BROKER_STATE: inactive

```
$ node .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/capture-pair.mjs preflight
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
```

`capture-pair.mjs` starts its own task-scoped broker with state under its own
`PROBE_DIR` (`$HOME/.cache/c64-re-tools/phase33/33-10`, per `capture-pair.mjs`'s
own `PROBE_DIR` constant -- Phase 33's plan `33-10` scratch root, reused
unchanged rather than a second copy under Phase 38's own `PROBE_DIR`). That is
the intended route, not a violation of the broker-stopped rule above: the
systemd-managed `vice-broker` unit -- the one whose liveness reddens the
`BACK-05` assertion deterministically -- stayed `inactive` throughout, and the
task-scoped child broker's lifetime is exactly each `run` invocation's own
lifetime, torn down again before the next command below.

## Step 1 -- capture a pair, jitter 0, target 400 (Phase 33's own default)

`capture-pair.mjs` drives `broker-launch.mts`'s `buildViceArgs()` (reached by
acquiring over the broker control plane), `stock-protocol.ts`'s
`ViceMonitorClient`, the shipped `vsf-slice` CLI, and `capture-predicate.ts`'s
comparator -- unchanged, exactly as Phase 33's own `33-10` plan drove them.
Nothing here re-authors any of it.

```
$ node .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/capture-pair.mjs run --label proof38-depacked-a --jitter 0 --target 400
RUN_LABEL proof38-depacked-a
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-10
NODE v24.20.0
DATE_UTC 2026-09-05T19:06:38.477Z
RELEASE /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
VICE_VERSION x64sc (VICE 3.9)
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_START_ENV VICE_BIN=/usr/bin/x64sc VICE_BROKER_WARM_FLOOR=0 VICE_BROKER_MAX=1
BROKER_START_CMD /home/henrik/.nvm/versions/node/v24.20.0/bin/node /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/resources/vice-broker.mjs --repo-root /home/henrik/dev/henrik/git/c64-re-tools --state-dir /home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state
BROKER_START_AT 2026-09-05T19:06:38.547Z
BROKER_JSON pid=846412 control=0.0.0.0:19510 warm_floor=0 max=1
BROKER_BACKEND stock binary=/usr/bin/x64sc
ACQUIRE_MS 12
GRANT id=req-846399-1788635199153-b7e3692d port=6600 supervisor_dir=/home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state/6600
ACQUIRE_PROFILE {"headless":true}
BROKER_LAUNCH_LINE vice-broker: launching /usr/bin/x64sc -default -console -drive8type 1541 -seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6600 -remotemonitor -remotemonitoraddress ip4://127.0.0.1:6601 (XDG_CONFIG_HOME=/tmp/vice-broker-vicerc-DWrxr1)
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6600","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:6601"]
SPAWN_ARGV_INDEX_0 -default
XDG_CONFIG_HOME /tmp/vice-broker-vicerc-DWrxr1
ARGV_DIGEST c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864
SEED 4242
JITTER_MS 0
CONNECTED_AFTER_MS 153
OPEN_EVENTS (none)
MONITOR_READY_AFTER_PINGS 1
REGISTER_CATALOG 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE Drive8TrueEmulation=1
RESOURCE Drive8Type=1541
RESOURCE AutostartDelayRandom=0
ARMED_BEFORE_AUTOSTART cp=1 start=$ea31 stop=true temporary=false hits=0
AUTOSTART err=0x00 responseType=0xdd
CHECKPOINT_LIST_AFTER_AUTOSTART total=1 items=0
ANCHOR_SURVIVED_AUTOSTART yes
COUNTED reached=true hits=400 target=400 reason=-
STOP PC=$ea31 hit_count=400 LIN=154 CYC=11 $00=47 $01=55
CHECKPOINT_LIST_AT_EXIT total=1 items=0
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-a.vsf err=0x00 size=193261
BROKER_STOP_AT 2026-09-05T19:06:45.543Z
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-a.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-a.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-a.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-a.bin","imageBytes":65536,"sha256":"99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE_RAW /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-a.bin bytes=65536 sha256=99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5
PORT_READS dirRead=47 dataRead=55 dataOut=39
IMAGE_NORMALISED /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-a.norm.bin bytes=65536 sha256=23f4fe20f45db3e55367fd8c80a26f79b0d40a0cb53635f9b2c64836bc5448f5
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-a.run.json usable=true
```

No void: the anchor count reached 400 on the first attempt.

```
$ node .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/capture-pair.mjs run --label proof38-depacked-b --jitter 0 --target 400
RUN_LABEL proof38-depacked-b
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-10
NODE v24.20.0
DATE_UTC 2026-09-05T19:06:53.458Z
RELEASE /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
VICE_VERSION x64sc (VICE 3.9)
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_START_ENV VICE_BIN=/usr/bin/x64sc VICE_BROKER_WARM_FLOOR=0 VICE_BROKER_MAX=1
BROKER_START_CMD /home/henrik/.nvm/versions/node/v24.20.0/bin/node /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/resources/vice-broker.mjs --repo-root /home/henrik/dev/henrik/git/c64-re-tools --state-dir /home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state
BROKER_START_AT 2026-09-05T19:06:53.541Z
BROKER_JSON pid=846919 control=0.0.0.0:19510 warm_floor=0 max=1
BROKER_BACKEND stock binary=/usr/bin/x64sc
ACQUIRE_MS 11
GRANT id=req-846907-1788635213748-0cfab3ab port=6600 supervisor_dir=/home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state/6600
ACQUIRE_PROFILE {"headless":true}
BROKER_LAUNCH_LINE vice-broker: launching /usr/bin/x64sc -default -console -drive8type 1541 -seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6600 -remotemonitor -remotemonitoraddress ip4://127.0.0.1:6601 (XDG_CONFIG_HOME=/tmp/vice-broker-vicerc-cVt7Gc)
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6600","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:6601"]
SPAWN_ARGV_INDEX_0 -default
XDG_CONFIG_HOME /tmp/vice-broker-vicerc-cVt7Gc
ARGV_DIGEST c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864
SEED 4242
JITTER_MS 0
CONNECTED_AFTER_MS 153
OPEN_EVENTS (none)
MONITOR_READY_AFTER_PINGS 1
REGISTER_CATALOG 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE Drive8TrueEmulation=1
RESOURCE Drive8Type=1541
RESOURCE AutostartDelayRandom=0
ARMED_BEFORE_AUTOSTART cp=1 start=$ea31 stop=true temporary=false hits=0
AUTOSTART err=0x00 responseType=0xdd
CHECKPOINT_LIST_AFTER_AUTOSTART total=1 items=0
ANCHOR_SURVIVED_AUTOSTART yes
COUNTED reached=true hits=400 target=400 reason=-
STOP PC=$ea31 hit_count=400 LIN=154 CYC=11 $00=47 $01=55
CHECKPOINT_LIST_AT_EXIT total=1 items=0
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-b.vsf err=0x00 size=193261
BROKER_STOP_AT 2026-09-05T19:06:59.428Z
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-b.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-b.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-b.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-b.bin","imageBytes":65536,"sha256":"99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE_RAW /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-b.bin bytes=65536 sha256=99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5
PORT_READS dirRead=47 dataRead=55 dataOut=39
IMAGE_NORMALISED /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-b.norm.bin bytes=65536 sha256=23f4fe20f45db3e55367fd8c80a26f79b0d40a0cb53635f9b2c64836bc5448f5
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-b.run.json usable=true
```

No void: the anchor count reached 400 on the first attempt.

Both runs used jitter 0, the same seed and the same argv digest as `33-10`'s
own `pair-j0` run (`c3710dd6...`), so both images are byte-identical to each
other AND to `33-10`'s own `pair-j0.bin` -- this is the expected, deterministic
consequence of matching every input `33-10` used, not a coincidence and not a
weaker measurement: the launch-nondeterminism-immunity `33-10` and `33-11`
already established for this exact stop is what makes it unsurprising, and it
means this pair's own raw comparison below is the maximally strict case (jitter
held fixed on both sides, so any divergence at all would be a real finding
rather than pre-load noise).

## Step 2 -- compare, NO allow-list

`SCHEMA.md`'s own convention and this plan's own action both require the raw
divergence on the record rather than absorbed by an allow-list. No new
allow-list is derived here -- that is Phase 33's `D-23` work and stays out of
scope for this plan.

```
$ node .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/capture-pair.mjs compare --a proof38-depacked-a --b proof38-depacked-b
PAIR_A proof38-depacked-a jitter=0 argvDigest=c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864 seed=4242 releaseSha=1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
PAIR_B proof38-depacked-b jitter=0 argvDigest=c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864 seed=4242 releaseSha=1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
REPRO_KEY_A 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5|c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864|4242
REPRO_KEY_B 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5|c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864|4242
REPRO_KEY_MATCH yes
ORACLE_TERMS ["pc","hitCount","line","cycle"]
STOP_IDENTITY_A {"pc":59953,"hitCount":400,"line":154,"cycle":11}
STOP_IDENTITY_B {"pc":59953,"hitCount":400,"line":154,"cycle":11}
STOP_IDENTITY_VERDICT {"identical":true,"differingTerms":[],"frameTermAsserted":true}
ALLOW_LIST empty (no allow-list artifact given)
COMPARE verdict=equivalent differing=0 allowed=0 cap=64 allowListSize=0
DIFFERING_COUNT 0
DIFFERING_FIRST_20 (none)
ALLOWED_FIRST_20 (none)
allowed (enumerated transients, excluded from the verdict; 0 of a cap of 64): 0
DIVERGENCE -- outside the allow-list, fails the comparison at any bit count: 0
VERDICT: equivalent
DERIVED_C0_CAPTURE_PAIR pass
DERIVED_CAPTURE_FRAME_EXACT yes
```

**The `differing` count, quoted verbatim: `0`.** With no allow-list at all, the
two port-normalised images are byte-identical (`verdict=equivalent`,
`differing=0`). All four `ORACLE_TERMS` also agree
(`STOP_IDENTITY_VERDICT {"identical":true,...}`), so this particular pair's
own `DERIVED_CAPTURE_FRAME_EXACT` reads `yes` -- because both runs were taken
at the SAME jitter (0 ms, matching `33-10`'s `pair-j0`), the pre-protocol
interval that Phase 33 measured as the cause of frame-term disagreement never
varied between the two sides of this pair. This is a genuinely stricter result
than `33-10`'s own reported pair (which paired jitter 0 against jitter 2500 and
measured `CAPTURE_FRAME_EXACT: no`), not a weaker one: holding jitter fixed on
both sides removes the one input Phase 33 identified as the cause of
divergence, and the two captures still agree byte-for-byte.

## Step 3 -- the two-term oracle statement and the frame-term narrowing

Stated here, beside the numbers above, per this plan's own must-have and
`ROADMAP.md`'s Phase 38 Notes `GATE-01` paragraph:

PROOF02_CAPTURE_ORACLE_TERMS: the two-term `(PC, hit_count)` stop oracle is
what this and every other capture-derived number in this phase is asserted
under -- `ORACLE_TERMS ["pc","hitCount","line","cycle"]` (quoted verbatim
above) names all four terms the oracle's own module tracks, but only `pc` and
`hitCount` are the ASSERTED identity; `line` and `cycle` are recorded
alongside, never the basis for a pass/fail call. `GATE-01` (Phase 33) returned
`degrade` under rule `R6` (`ORACLE_NECESSITY: unproven`), and its pre-mapped
`D-04` narrowing is reproduced here rather than re-derived: the frame term
`(LIN, CYC)` is recorded but not asserted. That this particular pair happens
to also agree on `(LIN, CYC)` (both `154`/`11`, because both runs share
jitter 0) does not change what is ASSERTED -- the oracle used for the
pass/fail call is still the two-term form, and a future pair at a different
jitter could disagree on the frame term exactly as `33-10`'s own reported pair
did, without changing this pair's `pass`.

PROOF02_CAPTURE_FRAME_TERM: `(LIN, CYC) recorded-not-asserted` -- `GATE-01`
returned `degrade` under rule `R6`, and this narrowing is reproduced here
rather than re-derived. `CAPTURE_FRAME_EXACT` for this specific pair happens to
read `yes` (both stops share `line=154, cycle=11`), but the oracle's own
ASSERTED identity remains the two-term `(PC, hit_count)` form regardless.

## Step 4 -- the depack-progress measurement

`PROOF02_DEPACK_PROGRESS` needs measured evidence that the captured image
contains bytes the statically extracted `.prg` does not -- computed, not
assumed. The extracted `BRUCE LEE   (DC)` body (plan `38-03`'s own extraction,
re-run here with the identical result) was placed at its own load address
`$0801` in a zeroed 64K buffer, then compared byte-for-byte against the named
capture (`proof38-depacked-a.bin`, the SAME digest this file names as the
capture the search in Task 2 runs over):

```
$ node -e '<extractEntry(danish.d64, "BRUCE LEE   (DC)") -- re-run of plan 38-03's own extraction>'
ENTRIES [{"name":"BRUCE LEE   (DC)","type":"PRG","track":17,"sector":0,"sizeBlocks":178}]
EXTRACT_SHA256 331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4 bytes 45074
```

`331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4` is
byte-identical to `evidence/proof02-loader-stage.md`'s own
`PROOF02_LOADER_IMAGE_SHA256` -- the SAME extracted bytes, never a second
extraction path, exactly as that file's own convention requires.

```
$ node -e '<place bl.prg body at $0801 in a zeroed 64K buffer, diff against proof38-depacked-a.bin>'
LOAD_ADDR $801
BODY_BYTES 45072
STATIC_RANGE $801 - $b810
DIFF_IN_STATIC_RANGE 40511 of 45072
DIFF_ADDRS_SAMPLE $13f6 $13f7 $13f8 $13f9 $13fa $13fb $13fc $13fd $13fe $13ff $1400 $1401 $1402 $1403 $1404 $1405 $1406 $1407 $1408 $1409
NONZERO_OUTSIDE_RANGE 10581 of 20464
NONZERO_ADDRS_SAMPLE $3 $4 $5 $6 $7 $8 $b $f $16 $17 $19 $1a $1b $22 $23 $24 $25 $2b $2c $2d
```

**Two counts, both with their address ranges named:**

- **(a) Inside the static image's own range (`$0801`-`$B810`, 45072 bytes):**
  `40511` of `45072` addresses differ between the running capture and the
  statically extracted bytes placed at the same addresses. This is a LARGE
  fraction (about 90%) of the static image's own span -- consistent with the
  static `.prg` bytes at this range being the loader/depacker's OWN packed
  on-disk representation, while the capture at the same addresses holds
  whatever the depacker actually wrote there once it ran (including the
  disk-load-in-progress buffer region `$13F6`-`$140B` that `evidence/33-capture-pair.md`
  already identified as the moving load-position bytes, sampled at the head
  of `DIFF_ADDRS_SAMPLE` above). This count is evidence about how much of the
  static image's own footprint gets overwritten once execution actually
  happens -- it does NOT by itself prove the game's OWN code exists there
  yet, and is not read that way here.
- **(b) Outside the static image's own range (everything except
  `$0801`-`$B810`, 20464 bytes):** `10581` of those `20464` addresses are
  non-zero in the capture. Since the static image is exactly zero everywhere
  outside its own range (`$0000` fill, per how the comparison buffer was
  built), every one of these 10581 addresses is a byte the running capture
  holds that the statically extracted `.prg` simply does not contain at all
  -- memory the loader/depacker's own static bytes never touch. This is the
  direct, measured evidence PROOF02_DEPACK_PROGRESS asks for: the captured
  image contains bytes the static `.prg` does not.

**What this does and does not say**, stated plainly rather than smoothed
over: both counts are evidence about HOW FAR this run got -- they are not a
claim that "the whole game" is now resident, and are not read that way here.
Whether the depacked game body's own dispatch constructs are then found by
Task 2's independent site search is `PROOF02_SEARCH_DEPTH`'s and
`PROOF02_DEPACKED_COMPUTED_DISPATCH`'s question, addressed in
`evidence/proof02-computed-dispatch.md`, not this one.

PROOF02_DEPACK_PROGRESS: measured against the statically extracted `.prg`
placed at its own load address `$0801`-`$B810` (45072 bytes) in a zeroed 64K
buffer: (a) `40511` of `45072` addresses inside that static range differ
between the capture and the static bytes (the loader/depacker's packed
on-disk bytes versus what actually occupies those addresses once execution
ran); (b) `10581` of the `20464` addresses OUTSIDE that static range are
non-zero in the capture -- bytes the static `.prg` does not contain at all.
Both counts are non-trivial (not small, not zero), so this is not a "the
image barely changed" result; it is measured evidence of substantial runtime
divergence from the static bytes, reported as what it is -- a depth-of-run
finding -- rather than as a claim about the whole game body, which
`PROOF02_SEARCH_DEPTH` in Task 2 addresses.

## Closing

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x vice-broker; echo "exit=$?"
exit=1

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

No task-scoped broker or emulator process survived either capture. The named
capture Task 2's site search runs over is `proof38-depacked-a`
(`sha256=99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5`,
raw slice) -- the first of the two labels taken, per this phase's own
"pair taken, not best-of-N" convention; since the pair compares byte-identical
the choice between the two labels is immaterial to any downstream measurement.

```
$ git status --porcelain
(empty)
```

Every `.vsf`, flat image and scratch file used by this task lives under
`PROBE_DIR=/home/henrik/.cache/c64-re-tools/phase33/33-10` (Phase 33's own
`33-10` scratch root, reused unchanged by `capture-pair.mjs`'s own hardcoded
constant) -- never inside the checkout, never `/tmp`.

PROOF02_CAPTURE_OBTAINED: yes
PROOF02_CAPTURE_IMAGE_SHA256: 99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5

BROKER_STATE: inactive
