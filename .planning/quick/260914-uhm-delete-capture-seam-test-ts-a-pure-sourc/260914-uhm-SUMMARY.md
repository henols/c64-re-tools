---
quick_id: 260914-uhm
status: complete
date: 2026-09-14
---

# Delete capture-seam.test.ts

## What and why

`src/mcp/vice/capture-seam.test.ts` (534 lines, 12 tests) deleted. It was the last
whole-file source scanner: all twelve cases read `capture-predicate.ts` and
`stop-oracle.ts` as TEXT and asserted neither names an import specifier for the other,
with planted violations proving the scanner non-vacuous. It called neither module —
measured zero invocations of `capturePredicate`/`stopOracle`/`evaluate` — and its only
non-builtin import was `shipped-modules.ts`, which does not ship.

The invariant it guarded is real: a capture must not become a conjunct of the oracle
that certifies its stop, or two genuinely different stops could be certified identical.
That reasoning survives in `capture-predicate.ts`'s own header comment. Only the
text-based enforcement is gone.

## Verification

- `npm run test:automated`: 3765 -> 3753 tests, exactly the 12 deleted. fail 0, EXIT 0.
- `npm run typecheck`: EXIT 0.
- No file imports `capture-seam` — all five remaining mentions are prose in comments.

## Deliberately NOT done

`anno-seam.test.ts` was in the original scope for this task and was REMOVED from it.
Nine of its twenty-three cases scan source, but one is genuinely behavioural and says
so in its own comment ("ASSERTED THROUGH THE ENTRY POINT, NOT AGAINST SOURCE TEXT"):
WR-25 proves `openStore()` refuses with `AnnoStorePathError` when given neither a
workspaceRoot nor the unconfined escape, creates nothing at the refused path, and still
opens when the escape IS supplied. `anno-confinement.test.ts` covers symlink and
workspace-locality refusals, not this one. Deleting the file wholesale would drop real
coverage, so it moves to the phase that removes `shipped-modules.ts`, where each case
can be judged individually.
