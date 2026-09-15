---
phase: 50-equivalence-and-modifiability
requirement: [EQUIV-01, EQUIV-02]
probe_date: 2026-09-15
capture_route: snapshot
checkpoint_name: hazard_raster_entry
mask_version: compare-cross-binary-mask-v1
subjects:
  hazard-subject:
    prg_sha256: 89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828
    captures:
      original-a: 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
      original-b: 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
  # Added 2026-09-15 by plan 50-05's red control.
  hazard-subject-regressed:
    prg_sha256: fd6484f1101ef0773c0137d479e6b630c247169445ddb01b149072bd8df21427
    captures:
      regressed: d18830159c1c385901c7c97280fc91adb1dbfad167ee44ce0186bd0c663b2b97
  # Added 2026-09-15 by plan 50-06's green comparison. This one is not a
  # committed fixture: it is the rebuild produced from hazard-subject's own
  # committed annotation store (evidence/REBUILD.md), living under the phase
  # evidence directory.
  hazard-subject-rebuild:
    prg_sha256: 89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828
    captures:
      rebuild: 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
---

# Phase 50: Equivalence Transcript

This document is Phase 50's evidence of record for the live capture path. It
is not a walkthrough. Every value below was produced by a command actually run
on 2026-09-15, and every raw excerpt is quoted from that command's own output.
Nothing here is written from memory, and nothing is transcribed by hand.

## Instrument

- **Emulator:** `/usr/bin/x64sc`, which reports `x64sc (VICE 3.9)`
  (`/usr/bin/x64sc --version`). This is the genuine unpatched stock build, owned
  by the Debian `vice` package (`dpkg -S /usr/bin/x64sc` → `vice:
  /usr/bin/x64sc`). The absolute path is load-bearing: a fork build at
  `/usr/local/bin/x64sc` shadows it on `$PATH`, and the broker was pinned to the
  stock one with `VICE_BIN=/usr/bin/x64sc`.
- **Assembler:** ACME `release 0.97 ("Zem"), 31 Jan 2021` (`acme --version`).
- **Broker:** run as a systemd user unit, never `setsid`/`nohup`, and stopped at
  the end of the session (see "Emulator shutdown" below).
- **Capture route:** `snapshot` — `vice_snapshot_save` followed by
  `vsf-slice.mjs slice`. One route serves every capture in this phase.
  `compare-cross-binary.mjs` refuses a mixed pair, so the route is recorded in
  both sidecars rather than left implicit.
- **Load route:** `route-d` — the text monitor's own `load` verb, per
  `evidence/LOAD-ROUTE.md`. No `.d64`, and no `vice_autostart` against a bare
  `.prg`.

## Capture procedure

### 1. Resolve the logical checkpoint from a real ACME symbol list

The checkpoint address is read from an ACME `--symbollist` run against the
committed root, not from any prior document.

```
[2026-09-15T18:53:00Z] $ cd src/mcp/vice/fixtures/hazard-subject
$ acme --cpu 6510 -f cbm -o $SCRATCH/hazard-subject-verify.prg \
       --symbollist $SCRATCH/hazard-subject.sym hazard-subject.a
(exit 0)

$ grep hazard_raster_entry $SCRATCH/hazard-subject.sym
	hazard_raster_entry	= $108f	; ?

$ grep -w entry $SCRATCH/hazard-subject.sym
	entry	= $80d	; ?
```

The symbol list describes the committed binary, proven rather than assumed —
the freshly assembled output is byte-identical to the committed `.prg`:

```
$ sha256sum $SCRATCH/hazard-subject-verify.prg hazard-subject.prg
89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828  …/hazard-subject-verify.prg
89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828  hazard-subject.prg
```

So `hazard_raster_entry` = **`$108F`** (4239) and `entry` = **`$080D`** (2061)
in this exact committed binary.

### 2. Start the broker as a systemd user unit

```
[2026-09-15T18:58:28Z] $ systemd-run --user --unit=vice-broker --collect \
    --working-directory=/home/henrik/dev/henrik/git/c64-re-tools \
    --setenv=VICE_BROKER_NODE=/home/henrik/.nvm/versions/node/v24.20.0/bin/node \
    --setenv=VICE_BIN=/usr/bin/x64sc \
    …/.c64-re-tools/bin/vice-launcher.sh
```

Two environment overrides were required, and both were refusals the shipped
code raised **by name** rather than failures anyone had to diagnose:

- `VICE_BROKER_NODE` — a systemd user unit's `PATH` resolves `/usr/bin/node`,
  which is v20.19.2. The launcher refused before exec:
  `vice-launcher: refusing to start -- resolved node interpreter /usr/bin/node
  reports v20.19.2, which is below the required floor v24.x. … or set
  VICE_BROKER_NODE to an absolute path to one that satisfies the floor.`
  This is the documented override for exactly this case.
- `VICE_BIN` — without it the broker resolved the shadowing fork build. The
  broker's own startup line names which binary it took, so the pinning is
  verifiable rather than assumed:

```
vice-broker: backend "stock" (binary: /usr/bin/x64sc)
```

The broker's own launch line, quoted from the unit journal, records the full
argv every instance below was launched with. `-default` precedes
`-binarymonitor`, as this project's own constraint requires:

```
sep 15 20:59:46 vice-broker: launching /usr/bin/x64sc -default -drive8type 1541 \
  -seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 \
  +autostart-delay-random -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6600 \
  -remotemonitor -remotemonitoraddress ip4://127.0.0.1:6601
```

**This argv is load-bearing for the calibration result in the next section and
is recorded here for that reason.** `-seed 4242 -raminitstartrandom 0
-raminitrepeatrandom 0 -raminitrandomchance 0` is a deterministic RAM-init
profile the broker applies to every instance it launches. It is not a neutral
default, and it is a partial cause of the byte-identity measured below.

### 3. Run one capture, end to end

```
[2026-09-15T18:59:45Z] $ node .planning/phases/50-equivalence-and-modifiability/evidence/capture-run.mjs \
    --label a --checkpoint-address 4239 --entry-address 2061
```

