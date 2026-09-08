---
phase: 40-the-three-preprocessing-host-tools
plan: 01
subsystem: paths
tags: [gitignore, path-consolidation, never-throw, host-tool, ghidra, mcp]

requires:
  - phase: 34-38
    provides: repo-root.ts's supervisorDir(), install-resources.ts's installTargetDir(), incident-record.ts's incidentsDir(), stock-paths.ts's snapshotPathFor()/snapshotMetaPathFor(), ghidra-project.mts's resolveGhidraProject(), host-tool.mts's runOracleRun()/CLI entry point -- all writers this plan re-points or hardens.
provides:
  - "repo-root.ts's toolsDir() -- the one owning definition of the tool-written root"
  - "Six writers re-pointed under .c64-re-tools/ (supervisor, snapshots, bin, runs/oracle, incidents, cache); a seventh (ghidra-runs) deliberately exempted with a documented reason"
  - "WR-03's two never-throw holes closed with committed regression tests"
  - "A single-stanza .gitignore and a directory-relation two-way parity gate"
affects: [40-02, 40-03, 40-04, 40-05, 40-06, 40-07]

actuals:
  tokens: 25429
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "toolsDir() as the one owning root definition; host-bound modules that cannot import it join the two segments directly with a comment naming the owning definition"
    - "TEST-ONLY env-gated hook (HOST_TOOL_TEST_FORCE_CLI_REJECT), read from the broker process's own environment never wire input, for regression-testing a never-throw boundary's outer catch when the inner implementation has no organically reachable throw"

