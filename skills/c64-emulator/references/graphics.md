# Reading VIC-II and sprite state

**Read the addresses of the graphics data from the chip. Do not search memory
for them.** Each pointer that the VIC-II follows comes from two registers and
the VIC bank. A few reads give the address of each byte on the screen. A
memory search for data that the chip can locate for you costs the most time
in graphics work.

What each register bit means, and the full `$D018` and `$DD00` value tables,
are in `c64-memory-map`. Its `derive.ts vic` and `derive.ts sprites` commands
calculate addresses from raw register values.

## The reads, in order

Do all of these reads in one paused window. Most reads stop the machine.

| # | Value | Call | Field |
|---|---|---|---|
| 1 | VIC bank (`$DD00` bits 0-1) | `vice_sprite_get` or `vice_cia_get_state` with `cia: 2` | `vicBank`, `vicBankBase` |
| 2 | Screen, charset and bitmap offsets (`$D018`) | `vice_vicii_get_state` | `memorySetup.screenOffset`, `charsetOffset`, `bitmapOffset` |
| 3 | Mode bits (`$D011`, `$D016`) | `vice_vicii_get_state` | `control1.bitmapMode`, `control1.extendedBackgroundMode`, `control2.multicolourMode` |
| 4 | Enabled sprites (`$D015`) | `vice_vicii_get_state` or `vice_sprite_get` | `spriteEnabled`, `sprites[].enabled` |
| 5 | Sprite pointers (screen + `$03F8`) | `vice_sprite_get` | `pointerTableAddress`, `sprites[].pointer`, `sprites[].dataAddress` |

Read the bank first. Each other pointer is relative to the bank. A wrong bank
makes each address in the chain wrong, and no error tells you. This is the
most frequent cause of a wrong answer in C64 graphics work.

`vice_vicii_get_state` gives the `$D018` pointers **relative to the bank**
(`memorySetup.relativeTo` says so). Add `vicBankBase` to get an absolute
address. `vice_sprite_get` gives the absolute `screenBase` and the absolute
`dataAddress` of each sprite for you.

When the mode bits show a mode that is not valid (for example ECM together
with bitmap or multicolour mode), you possibly read the registers during a
raster split, while the program changed them. Read them again.

`vice_io_registers` with an address in `$D000-$D3FF` gives VICE's own decode
of the VIC-II: a 64-byte register dump, the screen state and a sprite table.
It refuses an address that another chip covers.

## Character ROM and colour RAM

- The VIC-II sees the character ROM at `$1000-$1FFF` (bank 0) and
  `$9000-$9FFF` (bank 2), whatever `$01` selects for the CPU. If the charset
  address falls in one of these windows, the program uses the ROM
  characters. A `vice_memory_read` there gives the RAM, not what the screen
  shows. `derive.ts vic` in `c64-memory-map` flags this case.
- Colour RAM is always at `$D800-$DBFF`. It does not move with the VIC bank.
  Read it through the `io` bank. What the nybbles mean is in
  `c64-memory-map`.

## Collision registers

`$D01E` (sprite to sprite) and `$D01F` (sprite to background) clear when a
program reads them. A raw read while the game runs takes the collision that
the game was about to use. Use `vice_vicii_get_state`. Hazard 3 in
[observation-hazards.md](observation-hazards.md) tells what is verified about
this read and what is not.

## Watch the writers

`vice_watch_add` with `type` store finds the code that **writes** an address.
It shows where a value comes from faster than a memory read does. Two useful
targets are `$D018` and the sprite pointer table (`pointerTableAddress` from
`vice_sprite_get`). What to do with the routines that you find is in
`c64-reverse-engineering`.

## Decoding a sprite

`vice_sprite_get` calculates the pointers. `vice_sprite_inspect` unpacks the
multicolour bit pairs and shows the data as a grid. Check the result one time
against a pointer that you calculated with `derive.ts sprites`. After that,
trust the tools.

- Check `enabled` first. The registers of a disabled sprite hold old values,
  and a decode of them gives noise.
- The `vice_sprite_inspect` grid shows the sprite's **data block** at its own
  size: 24 × 21 for hi-res, 12 × 21 for multicolour. The expansion bits
  (`$D017`, `$D01D`) do **not** scale the grid. A sprite that shows double
  size on the screen still shows at its own size in the grid.
- `format: 'png_base64'` is refused. Use `ascii` or `binary`.
