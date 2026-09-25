---
phase: 56
phase_name: "remove-shipped-modules-ts-and-its-embedded-source-scans"
project: "c64-re-tools"
generated: "2026-09-15"
counts:
  decisions: 12
  lessons: 12
  patterns: 11
  surprises: 9
missing_artifacts:
  - "UAT.md"
---

# Phase 56 Learnings: Remove `shipped-modules.ts` and Its Embedded Source Scans

## Decisions

### Whole-case deletion is the default, with exactly one exemption

If a test case scans source text, the whole case goes -- not just the scanning lines (D-01). A
case is exempt only when removing every source-text assertion still leaves at least one
assertion that exercises production behaviour (D-02). A remainder that is setup-only, or whose
assertions all derive from scanned text, goes whole.

**Rationale:** The owner's stated rule was whole-case deletion. Claude then measured the
consequence rather than proceeding: 18 of 57 scanning cases also call production code, of which
roughly 8-10 carry genuinely unique behavioural proofs (CR-08's truncated-snapshot refusal,
`decodeRawData`'s round-trip, `argvDigest`'s ordering, `NO_ROW` resolution). Deleting those
collides directly with success criterion 2. The exemption test IS success criterion 4 applied at
case level, so it satisfies the owner's absolute rule and the criterion without rewording the
roadmap and without writing new test code.
**Source:** 56-CONTEXT.md (D-01, D-02), 56-DISCUSSION-LOG.md (Question 2, "You decide")

---

### Exempt cases are stripped in place, never retyped, and renaming is mandatory

Remove the scanning assertions; keep every surviving assertion line byte-for-byte; rename the
case to what it now proves (D-03). The alternative -- delete the whole case, then re-add the
behavioural half as a new standalone case -- was explicitly considered and prohibited (D-04).

**Rationale:** Re-homing reaches the same end state by retyping assertions: strictly more work
and strictly more risk. Retyping is how a case silently becomes weaker, which is the exact
failure success criterion 2 exists to catch. Renaming is mandatory rather than optional because
a name like `anno-store.test.ts:865`'s promises both halves; leaving it would make the suite lie.
**Source:** 56-CONTEXT.md (D-03, D-04), 56-01-PLAN.md `<cut_rule>`

---

### The IN SCOPE test is the case's SUBJECT, never its call route or its target file

A case qualifies when its subject is the source TEXT of a module, regardless of whether it
reaches that text through a doomed helper, a raw `readFileSync`, a module-scope `*_SOURCE`
constant, a local const, or a synthetic planted string -- and regardless of whether the scanned
file is a production module or the test file itself.

**Rationale:** Stated once in the plan's `cut_rule` and then applied uniformly to resolve four
separate borderline calls: `capture-predicate.test.ts`'s local-`signaturesOf` route (56-04),
`anno-index.test.ts`'s self-scanning oracle-disjointness case (56-05),
`evid-report-keys.test.ts`'s synthetic three-member-union planted control (56-04), and
`anno-join.test.ts`'s hardcoded-empty-array non-vacuity case, which the same test excluded
(56-03). One rule, four consistent verdicts, no per-case negotiation.
**Source:** 56-01-PLAN.md `<cut_rule>`, 56-03-SUMMARY.md, 56-04-SUMMARY.md, 56-05-SUMMARY.md

---

### A non-source artifact read with `readFileSync` is NOT in scope

`package.json` parsed as JSON, a JSON data file, a fixture, or a directory listing is explicitly
excluded even though the call is the same `readFileSync`.

**Rationale:** This distinction is what lets `anno-seam.test.ts:238`'s `files[]`-completeness
case survive under D-07, and the same test then cleared five more `files[]` cases across
`block-class.test.ts`, `anno-export-asm.test.ts`, `evid-report-keys.test.ts` and
`capture-predicate.test.ts` without further argument.
**Source:** 56-01-PLAN.md `<cut_rule>`, 56-11-SUMMARY.md § Four

---

### Keep `anno-seam.test.ts` as a file; delete 21 of its 23 cases; do not rename it

