---
phase: 32-the-deletion-and-the-grep-gate
plan: 20
subsystem: testing
tags: [mutation-harness, signals, process-handlers, node-test, restore-invariant, broken-windows, cr-10, wr-27, wr-28, wr-29]

# Dependency graph
requires:
  - phase: 32-the-deletion-and-the-grep-gate (plan 32-19)
    provides: "the three exported harness symbols (plant, restoreAll, pendingRestoreCount) and the in-process driver pattern under fixtures/harness-signal/ — the export that made the real handler reachable, and, with the latch, the export that made it disarmable"
  - phase: 32-the-deletion-and-the-grep-gate (round-3 verification)
    provides: "gap 2 / CR-10 — the independently reproduced disarm measurement this plan closes, and the WR-27/WR-28/WR-29 dispositions"
provides:
  - "A latch-free restore path in scripts/audit-mutation-harness.mjs: originals.clear() is the single mechanism making a second restoreAll() a no-op, and the comment above the four handler registrations says so"
  - "restore-disarm-driver.mjs — the third in-process driver, the only one that opens a SECOND plant window after a completed restore cycle"
  - "Two discriminating second-window cases (SIGINT, SIGTERM) in audit-harness-restore.test.ts, proven to bite against a deliberately re-introduced latch"
  - "WR-29: the porcelain attribution admits non-hidden, non-fixtures src/ paths on a re-derived registry basis"
  - "WR-28: the plant-observation loop reads the child's exit state, so a dead driver fails immediately and by name"
  - "WINDOWS.md entry 40 opened on the disarm defect and closed on its fix; entry 33 closed on its discharged content, successor already on the page"
  - "evidence/32-restore-disarm.md — the bite proof in full, both halves verbatim, with broker state and checkout root beside every figure"
affects: [32-21, phase-32 verification round 4, any later plan touching the mutation harness restore machinery]

actuals:
  tokens: 18064        # chars/4 over the REALIZED DIFF (72257 bytes, git diff ccb55f9..HEAD).
                       # Recorded on the executor spec's stated scale. For a calibrator that
                       # prefers the whole-file basis: the five changed files total 176835
                       # bytes -> 44209. Neither figure is rounded toward the 70000 estimate.
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Second-window in-process driver: plant, complete a restore cycle, plant again, then await — the shape that exposes state carried ACROSS restore cycles rather than within one"
    - "Bite proof as a first-class acceptance artifact: capture the guard RED against a deliberately re-introduced defect, verbatim, before trusting it"
    - "Ledger successor-before-closure: append the successor entry, fix it, THEN close the entry it succeeds, all in one commit, so no intermediate state shows a closed entry with nothing recording what replaced it"

key-files:
  created:
    - src/mcp/vice/fixtures/harness-signal/restore-disarm-driver.mjs
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-restore-disarm.md
  modified:
    - scripts/audit-mutation-harness.mjs
    - src/mcp/vice/audit-harness-restore.test.ts
    - .planning/WINDOWS.md

key-decisions:
  - "The latch is deleted with NOTHING replacing it — no counter, set, renamed flag, size check or handler-side guard. originals.clear() already supplies the idempotence the latch was added for, so a second mechanism would reproduce the defect under a new name and make the discriminating test green for the wrong reason."
  - "The second-window cases do NOT record into the attempt-log array. The log is a transcript of plan 32-14's ten first-window attempts kept row-comparable across rounds, and IN-14 records that test's ordering dependence; the five-per-signal expectation is left untouched and unedited. The plan's named fallback (widen the count deliberately) was NOT taken."
  - "WR-29's admission excludes dot-prefixed src/ segments, not just /fixtures/ ones. The plan's prescribed narrowing (src/mcp/vice/ excluding /fixtures/) was measured INSUFFICIENT: the concurrent churn is literally at src/mcp/vice/.anno-cli-test-*. Measured basis: 4 of 4 in-repo scratch prefixes under src/ are dot-prefixed; 0 of 23 src/ plant targets carry a dot-prefixed segment."
  - "The reason field for both ledger closures was hand-written into both representations, because `windows fixed` sets status and resolved_at but leaves reason empty and both closures owe a citation."
  - "REQUIREMENTS.md was deliberately NOT touched: requirements.ready-ids returns 0/2 for CUT-04 and CUT-06 because sibling plan 32-21 declares the same two ids and has no SUMMARY yet (shared-ID gate)."

