---
name: c64-disk-access
description: Read a Commodore .d64 disk image's directory, block allocation map, a named file's sector chain, or a named file's raw bytes, using VICE's own c1541 disk tool as the reference implementation. Use when asked to list what a disk image contains, check a disk's free blocks or block allocation map, trace which sectors a named file occupies on disk, or extract a named file's raw bytes from a .d64.
---

# Reading C64 disk images with c1541

Read-only. Five capabilities, one script, one binary (`c1541`) reached only
through the host-tool execution seam:

```bash
S=src/skills/c64-disk-access/scripts/c1541.mjs   # from the repo root

node $S bam   --image path/to/image.d64                    # block allocation map
node $S dir   --image path/to/image.d64                    # what's on the disk
node $S entry --image path/to/image.d64 --name FILENAME     # one directory entry's raw fields
node $S chain --image path/to/image.d64 --name FILENAME     # a named file's sector chain
node $S read  --image path/to/image.d64 --name FILENAME     # extract a named file's bytes
```

The script wraps `c1541` and nothing else — **read-only**. `bam`/`dir` need
only `--image`; `entry`/`chain`/`read` also need `--name`, a CBM filename or
glob pattern (never a path). No `-format`, `-write`, `-bwrite` or `-delete`
verb is reachable from here, deliberately: this skill only ever reads a disk
image, never mutates one.

Options: `--image PATH` `--name CBM-NAME` `--out-dir DIR` `--json`.

`--out-dir` defaults to the image's own directory, exactly like
`acme-build`'s own `--out-dir` default. Both `--image` and `--out-dir` are
resolved **workspace-relative** to the smallest ancestor directory
containing both, before the request ever reaches the seam — the same
resolution `acme-build`'s `source`/`--out-dir` already go through. `--name`
is passed straight through, never resolved as a path; a value beginning
with `-` is refused by the seam before any child process is spawned (it
would otherwise be read as a flag by `c1541`'s own CLI).

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

Same response shape as `dir`; `results[0].path` names a file carrying one
per-sector allocation row per track (a run of `*`/`.` characters, `*` for
an allocated sector).

## One directory entry's raw fields

```bash
node $S entry --image game.d64 --name FILENAME --json
```

`results[0].path` names a file carrying the entry's raw 32-byte directory
record (as a hex dump) followed by its `T/S: <t>/<s>, <n> blocks` summary
line. This script ALSO parses that line back and adds `firstTrack`/
`firstSector` as numeric fields on the JSON response, purely for display —
the file itself is still the authoritative source.

## A named file's sector chain

```bash
node $S chain --image game.d64 --name FILENAME --json
```

`results[0].path` names a file listing every `(track,sector)` hop the file
occupies, in order. A single-sector file's chain shows one hop with no
second tuple on the arrow's right side; a multi-sector file's chain repeats
the tuple at every hop.

## Extracting a named file's bytes

```bash
node $S read --image game.d64 --name FILENAME --out-dir /scratch --json
```

Writes the file's raw bytes (unlike the other four capabilities, this one
is NOT a captured-stdout listing — `c1541` writes the output file itself).
`results[0]` carries that file's `path`/`sha256`/`byteLength`.

## Failure shape

A nonexistent image, a nonexistent named entry, or any other call `c1541`
cannot service is reported as `{"ok":false,"message":"..."}` with a
non-zero exit code — **never** a success envelope over an empty or partial
result. `c1541` itself exits `0` even on a genuine failure (it prints its
own `Error - ...` lines to stdout instead); the seam's own classifier, not
the exit code, is what decides success here.

## What this skill does NOT do

- **No mutating verb.** `-format`/`-write`/`-bwrite`/`-delete` are never
  reachable from this script, on the wire, or anywhere in this skill's tree
  — only the five read-only capabilities above are exposed.
- **No direct binary spawn.** `c1541` runs host-side; this script only ever
  constructs a typed request and reads the produced files back off the
  shared workspace tree — the host-tool execution seam is the only route.
- **No backend declaration.** This skill names no VICE emulator tool at
  all — it is silent on fork vs. stock by construction.
