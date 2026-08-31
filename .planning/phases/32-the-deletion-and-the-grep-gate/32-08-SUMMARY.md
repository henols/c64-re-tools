---
phase: 32-the-deletion-and-the-grep-gate
plan: 08
subsystem: testing
tags: [guard-fates, registry, mutation-harness, observed-red, non-vacuity, audit, deferred-fates, rename-detection]

requires:
  - phase: 32-01
    provides: "scripts/check-guard-fates.mjs (pre-declared red), scripts/audit-mutation-harness.mjs, the registry and its row schema"
  - phase: 32-06
    provides: "the 15 renamed rows; the `--run` harness caveat and the 15s-timeout caveat"
  - phase: 32-07
    provides: "the 21 same-path rows; the 7-member `gone` list handed over by name; the timeout-measurement method; the audit-gate --json finding"
provides:
  - "25 new rows in guard-fates.json (7 `deleted` + 16 set B + 2 set C), taking the registry from 36 to 61 — one row per derived member, bijection complete"
  - "scripts/check-guard-fates.mjs exits 0 for the first time since it landed: plan 32-01's PRE-DECLARED RED discharged, by satisfaction, with zero rules loosened"
  - "2 further machine-captured observed reds, each behind a green exit-0 unplanted control"
  - "evidence/32-deferred-fates.md — the two set-C fates against their NEW triggers, research assumption A7 resolved, and the rename the derivation cannot express"
  - "evidence/32-fate-guard-green.md — the discharge audit trail ordering constraint 5 exists for"
  - "evidence/32-setb-repointed-rows.md — the harness's verbatim both-leg record for the two set-B reds"
  - "Three findings filed to .planning/WINDOWS.md (29, 30, 31) against instruments this plan is forbidden from modifying"
affects: [32-09, guard-fates-registry, check-guard-fates, block-class, make-coverage-fixtures]

actuals:
  tokens: 40942
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "For a NET-NEW (set-B) member, classify structurally first — it did not exist at the pinned commit, so there is no historical→new migration — then read every subject-naming diff line rather than counting them: comments, assertion message strings and invented fixture tokens are not re-pointings"
    - "When a measured fact and a verdict cannot both be recorded, record the fact on the row and file the inexpressibility as a finding; never adjust the verdict to fit the schema"
    - "Verify a research assumption against the file the CODE names, not the file the plan names — reading only the plan's file here would have shown zero blocks and licensed deleting a load-bearing arm"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-deferred-fates.md
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-fate-guard-green.md
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-setb-repointed-rows.md
  modified:
    - .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json
    - .planning/WINDOWS.md

key-decisions:
  - "Followed the guard's own derivation over the plan's arithmetic throughout (D-01): 7 deleted not 6, 16 set B not 15, 61 rows not 60. The registry header already pinned setBFloor=16/totalFloor=61; the plan's 60 was a planning-time reading."
  - "r2000-upstream-audit.test.ts recorded `deleted` with the measured R091 rename to anno-derivation.test.ts disclosed in full on the row, in evidence section 5 and in the windows ledger — rather than `superseded`, which would collide with the successor's own independently derived set-B row on the duplicate-newSubject check. Every machine-checkable claim the row makes is literally true; the relationship is simply not expressible in the registry as written."
  - "No observedRed on any kept-unchanged row. The plan's task text offers one as optional STRENGTHENING; the committed guard's predicate REJECTS it outright, so following the plan text would have redded the registry. The guard won and the conflict is recorded."
  - "The derivation was NOT modified to resolve the rename blind spot, even though doing so is a strengthening and would have produced exactly the plan's predicted 60. Changing a derivation predicate and two committed floors at the wave that closes the phase is architectural; it is written up as a recommended fix for a plan that owns the guard."
  - "Both set-C members verdict `kept-unchanged`, each removalTrigger stating in terms that its ORIGINAL trigger is already satisfied and is NOT sufficient — the sentence without which the two read as unexplained survivors."

