---
phase: 40-the-three-preprocessing-host-tools
plan: 08
subsystem: infra
tags: [ghidra, gitignore, d-33, symlink, host-tool, gap-closure]

# Dependency graph
requires:
  - phase: 40-the-three-preprocessing-host-tools
    provides: "ghidra-project.mts's resolveGhidraProject()/buildAnalyzeHeadlessArgv() (plan 34-03), and the corrective measurement note .planning/notes/ghidra-dot-path-check-semantics.md"
provides:
  - "GHIDRA_RUNS_HANDLE_NAME, GHIDRA_RUNS_HANDLE_TARGET, ghidraRunsRoot(), ghidraRunsRealRoot(), ensureGhidraRunsHandle() -- the full new export surface plans 40-09/40-10 can cite without re-reading the module"
  - "resolveGhidraProject() re-pointed onto the handle, with the handle precondition running before the reuse check and before the reservation mkdirSync"
  - "A single .gitignore stanza for the root (/.c64-re-tools/) and its non-dotted alias (/c64-re-tools, no trailing slash)"
affects: ["40-09", "40-10", "40-11"]

# Actuals (#2632)
actuals:
  tokens: 17765
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Broker-mintable, never-repairing symlink handle (detect-then-refuse-by-name) to satisfy an external tool's absolutized-path check while physical data stays under the single tool-written root"

key-files:
  created: []
  modified:
    - src/mcp/vice/ghidra-project.mts
    - src/mcp/vice/resources/ghidra-project.mjs
    - src/mcp/vice/ghidra-project.test.ts
    - src/mcp/vice/ghidra-live.test.ts
    - src/mcp/vice/host-tool.test.ts
    - .gitignore

key-decisions:
  - "GHIDRA_RUNS_DIR_NAME retired outright, no deprecated alias -- the plan explicitly required this so no surviving comment could re-cite it"
  - "ensureGhidraRunsHandle() creates the physical runs tree BEFORE checking the handle (plan-mandated order), so a handle refusal still leaves an empty <repoRoot>/.c64-re-tools/runs/ghidra/ scaffold on disk -- the regression test therefore asserts no RUN-ID subdirectory appears under either the handle or the physical root, not that the physical root itself stays absent"
  - "Deviation (Rule 3): fixed ghidra-live.test.ts and host-tool.test.ts, neither in this plan's files_modified, because retiring GHIDRA_RUNS_DIR_NAME broke npm run typecheck (ghidra-live.test.ts is typechecked even though it is MANUAL_ONLY at runtime) and would have regressed the automated-suite baseline (host-tool.test.ts's two statSync() assertions on the old literal path)"

requirements-completed: []  # PREP-05 is shared across 40-08/40-09/40-10/40-11 (shared-ID gate) -- not marked complete until every declaring plan has a SUMMARY

coverage:
  - id: D1
    description: "resolveGhidraProject() reaches the run directory through a broker-mintable, non-dotted symlink handle while the bytes land physically under <repoRoot>/.c64-re-tools/runs/ghidra/<runId> (D-33 restored for ghidra.analyze)"
    requirement: PREP-05
    verification:
      - kind: unit
        ref: "ghidra-project.test.ts#resolveGhidraProject: an ok result lands the run directory PHYSICALLY under ghidraRunsRealRoot()"
        status: pass
      - kind: unit
        ref: "ghidra-project.test.ts#resolveGhidraProject: accepts a clean repoRoot and a well-shaped runId, returning ok:true with runsRoot/projectLocation/projectName derived from ghidraRunsRoot()"
        status: pass
      - kind: other
        ref: "tracer node script from this plan's Task 1 <verify>, run live against real filesystem calls (no Ghidra installed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ensureGhidraRunsHandle() verifies the handle is a symbolic link with exactly the relative target, and refuses BY NAME -- never repairing -- when a real directory, a wrong-target symlink (including an absolute target), or a plain file sits at the handle path"
    requirement: PREP-05
    verification:
      - kind: unit
        ref: "ghidra-project.test.ts#ensureGhidraRunsHandle: refuses when a REAL DIRECTORY already sits at the handle path"
        status: pass
      - kind: unit
        ref: "ghidra-project.test.ts#ensureGhidraRunsHandle: refuses when a symlink at the handle path points somewhere else"
        status: pass
      - kind: unit
        ref: "ghidra-project.test.ts#ensureGhidraRunsHandle: refuses when a plain FILE sits at the handle path"
        status: pass
    human_judgment: false
  - id: D3
    description: "resolveGhidraProject() propagates an ensureGhidraRunsHandle() refusal before the reuse check and before the reservation mkdirSync -- the silent-violation hole (T-40-08-02) stays closed"
    requirement: PREP-05
    verification:
      - kind: unit
        ref: "ghidra-project.test.ts#resolveGhidraProject: propagates an ensureGhidraRunsHandle() refusal without creating anything"
        status: pass
    human_judgment: false
  - id: D4
    description: ".gitignore carries one stanza for the root and its non-dotted alias; a synthetic populated repo reports a clean git status; the nested Phase 36 duplicate is proven dead by measurement, not assumed"
    requirement: PREP-05
    verification:
      - kind: integration
        ref: "synthetic-repo git status --porcelain check (this plan's Task 3 <verify>)"
        status: pass
      - kind: unit
        ref: "host-scripts.test.ts (all 4 cases)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-08
