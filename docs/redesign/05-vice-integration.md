# 05 — VICE integration

## 1. Boundary

VICE is an implementation dependency of the Host Runtime. The Application API does not expose VICE monitor details.

```text
Application operation
        ↓
Host Runtime session
        ↓
serialized VICE operation queue
        ↓
┌────────────────┬────────────────┐
│ binary monitor │ text monitor   │
└────────────────┴────────────────┘
        ↓
      x64sc
```

## 2. One VICE per session

Each Host Runtime client connection owns one fresh VICE instance.

No connection may attach to another connection's instance, and no MCP process may switch instances.

## 3. Serialized access

The two VICE monitor interfaces act on the same machine and therefore must be serialized through one per-session command queue/lock.

No higher layer needs to know which channel serves an operation.

## 4. Fixed supported feature set

The implementation targets one documented feature set. Session startup verifies that the required emulator interfaces can be established.

There is no runtime capability matrix exposed to clients.

Operations that stock VICE cannot meaningfully provide are excluded from the public API rather than exposed as permanently-false capabilities.

## 5. Launch contract

VICE launch arguments, monitor ports and startup ordering are Host Runtime implementation details. Existing code and tests shall be consulted for proven quirks such as argument ordering, monitor availability and stock VICE behavior.

The implementation must explicitly test the chosen supported VICE versions/configurations against real VICE, not only mocks.

## 6. Monitor protocol correctness

The rewrite should reuse proven protocol knowledge from the current implementation, including lessons around:

- request/reply correlation;
- unsolicited events;
- zero-length responses/events;
- monitor contention;
- shared machine state between binary/text commands;
- launch/readiness races;
- crash/hang differentiation where possible.

These facts inform the new VICE adapter but do not define the public API.

## 7. Recovery

When VICE exits unexpectedly:

1. record/log the failure context;
2. fail the active operation;
3. cleanly discard the dead monitor connections;
4. start a fresh VICE for the same Host Runtime connection if recovery policy permits;
5. clearly report that prior emulator state was lost.

The Host Runtime must never replay a possibly state-changing failed request automatically.

## 8. Session machine profile and spaces

Each VICE session uses one fixed machine profile for its lifetime. Initial supported profiles are C64 PAL and C64 NTSC, with PAL as the normal/default profile. Changing profile means starting a fresh session rather than mutating timing assumptions in place.

Low-level debugging supports explicit logical spaces for the C64 CPU and drive 8 CPU. Monitor default-memspace repair and channel-specific workarounds remain internal.

The public MCP may expose frame advancement, canonical screen capture/comparison and atomic composite observations as C64-domain operations even when their implementation requires multiple serialized VICE monitor operations.

See [14 — VICE MCP surface](14-vice-mcp-surface.md).

## 9. Real-emulator validation

Protocol and behavior claims that depend on VICE must have at least one real-emulator validation path. Self-authored mocks are useful for deterministic unit testing but are not sufficient evidence for external VICE behavior.
