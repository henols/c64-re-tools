---
title: Two committed cpuhistory-get* sidecars record capturedFrom "stock" for a fork binary
date: 2026-08-22
priority: low
source: /gsd-execute-phase 13 plan 13-05 — carried from 13-RESEARCH.md § Open Questions item 1, found by plan 07-12's own operator-typed CAPTURE_BACKEND_KIND
---

# `cpuhistory-get.json` and `cpuhistory-get-multi.json` mislabel a fork capture as stock

`probe-binmon.mjs`'s `runCapture()` builds each sidecar's `capturedFrom`
field from two environment variables the operator sets by hand:

```js
// probe-binmon.mjs:1476-1480
const capturedFrom = `${process.env.CAPTURE_BACKEND_KIND || "unknown"}:${process.env.VICE_BIN || `${host}:${port}`}`;
```

Neither `CAPTURE_BACKEND_KIND` nor `VICE_BIN` is derived automatically
from `resolvedBackend()` or from which binary actually answered — nothing
validates the operator typed the right kind for the binary path also
recorded in the same string.

**Two of the three pre-existing `cpuhistory-get*` sidecars have exactly
this defect**, confirmed live on this host during phase 13:

```
.claude/mcp/vice/fixtures/binmon/cpuhistory-get.json:
  "capturedFrom": "stock:/usr/local/bin/x64sc"

.claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.json:
  "capturedFrom": "stock:/usr/local/bin/x64sc"
```

`/usr/local/bin/x64sc` is the **fork** build on this host, not stock — its
own `--help` output names `-mcpserver` 5 times (`0` for a genuine stock
build), and CLAUDE.md's own framing of the project's two backends
confirms the path. The operator who ran plan 07-12's capture typed
`CAPTURE_BACKEND_KIND=stock` for a binary that was actually the fork. The
third sidecar in the same family,
`.claude/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.json`, is
correctly labelled (`"capturedFrom": "stock:/usr/bin/x64sc"` — a genuine
stock binary path) — only the two named above are wrong.

## Why this was not fixed here

Found while writing plan 13-05's Deferred Items reconciliation, not while
executing a code-change task in this plan's scope. Phase 13's D-13-06
fixture-provenance decision scoped the "replace in place" work to exactly
three named fixtures (`display-get`, `event-interleaved`,
`checkpoint-list`) that were previously synthetic — these two
`cpuhistory-get*` sidecars are already real captures, just mislabelled by
kind, which is a different, narrower correction than a re-capture. Per
D-13-04's escape hatch (file a todo rather than silently widen scope), a
cheap-looking fix is still a scope decision, and a scope decision made
silently inside a verification-record plan is the exact defect class this
milestone exists to stop.

## What a fix would touch

- `.claude/mcp/vice/fixtures/binmon/cpuhistory-get.json` — correct
  `capturedFrom` to `"fork:/usr/local/bin/x64sc"`.
- `.claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.json` — same
  correction.
- `.claude/mcp/vice/fixtures/binmon/README.md` — the provenance table row
  for these two cases currently states `stock`; correct to `fork`.
- Any test asserting these two sidecars' `capturedFrom`/kind by literal
  string (check `binmon-fixtures.test.ts` for a hardcoded expectation
  before editing).
- Consider whether `probe-binmon.mjs`'s `runCapture()` should derive
  `CAPTURE_BACKEND_KIND` automatically (e.g. from `resolvedBackend()`
  against the same `VICE_BIN`) instead of trusting an operator-typed
  value, which is the root cause and would prevent a third recurrence.

## How to verify

1. `node -e 'const j=require("./fixtures/binmon/cpuhistory-get.json");
   if (!j.capturedFrom.startsWith("fork:")) throw new Error("still
   mislabelled")'` (run from `.claude/mcp/vice`) — passes once corrected.
2. Same check for `cpuhistory-get-multi.json`.
3. `fixtures/binmon/README.md`'s provenance table names `fork` for both
   rows.
4. `node --test binmon-fixtures.test.ts` stays green.

## Related

- `.planning/phases/13-external-verification/13-RESEARCH.md` § "Pattern:
  the sidecar `capturedFrom` field is a manual, unvalidated string" — the
  original finding, recorded as an Open Question rather than a required
  fix.
- `.planning/phases/13-external-verification/13-01-SUMMARY.md` — the
  plan that correctly re-recorded the three D-13-06-scoped fixtures with
  `CAPTURE_BACKEND_KIND=fork` explicitly set, avoiding the same mistake
  for those three.
