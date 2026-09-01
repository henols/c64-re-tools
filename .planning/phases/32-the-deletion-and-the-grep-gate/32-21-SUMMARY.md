---
phase: 32-the-deletion-and-the-grep-gate
plan: 21
subsystem: testing
tags: [mutation-harness, plant-contract, guard-fates, registry-write-back, broken-windows, cr-09, cr-11, wr-34, wr-36]

# Dependency graph
requires:
  - phase: 32-the-deletion-and-the-grep-gate (plan 32-20)
    provides: "a latch-free restore path -- originals.clear() as the single idempotence mechanism -- which is what makes a 61-row whole-set sweep planting into 35 real files safe to run; plus the spawned-driver plumbing and the WR-29 porcelain attribution this plan's case group reuses"
  - phase: 32-the-deletion-and-the-grep-gate (plan 32-19)
    provides: "the three exported harness symbols (plant, restoreAll, pendingRestoreCount) the new in-process driver calls directly"
  - phase: 32-the-deletion-and-the-grep-gate (round-3 verification)
    provides: "gap 1 / CR-09, and the CR-11, WR-34 and WR-36 dispositions this plan takes or defers by name"
provides:
  - "A per-site plant post-condition in scripts/audit-mutation-harness.mjs: the mutated text must begin with the recorded replacement at the unique match position and the length delta must equal replace.length - find.length. Exact for an overlapping replacement and a non-overlapping one alike."
  - "plant-contract-driver.mjs -- the fourth in-process driver, one named case per spawned child, one JSON verdict line, no sweep entry point and no registry read"
  - "A plant-contract case group in audit-harness-restore.test.ts: eight cases covering the overlap shape, the pre-existing-replacement shape, verbatim-byte substitution, both occurrence-count refusals, the empty-field refusal, the non-latin1 refusal and the bad-plant-target attribution"
  - "CR-11: a descriptor that is not latin1-representable is refused by name -- field, code point and index -- before any path resolution or write"
  - "WR-34: a bad registry plant target is attributed to the registry row and its plant.file field, with the containment refusal carried verbatim; containment itself unchanged"
  - "The write-back decision recorded AT THE SITE with four grounds, a named rejected branch and a reversibility rating"
  - "A whole-set --all sweep that reaches the registry write-back: measured=35 skipped=26 total=61, 35 OBSERVED RED, zero refused, zero unmeasurable"
  - "evidence/32-gap1-overlap-and-writeback.md -- the sweep's raw stdout between two sentinels, every bite proof, the registry diff shape, and the full deferral register"
  - "WINDOWS.md entry 35 closed on the sweep line that discharges it; no new entry opened"
affects: [phase-32 verification round 4, any later plan touching the mutation harness plant path or regenerating guard-fates.json]

actuals:
  tokens: 26518        # chars/4 over the REALIZED DIFF (106070 bytes, git diff 01894b9..HEAD).
                       # Recorded on the executor spec's stated scale, NOT a harness token count.
                       # Not rounded toward the 95000 estimate: the estimate was 3.6x high, and
                       # a flattering number here corrupts every later projection.
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Per-site measurement over whole-file totals: when a check must survive an overlapping edit, assert at the match position and on the length delta rather than subtracting counts"
    - "Machine-checked transcript region: paste a command's raw stdout between two sentinels and scope the automated counts to that region ONLY, so the surrounding prose can discuss the failure literals without invalidating its own census"
    - "One named case per spawned child: a contract driver that takes a case name as an argument, so no case can mask another and none inherits another's process state"
    - "A post-condition that holds by construction is a PIN, not a tautology -- provided the construction it pins is planted-regression proven to break it"

key-files:
  created:
    - src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap1-overlap-and-writeback.md
  modified:
    - scripts/audit-mutation-harness.mjs
    - src/mcp/vice/audit-harness-restore.test.ts
    - .planning/WINDOWS.md

key-decisions:
  - "A refused plant BLOCKS the whole-set registry write-back, and the refused-plant flag is NOT separated from the failed flag. Rejected branch named and rejected on the basis, not on effort: a partial write-back would mix freshly-measured and committed evidence in one file with nothing recording which is which. Reversible -- the alternative is a two-line change at the same site."
  - "The sentence claiming the earlier arithmetic narrowing was free is DELETED rather than reworded, and not re-quoted anywhere, because the file's own census greps for it. Its replacement names the blindness by mechanism and names src/mcp/vice/hop-chain-comments.test.ts as the measured case."
  - "The registry write-back is proved by the diff SHAPE recorded while it was on disk, then DISCARDED under D-08. Keeping it would replace 35 dated recorded-red blocks with fresh excerpts to no end; the criterion asked for is that the path was reached, not that its output be committed."
  - "The test file keeps its name although its scope is now two properties. A rename is a file deletion in the diff, and this phase's wave merging refuses a branch whose diff deletes a file -- so the accurate name would cost a hand-merged branch."
  - "The whole-file 'before' reading of the removal gate was attempted, found INVALID, and recorded as such rather than dropped: parking the new (already tracked) driver made the gate fail on its own scope assertion. The before-state is established by derivation instead -- this plan's whole diff introduces 0 occurrences of the gate's subject."

patterns-established:
  - "Capture the natural RED first: write the discriminating case against the defect AS COMMITTED and watch it fail, before a line of the fix exists. Both of this plan's task-level REDs were taken that way."
  - "State what an exit code MEANS beside the code. `test:automated` exit 1 was recorded together with the single failure's identity, its ledger entry, and the fact that it fails unconditionally from a worktree -- rather than quoted bare or silently excused."

requirements-completed: [CUT-04, CUT-06]

