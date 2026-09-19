---
phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine
plan: 05
subsystem: broker-control-plane
tags: [systemd, launchd, service-definition, structural-gate, readme]

# Dependency graph
requires:
  - phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine (plan 01)
    provides: "BROKER_START_COMMAND, the one exported constant every refusal and now every service definition and README passage quotes verbatim"
  - phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine (plan 04)
    provides: "vice-cli.mjs's `broker` subcommand, the real command the two service definitions and the README now invoke"
provides:
  - "src/mcp/vice/service/vice-broker.service and com.henols.vice-broker.plist -- committed, user-scoped, path-free service definitions"
  - "src/mcp/vice/service-no-invoke.test.ts -- the structural gate proving nothing in the tracked tree invokes systemctl/launchctl and no production module spawns the broker artifact"
  - "README.md's \"Starting the broker\" section -- the universal foreground command plus the two optional per-user service sequences"
affects: [phase-63-session-relay, phase-64-file-transfer, phase-65-skill-script-seam]

# Actuals (#2632)
actuals:
  tokens: 6452
  tasks: 2
  commits: 2
plan_head_before: f901b3e6399a4036eda065fd42bbc0b3f7c0ed5c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A committed, never-applied OS service definition living beside the code that documents starting the thing it describes -- one module/one seam extended to a non-code artifact (D-15)"
    - "A closed-consumer-set tree scan widened from the .ts/.mts-only precedent to also cover top-level .mjs (vice-cli.mjs, the one hand-authored non-compiled production entry), with two independently-scoped predicates sharing one balanced-paren call-argument extractor"
    - "A structural gate's own file self-excluded, by name, from the very scan it defines -- its planted-violation fixtures are synthetic source TEXT and would otherwise trip the gate against itself"

key-files:
  created:
    - src/mcp/vice/service/vice-broker.service
    - src/mcp/vice/service/com.henols.vice-broker.plist
    - src/mcp/vice/service-no-invoke.test.ts
  modified:
    - README.md

key-decisions:
  - "The literal BROKER_START_COMMAND string lives in a comment header in the launchd plist (its functional ProgramArguments is necessarily a split string array), and in the systemd unit's actual ExecStart line -- both are asserted byte-identical to the exported constant by the same test"
  - "The interpreter-pinning VICE_BROKER_NODE variable is documented ONLY in the systemd unit, never the plist -- D-15's own reasoning is that launchd agents inherit a real user login environment, so the path-less-PATH case the variable exists for is specific to systemd user units"
  - "invokesServiceManager()'s real scan covers every top-level .ts/.mts/.mjs file including tests (BROKER-05's literal \"anywhere\"), narrowly self-excluding only this gate's own file by name; spawnsBrokerArtifact()'s real scan excludes all *.test.* files, per the plan's explicit instruction that a test spawning a real broker is the suite doing its job"
  - "/usr/bin/env in the systemd unit's ExecStart is treated as the one allowed exception to the \"no system-binary-directory path\" check -- it is the portable, machine-identical environment-resolver mechanism the plan requires, not a machine-specific interpreter path"

requirements-completed: [BROKER-02, BROKER-05]

coverage:
  - id: D1
    description: "A systemd user unit and a launchd agent are committed, user-scoped, path-free, and quote the exported start command byte-identically"
    requirement: "BROKER-05"
    verification:
      - kind: unit
        ref: "service-no-invoke.test.ts#both service definitions contain the exported BROKER_START_COMMAND byte-identically"
        status: pass
      - kind: unit
        ref: "service-no-invoke.test.ts#neither service definition embeds a machine-specific absolute path outside the env-resolver exception"
        status: pass
      - kind: unit
        ref: "service-no-invoke.test.ts#the Linux unit's interpreter-pinning variable is present, and every line naming it is commented out"
        status: pass
    human_judgment: false
  - id: D2
    description: "A structural gate asserts no module in the tracked tree invokes systemctl/launchctl and no production module spawns the broker artifact, proven to bite on a planted violation before the clean scans are trusted"
    requirement: "BROKER-05"
    verification:
      - kind: unit
        ref: "service-no-invoke.test.ts#invokesServiceManager true/false planted-violation and comment-stripping tests (4 assertions)"
        status: pass
      - kind: unit
        ref: "service-no-invoke.test.ts#spawnsBrokerArtifact true/false planted-violation tests (2 assertions)"
        status: pass
      - kind: unit
        ref: "service-no-invoke.test.ts#no module anywhere in the tracked tree invokes systemctl or launchctl"
        status: pass
      - kind: unit
        ref: "service-no-invoke.test.ts#no production module spawns the broker artifact"
        status: pass
    human_judgment: false
  - id: D3
    description: "No client module in this repository spawns the broker; the requirement is enforced by the same gate's second predicate"
    requirement: "BROKER-02"
    verification:
      - kind: unit
        ref: "service-no-invoke.test.ts#no production module spawns the broker artifact"
        status: pass
    human_judgment: false
  - id: D4
    description: "The README gives the universal foreground command, the two optional service sequences naming both committed files, the shared-broker consequence, and the restart-after-a-later-bridge remedy -- with no generated region disturbed"
    requirement: "BROKER-05"
    verification:
      - kind: other
        ref: "grep -ac 'npx -y @henols/vice-mcp broker' README.md == 1; grep -ac for both service file paths == 1 each"
        status: pass
      - kind: other
        ref: "npm --prefix src/mcp/vice run generate:readme leaves README.md byte-identical after staging the hand edit (git diff --quiet)"
        status: pass
    human_judgment: false

