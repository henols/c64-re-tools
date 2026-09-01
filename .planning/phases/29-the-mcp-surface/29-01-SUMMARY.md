---
phase: 29-the-mcp-surface
plan: 01
subsystem: mcp-surface
tags: [mcp, annotation-store, sqlite, tool-registration, structural-guards, tracer]

# Dependency graph
requires:
  - phase: 28-the-store-core
    provides: "anno-store.ts (openStore/closeStore/listLabels/setLabel), anno-types.ts (SCHEMA_VERSION, storePathWithinWorkspace, parseStoreAddress, the AnnoStoreError family)"
provides:
  - "src/mcp/vice/anno-tools.ts — the one authoritative place for the curated anno_* tool surface: ANNO_TOOL_DEFINITIONS, the derived CURATED_ANNO_TOOLS allow-list, assertAnnoTool(), and runAnnoTool() as the never-throw boundary"
  - "One advertised verb, anno_get_symbols, answering a real query against a real store end to end through buildViceTool()"
  - "WR-02 closed: the allow-list gate sits inside runAnnoTool()'s try, so a refusal resolves {isError:true} instead of rejecting the promise"
  - "Seven registration-time structural guards re-pointed from the anno_* family onto the anno_* family, all in this wave"
  - "A recorded negative control proving the tool-support-table generator throws by name on an un-re-pointed witness rather than emitting a different table"
affects: [29-02, 29-03, 29-04, 29-05, 29-06, 29-07, 29-08, 29-10]

actuals:
  tokens: 130690
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Per-call open/close store lifecycle (D-06): no module-level handle, closeStore in a finally on every path"
    - "Allow-list derived from the definition table rather than hand-typed, so a name cannot be curated in one place and absent from the other"
    - "Never-throw MCP boundary with the gate INSIDE the try (WR-02's closure)"
    - "Structural guards derived from disk with a non-vacuity floor, replacing hand-typed exact-N lists"

key-files:
  created:
    - src/mcp/vice/anno-tools.ts
    - src/mcp/vice/anno-tools.test.ts
  modified:
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/tool-support-table.test.mjs
    - src/mcp/vice/capability-registry.test.ts
    - src/mcp/vice/hostpath-consumers.test.ts
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/anno-seam.test.ts
    - src/mcp/vice/package.json
    - scripts/generate-tool-support-table.mjs

key-decisions:
  - "AnnoToolArgumentError was added alongside AnnoUncuratedToolError rather than reusing an existing anno-types.ts class: the transport validates nothing (vice-proxy.ts:3230's validate: (value) => ({ value })), so required arguments are re-checked at the only boundary that runs, and a missing argument is a different fact from an uncurated name."
  - "anno_get_symbols reports `truncated` explicitly rather than leaving the caller to infer it from `returned == max_results` — a capped answer and an answer that is complete at exactly the ceiling are different facts."
  - "module-classification.ts's anno-tools.ts entry was re-pointed rather than frozen: two of its three cited consumers ceased to exist in this commit, and the register's own Direction 9 containment check is what forced the correction. The rationale now records that the record predicted this and is being read back, not rewritten."
  - "anno-seam.test.ts's files[] guard is now derived from disk with a floor instead of a hand-typed three, keeping both of its teeth (no test file, no test-only .mjs helper) while letting the module count grow across phase 29."
  - "docs/tool-support.md's byte length is 8,132, not the 7,874 the plan's must_haves carried from RESEARCH. The committed file has been 8,132 bytes since commit 602f9cb (phase 15) and was not touched by this plan; the load-bearing property (regenerates byte-identical to the committed file) holds and is now asserted on both length and content."

patterns-established:
  - "Named-absence guard: a module is named as forbidden from a seam BEFORE the module exists, so a later plan in the same phase cannot introduce the violation unnoticed"
  - "Negative control for a re-pointed witness: the same synthetic source, one identifier changed, must throw naming the unresolved identifier — proving the generator can never emit a different table, only refuse"
  - "Planted-violation proof after re-pointing a guard: a guard whose planted violation no longer reddens has not been re-pointed"

requirements-completed: [MCP-02, MCP-03, MCP-05]