The checkpoint address is passed in as a number read from step 1's symbol list,
and the driver refuses to run without one.

**Why one process, and not one `vice_*` MCP tool call per step.** The broker's
release path is kill-never-recycle: `handleRelease()` (`vice-broker.mts`) calls
`verifiedKill()` and `deleteInstanceRecord()` on the granted instance, and the
connection *is* the lease. A process that acquires a lease, loads a program and
then exits therefore destroys the machine it just loaded into, so a split
"script loads, session captures" flow cannot work — the second acquire gets a
freshly booted machine with no program in it. The whole sequence must happen
inside one held lease, in one process. `capture-run.mjs` does not reimplement
any tool: it calls `dispatchStock()`, the project's own dispatch seam, with the
same deps shape `vice-proxy.ts`'s `dispatchStockFor()` builds, so every
operation runs through exactly the shipped handler the identically-named MCP
tool would have run.

Raw excerpts from that run, in the order they were produced:

**The route-d load.** Stock VICE's own text monitor reports the load, its
source address, its end address and its length:

```
[2026-09-15T18:59:49Z] CALL vice_program_load {"device":0}
{"command":"load \"…/src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg\" 0",
 "device":0,
 "response":"(C:$fd70) Loading '…/hazard-subject.prg' from 0801 to 10E7 (08E7 bytes)\n"}
```

`0801 to 10E7 (08E7 bytes)` is the committed fixture's own extent. No filename
was supplied by the caller. The path is baked into the verb's frozen identity in
`text-protocol.ts`.

**The checkpoint, armed at the resolved address:**

```
[2026-09-15T18:59:49Z] CALL vice_checkpoint_add {"start":"$108F","exec":true,"stop":true}
{"id":1,"start":4239,"end":4239,"stop":true,"enabled":true,
 "operation":{"value":4,"flags":["exec"],"defaulted":false},
 "temporary":false,"hitCount":0,"ignoreCount":0,"runState":"stopped"}
```

**Handing control to the machine-code entry point.** The text monitor's `load`
places the bytes but does not start the program, and it does not update BASIC's
end-of-program pointers, so `RUN` has nothing valid to run. The program counter
is set directly to `entry`, the second address step 1's symbol list resolved:

```
[2026-09-15T18:59:49Z] CALL vice_registers_set {"register":"PC","value":2061}
{"register":"PC","id":3,"requestedValue":2061,"observedValue":2061,
 "memspace":"main","runState":"stopped"}
```

**Resume, then the trap:**

```
[2026-09-15T18:59:49Z] CALL vice_execution_run {}
{"requested":"run","sent":true,"alreadyRunning":false,
 "stateBefore":"stopped","runState":"running"}

[2026-09-15T18:59:49Z] CALL vice_checkpoint_list {}
{"checkpoints":[{"id":1,"start":4239,"end":4239,"stop":true,"enabled":true,
 "hitCount":1,…}],"totalReported":1,"entriesReceived":1,"runState":"stopped"}
```

`hitCount` is 1. The machine stopped where it was told to, and the CPU registers
read in the same paused window confirm it independently — `PC` is 4239, which is
`$108F`:

```
[2026-09-15T18:59:49Z] CALL vice_registers_get {}
{"registers":{"PC":4239,"A":0,"X":234,"Y":0,"SP":251,"00":47,"01":55,
 "FL":7,"LIN":2,"CYC":9},"memspace":"main","runState":"stopped"}
```

**The capture, in that same paused window:**

```
[2026-09-15T18:59:49Z] CALL vice_snapshot_save {"name":"phase50-original-a",…}
{"name":"phase50-original-a",
 "path":"…/.c64-re-tools/snapshots/phase50-original-a.vsf",
 "includeRoms":false,"includeDisks":false,"metadataWritten":true,
 "runState":"stopped"}

[2026-09-15T18:59:49Z] CALL vice_memory_read {"address":"$0001","size":1}
{"address":1,"size":1,"encoding":"hex","hex":"37","runState":"stopped"}

[2026-09-15T18:59:49Z] CALL vice_memory_read {"address":"$DD00","size":1}
{"address":56576,"size":1,"encoding":"hex","hex":"3f","runState":"stopped"}

[2026-09-15T18:59:49Z] CALL vice_memory_read {"address":"$D018","size":1}
{"address":53272,"size":1,"encoding":"hex","hex":"15","runState":"stopped"}
```

`vice_vicii_get_state`, `vice_sprite_get` and `vice_registers_get` were read in
the same window. The VIC-II register block came back as

```
"base":53248,"end":53294,"length":47,
"registersHex":"64640000000000000000000000000000001b02000001c50015
                71f00000000000f2f0f0f0f0f0f0f0f0f0f0f0f0f0f0"
```

and those 47 bytes are what the sidecar's `registers` map carries, at their real
addresses, plus `$0001` and `$DD00`.

**Checkpoint deletion, proven by enumeration, not by the delete call's own
say-so:**

```
[2026-09-15T18:59:49Z] CALL vice_checkpoint_delete {"checkpoint_num":1}
{"checkpointNum":1,"deleted":true,"runState":"stopped"}

[2026-09-15T18:59:49Z] CALL vice_checkpoint_list {}
{"checkpoints":[],"totalReported":0,"entriesReceived":0,"runState":"stopped"}
```

**The checkpoint-list count observed after deletion is `0`** —
`totalReported: 0`, `entriesReceived: 0`, an empty `checkpoints` array. The
machine was then resumed exactly once.

### 4. Slice the snapshot into the flat 64K image

```
[2026-09-15T19:00:04Z] $ node src/skills/c64-ram-capture/scripts/vsf-slice.mjs \
    slice .c64-re-tools/snapshots/phase50-original-a.vsf \
    --out …/evidence/captures/original-a.bin --json
{"imageBytes":65536,
 "sha256":"0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5",
 "snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
```

### 5. Independent evidence that the program loaded and ran

