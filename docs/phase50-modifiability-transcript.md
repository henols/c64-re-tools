---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-01, EQUIV-03]
probe_date: 2026-09-15
capture_route: snapshot
checkpoint_name: hazard_raster_entry
mask_version: compare-cross-binary-mask-v1
allowlist_path: src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json
subjects:
  hazard-subject:
    prg_sha256: 89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828
    captures:
      original-a: 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
  hazard-subject-modified:
    prg_sha256: fd16c6c171da90e693dca10c1df0b1f6817563e0c3d1af99bcc572bceb7d641d
    captures:
      modified: 72269fd11d852b87e99ef213c0d549dbb2df6960f3e38c8f0e8904294e340a8b
---

# Phase 50: Modifiability Transcript

This document is Phase 50's evidence of record that the modified subject's two
behaviour changes **take effect in a running emulator** — one behaviour removed,
one added. Every value below was produced by a command actually run on
2026-09-15 against genuine unpatched stock `/usr/bin/x64sc` (VICE 3.9), or read
directly out of a committed capture. Nothing here is written from memory, and
nothing is transcribed by hand.

`docs/phase50-modifiability-findings.md` is the **gate** record for this same
subject, and it says outright that it "records a gate verdict for the MODIFIED
subject and nothing about behaviour in a running emulator" and that "the live
transcript that plan 50-06 commits is where that evidence lives". This is that
transcript.

## Instrument and procedure

The capture repeats `docs/phase50-equivalence-transcript.md`'s
`## Capture procedure` without change — same driver (`evidence/capture-run.mjs`,
through the same `dispatchStock()` seam), same route-d load, same `snapshot`
route, same logical checkpoint, same broker argv, same genuine unpatched stock
`/usr/bin/x64sc`. Exactly one thing differs, and it is which committed subject
is loaded. The broker session is the same one that served the green comparison:
started `[2026-09-15T19:50:10Z]`, reporting its own binary as

```
vice-broker: backend "stock" (binary: /usr/bin/x64sc)
```

### The checkpoint, re-resolved for THIS binary

**This is the binary whose layout actually differs**, so this run is what
genuinely exercises per-binary checkpoint resolution (this plan's own flagged
assumption P3). The modified subject has no committed root source of its own —
`make-hazard-subject-fixtures.mjs` synthesizes one by swapping one `!source`
line in `hazard-subject.a` for `hazard-subject-align-nosprite.a` — so the same
synthesis was performed, assembled, and read.

The timestamp below is derived from the run's own output files' mtimes
(`stat -c %y` on `m2.prg` and `m2.sym`, both `2026-09-15 21:49:51 +0200`),
because the shell that ran the assembler printed none. It is recorded that way
rather than rounded to a plausible value.

```
[2026-09-15T19:49:51Z] $ cd src/mcp/vice/fixtures/hazard-subject
$ acme --cpu 6510 -f cbm -o $SCRATCH/m2.prg \
       --symbollist $SCRATCH/m2.sym $SCRATCH/synthesized-modified-root.a
(exit 0)

$ grep -E 'hazard_raster_entry|^[[:space:]]*entry[[:space:]]|smc2_operand_addr|hazard_smc2_write|hazard_smc2_entry' $SCRATCH/m2.sym
	hazard_smc2_write	= $833
	smc2_operand_addr	= $834
	entry	= $80d	; ?
	hazard_smc2_entry	= $839
	hazard_raster_entry	= $108f	; ?
```

The symbol list describes the committed binary, proven rather than assumed:

```
$ sha256sum $SCRATCH/m2.prg hazard-subject-modified.prg
fd16c6c171da90e693dca10c1df0b1f6817563e0c3d1af99bcc572bceb7d641d  …/m2.prg
fd16c6c171da90e693dca10c1df0b1f6817563e0c3d1af99bcc572bceb7d641d  hazard-subject-modified.prg
```

So `hazard_raster_entry` = **`$108F`** (4239) and `entry` = **`$080D`** (2061)
**in this binary**, and `smc2_operand_addr` = **`$0834`** (2100),
`hazard_smc2_write` = **`$0833`**, `hazard_smc2_entry` = **`$0839`**.

