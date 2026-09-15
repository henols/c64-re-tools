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

## Artifacts this transcript is the record for

| Artifact | SHA-256 | Size |
|---|---|---|
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` | 2281 bytes |
| `evidence/captures/original-a.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | 65536 bytes |
| `evidence/captures/original-b.bin` | `0e3f47d64732a67b0a01a6d59aed8de4f62fe19b0edfdc00f7543ddd7e2dc2f5` | 65536 bytes |

Both sidecars declare `route: snapshot`, `checkpoint_name: hazard_raster_entry`
and `checkpoint_address: 4239`.
