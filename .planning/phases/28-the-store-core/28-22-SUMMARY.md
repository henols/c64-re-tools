---
phase: 28-the-store-core
plan: 22
subsystem: testing
tags: [sqlite, annotation-store, structural-control, disposition-record, requirements-traceability, closing-gate]

requires:
  - phase: 28-the-store-core
    provides: "28-19's remainder gate and round-trip invariant, 28-20's three structural consumption/cleanup controls, 28-21's addScope idempotence + overlap rule and the WR-25 escape-hatch pin, 28-18's `commitStatements()` statement matcher and closing-gate form"
provides:
  - "`commitStatements()` matching the commit STATEMENT inside an `exec()` string literal, anchored at a statement boundary — the semicolon and multi-statement evasions are counted"
  - "a six-spelling positive fixture, a multi-statement fixture with its own count, and an extended 28-18 P1 negative fixture"
  - "`28-REVIEW.md`'s `### Round-5 finding dispositions` — twelve id rows plus two explicit STILL-OPEN rows for the carried-forward human-verification items"
  - "`.planning/REQUIREMENTS.md` at STORE-04 `Complete`, with a round-5 prose record quoting the verifier's own authorising sentences"
  - "the round's closing gate: nine plantings re-observed red and restored on the final tree, both reproductions re-driven through production entry points"
affects: [phase-29-mcp-surface, phase-28-verification-round-6]

actuals:
  tokens: 9433
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A structural matcher over source text matches the STATEMENT inside a literal, never the literal — and the statement-boundary anchor is recorded as load-bearing so a later widening cannot silently re-couple the control to user-facing prose"
    - "A verification report's dispositions are TRANSCRIBED into the phase's own REVIEW.md, because a disposition living only in the report dies with the report's next overwrite"
    - "A requirement row moves only on a verdict already recorded in `*-VERIFICATION.md`, and the sentence that moves it quotes that verdict and names its source file and table"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-seam.test.ts
    - src/mcp/vice/anno-store.ts
    - .planning/phases/28-the-store-core/28-REVIEW.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "WR-19 closed with the review's two-stage sketch: find `exec()` string-literal arguments, then test the literal's CONTENTS against `/(?:^|;)\\s*(?:commit|end(?:\\s+transaction)?)\\s*(?:;|$)/i`. The boundary anchor is what keeps prose uncounted and is documented in the function's own comment as 28-18 P1's mitigation."
  - "The plan's artifacts block anticipated TWO new tests; ONE was added. Its own action text says to WIDEN the three-spelling fixture and to EXTEND the negative fixture, so the semicolon coverage and the bare-identifier/prose coverage landed inside existing controls. The suite therefore grew 209 -> 210, not 211, and the difference is explained rather than rounded."
  - "The disposition table records eight `fix` cells and four `accept` cells. WR-20, WR-23, IN-07 and IN-08 read `accept` because no plan in round 5 touched them and the verifier's own basis for each is quotable — a `fix` cell whose only evidence would be 'the plan says so' was not written."
  - "STORE-04 was the ONLY requirement row that needed moving. STORE-01 and STORE-03 were already at `Gaps Found` / `[ ]` by commit `737f9e7`, so they are recorded as CONFIRMED rather than silently skipped."
  - "Deviation: 28-21's `df619ad` left a shipped string literal naming a phase number, which reddens `docs-dangling-refs.test.ts`'s FLOW-02 control and cascades to `audit-integrity.test.ts`'s D-12-02. Measured red at THIS plan's base commit, so it is 28-21's regression; reworded here because this plan's own acceptance criterion demands 44/44."

patterns-established:
  - "Fixture provenance is RECORDED, not re-established: the six spellings were run against the SQLite builtin out of band and the verifier confirmed the matcher's counts, so the fixture comment cites that provenance instead of importing a database into a file that must not name the builtin."
  - "A widened structural matcher ships with its negative control extended in the same commit, and the negative control's assertion message names the prohibition it protects."

requirements-completed: [STORE-01, STORE-03, STORE-04, STORE-05, STORE-07]

