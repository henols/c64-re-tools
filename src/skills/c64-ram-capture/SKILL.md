---
name: c64-ram-capture
description: Capture a running C64's full 64K RAM as a verified flat image, and prove two captures are equivalent. Use when asked to dump RAM, depack a program by running it, capture a memory image at a checkpoint, or compare two captures for reproducibility.
---

# Capturing and comparing C64 RAM

**Reach the emulator only through the `mcp__plugin_c64-re-tools_vice__*` tools.** They are the one
permitted route. Never open a connection by any other means.

**Never hand-assemble a capture.** Sixteen `vice_memory_read` calls have to land
contiguously and total exactly 65536 bytes; a dropped or short read is the normal
failure and it is invisible in a hex dump. Two committed modules do that byte work
and name the offending address when it is wrong.

```bash
S=src/skills/c64-ram-capture/scripts    # from the repo root
P=$S/d64-parse.mjs   A=$S/dump-artifacts.mjs
C=$S/compare.mjs     L=$S/releases.mjs
T=$S/derive-transients.mjs

node $P directory --image path/to/image.d64      # what's on the disk (--json flags faked entries)
node $P bam       --image path/to/image.d64      # disk name, DOS type, occupied track ranges
node $A assemble  --chunks chunks.json           # size + digest, writes nothing
node $A write-set --release <id> --label <label> \
                  --chunks chunks.json --raw raw.json    # the four committed artifacts
node $L list                                     # the valid --release ids

node $C digest  dump.bin                         # sha256 + size, for the capture record
node $C compare a.bin b.bin                      # classify every difference, exit 1 on FAIL
node $C floor   a.bin b.bin c.bin                # drift floor across a capture set

node $T derive --release <id> --out transients/<id>.json a.bin b.bin c.bin
node $T check  --allow-list transients/<id>.json a.bin b.bin
```

Every module above reads only committed files and the JSON **you** wrote from
your own `mcp__plugin_c64-re-tools_vice__*` calls. They contact nothing.

**Prerequisite: a resolvable project root.** `scripts/project-paths.mjs` uses
`C64RE_PROJECT_ROOT` when it is set, and otherwise walks up from the toolkit's
own location for the nearest ancestor directory containing a `.git` entry. A
scratch project has neither by default, so `git init` it first or set the
variable — the thrown error names both when this fails.

## The order

| # | Phase | Settles |
|---|---|---|
| 1 | Read the disk directory | Whether the release's entries are real or faked, before booting anything |
| 2 | Boot, confirm the PC moved | That the loader is actually executing |
| 3 | Checkpoint, hit, read 64K + chip state | The capture itself — all reads in one paused window |
| 4 | `write-set` | Assertions pass, four artifacts written, digest returned |
| 5 | Disarm, enumerate, resume once | That you left no checkpoint armed and the machine running |

## Read the disk first

`scripts/d64-parse.mjs` parses `.d64` bytes directly, so it answers what is on the
disk whether or not the emulator is up:

```bash
$ node $P directory --image demo.d64
PRG "DEMO GAME" first=5/0 blocks=5

$ node $P bam --image demo.d64
disk name: "DEMO DISK"  id: 38  dos type: 2A
first dir sector: 18/1
occupied track ranges: 5
```

Do not eyeball the directory for fakery — `--json` decides it. Every entry carries
`suspicious` plus `suspicious_reasons`, set when the block count is 0, when the
first track/sector falls outside the image, or when it points into a track the BAM
reports as entirely free. That last case is the signature of an entry claiming a
file never written to disk.

`scripts/d64-parse.test.mjs` proves the detector both **fires** on a synthetic
faked entry and stays silent on a well-formed one — a guard proven only silent is
not a guard. It also sweeps whatever real `.d64` corpus the project ships,
skipping when there is none. A non-null `chain_error` is the separate failure: a
directory chain that leaves the image or loops, reported instead of hanging.
**Confidence: HIGH** (synthetic fire-and-silence tests, plus a corpus sweep).

