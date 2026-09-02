# 33-capture-pair — one real cracked release, captured twice through the shipped route

**Owner:** plan `33-10`. **Measured:** 2026-09-02, on this host, against genuine unpatched
stock VICE 3.9 at `/usr/bin/x64sc`. **Bound by** `evidence/README.md` § *Evidence
conventions* (the `$ <command>` line, `PROBE_DIR`, `BROKER_STATE`,
`TEST_AUTOMATED_BASELINE`, voided runs recorded, pair-taken-not-best-of-N, final occurrence
wins) and `evidence/SCHEMA.md` § 2.5 (the declared derivation of `C0_CAPTURE_PAIR`) and § 3
(`CAPTURE_FRAME_EXACT`).

This file carries `GATE-01`'s **one corpus-dependent input**. `SCHEMA.md` § 2 names it as
this file's, and only this file's. Its value is whichever of `pass` / `fail` /
`not-obtained` the measurement produced; `could-not-run` is not in the domain and is not a
spelling this phase uses.

The script is `evidence/capture-pair.mjs` — verbs `run`, `compare`, `memspace`,
`preflight`.

`PROBE_DIR` (absolute, outside the checkout, never `/tmp`):
`/home/henrik/.cache/c64-re-tools/phase33/33-10`

Release under test: `danish.d64`, sha256
`1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` — gitignored and never
committed (`D-27`). Identity is **name plus digest over the exact bytes**, never filename
or size: the script refuses outright when the file on disk digests to anything else, so a
same-named different file cannot be measured by accident.

> **Read § *Voided runs* and § *The broker, deliberately started* before any number below.**

---

