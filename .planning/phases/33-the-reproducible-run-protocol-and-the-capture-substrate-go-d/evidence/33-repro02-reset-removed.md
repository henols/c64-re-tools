# 33-11 · `REPRO-02` — the jitter triple, and the reset-removed control observed red

Owner: plan `33-11`, Task 2. Probe: `evidence/reset-removed-probe.mjs`.
Declared source file for `JITTER_IMMUNITY` and for `RESET_REMOVED_CONTROL`
(`SCHEMA.md` §§ 2, 3; `DECISION-RULE.md` § *Inputs*).

Two arms, three runs each at pre-protocol jitter **0 / 1500 / 4000 ms**, differing in
**exactly one step** — whether the monitor-issued hard reset is sent. The positive arm is what
makes the control's red attributable: a red with no green beside it is not a proof. A third,
clearly-labelled **method control** is recorded beside them, because it is what this probe's own
first version accidentally measured and because its result is the mechanism behind `33-10`'s
`CAPTURE_FRAME_EXACT: no`.

## Conditions

BROKER_STATE: inactive

TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file — `anno-register.test.ts` (`tests 3113 / suites 24 / pass 3105 / fail 2`), observed 2026-09-02 with the broker stopped. The two are `anno-register.test.ts:385` (DIRECTION 5 basis integrity) and `anno-register.test.ts:479` (its planted-violation negative control), one shared root cause Phase 33 did not create — the ids `STORE-01` / `STORE-04` / `STORE-06` / `MCP-04` are no longer declared in `.planning/REQUIREMENTS.md`. This is the expected post-`33-02` baseline named in `README.md` § *Evidence conventions* 4. Not "clean", not "0 failures", and never a gate.

```
$ systemctl --user is-active vice-broker
inactive
$ pgrep -x x64sc; echo "exit=$?"
exit=1
$ /usr/bin/x64sc --version
x64sc (VICE 3.9)

$ git rev-parse --abbrev-ref HEAD
main
```

```
$ sh /home/henrik/.cache/c64-re-tools/phase33/33-11/baseline.sh
pgrep-x64sc-exit=1
inactive
✖ DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md (7.086786ms)
✖ planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates (5.727027ms)
ℹ tests 3113
ℹ suites 24
ℹ pass 3105
ℹ fail 2
✖ failing tests:
✖ DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md (7.086786ms)
✖ planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates (5.727027ms)

$ sh /home/henrik/.cache/c64-re-tools/phase33/33-11/baseline-files.sh
test at anno-register.test.ts:385:1
test at anno-register.test.ts:479:1
```

## Why the control is an evidence script and not a tool argument (`D-13`)

The control needs the protocol **minus the reset**. It is deliberately NOT produced by adding an
argument to `vice_run_until`: a protocol-without-the-reset option would ship exactly the second
route `REPRO-02` exists to prevent a caller forgetting, and it would be reachable by every caller
forever in order to serve one measurement that runs once. `33-09` pins the accepted argument key
set by a single equality, so a sub-flag added to serve this control would red that test — the
prohibition has teeth beyond this paragraph. `git status --porcelain -- src/mcp/vice/` is empty
for this plan; nothing under the shipped tree was touched.

So the probe drives `stock-reproducible-run.ts`'s ordered pieces directly over the wire, and both
arms are produced by ONE function whose only branch is `sendReset` — "exactly one step removed"
is a property of the code, not a promise.

## The protocol under measurement

`REPRO-02`'s own wording and research's own measured sequence (`33-RESEARCH.md` M4): launch with
the determinism block → free-run for `3000 + J` ms → connect (which halts) → `CHECKPOINT_SET`
exec at `$ea31`, `stop=true`, non-temporary, **while halted** → **`RESET` hard (`0xcc`, body
`[0x01]`)** → **one** `EXIT` → wait for that checkpoint's `CHECKPOINT_INFO` → `REGISTERS_GET` →
`CHECKPOINT_GET` for the frame term → `DUMP` → the shipped `vsf-slice` CLI.

One checkpoint, not two. `runReproducible()` arms a second temporary target because its target
address is a caller's parameter; here the target IS the anchor, which is that function's own
documented measured-green case.

## Two facts measured on the way, both of which changed how this probe is written

**Fact 1 — "connect (which halts)" is real, and `hits_at_arm` proves it per run.** Stock's binary
monitor stops the machine to service its first command and keeps it stopped. Measured directly:
the KERNAL jiffy clock at `$a0-$a2` is unchanged across two reads 1200 ms apart, and
`hits_at_arm=0` appears on all fifteen runs below — a checkpoint armed at an address the machine
executes 60 times a second cannot have a zero hit count unless the machine is not running.

