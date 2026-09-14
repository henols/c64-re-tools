# Phase 56: Remove `shipped-modules.ts` and Its Embedded Source Scans - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Delete `src/mcp/vice/shipped-modules.ts` and every test case whose subject is
source TEXT, leaving the surviving files' behavioural coverage intact.

This is **surgery inside living files**, not whole-file deletion. The three
preceding rounds (`260914-poo`, 60 files; `260914-uhm`, `capture-seam.test.ts`)
removed every WHOLE-FILE source scanner and could be verified by set-equality on
the git deletion set. What is left is embedded: scanning cases living inside
otherwise-real behaviour tests. A wrong cut removes real coverage silently and a
green suite will not catch it.

**Not in scope:** repairing the modules left deliberately untested by the
preceding rounds (the dxa family, `test-gate.mjs`, `acme-gate.ts`,
`binmon-fixtures.ts`, `textmon-fixtures.ts`, `stock-schema-check.ts`,
`ghidra-run.ts`). `shipped-modules.ts` joins that list only by being deleted.

</domain>

<decisions>
## Implementation Decisions

### The cut rule — what happens inside a case

- **D-01:** **Whole-case deletion is the default.** If a case scans source text,
  the case goes — not just the scanning lines. — **Reversibility:** costly —
  undoing means recovering specific hunks across 17 files from git history and
  re-justifying each; once the exemption judgements are made, nothing records
  what was lost except D-11's verbatim name list, which is why D-11 exists.