coverage:
  - id: D1
    description: "The commit-statement matcher counts the STATEMENT inside an `exec()` literal, so a trailing semicolon or a neighbouring statement can no longer hide a second commit site (WR-19)."
    requirement: STORE-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the commit-statement matcher counts all six of SQLite's spellings, so neither a synonym nor a trailing semicolon can hide a second commit site"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the commit-statement matcher counts a commit sharing an exec() with a preceding statement, which the whole-literal matcher counted as zero"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the seam contains exactly one commit statement, so the single planted-violation site is unique"
        status: pass
    human_judgment: false
  - id: D2
    description: "The repair constrains no user-facing error prose — the statement-boundary anchor keeps identifiers, an `exec()` taking a bare identifier, and English sentences about a commit all uncounted (28-18 P1)."
    requirement: STORE-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the commit-statement matcher counts neither commit-ish identifiers, nor an exec() taking a bare identifier, nor user-facing prose about a commit (28-18 P1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All twelve round-5 finding ids carry a recorded decision in `28-REVIEW.md`'s own table, where it survives the next overwrite of `28-VERIFICATION.md`."
    verification:
      - kind: integration
        ref: "src/mcp/vice/docs-review-disposition.test.ts#every REVIEW.md finding id anywhere in .planning/phases/ has a recorded disposition (AUDIT-01, self-applied)"
        status: pass
      - kind: other
        ref: "grep -c '^| <id> |' .planning/phases/28-the-store-core/28-REVIEW.md over all twelve ids -> 1 each"
        status: pass
    human_judgment: false
  - id: D4
    description: "STORE-04 reads `Complete` in both the status table and the checkbox list, on the round-5 verifier's own authorising sentences; STORE-01 and STORE-03 confirmed still `Gaps Found` / `[ ]`."
    requirement: STORE-04
    verification:
      - kind: other
        ref: "sed -n '81,87p;214,220p' .planning/REQUIREMENTS.md — six status/checkbox pairs read consistently"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both carried-forward `behavior_unverified` items are on the record as OPEN with unchanged reasons, and neither is promoted."
    verification: []
    human_judgment: true
    rationale: "By construction these are the two items no automation in this repo can construct a precondition for — an `integrity_check` throw needs filesystem- or SQLite-level fault injection, and the host-crash bound needs power-loss injection. Their being OPEN is a judgment about the record, and the round-6 verifier is the reader who must confirm the record is honest."
  - id: D6
    description: "The round's closing gate: the whole anno surface green at a real exit code, nine plantings re-observed red and restored on the final tree, and both reproductions re-driven through production entry points."
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && node --test anno-*.test.ts block-class.test.ts -- # tests 210 / # pass 210 / # fail 0 / # skipped 0, real exit 0"
        status: pass
      - kind: other
        ref: "nine hand plantings, each with its own quoted `not ok` line and an empty `git diff --stat -- src/mcp/vice` after restore"
        status: pass
      - kind: other
        ref: "CR-09 six-line drive and CR-08 byte-length pair, re-driven through production entry points on the final tree"
        status: pass
    human_judgment: false

duration: 32 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 22: The Round's Record and Closing Gate Summary

**A commit-statement matcher that finds the statement inside the `exec()` literal instead of requiring the literal to BE one, twelve round-5 dispositions transcribed into the record that survives, STORE-04 moved up on the verifier's own sentence, and the round closed on nine plantings re-observed red on the final tree.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-08-28T21:20:00Z
- **Completed:** 2026-08-28T21:52:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **WR-19 closed.** `commitStatements()` is two stages: find every `exec()` call whose single argument is a string literal in any of the three quote characters, then test that literal's CONTENTS for a commit statement anchored at a statement boundary. `db.exec("commit;")`, `db.exec("end;")`, `db.exec("COMMIT ;")` and `db.exec("insert into t values (1); commit")` all counted **0** before and are counted now.
- **The 28-18 P1 coupling was not re-introduced.** The statement-boundary anchor is the mechanism, it is named as such in the function's own comment, and the negative control that proves it names 28-18 P1 in its assertion message.
- **All twelve round-5 ids carry a decision in `28-REVIEW.md`'s own table** — eight `fix`, four `accept` — with every `fix` cell naming its plan and quoting a number or a line reference from that plan's SUMMARY.
- **Two explicit STILL-OPEN rows** carry the `behavior_unverified` items forward with unchanged reasons; the host-crash durability bound stays a `backstop` and was NOT promoted.
- **STORE-04 moved to `Complete`** in both the status table and the checkbox list, on the round-5 verifier's own authorising sentences, quoted with their source file and table named.
- **The round closed on numbers:** 210/210 at a real exit 0, `tsc --noEmit` clean, eight named non-vacuity controls re-run individually, nine plantings red-and-restored, both reproductions re-driven.

## Task Commits

1. **Task 1 (RED): failing fixture controls for the semicolon and multi-statement evasions** — `ce41965` (test)
2. **Task 1 (GREEN): match the commit STATEMENT inside an `exec()` literal (WR-19)** — `ba278fd` (test)
3. **Deviation fix: drop the phase number from `anno-store.ts`'s WR-25 doc comment** — `e3d85d9` (fix)
4. **Task 2: the round's record — twelve dispositions, STORE-04 to Complete, two open items carried** — `d463d4c` (docs)

**Task 3 produced no commit of its own**, by design: the plan states its deliverable is measured evidence in the SUMMARY plus "one small addition to `anno-seam.test.ts` only if a check below reveals a missing control". No control was missing, so nothing was added. `git diff --stat -- src/mcp/vice` from the repo root is empty at close.

## Files Created/Modified

- `src/mcp/vice/anno-seam.test.ts` — `commitStatements()` rewritten as a two-stage matcher; `THREE_SPELLINGS_FIXTURE` widened and renamed to `SIX_SPELLINGS_FIXTURE` (composed of `BARE_SPELLING_LINES` and `SEMICOLON_SPELLING_LINES`); `MULTI_STATEMENT_FIXTURE` added; `NO_STATEMENT_FIXTURE` extended; the enclosing test's WR-15 explanation rewritten as WR-15-then-WR-19; one new test.
- `src/mcp/vice/anno-store.ts` — one comment line reworded (deviation, see below). No logic change.
- `.planning/phases/28-the-store-core/28-REVIEW.md` — the `### Round-5 finding dispositions — REQUIRED FROM THE ORCHESTRATOR` placeholder request replaced by the real `### Round-5 finding dispositions` section: twelve id rows plus a two-row STILL-OPEN table. The line-number-drift paragraph that followed the placeholder is preserved unchanged.
- `.planning/REQUIREMENTS.md` — STORE-04 to `Complete` / `[x]`; the three stale round-4 prose record blocks replaced by four round-5 blocks.

---

## Task 1 — WR-19: the matcher, with numbers in both directions

### The three fixture counts, OLD matcher then NEW

The pre-task numbers were obtained by running the OLD matcher — `/\bexec\(\s*(['"`])\s*(?:commit|end(?:\s+transaction)?)\s*\1\s*\)/gi` — over the SAME fixtures, once, before any edit.

| fixture | OLD matcher | NEW matcher |
|---|---|---|
| the three BARE spellings (`db.exec("commit")`, `db.exec('end')`, `db.exec("END TRANSACTION")`) | **3** | **3** |
| the three SEMICOLON spellings (`db.exec("commit;")`, `db.exec('end;')`, `db.exec("COMMIT ;")`) | **0** | **3** |
| the six-spelling fixture (both halves) | **3** | **6** |
| the multi-statement fixture (`db.exec("insert into t values (1); commit")`) | **0** | **1** |
| the negative fixture | **0** | **0** |

28-18's coverage is not regressed (the bare half is 3 both before and after), and the two evasions the round-5 verifier measured are both closed.

### The negative fixture and its 28-18 P1 message

Count: **0**. Its assertion message, quoted verbatim from the source:

> `28-18 P1: identifiers, an exec() taking a bare identifier, and prose must not be counted as commit statements, got ${found.length} -- a matcher that fires on wording makes error prose load-bearing for a control in another file`

The fixture now carries six lines: the three commit-ish identifiers (`commitTransaction`, `applyWriteWithoutCommit`, `doCommit`), an `exec()` whose argument is a bare IDENTIFIER (`db.exec(DDL);` — the real shape in `anno-store.ts`), and TWO user-facing English sentences about a commit.

### The shipped seam

The matcher finds exactly **1** commit statement in `anno-store.ts` on the final tree. Measured directly:

```
count = 1 ["exec(\"commit\")"]
```

### The planting, observed twice — once during Task 1 and once on the final tree

A second, fully working commit site spelled `db.exec("commit;")` was added to `anno-store.ts` by hand.

**The new matcher, `not ok` line quoted verbatim:**

```
not ok 15 - the seam contains exactly one commit statement, so the single planted-violation site is unique
    the seam must contain exactly one commit statement, found 2 -- a second one splits the durability proof's planted violation across two sites and lets half of it survive
```

**The pre-task matcher PASSED the same planting — and that is the finding.** Run over the identical planted file:

```
OLD matcher count over planted anno-store.ts = 1 ["exec(\"commit\")"]
NEW matcher count over planted anno-store.ts = 2 ["exec(\"commit\")","exec(\"commit;\")"]
```

A count of 1 satisfies the control's `assert.equal(found.length, 1)`, so the whole-literal matcher reported `ok` with a second working commit site present.

**After restore:** `git diff --stat -- src/mcp/vice` is empty, and `node --test anno-seam.test.ts` reports `# tests 23 / # pass 23 / # fail 0`.

### Task 1's other acceptance numbers

