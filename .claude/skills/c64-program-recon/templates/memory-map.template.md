# Memory map generation

**The memory map is GENERATED, not hand-authored (D-24).** The store — labels, comments, block
types and scopes written through the `r2000_*` tools described in `../SKILL.md` — is canonical. This
file used to be a fill-in-the-rows document; it is now the schema for the one input the generator
needs beyond the store itself, plus the confidence vocabulary that store comments carry.

Run the generator once findings are in the store:

```bash
npx -y @henols/vice-mcp r2000 render-memmap game.regen2000proj --provenance sidecar.json
node <plugin-root>/.claude/mcp/vice/vice-proxy.ts r2000 render-memmap game.regen2000proj --provenance sidecar.json
```

Add `--check` to compare the rendered file on disk against a fresh render — it exits non-zero and
prints the first differing line on **either** a hand edit to the rendered file **or** a store change
since it was last rendered. There is no way to "fix" drift by editing the rendered file directly:
the fix is always to re-run the generator (or, if the sidecar itself is stale, correct it and
re-run). The generated file carries a banner naming the store, the sidecar and a content digest —
do not strip it.

## The provenance sidecar

Some facts belong to the **run** (which capture, which `$01`, which video standard) rather than to
any address, and the store has no address-keyed shape for them (D-27). They are supplied to the
renderer as a small JSON sidecar, hand-authored from `c64-ram-capture`'s and `derive.mjs`'s own
outputs and validated by the renderer — a missing or malformed key is a named error listing every
problem at once, never a `<placeholder>` silently rendered into a published document.

| Key | Type | Where it comes from |
|---|---|---|
| `capturePath` | string | The path to the captured 64K image, as given to `c64-ram-capture` |
| `captureSha256` | string, 64 hex chars | `compare.mjs digest`'s `sha256` — proves which image the map describes |
| `port01` | string | `derive.mjs vectors`' `$01` value |
| `dd00` | string | `derive.mjs vic`'s `--dd00` input, i.e. the observed `$DD00` |
| `vicBank` | string | `derive.mjs vic` — VIC bank derived from `$DD00` bits 0-1, inverted |
| `screenRam` | string | `derive.mjs vic` — screen RAM derived from `$D018` bits 4-7 |
| `charsetOrBitmap` | string | `derive.mjs vic` — charset/bitmap derived from `$D018` bits 1-3 (note the char-ROM shadow case) |
| `mode` | string | `derive.mjs vic` — graphics mode derived from `$D011` bits 5-6 and `$D016` bit 4 |
| `videoStandard` | `"PAL"` or `"NTSC"` | Known from the capture's origin/hardware context |
| `liveVectorPair` | string | `derive.mjs vectors` — the live vector pair (`$0314/$0315` or `$FFFE/$FFFF`) |
| `vectorHandler` | string | The address the live vector pair points at, confirmed live at a checkpoint |
| `rasterPositions` | string array, optional | One entry per observed `$D012` write on the way out of the live IRQ handler; `derive.mjs sprites` where sprite coordinates are relevant |

A fully-filled example, with plausible values in place of placeholders — copy this shape, never the
literal values:

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

## Confidence vocabulary

Every comment written into the store through `r2000_set_comment` that grades a finding leads with
one of these five bracket tokens (the parser in `r2000-confidence.ts` throws on anything that is
close but not exact — a typo never silently degrades into an ungraded comment):

| Grade | Bracket token | Means |
|---|---|---|
| **confirmed code** | `[confirmed-code]` | Executed during tracing, PC observed inside it |
| **probable code** | `[probable-code]` | Reachable through a `JSR`/`JMP`/vector, not yet observed executing |
| **confirmed data** | `[confirmed-data]` | Never hit as an instruction stream across full gameplay coverage |
| **probable data** | `[probable-data]` | Indexed-load target, or matches a data shape (sprite blocks, PETSCII, address tables) |
| **unknown** | `[unknown]` | No reliable interpretation yet |

Do not force an unknown range through a disassembler and record the output as code. A linear
decode of data is silently wrong and contaminates everything downstream.

**Do not promote a row by editing its grade.** Re-verify and restate the evidence with a fresh
`r2000_set_comment` call, so the record of when something stopped being a guess survives.