coverage:
  - id: D1
    description: "One curated anno_* verb is advertised through buildViceTool() and answers a real query against a real store end to end"
    requirement: MCP-05
    verification:
      - kind: integration
        ref: "src/mcp/vice/anno-tools.test.ts#tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-dispatch.test.ts#structure/proxy (plan 29-01): the anno_* loop registration's runner is runAnnoTool, whose body touches no VICE transport at all"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "The registration seam's backend-independence is structural: exactly two ordered registrations bypass buildBackendAwareTool(), and the anno entry holds position 2"
    requirement: MCP-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-dispatch.test.ts#structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-dispatch.test.ts#structure/proxy (plan 29-01): every curated anno_* name is absent from BOTH tools-manifest.json and tools-manifest.stock.json"
        status: pass
    human_judgment: false
  - id: D3
    description: "Neither manifest nor docs/tool-support.md gains an entry, and a witness left un-re-pointed throws by name rather than emitting a different table"
    requirement: MCP-03
    verification:
      - kind: unit
        ref: "src/mcp/vice/tool-support-table.test.mjs#negative control (MCP-03/WR-08): a loop-variable regex left un-re-pointed makes discoverSyntheticToolNames THROW by name -- it never emits a different table"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/tool-support-table.test.mjs#MCP-03: the regenerated table matches the committed docs/tool-support.md in BYTE LENGTH as well as content"
        status: pass
      - kind: unit
        ref: "git diff --exit-code -- docs/tool-support.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "MCP-02 by construction: hostpath.ts's production consumer set is still exactly five, and every module this phase adds is named as forbidden from it before it exists"
    requirement: MCP-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/hostpath-consumers.test.ts#hostpath.ts's production consumer set is exactly the five declared modules"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/hostpath-consumers.test.ts#every module this phase adds is absent from the hostpath.ts consumer set (MCP-02), named before it exists"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-tools.test.ts#MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam"
        status: pass
    human_judgment: false
  - id: D5
    description: "vice-proxy.ts's net line count is unchanged, so CLAUDE.md's two rewriteArguments() citations still land"
    requirement: MCP-05
    verification:
      - kind: unit
        ref: "src/mcp/vice/docs-linerefs.test.ts"
        status: pass
      - kind: other
        ref: "git diff --numstat HEAD -- src/mcp/vice/vice-proxy.ts (24 added / 24 deleted)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The advertised tool list a live MCP client actually receives after the substitution"
    verification: []
    human_judgment: true
    rationale: "vice-proxy.test.ts is in MANUAL_ONLY_TESTS (it needs a live host VICE server) and cannot run in this environment, so the end-to-end tools/list wire output was proven structurally — through the registration-seam guards and the manifest-absence loop — rather than observed on a live client. A human running the plugin against a real emulator is the only route to that observation."

duration: 17 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 01: The anno_* Registration Tracer Summary

**The owned annotation store now answers an agent over MCP: `anno_get_symbols` is registered proxy-locally through `buildViceTool()`, opens a real store, reads it and closes it in a `finally` — and all seven guards that break on registration moved in the same wave.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-29T13:47:00Z (approx — first task commit 15:47:24 +0200)
- **Completed:** 2026-08-29T14:04:50Z
- **Tasks:** 3 of 3
- **Files modified:** 11 (2 created, 9 modified)

*`actuals.tokens` is chars/4 over the files actually changed (522,758 chars → 130,690). The realized diff alone is 71,937 chars → 17,984; the file-based figure is reported because that is the scale the executor protocol names, and the gap between the two is itself the useful calibration signal for a plan whose work is concentrated in small substitutions inside large files.*

## Accomplishments