- **D-02:** **The one exemption, and its test.** A case is exempt from whole-case
  deletion only when removing every source-text assertion still leaves **at least
  one assertion that exercises production behaviour**. A case whose remainder is
  setup-only, or whose remaining assertions all derive from scanned text, goes
  whole. This exemption test IS success criterion 4 ("none left with only setup
  and no assertions") applied at case level — which is why it needs no rewording
  of criterion 2 and no new test code.

- **D-03:** **Exempt cases are stripped in place, never retyped.** Remove the
  scanning assertions; keep every surviving assertion line **byte-for-byte**;
  rename the case to what it now proves. Retyping an assertion is how a case
  silently becomes weaker, and that is the exact failure criterion 2 exists to
  catch. Renaming is mandatory, not optional: `anno-store.test.ts:865`'s name
  promises both halves, so leaving the name would make the suite lie.

- **D-04:** **Rejected, and why.** "Delete the whole case, then re-add the
  behavioural half as a new standalone case" reaches the same end state as D-03
  by retyping assertions — strictly more work and strictly more risk. It was
  considered and dropped.

- **D-05:** **Success criterion 2 stands as written, and so does Phase 54's
  matching wording.** No roadmap edit is owed by this phase. D-02's exemption is
  what keeps the criterion satisfiable under an absolute D-1 ("no test may assert
  on text at all").

### `anno-seam.test.ts` — two survivors of twenty-three

- **D-06:** **Keep the file; delete 21 of its 23 cases.** Nothing moves between
  files, so both survivors stay byte-for-byte where they are and no transcription
  slip is possible. — **Reversibility:** reversible.

- **D-07:** The two survivors are:
  1. **Line 238**, `package.json files[] ships every anno-* production module on
     disk and no anno-prefixed test file or test-only helper`. **This case does
     not scan source text and does not touch the doomed module** — it reads
     `package.json` as JSON, `readdirSync(HERE)` as a directory listing, and a
     3-element local const `NEW_SHIPPED_MODULES`. It survives D-1 outright. (The
     roadmap note flagged it as valuable; it was never at risk.)
  2. **Line 743**, `WR-25: the guard itself exists -- openStore refuses
     BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied`. The
     only behavioural case in the file, and it says so in its own comment.
     `anno-confinement.test.ts` covers symlink and workspace-locality refusals,
     NOT this one.

- **D-08:** **Accepted cost:** the filename still says "seam", which referred to
  the sqlite source scan that will no longer exist. Not renamed — a `git mv`
  buys a better name at the price of stale citations elsewhere and history
  churn on a 770-line file.

- **D-09:** **`shipped-modules.test.ts` is deleted wholesale with its module.**
  449 lines / 16 tests, all of them testing the doomed module. It is in the
  automated set (not in `MANUAL_ONLY_TESTS`). Its deletion is reported
  SEPARATELY from the embedded-case removals, since criterion 2 asks for both
  numbers.

### Memorialising the invariants that lose their enforcement

- **D-10:** **No new prose is written anywhere.** No note, no seed, no successor
  document, no replacement guard, no lint rule, no weaker assertion. The two
  apparent precedents do NOT conflict: `git log` shows `capture-predicate.ts` was
  last touched in Phase 33, before `260914-uhm` — uhm added nothing, the
  reasoning was already in the header. And `260914-poo`'s rule was *keep the
  underlying constraint sentence, drop the false enforcement claim*, creating
  nothing new. Both say: add nothing.

- **D-11:** **Repair only the named set.** Drop the now-false "asserted by X"
  clauses from exactly these, listed BY NAME so the set is bounded and checkable:
  - `src/mcp/vice/anno-store.ts`
  - `src/mcp/vice/dxa-blocks.ts`
  - `src/mcp/vice/evid-ingest.ts`
  - `src/mcp/vice/memmap-lookup.ts`
  - `src/mcp/vice/capture-predicate.ts` around line 40 — it credits
    "`capture-predicate.test.ts` asserts it from this module's own source",
    a false enforcement claim naming neither `codeOnly` nor `shipped-modules`,
    so **grep does not find it**. It is in the set only because it was found by
    reading.

  The underlying constraint sentence STAYS in every case; only the enforcement
  clause goes. — **Reversibility:** reversible.

- **D-12:** **Accepted gap:** a stale enforcement claim that neither grep nor
  D-11's list catches may survive. That is the price of a bounded, checkable
  repair set, and it is preferred over an unbounded sweep whose "done" is a
  judgement rather than a set.

- **D-13:** **Left stale deliberately** (following `260914-poo`, which left
  twelve stale comments on the same reasoning — prose only, no runtime effect):
  - `src/mcp/vice/vice-proxy.test.ts:3488` and
    `src/mcp/vice/hostpath-consumers.test.ts:624` — the two files that name
    `shipped-modules` in a COMMENT with no import. Outside the named repair set
    because they are test files.
  - `.planning/codebase/*.md` — six maps cite the doomed scanners. Regenerated by
    `/gsd-map-codebase`; `TESTING.md` was already knowingly stale before this
    phase. Not touched here.
  - `CLAUDE.md` cites none of them — verified, nothing owed.

### Finding the cases, and proving the cut

- **D-14:** **A throwaway scratch script narrows the read; it is never the
  authority.** It lives in the session scratchpad — **never committed, never
  under `scripts/`**. Three binding constraints on it:
  1. It must NOT depend on `codeOnly()`, which is being deleted.
  2. It must distinguish comments from code. Three orchestrator greps during
     `260914-poo` returned wrong answers by reading a name inside a COMMENT as an
     import (`module-classification.ts`, `anno-cli-invocations.mjs`,
     `anno-cli-verbs.mjs`).
  3. Its output must be **proved against a planted case before it is trusted** —
     the project's own standing convention (`.planning/codebase/TESTING.md`
     § Planted-violation convention: a guard is proven by a planted violation
     observed RED, never by reading the guard).

  Every hit it reports is still hand-read before the case is removed. A
  committed helper under `scripts/` was considered and rejected — it collides
  with the no-replacement-guard rule and would itself become an artifact needing
  deletion.

- **D-15:** **The gate is a per-file test-name SET diff.** For each affected
  file, `node --test --test-reporter=tap <one file>` emits a flat
  `ok N - <name>` list; capture the set before and after and diff it. Verified
  working against `prg-image.test.ts` during this discussion. Per-file
  invocation also sidesteps two known traps: the whole-suite hang on
  `vice-proxy.test.ts`, and the live-broker BACK-05 failure (both live in
  `MANUAL_ONLY_TESTS`, so `test:automated` never sees them).

- **D-16:** **The SUMMARY carries every removed name, verbatim**, grouped by
  file, each with a one-line reason it qualified — roughly 57 embedded cases plus
  the 16 in `shipped-modules.test.ts`. Long on purpose: it is the only form in
  which a reader can check criterion 3's claim without re-running anything, and
  it makes "a silently broken file hid inside the expected decrease" impossible
  to state without being caught. Counts-only reconciliation was rejected by
  criterion 3's own wording.

- **D-17:** **Compare SETS, never counts; never pin a count in an assertion.**
  Carried forward from `260914-poo`. The suite baseline must be **re-measured as
  a set** at planning time: `260914-poo` measured `fail 0 / EXIT=0` on
  2026-09-14, superseding older notes that claim a non-zero expected-failure
  floor. `test-gate.mjs` carries no hardcoded baseline.

### Claude's Discretion

The cut-rule resolution (D-01 through D-05) was delegated with "You decide" after
the 18-mixed-case measurement was presented. The owner's first answer — whole-case
deletion — is preserved as the default; D-02's exemption is Claude's addition,
chosen because it satisfies both the owner's absolute rule and criterion 2 without
rewording the roadmap or writing new test code.

Also at Claude's discretion, and flagged to the owner without objection: D-13's
stale-comment list.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The phase's own scope and its sibling
- `.planning/ROADMAP.md` § "Phase 56: Remove `shipped-modules.ts` and Its
  Embedded Source Scans" — goal, five success criteria, and four notes. The
  notes carry the dated census and the "no AST exists" warning.
- `.planning/ROADMAP.md` § "Phase 54: Remove Every Byte-Identical Assertion" —
  carries a criterion 2 of identical shape ("Only tests whose entire purpose was
  asserting byte-identity are removed outright"). Still unplanned. D-05 keeps
  both wordings intact; a change to one would owe a change to the other.

### The locked decisions this phase inherits
- `.planning/quick/260914-poo-delete-all-text-asserting-tests-disarm-t/260914-poo-PLAN.md`
  § `<decisions_locked>` (D-1..D-6) and § `<must_not_touch>` — the absolute
  no-text rule, the data-driven-only rule, and the untouchable working tree.
- `.planning/quick/260914-poo-delete-all-text-asserting-tests-disarm-t/260914-poo-SUMMARY.md`
  — the operative precedents: sets-not-counts, `git rm` never truncate, stage by
  explicit path, stop-and-report rather than adjust a tripped assertion, stale
  comments left in place deliberately, and the CLAUDE.md
  keep-the-constraint-drop-the-enforcement-claim edit.
- `.planning/quick/260914-uhm-delete-capture-seam-test-ts-a-pure-sourc/260914-uhm-SUMMARY.md`
  — why `anno-seam.test.ts` was pulled out of that task and deferred to this
  phase, and the WR-25 reasoning verbatim.

### Testing machinery and its traps
- `src/mcp/vice/test-gate.mjs` — the single source of truth for the
  automated/manual split. `MANUAL_ONLY_TESTS` (twelve entries) and
  `automatedTestFiles()`. Do not add a second list of those names anywhere.
- `.planning/codebase/TESTING.md` — Traps 1-4 and the Planted-violation
  convention (§ "Planted-violation convention"). **KNOWINGLY STALE**: it says
  nine manual-only files (there are twelve) and names `fork-live.test.ts`, which
  no longer exists. Read it for the conventions, not for the counts.

### Project rules that bound the edits
- `CLAUDE.md` § Conventions / Comments — a comment states WHY the file exists as
  a reason a reader can act on. Relevant to D-11's repairs: the constraint
  sentence stays, the enforcement clause goes.
- `CLAUDE.md` § "Testing" constraint bullet — the single-resume-per-wait
  checkpoint invariant in `stock-run-until.ts`. Unrelated to this phase's cuts;
  listed so it is not disturbed.

</canonical_refs>

<code_context>
## Existing Code Insights

### Measured census — LIVE, 2026-09-14, and it corrects the roadmap's dated one

Re-measure before acting; these are a snapshot.

**Seventeen files import the module, not sixteen.** The roadmap census missed
`shipped-modules.test.ts` — 449 lines, 16 tests, the module's own test, in the
automated set.

| File | Lines | Cases | Scanning cases (approx) |
|---|---|---|---|
| `anno-export-asm.test.ts` | 6,274 | 196 | 3 |
| `anno-store.test.ts` | 5,595 | 118 | 14 |
| `anno-coverage.test.ts` | 5,016 | 115 | 3 |
| `stock-dispatch.test.ts` | 3,278 | 92 | 2 |
| `anno-overlap.test.ts` | 2,136 | 23 | 1 |
| `anno-types.test.ts` | 851 | 23 | 1 |
| `anno-seam.test.ts` | 770 | 23 | 10 |
| `anno-derive.test.ts` | 670 | 29 | 3 |
| `capture-predicate.test.ts` | 683 | 30 | 2 |
| `anno-join.test.ts` | 665 | 26 | 2 |
| `vsf-slice.test.ts` | 644 | 36 | 6 |
| `anno-index.test.ts` | 535 | 13 | 2 |
| `shipped-modules.test.ts` | 449 | 16 | (all 16 — deleted wholesale) |
| `block-class.test.ts` | 422 | 16 | 2 |
| `evid-report-keys.test.ts` | 406 | 9 | 1 |
| `anno-graphics.test.ts` | 286 | 12 | 2 |
| `prg-image.test.ts` | 120 | 8 | 3 |

**~57 embedded scanning cases** across the sixteen, plus all 16 in
`shipped-modules.test.ts`. Of the 57, a heuristic scan flagged **18 as mixed**
(they also call a production symbol) — that is an **upper bound**: several of
`anno-store.test.ts`'s self-labelled `STRUCTURAL` cases call `pruneSnapshots` /
`reconcileSnapshotRing` only as scaffolding for the text claim and fail D-02's
exemption test. The true exemption set is nearer **8-10**.

**A third large file the roadmap did not flag:** `anno-coverage.test.ts` at
5,016 lines / 115 tests, alongside `anno-store` and `anno-export-asm`.

**Two comment-only mentions, no import:** `vice-proxy.test.ts:3488`,
`hostpath-consumers.test.ts:624`.

### Reusable Assets
- **Per-file TAP name extraction** — `node --test --test-reporter=tap <file>`
  emits a flat `ok N - <name>` list. Verified during discussion against
  `prg-image.test.ts`. This is D-15's gate mechanism; nothing needs writing.
- **`anno-confinement.test.ts`** (915 lines / 21 cases, imports nothing from
  `shipped-modules`) — the natural home for WR-25 had D-06 gone the other way.
  Deliberately NOT used; recorded so a later reader knows it was considered.

### Established Patterns
- **Planted-violation convention** — a structural guard is proven by a planted
  violation observed RED, never by reading the guard. Binds D-14's scratch script.
- **`shipped-modules.ts`'s exported surface**, all of it dying:
  `shippedTsModules()`, `codeOnly()`, `extractCommentSpans()`,
  `commentByteTotal()`, `shippedScanSurface()`, `TEXT_EXTENSIONS`,
  `CommentSpan`, `ShippedFilesEntryMissingError`.
- **Calls are not all inside cases.** `evid-report-keys.test.ts:337` holds a
  module-scope helper calling `shippedTsModules()`. A helper used only by deleted
  cases goes with them; a shared one needs its own judgement.

### Integration Points
- Every one of the 17 files must lose its `import ... from "./shipped-modules.ts"`
  before the module is deleted, or `typecheck` breaks. `npm run typecheck` must
  exit 0 at every commit checkpoint, not only at the end.
- `src/mcp/vice/package.json` `files[]` — `shipped-modules.ts` does not ship, so
  its deletion owes no manifest edit. `anno-seam.test.ts:238`'s surviving
  `files[]`-completeness case reads that array and must still pass.

### Hard boundaries carried forward from `260914-poo` § `<must_not_touch>`
Never `git add`, `git commit`, `git checkout` or `git restore` any of:
`.claude/settings.json`, `src/mcp/vice/anno-bank.ts`, `anno-coverage.ts`,
`anno-enum-gen.ts`, `anno-tools.ts`, `docs/dissambler-workflow.md`,
`docs/vice-mcp-ideas.md`, `setup-claude-ste100.sh`. Leave the ASD-STE100 skill
byte-identical and unreferenced. Stage files EXPLICITLY BY PATH in every commit —
never `git add -A`, never `git add .`, never `git commit -a`. All deletions use
`git rm`; no file is truncated or emptied.

Note the collision hazard: `anno-coverage.ts` is untouchable, but
`anno-coverage.test.ts` is in scope. They are different files.

</code_context>

<specifics>
## Specific Ideas

- **The worked example of a mixed case**, used to settle D-01..D-03:
  `anno-store.test.ts:865` — `test("the reserved bank field is never
  INTERPRETED: every list function returns bank null, and no line of the seam's
  own code branches on or computes with a bank value")`. Lines 866-894 open a
  real store, write rows and assert every row has `bank` null (genuine
  behavioural coverage, exempt under D-02). Lines 896-950 run `codeOnly()` over
  `anno-store.ts` and assert on the stripped text (removed). The case name
  promises both halves, which is why D-03 makes renaming mandatory.

- **Behavioural proofs known to sit inside mixed cases** — each needs D-02
  applied by hand, not assumed: `anno-store.test.ts:3848` (CR-08, a snapshot
  truncated to zero bytes is refused by name and the live store stays intact),
  `anno-store.test.ts:5321` (D-15 schema_version refusal),
  `anno-index.test.ts:439` (a single-row index resolves inside its span and
  `NO_ROW` one step either side), `prg-image.test.ts:86` (`decodeRawData`
  round-trips an all-zero page and every value 0..255),
  `capture-predicate.test.ts:185` (`argvDigest` is order-sensitive and refuses an
  empty array by name), `anno-join.test.ts:284`, `anno-graphics.test.ts:210`,
  `anno-derive.test.ts:407`, `stock-dispatch.test.ts:3182` (CHAN-04),
  `vsf-slice.test.ts:187`.

</specifics>

<deferred>
## Deferred Ideas

None raised — the discussion stayed inside the phase boundary.

### Reviewed Todos (not folded)

Three pending todos matched Phase 56 on keyword overlap only. All reviewed, none
folded — none concerns source-scanning tests or `shipped-modules.ts`:

- **Correct the false real-corpus claim in `research/questions.md`** (score 0.90,
  area `planning`) — a planning-document correction, unrelated to the test suite.
- **Reap vicerc scratch dirs in broker kill/recycle path** (score 0.60, area
  `broker`) — broker lifecycle work.
- **BACK-05 D-G ordering test fails deterministically on a live-broker host**
  (score 0.60, area `testing`) — matched on "testing", but the test in question
  lives in `vice-proxy.test.ts`, a `MANUAL_ONLY_TESTS` member that
  `test:automated` never runs. **Recorded here because it is an execution hazard
  rather than scope:** it must not be mistaken for collateral damage if a full-glob
  run is attempted. D-15's per-file invocation avoids it entirely.

</deferred>

---

*Phase: 56-Remove `shipped-modules.ts` and Its Embedded Source Scans*
*Context gathered: 2026-09-14*
