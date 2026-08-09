# VIC-II: locating every displayed byte

Source: `.planning/RE-FINDINGS.md` § VIC-II discovery (2026-08-01, **MEDIUM**, doc-derived).

**Graphics data is computed, not searched.** Every pointer the VIC follows derives from two
registers plus a bank. Read the bank, read `$D018`, read the mode bits, read `$D015` and the
sprite pointer block, and you have located every byte of graphics on screen. Searching memory for
something the hardware will tell you the address of is the single largest time sink in graphics RE.

`node derive.mjs vic` and `node derive.mjs sprites` do the arithmetic. For what any individual bit
*means*, use `c64-memory-mapping` — it carries the full `$D018` and `$DD00` value tables, and this
file deliberately does not restate them.

## The order, and why it is this order

1. **`$DD00` bits 0-1 — the VIC bank. Read this first, every time.** The bits are **inverted**
   (`%11` → bank 0 at `$0000`, `%00` → bank 3 at `$C000`). Every other pointer is relative to this
   base, so getting it wrong corrupts the whole chain **silently, with no error to signal it**.
   This is the most common source of a wrong answer in C64 graphics RE.
2. **`$D018` — two pointers in one byte.** Bits 4-7 = VM (screen RAM = bank + VM × `$0400`);
   bits 1-3 = CB (charset = bank + CB × `$0800`). In bitmap mode only bit 3 matters: which 8K half
   of the bank the bitmap occupies, and the video matrix then holds colour pairs rather than
   character codes.
3. **The mode bits** — `$D011` bit 6 (ECM), `$D011` bit 5 (BMM), `$D016` bit 4 (MCM). These decide
   what the bytes *mean*; decoding a multicolor sprite as hires produces garbage twice as wide as
   it should be. ECM combined with BMM or MCM is invalid and blanks the screen — if you compute
   that, you probably caught the registers mid-update inside a raster split, so re-read.
4. **`$D015` — the sprite enable mask. Start here, not at the sprite data.** A disabled sprite's
   other registers are stale and decoding them yields noise.
5. **Sprite pointers at video matrix + `$03F8`**, 8 bytes. Each pointer × 64 = the sprite's data
   address *within the current bank*. 63 bytes used of the 64 allocated.

## The hazard that costs an hour

**The character ROM shadow.** The VIC sees character ROM at `$1000-$1FFF` (bank 0) and
`$9000-$9FFF` (bank 2) **regardless of the `$01` banking the CPU sees**. If CB resolves into
either window, the game is using ROM characters and there is no charset in RAM to extract.
`derive.mjs vic` flags this explicitly. Check it before dumping anything.

## Colour is not banked

Colour RAM is fixed at `$D800-$DBFF` and does **not** move with the VIC bank. Only the low nybble
of each byte exists. `$D020` is the border, `$D021-$D024` backgrounds 0-3 (2 and 3 used only in
ECM). Looking for colour data at a bank-relative address finds something else entirely.

## Two watch targets that find the two highest-value routines

`vice_watch_add` finds **writers**, and that is its real leverage in RE — it is under-used relative
to reading memory.

| Watch | Finds |
|---|---|
| `$D018` | The screen-setup routine. In a room- or level-based game this is usually the room loader — one of the highest-value routines to locate early. |
| video matrix + `$03F8` | The animation driver. Rewriting sprite pointers frame to frame is exactly what it does. |

## Reading collision registers changes the game

`$D01E` (sprite-sprite) and `$D01F` (sprite-background) **clear when read**. Reading them while the
game runs steals the collision the game was about to act on — the worst class of observation bug,
because it discredits the capture without announcing itself. Prefer `vice_vicii_get_state`.

Whether the VICE monitor's own read is side-effect-free is **unverified** — treat it as
verify-don't-assume, not as a settled fact.

Many games do software collision anyway: look for coordinate subtraction, comparisons against
width and height, tile lookups, mask tables and bounding-box arithmetic before concluding the
hardware registers are what the game uses.

## Sprite decoding

`vice_sprite_get` / `vice_sprite_inspect` do the pointer arithmetic and the multicolor bit-pair
unpacking. Verify what they return once against a hand-resolved pointer — `derive.mjs sprites`
gives you that hand resolution — then trust them.
