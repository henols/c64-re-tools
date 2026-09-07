# Phase 39, plan 39-04 — `CROSS_CHANNEL_RESUME` (Task 2)

Owned by `39-04`. Measures the fourth of the phase's seven gate inputs, per
`SCHEMA.md` §2.4's frozen derivation. Follows the evidence conventions in
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
`probe-harness.mjs` re-asserts this same pair in code, immediately before
every spawn, and throws rather than warns if either is violated.

---

## Run 1 — VOIDED (direction two never established a halt: missing resume-after-arm)

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/cross-channel-resume-probe.mjs
PROBE cross-channel-resume-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T21:32:59.736Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 46699
TEXT_PORT 41637
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:46699","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:41637"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 155
BINARY_MONITOR_READY_AFTER_PINGS 1
ALIVE_ANCHOR_CHECKPOINT_ID 1
RESUMED_ONCE_FOR_BOOT_SETTLE
ALIVE_ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2020}
TEXT_TIME_TO_BIND_MS 0
TEXT_BANNER_MATCHED_PROMPT false len=21480
=== direction one, repetition 1 of 2 ===
D1_SW_BEFORE matched=true value=5031937
D1_REGISTERS_READ_WHILE_HALTED ok=true count=10
D1_RESUME_ACCEPTED true
D1_SW_AFTER matched=true value=6250610
D1_MACHINE_RAN_AGAIN true
DIRECTION1_REP_1: status=clean registersOk=true memoryOk=true resumeAccepted=true swBefore=5031937 swAfter=6250610 machineRanAgain=true desyncDelta=0 dupDelta=0
=== direction two, repetition 1 of 2 ===
D2_STOP_ANCHOR_ID 2
D2_STOP_ANCHOR_HIT {"hit":false,"elapsedMs":14999}
DIRECTION2_REP_1: status=not-taken (the stopping checkpoint never recorded its hit within budget -- no binary-owned halt could be established)
=== direction one, repetition 2 of 2 ===
D1_SW_BEFORE matched=true value=16137578
D1_REGISTERS_READ_WHILE_HALTED ok=true count=10
D1_RESUME_ACCEPTED true
D1_SW_AFTER matched=true value=17336594
D1_MACHINE_RAN_AGAIN true
DIRECTION1_REP_2: status=clean registersOk=true memoryOk=true resumeAccepted=true swBefore=16137578 swAfter=17336594 machineRanAgain=true desyncDelta=0 dupDelta=0
=== direction two, repetition 2 of 2 ===
D2_STOP_ANCHOR_ID 3
D2_STOP_ANCHOR_HIT {"hit":false,"elapsedMs":15002}
DIRECTION2_REP_2: status=not-taken (the stopping checkpoint never recorded its hit within budget -- no binary-owned halt could be established)
DIRECTION1_OVERALL: clean
DIRECTION2_OVERALL: not-taken
## DIVERGENCE: direction one (text-halt, binary-resume) read clean; direction two (binary-halt, text-resume) read not-taken. Resolving to the worse value.
CROSS_CHANNEL_RESUME: corrupts
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/cross-channel-resume-run.json
```

**VOID reason.** Direction one is entirely clean (both repetitions). Direction
two's stopping checkpoint never once recorded its own hit within a generous
15-second budget, in either repetition — the checkpoint could not be confirmed
armed and hitting at all. Diagnosed live against a throwaway two-checkpoint
scratch script: arming the STOPPING checkpoint is itself a binary command,
and per this exact launch shape's already-established rule (`probe-harness.mjs`'s
`resumeExecution()` doc comment, written by `39-03`: any command reaching the
binary monitor re-halts the CPU once it is running, until the *next* command),
`CheckpointSet` for the stopping checkpoint halted the machine the instant it
was sent. Nothing in the probe's first draft then resumed it, so the machine
sat halted indefinitely and the stopping checkpoint at `$EA31` was never
*reached* by the CPU to fire at all. This is not a fact about cross-channel
resume — it never reached the point of establishing a binary-owned halt in
the first place. Fixed by sending one `EXIT` immediately after arming the
stopping checkpoint (see Run 2, `D2_RESUMED_AFTER_ARMING_STOP`), after which
the same checkpoint hits within single-digit milliseconds in every
repetition below.

---

## Run 2 — VOIDED (direction two's `sw` reply raced an unsolicited entry banner)

```
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/cross-channel-resume-probe.mjs
PROBE cross-channel-resume-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T21:36:46.056Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 41467
TEXT_PORT 43363
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:41467","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:43363"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 155
BINARY_MONITOR_READY_AFTER_PINGS 1
ALIVE_ANCHOR_CHECKPOINT_ID 1
RESUMED_ONCE_FOR_BOOT_SETTLE
ALIVE_ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2020}
TEXT_TIME_TO_BIND_MS 1
TEXT_BANNER_MATCHED_PROMPT false len=21600
=== direction one, repetition 1 of 2 ===
D1_SW_BEFORE matched=true value=5031937
D1_REGISTERS_READ_WHILE_HALTED ok=true count=10
D1_RESUME_ACCEPTED true
D1_SW_AFTER matched=true value=6250610
D1_MACHINE_RAN_AGAIN true
DIRECTION1_REP_1: status=clean registersOk=true memoryOk=true resumeAccepted=true swBefore=5031937 swAfter=6250610 machineRanAgain=true desyncDelta=0 dupDelta=0
=== direction two, repetition 1 of 2 ===
D2_STOP_ANCHOR_ID 2
D2_RESUMED_AFTER_ARMING_STOP
D2_STOP_ANCHOR_HIT {"hit":true,"elapsedMs":4}
D2_TEXT_SW matched=true value=null
D2_TEXT_REGISTER_VIEW matched=true len=32
D2_TEXT_EXIT matched=false
D2_POST_RELEASE_HITS 60 machineRanAgain=true
DIRECTION2_REP_1: status=corrupts textReadsOk=false sw=null exitMatched=false machineRanAgain=true desyncDelta=0 dupDelta=0
=== direction one, repetition 2 of 2 ===
D1_SW_BEFORE matched=true value=27027000
D1_REGISTERS_READ_WHILE_HALTED ok=true count=10
D1_RESUME_ACCEPTED true
D1_SW_AFTER matched=true value=28226017
D1_MACHINE_RAN_AGAIN true
DIRECTION1_REP_2: status=clean registersOk=true memoryOk=true resumeAccepted=true swBefore=27027000 swAfter=28226017 machineRanAgain=true desyncDelta=0 dupDelta=0
=== direction two, repetition 2 of 2 ===
D2_STOP_ANCHOR_ID 3
D2_RESUMED_AFTER_ARMING_STOP
D2_STOP_ANCHOR_HIT {"hit":true,"elapsedMs":2}
D2_TEXT_SW matched=true value=null
D2_TEXT_REGISTER_VIEW matched=true len=148
D2_TEXT_EXIT matched=false
D2_POST_RELEASE_HITS 60 machineRanAgain=true
DIRECTION2_REP_2: status=corrupts textReadsOk=false sw=null exitMatched=false machineRanAgain=true desyncDelta=0 dupDelta=0
DIRECTION1_OVERALL: clean
DIRECTION2_OVERALL: corrupts
## DIVERGENCE: direction one (text-halt, binary-resume) read clean; direction two (binary-halt, text-resume) read corrupts. Resolving to the worse value.
CROSS_CHANNEL_RESUME: corrupts
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/cross-channel-resume-run.json
```

**VOID reason.** The stopping checkpoint now hits correctly (single-digit
milliseconds, both reps). But `D2_TEXT_SW value=null` -- the `sw` command's
reply matched `PROMPT_RE` but contained no parseable `Stopwatch: N` line.
Diagnosed live against a throwaway scratch script that captured the raw
bytes: the moment the binary-owned stopping checkpoint hits, VICE pushes an
**unsolicited "monitor entered" announcement to the text console** --
`#1 (Trace exec ea31) ...` / `#2 (Stop on exec ea31) ...` -- the SAME kind of
breakpoint-trace text `39-04-SUMMARY.md`'s Task 1 already found streaming
continuously while a checkpoint is armed, except here it is the terminal
announcement of the checkpoint's *own stopping hit*, and it arrives BEFORE
this probe sends its first command. That announcement happens to end in the
exact same prompt-shaped string (`(C:$ea31) `) that a real command's own
reply would end in. `textmon-probe-client.mjs`'s crude framing is
DOCUMENTED not to distinguish an unsolicited push from a command's own reply
(its own header: *"This client does NOT distinguish a prompt-shaped substring
appearing inside a command's own OUTPUT from the real terminator... solving
that properly is a later phase's OWNED scope (`CHAN-03`)"*) -- so this
probe's first `sendAndAwaitPrompt(textSock, "sw", ...)` call consumed the
unsolicited announcement instead of `sw`'s real reply, and `sw`'s ACTUAL
`Stopwatch: N` answer was delivered as the first line of the FOLLOWING `r`
command's reply instead (confirmed against the raw bytes in the same
diagnostic script: `"r"`'s captured text began with `Stopwatch: 4063934`
rather than the expected register table).