status: complete
---

# Phase 40 Plan 08: Ghidra runs root under the one root Summary

**Re-pointed `resolveGhidraProject()` onto a broker-mintable, never-repairing symlink handle (`<repoRoot>/c64-re-tools` -> `.c64-re-tools`) so Ghidra's per-run project data lands physically under the single tool-written root while still satisfying Ghidra's own absolutized-path dot-segment refusal.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-08T17:02:30Z
- **Tasks:** 3
- **Files modified:** 6 (4 declared in the plan + 2 deviation fixes)

## Accomplishments

- `ghidra-project.mts` gained `GHIDRA_RUNS_HANDLE_NAME`/`GHIDRA_RUNS_HANDLE_TARGET`, `ghidraRunsRoot()`, `ghidraRunsRealRoot()`, and `ensureGhidraRunsHandle()` — a single new export surface any consumer (plan 40-09, plan 40-10, the broker) can cite instead of re-deriving the location.
- `resolveGhidraProject()` no longer hardcodes `<repoRoot>/tools/ghidra-runs/`. It computes the runs root from `ghidraRunsRoot()`, runs the existing dot-segment refusal first (unchanged order, still catches a dot-prefixed `repoRoot`), then `ensureGhidraRunsHandle()` as an idempotent precondition — a handle refusal propagates straight out, before the reuse check and before the reservation `mkdirSync`, closing the silent-violation hole where a missing handle would let recursive `mkdir` materialise a second, unverified root.
- `GHIDRA_RUNS_DIR_NAME` retired outright — deleted, not deprecated-aliased, per the plan's explicit instruction, and grep-verified absent from every non-comment line.
- The `GHIDRA_RUNS_*` doc comment rewritten against the measured source (`.planning/notes/ghidra-dot-path-check-semantics.md`): states the refusal binds the *absolutized* path (`getAbsolutePath()`, never `getCanonicalPath()`), names the three simultaneous conditions the handle design satisfies, and explicitly retracts the earlier "hard external-tool constraint" claim, naming the self-referential method that produced it.
- `resources/ghidra-project.mjs` rebuilt and committed alongside the source in the same commit; `resources-sync.test.ts` passes.
- `ghidra-project.test.ts` migrated fully off the retired constant and the old two-segment location: one deliberate anchor test pins both `ghidraRunsRoot()`/`ghidraRunsRealRoot()` literal shapes by hand; every other assertion derives from the exported functions. Seven new `ensureGhidraRunsHandle()` cases plus a dedicated regression test for the silent-violation hole bring the file from 49 to 53 passing tests, `fail 0`.
- `.gitignore`'s three scattered Ghidra stanzas collapsed into one: the unchanged root pattern (`/.c64-re-tools/`) plus a new non-trailing-slash alias line (`/c64-re-tools`) — MEASURED (not assumed) that a trailing slash would leave a symlink-to-directory showing as untracked noise. The false "tracked-tooling" justification for the old `/tools/ghidra-runs/` entry is deleted; the Phase 36 nested-repo-root stanza is proven dead (not merely assumed dead) by a full `npm run test:automated` run followed by `git status --porcelain`, which showed nothing new under `src/mcp/vice/`.

## Task Commits

Each task was committed atomically:

1. **Task 1: The handle, end to end** — `c306e366` (feat) — includes the plan-declared `ghidra-project.mts` + `resources/ghidra-project.mjs`, plus a Rule-3 deviation fix to `ghidra-live.test.ts` and `host-tool.test.ts` (see Deviations below).
2. **Task 2: The unit suite, migrated onto the one computed location** — `5c756a18` (test) — `ghidra-project.test.ts` only, per the plan's own scoping.
3. **Task 3: One ignore stanza for one root and its alias** — `6b0b76dc` (docs) — `.gitignore` only.

_Note: this plan's `type` frontmatter is `execute`, not `tdd` — Task 1 carries `tdd="true"` and `type="tracer"` per-task attributes (its own RED/GREEN cycle is embedded in the tracer's single production+test commit rather than split into separate `test(...)`/`feat(...)` commits), so no separate plan-level TDD gate applies here._

