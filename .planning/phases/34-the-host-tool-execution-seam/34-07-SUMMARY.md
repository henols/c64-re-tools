---
phase: 34-the-host-tool-execution-seam
plan: 07
subsystem: infra
tags: [host-tool, ghidra, acme, argv-construction, security, gap-closure]

requires:
  - phase: 34-the-host-tool-execution-seam
    provides: "plan 34-01's host_tool executor (host-tool.mts's HOST_TOOL_IDS/normaliseHostToolRequest()/resolveWorkspacePath()/buildHostToolArgv()/runHostTool()) and plan 34-03's ghidra-project.mts (hasDotPrefixedSegment()/resolveGhidraProject()/buildAnalyzeHeadlessArgv()), both of which this plan extends rather than replaces"
provides:
  - "acme.build's includes array resolved through resolveWorkspacePath() at one site, with ResolvedAcmeBuildPaths.includePaths the ONLY source buildHostToolArgv() reads for -I flags (CR-03)"
  - "ghidra.analyze's preScript/postScript resolved through the same resolveWorkspacePath() site importPath already uses, with ResolvedGhidraAnalyzePaths.preScriptPath/postScriptPath the ONLY source buildHostToolArgv() reads (CR-02)"
  - "buildAnalyzeHeadlessArgv()'s independent second-layer refusal for a preScript/postScript carrying a parent-directory path segment, mirroring its existing dot-segment re-check on projectLocation"
  - "A corrected HOST_TOOL_ARG_KEYS header comment describing what the code actually does per field, replacing a false blanket claim"
affects: [34-08-PLAN, 34-09-PLAN]

actuals:
  tokens: 12237
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Resolve-then-read: every path-bearing wire field is resolved through resolveWorkspacePath() in runHostTool(), producing a resolved-paths object that is the ONLY thing buildHostToolArgv() reads for that field -- never request.args -- proven per field by a test where the resolved value and the wire value disagree."
    - "Independent second-layer re-check in the tool's own owning module (ghidra-project.mts's buildAnalyzeHeadlessArgv()) so a caller that bypassed the executor's resolver still cannot smuggle a parent-directory segment through -- exact per-segment equality (never a substring test), mirroring hasDotPrefixedSegment()'s existing style."
    - "Resolve path arguments BEFORE any side-effecting reservation (resolveGhidraProject()'s directory creation) so a refusal never leaves an orphaned reserved-but-unused run directory."

key-files:
  created: []
  modified:
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/ghidra-project.mts
    - src/mcp/vice/ghidra-project.test.ts
    - src/mcp/vice/resources/host-tool.mjs
    - src/mcp/vice/resources/ghidra-project.mjs
    - src/skills/acme-build/SKILL.md

key-decisions:
  - "Tightened normaliseHostToolRequest's acme.build includes narrowing to refuse an empty-string entry (`i !== \"\"` added to the existing `every` predicate) rather than relying on resolveWorkspacePath()'s own non-empty-string check downstream -- keeps the SAME message text (\"must be an array of strings\") the acceptance criteria named, refusing at the narrowing site rather than one call deeper."
  - "In runHostTool()'s ghidra.analyze block, preScript/postScript are resolved BEFORE resolveGhidraProject()'s own directory-creation side effect runs -- a script-path refusal must never leave a reserved-but-unused run directory behind."
  - "The second-layer parent-directory check in buildAnalyzeHeadlessArgv() tests for an EXACT `..` segment (via the same per-segment split hasDotPrefixedSegment() uses), not a substring match and not hasDotPrefixedSegment()'s own dot-prefix rule -- a bare Ghidra script name starting with two literal dots (e.g. a hypothetical `..foo.java`) is a single segment, not a parent-directory reference, and must stay accepted; only `hasDotPrefixedSegment()` governs projectLocation, never preScript/postScript."
  - "Split the implementation into two atomic per-task commits by reconstructing each task's intermediate file state (backing up the final combined edits, reverting the other task's hunks, committing, then restoring) rather than a single combined commit -- matches this phase's own established Task-Commits-per-plan pattern (34-01, 34-03) even though both tasks were authored in one editing pass."

requirements-completed: []

