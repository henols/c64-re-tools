---
phase: 30-acme-export-and-the-real-acme-oracle
plan: 06
subsystem: testing
tags: [skills, documentation-drift, guards, acme, export-asm, repoint, installer-twin]

requires:
  - phase: 30-acme-export-and-the-real-acme-oracle
    provides: "plan 30-05's shipped `anno export-asm` CLI verb and its exact printed lines; plan 30-02's re-recorded verify transcripts under this phase's fixtures/; plan 30-01's test-only acme-verify.ts oracle"
  - phase: 29-the-mcp-surface
    provides: "the D-14 verb removals that created the withdrawal notices, `parseAnnoCliVerbs()` in scripts/lib/anno-cli-verbs.mjs, and check-skill-fork-honesty.mjs's pinned `anno export-asm` pointer"
provides:
  - "a documented-status guard: for every verb `parseAnnoCliVerbs()` finds in anno-cli.ts, no markdown in either skill tree may describe it as withdrawn without recording that it came back"
  - "`withdrawalClaimsFor()` — the one predicate the real scan and both planted controls share"
  - "both skill trees discharged (export-asm returned) or re-pointed to an explicit no-owner statement (gen-enums, export-lbl, import-lbl, .d64 extraction)"
  - "shipped module headers and guard-script comments rewritten as narration rather than forecast"
  - "REQUIREMENTS.md / ROADMAP.md / PROJECT.md carrying the same two-halves correction, with the SEAM-02 shared sentence byte-identical across two files"
affects: [phase-30-verification, phase-31, phase-32]

actuals:
  tokens: 18495
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "a documentation guard consumes the parsed verb set rather than a hand-written verb list — a list in a guard is the same defect FLOW-01 recorded, one layer up"
    - "a withdrawal claim is measured per markdown PARAGRAPH and discharged by a past-tense return marker in that same paragraph, so a dated notice can be corrected instead of deleted and still read as clean"
    - "a verb is located in prose by the same `anno <verb>` spelling `verbsMissingFromSkills()` uses, so an ordinary English word that happens to be a verb name (`coverage`) cannot false-positive"
    - "a shared sentence that must stay identical across two planning documents is replaced by ONE substring replace applied to both files, then diffed"

key-files:
  created: []
  modified:
    - src/skills/acme-build/SKILL.md
    - src/skills/c64-program-recon/SKILL.md
    - src/skills/c64-program-recon/references/tool-selection.md
    - src/skills/c64-program-recon/references/reconstruction.md
    - src/skills/c64-memory-mapping/SKILL.md
    - src/mcp/vice/anno-verb-coverage.test.ts
    - src/mcp/vice/anno-symbols.ts
    - src/mcp/vice/anno-enum-gen.ts
    - src/mcp/vice/anno-enum-gen.test.ts
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
    - scripts/check-skill-fork-honesty.mjs
    - scripts/check-skill-tool-coverage.mjs
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md

key-decisions:
  - "The new guard reports a withdrawal claim only when the same markdown paragraph carries NO past-tense return marker. Pure proximity was tried first and is unusable: the honest prose necessarily puts `anno export-asm` five characters from the word `withdrawn` in a capability-table row that records both the withdrawal and the return. Discharge-in-window is the property actually being enforced — a notice must be corrected, never deleted."
  - "The guard locates a verb by the literal `anno <verb>`, the same spelling `verbsMissingFromSkills()` uses. A bare name match would report every paragraph containing the ordinary word `coverage` near an unrelated `withdrawn`."
  - "The test regenerates `installer/skills/` via `installer/scripts/sync-skills.mjs` before scanning, exactly as `check-skill-cli-invocations.mjs` does and for the same REPOINT-02 reason: the shipped tree is gitignored, so a stale or absent copy would silently halve the corpus."
  - "PROJECT.md gained two NEW dated sub-notes rather than only edits. The plan's read_first assumed PROJECT.md already carried withdrawal notes for `export-asm` and `gen-enums`; it did not — only the `.lbl` round trip had one. The record was completed rather than the assumption carried."
  - "The two remaining `Phase 30` mentions in shipped code are past-tense narration and were deliberately left: `acme-verify.test.ts:1010` (\"the one undocumented anywhere in this repo before Phase 30\") and `anno-memmap-render.test.ts:772` (\"boundary (Phase 30 plan 30-03)\")."

