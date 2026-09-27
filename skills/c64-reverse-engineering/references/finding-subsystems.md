# Finding the subsystems: timebase, graphics, sound, input

This file is steps 3 and 6-8 of the order in depth. It says which write or read leads to which
routine, and what that routine is. For how to set the watch or read the chip, go to the
`c64-emulator` skill. For what a register or bit means, go to `c64-memory-map`.

## Timebase (step 3)

**The timebase question closes in one read.** A game that never touches `$DC0D` runs on a raster
IRQ. A game that programs `$DC04-$DC07` and enables timer A runs its own timebase. Read the CIA
state as `c64-emulator`'s
[references/sound-and-input.md](../../c64-emulator/references/sound-and-input.md) describes.

## Graphics (step 6)

A write watchpoint finds **writers**, and that is its real leverage. Two watch targets find two of
the highest-value routines. Set them as `c64-emulator`'s
[references/graphics.md](../../c64-emulator/references/graphics.md) describes.

| Watch writes to | Finds |
|---|---|
| `$D018` | The screen-setup routine. In a game with rooms or levels, this is usually the room loader. Find it early. |
| video matrix + `$03F8` | The animation driver. It rewrites the sprite pointers from frame to frame. |

Get the video matrix address from `$DD00` and `$D018` with `c64-memory-map`'s `derive.ts vic`.

**Do not assume hardware collision.** Many games do collision in software. Before you conclude that
the game uses the hardware collision registers, look for these:

- coordinate subtraction
- comparisons against a width and a height
- tile lookups
- mask tables
- bounding-box arithmetic

## Sound (step 7)

**Watch writes to `$D404` to land directly on the play routine.** The control register of voice 1
gates on every note. A write watch there hits the player, and you do not have to read the IRQ
handler line by line. The two entry points then separate immediately:

> The main code calls `init` **once**. The IRQ calls `play` **once per frame**.

Pull the music driver out early. It is often the single biggest block of code that has nothing to
do with gameplay. When you remove it, a large amount of apparent complexity goes away from
everything else.

Two idioms to recognise on sight:

- **A read of `$D41B` is the random number generator, not audio.** A read of the voice 3
  oscillator is *the* C64 RNG idiom. Code that reads `$D41B` is almost never sound code. It is
  enemy AI, spawn placement, or a title-screen effect. If you file it as sound code, the search for
  the AI goes in the wrong direction. Corollary: a program often sets `$D418` bit 7 (voice 3
  disconnect) **precisely because** voice 3 is the RNG, not a voice.
- **`$D418` written alone at high frequency is 4-bit sample playback**, not music. It is a
  separate subsystem from the player. It usually runs from a **fast CIA timer**, not from the frame
  IRQ. So when you find it, it also explains a CIA timer that you could not otherwise account for.

## Input (step 8)

Watch reads of `$DC00`/`$DC01` to find the input routine (`c64-emulator`'s
[references/sound-and-input.md](../../c64-emulator/references/sound-and-input.md)). Then trace
forward to what it stores. The joystick bits are active-low: bit 4 is fire, and bits 0-3 are up,
down, left and right. A routine that reads `$DC01`, masks one bit and branches is the input
decoder. Name the variable that it writes first (see "Naming a symbol" in `SKILL.md`).