Byte-identity between the captured image and the `.prg` would not have proven
the program *ran*. The measured result is better than identity: the image
matches the `.prg` body everywhere except at `$825`, and `$825` is
`smc_patch_target` / `hazard_smc_entry` in the same symbol list — the fixture's
planted self-modifying construction, which by the checkpoint has already
modified itself.

```
[2026-09-15T19:00:20Z] prg load address: $0801
prg body bytes: 2279 = $8E7
image slice equals prg body: false
first differing offset: $825
bytes at $108F (checkpoint): 78 a9 b2 8d 14 03
```

The six bytes at the checkpoint are `SEI` / `LDA #$B2` / `STA $0314`, and `$B2`
is the low byte of `hazard_raster_irq` = `$10B2`. Those bytes had *not* yet
executed when the capture was taken, which is exactly the property the
checkpoint was chosen for: the self-modifying, dispatch and alignment
constructions have all run, and the raster construction has not yet installed
its interrupt vector, so nothing is running under interrupt at the sample point.

### 6. Build the chip-state sidecar

```
[2026-09-15T19:01:15Z] $ node …/evidence/make-sidecar.mjs \
    --bundle …/captures/run-a.bundle.json \
    --image …/captures/original-a.bin \
    --out …/captures/original-a.state.json
wrote …/captures/original-a.state.json
  route=snapshot checkpoint=hazard_raster_entry @ $108F
  registers=49 image_sha256=0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
  checkpoints after delete = 0
```

**One reconciliation is recorded here rather than left silent.** Two committed
contracts name a key called `registers` and do not agree on its shape:
`c64-ram-capture/SKILL.md`'s `raw.json` step passes the decoded
`vice_vicii_get_state` document through under that name, while
`compare-cross-binary.mjs`'s `normalizeRegisters()` reads it as an
address → value map and refuses the whole sidecar by name when a key does not
parse as an address. The consumer's contract wins, because it is the one that
actually executes. Every field `raw.json` names is preserved unchanged under an
explicitly named sibling key (`vicii_raw`, `sprites`, `cpu`, `port01_raw`,
`dd00_raw`, `d018_raw`, `sprite_pointers`). Nothing is dropped.

## Mask calibration: two runs of the same binary

Run B repeats the procedure above without change, on the same committed binary,
from a fresh emulator start. The prior instance was already gone — the broker
kills a released instance — so run B's `x64sc` is a new process, launched at
`21:01:30` against run A's `20:59:46`, each with its own `XDG_CONFIG_HOME`
scratch directory.

```
[2026-09-15T19:01:29Z] $ node …/evidence/capture-run.mjs \
    --label b --checkpoint-address 4239 --entry-address 2061
```

Run B reproduced run A's observable facts exactly: the same load extent
(`from 0801 to 10E7 (08E7 bytes)`), the same checkpoint (`id 1`, `start 4239`,
`hitCount 1`), the same stopped `PC` of 4239, the same `$0001`/`$DD00`/`$D018`
bytes (`37` / `3f` / `15`), the same VIC-II `registersHex`, and the same
post-deletion checkpoint count of `0`.

### The comparison, run in full with no row limit

```
[2026-09-15T19:01:58Z] $ node src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs cross \
    …/captures/original-a.bin …/captures/original-b.bin \
    --state …/captures/original-a.state.json …/captures/original-b.state.json \
    --checkpoint hazard_raster_entry --limit 0

A  original-a.bin  sha256 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
B  original-b.bin  sha256 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
MASK_NARROWED_AT: compare-cross-binary-mask-v1
A  checkpoint hazard_raster_entry @ $108F
B  checkpoint hazard_raster_entry @ $108F

BYTE_IDENTICAL: yes
  (a recorded extra -- the VERDICT line below is the acceptance signal, not this one)

volatile (excluded from the verdict): 0

allowlisted (intentional difference, excluded from the verdict): 0

DIVERGENCE — fails the comparison: 0

total differing addresses (image + register): 0

VERDICT: PASS
```

### The complete difference set

**There were none.** Not one of the 65536 image addresses differed, and not one
of the 49 register addresses the two sidecars both carry differed. All three
buckets — volatile, allowlisted, divergence — are empty, and the two images have
the same SHA-256.

There is therefore **no unmasked difference to resolve**. Neither of the two
permitted resolution routes was taken, because neither had anything to act on:

- **ROUTE 1 (narrow the mask, with a hardware reason): not taken. Zero
  entries.** No mask span in `IMAGE_VOLATILE` or `IO_VOLATILE` was changed,
  added or deleted by this task. `MASK_NARROWED_AT` still reads
  `compare-cross-binary-mask-v1`, the version plan 50-01 committed.
- **ROUTE 2 (name an unexplained residual): not taken. Zero entries.** No
  address or register differed, so there is no residual to name.

### What this result does and does not mean

Recorded plainly, without dressing up:

- Run-to-run variation at `hazard_raster_entry` is **below this instrument's
  resolution**. Two independent runs of the same binary, on two separate
  emulator processes, produced the same 65536 bytes and the same 49 register
  values.
- **The instrument is therefore not yet confirmed against real variation.** A
  comparison that finds nothing cannot distinguish "there was nothing to find"
  from "the instrument cannot see". The red control in plan 50-05 is what
  settles that, and until it runs, this PASS is evidence that the pipeline is
  reproducible, not evidence that it is sensitive.
- The byte-identity is **partly manufactured by the rig, and that is stated
  rather than glossed**: every instance is launched with `-seed 4242
  -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0`, a
  deterministic RAM-init profile (see the argv in "Capture procedure" step 2).
  A run pair launched without those flags could reasonably differ in uninitialised
  RAM. The determinism is a property of how this project launches VICE, not a
  discovered property of the C64.
- The checkpoint was chosen so that nothing runs under interrupt at the sample
  point, and section 5's disassembled bytes confirm the raster construction had
  not yet installed its vector. That is the structural reason this checkpoint is
  reproducible, and it is measured here rather than asserted.

### The mask is closed from this point on

