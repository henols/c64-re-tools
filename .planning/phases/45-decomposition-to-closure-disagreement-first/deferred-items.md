# Phase 45 — Deferred Items

Out-of-scope discoveries found while executing a plan in this phase, logged
rather than fixed (per the executor's scope-boundary rule: only auto-fix
issues directly caused by the current task's own changes).

## 1. FLOW-02 violation in `anno-cli.ts`'s `decomp-completeness` USAGE text (found during plan 45-03, Task 3)

**Found during:** Task 3 (correcting `.planning/PROJECT.md`'s ANNO-13 notice),
while running this task's own verify command
`node --test docs-absorbed-decisions.test.ts docs-dangling-refs.test.ts`.

**What's wrong:** `docs-dangling-refs.test.ts` fails two tests:

- `no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)`
- `planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not`

Both fail because `anno-cli.ts`'s `decomp-completeness` verb USAGE text (added
by plan 45-01) contains literal phase-number references in shipped,
user-facing source — `"Phase 45's decomposition-closure completeness answer
for ONE per-fixture store (D-07)."` and `"EXECUTED: this fixture was run
under Phase 33's reproducible-run protocol."`. FLOW-02's own rule
(D-11.1-01) is that a phase is a planning artifact, never a durable
user-facing remediation path — the guard exists specifically to catch this
shape.

**Proven pre-existing, not caused by this plan's own changes:** reproduced
identically with `.planning/PROJECT.md` reverted to its pre-Task-3 (`git show
HEAD`) content — the same two tests fail either way. This plan (45-03)
modifies only `src/mcp/vice/anno-enum-gen.ts`, `anno-enum-gen.test.ts` and
`.planning/PROJECT.md`; `anno-cli.ts` is untouched by any task in this plan.

**Owning plan:** plan 45-01, which added the `decomp-completeness` verb and
its USAGE text. Not fixed here — out of this plan's `files_modified` scope
(scope-boundary rule), and 45-01 is already summarized and committed.

**Suggested remedy for whoever picks this up:** reword the two flagged USAGE
lines to drop the phase-number references (e.g. "this project's own
decomposition-closure completeness answer" and "run under this project's
reproducible-run protocol" or similar), then re-verify
`docs-dangling-refs.test.ts` is fully green.

**Also recorded in:** `.planning/WINDOWS.md` (via `gsd_run windows append`).
  status: acknowledged
