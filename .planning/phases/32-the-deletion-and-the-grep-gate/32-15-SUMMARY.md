---
phase: 32-the-deletion-and-the-grep-gate
plan: 15
subsystem: testing
tags: [audit-harness, mutation-testing, guard-fates, evidence, node]

requires:
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "the 61-row guard-fates registry, the 35 machine-captured observed reds, and the plant post-condition added by plan 32-14 (whose arithmetic is CR-06)"
provides:
  - "A plant post-condition that counts INTRODUCED occurrences (post-mutation minus pre-existing) rather than total occurrences in the mutated file"
  - "A failure message that reports three separate counts and never instructs a reader to edit recorded evidence"
  - "A verdict-driven SKIPPED branch in measureRow(): kept-unchanged and deleted rows owe a removal trigger, not a planted red (D-05)"
  - "A per-row PLANT REFUSED report, so one bad descriptor fails the run without aborting the sweep (IN-10)"
  - "A measured/skipped/total counts line and a distinct all-skipped hard failure"
  - "evidence/32-gap4-sweep-rerun.md — the first whole-set --all sweep that COMPLETES, 61 sections, plus two appended dated sections"
affects: [32-16, 32-17, 32-18, 32-19, milestone-close]

actuals:
  tokens: 129000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A hard assertion's BLAST RADIUS is separable from its strictness: a refused plant still writes nothing, still suppresses the write-back and still exits 1, but is reported against its own row instead of aborting the loop"
    - "Verdict-driven evidence obligations (D-05) encoded as a branch, with the opposite direction kept strict so a missing descriptor cannot hide in the skip"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
  modified:
    - scripts/audit-mutation-harness.mjs

key-decisions:
  - "The verifier's prescribed two-count subtraction was implemented verbatim; when a THIRD blocker appeared it was closed by containing the refusal to its row, NOT by loosening the arithmetic"
  - "The four UNMEASURABLE rows in the first completed sweep were diagnosed (a fresh worktree carries no src/mcp/vice/node_modules) and the cause removed with the repository's own npm ci, rather than re-run until green"
  - "The one PLANT REFUSED row is left refused and recorded by name; its descriptor was not edited and no opt-out was added"
  - "test:automated's single failure is a worktree-location artifact; the 0-failure floor was NOT raised"

patterns-established:
  - "Every recorded figure carries the broker state read beside it, by 32-close-gate.md's ps form rather than pgrep (D-13)"
  - "A harness-written evidence file is committed byte-identical and extended only by appended dated sections, proven by hashing the prefix"

requirements-completed: [CUT-04, CUT-06]

coverage:
  - id: D1
    description: "plant()'s post-condition counts introduced occurrences (post-mutation minus pre-existing) and requires exactly 1; both failing directions still throw before any byte is written"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "node scripts/audit-mutation-harness.mjs --row <case> --root <scratch> (three descriptors driven through the real CLI: introduced 1 plants, introduced 0 throws, introduced 2 throws)"
        status: pass
      - kind: integration
        ref: "node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs — exit 1 before the fix, exit 0 with OBSERVED RED after"
        status: pass
    human_judgment: false
  - id: D2
    description: "No message in the instrument tells a reader to change a recorded value"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "grep -c 'Fix the descriptor rather than the assertion' scripts/audit-mutation-harness.mjs -> 0 (1 at HEAD)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A row whose verdict owes no observed red is reported SKIPPED in its registry position; a re-pointed row missing its descriptors is still a hard failure"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "node scripts/audit-mutation-harness.mjs --rows scripts/lib/skill-descriptions.mjs -> SKIPPED + all-skipped hard failure, exit 1"
        status: pass
      - kind: integration
        ref: "scratch registry row verdict=re-pointed with no guard -> 'no `guard` descriptor', exit 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "The whole-set --all sweep COMPLETES: 61 per-row summary lines, the counts line, the registry decision and the tree line, all printed after the row loop ends"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "node scripts/audit-mutation-harness.mjs --all --out evidence/32-gap4-sweep-rerun.md -> 'counts: measured=35 skipped=26 total=61' + final summary block"
        status: pass
    human_judgment: false
  - id: D5
    description: "No dated record was rewritten: guard-fates.json is byte-identical to HEAD and the round-1 evidence file was never the output target"
    requirement: "CUT-04"
    verification:
      - kind: other
        ref: "git diff --numstat -- .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json -> empty; node scripts/check-guard-fates.mjs -> exit 0, same measured line"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every figure in this plan carries the VICE broker's state, read beside it by 32-close-gate.md's recorded method"
    verification: []
    human_judgment: true
    rationale: "This is a property of how the record was WRITTEN, not of a command's exit status. No assertion can confirm that a figure and its broker reading were taken together; a human reading evidence/32-gap4-sweep-rerun.md must confirm it. Routed as a backstop by the plan itself (edge:CUT-06/concurrency)."
  - id: D7
    description: "One registry row (src/mcp/vice/hop-chain-comments.test.ts) still cannot be re-measured by the committed instrument, and is reported by name rather than hidden"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "the --all sweep's 'PLANT REFUSED src/mcp/vice/hop-chain-comments.test.ts' line, quoted verbatim in evidence/32-gap4-sweep-rerun.md"
        status: pass
    human_judgment: true
    rationale: "The MEASUREMENT passes — the row is reported by name, exactly as intended. What needs a human is the DISPOSITION: whether CUT-04's re-runnability promise is acceptable at 34 of 35 rows, or whether that descriptor needs its own plan. Recorded in .planning/WINDOWS.md as an open unmet-truth."

