---
phase: 32-the-deletion-and-the-grep-gate
plan: 17
subsystem: testing
tags: [argv-parsing, audit-seam, containment, mutation-harness, provenance, cr-05]

requires:
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-15's re-runnable harness (skip branch, counts line, per-row plant containment)"
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-11's shared argv seam parseRootArg() and its nine --root unit tests"
provides:
  - "A valueFlags option on parseRootArg(), applying the same three malformed-value rules to declared value-taking flags, with a values return record keyed by the flag token exactly as declared"
  - "A caller-error throw when a token is declared in both booleanFlags and valueFlags, deliberately NOT carrying the BAD ARGUMENTS prefix"
  - "scripts/audit-mutation-harness.mjs reading argv through the shared seam, its hand-rolled parseArgs() loop deleted"
  - "An argv rejection from the harness at exit 1 behind BAD ARGUMENTS --, replacing its bespoke prefix and exit 2"
  - "A corrected, dated provenance citation in the seam's own header"
  - "The CR-05 coincidental-reliance precondition declared in prose and made true in code"
affects: [32-18, 32-19, any future consumer of the shared argv seam]

actuals:
  tokens: 74000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A shared argv parser that expresses value-taking flags through a caller-supplied declaration, so no consumer restates the malformed-value rules"
    - "Provenance corrections written in reported speech, so a census for the false literal returns a real zero rather than matching its own obituary"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-harness-seam.md
  modified:
    - scripts/lib/audit-root.mjs
    - scripts/lib/audit-root.d.mts
    - scripts/audit-mutation-harness.mjs
    - src/mcp/vice/audit-root-args.test.ts

key-decisions:
  - "Took gaps[0].missing[0]'s FIRST shape — extend the parser with a declared valueFlags list — rather than restating the three rules per flag inside the harness, which would have recreated IN-06 inside the file the seam was extracted from"
  - "Corrected the false provenance citation in REPORTED SPEECH rather than re-quoting it, because a comment that quotes the removed sentence makes every census for that sentence match the comment"
  - "Did NOT add the audit-mutation-harness MATRIX row: plan 32-18 owns it and requires this plan's red as its own observed-red evidence"

patterns-established:
  - "Non-vacuity of a census is proven, not asserted: the test-file census asserts its visited-file count against the directory listing so a NUL-byte skip changes the count rather than passing unnoticed"
  - "A record of a removed literal is written without reproducing the literal, keeping the census that hunts for it honest"

requirements-completed: [CUT-04, CUT-06]