patterns-established:
  - "Documented-status guard: bind prose claims to a parsed code surface, never to a curated list, and prove the binding with a positive control and TWO negative controls (a verb the CLI does not dispatch; a paragraph that records the return)."
  - "A line-citation guard (module-classification.ts DIRECTION 9/9b) makes comment edits self-policing: three separate re-pointings were forced by it during this plan, each caught at the commit that caused it."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "Both skill trees say what is true: `anno export-asm` is documented as withdrawn 2026-08-29 and RETURNED 2026-08-31, with its real invocation, and `gen-enums`/`export-lbl`/`import-lbl`/`.d64` extraction are recorded as owned by no phase"
    requirement: "EXPORT-01"
    verification:
      - kind: other
        ref: "grep -rn 'returns in Phase 30\\|return in **Phase 30**\\|Phase 30 concern' src/skills installer/skills == 0 matches"
        status: pass
      - kind: other
        ref: "grep -rn 'no phase currently owns' src/skills installer/skills == 6 matches across 3 files per tree"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-fork-honesty.mjs (the pinned `anno export-asm` literal survives in both acme-build twins, 5 occurrences each)"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-cli-invocations.mjs (18 documented invocations, 3 verbs covered incl. export-asm, every flag/positional/required-flag/value-kind checked)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The skill text never implies the export self-verifies at runtime: the acme-build site states the verb writes source and runs no assembler, quotes the verb's own not-assembled line, and names where the real-ACME verification actually happens"
    requirement: "EXPORT-01"
    verification: []
    human_judgment: true
    rationale: "Whether prose reads as an assembler verdict to a human is exactly the judgment no grep can make. The mechanical half (the verb's own printed lines and its --help block) is already asserted in 30-05's anno-cli.test.ts; what a reader concludes from the SKILL.md paragraph is not."
  - id: D3
    description: "A new guard fails when a verb the CLI dispatches is documented as withdrawn, tied to `parseAnnoCliVerbs()` rather than to a list, with one positive and two negative planted controls"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-verb-coverage.test.ts#a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-verb-coverage.test.ts#planted violation: the same predicate reports a dispatched verb documented as withdrawn, and stays silent for one the CLI does not dispatch"
        status: pass
      - kind: manual_procedural
        ref: "non-vacuity: a withdrawal sentence reinstated in src/skills/acme-build/SKILL.md, guard observed failing and naming BOTH trees, then reverted (transcript below)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every shipped module comment and guard-script comment narrates what happened rather than forecasting what will, and no rewritten comment trips an assignment-shape family"
    verification:
      - kind: unit
        ref: "src/mcp/vice/comment-phase-pointers.test.ts (16 tests, green after every file's rewrite)"
        status: pass
      - kind: other
        ref: "grep -rn 'WHERE THE ROUTE RETURNS: **Phase 30**' src/mcp/vice == 0 matches"
        status: pass
      - kind: other
        ref: "grep -rn 'no phase currently owns' src/mcp/vice scripts == 5 matches"
        status: pass
    human_judgment: false
  - id: D5
    description: "The project record carries the same two-halves correction, with the SEAM-02 shared sentence byte-identical in REQUIREMENTS.md and PROJECT.md and the ROADMAP change confined to one paragraph"
    verification:
      - kind: other
        ref: "python3 extract-and-compare of the shared sentence from both files -> byte-identical, 660 chars each"
        status: pass
      - kind: other
        ref: "git diff --stat .planning/ROADMAP.md == 1 file changed, 1 insertion(+), 1 deletion(-)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-dangling-refs.test.ts + audit-integrity.test.ts + docs-deferred-ledger.test.ts + comment-phase-pointers.test.ts (74 tests, 0 fail)"
        status: pass
    human_judgment: false

duration: 62 min
completed: 2026-08-31
status: complete
---

# Phase 30 Plan 06: Close the statements this phase falsified Summary

**Every in-tree statement that `anno export-asm` was withdrawn-and-returning-in-a-numbered-phase is discharged with its real invocation and its test-only-oracle caveat; every statement that `gen-enums`/`export-lbl`/`import-lbl`/`.d64` extraction returns in that phase is re-pointed to an explicit no-owner note; and a new guard tied to `parseAnnoCliVerbs()` fails when a dispatched verb is documented as withdrawn — observed failing once, naming both skill trees.**

## Performance

- **Duration:** 62 min
- **Started:** 2026-08-31T00:52Z
- **Completed:** 2026-08-31T01:54Z
- **Tasks:** 3
- **Files modified:** 16 tracked (+ 8 gitignored `installer/skills/` twins regenerated)

## Accomplishments