duration: 20 min
completed: 2026-09-01
status: complete
---

# Phase 32 Plan 15: Gap 4 — the instrument that refused honest evidence Summary

**The mutation harness's plant post-condition now counts what the mutation introduced instead of what the file contains, a refused plant fails its own row instead of aborting the loop, and rows whose verdict owes no observed red are reported SKIPPED — so the whole-set `--all` sweep completes for the first time: 35 measured, 26 skipped, 61 total.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-01T07:00Z (first recorded timestamp in this plan's evidence: the 07:02:52Z broker read)
- **Completed:** 2026-09-01T07:18Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **The post-condition is arithmetically correct.** `plant()` counts occurrences of `descriptor.replace` in the ORIGINAL text and again in the mutated text and requires the DIFFERENCE to be exactly 1 — the form `gaps[2].missing[0]` states. Both throwing directions remain reachable and were driven through the real CLI.
- **The failure message no longer instructs a reader to edit the evidence.** `grep -c 'Fix the descriptor rather than the assertion'` returns **0** (it returned **1** at HEAD). The replacement reports three separate counts, states that a mismatch means the written bytes are not the recorded bytes, states that nothing was written, and cites `CR-02, CR-06`.
- **`measureRow()` encodes D-05.** A `kept-unchanged` or `deleted` row is reported SKIPPED, in its registry position, with its verdict named. A `re-pointed` row missing `plant` or `guard` is still a hard failure with the existing message — the skip is driven by the verdict, never by the absence of a descriptor.
- **A THIRD blocker was measured and closed.** After the arithmetic was corrected the sweep still aborted, at `src/mcp/vice/hop-chain-comments.test.ts`. A refused plant is now contained to its own row.
- **The whole-set sweep completes.** `counts: measured=35 skipped=26 total=61`, 61 sections in the evidence file, 34 OBSERVED RED, 1 PLANT REFUSED, 26 SKIPPED, exit 1 — honestly.
- **No dated record was rewritten.** `guard-fates.json` is byte-identical to HEAD; the round-1 evidence file was never an output target.

## Task Commits

1. **Task 1: post-condition arithmetic, message, D-05 skip branch, counts line** — `5032275` (fix)
2. **Task 1 (continued): contain a refused plant to its own row** — `e1abf16` (fix) — the third blocker, measured during Task 2
3. **Task 2: the whole-set `--all` sweep, run and captured** — `24fe94a` (docs)
4. **Task 3: the close-gate half, re-run beside its broker state** — `6a595a8` (docs)

## Files Created/Modified

- `scripts/audit-mutation-harness.mjs` — the post-condition, its message, the verdict-driven skip, the PLANT REFUSED containment, the counts line, the all-skipped hard failure, and an accurate write-back-suppression reason
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md` — the harness's own 61-section output (byte-identical, sha256 `67e5e325…`) plus two appended dated sections

## Broker state — recorded beside every figure

Read read-only, by `evidence/32-close-gate.md`'s method (the `ps … | grep -v grep` form, **not** `pgrep -af`, which self-matches its own command line). Read three times: before Task 1, before the sweep, and before the suite. Identical every time.

```
$ systemctl --user is-active vice-broker
inactive
exit=4

