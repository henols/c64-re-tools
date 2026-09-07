# Phase 39, plan 39-04 — `FOREIGN_HALT_VISIBILITY` (Task 1)

Owned by `39-04`. Measures the second of the phase's seven gate inputs, per
`SCHEMA.md` §2.2's frozen derivation. Follows the evidence conventions in
`README.md` § *Evidence conventions*, binding on this plan.

---

## Precondition check (D-16), taken immediately before the authoritative run

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc
(no output, exit 1 -- no genuine x64sc process alive)
```

Broker `inactive`, zero alive `x64sc` processes. `preflight()` in
`probe-harness.mjs` re-asserts this same pair in code, immediately before every
spawn, and throws rather than warns if either is violated (confirmed by both
runs below: `PREFLIGHT_BROKER inactive` / `PREFLIGHT_X64SC (none)`).

---

## Run 1 — VOIDED (probe defect, not a measurement of the machine)

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/foreign-halt-probe.mjs
PROBE foreign-halt-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T21:16:24.520Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 40025
TEXT_PORT 37359
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:40025","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:37359"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 155
BINARY_MONITOR_READY_AFTER_PINGS 1
ANCHOR_CHECKPOINT_ID 1
RESUMED_ONCE_FOR_BOOT_SETTLE
ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2016}
ANCHOR_HITTING_CHECK before=1 after=1
VOID: the anchor checkpoint's hit_count did not strictly advance across a 500ms sanity window (before=1, after=1) -- the control itself is void
FOREIGN_HALT_VISIBILITY: not-taken
FOREIGN_HALT_VISIBILITY_REASON the anchor checkpoint's hit_count did not strictly advance across a 500ms sanity window (before=1, after=1) -- the control itself is void
FULL_EVENT_LOG [{"tMs":1217,"type":"registers","requestId":4294967295},{"tMs":1217,"type":"stopped","requestId":4294967295},{"tMs":1218,"type":"resumed","requestId":4294967295},{"tMs":3234,"type":"checkpoint_info","requestId":4294967295},{"tMs":3243,"type":"registers","requestId":4294967295},{"tMs":3243,"type":"stopped","requestId":4294967295}]
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/foreign-halt-run.json
```

