---
created: 2026-08-21T00:00:00.000Z
title: r2000 CLI's parseArgs() accepts a missing or flag-shaped option value and silently loses the caller's intent (10-REVIEW.md WR-08)
area: cli
files:
  - .claude/mcp/vice/r2000-cli.ts
---

## Problem

Found (and confirmed still live) while writing plan 11.1-07's disposition ledger
(`.planning/todos/completed/2026-08-21-phase-10-and-11-review-residual-dispositions.md`).
`10-REVIEW.md`'s WR-08 was never actually fixed, despite CR-01/CR-02/WR-01 being fixed at
Phase 10 close-out and WR-02 through WR-07 being closed by plans 11-01/11-02 — WR-08 fell
through a gap between those two batches and was never named in either.

`r2000-cli.ts`'s `parseArgs()`:

```ts
if (a === "--entry") entry = rest[++i];
else if (a === "--out") out = rest[++i];
```

never validates that a value exists or that it is not itself another option. Confirmed
live on 2026-08-21 against the current source:

```
$ node vice-proxy.ts r2000 bootstrap /tmp/wr08test.prg --out
bootstrap: wrote /tmp/wr08test.regen2000proj (origin $0801)
```

`--out` with no following value silently falls back to the default output path instead
of erroring — exactly the review's own reproduction. The review's second demonstrated
case (`--out --entry FOO` writing a file literally named `--entry`, a dash-prefixed shell
glob hazard) was not re-verified in this pass but the underlying code is unchanged, so it
almost certainly still reproduces too.

Note this is a **different** defect from IN-06 (verify silently accepting and discarding
`--out`), which plan 11.1-06 Task 2 fixed with `VERB_OPTIONS`/`checkAcceptedOptions()`.
That fix refuses an option a verb does not *implement*; WR-08 is about an option a verb
DOES implement receiving no value, or a flag-shaped value, at parse time — orthogonal and
still open even after IN-06's fix.

## Why it was deferred

Found while writing a disposition ledger, not while executing a code-change task in this
plan's scope. Fixing it is a real, in-scope, low-risk change to a file this same phase
already modified extensively (`r2000-cli.ts`), but per this project's deviation-scope
rule, an out-of-scope discovery made while doing documentation work gets logged, not
silently fixed inside an unrelated plan.

## What to do

Validate at parse time, per the review's own suggested fix:

```ts
function takeValue(rest: string[], i: number, flag: string): string {
  const v = rest[i];
  if (v === undefined || v.startsWith("-")) {
    throw new Error(`${flag} needs a value (got ${v === undefined ? "end of arguments" : `"${v}"`})`);
  }
  return v;
}
```

Apply to both `--entry` and `--out` in `parseArgs()`. Report the error the same way the
existing `input file not found` / `unknown option` refusals are reported (a one-line
`<verb>:`-prefixed message, `{ code: 1 }`, never an escaped throw to `runR2000Cli()`'s
last-resort net -- see WR-09's fix in this same file for the established shape).

**Verify:** `node vice-proxy.ts r2000 bootstrap game.prg --out` refuses with a named
error instead of silently writing `game.regen2000proj`; `node vice-proxy.ts r2000
bootstrap game.prg --out --entry FOO` refuses instead of creating a file named
`--entry`; `node --test r2000-cli.test.ts` stays green plus new coverage for both cases.