$ ps -eo pid,args | grep -i vice-broker | grep -v grep
exit=1          (no output)

$ ps -eo pid,args | grep -i x64sc | grep -v grep
exit=1          (no output)
```

**Unit inactive, no broker process, no emulator process.** This is why the suite figure below is interpretable at all — a live broker reds the BACK-05 ordering test deterministically.

Commits measured: `5032275` (Task 1 readings), `e1abf16` (the sweep), `24fe94a` (the suite).

## The real row, before and after — differing

**BEFORE (at `52b4c75`, tree clean):**

```
$ node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs \
    --out .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-scratch.md
exit=1
audit-mutation-harness: FAIL -- row scripts/lib/skill-honesty-checks.mjs: plant post-condition
FAILED for scripts/lib/skill-honesty-checks.mjs -- the recorded `replace` string occurs 2
time(s) in the mutated text, expected exactly 1. ... Nothing was written. Fix the descriptor
rather than the assertion (CR-02).
```

**AFTER (same command, after Task 1):**

```
exit=0
audit-mutation-harness: selected 1 row(s)
  OBSERVED RED  scripts/lib/skill-honesty-checks.mjs: guard exit status 1 (control exit status 0)
                command: node scripts/check-skill-fork-honesty.mjs
  counts: measured=1 skipped=0 total=1
  registry: …/guard-fates.json
  tree: restored byte-identical to the baseline
```

The registry write-back for this row produced **no diff at all** — `git diff --numstat` on `guard-fates.json` was empty, i.e. the freshly-measured `observedRed` is byte-identical to the recorded one. Nothing needed discarding. The scratch `--out` file was deleted before the task ended.

## The three scratch descriptors, driven through the real CLI

Built under `mkdtempSync(join(ROOT, ".audit-harness-scratch-"))` with its own `guard-fates.json`, its own targets and its own guard, then removed. Verbatim:

**(i) `replace` already occurs once elsewhere — introduced 1 — PLANTS AND PROCEEDS**

```
exit=0
  OBSERVED RED  case-i-introduced-once: guard exit status 1 (control exit status 0)
                command: node scripts/scratch-guard.mjs src/target-i.mjs "MARKER_PASS" 1
```

**(ii) the recorded replacement does not reach the mutated text as a new occurrence — introduced 0 — THROWS**

```
exit=1
  PLANT REFUSED case-ii-introduced-zero: the plant descriptor was REFUSED before any byte was
  written, so no guard run was attempted for this row and no evidence can be recorded from it:
  row case-ii-introduced-zero: plant post-condition FAILED for src/target-ii.mjs -- the recorded
  `replace` string occurs 1 time(s) in that file BEFORE the mutation and 1 time(s) after it, so
  the mutation would INTRODUCE it 0 time(s); exactly 1 is required. A mismatch means the bytes
  this harness would write are not the bytes this row records, so the row would promise a reader
  a hand-reproducible find/replace that does not reproduce. Nothing was written. The three counts
  are reported separately so the divergence can be located: whether the replacement reaches the
  mutated text at all, whether the write lands it more than once, and how many times it was
  already present independently of this mutation (CR-02, CR-06).
```

**(iii) the write would introduce the replacement twice — introduced 2 — THROWS**

```
exit=1
  PLANT REFUSED case-iii-introduced-twice: … the recorded `replace` string occurs 0 time(s) in
  that file BEFORE the mutation and 2 time(s) after it, so the mutation would INTRODUCE it 2
  time(s); exactly 1 is required. … Nothing was written. … (CR-02, CR-06).
```

**(iv) the STRICT direction — a `re-pointed` row with no `guard` — STILL A HARD FAILURE**

```
exit=1
audit-mutation-harness: FAIL -- row case-iv-repointed-no-guard: no `guard` descriptor.
```

The scratch root was removed by the driver and `git status --porcelain -- scripts/ .planning/phases/32-the-deletion-and-the-grep-gate/` listed exactly one changed path afterwards: `scripts/audit-mutation-harness.mjs`.

## The skip branch, before and after

**BEFORE:** `node scripts/audit-mutation-harness.mjs --rows scripts/lib/skill-descriptions.mjs`

```
exit=1
audit-mutation-harness: FAIL -- row scripts/lib/skill-descriptions.mjs: no `guard` descriptor.
```

**AFTER:**

```
exit=1
audit-mutation-harness: selected 1 row(s)
  SKIPPED       scripts/lib/skill-descriptions.mjs: verdict kept-unchanged -- owes no observed-red evidence (D-05)
  counts: measured=0 skipped=1 total=1