**Fact 2 — the hard reset does NOT reset the VIC-II raster counter.** The raster phase at the
moment of the reset carries through to the stop. This is what the `PREHALT` method control
measures, and it is the single most useful thing this probe found. Its consequences are recorded
in § *The method control* below.

Two negative results are recorded here rather than dropped, because both cost real runs:

- **A polling wait starves the emulator.** Every monitor command stops and resumes the machine,
  so a wait implemented as four commands per 700 ms leaves the machine almost no run time:
  `PC` sat at `$fd80`, inside RAMTAS's RAM-sizing loop, unchanged across **thirty reads spanning
  21 s**, while an unpolled machine reached the `READY` prompt in under 4.5 s. Four runs were
  voided by this before it was recognised. Waits here install their listener first and then wait
  with no command traffic at all.
- **A temporary target at the anchor address can be deleted before the wait starts.** The first
  version of this probe armed both a non-temporary anchor and a temporary target at `$ea31`; two
  runs then waited out a 90 s budget for a checkpoint id that no longer existed.

## The transcript — fifteen runs, every comparison, both derivations

```
$ node reset-removed-probe.mjs run
PROBE reset-removed-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-11
NODE v24.20.0
VICE_VERSION x64sc (VICE 3.9)
STOCK_DETERMINISM_FLAGS ["-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random"]
ORACLE_TERMS ["pc","hitCount","line","cycle"]
FRAME_ANCHOR $ea31
JITTERS [0,1500,4000]  (each preceded by 3000 ms of free run)
REPS full=3 noreset=1
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)

--- FULL protocol, jitter 0 ms, rep 1 ---------------------------
RUN_LABEL full-j0-r1
RUN_ARM FULL (reset sent -- the protocol as REPRO-02 specifies it)
RUN_JITTER_MS 0
RUN_FREE_RUN_MS 3000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/full-j0-r1
DATE_UTC 2026-09-02T23:38:39.794Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd77 LIN=0 CYC=0 jiffy=000000
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r1.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r1.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r1.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r1.run.json usable=true

--- FULL protocol, jitter 0 ms, rep 2 ---------------------------
RUN_LABEL full-j0-r2
RUN_ARM FULL (reset sent -- the protocol as REPRO-02 specifies it)
RUN_JITTER_MS 0
RUN_FREE_RUN_MS 3000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/full-j0-r2
DATE_UTC 2026-09-02T23:38:47.769Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd83 LIN=0 CYC=5 jiffy=000000
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r2.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r2.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r2.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r2.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r2.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r2.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r2.run.json usable=true

--- FULL protocol, jitter 0 ms, rep 3 ---------------------------
RUN_LABEL full-j0-r3
RUN_ARM FULL (reset sent -- the protocol as REPRO-02 specifies it)
RUN_JITTER_MS 0
RUN_FREE_RUN_MS 3000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/full-j0-r3
DATE_UTC 2026-09-02T23:38:55.289Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd70 LIN=0 CYC=0 jiffy=000000
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r3.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r3.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r3.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r3.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r3.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r3.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j0-r3.run.json usable=true

--- FULL protocol, jitter 1500 ms, rep 1 ---------------------------
RUN_LABEL full-j1500-r1
RUN_ARM FULL (reset sent -- the protocol as REPRO-02 specifies it)
RUN_JITTER_MS 1500
RUN_FREE_RUN_MS 4500
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/full-j1500-r1
DATE_UTC 2026-09-02T23:39:02.884Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5cf LIN=0 CYC=1 jiffy=000028
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r1.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r1.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r1.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r1.run.json usable=true

--- FULL protocol, jitter 1500 ms, rep 2 ---------------------------
RUN_LABEL full-j1500-r2
RUN_ARM FULL (reset sent -- the protocol as REPRO-02 specifies it)
RUN_JITTER_MS 1500
RUN_FREE_RUN_MS 4500
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/full-j1500-r2
DATE_UTC 2026-09-02T23:39:12.040Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5d1 LIN=0 CYC=0 jiffy=000021
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r2.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r2.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r2.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r2.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r2.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r2.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r2.run.json usable=true

--- FULL protocol, jitter 1500 ms, rep 3 ---------------------------
RUN_LABEL full-j1500-r3
RUN_ARM FULL (reset sent -- the protocol as REPRO-02 specifies it)
RUN_JITTER_MS 1500
RUN_FREE_RUN_MS 4500
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/full-j1500-r3
DATE_UTC 2026-09-02T23:39:21.073Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5cf LIN=0 CYC=2 jiffy=000025
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r3.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r3.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r3.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r3.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r3.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r3.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j1500-r3.run.json usable=true

--- FULL protocol, jitter 4000 ms, rep 1 ---------------------------
RUN_LABEL full-j4000-r1
RUN_ARM FULL (reset sent -- the protocol as REPRO-02 specifies it)
RUN_JITTER_MS 4000
RUN_FREE_RUN_MS 7000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/full-j4000-r1
DATE_UTC 2026-09-02T23:39:30.007Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5cf LIN=0 CYC=1 jiffy=0000a0
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r1.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r1.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r1.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r1.run.json usable=true

--- FULL protocol, jitter 4000 ms, rep 2 ---------------------------
RUN_LABEL full-j4000-r2
RUN_ARM FULL (reset sent -- the protocol as REPRO-02 specifies it)
RUN_JITTER_MS 4000
RUN_FREE_RUN_MS 7000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/full-j4000-r2
DATE_UTC 2026-09-02T23:39:41.627Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5cf LIN=0 CYC=1 jiffy=00008e
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r2.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r2.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r2.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r2.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r2.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r2.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r2.run.json usable=true

--- FULL protocol, jitter 4000 ms, rep 3 ---------------------------
RUN_LABEL full-j4000-r3
RUN_ARM FULL (reset sent -- the protocol as REPRO-02 specifies it)
RUN_JITTER_MS 4000
RUN_FREE_RUN_MS 7000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/full-j4000-r3
DATE_UTC 2026-09-02T23:39:53.525Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5d4 LIN=0 CYC=2 jiffy=000099
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r3.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r3.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r3.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r3.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r3.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r3.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/full-j4000-r3.run.json usable=true

--- NORESET control, jitter 0 ms, rep 1 -------------------------
RUN_LABEL noreset-j0-r1
RUN_ARM NORESET (reset step REMOVED -- the control)
RUN_JITTER_MS 0
RUN_FREE_RUN_MS 3000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/noreset-j0-r1
DATE_UTC 2026-09-02T23:40:05.276Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd7e LIN=0 CYC=4 jiffy=000000
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=NO  <-- the removed step
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j0-r1.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j0-r1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j0-r1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j0-r1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j0-r1.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j0-r1.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j0-r1.run.json usable=true

--- NORESET control, jitter 1500 ms, rep 1 -------------------------
RUN_LABEL noreset-j1500-r1
RUN_ARM NORESET (reset step REMOVED -- the control)
RUN_JITTER_MS 1500
RUN_FREE_RUN_MS 4500
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/noreset-j1500-r1
DATE_UTC 2026-09-02T23:40:11.726Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5cf LIN=0 CYC=1 jiffy=000014
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=NO  <-- the removed step
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=166 CYC=55 $00=47 $01=55 jiffy=000014
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j1500-r1.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j1500-r1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j1500-r1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j1500-r1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j1500-r1.bin","imageBytes":65536,"sha256":"5abf030c99a3c62e7a6e194edf096a724b778cfdebe2685bc2067f5c5b8ebfe5","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j1500-r1.bin bytes=65536 sha256=5abf030c99a3c62e7a6e194edf096a724b778cfdebe2685bc2067f5c5b8ebfe5
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j1500-r1.run.json usable=true

--- NORESET control, jitter 4000 ms, rep 1 -------------------------
RUN_LABEL noreset-j4000-r1
RUN_ARM NORESET (reset step REMOVED -- the control)
RUN_JITTER_MS 4000
RUN_FREE_RUN_MS 7000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/noreset-j4000-r1
DATE_UTC 2026-09-02T23:40:18.455Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5cd LIN=0 CYC=0 jiffy=0000a9
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=NO  <-- the removed step
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=6 CYC=15 $00=47 $01=55 jiffy=0000a9
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j4000-r1.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j4000-r1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j4000-r1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j4000-r1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j4000-r1.bin","imageBytes":65536,"sha256":"16ec3a90e63e3258c4edd88af8f47387facd450e22dbf6e96e86f4143213b4a0","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j4000-r1.bin bytes=65536 sha256=16ec3a90e63e3258c4edd88af8f47387facd450e22dbf6e96e86f4143213b4a0
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/noreset-j4000-r1.run.json usable=true

--- PREHALT method control, jitter 0 ms, rep 1 ------------------
RUN_LABEL prehalt-j0-r1
RUN_ARM PREHALT (method control: an extra checkpoint halt BEFORE the reset)
RUN_JITTER_MS 0
RUN_FREE_RUN_MS 3000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/prehalt-j0-r1
DATE_UTC 2026-09-02T23:40:27.735Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd79 LIN=0 CYC=0 jiffy=000000
STEP0_HALTER_ARMED cp=1 at=$ea31 temporary=true
STEP0_HALTER_HIT hit=true hit_count=1 reason=-
STEP0_HALT_CHECK pc=$ea31->$ea31 jiffy=000000->000000
STEP0_HALTED pc=$ea31 LIN=257 CYC=57 jiffy=000000 (stable across two reads 700 ms apart)
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j0-r1.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,checkpoint_info#1@1,registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j0-r1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j0-r1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j0-r1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j0-r1.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j0-r1.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j0-r1.run.json usable=true

--- PREHALT method control, jitter 1500 ms, rep 1 ------------------
RUN_LABEL prehalt-j1500-r1
RUN_ARM PREHALT (method control: an extra checkpoint halt BEFORE the reset)
RUN_JITTER_MS 1500
RUN_FREE_RUN_MS 4500
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/prehalt-j1500-r1
DATE_UTC 2026-09-02T23:40:37.132Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5cf LIN=0 CYC=1 jiffy=000028
STEP0_HALTER_ARMED cp=1 at=$ea31 temporary=true
STEP0_HALTER_HIT hit=true hit_count=1 reason=-
STEP0_HALT_CHECK pc=$ea31->$ea31 jiffy=000028->000028
STEP0_HALTED pc=$ea31 LIN=76 CYC=30 jiffy=000028 (stable across two reads 700 ms apart)
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=258 CYC=0 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j1500-r1.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,checkpoint_info#1@1,registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j1500-r1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j1500-r1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j1500-r1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j1500-r1.bin","imageBytes":65536,"sha256":"f3c6656e772baa8ccf31ae8dcb1e3008d925d9d4ea90a206416e195d2e2d179a","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j1500-r1.bin bytes=65536 sha256=f3c6656e772baa8ccf31ae8dcb1e3008d925d9d4ea90a206416e195d2e2d179a
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j1500-r1.run.json usable=true

--- PREHALT method control, jitter 4000 ms, rep 1 ------------------
RUN_LABEL prehalt-j4000-r1
RUN_ARM PREHALT (method control: an extra checkpoint halt BEFORE the reset)
RUN_JITTER_MS 4000
RUN_FREE_RUN_MS 7000
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6512"]
ARGV_DIGEST 91106759e27e54d92b8f20e978a5714f8cb500d25a7a3356e51d91f0a94a7bcd
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/prehalt-j4000-r1
DATE_UTC 2026-09-02T23:40:47.180Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5d4 LIN=0 CYC=1 jiffy=0000b9
STEP0_HALTER_ARMED cp=1 at=$ea31 temporary=true
STEP0_HALTER_HIT hit=true hit_count=1 reason=-
STEP0_HALT_CHECK pc=$ea31->$ea31 jiffy=0000b9->0000b9
STEP0_HALTED pc=$ea31 LIN=120 CYC=57 jiffy=0000b9 (stable across two reads 700 ms apart)
ANCHOR_ARMED cp=1 temporary=false hits_at_arm=0
RESET mode=hard sent=yes anchor_hits_after_reset=0 jiffy_after_reset=000000
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=258 CYC=0 $00=47 $01=55 jiffy=000000
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j4000-r1.vsf err=0x00 size=193261
EVENTS registers,stopped,resumed,checkpoint_info#1@1,registers,stopped,resumed,registers,stopped,resumed,checkpoint_info#1@1,registers,stopped
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j4000-r1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j4000-r1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j4000-r1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j4000-r1.bin","imageBytes":65536,"sha256":"f3c6656e772baa8ccf31ae8dcb1e3008d925d9d4ea90a206416e195d2e2d179a","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j4000-r1.bin bytes=65536 sha256=f3c6656e772baa8ccf31ae8dcb1e3008d925d9d4ea90a206416e195d2e2d179a
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/prehalt-j4000-r1.run.json usable=true

VOIDED_RUNS (none)
DECLARED_TRIPLE full-j0-r1 full-j1500-r1 full-j4000-r1

--- arm TRIPLE: 3 runs ------------------------------------
TRIPLE_RUN full-j0-r1 jitter=0 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
TRIPLE_RUN full-j1500-r1 jitter=1500 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
TRIPLE_RUN full-j4000-r1 jitter=4000 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
TRIPLE_DISTINCT_SHA256 1 (0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b)
TRIPLE_PAIR full-j0-r1vfull-j1500-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
TRIPLE_PAIR full-j0-r1vfull-j4000-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
TRIPLE_PAIR full-j1500-r1vfull-j4000-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
TRIPLE_PAIRWISE_DIFF_TOTAL 0
TRIPLE_ANY_STOP_TERM_DIFFERS no
TRIPLE_DIFFERING_TERMS_UNION (none)

--- arm FULL_ALL: 9 runs ------------------------------------
FULL_ALL_RUN full-j0-r1 jitter=0 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
FULL_ALL_RUN full-j0-r2 jitter=0 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
FULL_ALL_RUN full-j0-r3 jitter=0 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
FULL_ALL_RUN full-j1500-r1 jitter=1500 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
FULL_ALL_RUN full-j1500-r2 jitter=1500 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
FULL_ALL_RUN full-j1500-r3 jitter=1500 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
FULL_ALL_RUN full-j4000-r1 jitter=4000 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
FULL_ALL_RUN full-j4000-r2 jitter=4000 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
FULL_ALL_RUN full-j4000-r3 jitter=4000 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
FULL_ALL_DISTINCT_SHA256 1 (0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b)
FULL_ALL_PAIR full-j0-r1vfull-j0-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r1vfull-j0-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r1vfull-j1500-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r1vfull-j1500-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r1vfull-j1500-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r1vfull-j4000-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r1vfull-j4000-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r1vfull-j4000-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r2vfull-j0-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r2vfull-j1500-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r2vfull-j1500-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r2vfull-j1500-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r2vfull-j4000-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r2vfull-j4000-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r2vfull-j4000-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r3vfull-j1500-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r3vfull-j1500-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r3vfull-j1500-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r3vfull-j4000-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r3vfull-j4000-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j0-r3vfull-j4000-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r1vfull-j1500-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r1vfull-j1500-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r1vfull-j4000-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r1vfull-j4000-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r1vfull-j4000-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r2vfull-j1500-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r2vfull-j4000-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r2vfull-j4000-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r2vfull-j4000-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r3vfull-j4000-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r3vfull-j4000-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j1500-r3vfull-j4000-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j4000-r1vfull-j4000-r2 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j4000-r1vfull-j4000-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIR full-j4000-r2vfull-j4000-r3 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
FULL_ALL_PAIRWISE_DIFF_TOTAL 0
FULL_ALL_ANY_STOP_TERM_DIFFERS no
FULL_ALL_DIFFERING_TERMS_UNION (none)

--- arm NORESET: 3 runs ------------------------------------
NORESET_RUN noreset-j0-r1 jitter=0 halt=undefined stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
NORESET_RUN noreset-j1500-r1 jitter=1500 halt=undefined stop={"pc":59953,"hitCount":1,"line":166,"cycle":55} stop_jiffy=000014 sha256=5abf030c99a3c62e7a6e194edf096a724b778cfdebe2685bc2067f5c5b8ebfe5
NORESET_RUN noreset-j4000-r1 jitter=4000 halt=undefined stop={"pc":59953,"hitCount":1,"line":6,"cycle":15} stop_jiffy=0000a9 sha256=16ec3a90e63e3258c4edd88af8f47387facd450e22dbf6e96e86f4143213b4a0
NORESET_DISTINCT_SHA256 3 (0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b 5abf030c99a3c62e7a6e194edf096a724b778cfdebe2685bc2067f5c5b8ebfe5 16ec3a90e63e3258c4edd88af8f47387facd450e22dbf6e96e86f4143213b4a0)
NORESET_PAIR noreset-j0-r1vnoreset-j1500-r1 differing_bytes=199 first=$0003 $0004 $0005 $0006 $0007 $0008 $000d $0016 stop_identical=false differing_terms=line,cycle
NORESET_PAIR noreset-j0-r1vnoreset-j4000-r1 differing_bytes=199 first=$0003 $0004 $0005 $0006 $0007 $0008 $000d $0016 stop_identical=false differing_terms=line,cycle
NORESET_PAIR noreset-j1500-r1vnoreset-j4000-r1 differing_bytes=3 first=$00a2 $00cd $01f2 stop_identical=false differing_terms=line,cycle
NORESET_PAIRWISE_DIFF_TOTAL 401
NORESET_ANY_STOP_TERM_DIFFERS yes
NORESET_DIFFERING_TERMS_UNION line,cycle

--- arm PREHALT: 3 runs ------------------------------------
PREHALT_RUN prehalt-j0-r1 jitter=0 halt={"pc":59953,"line":257,"cycle":57,"jiffy":"000000"} stop={"pc":59953,"hitCount":1,"line":257,"cycle":57} stop_jiffy=000000 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PREHALT_RUN prehalt-j1500-r1 jitter=1500 halt={"pc":59953,"line":76,"cycle":30,"jiffy":"000028"} stop={"pc":59953,"hitCount":1,"line":258,"cycle":0} stop_jiffy=000000 sha256=f3c6656e772baa8ccf31ae8dcb1e3008d925d9d4ea90a206416e195d2e2d179a
PREHALT_RUN prehalt-j4000-r1 jitter=4000 halt={"pc":59953,"line":120,"cycle":57,"jiffy":"0000b9"} stop={"pc":59953,"hitCount":1,"line":258,"cycle":0} stop_jiffy=000000 sha256=f3c6656e772baa8ccf31ae8dcb1e3008d925d9d4ea90a206416e195d2e2d179a
PREHALT_DISTINCT_SHA256 2 (0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b f3c6656e772baa8ccf31ae8dcb1e3008d925d9d4ea90a206416e195d2e2d179a)
PREHALT_PAIR prehalt-j0-r1vprehalt-j1500-r1 differing_bytes=4 first=$0000 $0001 $01ec $01ed stop_identical=false differing_terms=line,cycle
PREHALT_PAIR prehalt-j0-r1vprehalt-j4000-r1 differing_bytes=4 first=$0000 $0001 $01ec $01ed stop_identical=false differing_terms=line,cycle
PREHALT_PAIR prehalt-j1500-r1vprehalt-j4000-r1 differing_bytes=0 first=(none) stop_identical=true differing_terms=(none)
PREHALT_PAIRWISE_DIFF_TOTAL 8
PREHALT_ANY_STOP_TERM_DIFFERS yes
PREHALT_DIFFERING_TERMS_UNION line,cycle

--- the contrast -----------------------------------------------------
CONTRAST_FULL_PAIRWISE_DIFF_TOTAL 0
CONTRAST_NORESET_PAIRWISE_DIFF_TOTAL 401
CONTRAST_ONLY_DIFFERENCE the monitor-issued hard RESET (step 5) was sent in FULL and not sent in NORESET

--- the derivations --------------------------------------------------
DERIVED_JITTER_IMMUNITY_DECLARED_TRIPLE immune
DERIVED_JITTER_IMMUNITY_ALL_FULL_RUNS immune
DERIVED_RESET_REMOVED_CONTROL red
METHOD_CONTROL_PREHALT_WOULD_HAVE_DERIVED not-immune  (NOT the protocol -- one added step)
```

