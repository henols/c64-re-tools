---
name: c64-emulator
description: Drive a running Commodore 64 in the VICE emulator through the vice_* MCP tools. Use when asked to run, boot or autostart a C64 program or disk in VICE. Use when asked to set a breakpoint, checkpoint or watchpoint, or to read or write emulator memory. Use when asked to read VIC-II, SID, CIA or sprite state, press keys, move the joystick, or save or load a snapshot. Use when the emulator looks stuck.
---

# Driving the C64 emulator

**Pause the machine after every observation.** The emulator runs at full
speed while you think. One session measured 258 million cycles (about 262
emulated seconds) across a few reads, with no input sent. That was enough to
reach `GAME OVER` and to make an earlier finding wrong.

The `vice_*` MCP tools are the only route to the emulator. In the Claude Code
plugin they are `mcp__plugin_c64-re-tools_vice__vice_*`. From another install
they can be `mcp__vice__vice_*`. The typed schemas give the parameters. This
skill gives the order of the calls and the traps.

- Do not open a socket to VICE. Do not start VICE yourself. The broker starts
  the emulator for you.
- A skill script never talks to VICE. Send the calls yourself, then give the
  JSON that you wrote to the script.
- The user starts the broker by hand. When no tool answers, ask the user to
  start or restart it. The `c64-project` skill tells how.

Read [references/observation-hazards.md](references/observation-hazards.md)
before you drive the machine.

## Boot a program or a disk

Read the disk directory with `c64-disk` before you boot a release.

To boot a disk image:

1. `vice_disk_attach` with the `.d64`. Only unit 8 is reachable on stock
   VICE. Units 9-11 are refused.
2. `vice_autostart` with the same image. Use `index` to select a program by
   its position. `program` (load by name) is refused on stock VICE.
3. `vice_execution_run`.
4. `vice_registers_get`. Make sure that the program counter moved.

The broker sets the drive type each time it starts a stock instance. You do
not need to set up the drive before you attach.

If the program counter did not move, load the program by hand:

1. `vice_keyboard_type` with `LOAD"*",8,1\n`. A `\n` or `\r` gives Return.
2. `vice_execution_run`, and let the load finish.
3. `vice_keyboard_type` with `RUN\n`, then `vice_execution_run`.

Other ways to start a program:

| Need | Call |
|---|---|
| Reset, load and run a `.prg` | `vice_autostart` with the `.prg` path |
| Put a file in RAM without a reset and without a start | `vice_program_load`. Without `address`, VICE loads at the file's two-byte header address. |
| Reset the machine | `vice_machine_reset` with `mode` `soft` or `hard`. `run_after` is false by default, so the machine stays stopped. |
| Go faster through a slow loader | `vice_warp_set`. The answer reports the observed warp state. |

## Stop the machine where you want

| Need | Call |
|---|---|
| Stop when the CPU executes an address or a range | `vice_checkpoint_add` with `exec: true` and `stop: true` |
| Find the code that writes (or reads) an address | `vice_watch_add` with `type` store (or load). A watch finds the **writers**. |
| Stop only when a condition is true | `vice_checkpoint_set_condition`, for example `A == $42` |
| Run to one address, with a time limit | `vice_run_until` with `address` and `timeout_ms` |
| Step instructions | `vice_execution_step` with `count`. `stepOver` steps over a `JSR`. |
| Run until the current subroutine returns | `vice_execution_until_return` |
| See, disable or delete checkpoints | `vice_checkpoint_list`, `vice_checkpoint_toggle`, `vice_checkpoint_delete` |

Rules for checkpoints:

- A checkpoint with `stop: false` needs `acknowledgeTraceRisk: true`. A
  checkpoint that does not stop sends one frame for each hit. On an address
  that executes often, this can stall the emulator.
- A condition is permanent. Stock VICE cannot clear or replace a condition.
  To change it, delete the checkpoint and add it again.
- `vice_run_until` waits 30000 ms by default. A higher `timeout_ms` than
  600000 is reduced to 600000. The arguments are `address`, `timeout_ms`
  and `cycles`. The tool refuses `cycles`.
- A timed-out `vice_run_until` answer tells you that the machine is stopped.
  It is not a dead emulator. Read `machineHalted`. The value `false` means
  that the state is unknown, not that the machine runs. Then call
  `vice_execution_pause` and `vice_registers_get`.