**The checkpoint resolves to the same address as the original's, and the
measured reason is recorded rather than left to look like luck.** The
modification lives entirely inside the alignment routine's own range, which the
subject pads to `$1000` with a fill. Removing four stores and adding one `jsr`
changes how much of that range is code and how much is fill, and changes nothing
about where the range ends. `hazard_raster_entry` sits after it, at `$108F`, and
does not move. The load extents confirm this independently: both subjects load
`from 0801 to 10E7 (08E7 bytes)`. The address was nevertheless **read from this
binary's own symbol list**, never transcribed, because a mechanism that is only
exercised when it happens to matter is a mechanism nobody has tested.

### The capture

```
[2026-09-15T19:50:52Z] $ node …/evidence/capture-run.mjs \
    --label modified --subject-id modified --snapshot-name phase50-modified \
    --checkpoint-address 4239 --entry-address 2061
```

The route-d load, naming the file stock VICE itself reports it loaded:

```
[2026-09-15T19:50:55Z] CALL vice_program_load {"device":0,"subject":"modified"}
{"command":"load \"…/fixtures/hazard-subject/hazard-subject-modified.prg\" 0",
 "device":0,"subject":"modified",
 "response":"(C:$fd70) Loading '…/hazard-subject-modified.prg' from 0801 to 10E7 (08E7 bytes)\n"}
```

The checkpoint trapped, and the CPU registers read in the same paused window
confirm it independently — `PC` is 4239, which is `$108F`:

```
[2026-09-15T19:50:55Z] CALL vice_checkpoint_list {}
{"checkpoints":[{"id":1,"start":4239,"end":4239,"stop":true,"enabled":true,
 "hitCount":1,…}],"totalReported":1,"entriesReceived":1,"runState":"stopped"}

[2026-09-15T19:50:55Z] CALL vice_registers_get {}
{"registers":{"PC":4239,"A":5,"X":234,"Y":0,"SP":251,"00":47,"01":55,
 "FL":4,"LIN":2,"CYC":59},"memspace":"main","runState":"stopped"}
```

`A` is `5` here where the original's is `0`, and `CYC` is 59 where the
original's is 9. Both are consequences of the added construction, which runs
immediately before the checkpoint — see "The added behaviour, observed" below.

**Checkpoint deletion, proven by enumeration:**

```
[2026-09-15T19:50:55Z] CALL vice_checkpoint_delete {"checkpoint_num":1}
{"checkpointNum":1,"deleted":true,"runState":"stopped"}

[2026-09-15T19:50:55Z] CALL vice_checkpoint_list {}
{"checkpoints":[],"totalReported":0,"entriesReceived":0,"runState":"stopped"}
```

**The checkpoint-list count observed after deletion is `0`.** The machine was
then resumed exactly once.

```
[2026-09-15T19:51:09Z] $ node src/skills/c64-ram-capture/scripts/vsf-slice.mjs \
    slice .c64-re-tools/snapshots/phase50-modified.vsf \
    --out …/evidence/captures/modified.bin --json
{"imageBytes":65536,
 "sha256":"72269fd11d852b87e99ef213c0d549dbb2df6960f3e38c8f0e8904294e340a8b",
 "snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
```

```
[2026-09-15T19:51:09Z] $ node …/evidence/make-sidecar.mjs \
    --bundle …/captures/run-modified.bundle.json \
    --image …/captures/modified.bin \
    --out …/captures/modified.state.json
wrote …/captures/modified.state.json
  route=snapshot checkpoint=hazard_raster_entry @ $108F
  registers=49 image_sha256=72269fd11d852b87e99ef213c0d549dbb2df6960f3e38c8f0e8904294e340a8b
  checkpoints after delete = 0
```

### The two captures compared below

| | subject `.prg` | subject sha256 | capture | capture sha256 | checkpoint |
|---|---|---|---|---|---|
| A | `hazard-subject.prg` | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` | `original-a.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | `hazard_raster_entry` @ `$108F` |
| B | `hazard-subject-modified.prg` | `fd16c6c171da90e693dca10c1df0b1f6817563e0c3d1af99bcc572bceb7d641d` | `modified.bin` | `72269fd11d852b87e99ef213c0d549dbb2df6960f3e38c8f0e8904294e340a8b` | `hazard_raster_entry` @ `$108F` |

