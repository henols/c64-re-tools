---
created: 2026-08-21T00:00:00.000Z
title: Migrate the two hand-copied ACME gates onto r2000-test-gate.ts's shared seam
area: testing
files:
  - .claude/mcp/vice/r2000-test-gate.ts
  - .claude/mcp/vice/r2000-cli.test.ts
  - .claude/mcp/vice/disasm-roundtrip.test.ts
  - .claude/mcp/vice/r2000-project.test.ts
---

## Problem

`r2000-test-gate.ts` exists because six-plus hand-copied `probeR2000()` bodies is how a
test gate silently diverges — one copy gets its timeout changed, another its regex
loosened, and nobody notices until two test files behave differently for no documented
reason. Its own header says so.

The ACME half of the same gate has three implementations:

1. `disasm-roundtrip.test.ts` — established the `ACME_BIN`/`VICE_REQUIRE_ACME`
   convention in an earlier phase.
2. `r2000-cli.test.ts:698-726` — hand-copied it for criterion 3, **plus** its own
   hand-rolled `probeR2000()`/`SKIP_REASON` at `:457-472` rather than importing the
   r2000 seam that already existed.
3. `r2000-test-gate.ts` — added by the Phase 11 validation audit (2026-08-21) so
   criterion 1's fixture-reproducibility test would not become a fourth copy.

**Corrected during 11.1-07's dispositioning pass (D-11.1-04, IN-07):** the r2000
half of the gate has a *third* hand-copied `probeR2000()`/`SKIP_REASON`/`R2000_AVAILABLE`
block, not just `r2000-cli.test.ts`'s — `r2000-project.test.ts:133-175` carries its own,
independently divergent copy (identical `{ skip }` shape, same module-scope-once
evaluation). 10-REVIEW.md's original IN-07 wording ("duplicated verbatim in three test
files") already named all three files by path, but this todo's `files:` list only ever
carried two of them. Added here so IN-07's home is complete rather than approximately
right.

Note the divergence already present: copies 1 and 2 pass **no timeout** to `spawnSync`,
the seam passes `timeout: 10_000`. That is exactly the drift the seam exists to stop,
observable today.

## Why it was deferred

The validation audit added the seam for its own new consumer but did not migrate the two
existing copies. `r2000-cli.test.ts`'s gate semantics are load-bearing for criterion 3's
**already-verified** Phase 11 evidence (`11-VERIFICATION.md` cites its test 35 by name),
and rewriting a passing 43-test file's gating was outside an audit's remit — an audit
should not silently re-cut the ground under evidence it is auditing.

## What to do

Replace both copies' local `ACME_BIN`/`probeAcme()`/`ACME_AVAILABLE`/hard-FAIL blocks —
and both `r2000-cli.test.ts`'s AND `r2000-project.test.ts`'s local
`probeR2000()`/`SKIP_REASON` (the third copy) — with imports from
`r2000-test-gate.ts` (`ACME_BIN`, `ACME_AVAILABLE`, `acmeSkipReasonFor()`,
`assertAcmeRequiredIfEnvSet()`, `skipReasonFor()`, `assertR2000RequiredIfEnvSet()`).

Then delete the "HONEST SCOPE" paragraph from `r2000-test-gate.ts`'s ACME header — it
documents this todo, and it becomes false the moment this is done.

**Verify:** `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-cli.test.ts
disasm-roundtrip.test.ts r2000-answer-key.test.ts` — same pass counts as before the
migration (43 / current / 9), and `npm run test:automated` green.