- **Both skill trees say what is true.** The whole-program ACME export route is recorded as withdrawn 2026-08-29 (`D-02`/`D-14`) and **returned 2026-08-31**, with the real invocation quoted from the verb's own synopsis and an explicit statement that it writes source and runs no assembler. The three verbs that did not come back are recorded as owned by no phase, in the file's own voice, with every "what it did, so the rebuild has a specification" paragraph intact.
- **The twin tree moved with the source tree**, produced by `installer/scripts/sync-skills.mjs` and proved to match by `scripts/check-npm-packages.mjs` — it is gitignored yet shipped, so no tracked-file gate can see it (REPOINT-02).
- **A new guard exists and was observed biting.** It consumes the verb set parsed from `anno-cli.ts`'s dispatch switch, scans every `*.md` under both trees, and reports any paragraph that calls a dispatched verb withdrawn without recording its return. One predicate, three controls.
- **Nineteen shipped comments and two guard-script comments now narrate rather than forecast**, and `comment-phase-pointers.test.ts` was run after each file rather than at the end, so every flagged line would have been attributable to the edit that caused it (none were).
- **The project record moved with the tree**, with the SEAM-02 statement byte-identical in two files by construction rather than by proofreading.

## Task Commits

1. **Task 1: both skill trees — discharge what landed, re-point what did not** — `342b656` (docs)
2. **Task 2: shipped module headers, guard scripts, and the guard that would have caught this** — `fad4aae` (test)
3. **Task 3: the project record — REQUIREMENTS.md, ROADMAP.md, PROJECT.md** — `d2135b3` (docs)

## Every site re-pointed, with its old and new wording

### Half A — `anno export-asm` LANDED (discharged, not deleted)

| Site | Old | New |
|---|---|---|
| `acme-build/SKILL.md` § Disassembly | "whole-program static disassembly is WITHDRAWN **and returns in Phase 30** as `anno export-asm`… Nothing in this repository disassembles a whole program today." | "**Dated withdrawal 2026-08-29, dated return 2026-08-31 — both halves are kept…** On **2026-08-31 the route returned**, rebuilt over the annotation store as `anno export-asm`." Plus a fenced live invocation, the two-separate-arguments rule, the `--out`-beside-the-store default, `--force`, the verb's own not-assembled output line, and the test-only oracle statement. |
| `acme-build/SKILL.md` capability table | "**Withdrawn 2026-08-29; returns in Phase 30 as `anno export-asm`** behind a real-ACME byte-diff oracle" | "**`anno export-asm`** — withdrawn 2026-08-29, returned 2026-08-31 behind a real-ACME byte-diff oracle **that is test-only, so the verb writes source and assembles nothing**" |
| `c64-program-recon/SKILL.md` § Static disassembly | "whole-program ACME export is WITHDRAWN **and returns in Phase 30**… Do not reach for `export-asm` here; it does not exist in this phase." | "**Dated withdrawal 2026-08-29, dated return 2026-08-31 — … has come back as `anno export-asm`**", with the same fenced invocation, the argument-independence rule, and a pointer to `acme-build` for the full source-vs-assembly split. |
| `c64-program-recon/SKILL.md` capability table | "**Withdrawn 2026-08-29; returns in Phase 30** as `anno export-asm`…" | "**`anno export-asm`** — withdrawn 2026-08-29, returned 2026-08-31 … test-only, so the verb writes source and assembles nothing" |
| `references/tool-selection.md:33` | "**Withdrawn 2026-08-29; returns in Phase 30** as `anno export-asm`, settled by assembling…" | "**`anno export-asm`** — withdrawn 2026-08-29, returned 2026-08-31, settled by assembling… **That oracle is test-only, so the verb itself writes source and runs no assembler.**" |

**The `anno export-asm` literal survives** where `scripts/check-skill-fork-honesty.mjs` asserts on it: 5 occurrences in `src/skills/acme-build/SKILL.md` and 5 in its twin. That assertion never moved and never had to.

### Half B — `gen-enums` / `export-lbl` / `import-lbl` / `.d64` did NOT land (re-pointed to no owner)

