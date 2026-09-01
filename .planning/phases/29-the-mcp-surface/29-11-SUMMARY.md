---
phase: 29-the-mcp-surface
plan: 11
subsystem: planning-record
tags: [record-correction, d-01, traceability, removal-gate, allow-list, phase-narrowing, closing-measurements]

requires:
  - phase: 29-02
    provides: the removal gate, its dated temporary allow-list block, and 29-BASELINE.md's recorded pre-phase failing-file set
  - phase: 29-07
    provides: the dated withdrawal note in PROJECT.md whose wording this plan reuses beside SEAM-02, and the deferred block-type vocabulary guard fate
  - phase: 29-09
    provides: the re-pointing of both skill trees (REPOINT-01/02) and the CUT-05 resolution this plan moves in the traceability table
  - phase: 29-10
    provides: the deletion outcome the edited criteria describe, the carried-forward transcripts Phase 30's note names, and the discharged allow-list
provides:
  - "ROADMAP Phase 29's goal and criterion 2 describe the D-01 deletion outcome, with the ordering that made it safe named rather than assumed"
  - "Phases 30, 31 and 32 narrowed — not renumbered — with every requirement still owned by exactly one phase, cross-checked mechanically"
  - "Ordering constraint 3 restated as an INTRA-phase constraint of Phase 29, with the 4f048bb precedent named — it is why 29-02 ran before 29-10"
  - "MCP-02's and MCP-05's coexistence clauses edited with D-01 cited by id; MCP-05's guard-list sentence untouched per D-13"
  - "The ANNO-14/ANNO-15 withdrawal recorded beside SEAM-02 in PROJECT.md's own wording — one statement in two places"
  - "CUT-04's retention in Phase 32 recorded with its reason in BOTH the roadmap and the requirements record, in agreement"
  - "The removal gate's temporary allow-list is EMPTY and the gate asserts its own emptiness, observed firing under a planted entry"
  - "The phase's closing measurements: failing-file set, wall time, gate scanned-file count and per-class breakdown, and the new floors"
affects: [phase-30, phase-31, phase-32, milestone-v0.7.0-audit]

actuals:
  tokens: 12200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Close a temporary exemption block by ASSERTING its emptiness while KEEPING its per-entry machinery: the assertion makes a quiet re-add impossible, and the retained machinery means a later phase that legitimately re-opens the block must delete the assertion visibly and is then policed from the first entry"
    - "Edit a falsified criterion by QUOTING the clause it replaces and citing the deciding id, so the diff records what was believed as well as what is true — a criterion silently rewritten proves nothing about the judgement that changed"
    - "Cross-check a traceability table against its own stated source (the roadmap's per-phase Requirements lines) MECHANICALLY before committing, rather than asserting agreement in prose"

key-files:
  created:
    - .planning/phases/29-the-mcp-surface/deferred-items.md
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - scripts/check-no-analyser.mjs

key-decisions:
  - "Discretion 5 taken as research recommended: NARROW, do not renumber. Only the rows whose phase actually moved were rewritten."
  - "CUT-01 recorded PARTIAL, not Complete. 29-10's own summary says the ~12.4k-line sizing claim was not measured; marking it Complete would claim a measurement nobody took."
  - "REPOINT-03 left Pending even though 29-09 already rewrote the trigger description substantively — no verification pass has scored the ABS-02 chain since, and a status may not claim more than its evidence. The partial discharge is recorded as a note instead."
  - "The full-glob run EXCLUDED src/mcp/vice/vice-proxy.test.ts under an explicit reserved-file instruction. See Deviations."

patterns-established:
  - "A narrowed phase records what LANDED elsewhere in its notes rather than only dropping the criterion, so the next planner reads a discharge instead of an absence"
  - "A deferred guard fate is named in the phase that will audit it, at the moment it is deferred, so the recorded-fate criterion picks it up instead of it sitting inert"

requirements-completed: [MCP-02, MCP-05, STORE-06]