patterns-established:
  - "Pattern 1: diagnose a non-biting plant before replacing it. The module-classification plant failed because a `discharged` entry's `module` field is governed by the discharge-closure relation, not by completeness — the second plant then targeted the exact operand the measured re-pointing had inverted, and both attempts are on the row."
  - "Pattern 2: run audit-gate.mjs in TEXT mode alongside --json. A --json-only health check cannot go non-zero for a structural error (windows 28), so it is a false green by construction."
  - "Pattern 3: prove a red is not a timeout by timing the guard UNPLANTED first and recording the number, then noting structurally that a control which timed out cannot exit 0."

requirements-completed: [CUT-04]

coverage:
  - id: D1
    description: "All 25 remaining audited members have a row: 7 `deleted`, 16 set B, 2 set C — taking the registry to a complete 61-row bijection over the derived set"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "node scripts/check-guard-fates.mjs — `OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)`, exit 0. The guard checks the bijection in BOTH directions, so a missing row and a stranger row both fail."
        status: pass
      - kind: automated
        ref: "registry predicate re-run per row: 7 deleted with newSubject null + resolvable removingCommit + two-sided absence; 16 set-B rows each with a verdict, removalTrigger, creation commit and membership clause; no duplicate historicalPath, no duplicate non-null newSubject"
        status: pass
    human_judgment: false
  - id: D2
    description: "Plan 32-01's pre-declared red is discharged by SATISFACTION rather than by relaxation — no floor lowered, no rule relaxed, no waiver/override/skip flag added"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "git diff --exit-code -- scripts/check-guard-fates.mjs scripts/lib/audit-root.mjs scripts/audit-mutation-harness.mjs → exit 0; git log over check-guard-fates.mjs shows exactly ONE commit (371750e, plan 32-01), so the file that reported green is byte-for-byte the file committed red"
        status: pass
      - kind: automated
        ref: "grep -Eac 'WAIVER|process\\.env\\.[A-Z_]*(SKIP|ALLOW|FORCE)|--skip|--force' scripts/check-guard-fates.mjs → 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The guard is still provably able to go red now that it is green"
    requirement: CUT-04
    verification:
      - kind: unit
        ref: "cd src/mcp/vice && node --test guard-fates.test.ts — 21 tests, 21 pass, 0 fail, exit 0 (1749 ms)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The two genuinely re-aimed set-B guards observed exiting non-zero against their live subjects, each behind a green exit-0 unplanted control, with neither red attributable to the harness's 15s timeout"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "node scripts/audit-mutation-harness.mjs --rows src/mcp/vice/anno-derivation.test.ts,src/mcp/vice/module-classification.test.ts — 2 x OBSERVED RED, 0 UNMEASURABLE, 0 ZERO-EXIT, harness exit 0, `tree: restored byte-identical to the baseline`"
        status: pass
      - kind: automated
        ref: "both guards timed UNPLANTED before any plant was designed: 449 ms and 457 ms against the 15000 ms bound, both terminating on their own; both captured excerpts name a failing assertion by number and source line, neither contains timeout language"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both deferred set-C fates recorded against their NEW triggers, with the original trigger explicitly named as already satisfied and insufficient, and neither re-point performed"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "git diff --exit-code -- src/mcp/vice/fixtures/coverage/ src/mcp/vice/block-class.ts → exit 0; grep -ac 'block.type === \"Code\"' src/mcp/vice/block-class.ts → 1; git ls-files 'src/mcp/vice/fixtures/coverage/*/project.regen2000proj' | wc -l → 12"
        status: pass
      - kind: automated
        ref: "both rows carry the literal clause 'ORIGINAL TRIGGER IS ALREADY SATISFIED AND IS NOT SUFFICIENT'; evidence/32-deferred-fates.md records the shared subject, the measured census and the regen2000-vs-subject-literal gap"
        status: pass
    human_judgment: false
  - id: D6
    description: "Research assumption A7 resolved by measurement, with a correction to the plan's stated location and a second finding about an already-inert arm"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "structural JSON census: all twelve project.regen2000proj carry blocks:[]; the block types live in the sibling store.json — 11 blocks across 6 of 12 directories, \"Code\" x 5 and \"Byte\" x 6, \"Undefined\" x 0"
        status: pass
    human_judgment: true
    rationale: "The census is mechanical, but the JUDGEMENT that block-class.ts:196's already-inert arm should be RECORDED rather than removed — on the grounds that this phase has no build remit — is a scoping call a human should confirm, since the arm is now known to be justified by a condition that does not hold for it."
  - id: D7
    description: "r2000-upstream-audit.test.ts's rename recorded honestly under a `deleted` verdict the registry cannot express otherwise"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "git show --format='' --name-status -M c59fcef → `R091 src/mcp/vice/r2000-upstream-audit.test.ts src/mcp/vice/anno-derivation.test.ts`; successor header states the rename; all five predecessor test names present in the successor today; 207 → 478 line growth measured as the reason end-to-end -M does not score it"
        status: pass
    human_judgment: true
    rationale: "Whether `deleted`-with-full-disclosure is the right call versus halting the phase to strengthen the derivation (which would move SET_B_FLOOR 16→15 and TOTAL_FLOOR 61→60) is a scoping decision outside this plan's remit. The plan forbids modifying the guard; the fix is written up in evidence section 5 and windows 29. A human should confirm the deferral."
  - id: D8
    description: "Every gate green at the closing commit"
    requirement: CUT-04
    verification:
      - kind: automated
        ref: "all seven scripts/check-*.mjs exit 0; audit-gate.mjs exits 0 in TEXT mode AND --json reports allowed=true redGuards=[] structuralErrors=[]; npm run typecheck exit 0; git status --porcelain empty"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && npm run test:automated — 2950 tests, 2943 pass, 1 fail (the pre-existing worktree-only repo-root.test.ts artifact, deferred-items.md section 1)"
        status: fail
    human_judgment: true
    rationale: "The suite is NOT at 0 failures in this worktree, so the plan's must-have as literally written is unmet. The single failure is the known structurally-unsatisfiable-in-a-worktree `.claude` assertion, identical in count to plan 32-07's run and 0-fail in the main checkout. It cannot have contaminated either red. A human should confirm that reading rather than have this plan self-certify it."

