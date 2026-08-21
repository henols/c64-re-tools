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

## Resolution

Closed by quick task `260821-jd8` (see
`.planning/quick/260821-jd8-close-wr-08-flag-shaped-option-values/260821-jd8-SUMMARY.md`).

`parseArgs()` (`.claude/mcp/vice/r2000-cli.ts`) was rewritten exactly along this todo's
suggested lines, reusing the guard shape `parseExportLblArgs()` already had in the same
file rather than the standalone `takeValue()` sketched above: a value that is `undefined`
or itself starts with `--` now sets `entryMissingValue`/`outMissingValue` on the parsed
result instead of being taken as the option's value (commit `3541886`). `cmdBootstrap()`,
`cmdExportAsm()` and `cmdVerify()` each check the relevant flag(s) before touching the
filesystem and refuse with a one-line, never-thrown `<verb>: --{entry,out} requires a
value` message naming the actually-short option — `bootstrapProject()`'s never-throw
contract holds.

Pinned by ten new tests in `r2000-cli.test.ts` (commit `e0fd305`), including this todo's
own two named verification cases (`bootstrap game.prg --out` and `bootstrap game.prg
--out --entry FOO`) plus the matrix across both options, both failure modes, and all
three verbs that route through `parseArgs()`. Each of the two literal-reproduction cases
(for `bootstrap` and `export-asm`) asserts the actual harm — no file literally named
`--entry` is created — at its real landing spot, `process.cwd()` (a directory-less
relative `outPath` is resolved by `writeFileSync()` against the CLI process's current
working directory, not the input file's directory).

Non-vacuity was proven directly, not merely asserted: all ten new tests were confirmed to
FAIL against a scratch revert of `parseArgs()` to the pre-fix `rest[++i]` form — the
revert visibly reproduced the hazard, writing a real `--entry` file into this repo's own
`.claude/mcp/vice/` working directory during the test run — then confirmed to PASS again
after restoring the fix, with `git diff` showing byte-identity against the committed fix
afterwards.

`10-SECURITY.md` (Phase 10's retroactive security audit) assigned this finding threat ID
**T-10-19**, status **CLOSED**, and flipped to `status: verified` / `threats_open: 0`.