audit-mutation-harness: FAIL -- all 1 selected row(s) were SKIPPED. Every one of them carries a
verdict that owes no observed-red evidence (D-05), so this run measured nothing, and an empty
measurement is not a green. This is a DIFFERENT failure from a selector that matched zero rows:
the selector matched, and everything it matched owes nothing.
  registry: NOT written (every selected row was skipped)
  tree: restored byte-identical to the baseline
```

## Did the whole-set sweep complete? **Yes.**

In those words. Backed by the harness's own final summary block, which is only reachable after the row loop has ended and the registry write-back decision has been taken:

```
  counts: measured=35 skipped=26 total=61
  evidence: /home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a4a0c6d63845e64ef/.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md
  registry: NOT written (a row's plant was refused)
  tree: restored byte-identical to the baseline
```

35 + 26 = 61, the registry's own row count. The evidence file carries 61 `##` sections, one per registry row. Outcome tally from the captured stdout: **34 OBSERVED RED, 1 PLANT REFUSED, 26 SKIPPED, 0 UNMEASURABLE.** Exit 1.

`scripts/lib/skill-descriptions.mjs` appears as `SKIPPED … verdict kept-unchanged` at output line 46, immediately before `scripts/lib/skill-honesty-checks.mjs` as `OBSERVED RED` at line 47 — registry indexes 22 and 23, in order, neither filtered out.

### Three runs, not one — and why

| # | Commit | Start | End | Wall | Exit | Outcome |
|---|---|---|---|---|---|---|
| A | `5032275` | 07:03:09Z | 07:03:32Z | 23 s | 1 | **ABORTED** — the third blocker |
| B | `e1abf16` | 07:08:25Z | 07:09:07Z | 42 s | 1 | **COMPLETED** — 30 red, 4 UNMEASURABLE, 1 refused, 26 skipped |
| C | `e1abf16` | 07:11:19Z | 07:11:58Z | 39 s | 1 | **COMPLETED** — 34 red, 1 refused, 26 skipped. The committed body. |

Neither intervening run was a re-run of a red until it went green. Run A ended in a **code defect** that had to be fixed; run B ended in a **named, diagnosed environmental precondition failure** that had to be removed. All three are recorded verbatim in the evidence file.

The wall-clock figures also settle flagged assumption 1: the sweep runs in **~40 seconds**, not the arithmetic ceiling of ~17.5 minutes. No guard is timing out.

### The registry write-back: which state was observed

**NOT written, deliberately.** One row's plant was refused, which is a hard failure, and `main()` does not write the registry on a hard failure. The harness said so in its own words: `registry: NOT written (a row's plant was refused)`. `git diff --numstat` on `guard-fates.json` was **empty** immediately after the sweep, so there was **no churn to discard** and no `git checkout --` was run or needed. This is the criterion's explicitly-allowed alternative branch. `node scripts/check-guard-fates.mjs` exits 0 with the same measured line as before the plan.

`git status --porcelain` was byte-identical before and after the sweep (`cmp` reports no difference) — one untracked entry, the sweep's own `--out` target.

## The close-gate half

```
$ cd src/mcp/vice && npm run test:automated
# tests 2994    # suites 24    # pass 2987    # fail 1
# cancelled 0   # skipped 1    # todo 5       # duration_ms 63828.642015
exit=1
```

```
$ node scripts/check-guard-fates.mjs
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
exit=0

