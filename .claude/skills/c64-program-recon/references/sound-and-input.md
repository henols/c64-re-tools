# SID and CIA: music, effects, the RNG, input, timing

Source: `.planning/RE-FINDINGS.md` § SID discovery and § CIA 6526 discovery (2026-08-01,
**MEDIUM**, doc-derived) except where marked. Per-register bit detail lives in
`c64-memory-mapping`; this file carries the idioms and the order.

## SID — separating the player from the game logic

Voice 1 at `$D400`, voice 2 at `$D407`, voice 3 at `$D40E`, seven bytes each: frequency lo/hi,
pulse width lo/hi, control (gate bit 0, then sync/ring/test and the waveform bits), attack/decay,
sustain/release. Then `$D415`-`$D418` for filter and volume. Write-only but for the last four:
`$D419`/`$D41A` paddles, `$D41B` voice 3 oscillator, `$D41C` voice 3 envelope.

**Watch `$D404` to land directly on the play routine.** Voice 1's control register gates on every
note, so a write watch there hits the player without reading the IRQ handler line by line.
Separating the two entry points follows immediately:

> `init` is called **once** from the main code. `play` is called **once per frame** from the IRQ.

Pulling the music driver out early removes a large amount of apparent complexity from everything
else — it is often the single biggest block of code that has nothing to do with gameplay.

### Two idioms worth recognising on sight

- **`$D41B` read is the random number generator, not audio.** Reading voice 3's oscillator is *the*
  C64 RNG idiom. Code reading `$D41B` is almost never doing sound — it is enemy AI, spawn
  placement, or a title-screen effect. Filing it as sound code sends the AI hunt in the wrong
  direction. Corollary: `$D418` bit 7 (voice 3 disconnect) is often set **precisely because** voice
  3 is the RNG rather than a voice.
- **`$D418` hammered alone at high frequency is 4-bit sample playback**, not music. It is a
  separate subsystem from the player and usually runs off a **fast CIA timer** rather than the
  frame IRQ — so finding it also explains a CIA timer you could not otherwise account for.

## CIA — two chips, identical layouts, different jobs

Confusing them is a frequent early error.

| | CIA#1 `$DC00` — keyboard, joysticks, **IRQ** | CIA#2 `$DD00` — VIC bank, serial, user port, **NMI** |
|---|---|---|
| Port A | `$DC00` keyboard **column** select; joystick port 2 | `$DD00` VIC bank (bits 0-1, inverted); serial ATN/CLK/DATA |
| Port B | `$DC01` keyboard **row** read; joystick port 1 | `$DD01` user port / RS-232 |
| Timers | `$DC04-$DC07`, control at `$DC0E`/`$DC0F` | `$DD04-$DD07`, `$DD0E`/`$DD0F` — these drive **NMI** |
| Interrupt | `$DC0D` | `$DD0D`, same bit layout |

**The timebase question closes in one read.** A game that never touches `$DC0D` is on a raster IRQ.
One that programs `$DC04-$DC07` and enables timer A runs its own timebase.

## Three CIA hazards

- **`$DD00` is dual-purpose.** The same register carries the VIC bank *and* the serial bus lines,
  so a write during disk access also moves the VIC's view of memory unless the code masks
  carefully. **Check the mask** before concluding a `$DD00` write is a bank switch — loader code
  writing `$DD00` is usually talking to the drive.
- **`$DC0D`/`$DD0D` clear the interrupt flags on read**, the same shape as `$D01E`/`$D01F`. Reading
  one steals an interrupt the game was about to service. Prefer `vice_cia_get_state`. The VICE
  monitor's exact behaviour here is **unverified** — verify, don't assume.
- **Direct `$DC00`/`$DC01` polling is the norm, and it defeats `vice_keyboard_type`.**
  **Evidence: live, established on this project during recovery work. Confidence: HIGH. Cost: an
  afternoon.** Games and cracks bypass the KERNAL keyboard buffer and read the matrix directly.
  Assume it until shown otherwise, and drive input with `vice_keyboard_matrix` or the joystick
  tools instead.

## Finding input handling from the observable side

Watch reads of `$DC00`/`$DC01` to find the input routine, then trace forward to what it stores.
The joystick bits are active-low: bit 4 is fire, bits 0-3 up/down/left/right. A routine that reads
`$DC01`, masks one bit and branches is the input decoder; the variable it writes is the one to
name first.