## Files Created/Modified

- `src/mcp/vice/ghidra-project.mts` — new export surface (`GHIDRA_RUNS_HANDLE_NAME`, `GHIDRA_RUNS_HANDLE_TARGET`, `ghidraRunsRoot()`, `ghidraRunsRealRoot()`, `ensureGhidraRunsHandle()`), `resolveGhidraProject()` re-pointed, `GHIDRA_RUNS_DIR_NAME` retired, doc comment corrected.
- `src/mcp/vice/resources/ghidra-project.mjs` — rebuilt committed artifact (`npm run build`).
- `src/mcp/vice/ghidra-project.test.ts` — migrated onto the new location, 4 new/strengthened cases plus 7 new `ensureGhidraRunsHandle()` cases and 1 anchor case (53 tests total, up from 49).
- `src/mcp/vice/ghidra-live.test.ts` — (deviation) import + 2 usages migrated off `GHIDRA_RUNS_DIR_NAME` onto `ghidraRunsRealRoot()`; this file is `MANUAL_ONLY` at runtime but still typechecked.
- `src/mcp/vice/host-tool.test.ts` — (deviation) 2 `statSync()` assertions in the automated suite migrated off the literal `tools/ghidra-runs` path onto `ghidraRunsRealRoot()`.
- `.gitignore` — three Ghidra-related stanzas collapsed into one (root + non-trailing-slash alias); Phase 36 nested duplicate removed after being proven dead by measurement.

## Decisions Made

- **Handle-creation order is plan-mandated, not my own choice**: `ensureGhidraRunsHandle()` creates the physical runs tree (step 2) *before* checking the handle (step 3), so even a refused call (e.g. a real directory sitting at the handle path) leaves an empty `.c64-re-tools/runs/ghidra/` scaffold on disk. I therefore scoped the "propagates without creating anything" regression test to assert no *run-id* subdirectory appears under either the handle or the physical root — matching threat T-40-08-02's actual concern (a directory tree materialising at an *unverified* location) — rather than asserting the physical scaffold itself stays absent, which the plan's own mandated order makes impossible.
- **Retired `GHIDRA_RUNS_DIR_NAME` outright**, per the plan's explicit instruction, rather than keeping a deprecated alias — this is what forced the two out-of-scope deviation fixes below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ghidra-live.test.ts` broke `npm run typecheck` after `GHIDRA_RUNS_DIR_NAME` retirement**
- **Found during:** Task 1, running the plan's own `<verify>` (`npm run typecheck`)
- **Issue:** `ghidra-live.test.ts` imports `GHIDRA_RUNS_DIR_NAME` and uses it to reconstruct a run-log path in two places. This file is in `MANUAL_ONLY_TESTS` (excluded from `npm run test:automated`) but `tsconfig.json`'s `include: ["**/*.ts", "**/*.mts"]` still typechecks it, so deleting the export it imported produced `TS2724`.
- **Fix:** Migrated the import and both usages onto `ghidraRunsRealRoot(ws.root)`, updated two prose comments that named the old constant.
- **Files modified:** `src/mcp/vice/ghidra-live.test.ts`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `c306e366` (part of Task 1's own commit — required for Task 1's own `<verify>` to pass)

