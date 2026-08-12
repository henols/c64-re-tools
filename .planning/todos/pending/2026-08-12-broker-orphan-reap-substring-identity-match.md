---
title: Broker orphan reap selects kill targets by substring match on any process's argv
date: 2026-08-12
priority: high
source: /gsd-execute-phase 1 — post-merge test gate investigation
---

# The startup orphan reap can kill unrelated host processes

`discoverBandProcesses()` in `.claude/mcp/vice/broker-kill.mts:489` picks reap
targets like this:

```js
entries.filter((entry) => entry.args.includes(viceBin) && argsNamePortAtOrAbove(entry.args, basePort))
```

`entry.args` is the target process's **full argument string** and `includes()` is a
plain **substring** test. The only other gate is `argsNamePortAtOrAbove()`, which
merely requires some integer at or above `basePort` to appear anywhere in those
args. Matching processes are then SIGTERM'd and escalated to SIGKILL by
`verifiedKill()`.

This is **shipped broker code**, not test-only. The reap is documented as
"unconditional startup reap (criterion I, D-15)", so it runs every time a broker
starts.

## Why it has been invisible

Inside the devcontainer the process table is small, isolated, and contains
nothing but the container's own processes, so a loose match has nothing wrong to
hit. `container-guard` also refuses to launch a broker inside a container at all,
which is why the whole path is rarely exercised there.

On a developer's **host** the same scan walks every process the user owns.

## Observed, not theorised

While investigating the Phase-1 post-merge test gate, two orchestrator shell
processes were killed mid-command (bash exit 144) by brokers started from
`vice-broker-launch.test.ts`. Long temp paths supply the integer the port-band
check wants (timestamps in a scratchpad path are all `>= basePort`), and a short
`VICE_BIN` such as `/bin/sleep` supplies the substring.

## Fix direction

- Match the resolved binary path **exactly** (compare argv[0] / the executable
  path), not `args.includes(...)`.
- Require the port to appear as an actual emulator port **argument**, not as any
  integer anywhere in the string.
- Consider refusing to reap any pid that is not a descendant of a broker this
  machine's state directory knows about.

## Interim mitigation already committed

`vice-broker-launch.test.ts` now stubs `VICE_BIN` to a unique per-run path rather
than `/bin/sleep` (commit `9dc8265`), so the suite can no longer match unrelated
processes. `broker-e2e.test.ts` still uses bare `/bin/sleep` in six places and has
the same hazard.

Related: [[vice-broker-tests-stall-outside-devcontainer]]
