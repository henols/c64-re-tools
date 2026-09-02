# 33-wallclock-control — two of the five `D-07` controls, observed red

**Owner:** plan `33-03`. **Measured:** 2026-09-02, on this host, against genuine stock
VICE 3.9 at `/usr/bin/x64sc`. **Bound by** `evidence/README.md` § *Evidence conventions*
and `evidence/SCHEMA.md` § 3.

Both controls here exist to be **red**. A control that cannot fail proves nothing, so each
one records the **paired positive** that shows the red was caused by the thing under test
and not by a flaky emulator, a wrong anchor or a mis-built argv.

Companion file: `evidence/33-autostart-sequencing.md`, same plan, same probe
(`evidence/autostart-probe.mjs`), same release.

`PROBE_DIR` (absolute, outside the checkout, never `/tmp`):
`/home/henrik/.cache/c64-re-tools/phase33`

Release: `danish.d64`, sha256
`1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` — gitignored, never
committed (`D-27`).

---

## Provenance

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc || echo "(no output)"
(no output)
```

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479) — the expected post-33-02 baseline; the transcript is in 33-autostart-sequencing.md § *The observed `test:automated` baseline*, observed in the same session as every run below

Every run in this file also carries the probe's own `PREFLIGHT_BROKER inactive` and
`PREFLIGHT_X64SC (none)` lines, printed before the emulator is launched. That guard exists
because it was **needed**: see § *Voided runs*.

---

## Voided runs

**VOIDED — `auto-j0` and `auto-j2500`, the first Control A pair.** Reason: taken while five
orphaned `x64sc` processes from the `-initbreak reset` failures were still alive, so
`pgrep -x x64sc` was non-empty and `D-11` / evidence convention 3 were violated. Their
numbers were `LIN=245 CYC=26` and `LIN=248 CYC=24`. **Discarded and re-taken, never
repaired** — the full episode, including the two numbers that moved and the one conclusion
that reversed, is recorded in `33-autostart-sequencing.md` § *Voided runs*. Everything below
is from the clean re-take, with the in-probe guard active.

**NOT VOIDED, but recorded as a control instance that came out `not-red`** — the first
Control B shape (bracket an *autostarted* run under `-warp` and ask whether the anchor still
fires). It is kept, reported, and explained in § *Control B*, because its `not-red` result
is what led to the mechanism the red instance actually isolates. It was not discarded and it
was not retried until it went red.


---

## Control A — wall-clock anchoring, on a real autostarted release

**Procedure.** Autostart `danish.d64`, resume, wait a fixed **wall-clock** interval of 20 s,
re-halt, arm the `$EA31` anchor (`stop: true`, `temporary: false`, `memspace 0x00`), count
to a fixed 400 hits, then read all four stop-identity terms from one `REGISTERS_GET` reply.
Twice, at pre-protocol jitter 0 ms and 2500 ms. The **only** difference from
`33-autostart-sequencing.md`'s settled `S3` sequence is *where the count starts from*: a
wall-clock moment after the autostart instead of the autostart's own power cycle.

```
$ node .planning/phases/33-.../evidence/autostart-probe.mjs controlA --jitter 0 --wait-ms 20000 --target 400 --label v2-auto-j0
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
PROBE_MODE controlA label=v2-auto-j0
ARGV ["-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:43335"]
JITTER_MS 0
MONITOR_READY_AFTER_PINGS 1
RESOURCE Drive8TrueEmulation=1 Drive8Type=1541 AutostartDelayRandom=0
AUTOSTART err=0x00
WALLCLOCK_WAIT_MS 20000
PING err=0x00
ARMED_AFTER_WALLCLOCK_WAIT cp=1 start=$ea31 hits=0
COUNTED reached=true hits=400 target=400 reason=-
RUN v2-auto-j0 jitter=0 asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=17 CYC=36 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/v2-auto-j0.vsf err=0x00 size=193261

