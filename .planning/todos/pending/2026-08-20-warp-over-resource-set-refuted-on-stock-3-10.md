---
created: 2026-08-20T07:55:08.394Z
title: Warp over RESOURCE_SET is refuted on stock 3.10 — fix the predicted error code, the InitialWarpMode readback trap, and the fork tool's WarpMode claim
area: general
files:
  - .planning/research/GAINS-PROTOCOL.md:1255-1265
  - .planning/research/GAINS-PROTOCOL.md:1350-1351
  - .planning/research/GAINS-PROTOCOL.md:1487-1488
  - .planning/research/GAINS-PROTOCOL.md:1521-1522
  - .claude/mcp/vice/tools-manifest.json:1188
  - CLAUDE.md:36
  - .planning/PROJECT.md:147
---

## Problem

An incoming capture proposed driving warp over the same binary-monitor TCP session as
debugging: `RESOURCE_GET WarpMode` as a support probe, then `RESOURCE_SET WarpMode "1"`
(string value, letting VICE coerce), then `0xAA` to resume — the claim being that this
removes the need for a second control port or a custom VICE build.

**The core claim is false on stock VICE.** It was probed live against genuine unpatched
`/usr/bin/x64sc` (VICE 3.10) on 2026-08-20, over `-default -binarymonitor
-binarymonitoraddress ip4://127.0.0.1:6531`, with a proper length-prefixed stream parser
and request-id demux:

| request | result |
|---|---|
| `RESOURCE_GET Speed` | `err=0x00`, int 100 — control resource works |
| `RESOURCE_GET InitialWarpMode` | `err=0x00`, int 0 — control resource works |
| `RESOURCE_GET WarpMode` | **`err=0x01`** (object does not exist) |
| `RESOURCE_GET Warp` | **`err=0x01`** |
| `RESOURCE_SET WarpMode "1"` (type 0x00, string) | **`err=0x01`** |
| `RESOURCE_SET WarpMode 1` (type 0x01, int) | **`err=0x8f`** (invalid parameter) |
| `RESOURCE_SET InitialWarpMode 1` (int) | `err=0x00`, reads back as 1 |

This confirms the existing constraint (CLAUDE.md:36, PROJECT.md:147,
GAINS-PROTOCOL.md:1259-1265) — there is no runtime `WarpMode` resource; `-warp` /
`InitialWarpMode` go through `CALL_FUNCTION` into a static specifically so they never
become a resource (`vsync.c:220-241`). The defensive `RESOURCE_GET` probe the capture
recommends is in fact the right instinct: on stock it correctly returns "unsupported".

Three concrete defects the probe exposed, none of them yet recorded:

1. **The predicted error code in the research doc is wrong.**
   GAINS-PROTOCOL.md:1264 asserts *"`RESOURCE_SET WarpMode 1` will fail with `0x8f`"*.
   Real 3.10 returns `0x8f` only for the **int-typed** set; the **string-typed** set and
   both `RESOURCE_GET`s return `0x01`. Any client that keys "unsupported resource" off
   `0x8f` alone — the exact shape the capture's string-value convenience argument pushes
   you toward — will misclassify the failure it is most likely to actually see.

2. **`InitialWarpMode` is a silent-success trap.** `RESOURCE_SET InitialWarpMode 1`
   returns `err=0x00` **and reads back as 1**, so a client has no wire-level signal that
   nothing happened. Per `vsync.c:207-209` the value is only consulted at launch. Not
   re-verified behaviourally here — whether a runtime set has *any* effect on emulation
   speed is the open question; the readback proving nothing is already established.

3. **The fork's own tool surface advertises the false capability.**
   `tools-manifest.json:1188` describes `vice_machine_config_set` as *"Set machine
   configuration resources (WarpMode, Speed, ...). WarpMode (0/1) disables speed
   limiting for fast execution."* Whether or not the fork's patched build honours that,
   the description is a SKILL-01 landmine: a skill written against it breaks on stock
   rather than degrading, and the wording gives no hint the capability is fork-only.

The capture's non-warp advice is sound and worth keeping independently of the warp
claim: never treat one `data` event as one message (length-prefixed reassembly), and
demux on the 32-bit request id because `0xffffffff` events interleave — the probe saw
exactly that, a `REGISTER_INFO` (0x31) and a `STOPPED` (0x62) arriving before the first
reply. Both already match the project's settled protocol constraints.

## Solution

1. Correct GAINS-PROTOCOL.md:1264 to the measured codes: `0x01` for `RESOURCE_GET
   WarpMode` and for a string-typed `RESOURCE_SET`, `0x8f` only for an int-typed
   `RESOURCE_SET`. Cite the 2026-08-20 live 3.10 probe rather than leaving it a source
   prediction.
2. Add the `InitialWarpMode` silent-success trap to the resource notes
   (GAINS-PROTOCOL.md:1350-1351 table) — succeeds, reads back, launch-only. Decide
   whether a stock-backend resource-set tool should refuse it outright or return an
   explicit "launch-time only, restart required" result.
3. Decide and record the stock warp story: warp is a **broker-launch** flag
   (`-warp` / `InitialWarpMode` at spawn), not a runtime tool. If a caller needs a fast
   run-to-checkpoint, the lever is either relaunching warped or `Speed` — note that
   `Speed = 0` is silently coerced to 100 (`vsync.c:166-169`), so it is not "unlimited".
4. Fix the `vice_machine_config_set` description so it no longer advertises `WarpMode`
   as a generally available resource; if the fork genuinely honours it, mark it
   fork-only per SKILL-01 so a skill cannot silently assume it on stock.
5. Optional follow-up if warp-speed capture ever becomes a requirement: measure whether a
   runtime `InitialWarpMode` set changes anything, by bracketing emulated cycles against
   wall-clock across a resume. Cheap, and it closes the one thing the probe left open.

Probe script kept at `scratchpad/warp-probe.mjs` for this session; re-create from the
table above if it is needed after the scratchpad is cleared.
