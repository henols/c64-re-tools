---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-03]
probe_date: 2026-09-16
capture_route: snapshot
checkpoint_name: hazard_raster_entry
mask_version: compare-cross-binary-mask-v1
allowlist_path: src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json
subjects:
  hazard-subject:
    prg_sha256: 89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828
    prg_path: src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg
    captures:
      original-a: 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
  hazard-subject-exported-edit:
    prg_sha256: fe46015100b1f340f73dfe15b3f4b4fb318d2ef7f66d088a64babd111a2576a3
    prg_path: src/mcp/vice/fixtures/hazard-subject/hazard-subject-exported-edit.prg
    captures:
      exported-edit: 88c07a9d10a3d562df4ba52589bf9b41cc615848a74aa7fff9abe7d46d775a57
---

# Phase 50: Exported-Edit Modifiability Transcript

This document is Phase 50's evidence of record that the exported-edit
subject's two behaviour changes **take effect in a running emulator**, on
genuine unpatched stock `/usr/bin/x64sc` (VICE 3.9) — one behaviour removed,
one added, both made this time in a file `exportAsmTree()` itself emitted
(`scope_087a.a`), never in a hand-written fixture source. Every value below
was produced by a command actually run on 2026-09-16, or read directly out of
a committed capture. Nothing here is written from memory, and nothing is
transcribed by hand.

`docs/phase50-exported-edit-findings.md` is the **gate** record for this same
subject, and it says outright that it "records a gate verdict for the
EXPORTED-EDIT subject and nothing about behaviour in a running emulator" and
that "the live transcript this plan's own Task 3 commits
(`docs/phase50-exported-modifiability-transcript.md`) is where that evidence
lives". This is that transcript.

## Instrument and procedure

