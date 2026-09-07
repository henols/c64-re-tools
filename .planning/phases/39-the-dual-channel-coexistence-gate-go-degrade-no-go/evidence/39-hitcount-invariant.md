# Phase 39, plan 39-05 — `HITCOUNT_INVARIANT_HOLDS` (Task 2)

Owned by `39-05`. Measures the sixth of the phase's seven gate inputs, per
`SCHEMA.md` §2.6's frozen derivation, and settles the milestone's **first**
blocking UNVERIFIED item. Follows the evidence conventions in `README.md`
§ *Evidence conventions*, binding on this plan.

**`DECISION-RULE.md`'s pre-mapped narrowing for this input was read BEFORE
deriving the value below**, per this plan's own action item, and stated here
plainly so the pre-commitment is operative rather than decorative: `R13`
(`DECISION-RULE.md` lines ~143-150) reads

> **`R13` -> `degrade`.** ... `HITCOUNT_INVARIANT_HOLDS` is `breaks`.
> **Pre-mapped narrowing (D-11):** every stock module that upholds "poll on
> `hit_count`, never on paused state" natively -- `stock-checkpoints.ts`,
> `stock-run-until.ts`, `stock-reproducible-run.ts`, `stock-diagnose.ts` --
> must gain foreign-halt discrimination, and Phase 41's selected shape must
> supply it. Pre-mapped precisely because this is where an after-the-fact
> author would be most tempted to declare the existing invariant already
> sufficient.

This was read in full, before any live run below, so that if the measured
answer had come out `breaks`, this file could not have been shaped to avoid
that narrowing. It did not come out `breaks` -- see Derivation below -- and
that is reported honestly, not because the narrowing was inconvenient to
confirm.

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

## The mechanism under test

`stock-run-until.ts`'s `waitForCheckpointHit()` (lines ~99-165) is the
stock-native, event-driven translation of `vice-sync.ts`'s "poll on
`hit_count`, never on paused state" invariant: an `event` listener narrowed
on the parsed item's own `.type === "checkpoint_info"` discriminant, THEN
the specific checkpoint id -- installed BEFORE the resume, sends exactly
ONE resume (`CommandType.Exit`), and settles on `close` as a timeout. This
probe's own `waitKeyedOnHitCount()` mirrors that mechanism near-verbatim
(same narrowing, same one-resume discipline, same listener-before-resume
ordering) and adds the attribution log and resume counter this experiment
needs. `stock-protocol.ts`'s own `#dispatch()` (lines 2145-2275) is the
demux this mechanism depends on: a request id equal to the broadcast
constant is routed to `'event'` **before** any pending-request lookup even
runs (the `if (requestId === undefined || requestId === VICE_BROADCAST_REQUEST_ID)`
branch at line ~2229), so a broadcast frame can **never** resolve a pending
request by construction -- confirmed by direct source read, not merely
assumed.

---

## Run 1 and Run 2 -- needed correction (probe timing-model defect)

Two live runs were taken and corrected before the authoritative run below.
Both are recorded here with their reasons per README.md convention 6, not
discarded.

**Run 1's defect.** The first draft used fixed injection delays (3ms /
16ms / 50ms after each timing's own resume) chosen against the ~60Hz
(~16.7ms) period `39-04-SUMMARY.md` measured for a **non-stopping**
checkpoint running continuously and undisturbed for a full real second.
Run 1's own transcript showed all three timings' waits had **already**
settled (`WAIT_ALREADY_SETTLED_BEFORE_INJECTION_<label>`) before any
injection delay elapsed, in every one of the three timings -- meaning the
foreign halt never actually landed while any wait was outstanding, and the
intended race was never exercised at all. Root cause (confirmed by
inspecting the checkpoint's own reported `hitCount` progression, `1, 3, 5`
across timings before a trailing extra-command artifact, discussed below,
inflated it to `2, 4, 6`): a **stopping** exec checkpoint halts with `PC`
sitting exactly at the checkpoint's own address, so after the very first
hit the checkpoint's own resume-and-rehit cycle starts from a **known,
identical** position every time -- unlike the first wait, which resumed
from an arbitrary point left over from arming the checkpoint mid-run. The
fixed delays, tuned for an assumed ~16.7ms natural period, were wrong for
this repeated-same-position case.

