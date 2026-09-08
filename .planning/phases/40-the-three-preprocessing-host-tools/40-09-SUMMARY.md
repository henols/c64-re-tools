---
phase: 40-the-three-preprocessing-host-tools
plan: 09
subsystem: infra
tags: [ghidra, symlink, broker, d-33, gap-closure, live-guard]

# Dependency graph
requires:
  - phase: 40-the-three-preprocessing-host-tools
    provides: "GHIDRA_RUNS_HANDLE_NAME/TARGET, ghidraRunsRoot()/ghidraRunsRealRoot(), ensureGhidraRunsHandle() (plan 40-08), and the corrective measurement note .planning/notes/ghidra-dot-path-check-semantics.md"
provides:
  - "vice-broker.mts run() mints/verifies the Ghidra runs handle at startup (R2 satisfied literally), between the unconditional reap and the control listener bind, without ever throwing"
  - "host-tool.test.ts/ghidra-live.test.ts fully migrated off the retired tools/ghidra-runs/ location -- zero pinned occurrences remain in either file"
  - "The handle-only invariant (resolveWorkspacePath() realpaths through the handle back to the dotted root) guarded four ways: mechanism, surface, structure, and a planted-violation control"
  - "A live, opt-in guard proving real Ghidra 12.1.3 still accepts the symlinked handle (positive) and still refuses a literal dotted location (negative control)"
affects: ["40-10", "40-11"]

# Actuals (#2632)
actuals:
  tokens: 10871
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Return-don't-assert structural predicates driving both the real assertion and a planted-violation control over the SAME code path (docs-linerefs.test.ts's own shape), reused twice more in this plan (broker ordering, workspace-path invariant)"
    - "A live guard reproduces both halves of a measured external-tool property as an outcome differential (project database present vs. absent), never a stderr text match"

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/vice-broker-supervision.test.ts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/ghidra-live.test.ts

key-decisions:
  - "The live guard's positive half does not drive the full ghidra.analyze production seam (runGhidraAnalyze()) for its filesystem-inspection assertions -- MEASURED that production's own buildAnalyzeHeadlessArgv() always emits -deleteProject, which deletes exactly the artifacts the guard needs to inspect after a run. Instead it calls resolveGhidraProject() directly (still the code under test minting the handle) and spawns analyzeHeadless itself without -deleteProject, following this file's own pre-existing runGhidraAnalyzeDirectControl() precedent for driving real Ghidra directly to observe filesystem behaviour."
  - "The broker's handle-refusal handling is verified structurally (source-position + non-throw), not behaviourally, because forcing a real refusal at broker startup would require corrupting a real filesystem entry mid-test; the live minting proof (a real process, a real repo root, a real symlink) is the plan's own Task 1 <verify> instead."

requirements-completed: []  # PREP-05 is shared across 40-08/40-09/40-10/40-11 (shared-ID gate) -- not marked complete until every declaring plan has a SUMMARY