**A second, independently corrected issue in this same run**: the derivation
gated on `d2.exitMatched` (whether `x`'s own reply framed within budget),
which read `false` in both repetitions for the same reason Task 1 already
documented for its own release step -- the alive-anchor checkpoint (still
armed throughout, non-stopping) resumes trace-flooding the text console the
instant the CPU runs again, so `x`'s own reply never settles into a clean
prompt within the 10-second budget. This is a benign, already-understood
framing artifact, not evidence against the resume -- SCHEMA.md §2.4's own
principle ("a monitor accepting a resume is not evidence the machine ran")
cuts both ways: a monitor not framing a reply is likewise not evidence it
*didn't*. Gating on it was corrected out of the derivation; the independent,
passive binary-side bracket (`D2_POST_RELEASE_HITS`) is the only signal that
should decide `machineRanAgain`, and it already read `true` (`60` hits) in
both repetitions of this very run.

**Fix applied for the authoritative run**: drain the unsolicited entry
announcement via `awaitBanner()` immediately after the stopping checkpoint's
hit is confirmed, BEFORE sending `sw`/`r` for real (mirroring
`idle-coexist-probe.mjs`'s own "capture before trusting" discipline for the
connect banner) -- and stop gating `CROSS_CHANNEL_RESUME`'s derivation on
`x`'s own reply framing.

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
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/cross-channel-resume-probe.mjs
PROBE cross-channel-resume-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T21:43:16.306Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 45545
TEXT_PORT 40027
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:45545","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:40027"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 153
BINARY_MONITOR_READY_AFTER_PINGS 1
ALIVE_ANCHOR_CHECKPOINT_ID 1
RESUMED_ONCE_FOR_BOOT_SETTLE
ALIVE_ANCHOR_FIRST_HIT {"hit":true,"elapsedMs":2019}
TEXT_TIME_TO_BIND_MS 0
TEXT_BANNER_MATCHED_PROMPT false len=21600
=== direction one, repetition 1 of 2 ===
D1_SW_BEFORE matched=true value=5031937
D1_REGISTERS_READ_WHILE_HALTED ok=true count=10
D1_MEMORY_READ_WHILE_HALTED ok=true len=16 hex=8556200fbca561c988900320d4ba20cc
D1_RESUME_ACCEPTED true
D1_SW_AFTER matched=true value=6250610
D1_MACHINE_RAN_AGAIN true
DIRECTION1_REP_1: status=clean registersOk=true memoryOk=true resumeAccepted=true swBefore=5031937 swAfter=6250610 machineRanAgain=true desyncDelta=0 dupDelta=0
=== direction two, repetition 1 of 2 ===
D2_STOP_ANCHOR_ID 2
D2_RESUMED_AFTER_ARMING_STOP
D2_STOP_ANCHOR_HIT {"hit":true,"elapsedMs":5}
D2_DRAINED_ENTRY_BANNER matched=true len=10
D2_TEXT_SW matched=true value=16150527
D2_TEXT_REGISTER_VIEW matched=true len=116
D2_TEXT_EXIT matched=false
D2_POST_RELEASE_HITS 60 machineRanAgain=true
DIRECTION2_REP_1: status=clean textReadsOk=true sw=16150527 exitMatched=false machineRanAgain=true desyncDelta=0 dupDelta=0
=== direction one, repetition 2 of 2 ===
D1_SW_BEFORE matched=true value=27027000
D1_REGISTERS_READ_WHILE_HALTED ok=true count=10
D1_MEMORY_READ_WHILE_HALTED ok=true len=16 hex=8556200fbca561c988900320d4ba20cc
D1_RESUME_ACCEPTED true
D1_SW_AFTER matched=true value=28226017
D1_MACHINE_RAN_AGAIN true
DIRECTION1_REP_2: status=clean registersOk=true memoryOk=true resumeAccepted=true swBefore=27027000 swAfter=28226017 machineRanAgain=true desyncDelta=0 dupDelta=0
=== direction two, repetition 2 of 2 ===
D2_STOP_ANCHOR_ID 3
D2_RESUMED_AFTER_ARMING_STOP
D2_STOP_ANCHOR_HIT {"hit":true,"elapsedMs":4}
D2_DRAINED_ENTRY_BANNER matched=true len=252
D2_TEXT_SW matched=true value=38123161
D2_TEXT_REGISTER_VIEW matched=true len=116
D2_TEXT_EXIT matched=false
D2_POST_RELEASE_HITS 60 machineRanAgain=true
DIRECTION2_REP_2: status=clean textReadsOk=true sw=38123161 exitMatched=false machineRanAgain=true desyncDelta=0 dupDelta=0
DIRECTION1_OVERALL: clean
DIRECTION2_OVERALL: clean
CROSS_CHANNEL_RESUME: clean
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3536 / fail 5
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, audit-root-args.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/cross-channel-resume-run.json
```

```
$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

`D1_MEMORY_READ_WHILE_HALTED` for both repetitions is elided from the two
voided runs above (it was already printed and identical there) and shown in
full here: `ok=true len=16 hex=8556200fbca561c988900320d4ba20cc` -- the same
KERNAL ROM window byte prefix `39-03`'s own idle-coexist measurement recorded
(`8556200fbca561c988900320d4ba20cc...`), confirming the 16-byte read at
`$E000-$E00F` returns genuine, correct memory content while the machine is
halted by the OTHER (text) channel, not garbage or a stale buffer.

**`fail 5` in this run's `TEST_AUTOMATED_BASELINE`** (`audit-root-args.test.ts`
alongside the same `anno-import.test.ts` / `anno-register.test.ts` pair) is
the same pre-existing, unowned `zz-scratch-*` ENOENT race this project has
already characterized as a known intermittent flake, not a regression and
not caused by this plan -- recorded as observed, per README.md convention 4.