Reading the transcript: `halt=undefined` on the `FULL` and `NORESET` rows is not missing data —
it is the absence of the `PREHALT` arm's extra step, which is the only thing that writes a `halt`
record. Those two arms have no pre-reset checkpoint halt, by design.

## The positive arm — the declared triple

`SCHEMA.md` § 2.2's derivation is over **three runs, one per jitter**. Repetition 1 at each jitter
IS that triple, named as a rule in the probe (`DECLARED_TRIPLE`) rather than selected after the
fact. Repetitions 2 and 3 are supplementary, because a triple that agreed by luck and a triple
that agreed because the protocol is immune look identical from three runs.

| Run | Jitter (ms) | Free-run (ms) | Stop `(PC, hit_count, LIN, CYC)` | Sliced 64K sha256 |
|---|---|---|---|---|
| `full-j0-r1` | 0 | 3000 | `($ea31, 1, 257, 57)` | `0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b` |
| `full-j1500-r1` | 1500 | 4500 | `($ea31, 1, 257, 57)` | `0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b` |
| `full-j4000-r1` | 4000 | 7000 | `($ea31, 1, 257, 57)` | `0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b` |

Pairwise differing bytes over the sliced 64K, all three pairs: **0**, **0**, **0**
(`TRIPLE_PAIRWISE_DIFF_TOTAL 0`). One distinct sha256 across the triple. Every one of the four
stop-identity terms agrees on every pair, through the shipped `compareStopIdentity()`
(`TRIPLE_ANY_STOP_TERM_DIFFERS no`).