- When the address is only a guess, use `vice_checkpoint_add` and a polling
  loop with a limit. Do not use a long `vice_run_until` wait.
- `vice_run_until` ends on any stop: its own target, another checkpoint of
  yours, a watch or a JAM. Read `reached` before you assume that the target
  address was reached. `stoppedBy.kind` names the stop: `target`,
  `checkpoint`, `jam` or `other`. The answer also has `pc`, `checkpointId`,
  `hitCount` (for a `target` stop) and `cleanup` (for another stop, the
  result of the delete of the temporary checkpoint). `machineHalted` is
  `false` when VICE resumed the machine at once after the stop. The note in
  the answer says so. Then call `vice_execution_pause`.
- `vice_execution_step` and `vice_execution_until_return` refuse while the
  run state is `unknown`. Call `vice_execution_pause` or `vice_execution_run`
  first.
- After a checkpoint hit in the drive CPU, call `vice_device_console`. It
  sets the monitor back to the main CPU. Without it, stepping steps the drive
  CPU.

Poll with `vice_ping` while the machine runs. It does not pause the machine.
Its run-state field does not prove that the machine moves (see
[When the emulator looks stuck](#when-the-emulator-looks-stuck)).

When you are done, delete every checkpoint. Then run `vice_checkpoint_list`
and make sure that it shows zero checkpoints. Only this list proves that no
checkpoint stays armed. Resume the machine one time, at the end.

## Read the machine state

Most reads stop the machine. The answer's `runState` field shows this. Do
all reads in one paused window, then resume one time.

| Question | Call |
|---|---|
| Bytes at an address | `vice_memory_read` with `address` and `size` (65536 at most). A short read is refused, never returned as part of the data. |
| Bytes in a different bank | `vice_memory_read` with `bank`. `vice_memory_banks` lists the banks. |
| Write bytes | `vice_memory_write` |
| Find a byte pattern | `vice_memory_search`. `mask` must be as long as `pattern`. `max_results` is 100 by default. |
| Compare two live ranges | `vice_memory_compare` with `mode: 'ranges'`. `mode: 'snapshot'` is refused. |
| CPU registers | `vice_registers_get`, `vice_registers_set`. `vice_registers_available` gives each register's width in bits. |
| Instructions at an address | `vice_disassemble`, with an optional `bank`. An illegal opcode that ACME cannot express shows as `!byte`, with the mnemonic in a comment. |
| VIC-II and sprite state | `vice_vicii_get_state`, `vice_sprite_get`, `vice_sprite_inspect`, `vice_io_registers`. See [references/graphics.md](references/graphics.md). |
| CIA and SID state | `vice_cia_get_state`. No tool reads the SID. See [references/sound-and-input.md](references/sound-and-input.md). |
| The calls that led to the current instruction | `vice_backtrace` |
| The last instructions that executed | `vice_cpu_history`. It needs a VICE build with CPU history. |
| Where the cycles go | `vice_profile_flat` |
| Which addresses executed, read or were written | `vice_memmap_show`. `vice_memmap_zap` clears the map first. |
| How many cycles a piece of code takes | `vice_cycles_stopwatch` with `reset`, then `read`. Use `cyclesExact` for arithmetic. |
| The rest of a result that was too large | `vice_result_continue` with the token from the previous part |

Three facts about banks:

- The default bank is the CPU view. It follows the banking in `$01`. When a
  program switches the I/O area out, the default bank at `$D000-$DFFF` shows
  RAM, not the chip registers.
- `sideEffects` is false by default. Some registers clear when you read them
  (hazard 3). Set `sideEffects` only when you want that side effect.
- A vector target in `$A000-$BFFF`, `$D000-$DFFF` or `$E000-$FFFF` can be ROM
  or the RAM below it. Read the target one time in the default bank and one
  time with `bank: "ram"`. If the two reads agree with the stock ROM bytes,
  the vector goes into ROM. If they differ, the program has its own code
  below the ROM. Record the stock bytes that you compared against.

What a register value means is the job of `c64-memory-map`.

## Give input

`vice_keyboard_type` types text. By default (`petscii_upper: true`) it types
letters of both cases as capitals. With `petscii_upper: false` it sends the
raw bytes. `vice_keyboard_petscii` sends exact PETSCII bytes. Both put the bytes in the KERNAL keyboard buffer of a stopped machine.
Nothing reads the buffer until you resume.

**The keyboard matrix cannot be driven.** No `vice_keyboard_matrix` tool
exists on stock VICE, and no route to one can exist. The monitor command
`KEYBOARD_FEED` (0x72) only puts PETSCII text in the KERNAL buffer. The
emulator calculates CIA port B from its own keyboard array on each read. Many
games and cracks read `$DC00`/`$DC01` directly, so they never see the buffer.

- If the program reads the KERNAL buffer, use `vice_keyboard_type` or
  `vice_keyboard_petscii`.
- If the program reads the matrix directly, use `vice_joystick_set`. When
  the joystick cannot pass the gate, no tool can.

`vice_joystick_set` takes `port` (1 or 2, default 1), `direction` (one
direction or a list) and `fire`. `port` is the C64 control port. Many games read the
joystick in port 2, so give `port` each time. Opposite directions together are
refused. The tool needs the `io` bank. While a direction is held, the port
uses VICE's I/O simulation device. `direction: "center"` with `fire: false`
releases the joystick and restores the earlier device. The answer adds
`lines`, `device`, `ciaRegister` and `ciaValue`. `ciaValue` is the byte that
the tool reads back from the CIA register of the port. No tap tool exists:
set the state, run, then release. Make sure that the program reacts.

To hold a key or a direction through a gate, release it at the trigger
checkpoint, never before.

The RESTORE key cannot be pressed. RESTORE pulses the NMI line directly, and
`KEYBOARD_FEED` cannot make that pulse. No `vice_keyboard_restore` tool
exists. To test what a reset does, arm a checkpoint, call
`vice_machine_reset` (soft, then hard) and record where the program counter
stops.

## Load symbols

`vice_symbols_load` loads a VICE label file (`al C:xxxx .Name`) into a table
that the MCP server keeps. The formats `auto` and `vice` work. `kickasm` and
`simple` are refused. ACME's `.vs` output from `c64-assembler` has this
format.

- **A load replaces the table.** It does not merge. Load each generated file
  one time. If you load an older file again, the newer names are lost.
- Make the label file again from the start each time. Do not edit it by
  hand.
- `vice_symbols_lookup` takes `name` or `address`, not both.
- `vice_disassemble` with `show_symbols` shows the names in the listing.

Write each name that you find live to the project first, with
`c64-annotations`.

## Save and load a snapshot

`vice_snapshot_save` with `name` saves the full emulator state. The file goes
to `.c64-re-tools/local/snapshots/<name>.vsf`, with a JSON sidecar.
`vice_snapshot_load` with `name` restores it. An unknown name is refused, and
the error lists the snapshots that exist.

To make a flat 64K image from a `.vsf` file, use `c64-ram-capture`.

## Prove that the machine did not change

The broker gives each emulator instance an epoch. The MCP server records the
epoch when it first connects. No tool reads the epoch, and you do not poll
for it.

1. When the emulator restarts, the monitor connection closes. The call that
   runs at that time fails.
2. The next call connects again. First, the server asks the broker for the
   current epoch.
3. If the epoch changed, or the server cannot read one, the call is refused.
   The error gives the first epoch and the current epoch. After a restart,
   the current epoch is usually `null`, because your session does not own the
   new emulator process.
4. The call after that connects to the new machine and works.

What this means for you:

- **A clean run is a run with no epoch-drift error.** Record that fact. Do
  not record two numbers that you read by hand.
- If you need the epoch values, copy them from the error text.
- **After a drift error, the machine is a new machine.** A call that works
  after the error talks to a machine that booted again. Do not continue from
  the old state. Boot again from `vice_disk_attach`.

Plan a live session so that it can boot the program more than one time. One
measurement found two emulator crashes in about 20 minutes of live work.

## When the emulator looks stuck

**First, look for your own checkpoints.** An armed checkpoint that stops the
machine looks exactly like a dead emulator. The cycle count does not move.
`vice_ping` still reports `running`. The program counter stays the same,
because the machine really did not move.

Do these checks before any resume:

1. `vice_checkpoint_list`.
2. `vice_registers_get`, and read the program counter.
3. Find the live IRQ handler. Read `$0314/$0315`. If `$01` switches the ROMs
   out, read `$FFFE/$FFFF`.

A stopping checkpoint at the program counter, or just after it, stops the
machine itself. A stopping checkpoint at the handler entry with `hit_count:
0` also shows this problem. Delete it with `vice_checkpoint_delete`, then
resume. Do the checks before a resume, because `vice_execution_run` is the
first suspect for a crash.

This procedure does not always recover the machine. In one incident, the machine stayed frozen
after the delete, after a soft reset, after a hard reset and after one step.
Hazard 2 in the reference has the details.

The only test that proves that the machine moves is a cycle count:
`vice_cycles_stopwatch` with `reset`, a short run, then `read`.

Only one process can hold the binary monitor. A second connection gets no
reply and no EOF, so it looks like a hang. Look for these causes:

- a `nc` session on the monitor port,
- a second Claude Code session on the same emulator instance,
- VICE started with `-remotemonitor`,
- another 6502 debugger that connects to the port.

If nothing answers at all, ask the user to restart the broker.

## Failure shape

A `vice_*` tool that cannot do its work returns an error that names the
cause, or an answer with `ok: false` and a reason. A timed-out
`vice_run_until` is not an error. It reports that the machine is stopped.
The tools never fill a missing value with a default. A refused call changes
nothing on the machine.

## Hazards

[references/observation-hazards.md](references/observation-hazards.md) has
the evidence for each hazard.

1. The machine runs while you think. Pause after each observation.
2. An armed stopping checkpoint looks like a dead emulator. See
   [When the emulator looks stuck](#when-the-emulator-looks-stuck).
3. `$D01E`, `$D01F`, `$DC0D` and `$DD0D` clear when you read them. Use the
   whole-chip reads.
4. Games do not read the keyboard buffer. See [Give input](#give-input).
5. Most reads pause the machine and do not resume it. Resume one time, at
   the end.
6. The machine can restart below you. See
   [Prove that the machine did not change](#prove-that-the-machine-did-not-change).
7. Two 64K reads of the same stop never agree on all 64K bytes.
   `c64-ram-capture` compares them.

## What this skill does NOT do

- **No 64K capture, and no capture compare.** That is `c64-ram-capture`.
- **No meaning of a value.** What a register bit or an address means is
  `c64-memory-map`.
- **No choice of what to look at next.** Where the main loop, the IRQ
  handler or the music player is: `c64-reverse-engineering`.
- **No disk-image read.** The directory and the file bytes of a `.d64` are
  `c64-disk`.
- **No project writes.** Labels and comments go to the project through
  `c64-annotations`.
- **No broker start and no VICE install.** The user installs VICE and starts
  the broker by hand. `c64-project` tells where the broker connection comes
  from.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `stockReconnect: reconnect to target … could not prove machine identity across the reconnect (baseline epoch …, current epoch …)` | The emulator restarted. The run is void. Boot again from `vice_disk_attach`. |
| The emulator looks dead | Look for your own checkpoints first. See [When the emulator looks stuck](#when-the-emulator-looks-stuck). |
| `vice_keyboard_type` does nothing | The program reads the matrix directly. See [Give input](#give-input). |
| `the derived run state is "unknown" -- nothing on the wire has reported a STOPPED or RESUMED transition` | Call `vice_execution_pause` or `vice_execution_run`, then step. |
| `vice_run_until: cycles-only mode not yet implemented; provide an address` | Give `address`. Use `timeout_ms` to limit the wait. |
| `vice_checkpoint_set_condition: checkpoint N already has a condition set` | Delete the checkpoint and add it again with the new condition. |
| `stop:false requires acknowledgeTraceRisk:true` | Use `stop: true`, or accept the stall risk with `acknowledgeTraceRisk: true`. |
| `vice_disk_attach: unit 9 cannot be targeted on the stock backend` | Use unit 8. |
| `vice_autostart: program is not supported on the stock backend` | Use `index` to select the program by position. |
| `vice_memory_read: expected N byte(s), got M -- a short read is a wrong answer, not a partial success` | Read the same range again. Do not fill the gap. |
| `vice_symbols_lookup: name and address are mutually exclusive -- supply exactly one` | Give `name` or `address`, not both. |
| The machine reached a state that you did not cause | It ran while you thought. Pause after each observation. |
