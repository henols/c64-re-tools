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

## Resolution

**Fixed.** Commit `d67f0ef`, Phase 15 plan 15-07 Task 2.

Both sidecars' `capturedFrom` corrected from `stock:/usr/local/bin/x64sc` to
`fork:/usr/local/bin/x64sc` — kind token only, same path, same bytes. The
correctly-labelled sibling, `cpuhistory-get-unsupported.json`
(`stock:/usr/bin/x64sc`), was left untouched (`git diff --stat` empty).

**Binary identity re-measured live this session, not inherited from the
finding's own claim:**
- `/usr/local/bin/x64sc --help 2>&1 | grep -c -- "-mcpserver"` → `5` (the
  fork build).
- `/usr/bin/x64sc --help 2>&1 | grep -c -- "-mcpserver"` → `0` (genuine
  stock).

**No test asserted these two files' `capturedFrom` by literal name.**
`binmon-fixtures.test.ts`'s `EXTV-01` test ("the three re-recorded fixtures
report synthetic: false, with a capturedFrom naming the kind and path of the
binary that actually answered") is scoped to exactly `display-get`,
`event-interleaved`, `checkpoint-list` — confirmed by reading the test's own
case list before editing. The only assertion touching `cpuhistory-get*` checks
`synthetic: false` (a separate, unaffected key), and `node --test
binmon-fixtures.test.ts` was 32/32 before and after this change.

`fixtures/binmon/README.md`'s provenance table rows updated to match, and a
new note added recording that the `capturedFrom` kind token is
operator-supplied (`CAPTURE_BACKEND_KIND`, set by hand at capture time in
`probe-binmon.mjs`'s `runCapture()`) rather than derived from which binary
actually answered — so a future reader knows the field can be wrong in this
specific way, and a future capture run can make the identical mistake.

**Named follow-on, not implemented here (per this todo's own "What a fix
would touch" list and this plan's explicit instruction not to touch
`probe-binmon.mjs`):** deriving `CAPTURE_BACKEND_KIND` automatically from
`resolvedBackend()` against the same `VICE_BIN`, instead of trusting an
operator-typed value, is the root-cause fix that would prevent a third
recurrence. `probe-binmon.mjs` carries plan 15-05's evidence-immutability
status for `13-REVIEW.md WR-02` (its capture-evidence role must not be
touched casually mid-disposition-phase), so this sub-item is promoted with a
named owner rather than fixed here: **owner = whichever future plan next
edits `probe-binmon.mjs`'s capture path** (no phase currently scheduled;
re-open this note if one is planned).

Re-verified: `cd .claude/mcp/vice && node --test binmon-fixtures.test.ts`
32/32; `npm run test:automated` 2110/2105/0/5, unchanged from the pre-fix
baseline.