## The removed behaviour, observed

**Anchor `$088B`, finding `page-alignment`, mechanism
`sprite-pointer-names-aligned-base`.** The gate record for this finding is
`docs/phase50-modifiability-findings.md`, which records that the committed
subject's report carries this finding and that the modified subject's report
does **not** — "the construction that produced it was removed by this
modification".

That is a static fact about the report. What follows is the runtime fact,
read out of the two committed captures.

### `$07F8`, the sprite-0 pointer byte

| Capture | byte at `$07F8` |
|---|---|
| `original-a.bin` | `$41` |
| `modified.bin` | `$00` |

`$41` is 65, and 65 × 64 = `$1040`, which is `align_sprite_base` — the
committed sprite shape's own 64-byte-aligned address. That is the value the
removed write put there. In the modified capture **nothing wrote this address
at all**, and the byte holds `$00`.

Both sidecars' `sprite_pointers` arrays, read out of the captured images at the
pointer table address `vice_sprite_get` itself reported, agree:

```
original-a.state.json  sprite_pointers: [65, 0, 255, 255, 255, 255, 0, 0]
modified.state.json    sprite_pointers: [ 0, 0, 255, 255, 255, 255, 0, 0]
```

### `$D015`, the sprite-enable register

| Capture's sidecar | `$D015` |
|---|---|
| `original-a.state.json` | `$01` |
| `modified.state.json` | `$00` |

The decoded VIC-II answer read in the same paused window agrees independently:
`spriteEnabled[0]` is `true` in the original capture and `false` in the
modified one.

**The sprite pointer is no longer written, and the sprite is no longer
enabled.** Both stores are gone from the running program, not merely from the
source.

### The instruction bytes themselves, in the capture

The removal is visible as code, not only as consequences. Read from the two
captured images at `$0885`:

```
original-a.bin  $0885: 1B 8D 11 D0  A9 41 8D F8 07  A9 01 8D 15 D0  A9 64 8D 00 D0  A9 64 8D 01 D0  A9 00 8D 00 04  60
modified.bin    $0885: 1B 8D 11 D0  A9 00 8D 00 04  20 39 08  60  EA EA EA EA EA EA EA EA EA EA EA EA EA EA EA EA EA
```

Decoded, the original carries four stores the modified subject does not:

| Bytes | Instruction | What it does |
|---|---|---|
| `A9 41 8D F8 07` | `lda #$41` / `sta $07F8` | writes the sprite-0 pointer |
| `A9 01 8D 15 D0` | `lda #$01` / `sta $D015` | enables sprite 0 |
| `A9 64 8D 00 D0` | `lda #$64` / `sta $D000` | positions sprite 0 in X |
| `A9 64 8D 01 D0` | `lda #$64` / `sta $D001` | positions sprite 0 in Y |

`$D000` and `$D001` confirm the last two at runtime as well: both read `$64`
in the original capture's sidecar and `$00` in the modified one.

## The added behaviour, observed

**Anchor `$0825`, finding `self-modifying-code`, mechanism
`store-target-in-instruction-opcode-byte`.** The gate record is again
`docs/phase50-modifiability-findings.md`, which records that this finding's own
bytes are unchanged — the construction was always present in the committed
subject — but that "its reachability moves from never-called to called once".

The call itself is visible in the capture, in the bytes quoted above. At
`$088E` the modified subject carries `20 39 08`, which is `jsr $0839`, and
`$0839` is `hazard_smc2_entry` in this binary's own symbol list. The committed
subject has no such call anywhere: `hazard_smc2_entry` is never entered.

### The rewritten operand byte at `hazard_smc2_write`

`smc2_operand_addr` resolves to **`$0834`** in this binary's own symbol list —
the immediate operand of the `lda` at `hazard_smc2_write` (`$0833`).

| Capture | byte at `$0834` | the instruction at `$0833` |
|---|---|---|
| `original-a.bin` | `$04` | `A9 04 8D` = `lda #$04` / `sta …` |
| `modified.bin` | `$05` | `A9 05 8D` = `lda #$05` / `sta …` |