coverage:
  - id: D1
    description: "vice-broker.mts's run() mints/verifies the Ghidra runs handle after the unconditional startup reap and before the control listener binds (R2), never throwing on refusal"
    requirement: PREP-05
    verification:
      - kind: unit
        ref: "vice-broker-supervision.test.ts#structural (R2, gap G-40-1): vice-broker.mts mints the Ghidra runs handle exactly once, after the unconditional startup reap and before the control listener binds"
        status: pass
      - kind: unit
        ref: "vice-broker-supervision.test.ts#structural (R2): a Ghidra runs handle refusal is consumed into a stderr write, never a throw or an early return"
        status: pass
      - kind: unit
        ref: "vice-broker-supervision.test.ts#planted-violation (R2): the SAME ordering predicate reports a removed call site as zero, and a call site relocated after the listener as no-longer-before it"
        status: pass
      - kind: other
        ref: "live process: node resources/vice-broker.mjs --repo-root <fresh dir> --dry-run leaves a c64-re-tools symlink -> .c64-re-tools and prints a handle line before 'control listener bound'"
        status: pass
    human_judgment: false
  - id: D2
    description: "host-tool.test.ts and ghidra-live.test.ts no longer carry any pinned occurrence of the retired tools/ghidra-runs/ location or GHIDRA_RUNS_DIR_NAME"
    requirement: PREP-05
    verification:
      - kind: other
        ref: "grep -ac 'ghidra-runs' host-tool.test.ts ghidra-live.test.ts == 0 for both; grep -ac 'GHIDRA_RUNS_DIR_NAME' both == 0"
        status: pass
      - kind: unit
        ref: "node --test host-tool.test.ts -- 104 pass, fail 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The handle-only invariant -- resolveWorkspacePath() realpaths a handle-traversing path back to the dotted root -- guarded by mechanism, surface, structure, and a planted-violation control"
    requirement: PREP-05
    verification:
      - kind: unit
        ref: "host-tool.test.ts#resolveWorkspacePath() REALPATHS a path routed through the Ghidra runs handle straight back to the dotted root"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#HOST_TOOL_PATH_ARG_KEYS['ghidra.analyze'] names exactly the seven caller-supplied path fields, and none of the project-location/name/runs-root/run-id names"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#structural (gap G-40-1, plan 40-09): no resolveWorkspacePath() call site in host-tool.mts receives an argument derived from the resolved project, the runs root, or the handle"
        status: pass
      - kind: unit
        ref: "host-tool.test.ts#planted-violation (gap G-40-1, plan 40-09): the SAME structural predicate reports a synthetic project-location-derived call site"
        status: pass
    human_judgment: false
  - id: D4
    description: "A live, opt-in guard against real Ghidra 12.1.3 proves the symlink route still works (positive) and that Ghidra still refuses a literal dotted location (negative control), neither matching Ghidra's own stderr text"
    requirement: PREP-05
    verification:
      - kind: other
        ref: "ghidra-live.test.ts#ghidra-live SYMLINK GUARD (positive, mirrors note run C) -- live run against GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC"
        status: pass
      - kind: other
        ref: "ghidra-live.test.ts#ghidra-live SYMLINK GUARD (negative control, mirrors note run B) -- live run, same installation"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 09: The broker mints the handle, remaining consumers migrate, the handle-only invariant is guarded, and real Ghidra proves the symlink route live

