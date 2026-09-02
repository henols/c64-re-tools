# 33-11 · `REPRO-01` — the divergence control: without the determinism block, red; with it, zero over the untouched window

Owner: plan `33-11`, Task 1. Probe: `evidence/determinism-probe.mjs`.
Declared source file for `SEED_EFFECT` (`SCHEMA.md` § 2, `DECISION-RULE.md` § *Inputs*).

`SEED_EFFECT` is not "were the determinism flags present". `SCHEMA.md` § 2.1 makes it a
**divergence** measurement with **both halves mandatory**: `pinned` requires the with-block
window count to be `0` **and** the without-block count to be above `0`. A with-block zero
means nothing on its own, because a window that was never nondeterministic never tested the
block. So this file records **six cold boots** — two without the block, two with it, and two
more with it on a second port — and derives the outcome line from the two counts by
`SCHEMA.md`'s rule rather than from the flags' presence.

## Conditions

BROKER_STATE: inactive

TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file — `anno-register.test.ts` (`tests 3113 / suites 24 / pass 3105 / fail 2`), observed 2026-09-02 with the broker stopped. The two are `anno-register.test.ts:385` (DIRECTION 5 basis integrity) and `anno-register.test.ts:479` (its planted-violation negative control), one shared root cause Phase 33 did not create — the ids `STORE-01` / `STORE-04` / `STORE-06` / `MCP-04` are no longer declared in `.planning/REQUIREMENTS.md`. This is the expected post-`33-02` baseline named in `README.md` § *Evidence conventions* 4. Not "clean", not "0 failures", and never a gate (`DECISION-RULE.md` § *Never a gate*).

### D-11 preflight, and the baseline it was taken against

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

Note on `pgrep`: `-x` and never `-f`. A `pgrep -f x64sc` matches this session's **own** command
line and would refuse every run for a process that is the checker itself.

## Why the probe spawns `x64sc` directly rather than through the broker

`buildViceArgs()` emits `STOCK_DETERMINISM_FLAGS` **unconditionally** on the stock branch
(`broker-launch.mts`, plan `33-05`, the `D-15` amendment rider) — that unconditionality is the
shipped behaviour `REPRO-01` asked for, and there is deliberately no broker route that omits the
block. Arm A needs those flags **absent**. A probe that went through the broker could therefore
only ever measure Arm B, which is exactly the one-armed measurement `SCHEMA.md` § 2.1 forbids.
`execve(/usr/bin/x64sc, argv)` from the probe is the only route that can build the without-block
argv at all; it is recorded as a trust boundary in this plan's threat model (`T-33-04`) and the
argv is a fixed literal list with the port as its only interpolated element.

The block itself is **imported** from `broker-launch.mts`'s exported, frozen
`STOCK_DETERMINISM_FLAGS` and never retyped (`T-33-36`), so Arm B measures the shipped block and
a future edit to that array changes what this probe launches rather than leaving it measuring a
stale copy. The flat 64K is reached through the shipped `vsf-slice` CLI entry point; this probe
parses no snapshot bytes.

## The protocol each boot runs

`stock-reproducible-run.ts`'s own ordered sequence, driven over the wire (Arm A's argv cannot be
produced by the broker, so `runReproducible()` cannot serve Arm A): resolve `PC` / `LIN` / `CYC`
**by name** from `REGISTERS_AVAILABLE` → arm the frame anchor at `$ea31`, `temporary: false` so
it survives its own hits → arm the target at `$ea31`, `temporary: true` → the **monitor-issued
hard reset** (`RESET` `0xcc`, `ResetMode.Hard`) → **exactly one** `EXIT` → the event-driven wait
on the *target's own* checkpoint id → all four stop terms from one `REGISTERS_GET` plus the
anchor's `CHECKPOINT_GET` hit count → `DUMP`.

The stop is therefore **frame-anchored**, not wall-clock-anchored. That distinction is what makes
the whole-64K numbers below differ from research's, and it is the point of § *Necessary and not
sufficient*.

