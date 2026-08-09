# Turning findings into ACME source

Do not wait until everything is understood. Stand up a buildable tree early, include the
unidentified bulk as binary, and replace regions with real source as they are confirmed. The tree
stays assemblable at every commit, so a regression has a small blast radius.

`acme-build` covers assembling; this file covers the shape of the source and what makes a
reconstruction correct.

## Start with binary inclusion

```asm
* = $4000
!binary "unknown_4000_5fff.bin"
```

Then replace piece by piece, keeping the addresses fixed:

```asm
* = $4200

UpdatePlayer:
    ; reconstructed code
```

A layout that keeps this workable:

```
src/
  main.a          zeropage.a      irq.a
  input.a         player.a        enemies.a
  collision.a     graphics.a      music.a
  data/
    sprites.a     levels.a        text.a
```

## Behavioural equivalence is this project's definition of correctness

**Correctness here means scripted replay plus comparison at checkpoints — nothing else**
(`.claude/CLAUDE.md` § Constraints). A reconstruction is right when driving it through the
checkpoint set produces the same observable behaviour as the original. **Anything not observable
at a checkpoint is not verified** — the constraint's own conclusion, and the reason checkpoint
design is part of the reconstruction work rather than something to bolt on afterwards.

**That bar is what buys you the freedom to rename routines, reorganise files, replace constants
with symbols and add macros** (`.planning/REQUIREMENTS.md` § Out of Scope makes the same
argument). **But** reorganising changes addresses, which breaks self-modifying code and
timing-sensitive raster routines. Replay through the checkpoint set after EACH reorganisation, not
at the end of several: one changed address per failing replay is a short diagnosis, ten is a
bisect.

A full 64K RAM capture is not a comparison surface: never-written RAM drifts continuously, so
full-64K identity is impossible in principle (`observation-hazards.md` § 7).

## Self-modifying code needs explicit labels

A static disassembler sees `LDA $FFFF,X` and cannot know the operand is written at runtime:

```asm
    LDA SourceAddress
    STA CopyLoop+1
    LDA SourceAddress+1
    STA CopyLoop+2
CopyLoop:
    LDA $FFFF,X
    STA $0400,X
```

Name the patched location so the intent survives:

```asm
CopySource = CopyLoop + 1
```

Look for writes to the byte after an opcode, the two bytes after a `JMP`/`JSR`, branch operands
and immediate constants — `STA Routine+1`, `STX Routine+2`, `INC Routine+1`.

## Label vocabulary: name from evidence, promote on confirmation

Provisional names that carry their own uncertainty beat confident names that turn out wrong:

| Prefix | Means |
|---|---|
| `ZP_` | unknown zero-page variable |
| `State_` | state variable |
| `Flag_` | boolean or bit field |
| `Counter_` | counter |
| `Ptr_` | pointer |
| `Table_` | lookup table |
| `IRQ_` | interrupt routine |
| `Maybe_` | plausible but unconfirmed |
| `Unknown_` | no reliable interpretation yet |

`Routine_43A2` → `Maybe_UpdatePlayer` → `UpdatePlayerPosition`, promoted only when behaviour is
confirmed. Avoid `AmazingCollisionRoutine`-style names entirely; they encode a guess as a fact.

Record the confidence next to the thing, in the same grammar the project uses everywhere else:

```asm
; Confirmed: decremented once per frame while the player is invulnerable.
; Evidence: live, watch on $D015 during damage. Confidence: HIGH.
PlayerInvulnerabilityTimer:
    !byte 0
```

## Data tables a linear disassembler destroys

The split low/high address table is the classic:

```asm
AddressLo:  !byte <Room0, <Room1, <Room2
AddressHi:  !byte >Room0, >Room1, >Room2
```

Without recognising the pair, a disassembler shows meaningless instructions. Other data tells:
referenced through indexed loads, repeated byte patterns, valid PETSCII or screen codes,
sprite-sized 64-byte blocks, values matching VIC-II coordinates.

Code tells: reachable through `JSR`/`JMP`/branches/vectors, **executes during tracing**, plausible
control flow. The project's standing rule settles ties — a range never hit as an instruction
stream across full gameplay coverage is data, whatever the tracer guessed.

## Labels round-trip through VICE

ACME's `--vicelabels` output and regenerator2000's exported label files share one format, which
`vice_symbols_load` / `vice_symbols_lookup` consume. Labels therefore flow
disassembler → source → build → debugger without translation. `acme-build` emits the `.vs` file on
every build; load it after each one and your checkpoints carry real names.
