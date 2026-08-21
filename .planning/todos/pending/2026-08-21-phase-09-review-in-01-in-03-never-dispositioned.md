---
created: 2026-08-21T13:20:00.000Z
title: Phase 09's 09-REVIEW.md IN-01, IN-02, IN-03 were never dispositioned
area: planning
priority: low
files:
  - .planning/phases/09-the-assumption-probe-go-no-go/09-REVIEW.md
  - .planning/phases/09-the-assumption-probe-go-no-go/evidence/vice-tool-harness.mjs
  - .planning/phases/09-the-assumption-probe-go-no-go/evidence/mcp-harness.mjs
  - .claude/mcp/vice/docs-review-disposition.test.ts
---

## Problem

Three `Info`-severity findings in `09-REVIEW.md` — `IN-01`, `IN-02`, `IN-03` — have no
recorded disposition anywhere: not in a Phase 9 SUMMARY, not in `09-VERIFICATION.md`,
not in a todo, and not in the milestone audit's `tech_debt` block (whose only entry is
scoped `milestone-wide (after closure)`, which `phaseScopedTechDebtText()` correctly
declines to match against phase `09`).

**Found at the v0.3.0 milestone close, and it predates the close.**
`docs-review-disposition.test.ts` — the completeness guard plan 11.1-07 built for
`AUDIT-01` — is **red at commit `4f048bb`**, the commit whose subject reads
`docs(v0.3.0): milestone audit round 2 -- passed, all findings closed`. Verified by
running the guard in a clean worktree at that commit, not inferred. So the guard did
what it was built to do; what failed is that its result was not read before the audit
declared `passed`. Round 1 enumerated Phase 10 and Phase 11 findings and never scanned
Phase 9's review at all, and 11.1-07's own ledger was scoped to Phase 10/11 by its
plan.

The three findings:

- **`IN-01`** — `overallResult` in `evidence/vice-tool-harness.mjs:72,95,100` accumulates
  per-call results and is then never printed, written or returned. Dead accumulator; no
  data lost, since each call is already `console.log`'d individually inside the loop.
- **`IN-02`** — the same harness's `<toolName> <argsJson>` pairing loop (`:44-56`) reads
  `process.argv[i + 1] ?? "{}"`, so an odd trailing-argument count silently runs the last
  call with `{}` instead of refusing to start.
- **`IN-03`** — `evidence/mcp-harness.mjs:42-49` never attempts
  `client.close()`/`transport.close()` on the `CONNECT_FAILED` path. Same shape as
  `WR-02` but lower impact: `StreamableHTTPClientTransport` spawns no child process, so
  the leak is at most an abandoned HTTP session, never an orphaned OS process.

## Disposition: deferred, and the fix is very likely "don't"

All three are `Info` severity against **Phase 9 evidence harnesses**, not shipped code.
`evidence/vice-tool-harness.mjs` and `evidence/mcp-harness.mjs` live under
`.planning/phases/09-the-assumption-probe-go-no-go/evidence/`, are absent from
`package.json` `files[]`, are on no runtime path, and were each run a handful of times to
produce the probe transcripts that are Phase 9's actual deliverable.

That is also the argument against fixing them. Phase 9 established the evidence
convention "literal `$` command + real stdout/stderr, never reconstructed" (plan 09-01),
and the committed transcripts under `evidence/` were produced *by these exact files*.
Editing a harness after the fact breaks the correspondence between the harness in the
tree and the output it is the recorded provenance of — for `IN-02` in particular, whose
fix changes the harness's argument-validation behaviour, a reader could no longer assume
the committed transcript came from the committed script. The `degrade`/`R4` verdict rests
on those transcripts.

**Recommended resolution: mark all three `wont-fix` in `09-REVIEW.md` citing evidence
immutability, rather than editing the harnesses.** If a future milestone promotes either
harness into a reusable tool outside `evidence/`, all three become live and should be
fixed at that point — `IN-02`'s loud-failure guard first.

## The second, more transferable half

The guard is only load-bearing if something reads it. `docs-review-disposition.test.ts`
runs under `npm run test:automated`, but nothing in `/gsd-audit-milestone`'s flow
requires a green run of it before an audit may record `status: passed`. Consider wiring
the disposition guard (and `docs-deferred-ledger.test.ts`, `docs-dangling-refs.test.ts`,
`docs-linerefs.test.ts`) into the milestone-audit gate explicitly, so "all findings
closed" is a measured claim rather than a narrative one. That is the actual lesson here:
plan 11.1-07 built the right instrument and then the audit was written without reading
its last three lines.
