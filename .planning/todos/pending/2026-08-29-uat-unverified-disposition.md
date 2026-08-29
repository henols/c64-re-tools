---
created: 2026-08-29
source: /gsd-explore — see .planning/notes/uat-gate-launders-abstentions.md
severity: major
scope: .claude/gsd-core (vendored install — see the durability note below)
---

# Give the UAT gate an `unverified` disposition

## Goal

Stop the end-of-phase human checkpoint from blocking on items no human can
resolve in the moment, **without** converting those items into false passes.
Keep the gate; give it a truthful exit that does not halt.

This is the "keep only failure gates" shape: a gate that fires only when a human
can actually *do* something, and records everything else honestly instead of
asking for a keypress it will read as approval.

## The change

**1. Add `result: unverified` to the UAT result vocabulary**
(`gsd-core/workflows/verify-work.md`, `process_response` step, ~line 320).

```
### {N}. {name}
expected: {expected}
result: unverified
reason: insufficient_spec | judgment | fault_injection_required
carried: true
```

Distinct from `skipped` (which reads as *didn't bother*) and from `blocked`
(which asserts an environmental blocker that will later clear).

**2. Auto-classify on write, not on keypress.**
`create_uat_file` already receives each item's `why_human` and, for
honest-verifier items, its `reason: insufficient_spec`. When an item arrives
carrying `insufficient_spec`, or its source truth is `verification: judgment` /
`verification: backstop`, write it **pre-resolved as `unverified`** and do not
present it as a checkpoint at all — exactly the mechanism `#1602` already uses
for `auto_passed[]` entries (`verify-work.md:262-272`, `source: automated`).

The precedent is established: that code path already writes a resolved result
without asking the user. This adds a second resolved-without-asking case whose
value is `unverified` rather than `pass`.

**3. Change the empty-response default.**
`verify-work.md:24` maps bare Enter to `pass`. For items that survive to a real
checkpoint this is defensible; for anything carrying an abstention tag it is the
defect itself. At minimum, empty response must not resolve an
`insufficient_spec` item.

**4. Surface the count instead of blocking on it.**
Phase completion line becomes e.g. `complete — 3 unverified (2 insufficient_spec,
1 judgment)`. `honest-verifier.md` already specifies this exact shape for the
autonomous path: *"the completion line reads 'complete with N unverified
non-inferable checks'; the run neither silently passes the blind spot nor
hard-halts."* Applying it to the interactive path too is the whole fix.

## Why not just delete the gate

Deleting it loses the abstention as well — the same information loss with less
ceremony. The stop is not the problem; the missing vocabulary is. See the note.

## Durability problem — resolve before implementing

`.claude/gsd-core/` is a **vendored install** (untracked; `/gsd-update`
overwrites it). A local edit to `verify-work.md` is lost on the next update and
leaves no trace explaining why UAT behavior silently reverted.

Open question captured separately in `.planning/research/questions.md`
("Local patch, config knob, or upstream fix…"). Do not start the edit until that
is answered — the answer changes *where the code goes*, not what it does.

## Not in scope

The plan-phase gates (`plan-phase.md` steps 9b, 9c, 13, 13a) are already
conditional failure-only gates and never fire on a clean run. Leave them alone.