## Boot a disk

1. `mcp__plugin_c64-re-tools_vice__vice_disk_attach` with the disk image.
2. `mcp__plugin_c64-re-tools_vice__vice_autostart` with the same image.
3. `mcp__plugin_c64-re-tools_vice__vice_execution_run`.
4. `mcp__plugin_c64-re-tools_vice__vice_registers_get` and confirm the program counter has moved.

The broker sets the drive type at launch for every stock instance, so no drive setup
is needed before attaching.

If the program counter has not moved, type `LOAD"*",8,1` with
`mcp__plugin_c64-re-tools_vice__vice_keyboard_type`, run it, then type `RUN` and run it.

## Capture at a trigger address

1. `mcp__plugin_c64-re-tools_vice__vice_checkpoint_add` at the trigger address, with execution
   breaking and stopping enabled.
2. `mcp__plugin_c64-re-tools_vice__vice_execution_run`.
3. Poll `mcp__plugin_c64-re-tools_vice__vice_ping` until the checkpoint reports a hit.
4. Read `$0000`–`$FFFF` with repeated `mcp__plugin_c64-re-tools_vice__vice_memory_read` calls of
   4096 bytes each. Write them to `chunks.json` as an array of
   `{ "address": "$0000", "hex": "..." }` records, one per call, hex only.
5. Record the chip state in the **same paused window**, into `raw.json`. The keys
   are fixed, because `chip-state` derives from exactly these: `registers`,
   `sprites` and `cpu` pass through verbatim from
   `mcp__plugin_c64-re-tools_vice__vice_vicii_get_state` / `mcp__plugin_c64-re-tools_vice__vice_sprite_get` /
   `mcp__plugin_c64-re-tools_vice__vice_registers_get`; `port01_raw` is `$0001`; `dd00_raw` is
   `$DD00`; `d018_raw` is `$D018`; `sprite_pointers` is the eight bytes at
   `screen_base+$3F8`.
6. Write all four artifacts in one call:

   ```bash
   node $A write-set --release <id> --label <label> \
     --chunks chunks.json --raw raw.json
   ```

   It asserts exactly 65536 bytes with no gap and no overlap *before* writing
   anything, then emits `<release>-<label>.bin`, `.state.json`, `.map.json` and
   `.capture.json` under `recovery/<release>/dumps/`, and returns their paths
   with the SHA-256. It also derives `vic_bank`, `screen_base`, `charset_base`
   and `sprite_data_addresses` for free — do not recompute them by hand.
7. `mcp__plugin_c64-re-tools_vice__vice_checkpoint_delete` the checkpoint.
8. `mcp__plugin_c64-re-tools_vice__vice_checkpoint_list` and confirm it reports zero checkpoints.
   Accept only this enumeration as proof. Record the count.
9. `mcp__plugin_c64-re-tools_vice__vice_execution_run` to leave the machine running.

Read state before you resume, and resume exactly once at the end.

Hold keys down across a gate by releasing them at the trigger checkpoint in
step 3, never earlier.

**Fill the record's reproducibility key in the same step.**
`templates/capture-record.template.md`'s Identity table carries three rows that
are one key, not three facts: `binary sha256`, `argv digest` and `seed`. The
seed alone is **not** the key — measured, the same seed with a reordered argv
yielded a 76-byte-different image, so two captures whose argv digests differ are
different keys and must not be compared as a pair. A record with any of those
three blank is not a reproducible capture and the void protocol applies. The
table also carries a `capture route` row (`memory-read` or `snapshot`), and
**on the snapshot route the `$D000-$DFFF` volatility rule below does not
apply** — a difference there is a real difference.

`assemble` runs the same assertions and writes nothing, so it is the cheap check
on a set of chunks before committing them.

## Worked example — a real capture

Chunks derived from a committed image, fed back through `assemble`:

```
$ node $A assemble --chunks chunks.json
65536 bytes, sha256 e1b8428c55bc7606b7e77846e8928bff23e9cf0c8241da479aadc1bc092faa26
```

