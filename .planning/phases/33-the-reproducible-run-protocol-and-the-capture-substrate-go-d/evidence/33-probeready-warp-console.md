# 33-11 · `REPRO-05` / `D-18` — `probeReady`'s wall-clock budget re-checked under `-warp` and under `-console`

Owner: plan `33-11`, Task 3. Probe: `evidence/probeready-probe.mjs`.
Declared source file for `PROBEREADY_BUDGET`, `WARP_TIME_TO_BIND_MS_MAX` and
`CONSOLE_TIME_TO_BIND_MS_MAX` (`SCHEMA.md` § 3).

`D-18` asks for `probeReady`'s real-time timeouts to be re-checked under the launch flags
`33-06` made reachable, "in the same plan that adds the profile". It is a live, broker-stopped
measurement, so it sits here with every other live measurement in the phase, and it is widened
from `-warp` alone to cover `-console` as well. `33-06`'s objective records the same placement.

**None of these three lines gates.** `DECISION-RULE.md` § *Never a gate* says so explicitly:
"`probeReady`'s timing budget never changes the verdict… It is a fact about the launcher's
margins, not about the reproducible-run protocol, and no threshold on it could be defended before
the measurement existed."

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

## What is measured, and through which shipped seams

Wall-clock milliseconds from `execve` to a bound, **answering** binary monitor, across four
launch profiles, **five launches each**, twenty in total — so the recorded figure is a range and
not one observation.

Three things are taken from the shipped code rather than restated in the probe:

- **The argv** comes from `buildViceArgs(port, { backend: "stock", profile })`, so the argv under
  measurement is the one the broker emits — `-console` at its load-bearing position immediately
  after `-default` and before `-drive8type`, `-warp` immediately before `-binarymonitor`, and the
  determinism block unconditionally.
- **The readiness check** is `probeReady(port, { backend: "stock" })`, called directly. So
  "time-to-bind" is the time until the *shipped* probe says ready on the *shipped* route — its
  one-`PING`-then-`EXIT` binary-monitor exchange — and not until some local socket test agrees. An
  accepted TCP connection is deliberately not sufficient: the listen backlog accepts before the
  monitor services, which is the whole difference between a liveness check and a readiness check.
- **The budget** is read out of `broker-launch.mts`'s own source text.
  `DEFAULT_PROBE_TIMEOUT_S` is a module-private `const`, so a value typed into the probe could
  silently drift from the one the launcher uses.

The two profiles without `-console` are windowed by design, and `DISPLAY` / `WAYLAND_DISPLAY` were
deliberately left as the host had them (`DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0`, recorded on
every launch). Unsetting them would have measured a GTK failure instead of a launch.

## The transcript — twenty launches, the per-profile summary, the derivation

