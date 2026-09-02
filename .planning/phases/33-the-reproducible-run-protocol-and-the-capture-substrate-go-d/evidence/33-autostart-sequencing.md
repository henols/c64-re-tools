# 33-autostart-sequencing — the anchor-counted stop sequence for an AUTOSTARTed release

**Owner:** plan `33-03`. **Measured:** 2026-09-02, on this host, against genuine stock
VICE 3.9 at `/usr/bin/x64sc`. **Bound by** `evidence/README.md` § *Evidence conventions*
(the `$ <command>` line, `PROBE_DIR`, `BROKER_STATE`, `TEST_AUTOMATED_BASELINE`, voided
runs recorded) and `evidence/SCHEMA.md` § 3 (the outcome-line names and domains).

This file answers `33-RESEARCH.md` § *Open Questions* Q2: **what is the correct
anchor-counted sequence for an autostarted release?** `AUTOSTART` (0xdd) is itself a power
cycle (`mon_autostart` → `reboot_for_autostart` → `machine_trigger_reset(POWER_CYCLE)`,
`autostart.c:1437`), so a separate `RESET 1` afterwards *undoes* the autostart. Research
tried `arm-while-halted → RESET 1 → AUTOSTART → count hits` once and got no usable stop
(`PC=$FD75`/`$FD70`, `LIN=0`, `hits=0` — inside the KERNAL reset routine). Every sequence
attempted below is recorded with what it produced, including the ones that produced nothing.

The probe is `evidence/autostart-probe.mjs` — self-contained, `node:` builtins only,
spawning `/usr/bin/x64sc` directly rather than through the broker (`D-10`, `D-11`).

`PROBE_DIR` (absolute, outside the checkout, never `/tmp`):
`/home/henrik/.cache/c64-re-tools/phase33`

Release under test: `danish.d64`, sha256
`1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` — gitignored and never
committed (`D-27`); identity travels as name plus digest and nothing else.

Frame anchor: `$EA31`, the KERNAL IRQ entry. It is used here because it **measurably still
executes after `danish`'s load** (400 hits reached, `33-RESEARCH.md` M6). It is explicitly
**not** promoted to a default: `D-14`'s refusal-when-`frame_anchor`-is-absent stands
precisely because a cracked release almost always takes over the IRQ, and this release
happening to leave it alone is a fact about this release.

---

## Preconditions, observed


```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc || echo "(no output)"
(no output)

$ /usr/bin/x64sc --version
x64sc (VICE 3.9)


$ sha256sum .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5  .planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
```

BROKER_STATE: inactive

Note on the `pgrep` form: `pgrep -af x64sc` matches this shell's own command line
(the pattern appears in the argv of the `bash -c` that runs the check), so the
exact-match form `pgrep -x x64sc` is used instead. It returns nothing here, which is
the state `D-11` requires — not a weaker check, a correct one.

### The observed `test:automated` baseline

Observed before any live run in this file, with the broker stopped:

```
$ cd src/mcp/vice && npm run test:automated 2>&1 | grep -E "^. fail [0-9]+|^. failing tests" -A3
ℹ fail 2
✖ failing tests:
✖ DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md (22.17531ms)
✖ planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates (1.837281ms)
```

Both failures are in `src/mcp/vice/anno-register.test.ts` (assertions at `:385` and
`:479`), one root cause: the anno register cites requirement ids `STORE-01`,
`STORE-04`, `STORE-06` and `MCP-04`, which the v0.8.0 milestone open dropped from
`.planning/REQUIREMENTS.md`. Out of this phase's scope by `33-02`'s own resolution.

TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479) — the expected post-33-02 baseline; not clean, and never adopted as an acceptance criterion

---

## S1 — does a checkpoint armed before `AUTOSTART` survive its power cycle?

Settled by **one observed reply**, exactly as `33-RESEARCH.md` Q2 recommended. The
sequence as literally written in the plan (`connect → AUTOSTART → CHECKPOINT_LIST`) cannot
answer its own question, because with nothing armed the list is empty either way; so the
anchor is armed **first**, which is what makes the reply after `AUTOSTART` load-bearing.
That is a deviation from the plan's wording, recorded here rather than silently applied.