coverage:
  - id: D1
    description: "parseRootArg() accepts a declared valueFlags list and applies the same three malformed-value rules (missing, flag-shaped, repeated) plus the empty-value rule to each, returning values keyed by the flag token exactly as declared"
    requirement: "CUT-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#parseRootArg: a declared value flag's value is returned under its own token"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#parseRootArg: a declared value flag as the LAST argument is REJECTED, naming ITSELF"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#parseRootArg: a declared value flag followed by a flag is a MISSING value"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#parseRootArg: a declared value flag given an empty string is REJECTED"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#parseRootArg: a repeated value flag is REJECTED, not resolved by position"
        status: pass
    human_judgment: false
  - id: D2
    description: "A token declared in both booleanFlags and valueFlags is a CALLER error whose message does not begin with BAD ARGUMENTS --, keeping operator and programmer mistakes distinguishable"
    requirement: "CUT-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#parseRootArg: a token declared in BOTH lists is a CALLER error, not a rejection"
        status: pass
    human_judgment: false
  - id: D3
    description: "The widened signature is additive: the unflagged and root-only paths return an empty values record and all nine pre-existing --root unit tests pass unedited"
    requirement: "CUT-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#parseRootArg: the widened signature is ADDITIVE -- values is empty when unused"
        status: pass
      - kind: other
        ref: "git diff -U0 HEAD~1 -- src/mcp/vice/audit-root-args.test.ts | grep -c '^-[^-]' => 0 deletions"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && npm run typecheck (implementation and .d.mts agree)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both named harness defects are closed behaviourally: a valueless trailing --root and a --root followed by a flag each exit 1 with a BAD ARGUMENTS message naming --root, and the trailing form no longer reaches row selection (proving the real registry is never read)"
    requirement: "CUT-04"
    verification:
      - kind: manual_procedural
        ref: "node scripts/audit-mutation-harness.mjs --row src/does/not/exist.ts --root => exit 1, BAD ARGUMENTS, no row-selection line (pre-fix: exit 1, reached ROW SELECTION). Captured in evidence/32-gap2-harness-seam.md 1a/2.1"
        status: pass
      - kind: manual_procedural
        ref: "node scripts/audit-mutation-harness.mjs --root --row src/does/not/exist.ts => exit 1, 'followed by \"--row\", which is itself a flag' (pre-fix: exit 2, --row swallowed). Captured in evidence/32-gap2-harness-seam.md 1b/2.2"
        status: pass
      - kind: manual_procedural
        ref: "trailing --out and trailing --rows each exit 1 naming their own flag. Captured in evidence/32-gap2-harness-seam.md 1e/2.3/2.4"
        status: pass
    human_judgment: false
  - id: D5
    description: "The exactly-one-of --row/--rows/--all selector rule survived the migration byte-identical in message and still fires on zero and on two selectors"
    requirement: "CUT-04"
    verification:
      - kind: manual_procedural
        ref: "node scripts/audit-mutation-harness.mjs (0 selectors) and --all --row <path> (2 selectors) each exit 1 with the unchanged selector message. Captured in evidence/32-gap2-harness-seam.md 3"
        status: pass
      - kind: other
        ref: "grep -c 'must fail rather than quietly measure a different set of rows' scripts/audit-mutation-harness.mjs => 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "The harness no longer mints its own exit code for an argv rejection, and nothing in the repository depended on the old exit 2"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "grep -c 'USAGE --' scripts/audit-mutation-harness.mjs => 0 (non-vacuous: 1 at base b64e9a6); grep -n 'exit(2)' => no output"
        status: pass
      - kind: other
        ref: "Exit-2 dependency census over both package.json files, .github/workflows/, scripts/*.sh, .claude/settings.json and 128 src/mcp/vice/*.test.* files under grep -a with the visit count asserted => zero invocations. Captured in evidence/32-gap2-harness-seam.md 7"
        status: pass
    human_judgment: false
  - id: D7
    description: "Containment is still resolved before row selection, so a refused root can never reach a mutation"
    requirement: "CUT-04"
    verification:
      - kind: manual_procedural
        ref: "node scripts/audit-mutation-harness.mjs --root <out-of-repo mkdtemp> --row __no-such-row__ => exit 1 with 'REFUSED --', not a selection failure. Captured in evidence/32-gap2-harness-seam.md 6"
        status: pass
    human_judgment: false
  - id: D8
    description: "The instrument still works end-to-end: a real row produces an OBSERVED RED at exit 0 with the tree restored byte-identical, and its churn was discarded"
    requirement: "CUT-04"
    verification:
      - kind: manual_procedural
        ref: "node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs --out <scratch> => exit 0, OBSERVED RED, 'tree: restored byte-identical to the baseline'. Captured in evidence/32-gap2-harness-seam.md 5"
        status: pass
    human_judgment: false
  - id: D9
    description: "The false model citation at scripts/lib/audit-root.mjs:119-122 is corrected in place and dated, recording what the claim said and why it was wrong rather than erasing it"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "tr '\\n' ' ' < scripts/lib/audit-root.mjs | sed 's|// ||g' | grep -c '<the false sentence>' => 0 (non-vacuous: 1 at base b64e9a6); a dated PROVENANCE CORRECTION paragraph remains at :119 naming the harness"
        status: pass
    human_judgment: false
  - id: D10
    description: "The CR-05 coincidental-reliance precondition is declared in prose beside the evidence and in a dated note in the harness header, quoting the verifier's harden: wording and naming the 0-of-61 and 35-of-35 measurements"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "grep -c 'CR-05' scripts/audit-mutation-harness.mjs => 1; evidence/32-gap2-harness-seam.md 8 quotes harden: verbatim and names where the standing guard will live (plan 32-18)"
        status: pass
    human_judgment: true
    rationale: "The mechanical half of this discharge is plan 32-18's matrix row, which does not exist yet. Until it lands, the precondition is guaranteed by the code plus this written record rather than by a standing test, so a human should confirm at phase verification that 32-18 actually delivered the row."

duration: 41 min
completed: 2026-09-01
status: complete
---

# Phase 32 Plan 17: The Mutation Harness Joins the Argv Seam Summary

**`parseRootArg()` learned about declared value-taking flags, and the one instrument in this phase that both mutates the tree and writes the registry can no longer be pointed at the real repository by a flag the operator thought pointed it somewhere else.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-09-01T06:52:00Z
- **Completed:** 2026-09-01T07:33:00Z
- **Tasks:** 3
- **Files modified:** 4 (plus 1 created)

## Accomplishments

