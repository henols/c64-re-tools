---
phase: 28-the-store-core
plan: 17
subsystem: database
tags: [sqlite, node-sqlite, annotation-store, durability, fsync, rollback, node-test]

# Dependency graph
requires:
  - phase: 28-the-store-core (plan 28-16)
    provides: "`revertTo`'s step-2 and step-3b gates (CR-08 closed as a class), the promoted `retained` witness `snapshotOpenFailure`, and the 165-test anno baseline this plan measures against"
provides:
  - "`stageSnapshot` fsyncs the staged image before it returns -- unguarded, because that call removes the DESTRUCTIVE half-state (a durable pointer row naming a file whose bytes never reached disk)"
  - "`publishSnapshot` fsyncs the ring directory after the rename -- best effort, because that call removes only the orphan-ROW direction trap 10 already calls harmless"
  - "three rollback handlers that report the rollback they OBSERVED: a recorded `rolledBack` branches the two refusal messages and rides in `data`"
  - "`reconcileSnapshotRing(handle).rollbackFailed` -- an always-present boolean at every return site, so the one path forbidden to throw (28-11 P5) still reports the same fact"
  - "the two root-sensitive controls declared with node:test's real `{ skip: ... }`, so under root the runner counts them instead of the bodies passing vacuously"
affects: [28-18, phase-29-mcp-surface, anno-store, snapshot-ring]

actuals:
  tokens: 9681
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A durability call's GUARD STRENGTH follows which half-state it removes: unguarded where the alternative is destructive, best effort where the alternative is an already-bounded harmless state"
    - "A swallowed second error keeps its FACT: `let rolledBack = true` in the handler, `false` in the inner catch, and the message branches on the recorded value rather than asserting the intended one"
    - "A precondition a test cannot construct is declared in node:test's options object, never asserted true in the body"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-store.test.ts

key-decisions:
  - "`stageSnapshot`'s fsync is UNGUARDED and `publishSnapshot`'s is BEST EFFORT, and the asymmetry is which outcome each removes: the image fsync removes the destructive half-state (a durable row naming partial bytes); the directory fsync removes only a missing directory entry, i.e. an orphan ROW -- inert since 28-13, refused by name since 28-16 (deviation, recorded below)"
  - "The durability claim's evidence is STRUCTURAL and says so in its own test comment: an `fsync` has no in-process observable, so a behavioural assertion would be measuring something else and calling it durability"
  - "The sweep site was WIDENED rather than made to throw -- `rollbackFailed` on the result -- because 28-11 P5 forbids converting a committed write into a caller-visible failure, and `revertTo`'s step-6 call site is exactly such a path"
  - "`rollbackFailed` is always present rather than optional, for the reason the neighbouring `droppedRows`-absence assertion already records: a field that can only ever answer one value is a claim the next reader has to falsify by experiment"
  - "The uid-0 half of task 3's observation was driven with a FORGED `process.getuid` via `NODE_OPTIONS=--import`, because `sudo -n` needs a password on this host -- recorded as a substitution, not as a root run"

patterns-established:
  - "Best-effort durability with the reachable outcomes ENUMERATED in the comment: the failure of the guarded call moves the outcome from one member of an already-bounded pair to the other, never out of the pair"
  - "Both branches of a branched refusal asserted in ONE test, because a single-branch assertion is what let the asserted-but-unverified wording survive in the first place"
  - "A before/after skip-count observation taken by running the PRE-TASK file (from its own commit) as a throwaway copy under the same forged uid, rather than by hand-editing the live file"

requirements-completed: []  # STORE-04 is declared by 28-18 as well; `requirements.ready-ids` reports 0/1 ready, so REQUIREMENTS.md is untouched exactly as this plan's verification requires.

