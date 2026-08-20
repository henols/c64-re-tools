---
phase: 11-annotation-store-enums-and-the-symbol-round-trip
plan: 05
subsystem: infra
tags: [mcp-tools, regenerator2000, allow-list, proxy-registration, tool-surface]

# Dependency graph
requires:
  - phase: 11-04
    provides: r2000-mcp-client.ts (withR2000Session/callR2000/saveAndVerify, six named error classes) -- the ONE MCP-client seam this plan's runner dispatches through
provides:
  - "r2000-tools.ts: R2000_TOOL_DEFINITIONS (17 curated ToolDefinitions), CURATED_R2000_TOOLS, assertCuratedTool() (with D-33 batch recursion), resolveStorePath() (T-11-PATH-ESCAPE), runR2000Tool() (the dispatcher)"
  - "The r2000_* family registered proxy-locally in vice-proxy.ts via buildViceTool(), backend-independent by construction -- never reaches forwardToVice()/rewriteArguments()/ensureViceSession()"
  - "check-skill-tool-coverage.mjs's second extraction pass for r2000_* names, gated against CURATED_R2000_TOOLS"
  - "Structural regression coverage in stock-dispatch.test.ts and vice-proxy.test.ts proving the family's registration seam and manifest absence"
affects: [11-06-enum-generator, 11-07, 11-08-memory-map-renderer, 11-09-skill-prose, 11-10, 11-11, 11-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allow-list gate inverted from vice.ts's DENY_LIST precedent: assertCuratedTool() checks set membership as its first statement, refuses r2000_get_address_details by name (D-32), and recurses into r2000_batch_execute's own calls[] to refuse a smuggled batch WHOLE (D-33)"
    - "Proxy-local, backend-independent tool registration via buildViceTool() directly (never buildBackendAwareTool()) for a tool family that touches no VICE transport at all -- the second instance of this pattern after vice_result_continue"
    - "Per-call session auto-save: every mutating r2000_* tool call saves internally (a plain save, not hash-verified) before its spawned session exits, because D-17's per-call lifecycle means an un-saved mutation is lost the instant the child exits; saveAndVerify()'s hash-verification is reserved for the one case the plan names explicitly -- the explicit r2000_save_project tool call"

key-files:
  created:
    - .claude/mcp/vice/r2000-tools.ts
    - .claude/mcp/vice/r2000-tools.test.ts
  modified:
    - .claude/mcp/vice/vice-proxy.ts
    - .claude/mcp/vice/vice-proxy.test.ts
    - .claude/mcp/vice/stock-dispatch.test.ts
    - .claude/mcp/vice/capability-registry.test.ts
    - .claude/mcp/vice/tool-support-table.test.mjs
    - .claude/mcp/vice/package.json
    - scripts/check-skill-tool-coverage.mjs
    - scripts/generate-tool-support-table.mjs
    - CLAUDE.md

key-decisions:
  - "D-18's exact 17-tool list implemented as planned, pinned by a hardcoded literal-name test in r2000-tools.test.ts so a name added to only one of CURATED_R2000_TOOLS/R2000_TOOL_DEFINITIONS fails loudly rather than silently agreeing (they are derived from the same array, so a second independent list is what actually catches drift)"
  - "Discovered during implementation, not anticipated by the plan: mutating r2000_* tools must save internally before their per-call session exits, or D-17's own lifecycle silently discards every write the instant the spawned child exits -- fixed by making every mutating tool (everything outside a small READ_ONLY_R2000_TOOLS set, and not r2000_save_project itself) call the plain underlying save before exit. The save is deliberately NOT saveAndVerify()'s hash-checked path: an idempotent edit (e.g. re-setting a label to the value it already has) legitimately produces an unchanged hash, and applying saveAndVerify() there would misreport that legitimate no-op as T-11-FALSESUCCESS. saveAndVerify() is reserved for the outer r2000_save_project tool exactly as the plan specifies."
  - "A live-measured consequence of the above and of regenerator2000 requiring its [FILE] argument to already exist (measured: --mcp-server-stdio against a nonexistent path exits 1, 'Error loading file'): a genuinely standalone top-level r2000_save_project call (nothing pending, since every other mutating call already auto-saved) will correctly report an unchanged-hash failure via saveAndVerify(). This is documented in the tool's own description ('rarely required standalone') and pinned by a dedicated live test assertion rather than treated as a bug."
  - "r2000-tools.ts's new r2000-loop registration in vice-proxy.ts uses a distinct loop variable (r2000Def, not def) specifically to avoid colliding with the pre-existing manifest loop's own `def` in stock-dispatch.test.ts's regex-based structural analysis (proxyToolRegistrations()) -- an identical name would have let the r2000 registration's own exemption silently widen to cover the manifest loop's entry too"

patterns-established:
  - "Allow-list-then-runner dispatch for a proxy-local, non-VICE tool family: validate (assertCuratedTool, resolveStorePath) as the literal first two statements, then dynamically import the heavy client seam"
  - "Three independent synthetic-tool-name discoverers (generate-tool-support-table.mjs, capability-registry.test.ts, tool-support-table.test.mjs) must all learn a new loop-registration shape the same structural way -- excluded by loop-variable pattern match, never resolved as a single named constant"

requirements-completed: [R2000-10, R2000-11]

# Metrics
duration: 50min
completed: 2026-08-21
---

# Phase 11 Plan 05: The Curated r2000_* Tool Surface Summary

**17 curated `r2000_*` MCP tools reachable from vice-proxy.ts, gated by an inverted-DENY_LIST allow-list with D-33 batch recursion, registered proxy-locally so the family never touches VICE, and verified against a real regenerator2000 0.9.20 child on the committed `probe-illegal.prg` fixture.**

## Performance

- **Duration:** ~50 min (estimated; PLAN_START_TIME was not captured at kickoff — timed from first read to final commit)
- **Started:** 2026-08-20T23:2x (approx.)
- **Completed:** 2026-08-21T00:13:29+02:00
- **Tasks:** 3
- **Files modified:** 12 (2 created, 10 modified)

## Accomplishments

- `r2000-tools.ts` created: 17 `R2000_TOOL_DEFINITIONS` with argument shapes obtained by driving `tools/list` against a real `regenerator2000 --mcp-server-stdio 0.9.20` child (never transcribed from a document); `CURATED_R2000_TOOLS` (17 names) and `assertCuratedTool()` (an allow-list mirroring `vice.ts`'s `DENY_LIST` precedent inverted, refusing `r2000_get_address_details` by name with the D-32 defect/issue citation, and recursing into `r2000_batch_execute`'s own `calls[]` to refuse a smuggled batch WHOLE per D-33); `resolveStorePath()` (T-11-PATH-ESCAPE, the same posture `stock-symbols.ts` takes for `.lbl` files); `runR2000Tool()` (the dispatcher, first statement `assertCuratedTool`, second `resolveStorePath`).
- The zero-spawn smuggling proof is counted, not reasoned: a batch mixing one curated and one uncurated inner name is refused with a spy binary recording invocations, and the spy is never invoked.
- `handler.rs:506-542`'s batch partial-failure semantics measured and recorded in the module header: `r2000_batch_execute` reports PER-CALL status (`{"status":"success"|"error", ...}` per entry) and never aborts early — orthogonal to D-33's own refusal, which happens entirely before any request reaches the child.
- The family registered proxy-locally in `vice-proxy.ts` via `buildViceTool()` in a loop (never `buildBackendAwareTool()`), backend-independent by construction: `fork-manifest-surface.test.ts`'s exact-62 gate and `stock-dispatch.test.ts`'s exact-38 dispatch-table gate both stay untouched, and two independent structural tests (one in `stock-dispatch.test.ts`, one in `check-skill-tool-coverage.mjs`) assert all 17 names are absent from both manifests.
- `check-skill-tool-coverage.mjs` taught a second, independent extraction pass for `r2000_*` names, gated against `CURATED_R2000_TOOLS`; demonstrated non-vacuously by planting `r2000_not_a_real_tool` in a skill file, confirming the script FAILS naming that string, then reverting (transcript below).
- Live-gated integration test (`VICE_REQUIRE_R2000`) proves criterion 2 against a real regenerator2000 child on the committed `probe-illegal.prg` fixture: a label written in one session is read back in a FRESH session; `r2000_get_cross_references` on `$D020` (the fixture's own `sta $D020`) returns a non-empty list; `r2000_search_disassembly` with an explicit `max_results: 50` finds 3 `lda` matches, asserted strictly less than the cap.

## Task Commits

Each task was committed atomically:

1. **Task 1: r2000-tools.ts — 17 definitions, the curated allow-list, and the D-33 batch gate** - `9234b54` (feat)
2. **Task 2: register the family proxy-locally, and update the structural assertion** - `4135738` (feat)
3. **Task 3: teach check-skill-tool-coverage.mjs about r2000_* names** - `58fd74c` (feat)
4. **Regression repair (discovered during Task 2's own verification, committed separately for traceability)** - `f854e30` (fix)

## Files Created/Modified

- `.claude/mcp/vice/r2000-tools.ts` - The curated surface: definitions, allow-list gate, path validation, runner
- `.claude/mcp/vice/r2000-tools.test.ts` - 21 tests: set-equality, batch-gate, spy-binary zero-spawn proof, path-escape refusals, live-gated criterion-2 integration
- `.claude/mcp/vice/vice-proxy.ts` - Static import + registration loop for the 17 curated tools, backend-independent by construction
- `.claude/mcp/vice/vice-proxy.test.ts` - Three `tools/list` assertions updated to account for the 17 always-present r2000_* tools
- `.claude/mcp/vice/stock-dispatch.test.ts` - Two-member backend-seam-bypass allow-list, a body-scan test for `runR2000Tool()`, a both-manifests-absence test
- `.claude/mcp/vice/capability-registry.test.ts` - Structural exclusion for the r2000 loop registration (Rule 1 fix, see Deviations)
- `.claude/mcp/vice/tool-support-table.test.mjs` - Same structural exclusion in its independent mirror (Rule 1 fix)
- `.claude/mcp/vice/package.json` - Added `r2000-tools.ts` to `files[]`
- `scripts/check-skill-tool-coverage.mjs` - Second extraction pass, three new assertions, r2000 count in the OK line
- `scripts/generate-tool-support-table.mjs` - `discoverSyntheticToolNames()` excludes the r2000 loop registration structurally (Rule 1 fix)
- `CLAUDE.md` - `rewriteArguments()` bullet's two line citations corrected after the registration shifted vice-proxy.ts's line numbers (Rule 1 fix)

## Decisions Made

- **The exact 17-tool list matches the plan's own objective table exactly** — no substitutions, no additions. Pinned by both a derived set-equality test and a hardcoded literal-name test in `r2000-tools.test.ts`.
- **Internal auto-save uses a plain save, never `saveAndVerify()`, for every mutating tool except the explicit `r2000_save_project` call.** See Deviations below — this was discovered as a genuine gap during implementation, not a stylistic choice.
- **`r2000Def` chosen as a deliberately distinct loop-variable name** in `vice-proxy.ts`'s registration loop, specifically to keep `stock-dispatch.test.ts`'s regex-based structural analysis from conflating the r2000 registration's exemption with the pre-existing manifest loop's own `def`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Mutating r2000_* tool calls did not persist across separate top-level calls**
- **Found during:** Task 1, writing the live-gated integration test
- **Issue:** `r2000-mcp-client.ts`'s per-call session lifecycle (D-17: spawn → load → mutate → exit) means a spawned child that exits without an explicit save discards every in-memory mutation. The plan's own runner design (dispatch a call, return its result) had no internal save step, so `r2000_set_label_name` followed by a *separate* `r2000_save_project` call in a later `runR2000Tool()` invocation could never work — the second call spawns a brand-new child that reloads the original, unmodified project file. This would have made criterion 1 ("write a label ... and read them back") structurally impossible across multiple tool calls, exactly the criterion this whole plan exists to satisfy.
- **Fix:** Every mutating tool (everything outside a small `READ_ONLY_R2000_TOOLS` set, and not `r2000_save_project` itself) now saves internally, inside the same spawned session, immediately after its own call and before the session exits.
- **Files modified:** `.claude/mcp/vice/r2000-tools.ts`
- **Verification:** The live-gated test's "a label written in one session is read back in a FRESH session" assertion is the direct proof; it failed with the original design (`expected entry_point to survive into a fresh session, got []`) and passes with the fix.
- **Committed in:** `9234b54` (Task 1 commit)

**2. [Rule 1 - Bug] The internal auto-save initially used hash-verified `saveAndVerify()`, producing a false failure on any redundant or idempotent save**
- **Found during:** Task 1, live-testing the fix above
- **Issue:** Using `saveAndVerify()` (which throws when the file's content hash is unchanged) for every internal auto-save meant that an immediately-following, genuinely redundant explicit `r2000_save_project` call (nothing new pending, since the prior mutation already auto-saved) always reported a false "not persisted" error — and, more subtly, would misreport any legitimately idempotent mutation (e.g. re-setting a label to the value it already has) the same way.
- **Fix:** Internal auto-saves after a mutating call now use a plain save (`call("r2000_save_project", {})`, no hash check). `saveAndVerify()` is reserved for the one case the plan names explicitly: the outer, directly-invoked `r2000_save_project` tool.
- **Files modified:** `.claude/mcp/vice/r2000-tools.ts`, `.claude/mcp/vice/r2000-tools.test.ts` (added a dedicated assertion documenting the resulting, intentional standalone-call behavior)
- **Verification:** Live-gated test passes end to end, including a new assertion that a genuinely standalone `r2000_save_project` call (nothing pending) correctly reports the documented unchanged-hash failure rather than silently succeeding.
- **Committed in:** `9234b54` (Task 1 commit)

**3. [Rule 3 - Blocking] `process.env.R2000_BIN = undefined` coerced to the literal string `"undefined"`, breaking the live test that ran immediately after the spy-binary smuggling test**
- **Found during:** Task 1, running `r2000-tools.test.ts` end to end
- **Issue:** The spy-binary test set `process.env.R2000_BIN` to a fake binary path, then attempted to restore the prior value with `process.env.R2000_BIN = prevBin` where `prevBin` was `undefined` — Node coerces this assignment to the string `"undefined"` rather than clearing the variable, so every subsequent test in the same file tried to spawn a binary literally named `undefined`.
- **Fix:** `if (prevBin === undefined) delete process.env.R2000_BIN; else process.env.R2000_BIN = prevBin;`
- **Files modified:** `.claude/mcp/vice/r2000-tools.test.ts`
- **Verification:** The live-gated test, which had failed with "regenerator2000 was not found on PATH", passes after the fix.
- **Committed in:** `9234b54` (Task 1 commit)

**4. [Rule 3 - Blocking] The r2000 registration loop in vice-proxy.ts shifted line numbers cited mechanically by CLAUDE.md and broke three independent synthetic-tool-name discoverers**
- **Found during:** Task 2's own verification (`npm run test:automated`)
- **Issue:** (a) `docs-linerefs.test.ts` mechanically checks CLAUDE.md's `rewriteArguments()` line citations against `vice-proxy.ts`'s real source; adding the r2000 import and registration loop shifted both call sites (`:2943`→`:2950`, `:1422`→`:1429`) and their enclosing functions' start lines, making the citations stale. (b) Three independent implementations of "discover the proxy-local synthetic tool names from vice-proxy.ts's source" (`generate-tool-support-table.mjs`'s `discoverSyntheticToolNames()`, its inline mirror in `capability-registry.test.ts`, and its deliberately-separate mirror in `tool-support-table.test.mjs`) all assumed every `tools[IDENT.name] = ...` registration site resolves to either the manifest loop's own loop variable or a single `const IDENT: ToolDefinition = {...}` declaration — the new r2000 registration is a loop over an array of 17 definitions, matching neither shape, so all three implementations threw `could not resolve "r2000Def" to a literal name`.
- **Fix:** (a) CLAUDE.md's citations updated to the current line numbers. (b) All three discoverers extended with a second loop-variable-recognition rule (mirroring the existing manifest-loop exclusion) that structurally excludes the r2000 registration rather than attempting to resolve it — correct because the r2000_* family is not a VICE capability at all (D-16/Rule A18) and must not be folded into the generated fork/stock support table.
- **Files modified:** `CLAUDE.md`, `scripts/generate-tool-support-table.mjs`, `.claude/mcp/vice/capability-registry.test.ts`, `.claude/mcp/vice/tool-support-table.test.mjs`
- **Verification:** Full `npm run test:automated` run: 1827 pass, 1 fail (a known pre-existing worktree-only failure, unrelated — see Issues Encountered). `docs-linerefs.test.ts`, `capability-registry.test.ts`, and `tool-support-table.test.mjs` all pass individually.
- **Committed in:** `f854e30` (separate commit, for traceability of a cross-cutting regression fix distinct from Task 2's own registration work)

---

**Total deviations:** 4 auto-fixed (1 missing critical functionality, 3 bugs/blocking issues)
**Impact on plan:** All four were necessary for correctness — without #1/#2, criterion 1 (the plan's central claim) would be false; without #3, the live test suite's own state would corrupt itself; without #4, this task's own change would have left the standing regression suite red. No scope creep: every fix stayed inside files this plan's own tasks already touch or files whose only change is a mechanical adjustment to a shape this plan introduced.

## Issues Encountered

- **Pre-existing, unrelated to this plan:** `repo-root.test.ts`'s "path agreement (D-3, D-6...)" test fails inside this worktree because the worktree's own checkout lives under `.claude/worktrees/<id>/`, and the test asserts the agreed supervisor directory is NOT under `.claude`. This is the documented worktree-only artifact noted in the orchestrator's own `prior_wave_context` and passes on the main tree. Not touched.
- `node_modules/` was not present in this worktree at session start (never committed, per `.gitignore` and the `SessionStart` hook that normally provisions it); ran `npm ci` manually inside `.claude/mcp/vice` before any typecheck/test command could run.

## User Setup Required

None — no external service configuration required. `regenerator2000 0.9.20` was already installed on this host (`~/.cargo/bin/regenerator2000`, confirmed via `--version`) from prior phase work; the live-gated tests in `r2000-tools.test.ts` ran against it directly.

## Non-Vacuity Transcript (Task 3, planted violation)

Planted `<!-- planted for non-vacuity demonstration: r2000_not_a_real_tool -->` at the end of `.claude/skills/c64-program-recon/SKILL.md`, ran the script, then reverted (confirmed `git diff` empty afterward):

```
check-skill-tool-coverage: FAIL
  - r2000_not_a_real_tool: referenced by .claude/skills/c64-program-recon/SKILL.md but NOT in CURATED_R2000_TOOLS (r2000-tools.ts). Resolve by: (1) implementing it and adding it to R2000_TOOL_DEFINITIONS with a named criterion, (2) removing the skill reference, or (3) recording it as a scope decision.
```

## Verification Evidence

- `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` → 21/21 pass (includes the live-gated criterion-2 integration against a real regenerator2000 0.9.20 child).
- `node --test stock-dispatch.test.ts fork-manifest-surface.test.ts` → 132/132 pass. `fork-manifest-surface.test.ts`'s exact-62 count and `stock-dispatch.test.ts`'s exact-38 `STOCK_DISPATCH_TABLE` count both **unchanged**, confirmed by the passing `"dispatch: the table's key count is exactly 38"` and `"fork-manifest-surface: ... exactly 62"` tests.
- `node --test vice-proxy.test.ts` → 115/119 pass, 4 skip (pre-existing skips, unrelated), 0 fail.
- `cd .claude/mcp/vice && npm run test:automated` → 1827 pass, 1 fail (pre-existing, worktree-only, see Issues Encountered), 5 todo. Identical result under `VICE_REQUIRE_R2000=1`.
- `npm run typecheck` → clean.
- `node scripts/check-npm-packages.mjs` → OK, transitive closure clean (66 files for `@henols/vice-mcp`, r2000-tools.ts included via its static import, no dynamic-import blindness since Task 2 wired it statically).
- `node scripts/check-skill-tool-coverage.mjs` → OK, r2000 extraction count 0 (expected — no skill mentions an r2000_* name until plan 11-09), planted-violation transcript above.
- `node scripts/check-skill-fork-honesty.mjs` → OK.

## Next Phase Readiness

- `r2000-tools.ts` exports exactly what plan 11-06 (the enum generator) and plan 11-08 (the memory-map renderer) need: `runR2000Tool`, `CURATED_R2000_TOOLS`, `resolveStorePath`. Both should call through `runR2000Tool()` for every r2000 interaction rather than reaching for `r2000-mcp-client.ts` directly, to inherit the allow-list gate and the auto-save behavior for free.
- `READ_ONLY_R2000_TOOLS`'s split (queries never save; everything else auto-saves) is a load-bearing convention future r2000 work should preserve — a new curated tool that mutates state but is miscategorized as read-only would silently lose its own writes.
- No blockers. `regenerator2000` remains available and live-verified on this host for any future plan needing the same real-child oracle.

---
*Phase: 11-annotation-store-enums-and-the-symbol-round-trip*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: .claude/mcp/vice/r2000-tools.ts
- FOUND: .claude/mcp/vice/r2000-tools.test.ts
- FOUND: .claude/mcp/vice/vice-proxy.ts
- FOUND: .claude/mcp/vice/vice-proxy.test.ts
- FOUND: .claude/mcp/vice/stock-dispatch.test.ts
- FOUND: .claude/mcp/vice/capability-registry.test.ts
- FOUND: .claude/mcp/vice/tool-support-table.test.mjs
- FOUND: .claude/mcp/vice/package.json
- FOUND: scripts/check-skill-tool-coverage.mjs
- FOUND: scripts/generate-tool-support-table.mjs
- FOUND: CLAUDE.md
- FOUND commit: 9234b54 (feat(11-05): r2000-tools.ts -- 17 curated tools, the D-33 batch gate, and project-path validation)
- FOUND commit: 4135738 (feat(11-05): register the r2000_* family proxy-locally, backend-independent by construction)
- FOUND commit: 58fd74c (feat(11-05): teach check-skill-tool-coverage.mjs about r2000_* names)
- FOUND commit: f854e30 (fix(11-05): repair three synthetic-tool-name discoverers and CLAUDE.md's stale line citations after the r2000 registration)
