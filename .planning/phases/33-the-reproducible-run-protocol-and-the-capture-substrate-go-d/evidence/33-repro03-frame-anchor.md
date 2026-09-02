# 33-11 · `REPRO-03` — the frame-anchor control: `(LIN, CYC)` alone observed PASSING on two genuinely different stops

Owner: plan `33-11`, Task 2. Probe: `evidence/frame-anchor-probe.mjs`.
Declared source file for `ORACLE_NECESSITY` (`SCHEMA.md` § 2; `DECISION-RULE.md` § *Inputs*).

`SCHEMA.md` § 2.3 asks for a control in which the two-term `(LIN, CYC)` projection **PASSES** on
two stops that are genuinely different, while the full four-term identity correctly reports them
different. The direction matters and § 2.3 says so: "A control in which `(LIN, CYC)` merely
*differs* proves nothing." The interesting failure is the two-term projection **agreeing** on two
different machine states.

This file records **both** forms of that control and labels which is which:

- the **literal** form the plan specifies — anchor hit `k` against anchor hit `k+1` — which was
  run, and which does **not** satisfy § 2.3's antecedent, for a measured reason;
- a **variant** form at a frame-locked, raster-conditioned probe point, which does exhibit
  § 2.3's phenomenon exactly — the two-term projection PASSES on two genuinely different stops
  and the four-term identity separates them naming `hitCount` — at a separation of more than one
  frame.

The derivation at the foot of this file applies § 2.3 **as written**, literally, and does not
loosen "exactly one frame apart" to fit the variant. Both readings and their consequences are
recorded so the findings document can apply either with full information.

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

## Both comparisons go through the shipped oracle

`compareStopIdentity()` from this tree's single stop-comparison seam, `src/mcp/vice/stop-oracle.ts`, is the
only comparison in this file (`T-33-36`). The four-term identity is a direct call. The two-term
`(LIN, CYC)` projection is expressed by **holding `pc` and `hitCount` to one shared constant on
both sides**, so those two terms cannot contribute to the verdict and only the frame term can
decide it. That is a projection *of* the shipped oracle — not a second comparison written in the
probe, and not a two-term mode flag on the oracle, which `stop-oracle.ts` deliberately does not
ship and its own header forbids adding. Not one recorded value of `line` or `cycle` is altered,
defaulted or inferred.

`ORACLE_TERMS` is `["pc","hitCount","line","cycle"]`, and every stop record in this file is
written under those names, so a reader of the record and a caller of the oracle cannot disagree
about which field is which.

## The measured obstacle: the anchor is a 60 Hz IRQ, not a frame marker

The plan's literal construction assumes that two stops one anchor hit apart are one frame apart,
and therefore land on the same raster coordinates. **On this machine they do not**, and the
survey below measures it rather than arguing it.

`$ea31` is the KERNAL IRQ entry, driven by CIA#1 timer A, which the KERNAL programs for
**60.0 Hz**. The PAL video frame is **50.125 Hz** (312 raster lines × 63 cycles = 19656 cycles).
Consecutive anchor hits are therefore one IRQ period apart, not one frame, and the raster position
drifts by about 51 lines per hit:

- **240 counted anchor hits produced 240 distinct `(LIN, CYC)` values.**
- **Zero of the 239 consecutive pairs shared a `(LIN, CYC)` value.**
- No `(LIN, CYC)` value repeated *anywhere* in the 240-hit survey
  (`ANCHOR_SURVEY_SMALLEST_REPEAT_GAP (none)`).
- The first six: `1:(257,57) 2:(206,14) 3:(154,59) 4:(103,34) 5:(52,28) 6:(0,58)`.

The arithmetic agrees with the observation: an exact repetition of the raster phase requires the
accumulated per-IRQ shift to be a whole number of frames, and with the IRQ and frame periods
coprime in cycles that first happens after **19656** anchor hits — about 328 s of emulated time,
far beyond the region `33-03` measured as frame-exact at all.

So the literal minimal form of the control is not available on this anchor. That is a fact about
the KERNAL's timer, not about the oracle.

## The frame-locked probe point, and why its condition is spelled the way it is

To obtain two stops at the **same** raster coordinates — the only way the two-term projection can
PASS — a second, frame-locked probe point is used: an Exec checkpoint at `$e5d4`, inside the
KERNAL keyboard-scan idle loop, **conditioned on the raster line**.

`$e5d4` is chosen on measurement, not on a reading of the ROM: it and its immediate neighbours
`$e5cd` / `$e5cf` / `$e5d1` were the observed halt `PC` on every monitor halt at the `READY`
prompt across this plan's probes, so it is demonstrably in the hot loop.

The condition is `(RL == $f0)`, and every part of that spelling is a project constraint:

- **`RL`, uppercase, and not `LIN`.** The register-list name `LIN` lexes as `BANKNAME` in the
  condition grammar and produces a syntax error.
- **Fully parenthesised.** Conditions have no operator precedence (`mon_parse.y:168`), so an
  unparenthesised comparison chain parses into something silently always false.
- **`$f0`, hex-prefixed.** Bare integer literals in a condition are hex by default
  (`monitor.c:1597`), so an unprefixed `240` would mean line 576.

The condition was accepted by the monitor with `condition_err=0x00` on every run, and every one of
the 60 surveyed probe hits reported `LIN 240` and `pc=$e5d4` — so the pinning is observed, not
assumed.

## The transcript — the two surveys, five dedicated stops, three comparisons, the derivation

