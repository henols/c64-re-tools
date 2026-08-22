---
created: 2026-08-22T00:00:00.000Z
title: 02-REVIEW.md IN-05 -- stockReconnect()'s thrown message names the wrong function
area: mcp
priority: low
resolves_phase: 15
files:
  - .claude/mcp/vice/stock-connect.ts:537
  - .planning/phases/02-stock-backend-connection/02-REVIEW.md:667-673
---

## Problem

`02-REVIEW.md`'s `IN-05` (lines 667-673): `stockReconnect()`'s thrown `MachineRestartedError`
message began `"stockConnect: reconnect to target …"` while the same throw's `where` field
correctly said `"stock-connect.ts:stockReconnect"`. The message text is what actually reaches
the calling agent, so a wrong function name there misdirects diagnosis even though the
structured `where` field was always right. The review's own citation (`stock-connect.ts:322`)
had drifted by the time this was re-verified; the real site was `:537`, inside
`stockReconnect()` (starts `:529`) -- confirmed directly against current source before editing.

## Why it stayed open

Correctly recorded as a confirmed-live straggler in plan 11.1-07's disposition ledger
(`.planning/todos/completed/2026-08-21-phase-10-and-11-review-residual-dispositions.md`,
its own `### 02-REVIEW.md IN-05` section) at the v0.3.0 close -- "a trivial one-line fix,"
but `stock-connect.ts` sat outside every intervening phase's scope fence (Phase 2 family,
not r2000, not the Phase 4 disassembler family), so no phase's plan ever touched it. This
todo supersedes that entry: the finding it described as still open is now fixed.

## Resolution

**Fixed.** Commit `9849224`. `stockReconnect()`'s thrown message now reads `"stockReconnect:
reconnect to target …"`, naming the same function its `where` field already named correctly.

Verified live: `grep -c 'stockReconnect: reconnect to target' stock-connect.ts` returns `1`;
`grep -v -E '^\s*(//|\*|/\*)' stock-connect.ts | grep -c 'stockConnect: reconnect to target'`
returns `0`.

Pinned by a new derived test in `stock-connect.test.ts` ("02-REVIEW.md IN-05 pin: every
thrown message naming a function via a `where: \"stock-connect.ts:<fn>\"` field is prefixed
with that SAME function's name"): it scans `stock-connect.ts`'s own source for every
`where: "stock-connect.ts:<fn>"` throw site and asserts the message template's own leading
`<name>:` prefix matches. Not a literal-string assertion -- it survives future wording
changes and also covers any future such throw added inside `stockConnect()` itself, not only
the one site this finding named. Confirmed non-vacuous: temporarily reverted to the old
`stockConnect:` prefix, re-ran `node --test stock-connect.test.ts`, and the new test failed
naming the exact mismatch (`thrown message is prefixed "stockConnect:" but its own where:
field names "stockReconnect"`); restored the fix and re-confirmed green (38/38, was 37/37
before this change).