key-files:
  created:
    - .planning/phases/40-the-three-preprocessing-host-tools/deferred-items.md
  modified:
    - src/mcp/vice/repo-root.ts
    - src/mcp/vice/stock-paths.ts
    - src/mcp/vice/incident-record.ts
    - src/mcp/vice/install-resources.ts
    - src/mcp/vice/ghidra-project.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/resources/*.mjs (all ten, regenerated)
    - scripts/ensure-mcp-deps.sh
    - .gitignore
    - CLAUDE.md
    - .planning/PROJECT.md
    - src/mcp/vice/repo-root.test.ts
    - src/mcp/vice/containerpath.test.ts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/vice-proxy.test.ts
    - src/mcp/vice/host-scripts.test.ts
    - src/mcp/vice/install-resources.test.ts
    - src/mcp/vice/incident-record.test.ts
    - src/mcp/vice/stock-paths.test.ts
    - src/mcp/vice/stock-machine.test.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/docs-linerefs.test.ts
    - src/mcp/vice/build.ts
    - .planning/todos/pending/2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools.md

key-decisions:
  - "ghidra-project.mts's runs root is EXEMPTED from the .c64-re-tools/ consolidation -- Ghidra's own dot-segment refusal rejects every ancestor path segment starting with \".\", so nesting a project there would make every ghidra.analyze call fail. Verified directly (hasDotPrefixedSegment on a synthetic .c64-re-tools/runs/ghidra/<runId> path) and against ghidra-project.test.ts's own pinned tools/ghidra-runs literal."
  - "The tools/ghidra-runs/ .gitignore entries are KEPT, not deleted -- the plan's own instruction to delete them assumed ghidra-runs moved into .c64-re-tools/; since it did not (the exemption above), the ignore rule is still load-bearing, just no longer needing its old leading-slash workaround."
  - "host-scripts.test.ts's two-way parity gate rewritten from a per-file relation (name-for-name against twelve /tools/* lines) to a directory relation (every resourceEntries() name resolves under installTargetDir()'s prefix; the ignore file names that directory exactly once) -- the plan's own documented fallback for when a per-file relation becomes unexpressible."
  - "WR-03 hole 2's CLI-level regression test uses a documented, env-gated test-only hook (HOST_TOOL_TEST_FORCE_CLI_REJECT=1) rather than an organic wire-input trigger -- every fs call reachable from runHostTool()'s real business logic is already guarded by design (proven by exhaustive code reading), so there is no real input left that rejects it; the hook proves the CLI's own .catch() plumbing end-to-end via the real compiled artifact without weakening runHostTool()'s own contract."

patterns-established:
  - "toolsDir() single-root pattern for any future writer this codebase adds"

requirements-completed: []  # PREP-04 shared with sibling plan 40-04 (not yet executed) -- shared-ID gate keeps it open until both finish (confirmed via requirements.ready-ids: 0/1 ready)

coverage:
  - id: D1
    description: "One toolsDir() in repo-root.ts; four pure-TypeScript writers (supervisorDir, stock-paths.ts's snapshot paths, incident-record.ts's incidentsDir, install-resources.ts's installTargetDir) derive from it"
    requirement: PREP-04
    verification:
      - kind: unit
        ref: "repo-root.test.ts, containerpath.test.ts, incident-record.test.ts, install-resources.test.ts, stock-paths.test.ts (70 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three host-bound writers (vice-broker.mts's state dir, install-resources.ts's deployed launcher path consumed by vice-proxy.ts, host-tool.mts's oracle scratch root) re-pointed under .c64-re-tools/; resources/*.mjs regenerated byte-identical"
    requirement: PREP-04
    verification:
      - kind: unit
        ref: "resources-sync.test.ts, host-tool.test.ts, host-scripts.test.ts (98 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-03 hole 1 (mkdirSync inside try, resolves ok:false) and hole 2 (CLI .catch(), resolves { ok:false, message } with non-zero exit) both closed with committed regression tests"
    requirement: PREP-04
    verification:
      - kind: unit
        ref: "host-tool.test.ts#runHostTool: oracle.run resolves { ok: false } rather than throwing when the scratch directory cannot be created (WR-03 hole 1, D-26)"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#CLI entry point: HOST_TOOL_TEST_FORCE_CLI_REJECT=1 forces runHostTool() to reject, and the standalone host-tool.mjs still prints a parseable { ok: false, message } JSON line to stdout with a non-zero exit code -- never an unhandled rejection with no output"
        status: pass
    human_judgment: false
  - id: D4
    description: ".gitignore collapsed to one /.c64-re-tools/ stanza (plus the still-necessary tools/ghidra-runs/ entries); CLAUDE.md documents the root and its four overrides plus the Ghidra exception"
    requirement: PREP-04
    verification:
      - kind: unit
        ref: "host-scripts.test.ts's two-way parity gate (directory relation)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Architectural decision: ghidra-project.mts's runs root stays outside .c64-re-tools/ -- a hard Ghidra-tool constraint, not a design preference"
    requirement: PREP-04
    verification: []
    human_judgment: true
    rationale: "This is a deviation from the plan's own must_haves.truths (\"every tool-written file lands under one repo-root directory\") and from the phase's declared artifact list (runs/ghidra/ under .c64-re-tools/). The technical necessity is verified directly (hasDotPrefixedSegment() reports the exact refusal), but whether the resulting two-location split is acceptable long-term, or whether a future non-dot-prefixed alias should reunify it, is a decision for the project owner -- recorded as an addendum on the folded consolidation todo."

duration: 44min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 01: The .c64-re-tools/ Consolidation and WR-03's Two Never-Throw Holes Summary

**Six scattered tool-written locations collapse into one `.c64-re-tools/` root (a seventh, Ghidra's per-run projects, is exempted for a hard technical reason discovered mid-execution); WR-03's two never-throw holes in `host-tool.mts` close with committed regression tests.**

## Performance

- **Duration:** 44 min
- **Started:** ~2026-09-08T08:07:00Z
- **Completed:** 2026-09-08T08:50:11Z
- **Tasks:** 3
- **Files modified:** 36 (across 3 commits)

## Accomplishments

- `repo-root.ts` gained `toolsDir()`, the single owning definition of `.c64-re-tools/`; `supervisorDir()`, `stock-paths.ts`'s snapshot paths, `incident-record.ts`'s `incidentsDir()`, and `install-resources.ts`'s `installTargetDir()` all derive from it (or its documented two-segment convention for host-bound modules that cannot import it).
- `vice-broker.mts`'s default state directory, `vice-proxy.ts`'s `brokerHostPath()` (via `installTargetDir()`'s new value), and `host-tool.mts`'s oracle scratch root all moved under the same root; `resources/*.mjs` regenerated byte-identical to a fresh build.
- WR-03 hole 1 closed: `runOracleRun()`'s `mkdirSync()` moved inside its own `try`, resolving `{ ok: false, reason }` on a scratch-directory failure instead of throwing out of `runHostTool()`'s never-throw boundary. Regression-tested via a read-only scratch parent.
- WR-03 hole 2 closed: the standalone `host-tool.mjs` CLI's `.then()` gained a `.catch()` mirroring `host-tool-client.ts`'s own shape. Regression-tested end-to-end via a documented, env-gated test-only hook (every organic rejection path was found to already be guarded by design).
- `.gitignore` collapsed from five per-writer stanzas plus twelve per-file deploy entries to one `/.c64-re-tools/` stanza; `host-scripts.test.ts`'s two-way parity gate reworked into a directory-level relation; `CLAUDE.md` documents the new root, its four env-var overrides, and the Ghidra exception.
- **Discovered and resolved mid-execution:** `ghidra-project.mts`'s runs root cannot move under `.c64-re-tools/` -- Ghidra's own dot-segment refusal rejects any ancestor path segment starting with `.`, which `.c64-re-tools` itself is. Verified directly, documented as the one exception to the phase's "one root" truth, and recorded on the folded consolidation todo for owner review.

## Task Commits

1. **Task 1: One owning `toolsDir()`, and the four pure-TypeScript writers derive from it** - `f739b4ff` (feat)
2. **Task 2: The three host-bound writers, the shell stamp, and WR-03's two never-throw holes** - `7a8ec1e0` (feat)
3. **Task 3: Collapse the ignore rules, move the deployed-artifact parity prefix, and document the new root** - `aaa03144` (docs)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP)

## Files Created/Modified

- `src/mcp/vice/repo-root.ts` - new `toolsDir()`; `supervisorDir()` re-pointed
- `src/mcp/vice/stock-paths.ts` - snapshot paths re-pointed
- `src/mcp/vice/incident-record.ts` - `incidentsDir()` re-pointed, header rewritten
- `src/mcp/vice/install-resources.ts` - `installTargetDir()` re-pointed, header/pruneResources doc updated
- `src/mcp/vice/ghidra-project.mts` - `GHIDRA_RUNS_DIR_NAME` doc comment records the deliberate exemption
- `src/mcp/vice/vice-broker.mts` - default state directory re-pointed
- `src/mcp/vice/vice-proxy.ts` - `brokerHostPath()` re-pointed; comment fix; `rewriteArguments()` line-citation drift repaired in CLAUDE.md/PROJECT.md
- `src/mcp/vice/host-tool.mts` - oracle scratch root re-pointed; WR-03 hole 1 (try/catch) and hole 2 (`.catch()` + test hook) closed
- `src/mcp/vice/resources/*.mjs` (10 files) - regenerated via `node build.ts`
- `scripts/ensure-mcp-deps.sh` - stamp fallback re-pointed under `.c64-re-tools/cache/`, `CLAUDE_PLUGIN_DATA` still wins
- `.gitignore` - collapsed to one stanza; `tools/ghidra-runs/` entries kept and simplified
- `CLAUDE.md`, `.planning/PROJECT.md` - Configuration section + `rewriteArguments()` line citations
- Ten test files - pinned literals updated to the new locations (see key-files above); `host-scripts.test.ts`'s parity gate rewritten; two new regression tests added to `host-tool.test.ts`
- `.planning/phases/40-the-three-preprocessing-host-tools/deferred-items.md` - new, logs 3 pre-existing out-of-scope failures
- `.planning/todos/pending/2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools.md` - addendum recording the Ghidra exemption

## Decisions Made

See `key-decisions` in the frontmatter. Most consequential: **Ghidra's per-run project directories stay outside `.c64-re-tools/`** -- a hard external-tool constraint (Ghidra's own dot-segment refusal), not a design choice, discovered by direct verification (`hasDotPrefixedSegment()` on a synthetic path) before any code was written that would have broken `ghidra.analyze` permanently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, discovered mid-execution] `ghidra-project.mts`'s runs root cannot move under `.c64-re-tools/`**
- **Found during:** Task 2, before editing `ghidra-project.mts`
- **Issue:** The plan instructed re-pointing `GHIDRA_RUNS_DIR_NAME` under `.c64-re-tools/runs/ghidra`. `ghidra-project.mts`'s own `hasDotPrefixedSegment()` refuses ANY ancestor path segment starting with `.` (proven against real Ghidra 12.1.3, `evidence/34-ghidra-dotpath.md`). `.c64-re-tools` is itself dot-prefixed, so the move would make `resolveGhidraProject()` refuse every call, unconditionally -- verified directly and against `ghidra-project.test.ts`'s own pinned `join(dir, "tools", GHIDRA_RUNS_DIR_NAME)` expectation.
- **Fix:** Left `GHIDRA_RUNS_DIR_NAME`'s join at `<repoRoot>/tools/ghidra-runs/` unchanged; documented the exemption in the constant's own doc comment, in CLAUDE.md's Configuration section, and as an addendum on the folded consolidation todo. `.gitignore`'s `tools/ghidra-runs/` entries kept (not deleted, contra the plan's literal instruction, which assumed the move happened).
- **Files modified:** `src/mcp/vice/ghidra-project.mts`, `.gitignore`, `CLAUDE.md`, `.planning/todos/pending/2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools.md`
- **Verification:** `ghidra-project.test.ts`, `host-tool.test.ts`, `host-scripts.test.ts` all green with the exemption in place; `grep -av '^#' .gitignore | grep -ac ghidra-runs` now reports 2 rather than the plan's expected 0 (see "Acceptance Criteria Not Met" below).
- **Committed in:** `7a8ec1e0` (ghidra-project.mts doc comment), `aaa03144` (.gitignore/CLAUDE.md)

**2. [Rule 1 - Bug] Pinned-literal test breakage in files NOT listed in the plan's `files_modified`**
- **Found during:** Tasks 1-3, via a repo-wide grep sweep for `.vice-supervisor`/`.vice-snapshots` after each writer moved
- **Issue:** `stock-paths.ts`'s move broke `stock-machine.test.ts` and `stock-dispatch.test.ts` (both in the automated set); `repo-root.ts`'s move broke `repo-root.test.ts`, `containerpath.test.ts`, `install-resources.test.ts`'s inline fixture; `incident-record.ts`'s move broke `incident-record.test.ts`; `stock-paths.ts`'s snapshot functions broke `stock-paths.test.ts`. None of these nine files were in the plan's `files_modified` list.
- **Fix:** Updated every pinned literal to the new location, same pattern as the plan's own explicit instruction for the files it did list.
- **Files modified:** `repo-root.test.ts`, `containerpath.test.ts`, `incident-record.test.ts`, `install-resources.test.ts`, `stock-paths.test.ts`, `stock-machine.test.ts`, `stock-dispatch.test.ts`, `vice-proxy.test.ts` (this one WAS in the plan's Task 3 list), `host-tool.test.ts`'s dot-prefixed-literal case
- **Verification:** All ten touched test files green (334 tests via the combined `node --test` run)
- **Committed in:** `f739b4ff`, `7a8ec1e0`, `aaa03144`

**3. [Rule 1 - Bug] `CLAUDE.md`/`PROJECT.md`'s `rewriteArguments()` line citations drifted**
- **Found during:** Task 2, via `npm run test:automated`
- **Issue:** Adding `brokerHostPath()`'s doc comment (+6 net lines) shifted `forwardToVice()` from `vice-proxy.ts:2985` to `:2991` and its `rewriteArguments()` call site from `:3050` to `:3056`, reddening `docs-linerefs.test.ts` and, transitively, `audit-integrity.test.ts`.
- **Fix:** Updated both documents' citations and `docs-linerefs.test.ts`'s own planted-violation fixture (which separately pinned the old `2985` literal).
- **Files modified:** `CLAUDE.md`, `.planning/PROJECT.md`, `src/mcp/vice/docs-linerefs.test.ts`
- **Verification:** `docs-linerefs.test.ts` 13/13 pass; `audit-integrity.test.ts`'s red guard resolved on the next full run.
- **Committed in:** `7a8ec1e0`

**4. [Rule 2 - Missing critical] `host-scripts.test.ts`'s parity gate needed a real rewrite, not a literal update**
- **Found during:** Task 3
- **Issue:** The plan's own text anticipated this ("If the collapse to a single directory stanza makes the per-file relation unexpressible, replace it with a relation over the deployed directory"). The old test filtered `.gitignore` lines by the `/tools/` prefix and compared name-for-name against `resourceEntries()`; a single `/.c64-re-tools/` stanza has no per-file lines to compare.
- **Fix:** Rewrote both directions as directory-level relations (see key-decisions).
- **Files modified:** `src/mcp/vice/host-scripts.test.ts`
- **Verification:** 4/4 tests pass.
- **Committed in:** `aaa03144`

**5. [Rule 1 - Bug] Typecheck regression in the new WR-03 hole 1 test**
- **Found during:** Task 3 (`npm run typecheck` after unrelated edits)
- **Issue:** `HostToolResponse`'s `oracle.run` member types `ok` as `boolean`, not a literal; narrowing on `!response.ok && response.tool === "oracle.run"` fails to compile because `.tool` doesn't exist on the generic `{ ok: false; message }` member.
- **Fix:** Narrowed via `"tool" in response && response.tool === "oracle.run"` instead.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`
- **Verification:** `npm run typecheck` exits 0; the specific test still passes at runtime.
- **Committed in:** `aaa03144`

---

**Total deviations:** 5 auto-fixed (1 architectural discovery + 4 bug/gap fixes). **Impact:** the architectural discovery (Ghidra exemption) is the only one that changes the plan's declared scope -- documented prominently rather than silently absorbed. The other four are corrective, necessary for a green test suite, and directly caused by this plan's own writer moves.

### Acceptance Criteria Not Met

**Task 3's verify command** `grep -av '^#' .gitignore | grep -ac 'ghidra-runs'` **expects 0, actually reports 2.** This criterion assumed Ghidra's runs root moved under `.c64-re-tools/` (per the plan's original design); since deviation #1 above keeps it at `tools/ghidra-runs/`, the two ignore entries for that path remain load-bearing and were deliberately kept, not removed. The two OTHER Task 3 acceptance criteria involving `.gitignore` (`grep -c '/.c64-re-tools/' .gitignore` == 1, and the two-way parity gate) both pass.

## Issues Encountered

- `npm run test:automated` reports 3 pre-existing failures in `anno-register.test.ts`/`anno-import.test.ts` (undeclared requirement ids), confirmed unrelated to this plan via `git log`/`grep` and logged to `deferred-items.md`. Not fixed (out of scope).
- `vice-proxy.test.ts` (MANUAL_ONLY_TESTS, excluded from `test:automated`) showed one flaky failure (`no broker lease is held`) when run as part of the full ~400s file, but passed cleanly when re-run in isolation with `--test-name-pattern` -- consistent with this suite's documented full-file race characteristics, not a regression from this plan's path changes (the failure's own error text correctly named the new `.c64-re-tools/bin/vice-launcher.sh` path, confirming the consolidation itself works end-to-end).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `40-02` (the tracer plan) and all later plans in this phase build on the consolidated root; `toolsDir()` is ready for any new writer.
- The Ghidra exemption is a standing fact later plans (and the phase's own "Artifacts this phase produces" list, which still names `runs/ghidra/` under `.c64-re-tools/`) should account for -- flagged here and on the folded todo for whoever next touches that section.
- No blockers for `40-02`.

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: src/mcp/vice/repo-root.ts
- FOUND: src/mcp/vice/host-tool.mts
- FOUND: src/mcp/vice/ghidra-project.mts
- FOUND: .gitignore
- FOUND: CLAUDE.md
- FOUND: .planning/phases/40-the-three-preprocessing-host-tools/deferred-items.md
- FOUND commit: f739b4ff
- FOUND commit: 7a8ec1e0
- FOUND commit: aaa03144
- Acceptance criteria re-verified: typecheck exits 0; `node --test repo-root.test.ts containerpath.test.ts incident-record.test.ts install-resources.test.ts host-tool.test.ts host-scripts.test.ts resources-sync.test.ts stock-paths.test.ts docs-linerefs.test.ts stock-machine.test.ts stock-dispatch.test.ts` reports 334/334 pass; `git status --porcelain resources/` empty after a fresh `node build.ts`; `grep -c '/.c64-re-tools/' .gitignore` == 1.
- One acceptance criterion NOT met, documented above as a deviation: `grep -av '^#' .gitignore | grep -ac 'ghidra-runs'` reports 2, not 0 (Ghidra exemption).