- **`src/mcp/vice/anno-tools.ts`** — the one authoritative place for the curated `anno_*` surface. `ANNO_TOOL_DEFINITIONS` (one verb in this tracer slice), `CURATED_ANNO_TOOLS` **derived** from it rather than hand-typed (T-29-02), `assertAnnoTool()` whose first statement is set membership, two `AnnoStoreError` subclasses and no bare `Error` anywhere, and `runAnnoTool()` as the never-throw boundary.
- **WR-02 closed.** `assertAnnoTool()` sits *inside* `runAnnoTool()`'s `try`, unlike `anno-tools.ts`'s gate, which sits outside it and makes a refusal reject the promise. Every failure now reaches the caller through one shape, `{isError:true}` with the error class named in the text.
- **The registration loop was substituted, not appended to.** `vice-proxy.ts:194` and `:3401-3403` were replaced line for line (24 added / 24 deleted), so `docs-linerefs.test.ts`'s two CLAUDE.md `rewriteArguments()` citations still land on their cited lines and the anno family left the advertised surface in the same commit.
- **Seven registration-time guards re-pointed in this wave** (the plan enumerated five; two more were found by running them). The three duplicate bounding witnesses each kept their own distinct technique — character-offset search, brace-depth counting, line-oriented scanning — and none was refactored into a shared helper.
- **A recorded negative control for MCP-03.** The same twelve-line synthetic proxy source, with one identifier changed, either resolves cleanly or throws naming `"annoDef"`. That is what makes the byte-identity of `docs/tool-support.md` evidence rather than coincidence: a table that regenerates identically because a witness still points at a dead name would look exactly the same.

## Task Commits

1. **Task 1: End-to-end "the store answers an agent through the MCP surface"** — `65a28f3` (feat)
2. **Task 2: The generator's negative control** — `eab91a2` (test)
3. **Task 3: MCP-02 by construction — the hostpath consumer set stays exactly five** — `20c219f` (test)
4. **Deviation (Rule 3): the seventh guard** — `8a60701` (fix)

## Files Created/Modified

- `src/mcp/vice/anno-tools.ts` (new, 395 lines) — the curated `anno_*` tool table, allow-list gate, per-argument validators, store-path resolution and the never-throw runner.
- `src/mcp/vice/anno-tools.test.ts` (new, 257 lines) — the tracer case plus the never-throw, gate-ordering and structural (`finally`, no module-level handle, no host-path seam) assertions.
- `src/mcp/vice/vice-proxy.ts` — the import and the registration loop, substituted in place, line-count-neutral.
- `src/mcp/vice/stock-dispatch.test.ts` — ordered `BACKEND_SEAM_BYPASS_KEYS`, the `>= 5` floor message, the body-slice read path onto `anno-tools.ts`/`runAnnoTool`, and the manifest-absence loop onto `CURATED_ANNO_TOOLS`. The `anno-tools.ts` import at `:45` is gone with its use sites.
- `scripts/generate-tool-support-table.mjs` — witness 1 (`ANNO_LOOP_VAR_RE`) plus the prose naming the array.
- `src/mcp/vice/tool-support-table.test.mjs` — witness 2, plus the negative control, positive control, real-source identity and byte-length tests.
- `src/mcp/vice/capability-registry.test.ts` — witness 3, plus the stale "array of 17" comment corrected (the array it described held 19; the count is no longer restated at all).
- `src/mcp/vice/hostpath-consumers.test.ts` — the named-absence list extended to all five modules this phase adds. `EXPECTED_IMPORTERS` and its `length, 5` assertion are byte-identical; `ANNO_MODULE_FLOOR` and the INT-01 positive control are untouched.
- `src/mcp/vice/module-classification.ts` — two dead consumer citations removed and the prose/rationale corrected (deviation 1).
- `src/mcp/vice/anno-seam.test.ts` — the `files[]` guard derived from disk (deviation 2).
- `src/mcp/vice/package.json` — `anno-tools.ts` added to `files[]`.

## Decisions Made

- **A second error class, `AnnoToolArgumentError`.** The plan's artifact list named only `AnnoUncuratedToolError`. The transport validates nothing — `vice-proxy.ts:3230`'s `validate: (value) => ({ value })` means `required` in an `inputSchema` is documentation for the model, not an enforced contract — so a missing `store` or `max_results` has to be refused here. Reusing `AnnoUncuratedToolError` for it would have made "you asked for a verb that does not exist" and "you called a real verb wrongly" indistinguishable in the error class the runner names, which is exactly the distinction T-29-04 exists to preserve.
- **`truncated` is reported, not inferred.** `returned == max_results` and "the answer was cut short" are different facts; the second is stated.
- **`repoRoot()` is called at dispatch time, never frozen at module load** — the read-at-call-time convention `anno-tools.ts`'s cap override already uses, which is what lets `anno-tools.test.ts` point a real temporary workspace at the real confinement code instead of stubbing the seam the threat model depends on.
- **The workspace root is moved, not mocked, in the test.** `CLAUDE_PROJECT_DIR` is set to a temp directory and restored in a `finally`, so T-29-01's containment is exercised for real.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] A sixth registration-time guard: `module-classification.ts`'s advisory line citations**