| Site | Old | New |
|---|---|---|
| `c64-program-recon/SKILL.md:223` | "the `.lbl` round trip is WITHDRAWN **and returns in Phase 30**… rebuilding them over the annotation store is **Phase 30**'s work" | "…is WITHDRAWN, and as of 2026-08-31 **no phase currently owns its return**… This notice previously forecast that a numbered phase would rebuild them alongside the ACME export route; that forecast was **wrong and is corrected here rather than deleted**." |
| `c64-program-recon/SKILL.md:247` (`gen-enums`) | "withdrawn on the same terms **and also returns in Phase 30**" | "withdrawn on the same terms, **and no phase currently owns its return either** … that phase's requirements covered the ACME export oracle only" |
| `c64-program-recon/SKILL.md:324` (`.d64`) | "likewise **a Phase 30 concern**; when it returns it will name the file inside the image explicitly" | "a separate capability this repository still does not have, and — correcting an earlier note that assigned it to the same numbered phase as the ACME export oracle — **no phase currently owns it**. Whenever it is built it must name the file inside the image explicitly and refuse rather than guess (D-02)." |
| `c64-memory-mapping/SKILL.md:210` | "that verb is WITHDRAWN from this surface **and returns in Phase 30** as a rebuild over the annotation store" | "that verb is WITHDRAWN from this surface, and **no phase currently owns its return** … the ACME export route did come back on 2026-08-31, but the phase that rebuilt it covered that route only" |
| `references/tool-selection.md:21` | "**withdrawn as of 2026-08-29 and returns in Phase 30**" | "**withdrawn as of 2026-08-29, and no phase currently owns its return** — an earlier forecast naming a numbered phase for it is superseded" |
| `references/reconstruction.md:131` | "withdrawn as of 2026-08-29 **and returns in Phase 30**" | "withdrawn as of 2026-08-29, **and no phase currently owns its return** (an earlier forecast naming a numbered phase for it is superseded: that phase covered the ACME export oracle only)" |

`references/reconstruction.md` was **not** in the plan's `files_modified` and is recorded here as a deviation (below).

### Shipped module headers and guard scripts

| Site | Old | New |
|---|---|---|
| `anno-symbols.ts:40` | "WHERE THE ROUTE RETURNS: **Phase 30**, rebuilt over the Phase 28 annotation store alongside the ACME export oracle." | "WHERE THE ROUTE RETURNS: **NO PHASE CURRENTLY OWNS ITS RETURN**, and the earlier version of this line said otherwise… Half of that happened on 2026-08-31 … the forecast was wrong, and it is CORRECTED here rather than deleted." The `.planning/PROJECT.md` cross-reference and the stock-`x64sc` demonstration record are preserved. |
| `anno-symbols.ts:92` | "Phase 30's rebuilt import route must call it first" | "Any rebuilt import route must call it first … the obligation is on the route, whenever one is built, and is not held by a numbered phase." |
| `anno-symbols.ts:163` | "Phase 30's rebuilt import route is expected to return this shape" | "Because **no phase currently owns** rebuilding that route, this type is its only surviving contract; whenever a route IS built it is expected to return this shape" |
| `anno-symbols.ts:204` | "Phase 30's rebuilt import route calls this FIRST" | "A rebuilt import route — whenever one is built, since **no phase currently owns** writing it — calls this FIRST" |
| `anno-enum-gen.ts:31` | "Phase 30 supplies the rows; the rule does not change." | "Whoever rebuilds the fetch supplies the rows; the rule does not change." |
| `anno-enum-gen.ts:41` | "WHERE THE ROUTE RETURNS: **Phase 30**, which rebuilds the fetch and the install…" | "WHERE THE ROUTE RETURNS: **NO PHASE CURRENTLY OWNS ITS RETURN**, and this line used to say otherwise… Everything above is the specification whoever eventually rebuilds it builds against." |
| `anno-enum-gen.ts:82` | "Phase 30 must re-measure the equivalent discrepancy" | "A rebuilt route must RE-MEASURE the equivalent discrepancy … the obligation belongs to the rebuild, not to a numbered phase." |
| `anno-enum-gen.ts:90` | "goes live again the moment **Phase 30** adds one" | "goes live again the instant **ANY install route is added** — the condition is a route existing, not a phase arriving" |
| `anno-enum-gen.ts:95`, `:114`, `:358`, `:371`, `:392` | "Phase 30's rebuilt installer / rebuilt fetch / needs to know / installer inherits / A Phase 30 installer" | "Any rebuilt installer / A rebuilt fetch / whoever rebuilds the route / any rebuilt installer / A rebuilt installer" |
| `anno-enum-gen.test.ts:35` | "Phase 30 restores the fetch and the installer, and with them the integration coverage." | "Restoring the fetch and the installer … is work **NO PHASE CURRENTLY OWNS**. An earlier version of this line named a numbered phase for it; the phase it named rebuilt the ACME export route only." |
| `anno-enum-gen.test.ts:60` | "the shape Phase 30's rebuilt fetch must still produce" | "the shape any rebuilt fetch must still produce" |
| `anno-enum-gen.test.ts:325` | "goes live again the instant **Phase 30** adds an installer" | "goes live again the instant **ANY installer is added** — the condition is a route existing, not a phase arriving" |
| `module-classification.ts:628` | "a README recording their provenance and **Phase 30's obligation** to RE-RECORD them" | "…and the obligation to RE-RECORD them … **THAT OBLIGATION IS DISCHARGED. Plan 30-02 re-recorded both transcripts** from a real ACME through this project's own verify producer and committed them, with a provenance README and a regeneration program, under `.planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/`; a committed test additionally asserts byte-INEQUALITY against the carried-forward pair." |
| `module-classification.ts:655` | "this note is now the only place the fact lives **until Phase 30 rebuilds the route**." | "This note **WAS** the only place the fact lived; it no longer is. The route was rebuilt on 2026-08-31 — not restored — as `acme-verify.ts`, a TEST-ONLY oracle … That module now holds the discipline in executable form; this note records where it went." |
| `check-skill-fork-honesty.mjs:524` | "it stays present when **Phase 30 restores** the route as a live instruction under exactly that name" | "…was that FUTURE name when it was pinned, on purpose, and **THE PREDICTION HELD**. The route came back on 2026-08-31 … this assertion survived the restoration with no edit at all." |
| `check-skill-fork-honesty.mjs:536` | "once **Phase 30 restores** it, the same string is the live invocation." | "While the route **was** withdrawn that pointer **was** the dated withdrawal notice naming it; since the route returned on 2026-08-31 the same string is the live invocation, which is why this assertion never had to move." |
| `check-skill-tool-coverage.mjs:514` | "Each of the three **returns in Phase 30** as a rebuild over the annotation store" | "An earlier version of this paragraph forecast that all three would come back … That forecast was WRONG and is corrected here rather than deleted: the phase it named rebuilt `export-asm` only … and **no phase currently owns** the return of these three." |
| `make-coverage-fixtures.mjs:80` | "which is **Phase 30's work, on Phase 30's evidence**" | "which is deliberate work, done on its own evidence" |
| `make-coverage-fixtures.mjs:92` | "**PHASE 30 re-points this writer** when the store-native project file lands. Until then it is frozen" | "THIS WRITER IS RE-POINTED WHEN A STORE-NATIVE PROJECT FILE LANDS, AND **NO PHASE CURRENTLY OWNS** LANDING ONE … While no such file exists this writer is FROZEN" |