```
$ node .planning/phases/33-.../evidence/autostart-probe.mjs s1
PROBE_MODE s1
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33
RELEASE /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
NODE v24.20.0
DATE_UTC 2026-09-02T18:14:49.626Z
ARGV ["-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:40039"]
ARGV_INDEX_0 -default
ARGV_INDEX_1 -console
JITTER_MS 0
CONNECTED_AFTER_MS 113
OPEN_EVENTS (none)
REGISTER_CATALOG 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE Drive8TrueEmulation=1 Drive8Type=1541 AutostartDelayRandom=0
CHECKPOINT_LIST_BEFORE_ARM total=0 items=0
ARMED_BEFORE_AUTOSTART cp=1 start=$ea31 stop=true enabled=true temporary=false hits=0 err=0x00
CHECKPOINT_LIST_AFTER_ARM total=1 items=1
  CP id=1 start=$ea31 end=$ea31 stop=true enabled=true op=0x4 temporary=false hits=0
AUTOSTART err=0x00 responseType=0xdd
CHECKPOINT_LIST_AFTER_AUTOSTART total=1 items=1
  CP id=1 start=$ea31 end=$ea31 stop=true enabled=true op=0x4 temporary=false hits=0
S1_SURVIVAL checkpoint-survives-autostart-power-cycle
EVENTS_SO_FAR registers,stopped,resumed,registers,stopped
CHILD_EXIT {"code":null,"signal":"SIGKILL"}
```

**`CHECKPOINT_LIST` (0x14) taken immediately after `AUTOSTART` (0xdd), verbatim:**

```
CHECKPOINT_LIST_AFTER_AUTOSTART total=1 items=1
  CP id=1 start=$ea31 end=$ea31 stop=true enabled=true op=0x4 temporary=false hits=0
```

**S1 answer: the checkpoint SURVIVES `AUTOSTART`'s power cycle**, unchanged and with its
hit count still at zero — `total=1`, same id, same address, same flags. So research's
failed attempt was **not** caused by the arming order: it was caused by the separate
`RESET 1` it inserted, which undid the autostart (`P11`). `S3` is therefore *not* refuted
by `S1` and is run below on its own merits, with the `RESET 1` removed.

Two further facts fell out of the same run, both bearing on later plans:

- `AutostartDelayRandom=0` read back over `RESOURCE_GET` (0x51), so
  `+autostart-delay-random` took effect. `Drive8TrueEmulation=1` and `Drive8Type=1541`,
  so **true drive emulation is genuinely in the loop** — the condition `C0_CAPTURE_PAIR`
  requires.
- `AUTOSTART: Turning Warp mode on.` appears in the child's own stdout. **`AUTOSTART`
  enables warp for the duration of the load, by itself, with no `-warp` on the argv.**
  That is not a flag this phase controls, and it matters to `33-06`/`33-11`: a wall-clock
  readiness or bracket budget measured across an autostart is measured across a warped
  interval whether or not the caller asked for warp.

---

## Every sequence attempted, and what each produced

`RESET 1` (0xcc) appears **nowhere** in S2, S3 or S4. `AUTOSTART`'s own power cycle is the
load-bearing reset for an autostarted release (`P11`), and issuing a second one is the
mistake research already paid for.

| Id | Ordering | Produced a usable stop? | What it produced |
|---|---|---|---|
| `S1` | connect → arm anchor → `AUTOSTART` → `CHECKPOINT_LIST` | n/a — a survival probe, not a stop sequence | `total=1`: the pre-armed checkpoint survives the power cycle intact |
| `S2` | connect → `AUTOSTART` → resume → free-run 20 s **wall clock** → halt → arm anchor → count 400 | **yes**, but not frame-exact | `LIN=265/144` across two jitters; snapshot pair diverges at **498** addresses |
| `S3` | connect → arm anchor → `AUTOSTART` → count hits → `REGISTERS_GET` | **yes** — the sequence that works | frame-exact and byte-identical to hit 50; diverging from hit 75 |
| `S4` | connect → `AUTOSTART` → arm anchor → count to a **wall-clock-bounded** baseline → count a fixed `+200` offset | **yes**, but not frame-exact | the *baseline itself* differed (965 vs 928 hits), so `hit_count` diverges before `LIN` even matters; pair diverges at **314** addresses |

