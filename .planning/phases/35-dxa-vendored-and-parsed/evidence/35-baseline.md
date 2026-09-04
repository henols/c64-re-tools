# Phase 35 — opening test-suite baseline

Recorded, not asserted. Per `35-VALIDATION.md`, this is a "recorded baseline, not a gate":
`npm run test:automated` does not start from zero failures on this repository, the last
recorded floor was 2 failing tests in 1 file (2026-09-03), and an earlier record read 5-in-3.
The number below is MEASURED at this commit, not assumed to match either prior reading, and
is never pinned as a literal in any test file this phase adds (`grep -a -rn` for the count
below across `src/mcp/vice/dxa-*.test.ts` returns nothing — confirmed as part of this task's
own `<verify>`).

## Command and timing

```
cd src/mcp/vice && npm run test:automated
```

- **Started:** `2026-09-04T10:01:42Z`
- **Completed:** `2026-09-04T10:02:34Z`
- **Duration:** 52305.9 ms (~52.3 s)

## Counts

| Metric | Count |
|---|---|
| tests | 3297 |
| suites | 24 |
| pass | 3288 |
| fail | 3 |
| cancelled | 0 |
| skipped | 1 |
| todo | 5 |

## Failing files (2)

- **`anno-register.test.ts`** — 2 failing tests:
  - `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one
    requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md`
  - `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of
    the predicates`

  Both fail on the SAME underlying cause: four requirement IDs referenced by
  `anno_add_scope`/`anno_remove_scope`/`anno_search`/`anno_update_project_enum`/
  `anno_save_project` (`STORE-01`, `STORE-06`, `STORE-04`, `MCP-04`) are "well-shaped" but are
  not currently declared in `.planning/REQUIREMENTS.md`. This is a `REQUIREMENTS.md` /
  `anno-register.ts` bookkeeping drift, entirely unrelated to dxa, the host-tool seam, or any
  file phase 35 touches.

- **`audit-root-args.test.ts`** — 1 failing test:
  - `check-skill-tool-coverage: every spelling that RESOLVES to the repository root is
    accepted` — `--root .` and the unflagged run disagree (got exit 0, expected exit 1). A
    pre-existing CLI root-argument resolution defect in `check-skill-tool-coverage`, unrelated
    to this phase.

## Statement

A residual failure at this reading is **not attributable to phase 35**. Neither failing file
(`anno-register.test.ts`, `audit-root-args.test.ts`) was created or modified by this phase's
plans, and neither failure's own assertion text references `dxa`, `host-tool.mts`,
`vendor/dxa/`, or any other phase-35 artifact. This reading (3 failing / 2 files) differs from
the last two recorded readings (2-in-1 on 2026-09-03, 5-in-3 earlier) — the count moves between
readings on this repository, which is exactly why the plan requires a fresh measurement rather
than an assumed carry-forward; it is recorded here as-measured, not reconciled against either
prior number.

## Environment effects confirmed

- **Live VICE broker:** confirmed **absent**. `ps aux` showed no `vice-broker`/`x64sc`
  process at measurement time; `.vice-supervisor/broker.json` is a stale record from a prior
  (2026-08-26) session with no live process behind it. A live broker deterministically reds
  the BACK-05 test and would corrupt this reading.
- **`npm test`'s full-glob hang on `vice-proxy.test.ts`:** avoided by using
  `npm run test:automated` (this task's own command), which excludes `MANUAL_ONLY_TESTS` by
  construction (`test-gate.mjs`).

## Closing reading

_(Filled by plan 35-05.)_
