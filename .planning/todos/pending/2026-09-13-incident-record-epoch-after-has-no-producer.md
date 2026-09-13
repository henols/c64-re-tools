---
title: incident records always write epoch_after: null — stock-recycle.ts never supplies it
date: 2026-09-13
priority: medium
source: planning-time measurement while re-baselining vice-proxy.test.ts (quick task 260913-v9e)
---

# What

`incident-record.ts` accepts `epoch_after` (`:247`), defaults it to `null`
(`:276`), and writes it into both the YAML frontmatter (`:295`) and the prose
body (`:324`, rendering `(not yet known)` when absent).

All three of `stock-recycle.ts`'s calls pass only `outcome` and `kill_stage`:

    stock-recycle.ts:446   finaliseIncidentRecord(recordPath, { outcome });
    stock-recycle.ts:471   finaliseIncidentRecord(recordPath, { outcome: ack.outcome || "refused", kill_stage: killStage });
    stock-recycle.ts:475   finaliseIncidentRecord(recordPath, { outcome: "ok", kill_stage: killStage });

`grep -rn epoch_after src/mcp/vice/*.ts` outside tests hits only
`incident-record.ts` itself. So the field has **no producer**: every incident
record ever written since the fork removal records `epoch_after: null`.

# Why it matters

The post-kill epoch poll is what distinguishes "the machine was really replaced"
from "the kill was confirmed but the epoch never advanced" — the second being a
state worth catching, since it means a recycle reported success without the
instance actually turning over. An incident record is written *before* any
destructive action specifically so that distinction survives the kill; with the
field always null, it does not.

# Evidence that still exists

One failing test in `vice-proxy.test.ts` proves it:
`vice_recycle: a confirmed kill whose epoch file never advances ... persists
epoch_after as null, never the stale value`. It is the sole remaining evidence.

# Decision owed

Whether losing the post-kill epoch poll is acceptable is the same class of
product judgement the owner settled for the D-16 seam-hazard walk on 2026-09-13
(there: intentional, fork-only, no successor owed, guidance survives in
`vice-wedge-triage`). It has NOT been settled for this one. Three dispositions:
restore the producer in `stock-recycle.ts`, accept the loss and record it, or
accept and retire the test. Do not pick the third silently.