duration: 47min
completed: 2026-08-31
status: complete
---

# Phase 32 Plan 08: Complete the Registry and Take the Fate Guard Green Summary

**The 25 remaining audited members recorded — 7 `deleted` with two-sided proofs of absence, 16 net-new set-B guards, and the 2 deferred set-C fates against their NEW triggers — taking `guard-fates.json` to a complete 61-row bijection and `check-guard-fates.mjs` to exit 0 for the first time since it landed, with the guard, the harness and every floor byte-identical to what plan 32-01 committed while it was red.**

## Performance

- **Duration:** 47 min
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)
- **Commits:** 3

## Accomplishments

- **The pre-declared red is discharged.** `node scripts/check-guard-fates.mjs` prints
  `check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)`
  and exits **0**. It has been deliberately red since `371750e`.
- **And discharged by satisfaction, provably.** `scripts/check-guard-fates.mjs` has **exactly one commit
  in its entire history** — plan 32-01's — so the file that reported green is byte-for-byte the file that
  was committed red. Only the registry changed. No floor moved, no rule was relaxed, and the
  hatch grep returns 0.
- **25 rows added**, taking the registry from 36 to **61**: 7 `deleted`, 16 set B, 2 set C.
  No duplicate `historicalPath`, no duplicate non-null `newSubject`.
- **2 more machine-captured observed reds**, each behind a green exit-0 unplanted control, each guard
  timed unplanted first (449 ms / 457 ms against a 15000 ms bound), tree restored byte-identical.
- **Research assumption A7 resolved — and the plan's premise corrected.** The capitalised block-type
  vocabulary is live, but in `store.json`, **not** the `project.regen2000proj` the plan names.
- **A rename the derivation cannot see, found and written down** rather than banked as a clean deletion.
- **Three findings filed** to `.planning/WINDOWS.md` against instruments this plan may not modify.

## Task Commits

1. **Task 1: the 7 deleted rows and the 16 set-B rows** — `34d2d37` (docs)
2. **Task 2: the two deferred fates, against their NEW triggers** — `b3210c5` (docs)
3. **Task 3: discharge the fate guard's pre-declared red** — `9eddb04` (docs)

## The derived counts beat the plan's, again — and the registry already knew