coverage:
  - id: D1
    description: "The one committed evidence row that could not be re-measured now re-measures: the overlap-shaped descriptor is ACCEPTED, and the bytes on disk are the pre-plant bytes with exactly one newline inserted at the match position"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#plant contract / overlap-accepted: a replacement that textually overlaps its own pre-existing occurrence is accepted, and the file grows by exactly one byte at the match position"
        status: pass
      - kind: other
        ref: "node scripts/audit-mutation-harness.mjs --row src/mcp/vice/hop-chain-comments.test.ts -> exit 0, OBSERVED RED, guard exit 1 / control exit 0, tree restored byte-identical"
        status: pass
    human_judgment: false
  - id: D2
    description: "The whole-set command regenerates the artefact at the centre of CUT-04 rather than reporting the write-back suppressed"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "node scripts/audit-mutation-harness.mjs --all -> exit 0, `counts: measured=35 skipped=26 total=61`, 35 OBSERVED RED, 26 SKIPPED, 0 PLANT REFUSED, 0 UNMEASURABLE, `registry: <path>`, tree restored byte-identical -- raw stdout pasted between sentinels in evidence/32-gap1-overlap-and-writeback.md and counted inside that region only"
        status: pass
      - kind: other
        ref: "field-level registry diff while the write-back was on disk -> rowCount 61->61, rowOrderUnchanged true, added [], removed [], 30 of 35 recorded-red blocks differing, 0 evidence-owing-nothing rows touched; then `git diff --quiet` on the registry exits 0 after the D-08 discard"
        status: pass
    human_judgment: false
  - id: D3
    description: "The corrected post-condition is a standing PIN, not a tautology -- watched failing against BOTH regressions it guards"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "bite proof 1: whole-file difference form restored -> only overlap-accepted red (13 tests, 12 pass, 1 fail); plant removed -> 13/13"
        status: pass
      - kind: other
        ref: "bite proof 2: replacer function reverted to a replacement string -> substitution-is-verbatim red, reported BY the post-condition's own message at index 56, position assertion FALSE, delta +30 against an expected +3; plant removed -> 13/13"
        status: pass
    human_judgment: false
  - id: D4
    description: "The comment beside the arithmetic states what is true of it, names the measured case, and records where the false sentence came from"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "comment-stripped NUL-safe census: grep -ac 'narrowing costs nothing' = 0 (whole file); code-only 'preExisting' = 0, 'afterMutation' = 0, await/async/.then = 0; whole-file 'matchIndex' = 3, 'hop-chain-comments' = 2"
        status: pass
    human_judgment: false
  - id: D5
    description: "CR-11 -- a descriptor that cannot be written faithfully is refused by name instead of being truncated in silence, and the hardening moves no committed row"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#plant contract / non-latin1-refused: a descriptor that is not latin1-representable is refused BY NAME rather than truncated in silence"
        status: pass
      - kind: other
        ref: "before-state captured verbatim: planted true, replacementVerbatimAtMatchIndex false, on-disk bytes carry 0x14 where U+2014 belongs. After: refusal naming field `replace`, code point U+2014, index 24; nothing written; pending 0. Whole-set sweep confirms 0 of 35 committed descriptors affected."
        status: pass
    human_judgment: false
  - id: D6
    description: "WR-34 -- a bad registry plant target is diagnosed as a bad registry value, with containment behaviour untouched"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-harness-restore.test.ts#plant contract / bad-plant-target-attribution: a plant target that escapes the run's tree is refused, and the refusal is attributed to the REGISTRY rather than to a `--root` argument nobody passed"
        status: pass
      - kind: other
        ref: "both states captured verbatim: REFUSED in each (planted false), only the message moved -- from `--root \"...\" resolves to ... OUTSIDE the repository root` to `row ...: this row's `plant.file` field names a path ...` carrying that same refusal verbatim as the cause"
        status: pass
    human_judgment: false
  - id: D7
    description: "WR-36 -- the harness's plant contract now ships with a STANDING guard rather than a one-off manual run"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && node --test audit-harness-restore.test.ts -> exit 0, 15 tests, 15 pass, 0 fail (7 restore cases + 8 plant-contract cases), broker inactive, worktree root"
        status: pass
    human_judgment: false
  - id: D8
    description: "The refused-plant block on the write-back is a DECISION with a written basis and a named rejected alternative, recorded where the code is"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "dated 2026-09-01 comment block in scripts/audit-mutation-harness.mjs at the suppression-cause enumeration, with a cross-reference at the hard-failure assignment; four grounds, rejected branch named, reversibility rated; the four enumerated suppression causes unchanged"
        status: pass
    human_judgment: true
    rationale: "Whether a recorded decision's stated grounds are honest and sufficient -- rather than a rationalisation written after the fact -- is exactly the judgment this phase's criterion 1 is about. The block's presence and its four grounds are mechanically checkable; their adequacy is not, and asserting otherwise would be the vacuity the phase exists against."
  - id: D9
    description: "[edge:CUT-04/adjacency] An introduced occurrence and an equal, textually OVERLAPPING pre-existing one are separated by position, never merged into one count"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "overlap-accepted asserts the exact byte shape: after == before with ONE newline inserted at matchIndex, compared as Buffers; lengthDelta 1 against expectedDelta 1; replacementVerbatimAtMatchIndex true. The same descriptor's whole-file difference computes 0, which is why the old form refused it."
        status: pass
    human_judgment: false
  - id: D10
    description: "[edge:CUT-04/ordering] Output order is the registry's own row order and it is STABLE -- across the report and across the write-back"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "the --all report prints all 61 rows in registry order with the 26 SKIPPED rows in their own positions rather than filtered out; the written-back registry preserves row order and row count exactly (rowOrderUnchanged true, added [], removed []), asserted by diffing the written registry against its committed state rather than by reading the report"
        status: pass
    human_judgment: false
  - id: D11
    description: "[edge:CUT-06/empty] The removal gate's temporary allow-list is EMPTY, and that is asserted rather than passed over"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "node scripts/check-no-regenerator2000.mjs -> exit 0, 412 files scanned, 157 occurrences permanently exempt, `0 temporarily allow-listed across 0 entries`. This round adds no entry. Before-state derived: this plan's whole diff against 01894b9 contains 0 occurrences of the gate's subject."
        status: pass
    human_judgment: false
  - id: D12
    description: "Ledger entry 35 closes on the measurement that discharges it, and no new entry is opened"
    requirement: "CUT-06"
    verification:
      - kind: other
        ref: "LEDGER OK {open:20, fixed:8, total:40, entry35:fixed, reason35Len:1263}; field-level diff against HEAD -> exactly one changed row (id 35, fields status/reason/resolved_at), order unchanged, 40 rows before and after"
        status: pass
    human_judgment: false
  - id: D13
    description: "Every figure recorded beside the broker state, the checkout root and the commit measured"
    verification: []
    human_judgment: true
    rationale: "Routed as a backstop by the plan: it is a property of how the record is written rather than of a command's exit status. A human should confirm the reading rather than have it auto-pass."