No attempt produced *no* usable stop, so no voided run is recorded on that ground. Two runs
**were** voided, both under the `-initbreak reset` variant, and both are recorded in
§ *The `-initbreak reset` dead end* below with their reasons.

### S3, swept — where frame-exactness holds and where it stops

Every run below is `S3` on `danish.d64` at the `$EA31` anchor, in the order taken. `LIN`
and `CYC` are read from one `REGISTERS_GET` reply with ids resolved by name; `diffs` is the
`C64MEM` RAM-slice comparison of the two runs' `.vsf` snapshots at that hit target,
produced by this probe's own strict module walk (`diff` mode).

```
$ for j in 0 2500; do for t in 1 10 50 75 100 200 400; do node .../autostart-probe.mjs s3 --jitter $j --target $t; done; done   # runs interleaved as taken
RUN probe-t1-j0        jitter=0     hits=1   PC=$ea31 LIN=257 CYC=57 $00=47 $01=55
RUN probe-t10-j0       jitter=0     hits=10  PC=$ea31 LIN=108 CYC=14 $00=47 $01=55
RUN probe-t1-j2500     jitter=2500  hits=1   PC=$ea31 LIN=257 CYC=57 $00=47 $01=55
RUN probe-t10-j2500    jitter=2500  hits=10  PC=$ea31 LIN=108 CYC=14 $00=47 $01=55
RUN bisect-t50-j0      jitter=0     hits=50  PC=$ea31 LIN=238 CYC=15 $00=47 $01=55
RUN bisect-t50-j2500   jitter=2500  hits=50  PC=$ea31 LIN=238 CYC=15 $00=47 $01=55
RUN bisect-t100-j0     jitter=0     hits=100 PC=$ea31 LIN=263 CYC=29 $00=47 $01=55
RUN bisect-t100-j2500  jitter=2500  hits=100 PC=$ea31 LIN=2   CYC=10 $00=47 $01=55
RUN bisect-t200-j0     jitter=0     hits=200 PC=$ea31 LIN=44  CYC=20 $00=47 $01=55
RUN bisect-t200-j2500  jitter=2500  hits=200 PC=$ea31 LIN=152 CYC=2  $00=47 $01=55
RUN bisect-t75-j0      jitter=0     hits=75  PC=$ea31 LIN=274 CYC=56 $00=47 $01=55
RUN bisect-t75-j2500   jitter=2500  hits=75  PC=$ea31 LIN=276 CYC=35 $00=47 $01=55

$ node .../autostart-probe.mjs diff <j0>.vsf <j2500>.vsf   # per hit target
t1    PAIR diffs=0    first=(none)
t10   PAIR diffs=0    first=(none)
t50   PAIR diffs=0    first=(none)
t75   PAIR diffs=8    first=$00ae $01f1 $01f2 $01f3 $01f4 $01f5 $01f6 $087f
t100  PAIR diffs=12   first=$00a4 $00ae $01f1 $01f2 $01f3 $095d $095e $095f $0960 $0961 $0962 $0963
t200  PAIR diffs=33   first=$00a4 $00ae $00af $01f1 $01f2 $01f3 $0cfd $0cfe $0cff $0d00 $0d01 $0d02 $0d03 $0d04 $0d05 $0d06 $0d07 $0d08 $0d09 $0d0a
```

The boundary is sharp and it is where the disk load starts: **frame-exact and byte-identical
through hit 50** (three targets, both jitters, identical `(PC, hit_count, LIN, CYC)` *and*
one identical 64K sha256), **diverging from hit 75** (`LIN` 274 against 276 — two raster
lines — with 8 differing bytes) and grossly by hit 100.

Note what the identical stops at hits 1, 10 and 50 prove: **`AUTOSTART`'s power cycle is
deterministically aligned.** The CPU, VIC-II and CIA phase after the power cycle is
independent of the pre-protocol jitter, and `LIN=257 CYC=57` at hit 1 reproduces
`33-RESEARCH.md` M4's frame-anchored `READY`-prompt value exactly. The frame anchor works.
What is *not* pinned is the absolute emulated clock, and that is the whole finding.