The plan's objective enumerates **6** gone, **15** set B, **60** total. The guard's own derivation,
which `D-01` makes authoritative, reports **7 / 16 / 61** — and the registry header committed by
plan 32-01 already pinned `setBFloor: 16` and `totalFloor: 61`. So the plan's 60 was a planning-time
reading that the floors had already superseded. No floor was touched to reach agreement.

Machine-derived work list, taken from the guard's own `no recorded fate:` output rather than transcribed:

| group | count | plan said |
|---|---:|---:|
| `forwardGone` (set A, no derivable successor) | **7** | 6 |
| set B (net-new, after the adjacency subtraction 22 − 6) | **16** | 15 |
| set C (parsed from ROADMAP.md line 814) | **2** | 2 |
| **total owed** | **25** | 23 |
| registry before / after | 36 → **61** | → 60 |

## The 7 `deleted` rows

Each carries `newSubject: null`, a **two-sided** proof of absence, and a `removingCommit` verified
with `git cat-file -t`. The two-sided part is the point: recording only that the historical path is
gone would leave `deleted` indistinguishable from "renamed and nobody looked" (**T-32-34**), so each
row also records that all three of `nameDescendantCandidates()`'s outputs are absent — the guard's own
predicate re-run, not a second hand-typed list.

| historical path | removing commit | plan |
|---|---|---|
| `r2000-launch.test.ts` | `1d40ad0` | 29-10 |
| `r2000-mcp-client.test.ts` | `1d40ad0` | 29-10 |
| `r2000-project.test.ts` | `1d40ad0` | 29-10 |
| `r2000-session.test.ts` | `1d40ad0` | 29-10 |
| `r2000-symbol-roundtrip.test.ts` | `1d40ad0` | 29-10 |
| **`r2000-upstream-audit.test.ts`** | **`c59fcef`** | **29-05** |
| `r2000-verify.test.ts` | `1d40ad0` | 29-10 |

Each row's note records what the file **used to assert** and, where the coverage was relocated rather
than lost, where it went — `r2000-project.test.ts`'s four input-validator tests, for instance, were
relocated verbatim into `prg-image.test.ts`, which carries its own set-B row.

## The finding that matters most: `r2000-upstream-audit.test.ts` is a rename

Plan 32-07 handed this member over by name expecting `deleted` or `superseded`. Investigating the
removing commit — whose subject is `refactor(29-05): move the four unpaired guard tests` — produced this:

```
$ git show --format="" --name-status -M c59fcef
R091	src/mcp/vice/r2000-upstream-audit.test.ts	src/mcp/vice/anno-derivation.test.ts
```

A 91 %-similarity **rename**, corroborated three ways: the commit subject; the successor's own header
(*"RENAMED from `r2000-upstream-audit.test.ts` by phase 29 plan 29-05. Renamed ONLY"*); and **all five**
predecessor test names surviving verbatim in `anno-derivation.test.ts` today.

**Why the derivation misses it.** Both of `deriveForwardMap()`'s mechanisms fail here — end-to-end
`git diff -M 0394cbc 345d5c4` does not score the pair because the file grew **207 → 478** lines across
two later commits, and the name-descendant predicate swaps the *prefix* while preserving the *stem*,
but here the **stem** changed (`upstream-audit` → `derivation`).

**Why the verdict is still `deleted`.** The successor is independently derived into **set B** and owes
its own row. A `superseded` verdict naming it would make two rows claim the same `newSubject`, which
the registry rejects — and every other verdict is structurally unavailable to the successor's row.
**The relationship is not expressible in the registry as the guard is written.**

So the row records `deleted`, under which every machine-checkable claim is literally true, and its note
carries the finding in full. T-32-34 guards against a rename **nobody looked for**; somebody looked,
found it, measured it and wrote it down. The coverage is neither lost nor unaudited — it lives at
`anno-derivation.test.ts`, whose row is `re-pointed` with a machine-captured red.

**The fix, deferred deliberately.** Give `deriveForwardMap()` a third mechanism: inspect each `gone`
member's removing commit for an `R` entry naming it as source. Mechanical, deterministic, object-store
derived — a **strengthening**, not a relaxation. It would move `SET_B_FLOOR` 16 → 15 and `TOTAL_FLOOR`
61 → 60, which is exactly the arithmetic the plan predicted before the blind spot was found. Not done
here: changing a derivation predicate and two committed floors at the wave that closes the phase is
architectural, and the plan forbids modifying the guard. Filed as windows entry **29**.