**2. [Rule 1 - Bug] `host-tool.test.ts`'s literal-path assertions would have regressed the automated-suite baseline**
- **Found during:** Task 1, reasoning through what would break before running the full suite
- **Issue:** `host-tool.test.ts:2167-2168` (in the automated suite) asserted `statSync(join(dir, "tools", "ghidra-runs", runIdA)).isDirectory()` directly against the old hardcoded location. Once `resolveGhidraProject()` writes through the new handle instead, those two lines would fail — a genuine regression beyond the recorded 6-failure baseline.
- **Fix:** Imported `ghidraRunsRealRoot` from `./ghidra-project.mts` and rewrote both assertions to derive the expected location from it instead of a literal.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`
- **Verification:** Full `npm run test:automated` run: 3593 tests, fail 6 — matches the recorded baseline exactly, no new failures.
- **Committed in:** `c306e366` (part of Task 1's own commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 - blocking typecheck failure, 1 Rule 1 - bug/regression this task's own change would have caused). Both are outside this plan's declared `files_modified`, but both are direct, unavoidable consequences of retiring `GHIDRA_RUNS_DIR_NAME`, which the plan explicitly required.
**Impact on plan:** Necessary to keep `npm run typecheck` clean and the automated-suite failure count at its recorded baseline — both are the plan's own stated acceptance gates. No scope creep beyond what those gates required.

## Verified Census Counts (grep -a, against plan-time numbers)

| File | Plan-time | Measured (this run, pre-migration) |
|---|---|---|
| `ghidra-project.test.ts` | 50 | 50 (match) |
| `host-tool.test.ts` | 6 | 5 (already reflects this plan's 2-line deviation fix at measurement time; the 2 fixed lines dropped from "ghidra-runs" but the remainder — 5 opaque `buildAnalyzeHeadlessArgv`-style literals, out of scope — are untouched) |
| `ghidra-live.test.ts` | 2 | 2 (match) |
| `ghidra-project.mts` | 2 | 0 (already reflects this plan's own Task 1 edit at measurement time) |
| `resources/ghidra-project.mjs` | 3 | 0 (already reflects this plan's own Task 1 rebuild at measurement time) |
| `.gitignore` | 7 | 7 (match, pre-Task-3-edit) |

## `git status --porcelain` Nested-Root Measurement

Ran the full `npm run test:automated` suite (no VICE broker running, per precondition), then `git status --porcelain`. Result: **nothing new appeared under `src/mcp/vice/`** — the only changes were `.gitignore` (this plan's own edit), the pre-existing `.planning/STATE.md`/`state.json` (orchestrator-owned, untouched by this plan), and the four pre-existing old-layout trees (`.vice-snapshots/`, `.vice-supervisor/`, `tools/`, `src/mcp/vice/.anno-cli-test-*`) plus two untracked docs already present before this plan started. **The nested Phase 36 stanza is genuinely dead** — its removal in Task 3 is proven by this measurement, not assumed.

## `npm run test:automated` Numbers

**3593 tests / 3576 pass / 6 fail** — matches the recorded plan-time baseline (3584/3567/6) with a higher total because this plan's own Task 2 added 4 new tests. **Fail count unchanged at 6; zero new failures introduced.** Itemised by cause:

1. `anno-register.test.ts` — `annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id` (documented pre-existing floor, out of scope)
2. `anno-register.test.ts` — `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id...` (same floor)
3. `anno-register.test.ts` — `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates` (same floor)
4. `audit-integrity.test.ts` — `no milestone audit declares a gated status while any docs guard is red (D-12-02)` (pre-existing, plan 40-11's territory)
5. `docs-deferred-ledger.test.ts` — `every pending todo has a row in STATE.md's Deferred Items section (AUDIT-04, direction A)` (the un-ledgered `2026-09-08-guard-ghidra-symlink-project-location` todo — pre-existing, plan 40-11's territory)
6. `docs-deferred-ledger.test.ts` — `planted violation: both predicates fire on synthetic input, and the real, corrected text is reported by neither` (same cause as #5)

None of these are caused by this plan's changes. None were fixed by this plan (out of scope per the orchestrator's explicit instruction).

## New Export Surface (for plans 40-09/40-10 to cite without re-reading the module)

```ts
export const GHIDRA_RUNS_HANDLE_NAME = "c64-re-tools";
export const GHIDRA_RUNS_HANDLE_TARGET = ".c64-re-tools";
export function ghidraRunsRoot(repoRoot: string): string; // <repoRoot>/c64-re-tools/runs/ghidra -- the HANDLE path, what Ghidra is handed
export function ghidraRunsRealRoot(repoRoot: string): string; // <repoRoot>/.c64-re-tools/runs/ghidra -- the PHYSICAL path
export type EnsureGhidraRunsHandleResult = { ok: true; handle: string; target: string } | { ok: false; message: string };
export function ensureGhidraRunsHandle(repoRoot: unknown): EnsureGhidraRunsHandleResult; // idempotent, never repairs, never throws
```

`GHIDRA_RUNS_DIR_NAME` no longer exists (retired, not aliased).

## Issues Encountered

None beyond the two deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `resolveGhidraProject()` and the new handle-minting surface are ready for plan 40-09 to add the live guard against Ghidra switching from `getAbsolutePath()` to `getCanonicalPath()` (referenced in this file's own doc comment).
- `ensureGhidraRunsHandle()` is ready for the broker (plan 40-10, per the diagnosis's R2) to call at startup so the handle exists before any container-side `ghidra.analyze` call.
- `PREP-05` stays incomplete (shared across 40-08/40-09/40-10/40-11) until every declaring plan has a SUMMARY — expected, per the shared-ID gate.
- No blockers for 40-09/40-10/40-11.

## Self-Check: PASSED

All key files (`ghidra-project.mts`, `resources/ghidra-project.mjs`, `ghidra-project.test.ts`, `ghidra-live.test.ts`, `host-tool.test.ts`, `.gitignore`, this SUMMARY) confirmed present on disk. All three task commits (`c306e366`, `5c756a18`, `6b0b76dc`) confirmed present in `git log`. All three tasks' `<verify>` blocks re-run and passing. Full `npm run test:automated` re-run: 3593/3576/6, matching the recorded baseline with zero new failures.
