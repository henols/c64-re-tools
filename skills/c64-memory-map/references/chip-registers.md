# What the VIC-II, SID and CIA registers mean

This file tells you what the chip registers mean, and how their values give
concrete addresses. `node driver.ts lookup '<addr>'` gives the full published
prose for each register. `derive.ts vic` and `derive.ts sprites` do the
arithmetic below. Each fact here agrees with `memmap.json`, except where this
file says otherwise.

## VIC-II: where each byte on the screen is

Graphics data comes from a calculation, not from a search. Each pointer that
the VIC follows comes from two registers and a bank. Read these values in
this order, and you know where each byte of graphics on screen is:

1. **`$DD00` bits 0-1: the VIC bank. Read this first, every time.** The bits
   are **inverted**: `%11` → bank 0 at `$0000`, `%10` → bank 1 at `$4000`,
   `%01` → bank 2 at `$8000`, `%00` → bank 3 at `$C000`. Each other pointer is
   relative to this base. A wrong bank makes the whole chain wrong
   **silently, with no error**. This is the most common cause of a wrong
   answer in C64 graphics RE.
2. **`$D018`: two pointers in one byte.** Bits 4-7 are VM: screen RAM = bank
   + VM × `$0400`. Bits 1-3 are CB: charset = bank + CB × `$0800`. In bitmap
   mode only bit 3 has an effect. It selects the 8K half of the bank that
   holds the bitmap. The video matrix then holds colour pairs, not character
   codes.
3. **The mode bits:** `$D011` bit 6 (ECM), `$D011` bit 5 (BMM), `$D016` bit 4
   (MCM). These bits set what the bytes *mean*. A multicolor sprite decoded as
   hires gives garbage that is two times too wide. ECM together with BMM or
   MCM is invalid and makes the screen black. If you calculate that
   combination, you probably read the registers in the middle of an update
   inside a raster split. Read them again.
4. **`$D015`: the sprite enable mask. Start here, not at the sprite data.**
   The other registers of a disabled sprite hold old values. If you decode
   them, you get noise.
5. **The sprite pointers** at video matrix + `$03F8`, 8 bytes. Each pointer ×
   64 is the data address of the sprite *in the current bank*. A sprite uses
   63 bytes of its 64-byte block.

### The character ROM shadow

The VIC sees character ROM at `$1000-$1FFF` (bank 0) and `$9000-$9FFF`
(bank 2), **whatever the `$01` banking that the CPU sees**. If CB points into
one of these windows, the game uses ROM characters. There is then no charset
in RAM to extract. `derive.ts vic` shows this case. Check it before you dump
memory.

### Colour is not banked

Colour RAM is fixed at `$D800-$DBFF`. It does **not** move with the VIC bank.
Only the low nybble of each byte exists. `$D020` is the border colour.
`$D021` is the background colour. `$D022`, `$D023` and `$D024` are the extra
background colours #1, #2 and #3 (`memmap.json`: "Extra background color",
only bits #0-#3). If you look for colour data at a bank-relative address, you
find different data.

## SID: the register layout

Each voice has seven bytes: voice 1 at `$D400`, voice 2 at `$D407`, voice 3 at
`$D40E`. The seven bytes are, in order:

1. frequency lo
2. frequency hi
3. pulse width lo
4. pulse width hi
5. control: gate is bit 0, then sync, ring, test and the waveform bits
6. attack/decay
7. sustain/release

`$D415`-`$D418` hold the filter and the volume. `$D418` bit 7 disables voice 3.
All SID registers are write-only, except the last four:

| Register | Read gives |
|---|---|
| `$D419` | paddle X value |
| `$D41A` | paddle Y value |
| `$D41B` | voice 3 oscillator (waveform) output. Code that reads it is almost always the random number generator, not audio. |
| `$D41C` | voice 3 envelope (ADSR) output |

## CIA: two chips with the same layout and different jobs

If you confuse the two chips, you get a wrong answer early.

| | CIA#1 `$DC00`: keyboard, joysticks, **IRQ** | CIA#2 `$DD00`: VIC bank, serial, user port, **NMI** |
|---|---|---|
| Port A | `$DC00` keyboard **column** select. Joystick port 2 | `$DD00` VIC bank (bits 0-1, inverted). Serial ATN/CLK/DATA |
| Port B | `$DC01` keyboard **row** read. Joystick port 1 | `$DD01` user port / RS-232 |
| Timers | `$DC04-$DC07`, control at `$DC0E`/`$DC0F` | `$DD04-$DD07`, `$DD0E`/`$DD0F`. These drive **NMI** |
| Interrupt | `$DC0D` | `$DD0D`, same bit layout |

### `$DD00` has two jobs

The same register holds the VIC bank *and* the serial bus lines (bit 2 RS-232
TXD, bits 3-5 ATN/CLOCK/DATA out, bits 6-7 CLOCK/DATA in). So a write during
disk access also moves the view of the VIC on memory, unless the code masks
the bits carefully. **Check the mask** before you decide that a `$DD00` write
is a bank switch. Loader code that writes `$DD00` usually talks to the drive.
