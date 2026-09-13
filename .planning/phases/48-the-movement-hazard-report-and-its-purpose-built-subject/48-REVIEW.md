---
phase: 48-the-movement-hazard-report-and-its-purpose-built-subject
reviewed: 2026-09-13T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - scripts/lib/anno-cli-invocations.mjs
  - scripts/lib/anno-cli-verbs.mjs
  - src/mcp/vice/anno-cli-path-consumers.test.ts
  - src/mcp/vice/anno-cli.test.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-decomp-closure.test.ts
  - src/mcp/vice/anno-hazard-report.test.ts
  - src/mcp/vice/anno-hazard-report.ts
  - src/mcp/vice/anno-register.ts
  - src/mcp/vice/anno-store-export.ts
  - src/mcp/vice/anno-tools.ts
  - src/mcp/vice/anno-verb-coverage.test.ts
  - src/mcp/vice/fixtures/dxa/basic-stub.annostore.json
  - src/mcp/vice/fixtures/dxa/fixture.annostore.json
  - src/mcp/vice/fixtures/dxa/tracer.annostore.json
  - src/mcp/vice/fixtures/export-asm/smc.annostore.json
  - src/mcp/vice/fixtures/ghidra/bank.annostore.json
  - src/mcp/vice/fixtures/ghidra/bank-path-dependent.annostore.json
  - src/mcp/vice/fixtures/ghidra/charset-phantom.annostore.json
  - src/mcp/vice/fixtures/hazard-subject/CROSS-CHECK.md
  - src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject.a
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-align.a
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-misaligned.a
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-dispatch.a
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-misaligned.prg
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-raster.a
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-smc.a
  - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs
  - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs
  - src/mcp/vice/fixtures/petcat/computed-sys.annostore.json
  - src/mcp/vice/fixtures/petcat/not-basic.annostore.json
  - src/mcp/vice/hazard-subject-fixture.test.ts
  - src/mcp/vice/hazard-subject-reassembly.test.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/skills/c64-program-recon/references/tool-selection.md
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 48: Code Review Report

**Reviewed:** 2026-09-13
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

The pure `buildHazardReport()` module (`anno-hazard-report.ts`) itself is careful, well-tested,
and honors the project's anti-vacuity discipline: the three-outcome region disposition, the
detection-strength asymmetry (an observation can only raise, never establish or lower, a
finding), the always-emitted `HAZARD_LIMITS`, and the read-only structural test are all real and
covered by direct unit tests, including a genuine cross-check against independently-sourced
fixtures. The purpose-built `hazard-subject` fixture tree (source, generator, and the two
dedicated test files) is thorough and internally consistent, and re-derives its own checks
independently of the code under test rather than mirroring it.

The two places that actually reach this module from the outside world — the CLI's
`cmdHazardReport()` in `anno-cli.ts` and the MCP tool's `dispatchHazardReport()` in
`anno-tools.ts` — both discard the pure module's own `truncated` signal, one of exactly the two
project-mandated guarantees called out for special attention in this review (`CLAUDE.md` point 3:
"no count, field or line may be derived from never-observed addresses... flag anything that
erodes this" — the sibling case here is a real signal the module goes out of its way to preserve,
silently overwritten one layer up). This is a genuine regression of a load-bearing property, not
a style nit: the module's own header states "Propagated, never swallowed: a scan cut short by
MAX_TABLE_ENTRIES must be visible on the report it feeds, not silently absorbed" — and both real
consumers absorb it anyway. Neither surface has a test that would have caught this (the CLI verb
has exactly one hazard-report-specific test, and it only checks the unknown-verb error message).

A second, unrelated defect in this phase's diff: `anno-store-export.ts`'s new scope-import path
can throw mid-loop against the *target store's* pre-existing scopes, after earlier plan entries
(ranges, labels, comments, enums, xrefs, exec observations) have already been committed —
contradicting the "whole import is refused rather than partially applied" guarantee the same
function states two lines above the loop.

No planning-vocabulary leaks were found in any file this phase actually touched (the fixture
`.a`/`.md` files are clean, and each has its own dedicated test enforcing that). The pre-existing
`D-NN` citations found in `anno-register.ts`, `module-classification.ts`, and `anno-tools.ts` are
untouched lines predating this phase's diff and are not part of this review's scope.