## The transcript — six cold boots, every comparison, the derivation

```
$ node determinism-probe.mjs run
PROBE determinism-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-11
NODE v24.20.0
VICE_VERSION x64sc (VICE 3.9)
STOCK_DETERMINISM_SEED 4242
STOCK_DETERMINISM_FLAGS ["-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random"]
WINDOW $c000-$cfef = 4080 addresses
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)

--- boot A1-noblock-p1 -------------------------------------------------
BOOT_LABEL A1-noblock-p1
BOOT_BLOCK OMITTED
BOOT_PORT 6511
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6511"]
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/A1-noblock-p1
ARGV_DIGEST 921e81572bd5c61ba84d8dba440ccd01ccd0e57170ac69496c5fe0c9f73cd877
DATE_UTC 2026-09-02T23:01:50.535Z
TIME_TO_BIND_MS 184
MONITOR_READY_AFTER_PINGS 1
REGISTER_CATALOG 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE RAMInitRandomChance=10
RESOURCE AutostartDelayRandom=1
RESOURCE Drive8TrueEmulation=1
RESOURCE Drive8Type=1541
ARMED anchor=1 target=2 at=$ea31
RESET mode=hard
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/A1-noblock-p1.vsf err=0x00 size=193261
CHILD_EXIT code=null signal=SIGKILL
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/A1-noblock-p1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/A1-noblock-p1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/A1-noblock-p1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/A1-noblock-p1.bin","imageBytes":65536,"sha256":"114121e0b4b3519df08508b4492f9db57d795b5d5f3aa4e86ed0b76f482482ac","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/A1-noblock-p1.bin bytes=65536 sha256=114121e0b4b3519df08508b4492f9db57d795b5d5f3aa4e86ed0b76f482482ac
PORT_READS dirRead=47 dataRead=55
BOOT_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/A1-noblock-p1.boot.json usable=true

--- boot A2-noblock-p1 -------------------------------------------------
BOOT_LABEL A2-noblock-p1
BOOT_BLOCK OMITTED
BOOT_PORT 6511
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6511"]
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/A2-noblock-p1
ARGV_DIGEST 921e81572bd5c61ba84d8dba440ccd01ccd0e57170ac69496c5fe0c9f73cd877
DATE_UTC 2026-09-02T23:01:57.231Z
TIME_TO_BIND_MS 158
MONITOR_READY_AFTER_PINGS 1
REGISTER_CATALOG 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE RAMInitRandomChance=10
RESOURCE AutostartDelayRandom=1
RESOURCE Drive8TrueEmulation=1
RESOURCE Drive8Type=1541
ARMED anchor=1 target=2 at=$ea31
RESET mode=hard
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/A2-noblock-p1.vsf err=0x00 size=193261
CHILD_EXIT code=null signal=SIGKILL
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/A2-noblock-p1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/A2-noblock-p1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/A2-noblock-p1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/A2-noblock-p1.bin","imageBytes":65536,"sha256":"ad55c85b8c71fb284e2974ce7d401c7bfc7568c9336fb63b5cebbe27e663eb7d","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/A2-noblock-p1.bin bytes=65536 sha256=ad55c85b8c71fb284e2974ce7d401c7bfc7568c9336fb63b5cebbe27e663eb7d
PORT_READS dirRead=47 dataRead=55
BOOT_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/A2-noblock-p1.boot.json usable=true

--- boot B1-block-p1 -------------------------------------------------
BOOT_LABEL B1-block-p1
BOOT_BLOCK present
BOOT_PORT 6511
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6511"]
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/B1-block-p1
ARGV_DIGEST cb90c283601ba06133d7989430878c106f3d88d2b1ad81f7da5db6fb210e3e9e
DATE_UTC 2026-09-02T23:02:04.115Z
TIME_TO_BIND_MS 161
MONITOR_READY_AFTER_PINGS 1
REGISTER_CATALOG 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE RAMInitRandomChance=0
RESOURCE AutostartDelayRandom=0
RESOURCE Drive8TrueEmulation=1
RESOURCE Drive8Type=1541
ARMED anchor=1 target=2 at=$ea31
RESET mode=hard
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/B1-block-p1.vsf err=0x00 size=193261
CHILD_EXIT code=null signal=SIGKILL
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/B1-block-p1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/B1-block-p1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/B1-block-p1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/B1-block-p1.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/B1-block-p1.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PORT_READS dirRead=47 dataRead=55
BOOT_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/B1-block-p1.boot.json usable=true

--- boot B2-block-p1 -------------------------------------------------
BOOT_LABEL B2-block-p1
BOOT_BLOCK present
BOOT_PORT 6511
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6511"]
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/B2-block-p1
ARGV_DIGEST cb90c283601ba06133d7989430878c106f3d88d2b1ad81f7da5db6fb210e3e9e
DATE_UTC 2026-09-02T23:02:10.617Z
TIME_TO_BIND_MS 170
MONITOR_READY_AFTER_PINGS 1
REGISTER_CATALOG 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE RAMInitRandomChance=0
RESOURCE AutostartDelayRandom=0
RESOURCE Drive8TrueEmulation=1
RESOURCE Drive8Type=1541
ARMED anchor=1 target=2 at=$ea31
RESET mode=hard
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/B2-block-p1.vsf err=0x00 size=193261
CHILD_EXIT code=null signal=SIGKILL
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/B2-block-p1.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/B2-block-p1.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/B2-block-p1.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/B2-block-p1.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/B2-block-p1.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PORT_READS dirRead=47 dataRead=55
BOOT_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/B2-block-p1.boot.json usable=true

--- boot B3-block-p2 -------------------------------------------------
BOOT_LABEL B3-block-p2
BOOT_BLOCK present
BOOT_PORT 6621
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6621"]
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/B3-block-p2
ARGV_DIGEST 0529b45b3f75da3e2f2cf09b290ce412563ff5187c7bdbbfb0dd8aba407d35c4
DATE_UTC 2026-09-02T23:02:17.471Z
TIME_TO_BIND_MS 157
MONITOR_READY_AFTER_PINGS 1
REGISTER_CATALOG 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE RAMInitRandomChance=0
RESOURCE AutostartDelayRandom=0
RESOURCE Drive8TrueEmulation=1
RESOURCE Drive8Type=1541
ARMED anchor=1 target=2 at=$ea31
RESET mode=hard
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/B3-block-p2.vsf err=0x00 size=193261
CHILD_EXIT code=null signal=SIGKILL
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/B3-block-p2.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/B3-block-p2.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/B3-block-p2.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/B3-block-p2.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/B3-block-p2.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PORT_READS dirRead=47 dataRead=55
BOOT_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/B3-block-p2.boot.json usable=true

--- boot B4-block-p2 -------------------------------------------------
BOOT_LABEL B4-block-p2
BOOT_BLOCK present
BOOT_PORT 6621
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6621"]
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/B4-block-p2
ARGV_DIGEST 0529b45b3f75da3e2f2cf09b290ce412563ff5187c7bdbbfb0dd8aba407d35c4
DATE_UTC 2026-09-02T23:02:23.870Z
TIME_TO_BIND_MS 158
MONITOR_READY_AFTER_PINGS 1
REGISTER_CATALOG 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE RAMInitRandomChance=0
RESOURCE AutostartDelayRandom=0
RESOURCE Drive8TrueEmulation=1
RESOURCE Drive8Type=1541
ARMED anchor=1 target=2 at=$ea31
RESET mode=hard
WAIT hit=true reason=-
STOP PC=$ea31 hit_count=1 LIN=257 CYC=57 $00=47 $01=55
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/B4-block-p2.vsf err=0x00 size=193261
CHILD_EXIT code=null signal=SIGKILL
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/B4-block-p2.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/B4-block-p2.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/B4-block-p2.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/B4-block-p2.bin","imageBytes":65536,"sha256":"0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/B4-block-p2.bin bytes=65536 sha256=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PORT_READS dirRead=47 dataRead=55
BOOT_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/B4-block-p2.boot.json usable=true

VOIDED_BOOTS (none)

--- comparisons ------------------------------------------------------
PAIR_A A1-noblock-p1 vs A2-noblock-p1 port=6511/6511 block=OMITTED
PAIR_A_SHA_A 114121e0b4b3519df08508b4492f9db57d795b5d5f3aa4e86ed0b76f482482ac
PAIR_A_SHA_B ad55c85b8c71fb284e2974ce7d401c7bfc7568c9336fb63b5cebbe27e663eb7d
PAIR_A_STOP_A {"pc":59953,"hitCount":1,"line":257,"cycle":57}
PAIR_A_STOP_B {"pc":59953,"hitCount":1,"line":257,"cycle":57}
PAIR_A_WINDOW 57 of 4080   first=$c004 $c01e $c01f $c041 $c1bb $c1d4 $c2cf $c357
PAIR_A_TOTAL_64K 1028   first=$015c $0172 $07ea $085f $09be $09de $09ea $0a03
PAIR_A_TOTAL_64K_PORT_NORMALISED 1028
PAIR_B B1-block-p1 vs B2-block-p1 port=6511/6511 block=present
PAIR_B_SHA_A 0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PAIR_B_SHA_B 0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PAIR_B_STOP_A {"pc":59953,"hitCount":1,"line":257,"cycle":57}
PAIR_B_STOP_B {"pc":59953,"hitCount":1,"line":257,"cycle":57}
PAIR_B_WINDOW 0 of 4080   first=(none)
PAIR_B_TOTAL_64K 0   first=(none)
PAIR_B_TOTAL_64K_PORT_NORMALISED 0
PAIR_C B3-block-p2 vs B4-block-p2 port=6621/6621 block=present
PAIR_C_SHA_A 0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PAIR_C_SHA_B 0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PAIR_C_STOP_A {"pc":59953,"hitCount":1,"line":257,"cycle":57}
PAIR_C_STOP_B {"pc":59953,"hitCount":1,"line":257,"cycle":57}
PAIR_C_WINDOW 0 of 4080   first=(none)
PAIR_C_TOTAL_64K 0   first=(none)
PAIR_C_TOTAL_64K_PORT_NORMALISED 0

--- the concurrency arm ----------------------------------------------
CONCURRENCY_ARGV_P1 ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6511"]
CONCURRENCY_ARGV_P2 ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6621"]
CONCURRENCY_ARGV_DIFFERING_INDICES [16]
CONCURRENCY_ARGV_DIFF[16] p1=ip4://127.0.0.1:6511 p2=ip4://127.0.0.1:6621
CONCURRENCY_ARGV_DIFFERS_ONLY_IN_IP4_ELEMENT yes
CONCURRENCY_WINDOW_P1 0 of 4080
CONCURRENCY_WINDOW_P2 0 of 4080
CONCURRENCY_SAME_WINDOW_COUNT yes

--- the derivation ---------------------------------------------------
NOSEED_DIFF_C000_CFEF 57 of 4080
BLOCK_DIFF_C000_CFEF 0 of 4080
NOSEED_DIFF_TOTAL_64K 1028
BLOCK_DIFF_TOTAL_64K 0
DERIVED_SEED_EFFECT pinned
```