- **`parseRootArg()` gained a `valueFlags` option** applying the same three malformed-value rules it already applied to `--root` — a missing value, a flag-shaped value and a repeat — plus the empty-value rule, to each declared value-taking flag. The rules are factored into one shared helper so `--root` and every value flag get them from the same code, rather than restated per flag. Values are returned in a `values` record keyed by the flag token exactly as declared, matching how `flags` already keys `booleanFlags`.
- **A token declared in both `booleanFlags` and `valueFlags` throws a CALLER error** that deliberately does not carry the `BAD ARGUMENTS --` prefix, so an operator mistake and a programming mistake stay tellable apart by message.
- **`scripts/audit-mutation-harness.mjs` reads argv through the seam.** Its hand-rolled `parseArgs()` loop is gone; `--all` is declared as a boolean flag and `--row`, `--rows`, `--out` as value flags. Both named defects are closed with before-and-after readings that differ: a valueless trailing `--root` no longer reaches row selection (proving the real registry is never read), and `--root --row <path>` no longer swallows `--row` as the root's value.
- **The exactly-one-selector rule survived byte-identical** in message and in force, moved out of the deleted parser and into the harness.
- **The bespoke `USAGE --` prefix and the exit 2 are gone.** An argv rejection now exits 1 behind `BAD ARGUMENTS --`, per the seam's own recorded rule that an argv rejection must not mint a new exit code. Re-measured in this tree: zero consumers of the harness exist anywhere.
- **The false provenance citation is corrected in place and dated.** The seam's header had vouched for the harness's reader as a clean model; it was never one, and that citation is why the remaining hole stayed invisible through a whole gap-closure round.
- **`CR-05` is discharged in code and declared in prose.** The soundness of all 35 recorded observed reds rested on an operator habit; it is now a property of the code.

## Task Commits

1. **Task 1 (RED): failing tests for value-taking flags** — `b1e3d5e` (test)
2. **Task 1 (GREEN): the parser implementation and the corrected citation** — `dc0466b` (feat)
3. **Task 2: the harness joins the seam** — `484bcd4` (fix)
4. **Task 3: the evidence record** — `f66407f` (docs)

_Task 1 was TDD; no refactor commit was needed._

## Files Created/Modified