```
$ node frame-anchor-probe.mjs run
PROBE frame-anchor-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-11
NODE v24.20.0
VICE_VERSION x64sc (VICE 3.9)
STOCK_DETERMINISM_FLAGS ["-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random"]
ORACLE_TERMS ["pc","hitCount","line","cycle"]
FRAME_ANCHOR $ea31
PROBE_POINT $e5d4 condition=(RL == $f0)
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)

--- (1) the anchor survey: 240 counted anchor hits ---------------
RUN_LABEL survey-anchor
RUN_JITTER_MS 0
RUN_STOP_AT anchor hit 240
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6513"]
ARGV_DIGEST 0de394d510b833e012b8eb93de613fd526c983002a207d4f18a397831ef3335e
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/survey-anchor
DATE_UTC 2026-09-02T23:50:06.060Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd80 LIN=0 CYC=0 jiffy=000000
ANCHOR_ARMED cp=1 at=$ea31 temporary=false hits_at_arm=0
RESET mode=hard sent=yes
SAMPLE anchor_hit=1 LIN=257 CYC=57
SAMPLE anchor_hit=2 LIN=206 CYC=14
SAMPLE anchor_hit=3 LIN=154 CYC=59
SAMPLE anchor_hit=4 LIN=103 CYC=34
SAMPLE anchor_hit=5 LIN=52 CYC=28
SAMPLE anchor_hit=6 LIN=0 CYC=58
SAMPLE anchor_hit=7 LIN=261 CYC=35
SAMPLE anchor_hit=8 LIN=210 CYC=14
SAMPLE anchor_hit=9 LIN=158 CYC=57
SAMPLE anchor_hit=10 LIN=108 CYC=14
SAMPLE anchor_hit=11 LIN=56 CYC=13
SAMPLE anchor_hit=12 LIN=4 CYC=58
SAMPLE anchor_hit=13 LIN=265 CYC=36
SAMPLE anchor_hit=14 LIN=214 CYC=15
SAMPLE anchor_hit=15 LIN=162 CYC=56
SAMPLE anchor_hit=16 LIN=111 CYC=36
SAMPLE anchor_hit=17 LIN=60 CYC=31
SAMPLE anchor_hit=18 LIN=8 CYC=56
SAMPLE anchor_hit=19 LIN=269 CYC=34
SAMPLE anchor_hit=20 LIN=218 CYC=13
SAMPLE anchor_hit=21 LIN=166 CYC=55
SAMPLE anchor_hit=22 LIN=116 CYC=15
SAMPLE anchor_hit=23 LIN=64 CYC=13
SAMPLE anchor_hit=24 LIN=12 CYC=55
SAMPLE anchor_hit=25 LIN=273 CYC=36
SAMPLE anchor_hit=26 LIN=222 CYC=16
SAMPLE anchor_hit=27 LIN=170 CYC=56
SAMPLE anchor_hit=28 LIN=119 CYC=37
SAMPLE anchor_hit=29 LIN=68 CYC=29
SAMPLE anchor_hit=30 LIN=16 CYC=56
SAMPLE anchor_hit=31 LIN=277 CYC=35
SAMPLE anchor_hit=32 LIN=226 CYC=13
SAMPLE anchor_hit=33 LIN=174 CYC=57
SAMPLE anchor_hit=34 LIN=124 CYC=15
SAMPLE anchor_hit=35 LIN=72 CYC=14
SAMPLE anchor_hit=36 LIN=20 CYC=57
SAMPLE anchor_hit=37 LIN=281 CYC=36
SAMPLE anchor_hit=38 LIN=230 CYC=16
SAMPLE anchor_hit=39 LIN=178 CYC=55
SAMPLE anchor_hit=40 LIN=127 CYC=37
SAMPLE anchor_hit=41 LIN=76 CYC=30
SAMPLE anchor_hit=42 LIN=24 CYC=55
SAMPLE anchor_hit=43 LIN=285 CYC=34
SAMPLE anchor_hit=44 LIN=234 CYC=14
SAMPLE anchor_hit=45 LIN=182 CYC=57
SAMPLE anchor_hit=46 LIN=132 CYC=15
SAMPLE anchor_hit=47 LIN=80 CYC=15
SAMPLE anchor_hit=48 LIN=28 CYC=57
SAMPLE anchor_hit=49 LIN=289 CYC=36
SAMPLE anchor_hit=50 LIN=238 CYC=15
SAMPLE anchor_hit=51 LIN=186 CYC=58
SAMPLE anchor_hit=52 LIN=135 CYC=37
SAMPLE anchor_hit=53 LIN=84 CYC=30
SAMPLE anchor_hit=54 LIN=32 CYC=55
SAMPLE anchor_hit=55 LIN=293 CYC=34
SAMPLE anchor_hit=56 LIN=242 CYC=13
SAMPLE anchor_hit=57 LIN=190 CYC=57
SAMPLE anchor_hit=58 LIN=140 CYC=15
SAMPLE anchor_hit=59 LIN=88 CYC=15
SAMPLE anchor_hit=60 LIN=36 CYC=57
SAMPLE anchor_hit=61 LIN=297 CYC=36
SAMPLE anchor_hit=62 LIN=246 CYC=16
SAMPLE anchor_hit=63 LIN=194 CYC=55
SAMPLE anchor_hit=64 LIN=143 CYC=37
SAMPLE anchor_hit=65 LIN=92 CYC=31
SAMPLE anchor_hit=66 LIN=40 CYC=58
SAMPLE anchor_hit=67 LIN=301 CYC=37
SAMPLE anchor_hit=68 LIN=250 CYC=13
SAMPLE anchor_hit=69 LIN=198 CYC=57
SAMPLE anchor_hit=70 LIN=148 CYC=15
SAMPLE anchor_hit=71 LIN=96 CYC=16
SAMPLE anchor_hit=72 LIN=44 CYC=56
SAMPLE anchor_hit=73 LIN=305 CYC=36
SAMPLE anchor_hit=74 LIN=254 CYC=14
SAMPLE anchor_hit=75 LIN=202 CYC=56
SAMPLE anchor_hit=76 LIN=151 CYC=37
SAMPLE anchor_hit=77 LIN=100 CYC=30
SAMPLE anchor_hit=78 LIN=48 CYC=58
SAMPLE anchor_hit=79 LIN=309 CYC=34
SAMPLE anchor_hit=80 LIN=258 CYC=16
SAMPLE anchor_hit=81 LIN=206 CYC=55
SAMPLE anchor_hit=82 LIN=156 CYC=15
SAMPLE anchor_hit=83 LIN=104 CYC=15
SAMPLE anchor_hit=84 LIN=52 CYC=57
SAMPLE anchor_hit=85 LIN=1 CYC=36
SAMPLE anchor_hit=86 LIN=262 CYC=14
SAMPLE anchor_hit=87 LIN=210 CYC=56
SAMPLE anchor_hit=88 LIN=159 CYC=37
SAMPLE anchor_hit=89 LIN=108 CYC=30
SAMPLE anchor_hit=90 LIN=56 CYC=58
SAMPLE anchor_hit=91 LIN=5 CYC=34
SAMPLE anchor_hit=92 LIN=266 CYC=15
SAMPLE anchor_hit=93 LIN=214 CYC=57
SAMPLE anchor_hit=94 LIN=164 CYC=15
SAMPLE anchor_hit=95 LIN=112 CYC=16
SAMPLE anchor_hit=96 LIN=60 CYC=57
SAMPLE anchor_hit=97 LIN=9 CYC=36
SAMPLE anchor_hit=98 LIN=270 CYC=14
SAMPLE anchor_hit=99 LIN=218 CYC=56
SAMPLE anchor_hit=100 LIN=167 CYC=37
SAMPLE anchor_hit=101 LIN=116 CYC=30
SAMPLE anchor_hit=102 LIN=64 CYC=55
SAMPLE anchor_hit=103 LIN=13 CYC=37
SAMPLE anchor_hit=104 LIN=274 CYC=15
SAMPLE anchor_hit=105 LIN=222 CYC=55
SAMPLE anchor_hit=106 LIN=172 CYC=15
SAMPLE anchor_hit=107 LIN=120 CYC=15
SAMPLE anchor_hit=108 LIN=68 CYC=55
SAMPLE anchor_hit=109 LIN=17 CYC=35
SAMPLE anchor_hit=110 LIN=278 CYC=14
SAMPLE anchor_hit=111 LIN=226 CYC=56
SAMPLE anchor_hit=112 LIN=175 CYC=36
SAMPLE anchor_hit=113 LIN=124 CYC=31
SAMPLE anchor_hit=114 LIN=72 CYC=57
SAMPLE anchor_hit=115 LIN=21 CYC=36
SAMPLE anchor_hit=116 LIN=282 CYC=15
SAMPLE anchor_hit=117 LIN=230 CYC=55
SAMPLE anchor_hit=118 LIN=180 CYC=15
SAMPLE anchor_hit=119 LIN=128 CYC=13
SAMPLE anchor_hit=120 LIN=76 CYC=56
SAMPLE anchor_hit=121 LIN=25 CYC=35
SAMPLE anchor_hit=122 LIN=286 CYC=14
SAMPLE anchor_hit=123 LIN=234 CYC=56
SAMPLE anchor_hit=124 LIN=183 CYC=36
SAMPLE anchor_hit=125 LIN=132 CYC=31
SAMPLE anchor_hit=126 LIN=80 CYC=57
SAMPLE anchor_hit=127 LIN=29 CYC=36
SAMPLE anchor_hit=128 LIN=290 CYC=13
SAMPLE anchor_hit=129 LIN=238 CYC=57
SAMPLE anchor_hit=130 LIN=188 CYC=15
SAMPLE anchor_hit=131 LIN=136 CYC=13
SAMPLE anchor_hit=132 LIN=84 CYC=56
SAMPLE anchor_hit=133 LIN=33 CYC=34
SAMPLE anchor_hit=134 LIN=294 CYC=14
SAMPLE anchor_hit=135 LIN=242 CYC=55
SAMPLE anchor_hit=136 LIN=191 CYC=37
SAMPLE anchor_hit=137 LIN=140 CYC=31
SAMPLE anchor_hit=138 LIN=88 CYC=57
SAMPLE anchor_hit=139 LIN=37 CYC=36
SAMPLE anchor_hit=140 LIN=298 CYC=16
SAMPLE anchor_hit=141 LIN=246 CYC=57
SAMPLE anchor_hit=142 LIN=196 CYC=15
SAMPLE anchor_hit=143 LIN=144 CYC=13
SAMPLE anchor_hit=144 LIN=92 CYC=56
SAMPLE anchor_hit=145 LIN=41 CYC=37
SAMPLE anchor_hit=146 LIN=302 CYC=14
SAMPLE anchor_hit=147 LIN=250 CYC=58
SAMPLE anchor_hit=148 LIN=199 CYC=37
SAMPLE anchor_hit=149 LIN=148 CYC=31
SAMPLE anchor_hit=150 LIN=96 CYC=55
SAMPLE anchor_hit=151 LIN=45 CYC=35
SAMPLE anchor_hit=152 LIN=306 CYC=15
SAMPLE anchor_hit=153 LIN=254 CYC=56
SAMPLE anchor_hit=154 LIN=204 CYC=15
SAMPLE anchor_hit=155 LIN=152 CYC=13
SAMPLE anchor_hit=156 LIN=100 CYC=56
SAMPLE anchor_hit=157 LIN=49 CYC=34
SAMPLE anchor_hit=158 LIN=310 CYC=14
SAMPLE anchor_hit=159 LIN=258 CYC=55
SAMPLE anchor_hit=160 LIN=207 CYC=37
SAMPLE anchor_hit=161 LIN=156 CYC=31
SAMPLE anchor_hit=162 LIN=104 CYC=57
SAMPLE anchor_hit=163 LIN=53 CYC=36
SAMPLE anchor_hit=164 LIN=2 CYC=15
SAMPLE anchor_hit=165 LIN=262 CYC=56
SAMPLE anchor_hit=166 LIN=212 CYC=15
SAMPLE anchor_hit=167 LIN=160 CYC=13
SAMPLE anchor_hit=168 LIN=108 CYC=57
SAMPLE anchor_hit=169 LIN=57 CYC=35
SAMPLE anchor_hit=170 LIN=6 CYC=15
SAMPLE anchor_hit=171 LIN=266 CYC=55
SAMPLE anchor_hit=172 LIN=215 CYC=36
SAMPLE anchor_hit=173 LIN=164 CYC=31
SAMPLE anchor_hit=174 LIN=112 CYC=55
SAMPLE anchor_hit=175 LIN=61 CYC=36
SAMPLE anchor_hit=176 LIN=10 CYC=15
SAMPLE anchor_hit=177 LIN=270 CYC=56
SAMPLE anchor_hit=178 LIN=220 CYC=15
SAMPLE anchor_hit=179 LIN=168 CYC=13
SAMPLE anchor_hit=180 LIN=116 CYC=56
SAMPLE anchor_hit=181 LIN=65 CYC=35
SAMPLE anchor_hit=182 LIN=14 CYC=13
SAMPLE anchor_hit=183 LIN=274 CYC=57
SAMPLE anchor_hit=184 LIN=223 CYC=37
SAMPLE anchor_hit=185 LIN=172 CYC=31
SAMPLE anchor_hit=186 LIN=120 CYC=57
SAMPLE anchor_hit=187 LIN=69 CYC=36
SAMPLE anchor_hit=188 LIN=18 CYC=13
SAMPLE anchor_hit=189 LIN=278 CYC=56
SAMPLE anchor_hit=190 LIN=228 CYC=14
SAMPLE anchor_hit=191 LIN=176 CYC=13
SAMPLE anchor_hit=192 LIN=124 CYC=56
SAMPLE anchor_hit=193 LIN=73 CYC=34
SAMPLE anchor_hit=194 LIN=22 CYC=16
SAMPLE anchor_hit=195 LIN=282 CYC=57
SAMPLE anchor_hit=196 LIN=231 CYC=37
SAMPLE anchor_hit=197 LIN=180 CYC=30
SAMPLE anchor_hit=198 LIN=128 CYC=58
SAMPLE anchor_hit=199 LIN=77 CYC=36
SAMPLE anchor_hit=200 LIN=26 CYC=14
SAMPLE anchor_hit=201 LIN=286 CYC=57
SAMPLE anchor_hit=202 LIN=236 CYC=14
SAMPLE anchor_hit=203 LIN=184 CYC=13
SAMPLE anchor_hit=204 LIN=132 CYC=57
SAMPLE anchor_hit=205 LIN=81 CYC=37
SAMPLE anchor_hit=206 LIN=30 CYC=15
SAMPLE anchor_hit=207 LIN=290 CYC=58
SAMPLE anchor_hit=208 LIN=239 CYC=37
SAMPLE anchor_hit=209 LIN=188 CYC=30
SAMPLE anchor_hit=210 LIN=136 CYC=55
SAMPLE anchor_hit=211 LIN=85 CYC=35
SAMPLE anchor_hit=212 LIN=34 CYC=13
SAMPLE anchor_hit=213 LIN=294 CYC=56
SAMPLE anchor_hit=214 LIN=244 CYC=15
SAMPLE anchor_hit=215 LIN=192 CYC=13
SAMPLE anchor_hit=216 LIN=140 CYC=57
SAMPLE anchor_hit=217 LIN=89 CYC=37
SAMPLE anchor_hit=218 LIN=38 CYC=15
SAMPLE anchor_hit=219 LIN=298 CYC=55
SAMPLE anchor_hit=220 LIN=247 CYC=36
SAMPLE anchor_hit=221 LIN=196 CYC=31
SAMPLE anchor_hit=222 LIN=144 CYC=58
SAMPLE anchor_hit=223 LIN=93 CYC=36
SAMPLE anchor_hit=224 LIN=42 CYC=13
SAMPLE anchor_hit=225 LIN=302 CYC=56
SAMPLE anchor_hit=226 LIN=251 CYC=34
SAMPLE anchor_hit=227 LIN=200 CYC=13
SAMPLE anchor_hit=228 LIN=148 CYC=57
SAMPLE anchor_hit=229 LIN=97 CYC=37
SAMPLE anchor_hit=230 LIN=46 CYC=15
SAMPLE anchor_hit=231 LIN=306 CYC=58
SAMPLE anchor_hit=232 LIN=255 CYC=36
SAMPLE anchor_hit=233 LIN=204 CYC=31
SAMPLE anchor_hit=234 LIN=152 CYC=55
SAMPLE anchor_hit=235 LIN=101 CYC=35
SAMPLE anchor_hit=236 LIN=50 CYC=16
SAMPLE anchor_hit=237 LIN=310 CYC=56
SAMPLE anchor_hit=238 LIN=259 CYC=37
SAMPLE anchor_hit=239 LIN=208 CYC=13
SAMPLE anchor_hit=240 LIN=156 CYC=57
COUNTED resumes=240 anchor_hits=240 probe_hits=0
STOP PC=$ea31 hit_count=240 LIN=156 CYC=57
POST_X64SC (none)
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/survey-anchor.frame.json usable=true

--- the anchor survey's analysis -------------------------------------
ANCHOR_SURVEY_SAMPLES 240
ANCHOR_SURVEY_DISTINCT_LIN_CYC 240
ANCHOR_SURVEY_CONSECUTIVE_PAIRS 239
ANCHOR_SURVEY_CONSECUTIVE_PAIRS_WITH_EQUAL_LIN_CYC 0
ANCHOR_SURVEY_FIRST_SIX 1:(257,57) 2:(206,14) 3:(154,59) 4:(103,34) 5:(52,28) 6:(0,58)
ANCHOR_SURVEY_SMALLEST_REPEAT_GAP (none -- no (LIN, CYC) value repeated anywhere in the survey)

--- (2) the LITERAL control: anchor hit 50 against anchor hit 51 -------
RUN_LABEL lit-anchor50-j0
RUN_JITTER_MS 0
RUN_STOP_AT anchor hit 50
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6513"]
ARGV_DIGEST 0de394d510b833e012b8eb93de613fd526c983002a207d4f18a397831ef3335e
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/lit-anchor50-j0
DATE_UTC 2026-09-02T23:50:16.839Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd84 LIN=0 CYC=1 jiffy=000000
ANCHOR_ARMED cp=1 at=$ea31 temporary=false hits_at_arm=0
RESET mode=hard sent=yes
COUNTED resumes=50 anchor_hits=50 probe_hits=0
STOP PC=$ea31 hit_count=50 LIN=238 CYC=15
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor50-j0.vsf err=0x00 size=193261
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor50-j0.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor50-j0.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor50-j0.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor50-j0.bin","imageBytes":65536,"sha256":"f7c12d1e8bf404d2a66731fb8024fdf96b9a4ccdb9561ac7edb4cf576127806a","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor50-j0.bin bytes=65536 sha256=f7c12d1e8bf404d2a66731fb8024fdf96b9a4ccdb9561ac7edb4cf576127806a
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor50-j0.frame.json usable=true
RUN_LABEL lit-anchor51-j0
RUN_JITTER_MS 0
RUN_STOP_AT anchor hit 51
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6513"]
ARGV_DIGEST 0de394d510b833e012b8eb93de613fd526c983002a207d4f18a397831ef3335e
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/lit-anchor51-j0
DATE_UTC 2026-09-02T23:50:25.035Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd7e LIN=0 CYC=1 jiffy=000000
ANCHOR_ARMED cp=1 at=$ea31 temporary=false hits_at_arm=0
RESET mode=hard sent=yes
COUNTED resumes=51 anchor_hits=51 probe_hits=0
STOP PC=$ea31 hit_count=51 LIN=186 CYC=58
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor51-j0.vsf err=0x00 size=193261
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor51-j0.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor51-j0.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor51-j0.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor51-j0.bin","imageBytes":65536,"sha256":"ace9415073beb33c9dbf169a1f1e8066a480c67e0b61df79ace6d57697346ad6","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor51-j0.bin bytes=65536 sha256=ace9415073beb33c9dbf169a1f1e8066a480c67e0b61df79ace6d57697346ad6
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/lit-anchor51-j0.frame.json usable=true

LITERAL_STOP_A lit-anchor50-j0 {"pc":59953,"hitCount":50,"line":238,"cycle":15} sha256=f7c12d1e8bf404d2a66731fb8024fdf96b9a4ccdb9561ac7edb4cf576127806a
LITERAL_STOP_B lit-anchor51-j0 {"pc":59953,"hitCount":51,"line":186,"cycle":58} sha256=ace9415073beb33c9dbf169a1f1e8066a480c67e0b61df79ace6d57697346ad6
LITERAL_TWO_TERM_PROJECTION {"identical":false,"differingTerms":["line","cycle"],"frameTermAsserted":true}
LITERAL_TWO_TERM_VERDICT differs -- it separates them, which per SCHEMA.md 2.3 proves nothing
LITERAL_FOUR_TERM_IDENTITY {"identical":false,"differingTerms":["hitCount","line","cycle"],"frameTermAsserted":true}
LITERAL_FOUR_TERM_DIFFERING_TERMS hitCount,line,cycle
LITERAL_IMAGE_DIFF differing_bytes=2 first=$00a2 $00cd
LITERAL_IMAGE_SHA_EQUAL no
LITERAL_SEPARATION one anchor hit -- which is one 60 Hz IRQ period, NOT one 50.125 Hz video frame

--- (3) the conditioned-probe survey ---------------------------------
RUN_LABEL survey-probe
RUN_JITTER_MS 0
RUN_STOP_AT probe hit 60 (conditioned (RL == $f0) at $e5d4)
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6513"]
ARGV_DIGEST 0de394d510b833e012b8eb93de613fd526c983002a207d4f18a397831ef3335e
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/survey-probe
DATE_UTC 2026-09-02T23:50:33.294Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd80 LIN=0 CYC=0 jiffy=000000
ANCHOR_ARMED cp=1 at=$ea31 temporary=false hits_at_arm=0
PROBE_ARMED cp=2 at=$e5d4 condition=(RL == $f0) condition_err=0x00
RESET mode=hard sent=yes
SAMPLE anchor_hit=1 LIN=257 CYC=57
SAMPLE anchor_hit=2 LIN=206 CYC=14
SAMPLE anchor_hit=3 LIN=154 CYC=59
SAMPLE anchor_hit=4 LIN=103 CYC=34
SAMPLE anchor_hit=5 LIN=52 CYC=28
SAMPLE anchor_hit=6 LIN=0 CYC=58
SAMPLE probe_hit=1 anchor_hit=6 pc=$e5d4 LIN=240 CYC=6
SAMPLE probe_hit=2 anchor_hit=6 pc=$e5d4 LIN=240 CYC=19
SAMPLE probe_hit=3 anchor_hit=6 pc=$e5d4 LIN=240 CYC=32
SAMPLE probe_hit=4 anchor_hit=6 pc=$e5d4 LIN=240 CYC=45
SAMPLE probe_hit=5 anchor_hit=6 pc=$e5d4 LIN=240 CYC=58
SAMPLE anchor_hit=7 LIN=261 CYC=35
SAMPLE anchor_hit=8 LIN=210 CYC=14
SAMPLE probe_hit=6 anchor_hit=8 pc=$e5d4 LIN=240 CYC=3
SAMPLE probe_hit=7 anchor_hit=8 pc=$e5d4 LIN=240 CYC=16
SAMPLE probe_hit=8 anchor_hit=8 pc=$e5d4 LIN=240 CYC=29
SAMPLE probe_hit=9 anchor_hit=8 pc=$e5d4 LIN=240 CYC=42
SAMPLE probe_hit=10 anchor_hit=8 pc=$e5d4 LIN=240 CYC=55
SAMPLE anchor_hit=9 LIN=158 CYC=57
SAMPLE probe_hit=11 anchor_hit=9 pc=$e5d4 LIN=240 CYC=10
SAMPLE probe_hit=12 anchor_hit=9 pc=$e5d4 LIN=240 CYC=23
SAMPLE probe_hit=13 anchor_hit=9 pc=$e5d4 LIN=240 CYC=36
SAMPLE probe_hit=14 anchor_hit=9 pc=$e5d4 LIN=240 CYC=49
SAMPLE probe_hit=15 anchor_hit=9 pc=$e5d4 LIN=240 CYC=62
SAMPLE anchor_hit=10 LIN=108 CYC=14
SAMPLE probe_hit=16 anchor_hit=10 pc=$e5d4 LIN=240 CYC=12
SAMPLE probe_hit=17 anchor_hit=10 pc=$e5d4 LIN=240 CYC=25
SAMPLE probe_hit=18 anchor_hit=10 pc=$e5d4 LIN=240 CYC=38
SAMPLE probe_hit=19 anchor_hit=10 pc=$e5d4 LIN=240 CYC=51
SAMPLE anchor_hit=11 LIN=56 CYC=13
SAMPLE probe_hit=20 anchor_hit=11 pc=$e5d4 LIN=240 CYC=3
SAMPLE probe_hit=21 anchor_hit=11 pc=$e5d4 LIN=240 CYC=16
SAMPLE probe_hit=22 anchor_hit=11 pc=$e5d4 LIN=240 CYC=29
SAMPLE probe_hit=23 anchor_hit=11 pc=$e5d4 LIN=240 CYC=42
SAMPLE probe_hit=24 anchor_hit=11 pc=$e5d4 LIN=240 CYC=55
SAMPLE anchor_hit=12 LIN=4 CYC=58
SAMPLE probe_hit=25 anchor_hit=12 pc=$e5d4 LIN=240 CYC=6
SAMPLE probe_hit=26 anchor_hit=12 pc=$e5d4 LIN=240 CYC=19
SAMPLE probe_hit=27 anchor_hit=12 pc=$e5d4 LIN=240 CYC=32
SAMPLE probe_hit=28 anchor_hit=12 pc=$e5d4 LIN=240 CYC=45
SAMPLE probe_hit=29 anchor_hit=12 pc=$e5d4 LIN=240 CYC=58
SAMPLE anchor_hit=13 LIN=265 CYC=36
SAMPLE anchor_hit=14 LIN=214 CYC=15
SAMPLE probe_hit=30 anchor_hit=14 pc=$e5d4 LIN=240 CYC=3
SAMPLE probe_hit=31 anchor_hit=14 pc=$e5d4 LIN=240 CYC=16
SAMPLE probe_hit=32 anchor_hit=14 pc=$e5d4 LIN=240 CYC=29
SAMPLE probe_hit=33 anchor_hit=14 pc=$e5d4 LIN=240 CYC=42
SAMPLE probe_hit=34 anchor_hit=14 pc=$e5d4 LIN=240 CYC=55
SAMPLE anchor_hit=15 LIN=162 CYC=56
SAMPLE probe_hit=35 anchor_hit=15 pc=$e5d4 LIN=240 CYC=10
SAMPLE probe_hit=36 anchor_hit=15 pc=$e5d4 LIN=240 CYC=23
SAMPLE probe_hit=37 anchor_hit=15 pc=$e5d4 LIN=240 CYC=36
SAMPLE probe_hit=38 anchor_hit=15 pc=$e5d4 LIN=240 CYC=49
SAMPLE probe_hit=39 anchor_hit=15 pc=$e5d4 LIN=240 CYC=62
SAMPLE anchor_hit=16 LIN=111 CYC=36
SAMPLE probe_hit=40 anchor_hit=16 pc=$e5d4 LIN=240 CYC=12
SAMPLE probe_hit=41 anchor_hit=16 pc=$e5d4 LIN=240 CYC=25
SAMPLE probe_hit=42 anchor_hit=16 pc=$e5d4 LIN=240 CYC=38
SAMPLE probe_hit=43 anchor_hit=16 pc=$e5d4 LIN=240 CYC=51
SAMPLE anchor_hit=17 LIN=60 CYC=31
SAMPLE probe_hit=44 anchor_hit=17 pc=$e5d4 LIN=240 CYC=3
SAMPLE probe_hit=45 anchor_hit=17 pc=$e5d4 LIN=240 CYC=16
SAMPLE probe_hit=46 anchor_hit=17 pc=$e5d4 LIN=240 CYC=29
SAMPLE probe_hit=47 anchor_hit=17 pc=$e5d4 LIN=240 CYC=42
SAMPLE probe_hit=48 anchor_hit=17 pc=$e5d4 LIN=240 CYC=55
SAMPLE anchor_hit=18 LIN=8 CYC=56
SAMPLE probe_hit=49 anchor_hit=18 pc=$e5d4 LIN=240 CYC=6
SAMPLE probe_hit=50 anchor_hit=18 pc=$e5d4 LIN=240 CYC=19
SAMPLE probe_hit=51 anchor_hit=18 pc=$e5d4 LIN=240 CYC=32
SAMPLE probe_hit=52 anchor_hit=18 pc=$e5d4 LIN=240 CYC=45
SAMPLE probe_hit=53 anchor_hit=18 pc=$e5d4 LIN=240 CYC=58
SAMPLE anchor_hit=19 LIN=269 CYC=34
SAMPLE anchor_hit=20 LIN=218 CYC=13
SAMPLE probe_hit=54 anchor_hit=20 pc=$e5d4 LIN=240 CYC=3
SAMPLE probe_hit=55 anchor_hit=20 pc=$e5d4 LIN=240 CYC=16
SAMPLE probe_hit=56 anchor_hit=20 pc=$e5d4 LIN=240 CYC=29
SAMPLE probe_hit=57 anchor_hit=20 pc=$e5d4 LIN=240 CYC=42
SAMPLE probe_hit=58 anchor_hit=20 pc=$e5d4 LIN=240 CYC=55
SAMPLE anchor_hit=21 LIN=166 CYC=55
SAMPLE probe_hit=59 anchor_hit=21 pc=$e5d4 LIN=240 CYC=10
SAMPLE probe_hit=60 anchor_hit=21 pc=$e5d4 LIN=240 CYC=23
COUNTED resumes=81 anchor_hits=21 probe_hits=60
STOP PC=$e5d4 hit_count=21 LIN=240 CYC=23
POST_X64SC (none)
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/survey-probe.frame.json usable=true

--- the conditioned probe survey's analysis --------------------------
PROBE_SURVEY_SAMPLES 60
PROBE_SURVEY_DISTINCT_LINES 240
PROBE_SURVEY_DISTINCT_PCS $e5d4
PROBE_SURVEY_SMALLEST_EQUAL_RASTER_PAIR probe hits 20 and 30 both at pc=$e5d4 (LIN 240, CYC 3), anchor hit counts 11 and 14, probe-hit gap 10

--- (4) the VARIANT control: probe hit 20 against probe hit 30 ----------
RUN_LABEL var-probe20-j0
RUN_JITTER_MS 0
RUN_STOP_AT probe hit 20 (conditioned (RL == $f0) at $e5d4)
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6513"]
ARGV_DIGEST 0de394d510b833e012b8eb93de613fd526c983002a207d4f18a397831ef3335e
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/var-probe20-j0
DATE_UTC 2026-09-02T23:50:40.834Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd83 LIN=0 CYC=5 jiffy=000000
ANCHOR_ARMED cp=1 at=$ea31 temporary=false hits_at_arm=0
PROBE_ARMED cp=2 at=$e5d4 condition=(RL == $f0) condition_err=0x00
RESET mode=hard sent=yes
COUNTED resumes=31 anchor_hits=11 probe_hits=20
STOP PC=$e5d4 hit_count=11 LIN=240 CYC=3
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j0.vsf err=0x00 size=193261
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j0.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j0.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j0.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j0.bin","imageBytes":65536,"sha256":"126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j0.bin bytes=65536 sha256=126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j0.frame.json usable=true
RUN_LABEL var-probe30-j0
RUN_JITTER_MS 0
RUN_STOP_AT probe hit 30 (conditioned (RL == $f0) at $e5d4)
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6513"]
ARGV_DIGEST 0de394d510b833e012b8eb93de613fd526c983002a207d4f18a397831ef3335e
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/var-probe30-j0
DATE_UTC 2026-09-02T23:50:48.807Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$fd80 LIN=0 CYC=0 jiffy=000000
ANCHOR_ARMED cp=1 at=$ea31 temporary=false hits_at_arm=0
PROBE_ARMED cp=2 at=$e5d4 condition=(RL == $f0) condition_err=0x00
RESET mode=hard sent=yes
COUNTED resumes=44 anchor_hits=14 probe_hits=30
STOP PC=$e5d4 hit_count=14 LIN=240 CYC=3
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe30-j0.vsf err=0x00 size=193261
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe30-j0.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe30-j0.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe30-j0.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe30-j0.bin","imageBytes":65536,"sha256":"f46751d331cbe79ae7ad3c1beabc726bf5bc487e5025a72df259ca201de3e090","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe30-j0.bin bytes=65536 sha256=f46751d331cbe79ae7ad3c1beabc726bf5bc487e5025a72df259ca201de3e090
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe30-j0.frame.json usable=true

--- (5) the same-frame positive: probe hit 20 again at jitter 2500 --------
RUN_LABEL var-probe20-j2500
RUN_JITTER_MS 2500
RUN_STOP_AT probe hit 20 (conditioned (RL == $f0) at $e5d4)
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6513"]
ARGV_DIGEST 0de394d510b833e012b8eb93de613fd526c983002a207d4f18a397831ef3335e
XDG_CONFIG_HOME /home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/var-probe20-j2500
DATE_UTC 2026-09-02T23:50:56.407Z
MONITOR_READY_AFTER_PINGS 1
PRE_PROTOCOL pc=$e5d4 LIN=0 CYC=1 jiffy=00003b
ANCHOR_ARMED cp=1 at=$ea31 temporary=false hits_at_arm=0
PROBE_ARMED cp=2 at=$e5d4 condition=(RL == $f0) condition_err=0x00
RESET mode=hard sent=yes
COUNTED resumes=31 anchor_hits=11 probe_hits=20
STOP PC=$e5d4 hit_count=11 LIN=240 CYC=3
SNAPSHOT /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j2500.vsf err=0x00 size=193261
POST_X64SC (none)
$ node /home/henrik/dev/henrik/git/c64-re-tools/src/skills/c64-ram-capture/scripts/vsf-slice.mjs slice /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j2500.vsf --out /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j2500.bin --json
{"snapshot":"/home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j2500.vsf","out":"/home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j2500.bin","imageBytes":65536,"sha256":"126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f","snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
IMAGE /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j2500.bin bytes=65536 sha256=126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-11/var-probe20-j2500.frame.json usable=true

VOIDED_RUNS (none)

--- the variant pair --------------------------------------------------
VARIANT_STOP_A var-probe20-j0 {"pc":58836,"hitCount":11,"line":240,"cycle":3} sha256=126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f
VARIANT_STOP_B var-probe30-j0 {"pc":58836,"hitCount":14,"line":240,"cycle":3} sha256=f46751d331cbe79ae7ad3c1beabc726bf5bc487e5025a72df259ca201de3e090
VARIANT_TWO_TERM_PROJECTION {"identical":true,"differingTerms":[],"frameTermAsserted":true}
VARIANT_TWO_TERM_VERDICT PASSES -- it certifies the two stops as the SAME stop
VARIANT_FOUR_TERM_IDENTITY {"identical":false,"differingTerms":["hitCount"],"frameTermAsserted":true}
VARIANT_FOUR_TERM_DIFFERING_TERMS hitCount
VARIANT_IMAGE_DIFF differing_bytes=3 first=$00a2 $00cd $01f2
VARIANT_IMAGE_SHA_EQUAL no
VARIANT_SEPARATION equal raster coordinates, so an exact INTEGRAL number of video frames -- 10 probe hits apart, anchor hit counts 11 and 14

--- the same-frame positive ------------------------------------------
SAMEFRAME_STOP_A var-probe20-j0 {"pc":58836,"hitCount":11,"line":240,"cycle":3} sha256=126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f
SAMEFRAME_STOP_B var-probe20-j2500 {"pc":58836,"hitCount":11,"line":240,"cycle":3} sha256=126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f
SAMEFRAME_TWO_TERM_PROJECTION {"identical":true,"differingTerms":[],"frameTermAsserted":true}
SAMEFRAME_TWO_TERM_VERDICT PASSES -- it certifies the two stops as the SAME stop
SAMEFRAME_FOUR_TERM_IDENTITY {"identical":true,"differingTerms":[],"frameTermAsserted":true}
SAMEFRAME_FOUR_TERM_DIFFERING_TERMS (none)
SAMEFRAME_IMAGE_DIFF differing_bytes=0 first=(none)
SAMEFRAME_IMAGE_SHA_EQUAL yes

--- the derivation ---------------------------------------------------
CONJUNCT_0_ONE_FRAME_APART_PAIR_EXISTS no
CONJUNCT_1_TWO_TERM_PASSES_ON_VARIANT_PAIR yes
CONJUNCT_2_FOUR_TERM_SEPARATES_VARIANT_PAIR yes (differing: hitCount)
CONJUNCT_3_SAME_FRAME_PAIR_UNIFIED yes
DERIVED_ORACLE_NECESSITY unproven
FAILING_CONJUNCT no pair of stops EXACTLY ONE FRAME APART was produced -- the anchor is a 60 Hz IRQ against a 50.125 Hz frame, so consecutive anchor hits are never at the same raster coordinates (MEASURED: 240 hits, 240 distinct (LIN, CYC), 0 consecutive repeats)
ALTERNATIVE_READING if "exactly one frame apart" is read as "an integral number of frames apart", the variant pair satisfies every conjunct and the derivation yields proven; this file records both readings and does NOT choose for the findings document
```

