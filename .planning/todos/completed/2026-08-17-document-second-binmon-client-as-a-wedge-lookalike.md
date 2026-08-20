---
title: Document that a second binary-monitor client is indistinguishable from a wedge, and the never---vice rule
date: 2026-08-17
priority: medium
source: /gsd-explore "regenerator2000" — D-R1; folds into v0.2.0 Phase 8 (SKILL-01 / DIST-02)
resolves_phase: 10
---

# A second binmon client looks exactly like a wedged emulator, and nothing tells the user that

Stock VICE's binary monitor services **exactly one client**. A second
`connect()` sits unserviced in the backlog with no reply and no EOF. From the
container side that is behaviourally identical to a hung emulator: the socket is
open, writes succeed, nothing ever comes back.

`PROTO-08` already covers the *code* half — "a second client connecting to an
instance is prevented or reported as a conflict, never diagnosed as a wedged
emulator" (Phase 2, complete). What is missing is the *human* half: nothing
tells a user why their emulator went silent, or which of their own tools could
have caused it.

This became concrete while exploring regenerator2000, which ships a VICE
binary-monitor debugger and auto-connects with `--vice <HOST:PORT>` (default
`localhost:6502`). Any user who points it at an emulator our broker owns will
produce a textbook false wedge. But the hazard is not specific to r2000 — a bare
`x64sc -binarymonitor` plus a stray `nc localhost 6502`, a second Claude
session, VICE's own `-remotemonitor`, or any other 6502 debugger does the same.

## What to do

1. **`vice-wedge-triage/SKILL.md`** — add "another client already holds the
   binary monitor" to the diagnosis table, alongside the four states it already
   distinguishes (genuinely wedged / stopped at your own checkpoint / crashed and
   respawned / merely paused). Give it a discriminator: on the stock backend, a
   socket that accepts a connection but never answers a `PING` is contention, not
   a wedge — and the broker knows whether it already holds a lease on that port.
2. **Install / usage docs (DIST-02)** — state the rule positively: on the stock
   backend, exactly one process may hold `-binarymonitor`. Name the concrete
   trap: do not launch another debugger against a broker-managed instance.
3. **If and when r2000 lands (v0.3.0)** — the never-`--vice` rule needs a real
   guard, not just prose, mirroring the existing `DENY_LIST` pattern in
   `vice.ts`: the launch path must refuse to pass `--vice` rather than trusting
   documentation.

## Why it is worth doing regardless of r2000

Item 1 and 2 are true today for any stock-backend user, cost almost nothing, and
land naturally next to `SKILL-01`'s Phase 8 revision of the same playbook. Item
3 is v0.3.0 scope and should not be pulled forward.

---

## Resolved 2026-08-20 (Phase 10)

Closed across three plans:

1. **Item 1** (the discriminator and named causes in `vice-wedge-triage/SKILL.md`)
   — resolved here, plan 10-09: the skill now states the cheap tell (a socket that
   accepts a connection but never answers is contention, not a wedge) and names
   the concrete causes (a hand-run `nc` session, a second Claude Code session,
   VICE's own `-remotemonitor`, and any other 6502 debugger — including
   regenerator2000's own `--vice` flag), plus the fact that this plugin's own
   regenerator2000 route can never be one of them.
2. **Item 2** (state the rule positively in the install docs) — resolved in plan
   10-08: `README.md`'s one-holder statement near `### Verifying a stock install`
   was extended into the full positive rule with the same named traps.
3. **Item 3** (the real `--vice` guard mirroring `DENY_LIST`) — resolved in plan
   10-01: the launch path refuses `--vice`, unreachable by construction (no
   caller-supplied argv passthrough exists to inject it) *and* denied by a scan
   that throws if the flag is ever present in the final argv, mirroring
   `vice.ts`'s `DENY_LIST` / `denyListRefusalMessage()` precedent.
