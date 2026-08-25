---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 12
subsystem: testing
tags: [r2000, coverage-instrument, multi-caller-rule, dispatch-scan, 16-bit-bound, negative-controls]

# Dependency graph
requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-06's anchored `namesACaller()` — the hex branch this plan leaves byte-identical and the identifier boundaries it keeps"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-11's `isPlausibleEntryPoint()`, rebuilt `STACK_RETURN` fixture and leading-load consumption rule — the same regions of both files this plan edits"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "IN-04's `computeStructuralCensus()` clamp at `$10000` — the quantity this plan makes the dispatch scan share"
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "19-14's CR-02 discharge, which made the full-suite gate honest"
provides:
  - "`citesCallerByName()` — the multi-caller rule's label-name branch now demands that a caller's name be USED AS A REFERENCE (backticked, introduced by a caller-naming word, or followed by its own parenthesised hex address), with the decision, the rejected alternative and the residual recorded beside the rule"
  - "`CALLER_CITATION_WORDS` — the named, frozen marker set the name branch reads, so widening it is a one-line edit in an obvious place rather than a change buried in a pattern string"
  - "The coincidental-English-word control and its four genuine-citation twins, plus the fixture-level both-directions statement (NC5 CLEAN, NC4 still caught by `reproducibility` BY NAME)"
  - "`effectiveEnd` in `scanIndirectDispatch()` — ONE clamped bound, derived the same way as the census's, read by all five sites that previously recomputed origin-plus-length"
  - "`tableWalkPayload()` and `stackReturnTopOfSpacePayload()` — origin-parameterised payloads that make 'the same program at two origins' true by construction"
  - "The extended out-of-16-bit-space test: four bounded assertions over the dispatch sub-report, the one-address-space assertion against the census beside it, and the non-vacuity half"
affects: [phase-20, phase-21, r2000-coverage, coverage-report-consumers]

actuals:
  tokens: 7087
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Single-seam-per-concern applied at FUNCTION scope: a bound stated once as a derived local and read everywhere, never recomputed at a use site"
    - "A predicate tightening ships its both-directions control in the same commit — the refusing case AND the genuine case"
    - "A marker set that governs a regex lives in a named frozen constant, not inlined in the pattern"

key-files:
  created: []
  modified:
    - src/mcp/vice/r2000-coverage.ts
    - src/mcp/vice/r2000-coverage.test.ts

key-decisions:
  - "WR-13 fixed by DEMANDING A REFERENCE, not by removing the name branch: a caller's label name counts only when backticked, introduced by a caller-naming word from `CALLER_CITATION_WORDS`, or followed by its own parenthesised hex address"
  - "The rejected alternative — drop the name branch and accept only the hex form — is recorded beside the rule with its reason: it would silently reclassify every project whose annotator cites callers by name, turning a measure of documentation quality into a measure of citation style"
  - "Marker words are matched at their lowercase and sentence-initial-capital spellings rather than case-insensitively, because the NAME half of the same regex stays case-SENSITIVE"
  - "The scan's clamp break keeps the existing out-of-image break's `truncated` semantics (no flag raised) rather than inventing new ones — it is the same class of stop at a lower ceiling, and changing it would move other fixtures' `truncated` expectations"
  - "The out-of-16-bit-space test was EXTENDED rather than duplicated, so the census's bound and its dispatch sub-report's bound are asserted in ONE place — which is what makes 'one address space' a claim rather than two separate 'this one is small too' assertions"

patterns-established:
  - "Origin-parameterised payload builders: a control that needs the same program at two origins builds both from the origin, so 'identical apart from placement' is true by construction"
  - "A bound assertion is paired with a non-vacuity half that shows the bound truncates real findings rather than emptying the report"

requirements-completed: [COV-02, COV-01]

