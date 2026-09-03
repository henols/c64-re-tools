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

---

## Part 2 — the three post-review refusal paths, live

**Probe:** `refusal-paths-probe.mjs` (shares part 1's harness verbatim)

`33-VERIFICATION.md`'s `behavior_unverified` item asks for more than the jitter triple:
it also names CR-02's zero-hit refusal, WR-01's anchor-stopped-first adjacency gate, and
WR-02's anchor cleanup on a live-socket resume failure — "against real monitor emission
order". Part 1 did not cover these. Part 2 does, for the two that are live-reachable.

### CR-02 — the zero-hit refusal · PASS

Target `$fda3` (KERNAL IOINIT, executed inside the reset routine), frame anchor `$ea31`
(the first IRQ, which has not run yet). The target therefore fires with the anchor's hit
count still `0`. Result: `isError=true`, with the module's own wording —

> the target stopped at `$fda3` before the frame anchor at `$ea31` had executed even once,
> so the frame term is 0 and carries no frame information … Refusing rather than reporting
> a four-term stop identity whose frame term is vacuous.

No `reproducibleStop` field is emitted at all. This is the refusal firing against **real
monitor emission order**, not a scripted client — the condition arose naturally from the
KERNAL's own reset sequence.

### WR-01 — the anchor-stopped-first adjacency gate · PASS

Anchor `$ea31` and target `$c000` (never executed) at **different** addresses. The
stop:true anchor halts the machine on its first hit; exactly one resume is ever sent, so
the target can never fire.

| Field | Value |
|---|---|
| `timedOut` | `true` |
| `anchorStoppedFirst` | `true` |
| `anchorHitsObserved` | 1 |
| `resumes` | 1 |
| `reproducibleStop` | `false` |
| `cleanup` / `anchorCleanup` | `deleted` / `deleted` |
| `machineHalted` | `true` |
| any of `pc` / `hitCount` / `line` / `cycle` emitted | **none** |

Settled in **6370 ms against a 15000 ms deadline** — the gate ends the wait as soon as the
terminal anchor frame arrives instead of burning the deadline, which is what WR-01 asked
for. Both checkpoints are cleaned up on the timeout path (the target is temporary and never
fired, so it is the one path that must delete it — and it did).

Critically, **no term of the four-term oracle appears on the answer.** A partial stop record
is what would certify two different stops as the same one.

### WR-02 — NOT exercised live, and recorded as such

WR-02 needs the `EXIT` reply to fail *while the socket stays alive*. No real emulator
produces that on demand; inducing it needs fault injection at the client. It remains
covered by `stock-reproducible-run.test.ts`'s scripted-client cases. **This is recorded as
unit-covered, not claimed as live** — the whole point of part 1 was that scripted-client
coverage is not the same thing, and that distinction does not get quietly dropped here
because the remaining item is inconvenient.

### Net effect on `33-VERIFICATION.md`'s unverified item

The item's primary expectation (`TRIPLE_DISTINCT_SHA256 1` /
`TRIPLE_ANY_STOP_TERM_DIFFERS no` through the shipped seam) is **met** — part 1. Two of its
three named refusal paths are **met live** — part 2. The third is **unit-covered only**, and
stays that way.