coverage:
  - id: D1
    description: "WR-13: the snapshot image and its ring directory are fsynced on the publish path, so the pointer row can no longer be durable ahead of the file it names"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#the publish path's SOURCE ORDER is the durability guarantee (WR-13): stageSnapshot fsyncs after its vacuum, and publishSnapshot fsyncs the ring directory after its rename"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-durability.test.ts (5/5, # fail 0 -- the SIGKILL durability proof still holds over the changed publish path)"
        status: pass
      - kind: other
        ref: "grep -c 'fsyncPath(' src/mcp/vice/anno-store.ts == 6 (was 4); grep -c 'exec(\"pragma' == 0 before and after"
        status: pass
    human_judgment: true
    rationale: "An `fsync` has NO in-process observable, so the only direct in-suite evidence is the SOURCE ORDER of two calls. This is the plan's `backstop` truth (28-EDGE-COVERAGE STORE-04 / concurrency): a human -- or a real power-loss test -- is what confirms the durability claim itself, and the structural control deliberately claims nothing more than the ordering. The best-effort directory fsync (deviation 1) is part of what needs that judgment."
  - id: D2
    description: "WR-16: no refusal in the module states a rollback as fact after swallowing that rollback's own failure; the one handler forbidden to throw reports the same fact in its result"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#WR-16: the commit-failure refusal reports the rollback it OBSERVED -- rolled back, or ALSO failed -- carries that fact in data, and the sweep reports the same fact without throwing"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-seam.test.ts#the seam contains exactly one commit statement, so the single planted-violation site is unique"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#STORE-04 idempotency across the half-states (the pre-existing droppedRows-absence assertion, ok 46)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-14: the two root-sensitive controls skip visibly under root instead of reporting a pass for a precondition they could not build"
    requirement: "STORE-04"
    verification:
      - kind: unit
        ref: "node --test anno-store.test.ts as uid 1000: both converted tests report ok (64, 65), # skipped 0"
        status: pass
      - kind: other
        ref: "grep -c 'SKIPPED as root' == 0 (was 2); grep -c 'skip: process.getuid' == 2 (was 0); perl whole-file /assert\\.ok\\(\\s*true,/ count == 0 (was 2)"
        status: pass
    human_judgment: true
    rationale: "The uid-0 half was observed with a FORGED `process.getuid` (`NODE_OPTIONS=--import`), because `sudo -n` requires a password on this host. The forged run exercises node:test's real skip mechanism and reports `# skipped 2` with both reasons, and the pre-task file under the identical forgery reports `# skipped 0` -- but it is not a run as real root, so the substitution is offered for judgment rather than claimed as the criterion's literal evidence."

# Metrics
duration: 16 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 17: Publish-path durability, rollback honesty and visible skips Summary

**The publish path now fsyncs the staged image (unguarded) and the ring directory (best effort) so a durable pointer row can no longer name bytes that never reached disk; three rollback handlers report the rollback they OBSERVED via a recorded `rolledBack` / `rollbackFailed`; and two root-sensitive controls skip visibly instead of passing vacuously — 167/167 anno tests, `# fail 0 / # skipped 0` as uid 1000.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-28T16:35:22Z
- **Completed:** 2026-08-28T16:51:08Z
- **Tasks:** 3 (task 2 as TDD: RED → GREEN, no REFACTOR needed)
- **Files modified:** 2

## Accomplishments

- **WR-13 — disposition `fix`.** The image is made durable before the row that names it: `stageSnapshot` fsyncs the staged file after its `vacuum into`, and `publishSnapshot` fsyncs the ring directory after its `renameSync`, both through the module's existing `fsyncPath()`. The durability claim's evidence is **structural** — an `fsync` has no in-process observable, so a behavioural assertion would be measuring something else (file presence, a read-back) and calling it durability, which is the 28-07 P3 shape this phase keeps re-encountering — and the new control's own comment says exactly that.
- **WR-16 — disposition `fix`.** Three handlers stopped asserting a rollback they had just swallowed the failure of: the publish/pointer-row handler, the CR-06 commit handler, and the sweep's own commit handler. Each records whether its `rollback` returned; the two throwing sites branch the message on the recorded fact and carry `rolledBack` in `data`; the sweep site — which must not throw, because 28-11 P5 forbids converting a committed write into a caller-visible failure on `revertTo`'s step-6 call path — was **widened** to `{ droppedFiles, deferred, rollbackFailed }` instead, with `rollbackFailed` set explicitly at all three return sites.
- **WR-14 — disposition `fix`.** Both root guards moved from the test bodies into node:test's declaration options, in `anno-confinement.test.ts` case 14's form. The verifier's own qualifier is carried here rather than dropped: its round-4 CR-07 evidence did **not** depend on these controls, so this restores the round's *standing guarantee* rather than the *verdict's basis*.
- The `deferred` doc paragraph now carries its qualifier **in the same sentence** as the "THIS SWEEP CHANGED NOTHING" claim, not in a later one.
- No `synchronous` or `journal_mode` pragma, no retry, no grace bound and no new tunable constant was introduced (header rule 4, prohibition 28-11 P3). No `SCHEMA_VERSION`, on-disk column or directory-layout change.

