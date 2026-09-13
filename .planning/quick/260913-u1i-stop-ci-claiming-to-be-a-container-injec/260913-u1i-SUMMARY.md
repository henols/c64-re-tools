---
phase: quick-260913-u1i
plan: 01
subsystem: testing
tags: [ci, container-guard, test-infrastructure, workflow-config]

requires: []
provides:
  - "CI's build job no longer declares CONTAINER_WORKSPACE_PATH/HOST_WORKSPACE_PATH workflow-wide, so a GitHub-hosted runner (a host) no longer claims container-ness"
  - "broker-e2e.test.ts and vice-broker-launch.test.ts inject the container signal into their own spawned children instead of inheriting it ambiently -- 0 skips under both env conditions"
  - "ci-guardrails.test.mjs holds the removal open: a fixture-proven detector asserting ci.yml declares neither variable, plus an enumerated-exception case pinning the one remaining gated file (vice-proxy.test.ts) by name"
affects: [ci-yml, broker-e2e-test, vice-broker-launch-test, vice-proxy-test, ci-guardrails-test]

actuals:
  tokens: 7650
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Inject a simulated environment signal into a spawned child's own env object instead of relying on ambient inheritance from the parent job/shell -- makes a container-guard test's outcome independent of who invokes it"
    - "Enumerated-exception guard test: a set-of-files assertion that fails in both directions (member added / member removed) rather than a single-file allowlist skip"

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-e2e.test.ts
    - src/mcp/vice/vice-broker-launch.test.ts
    - .github/workflows/ci.yml
    - src/mcp/vice/ci-guardrails.test.mjs
    - src/mcp/vice/vice-proxy.test.ts
    - src/mcp/vice/skill-acme-build-cli.test.ts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/host-tool-transport.test.ts
    - .planning/codebase/TESTING.md

key-decisions:
  - "Converted the five broker-file cases (broker-e2e.test.ts, vice-broker-launch.test.ts) to inject CONTAINER_WORKSPACE_PATH into a spawned child rather than reading it ambiently, landed in its own commit BEFORE the workflow block was removed -- so the tree was never in a state where the block was gone and the conversions were not."
  - "Left vice-proxy.test.ts's WORKSPACE_ENV gate in place. Measured at plan time: under the only environment that runs its four gated cases, all four FAIL (77/122 vs 73/122 failures), not pass -- so the workflow block was buying four failures there, not four passes, and converting now would trade a named skip for an unattributable failure ahead of that file's own scheduled wholesale re-baseline."
  - "Kept all three pre-existing route-pinning mechanisms (hostRouteChildEnv() in skill-acme-build-cli.test.ts, VICE_BROKER_CONTROL_DIAL_HOST pins in host-tool.test.ts/host-tool-transport.test.ts) unchanged in behavior -- only corrected the clause in each that named this repo's CI job as the ambient variable's source, since that sentence went false the moment the workflow block was removed."

requirements-completed: [QUICK-260913-u1i]

duration: ~25min
completed: 2026-09-13
status: complete
---

# Quick Task 260913-u1i: Stop CI Claiming To Be A Container (Injected Instead) Summary

**Removed the workflow-wide `CONTAINER_WORKSPACE_PATH`/`HOST_WORKSPACE_PATH` env block that made CI's `build` job (a GitHub-hosted runner, which is a host) claim container-ness to the five-signal container detector, after first converting the five test cases that depended on it to inject the signal directly into their own spawned children.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-13
- **Tasks:** 3/3 completed
- **Files modified:** 9

## Accomplishments