**The operand byte was rewritten in place, from `$04` to `$05`, while the
program was running.** The byte that sits in the loaded image is not the byte
the assembler emitted. In the committed subject it is still `$04`, because the
construction that patches it is never called.

### The runtime pointer at `$FC` and `$FD`

| Capture | `$FC` | `$FD` | as a little-endian pointer |
|---|---|---|---|
| `original-a.bin` | `$00` | `$00` | — (never written) |
| `modified.bin` | `$34` | `$08` | `$0834` |

`$34 $08` little-endian is **`$0834`**, which is exactly `smc2_operand_addr`.
**The construction builds its pointer at runtime** — `smc2_ptr_lo` / `smc2_ptr_hi`
in `hazard-subject-smc.a` are `$FC` and `$FD` — and then stores through it with
`sta (smc2_ptr_lo),y` to reach the operand byte. The capture shows the pointer
the run actually built, pointing at the byte the run actually rewrote. The
committed subject leaves both bytes at `$00`.

### The consequence the construction's own store produces

`hazard_smc2_write`'s `lda` feeds a store to the border-colour register. With
the operand patched to `$05`, the modified subject's last write to `$D020`
before this checkpoint comes from this construction:

| Capture's sidecar | `$D020` |
|---|---|
| `original-a.state.json` | `$F2` |
| `modified.state.json` | `$F5` |

The upper nibble reads `$F` in both, because the VIC-II colour registers decode
only four bits and the high nibble reads as open bus — the same detail the red
control section of the equivalence transcript records. The low nibble is `2` in
the original and `5` in the modified capture, and `5` is the patched operand.
The decoded VIC-II answer agrees: `borderColour: 5`. The CPU's own `A` register
at the checkpoint is `5` for the same reason.

**So the second self-modifying construction now runs, it builds its pointer at
runtime, and it rewrites the operand byte in place** — all three observed in a
real capture rather than predicted from the source.

## The allowlist earns its place

The same two captures were compared twice. **The only difference between the
two runs is the allowlist flag.** Same mask, same checkpoint, same row limit,
same image paths, same sidecars.

### Run 1 — with the pre-registered allowlist

```
[2026-09-15T19:51:36Z] $ node src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs cross \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.bin \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/modified.bin \
    --state .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.state.json \
            .planning/phases/50-equivalence-and-modifiability/evidence/captures/modified.state.json \
    --allowlist src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json \
    --checkpoint hazard_raster_entry --limit 0
```

```
MASK_NARROWED_AT: compare-cross-binary-mask-v1
BYTE_IDENTICAL: no
  (a recorded extra -- the VERDICT line below is the acceptance signal, not this one)
volatile (excluded from the verdict): 3
allowlisted (intentional difference, excluded from the verdict): 32
DIVERGENCE — fails the comparison: 0
total differing addresses (image + register): 35
VERDICT: PASS
```

```
exit status: 0
```

### Run 2 — with `--no-allowlist`

```
[2026-09-15T19:51:49Z] $ node src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs cross \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.bin \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/modified.bin \
    --state .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.state.json \
            .planning/phases/50-equivalence-and-modifiability/evidence/captures/modified.state.json \
    --no-allowlist --checkpoint hazard_raster_entry --limit 0
```

```
MASK_NARROWED_AT: compare-cross-binary-mask-v1
BYTE_IDENTICAL: no
  (a recorded extra -- the VERDICT line below is the acceptance signal, not this one)
volatile (excluded from the verdict): 3
allowlisted (intentional difference, excluded from the verdict): 0
DIVERGENCE — fails the comparison: 32
total differing addresses (image + register): 35
VERDICT: FAIL
```

```
exit status: 1
```

**The same pair fails without the allowlist.** The allowlist is therefore not
vacuous: it is carrying all 32 of these differences, and every one of them
would otherwise be a DIVERGENCE row that fails the comparison.

### Every allowlisted difference, beside the reason string that covers it

All 32, at `--limit 0`, with nothing elided. The `why` column is the allowlist
document's own reason string for the entry that covers the address, quoted
rather than paraphrased.

