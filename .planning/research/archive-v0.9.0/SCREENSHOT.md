# Client-Side Screenshot Encoding: Placement and Approach

**Milestone:** v0.2.0 switchable stock-VICE backend
**Requirement served:** "Screenshots are produced on the stock backend by encoding the framebuffer client-side"
**Researched:** 2026-08-12
**Overall confidence:** HIGH (VICE C source read directly; encoder prototyped, round-trip validated, and benchmarked; npm metadata pulled live from registry.npmjs.org)

---

## Recommendation (one paragraph)

Encode **container-side, in the MCP server, with a hand-rolled ~50-line indexed-PNG
writer that depends on nothing but `node:zlib`.** Container-side is forced by the data
flow: the binary-monitor TCP connection is dialed *from* the container (same direction as
today's HTTP, via `mcpHost()`), so the `DISPLAY_GET` framebuffer lands container-side and
the host broker never sees emulator protocol bytes at all. Zero-dependency is not a
compromise here but the *better* engineering answer, because `DISPLAY_GET` returns palette
indices plus `PALETTE_GET` returns the palette — which is exactly PNG colour type 3's
native on-disk form. Every npm encoder either cannot write colour type 3 at all (`pngjs`,
verified) or drags in extra packages to do what 15 lines of `node:zlib` already does. The
prototype produces byte-valid output within 1.5% of `fast-png`'s size at 2.2 ms/frame
worst case. Keep returning a **file path** (the fork's manifest already declares both
`path` and `return_base64`, so parity requires both), write the file to the *container*
path directly — which **retires the screenshot host-path translation entirely** — and
default to the **full frame including border**, because cropping is not actually available
from the protocol fields the way the milestone context assumes.

---

## 1. Placement: container-side. Not close.

### The data flow, from this codebase

`.planning/codebase/ARCHITECTURE.md` and the source establish three separate facts that
together settle this:

**(a) The emulator connection is dialed from the container, outbound to the host.**
`vice.ts`'s `mcpHost()` returns `host.docker.internal` in a container and `127.0.0.1`
otherwise; `call()` does the round trip. `PROJECT.md`'s Architecture constraint says the
backend swap happens *behind `vice.ts`'s `call()` seam* — i.e. TCP to the binary monitor
replaces HTTP to the fork's `/mcp`, but the direction and the owning process are
unchanged. `probe-binmon.mjs` already demonstrates this shape: plain `node:net`, dialing
`host:port`.

**(b) The host broker is a process supervisor, not a data path.** Per ARCHITECTURE.md's
broker layer and the `broker-*.mts` sources, the broker owns port allocation, warm floor,
crash supervision, and a TCP *control* protocol for acquire/release/recycle. It never
carries emulator protocol payloads. That is precisely *why* it can be dependency-free —
it is a `child_process.spawn` wrapper, not a client.

**(c) Screenshot files land inside the bind-mounted workspace, and the reader is
container-side.** `gatherWedgeEvidence()` writes to
`incidentAssetPath({ ext: "png" })` → `.planning/incidents/<stem>.png`, and records
`relative(repoRoot(), screenshotContainerPath)`. The consumer is Claude (in-container) and
the incident record markdown (in-container). Nothing host-side ever reads the PNG.

### Therefore

The `DISPLAY_GET` reply — `debug_width × debug_height` index bytes, ~104 KB for the
default PAL geometry — is delivered into the container-side process. Encoding there is
zero additional plumbing.

Host-side encoding would require *all* of:

| Requirement | Cost |
|---|---|
| A host-side binary-monitor client | Duplicate the whole protocol client, dependency-free, in `.mts` |
| A new broker control-protocol verb (`screenshot`) | Extends `broker-control.mts`'s command surface, which exists for lease management only |
| A new entry in `HOST_BOUND_ARTIFACTS` (`build.ts:42`) | Build asserts the emitted set matches *exactly*; every addition is a deliberate widening of the host-bound surface |
| Host→container path translation of the result | Reintroduces the translation that container-side encoding *removes* |
| Dependency-free encoding anyway | The host constraint applies regardless — so host placement buys nothing on the dependency question |

Host-side is strictly dominated. **Container-side, in the MCP server.**

### The bonus: this retires a translation and an untestable seam

Today `vice-sync.ts`'s `screenshot()` must translate the container path to a *host* path,
because **VICE itself** writes the file, host-side:

> `vice-sync.ts:319` — "VICE writes screenshots itself, on the HOST -- so the path handed
> to `vice_display_screenshot` must be a host path... Passing the container path silently
> fails with 'Failed to save screenshot'."

It does this through `tryHostPaths()`'s candidate ladder, and the codebase records the
result as **not unit-testable**:

> `vice-sync.test.ts:142` — todo: "requires a real emulator (`vice_display_screenshot`
> writes host-side) -- `mcp__vice__*` is the only permitted route"

With client-side encoding, the container holds the PNG bytes and writes them to the
container path with `writeFileSync`. **No host path is involved, so no translation, no
candidate ladder, and no untestable seam.** The file still lands in the bind-mounted
workspace, so a host-side reader would find it if one ever existed. This is a genuine
architectural simplification that falls out of the migration for free, and it is worth
calling out in the phase plan as an acceptance criterion rather than letting it happen by
accident.

### Implementation hazard: `rewriteArguments()` runs *inside* the transport path

This is easy to miss and will silently produce wrong behaviour.