This calibration is **the last point in Phase 50 at which the volatile mask may
be touched.** It was permitted here, and only here, because no binary other than
the subject itself had been captured yet — nothing could be tuned to make a
rebuild pass, because no rebuild existed.

From this point on, a difference is resolved by **naming it in the allowlist
with why it is intentional**, and never by widening the mask. The mask must
never be widened after seeing a rebuild's differences. As it happens this task
narrowed nothing either, so the mask that every later comparison in this phase
runs under is exactly the one plan 50-01 committed, unchanged:
`compare-cross-binary-mask-v1`.

## Emulator shutdown

The broker was stopped in the same session as the last emulator call, and the
shutdown was verified rather than assumed — a live broker deterministically
reddens `vice-proxy.test.ts`'s BACK-05 case, so a test run taken with one still
up would be worthless.

```
[2026-09-15T19:02:15Z] $ systemctl --user stop vice-broker.service
$ systemctl --user is-active vice-broker.service
inactive
$ ps -eo pid,etime,cmd | grep -Ei 'vice-broker|x64sc' | grep -v grep
(no output)
$ ss -ltnp | grep -E ':66[0-9][0-9]'
(no output)
$ ss -ltnp | grep -E ':19510'
(no output)
```

## Red control: a planted regression is caught

The calibration above ended with the instrument unconfirmed. Two runs of the
same binary produced the same 65536 bytes and the same 49 register values, and
a comparison that finds nothing cannot distinguish "there was nothing to find"
from "the instrument cannot see". This section is the run that settles it.

The subject here is `hazard-subject-regressed.prg`, the deliberately regressed
twin built in plan 50-02. It differs from the committed subject at exactly
three bytes, each one a single bit, and each one an immediate operand feeding
a VIC-II register: `$D020`, `$D015` and `$D018`. Under the rules
`compare.mjs` carries, all three would have passed twice over — once under a
blanket `$D000-$DFFF` volatile exclusion, and again under a one-bit drift
tolerance. Under the narrowed mask this phase committed first, all three must
fail, and each must be named.

**The expected outcome of this section is a FAILURE.** A PASS here would be a
finding about the instrument, not a success.

### 1. The checkpoint, re-resolved for THIS binary

The address was not carried over from the calibration above. The regressed twin
has no committed root source of its own — `make-hazard-subject-fixtures.mjs`
synthesizes one by swapping two `!source` lines in `hazard-subject.a` for their
regressed siblings — so the same synthesis was performed, assembled, and read:

```
[2026-09-15T19:27:16Z] $ acme --cpu 6510 -f cbm -o $SCRATCH/r2.prg \
       --symbollist $SCRATCH/r2.sym $SCRATCH/synthesized-regressed-root.a
(exit 0)

$ grep -E 'hazard_raster_entry|^[[:space:]]*entry[[:space:]]' $SCRATCH/r2.sym
	entry	= $80d	; ?
	hazard_raster_entry	= $108f	; ?
```

The symbol list describes the committed binary, proven rather than assumed:

```
$ sha256sum $SCRATCH/r2.prg hazard-subject-regressed.prg
fd6484f1101ef0773c0137d479e6b630c247169445ddb01b149072bd8df21427  …/r2.prg
fd6484f1101ef0773c0137d479e6b630c247169445ddb01b149072bd8df21427  hazard-subject-regressed.prg
```

So `hazard_raster_entry` = **`$108F`** (4239) and `entry` = **`$080D`** (2061)
in this binary. That is the same pair the committed subject resolves to, which
is what a three-operand-byte change with no length change should produce — but
it was **read from this binary's own symbol list**, not transcribed from the
section above. The per-binary resolution is the mechanism that keeps a later,
differently-laid-out binary honest, and leaving it unexercised here would have
left it unexercised everywhere.

### 2. One change to the procedure, and what did not change

The capture repeats the procedure in "Capture procedure" above. Exactly one
thing about it differs, and it is recorded here rather than left for a reader
to notice: **which committed subject is loaded.**

Plan 50-04 baked one fixture path into the `load` verb's own frozen identity in
`text-protocol.ts`, and that entry resolves only to `hazard-subject.prg`. It
could not reach the regressed twin. The frozen path was therefore generalised
into a **closed id → path table** (`HAZARD_SUBJECT_PRG_BASENAMES`), with one
frozen `load "<path>"` verb derived per member, and `vice_program_load` gained
an **enumerated `subject` id**. What did not change is the property the
original widening rested on: every loadable path is still a reviewed literal
chosen by `text-protocol.ts`, a caller still supplies no path, no basename and
no fragment of one, the only caller-supplied *value* is still the bounded
device number, no parameter kind accepts a string domain, and `save` — the
write direction — is refused exactly as before. The subject id is checked for
exact membership and used only as a lookup key; it is never concatenated into a
command and never reaches the socket. A committed fixture the table does not
name (`hazard-subject-misaligned.prg`, sitting in the same directory) is not
dialable, and a committed test asserts that, so the boundary is the reviewed
table rather than the directory.

Every emulator step is unchanged and in the same order, through the same
`dispatchStock()` seam: the ping retry, the route-d load, the checkpoint, the
`PC` set, the resume, the poll, the capture, the deletion, the enumeration and
the single final resume. Same route (`snapshot`), same logical checkpoint, same
driver, same genuine unpatched stock `/usr/bin/x64sc`, same broker argv.

### 3. The capture

```
[2026-09-15T19:24:51Z] $ node …/evidence/capture-run.mjs \
    --label regressed --subject-id regressed --snapshot-name phase50-regressed \
    --checkpoint-address 4239 --entry-address 2061
```

The route-d load, naming the file stock VICE itself reports it loaded:

```
[2026-09-15T19:24:54Z] CALL vice_program_load {"device":0,"subject":"regressed"}
{"command":"load \"…/fixtures/hazard-subject/hazard-subject-regressed.prg\" 0",
 "device":0,"subject":"regressed",
 "response":"(C:$fd70) Loading '…/hazard-subject-regressed.prg' from 0801 to 10E7 (08E7 bytes)\n"}
```