# Metrics
duration: 35 min
completed: 2026-09-01
status: complete
---

# Phase 32 Plan 21: The Overlap Arithmetic Corrected, and the Registry Write-Back Reached Summary

**The mutation harness's plant post-condition now measures the introduction of the recorded replacement AT ITS SITE rather than as a whole-file difference — so the one committed evidence row it used to refuse re-measures, and the whole-set `--all` sweep reaches the registry write-back it had been blocking (`measured=35 skipped=26 total=61`, 35 OBSERVED RED, zero refused, zero unmeasurable).**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-01T11:17:19Z
- **Completed:** 2026-09-01T11:52:02Z
- **Tasks:** 3
- **Files modified:** 5 (3 modified, 2 created)

## Environment, recorded once and repeated beside every figure

- **Checkout root for every figure:** `/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc279c1ee3498cde` — a GSD worktree on branch `worktree-agent-adc279c1ee3498cde`, forked from `01894b9`. **Not** the main checkout.
- **Broker state (D-13), read by `evidence/32-close-gate.md` §2b's method, read-only:**
  ```
  $ systemctl --user is-active vice-broker                 inactive   exit=4
  $ ps -eo pid,args | grep -i vice-broker | grep -v grep   (no output) exit=1
  ```
  **Inactive for every figure below.** A live broker reds `vice-proxy.test.ts`'s BACK-05 D–G ordering test deterministically — not as a flake — so a figure recorded without its broker state is void rather than merely unlabelled.
- **Tree baseline in THIS checkout is an EMPTY `git status --porcelain`.** The four pre-existing untracked files the main checkout carries at dispatch (`docs/dissambler-workflow.md`, `docs/undocumented-opcodes-ghidra.md`, `docs/vice-mcp-ideas.md`, `skills-lock.json`) are **not** present in a fresh worktree, so every "tree returned to baseline" claim here means *zero porcelain lines in this worktree*, apart from this plan's own tracked edits, which are named where they appear. The plan's own task preconditions are worded for the main checkout; they were evaluated on their substance and met.
- **`grep -a` throughout.** A plain `grep` silently skips a file containing a NUL byte and has already produced one false decision in this project.

Full record with every raw command and its raw output: **`.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap1-overlap-and-writeback.md`**.

## Accomplishments

- **Gap 1 is closed at its cause.** The whole-file difference form is deleted and replaced by a per-site check that is exact under overlap. The honest descriptor it used to refuse is now accepted, and the mutation it applies is a real +1 byte.
- **The previously-unreachable registry write-back was REACHED and observed on disk**, then discarded under `D-08` with its diff shape recorded first.
- **Every fix landed with a guard watched failing first** — a natural RED per task, plus two planted-regression bite proofs for the arithmetic.
- **`WR-36` is discharged.** The plant contract, which had no standing coverage at all, now has eight cases driven one per spawned child.
- **Two cheap hardenings taken rather than deferred**, on the stated uniform rule: `CR-11` (silent latin1 truncation) and `WR-34` (misattributed containment refusal), both inside the function gap 1 already rewrote.
- **Ledger entry 35 closed on the sweep line that discharges it**, with no new entry opened, and every remaining finding named in a deferral register.

## Task Commits

1. **Task 1 (tdd) — RED:** `3f2a276` (test) — the plant-contract driver and six cases, `overlap-accepted` failing against the unfixed harness
2. **Task 1 — GREEN:** `e865288` (fix) — the per-site post-condition, the corrected comment
3. **Task 2 (tdd) — RED then GREEN in one commit:** `77b7323` (fix) — `CR-11` latin1 refusal and `WR-34` attribution, with both new cases
4. **Task 3:** `e5e6ae4` (docs) — the write-back decision at the site, the whole-set sweep, entry 35 closed, the evidence file

_STATE.md and ROADMAP.md are the orchestrator's to write; this branch does not touch them._

## Files Created/Modified