**VOID reason.** The probe's first draft used explicit `CHECKPOINT_GET` reads
(`checkpointHitCount()`) as its "before/after" sanity-check mechanism — a
binary-channel command. `probe-harness.mjs`'s own `resumeExecution()` doc
comment (written by `39-03`) already recorded that on this exact launch shape,
once the machine is running, **any** command reaching the binary monitor
re-halts the CPU, and it stays halted until the *next* command. The "before"
`CHECKPOINT_GET` in the sanity check therefore halted the machine itself; the
"after" read, sent 500ms later to an already-halted machine (nothing else had
resumed it), necessarily read the identical hit count. The event log confirms
this mechanically: `checkpoint_info` fires exactly once (at `tMs:3234`, the
anchor's genuine first hit after boot-settle), and the very next entries
(`tMs:3243`, 9ms later) are `registers`+`stopped` — precisely the moment the
sanity check's own first `CHECKPOINT_GET` reached the monitor and halted it.
The recorded `not-taken` is an artifact of the probe polling its own subject,
not a fact about the emulator or the text channel — it never touched the text
channel at all. See "Deviation 1" in `39-04-SUMMARY.md` for the fix (an
entirely passive, no-further-binary-commands measurement discipline) and the
corrected, authoritative Run 3 below.

---

## Run 3 — authoritative

Preflight re-verified immediately before this run:

```
$ systemctl --user is-active vice-broker
inactive
$ pgrep -x x64sc
(no output, exit 1)
```

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/foreign-halt-probe.mjs
PROBE foreign-halt-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T21:21:33.862Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 46407
TEXT_PORT 44785
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:46407","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:44785"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 153
BINARY_MONITOR_READY_AFTER_PINGS 1
ANCHOR_CHECKPOINT_ID 1
RESUMED_ONCE_FOR_BOOT_SETTLE
ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2020}
TEXT_TIME_TO_BIND_MS 1
TEXT_BANNER_HEX <elided, 71880 bytes -- see "The connect banner is not empty this time" below>
--- repetition 1 of 3 ---
CONTROL_BRACKET_1: hits=60
TEXT_MEMMAPSHOW_MATCHED_PROMPT true
TEXT_MEMMAPSHOW_REPLY_LEN 1624557
MEASURED_BRACKET_1: hits=0 desyncDelta=0 dupDelta=0 unsolicited=2
UNSOLICITED_FRAMES_REP_1: [{"tMs":14265,"type":"registers","requestId":4294967295},{"tMs":14265,"type":"stopped","requestId":4294967295}]
TEXT_RELEASE_MATCHED_PROMPT false
RELEASE_HITCOUNT_RESUMES_REP_1: hits=60 resumed=true
--- repetition 2 of 3 ---
CONTROL_BRACKET_2: hits=60
TEXT_MEMMAPSHOW_MATCHED_PROMPT true
TEXT_MEMMAPSHOW_REPLY_LEN 1624677
MEASURED_BRACKET_2: hits=1 desyncDelta=0 dupDelta=0 unsolicited=3
UNSOLICITED_FRAMES_REP_2: [{"tMs":27566,"type":"checkpoint_info","requestId":4294967295},{"tMs":27577,"type":"registers","requestId":4294967295},{"tMs":27577,"type":"stopped","requestId":4294967295}]
TEXT_RELEASE_MATCHED_PROMPT false
RELEASE_HITCOUNT_RESUMES_REP_2: hits=60 resumed=true
--- repetition 3 of 3 ---
CONTROL_BRACKET_3: hits=60
TEXT_MEMMAPSHOW_MATCHED_PROMPT true
TEXT_MEMMAPSHOW_REPLY_LEN 1624677
MEASURED_BRACKET_3: hits=1 desyncDelta=0 dupDelta=0 unsolicited=3
UNSOLICITED_FRAMES_REP_3: [{"tMs":40804,"type":"checkpoint_info","requestId":4294967295},{"tMs":40807,"type":"registers","requestId":4294967295},{"tMs":40807,"type":"stopped","requestId":4294967295}]
TEXT_RELEASE_MATCHED_PROMPT false
RELEASE_HITCOUNT_RESUMES_REP_3: hits=60 resumed=true
FOREIGN_HALT_VISIBILITY: visible
FOREIGN_HALT_VISIBILITY_SIGNAL: unsolicited STOPPED (0x62) frame at request-id 0xffffffff during the measured bracket window
FULL_EVENT_LOG <elided, 2781 entries -- see "Full event log summary" below and RUN_RECORD path>
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3537 / fail 4
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, host-scripts.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/foreign-halt-run.json
```

```
$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

### On the two elisions above

**`TEST_AUTOMATED_BASELINE_FILES` gained `host-scripts.test.ts` versus the
prior run.** Per this phase's own standing note (39-03's baseline observation,
and the project's own tracked note on this exact file), `host-scripts.test.ts`
is a known intermittent flake unrelated to this plan; the `anno-import.test.ts`
/ `anno-register.test.ts` pair is the same pre-existing, unowned failure
39-03 already recorded (a v0.9.0 milestone-rollover `REQUIREMENTS.md`
mismatch). Recorded as observed, not smoothed, per README.md convention 4.