### The cause, and why no argv flag closes it

`AUTOSTART`'s power cycle resets the CPU, the VIC-II and the CIAs — hence the identical
stops through hit 50 — but it does **not** reset the absolute emulated clock, and the
1541's rotational phase is a function of that clock. The pre-protocol interval therefore
leaks into the *disk load's* byte timing, and every stop counted past the start of the load
inherits it. Two observations pin the mechanism down:

1. **Repeats at the same jitter are exactly reproducible.** Two consecutive `S3` runs at
   jitter 0, target 200, produced identical stops and one identical 64K sha256 — so the
   protocol itself is deterministic and the emulator is not flaky.

```
$ node .../autostart-probe.mjs s3 --jitter 0 --target 200 --label samejitter-a
RUN samejitter-a jitter=0 asErr=0 cpErr=0 hits=200 PC=$ea31 LIN=44 CYC=20 $00=47 $01=55
$ node .../autostart-probe.mjs s3 --jitter 0 --target 200 --label samejitter-b
RUN samejitter-b jitter=0 asErr=0 cpErr=0 hits=200 PC=$ea31 LIN=44 CYC=20 $00=47 $01=55
$ node .../autostart-probe.mjs diff samejitter-a-j0.vsf samejitter-b-j0.vsf
PAIR diffs=0
PAIR first=(none)
```

2. **The divergent addresses are a load in progress, not program state.** Every pair's
   divergence set is the same structural shape research recorded in M6: `$00A2` (the jiffy
   clock), `$00AE`/`$00AF` (the KERNAL load end pointers), a few bytes of dead stack at
   `$01F1`+, and then one contiguous run — the load's current buffer position. The
   contiguous run *moves* with the hit target (`$087F` at 75, `$095D` at 100, `$0CFD` at
   200, `$13F6` at 400), which is exactly what a load progressing at slightly different
   rates looks like.

### The `-initbreak reset` dead end (two voided runs, recorded)

The obvious remedy for an unpinned absolute clock is to stop the machine *at* reset, before
it has run any cycles, so the clock at the moment the protocol takes control is the same
however late the client connects. Stock 3.9 has the flag:

```
$ /usr/bin/x64sc -help | grep -A2 -- '-initbreak'
-initbreak <value>
	Set an initial breakpoint for the monitor: <address>, ready, or reset
```

Measured: it works when the client connects immediately and **fails outright when it does
not**. With `-initbreak reset` on the argv, a client connecting at ~2.5 s gets its TCP
connection **accepted** and then never gets an answer to anything — the monitor is broken
into with no client present and does not service the binary client that arrives later.

```
$ node .../autostart-probe.mjs s3 --initbreak --jitter 2500 --target 200
CONNECTED_AFTER_MS 4
OPEN_EVENTS (none)
Error: command 0x83 (request 1) timed out after 20000 ms

$ node .../autostart-probe.mjs s3 --initbreak --jitter 2500 --target 200   # after adding a PING readiness retry
CONNECTED_AFTER_MS 10
OPEN_EVENTS (none)
Error: monitor accepted the socket but never answered PING after 8 attempts: command 0x81 (request 8) timed out after 3000 ms
```

**VOIDED RUN 1** — `s3 --initbreak --jitter 2500 --target 200`, first attempt. Reason: the
monitor accepted the socket and never answered `REGISTERS_AVAILABLE` (0x83) within the 20 s
command budget. No stop produced.

**VOIDED RUN 2** — the same invocation after a `PING` (0x81) readiness retry was added.
Reason: eight `PING`s at 3 s each went unanswered. No stop produced. The two runs share one
cause, and the second exists to rule out "we asked too early".

The same variant at jitter 0 *does* work and is reproducible (`LIN=132 CYC=32` at target
200, twice), which is what makes the late-connect failure a real limitation rather than a
mis-built argv. But a flag that only works when the client wins a race cannot pin anything:
winning the race is itself wall-clock-dependent. **`-initbreak reset` is therefore not
carried into the sequence below, and `33-09` must not adopt it.**

A side effect worth keeping: the `PING` readiness retry added above is genuinely load
bearing and is kept. An accepted TCP connection is **not** a serving monitor — the listen
backlog accepts before the monitor services — so `PING` is the readiness signal. It also
changed observed results at target 400, which is itself evidence that the halt moment is
host-timing dependent.

