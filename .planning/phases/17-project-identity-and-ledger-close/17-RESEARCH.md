# Phase 17: Project Identity and Ledger Close - Research

**Researched:** 2026-08-23
**Domain:** Planning-document/ledger closure + a documentation-guard source fix (not application code)
**Confidence:** HIGH (all load-bearing claims verified by reading the cited files and running the guard this session)

## Summary

This phase looks like a pure documentation edit but is not: the mechanical guard
`docs-deferred-ledger.test.ts` that DEBT-04 depends on is **currently red**, and it
is red for a structural reason the guard's own author did not anticipate — the
pending-todo tree just hit **zero** for the first time in this project's history,
and the guard's non-vacuity floor (`pending.length >= 2`) and its positive-control
stem both assume at least one pending todo always exists. ROADMAP.md's claim that
"this phase edits planning documents only and touches no source" is **false**: the
guard itself (`src/mcp/vice/docs-deferred-ledger.test.ts`) needs a source edit
before DEBT-04's criterion 2 can be satisfied by anything other than turning the
guard off. Separately, STATE.md's `## Deferred Items` section text is stale by
exactly the two rows the orchestrator's brief predicted (`PKG-01`'s relocation
todo and `PKG-03`'s stale-phase-pointers todo), both of which moved to
`.planning/todos/completed/` in commit `a2835a5` with **no `## Resolution`
section** — a departure from this milestone's own convention (30 of 35 completed
todos carry one), though not one any test enforces.

CORE-01 is a different kind of task: there is no guard, and the two possible
outcomes (restate, or record a dated "weighed and kept") are both legitimate
under the requirement's own wording. The evidence for restating is strong and
concrete (Phase 11's two-session sealed-question test, the symbol round trip, the
17 `anno_*` tools); the evidence for keeping the current wording is that the
Core Value's actual subject — driving a *live* emulator reliably — is still the
single thing every other phase of both this milestone and the prior two exists to
serve, and the "outlives the session" property is a second axis, not a
replacement for the first. FORK-01 (Phase 14) is the directly reusable shape for
whichever verdict is chosen: a dated, evidence-citing paragraph inside the
relevant section, cross-referenced from `### Out of Scope`, with an explicit
reversal/revisit condition named either way.

**Primary recommendation:** Treat DEBT-04 as the harder, code-adjacent half of
this phase (fix the guard's zero-pending edge case *and* fix STATE.md's stale
rows together, in the same commit, so the guard is never left red) and CORE-01 as
the judgment-call half (weigh the evidence honestly in a dated paragraph inside
`## Core Value`, following FORK-01's shape but placed where ROADMAP's own
criterion 1 says it belongs — inside Core Value, not Key Decisions). Sequence
DEBT-04's guard fix as the tracer task, the same way Phase 15 used its own
guard-widening as its tracer, because until the guard can express "zero," no
other task in this phase can prove its own success mechanically.

## Architectural Responsibility Map

This phase has no browser/API/database tiers in the conventional sense — it is a
planning-document and test-guard closure. The closest equivalent mapping:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deferred-items ledger accuracy (DEBT-04) | Planning docs (`STATE.md`) | Test/guard layer (`docs-deferred-ledger.test.ts`) | The ledger's *truth* lives in `.planning/todos/pending/`; STATE.md is a rendered view and the test is the enforcement mechanism keeping the view honest |
| Core Value statement (CORE-01) | Planning docs (`PROJECT.md`) | — | No guard exists or is required by the requirement text; purely a documentation judgment call |
| Requirement/roadmap bookkeeping (ticking CORE-01/DEBT-04, closure notes) | Planning docs (`REQUIREMENTS.md`, `ROADMAP.md`) | — | Same convention every prior v0.4.0 phase closure used |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-04 | "The deferred-items ledger at the v0.4.0 close is still derived and guarded, and its count is lower than the 19 items inherited" (`REQUIREMENTS.md:196`) | See `## Ledger mechanics` and `## The true count` below — the guard is currently red and needs a source fix before the count can be re-derived and re-guarded honestly |
| CORE-01 | "PROJECT.md's Core Value either states what v0.3.0 proved — that what a session learns outlives it — or records a dated confirmation that it should not, with the evidence weighed either way" (`REQUIREMENTS.md:200`) | See `## Core Value evidence` and `## Dated-decision prior art` below |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD Workflow Enforcement**: all file-changing work must go through a GSD command (`/gsd-plan-phase` → `/gsd-execute-phase`); no direct edits outside the workflow.
- **Tech stack**: Node ≥ 22.18, native TypeScript type-stripping, `node --test` is the test runner (`npm test` = `node --test '*.test.*'` in `src/mcp/vice`; `npm run test:automated` = `node test-gate.mjs`, which excludes `MANUAL_ONLY_TESTS`). `docs-deferred-ledger.test.ts` is **not** in `MANUAL_ONLY_TESTS` — confirmed by reading `test-gate.mjs:95-105` (`src/mcp/vice/test-gate.mjs`) — so it runs under both `npm test` and `npm run test:automated`, and under CI.
- **Naming/code style conventions** apply if the guard file is edited: 2-space indent, double quotes, explicit `.ts` extensions on relative imports, JSDoc-style block comments explaining WHY (this file already follows that convention heavily and any edit should match its existing voice).
- No CLAUDE.md directive forbids editing a `docs-*.test.ts` guard; several prior phases (12, 13, 15) did exactly this to their own guards when the guard's blind spot was discovered mid-milestone. Treat this as sanctioned precedent, not a deviation.

## Ledger mechanics

### What the guard checks (read in full this session — `src/mcp/vice/docs-deferred-ledger.test.ts`, 180 lines)

Four tests, two of them the actual bidirectional invariant AUDIT-04 exists for:

- **Direction A** (`docs-deferred-ledger.test.ts:82-95`) — "every pending todo has a
  row in STATE.md's Deferred Items section": every filename stem in
  `.planning/todos/pending/` (via `todoStems()`, `docs-deferred-ledger.test.ts:48-52`)
  must appear as a **substring** somewhere in the `## Deferred Items` section text
  (`missingPendingStems()`, `:68-70`). `[VERIFIED: src/mcp/vice/docs-deferred-ledger.test.ts:64-70]`
  — quoted: `"Predicate 1 (AUDIT-04, direction A): every pending todo's stem must appear somewhere in the Deferred Items section text."`
- **Direction B** (`docs-deferred-ledger.test.ts:97-110`) — "no completed todo is
  still listed as Pending": no filename stem from `.planning/todos/completed/` may
  appear anywhere in that same section text (`wronglyListedCompletedStems()`,
  `:78-80`). `[VERIFIED: src/mcp/vice/docs-deferred-ledger.test.ts:72-80]` — quoted:
  `"Predicate 2 (AUDIT-04, direction B): no completed todo's stem may still appear in the Deferred Items section text"`.
- **Section extraction** (`:59-62`): `deferredItemsSection()` matches
  `/^## Deferred Items\n([\s\S]*?)(?=\n## )/m` against `STATE.md` — everything
  from the `## Deferred Items` heading up to (not including) the next `## `
  heading. `[VERIFIED: src/mcp/vice/docs-deferred-ledger.test.ts:59-62]`. It is a
  **substring** match on the raw section text, not a structured table parse — no
  particular table-column shape or sentence form is required by predicates A/B
  themselves; a stem just has to occur as literal text somewhere in the section
  (e.g. inside the narrative prose paragraphs above the table, which is in fact
  how the section is currently written).
- **Non-vacuity test** (`:112-140`) is the one that is currently failing for a
  structural reason: it asserts `pending.length >= 2` (`:128`,
  `assert.ok(pending.length >= 2, ...)`) and hard-codes a **positive-control
  stem**, `"2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json"`
  (`:137`), asserting it `.includes()` the pending directory (`:138`) and that
  `missingPendingStems()` finds it present in the real section text (`:139`).
  Both assumptions are now false: pending has 0 files, and that exact stem is in
  `.planning/todos/completed/`, not `.planning/todos/pending/`.
- **Planted-violation test** (`:142-179`) exercises predicates A and B against
  **synthetic** strings, not the real repo state, so it is unaffected by the
  pending count reaching zero — it will keep passing regardless.

### Does the guard handle "zero pending" today? No — confirmed by running it.

`[VERIFIED: live run this session]` — `cd src/mcp/vice && node --test
docs-deferred-ledger.test.ts` → **1 pass / 3 fail** (of 4 tests):

```
not ok 2 - no completed todo is still listed as Pending in STATE.md's Deferred Items section (AUDIT-04, direction B)
  actual:
    0: '2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json'
    1: '2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments'
  expected: []

not ok 3 - non-vacuity: the Deferred Items section is located, non-empty, and the scanned sets clear a floor
  error: 'expected at least 2 pending todos, got 0'

not ok 4 - planted violation: both predicates fire on synthetic input, and the real, corrected text is reported by neither
  error: 'the real, corrected STATE.md must not be flagged by predicate 2'
  actual: [ '2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json', '2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments' ]
```

Test 1 (direction A) passes trivially — with zero pending files, `missingPendingStems([], section)` is vacuously `[]`.

**This is the single highest-risk item for this phase, confirmed rather than
merely suspected.** The guard cannot currently express "zero pending todos" as a
passing state, for two independent reasons that both need fixing:

1. **Direction B fails today for the mundane, expected reason**: STATE.md's
   Deferred Items section text still contains both now-completed stems (as
   Pending rows) — this is exactly the drift the guard exists to catch, and
   fixing it is a pure STATE.md text edit (remove/update the two rows). This
   part is NOT a source-code problem — it is the doc catching up to reality, and
   is at the heart of what DEBT-04 asks for.
2. **The non-vacuity test's structural assumption fails and is a source-code
   problem**: the `pending.length >= 2` floor and the hard-coded positive-control
   stem both assume the pending tree is never empty. Since it now genuinely is
   empty (0 files, confirmed by `ls .planning/todos/pending/` returning only `.`
   and `..`), this assertion needs to change or the guard can never turn green
   again while pending stays at 0 — even after STATE.md's text is corrected.
   The comment already sitting in the file's non-vacuity test
   (`docs-deferred-ledger.test.ts:126-127`) anticipates this exact case:
   `[VERIFIED: src/mcp/vice/docs-deferred-ledger.test.ts:126-127]` — quoted
   verbatim: `"Lower again, rather than raise, if it ever trips for the same
   reason -- DEBT-04 (Phase 17) may shrink this further still."` The guard's own
   prior author left this instruction for this exact phase.

### Recommended fix shape (for the plan to size, not to prescribe verbatim)

- Lower the floor from `pending.length >= 2` to `pending.length >= 0` (i.e.
  remove or trivialize that specific assertion) since 0 is now a legitimate,
  intended state — DEBT-04's own success criterion is a lower count, and the
  true floor is "however many are left after every phase's disposition work,"
  which this milestone has now proven can reach zero.
- Replace the **positive control** (`docsdeferred-ledger.test.ts:131-139`), which
  currently requires a real pending stem to exist. Two viable approaches: (a)
  make that portion of the non-vacuity test conditional on `pending.length > 0`
  (skip the specific-stem check when there is nothing pending to positively
  control against, while keeping the completed-todos floor `>= 5` and the
  section-located/non-empty checks unconditional), or (b) restructure the
  positive control to use a **synthetic** stem the way the planted-violation
  test already does, so it no longer depends on repo state. Option (a) is
  smaller and keeps faith with "this test proves the scan finds SOMETHING when
  something exists to find" rather than manufacturing a fake positive control.
- The completed-todos floor (`completed.length >= 5`, `:129`) is unaffected —
  currently 35, comfortably above 5.