coverage:
  - id: D1
    description: "Every acme.build `includes` entry is resolved through resolveWorkspacePath() before it reaches ACME's -I argv, and an escaping or absolute entry refuses the WHOLE request with no partial-success degradation (CR-03, SEAM-02)"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#buildHostToolArgv's acme.build branch reads includes from resolved.includePaths, never from request.args.includes -- proven by a case where they disagree"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: an acme.build request whose includes contains an escaping entry is refused with the workspace-escape message, and the log spy recorded zero lines"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: an acme.build include of \".\" (resolving EXACTLY to the workspace root) is accepted, and a sibling directory whose name merely begins with the workspace root's own name is REFUSED (adjacency)"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: acme.build includes keep caller order in the spawned argv, and two entries resolving to the SAME directory both appear (no dedupe, no reordering)"
        status: pass
      - kind: integration
        ref: "host-tool.test.ts#END TO END: an acme.build request whose includes escapes the workspace root is refused at the container-side caller with ok: false, over the real control-plane route, with all seven VICE callbacks provably uncalled"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every ghidra.analyze preScript/postScript is resolved through resolveWorkspacePath() before it reaches analyzeHeadless's argv, and an escaping or absolute value refuses the whole request; the HOST_TOOL_ARG_KEYS header comment now describes the true per-field mechanism instead of a false blanket claim (CR-02, SEAM-02)"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "host-tool.test.ts#buildHostToolArgv: ghidra.analyze reads preScript/postScript from resolved.preScriptPath/postScriptPath, never from request.args -- proven by a case where they disagree"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: a ghidra.analyze preScript that escapes the workspace root is refused with the workspace-escape message, and the log spy recorded zero lines"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: an accepted in-workspace ghidra.analyze preScript reaches the spawned argv as an absolute resolved path, never the bare relative string"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildAnalyzeHeadlessArgv() independently refuses a preScript/postScript carrying a parent-directory path segment, so the rule holds for a caller that bypassed the executor -- a bare Ghidra script name stays accepted, and a name merely containing two dots is not misjudged"
    requirement: "SEAM-02"
    verification:
      - kind: unit
        ref: "ghidra-project.test.ts#buildAnalyzeHeadlessArgv: refuses a preScript/postScript containing a parent-directory segment, naming the field, even when projectLocation is clean"
        status: pass
      - kind: unit
        ref: "ghidra-project.test.ts#buildAnalyzeHeadlessArgv: a preScript containing merely TWO DOTS in the filename (not a parent-directory SEGMENT) is accepted"
        status: pass
      - kind: unit
        ref: "ghidra-project.test.ts#buildAnalyzeHeadlessArgv: a bare Ghidra script name for preScript/postScript (no path separator) is still accepted"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-09-03
status: complete
---

# Phase 34 Plan 07: The Include and Script-Path Argv-Passthrough Closure Summary

**Both confirmed argv-passthrough gaps from the phase review are closed: `acme.build`'s `includes` array and `ghidra.analyze`'s `preScript`/`postScript` now flow through `resolveWorkspacePath()` before reaching a child process's argv, and `buildHostToolArgv()` reads every path it emits from a resolved-paths parameter — never from the raw wire request — for both tools.**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-09-03T18:17:00Z (approx.)
- **Completed:** 2026-09-03T18:43:21Z
- **Tasks:** 2
- **Files modified:** 7 (0 created, 7 modified)

## Accomplishments

- `acme.build`'s `includes` entries are each resolved through `resolveWorkspacePath()` at the SAME site `source`/`outDir` already use, collected into `ResolvedAcmeBuildPaths.includePaths`; `buildHostToolArgv()`'s acme branch reads `-I` values ONLY from that array. An escaping or absolute entry refuses the whole request (no partial-success degradation); an empty-string entry is now refused by `normaliseHostToolRequest`'s own narrowing rather than silently accepted.
- `ghidra.analyze`'s `preScript`/`postScript` are each resolved the same way, into `ResolvedGhidraAnalyzePaths.preScriptPath`/`postScriptPath`, BEFORE `resolveGhidraProject()`'s own directory-reservation side effect runs — a script-path refusal never leaves an orphaned run directory behind.
- `buildAnalyzeHeadlessArgv()` (`ghidra-project.mts`) independently refuses a `preScript`/`postScript` carrying a parent-directory path segment, using the same per-segment-splitting discipline `hasDotPrefixedSegment()` already uses for `projectLocation` — so the rule survives a caller that constructed these fields itself and skipped `host-tool.mts` entirely. A bare Ghidra script name (`Pre.java`) and a name merely containing two dots (`..foo.java`, not a parent-directory *segment*) both stay accepted.
- `HOST_TOOL_ARG_KEYS`'s doc comment — which falsely claimed all four `ghidra.analyze` keys already flowed through a resolver — is corrected to name the actual per-field mechanism (`runId` through `resolveGhidraProject()`, `importPath`/`preScript`/`postScript` through `resolveWorkspacePath()`, plus the argv builder's independent re-check).
- Adjacency (`.` accepted, a name-prefix sibling refused), empty/absent-includes equivalence, and ordering/no-dedupe edges are all covered by new `host-tool.test.ts` cases; an end-to-end escaping-include refusal runs over the real control-plane route with all seven VICE callbacks provably uncalled, carrying no ACME-availability skip since nothing is ever spawned.
- `src/skills/acme-build/SKILL.md` documents the `-I DIR` contract change: workspace-relative resolution, with an absolute or escaping directory refused by the seam.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — one escaping `acme.build` include, refused across the real control-plane route** - `0515b95` (feat)
2. **Task 2: `ghidra.analyze`'s `preScript`/`postScript` resolved, the false header comment corrected, and the rule enforced in a second layer** - `d98fb22` (feat)

