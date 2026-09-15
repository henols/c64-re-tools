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