## Critical Issues

### CR-01: The hazard report's `truncated` signal is silently discarded at both real consumer surfaces

**File:** `src/mcp/vice/anno-tools.ts:3014-3042` (MCP tool `dispatchHazardReport`), `src/mcp/vice/anno-cli.ts:2863-2955` (CLI `cmdHazardReport`)

**Issue:** `buildHazardReport()` computes its own `truncated` field to mean exactly one thing: the
imported `scanIndirectDispatch()` scan was cut short by `MAX_TABLE_ENTRIES` (see
`anno-hazard-report.ts:1208-1211`, and the test at `anno-hazard-report.test.ts:165-178` that pins
this propagation). The module's own header is explicit that this must never be silently absorbed.

Both real callers throw that value away:

- `anno-tools.ts:3032-3041` (`dispatchHazardReport`):
  ```ts
  const findings = maxResults === undefined ? report.findings : report.findings.slice(0, maxResults);
  return {
    store: handle.path,
    image: image.path,
    ...report,
    findings,
    returned: findings.length,
    matched: report.findings.length,
    truncated: report.findings.length > findings.length,
  };
  ```
  `...report` spreads in the real `report.truncated` (the scanner's own signal), but the object
  literal's own `truncated:` key — evaluated after the spread — always wins. Its value is
  `report.findings.length > findings.length`, i.e. "did `max_results` cut the *findings array*
  short" — an entirely different, `max_results`-driven concept that this project uses elsewhere
  (`symbols`/`comments`/`blocks`/`callers`, all following the same `matched`/`returned`/`truncated`
  shape). Since `max_results` is optional and has no default (`assertOptionalMaxResults()` returns
  `undefined` when omitted), the ordinary, undecorated call — `anno_hazard_report({store, image})`
  with no `max_results` — takes the `maxResults === undefined` branch, so `findings` is never
  sliced and this expression is unconditionally `false`, **regardless of whether the underlying
  indirect-dispatch scan actually truncated**. A caller who never learns to pass `max_results`
  (the schema documents it as optional, "not required — an empty or small finding set is the
  ordinary, sound case") can never see a scan-truncation signal at all.

- `anno-cli.ts:2949-2953` (`cmdHazardReport`, both the `--json` and rendered branches):
  ```ts
  console.log(JSON.stringify({ store: storePath, image: imagePath, ...report, returned: report.findings.length, matched: report.findings.length, truncated: false }, null, 2));
  ...
  printHazardReport(storePath, imagePath, { ...report, returned: report.findings.length, matched: report.findings.length, truncated: false });
  ```
  Here it is worse: `truncated: false` is a hard-coded literal with no conditional at all. The CLI
  verb has no `--max-results` option (correctly — it isn't in `VERB_OPTIONS["hazard-report"]`), so
  there is no scenario in which this path can ever report `truncated: true`, even though
  `printHazardReport()`'s own rendering code (`anno-cli.ts:2807`) is written to display exactly
  that condition (`${r.truncated ? ", truncated" : ""}`), and the doc comment on
  `HazardReportInput`/`HazardReport` explicitly designed this field to matter.

This is exactly the class of defect this project's own header prose warns readers against one
file over: a written guarantee ("propagated, never swallowed") that is true at the point it is
stated and false one hop away, with nothing to catch the gap. A real-world program whose
indexed-dispatch scan hits the 64-entry cap will report `hazard-reported`/`no-signal`/
`unclassified` regions and a findings list that both surfaces present as complete when it is not,
directly eroding the "no field may be read as a safety certificate" discipline this whole family
exists to uphold (the cap conceals real, unscanned dispatch tables, and nothing downstream says so).

**Fix:** Stop conflating two different truncation concepts under one field name at these two
call sites.

For `anno-tools.ts`, keep the scanner's own truncation separate from the `max_results` cap (as
`report.truncated` vs., e.g., a renamed `resultsCapped`), or OR them together explicitly:
```ts
return {
  store: handle.path,
  image: image.path,
  ...report,
  findings,
  returned: findings.length,
  matched: report.findings.length,
  truncated: report.truncated || report.findings.length > findings.length,
};
```

For `anno-cli.ts`, since this verb has no `max_results`/pagination option at all, simply preserve
the report's own value instead of overwriting it:
```ts
console.log(JSON.stringify({ store: storePath, image: imagePath, ...report, returned: report.findings.length, matched: report.findings.length }, null, 2));
...
printHazardReport(storePath, imagePath, { ...report, returned: report.findings.length, matched: report.findings.length });
```
(dropping the redundant `truncated: false` override entirely lets the spread's real value through).

Add a direct test exercising `cmdHazardReport`/`dispatchHazardReport` against a store+image pair
that trips `MAX_TABLE_ENTRIES` (the existing hand-built fixture in
`anno-hazard-report.test.ts:165-178` can be reused) and asserts `truncated === true` end to end —
see WR-01 below.

### CR-02: Scope import can partially apply against a target store's pre-existing scopes

**File:** `src/mcp/vice/anno-store-export.ts:562-631` (`importStoreDocument`)

**Issue:** The new `scopes` import path (added this phase for the multi-file export tree) checks
overlap only among the *document's own* scope rows (`anno-store-export.ts:571-580`), before the
apply loop, and the comment directly above the loop states:

```ts
  // VALIDATION IS COMPLETE. Nothing above this line calls a `set*`/`put*`/
  // `insert*` function on `handle` -- everything from here on is applying
  // the already-validated plan.
```

But `addScope()` (`anno-store.ts:3037-3086`) itself refuses — by throwing `AnnoRangeShapeError` —
when the incoming scope overlaps *any existing scope already in the target store* (not merely
another row in the same document), via a live query against `anno_scope` inside its own
transaction. `importStoreDocument()`'s apply loop is not wrapped in one overarching transaction;
each `set*`/`put*`/`insert*`/`addScope` call commits its own write independently (via
`applyWrite()` → `runWriteSequence(..., true, ...)`). So importing a document whose `scopes` array
overlaps a scope that already exists in the target store will: (1) successfully write every range,
label, comment, enum, xref, and exec-observation entry from the plan, (2) throw partway through
the `scopes` portion of the loop, leaving the store with the ranges/labels/comments/etc. committed
but not all — or none — of the intended scopes. This directly contradicts both the "VALIDATION IS
COMPLETE" claim immediately above the loop and the scope-overlap branch's own stated guarantee two
lines earlier ("the whole import is refused rather than partially applied") — that branch only
covers document-internal overlap, not overlap against the live store's existing rows.

This is realistically reachable: any workflow that imports a committed store export into a store
that already has scopes (e.g. re-importing an updated per-fixture export into a project store
that has previously received scopes from an earlier import, or importing two documents whose
scope sets are not disjoint into the same store) will partially write instead of atomically
refusing.

**Fix:** Either (a) pre-check the incoming scopes against `listScopes(handle)`'s existing rows
using the same overlap predicate *before* any write in the plan begins (mirroring the
document-internal check already present), refusing the whole import up front on a genuine
conflict; or (b) wrap the scope-application portion (or the whole apply loop) in a single
transaction so a mid-loop throw rolls back every write from this call, restoring the "refused
rather than partially applied" property the code already claims. Given the existing per-field
`AnnoStoreExportError` refusal style used everywhere else in this function, option (a) is more
consistent with the surrounding code and requires no change to `anno-store.ts`'s transaction
model.

## Warnings

### WR-01: `hazard-report`'s CLI verb has no functional test coverage

**File:** `src/mcp/vice/anno-cli.test.ts:2145-2153`

**Issue:** The only `hazard-report`-specific test in `anno-cli.test.ts` checks that the
unknown-verb error message names all six verbs. There is no test that actually invokes
`runAnnoCli(["hazard-report", "--store", ..., "--image", ...])` against a real store/image and
asserts on its stdout, its `--json` output, its confinement/missing-file refusals, or (most
relevantly to CR-01) its `truncated` field. Compare with `coverage`/`export-asm`/
`evid-disagreements`/`decomp-completeness`, each of which has multiple direct functional tests in
this file. `anno-cli-path-consumers.test.ts` only checks the confinement-seam-count invariant, not
this verb's actual output shape, and `anno-hazard-report.test.ts` never calls `cmdHazardReport`/
`runAnnoCli` at all (it calls `buildHazardReport()` directly). This gap is exactly why CR-01
shipped undetected.

**Fix:** Add at least one `anno-cli.test.ts` test that runs the real CLI verb end to end (open a
store via a temp workspace, populate a range/label, point `--image` at a committed `.prg`
fixture) and asserts on the printed output and/or `--json` shape, including a case that trips
`MAX_TABLE_ENTRIES` to pin `truncated` behavior.

### WR-02: `matched`/`returned` fields are dead weight in the CLI's hazard-report JSON output

**File:** `src/mcp/vice/anno-cli.ts:2950, 2953`

**Issue:** Since `cmdHazardReport` never slices `report.findings` (there is no `--max-results`
option on this verb), `matched` and `returned` are always set to the same value
(`report.findings.length`), making both fields redundant with each other and with
`report.findings.length` itself. This isn't wrong, but it silently implies a pagination
contract this verb doesn't have (unlike the MCP tool, which genuinely paginates via
`max_results`), and a future reader adding a `--max-results` flag to this verb could easily miss
that these two lines need to diverge again.

**Fix:** Either drop `matched`/`returned` from the CLI's rendered/JSON output (since they carry no
information beyond `findings.length` today), or add a one-line comment explaining that they are
placeholders mirroring the MCP tool's shape for a pagination option this verb does not currently
offer.

### WR-03: `printHazardReport()`'s declared parameter type diverges from the real `HazardReport` shape

**File:** `src/mcp/vice/anno-cli.ts:2784-2802`

**Issue:** `printHazardReport()` declares its own local structural type for `r` rather than
importing `HazardReport`/`HazardFinding`/etc. from `anno-hazard-report.ts`. It already omits
fields the real type has (e.g. `corroboration`, `classesEvaluated`, `unprovenDispatchCandidates`,
`denominator`'s relationship to `limits`), which is fine for a rendering function that only needs
a subset — but the redeclared `truncated: boolean` here is exactly the field CR-01 shows is
wrong at the call site, and a hand-copied type gives no compiler signal when the real shape's
semantics drift from what this function assumes. `unprovenDispatchCandidates` — a field
`HazardReport`'s own doc comment insists must never be silently dropped ("Dropping this collection
... would make an honest decline indistinguishable from an absence") — is spread into the JSON
output via `...report` but is never rendered by `printHazardReport()` at all, so the
human-readable (non-`--json`) report path never shows an operator the declined dispatch
candidates the pure module goes out of its way to preserve.

**Fix:** Import and reuse `HazardReport` (or a `Pick<...>` of it) instead of a hand-rolled
structural type, so a field rename or type change in `anno-hazard-report.ts` surfaces as a
compile error here. Separately, consider rendering `unprovenDispatchCandidates` under its own
heading in the non-JSON report, consistent with how `HAZARD_LIMITS`'s own text insists a decline
must never read as an absence.

## Info

### IN-01: `HazardReportParsedArgs`/parse function duplicate a five-parser pattern with no shared abstraction

**File:** `src/mcp/vice/anno-cli.ts:2721-2771`

**Issue:** `parseHazardReportArgs()` is the fifth near-identical hand-rolled option parser in this
file (after `render-memmap`, `coverage`, `export-asm`, `evid-disagreements`/`decomp-completeness`),
each repeating the same `for` loop shape, `*MissingValue` bookkeeping, and `unknownOption ??= a`
pattern. This is consistent with the existing file's style (and the file's own header notes this
was a deliberate choice for `isMissingOptionValue()` after a prior defect), so this is not a
regression, but the fifth repetition is a reasonable point to note it as a candidate for a small
shared "closed-flag-set parser" builder, parameterized by the flag/value/boolean spec, the next
time a sixth parser is added.

**Fix:** No action required for this phase; noting for future refactoring consideration only.

---

_Reviewed: 2026-09-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
