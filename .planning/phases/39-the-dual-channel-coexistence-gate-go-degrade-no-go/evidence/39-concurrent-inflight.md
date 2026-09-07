# Phase 39, plan 39-05 — `CONCURRENT_INFLIGHT` (Task 1)

Owned by `39-05`. Measures the third of the phase's seven gate inputs, per
`SCHEMA.md` §2.3's frozen derivation. Follows the evidence conventions in
`README.md` § *Evidence conventions*, binding on this plan.

**The honest characterisation, stated up front (this is what is and is not
claimed).** Stock VICE services both monitor servers from one single-threaded
`monitor_vsync_hook()` poll loop (39-RESEARCH.md Open Question 2). True
nanosecond-level, instruction-level simultaneity across two localhost sockets
driven from two client objects in one Node process is not achievable from
user space and is **not** what this probe measures. What **is** measured is
the practical overlap that matters to a serialization-authority design: the
text channel's `prof flat 5` command is written to its socket before the
binary channel's in-flight `AdvanceInstructions` command has been
acknowledged by a reply — never awaiting either write before issuing the
other. The actual wall-clock gap between the two `write()` calls is recorded
below (`CONCURRENT_WRITE_GAP_MS`) precisely so a reader can judge how tight
that overlap really was. This figure is a caveat, **never** a threshold
(SCHEMA.md §2.3, README.md convention).

---

## Precondition check (D-16), taken immediately before both runs below

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc
(no output, exit 1 -- no genuine x64sc process alive)
```

Broker `inactive`, zero alive `x64sc` processes. `preflight()` in
`probe-harness.mjs` re-asserts this same pair in code, immediately before
every spawn, and throws rather than warns if either is violated (confirmed
by both runs below: `PREFLIGHT_BROKER inactive` / `PREFLIGHT_X64SC (none)`).

---

## Run 1 — needed correction (probe framing defect, not a machine finding)

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/concurrent-inflight-probe.mjs
PROBE concurrent-inflight-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T21:59:09.321Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 44203
TEXT_PORT 38449
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:44203","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:38449"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 153
BINARY_MONITOR_READY_AFTER_PINGS 1
TEXT_TIME_TO_BIND_MS 1
TEXT_BANNER_LEN 0 matchedPromptRe=false
RESUMED_ONCE_FOR_BOOT_SETTLE
BOOT_SETTLE_WAIT_MS 2500
--- repetition 1 of 3 ---
TEXT_PROF_ON_REP1 matched=true text="(C:$e5d4) Profiling restarted.\n(C:$e5d4) "
RESUMED_FOR_RUN_WINDOW_REP1
RUN_WINDOW_MS_REP1 600
TEXT_RETURN_TO_PROMPT_REP1 matched=true
WRITE_GAP_REP1_MS 0.038
OVERLAP_RESULT_REP1 binaryOk=true textOk=true totalElapsedMs=0 binaryMatchedReqId=true desyncDelta=0 dupDelta=0 unsolicitedCount=3
--- repetition 2 of 3 ---
TEXT_PROF_ON_REP2 matched=true text="Profiling stopped.\n(C:$e5cd) "
RESUMED_FOR_RUN_WINDOW_REP2
RUN_WINDOW_MS_REP2 600
TEXT_RETURN_TO_PROMPT_REP2 matched=true
WRITE_GAP_REP2_MS 0.044
OVERLAP_RESULT_REP2 binaryOk=true textOk=true totalElapsedMs=1 binaryMatchedReqId=true desyncDelta=0 dupDelta=0 unsolicitedCount=3
--- repetition 3 of 3 ---
TEXT_PROF_ON_REP3 matched=true text="Profiling restarted.\n(C:$e5d1) "
RESUMED_FOR_RUN_WINDOW_REP3
RUN_WINDOW_MS_REP3 600
TEXT_RETURN_TO_PROMPT_REP3 matched=true
WRITE_GAP_REP3_MS 0.037
OVERLAP_RESULT_REP3 binaryOk=true textOk=true totalElapsedMs=0 binaryMatchedReqId=true desyncDelta=0 dupDelta=0 unsolicitedCount=3
ALL_WRITE_GAPS_MS: [0,0,0]
CONCURRENT_WRITE_GAP_MS: 0
CONCURRENT_INFLIGHT: clean
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3537 / fail 4
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, audit-root-args.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/concurrent-inflight-run.json
```