coverage:
  - id: D1
    description: "ROADMAP Phase 29's goal and criterion 2 describe the deletion outcome, cite D-01 by id, and contain no claim that both families are registered at the phase's close"
    requirement: "MCP-02"
    verification:
      - kind: other
        ref: "grep for 'Both families' / 'nothing yet deleted' in .planning/ROADMAP.md -> 0 hits in the Phase 29 entry"
        status: pass
      - kind: unit
        ref: "8 documentation guards (docs-dangling-refs, docs-deferred-ledger, docs-review-disposition, docs-absorbed-decisions, docs-linerefs, docs-fork-decision, docs-core-value-decision, comment-phase-pointers) -- 57/57"
        status: pass
    human_judgment: true
    rationale: "Whether the replacement criterion describes the OUTCOME rather than a rationalisation of it is a judgement about prose that no test makes."
  - id: D2
    description: "Phases 30-32 narrowed, with every requirement mapping to exactly one phase and the traceability table agreeing with the roadmap's per-phase Requirements lines"
    verification:
      - kind: other
        ref: "mechanical cross-check script: 28 roadmap ids, 28 table ids, 0 mismatches, 0 duplicates in either direction"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ordering constraint 3 restated as an intra-phase constraint of Phase 29 with the 4f048bb precedent named, rather than deleted"
    verification:
      - kind: other
        ref: ".planning/ROADMAP.md Sequencing Rationale constraint 3 names 'INTRA-PHASE', the 29-02-before-29-10 ordering, and 4f048bb"
        status: pass
    human_judgment: true
    rationale: "Whether the restatement preserves the REASON the gate came first, rather than merely relocating a sentence, is an editorial judgement."
  - id: D4
    description: "MCP-02 and MCP-05's falsified clauses edited with D-01 cited; MCP-05's guard-list sentence unchanged"
    requirement: "MCP-05"
    verification:
      - kind: other
        ref: "git diff .planning/REQUIREMENTS.md -- MCP-05's first sentence is byte-identical in the diff; the replaced clause is quoted verbatim inside its replacement"
        status: pass
    human_judgment: false
  - id: D5
    description: "The ANNO-14/ANNO-15 withdrawal appears beside SEAM-02 with both requirement ids, the temporary nature of the loss and Phase 30 as the return condition, matching PROJECT.md"
    verification:
      - kind: other
        ref: "PROJECT.md:140 and .planning/REQUIREMENTS.md SEAM-02 sub-bullet carry the same claims in the same wording; the Phase 30 roadmap note names .planning/phases/29-the-mcp-surface/fixtures/"
        status: pass
    human_judgment: true
    rationale: "Whether a reader comparing the two finds ONE statement rather than two is a judgement about wording, not a diff."
  - id: D6
    description: "The removal gate's temporary allow-list is empty and the gate asserts its own emptiness, non-vacuously"
    verification:
      - kind: manual_procedural
        ref: "planted one entry into the emptied block -> gate exits 1 with the emptiness assertion named -> reverted; git status --porcelain clean (transcript below)"
        status: pass
      - kind: other
        ref: "node scripts/check-no-analyser.mjs -> OK, '0 temporarily allow-listed across 0 entries'"
        status: pass
    human_judgment: false
  - id: D7
    description: "The full-glob failing-file SET is compared against 29-BASELINE.md with every difference named and explained, and no new failing file appears"
    verification:
      - kind: integration
        ref: "121 files / 2733 tests / 0 fail / 48.6 s, broker stopped, run in the background (table below)"
        status: pass
    human_judgment: false

duration: 22 min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 11: The Record Summary

**The planning record now describes what happened rather than what was planned: `D-01`'s falsified coexistence claims are edited with the decision cited by id and the clauses they replace quoted verbatim, Phases 30-32 are narrowed with all 28 requirements still owned by exactly one phase (cross-checked mechanically), the ordering constraint that made an in-phase deletion safe is restated as an intra-phase rule rather than erased, and the removal gate's temporary allow-list is closed with an emptiness assertion observed firing under a plant.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-29T23:14Z
- **Completed:** 2026-08-29T23:36Z
- **Tasks:** 3
- **Files modified:** 4 changed (184 insertions, 65 deletions)

## Task Commits

