---
phase: 36-the-sleigh-language-and-the-ghidra-harness
fixed_at: 2026-09-04T21:10:50Z
review_path: .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/36-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 36: Code Review Fix Report

**Fixed at:** 2026-09-04T21:10:50Z
**Source review:** .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/36-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 Critical, 3 Warning, 3 Info -- `fix_scope: all`)
- Fixed: 7
- Skipped: 0

**Isolation:** Every edit, build, and commit below ran inside a dedicated git worktree
(`.claude/worktrees/rf-36-2081423-1788555316`, branch `gsd-reviewfix/36-2081423`), per
`workflow.use_worktrees: true`. The worktree's `node_modules` was a symlink to the main
checkout's `src/mcp/vice/node_modules` (no separate install) so `npm run typecheck` and
`node --test` could run without a fresh `npm ci`. The branch was fast-forwarded onto `main`
and the worktree removed as part of this agent's cleanup tail; see the orchestrator's own
record for the final commit range now on `main`.

**Verification note (per-fix, during fixing):** `cd src/mcp/vice && npm run typecheck` and
targeted `node --test <file>.test.ts` runs (never the bare full-glob `npm test`, which hangs
on `vice-proxy.test.ts`) ran **inside the isolated worktree** after every single fix, before
that fix's commit. `npm run typecheck` was clean (zero errors) after every one of the 7
commits. Targeted suites run and their pass counts: `host-tool.test.ts` (90/90, run after
WR-03, WR-01, WR-02, and again after IN-01/IN-03), `ghidra-project.test.ts` (44/44, run after
IN-01/IN-03), `sleigh-compile-gate.test.ts` (94 pass / 5 skipped -- GHIDRA_HOME unset,
expected), `ghidra-harness-gates.test.ts` (10/10, unaffected by CR-01 since it exercises
`classifyGhidraRunLog()` directly, not `runGhidraAnalyze()`).

**CR-01 was additionally live-verified against a real Ghidra 12.1.3 installation**
(`GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`, which already had
`6502:LE:16:nmos` installed under three of its own extension directories) -- run directly
per the environment notes' instruction, since this fix changes behaviour
`ghidra-live.test.ts`'s GATE 1 case asserts:
`GHIDRA_HOME=... VICE_LIVE_GHIDRA=1 node --test --test-name-pattern="GATE 1" ghidra-live.test.ts`
passed both cases (2/2): the "wrong `expectedClassificationLines`" case now genuinely rejects
via `assert.rejects(...)` against the real thrown-script run, and the paired "omitted" case
still succeeds normally. This is a real, non-simulated confirmation that the production fix
works end-to-end against actual Ghidra, not just a type/syntax check.

