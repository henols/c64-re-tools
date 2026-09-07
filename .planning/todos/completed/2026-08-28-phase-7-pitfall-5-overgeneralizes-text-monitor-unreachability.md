---
created: 2026-08-28T00:00:00.000Z
title: Phase 7 Pitfall 5 overgeneralizes "text monitor unreachable" and is why the -remotemonitor port stayed unclaimed
area: docs
severity: major
files:

  - .planning/phases/07-cycle-timing-and-wedge-triage/07-RESEARCH.md
  - CLAUDE.md
  - .planning/notes/stock-vice-migration-revised-loss-ledger.md

resolves_phase: 39
audit_acknowledged:
  milestone: v0.7.0
  at: 2026-09-01
---

## Problem

`07-RESEARCH.md` states, in its Alternatives Considered table and again as
Pitfall 5, that VICE's text-monitor `stopwatch` is

> "reachable only from the **interactive console** (`-console`), a wholly separate
> code path from the binary-monitor TCP port this client speaks."

and warns against "assuming the text monitor's `stopwatch` command is reachable
over the binary monitor."

The **narrow** claim is correct and must survive any edit: `monitor_binary.c`'s
`enum t_binary_command` has no execute-monitor-command-text opcode of any kind, on
any VICE version, so there is genuinely no way to invoke a monitor command over
the *binary* port.

The **generalization** is false. The text monitor is reachable over TCP via
`-remotemonitor` (`monitor_network.c`), which is neither the binary port nor the
interactive console. This repo's own broker already launches it: `broker-launch.mjs:165`
appends `-remotemonitor -remotemonitoraddress ip4://<host>:<port>` to every stock
launch, and `broker-state.mts:139` records the allocated `remoteMonitorPort`.

Verified live 2026-08-27 against `/usr/bin/x64sc` (genuine stock, VICE 3.9):
`sw` / `stopwatch` returns `Stopwatch: 12855025` over a plain TCP socket to the
`-remotemonitor` port. Full probe evidence in
`.planning/notes/text-monitor-channel-live-probe.md`.

`.planning/notes/stock-vice-migration-revised-loss-ledger.md` (Loss 5, route 2)
had this right — "text monitor's real `stopwatch`/`sw` … usable because
`-binarymonitor` and `-remotemonitor` **coexist**". Pitfall 5 contradicted an
existing, correct, source-grounded finding in this same tree, and Pitfall 5 is
what Phase 7 acted on. That is why the second port has been opened on every stock
instance since Phase 3 and never dialed.

## Why it matters beyond one paragraph

Pitfall 5 is load-bearing for more than the stopwatch. Believing the text channel
unreachable is what leaves these recorded as unavailable on stock when they are
not (all confirmed live on 3.9): `chis` CPU history with per-entry cycle counts,
`memmapshow`/`memmapzap` execute-access mapping, the `prof` profiler, `bt`
backtrace, `io` semantic register decode, `warp on/off`, and `device c:` — the
`default_memspace` escape hatch CLAUDE.md records as having no remedy.

## Solution

- Rewrite the `07-RESEARCH.md` alternative row and Pitfall 5 to keep the narrow
  binary-port claim and drop the "interactive console only" generalization.
  Name `-remotemonitor` / `monitor_network.c` explicitly so the next reader cannot
  repeat the inference.
- Do **not** rewrite Phase 7's *decision*. Rejecting the text route for the cycle
  bracket may still have been right on its merits (a second channel, its own
  ownership question, halt-on-command semantics). Correct the stated reason, and
  say plainly that the decision was taken on a false premise even if the outcome
  stands.
- Add scoping clauses to the three CLAUDE.md constraints listed in the note —
  CPU-history-needs-3.10, no-runtime-WarpMode, and default_memspace-has-no-remedy.
  Each is true of the binary monitor and each has a text-channel remedy. Scope
  them; do not delete them.
- Re-check the pending todo
  `2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it`: its
  argument that warp must be a launch-time, per-backend, warm-instance-eligibility
  dimension rests on constraint 2. Runtime `warp on` may remove warp from that
  todo entirely, leaving headless as the only genuine launch-mode dimension.
- Consider whether `docs-linerefs.test.ts`-style mechanical pinning should cover
  the claim, given a correct finding in one planning artifact was overridden by an
  incorrect one in another with nothing catching it.

## Resolution

Resolved by Phase 39 plan `39-02` (2026-09-07). Four edits made, each citing
`.planning/notes/text-monitor-channel-live-probe.md`:

1. `.planning/phases/07-cycle-timing-and-wedge-triage/07-RESEARCH.md` — the
   Alternatives Considered row and Pitfall 5 both keep the narrow
   `t_binary_command` claim and now name `-remotemonitor` / `monitor_network.c`
   as the third route. Phase 7's decision to reject the text route is
   unchanged; only its stated reason is corrected, with an explicit note that
   it rested on a false premise.
2. `CLAUDE.md` — the three Constraints bullets this distortion produced
   (`CPUHISTORY_GET` version floor, no-runtime-`WarpMode`, `default_memspace`
   no-remedy) each gained a `binary monitor only` scoping clause naming the
   measured text-channel remedy. Original assertions untouched.
3. `.planning/notes/stock-vice-migration-revised-loss-ledger.md` — Loss 5
   route 2 (which already had this right) now cross-references the
   contradiction and names Phase 39 as where the port was first dialed.
4. This file, moved from `.planning/todos/pending/` to
   `.planning/todos/completed/` with its `## Deferred Items` row removed from
   `.planning/STATE.md` in the same commit.

The sibling pending todo
`2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it` was
re-checked as this todo instructs. It was found to already be resolved
(2026-09-03, by Phase 33's additive acquire `profile`/warm-instance
eligibility work) — its own Resolution section already incorporates this same
correction (runtime `warp on`/`warp off` over the text channel, not a
launch-time dimension) and cites this file by name. Nothing was open to act
on; its file and ledger status are left exactly as they were found. See
`39-02-SUMMARY.md` for the full finding.
