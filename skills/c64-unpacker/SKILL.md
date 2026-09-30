---
name: c64-unpacker
description: Decide if a C64 binary is packed, crunched or compressed. Name the packer only when the external unp64 identifier states it, and get the depacked image by a run past the decrunch. Use when asked if a binary is packed, crunched or compressed, or which packer a program uses. Use when asked to depack, decrunch or unpack a C64 program, to find the depacker, or to run an entropy check on a .prg.
---

# Detecting and depacking a packed C64 binary

**Do not annotate or trace a packed image.** On a packed image you document
the decruncher, not the program. Each label that you write is lost when you
recover the real image. Run this check before you look for an entry point or
write any annotation.

```bash
S=skills/c64-unpacker/scripts/packer-finding.ts   # from the repo root

node $S game.prg                  # measure entropy from the file
node $S game.prg --entropy 7.83   # use an entropy value you already have
```

The script prints one JSON object, the packer finding for the file. It never
changes the file.

## The gate

The packedness threshold is **7.5**. Shannon entropy over bytes goes from 0.0
to 8.0. An entropy **at or above** 7.5 means that the bytes are very probably
compressed, encrypted or random. This is the only threshold. Use the
`verdict` from the script as the only gate:

| Verdict | Meaning | Do this |
| --- | --- | --- |
| `identified` | The external identifier stated the packer name, verbatim. `packer` holds it. `confidence` is `HIGH`. | Record the name as a finding. Then depack the image (see below). |
| `packed-unidentified` | Entropy is at or above 7.5 and **no identifier named the packer**. `packer` is `null`. | Treat the image as packed. Depack it. Do not annotate these bytes. Do not look for a name. |
| `unpacked` | Entropy is below 7.5. This is not an identity claim. It says only that the bytes do not look compressed. | Continue on this image. |
| `unknown` | No route gave an answer. `unavailableReason` always says why. | Continue, but record the unknown. Never write it as "not packed". |

`identified` and `packed-unidentified` stop the work on this image. The other
two let it continue.

The script walks an ordered chain. The first route that answers wins:

1. **The external identifier (`unp64`).** This is the only route that can
   name a packer. If it runs and names nothing, the chain continues.
2. **The entropy gate.** It answers packedness only, never a name. It uses
   `--entropy` when you give it. Otherwise it measures Shannon entropy over
   the bytes of the file. Its `confidence` is `MEDIUM`.
3. **An explicit unknown**, with `confidence` `LOW` and a reason.

**Where to get `--entropy`.** `anno_get_binary_info` reports the same
quantity for a loaded image. Its tool description gives the same 7.5
threshold. To run it, use `c64-annotations`.

## A name comes only from the identifier

**This project never guesses a packer name.** No first-party route on this
project's surface reports a packer name. No code path here can write a name
from entropy, from a decompression address, or from a byte pattern. The
`packer` field is set at one place only, from the verbatim output of the
identifier.

To get a name when the finding has none, install `unp64` on the **host**. Set
`UNP64` or `UNP64_PATH` to its path in the environment of the **host broker
process**. The file name of that path must be `unp64`, or the seam treats the
identifier as absent. The script reaches the identifier only through the
broker (see `c64-project`). It never starts `unp64` itself.

The environment of this script is not used to find the identifier. If you set
`UNP64` or `UNP64_PATH` here, the script only adds a hint to the reason when
the identifier is absent. It cannot select what the host runs.

The parser for the output of the identifier accepts a line that starts with
`packer:`, `detected packer:` or `detected:`, followed by the name. This
marker set is an assumption. No one measured it against a real `unp64` run.
A name must start with a letter or digit, and it can have at most 64
characters.

## Depacking

Depack by a run and a capture. Do not unpack in place:

1. Run the program in the emulator (`c64-emulator`).
2. Stop it at a checkpoint after the decrunch. At that point the
   decompression stub has run one time.
3. Capture RAM at that checkpoint (`c64-ram-capture`).
4. Start again with this gate on the captured image.

The PC at the decrunch checkpoint is the entry point of the depacked image.
There is no BASIC stub to find there.

An in-place unpack would delete the comments, labels and blocks that the
annotation project already holds. The run-and-capture route gives the same
image and keeps them.

## Failure shape

The script prints one line of JSON as its last output. On success the object
has `"ok": true` and the fields of the finding, with exit 0:

```json
{
  "ok": true,
  "packer": null,
  "verdict": "unpacked",
  "confidence": "MEDIUM",
  "route": "entropy-only",
  "evidence": [
    { "source": "unp64", "available": false, "version": null, "reason": "vice: no broker answered …" },
    { "source": "local-shannon-entropy", "entropy": 1.58, "threshold": 7.5 }
  ],
  "checkedAt": "2026-09-27T10:15:27.338Z",
  "unavailableReason": "no name is claimed: the entropy gate places these bytes below its packedness threshold, …"
}
```

- `route` is `unp64`, `entropy-only` or `none`.
- `evidence` lists each route that the chain tried. The `source` of an
  entropy entry is `caller-supplied` (from `--entropy`) or
  `local-shannon-entropy`.
- `unavailableReason` is set whenever `packer` is `null`. It is never empty
  for `unknown`.
- An absent identifier or a broker that is not running is not a failure. The
  reason goes into the first `evidence` entry, and the chain continues to the
  entropy gate.
- An empty file gives no entropy measurement. Without an identifier the
  verdict is then `unknown`.

The script gives `{"ok": false, "message": "..."}` and exit code 1 only for
bad input. `--help` or `-h` gives `{"ok": true, "usage": "..."}` and exit
code 0.

| `message` | Cause |
| --- | --- |
| The usage text | No file given. |
| `packer-finding: could not read <file>: <error>` | The file is missing or unreadable. |
| `packer-finding: --entropy must be a number, got "<value>"` | The value is not a plain decimal number. `7.8abc` is refused. |
| `packer-finding: --entropy needs a value, …` | The flag has no value. |

## What this skill does NOT do

- **No packer name from inference.** Only the external identifier supplies a
  name.
- **No in-place unpack.** Depacking is a run and a capture, done with
  `c64-emulator` and `c64-ram-capture`.
- **No tool install.** You install `unp64` on the host yourself.
- **No annotation writes.** Recording the finding in the annotation project is
  `c64-annotations`.
- **No disassembly.** Disassembling the depacked image is `c64-disassembler`.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `"packer": null` with `"verdict": "packed-unidentified"` | The image is packed. Depack it by a run and a capture. Do not infer a name. |
| `"available": false` with `vice: no broker answered …` in `evidence` | The broker is not running, so the identifier was not asked. Start the broker by hand (see `c64-project`) if you need a name. The entropy verdict is still valid. |
| `… is set in this container-side environment, but it is not consulted …` | Set `UNP64` or `UNP64_PATH` in the environment of the host broker process, not of this script. |
| `packer-finding: --entropy must be a number, got "<value>"` | Give a decimal number, for example `--entropy 7.83`. |
| `"verdict": "unknown"` | Read `unavailableReason`. Record the unknown. Never report it as "not packed". |
