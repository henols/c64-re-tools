---
created: 2026-08-22T13:56:53.000Z
title: 14-REVIEW.md IN-01 (fork-live.test.ts skip-reason sentence) — fixed in Phase 14, never cited anywhere the disposition guard reads
area: testing
priority: low
resolves_phase: 15
files:
  - .claude/mcp/vice/fork-live.test.ts:80-91
  - .planning/phases/14-backend-decision/14-REVIEW.md:35
---

## Problem

`14-REVIEW.md`'s `IN-01` (`fork-live.test.ts:80-91`) found that the opt-in
skip-reason message told the reader "Defaults to `/usr/local/bin/x64sc` when
set to a truthy non-path value" — false. `resolvedBinPath` is computed with
`??`, which only falls back on an absent (`undefined`/`null`) variable, and
the arm that quotes that sentence only fires when the variable is falsy
(unset or empty) in the first place. A truthy non-path value can never reach
that arm at all; it falls to the next branch and is reported as "does not
exist on disk" instead. The sentence described behaviour the code does not
have — confined to a diagnostic string, no assertion or control flow
depended on it.

`14-REVIEW.md` itself records the finding as **"Resolved in this phase"**
under its own `## Disposition` section, and the fix genuinely landed
(commit `69465e41c580a0bcbf97fc7e4b58cbfac6e368ac`, cited in full below).
But until this todo, that fact was recorded ONLY in `14-REVIEW.md`'s
own prose — which is not one of `docs-review-disposition.test.ts`'s five
recognised disposition sources — and the finding was invisible to the guard
in the first place: its heading, `### IN-01 (Info) — ...`, is level-3 with
no colon after the id, a shape the guard's pre-widening parser
(`^### (WR|IN|CR)-(\d+):`) could not match at all. Plan 15-01 widened the
parser (any heading level 2-6, id terminated at the first non-digit) before
this citation was written, which is why `IN-01` first appears in the guard's
undispositioned list only as of that same plan, then drops out via this
file's own resolution note below, in the very next task.

## Why it had no citation

Structural, not an oversight by any one plan — this is the fourth instance
of the same shape. `execute-phase`'s code-review gate runs AFTER the last
plan in a phase has produced its own `*-SUMMARY.md`, so no plan of Phase 14
could ever disposition Phase 14's own review findings; the review does not
exist yet when the phase's plans are writing their summaries. See
`.planning/todos/pending/2026-08-22-phase-13-review-wr-01-wr-02-in-01-in-02-never-dispositioned.md`
for the fullest write-up of this pattern (its own `## The transferable half`
names the gate-ordering fix this repo has not yet made) — this file does not
repeat that analysis, only cites it.

## Resolution

**Fixed in Phase 14, cited here.**

The corrected sentence lives at `.claude/mcp/vice/fork-live.test.ts:83`
(part of the `SKIP_REASON` ternary at lines 80-91): `${VICE_LIVE_FORK_BIN_DEFAULT}
is only a default for an UNSET variable -- an empty value counts as unset,
and a set-but-wrong path is reported by the next branch, not defaulted
away.` — replacing the false "Defaults to ... when set to a truthy non-path
value" claim.

**Commit:** `69465e41c580a0bcbf97fc7e4b58cbfac6e368ac` — "fix(14): correct
two stale statements found by review and verification" (2026-08-22), which
also corrected an unrelated `PROJECT.md` staleness (FORK-01's Outcome cell)
in the same commit.

**Re-runnable check:** `fork-live.test.ts` is `MANUAL_ONLY_TESTS` entry 8
(`.claude/mcp/vice/test-gate.mjs`) — default-skipped by `npm test` and
excluded from `npm run test:automated`, so `node --test fork-live.test.ts`
does not exercise this string at all without `VICE_LIVE_FORK_BIN` set to a
real fork binary's absolute path. The citation is the source line plus the
commit above, not a green test run — a passing `node --test
fork-live.test.ts` (6 skipped, opt-in variable unset) proves nothing about
this specific sentence.

**Dated:** 2026-08-22, Phase 15 plan 15-01.
