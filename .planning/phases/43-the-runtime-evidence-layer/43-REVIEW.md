---
phase: 43-the-runtime-evidence-layer
reviewed: 2026-09-10T12:35:38Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - docs/phase43-instrumentation-perturbation-ab.md
  - docs/phase43-runtime-evidence-layer.md
  - docs/stock-vice-parity.md
  - docs/tool-support.md
  - scripts/lib/anno-cli-invocations.mjs
  - scripts/lib/anno-cli-verbs.mjs
  - src/mcp/vice/anno-cli-invocations.test.ts
  - src/mcp/vice/anno-cli-path-consumers.test.ts
  - src/mcp/vice/anno-cli.test.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-derive.test.ts
  - src/mcp/vice/anno-durability-mutator.mjs
  - src/mcp/vice/anno-durability.test.ts
  - src/mcp/vice/anno-register.ts
  - src/mcp/vice/anno-seam.test.ts
  - src/mcp/vice/anno-store.test.ts
  - src/mcp/vice/anno-store.ts
  - src/mcp/vice/anno-tools.test.ts
  - src/mcp/vice/anno-tools.ts
  - src/mcp/vice/anno-types.test.ts
  - src/mcp/vice/anno-types.ts
  - src/mcp/vice/anno-verb-coverage.test.ts
  - src/mcp/vice/capability-registry.ts
  - src/mcp/vice/evid-ingest.test.ts
  - src/mcp/vice/evid-ingest.ts
  - src/mcp/vice/evid-reconcile.test.ts
  - src/mcp/vice/evid-reconcile.ts
  - src/mcp/vice/evid-report-keys.test.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/stock-derived.test.ts
  - src/mcp/vice/stock-derived.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/stock-dispatch.ts
  - src/mcp/vice/textmon-seam.test.ts
  - src/mcp/vice/text-protocol.test.ts
  - src/mcp/vice/text-protocol.ts
  - src/mcp/vice/text-tools.test.ts
  - src/mcp/vice/text-tools.ts
  - src/mcp/vice/tools-manifest.stock.json
  - src/skills/c64-program-recon/references/tool-selection.md
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-09-10T12:35:38Z
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

## Summary

Phase 43 adds a durable, run-identity-keyed runtime-execution-evidence table
(`anno_evid_exec`, `SCHEMA_VERSION` 4) plus four MCP verbs
(`anno_evid_ingest`/`anno_evid_disagreements`/`anno_evid_runs`/`anno_evid_reset`),
one stock-only tool (`vice_memmap_zap`), and one CLI verb (`evid-disagreements`).
I read every required file, traced the write and read paths for the new table,
and checked the four design properties named in the review brief against the
actual code rather than the doc comments describing it.

All four claimed properties hold under inspection, and each is backed by a
real, non-vacuous structural test rather than only a doc comment:

- **Never derive `data` from absence**: `RuntimeExecClass` is a type-level
  two-member union with no `"data"` member (`anno-types.ts`), and
  `evid-report-keys.test.ts`'s direction 4 mechanically confirms both the
  cardinality and that no evidence-family module assigns a `runtime` literal
  outside it.
- **Denominator beside every count**: enforced by `evid-report-keys.test.ts`
  direction 3 (walks every real answer and asserts every `*Count` key has a
  `denominator` in its own object or an ancestor), and independently visible
  in `evid-reconcile.ts`/`anno-store.ts`'s own field shapes.
- **Block table never silently overwritten**: `insertExecObservations()` and
  `deleteExecObservationsForRun()` (`anno-store.ts`) touch only
  `anno_evid_exec`; `anno-durability.test.ts`'s EVID-05 concurrent-planting
  case explicitly asserts `anno_range` is byte-identical before and after a
  concurrent evidence writer is killed mid-ingest.
- **Bracket reset cannot over-delete**: `deleteExecObservationsForRun()`
  requires all three identity fields (`assertRunIdentityDigest` x2 +
  `assertRunIdentitySeed`), each of which throws on a missing/malformed
  value before the delete statement is even prepared, and
  `dispatchEvidReset()`'s own argument assertion (`assertEvidResetArgs`)
  refuses an incomplete identity before the dispatch arm runs at all. There
  is no code path from a missing argument to a full-table delete.

