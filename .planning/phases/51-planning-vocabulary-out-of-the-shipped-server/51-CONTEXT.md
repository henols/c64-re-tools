# Phase 51: Planning Vocabulary Out of the Shipped Server - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Every planning citation in the file set this project publishes to npm is replaced
by the reason it stands for, and `skills-planning-vocabulary.test.ts` is widened
from the skills tree to that shipped set so the surface cannot drift back.

In scope: the file set `src/mcp/vice/package.json`'s `files[]` publishes, the
eight `.mts` sources `build.ts` compiles into `resources/*.mjs`, and
`installer/package.json`'s `files[]`. Out of scope: test files, `docs/`,
`.planning/` itself, and anything not published to npm.

</domain>

<decisions>
## Implementation Decisions

### Scan surface

- **D-01:** The widened guard scans `src/mcp/vice/package.json`'s `files[]`
  **plus the eight `.mts` sources behind `resources/*.mjs`** (`host-tool`,
  `broker-launch`, `vice-broker`, `ghidra-project`, `broker-control`,
  `broker-epoch`, `broker-kill`, `broker-state`). Rationale: the `.mts` sources
  carry 903 citations and the `.mjs` they compile into carry 651 — `build.ts`
  drops ~28% — so zeroing a generated file means editing its source anyway.
  Scanning both makes a guard failure name the file a maintainer opens
  (`host-tool.mts:412`) rather than its compiled image
  (`resources/host-tool.mjs:388`), and removes the split-brain state where a
  module is clean compiled and dirty in source.
  — **Reversibility:** reversible — one function's file list.

- **D-02:** The `.mts` set is derived mechanically from `build.ts`'s exported
  `HOST_BOUND_ARTIFACTS`, never hand-listed. That constant is already asserted
  against the emitted file set in both directions (`build.ts:193-199`), so a
  new host-bound artifact cannot appear outside the guard's view. This follows
  the precedent `spawn-seam.test.ts` set: derive the shipped set from
  `package.json` via `shipped-modules.ts` rather than from a directory listing.

- **D-03:** `installer/package.json`'s `files[]` is folded in — 4 occurrences,
  all in `installer/bin/cli.mjs`. That is the only shipped-to-npm surface
  outside `src/mcp/vice/**` and `src/skills/**` that nothing guards, and
  leaving the second published tarball leaking would undercut the phase's own
  goal for the cost of four rewrites. The widened guard therefore covers three
  surfaces: `src/skills/**` (already at zero, must stay covered — success
  criterion 5), `src/mcp/vice` `files[]` + the eight `.mts`, and `installer`
  `files[]`.

### How the guard arrives green

- **D-04:** **Count-pinned ratchet, guard widened FIRST.** Every currently-dirty
  file is listed with its exact current occurrence count; each sweep plan
  deletes entries; the ledger may only shrink, asserted. The guard is green
  from its first commit and live throughout, so it cannot be "switched off
  rather than obeyed" — the failure mode the roadmap names for a guard that is
  red on arrival. The count pin answers §21.1's standing objection to by-path
  exemption directly: a file pinned at 235 reds at 236, so it cannot absorb new
  citations as collateral, which is exactly how the withdrawn `c1541.test.mjs`
  path exemption failed.
  — **Reversibility:** costly — the ledger is scaffolding every sweep plan
  writes against; changing its shape mid-phase invalidates the pinned counts in
  every plan not yet executed.

- **D-05:** The ledger must reach **empty**, and its last entry is deleted by
  the phase's final plan. A non-empty ledger at phase end fails success
  criterion 1, which requires zero. The ratchet is temporary machinery, not a
  permanent exemption list.

- **D-06:** Sweep plans partition **by module family**, not by file and not by
  citation category. Six families with their measured populations: annotation
  store / CLI 935 across 22 files, protocol / transport 807 across 32, broker
  585 across 7, host tools 397 across 3, other 315 across 26, proxy / tool
  surface 141 across 2. Rationale: the phase's real risk is that someone has to
  know what each citation MEANT, and meaning is domain-local — an executor
  holding the broker's context can recover a broker citation's reason, while
  the same executor meeting one annotation-store citation inside a
  cross-cutting batch usually cannot. Partitioning by category would also churn
  ratchet counts across nearly every file in every plan, making diffs
  unreviewable.