## The literal control — run, and reported honestly as not satisfying the antecedent

Two dedicated runs under the full protocol, each with its own `DUMP` and sliced 64K sha256, at
anchor hit **50** and anchor hit **51**:

| Stop | Four terms `(PC, hit_count, LIN, CYC)` | Sliced 64K sha256 |
|---|---|---|
| `lit-anchor50-j0` | `($ea31, 50, 238, 15)` | `f7c12d1e8bf404d2a66731fb8024fdf96b9a4ccdb9561ac7edb4cf576127806a` |
| `lit-anchor51-j0` | `($ea31, 51, 186, 58)` | `ace9415073beb33c9dbf169a1f1e8066a480c67e0b61df79ace6d57697346ad6` |

- two-term `(LIN, CYC)` projection: `{"identical":false,"differingTerms":["line","cycle"]}` — it
  **differs**, so it separates the pair.
- four-term identity: `{"identical":false,"differingTerms":["hitCount","line","cycle"]}`.
- sliced images: 2 differing bytes, at `$00a2` and `$00cd` — the jiffy clock's low byte and a
  screen-editor variable, i.e. exactly the one-IRQ-of-elapsed-time signature.

**This does not satisfy § 2.3.** Its own words: "A control in which `(LIN, CYC)` merely *differs*
proves nothing." The literal form was produced and it lands on the wrong side of the antecedent,
for the measured reason above. Recorded rather than retried, and recorded rather than replaced
silently by the variant.

