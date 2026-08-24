# Phase 19 — deferred items (out of scope for the plan that found them)

## 1. `docs-review-disposition.test.ts` is red on 19-REVIEW.md (found by 19-06, deferred to 19-09)

**Found during:** plan 19-06's plan-level verification (`cd src/mcp/vice && npm test`).

**Condition:** the guard reports 17 findings in
`19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md` with no recorded
disposition: `CR-01`, `IN-01`…`IN-04`, `WR-01`…`WR-12`.

**Why deferred rather than fixed:** 19-06's own `<gap_closure_context>` assigns the
dispositions across the gap-closure run — "Every other WR-* item's disposition is recorded in
19-08 and 19-09". 19-06 discharges exactly two of them (`CR-01`, the originating code review,
and `WR-02`) and names both in `19-06-SUMMARY.md`, which is disposition source 1 of the
guard's five. The remaining 15 belong to plans 19-07, 19-08 and 19-09; recording them here
would be 19-06 claiming work it did not do.

**Clears when:** the last gap-closure plan (19-09) lands its SUMMARY. Not before — the guard
is red *correctly* while the run is in flight.

## 2. `audit-integrity.test.ts` D-12-02 cascades from item 1 (found by 19-06, same owner)

**Condition:** `no milestone audit declares a gated status while any docs guard is red
(D-12-02)` fails, naming SEVEN red docs guards. Only ONE of the seven is genuinely red:
`docs-review-disposition.test.ts` (item 1 above). The other six —
`docs-core-value-decision`, `docs-dangling-refs`, `docs-deferred-ledger`,
`docs-fork-decision`, `docs-linerefs`, `docs-r2000-decisions` — each PASS when run
standalone (`node --test <guard>.test.ts` exits 0) and are the known cascade in
`audit-integrity`'s own guard runner.

**Clears when:** item 1 clears.

**Both conditions pre-date plan 19-06** and are provably untouched by it: `git diff
--name-only 5c68473..HEAD` after 19-06's two task commits lists only
`src/mcp/vice/r2000-coverage.ts` and `src/mcp/vice/r2000-coverage.test.ts`, and neither guard
reads either file.
