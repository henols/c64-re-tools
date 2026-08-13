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

---

## Resolved 2026-08-13 (Phase 2)

Closed by two changes, both on `main`:

1. **Plan 02-03** (`19535f8` fix(02-03): reap from the broker's own allocation
   record, not argv scan) rewrote `reapOrphanedInstances()` to read each
   instance's own `epoch.json` and **deleted** `discoverBandProcesses()` and
   `argsNamePortAtOrAbove()` outright. Verified absent from the tree: a
   repo-wide grep for either identifier returns nothing.
2. **Code-review finding CR-04** (`02-REVIEW.md`, fixed in `02-REVIEW-FIX.md`)
   closed the hole the rewrite left behind: `verifiedKill()` was called with
   `expectedIdentity: ""` whenever an epoch record lacked a string `vice_bin`,
   and `args.includes("")` is vacuously true — so the identity guard was
   disabled exactly when evidence was missing. An empty identity now REFUSES
   the kill (`broker-kill.mts`), which is the behaviour this todo asked for.

The reap no longer inspects any process's argv to choose a target, and it will
not signal a pid it cannot positively identify.