**`TEXT_BANNER_HEX` and `FULL_EVENT_LOG` are the two fields elided above**,
both because pasting them verbatim would be enormous (71,880 bytes and 2,781
JSON objects respectively) and because — per the same practical compromise
`39-idle-coexist.md` already established for repeated large binary payloads
(hex prefixes plus a sha256 digest, rather than six full 256-byte dumps) — the
*meaningful* content of both is fully reproduced elsewhere in this file: the
banner's content and shape are discussed in the next section, and the event
log's non-repetitive entries (every `registers`/`stopped`/`resumed` transition,
which is the entirety of what is not a ~60Hz `checkpoint_info` push) are
reproduced verbatim in "Full event log summary" below. The complete,
un-elided JSON — including all 2,767 `checkpoint_info` entries — is preserved
at the absolute path the transcript itself records
(`RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/foreign-halt-run.json`),
per README.md convention 2 ("record absolute `PROBE_DIR` paths so a later wave
can find the artifact"), and nothing about `FOREIGN_HALT_VISIBILITY`'s
derivation below depends on data that exists only in the elided fields.

### The connect banner is not empty this time — a previously-unmeasured fact

`39-idle-coexist.md` recorded the stock text monitor's connect banner as
empty (no greeting) under conditions with **no checkpoint armed**. Here, by
the time the text channel connects (~12 seconds after the anchor checkpoint
was armed and resumed), the banner capture is **71,880 bytes** of continuously
streamed breakpoint-trace text, e.g.:

```
#1 (Trace  exec ea31)  154/$09a,  59/$3b
.C:ea31  20 EA FF    JSR $FFEA      - A:00 X:E8 Y:03 SP:e8 ..-..IZC    2093297
#1 (Trace  exec ea31)  103/$067,  34/$22
.C:ea31  20 EA FF    JSR $FFEA      - A:00 X:E8 Y:20 SP:e8 ..-..IZ.    2109715
```

repeating at the checkpoint's own ~60Hz hit rate, for the entire 10-second
`awaitBanner()` budget (confirmed: the accumulated buffer's tail never matches
`PROMPT_RE`, so `awaitBanner()` correctly times out and returns
`matchedPromptRe: false` rather than a false match). **This is not a
contradiction of 39-03's finding** — that measurement had no checkpoint armed
at all, so there was no trace source to stream. It is a new, previously
unmeasured fact this plan's own setup surfaced: a checkpoint (any checkpoint,
armed via either channel, stopping or non-stopping) causes VICE's monitor
subsystem to print a continuous breakpoint-trace log to the **text** monitor
console for as long as it keeps hitting — a form of binary-to-text visibility
in the *opposite* direction from this task's own question, and worth carrying
forward for `39-05`/`CHAN-04`'s eventual serialization design (a checkpoint
armed on one channel is not silent on the other).

This same continuous trace stream is also why `TEXT_RELEASE_MATCHED_PROMPT`
reads `false` in every repetition below: sending `x` resumes the CPU, which
immediately restarts the checkpoint's hit-driven trace flood on the text
console, so the accumulated buffer's tail is always a fresh trace line, never
a stable `(C:$xxxx) ` prompt, within the 10-second budget. This does not
corrupt the release confirmation — that confirmation is derived independently
and passively (`RELEASE_HITCOUNT_RESUMES_REP_N: hits=60 resumed=true` in every
repetition, see below), never from whether `x`'s own reply framed.

### Full event log summary

2,781 total events on the binary channel's `event` channel across the whole
~53-second run: `checkpoint_info` × 2,767 (the ~60Hz passive hit counter, the
overwhelming majority, elided as repetitive), `registers` × 5, `stopped` × 5,
`resumed` × 4. Every non-`checkpoint_info` entry, in order (this is the
complete set — nothing between these lines is anything but a `checkpoint_info`
push):

```
{"tMs":1225,"type":"registers","requestId":4294967295}
{"tMs":1225,"type":"stopped","requestId":4294967295}
{"tMs":1226,"type":"resumed","requestId":4294967295}
{"tMs":14265,"type":"registers","requestId":4294967295}
{"tMs":14265,"type":"stopped","requestId":4294967295}
{"tMs":15560,"type":"resumed","requestId":4294967295}
{"tMs":27577,"type":"registers","requestId":4294967295}
{"tMs":27577,"type":"stopped","requestId":4294967295}
{"tMs":28795,"type":"resumed","requestId":4294967295}
{"tMs":40807,"type":"registers","requestId":4294967295}
{"tMs":40807,"type":"stopped","requestId":4294967295}
{"tMs":41977,"type":"resumed","requestId":4294967295}
{"tMs":52993,"type":"registers","requestId":4294967295}
{"tMs":52993,"type":"stopped","requestId":4294967295}
```