---

## The reported pair, and the jitter sweep that decided the outcome

Every run of the settled sequence (`S3`, target 400, `PING` readiness in place) is below
**in the order taken**. Convention 5 forbids reporting the two most similar of N, and this
run set is exactly why the rule exists: the first pair taken agreed, and continuing to
sweep showed the agreement was not a property of the sequence.

```
$ for j in 0 2500; do node .../autostart-probe.mjs s3 --jitter $j --target 400 --label final-j$j; done
MONITOR_READY_AFTER_PINGS 1
COUNTED reached=true hits=400 target=400 reason=-
RUN final-j2500 jitter=2500 asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=154 CYC=11 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/final-j2500-j2500.vsf err=0x00 size=193261
MONITOR_READY_AFTER_PINGS 1
COUNTED reached=true hits=400 target=400 reason=-
RUN final-j0 jitter=0 asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=154 CYC=11 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/final-j0-j0.vsf err=0x00 size=193261

$ node .../autostart-probe.mjs diff final-j0-j0.vsf final-j2500-j2500.vsf
PAIR diffs=0
PAIR first=(none)

$ for j in 1200 4000 0 2500; do node .../autostart-probe.mjs s3 --jitter $j --target 400 --label sweep-j$j; done
RUN sweep-j4000 jitter=4000 asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=205 CYC=15 $00=47 $01=55
RUN sweep-j2500 jitter=2500 asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=311 CYC=46 $00=47 $01=55
RUN sweep-j0 jitter=0 asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=154 CYC=11 $00=47 $01=55
RUN sweep-j1200 jitter=1200 asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=154 CYC=11 $00=47 $01=55

$ node .../autostart-probe.mjs diff sweep-j0-j0.vsf sweep-j2500-j2500.vsf
PAIR diffs=28
PAIR first=$00a4 $00ae $00af $01f1 $01f2 $01f3 $13f6 $13f7 $13f8 $13f9 $13fa $13fb $13fc $13fd $13fe $13ff $1400 $1401 $1402 $1403

$ node .../autostart-probe.mjs diff sweep-j0-j0.vsf sweep-j4000-j4000.vsf
PAIR diffs=14
PAIR first=$00a4 $00ae $01f1 $01f2 $13ec $13ed $13ee $13ef $13f0 $13f1 $13f2 $13f3 $13f4 $13f5
```

Read the sweep as a whole. Jitter 0 is stable across **three** runs (`s3-j0` before the
readiness retry, `final-j0`, `sweep-j0` — all `LIN=154 CYC=11`). Jitter 2500 took **three
different values across three runs**: `LIN=104 CYC=36`, then `LIN=154 CYC=11`, then
`LIN=311 CYC=46`. A frame-exact sequence cannot do that. The agreement in the `final-*`
pair was a coincidence of two runs landing on the same absolute clock, and reporting that
pair alone as `achieved` is precisely the evidence selection convention 5 forbids.

### Provenance of each of the two reported runs

Recorded per run, not once for the file, so a reader cannot attribute one run's conditions
to the other.

**Run 1 — `final-j0` / `sweep-j0`, pre-protocol jitter 0 ms:**

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479)

**Run 2 — `sweep-j2500`, pre-protocol jitter 2500 ms:**

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479)

Both runs were taken in one session, with `systemctl --user is-active vice-broker` reading
`inactive` and `pgrep -x x64sc` silent throughout, and against the single `test:automated`
observation transcribed at the top of this file. No run in this file was taken against a
live broker, so no run is discarded on that ground.

### The outcome, derived

`SCHEMA.md` § 3 fixes the rule: `achieved` **iff all four** of `PC`, `hit_count`, `LIN`,
`CYC` are identical across the two runs at different pre-protocol jitter. Walking it:

| Term | jitter 0 | jitter 2500 | Identical? |
|---|---|---|---|
| `PC` | `$ea31` | `$ea31` | yes |
| `hit_count` | 400 | 400 | yes |
| `LIN` | 154 | 311 | **no** |
| `CYC` | 11 | 46 | **no** |