- `grep -c 'node:sqlite' src/mcp/vice/anno-seam.test.ts`: **18** before, **18** after — unchanged. (An interim draft of the fixture comment spelled the specifier twice and pushed this to 20; the comment was reworded to "the SQLite builtin" before commit. No database import was added.)
- `node --test anno-seam.test.ts anno-durability.test.ts`: pre-task **26** tests (21 seam + 5 durability, derived from the measured 22-test seam file minus this plan's one added test... see the count reconciliation below), post-task `# tests 28 / # pass 28 / # fail 0`, exit **0**.
- `tsc --noEmit -p src/mcp/vice/tsconfig.json`: no output, exit **0**.

### RED before GREEN

The two new/widened controls were written first and observed failing against the unchanged matcher:

```
not ok 16 - the commit-statement matcher counts all six of SQLite's spellings, so neither a synonym nor a trailing semicolon can hide a second commit site
not ok 17 - the commit-statement matcher counts a commit sharing an exec() with a preceding statement, which the whole-literal matcher counted as zero
ok 18 - the commit-statement matcher counts neither commit-ish identifiers, nor an exec() taking a bare identifier, nor user-facing prose about a commit (28-18 P1)
# tests 23 / # pass 21 / # fail 2
```

The negative control was `ok` in RED as well as GREEN, which is correct: it asserts what must NOT change.

---

## Task 2 — the record

### The twelve dispositions, as a table a reader can count without opening the file

| Id | Verdict | Carried by |
|---|---|---|
| CR-09 | `fix` | 28-19 task 1 (`e93ddf0`) |
| WR-18 | `fix` | 28-20 task 3 (`5f3abc0`) |
| WR-19 | `fix` | 28-22 task 1 (`ce41965`, `ba278fd`) |
| WR-20 | `accept` | — |
| WR-21 | `fix` | 28-21 task 1 (`f67917a`, `9d292bb`) |
| WR-22 | `fix` | 28-20 task 1 (`bf08b30`) |
| WR-23 | `accept` | — |
| WR-24 | `fix` | 28-20 task 2 (`7a63c7c`) |
| WR-25 | `fix` | 28-21 tasks 2 and 3 (`df619ad`, `0a44886`) |
| IN-06 | `fix` | 28-19 task 1 (`e93ddf0`) |
| IN-07 | `accept` | — |
| IN-08 | `accept` | — |

Eight `fix`, four `accept`. Verified mechanically: `awk 'NR>=185 && NR<=230' 28-REVIEW.md | grep -cE '^\| (CR\|WR\|IN)-[0-9]+ \|'` → **12**, and each of the twelve ids matches `^| <id> |` exactly once.

### Three `fix` cells quoted in full, as evidence the round-4 form was followed

**CR-09:**

> **`fix`, by 28-19 task 1** (`e93ddf0`). `retype()` gained a remainder shape gate that runs BEFORE the first delete, and the refusal is `AnnoSplitRemainderError extends AnnoRangeShapeError`. Evidence from 28-19-SUMMARY.md, the verifier's own six-line drive re-driven through production entry points only: before the plan the second call returned `{revision:2, changed:true, contradictedComments:[]}` and left `id=3 4101..4111 lo_hi_address` — **span 11, odd**; after it the same call throws `AnnoSplitRemainderError`, `listRanges()` is the unchanged single row `id=1 4096..4111 lo_hi_address bank=null` before AND after, and `currentRevision()` reads **1** before and **1** after. The legal-remainder neighbour still succeeds: `setDataType($1004..$1007, "byte")` returns `changed: true` and three rows. The verifier's severity correction is carried, not dropped: CR-09 falsifies criterion **3**'s stated purpose, not criterion 1. Suite count `169 -> 186`.

**WR-18:**

> **`fix`, by 28-20 task 3** (`5f3abc0`). `rollbackFailed` had exactly ONE reader in the tree and it was a test assertion; it now has two PRODUCTION readers, quoted from 28-20-SUMMARY.md with their line numbers: `anno-store.ts:1193` — `if (swept.deferred) return swept.rollbackFailed;` (`pruneSnapshots`) — and `anno-store.ts:2502` — `reopenNeeded = reconcileSnapshotRing(restored).rollbackFailed;` (`revertTo` step 6). The fact is carried on the handle (`transactionStateUnknown`) so the committed write still reports success and the NEXT call refuses by name, which is what keeps 28-11 P5 intact. `grep -c 'rollbackFailed' src/mcp/vice/anno-store.ts` was **12** at 28-19's tree.

**WR-24:**

> **`fix`, by 28-20 task 2** (`7a63c7c`). `revertTo`'s staging path is now per-ATTEMPT rather than per-(pid, revision), derived from `randomUUID()` — the same primitive `stageSnapshot` uses — and all three cleanups route through `discardSnapshot()`. Numbers from 28-20-SUMMARY.md: `discardSnapshot(staging)` occurrences inside `revertTo`'s body **3**, bare `rmSync(staging` occurrences inside that same body **0**, and several sequential reverts to the same revision leave a `.revert-` residue count of **0**. Observed red as PLANTING D: `not ok 43 - WR-24, STRUCTURAL: revertTo's staging name derives from randomUUID, and all three of its cleanups route through discardSnapshot rather than a bare rmSync`.

### The WR-23 `accept` cell states its fact, and here is the command

The cell asserts, as a fact rather than an implication, that **no plan in round 5 touched `contradictedCommentsFor`**. The command:

```
git diff 9db1e3d..HEAD -- src/mcp/vice/ | grep -c 'contradictedCommentsFor'
```

→ **0**, where `9db1e3d` is `docs(28): record the fifth gap-closure round as planned in STATE.md`, the commit that opened round 5. The verifier's verdict was *"Fix the comment when the function is next touched"*; the function was not next touched, so the condition never arose and the comment is still false and still recorded.

### The two STILL-OPEN rows

**1. `openStore`'s `integrity_check could not be run at all` arm.** Cited BY FUNCTION AND ARM first — the `catch` around `db.prepare("pragma integrity_check").all()` inside `openStore` — because the line reference drifts every round:

| round | cited line |
|---|---|
| round 4 | `anno-store.ts:432` |
| round 5 report | `anno-store.ts:465-468` |
| **re-derived on THIS plan's tree** | **`anno-store.ts:530-535`, the throw at `:534`** |

The drift is visible rather than silent: 28-21 edited `openStore` again (adding the confinement guard and its option), which is what moved the number by another ~65 lines. The reason it is open is unchanged: the arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection. No plan in round 5 constructs that input and none claims to.

**2. 28-17's `backstop`-tagged host-crash durability bound.** Recorded as remaining a `backstop`. **It was NOT promoted**, and the two prohibitions that forbid promoting it are named in the row and here: **28-17 P5** ("MUST NOT make a durability claim whose only evidence is that the code was written down") and **28-18 P3** ("MUST NOT close, silently drop, or re-file as done a carried-forward `behavior_unverified` item"). The round-5 verifier ABSTAINED on it as `insufficient_spec` rather than counting it verified, and this plan's gate did not change that.

### `.planning/REQUIREMENTS.md` — the one row that moved, and the two that were confirmed

| Requirement | Before | After |
|---|---|---|
| STORE-04 status table | `Gaps Found` | **`Complete`** |
| STORE-04 checkbox | `[ ]` | **`[x]`** |

**STORE-01 and STORE-03 needed NO edit, and that is recorded rather than skipped.** Both were confirmed on this plan's own tree, before writing, at exactly the values the plan predicted:

```
- [ ] **STORE-01**: ...        | STORE-01 | Phase 28 | Gaps Found |
- [ ] **STORE-03**: ...        | STORE-03 | Phase 28 | Gaps Found |
```

The round-5 verifier asked for three record moves; two of them (STORE-01 and STORE-03 DOWN to `Gaps Found`) were **already satisfied by commit `737f9e7`**, so only STORE-04's move UP remained. The current tree AGREED with the plan-time measurement — no discrepancy to record.

**All six STORE rows in this phase, status table against checkbox list, asserted as six pairs:**

| Requirement | status table | checkbox | agree? |
|---|---|---|---|
| STORE-01 | `Gaps Found` | `[ ]` | ✓ |
| STORE-02 | `Complete` | `[x]` | ✓ |
| STORE-03 | `Gaps Found` | `[ ]` | ✓ |
| STORE-04 | `Complete` | `[x]` | ✓ |
| STORE-05 | `Complete` | `[x]` | ✓ |
| STORE-07 | `Complete` | `[x]` | ✓ |

### The round-5 prose record quotes the verifier and names its source

The replacement blocks name `.planning/phases/28-the-store-core/28-VERIFICATION.md` and its **Requirements Coverage table** and **Gaps Summary** explicitly, and quote the authorising sentences, including verbatim:

> *"`.planning/REQUIREMENTS.md` records `Gaps Found` with CR-08 as the reason; **CR-08 is closed and that row can move to `Complete`.**"*

and

> *"Per prohibition 28-18 P2 the rows move only on a verification verdict — this is that verdict, and the sentences above are the authorising ones."*

The fourth block states plainly, in its own heading sentence, that **this round is EXECUTED and not VERIFIED, and that STORE-01 and STORE-03 move only when a verification pass says so.**

### The docs guards — a NON-REGRESSION, not a repair

| guard | before this plan | after this plan |
|---|---|---|
| `docs-review-disposition.test.ts` | **7 pass / 0 fail** | **7 pass / 0 fail** |
| `audit-integrity.test.ts` | 43 pass / 1 fail *(28-21's regression, see Deviations)* | **44 pass / 0 fail** |

`docs-review-disposition.test.ts` was **green before this plan as well**, and the plan says so explicitly: the guard treats a phase's own `*-VERIFICATION.md` as a disposition source, so writing the round-5 report — which itself carries a `### Round-5 Finding Dispositions` table — is what dispositioned the twelve ids there. **The transcription into `28-REVIEW.md` is a durability move for the record, not a repair of a guard.** No task in this plan was premised on a red guard and no acceptance criterion took the "make it go from red to green" form (28-22 P1).

`audit-integrity.test.ts`'s one failure was NOT the twelve ids — see Deviations.

### STATE.md and ROADMAP.md untouched by task 2

```
git status --porcelain .planning/STATE.md .planning/ROADMAP.md
```

→ empty.

### No worktree isolation

`workflow.use_worktrees` is `false` for this project and this plan ran on the main working tree; `.git` is a directory, not a file. The `.planning/` paths ARE in the record commit:

```
$ git show --stat HEAD -- .planning
commit d463d4ce13dd62413df6c8fea37cbfd75ea73086
 .planning/REQUIREMENTS.md                       | 12 +++---
 .planning/phases/28-the-store-core/28-REVIEW.md | 50 +++++++++++++++++++------
 2 files changed, 46 insertions(+), 16 deletions(-)
```

---

## Task 3 — the closing gate

### The suite, as uid 1000, with a real exit code

```
$ cd src/mcp/vice && node --test anno-*.test.ts block-class.test.ts
1..210
# tests 210
# suites 0
# pass 210
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 13964.09
PIPELINE_EXIT=0
$ id -u
1000
```

**Count reconciliation — the derived number and the actual number differ by one, and it is explained rather than rounded.**

- 28-21's recorded actual: **209**.
- Derived from the plan's artifacts block (which anticipated 2 new tests): **211**.
- Actual: **210**. Strictly greater than 209 ✓ — which is the clause that must hold unconditionally.
- The difference of **1** is accounted for by exactly one added test name. Measured directly against the base commit:

```
$ git show 9971851:src/mcp/vice/anno-seam.test.ts | grep -c '^test('   -> 22
$ grep -c '^test(' src/mcp/vice/anno-seam.test.ts                      -> 23
```

The single ADDED test is:

> `the commit-statement matcher counts a commit sharing an exec() with a preceding statement, which the whole-literal matcher counted as zero`

The other two changes are a WIDENED control (renamed from "counts all three of SQLite's spellings" to "counts all six…", now asserting the bare half, the semicolon half and the union separately) and an EXTENDED negative control (renamed to name 28-18 P1). That shape follows the plan's own action verbs — *"Widen `THREE_SPELLINGS_FIXTURE` … and rename it"* and *"Extend `NO_STATEMENT_FIXTURE`"* — so the artifacts block's "2" was an overcount of one, not a missing control. Both evasions are asserted with their own expected counts, which is the property the plan asked for.

### The `set -o pipefail` convention change — recorded as deliberate

Every `<automated>` command in **28-19, 28-20, 28-21 and 28-22** now begins `set -o pipefail`. Rounds 1–4 piped `node --test` into `tail`, which makes the command's exit status **`tail`'s** — unconditionally 0. A run emitting `# fail 3` in its captured text still reported success, so the automated verb gated nothing and the real gate lived only in the acceptance criteria's "a REAL exit code of 0", i.e. in executor discipline. This round moves the gate into the harness.

For this task's own `<automated>` command, the two agree:

```
$ set -o pipefail; cd src/mcp/vice && node --test anno-types.test.ts anno-index.test.ts anno-overlap.test.ts \
    anno-store.test.ts anno-seam.test.ts anno-durability.test.ts anno-confinement.test.ts block-class.test.ts 2>&1 | tail -12
# tests 210
# pass 210
# fail 0
# skipped 0
PIPELINE_EXIT=0
```

`# fail 0` and pipeline exit `0` — the same verdict from the text and from the status.

### 28-15's four named non-vacuity controls, re-run INDIVIDUALLY and quoted

**1. `anno-types.test.ts` — the split-orientation control and its collapse planting:**

```
ok 4 - criterion 1's control: the fixture is non-degenerate FIRST, and then a lo_hi_address reading and a hi_lo_address reading of it produce DIFFERING target sets
ok 5 - the collapse planting, observed: a single-orientation implementation makes the control's OWN comparison report the two readings as identical
```

**2. `anno-index.test.ts` — the exhaustive cross-validation with its `comparisons` non-vacuity assertions:**

```
ok 1 - the paint index and an independently written linear scan agree at every one of the 65,536 addresses
ok 2 - the fixture is non-degenerate on the narrowest-wins axis: some address is covered by ranges of DIFFERENT lengths
ok 3 - the fixture is non-degenerate on the tie-break axis: some address is covered by two ranges of EQUAL length
ok 4 - the linear-scan oracle shares no code path with the production paint index
```

**3. `anno-overlap.test.ts` — the fully-contained case and PLANTING A:**

```
ok 7 - case 3 is the LOAD-BEARING case: the fully-contained retype produces exactly THREE rows, asserted field by field
ok 8 - planting A, OBSERVED and SELECTIVE: filter-and-insert loses bytes in exactly the three cases that have a head or a tail, and is indistinguishable from the real path in the other two
ok 9 - why invariant B is not optional, MEASURED: in case 4 the planting satisfies the naive total-unchanged metric while losing 128 addresses
```

**4. the no-splitter structural scan and its non-vacuity companion** (the scan lives in `anno-overlap.test.ts:970`, the companion in `anno-store.test.ts:2044`):

```
ok 26 - adjacency, STRUCTURAL: no coalescing, merging or splitter identifier exists anywhere in the store's code
ok 50 - STORE-02 non-vacuity: the code this gap closure adds is inside the source the no-splitter structural scan reads
```

### THIS ROUND's four new non-vacuity controls, re-run individually and quoted

**1. 28-19's round-trip re-acceptability invariant, with its three counts:**

```
ok 29 - THE ROUND-TRIP INVARIANT: after every write of a deterministic sequence, every row listRanges() returns is re-acceptable at setDataType and decodable by resolveSplitTargets
ok 12 - the LEGAL remainder case on the same split row: an even head and an even tail split into three rows, and every one of them is re-acceptable at setDataType
```

Its three non-vacuity counts, quoted from the source at `anno-overlap.test.ts`:

1. `` `the sequence must actually write: ${accepted} accepted writes, expected at least 8` ``
2. `` `the sequence must actually exercise the refusal path: ${refusals} refusals, expected at least 3` ``
3. `` `the invariant must be asked about split rows: ${finalSplitRows} split rows survive, expected at least 4` ``

plus `assert.equal(finalRows, 13, "the sequence's final row count, pinned so a silently shortened sequence is visible")`.

**2. 28-20's structural consumption controls:**

```
ok 84 - WR-18, STRUCTURAL: pruneSnapshots' return value is BOUND at runWriteSequence's step-9 call site rather than discarded
ok 85 - WR-18, STRUCTURAL: revertTo's step-6 sweep call BINDS its result and acts on it, so a reported rollback failure is not handed back as a clean handle
ok 43 - WR-24, STRUCTURAL: revertTo's staging name derives from randomUUID, and all three of its cleanups route through discardSnapshot rather than a bare rmSync
ok 42 - WR-24, BEHAVIOURAL: several sequential reverts to the SAME revision each succeed and leave ZERO revert-staging residue behind
```

**3. 28-21's escape-hatch pin with its non-vacuity companion:**

```
ok 21 - WR-25 pin: the unconfined escape is used by NO shipped module but the seam, and exactly at its enumerated module-derived opens
ok 22 - WR-25 pin, NON-VACUITY: the scanned shipped module set is real and the seam's stripped source still contains openStore
ok 23 - WR-25: the guard itself exists -- openStore refuses BEHAVIOURALLY when neither a workspaceRoot nor the escape is supplied
```

**4. this plan's task-1 fixture controls, in both directions:**

```
ok 15 - the seam contains exactly one commit statement, so the single planted-violation site is unique
ok 16 - the commit-statement matcher counts all six of SQLite's spellings, so neither a synonym nor a trailing semicolon can hide a second commit site
ok 17 - the commit-statement matcher counts a commit sharing an exec() with a preceding statement, which the whole-literal matcher counted as zero
ok 18 - the commit-statement matcher counts neither commit-ish identifiers, nor an exec() taking a bare identifier, nor user-facing prose about a commit (28-18 P1)
```

### NINE plantings, each a separate hand edit, each re-observed red on the FINAL tree and restored

The arithmetic is checkable against the list: 28-19 one, 28-20 three, 28-21 three, this plan one — **eight from this round** — plus criterion 4's carried one = **nine**. After every restore, `git diff --stat -- src/mcp/vice` from the repo root was empty and the affected file was re-run green.

**Planting 1 — 28-19's PLANTING C** (the remainder gate deleted from `retype()` by hand):

```
not ok 11 - CR-09, PRODUCTION ENTRY POINTS ONLY: typing one byte inside a lo_hi_address table is REFUSED by name, and the refusal costs the store nothing
not ok 18 - split overlap case 3 (new fully INSIDE the split row, ODD tail remainder (the CR-09 drive)) over $1000..$100f lo_hi_address -> REFUSED
not ok 20 - split overlap case 4 (overlap at the LOW end leaving an ODD tail) over $1000..$100f lo_hi_address -> REFUSED
not ok 22 - split overlap case 5 (overlap at the HIGH end leaving an ODD head) over $1000..$100f lo_hi_address -> REFUSED
not ok 29 - THE ROUND-TRIP INVARIANT: after every write of a deterministic sequence, every row listRanges() returns is re-acceptable at setDataType and decodable by resolveSplitTargets
not ok 31 - planting C, SELECTIVE and MEASURED: it can differ from the production path on exactly the three steps whose remainder is illegal, and is indistinguishable on the other eight
# pass 25 / # fail 6
```
Restored → empty diff → `anno-overlap.test.ts` `# tests 31 / # pass 31 / # fail 0`.

**Planting 2 — 28-21's escape-hatch planting** (a FIFTH use of `unconfinedModuleDerivedPath: true` added by hand):

```
not ok 21 - WR-25 pin: the unconfined escape is used by NO shipped module but the seam, and exactly at its enumerated module-derived opens
# pass 22 / # fail 1
```
Restored → empty diff → `anno-seam.test.ts` `# tests 23 / # pass 23 / # fail 0`.

**Planting 3 — 28-21's `addScope` idempotence planting** (the identical-row check deleted by hand):

```
not ok 86 - WR-21: a byte-identical addScope repeat is an accepted NO-OP reporting changed:false, and the scope table still holds exactly one row
# pass 92 / # fail 1
```
Restored → empty diff → `anno-store.test.ts` `# tests 93 / # pass 93 / # fail 0`.

**Planting 4 — 28-21's `addScope` overlap-refusal planting** (the overlap query and its `AnnoRangeShapeError` refusal deleted by hand). This is 28-21's THIRD planting, and the one an earlier draft of the gate's list omitted; without it the round's overlap rule would be seen red nowhere on the final tree. The same edit reddens the partial-overlap sibling, as the plan predicted:

```
not ok 87 - WR-21: a NESTED scope is refused BY NAME with both scopes' ends and the existing scope's id, and the table is unchanged
not ok 88 - WR-21: a PARTIALLY overlapping scope is refused by the same rule and the same class
# pass 91 / # fail 2
```
Restored → empty diff → `anno-store.test.ts` `# tests 93 / # pass 93 / # fail 0`.

**Planting 5 — 28-20's PLANTING D** (one `discardSnapshot(staging)` inside `revertTo`, at `:2352`, put back to a bare `rmSync(staging, { force: true })`):

```
not ok 43 - WR-24, STRUCTURAL: revertTo's staging name derives from randomUUID, and all three of its cleanups route through discardSnapshot rather than a bare rmSync
# pass 92 / # fail 1
```
Restored → empty diff → `anno-store.test.ts` `# tests 93 / # pass 93 / # fail 0`.

**Planting 6 — 28-20's PLANTING E** (`pruneSnapshots`'s return value discarded at `runWriteSequence` step 9, `:1782`):

```
not ok 84 - WR-18, STRUCTURAL: pruneSnapshots' return value is BOUND at runWriteSequence's step-9 call site rather than discarded
# pass 92 / # fail 1
```
Restored → empty diff → `anno-store.test.ts` `# tests 93 / # pass 93 / # fail 0`.

**Planting 7 — 28-20's PLANTING F** (`revertTo` step 6's sweep result unbound, `:2547`):

