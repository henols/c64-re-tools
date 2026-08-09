# Which `mcp__plugin_c64-rc-tools_vice__*` call answers which question

**This is not a restatement of the tool surface.** You already hold typed schemas for every
call; read parameters off those. What the schemas cannot tell you is *which call to reach for
first*, and that ordering is the whole value here.

Curated from `.planning/RE-FINDINGS.md`'s tool-to-question entry (2026-08-01, doc-derived,
**Confidence: MEDIUM** — the mapping is reasoned from the tool surface and this project's own
usage, not measured). Individual rows that have since been exercised live are marked.

| Question | Call |
|---|---|
| Vectors, `$01`, `$D011`/`$D012`/`$D018`/`$D019`/`$D01A`, `$DC0D`/`$DD0D`, `$DD00` | `vice_memory_read` — highest-value first move; answers most vector questions in one or two calls |
| What does the handler at this vector do? | `vice_disassemble` — the emulator's own decoder, not a dead listing |
| Is this really the main loop? | `vice_checkpoint_add` + `vice_run_until` + `vice_registers_get` — fires once per frame ⇒ proven |
| What code writes this? | `vice_watch_add` — finds **writers**. Best targets: `$D018`, VM+`$03F8`, `$D404` |
| Whole-chip state without the read hazards | `vice_vicii_get_state` / `vice_sid_get_state` / `vice_cia_get_state` — **prefer these over raw register reads** |
| Decode sprite data | `vice_sprite_get` / `vice_sprite_inspect` |
| Find a known byte pattern | `vice_memory_search` |
| Carry labels across sessions | `vice_symbols_load` / `vice_symbols_lookup` — ACME `--vicelabels` and regenerator2000 output share this channel |
| Is the machine wedged, or did it stop itself? | `vice_diagnose` — five-state verdict with its evidence. **Reachable and proxy-intercepted as of 2026-08-04** (verified live). Triage tree: `vice-wedge-triage` |
| Replace a wedged instance | `vice_recycle` — destructive, requires a `reason`, and that reason is written into `.planning/incidents/` **before** anything is killed. The reason *is* the evidence record |
| Read the restart epoch | **No tool does.** The proxy compares it around every forwarded call and raises drift itself; a value comes from that error or from `vice_diagnose` |

## Delegate rather than restate

| Question | Go to |
|---|---|
| What does address X mean? | the `c64-memory-mapping` skill — `node … lookup '$D018'`. **Do not restate its tables.** |
| Is this byte original or cracker-changed? | the `c64-provenance-diff` skill |
| A verified 64K image, or comparing two captures | the `c64-ram-capture` skill |
| Fast first-pass listing | `toacme` — decodes data as instructions; never the deliverable |
| Traced disassembly with code/data separation | regenerator2000 — still MEDIUM per `STACK.md`; its first real run is its verification |

## Three traps in this table

**`vice_run_until` has no working timeout.** Its schema documents `cycles` as *"not yet
implemented"*, so a run to an address the program never reaches has nothing to bound it and looks
exactly like a wedged emulator. Prefer `vice_checkpoint_add` + a bounded poll when the address is
a hypothesis rather than a certainty. **Confidence: MEDIUM** — read off the schema, not reproduced.

**`vice_diagnose` leaves the machine paused.** When it measures a cycle bracket it resumes the
machine once or twice and then leaves it **paused** — resuming is your own next call. And a
`checkpoint_trap` verdict means the machine stopped *itself* at an armed checkpoint: it must
**not** be recycled, because recycling a self-inflicted stop destroys a healthy instance.

**Prefer the `*_get_state` calls, but know they pause.** They avoid the raw-register read
hazards, but most state reads pause the emulator. Read everything first, poll with `vice_ping`,
and resume exactly once at the end. See `observation-hazards.md`.

## The standing constraint

`mcp__plugin_c64-rc-tools_vice__*` is the only route to the emulator. Any step of a method that would want a Node
process talking to VICE is dead on arrival and must be expressed as agent-performed tool calls —
the same rule that reduced `c64-ram-capture` to a procedure and deleted its original `scripts/`.