### The project record

| Site | Old | New |
|---|---|---|
| `REQUIREMENTS.md` SEAM-02 ⚠ block and `PROJECT.md:140` (one sentence, two places) | "**It returns in Phase 30**, rebuilt over the Phase 28 annotation store alongside the ACME export oracle, which is the same route `export-asm` takes for the same reason. Until then, a reader checking whether the symbol round trip works should read this line as: it does not, and the reason is a deliberate sequencing choice rather than a defect." | "**It does NOT return in the phase this note used to name.** That phase rebuilt the ACME export route only — `export-asm` returned on 2026-08-31 behind a real-ACME byte-diff oracle — and no requirement and no success criterion of it covered `export-lbl` or `import-lbl`, so **no phase currently owns the symbol round trip's return**. Until one does, a reader checking whether the symbol round trip works should read this line as: it does not, the reason is a superseded sequencing forecast rather than a defect, and that forecast is corrected here rather than deleted, because deleting the notice would erase the record that a Validated capability went missing." |
| `ROADMAP.md:737` (Phase 31 note) | "Its route was removed in Phase 29 (D-14) and **it returns in Phase 30**, rebuilt over the Phase 28 store alongside the ACME export oracle." | "Its route was removed in Phase 29 (D-14). An earlier version of this note forecast that it would come back alongside the ACME export oracle; the ACME export route did return on 2026-08-31 as `anno export-asm`, but the work that rebuilt it covered that route only, so **no phase currently owns the symbol round trip's return**." |
| `PROJECT.md` R2000-13 (`gen-enums`) | *(no withdrawal note existed)* | New ⚠ sub-note: withdrawn 2026-08-29, heuristics survive in `anno-enum-gen.ts`, **no phase currently owns its return**, by-hand route open. |
| `PROJECT.md` R2000-06 (`export-asm`) | *(no withdrawal note existed; the line still claimed "verified by reassembly")* | New ⚠ sub-note: withdrawn 2026-08-29, **returned 2026-08-31**, real invocation, and "the verb writes source text and runs no assembler … the \"verified by reassembly\" claim above therefore describes the removed route". |