| Address | Original → Modified | Domain | Allowlist entry | The entry's own reason, in brief |
|---|---|---|---|---|
| `$00FC` | `$00` → `$34` | image | `252..253` | "$FC-$FD, the zero-page pointer the added self-modifying construction builds at runtime (smc2_ptr_lo/smc2_ptr_hi…)" |
| `$00FD` | `$00` → `$08` | image | `252..253` | same entry |
| `$07F8` | `$41` → `$00` | image | `2040..2040` | "$07F8, the sprite-0 pointer byte. The removed behaviour … means nothing writes this address any more" |
| `$0834` | `$04` → `$05` | image | `2100..2100` | "the immediate operand byte of the lda at hazard_smc2_write (smc2_operand_addr, $834) … patches this byte from $04 to $05 on its second pass" |
| `$088A` | `$41` → `$00` | image | `2170..4095` | "the alignment routine's own code range ($87A hazard_align_entry .. $FFF) … Both changes rewrite instruction bytes inside this same range." |
| `$088C` | `$F8` → `$00` | image | `2170..4095` | same entry |
| `$088D` | `$07` → `$04` | image | `2170..4095` | same entry |
| `$088E` | `$A9` → `$20` | image | `2170..4095` | same entry |
| `$088F` | `$01` → `$39` | image | `2170..4095` | same entry |
| `$0890` | `$8D` → `$08` | image | `2170..4095` | same entry |
| `$0891` | `$15` → `$60` | image | `2170..4095` | same entry |
| `$0892` | `$D0` → `$EA` | image | `2170..4095` | same entry |
| `$0893` | `$A9` → `$EA` | image | `2170..4095` | same entry |
| `$0894` | `$64` → `$EA` | image | `2170..4095` | same entry |
| `$0895` | `$8D` → `$EA` | image | `2170..4095` | same entry |
| `$0896` | `$00` → `$EA` | image | `2170..4095` | same entry |
| `$0897` | `$D0` → `$EA` | image | `2170..4095` | same entry |
| `$0898` | `$A9` → `$EA` | image | `2170..4095` | same entry |
| `$0899` | `$64` → `$EA` | image | `2170..4095` | same entry |
| `$089A` | `$8D` → `$EA` | image | `2170..4095` | same entry |
| `$089B` | `$01` → `$EA` | image | `2170..4095` | same entry |
| `$089C` | `$D0` → `$EA` | image | `2170..4095` | same entry |
| `$089D` | `$A9` → `$EA` | image | `2170..4095` | same entry |
| `$089E` | `$00` → `$EA` | image | `2170..4095` | same entry |
| `$089F` | `$8D` → `$EA` | image | `2170..4095` | same entry |
| `$08A0` | `$00` → `$EA` | image | `2170..4095` | same entry |
| `$08A1` | `$04` → `$EA` | image | `2170..4095` | same entry |
| `$08A2` | `$60` → `$EA` | image | `2170..4095` | same entry |
| `$D000` | `$64` → `$00` | register | `53248..53249` | "$D000-$D001, sprite-0 X/Y position. The removed behaviour … means the modified subject never writes these registers" |
| `$D001` | `$64` → `$00` | register | `53248..53249` | same entry |
| `$D015` | `$01` → `$00` | register | `53269..53269` | "$D015, sprite enable. The removed behaviour … means the modified subject never enables sprite 0." |
| `$D020` | `$F2` → `$F5` | register | `53280..53280` | "$D020, border colour … the added construction … writes this register itself on both of its own passes through hazard_smc2_write" |

All seven of the allowlist's entries produced at least one row; none sat idle.
The code-range entry `2170..4095` covers 24 of the 32 rows, and the other six
entries cover the remaining eight: `$07F8` (1), `$00FC`-`$00FD` (2), `$0834` (1),
`$D000`-`$D001` (2), `$D015` (1) and `$D020` (1). Nothing is unaccounted for in
either direction: **all 32 reported differences are covered, and none was left
over.**

### The volatile bucket, named rather than skipped

Three further addresses differed and fell in the **volatile** bucket — the
hardware-noise mask, which is a different thing from the allowlist and is kept
in its own bucket for exactly that reason:

