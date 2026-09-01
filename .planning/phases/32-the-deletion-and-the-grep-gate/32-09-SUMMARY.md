---
phase: 32-the-deletion-and-the-grep-gate
plan: 09
subsystem: infra
tags: [github-actions, ci, git-fetch-depth, node-test, vice, audit, evidence]

requires:
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-08's completed 61-row fate registry and the green scripts/check-guard-fates.mjs that reads it"
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-05's CUT-06 living-document sweep ledger (evidence/32-document-sweep.md)"
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-07's measurement that vice-proxy.test.ts does not terminate (still running at 300106 ms)"
provides:
  - "The audited-guard fate gate runs in CI as its own named build-job step, green at the moment it was wired in"
  - "fetch-depth: 0 on the build job's checkout, so the gate's two pinned commits exist in the runner's object store"
  - "The phase-close gate re-run and recorded at 0d7d328, with the broker asserted down and read at both ends"
  - "D-14's honesty clause written out in words: CI's whole-glob green proves the nine manual-only files DID NOT FAIL, not that they exercised anything"
  - "The phase's API-coverage declaration (COVERAGE.md), pre-empting a seal-time false-positive re-detection"
  - "Broken window #32: fork-live.test.ts has no exercise route on any host we control"
affects: [milestone-close, gsd-ship, phase-33-planning, ci-maintenance]

actuals:
  tokens: 13000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A guard is wired into CI only in the wave AFTER it goes green (ordering constraint 5 / the 4f048bb precedent)"
    - "A CI step whose subject is a name-pinned literal refers to that subject BY ROLE, so the exact-count pin does not move on the step's own landing commit"
    - "A close-gate record states which tree and which commit each measurement was taken in, and discloses environment-caused failures rather than reporting a bare count"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/COVERAGE.md
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-close-gate.md
  modified:
    - .github/workflows/ci.yml
    - .planning/WINDOWS.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Only the build job's actions/checkout@v4 got fetch-depth: 0; the three at :257, :298 and :348 belong to release/publish jobs that never run the fate guard and stay shallow."
  - "The new CI step names the audited set by role in its name, run line and comment, so grep -ac 'the external analyser' .github/workflows/ci.yml stayed at exactly 1 and the gate-self === pin did not move."
  - "The whole-glob npm test was NOT run and is NOT claimed. vice-proxy.test.ts was bounded at 180 s, exited 124, and the timeout is recorded as the measured result with plan 32-07's 300106 ms citation beside it."
  - "audit-gate was run WITHOUT --json first, because :1210 exits on `allowed` alone and cannot report a structural error (broken window #28); the --json payload's structuralErrors was then read directly."
  - "The one automated-leg failure (repo-root.test.ts's !includes('.claude')) was disclosed as a worktree artifact with three independent proofs, and neither fixed nor loosened (D-12-14)."
  - "The six live-emulator files were driven against the real binaries; fork-live is recorded as NOT exercised because the fork is not installed, rather than counted as coverage."
  - "The broker was read with `ps -eo pid,args | grep -i vice-broker | grep -v grep`, not `pgrep -af`, because the pgrep form self-matches and returned a false positive in this very run."

patterns-established:
  - "Two-pass manual-only leg: run each file at its DEFAULT disposition (what CI meets) first, then re-run the opt-in ones with their env var set, and report the two separately so a SKIP is never laundered into an exercise."
  - "Verify an opt-in binary's identity before trusting an opt-in run: `x64sc --version` plus `-help | grep -ci mcpserver` distinguishes stock from the fork in two commands."

requirements-completed: [CUT-04, CUT-06]