$ node .planning/phases/33-.../evidence/autostart-probe.mjs controlA --jitter 2500 --wait-ms 20000 --target 400 --label v2-auto-j2500
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
PROBE_MODE controlA label=v2-auto-j2500
JITTER_MS 2500
MONITOR_READY_AFTER_PINGS 1
RESOURCE Drive8TrueEmulation=1 Drive8Type=1541 AutostartDelayRandom=0
AUTOSTART err=0x00
WALLCLOCK_WAIT_MS 20000
PING err=0x00
ARMED_AFTER_WALLCLOCK_WAIT cp=1 start=$ea31 hits=0
COUNTED reached=true hits=400 target=400 reason=-
RUN v2-auto-j2500 jitter=2500 asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=239 CYC=58 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/v2-auto-j2500.vsf err=0x00 size=193261

$ node .planning/phases/33-.../evidence/autostart-probe.mjs diff v2-auto-j0.vsf v2-auto-j2500.vsf
PROBE_MODE diff
A /home/henrik/.cache/c64-re-tools/phase33/v2-auto-j0.vsf modules=26 endedAt=193261 c64mem_body=65555 minor=1 sha=11684933dfe9140f3c29222e437e88c15d301aa060a8ac6d4255f1963e1cc776
B /home/henrik/.cache/c64-re-tools/phase33/v2-auto-j2500.vsf modules=26 endedAt=193261 c64mem_body=65555 minor=1 sha=f889912d55db11042d9f5b7ec16c09feb2f66fe844e44584d765d577cff40601
PAIR diffs=255
PAIR first=$00a2 $00a4 $00ae $00af $01f1 $01f2 $36a1 $36a2 $36a3 $36a4 $36a5 $36a6 $36a7 $36a8 $36a9 $36aa $36ab $36ac $36ad $36ae
```

### The four stop-identity terms, both runs

| Term | `v2-auto-j0` (jitter 0) | `v2-auto-j2500` (jitter 2500) | Identical? |
|---|---|---|---|
| `PC` | `$ea31` | `$ea31` | **yes** |
| `hit_count` | 400 | 400 | **yes** |
| `LIN` | 17 | 239 | **no** |
| `CYC` | 36 | 58 | **no** |

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479)

**This is the measured red signature exactly as `CAP-04` requires it: same instruction,
same hit count, differing `LIN`.** Research recorded 157 against 136 with 300 differing
bytes (`33-RESEARCH.md` M6); this reproduction gives 17 against 239 with **255** differing
bytes. The numbers differ because the absolute clock at the wall-clock moment differs run to
run — that is the failure being demonstrated, not noise in the demonstration — and the
*shape* reproduces precisely:

```
M6 (research):  first=$0001 $00a2 $00a4 $00ae $00af $01f1 $01f2 $01f3 $2f5f ... (contiguous from $2F5F)
here:           first=$00a2 $00a4 $00ae $00af $01f1 $01f2 $36a1 ...             (contiguous from $36A1)
```

The jiffy clock (`$00A2`), the KERNAL load end pointers (`$00AE`/`$00AF`), dead stack at
`$01F1`+, then one contiguous run — a load still in progress at a different point. Same
structural signature, different release position, because the stop was pinned to the wall
clock rather than to a frame.

### The paired positive that makes this a control

The red above is attributable to **wall-clock anchoring** and not to the emulator, the
release, the anchor or the argv, because the frame-anchored sequence at the **same anchor**,
on the **same release**, with the **same argv**, differing *only* in whether the stop was
wall-clock-anchored, does dramatically better:

- **Cited by name:** `evidence/33-autostart-sequencing.md` carries
  `AUTOSTART_FRAME_EXACT: not-achieved` at column 0, with the differing terms named as
  `LIN` (154 against 159) and `CYC` (11 against 47) at 400 anchor hits, and **48** differing
  addresses for that pair.
- Same file, at a **pre-load** anchor count (hits 1, 10 and 50, both jitters): all four
  terms identical *and* **0** differing addresses, one identical 64K sha256
  `c97a08b636cba7e824d854b9a3fe15c4d18fed7b527203ac6ca3699cfc9be9d3`.

So on this release the frame-anchored contrast is **255 → 48 → 0** differing addresses as
the anchoring gets stricter, at the same anchor and the same argv. The honest form of the
contrast is worth stating plainly: `AUTOSTART_FRAME_EXACT` is recorded `not-achieved`, so
this is **not** a red-against-green pairing. It is red against *materially better*, and the
pre-load leg is a genuine green (four-term identity plus one sha256). That is enough to
attribute the red to the anchoring — a wall-clock stop cannot reach 0 differing addresses at
any count, and a frame-anchored stop does.

WALLCLOCK_CONTROL: red

Derived exactly as the plan's rule states: `red` iff the two runs differ in `LIN` or `CYC`
while `PC` and `hit_count` match. `PC` matches (`$ea31`), `hit_count` matches (400), and
both `LIN` (17 against 239) and `CYC` (36 against 58) differ. The precise signature, so
`red`.


---

## Control B — the warp-invalidated wall-clock bracket

Two instances. The first is the one the plan describes literally; it came out **`not-red`**
and that result is *reported, not discarded*, because it is what identified the mechanism.
The second isolates that mechanism and is **red**, with its paired positive built in.

### Instance 1 — bracket an autostarted run under `-warp`: `not-red`

`-warp` appended after `+autostart-delay-random`, a 20 s wall-clock bracket sized for an
unwarped run, then the same `$EA31` anchor counted to 400.

```
$ node .planning/phases/33-.../evidence/autostart-probe.mjs controlB --jitter 0 --bracket-ms 20000 --target 400 --label v2-warp-bracket
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
PROBE_MODE controlB label=v2-warp-bracket
ARGV ["-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:38147"]
MONITOR_READY_AFTER_PINGS 1
RESOURCE Drive8TrueEmulation=1 Drive8Type=1541 AutostartDelayRandom=0
AUTOSTART err=0x00
BRACKET_BUDGET_MS 20000 (calibrated for an UNWARPED run)
PING err=0x00
ARMED_AFTER_BRACKET cp=1 start=$ea31 hits=0
COUNTED reached=true hits=400 target=400 reason=-
BRACKET_WALLCLOCK_ELAPSED_MS 20006
BRACKET_TIMED_OUT no
RUN v2-warp-bracket jitter=0 warp=yes asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=237 CYC=19 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/v2-warp-bracket.vsf err=0x00 size=193261
CHILD_EXIT {"code":null,"signal":"SIGKILL"}
```

Real child `stdout` from that `-warp` launch, `AUTOSTART` lines only (ANSI colour
stripped, nothing else altered):

```
$ grep -aoE 'AUTOSTART[^:]*: [^\r]*' v2-controlB.log | sed 's/\x1b\[[0-9;]*m//g'
AUTOSTART: Autodetecting image type of `/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64'.
AUTOSTART: Attached file `/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64' as a disk image.
AUTOSTART: mounted image is type: 1541, not changing drive.
AUTOSTART: Resetting drive 8
AUTOSTART: Resetting the machine to autostart '*'
AUTOSTART: `/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64' recognized as disk image.
AUTOSTART: Loading program '*'
AUTOSTART: Entered ROM at $e5d4
AUTOSTART: Searching for ...
AUTOSTART: Loading
AUTOSTART: Entered ROM at $ea21

$ grep -aoE 'AUTOSTART[^:]*: [^\r]*' v2-controlA-j0.log | sed 's/\x1b\[[0-9;]*m//g'   # the SAME launch WITHOUT -warp
AUTOSTART: Autodetecting image type of `/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64'.
AUTOSTART: Attached file `/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64' as a disk image.
AUTOSTART: mounted image is type: 1541, not changing drive.
AUTOSTART: Resetting drive 8
AUTOSTART: Resetting the machine to autostart '*'
AUTOSTART: Turning Warp mode on.
AUTOSTART: `/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64' recognized as disk image.
AUTOSTART: Loading program '*'
```

No `stderr` was produced by either launch. `CHILD_STDERR` is absent from both
transcripts, which the probe prints only when the child wrote to it.

**`BRACKET_TIMED_OUT no`.** The bracket did **not** time out: the anchor still fired 400
times and the run produced a normal stop (`PC=$ea31 LIN=237 CYC=19`). So by the plan's own
rule — `red` iff the bracket produced a spurious timeout **or** a stop outside the intended
region — this instance is `not-red`, and it is recorded as a finding rather than retried.

**Why, measured.** Two facts, and both are useful to later plans:

1. **`AUTOSTART` owns the warp state during the load.** Compare the two `AUTOSTART` blocks
   above: the run *without* `-warp` prints `AUTOSTART: Turning Warp mode on.`; the run
   *with* `-warp` does not print it at all, because warp was already on. **Both loads are
   warped either way.** `-warp` therefore changes nothing about the load, which is the part
   of an autostarted run a bracket is most likely to mis-size.
2. **After the load, `-warp` bought almost no extra emulated time.** The KERNAL jiffy clock
   (`$00A0`–`$00A2`, incremented 60×/emulated-second by the `$EA31` handler) is a direct
   read of emulated time consumed:

```
$ node .planning/phases/33-.../evidence/autostart-probe.mjs jiffy v2-auto-j0.vsf v2-auto-j2500.vsf v2-warp-bracket.vsf v2-rep-j0-j0.vsf
PROBE_MODE jiffy
JIFFY v2-auto-j0.vsf raw=$000557 jiffies=1367 emulated_seconds=22.78
JIFFY v2-auto-j2500.vsf raw=$000568 jiffies=1384 emulated_seconds=23.07
JIFFY v2-warp-bracket.vsf raw=$00059d jiffies=1437 emulated_seconds=23.95
JIFFY v2-rep-j0-j0.vsf raw=$00018f jiffies=399 emulated_seconds=6.65
```

23.95 emulated seconds warped against 22.78 unwarped, for the same 20 s wall-clock
bracket — a 5% difference, not an order of magnitude. A bracket calibrated unwarped
therefore lands in the intended region, and the control's premise does not hold **across an
autostart** on this build.

### Warp's actual factor on this host, isolated

Asked with no autostart in the loop, so `AUTOSTART`'s warp management cannot confound it.
Free-run a 5 s wall-clock interval from the reset and read the jiffy clock:

```
$ node .planning/phases/33-.../evidence/autostart-probe.mjs warpcheck --run-ms 5000
PREFLIGHT_X64SC (none)
PROBE_MODE warpcheck label=warpcheck-plain warp=false
FREE_RUN_MS 5000
WALLCLOCK_ELAPSED_MS 5003
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/warpcheck-plain.vsf err=0x00 size=193261