```
not ok 85 - WR-18, STRUCTURAL: revertTo's step-6 sweep call BINDS its result and acts on it, so a reported rollback failure is not handed back as a clean handle
# pass 92 / # fail 1
```
Restored → empty diff → `anno-store.test.ts` `# tests 93 / # pass 93 / # fail 0`.

**Planting 8 — this plan's synonym planting**, re-applied on the FINAL tree (`db.exec("commit;")` added as a second commit site):

```
not ok 15 - the seam contains exactly one commit statement, so the single planted-violation site is unique
    the seam must contain exactly one commit statement, found 2 -- a second one splits the durability proof's planted violation across two sites and lets half of it survive
# pass 22 / # fail 1
```
Restored → empty diff → `anno-seam.test.ts` `# tests 23 / # pass 23 / # fail 0`.

**Planting 9 — criterion 4's carried planted red** (the module's single commit statement replaced by a comment):

```
not ok 1 - STORE-04, one combined test: a separate OS process mutates the store and SIGKILLs itself with no clean close, a FRESH process reopens the file, the mutation reads back BY VALUE, and revertTo(0) returns the prior value
not ok 2 - STORE-04's planted violation, in the SAME shape and through the SAME helper: with the commit removed, readBackByValue is FALSE and revertReturnsPriorValue is FALSE -- one planting, both halves
not ok 3 - an orphan snapshot file left in the kill window is identified by its revision and does not affect the readback
not ok 5 - CR-06: with a separate OS process holding a READ transaction, the commit REFUSES inside the ViceError family, the revision is unchanged, and the write lock is released
# pass 1 / # fail 4
```
Restored → empty diff → `anno-durability.test.ts` `# tests 5 / # pass 5 / # fail 0`.

