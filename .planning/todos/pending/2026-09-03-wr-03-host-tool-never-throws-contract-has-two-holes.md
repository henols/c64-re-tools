---
created: 2026-09-03T20:22:00.000Z
title: WR-03 — host-tool.mts's "nothing throws" contract has two holes
area: host-tool-seam
severity: minor
source_review: .planning/phases/34-the-host-tool-execution-seam/34-REVIEW.md
finding_ids:
  - WR-03
files:

  - src/mcp/vice/host-tool.mts:1039-1040
  - src/mcp/vice/host-tool.mts:1117-1121
  - src/mcp/vice/host-tool.mts:748-752
  - src/mcp/vice/host-tool-client.ts:419-427
---

## Why this is a todo and not a Phase 34 gap-closure plan

Raised by the code review that ran **after** Phase 34's gap-closure round
(`34-07`..`34-09`) landed. It is not a gap in what those plans set out to do —
it is a pre-existing robustness hole in the same module, surfaced by the review
reading `runHostTool()`'s own stated invariant against the code.

Small enough to be a `/gsd-quick`, but it is still unplanned work discovered at
the edge of a `--gaps-only` run, so it is filed rather than folded in.

## Problem

`runHostTool()`'s doc comment (lines 748-752) states the invariant plainly:

> NOTHING throws out of this function -- every failure path (refusal, launch
> error, timeout, non-zero exit, unreadable output) resolves to a response
> object, because broker-kill.mts's uncaughtException/unhandledRejection
> handlers kill the whole VICE pool on an unhandled throw in this process

Two paths break it.

**1. `runOracleRun()`'s scratch-dir creation is outside its own `try`.**
`mkdirSync(scratchDir, { recursive: true })` at line 1040 sits immediately
*before* the `try` block (which opens at the `spawnHostTool()` call on the next
line). A full disk, or a permission error on the `tools/oracle-runs/` parent,
throws synchronously out of `runOracleRun()` and therefore out of
`runHostTool()`.

Inside the real broker this is absorbed by `broker-control.mts`'s `.catch()`
around `opts.onHostTool(req)` (line 686), so it does not reach the process-wide
handlers there. The standalone route has no such net.

**2. The standalone CLI entry point has no `.catch()`.**

```ts
runHostTool(raw, { repoRoot }).then((response) => {
  process.stdout.write(`${JSON.stringify(response)}\n`);
  process.exitCode = response.ok ? 0 : 1;
});
```

A rejection here is an unhandled rejection in the standalone `host-tool.mjs`
process — the one used by the host-local route in CI and by
`hostToolOverHostRoute()`. Depending on Node's unhandled-rejection setting it
prints a trace and/or exits non-zero with **nothing on stdout**, which surfaces
to the caller as `hostToolOverHostRoute()`'s own "host-tool.mjs produced no
output on stdout" — an opaque transport-shaped failure instead of the clean,
diagnosable `{ ok: false, message }` the module promises.

## Solution

- Move the `mkdirSync` inside `runOracleRun()`'s existing `try` (before the
  `spawnHostTool()` call), converting a throw into
  `{ ok: false, tool: "oracle.run", stdout: "", reason: ... }`.
- Add a `.catch()` to the CLI entry point that writes a `{ ok: false, message }`
  JSON line to stdout and sets a non-zero exit code.

`host-tool-client.ts:419-427` already does exactly this correctly — mirror it
rather than inventing a second shape.

Constraints to respect:

- `host-tool.mts` is `.mts`, compiled by `build.ts` into the committed
  `resources/host-tool.mjs`; `resources-sync.test.ts` fails CI on drift.
- A test for the CLI `.catch()` needs a forced rejection, not a real disk-full
  condition — inject via an unwritable scratch parent, or exercise
  `runHostTool()` with a stubbed failure, whichever the existing test style in
  `host-tool.test.ts` supports without new machinery.

Suggested vehicle: `/gsd-quick` — two small edits, one build artifact, plus
tests.