$ node .planning/phases/33-.../evidence/autostart-probe.mjs warpcheck --warp --run-ms 5000
PREFLIGHT_X64SC (none)
PROBE_MODE warpcheck label=warpcheck-warp warp=true
FREE_RUN_MS 5000
WALLCLOCK_ELAPSED_MS 5003
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/warpcheck-warp.vsf err=0x00 size=193261

$ node .planning/phases/33-.../evidence/autostart-probe.mjs jiffy warpcheck-plain.vsf warpcheck-warp.vsf
PROBE_MODE jiffy
JIFFY warpcheck-plain.vsf raw=$00009f jiffies=159 emulated_seconds=2.65
JIFFY warpcheck-warp.vsf raw=$00013a jiffies=314 emulated_seconds=5.23
```

**`-warp` is worth about 1.97× on this host and this launch profile** (5.23 emulated
seconds against 2.65, same 5 s wall clock), not the 10×+ the control's premise assumes.
Unwarped, `x64sc` here runs at roughly **half** real time; warped, at roughly real time.
That is a fact about this host — recorded so a later plan does not read "warp" and assume an
order of magnitude — and it is why the red instance below has to assert a *region* rather
than wait for a timeout: a 2× overshoot is real and invalidating, but it will not starve a
once-per-frame anchor.


### Instance 2 — the same wall-clock bracket, asserted as a region: **red**

**Procedure.** A wall-clock bracket is, operationally, an assertion that after N seconds of
host time the machine is somewhere in a known region. So state that assertion explicitly and
let it fail. The region coordinate is the jiffy clock — **emulated** time, exactly the
quantity a wall-clock bracket cannot observe.

**Calibration (unwarped, the honest way round — calibrate first, then test):**

```
$ node .planning/phases/33-.../evidence/autostart-probe.mjs bracket --bracket-ms 10000 --expect-lo 0 --expect-hi 99999 --label cal-plain
PREFLIGHT_X64SC (none)
PROBE_MODE bracket label=cal-plain warp=false
BRACKET_BUDGET_MS 10000 (wall clock)
WALLCLOCK_ELAPSED_MS 10010
BRACKET_JIFFY_AT_END 424 (7.07 emulated seconds)
```

424 jiffies. The bracket's expected window is set to **360..490** — 424 ±15%, wide enough
that ordinary run-to-run variation passes it, which is what makes a failure meaningful.

**The paired positive — same bracket, same window, no `-warp`:**

```
$ node .planning/phases/33-.../evidence/autostart-probe.mjs bracket --bracket-ms 10000 --expect-lo 360 --expect-hi 490 --label v2-bracket-plain
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
PROBE_MODE bracket label=v2-bracket-plain warp=false
ARGV ["-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:43189"]
BRACKET_BUDGET_MS 10000 (wall clock)
BRACKET_EXPECTED_JIFFY_WINDOW 360..490 (calibrated on an UNWARPED run)
WALLCLOCK_ELAPSED_MS 10002
BRACKET_JIFFY_AT_END 389 (6.48 emulated seconds)
BRACKET_REGION inside the expected window
BRACKET_OVERSHOOT_FACTOR 0.92x of the window centre
```

**The control — same bracket, same window, `-warp` appended after
`+autostart-delay-random`:**

```
$ node .planning/phases/33-.../evidence/autostart-probe.mjs bracket --warp --bracket-ms 10000 --expect-lo 360 --expect-hi 490 --label v2-bracket-warp
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
PROBE_MODE bracket label=v2-bracket-warp warp=true
ARGV ["-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:33755"]
BRACKET_BUDGET_MS 10000 (wall clock)
BRACKET_EXPECTED_JIFFY_WINDOW 360..490 (calibrated on an UNWARPED run)
WALLCLOCK_ELAPSED_MS 10009
BRACKET_JIFFY_AT_END 748 (12.47 emulated seconds)
BRACKET_REGION OUTSIDE the expected window
BRACKET_OVERSHOOT_FACTOR 1.76x of the window centre
```

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479)

| | unwarped (`v2-bracket-plain`) | `-warp` (`v2-bracket-warp`) |
|---|---|---|
| wall-clock elapsed | 10002 ms | 10009 ms |
| expected jiffy window | 360..490 | 360..490 |
| jiffy at bracket end | **389** | **748** |
| emulated seconds | 6.48 | 12.47 |
| region | **inside** | **OUTSIDE** |
| overshoot vs window centre | 0.92× | **1.76×** |

The two runs differ in **exactly one argv element**, and the wall clock they were bracketed
against is the same to within 7 ms. The unwarped run lands inside the window; the warped run
overshoots it by 1.76×. The bracket is invalidated by warp and by nothing else.

WARP_BRACKET_CONTROL: red

**Named, as the rule requires:** red by **a stop outside the intended region**, not by a
spurious timeout. The timeout half was **not observed** — instance 1 above shows why, and it
is recorded as `not-red` rather than pursued until it went red. The ROADMAP's success
criterion 5 wording ("observed timing out spuriously") is therefore satisfied in the
region-overshoot form of the plan's own rule and **not** in the timeout form; that shortfall
is stated here rather than papered over, and `33-12` should carry it forward as written.


---

## Warp is behaviour-neutral under a frame-anchored protocol

Recorded so this file does not read as "warp is broken". The distinction is the entire point
of Control B: **`-warp` is invalidating for a wall-clock-anchored bracket and
behaviour-neutral for a frame-anchored one.**

Research measured this at the KERNAL `READY` prompt: `-warp` added to the same argv under
the frame-anchored protocol reproduced an identical 64K sha256 and identical registers
(`33-RESEARCH.md` M4). That is a citation, so it is also **re-measured here**, on the real
autostarted release, at a pre-load frame-anchored stop:

```
$ for j in 0 2500; do node .planning/phases/33-.../evidence/autostart-probe.mjs s3 --warp --jitter $j --target 50 --label v2-warp-t50-j$j; done
PREFLIGHT_X64SC (none)
ARGV ["-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:34531"]
RUN v2-warp-t50-j2500 jitter=2500 asErr=0 cpErr=0 hits=50 PC=$ea31 LIN=238 CYC=15 $00=47 $01=55
PREFLIGHT_X64SC (none)
ARGV ["-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:35995"]
RUN v2-warp-t50-j0 jitter=0 asErr=0 cpErr=0 hits=50 PC=$ea31 LIN=238 CYC=15 $00=47 $01=55