coverage:
  - id: D1
    description: "The audited-guard fate gate runs in CI as its own named build-job step, invoked directly as its own file name, absent from package.json's scripts block"
    requirement: CUT-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/ci-suite-coverage.test.ts (10/10 pass) — the new step did not break the CI-step cross-reference"
        status: pass
      - kind: other
        ref: "grep -c 'run: node scripts/check-guard-fates.mjs' .github/workflows/ci.yml == 1; grep -c 'check-guard-fates\\|audit-mutation-harness' src/mcp/vice/package.json == 0"
        status: pass
      - kind: other
        ref: "node scripts/check-guard-fates.mjs -> exit 0, 61 rows — green at the moment of wiring"
        status: pass
    human_judgment: false
  - id: D2
    description: "fetch-depth: 0 on the build job's checkout only, so the gate's two pinned commits are in the runner's object store"
    requirement: CUT-04
    verification:
      - kind: other
        ref: "grep -c 'fetch-depth: 0' .github/workflows/ci.yml == 1; git diff shows exactly one changed checkout hunk (the three at :257/:298/:348 byte-identical)"
        status: pass
    human_judgment: true
    rationale: "The local assertions prove the YAML shape, not the runner behaviour. Only a real GitHub Actions run on the merge commit can prove the depth-0 clone actually contains 0394cbc and 345d5c4 and that the step goes green there. Predicted green; unproven until CI runs."
  - id: D3
    description: "The removal gate's ci.yml occurrence pin is unmoved by the new step"
    requirement: CUT-04
    verification:
      - kind: other
        ref: "grep -ac 'the external analyser' .github/workflows/ci.yml == 1; node scripts/check-no-analyser.mjs -> exit 0, gate-self pin still 5"
        status: pass
    human_judgment: false
  - id: D4
    description: "The phase-close gate re-run on the settled tree, both legs, seven check scripts, table byte-identity, docs-guard sweep and typecheck, with the broker asserted down and recorded at both ends"
    requirement: CUT-06
    verification:
      - kind: integration
        ref: ".planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-close-gate.md (621 lines) — every command as executed with its raw output"
        status: pass
      - kind: other
        ref: "7/7 check-*.mjs exit 0; generate-tool-support-table.mjs + git diff --exit-code exit 0; audit-gate text-mode exit 0 with 9/9 docs guards and structuralErrors []; npm run typecheck exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-14's honesty clause stated in words — CI's whole-glob green proves the nine manual-only files did not fail rather than that they exercised anything, with the per-file local exercised/SKIP breakdown beside it"
    requirement: CUT-06
    verification:
      - kind: other
        ref: "evidence/32-close-gate.md §7 (four separately-stated claims) and §2c (per-file exercised/SKIP verdicts)"
        status: pass
    human_judgment: true
    rationale: "Whether a prose honesty clause actually prevents a later reader from collapsing nine SKIPs into a coverage claim is a judgment about the writing, not something a grep can assert. The greps only prove the required sentences are present."
  - id: D6
    description: "The API-coverage declaration for a phase that integrates no external API"
    verification:
      - kind: other
        ref: "grep -c '^No external API integration:' .planning/phases/32-the-deletion-and-the-grep-gate/COVERAGE.md == 1, followed by a non-empty reason"
        status: pass
    human_judgment: false

duration: 38 min
completed: 2026-08-31
status: complete
---

# Phase 32 Plan 09: Close the Gate Summary

**The audited-guard fate gate now runs in CI as its own named step against a `fetch-depth: 0` checkout, and the phase-close gate was re-run and recorded at `0d7d328` — broker down and read at both ends, both legs of the whole-glob claim worked separately, and the nine-SKIP nuance written out in words instead of left inferable.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-08-31T18:48Z (approx — first tool call after spawn; `npm ci` in the worktree)
- **Completed:** 2026-08-31T19:26Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **`D-16`'s CI step landed, green at the moment it was wired in.** `- name: Validate every audited guard has a recorded, non-vacuous fate (CUT-04)` / `run: node scripts/check-guard-fates.mjs`, placed after the anno-CLI step and before packaging, matching the six existing `check-*.mjs` steps' shape. Nothing entered `src/mcp/vice/package.json`'s `scripts` block (`D-12-11`), and the mutation harness is in neither CI nor a package script (`D-17`).
- **The checkout fix the gate needs.** `fetch-depth: 0` on the build job's `actions/checkout@v4`, with a `# Blocking:` comment stating why: the gate derives its member set from two pinned commits and fails closed on a missing object, so a depth-1 clone would red it on the runner.
- **The close gate re-run and recorded** at `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-close-gate.md` (621 lines): every command as executed with its raw output, in `29-21-SUMMARY.md`'s shape, not a table of exit codes.
- **Five of the nine manual-only files were genuinely exercised against a real emulator** — a real upgrade over CI's evidence, and the evidence says exactly how large it is rather than rounding it up.
- **A new fact for the project:** `/usr/local/bin/x64sc` is **stock VICE 3.10**, not the fork. Filed as broken window **#32**, and it made `stock-live.test.ts` reachable at a real 14/14.