```
$ node probeready-probe.mjs run
PROBE probeready-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-11
NODE v24.20.0
VICE_VERSION x64sc (VICE 3.9)
STOCK_DETERMINISM_FLAGS ["-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random"]
BUDGET_SOURCE /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/broker-launch.mts -- const DEFAULT_PROBE_TIMEOUT_S = 1;
BUDGET_ENV VICE_BROKER_PROBE_TIMEOUT_S=(unset)
BUDGET_RESOLVED_MS 1000
LAUNCHES_PER_PROFILE 5
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)

--- none launch 1 of 5 -----------------------------
LAUNCH none-1
LAUNCH_PROFILE (absent)
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6540"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 3132
LAUNCH_FAILED_PROBE_ATTEMPTS 5
LAUNCH_ALIVE yes
POST_X64SC (none)

--- none launch 2 of 5 -----------------------------
LAUNCH none-2
LAUNCH_PROFILE (absent)
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6541"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 3085
LAUNCH_FAILED_PROBE_ATTEMPTS 5
LAUNCH_ALIVE yes
POST_X64SC (none)

--- none launch 3 of 5 -----------------------------
LAUNCH none-3
LAUNCH_PROFILE (absent)
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6542"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2839
LAUNCH_FAILED_PROBE_ATTEMPTS 5
LAUNCH_ALIVE yes
POST_X64SC (none)

--- none launch 4 of 5 -----------------------------
LAUNCH none-4
LAUNCH_PROFILE (absent)
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6543"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2792
LAUNCH_FAILED_PROBE_ATTEMPTS 5
LAUNCH_ALIVE yes
POST_X64SC (none)

--- none launch 5 of 5 -----------------------------
LAUNCH none-5
LAUNCH_PROFILE (absent)
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6544"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2834
LAUNCH_FAILED_PROBE_ATTEMPTS 6
LAUNCH_ALIVE yes
POST_X64SC (none)

--- warp launch 1 of 5 -----------------------------
LAUNCH warp-1
LAUNCH_PROFILE {"warp":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6545"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2896
LAUNCH_FAILED_PROBE_ATTEMPTS 6
LAUNCH_ALIVE yes
POST_X64SC (none)

--- warp launch 2 of 5 -----------------------------
LAUNCH warp-2
LAUNCH_PROFILE {"warp":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6546"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2975
LAUNCH_FAILED_PROBE_ATTEMPTS 6
LAUNCH_ALIVE yes
POST_X64SC (none)

--- warp launch 3 of 5 -----------------------------
LAUNCH warp-3
LAUNCH_PROFILE {"warp":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6547"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 3117
LAUNCH_FAILED_PROBE_ATTEMPTS 6
LAUNCH_ALIVE yes
POST_X64SC (none)

--- warp launch 4 of 5 -----------------------------
LAUNCH warp-4
LAUNCH_PROFILE {"warp":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6548"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 3155
LAUNCH_FAILED_PROBE_ATTEMPTS 5
LAUNCH_ALIVE yes
POST_X64SC 582006
POST_X64SC_SWEPT 582006

--- warp launch 5 of 5 -----------------------------
LAUNCH warp-5
LAUNCH_PROFILE {"warp":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6549"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2950
LAUNCH_FAILED_PROBE_ATTEMPTS 7
LAUNCH_ALIVE yes
POST_X64SC (none)

--- headless launch 1 of 5 -----------------------------
LAUNCH headless-1
LAUNCH_PROFILE {"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6550"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2175
LAUNCH_FAILED_PROBE_ATTEMPTS 3
LAUNCH_ALIVE yes
POST_X64SC (none)

--- headless launch 2 of 5 -----------------------------
LAUNCH headless-2
LAUNCH_PROFILE {"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6551"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2041
LAUNCH_FAILED_PROBE_ATTEMPTS 2
LAUNCH_ALIVE yes
POST_X64SC (none)

--- headless launch 3 of 5 -----------------------------
LAUNCH headless-3
LAUNCH_PROFILE {"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6552"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 1956
LAUNCH_FAILED_PROBE_ATTEMPTS 3
LAUNCH_ALIVE yes
POST_X64SC (none)

--- headless launch 4 of 5 -----------------------------
LAUNCH headless-4
LAUNCH_PROFILE {"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6553"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2052
LAUNCH_FAILED_PROBE_ATTEMPTS 3
LAUNCH_ALIVE yes
POST_X64SC (none)

--- headless launch 5 of 5 -----------------------------
LAUNCH headless-5
LAUNCH_PROFILE {"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6554"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2142
LAUNCH_FAILED_PROBE_ATTEMPTS 4
LAUNCH_ALIVE yes
POST_X64SC (none)

--- warp+headless launch 1 of 5 -----------------------------
LAUNCH warp+headless-1
LAUNCH_PROFILE {"warp":true,"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6555"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2385
LAUNCH_FAILED_PROBE_ATTEMPTS 4
LAUNCH_ALIVE yes
POST_X64SC (none)

--- warp+headless launch 2 of 5 -----------------------------
LAUNCH warp+headless-2
LAUNCH_PROFILE {"warp":true,"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6556"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2310
LAUNCH_FAILED_PROBE_ATTEMPTS 3
LAUNCH_ALIVE yes
POST_X64SC (none)

--- warp+headless launch 3 of 5 -----------------------------
LAUNCH warp+headless-3
LAUNCH_PROFILE {"warp":true,"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6557"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 2026
LAUNCH_FAILED_PROBE_ATTEMPTS 2
LAUNCH_ALIVE yes
POST_X64SC (none)

--- warp+headless launch 4 of 5 -----------------------------
LAUNCH warp+headless-4
LAUNCH_PROFILE {"warp":true,"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6558"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 1945
LAUNCH_FAILED_PROBE_ATTEMPTS 2
LAUNCH_ALIVE yes
POST_X64SC (none)

--- warp+headless launch 5 of 5 -----------------------------
LAUNCH warp+headless-5
LAUNCH_PROFILE {"warp":true,"headless":true}
LAUNCH_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-warp","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6559"]
LAUNCH_ENV DISPLAY=:0 WAYLAND_DISPLAY=wayland-0
LAUNCH_READY yes
LAUNCH_TIME_TO_BIND_MS 1961
LAUNCH_FAILED_PROBE_ATTEMPTS 3
LAUNCH_ALIVE yes
POST_X64SC (none)

--- per-profile summary ----------------------------------------------
PROFILE none n=5 bound=5 never_bound=0 died=0 min_ms=2792 max_ms=3132 values=[3132,3085,2839,2792,2834]
PROFILE warp n=5 bound=5 never_bound=0 died=0 min_ms=2896 max_ms=3155 values=[2896,2975,3117,3155,2950]
PROFILE headless n=5 bound=5 never_bound=0 died=0 min_ms=1956 max_ms=2175 values=[2175,2041,1956,2052,2142]
PROFILE warp+headless n=5 bound=5 never_bound=0 died=0 min_ms=1945 max_ms=2385 values=[2385,2310,2026,1945,1961]

--- the comparison against the current budget ------------------------
CURRENT_BUDGET_MS 1000
HEADROOM none max_observed=3132 budget=1000 headroom=-2132 ms (SHORTFALL)
HEADROOM warp max_observed=3155 budget=1000 headroom=-2155 ms (SHORTFALL)
HEADROOM headless max_observed=2175 budget=1000 headroom=-1175 ms (SHORTFALL)
HEADROOM warp+headless max_observed=2385 budget=1000 headroom=-1385 ms (SHORTFALL)
WARP_GROUP profiles=[warp, warp+headless] max_observed=3155 any_never_bound=no
CONSOLE_GROUP profiles=[headless, warp+headless] max_observed=2385 any_never_bound=no

--- research's single -console observation ---------------------------
CONSOLE_LAUNCHES_MEASURED 10
CONSOLE_LAUNCHES_AT_OR_OVER_3000_MS 0
RESEARCH_SINGLE_OBSERVATION_REPRODUCED no

--- the derivation ---------------------------------------------------
DERIVED_PROBEREADY_BUDGET short
SHORTFALL profile=none max_observed=3132 budget=1000
SHORTFALL profile=warp max_observed=3155 budget=1000
SHORTFALL profile=headless max_observed=2175 budget=1000
SHORTFALL profile=warp+headless max_observed=2385 budget=1000
DERIVED_WARP_TIME_TO_BIND_MS_MAX 3155
DERIVED_CONSOLE_TIME_TO_BIND_MS_MAX 2385
```