## Preconditions, observed

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc || echo "(no x64sc)"
(no x64sc)
```

The `pgrep` form is exact-match (`-x`), not `-af`: the `-af` form matches the checking
shell's own command line and always reports a false positive. `D-11` is additionally
enforced **inside** the script (`preflight()`), so no invocation can skip it, and every run
below carries its own `PREFLIGHT_BROKER` / `PREFLIGHT_X64SC` lines.

### The observed `test:automated` baseline

Observed **before the task-scoped broker was started** and before any live run in this
file, with nothing else running:

```
$ cd src/mcp/vice && npm run test:automated 2>&1 | grep -E 'tests [0-9]+|suites [0-9]+|pass [0-9]+|fail [0-9]+'
ℹ tests 3113
ℹ suites 24
ℹ pass 3105
ℹ fail 2
```

Both failures are in `src/mcp/vice/anno-register.test.ts` (assertions at `:385`/`:389` and
`:479`/`:481`), one root cause: the anno register cites requirement ids `STORE-01`,
`STORE-04`, `STORE-06` and `MCP-04`, which the v0.8.0 milestone open dropped from
`.planning/REQUIREMENTS.md`. Out of this phase's scope by `33-02`'s own resolution.

TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479) — tests 3113 / pass 3105 / fail 2; not clean, and never adopted as an acceptance criterion

BROKER_STATE: inactive

---

## The broker, deliberately started

`D-11` requires the broker **stopped** for every measurement in this phase, and this task
needs the broker's **acquire path** — the argv the emulator is launched with is the one
thing this measurement most needs to come from the shipped route rather than from an
evidence script's own copy. The plan resolves the tension explicitly rather than silently,
and so does this record:

- The **systemd-managed `vice-broker` unit** — the one whose liveness reddens the `BACK-05`
  assertion deterministically — was `inactive` before, during and after every run in this
  file. That is what `BROKER_STATE: inactive` above records, and the `test:automated`
  baseline was read against that state.
- The broker actually used is a **task-scoped child process** of `capture-pair.mjs`, started
  and stopped by the script once **per run**, with its state directory under `PROBE_DIR`
  (`.../33-10/broker-state`) so the repository's own `.vice-supervisor/broker.json` is never
  written and the `BACK-05` assertion cannot see it. It is a **child**, never
  `setsid`/`nohup`: a detached broker dies with the session and voids every capture in
  flight, with no reconnect.
- `VICE_BROKER_WARM_FLOOR=0` is load-bearing, not tidiness. At the default of 1 the broker
  refills the warm floor after granting, so a **second** emulator would be alive during the
  measurement — and the host scheduler is what decides the halt moment, which is what
  decides the stop identity past the start of a disk load (`33-03`'s own cause analysis).
- Every run records `POST_X64SC` after the broker is stopped. All four runs in this file
  report `(none)`: no orphan survived any run, which is the failure `33-03` had to void
  sixteen runs over.

The start command, verbatim, transcribed from the run transcripts below:

```
BROKER_START_ENV VICE_BIN=/usr/bin/x64sc VICE_BROKER_WARM_FLOOR=0 VICE_BROKER_MAX=1
BROKER_START_CMD /home/henrik/.nvm/versions/node/v24.20.0/bin/node /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/resources/vice-broker.mjs --repo-root /home/henrik/dev/henrik/git/c64-re-tools --state-dir /home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state
```

Started at `2026-09-02T22:22:32.192Z` for run 1 and stopped at `2026-09-02T22:22:44.294Z`;
started at `2026-09-02T22:22:55.881Z` for run 2 and stopped at `2026-09-02T22:23:09.699Z`.
Per-run start/stop timestamps for the later runs are in their own transcripts.

---

## The route driven

Every element below is a **shipped** seam, reached rather than re-authored. That is the
whole point: a measurement taken against a private reimplementation measures the
reimplementation.

| Step | Shipped seam actually used |
|---|---|
| launch argv | `broker-launch.mts`'s `buildViceArgs()`, reached by **acquiring over the broker control plane** (`vice-broker-client.ts`'s `acquireOverControlPlane()`) with `profile: { headless: true }`. The argv in each transcript is transcribed from the **broker's own `launching …` stderr line**, never rebuilt in the script |
| wire | `stock-protocol.ts`'s `ViceMonitorClient`, `checkpointSetBody`, `autostartBody`, `dumpBody`, `memspaceBody`, `resourceGetBody`. `memspace: 0x00` goes through `memspaceByte()`'s own wire-byte mapping (`T-33-17`), never a hand-written `body[8] =` |
| stop sequence | `33-03`'s settled `S3`: arm the `$EA31` frame anchor **while halted** → `AUTOSTART` (0xdd) → `CHECKPOINT_LIST` (0x14) survival assertion → one `EXIT` (0xaa) per observed `CHECKPOINT_INFO` (0x11) hit → `REGISTERS_GET` (0x31). **No `RESET` anywhere** |
| `.vsf` → flat 64K | the **shipped `vsf-slice` CLI entry point**, spawned through the skill wrapper `src/skills/c64-ram-capture/scripts/vsf-slice.mjs`. Not one snapshot byte offset, module name or body length appears in `capture-pair.mjs` |
| port normalisation | `capture-predicate.ts`'s `normalisePorts()`, from **each snapshot's own** `dirRead`/`dataRead`, read out of the slicer CLI's `--json` summary |
| the predicate | `capture-predicate.ts`'s `compareCaptures()`, `parseAllowList()`, `argvDigest()`, `formatComparison()` |
| the stop oracle | `stop-oracle.ts`'s `compareStopIdentity()` over all four `ORACLE_TERMS` |

`capture route` for both records of the reported pair: **`snapshot`**. That row is what makes
the `$D000-$DFFF` volatility rule **inapplicable** to this pair — a snapshot's memory array
is RAM under I/O, not the register read view.

### ACCEPTED LIMIT — `runReproducible()` is not on this route, and cannot be

The plan asks for the stop to be reached "through `vice_run_until` with `reproducible: true`
and the release's `frame_anchor`". It is not, and the reason is recorded rather than worked
around. Two independent facts, both from `stock-reproducible-run.ts`'s own module header:

1. `runReproducible()` implements the **READY-prompt** sequence and issues a monitor-issued
   **hard `RESET`** from inside the procedure. `AUTOSTART` (0xdd) **is** the power cycle
   (`autostart.c:1437`), so a `RESET` before or after it *undoes* the autostart — `33-03`'s
   `P11`, measured (research's attempt stopped inside the KERNAL reset routine at
   `PC=$FD75`, `hits=0`). A procedure whose second step is a hard reset cannot reach a stop
   with a release loaded. `33-09` chose the READY-prompt sequence deliberately, because
   `33-03` had recorded `AUTOSTART_FRAME_EXACT: not-achieved`.
2. `runReproducible()` sends **exactly one** resume per wait, and an anchor hit arriving
   first is **refused** rather than resumed past. The anchor-**counting** loop (`S3` steps
   8-10, N resumes for N hits) is named in that module's own *WHAT NOT TO DO* list as "an
   evidence script's job, driving this module's pieces directly, and **not** a published
   tool surface".

So `capture-pair.mjs` is exactly the evidence script that module's header points at: it
drives the pieces `runReproducible()` is assembled from, in `S3`'s order. This is a limit of
the phase's published surface, recorded here in this plan's own file as `SCHEMA.md`'s
preamble directs. The frozen files were not edited.

### ACCEPTED LIMIT — `snapshotPathFor()` targets a path inside the checkout

The plan asks for the snapshot path to come from `stock-paths.ts`'s `snapshotPathFor()`,
"and [be] therefore container-visible by construction". That function returns
`<repoRoot>/.vice-snapshots/<name>.vsf` — **inside** the checkout. `/.vice-snapshots/` is
gitignored, so a `git status` grep would not see the file; but `D-27` and threat `T-33-06`
are about corpus, snapshot and capture bytes **not entering the checkout at all**, not about
their being ignored once there. Every `.vsf` and `.bin` this plan wrote therefore lands under
`PROBE_DIR`, outside the checkout entirely, and the snapshot filename is passed straight to
`dumpBody()`. Recorded rather than silently applied.

---

## Every run taken, in the order taken

Four `run` invocations exist. Two are the reported pair, one is Task 2's third derivation
run, and one produced no stop and is voided. All four are listed here; none is dropped.

| # | Label | Jitter (ms) | Target | Outcome |
|---|---|---|---|---|
| 0 | `pair-j0` (first attempt, 22:21:49Z) | 0 | 400 | **VOIDED** — no stop produced. See § *Voided runs* |
| 1 | `pair-j0` | 0 | 400 | usable — **reported pair, run 1** |
| 2 | `pair-j2500` | 2500 | 400 | usable — **reported pair, run 2** |
| 3 | `pair-j4000` | 4000 | 400 | usable — Task 2's third derivation run (`33-transient-derivation.md`) |

**Which two form the reported pair, and why.** Runs 1 and 2 — the **first two usable runs
in the order taken**. Not the two most similar of the three: run 3 exists only because the
committed derivation method needs `N >= 3` real captures, and its numbers are recorded in
`33-transient-derivation.md` and in the union below. The pair was fixed before run 3 was
taken.

**The hit target is 400, and it was fixed before the first run.** It is the target
`33-03`'s own reported pair used, so this measurement is comparable to that one; it is also
the furthest into the release's disk load any measurement in this phase has reached. It was
**not** adjusted after seeing a number. The tempting alternative — a target at or under 50,
where `33-03` measured frame-exactness and **0** differing bytes — was rejected on the
record: the load has not started by hit 50, so a pair of such captures would compare
equivalent while containing none of the release's code, which is a flattering measurement of
the protocol rather than an honest one of a release capture.

### Run 1 — `pair-j0`, pre-protocol jitter 0 ms

```
$ node .planning/phases/33-.../evidence/capture-pair.mjs run --label pair-j0 --jitter 0 --target 400
RUN_LABEL pair-j0
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-10
NODE v24.20.0
DATE_UTC 2026-09-02T22:22:32.048Z
RELEASE /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
VICE_VERSION x64sc (VICE 3.9)
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_START_ENV VICE_BIN=/usr/bin/x64sc VICE_BROKER_WARM_FLOOR=0 VICE_BROKER_MAX=1
BROKER_START_CMD /home/henrik/.nvm/versions/node/v24.20.0/bin/node /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/resources/vice-broker.mjs --repo-root /home/henrik/dev/henrik/git/c64-re-tools --state-dir /home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state
BROKER_START_AT 2026-09-02T22:22:32.192Z
BROKER_JSON pid=418939 control=0.0.0.0:19510 warm_floor=0 max=1
BROKER_BACKEND stock binary=/usr/bin/x64sc
ACQUIRE_MS 24
GRANT id=req-418921-1788387752605-cb819abd port=6600 supervisor_dir=/home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state/6600
ACQUIRE_PROFILE {"headless":true}
BROKER_LAUNCH_LINE vice-broker: launching /usr/bin/x64sc -default -console -drive8type 1541 -seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6600 -remotemonitor -remotemonitoraddress ip4://127.0.0.1:6601 (XDG_CONFIG_HOME=/tmp/vice-broker-vicerc-FSsfJP)
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6600","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:6601"]
SPAWN_ARGV_INDEX_0 -default
XDG_CONFIG_HOME /tmp/vice-broker-vicerc-FSsfJP
ARGV_DIGEST c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864
SEED 4242
JITTER_MS 0
CONNECTED_AFTER_MS 157
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
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.vsf err=0x00 size=193261
BROKER_STOP_AT 2026-09-02T22:22:44.294Z
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.bin","imageBytes":65536,"sha256":"99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE_RAW /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.bin bytes=65536 sha256=99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5
PORT_READS dirRead=47 dataRead=55 dataOut=39
IMAGE_NORMALISED /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.norm.bin bytes=65536 sha256=23f4fe20f45db3e55367fd8c80a26f79b0d40a0cb53635f9b2c64836bc5448f5
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.run.json usable=true
```

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479)

#### Capture record — `danish-ea31x400-run1`

The `capture-record.template.md` Identity table, filled from the transcript above.

| Field | Value | How obtained |
|---|---|---|
| image path | `/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.bin` (raw slice), `…/pair-j0.norm.bin` (port-normalised) | outside the checkout (`D-27`) |
| size | `65536` bytes | the slicer CLI's `imageBytes` |
| sha256 (raw slice) | `99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5` | the shipped `vsf-slice slice --json` |
| sha256 (port-normalised) | `23f4fe20f45db3e55367fd8c80a26f79b0d40a0cb53635f9b2c64836bc5448f5` | `normalisePorts()` from this snapshot's own `dirRead=47`, `dataRead=55` |
| binary sha256 | `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` | `sha256sum danish.d64`; asserted equal by the script before launching |
| argv digest | `c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864` | `argvDigest()` over the broker's own spawn argv, joined by NUL |
| seed | `4242` | the `-seed` value on the spawn argv (`STOCK_DETERMINISM_SEED`) |
| capture route | `snapshot` | `dumpBody()` → the shipped `vsf-slice` CLI |
| checkpoint / trigger address | `$EA31`, hit 400 | the frame anchor, armed while halted before `AUTOSTART` |
| release | `danish` | the canonical corpus element (`D-27`) |
| run | 1 of 3 | three runs is this project's minimum for a verified capture |
| `$00` / `$01` | `47` / `55` | `REGISTERS_GET`, and independently `dirRead`/`dataRead` from the snapshot |
| `.vsf` path | `/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j0.vsf` (193261 bytes, `C64MEM` minor 1, body 65555) | under `PROBE_DIR` |
| checkpoints armed at exit | `1` (the frame anchor; the counting loop owns it and the instance is destroyed on release) | `CHECKPOINT_LIST` |
| epoch-drift errors | none | none raised |

Reproducibility key (the triple): `1a9d294e…|c3710dd6…|4242`.

### Run 2 — `pair-j2500`, pre-protocol jitter 2500 ms

```
$ node .planning/phases/33-.../evidence/capture-pair.mjs run --label pair-j2500 --jitter 2500 --target 400
RUN_LABEL pair-j2500
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-10
NODE v24.20.0
DATE_UTC 2026-09-02T22:22:55.735Z
RELEASE /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
VICE_VERSION x64sc (VICE 3.9)
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_START_ENV VICE_BIN=/usr/bin/x64sc VICE_BROKER_WARM_FLOOR=0 VICE_BROKER_MAX=1
BROKER_START_CMD /home/henrik/.nvm/versions/node/v24.20.0/bin/node /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/resources/vice-broker.mjs --repo-root /home/henrik/dev/henrik/git/c64-re-tools --state-dir /home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state
BROKER_START_AT 2026-09-02T22:22:55.881Z
BROKER_JSON pid=419485 control=0.0.0.0:19510 warm_floor=0 max=1
BROKER_BACKEND stock binary=/usr/bin/x64sc
ACQUIRE_MS 42
GRANT id=req-419472-1788387776302-90069001 port=6600 supervisor_dir=/home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state/6600
ACQUIRE_PROFILE {"headless":true}
BROKER_LAUNCH_LINE vice-broker: launching /usr/bin/x64sc -default -console -drive8type 1541 -seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6600 -remotemonitor -remotemonitoraddress ip4://127.0.0.1:6601 (XDG_CONFIG_HOME=/tmp/vice-broker-vicerc-6LonyD)
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6600","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:6601"]
SPAWN_ARGV_INDEX_0 -default
XDG_CONFIG_HOME /tmp/vice-broker-vicerc-6LonyD
ARGV_DIGEST c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864
SEED 4242
JITTER_MS 2500
CONNECTED_AFTER_MS 6
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
STOP PC=$ea31 hit_count=400 LIN=311 CYC=9 $00=47 $01=55
CHECKPOINT_LIST_AT_EXIT total=1 items=0
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.vsf err=0x00 size=193261
BROKER_STOP_AT 2026-09-02T22:23:09.699Z
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.bin","imageBytes":65536,"sha256":"d517148e1bf2e7abb529f43c60db2fd250777566f4e21595e1d7f40c003b1d94","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE_RAW /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.bin bytes=65536 sha256=d517148e1bf2e7abb529f43c60db2fd250777566f4e21595e1d7f40c003b1d94
PORT_READS dirRead=47 dataRead=55 dataOut=39
IMAGE_NORMALISED /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.norm.bin bytes=65536 sha256=c79c8ec0e8b23d22d78b5ebc0d9707ad7d8bc04bf24c0ac8c11fff74a629219d
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.run.json usable=true
```

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479)

#### Capture record — `danish-ea31x400-run2`

| Field | Value | How obtained |
|---|---|---|
| image path | `…/pair-j2500.bin` (raw slice), `…/pair-j2500.norm.bin` (port-normalised) | outside the checkout (`D-27`) |
| size | `65536` bytes | the slicer CLI's `imageBytes` |
| sha256 (raw slice) | `d517148e1bf2e7abb529f43c60db2fd250777566f4e21595e1d7f40c003b1d94` | the shipped `vsf-slice slice --json` |
| sha256 (port-normalised) | `c79c8ec0e8b23d22d78b5ebc0d9707ad7d8bc04bf24c0ac8c11fff74a629219d` | `normalisePorts()` from `dirRead=47`, `dataRead=55` |
| binary sha256 | `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` | asserted equal by the script before launching |
| argv digest | `c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864` | `argvDigest()` over the broker's own spawn argv |
| seed | `4242` | the `-seed` value on the spawn argv |
| capture route | `snapshot` | `dumpBody()` → the shipped `vsf-slice` CLI |
| checkpoint / trigger address | `$EA31`, hit 400 | the frame anchor |
| release | `danish` | the canonical corpus element |
| run | 2 of 3 | — |
| `$00` / `$01` | `47` / `55` | `REGISTERS_GET`, and `dirRead`/`dataRead` |
| `.vsf` path | `/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j2500.vsf` (193261 bytes, minor 1, body 65555) | under `PROBE_DIR` |
| checkpoints armed at exit | `1` (the frame anchor) | `CHECKPOINT_LIST` |
| epoch-drift errors | none | none raised |

Reproducibility key (the triple): `1a9d294e…|c3710dd6…|4242` — **identical to run 1's**, which
is the precondition for comparing them as a pair at all. The script refuses the comparison
outright when the keys differ.

**True drive emulation was genuinely in the loop for both runs.** `Drive8TrueEmulation=1`
and `Drive8Type=1541`, read back over `RESOURCE_GET` (0x51) inside each run, not assumed
from the argv. That is the condition `SCHEMA.md` § 2.5 attaches to `C0_CAPTURE_PAIR` and it
is met. `AutostartDelayRandom=0` confirms `+autostart-delay-random` took effect.

---

### Run 3 — `pair-j4000`, pre-protocol jitter 4000 ms (Task 2's third derivation run)

Taken **after** the reported pair was fixed, because the committed derivation method needs
`N >= 3` real captures of one release at one stop. It is **not** part of the reported pair.
Why 4000 ms specifically, and why not the 1200 ms that `33-03` measured as agreeing with
jitter 0, is recorded in `33-transient-derivation.md` § *Which three runs, at which jitters,
and why those*.

```
$ node .planning/phases/33-.../evidence/capture-pair.mjs run --label pair-j4000 --jitter 4000 --target 400
RUN_LABEL pair-j4000
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-10
NODE v24.20.0
DATE_UTC 2026-09-02T22:27:38.294Z
RELEASE /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
VICE_VERSION x64sc (VICE 3.9)
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_START_ENV VICE_BIN=/usr/bin/x64sc VICE_BROKER_WARM_FLOOR=0 VICE_BROKER_MAX=1
BROKER_START_CMD /home/henrik/.nvm/versions/node/v24.20.0/bin/node /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/resources/vice-broker.mjs --repo-root /home/henrik/dev/henrik/git/c64-re-tools --state-dir /home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state
BROKER_START_AT 2026-09-02T22:27:38.608Z
BROKER_JSON pid=425258 control=0.0.0.0:19510 warm_floor=0 max=1
BROKER_BACKEND stock binary=/usr/bin/x64sc
ACQUIRE_MS 27
GRANT id=req-425245-1788388059023-9a7169c4 port=6600 supervisor_dir=/home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state/6600
ACQUIRE_PROFILE {"headless":true}
BROKER_LAUNCH_LINE vice-broker: launching /usr/bin/x64sc -default -console -drive8type 1541 -seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6600 -remotemonitor -remotemonitoraddress ip4://127.0.0.1:6601 (XDG_CONFIG_HOME=/tmp/vice-broker-vicerc-16HSQp)
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6600","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:6601"]
SPAWN_ARGV_INDEX_0 -default
XDG_CONFIG_HOME /tmp/vice-broker-vicerc-16HSQp
ARGV_DIGEST c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864
SEED 4242
JITTER_MS 4000
CONNECTED_AFTER_MS 2
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
STOP PC=$ea31 hit_count=400 LIN=160 CYC=49 $00=47 $01=55
CHECKPOINT_LIST_AT_EXIT total=1 items=0
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.vsf err=0x00 size=193261
BROKER_STOP_AT 2026-09-02T22:27:54.736Z
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.bin","imageBytes":65536,"sha256":"3934b7172707f790ad94b963cda2dcbb5cf94d186cdaf9871eecec748b1cd24a","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE_RAW /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.bin bytes=65536 sha256=3934b7172707f790ad94b963cda2dcbb5cf94d186cdaf9871eecec748b1cd24a
PORT_READS dirRead=47 dataRead=55 dataOut=39
IMAGE_NORMALISED /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.norm.bin bytes=65536 sha256=8673db3b5529f9a51fc051ef3a3f71a25facb8753d199650e2ae457bab6a7c5e
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.run.json usable=true
```

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479)

#### Capture record — `danish-ea31x400-run3`

| Field | Value | How obtained |
|---|---|---|
| image path | `…/pair-j4000.bin` (raw slice), `…/pair-j4000.norm.bin` (port-normalised) | outside the checkout (`D-27`) |
| size | `65536` bytes | the slicer CLI's `imageBytes` |
| sha256 (raw slice) | `3934b7172707f790ad94b963cda2dcbb5cf94d186cdaf9871eecec748b1cd24a` | the shipped `vsf-slice slice --json` |
| sha256 (port-normalised) | `8673db3b5529f9a51fc051ef3a3f71a25facb8753d199650e2ae457bab6a7c5e` | `normalisePorts()` from `dirRead=47`, `dataRead=55` |
| binary sha256 | `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` | asserted equal by the script before launching |
| argv digest | `c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864` | `argvDigest()` over the broker's own spawn argv |
| seed | `4242` | the `-seed` value on the spawn argv |
| capture route | `snapshot` | `dumpBody()` → the shipped `vsf-slice` CLI |
| checkpoint / trigger address | `$EA31`, hit 400 | the frame anchor |
| release | `danish` | the canonical corpus element |
| run | 3 of 3 | derivation input only, not part of the reported pair |
| `$00` / `$01` | `47` / `55` | `REGISTERS_GET`, and `dirRead`/`dataRead` |
| `.vsf` path | `/home/henrik/.cache/c64-re-tools/phase33/33-10/pair-j4000.vsf` (193261 bytes, minor 1, body 65555) | under `PROBE_DIR` |
| epoch-drift errors | none | none raised |

Reproducibility key: `1a9d294e…|c3710dd6…|4242` — identical to runs 1 and 2, which is why
the three are comparable as a set at all.

**All three stops, side by side.** `PC` and `hit_count` are identical on all three; the
frame term is not:

| Run | Jitter (ms) | `pc` | `hitCount` | `line` | `cycle` |
|---|---|---|---|---|---|
| 1 `pair-j0` | 0 | `$ea31` | 400 | 154 | 11 |
| 2 `pair-j2500` | 2500 | `$ea31` | 400 | **311** | **9** |
| 3 `pair-j4000` | 4000 | `$ea31` | 400 | **160** | **49** |

Three distinct stops at three jitters. **No two of the three agree on the frame term**, which
is the same shape `33-03` measured and the reason `AUTOSTART_FRAME_EXACT` is recorded there
as `not-achieved`.

---

## Voided runs

Convention 5: a run that produced no usable stop is written in **with its reason**, and the
reported pair is the pair taken, in the order taken.

**VOIDED RUN V1** — `run --label pair-j0 --jitter 0 --target 400`, first attempt,
`2026-09-02T22:21:49.555Z`. **Reason: no stop produced.** The broker's `acquire` returned in
33 ms — before `x64sc` had bound its binary-monitor socket — and the script's single-shot
`connect()` failed:

```
ACQUIRE_MS 33
GRANT id=req-417839-1788387710134-a11ca9d3 port=6600 supervisor_dir=/home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state/6600
JITTER_MS 0
BROKER_STOP_AT 2026-09-02T22:21:51.670Z
POST_X64SC (none)
Error: connect ECONNREFUSED 127.0.0.1:6600
```

No anchor was armed, no `AUTOSTART` was issued, no snapshot was written and no image exists.
`POST_X64SC (none)` confirms the run orphaned nothing — the reap-on-exit handler did its job
on the throw path, which is precisely the failure mode `33-03` had to void sixteen runs over.

**Fixed at the cause, not by retrying.** `connectWithRetry()` now dials until the listener
accepts, within a recorded budget, and every run reports `CONNECTED_AFTER_MS` so the dial
interval is visible as part of the pre-protocol interval rather than hidden inside it. The
measured lesson is worth stating: **a broker grant is not a bound monitor.** The broker
returns the grant as soon as the port is allocated and the launch is under way; readiness is
`PING` (0x81), and before `PING` can be sent the socket has to be accepted at all.

**Not a voided run, recorded so the count is honest:** the first `compare --a pair-j0 --b
pair-j2500` invocation threw before producing a verdict —
`StopOracleError: compareStopIdentity: term "line" is absent or not a finite integer on side
a` — because the run records spelled the frame term `lin`/`cyc` while `ORACLE_TERMS` spells
it `line`/`cycle`. That is a defect in this script's field names, not a measurement: **no
capture was taken and no recorded number changed.** The oracle refusing a partial record *by
name* rather than comparing three of four terms is the behaviour `33-07` built it for,
observed here by accident. Both captures were kept; a named `toStopIdentity()` maps the key
names, altering no recorded value, and its comment says why two spellings exist.

---

## The comparison, under `CAP-02`'s committed predicate

Run 1 against run 2, on the port-normalised images, twice: first with an **empty** allow-list
so the raw divergence is on the record, then with the allow-list
`33-transient-derivation.md` derived. `SCHEMA.md` § 2.5's `pass` clause is defined against
the derived allow-list, so the second comparison is the one the outcome line reads — but the
first is what a reader needs to see the size of what the allow-list is absorbing.

### First, with an empty allow-list — the raw divergence

```
$ node .planning/phases/33-.../evidence/capture-pair.mjs compare --a pair-j0 --b pair-j2500
PAIR_A pair-j0 jitter=0 argvDigest=c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864 seed=4242 releaseSha=1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
PAIR_B pair-j2500 jitter=2500 argvDigest=c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864 seed=4242 releaseSha=1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
REPRO_KEY_A 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5|c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864|4242
REPRO_KEY_B 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5|c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864|4242
REPRO_KEY_MATCH yes
ORACLE_TERMS ["pc","hitCount","line","cycle"]
STOP_IDENTITY_A {"pc":59953,"hitCount":400,"line":154,"cycle":11}
STOP_IDENTITY_B {"pc":59953,"hitCount":400,"line":311,"cycle":9}
STOP_IDENTITY_VERDICT {"identical":false,"differingTerms":["line","cycle"],"frameTermAsserted":true}
ALLOW_LIST empty (no allow-list artifact given)
COMPARE verdict=not-equivalent differing=28 allowed=0 cap=64 allowListSize=0
DIFFERING_COUNT 28
DIFFERING_FIRST_20 $00A4 $00AE $00AF $01F1 $01F2 $01F3 $13F6 $13F7 $13F8 $13F9 $13FA $13FB $13FC $13FD $13FE $13FF $1400 $1401 $1402 $1403
ALLOWED_FIRST_20 (none)
allowed (enumerated transients, excluded from the verdict; 0 of a cap of 64): 0
DIVERGENCE -- outside the allow-list, fails the comparison at any bit count: 28
  $00A4  $A5 %10100101  ->  $10 %00010000   5 bits
  $00AE  $F6 %11110110  ->  $0C %00001100   6 bits
  $00AF  $13 %00010011  ->  $14 %00010100   3 bits
  $01F1  $01 %00000001  ->  $88 %10001000   3 bits
  $01F2  $A5 %10100101  ->  $10 %00010000   5 bits
  $01F3  $A0 %10100000  ->  $20 %00100000   1 bit
  $13F6  $00 %00000000  ->  $A5 %10100101   4 bits
  $13F7  $00 %00000000  ->  $29 %00101001   3 bits
  $13F8  $00 %00000000  ->  $0A %00001010   2 bits
  $13F9  $00 %00000000  ->  $AA %10101010   4 bits
  $13FA  $FF %11111111  ->  $BD %10111101   2 bits
  $13FB  $FF %11111111  ->  $A8 %10101000   5 bits
  $13FC  $FF %11111111  ->  $4A %01001010   5 bits
  $13FD  $FF %11111111  ->  $85 %10000101   5 bits
  $13FE  $00 %00000000  ->  $06 %00000110   2 bits
  $13FF  $00 %00000000  ->  $BD %10111101   6 bits
  $1400  $00 %00000000  ->  $A9 %10101001   4 bits
  $1401  $00 %00000000  ->  $4A %01001010   3 bits
  $1402  $FF %11111111  ->  $85 %10000101   5 bits
  $1403  $FF %11111111  ->  $07 %00000111   5 bits
  ... 8 more