Two of the four terms differ, so the value is `not-achieved` and the differing terms are
named on the line below the outcome, as the acceptance criteria require.

AUTOSTART_FRAME_EXACT: not-achieved
Differing terms: `LIN` (154 against 311) and `CYC` (11 against 46). `PC` (`$ea31`) and
`hit_count` (400) are identical. Cause: `AUTOSTART`'s power cycle does not reset the
absolute emulated clock, so the 1541's rotational phase — and therefore the disk load's
byte timing — varies with the pre-protocol interval. Frame-exactness holds through hit 50
and is lost from hit 75, which is where the load begins.

AUTOSTART_SEQUENCE: S3

### CAP-04's two recorded edge cases

**Boundary.** Applied above, term by term: two of four differ, so `not-achieved`, and the
differing terms are named. Had `LIN` and `CYC` agreed while `hit_count` differed — the `S4`
shape, where the baseline itself moved (965 against 928) — the value would still be
`not-achieved`, naming `hit_count`. A three-of-four match is not a pass.

**Adjacency.** Two stops exactly one anchor hit apart are, by the same rule, **not**
frame-exact even if `(LIN, CYC)` matched, because `hit_count` separates them. Measured at
this anchor, adjacent hits do *not* even agree on `(LIN, CYC)`:

```
$ node .../autostart-probe.mjs s3 --jitter 0 --target 50 --label adjacency-t50-j0
RUN adjacency-t50-j0 jitter=0 asErr=0 cpErr=0 hits=50 PC=$ea31 LIN=238 CYC=15 $00=47 $01=55
$ node .../autostart-probe.mjs s3 --jitter 0 --target 51 --label adjacency-t51-j0
RUN adjacency-t51-j0 jitter=0 asErr=0 cpErr=0 hits=51 PC=$ea31 LIN=186 CYC=58 $00=47 $01=55
```

`LIN` moves by −52 lines per hit, because the KERNAL IRQ at `$EA31` is CIA1-timer driven
and its period is not an exact multiple of the PAL frame. So a `(LIN, CYC)`-agreeing pair
one frame apart is **not producible at this anchor on this release**, and producing one is
`33-11`'s job under `ORACLE_NECESSITY` — which `SCHEMA.md` § 2.3 requires be *observed*,
not argued. Recorded here as the rule applied and the reason the observation belongs to
another plan, not as a claim that the adjacency case was demonstrated.

---

## The sequence, as 33-09 must implement it

The ordered command list `runReproducible()` implements for an **autostarted** release.
Every checkpoint flag is stated; no `RESET` appears anywhere.

| # | Command | Opcode | Flags / body | Why exactly this |
|---|---|---|---|---|
| 1 | launch | — | argv below | `-default` index 0, `-console` index 1 (`P1`/`P5`); `+autostart-delay-random` pins the delay draw *and* the `RUN` feed path (`P4`) |
| 2 | connect | — | one client only | Stock's binary monitor services exactly one client; a second connect sits unserviced and looks like a wedge |
| 3 | `PING` | `0x81` | empty body, retried | **An accepted TCP connection is not a serving monitor.** Retry until answered; this is the readiness signal, measured necessary above |
| 4 | `REGISTERS_AVAILABLE` | `0x83` | `memspace 0x00` | Resolve `PC`/`LIN`/`CYC` ids **by name**. Never hardcode 3/53/54 |
| 5 | `CHECKPOINT_SET` (frame anchor) | `0x12` | `start = end = frame_anchor`, `stop: true`, `enabled: true`, `operation: Exec (0x04)`, `temporary: false`, `memspace: 0x00` via the memspace-byte mapping | `stop: true` because a non-stopping checkpoint emits `CHECKPOINT_INFO` synchronously from inside the CPU loop on every hit (`T-33-10`); `temporary: false` because the anchor must survive its own hits; `memspace 0x00` via the mapping, never `body[8] =` (`T-33-17`) |
| 6 | `AUTOSTART` | `0xdd` | `runAfter: true`, `fileIndex: 0`, `filename` = the release | **This is the reset.** It power-cycles the machine by itself (`autostart.c:1437`). Do **not** issue `RESET` before or after it |
| 7 | *(optional, cheap)* `CHECKPOINT_LIST` | `0x14` | empty body | Asserts the anchor survived the power cycle. Measured: it does (`total=1`, hits 0). Worth keeping as an assertion, not as an inference |
| 8 | `EXIT` | `0xaa` | empty body | Exactly one resume per wait |
| 9 | wait for `CHECKPOINT_INFO` | `0x11` event | request id `0xffffffff`; `hit_count` at body offset **13** as u32LE | Poll on `hit_count`, never on paused state. Match on the anchor's own checkpoint id — five message types share `0xffffffff` and two share a response type with a command reply |
| 10 | repeat 8–9 | — | one `EXIT` per observed hit, to the target count | A `stop: true` anchor halts on every hit, so N hits need N resumes. This is `vice-sync.ts`'s invariant in stock-native form |
| 11 | `REGISTERS_GET` | `0x31` | `memspace 0x00` | Read all four stop-identity terms from **one** reply |

