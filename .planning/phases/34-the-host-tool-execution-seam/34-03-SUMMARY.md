---
phase: 34-the-host-tool-execution-seam
plan: 03
subsystem: infra
tags: [broker, control-plane, ghidra, host-tool, evidence]

requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "plan 34-01's host_tool control op and its typed allowlist (host-tool.mts's HOST_TOOL_IDS/HOST_TOOL_ARG_KEYS/normaliseHostToolRequest()/buildHostToolArgv()/runHostTool(), and the committed resources/host-tool.mjs artifact this plan extends rather than replaces)"
provides:
  - "ghidra-project.mts: hasDotPrefixedSegment() (checks EVERY absolute-path segment, not just the leaf), resolveGhidraProject() (per-run-id project location under <repoRoot>/tools/ghidra-runs, refusing reuse AND now creating the reserved directory), and buildAnalyzeHeadlessArgv() (argv construction with -deleteProject and an independent dot-segment re-check)"
  - "A second HOST_TOOL_IDS entry, \"ghidra.analyze\", accepting exactly runId/importPath/preScript/postScript, whose launcher resolves from GHIDRA_HOME/support/analyzeHeadless"
  - "A live, side-by-side transcript proving this project's own refusal fires in ~126-197ms with no analyzeHeadless process ever spawned, against Ghidra's own ~11-14s refusal for the identical two dot shapes"
affects: [34-04-PLAN, 34-05-PLAN, 34-06-PLAN]

actuals:
  tokens: 24317
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A pure, host-bound sibling module reached by a VALUE import of its compiled .mjs artifact (A-06) -- the same discipline plan 34-01 already established for host-tool.mts itself, now applied one level over for ghidra-project.mts"
    - "A 'resolve' function that RESERVES by creating, not just validates by checking -- discovered live this plan: a check-only resolveGhidraProject() left the happy path non-functional, because analyzeHeadless requires its project directory to exist beforehand on the success path too, not only the refusal path"
    - "Per-tool argv construction lives in the tool's own owning module (ghidra-project.mts), never copied into host-tool.mts's dispatch layer -- mirrors normaliseLaunchProfile()'s single-narrowing-site discipline one level deeper"

key-files:
  created:
    - src/mcp/vice/ghidra-project.mts
    - src/mcp/vice/ghidra-project.test.ts
    - src/mcp/vice/resources/ghidra-project.mjs
    - .planning/phases/34-the-host-tool-execution-seam/evidence/34-ghidra-dotpath.md
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/build.ts
    - src/mcp/vice/tsconfig.build.json
    - src/mcp/vice/resources/host-tool.mjs
    - .gitignore

key-decisions:
  - "hasDotPrefixedSegment() returns the offending SEGMENT, not a bare boolean -- lets every refusal message name the offender, and the same discriminated shape resolveWorkspacePath() already established in plan 34-01."
  - "resolveGhidraProject() now mkdirSync's the run directory as the LAST step of a successful resolution, never on a refusal -- a live finding (Task 3): real Ghidra 12.1.3 fails a clean, well-formed, not-yet-existing project location with java.io.FileNotFoundException: Directory not found at DefaultProjectManager.createProject(). Without this fix the ghidra.analyze happy path was non-functional. Making the resolver create (not just check) the directory turns a successful resolve into a genuine reservation: a second call under the same run id is refused with no window for two callers to both observe an absent directory."
  - "The dot-segment rule is checked on the run id (via RUN_ID_PATTERN, refusing any dot at all) AND independently on the full projectLocation (via hasDotPrefixedSegment, catching a dotted repoRoot ancestor) -- two different code paths for the two shapes Finding 2 identified, both proven live in evidence/34-ghidra-dotpath.md."
  - "tools/ghidra-runs/ added to .gitignore WITHOUT a leading slash -- host-scripts.test.ts's deployed-artifact parity scan matches any line starting with the literal '/tools/' prefix and would otherwise demand a resourceEntries() counterpart for a runtime-scratch directory that is not a deployed resource."

requirements-completed: [SEAM-04]