patterns-established:
  - "Natural RED before formal bite proof: write the discriminating case against the defect AS COMMITTED, watch it fail, then fix — and afterwards re-introduce the defect against the final files to satisfy the acceptance criterion on its own terms. The first RED is stronger evidence than a re-introduction, and the second is the reproducible one."
  - "Record the checkout ROOT beside every figure, not just the broker state: a worktree baseline (empty porcelain) and a main-checkout baseline (four untracked files) are different facts and must not be interchanged."

requirements-completed: []  # CUT-04 and CUT-06 are declared by this plan AND by sibling
                            # 32-21; requirements.ready-ids returns 0/2 until 32-21 has a
                            # SUMMARY. Deliberately not marked here.

coverage:
  - id: D1
    description: "A process that has already completed one restore cycle still restores its next captured plant on SIGINT — observed through the harness's own registered handler, exit 130, null terminating signal, byte-identical as Buffers"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#gap 2 / CR-10: SIGINT in the SECOND window -- after a restore cycle has already completed -- still restores"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same, for SIGTERM"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#gap 2 / CR-10: SIGTERM in the SECOND window -- after a restore cycle has already completed -- still restores"
        status: pass
    human_judgment: false
  - id: D3
    description: "The latch is gone and nothing re-arms the machinery under another name; the map clear is the single mechanism and the comment says so"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "comment-stripped NUL-safe census: grep -ac over grep -avE '^[[:space:]]*(//|\\*|/\\*)' scripts/audit-mutation-harness.mjs -> 'let restored'=0, 'if (restored)'=0, 'restored = true'=0, 'originals.clear()'=1"
        status: pass
      - kind: other
        ref: "node -e 'import(...).then(m=>Object.keys(m).sort().join(\",\"))' -> pendingRestoreCount,plant,restoreAll"
        status: pass
    human_judgment: false
  - id: D4
    description: "The new cases were watched failing against a deliberately re-introduced latch before they were trusted — the bite proof, both halves captured verbatim"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "node --test audit-harness-restore.test.ts with the latch re-introduced -> exit 1, 7 tests / 5 pass / 2 fail, the two failures being exactly the new cases; with the plant removed -> exit 0, 7 pass / 0 fail"
        status: pass
    human_judgment: false
  - id: D5
    description: "The committed WR-03 sentinel case stays green with no latch present — green by construction (the map clear), not by adjustment"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write"
        status: pass
    human_judgment: false
  - id: D6
    description: "WR-29 — the porcelain attribution admits the tree a mis-contained plant lands in, on a basis re-derived from the committed registry"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts (isolated: 7/7) and cd src/mcp/vice && npm run test:automated (3019 tests, 3012 pass, this file green)"
        status: pass
    human_judgment: false
  - id: D7
    description: "WR-28 — the plant-observation loop asserts on the child's exit state as well as its deadline, in the shared routine"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical"
        status: pass
    human_judgment: false
  - id: D8
    description: "The shipped CLI path still works and still reverts cleanly after the deletion"
    verification:
      - kind: other
        ref: "node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs --out <gitignored scratch> -> exit 0, OBSERVED RED, 'tree: restored byte-identical to the baseline', git diff --stat empty"
        status: pass
    human_judgment: false
  - id: D9
    description: "WINDOWS.md entry 40 opened on the disarm defect and closed on its fix; entry 33 closed on its discharged content with its successor already present; arithmetic reconciles"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "windows status --raw piped through the plan's own checker -> LEDGER OK {open:21, fixed:7, total:40, successor:40, entry35:open}; field-level diff -> rows 39->40, added [40], removed [], row 33 changed only status/reason/resolved_at, order unchanged, ids strictly ascending"
        status: pass
    human_judgment: false
  - id: D10
    description: "The evidence artifact carries the bite proof in full with broker state, checkout root and commit measured beside every figure"
    verification: []
    human_judgment: true
    rationale: "Whether a written record is honest, complete and re-derivable by a later reader is the judgment this phase's criterion 1 is about. The file's existence and non-emptiness are machine-checked; its adequacy as evidence is not, and asserting otherwise would be the vacuity the phase exists against."
  - id: D11
    description: "[edge:CUT-06/ordering] The ledger's markdown table and JSON block both remain in ascending id order and this plan's commit touches only the appended row and the two status transitions"
    verification:
      - kind: other
        ref: "field-level comparison of git show HEAD~1:.planning/WINDOWS.md against the working copy -> 'pre-existing row ORDER unchanged: true', 'ids strictly ascending: true'"
        status: pass
    human_judgment: true
    rationale: "Routed as a backstop by the plan: this round adds no ordering-sensitive document producer, so the guarantee is a property of how the record is written rather than of a command's exit status. The mechanical check above is recorded; a human should confirm the reading rather than have it auto-pass."