## The six cold boots

Every number in this table is transcribed from the block above. The reported pairs are the pairs
**taken, in the order taken** — never the two most similar of N (`README.md` § *Evidence
conventions* 5).

| Boot | Arm | Port | Block | Full argv | `RAMInitRandomChance` | `AutostartDelayRandom` | Stop `(PC, hit_count, LIN, CYC)` | Sliced 64K sha256 |
|---|---|---|---|---|---|---|---|---|
| `A1-noblock-p1` | A | 6511 | **omitted** | `["/usr/bin/x64sc","-default","-console","-drive8type","1541","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6511"]` | `10` | `1` | `($ea31, 1, 257, 57)` | `114121e0b4b3519df08508b4492f9db57d795b5d5f3aa4e86ed0b76f482482ac` |
| `A2-noblock-p1` | A | 6511 | **omitted** | identical to `A1` (`ARGV_DIGEST 921e8157…`) | `10` | `1` | `($ea31, 1, 257, 57)` | `ad55c85b8c71fb284e2974ce7d401c7bfc7568c9336fb63b5cebbe27e663eb7d` |
| `B1-block-p1` | B | 6511 | **present** | `["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6511"]` | `0` | `0` | `($ea31, 1, 257, 57)` | `0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b` |
| `B2-block-p1` | B | 6511 | **present** | identical to `B1` (`ARGV_DIGEST cb90c283…`) | `0` | `0` | `($ea31, 1, 257, 57)` | `0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b` |
| `B3-block-p2` | B (2nd port) | 6621 | **present** | as `B1` with `ip4://127.0.0.1:6621` (`ARGV_DIGEST 0529b45b…`) | `0` | `0` | `($ea31, 1, 257, 57)` | `0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b` |
| `B4-block-p2` | B (2nd port) | 6621 | **present** | identical to `B3` | `0` | `0` | `($ea31, 1, 257, 57)` | `0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b` |

