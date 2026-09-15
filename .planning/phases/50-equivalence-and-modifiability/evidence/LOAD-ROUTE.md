# Load route decision (Task 1, plan 50-04)

**Date:** 2026-09-15

**Chosen route:** `route-d` — the text monitor's own `load` command, dialed
over the `-remotemonitor` channel (`text-protocol.ts` / `text-connect.ts`),
against a stock, unpatched VICE build.

This is **not** one of the three routes the plan offered. The plan presented
`route-a` (direct memory injection), `route-b` (a hand-authored `.d64`), and
`route-c` (a new `c1541.write` host-tool capability). The developer named a
fourth option instead.

## The developer's answer, verbatim

> "there are commands in the protocols that can load programs, if in both
> use the text protocol"

When shown that `text-protocol.ts`'s own committed guard tests
(`text-protocol.test.ts`) currently refuse any `load`-shaped command by name,
the developer was asked how to proceed and explicitly chose:

> "Widen the allowlist for load"

## Rationale

`text-protocol.ts`'s allowlist rule was never, in principle, "no `load` or
`save`" — it is "no verb that touches a host file". The one file-writing verb
this project had already considered and rejected, `memmapsave`, was rejected
specifically because it **writes** a host file (see that module's own header
comment, plan 43-01). `load`, by contrast, **reads** a host file and writes
nothing back to the host. The developer judged the original blanket
load/save refusal to have over-reached for the read direction, and accepted
this as the load-bearing distinction that makes the widening acceptable:

- `load` never causes VICE to write anything to the host filesystem.
- The widened entry bakes the exact fixture path into the verb's own frozen
  identity (a reviewed literal chosen by this codebase), never a
  caller-supplied filename — so no caller of this module can choose an
  arbitrary host file to load, even after the widening.
- Only the device NUMBER is a caller-supplied, bounded value — the same
  shape every other parameterized verb in this table already uses (`chis`,
  `prof flat`, `io`).

This reverses part of a deliberate, documented invariant
(`text-protocol.ts`'s own "never a file-touching monitor verb" rule and its
two committed guard-test assertions), and it requires amending those two
committed guard tests to narrow — not delete — what they prove. `save`
(the write direction) must still be refused everywhere. Only the one
reviewed, fixed-filename `load` verb is now dialable. See
`src/mcp/vice/text-protocol.ts` and `src/mcp/vice/text-protocol.test.ts` for
the widened allowlist entry, its rationale comment, and the narrowed tests.

## Why each of the plan's three offered routes was rejected

**route-a — direct memory injection via `vice_memory_write` +
`vice_registers_set`.** Rejected. It skips the BASIC stub entirely, so the
committed fixture's actual load path is never exercised — the developer
preferred a route that goes through the monitor's own loader, matching how a
real load actually happens, rather than one that assumes a settled
post-reset machine state and writes bytes in behind it.

**route-b — a hand-authored, committed disk image.** Rejected. It would be
an undocumented, unreproducible binary blob, exactly the discipline this
project's `evidence/`/fixture directories otherwise refuse to accept
(generator-not-hand-committed-blob, per `50-RESEARCH.md`'s own framing of
this gap). The four pre-existing `.d64` images in this tree that appear to
have taken this route are a pre-existing debt, not a precedent to add to.

**route-c — a new `c1541.write` host-tool capability.** Rejected. It
permanently widens the shipped MCP tool surface with a genuinely
file-**WRITING** capability — a one-way change the project's own frozen
`HOST_TOOL_NAMES` list and "never auto-install, detect and refuse by name"
discipline treat as something to avoid unless clearly necessary. Since a
read-direction `load` route sufficed, the write-direction capability was not
needed.

## What this decision changes for later live tasks

Every live capture task in this phase (`50-04` Task 2/3, and `50-05`/`50-06`)
loads the committed hazard-subject `.prg` through the text monitor's `load`
command, dialed over the `-remotemonitor` channel — never through
`vice_autostart` against a bare `.prg` (measured to fail with monitor error
`0x8f`, per `FIXTURE-DESIGN.md`), and never through a `.d64`.
