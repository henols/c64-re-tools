---
phase: 19-absorbed-procedures-and-the-coverage-instrument
fixed_at: 2026-08-25
review_path: .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md
iteration: 2
findings_derived: 24
derivation: "`^#{2,6} +(WR|IN|CR)-(\\d+)(?![0-9])` over 19-REVIEW.md — docs-review-disposition.test.ts's own parseFindingIds() regex, replayed rather than retyped"
fixed: 10
rejected: 1
deferred: 13
status: all_dispositioned
---

# Phase 19: Review Disposition Ledger

**Source review:** `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-REVIEW.md`
**Findings derived:** 24 (4 Critical + 15 Warning + 5 Info)
**Iteration:** 2 (this file covers both review passes — the original 19 findings and the five
`CR-04` / `WR-13` / `WR-14` / `WR-15` / `IN-05` added by the second pass on 2026-08-25)

## What this file is, and why it exists

This is the phase's **durable disposition ledger** — one place a reader can consult for every
finding id `19-REVIEW.md` declares, regardless of which other document also happens to mention it.

It exists because of a specific, observed failure mode rather than as bookkeeping.
`docs-review-disposition.test.ts` accepts five disposition sources, and one of them is the phase's
own `*-VERIFICATION.md`. A verification report that quotes a finding id in its `missing:` prose
therefore *dispositions* that id as far as the guard can tell — while recording nothing about what
was done, and evaporating the next time a re-verification rewrites that file. That is a disposition
**by accident**. Measured at 19-13's plan time, five of this phase's ids (`CR-04`, `WR-13`, `WR-14`,
`WR-15`, `IN-05`) were in exactly that position.

