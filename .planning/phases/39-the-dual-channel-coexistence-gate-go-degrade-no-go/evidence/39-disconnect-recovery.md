# Phase 39, plan 39-06 — `DISCONNECT_RECOVERY` (Task 1)

Owned by `39-06`. Measures the fifth of the phase's seven gate inputs, per
`SCHEMA.md` §2.5's frozen derivation, and answers the question the ROADMAP
flags as one that "may itself discover required mechanism." Follows the
evidence conventions in `README.md` § *Evidence conventions*, binding on this
plan.

**`DECISION-RULE.md`'s pre-mapped narrowing for this input was read BEFORE
deriving the value below**, per this plan's own action item, and stated here
plainly so the pre-commitment is operative rather than decorative:
`DECISION-RULE.md` (`R11`, lines ~128-137) reads

> **`R11` -> `degrade`.** `IDLE_COEXIST` is `clean`, `FOREIGN_HALT_VISIBILITY`
> is `visible`, `CONCURRENT_INFLIGHT` is `clean`, `CROSS_CHANNEL_RESUME` is
> `clean` **and** `DISCONNECT_RECOVERY` is `leaves-halted`. **Pre-mapped
> narrowing (D-10):** a killed text client leaving the machine permanently
> halted and indistinguishable from a genuine wedge is a **missing
> mechanism**, not a proof of incompatibility — the binary side's
> "connection close IS the release" (`broker-control.mts` ~line 522) has no
> text-channel analogue, and only the broker outlives a killed client. So
> this outcome points **at** the broker-lease shape rather than away from
> coexistence, and the fix — a broker-held halt-authority lease released when
> the holding connection dies — becomes named Phase 41 scope in the verdict,
> discovered here rather than at Phase 41's gate.

This was read in full, before any live run below, so that if the measured
answer had come out `leaves-halted`, this file could not have been shaped to
avoid that narrowing. **It did not come out `leaves-halted`** — see
Derivation below — and that is reported honestly, exactly as measured,
rather than reshaped toward the narrowing that was written for the other
outcome.

The analogue this experiment tests, quoted verbatim from
`src/mcp/vice/broker-control.mts` (lines 521-531), the binary side's own
connection-close-is-the-release semantics:

```
    socket.on("close", () => {
      // Connection close IS the release -- including on the client's own
      // SIGKILL, since "close" always fires either way. Idempotent: an
      // explicit `release` already having cleared
      // requestIdForThisConnection makes this a no-op.
      if (requestIdForThisConnection) {
        const id = requestIdForThisConnection;
        requestIdForThisConnection = null;
        opts.onRelease(id);
      }
    });
```

That code is the **broker's** control-plane lease release, not anything
inside VICE itself — it has nothing to do with the emulator's own
text-monitor implementation. Whether the emulator's own monitor loop treats
a client's socket closing (including via `SIGKILL`) as a reason to release a
halt it is holding is exactly what this experiment measures, with no broker
involved anywhere (`D-12`: the probe spawns genuine stock `x64sc` directly).

---