## Task Commits

1. **Task 1: the named CI step, the full-history checkout, and the API-coverage declaration** — `0d7d328` (ci)
2. **Task 2: re-run the close gate, both legs, broker asserted at both ends** — no repo delta of its own; its raw captures are the input to Task 3, and its one side effect (`docs/tool-support.md` regenerated) came back byte-identical. Recorded here rather than given an empty commit.
3. **Task 3: `D-15`'s evidence artifact with `D-14`'s honesty clause** — `3883ec8` (docs)
4. **Broken window #32 (out-of-band finding from Task 2)** — `6586f0a` (docs)

**Plan metadata:** see the `docs(32-09): complete close-the-gate plan` commit.

## Files Created/Modified

- `.github/workflows/ci.yml` — `fetch-depth: 0` on the build job's checkout (that one only) plus one new named guard step; +23 lines, 0 deletions.
- `.planning/phases/32-the-deletion-and-the-grep-gate/COVERAGE.md` — the phase's API-coverage declaration, with the reason stated (the phase's "integration" vocabulary all refers to the DELETED subject, so an implicit declaration would invite a false-positive re-detection at seal time).
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-close-gate.md` — `D-15`'s record, 621 lines.
- `.planning/WINDOWS.md` — broken window #32 appended (`open_count` 14→15, `total_count` 31→32).
- `.planning/REQUIREMENTS.md` — `CUT-04` and `CUT-06` marked complete.

## Decisions Made

See `key-decisions` in the frontmatter. The three that most change what a later reader should believe:

1. **The whole-glob `npm test` was not run, and nothing here claims it was.** `vice-proxy.test.ts` was run last under an explicit 180 s bound and exited **124** — no termination, 1063 lines of partial TAP. Plan 32-07 measured the same file still running at **300106 ms**; it is broken-windows entry **#26**. The honest close-gate record is `test:automated` to a real zero PLUS `test:manual` worked file-by-file, with the substitution named. `test:automated` was **not** quietly written up as though the full glob had passed.
2. **The one automated-leg failure is a worktree artifact and is disclosed as such**, with three independent proofs (see Issues Encountered). It was not fixed and not loosened.
3. **`fork-live.test.ts` is recorded as NOT exercised.** Its opt-in run failed 6/6 because the binary it was pointed at is stock VICE 3.10, not the fork. Counting that as exercise would have been the same laundering error `D-14` warns about, in the other direction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm ci` in the worktree before anything could run**
- **Found during:** Task 1 setup
- **Issue:** `src/mcp/vice/node_modules` does not exist in a fresh worktree (it is gitignored and provisioned by a SessionStart hook in the main checkout), so `tsc` and the test suites could not resolve.
- **Fix:** `npm ci --no-audit --no-fund` from the committed `src/mcp/vice/package-lock.json`. **No package was installed that the lockfile did not already pin** — `T-32-SC`'s `accept` disposition is unchanged.
- **Verification:** `npm run typecheck` and `npm run test:automated` both ran.
- **Committed in:** nothing — `node_modules/` is gitignored.

**2. [Rule 3 - Blocking] Every `<automated>` command in the plan hardcodes the orchestrator's checkout**
- **Found during:** all three tasks
- **Issue:** `cd /home/henrik/dev/henrik/git/c64-re-tools && ...` would have measured a tree that does not contain this plan's CI change — the exact laundered-evidence failure this phase exists to prevent, and acutely so for a plan whose job is to record a close gate.
- **Fix:** resolved `git rev-parse --show-toplevel` once and re-anchored every command to it. The evidence names the tree and the commit for every measurement.
- **Committed in:** `3883ec8` (evidence §0).

