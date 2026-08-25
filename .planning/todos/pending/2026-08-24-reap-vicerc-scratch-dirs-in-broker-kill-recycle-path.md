---
created: 2026-08-24T10:22:50.815Z
title: Reap vicerc scratch dirs in broker kill/recycle path
area: broker
severity: minor
files:

  - src/mcp/vice/broker-launch.mts:329
  - src/mcp/vice/broker-launch.mts:318-327

audit_acknowledged:
  milestone: v0.5.0
  at: 2026-08-25
---

## Problem

`launchInstance()` creates a fresh scratch config dir per **stock** launch and
never removes it:

```ts
// broker-launch.mts:329
const scratchConfigDir = mkdtempSync(join(tmpdir(), "vice-broker-vicerc-"));
spawnOptions = { env: { ...process.env, XDG_CONFIG_HOME: scratchConfigDir } };
```

One directory leaks per launch, for the life of the host. This is **not** an
oversight — the header comment at `:318-327` records it deliberately:

> "Scratch-dir lifetime: this function deliberately does NOT clean the directory
> up — the spawned emulator process outlives this function's return and needs the
> directory for its whole lifetime. Per-launch scratch dirs therefore accumulate
> under the OS temp dir for the life of the host; this is a recorded trade-off,
> not an oversight. If reaping them is ever worth doing, the broker's own
> kill/recycle path is the component that would own it (it already knows when an
> instance's process has actually exited)."

**Why it is now worth doing.** Measured on the dev laptop 2026-08-24 after a
7-day uptime: **4,779** `vice-broker-vicerc-*` dirs. On that host `/tmp` is a
16 GB **tmpfs**, so these consume RAM, not disk — and tmpfs pages are
unevictable, meaning the kernel can only push them to swap, never drop them.
Combined with test-suite litter this pinned ~4 GB and contributed to swap
reaching 15/15 GB, which put the desktop into permanent direct reclaim.

This ships in `@henols/vice-mcp`, so every consumer leaks too, with no local
mitigation installed.

Host-side mitigation exists but is **not** a fix: an hourly user timer
(`~/.local/bin/tmp-litter-purge`, installed from `~/desktop-freeze-fix/`) purges
these, and it must skip any dir still named in a live process's
`/proc/<pid>/environ` — precisely because a warm-floor emulator can outlive any
age threshold. That guard is the host-side echo of the lifetime problem this
todo fixes properly.

## Solution

Implement reaping where the source comment says it belongs: the broker's
**kill/recycle path**, which already knows when an instance's process has
actually exited. The fix does **not** go at `:329`.

Sketch:

- Record `scratchConfigDir` on the `InstanceRecord` alongside `pid`/`port`, so
  the owning path can find it later.

- On confirmed process exit (kill, recycle, and crash-supervision respawn), and
  only after exit is confirmed, `rm -rf` the recorded dir.

- Reap orphans at broker startup: dirs matching the prefix whose recorded
  instance is gone. Guard against deleting a dir belonging to a live pid.

Constraints to respect:

- `broker-launch.mts` is `.mts`, compiled by `build.ts` into committed
  `resources/*.mjs`; `resources-sync.test.ts` fails CI on drift. Any edit
  requires regenerating and committing the artifact.

- Stock-only today (`backend === "stock"`), but keep BACK-02 in mind: the fork
  path must stay bit-for-bit unchanged.

- Update the `:318-327` header comment — leaving it saying "deliberately does
  NOT clean up" after adding cleanup would be actively misleading.

Suggested vehicle: `/gsd-quick` (atomic commits + state tracking, warranted by
the build-artifact coupling). Deferred out of Phase 18 because reaping is a
change to broker lifetime semantics, not part of that phase's goal.