## The variant control — `(LIN, CYC)` alone observed PASSING

Two dedicated runs at the frame-locked probe point, stopping at probe hit **20** and probe hit
**30**. The pair was selected by the probe survey as the smallest probe-hit gap at which the
raster coordinates repeat **and** the frame term differs — a rule in the code
(`PROBE_SURVEY_SMALLEST_EQUAL_RASTER_PAIR`), not a choice made after seeing the comparison.

| Stop | Four terms `(PC, hit_count, LIN, CYC)` | Sliced 64K sha256 |
|---|---|---|
| `var-probe20-j0` | `($e5d4, 11, 240, 3)` | `126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f` |
| `var-probe30-j0` | `($e5d4, 14, 240, 3)` | `f46751d331cbe79ae7ad3c1beabc726bf5bc487e5025a72df259ca201de3e090` |

**The red.** The two-term projection returns
`{"identical":true,"differingTerms":[],"frameTermAsserted":true}` — it **PASSES**, and in
passing it certifies these two stops as the same stop.

**The positive beside it.** The full four-term identity returns
`{"identical":false,"differingTerms":["hitCount"],"frameTermAsserted":true}` — it correctly
reports them different, and the differing term is **`hitCount`**, named by the shipped oracle
itself.

**The direct demonstration that the two stops really are different states.** The sliced 64K
images differ at **3** bytes — `$00a2`, `$00cd`, `$01f2` — and the two sha256 values are
different (`VARIANT_IMAGE_SHA_EQUAL no`). So the two-term projection's PASS was certifying two
genuinely distinct machine states as one stop. That is the whole content of the control.