**3. [Rule 1 - Bug in the measurement method] `pgrep -af vice-broker` self-matches and reported a false positive**
- **Found during:** Task 2, step 0
- **Issue:** the plan's precondition asks for `pgrep -af vice-broker` to be empty. Run on this host it returned `exit=0` with one hit — **its own wrapping shell command line**. Recording that would have asserted a live broker on a host that had none, inverting the fact `D-13`'s precondition exists to establish.
- **Fix:** every broker reading uses `ps -eo pid,args | grep -i vice-broker | grep -v grep` instead. The false positive is quoted verbatim in the evidence so the next reader does not repeat it.
- **Committed in:** `3883ec8` (evidence §0).

**4. [Rule 2 - Missing critical] `audit-gate.mjs --json` cannot fail, so it was also run in text mode**
- **Found during:** Task 2, step 5
- **Issue:** the plan asks for `node scripts/audit-gate.mjs --json | grep '"allowed":true'`. Per broken window **#28**, `:1210` ends `process.exit(result.allowed ? 0 : 1)` and `allowed` tracks gated audits only — a `DOCS_GUARD_FLOOR` breach sits in `structuralErrors` while the process exits **0**. A green recorded that way could not have been contradicted by its own exit status.
- **Fix:** run text mode first (which does exit 1 on that condition), then read `allowed`, `redGuards`, `structuralErrors`, `guardFiles` and `expectedGuardNames` out of the `--json` payload directly.
- **Committed in:** `3883ec8` (evidence §5).

**5. [Rule 2 - Missing critical] Broken window #32 filed for `fork-live.test.ts`**
- **Found during:** Task 2, step 2 (the live opt-in pass)
- **Issue:** discovered while trying to exercise the six live files that the fork is not installed on this host, so `fork-live.test.ts`'s six tests reach a default-SKIP branch **both locally and in CI** and are proven by nothing anywhere. Leaving that in one plan's evidence would have made it invisible at ship time.
- **Fix:** appended to `.planning/WINDOWS.md` as `unrun-verify` #32, with the measurement that establishes it.
- **Committed in:** `6586f0a`.

---

**Total deviations:** 5 auto-fixed (2 blocking, 2 missing-critical, 1 measurement bug).
**Impact on plan:** none expanded scope. Four are corrections to the plan's own commands (wrong tree, self-matching pgrep, an exit status that cannot fail, a missing dependency install); the fifth records a discovery rather than acting on it. **Nothing was weakened to reach green** (`D-12-14`): no waiver file, no env override, no skip flag, no floor relaxation, and `scripts/check-guard-fates.mjs` still has exactly one commit in its history (`371750e`) — this plan did not touch it.

## Issues Encountered

**1. `repo-root.test.ts` fails inside any GSD worktree, and this run is in one.**

`npm run test:automated` here reports `tests 2950 / pass 2943 / fail 1 / skipped 1 / todo 5`. The single failure is `repo-root.test.ts:178`'s `!supervisorDir().includes(".claude")`, and a worktree root **is** `<repo>/.claude/worktrees/agent-*`. Three independent proofs that this is the environment failing its own assertion and not a regression:

- the error message names the cause verbatim (`got .../.claude/worktrees/agent-a5561dbf359bcb095/.vice-supervisor`);
- the delta against the main checkout is **exactly one test** — the orchestrator measured `2950 / pass 2944 / fail 0 / skipped 1 / todo 5` there at this run's parent `90b5a0a`; identical totals, one test flipped;
- `deferred-items.md` §1 already recorded it, found by plan 32-01, before this plan ran.

Left alone deliberately. The assertion's own name calls it "THE regression this task exists to catch", and blunting a guard inside a phase whose subject is guard vacuity is the wrong trade in the worst place.

**2. `fork-live.test.ts` cannot be exercised anywhere.** Filed as broken window #32. Both `x64sc` binaries on this host are genuine stock (`/usr/bin` 3.9, `/usr/local/bin` 3.10, the latter's `-help` with zero `mcpserver` hits). Not fixed — installing the fork is build work, and ROADMAP.md scopes this phase to contain none.