### Direction table (both repetitions)

| Direction | Rep | Cross-channel reads | Resume/release accepted | Independent liveness confirmed | Desync/dup delta | Status |
|---|---|---|---|---|---|---|
| 1 (halt text, resume binary) | 1 | registers ok, memory ok | `EXIT` accepted | `sw` 5031937 → 6250610 (advanced) | 0 / 0 | clean |
| 1 (halt text, resume binary) | 2 | registers ok, memory ok | `EXIT` accepted | `sw` 27027000 → 28226017 (advanced) | 0 / 0 | clean |
| 2 (halt binary, resume text) | 1 | `sw`=16150527, register view ok | `x` sent (own reply unframed, not gated on) | non-stopping bracket: 60 hits/1s (advanced) | 0 / 0 | clean |
| 2 (halt binary, resume text) | 2 | `sw`=38123161, register view ok | `x` sent (own reply unframed, not gated on) | non-stopping bracket: 60 hits/1s (advanced) | 0 / 0 | clean |

Both directions read `clean` in both repetitions of the authoritative run --
no `## DIVERGENCE` section is needed (the two voided runs above each carried
one; both are retained above rather than silently discarded, per README.md
convention 6, and neither resolves any differently once resolved to the
worse value, which is why they show `corrupts` for reasons this file explains
were probe defects, not genuine machine behavior).

