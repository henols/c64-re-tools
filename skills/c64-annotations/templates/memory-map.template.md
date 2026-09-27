# The memory-map provenance sidecar

`anno render-memmap` writes the memory map from the workspace's annotation
project. Do not write the map by hand. `../SKILL.md` ("Render the memory map")
tells how to run the verb and how `--check` finds drift.

This file gives the schema of the one input that the verb needs in addition
to the project: the provenance sidecar. `../SKILL.md` ("Confidence prefixes")
gives the five confidence tokens that the project comments carry.

## The provenance sidecar

Some facts belong to the **run**, not to an address. Examples are the capture,
the value of `$01` and the video standard. The project has no address-keyed
place for these facts. Thus you give them to the renderer in a small JSON
sidecar.

Write the sidecar by hand, from the output of `c64-ram-capture` and of
`c64-memory-map`'s `derive.ts`. The renderer checks every key. A missing or
malformed key is a named error, and the error lists all problems at one time.
The renderer never writes a `<placeholder>` into the map.

| Key | Type | Where it comes from |
|---|---|---|
| `capturePath` | string | The path to the captured 64K image, as given to `c64-ram-capture` |
| `captureSha256` | string, 64 hex chars | The `sha256` from `c64-ram-capture`'s `compare.ts digest`. It proves which image the map describes |
| `port01` | string | The `$01` value from `derive.ts vectors` |
| `dd00` | string | The `--dd00` input of `derive.ts vic`, that is the observed `$DD00` |
| `vicBank` | string | `derive.ts vic`: the VIC bank from `$DD00` bits 0-1, inverted |
| `screenRam` | string | `derive.ts vic`: the screen RAM from `$D018` bits 4-7 |
| `charsetOrBitmap` | string | `derive.ts vic`: the charset or bitmap from `$D018` bits 1-3 (note the char-ROM shadow case) |
| `mode` | string | `derive.ts vic`: the graphics mode from `$D011` bits 5-6 and `$D016` bit 4 |
| `videoStandard` | `"PAL"` or `"NTSC"` | The origin and hardware of the capture |
| `liveVectorPair` | string | `derive.ts vectors`: the live vector pair (`$0314/$0315` or `$FFFE/$FFFF`) |
| `vectorHandler` | string | The address that the live vector pair points to, seen live at a checkpoint |
| `rasterPositions` | string array, optional | One entry for each observed `$D012` write on the way out of the live IRQ handler. Use `derive.ts sprites` where sprite coordinates are important |

A full example. Copy its shape. Do not copy its values.

```json
{
  "capturePath": "captures/game.raw",
  "captureSha256": "3f8a1c9e2b7d4a6f0c5e8b2d9a1f4c7e6b3d0a9c8f5e2b1d4a7c0f3e6b9d2a5c",
  "port01": "$40",
  "dd00": "$06",
  "vicBank": "1 ($4000-$7FFF)",
  "screenRam": "$0400",
  "charsetOrBitmap": "$1000 (ROM shadow)",
  "mode": "text, multicolor off",
  "videoStandard": "PAL",
  "liveVectorPair": "$FFFE/$FFFF",
  "vectorHandler": "$1103",
  "rasterPositions": ["$F8", "$00"]
}
```

The rendered file has a banner that names the sidecar and a content digest.
Do not remove the banner.
