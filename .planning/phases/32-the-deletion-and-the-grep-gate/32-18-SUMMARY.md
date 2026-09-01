---
phase: 32-the-deletion-and-the-grep-gate
plan: 18
subsystem: testing
tags: [audit-instrument, argv-seam, completeness-guard, non-vacuity, containment]

requires:
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-16 wired scripts/audit-gate.mjs onto parseRootArg() and recorded its containment asymmetry as T-32-22 with a named reversal trigger"
  - phase: 32-the-deletion-and-the-grep-gate
    provides: "plan 32-17 wired scripts/audit-mutation-harness.mjs onto parseRootArg() with valueFlags, and declared the CR-05 precondition in prose"
provides:
  - "A --root completeness population derived from the FLAG rather than from the shared seam, so a script that hand-rolls the reader is a member"
  - "A matrix covering all EIGHT root-accepting scripts, each with at least one spawned test"
  - "A fourth ContainedExpectation, uncontained-read-only, paired with a write-freedom assertion that revokes the acceptance mechanically"
  - "The mechanical half of the CR-05 precondition: a named standing test that reds if the harness leaves the strict parser"
  - "A population cross-check whose two sides are deliberately different mechanisms, proven non-vacuous by subject mutation"
affects: [audit instruments, future --root consumers, phase 32 gap closure]

actuals:
  tokens: 24000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Derive a guard's population from the FLAG (the symptom) rather than from the REMEDY, or the guard cannot see the defect it exists to catch"
    - "Cross-check a census against a DIFFERENT MECHANISM (spawnSync shell glob vs readdirSync walk); two calls sharing a filter cannot disagree"
    - "Prove non-vacuity by mutating the SUBJECT, never the assertion"
    - "Scope a closed allow-list to the surface it actually closes over, and NAME the residual holes as measured limits"

key-files:
  created:
    - .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap5-population-and-precondition.md
  modified:
    - src/mcp/vice/audit-root-args.test.ts

key-decisions:
  - "Followed the verifier's override of 32-REVIEW.md's CR-08 fix: no UNMIGRATED exclusion list, because both scripts are migrated this round so the list would be empty, and an empty exclusion list is an invitation to fill it"
  - "The audit-mutation-harness matrix row carries a deliberately NON-EXISTENT row selector, making the case fail-safe: if containment ever stopped preceding row selection, the run finds nothing to plant rather than sweeping the real tree from inside a unit test"
  - "E1's message is scoped to the DIRECT fs import surface rather than claiming no write is reachable, because audit-gate.mjs binds spawnSync and a spawned write is outside both halves; an unqualified completeness claim would reproduce the CR-08 shape in the plan that removes it"
  - "The one test:automated failure was diagnosed as a worktree-location artifact and left unfixed under the scope boundary, rather than absorbed into a claimed pass"

patterns-established:
  - "Commit a guard RED on purpose when the red IS the evidence, then close it by adding coverage in the next commit"
  - "Record a plan criterion that is itself wrong (5a) rather than quietly satisfying its literal form"

requirements-completed: [CUT-04]

coverage:
  - id: D1
    description: "The --root completeness population is derived from the flag, so all eight root-accepting scripts are members whether or not they use the shared seam"
    requirement: "CUT-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#the matrix covers EVERY root-accepting script"
        status: pass
    human_judgment: false
  - id: D2
    description: "The flipped predicate was observed RED naming audit-gate and audit-mutation-harness before it was taken green, with no exclusion list added"
    requirement: "CUT-04"
    verification:
      - kind: manual_procedural
        ref: "evidence/32-gap5-population-and-precondition.md section 3 (captured red at 555356e); grep -a -c UNMIGRATED == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every one of the eight root-accepting scripts has at least one spawned test"
    requirement: "CUT-04"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-root-args.test.ts (62 tests, two consecutive runs, 0 failures)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The population walk is cross-checked against an independent mechanism, proven non-vacuous by a directory probe and controlled by an empty-file probe"
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#the population walk sees every scripts/*.mjs an independent mechanism sees"
        status: pass
    human_judgment: false
  - id: D5
    description: "The CR-05 precondition is declared mechanically: a named standing test reds if the harness leaves the strict parser"
    verification:
      - kind: integration
        ref: "src/mcp/vice/audit-root-args.test.ts#audit-mutation-harness: the equals form exits non-zero and names itself (observed failing against an un-wired harness, evidence section 8)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The audit-gate containment acceptance (T-32-22) is revoked mechanically by a two-part write-freedom assertion, both halves observed failing"
    verification:
      - kind: unit
        ref: "src/mcp/vice/audit-root-args.test.ts#audit-gate: E1 / E2 (both observed failing against a mutated subject, evidence section 9)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Phase gates re-run green under a recorded broker state"
    verification:
      - kind: other
        ref: "node scripts/check-guard-fates.mjs (exit 0); node scripts/audit-gate.mjs (exit 0); npm run typecheck (exit 0)"
        status: pass
    human_judgment: false
  - id: D8
    description: "npm run test:automated across the repository suite"
    verification:
      - kind: integration
        ref: "cd src/mcp/vice && npm run test:automated -- 3012 tests / 3005 pass / 1 fail / 1 skipped"
        status: fail
    human_judgment: true
    rationale: "The single failure is repo-root.test.ts asserting the supervisor directory is not under .claude, which is structurally unsatisfiable from a worktree living under .claude/worktrees/. Proven environmental (this plan's commits touch one unrelated file; the same test passes 6/6 in the main checkout) and expected to resolve on merge -- but the plan's criterion asked for 0 failures, so a human should confirm it is green post-merge rather than take this executor's diagnosis on trust."