$ node scripts/audit-gate.mjs
audit-gate: OK -- 9 docs guards green, 7 milestone audits scanned, 5 declaring a gated status
exit=0
```

**The whole-glob `npm test` was NOT run.** It blocks indefinitely on `vice-proxy.test.ts`; `evidence/32-close-gate.md` §2b records that non-completion as the measured result and states in its own words that the whole-glob form was not run to green. That record is cited, not re-taken, and no claim is made about the whole-glob form here.

## Issues Encountered

**1. A THIRD blocker of the `--all` sweep, not recorded by the verifier.** After the prescribed arithmetic landed, run A still aborted at `src/mcp/vice/hop-chain-comments.test.ts`. Its `plant.replace` is its own `plant.find` with a newline prepended, so the introduced occurrence textually OVERLAPS the pre-existing one and the difference comes out 0. Measured over the whole registry rather than inferred: **34 of 35 `re-pointed` rows satisfy the corrected arithmetic and exactly one does not.** The descriptor is honest — the mutation does change the bytes and a reader applying it by hand gets the same result.

Closed **without loosening the assertion**: the post-condition still throws, still writes nothing, still suppresses the write-back and still exits the run 1. Only its blast radius changed — a refused plant is reported against its own row as `PLANT REFUSED` with the message carried verbatim, instead of being thrown out of the row loop and leaving every later row unmeasured *and unreported*. This is precisely the amplifier the verifier recorded as `IN-10`. The row itself is **left refused**: not re-run until it agreed, descriptor not edited, no per-row opt-out added, its recorded `observedRed` untouched.

**2. Four UNMEASURABLE rows in run B, cause named.** Their unplanted green control could not run: `Cannot find module '…/src/mcp/vice/node_modules/typescript/bin/tsc'`. `node_modules/` is gitignored and provisioned on demand by `scripts/ensure-mcp-deps.sh`; a freshly forked git worktree has none. Removed by the repository's own committed step — `npm ci --no-audit --no-fund` in `src/mcp/vice`, from the committed lockfile, adding no package name not already in it (`added 237 packages in 3s`, exit 0). All four rows are `OBSERVED RED` in run C, confirming the diagnosis. `node_modules/` is gitignored so the tree is unchanged by it.

**3. `test:automated` shows 1 failure against a 0-failure floor, and the floor was NOT raised.** The failure is `repo-root.test.ts:178`'s `!nodeVals.supervisorDir.includes(".claude")` — a plain substring predicate. This plan executes inside a GSD worktree whose root **is** `<repo>/.claude/worktrees/agent-…`, so the resolved `.vice-supervisor` path contains `.claude` by construction and the predicate cannot hold from here regardless of the code under test. The substantive half of the same test — that the launcher's `repo_root` and Node's `supervisorDir()`/`dirname(EPOCH_FILE)` AGREE, the regression it was written to catch — **passed**. Not caused by this plan: `git diff --name-only 52b4c75..HEAD` lists only `scripts/audit-mutation-harness.mjs` and the evidence file, neither of which `repo-root.test.ts` reads, and the test has not been touched since phase 18 (`fd4e54b`). Recorded as a location-dependent finding in `.planning/WINDOWS.md`, not as a new baseline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Contained a refused plant to its own row so the sweep can complete**

- **Found during:** Task 2 (the `--all` sweep, run A)
- **Issue:** The plan's Task 1 fixed the two blockers the verifier measured. Run A proved a third exists: one registry row's descriptor produces an introduced count of 0 under the prescribed arithmetic because the introduced occurrence overlaps a pre-existing one. The throw aborted the sweep at that row, making the plan's own success criterion ("the whole-set sweep completes") unreachable.
- **Fix:** `measureRow()` catches `plant()` and returns a per-row hard-failure report; `main()` prints a distinct `PLANT REFUSED` line; `evidenceMarkdown()` renders a row with a control but no planted run. The assertion itself is untouched: still a throw, still before any write, still exit 1, still no registry write-back.
- **Why this is not a narrowing:** the plan forbids "deleting the post-condition rather than fixing its arithmetic; making it a warning; skipping the affected row; adding a per-row opt-out field to the registry; or making `--all` complete by dropping rows from the selection without reporting them." None applies — the row is attempted, refused, reported by name, and fails the run.
- **Files modified:** `scripts/audit-mutation-harness.mjs`
- **Verification:** the four scratch cases re-driven after the change (i plants; ii and iii refused with the full message; iv still the strict `no \`guard\` descriptor` hard failure); run C completes with the row reported.
- **Committed in:** `e1abf16`

**2. [Rule 3 - Blocking] Provisioned `src/mcp/vice/node_modules` from the committed lockfile**

- **Found during:** Task 2 (run B) and required by Task 3
- **Issue:** A freshly forked worktree carries no `node_modules`, so four rows' green controls could not run and `npm run test:automated` could not run at all.
- **Fix:** `npm ci --no-audit --no-fund` in `src/mcp/vice` — the repository's own provisioning step, from the committed lockfile, adding no new package name. Not a package *install* in the sense the executor's Rule 3 exclusion guards against: no name was guessed, substituted or newly added.
- **Files modified:** none tracked (`node_modules/` is gitignored)
- **Verification:** `added 237 packages in 3s`, exit 0; `git status --porcelain` unchanged; all four rows OBSERVED RED in run C.
- **Committed in:** not committed (gitignored), recorded in the evidence file

