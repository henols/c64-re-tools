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

## `fixture.a`, `fixture.rep`, `fixture.prg` (35-03, DXA-04)

Phase 35, plan 35-03's source-derived ground-truth tier (`partitionSourceDerived()`
in `dxa-partition.ts`). `fixture.a` is copied UNCHANGED from
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/fixture/fixture.a`
— the same 279-byte synthetic fixture Phase 23 independently re-derived a
145-code / 131-data / 3-pad partition for, byte by byte, from ACME's own
`-r` report (`evidence/fixture/fixture-baseline.txt`, "OUTCOME LINES"
section and its section-5 transcript). `fixture.rep` and `fixture.prg` are
generated ONCE from `fixture.a` on this host and committed so
`dxa-partition.test.ts` never invokes ACME itself (hermetic).

**Exact command, version, date:**

```
$ acme --version
This is ACME, release 0.97 ("Zem"), 31 Jan 2021
  Platform independent version.

$ acme -f cbm -o fixture.prg -l fixture.lbl -r fixture.rep fixture.a
[exit 0]
```

Run 2026-09-04 at `/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/fixtures/dxa/`
(`fixture.lbl` was produced as a side effect of `-l` and discarded — not
committed, not needed by anything in this plan). `fixture.prg`'s sha256
below is BYTE-IDENTICAL to Phase 23's own `fixture.prg`
(`fixture-baseline.txt` section 1: `62ab9a2c287bf...`), independent
confirmation that the same assembler on the same source reproduces the same
image, not a lookalike.

**Per-file sha256:**

| File | sha256 |
|---|---|
| `fixture.a` | `6fe226013a588ea8a24f9ec04074532e860595aab582ec2949c32adb7fd5d48a` |
| `fixture.rep` | `3b905431b2ba8a711fc4b695f9b9e6f3b142232f2e9321b12812fb98f594f9d0` |
| `fixture.prg` | `62ab9a2c287bf33f959be28409eeae5a46b6bf1ac6d2f7e88b7850611a6fc2c0` |

`fixture.prg` is 281 bytes: a 2-byte `$0801` load-address header plus the
279-byte image. `dxa-partition.test.ts` reproduces
`GT_CODE_BYTES: 145`, `GT_DATA_BYTES: 131`, `GT_PAD_BYTES: 3`,
`GT_EMISSIONS: 90`, `GT_TRUNCATED_COLUMNS_RECOVERED: 4` from these two files
alone, with no dxa and no ACME in the loop at test time.

## `basic-stub.prg` (18 bytes, 35-03, DXA-04)

Phase 35, plan 35-03's byte-derived ground-truth tier
(`partitionByteDerived()` in `dxa-partition.ts`). Hand-built (via
`printf` writing raw bytes, never retyped through generated text) as the
smallest input exercising both of that tier's two decidable facts: the
`.prg` header exclusion, and a cleanly-parsed canonical `10 SYS 2064` BASIC
stub, followed by a short non-BASIC tail so the `unknown` region and the
adjacency case (the end-of-program marker vs. the byte right after it) both
have something real to be about.

Byte layout (little-endian load address first):

| Offset | Bytes | Meaning |
|---|---|---|
| `$0000-$0001` | `01 08` | `.prg` load-address header — `$0801`, EXCLUDED from the partition entirely |
| `$0002-$000d` | `0b 08 0a 00 9e 32 30 36 34 00 00 00` | canonical `10 SYS 2064` BASIC stub, `$0801-$080c` — certain-data |
| `$000e-$0011` | `aa bb cc dd` | arbitrary non-BASIC tail, `$080d-$0810` — `unknown` |

sha256: `01b9dc6965426b4940262db29f489105d23e58933695a4e451eb5f1a30ebbde8`.

`dxa-partition.test.ts` asserts exactly 12 certain-data bytes
(`$0801-$080c`), exactly 4 `unknown` bytes (`$080d-$0810`), and that the
end-of-program marker's two bytes (`$080b-$080c`) are certain-data while the
very next address (`$080d`) is `unknown` and the two never merge into one
range.