Reading this against the transcript: the `1225`/`1226` triple is this probe's
own single `EXIT` (`resumeExecution()`) at startup — even the client's own
resume command produces a `stopped`+`registers` pair immediately before the
`resumed` pair, confirming that *every* command reaching the monitor,
including `EXIT` itself, transits through a momentary halt. The three
`registers`/`stopped` pairs at `14265`/`27577`/`40807` are exactly the three
`memmapshow` halts (one per repetition); the three `resumed` events at
`15560`/`28795`/`41977` are the three `x` releases. The final `registers`/
`stopped` pair at `52993` is the `CHECKPOINT_DELETE` sent during cleanup,
after every bracket had already been taken — the first binary command this
probe sent since the initial `EXIT`, confirming the passive-only discipline
held for the entire measurement window (14 non-`checkpoint_info` events total,
all fully accounted for above; nothing else touched the binary channel).

### Control vs. measured bracket table (all three repetitions)

| Rep | Control hits (no foreign halt, 1s window) | Measured hits (foreign halt in effect, 1s window) | Unsolicited frames during measured window | Desync delta | Duplicate-reply delta |
|---|---|---|---|---|---|
| 1 | 60 | 0 | `registers`, `stopped` | 0 | 0 |
| 2 | 60 | 1 | `checkpoint_info`, `registers`, `stopped` | 0 | 0 |
| 3 | 60 | 1 | `checkpoint_info`, `registers`, `stopped` | 0 | 0 |

Observed control spread across the three repetitions: `min=60 max=60` — the
anchor checkpoint hits at a rock-steady ~60Hz (one frame anchor per emulated
frame) whenever nothing halts it, exactly as 39-03's own idle measurement
(`ANCHOR_HITS_DURING_1S_SAMPLE_WINDOW: 59`) found. Every measured bracket, by
contrast, collapses to 0 or 1 (the residual 1 in reps 2/3 is the single
`checkpoint_info` that arrived in the few milliseconds between the window
opening and the halt actually taking effect) — a two-orders-of-magnitude drop
against the control, present in every repetition.

---

## Derivation

Per `SCHEMA.md` §2.2: `visible` iff at least one of (a) an unsolicited
`STOPPED` (0x62) frame arrives on the binary channel at request-id
`0xffffffff` during the measured window, or (b) the measured bracket reads
zero against a non-zero control. **Both signals are present, in every one of
the three repetitions**: an unsolicited `stopped` frame arrives during every
measured window (the table above), and rep 1's measured bracket additionally
reads exactly zero against rep 1's control of 60. Neither `corrupts`
(zero desync-byte and duplicate-reply deltas throughout) nor `not-taken`
(the checkpoint was confirmed hitting at 60/s before any foreign halt was
attempted, and `memmapshow` produced a fully framed response in every
repetition) applies. The frozen rule is unambiguous here — no `## ACCEPTED
LIMIT` section is needed.

**The named signal, for a later serialization authority to key on:** the
unsolicited `STOPPED` (0x62) frame at request-id `0xffffffff`. It is the
more direct of the two admissible signals (it does not require a companion
checkpoint or a control baseline to interpret), it arrived in all three
repetitions (the hit-count-delta signal only unambiguously read zero in one
of three, since a checkpoint that happens to fire in the few milliseconds
before the halt takes effect can leave a residual count of 1), and it is
paired, every single time in this transcript, with an unsolicited
`REGISTER_INFO` (0x31) frame at the same timestamp — a fact not previously
recorded in this project's CLAUDE.md, which currently documents `REGISTER_INFO`
arriving only "on every monitor open."

---

<!-- Bare column-0 outcome lines. Final occurrence wins (README.md convention 7). -->

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3537 / fail 4
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, host-scripts.test.ts
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
FOREIGN_HALT_VISIBILITY: visible