**3. [Rule 1 - Bug] The write-back-suppression line named a cause that had not fired**

- **Found during:** Task 1
- **Issue:** `registry: NOT written (a row was unmeasurable or exited 0)` was printed for every hard failure, including the two new ones (all-skipped, plant refused). An audit instrument stating a cause it did not measure is the defect this phase exists against.
- **Fix:** the line now joins the causes that actually fired.
- **Files modified:** `scripts/audit-mutation-harness.mjs`
- **Verification:** `registry: NOT written (every selected row was skipped)` and `registry: NOT written (a row's plant was refused)` observed in the respective runs.
- **Committed in:** `5032275`, `e1abf16`

**4. [Rule 3 - Blocking] Ran the plan's verification commands from the worktree root, not `/home/henrik/dev/henrik/git/c64-re-tools`**

- **Found during:** Task 1
- **Issue:** The plan's `<automated>` verify blocks `cd` to the main checkout. This executor is worktree-isolated and must not touch the main checkout.
- **Fix:** every command was run from the worktree root. Same commands, correct tree.
- **Files modified:** none

**5. [Rule 3 - Blocking] `evidenceMarkdown()` would have crashed on a skipped row**

- **Found during:** Task 1
- **Issue:** A skipped row carries no `control`, and the evidence writer dereferences `report.control.command`. An `--all` sweep would have died in the writer *after* every measurement was taken.
- **Fix:** a skipped-row branch renders the row and continues.
- **Files modified:** `scripts/audit-mutation-harness.mjs`
- **Verification:** run C wrote 61 sections including all 26 skipped rows.
- **Committed in:** `5032275`

---

**Total deviations:** 5 auto-fixed (4 blocking, 1 bug). **Impact on plan:** all five were required for the plan's own success criteria to be reachable. No assertion was weakened, no row was dropped, no dated record was rewritten and no baseline was raised.

## Known Stubs

None. No hardcoded empty value, placeholder or unwired component was introduced.

## Threat Flags

None. The plan's `<threat_model>` covers every surface touched. `T-32-15` (the post-condition's repudiation risk) and `T-32-16` (the sweep-aborting descriptor validation) are both mitigated as planned; `T-32-17`'s registry-tampering mitigation was exercised in the read direction (the write-back was never performed, so nothing needed discarding); `T-32-18`'s interrupted-sweep risk was avoided by running every sweep in the background with porcelain byte-identity asserted around it. `T-32-03` stays `accept`, unchanged.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `CUT-04`'s re-runnability promise is now backed by a run: the whole-set sweep completes and 34 of 35 measured rows reproduce their recorded red with a green control.
- **One open item for the milestone close:** `src/mcp/vice/hop-chain-comments.test.ts` cannot be re-measured by the committed instrument. Recorded in `.planning/WINDOWS.md` as an open `unmet-truth`. It needs a decision, not a fix applied under time pressure: either that descriptor is restated so its mutation is unambiguous, or the post-condition's counting is replaced by a site-relative form. Both are outside this plan's prohibitions.
- **One environment fact for anyone measuring from a worktree:** `npm run test:automated` cannot reach its 0-failure floor from under `.claude/worktrees/`, for the substring reason recorded above. Also in `.planning/WINDOWS.md`.
- Plans 32-16 through 32-19 are unblocked; none of them touches the post-condition, and 32-17's argv work is deliberately untouched here.

## Self-Check: PASSED

- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap4-sweep-rerun.md` — FOUND (493023 bytes; harness-written prefix sha256 `67e5e3252b77d59515ee6920193ac96d7d946229b53b5cc0a1eb2a757aa87cf5`, byte-identical to what the harness wrote)
- `scripts/audit-mutation-harness.mjs` — FOUND, `node --check` exit 0
- Commits `5032275`, `e1abf16`, `24fe94a`, `6a595a8` — all FOUND in `git log`
- `git diff --numstat -- .planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json` — empty (no dated record rewritten)
- `node scripts/check-guard-fates.mjs` exit 0, `node scripts/audit-gate.mjs` exit 0

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-09-01*