### Recovering what a citation meant

- **D-07:** Recovery is **tiered by id class**, so lookup effort is spent where
  ambiguity actually is:
  1. Where the surrounding prose already states the reason, drop the
     parenthetical tag and stop. 42.7% of sites (1637) are bare parentheticals
     beside existing prose — `(CR-01)` attached to a clause that already says
     what CR-01 was about. Deleting the tag loses nothing and satisfies
     success criterion 2 without a rewrite.
  2. For globally-unique ids (`D-NN`, real requirement ids like `SEAM-02` — 570
     sites), grep `.planning/` and write the reason.
  3. For the 518 phase-scoped code-review ids (`CR-NN`, `WR-NN`), use
     `git blame` on the line. These are NOT globally unique: `CR-01` resolves
     in 27 distinct phase `REVIEW.md` files and `WR-02` in 34, so grepping
     returns candidates rather than an answer.

- **D-08:** At the bottom of the ladder — where blame recovers nothing — the
  comment is rewritten to a weaker but true statement and the site is named in
  the plan's summary. The comment is never deleted outright. Measured upper
  bound on this class: 246 sites (6.4%) have little or no prose on the line,
  and that is a line-level heuristic, so the true figure is lower — the comment
  block above a sparse line often carries the reason.

### Verifying success criterion 2

- **D-09:** Criterion 2 gets a **budgeted comment-volume floor, asserted per
  file**: comment bytes lost in a file must be ≤ the summed character length of
  the citation tokens removed from it, plus slack. This is exactly computable,
  because the scan already knows every match it removed. Deleting a bare
  `(D-16)` passes at −7 bytes; gutting a 400-byte WHY header down to a one-liner
  reds immediately. Rationale: criterion 2 is otherwise the only success
  criterion with no mechanical backing, on a phase whose entire premise is that
  prose conventions decay without guards. A phase-wide net floor was rejected
  because it lets one gutted file hide behind another file's growth, which is
  the precise failure criterion 2 names.
  — **Reversibility:** reversible — an assertion in one test file.

### Technical-token collisions

- **D-10:** The two `UTF-16` sites (`src/mcp/vice/anno-types.ts:106`,
  `src/mcp/vice/stock-protocol.ts:764`) are rewritten to "16-bit code units",
  which is accurate and standard phrasing for what `String.length` counts. **No
  exemption mechanism is added.** Measured: of the 37 id prefixes appearing in
  the shipped tree, `UTF` is the only one that is not a declared project id
  prefix, so an exemption would carry a single entry — and §21.1 already records
  what a one-entry escape hatch costs, having withdrawn the `c1541.test.mjs`
  path exemption after it whitelisted five unrelated citations as collateral.

### Claude's Discretion

- The exact file and shape of the ratchet ledger (a frozen record in the guard
  file, or a sibling data file) is unconstrained, provided the shrink-only
  assertion and the reach-empty assertion both hold.
- The slack term in D-09's byte budget is unconstrained; pick it from the first
  family's real diffs rather than guessing before any rewriting has happened.
- Ordering of the six families across plans is unconstrained.

### Reviewed Todos (not folded)

All 12 pending todos matched phase 51 on generic keyword overlap only (`src`,
`mcp`, `vice`, `phase`, `planning`). None concerns planning vocabulary in
shipped source. Listed under Deferred Ideas.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The rule being enforced
- `.planning/ENGINEERING_RULES.md` §21 — the whole rule. §21.1 the hard shipped-
  surface rule and the one content-derived exemption; §21.2 the product-source
  rule with its worked bad/good pair and the 2026-09-11 tightening that removed
  the document-qualified escape for decision AND requirement ids; §21.3 the ban
  on `.planning/` paths in product source; §21.4 why a convention document
  cannot be trusted to carry this rule.

### The guard being widened
- `src/mcp/vice/skills-planning-vocabulary.test.ts` — the eight categories,
  `scanForPlanningVocabulary()`, `ownWorkflowSteps()`, `shippedSkillFiles()`
  (the function D-01 replaces), the `OPERATOR_SUPPLIED_RESOURCE_READERS` record,
  and the two planted controls that keep the predicate non-vacuous.