## The twenty launches

Every value transcribed from the block above. All twenty bound; **none** died, and no launch
produced any stderr (`LAUNCH_ALIVE yes` twenty times, no `LAUNCH_STDERR` line anywhere).

| Profile | Argv addition | Launches | Time-to-bind, all five (ms) | min | max |
|---|---|---|---|---|---|
| `(absent)` | none | 5 | 3132, 3085, 2839, 2792, 2834 | 2792 | **3132** |
| `{warp: true}` | `-warp` | 5 | 2896, 2975, 3117, 3155, 2950 | 2896 | **3155** |
| `{headless: true}` | `-console` | 5 | 2175, 2041, 1956, 2052, 2142 | 1956 | **2175** |
| `{warp: true, headless: true}` | `-console` + `-warp` | 5 | 2385, 2310, 2026, 1945, 1961 | 1945 | **2385** |

The argv for each is in the transcript. The absent profile emits
`["-default","-drive8type","1541", <block>, "-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:<port>"]`
and each knob adds exactly one token at exactly one position — which is `D-15`'s additive-knob
claim, observed rather than asserted.

Two observations that are results in their own right:

- **`-console` binds FASTER, by roughly 800–1000 ms.** Both headless profiles bind in
  1945–2385 ms against 2792–3155 ms windowed. Skipping GTK initialisation is worth about a
  second here. This is the opposite direction from the concern that motivated `D-18`'s widening.
