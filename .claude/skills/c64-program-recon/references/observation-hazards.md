# Hazards: how observing a running C64 gives you the wrong answer

The entries here are graded higher than the method files, because most were established live on
this project at real cost. A wrong answer from a register table is cheap; a wrong answer from a
machine that changed *because you looked at it* discredits a whole session without announcing
itself.

Full provenance in `.planning/RE-FINDINGS.md`. Log new hazards there at the moment you hit one.

## 1. Agent think-time runs the emulator at full speed

**Evidence: live, 01-04 attempt 5. Confidence: HIGH (measured, then reproduced with a control).**

Between one screenshot and the next — a handful of memory/register reads, **zero input sent** —
a game ran through an interstitial to `GAME OVER`. `vice_cycles_stopwatch` read **258,504,308**
cycles since the previous action: roughly **262 seconds of emulated PAL time**, all of it real
unattended execution while the agent composed tool calls.

This invalidated a previously recorded gameplay-hazard conclusion. A "counter that depletes per
input event" was really a counter depleting during the agent's own reasoning latency, and the
earlier finding had no way to rule that out because it never paused either.

**The discipline:** call `vice_execution_pause` immediately after every observation that is not
immediately followed by a deliberate scripted input. Resume only for the bounded duration of that
input. **Never leave the machine running across a reasoning step.**

Two confirmations from the same session: a pause takes effect only once actually processed (the
counter climbed another ~20M cycles before settling), but once landed it holds solidly — two
consecutive stopwatch reads returned an identical value. And with the discipline held from the
first frame, a room previously judged impassable across six attempts was crossed on the next try.

## 2. An armed stopping checkpoint can look exactly like a dead emulator

**Evidence: cross-read of three recorded incidents, 3/3 correlation. Confidence: MEDIUM — the
mechanism is consistent with every symptom and testable in minutes, but has not been reproduced.**

The common factor across three "silent stall" incidents was not an address. It was: **a stopping
exec checkpoint was armed, and execution was resumed.**

The signature is complete and self-consistent — the cycle bracket reads exactly `0`, `vice_ping`
answers `execution: "running"` because VICE's flag flips before the trap fires, and
`vice_registers_get` returns a byte-identical PC every time **because the machine genuinely never
moved.** The strongest single tell: in one incident `vice_checkpoint_list` reported the checkpoint
at `hit_count: 0` after multiple resume/poll cycles, on an IRQ-driven screen where its address
*must* execute every frame.

**`mcp__plugin_c64-rc-tools_vice__vice_diagnose` now performs this check for you** (2026-08-04): it enumerates armed
checkpoints, reads the PC, resolves the live IRQ handler through `$01`, and returns a
`checkpoint_trap` verdict — with **no resume and no stopwatch call**, which matters because
`vice_execution_run` is this project's leading crash suspect. Call it before anything else. The
triage decision tree around it is `vice-wedge-triage`.

**Know the two shapes it matches, because a trap outside them reads as a wedge.** It fires when an
enabled stopping exec checkpoint sits *exactly* at the current PC, or at the resolved handler
entry with `hit_count` exactly `0`. This hazard's own evidence describes the PC as pinned "at or
just past" the checkpoint — *just past* is not *exactly at*. A checkpoint armed mid-handler rather
than at its entry, with a non-zero hit count, matches neither shape, falls through to the cycle
bracket, and comes back `wedged`. **The response to `wedged` is recycle, and recycling a healthy
instance is the exact loss both the tool and this hazard exist to prevent.** So when a `wedged`
verdict arrives with any checkpoint still armed, do the two reads by hand before recycling:
`vice_checkpoint_list`, then resolve the live handler (`$0314/$0315`, or `$FFFE/$FFFF` when `$01`
has the ROMs banked out). Filed as
`.planning/todos/pending/2026-08-04-vice-diagnose-checkpoint-trap-shapes-miss-mid-handler-arming.md`.

**Counter-evidence, and why this is MEDIUM:** in one incident, deleting the checkpoint did *not*
unfreeze the machine, and neither did a soft reset, a hard reset, nor a single step. A checkpoint
trap may be the *onset* without being the whole story. Do not assume delete-and-resume recovers it.
`vice_diagnose`'s own `checkpoint_trap` report states this too, and cites the same incident.

**This is not a reason to stop arming checkpoints on IRQ handlers** — that is core technique. It
is a reason to enumerate what you armed *first* whenever the machine looks frozen, before
concluding the emulator died.

## 3. Registers that clear when you read them

`$D01E`, `$D01F` (VIC collisions) and `$DC0D`, `$DD0D` (CIA interrupt flags) clear on read.
Reading one while the game runs steals the event the game was about to service.

Prefer the whole-chip reads — `vice_vicii_get_state`, `vice_cia_get_state`, `vice_sid_get_state`
— over raw register reads. Whether the VICE monitor's own read path is side-effect-free is
**unverified**: treat it as verify-don't-assume rather than taking it on faith.

## 4. The keyboard buffer is not how games read keys

**Evidence: live. Confidence: HIGH. Cost: an afternoon.**

Games and cracks poll the `$DC00`/`$DC01` matrix directly, bypassing the KERNAL buffer, so
`vice_keyboard_type` is invisible to them. Use `vice_keyboard_matrix`, and hold a key across a
gate by releasing it at the trigger checkpoint, never earlier.

## 5. Most state reads pause the emulator and do not resume it

Read all state first, poll with `vice_ping` (the non-pausing poll), and resume **exactly once** at
the end. `vice_ping`'s `execution` field is **not** a liveness signal — see hazard 2 for why it
reports `running` on a machine that is not moving. The only trustworthy liveness test is a cycle
bracket.

## 6. The machine can be replaced under you

A crash-and-respawn mid-session means the run is void — `c64-ram-capture` § Void a run gives the
procedure. A successful retry after an auto-restart may be talking to a blank machine.

**You do not poll for this, and no exposed tool reads the epoch.** The proxy compares it before and
*after* every forwarded call and raises a loud error naming both values, then re-baselines so the
session stays usable. The two recorded incidents surfaced exactly that way and self-healed on the
next call. Where an epoch value is needed for a record, it comes from that error text or from
`vice_diagnose`'s `restarted` report — there is no `vice_epoch_get`.

What is still yours to do: **treat every post-drift read as a fresh machine, never as a resume
point.** Reboot from `vice_disk_attach`. Two crashes in ~20 minutes of continuous live work is a
real measured rate, so plan a live session to tolerate re-deriving a boot sequence more than once.

## 7. Full-64K byte-identity is impossible in principle

Never-written RAM drifts continuously, so two captures of the same checkpoint will not match
across all 64K. The recovery procedure is deterministic **for the program image**, not for 64K.
`c64-ram-capture` § Compare two captures carries the volatility regions and the drift
discriminator; use them rather than treating any difference as a divergence.