---

## A related, previously-unmeasured fact: a binary-owned halt is visible on the text channel too

Task 1 (`39-foreign-halt.md`) measured that a TEXT-induced halt is `visible`
on the BINARY channel, via an unsolicited `STOPPED` (0x62) frame. Building
this task's Direction 2 surfaced the RECIPROCAL fact, not previously
measured anywhere in this project: the moment a BINARY-owned checkpoint
(stopping OR non-stopping) hits, VICE pushes an unsolicited "monitor entered"
announcement to the TEXT console -- the same `#N (Trace|Stop ... exec ea31)`
breakpoint-notification text, ending in a real prompt (`(C:$ea31) `) -- with
**no command from the text client at all**. This is why
`D2_DRAINED_ENTRY_BANNER` above shows real, non-empty content (`len=10` /
`len=252`) captured purely passively, before this probe's first text command
was sent. Combined with Task 1's finding, the picture for a later
serialization authority is now symmetric: a halt on EITHER channel produces
an unsolicited, observable signal on the OTHER, though the two signals take
different shapes (a framed `STOPPED` event on the binary wire vs. free-form
breakpoint-notification text on the text console) and the text-side signal
is currently only decodable by the same crude, non-robust framing this
phase's own `textmon-probe-client.mjs` documents as out of scope (`D-13`,
`CHAN-03`'s eventual work).

---

<!-- Bare column-0 outcome lines. Final occurrence wins (README.md convention 7). -->

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3536 / fail 5
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts, audit-root-args.test.ts
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
CROSS_CHANNEL_RESUME: clean