Same instrument `docs/phase50-equivalence-transcript.md` and
`docs/phase50-modifiability-transcript.md` both used: `/usr/bin/x64sc`,
reporting `VICE 3.9.0.0` over the binary monitor (`vice_ping`'s own
`viceVersion` field, quoted below). ACME `release 0.97 ("Zem"), 31 Jan 2021`.
The broker ran as a systemd user unit
(`systemd-run --user --unit=vice-broker --collect …`), never `setsid`/`nohup`,
and was stopped at the end of this session (see "Emulator shutdown" below).
Started `2026-09-16T12:19:53+02:00` (the unit's own journal), reporting

```
vice-broker: backend "stock" (binary: /usr/bin/x64sc)
```

- **Capture route:** `snapshot` — `vice_snapshot_save` followed by
  `vsf-slice.mjs slice`, the identical route every capture in this phase uses.
- **Load route:** `route-d` — the text monitor's own `load` verb, per
  `evidence/LOAD-ROUTE.md`.
- **Capture driver:** `evidence/capture-run.mjs`, through the same
  `dispatchStock()` seam every prior live plan in this phase used, unchanged.
  Exactly one thing differs from plan 50-06's own run: which committed
  subject is loaded (`--subject-id exported-edit`).

## The checkpoint, re-resolved for THIS binary

Assembled the EXPORTED-EDIT tree — the same tree Task 1's own driver produces,
edited by the same committed manifest — directly with a real ACME's
`--symbollist` option, with the tree's own directory as the assembler's
working directory (its root file `!source`s its siblings by bare filename).

```
[2026-09-16T10:15:00Z] $ acme --cpu 6510 -f cbm -o $SCRATCH/hazard-subject-exported-edit-verify.prg \
       --symbollist $SCRATCH/hazard-subject-exported-edit.sym root.a
(exit 0)

$ grep -w hazard_raster_entry $SCRATCH/hazard-subject-exported-edit.sym
	hazard_raster_entry	= $108f

$ grep -w entry $SCRATCH/hazard-subject-exported-edit.sym
	entry	= $80d	; unused
```

The symbol list describes the binary actually committed, proven rather than
assumed — the freshly assembled output is byte-identical to the committed
`hazard-subject-exported-edit.prg`:

```
$ sha256sum $SCRATCH/hazard-subject-exported-edit-verify.prg hazard-subject-exported-edit.prg
fe46015100b1f340f73dfe15b3f4b4fb318d2ef7f66d088a64babd111a2576a3  …/hazard-subject-exported-edit-verify.prg
fe46015100b1f340f73dfe15b3f4b4fb318d2ef7f66d088a64babd111a2576a3  hazard-subject-exported-edit.prg
```

So `hazard_raster_entry` = **`$108F`** (4239) and `entry` = **`$080D`** (2061)
**in this binary** — the identical addresses every other subject in this
phase resolves to. This is recorded even though it turns out to equal every
prior subject's own address, because plan 50-06's own flagged assumption P3
(whether the checkpoint resolution mechanism is exercised by more than
coincidence) is still unresolved, and a third capture at the same address is a
fact worth recording rather than a disappointment worth hiding. The measured
reason it does not move: both source edits replace removed bytes one-for-one
in length (20 removed bytes become 20 `nop`/`jsr` bytes; 3 of those 20 become
the `jsr` itself), so the alignment routine's own scope — which the exporter
pads to `$1000` — ends at exactly the same address it always did. The load
extents confirm this independently, quoted below: both subjects load `from
0801 to 10E7 (08E7 bytes)`.

## The capture

```
[2026-09-16T10:20:51Z] $ node .planning/phases/50-equivalence-and-modifiability/evidence/capture-run.mjs \
    --label exported-edit --subject-id exported-edit --snapshot-name phase50-exported-edit \
    --checkpoint-address 4239 --entry-address 2061
```

`vice_ping`'s own version string, from this run:

```
[2026-09-16T10:20:51Z] CALL vice_ping {}
{"status":"ok","backend":"stock","viceVersion":"VICE 3.9.0.0", …}
```

The route-d load, naming the file stock VICE itself reports it loaded:

```
[2026-09-16T10:20:53Z] CALL vice_program_load {"device":0,"subject":"exported-edit"}
{"command":"load \"/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/fixtures/hazard-subject/hazard-subject-exported-edit.prg\" 0",
 "device":0,"subject":"exported-edit",
 "response":"(C:$fd70) Loading '/home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/fixtures/hazard-subject/hazard-subject-exported-edit.prg' from 0801 to 10E7 (08E7 bytes)\n"}
```

`from 0801 to 10E7 (08E7 bytes)` — the identical extent the committed
subject's own load reports, confirming the edit changed no address.

The checkpoint trapped on the first poll:

```
[2026-09-16T10:20:53Z] CALL vice_checkpoint_list {}
{"checkpoints":[{"id":1,"start":4239,"end":4239,"stop":true,"enabled":true,
 "hitCount":1,…}],"totalReported":1,"entriesReceived":1,"runState":"stopped"}

[2026-09-16T10:20:53Z] CALL vice_registers_get {}
{"registers":{"PC":4239,"A":0,"X":234,"Y":0,"SP":251,"00":47,"01":55,
 "FL":6,"LIN":3,"CYC":30},"unknownIds":[],"memspace":"main","runState":"stopped"}
```

The COMMITTED subject's own registers at the identical checkpoint, quoted
from `run-a.bundle.json` for direct comparison:
`{"PC":4239,"A":0,"X":234,"Y":0,"SP":251,"FL":7,"LIN":2,"CYC":9}`. `A` is `0`
in **both** captures here — unlike `docs/phase50-modifiability-transcript.md`'s
own comparison, where the hand-written subject's added `jsr` sits
**immediately before the routine's `rts`** and its own construction leaves
`A` at `5`. This subject's added `jsr` sits **inside the freed sprite
region, before the routine's own `lda #0 / sta $0400` screen write** (see
`docs/phase50-exported-edit-findings.md`'s "The two behaviour changes"), and
that later `lda #0` overwrites whatever the self-modifying construction left
in `A` before the checkpoint is ever reached. `CYC` is `30` here where the
committed subject's is `9`, and `LIN` is `3` where the committed subject's is
`2` — both are consequences of running the added construction's extra cycles
before the checkpoint, exactly the same shape of consequence
`phase50-modifiability-transcript.md` records for its own subject, only
carried through to a different value because the call site sits at a
different point in the routine. This difference in `A` is itself evidence
that the edit landed at the byte offset the manifest declared, not merely
that "a jsr" runs somewhere.

**Checkpoint deletion, proven by enumeration:**

```
[2026-09-16T10:20:53Z] CALL vice_checkpoint_delete {"checkpoint_num":1}
{"checkpointNum":1,"deleted":true,"runState":"stopped"}

[2026-09-16T10:20:53Z] CALL vice_checkpoint_list {}
{"checkpoints":[],"totalReported":0,"entriesReceived":0,"runState":"stopped"}
```

The checkpoint-list count observed after deletion is `0`. The machine was
then resumed exactly once.

```
[2026-09-16T10:20:53Z] $ node src/skills/c64-ram-capture/scripts/vsf-slice.mjs \
    slice .c64-re-tools/snapshots/phase50-exported-edit.vsf \
    --out .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.bin --json
{"imageBytes":65536,
 "sha256":"88c07a9d10a3d562df4ba52589bf9b41cc615848a74aa7fff9abe7d46d775a57",
 "snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}

$ node .planning/phases/50-equivalence-and-modifiability/evidence/make-sidecar.mjs \
    --bundle .planning/phases/50-equivalence-and-modifiability/evidence/captures/run-exported-edit.bundle.json \
    --image .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.bin \
    --out .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.state.json
wrote .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.state.json
  route=snapshot checkpoint=hazard_raster_entry @ $108F
  registers=49 image_sha256=88c07a9d10a3d562df4ba52589bf9b41cc615848a74aa7fff9abe7d46d775a57
  checkpoints after delete = 0
```

### The two captures compared below

| | subject `.prg` | subject sha256 | capture | capture sha256 | checkpoint |
|---|---|---|---|---|---|
| A | `hazard-subject.prg` | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` | `original-a.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | `hazard_raster_entry` @ `$108F` |
| B | `hazard-subject-exported-edit.prg` | `fe46015100b1f340f73dfe15b3f4b4fb318d2ef7f66d088a64babd111a2576a3` | `exported-edit.bin` | `88c07a9d10a3d562df4ba52589bf9b41cc615848a74aa7fff9abe7d46d775a57` | `hazard_raster_entry` @ `$108F` |

## The removed behaviour, observed

**Anchor `$088B`, finding `page-alignment`, mechanism
`sprite-pointer-names-aligned-base`.** The gate record for this finding is
`docs/phase50-exported-edit-findings.md`, which records that the committed
subject's report carries this finding and that the exported-edit subject's
report does **not** — "the construction that produced it was removed by this
edit".

That is a static fact about the report. What follows is the runtime fact,
read out of the two committed captures.

### `$07F8`, the sprite-0 pointer byte

| Capture | byte at `$07F8` |
|---|---|
| `original-a.bin` | `$41` |
| `exported-edit.bin` | `$00` |

`$41` is 65, and 65 × 64 = `$1040`, which is `align_sprite_base` — the
committed sprite shape's own 64-byte-aligned address. That is the value the
removed write put there. In the exported-edit capture **nothing wrote this
address at all**, and the byte holds `$00`.

Both sidecars' `sprite_pointers` arrays, read out of the captured images at
the pointer table address `vice_sprite_get` itself reported, agree:

```
original-a.state.json      sprite_pointers: [65, 0, 255, 255, 255, 255, 0, 0]
exported-edit.state.json   sprite_pointers: [ 0, 0, 255, 255, 255, 255, 0, 0]
```

### `$D015`, the sprite-enable register

| Capture's sidecar | `$D015` |
|---|---|
| `original-a.state.json` | `$01` |
| `exported-edit.state.json` | `$00` |

The decoded VIC-II answer read in the same paused window agrees
independently: `spriteEnabled[0]` is `true` in the original capture and
`false` in the exported-edit one.

**The sprite pointer is no longer written, and the sprite is no longer
enabled.** Both stores are gone from the running program, not merely from the
exported source.

### `$D000`/`$D001`, the sprite position registers

| Capture's sidecar | `$D000` | `$D001` |
|---|---|---|
| `original-a.state.json` | `$64` | `$64` |
| `exported-edit.state.json` | `$00` | `$00` |

### The instruction bytes themselves, in the capture

The removal is visible as code, not only as consequences. Read from the two
captured images at `$0885`:

```
original-a.bin       $0885: 1B 8D 11 D0  A9 41 8D F8 07  A9 01 8D 15 D0  A9 64 8D 00 D0  A9 64 8D 01 D0  A9 00 8D 00 04  60
exported-edit.bin     $0885: 1B 8D 11 D0  20 39 08  EA EA EA EA EA EA EA EA EA EA EA EA EA EA EA EA EA  A9 00 8D 00 04  60
```

Decoded, the original carries four stores the exported-edit subject does not:

| Bytes | Instruction | What it does |
|---|---|---|
| `A9 41 8D F8 07` | `lda #$41` / `sta $07F8` | writes the sprite-0 pointer |
| `A9 01 8D 15 D0` | `lda #$01` / `sta $D015` | enables sprite 0 |
| `A9 64 8D 00 D0` | `lda #$64` / `sta $D000` | positions sprite 0 in X |
| `A9 64 8D 01 D0` | `lda #$64` / `sta $D001` | positions sprite 0 in Y |

Where `docs/phase50-modifiability-transcript.md`'s own subject replaces this
same 20-byte region with an unbroken run of `nop` and places its own added
`jsr` at the region's own END, this subject's added `jsr` sits at the
region's own START — `20 39 08` (`jsr $0839`) immediately after the `sta
$D011` bank-select write, followed by 17 `nop` bytes padding out the rest.
Both are legitimate placements of the SAME pre-registered edit; the manifest
committed in Task 1 declares this exact positioning (`src/mcp/vice/fixtures/hazard-subject/exported-edit.manifest.json`),
and the capture confirms the manifest's own prediction is what the running
machine actually executed.

## The added behaviour, observed

**Anchor `$0825`, finding `self-modifying-code`, mechanism
`store-target-in-instruction-opcode-byte`.** The gate record is again
`docs/phase50-exported-edit-findings.md`, which records that this finding's
own bytes are unchanged — the construction was always present in the
committed subject — but that "its reachability moves from never-called to
called once".

The call itself is visible in the capture, in the bytes quoted above. At
`$0889` the exported-edit subject carries `20 39 08`, which is `jsr $0839`,
and `$0839` is `hazard_smc2_entry` in this binary's own symbol list. The
committed subject has no such call anywhere: `hazard_smc2_entry` is never
entered.

### The rewritten operand byte at `hazard_smc2_write`

`smc2_operand_addr` resolves to **`$0834`** in this binary's own symbol list
— the immediate operand of the `lda` at `hazard_smc2_write` (`$0833`).

| Capture | byte at `$0834` | the instruction at `$0833` |
|---|---|---|
| `original-a.bin` | `$04` | `A9 04 8D` = `lda #$04` / `sta …` |
| `exported-edit.bin` | `$05` | `A9 05 8D` = `lda #$05` / `sta …` |

**The operand byte was rewritten in place, from `$04` to `$05`, while the
program was running.** The byte that sits in the loaded image is not the byte
the assembler emitted. In the committed subject it is still `$04`, because the
construction that patches it is never called.

### The runtime pointer at `$FC` and `$FD`

| Capture | `$FC` | `$FD` | as a little-endian pointer |
|---|---|---|---|
| `original-a.bin` | `$00` | `$00` | — (never written) |
| `exported-edit.bin` | `$34` | `$08` | `$0834` |

`$34 $08` little-endian is **`$0834`**, which is exactly `smc2_operand_addr`.
**The construction builds its pointer at runtime** — `smc2_ptr_lo` /
`smc2_ptr_hi` in `hazard-subject-smc.a` are `$FC` and `$FD` — and then stores
through it with `sta (smc2_ptr_lo),y` to reach the operand byte. The capture
shows the pointer the run actually built, pointing at the byte the run
actually rewrote. The committed subject leaves both bytes at `$00`.

### The consequence the construction's own store produces

`hazard_smc2_write`'s `lda` feeds a store to the border-colour register. With
the operand patched to `$05`, the exported-edit subject's last write to
`$D020` before this checkpoint comes from this construction:

| Capture's sidecar | `$D020` |
|---|---|
| `original-a.state.json` | `$F2` |
| `exported-edit.state.json` | `$F5` |

The upper nibble reads `$F` in both, because the VIC-II colour registers
decode only four bits and the high nibble reads as open bus — the same
detail the equivalence transcript's own red control section records. The low
nibble is `2` in the original and `5` in the exported-edit capture, and `5`
is the patched operand. The decoded VIC-II answer agrees: `borderColour: 5`.

**So the second self-modifying construction now runs, it builds its pointer
at runtime, and it rewrites the operand byte in place** — all three observed
in a real capture rather than predicted from the source, exactly as
`docs/phase50-modifiability-transcript.md` observed for its own,
hand-written subject.

## Green: comparison with the pre-registered allowlist

The same two captures were compared twice. **The only difference between the
two runs is the allowlist flag.** Same mask, same checkpoint, same row limit,
same image paths, same sidecars.

```
[2026-09-16T10:24:48Z] $ node src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs cross \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.bin \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.bin \
    --state .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.state.json \
            .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.state.json \
    --allowlist src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json \
    --checkpoint hazard_raster_entry --limit 0
```

```
MASK_NARROWED_AT: compare-cross-binary-mask-v1
BYTE_IDENTICAL: no
  (a recorded extra -- the VERDICT line below is the acceptance signal, not this one)
volatile (excluded from the verdict): 4
allowlisted (intentional difference, excluded from the verdict): 28
DIVERGENCE — fails the comparison: 0
total differing addresses (image + register): 32
VERDICT: PASS
```

```
exit status: 0
```

## Red: comparison without the pre-registered allowlist

```
[2026-09-16T10:24:53Z] $ node src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs cross \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.bin \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.bin \
    --state .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.state.json \
            .planning/phases/50-equivalence-and-modifiability/evidence/captures/exported-edit.state.json \
    --no-allowlist --checkpoint hazard_raster_entry --limit 0
```

```
MASK_NARROWED_AT: compare-cross-binary-mask-v1
BYTE_IDENTICAL: no
  (a recorded extra -- the VERDICT line below is the acceptance signal, not this one)
volatile (excluded from the verdict): 4
allowlisted (intentional difference, excluded from the verdict): 0
DIVERGENCE — fails the comparison: 28
  $00FC  $00 -> $34   [image]
  $00FD  $00 -> $08   [image]
  $07F8  $41 -> $00   [image]
  $0834  $04 -> $05   [image]
  $0889  $A9 -> $20   [image]
  $088A  $41 -> $39   [image]
  $088B  $8D -> $08   [image]
  $088C  $F8 -> $EA   [image]
  $088D  $07 -> $EA   [image]
  $088E  $A9 -> $EA   [image]
  $088F  $01 -> $EA   [image]
  $0890  $8D -> $EA   [image]
  $0891  $15 -> $EA   [image]
  $0892  $D0 -> $EA   [image]
  $0893  $A9 -> $EA   [image]
  $0894  $64 -> $EA   [image]
  $0895  $8D -> $EA   [image]
  $0896  $00 -> $EA   [image]
  $0897  $D0 -> $EA   [image]
  $0898  $A9 -> $EA   [image]
  $0899  $64 -> $EA   [image]
  $089A  $8D -> $EA   [image]
  $089B  $01 -> $EA   [image]
  $089C  $D0 -> $EA   [image]
  $D000  $64 -> $00   [register]
  $D001  $64 -> $00   [register]
  $D015  $01 -> $00   [register]
  $D020  $F2 -> $F5   [register]
total differing addresses (image + register): 32
VERDICT: FAIL
```

```
exit status: 1
```

**The same pair fails without the allowlist.** The allowlist is therefore not
vacuous: it is carrying all 28 of these differences, and every one of them
would otherwise be a DIVERGENCE row that fails the comparison. Note this is
28, not the modified subject's own 32 — the difference is entirely
positional, not behavioural: the modified subject's added `jsr` sits three
bytes further from the start of the freed region than this subject's does,
so its own diff table names three additional `nop`-vs-original-byte
addresses inside the same already-allowlisted code range (`2170..4095`).
Every one of those addresses, at either position, is covered by the SAME
existing entry.

## Every allowlisted difference, beside the reason string that covers it

All 28, at `--limit 0`, with nothing elided. The `why` column is the
allowlist document's own reason string for the entry that covers the
address, quoted rather than paraphrased.

| Address | Original → Exported-Edit | Domain | Allowlist entry | The entry's own reason, in brief |
|---|---|---|---|---|
| `$00FC` | `$00` → `$34` | image | `252..253` | "$FC-$FD, the zero-page pointer the added self-modifying construction builds at runtime (smc2_ptr_lo/smc2_ptr_hi…)" |
| `$00FD` | `$00` → `$08` | image | `252..253` | same entry |
| `$07F8` | `$41` → `$00` | image | `2040..2040` | "$07F8, the sprite-0 pointer byte. The removed behaviour … means nothing writes this address any more" |
| `$0834` | `$04` → `$05` | image | `2100..2100` | "the immediate operand byte of the lda at hazard_smc2_write (smc2_operand_addr, $834) … patches this byte from $04 to $05 on its second pass" |
| `$0889` | `$A9` → `$20` | image | `2170..4095` | "the alignment routine's own code range ($87A hazard_align_entry .. $FFF) … Both changes rewrite instruction bytes inside this same range." |
| `$088A` | `$41` → `$39` | image | `2170..4095` | same entry |
| `$088B` | `$8D` → `$08` | image | `2170..4095` | same entry |
| `$088C` | `$F8` → `$EA` | image | `2170..4095` | same entry |
| `$088D` | `$07` → `$EA` | image | `2170..4095` | same entry |
| `$088E` | `$A9` → `$EA` | image | `2170..4095` | same entry |
| `$088F` | `$01` → `$EA` | image | `2170..4095` | same entry |
| `$0890` | `$8D` → `$EA` | image | `2170..4095` | same entry |
| `$0891` | `$15` → `$EA` | image | `2170..4095` | same entry |
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
| `$D000` | `$64` → `$00` | register | `53248..53249` | "$D000-$D001, sprite-0 X/Y position. The removed behaviour … means the modified subject never writes these registers" |
| `$D001` | `$64` → `$00` | register | `53248..53249` | same entry |
| `$D015` | `$01` → `$00` | register | `53269..53269` | "$D015, sprite enable. The removed behaviour … means the modified subject never enables sprite 0." |
| `$D020` | `$F2` → `$F5` | register | `53280..53280` | "$D020, border colour … the added construction … writes this register itself on both of its own passes through hazard_smc2_write" |

All seven of the allowlist's entries produced at least one row for this
subject too; none sat idle. The code-range entry `2170..4095` covers 20 of
the 28 rows, and the other six entries cover the remaining eight: `$07F8`
(1), `$00FC`-`$00FD` (2), `$0834` (1), `$D000`-`$D001` (2), `$D015` (1) and
`$D020` (1). Nothing is unaccounted for in either direction: **all 28
reported differences are covered, and none was left over.**

### The volatile bucket, named rather than skipped

Four addresses differed and fell in the **volatile** bucket — the
hardware-noise mask, a different thing from the allowlist and kept in its
own bucket for exactly that reason:

```
volatile (excluded from the verdict): 4
  $01F8  $00 -> $51   [image]
  $01F9  $00 -> $08   [image]
  $01FA  $52 -> $8B   [image]
  $D012  $02 -> $03   [register]
```

The three stack-page bytes ($01F8-$01FA) are the same class of noise
`docs/phase50-modifiability-transcript.md`'s own run named, consistent with
the added `jsr` pushing a different return address. `$D012` (the raster-line
compare register) differing is new to THIS pair, consistent with the two
runs' extra self-modifying-construction cycles landing the checkpoint hit on
a different raster line (`LIN` is `3` here versus the committed subject's
`2`, quoted above) — a difference the mask already covers under
`IO_MASKED_CANONICAL`. This transcript does not claim either as a measured
fact beyond naming it: the mask excluded them before anything examined them,
and no run here decoded them further.

### No allowlist entry was added after the measurement

The pre-registered allowlist committed by plan 50-03 covered **every**
reported difference for this subject too. **No entry carries an
`added_after_measurement` field, because no entry was added.** The document
is exactly as plan 50-03 committed it — unchanged by this plan's Task 3, as
its own `<verify>` step asserts with `git status --porcelain`.

That is the outcome the pre-registration was for. Had a difference fallen
outside it, the rule would have been to add one entry carrying
`added_after_measurement` with its date and reason — never to widen an
existing entry's range, and never to touch the mask. No such entry was
needed.

### The mask was not touched

`MASK_NARROWED_AT: compare-cross-binary-mask-v1` in both runs, the same
string every prior run in this phase printed. No mask span in
`IMAGE_VOLATILE` or `IO_VOLATILE` was changed, added or deleted by this plan.

## Emulator shutdown

The broker was stopped in the same session as the last emulator call. The
stop time is taken from the unit's own journal
(`journalctl --user -u vice-broker.service -o short-iso` →
`2026-09-16T12:24:31+02:00 … Stopped vice-broker.service`), not clocked at
the shell, because the shell that ran the stop printed none.

```
$ systemctl --user stop vice-broker.service
$ systemctl --user is-active vice-broker.service
inactive
$ ps -eo pid,etime,cmd | grep -Ei 'vice-broker|x64sc' | grep -v grep
(no output)
$ ss -ltnp | grep -E ':66[0-9][0-9]'
(no output)
```

All four checks agree the broker and every emulator it launched are gone.

## What this document establishes

`docs/phase50-modifiability-transcript.md` already established that this
subject's two behaviour changes take effect on genuine stock VICE, and that
the pre-registered allowlist carries real work in that comparison. This
document establishes the same two facts a second time, against a
**different** subject — one whose two behaviour changes were made in
`scope_087a.a`, a file `exportAsmTree()` itself emitted from the committed
annotation store, reassembled through a pre-registered byte manifest and the
same single assembler oracle, never in a hand-written fixture source. That is
the property the sibling transcript's own subject does not carry, and it is
what closes `EQUIV-03` in the literal reading ROADMAP Phase 50 criterion 4
and this plan's own flagged assumption P6 name: "in the rebuilt source" means
a file the exporter emitted, edited, reassembled and observed live.

This document does not claim byte-identity with `hazard-subject-modified.prg`
as any kind of criterion — the two subjects place their added `jsr` at
different byte offsets within the same freed region by design, and
`docs/phase50-exported-edit-findings.md` and this document's own "removed
behaviour" section above both state plainly that this was never a goal. It
does not claim anything about CI: the CI boundary this phase established in
`docs/phase50-ci-boundary.md` is unchanged by this plan, and this live half
was run by a developer against a real host emulator, exactly as every prior
live half in this phase was.
