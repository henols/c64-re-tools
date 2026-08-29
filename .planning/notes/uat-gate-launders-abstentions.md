---
title: The end-of-phase UAT gate launders abstentions into passes
date: 2026-08-29
context: /gsd-explore — "why is there implemented a human check point for several flows
  that stops and don't really ask for anything of value and want the human say pass?"
scope: .claude/gsd-core (vendored GSD install), not this repo's own source
---

# The UAT gate launders abstentions into passes

## The complaint that started this

The end-of-phase human checkpoint stops the flow, asks for something the human
cannot supply in the moment, and the only available exit is to say "pass". It
reads as pure friction.

It is worse than friction. The gate does not merely fail to add information —
it *destroys* information that upstream GSD spent real design effort producing.

## The two mechanisms

**1. The default keypress is `pass`.**

`gsd-core/workflows/verify-work.md:24` (the `<philosophy>` block):

> - "yes" / "y" / "next" / empty → pass
> - Anything else → logged as issue, severity inferred

Confirmed again in the `process_response` step (`verify-work.md:320-321`):
empty response, `yes`, `y`, `ok`, `pass`, `next`, `approved`, `✓` all write
`result: pass`. **Hitting Enter records a verification that never happened.**

**2. There is no disposition for "I cannot verify this."**

```
$ grep -c "unverified\|insufficient_spec" gsd-core/workflows/verify-work.md
0
```

The UAT rail's entire result vocabulary is `pass | issue | skipped | blocked`:

- `skipped` requires a `reason` and reads downstream as *didn't bother*.
- `blocked` requires an inferred `blocked_by` environmental tag
  (`verify-work.md:341-358` matches on "server", "not running", "physical
  device", "release build").

Neither expresses *"this is unverifiable by construction and is being carried
as a known gap."* So an item that is genuinely unverifiable has no truthful
exit, and the untruthful one is the default keypress.

## What that produced in this repo

`.planning/phases/28-the-store-core/28-UAT.md` — `total: 3, passed: 3, issues: 0`:

| # | What the item asked for | What `pass` actually means |
|---|---|---|
| 1 | Fault-inject so `pragma integrity_check` itself throws inside `openStore` | No fault injection was performed |
| 2 | Host-level crash / power-loss injection across the `stageSnapshot` fsync → `publishSnapshot` rename → pointer-row commit sequence | No machine was power-cycled |
| 3 | Human review of 14 judgment-tier prohibition verdicts, **including 2 recorded `violated`** (28-21 P1, 28-07 P3, at `anno-store.ts:2131-2139` and `:1918-1922`) | Two recorded violations rubber-stamped |

Item 2's own `why_human` field states the contradiction in plain text:

> the abstention (`insufficient_spec`) is recorded rather than scored

…and the line beneath it reads `result: pass`.

## Why this contradicts GSD's own design

`gsd-core/references/honest-verifier.md` is explicit that a non-inferable
(`verification: backstop`) truth without explicit evidence must be:

> **abstain** → ⚠️ `insufficient_spec`, flagged, → `human_needed` — **never `passed`**

and that the disposition carries `reason: insufficient_spec` specifically

> so the `human_needed` outcome is never conflated with an ordinary manual-UAT
> `human_needed`.

Upstream measured this discipline dropping the confident-false-pass rate on
blind-spot checks from **100% → 17%**. The whole point is that "we do not know"
must survive to a human.

It does survive — right up to the UAT gate, which has no vocabulary for it and
a default keypress of `pass`. **The gate exists to carry abstentions to a human
and its default exit is the one thing the design says must never happen.**

## The consequence for the removal question

The instinct to remove the gate is directionally right but mis-aimed. Deleting
it loses the abstention too — same information loss, less ceremony. The defect
is the missing disposition, not the stop:

- A gate with a truthful non-blocking exit costs nothing and keeps the signal.
- A gate whose only exit is a lie costs a round-trip *and* corrupts the record.

Related: the plan-phase gates (`plan-phase.md` steps 9b, 9c, 13, 13a) are all
**conditional** — they fire only when a requirement or decision is genuinely
uncovered, and never on a clean run. They are already failure-only gates and
are not part of this problem.

See [[uat-unverified-disposition]] for the proposed fix and
[[reopen-phase-28-uat-passes]] for the live bad data this already wrote.
