---
phase: 34-the-host-tool-execution-seam
plan: 08
subsystem: infra
tags: [host-tool, oracle, argv-construction, security, gap-closure, trust-boundary]

requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "plan 34-01's host_tool executor (host-tool.mts's HOST_TOOL_IDS/normaliseHostToolRequest()/resolveWorkspacePath()/buildHostToolArgv()/runHostTool()) and plan 34-04's oracle.probe/oracle.run entries (runOracleProbe()/runOracleRun()), which this plan closes the worst remaining gap in; plan 34-07's resolved-paths pattern for acme.build/ghidra.analyze, which this plan's census generalises"
provides:
  - "resolveOracleCommand(): the ONE place the oracle binary's location is decided, reading the broker process's own UNP64/UNP64_PATH environment, checked by base name and existence, consulted by BOTH runOracleProbe() and runOracleRun() (CR-01)"
  - "The oracle.probe wire key `command` removed entirely -- HOST_TOOL_ARG_KEYS[\"oracle.probe\"] is a frozen empty array, so no caller-supplied value can ever select what the host executes"
  - "packer-finding.mjs sends no oracle configuration across the seam; a container-side UNP64/UNP64_PATH variable becomes a diagnostic hint (oracleConfigurationHint()) that never selects the binary and never echoes its value"
  - "HOST_TOOL_PATH_ARG_KEYS: a declared, tested census of every path-bearing argument key across all four tools (7 total), with a both-directions completeness case and a data-driven escaping/absolute refusal loop with a non-vacuity executed-count control"
affects: [34-09-PLAN]

actuals:
  tokens: 14200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One resolver, both branches: resolveOracleCommand() is consulted by runOracleProbe() AND runOracleRun(), mirroring findAcmeLib()'s own host-side-probe precedent (34-04) -- a host-side configured oracle can no longer be honoured by the probe and silently ignored by the run."
    - "Wire-key removal strictly subsumes a basename allowlist: rather than requiring the override to resolve inside the workspace (which would hand the caller-writable-workspace principal a host-execution primitive) or merely narrowing to a basename check, the wire key is removed outright and the basename check is kept as a SECOND layer over the host-resolved value."
    - "Container-side environment as hint, never configuration: packer-finding.mjs's oracleConfigurationHint() turns a container-side UNP64/UNP64_PATH into diagnostic text only, appended to an oracle-absent reason -- never a route to what the host executes."
    - "Data-driven census over point fixes: HOST_TOOL_PATH_ARG_KEYS declares every path-bearing key once; a completeness case (both directions) and a refusal loop (with an executed-count non-vacuity control) prove the property for the CURRENT key set and red automatically the moment a new key is added without classification."

key-files:
  created: []
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/resources/host-tool.mjs
    - src/skills/c64-program-recon/scripts/packer-finding.mjs
    - src/skills/c64-program-recon/scripts/packer-finding.test.mjs
    - src/skills/c64-program-recon/SKILL.md
    - src/mcp/vice/module-classification.ts

key-decisions:
  - "Removed runOracleProbe()'s `args` parameter entirely (it now takes only `deps`) rather than keeping an unused parameter -- the wire request carries no configuration for this tool at all, so the function signature says so directly."
  - "resolveOracleCommand() checks base name BEFORE existence -- a wrongly-named file and a missing file both answer oracle-absent, but the order matters for which reason text a caller sees when both a stray file and a real absence are possible; base name is the cheaper, more informative check to report first."
  - "runOracleRun()'s new resolver check runs AFTER the input-file existence check but BEFORE the scratch-directory creation -- an oracle-absent refusal must never leave a scratch directory behind, mirroring 34-07's own 'resolve before any side-effecting reservation' pattern for Ghidra's run-directory."
  - "The empty-accepted-key-list message for oracle.probe reads \"an object with no accepted keys\" rather than the generic (and, for an empty list, malformed-looking) \"an object with optional key(s) \" the shared message builder would otherwise produce -- a small, targeted improvement to the SAME shared refusal path, not new refusal code."
  - "HOST_TOOL_PATH_ARG_KEYS deliberately excludes ghidra.analyze's `runId`: it is a validated opaque id bounded by its own anchored pattern (RUN_ID_PATTERN), turned into a path only by resolveGhidraProject() -- a different mechanism with its own guard, not resolveWorkspacePath()."
  - "Fixed a stale line-number prose citation in module-classification.ts (SKILL.md:352 -> SKILL.md:359) that this plan's own SKILL.md edit shifted -- caught by the automated suite's DIRECTION 9b prose-citation-drift check, not left for a later plan to trip over."

requirements-completed: [SEAM-02]