duration: 26 min
completed: 2026-09-01
status: complete
---

# Phase 32 Plan 18: Gap 5 — the completeness guard whose population was its own remedy

**The `--root` completeness guard now derives its population from the FLAG instead of from `parseRootArg(`, so all eight root-accepting scripts are members; it was committed RED naming the two it could never see, then taken green by adding typed rows plus a two-part write-freedom pin that mechanically revokes `T-32-22`.**

## Performance

- **Duration:** 26 min
- **Tasks:** 3
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- **The population comes from the flag.** `scriptsUsingTheSharedParser()` keyed on `src.includes("parseRootArg(")` — the REMEDY — making the population tautologically the set MATRIX already covered. It is now `walkRootAcceptingScripts()`, keyed on the `--root` token, read `latin1` so a NUL byte cannot truncate it.
- **The guard was proven to BITE before it was satisfied.** Committed red at `555356e`, naming `audit-gate` and `audit-mutation-harness`, with exactly one failing test. No exclusion list, no `UNMIGRATED` array, no skip.
- **All eight scripts have a spawned test**, with typed expectations that separate the contained from the read-only. A fourth `ContainedExpectation` (`uncontained-read-only`) plus a per-row `extraArgs` field carry the two new members.
- **`CR-05` is declared mechanically, not only in prose.** The harness's matrix row reds the moment the harness leaves the strict parser — observed doing exactly that.
- **`T-32-22` has a mechanical revocation.** A closed allow-list over `audit-gate.mjs`'s direct fs import surface plus an enumerated write-API count over comment-stripped source. Both halves observed failing against a real import-plus-call mutation.
- **The population census is itself cross-checked** against a `spawnSync` shell glob — a deliberately different mechanism — with non-vacuity proven by mutating the subject.

## Task Commits

1. **Task 1: population from the flag, docblock corrected, guard captured RED** — `555356e` (fix)
2. **Task 2: all eight covered, typed, guard green** — `1c8bbbe` (test)
3. **Task 3: evidence record and CR-05 declaration** — `64314d1` (docs)

## Files Created/Modified

- `src/mcp/vice/audit-root-args.test.ts` — flag-derived population; independent cross-check; widened NUL sweep; corrected dated docblock; two new typed matrix rows; typed out-of-repository cases in both directions; the write-freedom pair. 1011 → 1424 lines.
- `.planning/phases/.../evidence/32-gap5-population-and-precondition.md` — the captured red and green, both population measurements, both non-vacuity experiments, the `CR-05` declaration, the recorded departure from `32-REVIEW.md`.

## Key measurements

| Measurement | Value |
|---|---|
| `grep -a -l -- '--root' scripts/*.mjs \| wc -l` | 8 |
| `grep -a -l 'parseRootArg(' scripts/*.mjs \| wc -l` | 8 (was 6 at pre-round HEAD) |
| Population function's returned list | exactly the 8 expected basenames |
| Test count before Task 2 / after | 55 → 62 (+7, accounted for exactly) |
| Green runs | 2 consecutive, 62/62 |
| `npm run typecheck` | exit 0 |

The pre-round HEAD values of **8 and 6** — the divergence that is the entire reason this gap exists — are no longer reproducible in this tree and are recorded from the verifier's report.

## Decisions Made

- **Departed from `32-REVIEW.md`'s `CR-08` fix, knowingly and on the record.** The reviewer proposed an `UNMIGRATED` exclusion list; the verifier overrode it. Followed the verifier: both scripts are migrated this round, so the list would be empty, and an empty exclusion list is an invitation to fill it. The reviewer's underlying concern is honoured by a different mechanism — a typed expectation with a stated reason and its own spawned test.
- **The harness row's selector names a non-existent row.** The harness's exactly-one-selector rule fires before containment, so a selector is required; the non-existence makes it fail-safe (T-32-30).
- **E1's claim is scoped to the direct fs import surface**, because `audit-gate.mjs` binds `spawnSync` and a spawned write is outside both halves. Writing "a write API cannot be called without first being bound" unqualified would have been false about this file today.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Broken string concatenation in a new assertion message**
- **Found during:** Task 2 (write-freedom assertion)
- **Issue:** An inner `"` inside a concatenated message terminated the string early, producing `ERR_INVALID_TYPESCRIPT_SYNTAX` and preventing the whole file from loading.
- **Fix:** Reworded both affected messages to avoid inner double quotes (`performs-no-filesystem-write basis`).
- **Verification:** File loads; 62/62 green on two consecutive runs.
- **Committed in:** `1c8bbbe`

