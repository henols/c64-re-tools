# fixtures/dxa — provenance

## `tracer.prg` (23 bytes)

Hand-built as a minimal, decoder-honest C64 program: a load address, a
canonical `10 SYS 2064` BASIC stub, three pad bytes, then a three-instruction
entry point.

Byte layout (little-endian load address first):

| Offset | Bytes | Meaning |
|---|---|---|
| `$0000-$0001` | `01 08` | load address `$0801` |
| `$0002-$000d` | `0b 08 0a 00 9e 32 30 36 34 00 00 00` | canonical `10 SYS 2064` BASIC stub |
| `$000e-$0010` | `00 00 00` | pad, `$080d-$080f` |
| `$0011-$0012` | `a9 00` | `LDA #$00`, `$0810-$0811` |
| `$0013-$0015` | `8d 20 d0` | `STA $D020`, `$0812-$0814` |
| `$0016` | `60` | `RTS`, `$0815` |

MEASURED this session against the pinned vendored `dxa` binary (sha256
`0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523`), the
exact command that produced the expected output:

```
vendor/dxa/dxa -p all-nmos6502 -d skip-scanning -t detect-internal \
  -R fixtures/dxa/tracer.entrypoints -a dump fixtures/dxa/tracer.prg
```

Output:

```
              	.word $0801
              	* = $0801

0801 0b 08 0a 	.byt $0b,$08,$0a
0804 00 9e 32 	.byt $00,$9e,$32
0807 30 36 34 	.byt $30,$36,$34
080a 00 00 00 	.byt $00,$00,$00
080d 00 00 00 	.byt $00,$00,$00
0810          l810:
0810 a9 00    	lda #$00
0812 8d 20 d0 	sta $d020
0815 60       	rts
```

Classified over the window `$0801-$0815` (`origin=$0801`, `imageSize=21` —
`parsePrg()`'s body length, `23 - 2`): 21 accounted bytes, 6 code bytes
(`$0810-$0815`), 15 data bytes (`$0801-$080f`), 8 byte-emitting matched
lines, zero out-of-window lines. These are the literals `dxa-live.test.ts`
asserts.

## `tracer.entrypoints` (1 line)

```
0810
```

The single hex address `dxa`'s `-R` (routines) flag reads as a known entry
point — the fixture's own `RTS`-terminated three-instruction routine at
`$0810`, matching `main.c`'s `case 'R'` handling (a file of hex addresses,
one per line, no `$` prefix).