- `src/mcp/vice/shipped-modules.ts` — `shippedTsModules()` and `codeOnly()`; the
  existing precedent for deriving a scan set from `package.json` `files[]`.
- `src/mcp/vice/build.ts` — `HOST_BOUND_ARTIFACTS` (line 42) and the
  both-directions emitted-set assertion (lines 193-199) that D-02 depends on.
- `src/mcp/vice/test-gate.mjs` — `MANUAL_ONLY_TESTS` (line 141). The guard is
  NOT listed there, so it already runs under `npm run test:automated`.

### Guards that must move in lockstep (success criterion 3)
- `src/mcp/vice/comment-phase-pointers.test.ts` (607 lines) — needs its
  REASONING rewritten, not its literals patched. It argues that "a blanket 'no
  comment mentions Phase N' rule is not viable here" and legalises historical
  narration; §21 overrides that position.
- `src/mcp/vice/docs-dangling-refs.test.ts` (458 lines) — its FLOW-02 check is
  deliberately and permanently scoped to string and template literals. Widening
  it is NOT the route; the new guard covers whole files and the two must not be
  merged.
- `src/mcp/vice/hop-chain-comments.test.ts` (454 lines)
- `src/mcp/vice/docs-absorbed-decisions.test.ts` (231 lines)
- `src/mcp/vice/audit-integrity.test.ts` (1146 lines)
- `src/mcp/vice/resources-sync.test.ts` — asserts `resources/` is byte-identical
  to a fresh build, so a hand-edited `.mjs` is already caught. This is why D-01
  is about guard ergonomics and coverage, not about closing a drift hole.