## The 16 set-B rows

**Classified structurally first**, which removes most of the judgement: a set-B member did not exist at
`AUDIT_COMMIT`, so no historical→new migration occurred, `newSubject === historicalPath`, and `deleted`
is contradicted by its presence. The only open question is whether a guard born pinned to the deleted
subject was later **re-aimed** off it — measured with
`git diff -U0 <creationCommit> 345d5c4 -- <path>` and then **read**, because the count alone does not
distinguish a re-pointed import from a comment.

**The rule, stated so it is auditable:** a line counts as a re-pointing only where the subject appears
as a **resolved reference** — an import specifier, an imported binding, or the operand of an assertion —
and not in a comment, an assertion's message string, or an **invented** synthetic fixture token.

Reading them mattered. The naive count flags 8 members; only **2** survive the rule:

| member | raw count | what the lines actually are | verdict |
|---|---:|---|---|
| `check-no-regenerator2000.mjs` | 31 | exemption-table entries removed as the files they exempted were deleted | kept-unchanged |
| `module-classification.test.ts` | 14 | mostly invented `r2000-synthetic-*` fixture names — **but two assertion operands were INVERTED** | **re-pointed** |
| `shipped-modules.test.ts` | 9 | `R2000_BIN` inside synthetic source strings driving the comment stripper | kept-unchanged |
| `anno-derivation.test.ts` | 7 | **`import { CURATED_R2000_TOOLS } from "./r2000-tools.ts"` removed**, consumers with it | **re-pointed** |
| `check-no-regenerator2000.d.mts` | 1 | a header cross-reference comment | kept-unchanged |
| `anno-index.test.ts` | 1 | an added import-family entry naming the dead family to **forbid** it | kept-unchanged |
| `anno-seam.test.ts` | 1 | an added rename-note comment | kept-unchanged |
| `anno-store.test.ts` | 1 | an assertion **message** string | kept-unchanged |
| `block-class.test.ts` | 1 | reachability prose inside a message string | kept-unchanged |
| 7 others | 0 | — | kept-unchanged |

**Result: 2 `re-pointed` / 14 `kept-unchanged`** — matching the plan's "expect most to be
`kept-unchanged`". Each row carries a removal trigger grounded in its own header, an existence proof
with its creation commit, and the predicate clause that put it in the set. No row was added for
`scripts/check-skill-cli-invocations.mjs` or `scripts/lib/anno-cli-verbs.d.mts`, and the predicate was
not widened to reach them.

### The two observed reds

| member | plant | guard | red | control |
|---|---|---|---:|---:|
| `anno-derivation.test.ts` | `anno-tools.ts`: `name: "anno_search"` → `"anno_searchZZ"` | `node --test anno-derivation.test.ts` | 1 | 0 |
| `module-classification.test.ts` | `module-classification.ts`: `module: "anno-regbits.json"` → `"r2000-regbits.json"` | `node --test module-classification.test.ts` | 1 | 0 |

Both plants target the guard's **live** subject. The first breaks the manifest-to-surface route so
`derivationVerdict()` reports `anno_searchZZ: classified by NEITHER the manifest NOR the register`
(`not ok 9`, `:451`). The second makes `classificationFor("r2000-regbits.json")` resolve, failing the
exact assertion the measured re-pointing had inverted (`not ok 6`, `:483`).

## Assumption A7 resolved — and why reading the plan's file alone would have been a real mistake

A7 asked whether the fixtures' block types are still spelled `"Code"` / `"Byte"` / `"Undefined"`. The
plan directs the executor to `project.regen2000proj`.

> **All twelve `project.regen2000proj` files carry `"blocks": []`.** Zero blocks, therefore zero
> block-type tokens, in either vocabulary.

The block types live in the sibling **`store.json`** — which is what `block-class.ts:178`'s own comment
says (`fixtures/coverage/**/store.json`). Structural JSON census over those twelve: **11 blocks across
6 of the 12 directories**, spelled **`"Code"` × 5** and **`"Byte"` × 6**.