**Both the combined test AND its planted-violation sibling report `not ok`** — the pairing criterion 4 requires.

### The CR-09 REPRODUCTION, re-driven on the final tree through production entry points only

No hand edit of the store file. The verifier's own six-line drive, plus its third line:

**BEFORE this round** (measured by the round-5 verifier, quoted):

```
setDataType($1000..$100f, "lo_hi_address")  -> {revision:1, changed:true, contradictedComments:[]}
setDataType($1004..$1004, "byte")           -> {revision:2, changed:true, contradictedComments:[]}
listRanges() ->
  id=2 4096..4099 lo_hi_address bank=null
  id=3 4101..4111 lo_hi_address bank=null    <-- span 11, ODD, a shape the store refuses
  id=4 4100..4100 byte          bank=null
```

**AFTER, on this round's FINAL tree:**

```
line 1  setDataType($1000..$100f, lo_hi_address) -> {"revision":1,"changed":true,"contradictedComments":[]}
        revision: 1
line 2  setDataType($1004..$1004, byte) -> THREW AnnoSplitRemainderError | AnnoSplitRemainderError
        message: typing 4100..4100 ($1004-$1004) would split range id 1 (4096..4111, $1000-$100f, lo_hi_address) and leave a tail
        remainder 4101..4111 ($1005-$100f) of 11 byte(s), which is not a shape this store accepts: a lo_hi_address table needs an
        even byte count, but 4101..4111 is 11 byte(s) -- the low half and the high half must be the same length. The whole retype is
        refused, so nothing was written. The nearest endInclusive values that would leave an even tail are 4099 and 4101;
        alternatively extend the retype to one of the table's own entry boundaries, or retype the whole table to the type you want first.
line 3  listRanges() -> [{"id":1,"start":4096,"endInclusive":4111,"dataType":"lo_hi_address","bank":null}]
        revision: 1
        rows of ODD span carrying a split type: [] count = 0
```