That digest is byte-identical to the `sha256` field committed in
that capture's own committed `.capture.json` sidecar, so the assembly path
reproduces a known-good artifact rather than merely producing 65536 bytes.
**Confidence: HIGH** (reproduced against the committed sidecar).

Then break it deliberately, to see what the guards say:

```
$ node $A assemble --chunks gap.json      # one chunk removed
Error: assembleImage: gap before address $3000 -- next chunk starts at $4000

$ node $A assemble --chunks short.json    # last chunk truncated by 2 bytes
Error: assembleImage: assembled 65534 bytes ending at $FFFE, expected exactly 65536
```

Read those as addresses to re-read, not as sizes to pad.

`manifest` on a fresh capture reports `classification_state: "ranges-only"` with
every range `unclassified`. That is correct and transient — it becomes `"bucketed"`
only after the provenance diff partitions loader from cracktro from game — see
`c64-provenance-diff`. A fresh capture already claiming `"bucketed"` is the anomaly.

## Find an entry point

1. Press past any "hit any key" gate with `mcp__plugin_c64-re-tools_vice__vice_keyboard_matrix`.
   **This call requires the fork backend** — the binary monitor's `KEYBOARD_FEED` only injects
   PETSCII text into the KERNAL buffer and cannot drive the raw matrix. On stock, use
   `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL buffer, or
   `vice_joystick_set` when it polls the matrix directly; buffer injection stays invisible to a
   program polling `$DC00`/`$DC01` itself.
2. Step forward in batches with `mcp__plugin_c64-re-tools_vice__vice_execution_step`, reading
   `mcp__plugin_c64-re-tools_vice__vice_registers_get` after each batch.
3. Stop when the program counter and the stack pointer both settle into a
   repeating range across three consecutive batches. That range is the
   dispatch loop; its lowest address is the entry point.
4. Confirm the address with `mcp__plugin_c64-re-tools_vice__vice_disassemble` before recording it.

Set a batch ceiling before you start. Report failure to stabilise as a finding
with the batches spent; never extend the ceiling silently.

## Prove the machine did not change under you

**Corrected 2026-08-04: there is no exposed tool that reads the epoch, and you do
not have to poll for one.** The proxy compares the restart epoch before *and*
after every forwarded call, and refuses the call — or discards its result, if the
change happened mid-call — with a loud error naming both epoch values. So the
capture's identity is guarded continuously, not at two sampled points.

What that leaves you:

- **A clean capture is one during which no epoch-drift error appeared.** Record
  that, not a pair of hand-read numbers.
- **When you need the numbers,** they come from the drift error's own text, or
  from `mcp__plugin_c64-re-tools_vice__vice_diagnose`'s `restarted` report. Both name the before and
  after value.
- **A drift error voids the run** even if the very next call succeeds. It will —
  the proxy re-baselines so the session stays usable — and a successful retry
  after a respawn is talking to a freshly-booted machine.

`vice-wedge-triage` carries the decision tree for the other three ways a machine
stops answering.

**Void a run** whose machine identity you could not prove unchanged:

1. Rename each artifact to `<name>.VOID-<UTC timestamp>`.
2. Write a sibling note recording the reason, the time, and — if a drift error is
   what voided it — the two epoch values quoted from that error. Do not go looking
   for them; nothing reads the epoch on demand. Keep the voided artifacts on disk.

## Compare two captures

Do not classify differences by hand — `scripts/compare.mjs` applies the rules
identically every time, and exits 1 on a FAIL so a script can gate on it:

```bash
node $C compare capture-a.bin capture-b.bin
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
```

The three classes:

| Class | Rule | Effect on the verdict |
|---|---|---|
| volatile | `$0000-$0001`, `$0100-$01FF`, `$0200-$03FF`, **`$D000-$DFFF`** | counted and listed, never fails |
| drift | exactly one bit differs | listed as a candidate, passes |
| divergence | two or more bits differ | listed, **fails** |

**`$D000-$DFFF` is volatile because it is I/O, not RAM.** The VIC's registers
repeat every `$40` across `$D000-$D3FF` and the SID's across `$D400-$D7FF`, so
reading that range samples live hardware and two captures can never agree there.
Omitting it is what made the earlier hand-applied rule fail five of the six
committed gameentry pairings on `$D344`, `$D625` and `$D628` — differences that
were guaranteed. Region first, bit-count second.

`$E000-$FFFF` (RAM under KERNAL ROM when HIRAM = 0) is deliberately **not**
excluded. `$FAD8` and `$FC51` do differ across captures, but only two addresses
out of 8192 — too few for power-on garbage, and unexplained. They still fail, and
what writes them is an open question. Evidence and grading:
`.planning/RE-FINDINGS.md`, 2026-08-04.

**Establish a drift floor** with `floor` across every capture of one checkpoint.
It reports each address that differed in any pairing, with the distinct values
seen:

```bash
node $C floor run1.bin run2.bin run3.bin
```

Capture the power-on image as the very first action against a fresh machine, then
idle-capture twice more and run `floor` over the set. State the result as a
floor, not a complete set — more captures can only widen it.

## Derive a per-release transient allow-list

`scripts/derive-transients.mjs` is the named, repeatable derivation. **The
method is what carries forward between releases; no address set ever does.** Two
verbs:

```bash
node $T derive --release <id> --out transients/<id>.json run1.bin run2.bin run3.bin
node $T check  --allow-list transients/<id>.json runA.bin runB.bin
```

`derive` takes **N ≥ 3** runs of the same release under the same protocol at the
same stop and writes the **union of addresses differing across every pairwise
comparison** — one entry per address, carrying which pairings it differed in,
the distinct bytes seen, and an empty attribution line for you to fill. Fewer
than three images is refused naming the count and the minimum; an image that is
not exactly 65536 bytes is refused naming the path and the length. It prints
`TRANSIENT_COUNT: <n>` at column 0, so a measurement gets transcribed rather
than paraphrased.

**Over the cap of 64 addresses the derivation is VOID:** non-zero exit, **no
artifact written**, and the message says what the overflow means — the stop is
not frame-exact. That is a fact to record, not a threshold to raise. `--cap`
only ever *narrows*; a value above 64 is refused by name, and the union is never
truncated to fit, because a truncated list makes every later comparison pass on
bytes nobody vetted. Overflow is a **measured** outcome: 0 differing addresses
at a frame-exact `READY` stop, 66 at a frame-anchored autostarted stop at
jitter 4000 ms, 300 at a wall-clock autostarted stop on a real release, 1242 at
a wall-clock `READY` stop with the determinism block applied.

Re-deriving over an existing artifact is **refused without `--force`**, with the
no-inheritance rule in the message: an inherited list cannot be distinguished
afterwards from an honestly derived one.

`check` re-checks one pair against an already-committed derivation without
re-deriving it, printing `CHECK_VERDICT: equivalent | not-equivalent` and exiting
1 when not equivalent. Note what it does **not** carry: no address range is a
volatile span, and there is no bit-count tolerance at any address — a one-bit
difference outside the list fails. Those two rules belong to `compare.mjs` and
are deliberately not inherited. `src/skills/c64-ram-capture/transients/README.md`
holds the artifact shape, the committed method and the cap's reasoning.

## Slice the image out of a snapshot instead of transcribing it

`scripts/vsf-slice.mjs` produces the flat 64K image by slicing a VICE `.vsf`
snapshot's memory module body. Two verbs:

```bash
node scripts/vsf-slice.mjs slice run1.vsf --out run1.bin   # writes exactly 65536 bytes
node scripts/vsf-slice.mjs digest run1.vsf                 # sha256 + size, writing no file
```

Add `--json` to either for the same summary as one JSON object — it carries the
snapshot's memory-module minor, the observed body length, and the three CPU port
read-back values.

**The one thing that matters operationally: this route has no transcription
step, so the `$D000-$DFFF` volatility rule above does *not* apply to an image
produced this way.** That rule exists because `vice_memory_read` samples live
I/O. The snapshot array is RAM *under* I/O, not the register read view, so those
4096 addresses are ordinary RAM in a sliced image and a difference there is a
real difference. Do not carry the exclusion across from the memory-read route.

A malformed snapshot is **refused**, by name, naming the offending value and the
valid range — it is never truncated into a plausible short image. The `.vsf`
byte layout lives in exactly one place, `vsf-slice.ts` on the MCP side; this
script resolves it via `VICE_MCP_DIR`, the in-repo path, or the
`@henols/vice-mcp` package, and refuses naming every path it tried when no rung
resolves rather than falling back to a second copy of the layout.

## Feeding the memory map's provenance sidecar

`c64-program-recon`'s generated memory map (`vice-mcp anno render-memmap`) takes a small provenance
sidecar as input, and this skill supplies one of its fields: `scripts/compare.mjs digest`'s `sha256`
and `size` become the sidecar's `captureSha256`, proving which image the rendered map describes. The
sidecar's other run-scoped keys (`port01`, `dd00`, `vicBank`, `screenRam`, `charsetOrBitmap`, `mode`,
`liveVectorPair`, `vectorHandler`, `rasterPositions`) come from `c64-program-recon`'s own
`derive.mjs` — **this skill does not emit the sidecar itself.** The sidecar is hand-authored from
those two skills' outputs and validated by the renderer, which throws naming every missing or
malformed key at once rather than rendering a document that silently carries a placeholder.

## Which skill does what

This one owns the image and its identity. It does not restate what the others carry.

| Need | Go to |
|---|---|
| Which address to read next, and what the answer rules out | `c64-program-recon` |
| Every way a live read gives a wrong answer | `c64-program-recon` — `references/observation-hazards.md`. **Read before driving.** |
| What a specific address or bit means | `c64-memory-mapping` — `node … lookup '$D018'` |
| Assembling | `acme-build` |
| Whether a byte is original or cracker-changed, and what `bucketed` means | `c64-provenance-diff` |
| Whether the emulator is wedged, and whether it is safe to recycle | `vice-wedge-triage` |
| **A verified 64K image, or proving two captures equivalent** | here |

## Release registry shape

`scripts/releases.mjs` is the only module that reads a release id out of the
registry — every other module takes the id as an argument. Its shape:

| Field | Level | Required | For |
|---|---|---|---|
| `schema_version` | top-level | — | The registry format version. |
| `schema_notes` | top-level | — | Free-text stating the registry's N-readiness claim (`node $L schema-notes`). |
| `releases` | top-level | yes | The array of release entries below. |
| `id` | per-release | yes | The `--release` argument every other script takes. |
| `canonical` | per-release | — | A boolean on one entry, not "the canonical image" — there are N releases. |
| `disk_image` | per-release | yes | Project-relative path to the release's `.d64`. |
| `dumps` | per-release | **yes, as an array** | Per-capture records written by `write-set`. **Must be an array, never omitted** — `releases.mjs`'s `list` command reads `r.dumps.length` with no guard (`releases.mjs:98`), so a missing `dumps` throws `TypeError: Cannot read properties of undefined` instead of listing anything. An empty array (`[]`) is fine; an absent key is not. `releases.mjs` itself imposes no per-entry shape; `scripts/watch-loads.mjs` (a different reader) looks up an entry by `label` and reads its `range_manifest`, which the example below follows. |

The registry lives at `<project root>/recovery/RELEASES.json` by default —
override the whole path with `C64RE_REGISTRY`, or just the containing
directory with `C64RE_DATA_DIR`.

`src/skills/c64-ram-capture/RELEASES.json.example` is a copyable starting
point with every field above populated with placeholder values.

## References

What this skill ships, and the committed modules it leans on. No `references/`
split: the workflow fits in one file, which is the right call when it does.

| Path | Covers |
|---|---|
| `scripts/compare.mjs` | Difference classification and the drift floor. Pure logic over captures you already have — `node $C` with no arguments prints the rules. |
| `scripts/vsf-slice.mjs` | `slice` / `digest` — the flat 64K image sliced out of a `.vsf` snapshot with no transcription step. The layout lives in `vsf-slice.ts` on the MCP side; this wrapper resolves it and refuses by name when it cannot. Covered by `scripts/vsf-slice.test.mjs`. |
| `scripts/derive-transients.mjs` | `derive` / `check` — the per-release transient allow-list, derived from N ≥ 3 runs as the pairwise union, under a committed cap of 64 that **voids** rather than warns. Covered by `scripts/derive-transients.test.mjs`. |
| `transients/README.md` | The committed derivation method, the artifact shape, the cap's reasoning with its four measured reference points, and the rule that no address set is inherited between releases. Its `.gitignore` refuses every image byte form. |
| `templates/capture-record.template.md` | The per-capture record: identity including the three-row reproducibility key and the `capture route` row, machine state read in the same paused window, the void checklist, and the per-pairing comparison table. |
| `scripts/d64-parse.mjs` | `.d64` directory, BAM, and `--json` fakery detection. Fixture-tested against both real images by `scripts/d64-parse.test.mjs`. |
| `scripts/dump-artifacts.mjs` | `assemble` / `chip-state` / `manifest` / `write-set` — the guarded byte work, and the source of every `assembleImage:` message in the table below. |
| `RELEASES.json.example` | A copyable release-registry shape — see `## Release registry shape` above. |