coverage:
  - id: D1
    description: "No container-side wire value reaches a host spawn's EXECUTABLE position for any tool: oracle.probe accepts no argument key at all, and the oracle binary's location is resolved from the broker process's own environment on the host (SEAM-02, CR-01)"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#normaliseHostToolRequest({ tool: \"oracle.probe\" }) is accepted -- the tool takes no arguments at all"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: oracle.probe with no oracle environment variable set resolves the bare expected binary name and reports oracle-absent, never a rejection"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: oracle.probe with a host-side variable naming an existing, executable fake NAMED as the expected binary reports available with that resolved path as command"
        status: pass
      - kind: integration
        ref: "host-tool.test.ts#END TO END: an oracle.probe request carrying the retired \"command\" key is refused at the container-side caller with ok: false naming the key, over the real control-plane route, with all seven VICE callbacks provably uncalled"
        status: pass
    human_judgment: false
  - id: D2
    description: "A request carrying the retired `command` key is refused BY NAME with the accepted shape stated -- never accepted-and-ignored -- so a version-skewed older skill script degrades to a diagnosable oracle-absent result"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#normaliseHostToolRequest({ tool: \"oracle.probe\", args: { command: ... } }) is refused, naming the retired key and the accepted shape"
        status: pass
    human_judgment: false
  - id: D3
    description: "A host-side configured oracle path whose file name is not the expected binary name is treated as oracle-absent, and neither the path nor any part of it appears anywhere in the response (CR-01, T-19-18)"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: oracle.probe with a host-side variable naming an existing file whose base name is NOT the expected binary reports oracle-absent, and the configured path appears nowhere in the response"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: oracle.probe with a host-side variable naming a non-existent path (correctly named, but absent on disk) reports oracle-absent, the reason names the variable, and the path appears nowhere in the response"
        status: pass
    human_judgment: false
  - id: D4
    description: "oracle.probe and oracle.run spawn the SAME resolved command -- a host-side configured path the probe accepted is the path the run uses"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: oracle.run spawns the SAME resolved command oracle.probe would -- a fake named as the expected binary writes a known stdout line, and oracle.run returns it"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every path-bearing accepted argument key of every tool is declared in one table, and a data-driven case proves each declared key refuses an escaping value -- so 'no argv passthrough anywhere' is enforced by a mechanism, not three point fixes"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_PATH_ARG_KEYS: every declared path key is a member of that tool's accepted-key list, and accepted-minus-path equals a pinned remainder, in BOTH directions"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_PATH_ARG_KEYS: every declared path key refuses an escaping value and an absolute value, with the executed-assertion count equal to twice the declared total (non-vacuity)"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_PATH_ARG_KEYS: the ghidra.analyze path keys' refusals are observed with GHIDRA_HOME unset, proving the refusal precedes any launcher lookup"
        status: pass
    human_judgment: false
  - id: D6
    description: "The accepted-key set of every tool is exactly the union of its declared path-bearing keys and a pinned non-path remainder, so a newly added argument key cannot land unclassified"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_PATH_ARG_KEYS: every declared path key is a member of that tool's accepted-key list, and accepted-minus-path equals a pinned remainder, in BOTH directions"
        status: pass
      - kind: other
        ref: "manual planted-check: adding a hypothetical eighth acme.build key not present in either list reds the completeness case's per-tool remainder comparison (verified live during execution, not merely claimed -- see Deviations/Verification notes below)"
        status: pass
    human_judgment: false
  - id: D7
    description: "packer-finding.mjs sends no oracle configuration across the seam, and a container-side environment variable can only ever add a diagnostic hint to an absent result -- it can never select what the host executes (CR-01)"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "packer-finding.test.mjs#oracleConfigurationHint: null when no oracle variable is set, and a non-empty hint naming the variable and the host broker environment (never the value) when one is"
        status: pass
      - kind: unit
        ref: "packer-finding.test.mjs#probeUnp64: a bogus container-side oracle value never appears in the serialised result, on either availability branch"
        status: pass
      - kind: unit
        ref: "packer-finding.test.mjs#source level: no oracle-path existence check remains, and the probe's seam call forwards no oracle configuration"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-03
status: complete
---

# Phase 34 Plan 08: The Oracle Command-Argv Closure and the Path-Key Census Summary

**CR-01 closed: `oracle.probe`'s caller-supplied host-absolute `command` wire key is removed entirely, the oracle's location is now decided by one host-side resolver consulted by both `oracle.probe` and `oracle.run`, and a new `HOST_TOOL_PATH_ARG_KEYS` census with a data-driven refusal loop makes "no argv passthrough anywhere" a tested mechanism across all seven declared path-bearing keys rather than three point fixes.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-03T18:44:00Z (approx.)
- **Completed:** 2026-09-03T19:13:00Z
- **Tasks:** 3
- **Files modified:** 7 (0 created, 7 modified)