1. **Task 1: Edit the roadmap — the falsified criterion, the narrowed phases, the restated constraint** — `463373d` (docs)
2. **Task 2: Edit the requirements — the coexistence clauses, the traceability moves, the withdrawal** — `ee759a9` (docs)
3. **Task 3: Close the gate's last temporary entry and run the phase sweep** — `b18038b` (chore)

## Accomplishments

### The falsified criterion is edited, not deleted, and the clause it replaces is quoted

ROADMAP Phase 29's criterion 2 said *"Both families are registered and callable at this phase's close — that is the point of the phase"*. `D-01` superseded that before planning began. The replacement states the outcome — the new family registers and the retired one is deleted in the same phase — **and quotes what it replaces**, cites `D-01` by id, and names the ordering that made deleting inside the registration phase safe rather than leaving it to be inferred: the gate built and observed biting first (29-02), rename-time guards with the `git mv` (29-05), registration-time guards with the registration (29-01), both skill trees re-pointed and proven against the *shipped* copy (29-09), and only then the deletion (29-10).

**The phase GOAL carried the same falsified claim and was edited in the same commit** — it said *"registered proxy-locally beside the family it will replace … and nothing yet deleted"*. Editing the criterion while leaving the goal asserting the opposite two lines above it would have left the record self-contradictory. Recorded as a Rule 2 deviation below.

### Phases 30-32 narrowed, not renumbered — and the mapping is checked, not asserted

Discretion 5 was taken as research recommended. Phase numbers are cited from tracked, guarded files, so a renumber rewrites every traceability row while a narrow rewrites only the rows whose phase actually moved.

Six rows moved into Phase 29 — `REPOINT-01`, `REPOINT-02`, `CUT-01`, `CUT-02`, `CUT-03`, `CUT-05` — **moved, not duplicated**: Phases 31 and 32 no longer name them on their own `**Requirements**:` lines. The table's own claim about itself (*"the mapping is `ROADMAP.md`'s per-phase `**Requirements**:` lines, and this table is the index over them"*) was then verified **mechanically** rather than in prose, by parsing both and comparing:

```
roadmap ids: 28   table ids: 28   mismatches: 0
  Phase 27 : SEAM-01..03                             (3, all Complete)
  Phase 28 : STORE-01..05, STORE-07                  (6, all Complete)
  Phase 29 : MCP-01..05, STORE-06, REPOINT-01/02,
             CUT-01(Partial), CUT-02, CUT-03, CUT-05 (12)
  Phase 30 : EXPORT-01..03                           (3, Pending)
  Phase 31 : REPOINT-03, REPOINT-04                  (2, Pending)
  Phase 32 : CUT-04, CUT-06                          (2, Pending)
OK: every requirement maps to exactly one phase, and table == roadmap
```

The check rejects duplicates in either direction, so "exactly one phase" is enforced rather than eyeballed.

### The ordering constraint is restated, and the restatement carries the reason

Constraint 3 said *"the removal follows the skill re-pointing (31 → 32)"*. `D-01` put both subjects inside Phase 29, so the rule did not stop applying — it changed scale. It is now recorded as an **intra-phase** constraint of Phase 29, naming the wave sequence that satisfied it (gate at wave 1, re-pointing at wave 5, deletion at wave 7) and the **`4f048bb` precedent** it exists against — the milestone closed over an already-red `docs-review-disposition.test.ts` with nothing forcing anyone to notice. **This is why plan 29-02 ran before plan 29-10**, and deleting the constraint would have deleted that reason.

Constraints 2 and 4 now say where their subjects live. Constraint 2 is the interesting one: `anno-launch.ts` is already deleted, so the no-oracle window is **open now**. It is recorded as **honoured rather than broken**, with the mechanism named — `D-02`/`D-14` withdrew `export-asm`, `export-lbl`, `import-lbl` and `gen-enums` with dated notices instead of inventing an export route ahead of the oracle, so *nothing claims anything inside the window*. There is no claim sitting at fixture level because there is no claim.

### The two coexistence clauses, edited with what they said preserved

`MCP-05`'s closing clause — *"Both families coexist at this point, so nothing is deleted to make them pass"* — is replaced by the decision and its consequence, with the original **quoted inside the replacement** so the diff records what was believed as well as what is true. What replaces it is the property that survives without coexistence: every guard moved **in the commit that broke it**, and each was re-proven by a planted violation observed red against its *new* subject and reverted — so no guard was made to pass by deleting what it asserted over.

