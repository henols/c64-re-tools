# Memory map — <program name> @ <checkpoint where this was captured>

Capture: `<path to the 64K image>`  ·  SHA-256 `<hash>`
`$01` = `<value>`  ·  VIC bank `<n>` (`$DD00` = `<value>`)  ·  video standard `<PAL/NTSC>`
Live vector pair: `<$0314/$0315 or $FFFE/$FFFF>` → `<handler>`

Every row carries a confidence. Do not promote a row by editing its grade — re-verify and restate
the evidence, so the record of when something stopped being a guess survives.

| Range | Contents | Confidence | Evidence |
|---|---|---|---|
| `$0000-$00FF` | Zero page — game variables | | |
| `$0100-$01FF` | Stack | CONFIRMED | hardware |
| `$0200-$03FF` | KERNAL work area / vectors | | |
| `$0400-$07E7` | Screen RAM (if VM resolves here) | | |
| `$0801-$` | | | |
| `$D800-$DBFF` | Colour RAM | CONFIRMED | hardware, not banked |
| `$E000-$FFFF` | RAM under KERNAL (HIRAM=0) or KERNAL ROM | | |

Confidence vocabulary — the project's HIGH / MEDIUM / LOW scale, applied to classification:

| Grade | Means |
|---|---|
| **confirmed code** | Executed during tracing, PC observed inside it |
| **probable code** | Reachable through a `JSR`/`JMP`/vector, not yet observed executing |
| **confirmed data** | Never hit as an instruction stream across full gameplay coverage |
| **probable data** | Indexed-load target, or matches a data shape (sprite blocks, PETSCII, address tables) |
| **unknown** | No reliable interpretation yet |

Do not force an unknown range through a disassembler and record the output as code. A linear
decode of data is silently wrong and contaminates everything downstream.

## Graphics chain

| What | Address | Derived from |
|---|---|---|
| VIC bank | | `$DD00` bits 0-1, inverted |
| Screen RAM (VM) | | `$D018` bits 4-7 |
| Charset / bitmap (CB) | | `$D018` bits 1-3 |
| Mode | | `$D011` bits 5-6, `$D016` bit 4 |
| Sprite pointers | | VM + `$03F8` |

Character ROM shadow checked: <yes/no — CB in `$1000`/`$9000` of bank 0/2 means no charset in RAM>

## Interrupts

| | Address | Notes |
|---|---|---|
| Live IRQ handler | | |
| Raster positions | | one per `$D012` write on the way out of a handler |
| NMI handler | | `$0318/$0319` or `$FFFA/$FFFB` |
| Timebase | | `$DC0D` untouched ⇒ raster; programmed ⇒ own timebase |

## Routines

| Address | Provisional name | Confirmed by | Confidence |
|---|---|---|---|
| | `Maybe_` | | |

## Open questions

- 