## Accomplishments

- `HOST_TOOL_ARG_KEYS["oracle.probe"]` is now a frozen EMPTY array; the retired `command` key is refused by name through the existing unknown-key check (no new refusal code needed). `OracleProbeArgs` is now `Record<string, never>`.
- `resolveOracleCommand()` is the ONE place the oracle binary's location is decided: it reads the broker process's own `UNP64`/`UNP64_PATH` environment (in that order), checks the resolved path's base name against the expected binary name, then its existence on disk, and never echoes a configured value in any refusal reason. Both `runOracleProbe()` and `runOracleRun()` now route through it -- `runOracleRun()` previously spawned a bare `DEFAULT_ORACLE_COMMAND` unconditionally, silently ignoring a host-side configured oracle the probe had already honoured; that asymmetry is now closed as a real defect, not merely a mechanical follow-on.
- `packer-finding.mjs`'s `probeUnp64()` no longer forwards a container-side `UNP64`/`UNP64_PATH` value to the seam and no longer checks its existence on this script's own (wrong) filesystem -- the seam call is now unconditional with an empty argument object. A new exported `oracleConfigurationHint()` turns a container-side environment record into diagnostic text only (naming the variable, never its value), appended to an oracle-absent `reason`.
- `HOST_TOOL_PATH_ARG_KEYS` declares, per tool, exactly which accepted argument keys name a filesystem path (3 for `acme.build`, 3 for `ghidra.analyze`, 1 for `oracle.run`, 0 for `oracle.probe` -- 7 total), deliberately excluding `ghidra.analyze`'s `runId` (a validated opaque id resolved by a different mechanism, `resolveGhidraProject()`). A both-directions completeness case, a data-driven escaping/absolute refusal loop with an executed-count non-vacuity control, and a dedicated GHIDRA_HOME-unset case all pass.
- `src/skills/c64-program-recon/SKILL.md` documents that the container-side environment is not consulted at all, and that the configured path's file name must be the oracle binary's own name or the seam treats it as absent.
- A stale prose line-number citation in `module-classification.ts` (introduced by this plan's own `SKILL.md` edit shifting line numbers) was caught by the automated suite's own drift check and repaired in the same task's commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end -- the oracle's location decided host-side, the wire key gone, and the retired key refused across the real control-plane route** - `666655f` (feat)
2. **Task 2: The client side -- `packer-finding.mjs` sends no oracle configuration, and the container-side variable becomes a hint that never echoes its value** - `68d4c58` (feat)
3. **Task 3: The census that makes "no argv passthrough anywhere" a mechanism -- every path-bearing key declared, every one proven to refuse an escape** - `97832aa` (test)

**Plan metadata:** commit to follow (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md)

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - `resolveOracleCommand()` added (consulted by both oracle branches); `HOST_TOOL_ARG_KEYS["oracle.probe"]` is now `[]`; `OracleProbeArgs` is `Record<string, never>`; `runOracleProbe()`'s signature drops its unused `args` parameter; `runOracleRun()` routes through the resolver before its scratch-directory creation; `HOST_TOOL_PATH_ARG_KEYS` added, declaring the 7 path-bearing keys across all four tools
- `src/mcp/vice/host-tool.test.ts` - 9 new Task 1 cases (retired-key refusal, two accepted-empty-args shapes, basename-mismatch/missing-path absences, the correctly-named-fake availability case, the oracle-run-uses-the-resolver case, and an end-to-end retired-key refusal over the real control-plane route) plus 3 new Task 3 cases (both-directions completeness, the data-driven refusal loop with its non-vacuity executed-count control, and the GHIDRA_HOME-unset Ghidra case)
- `src/mcp/vice/resources/host-tool.mjs` - regenerated committed build artifact, byte-identical to a fresh `node build.ts` (confirmed by `resources-sync.test.ts`)
- `src/skills/c64-program-recon/scripts/packer-finding.mjs` - `probeUnp64()` sends an unconditional empty-argument seam call; new exported `oracleConfigurationHint()`; the client-side existence check on a configured oracle path is deleted
- `src/skills/c64-program-recon/scripts/packer-finding.test.mjs` - the old configured-path probe case replaced with 3 new cases: the hint function's own behaviour, the no-echo property over the serialised result on either availability branch, and a source-level structural case (with a planted-violation non-vacuity control)
- `src/skills/c64-program-recon/SKILL.md` - documents that the container-side environment is not consulted at all, and the configured path's file name must be the oracle's own name
- `src/mcp/vice/module-classification.ts` - one stale prose line-number citation repaired (`SKILL.md:352` -> `SKILL.md:359`), a mechanical consequence of the SKILL.md edit above

## Decisions Made

See `key-decisions` in the frontmatter for the six decisions and their rationale: dropping `runOracleProbe()`'s unused parameter, the base-name-before-existence check order, resolving before the oracle.run scratch-directory side effect, the empty-accepted-key-list message wording, excluding `ghidra.analyze`'s `runId` from the path-key census, and the module-classification.ts citation repair.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale prose line-number citation in `module-classification.ts` after the SKILL.md edit**
- **Found during:** Task 3 (running `npm run test:automated` to compare against the documented 5-in-3 floor)
- **Issue:** `module-classification.ts:432` cites `src/skills/c64-program-recon/SKILL.md:352` as the line documenting the `.d64` directory-listing/refusal guidance. Task 2's `SKILL.md` edit inserted 5 net new lines earlier in the file, shifting that content to line 359 and leaving line 352 blank. `module-classification.test.ts`'s DIRECTION 9b prose-citation-drift check caught this immediately.
- **Fix:** Updated the citation to `SKILL.md:359`, the correct post-edit line.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` -- 20/20 pass; re-ran the full `npm run test:automated` afterward and confirmed the failure count returned to the documented 2-in-3251 floor.
- **Committed in:** `97832aa` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 -- a bug this plan's own SKILL.md edit introduced, caught by the automated suite before it could ship).
**Impact on plan:** No scope creep -- a mechanical, in-repo consequence of a documented edit, caught and fixed within the same execution.

## Verification Notes

- The planted-check observation for D6/acceptance criterion "Adding a hypothetical eighth accepted key without classifying it reds the completeness case" was verified LIVE during execution (not merely claimed): a throwaway script constructed a copy of `HOST_TOOL_ARG_KEYS` with a hypothetical `"bogusEighthKey"` added to `acme.build`'s accepted-key list (never added to `HOST_TOOL_PATH_ARG_KEYS` or to the pinned remainder), and re-ran the completeness comparison against the SAME pinned remainder the real test file uses. The comparison reported a mismatch for `acme.build` (`computedRemainder` included `"bogusEighthKey"`, `pinnedRemainder` did not), confirming the guard reds exactly as designed. This was a manual verification step, not a committed test case (the committed suite's own non-vacuity controls -- the executed-assertion-count check in the refusal-loop case, and the both-directions completeness check itself -- are what ships).
- `npm run test:automated` (no VICE broker running): 3251 tests, 3243 pass, 2 fail, 1 skipped, 5 todo. The 2 failures are the documented pre-existing floor (`anno-register.test.ts`, `STORE-01`/`STORE-04`/`STORE-06`/`MCP-04` requirement-register bookkeeping, unrelated to this plan's files) -- unchanged in identity from the baseline, confirmed both before and after the module-classification.ts fix above.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `SEAM-02` is now `ready to mark complete`: both plans that share it (`34-07` for `CR-02`/`CR-03`, and this plan for `CR-01` plus the path-key census) have finished. The shared-ID gate (`requirements.ready-ids`) should report `1/1` after this plan's `update_requirements` step runs.
- `34-09` (the remaining gap-closure plan in this round, addressing CR-04's DoS budget) can proceed independently -- it does not depend on anything this plan changed beyond the already-stable `host-tool.mts` seam.
- No blockers.

## Self-Check: PASSED

- FOUND: src/mcp/vice/host-tool.mts
- FOUND: src/mcp/vice/host-tool.test.ts
- FOUND: src/mcp/vice/resources/host-tool.mjs
- FOUND: src/skills/c64-program-recon/scripts/packer-finding.mjs
- FOUND: src/skills/c64-program-recon/scripts/packer-finding.test.mjs
- FOUND: src/skills/c64-program-recon/SKILL.md
- FOUND: src/mcp/vice/module-classification.ts
- FOUND commit: 666655f
- FOUND commit: 68d4c58
- FOUND commit: 97832aa
- `node build.ts && node --test host-tool.test.ts`: 56/56 pass
- `node --test src/skills/c64-program-recon/scripts/packer-finding.test.mjs`: 18/18 pass, 1 skipped (named, expected)
- `node --test resources-sync.test.ts`: 2/2 pass
- `npm run typecheck`: clean
- `node scripts/check-no-skill-external-spawn.mjs`: OK
- `node scripts/check-skill-cli-invocations.mjs`: OK
- `npm run test:automated`: 3251 tests, 3243 pass, 2 fail (pre-existing floor, unrelated), 1 skipped, 5 todo

---
*Phase: 34-the-host-tool-execution-seam*
*Completed: 2026-09-03*