**The shared sentence is byte-identical**, verified by extracting it from both files and comparing: 660 characters each, `True`.

## Per-file line deltas (no withdrawal notice was deleted)

`git diff --numstat` over `src/skills`:

```
51	26	src/skills/acme-build/SKILL.md
7	4	src/skills/c64-memory-mapping/SKILL.md
52	27	src/skills/c64-program-recon/SKILL.md
4	3	src/skills/c64-program-recon/references/reconstruction.md
2	2	src/skills/c64-program-recon/references/tool-selection.md
```

Every file is net **positive** — 116 added against 62 removed. Read by hand: every "what it did, so the rebuild has a specification" paragraph survives, including `c64-memory-mapping`'s account of what `gen-enums` read and printed, `c64-program-recon`'s two `.lbl` traps (USER labels only; neither direction created a store from a raw input) and its three-rule loop discipline, and `acme-build`'s recorded false-pass transcript (`ACME not found in PATH (skipped)` / `All roundtrip verifications passed.` / `EXIT=0`).

## The observed guard failure, pasted as required

A withdrawal sentence naming `anno export-asm` was reinstated in `src/skills/acme-build/SKILL.md`, the guard was run, and it failed naming **both** trees. Reverted immediately with `git checkout -- src/skills/acme-build/SKILL.md` plus a re-sync.

```
not ok 7 - a verb the CLI actually dispatches is never documented as withdrawn, in either skill tree
  error: |-
    src/skills/acme-build/SKILL.md: describes `anno export-asm` as unavailable ("WITHDRAWN") with no
    record that it came back -- a verb the CLI dispatches must not be documented as withdrawn.
    Paragraph: "**NON-VACUITY PROBE, REVERTED IMMEDIATELY — dated withdrawal, 2026-08-29 —
    whole-program static disassembly is WITHDRAWN and returns in a later phase as `anno export-asm`,
    behind a real-ACME byte-diff"
    installer/skills/acme-build/SKILL.md: describes `anno export-asm` as unavailable ("WITHDRAWN") with
    no record that it came back -- a verb the CLI dispatches must not be documented as withdrawn.
    Paragraph: "**NON-VACUITY PROBE, REVERTED IMMEDIATELY — dated withdrawal, 2026-08-29 —
    whole-program static disassembly is WITHDRAWN and returns in a later phase as `anno export-asm`,
    behind a real-ACME byte-diff"
```

That the shipped twin is named alongside the source tree is the REPOINT-02 property being exercised, not a duplicate.

## Why neither existing guard would have caught these statements

Both were read and their scopes recorded, as the plan required:

- **`comment-phase-pointers.test.ts`** scans only **shipped `.ts`/`.mts` comment lines** (`commentPhaseLines()`), for seven assignment-shape families — `verb-first-handoff`, `possessive-plus-noun`, `owner-home`, `is-was-possessive`, `comma-appositive`, `needs-requires`, and `until-phase-present-tense` (with a past-tense exclusion). It reads **no markdown at all**, so a stale "returns in Phase 30" in a `SKILL.md` is outside its corpus by construction. It also matches only `Phase \d+`-shaped hand-offs, so even inside its own corpus the plain narrative sentences repaired here would not all have tripped it.
- **`docs-dangling-refs.test.ts`**'s FLOW-02 is deliberately scoped to **shipped string and template literals** — text a user could see at runtime — and not to comments or markdown. A withdrawal claim in a playbook is invisible to it for the same reason.

The new guard closes exactly that hole, and closes it in the shipped-markdown corpus rather than by widening either existing guard's scope.

## Surviving `Phase 30` mentions in shipped code, read by hand

Two, both past-tense narration and both deliberately left:

- `src/mcp/vice/acme-verify.test.ts:1010` — "…and the one undocumented anywhere in this repo before Phase 30." A statement about what was true *before* this phase.
- `src/mcp/vice/anno-memmap-render.test.ts:772` — "boundary (Phase 30 plan 30-03), so `setComment()` can no longer put one on…" A citation of the plan that made the change.

`grep -rn 'WHERE THE ROUTE RETURNS: \*\*Phase 30\*\*' src/mcp/vice` returns **0**.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one is the guard's discharge rule: a paragraph that records both the withdrawal and the return is clean, because the prohibition in this plan is *never delete a notice* — a guard that reported every co-occurrence of a verb name and the word "withdrawn" would force exactly the deletion the prohibition forbids.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `module-classification.ts` line citations drifted three times as the edits moved their targets**