Two observations worth naming, because both are assertions rather than inferences:

- The `RESOURCE` rows are **read back over `RESOURCE_GET` (0x51) from the running machine**, not
  taken from the argv. `RAMInitRandomChance` reads `10` in Arm A and `0` in Arm B, and
  `AutostartDelayRandom` reads `1` in Arm A and `0` in Arm B — so the flags are observed to have
  landed, and the without-block arm is observed to carry the factory 0.1%-of-all-RAM-bits flip
  that is the dominant divergence term.
- The four stop terms are **identical across all six boots**, including the two Arm A boots. The
  frame-anchored protocol reproduces the *stop* even with launch nondeterminism unpinned; what
  the block changes is the *machine state at that stop*. That is precisely why `SEED_EFFECT` is
  measured over memory divergence and not over the stop identity — and it is also why the stop
  oracle alone cannot substitute for the seed.

## Voided runs

VOIDED_BOOTS: none — all six boots produced a usable 65536-byte image (`VOIDED_BOOTS (none)` in
the transcript, and `usable=true` on all six `BOOT_RECORD` lines). No boot was discarded, no boot
is unreported, and no run was retried into a better number.

## The two counts the derivation reads

Over the untouched **`$c000-$cfef` window**, which is `$cfef - $c000 + 1` = `0x0fef + 1` =
**4080 addresses** — the denominator `SCHEMA.md` § 2.1, `33-RESEARCH.md` M3 and `REPRO-01`'s own
requirement text all carry. The window is chosen because it is untouched by the KERNAL, by the
BASIC interpreter and by the protocol itself, so a difference there is launch nondeterminism and
not work:

NOSEED_DIFF_C000_CFEF: 57 of 4080

BLOCK_DIFF_C000_CFEF: 0 of 4080

And the whole-64K counts beside them, recorded as the audit trail and **never** gating
(`SCHEMA.md` § 2.1):

NOSEED_DIFF_TOTAL_64K: 1028

BLOCK_DIFF_TOTAL_64K: 0

Research measured `59 of 4080 → 0 of 4080` on this host over `-binarymonitor`
(`33-RESEARCH.md` M3), and `REPRO-01`'s original measurement was `67 of 4080 → 0`. This
measurement's `57 → 0` reproduces both in shape and magnitude. The identical Arm B sha256
`0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b` is byte-for-byte the same
digest research recorded for its jitter triple in `33-RESEARCH.md` M4 — the same stop on the same
build reached by the same protocol produces the same image, across sessions.

## Necessary and not sufficient

**Pinning launch nondeterminism is necessary and not sufficient.** What closes the remainder is
the **reset protocol plus the frame anchor**, and this file's own numbers are the demonstration
rather than an argument for it:

- Research's `BLOCK_DIFF_TOTAL_64K` was **1242** with the block fully applied, starting in zero
  page — because that stop was **wall-clock-anchored** (`RESET 1`, a 4000 ms wait, then `DUMP`).
  The seed had done its whole job and 1242 bytes still differed.