**`MCP-05`'s first sentence, the one listing the guards, is byte-identical in the diff.** `D-13` records that its wording already anticipated re-pointing rather than deletion and therefore survives `D-01` unedited; the requirement now says so.

`MCP-02` carries the same consequence: its assumption that the body-slice assertion would be an *existing* one still policing a coexisting old family is recorded as superseded, and the assertion is described as it actually was handled — **re-pointed in place** (`BACKEND_SEAM_BYPASS_KEYS`'s second entry renamed, never added to), in the commit that broke it.

### The withdrawal is recorded beside the requirements it affects

`SEAM-02` is the requirement whose text names the symbol round trip as a ✓ Validated capability implemented by `-symbols`. It now carries the withdrawal record: both requirement ids (`ANNO-14`, `ANNO-15`), that this is **a temporary loss of a capability that was genuinely Validated, not a completed one being tidied away**, and that **it returns in Phase 30**. The wording is `PROJECT.md`'s own, deliberately, so a reader comparing the two finds one statement in two places rather than two statements. The corresponding Phase 30 roadmap note names where the carried-forward fixtures live — `.planning/phases/29-the-mcp-surface/fixtures/` — and repeats that they are **the shape to reproduce, not content to assert against**, agreeing with the re-record obligation in the same sentence rather than contradicting it.

### `CUT-04`'s retention is a recorded decision, in two places, in agreement

Left unstated, `CUT-04` would read as an oversight in a Phase 32 reduced to two requirements. It is recorded — in `ROADMAP.md` § Phase 32's notes **and** beside `CUT-04` itself in `REQUIREMENTS.md` — as a **retrospective vacuity audit** whose subject does not exist until the last guard has moved. Phase 29 re-pointed a large guard set (the module floor, the CLI-verb and skill-coverage floors, the manifest-versus-surface non-vacuity relation, the `docs-absorbed-decisions`/`audit-gate.mjs` pair, the fork-honesty assertion, and `spawn-seam.test.ts` onto the emulator spawn seam) and proved each non-vacuous **individually, at the commit that moved it**. What `CUT-04` adds is the mechanical sweep over the whole set **at once, after the dust settles** — a different check, unrunnable before the last guard has moved. Both records name Phase 29 as the source of most of the guards it will audit, so the Phase 32 planner knows the scope **grew**.

### Two deferred guard fates named where they will be picked up

Phase 32's notes now carry the two fates Phase 29 deferred rather than discharged, so its recorded-fate criterion collects them instead of them sitting inert. Both hinge on the same subject — the twelve committed `project.regen2000proj` coverage fixtures — so they are one decision taken twice:

1. **`block-class.ts`'s transitional capitalised block-type arm** (29-07). Its producer is gone but every committed fixture is still spelled in that vocabulary, so deleting the arm today would silently reclassify every fixture block as `data`. Its **new** removal trigger is the fixtures being re-spelled.
2. **`make-coverage-fixtures.mjs` kept its generator and FROZE its writer** (29-10). `synthesizeProject()` was inlined as a module-private byte-identical writer rather than re-pointed onto the Phase 28 store, because re-pointing would re-derive all twelve fixtures and change what the census controls measure. The re-point is Phase 30's work on Phase 30's evidence.

### The allow-list walked, closed, and its closure proven

**The walk found zero entries**, so no entry cited an earlier plan and there was no orphan to halt on. That state was reached the right way: every entry the block ever held was **discharged by the plan that cited it**. None was deleted here for lack of an owner, and **none was converted into a permanent exemption** — the permanent set is unchanged at **157 occurrences across 12 classes**, and the only line in the diff mentioning `EXEMPTION_CLASSES` is a new comment forbidding exactly that conversion.

The block is now closed by an **emptiness assertion**, with the dated header kept as the record of what it was for. The three per-entry assertions below it were **kept on purpose**: they are unreachable only while the block stays empty, so a later phase that legitimately needs a temporary allow-list must delete the emptiness assertion in the commit that re-opens the block — visible and reviewable — and is policed from its first entry. A deleted block would have left nothing to re-open and nothing to police.

**Observed red, then reverted:**

```
$ <plant { path: "src/mcp/vice/anno-coverage.ts", plan: "29-11", count: 2 }>
$ node scripts/check-no-analyser.mjs
check-no-<subject>: FAIL
  - temporary allow-list: the block must be EMPTY (opened 2026-08-29, closed
    2026-08-30 by plan 29-11), but it holds 1 entry: src/mcp/vice/anno-coverage.ts
    (plan 29-11, pinned 2). ...
  - temporary allow-list: src/mcp/vice/anno-coverage.ts is pinned at 2
    occurrence(s) for plan 29-11, got 0. ...
EXIT=1
$ <revert>   ->   node scripts/check-no-analyser.mjs -> OK, EXIT=0
                  git status --porcelain (tracked): clean
```

Both the **new** assertion and the **retained** count assertion fired by name — which is the evidence that the machinery kept below the assertion is live and not decoration.

## Closing measurements (the baseline the next phase inherits)

### Full-glob suite — broker stopped, run in the background

| Metric | Value |
|---|---|
| Files run | **121** (the whole `*.test.*` glob minus one reserved file — see Deviation 1) |
| tests | **2733** |
| pass | **2692** |
| **fail** | **0** |
| skipped | 36 |
| todo | 5 |
| suites | 24 |
| **Wall time** | **48.6 s** real (`4m05 s` user, `46.8 s` sys) — against the baseline's **1578 s** |
| Exit status | **0** |
| Broker running? | **No.** `systemctl --user status vice-broker` → *Unit could not be found*; `ps aux \| grep -E 'vice-broker\|x64sc'` → no matching processes. Nothing needed stopping. |

**The suite TERMINATES on its own** and needed no `kill -TERM` of a blocked child, because the one file that blocks was not in the run.

### Failing-file SET vs `29-BASELINE.md` — every difference named

| File | Baseline | Now | Explanation |
|---|---|---|---|
| `vice-proxy.test.ts` | **41** (lower bound), **HUNG** | **not run** | Excluded by an explicit reserved-file instruction (Deviation 1). It is `MANUAL_ONLY_TESTS` entry 2, documented *"must never be executed"*. Its three stale tool-name assertions and its hang are **unchanged and known**. This is neither a repair nor a regression — it is an **unmeasured member**, stated rather than banked as an improvement. |
| `anno-session.test.ts` | **5** | **gone** | Deleted by plan 29-10. Leaves the set **by construction**, not by repair — `29-BASELINE.md` predicted this and required it be said. |
| `audit-integrity.test.ts` | **2** | **gone** | Left the set at wave 3: 29-05's Rule 2 deviation registered a legitimate unregistered docs guard. Not this plan's doing. |
| `repo-root.test.ts` | — | **absent** | 29-10 saw this appear inside its worktree and predicted it would pass on merge into the main checkout. **Confirmed:** it passes here. The prediction is discharged rather than left open. |

**No name appeared that is not in the baseline.** The failing-file set of the measured 121 files is **empty**.

### `npm run test:automated`

| Metric | Baseline | Now |
|---|---|---|
| tests | 2761 | **2676** |
| pass | 2720 | **2670** |
| **failures** | **7** | **0** |
| skipped | 29 | 1 |
| **Exit status** | **1** | **0** |

The baseline's 7 failures were the same two automated files as the glob (5 + 2), both accounted for above. **`test:automated` now exits 0 on this tree**, which it did not at the phase's open — worth naming because project memory records the opposite as the normal condition.

### The removal gate — scanned-file count and per-class breakdown

```
check-no-<subject>: OK -- scanned 387 files (357 tracked outside ".planning/"
  + 30 shipped-but-untracked installer paths, floor 350);
  157 occurrence(s) permanently exempt, 0 temporarily allow-listed across 0 entries.
```

| Exemption class | Occurrences |
|---|---|
| `gate-self` | 5 |
| `findings-docs` | 47 |
| `attribution-guard-test` | 14 |
| `upstream-audit-manifest-provenance` | 3 |
| `memmap-measurement-provenance` | 1 |
| `enum-name-threat-history` | 1 |
| `census-design-and-incident-records` | 3 |
| `renamed-guard-disciplines` | 5 |
| `surviving-provenance` | 25 |
| `skill-attribution-headers` | 24 |
| `planted-fixtures` | 2 |
| `notices-attribution-blocks` | 27 |
| **Total** | **157** |
| **Temporary allow-list** | **0 across 0 entries — asserted empty** |

For comparison, the pre-phase gate reported **395 files scanned, 118 permanently exempt, 312 temporarily allow-listed across 49 entries**. The temporary column went 312 → **0**, and the permanent column rose 118 → 157 as prose that stays true in the past tense moved to the class that says so.

### The new module and tool-name floors

| Floor | Where | Value | Note |
|---|---|---|---|
| Module floor | `hostpath-consumers.test.ts` — `ANNO_MODULE_FLOOR` | **16** (`15 + 1`) | **Replaces** `ANNO_MODULE_FLOOR = 14`; **16** `anno-*.ts` production modules on disk |
| Skill tool-name floor | `scripts/check-skill-tool-coverage.mjs` | **18** | **Raised** from 10 by 29-09; **18** distinct `anno_*` names extracted from the skill tree, all curated |
| Curated surface | `CURATED_ANNO_TOOLS` | **19** entries | Derived from `ANNO_TOOL_DEFINITIONS`, never a second hand-typed list |
| CLI verb floor | `scripts/lib/anno-cli-verbs.mjs` — `ANNO_CLI_VERB_FLOOR` | **2** | 2/2 parsed verbs resolved by at least one skill file |
| `vice_*` surface | `check-skill-tool-coverage.mjs` | **37** distinct names | Across 33 files / 7 skill dirs; 31 resolved on the stock manifest (38 tools total) |

## Verification

| Check | Result |
|---|---|
| `node scripts/check-no-analyser.mjs` | **OK** — exit 0 |
| `node scripts/check-skill-tool-coverage.mjs` | **OK** — exit 0 |
| `node scripts/check-skill-fork-honesty.mjs` | **OK** — exit 0 |
| `node scripts/check-npm-packages.mjs` | **OK** — exit 0 (`@henols/vice-mcp` 78 files; `@henols/c64-re-tools` 34 files / 7 skills) |
| `node scripts/audit-gate.mjs` | **OK** — exit 0, 9 docs guards green, 7 milestone audits scanned |
| `cd src/mcp/vice && npm run typecheck` | **exit 0** — clean |
| `cd src/mcp/vice && npm run test:automated` | **exit 0** — 2676 tests / 2670 pass / **0 fail** |
| 8 documentation guards (Task 1's automated verify) | **57/57 pass** |
| `docs/tool-support.md` byte-identical | **exit 0** — and proven the strong way: the table was **regenerated** with `generate-tool-support-table.mjs` and `git diff --exit-code` still exits 0, so this is a drift check rather than an unedited-file check |
| Traceability cross-check (roadmap ↔ table) | **28 / 28 / 0 mismatches**, no duplicates either direction |
| Allow-list emptiness assertion, planted | **exit 1, observed by name, reverted** |
| `git status --porcelain` (tracked files) | **empty** |

## Deviations from Plan

### 1. [Instructed scope reduction — orchestrator, pre-execution] `vice-proxy.test.ts` excluded from the full-glob run

- **Found during:** Task 3, at the point the validation contract calls for the full glob.
- **The conflict, stated rather than resolved silently.** Task 3's `<action>` says *"Run the full-glob suite in the background and collect it when it exits"* and its `<human-check>` requires the failing-file set be compared against `29-BASELINE.md`. The orchestrator's dispatch reserves `src/mcp/vice/vice-proxy.test.ts` explicitly: *"do NOT edit its assertions, do NOT add skip gates to it, and do NOT run it"*, and records that the decision about that file belongs to the user. Running the glob unmodified runs that file.
- **Resolution taken:** the glob was run over **121 of 122 files** — the whole `*.test.*` set minus that one path. This is strictly more coverage than `test:automated` (which excludes all nine `MANUAL_ONLY_TESTS`) and it keeps the failing-file **SET** directly comparable to the baseline, which is what `29-BASELINE.md` says to compare. Nothing about the file was edited, skipped, or decided.
- **What is therefore NOT measured:** `vice-proxy.test.ts`'s failure count on this tree. Its membership in the baseline failing set is unchanged and its cause is known and recorded (three stale tool-name assertions, plus a hang for want of a live broker and emulator). It is reported as an **unmeasured member of the set**, not as a pass and not as an improvement.
- **Side effect worth naming:** because that file was excluded, the suite terminated in 48.6 s with no blocked child to `kill -TERM`. That is a property of the exclusion, not of the tree.
- **Files modified:** none — that is the point.

### 2. [Rule 2 — Missing critical correctness] Phase 29's GOAL carried the same falsified clause as criterion 2

- **Found during:** Task 1, reviewing the diff before commit.
- **Issue:** the plan named criterion 2 as the falsified sentence. The phase **goal**, two lines above it, independently asserted *"registered proxy-locally beside the family it will replace … and nothing yet deleted"* — the same claim `D-01` falsified. Editing only the criterion would have left the roadmap self-contradictory inside a single phase entry, which is precisely the prohibition this plan carries.
- **Fix:** the goal rewritten to the outcome, marked **"Widened by `D-01`"** with the superseded wording quoted, and pointed at criterion 2. The milestone phase-list one-liner for Phase 29 was corrected in the same commit for the same reason.
- **Verification:** the 8 documentation guards and `audit-gate.mjs` re-run green after the edit.
- **Committed in:** `463373d`

### 3. [Judgement call — recorded, not a fix] `CUT-01` recorded `Partial`, and `REPOINT-03` left `Pending` despite partial discharge

- **`CUT-01` → `Partial`.** The substance is delivered — zero prefixed files remain, the gate is green tree-wide. But the requirement is worded as a **sizing** claim (~12.4k net lines of a 25,759-line surface) and no plan re-measured that figure. `29-10-SUMMARY.md` says so in its own words. `Complete` would have claimed a measurement nobody took; a fresh census taken by this plan would have been an un-asked-for re-derivation. The row is `Partial` with the reason and the authorising sentence recorded, and a verification pass that re-measures both figures is named as what moves it.
- **`REPOINT-03` stays `Pending`.** 29-09 already rewrote `routine-queue-walker/SKILL.md:3`'s trigger description substantively and re-ran the collision check green, so half the criterion is discharged. It is **recorded as a note** rather than flipped, because no verification pass has scored the `ABS-02` chain's byte-identity across both trees, and per prohibition 28-18 P2 a row moves on a verification verdict rather than an executor's reading. Phase 31 is told what remains (confirm the chain) rather than left to redo work.

### 4. [Out of scope — logged, not fixed] `STORE-03`'s status contradicts its own prose

Discovered by the traceability cross-check. The table row reads `| STORE-03 | Phase 28 | Complete |` while the round-6 verifier's own authorising paragraph below it says *"`STORE-03` STAYS `Gaps Found`"*. **Not this phase's requirement and not this plan's doing** — and per prohibition 28-18 P2, an executor of a different phase editing it on its own reading is exactly the failure that prohibition exists against. Logged to `.planning/phases/29-the-mcp-surface/deferred-items.md` and routed to a Phase 28 verification pass or a milestone audit.

---

**Total deviations:** 1 instructed scope reduction, 1 auto-fixed correctness gap (Rule 2), 1 recorded judgement call, 1 out-of-scope discovery logged.
**Impact on plan:** every acceptance criterion is met except the full-glob run's coverage of one reserved file, which is bounded to one path and reported rather than chased.

## Issues Encountered

- **The reserved-file instruction and the validation contract conflict**, and the conflict is structural rather than incidental: this phase's validation contract requires a full-glob run, and one file in that glob is both reserved and known to hang. The exclusion above is a workaround, not a resolution. **The user's reserved decision about `vice-proxy.test.ts` is what actually resolves it** — until then every future "run the full glob" in this repo hits the same fork.
- **`docs/tool-support.md` byte-identity was proven by regeneration**, not by `git diff` alone. A `git diff --exit-code` on an unedited file proves nothing about drift; running the generator first is what makes the check non-vacuous. Worth carrying forward as the form of that check.

## Known Stubs

None. This plan writes no code paths — its three edits are planning prose, a traceability table and one gate assertion. No hardcoded empty value, placeholder string or unwired component was introduced, and the one new assertion was observed failing before being trusted.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema at a trust boundary was added or changed. The single executable change **narrows** what the tree accepts: the gate now refuses a state (a non-empty temporary allow-list) it previously permitted.

## Threat register outcomes

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-29-46 | mitigate | **Met.** Every falsified criterion and clause edited with `D-01` cited by id and the superseded wording quoted; 8 documentation guards + `audit-gate.mjs` run as acceptance criteria, green. |
| T-29-47 | mitigate | **Met.** Scoped replacements only — every edit applied by an exact-string substitution asserting **exactly one** match, failing loudly otherwise. 14 hunks; the per-phase Progress table and every phase entry outside the edited sections are byte-identical in the diff. |
| T-29-48 | mitigate | **Met.** Block emptied and its emptiness asserted; the assertion observed firing under a planted entry, then reverted. |
| T-29-49 | mitigate | **Met.** Each of the six phase statuses cites the summary evidencing it, in a committed table. `CUT-01` recorded `Partial` rather than flipped, on its own evidence's words. |
| T-29-50 | mitigate | **Met, with one bounded gap.** The failing-file set compared name by name; no new name appeared. The one unmeasured member is named as unmeasured rather than counted as passing. |
| T-29-SC | accept | **Held.** No package was installed by this plan. |

## Prohibition status

The plan's standing prohibition — *"a criterion or clause falsified by an owner decision is edited with the decision cited, never left standing beside the outcome that contradicts it and never silently deleted"* — is **verified, not merely flagged**. Every falsified clause (ROADMAP Phase 29's goal and criterion 2, `MCP-02`, `MCP-05`) carries a `D-01` citation, and each replacement **quotes the wording it supersedes**, so nothing was silently deleted. The one place a criterion was dropped rather than edited — Phase 31's criteria 1-3 and Phase 32's 1-3 — is a **move**, not a deletion: each is recorded as discharged in Phase 29, in both the narrowed phase's notes and the traceability table.

## Next Phase Readiness

- **Phase 29 is ready to close.** All 12 plans executed; typecheck, `test:automated`, all five CI scripts, the documentation guards and the tool-support drift check are green; the removal gate carries no temporary exception.
- **Ready for Phase 30**, which inherits: the carried-forward transcripts at `.planning/phases/29-the-mcp-surface/fixtures/` with a re-record obligation stated in two agreeing places; the withdrawn `ANNO-14`/`ANNO-15` round trip with Phase 30 named as its return condition; the frozen coverage-fixture writer whose re-point is Phase 30's work; and constraint 2's window recorded as honoured-because-nothing-claims rather than as a debt.
- **Ready for Phase 31**, narrowed to `REPOINT-03`/`REPOINT-04`, and told which half of its own criterion 1 already landed.
- **Ready for Phase 32**, narrowed to `CUT-04`/`CUT-06`, with `CUT-04`'s retention reasoned in two agreeing places, the two deferred guard fates named, and its scope explicitly described as having **grown**.
- **One item a human must action:** the reserved decision about `src/mcp/vice/vice-proxy.test.ts` — its three stale tool-name assertions and its hang. It blocks nothing in this phase and it is the last thing standing between this repo and an unqualified full-glob run.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*

## Self-Check: PASSED

Every file this summary names exists on disk — the created `deferred-items.md`,
all three modified files, this summary itself, and both carried-forward fixtures
cited in the Phase 30 note. All three commits (`463373d`, `ee759a9`, `b18038b`)
are present in history above the recorded dispatch base `88d076a`. The three
floor values quoted in the measurements table were re-read from source rather
than copied from a prior summary: `ANNO_MODULE_FLOOR = 15 + 1`,
`ANNO_CLI_VERB_FLOOR = 2`, and `docs-absorbed-decisions.test.ts` present in
`scripts/audit-gate.mjs`'s registry. No claim in this document names a file,
hash or constant that is not there.