**A7's substance is confirmed and the trigger stands.** But an executor who read only the file the plan
named, saw `blocks: []`, and concluded the fixtures were already re-spelled would have deleted a
load-bearing arm.

**A second finding fell out of measuring it properly.** Only **one** of the two capitalised arms is
load-bearing: `:195` (`"Code"`) rescues 5 blocks that would otherwise fall through to `data` silently;
`"Undefined"` at `:196` matches **0** committed fixtures and is **already inert** — its stated
justification ("every committed coverage fixture is still spelled in that vocabulary") does not hold
for it. The comment at `:180` also overstates the blast radius: 6 of the 11 blocks already resolve to
`data` by design, so only 5 would change. Recorded, not acted on — deleting a half-inert arm is a change
to a live classifier and this phase has no build remit. Filed as windows entry **30**.

## The two set-C rows

Both `kept-unchanged`, both stating in terms that the **original** trigger is already satisfied and is
**not** sufficient — the sentence without which the two read as unexplained survivors rather than
deliberate ones.

| member | original trigger (fired) | NEW trigger |
|---|---|---|
| `block-class.ts` | the producer's absence — deleted 2026-08-29 | the twelve fixtures being **re-spelled** into the lowercase vocabulary, with the census then observed unchanged |
| `make-coverage-fixtures.mjs` | the analyser's project module being deleted — 2026-08-30 | the frozen writer being **re-pointed** onto the Phase 28 store |

**They share one subject and discharge together.** Re-spelling the fixtures is exactly what
re-deriving them would do, which is what ROADMAP.md means by "one decision taken twice, not two".
Neither can be discharged alone.

**A correction to the mandating note.** ROADMAP.md says the re-point is "Phase 30's work on Phase 30's
evidence". The source has since corrected that forecast in place: `make-coverage-fixtures.mjs:88-92`
records that the phase once named for it "shipped the ACME export oracle and nothing store-native to
re-point onto, so **no phase currently owns** the file this writer would be re-pointed at". The row
records the **condition**, not a phase.

**Why twelve tracked files named after a retired producer survive a path-scanning gate.** The fixture
filename is `project.regen2000proj` — it carries `regen2000`, which is **not** the subject literal the
removal gate composes and scans for. Twelve tracked files sit inside the gate's scope and the gate
correctly reports nothing. Not a gate defect; the limit of a literal-matching gate, and precisely why
these two fates had to be carried by a document-parsed set C.

**No re-point was performed** (T-32-36): `git diff --exit-code -- src/mcp/vice/fixtures/coverage/
src/mcp/vice/block-class.ts` exits 0 and the `block.type === "Code"` arm is still present.

## The registry, complete

| verdict | rows | evidence that verdict owes |
|---|---:|---|
| `re-pointed` | 35 | `newSubject` on the working tree + a non-zero `observedRed` behind a green exit-0 control |
| `kept-unchanged` | 19 | `newSubject === historicalPath`, path present, a `removalTrigger`, and **no** `observedRed` |
| `deleted` | 7 | `newSubject: null`, path absent, a resolvable `removingCommit` |
| **total** | **61** | |

Contributed by plan: 32-01 → 1, 32-06 → 14, 32-07 → 21, **32-08 → 25**.

## Decisions Made

1. **The derivation beat the plan's arithmetic, and the floors had already agreed with the derivation.**
   7 / 16 / 61, taken from `deriveAuditedSet()` and the guard's own `no recorded fate:` work list.
2. **`deleted`-with-full-disclosure over a `superseded` the registry cannot hold.** Every alternative
   was checked structurally and rejected on the record before choosing.
3. **No `observedRed` on any `kept-unchanged` row.** The plan offers one as optional strengthening; the
   guard's predicate rejects it outright, so the plan text would have redded the registry. The guard won.
4. **The derivation was not modified**, even though the fix is a strengthening and would have produced
   the plan's own predicted 60. Architectural, at the closing wave, and forbidden by the plan.
5. **`audit-gate.mjs` run in text mode as well as `--json`**, because windows 28 records that `--json`
   cannot signal a structural error through its exit status.

## Deviations from Plan