Nothing moves between files, so both survivors stay byte-for-byte where they are. The filename
still says "seam", which referred to the sqlite source scan that no longer exists (D-08).

**Rationale:** Moving the two survivors to `anno-confinement.test.ts` (verified as a viable home,
915 lines / 21 cases, no doomed import) would reach a cleaner end state by transcribing code
between files -- the same retyping risk D-04 prohibits. A `git mv` buys a better name at the
price of stale citations elsewhere and history churn on a 770-line file.
**Source:** 56-CONTEXT.md (D-06, D-07, D-08), 56-DISCUSSION-LOG.md

---

### Write no new prose anywhere; repair only a bounded, named set

No note, no seed, no successor document, no replacement guard, no lint rule, no weaker assertion
(D-10). Drop the now-false "asserted by X" clauses from exactly five production modules listed BY
NAME, keeping the underlying constraint sentence in every case (D-11).

**Rationale:** The two apparent precedents were checked and both said "add nothing" --
`capture-predicate.ts` was last touched in Phase 33, before `260914-uhm`, so uhm added no prose;
and `260914-poo`'s rule was keep-the-constraint, drop-the-false-enforcement-claim, creating
nothing new. A bounded named set is checkable; an unbounded sweep's "done" is a judgement rather
than a set. The accepted price is D-12: a stale enforcement claim that neither grep nor the named
list catches may survive.
**Source:** 56-CONTEXT.md (D-10, D-11, D-12), 56-DISCUSSION-LOG.md § Memorialising invariants

---

### A throwaway scratch scanner narrows the read; it never authorises a cut

The D-14 scanner lives in the session scratchpad, is never committed, never placed under
`scripts/`, must not depend on the `codeOnly()` being deleted, must distinguish comments from
code, and must be proved against a planted case before its output is trusted. Every hit is still
hand-read before the case is removed.

**Rationale:** A committed helper under `scripts/` collides with the no-replacement-guard rule
and would itself become an artifact needing deletion. Hand-reading all 17 files (~769 cases
across 33,000+ lines) is immune to comment-versus-code confusion but makes fatigue its own silent
error source. Three orchestrator greps during `260914-poo` had already returned wrong answers by
reading a name inside a COMMENT as an import.
**Source:** 56-CONTEXT.md (D-14), 56-01-PLAN.md `<scanner_protocol>`, 56-DISCUSSION-LOG.md

---

### The gate is a per-file test-name SET diff, never a count

For each affected file, `node --test --test-reporter=tap <one file>` emits a flat `ok N - <name>`
list; capture the set before and after and diff it (D-15). Compare SETS, never counts; never pin a
count in an assertion (D-17).

**Rationale:** Counts-only reconciliation was rejected by success criterion 3's own wording -- a
file that silently stopped running produces exactly the expected decrease. Per-file invocation
also sidesteps two known traps that whole-suite runs hit: the `vice-proxy.test.ts` hang and the
live-broker BACK-05 failure, both `MANUAL_ONLY_TESTS` members `test:automated` never sees.
**Source:** 56-CONTEXT.md (D-15, D-17), 56-DISCUSSION-LOG.md § Proving no collateral loss

---

### The SUMMARY carries every removed case name, verbatim, with a one-line reason each

Roughly 116 names, grouped by file. Long on purpose.

**Rationale:** It is the only form in which a reader can check success criterion 3's claim without
re-running anything, and it makes "a silently broken file hid inside the expected decrease"
impossible to state without being caught.
**Source:** 56-CONTEXT.md (D-16), 56-11-SUMMARY.md § One

---

### Report the embedded count and the whole-file count as two separate numbers, always

100 embedded cases (plans 56-01..56-10) and 16 cases removed with the module's own test file (plan
56-11) are never added into one figure a reader could mistake for a single measurement. Where a
combined total is useful, it appears only as `100 + 16 = 116`, never as a bare `116`.

**Rationale:** Success criterion 2's own wording asks for both numbers.
**Source:** 56-11-SUMMARY.md § "The two numbers this phase asked for", § Five

