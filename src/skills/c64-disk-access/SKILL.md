---
name: c64-disk-access
description: Read a Commodore .d64 disk image's directory, block allocation map, a named file's sector chain, or a named file's raw bytes, using VICE's own c1541 disk tool as the reference implementation, and audit its directory for fabricated or corrupted entries. Use when asked to list what a disk image contains, check a disk's free blocks or block allocation map, trace which sectors a named file occupies on disk, extract a named file's raw bytes from a .d64, or check whether a disk's directory entries are genuine (a cracker-fabricated filename, a corrupted first track/sector, or a cyclic directory chain).
---

# Reading C64 disk images with c1541

Read-only. Six capabilities, one script, one binary (`c1541`) reached only
through the host-tool execution seam:

```bash
S=src/skills/c64-disk-access/scripts/c1541.mjs   # from the repo root

node $S bam   --image path/to/image.d64                    # block allocation map
node $S dir   --image path/to/image.d64                    # what's on the disk
node $S entry --image path/to/image.d64 --name FILENAME     # one directory entry's raw fields
node $S chain --image path/to/image.d64 --name FILENAME     # a named file's sector chain
node $S read  --image path/to/image.d64 --name FILENAME     # extract a named file's bytes
node $S audit --image path/to/image.d64                     # find fabricated/corrupted directory entries
```

The script wraps `c1541` and nothing else — **read-only**. `bam`/`dir`/`audit`
need only `--image`. `entry`/`chain`/`read` also need `--name`, a CBM
filename or glob pattern (never a path). No `-format`, `-write`, `-bwrite`
or `-delete` verb is reachable from here, deliberately: this skill only
ever reads a disk image, never mutates one.

Options: `--image PATH` `--name CBM-NAME` `--out-dir DIR` `--json`.

`--out-dir` defaults to the image's own directory, exactly like
`acme-build`'s own `--out-dir` default. Both `--image` and `--out-dir` are
resolved **workspace-relative** to the smallest ancestor directory
containing both, before the request reaches the seam. This is the same
resolution `acme-build`'s `source`/`--out-dir` already go through. The seam
passes `--name` straight through and never resolves it as a path. The seam
refuses a value beginning with `-` before it spawns any child process.
Otherwise `c1541`'s own CLI would read it as a flag.

## Directory listing

```bash
node $S dir --image game.d64 --json
```

Prints the seam's response verbatim as one line of JSON:

```json
{"ok":true,"tool":"c1541.dir","exitStatus":0,"results":[{"path":"/abs/path/game.dir.txt","sha256":"...","byteLength":123}],"stderrTail":""}
```

`results[0].path` names the listing file the seam wrote — `c1541`'s own
`-dir` output, captured and digested.

## Block allocation map

```bash
node $S bam --image game.d64 --json
```

Same response shape as `dir`. `results[0].path` names a file carrying one
per-sector allocation row per track. Each row is a run of `*`/`.`
characters, `*` for an allocated sector.

## One directory entry's raw fields

```bash
node $S entry --image game.d64 --name FILENAME --json
```

`results[0].path` names a file carrying the entry's raw 32-byte directory
record (as a hex dump). A `T/S: <t>/<s>, <n> blocks` summary line follows
the record. This script also parses that line back and adds
`firstTrack`/`firstSector` as numeric fields on the JSON response. These
fields exist purely to show the values — the file itself is still the
authoritative source.

## A named file's sector chain

```bash
node $S chain --image game.d64 --name FILENAME --json
```

`results[0].path` names a file listing every `(track,sector)` hop the file
occupies, in order. A single-sector file's chain shows one hop with no
second tuple on the arrow's right side. A multi-sector file's chain repeats
the tuple at every hop.

## Extracting a named file's bytes

```bash
node $S read --image game.d64 --name FILENAME --out-dir /scratch --json
```

Writes the file's raw bytes. Unlike the other four capabilities, this one
is NOT a captured-stdout listing — `c1541` writes the output file itself.
`results[0]` carries that file's `path`/`sha256`/`byteLength`.

## Auditing for fabricated or corrupted entries

```bash
node $S audit --image game.d64 --json
```

The `audit` command composes `dir` (names and block counts) and `bam` (the
per-sector allocation map). For each name, it also makes one `entry` call
to get that file's own claimed first track/sector and its directory
sector's "next directory" pointer. Together these calls form a ported,
read-only detector — no `-format`/`-write`/mutating verb, and no seventh
`host_tool` id. This is three existing capabilities composed client-side.

The `audit` command flags a directory entry `suspicious`, with **named
reasons, never a bare boolean**, on any of:

1. its block count is `0`.
2. its first track/sector lies outside the image's own geometry. There is
   no such track, or no such sector on that track.
3. the allocation map reports its first **sector** — not merely its whole
   track — free, meaning the file cannot really start there. This is
   sharper than checking only whether the whole track is free, because the
   per-sector map is available.

A directory chain is cyclic or self-referential when two entries claim the
same first track/sector. It is also cyclic or self-referential when a
"next directory" pointer refers back to a sector already seen, including
the directory's own starting sector. When this happens, the command stops
treating the repeat as new information. Instead of looping, it reports a
top-level `chain_error` naming the repeated pointer. Every remaining entry
is still audited afterward — a chain error on one entry never hides another
entry's own independent flag.

```json
{"entries":[{"name":"basicstub","blocks":1,"first_track":17,"first_sector":0,"suspicious":false,"suspicious_reasons":[]}],"chain_error":null}
```

**A flag is a signal to investigate, not a verdict.** A directory entry a
cracker fabricated for a file never actually written, a genuinely
corrupted image, and (rarely) an unusual-but-legitimate disk layout can
all produce a flag. This command reports what it finds, named, and leaves
the interpretation to whoever is looking at the disk.

## Failure shape

The seam reports a nonexistent image, a nonexistent named entry, or any
other call `c1541` cannot service as `{"ok":false,"message":"..."}` with a
non-zero exit code. This is **never** a success envelope over an empty or
partial result. `c1541` itself exits `0` even on a genuine failure (it
prints its own `Error - ...` lines to stdout instead). The seam's own
classifier, not the exit code, is what decides success here.

## What this skill does NOT do

- **No mutating verb.** `-format`/`-write`/`-bwrite`/`-delete` are never
  reachable from this script, on the wire, or anywhere in this skill's tree
  — this skill exposes only the six read-only capabilities above.
- **No direct binary spawn.** `c1541` runs host-side. This script only ever
  constructs a typed request and reads the produced files back off the
  shared workspace tree — the host-tool execution seam is the only route.
- **No emulator dependency.** This skill names no VICE emulator tool at
  all — it works entirely on files, never on a running machine, by construction.