- `scripts/audit-mutation-harness.mjs` — the per-site post-condition replacing the whole-file counters; the corrected `CR-09` comment naming the measured case and the inherited defect; the `CR-11` latin1-representability refusal; the `WR-34` plant-target re-attribution; the dated write-back decision block
- `src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs` — **new**; one named case per invocation against its own scratch root, one JSON verdict line, no sweep entry point, no registry read, no signal handler
- `src/mcp/vice/audit-harness-restore.test.ts` — the eight-case plant-contract group and a header recording the file's second scope, why the two halves share a file, and why the name is left unchanged
- `.planning/WINDOWS.md` — entry 35 closed with its citation
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap1-overlap-and-writeback.md` — **new**; the full record

## The recorded figures

### Comment-stripped, NUL-safe census — verbatim

```
$ grep -ac 'narrowing costs nothing' scripts/audit-mutation-harness.mjs          0
$ grep -avE '^[[:space:]]*(//|\*|/\*)' scripts/audit-mutation-harness.mjs > code-only.txt
$ grep -ac 'preExisting'            code-only.txt                                0
$ grep -ac 'afterMutation'          code-only.txt                                0
$ grep -acE 'await|async |\.then\(' code-only.txt                                0
$ grep -ac 'matchIndex'             scripts/audit-mutation-harness.mjs           3
$ grep -ac 'hop-chain-comments'     scripts/audit-mutation-harness.mjs           2
$ grep -ac 'latin1'                 scripts/audit-mutation-harness.mjs           8   (>= 3)
$ grep -ac 'CR-11'                  scripts/audit-mutation-harness.mjs           2   (>= 1)
$ grep -ac 'WR-34'                  scripts/audit-mutation-harness.mjs           2   (>= 1)
```

The two counter censuses are comment-stripped **in reverse** of the usual reason: the replacement comment describes the deleted bindings by concept and never reproduces their identifiers, so it cannot invalidate its own census. The deleted sentence is not re-quoted anywhere, which is why its whole-file count is a real zero.

The module is still **wholly synchronous** — zero code occurrences of `await`, `async ` or `.then(`. Plan 32-19's standing prohibition against injecting an `await` is not lifted.

### Export surface — unchanged, no fourth symbol

```
$ node -e 'import("./scripts/audit-mutation-harness.mjs").then(m=>process.stdout.write(Object.keys(m).sort().join(",")))'
pendingRestoreCount,plant,restoreAll
```

### THE RED for gap 1, quoted verbatim

Against the harness as plan 32-20 left it, before a line of the fix existed:

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=1
ok 1 - SIGINT delivered inside the plant window exits 130 and restores byte-for-byte
ok 2 - SIGTERM delivered inside the plant window exits 130 and restores byte-for-byte
ok 3 - negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical
ok 4 - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
ok 5 - gap 2 / CR-10: SIGINT in the SECOND window -- after a restore cycle has already completed -- still restores
ok 6 - gap 2 / CR-10: SIGTERM in the SECOND window -- after a restore cycle has already completed -- still restores
ok 7 - the attempt log is complete and every recorded exit code is the discriminating one
not ok 8 - plant contract / overlap-accepted: a replacement that textually overlaps its own pre-existing occurrence is accepted, and the file grows by exactly one byte at the match position
ok 9 - plant contract / pre-existing-replacement-accepted: ...
ok 10 - plant contract / substitution-is-verbatim: ...
ok 11 - plant contract / find-absent-refused: ...
ok 12 - plant contract / find-twice-refused: ...
ok 13 - plant contract / empty-replacement-refused: ...
# tests 13   # pass 12   # fail 1   # duration_ms 2067.9969
```

The failure is the harness's own post-condition:

```
the overlap descriptor was REFUSED: row fixtures/harness-signal/plant-contract-driver.mjs: plant
post-condition FAILED for plant-contract-target.txt -- the recorded `replace` string occurs 1
time(s) in that file BEFORE the mutation and 1 time(s) after it, so the mutation would INTRODUCE
it 0 time(s); exactly 1 is required. ... (CR-02, CR-06).
```

**Exactly one failure, and it is the new case.** Every other case, and every case 32-20 left green, passes in that same run — which is what proves the new case is doing the work.

### THE GREEN

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=0
# tests 13   # pass 13   # fail 0   # duration_ms 1850.395506
```

And after Task 2's two cases were added:

```
ok 1  - SIGINT delivered inside the plant window exits 130 and restores byte-for-byte
ok 2  - SIGTERM delivered inside the plant window exits 130 and restores byte-for-byte
ok 3  - negative control: the same driver finishing WITHOUT a signal exits 0 and is also byte-identical
ok 4  - WR-03: after a first restoreAll(), a second call is a genuine no-op rather than a re-write
ok 5  - gap 2 / CR-10: SIGINT in the SECOND window ... still restores
ok 6  - gap 2 / CR-10: SIGTERM in the SECOND window ... still restores
ok 7  - the attempt log is complete and every recorded exit code is the discriminating one
ok 8  - plant contract / overlap-accepted: ...
ok 9  - plant contract / pre-existing-replacement-accepted: ...
ok 10 - plant contract / substitution-is-verbatim: ...
ok 11 - plant contract / find-absent-refused: ...
ok 12 - plant contract / find-twice-refused: ...
ok 13 - plant contract / empty-replacement-refused: ...
ok 14 - plant contract / non-latin1-refused: ...
ok 15 - plant contract / bad-plant-target-attribution: ...
# tests 15   # suites 0   # pass 15   # fail 0   # skipped 0   # todo 0   # duration_ms 2521.554908
```

### BITE PROOF 1 — the whole-file difference form restored

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=1
not ok 8 - plant contract / overlap-accepted: ...
# tests 13   # pass 12   # fail 1
```

**Only `overlap-accepted` goes red; every other case stays green.** Plant removed → `exit=0`, 13/13.

### BITE PROOF 2 — the substitution reverted to a replacement STRING

The plant is one line: `text.replace(descriptor.find, () => descriptor.replace)` → `text.replace(descriptor.find, descriptor.replace)`.

```
$ cd src/mcp/vice && node --test audit-harness-restore.test.ts        exit=1
not ok 10 - plant contract / substitution-is-verbatim: ...
# tests 13   # pass 12   # fail 1
```

**And the failure is reported BY the post-condition's own message**, which is the whole point:

```
the plant was REFUSED: row fixtures/harness-signal/plant-contract-driver.mjs: plant post-condition
FAILED for plant-contract-target.txt -- the recorded `replace` string did not land verbatim at the
unique match position. At index 56 the mutated text does NOT begin with the recorded replacement,
and the mutation changes the text by 30 character(s) where an exact substitution would change it
by 3. Either fact failing means the bytes this harness would write are not the bytes this row
records -- the CR-02 divergence class ... Do NOT edit the recorded evidence to satisfy this check:
the descriptor is the record and the instrument is what moves (CR-02, CR-06, CR-09).
```

Both facts fail together: the position assertion is **FALSE** and the delta is **+30** against an expected **+3**. (The planner measured the same phenomenon as +2 against an expected −4 on a different descriptor; the numbers differ because the descriptor differs, and this SUMMARY records what was measured here.) **So the corrected post-condition is a pin on the `CR-02` fix, not a tautology.** Plant removed → 13/13.

### `CR-11` — the silent truncation, before and after

**BEFORE** (harness as Task 1 left it) — the SILENT outcome, which is the demonstration that the finding was real rather than theoretical:

```
{"case":"non-latin1-refused","planted":true,"refusalMessage":null,
 "replacementVerbatimAtMatchIndex":false,"pendingRestoreCount":1,
 "bytesAtMatchIndexBase64":"SEFSTkVTU19QTEFOVF9DT05UUkFDVF9FFFRBSUw="}
```

The descriptor's replacement is `HARNESS_PLANT_CONTRACT_E—TAIL` carrying **U+2014**; the bytes that reached disk decode as `HARNESS_PLANT_CONTRACT_E` + `0x14` + `TAIL`. The plant SUCCEEDED and wrote bytes the descriptor does not record — and said nothing.

**AFTER:**

```
row fixtures/harness-signal/plant-contract-driver.mjs: plant descriptor field `replace` is NOT
latin1-representable -- code point U+2014 at index 24. The mutated text is written through a
latin1 buffer, which would TRUNCATE it, while the post-condition below compares the untruncated
string -- so the bytes on disk would differ from the bytes this row records and NOTHING would say
so. Refused before any path resolution and before any read or write (CR-11).
```

Nothing written; target byte-identical; pending count 0. **The check sits AFTER the non-empty-string field loop and BEFORE the containment call**, hence before the `readFileSync`, the occurrence check, the substitution, the post-condition and the write — verified by reading the function, and the surrounding order is named here so a later reader can check it.

### `WR-34` — both states, and containment untouched

**BEFORE:** `--root "<root>/plant-contract-escape-target.txt" resolves to ... which is OUTSIDE the repository root <root>/.harness-signal-scratch-t2a. Refusing: this flag decides which tree the audit reads and writes ...`

**AFTER:** `row fixtures/harness-signal/plant-contract-driver.mjs: this row's \`plant.file\` field names a path ("../plant-contract-escape-target.txt") that is outside the tree this run was pointed at. The path came from the REGISTRY, not from a \`--root\` argument, so the row is what needs correcting. Containment refusal, verbatim: --root "..." resolves to ... OUTSIDE the repository root ... (WR-34)`

**`planted: false` in BOTH states.** That is the assertion that matters, and the test says so in words: *"CONTAINMENT WAS RELAXED … This assertion is the one that must never change."* Same resolver, same arguments, same decision; only the attribution moved.

### Pre-flight controls, taken BEFORE the sweep

```
$ git rev-parse HEAD                    77b7323a134bd29972eda901d300e77cd1a9c6cf
$ systemctl --user is-active vice-broker   inactive   exit=4
$ ps -eo pid,args | grep -i vice-broker | grep -v grep   (no output)  exit=1
$ git rev-parse --show-toplevel         <the worktree>
$ git status --porcelain                 M scripts/audit-mutation-harness.mjs
$ node scripts/audit-gate.mjs
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
exit=0
```

The standalone gate is the UNPLANTED control for one of the 35 rows; in the round-3 verifier's sweep it exited 1 on a transiently red docs guard and made that row UNMEASURABLE for a reason unrelated to the plant. It was **re-taken here**, not imported from the planner's figure. The single porcelain line is this plan's own uncommitted Task-3 comment, carried in the harness's own baseline.

### The whole-set sweep

```
$ node scripts/audit-mutation-harness.mjs --all --out <a fresh gitignored scratch path>
...
  counts: measured=35 skipped=26 total=61
  evidence: <the scratch path>
  registry: <...>/guard-fates.json
  tree: restored byte-identical to the baseline
exit=0
```

Run unbounded in the background, never under a short shell timeout, and never as a partial selection. **Its raw unedited stdout is pasted between two sentinel lines in the evidence file, and the counts below are machine-checked INSIDE that region only** — deliberately, because the surrounding prose legitimately discusses a refused plant and an unmeasurable row as gap 1's own history:

| Assertion | Required | Measured |
|---|---|---|
| `counts: measured=35 skipped=26 total=61` | exactly 1 | **1** |
| `OBSERVED RED` | exactly 35 | **35** |
| `SKIPPED` | exactly 26 | **26** |
| `tree: restored byte-identical to the baseline` | exactly 1 | **1** |
| `registry: NOT written` | exactly 0 | **0** |
| `PLANT REFUSED` | exactly 0 | **0** |
| `UNMEASURABLE` | exactly 0 | **0** |

The row this round is about appears as `OBSERVED RED  src/mcp/vice/hop-chain-comments.test.ts: guard exit status 1 (control exit status 0)`, and the last summary line reads `registry: <path>` rather than `registry: NOT written (...)`.

### The registry write-back — shape recorded, then discarded

```
$ git diff --numstat -- .../guard-fates.json
56      56      .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json

$ <field-level comparison against HEAD>
{"rowCountBefore":61,"rowCountAfter":61,"rowOrderUnchanged":true,"added":[],"removed":[],
 "recordedRedBlocksRefreshed":30,"evidenceOwingNothingRows":26,"evidenceOwingNothingRowsTouched":0}

$ git checkout -- .../guard-fates.json
$ git diff --quiet -- .../guard-fates.json        exit=0
```

Every one of the 30 changed rows carries verdict `re-pointed`, and the list includes `src/mcp/vice/hop-chain-comments.test.ts` — the row that could not be measured at all before this plan.

**An honest note on 30 versus 35.** The sweep rewrites `observedRed` for all **35** measured rows; only **30** DIFFER byte-wise from what was committed, the other 5 coming back identical. "35 rewritten / 30 changed" is the accurate statement, and the measured 30 is recorded rather than the round number the plan anticipated.

`git diff --quiet` exiting 0 is the machine-checked form of *no dated row was replaced by this plan*. **The criterion asked for is satisfied by the write HAVING HAPPENED and having been observed on disk; the discard is a separate recorded decision under `D-08` and does not undo the proof.**

### The write-back decision, recorded at the site

**A refused plant BLOCKS the whole-set registry write-back, and the refused-plant flag is NOT separated from the failed flag.** Four grounds: the basis (a partial write-back mixes fresh and committed evidence with nothing recording which is which — the laundering this phase exists against); the precedent (two fail-closed rules already within twenty lines of the site, both on the ground that an empty measurement is not a green); reachability proven by the run above rather than argued; and the rejected branch named and **rejected on the basis, not on effort**. Reversibility: **reversible** — the alternative is a two-line change at the same site. The four enumerated suppression causes are unchanged and the refusal remains a separately named cause.

### Ledger entry 35

```
LEDGER OK {"open":20,"fixed":8,"total":40,"entry35":"fixed","reason35Len":1263}

rows before=40 after=40
changed rows: [{"id":35,"fields":["status","reason","resolved_at"]}]
order unchanged: true
```

One closure against plan 32-20's 21-open / 7-fixed / 40-total ledger gives **20 open, 8 fixed, 40 total**. `git diff -- .planning/WINDOWS.md` is 6 insertions / 6 deletions across three hunks: the frontmatter counters, entry 35's markdown row, and entry 35's JSON `status`/`resolved_at`. **Exactly one status transition; no pre-existing row reordered, renumbered or reworded; ids strictly ascending. NO new entry opened.**

### The removal gate's EMPTY terminal state

```
check-no-<subject>: OK -- scanned 412 files (382 tracked outside ".planning/" + 30
  shipped-but-untracked installer paths, floor 350); 157 occurrence(s) permanently exempt,
  0 temporarily allow-listed across 0 entries.
exit=0
```

**157 permanent exemptions and a temporary allow-list that is EMPTY — 0 occurrences across 0 entries.** An empty allow-list is what a completed cutover looks like; a gate that would pass equally with entries in it has not been checked, which is why the emptiness is recorded as a figure rather than left implicit behind the exit status. This round adds no entry. The before-state is derived rather than measured — see Deviations, item 3.

### Other gates

```
$ node scripts/check-guard-fates.mjs          exit=0
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 856.

$ node scripts/audit-gate.mjs                 exit=0
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status

$ cd src/mcp/vice && npm run typecheck        exit=0   (tsc --noEmit -p tsconfig.json, no diagnostics)
```

### `npm run test:automated`, and what its exit code MEANS

```
$ cd src/mcp/vice && npm run test:automated       exit=1
# tests 3027   # suites 24   # pass 3020   # fail 1   # skipped 1   # todo 5   # duration_ms 45090.345748
```

Broker **inactive**; worktree root; commit `77b7323` plus Task 3's working-tree changes.

**What the exit code means, rather than quoted bare.** `test:automated` runs the **automated glob only**, skipping the manual-only list, and it carries a historical failure baseline of its own — **the 44-, 7- and 5-failure baselines are SUPERSEDED and the clean floor here is ZERO**. So a non-zero failure count is a regression unless attributed, and this one is:

```
not ok 1554 - path agreement (D-3, D-6, THE regression this task exists to catch): ...
  location: '.../src/mcp/vice/repo-root.test.ts:178:1'
  error:    'the agreed directory must not sit under .claude -- got <worktree>/.vice-supervisor'
```

That is **broken-windows entry 36**, already on the ledger and already open: the `!includes('.claude')` substring predicate fails **unconditionally** when the suite runs from a GSD worktree under `.claude/worktrees/`. It is a property of WHERE this checkout is, not of what this plan changed, and it is expected ABSENT from the main checkout after the wave merges. Recorded, not worked around, and not counted against this plan. **On this plan's own subject the floor is met: 0 failures attributable to anything it touched.**

**The whole-glob `npm test` was NOT run, and that is a statement rather than an omission.** It blocks indefinitely on `vice-proxy.test.ts` — broken-windows entry **26**, previously measured still running when killed at 300106 ms and `exit=124` under a 180 s bound. `npm run test:automated` is the terminating gate and is the figure above.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one: **the refused-plant block on the write-back stays, and the reasoning is written where the code is.** The rejected alternative — separating the refused-plant flag from the failed flag so a refusal does not suppress the write-back for the other rows — is cheap to implement and was rejected anyway, because a partial write-back produces a registry a reader cannot audit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm ci` in the worktree**

- **Found during:** Task 1, verification
- **Issue:** A fresh worktree has no `src/mcp/vice/node_modules`, so `npm run typecheck` and `npm run test:automated` could not run. (`node --test audit-harness-restore.test.ts` needs none — it imports only node builtins — so both REDs were taken before this.)
- **Fix:** `npm ci --no-audit --no-fund` from the committed lockfile — the project's own provisioning step (`scripts/ensure-mcp-deps.sh`). **No package was added; no manifest or lockfile changed**, so the package-legitimacy exclusion to Rule 3 does not apply.
- **Files modified:** none tracked (`node_modules/` is gitignored)
- **Verification:** `git status --porcelain` unchanged; `npm run typecheck` exit 0
- **Committed in:** nothing — no tracked file changed

**2. [Rule 3 - Blocking] `reason` had to be hand-written into `.planning/WINDOWS.md`**

- **Found during:** Task 3, action E
- **Issue:** The plan requires entry 35's closure to cite the sweep's own output line and the standing `overlap-accepted` case. `gsd-tools windows fixed <id>` sets `status` and `resolved_at` but leaves `reason` empty and takes no reason argument, so the citation could not be written through the tool. **This is the same defect plan 32-20 recorded**, hit again for the same cause.
- **Fix:** A script wrote `reason` for row 35 — **and only row 35** — into both representations the file carries. It refuses to run unless the target row is already `fixed` with an empty `reason`, refuses a reason containing a pipe or a newline, and asserts it made exactly one edit in each representation.
- **Files modified:** `.planning/WINDOWS.md`
- **Verification:** `windows status --raw` re-read afterwards round-trips the reason (`reason35Len: 1263`) with counters intact; the field-level diff shows row 35 changed only `status`/`reason`/`resolved_at` and no other row changed at all
- **Committed in:** `e5e6ae4`

**3. [Rule 1 - Bug] The removal gate's "before" reading was taken by an INVALID method, detected, and replaced**

- **Found during:** Task 3, action F
- **Issue:** To read `check-no-regenerator2000.mjs` at the plan's base I parked this plan's three files out of the working tree and ran the gate. That measurement is **invalid**: the new driver is *tracked at HEAD*, so removing it from the worktree made the gate fail with `scope: src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs is in the scope set but is not on disk -- the walk or the pack list is stale` plus a non-vacuity error. It measured the experiment, not the tree. Recording it as a before-reading would have been a fabricated figure.
- **Fix:** The files were restored (`git restore --staged` on the two tracked paths — index only, working tree untouched — after a path-scoped `git checkout <base> -- ...` had staged base content), the gate returned to exit 0, and the before-state was established by **derivation** instead: `git diff 01894b9 -- .` is 933 lines and `grep -aci 'regenerator2000'` over it returns **0**, and none of the three files appears in any of the twelve exact-pin exemption groups — so the 412/157/0/0 figures are unchanged by construction.
- **Files modified:** none (net)
- **Verification:** `node scripts/check-no-regenerator2000.mjs` exit 0 after the restore; `git status --porcelain` back to exactly this plan's own tracked edits
- **Committed in:** nothing — the invalid experiment left no residue. Recorded here and in the evidence file §4 rather than dropped.

**4. [Rule 2 - Missing Critical] The Task-2 driver cases were held back out of Task 1's commit**

- **Found during:** Task 1, action A
- **Issue:** The driver was first written with all eight cases, including Task 2's `non-latin1-refused` and `bad-plant-target-attribution`. That would have made Task 2's "captured RED against the harness as Task 1 left it" untrue in the commit history — the cases would have existed unexercised in an earlier commit.
- **Fix:** The two Task-2 cases and their constants were removed before Task 1's commit and re-added in Task 2, so each task's RED is genuinely against the state the previous task left.
- **Files modified:** `src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs`
- **Verification:** Task 1's committed driver carries six cases; Task 2's commit adds two
- **Committed in:** `3f2a276` and `77b7323`

---

**Total deviations:** 4 auto-fixed (1 bug, 2 blocking, 1 missing-critical)
**Impact on plan:** No scope creep. Deviations 1 and 2 are tooling gaps worked around without changing what was delivered; 3 is a measurement this plan caught itself producing dishonestly and replaced with a sound one; 4 is a commit-boundary correction that makes the recorded RED/GREEN sequence true rather than nominal.

## Issues Encountered

- **`npm run test:automated` cannot reach a 0-failure floor from a GSD worktree**, for a reason already ledgered as entry 36 (`repo-root.test.ts:178`'s `.claude` substring predicate). Recorded, not worked around, and not counted against this plan. It is expected absent from the main checkout after the wave merges — the orchestrator should re-measure there.
- **The plan's task preconditions are worded for the main checkout.** They ask that `git status --porcelain` list "exactly the four pre-existing untracked files". In a fresh worktree the correct baseline is an **empty** porcelain. Each precondition was evaluated on its substance (previous task committed, tree at its own baseline) and **met**; the wording mismatch is recorded rather than silently reinterpreted. Plan 32-20 hit the same thing.
- **The sweep's registry write-back is proved and then thrown away.** That is deliberate and reasoned (`D-08`), but it means the committed registry still carries its 2026-08-31 evidence. A reader wanting fresh evidence committed must do so as a deliberate act with its own reasoning.
- **An executor slip, recorded rather than hidden: `gsd-tools windows append` was invoked as an availability PROBE and performed a live write.** It appended a placeholder entry (id 41) to `.planning/WINDOWS.md` *after* the ledger work was already committed at `e5e6ae4`. The verb has no dry-run mode; treating it as one was the mistake. It was reverted immediately with a path-scoped `git checkout -- .planning/WINDOWS.md`, and the state was re-verified through the tool's own reader afterwards: `{open: 20, fixed: 8, total: 40, maxId: 40, entry35: "fixed"}` and `grep -ac 'PLACEHOLDER-DRY-RUN' .planning/WINDOWS.md` = 0. **Zero residue, and no commit ever contained it** — but the ledger is a shared cross-phase register and a momentary bad write to it belongs on the record, not in the executor's head. No new entry is opened by this plan, which is what the plan requires and what the ledger now reflects.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or unwired data source was introduced. No test was skipped, and every `<verify>` in the plan was run — the only one whose exit status is non-zero is `npm run test:automated`, whose single failure is attributed above and already on the ledger.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema at a trust boundary was added. The one new file is a test fixture that writes only inside a caller-supplied, gitignored scratch root and registers no handler of its own.

The threat register's six `mitigate` dispositions were all applied:

- **T-32-44** (weakening the post-condition) — both new facts are HARD throws before any byte is written; `substitution-is-verbatim` asserts the on-disk bytes equal the recorded replacement uninterpreted; and bite proof 2 reverted the replacer form and required the post-condition's own message to report it.
- **T-32-45** (latin1 truncation) — refused by name before any path resolution or write; the whole-set sweep confirms the refusal fires on no committed row.
- **T-32-46** (registry-supplied plant target) — the `bad-plant-target-attribution` case asserts the refusal happens in BOTH states, so a message improvement cannot become a relaxation. Containment code, arguments and decision are unchanged.
- **T-32-47** (abandoned plant from the sweep) — per-row revert, the single `restoreAll()` in the sweep's `finally`, 32-20's latch removal keeping it armed, the sweep's own tree-cleanliness assertion after every row, a recorded porcelain baseline, and a post-sweep porcelain check. The sweep reported `tree: restored byte-identical to the baseline`.
- **T-32-48** (write-back repudiation) — the diff SHAPE was recorded while the write was still on disk, and the discard's success is machine-checked by `git diff --quiet` exiting 0.
- **T-32-49** (ledger mutation through a CLI verb) — the ledger was diffed after the single closure, ids asserted strictly ascending, both representations kept consistent, and the three counters reconciled arithmetically against plan 32-20's post-state.

**T-32-SC** is `not applicable` and remains so: this plan ran no package-manager install that adds a dependency. The one `npm ci` was a lockfile-only provisioning step, recorded as deviation 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Verifier truth 14 should now read VERIFIED.** Any row can be re-measured by the committed instrument, and the whole-set `--all` command regenerates the artefact rather than reporting the write-back suppressed — proven by a run, not by an argument.
- **`WR-36` is discharged.** The three behaviours it named as uncovered — the post-condition arithmetic, the SKIPPED reporting and the refused-plant reporting — are now exercised by a standing case group. (SKIPPED and refused-plant reporting are covered by the sweep transcript's region-scoped counts and by the four refusal cases respectively; the arithmetic by `overlap-accepted` and `substitution-is-verbatim`, both watched biting.)
- **`CR-11` and `WR-34` are closed** while latent and diagnosis-only respectively; neither moved a committed row.
- **Ten review findings and ten ledger entries are deferred BY NAME** with the reason each is out of scope, under one stated uniform rule. See evidence §7. **No disposition is re-opened and there are no dissents.**
- **One observation for a later sweep, recorded without acting on it:** ledger entry **38**'s stated content appears DISCHARGED by the round-3 verifier's own measurement of that guard at 62/62 with a planted ninth script. Recommended for a ledger sweep outside this round; this plan's scope is entry 35 only.
- **STATE.md and ROADMAP.md are untouched**, per worktree mode — the orchestrator owns those writes after the wave merges.
- **No file was deleted anywhere on this branch** (`git diff --diff-filter=D --name-only 01894b9..HEAD` is empty), so `cleanup-wave`'s deletion refusal does not apply and the branch merges normally.
- **`REQUIREMENTS.md`:** `CUT-04` and `CUT-06` were declared by both 32-20 and this plan; with this SUMMARY on disk the shared-ID gate releases them.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-09-01*

## Self-Check: PASSED

Every file this SUMMARY claims was created or modified exists on disk, and every commit hash it
cites resolves on this branch. Checked from
`/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-adc279c1ee3498cde`.

```
FOUND  scripts/audit-mutation-harness.mjs                                        59826 bytes
FOUND  src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs            12544 bytes
FOUND  src/mcp/vice/audit-harness-restore.test.ts                                53628 bytes
FOUND  .planning/WINDOWS.md                                                      57602 bytes
FOUND  .planning/phases/32-.../evidence/32-gap1-overlap-and-writeback.md         50210 bytes
FOUND  .planning/phases/32-.../32-21-SUMMARY.md

$ git log --oneline 01894b9..HEAD
<HEAD>  docs(32-21): complete the overlap-arithmetic and write-back plan   <- this commit; a file
                                                                          cannot record the hash
                                                                          of the commit that
                                                                          contains it
e5e6ae4 docs(32-21): record the write-back decision, sweep the whole set, close ledger entry 35
77b7323 fix(32-21): refuse a non-latin1 descriptor by name, and attribute a bad plant target to the registry
e865288 fix(32-21): measure the plant's introduction at its site, not as a whole-file difference
3f2a276 test(32-21): add failing plant-contract case group and its in-process driver

$ git diff --diff-filter=D --name-only 01894b9..HEAD
                (empty — no file deleted anywhere on this branch)

$ git status --porcelain
                (empty — this worktree's baseline)
```

`REQUIREMENTS.md` was NOT modified: `requirements.ready-ids` returned **2/2 ready** once this
SUMMARY existed, and `requirements.mark-complete CUT-04 CUT-06` reported both
`already_complete` — so there was nothing to write.