Measured again while writing this file, at `f7f840a`, the accident has been **superseded rather
than merely tolerated**: those five ids are now each named in the SUMMARY of the plan that fixed
them (the guard's source 1), so re-running the guard's own predicate with `*-VERIFICATION.md`
excluded from the source set reports zero undispositioned ids. That measurement is recorded here
rather than the plan-time claim repeated, because the plan-time claim is no longer the current
state.

The ledger is still the thing that was missing. A per-plan SUMMARY records what *that plan* did; it
is not, and does not claim to be, an accounting of the review. Nothing before this file answered
"what became of every finding this review raised" in one place, and the guard's green was therefore
distributed across nine documents with no single owner. This file is that owner.

The guard's match is a word-bounded mention and it deliberately does not grade disposition quality
(its own header: *"this guard's job is to catch SILENCE ... not to grade disposition quality"*).
Quality is therefore this file's responsibility, not the guard's.

## Disposition vocabulary

| Term | Meaning |
|---|---|
| `fixed` | The defect is closed at its root, with a commit and a control that holds it down. |
| `fixed-narrowed-then-superseded` | Shipped work closed part of the defect class; the residual was re-filed under a **new id** rather than by reopening this one. Both halves are named. |
| `rejected-with-reason` | Deliberately not fixed, with the actual reason recorded so it is not re-litigated. |
| `deferred-with-owner` | Not fixed, with a named owner and a reason. Real, unclosed work. |

## Every finding, in review order

| Id | Finding | Disposition | Plan | Commit |
|---|---|---|---|---|
| CR-01 | `namesACaller()` matches caller addresses as unanchored substrings, defeating the multi-caller rule | `fixed-narrowed-then-superseded` — anchored on both widths and both sides; residual re-filed as **WR-13** | 19-06 | `0bca490` |
| CR-02 | the split lo/hi table scan manufactures census coverage from ordinary data | `fixed-narrowed-then-superseded` — class-3 scan gated behind five conditions; residual re-filed as **CR-04** | 19-08 | `1706d8b`, `9c9166d` |
| CR-03 | the elected MIT licence's permission notice ships nowhere, and the notices file states that it does | `fixed` — the 1072-byte upstream notice reproduced verbatim in all three notices files, presence checked by sha256 over the extracted fence, and the false sentence pinned as forbidden | 19-07 | `48e02f4`, `f941eef` |
| CR-04 | the dispatch-context gate accepts an ordinary zero-page *data*-pointer construction as proof of dispatch, so the census still manufactures `reachedAsInstruction` out of data | `fixed` — see the paragraph below; **not** accepted | 19-10 | `7f0499a` |
| WR-01 | split-table lo/hi roles are assigned by address order, producing byte-swapped targets, and the same idiom is reported twice | `fixed` — `Math.min`/`Math.max` role assignment deleted; orientation resolved from the pairing's own store construction or the pairing is advisory with an empty `targets` list | 19-08 | `1706d8b` |
| WR-02 | `autoPrefixNamesRemaining` and `multiCallerUndocumented.count` are pre-dedup lengths reported beside deduped address lists | `fixed` — every reported count derives from its own deduped list, regression-tested in both places | 19-06 | `cbdbf97` |
| WR-03 | the descent walk counts illegal/JAM opcodes as instructions; the linear sweep does not | `deferred-with-owner` — **owner: Phase 20's first use of the instrument.** Reason: the correct fix is gated on the project's `use_illegal_opcodes` setting (Phase 18 forces it on, deliberately), making it a behaviour decision that needs its own dated record rather than an inline patch | 19-08 (deferred) | — |
| WR-04 | the cross-reference bound is printed but never recorded in the JSON report | `deferred-with-owner` — **owner: Phase 20.** Reason: a report-shape addition that would widen the schema change 19-08 already made, for a reporting nicety no gap depends on | 19-08 (deferred) | — |
| WR-05 | `--sample` silently accepts and truncates non-integer input | `deferred-with-owner` — **owner: Phase 20, CLI cluster.** Reason: `anno-cli.ts` is untouched by all seven gap-closure plans and is in no plan's `files_modified` | 19-08 (deferred) | — |
| WR-06 | the entire coverage CLI surface is untested | `deferred-with-owner` — **owner: Phase 20, CLI cluster.** Reason: closing it means authoring a CLI test suite, a scope expansion beyond the reproduced instrument defects. This is also the honest limit on `19-VALIDATION.md`'s one green-run-only COV-01 row, and is named there | 19-08 (deferred) | — |
| WR-07 | `parseCoverageArgs`'s `unknownOption` branch is unreachable | `deferred-with-owner` — **owner: Phase 20, CLI cluster.** Same file, same reason | 19-08 (deferred) | — |
| WR-08 | the oracle's raw stdout reaches a second, unsanitised report field | `deferred-with-owner` — **owner: Phase 20, carried with WR-09.** The *risk* is recorded accepted in 19-08's threat register as `T-19G-08-06` (both `spawnSync` sites already pass an argument array with `shell: false`; the field is JSON data with no markup or shell sink downstream). The deferral does **not** cover the other half: the module header's claim is still false as written, which is a documentation defect and is still unfixed | 19-08 (deferred) | — |
| WR-09 | `probeUnp64()` ignores a non-zero exit status, contradicting its own contract | `deferred-with-owner` — **owner: Phase 20, carried with WR-08.** `packer-finding.mjs` is untouched by every gap-closure plan | 19-08 (deferred) | — |
| WR-10 | `--entropy` is neither range-checked nor refused when its value is missing | `deferred-with-owner` — **owner: Phase 20, CLI cluster.** Same file, same reason | 19-08 (deferred) | — |
| WR-11 | three suites and five shipped-prose citations hard-code a `.planning/phases/19-…` path that GSD archives | `deferred-with-owner` — **owner: the next milestone close, which is when it bites.** Reason: a pre-existing archival-fragility concern spanning five other files and three suites; fixing it inside a licence fix would have expanded it into a path-resolution refactor across shipped skill prose. 19-07 deliberately did not aggravate it — zero new hard-coded `.planning/` paths, verified by grep, and `NOTICES_FILES` is repo-relative for exactly this reason | 19-07 (deferred) | — |
| WR-12 | `manifestEntryFor()` lies to the type system and can throw a TypeError instead of its intended message | `deferred-with-owner` — **owner: Phase 20.** Reason: same file as 19-07's work, different function; 19-07's guard does not call it. One-line fix, no licence consequence, no gap depends on it | 19-07 (deferred) | — |
| WR-13 | the anchored multi-caller rule's label-name branch is still satisfied by an ordinary English word that happens to be a caller's name | `fixed` — see the paragraph below | 19-12 | `8c7a75c` |
| WR-14 | the class-4 stack-return scan feeds `provenDispatchTargets()` with no gate at all — no register match, no target plausibility, a guessed entry count | `fixed` — see the paragraph below | 19-11 | `c95bdaf` |
| WR-15 | one unrelated indexed load between a genuine split-table pair silently downgrades the whole pairing to advisory | `fixed` — see the paragraph below | 19-11 | `084f17a` |
| IN-01 | `anno-coverage.ts` carries a shebang but is a pure library | `rejected-with-reason` — the shebang is retained. Reason, in 19-08's words: out-of-scope cosmetics; *"harmless; removing it risks nothing but gains nothing"*. Recorded so the decision is not re-litigated. Still present at `anno-coverage.ts:1` | 19-08 | — |
| IN-02 | fixture regeneration is host-dependent despite the stated determinism contract | `deferred-with-owner` — **owner: Phase 20.** 19-08 deferred it *to 19-09* and 19-09 did not honour it: 19-09 edited `make-coverage-fixtures.mjs` and added no per-host qualifier, so the exposure grew from six files to eight. 19-10 added the FP2 pair under the same unqualified claim, so it stands at **ten** fixture directories today (measured: `ls -d fixtures/coverage/*/ \| wc -l` = 10, against the pinned `COMMITTED_CONTROL_FIXTURES = 10`). The determinism *contract* is checked by measurement each run (`19-VALIDATION.md`, twice-run generator with empty porcelain); what remains unqualified is the module header's claim about host-independence | 19-08 → 19-09 (not honoured) | — |
| IN-03 | `stripComments()` has no regex-literal awareness | `deferred-with-owner` — **owner: Phase 20.** Reason: different module family (`scripts/lib/anno-cli-verbs.mjs`); no gap depends on it, and the file is untouched by every gap-closure plan | 19-08 (deferred) | — |
| IN-04 | `computeStructuralCensus` never checks that `origin + size` stays inside the 16-bit space | `fixed-narrowed-then-superseded` — the census was bounded; the sibling *scan* was not, and that residual was re-filed as **IN-05** | 19-08 | `1706d8b` |
| IN-05 | `scanIndirectDispatch()` was not given IN-04's 16-bit bound, so the report can still carry addresses above `$FFFF` | `fixed` — see the paragraph below | 19-12 | `c213093` |

**`IN-06` does not exist.** `19-REVIEW.md:477` cross-references "`anno-cli.ts`'s WR-08/IN-06"
inside WR-10's prose, but the review declares no `IN-06` heading and the guard's regex sees none.
Named here so this ledger is a complete accounting of every id the review's *text* mentions, with
nothing dispositioned against an id that has nothing to dispose of. First recorded by 19-08.

## The six ids this gap-closure run is accountable for

### CR-02 — narrowed by 19-08, closed by 19-10, dispositioned in wave 1 by 19-14

`CR-02`'s disposition was **already filed**, on 2026-08-25 in wave 1 of this run, by plan 19-14 at
`.planning/todos/completed/2026-08-25-phase-19-review-cr-02-disposition.md` (commit `c201da4`) —
the guard's source 3, and the record that took `docs-review-disposition.test.ts` from red to green.
This paragraph **cites that record; it does not re-decide it.**

What that record establishes, and this ledger does not restate at length: the class-3 split-table
scan was gated by **plan 19-08, commit `1706d8b`** (with `9c9166d` carrying the negative controls
it never had), `COVERAGE_SCHEMA_VERSION` was bumped 1 → 2, ungated pairings moved to the advisory
`splitTableCandidates` sibling, and `provenDispatchTargets()` became the single seam every
`extraSeeds:` assignment reads. `CR-02` itself is correctly **RESOLVED (NARROWED)**, with the
residual re-filed as `CR-04` at review time rather than by reopening the id.

**The one thing this paragraph adds, which 19-14's record could not.** 19-14 was written at wave-1
time, before 19-10 ran, and it says so plainly: *"`CR-04` is OUTSTANDING ... at the date of this
record 19-10 has produced no SUMMARY and no commit."* That was correct then. The outcome is now
known: **`CR-04` was closed by plan 19-10 in commit `7f0499a`**, and `19-10-SUMMARY.md` names it.

The two records therefore **agree across time** rather than contradicting each other. Checked
explicitly, fact by fact, before writing this: 19-14 names `CR-02` resolved-narrowed by 19-08 at
`1706d8b` — so does this ledger. 19-14 names the residual as re-filed under `CR-04` — so does this
ledger. 19-14 names `CR-04` outstanding *as of its own date*, with an explicit statement that
nothing there should be read as a claim that `CR-04` is fixed — this ledger names `CR-04` fixed as
of *its* date and cites the commit. 19-14 states `19-REVIEW.md` is byte-unchanged — so does this
ledger, and it is. There is no fact on which the two disagree; the only difference is the date each
was written, and each names its own.

### CR-04 — FIXED, and it must not be recorded as accepted

**Disposition: `fixed`. Plan 19-10, commit `7f0499a`.**

The class-3 dispatch gate accepted "two stores into consecutive zero-page addresses within reach"
as proof of dispatch — which is how every 16-bit pointer on a 6502 is built, including the ones
read through with `lda ($fb),y`. The predicate never looked at what *consumed* the vector it saw
being built, so an ordinary pointer setup promoted its data to the headline `reachedAsInstruction`.

`hasDispatchContext()` now requires the **consumer**: an indirect jump's operand value must equal
the lower of two zero-page store targets differing by exactly one. The bare-`0x6c`-within-reach
branch was **removed, not kept alongside** the new match — an indirect jump through some *other*
vector near two indexed loads is not evidence that those loads feed it.

**Control:** `fp2-zeropage-data-pointer`, the gate's first *interior* negative control, committed as
a generated fixture and asserted at report level through the shipped `buildCoverageReport()`. It was
observed RED against the unfixed gate: `splitTables.length` 1 → 0, `provenDispatchTargets()` eight
values → `[]`, `tableEntryAddresses.length` 16 → 0, `classAt($0840)`
`"reached-as-instruction"` → `"unreached"`, `structural.reachedAsInstruction` 33 → 17 against a
declared `code_size` of 17. Its immediate twin `fp2b-immediate-data-pointer` makes that baseline
**measured rather than remembered**, and `DISPATCH_CONTEXT_SHAPES` / `GATE_INTERIOR_DECLARATIONS` /
`reachesGateInterior()` make a shape added without an interior control red the suite by name.

**Why the word `accepted` does not describe this and must not.** `CR-04` is the defect SC4 / COV-02
turns on — *a vacuous pass is detectable*. Recording it accepted would be a scope reduction wearing
a ledger entry's clothes: the instrument's headline number would still be talkable into a better
answer by ordinary data, which is the exact property the phase goal names, while the ledger said
the matter was settled. It is fixed, at its root, with a control that had teeth.

### WR-13 — FIXED (plan 19-12, commit `8c7a75c`)

The anchored multi-caller rule from `CR-01` still counted a caller as named when an ordinary English
word happened to be that caller's label — and the external analyser label names are routinely `loop`,
`init`, `main`, `start`, `data`, `table`, `draw`.

**The control that holds it down:** `citesCallerByName()` demands a *reference*, not a coincidence —
the name in backticks, or introduced by a marker from the frozen `CALLER_CITATION_WORDS`
(`from`, `by`, `call`, `called`, `caller`, `callers`, `calls`) within three non-identifier
characters, or followed by its own parenthesised hex address — with four genuine-citation controls
plus the fixture-level statement (`nc5` clean with an empty findings array, `nc4` still caught by
`reproducibility` **by name**), and the marker list frozen so widening it is a visible act.

### WR-14 — FIXED (plan 19-11, commit `c95bdaf`)

The class-4 stack-return scan poured into `provenDispatchTargets()` — the seam 19-08 called *"the
ONE seam that decides what may seed a recursive descent"* — while satisfying none of the five
conditions 19-08 gated class 3 behind: no index-register match, no target plausibility, a guessed
entry count, and no negative control at all.

**The control that holds it down:** `isPlausibleEntryPoint()` is now **shared code** read by both
halves of the seam rather than two copies of the same intention — WR-14 existed for exactly as long
as the decodability test lived in only one of them — plus two committed class-4 negative controls
(`STACK_RETURN_MIXED_REGISTERS` and the implausible-target payload) each carrying a
`GATE_INTERIOR_DECLARATIONS` row with its position *and* polarity, mechanically checked in both
directions. The walk now stops at the first implausible value and marks the finding truncated, so a
cut-short walk is reported rather than shown as a clean empty list.

### WR-15 — FIXED (plan 19-11, commit `084f17a`)

One unrelated indexed load between the two halves of a genuine split table silently downgraded the
whole pairing to advisory, erasing a real dispatch table from the proven set.

**The control that holds it down:** only a **PROVEN** pairing consumes its leading load; the
advisory branch remembers its first candidate and keeps scanning. Held by a two-payload comparison
asserting the pairing survives the interposed load, plus a multi-advisory non-vacuity payload so
the "at most one advisory candidate per leading load" property is asserted over a payload that
could actually violate it rather than over one where it holds by construction.

### IN-05 — FIXED (plan 19-12, commit `c213093`)

`IN-04` bounded the census at the 16-bit edge and its sibling `scanIndirectDispatch()` was left
unbounded, so the report could still carry addresses above `$FFFF` — the census and its own
dispatch sub-report describing two different address spaces.

**The control that holds it down:** one derived `effectiveEnd = Math.min(safeOrigin + size, 0x10000)`
read by **all five** bound sites rather than five independent comparisons, with the census and the
dispatch sub-report asserted in one test to describe one address space, and a non-vacuity half
showing the bound truncates real findings instead of emptying the report.

## The two properties this ledger exists to hold

**1. `19-REVIEW.md` is byte-unchanged.** Not regenerated, not renumbered, not annotated, not
touched. This is load-bearing rather than tidy: the guard keys on the ids present in that file, so
regenerating it to make a guard green would orphan every id the guard tracks and destroy the record
the guard exists to protect. That mistake has been made in this repository before. A disposition is
an account of what was done, never a phrasing that satisfies a parser.

**2. Every id the review declares is accounted for here**, regardless of whether some other source
also happens to mention it. The id set in the table above was derived by replaying
`parseFindingIds()`'s own regex over `19-REVIEW.md` — 24 ids — not typed from memory and not copied
from the verification report. Set equality between the derived set and the set this file's table
dispositions was checked mechanically, in both directions, and the command and its output are
recorded in `19-13-SUMMARY.md`.

Measured the same way: **this file alone, as the guard's source 5 with every other source excluded,
covers all 24 ids.** That is the property that matters — the guard's green no longer depends on any
other document continuing to mention any id. `IN-06` is the one id token in this file that no table
row dispositions; it appears solely in the paragraph above stating that it does not exist.

Ten fixed, one rejected with its reason, thirteen deferred with a named owner. The thirteen are
real, unclosed work and are stated as such — a ledger that understates the state is worse than no
ledger, because it is trusted.

---

_Dispositioned: 2026-08-25 by plan 19-13 (wave 4 of the second gap-closure run)_
_Wave-1 companion record for `CR-02`: `.planning/todos/completed/2026-08-25-phase-19-review-cr-02-disposition.md` (plan 19-14)_
