---
phase: 58-one-declaration-four-places-that-can-no-longer-disagree
plan: 01
subsystem: infra
tags: [packaging, ci, node18, host-prerequisites, npm-pack]

# Dependency graph
requires: []
provides:
  - "src/mcp/vice/prerequisites.json -- one committed JSON declaration of all eight host prerequisites (x64sc, c1541, petcat, acme, acme-lib, ghidra, dxa, node), each with unblocks/remedies/provenance"
  - "src/mcp/vice/prerequisites.test.ts -- the structural gate over that declaration: version-floor guard, executable-shape guard, closed-vocabulary guard, source-resolution guard, and the DECL-05 packaging proof"
  - "a standalone Node-18 CI job (decl-02-node18-proof) proving the declaration parses on the installer's own Node floor"
affects: [60-repoint-the-live-refusals, 61-the-prerequisite-doctor, 62-generate-the-readme-table]

# Actuals (#2632)
actuals:
  tokens: 7750
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Colocated structural test (node:test) as the packaging-tarball gate, reached via npm pack --dry-run --json, instead of a standalone scripts/*.mjs checker -- because the standalone checker class of gate was retired project-wide the same day this plan's base commit landed"
    - "Host-bound .mts value exports (HOST_TOOL_IDS) are reached from a container-side test via build() + dynamic import of resources/host-tool.mjs, never a direct .mts import, matching host-tool.test.ts/host-tool-oracle.test.ts's own convention"

key-files:
  created:
    - src/mcp/vice/prerequisites.json
    - src/mcp/vice/prerequisites.test.ts
  modified:
    - src/mcp/vice/package.json
    - .github/workflows/ci.yml

key-decisions:
  - "DECL-05's packaging proof was moved from the plan's named scripts/check-npm-packages.mjs into a colocated test case in prerequisites.test.ts, because that script was retired on the owner's explicit call in d0e9fb2e -- the commit that is this worktree's own base -- for reasons unrelated to this plan (CI scope reduction). Recreating the retired script would reverse a same-day owner decision; dropping the mechanical proof would violate DECL-05. The test-based proof preserves the exact non-vacuous guarantee (npm pack --dry-run --json, never existsSync) using this project's own test-colocation convention."
  - "c1541 and petcat's remedies are a deliberate byte-for-byte copy of x64sc's remedies tree (not a pointer/reference field), guarded by a dedicated three-way byte-identity test -- matches the plan's explicit instruction that one OS package installs all three binaries."
  - "node.unblocks covers all nine skills and all twelve HOST_TOOL_IDS, since a Node version below the floor gates the whole server, not a subset of tools."

requirements-completed: [DECL-01, DECL-02, DECL-04, DECL-05]

coverage:
  - id: D1
    description: "One committed JSON file (prerequisites.json) declares all eight host prerequisites, each with id/unblocks/remedies keyed by platform"
    requirement: "DECL-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#all eight required tool ids are present"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#tools.x64sc.unblocks.skills/mcp are arrays inside their closed vocabularies"
        status: pass
    human_judgment: false
  - id: D2
    description: "The declaration parses under Node 18 (the low end of this project's support), proven both locally against a real v18 binary and by a dedicated CI job"
    requirement: "DECL-02"
    verification:
      - kind: other
        ref: "real /home/henrik/.nvm/versions/node/v18.20.8/bin/node -e JSON.parse(...) -- NODE18_PARSE_OK tools=8"
        status: pass
      - kind: other
        ref: ".github/workflows/ci.yml decl-02-node18-proof job (YAML-structure asserted, not executed on a real runner this session)"
        status: unknown
    human_judgment: true
    rationale: "The local Node-18 parse and the YAML-structure assertion both pass, but neither proves the GitHub Actions runner itself executes the new job green -- flagged unresolved in the plan's own 'Flagged Planner Assumptions' section (DECL-02) as a manual-only verification."
  - id: D3
    description: "Exactly one record (node) carries a version floor, it is byte-equal to package.json's engines.node, and a planted violation on a non-node record is observed being rejected"
    requirement: "DECL-04"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#DECL-04: tools.node.versionFloor is byte-equal to vice's own engines.node..."
        status: pass
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (T-58-01): assertNoStrayVersionFloor's planted violation is reported and the real document is not (non-vacuity)"
        status: pass
    human_judgment: false
  - id: D4
    description: "prerequisites.json ships in the published tarball, proven by reading the packed tarball's own file list -- never a repo-path filesystem check"
    requirement: "DECL-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#packaging (DECL-05): prerequisites.json is present in the packed tarball's own file list"
        status: pass
    human_judgment: false
  - id: D5
    description: "No field in the declaration is shaped so a reader could execute it -- no structured-command key anywhere, verified by both a real-document pass and a planted-violation reject"
    verification:
      - kind: unit
        ref: "src/mcp/vice/prerequisites.test.ts#structural (T-58-01): assertNoExecutableShape passes on the real document and rejects a planted argv key (non-vacuity)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-17
status: complete
---

# Phase 58 Plan 01: One Prerequisite Declaration, Proven in Four Places Summary

**src/mcp/vice/prerequisites.json declares all eight host prerequisites (x64sc, c1541, petcat, acme, acme-lib, ghidra, dxa, node) with per-platform remedies and three-valued provenance, proven by a colocated test suite, a files[] entry, and a standalone Node-18 CI job.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-17T13:34:00Z (approx.)
- **Completed:** 2026-09-17T14:19:09Z
- **Tasks:** 2
- **Files modified/created:** 4 (2 created, 2 modified)

## Accomplishments
- Created `src/mcp/vice/prerequisites.json`: `schemaVersion: 1` plus eight tool records (`x64sc`, `c1541`, `petcat`, `acme`, `acme-lib`, `ghidra`, `dxa`, `node`), every remedy string traced to a `provenance` (`measured`/`carried`/`authored`) and a `source` that resolves.
- Created `src/mcp/vice/prerequisites.test.ts`: four named validators (`assertNoStrayVersionFloor`, `assertNoExecutableShape`, `assertClosedVocabularies`, `assertSourcesResolve`) each proven against the real document AND a planted-violation case, plus the DECL-05 packaging proof and the D-06 three-way byte-identity guard for the VICE-package trio.
- Wired `prerequisites.json` into `src/mcp/vice/package.json`'s `files[]`.
- Added a standalone `decl-02-node18-proof` job to `.github/workflows/ci.yml` that provisions Node 18 via `actions/setup-node@v4` and parses the declaration, with zero `needs:` edges to or from any pre-existing job.
- `tools.node.versionFloor` (`>=24.0.0`) is byte-equal to `package.json`'s `engines.node`, and is the document's only version-floor field -- both a positive test and a planted-violation rejection prove this non-vacuously.

## Task Commits

Each task was committed atomically:

1. **Task 1: One tool, end to end -- declaration, validators, packaging proof, Node-18 CI cell** - `bb7cdf1e` (feat)
2. **Task 2: The remaining seven records, every string traced to a named source** - `6f4ca558` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit).

## Files Created/Modified
- `src/mcp/vice/prerequisites.json` - the one committed declaration; eight tool records under `tools`, keyed by id
- `src/mcp/vice/prerequisites.test.ts` - the structural gate: four named validators (each with a planted-violation case), the DECL-05 packaging proof, and the cross-record consistency checks Task 2 added
- `src/mcp/vice/package.json` - `files[]` gained the string `"prerequisites.json"`, placed beside `anno-regbits.json`
- `.github/workflows/ci.yml` - one new standalone job, `decl-02-node18-proof`, appended after `publish-npm` with no `needs:` edges touching any pre-existing job

## Decisions Made
- **DECL-05's packaging proof moved from a standalone script into a colocated test** (see Deviations below for the full reasoning) -- this is the one decision worth flagging beyond "followed the plan."
- **c1541 and petcat's `remedies` trees are byte-for-byte copies of x64sc's**, not a reference/pointer field, per the plan's explicit instruction that a pointer field would force two later consumers (Phase 60, Phase 62) to resolve an indirection. A dedicated three-way byte-identity test (`D-06`) guards this against silent drift.
- **`acme`'s `ubuntu` entry is the document's one `measured` provenance grade**, sourced from `.github/workflows/ci.yml:78` (the command CI actually executes and then proves via banner grep). A sibling `debian` entry with the same command text is `carried` (package-name verification only, not an observed install) -- never promoted to `measured` by sharing a package manager, per the plan's explicit prohibition.
- **`ghidra`'s and `node`'s remedy text is a light, faithful rewording of a refusal-message clause into an imperative sentence** (e.g. "Set the GHIDRA_HOME environment variable..." from a refusal reading "...requires the GHIDRA_HOME environment variable to name a Ghidra installation directory; it is unset") rather than a byte-identical excerpt, because neither source line is itself phrased as a command. This is the most defensible reading of "carried" available given the source shape; flagged here for visibility since it is a closer judgment call than the README/dxa extractions, which lift a literal command substring.

## Deviations from Plan

### Auto-fixed / Adapted Issues

**1. [Rule 3 - Blocking, resolved as a substitution rather than a literal fix] `scripts/check-npm-packages.mjs` does not exist**
- **Found during:** Task 1, immediately after reading the plan's `read_first` list (which cites specific line ranges in that file)
- **Issue:** The plan's Task 1 action instructs adding one `need(...)` assertion to `scripts/check-npm-packages.mjs`, reading `vice.files` from its `packFiles()` helper. That file (and its sibling `scripts/check-no-skill-external-spawn.mjs`) was deleted in commit `d0e9fb2e` ("build: reduce CI to a correctness gate and make the git tag the version") -- **this worktree's own base commit**, landed the same day this plan was authored (planning at 10:06 UTC, the CI-reduction commit at 15:07 UTC). The commit message states explicitly: "check-npm-packages.mjs and check-no-skill-external-spawn.mjs are removed on the owner's call... What they enforced is now convention, stated in CLAUDE.md and in the comments that used to cite them." This is a genuine plan/codebase conflict, not a simple missing-file bug: recreating the script would reverse a same-day, explicit owner decision to retire that class of standalone packaging check; silently dropping the mechanical proof would violate the plan's own DECL-05 must-have ("never a repo-path filesystem check").
- **Resolution:** Implemented the DECL-05 tarball-list proof as a colocated test case inside `prerequisites.test.ts` (`packaging (DECL-05): prerequisites.json is present in the packed tarball's own file list`), using the exact `npm pack --dry-run --json` technique the retired script used (confirmed by reading the script's pre-deletion content via `git show d0e9fb2e~1:scripts/check-npm-packages.mjs`). This preserves the non-vacuous, tarball-list-based mechanism DECL-05 requires while respecting the owner's retirement of the standalone-script pattern and following this project's own test-colocation convention ("a test sits beside its module under the same basename plus `.test.ts`"). No new standalone script was created; `scripts/` is untouched.
- **Files modified:** `src/mcp/vice/prerequisites.test.ts` (in place of the originally-named `scripts/check-npm-packages.mjs`)
- **Verification:** The test fails when `prerequisites.json` is absent from `package.json`'s `files[]` (confirmed live before the `files[]` edit landed) and passes once it is present; `node scripts/check-npm-packages.mjs` was confirmed to genuinely not exist (`MODULE_NOT_FOUND`), ruling out a path-resolution mistake on my part.
- **Committed in:** `bb7cdf1e` (Task 1 commit)

**2. [Rule 3 - Blocking] `node_modules/` was not provisioned in this worktree**
- **Found during:** Task 1, first test run (`spawnSync ... node_modules/.bin/tsc ENOENT`)
- **Issue:** This worktree is a fresh git worktree; the `SessionStart` hook that normally provisions `src/mcp/vice/node_modules` via `npm ci` (per `scripts/ensure-mcp-deps.sh`) does not appear to run for a spawned executor's worktree.
- **Fix:** Ran `npm ci --no-audit --no-fund` inside `src/mcp/vice` -- installing this package's own already-locked devDependencies (`package-lock.json`), not an external tool. Explicitly carved out by CLAUDE.md's never-auto-install constraint ("that is this package's dependencies, not an external tool").
- **Files modified:** none tracked (node_modules is gitignored)
- **Verification:** `npm run typecheck` and `node --test prerequisites.test.ts` both run cleanly afterward.
- **Committed in:** N/A (no tracked files changed)

---

**Total deviations:** 2 (1 Rule 3 substitution requiring judgment, 1 Rule 3 routine dependency provisioning).
**Impact on plan:** The packaging-proof relocation is the one deviation worth a reader's attention -- it changes WHERE DECL-05's mechanism lives (a test file, not a script) without changing WHAT it proves or weakening the non-vacuity guarantee. All eight `must_haves.truths` in the plan frontmatter are satisfied by the committed state; no scope was dropped, and no scope beyond the plan's own text was added.

## Issues Encountered
- `npm run test:automated` (full automated gate) reports 1 failure unrelated to this plan's changes: `repo-root.test.ts`'s "path agreement... is not under .claude" assertion fails because this session runs inside a GSD-spawned worktree physically located at `.claude/worktrees/agent-aa36fcac6453cb260/`, which the test's own logic treats as the exact regression it exists to catch. `repo-root.ts` and `repo-root.test.ts` are untouched by both of this plan's commits (last touched in unrelated commit `27ebaa2e`). This is an environmental artifact of worktree-isolated execution, out of scope per the Scope Boundary rule (only auto-fix issues directly caused by the current task's changes); not fixed. All 20 tests in `prerequisites.test.ts` pass, typecheck is clean, and the CI YAML structure checks pass -- the plan's own deliverables are fully green.

## Known Stubs
None.

## Threat Flags
None -- this plan's threat register (`T-58-01` through `T-58-04`, `T-58-SC`) is fully addressed by the committed validators; no new surface outside that register was introduced. The DECL-05 packaging test's relocation from `scripts/` to a colocated test file does not change the trust boundary it mitigates (`T-58-02`, repository → published npm tarball) -- it reads the same `npm pack --dry-run --json` output via the same mechanism, just from a different file.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The declaration is committed, structurally proven, and packaged -- Phase 60 (repointing the live refusals to read from it) and Phase 61 (the prerequisite doctor) can both build on the locked schema and the eight records without re-deriving remedy text.
- DECL-02's own manual-only flag (a real GitHub Actions runner executing `decl-02-node18-proof` green) remains open per the plan's own "Flagged Planner Assumptions" section -- this is expected to close on the next push/PR, not blocking for this plan's completion.
- No blockers for 58-02 (the provenance doc, per the plan's Multi-Source Coverage Audit).

## Self-Check: PASSED
- `[ -f src/mcp/vice/prerequisites.json ]` -- FOUND
- `[ -f src/mcp/vice/prerequisites.test.ts ]` -- FOUND
- `git log --oneline --all --grep="58-01"` returns `bb7cdf1e` and `6f4ca558` -- FOUND (2 commits)
- All 20 `prerequisites.test.ts` acceptance criteria re-run: PASS (0 fail)
- Plan-level `<verification>` re-run: `node --test prerequisites.test.ts` (20/20 pass), `npm run typecheck` (exit 0), `.github/workflows/ci.yml` YAML-parses with the Node-18 job wired and every pre-existing job's `needs:` byte-unchanged, Node 18 binary parses the declaration reporting 8 tools, no shipped module imports `prerequisites.json`, `resources/` unregenerated (clean `git status` after `build()` ran inside the test). `npm run test:automated` reports 1 unrelated pre-existing environmental failure (see Issues Encountered) and 0 failures attributable to this plan.
- `plan_head_before: d0e9fb2e1d5ae8c64fd3a6c9d4ecc920cc45fe4e`, `commits: 2` (measured via `git rev-list --count`)

---
*Phase: 58-one-declaration-four-places-that-can-no-longer-disagree*
*Completed: 2026-09-17*
