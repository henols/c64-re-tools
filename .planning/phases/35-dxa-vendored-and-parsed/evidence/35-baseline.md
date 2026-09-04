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

Recorded, not asserted, exactly like the opening reading above. This number is MEASURED at
this commit and is never pinned as a literal in any test file this phase adds (`grep -a -rn`
for the counts below across `src/mcp/vice/dxa-*.test.ts` returns nothing).

### Command and timing

```
cd src/mcp/vice && npm run test:automated
```

- **Started:** `2026-09-04T11:56:06Z`
- **Completed:** `2026-09-04T11:56:52Z`
- **Duration:** ~46 s

### Counts

| Metric | Count |
|---|---|
| tests | 3371 |
| suites | 24 |
| pass | 3361 |
| fail | 4 |
| cancelled | 0 |
| skipped | 1 |
| todo | 5 |

### Failing files (2 -- the SAME 2 files as the opening reading)

- **`anno-register.test.ts`** -- 2 failing tests, UNCHANGED from the opening reading:
  - `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one
    requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md`
  - `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of
    the predicates`

  Same underlying cause as the opening reading: `STORE-01`/`STORE-04`/`STORE-06`/`MCP-04` are
  well-shaped requirement ids referenced by `anno_add_scope`/`anno_remove_scope`/`anno_search`/
  `anno_update_project_enum`/`anno_save_project` but not declared in `.planning/REQUIREMENTS.md`
  -- a `REQUIREMENTS.md`/`anno-register.ts` bookkeeping drift, entirely unrelated to dxa or any
  file this phase touches.

- **`audit-root-args.test.ts`** -- 2 failing tests this reading (the opening reading recorded 1):
  - `check-skill-tool-coverage: every spelling that RESOLVES to the repository root is
    accepted` -- `--root <repo>` and the unflagged run disagree (got 1, unflagged 0), with an
    `ENOENT` on a scratch file (`src/skills/acme-build/zz-scratch-in03-negative.md`) inside the
    subprocess this test spawns.
  - `check-skill-fork-honesty: every spelling that RESOLVES to the repository root is accepted`
    -- the same root-argument disagreement (got 0, unflagged 1), the inverse direction.

  **The FILE is the same as the opening reading; the sub-test COUNT within it moved from 1 to
  2.** Re-run in isolation immediately after this reading (`node --test audit-root-args.test.ts`
  alone, no other file in the process), this file passed 58/58 with zero failures -- confirming
  the pre-existing, documented cwd-sensitivity of this specific test (it depends on state left
  behind by whichever OTHER test in the full suite runs immediately before it, evidently
  including a scratch file one of those tests writes and removes). This is environment-dependent
  flakiness in a file phase 35 did not create or modify, not a regression this phase introduced
  -- neither failing test's own assertion text references `dxa`, `host-tool.mts`, `vendor/dxa/`,
  or any other phase-35 artefact, and the file's own failure mode (a root-argument resolution
  race) is identical in KIND to the one already recorded in the opening reading, only in a
  different one of the file's several `--root`-spelling sub-tests this time.

### Statement -- opening vs. closing, in FILES, not only in counts

**The failing-file SET is identical between the two readings: `anno-register.test.ts` and
`audit-root-args.test.ts`, both times.** No new file failed, and no file that failed at the
opening reading passed at the closing reading. What moved is the total test count (3297 ->
3371, a delta of +74 -- this phase's own added tests: 26 in `dxa-listing.test.ts`, 34 in
`dxa-partition.test.ts`, 14 in `dxa-blocks.test.ts`, plus smaller build-gate/seam-test
additions) and the sub-test count inside the already-failing `audit-root-args.test.ts` (1 -> 2,
explained above as the SAME pre-existing cwd-sensitivity, not a new failure mode). A residual
failure at this reading is **not attributable to phase 35** -- this phase created no new
failing file and worsened no existing failure's underlying cause.

### Environment effects confirmed

- **Live VICE broker:** confirmed **absent** at measurement time (`systemctl --user is-active
  vice-broker` reports `inactive`; `ps aux` shows no `x64sc`/`vice-broker` process). A live
  broker deterministically reds `vice-proxy.test.ts`'s `BACK-05` test
  (`test("BACK-05: stock refuses vice_sid_get_state ...")`) -- that file lives in
  `MANUAL_ONLY_TESTS` and is never reached by `test:automated`, so this effect applies to a
  manual/full-glob run of `vice-proxy.test.ts`, not to either reading recorded here, but its
  absence was independently confirmed regardless per this task's own precondition.