`rewriteArguments()` is called at `vice-proxy.ts:2773`, **inside `forwardToVice()`** — i.e.
*after* dispatch but *before* `call()`. `vice_display_screenshot.path` is one of exactly
four manifest-declared path arguments (`vice-proxy.ts:1672`), so on the way to `call()` the
container path is rewritten to a **host** path.

If the stock screenshot is implemented behind the `call()` seam, it will receive a host
path and `writeFileSync` it from inside the container — writing to a path that does not
exist, or worse, to a coincidentally-valid wrong one.

**Resolution:** the stock screenshot must be a *derived* tool intercepted **before**
`forwardToVice()`, alongside the existing precedent of `handleResultContinue()` ("served
entirely inside this proxy; NEVER reaches `call()` or the network", `vice-proxy.ts:1955`).
This is consistent with the milestone's own framing — it composes multiple primitives
(`DISPLAY_GET` + `PALETTE_GET`) plus local computation, exactly like the client-side
memory search, disassembler, and sprite decode already in scope as "group B" derivations.
`CONCERNS.md`'s warning applies: put it in a **sibling module**, not appended to
`vice-proxy.ts`.

**Second breakage site, same cause:** `gatherWedgeEvidence()` (`vice-proxy.ts:1347-1350`)
*explicitly* calls `rewriteArguments()` itself, then `call()`, precisely because it bypasses
`forwardToVice()`:

```ts
const { args: translated } = rewriteArguments({ path: screenshotContainerPath }, "vice_display_screenshot");
await call("vice_display_screenshot", translated);
```

On the stock backend that pre-translation must **not** happen. This call site needs a
backend-aware branch or, better, needs to route through the same derived-tool helper the
public tool uses. Its own comment ("Skipping this would write the file to a host path that
does not exist and return a success the record would then be lying about") inverts exactly
on the stock backend — *performing* it becomes the bug. Flag this line in the phase plan.

**Confidence:** HIGH — read directly from the source at the cited lines.

---

## 2. Encoding with dependencies (assessed, then rejected)

All figures pulled live from `registry.npmjs.org` on 2026-08-12.

| Package | Latest | Published | License | Native? | Unpacked | Deps | Writes colour type 3 (indexed)? | TS types | ESM |
|---|---|---|---|---|---|---|---|---|---|
| `pngjs` | 7.0.0 | 2023-02-20 | MIT | No (pure JS, uses `node:zlib`) | 635 KB | none | **NO — throws** | `@types/pngjs` 6.0.5 (2024-05-02), separate | CJS only, no `exports` |
| `fast-png` | 8.0.0 | 2025-12-18 | MIT | No (pure JS, `fflate`) | 159 KB | `fflate` 0.8.3 (MIT), `iobuffer` 6.0.1 (MIT) | **YES — verified** | ships `.d.ts`, resolves via `exports` | `"type": "module"` |
| `sharp` | 0.35.3 | 2026-07-01 | Apache-2.0 | **YES — 25 prebuilt platform packages** | 936 KB + ~10 MB libvips | `@img/colour`, `detect-libc`, `semver` | Only via quantisation from RGBA | bundled `.d.mts` | dual |
| `@napi-rs/canvas` | 1.0.5 | 2026-08-09 | MIT | **YES — 11 platform packages** | 122 KB + per-platform binary | none | No — canvas rasteriser, RGBA in/out | bundled `.d.ts` | CJS |
| `upng-js` | 2.1.0 | **2017-12-12** | MIT | No | — | `pako` (2.4 MB) | Via quantisation from RGBA | none | CJS |
| `@cwasm/lodepng` | 0.1.9 | 2025-11-05 | MIT | WASM (no toolchain) | 72 KB | `@canvas/image-data` | No — RGBA path | `.d.ts` | CJS |
| `node-libpng` | 0.2.20 | **2021-07-05** | MIT | **YES — `gypfile: true` + install script** | 1000 KB | deprecated `request` | — | none | CJS |

### The decisive technical finding: `pngjs` cannot write indexed PNGs

Verified by reading the shipped `pngjs@7.0.0` tarball, `lib/packer.js` lines 31–42:

```js
if ([ constants.COLORTYPE_GRAYSCALE,      // 0
      constants.COLORTYPE_COLOR,          // 2
      constants.COLORTYPE_COLOR_ALPHA,    // 6
      constants.COLORTYPE_ALPHA           // 4
    ].indexOf(options.colorType) === -1) {
  throw new Error("option color type:" + options.colorType + " is not supported at present");
}
```

`COLORTYPE_PALETTE_COLOR: 3` is defined in `lib/constants.js` (and `TYPE_PLTE` exists) but
only for the **decoder**. The most popular, most obvious candidate — 51.5 M downloads/week —
would force expanding a 104 KB index buffer into **408 KB of RGBA** (384 × 272 × 4) and
deflating 4× the bytes, to produce a visually identical image in a larger file. That is the
opposite of what this data shape wants.

### Native bindings: a real portability liability here (quality gate)

This plugin is delivered by `npx @henols/c64-re-tools` and `npx @henols/vice-mcp` to
arbitrary developer machines, and container-side deps are installed by a `SessionStart`
hook running `npm ci` (`scripts/ensure-mcp-deps.sh`, gated on a `sha256sum` of the
lockfile). Against that distribution model:

- **`sharp`** resolves its binary through 25 `optionalDependencies`
  (`@img/sharp-{darwin,linux,linuxmusl,win32,freebsd}-{arm,arm64,x64,ia32,ppc64,riscv64,s390x,wasm32}`
  plus matching `@img/sharp-libvips-*`). The known failure modes are all live for this
  project: `npm ci --no-optional`, a lockfile generated on one platform and installed on
  another, musl/Alpine detection via `detect-libc`, air-gapped/offline installs, and
  corporate registry mirrors that do not proxy optional platform tarballs. Every one of
  those turns into "the `vice` MCP server failed to start" for an end user — the exact
  failure class `ensure-mcp-deps.sh` already prints a warning about. Also ~10 MB of libvips
  to write a 16-colour 384×272 image.
- **`@napi-rs/canvas`** — same class of risk (11 platform packages), and a worse fit: you
  would allocate a canvas, write RGBA pixels, and read them back through a rasteriser.
- **`node-libpng`** — `gypfile: true` **and** an install script, so any unsupported platform
  demands a working C++ toolchain *at install time*. Last published 2021, depends on the
  deprecated `request`. Disqualified outright.

**Native bindings are the wrong shape for an `npx`-distributed plugin. Rule out `sharp`,
`@napi-rs/canvas`, and `node-libpng` on portability alone**, independent of the indexed-PNG
argument.

### Best-in-class if a dependency were taken: `fast-png@8.0.0`

`fast-png` **does** encode colour type 3, verified from the shipped `lib/png_encoder.js`:

```js
function getColorType(data, palette) {          // line 145
  ...
  if (palette) { returnValue.colorType = ColorType.INDEXED_COLOUR; }   // line 163-164
```

reached when `channels === 1 && depth === 8`, with `encodePLTE()` (line 63) writing the
palette and `tRNS` emitted automatically if palette entries carry a 4th alpha component.
API:

```ts
import { encode } from "fast-png";
const png = encode({ width, height, data: indices, depth: 8, channels: 1,
                     palette: [[r,g,b], ...] });   // palette: IndexedColors
```

MIT, pure JS (`fflate` for deflate, both MIT), `"type": "module"`, ships `.d.ts` resolved
through its `exports` map (so it typechecks under this repo's `nodenext` +
`verbatimModuleSyntax` config despite having no top-level `types` field). It is a genuinely
good package and the correct fallback if the hand-rolled encoder is ever rejected.

**Measured against it (see §3), it is 1.5% smaller and costs three extra packages.**

---

## 3. Encoding without dependencies — the recommendation

### Yes: `node:zlib` is sufficient, and Node 22 made it trivial

Two facts turn this from "write a CRC table and hope" into ~50 lines:

1. **`zlib.crc32(data[, value])` exists.** Added in Node **v22.2.0** / v20.15.0
   (nodejs.org/api/zlib.html). This project's floor is Node >= 22.18 (or >= 23.6), so it is
   unconditionally available. It is the CRC-32/ISO-HDLC polynomial PNG specifies — verified
   empirically: `zlib.crc32(Buffer.from("IEND")) === 0xae426082`, the value the PNG spec
   gives for the `IEND` chunk. **No hand-rolled CRC table is needed.**
2. **`zlib.deflateSync()` emits an RFC 1950 zlib-wrapped stream by default** — exactly what
   `IDAT` requires (`IHDR` compression method 0). Verified: output begins `78 9c`.
   (`deflateRawSync` would be *wrong* here — that is RFC 1951, headerless.)

**Confidence:** HIGH — both verified by execution on Node v22.22.0 and against official docs.

### The key insight: the framebuffer needs no conversion at all

`DISPLAY_GET` INDEXED8 gives one **palette index byte per pixel**. `PALETTE_GET` gives the
RGB triples. A PNG with `bit depth 8, colour type 3` stores **one palette index byte per
pixel** and a `PLTE` chunk of RGB triples. The two formats are the same thing.

So the entire encode is: prepend a `0x00` filter byte to each row, `deflateSync` the
result, and wrap four chunks. **The pixel data is copied verbatim. No RGBA expansion, no
quantisation, no colour-space work.** Any RGBA-based encoder does strictly more work to
produce a strictly larger file containing the same image.

### Chunk layout (concrete)

Every chunk: `[length: uint32 BE][type: 4 ASCII][data][crc32(type ‖ data): uint32 BE]`.
Note the CRC covers the **type bytes and the data**, but **not** the length field.

```
89 50 4E 47 0D 0A 1A 0A            PNG signature (8 bytes, fixed)

IHDR  (length 13)
  uint32 BE   width                debug_width, or inner width if cropping
  uint32 BE   height               debug_height, or inner height if cropping
  uint8       bit depth      = 8
  uint8       colour type    = 3   <-- indexed / palette
  uint8       compression    = 0   (deflate; zlib-wrapped)
  uint8       filter method  = 0
  uint8       interlace      = 0

PLTE  (length = 3 * paletteEntries; MUST be 1..256 entries, MUST precede IDAT)
  uint8 r, uint8 g, uint8 b   per entry, in index order

IDAT  (length = deflated size)
  deflateSync( concat over rows y of [ 0x00, ...indices[y*W .. y*W+W] ] )
                ^ per-row filter byte, 0 = None

IEND  (length 0, data empty; crc is always AE 42 60 82)
```

Chunk order is constrained by the spec: `IHDR` first, `PLTE` after `IHDR` and before
`IDAT`, `IEND` last. Nothing else is required.

### Prototype, validated

48 lines (including comments and the JSDoc), written and tested during this research:

```js
import { crc32, deflateSync, constants } from "node:zlib";

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, body) {
  const out = Buffer.allocUnsafe(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 4, "latin1");
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)) >>> 0, 8 + body.length);
  return out;
}

export function encodeIndexedPng({ width, height, indices, palette }) {
  if (indices.length < width * height) throw new Error("short framebuffer");
  if (palette.length === 0 || palette.length > 256) throw new Error("palette must be 1..256 entries");

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 3;   // colour type 3 = indexed
  ihdr[10] = 0;  // compression: deflate
  ihdr[11] = 0;  // filter method 0
  ihdr[12] = 0;  // no interlace

  const plte = Buffer.allocUnsafe(palette.length * 3);
  palette.forEach((c, i) => { plte[i*3] = c.r; plte[i*3+1] = c.g; plte[i*3+2] = c.b; });

  // Raw scanlines: one filter byte (0 = None) + `width` index bytes per row.
  const raw = Buffer.allocUnsafe(height * (1 + width));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width)] = 0;
    Buffer.from(indices.buffer, indices.byteOffset + y * width, width)
      .copy(raw, y * (1 + width) + 1);
  }

  return Buffer.concat([
    SIG,
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("IDAT", deflateSync(raw, { level: constants.Z_BEST_COMPRESSION })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
```

**Validation performed:**

| Check | Result |
|---|---|
| `file(1)` identification | `PNG image data, 384 x 272, 8-bit colormap, non-interlaced` ✓ |
| Round-trip through an **independent** decoder (`fast-png@8.0.0`) | `384x272 depth 8 channels 1`, 16 palette entries ✓ |
| **Pixel-exact** index round trip, all 104,448 pixels | `true` ✓ |
| Palette round trip | exact ✓ |
| Size vs `fast-png` on identical worst-case input | hand-rolled 6,896 B vs fast-png 6,791 B (**1.5% larger**) |
| Encode time, worst case, 384×272 | **2.24 ms/frame** |

### Measured output sizes (bears directly on §5)

| Frame content | 384×272 PNG | as base64 |
|---|---|---|
| Typical screen (border + char-cell pattern) | 700 B | 936 chars |
| Cropped 320×200 inner | 522 B | 696 chars |
| Dense multicolour-ish (4 colours per 4×8 cell) | 3,662 B | 4,884 chars |
| Hires-dither worst realistic (2 colours per 8×8, per-pixel alternation) | 6,896 B | 9,195 chars |
| Pathological true-random 16-colour per pixel (**not achievable on VIC-II**) | 56,807 B | 75,744 chars |

For comparison, RGBA expansion of the same frame is **408 KB in memory before encode**.

### Line-count estimate for the real thing

| Piece | Lines |
|---|---|
| `encodeIndexedPng()` as above | ~48 |
| Palette padding when `maxIndex >= palette.length` | ~6 |
| `DISPLAY_GET` response parser (FL-driven, see §4) | ~20 |
| `PALETTE_GET` response parser (IS-prefixed items) | ~14 |
| Inner-rect crop + geometry table | ~28 |
| **Total** | **~115 lines, one sibling module, zero dependencies** |

Plus a unit test that is *fully offline and deterministic* — synthesise indices, encode,
assert the byte layout and the CRCs. Compare with the current state, where the screenshot
path is explicitly recorded as untestable without a real emulator. That is a second real
win: **this change makes screenshotting unit-testable for the first time.**

### Why zero-dependency wins even though container-side deps are permitted

The container side *may* have deps — but here it should not, because:

1. The data is already in the target format. `fast-png` buys 1.5% file size for 3 packages.
2. `pngjs`, the obvious choice, **cannot do the job at all** — so "just use the popular
   library" leads to a materially worse implementation (408 KB RGBA expansion).
3. Adding any dependency invalidates the `sha256sum` gate in
   `scripts/ensure-mcp-deps.sh`, forcing a fresh `npm ci` at the next `SessionStart` for
   **every existing installed user**. Cheap, but a real one-time cost with a real failure
   mode (the hook prints "tools will be unavailable until it succeeds").
4. `scripts/check-npm-packages.mjs` validates published tarball contents; the fewer moving
   parts in `.claude/mcp/vice/package.json`, the less there is to keep in sync.
5. It matches the codebase's own stated instinct. The broker layer is dependency-free by
   deliberate choice; `probe-binmon.mjs`'s header says "No dependencies; pure Node (net)".
   A 115-line encoder is squarely inside this project's demonstrated taste.
6. **Bonus:** because it depends only on `node:zlib`, the encoder is *also* legal host-side.
   Nothing forces that today, but it means the placement decision is reversible at zero cost
   — worth noting since the alternative (a `sharp`/`fast-png` dependency) would permanently
   nail encoding to the container.

---

## 4. Cropping — the premise in the milestone context is wrong

### Finding: on the C64, `XO`/`YO`/`IW`/`IH` are degenerate. There is nothing to crop to.

The milestone context states DISPLAY_GET "returns an uncropped 'debug' framebuffer plus
inner offset/size describing the visible area". The fields exist, but **VICE never
populates them meaningfully for any machine.**

`raster_screenshot()` in `src/raster/raster.c:552-557` sets:

```c
/* Default values. Should be replaced by the graphics chip screenshot code */
screenshot->debug_offset_x = 0;
screenshot->debug_offset_y = 0;
screenshot->debug_width  = screenshot->max_width & ~3;
screenshot->debug_height = screenshot->last_displayed_line - screenshot->first_displayed_line + 1;
screenshot->inner_width  = screenshot->debug_width;
screenshot->inner_height = screenshot->debug_height;
```

`vicii_screenshot()` (`src/vicii/vicii.c:1420-1430`) calls `raster_screenshot()` and then
sets only `chipid`, `video_regs`, and the memory pointers — it **does not** override the
geometry. Neither does any other chip: greps over `crtc.c`, `vdc.c`, `vic.c`, and `ted.c`
found **zero** assignments to `debug_offset_x`, `inner_width`, or their siblings.

**Consequence, on every VICE machine:**

```
XO = 0,  YO = 0,  IW = DW,  IH = DH
```

Any client logic that crops using `XO`/`YO`/`IW`/`IH` is a **no-op**. Do not write it, and
do not let a phase plan assume it works. Verify against the probe's real output before
committing (`probe-binmon.mjs` already prints `debug WxH, inner WxH`).

### Corollary: there is no black-padding artifact either

`monitor_binary_screenshot_line_data()` (`monitor_binary.c:1183-1227`) contains three
`memset(..., 0x00, ...)` calls that zero-fill the region of the debug buffer outside the
visible area. With `inner_* == debug_*` these all compute to zero length:

- `excess_width  = (width - inner_width) / 2  = 0` (since `width = max_width & ~3 = debug_width = inner_width`)
- `excess_height = (height - inner_height) / 2 = 0`
- `true_offset_x = debug_offset_x - excess_width = 0`, likewise `true_offset_y = 0`
- so `memset(data, 0, true_offset_x)` is 0 bytes, and
  `memset(&data[0 + width], 0, debug_width - width)` is 0 bytes, and the
  `line < true_offset_y || line > true_offset_y + height` guard never fires for
  `line ∈ [0, debug_height)`.

**So the returned buffer is entirely real pixels: the full displayed area including
border, with no padding.** Good news — it means the naive "just encode DW×DH" is correct
and complete.

### What "the border" actually is, and how to control it

The frame size is governed by the **`VICIIBorderMode` resource** (default
`VICII_NORMAL_BORDERS = 0`; values `1` full, `2` debug, `3` none — `src/vicii.h:44-47`,
validated in `vicii-resources.c:set_border_mode`) crossed with `MachineVideoStandard`.
Derived from `vicii-timing.h` constants and
`width = leftborder + 320 + rightborder`, `height = last_displayed_line - first_displayed_line + 1`,
`debug_width = width & ~3`:

| MachineVideoStandard | VICIIBorderMode | DW × DH | Inner 320×200 rect (x, y) |
|---|---|---|---|
| PAL | normal (0, **default**) | **384 × 272** | (32, 35) |
| PAL | full (1) | 404 × 293 | (48, 43) |
| PAL | debug (2) | 504 × 312 | (136, 51) |
| PAL | none (3) | 320 × 200 | (0, 0) |
| NTSC | normal (0) | 384 × 247 | (32, 23) |
| NTSC | full (1) | 420 × 253 | (56, 29) |
| NTSC | debug (2) | 520 × 263 | (136, 31) |
| NTSC | none (3) | 320 × 200 | (0, 0) |
| NTSCOLD | normal (0) | 384 × 247 | (32, 23) |
| NTSCOLD | full (1) | 420 × 253 | (56, 29) |
| NTSCOLD | debug (2) | 512 × 262 | (136, 31) |
| NTSCOLD | none (3) | 320 × 200 | (0, 0) |
| PALN | normal (0) | 384 × 272 | (32, 35) |
| PALN | full (1) | 420 × 293 | (56, 43) |
| PALN | debug (2) | 520 × 312 | (136, 51) |
| PALN | none (3) | 320 × 200 | (0, 0) |

Inner rect derived as `x = screen_leftborderwidth`,
`y = VICII_25ROW_START_LINE (0x33 = 51) - first_displayed_line`, size `320 × 200`
(`VICII_SCREEN_XPIX`/`YPIX`).

Two useful properties:
- **`(DW, DH)` uniquely determines the inner rect.** Where two rows share a `(DW, DH)` key
  (PAL/PALN normal at 384×272; NTSC/NTSCOLD normal at 384×247; NTSC/NTSCOLD full at
  420×253) they also share the same inner rect. So a `(DW,DH) → (x,y)` lookup table is
  sound and needs **no extra round trips**.
- Setting `VICIIBorderMode = 3` via `RESOURCE_SET` (0x52) yields a borderless 320×200
  frame natively. **But** `set_border_mode` defers the change to
  `vsync_on_vsync_do(on_vsync_set_border_mode, ...)` — it takes effect on the *next vsync*
  and mutates global emulator rendering state. Do **not** flip it inside a screenshot call.

### Do C64 reverse-engineers want the border? Yes — and this is the well-attested part

The border is not noise for this audience:

- **Raster/timing work.** Open side/top borders, sprite-over-border tricks, and FLI/AGSP
  effects are *defined* by what happens in the border region. Cropping to 320×200 deletes
  the evidence a raster bug leaves behind.
- **Border colour ($D020) is state.** It is the single most common visual debug channel on
  the C64 — flip `$D020` inside an IRQ to see raster timing. A cropped screenshot silently
  discards it.
- **Wedge triage.** The `vice-wedge-triage` skill and `gatherWedgeEvidence()` capture a
  screenshot as crash evidence. A solid-colour border versus a garbage border is
  diagnostic; so is the border showing a raster split that shouldn't be there.
- **Sprite positioning.** Sprites partially off the visible text area are visible in the
  border.

Against that, the argument for cropping is only "fewer pixels to look at", which is worth
little when the whole frame compresses to under 1 KB anyway.

### Recommendation

**Default: the full frame as returned — `DW × DH`, no cropping.** It is the emulator's own
visible output, it needs no derivation, it cannot be wrong, and it is what the domain
wants.

**Add an optional `crop` parameter** — `"none"` (default) | `"inner"` — implemented from
the `(DW, DH)` lookup table above, **not** from `XO`/`YO`/`IW`/`IH`. If `(DW, DH)` is not
in the table (unknown machine, future VICE geometry change, `x128`/VDC, `xvic`), **return
the full frame plus an explicit note naming the unrecognised dimensions** rather than
guessing a crop. That is this codebase's stated error posture: "never silently produce a
plausible-looking wrong answer" (ARCHITECTURE.md, Error Handling).

Do **not** offer `VICIIBorderMode` manipulation from the screenshot tool. If a user wants a
borderless frame permanently, that is `vice_resource_set` — a separate tool in the
milestone's own "full resource get/set" scope — and it should be their explicit choice, not
a side effect of taking a picture.

---

## 5. Output shape: keep the path. Both shapes are already in the manifest.

### This is a parity requirement, not a design choice

`tools-manifest.json:601-620` already declares:

```json
{ "name": "vice_display_screenshot",
  "description": "Capture screenshot (to file or base64)",
  "inputSchema": { "properties": {
    "path":          { "description": "File path to save screenshot (optional if return_base64=true)" },
    "format":        { "description": "Image format: PNG or BMP (default: PNG)" },
    "return_base64": { "description": "Return screenshot as base64 data URI (default: false)" } } } }
```

`PROJECT.md`'s Compatibility constraint: "The stdio MCP surface Claude sees must not
change — same tool names and shapes across both backends." So the stock backend must
support **both** `path` and `return_base64`. There is no decision to make about which; the
question is only what the *default* is, and the manifest already answers that too:
`return_base64` defaults to `false`, i.e. **path is the default**.

`format` needs a support decision: `DISPLAY_GET` is INDEXED8-only and BMP would be a second
encoder. Recommend **accept `format: "PNG"`, and on `"BMP"` return an explicit
"unsupported on this backend" error** with the per-backend capability annotation the
milestone already requires ("Every tool declares its support level per backend"). Silently
returning a PNG for a BMP request is the wrong-answer class this codebase refuses.

### The path is load-bearing for incident bookkeeping

`gatherWedgeEvidence()` needs a real file at a real path:
- it computes `incidentAssetPath({ at, port, epoch, ext: "png" })` so the PNG shares the
  incident record's stem (`incident-record.ts:87-92`);
- it records `relative(repoRoot(), screenshotContainerPath)`;
- `formatEvidenceValue()` renders it as `` `saved to ${value}` `` (`incident-record.ts:175-176`);
- `incident-record.test.ts:229` asserts the rendered form
  `/screenshot: saved to \.planning\/incidents\/…\.png/`.

Note the deliberate contrast in the same file: the *snapshot* item is worded
"accepted … never independently verified as written" precisely because it resolves
host-side. Client-side encoding **upgrades** the screenshot in the opposite direction — the
container now writes the file itself, so "saved to" becomes *verifiable* rather than
merely hopeful. Consider `existsSync()`-asserting it, which was impossible before.

### Response size: inline base64 fits, comfortably

The measured client inline ceiling for this repo is **40–60 KB**, documented at
`vice-proxy.ts:263-286` from the `large-response-chunking` spike; `OUTPUT_CHAR_CAP` is
500,000 chars and `REQUIRED_MAX_MCP_OUTPUT_TOKENS` is 25,000.

From §3's measurements, base64 of any **achievable** VIC-II frame at 384×272 is
**~0.9–9.2 KB** — an order of magnitude under the ceiling. The 75 KB figure is pathological
per-pixel random from 16 colours, which the VIC-II physically cannot render (hires is 2
colours per 8×8 cell, multicolour 4 per 4×8 — both measured at 3.6–6.9 KB). So there is no
real size risk. Still, add a **hard guard**: if base64 length exceeds a threshold, fall back
to path-only with an explanatory note. `PAL debug` borders (504×312 = 157,248 px) plus a
future higher-resolution machine is exactly the drift that turns "comfortably fits" into a
truncated response.

**Do not route an image through `wrapPossiblyChunked()`.** Its contract is a *text* payload
reassembled by plain concatenation. Splitting a base64 image across a continuation sequence
produces something Claude cannot render from the first chunk, and the chunk marker text
would sit between the halves.

### The real opportunity: emit an actual MCP `image` content block

`return_base64: true` today returns a **data URI inside the JSON text payload**. Claude
cannot *see* that as an image — it reads it as a wall of base64 characters. It is
effectively a dead option.

MCP defines an image content block: `{ type: "image", data: "<base64>", mimeType: "image/png" }`.
Adding one as a **trailing content item** is additive and precedented — `forwardToVice()`
already appends `pathNote` as a second content item and explicitly documents the invariant
that only the *first* item must be the payload byte-for-byte
(`vice-proxy.ts:2829-2838`). So:

```
content[0] = { type: "text",  text: JSON.stringify({ path, width, height, ... }) }   // unchanged shape
content[1] = { type: "image", data: <base64>, mimeType: "image/png" }               // additive, opt-in
```

This is the one place the output shape is worth *extending* rather than merely matching —
it turns a screenshot from a path Claude must separately `Read` into something Claude can
actually look at in the same turn. Gate it behind the existing `return_base64` flag (or a
new `inline: true`) so the default response shape is byte-identical to the fork's, and note
the `pathNote`/chunking interaction: only append the image when
`wrapped.content.length === 1`, exactly as `pathNote` does.

### Recommended tool contract

| Input | Behaviour |
|---|---|
| `path` (default; relative resolved against workspace root) | Encode, `mkdirSync(dirname, {recursive:true})`, `writeFileSync` the **container** path. Return `{ path: <repo-relative>, width, height, colors }`. **No host translation.** |
| `return_base64: true` | Additionally include the data URI in the text payload (fork parity) **and** append an MCP `image` content block. |
| neither | Fork's schema says `path` is "optional if `return_base64=true`" — so require at least one; error naming both options if given neither. |
| `crop: "none" \| "inner"` (new, default `"none"`) | §4. Unknown `(DW,DH)` → full frame + note. |
| `format: "BMP"` | Explicit unsupported-on-this-backend error. |

---

## 6. Implementation sketch

### Response parsing (get these right — the probe hardcodes offsets)

**`DISPLAY_GET` (0x84)** request body: `[use_vic: 1][format: 1]`, `format = 0x00`
(INDEXED8). Requires `api_version >= 2` or you get `e_MON_ERR_CMD_INVALID_API_VERSION`
(0x82). Response body, verbatim from `monitor_binary.c:1276-1291`:

```
offset 0   uint32 LE  FL   length of the fields before the display buffer (DW..BP)
offset 4   uint16 LE  DW   debug width
offset 6   uint16 LE  DH   debug height
offset 8   uint16 LE  XO   x offset to inner  (always 0 -- see §4)
offset 10  uint16 LE  YO   y offset to inner  (always 0)
offset 12  uint16 LE  IW   inner width        (always == DW)
offset 14  uint16 LE  IH   inner height       (always == DH)
offset 16  uint8      BP   bits per pixel     (always 8)
offset 4+FL      uint32 LE  BL   length of display buffer
offset 4+FL+4    uint8[BL]  BD   DW * DH index bytes
```

`info_length` is hardcoded to `13` in current VICE, so `BL` sits at 17 and the buffer at
21 — which is what `probe-binmon.mjs` assumes. **Parse `BL`/`BD` off `4 + FL`, not the
literal 17/21.** `FL` exists precisely so VICE can append fields, and the documented
extensibility rule is "if all the variable length fields are prefixed with their lengths
then you should be able to add new ones to any response". A hardcoded 21 is a
silently-wrong-answer bug the day VICE adds a field.

**`PALETTE_GET` (0x91)** request body: `[use_vic: 1]`. Response body, from
`monitor_binary.c:1354-1373`:

```
offset 0   uint16 LE  PC   palette item count
then PC times:
           uint8      IS   item size, EXCLUDING this byte (currently always 3)
           uint8      RR
           uint8      GG
           uint8      BB
```

**Advance by `1 + IS` per item, not by a fixed 4.** There is commented-out `entry->dither`
code sitting right there in the VICE source (`#if 0` at line 1370) waiting to become a 4th
component and bump `IS` to 4.

For the C64, `PC` is 16.

### Robustness checks the encoder needs

1. **Palette shorter than the highest index used.** PNG requires every index `< PLTE`
   entry count. If `max(indices) >= PC`, pad `PLTE` up to `max+1` entries (black, or repeat
   the last entry) rather than emitting an invalid PNG. Cheap insurance; a decoder rejecting
   the file is a much worse failure than a wrong-coloured pixel.
2. **`PC > 256`** → cannot be colour type 3. Not reachable on VIC-II (16), but assert and
   error loudly rather than truncating.
3. **`BL !== DW * DH`** → protocol drift. Error, do not encode a partial frame.
4. **`BP !== 8`** → error. INDEXED8 is the only mode, so this means the response is not
   what was asked for.

### Order of operations in the derived-tool handler

```
1. args validation (path xor return_base64; format; crop)
2. resolve the CONTAINER path (relative -> workspace root). Do NOT host-translate.
3. call DISPLAY_GET (use_vic=0, format=0)     -> DW, DH, indices
4. call PALETTE_GET (use_vic=0)               -> palette entries
5. optional crop via the (DW,DH) table
6. encodeIndexedPng()
7. mkdirSync(dirname(containerPath), { recursive: true }); writeFileSync(containerPath, png)
8. build result: text payload with repo-relative path + dimensions;
   optionally append the MCP image content block
```

Steps 3 and 4 can be issued concurrently — the binary monitor correlates by `request_id`,
which the client already demultiplexes for `STOPPED`/`RESUMED`/`JAM` at `0xffffffff`. One
fewer round trip of latency per screenshot. Worth doing given screenshots appear in the
recovery hot path.

### Two protocol-level gotchas for the phase plan

**(a) `DISPLAY_GET` is the largest response the binary-monitor client will ever handle.**
`MEM_GET` caps at 64 KB. `DISPLAY_GET` is 104,448 bytes at the PAL default and **157,248
bytes** with `VICIIBorderMode=debug`. This sets the read-buffer growth requirement for the
transport client, and it will arrive across many TCP chunks. `probe-binmon.mjs` already
does buffered reassembly correctly — carry that shape forward and size the test fixtures
against `DISPLAY_GET`, not `MEM_GET`.

**(b) Capture while paused, or accept a torn frame.** `machine_screenshot()` reads the
live draw buffer. Taken while the emulator is running, the frame can be mid-raster —
top half from frame N, bottom from frame N+1. The current `vice-sync.ts:screenshot()` does
not pause. For wedge evidence and for raster work this matters. Recommend documenting the
behaviour and, in `gatherWedgeEvidence()`, taking the screenshot inside the already-paused
window rather than adding a new pause. Note this interacts with the corrected finding in
`.planning/notes/stock-vice-migration-revised-loss-ledger.md` that pause-on-demand
*survives* on the stock backend.

---

## Summary table

| Question | Answer | Confidence |
|---|---|---|
| 1. Placement | **Container-side MCP server**, as a derived tool intercepted *before* `forwardToVice()` (so `rewriteArguments()` never host-translates the path). Host-side is strictly dominated. | HIGH |
| 2. With deps | Best available is `fast-png@8.0.0` (MIT, pure JS, encodes colour type 3 — verified). **`pngjs` cannot write indexed PNGs at all** (verified in source). Rule out `sharp` / `@napi-rs/canvas` / `node-libpng` on `npx` portability. | HIGH |
| 3. Dependency-free | **Recommended.** `node:zlib` `crc32` (Node ≥ 22.2.0) + `deflateSync` (RFC 1950) suffice. ~115 lines total. Prototype validated pixel-exact against an independent decoder; 1.5% larger than `fast-png`; 2.2 ms/frame. Indices are copied verbatim — no RGBA expansion. | HIGH |
| 4. Cropping | **Full frame, no crop, by default.** `XO`/`YO`/`IW`/`IH` are degenerate on every VICE machine (`XO=YO=0`, `IW=DW`, `IH=DH`) — cropping from them is a no-op. Offer `crop: "inner"` from a `(DW,DH)` lookup table; refuse-with-note on unknown geometry. The border is genuinely wanted for raster work and `$D020` debugging. | HIGH |
| 5. Output shape | **Path by default** — required by the fork's existing manifest (`path` + `return_base64`), by the surface-compatibility constraint, and by `incident-record.ts` bookkeeping. Base64 fits the 40–60 KB ceiling with an order of magnitude to spare. **Extend** with a real MCP `image` content block appended as a trailing content item, gated behind `return_base64`. | HIGH |

## Sources

**Primary — VICE source, `VICE-Team/svn-mirror` main branch (read directly):**
- `vice/src/monitor/monitor_binary.c` — `monitor_binary_process_display_get` (1229–1322), `monitor_binary_process_palette_get` (1325–1382), `monitor_binary_screenshot_line_data` (1183–1227), opcode enums (102–116)
- `vice/src/raster/raster.c:531-557` — `raster_screenshot()`, the degenerate inner-rect defaults
- `vice/src/vicii/vicii.c:326-348, 1420-1430` — `vicii_set_geometry()`, `vicii_screenshot()`
- `vice/src/vicii/vicii-timing.c:75-215` — border-mode geometry switch, `VICII_25ROW_START_LINE`
- `vice/src/vicii/vicii-timing.h` — PAL/NTSC/NTSCOLD/PALN border and displayed-line constants
- `vice/src/vicii.h:44-47` — `VICII_{NORMAL,FULL,DEBUG,NO}_BORDERS` = 0/1/2/3
- `vice/src/vicii/vicii-resources.c:95-135` — `VICIIBorderMode` registration, vsync-deferred setter
- VICE manual §binary monitor — https://vice-emu.sourceforge.io/vice_13.html (`FL: 4 bytes: Length of the fields before the display buffer`; `IS: 1 byte: Item size, excluding this byte`)

**Primary — this repository:**
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STACK.md`, `.planning/PROJECT.md`
- `.claude/mcp/vice/vice-proxy.ts` — 263-286 (output ceiling), 1310-1353 (`gatherWedgeEvidence`), 1672-1690 + 1777-1840 (`rewriteArguments`/`pathArgsFor`), 1864-1955 (`wrapPossiblyChunked`), 2698-2840 (`forwardToVice`)
- `.claude/mcp/vice/vice-sync.ts:317-335` — host-path screenshot translation being retired
- `.claude/mcp/vice/incident-record.ts:74-92, 137-180` — asset stem, evidence rendering
- `.claude/mcp/vice/tools-manifest.json:600-620` — existing `path` / `format` / `return_base64` schema
- `.claude/mcp/vice/build.ts:42-50` — `HOST_BOUND_ARTIFACTS`
- `.claude/mcp/vice/probe-binmon.mjs:233-256` — DISPLAY_GET probe (note its hardcoded offsets)
- `scripts/ensure-mcp-deps.sh:12-46` — lockfile-hash-gated `npm ci`

**Primary — executed / measured during this research:**
- Prototype encoder written, `file(1)`-validated, round-tripped pixel-exact through `fast-png@8.0.0`'s independent decoder, size-compared and benchmarked on Node v22.22.0
- `zlib.crc32(Buffer.from("IEND")) === 0xae426082`; `deflateSync` output prefix `78 9c`
- Geometry table computed from the `vicii-timing.h` constants

**Primary — live npm registry, 2026-08-12:**
- `registry.npmjs.org` packuments and `api.npmjs.org` download counts for `pngjs`, `fast-png`, `sharp`, `upng-js`, `@napi-rs/canvas`, `@cwasm/lodepng`, `node-libpng`, `pngjs-nozlib`, `pako`, `fflate`, `iobuffer`, `@types/pngjs`
- `pngjs@7.0.0` tarball, `lib/packer.js` + `lib/constants.js` (indexed-write rejection)
- `fast-png@8.0.0` tarball, `lib/png_encoder.js` + `lib/types.d.ts` (indexed-write support)

**Official docs:**
- https://nodejs.org/api/zlib.html — `zlib.crc32` "Added in: v22.2.0, v20.15.0"; `deflateSync` emits zlib-format by default