$ node .planning/phases/33-.../evidence/autostart-probe.mjs diff v2-warp-t50-j0-j0.vsf v2-warp-t50-j2500-j2500.vsf
A /home/henrik/.cache/c64-re-tools/phase33/v2-warp-t50-j0-j0.vsf modules=26 endedAt=193261 c64mem_body=65555 minor=1 sha=c97a08b636cba7e824d854b9a3fe15c4d18fed7b527203ac6ca3699cfc9be9d3
B /home/henrik/.cache/c64-re-tools/phase33/v2-warp-t50-j2500-j2500.vsf modules=26 endedAt=193261 c64mem_body=65555 minor=1 sha=c97a08b636cba7e824d854b9a3fe15c4d18fed7b527203ac6ca3699cfc9be9d3
PAIR diffs=0
PAIR first=(none)

$ node .planning/phases/33-.../evidence/autostart-probe.mjs diff bisect-t50-j0-j0.vsf v2-warp-t50-j0-j0.vsf   # UNWARPED against WARPED, same target
A /home/henrik/.cache/c64-re-tools/phase33/bisect-t50-j0-j0.vsf modules=26 endedAt=193261 c64mem_body=65555 minor=1 sha=c97a08b636cba7e824d854b9a3fe15c4d18fed7b527203ac6ca3699cfc9be9d3
B /home/henrik/.cache/c64-re-tools/phase33/v2-warp-t50-j0-j0.vsf modules=26 endedAt=193261 c64mem_body=65555 minor=1 sha=c97a08b636cba7e824d854b9a3fe15c4d18fed7b527203ac6ca3699cfc9be9d3
PAIR diffs=0
PAIR first=(none)
```

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479)

**Identical to the byte.** `PC=$ea31 LIN=238 CYC=15` and one 64K sha256
`c97a08b636cba7e824d854b9a3fe15c4d18fed7b527203ac6ca3699cfc9be9d3` across **all four** of:
warped at jitter 0, warped at jitter 2500, and — the third comparison above — the *unwarped*
run at the same target from `33-autostart-sequencing.md`'s clean pass, taken an hour earlier
in a different process. Zero differing addresses in every pairing.

So, measured on this host, on a real cracked release, with true drive emulation in the loop:

| Anchoring | `-warp` effect | Measured here |
|---|---|---|
| frame-anchored | **behaviour-neutral** | identical registers, identical 64K sha256, 0 differing addresses |
| wall-clock-anchored | **invalidating** | 1.76× region overshoot on an identical 10 s bracket |

That is the fact `33-06` needs before `profile.warp` ships, and the fact `33-11` needs
before it times `probeReady` under warp: warp does not change *what* the machine computes,
only *when* the host sees it — so any budget or bracket measured in host time is the thing
warp breaks, and a frame-anchored protocol is not.

---

## Summary of outcome lines

Both are declared in `SCHEMA.md` § 3 with this file as their single source, and both are the
expected and required observation:

WALLCLOCK_CONTROL: red
WARP_BRACKET_CONTROL: red

## ACCEPTED LIMIT

The frozen files (`DECISION-RULE.md`, `SCHEMA.md`, `README.md`) are unchanged by this plan.
Two limits found while producing these controls, recorded here in this plan's own file as
`SCHEMA.md`'s preamble directs:

1. **`WARP_BRACKET_CONTROL: red` was reached by region overshoot, not by a spurious
   timeout.** The plan's rule admits either; the ROADMAP's success criterion 5 names only
   the timeout. The timeout form was **not** observed and instance 1 records the measured
   reason (`AUTOSTART` owns warp during the load, and `-warp` is worth ~1.97× on this host,
   not enough to starve a once-per-frame anchor). The domain is not widened and the value is
   not softened — `red` is `red` under the declared rule — but a reader expecting the
   timeout wording will not find it, and that is stated rather than glossed.

2. **Control A's paired positive is "materially better", not "green".** The standard for a
   control's attribution is not written down in the frozen files, so this file states the
   one it applied: the contrasting frame-anchored leg reaches a genuine four-term identity
   with one sha256 at a **pre-load** stop (0 differing addresses), while the post-load leg
   is `not-achieved` with 48. The attribution rests on the pre-load leg. A reader who takes
   `AUTOSTART_FRAME_EXACT: not-achieved` alone as the paired positive would correctly object
   that a red-against-red pairing proves nothing — hence this note.