- Section text itself: fix STATE.md's `## Deferred Items` so predicate B passes
  — i.e., stop stating either stem as "Pending" anywhere in that section
  (narrative prose or table). The current stale text is quoted below under
  `## The true count`.

### Test scope confirmation

`[VERIFIED: src/mcp/vice/test-gate.mjs:95-105]` — `docs-deferred-ledger.test.ts`
is **not** listed in `MANUAL_ONLY_TESTS` (the 9-entry frozen array), so it runs
under `npm run test:automated` as well as the full `npm test`. Per the project's
own standing lesson (and the user's own memory note), `npm run test:automated`
is the narrower, CI-mirroring subset but does **not** hide this particular
guard — it hides only the nine named live/manual suites. The real gate for this
phase's own verification should still be the full `npm test`, not
`test:automated`, both because that is the documented convention (`CI test-command
divergence settled keep-npm-test`, `STATE.md:378`) and because a docs-only-guard
regression is exactly the kind of thing a narrower gate could theoretically miss
if the guard set ever changes shape again.

## The true count

### Confirmed facts (verified live this session)

- `.planning/todos/pending/` — **0 files** `[VERIFIED: ls -la .planning/todos/pending/, this session]`.
- `.planning/todos/completed/` — **35 files** `[VERIFIED: ls .planning/todos/completed/ | wc -l, this session]`.
- Both orchestrator-named todos are present in `completed/` with `resolves_phase:
  16` frontmatter: `2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json.md`
  and `2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md`
  `[VERIFIED: file listing + frontmatter read, this session]`.
- **Neither of those two files carries a `## Resolution` heading** — confirmed by
  grepping every heading in both files
  (`grep -n "^#" .planning/todos/completed/2026-08-20-relocate...md` →
  `## Problem`, `### ...`, `## Solution`; same pattern for the other file: `##
  Problem`, `## Why it was deferred`, `## What to do`). Neither has a
  `## Resolution` section. `[VERIFIED: grep output, this session]`
- **The commit that moved them** is `a2835a5`, subject `docs(phase-16): close 2
  resolved todo(s)`, and its diffstat shows **0 insertions, 0 deletions** — a
  pure `git mv`, no content added. `[VERIFIED: git show --stat a2835a5, this
  session]`. This is a real, if minor, departure from this milestone's own
  convention: 30 of the 35 files in `completed/` carry a `## Resolution` section
  (`[VERIFIED: for-loop grep over .planning/todos/completed/*.md, this session]`);
  the 5 other files without one predate the convention (2026-08-11, -12, two from
  -19, plus these two from -20/-21). **No test enforces `## Resolution`'s
  presence** — `docs-deferred-ledger.test.ts` only checks filename-stem presence
  in STATE.md, never a todo's internal content — so this is a hazard for
  documentation completeness, not a guard-blocking defect.

### The arithmetic

Pending todo files (0) + UAT-gap rows (0, confirmed below) = **0**, per STATE.md's
own stated accounting rule, quoted verbatim:
`[VERIFIED: .planning/STATE.md:730-735]` — *"per this table's own accounting rule
(pending todo files plus any UAT-gap row still open) there is nothing left to
carry as a `uat_gap` row. ... this is also, for the first time, the arithmetic in
full: 2 pending todo files in `.planning/todos/pending/` + 0 UAT-gap rows = 2."*
(that "2" is now 0, since both of those 2 pending files have since moved to
`completed/`).

**0 is strictly lower than 19** — criterion 2 is arithmetically satisfiable the
moment the guard and STATE.md text are both fixed to agree with reality.

### Where "19" comes from

`[VERIFIED: .planning/ROADMAP.md:533]` — quoted: *"Known deferred items at
close: 19 — 18 pending todos plus Phase 03's UAT gap (see `STATE.md` → Deferred
Items, derived from `.planning/todos/pending/` and guarded in both directions)."*
This is the v0.3.0 milestone's own close-time count, stated as the v0.4.0
inheritance baseline. It is corroborated verbatim in two more places:
`[VERIFIED: .planning/PROJECT.md:165, :485]` ("19 items acknowledged at close, up
from v0.2.0's 13" / "19 items deferred with a derived-and-guarded ledger") and
`[VERIFIED: .planning/MILESTONES.md:11]` ("**Known deferred items at close:** 19
(18 pending todos + Phase 03's UAT gap...)"). `REQUIREMENTS.md:196`'s DEBT-04
text cites "the 19 items inherited" directly. **This baseline is historical and
frozen** — it is the v0.3.0 close-time snapshot, not a second live ledger that
needs updating; MILESTONES.md's mention is archival record of a past milestone
close, not a duplicate of the current ledger.

### UAT-gap confirmation

`[VERIFIED: .planning/phases/03-direct-tools/03-HUMAN-UAT.md, grep for "result:", this session]`
— all three scenario rows read `result: pass`, `result: partial`, and `result:
pass` respectively; **zero** rows read `result: [pending]` or similar. This
matches STATE.md's own claim (`STATE.md:726-735`) that the UAT-gap row is gone.

### Other places stating a pending-todo count (none needing a second fix)

`[VERIFIED: grep -rln "Deferred Items" .planning/*.md and grep -rn "19 items"..., this session]`
Only `STATE.md` (the live ledger, needs fixing), `ROADMAP.md`/`PROJECT.md`/`MILESTONES.md`
(all citing the frozen historical "19" baseline, correctly static), and a handful
of individual completed-todo files and milestone-audit archives that mention a
count as of their own closure date (also correctly static/historical). **No
second live copy of the ledger exists anywhere else in `.planning/`** that this
phase would also need to update.

## Core Value evidence

### The current text, verbatim, with line numbers

`[VERIFIED: .planning/PROJECT.md:32-51]`:

```
## Core Value

A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

*Still correct after v0.2.0.* Shipping the second backend did not shift it; the
milestone widened *which* emulator qualifies as "a real C64 emulator" without
changing what the session needs to do with it.

**Flagged at the v0.3.0 close, deliberately not rewritten yet.** This statement
is entirely about driving a *live* emulator, and v0.3.0's whole point is the
opposite axis: findings that persist as queryable state *between* sessions, held
by a tool that never touches the emulator at all. The two-session sealed-question
test proved that value directly. One milestone of evidence is thin ground for
restating the ONE thing, so it is recorded as the first question
`/gsd-new-milestone` should ask rather than silently amended here. Candidate
shape: *a Claude session can drive a real C64 emulator to reverse-engineer a
program, and what it learns outlives the session.*
```

The file already carries a **candidate restated shape**, pre-written and waiting
for a decision — the task is not "invent new wording," it is "decide whether to
adopt the already-drafted candidate, adopt a variant, or explicitly decline it."

### Evidence FOR restating (that "what a session learns outlives it" is now proven, not hypothetical)

`[VERIFIED, each item read this session]`:

1. **`PROJECT.md:78` (Validated requirements list)** — *"`c64-program-recon`
   writes findings as queryable annotation state, not only Markdown prose, so a
   later session can query instead of re-deriving — Phase 11 (`ANNO-10`; proven
   by the two-session falsifiability test — session B answered a question sealed
   before it existed, from store queries alone)."* This is the single strongest
   piece of evidence: a genuinely independent second session answered a question
   it could not have known the answer to except by querying persisted state.
2. **`PROJECT.md:275` (Key Decisions table)** — *"Prove the store's value by
   sealed question, not by assertion (Phase 11 criteria 1) ... session A sealed a
   question with a hashed answer key; a genuinely separate session B answered
   from tool calls alone and the canonical line hashed identically (`e64463d8…`).
   The strongest evidence this milestone produced."*
3. **`PROJECT.md:81` (Validated)** — *"Symbols annotated in the external analyser export
   as VICE label files into the symbol store, and names discovered live flow
   back — closing the round trip — Phase 11 (`ANNO-14`, `ANNO-15`; demonstrated
   as one closed loop against genuine unpatched stock `x64sc`, with the inbound
   name's prior absence shown rather than claimed)."* — a second, independent
   mechanism by which a finding from one session (or one tool) becomes usable
   input to a later live emulator session.
4. **`PROJECT.md:79-80`** — the 17 curated `anno_*` tools let a later session
   query cross-references, labels, and comments over a program another session
   analysed, without re-deriving anything.
5. **`STATE.md:27-33` (Project Reference, current framing)** — already states the
   open question plainly: *"this says nothing about findings that outlive the
   session, which is what v0.3.0 delivered. Restating or explicitly confirming it
   is a v0.4.0 target feature, not a bookkeeping edit — see PROJECT.md → Core
   Value for the candidate shape."*
6. Structural evidence beyond Phase 11: the annotation store is **persistent** by
   construction (a project file the external analyser owns, not session memory), and
   `docs/tool-support.md`/the generated memory map are themselves artifacts that
   outlive any one session and are consumed by later ones (`PROJECT.md:139-140`,
   `:182-186`).

### Evidence AGAINST restating (that the current wording should be deliberately kept)

`[VERIFIED, each item read this session]`:

1. **The Core Value's actual subject is still exactly true and still exactly what
   every phase of all three milestones has served.** Every one of v0.2.0's 9
   phases, and the "live emulator" half of v0.3.0's own scope statement
   (`PROJECT.md:22-30`), and this entire v0.4.0 milestone's `EXTV-*`/`FORK-*`/
   external-verification work are all in service of "reliably drive a real C64
   emulator... and keep working when it misbehaves." Nothing in v0.3.0 or v0.4.0
   contradicts or narrows that claim — it widened *which* emulator counts
   (v0.2.0) and added a **second**, structurally separate capability (v0.3.0),
   but did not touch or weaken the first.
2. **The "outlives the session" property belongs to a component that is
   *structurally incapable of touching VICE at all*.** `PROJECT.md:82` (`ANNO-01`)
   states the static-analysis backend is "never launched with `--vice`, guarded
   in code rather than only documented" — two independent guarantees
   (`ANNO-02`). Folding "what it learns outlives the session" into a Core Value
   that is otherwise entirely about *live emulator driving* risks conflating two
   genuinely separate subsystems (the live `vice_*` surface vs. the
   emulator-incapable `anno_*` surface) into one sentence that no longer cleanly
   describes either.
3. **One milestone of evidence is explicitly flagged by the project's own prior
   author as thin ground** (`PROJECT.md:47`: *"One milestone of evidence is thin
   ground for restating the ONE thing"*) — the requirement text itself
   (`REQUIREMENTS.md:200`) explicitly permits keeping the statement as-is, on the
   condition that the evidence was weighed, not skipped. This is a legitimate,
   honest verdict, not a fallback for indecision.
4. **The candidate restated shape is a conjunction, not a replacement** — "a
   Claude session can drive a real C64 emulator... **and** what it learns
   outlives the session" bundles two capabilities into one sentence. A Core
   Value statement is meant to name the ONE thing; a project with two,
   structurally-separate axes of value (live control vs. persistent recon state)
   arguably needs the discipline of naming which one is *primary*, not appending
   the second with "and."
5. Nothing about v0.4.0's own actual work (external verification, audit
   integrity, the fork decision, debt disposition, packaging) touches or
   exercises the "outlives the session" axis at all — this milestone produced
   zero *new* evidence on the question CORE-01 asks about; all the evidence
   above is Phase 11 (v0.3.0) evidence, re-weighed a milestone later.

**This is a genuinely close call and the research deliberately does not resolve
it** — REQUIREMENTS.md's own Out of Scope table (`REQUIREMENTS.md:352`) warns
against exactly the failure mode of restating (or, by symmetry, of declining to
restate) "as a bookkeeping edit made in passing." The plan should treat this as
the phase's one genuine judgment-call task, likely gated behind a
`checkpoint:decision` the way FORK-01 was, rather than something an executor
resolves unilaterally.

## Dated-decision prior art

FORK-01 (Phase 14) is the directly reusable shape. Quoted in full,
`[VERIFIED: .planning/PROJECT.md:278]` (the full Key Decisions table row):

> **Decision:** Retain the forked VICE MCP backend as the default hedge
> (FORK-01, decided 2026-08-22)
> **Rationale:** Both hard losses this branch hedges — SID read-back
> (write-only in hardware, unrecoverable by any opcode) and RESTORE/NMI (no
> client-side substitute exists) — have no route except the fork, and
> retention's steady-state cost is already sunk and running in CI... This
> decision reverses if UP-01 lands: a `KEYBOARD_MATRIX_SET` opcode for VICE's
> binary monitor... As of VICE 3.10 that opcode has NOT landed — confirmed
> against the 3.10 manual's binary-monitor command list... Caveats carried, not
> resolved: the fork maintainer's current activity was not checked this session
> ... no evidence establishes whether any consumer runs the fork transport in
> production today (A3).
> **Outcome:** ⚠️ Revisit — pinned by the committed guard
> `docs-fork-decision.test.ts`. The adequacy evidence now exists: plan 14-03
> exercised the fork's own `-mcpserver` HTTP transport live... Still `Revisit`
> rather than `✓ Good` because the reversal trigger is manually tracked, not
> probed.

Also relevant, the accompanying `REQUIREMENTS.md` closure note
(`[VERIFIED: .planning/REQUIREMENTS.md:89-105]`), which shows the fields such a
closure note carries: **who** decided (a human, at a named blocking checkpoint,
not inferred/auto-approved), **where** it is recorded (PROJECT.md → Key
Decisions, with a date), **what** the reversal criterion names specifically
(the exact opcode), and **what evidence closes the adequacy gap** (plan 14-03's
live exercise, cited by file).

**The shape to reuse for CORE-01, adapted for its different location:**

- FORK-01 lives in `## Key Decisions` (a *decision about what to keep/remove*).
  CORE-01's dated entry belongs **inside `## Core Value` itself**, per ROADMAP's
  own criterion 1 wording (`ROADMAP.md:490`: *"PROJECT.md → Core Value ... has a
  dated entry"*) — not duplicated into Key Decisions, though nothing forbids
  cross-referencing it from there the way FORK-01 is cross-referenced from `###
  Out of Scope` (`docs-fork-decision.test.ts` test 6, `REQUIREMENTS.md:352`
  already sits as the Out-of-Scope-table analog for CORE-01).
- Fields to carry, mirroring FORK-01's structure: a stated **date**, an explicit
  **verdict** (restate / keep-as-is), the **evidence actually weighed** (cite
  Phase 11's sealed-question test and symbol round trip by name, the way FORK-01
  cites the `KEYBOARD_MATRIX_SET` opcode's non-landing by name), and — if
  "kept" — a **named condition under which this would be revisited** (e.g. "a
  second milestone's worth of persistent-state evidence" or "a session workflow
  that demonstrably depends on cross-session recall in production use").
- **No test guards this today**, unlike FORK-01. `docs-fork-decision.test.ts` is
  scoped exclusively to the `## Key Decisions` table and the FORK-01 row
  specifically (confirmed by reading the full file this session — every test
  keys on `FORK-01` string matching or the Key Decisions section regex); it does
  not touch `## Core Value` and would not be broken by adding text there. Whether
  to build a symmetrical `docs-core-value-decision.test.ts` guard is a
  **discretionary** choice for the plan, not a requirement — DEBT-04 explicitly
  says "still derived and guarded," CORE-01 does not use that language at all.

## Files this phase touches

**ROADMAP.md's claim ("this phase edits planning documents only and touches no
source") is only half true — REFUTED for one file.** Confirmed file set:

| File | Type | Why touched | Confirmed necessary? |
|------|------|-------------|----------------------|
| `.planning/PROJECT.md` | Planning doc | CORE-01: restate or record dated confirmation inside `## Core Value` | Yes |
| `.planning/STATE.md` | Planning doc | DEBT-04: fix `## Deferred Items` section text (both stale rows), update the `### Pending Todos` prose paragraph, update `## Operator Next Steps`/`## Session Continuity` for milestone-close readiness | Yes |
| `.planning/REQUIREMENTS.md` | Planning doc | Tick `[ ]` → `[x]` for both CORE-01 and DEBT-04, add closure notes matching this milestone's convention (see `## Recommended plan shape` for the convention shape), update Traceability table rows | Yes |
| `.planning/ROADMAP.md` | Planning doc | Fill in Phase 17's `**Plans**: TBD` line, mark `[ ]` → `[x]`, add outcome Notes matching Phase 12-16's convention | Yes |
| `src/mcp/vice/docs-deferred-ledger.test.ts` | **Source (test file)** | The guard's non-vacuity floor and positive control cannot express a zero-pending state — confirmed red by a live run this session. **This is a real source change**, not an artifact of stale planning prose. | **Yes — confirmed, not hypothetical** |

Optional/discretionary, not required:

| File | Type | Why it might be touched | Required? |
|------|------|--------------------------|-----------|
| `.planning/todos/completed/2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json.md` | Todo record | Add a `## Resolution` section for convention-consistency (30/35 completed todos have one) | No — no guard checks this |
| `.planning/todos/completed/2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md` | Todo record | Same | No |
| `src/mcp/vice/docs-core-value-decision.test.ts` (new file) | Source (new test) | A symmetrical guard for CORE-01's dated entry, mirroring `docs-fork-decision.test.ts` | No — not required by CORE-01's wording, purely discretionary hardening |

**Net conclusion for the plan:** budget one task that edits
`src/mcp/vice/docs-deferred-ledger.test.ts` as real, reviewable source-code work
(small — two assertions in one file), not as an afterthought. It should almost
certainly be the phase's tracer task, the same way Phase 15's own
guard-widening was that phase's tracer — until it's fixed, no other DEBT-04 task
can be verified mechanically green.

## Hazards

1. **The guard's zero-pending edge case (detailed above under `## Ledger
   mechanics`) is the dominant hazard.** Without fixing it, "0 pending, guard
   green" is not achievable — the plan must not treat this as a documentation-only
   fix.
2. **A future code review of this phase's own diff could file a new pending
   todo, and there is no Phase 18 to disposition it.** Every prior phase in this
   milestone (08, 09, 13, 14, and implicitly this one) has hit the same
   structural cause named repeatedly in STATE.md/REQUIREMENTS.md: *"the review
   gate runs after the last plan's SUMMARY, so no plan can ever disposition its
   own phase's findings"* (`REQUIREMENTS.md:139-141`). Phase 17 is the **last**
   phase of v0.4.0 (`ROADMAP.md:79`, `:519`) — there is no Phase 18 to inherit a
   finding from this phase's own post-execution code review, and `config.json`
   has `code_review: true`. If this phase's own review surfaces something and
   files a pending todo, the "true close" measurement this phase takes would be
   immediately stale by one item, and nothing downstream in this milestone would
   catch it. **Recommendation:** either (a) have the phase's own designated
   closer task re-check `.planning/todos/pending/` is still empty *after* the
   code-review/plan-check gates have run and before the phase is marked
   complete, folding any newly-filed finding into the same phase rather than
   leaving it dangling (the way Phase 15's 15-12 and Phase 16's 16-11 each
   served as "the phase's designated closer"), or (b) explicitly flag in the
   phase's own closure note that the milestone audit (`/gsd-audit-milestone`,
   which runs after Phase 17) is the backstop for this specific risk, since
   `GATE-01` (Phase 12) already blocks `status: passed` while any
   `docs-*.test.ts` guard is red.
3. **The two orphaned `## Resolution`-less todo closures (commit `a2835a5`) are
   a minor, non-blocking convention gap**, not a guard failure. Low priority; the
   plan can optionally close it in the same pass as other STATE.md edits, at
   near-zero cost, for consistency's sake — but should not treat it as required
   for either success criterion.
4. **CORE-01 is a genuine judgment call, not a fact-finding task.** The plan
   should not let an executor decide this unilaterally without a
   `checkpoint:decision`-style gate — FORK-01 precedent (`REQUIREMENTS.md:89-91`)
   used exactly this pattern ("decided by a **human**... after explicit
   escalation — not inferred, not auto-approved"). Given the evidence is
   genuinely balanced (see `## Core Value evidence` above), an autonomous
   executor silently picking a side risks exactly the "bookkeeping edit made in
   passing" the Out of Scope table warns against (`REQUIREMENTS.md:352`).
5. **STATE.md's `### Pending Todos` narrative paragraph (`STATE.md:398-497`) is
   long, heavily cross-referenced prose that has "gone stale twice before" by
   its own admission** (`STATE.md:474`: *"this prose figure must always equal
   that section's table row count, which has gone stale twice before and is not
   itself guarded"*). Whoever edits STATE.md for this phase should treat that
   prose paragraph and the `## Deferred Items` table as one atomic edit, the way
   the cross-cutting constraint from Phase 15 required (`ROADMAP.md:332`:
   *"STATE.md's `## Deferred Items` table and both of its prose count figures
   are updated in the same commits that move this plan's todos out of
   `pending/`"*) — even though this phase moves nothing new out of `pending/`,
   the same discipline applies to correcting the stale text.
6. **No second, hidden copy of the ledger exists** (confirmed by grep above) —
   this is a hazard *ruled out*, not one to guard against; worth stating plainly
   so the plan doesn't budget time hunting for a duplicate that isn't there.
7. **`.gitkeep` / directory-emptiness**: `.planning/todos/pending/` currently has
   no tracked placeholder file. `readdirSync()` on an empty directory returns
   `[]` cleanly (confirmed: the guard's own direction-A test already passed
   vacuously against it), so an empty directory is not itself a hazard for the
   guard's file-reading logic — only for the two assertions named above.

## Recommended plan shape

**Worktree mode: off**, matching both the phase's own planning note
(`ROADMAP.md:484-486`) and the project's global config
(`.planning/config.json` → `workflow.use_worktrees: false`, confirmed this
session) — no override is needed, but the plan should still state it explicitly
in its own frontmatter/notes, matching Phase 14/15/17's own precedent of naming
this deliberately rather than relying on the global default silently applying.

**Suggested wave structure — one plan, single wave, sequential tasks** (the
work is small, touches largely-disjoint files, and CORE-01/DEBT-04 do not
depend on each other's *output*, but both edit `REQUIREMENTS.md`/`ROADMAP.md`
in the closing task, so keeping it one plan avoids two plans racing on the same
closing edits):

1. **Task 1 (DEBT-04 tracer): fix the guard first.** Edit
   `src/mcp/vice/docs-deferred-ledger.test.ts` to handle zero pending todos (see
   `## Ledger mechanics` → Recommended fix shape). Do NOT yet touch STATE.md's
   `## Deferred Items` section — running the guard immediately after this task
   should still show direction-B failing (STATE.md text not yet fixed) and the
   non-vacuity test passing. This proves the fix in isolation, the same
   discipline Phase 15's 15-01 tracer used.
2. **Task 2 (DEBT-04 completion): fix STATE.md's ledger text.** Update `##
   Deferred Items` (remove/update the two stale Pending rows, add a new
   "Current, as of Phase 17..." paragraph following the file's own established
   convention for these updates, e.g. `STATE.md:725-736`'s shape) and the
   `### Pending Todos` narrative paragraph in the same edit. Re-run
   `docs-deferred-ledger.test.ts` — all 4 tests should now pass. This is the
   mechanical proof for success criterion 2.
3. **Task 3 (CORE-01, gated): weigh the evidence and record the verdict.**
   Present the for/against evidence (from `## Core Value evidence` above) at a
   `checkpoint:decision`-style gate, following FORK-01's precedent of a
   human-facing decision point rather than an autonomous pick. Write the dated
   entry inside `## Core Value` per whichever verdict is reached, following the
   shape in `## Dated-decision prior art`.
4. **Task 4 (closing bookkeeping): tick both requirements, close the phase.**
   Flip `REQUIREMENTS.md`'s `[ ]` → `[x]` for CORE-01 and DEBT-04 with closure
   notes matching this milestone's convention (see quoted examples throughout
   this document, e.g. `REQUIREMENTS.md:89-105`, `:111-130`); update the
   Traceability table's two `Pending` rows to `Complete`; fill in ROADMAP.md's
   Phase 17 `**Plans**: TBD` line and outcome Notes; re-verify criterion 3 by
   confirming (a) the Traceability table shows no other `Pending` row for this
   milestone, and (b) `.planning/todos/pending/` is still empty **after** this
   task's own edits (guards against this phase's own work having filed
   something). Run the full `npm test` in `src/mcp/vice` as the final gate.

**Per-criterion mechanical check** (see `## Validation Architecture` below for
the full mapping).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node:test`), no separate framework |
| Config file | None — invoked directly, `src/mcp/vice/package.json:106-107` |
| Quick run command | `cd src/mcp/vice && node --test docs-deferred-ledger.test.ts` |
| Full suite command | `cd src/mcp/vice && npm test` (= `node --test '*.test.*'`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-04 (criterion 2: count < 19, guarded both directions) | `docs-deferred-ledger.test.ts` all 4 tests pass with pending=0 | unit/guard | `cd src/mcp/vice && node --test docs-deferred-ledger.test.ts` | ✅ exists, currently RED — needs the Task 1 source fix before it can pass |
| DEBT-04 (criterion 3: no phase left to run) | ROADMAP.md Traceability shows no `Pending` row remaining; `.planning/todos/pending/` still empty after this phase's own edits | manual/structural check | `grep -c "Pending" .planning/REQUIREMENTS.md` (Traceability section) + `ls .planning/todos/pending/ \| wc -l` (expect 0) | N/A — no automated test; this is a closing-task manual verification, see Hazard 2 |
| CORE-01 (criterion 1: dated entry or restatement, evidence weighed) | `## Core Value` section contains either the restated text or a dated paragraph citing specific evidence | manual/evidentiary | No mechanical test exists or is required; optional discretionary guard `docs-core-value-decision.test.ts` could mirror `docs-fork-decision.test.ts`'s pattern (checks: a date, a citation of specific evidence e.g. "Phase 11" or "sealed-question", not merely presence of the word "Core Value") | ❌ no guard exists today — this is the one criterion this phase cannot fully mechanize; the check that IS mechanizable is "does the paragraph cite a date and name specific evidence," distinguishing a weighed decision from a bookkeeping edit (see next section) |

### Distinguishing "weighed" from "a bookkeeping edit made in passing" (criterion 1's hard part)

The **judgement** ("was this evidence properly weighed?") is not mechanically
checkable, but its **artifacts** are:

- A checkable date (`\d{4}-\d{2}-\d{2}` pattern) — a decision with no date cannot
  be distinguished from a change that could have been made at any point,
  including "in passing."
- A checkable citation of the **specific evidence actually weighed** — e.g. the
  literal string "sealed-question" or "Phase 11" or "`anno_*`" appearing in the
  new paragraph, the same way FORK-01's row is checkably required to name
  `KEYBOARD_MATRIX_SET` verbatim (`docs-fork-decision.test.ts` test 4). A
  paragraph that says only "Core Value confirmed, no change needed" with no
  evidence citation reads exactly like a bookkeeping edit and should be rejected
  at plan-check/review even without a dedicated test.
- If the verdict is "restate," the new text itself is the artifact — no
  citation is strictly needed, since the wording change *is* the evidence being
  acted on.

Recommend the plan's own verification task assert these two textual properties
by eye (or via a lightweight grep in a checkpoint task) rather than skip
criterion 1's harder half as unverifiable.

### Sampling Rate

- **Per task commit:** `cd src/mcp/vice && node --test docs-deferred-ledger.test.ts` (fast, seconds)
- **Per wave merge / phase gate:** `cd src/mcp/vice && npm test` (full suite — STATE.md records a recent full baseline of "2386 tests, 2342 pass, 0 fail, 39 skipped, 5 todo, 24 suites" from Phase 16's close, `STATE.md:70-71`; expect similar scale and a runtime on the order of a couple of minutes given the live/manual-skip suites are present but skip quickly when their opt-in env vars are unset)
- **Phase gate:** Full suite green before `/gsd-verify-work`, matching this milestone's own standing convention (`GATE-01`, Phase 12) that `status: passed` cannot be recorded while any `docs-*.test.ts` guard is red.

### Wave 0 Gaps

None in the conventional sense (no missing test *files* or fixtures) — but flag
explicitly: **the existing guard file needs a behavioral fix, not new coverage.**
This is an atypical Wave 0 gap shape (an existing, load-bearing guard is
currently red against the real tree) and the plan should name it as such rather
than searching for a missing test file that does not exist.

## Security Domain

`security_enforcement` is `true` in `.planning/config.json` (absent would also
default to enabled) — included per instruction, but this phase's actual work has
no meaningful ASVS surface:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth-touching code or docs in scope |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | No | The one source file touched (`docs-deferred-ledger.test.ts`) reads only trusted, repo-local files (`STATE.md`, the local todo directories) via `node:fs` — no external or user-controlled input |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

None applicable — this phase edits Markdown planning documents and a
`node:test` guard that performs local filesystem reads over paths resolved via
the existing `repo-root.ts` seam (already used, not newly introduced, by this
guard file). No new attack surface is created.

## Package Legitimacy Audit

Not applicable — this phase installs no packages, adds no dependencies. `npm
view`/registry checks were not needed.

## Environment Availability

Not applicable — no external tools, services, or runtimes beyond the existing
Node toolchain already used throughout this repository.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A future code review of this phase's own diff could plausibly surface a finding worth filing as a pending todo (based on the pattern repeating in Phases 08/09/13/14, not a certainty for this specific phase) | `## Hazards` item 2 | Low — if wrong, the extra closing-task check (re-verify `.planning/todos/pending/` is empty after review) simply confirms nothing changed; costs one cheap check, not wasted work either way |
| A2 | The recommended guard-fix shape (lower the floor to `>=0`, make the positive control conditional) is the *simplest* correct fix, not the *only* one — an alternative (e.g. a synthetic positive control) is equally valid and mentioned as an alternative | `## Ledger mechanics` → Recommended fix shape | Low — this is explicitly presented as a recommendation for the planner to size, not a locked implementation detail |

**No claim in this document required tagging `[ASSUMED]` at LOW confidence** — every
factual claim above a plain reasoning/recommendation was verified by reading the
cited file this session, running the guard live, or running `git`/`ls`/`grep`
against the real tree this session.

## Open Questions (RESOLVED by the phase plans)

> Both questions below were dispositioned by the plan-phase orchestrator and are
> carried into executable plan content — neither is left open for the executor.
> Q1 is resolved by 17-02's branch-conditional guard build (built only on the
> keep-with-dated-confirmation branch). Q2 is resolved by 17-03 task 1's
> low-priority backfill item. The original analysis is retained below unchanged.

1. **(RESOLVED — 17-02, conditional task.)** **Should CORE-01's decision get its own permanent guard
   (`docs-core-value-decision.test.ts`), mirroring `docs-fork-decision.test.ts`?**
   - What we know: no guard exists today; none is *required* by CORE-01's wording (unlike DEBT-04, which explicitly says "guarded").
   - What's unclear: whether the project's own "documents are now guarded like
     code" ethos (`PROJECT.md:142-151`) implies this should be built anyway, for
     consistency with FORK-01.
   - Recommendation: leave as Claude's/the plan's discretion — build it if the
     verdict is "kept, dated confirmation" (since that is the shape most prone to
     silent future drift, the same argument that motivated
     `docs-fork-decision.test.ts`'s own existence), skip it if the verdict is a
     simple restatement (the new wording itself needs no separate guard, the way
     no other Core Value edit in this project's history has ever had one).

2. **(RESOLVED — 17-03 task 1, backfill included as a low-priority item.)** **Should the two `## Resolution`-less todo closures be backfilled in this
   phase, or left as the minor historical gap they are?**
   - What we know: no guard checks for `## Resolution`'s presence; 5 other older
     completed todos also lack one; this is purely a convention-consistency
     question.
   - What's unclear: whether the milestone audit (`/gsd-audit-milestone`, which
     runs after Phase 17) would flag it as a finding.
   - Recommendation: low-cost, optional — the plan may fold it into the STATE.md
     editing task at near-zero marginal cost, but it is not required for either
     success criterion and should not block phase completion if skipped.

## Sources

### Primary (HIGH confidence — read/run directly this session)

- `.planning/REQUIREMENTS.md` (full file) — requirement text, closure-note conventions, traceability
- `.planning/STATE.md` (full file, both halves) — Deferred Items ledger, Pending Todos narrative, Operator Next Steps
- `.planning/ROADMAP.md` (full file) — Phase 17 goal/criteria, all prior phase closure notes and conventions
- `.planning/PROJECT.md` (full file, both halves) — Core Value text, Key Decisions table, FORK-01/PKG-04 rows
- `src/mcp/vice/docs-deferred-ledger.test.ts` (full file, 180 lines) — read and executed live
- `src/mcp/vice/docs-fork-decision.test.ts` (full file) — read for prior-art guard shape
- `src/mcp/vice/test-gate.mjs` (partial, `MANUAL_ONLY_TESTS` array and surrounding comments)
- `.planning/phases/03-direct-tools/03-HUMAN-UAT.md` (grep for `result:`)
- `.planning/todos/completed/2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json.md` and `.planning/todos/completed/2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md` (full content)
- `.planning/config.json` (full file)
- `.planning/MILESTONES.md` (grep for ledger/count mentions)
- Live command execution: `node --test docs-deferred-ledger.test.ts`, `git show --stat a2835a5`, `git log`, `ls`, `grep` across `.planning/`

### Secondary / Tertiary

None used — every claim in this document is either a direct file read, a live
command execution this session, or explicit reasoning/recommendation clearly
labeled as such. No web search or external documentation lookup was applicable
to this phase's domain (internal planning-document/test-guard closure).

## Metadata

**Confidence breakdown:**
- Ledger mechanics / guard behavior: HIGH — verified by reading the full guard source and running it live against the real tree this session, not inferred
- The true count / arithmetic: HIGH — verified by direct `ls`/`grep` against the real todo directories and STATE.md's own stated accounting rule
- Core Value evidence: HIGH confidence in the *evidence itself* (all cited claims read directly from source); the *verdict* (restate vs. keep) is deliberately left as a judgment call, not a research finding
- Dated-decision prior art: HIGH — FORK-01's row and its guard were read in full
- Files this phase touches / "touches no source" refutation: HIGH — confirmed by a live failing test run, not speculation

**Research date:** 2026-08-23
**Valid until:** This research is tied to the exact state of `.planning/todos/pending/` (0 files) and `docs-deferred-ledger.test.ts`'s current assertions as of commit `a2835a5`/HEAD. If any further todo is filed or closed before this phase's plan executes, re-run `ls .planning/todos/pending/` and the guard before trusting the specific counts above — the *mechanism* described (guard cannot express zero) will remain true regardless of the exact count, but the specific "0" and "2 stale rows" figures could drift.