- `broker-e2e.test.ts` and `vice-broker-launch.test.ts`'s five container-guard cases now hand a `SIMULATED_CONTAINER_ENV` (`{ CONTAINER_WORKSPACE_PATH: <this file's own directory> }`) to their spawned child processes instead of reading it ambiently — 12/12/0/0 and 15/15/0/0 respectively, identically with the workspace variables set and unset.
- `.github/workflows/ci.yml` no longer declares `CONTAINER_WORKSPACE_PATH` or `HOST_WORKSPACE_PATH` at any level. The runner's non-root fact (previously stated in the deleted block) was relocated into the `Test` step's own comment, where the read-only-deployment cases that actually depend on it run. The acme-build scaffold step's comment, which claimed the workspace variables were "left in place deliberately," was corrected to name what now actually guards that step (the host-route child-env helper plus the new `ci-guardrails.test.mjs` assertions).
- `ci-guardrails.test.mjs` gained two cases: a fixture-proven detector (`declaresContainerWorkspaceEnv()`) asserting `ci.yml` declares neither variable while a synthetic fixture with both keys correctly reports `true` (so the check cannot pass merely because the detector broke), and an enumerated-exception case asserting the set of MCP test files still gating cases on the `WORKSPACE_ENV` idiom deep-equals exactly `["vice-proxy.test.ts"]`, failing in both directions.
- Four comments (in `vice-proxy.test.ts`, `skill-acme-build-cli.test.ts`, `host-tool.test.ts`, `host-tool-transport.test.ts`) and one `TESTING.md` paragraph that asserted, as present-tense fact, that this repo's CI job sets the workspace variables were rewritten to describe the arrangement that now exists, while every mechanism they defended (the `WORKSPACE_ENV` gate, `hostRouteChildEnv()`, both `VICE_BROKER_CONTROL_DIAL_HOST` pins) was kept unchanged in behavior.

## Task Commits

Each task was committed atomically, in the plan's required order:

1. **Task 1: Inject the container signal into the five broker cases that inherited it** - `21f2a596` (test)
2. **Task 2: Delete the workflow-wide container claim and bind its absence to a test** - `efc0c3a1` (fix)
3. **Task 3: Reconcile every remaining claim about the removed block, then re-measure the baseline both ways** - `a6f53fd0` (docs)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written, task order preserved exactly as the ordering hazard required.

### Measurement drift noted, not fixed

**1. `ci-guardrails.test.mjs`'s stated "21 before" baseline was stale.**
- **Found during:** Task 2 verification.
- **Detail:** The plan's `<behavior>` and `<done>` blocks state "23 tests total (21 before, plus exactly these 2)". The actual pre-task-2 count, measured live, was 25 (21 static `test()` calls plus 4 dynamically generated per-`GUARD_SCRIPTS` entry cases — `GUARD_SCRIPTS.length` grew to 4 in a commit made after this plan was written: `54a6be56`/`f7ef5a05` from quick task `260913-t43`, which added the CI-scaffold-gate tests). This is a planning-time measurement going stale from unrelated concurrent work, not a defect in this plan's own changes.
- **Resolution:** Followed the plan's intent (add exactly 2 new cases) rather than its stale absolute count. Final measured count: 27 tests, 0 fail, 0 skipped — exactly 2 more than the live-measured baseline of 25.
- **Files affected:** none (measurement-only; no code changed as a result).

**2. Two `npm run test:automated` runs during verification hit a pre-existing, previously-documented test-suite race, unrelated to this plan's changes.**
- **Found during:** Task 3 verification (baseline re-measurement, both env conditions).
- **Detail:** Two separate runs (one with the workspace variables set, one unset) reported `anno-verb-coverage.test.ts`'s shipped-skill-tree drift assertion FAILING, each naming a different transient `installer/skills/acme-build/zz-scratch-*/` file with no counterpart under `src/skills/`. This is a known, previously-documented test-suite defect (a scratch directory some other test in the same suite run leaves behind under `installer/skills/acme-build/`, picked up as spurious drift by the later-running coverage assertion) — not something this plan's changes touch or introduce.
- **Resolution:** Removed the leftover `zz-scratch-*` directories, re-ran `node installer/scripts/sync-skills.mjs` to resync, and re-ran `npm run test:automated` under both conditions. Final, stable result: **4407 tests, 0 failures, 9 skipped**, identically with the workspace variables set and unset (exactly 2 above the 4405 baseline this plan is required to protect, matching the two new `ci-guardrails.test.mjs` cases).
- **Files affected:** none (transient scratch files under a gitignored/generated directory; not part of this plan's tracked changes).

## Known Stubs

None.

## What Local Verification Proves, and What Only a Push Settles

**Proven locally, both ways:** Every case that previously depended on the job-wide variables now passes with them set AND with them unset — `broker-e2e.test.ts` (12/12/0/0), `vice-broker-launch.test.ts` (15/15/0/0), and `ci-guardrails.test.mjs` (27/27/0/0), each run under both conditions. The narrowed automated suite (`npm run test:automated`) reports 4407/0 fail/9 skipped under both conditions — the exact protected baseline plus the two new guard cases, and nothing else. The installer suite (18/18/0/0), the skill-script suite (196/190/0/6), and all six repo-root guard scripts (`check-npm-packages.mjs`, `check-no-skill-external-spawn.mjs`, `check-skill-tool-coverage.mjs`, `check-skill-capability-honesty.mjs`, `check-skill-description-overlap.mjs`, `check-skill-cli-invocations.mjs`) pass with the workspace variables unset — these are the same commands CI's later steps run, so this converts most of the job into local evidence. No production module was touched: `container-guard.mts`, `hostpath.ts`, `containerpath.ts`, `repo-root.ts`, and everything under `src/mcp/vice/resources/` are byte-for-byte unchanged (confirmed via `git diff --name-only` against those paths, 0 lines). `.github/workflows/ci.yml` declares neither workspace variable at any level (comment-stripped scan: 0 matches) and carries no `continue-on-error` (0, unchanged from the pre-existing count).

**What only a real push settles, stated plainly rather than claimed fixed:** (1) that the GitHub runner's own ambient environment contains no equivalent signal of its own — it did not before this change (the job was the only source), but this cannot be re-observed from a developer host; (2) that the `Test` step's full `*.test.*` glob behaves on the runner as it does locally — which it currently cannot do anyway, since `vice-proxy.test.ts` is red pending its own scheduled wholesale re-baseline, independent of this change; (3) that `bash scripts/package.sh` and the artifact upload are unaffected — expected, since neither reads these variables, but unverified here. This change removes a false claim about the machine and keeps all five previously-ambient assertions alive while doing it. It does not make the `Test` step green; that remains the re-baseline's job.

## Self-Check: PASSED

- FOUND: `src/mcp/vice/broker-e2e.test.ts` (modified, exists)
- FOUND: `src/mcp/vice/vice-broker-launch.test.ts` (modified, exists)
- FOUND: `.github/workflows/ci.yml` (modified, exists, YAML-valid — verified via `python3 -c "import yaml; yaml.safe_load(...)"`)
- FOUND: `src/mcp/vice/ci-guardrails.test.mjs` (modified, exists)
- FOUND: `src/mcp/vice/vice-proxy.test.ts`, `src/mcp/vice/skill-acme-build-cli.test.ts`, `src/mcp/vice/host-tool.test.ts`, `src/mcp/vice/host-tool-transport.test.ts`, `.planning/codebase/TESTING.md` (all modified, exist)
- FOUND: commit `21f2a596` (`git log --oneline --all | grep 21f2a596`)
- FOUND: commit `efc0c3a1` (`git log --oneline --all | grep efc0c3a1`)
- FOUND: commit `a6f53fd0` (`git log --oneline --all | grep a6f53fd0`)
