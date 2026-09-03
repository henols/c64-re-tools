# Evidence: `vice_run_until` reproducible+frame_anchor through the SHIPPED seam

**Probe:** `reproducible-seam-probe.mjs`
**Date:** 2026-09-03
**Binary:** `/usr/bin/x64sc` — genuine unpatched stock VICE 3.9
**Closes:** Phase 33 UAT test 2 / `33-VERIFICATION.md`'s human-verification item

## Why this probe exists

None of the phase's five live evidence probes imported `stock-reproducible-run.ts`.
All of them drove the pieces directly through `stock-protocol.ts` / `broker-launch.mts`.
`runReproducible()`'s only coverage was 30 unit tests against scripted clients, and it
was changed by three code-review-fix commits (`edb5d7f`, `f00446b`, `d49a8ce`) AFTER
every live run (`2b40040`, `678da05`, `01cfae9`). **The code that was measured was not
the code that ships.**

This probe calls `handleRunUntil` from `stock-run-until.ts` — the module the MCP
dispatch table routes `vice_run_until` to, and the only non-test caller of
`runReproducible()`. The 64K read-back goes through the shipped `handleMemoryRead`.
The determinism block and the comparison predicate are **imported, never retyped**
(`T-33-36`): `STOCK_DETERMINISM_FLAGS` from `broker-launch.mts`, `compareCaptures()`
from `capture-predicate.ts`.

## Configuration

| Input | Value |
|---|---|
| target `address` | `$ea31` |
| `frame_anchor` | `$ea31` (the documented green case: `address === frameAnchor`) |
| `reproducible` | `true` |
| `timeout_ms` | 20000 |
| pre-protocol jitter | 0 / 1500 / 4000 ms of free run between monitor bind and connect |
| determinism block | `-seed 4242 -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0 +autostart-delay-random` |

`-default` precedes `-binarymonitor` in the argv, or the monitor never binds.

## Result — PASS

Two independent probe invocations, three emulator launches each (six cold boots total):

| Jitter | Stop identity | 64K sha256 | resumes |
|---|---|---|---|
| 0 ms | `PC=$ea31 hit_count=1 LIN=257 CYC=57` | `bf083cb3…5c7438` | 1 |
| 1500 ms | `PC=$ea31 hit_count=1 LIN=257 CYC=57` | `bf083cb3…5c7438` | 1 |
| 4000 ms | `PC=$ea31 hit_count=1 LIN=257 CYC=57` | `bf083cb3…5c7438` | 1 |

- **One** four-term stop identity across the triple — matching the value
  `stock-reproducible-run.ts`'s own header claims, byte for byte.
- **One** 64K sha256 across the triple, and **the same sha256 across both invocations**.
- `resumes: 1` on every run — `vice-sync.ts`'s "exactly one resume per wait" invariant
  holds in its stock-native event-driven form, live.
- `anchorCleanup: deleted`, `cleanup: auto_deleted_by_vice`, `machineHalted: true`,
  `runState: stopped` on every run — the hit path's cleanup is exactly the one of three
  the module documents for it.
- `compareCaptures()` with an **empty allow-list** reports `differing: 0` for all three
  pairwise comparisons. The 64-address transient budget was not needed at all; the union
  of differing addresses is the empty set.

## The one finding worth recording: the determinism block is load-bearing, and its absence is silent

The probe's **first** run spawned `x64sc` directly with only
`-default -binarymonitor …`, omitting `STOCK_DETERMINISM_FLAGS`. Result:

- the four-term stop identity still reproduced **perfectly** (`1` distinct across the triple);
- the 64K sha256 differed on **all three** runs;
- `compareCaptures()` against an empty allow-list named **1032** differing addresses,
  **every one a single-bit flip**, confined to `$0100–$9FFF` and `$C000–$CFFF` — RAM
  under the default banking, never ROM and never I/O.

That is the signature of VICE's randomised power-on RAM init, not a protocol defect.
The shipped broker emits the block **unconditionally** on the stock branch, so the
shipped route is never in this state — but a caller reaching `x64sc` any other way
gets a run whose stop identity looks perfect while its capture is not reproducible.
The stop identity cannot detect it: the identity is a property of *where* the machine
stopped, the RAM image a property of *what state it booted into*, and the determinism
block is what pins the second. This is a concrete argument for the unconditional
emission `REPRO-01` asked for, measured rather than asserted.

## Artifacts

- `reproducible-seam-probe.mjs` — the probe
- `uat-seam-images/jitter-{0,1500,4000}.bin` — the three 64K captures (identical)