### 1. [Rule 3 — Blocking] The `module-classification.test.ts` plant did not bite; cause diagnosed, not guessed

- **Found during:** Task 1, harness run.
- **Issue:** misspelling the `module` field of the `anno-acme-ident.ts` entry returned ZERO-EXIT.
- **Cause:** that entry carries `scope: "discharged"`, and a discharged entry's module is by definition
  *not* expected on disk in the enumeration scope, so neither the completeness nor the no-orphans
  direction applies to it. The relation that governs it is the discharge-closure check, which resolves
  the fate's `to` field — untouched by that plant.
- **Fix:** retargeted onto the exact operand the measured re-pointing inverted —
  `module: "anno-regbits.json"` → `"r2000-regbits.json"`, making `classificationFor("r2000-regbits.json")`
  resolve. Control exit 0, planted exit 1, `not ok 6` at `:483`.
- **Both attempts are recorded on the row.** No guard was weakened and no row reclassified.
- **Committed in:** `34d2d37`.

### 2. [Correction, pre-authorised by the plan] The plan's 6 / 15 / 60 does not reproduce

- The derivation yields 7 / 16 / 61 and the registry header already pinned `setBFloor: 16`,
  `totalFloor: 61`. Reported as measured; no floor edited to make the planning-time reading win.
- **Committed in:** `34d2d37`.

### 3. [Correction] The plan's read-first target for assumption A7 is the wrong file

- The plan names `project.regen2000proj`; the block types live in the sibling `store.json`, as
  `block-class.ts:178` says. Following the plan literally would have shown `blocks: []` and licensed
  deleting a load-bearing arm. Measured both and recorded both.
- **Committed in:** `b3210c5`.

### 4. [Conflict, guard wins] The plan's optional "strengthening `observedRed`" would red the registry

- Task 1's text offers an `observedRed` on `kept-unchanged` rows as optional strengthening. The
  committed guard's predicate **rejects** it: *"verdict `kept-unchanged` owes NO `observedRed`"*.
  None was recorded, and the conflict is stated in every affected row's note. Filed as windows 31.
- **Committed in:** `34d2d37`.

### 5. [Correction] One line citation drifted

- `make-coverage-fixtures.mjs`'s FROZEN PROJECT-FILE WRITER block is `:66-107`, not the plan's `:67-97`.
  The other six citations (`block-class.ts:171/:180/:195`, `make-coverage-fixtures.mjs:43/:121/:943`)
  re-measured and matching.
- **Committed in:** `b3210c5`.

### 6. [Rule 3 — Blocking] `npm ci` required before `tsc` would resolve

- `node_modules` absent in the worktree. Installed from the committed lockfile at `src/mcp/vice`;
  nothing new added. Same as plan 32-07.

---

**Total deviations:** 6 (1 blocking auto-fix routed around without modifying any script, 1 blocking
environment fix, 3 pre-authorised corrections, 1 recorded plan-versus-guard conflict).
**Impact on plan:** No scope creep. Four of the six are findings about the *instruments and the plan's
own premises*, which is what a closing sweep is for. Nothing was weakened, reclassified or exempted.

## Issues Encountered

- **`npm ci` was required** inside the worktree before `tsc` resolved. Committed lockfile only.
- **`test:automated` reports 1 failure**, `repo-root.test.ts`'s `.claude` assertion — structurally
  unsatisfiable in any GSD worktree, 0-fail in the main checkout, `deferred-items.md` §1. Identical
  count to plan 32-07 (2950 / 2943 / 1 / 1). Not caused here, not fixed, not loosened. It cannot have
  contaminated either red: both run a single named test file, neither of which is `repo-root.test.ts`,
  each bracketed by its own green control on the identical command.
- **The broker was confirmed inactive** before any measurement (`systemctl --user is-active` →
  `inactive`, no `vice-broker` process), since a live broker deterministically reds `BACK-05` and would
  have contaminated exactly the evidence this plan exists to produce. Nothing was started or stopped.

## Threat surface

No new network endpoints, auth paths, file-access patterns or trust-boundary schema changes.

- **T-32-33** (green by loosening a rule): the three instruments are byte-identical by
  `git diff --exit-code`; `check-guard-fates.mjs` has one commit in its whole history; the hatch grep
  returns 0; no floor moved.