VERDICT: not-equivalent
DERIVED_C0_CAPTURE_PAIR fail
DERIVED_CAPTURE_FRAME_EXACT no
DERIVED_DIFFERING_TERMS line,cycle
```

All 28 differing addresses, enumerated (the transcript truncates its detail rows at 20):

```
$ node -e '<compareCaptures over the two normalised images with an empty allow-list>'
ALL_DIFFERING_28 $00A4 $00AE $00AF $01F1 $01F2 $01F3 $13F6 $13F7 $13F8 $13F9 $13FA $13FB $13FC $13FD $13FE $13FF $1400 $1401 $1402 $1403 $1404 $1405 $1406 $1407 $1408 $1409 $140A $140B
```

**The shape of the divergence is the one `33-03` recorded and `33-RESEARCH.md` M6 recorded
before it:** `$00A4` in the KERNAL's zero-page working area, `$00AE`/`$00AF` (the KERNAL
load end pointers), three bytes of dead stack at `$01F1`+, and then **one contiguous 22-byte
run at `$13F6`-`$140B`** — the disk load's current buffer position. That contiguous run is
not program state; it is a load in progress at two slightly different rates. `33-03`
measured the same run *moving with the hit target* (`$0880` at hit 75, `$095D` at 100,
`$0CFD` at 200, `$13F6` at 400), and this pair lands on exactly the hit-400 position.

The `DERIVED_*` lines above are the script applying `SCHEMA.md` § 2.5 to **this** comparison
— i.e. to a comparison with no allow-list. They are transcript, not the outcome line; the
outcome line is derived below against the allow-list `SCHEMA.md` § 2.5 actually names.

### Then, with the derived allow-list

```
$ node .planning/phases/33-.../evidence/capture-pair.mjs compare --a pair-j0 --b pair-j2500 --allow-list src/skills/c64-ram-capture/transients/danish.json
PAIR_A pair-j0 jitter=0 argvDigest=c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864 seed=4242 releaseSha=1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
PAIR_B pair-j2500 jitter=2500 argvDigest=c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864 seed=4242 releaseSha=1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
REPRO_KEY_A 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5|c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864|4242
REPRO_KEY_B 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5|c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864|4242
REPRO_KEY_MATCH yes
ORACLE_TERMS ["pc","hitCount","line","cycle"]
STOP_IDENTITY_A {"pc":59953,"hitCount":400,"line":154,"cycle":11}
STOP_IDENTITY_B {"pc":59953,"hitCount":400,"line":311,"cycle":9}
STOP_IDENTITY_VERDICT {"identical":false,"differingTerms":["line","cycle"],"frameTermAsserted":true}
ALLOW_LIST src/skills/c64-ram-capture/transients/danish.json (release "danish", 49 entries)
COMPARE verdict=equivalent differing=0 allowed=28 cap=64 allowListSize=49
DIFFERING_COUNT 0
DIFFERING_FIRST_20 (none)
ALLOWED_FIRST_20 $00A4 $00AE $00AF $01F1 $01F2 $01F3 $13F6 $13F7 $13F8 $13F9 $13FA $13FB $13FC $13FD $13FE $13FF $1400 $1401 $1402 $1403
allowed (enumerated transients, excluded from the verdict; 49 of a cap of 64): 28
  [... the 28 allow-listed rows, byte for byte the same rows the empty-allow-list run
   printed as DIVERGENCE, moved into the `allowed` bucket ...]