# Metrics
duration: 24min
completed: 2026-09-19
status: complete
---

# Phase 62 Plan 5: The Fixed Endpoint and the Broker That Owns the Machine Summary

**A committed systemd user unit and launchd agent for the vice broker, a new structural gate proving nothing in the tree ever invokes a service manager or spawns the broker as a client, and a README section giving the universal foreground command plus both optional per-user service sequences.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-19T16:24:00Z (approximate)
- **Completed:** 2026-09-19T16:47:59Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 edited)

## Accomplishments
- `src/mcp/vice/service/vice-broker.service`: a systemd `--user` unit whose `ExecStart` runs `BROKER_START_COMMAND` through `/usr/bin/env`, so no absolute interpreter path is baked in. `VICE_BROKER_NODE` is present as a commented-out example line for the one execution context (a PATH-less systemd user session) it actually exists for.
- `src/mcp/vice/service/com.henols.vice-broker.plist`: a launchd agent whose `ProgramArguments` array elements together spell the same start command, `RunAtLoad` true, `KeepAlive` on unsuccessful exit, log paths under the user's own home directory (`~/Library/Logs/...`).
- `src/mcp/vice/service-no-invoke.test.ts`: a new closed-tree structural gate with two independently-scoped, independently-proven predicates — `invokesServiceManager()` (no module anywhere, tests included, may spawn `systemctl`/`launchctl`) and `spawnsBrokerArtifact()` (no production module may spawn `vice-broker.mjs` as a child process). Both share one balanced-paren call-argument extractor and are each proven to bite on a planted synthetic violation before their real, empty-set tree scans are trusted. Reads every candidate file as bytes (`readFileSync(path).toString("utf8")`), never a shelled-out text search — the file's own last test asserts that discipline about its own source.
- A new "Starting the broker" section in `README.md`, placed outside every generated marker pair: the universal `npx -y @henols/vice-mcp broker` foreground command first, then the two optional copy-paste service sequences (systemd, launchd) naming both committed files by repository path, the one-broker-per-machine sharing consequence, and the broker-restart remedy for a bridge that appears after the broker is already running.

## Task Commits

Each task was committed atomically:

1. **Task 1: Two committed service definitions that nothing in this repository applies** - `c5e86079` (feat)
2. **Task 2: Tell the user how to start it, on three paths, with one string** - `214cb330` (docs)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/mcp/vice/service/vice-broker.service` - committed systemd `--user` unit, never applied by any code here
- `src/mcp/vice/service/com.henols.vice-broker.plist` - committed launchd agent definition, never applied by any code here
- `src/mcp/vice/service-no-invoke.test.ts` - the never-invoke / never-spawn structural gate, 12 tests
- `README.md` - new "Starting the broker" section, outside every generated marker pair

## Decisions Made
- `BROKER_START_COMMAND`'s literal text lives in the launchd plist's leading XML comment (its functional `ProgramArguments` is necessarily a split array, per the plan's own instruction), and in the systemd unit's actual `ExecStart` line — both asserted byte-identical to the exported constant by the same test, satisfying "every occurrence... byte-identical" without contradicting "elements together are the start command."
- `VICE_BROKER_NODE` is documented only in the systemd unit, never the plist: a launchd agent inherits a real user login environment, so the PATH-less-service case the variable exists for is specific to systemd user units.
- `invokesServiceManager()`'s real scan deliberately covers every top-level `.ts`/`.mts`/`.mjs` file, test files included — BROKER-05's must_have literally says "no module anywhere" — narrowly self-excluding only `service-no-invoke.test.ts` by name, because that file's own planted-violation fixtures are synthetic source TEXT (`spawnSync("systemctl", ...)` as a string literal) and would otherwise trip the gate against itself. Every OTHER test file stays in scope.
- `spawnsBrokerArtifact()`'s real scan excludes all `*.test.*` files, per the plan's explicit instruction: a test spawning a real broker to exercise it end to end (several exist: `broker-e2e.test.ts`, `vice-broker-launch.test.ts`) is the suite doing its job, not a client starting one for a user.
- `/usr/bin/env` in the systemd unit's `ExecStart` is the one named exception to the "no system-binary-directory path" check: it is the portable, machine-identical environment-resolver mechanism the plan requires for a path-free `ExecStart`, not a machine-specific interpreter path the check exists to forbid.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The new gate's own file tripped its own service-manager scan**
- **Found during:** Task 1, first `node --test service-no-invoke.test.ts` run
- **Issue:** `invokesServiceManager()`'s real tree scan is deliberately unrestricted to production modules ("no module anywhere"), so it also reads its own test file — which necessarily contains synthetic planted-violation source TEXT such as `spawnSync("systemctl", ...)` as a plain string literal. The unrestricted scan matched its own fixture and reported a false positive against itself.
- **Fix:** Added a narrow, explicitly-commented self-exclusion (`SELF_FILENAME`) in `serviceManagerInvokers()` only, naming exactly why: the file's job is to construct these strings, and every other test file in the directory remains in scope.
- **Files modified:** `src/mcp/vice/service-no-invoke.test.ts`
- **Verification:** `node --test service-no-invoke.test.ts` — 12/12 pass.
- **Committed in:** `c5e86079` (Task 1 commit)

**2. [Rule 1 - Bug] A planted "clean" synthetic source collided with an unrelated pre-existing gate (WR-20)**
- **Found during:** Task 1, `npm run test:automated` full-gate run
- **Issue:** The clean-case fixture for `invokesServiceManager()` used `spawnSync("node", ["--version"])` as an unrelated, non-violating synthetic source. `anno-cli-path-consumers.test.ts`'s pre-existing WR-20 gate scans every top-level source file's RAW text (no comment-stripping, by design) for exactly that shape — a spawn call whose first argument is the bare string `"node"` — and reported this synthetic fixture as its own offender. A first fix attempt replaced the call itself but left an EXPLANATORY COMMENT that still spelled out the same forbidden shape in prose, which WR-20 also caught (it does not strip comments).
- **Fix:** Changed the fixture to spawn `"npm"` instead of `"node"`, and reworded the explanatory comment to describe the shape without reproducing the literal forbidden text.
- **Files modified:** `src/mcp/vice/service-no-invoke.test.ts`
- **Verification:** `npm run test:automated` — only the single pre-existing, unrelated `phase58-citation-ledger.test.ts` failure remains (3986 tests / 3976 pass / 1 fail, up from 62-04's own recorded 3974 by exactly the 12 tests this plan adds).
- **Committed in:** `c5e86079` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in this plan's own new test fixtures, both direct consequences of this plan's own new file interacting with a pre-existing structural gate — no scope creep, nothing outside this plan's own new file was touched).
**Impact on plan:** Both fixes were necessary for the plan's own new test file to coexist cleanly with the pre-existing suite. Neither touches behavior or files outside `service-no-invoke.test.ts`.

## Issues Encountered

- `npm run test:automated` (the full automated gate) reproduces the same single pre-existing, unrelated failure every prior plan in this phase has already logged: `phase58-citation-ledger.test.ts`'s citation-anchor drift in `.planning/PROJECT.md` (line 2083, `anchor "a user missing ACME should learn that" not found in cited range`). Confirmed unrelated — this plan touches neither `.planning/PROJECT.md` nor anything `phase58-citation-ledger.test.ts` reads. Not re-logged in `deferred-items.md` (already open there from plan 62-01). Test counts: 3986 tests / 3976 pass / 1 fail, an exact match against 62-04's recorded 3974 plus this plan's 12 new tests.

## User Setup Required

None — no external service configuration required. (The two service definitions this plan ships ARE user-facing setup steps, but they are optional, documented in the README, and explicitly never applied by any code here — installing one is the reader's own choice, not a required follow-up to this plan.)

## Next Phase Readiness
- BROKER-02 and BROKER-05 are both fully covered by this plan's new structural gate; no further phase-62 plan depends on this one.
- The `phase58-citation-ledger.test.ts` failure remains open in `deferred-items.md` for whichever phase or hygiene pass owns `.planning/PROJECT.md`'s citation ledger.
- Every site that quotes the broker start command (the dial refusals, both service definitions, and the README) now agrees byte-for-byte, closing out D-01's "one command, four places, no divergence" requirement for this milestone.

---
*Phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine*
*Completed: 2026-09-19*

## Self-Check: PASSED

All created/modified files verified present on disk (`src/mcp/vice/service/vice-broker.service`, `src/mcp/vice/service/com.henols.vice-broker.plist`, `src/mcp/vice/service-no-invoke.test.ts`, `README.md`); both task commit hashes (`c5e86079`, `214cb330`) verified present in `git log`.