`0801 to 10E7 (08E7 bytes)` is the same extent the committed subject loads to,
which is the expected consequence of a three-operand-byte change that resizes
nothing.

The checkpoint trapped, and the CPU registers read in the same paused window
confirm it independently — `PC` is 4239, which is `$108F`:

```
[2026-09-15T19:24:54Z] CALL vice_checkpoint_list {}
{"checkpoints":[{"id":1,"start":4239,"end":4239,"stop":true,"enabled":true,
 "hitCount":1,…}],"totalReported":1,"entriesReceived":1,"runState":"stopped"}

[2026-09-15T19:24:54Z] CALL vice_registers_get {}
{"registers":{"PC":4239,"A":0,"X":234,"Y":0,"SP":251,"00":47,"01":55,
 "FL":7,"LIN":2,"CYC":9},"memspace":"main","runState":"stopped"}
```

All three regressions were already visible in the chip state read in that same
paused window, before any comparison was run — the VIC-II register block came
back as

```
"base":53248,"end":53294,"length":47,
"registersHex":"64640000000000000000000000000000001b02000000c50017
                71f00000000000f3f0f0f0f0f0f0f0f0f0f0f0f0f0f0"
```

against the committed subject's `…0001c5001571f0…f2f0…`, and the direct
one-byte read of `$D018` returned `17` where the original returned `15`.

**Checkpoint deletion, proven by enumeration:**

```
[2026-09-15T19:24:54Z] CALL vice_checkpoint_delete {"checkpoint_num":1}
{"checkpointNum":1,"deleted":true,"runState":"stopped"}

[2026-09-15T19:24:54Z] CALL vice_checkpoint_list {}
{"checkpoints":[],"totalReported":0,"entriesReceived":0,"runState":"stopped"}
```

**The checkpoint-list count observed after deletion is `0`.** The machine was
then resumed exactly once.

The snapshot was sliced into the flat 64K image by the same tool:

```
[2026-09-15T19:24:54Z] $ node src/skills/c64-ram-capture/scripts/vsf-slice.mjs \
    slice .c64-re-tools/snapshots/phase50-regressed.vsf \
    --out …/evidence/captures/regressed.bin --json
{"imageBytes":65536,
 "sha256":"d18830159c1c385901c7c97280fc91adb1dbfad167ee44ce0186bd0c663b2b97",
 "snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
```

### 4. What was compared

| | subject `.prg` | subject sha256 | capture | capture sha256 | checkpoint |
|---|---|---|---|---|---|
| A | `hazard-subject.prg` | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` | `original-a.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | `hazard_raster_entry` @ `$108F` |
| B | `hazard-subject-regressed.prg` | `fd6484f1101ef0773c0137d479e6b630c247169445ddb01b149072bd8df21427` | `regressed.bin` | `d18830159c1c385901c7c97280fc91adb1dbfad167ee44ce0186bd0c663b2b97` | `hazard_raster_entry` @ `$108F` |

Both sidecars declare `route: snapshot`. The comparison module refuses a mixed
pair, so the route agreement is enforced rather than merely intended.

### 5. The comparison, run in full with no row limit and no allowlist

```
[2026-09-15T19:26:55Z] $ node src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs cross \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.bin \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/regressed.bin \
    --state .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.state.json \
            .planning/phases/50-equivalence-and-modifiability/evidence/captures/regressed.state.json \
    --checkpoint hazard_raster_entry --limit 0

A  original-a.bin  sha256 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
B  regressed.bin  sha256 d18830159c1c385901c7c97280fc91adb1dbfad167ee44ce0186bd0c663b2b97
MASK_NARROWED_AT: compare-cross-binary-mask-v1
A  checkpoint hazard_raster_entry @ $108F
B  checkpoint hazard_raster_entry @ $108F

BYTE_IDENTICAL: no
  (a recorded extra -- the VERDICT line below is the acceptance signal, not this one)

volatile (excluded from the verdict): 0

allowlisted (intentional difference, excluded from the verdict): 0

DIVERGENCE — fails the comparison: 6
  $0854  $02 %00000010  ->  $03 %00000011   [image]
  $0880  $14 %00010100  ->  $16 %00010110   [image]
  $088F  $01 %00000001  ->  $00 %00000000   [image]
  $D015  $01 %00000001  ->  $00 %00000000   [register]
  $D018  $15 %00010101  ->  $17 %00010111   [register]
  $D020  $F2 %11110010  ->  $F3 %11110011   [register]

total differing addresses (image + register): 6

VERDICT: FAIL
```

The exit status, quoted from the shell that ran it:

```
exit status: 1
```

**The mask version string the run printed is `compare-cross-binary-mask-v1`.**
Nothing about the mask, the flags or the invocation was adjusted to reach this
result. The first run of this command produced this output, and it is the
output recorded here.

### 6. The three planted regressions, each named

The divergence list above is the complete difference set — all six entries, at
`--limit 0`, with nothing elided. It is six rows and not three because each
planted regression is visible **twice**: once as the changed immediate operand
byte sitting in the captured RAM image, and once as the value that operand
actually put into the chip. Both are reported, and both fall in the same
bucket.

Which store each operand feeds was decoded from the captured image itself
rather than read off the source, so the pairing below is derived evidence:
each differing offset is preceded by opcode `$A9` (`LDA #imm`) and immediately
followed by `$8D` (`STA abs`) naming the register.

| Register | Original | Regressed | Bit | Bucket | Operand byte in the image | Its store |
|---|---|---|---|---|---|---|
| **`$D020`** (border colour) | `$F2` `%11110010` | `$F3` `%11110011` | bit 0 | **DIVERGENCE** | `$0854`: `$02` → `$03` | `STA $D020` at `$0855` |
| **`$D015`** (sprite enable) | `$01` `%00000001` | `$00` `%00000000` | bit 0 | **DIVERGENCE** | `$088F`: `$01` → `$00` | `STA $D015` at `$0890` |
| **`$D018`** (VIC memory control) | `$15` `%00010101` | `$17` `%00010111` | bit 1 | **DIVERGENCE** | `$0880`: `$14` → `$16` | `STA $D018` at `$0881` |

