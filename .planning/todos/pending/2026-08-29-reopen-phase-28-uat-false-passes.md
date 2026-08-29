---
created: 2026-08-29
source: /gsd-explore — see .planning/notes/uat-gate-launders-abstentions.md
severity: major
kind: data-correction
---

# Phase 28's UAT records three passes that contradict its own verification

## The contradiction, as it stands in the tree right now

`.planning/phases/28-the-store-core/28-UAT.md` — `total: 3, passed: 3, issues: 0`,
all three `result: pass`.

`.planning/phases/28-the-store-core/28-VERIFICATION.md:6` — `behavior_unverified: 2`.

`.planning/phases/28-the-store-core/28-VERIFICATION.md:349` records prohibition
**28-18 P3**, verdict `held`:

> MUST NOT close, silently drop, **or re-file as done** a carried-forward
> `behavior_unverified` item.

The verifier held that prohibition on the grounds that (`:352-353`):

> Both are recorded STILL OPEN at `.planning/REQUIREMENTS.md:252-257`

And `.planning/REQUIREMENTS.md:252-257` still says so today:

> **Both `behavior_unverified` items are STILL OPEN, carried forward with their
> reasons unchanged, and are claimed closed by NOTHING in round 6**
> (prohibition 28-18 P3)

…with both rows reading **STILL OPEN**, the second "abstained again as
`insufficient_spec`."

**So the same two items are simultaneously STILL OPEN in REQUIREMENTS.md and
`pass` in 28-UAT.md.** The UAT keypress did the exact thing prohibition 28-18 P3
forbids, one step after the verifier held it.

## The three items

| # | Item | Truthful state |
|---|---|---|
| 1 | `openStore`'s `integrity_check could not be run at all` throw arm (`anno-store.ts:534-539`) | Open since round 4; needs filesystem/SQLite fault injection. Nothing exercises the throw. |
| 2 | 28-17's `backstop` host-crash durability bound across `stageSnapshot` fsync → `publishSnapshot` rename → pointer-row commit | Abstained `insufficient_spec`; `fsync` has no in-process observable. |
| 3 | Review of 14 judgment-tier prohibition verdicts, **2 recorded `violated`** (28-21 P1, 28-07 P3 — WR-31's two comments at `anno-store.ts:2131-2139` and `:1918-1922`) | Never reviewed. `28-VERIFICATION.md:396` states the verdicts are "NON-AUTHORITATIVE LLM-judge readings and must not be absorbed into a silent pass." |

Item 3 is the one with a real decision waiting in it: whether a comment scoped in
its own words to *the remainder*, which a reader will take as covering *the row*,
is a false guarantee — and whether the correction rides the next edit to
`retype()` or needs its own commit.

## What to do

Rewrite the three `28-UAT.md` entries to `result: unverified` with their carried
reasons (`fault_injection_required`, `insufficient_spec`, `judgment`), and correct
the Summary block (`passed: 3` → `passed: 0, unverified: 3`).

Then actually make the item-3 decision, which is the only one a human can settle
without new tooling.

## Do this through a GSD workflow, not from the orchestrator seat

This is a correction to a verification record. Writing it directly from an
orchestrator turn is precisely the failure mode that produced the bad data —
facts written outside the evidence protocol skip the conventions the plans
enforce. Route it through `/gsd-quick` or a gap-closure plan so the correction
carries its own provenance.

Note also that `phase.complete` has a known habit of flipping unmet requirements
to Complete; check `.planning/REQUIREMENTS.md:252-257` still reads STILL OPEN
after any phase-state verb runs.

## Blocked-by note

Fixing the data without fixing the gate means the next phase reproduces it. See
[[uat-unverified-disposition]].