## Recorded numbers (verbatim)

**`fsyncPath(` count in `anno-store.ts`:** `4` before → **`6`** after (the definition at `:322` plus three revert-path sites, plus the two new publish-path sites). `grep -c 'exec("pragma' src/mcp/vice/anno-store.ts` returns `0` **before and after**.

**The fsync planted red, observed and reverted.** With `fsyncPath(dirname(snapPath))` deleted from `publishSnapshot` (count `5`):

```
not ok 50 - the publish path's SOURCE ORDER is the durability guarantee (WR-13): stageSnapshot fsyncs after its vacuum, and publishSnapshot fsyncs the ring directory after its rename
  error: 'and publishSnapshot must fsync the ring directory after that rename'
  code: 'ERR_ASSERTION'
# pass 71
# fail 1
```

Restored (count back to `6`) → `# tests 72 / # pass 72 / # fail 0`, and `git diff --stat -- src/mcp/vice/anno-store.ts` back to the task's own diff with no planted residue.

**Both rollback messages, with their `data.rolledBack` values.** Driven through `setDataType` on a handle whose own `db.exec` was wrapped — `anno-store.ts` was not edited:

| branch | planted | message | `data.rolledBack` |
|---|---|---|---|
| ordinary | `commit` throws | `…: the write for revision N+1 could not be committed (…). Nothing was written and the transaction has been rolled back, so the store is still at revision N.` | `true` |
| also-failed | `commit` **and** `rollback` throw | `…: the write for revision N+1 could not be committed (…). Nothing was written, but the rollback ALSO failed: this connection may still hold an open transaction and the store's write lock, so CLOSE IT AND REOPEN rather than reusing it. The store on disk is still at revision N, while this connection may report N+1 for a write that never landed.` | `false` |

The also-failed message does **not** contain the rolled-back wording (asserted with `assert.doesNotMatch`), and both messages name the revision the store is at, so prohibition 28-08 P2 keeps holding. The publish/pointer-row handler gained the same branch and the same `data` field.

**Grep counts:** `grep -c "rolledBack" src/mcp/vice/anno-store.ts` = **12** (criterion: ≥ 6); `grep -c "rollbackFailed"` = **11** (criterion: ≥ 4).

**The seam's still-word-based single-commit-site control is green**, proving the new string literals introduced no bare word `commit`:

```
ok 15 - the seam contains exactly one commit statement, so the single planted-violation site is unique
```

(`anno-seam.test.ts` overall: `# tests 17 / # pass 17 / # fail 0`.) The pre-existing `droppedRows`-absence assertion also still passes: `ok 46 - STORE-04 idempotency across the half-states: a second pruneSnapshots reports nothing dropped in either direction and changes neither the files nor the rows, and a second revertTo(r) leaves the same rows and the same revision`.

**Skip counts, uid 0 and uid 1000 side by side.** `sudo -n` requires a password on this host, so uid 0 was forged with `NODE_OPTIONS=--import` (a two-line module setting `process.getuid = () => 0`), which exercises node:test's real skip evaluation. The pre-task file was run as a throwaway copy taken from its own commit (`2a5f11a`), under the identical forgery, so the contrast is measured rather than argued:

```
# BEFORE (test file at 2a5f11a), forged uid 0:
ok 64 - CR-07: a sweep that throws inside its own transaction leaves the caller's connection with NO open transaction
ok 65 - revertTo returns a usable handle even when its step-6 sweep cannot read the ring (composite: 28-13's non-throwing sweep plus this handler)
# tests 73 / # pass 73 / # fail 0 / # skipped 0

# AFTER, forged uid 0:
ok 64 - CR-07: … # SKIP running as root: root ignores directory mode bits, so an unreadable ring directory is not constructible and this case would pass vacuously
ok 65 - revertTo … # SKIP running as root: root ignores directory mode bits, so an unreadable ring directory is not constructible and this case would pass vacuously
# tests 73 / # pass 71 / # fail 0 / # skipped 2

# AFTER, real uid 1000:
ok 64 - CR-07: … (runs)
ok 65 - revertTo … (runs)
# tests 73 / # pass 73 / # fail 0 / # skipped 0
```

`grep -c "SKIPPED as root"` = **0** (was `2`; the marker string is absent from the whole file, including the new comments, so a re-introduction is greppable). Whole-file `perl -0777 -ne '/assert\.ok\(\s*true,/g'` = **0** (was `2`). `grep -c "skip: process.getuid"` = **2** — which is why both skip declarations are written on a single physical line rather than wrapped. Both test names are byte-identical to their pre-task names (`grep -c` = `1` each).

**Pass counts.**

| point | `anno-store.test.ts` | derivation |
|---|---|---|
| after 28-16 | 71 | 28-16's recorded actual |
| after task 1 | **72** | +1, the structural durability-order control |
| after task 2 | **73** | +1, the behavioural rollback-honesty test |
| after task 3 | **73** | conversion only, no count change |

Full set as uid 1000: `node --test anno-*.test.ts block-class.test.ts` → **`# tests 167 / # pass 167 / # fail 0 / # skipped 0`**. Derived expectation was 167 (28-16's recorded 165 + this plan's 2); actual **167**. `npx tsc --noEmit -p src/mcp/vice/tsconfig.json` exits `0` with no output at every commit.

## Task Commits

1. **Task 1: WR-13 — the snapshot image is durable before the row that names it** — `37c32e2` (fix)
2. **Task 2: WR-16 — three handlers report the rollback that happened** — `f652253` (test, RED) → `2a5f11a` (feat, GREEN). No REFACTOR commit: the GREEN shape is the final one — a recorded local, a branched message and one widened result field.
3. **Task 3: WR-14 — a control that cannot build its precondition skips visibly** — `d23197a` (test)

## Files Created/Modified