The separation is **equal raster coordinates**, which on a machine with no monotonic cycle
register is exactly what "an integral number of video frames apart" means — there is no other
way to express it, and stock VICE below 3.10 has no cycle counter to express it with. In anchor
hits the two stops are 11 against 14; in probe hits, 10 apart.

## The second positive — the four-term identity is not an assertion that never passes

Without this, a four-term comparison that reported "different" on every input would look like a
working oracle. So the same stop was taken again at a **different pre-protocol jitter**:

| Stop | Four terms | Sliced 64K sha256 |
|---|---|---|
| `var-probe20-j0` | `($e5d4, 11, 240, 3)` | `126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f` |
| `var-probe20-j2500` | `($e5d4, 11, 240, 3)` | `126fa665a901344a500e554fe892065b7dbfc038eea60dbe40a1fb508bad488f` |

Four-term identity: `{"identical":true,"differingTerms":[],"frameTermAsserted":true}`. Sliced
images: **0** differing bytes, one identical sha256. The oracle unifies a same-frame pair taken at
two different jitters, so its separation of the variant pair is discrimination and not
strictness — and this is a second, independent confirmation of `JITTER_IMMUNITY: immune` at a
much later stop (probe hit 20, anchor hit 11) than the jitter triple's anchor hit 1.

