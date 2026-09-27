# Hazards: how an observation of a running C64 gives a wrong answer

This project found most of these hazards live, and each one cost real work. A
wrong answer from a register table is cheap. A wrong answer from a machine
that changed *because you looked at it* makes a full session worthless, and
nothing tells you.

Record a new hazard in your own project notes when you find it.

## 1. The emulator runs at full speed while the agent thinks

**Measured live, then reproduced with a control. Confidence: high.**

Between two screenshots, the agent did a few memory and register reads and
sent **no input**. In that time, a game went through an interstitial screen to
`GAME OVER`. `vice_cycles_stopwatch` read **258,504,308** cycles since the
previous action. That is about **262 seconds of emulated PAL time**. All of it
ran while the agent wrote tool calls.

This made an earlier gameplay finding wrong. A "counter that goes down for
each input event" was really a counter that went down during the agent's own
think time. The earlier finding could not see this, because it never paused.

**The rule:** call `vice_execution_pause` immediately after each observation,
unless a planned scripted input follows immediately. Resume only for the
limited time of that input. **Never let the machine run across a reasoning
step.**

The same session found two more facts:

- A pause starts only when VICE processes it. The counter went up by about
  20M more cycles before it stopped. After that, the pause held. Two
  stopwatch reads in sequence gave the same value.
- With the pause rule applied from the first frame, the agent passed a room
  on the next attempt. Six earlier attempts failed, and the room seemed
  impossible.

## 2. An armed stopping checkpoint can look exactly like a dead emulator

**Three recorded incidents, and all three agree. Confidence: medium. The
mechanism explains each symptom and is quick to test, but nobody reproduced
it.**

The common factor in three "silent stall" incidents was not an address. It
was this: **a stopping exec checkpoint was armed, and execution resumed.**

The symptoms agree with each other:

- The cycle count shows exactly `0`.
- `vice_ping` reports `running`, because the VICE flag changes before the
  trap fires.
- `vice_registers_get` gives the same program counter each time, **because
  the machine really did not move.**

The strongest sign: in one incident, `vice_checkpoint_list` showed the
checkpoint at `hit_count: 0` after many resume and poll cycles. The screen
was IRQ-driven, so that address *must* execute in each frame.

The checks to do are in the skill's
[When the emulator looks stuck](../SKILL.md#when-the-emulator-looks-stuck)
section.

**Why the confidence is only medium:** in one incident, a delete of the
checkpoint did *not* unfreeze the machine. A soft reset, a hard reset and a
single step also did not. The checkpoint trap can be the *start* of the
problem without being all of it. Do not expect that a delete and a resume
always recover the machine.

**This is not a reason to stop putting checkpoints on IRQ handlers.** That is
a core technique. It is a reason to list your armed checkpoints *first*
whenever the machine looks frozen, before you decide that the emulator died.

## 3. Registers that clear when you read them

`$D01E`, `$D01F` (VIC-II collisions) and `$DC0D`, `$DD0D` (CIA interrupt
flags) clear when a program reads them. If you read one while the game runs,
you take the event that the game was about to use.

Use the whole-chip reads, `vice_vicii_get_state` and `vice_cia_get_state`,
not raw register reads.

- **Verified:** these two reads send `sidefx: false`, and no argument can
  change that. A regression test checks the request body.
- **Not verified:** whether the emulator's own `MEM_GET` path obeys that flag
  for `$D01E`/`$D01F`/`$DC0D`/`$DD0D`. No probe in this repo checked it. Do
  not treat it as a proven guarantee.
- `vice_memory_read` also has `sideEffects: false` by default. The same
  unverified point applies.

No tool reads the SID. `$D400-$D418` is write-only in the hardware, and the
binary monitor has no SID command, so no route can exist. Writes to those
addresses work.

Two more rules for chip-state answers:

- A field that the register map cannot show comes back as
  `{ available: false, reason }`, never as a bare `0`. Check `available`
  before you record a value. Do not record a `0` from such a field as a
  measurement.
- A chip-state or sprite answer **names the memory view that it read**
  (`bank`, or `registerBank`/`dataBank`). It reads through the emulator's
  `io` and `ram` banks, so it stays correct while the program has I/O
  switched out through `$01`. An answer with **no** bank field comes from an
  older transcript. Do not trust it when `$01` possibly was not `$37`. Those
  bytes can be the RAM below the I/O area, not the registers.

## 4. Games do not read keys from the keyboard buffer

**Found live. Confidence: high. Cost: an afternoon.**

Games and cracks read the `$DC00`/`$DC01` matrix directly. They do not use the
KERNAL buffer, so they never see `vice_keyboard_type`. The matrix itself
cannot be driven. The skill's [Give input](../SKILL.md#give-input) section
tells why, and tells what to use.

Hold a key through a gate until the trigger checkpoint, then release it.
Never release it earlier.

## 5. Most state reads pause the emulator and do not resume it

Read all the state first. Poll with `vice_ping`, which does not pause. Resume
**one time**, at the end.

The `vice_ping` run state does **not** prove that the machine moves. Hazard 2
tells why it can report `running` for a machine that does not move. Only a
cycle count proves it.

## 6. The machine can be replaced while you work

A crash and a restart during a session make the run void. After an automatic
restart, a retry that works can talk to a blank machine. The skill's
[Prove that the machine did not change](../SKILL.md#prove-that-the-machine-did-not-change)
section tells how the MCP server detects this, and what you must do.
`c64-ram-capture` tells how to void a capture.

## 7. Two full 64K images are never byte-identical

RAM that the program never writes changes all the time. So two captures of
the same checkpoint do not agree on all 64K bytes. The recovery procedure is
repeatable **for the program image**, not for all 64K. `c64-ram-capture`
has the volatile regions and the drift rule. Use them. Do not treat each
difference as a divergence.