**3. 200 `/tmp/vice-broker-vicerc-*` scratch directories observed, not reaped.** This run cannot tell which it created; deleting another session's scratch state is the "audit script tears down the developer's environment" shape `D-13` rejects. It is the symptom of the open todo `2026-08-24-reap-vicerc-scratch-dirs-in-broker-kill-recycle-path.md`. `/tmp` is at 2% of a 16 GB tmpfs. One leaked **empty** `.planning/vice-proxy-evidence-test-PrNv7K` directory WAS removed, with a targeted `rmdir` — **no `git clean` was run at any point**.

**4. The plan text says the fate guard has "60 rows"; it has 61.** `check-guard-fates.mjs` reports `setA=43 setB=16 setC=2 total=61 rows=61` against its own floors. 60 is the count the guard *would* report if broken window **#29**'s recommended strengthening were adopted (`SET_B_FLOOR` 16→15, `TOTAL_FLOOR` 61→60). It has not been, and adopting it is not this plan's work. Nothing was changed to reconcile the plan's number; the measured one is recorded.

**5. `gsd-tools`' `windows append` verb is unavailable inside a worktree.** `gsd-core` is a gitignored vendored install, so it is not present in the worktree checkout, and running the main checkout's copy would have written to the wrong tree. Ledger entry #32 was appended by hand with a script that keeps the markdown table row, the JSON array and the frontmatter counters in sync; the resulting diff is 16 insertions / 3 deletions with the JSON re-serialising byte-identically apart from the new entry.

## Requirements

`CUT-04` and `CUT-06` are marked complete in `.planning/REQUIREMENTS.md`. Both are declared by several phase-32 plans and **32-09 is the last declarer**, so the shared-ID gate is satisfied by construction: all eight sibling plans (`32-01` … `32-08`) already have SUMMARYs on disk.

- **`CUT-04`** — the mechanical sweep exists, is complete (61 rows against 61 derived members), is green, and now runs in CI on every push. Evidence: `evidence/32-fate-guard-green.md` (plan 32-08) and `evidence/32-close-gate.md` §3 (this plan).
- **`CUT-06`** — the living-document sweep is recorded in `evidence/32-document-sweep.md` (plan 32-05), and the removal gate independently confirms the state: 406 files scanned, 157 occurrences permanently exempt against exact pins, **0 temporarily allow-listed across 0 entries**.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 32 is complete.** All nine plans have SUMMARYs; the close gate is recorded; the fate gate is in CI.
- **One prediction remains unproven until CI runs on the merge commit:** that `fetch-depth: 0` gives the runner an object store containing `0394cbc` and `345d5c4` and the new step goes green there. It is asserted locally as YAML shape only (see coverage `D2`, `human_judgment: true`). If it reds, the guard fails closed with a message naming the fix, which is the designed behaviour rather than a surprise.
- **Open items carried forward, none owned by this phase:** broken windows #26 (`vice-proxy.test.ts` does not terminate), #28 (`audit-gate --json` exit status), #29 (the rename the registry cannot express), #30 (`block-class.ts:196` inert arm), #31 (`observedRed` on `kept-unchanged`), and the new #32 (`fork-live.test.ts` unexercisable). The BACK-05 live-broker todo and the vicerc-reaping todo both stay open.
- **`.planning/STATE.md` and `.planning/ROADMAP.md` were deliberately NOT touched** — this ran in a worktree and the orchestrator owns those writes post-merge.

## Self-Check: PASSED

- `.github/workflows/ci.yml` — FOUND, `fetch-depth: 0` ×1, `run: node scripts/check-guard-fates.mjs` ×1, `the external analyser` ×1 (`grep -a`).
- `.planning/phases/32-the-deletion-and-the-grep-gate/COVERAGE.md` — FOUND, 40 lines, one `^No external API integration:` line with a reason.
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-close-gate.md` — FOUND, 621 lines (min 120), all six required greps present.
- Commits `0d7d328`, `3883ec8`, `6586f0a` — all FOUND in `git log`.
- `node scripts/check-guard-fates.mjs` and `node scripts/check-no-analyser.mjs` — both exit 0 with every artifact of this plan committed.
- `git diff 90b5a0a HEAD --stat` — 700 insertions, 3 deletions, **no file deletions**.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-08-31*