```
$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

**Why this run needed correction, not why the numbers above are wrong.**
The derivation still landed on `clean`, and every OVERLAP_RESULT line already
reads correctly — but the first draft of the probe did not yet log the
profiler report's own text (only a boolean `textOk`), so it could not have
satisfied README.md convention 8 ("values are transcribed, never
remembered") for the profiler report's actual content. While adding that
logging, a second, more serious defect surfaced in the same transcript:
`TEXT_PROF_ON_REP2`'s reply reads **`"Profiling stopped.\n(C:$e5cd) "`** —
the reply to a **`prof off`** command — even though rep 2 sent `prof on`.
The real `prof on` reply ("Profiling restarted.") was consumed one command
late, mis-attributed to the *next* command's read. This is the same class
of defect `39-04-SUMMARY.md`'s Deviation 3 already named and fixed for a
different trigger (a binary-owned checkpoint hit's unsolicited announcement
racing a text command's own reply): here, the binary channel's own
`AdvanceInstructions` single-step re-halts the CPU the instant it completes,
and that halt pushes an unsolicited "monitor entered"-shaped announcement
to the **text** console too — not induced by any text command about to read
it. The crude client's `sendAndAwaitPrompt()` (D-13, by design, per its own
header) cannot distinguish that announcement's own prompt-shaped tail from
a real command's reply, so the very next `prof off` cleanup send in rep 1
consumed a stray announcement instead of its own reply, leaving the real
`prof off` reply unread until rep 2's `prof on` call picked it up instead.

**Fix.** A drain step (`awaitBanner()`, mirroring `idle-coexist-probe.mjs`'s
and `foreign-halt-probe.mjs`'s own "capture before trusting" discipline) was
added immediately after each repetition's overlapped-write section resolves
and before any further text command is sent, so any announcement the
binary-side single-step pushed to the text console is drained and logged
rather than left to race the next real command. See Run 2 below: every
`TEXT_PROF_ON_REPn` line now correctly reads "Profiling restarted." in every
repetition, and rep 2's drain step visibly catches 509 bytes of a
late-arriving profiler-report tail that would otherwise have raced the next
send. **This is a probe framing defect, not a finding about the machine or
about `CONCURRENT_INFLIGHT` itself** — the actual overlapped-write mechanism
(the thing this experiment measures) resolved correctly in every repetition
of both runs; only a *subsequent*, non-overlapped bookkeeping command
(`prof off`/`prof on` sequencing between repetitions) was affected. Per
README.md convention 6, this run is recorded here with its reason rather
than discarded; the authoritative measurement is Run 2.

---

## Run 2 — authoritative

Preflight re-verified immediately before this run:

```
$ systemctl --user is-active vice-broker
inactive
$ pgrep -x x64sc
(no output, exit 1)
```

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/concurrent-inflight-probe.mjs
PROBE concurrent-inflight-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T22:01:52.187Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 36705
TEXT_PORT 45609
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:36705","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:45609"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 153
BINARY_MONITOR_READY_AFTER_PINGS 1
TEXT_TIME_TO_BIND_MS 1
TEXT_BANNER_LEN 0 matchedPromptRe=false
RESUMED_ONCE_FOR_BOOT_SETTLE
BOOT_SETTLE_WAIT_MS 2500
```

### Repetition 1 of 3

The exact profiler command sequence used, per `39-RESEARCH.md` Open Question
1's recommendation (`prof on`, resume, run briefly, halt, `prof flat 5`),
recorded here regardless of outcome:

```
--- repetition 1 of 3 ---
TEXT_PROF_ON_REP1 matched=true text="(C:$e5d4) Profiling restarted.\n(C:$e5d4) "
RESUMED_FOR_RUN_WINDOW_REP1
RUN_WINDOW_MS_REP1 600
TEXT_RETURN_TO_PROMPT_REP1 matched=true
WRITE_GAP_REP1_MS 0.054
OVERLAP_RESULT_REP1 binaryOk=true textOk=true totalElapsedMs=1 binaryMatchedReqId=true desyncDelta=0 dupDelta=0 unsolicitedCount=3
CAPTURED_RESPONSES_REP1 [{"tMs":1788818519586,"type":"unknown","requestId":4},{"tMs":1788818519586,"type":"resumed","requestId":4294967295},{"tMs":1788818519586,"type":"registers","requestId":4294967295},{"tMs":1788818519586,"type":"stopped","requestId":4294967295}]
UNSOLICITED_FRAMES_REP1 [{"tMs":1788818519586,"type":"resumed"},{"tMs":1788818519586,"type":"registers"},{"tMs":1788818519586,"type":"stopped"}]
TEXT_PROFILER_REPLY_REP1 matched=true text="Stepping through the next 1 instruction(s).\n.C:e5cd  A5 C6       LDA $C6        - A:00 X:00 Y:0A SP:f3 ..-...Z.    3164621\n(C:$e5cd)         Total      %          Self      %\n------------- ------ ------------- ------\n    585 939  98,5%     585 939  98,5% ffcf                                    \n      8 975   1,5%       4 383   0,7% ff48                                    \n      2 301   0,4%       2 301   0,4% ea87                                    \n      2 223   0,4%       2 223   0,4% ffea                                    \n           46   0,0%            46   0,0% ea1c                                    \n(C:$e5cd) "
TEXT_DRAIN_AFTER_OVERLAP_REP1 bytes=0 (nothing pending)
TEXT_PROF_OFF_CLEANUP_REP1 matched=true text="Profiling stopped.\n(C:$e5cd) "
```

**A previously-unmeasured, reciprocal fact, discovered by this repetition's
own transcript.** `TEXT_PROFILER_REPLY_REP1`'s reply text begins with
`"Stepping through the next 1 instruction(s)."` before the profiler table --
this is the **binary channel's** `AdvanceInstructions` single-step
announcement, pushed unsolicited onto the **text** console and concatenated,
by TCP delivery timing, with the `prof flat 5` command's own report before
either read completed. This is the same family of cross-channel visibility
`39-04-SUMMARY.md` already recorded (a binary-owned checkpoint hit pushes an
announcement to the text console too) but triggered here by a plain
single-step rather than a checkpoint hit -- a broader trigger for the same
underlying behaviour, worth carrying forward alongside `39-04`'s finding.
This concatenation did **not** lose or corrupt either payload: the crude
client's `sendAndAwaitPrompt()` accumulates the whole buffer until the
trailing prompt regex matches, so both pieces of text are present, in
order, in one captured reply -- exactly the honest evidence README.md
convention 1 requires, "a summary written in place of output is not
evidence."

### Repetition 2 of 3

```
--- repetition 2 of 3 ---
TEXT_PROF_ON_REP2 matched=true text="Profiling restarted.\n(C:$e5cd) "
RESUMED_FOR_RUN_WINDOW_REP2
RUN_WINDOW_MS_REP2 600
TEXT_RETURN_TO_PROMPT_REP2 matched=true
WRITE_GAP_REP2_MS 0.023
OVERLAP_RESULT_REP2 binaryOk=true textOk=true totalElapsedMs=1 binaryMatchedReqId=true desyncDelta=0 dupDelta=0 unsolicitedCount=3
CAPTURED_RESPONSES_REP2 [{"tMs":1788818520593,"type":"unknown","requestId":6},{"tMs":1788818520593,"type":"resumed","requestId":4294967295},{"tMs":1788818520593,"type":"registers","requestId":4294967295},{"tMs":1788818520593,"type":"stopped","requestId":4294967295}]
UNSOLICITED_FRAMES_REP2 [{"tMs":1788818520593,"type":"resumed"},{"tMs":1788818520593,"type":"registers"},{"tMs":1788818520593,"type":"stopped"}]
TEXT_PROFILER_REPLY_REP2 matched=true text="Stepping through the next 1 instruction(s).\n.C:e5d1  8D 92 02    STA $0292      - A:00 X:00 Y:0A SP:f3 ..-...Z.    3773956\n(C:$e5d1) "
TEXT_DRAIN_AFTER_OVERLAP_REP2 bytes=509 text="        Total      %          Self      %\n------------- ------ ------------- ------\n    567 846  98,5%     567 846  98,5% ffcf                                    \n      8 468   1,5%       4 131   0,7% ff48                                    \n      2 183   0,4%       2 183   0,4% ea87                                    \n      2 109   0,4%       2 109   0,4% ffea                                    \n           23   0,0%            23   0,0% ea1c                                    \n(C:$e5d1) "
TEXT_PROF_OFF_CLEANUP_REP2 matched=true text="Profiling stopped.\n(C:$e5d1) "
```