- **`-warp` makes no meaningful difference to time-to-bind.** 2896–3155 windowed-warped against
  2792–3132 windowed-unwarped; 1945–2385 headless-warped against 1956–2175 headless-unwarped.
  The ranges overlap. That is consistent with what `33-03` measured about `-warp` generally — it
  is worth only ~1.97× on emulated throughput on this host, and `AUTOSTART` turns warp on by
  itself during a load whatever argv says — and it is a further reason the flag is
  behaviour-neutral under a frame-anchored protocol.

Also recorded, without a mechanism invented for it: each launch's failed `probeReady` attempt
count before the first success ranged from **2 to 7** (`LAUNCH_FAILED_PROBE_ATTEMPTS`), across a
poll that sleeps 50 ms between attempts. So a failing `probeReady` call is not free on this host,
and the number of *launcher passes* an instance would fail is small even though the elapsed time
is seconds.

## The comparison against the current budget

The budget, read from the shipped source in this run:

```
BUDGET_SOURCE /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/broker-launch.mts -- const DEFAULT_PROBE_TIMEOUT_S = 1;
BUDGET_ENV VICE_BROKER_PROBE_TIMEOUT_S=(unset)
BUDGET_RESOLVED_MS 1000
```

| Profile | Max observed time-to-bind | Current budget | Headroom |
|---|---|---|---|
| `(absent)` | 3132 ms | 1000 ms | **−2132 ms (shortfall)** |
| `{warp: true}` | 3155 ms | 1000 ms | **−2155 ms (shortfall)** |
| `{headless: true}` | 2175 ms | 1000 ms | **−1175 ms (shortfall)** |
| `{warp: true, headless: true}` | 2385 ms | 1000 ms | **−1385 ms (shortfall)** |

PROBEREADY_BUDGET: short

WARP_TIME_TO_BIND_MS_MAX: 3155

CONSOLE_TIME_TO_BIND_MS_MAX: 2385

The two grouped maxima are over both profiles carrying the flag —
`WARP_TIME_TO_BIND_MS_MAX` over `{warp}` and `{warp, headless}`,
`CONSOLE_TIME_TO_BIND_MS_MAX` over `{headless}` and `{warp, headless}`. The
both-flags profile is deliberately in both groups: it carries both flags, so it is evidence
about each.

**What `short` does and does not mean here, stated precisely, because the shape of the budget
matters more than the number.** `DEFAULT_PROBE_TIMEOUT_S` is a **per-attempt** timeout and
`probeReady()` has **no retry loop** — its own header says so, and says why: "a still-booting
instance simply fails THIS pass and is re-probed on the next one… a slow host is re-probed, never
starved". So:

- `short` means **the first probe pass after a cold launch will always miss on this host**, in
  every profile, by 1.2–2.2 s. It does **not** mean a launch fails, and it does not mean an
  instance is lost.
- The shortfall is **not caused by either new flag.** The absent profile — the argv a stock
  launch has always emitted — is 3132 ms, already 2.1 s over. `-console` *reduces* the shortfall
  and `-warp` leaves it unchanged. Whatever this is, `33-06`'s profile did not introduce it.
