---
title: routine-queue-walker paraphrases c64-program-recon's procedure and drops its hazards
date: 2026-09-11
priority: medium
source: /gsd-explore — skill redundancy audit
resolved: 2026-09-12
---

> **Resolved 2026-09-12** as a ride-along in phase 52 plan 08 (fork-backend removal). §2.2
> "Walk it" now delegates to `c64-program-recon`'s "Documenting one routine, end to end"
> procedure by reference — including the 4096-byte `anno_read_region` cap and the tail-call /
> fall-through bounds rules this todo names — instead of paraphrasing it. Not a Phase 52 success
> criterion; landed only because these pages were already open in the same pass.

# What

`c64-program-recon` SKILL.md:414-419 declares the contract:

> Building the backlog of every undocumented routine in a project and draining it to closure is
> `routine-queue-walker`'s job — **it calls into this procedure once per queue entry**.

`routine-queue-walker` does not call into it. Its only two references to `c64-program-recon` are
orientation (SKILL.md:16) and packer-finding (:53). §2.2 "Walk it" carries a compressed
paraphrase instead, and the paraphrase has lost the hazards. MEASURED 2026-09-11:

    hazard                          recon   memmap   routine-queue-walker
    4096-byte anno_read_region cap      5        5        0
    tail call / falls through           4        0        0
    view omitted (the default)          1        0        0

# The two failures this causes

1. **The read cap.** §2.2 instructs "read the routine's bytes with `anno_read_region` over the
   explicit range" with no mention that the combined byte count is capped at 4096 and a request
   above it is REFUSED BY NAME rather than truncated. `c64-program-recon` §3 also says to read a
   longer routine as consecutive ranges, and warns against raising the cap because the cap is
   what stops a "read this routine" call becoming a whole-program export. An agent driving a
   backlog hits this on decrunchers and level builders — exactly what a backlog is full of — and
   has no instruction for it.
2. **The bounds.** §2.2 says "always work from an explicit address" but never says how to find
   the END. Both hard shapes live only in `c64-program-recon` §2: a `JMP shared_epilogue` tail
   call still ENDS the routine, and a routine with no return may FALL THROUGH into the next,
   which the comment must say. A queue walker mis-bounds precisely the routines whose bounds are
   hard.

# Fix

Rewrite §2.2 and §3.2 to delegate to `c64-program-recon`'s "Documenting one routine, end to end"
procedure, as the contract already claims they do — keeping only what is genuinely
queue-specific (one entry at a time to completion; no premature halting; the per-entry record
that feeds the Phase 4 report). §3.2 already delegates to `c64-memory-mapping` for naming
conventions, so the pattern to copy is in the same file.

Small — roughly ten lines, no restructure, no frontmatter change, so no effect on triggering.

# Why not just copy the hazards in instead

That is the option to weigh, not dismiss: a skill is loaded in isolation when its trigger fires,
so self-containment has a real argument behind it. The evidence against it is this defect itself
— the self-contained copy is what decayed. It kept the procedure's shape and lost its hazards,
and nothing detected that for as long as it has been true. Copying the hazards in re-arms the
same decay. Prefer delegation; if self-containment wins anyway, the hazards must be copied in
FULL and something must pin them, or this recurs.

# Do not read this as "the skills are duplicated"

They are not. 12 duplicated lines across 11,040. The three-way split between
`c64-program-recon`, `routine-queue-walker` and `c64-memory-mapping` is deliberate and declared,
and `c64-memory-mapping` honours it (SKILL.md:448-449). This is one side of one contract not
being held. Full audit: `.planning/notes/skill-redundancy-audit.md`.