The nine-run superset agrees: `FULL_ALL_DISTINCT_SHA256 1`,
`FULL_ALL_ANY_STOP_TERM_DIFFERS no`, all 36 pairs at 0 differing bytes. The sha256
`0999713e…` is byte-for-byte the digest research recorded for its own jitter triple
(`33-RESEARCH.md` M4), so the same stop on the same build reached by the same protocol produces
the same image across sessions.

## The control arm — the reset step removed, and nothing else

| Run | Jitter (ms) | Stop `(PC, hit_count, LIN, CYC)` | Sliced 64K sha256 |
|---|---|---|---|
| `noreset-j0-r1` | 0 | `($ea31, 1, 257, 57)` | `0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b` |
| `noreset-j1500-r1` | 1500 | `($ea31, 1, 166, 55)` | `5abf030c99a3c62e7a6e194edf096a724b778cfdebe2685bc2067f5c5b8ebfe5` |
| `noreset-j4000-r1` | 4000 | `($ea31, 1, 6, 15)` | `16ec3a90e63e3258c4edd88af8f47387facd450e22dbf6e96e86f4143213b4a0` |

Three distinct sha256 values, and `line`/`cycle` differ on **every** pair
(`NORESET_DIFFERING_TERMS_UNION line,cycle`).

**One honest note about the jitter-0 row, because it is the difference between a red that is
attributable and a red that is not.** At jitter 0 the control produced the SAME stop and the SAME
image as the positive arm. That is not a defect in the control and it is not a coincidence worth
hiding: at a 3000 ms free-run on this host the machine is still inside KERNAL initialisation with
interrupts not yet enabled — `PRE_PROTOCOL pc=$fd7e LIN=0 CYC=4 jiffy=000000` on that run — so its *first* anchor hit
IS the first-IRQ-after-power-up state that a hard reset also produces. The control's red
therefore comes from the 1500 ms and 4000 ms rows, where the machine has reached `READY` before
the protocol starts. Both of those diverge from the positive arm and from each other, in the stop
and in the image.

