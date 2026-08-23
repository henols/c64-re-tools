---
created: 2026-08-21T00:00:00.000Z
title: Stale phase pointers in stock-cia.ts and stock-dispatch.ts comments, outside the r2000 family
area: docs
files:
  - .claude/mcp/vice/stock-cia.ts
  - .claude/mcp/vice/stock-dispatch.ts
resolves_phase: 16
---

## Problem

Found while dispositioning Phase 10/11's review findings for plan 11.1-07 (AUDIT-01).
Two comment-only sites hand work to a numbered phase, the exact FLOW-02 defect class
plan 11.1-01 fixed and guarded — but in comments, which that guard (`docs-dangling-refs.test.ts`'s
string/template-literal scanner) deliberately does not and will not cover (a comment-scoped
guard would be self-invalidating against its own fix commits; see 11.1-01-SUMMARY.md's
"Known Limitations").

1. **`stock-cia.ts:39`** — `vice_keyboard_matrix`'s full-matrix recovery "is Phase 8's
   business." Phase 8 (Capability Honesty and the Install Story) is complete, and its
   own verification confirms it did NOT (and structurally cannot) deliver full stock
   keyboard-matrix recovery — `CLAUDE.md`'s own standing constraint says the matrix is
   "not recoverable on stock" at the protocol level (`KEYBOARD_FEED` injects text only),
   and `08-VERIFICATION.md` confirms every skill names `vice_keyboard_matrix` as
   fork-only at point of use instead. Phase 8's actual "business" here was the *honesty*
   obligation (document the limitation, name the fork requirement), and that has been
   discharged — just not by touching this comment.

2. **`stock-dispatch.ts:614-615`** — two tools deliberately unregistered on stock,
   each with a "Phase 7" pointer:
   - `vice_disk_detach` ("D-13 -- Phase 7, via the text monitor")
   - `vice_joystick_tap` ("needs a resume plus Phase 7's timing route")

   Phase 7 (Cycle Timing and Wedge Triage) is complete and delivered neither. For
   `vice_joystick_tap`, the pointer is now doubly stale: `stock-input.ts`'s own header
   has since made a **separate, permanent** exclusion decision ("Never add
   vice_joystick_tap. A tap needs the machine to RUN for a duration...") — that decision
   supersedes the "needs... Phase 7's timing route" framing, which reads as though the
   work is merely pending. For `vice_disk_detach`, no later phase or decision has picked
   it up or formally cut it; the "Phase 7" pointer is unclaimed backlog, not a live plan.

## Why it was deferred

Comment-only, no functional impact (both tools remain correctly unregistered either
way), and outside the two protected/in-scope families for Phase 11.1 (r2000, and the
Phase 4 disassembler standing protection). Fixing the wording is a one-line-per-site
doc change but is real triage work belonging to whichever phase next touches the Phase-3
tool surface (`stock-dispatch.ts`) or the CIA/keyboard family (`stock-cia.ts`) — not this
audit-closure phase, which only dispositions.

## What to do

- `stock-cia.ts:39`: reword to drop the phase-number framing; state the permanent
  protocol limitation directly (matrix keyboard unrecoverable on stock) rather than
  attributing it to a phase's business.
- `stock-dispatch.ts:614-615`: reword the `vice_joystick_tap` line to point at
  `stock-input.ts`'s own permanent-exclusion header instead of "Phase 7's timing route".
  For `vice_disk_detach`, either pick it up as real backlog (a stock `disk_detach`
  handler via the text monitor) or make an explicit, recorded cut decision the way
  `vice_disk_read_sector` was cut in v0.2.0 — do not leave it pointing at a phase that
  already closed without it.