```
volatile (excluded from the verdict): 3
  $01F8  $00 %00000000  ->  $51 %01010001   [image]
  $01F9  $00 %00000000  ->  $08 %00001000   [image]
  $01FA  $52 %01010010  ->  $90 %10010000   [image]
```

These are stack-page bytes, covered by `compare-cross-binary-mask-v1` as
committed by plan 50-01 and left unchanged by plan 50-04's calibration. They
are consistent with the added `jsr` pushing a different return address, but
**this transcript does not claim that as a measurement** — the mask excluded
them before anything examined them, and no run here decoded them. They are
named here rather than passed over silently.

### No allowlist entry was added after the measurement

The pre-registered allowlist committed by plan 50-03 covered **every** reported
difference. **No entry carries an `added_after_measurement` field, because no
entry was added.** The document is exactly as plan 50-03 committed it, before
any capture of this subject existed.

That is the outcome the pre-registration was for. Had a difference fallen
outside it, the rule would have been to add one entry carrying
`added_after_measurement` with its date and reason — never to widen an existing
entry's range, and never to touch the mask.

### The mask was not touched

`MASK_NARROWED_AT: compare-cross-binary-mask-v1` in both runs, the same string
the calibration, the red control and the green comparison all printed. No mask
span in `IMAGE_VOLATILE` or `IO_VOLATILE` was changed, added or deleted by this
plan.

## Emulator shutdown

The broker was stopped in the same session as the last emulator call. The stop
time is taken from the unit's own journal
(`journalctl --user -u vice-broker.service -o short-iso` →
`2026-09-15T21:51:17+02:00 … Stopped vice-broker.service`), not clocked at the
shell, because the shell that ran the stop printed none.

```
[2026-09-15T19:51:17Z] $ systemctl --user stop vice-broker.service
$ systemctl --user is-active vice-broker.service
inactive
$ ps -eo pid,etime,cmd | grep -Ei 'vice-broker|x64sc' | grep -v grep
(no output)
$ ss -ltnp | grep -E ':66[0-9][0-9]'
(no output)
$ ss -ltnp | grep -E ':19510'
(no output)
```

## What this document does and does not establish

Recorded plainly, without overclaiming:

- **It establishes that both behaviour changes take effect in a running
  emulator.** The removed behaviour is observed as the absent sprite-pointer
  value at `$07F8` and the cleared sprite-enable bit at `$D015`, with the four
  removed stores visible as instruction bytes in the capture. The added
  behaviour is observed as the rewritten operand byte at
  `smc2_operand_addr` (`$0834`, `$04` → `$05`) and the runtime-built pointer at
  `$FC`/`$FD` (`$0834`), with the `jsr $0839` that reaches it visible in the
  same capture.
- **Each change is cross-referenced to a named committed finding** — `$088B`
  `page-alignment` `sprite-pointer-names-aligned-base`, and `$0825`
  `self-modifying-code` `store-target-in-instruction-opcode-byte` — both
  recorded in `docs/phase50-modifiability-findings.md`, which is the gate
  record ROADMAP criterion 4 binds the demonstration to.
- **It establishes that the allowlist is carrying real work**, because the same
  pair fails without it with 32 DIVERGENCE rows and exit status 1.
- **It does not establish that the allowlist's ranges are minimal.** The
  `2170..4095` entry is a whole code range, not a per-address list, so it would
  also have covered a difference inside that range nobody intended. That is a
  property of a pre-registered range entry and is stated rather than hidden.
- **It does not re-establish the instrument's sensitivity.** That rests on the
  red control in `docs/phase50-equivalence-transcript.md`, committed before any
  green result existed.
- **It says nothing about the three volatile-bucket addresses.** They were
  excluded by the mask before anything examined them.
- **It does not stress per-binary checkpoint resolution.** The mechanism was
  exercised — the address was read from this binary's own symbol list, and the
  capture used the address that read produced — but the modified subject
  resolved to `$108F`, the same address as the original and as the regressed
  twin. This plan's flagged assumption P3 expected a differing address to
  stress the mechanism. No run in this phase produced one, so P3 remains
  unresolved rather than tested.