- **Found during:** Tasks 1 and 2
- **Issue:** `module-classification.test.ts`'s DIRECTION 9 and 9b assert that every `path:NN` citation resolves to a real, non-blank line containing the cited symbol. Task 1's skill-prose rewrite moved `c64-program-recon/SKILL.md`'s cited regions (`306`, `255`); Task 2's comment rewrites moved `anno-enum-gen.ts`'s and `anno-symbols.ts`' import lines twice.
- **Fix:** re-pointed six citations to their measured new lines — `SKILL.md:306→347`, `SKILL.md:255→256`, `anno-enum-gen.ts:106→117`, `anno-enum-gen.ts:105→116`, `anno-enum-gen.ts:109→120`, `anno-symbols.ts:97→107`.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` — 20/20, then 80/80 across the five-file batch.
- **Committed in:** `342b656` (the SKILL.md pair) and `fad4aae` (the four code citations)

**2. [Rule 2 - Missing Critical] Two files carrying the same false statement were outside the plan's `files_modified`**

- **Found during:** Task 1 (a repo-wide grep before editing)
- **Issue:** `src/skills/c64-program-recon/references/reconstruction.md:131` and `scripts/check-skill-tool-coverage.mjs:514` both said the withdrawn verbs return in Phase 30. Both fall inside this plan's own success criterion ("zero `returns in Phase 30` statements survive anywhere in `src/`, `installer/`, `scripts/` or `.planning/`"), and `reconstruction.md` additionally falls inside Task 1's own acceptance grep over `src/skills`. Leaving either would have shipped a false statement while the acceptance criteria read green on the sites the plan happened to enumerate.
- **Fix:** both re-pointed to explicit no-owner statements in their own voice.
- **Files modified:** `src/skills/c64-program-recon/references/reconstruction.md`, `scripts/check-skill-tool-coverage.mjs`
- **Verification:** the repo-wide grep now returns 0; `node scripts/check-skill-tool-coverage.mjs` exits 0.
- **Committed in:** `342b656` and `fad4aae`

**3. [Rule 1 - Bug] `PROJECT.md` did not carry the withdrawal notes the plan assumed it carried**

- **Found during:** Task 3
- **Issue:** Task 3's `read_first` names "the shipped-capability list and its dated withdrawal notes for `export-asm`, `gen-enums`, `export-lbl` and `import-lbl`". Only the `export-lbl`/`import-lbl` note exists. `R2000-06`'s line still claimed the capability was "**verified by reassembly**" — a claim whose route was removed on 2026-08-29 — and `R2000-13`'s line claimed enum generation with no note that `gen-enums` was gone.
- **Fix:** rather than silently skipping the missing sites, two new dated ⚠ sub-notes were added — `gen-enums` (withdrawn, no owner, heuristics survive, by-hand route open) and `export-asm` (withdrawn 2026-08-29, returned 2026-08-31, real invocation, oracle test-only, and an explicit statement that the "verified by reassembly" line above describes the *removed* route).
- **Files modified:** `.planning/PROJECT.md`
- **Verification:** `node --test docs-dangling-refs.test.ts audit-integrity.test.ts docs-deferred-ledger.test.ts comment-phase-pointers.test.ts` — 74/74.
- **Committed in:** `d2135b3`

**4. [Rule 1 - Bug] A stale test title in the file this plan extends**

- **Found during:** Task 2
- **Issue:** `anno-verb-coverage.test.ts`'s first test was still titled "yields exactly the **2** known verbs" while asserting three — a false statement about the verb set, in the very file that owns the verb set.
- **Fix:** title corrected to three.
- **Files modified:** `src/mcp/vice/anno-verb-coverage.test.ts`
- **Verification:** `node --test anno-verb-coverage.test.ts` — 8/8.
- **Committed in:** `fad4aae`

**5. [Design deviation, recorded not auto-fixed] The guard is proximity-plus-discharge, not pure proximity**

- **Found during:** Task 2
- **Issue:** the plan specified "a hit when a verb name appears within a bounded window of a withdrawal-shaped phrase". Applied literally, the honest prose written in Task 1 fails its own guard: the capability-table row reads "**`anno export-asm`** — withdrawn 2026-08-29, returned 2026-08-31", putting the verb five characters from `withdrawn`. Any window large enough to be useful reports it, and the only ways to satisfy a pure-proximity guard are to delete the withdrawal notice (which this plan's prohibitions forbid) or to allowlist the file (which is how a guard stops being read).
- **Fix:** the predicate additionally requires the same paragraph to carry **no past-tense return marker** (`returned`, `RETURNED`, `came back`, `has come back`). The forecast spelling `returns` deliberately does **not** discharge anything, which is why the reinstated original sentence is still caught. Recorded in the predicate's own doc comment along with the reason a fixed character radius was rejected.
- **Files modified:** `src/mcp/vice/anno-verb-coverage.test.ts`
- **Verification:** the non-vacuity observation above, plus two negative controls (a verb the CLI does not dispatch; a paragraph recording the return).
- **Committed in:** `fad4aae`

---

**Total deviations:** 5 (2 blocking/bug auto-fixes, 1 missing-critical, 1 bug, 1 recorded design deviation)
**Impact on plan:** No scope creep. Deviations 1–4 were required to make the plan's own acceptance criteria true rather than locally green; deviation 5 is a documented refinement of a specified mechanism whose literal form was self-contradictory with the plan's own prohibitions.

## Issues Encountered

None beyond the deviations above. The full automated suite ran 0 failures on every pass (2877 tests, 1 skipped, 5 todo), and `npm run typecheck` exits 0.

## Verification results

| Command | Result |
|---|---|
| `cd src/mcp/vice && npm run typecheck` | exit 0 |
| `cd src/mcp/vice && npm run test:automated` | 2877 tests, **0 fail**, 1 skipped, 5 todo |
| `node scripts/check-skill-fork-honesty.mjs` | OK — 11 fork-only mentions, 33 files, 7 dirs; no stale phase-deferral prose |
| `node scripts/check-skill-cli-invocations.mjs` | OK — 18 invocations, 3 verbs (coverage, export-asm, render-memmap), both trees |
| `node scripts/check-skill-description-overlap.mjs` | OK — 21 pairs, max 0.250 vs threshold 0.35 |
| `node scripts/check-skill-tool-coverage.mjs` | OK — anno CLI verbs: 3 parsed, 3/3 resolved |
| `node scripts/check-npm-packages.mjs` | OK — vice-mcp 79 files, c64-re-tools 34 files / 7 skills |
| `node scripts/check-no-regenerator2000.mjs` | OK |
| `cd src/mcp/vice && VICE_REQUIRE_ACME=1 node --test acme-verify.test.ts acme-gate.test.ts anno-export-asm.test.ts skill-acme-build-cli.test.ts anno-cli.test.ts` | 182 tests, **0 fail** — the ACME hard-fail gate green with a real assembler |

**The phase gate `VICE_REQUIRE_ACME=1 npm test` (full glob) is deliberately NOT run here.** The plan schedules it "after this plan merges", and the full glob is recorded in this environment as blocking indefinitely on `vice-proxy.test.ts`. The ACME-gated subset above is the substitute evidence for this plan; the full-glob run belongs to the phase boundary.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 30 is complete: 6 of 6 plans executed. `EXPORT-01`, `EXPORT-02` and `EXPORT-03` are marked Complete in `REQUIREMENTS.md` (the shared-ID gate reports all three ready; the three worktree executors that ran plans 30-03/04/05 could not reach the tool because `gsd-core/` is gitignored and absent inside a worktree, so this main-tree plan closed all three).
- Ready for `/gsd-verify-work 30`, then the Phase 31 planning route.
- **One thing a verifier should look at rather than grep:** deliverable D2 above (`human_judgment: true`) — whether the acme-build prose actually reads, to a human, as "this verb does not verify anything". The mechanical half is asserted; the reading is not.

## Self-Check: PASSED

Files claimed as modified, checked on disk:

```
FOUND: src/mcp/vice/anno-verb-coverage.test.ts
FOUND: src/skills/acme-build/SKILL.md
FOUND: installer/skills/acme-build/SKILL.md
FOUND: .planning/PROJECT.md
```

Commits claimed, checked with `git log --oneline --all`:

```
FOUND: 342b656
FOUND: fad4aae
FOUND: d2135b3
```

All plan-level `<verification>` commands re-run and logged in the table above; all three tasks' `<acceptance_criteria>` re-run after the final edit, with the two greps whose expected value is a count recorded inline (`no phase currently owns`: 6 across both skill trees, 5 across `src/mcp/vice` + `scripts`, 3 across the three planning documents; `returns in Phase 30` family: 0 everywhere).

---
*Phase: 30-acme-export-and-the-real-acme-oracle*
*Completed: 2026-08-31*