DIVERGENCE -- outside the allow-list, fails the comparison at any bit count: 0
VERDICT: equivalent
DERIVED_C0_CAPTURE_PAIR pass
DERIVED_CAPTURE_FRAME_EXACT no
DERIVED_DIFFERING_TERMS line,cycle
```

**Which allow-list was used.** `src/skills/c64-ram-capture/transients/danish.json`, 49
entries, derived by the committed method over runs 1, 2 and 3 —
`33-transient-derivation.md` carries its full transcript, its exit status, its
per-address attributions and the accepted limit that matters most about it. It is **not** a
voided derivation: `TRANSIENT_COUNT: 49` against a cap of 64, so the script wrote the
artifact and `DERIVATION: void` is absent, exactly as `SCHEMA.md` § 3 specifies for the
at-or-under-cap branch. Had it voided, this comparison would have used an **empty**
allow-list and the outcome would have been the `fail` the first transcript above records —
comparing against a voided derivation would be comparing against nothing while appearing to
compare against something.

### The outcome, derived

`SCHEMA.md` § 2.5's rule, applied condition by condition rather than summarised:

| Condition | Observed | Met? |
|---|---|---|
| one real cracked release | `danish.d64`, sha256 asserted equal before launch | yes |
| **autostarted** | `AUTOSTART` (0xdd) `err=0x00`, all three runs; no `RESET` anywhere | yes |
| **true drive emulation in the loop** | `Drive8TrueEmulation=1`, `Drive8Type=1541`, read back over `RESOURCE_GET` inside each run | yes |
| **captured twice** | two usable captures, 65536 bytes each, digests above | yes |
| pair compares **equivalent** under `CAP-02`'s predicate | `verdict=equivalent`, `differing=0`, 28 differences all enumerated transients | yes |
| allow-list **at or under** the committed cap of 64 | 49 entries against a cap of 64 | yes |

Every condition of the `pass` clause is met, and neither `fail` clause is reached: the pair
does compare equivalent, and the derivation did not exceed the cap. Two captures were
obtained, so `not-obtained` does not apply.

C0_CAPTURE_PAIR: pass

CAPTURE_FRAME_EXACT: no
Differing terms: `line` (154 against 311) and `cycle` (11 against 9). `pc` (`$ea31`) and
`hitCount` (400) are identical on both runs, and all four terms were asserted
(`frameTermAsserted: true`). Two of the four `ORACLE_TERMS` differ, so the value is `no`
under `SCHEMA.md` § 3's rule; a three-of-four match is not a pass. The cause is `33-03`'s,
re-observed here: `AUTOSTART`'s power cycle resets the CPU, the VIC-II and the CIAs but
**not the absolute emulated clock**, and the 1541's rotational phase is a function of that
clock, so the pre-protocol interval leaks into the disk load's byte timing and every stop
counted past the start of the load inherits it.

### ACCEPTED LIMIT — read this `pass` for exactly what it can support

`C0_CAPTURE_PAIR: pass` and `CAPTURE_FRAME_EXACT: no` sit next to each other in this file
and they are not a contradiction — `SCHEMA.md` § 3 is explicit that `CAPTURE_FRAME_EXACT`
"is the *cause* a `fail` narrowing is authored against, **not a second gate**". But the pair
is easy to misread, so the reading is written down here rather than left to a later reader
under time pressure:

1. **The allow-list was derived from three runs, two of which are the reported pair.** So
   the pair's 28 differing addresses are inside the 49-entry list *by construction*, and the
   `equivalent` verdict was determined the moment the derivation wrote an artifact at all.
   The pair comparison is not an independent test of the pair; it is a restatement of "the
   union fitted under the cap". This follows from the committed method (`D-23`), which fixes
   N ≥ 3 runs of one release at one stop and is frozen — it is not a choice made here and it
   is not repaired by inventing a different method.
2. **The entire discriminating power of this result therefore sits in the cap**, exactly as
   `transients/README.md` says: the cap "separates a frame-exact stop from a stop that is
   not". This stop's run-to-run variation fits inside 64 enumerated addresses. That is what
   `pass` says. It does **not** say the stop is frame-exact — `CAPTURE_FRAME_EXACT: no`
   says the opposite, on the same page, from the same runs.
3. **The list is not vacuous, and that was checked rather than assumed.** A one-bit flip
   planted at `$C000`, outside the 49 addresses, makes the same comparison fail
   (`33-transient-derivation.md` § *ACCEPTED LIMIT*). 49 addresses of 65536 are allowed to
   differ; a single bit anywhere in the other 65487 fails, at any bit count.
4. **How close this came to the other branch.** 48 of the 49 union addresses come from one
   pairing (jitter 0 against jitter 4000), and `33-03` measured **66** — over the cap — for
   the nominally corresponding comparison on a **directly launched** instance. The two are
   different launches with different argv digests (the broker's argv additionally carries
   `-remotemonitor -remotemonitoraddress ip4://127.0.0.1:6601` and a scratch
   `XDG_CONFIG_HOME`) and are not two samples of one quantity, so 49 does not contradict 66.
   What both agree on is the direction: **a frame-anchored post-load stop on this release
   straddles the cap.** A future run of this same script may well void. That is the
   measurement, not a flaw in it.