Rep 2 is the clearest instance of the drain step doing real work: the
`prof flat 5` reply's own `sendAndAwaitPrompt()` matched an EARLIER,
incomplete-looking prompt boundary inside the still-arriving profiler table
(the crude client's documented limitation -- it does not solve framing that
survives a prompt-shaped substring inside a command's own output, D-13), so
509 bytes of the real profiler table's tail arrived on the socket
**after** that read had already resolved. The drain step immediately after
picked those bytes up and logged them explicitly (`TEXT_DRAIN_AFTER_OVERLAP_REP2`)
rather than letting them silently corrupt the next command's read. No data
was lost -- the drained bytes are the tail half of the same profiler table
already partially captured in `TEXT_PROFILER_REPLY_REP2`, both halves shown
above in full.

### Repetition 3 of 3

```
--- repetition 3 of 3 ---
TEXT_PROF_ON_REP3 matched=true text="Profiling restarted.\n(C:$e5d1) "
RESUMED_FOR_RUN_WINDOW_REP3
RUN_WINDOW_MS_REP3 600
TEXT_RETURN_TO_PROMPT_REP3 matched=true
WRITE_GAP_REP3_MS 0.040
OVERLAP_RESULT_REP3 binaryOk=true textOk=true totalElapsedMs=0 binaryMatchedReqId=true desyncDelta=0 dupDelta=0 unsolicitedCount=3
CAPTURED_RESPONSES_REP3 [{"tMs":1788818521213,"type":"unknown","requestId":8},{"tMs":1788818521213,"type":"resumed","requestId":4294967295},{"tMs":1788818521213,"type":"registers","requestId":4294967295},{"tMs":1788818521213,"type":"stopped","requestId":4294967295}]
UNSOLICITED_FRAMES_REP3 [{"tMs":1788818521213,"type":"resumed"},{"tMs":1788818521213,"type":"registers"},{"tMs":1788818521213,"type":"stopped"}]
TEXT_PROFILER_REPLY_REP3 matched=true text="Stepping through the next 1 instruction(s).\n.C:e5cd  A5 C6       LDA $C6        - A:00 X:00 Y:0A SP:f3 ..-...Z.    4402948\n(C:$e5cd)         Total      %          Self      %\n------------- ------ ------------- ------\n    586 151  98,5%     586 151  98,5% ffcf                                    \n      8 749   1,5%       4 273   0,7% ff48                                    \n      2 242   0,4%       2 242   0,4% ea87                                    \n      2 166   0,4%       2 166   0,4% ffea                                    \n           46   0,0%            46   0,0% ea1c                                    \n(C:$e5cd) "
TEXT_DRAIN_AFTER_OVERLAP_REP3 bytes=0 (nothing pending)
TEXT_PROF_OFF_CLEANUP_REP3 matched=true text="Profiling stopped.\n(C:$e5cd) "
```

### Closing lines

```
ALL_WRITE_GAPS_MS: [0,0,0]
CONCURRENT_WRITE_GAP_MS: 0
CONCURRENT_OVERLAP_CHARACTERISATION: stock VICE services both monitor servers from one single-threaded poll loop; the measured overlap is 'text-channel write issued before the binary channel's in-flight command was acknowledged', never instruction-level simultaneity
CONCURRENT_INFLIGHT: clean
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/concurrent-inflight-run.json
```

```
$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

**`TEST_AUTOMATED_BASELINE_FILES` reads only two files here** (`anno-import.test.ts`,
`anno-register.test.ts`) versus Run 1's three (which also carried
`audit-root-args.test.ts`) -- both are the project's own recorded
intermittent flakes (`host-scripts.test.ts`-class), unrelated to this plan,
observed as they were at the time of each run and never smoothed, per
README.md convention 4.

### On the profiler command sequence (39-RESEARCH.md Open Question 1)

The exact sequence used, recorded regardless of outcome per the task's own
instruction: `prof on` (halts the CPU as any text command does; enables the
profiler) -> one binary-channel `EXIT` (resumes, starts the recorded run
window) -> `sleep(600ms)` (the run window; profiler accumulates cycles) ->
one text-channel `r` (halts the CPU again, returns to a monitor prompt) ->
**the measured overlap itself**: binary `AdvanceInstructions(count=1)` and
text `prof flat 5`, both writes issued before either reply is awaited ->
`prof off` (cleanup, so each repetition's own profiler stats start fresh).
Every `prof on` reply across all three repetitions of the authoritative run
reads "Profiling restarted." -- confirming, by direct observation, that
`prof flat 5` alone does **not** need a preceding `prof on` in the same
command (this run always sent one, so the alternative -- profiling running
unconditionally -- was not itself exercised; this run answers "does the
recommended sequence work", not "is `prof on` strictly necessary every
time").

No substitution of the halting text-side command was needed: `prof on` /
`prof flat 5` produced fully recognisable, correctly-framed replies (once
the drain-step fix above was in place) in every one of the three
repetitions of the authoritative run. `SUBSTITUTION:` therefore does not
appear as a column-0 line in this file -- the profiler report was supported
on this build and no fallback to `memmapshow` was exercised.

### Discipline check

```
$ grep -ac 'probe-harness.mjs' concurrent-inflight-probe.mjs
1
$ grep -ac 'textmon-probe-client.mjs' concurrent-inflight-probe.mjs
1
$ grep -av '^[[:space:]]*[/*]' concurrent-inflight-probe.mjs | grep -c 'writeUInt32LE('
0
$ grep -av '^[[:space:]]*[/*]' concurrent-inflight-probe.mjs | grep -cE '(spawn|spawnSync|execFile|execFileSync)\([^)]*["'"'"']x64sc["'"'"']'
0
```

`concurrent-inflight-probe.mjs` imports `probe-harness.mjs` and
`textmon-probe-client.mjs`, builds no wire frame itself (the one wire-shaping
call it needs, `advanceInstructionsBody()`, is imported from the shipped
`stock-protocol.ts` via a new re-export added to `probe-harness.mjs` -- see
`39-05-SUMMARY.md` Deviations), and spawns the emulator only through
`spawnVice(VICE_STOCK, argv)`, never by bare name.

---

## Derivation

Per `SCHEMA.md` §2.3: `clean` iff all six replies (3 repetitions x 2
channels) arrive within the stated 15s budget, each matched to its own
request id, with zero desync bytes and zero duplicate replies.

Across all three repetitions of the authoritative run: `binaryOk=true` and
`textOk=true` in every repetition (six replies total, all arrived), every
`totalElapsedMs` is 0-1ms (nowhere near the 15,000ms budget, so nothing
"exceeded the budget" and nothing needed a retry), `binaryMatchedReqId=true`
in every repetition (a `response` event with a concrete, non-broadcast
request id was observed for each `AdvanceInstructions` reply, and since
exactly one binary request was ever pending during any overlap window, that
response event is unambiguously the reply to that request -- no other
candidate could have produced it), and `desyncDelta`/`dupDelta` both read
`0` in every repetition. None of `degraded`'s triggers (an exceeded budget,
a needed retry, or a recovered desync byte) and none of `corrupts`'s
triggers (a lost reply, a wrong-request-id match, a pending request resolved
by an event, or a jam) are present in any repetition. `not-taken` does not
apply either -- the overlap was produced, and reproduced, in all three
repetitions. The frozen rule therefore derives unambiguously: **`clean`**.

No `## ACCEPTED LIMIT` section is needed.

---

<!-- Bare column-0 outcome lines. Final occurrence wins (README.md convention 7). -->

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
CONCURRENT_WRITE_GAP_MS: 0
CONCURRENT_INFLIGHT: clean