- **T-32-34** (a `deleted` row that is really a rename): every `deleted` row proves absence of BOTH the
  historical path and all three name-descendant candidates, with a `git cat-file -t`-verified
  `removingCommit`. The one member where a rename *did* exist was found, measured and disclosed rather
  than banked.
- **T-32-35** (a set-C member dropping out silently): set C is parsed by `resolveSetC()`, which requires
  exactly 2 tokens each resolving to exactly 1 tracked path and throws otherwise. Never mirrored into an
  array.
- **T-32-36** (performing a deferred re-point): `git diff --exit-code` over the fixtures and
  `block-class.ts` exits 0; the `"Code"` arm is present; the twelve fixtures are byte-identical.
- **T-32-37** (a strengthening red misread as a contract): moot — the guard rejects `observedRed` on
  `kept-unchanged`, so none exists to misread.
- **T-32-SC**: no packages installed. `npm ci` restored the committed lockfile only.

## Known Stubs

No stub, placeholder or TODO was introduced, and no `<verify>` went unrun — every `<automated>` command
in the plan was re-anchored to this worktree root and executed, with its real output recorded.

**One unmet must-have truth, stated plainly:**

| item | detail |
|---|---|
| `npm run test:automated` exits 0 with 0 failures | **NOT met in a worktree.** 2950 tests, 2943 pass, **1 fail** — `repo-root.test.ts`'s `.claude` assertion, false in every GSD worktree by construction. `deferred-items.md` §1; 0-fail in the main checkout. Not caused, not fixed, not loosened; cannot have contaminated any red. |

**Two of the plan's must-have truths were superseded by measurement, not left unmet:** "All 6 `deleted`
rows" is **7**, and "60 derived members, 60 rows" is **61** — both the guard's own derivation, and both
already encoded in the floors plan 32-01 committed.

**Three findings recorded to `.planning/WINDOWS.md`:**

| id | file | finding |
|---|---|---|
| 29 | `scripts/check-guard-fates.mjs` | the forward map's two mechanisms both miss a stem-changing rename whose successor outgrew git's similarity threshold; recommended third mechanism and its floor consequences |
| 30 | `src/mcp/vice/block-class.ts:196` | the `"Undefined"` arm is already inert — 0 fixture matches — so its recorded justification does not hold for it |
| 31 | `guard-fates.json` | the verdict vocabulary cannot express a set-B re-aiming distinctly, nor a rename whose successor is itself a derived member; and the plan's optional strengthening red is rejected by the guard |

## Next Phase Readiness

**Ready for plan 32-09**, which wires the guard into CI.

- **`scripts/check-guard-fates.mjs` exits 0** on a settled tree, so the ordering constraint is satisfied:
  nothing is wired into CI while red (the `4f048bb` precedent).
- **The registry is a complete 61-row bijection.** Adding, removing or renaming any in-scope file
  between the pinned commits will now red this guard — which is the point.
- **CI will need `fetch-depth: 0`.** The guard's own header says so: `actions/checkout@v4` has no
  `with:` block in this repo's workflow, so the runner's clone is shallow and **neither pinned commit
  exists**. `assertPinnedCommitsPresent()` fails closed with that exact message. This is the single most
  likely way 32-09's CI step goes red on its first run.
- **Use text mode, not `--json`, for any audit-gate health check** (windows 28).
- **Do not re-run the harness with `--all`.** All 35 `re-pointed` rows are measured.
- **`repo-root.test.ts` will fail in 32-09's worktree too.** Attribute it to `deferred-items.md` §1.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-08-31*

## Self-Check: PASSED

All four artifacts exist on disk (`32-08-SUMMARY.md`, `evidence/32-deferred-fates.md`,
`evidence/32-fate-guard-green.md`, `evidence/32-setb-repointed-rows.md`); all three task commits
(`34d2d37`, `b3210c5`, `9eddb04`) resolve in `git log`; the registry holds 61 rows and
`check-guard-fates.mjs` exits 0; `git status --porcelain` is empty; `git diff --diff-filter=D
f84b421..HEAD` reports no deletions; `.planning/STATE.md` and `.planning/ROADMAP.md` are untouched.