coverage:
  - id: D1
    description: "The multi-caller rule's label-name branch demands that a caller's name be used as a reference; an ordinary English word in ordinary prose leaves the label counted as UNDOCUMENTED"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#WR-13: a caller's label name counts only when the comment USES it as a reference -- an ordinary English word in ordinary prose names no caller"
        status: pass
    human_judgment: false
  - id: D2
    description: "The tightening is both-directions: four genuine citation shapes still clear the rule, NC5 still produces a CLEAN report, and NC4 is still caught by `reproducibility` BY NAME"
    requirement: "COV-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#WR-13: the fixture-level both-directions statement -- NC5 stays CLEAN and NC4 is still caught by `reproducibility`"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#ANCHORING: a colliding longer hex never satisfies the multi-caller rule -- NC4 plus $8106 is still undocumented, and the well-documented control is still clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "The dispatch scan describes the same address space as the census beside it — no published value exceeds `$FFFF` for a project whose declared origin plus length leaves the 16-bit space"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts#a census whose origin plus size would leave the 16-bit space is bounded, AND SO IS ITS OWN DISPATCH SUB-REPORT"
        status: pass
    human_judgment: false
  - id: D4
    description: "The bound is stated once and read everywhere: all five sites in `scanIndirectDispatch()` that recomputed origin-plus-length read one derived `effectiveEnd`"
    requirement: "COV-01"
    verification:
      - kind: other
        ref: "grep over scanIndirectDispatch() for `safeOrigin + size` / `>= size` — only the single derivation at r2000-coverage.ts:793 remains"
        status: pass
    human_judgment: false
  - id: D5
    description: "The instrument remains read-only by construction: no filesystem write and no live-session import in `r2000-coverage.ts` after this run's edits"
    requirement: "COV-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/r2000-coverage.test.ts (committed source-level assertion; full file run 71/71) "
        status: pass
    human_judgment: false

duration: 31 min
completed: 2026-08-25
status: complete
---

# Phase 19 Plan 12: WR-13 and IN-05 Gap Closure Summary

**A caller's label name now counts only when the comment USES it as a reference (backticked, introduced by a caller-naming word, or followed by its own parenthesised hex address), and the dispatch scan reads one clamped `effectiveEnd` at `$10000` instead of five recomputations of origin-plus-length.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-08-25T08:22:00Z
- **Completed:** 2026-08-25T08:52:35Z
- **Tasks:** 2
- **Files modified:** 2

## Dispositions recorded

Both findings are disposed **fixed-and-cited**. This section is the disposition source `docs-review-disposition.test.ts` reads.

| Finding | Disposition | Commit | What changed |
|---------|-------------|--------|--------------|
| **WR-13** | fixed-and-cited | `8c7a75c` | `namesACaller()`'s label-name branch now demands a reference via the new `citesCallerByName()` + `CALLER_CITATION_WORDS`; decision, rejected alternative and residual recorded beside the rule; coincidental-word control and four genuine-citation twins added |
| **IN-05** | fixed-and-cited | `c213093` | `scanIndirectDispatch()` derives one `effectiveEnd = Math.min(safeOrigin + size, 0x10000)`; all five sites that recomputed origin-plus-length read it; the existing out-of-16-bit-space test extended over the dispatch sub-report |

## Accomplishments

- **WR-13 closed.** The multi-caller rule can no longer be talked into a clean verdict by an ordinary English word. Bare presence of a caller's label name is refused; a reference is required.
- **The judgment is recorded, not implicit.** The chosen definition, the alternative weighed and rejected with its reason, and the *residual* risk are all in the doc comment beside the rule, so the next reader does not re-derive them.
- **Both directions shipped in one commit each.** The tightening has four genuine-citation controls plus the fixture-level statement (NC5 CLEAN with an empty findings array, NC4 still caught by `reproducibility` BY NAME). The bound has a non-vacuity half showing it truncates real findings rather than emptying the report.
- **IN-05 closed and the report made self-consistent.** The census and its own dispatch sub-report are now asserted, in one test, to describe one address space.
- **No fixture and no expected verdict was moved.** `git diff src/mcp/vice/fixtures/` is empty across both commits, and regenerating the fixtures twice leaves `git status --porcelain src/mcp/vice/fixtures/coverage` empty.

## Task Commits

1. **Task 1: Make the multi-caller rule's name branch demand a reference, not a coincidence** — `8c7a75c` (fix)
2. **Task 2: Give the dispatch scan the same 16-bit bound the census already has, stated once** — `c213093` (fix)

## Files Created/Modified

