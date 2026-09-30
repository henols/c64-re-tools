---
name: c64-ram-capture
description: Capture a running C64's full 64K RAM as a verified flat image, and prove that two captures are equivalent. Also record whether a game loads more data while it plays. Use when asked to dump RAM, or to capture a memory image at a checkpoint. Use when asked to compare two captures, or to compare an original and a rebuilt binary. Use when asked to derive a transient allow-list or to slice a VICE snapshot into a flat image. Use when asked to detect on-demand loads.
---

# Capturing and comparing C64 RAM

**Never assemble a capture by hand.** Sixteen `vice_memory_read` calls must
land in sequence and give exactly 65536 bytes. A missing or short read is the
usual failure, and a hex dump does not show it. The scripts below do the byte
work. When the bytes are wrong, they name the address.

```bash
S=skills/c64-ram-capture/scripts    # from the repo root
A=$S/dump-artifacts.ts
C=$S/compare.ts
CX=$S/compare-cross-binary.ts
T=$S/derive-transients.ts           V=$S/vsf-slice.ts
W=$S/watch-loads.ts
L=skills/c64-project/scripts/releases.ts
TD=recovery/transients              # the allow-lists live in your project's data root

node $A assemble  --chunks chunks.json           # size + digest, writes nothing
node $A write-set --release <id> --label <label> \
                  --chunks chunks.json --raw raw.json > set.json   # the four artifacts
node $L add-dump --from set.json                 # record the dump in the registry
node $L list                                     # the valid --release ids

node $C digest  dump.bin                         # sha256 + size, for the capture record
node $C compare a.bin b.bin --route memory-read  # classify each difference, exit 1 on FAIL
node $C floor   a.bin b.bin c.bin --route memory-read   # drift floor across a capture set

node $CX cross original.bin rebuild.bin --route memory-read   # two DIFFERENT binaries

node $T derive --release <id> --out $TD/<id>.json a.bin b.bin c.bin
node $T check  --allow-list $TD/<id>.json a.bin b.bin

node $V slice  run1.vsf --out run1.bin           # flat 64K image from a .vsf snapshot
node $V digest run1.vsf                          # sha256 + size, writes no file

node $W resolve --release <id>                   # on-demand-load watch set
node $W render                                   # recovery/LOADING.md
```

The scripts read only committed files and the JSON that **you** wrote from
your own `vice_*` calls. They do not connect to anything. How to send those
calls is in `c64-emulator`.