## Voided runs

VOIDED_RUNS: none — all seven runs in the reported transcript (two surveys and five dedicated
stops) produced their stop, and the five dedicated stops each produced a usable 65536-byte image
(`VOIDED_RUNS (none)`). The earlier exploratory survey at
`/home/henrik/.cache/c64-re-tools/phase33/33-11/repro03.survey1.txt` is retained: it is the
240-hit anchor survey taken before the conditioned probe point existed, and its analysis agrees
with the reported run's (240 samples, 240 distinct `(LIN, CYC)`, 0 consecutive repeats).

## The derivation, applied

`SCHEMA.md` § 2.3, verbatim: `proven` iff a committed control shows `(LIN, CYC)` alone PASSING on
two stops **exactly one frame apart**, while the full triple correctly reports those two stops as
different; `unproven` otherwise — "**including when no such pair was produced at all**".

Walked conjunct by conjunct, as the probe walks it:

| Conjunct | Observed |
|---|---|
| a pair of stops **exactly one frame apart** exists | **no** — 240 anchor hits, 240 distinct `(LIN, CYC)`, 0 consecutive repeats; the minimum equal-raster separation reachable on this build is 2 frames |
| the two-term projection PASSES on the candidate pair | yes (`VARIANT_TWO_TERM_PROJECTION identical:true`) |
| the four-term identity separates the candidate pair | yes, differing term `hitCount` |
| the four-term identity unifies a same-frame pair | yes, 0 differing bytes |