- The consequence is a promotion *latency*, paid by `maintainWarmFloor()`'s pass cadence and by
  a grant-time re-probe, not a failure. That is the property the no-retry design was chosen for.

## Research's single `-console` observation — reproduced or not

`33-RESEARCH.md` P5 recorded one `-console` launch **not bound at 3000 ms and bound at 5000 ms**,
and recorded it explicitly as one observation rather than a measured latency. This run's ten
`-console` launches:

```
CONSOLE_LAUNCHES_MEASURED 10
CONSOLE_LAUNCHES_AT_OR_OVER_3000_MS 0
RESEARCH_SINGLE_OBSERVATION_REPRODUCED no
```

**Not reproduced.** All ten `-console` launches bound between 1945 ms and 2385 ms — every one of
them below the 3000 ms mark at which the single prior observation was still unbound. That earlier
datum is left standing as what it was labelled: one observation, on one launch, not a latency.
Nothing here is offered as refuting it; ten launches on one host on one day are also not a
distribution. What is on the record now is a **range** rather than a point, which is what `D-18`
asked for.

## The budget was NOT changed by this plan

`PROBEREADY_BUDGET: short`, and this plan does not touch the budget. Two reasons, and the first is
structural:

1. The budget lives in **host-bound launcher code** (`broker-launch.mts`), whose edit requires a
   regenerated `resources/broker-launch.mjs` in the same commit — `resources-sync.test.ts` fails
   CI on drift. That is a shipped-source change, and this task's own verify asserts
   `git status --porcelain -- src/mcp/vice/` is **empty**. It is (`0` lines).
2. A timing change made from inside the measuring plan would be a change made in the same breath
   as the measurement that justifies it (`T-33-38`). A budget widened in the same commit as the
   measurement that justified it is not a measurement.

**Named follow-up.** `probeReady`'s per-attempt budget of 1000 ms is exceeded by every launch
profile on this host by 1.2–2.2 s, so the first post-launch probe pass always misses. The observed
maxima to size any change against: `(absent)` **3132 ms**, `{warp}` **3155 ms**, `{headless}`
**2175 ms**, `{warp, headless}` **2385 ms**. Two candidate responses, neither taken here: raise
`DEFAULT_PROBE_TIMEOUT_S` (a one-token change plus its regenerated artifact plus the whole-argv
assertions it may move), or leave it and treat the first-pass miss as intended, since the no-retry
design already handles it and the cost is latency rather than loss. The decision needs a
milestone-level owner because it trades cold-acquire latency against a probe that blocks for
longer on a genuinely dead port — and that is exactly the trade `probeReady`'s own header records
being made deliberately in the other direction (`D-05` as amended by `P-05`/`P-06`, the shortened
~1 s default). `SCHEMA.md` § 3 and `DECISION-RULE.md` § *Never a gate* both put this line outside
`GATE-01`, so nothing about `v0.8.0`'s verdict waits on it.

## Died launches

None. All twenty stayed alive to their kill, and no launch emitted stderr. In particular the
GTK-display failure mode research recorded — a `-console` launch at the wrong argv index dying
with "cannot open display" — did **not** occur, which is the expected outcome given
`buildViceArgs()` places `-console` at index 1 and this probe used that builder rather than a
retyped flag list.

## PROBE_DIR

Absolute paths, so a later wave can find the working artifacts:

- `/home/henrik/.cache/c64-re-tools/phase33/33-11/probeready.json` — all twenty launch records
  with full argv, time-to-bind, failed-attempt count and alive status.
- `/home/henrik/.cache/c64-re-tools/phase33/33-11/probeready.run1.txt` — the transcript above.
- `/home/henrik/.cache/c64-re-tools/phase33/33-11/xdg/probeready-*/` — a scratch
  `XDG_CONFIG_HOME` per launch, so no operator `vicerc` on this host could participate.