## Precondition check (D-16), taken immediately before every run below

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc
(no output, exit 1 -- no genuine x64sc process alive)
```

Broker `inactive`, zero alive `x64sc` processes. `preflight()` in
`probe-harness.mjs` re-asserts this same pair in code, immediately before
every spawn, and throws rather than warns if either is violated (confirmed
by every run below: `PREFLIGHT_BROKER inactive` / `PREFLIGHT_X64SC (none)`).

---

## The victim: a separate process, no cleanup path

`textmon-kill-victim.mjs` is spawned by `disconnect-recovery-probe.mjs` as a
genuine **child process** (`node:child_process.spawn`), not a socket the
probe closes itself. It connects, awaits the banner, issues a halting
`memmapshow` command, awaits the framed reply, prints one `VICTIM_READY`
line to stdout, and then blocks forever — registering no exit handler, no
signal handler, and no socket teardown of any kind. Confirmed mechanically:

```
$ grep -av '^[[:space:]]*[/*]' textmon-kill-victim.mjs | grep -cE "process\.on\(|\.destroy\(|\.end\("
0
```

The parent terminates it with `SIGKILL` — never a same-process
`socket.destroy()` — because a clean application-level close exercises a
release path a killed process cannot run, which is the whole distinction
this experiment exists to draw.

---

## Run 1 (preliminary) — needed correction (sampling granularity, not a defect in the outcome)

The first live run used a fixed 5-second poll interval throughout the full
60-second recovery window. It measured `DISCONNECT_RECOVERY: recovers` in
both repetitions, but the very first sample after the kill already showed a
large positive hit count (`cumulativeHits=301` at `tMs=5001` — consistent
with the checkpoint's own ~60Hz rate free-running for the whole 5-second
window), which means recovery could have happened at ANY point inside that
first 5-second bucket, including near-instantly. That is not a wrong
answer — the frozen rule only requires "the series to start advancing on
its own" within the 60s budget, and it did — but it is an imprecise one, and
this experiment can afford better precision without changing the outcome.
**Recorded here, not discarded, per README.md's voided-run convention
applied to a between-run precision gap rather than a defect:**

```
$ node disconnect-recovery-probe.mjs
PROBE disconnect-recovery-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T22:38:36.691Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
=== RUN 1 of 2 ===
RUN_1_BINARY_PORT 34867
RUN_1_TEXT_PORT 44203
RUN_1_SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:34867","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:44203"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
RUN_1_BINARY_TIME_TO_BIND_MS 154
RUN_1_BINARY_MONITOR_READY_AFTER_PINGS 1
RUN_1_ANCHOR_CHECKPOINT_ID 1
RUN_1_RESUMED_ONCE_FOR_BOOT_SETTLE
RUN_1_ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2015}
PRE_VICTIM_LIVENESS_BRACKET_RUN_1: hits=59
RUN_1_VICTIM_STDOUT "VICTIM_READY matchedPromptRe=true bannerBytes=71880 replyBytes=130\n"
VICTIM_READY_RUN_1: true VICTIM_READY matchedPromptRe=true bannerBytes=71880 replyBytes=130
POST_VICTIM_LIVENESS_BRACKET_RUN_1: hits=0 (pre-victim was 59)
VICTIM_KILLED_RUN_1: signal=SIGKILL exit={"exited":true,"code":null,"signal":"SIGKILL","elapsedMs":4}
RECOVERY_SERIES_RUN_1: [{"tMs":5001,"cumulativeHits":301},{"tMs":10002,"cumulativeHits":601},{"tMs":15001,"cumulativeHits":901},{"tMs":20002,"cumulativeHits":1201},{"tMs":25001,"cumulativeHits":1501},{"tMs":30001,"cumulativeHits":1801},{"tMs":35001,"cumulativeHits":2101},{"tMs":40002,"cumulativeHits":2401},{"tMs":45002,"cumulativeHits":2701},{"tMs":50003,"cumulativeHits":3001},{"tMs":55003,"cumulativeHits":3301},{"tMs":60000,"cumulativeHits":3601}]
RECOVERY_OBSERVED_RUN_1: first advance at tMs=5001
RUN_1_OUTCOME: recovers (hit_count began advancing on its own at tMs=5001 within the 60000ms budget, with no further action on either channel)
=== RUN 2 of 2 ===
RUN_2_BINARY_PORT 36751
RUN_2_TEXT_PORT 44993
RUN_2_SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:36751","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:44993"]
RUN_2_BINARY_TIME_TO_BIND_MS 152
RUN_2_BINARY_MONITOR_READY_AFTER_PINGS 1
RUN_2_ANCHOR_CHECKPOINT_ID 1
RUN_2_RESUMED_ONCE_FOR_BOOT_SETTLE
RUN_2_ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2035}
PRE_VICTIM_LIVENESS_BRACKET_RUN_2: hits=59
RUN_2_VICTIM_STDOUT "VICTIM_READY matchedPromptRe=true bannerBytes=72000 replyBytes=130\n"
VICTIM_READY_RUN_2: true VICTIM_READY matchedPromptRe=true bannerBytes=72000 replyBytes=130
POST_VICTIM_LIVENESS_BRACKET_RUN_2: hits=0 (pre-victim was 59)
VICTIM_KILLED_RUN_2: signal=SIGKILL exit={"exited":true,"code":null,"signal":"SIGKILL","elapsedMs":3}
RECOVERY_SERIES_RUN_2: [{"tMs":4999,"cumulativeHits":301},{"tMs":10000,"cumulativeHits":601},{"tMs":14999,"cumulativeHits":901},{"tMs":19999,"cumulativeHits":1201},{"tMs":25000,"cumulativeHits":1501},{"tMs":30001,"cumulativeHits":1801},{"tMs":35001,"cumulativeHits":2101},{"tMs":40000,"cumulativeHits":2401},{"tMs":45001,"cumulativeHits":2701},{"tMs":50001,"cumulativeHits":3001},{"tMs":55000,"cumulativeHits":3301},{"tMs":60000,"cumulativeHits":3601}]
RECOVERY_OBSERVED_RUN_2: first advance at tMs=4999
RUN_2_OUTCOME: recovers (hit_count began advancing on its own at tMs=4999 within the 60000ms budget, with no further action on either channel)
DISCONNECT_RECOVERY: recovers
DISCONNECT_RECOVERY_REASON both runs agreed
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/disconnect-recovery-run.json
```

```
$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

