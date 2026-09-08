---
name: c64-disk-access
description: Read a Commodore .d64 disk image's directory, block allocation map, a named file's sector chain, or a named file's raw bytes, using VICE's own c1541 disk tool as the reference implementation. Use when asked to list what a disk image contains, check a disk's free blocks or block allocation map, trace which sectors a named file occupies on disk, or extract a named file's raw bytes from a .d64.
---

# Reading C64 disk images with c1541

Read-only. Four capabilities, one script, one binary (`c1541`) reached only
through the host-tool execution seam:

```bash
S=src/skills/c64-disk-access/scripts/c1541.mjs   # from the repo root

node $S dir   --image path/to/image.d64                       # what's on the disk
```

The script wraps `c1541` and nothing else — **read-only**. No `-format`,
`-write`, `-bwrite` or `-delete` verb is reachable from here, deliberately:
this skill only ever reads a disk image, never mutates one.

Options: `--image PATH` `--out-dir DIR` `--json`.

`--out-dir` defaults to the image's own directory, exactly like
`acme-build`'s own `--out-dir` default. Both `--image` and `--out-dir` are
resolved **workspace-relative** to the smallest ancestor directory
containing both, before the request ever reaches the seam — the same
resolution `acme-build`'s `source`/`--out-dir` already go through.

## Directory listing

```bash
node $S dir --image game.d64 --json
```

Prints the seam's response verbatim as one line of JSON:

```json
{"ok":true,"tool":"c1541.dir","exitStatus":0,"results":[{"path":"/abs/path/game.dir.txt","sha256":"...","byteLength":123}],"stderrTail":""}
```

`results[0].path` names the listing file the seam wrote — `c1541`'s own
`-dir` output, captured and digested. A nonexistent image, or any other
call c1541 cannot service, is reported as `{"ok":false,"message":"..."}`
with a non-zero exit code — **never** a success envelope over an empty or
partial listing. `c1541` itself exits `0` even on a genuine failure (it
prints its own `Error - ...` lines to stdout instead); the seam's own
classifier, not the exit code, is what decides success here.

## What this skill does NOT do

- **No mutating verb.** `-format`/`-write`/`-bwrite`/`-delete` are never
  reachable from this script, on the wire, or anywhere in this skill's tree.
- **No direct binary spawn.** `c1541` runs host-side; this script only ever
  constructs a typed request and reads the produced files back off the
  shared workspace tree — the host-tool execution seam is the only route.
- **No backend declaration.** This skill names no VICE emulator tool at
  all — it is silent on fork vs. stock by construction.