Three named registers, three distinct DIVERGENCE rows. **The comparison did not
catch one regression and inherit the verdict for the other two** — that was the
specific failure this section had to rule out, and the per-address rows above
are what rule it out.

One detail is recorded rather than smoothed over, because it would otherwise
read as an inconsistency. The `$D018` operand byte is `$14`/`$16` while the
register reads back `$15`/`$17`: bit 0 of `$D018` is unused on the VIC-II and
reads as 1 regardless of what was written. The one planted bit is bit 1 in both
views, and the `%` columns above show it in both.

The upper nibble of `$D020` reads as `$F` for the same class of reason — the
VIC-II colour registers decode only four bits and the high nibble reads as open
bus. The planted bit is bit 0, again visible in both views.

### 7. No allowlist, and the same mask as every later run

Stated explicitly, because the later green result depends on it:

- **No allowlist was used for this run.** The command carries no `--allowlist`
  flag, and the run's own `allowlisted` bucket reports `0`. Nothing was excused.
- **The mask used is `compare-cross-binary-mask-v1`**, the version plan 50-01
  committed and plan 50-04's calibration left unchanged. It is the same mask
  every later comparison in this phase runs under. No mask span was changed,
  added or deleted by this plan, and the unit tests that pin the mask's edges
  are green.
- There is therefore **no flag, mask or allowlist difference** between this red
  result and the green result a later plan will produce. That sameness is the
  whole reason the two are comparable.

Neither of the two permitted resolution routes was taken, because neither had
anything to act on. **ROUTE 1 (narrow the mask): not taken. Zero entries.**
**ROUTE 2 (name an unexplained residual): not taken. Zero entries** — every one
of the six differences is accounted for by a deliberately planted regression,
and none is unexplained.

### 8. Emulator shutdown for this run

Stopped in the same session as the last emulator call, and verified rather than
assumed:

The stop time below is taken from the unit's own journal
(`journalctl --user -u vice-broker.service -o short-iso` →
`2026-09-15T21:25:24+02:00 … Stopped vice-broker.service`), not clocked at the
shell, because the shell that ran the stop did not print one. It is recorded
that way rather than rounded to a plausible value.

```
[2026-09-15T19:25:24Z] $ systemctl --user stop vice-broker.service
$ systemctl --user is-active vice-broker.service
inactive
$ ps -eo pid,etime,cmd | grep -Ei 'vice-broker|x64sc' | grep -v grep
(no output)
$ ss -ltnp | grep -E ':66[0-9][0-9]'
(no output)
$ ss -ltnp | grep -E ':19510'
(no output)
```

### 9. What this section does and does not establish

Recorded plainly, without overclaiming:

- **It establishes that the instrument is not blind.** Three single-bit
  regressions at `$D020`, `$D015` and `$D018`, at this checkpoint, under
  `compare-cross-binary-mask-v1`, with no allowlist, each produced its own named
  DIVERGENCE row and together produced `VERDICT: FAIL` with exit status 1. The
  narrowed mask does not hide them, and the one-bit drift tolerance that would
  have excused them is genuinely gone for cross-binary comparisons.
- **It does not establish that the probe set is exhaustive.** Nothing in the
  ROADMAP or the research shows that `$D020`, `$D015` and `$D018` are a
  sufficient regression probe set for this subject (flagged assumption P1). This
  run proves the instrument catches these three. It says nothing about a fourth
  kind of regression nobody planted.
- **It does not establish that the mask's edges are correct in general**
  (flagged assumption P2). Plan 50-04's calibration was a measurement against a
  same-binary re-run, not an exhaustive proof, and this section does not upgrade
  it. What it adds is one-sided: the mask is now shown not to be too *wide* at
  these three registers.
- **It establishes nothing whatsoever about a rebuild.** No rebuild has been
  produced or captured at the time this section was committed, and no green
  comparison exists anywhere in this transcript yet. That ordering is deliberate
  and is a fact in git history rather than a claim in prose: this red section is
  committed in wave 3, before the green section exists.
- One thing this run inherits from the calibration above and does not re-prove:
  the byte-identity of the two original runs was partly manufactured by the rig
  (`-seed 4242 -raminitstartrandom 0 …`). That determinism is what makes a
  six-difference result readable as *these six and nothing else*. On a run pair
  launched without those flags, uninitialised RAM could reasonably add
  differences that have nothing to do with a planted regression.

## Green: the rebuild behaves like the original

The red control above established that this instrument is not blind. This
section is the run it was the control *for*: the committed subject against a
**rebuild produced from the committed annotation store**, at the same logical
checkpoint, under the same mask, with the same command shape and no allowlist.

The rebuild's provenance is recorded separately, in
`.planning/phases/50-equivalence-and-modifiability/evidence/REBUILD.md`: the
committed store document was imported into a fresh throwaway store through
`importStoreDocument()`, exported with `exportAsmTree()`, and assembled through
`verifyAcmeAssemblesTree()` — `acme-verify.ts`'s one real-assembler entry
point, which is also its byte-diff oracle. It returned `outcome: "ok"`.
Nothing was copied.

### 1. The checkpoint, re-resolved for THIS binary

The address was not carried over from any section above. The rebuild's own
exported tree was assembled with a symbol list, and the freshly assembled
output is byte-identical to the `.prg` that was actually loaded:

The timestamp below is derived from the two output files' own mtimes
(`stat -c %y` on `rb.prg` and `rb.sym`, both `2026-09-15 21:49:35 +0200`),
because the shell that ran the assembler printed none. It is recorded that way
rather than rounded to a plausible value.