---

### Reconcile against git-diff ground truth, not against the sum of ten plans' prose

`git diff 188ca931 HEAD -- <file>` filtered to `^[-+]\s*test\(`, per file, against a single
pre-phase baseline commit.

**Rationale:** A purely prose-based tally double-counts a rename as a whole removal. The git-diff
method found 104 removed-name lines and 4 gained-name lines; the 4 gained pair exactly with 4 of
the 104 as the phase's D-03 renames, giving 100 net -- agreeing with the per-plan sum exactly.
The verifier later reproduced the same arithmetic independently and got the same numbers.
**Source:** 56-11-SUMMARY.md § Six, 56-VERIFICATION.md § Independent Reconciliation

---

### Certain stale prose is left stale deliberately

`vice-proxy.test.ts:3488` and `hostpath-consumers.test.ts:624` (comment-only mentions, no import)
and the six `.planning/codebase/*.md` maps stay as they are (D-13). Test-file header paragraphs
explaining a now-removed structural check stay byte-identical -- the D-11 repair set holds five
PRODUCTION modules and no test file.

**Rationale:** Follows `260914-poo`, which left twelve stale comments on the same reasoning: prose
only, no runtime effect. The codebase maps are regenerated by `/gsd-map-codebase`, not by this
phase. Flagged to the owner for veto; no objection raised.
**Source:** 56-CONTEXT.md (D-13), 56-01-PLAN.md `<cut_rule>`, 56-DISCUSSION-LOG.md § Claude's Discretion

---

## Lessons

### A symbol-anchored scanner is blind by construction, and the blind-spot pass is what finds the rest