- `src/mcp/vice/r2000-coverage.ts` — `CALLER_CITATION_WORDS` + `CALLER_CITATION_ALTERNATION` (new module-level constants), `citesCallerByName()` (new non-exported helper carrying the WR-13 decision record), `namesACaller()`'s name branch rewired to it, and `effectiveEnd` derived once in `scanIndirectDispatch()` and read by all five bound sites.
- `src/mcp/vice/r2000-coverage.test.ts` — two new WR-13 tests, two new origin-parameterised payload builders, a `scanAt()` helper, and the extended out-of-16-bit-space test.

## WR-13: the decision, verbatim in effect

**What now counts as naming a caller** (all three still bounded on identifier boundaries on both sides, so `my_entry_pointer` still does not name `entry_point`):

1. **(a) Marked up as a symbol** — the name in backticks. An annotator who fences a token is quoting an identifier, not writing prose.
2. **(b) Introduced by a caller-naming word** from `CALLER_CITATION_WORDS` = `["from", "by", "call", "called", "caller", "callers", "calls"]`, within three NON-IDENTIFIER characters: `from init`, `called by init`, `callers: init`. `by` carries `called by` / `invoked by` / `used by` — a comment saying some routine uses this one is naming a caller.
3. **(c) Followed by its own parenthesised hex address** — `init ($0012)`.

Marker words are matched at their lowercase and sentence-initial-capital spellings rather than case-insensitively, because the NAME half of the same regex is case-SENSITIVE (`Init` is a different symbol from `init`).

**Why bare presence is not enough:** regenerator2000 label names are routinely ordinary English words — `loop`, `init`, `main`, `start`, `data`, `table`, `draw` — and an ordinary description of what a routine does will contain one by accident. A label counted as documented stays in `labels.kindRatio.user` and stays in the reproducibility sample, so the measure that exists to catch it can no longer see it.

**The alternative weighed and REJECTED:** drop the name branch entirely and accept only the hex form, which CR-01's fix already anchors correctly. Strictly safer and strictly simpler. Rejected because it would silently reclassify every project whose annotator cites callers by name rather than by address — a real and reasonable convention — turning a measure of documentation quality into a measure of citation style, with no signal to the operator that the rule had changed underneath them.

**The residual, stated rather than hidden:** a marker word can still precede a coincidental name ("copies bytes from screen" where a caller is named `screen`). That is a far narrower coincidence than bare presence and it errs toward accepting a citation rather than manufacturing one; widening the refusal further would need a corpus, not a guess.

### Observed values for the coincidental-word control

Inputs are `19-REVIEW.md`'s reproduction verbatim: callers of `$0820` are `[$0012, $0034]`, caller `$0012` named `loop`, comment `"[confirmed-code] sets the mode flag before the main loop runs"`.

| Run | `multiCallerUndocumented` | Verdict |
|-----|---------------------------|---------|
| **Pre-fix** (identifier-bounded presence) | `{ count: 0, addresses: [] }` | falsely CLEAN — `loop` matched inside "main loop runs" |
| **Post-fix** (reference demanded) | `{ count: 1, addresses: [2080] }` (`[$0820]`) | correctly caught |

The pre-fix value was confirmed directly by evaluating the old pattern `(?<![0-9A-Za-z_])loop(?![0-9A-Za-z_])` against the comment: it matches (`true`), which is what produced the clean verdict.

**Genuine-citation twins, all observed `{ count: 0, addresses: [] }`:** `"... reached from loop on the cold path"`, `"... called by loop and by the raster handler"`, `"... callers: loop"`, and the backticked `"... before the main \`loop\` runs"`, plus the parenthesised-hex form `"... loop ($0012) reaches it on the cold path"`. The boundary is also asserted in the refusing direction: `"reached from loop_counter ..."` returns `{ count: 1, addresses: [$0820] }` — a citation marker must not buy a substring match.

**Fixture-level both-directions statement:** `coverageFindings(reportFor("nc5-well-documented"))` → `clean: true`, `findings: []`. `nc4-multi-caller-unnamed` → `clean: false` with a finding whose `measure` is `reproducibility`. NC5's `$0820` comment cites its callers by HEX (`"reached from $0810 and from $0816"`, confirmed by reading `GOOD_COMMENTS` in `make-coverage-fixtures.mjs`), so the hex branch carries it and the name-branch tightening leaves it untouched. No currently-clean fixture's verdict moved.