- `scripts/lib/audit-root.mjs` — `valueFlags` option, `values` return record, the shared `rejectMalformedValue()` helper, a widened `usageLine()`, the double-declaration caller guard, the new WHAT NOT TO DO line, and the corrected dated provenance paragraph
- `scripts/lib/audit-root.d.mts` — the widened signature and `values` return field mirrored
- `scripts/audit-mutation-harness.mjs` — argv read through the seam, selector rule preserved, argv rejection at exit 1, dated `CR-05` header note
- `src/mcp/vice/audit-root-args.test.ts` — ten new unit cases and a `valueRefusal()` helper, additions only
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap2-harness-seam.md` — the full raw record (new)

## Decisions Made

- **Took the first of `gaps[0].missing[0]`'s two shapes.** Extending the parser with a declared `valueFlags` list, rather than restating the three rules per flag inside the harness. The alternative would have recreated `IN-06` at a smaller scale inside the very file the seam was extracted from — the exact irony the gap already contains once.
- **Wrote both corrections in reported speech.** A comment explaining a removed literal naturally quotes it, at which point the census hunting for that literal matches the comment and can no longer distinguish a live defect from its own obituary. Both the `USAGE --` comment and the provenance paragraph name what the old text said without reproducing it.
- **Did not add the `audit-mutation-harness` MATRIX row.** See "Issues Encountered".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's citation-census acceptance criterion was vacuous, and the real census had to be de-wrapped**

- **Found during:** Task 1
- **Issue:** The plan asserted `grep -c 'That is the model that was not reused; it is reused here' scripts/lib/audit-root.mjs` returns 0 after the fix and, *"Non-vacuous: it returns 1 at HEAD."* Measured: **it returns 0 at HEAD too.** The sentence is wrapped across two comment lines and `grep` is line-based, so the stated check would have passed without any edit at all — it measured nothing in either direction.
- **Fix:** Used a de-wrapping census (`tr '\n' ' ' | sed 's|// ||g' | grep -c`) as the real check. It returns **1** at the base commit and **0** at head, so it is genuinely non-vacuous. Both the plain and the de-wrapped forms are recorded in the evidence file with their readings.
- **Files modified:** none (measurement method only)
- **Verification:** Both forms run at base and head; readings recorded in `evidence/32-gap2-harness-seam.md` §11.
- **Committed in:** `f66407f` (evidence)

**2. [Rule 1 - Bug] The first draft of each correction defeated its own census**

- **Found during:** Tasks 1 and 2
- **Issue:** The provenance paragraph initially quoted the false sentence verbatim (per the plan's instruction to record what the claim said), and the exit-code comment initially quoted `USAGE --`. Both made their censuses return 1 — matching the correction itself, not a live defect.
- **Fix:** Rewrote both in reported speech, preserving the full record of what the old text asserted and why it was wrong without reproducing the literal. The evidence file states the caveat explicitly so the next author does not re-introduce it.
- **Files modified:** `scripts/lib/audit-root.mjs`, `scripts/audit-mutation-harness.mjs`
- **Verification:** `grep -c 'USAGE --'` → 0; de-wrapped citation census → 0; both non-vacuous at base.
- **Committed in:** `dc0466b`, `484bcd4`

---

**Total deviations:** 2 auto-fixed (2 measurement/verification bugs).
**Impact on plan:** Neither weakened a check — both replaced a check that could not fail with one that can. No scope creep; no plan behaviour was changed.

## Issues Encountered

**`npm run test:automated` exits 1 with 2 failures, not 0.** Task 3's acceptance criterion asked for 0 failures. Both failures are named, measured and accounted for, and **neither is a behavioural defect introduced by this plan.**

**1. `the matrix covers EVERY script wired to the shared argv seam` — an expected, scheduled red.**

The completeness guard derives its population as "scripts whose source contains `parseRootArg(`". Migrating the harness onto the seam adds it to that population, and the matrix does not yet carry its row.

That row is **plan 32-18's deliverable, not this plan's.** 32-18 is `wave: 3` with `depends_on: ["32-16", "32-17"]`, and its own must-have truth 2 requires precisely this red as its observed-red evidence:

> The flipped predicate is proven to BITE before it is satisfied: with the population derived from the flag and the matrix still carrying six rows, the guard goes red naming `audit-gate` and `audit-mutation-harness`. That red is captured verbatim as this plan's observed-red evidence [...] NO EXCLUSION LIST is added to keep it green.

Adding the row here would have destroyed 32-18's central proof and left it unable to demonstrate that the guard bites. `audit-gate` — the other name in 32-18's expected red — arrives from plan 32-16, this plan's wave sibling. The guard returns green in wave 3.

This plan therefore did **not** touch `MATRIX`, and did not relax, exclude or narrow the assertion.

**2. `repo-root.test.ts` path agreement — a pre-existing worktree-location artifact.**

The assertion is that the agreed supervisor directory does not sit under `.claude`; this executor runs in a GSD worktree at `.claude/worktrees/agent-.../`. It is a property of where the checkout sits, not of any code. This plan's whole diff is four files, none touching `repo-root.ts`, `supervisorDir()`, `EPOCH_FILE` or the launcher resources. Same class as the known "live worktrees red `ci-suite-coverage`" artifact; it resolves on merge to the main checkout.

**The whole-glob `npm test` was NOT run**, in words: it blocks indefinitely on `vice-proxy.test.ts`. That decision is recorded in `evidence/32-close-gate.md` §2b (`timeout 180 node --test vice-proxy.test.ts` → `exit=124`, the timeout being the measured result; broken-windows entry #26). This plan cites that decision rather than re-taking it.

## Known Stubs

None. No hardcoded empty value, placeholder or unwired component was introduced.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust boundary was introduced. `T-32-SC` is discharged by measurement: no package-manager install was run and no dependency added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 32-18 is unblocked and its precondition is in place.** Its expected observed-red (the completeness guard naming `audit-mutation-harness`) exists now, and the `audit-gate` half arrives from wave sibling 32-16.
- **Plan 32-19 is unaffected.** No export was added to `scripts/audit-mutation-harness.mjs`; the export seam remains 32-19's subject.
- **One residual dependency to watch:** the mechanical half of the `CR-05` discharge is 32-18's matrix row. Until it lands, the precondition is guaranteed by the code plus the written record rather than by a standing test.

## Self-Check: PASSED

All five files verified present on disk. All four commits verified in `git log`:

- `b1e3d5e` test(32-17) — RED
- `dc0466b` feat(32-17) — GREEN
- `484bcd4` fix(32-17) — harness migration
- `f66407f` docs(32-17) — evidence

`node --check` clean on both scripts; `npm run typecheck` exit 0; `node --test audit-root-args.test.ts` 54/54; `node scripts/check-guard-fates.mjs` and `node scripts/audit-gate.mjs` both exit 0. `npm run test:automated` failures are the two documented above.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-09-01*