- `src/mcp/vice/anno-store.ts` — `fsyncPath` at the two publish-path sites; `rolledBack` recorded and branched at the two throwing handlers and carried in `data`; `reconcileSnapshotRing`'s return type widened with `rollbackFailed` at all three return sites; four doc blocks re-truthed (`stageSnapshot`, `publishSnapshot`, the `deferred` paragraph, and the three handler comments).
- `src/mcp/vice/anno-store.test.ts` — two new tests (the structural durability-order control with its needle positive control; the two-branch rollback-honesty test with the sweep's `rollbackFailed`); two tests converted to node:test `{ skip: … }` with no name change.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one is the guard asymmetry between the two new `fsyncPath` calls, recorded as deviation 1 below because the plan's action text did not distinguish them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `publishSnapshot`'s directory fsync is BEST EFFORT; `stageSnapshot`'s image fsync is unguarded**

- **Found during:** Task 1, immediately after adding both calls as the action's plain reading (both unguarded).
- **Issue:** An unguarded `fsyncPath(dirname(snapPath))` reddened the pre-existing CR-07 control (`not ok 64 … EACCES: permission denied, open '/tmp/anno-…/proj.annostore.snapshots'`). That test's precondition is a ring directory that is **writable but not readable** (`chmod 0o300`), chosen precisely so "the write itself is entirely ordinary; only the sweep's `readdirSync` throws". A directory fsync needs `openSync(dir, "r")`, i.e. the **same** read bit `readdirSync` needs — measured directly: at mode `0300`, `fsync` of the directory fails `EACCES` while `fsync` of a file **inside** it succeeds (search permission is enough). So a mandatory directory fsync and that precondition cannot coexist: every `setDataType` against such a ring would refuse, and CR-07's only behavioural control could no longer be constructed at all.
- **Fix:** the two calls are guarded differently, on the principle of **which half-state each removes**. `stageSnapshot`'s image fsync stays **unguarded** — it removes the destructive outcome (a durable row naming a file whose bytes never reached disk), and a failure there refuses before `begin immediate`, so nothing is published and nothing is committed. `publishSnapshot`'s directory fsync is wrapped in a swallowing `try` — its failure means a crash may lose the *directory entry*, which leaves an **orphan ROW**: the direction trap 10's own premise calls harmless, 28-13 made inert and 28-16 refuses by name. The plan's truth-2 bound therefore still holds exactly as written — the reachable outcomes after an interruption stay "a missing entry" or "an entry whose contents ARE durable", and this call's failure moves the outcome *from the second to the first* rather than out of the pair. Both the reasoning and the measured mode-`0300` fact are recorded at the call site, not only here.
- **Blast radius checked:** `anno-store.test.ts` 72/72 and `anno-durability.test.ts` 5/5 after the change; the new structural control asserts the ordering and is unaffected by the guard (the call is still after the rename).
- **Verification:** the planted red above, plus `# tests 167 / # pass 167 / # fail 0` on the final tree.
- **Committed in:** `37c32e2` (task 1).

**2. [Rule 3 - Blocking] Task 3's own criteria constrain the new comments' wording and the `skip:` line's shape**

- **Found during:** Task 3, first draft.
- **Issue:** The first draft's replacement comments explained the fix by *quoting* the removed construct (`assert.ok(true, "SKIPPED as root: …")`), which kept `grep -c "SKIPPED as root"` at `2` and the whole-file `assert.ok(\s*true,` count at `2` — the exact two criteria whose zero values are "the fix's signature". Separately, the idiomatic wrapped form (`skip:` on its own line, the ternary below it) makes `grep -c "skip: process.getuid"` return `0`, not the required `2`.
- **Fix:** both comments describe the removed construct in prose ("an in-body vacuous truth assertion carrying its reason as a message") instead of quoting it, and each `skip:` is written on a single physical line. The first comment states explicitly that the marker string is now absent from the file so a re-introduction is greppable.
- **Verification:** all five task-3 grep/perl criteria at their required values, quoted above.
- **Committed in:** `d23197a` (task 3).

**3. [Rule 3 - Blocking] The uid-0 observation is a forged uid, not a `sudo` run**

- **Found during:** Task 3's uid-0 criterion.
- **Issue:** `sudo -n true` reports `sudo: a password is required` on this host. The criterion permits recording that fact instead of asserting a number, which would have left the conversion's *purpose* unobserved.
- **Fix:** uid 0 was forged for the runner's own skip evaluation via `NODE_OPTIONS=--import=file://…/forge-root.mjs` (a module whose whole body is `process.getuid = () => 0`), and the **pre-task** test file was run under the identical forgery as a throwaway copy taken from commit `2a5f11a`, so the before/after contrast is measured. Both outputs are quoted above. The scratchpad loader and the throwaway copy are outside the repo / were removed (`git status` clean apart from the plan's own two files).
- **Verification:** `# skipped 2` with both reason strings visible after; `# skipped 0` with both as `ok` before.
- **Committed in:** `d23197a` (task 3) — the observation is evidence, not code.

---

**Total deviations:** 3 auto-fixed (3 × Rule 3).
**Impact on plan:** No scope creep and no prohibition weakened. Deviation 1 is the only one that changes what the code does relative to the plan's literal text, and it resolves a collision the plan did not foresee in the direction the plan's own truth 2 requires (the outcome pair is preserved). Deviations 2 and 3 are the plan's own criteria applied to wording and to a missing host capability. Every acceptance criterion in all three tasks is satisfied, and the plan's arithmetic (165 → 167, split 1 + 1 + 0) holds exactly.

## Prohibitions — status on the final tree