The D-14 scanner can only see a case that references a doomed symbol. A case that reads source
through a raw `readFileSync` with no doomed symbol in its chain is invisible to it. This was
measured in 56-01 (`anno-graphics.test.ts`'s "the module header states..." case) and then recurred
at increasing scale: 56-08 found one case this way, and 56-09 found an **eleven-case cluster**
with its own `coverageSource()`/`functionBodyFromSource()` helper sub-infrastructure that neither
the scanner nor the planner's candidate list had seen.

**Context:** The plan anticipated the blind spot and mandated a three-pass protocol per file, but
nobody predicted that the mandated pass would out-find the scanner on the largest file. Executors
that took the pass seriously across the whole file, rather than only near the named candidates,
are the ones that found the clusters.
**Source:** 56-01-SUMMARY.md, 56-08-SUMMARY.md (Deviation 2), 56-09-SUMMARY.md (Deviation 2)

---

### A plan's line-numbered candidate list is systematically an undercount; the blanket grep gate is the authority

Three separate instances: 56-06's Task 2 named 11 `structure/proxy` cases where the file held 14;
56-10's Task 2 named 4 `anno-seam.test.ts` credit clauses in `anno-store.ts` where a whole-file
grep found 8; 56-10's Task 3 named 1 clause in `capture-predicate.ts` where there were 2. In every
case the discrepancy surfaced only because the task's OWN acceptance criterion was an
unconditional whole-file grep ("no case name beginning `structure/proxy` remains", "`grep -ac
'anno-seam.test.ts'` returns 0"), not a check scoped to the named list.

**Context:** Completing a task *as verified* rather than *as literally described* is what made the
cut complete. 56-10 explicitly cites 56-06 as the precedent that told it to re-grep before
trusting its own list -- the lesson propagated forward within the phase.
**Source:** 56-06-SUMMARY.md (Deviation 1), 56-10-SUMMARY.md (Deviations 1, 2)

---

### The same source-masking logic is correct for symbol detection and wrong for paren-matching

`scope-scan.mjs` deliberately keeps regex-literal BODIES as real code, which is right when the
goal is finding symbol references. A case-removal tool that reuses that masking to find a
`test(...)` call's true end is broken by it: the escaped `\)` inside
`assert.match(kept, /changes\) !== 1|changes !== 1/, ...)` counts as a real closing paren and
truncates the case mid-body.

**Context:** Caught on a dry-run copy, before touching the real file. The fix was to BLANK regex
bodies for the paren-matching tool, consistent with how strings and comments were already masked.
**Source:** 56-02-SUMMARY.md (Deviation 2)

---

### Helper removal must be sequenced by caller, not by the plan's candidate list

`seamSource()` and `THE_ONE_SEAM` were on 56-02 Task 1's own "measured candidates" list, but the
two WR-25 pin cases -- which Task 1 does not touch -- still called them. Removing them in Task 1
would have thrown a `ReferenceError` inside a still-present case and broken the whole
`node --test` run. Both were removed in Task 2 once grep-confirmed dead.

**Context:** The cut_rule's Helper rule ("grep the whole file for other callers first") is what
caught this. The executor followed the rule over the list.
**Source:** 56-02-SUMMARY.md (Decisions Made, Deviation 1)

---

### An automated verify that does not encode the plan's own caveat produces a false red

56-02 Task 1's `dead_helpers` grep returned 7 rather than the required 0 -- and all 7 were
legitimately-alive code lines inside cases Task 1's own `<done>` criterion says survive to Task 2.
The action text's Helper-rule caveat was correct; the grep pattern simply did not encode it.

**Context:** The executor accepted the 7, documented it, and let the far more load-bearing
verifications (TAP name-set diff lost=19/gained=0, typecheck EXIT=0) carry the task -- rather than
editing the verify script or removing the helpers early to make a number turn green.
**Source:** 56-02-SUMMARY.md (Deviation 1)

---

### `typecheck` does not catch dead imports in this project

`noUnusedLocals` is not enabled in `tsconfig.json`, so an orphaned named import survives a green
typecheck. 56-09 found two (`LABEL_KINDS`, `PROVEN_TARGET_SOURCES`) only by a deliberate
whole-file occurrence-count sweep over every symbol in both import blocks. The code review later
found a third the same way (`readFileSync` in `anno-overlap.test.ts`, WR-09).

**Context:** This makes a per-symbol occurrence count (== 1 means only the import line itself) a
required step after any case removal, not an optional tidy-up.
**Source:** 56-09-SUMMARY.md (Deviation 3), 56-REVIEW.md (WR-09)

---

### Line-proximity attribution overturns on roughly 8 of 10 cases

RESEARCH measured it; the phase confirmed it seven times. Every candidate must be resolved to its
own paren-matched `test(` boundary before being judged. In `stock-dispatch.test.ts` the scanner
reported a "direct" hit at a case's own boundary that hand-reading found to be an upstream
paren-matching artifact -- the file's regex-dense assertions corrupted the scanner's own
depth-counting and attributed a distant real hit to the wrong call.

**Context:** The scanner narrows the read. It never authorises a cut. This is why.
**Source:** 56-01-PLAN.md `<scanner_protocol>`, 56-11-SUMMARY.md § Four (items 2, 7)

---

### A case can look mixed and simply not be -- `.source` is not source

Three false positives in `anno-export-asm.test.ts` alone turned on this: `AUTO_NAME_PREFIX_RE.source`
is an imported RegExp object's own pattern property (a runtime value), and `result.source` is
`exportAsm()`'s own PRODUCED assembly listing -- exactly the production output the file exists to
verify. Neither is any file's text. `anno-coverage.test.ts`'s "the witness is PURE" case was
likewise a pure idempotency check with zero source reference.

**Context:** Each was flagged by a plan's own provisional description as "genuinely mixed" or
"needs a D-02 hand judgement", and each resolved on hand-read to a case that should not be touched
at all. The plans' descriptions erred toward suspicion; the hand-reads corrected them.
**Source:** 56-08-SUMMARY.md (Deviation 1), 56-09-SUMMARY.md (Deviation 1), 56-11-SUMMARY.md § Four

---

### Capture the BEFORE set before the first edit, or pay to reconstruct it

56-01 Task 3 began editing `anno-types.test.ts` without capturing its BEFORE TAP set. Recovery
required writing the pre-edit committed content back to the working path, capturing the set, then
restoring the edited content from a local backup -- filesystem copies only, no git index or
history touched. Every subsequent plan records the capture explicitly as a prior-wave protocol
item.

**Context:** The recovered set (23 cases) matched CONTEXT.md's census exactly, confirming nothing
was lost -- but only because a committed baseline existed to recover from.
**Source:** 56-01-SUMMARY.md (Issues Encountered), 56-03..56-10-SUMMARY.md (Issues Encountered)

---

### Deleting a structural test leaves file-header prose that now lies, and it is a systemic defect class

Five file headers still described structural checks the phase had deleted in full
(`anno-seam.test.ts`, `block-class.test.ts`, `prg-image.test.ts`, `evid-report-keys.test.ts`,
`anno-derive.test.ts`) -- in two cases spending a full justifying paragraph on a check that no
longer exists. `block-class.test.ts`'s header still claimed an import-purity invariant "is
asserted here" when nothing catches it any more.

**Context:** All 8 review warnings were fixed in 9 commits. The verifier then found 4 more
instances of the identical pattern -- one inside the review's own 21-file scope and missed, three
outside it and never in scope to be caught. Finding N instances of a defect class is not evidence
the class is exhausted.
**Source:** 56-REVIEW.md (WR-01, WR-03, WR-05, WR-06, WR-07), 56-VERIFICATION.md § Anti-Patterns

---

### Pre-existing suite flakes exist and are told apart from regressions by a single-file re-run

Two independent transient failures, both in files the plan never touched: `text-protocol.test.ts`
(a quiescence-window control, 56-09) and `anno-tools.test.ts` (a TOCTOU race test, 56-10). In both
cases re-running that file alone passed (34/34 and 105/105) and the full gate then reported
`fail 0`.

**Context:** In a phase whose entire gate is "the suite is green", a flake is indistinguishable
from collateral damage until it is isolated. Re-running the single file is the cheap disambiguator.
**Source:** 56-09-SUMMARY.md, 56-10-SUMMARY.md (Issues Encountered)

---

### The anticipated cross-file coupling did not fire

`anno-seam.test.ts`'s `TEST_FILES_NAMING_SQLITE` case was the only code-level assertion in the
repository pinning `anno-derive.test.ts`'s name from another file, and 56-02 was told to watch for
breakage when removing it. Nothing tripped; the whole suite stayed at `fail 0`.

**Context:** Worth recording because the watch was correct to set -- the coupling was real, it just
had no runtime consequence once the pinning case itself was gone.
**Source:** 56-02-SUMMARY.md (Next Phase Readiness)

---

## Patterns

### Per-file TAP name-set diff as a coverage-preservation gate

`node --test --test-reporter=tap <file>` emits a flat `ok N - <name>` list. Capture it before and
after the edit, diff with `comm -23`/`comm -13`, and require the lost set to equal the named set
exactly with gained == 0 (or == the renames).

**When to use:** Any surgical removal inside a living test file, where a green suite alone cannot
prove that only the intended cases went. It needs no source parsing, and per-file invocation
sidesteps whole-suite hazards. Used 20+ times across this phase, landing exactly on the named set
every time.
**Source:** 56-CONTEXT.md (D-15), every plan SUMMARY's `tech-stack.patterns`

---

### Offset-preserving masking: space-fill stripped spans instead of dropping them

When masking comments and strings out of source so real code can be searched, replace the stripped
span with spaces rather than removing it. Byte offsets survive, so a hit maps straight back to its
enclosing `test(...)` call by offset with no separate position table.

**When to use:** Any scanner that must both identify a token and locate its enclosing construct.
**Source:** 56-01-SUMMARY.md (`tech-stack.patterns`)

---

### Prove the tool against a planted fixture before trusting it -- and re-prove it every time it is reused

Observe the naive approach RED first (a substring grep wrongly flagged 4 of 5 fixture cases,
including both false positives), then the real tool GREEN (exactly the 2 genuinely-consuming
cases). Plans 56-03, 56-04, 56-05 and 56-10 each re-ran the fixture proof before scanning a real
file rather than inheriting 56-01's result.

**When to use:** Any tool whose output will authorise a destructive edit. This is the project's own
standing planted-violation convention (`.planning/codebase/TESTING.md`): a guard is proven by a
planted violation observed RED, never by reading the guard.
**Source:** 56-01-SUMMARY.md, 56-01-PLAN.md `<scanner_protocol>`, 56-03/04/05/10-SUMMARY.md

---

### The three-pass per-file protocol

Per file: (1) run the symbol-anchored scanner; (2) grep for `readFileSync` of a sibling `.ts`/`.mts`
and for module-scope `*_SOURCE` constants; (3) skim surviving case NAMES for source-reading prose
("STRUCTURAL", "non-vacuity", "imports nothing", "declares no module-level").

**When to use:** Whenever a tool's coverage has a known structural blind spot. Pass 2 found the
phase's largest single cluster (eleven cases, 56-09) and its trickiest single case (56-08); pass 3
is what surfaced 56-06's three unlisted `structure/proxy` siblings.
**Source:** 56-01-PLAN.md `<scanner_protocol>`, 56-08-SUMMARY.md, 56-09-SUMMARY.md

---

### Blanket-grep completeness gate over an enumerated list

Write the acceptance criterion as an unconditional whole-file predicate ("`grep -ac 'X' <file>`
returns 0", "no case name beginning `structure/proxy` remains") rather than as a check scoped to
the plan's own named candidates.

**When to use:** Any plan that enumerates specific line numbers or names for removal. The
enumeration will undercount; the blanket gate is what turns that into a caught deviation instead
of a silent partial cut. It fired three times in this phase.
**Source:** 56-06-SUMMARY.md, 56-10-SUMMARY.md

---

### git-diff-derived ground truth as an independent reconciliation cross-check

`git diff <pre-phase-baseline-commit> HEAD -- <file> | grep -E '^[-+]\s*test\('`, per file.

**When to use:** Closing any multi-plan phase whose deliverable is a count. It is derived from a
different source than the prose tally, and it catches renames (a removed line paired with a gained
line for the same case) that a prose tally double-counts as whole removals. The verifier
independently re-ran the same method and reproduced the numbers exactly.
**Source:** 56-11-SUMMARY.md (`tech-stack.patterns`, § Six), 56-VERIFICATION.md

---

### Stop and report; never adjust

If a candidate does not match its plan description, or a cut trips another file's pinned assertion,
that new measurement IS the finding. Report it and leave the code alone; do not patch the tripped
assertion or silently reconcile the mismatch.

**When to use:** Any plan where a measurement is the deliverable. It produced two of this phase's
most useful records -- 56-06's untouched `dispatch: no handler in the table ever throws` case and
56-10's disclosed numeric-threshold miscalibration -- both of which a "make it pass" instinct would
have erased.
**Source:** 56-01-PLAN.md `<cut_rule>`, 56-06-SUMMARY.md (Deviation 2), 56-10-SUMMARY.md (Deviation 3)

---

### The Helper rule: grep every caller before removing a helper, constant or import

A module-scope helper, constant or import goes with its cases only when every caller is itself
being removed. Grep the whole file for other callers first; confirm each remaining match sits
inside a case that is going.

**When to use:** Always, during case removal. It prevented a `ReferenceError` in 56-02, produced
the asymmetric-but-correct outcome in 56-08 (`parseAutoNamePrefixes` survives, three siblings go),
and its omission is what left the dead import the review caught in 56-03's file.
**Source:** 56-01-PLAN.md `<cut_rule>`, 56-02-SUMMARY.md, 56-08-SUMMARY.md

---

### Record every cleared false positive as prominently as every removal

The phase SUMMARY devotes a full numbered section (§ Four) to the seven candidates a hand-read
cleared, each with the reason the attribution was wrong.

**When to use:** Any deletion-shaped work. These entries are the record that the cut was not
over-broad -- the half of the claim a removal list cannot carry. A reviewer checking "did you take
too much?" has nothing else to read.
**Source:** 56-11-SUMMARY.md § Four

---

### Keep the constraint, drop the credit

When a comment states a real invariant AND credits a now-deleted test with enforcing it, remove
only the enforcement clause and any dangling connective. The constraint sentence stays. Write no
replacement prose. Where the text is a past-tense historical note that already says the old
enforcement is gone, trim only the test-file citation and leave the narrative intact.

**When to use:** Retiring a structural guard whose invariant is still true. Applied to 13 clauses
across 5 production modules; the six added lines were all re-flowed sentence remainders, zero
composed prose.
**Source:** 56-CONTEXT.md (D-11), 56-10-SUMMARY.md, 56-11-SUMMARY.md § Seven

---

### Remove a section header with its content when the header describes only that content

`vsf-slice.test.ts`'s "Structural SUPPLEMENT" header, its two helpers and its three cases went as
one block; `anno-coverage.test.ts`'s "11. Read-only by construction" header went with its single
case, leaving the 10-to-12 numbering gap rather than renumbering.

**When to use:** When the header is organisational scaffolding for removed content, not independent
prose. Contrast `anno-seam.test.ts`, where the same judgement went the other way under D-10 and
left visibly orphaned banners -- which the phase's own code review then flagged (WR-02, WR-04) and
fixed. The distinguishing question is whether the header says anything a reader still needs.
**Source:** 56-05-SUMMARY.md, 56-09-SUMMARY.md, 56-02-SUMMARY.md, 56-REVIEW.md (WR-02, WR-04)

---

## Surprises

### The roadmap's census missed a whole file -- seventeen importers, not sixteen

The live re-measurement at discussion time found `shipped-modules.test.ts` itself: 449 lines, 16
tests, in the automated set, the module's own test. It also surfaced a third giant file the roadmap
never flagged, `anno-coverage.test.ts` at 5,016 lines / 115 tests.

**Impact:** Added D-09 (the module's own test is deleted wholesale, and its count reported
SEPARATELY per success criterion 2) and a whole plan's worth of work in 56-09. The phase's final
reconciliation -- "100 embedded, 16 whole-file" -- exists in that shape entirely because of this
correction.
**Source:** 56-CONTEXT.md § Measured census, 56-11-SUMMARY.md

---

### The mandated blind-spot pass out-found the purpose-built scanner on the largest file

56-09's pass surfaced a dedicated source-scanning sub-infrastructure -- a
`coverageSource()`/`functionBodyFromSource()`/`scanBodyText()`/`censusBodyText()` helper family
plus eleven cases built on it -- that referenced zero `shipped-modules.ts` symbol and was therefore
invisible to the symbol-anchored scanner by construction, and that the planner's line-proximity
heuristic also missed entirely.

**Impact:** More than three times as many extra cases as any prior plan's blind-spot find. Had the
executor run the pass only near the named candidates rather than across the whole file, eleven
source-scanning cases would have survived the phase and success criterion 1 would have been
satisfied while the phase's actual goal was not.
**Source:** 56-09-SUMMARY.md (Deviation 2)

---

### Plan candidate lists undercounted three separate times, always in the same direction

56-06: 11 named, 14 real. 56-10 Task 2: 4 named, 8 real. 56-10 Task 3: 1 named, 2 real. Never an
overcount.

**Impact:** Turned a one-off into a documented pattern mid-phase -- 56-10 explicitly cites 56-06 as
the precedent that told it to re-grep before trusting its own enumeration. The blanket-grep gate
stopped being a formality and became the load-bearing check.
**Source:** 56-06-SUMMARY.md, 56-10-SUMMARY.md

---

### Seven flagged candidates were not source-scanning cases at all

Plans described candidates as "genuinely mixed", "parses a regex out of the exporter's source
text", "reads a source constant twice while also calling `dispatchStock` for real" -- and
hand-reading at the paren-matched boundary cleared all seven, byte-identical, no rename.

**Impact:** The plans' provisional attributions erred toward suspicion far more often than toward
omission. Every one of those seven cases would have been destroyed by a plan executed literally
rather than re-read. The hand-read step is not ceremony.
**Source:** 56-11-SUMMARY.md § Four, 56-06/08/09-SUMMARY.md

---

### The "leave stale prose stale" rule collided with the phase's own code review

D-10 and the cut_rule explicitly told executors that test-file headers describing now-removed
checks stay byte-identical, and 56-02 dutifully left orphaned section banners in place and recorded
the reason. The code review then reported exactly those artifacts as warnings (WR-01..WR-07,
including the orphaned banners at WR-02/WR-04) and all 8 were fixed in 9 commits.

**Impact:** A deliberate, reasoned decision at discussion time was reversed by a quality gate at
close time. Neither party was wrong on its own terms -- the executors followed a binding
instruction, the reviewer read a file that lies about itself. It is a real seam between "write no
new prose" and "leave nothing that misleads", and this phase did not resolve it so much as pay for
both.
**Source:** 56-CONTEXT.md (D-10, D-13), 56-02-SUMMARY.md (Decisions Made), 56-REVIEW.md

---

### The verifier found four more instances of the defect the review had just closed

After the review's 5 stale-header fixes landed, the verifier found the same false-claim pattern in
`anno-store.test.ts` (inside the review's declared 21-file scope, missed),
`anno-confinement.test.ts`, `evid-ingest.test.ts` and `host-tool.test.ts` (all outside it, never in
scope to be caught).

**Impact:** Recorded as non-blocking Warning-level findings with a suggested follow-up commit; the
phase passed 5/5 on its stated criteria. The instructive part is the scoping: a defect class
created by deleting X does not confine itself to the files that contained X, so a review scoped to
the touched-file set structurally cannot close it.
**Source:** 56-VERIFICATION.md § Anti-Patterns Found

---

### D-12's accepted gap was never actually invoked

The phase pre-accepted that a stale enforcement claim outside D-11's five named modules might
survive. Every extra occurrence the blanket greps found (8-vs-4, 2-vs-1) turned out to be INSIDE
those five named modules.

**Impact:** D-12 remains a bounded possibility rather than a confirmed instance. The bounded named
set proved to be the right boundary -- the undercounting was within it, not beyond it.
**Source:** 56-11-SUMMARY.md § Eight

---

### A numeric acceptance threshold could not be met because it was calibrated to the wrong count

56-10 Task 2's criterion said the `anno-store.ts` diff "adds at most four lines, all re-flowed
remainders" -- a ceiling sized to the plan's undercounted four-clause list. The correct eight-clause
repair adds six lines, every one a re-flowed remainder and none composed prose.

**Impact:** Disclosed as a deviation rather than silently treated as passing, and rather than
trimming the repair to fit the number. A threshold derived from an enumeration inherits that
enumeration's errors -- the qualitative rule ("all re-flowed remainders, no new prose") held
perfectly while the quantitative proxy for it did not.
**Source:** 56-10-SUMMARY.md (Deviation 3)

---

### Effort varied roughly ninefold across structurally identical plans

Durations ran 6 min (56-03, 56-04) to 55 min (56-02), with 40 min for the phase-close plan. The
file sizes do not explain it: 56-03 cut four cases across three files in 6 minutes, while 56-02 cut
21 cases from one 770-line file in 55. What distinguished the slow plans was tooling work and
dependency sequencing -- 56-02 wrote and debugged a case-removal tool and had to sequence two
helper removals across task boundaries.

**Impact:** For estimating this kind of surgery, the count of cases and the file's line count are
weak predictors; whether the plan has to build or fix a tool, and whether removals are coupled
across tasks, are strong ones.
**Source:** 56-01..56-11-SUMMARY.md (`duration`), .planning/STATE.md § Performance Metrics

---

_Extracted: 2026-09-15_
_Source artifacts: 11 PLAN.md, 11 SUMMARY.md, VERIFICATION.md, REVIEW.md, CONTEXT.md, DISCUSSION-LOG.md, STATE.md_
