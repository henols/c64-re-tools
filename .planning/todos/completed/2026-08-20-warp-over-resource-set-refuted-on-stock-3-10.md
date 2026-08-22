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
resolves_phase: 15
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

## FORK-01 decision applied (2026-08-22, Phase 14 plan 14-05)

`FORK-01` decided **`retain`** (human decision at plan 14-01's
`gate="blocking-human"` checkpoint; see `.planning/PROJECT.md` → Key
Decisions, dated 2026-08-22). This answers the fork-facing half of item 4
above: the fork backend is **not** going away, so `vice_machine_config_set`'s
`WarpMode` description is **not moot**. The applicable route is the one item
4 already named — fix the description so it no longer advertises `WarpMode`
as a generally-available resource, and if the fork's patched build genuinely
honours it, mark that capability fork-only per SKILL-01 so a stock-backend
skill cannot silently assume it. Phase 15 should execute this fix on that
basis rather than re-deriving whether the fork still exists.

The cross-reference to
`.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`
above is now stale in one respect: that todo is closed (resolved `retain`),
but its closure does not make this todo's own remaining fix moot — see
above.

## Resolution (2026-08-22, Phase 15 plan 15-09)

All five Solution items closed or dispositioned:

1. **Corrected error codes** — `.planning/research/GAINS-PROTOCOL.md`'s C.3
   paragraph now names the measured codes: `0x01` (object does not exist) for
   `RESOURCE_GET WarpMode` and a string-typed `RESOURCE_SET WarpMode "1"`;
   `0x8f` (invalid parameter) only for an int-typed `RESOURCE_SET WarpMode 1`.
   Cited to the 2026-08-20 live probe against genuine stock `/usr/bin/x64sc`
   (VICE 3.10). Commit `d6a9c53` (Task 1).
2. **`InitialWarpMode` silent-success trap recorded** — the Tier 4 `WarpMode`
   row now states that `RESOURCE_SET InitialWarpMode 1` returns `0x00` and
   reads back as `1` while only being consulted at launch, and records the
   decision: a stock-backend resource-set tool should return an explicit
   launch-time-only result rather than a bare refusal. Commit `d6a9c53`
   (Task 1).
3. **Stock warp story decided and recorded** — warp on stock is a
   broker-launch flag only (`-warp` / `InitialWarpMode` at spawn), never a
   runtime tool; the three pre-existing statements to this effect
   (`GAINS-PROTOCOL.md:1487-1489`, `:1521-1524`, `CLAUDE.md`'s Capability
   constraint, `PROJECT.md`) were checked this session and left unmodified —
   all three already state the rule correctly and needed no edit.
4. **`vice_machine_config_set`'s fork-only caveat landed in two project-owned
   places, no schema growth** — `docs/stock-vice-parity.md` §A item 7 gained
   a new bullet naming the capability fork-only, that stock has no runtime
   warp resource at all, and that warp on stock is launch-time-only; and
   `capability-registry.ts`'s existing `vice_machine_config_set.reason` field
   was extended with the same caveat (two sentences, no new field —
   `grep -c 'note:' capability-registry.ts` is 0 before and after). This
   reaches a stock caller through `capabilityRefusalMessage("vice_machine_config_set",
   "stock")` and a reader through `docs/tool-support.md`'s regenerated row
   (diff limited to that one row's note cell). `tools-manifest.json` was
   deliberately **not** edited — it is machine-generated from the fork
   binary's own compiled schema and confirmed byte-identical
   (`git diff --quiet .claude/mcp/vice/tools-manifest.json`). Landed in
   this plan's Task 2 commit (see the plan's SUMMARY.md for the hash).
5. **Optional follow-up promoted, not dropped** — whether a runtime
   `InitialWarpMode` set has any effect on emulation speed at all remains
   unmeasured. Promoted as a named follow-on: **owner — whichever future plan
   next needs stock warp/speed control** (no phase currently claims it); the
   measurement method is cheap (bracket emulated cycles against wall-clock
   across a resume, per the todo's own Solution item 5) and should be done
   before any stock-backend tool tries to expose `InitialWarpMode` as a
   runtime lever.