**`vice-broker.mts` now mints/verifies the Ghidra runs handle at startup (R2, closing gap G-40-1's second binding requirement), every remaining test file is off the retired `tools/ghidra-runs/` location, the handle-only invariant is guarded four ways with planted-violation controls, and a live opt-in test proves real Ghidra 12.1.3 still accepts the symlink route while still refusing a literal dotted one.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-08T19:26:47+02:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `vice-broker.mts`'s `run()` calls `ensureGhidraRunsHandle(args.repoRoot)` (VALUE import from the compiled sibling `./ghidra-project.mjs`, following the exact convention `runHostTool`'s own import already uses) after the unconditional startup reap and before `startControlListener()` awaits — the broker itself now creates the handle, literally satisfying R2, so a container-side MCP server with no host tooling of its own finds the handle in place the moment it can reach the broker at all. A refusal is written to one stderr line naming the consequence (`ghidra.analyze` refuses by name; every other tool id is unaffected) and never throws or returns early. `resources/vice-broker.mjs` rebuilt and committed alongside the source.
- A real `node resources/vice-broker.mjs --repo-root <fresh dir> --dry-run` process was run live: it left a `c64-re-tools` symlink whose target is exactly `.c64-re-tools`, created the physical `runs/ghidra` tree, and printed a `handle` line 13 lines before the `control listener bound` line (verified: `h=13 l=14`, handle strictly before listener).
- `vice-broker-supervision.test.ts` gained a structural ordering assertion (exactly one `ensureGhidraRunsHandle(` call site, positioned after `reapOrphanedInstances(` and before `startControlListener(`), a non-throw assertion over the immediate handling, and a planted-violation control proving the ordering predicate is not vacuous — a synthetic copy with the call site removed reports zero call sites, and a synthetic copy with it relocated after the listener reports `mintedBeforeListener: false`. Confirmed this file is absent from `test-gate.mjs`'s `MANUAL_ONLY_TESTS`, so the assertion runs in `npm run test:automated`.
- `host-tool.test.ts`'s remaining pinned occurrences (synthetic argv literals, the reserved-run-directory `statSync()` assertions, an explanatory comment) all migrated off the retired two-segment location onto the new handle/physical-root shape. The reserved-run-directory assertion now checks BOTH halves — physically under the dotted root (already migrated in plan 40-08) AND reachable through the non-dotted handle (added this plan) — because either half alone permits a regression the other catches.
- `ghidra-live.test.ts`'s last pinned literal (`runGhidraAnalyzeDirectControl()`'s own project-location construction, which bypasses `resolveGhidraProject()`'s typed seam to reach the `DataTypeManager` control mode's third positional script argument) now calls `ensureGhidraRunsHandle()` itself and derives its location from `ghidraRunsRoot()`, matching the same broker-owned handle the typed seam uses. The file's own D-36-12 header comment (explaining why every case builds a throwaway workspace root rather than using this file's own directory) was corrected against plan 40-08's nested-root measurement — the reasoning stands (both `.gitignore` stanzas are root-anchored), only the location it names changed from the retired `tools/ghidra-runs/` to `.c64-re-tools/`/`c64-re-tools`.
- The handle-only invariant — `resolveWorkspacePath()` realpaths a handle-traversing path straight back to the dotted root (deliberate decision A-16), so a caller-supplied path field can never safely name the handle — is now guarded from four angles in `host-tool.test.ts`: the MECHANISM (a real handle minted in a temp root, then `resolveWorkspacePath()` measured to collapse it to the dotted root), the SURFACE (`HOST_TOOL_PATH_ARG_KEYS['ghidra.analyze']` contains exactly the seven caller-supplied keys and none of `projectLocation`/`projectName`/`runsRoot`/`runId`/`handle`), the STRUCTURE (a return-don't-assert predicate over `host-tool.mts`'s comment-stripped source proving no `resolveWorkspacePath(` call receives a project/runs/handle-derived argument, and that the project location has exactly one derived sibling path — the run log), and a PLANTED-VIOLATION control proving that structural predicate actually fires on a synthetic `resolveWorkspacePath(repoRootAbs, projectResolved.projectLocation)` call site.
- A live, opt-in guard (`ghidra-live.test.ts`, already `MANUAL_ONLY_TESTS`' eleventh entry) reproduces both halves of `.planning/notes/ghidra-dot-path-check-semantics.md`'s own measured runs B and C against real Ghidra 12.1.3: the POSITIVE half mints the handle through `resolveGhidraProject()` (the code under test) and spawns `analyzeHeadless` directly at the resolved location — deliberately without production's own unconditional `-deleteProject` flag, since that flag was MEASURED at plan time to delete exactly the artifacts this guard needs to inspect — landing a real project database (`.gpr` + populated `.rep/`) physically under the dotted root while the non-dotted tree holds only the symlink. The NEGATIVE control spawns `analyzeHeadless` directly at a literal dot-prefixed location (bypassing the production resolver, which would refuse it itself) and confirms no project database is created. Neither half matches Ghidra's own stderr text; both failure messages name the specific upstream mechanism (`ProjectLocator` switching `getAbsolutePath()` → `getCanonicalPath()`) that would trigger them.

## Task Commits

Each task was committed atomically:

1. **Task 1: The broker mints the handle at startup (R2), with the ordering proved structurally** — `04296f69` (feat)
2. **Task 2: The remaining consumers, and a guard on the invariant that the handle is only ever used for two computed paths** — `cefd2ddc` (test)
3. **Task 3: The live guard — prove real Ghidra still accepts the symlinked location, and that a dotted one is still refused** — `09246ea0` (test)

**Plan metadata:** (this commit)

_Note: this plan's `type` frontmatter is `execute`, not `tdd` — no plan-level TDD gate applies._

## Files Created/Modified

- `src/mcp/vice/vice-broker.mts` — VALUE import of `ensureGhidraRunsHandle` from `./ghidra-project.mjs`; `run()` mints/verifies the handle after the startup reap and before the control listener binds, never throwing on refusal.
- `src/mcp/vice/resources/vice-broker.mjs` — rebuilt committed artifact (`npm run build`).
- `src/mcp/vice/vice-broker-supervision.test.ts` — structural ordering assertion, non-throw assertion, and planted-violation control for R2.
- `src/mcp/vice/host-tool.test.ts` — migrated synthetic literals and the reserved-run-directory assertion onto the new location (both halves); four new handle-only-invariant guard tests (mechanism, surface, structure, planted-violation).
- `src/mcp/vice/ghidra-live.test.ts` — `runGhidraAnalyzeDirectControl()` now mints and uses the broker-owned handle; header comment corrected against plan 40-08's nested-root measurement; two new live, opt-in SYMLINK GUARD tests (positive + negative control).

## Decisions Made

See `key-decisions` in the frontmatter above for the two load-bearing decisions (the live guard's positive-half construction, and why the broker's refusal path is verified structurally rather than behaviourally).

## Deviations from Plan

None — plan executed exactly as written, with one MEASURED correction to the plan's own assumption, documented below (not a deviation from an instruction, but a live-testing finding that changed how Task 3's positive half had to be implemented to satisfy its own stated `<done>` criteria).