- **`npm test`'s full-glob hang on `vice-proxy.test.ts`:** avoided, as at the opening reading,
  by using `npm run test:automated`, which excludes `MANUAL_ONLY_TESTS` by construction
  (`test-gate.mjs`).
- **`MANUAL_ONLY_TESTS` grew from nine to ten during this phase:** `dxa-live.test.ts` joined the
  list as the TENTH entry (landed by plan 35-01, extended by plans 35-04 and 35-05 with
  additional opt-in cases) -- opt-in/default-SKIP, needs a locally-built vendored `dxa` binary,
  never reached by CI or by either `test:automated` reading recorded in this file. This is why
  the closing reading's automated set is smaller than "every test this phase added" would
  suggest: `dxa-live.test.ts`'s cases (including this plan's own new `BOUNDARY` case) are
  deliberately outside `test:automated`'s scope, by design, not by omission.

## The `D-04` oracle-narrowing record (per-capture-pair or none-applied)

**This phase produced and consumed NO capture pair, across all five plans.** `GATE-01`
recorded `degrade`, fired by rule `R6` (`ORACLE_NECESSITY: unproven`), and its pre-mapped
narrowing narrows the stop-identity oracle to the two-term `(PC, hit_count)` form with the
frame term `(LIN, CYC)` recorded but not asserted (`docs/phase33-reproducible-run-gate-findings.md`).
`D-06` records that no test guard encodes this binding, so its omission from a capture-pair
record would go uncaught -- which is exactly why this phase states the absence explicitly
rather than leaving the line out. Checked directly against every artefact this phase's evidence
files describe:

- Plan 35-01: vendors dxa, wires the host-tool seam, ports the listing parser. No VICE, no
  broker, no checkpoint anywhere in scope.
- Plan 35-02: hardens the listing parser against synthetic and Phase-23-fixture text. No VICE,
  no broker.
- Plan 35-03 (`dxa-partition.ts`): derives ground truth from image bytes and a committed
  fixture report, never from execution (`DXA-04`'s own stated-without-an-external-oracle
  design). No VICE, no broker.
- Plan 35-04 (`evidence/35-dxa03-real-image.md`, its own explicit statement): "This task
  produced and consumed NO capture pair. The `anno-d64.ts` route reads the corpus `.d64`'s
  directory and one file's byte contents directly off disk -- no VICE, no broker, no
  checkpoint, no runtime observation of any kind."
- Plan 35-05 (this plan, `evidence/35-dxa02-real-refusal.md` and
  `evidence/35-dxa01-reproducible-build.md`, each carrying the identical statement): every run
  in both evidence files spawns `dxa` as a one-shot child process against bytes read directly
  off disk (a synthetically-constructed flat image, `anno-d64.ts`'s direct `.d64` extraction,
  or the vendored source tarball/tree) -- no VICE, no broker, no checkpoint, no runtime
  observation anywhere.

No file in this phase's scope produces or reads a `.vsf`/checkpoint capture pair of any kind.
**This is the explicit "produced and consumed none" statement** the `D-04` discipline requires
when it applies to nothing -- distinct from simply omitting the line, which `D-06` warns would
be indistinguishable from an unnoticed gap.

## The honesty pass

Every evidence `.md` file this phase wrote (`35-baseline.md` itself, `35-dxa01-reproducible-
build.md`, `35-dxa02-real-refusal.md`, `35-dxa03-real-image.md` -- 4 files total) was grepped
for three patterns this phase is not entitled to claim, enumerated in this plan's own
`<action>` text: a recovery-rate claim about `dxa` on real cracked code, the milestone proof
requirement this phase may not answer from one release and one range, and any mention of the
retired third-party static-analysis tool this project purged on 2026-09-01.

**Result: the honesty pass over 4 evidence files found zero occurrences of each of the three
searched patterns**, re-confirmed by this task's own automated `<verify>` command over those
same 4 files. Every rate this phase's evidence states a number for -- `DXA-03`'s tracer-fixture
exclusion (6/15 -> 0/21), the real-release per-address exclusion (`$0819-$081f`, relative, never
a pinned byte count) -- carries its own denominator and positive class explicitly, and none of
them is offered as a claim about `dxa`'s accuracy on real cracked code in general. Real-release
recovery-rate numbers belong to Phase 38; what this phase owes it, per `DXA-04`, is the
partition script (`dxa-partition.ts`, already `Complete`) and the discipline every rate in this
phase's own evidence already follows.