Findings that make RE faster go in `.planning/RE-FINDINGS.md` **at the moment you
find them**, graded with `Evidence:` and `Confidence:`. Promote by re-logging with
the new evidence, never by editing a grade in place. File-changing work enters
through a GSD command (`/gsd-quick`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `assembleImage: gap before address $3000 -- next chunk starts at $4000` | A `vice_memory_read` never landed. Re-read that 4096-byte window; do not pad it. |
| `assembleImage: overlap at address $8000 -- a previous chunk already covered up to $8003` | Two chunks cover the same window, usually a duplicated call after a retry. Drop the duplicate. |
| `assembleImage: assembled 65534 bytes ending at $FFFE, expected exactly 65536` | A read returned short. Re-read the final window. |
| `unknown release "x" -- known releases: …` | The `--release` id is not in the registry. The error names the valid ids; it throws before writing anything. |
| A fresh `.map.json` says `classification_state: "bucketed"` | Wrong — a fresh capture is `"ranges-only"`. The provenance diff sets `"bucketed"`, nothing else. |
| The checkpoint never fired | Most state reads pause the emulator. Resume exactly once, at the end, after every read. |
| Two captures of the same checkpoint differ | Expected. Full-64K identity is impossible in principle; run `compare` and read the verdict rather than judging by eye. |
| `compare` fails on an address in `$D000`-`$DFFF` | It cannot — that range is volatile. If you are seeing this, you applied the rules by hand; use `scripts/compare.mjs`. |
| `compare` fails on `$FAD8` or `$FC51` only | Known and unexplained: RAM under KERNAL ROM, two addresses out of 8192. Record it with the capture rather than voiding a set that is otherwise clean. |
| `--limit 0` printed nothing | Fixed 2026-08-04 — it now means unlimited. Re-pull the script if you see the old behaviour. |
| An epoch-drift error appeared mid-capture | The machine restarted under you. Void the run; do not salvage the artifacts. The next call succeeding does not undo it. |
| The emulator looks dead | `vice-wedge-triage` — and enumerate your own armed checkpoints before concluding anything. |
| `` `project-paths: could not locate the project root -- no `.git` found above ...` `` | No `.git` ancestor and no `C64RE_PROJECT_ROOT`. `git init` the project, or set the variable to its root. |