**Plan metadata:** commit to follow (this SUMMARY + STATE.md/ROADMAP.md)

## Files Created/Modified

- `src/mcp/vice/host-tool.mts` - `ResolvedAcmeBuildPaths.includePaths` and `ResolvedGhidraAnalyzePaths.preScriptPath`/`postScriptPath` added; `buildHostToolArgv()`'s acme and ghidra branches read paths ONLY from the resolved-paths parameter; `runHostTool()` resolves the include array and both script fields; `normaliseHostToolRequest()`'s acme.build includes narrowing refuses an empty-string entry; `HOST_TOOL_ARG_KEYS`'s doc comment corrected; header WHAT-NOT-TO-DO bullet widened to name both fixed fields
- `src/mcp/vice/host-tool.test.ts` - 13 new cases (9 Task 1, 4 Task 2) plus the pre-existing ordering test updated to assert on resolved paths instead of raw wire strings; a new `echoargv` fake-acme mode and a Node-script `analyzeHeadless` stand-in let tests observe the actual spawned argv, which `runHostTool()`'s own response shape never surfaces
- `src/mcp/vice/ghidra-project.mts` - `buildAnalyzeHeadlessArgv()` gains the independent parent-directory-segment refusal for `preScript`/`postScript`; header comments updated to name it
- `src/mcp/vice/ghidra-project.test.ts` - 4 new cases: two second-layer refusals (naming the field), the two-dots-in-a-filename non-misjudgment case, and the bare-script-name acceptance
- `src/mcp/vice/resources/host-tool.mjs`, `src/mcp/vice/resources/ghidra-project.mjs` - regenerated committed build artifacts, byte-identical to a fresh `node build.ts` (confirmed by `resources-sync.test.ts`)
- `src/skills/acme-build/SKILL.md` - documents `-I DIR`'s workspace-relative resolution and the refusal of absolute/escaping values

## Decisions Made

See `key-decisions` in the frontmatter for the four decisions and their rationale: the empty-string-include narrowing site, resolving script paths before the Ghidra directory reservation, the exact-segment (not substring, not dot-prefix) parent-directory check, and the two-commit reconstruction used to keep this plan's commits aligned with the phase's established one-commit-per-task pattern.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<action>` text was followed directly; no Rule 1-3 auto-fixes were needed and no Rule 4 architectural question arose.

## Issues Encountered

None. `test:automated`'s pre-existing 2-failure baseline (`anno-register.test.ts`, unrelated to this plan's files) was measured before and after this plan's changes and is unchanged (3239 tests / 3231 pass / 2 fail / 1 skipped / 5 todo), well within the documented 5-in-3 floor.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `SEAM-02` stays `Pending` in `REQUIREMENTS.md` — it is shared with plan `34-08` (`oracle.probe`'s `command` argv-passthrough, CR-01), and the shared-ID gate correctly reports `0/1 requirement(s) ready to mark complete` until `34-08` also finishes. This plan's own two closed findings (`CR-02`, `CR-03`) and the `must_haves.truths` this plan owns (adjacency, empty, ordering) are all proven by the coverage cases above.
- `34-08` and `34-09` (the remaining gap-closure plans in this round) can proceed independently — neither depends on anything this plan changed beyond the already-stable `host-tool.mts`/`ghidra-project.mts` seam.
- No blockers.

## Self-Check: PASSED

- FOUND: src/mcp/vice/host-tool.mts
- FOUND: src/mcp/vice/host-tool.test.ts
- FOUND: src/mcp/vice/ghidra-project.mts
- FOUND: src/mcp/vice/ghidra-project.test.ts
- FOUND: src/mcp/vice/resources/host-tool.mjs
- FOUND: src/mcp/vice/resources/ghidra-project.mjs
- FOUND: src/skills/acme-build/SKILL.md
- FOUND commit: 0515b95
- FOUND commit: d98fb22
- `node --test host-tool.test.ts ghidra-project.test.ts`: 76/76 pass (44 + 32)
- `node --test resources-sync.test.ts`: 2/2 pass
- `npm run typecheck`: clean
- `node scripts/check-skill-cli-invocations.mjs`: OK
- `node scripts/check-no-skill-external-spawn.mjs`: OK
- `npm run test:automated`: 3239 tests, 3231 pass, 2 fail (pre-existing, `anno-register.test.ts`, unrelated) — unchanged from measured baseline

---
*Phase: 34-the-host-tool-execution-seam*
*Completed: 2026-09-03*