coverage:
  - id: D1
    description: "A dot-prefixed project-location path (leaf OR an ancestor two segments above a clean leaf) is refused by this project's own code in milliseconds, before any analyzeHeadless process starts, proven by 28 install-free unit cases (SEAM-04)"
    requirement: "SEAM-04"
    verification:
      - kind: unit
        ref: "ghidra-project.test.ts (28 cases, fail 0)"
        status: pass
      - kind: other
        ref: "evidence/34-ghidra-dotpath.md §1-2 (live Ghidra refusal ~11-14s vs this project's refusal ~126-197ms, ~89x ratio)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each run gets its own project directory keyed by run id under a non-dot-prefixed root, the argv carries -deleteProject, and a second call under the SAME run id is refused because the resolver now creates (reserves) the directory on success (SEAM-04)"
    requirement: "SEAM-04"
    verification:
      - kind: unit
        ref: "ghidra-project.test.ts#resolveGhidraProject: CREATES the run directory..., #...refuses reusing an existing run directory..., #...still refuses reuse even when a run's directory was created by an EARLIER, separate process..."
        status: pass
      - kind: other
        ref: "evidence/34-ghidra-dotpath.md §3 (live clean run, then a live same-run-id second call refused in 173ms with no launch)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ghidra.analyze is a typed allowlist entry on host-tool.mts reaching the dot-segment rule and project-location construction through a value import of ghidra-project.mjs, never a copy, with the launcher resolved from GHIDRA_HOME and refused by name when unset or missing (SEAM-04)"
    requirement: "SEAM-04"
    verification:
      - kind: unit
        ref: "host-tool.test.ts (6 new ghidra.analyze cases: unknown key, runId separator, dotted repoRoot, GHIDRA_HOME unset, well-formed argv)"
        status: pass
      - kind: other
        ref: "evidence/34-ghidra-dotpath.md §2 (pgrep confirms no analyzeHeadless process during a refused call)"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-09-03
status: complete
---

# Phase 34 Plan 03: The Ghidra Dot-Path Refusal and Per-Run Project Location Summary

**`ghidra-project.mts` refuses a dot-prefixed Ghidra project path (leaf or ancestor) in ~130-200ms with zero `analyzeHeadless` processes spawned — an ~89x speedup over Ghidra's own ~11-14s JVM-startup refusal — and now also creates the reserved per-run directory it was missing, a gap only real Ghidra exposed.**

## Performance

- **Duration:** ~31 min
- **Started:** 2026-09-03T13:46:20Z (approx, base commit)
- **Completed:** 2026-09-03T14:17:21Z
- **Tasks:** 3
- **Files modified:** 10 (4 created, 6 modified)

## Accomplishments