The scripts need a project root and a release registry. Both come from
`c64-project`. The [release registry shape](../c64-project/SKILL.md#the-release-registry)
is documented there.

## The order

| # | Phase | What it proves |
|---|---|---|
| 1 | Read the disk directory | The release's directory entries are real, before you boot anything |
| 2 | Boot, and make sure the program counter moved | The loader executes |
| 3 | Checkpoint, hit, read 64K and the chip state | The capture itself, with all reads in one paused window |
| 4 | `write-set` | The checks pass, the four artifacts exist, and you have the digest |
| 5 | Disarm, list, resume one time | No checkpoint stays armed, and the machine runs |

Read the disk with `c64-disk`. Boot the release as
[`c64-emulator`](../c64-emulator/SKILL.md#boot-a-program-or-a-disk) tells.
Read the [observation hazards](../c64-emulator/references/observation-hazards.md)
before you drive the machine.

## Capture at a trigger address

1. `vice_checkpoint_add` at the trigger address, with `exec: true` and
   `stop: true`.
2. `vice_execution_run`.
3. Poll `vice_ping` until the checkpoint reports a hit.
4. Read `$0000`-`$FFFF` with `vice_memory_read` calls of 4096 bytes each.
   Write them to `chunks.json` as an array of
   `{ "address": "$0000", "hex": "..." }` records, one for each call, hex
   only.
5. Record the chip state in the **same paused window**, in `raw.json`. The
   keys never change, because `chip-state` uses exactly these fields:
   - `registers`, `sprites` and `cpu` come unchanged from
     `vice_vicii_get_state`, `vice_sprite_get` and `vice_registers_get`.
   - `port01_raw` is `$0001`. `dd00_raw` is `$DD00`. `d018_raw` is `$D018`.
   - `sprite_pointers` is the eight bytes at `screen_base+$3F8`.
   - `captured_at` is the time of the reads, as an ISO time string.
   - `route` is `memory-read` for `vice_memory_read` chunks, or `snapshot`
     for an image sliced from a `.vsf` file.
   - `dd00_direct_read` is optional. Add it only when you read `$DD00` a
     second time.

   `chip-state` and `write-set` refuse a missing or bad field, and name it.
   They never use a default value in place of a register reading.
6. Write all four artifacts with one command:

   ```bash
   node $A write-set --release <id> --label <label> \
     --chunks chunks.json --raw raw.json
   ```

   The command checks for exactly 65536 bytes, with no gap and no overlap,
   *before* it writes anything. Then it writes `<release>-<label>.bin`,
   `.state.json`, `.map.json` and `.capture.json` in
   `recovery/<release>/dumps/`. It returns their paths and the SHA-256. It
   also calculates `vic_bank`, `screen_base`, `charset_base` and
   `sprite_data_addresses`. Do not calculate them by hand. If the four files
   exist already, `write-set` refuses. Use `--force` only to replace a dump
   set on purpose.
7. Record the dump in the registry: `node $L add-dump --from set.json`.
   Label the primary dump of a release `run1`. `watch-loads.ts` and
   `c64-provenance` read that dump.
8. `vice_checkpoint_delete` the checkpoint.
9. `vice_checkpoint_list`. Make sure that it reports zero checkpoints. Only
   this list is proof. Record the count.
10. `vice_execution_run`, one time, to let the machine run.

`assemble` does the same checks and writes nothing. Use it for a quick check
of a chunk set before you commit it.

**Fill in the reproducibility key in the same step.** The Identity table in
[templates/capture-record.template.md](templates/capture-record.template.md)
has three rows that are one key, not three facts: `binary sha256`,
`argv digest` and `seed`.

- The seed alone is **not** the key. A measurement with the same seed and a
  different argv order gave an image that differed in 76 bytes.
- Two captures with different argv digests have different keys. Do not
  compare them as a pair.
- A record with one of the three rows empty is not a reproducible capture.
  [Void the run](#void-a-run).

The table also has a `capture route` row (`memory-read` or `snapshot`). **On
the snapshot route, the `$D000-$DFFF` volatility rule does not apply.** A
difference there is a real difference.

## Worked example: a real capture

Chunks made from a committed image, then given to `assemble`:

```
$ node $A assemble --chunks chunks.json
65536 bytes, sha256 e1b8428c55bc7606b7e77846e8928bff23e9cf0c8241da479aadc1bc092faa26
{"ok":true,"bytes":65536,"sha256":"e1b8428c55bc7606b7e77846e8928bff23e9cf0c8241da479aadc1bc092faa26"}
```

That digest is the same as the `sha256` field in that capture's committed
`.capture.json` sidecar. So the assembly path gives a known-good artifact, not
only 65536 bytes.

Then break the chunks on purpose, to see what the checks say:

```
$ node $A assemble --chunks gap.json      # one chunk removed
{"ok":false,"message":"assembleImage: gap before address $3000 -- next chunk starts at $4000"}

$ node $A assemble --chunks short.json    # last chunk 2 bytes short
{"ok":false,"message":"assembleImage: assembled 65534 bytes ending at $FFFE, expected exactly 65536"}
```

Each message gives an address to read again. Do not fill a gap with padding.

`manifest` on a new capture reports `classification_state: "ranges-only"`,
with each range `unclassified`. That is correct. It becomes `"bucketed"` only
after `c64-provenance` divides the image into loader, cracktro and game. A new
capture that already says `"bucketed"` is wrong.

## Void a run

A clean capture is a capture with no epoch-drift error. How the MCP server
detects a machine restart is in
[`c64-emulator`](../c64-emulator/SKILL.md#prove-that-the-machine-did-not-change).
A drift error voids the run, also when the next call works.

Void a run when you cannot prove that the machine stayed the same:

1. Rename each artifact to `<name>.VOID-<UTC timestamp>`.
2. Write a note next to the artifacts. Give the reason and the time. If a
   drift error voided the run, copy the epoch values from the error text. Do
   not try to read them in a different way. No tool reads the epoch.
3. Keep the voided artifacts on disk. Do not use them again.

## Compare two captures

Do not classify differences by hand. `compare.ts` applies the same rules each
time. It exits 1 on a FAIL, so a script can use it as a gate. Give the
capture route with `--route memory-read` or `--route snapshot`. The script
refuses to run without it:

```bash
node $C compare capture-a.bin capture-b.bin --route memory-read
```

```
A  capture-a.bin  sha256 741213dcd1beb548b8896737f9f07e867c718dabeb56238862b9f3020e4902d2
B  capture-b.bin  sha256 ee3813322127b7bedf97abf3dd6ffcebb80c937f8b75dfe471c886fb36975573

volatile (excluded from the verdict): 100
  $020A  $9E %10011110  ->  $8E %10001110   1 bit
  … 99 more (--limit 0 for all)

drift — exactly one bit, reported as candidates: 61
  $CC03  $00 %00000000  ->  $20 %00100000   1 bit
  … 60 more (--limit 0 for all)

DIVERGENCE — two or more bits, fails the comparison: 0

total differing addresses: 161 of 65536

VERDICT: PASS
Drift candidates present — pass, but record them with the capture.
{"ok":true,"verdict":"PASS","route":"memory-read",...}
```

`--limit 0` prints all rows. `node $C` with no arguments prints the rules.

The three classes:

| Class | Rule | Effect on the verdict |
|---|---|---|
| volatile | `$0000-$0001`, `$0100-$01FF`, `$0200-$03FF`, and **`$D000-$DFFF`** on the memory-read route only | counted and listed, never fails |
| drift | exactly one bit differs | listed as a candidate, passes |
| divergence | two or more bits differ | listed, **fails** |

**On the memory-read route, `$D000-$DFFF` is volatile because it is I/O, not RAM.** The VIC-II
registers repeat every `$40` across `$D000-$D3FF`. The SID registers repeat
across `$D400-$D7FF`. A read of that range samples live hardware, so two
captures can never agree there. An earlier rule that left this range out
failed five of six committed pairings, on `$D344`, `$D625` and `$D628`. Apply
the region rule first, then the bit count. On the snapshot route, the image
holds the RAM below the I/O area, so `compare.ts` does not mask that range.

`$E000-$FFFF` (RAM below the KERNAL ROM when HIRAM = 0) is **not** excluded on
purpose. `$FAD8` and `$FC51` differ across captures. That is only two
addresses of 8192, which is too few for power-on garbage, and nobody knows
the cause. They still fail. Confidence is medium. Nobody reproduced this on a
second release.

**Find the drift floor** with `floor` across all captures of one checkpoint.
It reports each address that differed in any pairing, with the values it
saw:

```bash
node $C floor run1.bin run2.bin run3.bin --route memory-read
```

Capture the power-on image as the first action on a new machine. Then do two
more captures while the machine is idle, and run `floor` on the set. Report
the result as a floor, not as a full set. More captures can only make it
larger.

## Compare two different binaries

`compare.ts` is for two captures of the **same** binary. For captures of
**different** binaries (original and rebuild, original and modified), use
`compare-cross-binary.ts`:

```bash
node $CX cross original.bin rebuild.bin \
  --state original.state.json rebuild.state.json \
  --allowlist allow.json --checkpoint hazard_raster_entry
```

The `--state` files are the `.state.json` sidecars that `write-set` writes.
The script compares the 47 VIC-II register bytes in `registers.registersHex`.
Without `--state`, give `--route snapshot` or `--route memory-read`. The
script refuses to guess the route.

Three rules are different from `compare.ts`, because the same-binary rules
are wrong for two different binaries:

- **No drift class.** Here, a one-bit difference is a real difference, not
  noise. The drift class exists for two runs of the *same* binary. Across
  binaries, it would hide a real one-bit regression, for example
  `lda #$02` that became `lda #$03`.
- **A smaller I/O mask.** `compare.ts` masks all of `$D000-$DFFF`.
  `compare-cross-binary.ts` masks only the registers and ranges that cannot
  be stable: `$D011`, `$D012`, `$D019`, `$D01E`-`$D01F`, `$D400`-`$D7FF`,
  `$D800`-`$DBFF`, `$DC00`-`$DCFF`, `$DD00`-`$DDFF` and `$DE00`-`$DFFF`. So
  `$D015`, `$D018` and `$D020` stay in the verdict.
- **The capture route counts.** Each state sidecar declares its `route`
  (`snapshot` or `memory-read`). A sidecar with no `route` is refused. The
  script refuses to compare a snapshot capture with a memory-read capture. The two routes disagree about what
  `$D000-$DFFF` is (see
  [Slice the image out of a snapshot](#slice-the-image-out-of-a-snapshot)).

Accept a real difference with the `--allowlist` document. Never make the mask
wider. Each entry names a `start`/`endInclusive` range, a `domain` (`image` or
`register`) and a `why` that is not empty. The script refuses an entry that
overlaps a masked range, or an entry with no `why`. Use `--no-allowlist` as
the control: the same pair must fail without the allowlist. If it does not,
the allowlist does nothing.

The script prints `BYTE_IDENTICAL: yes` or `no`. This is extra information,
never the verdict. The script always does the full classification, also when
the two images are the same byte for byte. A regression in the chip state
only (for example a different `$D020`) can exist below identical images. Use
only the `VERDICT:` line as a gate.

## Derive a transient allow-list for a release

`derive-transients.ts` does the derivation the same way each time. **The
method carries forward between releases. An address set never does.** Two
commands:

```bash
node $T derive --release <id> --out $TD/<id>.json run1.bin run2.bin run3.bin
node $T check  --allow-list $TD/<id>.json runA.bin runB.bin
```

`derive` takes **N ≥ 3** runs of the same release, with the same protocol, at
the same stop. It writes the **union of the addresses that differ in each
pairwise comparison**. Each entry has the address, the pairings where it
differed, the byte values seen, and an empty attribution line for you to fill
in.

- `derive` refuses fewer than three images, and names the count and the
  minimum.
- It refuses an image that is not exactly 65536 bytes, and names the path and
  the length.
- It prints `TRANSIENT_COUNT: <n>` at column 0, so you can copy the number
  exactly.

**Above the cap of 64 addresses, the derivation is VOID.** The exit code is
not zero, and **no artifact is written**. The message tells you that the
stop is not frame-exact. Record that as a fact. Do not raise the threshold.

- `--cap` can only make the cap smaller. A value above 64 is refused.
- `derive` never cuts the union to fit. A cut list lets later comparisons
  pass on bytes that nobody checked.
- Overflow is a **measured** result: 0 addresses at a frame-exact `READY`
  stop, 66 at a frame-anchored autostarted stop with 4000 ms jitter, 300 at a
  wall-clock autostarted stop on a real release, and 1242 at a wall-clock
  `READY` stop with the determinism settings applied.

A derivation over an existing artifact is **refused without `--force`**. An
inherited list looks the same as an honest one afterwards.

`check` tests one pair against a committed derivation, without a new
derivation. It prints `CHECK_VERDICT: equivalent | not-equivalent` and exits 1
when the pair is not equivalent. `check` has no volatile ranges and no bit
tolerance at any address. A one-bit difference outside the list fails. Those
two rules belong to `compare.ts` only. [transients/README.md](transients/README.md)
has the artifact shape, the method and the reason for the cap.

## Slice the image out of a snapshot

`vsf-slice.ts` makes the flat 64K image from the memory module of a VICE
`.vsf` snapshot. `vice_snapshot_save` writes the snapshot (see
[`c64-emulator`](../c64-emulator/SKILL.md#save-and-load-a-snapshot)). Two
commands:

```bash
node $V slice  run1.vsf --out run1.bin   # writes exactly 65536 bytes
node $V digest run1.vsf                 # sha256 + size, writes no file
```

Add `--json` to either command to get the same summary as one JSON object.
It has the memory-module minor version, the body length and the three CPU
port values.

**This route has no transcription step. So the `$D000-$DFFF` volatility rule
does *not* apply to a sliced image.** That rule exists because
`vice_memory_read` samples live I/O. The snapshot array is the RAM *below* the
I/O area, not the register view. In a sliced image, those 4096 addresses are
normal RAM, and a difference there is a real difference.

A malformed snapshot is **refused** by name, with the bad value and the valid
range. The script never cuts it into a short image that looks correct. The
`.vsf` byte layout exists in one place only, `vsf-slice.ts` in the MCP server.
This script finds that module through `VICE_MCP_DIR`, the in-repo path or the
`@henols/vice-mcp` package. When none of them resolves, it refuses and names
each path it tried. It never uses a second copy of the layout.

## Watch for on-demand loads

A game with a raw-sector loader can load more data while it plays. A capture
at one checkpoint does not show that. `watch-loads.ts` records whether such a
load happens. It holds only the pure logic. You arm the checkpoints and read
the machine with your own `vice_*` calls, and you write what you see to a
hit log. The script reads the hit log back.

```bash
node $W resolve    --release <id>                  # resolve and record the watch set
node $W attribute  --release <id> --addr '$C000'   # which sentinel owns an address
node $W check-idle --release <id>                  # the idle gate, exit 1 on fail
node $W signature  --hex <1000-byte-hex> --sprite-enable <n>
node $W report     --release <id>                  # the hits, in a fixed order
node $W render    [--release <id>]                 # writes recovery/LOADING.md for all releases
```

Each command takes `--json`.

### 1. Resolve the watch set

`resolve` needs two things in the registry for the release:

- `loader_ranges`: the address ranges of the loader, found live against a
  disassembly. Each range has `start`, `end`, and optional `note` and
  `evidence`.
- A dump with `label` `run1` and a `range_manifest` path. The `.map.json`
  from `write-set` is that manifest.

It makes a set with two tiers, and records it in the registry as
`watch_set`:

| Tier | Sentinel | Why |
|---|---|---|
| `stopping` | An exec checkpoint on each loader range | The loader must never run again after the dump point |
| `counting` | A write watch on each `unused` range of the run1 manifest | A write during play is a load candidate |
| `counting` | A write watch on `$DD00` | A raw-sector loader toggles the serial-bus lines there, and leaves no KERNAL vector activity to watch |

`attribute` finds the one sentinel that owns an address. If two sentinel
ranges overlap, it refuses. It does not choose a winner.

### 2. Arm, calibrate and play

1. Arm each sentinel with `vice_checkpoint_add` or `vice_watch_add`. Record
   the `checkpoint_num` that each call returns in the hit log's `armed` list.
2. Test if the counting tier can count without a stop, and record the result
   in `counting_tier_probe`. A checkpoint with `stop: false` needs
   `acknowledgeTraceRisk: true`. If it cannot count without a stop, record
   the fallback.
3. Let the machine run with no input. Record the cycles in
   `idle_calibration.cycles_advanced` and the hits of each sentinel.
   `check-idle` passes only when each `stopping` sentinel of the watch set
   has a calibration entry with zero hits, and `cycles_advanced` is more than
   zero. A missing entry fails the gate. A machine that did not run proves
   nothing.
4. Play through the milestones. At each milestone, read the 1000 bytes of
   the screen matrix and `$D015`, and give them to `signature`. The digest is
   the proof that you arrived. Screenshots are for people and are never
   hashed.
5. For each hit, record the program counter, a `vice_backtrace` and a
   `vice_disassemble`. Then set `classification` to `gameplay-write` or
   `load-candidate`. A hit without all three is `unattributed`, whatever its
   `classification` field says.
6. For a `load-candidate`, take a supplementary capture and record its path
   in `supplementary_dump`.
7. Delete each checkpoint. Record the `vice_checkpoint_list` count in
   `teardown.checkpoints_remaining`, with the time in `enumerated_at`.

The hit log is `recovery/<release>/dumps/<release>-loading-hits.json`. Each
`armed` entry must have its `checkpoint_num`, and the log must have
`teardown.checkpoints_remaining`. The word of a delete call is never the
proof.

### 3. Report and render

`report` sorts the hits by cycle, then address, then sentinel. The same log
always gives the same report. `render` writes `recovery/LOADING.md` for each
release that has a hit log. `--release <id>` keeps the other
releases in the file. It only makes `render` refuse when that release is
unknown or has no hit log. The load-event count of a release is the number
of attributed `load-candidate` hits.

- Set `run_status: "blocked"` when the live work did not finish. `render`
  then marks a count of 0 as **not an evidenced zero**, and a larger count as
  a partial result.
- A late hit in a later full trace reopens `LOADING.md`. The registry's
  `watch_set` is the specification to arm again.

## Where a capture digest goes next

`compare.ts digest` gives the `sha256` and `size` of a capture. They become
the `captureSha256` of the memory-map provenance sidecar. This proves which
image the map describes. This skill does not write the sidecar. How to render
the map is in `c64-annotations`.

## Failure shape

The last line on stdout is one JSON result: `{"ok": true, ...}` with exit
code 0, or `{"ok": false, "message": "..."}` with exit code 1. `--json` gives
only that line. Without `--json`, text lines come first. `vsf-slice.ts`
passes the output of the MCP module through without a change.

A refusal writes nothing. `compare` and `cross` give `ok: false` on a FAIL
verdict. `check` gives `ok: false` when a pair is not equivalent. `check-idle`
gives `ok: false` when the idle gate fails. An over-cap `derive` gives
`ok: false` and writes no artifact.

## What this skill does NOT do

- **No emulator driving.** Boot, checkpoints, input and the epoch are
  `c64-emulator`.
- **No disk read.** The directory, the BAM and the file chains are
  `c64-disk`.
- **No release diff.** Whether a byte is original or cracker-changed, and
  what `bucketed` means, is `c64-provenance`.
- **No meaning of an address.** That is `c64-memory-map`.
- **No choice of the next address to look at.** That is
  `c64-reverse-engineering`.
- **No registry or path setup.** That is `c64-project`.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `assembleImage: gap before address $3000 -- next chunk starts at $4000` | A `vice_memory_read` did not land. Read that 4096-byte window again. Do not pad it. |
| `assembleImage: overlap at address $8000 -- a previous chunk already covered up to $8003` | Two chunks cover the same window, usually after a retry. Delete the duplicate. |
| `assembleImage: assembled 65534 bytes ending at $FFFE, expected exactly 65536` | A read was short. Read the last window again. |
| `unknown release "x" -- known releases: …` | The `--release` id is not in the registry. The error names the valid ids. Nothing was written. |
| ``project-paths: could not locate the project root -- no `.git` found above ...`` | Run in a git checkout, or set `C64RE_PROJECT_ROOT`. See `c64-project`. |
| A new `.map.json` says `classification_state: "bucketed"` | Wrong. A new capture is `"ranges-only"`. Only the provenance diff sets `"bucketed"`. |
| The checkpoint never fired | Most reads stop the machine. Do all reads, then resume one time. See `c64-emulator`. |
| Two captures of the same checkpoint differ | This is expected. Run `compare` and read the verdict. Do not judge by eye. |
| `compare` fails on an address in `$D000`-`$DFFF` | With `--route memory-read` it cannot: `compare.ts` masks that range. With `--route snapshot` the failure is real, because the image holds RAM there. |
| `compare needs --route memory-read or --route snapshot` | Give the route of the two captures. The route decides the `$D000-$DFFF` rule. |
| `cross` fails on an address in `$D000`-`$DFFF` | This is expected. `compare-cross-binary.ts` masks less on purpose. The failure is a real finding. |
| `cross` refuses with "capture routes differ" | The two `--state` sidecars declare different `route` values. Capture both the same way, or give the correct `--route`. |
| `cross` refuses with "logical checkpoints differ" | The two sidecars declare different `checkpoint_name` values. Capture both at the same named checkpoint, or correct the sidecar. |
| `compare` fails on `$FAD8` or `$FC51` only | Known, and the cause is unknown. Record it with the capture. Do not void a set that is otherwise clean. |
| An epoch-drift error appeared during a capture | The machine restarted. [Void the run](#void-a-run). The next call that works does not change that. |
| `WATCH_SET: release "x" has no loader_ranges recorded` | Find the loader ranges live against a disassembly, and record them in the registry. |
| `WATCH_SET: release "x" has no run1 dump with a range_manifest recorded` | Add the run1 dump, with the `.map.json` path as `range_manifest`, to the release. |
| `readHitLog: no hit log at … for release "x"` | Write the hit log at `recovery/<release>/dumps/<release>-loading-hits.json`. |
| `attributeAddress: overlapping or duplicate sentinel ranges` | Two sentinels overlap. Correct the watch set. |
| `screenSignature: expected 1000 bytes of screen matrix hex, got N bytes` | Read exactly 1000 bytes of the screen matrix. |
