# Reading SID and CIA state, and the input ports

What each SID and CIA register means, and which CIA does which job, is in
`c64-memory-map`. This file tells which calls read these chips and what the
answers can and cannot tell you.

## SID: you cannot read it, so watch the writes

No tool reads the SID state. `$D400-$D418` is write-only in the hardware, and
the binary monitor has no SID command. No route can exist. Writes to those
addresses work, with `vice_memory_write`.

Only four SID registers can be read: `$D419`/`$D41A` (paddles), `$D41B`
(voice 3 oscillator) and `$D41C` (voice 3 envelope). Read them with
`vice_memory_read`. When `$01` switches the I/O area out, use the `io` bank.

To see what a program sends to the SID, put a store watch on the register
with `vice_watch_add`. When the watch stops the machine, read the program
counter with `vice_registers_get` and the instruction with
`vice_disassemble`. `$D404` (voice 1 control) is a good target, because a
music player writes it for each note. How to separate the player from the
game logic is in `c64-reverse-engineering`.

## CIA: use the whole-chip read

`vice_cia_get_state` reads CIA 1 (`$DC00`), CIA 2 (`$DD00`) or both
(`cia` is 1, 2, or not given). It reads each 16-byte register block one time,
with `sidefx: false`.

- **`$DC0D` and `$DD0D` clear their interrupt flags when a program reads
  them.** A raw read takes an interrupt that the game was about to use. Use
  `vice_cia_get_state`. Whether the emulator obeys `sidefx: false` for these
  addresses is not verified. Check it. Do not assume it.
- Some addresses have a read side and a write side with different meanings.
  The answer names the read side for what it is, for example
  `interruptStatus` for `$xx0D` and `timerA.current` for the timer. The write
  side comes back as a separate field with `available: false`. These fields
  are `timerALatch`, `timerBLatch`, `interruptEnableMask`, `todAlarmTime` and
  `todLatchState`. So a question about "which interrupts are enabled" never
  gets the flags that fired.
- `portA` of CIA 2 also gives `vicBank` and `vicBankBase`, and the serial
  bus lines.

## The joystick and keyboard ports

`vice_cia_get_state` decodes the joystick lines. `portA.joystick2` is on
CIA 1 port A (`$DC00`). `portB.joystick1` is on CIA 1 port B (`$DC01`).
These ports also carry the keyboard matrix. A read stops the machine at a
random point, often inside the KERNAL keyboard scan. Then a pressed direction
can be a phantom that a matrix line causes. The answer marks such a direction:
`confounded: true`, a `confoundedReason` and the `confoundedDirections` list.
Do not record a confounded direction as a joystick reading.

To send input, see the skill's [Give input](../SKILL.md#give-input) section.

To find the code that reads the input, put a load watch on `$DC00` or `$DC01`
with `vice_watch_add`. What to do with the routine that you find is in
`c64-reverse-engineering`.
