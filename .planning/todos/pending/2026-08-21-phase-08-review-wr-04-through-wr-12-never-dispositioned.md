---
created: 2026-08-21T00:00:00.000Z
title: Phase 08's WR-04 through WR-12 (08-REVIEW.md) were never fixed, filed, or recorded anywhere
area: testing
files:
  - scripts/generate-tool-support-table.mjs
  - scripts/check-skill-tool-coverage.mjs
  - .claude/mcp/vice/capability-registry.test.ts
  - .claude/mcp/vice/tool-support-table.test.mjs
  - scripts/check-skill-fork-honesty.mjs
---

## Problem

Found while plan 11.1-07's Task 4 (`docs-review-disposition.test.ts`, the AUDIT-01
completeness guard) scanned every `*-REVIEW.md` in `.planning/phases/`, not just Phase
10/11's. `08-REVIEW.md` (`08-capability-honesty-and-the-install-story`, v0.2.0's Phase 8)
reported 2 Critical + 14 Warning findings. `08-VERIFICATION.md` only ever named CR-01,
CR-02, WR-01, WR-02, WR-03, WR-13 and WR-14. The v0.2.0 milestone audit's `tech_debt`
block for this phase (`.planning/milestones/v0.2.0-MILESTONE-AUDIT.md`) names WR-01,
WR-03, WR-13 and WR-14 — the same subset, restated. **WR-04 through WR-12 (9 findings)
appear in no VERIFICATION.md, no todo, no milestone audit, no `*-REVIEW-FIX.md`** (this
phase has none) — exactly AUDIT-01's "no disposition anywhere" pattern, one milestone
earlier than the audit that named it.

Spot-checked directly against current source (not assumed): **all three checked are
still unfixed.**

- **WR-04** — `scripts/generate-tool-support-table.mjs` still interpolates
  `row.note`/`row.name` straight into a `| ... |` markdown row with no `|`/newline
  escaping (no `cell()`-shaped helper present at the emission point).
- **WR-08** — `generate-tool-support-table.mjs:118`'s `discoverSyntheticToolNames()`
  declaration regex is unchanged: `[\s\S]*?` is still unbounded past the declaration's
  own closing brace.
- **WR-12** — no `scripts/lib/skill-corpus.mjs` (or equivalent) exists; `ls scripts/lib/`
  shows only `r2000-cli-verbs.*` and `skill-honesty-checks.*`.
  `check-skill-fork-honesty.mjs` and `check-skill-tool-coverage.mjs` still each carry
  their own copy of `walkSkills()`/`MCP_PREFIX_RE`/`TOOL_NAME_RE`.

WR-05, WR-06, WR-07, WR-09, WR-10, WR-11 were not individually re-verified against
current source in this pass (time-boxed); given the consistent pattern above and the
total absence of any disposition trail, treat them as still open too until re-checked.

## Why it was deferred

`08-capability-honesty-and-the-install-story` is a v0.2.0 phase (this milestone's
Phase 8, closed 2026-08-19) — entirely outside plan 11.1-07's stated scope (the
`R2000-*`/regenerator2000 family) and outside this milestone's (`v0.3.0`) three phases.
Filing rather than fixing keeps this closure phase's diff to what it was scoped for.

## What to do

Re-verify WR-05 through WR-11 against current source the way WR-04/08/12 were checked
above, then apply each finding's own suggested fix from `08-REVIEW.md`
(`scripts/generate-tool-support-table.mjs:330-660`, roughly). Several are genuinely
small (WR-04's `cell()` escaping, WR-06's tautology removal); WR-12's shared-module
extraction (`scripts/lib/skill-corpus.mjs`) is the largest.

**Verify:** `node --test capability-registry.test.ts tool-support-table.test.mjs`,
`node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-skill-fork-honesty.mjs`
all stay green; add the non-vacuity/cell-count assertions each finding's own `Fix:`
section suggests.