**No row of odd span carrying a split type exists** — measured as a filter over `listRanges()`, count **0**.

**The verifier's third line, re-asserting `$1005..$100f` as `lo_hi_address` — the odd row it targeted does not exist:**

```
line 4  setDataType($1005..$100f, lo_hi_address) -> THREW AnnoRangeShapeError
        message: a lo_hi_address table needs an even byte count, but 4101..4111 is 11 byte(s) -- the low half and the high half
        must be the same length
final   listRanges() -> [{"id":1,"start":4096,"endInclusive":4111,"dataType":"lo_hi_address","bank":null}]
```

The store never held the odd row, so the third line has nothing to re-assert against and is refused at the entry point by shape.

### The CR-08 REPRODUCTION, re-driven on the final tree

Three plans rewrote `anno-store.ts` this round and one of them rewrote `revertTo` itself, so this was re-driven rather than assumed. A store built to revision 3, `r1.db` truncated to 0 bytes, then `revertTo(handle, 1)`:

```
currentRevision after 3 writes: 3
retainedRevisions BEFORE truncation: [0,1,2]
snapshot file located: proj.annostore.snapshots/r1.db
retainedRevisions AFTER truncation: [0,2]
live store byte length: 69632 -> 69632
thrown class: AnnoStoreError | instanceof ViceError: true
same handle still answers currentRevision(): 3
a later openStore succeeds, at revision: 3
```

Every one of round 4's numbers reproduces on the final tree: the byte-length pair **`69632 -> 69632`**, `retainedRevisions()` **`[0,1,2]`** before and **`[0,2]`** after, the thrown class in the `ViceError` family, the caller's handle still alive at revision 3, and a later `openStore` succeeding.

### `tsc --noEmit`

```
$ src/mcp/vice/node_modules/.bin/tsc --noEmit -p src/mcp/vice/tsconfig.json
TSC_EXIT=0
```

No output.

### The six structural invariants, recorded INDIVIDUALLY

**1. `node:sqlite` reachable from exactly one shipped module:**
```
ok 1 - node:sqlite is named by exactly one module of the shipped module set (STORE-07)
```