**2. [Rule 2 - Missing Critical] Split-read clean-controls list would have gone stale**
- **Found during:** Task 2
- **Issue:** The clean-controls `deepEqual` pinned exactly two scripts. Adding two members to the flag-derived population puts both in `clean` (measured: neither binds a `../src/` specifier statically), which would have failed for a correct reason with a misleading message.
- **Fix:** Widened to four with the measurement and its reasoning recorded in the message.
- **Verification:** `split-read contract: every root-accepting script that binds ../src statically refuses` passes.
- **Committed in:** `1c8bbbe`

**3. [Rule 1 - Bug, in the PLAN rather than the code] A plan criterion whose stated non-vacuity is false**
- **Found during:** Task 1
- **Issue:** The criterion asserts `grep -c 'The table below is the whole population'` returns 0 now and **1 at HEAD**. It returns 0 at HEAD too — the claim was wrapped across two comment lines at base, so the single-line exact-phrase grep never matched it anywhere.
- **Fix:** Not silently satisfied. The literal criterion holds (0). The intended non-vacuity was re-taken in a wrap-tolerant form (`grep -c 'whole population'` = 1 at HEAD, and likewise for the other two claims), and the discrepancy is recorded in evidence §5a.
- **Note:** The corrected docblock still *quotes* two of the old claims in past tense, because criterion D requires recording what the docblock used to assert. A loose grep will therefore hit history, not an assertion.

**4. [Scope boundary — NOT fixed] `test:automated` has one failure, environmental**
- **Found during:** Task 3
- **Issue:** `repo-root.test.ts` asserts the resolved supervisor directory is not under `.claude`. This worktree's root **is** `…/.claude/worktrees/agent-…`, making the assertion unsatisfiable from inside it.
- **Why not fixed:** Proven not caused by this plan — its commits touch exactly one unrelated file, and the same test passes **6/6 in the main checkout**. Fixing it would mean editing a shared file outside this plan's scope. Recorded, not absorbed.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical), 1 plan-criterion defect reported, 1 out-of-scope environmental failure recorded.
**Impact on plan:** No scope creep. All three prohibitions honoured.

## Issues Encountered

**`test:automated` did not exit 0** — 3012 tests / 3005 pass / **1 fail** / 1 skipped, against a criterion asking for 0 failures. Diagnosed as a worktree-location artifact with two independent proofs (see evidence §12a). Expected to clear on merge; flagged for confirmation rather than claimed as passing.

**The whole-glob `npm test` was NOT run**, deliberately, citing `evidence/32-close-gate.md` §2b: `vice-proxy.test.ts` does not terminate on this host (measured at `exit=124` under a 180 s bound, and still running when killed at 300106 ms by plan 32-07), so the bare full glob cannot be run to completion. That decision was cited, not re-taken.

## Known Stubs

None. No stub, placeholder, skipped test or unrun `<verify>` was introduced.

## Containment contract (parallel-execution requirement)

Both `transient_touches` files are **byte-identical to base**, by `git diff` **and** by sha256:

| File | Owner | `git diff` | sha256 |
|---|---|---|---|
| `scripts/audit-mutation-harness.mjs` | 32-19 (same wave) | empty | `e761c7bf…` matches pre-experiment |
| `scripts/audit-gate.mjs` | 32-16 (wave 2) | empty | `51e5f8b7…` matches pre-experiment |

Both scratch probes at `scripts/zz-population-probe.mjs` (a directory, then a file) were removed and their absence verified with `test ! -e` — an empty directory is invisible to `git status`, so the existence check is the load-bearing cleanup proof. Worktree left clean.

**Flagged assumption 4 holds:** the empty diff plus hash match is exactly what makes the cross-plan edge with 32-19 safe to leave out of `depends_on`. It did not become void.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust boundary. The plan's `T-32-SC` disposition (no package-manager install, no manifest or lockfile touched) holds: `npm ci` was run only to provision the worktree's `node_modules`, adding and changing nothing.

## User Setup Required

None.

## Next Phase Readiness

- Gap 5 (`CR-08`) is closed: the population is flag-derived, all eight scripts are covered, and the guard has been observed to fail and then pass.
- The `CR-05` precondition now has both halves — 32-17's prose in the harness header, and this plan's named standing test — cross-referenced so each is findable from the other.
- `T-32-22` has its mechanical revocation, so `audit-gate`'s containment acceptance no longer depends on anyone remembering the trigger.
- **One item for the orchestrator:** confirm `test:automated` reaches 0 failures after wave cleanup, when the tree is no longer under `.claude/worktrees/`.

## Self-Check: PASSED

- `src/mcp/vice/audit-root-args.test.ts` — FOUND
- `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap5-population-and-precondition.md` — FOUND
- `555356e`, `1c8bbbe`, `64314d1` — all FOUND in git log
- Plan-level verification 1–9 re-run; item 9's `test:automated` recorded as 1 environmental failure rather than 0, with proof, per the deviation above.

---
*Phase: 32-the-deletion-and-the-grep-gate*
*Completed: 2026-09-01*