Argv, verbatim as measured (only the port is interpolated):

```
-default -console -drive8type 1541 -seed 4242 -raminitstartrandom 0
-raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random
-binarymonitor -binarymonitoraddress ip4://127.0.0.1:<port>
```

**`-initbreak reset` is NOT in that list**, and `33-09` must not add it — see the dead end
above.

### What 33-09 must NOT conclude from this file

The sequence above is the right sequence and it is **not sufficient for frame-exactness
past the start of a disk load**. Three things follow, and none of them is "pick a bigger
target and hope":

1. A `frame_anchor` count taken **before** the load starts (measured: through hit 50 on
   this release) is frame-exact *and* byte-identical across jitters. A protocol that stops
   there is reproducible today.
2. A count taken **past** the load is not, on stock, with the flags this phase has. The
   residual is small — 14 to 33 addresses, all of it load-progress state — but it is not
   zero, and `AUTOSTART_FRAME_EXACT` is a four-term identity, not a byte budget.
3. `runReproducible()` must therefore **report** the stop identity it achieved rather than
   assert frame-exactness. `D-14`'s refusal when `frame_anchor` is absent is unaffected and
   stands.

### The corollary that de-risks `C0_CAPTURE_PAIR`

The frame-anchored sequence reduces the pair divergence by an order of magnitude against
the wall-clock-anchored one, on the same release at the same anchor:

| Anchoring | Sequence | Differing addresses |
|---|---|---|
| frame-anchored, pre-load stop | `S3`, hits 1 / 10 / 50 | **0** |
| frame-anchored, post-load stop | `S3`, hits 75 / 100 / 200 / 400 | 8 / 12 / 33 / 14–28 |
| wall-clock, offset baseline | `S4` | 314 |
| wall-clock, 20 s wait | `S2` | 498 |
| wall-clock, 20 s wait (research M6) | — | 300 |

Every frame-anchored number is **at or under `D-22`'s committed cap of 64**; every
wall-clock number is multiples over it. That is a measured fact about the cap, not an
argument for changing it: the cap stays at 64, and this is evidence it discriminates.

## ACCEPTED LIMIT

**The frozen files were not edited.** `DECISION-RULE.md`, `SCHEMA.md` and `README.md` are
unchanged by this plan; the two ambiguities found are recorded here, in this plan's own
file, exactly as `SCHEMA.md`'s preamble directs.

1. **`AUTOSTART_FRAME_EXACT` has no value for "achieved before the load, not after".**
   The declared domain is `achieved | not-achieved` and the derivation is a strict
   four-term identity, so the pre-load result (0 differing bytes, all four terms identical,
   three targets, both jitters) collapses into the same `not-achieved` as a total failure
   would. The line is recorded `not-achieved` as declared — the domain is not widened and no
   new name is minted — and the boundary is recorded in prose above so `33-09` and `33-12`
   read the real shape rather than the flattened one.

2. **`33-RESEARCH.md` M5's prose says 27 modules; the strict walk visits 26.** M5's own
   table lists 26 rows, so the prose count is off by one, not the table. Every walk in this
   plan ends at `off === 193261 === file length`, which is the integrity assertion M5 asks
   for and the one that actually matters. Recorded because a later plan comparing module
   counts against the prose would chase a phantom.