### Scope inputs
- `src/mcp/vice/package.json` `files[]` — 89 entries, 99 scannable text files.
- `installer/package.json` `files[]` — `bin/`, `skills/`, `README.md`,
  `THIRD-PARTY-NOTICES.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Measured scope — re-measured 2026-09-14, NOT the roadmap's figures

The roadmap's notes instruct a re-measure at planning time because both figures
recorded there are dated. Run with the guard's own `scanForPlanningVocabulary()`
over the live `files[]` set:

| | roadmap, 2026-09-11 | measured 2026-09-14 |
|---|---|---|
| occurrences in `src/mcp/vice` `files[]` | 2384 | **2963** |
| files with at least one hit | 88 of 92 | **95 of 99** |

Grew ~580 in three days. Category split now: requirement id 1088, decision or
gap id 914, plan citation 451, phase citation 289, planning artifact filename
156, `.planning` path 38, planning document cross-reference 22, gsd command 5.

**The number to plan against is 3188 distinct hand-edit sites**, not 2963:

- 2312 — `files[]` entries that are not generated
- 872 — the eight `.mts` sources not themselves in `files[]`
- 4 — `installer/bin/cli.mjs`

The 651 occurrences inside `resources/*.mjs` are compiler output, not work; they
disappear when their `.mts` source is fixed and `build.ts` reruns.

### Site shape — what the work actually is

Classified by whether the physical line carries prose besides the citation:

- **42.7% (1637)** — parenthetical tag beside prose that already states the
  reason. The fix is deleting the tag.
- **50.9% (1952)** — inline, prose still on the line. Small rewrite.
- **6.4% (246)** — little or no prose on the line. Upper bound on the
  genuinely-hard class, since the comment block above often carries the reason.

This is materially cheaper than "2963 sites each need someone to reconstruct
meaning", which is how the roadmap's notes read.

### Where the generated files sit

`resources/` ships as a whole directory entry in `files[]`. Four of the top six
offenders are its compiled artifacts: `resources/host-tool.mjs` (235),
`resources/broker-launch.mjs` (135), `resources/vice-broker.mjs` (126),
`resources/ghidra-project.mjs` (59). Per-pair source/output counts, showing the
~28% comment drop `build.ts` applies:

| source | `.mts` | generated `.mjs` |
|---|---|---|
| `host-tool` | 322 | 235 |
| `broker-launch` | 183 | 135 |
| `vice-broker` | 147 | 126 |
| `broker-control` | 80 | 38 |
| `ghidra-project` | 64 | 59 |
| `broker-state` | 43 | 8 |
| `broker-kill` | 31 | 30 |
| `backend-detect` | 28 | 16 |
| `container-guard` | 3 | 3 |
| `broker-epoch` | 2 | 1 |
| **total** | **903** | **651** |

`container-guard.mts` and `backend-detect.mts` are themselves in `files[]`; the
other eight are not, and are what D-01 adds.

### Dangling citations — a named sub-population

33 distinct cited tokens (~135 occurrences) resolve NOWHERE in `.planning/` in
this checkout. Largest: `Plan 41-05` (35 occurrences), `plan 40-03` (20),
`01.6.2.1-REVIEW.md` (6), `Phase 01.6.2.1` (5), `PD-03` (5, first at
`container-guard.mts:3`, a prefix declared in no requirements or review
document). These are why D-07's `git blame` tier is load-bearing rather than
theoretical — grep cannot recover them, and success criterion 4 requires they be
gone rather than repointed at another `.planning/` path.

### Corrections to the roadmap's notes

1. **Five comment-pinning guards, not six.** `docs-linerefs.test.ts` does not
   exist anywhere in the tree (`find` returns nothing). The other five are
   present, 2896 lines between them, plus `audit-integrity.test.ts` at 1146
   rather than the recorded 1111.
2. **The guard already runs in `test:automated`.** It is absent from
   `MANUAL_ONLY_TESTS` in `test-gate.mjs`, so the second half of success
   criterion 1 holds today and keeps holding when the scan widens.
3. **A hand-edited generated file is already caught.**
   `resources-sync.test.ts` asserts byte-identical-to-a-fresh-build, so the
   "edit the `.mjs` and pass the guard" hole does not exist.
4. **518 of the 1088 requirement-id hits are code-review finding ids**
   (`CR-NN`, `WR-NN`), which are phase-scoped rather than global. The remaining
   570 are real requirement ids.
5. **The re-measured population is 2963, not 2384** — see the table above.

### Integration points

- `shippedSkillFiles()` in the guard is the single function D-01 replaces; the
  file already carries the category machinery, the content-derived exemption,
  and the planted controls unchanged.
- `HOST_BOUND_ARTIFACTS` in `build.ts` is the authoritative `.mts` list D-02
  reads.
- The skills tree reached zero on 2026-09-11 and must stay there throughout;
  the widened guard has to keep covering `src/skills/**` rather than replacing
  that coverage.

</code_context>

<specifics>
## Specific Ideas

- §21.2's worked pair is the standard for every rewrite:
  `// Phase 40, plan 40-02 (PREP-01, D-13): reached ONLY through the host-tool seam`
  becomes
  `// Reached ONLY through the host-tool seam: this script runs container-side and the binary lives on the host, so a direct spawn finds nothing.`
- Success criterion 5 requires a planted citation in a shipped module to red the
  widened guard. The existing planted controls prove the predicate on synthetic
  content; the new one must prove it on the new surface, so it belongs in a real
  shipped module's scan path rather than in a synthetic string.

</specifics>

<deferred>
## Deferred Ideas

- Nothing was raised during discussion that falls outside the phase boundary.

### Reviewed Todos (not folded)

All 12 matched on generic keyword overlap only; none concerns planning
vocabulary in shipped source:

- Reap vicerc scratch dirs in broker kill/recycle path — broker lifecycle
- Correct the false real-corpus claim in research/questions.md — a `.planning/`
  document, not shipped source
- Remove pre-warm; launch VICE only on first request — broker behaviour
- Remove anno from the MCP surface; reach it via a stateless broker call — tool
  surface architecture
- BACK-05 D-G ordering test fails deterministically on a live-broker host — test
  host-independence
- `vice-proxy.test.ts` leaks scratch dirs into the `.planning/` root — a write
  path, not a citation
- incident records always write `epoch_after: null` — incident record content
- `wrapPossiblyChunked()` is orphaned — dead code in the result-cap path
- `capability-registry.ts` claims `vice_diagnose`/`vice_recycle` are in neither
  manifest — a factual error in a registry
- Three untitled entries

</deferred>

---

*Phase: 51-planning-vocabulary-out-of-the-shipped-server*
*Context gathered: 2026-09-14*