**No jitter was retried and no run was taken to get the union under the cap.** Every jitter
used is recorded — 0, 2500, 4000 — with the basis for each fixed before it was run.

### `CAP-04`'s recorded edge cases, applied

- **empty.** Not taken: two usable captures were obtained, so `not-obtained` does not apply.
  Had fewer than two been obtained, `not-obtained` would be written **as a value** with its
  reason on the line below — `SCHEMA.md` is explicit that an absent capture is never an
  absent verdict input, and `DECISION-RULE.md`'s `R5` pre-maps its consequence.
- **encoding.** Applied: the release is identified by sha256 over its exact bytes. The script
  asserts the digest before launching and refuses a mismatch by name, so a same-named
  different file cannot be measured. The digest appears in every run transcript.
- **ordering.** Applied: four `run` invocations exist and all four are in the table above,
  including the voided one. The reported pair is the **first two usable runs in the order
  taken**, and it was named before run 3 was taken.
- **precision.** Applied: the pair's differing-address count is reported exactly (**28** with
  an empty allow-list, **0** outside a 49-entry list), and the derivation's union is reported
  exactly (**49**) and compared against the cap of 64 in `33-transient-derivation.md`.
  Nothing is reported as "close" — and where the result came close, the numbers are given
  rather than the adverb.
- **boundary.** Applied: `CAPTURE_FRAME_EXACT` is `no` and the differing terms are named. All
  four terms were asserted.
- **adjacency.** Applied as a rule, not demonstrated here: two stops one anchor hit apart are
  **not** equivalent under this oracle even if `(line, cycle)` matched, because `hitCount`
  separates them. `33-03` measured that `(LIN, CYC)` does not even agree between adjacent
  hits at this anchor (`LIN` moves by −52 lines per hit, the KERNAL IRQ being CIA1-timer
  driven with a period that is not an exact multiple of the PAL frame), so producing a
  `(line, cycle)`-agreeing adjacent pair is `33-11`'s job under `ORACLE_NECESSITY`.

### No binary byte entered the checkout

```
$ git status --porcelain | grep -E '\.(d64|vsf|bin|prg|t64|tap|crt)$' | wc -l
0
```

Every `.d64`, `.vsf` and `.bin` involved lives under `PROBE_DIR` or in the gitignored corpus
directory. Only digests, counts, register values, the derived JSON and prose travel into git.
