---
created: 2026-08-26T15:05:00.000Z
title: BACK-05 D-G ordering test fails deterministically on a live-broker host
area: testing
severity: major
files:

  - src/mcp/vice/vice-proxy.test.ts:6382

resolves_phase:
audit_acknowledged:
  milestone: v0.7.0
  at: 2026-09-01
---

## What

`vice-proxy.test.ts:6382` — *"BACK-05 (D-G ordering, observed at the wire)"* — is **not a
load-sensitive flake.** It fails deterministically whenever a live VICE broker owns the
emulator, and passes deterministically when no broker is running.

Measured 2026-08-26, same commit, same host, single-test runs:

| broker | result |
|--------|--------|
| `systemctl --user` unit active | `# fail 1` |
| unit stopped | `# pass 1` |

## Mechanism

The test spawns its proxy with `startProxy({ VICE_BACKEND: "stock" })`. On a host where a
broker has already launched the emulator as `fork`, the proxy's own backend-mismatch guard
fires — correctly — and answers with the guard's advice text, which contains the string
`VICE_BACKEND=fork`. The assertion at `vice-proxy.test.ts:6421` is a `doesNotMatch`, so the
guard's own correct refusal is what fails it:

    vice: backend mismatch between this MCP server and the broker that owns the emulator.
    This process resolved "stock" (source: override, binary: /usr/local/bin/x64sc) while
    the broker resolved "fork" (binary: x64sc) -- and the broker's verdict is the
    authoritative one ...

So the product code is behaving as designed; the **test** is not isolated from ambient host
state. A developer with a warm broker — the normal state for this project — sees a red suite
for a reason unrelated to their change.

## Why this matters beyond the one test

Phase 23 ran the full suite as a per-task acceptance gate on a host where a broker was
deliberately kept live to drive the emulator. Every gate reading in that phase therefore
carries this failure spuriously. `deferred-items.md` item 4 records it as "fails on a
live-broker host", which is right; this todo adds that it is **fully deterministic and
reproducible on demand**, so it should not be lumped in with the genuine load-sensitive
set (`159`, `916`, `2410`).

## Candidate fix

Isolate the test from ambient broker state rather than relaxing the assertion — the
assertion is testing something real. Options, roughly in order of preference:

1. Point the test at a private supervisor directory (`VICE_POOL_DIR` / `VICE_SUPERVISOR_DIR`
   to a temp path) so it cannot observe the developer's broker at all.
2. Have `startProxy` default to an isolated state dir for every test that overrides
   `VICE_BACKEND`, so the class of bug cannot recur in a sibling test.
3. Failing both, skip under a detected live broker with an explicit reason, so the skip is
   visible rather than a red.

Do **not** fix by asserting on a narrower substring — that preserves the coupling and will
break again the next time the guard's wording changes.