## The contrast, in one sentence with both numbers in it

**With the reset, 0 differing bytes across the jitter triple; without it, 401** — and the removal
of the monitor-issued hard reset is the only difference between the two arms
(`CONTRAST_FULL_PAIRWISE_DIFF_TOTAL 0`, `CONTRAST_NORESET_PAIRWISE_DIFF_TOTAL 401`,
`CONTRAST_ONLY_DIFFERENCE`). The six pairwise counts, in order: positive arm **0 / 0 / 0**;
control arm **199 / 199 / 3**.

## The method control — what one added step before the reset costs

The `PREHALT` arm is the full protocol plus **one** extra step: a temporary checkpoint at the
anchor, hit and confirmed, so the machine is halted **at a checkpoint** before the reset rather
than halted by the monitor. Everything else is identical, including the reset.

| Run | Halt `(LIN, CYC)` before the reset | Stop `(LIN, CYC)` | Sliced 64K sha256 |
|---|---|---|---|
| `prehalt-j0-r1` | `(257, 57)` | `(257, 57)` | `0999713e…` |
| `prehalt-j1500-r1` | `(76, 30)` | `(258, 0)` | `f3c6656e…` |
| `prehalt-j4000-r1` | `(120, 57)` | `(258, 0)` | `f3c6656e…` |