- This measurement's `BLOCK_DIFF_TOTAL_64K` is **0**, on the same host and the same build, and
  the only thing that changed is that the stop is **frame-anchored**: hard reset, one resume, and
  the wait resolved on the anchor's own `CHECKPOINT_INFO` at `$ea31` rather than on a wall clock.

So the block and the anchor are doing **different** jobs, and neither substitutes for the other.
Read the pair the other way for the converse: Arm A's stop identity is *also* `($ea31, 1, 257,
57)` — the frame anchor alone, with the block omitted, still leaves 1028 bytes differing whole-64K
and 57 differing inside the untouched window. A reader must not take a non-zero whole-64K count
with the block applied as a failure of the block, and must not take a frame-exact stop as making
the block redundant.

## The concurrency arm — the pinning is a property of the flags, not of one port

Arm B was repeated on a **second port** (6621) with everything else held. Two facts, both
transcribed from the block above:

- CONCURRENCY_ARGV_DIFFERING_INDICES: `[16]`, and index 16 is the `ip4://` element —
  `ip4://127.0.0.1:6511` against `ip4://127.0.0.1:6621`. The two argv arrays differ in **exactly
  one element**, and it is the port element
  (`CONCURRENCY_ARGV_DIFFERS_ONLY_IN_IP4_ELEMENT yes`).
- Both ports produced the **same** window divergence count: `0 of 4080` on port 6511 and
  `0 of 4080` on port 6621 (`CONCURRENCY_SAME_WINDOW_COUNT yes`), and all four Arm B boots share
  one sha256.

That is what makes the pinning a property of the **flags** rather than of one port, one instance
or one lucky boot. Note also that the two ports' `ARGV_DIGEST` values differ (`cb90c283…` against
`0529b45b…`) — which is correct and is `REPRO-04`'s own discipline: two launches on different
ports are different launches and are not a comparable pair, even though their pinning behaviour
is identical. The comparison above is *within* each port, never across them.

## The derivation, applied

`SCHEMA.md` § 2.1, verbatim: `pinned` iff the with-block count is `0` **and** the without-block
count is above `0`; `partial` iff the with-block count is above `0` but strictly below the
without-block count; `unpinned` iff the with-block count is at or above the without-block count.

- with-block window count = **0**
- without-block window count = **57**
- `0 === 0` and `57 > 0` → the first clause matches, both halves satisfied.

The rule is implemented as `deriveSeedEffect()` in the probe and its output is
`DERIVED_SEED_EFFECT pinned` in the transcript above, so the value is produced by the rule and
not chosen after the numbers were visible.

SEED_EFFECT: pinned

Consequence under `DECISION-RULE.md`: `R2` (`SEED_EFFECT: unpinned` → `no-go`) does **not** fire,
and `R7` (`SEED_EFFECT: partial` → `degrade`) does **not** fire. This input contributes no
narrowing.

## PROBE_DIR

Absolute paths, so a later wave can find the working artifacts (`README.md` § *Evidence
conventions* 2). Nothing binary is committed (`D-27`):

- `/home/henrik/.cache/c64-re-tools/phase33/33-11/` — the six `.vsf` snapshots, the six sliced
  `.bin` images, the six `*.boot.json` records, `repro01.run1.txt`, `preflight.txt`,
  `baseline.sh` / `baseline.txt`, `baseline-files.sh` / `baseline-files.txt`, and a per-boot
  scratch `xdg/<label>/` so no operator `vicerc` on this host could participate in either arm.