## IN-05: the sites changed, with their line numbers AS FOUND

All five read the single derived bound at (post-edit) `r2000-coverage.ts:793`:
`const effectiveEnd = Math.min(safeOrigin + size, 0x10000);`

| # | Site (line number as found, pre-edit) | Before | After |
|---|---------------------------------------|--------|-------|
| 1 | `inImage` — **:782** | `addr + 1 < safeOrigin + size` | `addr + 1 < effectiveEnd` |
| 2 | `isPlausibleEntryPoint` — **:803** | `value < safeOrigin + size` | `value < effectiveEnd` |
| 3 | class-2 table walk's entry test — **:847** | `entry < safeOrigin + size` | `entry < effectiveEnd` |
| 4 | class-4 reconstruction's in-image test / `discovered` guard — **:935** | `loIdx >= size \|\| hiIdx >= size` | `loBase + k >= effectiveEnd \|\| hiBase + k >= effectiveEnd` |
| 5 | class-3 reconstruction's index computation — **:1045** | `loIdx >= size \|\| hiIdx >= size` | `loBase + k >= effectiveEnd \|\| hiBase + k >= effectiveEnd` |

The review named four sites; there are **five** — 19-11's `isPlausibleEntryPoint()` extraction is the fifth, and it is read by both gated reconstructions, so leaving it out would have left the plausibility test describing a different address space from the walk that calls it. Sites 4 and 5 are expressed on the ADDRESSES rather than on the indices so the comparison reads against `effectiveEnd` directly; `loIdx < 0 || hiIdx < 0` (below-origin) is retained unchanged. A grep over the function for `safeOrigin + size` / `>= size` now returns exactly one hit: the derivation itself.

### The four bounded assertions — observed results

Malformed input: origin `$FFF0`, payload length `$40` (declared end `$10030`, past the top by `$30`). Two origin-parameterised payloads, each also run at the legal origin `$C000`.

| Assertion | Pre-fix observed | Post-fix observed |
|-----------|------------------|-------------------|
| every `dispatch.tableEntryAddresses` ≤ `$FFFF` | **VIOLATED** — class-2 published `$10000 … $1002E` (47 out-of-space values, max `$1002E`); class-4 published `$10000 … $10004` | PASS — class-2 max `$FFFE`, class-4 max `$FFFF` |
| every `dispatch.discoveredTargets` ≤ `$FFFF` | PASS (`$FFF0` / `$FFF8`) — a reconstructed target is a 16-bit word, so this holds by construction | PASS |
| every `SplitTableFinding.targets` entry ≤ `$FFFF` | PASS — empty for both payloads (class 4 claims the window, class 3 declines) | PASS |
| every stack-return finding's target ≤ `$FFFF` | PASS (`$FFF8` ×6) — masked `& 0xffff` at reconstruction, so also by construction | PASS |

Recorded honestly: only the FIRST assertion was load-bearing. `tableEntryAddresses` is the one family that genuinely left the space, because it is built from `cursor`/`base + k` rather than from a 16-bit word read. The other three are regression bounds over values that are ≤ `$FFFF` by construction (a target is either a word read from two bytes or a `(pushed + 1) & 0xffff`), and they are asserted so a future change that stops masking is caught by name rather than discovered downstream.

**One address space, asserted:** the census over the same malformed pair reports `rangeBytes` such that `0xFFF0 + rangeBytes === 0x10000` (unchanged by this run), and every value in `tableEntryAddresses ∪ discoveredTargets` from both payloads is asserted `< censusRangeEnd`.

**Non-vacuity half — the bound truncates real findings rather than emptying the report:**

| Payload | at `$FFF0` (bounded) | at `$C000` (legal) |
|---------|----------------------|--------------------|
| class-2 table walk | 1 table, **6 entries**, max entry address `$FFFE` | 1 table, **30 entries** |
| class-4 stack-return | 1 finding, **1 entry**, target `$FFF8` | 1 finding, **6 entries**, all targets `$C008` |