# Metrics
duration: 43 min
completed: 2026-09-01
status: complete
---

# Phase 32 Plan 20: The Restore Latch Deleted, and the Guard Watched Biting Summary

**The mutation harness's restore machinery is no longer disarmable — the module-level latch that permanently no-opped all four process handlers after one completed restore cycle is deleted, `originals.clear()` is the single remaining mechanism, and the two second-window cases that now guard it were watched failing against a deliberately re-introduced latch before they were trusted.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-09-01T10:22:00Z (approx., first read of the plan)
- **Completed:** 2026-09-01T11:05:00Z
- **Tasks:** 2
- **Files modified:** 5 (3 modified, 2 created)

## Environment, recorded once and repeated beside every figure

- **Checkout root for every figure:** `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a53088416713c98f1` — a GSD worktree on branch `worktree-agent-a53088416713c98f1`, forked from `ccb55f9`. **Not** the main checkout.
- **Broker state (D-13), read by `evidence/32-close-gate.md` §2b's method, read-only:**
  ```
  $ systemctl --user is-active vice-broker      inactive   exit=4
  $ ps -eo pid,args | grep -i vice-broker | grep -v grep   exit=1  (no output)
  ```
  **Inactive for every figure below.** A live broker reds `vice-proxy.test.ts`'s BACK-05 D–G ordering test deterministically — not as a flake — so a figure recorded without its broker state is void rather than merely unlabelled.
- **Tree baseline in THIS checkout is an EMPTY `git status --porcelain`.** The four pre-existing untracked files the main checkout carries at dispatch (`docs/dissambler-workflow.md`, `docs/undocumented-opcodes-ghidra.md`, `docs/vice-mcp-ideas.md`, `skills-lock.json`) are **not** present in a fresh worktree. Every "tree returned to baseline" claim here means *zero porcelain lines in this worktree*, and says which tree it measured.

## Accomplishments

- **The disarm is removed at its cause.** The module-level boolean, its early-return guard and its assignment are deleted from `scripts/audit-mutation-harness.mjs`. Nothing replaces them.
- **The fix is guarded by a case that provably bites**, captured RED against a deliberately re-introduced latch and GREEN once removed, both verbatim below.
- **Two cheap hardenings taken rather than deferred** in the file already being edited: `WR-29` (porcelain attribution) and `WR-28` (plant-observation loop).
- **The ledger records the defect's whole arc** — entry 40 opened on the disarm and closed on its fix, entry 33 closed on its genuinely discharged content, successor appended first, all three movements in one commit.

## Task Commits

1. **Task 1 (tracer, tdd) — RED:** `1aa20f0` (test) — the disarm driver and the two failing second-window cases
2. **Task 1 — GREEN:** `6e6d76a` (fix) — the latch deleted, the handler comment corrected
3. **Task 1 — hardenings:** `1adfee2` (test) — `WR-29` and `WR-28`
4. **Task 2:** `9baaace` (docs) — the ledger pair as one atomic unit, plus `evidence/32-restore-disarm.md`