**Full-suite confirmation ran in the MAIN checkout after the fast-forward merge and after the
worktree/temp-branch/sentinel cleanup tail completed** (not the worktree itself, whose
repo-root sits under `.claude/worktrees/...` and trips both `repo-root.test.ts`'s own "not
under .claude" assertion and, while the worktree still existed on disk,
`ci-suite-coverage.test.ts`'s directory walk finding uncovered nested suites under it; its
`vendor/dxa/dxa` binary is also a local, gitignored build artifact absent from a fresh
worktree checkout -- all worktree-environment artifacts unrelated to these fixes, confirmed
by re-running `npm run test:automated` in the main checkout immediately after `git worktree
remove`). Actual result: `cd src/mcp/vice && npm run test:automated` -> **3409 tests, 3396
pass, 2 fail, 6 skipped** -- the 2 failures are exactly the pre-existing, out-of-scope
`anno-register.test.ts` pair named in the environment notes ("DIRECTION 5 (basis integrity)"
and "planted violation (the negative control)"), i.e. the documented permanent floor, with
no residual failures. Both `AUDIT-01` ("every REVIEW.md finding id anywhere in
.planning/phases/ has a recorded disposition") and its cascading `D-12-02` gate ("no milestone
audit declares a gated status while any docs guard is red") are confirmed green in this same
run, now that this report supplies a disposition for every `36-REVIEW.md` finding id.
`npm run typecheck` was also re-run clean (zero errors) in the main checkout post-merge.

## Fixed Issues

### CR-01: `runGhidraAnalyze()` never checks `scriptThrew`, so a run whose script threw is reported as success

**Files modified:** `src/mcp/vice/ghidra-run.ts`, `src/mcp/vice/ghidra-live.test.ts`
**Commit:** f8ed2bab
**Applied fix:** Added a `verdict.scriptThrew` check in `runGhidraAnalyze()`, thrown before the
existing language checks, exactly as the review's suggested fix specified. Updated
`ghidra-live.test.ts`'s GATE 1 case per the review's own instruction: it now asserts the
throw directly via `assert.rejects(..., /scriptThrew|a script threw during this run/i)`
instead of calling `runGhidraAnalyze()` with no `assert.rejects`/try-catch and manually
re-parsing the run log a second time to observe `scriptThrew` itself. Since a thrown call
yields no `GhidraRunResult` to read `runLogPath` off of, the run-log path for the test's
remaining file-content assertions is reconstructed deterministically from
`runId`/`GHIDRA_RUNS_DIR_NAME` (imported from `ghidra-project.mts`) rather than dropped. Live
-verified (2/2) against a real Ghidra 12.1.3 installation with `6502:LE:16:nmos` already
installed -- both the throwing case (now rejects) and the paired non-throwing case (still
resolves) pass for real, not merely type-checked.

### WR-01: A foreseeable `ghidra.analyze` failure permanently burns the run directory with no cleanup

**Files modified:** `src/mcp/vice/host-tool.mts`, `src/mcp/vice/resources/host-tool.mjs`
**Commit:** 35da0425
**Applied fix:** Took the review's option (b): `runHostTool()` now records
`resolveGhidraProject()`'s reserved `projectLocation` in a `ghidraReservedProjectLocation`
local, and the single shared `if (!built.ok)` check after all tool branches (which every tool,
not just `ghidra.analyze`, passes through) now does a best-effort
`rmSync(ghidraReservedProjectLocation, { recursive: true, force: true })` before returning the
refusal, whenever that local is set. A caller who retries the same `runId` after fixing
`GHIDRA_HOME`/installing the extension now gets a fresh reservation instead of
`resolveGhidraProject()`'s unrelated "refuses to reuse an existing run directory" refusal.
Rebuilt `resources/host-tool.mjs` via `node build.ts`. `host-tool.test.ts` (90/90) and
`ghidra-project.test.ts` (44/44) pass unchanged.

### WR-02: `ghidra.installExtension`'s `sourceDir` may be any workspace-relative directory, copied wholesale into the shared Ghidra installation

**Files modified:** `src/mcp/vice/host-tool.mts`, `src/mcp/vice/resources/host-tool.mjs`
**Commit:** 3962df2a
**Applied fix:** Took the review's second suggested option: after `resolveWorkspacePath()`
resolves `sourceDir`, a new check compares the resolved path against
`resolveWorkspacePath(repoRootAbs, join("src","mcp","vice","vendor","ghidra-ext"))` (the
project's own vendored extension tree) and refuses by name -- naming both the caller-supplied
value and what it resolved to -- unless they match exactly. This mirrors the
"checked, non-materialising preflight" discipline `ghidra.analyze`'s own language check
already applies: a refusal only, never a materialising fix. Verified this does not collide
with `host-tool.test.ts`'s existing census test (`HOST_TOOL_PATH_ARG_KEYS: every declared path
key refuses an escaping value and an absolute value...`), which always overrides the
`sourceDir` key itself with an escaping/absolute value before this new check would ever run
-- confirmed by re-running the full `host-tool.test.ts` (90/90) and `sleigh-compile-gate.test.ts`
(94 pass / 5 skipped) after the change.

### WR-03: `digestOutputFile()`'s `byteLength` comes from a separate `statSync`, not the buffer that was actually hashed

**Files modified:** `src/mcp/vice/host-tool.mts`, `src/mcp/vice/resources/host-tool.mjs`
**Commit:** 650c24dd
**Applied fix:** Applied exactly the review's suggested fix: `byteLength: contents.length`
instead of a separate `statSync(path).size`, so the reported length always describes the same
byte string `sha256` was computed over. Removed the now-unused `statSync` import. Confirmed
this does not break `host-tool.test.ts`'s two byteLength assertions that compare against
`statSync(...).size` directly (no concurrent writer in those tests, so `contents.length` and
`stat.size` agree) -- 90/90 pass.

### IN-01: Unused import `dirname` in `ghidra-project.mts`

**Files modified:** `src/mcp/vice/ghidra-project.mts`, `src/mcp/vice/resources/ghidra-project.mjs`
**Commit:** 8d3f328b
**Applied fix:** Removed `dirname` from the `node:path` import in `ghidra-project.mts` (grep
-confirmed it was referenced nowhere else in the file) and rebuilt
`resources/ghidra-project.mjs` via `node build.ts`, exactly as the review's fix specified.
`ghidra-project.test.ts` (44/44) and `host-tool.test.ts` (90/90) pass unchanged.

### IN-02: Unused import `ghidra.program.model.data.DataType` in `GhidraStructExport.java`

**Files modified:** `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java`
**Commit:** eade1fd7
**Applied fix:** Removed the unused `import ghidra.program.model.data.DataType;` line
(grep-confirmed no other reference in the file). No Java syntax checker is available in this
verification table, but this file is exactly the `postScript` exercised by CR-01's live GATE 1
run (see above) -- that live run, performed after this edit, had Ghidra itself compile and
execute this exact modified file successfully (both the throwing and non-throwing cases), which
is a stronger real-world verification than a standalone `javac` syntax check would have been.

### IN-03: Dead export `GHIDRA_EXTENSION_MODULE_NAME` -- defined, never consumed anywhere

**Files modified:** `src/mcp/vice/ghidra-project.mts`, `src/mcp/vice/resources/ghidra-project.mjs`
**Commit:** deaaf230
**Applied fix:** Took the review's second suggested option (remove, rather than wire in a new
consumer): confirmed via repo-wide grep that neither `ghidra-live.test.ts` nor
`ghidra-opcode-live.test.ts` (the two live suites that could plausibly call
`ghidra.installExtension`) actually calls it at all -- both are documented as read-only toward
the Ghidra installation -- so there was no existing call site to wire the constant into
without inventing a new one, which would have exceeded this fix's scope. Removed the export
and its doc comment from `ghidra-project.mts`, rebuilt `resources/ghidra-project.mjs`.
`ghidra-project.test.ts` (44/44) and `host-tool.test.ts` (90/90) pass unchanged.

## Skipped Issues

None -- all 7 in-scope findings (CR-01, WR-01, WR-02, WR-03, IN-01, IN-02, IN-03) were fixed.

---

_Fixed: 2026-09-04T21:10:50Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