- `ghidra-project.mts`: `hasDotPrefixedSegment()` walks every segment of an absolute path (not just the leaf), `resolveGhidraProject()` computes and now RESERVES (creates) a per-run-id project directory under `<repoRoot>/tools/ghidra-runs/`, refusing reuse under the same run id, and `buildAnalyzeHeadlessArgv()` emits `-deleteProject` while re-checking the dot rule independently so it holds even for a caller that skipped the resolver.
- `ghidra-project.test.ts`: 28 cases, all passing with no Ghidra installation present — the dot-segment refusal (leaf, ancestor, `..`, doubled separator, `/` and `""` edge cases), the resolver's narrowing/idempotency/concurrency behavior, and the argv builder's determinism and independent re-check.
- `host-tool.mts` gains `"ghidra.analyze"` as its second `HOST_TOOL_IDS` entry (`runId`/`importPath`/`preScript`/`postScript` only), reaching the dot rule and location construction through a value import of `ghidra-project.mjs` — never a copy — with the launcher resolved from `GHIDRA_HOME` and refused by name when unset or missing on disk, before any process is spawned.
- `build.ts`/`tsconfig.build.json` gain `ghidra-project.mjs`/`.mts`; `resources/ghidra-project.mjs` and the regenerated `resources/host-tool.mjs` are both committed, and `resources-sync.test.ts` confirms byte-identity.
- **Live finding (Task 3), fixed in the same session:** real Ghidra 12.1.3 refuses to run against a clean, well-formed, not-yet-existing project location (`java.io.FileNotFoundException: Directory not found` at `DefaultProjectManager.createProject()`) — `analyzeHeadless` never creates the leaf directory on either the refusal path (already known from `34-RESEARCH.md` Finding 2) or the success path (new this session). `resolveGhidraProject()` was missing the `mkdirSync` step entirely; without it the tool's own happy path could never have completed a real run. Fixed by making a successful resolution also create the directory, turning "resolve" into "reserve."
- `evidence/34-ghidra-dotpath.md`: the full live transcript — Ghidra was in fact reachable at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` (this plan's own dispatch prompt searched the wrong set of paths and wrongly reported it absent) — both dot shapes refused by real Ghidra (~11-14s each), both refused by this project's own code (~126-197ms, zero `analyzeHeadless` processes spawned, confirmed by `pgrep`), a clean run that produced `exitStatus: 0`, and a same-run-id second call refused in 173ms before any launch.

## Task Commits

Each task was committed atomically:

1. **Task 1: The dot-segment refusal and the per-run project location, as one pure module** - `8f40450` (test)
2. **Task 2: The `ghidra.analyze` allowlist entry, wired to the one rule, and shipped** - `538f601` (feat)
3. **Task 3: The live Ghidra observation, recorded as a transcript outside the unit suite** - `7fd2b40` (docs)

**Interleaved fix, discovered during Task 3's own live probing:** `5694f27` (fix) — `resolveGhidraProject()` now creates the run directory it was only ever checking.

**Plan metadata:** commit to follow (this SUMMARY + STATE.md/ROADMAP.md)

## Files Created/Modified

- `src/mcp/vice/ghidra-project.mts` - the dot-segment refusal, per-run project location (now with reservation-by-creation), and analyzeHeadless argv construction
- `src/mcp/vice/ghidra-project.test.ts` - 28 install-free unit cases
- `src/mcp/vice/host-tool.mts` - `ghidra.analyze`'s typed allowlist entry, value-importing `ghidra-project.mjs`
- `src/mcp/vice/host-tool.test.ts` - 6 new `ghidra.analyze` cases extending plan 34-01's suite
- `src/mcp/vice/build.ts`, `src/mcp/vice/tsconfig.build.json` - `ghidra-project.mjs`/`.mts` added to the host-bound artifact set
- `src/mcp/vice/resources/ghidra-project.mjs`, `src/mcp/vice/resources/host-tool.mjs` - committed build artifacts
- `.gitignore` - `/tools/ghidra-project.mjs` (deployed artifact) and `tools/ghidra-runs/` (runtime scratch output, no leading slash so the parity scan doesn't mistake it for a deployed resource) added
- `.planning/phases/34-the-host-tool-execution-seam/evidence/34-ghidra-dotpath.md` - the live transcript

## Decisions Made

- **`resolveGhidraProject()` creates the directory it resolves, not just checks it.** See key-decisions above — a live finding, not a planned design choice, promoted to the resolver's own contract because the alternative (creating it in `host-tool.mts` or leaving it to the caller) would have split "the one place that owns the per-run project location" across two files.
- **`.gitignore`'s `tools/ghidra-runs/` line omits the leading slash** deliberately, to stay outside `host-scripts.test.ts`'s `/tools/`-prefixed deployed-artifact parity scan (that scan requires every matched line to have a `resourceEntries()` counterpart, which a runtime-scratch directory does not have).
- Reused plan 34-01's `resolveWorkspacePath()` for `importPath` unchanged — the workspace-escape mitigation is the same one site for every tool, never a second copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Bug / Missing Critical Functionality] `resolveGhidraProject()` never created the project directory it resolved, leaving the entire `ghidra.analyze` happy path non-functional**
- **Found during:** Task 3 (the live clean-run probe)
- **Issue:** The plan's own Task 1 action text specified only a `existsSync()`-based no-reuse check for `resolveGhidraProject()`. Live testing against real Ghidra 12.1.3 showed `analyzeHeadless` refuses a clean, well-formed, not-yet-existing project location with `java.io.FileNotFoundException: Directory not found` at `DefaultProjectManager.createProject()` — it creates nothing itself on the success path, mirroring (but distinct from) Finding 2's refusal-path claim. Without a directory-creation step, no real `ghidra.analyze` run could ever succeed.
- **Fix:** `resolveGhidraProject()` now `mkdirSync`s the computed `projectLocation` as the last step of a successful resolution (never on a refusal), turning a successful resolve into a genuine reservation.
- **Files modified:** `src/mcp/vice/ghidra-project.mts`, `src/mcp/vice/ghidra-project.test.ts` (new case asserting the directory exists after a successful resolve; the pre-existing idempotency case still passes unchanged since a repeat `mkdirSync({recursive:true})` on an existing directory is a no-op)
- **Verification:** Re-ran the live clean-run probe after the fix — `exitStatus: 0`, project directory created and survived (empty, post-`-deleteProject`), and a second call under the same run id refused in 173ms with no launch. All 28 `ghidra-project.test.ts` cases and all 61 `host-tool.test.ts`+`ghidra-project.test.ts` cases still pass.
- **Committed in:** `5694f27` (separate fix commit, interleaved between Task 2 and Task 3)

**2. [Rule 3 - Blocking] The new `resources/ghidra-project.mjs` artifact and `tools/ghidra-runs/` scratch directory needed `.gitignore` entries**
- **Found during:** Task 2 (build side effect deployed `tools/ghidra-project.mjs`) and Task 3 (the live probe created `tools/ghidra-runs/` inside the real repo tree)
- **Issue:** Mirrors plan 34-01's own precedent for `tools/host-tool.mjs`. Left un-ignored, both would show up as untracked noise in `git status`.
- **Fix:** Added `/tools/ghidra-project.mjs` (deployed artifact, leading slash, matching the existing per-file block) and `tools/ghidra-runs/` (runtime scratch output, no leading slash, so `host-scripts.test.ts`'s parity scan does not demand a `resourceEntries()` counterpart for it) to `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** `node --test host-scripts.test.ts` — the two-way parity test passes; `git check-ignore -v tools/ghidra-runs/foo/bar` confirms the rule matches.
- **Committed in:** `538f601` (Task 2) and `5694f27` (the fix commit) respectively.