- **Found during:** Task 1 (the plan's own `<verify>` command, which includes `module-classification.test.ts`)
- **Issue:** `MODULE_CLASSIFICATION`'s `anno-tools.ts` entry cited two consumers by file and line — `vice-proxy.ts:194` for `ANNO_TOOL_DEFINITIONS` and `stock-dispatch.test.ts:45` for `CURATED_ANNO_TOOLS`. Both lines now hold `anno-tools.ts` imports, so DIRECTION 9's containment check reported citation drift. The register's own prose at `:44-51` made the same now-false claim.
- **Fix:** The two dead consumers were removed from the entry, leaving `scripts/check-skill-tool-coverage.mjs:49` — which still imports `CURATED_ANNO_TOOLS` — as a live basis, so DIRECTION 3's non-empty-basis check keeps its force. The prose and the rationale were corrected to record that two of the three predicted imports are already gone, rather than restating a claim the tree contradicts.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` — 18/18 pass.
- **Committed in:** `65a28f3` (part of the Task 1 commit, per D-13: a registration-time guard moves in the registering commit)

**2. [Rule 3 - Blocker] A seventh registration-time guard: `anno-seam.test.ts`'s `files[]` exact-three assertion**

- **Found during:** post-Task-3 verification of adjacent tests
- **Issue:** Adding `anno-tools.ts` to `package.json`'s `files[]` — required by Task 1 — reddened `anno-seam.test.ts:219`, which asserted the shipped `anno-` entry set was exactly `["anno-index.ts", "anno-store.ts", "anno-types.ts"]`. The plan did not enumerate this guard.
- **Fix:** The expectation is now derived from disk (`anno-*.ts`/`.mts` excluding `*.test.*`) with a non-vacuity floor, the same INT-01 shape `hostpath-consumers.test.ts` already uses. Both of the guard's real teeth survive: a listed test file or a listed test-only `.mjs` helper appears in the actual set and in neither expectation, so the `deepEqual` still reddens.
- **Files modified:** `src/mcp/vice/anno-seam.test.ts`
- **Verification:** Planted violation — adding `anno-tools.test.ts` to `files[]` reddens the test by name (`not ok 8`), then reverted. This discharges the plan's `prohibitions` entry: a guard whose planted violation no longer reddens has not been re-pointed.
- **Committed in:** `8a60701`

**3. [Rule 2 - Missing critical functionality] `AnnoToolArgumentError`**

- **Found during:** Task 1
- **Issue:** The plan's artifact list named one error class. Required-argument validation had no named refusal, and the transport enforces nothing.
- **Fix:** Added `AnnoToolArgumentError extends AnnoStoreError` carrying `toolName`, `argument` and `batchIndex` (the last threaded for the future `anno_batch_execute`, per the shared-validator discipline).
- **Files modified:** `src/mcp/vice/anno-tools.ts`
- **Verification:** `anno-tools.test.ts#the transport validates nothing, so a missing required argument is refused HERE and named` — three shapes (missing `store`, missing `max_results`, non-object args).
- **Committed in:** `65a28f3`

**4. [Measured correction, not a code change] `docs/tool-support.md` is 8,132 bytes, not 7,874**

- **Found during:** plan-level verification
- **Issue:** The plan's `must_haves.truths` asserted the table regenerates byte-identical *at 7,874 bytes*, carried from `29-RESEARCH.md`. The committed file is 8,132 bytes and has been since `602f9cb` (phase 15) — confirmed by `git show HEAD~3:docs/tool-support.md | wc -c`.
- **Fix:** None needed in code. The load-bearing half of the truth — regenerates byte-identical to the committed file, unchanged by the substitution — holds and is now asserted mechanically on **both** length and content. The stale figure is recorded here so a later plan does not re-derive it from RESEARCH.
- **Verification:** `git diff --exit-code -- docs/tool-support.md` clean; `tool-support-table.test.mjs#MCP-03: the regenerated table matches ... in BYTE LENGTH as well as content` passes.

---

**Total deviations:** 3 auto-fixed (2 × Rule 3 blocker, 1 × Rule 2 missing-critical) plus 1 measured correction to a plan fact.
**Impact on plan:** No scope creep. Both Rule 3 fixes are guards the plan's own D-13 discipline required to move in this wave — the plan under-counted the registration-time guard set at five; the true count is seven. The Rule 2 addition is input validation at a boundary the threat model explicitly names as unvalidated.

## Issues Encountered

- **`vice-proxy.test.ts` could not be run.** It is in `MANUAL_ONLY_TESTS` (`test-gate.mjs:95-105`) because it needs a live host VICE server; an attempt to run it produced no output and had to be killed. Every other test that references a changed identifier was run instead: `anno-seam`, `anno-tools`, `capability-registry`, `hostpath-consumers`, `module-classification`, `anno-tools`, `anno-upstream-audit`, `stock-dispatch`, `tool-support-table`, `docs-linerefs` — 272 tests, 0 failures, 4 pre-existing skips. This is recorded as coverage entry D6 with `human_judgment: true`.
- **The full-glob suite was deliberately not run.** It takes ~660s, exceeds the tool timeout, and carries a ~44-failure clean-tree baseline, so a run here would have produced noise rather than a signal. Plan 29-02 Task 1 owns measuring that baseline.

## Verification Results

| Check | Result |
|---|---|
| `node --test` over the plan's seven named files | 200 tests, 200 pass |
| `node --test` over every test referencing a changed identifier | 272 tests, 268 pass, 4 pre-existing skips, 0 fail |
| `npm run typecheck` | clean |
| `node scripts/check-npm-packages.mjs` | exit 0 — 81 files, 34 files / 7 skills |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 |
| `node scripts/check-skill-fork-honesty.mjs` | exit 0 |
| `node scripts/audit-gate.mjs` | exit 0 — 8 docs guards green |
| `git diff --exit-code -- docs/tool-support.md` | no diff |
| `git diff --numstat HEAD -- src/mcp/vice/vice-proxy.ts` | 24 / 24 — line-count-neutral |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 29-02. The registration seam is proven end to end and the phase's architectural risk is discharged: every remaining `anno_*` verb is an entry appended to `ANNO_TOOL_DEFINITIONS` and a dispatch arm added to `dispatch()`, with no further change to `vice-proxy.ts`.

Two facts later plans should carry forward:

- **The registration-time guard set is seven, not five.** `module-classification.ts`'s Direction 9 citations and `anno-seam.test.ts`'s `files[]` assertion both break on registration and are now re-pointed; a plan adding another `anno-*` module needs no edit to either (both are derived from disk).
- **`stock-dispatch.test.ts` no longer references `anno-tools.ts` at all**, so plan 29-10's deletion of that module will not break it. `scripts/check-skill-tool-coverage.mjs:49` is the one surviving `CURATED_ANNO_TOOLS` importer and is cited as such in `module-classification.ts`.

**Requirement marking.** Of this plan's three requirements only `MCP-03` was marked Complete: `MCP-02` and `MCP-05` are declared by sibling plans in this phase that have no SUMMARY yet, so the shared-ID gate (`requirements.ready-ids`) correctly held them. They become ready when the last declaring plan finishes.

**Broken-windows ledger.** One entry filed: `unrun-verify` on `src/mcp/vice/vice-proxy.test.ts` (MANUAL_ONLY, needs a live host VICE server), matching coverage entry D6.

No blockers. No stubs. No new threat surface: the two trust boundaries this plan opens (LLM-supplied arguments, LLM-supplied store path) are the ones the plan's own threat register names, and T-29-01 through T-29-04 are all mitigated as specified.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*

## Self-Check: PASSED

- `src/mcp/vice/anno-tools.ts` — FOUND
- `src/mcp/vice/anno-tools.test.ts` — FOUND
- `.planning/phases/29-the-mcp-surface/29-01-SUMMARY.md` — FOUND
- Commits `65a28f3`, `eab91a2`, `20c219f`, `8a60701`, `9048f5e` — all present in `git log --all`