| Prohibition | Status | Evidence |
|---|---|---|
| 28-07 P3 — no comment/message asserting a guarantee the code does not provide | **HELD** | WR-16's three sites now branch on a recorded fact; the new structural control's comment declares itself structural; the best-effort directory fsync says it is best effort and enumerates what its failure leaves. |
| 28-11 P5 — never convert a committed write into a caller-visible failure | **HELD** | The sweep still returns `deferred` and never rethrows; the honesty fix added a result field, not a throw. The publish-path fsync that *could* have refused an ordinary write is the one that was made best effort. |
| 28-08 P2 — never report a conflict without both numbers | **HELD** | Both rewritten messages name the revision the store is at; the also-failed branch names both (`N` on disk, `N+1` as this connection may report). |
| NEW — no test may report a PASS for a precondition it could not construct | **HELD** | `SKIPPED as root` = 0, `assert.ok(\s*true,` = 0, `skip: process.getuid` = 2, `# skipped 2` under forged root. |
| NEW — no durability claim whose only evidence is that the code was written down | **HELD** | The control is structural and says so in its own comment; the claim itself is filed as D1 `human_judgment: true` (`backstop`). |
| 28-07 P2 / 28-10 P2 — no floor/bound/`retained` claim the store cannot honour | **HELD, untouched** | This plan reads no `retained` witness and changes no floor. |
| 28-07 P1 / 28-10 P1 / 28-11 P1 — never destroy the only route back | **HELD** | Nothing is unlinked or renamed by this plan's changes. |
| 28-10 P3 / 28-11 P4 — no adoption/sweep of a ring whose ownership is unestablished | **HELD, untouched** | No ownership logic changed. |
| 28-10 P4 — no on-disk meaning change without a `SCHEMA_VERSION` bump | **HELD** | No column, no layout, no `SCHEMA_VERSION` change. |
| 28-11 P3 — no tuned timing constant in place of an exact exclusion | **HELD** | No pragma (`grep -c 'exec("pragma'` = 0), no retry, no grace bound, no new constant. |

## Issues Encountered

None beyond the three deviations above.

## Known Stubs

None.

## Residuals carried forward (not closed by this plan)

- **The durability claim's evidence remains structural in-process.** `anno-durability.test.ts` proves the `SIGKILL` case behaviourally; the host-crash case is what the two `fsyncPath` calls address and no in-process test can observe. Filed as D1 `human_judgment: true`, matching the plan's `backstop` disposition for the STORE-04 / concurrency edge row.
- **The best-effort directory fsync is a stated limit, not a hidden one.** When `fsyncPath(dirname(snapPath))` fails, a host crash can still lose the directory entry — leaving an orphan ROW, the bounded harmless direction. Recorded at the call site.
- **`anno-seam.test.ts`'s single-commit-site control is still the word-based `/\bcommit\b/gi` count** in this wave; 28-18 replaces it. Task 2's message strings were written against that constraint (`committed` / `committing`, never a bare `commit`) and the control is green.
- **The uid-0 skip observation is a forged uid, not real root.** A run under genuine root remains available to a human.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 28-18 (wave 16) closes the round: WR-15 (the seam's word-based commit-site control, which task 2's wording was written to respect) and the commit-count control that is still word-based at this point.
- `STORE-04` stays unmarked: `requirements.ready-ids` reports `0/1 requirement(s) ready to mark complete` because 28-18 also declares it, so `.planning/REQUIREMENTS.md` is untouched by this plan exactly as its verification requires.
- `anno-*.test.ts block-class.test.ts` is the baseline for 28-18: **167** passing, `# fail 0`, `# skipped 0` as uid 1000; `anno-store.test.ts` alone is **73**.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*

## Self-Check: PASSED

- `src/mcp/vice/anno-store.ts`, `src/mcp/vice/anno-store.test.ts` and this SUMMARY exist on disk.
- All four commits are present in `git log --oneline --all`: `37c32e2`, `f652253`, `2a5f11a`, `d23197a`.
- Every task's `<acceptance_criteria>` was re-run on the final tree: `anno-*.test.ts block-class.test.ts` = `# tests 167 / # pass 167 / # fail 0 / # skipped 0`; `anno-store.test.ts` = 73; `anno-seam.test.ts` = 17/17; `anno-durability.test.ts` = 5/5; `npx tsc --noEmit -p src/mcp/vice/tsconfig.json` exits 0 with no output; all grep/perl criteria at their required values as quoted above.