I also specifically assessed the one deliberately-argued exception named in
the review brief: `handleMemmapZap`'s treatment of `parseAccessMap()`'s
`no-data-lines` refusal as confirmed-empty rather than a refusal. This holds
up. The reasoning depends on "nothing can execute between the `memmapzap` and
`memmapshow` dials," which is not merely assumed — `text-tools.test.ts`'s own
live opt-in case (line ~1330) documents, as a measured fact, that dialing any
monitor command over this channel halts the CPU ("until the NEXT monitor
command halts it again"), and `tools-manifest.stock.json`'s own
`vice_memmap_zap` description states the same fact for the tool's user
("halts the machine for the duration of the command, exactly as a
binary-monitor command does"). Since `TEXT_COMMAND_ALLOWLIST` has no resume
verb the handler could interleave between the two dials, the CPU is
structurally guaranteed to stay halted across both, and the general
`memmapshow` ambiguity this refusal exists to catch cannot arise for this one
handler. The exception is confined to `handleMemmapZap` alone (`handleMemmapShow`
is untouched, verified by reading it) and is backed by a passing live test
against genuine stock VICE. No finding here.

The two warnings below are real but narrow: neither is a data-loss or
security risk, and neither contradicts any of the four properties above.

## Warnings

### WR-01: `anno_evid_ingest`'s zero-observation path bypasses optimistic-concurrency (`base_revision`) checking

**File:** `src/mcp/vice/anno-tools.ts:2333-2348` (`dispatchEvidIngest`)

**Issue:** Every other write verb in this store enforces `base_revision`
staleness through `applyWrite()`'s own check inside the write transaction
(this is exactly what `insertExecObservations()` does on the non-empty path,
a few lines below). But when a parsed `memmapshow` reply recorded zero
executed addresses (`ingested.observations.length === 0`), `dispatchEvidIngest`
returns success directly —

```ts
if (ingested.observations.length === 0) {
  return {
    store: handle.path,
    revision: currentRevision(handle),
    changed: false,
    observationsWritten: 0,
    addressesWithRecordedAccess,
    addressesQueried,
    denominator: addressesQueried,
  };
}
```

— without ever calling `insertExecObservations()` (or any other function
that reads `baseRevision`). A caller that supplied a stale `base_revision`
(e.g. because it expected an optimistic-concurrency conflict to be reported,
per this store's documented "let the store's own write sequence check it"
discipline that `dispatchEvidReset`'s own doc comment states explicitly)
gets a silent success instead of the refusal every other write path in this
file gives for the same situation. This causes no data corruption (nothing
is written either way), but it is an observable inconsistency in the
concurrency contract this store advertises for every other write verb, and
a caller relying on `base_revision` to detect "did anything else touch this
store since I last read it" will not learn that on this one path.

**Fix:** Either route the zero-observation case through `applyWrite()` (a
no-op mutator returning `false`) so `assertNotStale()`-equivalent checking
still runs, or explicitly document (both in the dispatch arm's own comment
and in the tool description) that `base_revision` is not honoured when the
supplied `memmap_text` produced no observations, so this is a documented
carve-out rather than a silent one.

### WR-02: `observationsWritten` is computed via a query outside the write transaction, so it can be wrong under a concurrent writer

**File:** `src/mcp/vice/anno-tools.ts:2350-2365` (`dispatchEvidIngest`)

**Issue:** `observationsWritten` is derived from a `listExecObservations()`
read taken *before* `insertExecObservations()`'s own transaction opens:

```ts
const existing = listExecObservations(handle, { ...ingested.runIdentity });
const existingKeys = new Set(existing.map((row) => `${row.address}:${row.sourceBank}`));
const observationsWritten = ingested.observations.filter((o) => !existingKeys.has(`${o.address}:${o.sourceBank}`)).length;

const written = insertExecObservations(handle, { ...ingested.runIdentity, observations: ..., baseRevision });
```

`insertExecObservations()` re-checks existence per row *inside* its own
transaction (correctly, and safely under SQLite's write serialization), so
the actual row set written to disk is always correct. But the *reported*
`observationsWritten` count is computed from a separate, earlier,
non-transactional read. If a second writer (a second `anno_evid_ingest`
call, another process, or the durability mutator in a concurrent test)
commits rows for the same run identity between this `listExecObservations()`
read and `insertExecObservations()`'s own transaction, `observationsWritten`
can overstate how many rows *this* call actually added — a benign but real
TOCTOU on a reported count, not on the data itself.

**Fix:** Either have `insertExecObservations()` itself return the count of
rows it actually inserted (it already knows this per-row inside its
transaction; it currently only returns a boolean `changed`), and use that
instead of a separately-derived count, or explicitly note in the field's
doc comment that `observationsWritten` is a best-effort count that can be
imprecise under concurrent writers to the same run identity.

## Info

### IN-01: `docs/phase43-runtime-evidence-layer.md`'s "one positive fact" section is worth double-checking against a future retrofit

**File:** `docs/phase43-runtime-evidence-layer.md:34-50`

**Issue:** Not a defect in this phase, but a note for future reviewers: the
doc explicitly anticipates "a future table could add read/write observations
additively." Nothing in the current schema or code prevents a later author
from instead adding nullable `read`/`write` columns directly onto
`anno_evid_exec` (a retrofit rather than a new table), which would violate
this phase's own stated discipline. There is no structural test today (analogous
to `evid-report-keys.test.ts`'s direction 4 for `RuntimeExecClass`) that would
catch a `read`/`write` column being added to `anno_evid_exec` itself.

**Fix:** No action required now. If a future phase adds read/write
observations, consider a durability or schema test asserting
`anno_evid_exec`'s column set stays exactly the five documented columns
(`id`, `image_sha256`, `argv_digest`, `seed`, `address`, `source_bank`),
mirroring `anno-durability.test.ts:576`'s existing "carries exactly the
no-change run-identity column set" assertion, so a future retrofit fails a
test rather than only a code-review reading.

---

_Reviewed: 2026-09-10T12:35:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
