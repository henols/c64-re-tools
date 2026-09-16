---
created: 2026-09-14T17:05:00.000Z
title: audit-gate.mjs's shared 15s guard budget marks the last docs guards red under suite load
area: testing
severity: major
files:

  - scripts/audit-gate.mjs:296
  - src/mcp/vice/audit-integrity.test.ts:245

audit_acknowledged:
  milestone: v1.0.0
  at: 2026-09-16
---

# What

`runGuardsLive()` (`scripts/audit-gate.mjs`) gives all ten `docs-*.test.ts`
guards ONE shared `GUARD_RUN_TIMEOUT_MS = 15000` budget and runs them
sequentially in `readdirSync` (alphabetical) order. When the budget runs out,
every guard not yet reached is marked **red without being run** — deliberately
fail-closed, and correct as a design when the budget is generous.

The budget is no longer generous. The constant's own header says "Measured: all
ten real guards complete in about 1.7s total, far under this budget."

MEASURED 2026-09-14 on a quiet machine, sequentially, one `node --test` per file:

    470ms  docs-absorbed-decisions.test.ts
    421ms  docs-constraints-sync.test.ts
    435ms  docs-core-value-decision.test.ts
    576ms  docs-dangling-refs.test.ts
    400ms  docs-deferred-ledger.test.ts
    737ms  docs-fork-absence.test.ts
    359ms  docs-fork-decision.test.ts
    699ms  docs-review-disposition.test.ts
    458ms  docs-uat-abstention.test.ts
    656ms  docs-worktree-isolation.test.ts
    ----
    4343ms total

That is 2.5x the documented 1.7s on an idle host, against a 15s ceiling. Inside
a full `npm run test:automated` run — where `audit-integrity.test.ts` spawns the
gate while ~4400 other tests compete for the same cores — the ten spawns exceed
15s and the tail of the list loses.

# Observed

Two consecutive full-gate runs, same tree, same two guards:

    ✖ no milestone audit declares a gated status while any docs guard is red (D-12-02) (15640ms)
      red guard(s): docs-uat-abstention.test.ts, docs-worktree-isolation.test.ts

Those are exactly the **last two files alphabetically**. Three independent
confirmations that neither guard is actually red:

1. `node --test docs-uat-abstention.test.ts docs-worktree-isolation.test.ts`
   → 13 tests, 13 pass, 0 fail, exit 0.
2. `node scripts/audit-gate.mjs --json` standalone → `allowed: true`,
   `redGuards: []`, `guardFiles: 10`.
3. The failing assertion's own captured output contains a
   `=== <file> ===` marker for only the FIRST FIVE guards — the rest produced
   no output at all, which is what "never run" looks like.

The failure duration (15640ms) sits right on the 15000ms ceiling.

# Why this matters

The symptom is a guard reporting red on a correct tree, which is the exact
failure class `audit-gate.mjs`'s own header calls out as the thing to avoid. It
is also load-dependent and therefore intermittent, so it reads as a fresh
regression to whoever next runs the suite — it already cost one investigation
during phase 51 execution.

# Not fixed here

Phase 51 (planning-vocabulary sweep) touches nothing `audit-gate.mjs` reads, so
this is inheritance, not a phase-51 regression. Filed rather than fixed because
the repair is a real design decision in a live guard and must not be made as a
drive-by: the shared budget exists so the whole gate stays under the 30-second
PreToolUse hook budget in `.claude/settings.json`, and simply raising the
constant trades one contract for the other.

Options worth weighing when this is picked up, none of them free:

- Run the ten guards in one `node --test` invocation instead of ten spawns —
  removes ~10 process startups, but collapses the per-file attribution the
  `perFile` record exists to provide.
- Keep the shared budget for the hook path and give the in-suite path
  (`NODE_TEST_CONTEXT` present, already detected and stripped in this function)
  a larger one — the 30-second hook contract does not bind there.
- Distinguish "budget exhausted, never run" from "ran and failed" in the
  verdict, so an exhausted guard is a gate ERROR rather than silently a red
  guard. Fail-closed either way, but it stops mislabelling the cause.