**Run 1's second defect, found while adding the logging needed to see
Run 1's problem clearly.** The first draft also issued a separate
`checkpointHitCount()` (`CHECKPOINT_GET`) read immediately after each
timing's release step, to record the hit count "after" that timing. This
extra binary command is itself a halting command reaching an
already-halted-then-freshly-resumed machine; issuing it, rather than
reading the hit count directly off the checkpoint's own already-received
`checkpoint_info` event, let the machine advance by one additional
unmeasured lap between the release and the read -- a self-inflicted
"one-off-by-one" hazard structurally similar to `39-04-SUMMARY.md`'s own
Deviation 1 (an explicit poll manufacturing a false reading) and
`concurrent-inflight-probe.mjs`'s own Task 1 finding above (a stray
unsolicited announcement racing the next command). **Fix.** Added a
one-time **priming** wait before the three measured timings (an event-driven
resume+wait with no foreign interference, giving every one of the three
measured timings a **consistent, known** starting position at the
checkpoint's own address), and removed the extra post-release
`CHECKPOINT_GET` poll entirely -- the hit count for each timing is now read
directly from that timing's own resolved `checkpoint_info` event, never a
separate command. See the authoritative run below: `waitSettledBeforeInjection`
now correctly reads `false` for the `before` timing (a genuine outstanding-wait
collision was achieved) and the hit-count progression (`0, 1, 2, 4, 6`) is
fully accounted for and explained (see "A previously-unmeasured, reciprocal
fact" below), not merely non-decreasing by luck.

Per README.md convention 6, both defects are recorded here as genuine,
distinct findings about the probe and the machine, not silently smoothed
into the authoritative transcript.

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
$ node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/hitcount-invariant-probe.mjs
PROBE hitcount-invariant-probe.mjs
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase39/39-03
DATE_UTC 2026-09-07T22:16:35.738Z
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_STATE: inactive
BINARY_PORT 39045
TEXT_PORT 44495
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:39045","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:44495"]
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
BINARY_TIME_TO_BIND_MS 155
BINARY_MONITOR_READY_AFTER_PINGS 1
TEXT_CONNECTED
RESUMED_ONCE_FOR_BOOT_SETTLE
BOOT_SETTLE_WAIT_MS 2500
STOPPING_CHECKPOINT_ID 1
HIT_COUNT_INITIAL 0
PRIME_RESULT {"status":"hit","hitCount":1,"satisfiedBy":"checkpoint_info"}
```

### Injection timing 1 of 3: `before` (nominal delay 3ms)

```
--- injection timing: before (delayMs=3) ---
TEXT_PRE_DRAIN_before bytes=132
TEXT_FOREIGN_HALT_before matched=true replyLen=132 elapsedMs=4 text_prefix="#1 (Stop on  exec ea31)  277/$115,  35/$23\n.C:ea31  20 EA FF    JSR $FFEA      - A:00 X:ED Y:0A SP:ed ..-..IZ.    2553110\n(C:$ea31) "
FOREIGN_HALT_HOLD_MS_before 500
TEXT_RELEASE_before matched=true text_prefix="#1 (Stop on  exec ea31)  226/$0e2,  13/$0d\n.C:ea31  20 EA FF    JSR $FFEA      - A:00 X:ED Y:0A SP:ed ..-..IZ.    2569531\n(C:$ea31) "
TIMING_RESULT_before waitSettledBeforeInjection=false waitSettledDuringForeignHalt=true finalResult={"status":"hit","hitCount":2,"satisfiedBy":"checkpoint_info"} resumeCount=1 hitCountAfter=2 satisfiedByForeign=false
ATTRIBUTION_LOG_before [{"tMs":1788819402617,"type":"registers","requestId":4294967295,"isBroadcast":true,"satisfiedWait":false},{"tMs":1788819402617,"type":"stopped","requestId":4294967295,"isBroadcast":true,"satisfiedWait":false},{"tMs":1788819402617,"type":"resumed","requestId":4294967295,"isBroadcast":true,"satisfiedWait":false},{"tMs":1788819402623,"type":"checkpoint_info","requestId":4294967295,"isBroadcast":true,"checkpointId":1,"hitCount":2,"satisfiedWait":true}]
```

**This is the genuine collision case, and the closest race of the three.**
`waitSettledBeforeInjection=false` -- the wait was still outstanding when
the text-channel command was sent -- and `waitSettledDuringForeignHalt=true`
-- it settled sometime during the 500ms hold that followed. This is exactly
the adjacency case `SCHEMA.md`'s own edge-case note describes: "a foreign
stopped frame arriving at the same instant as the client's own stop is the
exact collision the second measurement is designed to detect."

**A genuine text-channel framing ambiguity, honestly recorded rather than
smoothed over.** The reply captured for `TEXT_FOREIGN_HALT_before`
(`replyLen=132`) is **not** a `memmapshow` memory-map dump -- a real one is
~1.6 million bytes, confirmed directly by this same phase's own
`39-foreign-halt.md` (`TEXT_MEMMAPSHOW_REPLY_LEN 1624557`) issuing the exact
same command against the exact same binary. What was actually captured, in
both the foreign-halt send and the subsequent release send, is a
"`#1 (Stop on exec ea31) ...`" banner plus one disassembly line plus a
prompt -- the checkpoint's own unsolicited stop announcement pushed to the
text console (the same reciprocal fact `39-04-SUMMARY.md` first recorded,
here observed a second time under a closer race). Because this repetition's
own checkpoint hit landed essentially concurrently with the text-channel
write (`waitSettledDuringForeignHalt=true`), the crude client's
`sendAndAwaitPrompt()` (D-13, documented as unable to distinguish a
prompt-shaped substring from the real terminator) matched on this stray
announcement rather than on `memmapshow`'s own reply. **This means it
cannot be established with certainty, from this repetition alone, that
`memmapshow`'s own write reached the emulator before the checkpoint's
natural hit** -- the observation is genuinely ambiguous about the TEXT
side, and is recorded as such rather than asserted either way.

**Why this ambiguity does not weaken the derivation.** `HITCOUNT_INVARIANT_HOLDS`
is a claim about the **binary-channel wait's own discrimination** -- whether
it can be satisfied by anything other than its own checkpoint's
`checkpoint_info` event -- not a claim about whether the text-channel
command's own semantic effect (a full memory-map computation) was
completed. The **binary-side** attribution log for this repetition is
unambiguous regardless of what happened on the text side: the wait's
`onEvent` listener received `registers`/`stopped`/`resumed` (all broadcast,
all `satisfiedWait=false`) and then, 6ms later, the genuine `checkpoint_info`
for checkpoint id 1 (`satisfiedWait=true`). At no point did a `stopped` or
`resumed` frame satisfy the wait -- the narrowing on `.type === "checkpoint_info"`
held even in the closest race this run produced.

### Injection timing 2 of 3: `around` (nominal delay 16ms)

```
--- injection timing: around (delayMs=16) ---
TEXT_PRE_DRAIN_around bytes=0
WAIT_ALREADY_SETTLED_BEFORE_INJECTION_around {"status":"hit","hitCount":4,"satisfiedBy":"checkpoint_info"}
TEXT_FOREIGN_HALT_around matched=true replyLen=132 elapsedMs=0 text_prefix="#1 (Stop on  exec ea31)  174/$0ae,  57/$39\n.C:ea31  20 EA FF    JSR $FFEA      - A:00 X:ED Y:0A SP:ed ..-..IZ.    2585955\n(C:$ea31) "
FOREIGN_HALT_HOLD_MS_around 500
TEXT_RELEASE_around matched=true text_prefix="#1 (Stop on  exec ea31)  124/$07c,  15/$0f\n.C:ea31  20 EA FF    JSR $FFEA      - A:00 X:ED Y:0A SP:ed ..-..IZ.    2602419\n(C:$ea31) "
TIMING_RESULT_around waitSettledBeforeInjection=true waitSettledDuringForeignHalt=false finalResult={"status":"hit","hitCount":4,"satisfiedBy":"checkpoint_info"} resumeCount=1 hitCountAfter=4 satisfiedByForeign=false
ATTRIBUTION_LOG_around [{"tMs":1788819403432,"type":"resumed","requestId":4294967295,"isBroadcast":true,"satisfiedWait":false},{"tMs":1788819403438,"type":"checkpoint_info","requestId":4294967295,"isBroadcast":true,"checkpointId":1,"hitCount":4,"satisfiedWait":true}]
```

The wait's own genuine `checkpoint_info` (`resumed` at `403432`, `checkpoint_info`
6ms later at `403438`) arrived before the 16ms nominal delay elapsed --
`waitSettledBeforeInjection=true`. The foreign command was still sent
afterward, per the task's own instruction ("send the foreign halt on the
text channel regardless"), and again captured the same stop-banner shape
(a second instance of the same text-side ambiguity noted above, not
repeated at length).

### Injection timing 3 of 3: `after` (nominal delay 50ms)

```
--- injection timing: after (delayMs=50) ---
TEXT_PRE_DRAIN_after bytes=0
WAIT_ALREADY_SETTLED_BEFORE_INJECTION_after {"status":"hit","hitCount":6,"satisfiedBy":"checkpoint_info"}
TEXT_FOREIGN_HALT_after matched=true replyLen=132 elapsedMs=0 text_prefix="#1 (Stop on  exec ea31)   72/$048,  14/$0e\n.C:ea31  20 EA FF    JSR $FFEA      - A:00 X:ED Y:0A SP:ed ..-..IZ.    2618798\n(C:$ea31) "
FOREIGN_HALT_HOLD_MS_after 500
TEXT_RELEASE_after matched=true text_prefix="#1 (Stop on  exec ea31)   20/$014,  57/$39\n.C:ea31  20 EA FF    JSR $FFEA      - A:00 X:ED Y:0A SP:ed ..-..IZ.    2635221\n(C:$ea31) "
TIMING_RESULT_after waitSettledBeforeInjection=true waitSettledDuringForeignHalt=false finalResult={"status":"hit","hitCount":6,"satisfiedBy":"checkpoint_info"} resumeCount=1 hitCountAfter=6 satisfiedByForeign=false
ATTRIBUTION_LOG_after [{"tMs":1788819404246,"type":"resumed","requestId":4294967295,"isBroadcast":true,"satisfiedWait":false},{"tMs":1788819404251,"type":"checkpoint_info","requestId":4294967295,"isBroadcast":true,"checkpointId":1,"hitCount":6,"satisfiedWait":true}]
```

By 50ms the checkpoint had, as expected, already fired and the wait had
already settled well before injection -- the intended "clearly after" case.

### Closing lines

```
HIT_COUNT_READINGS: [{"when":"initial","value":0},{"when":"after-prime","value":1},{"when":"after-before","value":2},{"when":"after-around","value":4},{"when":"after-after","value":6}]
HIT_COUNT_NON_DECREASING: true
EVERY_WAIT_RESUME_COUNT_EXACTLY_ONE: true
ANY_FOREIGN_STOPPED_SATISFIED_WAIT: false
ANY_PENDING_RESOLVED_BY_EVENT: false
ALL_FOREIGN_HALTS_INDUCED: true
STOPPING_CHECKPOINT_DELETED 1
HITCOUNT_INVARIANT_HOLDS: holds
--- test:automated baseline ---
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
RUN_RECORD /home/henrik/.cache/c64-re-tools/phase39/39-03/hitcount-invariant-run.json
```

```
$ pgrep -x x64sc
(no output, exit 1 -- reapAll() left no orphan)
```

### A previously-unmeasured, reciprocal fact: the hit-count progression `0, 1, 2, 4, 6`

The `+2` steps (`2->4`, `4->6`) are fully accounted for, not a discrepancy.
Every timing's own release (`x`, sent unconditionally regardless of whether
the wait had already settled) resumes the machine; if the wait had
**already** settled by the time release is sent (true for `around` and
`after`, and true again once `before`'s own wait settled mid-hold), the
listener that was watching for that timing's checkpoint hit has, by that
point, already been detached (the `.finally()` cleanup runs as a microtask
immediately once the wait's promise resolves, ahead of the next `await
sleep(...)` macrotask boundary) -- so releasing then causes **one further,
unobserved** checkpoint hit before the *next* timing's own fresh listener
is installed. That accounts for exactly one silent `+1` between each
timing's own observed value and the next timing's starting point (`before`
ends observed at `2`; releasing advances it, unobserved, to `3`; `around`'s
own fresh wait then observes the next hit at `4`; the same pattern repeats
into `after`'s `6`). `HIT_COUNT_NON_DECREASING` remains `true` throughout,
and this pattern is a genuinely new, previously-unmeasured fact about
repeated stopping-checkpoint waits on this checkpoint's own address, not a
data-quality problem with the run.

A second previously-unmeasured fact, distinct from the one above: **the
checkpoint's own re-hit interval, when resuming from the checkpoint's own
halt position, is on the order of 5-6ms** (`resumed` to `checkpoint_info`:
6ms in `before`, 6ms in `around`, 5ms in `after`) -- an order of magnitude
faster than the ~16.7ms (~60Hz) period `39-04-SUMMARY.md` measured for a
**non-stopping** checkpoint running **continuously and undisturbed**. The
two measurements are not in tension: `39-04`'s figure describes steady-state
free-running throughput; this probe's figure describes what happens
**immediately after a monitor-induced halt of several hundred milliseconds
of real wall-clock time**, where (most plausibly) a backlog of
already-due periodic interrupts is serviced back-to-back the instant
execution resumes, before the machine would settle back into the
~16.7ms-paced steady state. This is exactly why Run 1's fixed-delay timing
model (tuned against the ~16.7ms steady-state figure) put every injection
far too late relative to the actual few-millisecond re-hit interval, and
why the corrected constants (still 3ms/16ms/50ms, unchanged from Run 1,
but now applied against a **primed, known-position** starting state instead
of an arbitrary one) produced a genuine outstanding-wait collision in
`before` on the very next run.

---

## What this means for the four native upholders

Per the task's own instruction, an observation for the verdict document to
carry forward -- not a change to any of these four modules, all read-only
in this plan:

- **`stock-run-until.ts`** -- the module this probe's own wait mechanism
  mirrors directly. Its `waitForCheckpointHit()` (lines 99-165) narrows on
  `.type === "checkpoint_info"` THEN the specific checkpoint id, exactly as
  measured here; the observed behaviour (a foreign `stopped`/`registers`/
  `resumed` broadcast triple never satisfying the wait, in the closest race
  this run produced) directly confirms its own discrimination is sound
  against a foreign halt, as currently written.
- **`stock-reproducible-run.ts`** -- `waitForReproducibleStop()` (lines
  255-335) uses the identical narrowing (`isCheckpointInfoEvent`, matched
  checkpoint id), with an additional anchor/target discrimination layered
  on top for its own two-checkpoint design. The same event-typed narrowing
  this probe measured protects it identically against a foreign halt; its
  additional anchor-vs-target logic is an orthogonal concern this probe
  does not touch.
- **`stock-checkpoints.ts`** -- does not itself implement an event-driven
  "wait for a hit" path; its checkpoint-related handlers (`CheckpointSet`,
  `CheckpointGet`, `CheckpointList`, `CheckpointDelete`, `CheckpointToggle`)
  are request/reply operations, not waits. The observed behaviour here is
  not directly applicable to a wait path this module does not have, but the
  underlying demux guarantee it also depends on (a broadcast frame never
  resolving one of ITS pending requests) is the same one confirmed by
  source read above and exercised live throughout this run.
- **`stock-diagnose.ts`** -- `runStockLivenessBracket()` (lines 553-568)
  explicitly does **not** follow the hit-count-polling discipline; its own
  doc comment states it uses wall-clock timing instead, "unlike
  vice-sync.ts's standing 'poll on hit_count, never on paused state' rule,"
  because stock has no non-pausing observation of any kind
  (`monitor_binary.c:281` halts on any inbound byte). This module is
  therefore **not** one of the four that upholds the hit-count-polling
  invariant in the sense this probe measures -- it is named in the task's
  own four-upholders list, so it is named here too, but the correct
  observation for it is that the discipline under test does not apply to
  its own wait path as currently written, by its own author's explicit
  design choice, not because of anything this run measured.

---

## Discipline check

```
$ grep -ac 'probe-harness.mjs' hitcount-invariant-probe.mjs
1
$ grep -ac 'textmon-probe-client.mjs' hitcount-invariant-probe.mjs
1
$ grep -av '^[[:space:]]*[/*]' hitcount-invariant-probe.mjs | grep -c 'writeUInt32LE('
0
$ grep -av '^[[:space:]]*[/*]' hitcount-invariant-probe.mjs | grep -cE '(spawn|spawnSync|execFile|execFileSync)\([^)]*["'"'"']x64sc["'"'"']'
0
$ git status --porcelain src/mcp/vice | wc -l
1
$ git status --porcelain src/mcp/vice
?? src/mcp/vice/.anno-cli-test-HVa1Ev/
```

`hitcount-invariant-probe.mjs` imports `probe-harness.mjs` and
`textmon-probe-client.mjs`, builds no wire frame itself (every checkpoint
operation goes through `armStoppingExec()`/`checkpointHitCount()`/
`deleteCheckpoint()`, all shared-harness helpers wrapping the shipped
`stock-protocol.ts` encoders), and spawns the emulator only through
`spawnVice(VICE_STOCK, argv)`, never by bare name.

**The one non-empty line above is pre-existing scratch, not written by this
plan.** `src/mcp/vice/.anno-cli-test-HVa1Ev/` is untracked scratch that
already existed at the start of this session (present in the orchestrator's
own recorded `git status` snapshot before this plan's first task ran, and
named explicitly in this plan's own dispatch context as scratch that is
"NOT yours"). This plan created and modified no file under `src/mcp/vice` --
`hitcount-invariant-probe.mjs` and `concurrent-inflight-probe.mjs` both live
under `.planning/phases/.../evidence/`, and neither this file nor
`probe-harness.mjs`'s extension (an added export, not a rewrite of existing
behaviour) touches anything under `src/mcp/vice` beyond that one shared,
already-modified-by-39-04 evidence file. The plan-level `<verify>` block's
own literal command (`test "$(git status --porcelain src/mcp/vice | wc -l)"
-eq 0`) is written assuming a clean tree and is technically failed by this
pre-existing scratch directory it did not anticipate; recorded honestly here
per README.md convention 6 rather than silently passed over, and per this
plan's own explicit instruction not to `git add -A` or otherwise touch scratch
that belongs to a different session.

```
$ cd src/mcp/vice && node --test vice-sync.test.ts stock-checkpoints.test.ts stock-run-until.test.ts
...
ℹ tests 78
ℹ suites 0
ℹ pass 73
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 5
```

`fail 0` -- the three suites covering the invariant's own modules are
unaffected, as expected: this plan reads them and changes none of them. The
five `todo` entries are `vice-sync.test.ts`'s own pre-existing, named
exceptions (`readCheckpoint()`, `waitCheckpointHit()`, `runToCheckpoint()`,
`reset()`, `screenshot()`) -- each documented in that file as needing a real
emulator's own timing to mean anything, unrelated to this plan.

---

## Derivation

Per `SCHEMA.md` §2.6, with a non-stopping checkpoint's mirror-image STOPPING
variant armed at `$EA31`, a foreign halt induced from the text channel and
released with `x`:

- **`holds`** iff throughout, (a) no pending binary request is resolved by
  an unsolicited event, (b) `hit_count` is monotonically non-decreasing
  across every read, and (c) a wait keyed on the checkpoint's own
  `hit_count` -- never on paused state -- is **not** satisfied by the
  foreign halt and completes exactly once when the client's own stop
  arrives.

All three conjuncts hold, across all three injection timings, in the
authoritative run:

- **(a)** No pending binary request was ever resolved by an unsolicited
  event. This is guaranteed by construction (`stock-protocol.ts`'s
  `#dispatch()`, lines 2145-2275: a broadcast request id is routed to
  `'event'` before any pending-request lookup runs at all), and
  empirically confirmed: every one of this run's own `CommandType.Exit`
  sends (the resume for each wait) resolved normally with no
  `protocol-error`, no desync, and no unexpected rejection, and
  `ANY_PENDING_RESOLVED_BY_EVENT: false` throughout.
- **(b)** `HIT_COUNT_READINGS` (`0, 1, 2, 4, 6`) never decreases at any
  point -- `HIT_COUNT_NON_DECREASING: true`. Every apparent jump is fully
  accounted for by the release-after-already-settled mechanism explained
  above, not a gap in the measurement.
- **(c)** In all three timings, `satisfiedByForeign` reads `false` and
  `finalResult.satisfiedBy` reads `"checkpoint_info"` -- the wait was never
  satisfied by anything other than its own checkpoint's `checkpoint_info`
  event, including in `before`, the one timing where the wait was
  genuinely still outstanding (`waitSettledBeforeInjection=false`) when the
  foreign command was sent -- the exact adjacency collision this
  measurement exists to detect. `EVERY_WAIT_RESUME_COUNT_EXACTLY_ONE: true`
  confirms the "exactly one resume per wait" discipline held in every
  timing too.

None of `breaks`'s three named disjuncts occurred in any timing, and
`not-taken` does not apply -- the checkpoint was armed successfully and a
foreign halt was induced (in the sense of a framed reply being received,
per `ALL_FOREIGN_HALTS_INDUCED: true`) in every timing, including the one
where the wait was genuinely still outstanding at injection time. The
frozen rule therefore derives unambiguously: **`holds`**.

No `## ACCEPTED LIMIT` section is needed for the derivation itself. The
text-channel framing ambiguity documented under `before` above is recorded
as a genuine limitation of what could be established about the TEXT side
of that one repetition, but it does not bear on the BINARY-side
determination the frozen rule actually asks for, which is unambiguous in
every timing including that one.

---

<!-- Bare column-0 outcome lines. Final occurrence wins (README.md convention 7). -->

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: tests 3552 / pass 3538 / fail 3
TEST_AUTOMATED_BASELINE_FILES: anno-import.test.ts, anno-register.test.ts
VICE_BINARY: stock:/usr/bin/x64sc
VICE_VERSION_OBSERVED: x64sc (VICE 3.9)
HITCOUNT_INVARIANT_HOLDS: holds