```
[2026-09-15T19:49:35Z] $ cd <the rebuild's exported tree>
$ acme --cpu 6510 -f cbm -o $SCRATCH/rb.prg --symbollist $SCRATCH/rb.sym root.a
(exit 0)

$ grep -E 'hazard_raster_entry|^[[:space:]]*entry[[:space:]]' $SCRATCH/rb.sym
	entry	= $80d	; unused
	hazard_raster_entry	= $108f

$ sha256sum $SCRATCH/rb.prg .../evidence/hazard-subject-rebuild.prg
89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828  …/rb.prg
89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828  …/hazard-subject-rebuild.prg
```

So `hazard_raster_entry` = **`$108F`** (4239) and `entry` = **`$080D`** (2061)
**in this binary**, read from this binary's own symbol list.

That same run carries one extra confirmation worth recording. `REBUILD.md`
states that the rebuild `.prg`'s two-byte load-address header was *derived*
(from the export's own lowest block start) rather than copied, because the
oracle assembles with `-f plain` and emits no header. This `-f cbm` run emits
the header ACME itself would write, and its output is byte-identical to the
`.prg` with the derived header — so the derivation is confirmed against the
assembler rather than merely reasoned about.

### 2. What changed about the procedure, and what did not

**Which subject is loaded, and nothing else.** The rebuild `.prg` is a build
artifact under the phase evidence directory rather than a committed fixture, so
plan 50-05's closed `id → basename` table — which joined one fixed fixture
directory onto every row — could not spell its path. The rows now carry the
whole repo-relative path as reviewed segments
(`HAZARD_SUBJECT_PRG_RELPATHS`), and the basename table is derived from them.

What did not change is exactly what plan 50-05's own note said must not: every
loadable path is still a reviewed literal chosen by `text-protocol.ts`; a
caller supplies no path, basename, directory or fragment of one; the `subject`
id is still exact-membership-checked and used only as a lookup key, never
concatenated into a command and never on the socket; `TextCommandParamKind` is
still `count | address`, so both no-string-kind tests pass **unmodified**; the
write-direction `save` refusal test passes **unmodified**; and
`hazard-subject-misaligned.prg`, a committed fixture in the same directory as
three of the four rows, is still **not dialable**, so the boundary is the
reviewed table rather than a directory. New assertions pin that no row segment
may be empty, `.`, `..`, or carry a separator.

Every emulator step is unchanged and in the same order, through the same
`dispatchStock()` seam: the ping retry, the route-d load, the checkpoint, the
`PC` set, the resume, the poll, the capture, the deletion, the enumeration and
the single final resume. Same route (`snapshot`), same logical checkpoint, same
driver, same genuine unpatched stock `/usr/bin/x64sc`, same broker argv.

The broker for this run was started at `[2026-09-15T19:50:10Z]` as a systemd
user unit with the same two overrides, and named its own binary:

```
vice-broker: backend "stock" (binary: /usr/bin/x64sc)
```

### 3. The capture

```
[2026-09-15T19:50:27Z] $ node …/evidence/capture-run.mjs \
    --label rebuild --subject-id rebuild --snapshot-name phase50-rebuild \
    --checkpoint-address 4239 --entry-address 2061
```

The route-d load, naming the file stock VICE itself reports it loaded — and it
is the rebuild under the phase evidence directory, not the committed fixture:

```
[2026-09-15T19:50:29Z] CALL vice_program_load {"device":0,"subject":"rebuild"}
{"command":"load \"…/.planning/phases/50-equivalence-and-modifiability/evidence/hazard-subject-rebuild.prg\" 0",
 "device":0,"subject":"rebuild",
 "response":"(C:$fd70) Loading '…/hazard-subject-rebuild.prg' from 0801 to 10E7 (08E7 bytes)\n"}
```

The checkpoint trapped, and the CPU registers read in the same paused window
confirm it independently — `PC` is 4239, which is `$108F`:

```
[2026-09-15T19:50:30Z] CALL vice_checkpoint_list {}
{"checkpoints":[{"id":1,"start":4239,"end":4239,"stop":true,"enabled":true,
 "hitCount":1,…}],"totalReported":1,"entriesReceived":1,"runState":"stopped"}

[2026-09-15T19:50:30Z] CALL vice_registers_get {}
{"registers":{"PC":4239,"A":0,"X":234,"Y":0,"SP":251,"00":47,"01":55,
 "FL":7,"LIN":2,"CYC":9},"memspace":"main","runState":"stopped"}
```

The VIC-II register block read in that same paused window:

```
"base":53248,"end":53294,"length":47,
"registersHex":"64640000000000000000000000000000001b02000001c50015
                71f00000000000f2f0f0f0f0f0f0f0f0f0f0f0f0f0f0"
```

**Checkpoint deletion, proven by enumeration:**

```
[2026-09-15T19:50:30Z] CALL vice_checkpoint_delete {"checkpoint_num":1}
{"checkpointNum":1,"deleted":true,"runState":"stopped"}

[2026-09-15T19:50:30Z] CALL vice_checkpoint_list {}
{"checkpoints":[],"totalReported":0,"entriesReceived":0,"runState":"stopped"}
```

**The checkpoint-list count observed after deletion is `0`.** The machine was
then resumed exactly once.

The snapshot was sliced into the flat 64K image by the same tool:

```
[2026-09-15T19:50:43Z] $ node src/skills/c64-ram-capture/scripts/vsf-slice.mjs \
    slice .c64-re-tools/snapshots/phase50-rebuild.vsf \
    --out …/evidence/captures/rebuild.bin --json
{"imageBytes":65536,
 "sha256":"0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5",
 "snapshotMinor":1,"bodyLength":65555,"dataOut":39,"dataRead":55,"dirRead":47}
```

```
[2026-09-15T19:50:43Z] $ node …/evidence/make-sidecar.mjs \
    --bundle …/captures/run-rebuild.bundle.json \
    --image …/captures/rebuild.bin \
    --out …/captures/rebuild.state.json
wrote …/captures/rebuild.state.json
  route=snapshot checkpoint=hazard_raster_entry @ $108F
  registers=49 image_sha256=0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
  checkpoints after delete = 0
```

### 4. What was compared

| | subject `.prg` | subject sha256 | capture | capture sha256 | checkpoint |
|---|---|---|---|---|---|
| A | `hazard-subject.prg` | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` | `original-a.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | `hazard_raster_entry` @ `$108F` |
| B | `evidence/hazard-subject-rebuild.prg` | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` | `rebuild.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | `hazard_raster_entry` @ `$108F` |

Both sidecars declare `route: snapshot`. The comparison module refuses a mixed
pair, so the route agreement is enforced rather than merely intended.

### 5. The comparison, run in full with no row limit and no allowlist

```
[2026-09-15T19:51:28Z] $ node src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs cross \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.bin \
    .planning/phases/50-equivalence-and-modifiability/evidence/captures/rebuild.bin \
    --state .planning/phases/50-equivalence-and-modifiability/evidence/captures/original-a.state.json \
            .planning/phases/50-equivalence-and-modifiability/evidence/captures/rebuild.state.json \
    --checkpoint hazard_raster_entry --limit 0

A  original-a.bin  sha256 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
B  rebuild.bin  sha256 0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5
MASK_NARROWED_AT: compare-cross-binary-mask-v1
A  checkpoint hazard_raster_entry @ $108F
B  checkpoint hazard_raster_entry @ $108F

BYTE_IDENTICAL: yes
  (a recorded extra -- the VERDICT line below is the acceptance signal, not this one)

volatile (excluded from the verdict): 0

allowlisted (intentional difference, excluded from the verdict): 0

DIVERGENCE — fails the comparison: 0

total differing addresses (image + register): 0

VERDICT: PASS
```

The exit status, quoted from the shell that ran it:

```
exit status: 0
```

**The mask version string the run printed is `compare-cross-binary-mask-v1`**,
the same string the red control above printed.

### 6. The complete difference set

**The run reported no difference in any bucket.** Volatile `0`, allowlisted
`0`, DIVERGENCE `0`, total differing addresses `0`. There is therefore nothing
to list, and nothing was absorbed: the complete difference set is empty.

Stated plainly, which is what ROADMAP criterion 3 asks for: **the two images
and their sidecars agree completely at this checkpoint.** Not one of the 65536
image addresses differed. Not one of the 49 register addresses both sidecars
carry differed. The two captures have the same SHA-256.

### 7. Same mask, same command shape, no flag differed

Stated explicitly, because the green result is only evidence in relation to the
red one above:

- **The mask is the same.** Both runs printed
  `MASK_NARROWED_AT: compare-cross-binary-mask-v1`. No mask span in
  `IMAGE_VOLATILE` or `IO_VOLATILE` was changed, added or deleted by this plan,
  and the unit tests that pin the mask's edges are green.
- **No allowlist was used, in either run.** Neither command line carries
  `--allowlist`, and both runs' own `allowlisted` bucket reports `0`.
- **The command shape is the same.** Both are
  `compare-cross-binary.mjs cross <a.bin> <b.bin> --state <a.state.json>
  <b.state.json> --checkpoint hazard_raster_entry --limit 0`. Only the second
  image path and its sidecar differ between them. **No flag differed between
  the red run and this one.**

### 8. Emulator shutdown for this run

The same broker session served both this capture and the modifiability capture
in `docs/phase50-modifiability-transcript.md`, and was stopped in the same
session as the last emulator call. The stop time is taken from the unit's own
journal (`journalctl --user -u vice-broker.service -o short-iso` →
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

### 9. What this section does and does not establish

Recorded plainly, without overclaiming:

- **It establishes behavioural equivalence between the original and the
  rebuild at this checkpoint, on genuine unpatched stock VICE, with this
  document as the artifact of record.** The rebuild was produced from the
  committed annotation store through the export-and-assemble path, loaded into
  a real emulator, stopped at its own re-resolved logical checkpoint, and
  compared against the original under the mask this phase committed before any
  rebuild existed. The verdict is PASS with an empty difference set.
- **It is evidence only because the red control was committed first**, by the
  same mechanism, under the same mask, with no flag difference. A green-only
  result would not be evidence, and this transcript carries the red section
  above this one in the file and earlier in git history.
- **It does not add anything the red control already carries about
  sensitivity.** The rebuild is byte-identical to the committed subject (see
  `REBUILD.md`'s own subordinate `## Optional extra: byte-identity` section),
  so at the byte level this run compared two runs of the same program. That is
  worth stating rather than hiding: this section proves the rebuild path
  produced something that behaves identically, and it is the red control — not
  this section — that proves the instrument would have seen it if it had not.
- **It does not establish that the mask's edges are correct in general**
  (flagged assumption P2), and it does not upgrade plan 50-04's calibration.
- **It does not establish that the probe set is exhaustive** (flagged
  assumption P1). Nothing here speaks to a kind of difference nobody planted.
- One property it inherits and does not re-prove: the run-to-run determinism is
  partly manufactured by the rig (`-seed 4242 -raminitstartrandom 0 …`), which
  is what makes an empty difference set readable as *empty* rather than as
  *below the noise floor*.

## Artifacts this transcript is the record for

| Artifact | SHA-256 | Size |
|---|---|---|
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` | 2281 bytes |
| `evidence/captures/original-a.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | 65536 bytes |
| `evidence/captures/original-b.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | 65536 bytes |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject-regressed.prg` | `fd6484f1101ef0773c0137d479e6b630c247169445ddb01b149072bd8df21427` | 2281 bytes |
| `evidence/captures/regressed.bin` | `d18830159c1c385901c7c97280fc91adb1dbfad167ee44ce0186bd0c663b2b97` | 65536 bytes |
| `evidence/hazard-subject-rebuild.prg` | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` | 2281 bytes |
| `evidence/captures/rebuild.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | 65536 bytes |

All four sidecars declare `route: snapshot`, `checkpoint_name:
hazard_raster_entry` and `checkpoint_address: 4239` — the two original
captures, `regressed.state.json` since plan 50-05's red control, and
`rebuild.state.json` since plan 50-06's green comparison. Each non-original
address was re-resolved from its own binary's own symbol list rather than
copied.