The first conjunct fails, and § 2.3's closing clause is what makes its failure decisive rather
than arguable.

ORACLE_NECESSITY: unproven

Consequence under `DECISION-RULE.md`: **`R6` fires** — `ORACLE_NECESSITY: unproven` → `degrade`,
with the narrowing already pre-mapped by `D-04`: the oracle narrows to the two-term
`(PC, hit_count)` form with the frame term **recorded but not asserted**, and every downstream
capture pair carries that weakening in its own record.

Worth stating plainly, because it is the one place this file's evidence and the rule it feeds
point the same way: **the narrowing `R6` prescribes is well supported by what was measured here.**
On the variant pair the frame term contributed nothing — `(LIN, CYC)` was identical on two
genuinely different stops — and the term that separated them was `hit_count`. A `(PC, hit_count)`
oracle with the frame term recorded but not asserted would have got this pair right. `R6` is not
a penalty imposed by a missing measurement; it is the correct response to the measurement that
was taken.

## ACCEPTED LIMIT — "exactly one frame apart", and the alternative reading

Two ambiguities in the frozen text, recorded here rather than resolved there
(`SCHEMA.md`'s own instruction, and `DECISION-RULE.md` § *Status*).

**1. The alternative reading of the antecedent.** If "two stops **exactly one frame apart**" is
read as "two stops an **integral number of frames** apart" — which is what § 2.3's own stated
rationale describes, "the raster position is a position *modulo the frame*, so two stops one
frame apart land at the same raster coordinates" — then the variant pair satisfies every
conjunct and the derivation yields **`proven`**, `R6` does not fire, and this input contributes no
narrowing.

This file derives `unproven` on the strict reading, deliberately, for one reason: `proven` is the
**flattering** value here (it is the difference between `degrade` and a possible `go`), the
strict reading is the one the frozen text states, and `SCHEMA.md` exists precisely so that a
measuring plan cannot pick the reading that improves its own result. The unflattering reading is
taken where both are available. `33-12` may apply the alternative reading — the evidence for it is
complete and above — but it must then record the override explicitly, as `SCHEMA.md`'s § 1
preamble requires, and say that it moved the value.

**2. What the control actually proves, versus what the line is called.** § 2.3's control
establishes the insufficiency of `(LIN, CYC)` **alone** — a two-term oracle consisting only of the
frame term. That is what was observed: the frame term alone certified two different stops as one,
and `hit_count` is what separated them. The line's name and § 2.3's prose call this "the necessity
of the frame term", and `R6`'s narrowing drops the frame term. Those are not the same claim. The
measurement above supports the first (the frame term alone is insufficient) and gives no support
to a reading in which the frame term is the load-bearing one on this pair. Both are recorded; the
value emitted is the value the declared derivation produces.

## PROBE_DIR

Absolute paths, so a later wave can find the working artifacts. Nothing binary is committed
(`D-27`):

- `/home/henrik/.cache/c64-re-tools/phase33/33-11/` — the five dedicated stops' `.vsf` snapshots
  and sliced `.bin` images, the `*.frame.json` records (each carrying its full per-hit sample
  list), `repro03.survey1.txt` and `repro03.run1.txt` (the latter is the transcript above), and a
  per-run scratch `xdg/<label>/`.