`METHOD_CONTROL_PREHALT_WOULD_HAVE_DERIVED not-immune`. The divergence is small and entirely
characteristic: two raster values **6 cycles apart** (`(257, 57)` against `(258, 0)` on a
63-cycle line), and 4 differing bytes at `$0000`, `$0001`, `$01ec`, `$01ed` — the two 6510 port
registers and two stack bytes.

Three things follow, and the third is the one a later phase needs:

1. **The mechanism.** A hard reset restarts the CPU and re-runs KERNAL init in a fixed number of
   cycles, but it does not reset the VIC-II raster counter. The raster position at the first
   post-reset IRQ is therefore `raster_at_reset + constant`, and a reset issued from an arbitrary
   raster phase produces an arbitrary stop phase. A monitor halt leaves `LIN` reading **0** on
   this build (visible as `pre_lin=0` on every `FULL` run), which is why the protocol as
   specified is reproducible and the variant is not.
2. **The method rule.** Never add a step before the reset. This probe's first version added one
   and turned an `immune` measurement into a `not-immune` one; the four voided runs and the
   `PREHALT` arm are what caught it.
3. **It explains `33-10`.** `33-10` recorded `CAPTURE_FRAME_EXACT: no` on an autostarted release,
   with `line` 154 against 311. An autostarted capture *necessarily* has the anchor armed and hit
   before the machine is captured, so it is in exactly the `PREHALT` situation. The frame
   inexactness `33-10` reported beside its `pass` is not release-specific and is not a fault in
   its script — it is this mechanism, and it is now measured in isolation on a corpus-free stop.