**Fix applied for the authoritative run below:** `POLL_SCHEDULE_MS` was
changed from a fixed 5-second cadence to a front-loaded schedule (`100,
300, 600, 1000, 1500, 2000, 3000` ms, then 5-second steps out to the full
60000ms budget) — still purely passive (every sample is a local read of the
already-accumulated counter, never a network round trip; "no further action
on either channel" is unchanged) — so a near-instant recovery is timed
precisely rather than bucketed into "somewhere in the first 5 seconds."

---

## Run 2 (authoritative) — the derivation below is taken from this run

```
$ node disconnect-recovery-probe.mjs
PROBE disconnect-recovery-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T22:42:58.119Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
=== RUN 1 of 2 ===
RUN_1_BINARY_PORT 46453
RUN_1_TEXT_PORT 34643
RUN_1_SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:46453","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:34643"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
RUN_1_BINARY_TIME_TO_BIND_MS 154
RUN_1_BINARY_MONITOR_READY_AFTER_PINGS 1
RUN_1_ANCHOR_CHECKPOINT_ID 1
RUN_1_RESUMED_ONCE_FOR_BOOT_SETTLE
RUN_1_ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2020}
PRE_VICTIM_LIVENESS_BRACKET_RUN_1: hits=59
RUN_1_VICTIM_STDOUT "VICTIM_READY matchedPromptRe=true bannerBytes=71880 replyBytes=130\n"
VICTIM_READY_RUN_1: true VICTIM_READY matchedPromptRe=true bannerBytes=71880 replyBytes=130
POST_VICTIM_LIVENESS_BRACKET_RUN_1: hits=0 (pre-victim was 59)
VICTIM_KILLED_RUN_1: signal=SIGKILL exit={"exited":true,"code":null,"signal":"SIGKILL","elapsedMs":5}
RECOVERY_SERIES_RUN_1: [{"tMs":99,"cumulativeHits":7},{"tMs":301,"cumulativeHits":19},{"tMs":599,"cumulativeHits":37},{"tMs":1001,"cumulativeHits":61},{"tMs":1499,"cumulativeHits":91},{"tMs":2000,"cumulativeHits":121},{"tMs":3001,"cumulativeHits":181},{"tMs":5000,"cumulativeHits":301},{"tMs":10000,"cumulativeHits":601},{"tMs":15001,"cumulativeHits":901},{"tMs":20000,"cumulativeHits":1201},{"tMs":24999,"cumulativeHits":1501},{"tMs":30000,"cumulativeHits":1801},{"tMs":35000,"cumulativeHits":2101},{"tMs":40001,"cumulativeHits":2401},{"tMs":44999,"cumulativeHits":2701},{"tMs":50001,"cumulativeHits":3001},{"tMs":55000,"cumulativeHits":3301},{"tMs":60000,"cumulativeHits":3601}]
RECOVERY_OBSERVED_RUN_1: first advance at tMs=99
RUN_1_OUTCOME: recovers (hit_count began advancing on its own at tMs=99 within the 60000ms budget, with no further action on either channel)
=== RUN 2 of 2 ===
RUN_2_BINARY_PORT 38799
RUN_2_TEXT_PORT 45965
RUN_2_SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:38799","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:45965"]
RUN_2_BINARY_TIME_TO_BIND_MS 151
RUN_2_BINARY_MONITOR_READY_AFTER_PINGS 1
RUN_2_ANCHOR_CHECKPOINT_ID 1
RUN_2_RESUMED_ONCE_FOR_BOOT_SETTLE
RUN_2_ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2035}
PRE_VICTIM_LIVENESS_BRACKET_RUN_2: hits=59
RUN_2_VICTIM_STDOUT "VICTIM_READY matchedPromptRe=true bannerBytes=71880 replyBytes=1624677\n"
VICTIM_READY_RUN_2: true VICTIM_READY matchedPromptRe=true bannerBytes=71880 replyBytes=1624677
POST_VICTIM_LIVENESS_BRACKET_RUN_2: hits=0 (pre-victim was 59)
VICTIM_KILLED_RUN_2: signal=SIGKILL exit={"exited":true,"code":null,"signal":"SIGKILL","elapsedMs":3}
RECOVERY_SERIES_RUN_2: [{"tMs":101,"cumulativeHits":7},{"tMs":299,"cumulativeHits":19},{"tMs":600,"cumulativeHits":37},{"tMs":1001,"cumulativeHits":61},{"tMs":1500,"cumulativeHits":91},{"tMs":2000,"cumulativeHits":121},{"tMs":2999,"cumulativeHits":181},{"tMs":5001,"cumulativeHits":301},{"tMs":10001,"cumulativeHits":601},{"tMs":15000,"cumulativeHits":901},{"tMs":20000,"cumulativeHits":1201},{"tMs":25000,"cumulativeHits":1501},{"tMs":30001,"cumulativeHits":1800},{"tMs":35000,"cumulativeHits":2101},{"tMs":40001,"cumulativeHits":2401},{"tMs":44999,"cumulativeHits":2700},{"tMs":50001,"cumulativeHits":3000},{"tMs":55001,"cumulativeHits":3300},{"tMs":60000,"cumulativeHits":3601}]
RECOVERY_OBSERVED_RUN_2: first advance at tMs=101
RUN_2_OUTCOME: recovers (hit_count began advancing on its own at tMs=101 within the 60000ms budget, with no further action on either channel)
DISCONNECT_RECOVERY: recovers
DISCONNECT_RECOVERY_REASON both runs agreed
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3537 / fail 4
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, audit-root-args.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/disconnect-recovery-run.json
```

```
$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

**On this run's `TEST_AUTOMATED_BASELINE` gaining a third failing file
(`audit-root-args.test.ts`) versus Run 1's two:** recorded as observed, per
this phase's own binding rule (README.md convention 4: "the count is a
recorded baseline and never a gate," "no plan adopts a `test:automated`
failure count as an acceptance criterion"). This baseline was taken with the
broker `inactive` throughout (confirmed above), so it is not the live-broker
contamination README.md warns about; it reads as ordinary suite flakiness
unrelated to anything this probe touches, consistent with the project's
already-documented `host-scripts.test.ts` flake precedent for a different
file. Not investigated further, per the same convention: it is a recorded
observation, not a gate.

---

## Derivation

Per `SCHEMA.md` §2.5's frozen rule:

- **`recovers`** iff within the stated 60s budget the machine is observed
  running again from the binary channel (a non-stopping checkpoint's
  `hit_count` advances) with **no** further action.
- **`leaves-halted`** iff `hit_count` does not advance within the budget.
- **`not-taken`** iff the victim could not establish a halt.

Both runs above satisfy `recovers` unambiguously:

| | Run 1 | Run 2 (authoritative timing) |
|---|---|---|
| Pre-victim liveness bracket (1000ms) | 59 hits | 59 hits |
| Victim ready | `true` | `true` |
| Post-victim liveness bracket (1000ms) | 0 hits | 0 hits |
| Kill signal | `SIGKILL` | `SIGKILL` |
| Victim exit | `exited:true, signal:"SIGKILL"` | `exited:true, signal:"SIGKILL"` |
| First observed hit-count advance | `tMs=99` (bucketed by the 5s-only schedule) | `tMs=99`..`101` |
| Series across the full 60000ms budget | monotonically non-decreasing, no gaps | monotonically non-decreasing, no gaps |

Both runs agree: `DISCONNECT_RECOVERY: recovers`. No disagreement to
resolve, and no "worse value" resolution was needed.

**Because the value is `recovers`, not `leaves-halted`, the fresh-connection
follow-up (SCHEMA.md's "record separately whether a fresh text connection
followed by `x` restores it") was never triggered by either run** — the
probe's own code only attempts that follow-up on the `leaves-halted` branch,
per the frozen derivation. This is a documented, deliberate branch skip, not
an omission: the follow-up mechanism specifically exists to test the
"missing mechanism" `R11`'s narrowing anticipates, and that narrowing was
never triggered here because the machine never needed a fresh connection to
resume.

```
DISCONNECT_RECOVERY: recovers
```

**What this measurement newly establishes, previously unmeasured on this
codebase:** on this exact launch shape (`-console` plus both monitor
flags, genuine stock VICE 3.9), the emulator's own text-monitor server
treats an abruptly-killed client's socket closing — via `SIGKILL`, with the
victim registering zero cleanup code of its own — as a reason to release a
halt it was holding, and does so **almost instantly** (observed at ~100ms
after the kill, in both runs, at the front-loaded schedule's earliest
sample). This is functionally the same "connection close IS the release"
property the binary side's own `broker-control.mts` code implements at the
**broker** layer, except here it appears to be a property of the emulator's
**own** monitor accept/select loop noticing the peer's `close`/EOF — nothing
broker-mediated is involved anywhere in this measurement (`D-12`: the probe
spawns `x64sc` directly, no broker process is ever started). Whether this
is VICE's remote-monitor accept loop reacting to the closed file descriptor,
or some other mechanism internal to the emulator, was not distinguished
further — the measurement establishes THAT it recovers and roughly how
fast, not the internal code path that makes it so, which is out of scope for
a probe that reads (never edits) the emulator's own C sources.

---

## Wedge-triage correspondence

The plan requires stating which verdict the shipped `vice-wedge-triage`
playbook (`src/skills/vice-wedge-triage/SKILL.md`) would currently reach for
the end state this experiment produced, and whether that verdict would
recommend a destructive recycle of a healthy instance. The playbook is
**not modified** by this phase — confirmed:

```
$ git status --porcelain src/skills/vice-wedge-triage
(no output)
```

**The end state this experiment actually produced is a healthy, running
machine, reached almost instantly.** A `vice_diagnose` call made at any
point AFTER the observed ~100ms recovery window would read cycles
advancing, epoch unchanged, and no checkpoint trap on the live IRQ path —
that is exactly the playbook's `live` verdict ("Cycles advanced. Resume and
carry on"), and the correct, non-destructive response.

The playbook's `wedged` row ("Two consecutive cycle brackets read exactly
`0`" / "`vice_recycle` with a reason, as a last resort") is the verdict this
experiment's `D-10` narrowing anticipated for the OTHER outcome
(`leaves-halted`), and would indeed have been reached — and would indeed
have recommended a destructive recycle of what `D-10` explicitly frames as
a healthy-but-stuck instance rather than a genuinely broken one, exactly the
trap the phase facts describe. **That trap was not exercised by this
measurement's actual result**, because the recovery window this experiment
measured (~100ms) is far shorter than the time any bracket-driven triage
procedure takes to even complete one measurement window (the manual
fallback in `SKILL.md`'s own § *The manual fallback* uses a real wall-clock
wait as its shortest unit, and `vice_diagnose`'s own cheapest check already
costs more than one round trip). In practice, on this exact launch shape and
for this exact halting command (`memmapshow`), a killed text client's own
socket closing resolves the halt before any realistic triage attempt could
even observe it as stuck — so the `wedged`-verdict trap this experiment set
out to probe is not the one it actually found; the finding is that recovery
happens on its own, fast enough that a human or agent-driven triage would
never see the `wedged` state in the first place for this specific scenario.

This is recorded as an observation for the findings document to carry
forward, not a claim that `DISCONNECT_RECOVERY: recovers` generalizes to
every halting command or every launch shape — only that it was measured
true for the one exercised here (`memmapshow`, this exact argv).

---

## Column-0 outcome and provenance lines (final occurrence wins)

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3537 / fail 4
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, audit-root-args.test.ts
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
DISCONNECT_RECOVERY: recovers