_No separate plan-metadata commit beyond this SUMMARY's own; STATE.md and ROADMAP.md are the orchestrator's to write._

## Files Created/Modified

- `scripts/audit-mutation-harness.mjs` — latch deleted; the comment above the four `process.on(...)` registrations now names `originals.clear()` as the mechanism, records the defect it replaced, cites `CR-10` and `WR-27`, and states the shipped CLI path was never affected
- `src/mcp/vice/fixtures/harness-signal/restore-disarm-driver.mjs` — **new**; plants, completes a restore cycle, plants a second distinguishable mutation, reports three pending counts on one marker line, then awaits
- `src/mcp/vice/audit-harness-restore.test.ts` — two second-window cases, the `WR-29` widening with its re-derived basis, the `WR-28` exit-state assertion, and a header recording that the file's scope is now two properties
- `.planning/WINDOWS.md` — entry 40 appended and fixed; entry 33 closed
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-restore-disarm.md` — **new**; the full record

## The recorded figures

### Comment-stripped, NUL-safe census — verbatim

`grep -a` throughout: a plain `grep` silently skips a file containing a NUL byte and has already produced one false decision in this project.

```
$ grep -avE '^[[:space:]]*(//|\*|/\*)' scripts/audit-mutation-harness.mjs > code-only.txt
let restored      = 0
if (restored)     = 0
restored = true   = 0
await|async |.then( = 0
originals.clear() = 2        (whole file)
originals.clear() = 1        (code-only)
```

The whole-file `originals.clear()` count is 2 because the correction comment names that call; the code-only count is 1. The three latch censuses are comment-stripped for the same reason in reverse — the correction comment describes the deleted statements by concept and never reproduces them, so it cannot invalidate its own census.

### Export surface — verbatim, unchanged, no fourth symbol

```
$ node -e 'import("./scripts/audit-mutation-harness.mjs").then(m=>process.stdout.write(Object.keys(m).sort().join(",")))'
pendingRestoreCount,plant,restoreAll
```

### Syntax

```
$ node --check scripts/audit-mutation-harness.mjs                              exit=0
$ node --check src/mcp/vice/fixtures/harness-signal/restore-disarm-driver.mjs  exit=0
```

### The test run's case list and counts (isolated, broker inactive, worktree root)

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=0
ok 1 - SIGINT delivered inside the plant window exits 130 and restores byte-for-byte
ok 2 - SIGTERM delivered inside the plant window exits 130 and restores byte-for-byte
ok 3 - negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical
ok 4 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
ok 5 - gap 2 / CR-10: SIGINT in the SECOND window -- after a restore cycle has already completed -- still restores
ok 6 - gap 2 / CR-10: SIGTERM in the SECOND window -- after a restore cycle has already completed -- still restores
ok 7 - the attempt log is complete and every recorded exit code is the discriminating one
# tests 7
# suites 0
# pass 7
# fail 0
# skipped 0
# todo 0
# duration_ms 1514.548498
```

Five pre-existing cases plus the two new second-window cases. The attempt-log case still sees exactly five signalled attempts per signal, unedited.

### THE BITE PROOF — both halves verbatim

**The order actually run was stronger than the order asked for, and that is stated rather than glossed.** The discriminating cases were written and run against the latch **as it stood committed**, before a line of the fix existed — so the first RED is against the real defect. The formal re-introduction was then done against the FINAL state of both files, satisfying the acceptance criterion on its own terms.

**RED, latch deliberately re-introduced against `1adfee2`** — the re-introduction is exactly the three deleted lines:

```
$ git diff -- scripts/audit-mutation-harness.mjs
@@ -167,8 +167,11 @@ const EXCERPT_MAX = 4000;
 /** absolute path -> original bytes, captured BEFORE the first write. */
 const originals = new Map();
+let restored = false;

 export function restoreAll() {
+  if (restored) return;
+  restored = true;
   for (const [abs, bytes] of originals) {
```

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=1
ok 1 - SIGINT delivered inside the plant window exits 130 and restores byte-for-byte
ok 2 - SIGTERM delivered inside the plant window exits 130 and restores byte-for-byte
ok 3 - negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical
ok 4 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
not ok 5 - gap 2 / CR-10: SIGINT in the SECOND window -- after a restore cycle has already completed -- still restores
not ok 6 - gap 2 / CR-10: SIGTERM in the SECOND window -- after a restore cycle has already completed -- still restores
ok 7 - the attempt log is complete and every recorded exit code is the discriminating one
# tests 7
# suites 0
# pass 5
# fail 2
# skipped 0
# todo 0
# duration_ms 1320.487278
```

The two failures name the un-restored second plant:

```
error: "SIGINT disarm: the SECOND plant (HARNESS_DISARM_TARGET_PLANTED_TWO) was NOT restored. The process exited 130 through the harness's own handler and still left a captured original unrestored -- the restore machinery was disarmed by the first completed restore cycle. Compared as Buffers, not as text."
error: "SIGTERM disarm: the SECOND plant (HARNESS_DISARM_TARGET_PLANTED_TWO) was NOT restored. The process exited 130 through the harness's own handler and still left a captured original unrestored -- the restore machinery was disarmed by the first completed restore cycle. Compared as Buffers, not as text."
```

**The five pre-existing cases stayed green in that same run** — which is what proves the two new cases are the ones doing the work.

**GREEN, plant removed:**

```
$ git checkout -- scripts/audit-mutation-harness.mjs
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=0
ok 1 ... ok 7   # tests 7  # pass 7  # fail 0  # duration_ms 1514.548498
$ git status --porcelain
                (no output — zero lines, this worktree's baseline)
```

**The earlier, natural RED** (cases written against the committed latch, before the fix existed) was identical in shape: `exit=1`, 7 tests, **5 pass / 2 fail**, the two failures being exactly cases 5 and 6.

### The `WR-03` sentinel case, green by construction

```
ok 4 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
```

Green in **every** run above, with and without the latch. **By construction, not by adjustment:** nothing in that case, its driver or its assertions was touched by this plan. It passes because `originals.clear()` leaves the second call an empty map to iterate — the same fact the latch deletion relies on, so the case and the fix rest on one mechanism rather than two. That it is *also* green with the latch present is `WR-27` restated: it distinguishes a no-op from a re-write, which is what `WR-03` literally asked, and cannot distinguish a latch from the map clear.

### Isolated vs concurrent runs of the test file

| Run | Root | Broker | Result |
|---|---|---|---|
| `node --test audit-harness-restore.test.ts` | the worktree | inactive | `exit=0`, 7 tests, **7 pass, 0 fail** |
| `cd src/mcp/vice && npm run test:automated` | the worktree | inactive | `exit=1`, 3019 tests, **3012 pass, 1 fail**, 1 skipped, 5 todo |

The single concurrent failure is **not this file and not this plan**: `repo-root.test.ts:178` — *"the agreed directory must not sit under .claude -- got .../.claude/worktrees/agent-a53088416713c98f1/.vice-supervisor"*. That is **broken-windows entry 36**, already on the ledger: the `!includes('.claude')` substring predicate fails unconditionally when the suite runs from a GSD worktree under `.claude/worktrees/`. It is a property of where this checkout is, and is expected absent from a main checkout.

**One green concurrent run is not proof of the absence of a flake, and this SUMMARY does not claim it is.** What is claimed is narrower and checkable: the churn class that actually fired was measured, its shape identified, and the admission narrowed to exclude exactly that shape on a stated basis.

### CLI regression line

```
$ node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs --out <gitignored scratch>
  OBSERVED RED  scripts/lib/skill-honesty-checks.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-fork-honesty.mjs
  counts: measured=1 skipped=0 total=1
  tree: restored byte-identical to the baseline
exit=0
$ git diff --stat        (no output — the registry write-back changed nothing)
$ rm -rf .harness-signal-scratch-cli && git status --porcelain | wc -l
0
```

### Other gates

```
$ cd src/mcp/vice && npm run typecheck        exit=0   (tsc --noEmit -p tsconfig.json, no diagnostics)
$ node scripts/check-guard-fates.mjs          exit=0
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 856.
```

**The whole-glob `npm test` was NOT run, and that is a statement rather than an omission.** It blocks indefinitely on `vice-proxy.test.ts` — broken-windows entry **26**, previously measured still running when killed at 300106 ms and `exit=124` under a 180 s bound. `npm run test:automated` is the terminating gate and is the figure recorded above.

### `WR-29`'s re-derived basis

Re-derived from the committed registry at this commit, **not** copied from the plan:

```
total rows: 61
plant descriptors: 35
by top-level dir: {"scripts/":10,".planning/":2,"src/":23}
containing a /fixtures/ segment: 0
```

**No divergence** from the planner's figure. The two `.planning/` targets are `.planning/PROJECT.md` and an `ANSWER.sha256` under a phase-11 evidence directory.

### `git diff -- .planning/WINDOWS.md`

`git diff --numstat` → **21 insertions, 8 deletions**, across exactly seven hunks: the four frontmatter counters; entry 33's markdown row; one appended markdown row (id 40); entry 33's JSON `status`/`reason`/`resolved_at`; and the appended JSON object for id 40.

```
@@ -3 +3 @@   -open_count: 22            +open_count: 21
@@ -5,3 +5,3 @@ -fixed_count: 5           +fixed_count: 7
                -total_count: 39           +total_count: 40
                -last_updated: ...07:45:46.468Z   +last_updated: ...10:58:32.236Z
@@ -50 +50 @@   | 33 | ... | open |  | ... |   ->   | 33 | ... | fixed | <reason> | ... |
@@ -56,0 +57 @@ + | 40 | 32 | unmet-truth | scripts/audit-mutation-harness.mjs |  | Restore machinery was DISARMABLE ... | fixed | ... |
@@ -451,2 +452,2 @@ -"status": "open" / -"reason": ""   ->   +"status": "fixed" / +"reason": "Closes on its STATED content ONLY..."
@@ -454 +455 @@  -"resolved_at": null   ->   +"resolved_at": "2026-09-01T10:58:32.236Z"
@@ -526,0 +528,12 @@ + the id-40 JSON object
```

Field-level comparison against `HEAD`, which is stronger than reading the hunks:

```
rows before=39 after=40
added=[40] removed=[]
row 33 changed fields: ["status","reason","resolved_at"]
pre-existing row ORDER unchanged: true
ids strictly ascending: true
```

**No pre-existing row was reordered, renumbered, reworded or given a `resolved_at` it did not have.**

**One honest note about "exactly two status transitions".** The net diff shows entry 33 transitioning `open → fixed` and entry 40 arriving **already** `fixed`, because the append and its fix both happened before the commit and the diff collapses them into one appended row. The two transitions were really performed, in the recorded order (append → fix 40 → fix 33); a commit diff simply cannot show a state that existed only between two uncommitted writes.

### The `LEDGER OK` line

```
LEDGER OK {"open":21,"fixed":7,"total":40,"successor":40,"entry35":"open","reason33Len":864,"reason40Len":671}
```

Read through the tool's own reader, not off the file. **Arithmetic reconciled:** one append and two closures against a 22-open / 5-fixed / 39-total starting ledger gives 21 open, 7 fixed, 40 total. **The successor entry was appended BEFORE entry 33 was closed, and all three movements landed in one commit** (`9baaace`), so no intermediate ledger state had entry 33 closed without its successor present. **Entry 35 is untouched and still `open`** — plan 32-21 owns it.

**Timestamp arc, stated so it does not read as backdating.** Entry 40's `recorded_at` (`10:58:05.666Z`) and `resolved_at` (`10:58:25.297Z`) are ~20 seconds apart because the defect was found by the round-3 verifier and fixed by this plan in the same round. Leaving the entry open over a defect this plan removed would be a false open window; not opening it at all is exactly what `gaps[1].missing[2]` forbids.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one: **the latch is deleted with nothing replacing it.** Adding a counter, a set, a renamed flag, a size check or a handler-side guard would have made the discriminating test green for the wrong reason and reproduced the same defect under a new name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `WR-29`'s prescribed narrowing was measured insufficient; a different, measured narrowing was applied**

- **Found during:** Task 1, action F
- **Issue:** The plan named a contingency — *"If the concurrent run reds on an unattributable `src/` entry ... the admission is narrowed to `src/mcp/vice/` excluding `/fixtures/`"*. The concurrent run DID red, twice, with `?? src/mcp/vice/.anno-cli-test-6kraqX/` and `?? src/mcp/vice/.anno-cli-test-8OGMOQ/`. But the prescribed narrowing **would not have helped**: that churn is literally inside `src/mcp/vice/` and contains no `/fixtures/` segment. Applying the prescription verbatim would have left the file red under concurrency, contradicting the same criterion's requirement that it be green both in isolation and inside the automated suite.
- **Fix:** The `src/` admission additionally excludes any path with a **dot-prefixed segment**. Measured both directions before writing it down: every in-repo scratch root an automated sibling creates under `src/` is dot-prefixed (`.anno-cli-test-`, `.anno-memmap-cross-root-`, `.anno-memmap-empty-`, `.audit-root-synth-`, plus `anno-memmap-render.test.ts`'s parameterised `` `.${prefix}-` `` form); the one non-dot prefix in the tree, `vice-proxy-evidence-test-`, is created under `.planning/` by a manual-only file this gate never runs, and `.planning/` stays admitted unconditionally on purpose. Against the registry: **0 of the 23 `src/` plant targets contain a dot-prefixed segment**, so the exclusion costs nothing against the basis.
- **Files modified:** `src/mcp/vice/audit-harness-restore.test.ts`
- **Verification:** isolated `exit=0` 7/7; concurrent `npm run test:automated` — this file green, the two `?? src/mcp/vice/.anno-cli-test-*` reds gone (suite 3009→3012 pass, 4→1 fail)
- **Committed in:** `1adfee2`
- **Not** a widening back to excluding `src/` outright, and the reason is on the page in three places: the docblock, `evidence/32-restore-disarm.md` §4a, and here.

**2. [Rule 3 - Blocking] `reason` had to be hand-written into `.planning/WINDOWS.md`**

- **Found during:** Task 2, action B
- **Issue:** The plan requires entry 33's closure to cite `evidence/32-restore-on-signal.md` and the 5/5 green run, and entry 40's fix to cite the latch deletion and bite proof. `gsd-tools windows fixed <id>` sets `status` and `resolved_at` but leaves `reason` empty and takes no reason argument, so neither citation could be written through the tool.
- **Fix:** A script wrote `reason` for rows 33 and 40 — **and only those two rows** — into both representations the file carries (the markdown table and the JSON block). It refuses to run unless each target row is already `fixed` with an empty `reason`, and asserts it made exactly two edits in each representation.
- **Verification:** `windows status --raw` re-read afterwards round-trips both reasons (`reason33Len: 864`, `reason40Len: 671`) with counters intact; the field-level diff shows row 33 changed only `status`/`reason`/`resolved_at` and no other pre-existing row changed at all.
- **Committed in:** `9baaace`

**3. [Rule 3 - Blocking] `npm ci` in the worktree**

- **Found during:** Task 1 setup
- **Issue:** A fresh worktree has no `src/mcp/vice/node_modules`, so `npm run typecheck` and `npm run test:automated` could not run. (`node --test audit-harness-restore.test.ts` needs none — it imports only node builtins — so the first RED was taken before this.)
- **Fix:** `npm ci --no-audit --no-fund` from the committed lockfile — the project's own provisioning step (`scripts/ensure-mcp-deps.sh`). **No package was added, no manifest or lockfile changed**, so the package-legitimacy exclusion to Rule 3 does not apply.
- **Verification:** `git status --porcelain` unchanged (`node_modules/` is gitignored); `npm run typecheck` exit 0.
- **Committed in:** nothing — no tracked file changed.

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** No scope creep. Deviation 1 is the plan's own contingency corrected by measurement where the prescription was insufficient; deviations 2 and 3 are tooling gaps worked around without changing what was delivered.

## Issues Encountered

- **The plan's `<precondition>` for Task 2 is worded for the main checkout.** It asks that `git status --porcelain` list "exactly the four pre-existing untracked files". In this worktree the correct baseline is an **empty** porcelain — a fresh worktree does not carry another checkout's untracked files. The precondition was evaluated on its substance (Task 1 committed, tree at its own baseline) and **met**; the wording mismatch is recorded rather than silently reinterpreted.
- **`npm run test:automated` cannot reach a 0-failure floor from a GSD worktree**, for a reason already ledgered as entry 36 (`repo-root.test.ts`'s `.claude` substring predicate). Recorded, not worked around, and not counted against this plan.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or unwired data source was introduced. No test was skipped and no `<verify>` went unrun.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema at a trust boundary was added. The one new file is a test fixture that writes only inside a caller-supplied, gitignored scratch root and registers no handler of its own. The threat register's five `mitigate` dispositions (T-32-39..T-32-43) were all applied: pre-plant bytes captured before every plant and compared as Buffers afterwards; the scratch root removed and survivors killed in a hook that runs on assertion failure; the map clear pinned by the committed sentinel case and by a census criterion; the porcelain widening measured and run under concurrency; the ledger counters read before, diffed after, and reconciled arithmetically.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Verifier truth 16 / gap 2 should now read closed.** The disarm is fixed at its cause, the fix is guarded by a case proven to bite, and the ledger records the arc rather than quietly closing the entry that was nearby.
- **Plan 32-21 expands from this green base** with gap 1's overlap arithmetic and the whole-set `--all` re-run. It owns WINDOWS entry 35, which this plan deliberately did not touch, and it declares the same `CUT-04` / `CUT-06` ids.
- **`REQUIREMENTS.md` is untouched by design.** `requirements.ready-ids` returns **0/2**: sibling 32-21 declares both ids and has no SUMMARY yet, so the shared-ID gate blocks them. They become ready when 32-21 finishes.
- **STATE.md and ROADMAP.md are untouched**, per worktree mode — the orchestrator owns those writes after the wave merges.
- **No file was deleted anywhere on this branch** (`git diff --diff-filter=D --name-only ccb55f9..HEAD` is empty), so `cleanup-wave`'s deletion refusal does not apply and the branch merges normally.
- **Deferred by name rather than dropped:** `CR-11` (latin1 truncation, latent, 0/35), `WR-36` (no standing coverage for three harness behaviours), and the remaining `WR`/`IN` dispositions — all owned by plan 32-21's Task 3.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-09-01*

## Self-Check: PASSED

Every file this SUMMARY claims was created or modified exists on disk, and every commit
hash it cites resolves on this branch. Checked from
`/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a53088416713c98f1`.

```
FOUND  scripts/audit-mutation-harness.mjs                                        49136 bytes
FOUND  src/mcp/vice/fixtures/harness-signal/restore-disarm-driver.mjs             8224 bytes
FOUND  src/mcp/vice/audit-harness-restore.test.ts                                37496 bytes
FOUND  .planning/WINDOWS.md                                                      55028 bytes
FOUND  .planning/phases/32-.../evidence/32-restore-disarm.md                     26951 bytes
FOUND  .planning/phases/32-.../32-20-SUMMARY.md

$ git log --oneline ccb55f9..HEAD
<HEAD>  docs(32-20): complete the restore-latch deletion plan   <- this commit; a file
                                                                cannot record the hash of
                                                                the commit that contains it
9baaace docs(32-20): the ledger pair as one atomic unit, and the evidence behind it
1adfee2 test(32-20): WR-29 admit non-hidden src/ paths, WR-28 read the child exit state
6e6d76a fix(32-20): delete the restore latch -- the map clear is the only mechanism
1aa20f0 test(32-20): add failing second-window disarm cases and their in-process driver

$ git diff --diff-filter=D --name-only ccb55f9..HEAD
                (empty — no file deleted anywhere on this branch)
```
