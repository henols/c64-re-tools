# No Cross-Side Paths — Shaping Notes

## Scope

This is roadmap v2.0.0 "One Broker, One Socket", step 4, and it closes the
milestone. Two known defects still break the product rule "neither side ever
names a path that the other side must open" (`product/tech-stack.md`):

- The epoch drift check reads the grant's `epoch_file`, a broker-side path. In
  a container that file does not exist, so every reconnect is falsely refused
  and the WR-14 epoch guards compare `null === null`.
- `vice_program_load` dials a text-monitor `load "<client path>"`, and VICE
  opens that client-side path on the broker host.

The grant's `supervisor_dir` (a broker path) is also removed. The client parses
it, but nothing reads it.

## Decisions

- **Epoch source:** the broker's existing `status` reply, asked over the lease's
  own control session and matched by the lease's port. The same source gives
  the handshake baseline and the reconnect check. The grant loses `epoch_file`
  and `supervisor_dir`; nothing is added to the wire.
- **D-3 posture is kept:** an epoch that cannot be read (`null`) is identity not
  proven, and a reconnect is refused.
- **`vice_program_load` moves to the binary monitor:**
  - The client reads the chosen hazard-subject PRG and writes its payload at
    the header's load address with `MemorySet`. No staging, no transfer, no
    text-monitor `load`.
  - This removes the Phase 50 `load` widening from the text-monitor allowlist.
  - The `device` parameter is removed. It had no meaning once no path crosses,
    and v2.0.0 is a major version.
- **Equivalence gate:** before the text route is deleted, measure on the bare
  host that the text `load` and the `MemorySet` route leave identical 64K RAM.
  If the text `load` touched other bytes, the new handler must reproduce them.
- **Structural tests** assert that the removed names and the `load` verb are
  absent, with planted-violation proofs, so they cannot pass vacuously.

## Context

- **Visuals:** none.
- **References:** see `references.md`.
- **Product alignment:** one machine-level broker, files travel as bytes, and no
  client names a broker-side path. Point-of-use refusals, never a doctor
  command.

## Standards Applied

- **broker/host-bound-modules:** `broker-control.mts` and `vice-broker.mts` are
  rebuilt into `resources/`.
- **global/injectable-deps:** `StockConnectDeps.readCurrentEpoch` replaces
  `epochPath` + `readEpochFn`.
- **global/atomic-state-files:** an unreadable epoch is a normal `null`, never a
  throw.
- **global/module-header:** the new `hazard-subjects.ts` gets the short header.
- **mcp/tool-answers:** the new handler answers through `stockAnswer` and
  refuses through `isErrorText`/`convertWireError`.