---

**Total deviations:** 2 auto-fixed (1 Rule 1/2 — a genuine correctness gap only live testing against real Ghidra could surface; 1 Rule 3 — mechanical `.gitignore` hygiene anticipated by plan 34-01's own precedent).
**Impact on plan:** The Rule 1/2 fix is the single most consequential outcome of this plan's live-testing requirement — it is exactly the kind of gap a plan that only unit-tested against synthetic paths would have shipped silently broken. No scope creep: both fixes are the mechanical, in-scope consequence of this plan's own Task 3 mandate to observe reality rather than assume it.

## Issues Encountered

**The dispatch prompt's own environment check was wrong.** It asserted "GHIDRA IS NOT INSTALLED ON THIS HOST" after searching `~/ghidra*`, `/opt/ghidra*`, `/usr/share/ghidra`, `/usr/local/ghidra`, and `~/.local/share/ghidra` — none of which is where `34-RESEARCH.md`'s own § *Environment Availability* records the real installation (`/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`, a path outside the searched set). Verified present and functional before proceeding; Task 3 was executed as a genuine live observation rather than the "unavailable" fallback the dispatch prompt anticipated. This is recorded prominently in `evidence/34-ghidra-dotpath.md`'s own opening section for any future reader who trusts the dispatch prompt over the actual filesystem.

## User Setup Required

None - no external service configuration required. (`GHIDRA_HOME` is a per-invocation environment variable a `ghidra.analyze` caller must set; not a one-time setup step for this project.)

## Next Phase Readiness

- The `ghidra.analyze` allowlist entry, its dot-segment refusal, and its per-run reservation are all proven against real Ghidra 12.1.3 in the same session, not merely unit-tested against synthetic paths — plans 34-04 through 34-06 (skill-script migrations, the second prefix floor, and the JVM-lifetime decision record) can build on a `ghidra.analyze` that is known to work end-to-end, including its one live-discovered fix.
- `evidence/34-ghidra-dotpath.md` records the measured `test:automated` baseline (3195 tests, 3187 pass, 2 pre-existing failures in `anno-register.test.ts`, unchanged from plans 34-01/34-02's own recorded baseline) for any later plan that needs to confirm it inherited a clean starting point.
- No blockers.

## Self-Check: PASSED

- FOUND: src/mcp/vice/ghidra-project.mts
- FOUND: src/mcp/vice/ghidra-project.test.ts
- FOUND: src/mcp/vice/resources/ghidra-project.mjs
- FOUND: .planning/phases/34-the-host-tool-execution-seam/evidence/34-ghidra-dotpath.md
- FOUND commit: 8f40450
- FOUND commit: 538f601
- FOUND commit: 5694f27
- FOUND commit: 7fd2b40
- `node --test ghidra-project.test.ts`: 28/28 pass
- `node --test host-tool.test.ts ghidra-project.test.ts resources-sync.test.ts`: 61/61 pass (plus resources-sync's 2)
- `npm run typecheck`: clean
- `npm run test:automated`: 3195 tests, 3187 pass, 2 fail — unchanged from the documented pre-existing baseline

---
*Phase: 34-the-host-tool-execution-seam*
*Completed: 2026-09-03*
