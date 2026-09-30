---
name: c64-disk
description: Read a Commodore .d64 disk image with VICE's own c1541 disk tool. It reads the directory, the block allocation map, and the sector chain or raw bytes of a named file. It also audits the directory for fabricated or corrupted entries. Use when asked to list what a disk image contains, or to check the free blocks or block allocation map of a disk. Use when asked to trace which sectors a named file occupies, or to extract the raw bytes of a named file from a .d64. Also use when asked to check if the directory entries of a disk are genuine. Examples are a cracker-fabricated filename, a corrupted first track/sector, or a cyclic directory chain.
---

# Reading C64 disk images with c1541

**Never write to a disk image.** Every verb here only reads. The script has
no verb that can change a `.d64`.

Six verbs, one script, one binary (`c1541`). The broker runs `c1541` on the
host. `c64-project` describes that connection.

```bash
S=skills/c64-disk/scripts/c1541.ts   # from the repo root

node $S bam   --image path/to/image.d64                    # block allocation map
node $S dir   --image path/to/image.d64                    # what's on the disk
node $S entry --image path/to/image.d64 --name FILENAME     # one directory entry's raw fields
node $S chain --image path/to/image.d64 --name FILENAME     # a named file's sector chain
node $S read  --image path/to/image.d64 --name FILENAME     # extract a named file's bytes
node $S audit --image path/to/image.d64                     # find fabricated/corrupted directory entries
```

The script wraps `c1541` and nothing else. `bam`, `dir` and `audit` need only
`--image`. `entry`, `chain` and `read` also need `--name`, a CBM filename or
glob pattern. A `--name` is never a path. No `-format`, `-write`, `-bwrite` or
`-delete` verb is available here. This is deliberate: this skill only reads a
disk image.

Options: `--image PATH` `--name CBM-NAME` `--out-dir DIR` `--json`.

The default `--out-dir` is the directory of the image, the same default that
`c64-assembler` uses. The script resolves `--image` and `--out-dir` against
the current working directory. The seam sends `--name` to `c1541`
unchanged and never resolves it as a path. The seam refuses a value that
starts with `-` before it starts a child process. Otherwise the CLI of
`c1541` would read that value as a flag.

## Directory listing

```bash
node $S dir --image game.d64 --json
```

The script prints the response of the seam, unchanged, as one line of JSON:

```json
{"ok":true,"tool":"c1541.dir","exitStatus":0,"results":[{"path":"/abs/path/game.dir.txt","sha256":"...","byteLength":123}],"stderrTail":""}
```

`results[0].path` is the listing file that the seam wrote. It holds the
`-dir` output of `c1541`, captured and digested.

## Block allocation map

```bash
node $S bam --image game.d64 --json
```

The response has the same shape as for `dir`. The file at `results[0].path`
has one row for each track, with one character for each sector. `*` is an
allocated sector and `.` is a free sector.

## One directory entry's raw fields

```bash
node $S entry --image game.d64 --name FILENAME --json
```

The file at `results[0].path` holds the raw 32-byte directory record of the
entry, as a hex dump. A `T/S: <t>/<s>, <n> blocks` summary line follows the
record. The script also reads that line and adds `firstTrack` and
`firstSector` as numeric fields to the JSON response. These fields are only
for the reader. The file stays the authoritative source.

## A named file's sector chain

```bash
node $S chain --image game.d64 --name FILENAME --json
```

The file at `results[0].path` lists each `(track,sector)` hop of the file, in
order. The chain of a single-sector file shows one hop, with no second tuple
on the right side of the arrow. The chain of a multi-sector file shows the
tuple at each hop.

## Extracting a named file's bytes

```bash
node $S read --image game.d64 --name FILENAME --out-dir /scratch --json
```

This verb writes the raw bytes of the file. It is different from `dir`,
`bam`, `entry` and `chain`: `c1541` writes the output file itself, and the
seam does not capture stdout. `results[0]` holds the `path`, `sha256` and
`byteLength` of that file.

## Auditing for fabricated or corrupted entries

```bash
node $S audit --image game.d64 --json
```

`audit` combines `dir` (names and block counts) and `bam` (the per-sector
allocation map). For each name, it also calls `entry` one time. That call
gives the first track/sector that the file claims, and the "next directory"
pointer of its directory sector. Together these calls are a read-only
detector. It has no mutating verb and no seventh `host_tool` id. It is three
existing verbs, combined in the script.

`audit` marks a directory entry `suspicious`, always with **named reasons,
never only a boolean**, when one of these conditions is true:

1. Its block count is `0`.
2. Its first track/sector is outside the geometry of the image. That track
   does not exist, or that sector does not exist on that track.
3. The allocation map shows its first **sector** as free, not only its whole
   track. So the file cannot really start there. This check is more precise
   than a check of the whole track, because the per-sector map is available.

A directory chain is cyclic or self-referential in two cases: two entries
claim the same first track/sector, or a "next directory" pointer points back
to a sector already seen. That sector can be the start sector of the
directory. All entries in one directory sector share the same pointer. So
the same pointer on consecutive entries is one sector, not a repeat. In both cases the command does not loop. It reports a top-level
`chain_error` that names the repeated pointer. Then it audits all remaining
entries. A chain error on one entry never hides an independent flag on a
different entry.

```json
{"ok":true,"entries":[{"name":"basicstub","blocks":1,"first_track":17,"first_sector":0,"suspicious":false,"suspicious_reasons":[]}],"chain_error":null}
```

**A flag is a signal to investigate, not a verdict.** Three causes can give a
flag: a directory entry that a cracker fabricated for a file that was never
written, a genuinely corrupted image, and (rarely) an unusual but legitimate
disk layout. The command reports what it finds, with names. The person who
examines the disk decides what it means.

## Failure shape

The seam reports a nonexistent image, a nonexistent named entry, or any other
call that `c1541` cannot do as `{"ok":false,"message":"..."}` with a non-zero
exit code. It **never** reports a success envelope with an empty or partial
result. `c1541` itself exits `0` also on a genuine failure. It prints its own
`Error - ...` lines to stdout. So the classifier of the seam decides success,
not the exit code.

The last line on stdout is always the JSON result. Without `--json`, text
lines come first. A missing `--image`, or a missing `--name` for `entry`,
`chain` or `read`, gives `{"ok":false,"message":"usage: …"}` and exit code
1. The script does not call the seam in that case. `audit` fails as a whole
when its `dir` call or its `bam` call fails, and it gives that refusal
unchanged. It also fails when the listing has no file entry or the
allocation map has no track row: an empty listing is not a clean disk. A failed `entry` call for
one name does not stop the audit. The audit records that entry with the
refusal as its reason.

## What this skill does NOT do

- **No mutating verb.** `-format`, `-write`, `-bwrite` and `-delete` are not
  available from this script, on the wire, or anywhere in the tree of this
  skill. The skill has only the six read-only verbs above.
- **No direct binary spawn.** `c1541` runs on the host, through the broker
  (see `c64-project`). The script needs a running broker.
- **No emulator.** The skill works on files only. Attaching a disk to a
  running C64 is `c64-emulator`.
- **No program analysis.** Detokenizing an extracted BASIC file is
  `c64-basic`. Checking an extracted file for packing is `c64-unpacker`.
  Deciding which bytes a cracker changed is `c64-provenance`.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `usage: entry --image <path.d64> --name <cbm-name> [--out-dir <dir>] [--json]` in the `message` | `entry`, `chain` and `read` need `--name`, a CBM filename or glob, never a path. |
| `"suspicious":true` on an `audit` entry | A signal to investigate, not a verdict. Read its `suspicious_reasons`. |