**2. exactly one commit statement in `anno-store.ts` under the NEW matcher:**
```
count = 1 ["exec(\"commit\")"]
```

**3. `anno-store.ts` and `anno-types.ts` both absent from `hostpath-consumers.test.ts`'s five-element consumer set:**
```
$ grep -c 'anno-store.ts\|anno-types.ts' src/mcp/vice/hostpath-consumers.test.ts  -> 0
$ node --test hostpath-consumers.test.ts  -> # tests 11 / # pass 11 / # fail 0
```

**4. `SCHEMA_VERSION` still 2 and `anno_snapshot` still one column:**
```
anno-types.ts:154:export const SCHEMA_VERSION = 2;

create table anno_snapshot (
  revision integer primary key
);
```

**5. the two root-sensitive controls still declare a REAL `{ skip: ... }`, and the suite reports `# skipped 0` as uid 1000:**
```
anno-store.test.ts:3489:    skip: process.getuid?.() === 0 ? "running as root: root ignores directory mode bits, so an unreadable ring directory is not constructible and this case would pass vacuously" : false,
anno-store.test.ts:3563:    skip: process.getuid?.() === 0 ? "running as root: ... " : false,
```
Both are declaration-option skips (28-17's WR-14 shape), conditional on a real `getuid()` read. As uid **1000** the condition is false, so neither skips and the whole-suite line reads `# skipped 0` — a control that CAN skip and did not, which is the property 28-17 P4 asks for.

**6. no test in the round's diff asserts stderr is empty:**
```
$ git diff 9db1e3d..HEAD -- 'src/mcp/vice/*.test.ts' | grep -cE '^\+.*stderr'  -> 0
```

### `anno-confinement.test.ts`, re-run individually one last time

28-21 changed `openStore`'s entry conditions, so this was the round's last chance to catch a quietly broadened refusal (28-09 P1, 28-12 P2):

```
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 354.34
```

**15 cases, all green.** The "one declared skip" is `anno-confinement.test.ts:578` — a `skip:` declaration option carrying its own reason (*"running as root: root ignores directory mode bits, so a 0o000 ancestor still stats successfully and the EACCES class cannot be planted -- this case would pass vacuously"*). As uid 1000 it evaluates to `false`, so the case RUNS rather than skipping, which is why the file reports `# skipped 0` and 15 passes rather than 14 plus a skip.

### The two docs guards — recorded non-regression

```
docs-review-disposition.test.ts -> # tests 7  / # pass 7  / # fail 0
audit-integrity.test.ts         -> # tests 44 / # pass 44 / # fail 0
```

Both were green **before this round as well**, for the reason the round-5 report itself corrects about the round-4 report: the guard treats a phase's own `*-VERIFICATION.md` as a disposition source. This is a recorded non-regression, not a repair.

### Deliberately NOT done here

The full-glob suite (outlives the tool timeout, unrelated failure baseline); `anno-session.test.ts`'s 5 `AnnoSpawnError: The external analyser was not found on PATH` failures and `scripts/audit-gate.mjs:198`'s all-or-nothing attribution (both recorded pre-existing by the round-5 verifier); `.planning/STATE.md` and `.planning/ROADMAP.md` (untouched by tasks 1–3; updated only in this plan's own close-out step, which is this executor's sequential-mode responsibility and is NOT a task deliverable); and any work on WR-20, WR-23, IN-07 or IN-08, which are accept-only for this round.

---

## Executor self-assertions

These are self-assertions rather than a human checkpoint because this plan is `autonomous: true` and the phase's `human_verify_mode` is `end-of-phase`, so the human gate for the round sits at the phase boundary.

**1. Criterion 4's planted red WAS re-observed on the final tree and reverted.** Evidence: the four `not ok` lines under Planting 9 above, including both `not ok 1 - STORE-04, one combined test: …` and `not ok 2 - STORE-04's planted violation, in the SAME shape and through the SAME helper: …`. After restore, `git diff --stat -- src/mcp/vice` printed nothing at exit 0 (run from the repo root, not from inside `src/mcp/vice` — the measuring trap 28-20 recorded) and `anno-durability.test.ts` reported `# tests 5 / # pass 5 / # fail 0`.

**2. The CR-09 reproduction WAS re-driven on the final tree through production entry points and no longer produces an odd split row.** Evidence: the second call now returns nothing — it THROWS `AnnoSplitRemainderError` — and `listRanges()` returns the single unchanged row `[{"id":1,"start":4096,"endInclusive":4111,"dataType":"lo_hi_address","bank":null}]`, with `currentRevision()` at 1 before and 1 after. The odd-span-split-type filter over `listRanges()` counts **0**.

**3. The CR-08 reproduction WAS re-driven and is still a refusal.** Evidence: the byte-length pair **`69632 -> 69632`**, `AnnoStoreError` with `instanceof ViceError: true`, the same handle answering `currentRevision()` = 3, `retainedRevisions()` `[0,1,2]` → `[0,2]`, and a later `openStore` succeeding at revision 3.

**4. BOTH `behavior_unverified` items remain OPEN, were NOT claimed closed by this round, and their reasons are unchanged.** Evidence: the two STILL-OPEN rows added to `28-REVIEW.md`'s round-5 disposition section. The `integrity_check` arm's reason is quoted unchanged from round 4 and round 5 (defensive, no reachable input without fault injection), and its location is cited by function and arm with the re-derived `anno-store.ts:530-535` alongside round 5's `:465-468` and round 4's `:432`. The host-crash bound stays a `backstop`, was NOT promoted, and the two prohibitions forbidding promotion — **28-17 P5** and **28-18 P3** — are named in the row and in this SUMMARY.

---

## Decisions Made

- **The review's fix sketch was adopted verbatim in shape.** `COMMIT_STATEMENT_RE = /(?:^|;)\s*(?:commit|end(?:\s+transaction)?)\s*(?:;|$)/i` over `matchAll(/\bexec\(\s*(['"`])([\s\S]*?)\1\s*\)/g)`. The vocabulary stays SQLite's three spellings and stays case-insensitive.
- **The widened fixture is composed of two named halves** (`BARE_SPELLING_LINES`, `SEMICOLON_SPELLING_LINES`) rather than one flat six-line string, so the test asserts **3**, **3** and **6** separately. A single total would let the bare half absorb a regression in the semicolon half — the same reason the plan gave for keeping the multi-statement fixture separate.
- **The multi-statement fixture is its own named control with its own expected count**, because a trailing semicolon and a neighbouring statement are two different evasions.
- **`grep -c 'node:sqlite'` was held at 18** by rewording the fixture provenance comment to say "the SQLite builtin". The acceptance criterion is literal, and the file's specifier count is not a place to add noise.
- **The `accept` cells state a basis, never a shrug.** IN-07's basis is that the observed behaviour already names the offending enum; IN-08's is that the colliding `id` is not producible through any store entry point because ids come from SQLite's `rowid`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 28-21 left a shipped string literal naming a phase number, reddening `docs-dangling-refs.test.ts` and cascading to `audit-integrity.test.ts`**

- **Found during:** Task 2, running the plan's `<automated>` verify (`node --test docs-review-disposition.test.ts audit-integrity.test.ts`), which returned `# pass 50 / # fail 1`, exit 1.
- **Issue:** `audit-integrity.test.ts`'s `not ok 4 - no milestone audit declares a gated status while any docs guard is red (D-12-02)` listed all seven docs guards as red — `scripts/audit-gate.mjs:198`'s all-or-nothing attribution. Running the seven individually isolated the real one: `docs-dangling-refs.test.ts` at `# pass 7 / # fail 1`, on `not ok 5 - no shipped src/mcp/vice/ string literal names a phase number (FLOW-02)`. The offending literal is in `anno-store.ts`'s WR-25 doc paragraph: *"two of phase 28's blockers were confinement escapes"*. D-11.1-01: a phase is a planning artifact, never a durable user-facing remediation path.
- **Attribution, measured rather than assumed:** `git log -S"two of phase 28's blockers" -- src/mcp/vice/anno-store.ts` → **`df619ad`**, 28-21 task 2. The guard was then run against this plan's own base commit `ba278fd` with the working tree clean, and reported `# pass 7 / # fail 1` there too. **It is 28-21's regression, not this plan's edits.**
- **Why fixed rather than deferred:** this plan's own acceptance criteria require `audit-integrity.test.ts` at 44/44, and the plan's environment preconditions record both guards as GREEN at plan time — a measurement taken before 28-21 executed. Leaving it would mean closing the round with a docs guard red and the plan's closing criterion unmet. Deviation Rule 1 (a bug directly in the round being closed) and Rule 3 (blocking this plan's own gate).
- **Fix:** one comment line, `phase 28's blockers` → `this store's recorded blockers`. No logic, no behaviour, no exported symbol.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** `docs-dangling-refs.test.ts` `# pass 7 / # fail 1` → `# pass 8 / # fail 0`; `audit-integrity.test.ts` 43/44 → **44/44**; `tsc --noEmit` clean; the full anno suite unaffected at 210/210.
- **Committed in:** `e3d85d9`