The legal-origin runs are **byte-identical pre- and post-fix** (30 and 6 entries in both), so the clamp engages only where it must.

## Decisions Made

See `key-decisions` in the frontmatter. The two that a future reader is most likely to question:

- **Why not drop the name branch entirely** (the safer, simpler WR-13 fix) — recorded above and in the source: it would silently convert a documentation-quality measure into a citation-style measure.
- **Why the clamp break does not raise `truncated`** — the pre-existing out-of-image break at the same two sites does not raise it either, and the clamp is the same class of stop at a lower ceiling. Raising it would have changed `truncated` semantics for inputs unrelated to IN-05 and could have moved committed fixtures' expectations, which this plan is explicitly forbidden from buying a green result with.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed with the tightening and its controls in the same commit, as their prohibitions require.

## Issues Encountered

**One pre-existing, load-sensitive flake, already logged — not re-logged, not chased.**

`r2000-session.test.ts` → `stub: a child that answers nothing within the call timeout rejects with R2000TimeoutError, is killed, and the crash counter increases by 1` failed in both PARALLEL full-suite runs on this machine (`expected 1, actual 0` on the crash counter, at `r2000-session.test.ts:631`). It is `deferred-items.md` item 3, found by 19-11 with the identical signature.

Evidence that it is not this plan's:

- Standalone run of the file: `# tests 25 / # pass 25 / # fail 0`.
- **Serial full-suite run: `# tests 2580 / # pass 2535 / # fail 0`** — the recorded full-suite line for this plan.
- `r2000-session.ts` and `r2000-session.test.ts` import nothing from `r2000-coverage.ts`; there is no path from either file this plan edits to the failing assertion, which is a wall-clock child-process timeout.

No timeout was widened, no planning document was edited to make the tree look green, and the deferred item was not re-logged.

## Verification

| Check | Result |
|-------|--------|
| `node --test r2000-coverage.test.ts` | `# tests 71 / # pass 71 / # fail 0` |
| `npm test` (FULL suite, serial schedule) | **`# tests 2580 / # pass 2535 / # fail 0`** (parallel schedule: `# fail 1`, deferred item 3 — see above) |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `git diff src/mcp/vice/fixtures/` | empty |
| `node fixtures/coverage/make-coverage-fixtures.mjs` ×2 → `git status --porcelain src/mcp/vice/fixtures/coverage` | empty |
| `node scripts/check-npm-packages.mjs` | exit 0 |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 |
| `node scripts/check-skill-description-overlap.mjs` | exit 0 |
| `git diff` on `COVERAGE_SCHEMA_VERSION` / `COVERAGE_REPORT_KEYS` | no change (schema stays 2) |
| `git status --porcelain .planning/REQUIREMENTS.md` | empty — this plan ticks no box |
| `git status --porcelain .../19-REVIEW.md` | empty — byte-unchanged |
| Every commit subject carries `[skip release]` | yes (`8c7a75c`, `c213093`) |

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. `r2000-coverage.ts` remains read-only by construction (no filesystem write, no live-session import), and the two registered high-severity threats T-19G-12-01 and T-19G-12-02 are the two findings this plan mitigates.

## Known Stubs

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Gap 2's `missing` item 2 now has a **fixed-and-cited** disposition for all four findings it names: `WR-14` and `WR-15` (19-11), `WR-13` and `IN-05` (this plan). 19-13 writes the durable disposition ledger over them.
- The coverage report's two halves describe one address space, so Phase 20 and Phase 21 can consume `dispatch.*` without re-deriving the bound.
- Nothing is published: every commit carries `[skip release]`, and the hold's lifting condition (a no-gaps Phase 19 re-verification) has not happened.

---
*Phase: 19-absorbed-procedures-and-the-coverage-instrument*
*Completed: 2026-08-25*

## Self-Check: PASSED

- `src/mcp/vice/r2000-coverage.ts`, `src/mcp/vice/r2000-coverage.test.ts` and this SUMMARY all exist on disk.
- All three commits exist in `git log --all`: `8c7a75c` (Task 1), `c213093` (Task 2), `a7d8a93` (this SUMMARY).