## Voided runs

Recorded, not discarded (`README.md` § *Evidence conventions* 5). The reported runs are the runs
taken, in the order taken.

| Run | Void reason |
|---|---|
| (this probe's run 1) `full-j1500`, `full-j4000` | 90 s wait budget exhausted with no hit — the probe armed a **temporary** target at the anchor address alongside the non-temporary anchor, and VICE deleted it on its first hit, so the wait was keyed on a checkpoint id that no longer existed. Design corrected to one non-temporary checkpoint, per `REPRO-02`'s own wording |
| (this probe's run 1) `noreset-j1500` | same cause |
| (this probe's run 2) `full-j0-r1`, `full-j0-r2`, `full-j0-r3`, `noreset-j0-r1` | "step 0 could not establish a verified halt at the anchor within 30 s" — the halt check was a polling loop issuing four commands per 700 ms, which starved the emulator: `PC` unchanged at `$fd80` across thirty reads spanning 21 s. Design corrected to an event-driven wait with no command traffic |
| (this probe's run 3) all fifteen runs | Not voided by the emulator, but **superseded as a measurement**: run 3 carried the halt-establishing step unconditionally in both arms and therefore measured the `PREHALT` situation as if it were the protocol, deriving `not-immune`. It is the reason the `PREHALT` arm exists and is labelled. Its transcript is retained at `/home/henrik/.cache/c64-re-tools/phase33/33-11/repro02.run3.txt` |
| (this file's reported run 4) none | All fifteen runs produced a usable 65536-byte image (`VOIDED_RUNS (none)`) |

## The derivations, applied

`SCHEMA.md` § 2.2, verbatim: `immune` iff all three runs produce **one identical 64K sha256**
**and** identical `(PC, hit_count, LIN, CYC)`; `partial` iff the four-term identity matches on all
three but the sha256 does not; `not-immune` iff **any** of the four terms differs.

- one distinct sha256 across the declared triple → the sha256 conjunct holds
- `TRIPLE_ANY_STOP_TERM_DIFFERS no` → the four-term conjunct holds

JITTER_IMMUNITY: immune

`RESET_REMOVED_CONTROL` is `red` when the reset-removed arm's stops differ in any stop-identity
term or in the sliced sha256. Both: `line`/`cycle` differ on all three pairs, and there are three
distinct sha256 values.

RESET_REMOVED_CONTROL: red

Consequence under `DECISION-RULE.md`: `R3` (`JITTER_IMMUNITY: not-immune` → `no-go`) does **not**
fire, and `R8` (`partial` → `degrade`) does **not** fire. `RESET_REMOVED_CONTROL` never gates
(`SCHEMA.md` § 3) — it is the third of the five `D-07` controls, and `red` is the expected and
required observation.

## ACCEPTED LIMIT — `SCHEMA.md` § 2.2's aside about an autostarted release

`SCHEMA.md` § 2.2 closes with: "`CAP-04` is why that is re-measured here on an **autostarted**
real release with true drive emulation in the loop rather than being carried forward." The
frozen files may not be edited, so the ambiguity is recorded here instead of resolved there.

The measurement in this file is taken at the KERNAL `READY` prompt with **no corpus**, for two
reasons that are both facts rather than preferences:

- `33-10` MEASURED that `runReproducible()` cannot serve an autostarted release at all: its hard
  `RESET` undoes `AUTOSTART`, and its single-resume wait cannot count the hits an autostarted
  load needs. There is no configuration of this protocol that both autostarts a release and
  issues the hard reset whose necessity `REPRO-02` exists to prove.
- `JITTER_IMMUNITY` is declared **corpus-free** in `SCHEMA.md` § 2 and in `DECISION-RULE.md`
  § *Inputs*, and `D-02` names corpus-freedom as the distinguishing property of this gate. A
  measurement that required the corpus would move this input out of that set.

The autostarted side of the same question is **not** unmeasured: `33-03` recorded
`AUTOSTART_FRAME_EXACT: not-achieved` with frame-exactness holding through anchor hit 50 and lost
from hit 75, and `33-10` recorded `CAPTURE_FRAME_EXACT: no` beside its `C0_CAPTURE_PAIR: pass`.
This file's `PREHALT` method control supplies the mechanism behind both. So the pair of readings
a later phase needs is on the record: **the reset protocol is jitter-immune at a monitor-halted
stop, and frame-exactness degrades exactly when the reset inherits an arbitrary raster phase**,
which an autostarted capture cannot avoid.

## PROBE_DIR

Absolute paths, so a later wave can find the working artifacts. Nothing binary is committed
(`D-27`):

- `/home/henrik/.cache/c64-re-tools/phase33/33-11/` — fifteen `.vsf` snapshots and fifteen sliced
  `.bin` images for the reported run, the `*.run.json` records, `repro02.run1.txt` through
  `repro02.run4.txt` (run 4 is the one transcribed above), and a per-run scratch `xdg/<label>/`.