**2. [Rule 3 - Blocking] The plan's artifacts block anticipated two new tests; one was added**

- **Found during:** Task 3, the suite count reconciliation (derived 211, actual 210).
- **Issue:** not a defect but a plan/actual divergence that would read as a missing control if unexplained.
- **Resolution:** the plan's own `<action>` text says to WIDEN the three-spelling fixture and to EXTEND the negative fixture — both in-place changes to existing controls — so only the multi-statement control is genuinely new. Both evasions carry their own separately-asserted expected count, which is the property the acceptance criteria ask for. Recorded as the count reconciliation above rather than papered over.
- **Files modified:** none beyond Task 1's.
- **Committed in:** n/a (documentation of an explained divergence)

---

**Total deviations:** 1 auto-fixed (1 bug, inherited from 28-21) + 1 explained plan/actual divergence.
**Impact on plan:** The auto-fix is a one-word comment reword with no behavioural surface; without it this plan's own closing criterion could not be met. No scope creep — nothing in `src/mcp/vice` outside `anno-seam.test.ts` and that one comment line changed.

## Issues Encountered

- **A `git stash` was used once, and it captured this plan's uncommitted Task 2 edits.** While isolating the `docs-dangling-refs` failure, `git stash --include-untracked -- .planning src/mcp/vice` was run to measure the guard against a clean base. It stashed the in-progress `28-REVIEW.md` and `REQUIREMENTS.md` edits. `git stash list` showed exactly one entry, created seconds earlier, `WIP on main: ba278fd` — provably this session's — and `git stash pop` restored both files intact, confirmed by `git status --porcelain`. **This repo runs on the main working tree with `use_worktrees: false`, so the shared-stash-list hazard that makes `git stash` unsafe under worktree isolation did not apply.** It should still not have been reached for: `git show <ref>:<path>` or `git worktree`-free `git log -S` would have answered the same question without touching the working tree, and the correct isolation measurement (running the guard at `ba278fd`) was obtainable from the commit history alone. Recorded so a later executor does not read the successful outcome as a licence.
- **`setLabel` requires an explicit `kind`.** The first CR-08 drive script omitted it and got `AnnoTypeError: label kind undefined is not one of the 4 valid values -- expected one of: User, Auto, System, Platform`. Not a defect — the store refusing an incomplete argument by name is the designed behaviour. Noted because a later reproduction script will hit it.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO/FIXME marker or unwired component was introduced. The round-5 verifier's own anti-pattern scan over all 13 phase-28 source and test files reports **zero** debt markers, and this plan added none.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust boundary. The plan's own register (T-28-53 … T-28-60, T-28-SC) is unchanged: the eight `mitigate` dispositions are each delivered by a control recorded above — T-28-53 by the statement matcher and its two-direction fixtures, T-28-54 and T-28-57 by the twelve-row disposition table with its evidence rule, T-28-55 by the quoted-verdict requirement move, T-28-56 by the two STILL-OPEN rows, T-28-58 by both docs guards at 7/7 and 44/44 with no heading shaped like a finding id added, T-28-59 by the individually-quoted controls and nine plantings, T-28-60 by `git show --stat HEAD -- .planning` — and the one `accept` disposition stands as written (no package-manager install exists in this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The fifth gap-closure round is EXECUTED and awaits verification.** 28-19 closed CR-09/IN-06/WR-08, 28-20 closed WR-22/WR-24/WR-18, 28-21 closed WR-21/WR-25, and this plan closed WR-19. WR-20, WR-23, IN-07 and IN-08 are `accept`-only and recorded as such.
- **What a round-6 verifier should read first:** the twelve-row disposition table and the two STILL-OPEN rows in `28-REVIEW.md`, then the round-5 record blocks in `.planning/REQUIREMENTS.md`, then the nine plantings and two reproductions above. Every claim in this SUMMARY is a number re-observed on the final tree.
- **What is NOT claimed:** STORE-01 and STORE-03 remain `Gaps Found`. This round wrote the code the verifier's gap asked for, but an executor's confidence in its own fix is not a verdict — those two rows move only when a verification pass says so.
- **Both human-verification items remain open** and neither is constructible by anything in this repo: the `integrity_check` throw arm needs filesystem- or SQLite-level fault injection, and the host-crash durability bound needs power-loss injection.
- **One pre-existing item stays out of scope and is not a phase-28 defect:** `anno-session.test.ts`'s 5 failures (`AnnoSpawnError: The external analyser was not found on PATH` — a missing external binary) and `scripts/audit-gate.mjs:198`'s all-or-nothing attribution across the seven docs guards, which is what made a single red guard look like seven.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*

## Self-Check: PASSED

All four key files exist on disk; all five commit hashes (`ce41965`, `ba278fd`, `e3d85d9`, `d463d4c`, `64d21f3`) resolve in `git log --oneline --all`.