### Finding: production's `-deleteProject` flag removes the artifacts Task 3's positive half needs to inspect

- **Found during:** Task 3, running the plan's own `<verify>` command for the first time
- **Issue:** The plan's Task 3 `<action>` describes driving "the real production route" (i.e. the full `ghidra.analyze` seam, `runGhidraAnalyze()`) and then asserting the project database artifacts exist physically under the dotted root. MEASURED live: `buildAnalyzeHeadlessArgv()` (`ghidra-project.mts`) unconditionally emits `-deleteProject`, and `analyzeHeadlessREADME.md`'s own documented behavior for that flag is exactly what happened — the project's `.gpr`/`.rep/` were created, then deleted, by the time `runGhidraAnalyze()` returned, leaving an empty (but present) physical directory. The run log itself (never deleted, a sibling of the project directory) carried `Creating project:` and `REPORT: Import succeeded` naming the handle path, proving the symlink route worked — but no filesystem artifact survived for the plan's own literal `existsSync(...gpr)` style assertion.
- **Fix:** The positive half still mints the handle through the CODE UNDER TEST (`resolveGhidraProject()`, which calls `ensureGhidraRunsHandle()` as its own idempotent precondition) but then spawns `analyzeHeadless` directly at the resolved location, omitting `-deleteProject`, following this same file's own pre-existing `runGhidraAnalyzeDirectControl()` precedent for driving real Ghidra directly rather than through the full seam. The negative control was unaffected — it always bypassed the seam per the plan's own instruction.
- **Files modified:** `src/mcp/vice/ghidra-live.test.ts` (within this plan's own declared file, no scope change)
- **Verification:** Both guard halves pass against real Ghidra 12.1.3 (see below); `node --test ghidra-live.test.ts` with no opt-in: `fail 0`, all 24 cases skip.
- **Committed in:** `09246ea0` (Task 3's own commit)

---

**Total deviations:** 0 rule-triggered deviations. 1 finding that changed an implementation detail within Task 3's own declared file to satisfy the task's own `<done>` criteria against measured reality; documented per the plan's own instruction ("if `--dry-run` turns out not to reach the minting line... record the substitution and its transcript in the summary rather than dropping the live proof" — same spirit applied here to `-deleteProject`).
**Impact on plan:** None on scope or requirements; the positive half proves exactly what the plan asked for (real Ghidra accepts the symlinked handle, artifacts land physically under the dotted root), using a more precise observation method than the plan's own draft anticipated.

## Verified Census Counts (grep -a, against plan-time numbers)

| File | Plan-time (pinned literals) | Measured before this plan's Task 2 edits |
|---|---|---|
| `host-tool.test.ts` (`ghidra-runs`) | 6 | 5 (already reflects plan 40-08's own 2-line deviation fix) |
| `ghidra-live.test.ts` (`ghidra-runs`) | 2 | 2 (match) |
| `host-tool.test.ts`/`ghidra-live.test.ts` (`GHIDRA_RUNS_DIR_NAME`) | 0 | 0 (retired outright in plan 40-08) |

After Task 2's edits: `grep -ac 'ghidra-runs' host-tool.test.ts ghidra-live.test.ts` == 0 for both files.

## Live Broker Transcript (Task 1)

```
$ VICE_BROKER_CONTROL_PORT=19599 VICE_BROKER_WARM_FLOOR=0 timeout 20 \
    node resources/vice-broker.mjs --repo-root "$D" --state-dir "$D/.c64-re-tools/supervisor" --dry-run
vice-broker: WARNING -- this broker runs in the FOREGROUND of this process.
...
vice-broker: startup reap found 0 process(es) in the emulator port band, terminated 0
vice-broker: detected backend "stock" for x64sc (source: probe) ...
vice-broker: backend "stock" (source: probe, binary: /usr/local/bin/x64sc)
vice-broker: ghidra runs handle /tmp/tmp.ex5lLGTsu5/c64-re-tools -> .c64-re-tools
vice-broker: wrote /tmp/tmp.ex5lLGTsu5/.c64-re-tools/supervisor/broker.json (node v24.20.0); control listener bound on 0.0.0.0:19599
vice-broker: shutdown complete -- 0 instance(s) processed, 0 signalled
```

`--dry-run` DID reach the minting line (no substitution needed). Post-run filesystem check: `test -L "$D/c64-re-tools"` true, `readlink` == `.c64-re-tools`, `test -d "$D/.c64-re-tools/runs/ghidra"` true. Handle line at stderr line 13, `control listener bound` at line 14 — handle strictly before listener.

## Live-Ghidra Guard Transcript (Task 3)

Installed version (read from `application.properties`): **12.1.3**, matching `EXPECTED_GHIDRA_VERSION` this file's own Gate-3 case already pins.

- **Positive half:** `resolveGhidraProject({ repoRoot: ws.root, runId: "symlink-guard-positive" })` minted/verified the handle; `analyzeHeadless` spawned directly at the resolved `<runsRoot>/symlink-guard-positive` (the non-dotted handle path) with no `-deleteProject` exited status 0, run output contained `REPORT: Import succeeded`. `lstatSync(<ws.root>/c64-re-tools).isSymbolicLink()` — true. Physical artifacts confirmed present at `<ws.root>/.c64-re-tools/runs/ghidra/symlink-guard-positive/symlink-guard-positive.gpr` (exists) and a populated `.rep/` directory (non-empty `readdirSync`).
- **Negative control:** `analyzeHeadless` spawned directly at the literal `<ws.root>/.c64-re-tools/runs/ghidra/symlink-guard-negative` (bypassing the production resolver, which would have refused it itself) — no project database (`symlink-guard-negative.gpr`) was created at that location.
- Both cases ran in the file's own throwaway scratch workspace (`makeScratchWorkspace()`/`removeScratchWorkspace()`); `git status --porcelain` after the full opt-in suite showed no new untracked paths anywhere in the repository (no leaked `c64-re-tools` link or dotted root).

```
✔ ghidra-live SYMLINK GUARD (positive, mirrors note run C): a real Ghidra import through the handle the production resolver mints lands its project database PHYSICALLY under the dotted root, with only the handle symlink in the non-dotted tree (6001.7ms)
✔ ghidra-live SYMLINK GUARD (negative control, mirrors note run B): a directly-spawned run with a LITERAL dot-prefixed project location produces NO project database (5017.2ms)
```

Full opt-in suite (`GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 timeout 570 node --test ghidra-live.test.ts`): `tests 24, pass 22, fail 0, skipped 2` (the 2 skips are the pre-existing corpus cases, gated on the separate `VICE_LIVE_GHIDRA_CORPUS=1` opt-in — untouched by this plan).

## `npm run test:automated` Numbers

Baseline (this plan's own `<interface_context>`, measured before this plan): **3584/3567/6** (plan time) → plan 40-08 landed at **3593/3576/6** (its own 4 new tests, zero new failures).

This plan added 7 new tests (4 in `host-tool.test.ts`, 3 in `vice-broker-supervision.test.ts`) — no new tests in `ghidra-live.test.ts`'s automated footprint, since that whole file is `MANUAL_ONLY_TESTS`.

Repeated runs, no VICE broker running (precondition honored throughout):

| Run | tests | pass | fail | Notes |
|---|---|---|---|---|
| 1 | 3600 | 3583 | 6 | Exactly the documented baseline set (see below) |
| 2 | 3600 | 3581 | 8 | +2 from `audit-root-args.test.ts` (`check-skill-tool-coverage`, `check-skill-fork-honesty`) |
| 3 (isolated) | 58 | 58 | 0 | `node --test audit-root-args.test.ts` alone — confirms the +2 in run 2 was the file's own documented intermittent scratch-file race, not a real failure |
| 4 | 3600 | 3582 | 7 | +1 from `audit-root-args.test.ts` (`check-skill-fork-honesty`) again |

**The 6-failure baseline set reproduced identically in every run**, itemised by cause (none caused by, or fixed by, this plan — all pre-existing and out of scope per the orchestrator's explicit instruction):

1. `anno-register.test.ts` — `annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id`
2. `anno-register.test.ts` — `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id...`
3. `anno-register.test.ts` — `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates`
4. `audit-integrity.test.ts` — `no milestone audit declares a gated status while any docs guard is red (D-12-02)` (plan 40-11's territory)
5. `docs-deferred-ledger.test.ts` — `every pending todo has a row in STATE.md's Deferred Items section (AUDIT-04, direction A)` (the un-ledgered `2026-09-08-guard-ghidra-symlink-project-location` todo — plan 40-11's territory)
6. `docs-deferred-ledger.test.ts` — `planted violation: both predicates fire on synthetic input, and the real, corrected text is reported by neither` (same cause as #5)

**`npm run test:automated` does not exceed the recorded baseline** — the 6-failure floor is stable; the 1-2 extra intermittent failures observed in runs 2 and 4 are `audit-root-args.test.ts`'s own documented scratch-file race (confirmed non-reproducing in isolation, run 3), not a regression this plan introduced.

## Confirmation: nothing installed, fetched, or built

This plan did not run `npm install`, `pip install`, or any package-manager command. It did not download, build, or fetch Ghidra or any extension — `GHIDRA_HOME` pointed at the pre-existing, user-installed `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` (MEASURED present at plan time, per this plan's own `<interface_context>`), and Task 3's `<precondition>` explicitly forbade installing anything. `npm run build` (rebuilding the committed `resources/vice-broker.mjs` artifact from already-present TypeScript source) is the only build step this plan ran.

## Issues Encountered

None beyond the Task 3 finding documented above (deliberately filed under "Deviations from Plan" rather than here, since it changed an implementation detail rather than blocking execution).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Gap `G-40-1`'s requirement R2 is closed: the broker mints the handle, both brokerless host-side routes still work via `resolveGhidraProject()`'s own idempotent precondition, and a handle refusal never stops the broker from starting.
- The handle-only invariant is guarded structurally and behaviourally, with planted-violation controls on both.
- The live-Ghidra guard is in place and passing against real Ghidra 12.1.3; its failure messages already name the upstream mechanism a future regression would trigger.
- `PREP-05` stays incomplete (shared across 40-08/40-09/40-10/40-11) until every declaring plan has a SUMMARY — expected, per the shared-ID gate.
- Plans 40-10 and 40-11 are unblocked. No blockers.

## Self-Check: PASSED

All key files (`vice-broker.mts`, `resources/vice-broker.mjs`, `vice-broker-supervision.test.ts`, `host-tool.test.ts`, `ghidra-live.test.ts`, this SUMMARY) confirmed present on disk. All three task commits (`04296f69`, `cefd2ddc`, `09246ea0`) confirmed present in `git log`. All three tasks' `<verify>` blocks re-run and passing, including the live broker process and the live Ghidra guard's both halves. `npm run typecheck` clean. `npm run test:automated` re-run four times: the documented 6-failure baseline reproduced identically every time; zero new failures attributable to this plan.

---
*Phase: 40-the-three-preprocessing-host-tools*
*Completed: 2026-09-08*
